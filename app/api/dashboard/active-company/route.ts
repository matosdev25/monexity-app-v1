import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/auth/login", req.url));
  }

  const companyId = req.nextUrl.searchParams.get("cid")?.trim() ?? "";
  const requestedNext = req.nextUrl.searchParams.get("next") ?? "/dashboard";
  const next = requestedNext.startsWith("/dashboard") ? requestedNext : "/dashboard";

  if (!companyId) {
    return NextResponse.redirect(new URL("/onboarding", req.url));
  }

  const { data: membership } = await supabase
    .from("memberships")
    .select("company_id")
    .eq("user_id", user.id)
    .eq("company_id", companyId)
    .maybeSingle();

  if (!membership?.company_id) {
    return NextResponse.redirect(new URL("/onboarding", req.url));
  }

  const response = NextResponse.redirect(new URL(next, req.url));
  response.cookies.set("active_company_id", companyId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
