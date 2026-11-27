/**
 * Diagramas Mermaid.
 *
 * Mermaid se importa dinámicamente: solo se descarga en páginas con diagramas.
 * Se re-renderiza al cambiar de tema porque el tema de Mermaid es estático.
 */

import { on, query, queryAll } from '../../lib/dom';
import { currentTheme } from './theme';

async function renderMermaid(): Promise<void> {
  const nodes = queryAll<HTMLElement>('pre.mermaid');
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

export function initMermaid(): void {
  on(document, 'theme-change', () => {
    void renderMermaid();
  });

  if (query('pre.mermaid')) {
    void renderMermaid();
  }
}
