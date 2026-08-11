export interface GenericElement {
  tagName?: string;
  isContentEditable?: boolean;
  readOnly?: boolean;
  type?: string;
}

export function isTextEditingTarget(el: GenericElement | null = typeof document !== "undefined" ? document.activeElement : null): boolean {
  if (!el) return false;
  if (el.isContentEditable) return true;

  const tag = (el.tagName || "").toUpperCase();
  if (tag === "TEXTAREA") {
    return !el.readOnly;
  }

  if (tag === "INPUT") {
    const textTypes = new Set(["text", "search", "email", "url", "tel", "password", "number"]);
    const type = (el.type || "text").toLowerCase();
    return textTypes.has(type) && !el.readOnly;
  }

  return false;
}

export function shouldIgnoreKeyboardGameInput(
  el: GenericElement | null = typeof document !== "undefined" ? document.activeElement : null,
  isModalOpen: boolean = false
): boolean {
  if (isModalOpen) return true;
  return isTextEditingTarget(el);
}
