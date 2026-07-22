import { serverEnv } from "@/lib/serverEnv";

function getSupabaseConfig() {
  const env = serverEnv();
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return {
    url: env.SUPABASE_URL.replace(/\/$/, ""),
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

async function supabaseRequest(path, options = {}) {
  const config = getSupabaseConfig();
  if (!config) return { skipped: true };

  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...options.headers,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Supabase request failed with status ${response.status}: ${message}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

export async function saveRadioSession({ userEmail, language, mood, tracks, source }) {
  const sessionRows = await supabaseRequest("radio_sessions", {
    method: "POST",
    body: JSON.stringify([{ user_email: userEmail || null, language, mood, source }]),
  });

  if (!Array.isArray(sessionRows) || !sessionRows[0]?.id) return null;

  const sessionId = sessionRows[0].id;
  const trackRows = tracks.map((track, index) => ({
    session_id: sessionId,
    position: index,
    title: track.title || null,
    artist: track.artist || track.author || null,
    duration_ms: track.duration || null,
    artwork_url: track.artworkUrl || null,
    uri: track.uri || null,
    encoded_track: track.encoded || null,
  }));

  if (trackRows.length) {
    await supabaseRequest("radio_session_tracks", {
      method: "POST",
      body: JSON.stringify(trackRows),
    });
  }

  return sessionId;
}
