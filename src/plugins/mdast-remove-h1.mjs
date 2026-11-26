/**
 * Elimina el primer H1 del documento.
 * El título ya vive en el frontmatter y lo renderiza el layout,
 * así que mantenerlo en el cuerpo duplica el encabezado.
 *
 * Plugin de Sätteri (mdast): la factory se invoca una vez por documento,
 * así que el estado `removed` no se filtra entre archivos.
 */
export function mdastRemoveH1() {
  let removed = false;

  return {
    name: 'remove-first-h1',
    heading(node, ctx) {
      if (removed || node.depth !== 1) return;
      removed = true;
      ctx.removeNode(node);
    },
  };
}