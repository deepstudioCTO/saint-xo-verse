import type { RunsDashboard } from "~/lib/workflow/runsDashboard";
import { pct, duration, day } from "./insightFormat";

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="glass-round bg-white/60 px-4 py-3 min-w-0">
      <div className="text-[11px] text-neutral-500">{label}</div>
      <div className="text-xl font-semibold text-neutral-900 tabular-nums mt-0.5">{value}</div>
      {sub && <div className="text-[11px] text-neutral-400 mt-0.5 truncate">{sub}</div>}
    </div>
  );
}

const th = "text-left text-[11px] font-medium text-neutral-500 px-3 py-2";
const td = "px-3 py-2 text-xs text-neutral-800 tabular-nums";

/**
 * 실행 이력 대시보드 — 수치는 metrics-report.ts 보고서와 같은 함수 결과(/api/runs-dashboard).
 */
export function RunsDashboardView({ dashboard }: { dashboard: RunsDashboard }) {
  const t = dashboard.totals;
  const o = dashboard.outputs;
  const maxMonthly = Math.max(1, ...dashboard.monthly.map((m) => m.runs));

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <Stat label="전체 run" value={`${t.runs}`} sub={t.unfinished ? `미결 ${t.unfinished}` : undefined} />
        <Stat label="완료 / 실패" value={`${t.completed} / ${t.failed}`} />
        <Stat label="run 성공률" value={pct(t.successRate)} sub="완료 ÷ (완료+실패)" />
        <Stat label="채택률" value={pct(t.adoptionRate)} sub={`채택 ${t.adopted} ÷ 완료 ${t.completed}`} />
        <Stat label="소요시간 중앙값" value={duration(t.medianSec)} sub={`${t.durationCounted}건 기준`} />
        <Stat label="채택 숏폼" value={o.adoptedVideos === null ? "—" : `${o.adoptedVideos}편`} sub={`생성 ${o.videos}편`} />
        <Stat label="채택 이미지 산출물" value={o.adoptedImages === null ? "—" : `${o.adoptedImages}건`} sub={`생성 ${o.images}건`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
        <section>
          <h3 className="text-xs font-semibold text-neutral-900 mb-2">템플릿별</h3>
          <div className="glass-round bg-white/60 overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-[--color-border]">
                <tr>
                  <th className={th}>템플릿</th>
                  <th className={`${th} text-right`}>실행</th>
                  <th className={`${th} text-right`}>성공률</th>
                  <th className={`${th} text-right`}>채택</th>
                  <th className={`${th} text-right`}>중앙 소요</th>
                  <th className={`${th} text-right`}>최근 실행</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.templates.map((row) => (
                  <tr key={row.templateId} className="border-b border-[--color-border-light] last:border-0">
                    <td className={`${td} font-medium`}>{row.name}</td>
                    <td className={`${td} text-right`}>{row.runs}</td>
                    <td className={`${td} text-right`}>{pct(row.successRate)}</td>
                    <td className={`${td} text-right`}>
                      {row.adopted}
                      <span className="text-neutral-400"> ({pct(row.adoptionRate)})</span>
                    </td>
                    <td className={`${td} text-right`}>{duration(row.medianSec)}</td>
                    <td className={`${td} text-right`}>{day(row.lastRunAt)}</td>
                  </tr>
                ))}
                {dashboard.templates.length === 0 && (
                  <tr>
                    <td className={`${td} text-neutral-400`} colSpan={6}>
                      실행 기록이 없습니다
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {dashboard.unattributedRuns > 0 && (
            <p className="text-[11px] text-neutral-400 mt-2">
              템플릿 미기록 run {dashboard.unattributedRuns}건은 표에서 제외(소급 불가)
            </p>
          )}
        </section>

        <section>
          <h3 className="text-xs font-semibold text-neutral-900 mb-2">월별 run 추이</h3>
          <div className="glass-round bg-white/60 px-4 py-3 flex flex-col gap-2.5">
            {dashboard.monthly.map((m) => (
              <div key={m.month} className="flex items-center gap-3">
                <span className="text-xs text-neutral-500 tabular-nums w-20 shrink-0 whitespace-nowrap">{m.month}</span>
                <div className="flex-1 h-2 rounded-full bg-[--color-border-light] overflow-hidden">
                  <div className="h-full bg-neutral-900 rounded-full" style={{ width: `${(m.runs / maxMonthly) * 100}%` }} />
                </div>
                <span className="text-xs text-neutral-900 tabular-nums text-right shrink-0 whitespace-nowrap">
                  {m.runs}건 <span className="text-neutral-400">· 채택 {m.adopted} · 실패 {m.failed}</span>
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <p className="text-[11px] text-neutral-400">
        집계 {day(dashboard.generatedAt)} · 정의는 reports/metrics 보고서와 동일(성공률 분모에서 미결 제외, 채택률 분모 = 완료 run, 숏폼 편수는 업스케일 제외)
      </p>
    </div>
  );
}
