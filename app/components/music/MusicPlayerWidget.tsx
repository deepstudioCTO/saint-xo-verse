import { useRef } from "react";
import { motion } from "motion/react";
import { useAudioPlayer } from "~/hooks/useAudioPlayer";
import { MusicControls } from "./MusicControls";

export function MusicPlayerWidget() {
  const {
    currentTrack,
    isPlaying,
    togglePlay,
    nextTrack,
    prevTrack,
    seekTo,
    getAudioElement,
    shuffle,
    repeatOne,
    toggleShuffle,
    toggleRepeatOne,
  } = useAudioPlayer({ autoPlay: true });

  const constraintRef = useRef<HTMLDivElement>(null);

  return (
    <>
      {/* Drag boundary (full viewport) */}
      <div ref={constraintRef} className="fixed inset-0 pointer-events-none z-[15]" />

      <motion.div
        drag
        dragMomentum={false}
        dragConstraints={constraintRef}
        dragElastic={0}
        className="fixed bottom-4 right-6 z-[15] glass rounded-sm p-3 flex items-center gap-3 cursor-grab active:cursor-grabbing select-none"
        style={{ touchAction: "none" }}
      >
        {/* Album cover */}
        <img
          src={currentTrack.cover}
          alt={currentTrack.title}
          className="w-14 h-14 rounded-sm object-cover flex-shrink-0"
          draggable={false}
        />

        {/* Right side: info + controls */}
        <div className="flex flex-col gap-0.5 min-w-0">
          {/* Title */}
          <span className="text-[11px] tracking-wider text-black/70 font-medium whitespace-nowrap truncate">
            {currentTrack.title}
          </span>
          {/* Artist */}
          <span className="text-[9px] tracking-wider text-black/30">
            Saint Vesper
          </span>
          {/* Controls — stop drag propagation on interactive elements */}
          <div onPointerDownCapture={(e) => e.stopPropagation()}>
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
              progressWidth="w-[140px]"
              className="items-start"
            />
          </div>
        </div>
      </motion.div>
    </>
  );
}
