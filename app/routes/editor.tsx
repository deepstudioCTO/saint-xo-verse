import { isRouteErrorResponse } from "react-router";
import { data } from "react-router";
import { asc } from "drizzle-orm";
import type { Route } from "./+types/editor";
import { getDb, looks } from "~/lib/db.server";
import { loadFromRun, loadFromTemplate, loadSavedProject } from "~/lib/editor-loaders.server";
import { EditorCanvas } from "~/components/editor/EditorCanvas";
import type { EditorEntryData } from "~/components/editor/editorTypes";
import { pickLookStyleParams, hasLookStyleParams } from "~/lib/workflow/lookParams";
import { requireAuth } from "~/lib/auth.server";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = (context.cloudflare as { env: Record<string, string> }).env;
  const { headers: authHeaders } = await requireAuth(request, env);

  const db = getDb(context.cloudflare as { env: Record<string, string> });
  const url = new URL(request.url);

  const runId = url.searchParams.get("run");
  const templateId = url.searchParams.get("template");

  const entryData: EditorEntryData =
    (runId && (await loadFromRun(db, runId))) ||
    (templateId && (await loadFromTemplate(db, templateId))) ||
    (await loadSavedProject(db)) ||
    { mode: "empty" as const };

  // Look 스타일 파라미터를 가진 look 목록 (Run 시 generate-image 노드로 주입, P3-2)
  const dbLooks = await db.select().from(looks).orderBy(asc(looks.displayOrder));
  const lookOptions = dbLooks
    .filter((l) => hasLookStyleParams(pickLookStyleParams(l)))
    .map((l) => ({ id: l.id }));

  return data({ entryData, lookOptions }, { headers: authHeaders });
}

export default function Editor({ loaderData }: Route.ComponentProps) {
  return (
    <div className="w-full h-screen">
      <EditorCanvas entryData={loaderData.entryData} lookOptions={loaderData.lookOptions} />
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
