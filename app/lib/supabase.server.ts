import { createClient } from "@supabase/supabase-js";

const MOTION_VIDEOS_BUCKET = "motion-videos";

export function getSupabaseClient(context: { env: Record<string, string> }) {
  const supabaseUrl = context.env.SUPABASE_URL;
  // Storage 업로드는 Service Role Key 사용 (RLS 우회)
  const supabaseKey = context.env.SUPABASE_SERVICE_KEY || context.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_KEY are required");
  }

  return createClient(supabaseUrl, supabaseKey);
}

export async function uploadMotionVideo(
  context: { env: Record<string, string> },
  file: File,
  fileName: string
): Promise<{ path: string; publicUrl: string }> {
  const supabase = getSupabaseClient(context);

  const path = `videos/${Date.now()}-${fileName}`;

  const { error } = await supabase.storage
    .from(MOTION_VIDEOS_BUCKET)
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    throw new Error(`Failed to upload video: ${error.message}`);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(MOTION_VIDEOS_BUCKET).getPublicUrl(path);

  return { path, publicUrl };
}

export async function uploadThumbnail(
  context: { env: Record<string, string> },
  blob: Blob,
  fileName: string
): Promise<{ path: string; publicUrl: string }> {
  const supabase = getSupabaseClient(context);

  const path = `thumbnails/${Date.now()}-${fileName}`;

  const { error } = await supabase.storage
    .from(MOTION_VIDEOS_BUCKET)
    .upload(path, blob, {
      contentType: "image/jpeg",
      upsert: false,
    });

  if (error) {
    throw new Error(`Failed to upload thumbnail: ${error.message}`);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(MOTION_VIDEOS_BUCKET).getPublicUrl(path);

  return { path, publicUrl };
}

export async function deleteMotionVideo(
  context: { env: Record<string, string> },
  storagePath: string,
  thumbnailPath?: string | null
): Promise<void> {
  const supabase = getSupabaseClient(context);

  const pathsToDelete = [storagePath];
  if (thumbnailPath) {
    pathsToDelete.push(thumbnailPath);
  }

  const { error } = await supabase.storage
    .from(MOTION_VIDEOS_BUCKET)
    .remove(pathsToDelete);

  if (error) {
    throw new Error(`Failed to delete files: ${error.message}`);
  }
}

export function getPublicUrl(
  context: { env: Record<string, string> },
  path: string
): string {
  const supabase = getSupabaseClient(context);
  const {
    data: { publicUrl },
  } = supabase.storage.from(MOTION_VIDEOS_BUCKET).getPublicUrl(path);
  return publicUrl;
}

/**
 * Replicate CDN에서 생성된 영상을 다운로드하여 Supabase Storage에 영구 저장
 */
export async function uploadGeneratedVideo(
  context: { env: Record<string, string> },
  sourceUrl: string,
  generationId: string
): Promise<{ storagePath: string; publicUrl: string }> {
  const supabase = getSupabaseClient(context);

  // Replicate CDN에서 다운로드
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`Failed to download video: ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();

  const storagePath = `generated-videos/${generationId}.mp4`;

  const { error } = await supabase.storage
    .from(MOTION_VIDEOS_BUCKET)
    .upload(storagePath, arrayBuffer, {
      contentType: "video/mp4",
      upsert: true,
    });

  if (error) {
    throw new Error(`Failed to upload video: ${error.message}`);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(MOTION_VIDEOS_BUCKET).getPublicUrl(storagePath);

  return { storagePath, publicUrl };
}

/**
 * Supabase Storage에서 생성된 영상 삭제
 */
export async function deleteGeneratedVideo(
  context: { env: Record<string, string> },
  storagePath: string
): Promise<void> {
  const supabase = getSupabaseClient(context);
  const { error } = await supabase.storage
    .from(MOTION_VIDEOS_BUCKET)
    .remove([storagePath]);

  if (error) {
    throw new Error(`Failed to delete generated video: ${error.message}`);
  }
}

/**
 * 업스케일된 영상을 Supabase Storage에 저장
 */
export async function uploadUpscaledVideo(
  context: { env: Record<string, string> },
  sourceUrl: string,
  generationId: string,
  model: string
): Promise<{ storagePath: string; publicUrl: string }> {
  const supabase = getSupabaseClient(context);

  // Replicate CDN에서 다운로드
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`Failed to download upscaled video: ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();

  const storagePath = `upscaled-videos/${generationId}-${model}.mp4`;

  const { error } = await supabase.storage
    .from(MOTION_VIDEOS_BUCKET)
    .upload(storagePath, arrayBuffer, {
      contentType: "video/mp4",
      upsert: true,
    });

  if (error) {
    throw new Error(`Failed to upload upscaled video: ${error.message}`);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(MOTION_VIDEOS_BUCKET).getPublicUrl(storagePath);

  return { storagePath, publicUrl };
}

/**
 * Supabase Storage에서 업스케일된 영상 삭제
 */
export async function deleteUpscaledVideo(
  context: { env: Record<string, string> },
  storagePath: string
): Promise<void> {
  const supabase = getSupabaseClient(context);
  const { error } = await supabase.storage
    .from(MOTION_VIDEOS_BUCKET)
    .remove([storagePath]);

  if (error) {
    throw new Error(`Failed to delete upscaled video: ${error.message}`);
  }
}
