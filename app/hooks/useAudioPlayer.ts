import { useEffect, useCallback, useSyncExternalStore } from "react";
import { TRACKS, TRACKS_BY_ID } from "~/lib/data";

export type Track = (typeof TRACKS)[number];

// ─── Module-level singleton state ───────────────────────────────

let _audio: HTMLAudioElement | null = null;
let _currentTrackId: string = TRACKS[0].id;
let _isPlaying = false;
let _userPaused = false;
let _bgPaused = false;
let _autoPlayRequested = false;
let _interactionUnlocked = false;
let _shuffle = false;
let _repeatOne = true;
const _listeners = new Set<() => void>();

function notify() {
  _listeners.forEach((fn) => fn());
}

/** 현재 선택된 트랙 (모듈 싱글톤). 홈 Generate가 run inputs.musicId 기록에 사용 */
export function getCurrentTrack(): Track {
  return TRACKS_BY_ID[_currentTrackId] ?? TRACKS[0];
}

function seekTo(time: number) {
  getAudio().currentTime = time;
}

// ─── Core playback primitives ───────────────────────────────────

function doPlay() {
  _userPaused = false;
  _bgPaused = false;
  getAudio().play().catch(() => {});
}

function doPause() {
  _userPaused = true;
  getAudio().pause();
}

function doTogglePlay() {
  if (_isPlaying) doPause();
  else doPlay();
}

function replayCurrent() {
  const audio = getAudio();
  audio.currentTime = 0;
  audio.play().catch(() => {});
}

function changeTrack(track: Track, shouldPlay: boolean) {
  const audio = getAudio();
  _currentTrackId = track.id;
  audio.src = track.src;
  audio.load();
  if (shouldPlay) {
    audio.play().catch(() => {});
  }
  notify();
}

// ─── Audio element singleton ────────────────────────────────────

function getAudio(): HTMLAudioElement {
  if (!_audio) {
    const audio = new Audio();
    _audio = audio;
    audio.preload = "auto";
    audio.src = getCurrentTrack().src;

    audio.addEventListener("ended", () => {
      if (_repeatOne) {
        replayCurrent();
        return;
      }

      if (_shuffle) {
        const candidates = TRACKS.filter((t) => t.id !== _currentTrackId);
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        changeTrack(pick, true);
      } else {
        const idx = TRACKS.findIndex((t) => t.id === _currentTrackId);
        changeTrack(TRACKS[(idx + 1) % TRACKS.length], true);
      }
    });

    audio.addEventListener("play", () => {
      _isPlaying = true;
      notify();
    });

    audio.addEventListener("pause", () => {
      _isPlaying = false;
      notify();
    });
  }
  return _audio;
}

// ─── Browser autoplay unlock ────────────────────────────────────

function onFirstInteraction() {
  if (_interactionUnlocked) return;
  _interactionUnlocked = true;

  for (const evt of ["click", "keydown", "pointerdown"] as const) {
    document.removeEventListener(evt, onFirstInteraction, true);
  }

  if (_autoPlayRequested && !_userPaused && !_bgPaused) {
    getAudio().play().catch(() => {});
  }
}

// ─── useSyncExternalStore glue ──────────────────────────────────

let _snapshotVersion = 0;
function getSnapshot() {
  return _snapshotVersion;
}
function subscribe(listener: () => void) {
  const wrapped = () => {
    _snapshotVersion++;
    listener();
  };
  _listeners.add(wrapped);
  return () => { _listeners.delete(wrapped); };
}
function getServerSnapshot() {
  return 0;
}

// ─── Exported utilities (for use outside React) ─────────────────

export function pauseBgMusic() {
  _bgPaused = true;
  if (_audio && _isPlaying) {
    _audio.pause();
  }
}

export function resumeBgMusic() {
  _bgPaused = false;
  if (_userPaused || !_audio) return;
  _audio.play().catch(() => {});
}

export function registerGlobalSpacebar(): () => void {
  function handler(e: KeyboardEvent) {
    if (e.code !== "Space") return;

    const el = e.target as HTMLElement | null;
    if (!el) return;

    const tag = el.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || tag === "BUTTON" || el.isContentEditable) {
      return;
    }

    e.preventDefault();
    doTogglePlay();
  }

  document.addEventListener("keydown", handler);
  return () => document.removeEventListener("keydown", handler);
}

// ─── Hook ───────────────────────────────────────────────────────

export interface UseAudioPlayerReturn {
  currentTrack: Track;
  isPlaying: boolean;
  shuffle: boolean;
  repeatOne: boolean;
  tracks: Track[];
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  selectTrack: (id: string) => void;
  toggleShuffle: () => void;
  toggleRepeatOne: () => void;
  seekTo: (time: number) => void;
  getAudioElement: () => HTMLAudioElement | null;
}

interface UseAudioPlayerOptions {
  autoPlay?: boolean;
}

export function useAudioPlayer(
  options: UseAudioPlayerOptions = {}
): UseAudioPlayerReturn {
  const { autoPlay = false } = options;

  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    if (!autoPlay || typeof document === "undefined") return;

    _autoPlayRequested = true;
    const audio = getAudio();

    if (!_userPaused && !_bgPaused) {
      audio.play().catch(() => {
        for (const evt of ["click", "keydown", "pointerdown"] as const) {
          document.addEventListener(evt, onFirstInteraction, true);
        }
      });
    }

    return () => {
      _autoPlayRequested = false;
      if (_audio && _isPlaying) {
        _audio.pause();
      }
    };
  }, [autoPlay]);

  const nextTrack = useCallback(() => {
    const shouldPlay = _isPlaying;
    const idx = TRACKS.findIndex((t) => t.id === _currentTrackId);
    changeTrack(TRACKS[(idx + 1) % TRACKS.length], shouldPlay);
  }, []);

  const prevTrack = useCallback(() => {
    const shouldPlay = _isPlaying;
    const idx = TRACKS.findIndex((t) => t.id === _currentTrackId);
    changeTrack(TRACKS[(idx - 1 + TRACKS.length) % TRACKS.length], shouldPlay);
  }, []);

  const selectTrack = useCallback((id: string) => {
    if (id === _currentTrackId) return;
    const track = TRACKS_BY_ID[id];
    if (!track) return;
    changeTrack(track, true);
  }, []);

  const toggleShuffle = useCallback(() => {
    _shuffle = !_shuffle;
    notify();
  }, []);

  const toggleRepeatOne = useCallback(() => {
    _repeatOne = !_repeatOne;
    notify();
  }, []);

  const getAudioElement = useCallback(() => {
    return typeof document !== "undefined" ? getAudio() : null;
  }, []);

  return {
    currentTrack: getCurrentTrack(),
    isPlaying: _isPlaying,
    shuffle: _shuffle,
    repeatOne: _repeatOne,
    tracks: TRACKS,
    play: useCallback(() => doPlay(), []),
    pause: useCallback(() => doPause(), []),
    togglePlay: useCallback(() => doTogglePlay(), []),
    nextTrack,
    prevTrack,
    selectTrack,
    seekTo: useCallback((time: number) => seekTo(time), []),
    toggleShuffle,
    toggleRepeatOne,
    getAudioElement,
  };
}
