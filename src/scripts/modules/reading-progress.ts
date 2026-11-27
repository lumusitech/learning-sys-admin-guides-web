/**
 * Barra de progreso de lectura.
 *
 * Escala `[data-progress]` según el scroll de la página; pasiva para no
 * penalizar el scroll en móvil.
 */

import { on, query } from '../../lib/dom';

export function initReadingProgress(): void {
  const progressBar = query<HTMLElement>('[data-progress]');
  if (!progressBar) return;

  const update = (): void => {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = scrollable > 0 ? window.scrollY / scrollable : 0;
    progressBar.style.transform = `scaleX(${Math.min(Math.max(ratio, 0), 1)})`;
  };

  on(window, 'scroll', update, { passive: true });
  on(window, 'resize', update, { passive: true });
  update();
}
