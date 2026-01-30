import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { generations, motionVideos } from "../../drizzle/schema";

export function getDb(context: { env: Record<string, string> }) {
  const databaseUrl = context.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  // Cloudflare Workers에서는 요청마다 새 연결 생성 필요
  const client = postgres(databaseUrl, { prepare: false, max: 1 });
  return drizzle(client);
}

export { generations, motionVideos };
