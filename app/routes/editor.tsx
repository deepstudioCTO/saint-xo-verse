import { isRouteErrorResponse, useSearchParams } from "react-router";
import { data } from "react-router";
import { eq } from "drizzle-orm";
import type { Route } from "./+types/editor";
import { getDb, editorProjects } from "~/lib/db.server";
import { EditorCanvas } from "~/components/editor/EditorCanvas";
import { requireAuth } from "~/lib/auth.server";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = (context.cloudflare as { env: Record<string, string> }).env;
  const { headers: authHeaders } = await requireAuth(request, env);

  const db = getDb(context.cloudflare as { env: Record<string, string> });
  const rows = await db
    .select()
    .from(editorProjects)
    .where(eq(editorProjects.id, "default"))
    .limit(1);
  return data({ savedProject: rows[0] ?? null }, { headers: authHeaders });
}

export default function Editor({ loaderData }: Route.ComponentProps) {
  const [searchParams] = useSearchParams();

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
