import Slugger from 'github-slugger';

/**
 * Genera ids de título limpios.
 *
 * El slugger de Astro convierte el emoji inicial en caracteres sueltos y deja
 * ids como `-qué-es-diff` o `️-opciones-principales` (rompiendo anclas escritas
 * a mano como `#qué-es-diff`).
 *
 * Este plugin corre antes de que Astro asigne los ids y los limpia; Astro
 * respeta el id existente. La factory se invoca una vez por documento, así que
 * el slugger (y su deduplicación) es por página.
 *
 * Plugin de Sätteri (hast).
 */
export function hastCleanHeadingIds() {
  const slugger = new Slugger();

  return {
    name: 'clean-heading-ids',
    element: {
      filter: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
      visit(node, ctx) {
        // Quitamos el selector de variación (U+FE0F): el slugger lo conserva
        // como carácter combinante y ensucia el id.
        const text = ctx.textContent(node).replace(/\uFE0F/g, '');
        const slug = slugger.slug(text).replace(/^[\uFE0F-]+|[\uFE0F-]+$/g, '');
        if (slug) ctx.setProperty(node, 'id', slug);
      },
    },
  };
}
