import { expect, test } from '@playwright/test';
import { SITE_BASE } from '../../src/lib/site.mjs';

/**
 * Regresión de tablas en móvil:
 * - la primera columna no queda fija ni fuerza `nowrap`;
 * - el header sticky no tapa la primera fila (la tabla larga scrollea dentro
 *   de su caja, con el header fijo arriba de la tabla).
 */
test('en móvil la primera columna no queda fija y el header no tapa la primera fila', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${SITE_BASE}/concepts/idempotency/`);

  const firstCell = page.locator('.prose table tbody td:first-child').first();
  const headerCell = page.locator('.prose table thead th').first();
  const firstRow = page.locator('.prose table tbody tr').first();
  const wrapper = page.locator('.table-wrap').first();

  await expect(firstCell).toHaveCSS('position', 'static');
  await expect(firstCell).toHaveCSS('white-space', 'normal');
  await expect(headerCell).toHaveCSS('position', 'sticky');
  await expect(wrapper).toHaveCSS('overflow-y', 'auto');

  // Con la tabla corta no hay scroll interno; el header no se superpone.
  const tableTop = await page
    .locator('.prose table')
    .first()
    .evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
  await page.evaluate((top) => window.scrollTo(0, top), tableTop);

  const headerBox = await headerCell.boundingBox();
  const rowBox = await firstRow.boundingBox();
  expect((headerBox?.y ?? 0) + (headerBox?.height ?? 0)).toBeLessThanOrEqual((rowBox?.y ?? 0) + 1);
});

test('en móvil una tabla larga scrollea dentro de su caja', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${SITE_BASE}/concepts/linux-fhs/`);

  const scrollable = await page
    .locator('.table-wrap')
    .evaluateAll((wrappers) => wrappers.some((el) => el.scrollHeight > el.clientHeight + 1));

  expect(scrollable).toBe(true);
});
