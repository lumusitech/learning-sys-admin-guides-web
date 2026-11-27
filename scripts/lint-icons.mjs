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
 * Fuente única de verdad: el bloque `<!-- icon-set:start/end -->`; el set se
 * comparte con `scripts/new-guide.mjs` vía `scripts/lib/icon-set.mjs`.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ICON_DOC, iconKey, leadingEmoji, loadIconSet } from './lib/icon-set.mjs';

const CONTENT = 'content';

const problems = [];

function fail(message) {
  problems.push(message);
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
  if (!set.has(iconKey(emoji))) {
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
    else if (!set.has(iconKey(emoji))) fail(`${file}:${i + 1} icono de página fuera del set (${emoji})`);
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
  console.error(`\nSet canónico: ${ICON_DOC}`);
  process.exit(1);
}

console.log(`Iconos: OK (${iconSet.size} iconos en el set)`);
