import { expect, test, type Page } from '@playwright/test';
import { SITE_BASE } from '../../src/lib/site.mjs';

/**
 * Pruebas end-to-end del sitio construido.
 *
 * Corren contra `astro preview` (ver `playwright.config.ts`), así que validan
 * el HTML, el CSS y el JS de producción: navegación, índice de página, las dos
 * búsquedas, bloques `:::sim`, copiado de código, tema, mermaid y layout móvil.
 */

const HOME = `${SITE_BASE}/`;
const DIFF_GUIDE = `${SITE_BASE}/guides/diff/`;
const DRIFT_SCENARIO = `${SITE_BASE}/scenarios/system/15-config-drift/`;

/** Acumula errores de consola y de página para revisarlos al final. */
function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

test('la portada muestra las tarjetas de sección', async ({ page }) => {
  await page.goto(HOME);

  await expect(page.getByRole('heading', { name: 'Guías' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Escenarios' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Referencias' })).toBeVisible();

  expect(await page.locator('article').count()).toBeGreaterThanOrEqual(4);
});

test('la navegación lateral llega a una guía', async ({ page }) => {
  await page.goto(DIFF_GUIDE);

  const sidebar = page.locator('aside.lg\\:block nav[aria-label="Navegación principal"]');
  await sidebar.locator('summary', { hasText: 'Escenarios' }).click();
  await sidebar.locator('summary', { hasText: 'system' }).click();
  await sidebar.getByRole('link', { name: /Config drift/ }).click();

  await expect(page).toHaveURL(/\/scenarios\/system\/15-config-drift\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Config drift');
});

test('el menú de índice abre y marca la sección activa', async ({ page }) => {
  await page.goto(DRIFT_SCENARIO);

  const toggle = page.locator('[data-toc-menu-toggle]');
  const panel = page.locator('[data-toc-menu-panel]');

  // El manejador del botón se registra al terminar de evaluarse el módulo de
  // mejora progresiva; bajo carga en CI ese clic puede llegar antes. Se
  // reintenta la apertura hasta que el panel quede visible.
  await expect(async () => {
    await toggle.click();
    await expect(panel).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 10_000 });

  // Coloca el segundo h2 dentro de la banda del IntersectionObserver
  // (rootMargin -15% arriba / -70% abajo) para que se marque como activo.
  await page.evaluate(() => {
    const heading = document.querySelectorAll('#contenido h2')[1];
    if (!heading) return;
    const top = heading.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, top - window.innerHeight * 0.2);
  });
  await expect
    .poll(async () => page.locator('[data-toc-link][data-active="true"]').count(), {
      timeout: 10_000,
    })
    .toBeGreaterThan(0);
});

test('la búsqueda global resalta la palabra completa', async ({ page }) => {
  await page.goto(HOME);

  await page.locator('[data-search-open]').click();
  await expect(page.locator('[data-search-dialog]')).toBeVisible();

  await page.locator('[data-search-input]').fill('config');
  await expect(page.locator('.search-result .search-hit').first()).toHaveText(/^config$/i);
});

test('la búsqueda local encuentra una línea de comando', async ({ page }) => {
  await page.goto(DIFF_GUIDE);

  await page.locator('[data-local-filter]').fill('drq');
  await expect(page.locator('.local-result', { hasText: 'diff -rq' }).first()).toBeVisible();
});

test('un bloque :::sim abre y muestra su salida', async ({ page }) => {
  await page.goto(DIFF_GUIDE);

  const sim = page.locator('.sim').first();
  await sim.locator('summary.sim-toggle').click();

  await expect(sim).toHaveAttribute('open', '');
  await expect(sim.locator('.sim-output').first()).toBeVisible();
  await expect(sim.locator('.sim-output').first()).toContainText('diff -q');
});

test('el botón de copiar reporta el estado copiado', async ({ page }) => {
  await page.goto(DIFF_GUIDE);

  const wrap = page.locator('.code-wrap').first();
  const button = wrap.locator('.code-action[data-action="copy"]');

  await expect(button).toHaveAttribute('aria-label', 'Copiar el bloque de código');
  await button.click();
  await expect(button).toHaveAttribute('data-copied', 'true');
  await expect(button).toHaveAttribute('aria-label', 'Copiado');
});

test('el botón de copiar no se solapa con la salida simulada', async ({ page }) => {
  await page.goto(DIFF_GUIDE);

  const sim = page.locator('.sim').first();
  await sim.locator('summary.sim-toggle').click();

  const wrap = sim.locator('.code-wrap').first();
  const button = wrap.locator('.code-action[data-action="copy"]');
  const output = wrap.locator('.sim-output');

  const buttonBox = await button.boundingBox();
  const outputBox = await output.boundingBox();
  expect(buttonBox).not.toBeNull();
  expect(outputBox).not.toBeNull();
  if (buttonBox && outputBox) {
    // La barra de acciones queda por encima del bloque de salida.
    expect(buttonBox.y + buttonBox.height).toBeLessThanOrEqual(outputBox.y + 1);
  }
});

test('el tema persiste tras recargar', async ({ page }) => {
  await page.goto(HOME);

  const html = page.locator('html');
  const before = await html.getAttribute('data-theme');

  await page.locator('[data-theme-toggle]').click();
  const after = await html.getAttribute('data-theme');
  expect(after).not.toBe(before);

  await page.reload();
  await expect(html).toHaveAttribute('data-theme', after ?? '');
});

test('un diagrama mermaid se renderiza como svg', async ({ page }) => {
  await page.goto(DRIFT_SCENARIO);

  await expect(page.locator('pre.mermaid svg').first()).toBeVisible({ timeout: 15_000 });
});

test('no hay desborde horizontal en móvil', async ({ page }) => {
  for (const width of [320, 412]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(DIFF_GUIDE);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `desborde horizontal a ${width}px`).toBeLessThanOrEqual(1);
  }
});

test('no hay errores de consola en las páginas visitadas', async ({ page }) => {
  const errors = collectErrors(page);

  await page.goto(HOME);
  await page.goto(DIFF_GUIDE);
  await page.goto(DRIFT_SCENARIO);
  await page.waitForLoadState('networkidle');

  expect(errors).toEqual([]);
});
