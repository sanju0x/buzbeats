import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { searchTracks } from "@/lib/audiusClient";
import { serverEnv } from "@/lib/serverEnv";
import { saveRadioSession } from "@/lib/supabaseServer";

const XAI_CHAT_COMPLETIONS_URL = "https://api.x.ai/v1/chat/completions";
const DEFAULT_XAI_MODEL = "grok-4.5";

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

  if (!env.XAI_API_KEY) {
    return NextResponse.json(
      { tracks: [], error: "ai_not_configured", message: "Set XAI_API_KEY to generate AI recommendations." },
      { status: 503 }
    );
  }

  const prompt = `You are a music-programming DJ for a ${languageLabel}-speaking café/restaurant.
Suggest 8 real ${languageLabel} songs that fit this mood: ${moodBrief} and are likely available on Audius.
Avoid these already-played titles: ${exclude.join(", ") || "none"}.
Reply with ONLY a JSON array, no prose, no markdown fences, in this exact shape:
[{"title": "song title", "artist": "artist name"}]`;

  try {
    const res = await fetch(XAI_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.XAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.XAI_MODEL || DEFAULT_XAI_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.9,
      }),
    });

    if (!res.ok) {
      const message = await res.text();
      throw new Error(`xAI request failed with ${res.status}: ${message}`);
    }

    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content || "[]";
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    const isUsable =
      Array.isArray(parsed) &&
      parsed.length > 0 &&
      parsed.every((t) => t && typeof t.title === "string" && typeof t.artist === "string" && t.title.trim() && t.artist.trim());

    if (!isUsable) {
      throw new Error("Grok AI returned no usable suggestions");
    }

    suggestions = parsed;
  } catch (err) {
    console.error("[recommend] Grok AI failed:", err.message);
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
    await persistSession({ session, language, mood, tracks: [], source: "grok" });
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
    source: "grok",
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
