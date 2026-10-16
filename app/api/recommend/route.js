import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getDirectRadioStream, loadYouTubeMusic, RadioServerError } from "@/lib/lavalinkServer";
import { createStreamToken } from "@/lib/radioTokens";
import { saveRadioSession } from "@/lib/supabaseServer";
import { automaticMixName, defaultYtMusicSearch, playlistById } from "@/lib/ytMusicPlaylists";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LANGUAGES = new Set(["english", "hindi", "malayalam", "tamil"]);
const MOODS = new Set(["feelgood", "romantic", "sad", "lofi"]);
const TARGET_BATCH_SIZE = 20;

function trackKey(track) {
  const id = track?.info?.identifier || track?.id;
  if (id) return `id:${String(id).toLowerCase()}`;
  const title = track?.info?.title || track?.title || "";
  const artist = track?.info?.author || track?.artist || "";
  return `meta:${title}::${artist}`.toLowerCase();
}

function parseInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("invalid");
  const { language = "english", mood = "feelgood", playlistId = "auto", seed, cursor = 0, exclude = [] } = input;
  if (![language, mood, playlistId].every((value) => typeof value === "string")) throw new Error("invalid");
  if (!LANGUAGES.has(language) || !MOODS.has(mood) || playlistById(playlistId).id !== playlistId) throw new Error("invalid");
  if (seed !== undefined && (typeof seed !== "string" || seed.length > 128)) throw new Error("invalid");
  if (!Number.isInteger(cursor) || cursor < 0 || cursor > 10000) throw new Error("invalid");
  if (!Array.isArray(exclude) || exclude.length > 1000 || exclude.some((value) => typeof value !== "string" || value.length > 256)) throw new Error("invalid");
  return { language, mood, playlistId, seed: seed?.trim() || null, cursor, exclude };
}

function publicTrack(track) {
  return {
    id: track.info.identifier,
    title: track.info.title,
    artist: track.info.author,
    duration: track.info.length || track.info.duration || 0,
    artworkUrl: track.info.artworkUrl || null,
    uri: track.info.uri,
    streamUrl: `/api/ytmusic/stream?token=${createStreamToken(track.encoded)}`,
  };
}

export async function POST(request) {
  let input;
  try {
    input = parseInput(await request.json());
  } catch {
    return NextResponse.json(
      { tracks: [], error: "invalid_request", message: "Choose a supported language, mood, and YouTube Music mix." },
      { status: 400 }
    );
  }

  const excluded = new Set(input.exclude.map((value) => value.toLowerCase()));
  const selected = [];
  const selectedKeys = new Set();
  const identifiers = [];

  // NodeLink's automix gives the queue continuity. Rotating music-only searches
  // keep it working when a host does not expose the recommendation source.
  if (input.seed) identifiers.push(`ytrec:${input.seed}`);
  for (let offset = 0; offset < 4; offset += 1) {
    identifiers.push(`ytmsearch:${defaultYtMusicSearch(input.language, input.mood, input.playlistId, input.cursor + offset)}`);
  }

  try {
    for (const identifier of identifiers) {
      let result;
      try {
        result = await loadYouTubeMusic(identifier);
      } catch (error) {
        if (identifier.startsWith("ytrec:")) continue;
        throw error;
      }

      for (const track of result.tracks) {
        if (!track?.encoded || !track?.info?.title || !track?.info?.identifier) continue;
        const key = trackKey(track);
        const metadataKey = `${track.info.title}::${track.info.author || ""}`.toLowerCase();
        if (excluded.has(key) || excluded.has(metadataKey) || excluded.has(String(track.info.identifier).toLowerCase()) || selectedKeys.has(key)) continue;
        selected.push(track);
        selectedKeys.add(key);
        if (selected.length >= TARGET_BATCH_SIZE) break;
      }
      if (selected.length >= TARGET_BATCH_SIZE) break;
    }

    if (!selected.length) {
      return NextResponse.json(
        { tracks: [], error: "no_results", message: "YouTube Music did not return any new songs for this mix." },
        { status: 404 }
      );
    }

    await getDirectRadioStream(selected[0].encoded);
    const tracks = selected.map(publicTrack);
    const collection = {
      id: input.playlistId,
      name: automaticMixName(input.language, input.mood, input.playlistId),
      type: input.seed ? "recommendations" : "search",
    };

    let sessionId = null;
    if (input.cursor === 0) {
      try {
        const session = await getServerSession(authOptions);
        sessionId = await saveRadioSession({
          userEmail: session?.user?.email,
          language: input.language,
          mood: input.mood,
          tracks,
          source: "youtube_music",
        });
      } catch {
        console.error("[ytmusic] Session persistence failed.");
      }
    }

    return NextResponse.json(
      { tracks, collection, sessionId, source: "youtube_music", nextCursor: input.cursor + 1 },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[ytmusic] Automatic queue failed:", error?.code || error?.name, error?.message);
    const known = error instanceof RadioServerError;
    return NextResponse.json(
      {
        tracks: [],
        error: known ? error.code : "youtube_music_failed",
        message: known ? error.message : "YouTube Music is unavailable right now.",
      },
      { status: known && error.status >= 400 && error.status < 600 ? error.status : 502 }
    );
  }
}
