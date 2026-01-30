import { useState } from "react";

interface ImageGenerateFormProps {
  selectedImage: {
    id: string;
    name: string | null;
    publicUrl: string;
  } | null;
  characterImageUrl: string | null;
  memberId: string | null;
  onGenerate: (params: ImageGenerateParams) => void;
  isGenerating: boolean;
}

export interface ImageGenerateParams {
  conceptImageUrl: string | null;
  conceptImageId: string | null;
  prompt: string;
  referenceType: string | null;
  resolution: string;
  aspectRatio: string;
}

const REFERENCE_TYPES = [
  { id: "background", label: "Background" },
  { id: "pose", label: "Pose" },
  { id: "style", label: "Style" },
  { id: "composition", label: "Composition" },
];

const RESOLUTIONS = [
  { id: "1K", label: "1K" },
  { id: "2K", label: "2K (Recommended)" },
  { id: "4K", label: "4K" },
];

const ASPECT_RATIOS = [
  { id: "2:3", label: "2:3 (Portrait)" },
  { id: "3:2", label: "3:2 (Landscape)" },
  { id: "1:1", label: "1:1 (Square)" },
  { id: "9:16", label: "9:16 (Story)" },
  { id: "16:9", label: "16:9 (Wide)" },
];

export function ImageGenerateForm({
  selectedImage,
  characterImageUrl,
  memberId,
  onGenerate,
  isGenerating,
}: ImageGenerateFormProps) {
  const [prompt, setPrompt] = useState("");
  const [referenceType, setReferenceType] = useState<string | null>(null);
  const [resolution, setResolution] = useState("2K");
  const [aspectRatio, setAspectRatio] = useState("2:3");

  const canGenerate = characterImageUrl && prompt.trim().length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canGenerate || isGenerating) return;

    onGenerate({
      conceptImageUrl: selectedImage?.publicUrl || null,
      conceptImageId: selectedImage?.id || null,
      prompt: prompt.trim(),
      referenceType: selectedImage ? referenceType : null,
      resolution,
      aspectRatio,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Selected Concept Image Preview */}
      {selectedImage && (
        <div className="flex items-start gap-4 p-4 bg-neutral-50 rounded-lg">
          <img
            src={selectedImage.publicUrl}
            alt={selectedImage.name || "Concept"}
            className="w-20 h-28 object-cover rounded"
          />
          <div className="flex-1">
            <p className="text-sm font-medium text-neutral-900">
              {selectedImage.name || "Untitled"}
            </p>
            <p className="text-xs text-neutral-500 mt-1">
              Reference image selected
            </p>
          </div>
        </div>
      )}

      {/* Prompt Input */}
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-2">
          Prompt <span className="text-red-500">*</span>
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the image you want to generate..."
          rows={3}
          className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent resize-none"
        />
      </div>

      {/* Reference Type (only if concept image is selected) */}
      {selectedImage && (
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Reference Type
          </label>
          <div className="flex flex-wrap gap-2">
            {REFERENCE_TYPES.map((type) => (
              <button
                key={type.id}
                type="button"
                onClick={() =>
                  setReferenceType(referenceType === type.id ? null : type.id)
                }
                className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                  referenceType === type.id
                    ? "bg-black text-white border-black"
                    : "bg-white text-neutral-700 border-neutral-300 hover:border-neutral-400"
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Resolution */}
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-2">
          Resolution
        </label>
        <select
          value={resolution}
          onChange={(e) => setResolution(e.target.value)}
          className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent bg-white"
        >
          {RESOLUTIONS.map((res) => (
            <option key={res.id} value={res.id}>
              {res.label}
            </option>
          ))}
        </select>
      </div>

      {/* Aspect Ratio */}
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-2">
          Aspect Ratio
        </label>
        <select
          value={aspectRatio}
          onChange={(e) => setAspectRatio(e.target.value)}
          className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent bg-white"
        >
          {ASPECT_RATIOS.map((ar) => (
            <option key={ar.id} value={ar.id}>
              {ar.label}
            </option>
          ))}
        </select>
      </div>

      {/* Generate Button */}
      <button
        type="submit"
        disabled={!canGenerate || isGenerating}
        className={`w-full py-3 rounded-lg font-medium text-sm transition-colors ${
          canGenerate && !isGenerating
            ? "bg-black text-white hover:bg-neutral-800"
            : "bg-neutral-200 text-neutral-400 cursor-not-allowed"
        }`}
      >
        {isGenerating ? (
          <span className="flex items-center justify-center gap-2">
            <svg
              className="animate-spin w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Generating...
          </span>
        ) : (
          "Generate Image"
        )}
      </button>

      {!characterImageUrl && (
        <p className="text-xs text-red-500 text-center">
          Please select a character first
        </p>
      )}
    </form>
  );
}
