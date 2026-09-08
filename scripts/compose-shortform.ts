/**
 * 숏폼 완성본 합성 CLI — 네이티브 ffmpeg로 음악(+선택적 자막)을 굽는다.
 *
 * ── 왜 필요한가
 * Music 노드의 합성은 브라우저 전용(ffmpeg.wasm)이다. GenerationPipeline은 executable 노드
 * (generate/upscale)만 실행하므로, 배치 CLI로 만든 run의 산출물은 **음악이 안 붙은 원본**이다.
 * 편집기를 열어 한 편씩 "합성" 버튼을 누르지 않고도 같은 결과를 만들려면 규칙을 UI 밖에서
 * 돌릴 수 있어야 한다. 합성 규칙 자체는 app/lib/compose-shortform.ts가 단일 출처다.
 *
 * ── 실측으로 확인한 사실(2026-09-08)
 * 8/10 제출본 숏폼 16편에는 **라이브러리 음악이 들어있지 않다.** 같은 모션 소스를 쓴 편들은
 * 트랙이 서로 달라도 오디오 RMS 프로파일이 완전히 일치하고, 그 파형은 모션 소스 영상의
 * 오디오와 같다. 즉 제출본의 소리는 Kling이 소스 영상에서 넘겨준 오디오이며, 파일명의
 * 트랙 이름은 Music 노드에 지정된 설정값일 뿐 합성 결과가 아니다.
 * 자막도 마찬가지로 구워진 편이 없다(SubtitleNode entries는 전 29 run 모두 빈 배열이고,
 * PreviewNode가 DOM 오버레이로만 그린다).
 * => "기존 완성본에 맞춘다"는 기준이 존재하지 않아, 이 스크립트는 **코드에 적힌 규칙**
 *    (audio-merge.ts / PreviewNode.tsx)을 재현한다.
 *
 * ── 실행
 *   npx tsx scripts/compose-shortform.ts --video <mp4> [--video <mp4> ...]
 *   npx tsx scripts/compose-shortform.ts --dir <디렉토리>            # *.mp4 일괄(_final 제외)
 *   ... --track "Yum"        # 트랙 강제(기본: 파일명 꼬리에서 복원 → 없으면 --run 스냅샷)
 *   ... --run <uuid>         # DB run 스냅샷에서 trackId·자막 entries를 읽는다(DATABASE_URL 필요)
 *   ... --subtitles <json>   # [{start,end,text}] 배열. run에 자막이 없을 때 외부 주입용
 *   ... --frames             # 첫 프레임 + 중간 프레임 PNG도 추출
 *   ... --frame-at 3.0       # 중간 프레임 시각 지정(기본 길이의 50%).
 *                            #   50% 지점이 모션블러·전환에 걸리면 증빙으로 못 쓴다
 *   ... --fade-out 0.5       # 끝 페이드(브라우저 규칙에 없음 — 명시할 때만)
 *   ... --suffix _final --dry-run
 *
 * 원본은 절대 덮어쓰지 않는다(항상 접미사가 붙은 새 파일).
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  TRACK_TITLES,
  buildMusicMergeArgs,
  buildSubtitleBurnArgs,
  buildSubtitleOverlayFilter,
  musicFileName,
  resolveTrackId,
  scaleSubtitleStyle,
  toCues,
  trackIdFromFilename,
  type SubtitleCue,
  type SubtitleEntryLike,
} from "../app/lib/compose-shortform";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MUSIC_DIR = path.join(ROOT, "public", "music");
const FFMPEG = process.env.FFMPEG_PATH ?? "/opt/homebrew/bin/ffmpeg";
const FFPROBE = process.env.FFPROBE_PATH ?? "/opt/homebrew/bin/ffprobe";

/**
 * 자막 폰트. 앱은 root.tsx에서 Google Fonts로 Orbitron+Pretendard를 불러오고
 * --font-sans의 한글 담당은 Pretendard다. 로컬에 같은 패밀리의 OTF가 있으면 그걸 쓰고,
 * 없으면 시스템 한글 폰트(Apple SD Gothic Neo)로 내려간다(어떤 폰트를 썼는지 항상 출력한다).
 */
const FONT_CANDIDATES = [
  path.join(os.homedir(), "Library/Fonts/Pretendard-Regular.otf"),
  "/System/Library/Fonts/AppleSDGothicNeo.ttc",
  "/System/Library/Fonts/Supplemental/AppleGothic.ttf",
];

const argv = process.argv.slice(2);
const flag = (n: string) => argv.includes(`--${n}`);
const value = (n: string) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const values = (n: string) =>
  argv.reduce<string[]>((acc, a, i) => (a === `--${n}` && argv[i + 1] ? [...acc, argv[i + 1]] : acc), []);

const DRY = flag("dry-run");
const SUFFIX = value("suffix") ?? "_final";
const FADE = Number(value("fade-out") ?? 0);
const WANT_FRAMES = flag("frames");
/** 중간 프레임 시각(초). 기본은 길이의 50% — 그 지점이 흐릿하면 이 값으로 옮긴다 */
const FRAME_AT = value("frame-at") !== undefined ? Number(value("frame-at")) : null;

function run(bin: string, args: string[]): string {
  const r = spawnSync(bin, args, { encoding: "utf8", maxBuffer: 1 << 28 });
  if (r.status !== 0) {
    throw new Error(`${path.basename(bin)} 실패 (exit ${r.status})\n${r.stderr?.slice(-2000)}`);
  }
  return r.stdout;
}

function probe(file: string): { width: number; height: number; duration: number } {
  const out = run(FFPROBE, [
    "-v", "error",
    "-select_streams", "v:0",
    "-show_entries", "stream=width,height",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    file,
  ]);
  const [w, h, d] = out.trim().split("\n");
  return { width: Number(w), height: Number(h), duration: Number(d) };
}

/** 이 ffmpeg 빌드가 자막을 직접 그릴 수 있는지(drawtext/subtitles) */
function hasTextFilters(): boolean {
  const r = spawnSync(FFMPEG, ["-hide_banner", "-filters"], { encoding: "utf8" });
  return /(^|\s)(drawtext|subtitles)\s/m.test(r.stdout ?? "");
}

function pickFont(): string {
  const hit = FONT_CANDIDATES.find((f) => fs.existsSync(f));
  if (!hit) throw new Error(`한글 폰트를 찾지 못했습니다: ${FONT_CANDIDATES.join(", ")}`);
  return hit;
}

/**
 * cue 하나를 투명 PNG로 렌더한다(Pillow).
 * ffmpeg 슬림 빌드에 freetype/libass가 없어 텍스트 렌더링을 밖으로 뺐다.
 * 모양은 PreviewNode의 span(bg-black/70, text-white, px-3 py-1, rounded)을 그대로 옮긴 것.
 */
const PY_RENDER = `
import json, sys
from PIL import Image, ImageDraw, ImageFont
cfg = json.load(open(sys.argv[1]))
font = ImageFont.truetype(cfg["font"], cfg["fontSize"])
lines = cfg["text"].split("\\n")
probe = Image.new("RGBA", (8, 8))
d0 = ImageDraw.Draw(probe)
widths, height = [], cfg["lineHeight"]
for ln in lines:
    box = d0.textbbox((0, 0), ln, font=font)
    widths.append(box[2] - box[0])
tw, th = max(widths), height * len(lines)
W = tw + cfg["padX"] * 2
H = th + cfg["padY"] * 2
img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
d.rounded_rectangle([0, 0, W - 1, H - 1], radius=cfg["radius"],
                    fill=(0, 0, 0, int(255 * cfg["boxOpacity"])))
y = cfg["padY"]
for ln in lines:
    box = d0.textbbox((0, 0), ln, font=font)
    x = (W - (box[2] - box[0])) / 2 - box[0]
    d.text((x, y - box[1] + (height - (box[3] - box[1])) / 2), ln, font=font, fill=(255, 255, 255, 255))
    y += height
img.save(cfg["out"])
`;

function renderCuePng(cue: SubtitleCue, style: ReturnType<typeof scaleSubtitleStyle>, font: string, out: string) {
  const cfgPath = `${out}.json`;
  fs.writeFileSync(
    cfgPath,
    JSON.stringify({ ...style, font, text: cue.text, out })
  );
  const scriptPath = path.join(path.dirname(out), "render_cue.py");
  if (!fs.existsSync(scriptPath)) fs.writeFileSync(scriptPath, PY_RENDER);
  run("python3", [scriptPath, cfgPath]);
}

/** DB run 스냅샷에서 trackId와 자막 entries를 읽는다(선택 기능 — --run을 줄 때만) */
async function loadRunConfig(runId: string): Promise<{ trackId: string | null; entries: SubtitleEntryLike[] }> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("--run 을 쓰려면 DATABASE_URL 이 필요합니다");
  const { default: postgres } = await import("postgres");
  const sql = postgres(databaseUrl, { prepare: false });
  try {
    const rows = await sql<{ s: string }[]>`
      select template_snapshot as s from workflow_runs where id = ${runId} limit 1`;
    if (rows.length === 0) throw new Error(`run 없음: ${runId}`);
    const nodes = (JSON.parse(rows[0].s).nodes ?? []) as { type?: string; data?: Record<string, unknown> }[];
    const music = nodes.find((n) => n.type === "music");
    const subtitle = nodes.find((n) => n.type === "subtitle");
    return {
      trackId: music?.data?.trackId ? String(music.data.trackId) : null,
      entries: (subtitle?.data?.entries as SubtitleEntryLike[] | undefined) ?? [],
    };
  } finally {
    await sql.end();
  }
}

function collectVideos(): string[] {
  const explicit = values("video").map((v) => path.resolve(v));
  const dir = value("dir");
  if (!dir) return explicit;
  const listed = fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith(".mp4") && !f.includes(`${SUFFIX}.`))
    .sort()
    .map((f) => path.resolve(dir, f));
  return [...explicit, ...listed];
}

async function main() {
  const videos = collectVideos();
  if (videos.length === 0) {
    console.error("합성할 영상이 없습니다. --video <mp4> 또는 --dir <디렉토리>를 주세요.");
    process.exit(1);
  }

  const runIds = values("run");
  const forcedTrack = value("track") ? resolveTrackId(value("track")!) : null;
  if (value("track") && !forcedTrack) throw new Error(`알 수 없는 트랙: ${value("track")}`);

  let externalCues: SubtitleCue[] | null = null;
  const subJson = value("subtitles");
  if (subJson) externalCues = toCues(JSON.parse(fs.readFileSync(subJson, "utf8")));

  const canDrawInFfmpeg = hasTextFilters();
  const font = pickFont();
  console.log(`ffmpeg: ${FFMPEG} (drawtext/subtitles ${canDrawInFfmpeg ? "있음" : "없음 → PNG 오버레이"})`);
  console.log(`자막 폰트: ${font}`);
  console.log(`대상 ${videos.length}편, 접미사 ${SUFFIX}${DRY ? " (dry-run)" : ""}\n`);

  for (const [i, video] of videos.entries()) {
    const base = path.basename(video);
    const stem = base.replace(/\.[^.]+$/, "");
    const outPath = path.join(path.dirname(video), `${stem}${SUFFIX}.mp4`);

    // 트랙 결정: --track > --run 스냅샷 > 파일명 꼬리
    let trackId = forcedTrack;
    let entries: SubtitleEntryLike[] = [];
    if (runIds[i]) {
      const cfg = await loadRunConfig(runIds[i]);
      trackId = trackId ?? cfg.trackId;
      entries = cfg.entries;
    }
    trackId = trackId ?? trackIdFromFilename(base);

    if (!trackId) {
      console.log(`· ${base} — 트랙을 못 정했습니다(건너뜀). --track 으로 지정하세요.`);
      continue;
    }
    const musicPath = path.join(MUSIC_DIR, musicFileName(trackId)!);
    if (!fs.existsSync(musicPath)) throw new Error(`음악 파일 없음: ${musicPath}`);

    const meta = probe(video);
    const cues = externalCues ?? toCues(entries);
    const style = scaleSubtitleStyle(meta.width, meta.height);

    console.log(
      `· ${base}\n  트랙 ${TRACK_TITLES[trackId]} / ${meta.width}x${meta.height} ${meta.duration.toFixed(2)}s / 자막 ${cues.length}건`
    );

    if (DRY) continue;

    if (cues.length === 0) {
      // 자막이 없으면 브라우저와 완전히 동일한 경로 — 비디오 무손실 복사
      run(FFMPEG, [
        "-v", "error",
        ...buildMusicMergeArgs({
          videoPath: video,
          musicPath,
          outPath,
          fadeOutSeconds: FADE,
          durationSeconds: meta.duration,
        }),
      ]);
    } else {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "shortform-sub-"));
      try {
        const pngs = cues.map((c, k) => {
          const p = path.join(tmp, `cue${k}.png`);
          renderCuePng(c, style, font, p);
          return p;
        });
        run(FFMPEG, [
          "-v", "error",
          ...buildSubtitleBurnArgs({
            videoPath: video,
            musicPath,
            cuePngPaths: pngs,
            filter: buildSubtitleOverlayFilter(cues, style),
            outPath,
          }),
        ]);
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    }

    console.log(`  → ${path.basename(outPath)}`);

    if (WANT_FRAMES) {
      const first = path.join(path.dirname(video), `${stem}${SUFFIX}_frame01.png`);
      const midT = Math.min(Math.max(0, FRAME_AT ?? meta.duration * 0.5), meta.duration);
      const mid = path.join(path.dirname(video), `${stem}${SUFFIX}_frame_mid.png`);
      run(FFMPEG, ["-v", "error", "-y", "-i", outPath, "-frames:v", "1", first]);
      run(FFMPEG, ["-v", "error", "-y", "-ss", midT.toFixed(3), "-i", outPath, "-frames:v", "1", mid]);
      console.log(`  → ${path.basename(first)}, ${path.basename(mid)}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
