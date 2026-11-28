import { expect, test } from '@playwright/test';
import { SITE_BASE } from '../../src/lib/site.mjs';

/**
 * Los assets de labs se publican en `public/labs` y los links del contenido
 * apuntan a la base del sitio (no a rutas relativas que rompían).
 */
test('los assets de labs se sirven', async ({ request }) => {
  const response = await request.get(`${SITE_BASE}/labs/docker-compose.dahua.yml`);

  expect(response.status()).toBe(200);
  expect(await response.text()).toContain('services:');
});

test('una guía enlaza al asset de labs con la base del sitio', async ({ page }) => {
  await page.goto(`${SITE_BASE}/guides/docker/`);

  const link = page.locator('a[href$="/labs/docker-compose.docker.yml"]').first();
  await expect(link).toHaveAttribute('href', `${SITE_BASE}/labs/docker-compose.docker.yml`);
});

test('el laboratorio de bases de datos publica su compose', async ({ request }) => {
  const response = await request.get(`${SITE_BASE}/labs/db/docker-compose.yml`);

  expect(response.status()).toBe(200);
  const body = await response.text();
  expect(body).toContain('postgres-primary');
  expect(body).toContain('redis');
  expect(body).toContain('mongo1');
});
