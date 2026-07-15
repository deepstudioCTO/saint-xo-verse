import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { generations, motionVideos, characterImages, conceptImages, characters, lookbooks, looks, personas, editorProjects, stylePresets, workflowTemplates, workflowRuns, nodeRuns } from "../../drizzle/schema";

export function getDb(context: { env: Record<string, string> }) {
  const databaseUrl = context.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  // Cloudflare Workers에서는 요청마다 새 연결 생성 필요
  const client = postgres(databaseUrl, { prepare: false, max: 1 });
  return drizzle(client);
}

/**
 * 커넥션을 명시적으로 닫아야 하는 컨텍스트(장시간 Workflow step, 고빈도 폴링)용.
 * `getDb`는 pool을 열고 닫지 않아 Supabase 세션 풀(pool_size 15)을 소진시킨다(EMAXCONNSESSION).
 * 반환된 client를 반드시 `client.end()`로 닫을 것 — 아래 withDb 헬퍼 사용 권장.
 */
export function getDbClient(context: { env: Record<string, string> }) {
  const databaseUrl = context.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const client = postgres(databaseUrl, { prepare: false, max: 1 });
  return { db: drizzle(client), client };
}

/** DB 작업을 커넥션 자동 정리와 함께 실행 */
export async function withDb<T>(
  context: { env: Record<string, string> },
  fn: (db: ReturnType<typeof drizzle>) => Promise<T>
): Promise<T> {
  const { db, client } = getDbClient(context);
  try {
    return await fn(db);
  } finally {
    await client.end({ timeout: 5 });
  }
}

export { generations, motionVideos, characterImages, conceptImages, characters, lookbooks, looks, personas, editorProjects, stylePresets, workflowTemplates, workflowRuns, nodeRuns };
