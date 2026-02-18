import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useFetcher } from "react-router";
import { PointerSensor, useSensor, useSensors, type DragStartEvent, type DragEndEvent, type DragMoveEvent } from "@dnd-kit/core";
import type { SkillDragItem } from "~/components/skill/SkillPanel";
import type { ActivePanel } from "~/components/layout/HomeFloatingBar";
import type { Persona } from "~/lib/data";
import type { UseGalleryStateReturn } from "~/hooks/useGalleryState";

interface SkillVideo {
  id: string;
  name: string;
  videoUrl: string;
  thumbnailUrl: string | null;
  duration: number;
}

interface SkillImage {
  id: string;
  name: string | null;
  publicUrl: string;
}

export interface FlyingCardState {
  thumbnailUrl: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

interface UseSkillTeachingParams {
  currentCharacter: Persona | null;
  currentLookbookId: string;
  currentLookId: string;
  selectedImgUrl: string;
  skillVideos: SkillVideo[];
  skillImages: SkillImage[];
  galleryState: UseGalleryStateReturn;
  activePanel: ActivePanel;
  setActivePanel: (p: ActivePanel) => void;
  selectedId: string | null;
}

export function useSkillTeaching({
  currentCharacter,
  currentLookbookId,
  currentLookId,
  selectedImgUrl,
  skillVideos,
  skillImages,
  galleryState,
  activePanel,
  setActivePanel,
  selectedId,
}: UseSkillTeachingParams) {
  // Skill selection state
  const [skillTab, setSkillTab] = useState<"video" | "image">("video");
  const [selectedSkillVideoId, setSelectedSkillVideoId] = useState<string | null>(null);
  const [selectedSkillImageId, setSelectedSkillImageId] = useState<string | null>(null);

  const handleSkillTabChange = useCallback((t: "video" | "image") => {
    setSkillTab(t);
    if (t === "video") setSelectedSkillImageId(null);
    else setSelectedSkillVideoId(null);
  }, []);
  const handleSkillSelectVideo = useCallback((id: string | null) => {
    setSelectedSkillVideoId(id);
    if (id) setActivePanel(null);
  }, [setActivePanel]);
  const handleSkillSelectImage = useCallback((id: string | null) => {
    setSelectedSkillImageId(id);
    if (id) setActivePanel(null);
  }, [setActivePanel]);

  // Resolved selected objects
  const selectedSkillVideo = useMemo(
    () => (selectedSkillVideoId ? skillVideos.find((v) => v.id === selectedSkillVideoId) ?? null : null),
    [selectedSkillVideoId, skillVideos]
  );
  const selectedSkillImage = useMemo(
    () => (selectedSkillImageId ? skillImages.find((img) => img.id === selectedSkillImageId) ?? null : null),
    [selectedSkillImageId, skillImages]
  );

  // DnD state
  const [activeDragItem, setActiveDragItem] = useState<SkillDragItem | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<SkillDragItem | null>(null);
  const [flyingCard, setFlyingCard] = useState<FlyingCardState | null>(null);
  const [flyingCardTargetId, setFlyingCardTargetId] = useState<string | null>(null);
  const [isOverPersona, setIsOverPersona] = useState(false);
  const personaRef = useRef<HTMLDivElement | null>(null);
  const galleryGridRef = useRef<HTMLDivElement | null>(null);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  const isDragging = activeDragItem !== null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

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

    const personaRect = personaRef.current?.getBoundingClientRect();
    const startX = personaRect ? personaRect.left + personaRect.width / 2 - 30 : window.innerWidth / 2;
    const startY = personaRect ? personaRect.top + personaRect.height * 0.3 : window.innerHeight / 2;
    const thumbnailUrl = confirmDialog.thumbnailUrl;

    const formData = new FormData();
    if (confirmDialog.type === "video") {
      formData.append("imageUrl", selectedImgUrl);
      formData.append("videoUrl", confirmDialog.videoUrl || "");
      formData.append("memberId", currentCharacter.characterId);
      formData.append("motionVideoId", confirmDialog.id);
      formData.append("lookbookId", currentLookbookId);
      formData.append("lookId", currentLookId);
      if (prompt) formData.append("prompt", prompt);
      fetcher.submit(formData, { method: "post", action: "/api/generate" });
    } else {
      formData.append("characterImageUrl", selectedImgUrl);
      formData.append("conceptImageUrl", confirmDialog.publicUrl || "");
      formData.append("conceptImageId", confirmDialog.id);
      formData.append("prompt", prompt || "");
      formData.append("memberId", currentCharacter.characterId);
      formData.append("lookbookId", currentLookbookId);
      formData.append("lookId", currentLookId);
      fetcher.submit(formData, { method: "post", action: "/api/generate-image" });
    }

    const optimisticId = `optimistic-${Date.now()}`;
    setFlyingCardTargetId(optimisticId);
    galleryState.addOptimisticGeneration({
      id: optimisticId,
      type: confirmDialog.type,
      memberId: currentCharacter.characterId,
      musicId: null,
      motionVideoId: confirmDialog.type === "video" ? confirmDialog.id : null,
      conceptImageId: confirmDialog.type === "image" ? confirmDialog.id : null,
      lookbookId: currentLookbookId,
      lookId: currentLookId,
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

    setActivePanel("gallery-compact");
    setConfirmDialog(null);

    const pollForGrid = () => {
      const gridEl = galleryGridRef.current;
      if (gridEl) {
        const rect = gridEl.getBoundingClientRect();
        const cellW = (rect.width - 16) / 3;
        const endX = rect.left + cellW / 2 - 30;
        const endY = rect.top + cellW - 40;
        setFlyingCard({ thumbnailUrl, startX, startY, endX, endY });
      } else {
        requestAnimationFrame(pollForGrid);
      }
    };
    requestAnimationFrame(pollForGrid);
  }, [confirmDialog, currentCharacter, selectedImgUrl, currentLookbookId, currentLookId, fetcher, galleryState, setActivePanel]);

  // Refetch gallery when fetcher completes
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      galleryState.refetch();
    }
  }, [fetcher.state, fetcher.data, galleryState]);

  // Reset skill selections on character change
  useEffect(() => {
    setSelectedSkillVideoId(null);
    setSelectedSkillImageId(null);
  }, [selectedId]);

  // Close compact panels on Escape
  useEffect(() => {
    if (!activePanel || activePanel === "gallery-expanded" || activePanel === "skill-expanded") return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActivePanel(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activePanel, setActivePanel]);

  return {
    // Skill selection
    skillTab,
    selectedSkillVideo,
    selectedSkillImage,
    selectedSkillVideoId,
    selectedSkillImageId,
    handleSkillTabChange,
    handleSkillSelectVideo,
    handleSkillSelectImage,
    // DnD
    sensors,
    activeDragItem,
    isOverPersona,
    isDragging,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    // Confirm & fly
    confirmDialog,
    setConfirmDialog,
    handleProduce,
    isGenerating,
    flyingCard,
    flyingCardTargetId,
    setFlyingCard,
    setFlyingCardTargetId,
    // Refs
    personaRef,
    galleryGridRef,
  };
}
