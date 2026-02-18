import { useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { Persona } from "~/lib/data";

interface CharacterImage {
  id: string;
  characterId: string;
  variantId: string;
  storagePath: string;
  publicUrl: string;
}

interface InputImagePanelProps {
  open: boolean;
  onToggle: (open: boolean) => void;
  character: Persona;
  images: CharacterImage[];
  onSaveDefaultInput: (url: string | null) => void;
  onDeleteImage: (imageId: string) => void;
  onUploadImage: (file: File) => void;
  uploading: boolean;
  deleting: string | null;
}

function Thumbnail({
  src,
  alt,
  active,
  onClick,
}: {
  src: string;
  alt: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`w-10 h-14 md:w-12 md:h-16 rounded overflow-hidden transition-all duration-200 cursor-pointer ${
        active
          ? "opacity-100 grayscale-0"
          : "opacity-40 grayscale hover:opacity-70 hover:grayscale-0"
      }`}
    >
      <img src={src} alt={alt} className="w-full h-full object-cover object-top" />
    </button>
  );
}

export function InputImagePanel({
  open,
  onToggle,
  character,
  images,
  onSaveDefaultInput,
  onDeleteImage,
  onUploadImage,
  uploading,
  deleting,
}: InputImagePanelProps) {
  const [hoveredImageId, setHoveredImageId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onUploadImage(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <AnimatePresence mode="wait">
      {!open ? (
        <motion.button
          key="bar"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={() => onToggle(true)}
          className="w-[2px] h-14 rounded-full bg-black/[0.04] hover:bg-black/15 hover:w-[3px] transition-all duration-300 cursor-pointer"
        />
      ) : (
        <motion.div
          key="panel"
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -8 }}
          transition={{ duration: 0.2 }}
        >
          <div className="flex items-center gap-1.5 mb-2">
            <p className="text-[9px] tracking-wider text-black/50">INPUT IMAGE</p>
            <button
              onClick={() => onToggle(false)}
              className="text-black/30 hover:text-black/60 transition-colors cursor-pointer"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div className="flex items-center gap-2">
            {/* Poster (default) */}
            <Thumbnail
              src={character.poster}
              alt={`${character.name} poster`}
              active={!character.defaultInput}
              onClick={() => onSaveDefaultInput(null)}
            />
            {/* Variant images */}
            {images.map((img) => (
              <div
                key={img.id}
                className="relative"
                onMouseEnter={() => setHoveredImageId(img.id)}
                onMouseLeave={() => setHoveredImageId(null)}
              >
                <Thumbnail
                  src={img.publicUrl}
                  alt={`${character.name} ${img.variantId}`}
                  active={character.defaultInput === img.publicUrl}
                  onClick={() => onSaveDefaultInput(img.publicUrl)}
                />
                {hoveredImageId === img.id && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteImage(img.id);
                    }}
                    disabled={deleting === img.id}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-neutral-600 hover:bg-neutral-500 rounded-full flex items-center justify-center text-white transition-all cursor-pointer"
                  >
                    {deleting === img.id ? (
                      <span className="animate-spin text-xs">...</span>
                    ) : (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    )}
                  </button>
                )}
              </div>
            ))}
            {/* Upload */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              disabled={uploading}
              className="w-6 h-6 rounded-full bg-black hover:bg-neutral-800 flex items-center justify-center text-white transition-all cursor-pointer"
            >
              {uploading ? (
                <span className="animate-spin text-xs">...</span>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg"
              onChange={handleUpload}
              className="hidden"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
