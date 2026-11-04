// Criterio único de "pago manual pendiente" (resumen y página de pagos)
export const MANUAL_PAYMENT_PROVIDERS = ["manual", "yappy_manual"];

// Estados temporales: dejan de estar pendientes al vencer expires_at (el cron los expira).
const TEMPORARY_PENDING_STATUSES = ["pending", "claimed", "awaiting_verification"];
// manual_review no vence para el admin: sigue pendiente hasta aprobarlo o rechazarlo
// (admin_resolve_payment_intent lo resuelve sin mirar expires_at).
const REVIEW_STATUS = "manual_review";

// Filtro PostgREST para .or(): manual_review siempre, temporales solo si no vencieron.
export function pendingPaymentsFilter(nowIso: string) {
  return `status.eq.${REVIEW_STATUS},and(status.in.(${TEMPORARY_PENDING_STATUSES.join(",")}),expires_at.gt.${nowIso})`;
}

// Estados ya resueltos que se muestran en el historial reciente
// (CHECK de payment_intents.status: no existe "rejected"; el rechazo queda como "failed")
export const RESOLVED_PAYMENT_STATUSES = ["paid", "failed", "expired", "cancelled"];
