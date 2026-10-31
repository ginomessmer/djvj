export function requireElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`#${id} is missing from the page`);
  return element;
}
