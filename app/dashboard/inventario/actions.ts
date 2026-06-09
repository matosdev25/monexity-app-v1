"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "../../../lib/supabase/server";
import type { Product } from "./types";

export type { Product } from "./types";

type ActionResult = { success: boolean; error?: string };

async function getInventoryContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, userId: null, companyId: null, role: null };

  const cookieStore = await cookies();
  const activeCompanyId = cookieStore.get("active_company_id")?.value ?? null;

  const membershipQuery = supabase
    .from("memberships")
    .select("company_id, role")
    .eq("user_id", user.id);

  const { data: membership } = await (
    activeCompanyId
      ? membershipQuery.eq("company_id", activeCompanyId)
      : membershipQuery.limit(1)
  ).maybeSingle();

  return {
    supabase,
    userId: user.id,
    companyId: membership?.company_id ?? null,
    role: String(membership?.role ?? "").toLowerCase(),
  };
}

const ALLOWED_ROLES = new Set(["owner", "admin"]);

// ── SKU generation ───────────────────────────────────────────────

async function generateUniqueSku(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
  name: string
): Promise<string> {
  const base = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 3)
    .padEnd(3, "X");

  const { data } = await supabase
    .from("products")
    .select("sku")
    .eq("company_id", companyId)
    .ilike("sku", `${base}-%`);

  const used = new Set(
    (data ?? [])
      .map((r: { sku: string | null }) => {
        const parts = (r.sku ?? "").toUpperCase().split("-");
        return parts.length === 2 ? Number(parts[1]) : NaN;
      })
      .filter((n: number) => Number.isFinite(n))
  );

  let n = 1;
  while (used.has(n) && n <= 9999) n++;
  return `${base}-${String(n).padStart(3, "0")}`;
}

/** Llamado desde el cliente para previsualizar el SKU antes de guardar */
export async function generateSkuAction(
  companyId: string,
  name: string
): Promise<string> {
  const supabase = await createClient();
  return generateUniqueSku(supabase, companyId, name.trim() || "PRD");
}

export async function fetchProducts(companyId: string): Promise<Product[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("id, company_id, name, sku, price, track_inventory, stock, min_stock, is_active, sort_order, created_at")
    .eq("company_id", companyId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  return (data ?? []) as Product[];
}

export async function fetchActiveProducts(companyId: string): Promise<Product[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("id, company_id, name, sku, price, track_inventory, stock, min_stock, is_active, sort_order, created_at")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  return (data ?? []) as Product[];
}

export async function createProduct(formData: FormData): Promise<ActionResult> {
  const ctx = await getInventoryContext();
  if (!ctx.companyId || !ALLOWED_ROLES.has(ctx.role ?? ""))
    return { success: false, error: "Sin permisos." };

  const name = String(formData.get("name") ?? "").trim();
  const skuRaw = String(formData.get("sku") ?? "").trim();
  const price = Number(String(formData.get("price") ?? "0").replace(/,/g, ""));
  const trackInventory = formData.get("track_inventory") === "true";
  const stock = Number(String(formData.get("stock") ?? "0").replace(/,/g, ""));
  const minStockRaw = String(formData.get("min_stock") ?? "").trim();
  const minStock = minStockRaw ? Number(minStockRaw) : null;

  if (!name) return { success: false, error: "El nombre es requerido." };
  if (!Number.isFinite(price) || price < 0)
    return { success: false, error: "El precio no es válido." };
  if (!Number.isFinite(stock) || stock < 0)
    return { success: false, error: "El stock no es válido." };

  // Auto-generar SKU si el usuario lo dejó vacío
  const sku = skuRaw || (await generateUniqueSku(ctx.supabase, ctx.companyId, name));

  const { data: last } = await ctx.supabase
    .from("products")
    .select("sort_order")
    .eq("company_id", ctx.companyId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await ctx.supabase.from("products").insert({
    company_id: ctx.companyId,
    name,
    sku,
    price,
    track_inventory: trackInventory,
    stock: trackInventory ? stock : 0,
    min_stock: trackInventory ? minStock : null,
    is_active: true,
    sort_order: (last?.sort_order ?? -1) + 1,
  });

  if (error) {
    if (error.code === "23505")
      return { success: false, error: "Ya existe un producto con ese SKU en este negocio." };
    return { success: false, error: error.message };
  }
  revalidatePath("/dashboard/inventario");
  return { success: true };
}

export async function updateProduct(formData: FormData): Promise<ActionResult> {
  const ctx = await getInventoryContext();
  if (!ctx.companyId || !ALLOWED_ROLES.has(ctx.role ?? ""))
    return { success: false, error: "Sin permisos." };

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const skuRaw = String(formData.get("sku") ?? "").trim();
  const sku = skuRaw || null;
  const price = Number(String(formData.get("price") ?? "0").replace(/,/g, ""));
  const trackInventory = formData.get("track_inventory") === "true";
  const stock = Number(String(formData.get("stock") ?? "0").replace(/,/g, ""));
  const minStockRaw = String(formData.get("min_stock") ?? "").trim();
  const minStock = minStockRaw ? Number(minStockRaw) : null;

  if (!id) return { success: false, error: "Producto no encontrado." };
  if (!name) return { success: false, error: "El nombre es requerido." };
  if (!Number.isFinite(price) || price < 0)
    return { success: false, error: "El precio no es válido." };

  const { error } = await ctx.supabase
    .from("products")
    .update({
      name,
      sku,
      price,
      track_inventory: trackInventory,
      stock: trackInventory ? stock : 0,
      min_stock: trackInventory ? minStock : null,
    })
    .eq("id", id)
    .eq("company_id", ctx.companyId);

  if (error) {
    if (error.code === "23505")
      return { success: false, error: "Ya existe un producto con ese SKU en este negocio." };
    return { success: false, error: error.message };
  }
  revalidatePath("/dashboard/inventario");
  return { success: true };
}

export async function toggleProductActive(formData: FormData): Promise<void> {
  const ctx = await getInventoryContext();
  if (!ctx.companyId || !ALLOWED_ROLES.has(ctx.role ?? "")) return;

  const id = String(formData.get("id") ?? "");

  const { data: current } = await ctx.supabase
    .from("products")
    .select("is_active")
    .eq("id", id)
    .eq("company_id", ctx.companyId)
    .maybeSingle();

  if (!current) return;

  await ctx.supabase
    .from("products")
    .update({ is_active: !current.is_active })
    .eq("id", id)
    .eq("company_id", ctx.companyId);

  revalidatePath("/dashboard/inventario");
}

export async function adjustStock(formData: FormData): Promise<ActionResult> {
  const ctx = await getInventoryContext();
  if (!ctx.companyId || !ALLOWED_ROLES.has(ctx.role ?? ""))
    return { success: false, error: "Sin permisos." };

  const id = String(formData.get("id") ?? "");
  const delta = Number(String(formData.get("delta") ?? "0").replace(/,/g, ""));

  if (!id) return { success: false, error: "Producto no encontrado." };
  if (!Number.isFinite(delta))
    return { success: false, error: "Ajuste inválido." };

  const { data: current } = await ctx.supabase
    .from("products")
    .select("stock")
    .eq("id", id)
    .eq("company_id", ctx.companyId)
    .maybeSingle();

  if (!current) return { success: false, error: "Producto no encontrado." };

  const newStock = Math.max(0, Number(current.stock ?? 0) + delta);

  const { error } = await ctx.supabase
    .from("products")
    .update({ stock: newStock })
    .eq("id", id)
    .eq("company_id", ctx.companyId);

  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/inventario");
  return { success: true };
}

export async function deleteProduct(formData: FormData): Promise<void> {
  const ctx = await getInventoryContext();
  if (!ctx.companyId || !ALLOWED_ROLES.has(ctx.role ?? "")) return;

  const id = String(formData.get("id") ?? "");
  await ctx.supabase
    .from("products")
    .delete()
    .eq("id", id)
    .eq("company_id", ctx.companyId);

  revalidatePath("/dashboard/inventario");
}
