import { defineConfig } from 'vitest/config';

/**
 * Configuración de pruebas unitarias (Vitest).
 *
 * Solo cubre `tests/unit`: los e2e viven en `tests/e2e` y los ejecuta
 * Playwright, así que se excluyen para que Vitest no intente importar
 * `@playwright/test`.
 */
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
