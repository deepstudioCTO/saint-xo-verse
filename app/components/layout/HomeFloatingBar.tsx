import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
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
    seekTo,
    toggleShuffle,
    toggleRepeatOne,
    tracks,
  } = useAudioPlayer({ autoPlay: true });

  // Derived booleans from activePanel
  const skillPanelOpen = activePanel === "skill";
  const musicPanelOpen = activePanel === "music";
  const galleryOpen = activePanel === "gallery-compact";
  const anyPanelOpen = activePanel !== null;

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const seekingRef = useRef(false);

  // Track change → reset time display immediately
  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);
  }, [currentTrack.id]);

  useEffect(() => {
    const audio = getAudioElement();
    if (!audio) return;
    const onTime = () => {
      if (!seekingRef.current) setCurrentTime(audio.currentTime);
    };
    const onMeta = () => setDuration(audio.duration || 0);
    if (audio.duration) setDuration(audio.duration);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
    };
  }, [getAudioElement]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    setCurrentTime(value);
    seekTo(value);
  };

  const handleSeekPointerDown = useCallback(() => {
    seekingRef.current = true;
    const onUp = () => {
      seekingRef.current = false;
      document.removeEventListener("pointerup", onUp);
    };
    document.addEventListener("pointerup", onUp);
  }, []);

  const trackIndex = tracks.findIndex((t) => t.id === currentTrack.id);

  return (
    <>
      {/* Track info — bottom left */}
      <div className="absolute bottom-4 left-6 z-[15] flex items-center gap-2">
        <img src={currentTrack.cover} alt={currentTrack.title} className="w-8 h-8 rounded-sm object-cover" />
        <div className="flex flex-col">
          <span className="text-[11px] tracking-wider text-black/70 font-medium whitespace-nowrap">
            {currentTrack.title}
          </span>
          <span className="text-[9px] tracking-wider text-black/30">
            Saint Vesper
          </span>
        </div>
      </div>

      {/* Music Controls — bottom center */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[15] flex flex-col items-center gap-0.5">
        {/* Playback buttons */}
        <div className="flex items-center gap-1">
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
          <button onClick={prevTrack} className="cursor-pointer p-1 text-black" title="Previous track">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 20L9 12L19 4V20Z" />
              <rect x="4" y="4" width="3" height="16" rx="0.5" />
            </svg>
          </button>
          <button onClick={togglePlay} className="cursor-pointer p-1 text-black" title={isPlaying ? "Pause" : "Play"}>
            {isPlaying ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <rect x="5" y="3" width="5" height="18" rx="1" />
                <rect x="14" y="3" width="5" height="18" rx="1" />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 3.5L20 12L6 20.5V3.5Z" />
              </svg>
            )}
          </button>
          <button onClick={nextTrack} className="cursor-pointer p-1 text-black" title="Next track">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M5 4L15 12L5 20V4Z" />
              <rect x="17" y="4" width="3" height="16" rx="0.5" />
            </svg>
          </button>
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
        </div>
        {/* Progress bar */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] tracking-wider text-black/40 tabular-nums w-[30px] text-right">
            {formatTime(currentTime)}
          </span>
          <input
            type="range"
            min={0}
            max={duration || 0}
            value={currentTime}
            step={0.1}
            onChange={handleSeek}
            onPointerDown={handleSeekPointerDown}
            aria-label="Seek"
            style={{ "--progress": `${duration ? (currentTime / duration) * 100 : 0}%` } as React.CSSProperties}
            className="music-progress w-[18vw] appearance-none cursor-pointer"
          />
          <span className="text-[10px] tracking-wider text-black/40 tabular-nums w-[30px]">
            {formatTime(duration)}
          </span>
        </div>
      </div>

      {/* Bottom bar — panels + buttons */}
      <div className={`absolute bottom-4 right-6 w-[26vw] ${anyPanelOpen ? "z-30" : "z-[15]"}`}>
        <div className="flex flex-col items-stretch gap-3">
        {children}
        <MusicPanel
          open={musicPanelOpen}
          tracks={tracks}
          currentTrackIndex={trackIndex}
          isPlaying={isPlaying}
          onSelectTrack={(id) => { selectTrack(id); onPanelChange(null); }}
        />
        <div className="grid grid-cols-3 gap-2">
        <GlassButton
          onClick={() => onPanelChange(musicPanelOpen ? null : "music")}
          active={musicPanelOpen}
          className="text-left w-full"
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
          className="text-left w-full"
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
          className="text-left w-full"
        >
          GALLERY
        </GlassButton>
        </div>
        </div>
      </div>
    </>
  );
}
