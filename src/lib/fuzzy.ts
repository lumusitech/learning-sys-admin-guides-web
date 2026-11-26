/**
 * Coincidencia difusa, en dos niveles.
 *
 * 1. **Subcadena contigua**: si la consulta aparece como texto seguido, se
 *    prioriza — y más aún si es una palabra completa. Devuelve un único rango,
 *    así el resaltado abarca la palabra entera (`config` en `Escenario: config
 *    drift`, no letras sueltas).
 * 2. **Subsecuencia** (estilo fzf): si no hay coincidencia contigua, se acepta
 *    que los caracteres aparezcan en orden aunque no sean seguidos (`lsa`
 *    matchea `ls -lth`).
 *
 * Los rangos que devuelve apuntan a índices del texto ORIGINAL (en code units),
 * por lo que se pueden usar para resaltar sin recalcular nada.
 */

export interface FuzzyMatch {
  score: number;
  ranges: Array<[number, number]>;
}

export interface Snippet {
  text: string;
  ranges: Array<[number, number]>;
}

const BOUNDARY = /[\s\-_/.,;:()[\]{}"'`|+]/;
const SUBSTRING_BONUS = 10; // por carácter contiguo
const CONTIGUOUS_BONUS = 12;
const WORD_START_BONUS = 10;
const WHOLE_WORD_BONUS = 8;
const GAP_PENALTY = 0.8;
const LENGTH_PENALTY = 0.12;
const OFF_BOUNDARY_FACTOR = 0.5;

/** Normaliza un carácter conservando su posición (sin acentos, minúscula). */
function foldChar(char: string): string {
  const stripped = char.normalize('NFD').replace(/\p{M}/gu, '');
  return (stripped || char).toLowerCase();
}

/** Versión plegada del texto, con la MISMA longitud en code units. */
function foldText(text: string): string {
  let out = '';
  for (let index = 0; index < text.length; index += 1) out += foldChar(text.charAt(index));
  return out;
}

function isBoundary(text: string, index: number): boolean {
  return index <= 0 || index >= text.length || BOUNDARY.test(text.charAt(index));
}

/** Busca la mejor aparición contigua de `needle`; prioriza palabras completas. */
function findContiguous(folded: string, needle: string, target: string): FuzzyMatch | null {
  if (needle.length === 0) return null;

  let best: FuzzyMatch | null = null;
  let from = 0;

  while (from <= folded.length - needle.length) {
    const at = folded.indexOf(needle, from);
    if (at < 0) break;
    const end = at + needle.length;

    const opensWord = isBoundary(folded, at);
    const closesWord = isBoundary(folded, end);

    let score = needle.length * SUBSTRING_BONUS;
    if (opensWord) score += WORD_START_BONUS;
    if (closesWord) score += WORD_START_BONUS;
    if (opensWord && closesWord) score += WHOLE_WORD_BONUS;
    score -= Math.max(0, target.length - needle.length) * LENGTH_PENALTY;
    score -= at * 0.02; // a igualdad, la aparición más temprana

    if (!best || score > best.score) best = { score, ranges: [[at, end]] };
    from = at + 1;
  }

  return best;
}

/** Reserva: coincidencia por subsecuencia sobre el texto plegado. */
function findSubsequence(needle: string, target: string, folded: string): FuzzyMatch | null {
  let matched = 0;
  let score = 0;
  let previous = -2;
  let first = -1;
  const ranges: Array<[number, number]> = [];

  for (let index = 0; index < folded.length && matched < needle.length; index += 1) {
    if (folded.charAt(index) !== needle.charAt(matched)) continue;

    if (previous === index - 1) score += CONTIGUOUS_BONUS; // premia rachas contiguas
    else if (previous >= 0) score -= (index - previous - 1) * GAP_PENALTY; // castiga saltos largos
    if (isBoundary(folded, index)) score += WORD_START_BONUS; // inicio de palabra
    score += 1;

    if (first < 0) first = index;
    previous = index;

    const last = ranges[ranges.length - 1];
    if (last && last[1] === index) last[1] = index + 1;
    else ranges.push([index, index + 1]);

    matched += 1;
  }

  if (matched < needle.length) return null;

  score += Math.max(0, 20 - first) * 0.3; // premia coincidir temprano
  score -= Math.max(0, target.length - needle.length) * LENGTH_PENALTY; // premia blancos cortos
  if (!isBoundary(folded, first)) score *= OFF_BOUNDARY_FACTOR; // premia que el primer match abra palabra
  return { score, ranges };
}

export function fuzzyMatch(query: string, target: string): FuzzyMatch | null {
  if (target.length === 0) return null;

  const folded = foldText(target);
  const raw = foldText(query).trim();
  const tight = raw.replace(/\s+/g, '');

  if (tight.length === 0) return { score: 0, ranges: [] };

  return (
    findContiguous(folded, raw, target) ??
    findContiguous(folded, tight, target) ??
    findSubsequence(tight, target, folded)
  );
}

/** Arma un fragmento alrededor de la primera coincidencia, con rangos ajustados. */
export function makeSnippet(text: string, ranges: Array<[number, number]>, radius = 42): Snippet {
  if (ranges.length === 0) {
    return { text: text.slice(0, radius * 2), ranges: [] };
  }

  const anchor = ranges[0]?.[0] ?? 0;
  const start = Math.max(0, anchor - radius);
  const end = Math.min(text.length, anchor + radius * 2);
  const prefix = start > 0 ? '… ' : '';
  const suffix = end < text.length ? ' …' : '';

  const shifts = prefix.length;
  const visible = ranges
    .filter(([from, to]) => to > start && from < end)
    .map(([from, to]) => [
      Math.max(from, start) - start + shifts,
      Math.min(to, end) - start + shifts,
    ] as [number, number]);

  return { text: prefix + text.slice(start, end) + suffix, ranges: visible };
}

/** Convierte texto + rangos en un fragmento DOM con las coincidencias en negrita. */
export function highlight(target: string, ranges: Array<[number, number]>): DocumentFragment {
  const fragment = document.createDocumentFragment();
  let cursor = 0;

  for (const [from, to] of ranges) {
    if (from > cursor) fragment.append(target.slice(cursor, from));
    const mark = document.createElement('strong');
    mark.className = 'search-hit';
    mark.textContent = target.slice(from, to);
    fragment.append(mark);
    cursor = to;
  }

  if (cursor < target.length) fragment.append(target.slice(cursor));
  return fragment;
}
