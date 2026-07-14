import type { Node, Edge, Viewport } from "@xyflow/react";

export interface SourceNodeData {
  [key: string]: unknown;
  label: string;
  media: {
    type: "video" | "image";
    url: string;
    thumbnailUrl?: string;
    name: string;
  } | null;
}

export interface SubtitleEntry {
  id: string;
  start: string;
  end: string;
  text: string;
}

export interface SubtitleNodeData {
  [key: string]: unknown;
  label: string;
  entries: SubtitleEntry[];
}

export interface PreviewNodeData {
  [key: string]: unknown;
  label: string;
}

export interface GenerateNodeData {
  [key: string]: unknown;
  label: string;
  /** "generate" for video, "generate-image" for image */
  generateType: "generate" | "generate-image";
  /** Active workflow run ID (set after triggering generation) */
  runId?: string;
  /** Current generation status */
  status?: "idle" | "pending" | "processing" | "completed" | "failed";
  /** Output media after completion */
  output?: { url: string; type: "video" | "image" } | null;
  /** Error message on failure */
  error?: string | null;
  /** Prompt for image generation */
  prompt?: string;
}

export interface UpscaleNodeData {
  [key: string]: unknown;
  label: string;
  /** 업스케일 모델 */
  model: "real-esrgan" | "topaz";
  /** 목표 해상도 */
  resolution: "2K" | "4K";
  status?: "idle" | "pending" | "processing" | "completed" | "failed";
  output?: { url: string; type: "video" | "image" } | null;
  error?: string | null;
}

export interface EditorProject {
  id: string;
  name: string;
  nodes: string;
  edges: string;
  viewport: string;
  sourceGenerationId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ── Workflow System Types ──────────────────────────────────

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  nodes: string;
  edges: string;
  viewport: string | null;
  thumbnailUrl: string | null;
  currentVersion: number;
  isPublished: boolean | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowRun {
  id: string;
  templateId: string | null;
  templateVersion: number | null;
  templateSnapshot: string;
  inputs: string;
  outputs: string | null;
  status: string;
  error: string | null;
  startedAt: Date;
  completedAt: Date | null;
}

export interface NodeRun {
  id: string;
  runId: string;
  nodeId: string;
  nodeType: string;
  inputs: string;
  outputs: string | null;
  status: string;
  error: string | null;
  externalId: string | null;
  externalProvider: string | null;
  legacyGenerationId: string | null;
  startedAt: Date;
  completedAt: Date | null;
}

// ── Editor Entry Data (discriminated union from loader) ───

export interface GraphData {
  nodes: Node[];
  edges: Edge[];
  viewport?: Viewport;
}

export type EditorEntryData =
  | { mode: "run"; graph: GraphData; runId: string }
  | { mode: "template"; graph: GraphData; templateId: string; templateMeta: { name: string; category: string | null } }
  | { mode: "scratch"; graph: GraphData }
  | { mode: "empty" };
