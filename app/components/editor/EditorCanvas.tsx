import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  addEdge,
  type Node,
  type Edge,
  type OnConnect,
  type NodeTypes,
  type Viewport,
} from "@xyflow/react";
import { useFetcher } from "react-router";
import { SourceNode } from "./nodes/SourceNode";
import { SubtitleNode } from "./nodes/SubtitleNode";
import { PreviewNode } from "./nodes/PreviewNode";
import { MediaBrowser } from "./MediaBrowser";
import type { SourceNodeData, SubtitleNodeData, PreviewNodeData, EditorProject, WorkflowData } from "./editorTypes";

// Module-scope nodeTypes to avoid remounting on every render
const nodeTypes: NodeTypes = {
  source: SourceNode,
  subtitle: SubtitleNode,
  preview: PreviewNode,
};

const defaultEdgeOptions = {
  type: "default",
  style: { stroke: "#444", strokeWidth: 1.5 },
};

const emptyNodes: Node[] = [
  {
    id: "source-1",
    type: "source",
    position: { x: 50, y: 100 },
    data: { label: "Source", media: null } satisfies SourceNodeData,
  },
  {
    id: "subtitle-1",
    type: "subtitle",
    position: { x: 330, y: 80 },
    data: { label: "Subtitles", entries: [] } satisfies SubtitleNodeData,
  },
  {
    id: "preview-1",
    type: "preview",
    position: { x: 730, y: 80 },
    data: { label: "Preview" } satisfies PreviewNodeData,
  },
];

const emptyEdges: Edge[] = [
  {
    id: "e-source-subtitle",
    source: "source-1",
    target: "subtitle-1",
    type: "default",
    style: { stroke: "#444", strokeWidth: 1.5 },
  },
  {
    id: "e-subtitle-preview",
    source: "subtitle-1",
    target: "preview-1",
    type: "default",
    style: { stroke: "#444", strokeWidth: 1.5 },
  },
];

interface EditorCanvasProps {
  savedProject?: EditorProject | null;
  initialMedia?: { type: "video" | "image"; url: string; name: string } | null;
  sourceGenerationId?: string;
  workflowData?: WorkflowData | null;
}

interface AutoSaveProps {
  nodes: Node[];
  edges: Edge[];
  sourceGenerationId?: string;
}

function AutoSave({ nodes, edges, sourceGenerationId }: AutoSaveProps) {
  const { getViewport } = useReactFlow();
  const fetcher = useFetcher();
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isFirstRender = useRef(true);
  const hasCleanedUrl = useRef(false);
  // Ref to avoid stale closure — always reads latest value in setTimeout
  const sourceGenIdRef = useRef(sourceGenerationId);
  sourceGenIdRef.current = sourceGenerationId;

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
          sourceGenerationId: sourceGenIdRef.current || "",
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

export function EditorCanvas({ savedProject, initialMedia, sourceGenerationId, workflowData }: EditorCanvasProps) {
  const { startNodes, startEdges, startViewport } = useMemo(() => {
    // workflowData > savedProject > initialMedia > empty
    // workflowData = user clicked Edit/template link → load into scratch
    if (workflowData) {
      try {
        const nodes = JSON.parse(workflowData.nodes) as Node[];
        const edges = JSON.parse(workflowData.edges) as Edge[];
        const viewport = workflowData.viewport ? JSON.parse(workflowData.viewport) as Viewport : undefined;
        // Ensure nodes have positions (workflow snapshots from 3-card may not have them)
        const nodesWithPositions = nodes.map((n, i) => ({
          ...n,
          position: n.position || { x: i * 280, y: 100 },
        }));
        if (nodesWithPositions.length > 0) {
          return { startNodes: nodesWithPositions, startEdges: edges, startViewport: viewport };
        }
      } catch {
        // Fall through to savedProject
      }
    }

    // savedProject > initialMedia > empty
    // URL params are stripped after first save, so on refresh initialMedia is null
    if (savedProject) {
      try {
        const nodes = JSON.parse(savedProject.nodes) as Node[];
        const edges = JSON.parse(savedProject.edges) as Edge[];
        const viewport = JSON.parse(savedProject.viewport) as Viewport;
        if (nodes.length > 0) {
          return { startNodes: nodes, startEdges: edges, startViewport: viewport };
        }
      } catch {
        // Fall through
      }
    }

    if (initialMedia) {
      const nodes = emptyNodes.map((n) =>
        n.id === "source-1"
          ? { ...n, data: { ...n.data, media: initialMedia } }
          : n
      );
      return { startNodes: nodes, startEdges: emptyEdges, startViewport: undefined };
    }

    return { startNodes: emptyNodes, startEdges: emptyEdges, startViewport: undefined };
  }, []);

  const [nodes, setNodes, onNodesChange] = useNodesState(startNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(startEdges);

  // Media browser state
  const [mediaBrowserNodeId, setMediaBrowserNodeId] = useState<string | null>(null);

  const onConnect: OnConnect = useCallback(
    (connection) => setEdges((eds) => addEdge({ ...connection, ...defaultEdgeOptions }, eds)),
    [setEdges]
  );

  // Handle clicks inside nodes (for SourceNode "open-media-browser")
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (node.type === "source") {
      setMediaBrowserNodeId(node.id);
    }
  }, []);

  const handleMediaSelect = useCallback((media: NonNullable<SourceNodeData["media"]>) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === mediaBrowserNodeId
          ? { ...n, data: { ...n.data, media } }
          : n
      )
    );
    setMediaBrowserNodeId(null);
  }, [mediaBrowserNodeId, setNodes]);

  const useFitView = !startViewport;

  return (
    <>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        colorMode="dark"
        fitView={useFitView}
        fitViewOptions={{ padding: 0.3 }}
        defaultViewport={startViewport}
        className="bg-[#0d0d0d]"
      >
        <Background gap={20} size={1} color="#1a1a1a" />
        <Controls
          showInteractive={false}
          className="!bg-[#1a1a1a] !border-white/[0.08] !shadow-md [&>button]:!bg-[#1a1a1a] [&>button]:!border-white/[0.08] [&>button]:!fill-white/50 [&>button:hover]:!bg-white/[0.08]"
        />
        <MiniMap
          nodeStrokeColor="#333"
          nodeColor="#2a2a2a"
          nodeBorderRadius={8}
          maskColor="rgba(13,13,13,0.75)"
          className="!bg-[#1a1a1a] !border-white/[0.08]"
        />
        <AutoSave nodes={nodes} edges={edges} sourceGenerationId={sourceGenerationId} />
      </ReactFlow>

      <MediaBrowser
        open={mediaBrowserNodeId !== null}
        onClose={() => setMediaBrowserNodeId(null)}
        onSelect={handleMediaSelect}
      />
    </>
  );
}
