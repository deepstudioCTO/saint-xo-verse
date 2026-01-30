import type { AppLoadContext, EntryContext } from "react-router";
import { ServerRouter } from "react-router";
import { isbot } from "isbot";
import { renderToReadableStream } from "react-dom/server";

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  _loadContext: AppLoadContext
) {
  let shellRendered = false;
  const userAgent = request.headers.get("user-agent");

  const body = await renderToReadableStream(
    <ServerRouter context={routerContext} url={request.url} />,
    {
      onError(error: unknown) {
        responseStatusCode = 500;
        if (shellRendered) {
          console.error(error);
        }
      },
    }
  );
  shellRendered = true;

  if (userAgent && isbot(userAgent)) {
    await body.allReady;
  }

  responseHeaders.set("Content-Type", "text/html");

  // ffmpeg.wasm requires these headers for SharedArrayBuffer
  // Using "credentialless" allows loading external resources (Supabase, unpkg)
  responseHeaders.set("Cross-Origin-Opener-Policy", "same-origin");
  responseHeaders.set("Cross-Origin-Embedder-Policy", "credentialless");

  return new Response(body, {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}
