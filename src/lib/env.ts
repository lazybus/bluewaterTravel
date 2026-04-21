function readRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function readEnvWithFallback(preferredName: string, legacyName: string) {
  return process.env[preferredName] ?? process.env[legacyName] ?? null;
}

function readRequiredEnvWithFallback(preferredName: string, legacyName: string) {
  const value = readEnvWithFallback(preferredName, legacyName);

  if (!value) {
    throw new Error(
      `Missing required environment variable: ${preferredName} (or legacy ${legacyName})`,
    );
  }

  return value;
}

export function getSupabaseBrowserEnv() {
  return {
    url: readRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    publishableKey: readRequiredEnvWithFallback(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    ),
  };
}

export function getSupabaseSecretKey() {
  return readRequiredEnvWithFallback(
    "SUPABASE_SECRET_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  );
}