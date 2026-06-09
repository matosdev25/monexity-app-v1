import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function getAdminEmails() {
  return (process.env.BILLING_ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isGlobalAdminEmail(email: string | null | undefined) {
  if (!email) return false;
  return getAdminEmails().includes(email.trim().toLowerCase());
}

const SPECIAL_ADMIN_EMAIL = "admin@momenxity-app";
export const SPECIAL_ADMIN_RELATED_ID = "62185083-0917-4ea3-b9c7-dcf46ec9bbd7";

export function canEditManualTransactionDates(params: {
  email?: string | null;
  userId?: string | null;
  companyId?: string | null;
  companyOwnerUserId?: string | null;
  hasSpecialAdminMembership?: boolean;
}) {
  const email = params.email?.trim().toLowerCase() ?? "";

  return (
    (email === SPECIAL_ADMIN_EMAIL && isGlobalAdminEmail(email)) ||
    params.userId === SPECIAL_ADMIN_RELATED_ID ||
    params.companyId === SPECIAL_ADMIN_RELATED_ID ||
    params.companyOwnerUserId === SPECIAL_ADMIN_RELATED_ID ||
    params.hasSpecialAdminMembership === true
  );
}

export async function getGlobalAdminUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isGlobalAdminEmail(user.email)) {
    return null;
  }

  return user;
}

export async function requireGlobalAdmin() {
  const user = await getGlobalAdminUser();
  if (!user) redirect("/auth/login");
  return user;
}
