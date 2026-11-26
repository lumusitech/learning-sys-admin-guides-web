/**
 * Mejoras de cliente: tema, copiar código, progreso de lectura,
 * mermaid, filtro local de cards, expandir/colapsar, buscador y drawer.
 * Todo es progressive enhancement: sin JS el contenido sigue siendo legible.
 */

const root = document.documentElement;

/* ------------------------------------------------------------------ */
/* Tema                                                                */
/* ------------------------------------------------------------------ */

type Theme = 'light' | 'dark';

function currentTheme(): Theme {
  return root.dataset.theme === 'light' ? 'light' : 'dark';
}

function setTheme(theme: Theme): void {
  root.dataset.theme = theme;
  try {
    localStorage.setItem('theme', theme);
  } catch {
    /* almacenamiento no disponible */
  }
  document.dispatchEvent(new CustomEvent<Theme>('theme-change', { detail: theme }));
}

document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]').forEach((button) => {
  button.addEventListener('click', () => {
    setTheme(currentTheme() === 'dark' ? 'light' : 'dark');
  });
});

/* ------------------------------------------------------------------ */
/* Copiar bloques de código                                            */
/* ------------------------------------------------------------------ */

function stripPrompts(text: string): string {
  return text
    .split('\n')
    .map((line) => line.replace(/^\s*\$\s+/, ''))
    .join('\n');
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  }
}

document.querySelectorAll<HTMLPreElement>('.prose pre:not(.mermaid)').forEach((pre) => {
  if (pre.closest('.code-wrap')) return;

  const wrap = document.createElement('div');
  wrap.className = 'code-wrap';
  pre.parentNode?.insertBefore(wrap, pre);
  wrap.appendChild(pre);

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'copy-btn';
  button.textContent = 'Copiar';
  button.setAttribute('aria-label', 'Copiar el bloque de código');

  button.addEventListener('click', () => {
    const code = stripPrompts(pre.textContent ?? '');
    void copyText(code).then((ok) => {
      if (!ok) return;
      button.dataset.copied = 'true';
      button.textContent = 'Copiado';
      window.setTimeout(() => {
        button.dataset.copied = 'false';
        button.textContent = 'Copiar';
      }, 1600);
    });
  });

  wrap.appendChild(button);
});

/* ------------------------------------------------------------------ */
/* Progreso de lectura                                                 */
/* ------------------------------------------------------------------ */

const progressBar = document.querySelector<HTMLElement>('[data-progress]');

if (progressBar) {
  const update = (): void => {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = scrollable > 0 ? window.scrollY / scrollable : 0;
    progressBar.style.transform = `scaleX(${Math.min(Math.max(ratio, 0), 1)})`;
  };

  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update, { passive: true });
  update();
}

/* ------------------------------------------------------------------ */
/* Mermaid                                                             */
/* ------------------------------------------------------------------ */

async function renderMermaid(): Promise<void> {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>('pre.mermaid'));
  if (nodes.length === 0) return;

  const { default: mermaid } = await import('mermaid');
  const theme = currentTheme() === 'dark' ? 'dark' : 'default';
  // Mermaid mide el ancho de las etiquetas con la fuente configurada y luego
  // las dibuja con ella. Si no coinciden (p. ej. `inherit` dentro de un <pre>
  // monospace), los textos quedan recortados dentro de las cajas.
  const fontFamily = getComputedStyle(document.body).fontFamily;

  mermaid.initialize({
    startOnLoad: false,
    theme,
    securityLevel: 'strict',
    fontFamily,
  });

  for (const [index, node] of nodes.entries()) {
    const source = node.dataset.source ?? node.textContent ?? '';
    node.dataset.source = source;
    try {
      const { svg } = await mermaid.render(`mmd-${index}-${Date.now()}`, source);
      node.innerHTML = svg;
    } catch (error) {
      console.warn('Mermaid no pudo renderizar el diagrama:', error);
    }
  }
}

document.addEventListener('theme-change', () => {
  void renderMermaid();
});

if (document.querySelector('pre.mermaid')) {
  void renderMermaid();
}

/* ------------------------------------------------------------------ */
/* Filtro local de cards                                               */
/* ------------------------------------------------------------------ */

const filterInput = document.querySelector<HTMLInputElement>('[data-local-filter]');

if (filterInput) {
  const cards = Array.from(document.querySelectorAll<HTMLDetailsElement>('.cards > details'));
  const empty = document.querySelector<HTMLElement>('[data-filter-empty]');
  const counter = document.querySelector<HTMLElement>('[data-filter-count]');

  const apply = (): void => {
    const query = filterInput.value.trim().toLowerCase();
    let visible = 0;

    for (const card of cards) {
      const text = (card.querySelector('summary')?.textContent ?? '').toLowerCase();
      const match = query === '' || text.includes(query);
      card.hidden = !match;
      if (match) visible += 1;
    }

    if (empty) empty.hidden = visible > 0;
    if (counter) counter.textContent = String(visible);
  };

  filterInput.addEventListener('input', apply);
  apply();
}

/* ------------------------------------------------------------------ */
/* Expandir / colapsar                                                 */
/* ------------------------------------------------------------------ */

document.querySelectorAll<HTMLButtonElement>('[data-expand-all]').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll<HTMLDetailsElement>('.cards > details').forEach((card) => {
      card.open = true;
    });
  });
});

document.querySelectorAll<HTMLButtonElement>('[data-collapse-all]').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll<HTMLDetailsElement>('.cards > details').forEach((card) => {
      card.open = false;
    });
  });
});

/* ------------------------------------------------------------------ */
/* Buscador global (UI, sin fuzzy todavía)                             */
/* ------------------------------------------------------------------ */

interface SearchItem {
  title: string;
  href: string;
  section: string;
}

const dialog = document.querySelector<HTMLDialogElement>('[data-search-dialog]');
const searchInput = document.querySelector<HTMLInputElement>('[data-search-input]');
const searchResults = document.querySelector<HTMLElement>('[data-search-results]');
const searchIndex = document.querySelector<HTMLScriptElement>('[data-search-index]');

let items: SearchItem[] = [];

if (searchIndex?.textContent) {
  try {
    const parsed: unknown = JSON.parse(searchIndex.textContent);
    if (Array.isArray(parsed)) items = parsed as SearchItem[];
  } catch {
    items = [];
  }
}

function renderResults(query: string): void {
  if (!searchResults) return;

  const needle = query.trim().toLowerCase();
  const matches = needle === ''
    ? items.slice(0, 8)
    : items.filter((item) => item.title.toLowerCase().includes(needle)).slice(0, 20);

  searchResults.replaceChildren();

  if (matches.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'px-3 py-6 text-center text-sm';
    empty.textContent = 'Sin resultados.';
    searchResults.appendChild(empty);
    return;
  }

  for (const item of matches) {
    const link = document.createElement('a');
    link.href = item.href;
    link.className = 'search-result';
    link.textContent = item.title;
    const badge = document.createElement('span');
    badge.className = 'search-result-section';
    badge.textContent = item.section;
    link.appendChild(badge);
    searchResults.appendChild(link);
  }
}

if (dialog && searchInput) {
  const open = (): void => {
    if (!dialog.open) dialog.showModal();
    searchInput.focus();
    renderResults(searchInput.value);
  };

  document.querySelectorAll<HTMLButtonElement>('[data-search-open]').forEach((button) => {
    button.addEventListener('click', open);
  });

  document.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      open();
    }
  });

  searchInput.addEventListener('input', () => renderResults(searchInput.value));

  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
}

/* ------------------------------------------------------------------ */
/* Drawer mobile                                                       */
/* ------------------------------------------------------------------ */

const drawer = document.querySelector<HTMLElement>('[data-drawer]');
const drawerToggle = document.querySelector<HTMLButtonElement>('[data-drawer-toggle]');
const drawerClose = document.querySelector<HTMLButtonElement>('[data-drawer-close]');

if (drawer && drawerToggle) {
  const setOpen = (open: boolean): void => {
    drawer.dataset.open = open ? 'true' : 'false';
    drawerToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    document.body.style.overflow = open ? 'hidden' : '';
  };

  drawerToggle.addEventListener('click', () => {
    setOpen(drawer.dataset.open !== 'true');
  });

  drawerClose?.addEventListener('click', () => setOpen(false));

  drawer.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => setOpen(false));
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && drawer.dataset.open === 'true') setOpen(false);
  });
}

/* ------------------------------------------------------------------ */
/* TOC activo                                                          */
/* ------------------------------------------------------------------ */

const tocLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>('[data-toc] a[href^="#"]'));

if (tocLinks.length > 0) {
  const byId = new Map<string, HTMLAnchorElement>();
  for (const link of tocLinks) {
    const id = decodeURIComponent(link.hash.slice(1));
    if (id) byId.set(id, link);
  }

  const headings = Array.from(byId.keys())
    .map((id) => document.getElementById(id))
    .filter((element): element is HTMLElement => element !== null);

  const setActive = (id: string): void => {
    for (const [key, link] of byId) {
      link.dataset.active = key === id ? 'true' : 'false';
    }
  };

  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      const first = visible[0];
      if (first) setActive(first.target.id);
    },
    { rootMargin: '-15% 0px -70% 0px', threshold: 0 },
  );

  for (const heading of headings) observer.observe(heading);
}
