import { asc } from "drizzle-orm";
import type { Route } from "./+types/api.personas";
import { getDb, lookbooks, looks, personas } from "~/lib/db.server";
import { requireAuthApi } from "~/lib/auth.server";

/**
 * GET /api/personas
 *
 * 에디터 Look 노드의 페르소나 피커용 카탈로그.
 * 홈 loader와 달리 레퍼런스 이미지(defaultInput ?? poster)만 해소해서 내려준다
 * — Look 노드는 영상/설명이 필요 없고 하류 생성 노드에 넣을 이미지 1장만 쓴다.
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const env = (context.cloudflare as { env: Record<string, string> }).env;
  const { headers: authHeaders } = await requireAuthApi(request, env);

  const db = getDb(context.cloudflare as { env: Record<string, string> });

  const [dbLookbooks, dbLooks, dbPersonas] = await Promise.all([
    db.select().from(lookbooks).orderBy(asc(lookbooks.displayOrder)),
    // lookbookId 먼저 정렬 — displayOrder는 lookbook 내부 순번이라 단독 정렬하면
    // 00_01, 01_01, 00_02… 로 섞여 UI의 lookbook 그룹이 쪼개진다.
    db.select().from(looks).orderBy(asc(looks.lookbookId), asc(looks.displayOrder)),
    db.select().from(personas).orderBy(asc(personas.displayOrder)),
  ]);

  const lookbookName = new Map(dbLookbooks.map((lb) => [lb.id, lb.displayName]));

  return Response.json(
    {
      looks: dbLooks.map((l) => ({
        id: l.id,
        lookbookId: l.lookbookId,
        lookbookName: lookbookName.get(l.lookbookId) ?? l.lookbookId,
      })),
      personas: dbPersonas.map((p) => ({
        lookId: p.lookId,
        characterId: p.characterId,
        name: p.name,
        imageUrl: p.defaultInput ?? p.poster,
      })),
    },
    { headers: authHeaders }
  );
}
