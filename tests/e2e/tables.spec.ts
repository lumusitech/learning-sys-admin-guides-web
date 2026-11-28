import { expect, test } from '@playwright/test';
import { SITE_BASE } from '../../src/lib/site.mjs';

/**
 * Regresión: en móvil las tablas scrollean enteras. La primera columna no
 * debe quedar fija ni forzar `nowrap` (dejaba el scroll en una franja mínima).
 */
test('en móvil la primera columna de una tabla no queda fija', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${SITE_BASE}/concepts/idempotency/`);

  const firstCell = page.locator('.prose table tbody td:first-child').first();
  const headerCell = page.locator('.prose table thead th').first();

  await expect(firstCell).toHaveCSS('position', 'static');
  await expect(firstCell).toHaveCSS('white-space', 'normal');
  // El header sticky se conserva: es útil para el scroll vertical.
  await expect(headerCell).toHaveCSS('position', 'sticky');
});
