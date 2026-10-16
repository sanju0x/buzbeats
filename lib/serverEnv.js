const OPTIONAL_KEYS = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "NEXTAUTH_SECRET",
  "NEXTAUTH_URL",
  "LAVALINK_HOST",
  "LAVALINK_URL",
  "LAVALINK_PORT",
  "LAVALINK_PASSWORD",
  "LAVALINK_SECURE",
  "LAVALINK_STREAM_SECRET",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
];

export function serverEnv() {
  return OPTIONAL_KEYS.reduce((env, key) => {
    const value = process.env[key];
    if (typeof value === "string" && value.trim()) {
      env[key] = value.trim();
    }
    return env;
  }, {});
}

export function requireServerEnv(keys) {
  const env = serverEnv();
  const missing = keys.filter((key) => !env[key]);
  if (missing.length) {
    throw new Error(`Missing required server environment keys: ${missing.join(", ")}`);
  }
  return env;
}

export function publicConfigStatus() {
  const env = serverEnv();
  return {
    hasGoogleAuth: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.NEXTAUTH_SECRET),
    hasLavalink: Boolean((env.LAVALINK_URL || env.LAVALINK_HOST) && env.LAVALINK_PASSWORD),
    hasSupabase: Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY),
  };
}
