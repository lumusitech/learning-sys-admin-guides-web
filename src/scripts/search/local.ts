/**
 * Búsqueda local (desplegable bajo el input de la página).
 *
 * Puntúa las líneas del índice local con el matcher difuso, deduplica y
 * renderiza botones que saltan a la sección, comando, tarjeta o simulación.
 */

import { on, query, queryAll } from '../../lib/dom';
import { fuzzyMatch, highlight, makeSnippet, type FuzzyMatch } from '../../lib/fuzzy';
import { collectLocalItems, type LocalItem } from './local-items';

const LOCAL_LIMIT = 8;

interface Scored {
  item: LocalItem;
  line: string;
  match: FuzzyMatch;
  score: number;
}

export function initLocalSearch(): void {
  const input = query<HTMLInputElement>('[data-local-filter]');
  const panel = query<HTMLElement>('[data-local-results]');
  if (!input || !panel) return;

  const items = collectLocalItems();
  if (items.length === 0) return;

  let activeIndex = -1;

  const buttons = (): HTMLButtonElement[] =>
    queryAll<HTMLButtonElement>('button.local-result', panel);

  const hide = (): void => {
    panel.hidden = true;
    panel.replaceChildren();
    activeIndex = -1;
  };

  const setActive = (index: number): void => {
    const list = buttons();
    if (list.length === 0) return;
    activeIndex = (index + list.length) % list.length;
    list.forEach((button, position) => {
      button.dataset.active = position === activeIndex ? 'true' : 'false';
    });
    list[activeIndex]?.scrollIntoView({ block: 'nearest' });
  };

  const render = (value: string): void => {
    const needle = value.trim();
    if (needle.length === 0) {
      hide();
      return;
    }

    const scored: Scored[] = [];
    const seen = new Set<string>();
    for (const item of items) {
      let bestLine = '';
      let bestMatch: FuzzyMatch | null = null;
      let bestScore = Number.NEGATIVE_INFINITY;

      for (const line of item.lines) {
        const match = fuzzyMatch(needle, line);
        if (!match) continue;
        const score = match.score - line.length * 0.05;
        if (score > bestScore) {
          bestScore = score;
          bestLine = line;
          bestMatch = match;
        }
      }

      if (!bestMatch) continue;
      const dedupeKey = bestLine.toLowerCase();
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      const kindBonus = item.kind === 'Comando' ? 25 : 0;
      scored.push({ item, line: bestLine, match: bestMatch, score: bestScore + kindBonus });
    }
    scored.sort((a, b) => b.score - a.score);

    panel.replaceChildren();
    activeIndex = -1;

    if (scored.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'local-result-empty';
      empty.textContent = 'Sin coincidencias en esta página.';
      panel.append(empty);
      panel.hidden = false;
      return;
    }

    for (const hit of scored.slice(0, LOCAL_LIMIT)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'local-result';

      const label = document.createElement('span');
      label.className = 'local-result-label';
      const snippet = makeSnippet(hit.line, hit.match.ranges, 34);
      label.append(highlight(snippet.text, snippet.ranges));

      const kind = document.createElement('span');
      kind.className = 'local-result-kind';
      kind.textContent = hit.item.kind;

      button.append(label, kind);
      on(button, 'click', () => {
        hide();
        hit.item.action();
      });
      panel.append(button);
    }

    panel.hidden = false;
    setActive(0);
  };

  on(input, 'input', () => render(input.value));

  on<KeyboardEvent>(input, 'keydown', (event) => {
    const list = buttons();
    if (event.key === 'Escape') {
      hide();
      return;
    }
    if (list.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive(activeIndex + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive(activeIndex - 1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      (list[activeIndex] ?? list[0])?.click();
    }
  });

  on(document, 'click', (event) => {
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (panel.contains(target) || target === input) return;
    hide();
  });
}
