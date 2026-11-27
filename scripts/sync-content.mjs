#!/usr/bin/env node
/**
 * Sincroniza el contenido desde el repo upstream en un solo paso.
 *
 * Uso:
 *   pnpm sync                    # clona el upstream en un temporal y sincroniza
 *   pnpm sync --section=guides   # solo una sección
 *   pnpm sync --source=../ruta   # usa un checkout local
 *   UPSTREAM_DIR=../ruta pnpm sync
 *
 * Solo copia secciones publicables, reescribe links con la base del sitio y
 * refresca `scripts/pending-sync.json`. No intenta migrar iconos ni idioma:
 * eso es revisión de contenido y se hace sobre el diff.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { UPSTREAM_URL } from './lib/content-constants.mjs';

const argv = process.argv.slice(2);
const sourceArg = argv.find((arg) => arg.startsWith('--source='))?.slice('--source='.length);
const sectionArg = argv.find((arg) => arg.startsWith('--section='));
const explicit = sourceArg ?? process.env.UPSTREAM_DIR ?? null;

let source = explicit;
let temp = null;

if (!source) {
  temp = mkdtempSync(join(tmpdir(), 'sysadmin-upstream-'));
  console.log(`Clonando ${UPSTREAM_URL} …`);
  const clone = spawnSync('git', ['clone', '--depth', '1', UPSTREAM_URL, temp], {
    stdio: 'inherit',
  });
  if (clone.status !== 0) {
    console.error('No se pudo clonar el upstream. Usa --source=<dir> o UPSTREAM_DIR.');
    process.exit(1);
  }
  source = temp;
} else if (!existsSync(source) || !statSync(source).isDirectory()) {
  console.error(`No existe el directorio de origen: ${source}`);
  process.exit(1);
}

try {
  const childArgs = ['scripts/prepare-content.mjs', source];
  if (sectionArg) childArgs.push(sectionArg);
  if (argv.includes('--skip-existing')) childArgs.push('--skip-existing');
  const run = spawnSync(process.execPath, childArgs, {
    stdio: 'inherit',
  });
  if (run.status !== 0) process.exit(run.status ?? 1);
} finally {
  if (temp) rmSync(temp, { recursive: true, force: true });
}
