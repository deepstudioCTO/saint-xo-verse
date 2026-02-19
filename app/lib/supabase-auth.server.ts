import { createServerClient, parseCookieHeader, serializeCookieHeader } from "@supabase/ssr";

export function createSupabaseServerClient(
  request: Request,
  env: Record<string, string>
) {
  const headers = new Headers();

  const supabase = createServerClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return parseCookieHeader(request.headers.get("Cookie") ?? "");
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          headers.append(
            "Set-Cookie",
            serializeCookieHeader(name, value, options)
          );
        });
      },
    },
  });

  return { supabase, headers };
}
