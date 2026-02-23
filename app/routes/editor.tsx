import { isRouteErrorResponse, useSearchParams } from "react-router";
import { data } from "react-router";
import { eq } from "drizzle-orm";
import type { Route } from "./+types/editor";
import { getDb, editorProjects, workflowRuns, workflowTemplates, nodeRuns, generations } from "~/lib/db.server";
import { EditorCanvas } from "~/components/editor/EditorCanvas";
import type { WorkflowData } from "~/components/editor/editorTypes";
import { requireAuth } from "~/lib/auth.server";

/**
 * Lazy backfill: generation → workflow_run + node_run on-the-fly 생성
 * Edit 클릭 시 해당 generation에 연결된 node_run이 없으면 자동 생성
 */
async function backfillGenerationToRun(
  db: ReturnType<typeof getDb>,
  generationId: string
) {
  const [gen] = await db
    .select()
    .from(generations)
    .where(eq(generations.id, generationId))
    .limit(1);

  if (!gen) return null;

  const isImage = gen.type === "image";
  const nodeType = isImage ? "generate-image" : "generate";
  const mediaUrl = isImage ? gen.outputUrl : gen.videoUrl;

  const snapshot = JSON.stringify({
    nodes: [
      {
        id: "source-1",
        type: "source",
        data: { label: "Source", media: { type: isImage ? "image" : "video", url: gen.imageUrl } },
      },
      {
        id: "generate-1",
        type: nodeType,
        data: { label: isImage ? "Generate Image" : "Generate" },
      },
    ],
    edges: [{ id: "e-source-generate", source: "source-1", target: "generate-1" }],
  });

  const inputs = JSON.stringify({
    characterId: gen.memberId,
    imageUrl: gen.imageUrl,
    motionVideoUrl: gen.motionVideoUrl,
    motionVideoId: gen.motionVideoId,
    lookbookId: gen.lookbookId,
    lookId: gen.lookId,
    prompt: gen.prompt,
    conceptImageId: gen.conceptImageId,
  });

  const outputs = mediaUrl
    ? JSON.stringify({ url: mediaUrl, type: gen.type })
    : null;

  const [run] = await db
    .insert(workflowRuns)
    .values({
      templateSnapshot: snapshot,
      inputs,
      outputs,
      status: gen.status === "completed" ? "completed" : gen.status === "failed" ? "failed" : "pending",
      completedAt: gen.status === "completed" ? gen.updatedAt : null,
    })
    .returning();

  await db.insert(nodeRuns).values({
    runId: run.id,
    nodeId: "generate-1",
    nodeType,
    inputs: JSON.stringify({
      image: gen.imageUrl,
      video: gen.motionVideoUrl,
      prompt: gen.prompt,
    }),
    outputs,
    status: run.status,
    externalId: gen.predictionId,
    externalProvider: "replicate",
    legacyGenerationId: gen.id,
    completedAt: run.completedAt,
  });

  return run;
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = (context.cloudflare as { env: Record<string, string> }).env;
  const { headers: authHeaders } = await requireAuth(request, env);

  const db = getDb(context.cloudflare as { env: Record<string, string> });
  const url = new URL(request.url);

  // Always load scratch project
  const rows = await db
    .select()
    .from(editorProjects)
    .where(eq(editorProjects.id, "default"))
    .limit(1);
  const savedProject = rows[0] ?? null;

  // Check for workflow-related params
  const runId = url.searchParams.get("run");
  const generationId = url.searchParams.get("generationId");
  const templateId = url.searchParams.get("template");

  let workflowData: WorkflowData | null = null;

  if (runId) {
    // Load run snapshot directly
    const [run] = await db
      .select()
      .from(workflowRuns)
      .where(eq(workflowRuns.id, runId))
      .limit(1);

    if (run) {
      try {
        const snap = JSON.parse(run.templateSnapshot);
        workflowData = {
          source: "run",
          nodes: JSON.stringify(snap.nodes || []),
          edges: JSON.stringify(snap.edges || []),
          runId: run.id,
        };
      } catch {
        console.error("Failed to parse run templateSnapshot:", run.id);
      }
    }
  } else if (generationId) {
    // Find linked node_run → workflow_run
    const [linkedNodeRun] = await db
      .select()
      .from(nodeRuns)
      .where(eq(nodeRuns.legacyGenerationId, generationId))
      .limit(1);

    let run;
    if (linkedNodeRun) {
      [run] = await db
        .select()
        .from(workflowRuns)
        .where(eq(workflowRuns.id, linkedNodeRun.runId))
        .limit(1);
    } else {
      // Lazy backfill
      run = await backfillGenerationToRun(db, generationId);
    }

    if (run) {
      try {
        const snap = JSON.parse(run.templateSnapshot);
        workflowData = {
          source: "generation",
          nodes: JSON.stringify(snap.nodes || []),
          edges: JSON.stringify(snap.edges || []),
          runId: run.id,
          generationId,
        };
      } catch {
        console.error("Failed to parse run templateSnapshot:", run.id);
      }
    }
  } else if (templateId) {
    // Load template
    const [template] = await db
      .select()
      .from(workflowTemplates)
      .where(eq(workflowTemplates.id, templateId))
      .limit(1);

    if (template) {
      workflowData = {
        source: "template",
        nodes: template.nodes,
        edges: template.edges,
        viewport: template.viewport ?? undefined,
        templateId: template.id,
      };
    }
  }

  return data({ savedProject, workflowData }, { headers: authHeaders });
}

export default function Editor({ loaderData }: Route.ComponentProps) {
  const [searchParams] = useSearchParams();

  // Legacy: support ?media= for backward compat
  const mediaUrl = searchParams.get("media");
  const initialMedia = mediaUrl
    ? {
        type: (searchParams.get("type") || "video") as "video" | "image",
        url: mediaUrl,
        name: searchParams.get("name") || "Untitled",
      }
    : null;
  const sourceGenerationId = searchParams.get("generationId") || undefined;

  return (
    <div className="w-full h-screen">
      <EditorCanvas
        savedProject={loaderData.savedProject}
        initialMedia={initialMedia}
        sourceGenerationId={sourceGenerationId}
        workflowData={loaderData.workflowData}
      />
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const message = isRouteErrorResponse(error) ? `${error.status} ${error.statusText}` : "Something went wrong";
  return (
    <div className="w-full h-screen flex items-center justify-center bg-black text-white">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">Editor Error</h1>
        <p className="text-white/60 mb-4">{message}</p>
        <a href="/editor" className="text-blue-400 hover:underline">Reload</a>
      </div>
    </div>
  );
}
