import { type ReactNode, useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useAudioPlayer } from "~/hooks/useAudioPlayer";
import { GlassButton } from "~/components/ui";
import { MusicPlayerWidget } from "~/components/music/MusicPlayerWidget";

export type ActivePanel = null | "music-horizontal" | "skill-horizontal" | "skill-compact" | "skill-expanded" | "gallery-horizontal" | "gallery-compact" | "gallery-expanded" | "workflow-expanded" | "pricing-expanded";

interface HomeFloatingBarProps {
  characterId: string | null;
  characterImageUrl: string;
  lookbookId: string;
  activePanel: ActivePanel;
  onPanelChange: (panel: ActivePanel) => void;
  /** 선택된 스킬(템플릿) 썸네일 — SKILLS 버튼 미리보기 */
  selectedSkillThumbnailUrl: string | null;
  children?: ReactNode;
}

export function HomeFloatingBar({
  characterId,
  activePanel,
  onPanelChange,
  selectedSkillThumbnailUrl,
  children,
}: HomeFloatingBarProps) {
  const { currentTrack } = useAudioPlayer();

  // Derived booleans from activePanel
  const anyHorizontalOpen = activePanel === "skill-horizontal" || activePanel === "music-horizontal" || activePanel === "gallery-horizontal";
  const skillPanelOpen = activePanel === "skill-horizontal" || activePanel === "skill-compact" || activePanel === "skill-expanded";
  const anyPanelOpen = activePanel !== null;

  // ── Sequencing: buttons exit → panel enter, panel exit → buttons enter ──
  const [showButtons, setShowButtons] = useState(!anyHorizontalOpen);
  const pendingPanelRef = useRef<ActivePanel>(null);

  // Open horizontal panel: hide buttons first, open panel after exit completes
  function handleOpenPanel(panel: ActivePanel) {
    pendingPanelRef.current = panel;
    setShowButtons(false);
  }

  // When buttons finish exiting, fire the pending panel open
  function onButtonsExitComplete() {
    if (pendingPanelRef.current) {
      onPanelChange(pendingPanelRef.current);
      pendingPanelRef.current = null;
    }
  }

  // When horizontal panel closes externally, delay button show until panel exit animation finishes
  useEffect(() => {
    if (!anyHorizontalOpen && !showButtons && !pendingPanelRef.current) {
      const timer = setTimeout(() => setShowButtons(true), 300);
      return () => clearTimeout(timer);
    }
  }, [anyHorizontalOpen, showButtons]);

  return (
    <>
      {/* Music Player Widget — bottom right, draggable (hidden when any horizontal panel open) */}
      <div className={anyHorizontalOpen ? "opacity-0 pointer-events-none" : ""}>
        <MusicPlayerWidget />
      </div>

      {/* Bottom bar — panels + buttons (centered) */}
      <div className={`absolute bottom-4 left-1/2 -translate-x-1/2 ${anyHorizontalOpen ? "w-fit max-w-[calc(100vw-2rem)]" : "w-[36vw]"} ${anyPanelOpen ? "z-30" : "z-[15]"}`}>
        <div className="flex flex-col items-stretch gap-3">
        {children}
        <AnimatePresence onExitComplete={onButtonsExitComplete}>
        {showButtons && (
        <motion.div
          key="bottom-buttons"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="grid grid-cols-3 gap-2"
        >
        <GlassButton
          onClick={() => handleOpenPanel("music-horizontal")}
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
          onClick={() => skillPanelOpen ? onPanelChange(null) : handleOpenPanel("skill-horizontal")}
          disabled={!characterId}
          active={skillPanelOpen}
          className="text-left w-full"
        >
          <span className="flex items-center gap-2">
            {selectedSkillThumbnailUrl && (
              <img
                src={selectedSkillThumbnailUrl}
                alt=""
                className="w-5 h-5 rounded-sm object-cover"
              />
            )}
            SKILLS
          </span>
        </GlassButton>
        <GlassButton
          onClick={() => onPanelChange("gallery-expanded")}
          className="text-left w-full"
        >
          LIBRARY
        </GlassButton>
        </motion.div>
        )}
        </AnimatePresence>
        </div>
      </div>
    </>
  );
}
