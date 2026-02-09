import { useState, useRef } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";

interface SkillPanelProps {
  open: boolean;
  onClose: () => void;
  videos: {
    id: string;
    name: string;
    videoUrl: string;
    thumbnailUrl: string | null;
    duration: number;
  }[];
  images: {
    id: string;
    name: string | null;
    publicUrl: string;
  }[];
  characterId: string;
  characterImageUrl: string;
  verseId: string;
}

const REVEAL_DURATION = 0.35;

function formatDuration(seconds: number) {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function Spinner() {
  return (
    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

function VideoSkillItem({
  video,
  index,
  selected,
  onClick,
}: {
  video: SkillPanelProps["videos"][number];
  index: number;
  selected: boolean;
  onClick: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isHovering, setIsHovering] = useState(false);
  const isActive = selected || isHovering;

  const handleMouseEnter = () => {
    setIsHovering(true);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  return (
    <motion.button
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, delay: REVEAL_DURATION + index * 0.05 }}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`relative aspect-[3/4] rounded-lg overflow-hidden border-2 transition-[border-color,transform,box-shadow] duration-200 ease-out cursor-pointer ${
        selected
          ? "border-black ring-2 ring-black/20 scale-[1.03] shadow-lg z-10"
          : "border-transparent hover:border-neutral-300 hover:scale-[1.02]"
      }`}
    >
      {/* Thumbnail - grayscale when not active */}
      {video.thumbnailUrl ? (
        <img
          src={video.thumbnailUrl}
          alt={video.name}
          className={`absolute inset-0 w-full h-full object-cover transition-all duration-200 ${
            isHovering ? "opacity-0" : "opacity-100"
          } ${isActive ? "grayscale-0" : "grayscale"}`}
        />
      ) : (
        <div className="absolute inset-0 w-full h-full bg-neutral-100 flex items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-neutral-300">
            <path d="m22 8-6 4 6 4V8Z" />
            <rect width="14" height="12" x="2" y="6" rx="2" />
          </svg>
        </div>
      )}

      {/* Video (hidden until hover) */}
      <video
        ref={videoRef}
        src={video.videoUrl}
        muted
        loop
        playsInline
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-200 ${
          isHovering ? "opacity-100" : "opacity-0"
        }`}
      />

      <span className="absolute bottom-1 right-1 text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded">
        {formatDuration(video.duration)}
      </span>
      <span className="absolute bottom-1 left-1 text-[10px] text-white truncate max-w-[calc(100%-3rem)] drop-shadow">
        {video.name}
      </span>
    </motion.button>
  );
}

function ImageSkillItem({
  image,
  index,
  selected,
  onClick,
}: {
  image: SkillPanelProps["images"][number];
  index: number;
  selected: boolean;
  onClick: () => void;
}) {
  const [isHovering, setIsHovering] = useState(false);
  const isActive = selected || isHovering;

  return (
    <motion.button
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, delay: REVEAL_DURATION + index * 0.05 }}
      onClick={onClick}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      className={`relative aspect-[3/4] rounded-lg overflow-hidden border-2 transition-[border-color,transform,box-shadow] duration-200 ease-out cursor-pointer ${
        selected
          ? "border-black ring-2 ring-black/20 scale-[1.03] shadow-lg z-10"
          : "border-transparent hover:border-neutral-300 hover:scale-[1.02]"
      }`}
    >
      <img
        src={image.publicUrl}
        alt={image.name || ""}
        className={`w-full h-full object-cover transition-all duration-200 ${
          isActive ? "grayscale-0" : "grayscale"
        }`}
      />
      {image.name && (
        <span className="absolute bottom-1 left-1 text-[10px] text-white truncate max-w-[calc(100%-0.5rem)] drop-shadow">
          {image.name}
        </span>
      )}
    </motion.button>
  );
}

export function SkillPanel({
  open,
  onClose,
  videos,
  images,
  characterId,
  characterImageUrl,
  verseId,
}: SkillPanelProps) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"video" | "image">("video");
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const selectedVideo = videos.find((v) => v.id === selectedVideoId);
  const selectedImage = images.find((i) => i.id === selectedImageId);

  const handleGenerate = async (type: "video" | "image") => {
    if (type === "video" && (!selectedVideo || !characterImageUrl)) return;
    if (type === "image" && (!characterImageUrl || !prompt.trim())) return;

    setIsGenerating(true);
    try {
      const formData = new FormData();
      formData.append("memberId", characterId);
      formData.append("verseId", verseId);

      let endpoint: string;
      let galleryQuery: string;

      if (type === "video") {
        endpoint = "/api/generate";
        formData.append("imageUrl", characterImageUrl);
        formData.append("videoUrl", selectedVideo!.videoUrl);
        formData.append("musicId", "");
        formData.append("motionVideoId", selectedVideo!.id);
        galleryQuery = "";
      } else {
        endpoint = "/api/generate-image";
        formData.append("characterImageUrl", characterImageUrl);
        formData.append("prompt", prompt.trim());
        formData.append("resolution", "2K");
        formData.append("aspectRatio", "2:3");
        if (selectedImage?.publicUrl) formData.append("conceptImageUrl", selectedImage.publicUrl);
        if (selectedImage?.id) formData.append("conceptImageId", selectedImage.id);
        galleryQuery = "&type=image";
      }

      const res = await fetch(endpoint, { method: "POST", body: formData });
      const data = await res.json();

      if (data.error) {
        alert(`Generation failed: ${data.error}`);
        setIsGenerating(false);
        return;
      }

      navigate(`/gallery?verse=${verseId}&highlight=${data.generationId}${galleryQuery}`);
    } catch (err) {
      console.error("Generation failed:", err);
      alert("An error occurred during generation.");
      setIsGenerating(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="skill-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 z-25 bg-white/50"
            onClick={onClose}
          />

          <motion.div
            key="skill-panel"
            initial={{ clipPath: "inset(100% 0 0 0)" }}
            animate={{ clipPath: "inset(0% 0 0 0)" }}
            exit={{ clipPath: "inset(100% 0 0 0)" }}
            transition={{ duration: REVEAL_DURATION, ease: [0.25, 0.1, 0.25, 1] }}
            className="absolute left-4 bottom-4 z-30 w-[25vw] min-w-[280px] h-[75vh] bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl flex flex-col"
          >
            {/* Tab bar */}
            <div className="flex items-center gap-2 px-5 pt-4 pb-3">
              {(["video", "image"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-4 py-1.5 text-xs font-medium rounded-full transition-colors cursor-pointer ${
                    tab === t
                      ? "bg-black text-white"
                      : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
                  }`}
                >
                  {t === "video" ? "Video" : "Image"}
                </button>
              ))}
            </div>

            {/* Scrollable grid */}
            <div className="overflow-y-auto flex-1 min-h-0 px-5 pb-3">
              {tab === "video" ? (
                videos.length === 0 ? (
                  <p className="text-center text-neutral-400 text-sm py-8">No motion videos</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {videos.map((video, i) => (
                      <VideoSkillItem
                        key={video.id}
                        video={video}
                        index={i}
                        selected={selectedVideoId === video.id}
                        onClick={() => setSelectedVideoId(selectedVideoId === video.id ? null : video.id)}
                      />
                    ))}
                  </div>
                )
              ) : images.length === 0 ? (
                <p className="text-center text-neutral-400 text-sm py-8">No concept images</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {images.map((image, i) => (
                    <ImageSkillItem
                      key={image.id}
                      image={image}
                      index={i}
                      selected={selectedImageId === image.id}
                      onClick={() => setSelectedImageId(selectedImageId === image.id ? null : image.id)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Action bar */}
            <div className="shrink-0 px-5 pb-5 pt-2 border-t border-neutral-100">
              {tab === "video" ? (
                <button
                  onClick={() => handleGenerate("video")}
                  disabled={!selectedVideoId || isGenerating}
                  className={`w-full py-3 rounded-full font-medium text-sm transition-colors ${
                    selectedVideoId && !isGenerating
                      ? "bg-black text-white hover:bg-neutral-800 cursor-pointer"
                      : "bg-neutral-200 text-neutral-400 cursor-not-allowed"
                  }`}
                >
                  {isGenerating ? <span className="flex items-center justify-center gap-2"><Spinner />Generating...</span> : "Generate Video"}
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Describe the image..."
                    className="flex-1 px-4 py-3 border border-neutral-300 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && prompt.trim() && !isGenerating) handleGenerate("image");
                    }}
                  />
                  <button
                    onClick={() => handleGenerate("image")}
                    disabled={!prompt.trim() || isGenerating}
                    className={`px-5 py-3 rounded-full font-medium text-sm whitespace-nowrap transition-colors ${
                      prompt.trim() && !isGenerating
                        ? "bg-black text-white hover:bg-neutral-800 cursor-pointer"
                        : "bg-neutral-200 text-neutral-400 cursor-not-allowed"
                    }`}
                  >
                    {isGenerating ? <span className="flex items-center gap-2"><Spinner />...</span> : "Generate"}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
