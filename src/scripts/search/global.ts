/**
 * Búsqueda global (diálogo).
 *
 * Carga el índice JSON generado en build (`public/search-index.json`), puntúa
 * documentos y bloques con el matcher difuso y delega el render en
 * `global-view`.
 */

import { base } from '../../lib/base';
import { on, query, queryAll } from '../../lib/dom';
import { fuzzyMatch } from '../../lib/fuzzy';
import { parseSearchIndex } from '../../lib/search-index.mjs';
import { message, renderHit } from './global-view';
import type { Hit, SearchDocument } from './types';

const GLOBAL_LIMIT = 20;

function searchDocuments(docs: SearchDocument[], needle: string): Hit[] {
  const hits: Hit[] = [];

  for (const doc of docs) {
    const titleMatch = fuzzyMatch(needle, doc.title);
    let best: Hit = {
      doc,
      score: titleMatch ? titleMatch.score * 3 + 40 : 0,
      titleMatch,
      block: null,
      blockMatch: null,
      headingMatch: null,
    };

    for (const block of doc.blocks) {
      const textMatch = fuzzyMatch(needle, block.text);
      const headingMatch = block.heading ? fuzzyMatch(needle, block.heading) : null;
      if (!textMatch && !headingMatch) continue;

      let score = textMatch?.score ?? 0;
      if (headingMatch) score += headingMatch.score * 0.8 + 8;
      if (block.code) score += 25; // los comandos son objetivos de alto valor

      if (score > best.score) {
        best = { doc, score, titleMatch, block, blockMatch: textMatch, headingMatch };
      }
    }

    if (titleMatch || best.blockMatch) hits.push(best);
  }

  return hits.sort((a, b) => b.score - a.score).slice(0, GLOBAL_LIMIT);
}

export function initGlobalSearch(): void {
  const dialog = query<HTMLDialogElement>('[data-search-dialog]');
  const input = query<HTMLInputElement>('[data-search-input]');
  const results = query<HTMLElement>('[data-search-results]');
  if (!dialog || !input || !results) return;

  let docs: SearchDocument[] | null = null;

  const ensureDocs = async (): Promise<SearchDocument[]> => {
    if (docs) return docs;
    try {
      const response = await fetch(`${base}search-index.json`);
      docs = response.ok ? parseSearchIndex(await response.json()) : [];
    } catch {
      docs = [];
    }
    return docs;
  };

  let activeIndex = -1;

  const links = (): HTMLAnchorElement[] =>
    queryAll<HTMLAnchorElement>('a.search-result', results);

  const setActive = (index: number): void => {
    const items = links();
    if (items.length === 0) return;
    activeIndex = (index + items.length) % items.length;
    items.forEach((item, position) => {
      item.dataset.active = position === activeIndex ? 'true' : 'false';
    });
    items[activeIndex]?.scrollIntoView({ block: 'nearest' });
  };

  const render = (value: string): void => {
    const needle = value.trim();
    results.replaceChildren();
    activeIndex = -1;

    if (needle.length === 0) {
      results.append(message('Escribe para buscar en todas las guías.'));
      return;
    }

    const hits = searchDocuments(docs ?? [], needle);
    if (hits.length === 0) {
      results.append(message('Sin resultados.'));
      return;
    }

    for (const hit of hits) results.append(renderHit(hit));
    setActive(0);
  };

  const open = async (): Promise<void> => {
    if (!dialog.open) dialog.showModal();
    input.focus();
    results.replaceChildren(message('Cargando índice…'));
    await ensureDocs();
    render(input.value);
  };

  for (const button of queryAll<HTMLButtonElement>('[data-search-open]')) {
    on(button, 'click', () => {
      void open();
    });
  }

  on<KeyboardEvent>(document, 'keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      void open();
    }
  });

  on(input, 'input', () => {
    void ensureDocs().then(() => render(input.value));
  });

  on<KeyboardEvent>(input, 'keydown', (event) => {
    const items = links();
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive(activeIndex + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive(activeIndex - 1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      (items[activeIndex] ?? items[0])?.click();
    } else if (event.key === 'Escape') {
      dialog.close();
    }
  });

  on(dialog, 'click', (event) => {
    if (event.target === dialog) dialog.close();
  });
}
