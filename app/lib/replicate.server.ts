const KLING_MODEL_VERSION =
  "0b9053d30c02c3b6574ddf14f33499f7b69302c81954ad86239fa67bc5e52896";

interface MotionControlInput {
  image: string;
  video: string;
  prompt?: string;
  mode?: "std" | "pro";
  character_orientation?: "image" | "video";
  keep_original_sound?: boolean;
}

interface PredictionResponse {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output?: string;
  error?: string;
  logs?: string;
}

export async function createMotionControlPrediction(
  input: MotionControlInput,
  token: string
): Promise<PredictionResponse> {
  const response = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      version: KLING_MODEL_VERSION,
      input: {
        image: input.image,
        video: input.video,
        prompt: input.prompt || "A person performing the motion",
        mode: input.mode || "std",
        character_orientation: input.character_orientation || "image",
        keep_original_sound: input.keep_original_sound ?? false,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Replicate API error: ${error}`);
  }

  return response.json();
}

export async function getPredictionStatus(
  predictionId: string,
  token: string
): Promise<PredictionResponse> {
  const response = await fetch(
    `https://api.replicate.com/v1/predictions/${predictionId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to get prediction: ${response.statusText}`);
  }

  return response.json();
}
