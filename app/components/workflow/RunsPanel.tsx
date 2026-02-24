import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { useContentReady } from "~/hooks/useContentReady";

interface RunItem {
  id: string;
  status: string;
  thumbnailUrl: string | null;
  outputUrl: string | null;
  outputType: string | null;
  characterId: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

interface RunsPanelProps {
  open: boolean;
  onClose: () => void;
}

function RunGridItem({ run, index }: { run: RunItem; index: number }) {
  const navigate = useNavigate();
  const [isHovering, setIsHovering] = useState(false);

  const isCompleted = run.status === "completed";
  const isFailed = run.status === "failed";
  const isPending = run.status === "pending" || run.status === "processing" || run.status === "running";

  const displayUrl = isCompleted && run.outputUrl ? run.outputUrl : run.thumbnailUrl;
  const isVideo = isCompleted && run.outputType === "video" && run.outputUrl;

  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.03 }}
      onClick={() => navigate(`/editor?run=${run.id}`)}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      className="relative aspect-[3/4] rounded-sm overflow-hidden cursor-pointer"
    >
      {isVideo && isHovering ? (
        <video
          src={run.outputUrl!}
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : displayUrl ? (
        <img
          src={displayUrl}
          alt={run.characterId || "run"}
          loading="lazy"
          className={`absolute inset-0 w-full h-full object-cover transition-all duration-200 ${
            isHovering ? "grayscale-0" : isCompleted ? "grayscale-[0.3]" : "grayscale"
          }`}
        />
      ) : (
        <div className="absolute inset-0 w-full h-full bg-neutral-100 flex items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-neutral-400">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
        </div>
      )}

      {/* Pending/Processing overlay */}
      {isPending && (
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Failed overlay */}
      {isFailed && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </div>
      )}

      {/* Status badge */}
      <span className={`absolute top-1 right-1 text-[8px] px-1 py-0.5 rounded ${
        isCompleted ? "bg-green-500/70 text-white" :
        isFailed ? "bg-red-500/70 text-white" :
        "bg-yellow-500/70 text-white"
      }`}>
        {run.status}
      </span>

      {/* Character ID */}
      {run.characterId && (
        <span className="absolute bottom-1 left-1 text-[10px] text-white truncate max-w-[calc(100%-0.5rem)] drop-shadow">
          {run.characterId}
        </span>
      )}
    </motion.button>
  );
}

export function RunsPanel({ open, onClose }: RunsPanelProps) {
  const contentReady = useContentReady(open, 250);
  const [runs, setRuns] = useState<RunItem[]>([]);
  const [loading, setLoading] = useState(false);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Fetch runs data when opened
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/runs-data")
      .then((res) => res.json())
      .then((data) => {
        setRuns(data.runs || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [open]);

  // Escape to close
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
              <span className="text-xs font-medium tracking-wider uppercase text-black">Runs</span>
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
              {!contentReady || loading ? null : runs.length === 0 ? (
                <p className="text-center text-neutral-400 text-sm py-8">No workflow runs</p>
              ) : (
                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {runs.map((run, i) => (
                    <RunGridItem key={run.id} run={run} index={i} />
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
