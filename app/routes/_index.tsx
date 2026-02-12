import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useSearchParams, useLoaderData, useRevalidator, useFetcher, Link } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { useGesture } from "@use-gesture/react";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, type DragStartEvent, type DragEndEvent, type DragMoveEvent, type Modifier } from "@dnd-kit/core";
import type { Route } from "./+types/_index";
import { LargeTitle } from "~/components/ui";
import { navButtonClass } from "~/components/layout/Header";
import {
  VERSES as DEFAULT_VERSES,
  VERSE_CHARACTERS as DEFAULT_VERSE_CHARACTERS,
  type Verse,
  type VerseCharacter,
} from "~/lib/data";
import { getDb, characterImages, verses, verseCharacters, motionVideos, conceptImages, generations } from "~/lib/db.server";
import { getPublicUrl } from "~/lib/supabase.server";
import { asc, desc, eq, sql } from "drizzle-orm";
import { VideoCanvas } from "~/components/effects/VideoCanvas";
import { SkillPanel, type SkillDragItem } from "~/components/skill/SkillPanel";
import { HomeFloatingBar, type ActivePanel } from "~/components/layout/HomeFloatingBar";
import { GalleryCompactPanel, GalleryExpandedPanel, GalleryModals } from "~/components/gallery";
import { useGalleryState } from "~/hooks/useGalleryState";
import { InputImagePanel } from "~/components/common/InputImagePanel";
import { useInlineEdit } from "~/hooks/useInlineEdit";
import { SkillConfirmDialog } from "~/components/common/SkillConfirmDialog";

const centerOnCursor: Modifier = ({ activatorEvent, activeNodeRect, transform }) => {
  if (!activatorEvent || !activeNodeRect) return transform;
  const ev = activatorEvent as PointerEvent;
  return {
    ...transform,
    x: transform.x + (ev.clientX - activeNodeRect.left - 30),
    y: transform.y + (ev.clientY - activeNodeRect.top - 40),
  };
};

function PencilIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

export const meta: Route.MetaFunction = () => [
  { title: "HitOS" },
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

export async function loader({ request, context }: Route.LoaderArgs) {
  const db = getDb(context.cloudflare as { env: Record<string, string> });
  const url = new URL(request.url);
  const verseParam = url.searchParams.get("verse") || "00";

  // Load all verses
  const dbVerses = await db
    .select()
    .from(verses)
    .orderBy(asc(verses.displayOrder));

  const verseList: Verse[] = dbVerses.length > 0
    ? dbVerses.map((v) => ({
        id: v.id,
        name: v.name,
        displayName: v.displayName,
        description: v.description,
        displayOrder: v.displayOrder,
      }))
    : DEFAULT_VERSES;

  // Load ALL verse characters (for preloading other verse videos)
  const dbAllVerseCharacters = await db
    .select()
    .from(verseCharacters)
    .orderBy(asc(verseCharacters.displayOrder));

  const allCharacters: VerseCharacter[] = dbAllVerseCharacters.length > 0
    ? dbAllVerseCharacters.map((vc) => ({
        id: vc.id,
        verseId: vc.verseId,
        characterId: vc.characterId,
        name: vc.name,
        description: vc.description,
        video: vc.video,
        poster: vc.poster,
        defaultInput: vc.defaultInput,
        displayOrder: vc.displayOrder,
      }))
    : DEFAULT_VERSE_CHARACTERS;

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

  // Load motion videos, concept images, and story count
  const cf = context.cloudflare as { env: Record<string, string> };
  const [dbVideos, dbConceptImages, storiesResult] = await Promise.all([
    db.select().from(motionVideos).orderBy(desc(motionVideos.createdAt)),
    db.select().from(conceptImages).orderBy(desc(conceptImages.createdAt)),
    db.select({ count: sql<number>`count(*)` }).from(generations).where(eq(generations.status, "completed")),
  ]);

  const skillVideos = dbVideos.map((v) => ({
    id: v.id,
    name: v.name,
    videoUrl: getPublicUrl(cf, v.storagePath),
    thumbnailUrl: v.thumbnailPath ? getPublicUrl(cf, v.thumbnailPath) : null,
    duration: v.duration,
  }));

  const skillImages = dbConceptImages.map((img) => ({
    id: img.id,
    name: img.name,
    publicUrl: img.publicUrl,
  }));

  const skillsCount = dbVideos.length;
  const storiesCount = Number(storiesResult[0]?.count || 0);

  return {
    verses: verseList,
    currentVerseId: verseParam,
    allCharacters,
    imagesByCharacter,
    skillsCount,
    storiesCount,
    skillVideos,
    skillImages,
  };
}

export default function Home() {
  const {
    verses: verseList,
    currentVerseId,
    allCharacters,
    imagesByCharacter,
    skillsCount,
    storiesCount,
    skillVideos,
    skillImages,
  } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const revalidator = useRevalidator();
  const savingRef = useRef(false);

  // Slide direction for verse transitions: 1=down, -1=up
  const [slideDirection, setSlideDirection] = useState(0);

  // Current verse characters (with optimistic update support)
  const dbCharacters = useMemo(
    () => allCharacters.filter((c) => c.verseId === currentVerseId),
    [allCharacters, currentVerseId]
  );
  const [characterList, setCharacterList] = useState<VerseCharacter[]>(dbCharacters);

  useEffect(() => {
    setCharacterList(dbCharacters);
  }, [currentVerseId, allCharacters]);

  const selectedId = searchParams.get("selected");
  const selectedIndex = characterList.findIndex((c) => c.characterId === selectedId);
  const isSelecting = selectedIndex >= 0;
  const currentCharacter = isSelecting ? characterList[selectedIndex] : null;

  // Verse list state (for optimistic updates)
  const [verseListState, setVerseListState] = useState<Verse[]>(verseList);
  useEffect(() => {
    setVerseListState(verseList);
  }, [verseList]);

  // Current verse (use stateful list for optimistic updates)
  const currentVerse = verseListState.find((v) => v.id === currentVerseId) || verseListState[0];
  const currentVerseIndex = verseListState.findIndex((v) => v.id === currentVerseId);

  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [inputPanelOpen, setInputPanelOpen] = useState(false);

  // Inline editing — character name
  const charNameEdit = useInlineEdit<HTMLInputElement>({
    onSave: async (trimmed) => {
      if (!currentCharacter) return;
      const response = await fetch("/api/update-verse-character", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verseId: currentVerseId, characterId: currentCharacter.characterId, name: trimmed }),
      });
      if (!response.ok) throw new Error((await response.json()).error || "Update failed");
      setCharacterList((prev) =>
        prev.map((c) =>
          c.characterId === currentCharacter.characterId && c.verseId === currentVerseId
            ? { ...c, name: trimmed } : c
        )
      );
    },
  });

  // Inline editing — character description
  const charDescEdit = useInlineEdit<HTMLTextAreaElement>({
    multiline: true,
    rejectEmpty: false,
    onSave: async (trimmed) => {
      if (!currentCharacter) return;
      const response = await fetch("/api/update-verse-character", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verseId: currentVerseId, characterId: currentCharacter.characterId, description: trimmed }),
      });
      if (!response.ok) throw new Error((await response.json()).error || "Update failed");
      setCharacterList((prev) =>
        prev.map((c) =>
          c.characterId === currentCharacter.characterId && c.verseId === currentVerseId
            ? { ...c, description: trimmed } : c
        )
      );
    },
  });

  // Inline editing — verse name
  const verseNameEdit = useInlineEdit<HTMLInputElement>({
    onSave: async (trimmed) => {
      if (!currentVerse) return;
      const response = await fetch("/api/update-verse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verseId: currentVerse.id, name: trimmed }),
      });
      if (!response.ok) throw new Error((await response.json()).error || "Update failed");
      setVerseListState((prev) =>
        prev.map((v) =>
          v.id === currentVerse.id
            ? { ...v, name: trimmed.toLowerCase(), displayName: trimmed } : v
        )
      );
    },
  });

  // Inline editing — verse description
  const verseDescEdit = useInlineEdit<HTMLTextAreaElement>({
    multiline: true,
    rejectEmpty: false,
    onSave: async (trimmed) => {
      if (!currentVerse) return;
      const response = await fetch("/api/update-verse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verseId: currentVerse.id, description: trimmed || null }),
      });
      if (!response.ok) throw new Error((await response.json()).error || "Update failed");
      setVerseListState((prev) =>
        prev.map((v) =>
          v.id === currentVerse.id ? { ...v, description: trimmed || null } : v
        )
      );
    },
  });

  // Hover state for character dimming
  const [hoveredCharacterId, setHoveredCharacterId] = useState<string | null>(null);

  // Get images for current character
  const currentImages = currentCharacter ? imagesByCharacter[currentCharacter.characterId] || [] : [];

  // Selected image URL (shared by SkillPanel and HomeFloatingBar)
  const selectedImgUrl = useMemo(() => {
    if (!currentCharacter) return "";
    return currentCharacter.defaultInput ?? currentCharacter.poster;
  }, [currentCharacter]);

  // Unified panel state — only one panel open at a time
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const skillPanelOpen = activePanel === "skill";
  const galleryCompactOpen = activePanel === "gallery-compact";
  const galleryExpandedOpen = activePanel === "gallery-expanded";
  const galleryState = useGalleryState(galleryCompactOpen || galleryExpandedOpen);
  const [skillTab, setSkillTab] = useState<"video" | "image">("video");
  const [selectedSkillVideoId, setSelectedSkillVideoId] = useState<string | null>(null);
  const [selectedSkillImageId, setSelectedSkillImageId] = useState<string | null>(null);

  // Resolved selected objects for HomeFloatingBar
  const selectedSkillVideo = useMemo(
    () => (selectedSkillVideoId ? skillVideos.find((v) => v.id === selectedSkillVideoId) ?? null : null),
    [selectedSkillVideoId, skillVideos]
  );
  const selectedSkillImage = useMemo(
    () => (selectedSkillImageId ? skillImages.find((img) => img.id === selectedSkillImageId) ?? null : null),
    [selectedSkillImageId, skillImages]
  );

  // === DnD: Drag-to-Persona Skill Teaching Flow ===
  const [activeDragItem, setActiveDragItem] = useState<SkillDragItem | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<SkillDragItem | null>(null);
  const [flyingCard, setFlyingCard] = useState<{
    thumbnailUrl: string;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  } | null>(null);
  const [flyingCardTargetId, setFlyingCardTargetId] = useState<string | null>(null);
  const personaRef = useRef<HTMLDivElement | null>(null);
  const galleryGridRef = useRef<HTMLDivElement | null>(null);
  const isDragging = activeDragItem !== null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const [isOverPersona, setIsOverPersona] = useState(false);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);

  const fetcher = useFetcher();
  const isGenerating = fetcher.state !== "idle";

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragItem(event.active.data.current as SkillDragItem);
    const ev = event.activatorEvent as PointerEvent;
    dragStartPos.current = { x: ev.clientX, y: ev.clientY };
  }, []);

  const handleDragMove = useCallback((event: DragMoveEvent) => {
    if (!dragStartPos.current || !personaRef.current) return;
    const px = dragStartPos.current.x + event.delta.x;
    const py = dragStartPos.current.y + event.delta.y;
    const rect = personaRef.current.getBoundingClientRect();
    const over = px >= rect.left && px <= rect.right && py >= rect.top && py <= rect.bottom;
    setIsOverPersona(over);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    if (dragStartPos.current && personaRef.current) {
      const px = dragStartPos.current.x + event.delta.x;
      const py = dragStartPos.current.y + event.delta.y;
      const rect = personaRef.current.getBoundingClientRect();
      if (px >= rect.left && px <= rect.right && py >= rect.top && py <= rect.bottom) {
        setConfirmDialog(event.active.data.current as SkillDragItem);
      }
    }
    setActiveDragItem(null);
    setIsOverPersona(false);
    dragStartPos.current = null;
  }, []);

  const handleProduce = useCallback((prompt?: string) => {
    if (!confirmDialog || !currentCharacter) return;

    // FLIP: measure start position from persona
    const personaRect = personaRef.current?.getBoundingClientRect();
    const startX = personaRect ? personaRect.left + personaRect.width / 2 - 30 : window.innerWidth / 2;
    const startY = personaRect ? personaRect.top + personaRect.height * 0.3 : window.innerHeight / 2;
    const thumbnailUrl = confirmDialog.thumbnailUrl;

    // Build FormData and submit
    const formData = new FormData();

    if (confirmDialog.type === "video") {
      formData.append("imageUrl", selectedImgUrl);
      formData.append("videoUrl", confirmDialog.videoUrl || "");
      formData.append("memberId", currentCharacter.characterId);
      formData.append("motionVideoId", confirmDialog.id);
      formData.append("verseId", currentVerseId);
      if (prompt) formData.append("prompt", prompt);
      fetcher.submit(formData, { method: "post", action: "/api/generate" });
    } else {
      formData.append("characterImageUrl", selectedImgUrl);
      formData.append("conceptImageUrl", confirmDialog.publicUrl || "");
      formData.append("conceptImageId", confirmDialog.id);
      formData.append("prompt", prompt || "");
      formData.append("memberId", currentCharacter.characterId);
      formData.append("verseId", currentVerseId);
      fetcher.submit(formData, { method: "post", action: "/api/generate-image" });
    }

    // Optimistic update: immediately add pending generation to gallery
    const optimisticId = `optimistic-${Date.now()}`;
    setFlyingCardTargetId(optimisticId);
    galleryState.addOptimisticGeneration({
      id: optimisticId,
      type: confirmDialog.type,
      memberId: currentCharacter.characterId,
      musicId: null,
      motionVideoId: confirmDialog.type === "video" ? confirmDialog.id : null,
      conceptImageId: confirmDialog.type === "image" ? confirmDialog.id : null,
      verseId: currentVerseId,
      videoUrl: null,
      outputUrl: null,
      status: "pending",
      createdAt: new Date().toISOString(),
      motionName: confirmDialog.type === "video" ? confirmDialog.name : null,
      conceptImageName: confirmDialog.type === "image" ? confirmDialog.name : null,
      errorMessage: null,
      prompt: prompt || null,
      upscaleStatus: null,
      upscaleModel: null,
      upscaledVideoUrl: null,
    });

    // Open gallery + close dialog
    setActivePanel("gallery-compact");
    setConfirmDialog(null);

    // FLIP: poll for gallery grid mount, measure first cell, then start flying card
    const pollForGrid = () => {
      const gridEl = galleryGridRef.current;
      if (gridEl) {
        const rect = gridEl.getBoundingClientRect();
        const cellW = (rect.width - 16) / 3; // grid-cols-3, 2 gaps of gap-2(8px)
        const endX = rect.left + cellW / 2 - 30; // center 60px card in cell
        const endY = rect.top + cellW - 40; // center 80px card (aspect-[3/4]) in cell (aspect-[1/2])
        setFlyingCard({ thumbnailUrl, startX, startY, endX, endY });
      } else {
        requestAnimationFrame(pollForGrid);
      }
    };
    requestAnimationFrame(pollForGrid);
  }, [confirmDialog, currentCharacter, selectedImgUrl, currentVerseId, fetcher, galleryState]);

  // Refetch gallery data when generation API completes (optimistic → real data)
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      galleryState.refetch();
    }
  }, [fetcher.state, fetcher.data, galleryState]);

  // Close panels and reset skill selections when character changes or deselects
  useEffect(() => {
    setActivePanel(null);
    setInputPanelOpen(false);
    setSelectedSkillVideoId(null);
    setSelectedSkillImageId(null);
  }, [selectedId]);

  // Verse navigation — just update the URL param, no loader rerun needed
  const handleVerseChange = useCallback((direction: "up" | "down") => {
    const newIndex = direction === "up"
      ? currentVerseIndex - 1
      : currentVerseIndex + 1;
    if (newIndex < 0 || newIndex >= verseListState.length) return;

    setSlideDirection(direction === "down" ? 1 : -1);
    setSearchParams({ verse: verseListState[newIndex].id }, { replace: true });
  }, [currentVerseIndex, verseListState, setSearchParams]);

  // Navigate to prev/next character
  const navigateCharacter = useCallback((direction: "prev" | "next") => {
    const idx = characterList.findIndex((c) => c.characterId === selectedId);
    if (idx < 0) return;
    const newIdx = direction === "prev" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= characterList.length) return;
    setSearchParams({ selected: characterList[newIdx].characterId, verse: currentVerseId });
  }, [characterList, selectedId, currentVerseId, setSearchParams]);

  // Keyboard arrow keys for verse + character navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isSelecting) {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          navigateCharacter("prev");
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          navigateCharacter("next");
        }
      }
      if (verseListState.length > 1) {
        if (e.key === "ArrowUp") {
          e.preventDefault();
          handleVerseChange("up");
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          handleVerseChange("down");
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSelecting, verseListState, handleVerseChange, navigateCharacter]);

  // Close compact panels on Escape
  useEffect(() => {
    if (!activePanel || activePanel === "gallery-expanded") return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActivePanel(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activePanel]);

  // Swipe (touch/mouse drag) + trackpad scroll for character navigation
  const charNavRef = useRef<HTMLDivElement>(null);
  const gestureActive = useRef(false);
  useGesture(
    {
      onDrag: ({ active, movement: [mx], direction: [dx], cancel }) => {
        if (!isSelecting || isDragging) return;
        if (active && Math.abs(mx) > 50) {
          cancel();
          navigateCharacter(dx > 0 ? "prev" : "next");
        }
      },
      onWheel: ({ event, direction: [dx], distance: [distX, distY] }) => {
        if (!isSelecting || distX < distY) return;
        event.preventDefault();
        if (gestureActive.current) return;
        if (distX > 60) {
          gestureActive.current = true;
          navigateCharacter(dx > 0 ? "next" : "prev");
          setTimeout(() => { gestureActive.current = false; }, 400);
        }
      },
    },
    {
      target: charNavRef,
      drag: { axis: "x", filterTaps: true },
      wheel: { eventOptions: { passive: false } },
    },
  );

  // Handle image upload
  const handleUpload = async (file: File) => {
    if (!currentCharacter) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("characterId", currentCharacter.characterId);

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
    }
  };

  // Save defaultInput (optimistic update + API persist)
  const handleSaveDefaultInput = useCallback(async (url: string | null) => {
    if (!currentCharacter || savingRef.current) return;
    savingRef.current = true;

    setCharacterList((prev) =>
      prev.map((c) =>
        c.characterId === currentCharacter.characterId && c.verseId === currentVerseId
          ? { ...c, defaultInput: url }
          : c
      )
    );

    try {
      const response = await fetch("/api/update-verse-character", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verseId: currentVerseId,
          characterId: currentCharacter.characterId,
          defaultInput: url,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Update failed");
      }
    } catch (error) {
      console.error("DefaultInput update error:", error);
      revalidator.revalidate();
    } finally {
      savingRef.current = false;
    }
  }, [currentCharacter, currentVerseId, revalidator]);

  // Handle image delete
  const handleDelete = async (imageId: string) => {
    if (!currentCharacter) return;

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

      // If deleted image was the defaultInput, reset it
      const deletedImage = currentImages.find((img) => img.id === imageId);
      if (deletedImage && currentCharacter.defaultInput === deletedImage.publicUrl) {
        await handleSaveDefaultInput(null);
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
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragMove={handleDragMove} onDragEnd={handleDragEnd}>
    <div className="relative w-full h-screen overflow-hidden bg-[--color-bg]">
      {/* Layer 1: Current verse characters (AnimatePresence slide transition) */}
      <AnimatePresence mode="wait" initial={false} custom={slideDirection}>
        <motion.div
          key={currentVerseId}
          custom={slideDirection}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          ref={charNavRef}
          className="absolute inset-0 flex items-center justify-center overflow-hidden touch-none"
        >
          {characterList.map((character, index) => {
            const isSelected = index === selectedIndex;
            const diff = index - selectedIndex;
            const absDiff = Math.abs(diff);
            const centerIndex = (characterList.length - 1) / 2;

            const homeX = (index - centerIndex) * 165;
            const selectX = diff * 22;
            const x = isSelecting ? selectX : homeX;

            const baseScale = 3.5;
            let scale = 1;
            let opacity = 1;

            if (isSelecting) {
              if (isSelected) {
                scale = baseScale;
                opacity = 1;
              } else if (absDiff === 1) {
                scale = baseScale * 0.5;
                opacity = 0.2;
              } else {
                scale = baseScale * 0.3;
                opacity = 0.08;
              }
            } else {
              // Home view: dim non-hovered characters
              if (hoveredCharacterId && character.characterId !== hoveredCharacterId) {
                opacity = 0.3;
              }
            }

            return (
              <div
                key={`${character.verseId}-${character.characterId}`}
                ref={isSelected ? (node: HTMLDivElement | null) => {
                  personaRef.current = node;
                } : undefined}
                className="absolute cursor-pointer transition-[transform,opacity] duration-500 ease-out"
                style={{
                  transform: isSelecting
                    ? `translateX(${x}vw) scale(${scale})`
                    : `translateX(${x}px) scale(${scale})`,
                  opacity,
                  zIndex: isSelected ? 10 : 5 - absDiff,
                }}
                onClick={() => {
                  if (isSelecting && character.characterId === selectedId) {
                    return;
                  }
                  setSearchParams({ selected: character.characterId, verse: currentVerseId });
                }}
                onMouseEnter={() => !isSelecting && setHoveredCharacterId(character.characterId)}
                onMouseLeave={() => !isSelecting && setHoveredCharacterId(null)}
              >
                {/* Glow effect during drag */}
                {isSelected && isDragging && (
                  <div
                    className={`absolute -inset-[3px] rounded-sm ${isOverPersona ? "persona-glow-intense" : "persona-glow"} transition-opacity duration-300`}
                    style={{ zIndex: -1 }}
                  />
                )}
                <div
                  className="w-[5.5vw] min-w-[80px] max-w-[150px] aspect-[1/2] overflow-hidden rounded-sm"
                  style={{
                    backgroundImage: character.poster ? `url(${character.poster})` : undefined,
                    backgroundSize: "cover",
                    backgroundPosition: "center top",
                  }}
                >
                  <VideoCanvas
                    src={character.video}
                    poster={character.poster}
                    preset="saintXo"
                    className="w-full h-full"
                  />
                </div>
              </div>
            );
          })}
        </motion.div>
      </AnimatePresence>

      {/* Layer 2: Header */}
      <header className="absolute top-0 left-0 right-0 z-[45] flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <Link to="/" className="text-lg font-black italic tracking-wider text-black cursor-pointer hover:opacity-70 transition-opacity" style={{ fontWeight: 900 }}>HitOS</Link>
            <div className="flex items-center gap-3 text-[10px] tracking-wider mt-1.5">
              <button onClick={() => setActivePanel(prev => prev === "skill" ? null : "skill")} disabled={!isSelecting} className="flex items-center gap-2 cursor-pointer hover:opacity-70 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"><span className="font-semibold text-black">SKILLS</span><span className="text-gray-400">{String(skillsCount).padStart(2, "0")}</span></button>
              <button onClick={() => setActivePanel(prev => prev === "gallery-compact" || prev === "gallery-expanded" ? null : "gallery-compact")} className="flex items-center gap-2 cursor-pointer hover:opacity-70 transition-opacity"><span className="font-semibold text-black">GALLERY</span><span className="text-gray-400">{String(storiesCount).padStart(2, "0")}</span></button>
            </div>
          </div>
        </div>
      </header>

      {/* Layer 3: Title */}
      <div className="absolute top-28 left-0 right-0 z-20 px-6">
        {isSelecting && currentCharacter ? (
          <>
            {/* Character Step Indicator */}
            <p className="text-[10px] tracking-wider text-black mb-1">PERSONA {String(selectedIndex + 1).padStart(2, "0")} / {String(characterList.length).padStart(2, "0")}</p>
            {/* Character Name with inline edit */}
            <div className="group flex items-center gap-2">
              {charNameEdit.isEditing ? (
                <input
                  ref={charNameEdit.ref}
                  type="text"
                  value={charNameEdit.value}
                  onChange={(e) => charNameEdit.setValue(e.target.value)}
                  onKeyDown={charNameEdit.keyDown}
                  onBlur={charNameEdit.save}
                  disabled={charNameEdit.isSaving}
                  className="text-3xl md:text-4xl font-bold bg-transparent border-b-2 border-white/50 focus:border-white outline-none text-[--color-text] w-full max-w-md"
                  style={{ fontFamily: "inherit" }}
                />
              ) : (
                <>
                  <LargeTitle>{currentCharacter.name}</LargeTitle>
                  <button
                    onClick={() => charNameEdit.startEdit(currentCharacter.name)}
                    className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity p-1 cursor-pointer"
                    title="Edit name"
                  >
                    <PencilIcon size={16} />
                  </button>
                </>
              )}
            </div>
            {/* Character Description with inline edit */}
            <div className="group flex items-start gap-2 mt-2">
              {charDescEdit.isEditing ? (
                <textarea
                  ref={charDescEdit.ref}
                  value={charDescEdit.value}
                  onChange={(e) => charDescEdit.setValue(e.target.value)}
                  onKeyDown={charDescEdit.keyDown}
                  onBlur={charDescEdit.save}
                  disabled={charDescEdit.isSaving}
                  rows={3}
                  className="text-sm bg-transparent border border-white/30 focus:border-white/50 rounded-lg outline-none text-[--color-text-secondary] w-full max-w-md p-2 resize-none leading-relaxed"
                />
              ) : (
                <>
                  <p className="text-sm text-[--color-text-secondary] max-w-md leading-relaxed">
                    {currentCharacter.description}
                  </p>
                  <button
                    onClick={() => charDescEdit.startEdit(currentCharacter.description)}
                    className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity p-1 flex-shrink-0 cursor-pointer"
                    title="Edit description"
                  >
                    <PencilIcon size={14} />
                  </button>
                </>
              )}
            </div>
          </>
        ) : (
          <AnimatePresence mode="wait" custom={slideDirection}>
            <motion.div
              key={currentVerseId}
              custom={slideDirection}
              initial={{ opacity: 0, y: slideDirection * 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -slideDirection * 10 }}
              transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
            >
              <span className="text-[10px] font-medium tracking-wider text-black mb-1">COLLECTION&ensp;{String(currentVerseIndex + 1).padStart(2, "0")}/{String(verseListState.length).padStart(2, "0")}</span>
              {/* Verse Name with inline edit */}
              <div className="group flex items-center gap-2">
                {verseNameEdit.isEditing ? (
                  <input
                    ref={verseNameEdit.ref}
                    type="text"
                    value={verseNameEdit.value}
                    onChange={(e) => verseNameEdit.setValue(e.target.value)}
                    onKeyDown={verseNameEdit.keyDown}
                    onBlur={verseNameEdit.save}
                    disabled={verseNameEdit.isSaving}
                    className="text-3xl md:text-4xl font-bold bg-transparent border-b-2 border-white/50 focus:border-white outline-none text-[--color-text] w-full max-w-md"
                    style={{ fontFamily: "inherit" }}
                  />
                ) : (
                  <>
                    <LargeTitle>{currentVerse ? currentVerse.name.toUpperCase() : "HitOS"}</LargeTitle>
                    <button
                      onClick={() => verseNameEdit.startEdit(currentVerse.displayName)}
                      className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity p-1 cursor-pointer"
                      title="Edit verse name"
                    >
                      <PencilIcon size={16} />
                    </button>
                  </>
                )}
              </div>
              {/* Verse Description with inline edit */}
              <div className="group flex items-start gap-2 mt-2">
                {verseDescEdit.isEditing ? (
                  <textarea
                    ref={verseDescEdit.ref}
                    value={verseDescEdit.value}
                    onChange={(e) => verseDescEdit.setValue(e.target.value)}
                    onKeyDown={verseDescEdit.keyDown}
                    onBlur={verseDescEdit.save}
                    disabled={verseDescEdit.isSaving}
                    rows={2}
                    className="text-sm bg-transparent border border-white/30 focus:border-white/50 rounded-lg outline-none text-[--color-text-secondary] w-full max-w-md p-2 resize-none leading-relaxed"
                    placeholder="Add verse description..."
                  />
                ) : (
                  <>
                    {currentVerse?.description ? (
                      <p className="text-sm text-[--color-text-secondary] max-w-md leading-relaxed">
                        {currentVerse.description}
                      </p>
                    ) : (
                      <p className="text-sm text-[--color-text-secondary]/40 max-w-md leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity">
                        Add description...
                      </p>
                    )}
                    <button
                      onClick={() => verseDescEdit.startEdit(currentVerse?.description || "")}
                      className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity p-1 flex-shrink-0 cursor-pointer"
                      title="Edit verse description"
                    >
                      <PencilIcon size={14} />
                    </button>
                  </>
                )}
              </div>
              <span className="flex items-center text-[10px] tracking-wider text-black mt-8"><span className="font-medium w-40">PERSONAS</span><span className="font-bold">{String(characterList.length).padStart(2, "0")}</span></span>
              <span className="flex items-center text-[10px] tracking-wider text-black mt-2"><span className="font-medium w-40">MODE</span><span className="font-bold">{currentVerse?.id === "00" ? "XO" : "XX"}</span></span>
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* Image Input Selection — subtle bar toggle + expandable panel */}
      <AnimatePresence>
        {isSelecting && currentCharacter && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute top-[300px] left-6 z-20"
          >
            <InputImagePanel
              open={inputPanelOpen}
              onToggle={setInputPanelOpen}
              character={currentCharacter}
              images={currentImages}
              verseId={currentVerseId}
              onSaveDefaultInput={handleSaveDefaultInput}
              onDeleteImage={handleDelete}
              onUploadImage={handleUpload}
              uploading={uploading}
              deleting={deleting}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Bar */}
      {/* Click-outside backdrop for compact panels (music/skill/gallery-compact) */}
      {activePanel && activePanel !== "gallery-expanded" && (
        <div className="fixed inset-0 z-[25]" onClick={() => setActivePanel(null)} />
      )}

      <HomeFloatingBar
        characterId={currentCharacter?.characterId ?? null}
        characterImageUrl={selectedImgUrl}
        verseId={currentVerseId}
        activePanel={activePanel}
        onPanelChange={setActivePanel}
        selectedVideo={selectedSkillVideo}
        selectedImage={selectedSkillImage}
      >
        {isSelecting && currentCharacter && (
          <SkillPanel
            open={skillPanelOpen}
            videos={skillVideos}
            images={skillImages}
            tab={skillTab}
            selectedVideoId={selectedSkillVideoId}
            selectedImageId={selectedSkillImageId}
            onTabChange={(t) => {
              setSkillTab(t);
              if (t === "video") setSelectedSkillImageId(null);
              else setSelectedSkillVideoId(null);
            }}
            onSelectVideo={(id) => { setSelectedSkillVideoId(id); if (id) setActivePanel(null); }}
            onSelectImage={(id) => { setSelectedSkillImageId(id); if (id) setActivePanel(null); }}
          />
        )}
        <GalleryCompactPanel
          open={galleryCompactOpen}
          onExpand={() => setActivePanel("gallery-expanded")}
          galleryState={galleryState}
          gridRef={galleryGridRef}
          flyingCardTargetId={flyingCardTargetId}
        />
      </HomeFloatingBar>

      {/* Verse Navigation (right side, only when not selecting) */}
      {!isSelecting && verseListState.length > 1 && (
        <div className="absolute right-6 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-3">
          <button
            onClick={() => handleVerseChange("up")}
            disabled={currentVerseIndex === 0}
            className={`${navButtonClass} ${
              currentVerseIndex === 0 ? "opacity-30 cursor-not-allowed" : "cursor-pointer"
            }`}
            title="Previous Verse"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="18 15 12 9 6 15" />
            </svg>
          </button>

          {/* Verse indicator dots */}
          <div className="flex flex-col items-center gap-1.5 py-1">
            {verseListState.map((v, i) => (
              <div
                key={v.id}
                className={`w-1.5 h-1.5 rounded-full transition-all ${
                  i === currentVerseIndex ? "bg-white scale-125" : "bg-white/30"
                }`}
              />
            ))}
          </div>

          <button
            onClick={() => handleVerseChange("down")}
            disabled={currentVerseIndex === verseListState.length - 1}
            className={`${navButtonClass} ${
              currentVerseIndex === verseListState.length - 1 ? "opacity-30 cursor-not-allowed" : "cursor-pointer"
            }`}
            title="Next Verse"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
      )}

      {/* Gallery Expanded Panel */}
      <GalleryExpandedPanel
        open={galleryExpandedOpen}
        onClose={() => setActivePanel(null)}
        onCollapse={() => setActivePanel("gallery-compact")}
        galleryState={galleryState}
        verseId={currentVerseId}
      />

      {/* Gallery Modals — root level so z-50 escapes all stacking contexts */}
      <GalleryModals galleryState={galleryState} />

    </div>

    {/* DragOverlay — outside overflow:hidden container */}
    <DragOverlay modifiers={[centerOnCursor]} dropAnimation={null}>
      {activeDragItem && (
        <div className="w-[60px] aspect-[3/4] rounded-sm overflow-hidden shadow-lg">
          <img src={activeDragItem.thumbnailUrl} alt="" className="w-full h-full object-cover" />
        </div>
      )}
    </DragOverlay>

    {/* Skill confirm dialog */}
    <SkillConfirmDialog
      open={confirmDialog !== null}
      item={confirmDialog}
      onCancel={() => setConfirmDialog(null)}
      onProduce={handleProduce}
      isProducing={isGenerating}
    />

    {/* Flying card animation */}
    <AnimatePresence>
      {flyingCard && (
        <motion.div
          className="fixed top-0 left-0 z-[60] w-[60px] aspect-[3/4] pointer-events-none rounded-sm overflow-hidden"
          initial={{
            x: flyingCard.startX,
            y: flyingCard.startY,
            scale: 1,
            opacity: 1,
          }}
          animate={{
            x: [flyingCard.startX, flyingCard.startX + (flyingCard.endX - flyingCard.startX) * 0.4, flyingCard.endX, flyingCard.endX],
            y: [flyingCard.startY, flyingCard.startY - 80, flyingCard.endY, flyingCard.endY],
            scale: [1, 0.8, 0.5, 0.3],
            opacity: [1, 1, 1, 0],
          }}
          transition={{
            duration: 0.6,
            times: [0, 0.35, 0.75, 1],
          }}
          onAnimationComplete={() => {
            setFlyingCard(null);
            setFlyingCardTargetId(null);
          }}
        >
          <img src={flyingCard.thumbnailUrl} alt="" className="w-full h-full object-cover" />
        </motion.div>
      )}
    </AnimatePresence>

    </DndContext>
  );
}
