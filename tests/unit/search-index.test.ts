import { describe, expect, it } from 'vitest';
import { normalizeDocument, parseSearchIndex } from '../../src/lib/search-index.mjs';

/**
 * Contrato compartido del índice: el generador (Node) normaliza y el cliente
 * valida. Estas pruebas fijan que ambas mitades no puedan divergir.
 */

describe('parseSearchIndex', () => {
  it('devuelve un array vacío cuando la respuesta no es un índice', () => {
    expect(parseSearchIndex(null)).toEqual([]);
    expect(parseSearchIndex({})).toEqual([]);
    expect(parseSearchIndex({ documents: 'no-es-array' })).toEqual([]);
  });

  it('descarta documentos con forma inválida y conserva los válidos', () => {
    const data = {
      documents: [
        {
          id: 'guides/diff',
          title: 'diff',
          url: '/guides/diff/',
          section: 'guides',
          blocks: [{ heading: 'Salida', text: 'diff -u' }],
        },
        { title: 'sin id ni bloques' },
        { id: 'roto', title: 'Roto', url: '/roto/', section: 'guides', blocks: 'no' },
      ],
    };

    const parsed = parseSearchIndex(data);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.id).toBe('guides/diff');
  });
});

describe('normalizeDocument', () => {
  it('rellena las claves ausentes y conserva el flag de código', () => {
    const doc = normalizeDocument({
      id: 'x',
      blocks: [{ heading: '', text: 'ls -l', code: true }],
    });

    expect(doc).toEqual({
      id: 'x',
      title: '',
      url: '',
      section: '',
      blocks: [{ heading: '', text: 'ls -l', code: true }],
    });
  });

  it('produce documentos que parseSearchIndex acepta', () => {
    const doc = normalizeDocument({
      id: 'x',
      title: 'X',
      url: '/x/',
      section: 'guides',
      blocks: [],
    });

    expect(parseSearchIndex({ documents: [doc] })).toEqual([doc]);
  });
});
