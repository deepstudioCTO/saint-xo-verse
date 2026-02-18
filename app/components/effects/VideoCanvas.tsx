import { useEffect, useState } from "react";
import { WebGLGlitchVideo } from "./WebGLGlitchVideo";

export type GlitchRenderer = "webgl" | "none";

// 효과 프리셋 (상수로 관리)
export const EFFECT_PRESETS = {
  saintXo: {
    glitch: {
      delay: [2.5, 3.5] as [number, number],
      duration: [0.1, 0.2] as [number, number],
      bandCount: 400,
      maxDisplacement: 2,
    },
    // 줌 펀치 효과: 글리치 시작 시 "두둥" 확대 후 복귀
    impact: {
      scale: 1.025, // 최대 2.5% 확대
      duration: 0.08, // 80ms 동안 복귀
    },
  },
  intense: {
    glitch: {
      delay: [1.5, 2.5] as [number, number],
      duration: [0.2, 0.4] as [number, number],
      bandCount: 400,
      maxDisplacement: 4,
    },
    impact: {
      scale: 1.10, // 최대 10% 확대
      duration: 0.10, // 100ms 동안 복귀
    },
  },
  subtle: {
    glitch: {
      delay: [4, 6] as [number, number],
      duration: [0.05, 0.1] as [number, number],
      bandCount: 400,
      maxDisplacement: 1,
    },
    impact: {
      scale: 1.03, // 최대 3% 확대
      duration: 0.06, // 60ms 동안 복귀
    },
  },
  none: null,
} as const;

export type EffectPreset = keyof typeof EFFECT_PRESETS;

interface VideoCanvasProps {
  src: string;
  poster?: string;
  preset?: EffectPreset;
  className?: string;
  style?: React.CSSProperties;
  // 렌더러 선택: webgl (기본, 고성능), none (효과 없음)
  renderer?: GlitchRenderer;
  // 개별 오버라이드 - 글리치
  glitchDelay?: [number, number];
  glitchDuration?: [number, number];
  bandCount?: number;
  maxDisplacement?: number;
  // 개별 오버라이드 - 줌 펀치 임팩트
  impactScale?: number;
  impactDuration?: number;
  // 기준 너비: 이 크기에서 displacement가 100% 적용됨 (작은 영상은 효과 감소, 큰 영상은 증가)
  referenceWidth?: number;
}

// Hook to detect reduced motion preference
function useReducedMotion(): boolean {
  const [prefersReduced, setPrefersReduced] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReduced(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  return prefersReduced;
}

// Fallback video component
function FallbackVideo({
  src,
  poster,
  className,
  style,
}: {
  src: string;
  poster?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <video
      src={src}
      poster={poster}
      autoPlay
      loop
      muted
      playsInline
      disablePictureInPicture
      draggable={false}
      className={className}
      style={{
        ...style,
        backgroundImage: poster ? `url(${poster})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    />
  );
}

// Check WebGL support
function isWebGLSupported(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return !!(
      canvas.getContext("webgl") || canvas.getContext("experimental-webgl")
    );
  } catch {
    return false;
  }
}

export function VideoCanvas({
  src,
  poster,
  preset = "saintXo",
  className,
  style,
  renderer = "webgl",
  glitchDelay,
  glitchDuration,
  bandCount,
  maxDisplacement,
  impactScale,
  impactDuration,
  referenceWidth = 280, // 캐릭터 선택 화면 기준
}: VideoCanvasProps) {
  const prefersReducedMotion = useReducedMotion();
  const [isClient, setIsClient] = useState(false);
  const [webglSupported, setWebglSupported] = useState(true);

  // Check if we're on the client
  useEffect(() => {
    setIsClient(true);
    setWebglSupported(isWebGLSupported());
  }, []);

  const presetConfig = EFFECT_PRESETS[preset];

  // SSR: render nothing initially (video will hydrate)
  // Or if user prefers reduced motion, use fallback
  // Or if preset is "none", use fallback
  // Or if renderer is "none", use fallback
  if (
    !isClient ||
    prefersReducedMotion ||
    !presetConfig ||
    renderer === "none"
  ) {
    return (
      <FallbackVideo
        src={src}
        poster={poster}
        className={className}
        style={style}
      />
    );
  }

  // 오버라이드 적용
  const glitchConfig = {
    delay: glitchDelay ?? presetConfig.glitch.delay,
    duration: glitchDuration ?? presetConfig.glitch.duration,
    bandCount: bandCount ?? presetConfig.glitch.bandCount,
    maxDisplacement: maxDisplacement ?? presetConfig.glitch.maxDisplacement,
  };

  const impactConfig = {
    scale: impactScale ?? presetConfig.impact.scale,
    duration: impactDuration ?? presetConfig.impact.duration,
  };

  // WebGL 렌더러 (WebGL 미지원 시 폴백 비디오로)
  if (!webglSupported) {
    return (
      <FallbackVideo
        src={src}
        poster={poster}
        className={className}
        style={style}
      />
    );
  }

  return (
    <WebGLGlitchVideo
      src={src}
      poster={poster}
      className={className}
      style={style}
      glitchDelay={glitchConfig.delay}
      glitchDuration={glitchConfig.duration}
      bandCount={glitchConfig.bandCount}
      maxDisplacement={glitchConfig.maxDisplacement}
      impactScale={impactConfig.scale}
      impactDuration={impactConfig.duration}
      referenceWidth={referenceWidth}
    />
  );
}
