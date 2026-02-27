import { type ReactNode, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useContentReady } from "~/hooks/useContentReady";

interface ExpandedPanelShellProps {
  open: boolean;
  onClose: () => void;
  escapeEnabled?: boolean;
  children: (contentReady: boolean) => ReactNode;
}

export function ExpandedPanelShell({
  open,
  onClose,
  escapeEnabled = true,
  children,
}: ExpandedPanelShellProps) {
  const contentReady = useContentReady(open, 250);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const escapeEnabledRef = useRef(escapeEnabled);
  escapeEnabledRef.current = escapeEnabled;

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && escapeEnabledRef.current) {
        onCloseRef.current();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[39]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed top-20 left-6 right-6 bottom-14 z-[40] glass overflow-hidden flex flex-col rounded-2xl"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
          >
            {children(contentReady)}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
