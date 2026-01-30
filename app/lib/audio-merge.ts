import type { FFmpeg } from "@ffmpeg/ffmpeg";

let ffmpegInstance: FFmpeg | null = null;
let isLoading = false;

/**
 * ffmpeg.wasm 인스턴스를 로드하고 반환
 */
export async function loadFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) {
    return ffmpegInstance;
  }

  if (isLoading) {
    // 이미 로딩 중이면 완료될 때까지 대기
    while (isLoading) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (ffmpegInstance) {
      return ffmpegInstance;
    }
  }

  isLoading = true;

  try {
    const { FFmpeg } = await import("@ffmpeg/ffmpeg");
    const { toBlobURL } = await import("@ffmpeg/util");

    const ffmpeg = new FFmpeg();

    const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(
        `${baseURL}/ffmpeg-core.wasm`,
        "application/wasm"
      ),
    });

    ffmpegInstance = ffmpeg;
    return ffmpeg;
  } finally {
    isLoading = false;
  }
}

export interface MergeProgress {
  stage: "loading" | "downloading" | "merging" | "complete";
  progress: number; // 0-100
}

/**
 * 비디오에서 원본 오디오를 제거하고 새 음악을 합성
 */
export async function mergeVideoWithMusic(
  videoUrl: string,
  musicPath: string,
  onProgress?: (progress: MergeProgress) => void
): Promise<Blob> {
  onProgress?.({ stage: "loading", progress: 0 });

  // ffmpeg 로드
  const ffmpeg = await loadFFmpeg();

  onProgress?.({ stage: "downloading", progress: 10 });

  // 비디오 다운로드
  const videoResponse = await fetch(videoUrl);
  const videoData = await videoResponse.arrayBuffer();

  onProgress?.({ stage: "downloading", progress: 30 });

  // 음악 다운로드
  const musicResponse = await fetch(musicPath);
  const musicData = await musicResponse.arrayBuffer();

  onProgress?.({ stage: "downloading", progress: 50 });

  // 파일 쓰기
  await ffmpeg.writeFile("input.mp4", new Uint8Array(videoData));
  await ffmpeg.writeFile("music.mp3", new Uint8Array(musicData));

  onProgress?.({ stage: "merging", progress: 60 });

  // 프로그레스 핸들러 설정
  ffmpeg.on("progress", ({ progress }) => {
    // merging 단계에서 60-95%로 매핑
    const mappedProgress = 60 + Math.round(progress * 35);
    onProgress?.({ stage: "merging", progress: mappedProgress });
  });

  // 오디오 합성 실행
  // -i input.mp4: 입력 비디오
  // -i music.mp3: 입력 음악
  // -c:v copy: 비디오 스트림 복사 (재인코딩 없음 - 빠름)
  // -c:a aac: 오디오를 AAC로 인코딩
  // -map 0:v:0: 첫 번째 입력(video)의 비디오 스트림 사용
  // -map 1:a:0: 두 번째 입력(music)의 오디오 스트림 사용
  // -shortest: 짧은 스트림 기준으로 종료 (비디오 길이에 맞춤)
  await ffmpeg.exec([
    "-i",
    "input.mp4",
    "-i",
    "music.mp3",
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-map",
    "0:v:0",
    "-map",
    "1:a:0",
    "-shortest",
    "output.mp4",
  ]);

  onProgress?.({ stage: "merging", progress: 95 });

  // 결과 읽기
  const data = await ffmpeg.readFile("output.mp4");
  const blob = new Blob([data as Uint8Array], { type: "video/mp4" });

  // 임시 파일 정리
  await ffmpeg.deleteFile("input.mp4");
  await ffmpeg.deleteFile("music.mp3");
  await ffmpeg.deleteFile("output.mp4");

  onProgress?.({ stage: "complete", progress: 100 });

  return blob;
}

/**
 * Blob을 파일로 다운로드
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
