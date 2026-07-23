const AUDIUS_API_BASE = "https://api.audius.co/v1";
const DEFAULT_APP_NAME = "buzbeats";

function appName() {
  return process.env.AUDIUS_APP_NAME?.trim() || DEFAULT_APP_NAME;
}

function apiUrl(path, params = {}) {
  const url = new URL(`${AUDIUS_API_BASE}${path}`);
  url.searchParams.set("app_name", appName());
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }
  return url;
}

function normalizeTrack(track) {
  const user = track.user || {};
  const artwork = track.artwork || {};
  return {
    id: track.id,
    title: track.title || "Unknown",
    artist: user.name || user.handle || "Audius artist",
    duration: typeof track.duration === "number" ? track.duration * 1000 : null,
    artworkUrl: artwork["480x480"] || artwork["150x150"] || artwork["1000x1000"] || null,
    uri: track.permalink || (track.permalink_url ?? null),
    streamUrl: track.id ? `/api/audius/stream/${encodeURIComponent(track.id)}` : null,
  };
}

export async function searchTracks(query, limit = 5) {
  const url = apiUrl("/tracks/search", { query, limit });
  const response = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Audius track search returned ${response.status}: ${body}`);
  }

  const data = await response.json();
  const tracks = Array.isArray(data?.data) ? data.data : [];
  return tracks.map(normalizeTrack).filter((track) => track.id && track.streamUrl);
}

export function streamUrl(trackId) {
  return `/api/audius/stream/${encodeURIComponent(trackId)}`;
}

export function audiusStreamApiUrl(trackId) {
  return apiUrl(`/tracks/${encodeURIComponent(trackId)}/stream`);
}
