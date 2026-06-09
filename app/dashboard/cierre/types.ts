export type ClosureStatus =
  | "draft"
  | "in_review"
  | "has_issues"
  | "ready_for_accountant"
  | "closed";

export type IssueSeverity = "error" | "warning" | "info";
export type IssueCategory =
  | "sales"
  | "expenses"
  | "receivables"
  | "inventory"
  | "documents";

export type ClosureSnapshot = {
  totals: {
    sales: number;
    expenses: number;
    net: number;
    receivables_open: number;
    receivables_collected: number;
  };
  counts: {
    sales_total: number;
    sales_paid: number;
    sales_pending: number;
    expenses_total: number;
    expenses_no_receipt: number;
  };
  generated_at: string;
};

export type PeriodClosure = {
  id: string;
  company_id: string;
  created_by: string;
  period_months: 3 | 6 | 12;
  period_start: string;
  period_end: string;
  label: string | null;
  status: ClosureStatus;
  snapshot: ClosureSnapshot | null;
  closed_at: string | null;
  closed_by: string | null;
  reopen_reason: string | null;
  reopened_at: string | null;
  reopened_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ClosureIssue = {
  id: string;
  closure_id: string;
  company_id: string;
  severity: IssueSeverity;
  category: IssueCategory;
  code: string;
  message: string;
  ref_table: string | null;
  ref_id: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  ignored_at: string | null;
  ignored_by: string | null;
  ignore_reason: string | null;
  created_at: string;
};

export type ClosureExport = {
  id: string;
  closure_id: string;
  company_id: string;
  export_type: string;
  file_url: string | null;
  file_size_bytes: number | null;
  generated_by: string;
  generated_at: string;
};

export type ClosureActionState = {
  success: boolean;
  message: string;
  closureId?: string;
  timestamp?: number;
};
