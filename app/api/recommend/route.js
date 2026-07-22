import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { searchTracks, streamUrl } from "@/lib/lavalinkClient";
import { serverEnv } from "@/lib/serverEnv";
import { saveRadioSession } from "@/lib/supabaseServer";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

const MOOD_BRIEF = {
  romantic: "warm, intimate, slow-tempo love songs",
  sad: "melancholic, reflective, slower ballads",
  lofi: "chill lo-fi / lounge instrumental or soft-vocal tracks, low energy background music",
  feelgood: "upbeat, warm, feel-good sing-along tracks",
};

const LANGUAGE_LABEL = {
  malayalam: "Malayalam",
  tamil: "Tamil",
  hindi: "Hindi",
  english: "English",
};

export async function POST(request) {
  const { language, mood, exclude = [] } = await request.json();
  const env = serverEnv();
  const session = await getServerSession(authOptions);

  const languageLabel = LANGUAGE_LABEL[language] || "English";
  const moodBrief = MOOD_BRIEF[mood] || MOOD_BRIEF.feelgood;

  let suggestions = FALLBACK_TRACKS[mood] || FALLBACK_TRACKS.feelgood;

  if (env.GEMINI_API_KEY) {
    const prompt = `You are a music-programming DJ for a ${languageLabel}-speaking café/restaurant.
Suggest 8 real, well-known ${languageLabel} songs that fit this mood: ${moodBrief}.
Avoid these already-played titles: ${exclude.join(", ") || "none"}.
Reply with ONLY a JSON array, no prose, no markdown fences, in this exact shape:
[{"title": "song title", "artist": "artist name"}]`;

    try {
      const res = await fetch(`${GEMINI_URL}?key=${env.GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.9 },
        }),
      });
      const data = await res.json();
      const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
      const cleaned = raw.replace(/```json|```/g, "").trim();
      suggestions = JSON.parse(cleaned);
    } catch (err) {
      console.error("[recommend] Gemini failed, using fallback:", err.message);
    }
  }

  if (!env.LAVALINK_HOST || !env.LAVALINK_PASSWORD) {
    const tracks = suggestions.map((s) => ({ ...s, streamUrl: null, artworkUrl: null }));
    await persistSession({ session, language, mood, tracks, source: env.GEMINI_API_KEY ? "gemini" : "fallback" });
    return NextResponse.json({
      tracks,
      error: "lavalink_not_configured",
    });
  }

  const resolved = [];
  for (const suggestion of suggestions) {
    const query = `${suggestion.title} ${suggestion.artist}`;
    try {
      const results = await searchTracks(query, "ytsearch");
      const best = results[0];
      if (best) {
        resolved.push({
          title: suggestion.title,
          artist: suggestion.artist,
          duration: best.duration,
          artworkUrl: best.artworkUrl,
          uri: best.uri,
          encoded: best.encoded,
          streamUrl: best.encoded ? streamUrl(best.encoded) : null,
        });
      }
    } catch (err) {
      console.error(`[recommend] Lavalink search failed for "${query}":`, err.message);
    }
  }

  if (resolved.length === 0) {
    const tracks = suggestions.map((s) => ({ ...s, streamUrl: null }));
    await persistSession({ session, language, mood, tracks, source: env.GEMINI_API_KEY ? "gemini" : "fallback" });
    return NextResponse.json({
      tracks,
      error: "lavalink_search_returned_nothing",
    });
  }

  const sessionId = await persistSession({
    session,
    language,
    mood,
    tracks: resolved,
    source: env.GEMINI_API_KEY ? "gemini" : "fallback",
  });

  return NextResponse.json({ tracks: resolved, sessionId });
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

const FALLBACK_TRACKS = {
  romantic: [
    { title: "Tum Hi Ho", artist: "Arijit Singh" },
    { title: "Munbe Vaa", artist: "A.R. Rahman, Shreya Ghoshal" },
    { title: "Oru Adaar Love", artist: "Omar Lulu" },
    { title: "Enna Sona", artist: "Arijit Singh" },
  ],
  sad: [
    { title: "Channa Mereya", artist: "Arijit Singh" },
    { title: "Kadhal Rojave", artist: "A.R. Rahman" },
    { title: "Nenjukkul Peidhidum", artist: "Harris Jayaraj" },
    { title: "Phir Mohabbat", artist: "Arijit Singh" },
  ],
  lofi: [
    { title: "Kun Faya Kun", artist: "A.R. Rahman" },
    { title: "Malare", artist: "Vijay Yesudas" },
    { title: "Enna Solla Pogirai", artist: "Karthi" },
    { title: "Pehla Nasha", artist: "Udit Narayan" },
  ],
  feelgood: [
    { title: "Rowdy Baby", artist: "Dhee, Dhanush" },
    { title: "Jimikki Kammal", artist: "Vineeth Sreenivasan" },
    { title: "Badtameez Dil", artist: "Pritam" },
    { title: "Vaadi Vaadi", artist: "Sid Sriram" },
  ],
};
