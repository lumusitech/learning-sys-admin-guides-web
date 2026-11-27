#!/usr/bin/env node
/**
 * Genera el índice de búsqueda global.
 *
 * Lee `content/**\/*.md`, separa el cuerpo por títulos y emite un JSON con un
 * registro por bloque (título + texto) que el buscador del cliente usa para la
 * coincidencia difusa. La salida va a `public/search-index.json`, así sirve
 * igual en `dev` (lo sirve `public/`) y en el build (se copia a `dist/`).
 *
 * El archivo generado está en `.gitignore`.
 */

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { SITE_BASE } from '../src/lib/site.mjs';
import { normalizeDocument } from '../src/lib/search-index.mjs';

const CONTENT = 'content';
const OUTPUT = 'public/search-index.json';
const MIN_TEXT = 12;

function* markdownFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* markdownFiles(path);
    else if (entry.name.endsWith('.md')) yield path;
  }
}

/** Quita sintaxis markdown para dejar texto plano buscable. */
function plain(text) {
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/^\s*:::[^\n]*$/gm, ' ')
    .replace(/[`*_|>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function field(frontmatter, name) {
  const match = frontmatter.match(new RegExp(`^${name}:\\s*"(.*)"\\s*$`, 'm'));
  return match ? match[1] : '';
}

function toBlocks(body) {
  const blocks = [];
  let heading = '';
  let lines = [];
  let code = null;

  const flushText = () => {
    const text = plain(lines.join('\n'));
    if (text.length >= MIN_TEXT) blocks.push({ heading, text });
    lines = [];
  };

  const flushCode = () => {
    if (!code) return;
    const text = plain(code.join('\n'));
    if (text.length >= 4) blocks.push({ heading, text, code: true });
    code = null;
  };

  for (const line of body.split(/\r?\n/)) {
    if (/^\s*```/.test(line)) {
      if (code) flushCode();
      else {
        flushText();
        code = [];
      }
      continue;
    }
    if (code) {
      code.push(line);
      continue;
    }
    if (/^#\s/.test(line)) continue; // el H1 lo renderiza el layout
    const match = line.match(/^(#{2,4})\s+(.*)$/);
    if (match) {
      flushText();
      heading = plain(match[2]);
      continue;
    }
    lines.push(line);
  }

  if (code) flushCode();
  else flushText();

  return blocks;
}

function buildDocument(path) {
  const raw = readFileSync(path, 'utf8');
  const front = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  const frontmatter = front ? front[1] : '';
  const body = front ? raw.slice(front[0].length) : raw;
  const id = relative(CONTENT, path).replace(/\.md$/, '');

  return normalizeDocument({
    id,
    title: field(frontmatter, 'title') || id,
    section: field(frontmatter, 'section') || id.split('/')[0] || '',
    url: `${SITE_BASE}/${id}/`.replace(/\/{2,}/g, '/'),
    blocks: toBlocks(body),
  });
}

const documents = [...markdownFiles(CONTENT)].sort().map(buildDocument);
mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(OUTPUT, `${JSON.stringify({ generatedAt: new Date().toISOString(), documents }, null, 0)}\n`);

const blocks = documents.reduce((sum, doc) => sum + doc.blocks.length, 0);
console.log(`Índice de búsqueda: ${documents.length} documentos, ${blocks} bloques → ${OUTPUT}`);
