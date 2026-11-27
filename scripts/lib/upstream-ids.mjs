/**
 * Listado de ids del repo upstream y allowlist de pendientes de sync.
 *
 * `collectUpstreamIds` recorre el repo de origen y devuelve los ids que el
 * sitio puede enlazar (mismas secciones que `content/`). `writePendingSync`
 * fija ese listado en `scripts/pending-sync.json`, que `lint:content` usa para
 * distinguir "pendiente de sync" (aviso) de "typo / documento inexistente"
 * (error).
 */

import { readdirSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { SECTIONS } from './content-constants.mjs';

export const PENDING_FILE = 'scripts/pending-sync.json';

const SKIP = new Set(['node_modules', '.git', 'dist', '.astro']);

/** Ids de los `.md` del upstream que pertenecen a una sección del sitio. */
export function collectUpstreamIds(root) {
  const ids = [];

  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP.has(entry.name)) continue;
        walk(path);
      } else if (entry.name.endsWith('.md')) {
        if (entry.name.toLowerCase() === 'readme.md') continue;
        const id = relative(root, path)
          .split(sep)
          .join('/')
          .replace(/\.md$/, '');
        if (SECTIONS.includes(id.split('/')[0])) ids.push(id);
      }
    }
  }

  walk(root);
  return ids.sort();
}

/** Escribe el allowlist ordenado. Determinista (solo ids) para detectar drift. */
export function writePendingSync(ids, file = PENDING_FILE) {
  writeFileSync(file, `${JSON.stringify({ ids }, null, 2)}\n`);
  return file;
}
