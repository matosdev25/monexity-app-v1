export type QuotationStatus =
  | "draft"
  | "sent"
  | "accepted"
  | "rejected"
  | "expired"
  | "converted";

export type Quotation = {
  id: string;
  company_id: string | null;
  quotation_number: string | null;
  status: QuotationStatus | string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_company: string | null;
  issue_date: string;
  valid_until: string | null;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  notes: string | null;
  terms: string | null;
  converted_sale_id: string | null;
  converted_at: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type QuotationItem = {
  id: string;
  quotation_id: string;
  company_id: string;
  service_id: string | null;
  service_name_snapshot: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  sort_order: number;
  created_at: string | null;
};

export type QuotationActionState = {
  success: boolean;
  message: string;
  quotationId?: string;
  quotationNumber?: string;
  timestamp?: number;
};
