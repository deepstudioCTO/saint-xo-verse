import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, useLoaderData } from "react-router";
import { eq } from "drizzle-orm";
import type { Route } from "./+types/generate";
import { PageLayout } from "~/components/layout";
import { CHARACTERS_BY_ID, TRACKS_BY_ID } from "~/lib/data";
import { getDb, motionVideos } from "~/lib/db.server";
import { getPublicUrl } from "~/lib/supabase.server";

export const meta: Route.MetaFunction = () => [
  { title: "Generating - Saint XO Verse" },
];

interface LoaderData {
  motionVideo: {
    id: string;
    name: string;
    videoUrl: string;
  } | null;
  error?: string;
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const motionVideoId = url.searchParams.get("motionVideo");

  if (!motionVideoId) {
    return { motionVideo: null, error: "Motion video ID is required" };
  }

  const db = getDb(context.cloudflare as { env: Record<string, string> });

  // Query motion video
  const [video] = await db
    .select()
    .from(motionVideos)
    .where(eq(motionVideos.id, motionVideoId))
    .limit(1);

  if (!video) {
    return { motionVideo: null, error: "Motion video not found" };
  }

  const videoUrl = getPublicUrl(
    context.cloudflare as { env: Record<string, string> },
    video.storagePath
  );

  return {
    motionVideo: {
      id: video.id,
      name: video.name,
      videoUrl,
    },
  };
}

export default function Generate() {
  const loaderData = useLoaderData<LoaderData>();
  const motionVideo = loaderData?.motionVideo;
  const loaderError = loaderData?.error;

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const characterId = searchParams.get("character") || "1";
  const musicId = searchParams.get("music") || "1";

  const character = CHARACTERS_BY_ID[characterId] || { name: "Unknown", imageUrl: "" };
  const trackName = TRACKS_BY_ID[musicId]?.title || "Unknown";

  const [status, setStatus] = useState<"idle" | "generating" | "polling" | "completed" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(loaderError || null);

  // Auto-start generation
  useEffect(() => {
    if (motionVideo && status === "idle") {
      startGeneration();
    }
  }, [motionVideo]);

  const startGeneration = async () => {
    if (!motionVideo || !character.imageUrl) {
      setErrorMessage("Missing required data");
      setStatus("error");
      return;
    }

    setStatus("generating");
    setProgress(5);

    try {
      const formData = new FormData();
      formData.append("imageUrl", character.imageUrl);
      formData.append("videoUrl", motionVideo.videoUrl);
      formData.append("memberId", characterId); // DB field name preserved
      formData.append("musicId", musicId);
      formData.append("motionVideoId", motionVideo.id);

      const response = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Generation failed");
      }

      const result = await response.json();
      setGenerationId(result.generationId);
      setStatus("polling");
      setProgress(10);

      // Start polling
      pollStatus(result.generationId);
    } catch (error) {
      console.error("Generation error:", error);
      setErrorMessage(error instanceof Error ? error.message : "Generation failed");
      setStatus("error");
    }
  };

  const pollStatus = async (genId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/generate?id=${genId}`);
        if (!response.ok) {
          throw new Error("Failed to fetch status");
        }

        const result = await response.json();

        if (result.status === "completed") {
          clearInterval(pollInterval);
          setProgress(100);
          setStatus("completed");
          setTimeout(() => {
            navigate(`/result/${genId}`);
          }, 500);
        } else if (result.status === "failed") {
          clearInterval(pollInterval);
          setErrorMessage(result.error || "Generation failed");
          setStatus("error");
        } else {
          // Update progress (estimated)
          setProgress((prev) => Math.min(prev + 5, 90));
        }
      } catch (error) {
        console.error("Polling error:", error);
      }
    }, 5000); // Poll every 5 seconds

    // 10 minute timeout
    setTimeout(() => {
      clearInterval(pollInterval);
      if (status === "polling") {
        setErrorMessage("Generation timed out");
        setStatus("error");
      }
    }, 600000);
  };

  const handleClose = () => {
    navigate(`/motion?character=${characterId}&music=${musicId}`);
  };

  // Demo mode - simulate if API is not configured
  useEffect(() => {
    if (status === "idle" && !motionVideo) {
      // Demo mode: simulation
      setStatus("generating");
      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            setTimeout(() => {
              navigate(`/result/demo-${Date.now()}`);
            }, 500);
            return 100;
          }
          return prev + 2;
        });
      }, 100);

      return () => clearInterval(interval);
    }
  }, [status, motionVideo, navigate]);

  return (
    <PageLayout
      headerRight={
        <button
          onClick={handleClose}
          className="text-subtitle hover:text-[--color-text] transition-normal"
        >
          CLOSE
        </button>
      }
      hideFloatingBar
    >
      {/* Full screen container */}
      <div className="fixed inset-0 flex flex-col">
        {/* Video Section - takes most of the top */}
        <div className="flex-1 relative overflow-hidden">
          {/* Background blur effect */}
          {motionVideo?.videoUrl && (
            <div className="absolute inset-0">
              <video
                src={motionVideo.videoUrl}
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover scale-150 blur-3xl opacity-30"
              />
            </div>
          )}

          {/* Main video */}
          <div className="absolute inset-0 flex items-center justify-center p-8">
            {motionVideo?.videoUrl ? (
              <video
                src={motionVideo.videoUrl}
                autoPlay
                loop
                muted
                playsInline
                className="max-h-full max-w-full object-contain rounded-lg shadow-2xl"
                style={{ maxHeight: "calc(100vh - 200px)" }}
              />
            ) : (
              <div className="w-64 h-96 bg-[--color-border-light] rounded-lg animate-pulse" />
            )}
          </div>

          {/* Status overlay */}
          {status === "error" && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <div className="text-center">
                <p className="text-red-400 text-lg mb-2">Generation Failed</p>
                <p className="text-red-300/70 text-sm mb-6 max-w-xs">{errorMessage}</p>
                <button
                  onClick={() => {
                    setStatus("idle");
                    setProgress(0);
                    setErrorMessage(null);
                  }}
                  className="px-6 py-2.5 bg-white text-black rounded-full text-sm font-medium hover:bg-white/90 transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Bottom info + progress bar */}
        <div className="bg-[--color-bg] px-6 py-5">
          {/* Selection info */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">{character.name}</span>
              <span className="text-[--color-text-tertiary]">×</span>
              <span className="text-sm text-[--color-text-secondary]">{motionVideo?.name || "Unknown"}</span>
              <span className="text-[--color-text-tertiary]">×</span>
              <span className="text-sm text-[--color-text-secondary]">{trackName}</span>
            </div>
            {status !== "error" && progress < 100 && (
              <span className="text-xs text-[--color-text-tertiary]">~4 min</span>
            )}
          </div>

          {/* Progress bar */}
          {status !== "error" && (
            <div className="relative">
              {/* Background bar */}
              <div className="h-1 bg-[--color-border-light] rounded-full overflow-hidden">
                {/* Progress bar */}
                <div
                  className="h-full bg-gradient-to-r from-[--color-text] to-[--color-text-secondary] rounded-full transition-all duration-300 ease-out relative"
                  style={{ width: `${progress}%` }}
                >
                  {/* Glow effect */}
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
                </div>
              </div>

              {/* Percentage display */}
              <div className="flex justify-between mt-2">
                <span className="text-xs text-[--color-text-tertiary]">
                  {status === "generating" ? "Requesting generation..." : status === "polling" ? "Generating video..." : "Preparing..."}
                </span>
                <span className="text-xs font-mono text-[--color-text-secondary]">{progress}%</span>
              </div>
            </div>
          )}

          {/* Completed state */}
          {status === "completed" && (
            <div className="flex items-center justify-center gap-2 text-green-500">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm font-medium">Complete!</span>
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
