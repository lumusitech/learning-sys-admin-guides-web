import { visit } from 'unist-util-visit';

/**
 * Elimina el primer H1 del documento.
 * El título ya vive en el frontmatter y lo renderiza el layout,
 * así que mantenerlo en el cuerpo duplica el encabezado.
 */
export function remarkRemoveH1() {
  return (tree) => {
    let removed = false;

    visit(tree, 'heading', (node, index, parent) => {
      if (removed || node.depth !== 1) return;
      removed = true;
      if (parent && typeof index === 'number') {
        parent.children.splice(index, 1);
      }
    });
  };
}
