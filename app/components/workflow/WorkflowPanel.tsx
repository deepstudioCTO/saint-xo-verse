import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { useContentReady } from "~/hooks/useContentReady";

interface WorkflowTemplate {
  id: string;
  name: string;
  category: string | null;
  thumbnailUrl: string | null;
}

interface WorkflowPanelProps {
  open: boolean;
  onClose: () => void;
  templates: WorkflowTemplate[];
}

function TemplateItem({
  template,
  index,
}: {
  template: WorkflowTemplate;
  index: number;
}) {
  const navigate = useNavigate();
  const [isHovering, setIsHovering] = useState(false);

  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.03 }}
      onClick={() => navigate(`/editor?template=${template.id}`)}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      className="relative aspect-[3/4] rounded-sm overflow-hidden cursor-pointer"
    >
      {template.thumbnailUrl ? (
        <img
          src={template.thumbnailUrl}
          alt={template.name}
          loading="lazy"
          className={`absolute inset-0 w-full h-full object-cover transition-all duration-200 ${
            isHovering ? "grayscale-0" : "grayscale"
          }`}
        />
      ) : (
        <div className={`absolute inset-0 w-full h-full flex items-center justify-center transition-all duration-200 ${
          isHovering ? "bg-neutral-200" : "bg-neutral-100"
        }`}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-neutral-400">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M9 3v18" />
            <path d="M3 9h6" />
            <path d="M3 15h6" />
          </svg>
        </div>
      )}
      <span className="absolute bottom-1 left-1 text-[10px] text-white truncate max-w-[calc(100%-0.5rem)] drop-shadow">
        {template.name}
      </span>
      {template.category && (
        <span className="absolute top-1 right-1 text-[8px] bg-black/50 text-white/70 px-1 py-0.5 rounded">
          {template.category}
        </span>
      )}
    </motion.button>
  );
}

export function WorkflowPanel({ open, onClose, templates }: WorkflowPanelProps) {
  const contentReady = useContentReady(open, 250);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-[39]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            className="fixed top-20 left-6 right-6 bottom-14 z-[40] glass overflow-hidden flex flex-col rounded-2xl"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-3">
              <span className="text-xs font-medium tracking-wider uppercase text-black">Workflows</span>
              <button
                onClick={onClose}
                className="p-1.5 text-black/40 hover:text-black/70 transition-colors cursor-pointer"
                title="Close"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 pb-5">
              {!contentReady ? null : templates.length === 0 ? (
                <p className="text-center text-neutral-400 text-sm py-8">No workflow templates</p>
              ) : (
                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {templates.map((tmpl, i) => (
                    <TemplateItem key={tmpl.id} template={tmpl} index={i} />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
