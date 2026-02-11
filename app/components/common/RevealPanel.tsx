import type { ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useContentReady } from "~/hooks/useContentReady";

const REVEAL_DURATION = 0.35;

interface RevealPanelProps {
  open: boolean;
  children: (contentReady: boolean) => ReactNode;
  className?: string;
}

export function RevealPanel({ open, children, className }: RevealPanelProps) {
  const contentReady = useContentReady(open, REVEAL_DURATION * 1000);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ clipPath: "inset(100% 0 0 0 round 0.125rem)" }}
          animate={{ clipPath: "inset(0% 0 0 0 round 0.125rem)" }}
          exit={{ clipPath: "inset(100% 0 0 0 round 0.125rem)", transition: { duration: 0 } }}
          transition={{ duration: REVEAL_DURATION, ease: [0.25, 0.1, 0.25, 1] }}
          className={`w-full glass flex flex-col overflow-hidden ${className ?? ""}`}
        >
          {children(contentReady)}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
