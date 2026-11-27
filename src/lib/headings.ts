/**
 * Encabezado extraído por Astro en `render(entry).headings`.
 *
 * Lo comparten los layouts y el menú de índice de la topbar. Vivía en
 * `Toc.astro`, pero el índice lateral se retiró en favor del menú de la topbar.
 */

export interface Heading {
  depth: number;
  slug: string;
  text: string;
}
