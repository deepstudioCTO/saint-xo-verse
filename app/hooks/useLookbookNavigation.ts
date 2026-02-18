import { useCallback, useEffect } from "react";
import type { Lookbook } from "~/lib/data";

interface UseLookbookNavigationParams {
  lookbookList: Lookbook[];
  currentLookbookIndex: number;
  setSearchParams: (params: Record<string, string>, options?: { replace?: boolean }) => void;
  onTransition: (direction: number) => void;
}

export function useLookbookNavigation({ lookbookList, currentLookbookIndex, setSearchParams, onTransition }: UseLookbookNavigationParams) {
  const handleLookbookChange = useCallback((direction: "up" | "down") => {
    const newIndex = direction === "up"
      ? currentLookbookIndex - 1
      : currentLookbookIndex + 1;
    if (newIndex < 0 || newIndex >= lookbookList.length) return;

    onTransition(direction === "down" ? 1 : -1);
    setSearchParams({ lookbook: lookbookList[newIndex].id }, { replace: true });
  }, [currentLookbookIndex, lookbookList, setSearchParams, onTransition]);

  // Keyboard ↑↓ for lookbook navigation
  useEffect(() => {
    if (lookbookList.length <= 1) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp") {
        e.preventDefault();
        handleLookbookChange("up");
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        handleLookbookChange("down");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lookbookList, handleLookbookChange]);

  return { handleLookbookChange };
}
