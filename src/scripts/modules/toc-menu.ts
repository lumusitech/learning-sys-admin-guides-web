/**
 * Menú del índice de la página en la topbar.
 *
 * Abre/cierra el panel, lo cierra al elegir una sección, al hacer clic fuera y
 * con Escape (devolviendo el foco al botón).
 */

import { on, query, queryAll } from '../../lib/dom';

export function initTocMenu(): void {
  const tocMenu = query<HTMLElement>('[data-toc-menu]');
  const tocMenuToggle = query<HTMLButtonElement>('[data-toc-menu-toggle]');
  const tocMenuPanel = query<HTMLElement>('[data-toc-menu-panel]');
  if (!tocMenu || !tocMenuToggle || !tocMenuPanel) return;

  const setMenuOpen = (open: boolean): void => {
    tocMenuPanel.hidden = !open;
    tocMenuToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  };

  on(tocMenuToggle, 'click', () => setMenuOpen(tocMenuPanel.hidden));

  for (const link of queryAll<HTMLAnchorElement>('a', tocMenuPanel)) {
    on(link, 'click', () => setMenuOpen(false));
  }

  on(document, 'click', (event) => {
    if (tocMenuPanel.hidden) return;
    const target = event.target;
    if (target instanceof Node && !tocMenu.contains(target)) setMenuOpen(false);
  });

  on<KeyboardEvent>(document, 'keydown', (event) => {
    if (event.key === 'Escape' && !tocMenuPanel.hidden) {
      setMenuOpen(false);
      tocMenuToggle.focus();
    }
  });
}
