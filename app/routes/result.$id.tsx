import { useState } from "react";
import { Link, useLoaderData } from "react-router";
import { eq } from "drizzle-orm";
import type { Route } from "./+types/result.$id";
import { PageLayout } from "~/components/layout";
import { VideoPlayerWithMusic } from "~/components/common/VideoPlayerWithMusic";
import { getMusicFilePath, getTrackName } from "~/lib/music-data";
import { mergeVideoWithMusic, downloadBlob, type MergeProgress } from "~/lib/audio-merge";
import { CHARACTERS_BY_ID, createCharactersById, type Character } from "~/lib/data";
import { getDb, generations, motionVideos, characters } from "~/lib/db.server";
import { asc } from "drizzle-orm";

export const meta: Route.MetaFunction = () => [
  { title: "Result - Saint XO Verse" },
];

interface LoaderData {
  generation: {
    id: string;
    memberId: string | null;
    musicId: string | null;
    videoUrl: string | null;
    status: string;
    createdAt: string;
  } | null;
  motionVideo: {
    name: string;
  } | null;
  characters: Character[];
  error?: string;
}

export async function loader({ params, context }: Route.LoaderArgs) {
  const id = params.id;

  if (!id) {
    return { generation: null, motionVideo: null, characters: [], error: "ID is required" };
  }

  const db = getDb(context.cloudflare as { env: Record<string, string> });

  // Query Generation
  const [generation] = await db
    .select()
    .from(generations)
    .where(eq(generations.id, id))
    .limit(1);

  if (!generation) {
    return { generation: null, motionVideo: null, characters: [], error: "Generation not found" };
  }

  // Query Motion Video name
  let motionVideo = null;
  if (generation.motionVideoId) {
    const [mv] = await db
      .select({ name: motionVideos.name })
      .from(motionVideos)
      .where(eq(motionVideos.id, generation.motionVideoId))
      .limit(1);
    motionVideo = mv || null;
  }

  // Query all characters
  const allCharacters = await db
    .select()
    .from(characters)
    .orderBy(asc(characters.displayOrder));

  const characterList: Character[] = allCharacters.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    video: c.video,
    poster: c.poster,
    displayOrder: c.displayOrder,
  }));

  return {
    generation: {
      id: generation.id,
      memberId: generation.memberId,
      musicId: generation.musicId,
      videoUrl: generation.videoUrl,
      status: generation.status,
      createdAt: generation.createdAt.toISOString(),
    },
    motionVideo,
    characters: characterList,
  };
}

export default function Result() {
  const { generation, motionVideo, characters: loadedCharacters, error } = useLoaderData<LoaderData>();
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<MergeProgress | null>(null);

  // Create character lookup map from loaded data or fallback to defaults
  const charactersById = loadedCharacters.length > 0
    ? createCharactersById(loadedCharacters)
    : CHARACTERS_BY_ID;

  if (error || !generation) {
    return (
      <PageLayout>
        <div className="page-padding min-h-[calc(100vh-7.5rem)] flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-400 mb-4">{error || "Result not found"}</p>
            <Link to="/" className="text-sm underline">Go Home</Link>
          </div>
        </div>
      </PageLayout>
    );
  }

  const character = charactersById[generation.memberId || ""] || { name: "Unknown", imageUrl: "" };
  const trackName = getTrackName(generation.musicId);
  const motionName = motionVideo?.name || "Unknown";
  const musicPath = getMusicFilePath(generation.musicId);

  const handleDownload = async () => {
    if (!generation.videoUrl) return;

    const filename = `${character.name}_${motionName}.mp4`;

    // Download original if no music
    if (!musicPath) {
      try {
        const response = await fetch(generation.videoUrl);
        const blob = await response.blob();
        downloadBlob(blob, filename);
      } catch (err) {
        console.error("Download failed:", err);
      }
      return;
    }

    // Merge with music using ffmpeg then download
    setIsDownloading(true);
    setDownloadProgress({ stage: "loading", progress: 0 });

    try {
      const mergedBlob = await mergeVideoWithMusic(
        generation.videoUrl,
        musicPath,
        setDownloadProgress
      );
      downloadBlob(mergedBlob, filename);
    } catch (err) {
      console.error("Merge failed:", err);
      alert("Video merge failed. Downloading original video.");
      // Fallback: download original
      try {
        const response = await fetch(generation.videoUrl);
        const blob = await response.blob();
        downloadBlob(blob, filename);
      } catch (fallbackErr) {
        console.error("Fallback download failed:", fallbackErr);
      }
    } finally {
      setIsDownloading(false);
      setDownloadProgress(null);
    }
  };

  const handleShare = async () => {
    if (navigator.share && generation.videoUrl) {
      try {
        await navigator.share({
          title: `${character.name} × ${motionName}`,
          url: window.location.href,
        });
      } catch (err) {
        // User cancelled
      }
    } else {
      // Copy URL to clipboard
      await navigator.clipboard.writeText(window.location.href);
      alert("Link copied!");
    }
  };

  const getProgressText = () => {
    if (!downloadProgress) return "";
    switch (downloadProgress.stage) {
      case "loading":
        return "Loading ffmpeg...";
      case "downloading":
        return "Downloading files...";
      case "merging":
        return `Merging audio... ${downloadProgress.progress}%`;
      case "complete":
        return "Complete!";
      default:
        return "";
    }
  };

  return (
    <PageLayout
      showBack
      backTo="/gallery"
      showHome
      showGallery
      floatingLeft={
        <div className="flex items-center gap-4">
          <button
            onClick={handleDownload}
            disabled={!generation.videoUrl || isDownloading}
            className="text-sm font-medium text-[--color-text-secondary] hover:text-[--color-text] transition-normal disabled:opacity-50"
          >
            {isDownloading ? "Processing..." : "Download"}
          </button>
          <button
            onClick={handleShare}
            className="text-sm font-medium text-[--color-text-secondary] hover:text-[--color-text] transition-normal"
          >
            Share
          </button>
        </div>
      }
      ctaText="Create New →"
      ctaTo="/"
    >
      {/* Full screen layout */}
      <div className="flex flex-col min-h-[calc(100vh-7.5rem)]">
        {/* Video Section */}
        <div className="flex-1 relative overflow-hidden bg-black min-h-[60vh]">
          {generation.videoUrl ? (
            <>
              {/* Background blur - muted playback without music */}
              <video
                src={generation.videoUrl}
                autoPlay
                loop
                muted
                playsInline
                className="absolute inset-0 w-full h-full object-cover scale-150 blur-3xl opacity-30"
              />
              {/* Main video - synced with music */}
              <div className="absolute inset-0 flex items-center justify-center p-4">
                <VideoPlayerWithMusic
                  videoUrl={generation.videoUrl}
                  musicId={generation.musicId}
                  autoPlay
                  loop
                  controls
                  className="max-h-full max-w-full object-contain rounded-lg shadow-2xl"
                />
              </div>
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                {generation.status === "processing" || generation.status === "pending" ? (
                  <>
                    <div className="w-12 h-12 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-white/60">Generating video...</p>
                  </>
                ) : generation.status === "failed" ? (
                  <p className="text-red-400">Video generation failed</p>
                ) : (
                  <p className="text-white/60">Unable to load video</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Download progress bar */}
        {isDownloading && downloadProgress && (
          <div className="bg-neutral-900 px-6 py-3">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              <span className="text-sm text-white">{getProgressText()}</span>
            </div>
            <div className="h-1.5 bg-neutral-700 rounded overflow-hidden">
              <div
                className="h-full bg-white transition-all duration-300"
                style={{ width: `${downloadProgress.progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Bottom info */}
        <div className="bg-[--color-bg] px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-base font-medium">{character.name}</span>
              <span className="text-[--color-text-tertiary]">×</span>
              <span className="text-sm text-[--color-text-secondary]">{motionName}</span>
              <span className="text-[--color-text-tertiary]">×</span>
              <span className="text-sm text-[--color-text-secondary]">{trackName}</span>
            </div>
            <span className="text-xs text-[--color-text-tertiary]">
              {new Date(generation.createdAt).toLocaleDateString("ko-KR")}
            </span>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
