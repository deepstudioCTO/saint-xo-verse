/**
 * 템플릿·버전 비교 그룹 조립 — 순수 로직. `/api/runs-dashboard`가 호출.
 *
 * 그룹 = 비교 뷰에서 A/B로 고를 수 있는 단위:
 *   - kind "template": 템플릿의 모든 run
 *   - kind "version" : 그 템플릿 중 정규화 스냅샷 해시가 같은 run (templateVersions.ts)
 * 버전 라벨(v1, v2…)은 **첫 실행일 순서**다. DB `template_version`(저장 카운터)은 참고로만 같이 싣는다.
 * 차이(diff)는 브라우저에서 `diffSnapshots`로 계산하도록 대표 스냅샷(그룹의 최신 run)을 싣는다.
 */

import { groupStats, type GroupStats } from "./runsDashboard";
import type { RunRow, TemplateRow } from "./metrics";
import { normalizeSnapshot, snapshotVersionHash, type NormalizedSnapshot } from "./templateVersions";
import { deriveFinalOutput } from "./deriveFinalOutput";
import type { GraphEdgeLike, GraphNodeLike, NodeRunOutputRow } from "./types";

export interface CompareRunRow extends RunRow {
  templateSnapshot: string;
  templateVersion?: number | null;
}

export interface FinalOutput {
  url: string;
  type: "image" | "video";
}

export interface AdoptedOutput extends FinalOutput {
  runId: string;
  startedAt: string;
}

export interface CompareGroup {
  key: string;
  kind: "template" | "version";
  templateId: string;
  templateName: string;
  /** 표시명 — "모션 컨트롤" / "모션 컨트롤 · v2" */
  label: string;
  versionHash: string | null;
  /** 1부터. template 그룹은 null */
  versionIndex: number | null;
  /** 이 그룹 run들에 기록된 DB template_version 값(저장 카운터) — 참고용 */
  savedVersions: number[];
  /** template 그룹: 버전 수 / version 그룹: 1 */
  versionCount: number;
  stats: GroupStats;
  /** 최근 채택 run의 최종 산출물 (최신순) */
  recentAdopted: AdoptedOutput[];
  /** 그룹 최신 run의 정규화 스냅샷 — 버전 간 파라미터 차이 계산용 */
  snapshot: NormalizedSnapshot;
}

function latest<T extends { startedAt: Date }>(rows: T[]): T | undefined {
  return rows.reduce<T | undefined>((acc, r) => (!acc || r.startedAt > acc.startedAt ? r : acc), undefined);
}

function makeGroup(
  base: Omit<CompareGroup, "stats" | "recentAdopted" | "snapshot" | "savedVersions">,
  runs: CompareRunRow[],
  finalOutputs: ReadonlyMap<string, FinalOutput | null>,
  thumbs: number
): CompareGroup {
  const recentAdopted = runs
    .filter((r) => r.status === "completed" && r.adopted === true)
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
    .flatMap((r) => {
      const out = finalOutputs.get(r.id);
      return out ? [{ ...out, runId: r.id, startedAt: r.startedAt.toISOString() }] : [];
    })
    .slice(0, thumbs);
  const saved = [...new Set(runs.map((r) => r.templateVersion).filter((v): v is number => typeof v === "number"))].sort(
    (a, b) => a - b
  );
  const newest = latest(runs);
  return {
    ...base,
    savedVersions: saved,
    stats: groupStats(runs),
    recentAdopted,
    snapshot: newest ? normalizeSnapshot(newest.templateSnapshot) : { nodes: [], edges: [] },
  };
}

export function buildCompareGroups(
  runs: CompareRunRow[],
  templates: TemplateRow[],
  finalOutputs: ReadonlyMap<string, FinalOutput | null>,
  opts: { thumbs?: number } = {}
): CompareGroup[] {
  const thumbs = opts.thumbs ?? 4;
  const nameById = new Map(templates.map((t) => [t.id, t.name]));

  const byTemplate = new Map<string, CompareRunRow[]>();
  for (const r of runs) {
    if (!r.templateId) continue;
    const list = byTemplate.get(r.templateId) ?? [];
    list.push(r);
    byTemplate.set(r.templateId, list);
  }

  const ordered = [...byTemplate.entries()].sort(([idA, a], [idB, b]) => {
    if (b.length !== a.length) return b.length - a.length;
    const na = nameById.get(idA) ?? "";
    const nb = nameById.get(idB) ?? "";
    return na < nb ? -1 : 1;
  });

  const groups: CompareGroup[] = [];
  for (const [templateId, tRuns] of ordered) {
    const templateName = nameById.get(templateId) ?? "(삭제된 템플릿)";

    // 해시별 묶기 → 첫 실행일 순으로 v1, v2…
    const byHash = new Map<string, CompareRunRow[]>();
    for (const r of tRuns) {
      const h = snapshotVersionHash(r.templateSnapshot);
      const list = byHash.get(h) ?? [];
      list.push(r);
      byHash.set(h, list);
    }
    const versions = [...byHash.entries()]
      .map(([hash, vRuns]) => ({ hash, vRuns, first: Math.min(...vRuns.map((r) => r.startedAt.getTime())) }))
      .sort((a, b) => a.first - b.first || (a.hash < b.hash ? -1 : 1));

    groups.push(
      makeGroup(
        {
          key: `t:${templateId}`,
          kind: "template",
          templateId,
          templateName,
          label: templateName,
          versionHash: null,
          versionIndex: null,
          versionCount: versions.length,
        },
        tRuns,
        finalOutputs,
        thumbs
      )
    );
    versions.forEach((v, i) => {
      groups.push(
        makeGroup(
          {
            key: `v:${templateId}:${v.hash}`,
            kind: "version",
            templateId,
            templateName,
            label: `${templateName} · v${i + 1}`,
            versionHash: v.hash,
            versionIndex: i + 1,
            versionCount: 1,
          },
          v.vRuns,
          finalOutputs,
          thumbs
        )
      );
    });
  }
  return groups;
}

/**
 * run별 최종 산출물 — Library 카드와 같은 규칙(deriveFinalOutput: 터미널 노드 우선).
 * 썸네일이 Library에서 보이는 것과 달라지지 않게 같은 함수를 쓴다.
 */
export function finalOutputsByRun(
  runs: { id: string; templateSnapshot: string }[],
  nodeRuns: (NodeRunOutputRow & { runId: string })[]
): Map<string, FinalOutput | null> {
  const byRun = new Map<string, NodeRunOutputRow[]>();
  for (const n of nodeRuns) {
    const list = byRun.get(n.runId) ?? [];
    list.push(n);
    byRun.set(n.runId, list);
  }
  const out = new Map<string, FinalOutput | null>();
  for (const r of runs) {
    let nodes: GraphNodeLike[] = [];
    let edges: GraphEdgeLike[] = [];
    try {
      const parsed = JSON.parse(r.templateSnapshot) as { nodes?: unknown; edges?: unknown };
      if (Array.isArray(parsed.nodes)) nodes = parsed.nodes as GraphNodeLike[];
      if (Array.isArray(parsed.edges)) edges = parsed.edges as GraphEdgeLike[];
    } catch {
      // 깨진 스냅샷 — 산출물 해소 불가
    }
    const o = deriveFinalOutput(nodes, edges, byRun.get(r.id) ?? []);
    out.set(r.id, o ? { url: o.url, type: o.type } : null);
  }
  return out;
}
