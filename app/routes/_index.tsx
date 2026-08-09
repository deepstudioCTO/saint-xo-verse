import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams, useLoaderData, useRevalidator, Link, Form, isRouteErrorResponse, type ShouldRevalidateFunctionArgs } from "react-router";
import { data } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { DndContext, DragOverlay, type Modifier } from "@dnd-kit/core";
import type { Route } from "./+types/_index";
import { requireAuth } from "~/lib/auth.server";
import {
  type Lookbook,
  type Look,
  type Persona,
} from "~/lib/data";
import { getDb, characterImages, lookbooks, looks, personas, motionVideos, conceptImages, workflowRuns, workflowTemplates } from "~/lib/db.server";
import { getPublicUrl } from "~/lib/supabase.server";
import { asc, desc, eq, sql } from "drizzle-orm";
import { VideoCanvas } from "~/components/effects/VideoCanvas";
import { SkillHorizontalPanel, SkillExpandedPanel } from "~/components/skill/SkillPanel";
import { HomeFloatingBar, type ActivePanel } from "~/components/layout/HomeFloatingBar";
import { GalleryCompactPanel, GalleryExpandedPanel, GalleryHorizontalPanel, GalleryModals } from "~/components/gallery";
import { MusicHorizontalPanel } from "~/components/music/MusicHorizontalPanel";
import { useLibraryState } from "~/hooks/useLibraryState";
import { InputImagePanel } from "~/components/common/InputImagePanel";
import { SkillConfirmDialog } from "~/components/common/SkillConfirmDialog";
import { CharacterInfoPanel } from "~/components/common/CharacterInfoPanel";
import { LookbookInfoPanel } from "~/components/common/LookbookInfoPanel";
import { useLookbookNavigation } from "~/hooks/useLookbookNavigation";
import { useLookNavigation } from "~/hooks/useLookNavigation";
import { usePersonaNavigation } from "~/hooks/usePersonaNavigation";
import { useSkillTeaching } from "~/hooks/useSkillTeaching";
import { useCharacterImages } from "~/hooks/useCharacterImages";
import { usePreloadPosters } from "~/hooks/usePreloadPosters";
import { WorkflowPanel } from "~/components/workflow/WorkflowPanel";
import { PricingPanel } from "~/components/pricing/PricingPanel";

const centerOnCursor: Modifier = ({ activatorEvent, activeNodeRect, transform }) => {
  if (!activatorEvent || !activeNodeRect) return transform;
  const ev = activatorEvent as PointerEvent;
  return {
    ...transform,
    x: transform.x + (ev.clientX - activeNodeRect.left - 30),
    y: transform.y + (ev.clientY - activeNodeRect.top - 40),
  };
};

const PANEL_SHORTCUTS: Record<string, ActivePanel> = {
  w: "workflow-expanded",
};

export const meta: Route.MetaFunction = () => [
  { title: "HitOS" },
  { name: "description", content: "Fan-made short-form video creation platform" },
];

export function shouldRevalidate({
  currentUrl,
  nextUrl,
  formMethod,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  if (formMethod && formMethod !== "GET") return defaultShouldRevalidate;
  if (currentUrl.pathname === nextUrl.pathname) return false;
  return defaultShouldRevalidate;
}

interface CharacterImage {
  id: string;
  characterId: string;
  variantId: string;
  storagePath: string;
  publicUrl: string;
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = (context.cloudflare as { env: Record<string, string> }).env;
  const { headers: authHeaders } = await requireAuth(request, env);

  const url = new URL(request.url);

  // Backward compat: redirect ?verse= to ?lookbook=
  const verseParam = url.searchParams.get("verse");
  if (verseParam) {
    url.searchParams.set("lookbook", verseParam);
    url.searchParams.delete("verse");
    return Response.redirect(url.toString(), 302);
  }

  const lookbookParam = url.searchParams.get("lookbook") || "00";
  const lookParam = url.searchParams.get("look"); // nullable — will default to first look

  const db = getDb(context.cloudflare as { env: Record<string, string> });

  const [dbLookbooks, dbLooks, dbPersonas, images] = await Promise.all([
    db.select().from(lookbooks).orderBy(asc(lookbooks.displayOrder)),
    db.select().from(looks).orderBy(asc(looks.displayOrder)),
    db.select().from(personas).orderBy(asc(personas.displayOrder)),
    db.select().from(characterImages).orderBy(asc(characterImages.characterId), asc(characterImages.createdAt)),
  ]);

  const lookbookList: Lookbook[] = dbLookbooks.map((v) => ({
    id: v.id,
    name: v.name,
    displayName: v.displayName,
    description: v.description,
    displayOrder: v.displayOrder,
  }));

  const lookList: Look[] = dbLooks.map((l) => ({
    id: l.id,
    lookbookId: l.lookbookId,
    displayOrder: l.displayOrder,
  }));

  const allPersonas: Persona[] = dbPersonas.map((p) => ({
    id: p.id,
    lookId: p.lookId,
    characterId: p.characterId,
    name: p.name,
    description: p.description,
    video: p.video,
    poster: p.poster,
    defaultInput: p.defaultInput,
    displayOrder: p.displayOrder,
  }));

  const imagesByCharacter: Record<string, CharacterImage[]> = {};
  for (const img of images) {
    if (!imagesByCharacter[img.characterId]) {
      imagesByCharacter[img.characterId] = [];
    }
    imagesByCharacter[img.characterId].push(img);
  }

  const cf = context.cloudflare as { env: Record<string, string> };
  const [dbVideos, dbConceptImages, storiesResult, dbTemplates] = await Promise.all([
    db.select().from(motionVideos).orderBy(desc(motionVideos.createdAt)),
    db.select().from(conceptImages).orderBy(desc(conceptImages.createdAt)),
    db.select({ count: sql<number>`count(*)` }).from(workflowRuns).where(eq(workflowRuns.status, "completed")),
    db.select({
      id: workflowTemplates.id,
      name: workflowTemplates.name,
      category: workflowTemplates.category,
      thumbnailUrl: workflowTemplates.thumbnailUrl,
      sourceSkillId: workflowTemplates.sourceSkillId,
    }).from(workflowTemplates).where(eq(workflowTemplates.isPublished, true)).orderBy(desc(workflowTemplates.updatedAt)),
  ]);

  // 스킬 카탈로그 (홈 표시용) — 실행은 아래 매핑된 템플릿으로
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

  // skill id → 실행용 템플릿 id (sourceSkillId 매핑). 스킬 래퍼는 W패널 목록에서 제외
  const templateIdBySkillId: Record<string, string> = {};
  for (const t of dbTemplates) {
    if (t.sourceSkillId) templateIdBySkillId[t.sourceSkillId] = t.id;
  }
  const skillTemplates = dbTemplates
    .filter((t) => !t.sourceSkillId)
    .map((t) => ({
      id: t.id,
      name: t.name,
      category: t.category,
      thumbnailUrl: t.thumbnailUrl,
    }));

  const skillsCount = dbVideos.length;
  const storiesCount = Number(storiesResult[0]?.count || 0);

  // Resolve current look
  const currentLookbookLooks = lookList.filter((l) => l.lookbookId === lookbookParam);
  const currentLookId = lookParam && currentLookbookLooks.some((l) => l.id === lookParam)
    ? lookParam
    : currentLookbookLooks[0]?.id || lookList[0]?.id || "00_01";

  return data({
    lookbooks: lookbookList,
    looks: lookList,
    currentLookbookId: lookbookParam,
    currentLookId,
    allPersonas,
    imagesByCharacter,
    skillsCount,
    storiesCount,
    skillVideos,
    skillImages,
    skillTemplates,
    templateIdBySkillId,
  }, { headers: authHeaders });
}

export default function Home() {
  const {
    lookbooks: lookbookList,
    looks: allLooks,
    currentLookbookId,
    currentLookId: loaderLookId,
    allPersonas,
    imagesByCharacter,
    skillsCount,
    storiesCount,
    skillVideos,
    skillImages,
    skillTemplates,
    templateIdBySkillId,
  } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const revalidator = useRevalidator();

  // Current lookbook ID from URL (with fallback)
  const activeLookbookId = searchParams.get("lookbook") || currentLookbookId;
  const lookParam = searchParams.get("look");
  const activeLookId = (lookParam && allLooks.some(l => l.id === lookParam && l.lookbookId === activeLookbookId))
    ? lookParam
    : allLooks.find(l => l.lookbookId === activeLookbookId)?.id || loaderLookId;

  // Looks for current lookbook
  const currentLookbookLooks = useMemo(
    () => allLooks.filter((l) => l.lookbookId === activeLookbookId),
    [allLooks, activeLookbookId]
  );
  const currentLookIndex = currentLookbookLooks.findIndex((l) => l.id === activeLookId);

  // Current lookbook personas (filtered to current look, with optimistic update support)
  const dbPersonas = useMemo(
    () => allPersonas.filter((p) => p.lookId === activeLookId),
    [allPersonas, activeLookId]
  );
  const [personaList, setPersonaList] = useState<Persona[]>(dbPersonas);
  useEffect(() => { setPersonaList(dbPersonas); }, [dbPersonas]);

  // Personas grouped by look (for cross-look persona navigation)
  const personasByLook = useMemo(() => {
    const map: Record<string, Persona[]> = {};
    for (const p of allPersonas) {
      if (!currentLookbookLooks.some((l) => l.id === p.lookId)) continue;
      if (!map[p.lookId]) map[p.lookId] = [];
      map[p.lookId].push(p);
    }
    return map;
  }, [allPersonas, currentLookbookLooks]);

  // Lookbook list state (for optimistic updates)
  const [lookbookListState, setLookbookListState] = useState<Lookbook[]>(lookbookList);
  useEffect(() => { setLookbookListState(lookbookList); }, [lookbookList]);

  const currentLookbook = lookbookListState.find((v) => v.id === activeLookbookId) || lookbookListState[0];
  const currentLookbookIndex = lookbookListState.findIndex((v) => v.id === activeLookbookId);

  // Derived persona selection
  const selectedId = searchParams.get("selected");
  const selectedIndex = personaList.findIndex((c) => c.characterId === selectedId);
  const isSelecting = selectedIndex >= 0;
  const currentCharacter = isSelecting ? personaList[selectedIndex] : null;

  // Selected image URL (shared by SkillPanel and HomeFloatingBar)
  const selectedImgUrl = useMemo(() => {
    if (!currentCharacter) return "";
    return currentCharacter.defaultInput ?? currentCharacter.poster;
  }, [currentCharacter]);

  // Images for current character
  const currentImages = currentCharacter ? imagesByCharacter[currentCharacter.characterId] || [] : [];

  // Panel state (shared across skill/gallery/music)
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const galleryOpen = activePanel === "gallery-horizontal" || activePanel === "gallery-compact" || activePanel === "gallery-expanded";
  const libraryState = useLibraryState(galleryOpen);

  // Unified transition state (replaces separate slideDirection / lookSlideDirection)
  const [transition, setTransition] = useState<{ type: "lookbook" | "look"; direction: number }>({
    type: "look", direction: 0,
  });

  // Lookbook navigation (↑↓)
  useLookbookNavigation({
    lookbookList: lookbookListState,
    currentLookbookIndex,
    setSearchParams,
    onTransition: useCallback((direction: number) => setTransition({ type: "lookbook", direction }), []),
  });

  // Look navigation (←→ when not selecting)
  useLookNavigation({
    lookList: currentLookbookLooks,
    currentLookIndex,
    currentLookbookId: activeLookbookId,
    isSelecting,
    setSearchParams,
    onTransition: useCallback((direction: number) => setTransition({ type: "look", direction }), []),
  });

  // Skill teaching (DnD, confirm, flying card)
  const skill = useSkillTeaching({
    currentCharacter,
    currentLookbookId: activeLookbookId,
    currentLookId: activeLookId,
    selectedImgUrl,
    skillVideos,
    skillImages,
    templateIdBySkillId,
    libraryState,
    activePanel,
    setActivePanel,
    selectedId,
  });

  // Persona navigation (←→ when selecting, with cross-look boundary)
  const charNav = usePersonaNavigation({
    personaList,
    selectedId,
    currentLookbookId: activeLookbookId,
    currentLookId: activeLookId,
    isSelecting,
    isDragging: skill.isDragging,
    lookList: currentLookbookLooks,
    personasByLook,
    setSearchParams,
    onLookTransition: useCallback((direction: number) => setTransition({ type: "look", direction }), []),
  });

  // Character images (upload, delete, defaultInput)
  const charImages = useCharacterImages({
    currentCharacter,
    currentLookId: activeLookId,
    currentImages,
    setCharacterList: setPersonaList,
    revalidate: revalidator.revalidate,
  });

  // Preload all persona posters for instant look/lookbook transitions
  usePreloadPosters(allPersonas);

  // Reset panels on character change
  useEffect(() => {
    setActivePanel(null);
    charImages.setInputPanelOpen(false);
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset generate prompt when skill selection changes
  useEffect(() => {
    setGeneratePrompt("");
  }, [skill.selectedSkillVideoId, skill.selectedSkillImageId]);

  // Optimistic persona update callback
  const handleCharacterUpdate = useCallback((characterId: string, updates: Partial<Persona>) => {
    setPersonaList((prev) =>
      prev.map((c) =>
        c.characterId === characterId && c.lookId === activeLookId
          ? { ...c, ...updates } : c
      )
    );
  }, [activeLookId]);

  // Optimistic lookbook update callback
  const handleLookbookUpdate = useCallback((lookbookId: string, updates: Partial<Lookbook>) => {
    setLookbookListState((prev) =>
      prev.map((v) => v.id === lookbookId ? { ...v, ...updates } : v)
    );
  }, []);

  // Derived panel booleans
  const skillHorizontalOpen = activePanel === "skill-horizontal";
  const skillExpandedOpen = activePanel === "skill-expanded";
  const musicHorizontalOpen = activePanel === "music-horizontal";
  const galleryHorizontalOpen = activePanel === "gallery-horizontal";
  const galleryCompactOpen = activePanel === "gallery-compact";
  const galleryExpandedOpen = activePanel === "gallery-expanded";
  const workflowExpandedOpen = activePanel === "workflow-expanded";
  const pricingExpandedOpen = activePanel === "pricing-expanded";

  // Keyboard shortcuts → toggle expanded panels
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const panel = PANEL_SHORTCUTS[e.key.toLowerCase()];
      if (panel) setActivePanel((prev) => prev === panel ? null : panel);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Three-card layout: character left + skill center + generate right
  const hasSkillSelected = !!(skill.selectedSkillVideo || skill.selectedSkillImage);
  const threeCardMode = isSelecting && hasSkillSelected && skill.threeCardActive;
  const baseScale = 3.5;

  // Prompt state for image skill generation
  const [generatePrompt, setGeneratePrompt] = useState("");

  // Animation key combines lookbook + look for both vertical and horizontal transitions
  const animationKey = `${activeLookbookId}_${activeLookId}`;

  // Transition type and direction from unified state
  const { type: transitionType, direction: animDirection } = transition;

  return (
    <DndContext sensors={skill.sensors} onDragStart={skill.handleDragStart} onDragMove={skill.handleDragMove} onDragEnd={skill.handleDragEnd}>
    <div className="relative w-full h-screen overflow-hidden bg-[--color-bg]">
      {/* Layer 1: Current look personas */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={animationKey}
          initial={{
            opacity: 0,
            x: transitionType === "look" ? animDirection * 30 : 0,
            y: transitionType === "lookbook" ? animDirection * 30 : 0,
          }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          exit={{
            opacity: 0,
            x: transitionType === "look" ? -animDirection * 30 : 0,
            y: transitionType === "lookbook" ? -animDirection * 30 : 0,
          }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          ref={charNav.charNavRef}
          className="absolute inset-0 flex items-center justify-center overflow-hidden touch-none"
        >
          {personaList.map((character, index) => {
            const isSelected = index === selectedIndex;
            const diff = index - selectedIndex;
            const absDiff = Math.abs(diff);
            const centerIndex = (personaList.length - 1) / 2;

            const homeX = (index - centerIndex) * 165;
            const selectX = diff * 22;
            const threeCardX = isSelected ? -18 : diff * 22;
            const x = threeCardMode ? threeCardX : isSelecting ? selectX : homeX;

            let scale = 1;
            let opacity = 1;

            if (threeCardMode) {
              if (isSelected) {
                scale = 2.5;
                opacity = 1;
              } else {
                scale = baseScale * 0.3;
                opacity = 0;
              }
            } else if (isSelecting) {
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
              if (charNav.hoveredCharacterId && character.characterId !== charNav.hoveredCharacterId) {
                opacity = 0.3;
              }
            }

            return (
              <div
                key={`${character.lookId}-${character.characterId}`}
                ref={isSelected ? (node: HTMLDivElement | null) => {
                  skill.personaRef.current = node;
                } : undefined}
                className="absolute cursor-pointer transition-[transform,opacity] duration-300 ease-out"
                style={{
                  transform: isSelecting
                    ? `translateX(${x}vw) scale(${scale})`
                    : `translateX(${x}px) scale(${scale})`,
                  opacity,
                  zIndex: isSelected ? 10 : 5 - absDiff,
                }}
                onClick={() => {
                  if (isSelecting && character.characterId === selectedId) {
                    if (threeCardMode) {
                      skill.dismissThreeCard();
                    }
                    return;
                  }
                  setSearchParams({ selected: character.characterId, lookbook: activeLookbookId, look: activeLookId });
                }}
                onMouseEnter={() => !isSelecting && charNav.setHoveredCharacterId(character.characterId)}
                onMouseLeave={() => !isSelecting && charNav.setHoveredCharacterId(null)}
              >
                {isSelected && (threeCardMode || skill.isDragging) && (
                  <div
                    className={`absolute -inset-[5px] rounded-sm ${skill.isOverPersona && skill.isDragging ? "persona-glow-intense" : threeCardMode ? "bg-white/5" : "persona-glow"} transition-opacity duration-300`}
                    style={{ zIndex: -1 }}
                  />
                )}
                <div
                  className="w-[5.5vw] min-w-[80px] max-w-[150px] aspect-[1/2] overflow-hidden rounded-sm"
                  style={{
                    backgroundImage: character.poster ? `url(${character.poster})` : undefined,
                    backgroundSize: "cover",
                    backgroundPosition: "center center",
                    ...(threeCardMode ? { boxShadow: "0 0 8px 2px rgba(140,160,200,0.2)" } : {}),
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

          {/* Skill card — center in three-card mode */}
          <AnimatePresence>
            {threeCardMode && hasSkillSelected && (
              <motion.div
                key={`skill-card-${skill.selectedSkillVideoId || skill.selectedSkillImageId}`}
                className="absolute"
                style={{
                  transform: `translateX(0vw) scale(2.5)`,
                  zIndex: 10,
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className={`absolute -inset-[5px] rounded-sm ${skill.isGenerating ? "bg-white/5" : "persona-glow"} transition-opacity duration-300`} style={{ zIndex: -1 }} />
                <div
                  className="w-[5.5vw] min-w-[80px] max-w-[150px] aspect-[1/2] overflow-hidden rounded-sm"
                  style={{ boxShadow: "0 0 8px 2px rgba(140,160,200,0.2)" }}
                >
                  {skill.selectedSkillVideo ? (
                    <video
                      key={skill.selectedSkillVideoId}
                      src={skill.selectedSkillVideo.videoUrl}
                      poster={skill.selectedSkillVideo.thumbnailUrl ?? undefined}
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  ) : skill.selectedSkillImage ? (
                    <img
                      src={skill.selectedSkillImage.publicUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : null}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Equation symbols in three-card mode */}
          <AnimatePresence>
            {threeCardMode && (
              <>
                <motion.span
                  key="multiply-symbol"
                  className="absolute text-black font-extralight pointer-events-none select-none"
                  style={{ transform: "translateX(-9vw)", fontSize: "3rem", zIndex: 10 }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3, delay: 0.1 }}
                >
                  &times;
                </motion.span>
                <motion.span
                  key="equals-symbol"
                  className="absolute text-black font-extralight pointer-events-none select-none"
                  style={{ transform: "translateX(9vw)", fontSize: "3rem", zIndex: 10 }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3, delay: 0.1 }}
                >
                  =
                </motion.span>
              </>
            )}
          </AnimatePresence>

          {/* Prompt input — below cards when image skill selected */}
          <AnimatePresence>
            {threeCardMode && skill.selectedSkillImage && (
              <motion.input
                key="generate-prompt"
                type="text"
                value={generatePrompt}
                onChange={(e) => setGeneratePrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !skill.isGenerating) {
                    skill.handleGenerateClick(generatePrompt || undefined);
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                placeholder="Describe what to generate..."
                className="absolute z-[30] w-[28vw] min-w-[280px] px-4 py-2.5 text-xs glass rounded-sm text-black/70 placeholder:text-black/30 outline-none text-center"
                style={{ transform: "translateY(24vh)" }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
              />
            )}
          </AnimatePresence>

          {/* Generate card — right side in three-card mode */}
          <AnimatePresence>
            {threeCardMode && (
              <motion.div
                key="generate-card"
                className="absolute cursor-pointer z-[30]"
                style={{ transform: `translateX(18vw) scale(2.5)` }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                onClick={() => {
                  if (skill.isGenerating) return;
                  const needsPrompt = !!skill.selectedSkillImage;
                  skill.handleGenerateClick(
                    needsPrompt ? generatePrompt || undefined : undefined
                  );
                }}
              >
                {skill.isGenerating && (
                  <div
                    className="absolute -inset-[5px] rounded-sm generate-glow transition-opacity duration-300"
                    style={{ zIndex: -1 }}
                  />
                )}
                <div className="w-[5.5vw] min-w-[80px] max-w-[150px] aspect-[1/2] overflow-hidden rounded-sm bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
                  {skill.isGenerating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                      <span className="text-[7px] tracking-[0.15em] font-medium text-white/50 uppercase">
                        Generating
                      </span>
                      <button
                        className="mt-1 px-1.5 py-[1px] rounded-[1px] bg-white/90 text-[5px] tracking-[0.1em] font-medium text-black/70 uppercase hover:bg-white transition-colors cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          skill.dismissThreeCard();
                          setActivePanel("gallery-expanded");
                        }}
                      >
                        View Library
                      </button>
                    </>
                  ) : (
                    <span className="text-[7px] tracking-[0.15em] font-medium text-white uppercase">
                      Generate
                    </span>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>

      {/* Layer 2: Header */}
      <header className="absolute top-0 left-0 right-0 z-[45] flex items-center justify-between px-6 py-4 pointer-events-none [&_button]:pointer-events-auto [&_a]:pointer-events-auto [&_form]:pointer-events-auto">
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <Link to="/" className="text-lg font-black italic tracking-wider text-black cursor-pointer hover:opacity-70 transition-opacity" style={{ fontWeight: 900 }}>HitOS</Link>
            <div className="flex items-center gap-3 text-[10px] tracking-wider mt-1.5">
              <button onClick={() => setActivePanel(prev => prev === "skill-compact" || prev === "skill-expanded" ? null : "skill-compact")} disabled={!isSelecting} className="flex items-center gap-2 cursor-pointer hover:opacity-70 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"><span className="font-semibold text-black">SKILLS</span><span className="text-gray-400">{String(skillsCount).padStart(2, "0")}</span></button>
              <button onClick={() => setActivePanel(prev => prev === "gallery-compact" || prev === "gallery-expanded" ? null : "gallery-compact")} className="flex items-center gap-2 cursor-pointer hover:opacity-70 transition-opacity"><span className="font-semibold text-black">LIBRARY</span><span className="text-gray-400">{String(storiesCount).padStart(2, "0")}</span></button>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-5 text-[10px] tracking-wider">
          <span className="font-semibold text-black cursor-pointer hover:opacity-70 transition-opacity">AudioVisual Lab</span>
          <span className="font-semibold text-black cursor-pointer hover:opacity-70 transition-opacity">Moodboard</span>
          <span className="font-semibold text-black cursor-pointer hover:opacity-70 transition-opacity">Launch</span>
          <span className="font-semibold text-black cursor-pointer hover:opacity-70 transition-opacity">Playground</span>
          <button
            onClick={() => setActivePanel(prev => prev === "pricing-expanded" ? null : "pricing-expanded")}
            className="font-semibold text-black cursor-pointer hover:opacity-70 transition-opacity"
          >
            Pricing
          </button>
          <Form method="post" action="/api/logout">
            <button type="submit" className="font-semibold text-black/40 cursor-pointer hover:text-black transition-colors">Logout</button>
          </Form>
        </div>
      </header>

      {/* Layer 3: Title */}
      <div className="absolute top-28 left-0 right-0 z-20 px-6 pointer-events-none [&_button]:pointer-events-auto [&_input]:pointer-events-auto [&_textarea]:pointer-events-auto [&_a]:pointer-events-auto">
        {isSelecting && currentCharacter ? (
          <CharacterInfoPanel
            character={currentCharacter}
            lookId={activeLookId}
            selectedIndex={selectedIndex}
            totalCharacters={personaList.length}
            onCharacterUpdate={handleCharacterUpdate}
          />
        ) : (
          <LookbookInfoPanel
            lookbook={currentLookbook}
            lookbookIndex={currentLookbookIndex}
            totalLookbooks={lookbookListState.length}
            currentLookIndex={currentLookIndex >= 0 ? currentLookIndex : 0}
            totalLooks={currentLookbookLooks.length}
            slideDirection={animDirection}
            currentLookbookId={activeLookbookId}
            onLookbookUpdate={handleLookbookUpdate}
          />
        )}
      </div>

      {/* Image Input Selection */}
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
              open={charImages.inputPanelOpen}
              onToggle={charImages.setInputPanelOpen}
              character={currentCharacter}
              images={currentImages}
              onSaveDefaultInput={charImages.handleSaveDefaultInput}
              onDeleteImage={charImages.handleDelete}
              onUploadImage={charImages.handleUpload}
              uploading={charImages.uploading}
              deleting={charImages.deleting}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Click-outside backdrop for compact panels + three-card mode */}
      {((activePanel && activePanel !== "gallery-expanded" && activePanel !== "skill-expanded") || (threeCardMode && !activePanel)) && (
        <div
          className="fixed inset-0 z-[25]"
          onClick={() => {
            if (threeCardMode) {
              skill.dismissThreeCard();
            } else {
              setActivePanel(null);
            }
          }}
        />
      )}

      <HomeFloatingBar
        characterId={currentCharacter?.characterId ?? null}
        characterImageUrl={selectedImgUrl}
        lookbookId={activeLookbookId}
        activePanel={activePanel}
        onPanelChange={setActivePanel}
        selectedSkillThumbnailUrl={skill.selectedSkillVideo?.thumbnailUrl ?? skill.selectedSkillImage?.publicUrl ?? null}
      >
        <MusicHorizontalPanel open={musicHorizontalOpen} />
        {isSelecting && currentCharacter && (
          <SkillHorizontalPanel
            open={skillHorizontalOpen}
            videos={skillVideos}
            images={skillImages}
            tab={skill.skillTab}
            selectedVideoId={skill.selectedSkillVideoId}
            selectedImageId={skill.selectedSkillImageId}
            onTabChange={skill.handleSkillTabChange}
            onSelectVideo={skill.handleSkillSelectVideo}
            onSelectImage={skill.handleSkillSelectImage}
            onExpand={() => setActivePanel("skill-expanded")}
          />
        )}
        <GalleryHorizontalPanel
          open={galleryHorizontalOpen}
          libraryState={libraryState}
          gridRef={skill.galleryGridRef}
          flyingCardTargetId={skill.flyingCardTargetId}
        />
        <GalleryCompactPanel
          open={galleryCompactOpen}
          onExpand={() => setActivePanel("gallery-expanded")}
          libraryState={libraryState}
          gridRef={skill.galleryGridRef}
          flyingCardTargetId={skill.flyingCardTargetId}
        />
      </HomeFloatingBar>

      {isSelecting && currentCharacter && (
        <SkillExpandedPanel
          open={skillExpandedOpen}
          onClose={() => setActivePanel(null)}
          onCollapse={() => setActivePanel("skill-horizontal")}
          videos={skillVideos}
          images={skillImages}
          tab={skill.skillTab}
          selectedVideoId={skill.selectedSkillVideoId}
          selectedImageId={skill.selectedSkillImageId}
          onTabChange={skill.handleSkillTabChange}
          onSelectVideo={skill.handleSkillSelectVideo}
          onSelectImage={skill.handleSkillSelectImage}
        />
      )}

      <GalleryExpandedPanel
        open={galleryExpandedOpen}
        onClose={() => setActivePanel(null)}
        onCollapse={() => setActivePanel("gallery-compact")}
        libraryState={libraryState}
      />

      <WorkflowPanel
        open={workflowExpandedOpen}
        onClose={() => setActivePanel(null)}
        templates={skillTemplates}
      />

      <PricingPanel
        open={pricingExpandedOpen}
        onClose={() => setActivePanel(null)}
      />

      <GalleryModals libraryState={libraryState} />
    </div>

    {/* DragOverlay */}
    <DragOverlay modifiers={[centerOnCursor]} dropAnimation={null}>
      {skill.activeDragItem && (
        <div className="w-[60px] aspect-[3/4] rounded-sm overflow-hidden shadow-lg">
          <img src={skill.activeDragItem.thumbnailUrl} alt="" className="w-full h-full object-cover" />
        </div>
      )}
    </DragOverlay>

    <SkillConfirmDialog
      open={skill.confirmDialog !== null}
      item={skill.confirmDialog}
      onCancel={() => skill.setConfirmDialog(null)}
      onProduce={(prompt) => { if (skill.confirmDialog) skill.handleProduce(skill.confirmDialog, prompt); }}
      isProducing={skill.isGenerating}
    />

    {/* Flying card animation */}
    <AnimatePresence>
      {skill.flyingCard && (
        <motion.div
          className="fixed top-0 left-0 z-[60] w-[60px] aspect-[3/4] pointer-events-none rounded-sm overflow-hidden"
          initial={{
            x: skill.flyingCard.startX,
            y: skill.flyingCard.startY,
            scale: 1,
            opacity: 1,
          }}
          animate={{
            x: [skill.flyingCard.startX, skill.flyingCard.startX + (skill.flyingCard.endX - skill.flyingCard.startX) * 0.4, skill.flyingCard.endX, skill.flyingCard.endX],
            y: [skill.flyingCard.startY, skill.flyingCard.startY - 80, skill.flyingCard.endY, skill.flyingCard.endY],
            scale: [1, 0.8, 0.5, 0.3],
            opacity: [1, 1, 1, 0],
          }}
          transition={{
            duration: 0.6,
            times: [0, 0.35, 0.75, 1],
          }}
          onAnimationComplete={() => {
            skill.setFlyingCard(null);
            skill.setFlyingCardTargetId(null);
          }}
        >
          <img src={skill.flyingCard.thumbnailUrl} alt="" className="w-full h-full object-cover" />
        </motion.div>
      )}
    </AnimatePresence>

    </DndContext>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const message = isRouteErrorResponse(error) ? `${error.status} ${error.statusText}` : "Something went wrong";
  return (
    <div className="w-full h-screen flex items-center justify-center bg-[--color-bg]">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-black mb-2">Error</h1>
        <p className="text-black/60 mb-4">{message}</p>
        <a href="/" className="text-blue-600 hover:underline">Reload</a>
      </div>
    </div>
  );
}
