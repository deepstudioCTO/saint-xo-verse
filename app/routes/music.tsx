import { useState, useRef, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router";
import type { Route } from "./+types/music";
import { PageLayout } from "~/components/layout";
import { LargeTitle, StepIndicator } from "~/components/ui";

export const meta: Route.MetaFunction = () => [
  { title: "음악 선택 - 의뢰소" },
];

const TRACKS = [
  { id: "1", title: "Yum", color: "#1a1a2e", src: "/music/Yum.mp3" },
  { id: "2", title: "POP IT", color: "#16213e", src: "/music/POP IT.mp3" },
  { id: "3", title: "I'm lovin' it", color: "#0f3460", src: "/music/I'm lovin' it.mp3" },
];

export default function Music() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const memberId = searchParams.get("member");

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const currentTrack = TRACKS[currentIndex];

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.src = currentTrack.src;
      if (isPlaying) {
        audioRef.current.play();
      }
    }
  }, [currentIndex]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  const handleSelect = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    navigate(`/motion?member=${memberId}&music=${currentTrack.id}`);
  };

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  return (
    <PageLayout
      showBack
      backTo={`/?selected=${memberId}`}
      headerRight={
        <StepIndicator label="TRACK" current={currentIndex + 1} total={TRACKS.length} />
      }
      floatingLeft={
        <span className="font-medium">{currentTrack.title}</span>
      }
      ctaText="선택 →"
      onCtaClick={handleSelect}
    >
      <div className="page-padding min-h-[calc(100vh-7.5rem)] flex flex-col">
        {/* Track Title */}
        <div className="pt-8 mb-8">
          <LargeTitle>{currentTrack.title.toUpperCase()}</LargeTitle>
        </div>

        {/* Album Art */}
        <div className="flex-1 flex items-center justify-center">
          <button
            onClick={togglePlay}
            className="relative w-full max-w-sm aspect-square group"
          >
            {/* Album Art Placeholder */}
            <div
              className="w-full h-full flex items-center justify-center transition-normal"
              style={{ backgroundColor: currentTrack.color }}
            >
              {/* Play/Pause Icon */}
              <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-normal">
                {isPlaying ? (
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="white"
                  >
                    <rect x="6" y="4" width="4" height="16" />
                    <rect x="14" y="4" width="4" height="16" />
                  </svg>
                ) : (
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="white"
                  >
                    <polygon points="5,3 19,12 5,21" />
                  </svg>
                )}
              </div>
            </div>
          </button>
        </div>

        {/* Hidden Audio Element */}
        <audio ref={audioRef} src={currentTrack.src} />

        {/* Thumbnail Navigation */}
        <div className="py-6 flex items-center justify-center gap-3">
          {TRACKS.map((track, index) => (
            <button
              key={track.id}
              onClick={() => setCurrentIndex(index)}
              className={`
                w-12 h-12 transition-normal
                ${index === currentIndex
                  ? "ring-2 ring-[--color-text] ring-offset-2"
                  : "opacity-50 hover:opacity-100"
                }
              `}
              style={{ backgroundColor: track.color }}
            />
          ))}
        </div>
      </div>
    </PageLayout>
  );
}
