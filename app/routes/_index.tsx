import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams, useLoaderData, useRevalidator, Link, isRouteErrorResponse } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { DndContext, DragOverlay, type Modifier } from "@dnd-kit/core";
import type { Route } from "./+types/_index";
import {
  LOOKBOOKS as DEFAULT_LOOKBOOKS,
  LOOKS as DEFAULT_LOOKS,
  PERSONAS as DEFAULT_PERSONAS,
  SYNCED_LOOKBOOKS,
  SYNCED_LOOKS,
  SYNCED_PERSONAS,
  SYNCED_SKILL_VIDEOS,
  SYNCED_SKILL_IMAGES,
  SYNCED_CHARACTER_IMAGES,
  SYNCED_GENERATIONS,
  type Lookbook,
  type Look,
  type Persona,
} from "~/lib/data";
import { getDb, characterImages, lookbooks, looks, personas, motionVideos, conceptImages, generations } from "~/lib/db.server";
import { getPublicUrl } from "~/lib/supabase.server";
import { asc, desc, eq, sql } from "drizzle-orm";
import { VideoCanvas } from "~/components/effects/VideoCanvas";
import { SkillCompactPanel, SkillExpandedPanel } from "~/components/skill/SkillPanel";
import { HomeFloatingBar, type ActivePanel } from "~/components/layout/HomeFloatingBar";
import { GalleryCompactPanel, GalleryExpandedPanel, GalleryModals } from "~/components/gallery";
import { useGalleryState } from "~/hooks/useGalleryState";
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

const centerOnCursor: Modifier = ({ activatorEvent, activeNodeRect, transform }) => {
  if (!activatorEvent || !activeNodeRect) return transform;
  const ev = activatorEvent as PointerEvent;
  return {
    ...transform,
    x: transform.x + (ev.clientX - activeNodeRect.left - 30),
    y: transform.y + (ev.clientY - activeNodeRect.top - 40),
  };
};

export const meta: Route.MetaFunction = () => [
  { title: "HitOS" },
  { name: "description", content: "Fan-made short-form video creation platform" },
];

interface CharacterImage {
  id: string;
  characterId: string;
  variantId: string;
  storagePath: string;
  publicUrl: string;
}

export async function loader({ request, context }: Route.LoaderArgs) {
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

  try {
    const db = getDb(context.cloudflare as { env: Record<string, string> });

    const [dbLookbooks, dbLooks, dbPersonas, images] = await Promise.all([
      db.select().from(lookbooks).orderBy(asc(lookbooks.displayOrder)),
      db.select().from(looks).orderBy(asc(looks.displayOrder)),
      db.select().from(personas).orderBy(asc(personas.displayOrder)),
      db.select().from(characterImages).orderBy(asc(characterImages.characterId), asc(characterImages.createdAt)),
    ]);

    const lookbookList: Lookbook[] = dbLookbooks.length > 0
      ? dbLookbooks.map((v) => ({
          id: v.id,
          name: v.name,
          displayName: v.displayName,
          description: v.description,
          displayOrder: v.displayOrder,
        }))
      : DEFAULT_LOOKBOOKS;

    const lookList: Look[] = dbLooks.length > 0
      ? dbLooks.map((l) => ({
          id: l.id,
          lookbookId: l.lookbookId,
          displayOrder: l.displayOrder,
        }))
      : DEFAULT_LOOKS;

    const allPersonas: Persona[] = dbPersonas.length > 0
      ? dbPersonas.map((p) => ({
          id: p.id,
          lookId: p.lookId,
          characterId: p.characterId,
          name: p.name,
          description: p.description,
          video: p.video,
          poster: p.poster,
          defaultInput: p.defaultInput,
          displayOrder: p.displayOrder,
        }))
      : DEFAULT_PERSONAS;

    const imagesByCharacter: Record<string, CharacterImage[]> = {};
    for (const img of images) {
      if (!imagesByCharacter[img.characterId]) {
        imagesByCharacter[img.characterId] = [];
      }
      imagesByCharacter[img.characterId].push(img);
    }

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

    // Resolve current look
    const currentLookbookLooks = lookList.filter((l) => l.lookbookId === lookbookParam);
    const currentLookId = lookParam && currentLookbookLooks.some((l) => l.id === lookParam)
      ? lookParam
      : currentLookbookLooks[0]?.id || lookList[0]?.id || "00_01";

    return {
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
    };
  } catch {
    const fallbackLookbooks = SYNCED_LOOKBOOKS.length > 0 ? SYNCED_LOOKBOOKS : DEFAULT_LOOKBOOKS;
    const fallbackLooks = SYNCED_LOOKS.length > 0 ? SYNCED_LOOKS : DEFAULT_LOOKS;
    const fallbackPersonas = SYNCED_PERSONAS.length > 0 ? SYNCED_PERSONAS : DEFAULT_PERSONAS;

    const currentLookbookLooks = fallbackLooks.filter((l) => l.lookbookId === lookbookParam);
    const currentLookId = lookParam && currentLookbookLooks.some((l) => l.id === lookParam)
      ? lookParam
      : currentLookbookLooks[0]?.id || fallbackLooks[0]?.id || "00_01";

    return {
      lookbooks: fallbackLookbooks,
      looks: fallbackLooks,
      currentLookbookId: lookbookParam,
      currentLookId,
      allPersonas: fallbackPersonas,
      imagesByCharacter: SYNCED_CHARACTER_IMAGES,
      skillsCount: SYNCED_SKILL_VIDEOS.length,
      storiesCount: SYNCED_GENERATIONS.filter((g) => g.status === "completed").length,
      skillVideos: SYNCED_SKILL_VIDEOS,
      skillImages: SYNCED_SKILL_IMAGES,
    };
  }
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
  } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const revalidator = useRevalidator();

  // Current lookbook ID from URL (with fallback)
  const activeLookbookId = searchParams.get("lookbook") || currentLookbookId;
  const activeLookId = searchParams.get("look") || loaderLookId;

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
  const galleryOpen = activePanel === "gallery-compact" || activePanel === "gallery-expanded";
  const galleryState = useGalleryState(galleryOpen);

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
    galleryState,
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
  const skillCompactOpen = activePanel === "skill-compact";
  const skillExpandedOpen = activePanel === "skill-expanded";
  const galleryCompactOpen = activePanel === "gallery-compact";
  const galleryExpandedOpen = activePanel === "gallery-expanded";

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
                className="absolute cursor-pointer transition-[transform,opacity] duration-500 ease-out"
                style={{
                  transform: isSelecting
                    ? `translateX(${x}vw) scale(${scale})`
                    : `translateX(${x}px) scale(${scale})`,
                  opacity,
                  zIndex: isSelected ? 10 : 5 - absDiff,
                }}
                onClick={() => {
                  if (isSelecting && character.characterId === selectedId) return;
                  setSearchParams({ selected: character.characterId, lookbook: activeLookbookId, look: activeLookId });
                }}
                onMouseEnter={() => !isSelecting && charNav.setHoveredCharacterId(character.characterId)}
                onMouseLeave={() => !isSelecting && charNav.setHoveredCharacterId(null)}
              >
                {isSelected && skill.isDragging && (
                  <div
                    className={`absolute -inset-[3px] rounded-sm ${skill.isOverPersona ? "persona-glow-intense" : "persona-glow"} transition-opacity duration-300`}
                    style={{ zIndex: -1 }}
                  />
                )}
                <div
                  className="w-[5.5vw] min-w-[80px] max-w-[150px] aspect-[1/2] overflow-hidden rounded-sm"
                  style={{
                    backgroundImage: character.poster ? `url(${character.poster})` : undefined,
                    backgroundSize: "cover",
                    backgroundPosition: "center center",
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

      {/* Click-outside backdrop for compact panels */}
      {activePanel && activePanel !== "gallery-expanded" && activePanel !== "skill-expanded" && (
        <div className="fixed inset-0 z-[25]" onClick={() => setActivePanel(null)} />
      )}

      <HomeFloatingBar
        characterId={currentCharacter?.characterId ?? null}
        characterImageUrl={selectedImgUrl}
        lookbookId={activeLookbookId}
        activePanel={activePanel}
        onPanelChange={setActivePanel}
        selectedVideo={skill.selectedSkillVideo}
        selectedImage={skill.selectedSkillImage}
      >
        {isSelecting && currentCharacter && (
          <SkillCompactPanel
            open={skillCompactOpen}
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
        <GalleryCompactPanel
          open={galleryCompactOpen}
          onExpand={() => setActivePanel("gallery-expanded")}
          galleryState={galleryState}
          gridRef={skill.galleryGridRef}
          flyingCardTargetId={skill.flyingCardTargetId}
        />
      </HomeFloatingBar>

      {isSelecting && currentCharacter && (
        <SkillExpandedPanel
          open={skillExpandedOpen}
          onClose={() => setActivePanel(null)}
          onCollapse={() => setActivePanel("skill-compact")}
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
        galleryState={galleryState}
        lookbookId={activeLookbookId}
      />

      <GalleryModals galleryState={galleryState} />
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
      onProduce={skill.handleProduce}
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
