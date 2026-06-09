"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "../../../lib/supabase/server";
import type { CompanyService } from "./types";

export type { CompanyService } from "./types";

const ALLOWED_ROLES = new Set(["owner", "admin"]);

async function getServiceContext(companyId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, authorized: false as const };
  const { data: membership } = await supabase
    .from("memberships")
    .select("role")
    .eq("user_id", user.id)
    .eq("company_id", companyId)
    .maybeSingle();
  const role = String(membership?.role ?? "").toLowerCase();
  return { supabase, user, authorized: ALLOWED_ROLES.has(role) };
}

export async function fetchActiveServices(
  companyId: string
): Promise<CompanyService[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("company_services")
    .select("id, company_id, name, description, base_price, is_active, category, created_at")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("name", { ascending: true });
  return (data ?? []) as CompanyService[];
}

export async function fetchAllServices(
  companyId: string
): Promise<CompanyService[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("company_services")
    .select("id, company_id, name, description, base_price, is_active, category, created_at")
    .eq("company_id", companyId)
    .order("name", { ascending: true });
  return (data ?? []) as CompanyService[];
}

export async function createService(_prev: unknown, formData: FormData) {
  const companyId = String(formData.get("companyId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const rawPrice = String(formData.get("base_price") ?? "").replace(/,/g, "").trim();
  const base_price = rawPrice ? Number(rawPrice) : null;
  const category = String(formData.get("category") ?? "").trim() || null;

  if (!companyId || !name) return { success: false, error: "Datos incompletos." };

  const { supabase, authorized } = await getServiceContext(companyId);
  if (!authorized) return { success: false, error: "Sin permiso." };

  const { error } = await supabase
    .from("company_services")
    .insert({ company_id: companyId, name, description, base_price, category });

  if (error) return { success: false, error: error.message };

  revalidatePath("/dashboard/mi-negocio");
  return { success: true };
}

export async function updateService(_prev: unknown, formData: FormData) {
  const serviceId = String(formData.get("serviceId") ?? "");
  const companyId = String(formData.get("companyId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const rawPrice = String(formData.get("base_price") ?? "").replace(/,/g, "").trim();
  const base_price = rawPrice ? Number(rawPrice) : null;
  const category = String(formData.get("category") ?? "").trim() || null;

  if (!serviceId || !companyId || !name) return { success: false, error: "Datos incompletos." };

  const { supabase, authorized } = await getServiceContext(companyId);
  if (!authorized) return { success: false, error: "Sin permiso." };

  const { error } = await supabase
    .from("company_services")
    .update({ name, description, base_price, category, updated_at: new Date().toISOString() })
    .eq("id", serviceId)
    .eq("company_id", companyId);

  if (error) return { success: false, error: error.message };

  revalidatePath("/dashboard/mi-negocio");
  return { success: true };
}

export async function toggleServiceActive(formData: FormData): Promise<void> {
  const serviceId = String(formData.get("serviceId") ?? "");
  const companyId = String(formData.get("companyId") ?? "");
  const is_active = formData.get("is_active") === "true";

  if (!serviceId || !companyId) return;

  const { supabase, authorized } = await getServiceContext(companyId);
  if (!authorized) return;

  await supabase
    .from("company_services")
    .update({ is_active, updated_at: new Date().toISOString() })
    .eq("id", serviceId)
    .eq("company_id", companyId);

  revalidatePath("/dashboard/mi-negocio");
}

export async function deleteService(formData: FormData): Promise<void> {
  const serviceId = String(formData.get("serviceId") ?? "");
  const companyId = String(formData.get("companyId") ?? "");

  if (!serviceId || !companyId) return;

  const { supabase, authorized } = await getServiceContext(companyId);
  if (!authorized) return;

  await supabase
    .from("company_services")
    .delete()
    .eq("id", serviceId)
    .eq("company_id", companyId);

  revalidatePath("/dashboard/mi-negocio");
}
