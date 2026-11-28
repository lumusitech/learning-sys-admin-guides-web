#!/usr/bin/env node
/**
 * Lint de contenido.
 *
 * Valida:
 *  1. Forma del frontmatter: `title` y `section` siempre; `level` en guides y
 *     scenarios. `section`/`level` dentro de sus allowlists y `section`
 *     coincidente con la carpeta.
 *  2. Links internos absolutos: base correcta, barra final y sección conocida.
 *     Los ids bien formados que aún no existen se reportan como aviso
 *     (pendientes de sync upstream), no como error.
 *  3. Anclas: cada `#ancla` tiene su `id` en el HTML construido (`dist/`).
 *     Si `dist/` no existe, las anclas se omiten con un aviso.
 *
 * Uso: `pnpm lint:content` (tras `pnpm build` para validar anclas).
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { SITE_BASE } from '../src/lib/site.mjs';
import { LEVELS, SECTIONS } from './lib/content-constants.mjs';

const CONTENT = 'content';
const DIST = 'dist';
const PENDING_FILE = 'scripts/pending-sync.json';
const BASE = SITE_BASE.endsWith('/') ? SITE_BASE : `${SITE_BASE}/`;
const LEVELED_SECTIONS = new Set(['guides', 'scenarios']);

/** Enlaces markdown: `[texto](destino "título")`. */
const LINK = /\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/g;

const errors = [];
const warnings = [];

function fail(message) {
  errors.push(message);
}

function warn(message) {
  warnings.push(message);
}

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (entry.name.endsWith('.md')) yield path;
  }
}

function splitFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return null;
  const header = match[0];
  return {
    yaml: match[1],
    body: raw.slice(header.length),
    offset: header.split(/\r?\n/).length - 1,
  };
}

/** Primer H1 del cuerpo, ignorando bloques de código. */
function firstHeading(body) {
  let fence = false;
  for (const line of body.split(/\r?\n/)) {
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

/** Quita el icono inicial para comparar título y H1. */
function stripIcon(value) {
  return value.replace(/^\p{Extended_Pictographic}[^\p{L}\p{N}]*\s*/u, '').trim();
}

function field(yaml, name) {
  const match = yaml.match(
    new RegExp(`^${name}:\\s*(?:"([^"]*)"|'([^']*)'|(\\S+))\\s*$`, 'm'),
  );
  if (!match) return null;
  return match[1] ?? match[2] ?? match[3] ?? null;
}

/** Devuelve los links del cuerpo, ignorando bloques de código. */
function linksIn(body, offset) {
  const links = [];
  let inFence = false;

  for (const [index, line] of body.split(/\r?\n/).entries()) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    LINK.lastIndex = 0;
    let match;
    while ((match = LINK.exec(line)) !== null) {
      links.push({ target: match[1], line: index + 1 + offset });
    }
  }

  return links;
}

const docs = [];
for (const file of [...walk(CONTENT)].sort()) {
  const raw = readFileSync(file, 'utf8');
  const id = relative(CONTENT, file).replace(/\\/g, '/').replace(/\.md$/, '');
  const parts = splitFrontmatter(raw);
  if (!parts) {
    fail(`${file}: falta el frontmatter (--- ... ---).`);
    continue;
  }
  docs.push({ file, id, raw, ...parts });
}

const existingIds = new Set(docs.map((doc) => doc.id));
const hasDist = existsSync(DIST);

/* Allowlist de ids que existen upstream (snapshot generado por
   `pnpm sync:allowlist`). Permite separar "pendiente de sync" de un typo. */
const pendingIds = new Set();
if (existsSync(PENDING_FILE)) {
  try {
    const data = JSON.parse(readFileSync(PENDING_FILE, 'utf8'));
    if (Array.isArray(data.ids)) for (const id of data.ids) pendingIds.add(id);
  } catch {
    warn(`${PENDING_FILE}: no se pudo leer el allowlist.`);
  }
}
const hasAllowlist = pendingIds.size > 0;

/** Reporta un id ausente según el allowlist: aviso o error. */
function reportMissing(where, target) {
  if (!hasAllowlist) {
    warn(`${where}: id ausente (${target}); allowlist de sync no disponible.`);
  } else if (pendingIds.has(target)) {
    warn(`${where}: pendiente de sync: ${target}`);
  } else {
    fail(`${where}: link a id inexistente (typo o documento eliminado): ${target}`);
  }
}

/* ---------------------------------------------------------------- */
/* 1. Frontmatter                                                    */
/* ---------------------------------------------------------------- */

for (const doc of docs) {
  const section = field(doc.yaml, 'section');
  const level = field(doc.yaml, 'level');
  const title = field(doc.yaml, 'title');

  if (!title) fail(`${doc.file}: falta "title" en el frontmatter.`);
  if (!section) fail(`${doc.file}: falta "section" en el frontmatter.`);

  const h1 = firstHeading(doc.body);
  if (!h1) fail(`${doc.file}: falta el H1 (# ...) en el cuerpo.`);
  else if (title && stripIcon(h1) !== stripIcon(title)) {
    fail(`${doc.file}: el H1 no coincide con el title ("${h1}" vs "${title}").`);
  }

  if (section && !SECTIONS.includes(section)) {
    fail(`${doc.file}: section "${section}" fuera de la allowlist (${SECTIONS.join(', ')}).`);
  }
  if (level && !LEVELS.includes(level)) {
    fail(`${doc.file}: level "${level}" fuera de la allowlist (${LEVELS.join(', ')}).`);
  }
  if (section && LEVELED_SECTIONS.has(section) && !level) {
    fail(`${doc.file}: falta "level" (requerido en ${section}).`);
  }

  const folder = doc.id.split('/')[0];
  if (section && section !== folder) {
    fail(`${doc.file}: section "${section}" no coincide con la carpeta "${folder}".`);
  }

  // Enlaces internos declarados en `meta[].links[].id`.
  for (const match of doc.yaml.matchAll(/^\s*-\s*id:\s*"([^"]+)"/gm)) {
    const target = match[1];
    const metaSection = target.split('/')[0];
    if (!SECTIONS.includes(metaSection)) {
      fail(`${doc.file}: meta link con sección desconocida (${target}).`);
    } else if (!existingIds.has(target)) {
      reportMissing(`${doc.file} (meta)`, target);
    }
  }
}

/* ---------------------------------------------------------------- */
/* 2. Links internos                                                 */
/* ---------------------------------------------------------------- */

const idCache = new Map();

/** Ids presentes en el HTML construido de una página, o `null` si no existe. */
function htmlIds(pageId) {
  if (idCache.has(pageId)) return idCache.get(pageId);

  const file = join(DIST, pageId, 'index.html');
  if (!existsSync(file)) {
    idCache.set(pageId, null);
    return null;
  }

  const html = readFileSync(file, 'utf8');
  const ids = new Set();
  const pattern = /\bid="([^"]+)"/g;
  let match;
  while ((match = pattern.exec(html)) !== null) {
    ids.add(decodeURIComponent(match[1]));
  }

  idCache.set(pageId, ids);
  return ids;
}

function checkAnchor(doc, pageId, anchor, line) {
  if (!hasDist) return;

  const ids = htmlIds(pageId);
  if (!ids) {
    warn(`${doc.file}:${line} no se pudo validar el ancla #${anchor} (falta ${pageId} en dist/).`);
    return;
  }

  const decoded = decodeURIComponent(anchor);
  if (!ids.has(decoded)) {
    fail(`${doc.file}:${line} ancla #${anchor} sin destino en ${pageId}.`);
  }
}

function checkLink(doc, target, line) {
  if (target.startsWith('#')) {
    checkAnchor(doc, doc.id, target.slice(1), line);
    return;
  }

  if (/^(https?:|mailto:|tel:|\/\/)/.test(target)) return; // externo

  if (!target.startsWith('/')) {
    if (/\.md($|#)/.test(target)) {
      warn(`${doc.file}:${line} link relativo (${target}); el sync lo reescribe a absoluto.`);
    }
    return; // assets relativos
  }

  if (!target.startsWith(BASE)) {
    fail(`${doc.file}:${line} base incorrecta (${target}); debe empezar por ${BASE}.`);
    return;
  }

  const rest = target.slice(BASE.length);
  const [path, anchor] = rest.split('#');
  if (!path) return; // enlace a la portada

  if (/\.[a-z0-9]+$/i.test(path)) return; // asset absoluto (.svg, .png, .json)

  if (!path.endsWith('/')) {
    fail(`${doc.file}:${line} falta la barra final (${target}).`);
    return;
  }

  const id = path.replace(/\/$/, '');
  const section = id.split('/')[0];
  if (!SECTIONS.includes(section)) {
    fail(`${doc.file}:${line} sección desconocida en link (${target}).`);
    return;
  }

  if (!existingIds.has(id)) {
    reportMissing(`${doc.file}:${line}`, id);
    return;
  }

  if (anchor) checkAnchor(doc, id, anchor, line);
}

for (const doc of docs) {
  for (const link of linksIn(doc.body, doc.offset)) {
    checkLink(doc, link.target, link.line);
  }
}

/* ---------------------------------------------------------------- */
/* 3. Reporte                                                        */
/* ---------------------------------------------------------------- */

if (!hasDist) {
  console.log('Aviso: no hay dist/; se omiten las anclas (corre pnpm build antes).');
}

if (!hasAllowlist) {
  console.log(`Aviso: sin ${PENDING_FILE}; los ids ausentes se tratan como aviso.`);
}

if (warnings.length > 0) {
  console.log(`\nContenido: ${warnings.length} aviso(s) de sync pendiente:`);
  for (const warning of warnings) console.log(`  ! ${warning}`);
}

if (errors.length > 0) {
  console.error(`\nContenido: ${errors.length} error(es).\n`);
  for (const error of errors) console.error(`  ✗ ${error}`);
  process.exit(1);
}

console.log(
  `\nContenido: OK (${docs.length} documentos, ${pendingIds.size} ids upstream, ${warnings.length} aviso(s)).`,
);
