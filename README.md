# Nook Radio

AI-curated radio for cafés, restaurants, and lobbies.

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Environment variables

| Key | Required for |
|---|---|
| `GOOGLE_CLIENT_ID` | Google sign-in |
| `GOOGLE_CLIENT_SECRET` | Google sign-in |
| `NEXTAUTH_SECRET` | NextAuth sessions |
| `NEXTAUTH_URL` | NextAuth callback URLs |
| `GEMINI_API_KEY` | AI recommendations |
| `LAVALINK_HOST` | Audio search and streaming |
| `LAVALINK_PORT` | Audio search and streaming |
| `LAVALINK_PASSWORD` | Audio search and streaming |
| `LAVALINK_SECURE` | HTTPS Lavalink nodes |
| `SUPABASE_URL` | Database persistence |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only database writes |

## Supabase database

Run `supabase/schema.sql` in the Supabase SQL editor. Keep `SUPABASE_SERVICE_ROLE_KEY` only in server environment files and deployment secrets.

## Project structure

```text
app/
  page.js
  api/auth/[...nextauth]/
  api/recommend/
  api/lavalink/search/
  api/lavalink/stream/
components/
  LoginStage, LanguageStage, MoodStage, MoodDial, LoadingStage, PlayerStage
lib/
  config.js
  lavalinkClient.js
  serverEnv.js
  supabaseServer.js
supabase/
  schema.sql
```
