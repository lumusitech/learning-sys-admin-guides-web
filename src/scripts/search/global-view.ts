/**
 * Render de los resultados de la búsqueda global.
 *
 * Convierte un `Hit` en un enlace con título, sección, encabezado y fragmento
 * resaltado, sin tocar el estado del diálogo.
 */

import { highlight, makeSnippet } from '../../lib/fuzzy';
import type { Hit } from './types';

/** Párrafo de estado vacío o de carga. */
export function message(text: string): HTMLElement {
  const paragraph = document.createElement('p');
  paragraph.className = 'search-empty';
  paragraph.textContent = text;
  return paragraph;
}

export function renderHit(hit: Hit): HTMLElement {
  const link = document.createElement('a');
  link.className = 'search-result';
  link.href = hit.doc.url;

  const head = document.createElement('span');
  head.className = 'search-result-head';

  const title = document.createElement('span');
  title.className = 'search-result-title';
  title.append(highlight(hit.doc.title, hit.titleMatch?.ranges ?? []));

  const badge = document.createElement('span');
  badge.className = 'search-result-section';
  badge.textContent = hit.doc.section;

  head.append(title, badge);
  link.append(head);

  if (hit.block && (hit.blockMatch || hit.headingMatch)) {
    const excerpt = document.createElement('span');
    excerpt.className = 'search-result-excerpt';

    if (hit.block.heading) {
      const heading = document.createElement('span');
      heading.className = 'search-result-heading';
      heading.append(highlight(hit.block.heading, hit.headingMatch?.ranges ?? []));
      excerpt.append(heading);
    }

    if (hit.blockMatch) {
      const snippet = makeSnippet(hit.block.text, hit.blockMatch.ranges);
      excerpt.append(highlight(snippet.text, snippet.ranges));
    }

    link.append(excerpt);
  } else {
    // Coincidencia solo en el título: mostramos el arranque del documento como contexto.
    const prose = hit.doc.blocks.filter((candidate) => !candidate.code);
    const fallback =
      prose.find((candidate) => candidate.heading.length > 0 && candidate.text.length > 0) ??
      prose.find((candidate) => candidate.text.length > 0) ??
      hit.doc.blocks.find((candidate) => candidate.text.length > 0);
    if (fallback) {
      const excerpt = document.createElement('span');
      excerpt.className = 'search-result-excerpt';

      if (fallback.heading) {
        const heading = document.createElement('span');
        heading.className = 'search-result-heading';
        heading.textContent = fallback.heading;
        excerpt.append(heading);
      }

      excerpt.append(
        fallback.text.length > 120 ? `${fallback.text.slice(0, 120)} …` : fallback.text,
      );
      link.append(excerpt);
    }
  }

  return link;
}
