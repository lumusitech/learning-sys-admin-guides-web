/**
 * Tipos de la búsqueda difusa.
 *
 * `SearchDocument`/`SearchBlock` se derivan del parser compartido, de modo que
 * cliente y generador del índice no puedan divergir.
 */

import { parseSearchIndex } from '../../lib/search-index.mjs';
import type { FuzzyMatch } from '../../lib/fuzzy';

export type SearchDocument = ReturnType<typeof parseSearchIndex>[number];
export type SearchBlock = SearchDocument['blocks'][number];

/** Resultado global: documento + coincidencia de título y/o bloque. */
export interface Hit {
  doc: SearchDocument;
  score: number;
  titleMatch: FuzzyMatch | null;
  block: SearchBlock | null;
  blockMatch: FuzzyMatch | null;
  headingMatch: FuzzyMatch | null;
}
