export type Nullable<T> = T | null;
export type MoneyValue = number | string | null;

export type ISODateString = string;
export type ISODateTimeString = string;

export type PaymentMethod =
  | "cash"
  | "card"
  | "transfer"
  | "yappy"
  | "other";

export type PaymentType = "full" | "partial" | "installment";

export type InstallmentFrequency = "weekly" | "biweekly" | "monthly";

export type SalePaymentStatus = "paid" | "partial" | "pending" | "overdue";

export type SalePlanStatus = "draft" | "active" | "completed" | "cancelled";

export type Sale = {
  id: string;
  invoice_number: Nullable<string>;
  customer_name: Nullable<string>;
  customer_company: Nullable<string>;
  customer_email: Nullable<string>;
  customer_phone: Nullable<string>;
  amount: MoneyValue;
  discount_amount: MoneyValue;
  paid_amount: MoneyValue;
  balance_due: MoneyValue;
  payment_method: PaymentMethod | string | null;
  payment_type: PaymentType | string | null;
  payment_status: SalePaymentStatus | string | null;
  has_payment_plan: boolean | null;
  note: Nullable<string>;
  invoice_notes: Nullable<string>;
  sale_date: ISODateString;
  payment_date: Nullable<ISODateString>;
  last_payment_at: Nullable<ISODateTimeString>;
  created_at: Nullable<ISODateTimeString>;
  created_by: Nullable<string>;
  company_id: Nullable<string>;
};

export type AmountRow = {
  amount: MoneyValue;
};

export type SaleItem = {
  id: string;
  sale_id: string;
  company_id: string;
  description: string;
  quantity: number;
  unit_price: MoneyValue;
  sort_order: number;
  created_at: Nullable<ISODateTimeString>;
};

export type SalePaymentPlan = {
  id: string;
  sale_id: string;
  company_id: string;
  plan_name: Nullable<string>;
  down_payment_amount: MoneyValue;
  installment_amount: MoneyValue;
  installments_count: number;
  frequency: InstallmentFrequency | string;
  start_date: ISODateString;
  status: SalePlanStatus | string;
  notes: Nullable<string>;
  created_by: Nullable<string>;
  created_at: Nullable<ISODateTimeString>;
};

export type SaleInstallment = {
  id: string;
  sale_id: string;
  plan_id: string;
  company_id: string;
  installment_number: number;
  due_date: ISODateString;
  amount: MoneyValue;
  paid_amount: MoneyValue;
  status: SalePaymentStatus | string;
  paid_at: Nullable<ISODateTimeString>;
  created_at: Nullable<ISODateTimeString>;
};

export type SalePayment = {
  id: string;
  sale_id: string;
  plan_id: Nullable<string>;
  company_id: string;
  amount: MoneyValue;
  payment_method: PaymentMethod | string | null;
  payment_date: ISODateString;
  reference: Nullable<string>;
  note: Nullable<string>;
  created_by: Nullable<string>;
  created_at: Nullable<ISODateTimeString>;
};

export type SaleWithRelations = Sale & {
  items?: SaleItem[];
  payment_plan?: SalePaymentPlan | null;
  installments?: SaleInstallment[];
  payments?: SalePayment[];
};

export type { PaymentMethodOptionFull as SalePaymentMethodOption } from "../../../lib/payments";