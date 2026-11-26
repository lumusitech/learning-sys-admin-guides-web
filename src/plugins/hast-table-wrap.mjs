/**
 * Envuelve cada tabla en un contenedor con scroll horizontal propio.
 *
 * Solo las tablas deben poder desplazarse lateralmente en móvil; el resto
 * del documento no. El wrapper `.table-wrap` aporta `overflow-x: auto`.
 *
 * Plugin de Sätteri (hast): corre después de la conversión Markdown → HTML.
 */
export function hastTableWrap() {
  return {
    name: 'table-wrap',
    element: {
      filter: ['table'],
      visit(node, ctx) {
        ctx.wrapNode(node, {
          type: 'element',
          tagName: 'div',
          properties: { className: ['table-wrap'] },
          children: [],
        });
      },
    },
  };
}