#!/usr/bin/env node
/**
 * Copia los assets de labs del upstream a `public/labs`.
 *
 * Uso:
 *   node scripts/sync-labs-assets.mjs <sourceDir>
 *   node scripts/sync-labs-assets.mjs --source=<dir> --check
 *
 * Excluye los `.md` (el README se publica como `content/labs/laboratorio-docker.md`).
 * En modo `--check` compara hashes y falla si `public/labs` quedó desactualizado.
 */

import { createHash } from 'node:crypto';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from 'node:fs';
import { dirname, join } from 'node:path';

const args = process.argv.slice(2);
const sourceArg =
  args.find((arg) => arg.startsWith('--source='))?.slice('--source='.length) ??
  args.find((arg) => !arg.startsWith('--'));
const check = args.includes('--check');

if (!sourceArg) {
  console.error('Falta el directorio upstream.');
  process.exit(1);
}

const source = join(sourceArg, 'labs');
const dest = join('public', 'labs');

if (!existsSync(source)) {
  console.error(`No existe el directorio de labs: ${source}`);
  process.exit(1);
}

/** Recorre los assets (todo excepto .md). */
function* walk(dir, base = '') {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path, rel);
    else if (!entry.name.endsWith('.md')) yield { rel, path };
  }
}

const files = [...walk(source)];
const hash = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');

if (check) {
  const problems = [];

  for (const { rel, path } of files) {
    const target = join(dest, rel);
    if (!existsSync(target)) problems.push(`falta ${rel}`);
    else if (hash(path) !== hash(target)) problems.push(`desactualizado ${rel}`);
  }

  if (existsSync(dest)) {
    const expected = new Set(files.map((file) => file.rel));
    for (const { rel } of walk(dest)) {
      if (!expected.has(rel)) problems.push(`sobra ${rel}`);
    }
  }

  if (problems.length > 0) {
    console.error(`Labs assets: ${problems.length} diferencia(s) con el upstream.`);
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }

  console.log(`Labs assets: OK (${files.length} archivos al día).`);
} else {
  rmSync(dest, { recursive: true, force: true });
  for (const { rel, path } of files) {
    const target = join(dest, rel);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(path, target);
    chmodSync(target, statSync(path).mode);
  }
  console.log(`Labs assets: ${files.length} archivos copiados a public/labs.`);
}
