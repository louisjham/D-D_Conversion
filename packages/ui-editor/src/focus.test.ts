import { describe, it, expect } from "vitest";
import { isTextEditingTarget, shouldIgnoreKeyboardGameInput } from "./inputFocusGuard";

describe("Input Focus Isolation & Guard Unit Tests", () => {
  it("1. Returns true for HTMLInputElement with text types", () => {
    const input = { tagName: "INPUT", type: "text", readOnly: false };
    expect(isTextEditingTarget(input)).toBe(true);

    const passwordInput = { tagName: "INPUT", type: "password", readOnly: false };
    expect(isTextEditingTarget(passwordInput)).toBe(true);
  });

  it("2. Returns false for readonly input fields", () => {
    const readonlyInput = { tagName: "INPUT", type: "text", readOnly: true };
    expect(isTextEditingTarget(readonlyInput)).toBe(false);
  });

  it("3. Returns true for HTMLTextAreaElement", () => {
    const textarea = { tagName: "TEXTAREA", readOnly: false };
    expect(isTextEditingTarget(textarea)).toBe(true);
  });

  it("4. Returns true for contenteditable elements", () => {
    const div = { tagName: "DIV", isContentEditable: true };
    expect(isTextEditingTarget(div)).toBe(true);
  });

  it("5. Returns false for non-editable buttons, divs, or canvas elements", () => {
    const button = { tagName: "BUTTON" };
    const div = { tagName: "DIV", isContentEditable: false };
    const canvas = { tagName: "CANVAS" };

    expect(isTextEditingTarget(button)).toBe(false);
    expect(isTextEditingTarget(div)).toBe(false);
    expect(isTextEditingTarget(canvas)).toBe(false);
  });

  it("6. shouldIgnoreKeyboardGameInput returns true when modal is open even for button focus", () => {
    const button = { tagName: "BUTTON" };
    expect(shouldIgnoreKeyboardGameInput(button, true)).toBe(true);
  });
});
