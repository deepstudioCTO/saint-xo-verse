import { useState, useEffect, useRef } from "react";
import { downloadBlob } from "~/lib/audio-merge";
import { TRACKS } from "~/lib/data";

interface ConceptImageOption {
  id: string;
  name: string | null;
}

interface ImageDetailModalProps {
  open: boolean;
  onClose: () => void;
  generation: {
    id: string;
    memberId: string | null;
    musicId?: string | null;
    conceptImageId?: string | null;
    outputUrl: string | null;
    status: string;
    createdAt: string;
    prompt?: string | null;
  } | null;
  characterName: string;
  conceptImageName?: string | null;
  errorMessage?: string | null;
  onDelete?: (id: string) => void;
  conceptImages?: ConceptImageOption[];
  onMusicChange?: (id: string, musicId: string | null) => void;
  onConceptImageChange?: (id: string, conceptImageId: string | null, conceptImageName: string | null) => void;
}

export function ImageDetailModal({
  open,
  onClose,
  generation,
  characterName,
  conceptImageName,
  errorMessage,
  onDelete,
  conceptImages = [],
  onMusicChange,
  onConceptImageChange,
}: ImageDetailModalProps) {
  const [selectedMusicId, setSelectedMusicId] = useState<string | null>(null);
  const [showConceptDropdown, setShowConceptDropdown] = useState(false);
  const musicCarouselRef = useRef<HTMLDivElement>(null);
  const conceptDropdownRef = useRef<HTMLDivElement>(null);

  // Sync musicId when modal opens
  useEffect(() => {
    if (open && generation) {
      setSelectedMusicId(generation.musicId ?? null);
    }
  }, [open, generation?.id]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setShowConceptDropdown(false);
    }
  }, [open]);

  // Close concept dropdown when clicking outside
  useEffect(() => {
    if (!showConceptDropdown) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (conceptDropdownRef.current && !conceptDropdownRef.current.contains(e.target as Node)) {
        setShowConceptDropdown(false);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [showConceptDropdown]);

  const handleMusicSelect = async (musicId: string | null) => {
    if (!generation) return;

    setSelectedMusicId(musicId);

    try {
      await fetch("/api/update-music", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generationId: generation.id, musicId }),
      });
      onMusicChange?.(generation.id, musicId);
    } catch (err) {
      console.error("Failed to update music:", err);
    }
  };

  const handleConceptImageSelect = async (e: React.MouseEvent, conceptImageId: string | null) => {
    e.stopPropagation();
    if (!generation) return;

    setShowConceptDropdown(false);

    const conceptImage = conceptImages.find((ci) => ci.id === conceptImageId);
    const newConceptImageName = conceptImage?.name || null;

    try {
      const res = await fetch("/api/update-generation-concept-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generationId: generation.id, conceptImageId }),
      });

      const data = await res.json();

      if (!res.ok) {
        console.error("Failed to update concept image:", data.error);
        return;
      }

      onConceptImageChange?.(generation.id, conceptImageId, newConceptImageName);
    } catch (err) {
      console.error("Failed to update concept image:", err);
    }
  };

  if (!open || !generation) return null;

  const isFailed = generation.status === "failed";
  const displayConceptImageName = conceptImageName || "None";

  const handleDownload = async () => {
    if (!generation.outputUrl) return;

    const filename = `${characterName}_image.jpg`;

    try {
      const response = await fetch(generation.outputUrl);
      const blob = await response.blob();
      downloadBlob(blob, filename);
    } catch (err) {
      console.error("Download failed:", err);
    }
  };

  const handleShare = async () => {
    if (!generation.outputUrl) return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `${characterName} - Generated Image`,
          url: generation.outputUrl,
        });
      } catch (err) {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText(generation.outputUrl);
      alert("Link copied!");
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="relative w-full max-w-4xl mx-4 flex flex-col max-h-[90vh]">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -top-12 right-0 text-white/60 hover:text-white transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Image or Failed State */}
        <div className="relative bg-black rounded-lg overflow-hidden">
          {isFailed ? (
            <div className="flex flex-col items-center justify-center py-16 px-8">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-red-500 mb-4"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              <h3 className="text-lg font-medium text-white mb-2">Generation Failed</h3>
              {errorMessage && (
                <p className="text-sm text-neutral-400 text-center max-w-md">
                  {errorMessage}
                </p>
              )}
            </div>
          ) : generation.outputUrl ? (
            <img
              src={generation.outputUrl}
              alt={characterName}
              className="w-full max-h-[70vh] object-contain"
            />
          ) : null}
        </div>

        {/* Prompt display (if available) */}
        {!isFailed && generation.prompt && (
          <div className="bg-neutral-900 rounded-lg mt-2 px-4 py-3">
            <div className="flex items-center gap-2 mb-1">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-white/60"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span className="text-xs text-white/60">Prompt</span>
            </div>
            <p className="text-sm text-white/80 line-clamp-3">{generation.prompt}</p>
          </div>
        )}

        {/* Music carousel (only for completed) */}
        {!isFailed && (
          <div className="bg-neutral-900 rounded-lg mt-2 px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-white/60"
              >
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
              <span className="text-xs text-white/60">Music Track</span>
            </div>
            <div
              ref={musicCarouselRef}
              className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-hide"
            >
              {/* None option */}
              <button
                onClick={() => handleMusicSelect(null)}
                className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center transition-all ${
                  selectedMusicId === null
                    ? "bg-white/20 ring-2 ring-white"
                    : "bg-white/10 opacity-60 hover:opacity-100"
                }`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-white/60"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
              {/* Track options */}
              {TRACKS.map((track) => (
                <button
                  key={track.id}
                  onClick={() => handleMusicSelect(track.id)}
                  className={`flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden transition-all ${
                    selectedMusicId === track.id
                      ? "ring-2 ring-white"
                      : "opacity-60 hover:opacity-100"
                  }`}
                >
                  <img
                    src={track.cover}
                    alt={track.title}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Info bar */}
        <div className="bg-white rounded-lg mt-3 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-neutral-900">{characterName}</span>
            <span className="text-neutral-400">×</span>
            {/* Concept Image dropdown */}
            <div className="relative" ref={conceptDropdownRef}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowConceptDropdown(!showConceptDropdown);
                }}
                className="text-xs text-neutral-600 hover:text-neutral-900 transition-colors flex items-center gap-1"
              >
                {displayConceptImageName}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`transition-transform ${showConceptDropdown ? "rotate-180" : ""}`}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {/* Concept Image dropdown menu */}
              {showConceptDropdown && (
                <div
                  className="absolute bottom-full left-0 mb-1 w-48 bg-white rounded-lg shadow-xl border border-neutral-200 z-50 max-h-60 flex flex-col"
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <div className="px-3 py-2 bg-neutral-50 border-b border-neutral-200 flex-shrink-0">
                    <span className="text-xs font-medium text-neutral-500">Select Lego Item</span>
                  </div>
                  <div className="overflow-y-auto overscroll-contain flex-1">
                    {/* None option */}
                    <button
                      onClick={(e) => handleConceptImageSelect(e, null)}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-neutral-50 transition-colors ${
                        !generation.conceptImageId ? "bg-neutral-100 font-medium" : ""
                      }`}
                    >
                      None
                    </button>
                    {/* Concept image options */}
                    {conceptImages.map((ci) => (
                      <button
                        key={ci.id}
                        onClick={(e) => handleConceptImageSelect(e, ci.id)}
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-neutral-50 transition-colors truncate ${
                          generation.conceptImageId === ci.id ? "bg-neutral-100 font-medium" : ""
                        }`}
                      >
                        {ci.name || "Untitled"}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <span className="text-neutral-400">×</span>
            <span className="text-xs text-neutral-600">
              {selectedMusicId
                ? TRACKS.find((t) => t.id === selectedMusicId)?.title || "None"
                : "None"}
            </span>
            <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">Image</span>
          </div>
          <div className="flex items-center gap-4">
            {onDelete && (
              <button
                onClick={() => onDelete(generation.id)}
                className="text-xs font-medium text-red-500 hover:text-red-400 transition-colors"
              >
                Delete
              </button>
            )}

            {/* Show these buttons only for completed images */}
            {!isFailed && (
              <>
                <button
                  onClick={handleDownload}
                  className="text-xs font-medium text-neutral-600 hover:text-neutral-900 transition-colors"
                >
                  Download
                </button>

                <button
                  onClick={handleShare}
                  className="text-xs font-medium text-neutral-600 hover:text-neutral-900 transition-colors"
                >
                  Share
                </button>
              </>
            )}
            <span className="text-xs text-neutral-400">
              {new Date(generation.createdAt).toLocaleDateString("ko-KR")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
