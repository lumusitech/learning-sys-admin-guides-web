#!/usr/bin/env node
/**
 * Regenera el allowlist de pendientes de sync desde el repo upstream.
 *
 * Uso: pnpm sync:allowlist <sourceDir>
 *
 * El allowlist (`scripts/pending-sync.json`) es un snapshot de los ids que
 * existen upstream. Se commitea para que CI pueda distinguir un link pendiente
 * de sincronizar (aviso) de un typo o documento inexistente (error).
 */

import { existsSync, statSync } from 'node:fs';
import { collectUpstreamIds, PENDING_FILE, writePendingSync } from './lib/upstream-ids.mjs';

const source = process.argv[2];

if (!source) {
  console.error('Uso: pnpm sync:allowlist <sourceDir>');
  process.exit(1);
}
if (!existsSync(source) || !statSync(source).isDirectory()) {
  console.error(`No existe el directorio de origen: ${source}`);
  process.exit(1);
}

const ids = collectUpstreamIds(source);
const file = writePendingSync(ids);
console.log(`Allowlist: ${ids.length} ids upstream (${source}) → ${file}`);
