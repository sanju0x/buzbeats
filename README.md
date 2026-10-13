# Buzbeats Radio

Browser radio for cafés, restaurants, and lobbies, powered by NodeLink and `lavalink-client`.

## Setup

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Configure `LAVALINK_HOST` as a hostname without a URL scheme, `LAVALINK_PORT`, `LAVALINK_PASSWORD`, and `LAVALINK_SECURE`. For TLS use port 443. Set `LAVALINK_STREAM_SECRET` to a long random secret, or provide `NEXTAUTH_SECRET` as the signing secret. Generate one with:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Use a NodeLink version supporting `/v4/trackstream`, enable `enableTrackStreamEndpoint: true` in its configuration, and enable/configure its Spotify source and playable fallback sources. Spotify playlist URLs are loaded as track metadata; actual audio availability depends on the sources configured on NodeLink. A standard Lavalink server without NodeLink's streaming endpoint cannot provide browser playback through this implementation.

`LAVALINK_CLIENT_ID` identifies the website's NodeLink WebSocket connection and defaults to `1`. Use a unique numeric ID when sharing a node with another client. No Discord bot token or voice channel is needed for this website.

Run the website on a persistent Node.js host using `npm run build` and `npm start`. This integration maintains a WebSocket connection and proxies audio bytes; use hosting suited to long-lived connections and streaming responses.

## Stations

The station selector includes all seven playlists in `lib/radioStations.js`: lofi beats, Chill Hits, Desi Hits, Hot Hits Hindi, Malayalam Feel Good, The Sound of Malayalam Indie, and Malayalam Party Hits. Language and mood choose an initial station, and listeners can change stations in the player. The Lofi mood selects the instrumental station. No Tamil playlist was supplied; listeners selecting Tamil can choose an available station explicitly. Mood defaults select existing stations rather than filtering individual songs by mood.

## Playback

`POST /api/recommend` accepts `stationId`, `language`, `mood`, and optional excluded titles. Only configured station URLs are loaded through `lavalink-client`. The API returns a queue with signed, same-origin audio links. `/api/radio/stream` resolves each track through NodeLink on demand and proxies its audio, including range requests for seeking. Node credentials stay on the server. Queue links expire after 24 hours; reload the station to renew them. The queue loops continuously, supports shuffle and single-track repeat, and stops with an error if every track fails.

## Environment variables

| Key | Purpose |
|---|---|
| `LAVALINK_HOST`, `LAVALINK_PORT`, `LAVALINK_PASSWORD`, `LAVALINK_SECURE` | NodeLink connection |
| `LAVALINK_CLIENT_ID` | Unique NodeLink client ID; defaults to `1` |
| `LAVALINK_STREAM_SECRET` | Signs expiring stream links; falls back to `NEXTAUTH_SECRET` |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL` | Google sign-in and sessions |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Optional session persistence |

Run `supabase/schema.sql` in the Supabase SQL editor to enable persistence. Keep passwords, signing secrets, and `SUPABASE_SERVICE_ROLE_KEY` in server environment files or deployment secrets.

## Validation

```bash
npm test
npm run build
```

Integration tests start a mock NodeLink HTTP/WebSocket server and the Next.js development server. They check playlist selection, invalid inputs, signed stream links, byte-range forwarding, upstream failure handling, and reconnection. Real Spotify and audio playback require a configured live NodeLink node.
