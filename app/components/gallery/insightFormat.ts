/** Dashboard/Compare 표시 포맷 — 보고서(renderMarkdown)와 같은 반올림 규칙(소수 1자리, .0 생략) */
export const pct = (n: number | null): string => (n === null ? "—" : `${n.toFixed(1).replace(/\.0$/, "")}%`);

export const duration = (sec: number | null): string => {
  if (sec === null) return "—";
  if (sec < 60) return `${Math.round(sec)}초`;
  return `${(sec / 60).toFixed(1).replace(/\.0$/, "")}분`;
};

export const day = (iso: string | null): string => (iso ? iso.slice(0, 10) : "—");
