/**
 * Render de markdown inline para metadatos.
 *
 * Convierte solo lo necesario para una fila de cabecera (código y negrita) y
 * escapa el resto, de modo que un valor del frontmatter nunca inyecte HTML.
 */

export function inlineMarkdown(value: string): string {
  const escaped = value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  return escaped
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}
