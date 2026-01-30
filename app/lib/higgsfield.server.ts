const BASE_URL = "https://platform.higgsfield.ai";

interface HiggsfieldHeaders {
  apiKey: string;
  secret: string;
}

interface Motion {
  id: string;
  name: string;
  description: string;
  preview_url: string;
  start_end_frame: boolean;
}

interface VideoGenerationInput {
  imageUrl: string;
  motionId: string;
  prompt?: string;
  model?: "dop-lite" | "dop-turbo" | "dop-preview";
  strength?: number;
}

interface JobSetResponse {
  id: string;
  type: string;
  jobs: Array<{
    id: string;
    status: string;
    results?: {
      min: { url: string; type: string };
      raw: { url: string; type: string };
    };
  }>;
}

function getHeaders(auth: HiggsfieldHeaders) {
  return {
    "hf-api-key": auth.apiKey,
    "hf-secret": auth.secret,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

export async function listMotions(auth: HiggsfieldHeaders): Promise<Motion[]> {
  const response = await fetch(`${BASE_URL}/v1/motions`, {
    headers: getHeaders(auth),
  });

  if (!response.ok) {
    throw new Error(`Failed to list motions: ${response.statusText}`);
  }

  return response.json();
}

export async function generateVideo(
  input: VideoGenerationInput,
  auth: HiggsfieldHeaders
): Promise<JobSetResponse> {
  const response = await fetch(`${BASE_URL}/v1/image2video/dop`, {
    method: "POST",
    headers: getHeaders(auth),
    body: JSON.stringify({
      params: {
        model: input.model || "dop-preview",
        prompt: input.prompt || "A person performing motion",
        input_images: [{ type: "image_url", image_url: input.imageUrl }],
        motions: [
          { id: input.motionId, strength: input.strength || 0.5 },
        ],
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Higgsfield API error: ${error}`);
  }

  return response.json();
}

export async function getJobStatus(
  jobSetId: string,
  auth: HiggsfieldHeaders
): Promise<JobSetResponse> {
  const response = await fetch(`${BASE_URL}/v1/job-sets/${jobSetId}`, {
    headers: getHeaders(auth),
  });

  if (!response.ok) {
    throw new Error(`Failed to get job status: ${response.statusText}`);
  }

  return response.json();
}

export async function uploadImage(
  imageData: ArrayBuffer,
  contentType: string,
  auth: HiggsfieldHeaders
): Promise<string> {
  // 업로드 URL 생성
  const urlResponse = await fetch(`${BASE_URL}/files/generate-upload-url`, {
    method: "POST",
    headers: getHeaders(auth),
    body: JSON.stringify({ content_type: contentType }),
  });

  if (!urlResponse.ok) {
    throw new Error(`Failed to get upload URL: ${urlResponse.statusText}`);
  }

  const { public_url, upload_url } = await urlResponse.json();

  // S3에 업로드
  const uploadResponse = await fetch(upload_url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: imageData,
  });

  if (!uploadResponse.ok) {
    throw new Error(`Failed to upload image: ${uploadResponse.statusText}`);
  }

  return public_url;
}
