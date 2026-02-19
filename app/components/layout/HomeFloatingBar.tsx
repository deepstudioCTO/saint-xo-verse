import { type ReactNode } from "react";
import { useAudioPlayer } from "~/hooks/useAudioPlayer";
import { GlassButton } from "~/components/ui";
import { MusicPanel } from "~/components/music/MusicPanel";
import { MusicPlayerWidget } from "~/components/music/MusicPlayerWidget";

export type ActivePanel = null | "music" | "skill-compact" | "skill-expanded" | "gallery-compact" | "gallery-expanded";

interface HomeFloatingBarProps {
  characterId: string | null;
  characterImageUrl: string;
  lookbookId: string;
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
    selectTrack,
    tracks,
  } = useAudioPlayer({ autoPlay: true });

  // Derived booleans from activePanel
  const skillPanelOpen = activePanel === "skill-compact" || activePanel === "skill-expanded";
  const musicPanelOpen = activePanel === "music";
  const galleryOpen = activePanel === "gallery-compact";
  const anyPanelOpen = activePanel !== null;

  const trackIndex = tracks.findIndex((t) => t.id === currentTrack.id);

  return (
    <>
      {/* Music Player Widget — bottom right, draggable */}
      <MusicPlayerWidget />

      {/* Bottom bar — panels + buttons (centered) */}
      <div className={`absolute bottom-4 left-1/2 -translate-x-1/2 w-[26vw] ${anyPanelOpen ? "z-30" : "z-[15]"}`}>
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
            DEMO
          </span>
        </GlassButton>
        <GlassButton
          onClick={() => onPanelChange(skillPanelOpen ? null : "skill-compact")}
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
          LIBRARY
        </GlassButton>
        </div>
        </div>
      </div>
    </>
  );
}
