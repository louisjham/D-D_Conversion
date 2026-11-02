import { useEffect, useCallback, useRef } from 'react';

export interface ShortcutBinding {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: () => void;
  description: string;
}

/**
 * Global keyboard shortcut manager.
 * Bindings are registered declaratively and fire in order.
 * Only fires when no input/textarea is focused (unless overridden).
 */
export function useKeyboardShortcuts(bindings: ShortcutBinding[]) {
  const bindingsRef = useRef(bindings);
  bindingsRef.current = bindings;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    const isInputFocused =
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable;

    for (const binding of bindingsRef.current) {
      const ctrlMatch = binding.ctrl ? (e.ctrlKey || e.metaKey) : !(e.ctrlKey || e.metaKey);
      const shiftMatch = binding.shift ? e.shiftKey : !e.shiftKey;
      const altMatch = binding.alt ? e.altKey : !e.altKey;

      if (
        e.key.toLowerCase() === binding.key.toLowerCase() &&
        ctrlMatch &&
        shiftMatch &&
        altMatch
      ) {
        // Allow Ctrl+key shortcuts even when input is focused
        if (isInputFocused && !binding.ctrl) continue;

        e.preventDefault();
        e.stopPropagation();
        binding.handler();
        return;
      }
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
