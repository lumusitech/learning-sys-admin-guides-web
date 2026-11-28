#!/usr/bin/env node
/**
 * Lint de idioma: detecta voseo y regionalismos en la prosa.
 *
 * Recorre `content/`, `docs/` y `README.md` y falla si encuentra formas de
 * voseo (presente o imperativo) o léxico regional. Ignora los bloques de
 * código y los documentos que citan esas formas como referencia.
 *
 * Regla y conversión: docs/content-style.md
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const SCAN_DIRS = ['content', 'docs'];
const EXTRA_FILES = ['README.md'];
const SKIP_FILES = new Set(['docs/content-style.md']); // cita las formas como referencia
const EXTENSIONS = ['.md'];

// Formas de voseo y regionalismos. Se comparan con límite de palabra e
// insensible a mayúsculas (para atrapar el inicio de oración).
const MARKERS = [
  // presente, 2ª persona
  'tenés', 'podés', 'querés', 'sabés', 'sos', 'entendés', 'comparás', 'descartás',
  'enfrentás', 'resolvés', 'escribís', 'observás', 'encontrás', 'venís', 'decís',
  'salís', 'sentís', 'preferís', 'abrís', 'hacés', 'ponés', 'dormís', 'usás',
  'necesitás', 'notás', 'dejás', 'pasás', 'llevás', 'buscás', 'revisás', 'mirás',
  'pensás', 'probás', 'verificás', 'ejecutás', 'usabas', 'sabías', 'tenías',
  // imperativos
  'usá', 'guardá', 'verificá', 'normalizá', 'copiá', 'pensá', 'tocá', 'agregá',
  'quitá', 'mirá', 'contá', 'nombrá', 'tratá', 'documentá', 'ejecutá', 'buscá',
  'escribí', 'evitá', 'filtrá', 'pedí', 'capturá', 'aceptá', 'reducí', 'resolvé',
  'elevá', 'dejá', 'poné', 'hacé', 'andá', 'corré', 'probá', 'abrí', 'cerrá',
  'tené', 'vení', 'salí', 'largá', 'sacá', 'meté', 'tirá', 'agarrá', 'quedáte',
  'limitá', 'rechazá', 'fallá', 'mantené',
  'fijate', 'acordate', 'olvidate', 'sentate', 'cuidate', 'dale', 'contame',
  'decime', 'pasame', 'hacelo', 'decile', 'andate',
  // pronombres y léxico regional
  'vos', 'acá', 'che', 'lindo', 'bárbaro', 'posta', 'laburo', 'guita',
];

const PATTERN = new RegExp(`(?<![\\p{L}\\p{N}])(${MARKERS.join('|')})(?![\\p{L}\\p{N}])`, 'iu');

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (EXTENSIONS.some((ext) => entry.name.endsWith(ext))) yield path;
  }
}

function collectFiles() {
  const files = [];
  for (const dir of SCAN_DIRS) {
    try {
      files.push(...walk(dir));
    } catch {
      // directorio ausente: se ignora
    }
  }
  files.push(...EXTRA_FILES);
  return files.filter((file) => !SKIP_FILES.has(file));
}

const problems = [];

for (const file of collectFiles()) {
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  let inFence = false;

  lines.forEach((line, index) => {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;

    const match = line.match(PATTERN);
    if (!match) return;

    const column = line.indexOf(match[1]);
    problems.push(`${relative('.', file)}:${index + 1}:${column + 1}  ${match[1]}`);
  });
}

if (problems.length > 0) {
  console.error(`Idioma: ${problems.length} marca(s) de voseo o regionalismo.\n`);
  for (const problem of problems) console.error(`  ${problem}`);
  console.error('\nVer docs/content-style.md para la conversión a español neutro.');
  process.exit(1);
}

console.log('Idioma: OK (español neutro, sin voseo)');
