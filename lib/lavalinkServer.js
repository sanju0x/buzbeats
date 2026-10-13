import { LavalinkManager, NodeType } from "lavalink-client";

function createManager() {
  const host = process.env.LAVALINK_HOST?.trim();
  const authorization = process.env.LAVALINK_PASSWORD?.trim();
  const secure = process.env.LAVALINK_SECURE === "true";
  const port = Number(process.env.LAVALINK_PORT || (secure ? 443 : 2333));
  if (!host || !authorization) throw new Error("Set LAVALINK_HOST and LAVALINK_PASSWORD to connect NodeLink.");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("LAVALINK_PORT must be a valid port.");
  const manager = new LavalinkManager({
    nodes: [{ id: "radio", host, port, authorization, secure, nodeType: NodeType.NodeLink, retryAmount: 100, retryDelay: 5000, requestSignalTimeoutMS: 15000 }],
    sendToShard: () => {},
    client: { id: process.env.LAVALINK_CLIENT_ID || "1", username: "Buzbeats" },
  });
  manager.nodeManager.on("error", () => console.error("[radio] NodeLink connection or request failed."));
  manager.nodeManager.on("disconnect", () => console.warn("[radio] NodeLink disconnected; reconnecting."));
  return { manager, pending: null };
}

export async function getRadioNode() {
  const state = globalThis.__buzbeatsLavalink || (globalThis.__buzbeatsLavalink = createManager());
  const node = state.manager.nodeManager.nodes.get("radio");
  if (node.connected && node.info) return node;
  if (!state.pending) {
    state.pending = new Promise((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer);
        state.manager.nodeManager.off("connect", onConnect);
      };
      const onConnect = (connectedNode) => {
        if (connectedNode.id !== "radio") return;
        cleanup();
        resolve(connectedNode);
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error("NodeLink is unavailable. Check the host, port, password, and server status."));
      }, 15000);
      state.manager.nodeManager.on("connect", onConnect);
      state.manager.init().catch(() => {
        cleanup();
        reject(new Error("Could not initialize NodeLink."));
      });
    }).finally(() => { state.pending = null; });
  }
  return state.pending;
}
