/**
 * Helpers de DOM tipados.
 *
 * Centralizan `querySelector`/`querySelectorAll`/`addEventListener` para que
 * los módulos de cliente no repitan casts ni comprobaciones de nulidad.
 */

/** Primer elemento que coincide con `selector`, o `null`. */
export function query<T extends Element>(selector: string, scope: ParentNode = document): T | null {
  return scope.querySelector<T>(selector);
}

/** Todos los elementos que coinciden con `selector`, como array. */
export function queryAll<T extends Element>(selector: string, scope: ParentNode = document): T[] {
  return Array.from(scope.querySelectorAll<T>(selector));
}

/** Suscribe un handler con el tipo de evento esperado (`Event` por defecto). */
export function on<E extends Event = Event>(
  target: EventTarget,
  type: string,
  handler: (event: E) => void,
  options?: AddEventListenerOptions,
): void {
  target.addEventListener(type, handler as EventListener, options);
}
