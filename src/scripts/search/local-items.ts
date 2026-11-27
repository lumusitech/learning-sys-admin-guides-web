/**
 * Índice local construido desde el DOM de la página.
 *
 * Recolecta secciones, comandos, tarjetas y simulaciones con su acción de
 * salto, para que la búsqueda local no dependa de un índice externo.
 */

import { queryAll } from '../../lib/dom';

export interface LocalItem {
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

export function collectLocalItems(): LocalItem[] {
  const items: LocalItem[] = [];

  for (const el of queryAll<HTMLElement>('#contenido h2, #contenido h3')) {
    const label = (el.textContent ?? '').trim();
    if (label) items.push({ el, lines: [label], kind: 'Sección', action: () => focusHeading(el) });
  }

  for (const el of queryAll<HTMLElement>('.prose pre:not(.mermaid)')) {
    const lines = (el.textContent ?? '')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    if (lines.length > 0) {
      items.push({ el, lines, kind: 'Comando', action: () => scrollToElement(el) });
    }
  }

  for (const el of queryAll<HTMLDetailsElement>('.cards > details')) {
    const label = (el.querySelector('summary')?.textContent ?? '').trim();
    if (!label) continue;
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
  }

  for (const el of queryAll<HTMLDetailsElement>('.sim')) {
    const label = (el.querySelector('.sim-label')?.textContent ?? '').trim();
    if (!label) continue;
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
  }

  return items;
}
