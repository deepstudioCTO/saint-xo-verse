import { useEffect, useRef } from "react";
import { useReactFlow, type Node, type Edge } from "@xyflow/react";
import { useFetcher } from "react-router";

interface AutoSaveProps {
  nodes: Node[];
  edges: Edge[];
}

export function AutoSave({ nodes, edges }: AutoSaveProps) {
  const { getViewport } = useReactFlow();
  const fetcher = useFetcher();
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isFirstRender = useRef(true);
  const hasCleanedUrl = useRef(false);

  useEffect(() => {
    // Skip saving on first render (initial load)
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      fetcher.submit(
        {
          id: "default",
          nodes: JSON.stringify(nodes),
          edges: JSON.stringify(edges),
          viewport: JSON.stringify(getViewport()),
        },
        { method: "PUT", action: "/api/editor-save", encType: "application/json" }
      );
    }, 2000);
    return () => clearTimeout(timerRef.current);
  }, [nodes, edges]);

  // Strip URL params after first successful save (refresh will load from DB)
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data && !hasCleanedUrl.current) {
      const data = fetcher.data as { success?: boolean; error?: string };
      if (data.success) {
        hasCleanedUrl.current = true;
        window.history.replaceState(null, "", "/editor");
      } else if (data.error) {
        console.warn("[AutoSave] Save failed:", data.error);
      }
    }
  }, [fetcher.state, fetcher.data]);

  return null;
}
