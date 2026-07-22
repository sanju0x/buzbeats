import { NextResponse } from "next/server";
import { searchTracks, streamUrl } from "@/lib/lavalinkClient";
import { serverEnv } from "@/lib/serverEnv";

export async function POST(request) {
  const { query, source = "ytsearch" } = await request.json();
  const env = serverEnv();

  if (!query) {
    return NextResponse.json({ error: "missing query" }, { status: 400 });
  }

  if (!env.LAVALINK_HOST || !env.LAVALINK_PASSWORD) {
    return NextResponse.json(
      { error: "lavalink_not_configured", message: "Configure Lavalink server variables" },
      { status: 503 }
    );
  }

  try {
    const tracks = await searchTracks(query, source);
    return NextResponse.json({
      tracks: tracks.map((t) => ({
        ...t,
        streamUrl: t.encoded ? streamUrl(t.encoded) : null,
      })),
    });
  } catch (err) {
    console.error("[lavalink/search]", err.message);
    return NextResponse.json(
      { error: "search_failed", message: err.message },
      { status: 502 }
    );
  }
}
