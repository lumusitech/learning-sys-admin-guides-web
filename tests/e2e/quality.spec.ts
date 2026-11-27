import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { SITE_BASE } from '../../src/lib/site.mjs';

/**
 * Pruebas de calidad: accesibilidad (axe) y presupuestos de CSS/JS de entrada.
 *
 * Los presupuestos usan los recursos que el navegador descarga al cargar la
 * portada, así miden el peso real de entrada y no los chunks diferidos de
 * mermaid (que solo se piden en páginas con diagramas).
 */

const HOME = `${SITE_BASE}/`;
const DIFF_GUIDE = `${SITE_BASE}/guides/diff/`;

const PAGES = [
  { name: 'portada', path: HOME },
  { name: 'guía', path: DIFF_GUIDE },
] as const;

for (const page of PAGES) {
  test(`sin violaciones críticas ni graves de accesibilidad en la ${page.name}`, async ({ page: browser }) => {
    await browser.goto(page.path);

    const results = await new AxeBuilder({ page: browser }).analyze();
    const blocking = results.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious',
    );

    expect(
      blocking.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        help: violation.help,
        nodes: violation.nodes.length,
      })),
    ).toEqual([]);
  });
}

test('el CSS y el JS de entrada respetan el presupuesto', async ({ page }) => {
  await page.goto(HOME);
  await page.waitForLoadState('networkidle');

  const sizes = await page.evaluate(() => {
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    let js = 0;
    let css = 0;

    for (const resource of resources) {
      const bytes = resource.decodedBodySize || resource.transferSize || 0;
      if (resource.name.endsWith('.js')) js += bytes;
      else if (resource.name.endsWith('.css')) css += bytes;
    }

    return { js, css };
  });

  expect(sizes.css, `CSS de entrada: ${sizes.css} bytes`).toBeLessThan(90_000);
  expect(sizes.js, `JS de entrada: ${sizes.js} bytes`).toBeLessThan(300_000);
  expect(sizes.css).toBeGreaterThan(5_000);
  expect(sizes.js).toBeGreaterThan(5_000);
});
