const { test } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { spawn } = require("node:child_process");
const { createHmac } = require("node:crypto");
const { once } = require("node:events");
const { WebSocketServer } = require("ws");

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function listen(server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return server.address().port;
}

test("NodeLink browser radio integration", { timeout: 120000 }, async (t) => {
  let failStream = false;
  let loadedUrl;
  let rangeHeader;
  let encodedTrack;
  let connections = 0;
  let authorization;
  let logs = "";
  const encoded = "A+B/C==";
  const bytes = Buffer.from("0123456789");
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/media") {
      rangeHeader = req.headers.range;
      assert.equal(req.headers.authorization, undefined);
      const partial = rangeHeader === "bytes=2-5";
      res.writeHead(partial ? 206 : 200, { "Content-Type": "audio/mpeg", "Accept-Ranges": "bytes", "Content-Length": partial ? 4 : bytes.length, ...(partial ? { "Content-Range": "bytes 2-5/10" } : {}) });
      return res.end(partial ? bytes.subarray(2, 6) : bytes);
    }
    authorization = req.headers.authorization;
    res.setHeader("Content-Type", "application/json");
    if (url.pathname === "/v4/info") return res.end(JSON.stringify({ isNodelink: true, version: { semver: "3.0.0" }, sourceManagers: ["spotify", "youtube", "http"], filters: [], plugins: [] }));
    if (url.pathname === "/v4/loadtracks") {
      loadedUrl = url.searchParams.get("identifier");
      return res.end(JSON.stringify({ loadType: "playlist", data: { info: { name: "Mock radio", selectedTrack: -1 }, tracks: [{ encoded, info: { identifier: "mock-track", title: "Mock Song", author: "Mock Artist", length: 180000, isSeekable: true, isStream: false, uri: "https://open.spotify.com/track/mock", sourceName: "spotify" } }] } }));
    }
    if (url.pathname === "/v4/trackstream") {
      encodedTrack = url.searchParams.get("encodedTrack");
      return res.end(JSON.stringify(failStream ? { error: "unavailable" } : { url: `http://127.0.0.1:${server.address().port}/media`, format: "audio/mpeg", protocol: "http" }));
    }
    res.writeHead(404);
    res.end("{}");
  });
  const mockPort = await listen(server);
  const ws = new WebSocketServer({ server });
  ws.on("connection", (socket) => {
    connections++;
    socket.send(JSON.stringify({ op: "ready", resumed: false, sessionId: `mock-${connections}` }));
  });
  const reservation = http.createServer();
  const port = await listen(reservation);
  await new Promise((resolve) => reservation.close(resolve));
  const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "-p", String(port), "-H", "127.0.0.1"], {
    env: { ...process.env, LAVALINK_HOST: "127.0.0.1", LAVALINK_PORT: String(mockPort), LAVALINK_PASSWORD: "mock-password", LAVALINK_SECURE: "false", LAVALINK_STREAM_SECRET: "mock-stream-secret", NEXTAUTH_SECRET: "mock-auth-secret", NEXTAUTH_URL: `http://127.0.0.1:${port}`, SUPABASE_URL: "", SUPABASE_SERVICE_ROLE_KEY: "", NEXT_TELEMETRY_DISABLED: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => { logs += chunk; });
  child.stderr.on("data", (chunk) => { logs += chunk; });
  t.after(async () => {
    child.kill("SIGTERM");
    await Promise.race([once(child, "exit"), delay(5000)]);
    if (child.exitCode === null) child.kill("SIGKILL");
    for (const socket of ws.clients) socket.terminate();
    ws.close();
    await new Promise((resolve) => server.close(resolve));
  });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error(logs);
    try { await fetch(`${base}/api/radio/stream`); break; } catch {}
    await delay(200);
    if (i === 99) throw new Error(`Server did not start: ${logs}`);
  }
  const recommend = (body) => fetch(`${base}/api/recommend`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  let streamUrl;
  await t.test("loads selected Spotify playlist using lavalink-client", async () => {
    const response = await recommend({ stationId: "spotify-malayalam-feel-good" });
    const result = await response.json();
    assert.equal(response.status, 200, JSON.stringify(result) + logs);
    assert.equal(result.source, "nodelink");
    assert.equal(result.station.id, "spotify-malayalam-feel-good");
    assert.equal(loadedUrl, "https://open.spotify.com/playlist/4OInQcL3jqnzYxfcveTN4d");
    assert.equal(authorization, "mock-password");
    assert.equal(result.tracks[0].duration, 180000);
    assert.equal(result.tracks[0].title, "Mock Song");
    assert.equal(JSON.stringify(result).includes("mock-password"), false);
    streamUrl = result.tracks[0].streamUrl;
  });
  await t.test("proxies audio and preserves ranges without upstream credentials", async () => {
    const response = await fetch(base + streamUrl, { headers: { Range: "bytes=2-5" } });
    assert.equal(response.status, 206);
    assert.equal(response.headers.get("content-type"), "audio/mpeg");
    assert.equal(response.headers.get("content-range"), "bytes 2-5/10");
    assert.equal(await response.text(), "2345");
    assert.equal(rangeHeader, "bytes=2-5");
    assert.equal(encodedTrack, encoded);
  });
  await t.test("rejects tampered links and invalid ranges", async () => {
    assert.equal((await fetch(base + streamUrl.replace("token=", "token=x"))).status, 403);
    const payload = Buffer.from(JSON.stringify({ encoded, expires: Date.now() - 1000 })).toString("base64url");
    const signature = createHmac("sha256", "mock-stream-secret").update(payload).digest("base64url");
    assert.equal((await fetch(`${base}/api/radio/stream?token=${payload}.${signature}`)).status, 403);
    assert.equal((await fetch(base + streamUrl, { headers: { Range: "bytes=1-2,3-4" } })).status, 416);
  });
  await t.test("validates station requests and excludes titles", async () => {
    assert.equal((await recommend({ stationId: "unknown" })).status, 400);
    assert.equal((await recommend({ exclude: "invalid" })).status, 400);
    assert.equal((await recommend({ language: "tamil" })).status, 400);
    assert.equal((await recommend({ exclude: ["mock song"] })).status, 404);
    const response = await recommend({ language: "tamil", mood: "lofi" });
    assert.equal((await response.json()).station.id, "spotify-lofi");
  });
  await t.test("returns controlled error when streaming fails", async () => {
    failStream = true;
    assert.equal((await fetch(base + streamUrl)).status, 502);
    failStream = false;
  });
  await t.test("reconnects after NodeLink disconnect", async () => {
    for (const socket of ws.clients) socket.close(1001, "test reconnect");
    await delay(100);
    const response = await recommend({ stationId: "spotify-desi-hits" });
    assert.equal(response.status, 200, logs);
    assert.ok(connections >= 2);
  });
});
