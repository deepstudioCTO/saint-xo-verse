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

  // 비디오와 오디오 동기화
  const syncAudioWithVideo = useCallback(() => {
    if (!audioRef.current || !videoRef.current || !musicPath) return;

    const video = videoRef.current;
    const audio = audioRef.current;

    // 비디오가 재생 중이면 오디오도 재생
    if (!video.paused) {
      audio.currentTime = video.currentTime % audio.duration || 0;
      audio.play().catch(() => {
        // Autoplay 정책으로 인한 에러 무시
      });
    } else {
      audio.pause();
    }
  }, [musicPath]);

  // 비디오 이벤트 핸들러
  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video || !musicPath) return;

    const handlePlay = () => {
      if (audio) {
        audio.currentTime = video.currentTime % (audio.duration || 1);
        audio.play().catch(() => {});
      }
    };

    const handlePause = () => {
      if (audio) {
        audio.pause();
      }
    };

    const handleSeeked = () => {
      if (audio) {
        audio.currentTime = video.currentTime % (audio.duration || 1);
      }
    };

    const handleEnded = () => {
      if (loop && audio) {
        audio.currentTime = 0;
        if (!video.paused) {
          audio.play().catch(() => {});
        }
      }
    };

    // 루프 시 오디오 리셋
    const handleTimeUpdate = () => {
      // 비디오가 처음으로 돌아갔을 때 오디오도 리셋
      if (audio && video.currentTime < 0.5 && audio.currentTime > 1) {
        audio.currentTime = 0;
      }
    };

    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("seeked", handleSeeked);
    video.addEventListener("ended", handleEnded);
    video.addEventListener("timeupdate", handleTimeUpdate);

    return () => {
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("seeked", handleSeeked);
      video.removeEventListener("ended", handleEnded);
      video.removeEventListener("timeupdate", handleTimeUpdate);
    };
  }, [musicPath, loop]);

  // 초기 autoPlay 처리
  useEffect(() => {
    if (autoPlay && videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  }, [autoPlay]);

  // 음악이 없는 경우 일반 비디오 재생
  if (!musicPath) {
    return (
      <video
        ref={videoRef}
        src={videoUrl}
        autoPlay={autoPlay}
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
        autoPlay={autoPlay}
        loop={loop}
        controls={controls}
        playsInline
        muted // 음악이 있으면 원본 오디오는 음소거
        className={className}
      />
      <audio ref={audioRef} src={musicPath} loop={loop} preload="auto" />
    </>
  );
}
