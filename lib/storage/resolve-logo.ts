import { cache } from "react";
import { createAdminClient } from "../supabase/admin";

const LOGO_BUCKET = "company-assets";
const SIGNED_URL_TTL = 3600;

export function isStoragePath(value: string): boolean {
  return !value.startsWith("http://") && !value.startsWith("https://");
}

function extractSupabaseStoragePath(url: string): string | null {
  const match = url.match(/\/storage\/v1\/object\/(?:public|sign(?:ed)?)\/[^/?]+\/(.+?)(?:\?.*)?$/);
  return match?.[1] ?? null;
}

export const resolveLogoUrl = cache(async function resolveLogoUrl(
  logoUrlOrPath: string | null | undefined
): Promise<string | null> {
  if (!logoUrlOrPath) return null;

  let storagePath: string | null = null;

  if (isStoragePath(logoUrlOrPath)) {
    storagePath = logoUrlOrPath;
  } else if (logoUrlOrPath.includes("/storage/v1/object/")) {
    // Old-format Supabase public URL → extract path so we can sign it
    storagePath = extractSupabaseStoragePath(logoUrlOrPath);
    if (!storagePath) return logoUrlOrPath;
  } else {
    // External URL (e.g. user pasted a CDN link) — use as-is
    return logoUrlOrPath;
  }

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(LOGO_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL);

  // If signing fails fall back gracefully: for a relative path there's nothing else
  // to show; for an old public URL return it as-is (bucket may still be public)
  if (error || !data) {
    return isStoragePath(logoUrlOrPath) ? null : logoUrlOrPath;
  }
  return data.signedUrl;
});
