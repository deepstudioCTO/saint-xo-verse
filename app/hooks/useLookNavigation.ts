import { useCallback, useEffect } from "react";
import type { Look } from "~/lib/data";

interface UseLookNavigationParams {
  lookList: Look[];
  currentLookIndex: number;
  currentLookbookId: string;
  isSelecting: boolean;
  setSearchParams: (params: Record<string, string>, options?: { replace?: boolean }) => void;
  onTransition: (direction: number) => void;
}

export function useLookNavigation({
  lookList,
  currentLookIndex,
  currentLookbookId,
  isSelecting,
  setSearchParams,
  onTransition,
}: UseLookNavigationParams) {
  const handleLookChange = useCallback((direction: "prev" | "next") => {
    const newIndex = direction === "prev"
      ? currentLookIndex - 1
      : currentLookIndex + 1;
    if (newIndex < 0 || newIndex >= lookList.length) return;

    onTransition(direction === "next" ? 1 : -1);
    setSearchParams(
      { lookbook: currentLookbookId, look: lookList[newIndex].id },
      { replace: true }
    );
  }, [currentLookIndex, lookList, currentLookbookId, setSearchParams, onTransition]);

  // Keyboard ←→ for look navigation (only when NOT selecting a persona)
  useEffect(() => {
    if (isSelecting || lookList.length <= 1) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        handleLookChange("prev");
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleLookChange("next");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isSelecting, lookList, handleLookChange]);

  return { handleLookChange };
}
