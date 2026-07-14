import type { Node, Edge, NodeTypes } from "@xyflow/react";
import { SourceNode } from "./nodes/SourceNode";
import { SubtitleNode } from "./nodes/SubtitleNode";
import { PreviewNode } from "./nodes/PreviewNode";
import { GenerateNode } from "./nodes/GenerateNode";
import { UpscaleNode } from "./nodes/UpscaleNode";
import type { SourceNodeData, SubtitleNodeData, PreviewNodeData } from "./editorTypes";

// Module-scope nodeTypes to avoid remounting on every render
export const nodeTypes: NodeTypes = {
  source: SourceNode,
  subtitle: SubtitleNode,
  preview: PreviewNode,
  generate: GenerateNode,
  "generate-image": GenerateNode,
  upscale: UpscaleNode,
};

export const defaultEdgeOptions = {
  type: "default",
  style: { stroke: "#444", strokeWidth: 1.5 },
};

// ── 팔레트: 추가 가능한 노드 6종 ──────────────────────────────
export interface PaletteItem {
  type: string;
  label: string;
  makeData: () => Record<string, unknown>;
}

export const PALETTE: PaletteItem[] = [
  { type: "source", label: "Source", makeData: () => ({ label: "Source", media: null }) },
  { type: "generate-image", label: "이미지 생성", makeData: () => ({ label: "Image Gen", generateType: "generate-image", prompt: "" }) },
  { type: "generate", label: "영상 생성", makeData: () => ({ label: "Video Gen", generateType: "generate" }) },
  { type: "upscale", label: "업스케일", makeData: () => ({ label: "Upscale", model: "topaz", resolution: "2K" }) },
  { type: "subtitle", label: "자막", makeData: () => ({ label: "Subtitles", entries: [] }) },
  { type: "preview", label: "Preview", makeData: () => ({ label: "Preview" }) },
];

let nodeSeq = 0;
export function makeNode(item: PaletteItem, position: { x: number; y: number }): Node {
  nodeSeq += 1;
  return {
    id: `${item.type}-${Date.now()}-${nodeSeq}`,
    type: item.type,
    position,
    data: item.makeData(),
  };
}

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
