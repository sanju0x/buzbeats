import { getNodeRestConfig } from "@/lib/lavalinkClient";
import { serverEnv } from "@/lib/serverEnv";

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

  try {
    const upstreamRes = await fetch(upstream, {
      headers: { Authorization: authorization },
      cache: "no-store",
    });

    if (!upstreamRes.ok) {
      return new Response(
        `Lavalink stream error: ${upstreamRes.status} ${upstreamRes.statusText}`,
        { status: upstreamRes.status }
      );
    }

    const headers = new Headers();
    const contentType = upstreamRes.headers.get("content-type");
    if (contentType) headers.set("content-type", contentType);
    const contentLength = upstreamRes.headers.get("content-length");
    if (contentLength) headers.set("content-length", contentLength);
    headers.set("cache-control", "no-store");

    return new Response(upstreamRes.body, { status: 200, headers });
  } catch (err) {
    return new Response(`Stream proxy error: ${err.message}`, { status: 502 });
  }
}
