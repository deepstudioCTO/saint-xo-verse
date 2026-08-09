import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { GlassButton } from "~/components/ui";
import type { SkillDragItem } from "~/components/skill/SkillPanel";

interface SkillConfirmDialogProps {
  open: boolean;
  item: SkillDragItem | null;
  onCancel: () => void;
  onProduce: (prompt?: string) => void;
  isProducing: boolean;
}

export function SkillConfirmDialog({
  open,
  item,
  onCancel,
  onProduce,
  isProducing,
}: SkillConfirmDialogProps) {
  const [prompt, setPrompt] = useState("");
  const isImage = item?.category === "image";

  const handleProduce = () => {
    onProduce(isImage ? prompt || undefined : undefined);
    setPrompt("");
  };

  const handleCancel = () => {
    onCancel();
    setPrompt("");
  };

  return (
    <AnimatePresence>
      {open && item && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[55] bg-black/30 flex items-center justify-center"
          onClick={handleCancel}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="glass p-5 w-[320px] flex flex-col items-center gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Skill thumbnail */}
            <div className="w-[80px] aspect-[3/4] rounded-sm overflow-hidden">
              <img
                src={item.thumbnailUrl}
                alt={item.name}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Title */}
            <div className="text-center">
              <p className="text-xs font-semibold tracking-wider text-black/70">
                Teach this skill?
              </p>
              <p className="text-[10px] tracking-wider text-black/40 mt-1">
                {item.name}
              </p>
            </div>

            {/* Prompt input — only for image skills */}
            {isImage && (
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isProducing) handleProduce();
                }}
                placeholder="Describe what to generate..."
                className="w-full px-3 py-2 text-xs glass-bg rounded-sm text-black/70 placeholder:text-black/25 outline-none"
              />
            )}

            {/* Buttons */}
            <div className="flex items-center gap-2 w-full">
              <GlassButton
                onClick={handleCancel}
                disabled={isProducing}
                className="flex-1 justify-center"
              >
                No
              </GlassButton>
              <GlassButton
                variant="bold"
                onClick={handleProduce}
                disabled={isProducing || (isImage && !prompt.trim())}
                className="flex-1 justify-center"
              >
                {isProducing ? "Producing..." : "Produce"}
              </GlassButton>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
