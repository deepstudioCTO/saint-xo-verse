/**
 * WebGL 기반 글리치 비디오 컴포넌트
 * 순수 WebGL로 단일 패스 렌더링 - 고성능
 *
 * 성능 최적화:
 * - Three.js/postprocessing 제거
 * - 단일 드로우 콜 (모든 효과를 하나의 셰이더에서 처리)
 * - GPU 병렬 처리
 * - 조건부 렌더링 (글리치 비활성 시 throttle)
 */

import { useEffect, useRef, useState, useCallback } from "react";

interface WebGLGlitchVideoProps {
  src: string;
  poster?: string;
  className?: string;
  style?: React.CSSProperties;
  // 글리치 설정
  glitchDelay?: [number, number];
  glitchDuration?: [number, number];
  bandCount?: number;
  maxDisplacement?: number; // 픽셀 단위
  // 줌 펀치 임팩트 설정
  impactScale?: number; // 최대 확대 비율 (1.06 = 6% 확대)
  impactDuration?: number; // 확대 애니메이션 지속 시간 (초)
  referenceWidth?: number; // 기준 너비 (이 크기에서 maxDisplacement가 100% 적용)
  disabled?: boolean;
}

// Vertex shader
const vertexShaderSource = `
attribute vec2 a_position;
attribute vec2 a_texCoord;
varying vec2 v_texCoord;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = a_texCoord;
}
`;

// Fragment shader - 모든 효과를 단일 패스로 처리
const fragmentShaderSource = `
precision highp float;

uniform sampler2D u_video;
uniform float u_time;
uniform float u_isGlitching;
uniform float u_seed;
uniform float u_bandCount;
uniform float u_maxDisplacement;
uniform vec2 u_resolution;
uniform float u_dpr;
uniform float u_referenceWidth;
uniform float u_impactScale; // 현재 스케일 값 (1.0 ~ impactScale)

varying vec2 v_texCoord;

// Pseudo-random function
float rand(float seed) {
  return fract(sin(seed * 12.9898) * 43758.5453);
}

float rand2(vec2 co) {
  return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  // 줌 펀치 효과: 중심 기준 스케일 적용
  vec2 uv = v_texCoord;
  if (u_impactScale > 1.0) {
    // 중심(0.5, 0.5)을 기준으로 스케일 변환
    uv = (uv - 0.5) / u_impactScale + 0.5;
  }

  float time = u_time;

  // 픽셀 단위를 UV 단위로 변환하는 비율
  float pxToUv = u_dpr / u_resolution.x;

  // 크기 기반 스케일 팩터: 기준 너비(280px)에서 1.0, 작으면 감소, 크면 증가
  float actualWidth = u_resolution.x / u_dpr;
  float scaleFactor = actualWidth / u_referenceWidth;

  // === 1. 메인 글리치 (글리치 활성 시) ===
  if (u_isGlitching > 0.5) {
    // 전체 이미지 좌우 흔들림 (±2px, 스케일 적용)
    float shakeX = (rand(u_seed + 1.0) - 0.5) * 4.0 * pxToUv * scaleFactor;
    uv.x += shakeX;

    // 전체 이미지 상하 왜곡 (±0.7%)
    float scaleY = 1.0 + (rand(u_seed + 2.0) - 0.5) * 0.014;
    uv.y = 0.5 + (uv.y - 0.5) * scaleY;

    // 밴드 displacement (45% 밴드, 스케일 적용)
    float band = floor(v_texCoord.y * u_bandCount);
    float patternSeed = u_seed + floor(time / 50.0); // 50ms마다 패턴 변경
    float bandRand = rand(band + patternSeed);

    if (bandRand > 0.55) {
      float displacement = (rand(band * 2.0 + patternSeed) - 0.5) * 2.0 * u_maxDisplacement * pxToUv * scaleFactor;
      uv.x += displacement;
    }
  }
  // === 2. 평상시 미세 글리치 (1.5% 밴드, ±1px, 스케일 적용) ===
  else {
    float band = floor(v_texCoord.y * u_bandCount);
    float idleSeed = floor(time / 300.0); // 300ms마다 패턴 변경
    float bandRand = rand(band + idleSeed);

    if (bandRand > 0.985) {
      float displacement = (rand(band * 2.0 + idleSeed) - 0.5) * 2.0 * pxToUv * scaleFactor;
      uv.x += displacement;
    }
  }

  // === 3. 스캔라인 효과 (RGB 채널 분리 + 노이즈) ===
  float scanlineY = 1.0 - mod(time * 0.00012, 1.0);
  float scanlineHeight = 20.0 * u_dpr / u_resolution.y;
  float distToScan = abs(v_texCoord.y - scanlineY);

  // 스캔라인 영역 내 플래그 및 페이드 값
  bool inScanline = false;
  float scanFade = 0.0;

  // 스캔라인 영역
  if (distToScan < scanlineHeight) {
    inScanline = true;
    scanFade = 1.0 - (distToScan / scanlineHeight); // 1.0 → 0.0 가장자리로 페이드

    // Y좌표(라인)별 다른 jitter로 세밀한 지지직 효과
    float lineY = floor(v_texCoord.y * u_resolution.y / u_dpr);
    float lineNoise = rand2(vec2(lineY, floor(time * 0.03)));
    float jitter = (lineNoise - 0.5) * 3.0 * pxToUv * scaleFactor * scanFade;
    uv.x += jitter;
  }

  // UV clamp
  uv = clamp(uv, 0.0, 1.0);

  vec4 color;

  // 스캔라인 영역: RGB 채널 분리 (Chromatic Aberration)
  if (inScanline) {
    // 라인별 랜덤 오프셋 (CRT 지지직 느낌)
    float lineY = floor(v_texCoord.y * u_resolution.y / u_dpr);
    float rgbSeed = rand2(vec2(lineY * 0.5, floor(time * 0.025)));
    float rgbOffset = (rgbSeed - 0.5) * 2.5 * pxToUv * scaleFactor * scanFade;

    // RGB 채널별 다른 오프셋
    float rOff = rgbOffset * 1.3;
    float gOff = rgbOffset * 0.0;  // Green은 기준점
    float bOff = rgbOffset * -0.8; // Blue는 반대 방향

    vec2 uvR = vec2(clamp(uv.x + rOff, 0.0, 1.0), uv.y);
    vec2 uvG = vec2(uv.x, uv.y);
    vec2 uvB = vec2(clamp(uv.x + bOff, 0.0, 1.0), uv.y);

    vec4 colR = texture2D(u_video, uvR);
    vec4 colG = texture2D(u_video, uvG);
    vec4 colB = texture2D(u_video, uvB);

    color = vec4(colR.r, colG.g, colB.b, 1.0);

    // 픽셀별 밝기 노이즈 (지지직 효과)
    float pixelNoise = rand2(vec2(gl_FragCoord.x, floor(time * 0.02)));
    float noiseIntensity = (pixelNoise - 0.3) * 0.06 * scanFade;
    color.rgb += noiseIntensity;

    // 간헐적 수평 라인 하이라이트
    float lineFlicker = rand2(vec2(lineY, floor(time * 0.015)));
    if (lineFlicker > 0.94) {
      color.rgb += 0.05 * scanFade;
    }
  } else {
    color = texture2D(u_video, uv);
  }

  gl_FragColor = color;
}
`;

function createShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("Shader compile error:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

function createProgram(
  gl: WebGLRenderingContext,
  vertexShader: WebGLShader,
  fragmentShader: WebGLShader
): WebGLProgram | null {
  const program = gl.createProgram();
  if (!program) return null;

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("Program link error:", gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }

  return program;
}

export function WebGLGlitchVideo({
  src,
  poster,
  className,
  style,
  glitchDelay = [2.5, 3.5],
  glitchDuration = [0.1, 0.2],
  bandCount = 400,
  maxDisplacement = 2,
  impactScale = 1.06,
  impactDuration = 0.08,
  referenceWidth = 280,
  disabled = false,
}: WebGLGlitchVideoProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const glitchTimeoutRef = useRef<number | null>(null);
  const glitchStateRef = useRef({
    isGlitching: false,
    startTime: 0, // 글리치 시작 시간 (줌 펀치 계산용)
    endTime: 0,
    seed: Math.random() * 1000,
  });

  // WebGL state
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const textureRef = useRef<WebGLTexture | null>(null);
  const uniformsRef = useRef<{
    u_video: WebGLUniformLocation | null;
    u_time: WebGLUniformLocation | null;
    u_isGlitching: WebGLUniformLocation | null;
    u_seed: WebGLUniformLocation | null;
    u_bandCount: WebGLUniformLocation | null;
    u_maxDisplacement: WebGLUniformLocation | null;
    u_resolution: WebGLUniformLocation | null;
    u_dpr: WebGLUniformLocation | null;
    u_referenceWidth: WebGLUniformLocation | null;
    u_impactScale: WebGLUniformLocation | null;
  } | null>(null);

  const [isWebGLReady, setIsWebGLReady] = useState(false);
  const videoTextureReady = useRef(false);

  const randomInRange = useCallback((min: number, max: number) => {
    return min + Math.random() * (max - min);
  }, []);

  // 글리치 시작
  const startGlitch = useCallback(() => {
    if (disabled) return;
    const now = performance.now();
    const duration = randomInRange(glitchDuration[0], glitchDuration[1]) * 1000;
    glitchStateRef.current = {
      isGlitching: true,
      startTime: now,
      endTime: now + duration,
      seed: Math.random() * 1000,
    };
  }, [disabled, glitchDuration, randomInRange]);

  // 글리치 스케줄링
  useEffect(() => {
    if (disabled) return;

    const scheduleNextGlitch = () => {
      const delay = randomInRange(glitchDelay[0], glitchDelay[1]) * 1000;
      glitchTimeoutRef.current = window.setTimeout(() => {
        startGlitch();
        scheduleNextGlitch();
      }, delay);
    };

    scheduleNextGlitch();

    return () => {
      if (glitchTimeoutRef.current) {
        clearTimeout(glitchTimeoutRef.current);
      }
    };
  }, [disabled, glitchDelay, startGlitch, randomInRange]);

  // WebGL 초기화
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
    });

    if (!gl) {
      console.error("WebGL not supported");
      return;
    }

    glRef.current = gl;

    // 셰이더 생성
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(
      gl,
      gl.FRAGMENT_SHADER,
      fragmentShaderSource
    );

    if (!vertexShader || !fragmentShader) {
      console.error("Failed to create shaders");
      return;
    }

    // 프로그램 생성
    const program = createProgram(gl, vertexShader, fragmentShader);
    if (!program) {
      console.error("Failed to create program");
      return;
    }

    programRef.current = program;

    // Attribute 위치
    const positionLoc = gl.getAttribLocation(program, "a_position");
    const texCoordLoc = gl.getAttribLocation(program, "a_texCoord");

    // Uniform 위치
    uniformsRef.current = {
      u_video: gl.getUniformLocation(program, "u_video"),
      u_time: gl.getUniformLocation(program, "u_time"),
      u_isGlitching: gl.getUniformLocation(program, "u_isGlitching"),
      u_seed: gl.getUniformLocation(program, "u_seed"),
      u_bandCount: gl.getUniformLocation(program, "u_bandCount"),
      u_maxDisplacement: gl.getUniformLocation(program, "u_maxDisplacement"),
      u_resolution: gl.getUniformLocation(program, "u_resolution"),
      u_dpr: gl.getUniformLocation(program, "u_dpr"),
      u_referenceWidth: gl.getUniformLocation(program, "u_referenceWidth"),
      u_impactScale: gl.getUniformLocation(program, "u_impactScale"),
    };

    // 버퍼 생성 - 풀스크린 쿼드
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        -1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1,
      ]),
      gl.STATIC_DRAW
    );

    const texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    // Y 좌표 뒤집기 (WebGL 텍스처는 Y축이 반대)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        0, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 0,
      ]),
      gl.STATIC_DRAW
    );

    // Vertex array setup
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.enableVertexAttribArray(texCoordLoc);
    gl.vertexAttribPointer(texCoordLoc, 2, gl.FLOAT, false, 0, 0);

    // 텍스처 생성
    const texture = gl.createTexture();
    textureRef.current = texture;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    setIsWebGLReady(true);

    return () => {
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      gl.deleteBuffer(positionBuffer);
      gl.deleteBuffer(texCoordBuffer);
      if (texture) gl.deleteTexture(texture);
    };
  }, []);

  // 렌더 루프
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const container = containerRef.current;
    const gl = glRef.current;
    const program = programRef.current;
    const texture = textureRef.current;
    const uniforms = uniformsRef.current;

    if (!canvas || !video || !container || !gl || !program || !texture || !uniforms || !isWebGLReady) {
      return;
    }

    let lastFrameTime = 0;
    const targetFrameTime = 1000 / 60; // 60fps

    const impactDurationMs = impactDuration * 1000;

    const render = (timestamp: number) => {
      // 프레임 레이트 제한 (글리치 비활성 시 30fps로 throttle)
      const glitchState = glitchStateRef.current;
      const now = performance.now();
      const shouldGlitch = glitchState.isGlitching && now < glitchState.endTime;

      // 줌 펀치 스케일 계산: 시작 시 최대값, impactDuration 동안 1.0으로 복귀 (easeOutQuad)
      let currentImpactScale = 1.0;
      if (glitchState.isGlitching && glitchState.startTime > 0) {
        const elapsed = now - glitchState.startTime;
        if (elapsed < impactDurationMs) {
          // easeOutQuad: 1 - (1 - t)^2 → 빠르게 감속
          const t = elapsed / impactDurationMs;
          const eased = 1 - (1 - t) * (1 - t);
          // impactScale에서 1.0으로 감소
          currentImpactScale = impactScale - (impactScale - 1.0) * eased;
        }
      }

      // 글리치 종료 체크
      if (glitchState.isGlitching && now >= glitchState.endTime) {
        glitchStateRef.current.isGlitching = false;
      }

      // 프레임 스킵 로직 (글리치/임팩트 비활성 시 30fps)
      const isAnimating = shouldGlitch || currentImpactScale > 1.0;
      const frameInterval = isAnimating ? targetFrameTime : targetFrameTime * 2;
      if (timestamp - lastFrameTime < frameInterval) {
        animationRef.current = requestAnimationFrame(render);
        return;
      }
      lastFrameTime = timestamp;

      // 캔버스 크기 조정
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2); // DPR 최대 2로 제한

      const targetWidth = Math.round(rect.width * dpr);
      const targetHeight = Math.round(rect.height * dpr);

      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        gl.viewport(0, 0, targetWidth, targetHeight);
      }

      // 비디오 재생 중이고 데이터가 있을 때만 텍스처 업데이트
      if (video.readyState >= 2 && !video.paused) {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
        if (!videoTextureReady.current) {
          videoTextureReady.current = true;
          canvas.style.opacity = "1";
        }
      }

      // 셰이더 사용
      gl.useProgram(program);

      // Uniform 업데이트
      gl.uniform1i(uniforms.u_video, 0);
      gl.uniform1f(uniforms.u_time, now);
      gl.uniform1f(uniforms.u_isGlitching, shouldGlitch ? 1.0 : 0.0);
      gl.uniform1f(uniforms.u_seed, shouldGlitch ? glitchState.seed + Math.floor(now / 50) : 0);
      gl.uniform1f(uniforms.u_bandCount, bandCount);
      gl.uniform1f(uniforms.u_maxDisplacement, maxDisplacement);
      gl.uniform2f(uniforms.u_resolution, canvas.width, canvas.height);
      gl.uniform1f(uniforms.u_dpr, dpr);
      gl.uniform1f(uniforms.u_referenceWidth, referenceWidth);
      gl.uniform1f(uniforms.u_impactScale, currentImpactScale);

      // 그리기
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      animationRef.current = requestAnimationFrame(render);
    };

    // 비디오 준비 시 렌더 시작
    const startRender = () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      animationRef.current = requestAnimationFrame(render);
    };

    video.addEventListener("loadeddata", startRender);
    video.addEventListener("play", startRender);

    if (video.readyState >= 2) {
      startRender();
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      video.removeEventListener("loadeddata", startRender);
      video.removeEventListener("play", startRender);
    };
  }, [isWebGLReady, bandCount, maxDisplacement, impactScale, impactDuration, referenceWidth]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: "relative",
        overflow: "hidden",
        width: "100%",
        height: "100%",
        ...style,
      }}
    >
      {/* 숨겨진 비디오 소스 */}
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        autoPlay
        loop
        muted
        playsInline
        disablePictureInPicture
        crossOrigin="anonymous"
        style={{
          position: "absolute",
          opacity: 0,
          pointerEvents: "none",
          width: 1,
          height: 1,
        }}
      />

      {/* WebGL 캔버스 - 비디오 텍스처 준비 전까지 숨김 (poster 배경이 보이도록) */}
      <canvas
        ref={canvasRef}
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          position: "absolute",
          top: 0,
          left: 0,
          opacity: 0,
        }}
      />
    </div>
  );
}
