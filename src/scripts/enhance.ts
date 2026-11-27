import { initGlobalSearch, initLocalSearch } from './search';

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
/* Acciones de los bloques de código                                   */
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

const ICON_COPY =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';

const ICON_CHECK =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

function actionButton(label: string, icon: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'code-action';
  button.setAttribute('aria-label', label);
  button.title = label;
  button.innerHTML = icon;
  return button;
}

/**
 * Envuelve cada bloque de código en `.code-wrap` con una barra de acciones
 * encima. Hoy la barra solo tiene "copiar"; agregar otra acción es sumar un
 * botón a `actions` (p. ej. ajuste de líneas o descarga).
 */
document.querySelectorAll<HTMLPreElement>('.prose pre:not(.mermaid)').forEach((pre) => {
  if (pre.closest('.code-wrap')) return;

  const wrap = document.createElement('div');
  wrap.className = 'code-wrap';

  const toolbar = document.createElement('div');
  toolbar.className = 'code-toolbar';

  const actions = document.createElement('div');
  actions.className = 'code-actions';

  const copyButton = actionButton('Copiar el bloque de código', ICON_COPY);
  copyButton.dataset.action = 'copy';
  copyButton.addEventListener('click', () => {
    const code = stripPrompts(pre.textContent ?? '');
    void copyText(code).then((ok) => {
      if (!ok) return;
      copyButton.dataset.copied = 'true';
      copyButton.innerHTML = ICON_CHECK;
      copyButton.setAttribute('aria-label', 'Copiado');
      window.setTimeout(() => {
        copyButton.dataset.copied = 'false';
        copyButton.innerHTML = ICON_COPY;
        copyButton.setAttribute('aria-label', 'Copiar el bloque de código');
      }, 1600);
    });
  });
  actions.appendChild(copyButton);

  toolbar.appendChild(actions);
  pre.parentNode?.insertBefore(wrap, pre);
  wrap.appendChild(toolbar);
  wrap.appendChild(pre);
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
/* Índice de la página (topbar)                                        */
/* ------------------------------------------------------------------ */

const tocMenu = document.querySelector<HTMLElement>('[data-toc-menu]');
const tocMenuToggle = document.querySelector<HTMLButtonElement>('[data-toc-menu-toggle]');
const tocMenuPanel = document.querySelector<HTMLElement>('[data-toc-menu-panel]');

if (tocMenu && tocMenuToggle && tocMenuPanel) {
  const setMenuOpen = (open: boolean): void => {
    tocMenuPanel.hidden = !open;
    tocMenuToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  };

  tocMenuToggle.addEventListener('click', () => setMenuOpen(tocMenuPanel.hidden));

  tocMenuPanel.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => setMenuOpen(false));
  });

  document.addEventListener('click', (event) => {
    if (tocMenuPanel.hidden) return;
    const target = event.target;
    if (target instanceof Node && !tocMenu.contains(target)) setMenuOpen(false);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !tocMenuPanel.hidden) {
      setMenuOpen(false);
      tocMenuToggle.focus();
    }
  });
}

/* ------------------------------------------------------------------ */
/* TOC activo                                                          */
/* ------------------------------------------------------------------ */

const tocLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>('[data-toc] a[href^="#"]'));

if (tocLinks.length > 0) {
  const byId = new Map<string, HTMLAnchorElement[]>();
  for (const link of tocLinks) {
    const id = decodeURIComponent(link.hash.slice(1));
    if (!id) continue;
    const links = byId.get(id);
    if (links) links.push(link);
    else byId.set(id, [link]);
  }

  const headings = Array.from(byId.keys())
    .map((id) => document.getElementById(id))
    .filter((element): element is HTMLElement => element !== null);

  const setActive = (id: string): void => {
    for (const [key, links] of byId) {
      for (const link of links) {
        link.dataset.active = key === id ? 'true' : 'false';
      }
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

/* ------------------------------------------------------------------ */
/* Búsqueda (global + local)                                           */
/* ------------------------------------------------------------------ */

initGlobalSearch();
initLocalSearch();
