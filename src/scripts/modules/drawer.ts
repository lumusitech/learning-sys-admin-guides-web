/**
 * Drawer de navegación en móvil.
 *
 * Abre/cierra el panel lateral, bloquea el scroll del cuerpo y se cierra al
 * navegar o con Escape.
 */

import { on, query, queryAll } from '../../lib/dom';

export function initDrawer(): void {
  const drawer = query<HTMLElement>('[data-drawer]');
  const drawerToggle = query<HTMLButtonElement>('[data-drawer-toggle]');
  const drawerClose = query<HTMLButtonElement>('[data-drawer-close]');
  if (!drawer || !drawerToggle) return;

  const setOpen = (open: boolean): void => {
    drawer.dataset.open = open ? 'true' : 'false';
    drawerToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    document.body.style.overflow = open ? 'hidden' : '';
  };

  on(drawerToggle, 'click', () => {
    setOpen(drawer.dataset.open !== 'true');
  });

  if (drawerClose) on(drawerClose, 'click', () => setOpen(false));

  for (const link of queryAll<HTMLAnchorElement>('a', drawer)) {
    on(link, 'click', () => setOpen(false));
  }

  on<KeyboardEvent>(document, 'keydown', (event) => {
    if (event.key === 'Escape' && drawer.dataset.open === 'true') setOpen(false);
  });
}
