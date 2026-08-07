import { useCallback, useMemo, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  useReactFlow,
  addEdge,
  type Node,
  type OnConnect,
} from "@xyflow/react";
import type { SourceNodeData, EditorEntryData } from "./editorTypes";
import { nodeTypes, defaultEdgeOptions, emptyNodes, emptyEdges, PALETTE, makeNode } from "./editorDefaults";
import { AutoSave } from "./AutoSave";
import { SaveAsSkillDialog } from "./SaveAsSkillDialog";
import { MediaBrowser } from "./MediaBrowser";
import { WorkflowRunProvider, useWorkflowRun } from "./workflowRun";

// ── Node Palette ─────────────────────────────────────────────

function NodePalette({ onAdd }: { onAdd: (item: (typeof PALETTE)[number]) => void }) {
  return (
    <div className="flex flex-col gap-1 bg-[#1a1a1a]/90 backdrop-blur border border-white/[0.08] rounded-lg p-1.5">
      <span className="text-[9px] font-semibold tracking-wider uppercase text-white/40 px-1 pb-0.5">노드 추가</span>
      {PALETTE.map((item) => (
        <button
          key={item.type}
          onClick={() => onAdd(item)}
          className="text-left px-2 py-1 rounded text-[11px] text-white/70 hover:bg-white/[0.1] hover:text-white transition-colors cursor-pointer"
        >
          + {item.label}
        </button>
      ))}
    </div>
  );
}

// ── Run controls ─────────────────────────────────────────────

function RunControls({
  nodes,
  edges,
  templateId,
}: {
  nodes: Node[];
  edges: import("@xyflow/react").Edge[];
  templateId?: string;
}) {
  const { start, isRunning, runStatus, error } = useWorkflowRun();
  return (
    <div className="flex items-center gap-2">
      {runStatus === "completed" && <span className="text-[11px] text-emerald-400">완료</span>}
      {runStatus === "failed" && (
        <span className="text-[11px] text-red-400 max-w-[200px] truncate" title={error || undefined}>
          실패: {error}
        </span>
      )}
      <button
        onClick={() => start(nodes, edges, templateId)}
        disabled={isRunning}
        className={`px-4 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-colors cursor-pointer ${
          isRunning
            ? "bg-blue-900/40 text-white/40 cursor-not-allowed"
            : "bg-blue-600 hover:bg-blue-500 text-white"
        }`}
      >
        {isRunning ? "실행 중…" : "▶ Run"}
      </button>
    </div>
  );
}

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

interface EditorCanvasProps {
  entryData: EditorEntryData;
}

export function EditorCanvas({ entryData }: EditorCanvasProps) {
  return (
    <ReactFlowProvider>
      <WorkflowRunProvider>
        <EditorCanvasInner entryData={entryData} />
      </WorkflowRunProvider>
    </ReactFlowProvider>
  );
}

function EditorCanvasInner({ entryData }: EditorCanvasProps) {
  const { startNodes, startEdges, startViewport, templateId, templateMeta } = useMemo(() => {
    if (entryData.mode === "empty") {
      return { startNodes: emptyNodes, startEdges: emptyEdges, startViewport: undefined, templateId: undefined, templateMeta: undefined };
    }
    return {
      startNodes: entryData.graph.nodes,
      startEdges: entryData.graph.edges,
      startViewport: entryData.graph.viewport,
      templateId: entryData.mode === "template" ? entryData.templateId : undefined,
      templateMeta: entryData.mode === "template" ? entryData.templateMeta : undefined,
    };
  }, []);

  const [nodes, setNodes, onNodesChange] = useNodesState(startNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(startEdges);
  const { screenToFlowPosition } = useReactFlow();

  const [mediaBrowserNodeId, setMediaBrowserNodeId] = useState<string | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);

  const onConnect: OnConnect = useCallback(
    (connection) => setEdges((eds) => addEdge({ ...connection, ...defaultEdgeOptions }, eds)),
    [setEdges]
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (node.type === "source") {
      setMediaBrowserNodeId(node.id);
    }
  }, []);

  const handleMediaSelect = useCallback(
    (media: NonNullable<SourceNodeData["media"]>) => {
      setNodes((nds) => nds.map((n) => (n.id === mediaBrowserNodeId ? { ...n, data: { ...n.data, media } } : n)));
      setMediaBrowserNodeId(null);
    },
    [mediaBrowserNodeId, setNodes]
  );

  const handleAddNode = useCallback(
    (item: (typeof PALETTE)[number]) => {
      // 화면 중앙 근처 + 약간의 지터로 겹침 방지
      const center = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
      setNodes((nds) => [
        ...nds,
        makeNode(item, { x: center.x + (nds.length % 6) * 30, y: center.y + (nds.length % 6) * 30 }),
      ]);
    },
    [screenToFlowPosition, setNodes]
  );

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
        <Panel position="top-left">
          <NodePalette onAdd={handleAddNode} />
        </Panel>
        <Panel position="top-right">
          <div className="flex items-center gap-3">
            <RunControls nodes={nodes} edges={edges} templateId={templateId} />
            <EditorToolbar onSaveAsSkill={() => setSaveDialogOpen(true)} />
          </div>
        </Panel>
        <AutoSave nodes={nodes} edges={edges} />
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
        templateId={templateId}
        templateMeta={templateMeta}
      />
    </>
  );
}
