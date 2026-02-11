import { motion } from "motion/react";
import { RevealPanel } from "~/components/common/RevealPanel";
import type { Track } from "~/hooks/useAudioPlayer";

interface MusicPanelProps {
  open: boolean;
  tracks: Track[];
  currentTrackIndex: number;
  isPlaying: boolean;
  onSelectTrack: (id: string) => void;
}

function EqualizerBars() {
  return (
    <div className="flex items-end gap-[2px] h-3">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-[3px] bg-black/70 rounded-full"
          animate={{ height: ["40%", "100%", "60%", "90%", "40%"] }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            delay: i * 0.15,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

export function MusicPanel({
  open,
  tracks,
  currentTrackIndex,
  isPlaying,
  onSelectTrack,
}: MusicPanelProps) {
  return (
    <RevealPanel open={open}>
      {(contentReady) => (
        <div
          className={`overflow-y-auto flex-1 min-h-0 py-2 transition-opacity duration-200 ${
            contentReady ? "opacity-100" : "opacity-0"
          }`}
        >
          {tracks.map((track, i) => {
            const isCurrent = i === currentTrackIndex;
            return (
              <button
                key={track.id}
                onClick={() => onSelectTrack(track.id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                  isCurrent ? "bg-black/5" : "hover:bg-black/[0.03]"
                }`}
              >
                <img
                  src={track.cover}
                  alt={track.title}
                  loading="lazy"
                  className={`w-10 h-10 rounded-sm object-cover transition-all duration-200 ${
                    isCurrent ? "grayscale-0" : "grayscale"
                  }`}
                />
                <span
                  className={`text-xs tracking-wider font-medium flex-1 text-left truncate transition-colors ${
                    isCurrent ? "text-black/80" : "text-black/40"
                  }`}
                >
                  {track.title}
                </span>
                {isCurrent && isPlaying && <EqualizerBars />}
              </button>
            );
          })}
        </div>
      )}
    </RevealPanel>
  );
}
