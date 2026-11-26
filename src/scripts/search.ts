import { fuzzyMatch, highlight, makeSnippet, type FuzzyMatch } from '../lib/fuzzy';

/**
 * Búsqueda difusa.
 *
 * - Global: índice JSON generado en build (`public/search-index.json`), con
 *   título y bloques por sección. Resultados en el diálogo, con la coincidencia
 *   en negrita y un fragmento de contexto.
 * - Local: índice construido desde el DOM de la página (secciones, comandos,
 *   tarjetas y simulaciones). Resultados en un desplegable bajo el input.
 */

interface Block {
  heading: string;
  text: string;
  code?: boolean;
}

interface Doc {
  id: string;
  title: string;
  url: string;
  section: string;
  blocks: Block[];
}

interface Hit {
  doc: Doc;
  score: number;
  titleMatch: FuzzyMatch | null;
  block: Block | null;
  blockMatch: FuzzyMatch | null;
  headingMatch: FuzzyMatch | null;
}

const GLOBAL_LIMIT = 20;
const LOCAL_LIMIT = 8;

function basePath(): string {
  const raw = import.meta.env.BASE_URL ?? '/';
  return raw.endsWith('/') ? raw : `${raw}/`;
}

function isDoc(value: unknown): value is Doc {
  if (typeof value !== 'object' || value === null) return false;
  const doc = value as Record<string, unknown>;
  return (
    typeof doc.title === 'string' &&
    typeof doc.url === 'string' &&
    typeof doc.section === 'string' &&
    Array.isArray(doc.blocks)
  );
}

function parseIndex(data: unknown): Doc[] {
  if (typeof data !== 'object' || data === null) return [];
  const documents = (data as { documents?: unknown }).documents;
  if (!Array.isArray(documents)) return [];
  return documents.filter(isDoc);
}

/* ------------------------------------------------------------------ */
/* Global                                                              */
/* ------------------------------------------------------------------ */

export function initGlobalSearch(): void {
  const dialog = document.querySelector<HTMLDialogElement>('[data-search-dialog]');
  const input = document.querySelector<HTMLInputElement>('[data-search-input]');
  const results = document.querySelector<HTMLElement>('[data-search-results]');
  if (!dialog || !input || !results) return;

  let docs: Doc[] | null = null;

  const ensureDocs = async (): Promise<Doc[]> => {
    if (docs) return docs;
    try {
      const response = await fetch(`${basePath()}search-index.json`);
      docs = response.ok ? parseIndex(await response.json()) : [];
    } catch {
      docs = [];
    }
    return docs;
  };

  const search = (query: string): Hit[] => {
    const hits: Hit[] = [];
    for (const doc of docs ?? []) {
      const titleMatch = fuzzyMatch(query, doc.title);
      let best: Hit = {
        doc,
        score: titleMatch ? titleMatch.score * 3 + 40 : 0,
        titleMatch,
        block: null,
        blockMatch: null,
        headingMatch: null,
      };

      for (const block of doc.blocks) {
        const textMatch = fuzzyMatch(query, block.text);
        const headingMatch = block.heading ? fuzzyMatch(query, block.heading) : null;
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
  };

  const renderHit = (hit: Hit): HTMLElement => {
    const link = document.createElement('a');
    link.className = 'search-result';
    link.href = hit.doc.url;

    const head = document.createElement('span');
    head.className = 'search-result-head';

    const title = document.createElement('span');
    title.className = 'search-result-title';
    title.append(highlight(hit.doc.title, hit.titleMatch?.ranges ?? []));

    const badge = document.createElement('span');
    badge.className = 'search-result-section';
    badge.textContent = hit.doc.section;

    head.append(title, badge);
    link.append(head);

    if (hit.block && (hit.blockMatch || hit.headingMatch)) {
      const excerpt = document.createElement('span');
      excerpt.className = 'search-result-excerpt';

      if (hit.block.heading) {
        const heading = document.createElement('span');
        heading.className = 'search-result-heading';
        heading.append(highlight(hit.block.heading, hit.headingMatch?.ranges ?? []));
        excerpt.append(heading);
      }

      if (hit.blockMatch) {
        const snippet = makeSnippet(hit.block.text, hit.blockMatch.ranges);
        excerpt.append(highlight(snippet.text, snippet.ranges));
      }

      link.append(excerpt);
    }

    return link;
  };

  const message = (text: string): HTMLElement => {
    const paragraph = document.createElement('p');
    paragraph.className = 'search-empty';
    paragraph.textContent = text;
    return paragraph;
  };

  let activeIndex = -1;

  const links = (): HTMLAnchorElement[] => [...results.querySelectorAll<HTMLAnchorElement>('a.search-result')];

  const setActive = (index: number): void => {
    const items = links();
    if (items.length === 0) return;
    activeIndex = (index + items.length) % items.length;
    items.forEach((item, position) => {
      item.dataset.active = position === activeIndex ? 'true' : 'false';
    });
    items[activeIndex]?.scrollIntoView({ block: 'nearest' });
  };

  const render = (query: string): void => {
    const needle = query.trim();
    results.replaceChildren();
    activeIndex = -1;

    if (needle.length === 0) {
      results.append(message('Escribí para buscar en todas las guías.'));
      return;
    }

    const hits = search(needle);
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

  document.querySelectorAll<HTMLButtonElement>('[data-search-open]').forEach((button) => {
    button.addEventListener('click', () => {
      void open();
    });
  });

  document.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      void open();
    }
  });

  input.addEventListener('input', () => {
    void ensureDocs().then(() => render(input.value));
  });

  input.addEventListener('keydown', (event) => {
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

  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
}

/* ------------------------------------------------------------------ */
/* Local                                                               */
/* ------------------------------------------------------------------ */

interface LocalItem {
  el: HTMLElement;
  lines: string[];
  kind: string;
  action: () => void;
}

function scrollToElement(el: HTMLElement): void {
  el.scrollIntoView({ block: 'start', behavior: 'smooth' });
}

function focusHeading(el: HTMLElement): void {
  if (el.id) {
    window.location.hash = `#${el.id}`;
    return;
  }
  scrollToElement(el);
}

function collectLocalItems(): LocalItem[] {
  const items: LocalItem[] = [];

  document.querySelectorAll<HTMLElement>('#contenido h2, #contenido h3').forEach((el) => {
    const label = (el.textContent ?? '').trim();
    if (label) items.push({ el, lines: [label], kind: 'Sección', action: () => focusHeading(el) });
  });

  document.querySelectorAll<HTMLElement>('.prose pre:not(.mermaid)').forEach((el) => {
    const lines = (el.textContent ?? '')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    if (lines.length > 0) items.push({ el, lines, kind: 'Comando', action: () => scrollToElement(el) });
  });

  document.querySelectorAll<HTMLDetailsElement>('.cards > details').forEach((el) => {
    const label = (el.querySelector('summary')?.textContent ?? '').trim();
    if (!label) return;
    const body = (el.textContent ?? '')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && line !== label);
    items.push({
      el,
      lines: [label, ...body],
      kind: 'Tarjeta',
      action: () => {
        el.open = true;
        scrollToElement(el);
      },
    });
  });

  document.querySelectorAll<HTMLDetailsElement>('.sim').forEach((el) => {
    const label = (el.querySelector('.sim-label')?.textContent ?? '').trim();
    if (!label) return;
    const body = (el.textContent ?? '')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && line !== label);
    items.push({
      el,
      lines: [label, ...body],
      kind: 'Simulación',
      action: () => {
        el.open = true;
        scrollToElement(el);
      },
    });
  });

  return items;
}

export function initLocalSearch(): void {
  const input = document.querySelector<HTMLInputElement>('[data-local-filter]');
  const panel = document.querySelector<HTMLElement>('[data-local-results]');
  if (!input || !panel) return;

  const items = collectLocalItems();
  if (items.length === 0) return;

  let activeIndex = -1;

  const buttons = (): HTMLButtonElement[] => [...panel.querySelectorAll<HTMLButtonElement>('button.local-result')];

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

  interface Scored {
    item: LocalItem;
    line: string;
    match: FuzzyMatch;
    score: number;
  }

  const render = (query: string): void => {
    const needle = query.trim();
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
      button.addEventListener('click', () => {
        hide();
        hit.item.action();
      });
      panel.append(button);
    }

    panel.hidden = false;
    setActive(0);
  };

  input.addEventListener('input', () => render(input.value));

  input.addEventListener('keydown', (event) => {
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

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (panel.contains(target) || target === input) return;
    hide();
  });
}
