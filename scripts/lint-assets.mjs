#!/usr/bin/env node
/**
 * Valida que los links a assets de labs resuelvan a `public/labs`.
 *
 * Uso: `pnpm lint:assets`
 *
 * Detecta:
 *  - links absolutos `${SITE_BASE}/labs/...` cuyo archivo no existe;
 *  - links relativos a `labs/...` que el sync debería haber reescrito.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, posix, relative } from 'node:path';
import { SITE_BASE } from '../src/lib/site.mjs';

const BASE = SITE_BASE.endsWith('/') ? SITE_BASE : `${SITE_BASE}/`;
const CONTENT = 'content';
const LABS = join('public', 'labs');
const LINK = /\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/g;
const EXTERNAL = /^(https?:|mailto:|tel:|\/\/)/;

const errors = [];
let checked = 0;

function* markdownFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* markdownFiles(path);
    else if (entry.name.endsWith('.md')) yield path;
  }
}

function countFiles(dir) {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) total += countFiles(join(dir, entry.name));
    else total += 1;
  }
  return total;
}

for (const file of markdownFiles(CONTENT)) {
  const relFile = relative(CONTENT, file).replace(/\\/g, '/');
  const dir = posix.dirname(relFile);
  let fence = false;

  for (const [index, line] of readFileSync(file, 'utf8').split(/\r?\n/).entries()) {
    if (/^\s*```/.test(line)) {
      fence = !fence;
      continue;
    }
    if (fence) continue;

    LINK.lastIndex = 0;
    let match;
    while ((match = LINK.exec(line)) !== null) {
      const target = match[1];
      if (EXTERNAL.test(target)) continue;

      if (target.startsWith(`${BASE}labs/`)) {
        // `/labs/kubernetes/` es una página de contenido, no un asset.
        if (target.endsWith('/')) continue;
        checked += 1;
        const rel = decodeURIComponent(target.slice(BASE.length).split('#')[0]);
        if (!existsSync(join('public', rel))) {
          errors.push(`${relFile}:${index + 1} asset inexistente: ${target}`);
        }
        continue;
      }

      if (!target.startsWith('/')) {
        const resolved = posix.normalize(posix.join(dir, target));
        if (resolved.startsWith('labs/') && !resolved.endsWith('/')) {
          errors.push(
            `${relFile}:${index + 1} link relativo a asset de labs: ${target} (debe ser ${BASE}${resolved})`,
          );
        }
      }
    }
  }
}

if (!existsSync(LABS)) {
  errors.push(`falta el directorio ${LABS}; corre 'pnpm sync:labs <sourceDir>'.`);
}

if (errors.length > 0) {
  console.error(`\nAssets: ${errors.length} error(es).\n`);
  for (const error of errors) console.error(`  ✗ ${error}`);
  process.exit(1);
}

console.log(`Assets: OK (${checked} link(s) a labs, ${countFiles(LABS)} archivo(s)).`);
