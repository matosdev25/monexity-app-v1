import "server-only";
import { formatCurrency } from "@/lib/currency-format";

const PLAN_LABELS: Record<string, string> = {
  emprende: "Emprende",
  control:  "Control",
  equipo:   "Equipo",
};

export async function sendPaymentClaimEmail({
  to,
  intentId,
  exactAmount,
  planId,
}: {
  to: string;
  intentId: string;
  exactAmount: number;
  planId: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://monexity-app.com";
  const planLabel = PLAN_LABELS[planId] ?? planId;
  const adminUrl = `${appUrl}/admin/billing`;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: "Monexity <admin@monexity-app.com>",
      to: [to],
      subject: `Pago Yappy reclamado — ${formatCurrency(exactAmount)}`,
      html: `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;background:#fff;border-radius:20px;border:1px solid #e2e8f0;padding:32px;">
        <tr><td>
          <p style="margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:0.16em;color:#94a3b8;text-transform:uppercase;">Yappy · Pago pendiente de verificación</p>
          <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#0f172a;">${formatCurrency(exactAmount)} — Plan ${planLabel}</h1>
          <p style="margin:0 0 24px;font-size:15px;color:#64748b;line-height:1.6;">
            Un usuario indicó que ya realizó el pago. Verifica en Yappy que llegó un pago de exactamente
            <strong style="color:#0f172a;">${formatCurrency(exactAmount)}</strong> y confirma desde el panel de admin.
          </p>
          <a href="${adminUrl}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 24px;border-radius:12px;">
            Ir al panel de admin →
          </a>
          <p style="margin:20px 0 0;font-size:12px;color:#94a3b8;">Intent ID: ${intentId}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim(),
    }),
  });
}
