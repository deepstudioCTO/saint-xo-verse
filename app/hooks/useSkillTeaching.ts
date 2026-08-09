import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { PointerSensor, useSensor, useSensors, type DragStartEvent, type DragEndEvent, type DragMoveEvent } from "@dnd-kit/core";
import { toast } from "sonner";
import type { SkillDragItem, SkillVideo, SkillImage, SkillTab } from "~/components/skill/SkillPanel";
import { videoToDragItem, imageToDragItem } from "~/components/skill/SkillPanel";
import type { ActivePanel } from "~/components/layout/HomeFloatingBar";
import type { Persona } from "~/lib/data";
import type { UseLibraryStateReturn } from "~/hooks/useLibraryState";
import { getCurrentTrack } from "~/hooks/useAudioPlayer";
import { injectTemplateInputs } from "~/lib/workflow/injectTemplateInputs";
import { buildSkillGraph } from "~/lib/workflow/buildSkillGraph";
import type { GraphNodeLike, GraphEdgeLike } from "~/lib/workflow/types";

export interface FlyingCardState {
  thumbnailUrl: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

interface SkillGraph {
  nodes: GraphNodeLike[];
  edges: GraphEdgeLike[];
  templateId: string | null;
}

/**
 * 스킬의 실행 그래프 확보.
 * 1순위: sourceSkillId로 매핑된 템플릿 fetch (templateId 기록 → 재사용률 지표 유효)
 * 폴백: buildSkillGraph로 즉석 조립 (매핑 없는 스킬 — templateId 미기록이지만 실행은 됨)
 */
export async function resolveSkillGraph(
  item: SkillDragItem,
  templateId: string | undefined
): Promise<SkillGraph> {
  if (templateId) {
    const res = await fetch(`/api/workflow-templates?id=${templateId}`);
    if (res.ok) {
      const { template } = (await res.json()) as { template: { nodes: string; edges: string } };
      return {
        nodes: JSON.parse(template.nodes) as GraphNodeLike[],
        edges: JSON.parse(template.edges) as GraphEdgeLike[],
        templateId,
      };
    }
    // 템플릿 조회 실패는 폴백으로 계속
  }

  const built =
    item.category === "video"
      ? buildSkillGraph({
          kind: "motion",
          motionVideoId: item.id,
          name: item.name,
          videoUrl: item.videoUrl ?? "",
          thumbnailUrl: item.thumbnailUrl || null,
        })
      : buildSkillGraph({
          kind: "concept",
          conceptImageId: item.id,
          name: item.name,
          imageUrl: item.publicUrl ?? "",
        });
  return { nodes: built.nodes, edges: built.edges, templateId: null };
}

interface UseSkillTeachingParams {
  currentCharacter: Persona | null;
  currentLookbookId: string;
  currentLookId: string;
  selectedImgUrl: string;
  skillVideos: SkillVideo[];
  skillImages: SkillImage[];
  /** motionVideos.id/conceptImages.id → 실행용 템플릿 id (workflow_templates.sourceSkillId 기반) */
  templateIdBySkillId: Record<string, string>;
  libraryState: UseLibraryStateReturn;
  activePanel: ActivePanel;
  setActivePanel: (p: ActivePanel) => void;
  selectedId: string | null;
}

/**
 * 3카드/DnD 스킬 생성 플로우.
 * 스킬 카탈로그 = 모션영상/컨셉이미지 (표시·선택), 실행 = 워크플로우 체계:
 * resolveSkillGraph(그래프 확보) → injectTemplateInputs(주입) → POST /api/workflow-execute.
 */
export function useSkillTeaching({
  currentCharacter,
  currentLookbookId,
  currentLookId,
  selectedImgUrl,
  skillVideos,
  skillImages,
  templateIdBySkillId,
  libraryState,
  activePanel,
  setActivePanel,
  selectedId,
}: UseSkillTeachingParams) {
  // Skill selection state
  const [skillTab, setSkillTab] = useState<SkillTab>("video");
  const [selectedSkillVideoId, setSelectedSkillVideoId] = useState<string | null>(null);
  const [selectedSkillImageId, setSelectedSkillImageId] = useState<string | null>(null);
  const [threeCardActive, setThreeCardActive] = useState(false);
  const [generateClicked, setGenerateClicked] = useState(false);

  const handleSkillTabChange = useCallback((t: SkillTab) => {
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

  const handleProduce = useCallback(async (item: SkillDragItem, prompt?: string) => {
    if (!item || !currentCharacter) return;
    if (item.category === "image" && !prompt?.trim()) {
      toast.error("Image generation needs a prompt.");
      return;
    }

    setGenerateClicked(true);
    setActivePanel(null);
    setConfirmDialog(null);

    try {
      // 1. 실행 그래프 확보 (매핑 템플릿 우선, 없으면 즉석 조립)
      const graph = await resolveSkillGraph(item, templateIdBySkillId[item.id]);

      // 2. 선택값 주입 (빈 캐릭터 소스 슬롯 + 프롬프트)
      const injected = injectTemplateInputs(graph.nodes, {
        characterImage: { url: selectedImgUrl, name: currentCharacter.name },
        ...(prompt ? { prompt } : {}),
      });

      // 3. 실행 + run 메타데이터 기록
      const res = await fetch("/api/workflow-execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          graph: { nodes: injected, edges: graph.edges },
          ...(graph.templateId ? { templateId: graph.templateId } : {}),
          inputs: {
            characterId: currentCharacter.characterId,
            lookId: currentLookId,
            lookbookId: currentLookbookId,
            musicId: getCurrentTrack().id,
            prompt: prompt ?? undefined,
            thumbnailUrl: selectedImgUrl,
            source: "home",
          },
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error || "Failed to start run");
      }
      const { runId } = (await res.json()) as { runId: string };

      // 4. Library optimistic run (실제 runId — 서버 fetch가 같은 id로 대체)
      setFlyingCardTargetId(runId);
      libraryState.addOptimisticRun({
        id: runId,
        status: "pending",
        outputUrl: null,
        outputType: null,
        thumbnailUrl: selectedImgUrl,
        characterId: currentCharacter.characterId,
        lookId: currentLookId,
        lookbookId: currentLookbookId,
        musicId: getCurrentTrack().id,
        prompt: prompt ?? null,
        source: "home",
        templateId: graph.templateId,
        templateName: item.name,
        templateCategory: item.category,
        error: null,
        startedAt: new Date().toISOString(),
        completedAt: null,
      });
    } catch (err) {
      console.error("Generate failed:", err);
      toast.error(`Generate failed: ${err instanceof Error ? err.message : String(err)}`);
      setGenerateClicked(false);
    }
  }, [currentCharacter, selectedImgUrl, currentLookbookId, currentLookId, templateIdBySkillId, libraryState, setActivePanel]);

  const handleGenerateClick = useCallback((prompt?: string) => {
    if (selectedSkillVideo) handleProduce(videoToDragItem(selectedSkillVideo), prompt);
    else if (selectedSkillImage) handleProduce(imageToDragItem(selectedSkillImage), prompt);
  }, [selectedSkillVideo, selectedSkillImage, handleProduce]);

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
    if (activePanel === "gallery-expanded" || activePanel === "skill-expanded" || activePanel === "workflow-expanded") return;
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
