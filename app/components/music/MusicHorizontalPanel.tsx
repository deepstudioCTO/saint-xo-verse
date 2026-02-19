import { motion, AnimatePresence } from "motion/react";
import { useAudioPlayer } from "~/hooks/useAudioPlayer";
import { MusicControls } from "./MusicControls";

interface MusicHorizontalPanelProps {
  open: boolean;
}

export function MusicHorizontalPanel({ open }: MusicHorizontalPanelProps) {
  const {
    tracks,
    currentTrack,
    isPlaying,
    shuffle,
    repeatOne,
    selectTrack,
    togglePlay,
    nextTrack,
    prevTrack,
    toggleShuffle,
    toggleRepeatOne,
    seekTo,
    getAudioElement,
  } = useAudioPlayer();

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ clipPath: "inset(0 50% 0 50% round 0.125rem)" }}
          animate={{ clipPath: "inset(0 0% 0 0% round 0.125rem)" }}
          exit={{ clipPath: "inset(0 50% 0 50% round 0.125rem)" }}
          transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
          className="w-full glass flex flex-col overflow-hidden h-[180px]"
        >
          <div className="overflow-x-auto flex-1 min-h-0 p-4">
            <div className="grid grid-flow-col auto-cols-[100px] gap-2">
              {tracks.map((track, i) => {
                const isCurrent = track.id === currentTrack.id;
                return (
                  <motion.button
                    key={track.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.25, delay: i * 0.03 }}
                    onClick={() => selectTrack(track.id)}
                    className="relative aspect-square rounded-sm overflow-hidden cursor-pointer"
                  >
                    <img
                      src={track.cover}
                      alt={track.title}
                      loading="lazy"
                      className={`absolute inset-0 w-full h-full object-cover transition-all duration-200 ${
                        isCurrent ? "grayscale-0" : "grayscale"
                      }`}
                    />
                    <span className="absolute bottom-1 left-1 right-1 text-[10px] text-white truncate drop-shadow">
                      {track.title}
                    </span>
                    {isCurrent && isPlaying && (
                      <div className="absolute top-1 right-1 flex items-end gap-[2px] h-3">
                        {[0, 1, 2].map((j) => (
                          <motion.div
                            key={j}
                            className="w-[3px] bg-white/80 rounded-full"
                            animate={{ height: ["40%", "100%", "60%", "90%", "40%"] }}
                            transition={{
                              duration: 0.8,
                              repeat: Infinity,
                              delay: j * 0.15,
                              ease: "easeInOut",
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>
          <div className="flex justify-center pb-2.5 shrink-0">
            <MusicControls
              isPlaying={isPlaying}
              shuffle={shuffle}
              repeatOne={repeatOne}
              currentTrack={currentTrack}
              togglePlay={togglePlay}
              nextTrack={nextTrack}
              prevTrack={prevTrack}
              toggleShuffle={toggleShuffle}
              toggleRepeatOne={toggleRepeatOne}
              seekTo={seekTo}
              getAudioElement={getAudioElement}
              progressWidth="w-[180px]"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
