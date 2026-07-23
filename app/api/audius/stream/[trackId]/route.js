import { audiusStreamApiUrl } from "@/lib/audiusClient";

export async function GET(_request, { params }) {
  const trackId = params?.trackId;

  if (!trackId) {
    return new Response("Missing Audius track id", { status: 400 });
  }

  const upstream = audiusStreamApiUrl(trackId);
  const upstreamRes = await fetch(upstream, {
    redirect: "manual",
    cache: "no-store",
    headers: { Accept: "audio/*,*/*" },
  });

  if ([301, 302, 303, 307, 308].includes(upstreamRes.status)) {
    const location = upstreamRes.headers.get("location");
    if (location) return Response.redirect(location, upstreamRes.status);
  }

  if (!upstreamRes.ok) {
    const body = await upstreamRes.text();
    return new Response(`Audius stream error: ${upstreamRes.status} ${body}`, { status: upstreamRes.status });
  }

  const headers = new Headers();
  for (const name of ["content-type", "content-length", "accept-ranges", "content-range", "cache-control"]) {
    const value = upstreamRes.headers.get(name);
    if (value) headers.set(name, value);
  }

  return new Response(upstreamRes.body, { status: upstreamRes.status, headers });
}
