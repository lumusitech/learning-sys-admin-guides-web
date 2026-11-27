import { toHast } from 'mdast-util-to-hast';
import { toHtml } from 'hast-util-to-html';

/**
 * Convierte una directiva `:::callout{state=warning|tip|danger}` en un bloque
 * destacado con título y cuerpo markdown.
 *
 * Reemplaza los blockquotes ad-hoc (`> ⚠️ ...`) por un patrón único y
 * reutilizable. Atributos opcionales:
 * - `state`: `warning` (por defecto), `tip` o `danger`.
 * - `label`: texto del título. Por defecto "Atención", "Tip" o "Peligro".
 *
 * Plugin de Sätteri (mdast): requiere `features: { directive: true }`.
 */

const DEFAULT_LABELS = {
  warning: 'Atención',
  tip: 'Tip',
  danger: 'Peligro',
};

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildCallout(state, label, children) {
  const hast = toHast({ type: 'root', children });
  const body = toHtml(hast);

  return (
    `<div class="callout" data-state="${state}">` +
    `<p class="callout-title">${escapeHtml(label)}</p>` +
    `<div class="callout-body">${body}</div>` +
    `</div>`
  );
}

export function mdastCallout() {
  return {
    name: 'callout',
    containerDirective(node) {
      if (node.name !== 'callout') return;

      const children = node.children ?? [];
      if (children.length === 0) return;

      const rawState = node.attributes?.state;
      const state = rawState === 'tip' || rawState === 'danger' ? rawState : 'warning';
      const label = node.attributes?.label || DEFAULT_LABELS[state];

      return { type: 'html', value: buildCallout(state, label, children) };
    },
  };
}
