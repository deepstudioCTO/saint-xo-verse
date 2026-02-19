import { useState, useCallback, useEffect, useRef } from "react";
import { useGesture } from "@use-gesture/react";
import type { Persona, Look } from "~/lib/data";

interface UsePersonaNavigationParams {
  personaList: Persona[];
  selectedId: string | null;
  currentLookbookId: string;
  currentLookId: string;
  isSelecting: boolean;
  isDragging: boolean;
  lookList: Look[];
  personasByLook: Record<string, Persona[]>;
  setSearchParams: (params: Record<string, string>) => void;
  onLookTransition: (direction: number) => void;
}

export function usePersonaNavigation({
  personaList,
  selectedId,
  currentLookbookId,
  currentLookId,
  isSelecting,
  isDragging,
  lookList,
  personasByLook,
  setSearchParams,
  onLookTransition,
}: UsePersonaNavigationParams) {
  const [hoveredCharacterId, setHoveredCharacterId] = useState<string | null>(null);

  const navigatePersona = useCallback((direction: "prev" | "next") => {
    const idx = personaList.findIndex((c) => c.characterId === selectedId);
    if (idx < 0) return;
    const newIdx = direction === "prev" ? idx - 1 : idx + 1;

    if (newIdx >= 0 && newIdx < personaList.length) {
      // Navigate within current look
      setSearchParams({
        selected: personaList[newIdx].characterId,
        lookbook: currentLookbookId,
        look: currentLookId,
      });
      return;
    }

    // Cross-look boundary navigation
    const currentLookIdx = lookList.findIndex((l) => l.id === currentLookId);
    if (currentLookIdx < 0) return;

    if (direction === "prev" && newIdx < 0 && currentLookIdx > 0) {
      // Go to previous look's last persona
      const prevLook = lookList[currentLookIdx - 1];
      const prevPersonas = personasByLook[prevLook.id] || [];
      if (prevPersonas.length === 0) return;
      onLookTransition(-1);
      setSearchParams({
        selected: prevPersonas[prevPersonas.length - 1].characterId,
        lookbook: currentLookbookId,
        look: prevLook.id,
      });
    } else if (direction === "next" && newIdx >= personaList.length && currentLookIdx < lookList.length - 1) {
      // Go to next look's first persona
      const nextLook = lookList[currentLookIdx + 1];
      const nextPersonas = personasByLook[nextLook.id] || [];
      if (nextPersonas.length === 0) return;
      onLookTransition(1);
      setSearchParams({
        selected: nextPersonas[0].characterId,
        lookbook: currentLookbookId,
        look: nextLook.id,
      });
    }
    // At lookbook boundary (first look first persona / last look last persona) → do nothing
  }, [personaList, selectedId, currentLookbookId, currentLookId, lookList, personasByLook, setSearchParams, onLookTransition]);

  // Keyboard ←→ for persona navigation
  useEffect(() => {
    if (!isSelecting) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        navigatePersona("prev");
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        navigatePersona("next");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isSelecting, navigatePersona]);

  // Swipe (touch/mouse drag) + trackpad scroll for persona navigation
  const charNavRef = useRef<HTMLDivElement>(null);
  const gestureActive = useRef(false);
  useGesture(
    {
      onDrag: ({ active, movement: [mx], direction: [dx], cancel }) => {
        if (!isSelecting || isDragging) return;
        if (active && Math.abs(mx) > 50) {
          cancel();
          navigatePersona(dx > 0 ? "prev" : "next");
        }
      },
      onWheel: ({ event, direction: [dx], distance: [distX, distY] }) => {
        if (!isSelecting || distX < distY) return;
        event.preventDefault();
        if (gestureActive.current) return;
        if (distX > 60) {
          gestureActive.current = true;
          navigatePersona(dx > 0 ? "next" : "prev");
          setTimeout(() => { gestureActive.current = false; }, 250);
        }
      },
    },
    {
      target: charNavRef,
      drag: { axis: "x", filterTaps: true },
      wheel: { eventOptions: { passive: false } },
    },
  );

  return {
    hoveredCharacterId,
    setHoveredCharacterId,
    navigatePersona,
    charNavRef,
  };
}
