import { toHast } from 'mdast-util-to-hast';
import { toHtml } from 'hast-util-to-html';

/**
 * Convierte una directiva `:::sim{state=success|error}` en un desplegable
 * con un botón play y una salida de terminal simulada.
 *
 * Dentro del bloque:
 * - uno o más fences de código son la salida del comando;
 * - el resto del markdown (párrafos, listas, blockquotes) es el análisis,
 *   que se renderiza debajo de la salida.
 *
 * Atributos opcionales:
 * - `state`: `success` (verde, por defecto) o `error` (rojo).
 * - `label`: texto del botón. Por defecto "Simular salida"/"Simular error".
 *
 * Plugin de Sätteri (mdast): requiere `features: { directive: true }`.
 */

const DEFAULT_LABELS = {
  success: 'Simular salida',
  error: 'Simular error',
};

const PLAY_ICON =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.14v13.72L19 12z"/></svg>';

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildSim(state, label, outputs, analysis) {
  const outputHtml = outputs
    .map((code) => `<pre class="sim-output"><code>${escapeHtml(code.value)}</code></pre>`)
    .join('');

  let analysisHtml = '';
  if (analysis.length > 0) {
    const hast = toHast({ type: 'root', children: analysis });
    analysisHtml = `<div class="sim-analysis">${toHtml(hast)}</div>`;
  }

  return (
    `<details class="sim" data-state="${state}">` +
    `<summary class="sim-toggle">` +
    `<span class="sim-icon">${PLAY_ICON}</span>` +
    `<span class="sim-label">${escapeHtml(label)}</span>` +
    `</summary>` +
    `<div class="sim-body">${outputHtml}${analysisHtml}</div>` +
    `</details>`
  );
}

export function mdastSim() {
  return {
    name: 'sim',
    containerDirective(node) {
      if (node.name !== 'sim') return;

      const outputs = (node.children ?? []).filter((child) => child.type === 'code');
      const analysis = (node.children ?? []).filter((child) => child.type !== 'code');
      if (outputs.length === 0) return;

      const state = node.attributes?.state === 'error' ? 'error' : 'success';
      const label = node.attributes?.label || DEFAULT_LABELS[state];

      return { type: 'html', value: buildSim(state, label, outputs, analysis) };
    },
  };
}