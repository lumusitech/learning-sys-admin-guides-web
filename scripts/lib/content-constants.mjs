/**
 * Allowlists compartidas por los scripts de contenido.
 *
 * `SECTIONS` coincide con las carpetas de primer nivel de `content/` y con
 * `SECTION_LABELS` de `src/lib/nav.ts`. `LEVELS` coincide con el comentario del
 * frontmatter en `docs/guide-template.md`.
 */

export const SECTIONS = ['guides', 'scenarios', 'concepts', 'reference', 'labs'];

export const LEVELS = ['Básico', 'Intermedio', 'Avanzado'];

/** Repo de origen del contenido (usado por `pnpm sync`). */
export const UPSTREAM_URL = 'https://github.com/lumusitech/learning-sys-admin-guides.git';
