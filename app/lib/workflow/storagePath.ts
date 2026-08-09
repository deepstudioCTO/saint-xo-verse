/**
 * Supabase Storage public URL → 버킷 내 경로. 순수 함수.
 *
 *   "https://xxx.supabase.co/storage/v1/object/public/motion-videos/generated-videos/a.mp4"
 *   → "generated-videos/a.mp4"
 *
 * 해당 버킷의 public URL이 아니면 null (외부 URL은 지울 대상이 아님).
 */
export function storagePathFromPublicUrl(url: string, bucket = "motion-videos"): string | null {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  const path = url.slice(idx + marker.length).split(/[?#]/)[0];
  if (!path) return null;
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}
