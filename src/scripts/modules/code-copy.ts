/**
 * Acciones de los bloques de código.
 *
 * - Envuelve cada `pre` en `.code-wrap` con una barra de acciones encima.
 * - Agrega un botón de copiar a los Quick command inline: párrafos compuestos
 *   únicamente por un `<code>` bajo un encabezado "Quick command".
 *
 * Agregar otra acción a un bloque es sumar un botón a `actions`.
 */

import { on, queryAll } from '../../lib/dom';

const BLOCK_LABEL = 'Copiar el bloque de código';
const COMMAND_LABEL = 'Copiar el comando';

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

function actionButton(
  label: string,
  icon: string,
  className = 'code-action',
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.setAttribute('aria-label', label);
  button.title = label;
  button.innerHTML = icon;
  return button;
}

function wireCopy(button: HTMLButtonElement, label: string, getText: () => string): void {
  button.dataset.action = 'copy';
  on(button, 'click', () => {
    void copyText(getText()).then((ok) => {
      if (!ok) return;
      button.dataset.copied = 'true';
      button.innerHTML = ICON_CHECK;
      button.setAttribute('aria-label', 'Copiado');
      window.setTimeout(() => {
        button.dataset.copied = 'false';
        button.innerHTML = ICON_COPY;
        button.setAttribute('aria-label', label);
      }, 1600);
    });
  });
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

    const copyButton = actionButton(BLOCK_LABEL, ICON_COPY);
    wireCopy(copyButton, BLOCK_LABEL, () => stripPrompts(pre.textContent ?? ''));
    actions.appendChild(copyButton);

    toolbar.appendChild(actions);
    pre.parentNode?.insertBefore(wrap, pre);
    wrap.appendChild(toolbar);
    wrap.appendChild(pre);
  }

  // Quick command inline: el párrafo es exactamente un <code>.
  for (const heading of queryAll<HTMLElement>('.prose h2, .prose h3')) {
    if (!/quick command/i.test(heading.textContent ?? '')) continue;

    const paragraph = heading.nextElementSibling;
    if (!(paragraph instanceof HTMLParagraphElement)) continue;

    const code = paragraph.querySelector('code');
    if (!code) continue;
    if ((paragraph.textContent ?? '').trim() !== (code.textContent ?? '').trim()) continue;

    const copyButton = actionButton(COMMAND_LABEL, ICON_COPY, 'quick-copy');
    wireCopy(copyButton, COMMAND_LABEL, () => code.textContent ?? '');
    paragraph.append(copyButton);
  }
}
