#!/usr/bin/env node
/**
 * Prepara el contenido markdown para el content collection de Astro.
 *
 * 1. Copia archivos desde el repo de origen a ./content
 * 2. Inyecta frontmatter (title, level, section, meta) si no existe
 * 3. Reescribe links relativos *.md a rutas absolutas del sitio
 *
 * Uso:
 *   node scripts/prepare-content.mjs <sourceDir> [--base=/ruta/] [--section=guides] [archivo...]
 *
 * Sin archivos explícitos, copia todos los .md de las secciones del sitio.
 */

import { existsSync } from 'node:fs';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { SITE_BASE } from '../src/lib/site.mjs';
import { collectUpstreamIds, writePendingSync } from './lib/upstream-ids.mjs';

const args = process.argv.slice(2);
const baseArg = args.find((arg) => arg.startsWith('--base='));
const BASE = baseArg ? baseArg.slice('--base='.length) : SITE_BASE;
const sectionArg = args.find((arg) => arg.startsWith('--section='))?.slice('--section='.length) ?? null;
const skipExisting = args.includes('--skip-existing');
const positional = args.filter((arg) => !arg.startsWith('--'));

const sourceDir = positional[0];
if (!sourceDir) {
  console.error('Falta el directorio de origen.');
  process.exit(1);
}

const explicitFiles = positional.slice(1);

const CONTENT_DIR = path.resolve('content');

const SECTION_LABELS = {
  guides: 'Guías',
  scenarios: 'Escenarios',
  concepts: 'Conceptos',
  reference: 'Referencias',
  labs: 'Labs',
};

if (sectionArg && !SECTION_LABELS[sectionArg]) {
  console.error(`Sección desconocida: ${sectionArg} (usa ${Object.keys(SECTION_LABELS).join(', ')})`);
  process.exit(1);
}

/** Etiquetas del bloque de cabecera escrito a mano que se migran a `meta`. */
const HEADER_LABELS = new Set([
  'nivel',
  'archivos de práctica',
  'herramientas',
  'dominio',
  'archivos',
  'requisitos',
  'requisito',
  'ver escenarios relacionados',
]);

/** Recorre el origen y devuelve rutas relativas de archivos .md. */
async function collectMarkdown(root, relative = '') {
  const entries = await readdir(path.join(root, relative), { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const next = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (['node_modules', '.git', 'dist', '.astro'].includes(entry.name)) continue;
      files.push(...(await collectMarkdown(root, next)));
    } else if (entry.name.endsWith('.md')) {
      files.push(next);
    }
  }

  return files;
}

function extractTitle(markdown) {
  let fence = false;
  for (const line of markdown.split(/\r?\n/)) {
    if (/^\s*```/.test(line)) {
      fence = !fence;
      continue;
    }
    if (fence) continue;
    const match = line.match(/^#\s+(.+)$/);
    if (match) return match[1].trim();
  }
  return null;
}

function extractLevel(markdown) {
  const match = markdown.match(/\*\*Nivel:\*\*\s*([^\p{L}\n]*)(\p{L}+)/u);
  return match ? match[2] : null;
}

function toYamlString(value) {
  return JSON.stringify(value);
}

function buildFrontmatter({ title, level, section, meta = [] }) {
  const lines = ['---', `title: ${toYamlString(title)}`];
  if (level) lines.push(`level: ${toYamlString(level)}`);
  if (section) lines.push(`section: ${toYamlString(section)}`);
  if (meta.length > 0) {
    lines.push('meta:');
    for (const row of meta) {
      lines.push(`  - label: ${toYamlString(row.label)}`);
      if (row.value) lines.push(`    value: ${toYamlString(row.value)}`);
      if (row.links?.length) {
        lines.push('    links:');
        for (const link of row.links) {
          lines.push(`      - id: ${toYamlString(link.id)}`);
          if (link.label) lines.push(`        label: ${toYamlString(link.label)}`);
        }
      }
    }
  }
  lines.push('---', '');
  return lines.join('\n');
}

/**
 * Separa el bloque de cabecera escrito a mano que sigue al H1
 * (`**Nivel:**`, `**Herramientas:**`, `**Ver escenarios relacionados:**`…).
 */
function extractHeader(markdown, filePath) {
  const lines = markdown.split(/\r?\n/);
  const h1 = lines.findIndex((line) => /^#\s+/.test(line));
  if (h1 === -1) return { body: markdown, meta: [] };

  let index = h1 + 1;
  while (index < lines.length && lines[index].trim() === '') index += 1;

  const start = index;
  const header = [];
  while (index < lines.length) {
    const match = lines[index].match(/^\*\*([^*]+):\*\*/);
    if (!match || !HEADER_LABELS.has(match[1].trim().toLowerCase())) break;
    header.push(lines[index]);
    index += 1;
  }
  if (header.length === 0) return { body: markdown, meta: [] };

  const bodyLines = [...lines.slice(0, start), ...lines.slice(index)];
  const body = bodyLines.join('\n').replace(/\n{3,}/g, '\n\n');
  return { body, meta: parseHeader(header, filePath) };
}

/** Convierte `**Etiqueta:** valor` en filas de `meta`. */
function parseHeader(lines, filePath) {
  const meta = [];

  for (const line of lines) {
    const match = line.match(/^\*\*([^*]+):\*\*\s*(.*)$/);
    if (!match) continue;
    const label = match[1].trim();
    const value = match[2].trim();
    if (/^nivel$/i.test(label)) continue;

    if (/^ver escenarios relacionados$/i.test(label)) {
      const links = [];
      for (const link of value.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)) {
        if (!/\.md(?:#.*)?$/.test(link[2])) continue; // ignora directorios y externos
        const id = linkToId(link[2], filePath);
        if (id) links.push({ id, label: link[1].replace(/^`|`$/g, '') });
      }
      if (links.length > 0) meta.push({ label, links });
      continue;
    }

    if (value) meta.push({ label, value });
  }

  return meta;
}

/** Convierte un link (relativo `.md` o absoluto del sitio) en id de contenido. */
function linkToId(target, filePath) {
  if (/^(https?:|mailto:)/.test(target)) return null;
  const clean = target.replace(/#.*$/, '').replace(/\/$/, '');

  if (clean.startsWith('/')) {
    const prefix = normalizeBase(BASE);
    return clean.startsWith(prefix) ? clean.slice(prefix.length) : clean.slice(1);
  }

  const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(filePath), clean));
  return resolved.replace(/\.md$/, '');
}

function normalizeBase(base) {
  const withSlash = base.startsWith('/') ? base : `/${base}`;
  return withSlash.endsWith('/') ? withSlash : `${withSlash}/`;
}

function rewriteLinks(markdown, filePath, base) {
  const dir = path.posix.dirname(filePath);
  const prefix = normalizeBase(base);

  return markdown.replace(/\]\(([^)\s]+?\.md)(#[^)]*)?\)/g, (match, target, anchor) => {
    if (target.startsWith('/') || /^https?:\/\//.test(target)) return match;

    const resolved = path.posix.normalize(path.posix.join(dir, target));
    if (resolved.startsWith('..')) return match;

    const id = resolved.replace(/\.md$/, '');
    return `](${prefix}${id}/${anchor ?? ''})`;
  });
}

function sectionOf(filePath) {
  const [first] = filePath.split('/');
  return first && SECTION_LABELS[first] ? first : null;
}

async function main() {
  const allFiles = explicitFiles.length > 0 ? explicitFiles : await collectMarkdown(sourceDir);
  const files = sectionArg
    ? allFiles.filter((file) => file.startsWith(`${sectionArg}/`))
    : allFiles;

  let written = 0;
  const skipped = [];
  const ignored = [];
  const existing = [];

  if (sectionArg) console.log(`Sección: ${sectionArg}`);

  for (const relative of files) {
    // Solo secciones del sitio; fuera quedan README de sección, AGENTS.md,
    // .opencode/ y cualquier markdown que no sea contenido publicable.
    const section = sectionOf(relative);
    const basename = path.posix.basename(relative);
    if (!section || relative.endsWith('README.md') || basename.startsWith('_')) {
      ignored.push(relative);
      continue;
    }

    const destination = path.join(CONTENT_DIR, relative);
    if (skipExisting && existsSync(destination)) {
      existing.push(relative);
      continue;
    }

    const source = path.join(sourceDir, relative);
    let markdown;
    try {
      markdown = await readFile(source, 'utf8');
    } catch {
      skipped.push(relative);
      continue;
    }

    const hasFrontmatter = markdown.startsWith('---\n') || markdown.startsWith('---\r\n');
    const extracted = hasFrontmatter
      ? { body: markdown, meta: [] }
      : extractHeader(markdown, relative);

    const title = extractTitle(extracted.body);
    if (!title) {
      skipped.push(relative);
      continue;
    }

    const level = extractLevel(markdown);
    const withLinks = rewriteLinks(extracted.body, relative, BASE);

    const body = hasFrontmatter
      ? withLinks
      : `${buildFrontmatter({ title, level, section, meta: extracted.meta })}${withLinks}`;

    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, body, 'utf8');
    written += 1;
  }

  console.log(`Copiados: ${written}`);
  if (existing.length > 0) console.log(`Omitidos (ya existían): ${existing.length}`);
  if (ignored.length > 0) console.log(`Ignorados (fuera de sección o README): ${ignored.length}`);
  if (skipped.length > 0) {
    console.log(`Omitidos (sin H1 o ilegibles): ${skipped.length}`);
    for (const file of skipped) console.log(`  - ${file}`);
  }

  // El allowlist solo se refresca en una copia completa; una importación
  // explícita (archivos o directorio temporal) no debe pisarlo.
  if (explicitFiles.length === 0) {
    const ids = collectUpstreamIds(sourceDir);
    const allowlist = writePendingSync(ids);
    console.log(`Allowlist actualizado: ${ids.length} ids → ${allowlist}`);
  } else {
    console.log('Allowlist: sin cambios (importación parcial)');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
