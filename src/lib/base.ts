/**
 * Base URL pública del sitio, siempre con barra final.
 *
 * Astro 7 expone `import.meta.env.BASE_URL` tal cual se configuró, sin
 * garantizar la barra final. Concatenar `base + 'favicon.svg'` con
 * `/repo` produce `/repofavicon.svg`, así que normalizamos una sola vez.
 */
const rawBase = import.meta.env.BASE_URL;

export const base = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;