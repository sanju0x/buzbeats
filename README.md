# Nook Radio

Mood-based radio for cafés, restaurants, and lobbies.

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
| `AUDIUS_APP_NAME` | Optional Audius API application name (defaults to `buzbeats`) |
| `MOOD_SONG_API_BASE` | Optional mood song API base URL (defaults to `http://luna.ender.co.in:5597`) |
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
  api/audius/stream/[trackId]/
components/
  LoginStage, LanguageStage, MoodStage, MoodDial, LoadingStage, PlayerStage
lib/
  config.js
  audiusClient.js
  serverEnv.js
  supabaseServer.js
supabase/
  schema.sql
```
