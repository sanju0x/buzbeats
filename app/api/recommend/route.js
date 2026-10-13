import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getRadioNode } from "@/lib/lavalinkServer";
import { selectRadioStation } from "@/lib/radioStations";
import { createStreamToken } from "@/lib/radioTokens";
import { saveRadioSession } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  let input;
  try {
    input = await request.json();
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error();
    if (["stationId", "language", "mood"].some((key) => input[key] !== undefined && typeof input[key] !== "string")) throw new Error();
    if (input.exclude !== undefined && (!Array.isArray(input.exclude) || input.exclude.length > 1000 || input.exclude.some((value) => typeof value !== "string"))) throw new Error();
  } catch {
    return NextResponse.json({ tracks: [], error: "invalid_request", message: "Send a valid radio selection." }, { status: 400 });
  }
  const { language = "english", mood = "feelgood", exclude = [] } = input;
  const station = selectRadioStation(input);
  if (!station) return NextResponse.json({ tracks: [], error: "station_unavailable", message: "No station matches this selection. Choose one of the available radio stations." }, { status: 400 });
  try {
    const node = await getRadioNode();
    const result = await node.search({ query: station.streamUrl }, { id: "radio" });
    if (result.loadType === "error") throw new Error("Playlist loading failed.");
    const excluded = new Set(exclude.map((title) => title.toLowerCase().trim()));
    const tracks = result.tracks.filter((track) => track.encoded && !excluded.has(track.info.title.toLowerCase())).map((track) => ({
      id: track.info.identifier,
      title: track.info.title,
      artist: track.info.author,
      duration: track.info.duration,
      artworkUrl: track.info.artworkUrl || null,
      uri: track.info.uri,
      streamUrl: `/api/radio/stream?token=${createStreamToken(track.encoded)}`,
      stationId: station.id,
    }));
    if (!tracks.length) return NextResponse.json({ tracks: [], error: "empty_station", message: "This playlist has no available tracks. Check Spotify support on NodeLink or choose another station." }, { status: 404 });
    let sessionId = null;
    try {
      const session = await getServerSession(authOptions);
      sessionId = await saveRadioSession({ userEmail: session?.user?.email, language, mood, tracks, source: "nodelink" });
    } catch {
      console.error("[radio] Session persistence failed.");
    }
    return NextResponse.json({ tracks, station, sessionId, source: "nodelink" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ tracks: [], error: "nodelink_failed", message: "Radio is unavailable. Check NodeLink connection settings and Spotify source support." }, { status: 502 });
  }
}
