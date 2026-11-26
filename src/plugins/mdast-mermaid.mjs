/**
 * Convierte fences ```mermaid en un <figure> con <pre class="mermaid">.
 * El render real lo hace mermaid en el cliente (src/scripts/enhance.ts),
 * lo que permite re-renderizar al cambiar de tema.
 *
 * Plugin de Sätteri (mdast): devolver un nodo desde el visitor lo reemplaza.
 */

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function mdastMermaid() {
  return {
    name: 'mermaid',
    code(node) {
      if (node.lang !== 'mermaid') return;
      return {
        type: 'html',
        value: `<figure class="mermaid-figure"><pre class="mermaid">${escapeHtml(node.value)}</pre></figure>`,
      };
    },
  };
}