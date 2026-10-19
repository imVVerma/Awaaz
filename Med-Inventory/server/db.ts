import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const dataDir = path.resolve(process.cwd(), "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.resolve(dataDir, "inventory.db");
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Initialize and migrate schema
const initializeDatabase = () => {
  const runMigration = db.transaction(() => {
    // 1. Companies Table
    db.exec(`
      CREATE TABLE IF NOT EXISTS companies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        contact_info TEXT,
        address TEXT,
        gstin TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT
      );
    `);

    // 2. Products Table (Master Catalog)
    db.exec(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER NOT NULL,
        sku TEXT,
        product_name TEXT NOT NULL,
        composition TEXT,
        category TEXT,
        uom TEXT DEFAULT 'Units',
        gst_rate REAL DEFAULT 12,
        batch_number TEXT,
        expiry_date TEXT,
        mrp REAL NOT NULL,
        purchase_price REAL NOT NULL,
        stock_quantity INTEGER NOT NULL DEFAULT 0,
        minimum_stock_level INTEGER NOT NULL DEFAULT 10,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
      );
    `);

    // 3. Product Batches Table (Physical Lots)
    db.exec(`
      CREATE TABLE IF NOT EXISTS product_batches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        batch_number TEXT NOT NULL,
        expiry_date TEXT NOT NULL,
        mrp REAL NOT NULL,
        purchase_price REAL NOT NULL,
        selling_price REAL NOT NULL,
        initial_quantity INTEGER NOT NULL DEFAULT 0,
        current_quantity INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      );
    `);

    // 4. Customers Table (Pharmacies & Retailers)
    db.exec(`
      CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        store_name TEXT NOT NULL,
        contact_person TEXT,
        phone TEXT,
        email TEXT,
        billing_address TEXT,
        delivery_address TEXT,
        gstin TEXT,
        dl_number TEXT,
        payment_terms_days INTEGER NOT NULL DEFAULT 15,
        credit_limit REAL NOT NULL DEFAULT 50000,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
    `);

    // 5. Orders Table (Sales Invoices)
    db.exec(`
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_number TEXT NOT NULL UNIQUE,
        customer_id INTEGER NOT NULL,
        order_date TEXT DEFAULT (datetime('now')),
        due_date TEXT NOT NULL,
        subtotal REAL NOT NULL DEFAULT 0,
        discount_amount REAL NOT NULL DEFAULT 0,
        tax_amount REAL NOT NULL DEFAULT 0,
        total_amount REAL NOT NULL DEFAULT 0,
        paid_amount REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'outstanding',
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT
      );
    `);

    // 6. Order Items Table (Line Items with Batch & Tax Snapshots)
    db.exec(`
      CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        batch_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price REAL NOT NULL,
        discount_percent REAL NOT NULL DEFAULT 0,
        tax_rate REAL NOT NULL DEFAULT 0,
        taxable_value REAL NOT NULL DEFAULT 0,
        tax_amount REAL NOT NULL DEFAULT 0,
        line_total REAL NOT NULL DEFAULT 0,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
        FOREIGN KEY (batch_id) REFERENCES product_batches(id) ON DELETE RESTRICT
      );
    `);

    // 7. Payments Table
    db.exec(`
      CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        order_id INTEGER,
        payment_date TEXT DEFAULT (datetime('now')),
        amount REAL NOT NULL,
        payment_method TEXT NOT NULL DEFAULT 'bank_transfer',
        reference_number TEXT,
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
      );
    `);

    // 8. Customer Ledger Table (Audit Trail & Running Balances)
    db.exec(`
      CREATE TABLE IF NOT EXISTS customer_ledger (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        entry_type TEXT NOT NULL,
        reference_id INTEGER,
        debit REAL NOT NULL DEFAULT 0,
        credit REAL NOT NULL DEFAULT 0,
        running_balance REAL NOT NULL DEFAULT 0,
        entry_date TEXT DEFAULT (datetime('now')),
        notes TEXT,
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
      );
    `);

    // 9. Distributor Settings
    db.exec(`
      CREATE TABLE IF NOT EXISTS distributor_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        business_name TEXT NOT NULL DEFAULT 'MediDist Pharma Distributors',
        gstin TEXT,
        dl_number TEXT,
        address TEXT,
        phone TEXT,
        email TEXT,
        default_payment_terms_days INTEGER NOT NULL DEFAULT 15,
        due_soon_warning_days INTEGER NOT NULL DEFAULT 5,
        grace_period_days INTEGER NOT NULL DEFAULT 2,
        default_credit_limit REAL NOT NULL DEFAULT 50000,
        invoice_prefix TEXT NOT NULL DEFAULT 'INV-',
        next_invoice_number INTEGER NOT NULL DEFAULT 1001,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
    `);

    // 10. Inventory Transactions Table
    db.exec(`
      CREATE TABLE IF NOT EXISTS inventory_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        batch_id INTEGER,
        order_id INTEGER,
        transaction_type TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        date TEXT DEFAULT (datetime('now')),
        notes TEXT,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      );
    `);

    // 11. Suppliers Table (Vendors / Wholesalers / C&F Agents)
    db.exec(`
      CREATE TABLE IF NOT EXISTS suppliers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        contact_person TEXT,
        phone TEXT,
        email TEXT,
        address TEXT,
        gstin TEXT,
        dl_number TEXT,
        payment_terms_days INTEGER NOT NULL DEFAULT 30,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
    `);

    // 12. Purchases Table (Inbound Supplier Invoices)
    db.exec(`
      CREATE TABLE IF NOT EXISTS purchases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        purchase_invoice_number TEXT NOT NULL,
        supplier_id INTEGER NOT NULL,
        invoice_date TEXT DEFAULT (datetime('now')),
        due_date TEXT,
        subtotal REAL NOT NULL DEFAULT 0,
        tax_amount REAL NOT NULL DEFAULT 0,
        total_amount REAL NOT NULL DEFAULT 0,
        paid_amount REAL NOT NULL DEFAULT 0,
        payment_status TEXT NOT NULL DEFAULT 'unpaid',
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT
      );
    `);

    // 13. Purchase Items Table (Inbound Batches with Cost & Tax Snapshots)
    db.exec(`
      CREATE TABLE IF NOT EXISTS purchase_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        purchase_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        batch_id INTEGER,
        batch_number TEXT NOT NULL,
        expiry_date TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        purchase_price REAL NOT NULL,
        mrp REAL NOT NULL,
        selling_price REAL NOT NULL,
        tax_rate REAL NOT NULL DEFAULT 12,
        taxable_value REAL NOT NULL DEFAULT 0,
        tax_amount REAL NOT NULL DEFAULT 0,
        line_total REAL NOT NULL DEFAULT 0,
        FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
        FOREIGN KEY (batch_id) REFERENCES product_batches(id) ON DELETE SET NULL
      );
    `);

    // Helper function to inspect column existence
    const hasColumn = (table: string, col: string) => {
      const cols = db.pragma(`table_info(${table})`) as { name: string }[];
      return cols.some((c) => c.name === col);
    };

    // Safe Alter Columns
    if (!hasColumn("products", "sku")) {
      db.exec("ALTER TABLE products ADD COLUMN sku TEXT;");
    }
    if (!hasColumn("products", "category")) {
      db.exec("ALTER TABLE products ADD COLUMN category TEXT;");
    }
    if (!hasColumn("products", "uom")) {
      db.exec("ALTER TABLE products ADD COLUMN uom TEXT DEFAULT 'Units';");
    }
    if (!hasColumn("products", "gst_rate")) {
      db.exec("ALTER TABLE products ADD COLUMN gst_rate REAL DEFAULT 12;");
    }
    if (!hasColumn("products", "is_active")) {
      db.exec("ALTER TABLE products ADD COLUMN is_active INTEGER DEFAULT 1;");
    }

    if (!hasColumn("companies", "address")) {
      db.exec("ALTER TABLE companies ADD COLUMN address TEXT;");
    }
    if (!hasColumn("companies", "gstin")) {
      db.exec("ALTER TABLE companies ADD COLUMN gstin TEXT;");
    }
    if (!hasColumn("companies", "updated_at")) {
      db.exec("ALTER TABLE companies ADD COLUMN updated_at TEXT;");
    }

    if (!hasColumn("inventory_transactions", "batch_id")) {
      db.exec(
        "ALTER TABLE inventory_transactions ADD COLUMN batch_id INTEGER;",
      );
    }
    if (!hasColumn("inventory_transactions", "order_id")) {
      db.exec(
        "ALTER TABLE inventory_transactions ADD COLUMN order_id INTEGER;",
      );
    }

    // Migrate existing products into product_batches if not present
    const existingProducts = db
      .prepare("SELECT * FROM products")
      .all() as any[];
    for (const prod of existingProducts) {
      if (prod.batch_number) {
        const existingBatch = db
          .prepare(
            "SELECT id FROM product_batches WHERE product_id = ? AND batch_number = ?",
          )
          .get(prod.id, prod.batch_number) as { id: number } | undefined;

        let batchId: number | bigint;
        if (!existingBatch) {
          const insertBatch = db.prepare(`
            INSERT INTO product_batches (
              product_id, batch_number, expiry_date, mrp, purchase_price, selling_price,
              initial_quantity, current_quantity, is_active, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
          `);
          const info = insertBatch.run(
            prod.id,
            prod.batch_number,
            prod.expiry_date,
            prod.mrp,
            prod.purchase_price,
            prod.mrp * 0.85,
            prod.stock_quantity,
            prod.stock_quantity,
            prod.created_at,
            prod.updated_at,
          );
          batchId = info.lastInsertRowid;
        } else {
          batchId = existingBatch.id;
        }

        db.prepare(
          `
          UPDATE inventory_transactions 
          SET batch_id = ? 
          WHERE product_id = ? AND batch_id IS NULL
        `,
        ).run(batchId, prod.id);
      }
    }

    try {
      db.exec("ALTER TABLE products ADD COLUMN form TEXT");
    } catch {}
    try {
      db.exec("ALTER TABLE products ADD COLUMN packaging TEXT");
    } catch {}

    // Seed Walk-in customer if missing
    const walkIn = db.prepare("SELECT id FROM customers WHERE id = 1").get();
    if (!walkIn) {
      db.prepare(
        `
        INSERT INTO customers (
          id, store_name, contact_person, phone, email, billing_address,
          delivery_address, payment_terms_days, credit_limit, is_active
        ) VALUES (
          1, 'Walk-in / Cash Customer', 'Counter Sales', '9999999999', 'cash@local',
          'Over the Counter', 'Over the Counter', 0, 0, 1
        )
      `,
      ).run();
    }

    // Seed default distributor settings if missing
    const settings = db
      .prepare("SELECT id FROM distributor_settings WHERE id = 1")
      .get();
    if (!settings) {
      db.prepare(
        `
        INSERT INTO distributor_settings (
          id, business_name, gstin, dl_number, address, phone, email,
          default_payment_terms_days, due_soon_warning_days, grace_period_days,
          default_credit_limit, invoice_prefix, next_invoice_number
        ) VALUES (
          1, 'MediDist Pharma Distributors', '07AAAAA0000A1Z5', 'DL-20B/21B-987654',
          'Shop 14, Wholesale Medicine Market, Delhi', '9810012345', 'orders@medidist.com',
          15, 5, 2, 50000, 'INV-', 1001
        )
      `,
      ).run();
    }

    // Seed default supplier if missing
    const defaultSupplier = db
      .prepare("SELECT id FROM suppliers WHERE id = 1")
      .get();
    if (!defaultSupplier) {
      db.prepare(
        `
        INSERT INTO suppliers (
          id, name, contact_person, phone, email, address, gstin, dl_number, payment_terms_days, is_active
        ) VALUES (
          1, 'Apex Pharma Distributors & C&F', 'Anil Mehta', '9820012345', 'orders@apexpharma.com',
          'Warehouse 8, Industrial Area, Okhla, New Delhi', '07BBBBB1111B1Z2', 'DL-20B/21B-112233', 30, 1
        )
      `,
      ).run();
    }

    // Indices for performance
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_products_company ON products(company_id);
      CREATE INDEX IF NOT EXISTS idx_products_stock ON products(stock_quantity, minimum_stock_level);
      CREATE INDEX IF NOT EXISTS idx_transactions_product ON inventory_transactions(product_id);
      CREATE INDEX IF NOT EXISTS idx_batches_product ON product_batches(product_id);
      CREATE INDEX IF NOT EXISTS idx_batches_expiry ON product_batches(expiry_date);
      CREATE INDEX IF NOT EXISTS idx_batches_stock ON product_batches(current_quantity);
      CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
      CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
      CREATE INDEX IF NOT EXISTS idx_orders_due_date ON orders(due_date);
      CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
      CREATE INDEX IF NOT EXISTS idx_order_items_batch ON order_items(batch_id);
      CREATE INDEX IF NOT EXISTS idx_ledger_customer ON customer_ledger(customer_id);
      CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments(customer_id);
      CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
      CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON purchases(supplier_id);
      CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(invoice_date);
      CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON purchase_items(purchase_id);
      CREATE INDEX IF NOT EXISTS idx_purchase_items_product ON purchase_items(product_id);
      CREATE INDEX IF NOT EXISTS idx_purchase_items_batch ON purchase_items(batch_id);
      CREATE INDEX IF NOT EXISTS idx_suppliers_active ON suppliers(is_active);
    `);
  });

  runMigration();
};

initializeDatabase();

export default db;
