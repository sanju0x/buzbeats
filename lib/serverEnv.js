const OPTIONAL_KEYS = [
  "GEMINI_API_KEY",
  "GEMINI_MODEL",
  "GOOGLE_API_KEY",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "NEXTAUTH_SECRET",
  "NEXTAUTH_URL",
  "AUDIUS_APP_NAME",
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
    hasGemini: Boolean(env.GEMINI_API_KEY || env.GOOGLE_API_KEY || env.GOOGLE_GENERATIVE_AI_API_KEY),
    hasGoogleAuth: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.NEXTAUTH_SECRET),
    hasAudius: true,
    hasSupabase: Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY),
  };
}
