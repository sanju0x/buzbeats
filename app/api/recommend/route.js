import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { searchTracks } from "@/lib/audiusClient";
import { serverEnv } from "@/lib/serverEnv";
import { saveRadioSession } from "@/lib/supabaseServer";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

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

  let suggestions = [];

  const geminiApiKey = env.GEMINI_API_KEY || env.GOOGLE_API_KEY || env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (!geminiApiKey) {
    return NextResponse.json(
      { tracks: [], error: "ai_not_configured", message: "Set GEMINI_API_KEY to generate AI recommendations." },
      { status: 503 }
    );
  }

  const prompt = `You are a music-programming DJ for a ${languageLabel}-speaking café/restaurant.
Suggest 8 real ${languageLabel} songs that fit this mood: ${moodBrief} and are likely available on Audius.
Avoid these already-played titles: ${exclude.join(", ") || "none"}.
Reply with ONLY a JSON array, no prose, no markdown fences, in this exact shape:
[{"title": "song title", "artist": "artist name"}]`;

  try {
    const model = env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
    const url = `${GEMINI_API_BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(geminiApiKey)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.9, maxOutputTokens: 1024 },
      }),
    });

    if (!res.ok) {
      const message = await res.text();
      throw new Error(`Gemini request failed with ${res.status}: ${message}`);
    }

    const data = await res.json();
    suggestions = parseGeminiSuggestions(data);

    if (suggestions.length === 0) {
      const blockReason = data?.promptFeedback?.blockReason;
      const finishReason = data?.candidates?.[0]?.finishReason;
      throw new Error(`Gemini returned no usable suggestions${blockReason ? ` (blocked: ${blockReason})` : ""}${finishReason ? ` (finish: ${finishReason})` : ""}`);
    }
  } catch (err) {
    console.error("[recommend] Gemini failed:", err.message);
    return NextResponse.json(
      { tracks: [], error: "ai_recommendations_failed", message: "AI recommendations could not be generated." },
      { status: 502 }
    );
  }

  const resolved = [];
  for (const suggestion of suggestions) {
    const query = `${suggestion.title} ${suggestion.artist}`;
    try {
      const results = await searchTracks(query);
      const best = results[0];
      if (best) {
        resolved.push({
          ...best,
          requestedTitle: suggestion.title,
          requestedArtist: suggestion.artist,
        });
      }
    } catch (err) {
      console.error(`[recommend] Audius search failed for "${query}":`, err.message);
    }
  }

  if (resolved.length === 0) {
    await persistSession({ session, language, mood, tracks: [], source: "gemini" });
    return NextResponse.json(
      { tracks: [], error: "audius_search_returned_nothing", message: "No Audius streams matched the AI recommendations." },
      { status: 404 }
    );
  }

  const sessionId = await persistSession({
    session,
    language,
    mood,
    tracks: resolved,
    source: "gemini",
  });

  return NextResponse.json({ tracks: resolved, sessionId });
}

function parseGeminiSuggestions(data) {
  const raw = data?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim();
  if (!raw) return [];

  const cleaned = raw
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  const jsonStart = cleaned.indexOf("[");
  const jsonEnd = cleaned.lastIndexOf("]");
  const jsonText = jsonStart >= 0 && jsonEnd > jsonStart ? cleaned.slice(jsonStart, jsonEnd + 1) : cleaned;
  const parsed = JSON.parse(jsonText);
  const tracks = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.tracks) ? parsed.tracks : [];

  return tracks
    .map((track) => ({
      title: typeof track?.title === "string" ? track.title.trim() : "",
      artist: typeof track?.artist === "string" ? track.artist.trim() : "",
    }))
    .filter((track) => track.title && track.artist);
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
