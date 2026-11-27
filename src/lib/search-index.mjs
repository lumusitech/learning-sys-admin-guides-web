/**
 * Contrato compartido del índice de búsqueda global.
 *
 * Lo usan dos mundos:
 * - `scripts/build-search-index.mjs` (Node) normaliza cada documento con
 *   `normalizeDocument` antes de serializarlo;
 * - el cliente (`src/scripts/search`) valida la respuesta con
 *   `parseSearchIndex`.
 *
 * Se usa `.mjs` (no `.ts`) para que el generador Node lo importe sin loader,
 * igual que `src/lib/site.mjs`.
 */

/**
 * @typedef {object} SearchBlock
 * @property {string} heading Título de la sección a la que pertenece el bloque.
 * @property {string} text    Texto plano buscable.
 * @property {boolean} [code] `true` si el bloque es un comando.
 */

/**
 * @typedef {object} SearchDocument
 * @property {string} id
 * @property {string} title
 * @property {string} url
 * @property {string} section
 * @property {SearchBlock[]} blocks
 */

/** @param {unknown} value @returns {value is SearchBlock} */
function isBlock(value) {
  if (typeof value !== 'object' || value === null) return false;
  const block = /** @type {Record<string, unknown>} */ (value);
  return typeof block.heading === 'string' && typeof block.text === 'string';
}

/** @param {unknown} value @returns {value is SearchDocument} */
function isDocument(value) {
  if (typeof value !== 'object' || value === null) return false;
  const doc = /** @type {Record<string, unknown>} */ (value);
  return (
    typeof doc.id === 'string' &&
    typeof doc.title === 'string' &&
    typeof doc.url === 'string' &&
    typeof doc.section === 'string' &&
    Array.isArray(doc.blocks) &&
    doc.blocks.every(isBlock)
  );
}

/**
 * Valida y normaliza la respuesta JSON del índice.
 *
 * @param {unknown} data
 * @returns {SearchDocument[]}
 */
export function parseSearchIndex(data) {
  if (typeof data !== 'object' || data === null) return [];
  const documents = /** @type {{ documents?: unknown }} */ (data).documents;
  if (!Array.isArray(documents)) return [];
  return documents.filter(isDocument);
}

/**
 * Proyecta un documento a la forma canónica antes de serializarlo.
 *
 * @param {Partial<SearchDocument>} doc
 * @returns {SearchDocument}
 */
export function normalizeDocument(doc) {
  return {
    id: String(doc.id ?? ''),
    title: String(doc.title ?? ''),
    url: String(doc.url ?? ''),
    section: String(doc.section ?? ''),
    blocks: (doc.blocks ?? []).map((block) => ({
      heading: String(block.heading ?? ''),
      text: String(block.text ?? ''),
      ...(block.code ? { code: true } : {}),
    })),
  };
}
