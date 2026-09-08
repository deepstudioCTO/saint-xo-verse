import { describe, it, expect } from "vitest";
import {
  buildMusicMergeArgs,
  buildSubtitleBurnArgs,
  buildSubtitleOverlayFilter,
  musicFileName,
  parseTimestamp,
  resolveTrackId,
  filenameToken,
  scaleSubtitleStyle,
  toCues,
  trackIdFromFilename,
} from "../compose-shortform";

describe("트랙 해석", () => {
  it("증빙 파일명 꼬리에서 트랙을 복원한다", () => {
    expect(trackIdFromFilename("17_Haeun_02_01_Cute_Action_Yum.mp4")).toBe("1");
    expect(trackIdFromFilename("21_Haeun_02_01_Dance_ALL_EYES_ON_ME.mp4")).toBe("4");
    expect(trackIdFromFilename("22_Lei_00_04_Above_BLACK.mp4")).toBe("13");
    expect(trackIdFromFilename("18_Haeun_02_01_Smile_LOVE_INVASION.mp4")).toBe("10");
  });

  it("export-run-outputs의 정규화를 거친 제목도 되읽는다", () => {
    // export-run-outputs의 표기("Im lovin it")와 같은 토큰이 나와야 한다
    expect(filenameToken("I'm lovin' it")).toBe("Im_lovin_it");
    expect(trackIdFromFilename("10_Lei_01_01_Smile_Im_lovin_it.mp4")).toBe("3");
    expect(trackIdFromFilename("11_Rumi_01_01_Subway_DONT_LIE_TO_ME.mp4")).toBe("7");
  });

  it("트랙이 없는 파일명은 null", () => {
    expect(trackIdFromFilename("99_Nobody_00_00_Idle.mp4")).toBeNull();
  });

  it("id와 제목 양쪽으로 지정할 수 있다", () => {
    expect(resolveTrackId("1")).toBe("1");
    expect(resolveTrackId("Yum")).toBe("1");
    expect(resolveTrackId("all eyes on me")).toBe("4");
    expect(resolveTrackId("없는곡")).toBeNull();
  });

  it("음악 파일명은 public/music 실제 파일과 같은 표기를 낸다", () => {
    expect(musicFileName("1")).toBe("Yum.mp3");
    expect(musicFileName("3")).toBe("I'm lovin' it.mp3");
    expect(musicFileName("99")).toBeNull();
  });
});

describe("자막 cue", () => {
  it("PreviewNode와 같은 타임스탬프 규칙", () => {
    expect(parseTimestamp("00:03")).toBe(3);
    expect(parseTimestamp("01:30")).toBe(90);
    expect(parseTimestamp("01:00:05")).toBe(3605);
    expect(parseTimestamp("")).toBe(0);
  });

  it("빈 텍스트·무효 구간은 버리고 시작순으로 정렬한다", () => {
    const cues = toCues([
      { start: "00:04", end: "00:06", text: "둘째" },
      { start: "00:00", end: "00:02", text: "첫째" },
      { start: "00:07", end: "00:07", text: "길이 0" },
      { start: "00:08", end: "00:09", text: "   " },
    ]);
    expect(cues).toEqual([
      { start: 0, end: 2, text: "첫째" },
      { start: 4, end: 6, text: "둘째" },
    ]);
  });
});

describe("Preview 오버레이 → 영상 픽셀 환산", () => {
  it("숏폼 1184x1760에서 노드 폭 280 기준 배율(≈4.229)이 적용된다", () => {
    const s = scaleSubtitleStyle(1184, 1760);
    expect(s.fontSize).toBe(Math.round(12 * (1184 / 280)));
    expect(s.bottomMargin).toBe(Math.round(16 * (1184 / 280)));
    expect(s.padX).toBe(Math.round(12 * (1184 / 280)));
    expect(s.boxOpacity).toBe(0.7);
  });

  it("가로 영상에서도 폭 기준 배율은 같다", () => {
    expect(scaleSubtitleStyle(1920, 1080).fontSize).toBe(Math.round(12 * (1920 / 280)));
  });
});

describe("음악 합성 인자", () => {
  it("audio-merge.ts와 같은 규칙 — 원본 오디오 폐기, 음악 0초부터, -shortest", () => {
    const args = buildMusicMergeArgs({
      videoPath: "in.mp4",
      musicPath: "Yum.mp3",
      outPath: "out.mp4",
    });
    expect(args).toEqual([
      "-y", "-i", "in.mp4", "-i", "Yum.mp3",
      "-c:v", "copy", "-c:a", "aac",
      "-map", "0:v:0", "-map", "1:a:0",
      "-shortest", "out.mp4",
    ]);
    // 브라우저 규칙에는 볼륨·페이드·오프셋이 없다
    expect(args).not.toContain("-af");
    expect(args).not.toContain("-ss");
  });

  it("--fade-out을 준 경우에만 afade가 붙는다", () => {
    const args = buildMusicMergeArgs({
      videoPath: "in.mp4",
      musicPath: "Yum.mp3",
      outPath: "out.mp4",
      fadeOutSeconds: 0.5,
      durationSeconds: 9.067,
    });
    expect(args).toContain("-af");
    expect(args[args.indexOf("-af") + 1]).toBe("afade=t=out:st=8.567:d=0.5");
  });

  it("길이를 모르면 페이드를 붙이지 않는다(끝을 못 잡으므로)", () => {
    const args = buildMusicMergeArgs({
      videoPath: "in.mp4", musicPath: "m.mp3", outPath: "o.mp4", fadeOutSeconds: 0.5,
    });
    expect(args).not.toContain("-af");
  });
});

describe("자막 굽기 필터", () => {
  const style = scaleSubtitleStyle(1184, 1760);

  it("자막이 없으면 빈 필터", () => {
    expect(buildSubtitleOverlayFilter([], style)).toBe("");
  });

  it("cue마다 overlay를 잇고 마지막을 [vout]으로 낸다", () => {
    const f = buildSubtitleOverlayFilter(
      [
        { start: 0, end: 2, text: "가" },
        { start: 3, end: 5, text: "나" },
      ],
      style
    );
    // 오버레이 입력은 영상(0)·음악(1) 다음인 2번부터
    expect(f).toBe(
      `[0:v][2:v]overlay=x=(main_w-overlay_w)/2:y=main_h-overlay_h-${style.bottomMargin}:enable='between(t,0,2)'[v1];` +
        `[v1][3:v]overlay=x=(main_w-overlay_w)/2:y=main_h-overlay_h-${style.bottomMargin}:enable='between(t,3,5)'[vout]`
    );
  });

  it("음악이 없으면 무음 소스를 1번 입력에 넣어 인덱스를 유지한다", () => {
    const args = buildSubtitleBurnArgs({
      videoPath: "in.mp4",
      musicPath: null,
      cuePngPaths: ["c0.png"],
      filter: "f",
      outPath: "out.mp4",
    });
    expect(args.join(" ")).toContain("anullsrc=channel_layout=stereo:sample_rate=44100");
    expect(args).toContain("[vout]");
    // 자막을 구우면 비디오는 재인코딩된다(copy 불가)
    expect(args[args.indexOf("-c:v") + 1]).toBe("libx264");
  });
});
