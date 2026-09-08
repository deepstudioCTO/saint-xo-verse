/**
 * 숏폼 완성본 합성 규칙 — 순수 로직.
 *
 * `audio-merge.ts`(브라우저 ffmpeg.wasm)의 규칙을 네이티브 ffmpeg에서 그대로 재현하기 위한 모듈이다.
 * I/O·프로세스 실행은 `scripts/compose-shortform.ts`가 담당하고, 여기에는 인자 조립·시간 파싱·
 * 스타일 환산처럼 테스트 가능한 계산만 둔다(브라우저 번들에 들어가도 무해하도록 node API 미사용).
 *
 * ── 왜 별도 모듈인가
 * Music 노드의 합성은 브라우저에서만 돈다(GenerationPipeline은 executable 노드만 실행).
 * 그래서 배치 CLI로 만든 run의 산출물은 "음악 미합성 원본"이다. 서버/로컬에서 같은 결과를
 * 만들려면 규칙을 UI에서 떼어내야 한다 — 이 파일이 그 단일 출처다.
 *
 * ── 자막에 대한 사실 기록
 * 브라우저 파이프라인은 자막을 **영상에 굽지 않는다.** SubtitleNode의 entries는 PreviewNode가
 * DOM 오버레이로 그릴 뿐이고, mergeVideoWithMusic은 자막을 인자로 받지도 않는다.
 * 따라서 아래 자막 스타일은 "기존 완성본과 맞춘 값"이 아니라 **PreviewNode 오버레이 CSS를
 * 영상 해상도로 환산한 값**이다(근거는 PREVIEW_OVERLAY 주석 참조).
 */

/** 트랙 id → 제목. app/data/tracks.ts와 동일해야 한다(라이브러리 14곡). */
export const TRACK_TITLES: Record<string, string> = {
  "1": "Yum",
  "2": "POP IT",
  "3": "I'm lovin' it",
  "4": "ALL EYES ON ME",
  "5": "BRING IT UP",
  "6": "BURIED ALIVE",
  "7": "DONT LIE TO ME",
  "8": "EXTRA",
  "9": "F4U",
  "10": "LOVE INVASION",
  "11": "PRETTY POSER",
  "12": "SEOUL NODE",
  "13": "BLACK",
  "14": "MOON RUNNER",
};

/**
 * scripts/export-run-outputs.ts의 파일명 정규화와 **같은 규칙**.
 * 증빙 파일명이 이 규칙으로 만들어졌으므로, 파일명에서 트랙을 되읽으려면 동일해야 한다.
 */
export function safeName(s: string): string {
  return s.replace(/[^\w가-힣.-]+/g, "_").replace(/^_+|_+$/g, "");
}

/**
 * 파일명에 들어가는 트랙 토큰.
 *
 * export-run-outputs.ts의 트랙 표는 `"3": "Im lovin it"`처럼 **아포스트로피가 빠진** 표기를
 * 쓴다(그 스크립트가 파일명 전용으로 따로 적어둔 표). 실제 트랙 제목·파일명은 `I'm lovin' it`
 * 이므로, 파일명을 되읽으려면 아포스트로피를 지운 뒤 safeName을 적용해야 같은 토큰이 된다.
 */
export function filenameToken(title: string): string {
  return safeName(title.replace(/['’]/g, ""));
}

/**
 * 증빙 파일명(`17_Haeun_02_01_Cute_Action_Yum.mp4`)의 꼬리에서 트랙 id를 복원한다.
 * export 규칙상 트랙 제목이 항상 마지막 토큰 묶음이라, 토큰을 접미사로 대조한다.
 * 여러 트랙이 매칭되면 더 긴 제목을 택한다("BLACK" vs 가상의 "…_BLACK" 충돌 방지).
 */
export function trackIdFromFilename(filename: string): string | null {
  const stem = filename.replace(/\.[^.]+$/, "");
  let best: { id: string; len: number } | null = null;
  for (const [id, title] of Object.entries(TRACK_TITLES)) {
    const token = filenameToken(title);
    if (stem === token || stem.endsWith(`_${token}`)) {
      if (!best || token.length > best.len) best = { id, len: token.length };
    }
  }
  return best?.id ?? null;
}

/** 트랙 지정을 id("1") 또는 제목("Yum", 대소문자 무시)으로 받아 id로 정규화 */
export function resolveTrackId(input: string): string | null {
  if (TRACK_TITLES[input]) return input;
  const hit = Object.entries(TRACK_TITLES).find(
    ([, title]) => title.toLowerCase() === input.toLowerCase()
  );
  return hit?.[0] ?? null;
}

/** 로컬 음악 파일명(public/music 안). data/tracks.ts의 src와 같은 파일을 가리킨다. */
export function musicFileName(trackId: string): string | null {
  const title = TRACK_TITLES[trackId];
  return title ? `${title}.mp3` : null;
}

/**
 * PreviewNode의 자막 오버레이 CSS. 영상 해상도로 환산할 때의 기준값이다.
 *
 *   <div class="absolute bottom-4 ..."><span class="bg-black/70 text-white text-xs px-3 py-1 rounded">
 *
 * 노드 폭 280px에 영상이 꽉 차게 들어가므로, 렌더 높이 = 280 * (h/w).
 * 아래 px 값들을 "렌더 높이 대비 비율"로 바꿔 실제 영상 높이에 곱한다.
 */
export const PREVIEW_OVERLAY = {
  /** PreviewNode 폭(px) — Tailwind w-[280px] */
  nodeWidth: 280,
  /** bottom-4 = 1rem */
  bottomPx: 16,
  /** text-xs */
  fontSizePx: 12,
  /** text-xs의 line-height(1rem) */
  lineHeightPx: 16,
  /** px-3 */
  padXPx: 12,
  /** py-1 */
  padYPx: 4,
  /** rounded = 0.25rem */
  radiusPx: 4,
  /** bg-black/70 */
  boxOpacity: 0.7,
} as const;

export interface SubtitleStyle {
  fontSize: number;
  bottomMargin: number;
  padX: number;
  padY: number;
  radius: number;
  lineHeight: number;
  boxOpacity: number;
}

/**
 * Preview 오버레이 CSS를 영상 픽셀로 환산.
 * 세로 숏폼(1184x1760)에서 fontSize ≈ 51px, bottomMargin ≈ 68px가 나온다.
 */
export function scaleSubtitleStyle(videoWidth: number, videoHeight: number): SubtitleStyle {
  const renderedHeight = PREVIEW_OVERLAY.nodeWidth * (videoHeight / videoWidth);
  const k = videoHeight / renderedHeight; // = videoWidth / nodeWidth
  const r = (v: number) => Math.round(v * k);
  return {
    fontSize: r(PREVIEW_OVERLAY.fontSizePx),
    bottomMargin: r(PREVIEW_OVERLAY.bottomPx),
    padX: r(PREVIEW_OVERLAY.padXPx),
    padY: r(PREVIEW_OVERLAY.padYPx),
    radius: r(PREVIEW_OVERLAY.radiusPx),
    lineHeight: r(PREVIEW_OVERLAY.lineHeightPx),
    boxOpacity: PREVIEW_OVERLAY.boxOpacity,
  };
}

/**
 * PreviewNode의 parseTimestamp와 동일한 규칙(mm:ss / hh:mm:ss).
 * 화면에서 보이던 자막 타이밍과 구운 결과가 어긋나면 안 되므로 규칙을 그대로 옮긴다.
 */
export function parseTimestamp(ts: string): number {
  const parts = ts.split(":").map(Number);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

export interface SubtitleEntryLike {
  start: string;
  end: string;
  text: string;
}

export interface SubtitleCue {
  start: number;
  end: number;
  text: string;
}

/**
 * SubtitleNode entries → 정렬된 cue 목록.
 * 텍스트가 비었거나 구간이 무효(end<=start)인 행은 버린다 — UI에서 추가만 하고 안 채운 행이
 * 그대로 검은 박스로 구워지는 사고를 막는다.
 */
export function toCues(entries: SubtitleEntryLike[]): SubtitleCue[] {
  return entries
    .map((e) => ({
      start: parseTimestamp(e.start),
      end: parseTimestamp(e.end),
      text: (e.text ?? "").trim(),
    }))
    .filter((c) => c.text.length > 0 && c.end > c.start)
    .sort((a, b) => a.start - b.start);
}

export interface MusicMergeOptions {
  videoPath: string;
  musicPath: string;
  outPath: string;
  /** 끝부분 페이드아웃(초). 브라우저 규칙에는 없다 — 기본 0(미적용) */
  fadeOutSeconds?: number;
  /** 영상 길이(초). fadeOut을 쓸 때만 필요 */
  durationSeconds?: number;
}

/**
 * 음악 합성 ffmpeg 인자.
 *
 * audio-merge.ts와 **동일**: 원본 오디오를 버리고 음악을 0초부터 얹은 뒤 짧은 쪽(=영상)에서 끊는다.
 * - 음악 시작 오프셋: 없음(트랙 데이터·run 스냅샷 어디에도 오프셋 필드가 없다)
 * - 볼륨 조정·노멀라이즈: 없음(원본 mp3 그대로)
 * - 페이드: 없음이 기본. --fade-out을 준 경우에만 afade가 붙는다(브라우저와 달라지므로 명시 옵션)
 * - `-c:v copy`: 화질 재인코딩 없음. 자막을 굽는 경로에서만 비디오를 다시 인코딩한다.
 */
export function buildMusicMergeArgs(o: MusicMergeOptions): string[] {
  const args = ["-y", "-i", o.videoPath, "-i", o.musicPath, "-c:v", "copy", "-c:a", "aac"];
  if (o.fadeOutSeconds && o.fadeOutSeconds > 0 && o.durationSeconds) {
    const st = Math.max(0, o.durationSeconds - o.fadeOutSeconds);
    args.push("-af", `afade=t=out:st=${st.toFixed(3)}:d=${o.fadeOutSeconds}`);
  }
  args.push("-map", "0:v:0", "-map", "1:a:0", "-shortest", o.outPath);
  return args;
}

/**
 * 자막 PNG 오버레이 필터그래프.
 *
 * Homebrew의 슬림 `ffmpeg` 포뮬러에는 drawtext(freetype)도 subtitles(libass)도 없다.
 * 그래서 cue마다 투명 PNG를 미리 렌더해 overlay로 얹는다 — 폰트 렌더링을 ffmpeg 밖(PIL)에서
 * 하므로 빌드 옵션에 의존하지 않는다. 위치는 하단 중앙, y는 스타일의 bottomMargin 기준.
 */
export function buildSubtitleOverlayFilter(
  cues: SubtitleCue[],
  style: SubtitleStyle
): string {
  if (cues.length === 0) return "";
  const steps = cues.map((c, i) => {
    const inLabel = i === 0 ? "[0:v]" : `[v${i}]`;
    const outLabel = i === cues.length - 1 ? "[vout]" : `[v${i + 1}]`;
    const x = "(main_w-overlay_w)/2";
    const y = `main_h-overlay_h-${style.bottomMargin}`;
    const en = `between(t,${c.start},${c.end})`;
    return `${inLabel}[${i + 2}:v]overlay=x=${x}:y=${y}:enable='${en}'${outLabel}`;
  });
  return steps.join(";");
}

/** cue별 PNG 입력까지 포함한 전체 인자(자막 굽기 경로). 비디오는 재인코딩된다. */
export function buildSubtitleBurnArgs(opts: {
  videoPath: string;
  musicPath: string | null;
  cuePngPaths: string[];
  filter: string;
  outPath: string;
  crf?: number;
}): string[] {
  const args = ["-y", "-i", opts.videoPath];
  // 음악이 없으면 입력 인덱스가 하나 당겨진다 — 필터가 [2:v]부터 쓰도록
  // 항상 두 번째 입력을 음악 자리로 유지하기 위해, 음악이 없을 때는 무음을 넣는다.
  if (opts.musicPath) args.push("-i", opts.musicPath);
  else args.push("-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100");
  for (const p of opts.cuePngPaths) args.push("-i", p);
  args.push(
    "-filter_complex",
    opts.filter,
    "-map",
    "[vout]",
    "-map",
    "1:a:0",
    "-c:v",
    "libx264",
    "-crf",
    String(opts.crf ?? 16),
    "-preset",
    "slow",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-shortest",
    opts.outPath
  );
  return args;
}
