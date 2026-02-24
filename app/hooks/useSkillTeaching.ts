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
  const [threeCardActive, setThreeCardActive] = useState(false);
  const [generateClicked, setGenerateClicked] = useState(false);

  const handleSkillTabChange = useCallback((t: "video" | "image") => {
    setSkillTab(t);
    if (t === "video") setSelectedSkillImageId(null);
    else setSelectedSkillVideoId(null);
  }, []);
  const handleSkillSelectVideo = useCallback((id: string | null) => {
    setSelectedSkillVideoId(id);
    if (id) {
      setThreeCardActive(true);
      setGenerateClicked(false);
    }
  }, []);
  const handleSkillSelectImage = useCallback((id: string | null) => {
    setSelectedSkillImageId(id);
    if (id) {
      setThreeCardActive(true);
      setGenerateClicked(false);
    }
  }, []);

  // Auto-select first skill when panel opens
  useEffect(() => {
    if (activePanel === "skill-horizontal" && !selectedSkillVideoId && !selectedSkillImageId) {
      if (skillTab === "video" && skillVideos.length > 0) {
        setSelectedSkillVideoId(skillVideos[0].id);
        setThreeCardActive(true);
        setGenerateClicked(false);
      } else if (skillTab === "image" && skillImages.length > 0) {
        setSelectedSkillImageId(skillImages[0].id);
        setThreeCardActive(true);
        setGenerateClicked(false);
      }
    }
  }, [activePanel, skillTab, skillVideos, skillImages, selectedSkillVideoId, selectedSkillImageId]);

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
  const isGenerating = generateClicked;

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

  const dismissThreeCard = useCallback(() => {
    setThreeCardActive(false);
    setGenerateClicked(false);
    setSelectedSkillVideoId(null);
    setSelectedSkillImageId(null);
    setActivePanel(null);
  }, [setActivePanel]);

  const handleProduce = useCallback((item: SkillDragItem, prompt?: string) => {
    if (!item || !currentCharacter) return;

    const personaRect = personaRef.current?.getBoundingClientRect();
    const startX = personaRect ? personaRect.left + personaRect.width / 2 - 30 : window.innerWidth / 2;
    const startY = personaRect ? personaRect.top + personaRect.height * 0.3 : window.innerHeight / 2;
    const thumbnailUrl = item.thumbnailUrl;

    const formData = new FormData();
    if (item.type === "video") {
      formData.append("imageUrl", selectedImgUrl);
      formData.append("videoUrl", item.videoUrl || "");
      formData.append("memberId", currentCharacter.characterId);
      formData.append("motionVideoId", item.id);
      formData.append("lookbookId", currentLookbookId);
      formData.append("lookId", currentLookId);
      if (prompt) formData.append("prompt", prompt);
      fetcher.submit(formData, { method: "post", action: "/api/generate" });
    } else {
      formData.append("characterImageUrl", selectedImgUrl);
      formData.append("conceptImageUrl", item.publicUrl || "");
      formData.append("conceptImageId", item.id);
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
      type: item.type,
      memberId: currentCharacter.characterId,
      musicId: null,
      motionVideoId: item.type === "video" ? item.id : null,
      conceptImageId: item.type === "image" ? item.id : null,
      lookbookId: currentLookbookId,
      lookId: currentLookId,
      videoUrl: null,
      outputUrl: null,
      status: "pending",
      createdAt: new Date().toISOString(),
      motionName: item.type === "video" ? item.name : null,
      conceptImageName: item.type === "image" ? item.name : null,
      errorMessage: null,
      prompt: prompt || null,
      upscaleStatus: null,
      upscaleModel: null,
      upscaledVideoUrl: null,
    });

    setGenerateClicked(true);
    setActivePanel(null);
    if (confirmDialog) setConfirmDialog(null);
  }, [confirmDialog, currentCharacter, selectedImgUrl, currentLookbookId, currentLookId, fetcher, galleryState, setActivePanel]);

  const handleGenerateClick = useCallback((prompt?: string) => {
    let item: SkillDragItem | null = null;
    if (selectedSkillVideo) {
      item = {
        type: "video",
        id: selectedSkillVideo.id,
        thumbnailUrl: selectedSkillVideo.thumbnailUrl || "",
        name: selectedSkillVideo.name,
        videoUrl: selectedSkillVideo.videoUrl,
        duration: selectedSkillVideo.duration,
      };
    } else if (selectedSkillImage) {
      item = {
        type: "image",
        id: selectedSkillImage.id,
        thumbnailUrl: selectedSkillImage.publicUrl,
        name: selectedSkillImage.name || "",
        publicUrl: selectedSkillImage.publicUrl,
      };
    }
    if (item) handleProduce(item, prompt);
  }, [selectedSkillVideo, selectedSkillImage, handleProduce]);

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
    setThreeCardActive(false);
    setGenerateClicked(false);
  }, [selectedId]);

  // Close compact panels / 3-card mode on Escape
  useEffect(() => {
    if (!activePanel && !threeCardActive) return;
    if (activePanel === "gallery-expanded" || activePanel === "skill-expanded" || activePanel === "workflow-expanded" || activePanel === "runs-expanded") return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (threeCardActive) {
        setThreeCardActive(false);
        setGenerateClicked(false);
        setSelectedSkillVideoId(null);
        setSelectedSkillImageId(null);
        setActivePanel(null);
      } else if (activePanel) {
        setActivePanel(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activePanel, setActivePanel, threeCardActive]);

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
    handleGenerateClick,
    isGenerating,
    flyingCard,
    flyingCardTargetId,
    setFlyingCard,
    setFlyingCardTargetId,
    // Three-card mode
    threeCardActive,
    dismissThreeCard,
    // Refs
    personaRef,
    galleryGridRef,
  };
}
