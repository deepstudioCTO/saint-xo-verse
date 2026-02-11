import { useRef, useEffect, useCallback } from "react";
import { getMusicFilePath } from "~/lib/music-data";

interface VideoPlayerWithMusicProps {
  videoUrl: string;
  musicId: string | null;
  autoPlay?: boolean;
  loop?: boolean;
  controls?: boolean;
  className?: string;
}

/**
 * 비디오와 음악을 동기화하여 재생하는 컴포넌트
 * - 비디오는 muted로 재생
 * - 선택한 음악을 별도 audio 요소로 동시 재생
 */
export function VideoPlayerWithMusic({
  videoUrl,
  musicId,
  autoPlay = true,
  loop = true,
  controls = true,
  className = "",
}: VideoPlayerWithMusicProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const musicPath = getMusicFilePath(musicId);

  const handlePlay = useCallback(() => {
    const audio = audioRef.current;
    const video = videoRef.current;
    if (!audio || !video) return;
    audio.currentTime = video.currentTime % (audio.duration || 1);
    audio.play().catch(() => {});
  }, []);

  const handlePause = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  const handleSeeked = useCallback(() => {
    const audio = audioRef.current;
    const video = videoRef.current;
    if (!audio || !video) return;
    audio.currentTime = video.currentTime % (audio.duration || 1);
  }, []);

  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current;
    const video = videoRef.current;
    if (!audio || !video) return;
    if (video.currentTime < 0.5 && audio.currentTime > 1) {
      audio.currentTime = 0;
    }
  }, []);

  // autoPlay: HTML 속성 대신 명시적 호출 — React 이벤트 핸들러가 활성화된 후 실행
  useEffect(() => {
    if (!autoPlay) return;
    const video = videoRef.current;
    if (!video) return;
    video.play().catch(() => {});
  }, [autoPlay]);

  if (!musicPath) {
    return (
      <video
        ref={videoRef}
        src={videoUrl}
        loop={loop}
        controls={controls}
        playsInline
        className={className}
      />
    );
  }

  return (
    <>
      <video
        ref={videoRef}
        src={videoUrl}
        loop={loop}
        controls={controls}
        playsInline
        muted
        onPlay={handlePlay}
        onPause={handlePause}
        onSeeked={handleSeeked}
        onTimeUpdate={handleTimeUpdate}
        className={className}
      />
      <audio ref={audioRef} src={musicPath} loop={loop} preload="auto" />
    </>
  );
}
