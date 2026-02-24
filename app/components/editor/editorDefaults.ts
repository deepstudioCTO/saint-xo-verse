import type { Node, Edge, NodeTypes } from "@xyflow/react";
import { SourceNode } from "./nodes/SourceNode";
import { SubtitleNode } from "./nodes/SubtitleNode";
import { PreviewNode } from "./nodes/PreviewNode";
import { GenerateNode } from "./nodes/GenerateNode";
import type { SourceNodeData, SubtitleNodeData, PreviewNodeData } from "./editorTypes";

// Module-scope nodeTypes to avoid remounting on every render
export const nodeTypes: NodeTypes = {
  source: SourceNode,
  subtitle: SubtitleNode,
  preview: PreviewNode,
  generate: GenerateNode,
  "generate-image": GenerateNode,
};

export const defaultEdgeOptions = {
  type: "default",
  style: { stroke: "#444", strokeWidth: 1.5 },
};

export const emptyNodes: Node[] = [
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

export const emptyEdges: Edge[] = [
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
