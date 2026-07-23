import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { streamUrl } from "@/lib/audiusClient";
import { serverEnv } from "@/lib/serverEnv";
import { saveRadioSession } from "@/lib/supabaseServer";

const DEFAULT_SONG_API_BASE = "http://luna.ender.co.in:5597";
const DEFAULT_LIMIT = 100;

export async function POST(request) {
  const { language = "english", mood = "feelgood", exclude = [] } = await request.json();
  const env = serverEnv();
  const session = await getServerSession(authOptions);

  try {
    const tracks = await fetchSongApiTracks({
      baseUrl: env.MOOD_SONG_API_BASE || DEFAULT_SONG_API_BASE,
      language,
      mood,
      exclude,
    });

    if (tracks.length === 0) {
      await persistSession({ session, language, mood, tracks: [], source: "song_api" });
      return NextResponse.json(
        { tracks: [], error: "song_api_returned_nothing", message: "No songs matched this mood and language." },
        { status: 404 }
      );
    }

    const sessionId = await persistSession({
      session,
      language,
      mood,
      tracks,
      source: "song_api",
    });

    return NextResponse.json({ tracks, sessionId, source: "song_api" });
  } catch (err) {
    console.error("[recommend] Song API failed:", err.message);
    return NextResponse.json(
      { tracks: [], error: "song_api_failed", message: "The song API could not return playable tracks." },
      { status: 502 }
    );
  }
}

async function fetchSongApiTracks({ baseUrl, language, mood, exclude }) {
  const url = new URL("/api/songs", baseUrl);
  url.searchParams.set("mood", mood);
  url.searchParams.set("language", language);
  url.searchParams.set("limit", String(DEFAULT_LIMIT));
  url.searchParams.set("sort", "relevance");

  const response = await fetch(url, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Song API returned ${response.status}: ${body}`);
  }

  const payload = await response.json();
  const excluded = new Set(exclude.map((title) => String(title).toLowerCase().trim()).filter(Boolean));
  const songs = Array.isArray(payload?.data) ? payload.data : [];

  return songs
    .map((song) => normalizeSong(song))
    .filter((track) => track.id && track.streamUrl && !excluded.has(track.title.toLowerCase()));
}

function normalizeSong(song) {
  const artwork = typeof song?.artwork === "string" ? song.artwork : song?.artwork?.["480x480"] || song?.artwork?.["1000x1000"] || song?.artwork?.["150x150"] || null;

  return {
    id: song?.id || null,
    title: song?.title || "Unknown",
    artist: song?.artist || song?.user?.name || song?.handle || "Audius artist",
    duration: typeof song?.durationSec === "number" ? song.durationSec * 1000 : typeof song?.duration === "number" ? song.duration * 1000 : null,
    artworkUrl: artwork,
    uri: song?.permalink || song?.permalink_url || null,
    streamUrl: song?.id ? streamUrl(song.id) : null,
    genre: song?.genre || null,
    mood: song?.mood || null,
    plays: song?.plays || null,
    favorites: song?.favorites || null,
    requestedLanguage: song?.requestedLanguage || null,
  };
}

async function persistSession({ session, language, mood, tracks, source }) {
  try {
    return await saveRadioSession({
      userEmail: session?.user?.email,
      language,
      mood,
      tracks,
      source,
    });
  } catch (err) {
    console.error("[recommend] Supabase persistence failed:", err.message);
    return null;
  }
}
