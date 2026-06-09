export type CompanyPaymentMethod = {
  id: string;
  type: string;
  label: string;
  details: string | null;
  is_active: boolean;
  sort_order: number;
};

export type UpdateBusinessState = {
  success: boolean;
  formError?: string;
  fieldErrors?: {
    companyName?: string;
    logoUrl?: string;
    logoFile?: string;
    contactFooter?: string;
    needsInventory?: string;
    profilePhone?: string;
  };
};

export type CompanyService = {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  base_price: number | null;
  is_active: boolean;
  category?: string | null;
  created_at: string | null;
};
