import { LavalinkManager } from "lavalink-client";
import { serverEnv } from "@/lib/serverEnv";

let manager = null;

function getLavalinkConfig() {
  const env = serverEnv();
  return {
    host: env.LAVALINK_HOST,
    port: Number(env.LAVALINK_PORT || 2333),
    authorization: env.LAVALINK_PASSWORD,
    secure: env.LAVALINK_SECURE === "true",
  };
}

function getManager() {
  if (manager) return manager;

  const { host, port, authorization, secure } = getLavalinkConfig();

  if (!host || !authorization) {
    throw new Error("Lavalink is not configured");
  }

  manager = new LavalinkManager({
    nodes: [{ host, port, authorization, secure, id: "cafe-radio" }],
    sendToShard: () => {},
  });

  return manager;
}

export async function searchTracks(query, source = "ytsearch") {
  const activeManager = getManager();
  const node = activeManager.nodeManager.nodes.get("cafe-radio");

  if (!node) throw new Error("Lavalink node 'cafe-radio' not found in manager");

  const identifier = `${source}:${query}`;
  const { response } = await node.rawRequest(
    `loadtracks?identifier=${encodeURIComponent(identifier)}`,
    (opts) => {
      opts.method = "GET";
    }
  );

  if (!response.ok) {
    throw new Error(`Lavalink /loadtracks returned ${response.status}`);
  }

  const data = await response.json();
  const raw =
    data.loadType === "search"
      ? Array.isArray(data.data)
        ? data.data
        : []
      : data.loadType === "track"
      ? [data.data]
      : data.loadType === "playlist"
      ? data.data?.tracks || []
      : [];

  return raw.map((t) => ({
    title: t.info?.title || "Unknown",
    author: t.info?.author || "",
    duration: t.info?.length || 0,
    artworkUrl: t.info?.artworkUrl || null,
    uri: t.info?.uri || null,
    encoded: t.encoded,
  }));
}

export function streamUrl(encoded) {
  return `/api/lavalink/stream?encoded=${encodeURIComponent(encoded)}`;
}

export function getNodeRestConfig() {
  const { host, port, authorization, secure } = getLavalinkConfig();

  if (!host || !authorization) {
    throw new Error("Lavalink is not configured");
  }

  const base = `http${secure ? "s" : ""}://${host}:${port}`;
  return { base, authorization };
}
