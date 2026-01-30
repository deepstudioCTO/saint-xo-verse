import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router";
import type { Route } from "./+types/_index";
import { LargeTitle, Counter, StepIndicator } from "~/components/ui";
import { CHARACTERS } from "~/lib/data";

export const meta: Route.MetaFunction = () => [
  { title: "Saint XO Verse" },
  { name: "description", content: "Fan-made short-form video creation platform" },
];

export default function Home() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const selectedId = searchParams.get("selected");
  const urlVariant = searchParams.get("variant");
  const selectedIndex = CHARACTERS.findIndex((c) => c.id === selectedId);
  const isSelecting = selectedIndex >= 0;
  const currentCharacter = isSelecting ? CHARACTERS[selectedIndex] : null;

  // Track selected image variant per character
  const [selectedImageVariant, setSelectedImageVariant] = useState<Record<string, string>>({});

  // Restore variant from URL when coming back from music page
  useEffect(() => {
    if (selectedId && urlVariant && urlVariant !== "default") {
      setSelectedImageVariant((prev) => ({
        ...prev,
        [selectedId]: urlVariant,
      }));
    }
  }, [selectedId, urlVariant]);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[--color-bg]">
      {/* Layer 1: Characters (full screen background) */}
      <div className="absolute inset-0 flex items-center justify-center">
        {CHARACTERS.map((character, index) => {
          const isSelected = index === selectedIndex;
          const diff = index - selectedIndex;
          const absDiff = Math.abs(diff);
          const centerIndex = (CHARACTERS.length - 1) / 2;

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
              <div className="w-24 h-48 md:w-28 md:h-56 overflow-hidden">
                <video
                  src={character.video}
                  poster={character.poster}
                  autoPlay
                  loop
                  muted
                  playsInline
                  disablePictureInPicture
                  draggable={false}
                  className="w-full h-full object-cover object-top transition-all duration-500 ease-out select-none pointer-events-none"
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
        {isSelecting && (
          <button
            onClick={() => setSearchParams({})}
            className="text-sm font-medium"
          >
            ← Back
          </button>
        )}
        {isSelecting && currentCharacter && (
          <StepIndicator label="CHARACTER" current={selectedIndex + 1} total={CHARACTERS.length} />
        )}
      </header>

      {/* Layer 3: Title */}
      <div className="absolute top-20 left-0 right-0 z-20 px-6">
        {isSelecting && currentCharacter ? (
          <>
            <LargeTitle>{currentCharacter.name}</LargeTitle>
            <p className="text-sm text-[--color-text-secondary] mt-2 max-w-md leading-relaxed">
              {currentCharacter.description}
            </p>
            {/* Image Variant Selection */}
            {currentCharacter.images.length > 1 && (
              <div className="flex items-center gap-2 mt-4">
                {currentCharacter.images.map((img) => (
                  <button
                    key={img.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedImageVariant((prev) => ({
                        ...prev,
                        [currentCharacter.id]: img.id,
                      }));
                    }}
                    className={`w-12 h-16 md:w-14 md:h-20 rounded overflow-hidden border-2 transition-all ${
                      (selectedImageVariant[currentCharacter.id] || "default") === img.id
                        ? "border-white ring-2 ring-white/30"
                        : "border-transparent opacity-60 hover:opacity-100"
                    }`}
                  >
                    <img
                      src={img.thumbnail}
                      alt={`${currentCharacter.name} ${img.id}`}
                      className="w-full h-full object-cover object-top"
                    />
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-center gap-3 mt-4 max-w-xs">
              <span className="text-xs text-[--color-text-tertiary] w-16">
                {String(selectedIndex + 1).padStart(2, "0")} / {String(CHARACTERS.length).padStart(2, "0")}
              </span>
              <input
                type="range"
                min="0"
                max={CHARACTERS.length - 1}
                value={selectedIndex}
                onChange={(e) => setSearchParams({ selected: CHARACTERS[parseInt(e.target.value)].id })}
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
            <Counter label="CHARACTERS" count={CHARACTERS.length} />
          </>
        )}
      </div>

      {/* Layer 4: Bottom Bar */}
      <div className="absolute bottom-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-4 bg-[--color-bg]">
        <span className="text-sm text-[--color-text-secondary]">
          {isSelecting && currentCharacter ? currentCharacter.name : `${CHARACTERS.length} CHARACTERS`}
        </span>
        <button
          onClick={
            isSelecting
              ? () => navigate(`/music?character=${currentCharacter?.id}&variant=${selectedImageVariant[currentCharacter?.id || ""] || "default"}`)
              : () => setSearchParams({ selected: CHARACTERS[0].id })
          }
          className="px-4 py-2 text-sm font-medium bg-[--color-text] text-[--color-bg] rounded"
        >
          {isSelecting ? "Select" : "Start"} →
        </button>
      </div>

      {/* Layer 5: Navigation (only when selecting) */}
      {isSelecting && (
        <div className="absolute bottom-20 left-0 right-0 z-20 flex items-center justify-between px-6">
          <button
            onClick={() => selectedIndex > 0 && setSearchParams({ selected: CHARACTERS[selectedIndex - 1].id })}
            disabled={selectedIndex === 0}
            className={`flex items-center gap-2 text-sm font-medium transition-all ${
              selectedIndex === 0 ? "opacity-30 cursor-not-allowed" : "opacity-70 hover:opacity-100"
            }`}
          >
            ← PREV
          </button>
          <button
            onClick={() => selectedIndex < CHARACTERS.length - 1 && setSearchParams({ selected: CHARACTERS[selectedIndex + 1].id })}
            disabled={selectedIndex === CHARACTERS.length - 1}
            className={`flex items-center gap-2 text-sm font-medium transition-all ${
              selectedIndex === CHARACTERS.length - 1 ? "opacity-30 cursor-not-allowed" : "opacity-70 hover:opacity-100"
            }`}
          >
            NEXT →
          </button>
        </div>
      )}
    </div>
  );
}
