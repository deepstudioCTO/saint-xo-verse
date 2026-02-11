import { useState, useRef, useCallback, type RefObject } from "react";

interface UseInlineEditOptions {
  /** Called with trimmed value on save. Return false to indicate save failure. */
  onSave: (value: string) => Promise<void>;
  /** If true, treat empty string as "no change" (skip save). Default: true */
  rejectEmpty?: boolean;
  /** Allow multi-line (Shift+Enter for newline, Enter to save). Default: false */
  multiline?: boolean;
}

interface UseInlineEditReturn<E extends HTMLInputElement | HTMLTextAreaElement> {
  ref: RefObject<E | null>;
  isEditing: boolean;
  value: string;
  isSaving: boolean;
  setValue: (v: string) => void;
  startEdit: (initialValue: string) => void;
  cancel: () => void;
  save: () => void;
  keyDown: (e: React.KeyboardEvent) => void;
}

export function useInlineEdit<E extends HTMLInputElement | HTMLTextAreaElement = HTMLInputElement>(
  options: UseInlineEditOptions
): UseInlineEditReturn<E> {
  const { onSave, rejectEmpty = true, multiline = false } = options;
  const ref = useRef<E | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const originalRef = useRef("");

  const startEdit = useCallback((initialValue: string) => {
    originalRef.current = initialValue;
    setValue(initialValue);
    setIsEditing(true);
    setTimeout(() => ref.current?.focus(), 0);
  }, []);

  const cancel = useCallback(() => {
    setIsEditing(false);
  }, []);

  const save = useCallback(async () => {
    if (isSaving) return;
    const trimmed = value.trim();

    // No change or empty rejection
    if (trimmed === originalRef.current || (rejectEmpty && trimmed.length === 0)) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(trimmed);
      setIsEditing(false);
    } catch (error) {
      console.error("Inline edit save error:", error);
      alert(error instanceof Error ? error.message : "Update failed");
    } finally {
      setIsSaving(false);
    }
  }, [value, isSaving, onSave, rejectEmpty]);

  const keyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        cancel();
      } else if (e.key === "Enter") {
        if (multiline && e.shiftKey) return; // allow newline
        e.preventDefault();
        save();
      }
    },
    [cancel, save, multiline]
  );

  return { ref, isEditing, value, isSaving, setValue, startEdit, cancel, save, keyDown };
}
