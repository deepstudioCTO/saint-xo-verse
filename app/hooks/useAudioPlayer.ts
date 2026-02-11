import { useEffect, useCallback, useSyncExternalStore } from "react";
import { TRACKS, TRACKS_BY_ID, getTracksByVerse } from "~/lib/data";

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
let _currentVerseId = "00";
const _listeners = new Set<() => void>();

function notify() {
  _listeners.forEach((fn) => fn());
}

function getCurrentTrack(): Track {
  return TRACKS_BY_ID[_currentTrackId] ?? TRACKS[0];
}

function getVerseTracks(): Track[] {
  return getTracksByVerse(_currentVerseId);
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
    audio.preload = "metadata";
    audio.src = getCurrentTrack().src;

    audio.addEventListener("ended", () => {
      if (_repeatOne) {
        replayCurrent();
        return;
      }

      const vt = getVerseTracks();
      if (vt.length === 0) return;

      if (_shuffle) {
        if (vt.length <= 1) {
          replayCurrent();
        } else {
          const candidates = vt.filter((t) => t.id !== _currentTrackId);
          const pick = candidates[Math.floor(Math.random() * candidates.length)];
          changeTrack(pick, true);
        }
      } else {
        const idx = vt.findIndex((t) => t.id === _currentTrackId);
        changeTrack(vt[(idx + 1) % vt.length], true);
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

// ─── Verse management ───────────────────────────────────────────

function setVerseId(verseId: string) {
  if (verseId === _currentVerseId) return;

  const wasPlaying = _isPlaying;
  _currentVerseId = verseId;

  const vt = getVerseTracks();
  if (vt.some((t) => t.id === _currentTrackId)) {
    notify();
    return;
  }

  if (vt.length > 0) {
    changeTrack(vt[0], wasPlaying && !_userPaused && !_bgPaused);
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
  verseTracks: Track[];
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  selectTrack: (id: string) => void;
  toggleShuffle: () => void;
  toggleRepeatOne: () => void;
  getAudioElement: () => HTMLAudioElement | null;
}

interface UseAudioPlayerOptions {
  autoPlay?: boolean;
  verseId?: string;
}

export function useAudioPlayer(
  options: UseAudioPlayerOptions = {}
): UseAudioPlayerReturn {
  const { autoPlay = false, verseId } = options;

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
  }, [autoPlay]);

  useEffect(() => {
    if (verseId) setVerseId(verseId);
  }, [verseId]);

  const nextTrack = useCallback(() => {
    const shouldPlay = _isPlaying;
    const vt = getVerseTracks();
    if (vt.length === 0) return;
    const idx = vt.findIndex((t) => t.id === _currentTrackId);
    changeTrack(vt[(idx + 1) % vt.length], shouldPlay);
  }, []);

  const prevTrack = useCallback(() => {
    const shouldPlay = _isPlaying;
    const vt = getVerseTracks();
    if (vt.length === 0) return;
    const idx = vt.findIndex((t) => t.id === _currentTrackId);
    changeTrack(vt[(idx - 1 + vt.length) % vt.length], shouldPlay);
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
    verseTracks: getVerseTracks(),
    play: useCallback(() => doPlay(), []),
    pause: useCallback(() => doPause(), []),
    togglePlay: useCallback(() => doTogglePlay(), []),
    nextTrack,
    prevTrack,
    selectTrack,
    toggleShuffle,
    toggleRepeatOne,
    getAudioElement,
  };
}
