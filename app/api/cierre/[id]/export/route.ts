import { createClient } from "../../../../../lib/supabase/server";
import { formatDateTime, formatLongDate, formatShortDate } from "../../../../../lib/date-format";
import { formatCurrency } from "../../../../../lib/currency-format";
import type { PeriodClosure, ClosureIssue } from "../../../../dashboard/cierre/types";

// ─── CSV helper ───────────────────────────────────────────────────────────────

function toCsv(headers: string[], rows: (string | number | null)[][]): string {
  const esc = (v: string | number | null): string => {
    const s = v == null ? "" : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  return [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\r\n");
}

function fmtMoney(v: string | number | null) {
  return formatCurrency(v);
}

// ─── PDF HTML template ────────────────────────────────────────────────────────

function buildPdfHtml(
  closure: PeriodClosure,
  companyName: string,
  issues: ClosureIssue[]
): string {
  const snap = closure.snapshot;
  const fmt = (v: number) => formatCurrency(v);
  const fmtDate = (iso: string) => formatLongDate(iso);

  const statusLabel: Record<string, string> = {
    draft: "Borrador",
    in_review: "En revisión",
    has_issues: "Con pendientes",
    ready_for_accountant: "Listo para contador",
    closed: "Período cerrado",
  };

  const activeIssues = issues.filter(
    (i) => !i.resolved_at && !i.ignored_at
  );

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Cierre del período — ${companyName}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;color:#0f172a;background:#fff;padding:32px 40px;max-width:820px;margin:0 auto}
    .print-bar{background:#f0f7ff;border:1px solid #bae0fd;border-radius:10px;padding:10px 16px;margin-bottom:24px;display:flex;align-items:center;justify-content:space-between;gap:12px}
    .print-bar p{font-size:12px;color:#0369a1}
    .print-bar button{background:#0284c7;color:#fff;border:none;padding:6px 14px;border-radius:8px;font-size:12px;cursor:pointer}
    h1{font-size:22px;font-weight:700;letter-spacing:-0.4px;margin-bottom:4px}
    h2{font-size:14px;font-weight:600;letter-spacing:-0.2px;margin:20px 0 8px}
    .meta{font-size:12px;color:#64748b;margin-bottom:4px}
    .chip{display:inline-block;padding:2px 10px;border-radius:999px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;border:1px solid #e2e8f0;background:#f8fafc;color:#475569}
    .chip.ready{border-color:#a7f3d0;background:#ecfdf5;color:#065f46}
    .chip.closed{border-color:#ddd6fe;background:#f5f3ff;color:#4c1d95}
    .chip.issues{border-color:#fde68a;background:#fffbeb;color:#92400e}
    .divider{height:1px;background:#e2e8f0;margin:16px 0}
    .kpis{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin:12px 0}
    .kpi{border:1px solid #e2e8f0;border-radius:10px;padding:12px 16px}
    .kpi-label{font-size:10px;text-transform:uppercase;letter-spacing:0.14em;color:#94a3b8;margin-bottom:4px}
    .kpi-value{font-size:18px;font-weight:700;letter-spacing:-0.3px}
    .kpi-value.green{color:#059669}
    .kpi-value.red{color:#dc2626}
    .kpi-value.amber{color:#d97706}
    .kpi-sub{font-size:11px;color:#94a3b8;margin-top:2px}
    table{width:100%;border-collapse:collapse;font-size:12px;margin-top:6px}
    th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.12em;color:#94a3b8;padding:6px 10px 6px 0;border-bottom:1px solid #e2e8f0}
    td{padding:6px 10px 6px 0;border-bottom:1px solid #f1f5f9;color:#334155}
    tr:last-child td{border-bottom:none}
    .issue-error{background:#fff1f2;border-left:3px solid #f43f5e;padding:8px 10px;border-radius:6px;margin-bottom:6px}
    .issue-warning{background:#fffbeb;border-left:3px solid #f59e0b;padding:8px 10px;border-radius:6px;margin-bottom:6px}
    .issue-msg{font-size:12px;color:#1e293b}
    .issue-code{font-size:10px;color:#94a3b8;text-transform:uppercase;margin-bottom:2px}
    .footer{margin-top:32px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8;text-align:center}
    @media print{.print-bar{display:none!important}body{padding:20px}@page{margin:1.5cm}}
  </style>
</head>
<body>
  <div class="print-bar">
    <p>Para guardar como PDF: <strong>Archivo → Imprimir (⌘P) → Guardar como PDF</strong></p>
    <button onclick="window.print()">Imprimir / Guardar PDF</button>
  </div>

  <p class="meta">Monexity · ${companyName}</p>
  <h1>${closure.label ?? `Cierre del período`}</h1>
  <p class="meta">${fmtDate(closure.period_start)} → ${fmtDate(closure.period_end)} · ${closure.period_months} meses</p>
  <div style="margin-top:8px">
    <span class="chip ${closure.status === "ready_for_accountant" ? "ready" : closure.status === "closed" ? "closed" : closure.status === "has_issues" ? "issues" : ""}">
      ${statusLabel[closure.status] ?? closure.status}
    </span>
  </div>

  <div class="divider"></div>

  ${
    snap
      ? `<h2>Resumen financiero</h2>
  <div class="kpis">
    <div class="kpi">
      <div class="kpi-label">Total ventas</div>
      <div class="kpi-value">${fmt(snap.totals.sales)}</div>
      <div class="kpi-sub">${snap.counts.sales_total} transacciones · ${snap.counts.sales_paid} cobradas</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Total gastos</div>
      <div class="kpi-value red">${fmt(snap.totals.expenses)}</div>
      <div class="kpi-sub">${snap.counts.expenses_total} registros</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Resultado neto</div>
      <div class="kpi-value ${snap.totals.net >= 0 ? "green" : "red"}">${fmt(snap.totals.net)}</div>
      <div class="kpi-sub">${snap.totals.net >= 0 ? "Superávit" : "Déficit"}</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Cuentas por cobrar abiertas</div>
      <div class="kpi-value amber">${fmt(snap.totals.receivables_open)}</div>
      <div class="kpi-sub">${snap.counts.sales_pending} venta(s) con saldo pendiente</div>
    </div>
  </div>`
      : `<p class="meta">Sin datos de resumen — el período no ha sido validado.</p>`
  }

  ${
    activeIssues.length > 0
      ? `<div class="divider"></div>
  <h2>Pendientes (${activeIssues.length})</h2>
  ${activeIssues
    .map(
      (i) => `<div class="issue-${i.severity}">
    <div class="issue-code">${i.category} · ${i.code}</div>
    <div class="issue-msg">${i.message}</div>
  </div>`
    )
    .join("")}`
      : ""
  }

  ${closure.notes ? `<div class="divider"></div><h2>Notas</h2><p style="font-size:12px;color:#334155">${closure.notes}</p>` : ""}

  <div class="footer">
    <p>Generado con Monexity · ${formatShortDate(new Date())}</p>
    <p style="margin-top:4px">Este documento es un resumen operativo interno. No constituye una declaración fiscal oficial.</p>
  </div>
</body>
</html>`;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") ?? "";

  const validTypes = [
    "pdf_summary",
    "csv_sales",
    "csv_expenses",
    "csv_receivables",
    "csv_inventory",
    "csv_issues",
  ];
  if (!validTypes.includes(type)) {
    return new Response("Tipo de exportable no válido.", { status: 400 });
  }

  // Auth
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("No autorizado.", { status: 401 });

  // Membership
  const { data: membership } = await supabase
    .from("memberships")
    .select("company_id, role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership?.company_id)
    return new Response("Sin membresía.", { status: 403 });

  const cid = membership.company_id;

  // Closure
  const { data: closureRaw } = await supabase
    .from("period_closures")
    .select("*")
    .eq("id", id)
    .eq("company_id", cid)
    .maybeSingle();
  if (!closureRaw) return new Response("Cierre no encontrado.", { status: 404 });

  const closure = closureRaw as PeriodClosure;
  const start = closure.period_start;
  const end = closure.period_end;

  // Company name
  const { data: company } = await supabase
    .from("companies")
    .select("name, needs_inventory")
    .eq("id", cid)
    .maybeSingle();
  const companyName = company?.name ?? "Mi negocio";

  let content = "";
  let contentType = "text/plain; charset=utf-8";
  let disposition = "";
  const slug = closure.label
    ? closure.label.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
    : `${start}-${end}`;

  // ── Generate content ───────────────────────────────────────────────────────

  if (type === "pdf_summary") {
    const { data: issuesRaw } = await supabase
      .from("period_closure_issues")
      .select("*")
      .eq("closure_id", id)
      .order("severity", { ascending: true });
    const issues = (issuesRaw ?? []) as ClosureIssue[];

    content = buildPdfHtml(closure, companyName, issues);
    contentType = "text/html; charset=utf-8";
    // No disposition — opens in new tab for print
  }

  if (type === "csv_sales") {
    const { data } = await supabase
      .from("sales")
      .select(
        "sale_date, customer_name, amount, paid_amount, balance_due, payment_status, payment_type, payment_method, invoice_number, note"
      )
      .eq("company_id", cid)
      .gte("sale_date", start)
      .lte("sale_date", end)
      .order("sale_date", { ascending: true });

    const rows = (data ?? []).map((s) => [
      formatShortDate(s.sale_date),
      s.customer_name ?? "",
      fmtMoney(s.amount),
      fmtMoney(s.paid_amount),
      fmtMoney(s.balance_due),
      s.payment_status ?? "",
      s.payment_type ?? "",
      s.payment_method ?? "",
      s.invoice_number ?? "",
      s.note ?? "",
    ]);

    content = toCsv(
      [
        "Fecha",
        "Cliente",
        "Total",
        "Cobrado",
        "Saldo",
        "Estado pago",
        "Tipo pago",
        "Método",
        "# Factura",
        "Nota",
      ],
      rows
    );
    contentType = "text/csv; charset=utf-8";
    disposition = `attachment; filename="ventas-${slug}.csv"`;
  }

  if (type === "csv_expenses") {
    const { data } = await supabase
      .from("expenses")
      .select(
        "expense_date, category, supplier, amount, status, payment_method, note, receipt_url"
      )
      .eq("company_id", cid)
      .gte("expense_date", start)
      .lte("expense_date", end)
      .order("expense_date", { ascending: true });

    const rows = (data ?? []).map((e) => [
      formatShortDate(e.expense_date),
      e.category ?? "",
      e.supplier ?? "",
      fmtMoney(e.amount),
      e.status ?? "",
      e.payment_method ?? "",
      e.note ?? "",
      e.receipt_url ? "Sí" : "No",
    ]);

    content = toCsv(
      ["Fecha", "Categoría", "Proveedor", "Monto", "Estado", "Método", "Nota", "Comprobante"],
      rows
    );
    contentType = "text/csv; charset=utf-8";
    disposition = `attachment; filename="gastos-${slug}.csv"`;
  }

  if (type === "csv_receivables") {
    const { data } = await supabase
      .from("sales")
      .select(
        "sale_date, customer_name, customer_phone, amount, paid_amount, balance_due, payment_status, payment_type"
      )
      .eq("company_id", cid)
      .gte("sale_date", start)
      .lte("sale_date", end)
      .in("payment_status", ["pending", "partial", "overdue"])
      .order("sale_date", { ascending: true });

    const rows = (data ?? []).map((s) => [
      formatShortDate(s.sale_date),
      s.customer_name ?? "",
      s.customer_phone ?? "",
      fmtMoney(s.amount),
      fmtMoney(s.paid_amount),
      fmtMoney(s.balance_due),
      s.payment_status ?? "",
      s.payment_type ?? "",
    ]);

    content = toCsv(
      ["Fecha", "Cliente", "Teléfono", "Total", "Cobrado", "Saldo", "Estado", "Tipo"],
      rows
    );
    contentType = "text/csv; charset=utf-8";
    disposition = `attachment; filename="cxc-${slug}.csv"`;
  }

  if (type === "csv_issues") {
    const { data } = await supabase
      .from("period_closure_issues")
      .select("severity, category, code, message, resolved_at, ignored_at, created_at")
      .eq("closure_id", id)
      .order("severity", { ascending: true })
      .order("created_at", { ascending: true });

    const rows = (data ?? []).map((i) => [
      i.severity,
      i.category,
      i.code,
      i.message,
      i.resolved_at ? "Resuelto" : i.ignored_at ? "Ignorado" : "Activo",
      formatDateTime(i.created_at),
    ]);

    content = toCsv(
      ["Severidad", "Categoría", "Código", "Mensaje", "Estado", "Fecha"],
      rows
    );
    contentType = "text/csv; charset=utf-8";
    disposition = `attachment; filename="pendientes-${slug}.csv"`;
  }

  if (type === "csv_inventory" && company?.needs_inventory) {
    const { data } = await supabase
      .from("products")
      .select("name, stock, min_stock, price, is_active")
      .eq("company_id", cid)
      .eq("track_inventory", true)
      .order("name", { ascending: true });

    const rows = (data ?? []).map((p) => [
      p.name,
      p.stock,
      p.min_stock ?? "",
      fmtMoney(p.price),
      p.stock < 0 ? "Stock negativo" : p.min_stock != null && p.stock <= p.min_stock ? "Stock bajo" : "Normal",
      p.is_active ? "Activo" : "Inactivo",
    ]);

    content = toCsv(
      ["Producto", "Stock actual", "Stock mínimo", "Precio", "Alerta", "Estado"],
      rows
    );
    contentType = "text/csv; charset=utf-8";
    disposition = `attachment; filename="inventario-${slug}.csv"`;
  } else if (type === "csv_inventory") {
    return new Response("Este negocio no usa inventario.", { status: 400 });
  }

  if (!content) {
    return new Response("No se pudo generar el archivo.", { status: 500 });
  }

  // Log export (best effort)
  await supabase.from("period_closure_exports").insert({
    closure_id: id,
    company_id: cid,
    export_type: type,
    generated_by: user.id,
  });

  const headers: Record<string, string> = {
    "Content-Type": contentType,
  };
  if (disposition) {
    headers["Content-Disposition"] = disposition;
  }

  return new Response(content, { headers });
}
