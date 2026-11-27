#!/usr/bin/env node
/**
 * Scaffolder de documentos.
 *
 * Uso:
 *   pnpm new:guide <section> <slug> [--title="..."] [--level="Básico"] [--icon="⚡"]
 *
 * - `section` debe pertenecer a `SECTIONS` (guides, scenarios, concepts, reference, labs).
 * - `slug` admite subcarpetas (`dahua/dahua-discovery`).
 * - El icono se valida contra el set canónico (`docs/icon-system.md`).
 * - Se niega a sobrescribir un documento existente.
 *
 * El esqueleto sale de `docs/guide-template.md` (primer bloque ```md), así el
 * template es la única fuente de verdad de la estructura.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { LEVELS, SECTIONS } from './lib/content-constants.mjs';
import { ICON_DOC, iconKey, leadingEmoji, loadIconSet } from './lib/icon-set.mjs';

const TEMPLATE = 'docs/guide-template.md';
const CONTENT = 'content';

const argv = process.argv.slice(2);

const flags = {};
const positional = [];
for (let index = 0; index < argv.length; index += 1) {
  const arg = argv[index];
  if (!arg.startsWith('--')) {
    positional.push(arg);
    continue;
  }
  const [name, inlineValue] = arg.slice(2).split('=');
  if (inlineValue !== undefined) {
    flags[name] = inlineValue;
  } else if (index + 1 < argv.length && !argv[index + 1].startsWith('--')) {
    flags[name] = argv[index + 1];
    index += 1;
  } else {
    flags[name] = true;
  }
}

function usage(message) {
  if (message) console.error(`\n${message}\n`);
  console.error(
    'Uso: pnpm new:guide <section> <slug> [--title="..."] [--level="Básico"] [--icon="⚡"]',
  );
  console.error(`  section: ${SECTIONS.join(' | ')}`);
  console.error(`  level:   ${LEVELS.join(' | ')}`);
  process.exit(1);
}

/** Devuelve el valor de un flag, o `null` si no se pasó. */
function flag(name) {
  const value = flags[name];
  return typeof value === 'string' ? value : null;
}

const [section, rawSlug] = positional;
if (!section || !rawSlug) usage('Falta la sección o el slug.');

if (!SECTIONS.includes(section)) {
  usage(`Sección desconocida: "${section}".`);
}

const slug = rawSlug.replace(/^\/+|\/+$/g, '').replace(/\.md$/, '');
if (!/^[A-Za-z0-9._/-]+$/.test(slug) || slug.includes('..')) {
  usage(`Slug inválido: "${rawSlug}".`);
}

const level = flag('level') ?? 'Básico';
if (!LEVELS.includes(level)) {
  usage(`Nivel desconocido: "${level}".`);
}

const icon = flag('icon') ?? '⚡';
const emoji = leadingEmoji(icon);
const iconSet = loadIconSet();
if (!emoji || !iconSet.has(iconKey(emoji))) {
  usage(`Icono fuera del set: "${icon}". Ver ${ICON_DOC}.`);
}

function humanize(value) {
  const last = value.split('/').pop() ?? value;
  const words = last
    .replace(/[_-]+/g, ' ')
    .replace(/^\d+\s*/, '')
    .trim();
  if (!words) return last;
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const title = flag('title') ?? humanize(slug);
const destination = join(CONTENT, section, `${slug}.md`);

if (existsSync(destination)) {
  usage(`Ya existe ${destination}. Elige otro slug.`);
}

const source = readFileSync(TEMPLATE, 'utf8');
const block = source.match(/```md\r?\n([\s\S]*?)```/);
if (!block) {
  console.error(`${TEMPLATE}: no se encontró el bloque \`\`\`md con el esqueleto.`);
  process.exit(1);
}

const content = block[1]
  .replace(/^title:.*$/m, `title: "${icon} ${title}"`)
  .replace(/^level:.*$/m, `level: "${level}"`)
  .replace(/^section:.*$/m, `section: "${section}"`)
  .replace(/^# .*$/m, `# ${icon} ${title}`);

mkdirSync(dirname(destination), { recursive: true });
writeFileSync(destination, content);

console.log(`\nCreado ${destination}\n`);
console.log('Siguientes pasos:');
console.log('  1. Completa el título y las filas de `meta` (Requisitos, Herramientas, Archivos).');
console.log('  2. Escribe el contenido siguiendo docs/guide-template.md.');
console.log('  3. pnpm lint:icons && pnpm lint:content');
console.log('  4. pnpm check && pnpm test:all');
