import { useEffect, useRef } from "react";
import type { Persona } from "~/lib/data";

export function usePreloadPosters(allPersonas: Persona[]) {
  const preloadedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const images: HTMLImageElement[] = [];
    for (const p of allPersonas) {
      if (!p.poster || preloadedRef.current.has(p.poster)) continue;
      preloadedRef.current.add(p.poster);
      const img = new Image();
      img.src = p.poster;
      images.push(img);
    }
    return () => { for (const img of images) img.src = ""; };
  }, [allPersonas]);
}
