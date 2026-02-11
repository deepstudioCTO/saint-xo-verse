import { useState, useEffect, useRef, type ReactNode } from "react";
import { useFetcher } from "react-router";
import { useAudioPlayer } from "~/hooks/useAudioPlayer";
import { GlassButton } from "~/components/ui";
import { MusicPanel } from "~/components/music/MusicPanel";

const ICON_BTN = "cursor-pointer p-1 text-black/40";

function formatTime(s: number) {
  const sec = Math.floor(s);
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

export type ActivePanel = null | "music" | "skill" | "gallery-compact" | "gallery-expanded";

interface HomeFloatingBarProps {
  characterId: string | null;
  characterImageUrl: string;
  verseId: string;
  activePanel: ActivePanel;
  onPanelChange: (panel: ActivePanel) => void;
  selectedVideo: {
    id: string;
    name: string;
    videoUrl: string;
    thumbnailUrl: string | null;
    duration: number;
  } | null;
  selectedImage: {
    id: string;
    name: string | null;
    publicUrl: string;
  } | null;
  children?: ReactNode;
}

export function HomeFloatingBar({
  characterId,
  characterImageUrl,
  verseId,
  activePanel,
  onPanelChange,
  selectedVideo,
  selectedImage,
  children,
}: HomeFloatingBarProps) {
  const {
    currentTrack,
    isPlaying,
    togglePlay,
    nextTrack,
    prevTrack,
    selectTrack,
    getAudioElement,
    shuffle,
    repeatOne,
    toggleShuffle,
    toggleRepeatOne,
    verseTracks,
  } = useAudioPlayer({ autoPlay: true, verseId });

  // Derived booleans from activePanel
  const skillPanelOpen = activePanel === "skill";
  const musicPanelOpen = activePanel === "music";
  const galleryOpen = activePanel === "gallery-compact";
  const anyPanelOpen = activePanel !== null;

  const [prompt, setPrompt] = useState("");
  const fetcher = useFetcher();
  const isGenerating = fetcher.state !== "idle";

  const handleSubmit = () => {
    if ((!selectedVideo && !prompt.trim()) || !characterId || !characterImageUrl || isGenerating) return;

    const formData = new FormData();
    formData.append("prompt", prompt.trim());
    formData.append("memberId", characterId);
    formData.append("verseId", verseId);

    if (selectedVideo) {
      formData.append("imageUrl", characterImageUrl);
      formData.append("videoUrl", selectedVideo.videoUrl);
      formData.append("musicId", currentTrack.id);
      formData.append("motionVideoId", selectedVideo.id);

      fetcher.submit(formData, {
        method: "POST",
        action: "/api/generate",
      });
    } else {
      formData.append("characterImageUrl", characterImageUrl);
      formData.append("resolution", "2K");
      formData.append("aspectRatio", "2:3");

      if (selectedImage) {
        formData.append("conceptImageUrl", selectedImage.publicUrl);
        formData.append("conceptImageId", selectedImage.id);
      }

      fetcher.submit(formData, {
        method: "POST",
        action: "/api/generate-image",
      });
    }

    setPrompt("");
  };

  // fetcher 응답 완료 시 갤러리 자동 열기 (submitting → idle 전이 감지)
  const prevFetcherState = useRef(fetcher.state);
  useEffect(() => {
    const wasSubmitting = prevFetcherState.current !== "idle";
    prevFetcherState.current = fetcher.state;

    if (wasSubmitting && fetcher.state === "idle" && fetcher.data?.success) {
      onPanelChange("gallery-compact");
    }
  }, [fetcher.state, fetcher.data, onPanelChange]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = getAudioElement();
    if (!audio) return;
    const onTime = () => setCurrentTime(audio.currentTime);
    const onMeta = () => setDuration(audio.duration || 0);
    if (audio.duration) setDuration(audio.duration);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
    };
  }, [getAudioElement]);

  const verseTrackIndex = verseTracks.findIndex((t) => t.id === currentTrack.id);

  return (
    <>
      {/* Music Controls — bottom left */}
      <div className="absolute bottom-4 left-6 z-[15] flex items-center gap-1.5">
        {/* Track info — leftmost */}
        <div className="flex items-center gap-2 mr-1">
          <img src={currentTrack.cover} alt={currentTrack.title} className="w-8 h-8 rounded-sm object-cover" />
          <span className="text-[11px] tracking-wider text-black/70 font-medium max-w-[80px] truncate">
            {currentTrack.title}
          </span>
        </div>
        {/* Shuffle */}
        <button onClick={toggleShuffle} className={`${ICON_BTN} relative`} title="Shuffle">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 3 21 3 21 8" />
            <line x1="4" y1="20" x2="21" y2="3" />
            <polyline points="21 16 21 21 16 21" />
            <line x1="15" y1="15" x2="21" y2="21" />
            <line x1="4" y1="4" x2="9" y2="9" />
          </svg>
          {shuffle && (
            <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-black/50" />
          )}
        </button>
        {/* Prev */}
        <button onClick={prevTrack} className="cursor-pointer p-1 text-black" title="Previous track">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 20L9 12L19 4V20Z" />
            <rect x="4" y="4" width="3" height="16" rx="0.5" />
          </svg>
        </button>
        {/* Play/Pause */}
        <button onClick={togglePlay} className="cursor-pointer p-1 text-black" title={isPlaying ? "Pause" : "Play"}>
          {isPlaying ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <rect x="5" y="3" width="5" height="18" rx="1" />
              <rect x="14" y="3" width="5" height="18" rx="1" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 3.5L20 12L6 20.5V3.5Z" />
            </svg>
          )}
        </button>
        {/* Next */}
        <button onClick={nextTrack} className="cursor-pointer p-1 text-black" title="Next track">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M5 4L15 12L5 20V4Z" />
            <rect x="17" y="4" width="3" height="16" rx="0.5" />
          </svg>
        </button>
        {/* Repeat */}
        <button onClick={toggleRepeatOne} className={`${ICON_BTN} relative`} title={repeatOne ? "Repeat one" : "Repeat all"}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="17 1 21 5 17 9" />
            <path d="M3 11V9a4 4 0 0 1 4-4h14" />
            <polyline points="7 23 3 19 7 15" />
            <path d="M21 13v2a4 4 0 0 1-4 4H3" />
          </svg>
          {repeatOne && (
            <span className="absolute top-0 -right-0.5 text-[6px] font-bold text-black/50 leading-none">1</span>
          )}
        </button>
        {/* Duration */}
        <span className="text-[10px] tracking-wider text-black/40 tabular-nums ml-1">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>

      {/* Prompt Input — bottom center */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[15] w-full max-w-[35vw] px-6">
        <div className="relative">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!characterId || isGenerating}
            placeholder={
              !characterId
                ? "Select a character first"
                : isGenerating
                  ? "Generating..."
                  : selectedVideo
                    ? "Add a prompt (optional)"
                    : "Describe the image..."
            }
            className="w-full px-5 pr-12 py-3 text-sm rounded-full bg-black/5 focus:bg-black/10 outline-none placeholder:text-black/30 text-black/70 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          />
          <button
            onClick={handleSubmit}
            disabled={(!selectedVideo && !prompt.trim()) || !characterId || isGenerating}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-colors disabled:opacity-0 cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </div>
      </div>

      {/* Navigation — bottom right */}
      <div className={`absolute bottom-4 right-6 flex flex-col items-stretch gap-3 ${anyPanelOpen ? "z-30" : "z-[15]"}`}>
        {children}
        <MusicPanel
          open={musicPanelOpen}
          tracks={verseTracks}
          currentTrackIndex={verseTrackIndex}
          isPlaying={isPlaying}
          onSelectTrack={selectTrack}
        />
        <div className="flex items-center gap-2">
        <GlassButton
          onClick={() => onPanelChange(musicPanelOpen ? null : "music")}
          active={musicPanelOpen}
          className="text-left min-w-[8vw]"
        >
          <span className="flex items-center gap-2">
            <img
              src={currentTrack.cover}
              alt=""
              className="w-5 h-5 rounded-sm object-cover"
            />
            MUSIC
          </span>
        </GlassButton>
        <GlassButton
          onClick={() => onPanelChange(skillPanelOpen ? null : "skill")}
          disabled={!characterId}
          active={skillPanelOpen}
          className="text-left min-w-[8vw]"
        >
          <span className="flex items-center gap-2">
            {(selectedVideo?.thumbnailUrl || selectedImage?.publicUrl) && (
              <img
                src={(selectedVideo?.thumbnailUrl ?? selectedImage?.publicUrl)!}
                alt=""
                className="w-5 h-5 rounded-sm object-cover"
              />
            )}
            SKILLS
          </span>
        </GlassButton>
        <GlassButton
          onClick={() => onPanelChange(galleryOpen ? null : "gallery-compact")}
          active={galleryOpen}
          className="text-left min-w-[8vw]"
        >
          GALLERY
        </GlassButton>
        </div>
      </div>
    </>
  );
}
