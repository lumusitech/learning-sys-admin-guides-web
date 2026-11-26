import { visit } from 'unist-util-visit';

/**
 * Convierte fences ```mermaid en un <figure> con <pre class="mermaid">.
 * El render real lo hace mermaid en el cliente (src/scripts/enhance.ts),
 * lo que permite re-renderizar al cambiar de tema.
 */

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function remarkMermaid() {
  return (tree) => {
    visit(tree, 'code', (node) => {
      if (node.lang !== 'mermaid') return;
      node.type = 'html';
      node.value = `<figure class="mermaid-figure"><pre class="mermaid">${escapeHtml(node.value)}</pre></figure>`;
    });
  };
}
