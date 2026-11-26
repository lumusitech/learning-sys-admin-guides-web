/**
 * Coincidencia difusa por subsecuencia, estilo fzf.
 *
 * `lsa` matchea `ls -lha` porque los caracteres aparecen en orden, aunque no
 * sean contiguos. No es tolerancia a errores de tipeo: es subsecuencia.
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
const CONTIGUOUS_BONUS = 12;
const WORD_START_BONUS = 10;
const GAP_PENALTY = 0.8;
const LENGTH_PENALTY = 0.12;
const OFF_BOUNDARY_FACTOR = 0.5;

/** Normaliza un carácter conservando su posición (sin acentos, minúscula). */
function foldChar(char: string): string {
  const stripped = char.normalize('NFD').replace(/\p{M}/gu, '');
  return (stripped || char).toLowerCase();
}

export function fuzzyMatch(query: string, target: string): FuzzyMatch | null {
  const needle = Array.from(query)
    .map(foldChar)
    .join('')
    .replace(/\s+/g, '');

  if (needle.length === 0) return { score: 0, ranges: [] };
  if (target.length === 0) return null;

  let matched = 0;
  let score = 0;
  let previous = -2;
  let first = -1;
  const ranges: Array<[number, number]> = [];

  for (let index = 0; index < target.length && matched < needle.length; index += 1) {
    if (foldChar(target.charAt(index)) !== needle.charAt(matched)) continue;

    if (previous === index - 1) score += CONTIGUOUS_BONUS; // premia rachas contiguas
    else if (previous >= 0) score -= (index - previous - 1) * GAP_PENALTY; // castiga saltos largos
    if (index === 0 || BOUNDARY.test(target.charAt(index - 1))) score += WORD_START_BONUS; // inicio de palabra
    score += 1;

    if (first < 0) first = index;
    previous = index;

    const last = ranges[ranges.length - 1];
    if (last && last[1] === index) last[1] = index + 1;
    else ranges.push([index, index + 1]);

    matched += 1;
  }

  if (matched < needle.length) return null;

  const startsAtBoundary = first === 0 || BOUNDARY.test(target.charAt(first - 1));

  score += Math.max(0, 20 - first) * 0.3; // premia coincidir temprano
  score -= Math.max(0, target.length - needle.length) * LENGTH_PENALTY; // premia blancos cortos
  if (!startsAtBoundary) score *= OFF_BOUNDARY_FACTOR; // premia que el primer match abra palabra
  return { score, ranges };
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
