import { useMemo, useState } from "react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "~/components/ui/select";
import type { CompareGroup } from "~/lib/workflow/templateCompare";
import { diffSnapshots, summarizeValue } from "~/lib/workflow/templateVersions";
import { pct, duration, day } from "./insightFormat";

/** 기본 선택: 버전이 2개 이상인 템플릿이 있으면 그 최근 두 버전, 아니면 상위 두 템플릿 */
function defaultPair(groups: CompareGroup[]): [string, string] {
  const multi = groups.find((g) => g.kind === "template" && g.versionCount >= 2);
  if (multi) {
    const versions = groups.filter((g) => g.kind === "version" && g.templateId === multi.templateId);
    return [versions[versions.length - 2].key, versions[versions.length - 1].key];
  }
  const templates = groups.filter((g) => g.kind === "template");
  return [templates[0]?.key ?? "", templates[1]?.key ?? templates[0]?.key ?? ""];
}

function GroupSelect({ groups, value, onChange }: { groups: CompareGroup[]; value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="min-w-56">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {groups.map((g) => (
          <SelectItem key={g.key} value={g.key}>
            {g.kind === "version" ? `${g.label} (${g.stats.runs}회)` : `${g.label} — 전체 ${g.stats.runs}회`}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function Thumbs({ group }: { group: CompareGroup }) {
  if (group.recentAdopted.length === 0) {
    return <div className="text-xs text-neutral-400 py-6">채택된 산출물 없음</div>;
  }
  return (
    <div className="flex gap-2">
      {group.recentAdopted.map((o) =>
        o.type === "video" ? (
          <video
            key={o.runId}
            src={`${o.url}#t=0.5`}
            muted
            playsInline
            preload="metadata"
            className="w-24 aspect-[9/16] object-cover rounded-sm bg-[--color-border-light]"
          />
        ) : (
          <img key={o.runId} src={o.url} alt="" className="w-24 aspect-[9/16] object-cover rounded-sm bg-[--color-border-light]" />
        )
      )}
    </div>
  );
}

const th = "text-left text-[11px] font-medium text-neutral-500 px-3 py-2";
const td = "px-3 py-2 text-xs text-neutral-800 tabular-nums";

/**
 * 템플릿 A vs B (또는 같은 템플릿의 버전 A vs B) 비교.
 * 버전 = 정규화 스냅샷 해시(templateVersions.ts) — 멤버·트랙 교체는 같은 버전으로 묶인다.
 */
export function TemplateCompareView({ groups }: { groups: CompareGroup[] }) {
  const initial = useMemo(() => defaultPair(groups), [groups]);
  const [aKey, setAKey] = useState(initial[0]);
  const [bKey, setBKey] = useState(initial[1]);
  const a = groups.find((g) => g.key === aKey);
  const b = groups.find((g) => g.key === bKey);
  const diff = useMemo(() => (a && b ? diffSnapshots(a.snapshot, b.snapshot) : null), [a, b]);

  if (groups.length === 0) return <div className="text-xs text-neutral-400">비교할 템플릿 실행 기록이 없습니다</div>;

  const rows: [string, (g: CompareGroup) => string][] = [
    ["실행 수", (g) => `${g.stats.runs}회`],
    ["완료 / 실패", (g) => `${g.stats.completed} / ${g.stats.failed}`],
    ["run 성공률", (g) => pct(g.stats.successRate)],
    ["채택률", (g) => `${pct(g.stats.adoptionRate)} (${g.stats.adopted}/${g.stats.completed})`],
    ["중앙 소요시간", (g) => duration(g.stats.medianSec)],
    ["첫 실행 / 최근 실행", (g) => `${day(g.stats.firstRunAt)} / ${day(g.stats.lastRunAt)}`],
    [
      "버전",
      (g) =>
        g.kind === "template"
          ? `${g.versionCount}개`
          : `v${g.versionIndex} · #${g.versionHash}${g.savedVersions.length ? ` (저장 rev ${g.savedVersions.join(",")})` : ""}`,
    ],
  ];

  const versionTemplates = groups.filter((g) => g.kind === "template");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-semibold text-neutral-900">A</span>
        <GroupSelect groups={groups} value={aKey} onChange={setAKey} />
        <span className="text-xs text-neutral-400">vs</span>
        <span className="text-xs font-semibold text-neutral-900">B</span>
        <GroupSelect groups={groups} value={bKey} onChange={setBKey} />
      </div>

      {a && b && (
        <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6">
          <section className="flex flex-col gap-4">
            <div className="glass-round bg-white/60 overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-[--color-border]">
                  <tr>
                    <th className={th}>지표</th>
                    <th className={th}>A · {a.label}</th>
                    <th className={th}>B · {b.label}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(([label, get]) => (
                    <tr key={label} className="border-b border-[--color-border-light] last:border-0">
                      <td className={`${td} text-neutral-500`}>{label}</td>
                      <td className={td}>{get(a)}</td>
                      <td className={td}>{get(b)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[a, b].map((g, i) => (
                <div key={i}>
                  <div className="text-[11px] text-neutral-500 mb-1.5">{i === 0 ? "A" : "B"} 최근 채택 산출물</div>
                  <Thumbs group={g} />
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-xs font-semibold text-neutral-900 mb-2">A → B 파라미터 차이</h3>
            <div className="glass-round bg-white/60 px-4 py-3 flex flex-col gap-3 text-xs">
              {diff?.identical && <div className="text-neutral-500">노드 구성·파라미터 동일 (멤버·트랙 등 입력 슬롯만 다름)</div>}
              {diff?.nodes.map((n) => (
                <div key={n.nodeId}>
                  <div className="font-medium text-neutral-900">
                    {n.kind === "added" ? "+ " : n.kind === "removed" ? "− " : "~ "}
                    {n.nodeId} <span className="text-neutral-400 font-normal">({n.nodeType})</span>
                  </div>
                  {n.fields.map((f) => (
                    <div key={f.key} className="mt-1 pl-3 border-l border-[--color-border]">
                      <div className="text-[11px] text-neutral-500">{f.key}</div>
                      {n.kind !== "added" && <div className="text-red-700/80 break-words">A: {summarizeValue(f.before, 220)}</div>}
                      {n.kind !== "removed" && <div className="text-emerald-700 break-words">B: {summarizeValue(f.after, 220)}</div>}
                    </div>
                  ))}
                </div>
              ))}
              {diff && (diff.edgesAdded.length > 0 || diff.edgesRemoved.length > 0) && (
                <div>
                  <div className="font-medium text-neutral-900">연결</div>
                  {diff.edgesRemoved.map((e) => (
                    <div key={`r${e}`} className="text-red-700/80">− {e}</div>
                  ))}
                  {diff.edgesAdded.map((e) => (
                    <div key={`a${e}`} className="text-emerald-700">+ {e}</div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      <section>
        <h3 className="text-xs font-semibold text-neutral-900 mb-2">템플릿별 버전</h3>
        <div className="glass-round bg-white/60 overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-[--color-border]">
              <tr>
                <th className={th}>템플릿 · 버전</th>
                <th className={th}>해시</th>
                <th className={`${th} text-right`}>첫 실행</th>
                <th className={`${th} text-right`}>실행</th>
                <th className={`${th} text-right`}>성공률</th>
                <th className={`${th} text-right`}>채택률</th>
                <th className={`${th} text-right`}>중앙 소요</th>
              </tr>
            </thead>
            <tbody>
              {versionTemplates.flatMap((t) =>
                groups
                  .filter((g) => g.kind === "version" && g.templateId === t.templateId)
                  .map((v) => (
                    <tr key={v.key} className="border-b border-[--color-border-light] last:border-0">
                      <td className={td}>
                        <span className="font-medium">{t.templateName}</span> <span className="text-neutral-500">v{v.versionIndex}</span>
                      </td>
                      <td className={`${td} text-neutral-400 font-mono`}>{v.versionHash}</td>
                      <td className={`${td} text-right`}>{day(v.stats.firstRunAt)}</td>
                      <td className={`${td} text-right`}>{v.stats.runs}</td>
                      <td className={`${td} text-right`}>{pct(v.stats.successRate)}</td>
                      <td className={`${td} text-right`}>{pct(v.stats.adoptionRate)}</td>
                      <td className={`${td} text-right`}>{duration(v.stats.medianSec)}</td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
