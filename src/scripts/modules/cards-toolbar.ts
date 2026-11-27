/**
 * Barra de acciones de las tarjetas (`<details>`).
 *
 * "Expandir todo" y "colapsar todo" actúan solo sobre las tarjetas del
 * documento actual.
 */

import { on, queryAll } from '../../lib/dom';

function setAllCards(open: boolean): void {
  for (const card of queryAll<HTMLDetailsElement>('.cards > details')) {
    card.open = open;
  }
}

export function initCardsToolbar(): void {
  for (const button of queryAll<HTMLButtonElement>('[data-expand-all]')) {
    on(button, 'click', () => setAllCards(true));
  }

  for (const button of queryAll<HTMLButtonElement>('[data-collapse-all]')) {
    on(button, 'click', () => setAllCards(false));
  }
}
