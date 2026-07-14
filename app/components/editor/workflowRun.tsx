import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Node, Edge } from "@xyflow/react";
import type { OutputMap, NodeOutput } from "~/lib/workflow/types";

export interface NodeRunState {
  status: "pending" | "processing" | "completed" | "failed";
  output: NodeOutput | null;
  error: string | null;
}

/** Run 파라미터 컨텍스트 — Look 스타일 파라미터 주입 등 (P3-2) */
export interface RunOptions {
  lookId?: string;
  personaId?: string;
}

interface WorkflowRunValue {
  /** 그래프 전체 실행 시작 */
  start: (nodes: Node[], edges: Edge[], opts?: RunOptions) => void;
  isRunning: boolean;
  runStatus: "idle" | "pending" | "running" | "completed" | "failed";
  /** nodeId → 실행 상태 */
  nodeStates: Record<string, NodeRunState>;
  /** nodeId → 완료 산출물 (resolveUpstreamInputs용) */
  outputs: OutputMap;
  error: string | null;
}

const WorkflowRunContext = createContext<WorkflowRunValue | null>(null);

const POLL_MS = 6000;

export function WorkflowRunProvider({ children }: { children: React.ReactNode }) {
  const [runId, setRunId] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<WorkflowRunValue["runStatus"]>("idle");
  const [nodeStates, setNodeStates] = useState<Record<string, NodeRunState>>({});
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const start = useCallback(
    async (nodes: Node[], edges: Edge[], opts?: RunOptions) => {
      setError(null);
      setNodeStates({});
      setRunStatus("pending");

      const graph = {
        nodes: nodes.map((n) => ({ id: n.id, type: n.type, position: n.position, data: n.data })),
        edges: edges.map((e) => ({ source: e.source, target: e.target })),
      };

      try {
        const res = await fetch("/api/workflow-execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ graph, lookId: opts?.lookId, personaId: opts?.personaId }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          setError((j as { error?: string }).error || "실행 시작 실패");
          setRunStatus("failed");
          return;
        }
        const { runId: id } = (await res.json()) as { runId: string };
        setRunId(id);
        setRunStatus("running");
      } catch (err) {
        setError(String(err));
        setRunStatus("failed");
      }
    },
    []
  );

  // runId가 잡히면 폴링 시작
  useEffect(() => {
    if (!runId) return;
    stopPolling();

    const poll = async () => {
      try {
        const res = await fetch(`/api/workflow-execute?runId=${runId}`);
        if (!res.ok) return;
        const data = (await res.json()) as {
          status: string;
          nodeRuns: { nodeId: string; status: string; outputs: NodeOutput | null; error: string | null }[];
          error: string | null;
        };

        const next: Record<string, NodeRunState> = {};
        for (const nr of data.nodeRuns) {
          next[nr.nodeId] = {
            status: (nr.status as NodeRunState["status"]) || "pending",
            output: nr.outputs,
            error: nr.error,
          };
        }
        setNodeStates(next);

        if (data.status === "completed") {
          setRunStatus("completed");
          stopPolling();
        } else if (data.status === "failed") {
          setRunStatus("failed");
          setError(data.error || "실행 실패");
          stopPolling();
        } else {
          setRunStatus("running");
        }
      } catch {
        // 폴링 오류 무시
      }
    };

    poll();
    pollRef.current = setInterval(poll, POLL_MS);
    return stopPolling;
  }, [runId, stopPolling]);

  const outputs = useMemo<OutputMap>(() => {
    const map: OutputMap = {};
    for (const [nodeId, s] of Object.entries(nodeStates)) {
      if (s.status === "completed" && s.output) map[nodeId] = s.output;
    }
    return map;
  }, [nodeStates]);

  const value = useMemo<WorkflowRunValue>(
    () => ({
      start,
      isRunning: runStatus === "pending" || runStatus === "running",
      runStatus,
      nodeStates,
      outputs,
      error,
    }),
    [start, runStatus, nodeStates, outputs, error]
  );

  return <WorkflowRunContext.Provider value={value}>{children}</WorkflowRunContext.Provider>;
}

export function useWorkflowRun(): WorkflowRunValue {
  const ctx = useContext(WorkflowRunContext);
  if (!ctx) throw new Error("useWorkflowRun must be used within WorkflowRunProvider");
  return ctx;
}

/** 특정 노드의 실행 상태. 실행 이력이 없으면 null(=idle) */
export function useNodeRun(nodeId: string): NodeRunState | null {
  const { nodeStates } = useWorkflowRun();
  return nodeStates[nodeId] ?? null;
}
