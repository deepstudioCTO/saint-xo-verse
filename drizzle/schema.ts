import {
  boolean,
  integer,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const generations = pgTable("generations", {
  id: uuid("id").primaryKey().defaultRandom(),
  predictionId: text("prediction_id"),
  provider: text("provider").notNull().default("replicate"), // 'replicate' | 'higgsfield'
  type: text("type").notNull().default("video"), // 'video' | 'image'
  memberId: text("member_id"), // 선택한 멤버 ID
  musicId: text("music_id"), // 선택한 음악 ID
  motionVideoId: uuid("motion_video_id"), // 선택한 모션 비디오 ID
  conceptImageId: uuid("concept_image_id"), // 참조용 컨셉 이미지 ID (이미지 생성용)
  lookbookId: text("lookbook_id"), // lookbook ID (nullable for backward compat)
  lookId: text("look_id"), // look ID (nullable, 정밀 look 추적용)
  prompt: text("prompt"), // 이미지 생성 프롬프트
  resolution: text("resolution"), // '1K' | '2K' | '4K'
  imageUrl: text("image_url").notNull(),
  motionVideoUrl: text("motion_video_url"), // Replicate 모션 참조 영상
  motionPresetId: text("motion_preset_id"), // Higgsfield 프리셋 ID
  status: text("status").notNull().default("pending"), // pending/processing/completed/failed
  videoUrl: text("video_url"),
  outputUrl: text("output_url"), // 생성된 이미지 URL (이미지 생성용)
  outputStoragePath: text("output_storage_path"), // 이미지 Storage 경로
  storagePath: text("storage_path"), // Supabase Storage 경로 (영구 저장)
  duration: integer("duration"),
  errorMessage: text("error_message"),
  // Upscale fields
  upscaleStatus: text("upscale_status"), // pending/processing/completed/failed
  upscaleModel: text("upscale_model"), // 'real-esrgan' | 'topaz'
  upscalePredictionId: text("upscale_prediction_id"),
  upscaledVideoUrl: text("upscaled_video_url"),
  upscaledStoragePath: text("upscaled_storage_path"), // Supabase Storage path
  upscaleErrorMessage: text("upscale_error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => sql`now()`),
});

export const motionVideos = pgTable("motion_videos", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(), // 파일명 또는 자동 생성
  storagePath: text("storage_path").notNull(), // Supabase Storage 경로
  thumbnailPath: text("thumbnail_path"), // 썸네일 경로
  duration: real("duration").notNull(), // 영상 길이 (초)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const characterImages = pgTable("character_images", {
  id: uuid("id").primaryKey().defaultRandom(),
  characterId: text("character_id").notNull(), // "sumin", "rumi" 등
  variantId: text("variant_id").notNull(), // "default", "02", "03" 등
  storagePath: text("storage_path").notNull(), // Supabase Storage 경로
  publicUrl: text("public_url").notNull(), // Public URL for API access
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const conceptImages = pgTable("concept_images", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"), // 사용자 지정 이름 (선택)
  storagePath: text("storage_path").notNull(), // Supabase Storage 경로
  publicUrl: text("public_url").notNull(), // Public URL for API access
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const characters = pgTable("characters", {
  id: text("id").primaryKey(), // "sumin", "rumi" 등
  name: text("name").notNull(), // 영문 이름
  description: text("description").notNull(), // 설명
  video: text("video").notNull(), // 영상 경로
  poster: text("poster").notNull(), // 포스터 경로
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => sql`now()`),
});

export const lookbooks = pgTable("lookbooks", {
  id: text("id").primaryKey(), // "00", "01" 등
  name: text("name").notNull(), // "showcase", "ojos"
  displayName: text("display_name").notNull(), // "Showcase", "Ojos"
  description: text("description"), // lookbook 설명 (nullable)
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => sql`now()`),
});

export const looks = pgTable("looks", {
  id: text("id").primaryKey(), // "00_01"~"00_04", "01_01"
  lookbookId: text("lookbook_id").notNull(),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => sql`now()`),
});

/**
 * 생성 노드 파라미터 프리셋 (P3-2 재설계).
 * generate-image 노드의 파라미터 한 벌을 이름 붙여 저장/불러오기. 룩/페르소나에 강결합 안 함
 * — name에 룩 이름을 넣으면 "룩별 프리셋"이 된다. 계획서 "파라미터 세트를 재현가능 템플릿으로 공식화·재사용".
 */
export const stylePresets = pgTable("style_presets", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  model: text("model"), // "soul-reference" | "nano-banana"
  prompt: text("prompt"),
  stylePreset: text("style_preset"), // Soul style_id(uuid)
  styleStrength: real("style_strength"),
  seed: integer("seed"),
  aspectRatio: text("aspect_ratio"),
  resolution: text("resolution"),
  batchSize: integer("batch_size"),
  enhancePrompt: boolean("enhance_prompt"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => sql`now()`),
});

export const editorProjects = pgTable("editor_projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull().default("Untitled Project"),
  nodes: text("nodes").notNull().default("[]"),
  edges: text("edges").notNull().default("[]"),
  viewport: text("viewport").notNull().default('{"x":0,"y":0,"zoom":1}'),
  sourceGenerationId: text("source_generation_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => sql`now()`),
});

export const personas = pgTable("personas", {
  id: uuid("id").primaryKey().defaultRandom(),
  lookId: text("look_id").notNull(), // "00_01", "00_02" 등
  characterId: text("character_id").notNull(), // "sumin", "rumi"
  name: text("name").notNull(), // look별 페르소나 이름
  description: text("description").notNull(), // look별 설명
  video: text("video").notNull(), // look별 영상 경로
  poster: text("poster").notNull(), // look별 포스터 경로
  defaultInput: text("default_input"), // poster 대체 URL (nullable, null이면 poster 사용)
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => sql`now()`),
});

// ── Workflow System ──────────────────────────────────────────

export const workflowTemplates = pgTable("workflow_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category"), // "video" | "image"
  nodes: text("nodes").notNull().default("[]"),
  edges: text("edges").notNull().default("[]"),
  viewport: text("viewport").default('{"x":0,"y":0,"zoom":1}'),
  thumbnailUrl: text("thumbnail_url"),
  currentVersion: integer("current_version").notNull().default(1),
  isPublished: boolean("is_published").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => sql`now()`),
});

export const workflowRuns = pgTable("workflow_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  templateId: uuid("template_id"), // FK → workflow_templates (nullable for ad-hoc runs)
  templateVersion: integer("template_version"),
  templateSnapshot: text("template_snapshot").notNull(), // 실행 시점 전체 nodes+edges JSON
  inputs: text("inputs").notNull(), // JSON — 인풋 값
  outputs: text("outputs"), // JSON — 최종 결과물
  status: text("status").notNull().default("pending"), // pending/running/completed/failed
  error: text("error"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const nodeRuns = pgTable("node_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id").notNull(), // FK → workflow_runs
  nodeId: text("node_id").notNull(), // React Flow 노드 ID
  nodeType: text("node_type").notNull(), // "generate" | "upscale" | "ffmpeg" | ...
  inputs: text("inputs").notNull(), // JSON — 노드 인풋
  outputs: text("outputs"), // JSON — 노드 아웃풋
  status: text("status").notNull().default("pending"), // pending/running/completed/failed
  error: text("error"),
  externalId: text("external_id"), // Replicate predictionId 등
  externalProvider: text("external_provider"), // "replicate" | "ffmpeg" 등
  legacyGenerationId: uuid("legacy_generation_id"), // 전환기: 기존 generations 행 매핑
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});
