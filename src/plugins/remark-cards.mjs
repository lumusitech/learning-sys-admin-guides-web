import { visit } from 'unist-util-visit';
import { toHast } from 'mdast-util-to-hast';
import { toHtml } from 'hast-util-to-html';

/**
 * Convierte una tabla markdown marcada con `<!-- cards -->` en un grupo
 * de <details> colapsables.
 *
 * La primera columna es el título del card. La segunda, si es corta, se
 * muestra como subtítulo. El resto de columnas se renderizan como pares
 * clave/valor dentro del cuerpo.
 *
 * El marcador es opt-in: una tabla sin `<!-- cards -->` sigue siendo tabla.
 */

const MARKER = /<!--\s*cards\s*-->/;

/** Longitud máxima del segundo campo para usarlo como subtítulo. */
const SUB_MAX = 42;

/** Serializa el contenido inline de una celda a HTML. */
function inlineHtml(cell) {
  const hast = toHast({ type: 'paragraph', children: cell.children });
  return toHtml(hast);
}

function buildCards(table) {
  const [head, ...rows] = table.children;
  if (!head) return '';

  const headers = head.children.map((cell) => inlineHtml(cell));

  const cards = rows.map((row) => {
    const cells = row.children.map((cell) => inlineHtml(cell));
    const title = cells[0] ?? '';
    const candidate = cells[1] ?? '';
    const useSub = candidate.length > 0 && candidate.length <= SUB_MAX;
    const sub = useSub ? candidate : '';

    const offset = useSub ? 2 : 1;

    const pairs = headers
      .slice(offset)
      .map((label, index) => {
        const value = cells[index + offset] ?? '';
        if (!label || !value) return '';
        return `<dt>${label}</dt><dd>${value}</dd>`;
      })
      .join('');

    const subHtml = sub ? `<span class="card-sub">${sub}</span>` : '';
    const body = pairs ? `<div class="card-body"><dl>${pairs}</dl></div>` : '';

    return `<details><summary><span class="card-title">${title}</span>${subHtml}</summary>${body}</details>`;
  });

  return `<div class="cards">${cards.join('')}</div>`;
}

export function remarkCards() {
  return (tree) => {
    visit(tree, (node) => {
      if (!Array.isArray(node.children)) return;

      for (let index = 0; index < node.children.length; index += 1) {
        const child = node.children[index];
        if (child?.type !== 'table') continue;

        const previous = node.children[index - 1];
        if (previous?.type !== 'html' || !MARKER.test(previous.value)) continue;

        node.children.splice(index - 1, 2, {
          type: 'html',
          value: buildCards(child),
        });
        index -= 1;
      }
    });
  };
}
