export interface Company {
  id: number;
  name: string;
  contact_info: string | null;
  created_at: string;
}

export interface Product {
  id: number;
  company_id: number;
  sku?: string | null;
  product_name: string;
  composition: string | null;
  category?: string | null;
  form?: string | null;
  packaging?: string | null;
  uom?: string | null;
  gst_rate?: number | null;
  batch_number: string;
  expiry_date: string;
  mrp: number;
  purchase_price: number;
  selling_price?: number;
  stock_quantity: number;
  minimum_stock_level: number;
  is_active?: number;
  created_at: string;
  updated_at: string;
  batches?: ProductBatch[];
}

export interface ProductBatch {
  id: number;
  product_id: number;
  batch_number: string;
  expiry_date: string;
  mrp: number;
  purchase_price: number;
  selling_price: number;
  initial_quantity: number;
  current_quantity: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface ProductWithCompany extends Product {
  company_name: string;
}

export interface InventoryTransaction {
  id: number;
  product_id: number;
  batch_id?: number | null;
  order_id?: number | null;
  transaction_type: "in" | "out" | "adjustment" | "sale" | "return";
  quantity: number;
  date: string;
  notes: string | null;
}

export interface Customer {
  id: number;
  store_name: string;
  contact_person?: string | null;
  phone: string;
  email?: string | null;
  billing_address?: string | null;
  delivery_address?: string | null;
  gstin?: string | null;
  dl_number?: string | null;
  payment_terms_days: number;
  credit_limit: number;
  outstanding_balance?: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface CreateCustomerInput {
  store_name: string;
  contact_person?: string;
  phone: string;
  email?: string;
  billing_address?: string;
  delivery_address?: string;
  gstin?: string;
  dl_number?: string;
  payment_terms_days?: number;
  credit_limit?: number;
}

export interface OrderItem {
  id?: number;
  order_id?: number;
  product_id: number;
  product_name?: string;
  company_name?: string;
  batch_id: number;
  batch_number?: string;
  expiry_date?: string;
  uom?: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  tax_rate: number;
  taxable_value: number;
  tax_amount: number;
  line_total: number;
}

export interface Order {
  id: number;
  invoice_number: string;
  customer_id: number;
  customer_name?: string;
  order_date: string;
  due_date: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  status:
    | "Draft"
    | "Confirmed"
    | "Outstanding"
    | "Paid"
    | "Partially Paid"
    | "Overdue"
    | "Cancelled";
  notes?: string | null;
  items?: OrderItem[];
  created_at: string;
  updated_at: string;
}

export interface CreateOrderInput {
  customer_id: number;
  order_date?: string;
  notes?: string;
  items: {
    product_id: number;
    batch_id: number;
    quantity: number;
    unit_price: number;
    discount_percent?: number;
    tax_rate?: number;
  }[];
}

export interface Payment {
  id: number;
  customer_id: number;
  customer_name?: string;
  order_id?: number | null;
  invoice_number?: string | null;
  payment_date: string;
  amount: number;
  payment_method: "cash" | "upi" | "bank_transfer" | "cheque";
  reference_number?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface CustomerLedgerEntry {
  id: number;
  customer_id: number;
  entry_type: "invoice" | "payment" | "adjustment" | "reversal";
  reference_id: number;
  debit: number;
  credit: number;
  running_balance: number;
  entry_date: string;
  notes?: string | null;
}

export interface DistributorSettings {
  id: number;
  default_payment_terms_days: number;
  due_soon_warning_days: number;
  grace_period_days: number;
  default_credit_limit: number;
  invoice_prefix: string;
  gstin?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LowStockItem {
  id: number;
  product_name: string;
  company_name: string;
  available_quantity: number;
  minimum_stock_level: number;
  urgency_ratio: number;
}

export interface ExpiringBatchItem {
  id: number;
  product_id: number;
  product_name: string;
  company_name: string;
  batch_number: string;
  expiry_date: string;
  current_quantity: number;
  days_until_expiry: number;
  is_expired: boolean;
}

export interface DashboardStats {
  lowStockCount: number;
  lowStockItems: LowStockItem[];
  expiringCount: number;
  expiring30Count: number;
  expiring60Count: number;
  expiring90Count: number;
  expiredCount: number;
  totalReceivables: number;
  overdueReceivables: number;
  overdueInvoicesCount: number;
  // Legacy / secondary counts (retained for catalog/summary use)
  totalProducts?: number;
  totalCompanies?: number;
  totalCustomers?: number;
}

export interface CreateCompanyInput {
  name: string;
  contact_info?: string;
  address?: string;
  gstin?: string;
}

export interface CreateProductInput {
  company_id: number;
  product_name: string;
  sku?: string;
  composition?: string;
  category?: string;
  form?: string;
  packaging?: string;
  uom?: string;
  gst_rate?: number;
  batch_number: string;
  expiry_date: string;
  mrp: number;
  purchase_price: number;
  selling_price?: number;
  stock_quantity: number;
  minimum_stock_level: number;
}

export interface UpdateProductInput {
  company_id?: number;
  product_name?: string;
  sku?: string;
  composition?: string;
  category?: string;
  form?: string;
  packaging?: string;
  uom?: string;
  gst_rate?: number;
  batch_number?: string;
  expiry_date?: string;
  mrp?: number;
  purchase_price?: number;
  selling_price?: number;
  stock_quantity?: number;
  minimum_stock_level?: number;
}

export interface CatalogImportRow {
  rowNumber: number;
  company: string;
  companyStatus: "existing" | "new";
  companyId?: number;
  product_name: string;
  productAction: "new_product" | "add_batch";
  productId?: number;
  sku?: string;
  composition?: string;
  category?: string;
  form?: string;
  packaging?: string;
  batch_number?: string;
  expiry_date?: string;
  mrp: number;
  purchase_price: number;
  sale_price?: number;
  gst_rate?: number;
  quantity?: number;
  minimum_stock_level?: number;
  errors: string[];
  warnings: string[];
  isValid: boolean;
}

export interface CatalogImportPreviewResult {
  success: boolean;
  filename: string;
  totalRows: number;
  validRowsCount: number;
  errorRowsCount: number;
  warningCount: number;
  canCommit: boolean;
  rows: CatalogImportRow[];
}

export interface CatalogImportCommitInput {
  rows: CatalogImportRow[];
  atomic?: boolean;
}

export interface Supplier {
  id: number;
  name: string;
  contact_person?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  gstin?: string | null;
  dl_number?: string | null;
  payment_terms_days: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface CreateSupplierInput {
  name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  gstin?: string;
  dl_number?: string;
  payment_terms_days?: number;
}

export interface PurchaseItem {
  id?: number;
  purchase_id?: number;
  product_id: number;
  product_name?: string;
  company_name?: string;
  batch_id?: number | null;
  batch_number: string;
  expiry_date: string;
  quantity: number;
  purchase_price: number;
  mrp: number;
  selling_price: number;
  tax_rate: number;
  taxable_value: number;
  tax_amount: number;
  line_total: number;
}

export interface Purchase {
  id: number;
  purchase_invoice_number: string;
  supplier_id: number;
  supplier_name?: string;
  supplier_phone?: string;
  supplier_gstin?: string;
  invoice_date: string;
  due_date?: string | null;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  payment_status: "unpaid" | "partially_paid" | "paid";
  notes?: string | null;
  items?: PurchaseItem[];
  items_count?: number;
  created_at: string;
  updated_at: string;
}

export interface CreatePurchaseInput {
  supplier_id: number;
  purchase_invoice_number: string;
  invoice_date?: string;
  due_date?: string;
  notes?: string;
  items: {
    product_id: number;
    batch_number: string;
    expiry_date: string;
    quantity: number;
    purchase_price: number;
    mrp: number;
    selling_price?: number;
    tax_rate?: number;
  }[];
}
