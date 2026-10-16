import { NextResponse } from "next/server";
import { getDirectRadioStream, RadioServerError } from "@/lib/lavalinkServer";
import { verifyStreamToken } from "@/lib/radioTokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const encoded = verifyStreamToken(new URL(request.url).searchParams.get("token"));
    if (!encoded) return NextResponse.json({ error: "invalid_or_expired_stream" }, { status: 403 });
    const stream = await getDirectRadioStream(encoded);
    const url = new URL(stream.url);
    if (!["https:", "http:"].includes(url.protocol)) throw new Error("Unsupported stream protocol.");
    const headers = {};
    const range = request.headers.get("range");
    if (range) {
      if (!/^bytes=\d*-\d*$/.test(range)) return new Response(null, { status: 416 });
      headers.Range = range;
    }
    const controller = new AbortController();
    const abort = () => controller.abort();
    request.signal.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(abort, 15000);
    let upstream;
    try {
      upstream = await fetch(url, { headers, cache: "no-store", signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
    if (!upstream.ok || !upstream.body) {
      request.signal.removeEventListener("abort", abort);
      await upstream.body?.cancel();
      return NextResponse.json({ error: "stream_unavailable" }, { status: upstream.status === 416 ? 416 : 502 });
    }
    const responseHeaders = new Headers({ "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" });
    for (const key of ["content-type", "content-length", "content-range", "accept-ranges"]) {
      const value = upstream.headers.get(key);
      if (value) responseHeaders.set(key, value);
    }
    if (!responseHeaders.has("content-type")) responseHeaders.set("content-type", stream.format || "application/octet-stream");
    const reader = upstream.body.getReader();
    const body = new ReadableStream({
      async pull(target) {
        try {
          const { done, value } = await reader.read();
          if (done) {
            request.signal.removeEventListener("abort", abort);
            target.close();
          } else target.enqueue(value);
        } catch (error) {
          request.signal.removeEventListener("abort", abort);
          target.error(error);
        }
      },
      async cancel() {
        abort();
        request.signal.removeEventListener("abort", abort);
        await reader.cancel();
      },
    });
    return new Response(body, { status: upstream.status, headers: responseHeaders });
  } catch (error) {
    console.error("[radio] Stream request failed:", error?.code || error?.name, error?.message);
    return NextResponse.json({
      error: error instanceof RadioServerError ? error.code : "stream_failed",
      message: error instanceof RadioServerError ? error.message : "NodeLink could not resolve this track for browser playback.",
    }, { status: 502 });
  }
}
