/**
 * Tema claro/oscuro.
 *
 * Persiste la elección en `localStorage` y emite `theme-change` para que otros
 * módulos (p. ej. mermaid) reaccionen sin acoplarse al botón.
 */

import { queryAll } from '../../lib/dom';

export type Theme = 'light' | 'dark';

/** Tema activo según el atributo de `<html>`. */
export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

function setTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem('theme', theme);
  } catch {
    /* almacenamiento no disponible */
  }
  document.dispatchEvent(new CustomEvent<Theme>('theme-change', { detail: theme }));
}

export function initTheme(): void {
  for (const button of queryAll<HTMLButtonElement>('[data-theme-toggle]')) {
    button.addEventListener('click', () => {
      setTheme(currentTheme() === 'dark' ? 'light' : 'dark');
    });
  }
}
