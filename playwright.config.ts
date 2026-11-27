import { defineConfig, devices } from '@playwright/test';
import { SITE_BASE } from './src/lib/site.mjs';

/**
 * Configuración de pruebas e2e (Playwright).
 *
 * Levanta un build de producción servido por `astro preview` (respetando el
 * `base` del sitio) y corre el spec contra esa URL. Así se valida el sitio tal
 * como se publica, no el modo dev.
 */

const PORT = 4321;
const baseURL = `http://localhost:${PORT}${SITE_BASE}/`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    permissions: ['clipboard-read', 'clipboard-write'],
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // `exec` reemplaza el shell por el proceso de Astro, de modo que al
    // apagar Playwright mate ese proceso y no quede un servidor huérfano
    // reteniendo la salida estándar (lo que colgaría la corrida).
    command: `pnpm build && exec node ./node_modules/astro/bin/astro.mjs preview --port ${PORT} --ignore-lock`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
