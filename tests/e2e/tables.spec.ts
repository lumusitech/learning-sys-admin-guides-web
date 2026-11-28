import { expect, test } from '@playwright/test';
import { SITE_BASE } from '../../src/lib/site.mjs';

/**
 * En móvil las tablas solo scrollean horizontalmente. Sin header sticky ni
 * scroll vertical interno: la página conserva su scroll normal y el header
 * se va con la tabla. Esto evita el efecto inconsistente (solo en tablas
 * largas) y el scroll anidado que secuestraba el gesto vertical.
 */
test('en móvil las tablas no tienen header sticky ni scroll vertical interno', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${SITE_BASE}/concepts/idempotency/`);

  const firstCell = page.locator('.prose table tbody td:first-child').first();
  const headerCell = page.locator('.prose table thead th').first();
  const wrapper = page.locator('.table-wrap').first();

  await expect(firstCell).toHaveCSS('position', 'static');
  await expect(firstCell).toHaveCSS('white-space', 'normal');
  await expect(headerCell).toHaveCSS('position', 'static');
  await expect(wrapper).toHaveCSS('overflow-x', 'auto');
  await expect(wrapper).toHaveCSS('max-height', 'none');
});

test('en móvil una tabla larga tampoco atrapa el scroll vertical', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${SITE_BASE}/concepts/linux-fhs/`);

  const anyMaxHeight = await page
    .locator('.table-wrap')
    .evaluateAll((wrappers) => wrappers.some((el) => getComputedStyle(el).maxHeight !== 'none'));

  expect(anyMaxHeight).toBe(false);
});
