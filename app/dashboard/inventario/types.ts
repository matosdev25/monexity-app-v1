export type Product = {
  id: string;
  company_id: string;
  name: string;
  sku: string | null;
  price: number;
  track_inventory: boolean;
  stock: number;
  min_stock: number | null;
  is_active: boolean;
  sort_order: number;
  created_at: string | null;
};
