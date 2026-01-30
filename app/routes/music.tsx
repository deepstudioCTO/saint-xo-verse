import { useState, useRef, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router";
import type { Route } from "./+types/music";
import { LargeTitle, StepIndicator } from "~/components/ui";
import { TRACKS } from "~/lib/data";

export const meta: Route.MetaFunction = () => [
  { title: "Music - Saint XO Verse" },
];

export default function Music() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const characterId = searchParams.get("character");
  const variant = searchParams.get("variant") || "default";

  const [currentIndex, setCurrentIndex] = useState(Math.floor(TRACKS.length / 2));
  const [isPlaying, setIsPlaying] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const currentTrack = TRACKS[currentIndex];

  // 페이지 진입 시 자동 재생
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.play().catch(() => {
        setIsPlaying(false);
      });
    }
  }, []);

  // 트랙 변경 시 재생
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.src = currentTrack.src;
      audioRef.current.play().catch(() => {
        setIsPlaying(false);
      });
      setIsPlaying(true);
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
    navigate(`/motion?character=${characterId}&music=${currentTrack.id}&variant=${variant}`);
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
    <div className="relative w-full h-screen overflow-hidden bg-[--color-bg]">
      {/* Layer 1: Album Covers (full screen background) */}
      <div className="absolute inset-0 flex items-center justify-center">
        {TRACKS.map((track, index) => {
          const isSelected = index === currentIndex;
          const diff = index - currentIndex;
          const absDiff = Math.abs(diff);
          const centerIndex = (TRACKS.length - 1) / 2;

          // Position calculation (같은 로직)
          const homeX = (index - centerIndex) * 140;
          // 인접한 앨범은 20vw, 그 외는 더 가깝게
          const selectX = absDiff <= 1 ? diff * 20 : Math.sign(diff) * (20 + (absDiff - 1) * 12);
          const x = selectX;

          // Scale, opacity (캐릭터 선택과 동일한 패턴)
          const baseScale = 2.5;
          let scale = 1;
          let opacity = 1;
          let grayscale = true;

          if (isSelected) {
            scale = baseScale;
            opacity = 1;
            grayscale = false;
          } else if (absDiff === 1) {
            scale = baseScale * 0.5;
            opacity = 0.2;
          } else {
            scale = baseScale * 0.3;
            opacity = 0.08;
          }

          return (
            <div
              key={track.id}
              className="absolute cursor-pointer"
              style={{
                transform: `translate3d(${x}vw, 0, 0) scale(${scale})`,
                opacity,
                zIndex: isSelected ? 10 : 5 - absDiff,
                transition: "transform 500ms ease-out, opacity 500ms ease-out",
                willChange: "transform, opacity",
              }}
              onClick={() => {
                setCurrentIndex(index);
                if (!isSelected) {
                  // 새 트랙 선택 시 재생
                }
              }}
            >
              <div
                className="w-48 h-48 md:w-60 md:h-60 rounded-xl overflow-hidden"
                onClick={(e) => {
                  if (isSelected) {
                    e.stopPropagation();
                    togglePlay();
                  }
                }}
              >
                <img
                  src={track.cover}
                  alt={track.title}
                  draggable={false}
                  className="w-full h-full object-cover select-none pointer-events-none"
                  style={{
                    filter: grayscale ? "grayscale(100%)" : "grayscale(0%)",
                    transition: "filter 500ms ease-out",
                  }}
                />
                {/* Play/Pause Overlay (선택된 앨범만) */}
                {isSelected && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-all duration-300 rounded-xl">
                    <div className="w-12 h-12 rounded-full bg-white/30 flex items-center justify-center">
                      {isPlaying ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                          <rect x="6" y="4" width="4" height="16" />
                          <rect x="14" y="4" width="4" height="16" />
                        </svg>
                      ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                          <polygon points="5,3 19,12 5,21" />
                        </svg>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Hidden Audio Element */}
      <audio ref={audioRef} src={currentTrack.src} />

      {/* Layer 2: Header */}
      <header className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-4">
        <button
          onClick={() => navigate(`/?selected=${characterId}&variant=${variant}`)}
          className="text-sm font-medium"
        >
          ← Back
        </button>
        <StepIndicator label="TRACK" current={currentIndex + 1} total={TRACKS.length} />
      </header>

      {/* Layer 3: Title */}
      <div className="absolute top-20 left-0 right-0 z-20 px-6">
        <LargeTitle>{currentTrack.title.toUpperCase()}</LargeTitle>
        <div className="flex items-center gap-3 mt-4 max-w-xs">
          <span className="text-xs text-[--color-text-tertiary] w-16">
            {String(currentIndex + 1).padStart(2, "0")} / {String(TRACKS.length).padStart(2, "0")}
          </span>
          <input
            type="range"
            min="0"
            max={TRACKS.length - 1}
            value={currentIndex}
            onChange={(e) => setCurrentIndex(parseInt(e.target.value))}
            className="flex-1 h-1 bg-[--color-border] rounded-full appearance-none cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none
              [&::-webkit-slider-thumb]:w-3
              [&::-webkit-slider-thumb]:h-3
              [&::-webkit-slider-thumb]:bg-[--color-text]
              [&::-webkit-slider-thumb]:rounded-full
              [&::-webkit-slider-thumb]:cursor-pointer
            "
          />
        </div>
      </div>

      {/* Layer 4: Bottom Bar */}
      <div className="absolute bottom-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-4 bg-[--color-bg]">
        <span className="text-sm text-[--color-text-secondary]">
          {currentTrack.title}
        </span>
        <button
          onClick={handleSelect}
          className="px-4 py-2 text-sm font-medium bg-[--color-text] text-[--color-bg] rounded"
        >
          Select →
        </button>
      </div>

      {/* Layer 5: Navigation */}
      <div className="absolute bottom-20 left-0 right-0 z-20 flex items-center justify-between px-6">
        <button
          onClick={() => currentIndex > 0 && setCurrentIndex(currentIndex - 1)}
          disabled={currentIndex === 0}
          className={`flex items-center gap-2 text-sm font-medium transition-all ${
            currentIndex === 0 ? "opacity-30 cursor-not-allowed" : "opacity-70 hover:opacity-100"
          }`}
        >
          ← PREV
        </button>
        <button
          onClick={() => currentIndex < TRACKS.length - 1 && setCurrentIndex(currentIndex + 1)}
          disabled={currentIndex === TRACKS.length - 1}
          className={`flex items-center gap-2 text-sm font-medium transition-all ${
            currentIndex === TRACKS.length - 1 ? "opacity-30 cursor-not-allowed" : "opacity-70 hover:opacity-100"
          }`}
        >
          NEXT →
        </button>
      </div>
    </div>
  );
}
