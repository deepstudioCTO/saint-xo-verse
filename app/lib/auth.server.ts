import { redirect } from "react-router";
import { createSupabaseServerClient } from "./supabase-auth.server";

/**
 * Page route guard — redirects to /login if not authenticated
 */
export async function requireAuth(request: Request, env: Record<string, string>) {
  const { supabase, headers } = createSupabaseServerClient(request, env);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const url = new URL(request.url);
    const redirectTo = url.pathname + url.search;
    throw redirect(`/login?redirectTo=${encodeURIComponent(redirectTo)}`, {
      headers,
    });
  }

  return { user, headers, supabase };
}

/**
 * API route guard — returns 401 JSON if not authenticated
 */
export async function requireAuthApi(request: Request, env: Record<string, string>) {
  const { supabase, headers } = createSupabaseServerClient(request, env);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw Response.json({ error: "Unauthorized" }, { status: 401, headers });
  }

  return { user, headers, supabase };
}
