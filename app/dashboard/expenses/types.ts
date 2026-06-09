export type AmountRow = {
  amount: number | string | null;
};

export type ExpenseActionState = {
  success: boolean;
  message: string;
  timestamp?: number;
};

export type Expense = {
  id: string;
  expense_number?: string | null;
  amount: number | string;
  category: string | null;
  note: string | null;
  expense_date: string;
  created_at?: string | null;
  supplier?: string | null;
  payment_method?: string | null;
  status?: string | null;
  receipt_url?: string | null;
  is_recurring?: boolean | null;
  recurring_frequency?: string | null;
};
