import { redirect } from "react-router";
import type { Route } from "./+types/api.logout";
import { createSupabaseServerClient } from "~/lib/supabase-auth.server";

export async function action({ request, context }: Route.ActionArgs) {
  const env = (context.cloudflare as { env: Record<string, string> }).env;
  const { supabase, headers } = createSupabaseServerClient(request, env);
  await supabase.auth.signOut();
  throw redirect("/login", { headers });
}

export async function loader() {
  throw redirect("/");
}
