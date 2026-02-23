import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
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
import { GenerateNode } from "./nodes/GenerateNode";
import { MediaBrowser } from "./MediaBrowser";
import type { SourceNodeData, SubtitleNodeData, PreviewNodeData, GenerateNodeData, EditorProject, WorkflowData } from "./editorTypes";

// Module-scope nodeTypes to avoid remounting on every render
const nodeTypes: NodeTypes = {
  source: SourceNode,
  subtitle: SubtitleNode,
  preview: PreviewNode,
  generate: GenerateNode,
  "generate-image": GenerateNode,
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

// ── Save as Skill Dialog ─────────────────────────────────────

interface SaveAsSkillDialogProps {
  open: boolean;
  onClose: () => void;
  nodes: Node[];
  edges: Edge[];
  templateId?: string; // 기존 템플릿 업데이트 시
}

function SaveAsSkillDialog({ open, onClose, nodes, edges, templateId }: SaveAsSkillDialogProps) {
  const { getViewport } = useReactFlow();
  const fetcher = useFetcher();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<"video" | "image">("video");
  const prevState = useRef(fetcher.state);

  // Close on successful save
  useEffect(() => {
    if (prevState.current === "loading" && fetcher.state === "idle" && fetcher.data) {
      const data = fetcher.data as { success?: boolean };
      if (data.success) {
        setName("");
        onClose();
      }
    }
    prevState.current = fetcher.state;
  }, [fetcher.state, fetcher.data, onClose]);

  if (!open) return null;

  const handleSave = () => {
    if (!name.trim()) return;
    fetcher.submit(
      {
        id: templateId || "",
        name: name.trim(),
        category,
        nodes: JSON.stringify(nodes),
        edges: JSON.stringify(edges),
        viewport: JSON.stringify(getViewport()),
      },
      { method: "POST", action: "/api/workflow-templates", encType: "application/json" }
    );
  };

  const isSaving = fetcher.state !== "idle";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-[#1a1a1a] border border-white/10 rounded-xl p-6 w-80 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-white text-sm font-semibold mb-4">Save as Skill</h3>

        <label className="block text-white/50 text-xs mb-1">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My Workflow"
          autoFocus
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-white/30 mb-3"
          onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
        />

        <label className="block text-white/50 text-xs mb-1">Category</label>
        <div className="flex gap-2 mb-4">
          {(["video", "image"] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                category === c
                  ? "bg-white/15 text-white border border-white/20"
                  : "bg-white/5 text-white/40 border border-transparent hover:bg-white/10"
              }`}
            >
              {c === "video" ? "Video" : "Image"}
            </button>
          ))}
        </div>

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs text-white/50 hover:text-white/80 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || isSaving}
            className="px-4 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 transition-colors cursor-pointer"
          >
            {isSaving ? "Saving..." : templateId ? "Update" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Editor Toolbar ───────────────────────────────────────────

function EditorToolbar({ onSaveAsSkill }: { onSaveAsSkill: () => void }) {
  return (
    <div className="flex gap-2">
      <button
        onClick={onSaveAsSkill}
        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/8 text-white/70 border border-white/10 hover:bg-white/15 hover:text-white transition-colors cursor-pointer"
      >
        Save as Skill
      </button>
      <a
        href="/"
        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/8 text-white/70 border border-white/10 hover:bg-white/15 hover:text-white transition-colors"
      >
        Home
      </a>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────

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

  // Save as Skill dialog state
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);

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
        <Panel position="top-right">
          <EditorToolbar onSaveAsSkill={() => setSaveDialogOpen(true)} />
        </Panel>
        <AutoSave nodes={nodes} edges={edges} sourceGenerationId={sourceGenerationId} />
      </ReactFlow>

      <MediaBrowser
        open={mediaBrowserNodeId !== null}
        onClose={() => setMediaBrowserNodeId(null)}
        onSelect={handleMediaSelect}
      />

      <SaveAsSkillDialog
        open={saveDialogOpen}
        onClose={() => setSaveDialogOpen(false)}
        nodes={nodes}
        edges={edges}
        templateId={workflowData?.source === "template" ? workflowData.templateId : undefined}
      />
    </>
  );
}
