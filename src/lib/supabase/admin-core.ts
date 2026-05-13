import { createClient } from "@supabase/supabase-js";

function requiredEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function createAdminSupabaseClient() {
  if (typeof window !== "undefined") {
    throw new Error(
      "createAdminSupabaseClient must only be used on the server. Do not import the Supabase admin client into browser/client code.",
    );
  }

  const supabaseUrl = requiredEnv(
    "NEXT_PUBLIC_SUPABASE_URL",
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  );

  const adminKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;

  if (!adminKey) {
    console.error("[supabase:admin] env present", {
      NEXT_PUBLIC_SUPABASE_URL: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      SUPABASE_SECRET_KEY: Boolean(process.env.SUPABASE_SECRET_KEY),
    });

    throw new Error(
      "Missing Supabase admin environment variable: SUPABASE_SERVICE_ROLE_KEY and/or SUPABASE_SECRET_KEY.",
    );
  }

  return createClient(supabaseUrl, adminKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
