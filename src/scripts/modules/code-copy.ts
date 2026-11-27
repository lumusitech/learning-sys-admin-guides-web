/**
 * Acciones de los bloques de código.
 *
 * Envuelve cada `pre` en `.code-wrap` con una barra de acciones encima. Hoy la
 * barra solo tiene "copiar"; agregar otra acción es sumar un botón a `actions`
 * (p. ej. ajuste de líneas o descarga).
 */

import { on, queryAll } from '../../lib/dom';

function stripPrompts(text: string): string {
  return text
    .split('\n')
    .map((line) => line.replace(/^\s*\$\s+/, ''))
    .join('\n');
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  }
}

const ICON_COPY =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';

const ICON_CHECK =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

function actionButton(label: string, icon: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'code-action';
  button.setAttribute('aria-label', label);
  button.title = label;
  button.innerHTML = icon;
  return button;
}

export function initCodeCopy(): void {
  for (const pre of queryAll<HTMLPreElement>('.prose pre:not(.mermaid)')) {
    if (pre.closest('.code-wrap')) continue;

    const wrap = document.createElement('div');
    wrap.className = 'code-wrap';

    const toolbar = document.createElement('div');
    toolbar.className = 'code-toolbar';

    const actions = document.createElement('div');
    actions.className = 'code-actions';

    const copyButton = actionButton('Copiar el bloque de código', ICON_COPY);
    copyButton.dataset.action = 'copy';
    on(copyButton, 'click', () => {
      const code = stripPrompts(pre.textContent ?? '');
      void copyText(code).then((ok) => {
        if (!ok) return;
        copyButton.dataset.copied = 'true';
        copyButton.innerHTML = ICON_CHECK;
        copyButton.setAttribute('aria-label', 'Copiado');
        window.setTimeout(() => {
          copyButton.dataset.copied = 'false';
          copyButton.innerHTML = ICON_COPY;
          copyButton.setAttribute('aria-label', 'Copiar el bloque de código');
        }, 1600);
      });
    });
    actions.appendChild(copyButton);

    toolbar.appendChild(actions);
    pre.parentNode?.insertBefore(wrap, pre);
    wrap.appendChild(toolbar);
    wrap.appendChild(pre);
  }
}
