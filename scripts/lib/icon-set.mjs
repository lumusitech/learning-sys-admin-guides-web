/**
 * Set canónico de iconos, leído de `docs/icon-system.md`.
 *
 * Fuente única para `lint-icons` y `new-guide`, de modo que el scaffolder
 * valide exactamente lo mismo que el lint.
 */

import { readFileSync } from 'node:fs';

export const ICON_DOC = 'docs/icon-system.md';

const EMOJI =
  /^\s*(\p{Extended_Pictographic}(?:\uFE0F)?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F)?)*)/u;

/** Devuelve el emoji inicial de un texto, o `null`. */
export function leadingEmoji(text) {
  const match = text.match(EMOJI);
  return match ? match[1] : null;
}

/** Clave normalizada para comparar (sin selectores de variación). */
export function iconKey(emoji) {
  return emoji.replace(/\uFE0F/g, '');
}

/** Carga el set canónico desde el bloque `<!-- icon-set:start/end -->`. */
export function loadIconSet() {
  const doc = readFileSync(ICON_DOC, 'utf8');
  const start = doc.indexOf('<!-- icon-set:start -->');
  const end = doc.indexOf('<!-- icon-set:end -->');
  if (start === -1 || end === -1) {
    console.error(`${ICON_DOC}: faltan los marcadores <!-- icon-set:start --> / <!-- icon-set:end -->`);
    process.exit(1);
  }

  const set = new Map();
  for (const line of doc.slice(start, end).split('\n')) {
    const row = line.match(/^\|\s*(\S+)\s*\|\s*(.+?)\s*\|/u);
    if (!row) continue;
    const emoji = leadingEmoji(row[1]);
    if (!emoji) continue;
    const key = iconKey(emoji);
    if (set.has(key)) {
      console.error(`${ICON_DOC}: icono duplicado en el set: ${emoji}`);
      process.exit(1);
    }
    set.set(key, row[2]);
  }

  if (set.size === 0) {
    console.error(`${ICON_DOC}: el set canónico está vacío`);
    process.exit(1);
  }
  return set;
}
