import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getDirectRadioStream, loadYouTubeMusic, RadioServerError } from "@/lib/lavalinkServer";
import { createStreamToken } from "@/lib/radioTokens";
import { saveRadioSession } from "@/lib/supabaseServer";
import { defaultYtMusicSearch, playlistById } from "@/lib/ytMusicPlaylists";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isYouTubeUrl(value) {
  try {
    const host = new URL(value).hostname.replace(/^www\./, "").toLowerCase();
    return ["music.youtube.com", "youtube.com", "m.youtube.com", "youtu.be"].includes(host);
  } catch {
    return false;
  }
}

export async function POST(request) {
  let input;
  try {
    input = await request.json();
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error();
    if (["query", "playlistId", "language", "mood"].some((key) => input[key] !== undefined && typeof input[key] !== "string")) throw new Error();
    if (input.query?.length > 2048 || input.playlistId?.length > 100) throw new Error();
  } catch {
    return NextResponse.json({ tracks: [], error: "invalid_request", message: "Enter a song, artist, or YouTube Music playlist link." }, { status: 400 });
  }

  const language = input.language || "english";
  const mood = input.mood || "feelgood";
  const preset = input.playlistId ? playlistById(input.playlistId) : null;
  const requestValue = input.query?.trim() || preset?.query || defaultYtMusicSearch(language, mood);
  const isUrl = isYouTubeUrl(requestValue);
  const identifier = isUrl ? requestValue : `ytmsearch:${requestValue}`;

  if (/^https?:\/\//i.test(requestValue) && !isUrl) {
    return NextResponse.json({ tracks: [], error: "unsupported_url", message: "Paste a YouTube or YouTube Music link." }, { status: 400 });
  }

  try {
    const result = await loadYouTubeMusic(identifier);
    const tracks = result.tracks
      .filter((track) => track?.encoded && track?.info?.title)
      .slice(0, 100)
      .map((track) => ({
        id: track.info.identifier,
        title: track.info.title,
        artist: track.info.author,
        duration: track.info.length || track.info.duration || 0,
        artworkUrl: track.info.artworkUrl || null,
        uri: track.info.uri,
        streamUrl: `/api/ytmusic/stream?token=${createStreamToken(track.encoded)}`,
      }));

    if (!tracks.length) {
      return NextResponse.json({ tracks: [], error: "no_results", message: "No YouTube Music results were found. Try another search or playlist link." }, { status: 404 });
    }

    await getDirectRadioStream(result.tracks.find((track) => track?.encoded)?.encoded);
    const collection = {
      id: preset?.id || (isUrl ? "youtube-playlist" : "search-results"),
      name: result.playlist?.name || preset?.name || (isUrl ? "YouTube Music playlist" : requestValue),
      query: requestValue,
      type: result.loadType,
    };

    let sessionId = null;
    try {
      const session = await getServerSession(authOptions);
      sessionId = await saveRadioSession({ userEmail: session?.user?.email, language, mood, tracks, source: "youtube_music" });
    } catch {
      console.error("[ytmusic] Session persistence failed.");
    }

    return NextResponse.json({ tracks, collection, sessionId, source: "youtube_music" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[ytmusic] Request failed:", error?.code || error?.name, error?.message);
    const known = error instanceof RadioServerError;
    return NextResponse.json(
      { tracks: [], error: known ? error.code : "youtube_music_failed", message: known ? error.message : "YouTube Music is unavailable right now." },
      { status: known && error.status >= 400 && error.status < 600 ? error.status : 502 }
    );
  }
}
