/**
 * 생성물 채택(품질 검수 통과) 플래그 일괄 마킹 CLI.
 *
 * 보고용 "완성 숏폼 편수"는 실행 성공 편수가 아니라 검수 통과 편수다.
 * 화면 토글(Library 상세 모달)은 1건씩이라, 이미 제출한 과거분을 소급 마킹하려면 이 CLI가 필요하다.
 *
 * 실행:
 *   export $(grep -v '^#' .env | xargs) && npx tsx scripts/mark-adopted.ts --list
 *   ... scripts/mark-adopted.ts --all-completed          # 완료 run 전부 채택
 *   ... scripts/mark-adopted.ts --since 2026-08-01       # 해당 날짜 이후 완료 run 채택
 *   ... scripts/mark-adopted.ts --ids <uuid>,<uuid>      # 지정 run만
 *   ... scripts/mark-adopted.ts --ids <uuid> --unadopt   # 채택 해제
 *
 * 완료되지 않은 run은 검수 대상이 아니므로 절대 채택하지 않는다(API와 같은 규칙).
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { and, eq, gte, inArray } from "drizzle-orm";
import { workflowRuns, workflowTemplates } from "../drizzle/schema";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(`--${name}`);
const value = (name: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};

const client = postgres(databaseUrl, { prepare: false });
const db = drizzle(client);

async function main() {
  const templates = await db.select().from(workflowTemplates);
  const templateName = new Map(templates.map((t) => [t.id, t.name]));

  if (flag("list") || argv.length === 0) {
    const runs = await db.select().from(workflowRuns);
    runs.sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
    console.log(`총 ${runs.length}건`);
    for (const r of runs) {
      console.log(
        [
          r.adopted ? "[채택]" : "[    ]",
          r.id,
          r.status.padEnd(9),
          r.startedAt.toISOString().slice(0, 16).replace("T", " "),
          r.templateId ? templateName.get(r.templateId) ?? "(삭제됨)" : "(출처없음)",
        ].join("  ")
      );
    }
    const adopted = runs.filter((r) => r.adopted).length;
    console.log(`\n채택 ${adopted}건 / 완료 ${runs.filter((r) => r.status === "completed").length}건`);
    await client.end();
    return;
  }

  const adopt = !flag("unadopt");
  const ids = value("ids")?.split(",").map((s) => s.trim()).filter(Boolean);
  const since = value("since");

  let targets;
  if (ids && ids.length > 0) {
    targets = await db.select().from(workflowRuns).where(inArray(workflowRuns.id, ids));
  } else if (since) {
    const from = new Date(`${since}T00:00:00Z`);
    if (Number.isNaN(from.getTime())) throw new Error(`--since 날짜 형식 오류: ${since}`);
    targets = await db
      .select()
      .from(workflowRuns)
      .where(and(eq(workflowRuns.status, "completed"), gte(workflowRuns.startedAt, from)));
  } else if (flag("all-completed")) {
    targets = await db.select().from(workflowRuns).where(eq(workflowRuns.status, "completed"));
  } else {
    throw new Error("--ids / --since / --all-completed 중 하나가 필요합니다 (--list로 조회)");
  }

  // 완료되지 않은 run은 검수 대상이 아니다 — 조용히 건너뛰지 않고 이유를 남긴다
  const skipped = adopt ? targets.filter((r) => r.status !== "completed") : [];
  const applicable = adopt ? targets.filter((r) => r.status === "completed") : targets;

  if (applicable.length > 0) {
    await db
      .update(workflowRuns)
      .set({ adopted: adopt, adoptedAt: adopt ? new Date() : null })
      .where(inArray(workflowRuns.id, applicable.map((r) => r.id)));
  }

  console.log(`${adopt ? "채택" : "채택 해제"} ${applicable.length}건`);
  for (const r of applicable) {
    console.log(`  ${r.id}  ${r.startedAt.toISOString().slice(0, 16).replace("T", " ")}`);
  }
  if (skipped.length > 0) {
    console.log(`\n건너뜀 ${skipped.length}건 (완료되지 않은 run은 검수 대상이 아님)`);
    for (const r of skipped) console.log(`  ${r.id}  status=${r.status}`);
  }

  await client.end();
}

main().catch((err) => {
  console.error("실패:", err);
  process.exit(1);
});
