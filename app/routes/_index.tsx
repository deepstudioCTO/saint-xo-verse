import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useNavigate, useLoaderData, useRevalidator, Link } from "react-router";
import type { Route } from "./+types/_index";
import { LargeTitle, Counter, StepIndicator } from "~/components/ui";
import { BackIcon, GalleryIcon, navButtonClass } from "~/components/layout/Header";
import { CHARACTERS as DEFAULT_CHARACTERS, type Character } from "~/lib/data";
import { getDb, characterImages, characters } from "~/lib/db.server";
import { asc } from "drizzle-orm";
import { VideoCanvas } from "~/components/effects/VideoCanvas";

// Video Modal Component
function VideoModal({
  videoType,
  onClose,
}: {
  videoType: "verse" | "bot";
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Stop video when closing
  const handleClose = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
    onClose();
  }, [onClose]);

  const videoSrc = videoType === "verse"
    ? "https://dloarazwucxtwykqzfow.supabase.co/storage/v1/object/public/motion-videos/intro-videos/verse.mp4"
    : "https://dloarazwucxtwykqzfow.supabase.co/storage/v1/object/public/motion-videos/intro-videos/bot.mp4";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      onClick={handleClose}
    >
      {/* Close button */}
      <button
        onClick={handleClose}
        className="absolute top-4 right-4 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {/* Video container */}
      <div
        className="relative w-full max-w-4xl mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <video
          ref={videoRef}
          src={videoSrc}
          autoPlay
          controls
          playsInline
          className="w-full rounded-lg"
        />
      </div>
    </div>
  );
}

export const meta: Route.MetaFunction = () => [
  { title: "Saint XO Verse" },
  { name: "description", content: "Fan-made short-form video creation platform" },
];

// Character image type from DB
interface CharacterImage {
  id: string;
  characterId: string;
  variantId: string;
  storagePath: string;
  publicUrl: string;
}

export async function loader({ context }: Route.LoaderArgs) {
  const db = getDb(context.cloudflare as { env: Record<string, string> });

  // Load characters from DB (sorted by displayOrder)
  const dbCharacters = await db
    .select()
    .from(characters)
    .orderBy(asc(characters.displayOrder));

  // Use DB characters if available, otherwise fallback to defaults
  const characterList: Character[] = dbCharacters.length > 0
    ? dbCharacters.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        video: c.video,
        poster: c.poster,
        displayOrder: c.displayOrder,
      }))
    : DEFAULT_CHARACTERS;

  // Load all character images from DB (sorted by createdAt so new images appear at end)
  const images = await db
    .select()
    .from(characterImages)
    .orderBy(asc(characterImages.characterId), asc(characterImages.createdAt));

  // Group by characterId
  const imagesByCharacter: Record<string, CharacterImage[]> = {};
  for (const img of images) {
    if (!imagesByCharacter[img.characterId]) {
      imagesByCharacter[img.characterId] = [];
    }
    imagesByCharacter[img.characterId].push(img);
  }

  return { characters: characterList, imagesByCharacter };
}

export default function Home() {
  const { characters: dbCharacters, imagesByCharacter } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const descInputRef = useRef<HTMLTextAreaElement>(null);

  // Local state for characters (for optimistic updates)
  const [characterList, setCharacterList] = useState<Character[]>(dbCharacters);

  // Sync with loader data when it changes
  useEffect(() => {
    setCharacterList(dbCharacters);
  }, [dbCharacters]);

  const selectedId = searchParams.get("selected");
  const urlVariant = searchParams.get("variant");
  const selectedIndex = characterList.findIndex((c) => c.id === selectedId);
  const isSelecting = selectedIndex >= 0;
  const currentCharacter = isSelecting ? characterList[selectedIndex] : null;

  // Track selected image variant per character
  const [selectedImageVariant, setSelectedImageVariant] = useState<Record<string, string>>({});
  const [hoveredImageId, setHoveredImageId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Inline editing state
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Video modal state
  const [openVideo, setOpenVideo] = useState<"verse" | "bot" | null>(null);

  // Get images for current character
  const currentImages = currentCharacter ? imagesByCharacter[currentCharacter.id] || [] : [];

  // Restore variant from URL when coming back from music page
  useEffect(() => {
    if (selectedId && urlVariant && urlVariant !== "default") {
      setSelectedImageVariant((prev) => ({
        ...prev,
        [selectedId]: urlVariant,
      }));
    }
  }, [selectedId, urlVariant]);

  // Handle image upload
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentCharacter) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("characterId", currentCharacter.id);

      const response = await fetch("/api/upload-character-image", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Upload failed");
      }

      revalidator.revalidate();
    } catch (error) {
      console.error("Upload error:", error);
      alert(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Handle name edit start
  const handleStartEditName = () => {
    if (!currentCharacter) return;
    setEditName(currentCharacter.name);
    setIsEditingName(true);
    setTimeout(() => nameInputRef.current?.focus(), 0);
  };

  // Handle description edit start
  const handleStartEditDescription = () => {
    if (!currentCharacter) return;
    setEditDescription(currentCharacter.description);
    setIsEditingDescription(true);
    setTimeout(() => descInputRef.current?.focus(), 0);
  };

  // Save name
  const handleSaveName = async () => {
    if (!currentCharacter || isSaving) return;
    const trimmedName = editName.trim();
    if (trimmedName.length === 0 || trimmedName === currentCharacter.name) {
      setIsEditingName(false);
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/update-character", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: currentCharacter.id, name: trimmedName }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Update failed");
      }

      // Optimistic update
      setCharacterList((prev) =>
        prev.map((c) => (c.id === currentCharacter.id ? { ...c, name: trimmedName } : c))
      );
      setIsEditingName(false);
    } catch (error) {
      console.error("Update error:", error);
      alert(error instanceof Error ? error.message : "Update failed");
    } finally {
      setIsSaving(false);
    }
  };

  // Save description
  const handleSaveDescription = async () => {
    if (!currentCharacter || isSaving) return;
    const trimmedDesc = editDescription.trim();
    if (trimmedDesc === currentCharacter.description) {
      setIsEditingDescription(false);
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/update-character", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: currentCharacter.id, description: trimmedDesc }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Update failed");
      }

      // Optimistic update
      setCharacterList((prev) =>
        prev.map((c) => (c.id === currentCharacter.id ? { ...c, description: trimmedDesc } : c))
      );
      setIsEditingDescription(false);
    } catch (error) {
      console.error("Update error:", error);
      alert(error instanceof Error ? error.message : "Update failed");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle name key down
  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSaveName();
    } else if (e.key === "Escape") {
      setIsEditingName(false);
    }
  };

  // Handle description key down
  const handleDescKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSaveDescription();
    } else if (e.key === "Escape") {
      setIsEditingDescription(false);
    }
  };

  // Handle image delete
  const handleDelete = async (imageId: string, variantId: string) => {
    if (!currentCharacter) return;

    // Don't allow deleting if it's the currently selected variant
    const currentSelected = selectedImageVariant[currentCharacter.id] || "default";
    if (variantId === currentSelected) {
      // Reset to default first
      setSelectedImageVariant((prev) => ({
        ...prev,
        [currentCharacter.id]: "default",
      }));
    }

    setDeleting(imageId);
    try {
      const response = await fetch("/api/delete-character-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: imageId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Delete failed");
      }

      revalidator.revalidate();
    } catch (error) {
      console.error("Delete error:", error);
      alert(error instanceof Error ? error.message : "Delete failed");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[--color-bg]">
      {/* Layer 1: Characters (full screen background) */}
      <div className="absolute inset-0 flex items-center justify-center">
        {characterList.map((character, index) => {
          const isSelected = index === selectedIndex;
          const diff = index - selectedIndex;
          const absDiff = Math.abs(diff);
          const centerIndex = (characterList.length - 1) / 2;

          // Position calculation
          const homeX = (index - centerIndex) * 165;
          const selectX = diff * 22;
          const x = isSelecting ? selectX : homeX;

          // Scale, opacity
          const baseScale = 3.5;
          let scale = 1;
          let opacity = 1;
          let grayscale = true;

          if (isSelecting) {
            if (isSelected) {
              scale = baseScale;
              opacity = 1;
              grayscale = false;
            } else if (absDiff === 1) {
              scale = baseScale * 0.5;
              opacity = 0.2;
            } else {
              scale = baseScale * 0.3;
              opacity = 0.08;
            }
          }

          return (
            <div
              key={character.id}
              className="absolute cursor-pointer transition-all duration-500 ease-out"
              style={{
                transform: isSelecting
                  ? `translateX(${x}vw) scale(${scale})`
                  : `translateX(${x}px) scale(${scale})`,
                opacity,
                zIndex: isSelected ? 10 : 5 - absDiff,
              }}
              onClick={() => setSearchParams({ selected: character.id })}
            >
              <div className="w-[5.5vw] min-w-[80px] max-w-[150px] aspect-[1/2] overflow-hidden">
                <VideoCanvas
                  src={character.video}
                  poster={character.poster}
                  preset="saintXo"
                  className="w-full h-full"
                  style={{
                    filter: grayscale ? "grayscale(100%)" : "grayscale(0%)",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Layer 2: Header */}
      <header className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          {isSelecting && (
            <button onClick={() => setSearchParams({})} className={navButtonClass}>
              <BackIcon />
            </button>
          )}
          <Link to="/gallery" className={navButtonClass}>
            <GalleryIcon />
          </Link>
        </div>
        <div className="flex items-center gap-3">
          {isSelecting && currentCharacter && (
            <StepIndicator label="CHARACTER" current={selectedIndex + 1} total={characterList.length} />
          )}
          {/* Verse and Bot video buttons */}
          <button
            onClick={() => setOpenVideo("verse")}
            className={navButtonClass}
            title="Verse Video"
          >
            <span className="text-lg">🌐</span>
          </button>
          <button
            onClick={() => setOpenVideo("bot")}
            className={navButtonClass}
            title="Bot Video"
          >
            <span className="text-lg">🤖</span>
          </button>
        </div>
      </header>

      {/* Layer 3: Title */}
      <div className="absolute top-20 left-0 right-0 z-20 px-6">
        {isSelecting && currentCharacter ? (
          <>
            {/* Character Name with inline edit */}
            <div className="group flex items-center gap-2">
              {isEditingName ? (
                <input
                  ref={nameInputRef}
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={handleNameKeyDown}
                  onBlur={handleSaveName}
                  disabled={isSaving}
                  className="text-3xl md:text-4xl font-bold bg-transparent border-b-2 border-white/50 focus:border-white outline-none text-[--color-text] w-full max-w-md"
                  style={{ fontFamily: "inherit" }}
                />
              ) : (
                <>
                  <LargeTitle>{currentCharacter.name}</LargeTitle>
                  <button
                    onClick={handleStartEditName}
                    className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity p-1 cursor-pointer"
                    title="Edit name"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                      <path d="m15 5 4 4" />
                    </svg>
                  </button>
                </>
              )}
            </div>
            {/* Character Description with inline edit */}
            <div className="group flex items-start gap-2 mt-2">
              {isEditingDescription ? (
                <textarea
                  ref={descInputRef}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  onKeyDown={handleDescKeyDown}
                  onBlur={handleSaveDescription}
                  disabled={isSaving}
                  rows={3}
                  className="text-sm bg-transparent border border-white/30 focus:border-white/50 rounded-lg outline-none text-[--color-text-secondary] w-full max-w-md p-2 resize-none leading-relaxed"
                />
              ) : (
                <>
                  <p className="text-sm text-[--color-text-secondary] max-w-md leading-relaxed">
                    {currentCharacter.description}
                  </p>
                  <button
                    onClick={handleStartEditDescription}
                    className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity p-1 flex-shrink-0 cursor-pointer"
                    title="Edit description"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                      <path d="m15 5 4 4" />
                    </svg>
                  </button>
                </>
              )}
            </div>
            {/* Image Variant Selection */}
            <div className="flex items-center gap-2 mt-4">
              {currentImages.map((img) => (
                <div
                  key={img.id}
                  className="relative"
                  onMouseEnter={() => setHoveredImageId(img.id)}
                  onMouseLeave={() => setHoveredImageId(null)}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedImageVariant((prev) => ({
                        ...prev,
                        [currentCharacter.id]: img.variantId,
                      }));
                    }}
                    className={`w-12 h-16 md:w-14 md:h-20 rounded overflow-hidden border-2 transition-all cursor-pointer ${
                      (selectedImageVariant[currentCharacter.id] || "default") === img.variantId
                        ? "border-white ring-2 ring-white/30"
                        : "border-transparent opacity-60 hover:opacity-100"
                    }`}
                  >
                    <img
                      src={img.publicUrl}
                      alt={`${currentCharacter.name} ${img.variantId}`}
                      className="w-full h-full object-cover object-top"
                    />
                  </button>
                  {/* Delete button on hover (not for last image) */}
                  {hoveredImageId === img.id && currentImages.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(img.id, img.variantId);
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
              {/* Add button */}
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
            <div className="flex items-center gap-3 mt-4 max-w-xs">
              <span className="text-xs text-[--color-text-tertiary] w-16">
                {String(selectedIndex + 1).padStart(2, "0")} / {String(characterList.length).padStart(2, "0")}
              </span>
              <input
                type="range"
                min="0"
                max={characterList.length - 1}
                value={selectedIndex}
                onChange={(e) => setSearchParams({ selected: characterList[parseInt(e.target.value)].id })}
                className="flex-1 h-1 bg-[--color-border] rounded-full appearance-none cursor-pointer
                  [&::-webkit-slider-thumb]:appearance-none
                  [&::-webkit-slider-thumb]:w-3
                  [&::-webkit-slider-thumb]:h-3
                  [&::-webkit-slider-thumb]:bg-[--color-text]
                  [&::-webkit-slider-thumb]:rounded-full
                  [&::-webkit-slider-thumb]:cursor-pointer
                "
              />
            </div>
          </>
        ) : (
          <>
            <LargeTitle>Saint XO Verse</LargeTitle>
            <Counter label="CHARACTERS" count={characterList.length} />
          </>
        )}
      </div>

      {/* Layer 4: Bottom Bar */}
      <div className="absolute bottom-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-4 bg-[--color-bg]">
        <span className="text-sm text-[--color-text-secondary]">
          {isSelecting && currentCharacter ? currentCharacter.name : `${characterList.length} CHARACTERS`}
        </span>
        <button
          onClick={
            isSelecting
              ? () => {
                  const selectedVariant = selectedImageVariant[currentCharacter?.id || ""] || "default";
                  const selectedImage = currentImages.find((img) => img.variantId === selectedVariant) || currentImages[0];
                  const imageUrl = selectedImage?.publicUrl || "";
                  navigate(`/motion?character=${currentCharacter?.id}&variant=${selectedVariant}&imageUrl=${encodeURIComponent(imageUrl)}`);
                }
              : () => setSearchParams({ selected: characterList[0].id })
          }
          className="px-4 py-2 text-sm font-medium bg-[--color-text] text-[--color-bg] rounded cursor-pointer"
        >
          {isSelecting ? "Select" : "Start"} →
        </button>
      </div>

      {/* Layer 5: Navigation (only when selecting) */}
      {isSelecting && (
        <div className="absolute bottom-20 left-0 right-0 z-20 flex items-center justify-between px-6">
          <button
            onClick={() => selectedIndex > 0 && setSearchParams({ selected: characterList[selectedIndex - 1].id })}
            disabled={selectedIndex === 0}
            className={`flex items-center gap-2 text-sm font-medium transition-all ${
              selectedIndex === 0 ? "opacity-30 cursor-not-allowed" : "opacity-70 hover:opacity-100 cursor-pointer"
            }`}
          >
            ← PREV
          </button>
          <button
            onClick={() => selectedIndex < characterList.length - 1 && setSearchParams({ selected: characterList[selectedIndex + 1].id })}
            disabled={selectedIndex === characterList.length - 1}
            className={`flex items-center gap-2 text-sm font-medium transition-all ${
              selectedIndex === characterList.length - 1 ? "opacity-30 cursor-not-allowed" : "opacity-70 hover:opacity-100 cursor-pointer"
            }`}
          >
            NEXT →
          </button>
        </div>
      )}

      {/* Video Modal */}
      {openVideo && (
        <VideoModal videoType={openVideo} onClose={() => setOpenVideo(null)} />
      )}
    </div>
  );
}
