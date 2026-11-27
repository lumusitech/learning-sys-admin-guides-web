import { describe, expect, it } from 'vitest';
import { inlineMarkdown } from '../../src/lib/inline-markdown';

/**
 * Render inline de los valores de `meta`: código y negrita, con escape de HTML
 * para que un valor del frontmatter nunca inyecte markup.
 */

describe('inlineMarkdown', () => {
  it('convierte código inline', () => {
    expect(inlineMarkdown('`nmap`, `curl`')).toBe('<code>nmap</code>, <code>curl</code>');
  });

  it('convierte negrita', () => {
    expect(inlineMarkdown('**ojo**')).toBe('<strong>ojo</strong>');
  });

  it('escapa HTML antes de formatear', () => {
    expect(inlineMarkdown('<script>alert(1)</script>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;',
    );
  });

  it('deja el texto plano sin cambios', () => {
    expect(inlineMarkdown('system')).toBe('system');
  });
});
