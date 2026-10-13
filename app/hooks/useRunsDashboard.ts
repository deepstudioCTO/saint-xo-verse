import { useEffect, useState } from "react";
import type { RunsDashboard } from "~/lib/workflow/runsDashboard";
import type { CompareGroup } from "~/lib/workflow/templateCompare";

export interface RunsDashboardData {
  dashboard: RunsDashboard;
  groups: CompareGroup[];
}

/**
 * `/api/runs-dashboard` 1회 fetch — Library 확장 패널의 Dashboard/Compare 탭이 공유.
 * 탭이 처음 열릴 때만 부르고(enabled), 패널을 다시 열면 새로 받는다.
 */
export function useRunsDashboard(enabled: boolean) {
  const [data, setData] = useState<RunsDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setError(null);
    fetch("/api/runs-dashboard")
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as RunsDashboardData;
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { data, error, loading: enabled && !data && !error };
}
