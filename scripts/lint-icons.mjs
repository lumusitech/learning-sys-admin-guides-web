#!/usr/bin/env node
/**
 * Lint de coherencia de iconos.
 *
 * Verifica que:
 *  - todo título (h1-h6 fuera de bloques de código) empiece con un icono del set;
 *  - el `title:` del frontmatter también;
 *  - el icono pertenezca al set canónico definido en docs/icon-system.md;
 *  - haya un espacio entre el icono y el texto.
 *
 * Fuente única de verdad: el bloque entre `<!-- icon-set:start/end -->`.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DOC = 'docs/icon-system.md';
const CONTENT = 'content';
const EMOJI = /^\s*(\p{Extended_Pictographic}(?:\uFE0F)?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F)?)*)/u;

const problems = [];

function fail(message) {
  problems.push(message);
}

/** Devuelve el emoji inicial de un texto, o null. */
function leadingEmoji(text) {
  const match = text.match(EMOJI);
  return match ? match[1] : null;
}

/** Clave normalizada para comparar (sin selectores de variación). */
function key(emoji) {
  return emoji.replace(/\uFE0F/g, '');
}

function loadIconSet() {
  const doc = readFileSync(DOC, 'utf8');
  const start = doc.indexOf('<!-- icon-set:start -->');
  const end = doc.indexOf('<!-- icon-set:end -->');
  if (start === -1 || end === -1) {
    console.error(`${DOC}: faltan los marcadores <!-- icon-set:start --> / <!-- icon-set:end -->`);
    process.exit(1);
  }

  const set = new Map();
  for (const line of doc.slice(start, end).split('\n')) {
    const row = line.match(/^\|\s*(\S+)\s*\|\s*(.+?)\s*\|/u);
    if (!row) continue;
    const emoji = leadingEmoji(row[1]);
    if (!emoji) continue;
    const k = key(emoji);
    if (set.has(k)) {
      console.error(`${DOC}: icono duplicado en el set: ${emoji}`);
      process.exit(1);
    }
    set.set(k, row[2]);
  }

  if (set.size === 0) {
    console.error(`${DOC}: el set canónico está vacío`);
    process.exit(1);
  }
  return set;
}

function* markdownFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* markdownFiles(path);
    else if (entry.name.endsWith('.md')) yield path;
  }
}

function checkHeading(file, lineNumber, text, set) {
  const emoji = leadingEmoji(text);
  const label = text.trim().slice(0, 60);

  if (!emoji) {
    fail(`${file}:${lineNumber} sin icono → ${label}`);
    return;
  }
  if (!set.has(key(emoji))) {
    fail(`${file}:${lineNumber} icono fuera del set (${emoji}) → ${label}`);
    return;
  }
  if (text[emoji.length] !== ' ') {
    fail(`${file}:${lineNumber} falta un espacio tras el icono → ${label}`);
  }
}

function checkFrontmatterTitle(file, lines, set) {
  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(/^title:\s*"(.*)"\s*$/);
    if (!match) continue;
    const emoji = leadingEmoji(match[1]);
    if (!emoji) fail(`${file}:${i + 1} el título de página no tiene icono`);
    else if (!set.has(key(emoji))) fail(`${file}:${i + 1} icono de página fuera del set (${emoji})`);
    return;
  }
}

const iconSet = loadIconSet();

for (const file of markdownFiles(CONTENT)) {
  const lines = readFileSync(file, 'utf8').split('\n');
  checkFrontmatterTitle(file, lines, iconSet);

  let inFence = false;
  lines.forEach((line, index) => {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) checkHeading(file, index + 1, heading[2], iconSet);
  });
}

if (problems.length > 0) {
  console.error(`\nIconos: ${problems.length} problema(s)\n`);
  for (const problem of problems) console.error(`  ✗ ${problem}`);
  console.error('\nSet canónico: docs/icon-system.md');
  process.exit(1);
}

console.log(`Iconos: OK (${iconSet.size} iconos en el set)`);
