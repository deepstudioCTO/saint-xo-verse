import { createClient } from "@supabase/supabase-js";

const MOTION_VIDEOS_BUCKET = "motion-videos";
const MEMBER_IMAGES_BUCKET = "member-images";

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

/**
 * 직접 업로드된 결과 영상을 Supabase Storage에 저장
 */
export async function uploadResultVideo(
  context: { env: Record<string, string> },
  file: File,
  generationId: string
): Promise<{ storagePath: string; publicUrl: string }> {
  const supabase = getSupabaseClient(context);

  const storagePath = `uploaded-videos/${generationId}.mp4`;

  const { error } = await supabase.storage
    .from(MOTION_VIDEOS_BUCKET)
    .upload(storagePath, file, {
      contentType: file.type || "video/mp4",
      upsert: false,
    });

  if (error) {
    throw new Error(`Failed to upload result video: ${error.message}`);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(MOTION_VIDEOS_BUCKET).getPublicUrl(storagePath);

  return { storagePath, publicUrl };
}

/**
 * 직접 업로드된 결과 이미지를 Supabase Storage에 저장
 */
export async function uploadResultImage(
  context: { env: Record<string, string> },
  file: File,
  generationId: string
): Promise<{ storagePath: string; publicUrl: string }> {
  const supabase = getSupabaseClient(context);

  // Get file extension from mime type
  const ext = file.type.includes("png") ? "png" : file.type.includes("webp") ? "webp" : "jpg";
  const storagePath = `uploaded-images/${generationId}.${ext}`;

  const { error } = await supabase.storage
    .from(MOTION_VIDEOS_BUCKET)
    .upload(storagePath, file, {
      contentType: file.type || "image/jpeg",
      upsert: false,
    });

  if (error) {
    throw new Error(`Failed to upload result image: ${error.message}`);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(MOTION_VIDEOS_BUCKET).getPublicUrl(storagePath);

  return { storagePath, publicUrl };
}

/**
 * 캐릭터 이미지를 Supabase Storage에 업로드
 */
export async function uploadCharacterImage(
  context: { env: Record<string, string> },
  file: File,
  characterId: string,
  variantId: string
): Promise<{ storagePath: string; publicUrl: string }> {
  const supabase = getSupabaseClient(context);

  const storagePath = `${characterId}_${variantId}.png`;

  const { error } = await supabase.storage
    .from(MEMBER_IMAGES_BUCKET)
    .upload(storagePath, file, {
      contentType: "image/png",
      upsert: true,
    });

  if (error) {
    throw new Error(`Failed to upload character image: ${error.message}`);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(MEMBER_IMAGES_BUCKET).getPublicUrl(storagePath);

  return { storagePath, publicUrl };
}

/**
 * 캐릭터 이미지를 Supabase Storage에서 삭제
 */
export async function deleteCharacterImage(
  context: { env: Record<string, string> },
  storagePath: string
): Promise<void> {
  const supabase = getSupabaseClient(context);

  const { error } = await supabase.storage
    .from(MEMBER_IMAGES_BUCKET)
    .remove([storagePath]);

  if (error) {
    throw new Error(`Failed to delete character image: ${error.message}`);
  }
}

/**
 * 컨셉 이미지를 Supabase Storage에 업로드
 */
export async function uploadConceptImage(
  context: { env: Record<string, string> },
  file: File,
  fileName: string
): Promise<{ storagePath: string; publicUrl: string }> {
  const supabase = getSupabaseClient(context);

  const ext = fileName.split(".").pop() || "png";
  const storagePath = `concept-images/${Date.now()}-${fileName.replace(/\.[^.]+$/, "")}.${ext}`;

  const { error } = await supabase.storage
    .from(MOTION_VIDEOS_BUCKET)
    .upload(storagePath, file, {
      contentType: file.type || "image/png",
      upsert: false,
    });

  if (error) {
    throw new Error(`Failed to upload concept image: ${error.message}`);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(MOTION_VIDEOS_BUCKET).getPublicUrl(storagePath);

  return { storagePath, publicUrl };
}

/**
 * 컨셉 이미지를 Supabase Storage에서 삭제
 */
export async function deleteConceptImage(
  context: { env: Record<string, string> },
  storagePath: string
): Promise<void> {
  const supabase = getSupabaseClient(context);

  const { error } = await supabase.storage
    .from(MOTION_VIDEOS_BUCKET)
    .remove([storagePath]);

  if (error) {
    throw new Error(`Failed to delete concept image: ${error.message}`);
  }
}

/**
 * 생성된 이미지를 Supabase Storage에 저장 (Replicate CDN에서 다운로드)
 */
export async function uploadGeneratedImage(
  context: { env: Record<string, string> },
  sourceUrl: string,
  generationId: string
): Promise<{ storagePath: string; publicUrl: string }> {
  const supabase = getSupabaseClient(context);

  // Replicate CDN에서 다운로드
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();

  // Content-Type 확인하여 확장자 결정
  const contentType = response.headers.get("content-type") || "image/jpeg";
  const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
  const storagePath = `generated-images/${generationId}.${ext}`;

  const { error } = await supabase.storage
    .from(MOTION_VIDEOS_BUCKET)
    .upload(storagePath, arrayBuffer, {
      contentType,
      upsert: true,
    });

  if (error) {
    throw new Error(`Failed to upload generated image: ${error.message}`);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(MOTION_VIDEOS_BUCKET).getPublicUrl(storagePath);

  return { storagePath, publicUrl };
}

/**
 * 생성된 이미지를 Supabase Storage에서 삭제
 */
export async function deleteGeneratedImage(
  context: { env: Record<string, string> },
  storagePath: string
): Promise<void> {
  const supabase = getSupabaseClient(context);

  const { error } = await supabase.storage
    .from(MOTION_VIDEOS_BUCKET)
    .remove([storagePath]);

  if (error) {
    throw new Error(`Failed to delete generated image: ${error.message}`);
  }
}
