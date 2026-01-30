import {
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
