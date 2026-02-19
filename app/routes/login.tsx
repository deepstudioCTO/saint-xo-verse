import { Form, useActionData, useSearchParams } from "react-router";
import { data, redirect } from "react-router";
import type { Route } from "./+types/login";
import { createSupabaseServerClient } from "~/lib/supabase-auth.server";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = (context.cloudflare as { env: Record<string, string> }).env;
  const { supabase, headers } = createSupabaseServerClient(request, env);
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    throw redirect("/", { headers });
  }

  return data(null, { headers });
}

export async function action({ request, context }: Route.ActionArgs) {
  const env = (context.cloudflare as { env: Record<string, string> }).env;
  const { supabase, headers } = createSupabaseServerClient(request, env);

  const formData = await request.formData();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const redirectTo = (formData.get("redirectTo") as string) || "/";

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return data({ error: error.message }, { status: 400, headers });
  }

  throw redirect(redirectTo, { headers });
}

export default function Login({ actionData }: Route.ComponentProps) {
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/";

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-white text-center tracking-wider mb-8">
          HitOS
        </h1>

        <Form method="post" className="space-y-4">
          <input type="hidden" name="redirectTo" value={redirectTo} />

          <div>
            <input
              type="email"
              name="email"
              placeholder="Email"
              required
              autoComplete="email"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 text-sm focus:outline-none focus:border-white/30"
            />
          </div>

          <div>
            <input
              type="password"
              name="password"
              placeholder="Password"
              required
              autoComplete="current-password"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 text-sm focus:outline-none focus:border-white/30"
            />
          </div>

          {actionData?.error && (
            <p className="text-red-400 text-xs text-center">{actionData.error}</p>
          )}

          <button
            type="submit"
            className="w-full py-3 bg-white text-black font-semibold text-sm rounded-lg hover:bg-white/90 transition-colors"
          >
            Sign In
          </button>
        </Form>
      </div>
    </div>
  );
}
