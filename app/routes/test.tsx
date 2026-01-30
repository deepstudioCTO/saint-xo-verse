import { useState, useRef, useEffect } from "react";
import type { Route } from "./+types/test";

export const meta: Route.MetaFunction = () => [
  { title: "Video Gen Test" },
];

type Status = "idle" | "uploading" | "polling" | "done" | "error";

async function submitGeneration(image: File, video: File): Promise<string> {
  const formData = new FormData();
  formData.append("image", image);
  formData.append("video", video);

  const res = await fetch("/api/generate", {
    method: "POST",
    body: formData,
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.id;
}

async function pollStatus(id: string): Promise<{ status: string; output?: string | string[]; error?: string }> {
  const res = await fetch(`/api/generate?id=${id}`);
  const data = await res.json();
  if (data.error && !data.status) throw new Error(data.error);
  return data;
}

function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.onloadedmetadata = () => {
      resolve(video.duration);
      video.src = "";
    };
    video.onerror = () => reject(new Error("영상 파일을 읽을 수 없습니다"));
    video.src = URL.createObjectURL(file);
  });
}

export default function Test() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [log, setLog] = useState<string[]>([]);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const addLog = (msg: string) => setLog((prev) => [...prev, msg]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleVideoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVideoFile(file);
      setVideoDuration(null);
      try {
        const dur = await getVideoDuration(file);
        setVideoDuration(dur);
      } catch {
        setVideoDuration(null);
      }
    }
  };

  const videoDurationWarning = videoDuration !== null && videoDuration > 10;

  const handleSubmit = async () => {
    if (!imageFile || !videoFile) return;
    if (videoDurationWarning) return;
    setLog([]);
    setResultUrl(null);

    try {
      setStatus("uploading");
      addLog("📷 이미지 + 🎬 영상 업로드 및 생성 요청...");
      const id = await submitGeneration(imageFile, videoFile);
      addLog(`✓ 생성 시작 (ID: ${id})`);

      setStatus("polling");
      addLog("⏳ 생성 중... (폴링 시작)");

      let elapsed = 0;
      pollRef.current = setInterval(async () => {
        elapsed += 5;
        try {
          const result = await pollStatus(id);
          if (result.status === "succeeded") {
            addLog(`📦 raw output: ${JSON.stringify(result.output)}`);
            const url = Array.isArray(result.output) ? result.output[0] : result.output;
            if (url) {
              setResultUrl(url);
              setStatus("done");
              addLog(`🎉 생성 완료! (${elapsed}s)`);
            }
            if (pollRef.current) clearInterval(pollRef.current);
          } else if (result.status === "failed") {
            setStatus("error");
            addLog(`❌ 실패: ${result.error || "알 수 없는 오류"}`);
            if (pollRef.current) clearInterval(pollRef.current);
          } else {
            addLog(`  · ${result.status}... (${elapsed}s)`);
          }
        } catch (err) {
          addLog(`  · poll 오류: ${err}`);
        }
      }, 5000);
    } catch (err) {
      setStatus("error");
      addLog(`❌ ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const isRunning = status === "uploading" || status === "polling";

  return (
    <div className="min-h-screen bg-[#1A1A1A] text-white">
      <div className="max-w-xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold mb-1">Video Gen Test</h1>
        <p className="text-sm text-[#555555] mb-6">Kling v2.6 Motion Control · 이미지 + 영상 → 생성</p>

        {/* Requirements */}
        <div className="mb-8 p-4 rounded-xl bg-[#111111] border border-[#2A2A2A]">
          <p className="text-xs font-semibold text-[#666666] tracking-widest uppercase mb-3">입력 조건</p>
          <div className="space-y-2">
            <div>
              <p className="text-xs text-[#999999] font-semibold">이미지</p>
              <p className="text-xs text-[#555555]">· 팔다리가 clearly visible한 사진 (클리핑 안됨)</p>
              <p className="text-xs text-[#555555]">· 배경 깔끔하게, 여백 충분히</p>
              <p className="text-xs text-[#555555]">· 权荐: 전신 or 반신 (영상과 framing 일치해야 함)</p>
            </div>
            <div>
              <p className="text-xs text-[#999999] font-semibold">모션 영상</p>
              <p className="text-xs text-[#555555]">· 10초 이하 (character_orientation=image 조건)</p>
              <p className="text-xs text-[#555555]">· 이미지와 같은 framing (전신↔전신, 반신↔반신)</p>
              <p className="text-xs text-[#555555]">· 과도한 카메라 움직임 피함, 적당한 속도</p>
            </div>
          </div>
        </div>

        {/* Image Upload */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-[#666666] tracking-widest uppercase mb-2">
            참조 이미지
          </label>
          <label className="flex items-center gap-3 p-4 rounded-xl border border-[#333333] hover:border-[#555555] cursor-pointer transition-colors duration-200">
            {imagePreview ? (
              <img src={imagePreview} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-[#2A2A2A] flex items-center justify-center flex-shrink-0">
                <span className="text-[#555555] text-lg">+</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[#999999] truncate">{imageFile?.name ?? "JPG, PNG 파일 선택"}</p>
              {imageFile && <p className="text-xs text-[#555555]">{(imageFile.size / 1024 / 1024).toFixed(1)} MB</p>}
            </div>
            <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
          </label>
        </div>

        {/* Video Upload */}
        <div className="mb-10">
          <label className="block text-xs font-semibold text-[#666666] tracking-widest uppercase mb-2">
            모션 참조 영상
          </label>
          <label className="flex items-center gap-3 p-4 rounded-xl border border-[#333333] hover:border-[#555555] cursor-pointer transition-colors duration-200">
            <div className="w-12 h-12 rounded-lg bg-[#2A2A2A] flex items-center justify-center flex-shrink-0">
              <span className="text-[#555555] text-lg">{videoFile ? "▶" : "+"}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[#999999] truncate">{videoFile?.name ?? "MP4, MOV 파일 선택 (10초 이하)"}</p>
              {videoFile && (
                <p className={`text-xs ${videoDurationWarning ? "text-red-400" : "text-[#555555]"}`}>
                  {(videoFile.size / 1024 / 1024).toFixed(1)} MB
                  {videoDuration !== null && ` · ${videoDuration.toFixed(1)}s`}
                </p>
              )}
            </div>
            <input type="file" accept="video/*" onChange={handleVideoChange} className="hidden" />
          </label>
          {videoDurationWarning && (
            <p className="mt-2 text-xs text-red-400">⚠ 모션 영상은 10초 이하여야 합니다 (현재 {videoDuration?.toFixed(1)}s)</p>
          )}
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!imageFile || !videoFile || isRunning || videoDurationWarning}
          className="w-full py-4 bg-[#D4231A] text-white font-semibold rounded-full hover:bg-[#b81e16] disabled:bg-[#333333] disabled:text-[#555555] disabled:cursor-not-allowed transition-colors duration-200"
        >
          {status === "uploading" ? "업로드 중..." : status === "polling" ? "생성 중..." : "영상 생성"}
        </button>

        {/* Log */}
        {log.length > 0 && (
          <div className="mt-8 p-4 rounded-xl bg-[#111111] border border-[#2A2A2A]">
            {log.map((msg, i) => (
              <p key={i} className="text-xs text-[#666666] font-mono py-0.5">
                {msg}
              </p>
            ))}
          </div>
        )}

        {/* Result Video */}
        {resultUrl && (
          <div className="mt-8">
            <p className="text-xs font-semibold text-[#666666] tracking-widest uppercase mb-3">생성된 영상</p>
            <video src={resultUrl} controls autoPlay playsInline className="w-full rounded-xl bg-[#111111]" />
            {/* URL 디버그 + 복사 */}
            <div className="mt-3 flex items-center gap-2">
              <p className="text-xs text-[#444444] font-mono truncate flex-1">{resultUrl}</p>
              <button
                onClick={() => navigator.clipboard.writeText(resultUrl)}
                className="flex-shrink-0 text-xs px-3 py-1 rounded-lg bg-[#2A2A2A] text-[#999999] hover:text-white transition-colors"
              >
                복사
              </button>
            </div>
            <div className="flex gap-4 mt-2">
              <a
                href={`/api/download?url=${encodeURIComponent(resultUrl)}`}
                download="generated.mp4"
                className="text-sm text-[#2E5090] hover:text-[#4A7BC0] transition-colors"
              >
                다운로드
              </a>
              <a
                href={resultUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-[#555555] hover:text-[#999999] transition-colors"
              >
                원본 URL
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
