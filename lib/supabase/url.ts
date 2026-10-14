/**
 * The Supabase project address, reduced to scheme + host. Copying the
 * "REST URL" (…supabase.co/rest/v1/) instead of the project URL is easy to
 * do and would otherwise break every request.
 */
const raw = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

export const SUPABASE_URL = (() => {
  try {
    return new URL(raw.trim()).origin;
  } catch {
    return raw;
  }
})();
