import { describe, expect, it } from 'vitest';
import { fuzzyMatch, makeSnippet } from '../../src/lib/fuzzy';

/**
 * Pruebas del matcher difuso: prioridad contigua > subsecuencia, palabra
 * completa > subcadena dentro de una palabra más larga, plegado de acentos y
 * mayúsculas, y fidelidad de los rangos respecto al texto original.
 */

describe('fuzzyMatch', () => {
  it('prefiere una coincidencia contigua sobre una dispersa', () => {
    const contiguous = fuzzyMatch('abc', 'xxabcxx');
    const scattered = fuzzyMatch('abc', 'a-x-b-x-c');

    expect(contiguous).not.toBeNull();
    expect(scattered).not.toBeNull();
    expect(contiguous?.score ?? 0).toBeGreaterThan(scattered?.score ?? 0);
    expect(contiguous?.ranges).toEqual([[2, 5]]);
  });

  it('prefiere una palabra completa sobre una palabra más larga que la contiene', () => {
    const whole = fuzzyMatch('config', 'config drift');
    const longer = fuzzyMatch('config', 'configuration file');

    expect(whole).not.toBeNull();
    expect(longer).not.toBeNull();
    expect(whole?.score ?? 0).toBeGreaterThan(longer?.score ?? 0);
    expect(whole?.ranges).toEqual([[0, 6]]);
  });

  it('cae a la subsecuencia cuando no hay coincidencia contigua', () => {
    const target = 'ls -lth /opt/app/ | head -5';
    const match = fuzzyMatch('lsa', target);

    expect(match).not.toBeNull();
    // `l` y `s` son contiguos; la `a` aparece después, en `app`.
    expect(match?.ranges[0]).toEqual([0, 2]);
    const last = match?.ranges[match.ranges.length - 1];
    expect(last).toBeDefined();
    expect(target.slice(last?.[0], last?.[1])).toBe('a');
  });

  it('pliega acentos y mayúsculas conservando la posición', () => {
    const accented = fuzzyMatch('configuracion', 'Configuración');
    expect(accented?.ranges).toEqual([[0, 13]]);
    expect('Configuración'.slice(0, 13)).toBe('Configuración');

    const upper = fuzzyMatch('DIFF', 'diff -rq');
    expect(upper?.ranges).toEqual([[0, 4]]);
  });

  it('devuelve rangos alineados con el texto original', () => {
    const target = 'config drift';
    const match = fuzzyMatch('drift', target);
    const range = match?.ranges[0];

    expect(range).toBeDefined();
    expect(target.slice(range?.[0], range?.[1])).toBe('drift');
  });

  it('devuelve null cuando no hay coincidencia', () => {
    expect(fuzzyMatch('zzz', 'config drift')).toBeNull();
    expect(fuzzyMatch('a', '')).toBeNull();
  });

  it('devuelve un match vacío para una consulta vacía', () => {
    expect(fuzzyMatch('', 'config drift')).toEqual({ score: 0, ranges: [] });
    expect(fuzzyMatch('   ', 'config drift')).toEqual({ score: 0, ranges: [] });
  });
});

describe('makeSnippet', () => {
  it('mantiene los rangos alineados con el fragmento recortado', () => {
    const text = 'contenido de relleno alrededor de la palabra config drift y más relleno';
    const match = fuzzyMatch('drift', text);
    const full = match?.ranges[0];

    expect(full).toBeDefined();
    const snippet = makeSnippet(text, match?.ranges ?? [], 10);
    // El resaltado dentro del fragmento apunta a la misma subcadena.
    const [from, to] = snippet.ranges[0] ?? [0, 0];
    expect(snippet.text.slice(from, to)).toBe('drift');
  });
});
