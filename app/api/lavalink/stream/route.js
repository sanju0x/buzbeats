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
  const range = request.headers.get("range");

  try {
    const upstreamRes = await fetch(upstream, {
      headers: {
        Authorization: authorization,
        ...(range ? { Range: range } : {}),
      },
      cache: "no-store",
    });

    if (!upstreamRes.ok) {
      const body = await upstreamRes.text();
      return new Response(
        `Lavalink stream error: ${upstreamRes.status} ${upstreamRes.statusText} ${body}`,
        { status: upstreamRes.status }
      );
    }

    const headers = new Headers();
    const contentType = upstreamRes.headers.get("content-type");
    if (contentType) headers.set("content-type", contentType);
    const contentLength = upstreamRes.headers.get("content-length");
    if (contentLength) headers.set("content-length", contentLength);
    const contentRange = upstreamRes.headers.get("content-range");
    if (contentRange) headers.set("content-range", contentRange);
    headers.set("accept-ranges", "bytes");
    headers.set("cache-control", "no-store");

    return new Response(upstreamRes.body, { status: upstreamRes.status, headers });
  } catch (err) {
    return new Response(`Stream proxy error: ${err.message}`, { status: 502 });
  }
}
