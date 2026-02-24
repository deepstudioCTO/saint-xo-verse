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
  addEdge,
  type Node,
  type OnConnect,
} from "@xyflow/react";
import type { SourceNodeData, EditorEntryData } from "./editorTypes";
import { nodeTypes, defaultEdgeOptions, emptyNodes, emptyEdges } from "./editorDefaults";
import { AutoSave } from "./AutoSave";
import { SaveAsSkillDialog } from "./SaveAsSkillDialog";
import { MediaBrowser } from "./MediaBrowser";

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

interface EditorCanvasProps {
  entryData: EditorEntryData;
}

export function EditorCanvas({ entryData }: EditorCanvasProps) {
  return (
    <ReactFlowProvider>
      <EditorCanvasInner entryData={entryData} />
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
