"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "../../../lib/supabase/server";
import { createAdminClient } from "../../../lib/supabase/admin";
import { PENDING_SIGNUP_DELETE_OPTIONS } from "../../../lib/auth/pending-signup";
import { DELETE_ACCOUNT_CONFIRMATION } from "./delete-account-constants";

export type DeleteAccountState = {
  success: boolean;
  message: string;
};

const STORAGE_BUCKET = "company-assets";
// Cobros en curso: puede haber dinero en movimiento; no se elimina la empresa.
// "pending" bloquea mientras no haya expirado (ver deleteAccount).
const IN_FLIGHT_INTENT_STATUSES = ["claimed", "awaiting_verification", "manual_review"];
const PENDING_INTENT_STATUS = "pending";
// Única situación de suscripción que permite eliminar: cancelación confirmada.
// Cualquier otro estado (incl. unknown o cancel_requested) podría seguir cobrando
// en el proveedor; debe verificarse/cancelarse allí primero.
const CONFIRMED_CANCELLED_SUBSCRIPTION_STATUS = "cancelled";

type AdminClient = ReturnType<typeof createAdminClient>;

function fail(message: string): DeleteAccountState {
  return { success: false, message };
}

// Verifica la contraseña actual con un cliente aislado (no toca la sesión del navegador).
async function verifyPassword(email: string, password: string, expectedUserId: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return false;

  const client = createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || data.user?.id !== expectedUserId) return false;
  await client.auth.signOut().catch(() => undefined);
  return true;
}

// Lista recursivamente todos los archivos bajo un prefijo de Storage.
async function listStoragePaths(admin: AdminClient, prefix: string): Promise<string[]> {
  const paths: string[] = [];
  const pageSize = 1000;
  let offset = 0;

  for (;;) {
    const { data, error } = await admin.storage
      .from(STORAGE_BUCKET)
      .list(prefix, { limit: pageSize, offset });
    if (error) throw new Error("storage_list_failed");
    if (!data || data.length === 0) break;

    for (const entry of data) {
      const fullPath = `${prefix}/${entry.name}`;
      // Las carpetas no tienen id ni metadata
      if (entry.id === null) {
        paths.push(...(await listStoragePaths(admin, fullPath)));
      } else {
        paths.push(fullPath);
      }
    }

    if (data.length < pageSize) break;
    offset += pageSize;
  }

  return paths;
}

// Borra logo, comprobantes, PDFs y cualquier archivo bajo companies/{companyId}/.
async function removeCompanyFiles(admin: AdminClient, companyId: string) {
  const paths = await listStoragePaths(admin, `companies/${companyId}`);
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await admin.storage.from(STORAGE_BUCKET).remove(paths.slice(i, i + 100));
    if (error) throw new Error("storage_remove_failed");
  }
}

// Conserva un registro mínimo (sin empresa ni usuario) de los cobros pagados a
// Monexity, libera slots y descuentos reservados y vacía los metadatos de auditoría.
// La empresa (y sus payment_intents) se borra después.
async function retainBillingRecords(admin: AdminClient, companyId: string) {
  const { data: intents, error } = await admin
    .from("payment_intents")
    .select("id, status, provider, provider_transaction_id, plan_id, billing_cycle, exact_amount, currency, verified_at, period_start, period_end, discount_reserved_at, discount_released_at")
    .eq("company_id", companyId);
  if (error) throw new Error("intents_lookup_failed");

  const allIds = (intents ?? []).map((intent) => intent.id as string);

  // payment_amount_slots.reserved_by no tiene FK: sin esto el slot queda ocupado para siempre.
  if (allIds.length > 0) {
    const { error: slotError } = await admin
      .from("payment_amount_slots")
      .update({ reserved_by: null, reserved_at: null, slot_expires_at: null })
      .in("reserved_by", allIds);
    if (slotError) throw new Error("slot_release_failed");
  }

  // Descuentos reservados por intents no pagados vuelven a estar disponibles.
  for (const intent of intents ?? []) {
    if (intent.status === "paid" || !intent.discount_reserved_at || intent.discount_released_at) continue;
    const { error: discountError } = await admin.rpc("release_intent_discount", { p_intent_id: intent.id });
    if (discountError) throw new Error("discount_release_failed");
  }

  const paid = (intents ?? []).filter((intent) => intent.status === "paid");
  if (paid.length > 0) {
    const { error: retainError } = await admin.from("billing_retained_charges").upsert(
      paid.map((intent) => ({
        source_intent_id: intent.id,
        provider: intent.provider,
        provider_transaction_id: intent.provider_transaction_id ?? null,
        plan_id: intent.plan_id ?? null,
        billing_cycle: intent.billing_cycle ?? null,
        amount: intent.exact_amount,
        currency: intent.currency ?? "USD",
        // Momento de confirmación del cobro
        paid_at: intent.verified_at ?? null,
        period_start: intent.period_start ?? null,
        period_end: intent.period_end ?? null,
        // retain_until (paid_at/retained_at + 7 años) lo fija un trigger en la base.
      })),
      { onConflict: "source_intent_id", ignoreDuplicates: true }
    );
    if (retainError) throw new Error("billing_retention_failed");
  }

  if (allIds.length > 0) {
    const { error: auditError } = await admin
      .from("payment_audit_logs")
      .update({ metadata: {} })
      .in("intent_id", allIds);
    if (auditError) throw new Error("audit_anonymize_failed");
  }
}

// La autoría en empresas ajenas la anonimiza la base (FK ON DELETE SET NULL,
// migración account_deletion_author_set_null). discount_codes.created_by no tiene
// FK y se limpia aquí.
async function anonymizeAuthorship(admin: AdminClient, userId: string) {
  const { error } = await admin.from("discount_codes").update({ created_by: null }).eq("created_by", userId);
  if (error) throw new Error("anonymize_discount_codes_failed");
}

// Anula owner/owner_id de los objetos del usuario (sin borrarlos) y verifica que
// no quede ninguno a su nombre antes de eliminarlo de Auth.
async function releaseStorageOwnership(admin: AdminClient, userId: string) {
  const { error: releaseError } = await admin.rpc("release_user_storage_ownership", { p_user_id: userId });
  if (releaseError) throw new Error("storage_ownership_release_failed");

  const { data: remaining, error: countError } = await admin.rpc("count_user_storage_objects", {
    p_user_id: userId,
  });
  if (countError || remaining !== 0) throw new Error("storage_ownership_remaining");
}

export async function deleteAccount(
  prevState: DeleteAccountState,
  formData: FormData
): Promise<DeleteAccountState> {
  void prevState;

  // 1. Sesión válida (identidad solo desde el servidor)
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user?.email) {
    return fail("Debes iniciar sesión para eliminar tu cuenta.");
  }

  // 2. Confirmación textual y contraseña actual
  const confirmation = String(formData.get("confirmation") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (confirmation !== DELETE_ACCOUNT_CONFIRMATION) {
    return fail(`Escribe ${DELETE_ACCOUNT_CONFIRMATION} para confirmar.`);
  }
  if (!password) return fail("Ingresa tu contraseña actual.");
  if (!(await verifyPassword(user.email, password, user.id))) {
    return fail("La contraseña no es correcta.");
  }

  const admin = createAdminClient();

  // 3. Empresas propias: owner_user_id es la autoridad (cascada en la base) y
  //    debe coincidir con una membresía owner del mismo usuario.
  const [{ data: ownedCompanies, error: ownedError }, { data: memberships, error: membershipsError }] =
    await Promise.all([
      admin.from("companies").select("id").eq("owner_user_id", user.id),
      admin.from("memberships").select("company_id, role").eq("user_id", user.id),
    ]);
  if (ownedError || membershipsError) return fail("No se pudo verificar tu cuenta. Intenta nuevamente.");

  const ownedIds = (ownedCompanies ?? []).map((company) => company.id as string);
  const ownerMembershipIds = new Set(
    (memberships ?? [])
      .filter((membership) => String(membership.role ?? "").toLowerCase() === "owner")
      .map((membership) => membership.company_id as string)
  );
  if (ownedIds.some((id) => !ownerMembershipIds.has(id))) {
    return fail("No pudimos verificar la titularidad de tu negocio. Escríbenos para revisarlo.");
  }
  const foreignCompanyIds = (memberships ?? [])
    .map((membership) => membership.company_id as string)
    .filter((id) => !ownedIds.includes(id));

  // 4. Bloqueos que harían daño a terceros o perderían dinero en movimiento
  if (ownedIds.length > 0) {
    const nowIso = new Date().toISOString();
    const [members, inFlight, activePending, subscriptions] = await Promise.all([
      admin.from("memberships").select("id", { count: "exact", head: true })
        .in("company_id", ownedIds).neq("user_id", user.id),
      admin.from("payment_intents").select("id", { count: "exact", head: true })
        .in("company_id", ownedIds).in("status", IN_FLIGHT_INTENT_STATUSES),
      // Pendiente sin expirar: el cliente aún puede pagar con ese monto/slot.
      admin.from("payment_intents").select("id", { count: "exact", head: true })
        .in("company_id", ownedIds).eq("status", PENDING_INTENT_STATUS)
        .or(`expires_at.is.null,expires_at.gt.${nowIso}`),
      admin.from("billing_subscriptions").select("id", { count: "exact", head: true })
        .in("company_id", ownedIds).neq("status", CONFIRMED_CANCELLED_SUBSCRIPTION_STATUS),
    ]);
    // Fail-closed: si no se puede verificar, no se elimina nada
    if (members.error || inFlight.error || activePending.error || subscriptions.error ||
        members.count === null || inFlight.count === null || activePending.count === null ||
        subscriptions.count === null) {
      return fail("No se pudo verificar tu cuenta. Intenta nuevamente.");
    }
    if (members.count > 0) {
      return fail("Tu negocio tiene otros miembros. Elimínalos del equipo antes de eliminar tu cuenta.");
    }
    if (inFlight.count > 0) {
      return fail("Tienes un pago en revisión. Espera a que se resuelva antes de eliminar tu cuenta.");
    }
    if (activePending.count > 0) {
      return fail("Tienes un pago iniciado sin completar. Espera a que expire o complétalo antes de eliminar tu cuenta.");
    }
    if (subscriptions.count > 0) {
      return fail("Tienes una suscripción con cobro automático sin cancelación confirmada. Escríbenos para cancelarla primero.");
    }
  }

  if (foreignCompanyIds.length > 0) {
    // Mientras sales/expenses/exports borren en cascada (o bloqueen), eliminar a un
    // miembro destruiría datos de empresas ajenas: solo se permite si no hay autoría.
    const { data: fksReady, error: fksError } = await admin.rpc("account_deletion_author_fks_ready");
    if (fksError) return fail("No se pudo verificar tu cuenta. Intenta nuevamente.");
    if (fksReady !== true) {
      const authored = await Promise.all([
        admin.from("sales").select("id", { count: "exact", head: true })
          .eq("created_by", user.id).in("company_id", foreignCompanyIds),
        admin.from("expenses").select("id", { count: "exact", head: true })
          .eq("created_by", user.id).in("company_id", foreignCompanyIds),
        admin.from("period_closure_exports").select("id", { count: "exact", head: true })
          .eq("generated_by", user.id).in("company_id", foreignCompanyIds),
      ]);
      if (authored.some((result) => result.error || result.count === null)) {
        return fail("No se pudo verificar tu cuenta. Intenta nuevamente.");
      }
      if (authored.reduce((sum, result) => sum + (result.count ?? 0), 0) > 0) {
        return fail(
          "Registraste ventas o gastos en otro negocio. Para no borrar sus datos, escríbenos y procesaremos tu solicitud."
        );
      }
    }
  }

  // 5. Solicitud trazable y reanudable: si un intento anterior quedó a medias se
  //    retoma esa misma solicitud. Todas las etapas son idempotentes (repetirlas no
  //    duplica ni pierde nada) y avanzan sobre lo que aún existe.
  const { data: unfinished, error: unfinishedError } = await admin
    .from("account_deletion_requests")
    .select("id, owned_company_ids, step")
    .eq("user_id", user.id)
    .in("status", ["processing", "failed"])
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (unfinishedError) return fail("No se pudo verificar tu cuenta. Intenta nuevamente.");

  let request: { id: string } | null = null;
  if (unfinished) {
    const recorded = (unfinished.owned_company_ids ?? []) as string[];
    const { error: resumeError } = await admin
      .from("account_deletion_requests")
      .update({
        status: "processing",
        error: null,
        step: `resumed:${unfinished.step ?? "started"}`,
        owned_company_ids: Array.from(new Set([...recorded, ...ownedIds])),
        updated_at: new Date().toISOString(),
      })
      .eq("id", unfinished.id);
    if (resumeError) return fail("No se pudo retomar la eliminación. Intenta nuevamente.");
    request = { id: unfinished.id as string };
  } else {
    const { data: created, error: requestError } = await admin
      .from("account_deletion_requests")
      .insert({ user_id: user.id, status: "processing", owned_company_ids: ownedIds, step: "started" })
      .select("id")
      .single();
    if (requestError || !created) return fail("No se pudo iniciar la eliminación. Intenta nuevamente.");
    request = { id: created.id as string };
  }
  const requestId = request.id;

  // Un intento anterior inconcluso pudo haber eliminado datos ya: se trata como parcial.
  let destructiveStarted = Boolean(unfinished);

  const setStep = (step: string) =>
    admin
      .from("account_deletion_requests")
      .update({ step, updated_at: new Date().toISOString() })
      .eq("id", requestId);

  try {
    // Orden pensado para que un fallo nunca deje al usuario sin poder reintentar:
    // las empresas (y todos sus datos) NO se borran aquí, sino en cascada y de forma
    // atómica con el usuario en el paso final (companies.owner_user_id ON DELETE CASCADE).
    // Hasta ese paso, el negocio sigue existiendo y la solicitud puede retomarse.

    // 6. Autoría en empresas ajenas (NO ACTION → NULL). No afecta datos propios.
    await setStep("anonymize_authorship");
    await anonymizeAuthorship(admin, user.id);

    // 7. Archivos que subió en negocios ajenos: pertenecen a esos negocios y no se
    //    borran; solo se libera la propiedad (Auth no elimina usuarios dueños de objetos).
    await setStep("storage_ownership");
    await releaseStorageOwnership(admin, user.id);

    // 8. Empresas propias: registros mínimos de cobro → archivos (idempotentes)
    for (const companyId of ownedIds) {
      await setStep(`retain_billing:${companyId}`);
      // Desde aquí hay cambios irreversibles (metadatos de auditoría, archivos)
      destructiveStarted = true;
      await retainBillingRecords(admin, companyId);

      await setStep(`storage:${companyId}`);
      await removeCompanyFiles(admin, companyId);
    }

    // 9. Usuario: una sola operación que elimina en cascada sus empresas (con ventas,
    //    gastos, cotizaciones, intents…), perfil, membresías, aceptaciones y sesiones.
    await setStep("auth_user");
    const { error: deleteUserError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteUserError) throw new Error("auth_delete_failed");

    // Usuario ya eliminado: la solicitud y los intentos fallidos previos quedan
    // anónimos (solo estado y fechas). Un fallo aquí no revierte la eliminación.
    const completedAt = new Date().toISOString();
    // step puede contener ids de empresa (p. ej. "storage:<uuid>").
    await admin
      .from("account_deletion_requests")
      .update({ user_id: null, owned_company_ids: [], error: null, step: null, updated_at: completedAt })
      .eq("user_id", user.id);
    await admin
      .from("account_deletion_requests")
      .update({ status: "completed", step: "done", completed_at: completedAt })
      .eq("id", requestId);
  } catch (error) {
    // La solicitud queda "failed" con su última etapa: el próximo intento la retoma.
    await admin
      .from("account_deletion_requests")
      .update({
        status: "failed",
        error: error instanceof Error ? error.message : "unknown",
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    if (destructiveStarted) {
      return fail(
        "La eliminación quedó incompleta: parte de tus datos ya se eliminó. Confirma de nuevo con tu contraseña para terminarla; el proceso continuará donde se quedó."
      );
    }
    return fail("No se pudo completar la eliminación. No se eliminó ningún dato. Intenta nuevamente o escríbenos.");
  }

  // 10. Cierre de sesión y cookies propias
  try {
    await supabase.auth.signOut();
  } catch {
    // La sesión ya no existe tras borrar el usuario.
  }
  const cookieStore = await cookies();
  cookieStore.delete("active_company_id");
  cookieStore.delete(PENDING_SIGNUP_DELETE_OPTIONS);

  redirect("/?cuenta=eliminada");
}
