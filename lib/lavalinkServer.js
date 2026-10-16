const REQUEST_TIMEOUT_MS = 20000;
const INFO_CACHE_MS = 60000;

let infoCache = null;

export class RadioServerError extends Error {
  constructor(code, message, status = 502) {
    super(message);
    this.name = "RadioServerError";
    this.code = code;
    this.status = status;
  }
}

function connectionConfig() {
  const explicitUrl = process.env.LAVALINK_URL?.trim();
  const rawHost = process.env.LAVALINK_HOST?.trim();
  const password = process.env.LAVALINK_PASSWORD?.trim();

  if ((!explicitUrl && !rawHost) || !password) {
    throw new RadioServerError(
      "missing_lavalink_config",
      "Set LAVALINK_URL (or LAVALINK_HOST, LAVALINK_PORT, and LAVALINK_SECURE) plus LAVALINK_PASSWORD."
    );
  }

  let baseUrl;
  try {
    if (explicitUrl) {
      baseUrl = new URL(explicitUrl.includes("://") ? explicitUrl : `https://${explicitUrl}`);
    } else {
      const hostUrl = rawHost.includes("://") ? new URL(rawHost) : null;
      const secure = process.env.LAVALINK_SECURE === "true" || hostUrl?.protocol === "https:";
      const protocol = secure ? "https:" : "http:";
      const hostname = hostUrl?.hostname || rawHost;
      const configuredPort = process.env.LAVALINK_PORT?.trim() || hostUrl?.port;
      const port = configuredPort || (secure ? "443" : "2333");
      baseUrl = new URL(`${protocol}//${hostname}:${port}`);
    }
  } catch {
    throw new RadioServerError("invalid_lavalink_url", "The Lavalink/NodeLink host or URL is invalid.");
  }

  baseUrl.pathname = baseUrl.pathname.replace(/\/$/, "");
  return { baseUrl: baseUrl.toString().replace(/\/$/, ""), password };
}

async function nodeRequest(path, { timeout = REQUEST_TIMEOUT_MS } = {}) {
  const { baseUrl, password } = connectionConfig();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`${baseUrl}/v4/${path.replace(/^\//, "")}`, {
      headers: {
        Authorization: password,
        "Client-Name": "BuzBeats/1.0",
      },
      cache: "no-store",
      signal: controller.signal,
    });
    const contentType = response.headers.get("content-type") || "";
    const body = contentType.includes("application/json") ? await response.json() : await response.text();

    if (!response.ok) {
      const detail = typeof body === "object" ? body?.message || body?.error : String(body || "");
      if (response.status === 401 || response.status === 403) {
        throw new RadioServerError("lavalink_auth_failed", "NodeLink rejected LAVALINK_PASSWORD.", response.status);
      }
      throw new RadioServerError(
        "lavalink_request_failed",
        `NodeLink ${path.split("?")[0]} returned ${response.status}${detail ? `: ${detail}` : ""}.`,
        response.status
      );
    }
    return body;
  } catch (error) {
    if (error instanceof RadioServerError) throw error;
    if (error?.name === "AbortError" || error?.name === "TimeoutError") {
      throw new RadioServerError("lavalink_timeout", "NodeLink did not respond before the request timed out.");
    }
    throw new RadioServerError("lavalink_unreachable", `Could not reach NodeLink: ${error?.message || "network error"}.`);
  } finally {
    clearTimeout(timer);
  }
}

export async function getRadioServerInfo({ fresh = false } = {}) {
  if (!fresh && infoCache && Date.now() - infoCache.cachedAt < INFO_CACHE_MS) return infoCache.value;
  const value = await nodeRequest("info");
  infoCache = { value, cachedAt: Date.now() };
  return value;
}

function normalizeLoadedTracks(result) {
  const rawTracks = result?.loadType === "playlist"
    ? result?.data?.tracks
    : result?.loadType === "track"
      ? [result?.data]
      : result?.loadType === "search"
        ? result?.data
        : [];

  return {
    loadType: result?.loadType || "empty",
    playlist: result?.loadType === "playlist" ? result?.data?.info || null : null,
    tracks: Array.isArray(rawTracks) ? rawTracks : [],
  };
}

export async function loadYouTubeMusic(identifier) {
  const info = await getRadioServerInfo();
  const sources = Array.isArray(info?.sourceManagers) ? info.sourceManagers.map((source) => source.toLowerCase()) : [];

  if (!sources.includes("youtube")) {
    throw new RadioServerError(
      "youtube_source_disabled",
      "NodeLink is connected, but its YouTube source is disabled. Enable the YouTube source or YouTube plugin on the server."
    );
  }

  const result = await nodeRequest(`loadtracks?identifier=${encodeURIComponent(identifier)}`);
  if (result?.loadType === "error") {
    throw new RadioServerError("youtube_music_load_failed", result?.data?.message || "NodeLink could not load this YouTube Music request.");
  }
  return normalizeLoadedTracks(result);
}

export async function getDirectRadioStream(encodedTrack) {
  let stream;
  try {
    stream = await nodeRequest(`trackstream?encodedTrack=${encodeURIComponent(encodedTrack)}`);
  } catch (error) {
    if (error instanceof RadioServerError && error.status === 404) {
      throw new RadioServerError(
        "track_stream_disabled",
        "This NodeLink server has direct streaming disabled. Set enableTrackStreamEndpoint: true on the NodeLink server or use a host that enables /v4/trackstream."
      );
    }
    throw error;
  }
  if (!stream?.url) {
    throw new RadioServerError(
      "track_stream_disabled",
      "NodeLink did not return a stream URL. Set enableTrackStreamEndpoint: true in NodeLink config."
    );
  }
  return stream;
}
