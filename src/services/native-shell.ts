/**
 * Behaviours a desktop app has and a web page does not: no browser context menu on the chrome of
 * the window, nothing to drag out of it by accident. Text fields keep both (copy, paste, spelling).
 */

const EDITABLE =
  'input:not([type="range"]):not([type="checkbox"]):not([type="radio"]), textarea, [contenteditable="true"]';

/** True where a person types text: there the browser's own menu is useful and stays. */
export function isEditable(target: EventTarget | null): boolean {
  const element = target as Partial<Element> | null;
  return typeof element?.closest === 'function' && element.closest(EDITABLE) !== null;
}

/** Installs the behaviours on a document. Returns the function that removes them again. */
export function installNativeShell(doc: Document = document): () => void {
  const onContextMenu = (event: MouseEvent): void => {
    if (!isEditable(event.target)) event.preventDefault();
  };
  const onDragStart = (event: DragEvent): void => {
    if (!isEditable(event.target)) event.preventDefault();
  };
  doc.addEventListener('contextmenu', onContextMenu);
  doc.addEventListener('dragstart', onDragStart);
  return () => {
    doc.removeEventListener('contextmenu', onContextMenu);
    doc.removeEventListener('dragstart', onDragStart);
  };
}
