import { getNodeRestConfig } from "@/lib/lavalinkClient";
import { serverEnv } from "@/lib/serverEnv";

const BROWSER_SAFE_AUDIO_TYPE = "audio/mpeg";
const UNSAFE_AUDIO_TYPES = ["application/json", "text/plain", "text/html"];

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const encoded = searchParams.get("encoded");
  const env = serverEnv();

  if (!encoded) {
    return new Response("missing encoded", { status: 400 });
  }

  if (!env.LAVALINK_HOST || !env.LAVALINK_PASSWORD) {
    return new Response("Lavalink not configured", { status: 503 });
  }

  const { base, authorization } = getNodeRestConfig();
  const upstream = `${base}/v4/trackstream?encodedTrack=${encodeURIComponent(encoded)}`;
  const range = request.headers.get("range");

  try {
    const upstreamRes = await fetch(upstream, {
      headers: {
        Authorization: authorization,
        Accept: "audio/mpeg,audio/*;q=0.9,*/*;q=0.8",
        ...(range ? { Range: range } : {}),
      },
      cache: "no-store",
    });

    if (!upstreamRes.ok) {
      return new Response(
        `Lavalink stream error: ${upstreamRes.status} ${upstreamRes.statusText}`,
        { status: upstreamRes.status }
      );
    }

    const upstreamType = upstreamRes.headers.get("content-type") || "";
    const headers = new Headers();
    headers.set(
      "content-type",
      upstreamType && !UNSAFE_AUDIO_TYPES.some((type) => upstreamType.startsWith(type))
        ? upstreamType
        : BROWSER_SAFE_AUDIO_TYPE
    );
    headers.set("accept-ranges", upstreamRes.headers.get("accept-ranges") || "bytes");
    headers.set("cache-control", "no-store");

    for (const header of ["content-length", "content-range"]) {
      const value = upstreamRes.headers.get(header);
      if (value) headers.set(header, value);
    }

    return new Response(upstreamRes.body, { status: upstreamRes.status, headers });
  } catch (err) {
    return new Response(`Stream proxy error: ${err.message}`, { status: 502 });
  }
}
