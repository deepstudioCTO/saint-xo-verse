import { useCallback, useEffect, useRef, useState } from "react";
import { Handle, Position, useReactFlow, type Node, type NodeProps } from "@xyflow/react";
import type { MusicNodeData } from "../editorTypes";
import { MediaDisplay } from "./MediaDisplay";
import { useResolvedInputs } from "../useResolvedInputs";
import { useWorkflowRun } from "../workflowRun";
import { TRACKS, TRACKS_BY_ID } from "~/lib/data";
import { mergeVideoWithMusic, downloadBlob, type MergeProgress } from "~/lib/audio-merge";

type MusicNodeType = Node<MusicNodeData, "music">;

/**
 * Music 노드 — 하이브리드 실행. presentational이지만 합성은 클라이언트(ffmpeg.wasm).
 *
 * - 서버 GenerationPipeline은 executable 노드(generate/upscale)만 실행 → Music은 무시(파이프라인 무변경).
 * - 업스트림 산출/소스 영상(resolveUpstreamInputs) + 선택 트랙을 브라우저 ffmpeg로 합성.
 * - config(trackId)만 node.data. 합성 결과 blob URL은 로컬 state(AutoSave가 scratch에 죽은 URL 저장 방지).
 * - 트리거 2가지: 서버 Run 완료 시 자동 합성(시그니처당 1회) + 수동 "합성" 버튼(강제 재합성).
 */
export function MusicNode({ id, data }: NodeProps<MusicNodeType>) {
  const { updateNodeData } = useReactFlow();
  const resolved = useResolvedInputs(id);
  const { runStatus } = useWorkflowRun();

  const trackId = data.trackId ?? null;
  const track = trackId ? TRACKS_BY_ID[trackId] : null;
  // 합성 대상 영상: 업스트림 생성 영상 우선, 없으면 소스 모션영상
  const video = resolved.producedVideo ?? resolved.sourceVideo ?? null;

  const [merging, setMerging] = useState(false);
  const [progress, setProgress] = useState<MergeProgress | null>(null);
  const [mergedUrl, setMergedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 마지막으로 합성한 (영상,트랙) 시그니처 — 자동합성 중복 방지
  const mergedSigRef = useRef<string | null>(null);
  const mergedUrlRef = useRef<string | null>(null);

  const setTrack = useCallback(
    (v: string | null) => updateNodeData(id, { trackId: v }),
    [id, updateNodeData]
  );

  const runMerge = useCallback(async () => {
    if (!video || !track || merging) return;
    const sig = `${video}::${track.id}`;
    setMerging(true);
    setError(null);
    setProgress({ stage: "loading", progress: 0 });
    try {
      const blob = await mergeVideoWithMusic(video, track.src, setProgress);
      const url = URL.createObjectURL(blob);
      // 이전 object URL 정리
      if (mergedUrlRef.current) URL.revokeObjectURL(mergedUrlRef.current);
      mergedUrlRef.current = url;
      mergedSigRef.current = sig;
      setMergedUrl(url);
    } catch (err) {
      setError(String(err));
    } finally {
      setMerging(false);
      setProgress(null);
    }
  }, [video, track, merging]);

  // 자동 합성: 서버 Run 완료 시 (트랙+영상 준비 & 새 시그니처일 때 1회)
  useEffect(() => {
    if (runStatus !== "completed") return;
    if (!video || !track || merging) return;
    if (mergedSigRef.current === `${video}::${track.id}`) return;
    runMerge();
    // runMerge는 video/track에 의존 — 완료 신호(runStatus) 트리거만 담당
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runStatus, video, trackId]);

  // 언마운트 시 object URL 정리
  useEffect(() => {
    return () => {
      if (mergedUrlRef.current) URL.revokeObjectURL(mergedUrlRef.current);
    };
  }, []);

  const handleDownload = useCallback(async () => {
    if (!mergedUrl) return;
    try {
      const res = await fetch(mergedUrl);
      const blob = await res.blob();
      downloadBlob(blob, `music_${track?.title ?? "output"}.mp4`);
    } catch {
      // ignore
    }
  }, [mergedUrl, track]);

  const canMerge = !!video && !!track && !merging;

  return (
    <div className="bg-[#1a1a1a] rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.4)] border border-white/[0.08] w-[240px]">
      <div className="px-3 py-2 border-b border-white/[0.08] flex items-center justify-between">
        <span className="text-[10px] font-semibold tracking-wider uppercase text-white/80">{data.label}</span>
        <span className="text-[9px] text-white/30">MUSIC</span>
      </div>

      {/* 미리보기 영역: 합성 결과 > 진행중 > 대기 */}
      {mergedUrl ? (
        <div className="relative">
          <MediaDisplay media={{ type: "video", url: mergedUrl, name: "Merged" }} muted={false} stopPlayPropagation />
          <div className="absolute top-1 right-1 px-1.5 py-0.5 bg-emerald-500/80 rounded text-[8px] text-white font-medium">
            합성됨
          </div>
        </div>
      ) : (
        <div
          className={`relative w-full overflow-hidden flex items-center justify-center ${
            merging ? "bg-blue-900/20" : "bg-white/[0.03]"
          }`}
          style={{ aspectRatio: 16 / 9 }}
        >
          {merging ? (
            <div className="flex flex-col items-center gap-2 px-3 w-full">
              <div className="w-5 h-5 border-2 border-white/20 border-t-blue-400 rounded-full animate-spin" />
              <span className="text-[10px] text-white/50">
                {progress?.stage === "loading"
                  ? "ffmpeg 로딩…"
                  : progress?.stage === "downloading"
                    ? "파일 다운로드…"
                    : `합성 중 ${progress?.progress ?? 0}%`}
              </span>
              {progress && (
                <div className="w-full h-1 bg-white/10 rounded overflow-hidden">
                  <div className="h-full bg-blue-400 transition-all duration-300" style={{ width: `${progress.progress}%` }} />
                </div>
              )}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-1.5 px-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              <span className="text-[9px] text-red-400/80 text-center truncate w-full">{error}</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1.5 text-white/20">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
              <span className="text-[10px]">{video ? (track ? "합성 준비됨" : "트랙 선택") : "영상 연결"}</span>
            </div>
          )}
        </div>
      )}

      <div className="px-3 py-2 border-t border-white/[0.08] flex flex-col gap-2">
        <select
          value={trackId ?? ""}
          onChange={(e) => setTrack(e.target.value || null)}
          className="nodrag nowheel w-full bg-white/[0.05] border border-white/[0.08] rounded px-1.5 py-1 text-[9px] text-white/80 focus:outline-none focus:border-white/20"
        >
          <option value="">트랙 없음</option>
          {TRACKS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>

        <div className="flex gap-1.5">
          <button
            onClick={runMerge}
            disabled={!canMerge}
            className={`nodrag flex-1 py-1 rounded text-[10px] font-medium tracking-wide transition-colors ${
              canMerge
                ? "bg-blue-600 hover:bg-blue-500 text-white cursor-pointer"
                : "bg-white/[0.05] text-white/30 cursor-not-allowed"
            }`}
          >
            {merging ? "합성 중…" : mergedUrl ? "재합성" : "합성"}
          </button>
          {mergedUrl && (
            <button
              onClick={handleDownload}
              className="nodrag px-2.5 py-1 rounded text-[10px] font-medium bg-white/[0.08] text-white/70 hover:bg-white/15 hover:text-white transition-colors cursor-pointer"
            >
              다운로드
            </button>
          )}
        </div>
      </div>

      <Handle type="target" position={Position.Left} className="!w-2.5 !h-2.5 !bg-amber-500 !border-2 !border-[#1a1a1a]" />
      <Handle type="source" position={Position.Right} className="!w-2.5 !h-2.5 !bg-emerald-500 !border-2 !border-[#1a1a1a]" />
    </div>
  );
}
