type SupabaseLike = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        order: (
          column: string,
          options: { ascending: boolean }
        ) => {
          limit: (count: number) => Promise<{
            data: Array<Record<string, string | null>> | null;
            error: { message?: string } | null;
          }>;
        };
      };
    };
  };
};

const DOCUMENT_LIMIT = 1000;

export function getCompanyDocumentCode(companyName: string | null | undefined) {
  const normalized = String(companyName ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

  return (normalized || "MON").slice(0, 3).padEnd(3, "X");
}

export function formatDocumentNumber(
  prefix: "FAC" | "COT" | "GAS",
  companyName: string | null | undefined,
  sequence: number
) {
  return `${prefix}-${getCompanyDocumentCode(companyName)}-${String(sequence).padStart(4, "0")}`;
}

export function getDocumentSequence(value: string | null | undefined) {
  const match = String(value ?? "").match(/^[A-Z]{3}-[A-Z0-9]{3}-(\d{4,})$/);
  return match ? Number(match[1]) : 0;
}

export async function getNextDocumentNumber(params: {
  supabase: unknown;
  table: "sales" | "quotations" | "expenses";
  column: "invoice_number" | "quotation_number" | "expense_number";
  companyId: string;
  companyName: string | null | undefined;
  prefix: "FAC" | "COT" | "GAS";
  offset?: number;
}) {
  const { supabase, table, column, companyId, companyName, prefix, offset = 0 } = params;
  const supabaseClient = supabase as SupabaseLike;
  const { data, error } = await supabaseClient
    .from(table)
    .select(column)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(DOCUMENT_LIMIT);

  if (error) {
    throw new Error("document_number_lookup_failed");
  }

  const maxSequence = (data ?? []).reduce((max, row) => {
    return Math.max(max, getDocumentSequence(row[column]));
  }, 0);

  return formatDocumentNumber(prefix, companyName, maxSequence + 1 + offset);
}

export function isDuplicateDocumentNumberError(error: { code?: string; message?: string } | null) {
  const message = String(error?.message ?? "").toLowerCase();
  return error?.code === "23505" || message.includes("duplicate key");
}
