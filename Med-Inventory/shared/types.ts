export interface Company {
  id: number;
  name: string;
  contact_info: string | null;
  created_at: string;
}

export interface Product {
  id: number;
  company_id: number;
  product_name: string;
  composition: string | null;
  batch_number: string;
  expiry_date: string;
  mrp: number;
  purchase_price: number;
  stock_quantity: number;
  minimum_stock_level: number;
  created_at: string;
  updated_at: string;
}

export interface ProductWithCompany extends Product {
  company_name: string;
}

export interface InventoryTransaction {
  id: number;
  product_id: number;
  transaction_type: "in" | "out" | "adjustment";
  quantity: number;
  date: string;
  notes: string | null;
}

export interface DashboardStats {
  totalProducts: number;
  totalCompanies: number;
  lowStockCount: number;
  expiringCount: number;
}

export interface CreateCompanyInput {
  name: string;
  contact_info?: string;
}

export interface CreateProductInput {
  company_id: number;
  product_name: string;
  composition?: string;
  batch_number: string;
  expiry_date: string;
  mrp: number;
  purchase_price: number;
  stock_quantity: number;
  minimum_stock_level: number;
}

export interface UpdateProductInput {
  company_id?: number;
  product_name?: string;
  composition?: string;
  batch_number?: string;
  expiry_date?: string;
  mrp?: number;
  purchase_price?: number;
  stock_quantity?: number;
  minimum_stock_level?: number;
}
