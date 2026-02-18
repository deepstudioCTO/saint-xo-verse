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
