#!/usr/bin/env node
/**
 * Prepara el contenido markdown para el content collection de Astro.
 *
 * 1. Copia archivos desde el repo de origen a ./content
 * 2. Inyecta frontmatter (title, level, section) si no existe
 * 3. Reescribe links relativos *.md a rutas absolutas del sitio
 *
 * Uso:
 *   node scripts/prepare-content.mjs <sourceDir> [--base=/ruta/] [archivo...]
 *
 * Sin archivos explícitos, copia todos los .md del origen.
 */

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2);
const baseArg = args.find((arg) => arg.startsWith('--base='));
const BASE = baseArg ? baseArg.slice('--base='.length) : '/';
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
  const match = markdown.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

function extractLevel(markdown) {
  const match = markdown.match(/\*\*Nivel:\*\*\s*([^\p{L}\n]*)(\p{L}+)/u);
  return match ? match[2] : null;
}

function toYamlString(value) {
  return JSON.stringify(value);
}

function buildFrontmatter({ title, level, section }) {
  const lines = ['---', `title: ${toYamlString(title)}`];
  if (level) lines.push(`level: ${toYamlString(level)}`);
  if (section) lines.push(`section: ${toYamlString(section)}`);
  lines.push('---', '');
  return lines.join('\n');
}

function normalizeBase(base) {
  const withSlash = base.startsWith('/') ? base : `/${base}`;
  return withSlash.endsWith('/') ? withSlash : `${withSlash}/`;
}

function rewriteLinks(markdown, filePath, base) {
  const dir = path.posix.dirname(filePath);
  const prefix = normalizeBase(base);

  return markdown.replace(/\]\(([^)\s]+?\.md)(#[^)]*)?\)/g, (match, target, anchor) => {
    if (target.startsWith('/') || target.startsWith('http')) return match;

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
  const files = explicitFiles.length > 0 ? explicitFiles : await collectMarkdown(sourceDir);

  let written = 0;
  const skipped = [];

  for (const relative of files) {
    const source = path.join(sourceDir, relative);
    let markdown;
    try {
      markdown = await readFile(source, 'utf8');
    } catch {
      skipped.push(relative);
      continue;
    }

    const title = extractTitle(markdown);
    if (!title) {
      skipped.push(relative);
      continue;
    }

    const section = sectionOf(relative);
    const level = extractLevel(markdown);
    const withLinks = rewriteLinks(markdown, relative, BASE);

    const body = withLinks.startsWith('---\n')
      ? withLinks
      : `${buildFrontmatter({ title, level, section })}${withLinks}`;

    const destination = path.join(CONTENT_DIR, relative);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, body, 'utf8');
    written += 1;
  }

  console.log(`Copiados: ${written}`);
  if (skipped.length > 0) {
    console.log(`Omitidos (sin H1 o ilegibles): ${skipped.length}`);
    for (const file of skipped) console.log(`  - ${file}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
