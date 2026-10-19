import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import db from "./db";
import { customersRouter } from "./routes/customers";
import { batchesRouter } from "./routes/batches";
import { ordersRouter } from "./routes/orders";
import { paymentsRouter } from "./routes/payments";
import { reportsRouter } from "./routes/reports";
import { purchasesRouter, suppliersRouter } from "./routes/purchases";
import type {
  Company,
  Product,
  ProductWithCompany,
  DashboardStats,
  CreateCompanyInput,
  CreateProductInput,
  UpdateProductInput,
} from "@shared/types";

export async function registerRoutes(app: Express): Promise<Server> {
  // Mount Modular Domain Routers
  app.use("/api/customers", customersRouter);
  app.use("/api/batches", batchesRouter);
  app.use("/api/orders", ordersRouter);
  app.use("/api/payments", paymentsRouter);
  app.use("/api/reports", reportsRouter);
  app.use("/api/purchases", purchasesRouter);
  app.use("/api/suppliers", suppliersRouter);

  // ============ DASHBOARD STATS ============
  app.get("/api/dashboard/stats", (_req: Request, res: Response) => {
    try {
      const today = new Date().toISOString().split("T")[0];

      // 1. Low Stock: Count distinct products whose non-expired available stock <= minimum threshold
      const lowStockRow = db
        .prepare(
          `
        SELECT COUNT(*) as count FROM (
          SELECT p.id,
                 COALESCE(
                   (SELECT SUM(b.current_quantity) 
                    FROM product_batches b 
                    WHERE b.product_id = p.id AND b.is_active = 1 AND date(b.expiry_date) >= date(?)),
                   p.stock_quantity
                 ) as available_qty,
                 p.minimum_stock_level
          FROM products p
          WHERE p.is_active = 1
        ) WHERE available_qty <= minimum_stock_level
      `,
        )
        .get(today) as { count: number };

      // Low Stock urgent preview items (top 5 by urgency ratio)
      const lowStockItems = db
        .prepare(
          `
        SELECT 
          p.id,
          p.product_name,
          c.name as company_name,
          COALESCE(
            (SELECT SUM(b.current_quantity) 
             FROM product_batches b 
             WHERE b.product_id = p.id AND b.is_active = 1 AND date(b.expiry_date) >= date(?)),
            p.stock_quantity
          ) as available_quantity,
          p.minimum_stock_level,
          ROUND((COALESCE(
            (SELECT SUM(b.current_quantity) 
             FROM product_batches b 
             WHERE b.product_id = p.id AND b.is_active = 1 AND date(b.expiry_date) >= date(?)),
            p.stock_quantity
          ) * 1.0 / NULLIF(p.minimum_stock_level, 0)), 2) as urgency_ratio
        FROM products p
        LEFT JOIN companies c ON p.company_id = c.id
        WHERE p.is_active = 1
          AND COALESCE(
            (SELECT SUM(b.current_quantity) 
             FROM product_batches b 
             WHERE b.product_id = p.id AND b.is_active = 1 AND date(b.expiry_date) >= date(?)),
            p.stock_quantity
          ) <= p.minimum_stock_level
        ORDER BY urgency_ratio ASC, available_quantity ASC
        LIMIT 5
      `,
        )
        .all(today, today, today) as any[];

      // 2. Expiring Soon (30, 60, 90 days) excluding already expired items
      const expiring30 = db
        .prepare(
          `
        SELECT COUNT(DISTINCT b.id) as count 
        FROM product_batches b 
        WHERE b.is_active = 1 AND b.current_quantity > 0
          AND date(b.expiry_date) >= date(?) 
          AND date(b.expiry_date) <= date(?, '+30 days')
      `,
        )
        .get(today, today) as { count: number };

      const expiring60 = db
        .prepare(
          `
        SELECT COUNT(DISTINCT b.id) as count 
        FROM product_batches b 
        WHERE b.is_active = 1 AND b.current_quantity > 0
          AND date(b.expiry_date) >= date(?) 
          AND date(b.expiry_date) <= date(?, '+60 days')
      `,
        )
        .get(today, today) as { count: number };

      const expiring90 = db
        .prepare(
          `
        SELECT COUNT(DISTINCT b.id) as count 
        FROM product_batches b 
        WHERE b.is_active = 1 AND b.current_quantity > 0
          AND date(b.expiry_date) >= date(?) 
          AND date(b.expiry_date) <= date(?, '+90 days')
      `,
        )
        .get(today, today) as { count: number };

      // Strictly expired batches (isolated count)
      const expired = db
        .prepare(
          `
        SELECT COUNT(DISTINCT b.id) as count 
        FROM product_batches b 
        WHERE b.is_active = 1 AND b.current_quantity > 0
          AND date(b.expiry_date) < date(?)
      `,
        )
        .get(today) as { count: number };

      // 3. Customer Receivables: Finalized sales invoices (excluding cancelled)
      const receivablesData = db
        .prepare(
          `
        SELECT 
          COALESCE(SUM(total_amount - paid_amount), 0) as total_receivables,
          COALESCE(SUM(CASE WHEN date(due_date) < date(?) THEN (total_amount - paid_amount) ELSE 0 END), 0) as overdue_receivables,
          COUNT(CASE WHEN date(due_date) < date(?) AND paid_amount < total_amount THEN 1 END) as overdue_count
        FROM orders
        WHERE status != 'Cancelled' AND paid_amount < total_amount
      `,
        )
        .get(today, today) as {
        total_receivables: number;
        overdue_receivables: number;
        overdue_count: number;
      };

      // Secondary summary figures (for catalog/report summaries)
      const totalProducts = db
        .prepare("SELECT COUNT(*) as count FROM products WHERE is_active = 1")
        .get() as { count: number };
      const totalCompanies = db
        .prepare("SELECT COUNT(*) as count FROM companies")
        .get() as { count: number };
      const totalCustomers = db
        .prepare("SELECT COUNT(*) as count FROM customers WHERE is_active = 1")
        .get() as { count: number };

      const stats: DashboardStats = {
        lowStockCount: lowStockRow.count,
        lowStockItems: lowStockItems.map((item) => ({
          id: item.id,
          product_name: item.product_name,
          company_name: item.company_name || "Unknown",
          available_quantity: item.available_quantity,
          minimum_stock_level: item.minimum_stock_level,
          urgency_ratio: item.urgency_ratio,
        })),
        expiringCount: expiring90.count,
        expiring30Count: expiring30.count,
        expiring60Count: expiring60.count,
        expiring90Count: expiring90.count,
        expiredCount: expired.count,
        totalReceivables: receivablesData.total_receivables,
        overdueReceivables: receivablesData.overdue_receivables,
        overdueInvoicesCount: receivablesData.overdue_count,
        totalProducts: totalProducts.count,
        totalCompanies: totalCompanies.count,
        totalCustomers: totalCustomers.count,
      };

      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
  });

  // ============ DASHBOARD RECENT ACTIVITY ============
  app.get("/api/dashboard/activity", (_req: Request, res: Response) => {
    try {
      // Recent sales orders (last 10)
      const recentOrders = db
        .prepare(
          `
        SELECT 
          o.id,
          'order' as type,
          o.invoice_number as reference,
          c.store_name as party_name,
          o.total_amount as amount,
          o.status as status,
          o.order_date as event_date,
          o.created_at as timestamp
        FROM orders o
        JOIN customers c ON o.customer_id = c.id
        ORDER BY o.created_at DESC, o.id DESC
        LIMIT 10
      `,
        )
        .all() as any[];

      // Recent purchases (last 10)
      const recentPurchases = db
        .prepare(
          `
        SELECT 
          p.id,
          'purchase' as type,
          p.purchase_invoice_number as reference,
          s.name as party_name,
          p.total_amount as amount,
          p.payment_status as status,
          p.invoice_date as event_date,
          p.created_at as timestamp
        FROM purchases p
        JOIN suppliers s ON p.supplier_id = s.id
        ORDER BY p.created_at DESC, p.id DESC
        LIMIT 10
      `,
        )
        .all() as any[];

      // Recent customer payments (last 10)
      const recentPayments = db
        .prepare(
          `
        SELECT 
          pay.id,
          'payment' as type,
          COALESCE(o.invoice_number, pay.reference_number, 'REC-' || pay.id) as reference,
          c.store_name as party_name,
          pay.amount as amount,
          pay.payment_method as status,
          pay.payment_date as event_date,
          pay.created_at as timestamp
        FROM payments pay
        JOIN customers c ON pay.customer_id = c.id
        LEFT JOIN orders o ON pay.order_id = o.id
        ORDER BY pay.created_at DESC, pay.id DESC
        LIMIT 10
      `,
        )
        .all() as any[];

      // Combine and sort by timestamp / event_date descending
      const combined = [...recentOrders, ...recentPurchases, ...recentPayments]
        .sort((a, b) => {
          const timeA = new Date(a.timestamp || a.event_date).getTime();
          const timeB = new Date(b.timestamp || b.event_date).getTime();
          return timeB - timeA;
        })
        .slice(0, 15);

      res.json(combined);
    } catch (error) {
      console.error("Error fetching dashboard activity:", error);
      res.status(500).json({ error: "Failed to fetch dashboard activity" });
    }
  });

  // ============ COMPANIES ============
  app.get("/api/companies", (_req: Request, res: Response) => {
    try {
      const companies = db
        .prepare("SELECT * FROM companies ORDER BY name ASC")
        .all() as Company[];
      res.json(companies);
    } catch (error) {
      console.error("Error fetching companies:", error);
      res.status(500).json({ error: "Failed to fetch companies" });
    }
  });

  app.get("/api/companies/:id", (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const company = db
        .prepare("SELECT * FROM companies WHERE id = ?")
        .get(id) as Company | undefined;

      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }

      res.json(company);
    } catch (error) {
      console.error("Error fetching company:", error);
      res.status(500).json({ error: "Failed to fetch company" });
    }
  });

  app.post("/api/companies", (req: Request, res: Response) => {
    try {
      const { name, contact_info }: CreateCompanyInput = req.body;

      if (!name || name.trim() === "") {
        return res.status(400).json({ error: "Company name is required" });
      }

      const existing = db
        .prepare("SELECT id FROM companies WHERE name = ?")
        .get(name.trim());
      if (existing) {
        return res
          .status(400)
          .json({ error: "Company with this name already exists" });
      }

      const result = db
        .prepare("INSERT INTO companies (name, contact_info) VALUES (?, ?)")
        .run(name.trim(), contact_info || null);

      const company = db
        .prepare("SELECT * FROM companies WHERE id = ?")
        .get(result.lastInsertRowid) as Company;
      res.status(201).json(company);
    } catch (error) {
      console.error("Error creating company:", error);
      res.status(500).json({ error: "Failed to create company" });
    }
  });

  app.put("/api/companies/:id", (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { name, contact_info }: CreateCompanyInput = req.body;

      const existing = db
        .prepare("SELECT * FROM companies WHERE id = ?")
        .get(id) as Company | undefined;
      if (!existing) {
        return res.status(404).json({ error: "Company not found" });
      }

      if (!name || name.trim() === "") {
        return res.status(400).json({ error: "Company name is required" });
      }

      const duplicate = db
        .prepare("SELECT id FROM companies WHERE name = ? AND id != ?")
        .get(name.trim(), id);
      if (duplicate) {
        return res
          .status(400)
          .json({ error: "Company with this name already exists" });
      }

      db.prepare(
        "UPDATE companies SET name = ?, contact_info = ? WHERE id = ?",
      ).run(name.trim(), contact_info || null, id);

      const company = db
        .prepare("SELECT * FROM companies WHERE id = ?")
        .get(id) as Company;
      res.json(company);
    } catch (error) {
      console.error("Error updating company:", error);
      res.status(500).json({ error: "Failed to update company" });
    }
  });

  app.delete("/api/companies/:id", (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const existing = db
        .prepare("SELECT * FROM companies WHERE id = ?")
        .get(id);
      if (!existing) {
        return res.status(404).json({ error: "Company not found" });
      }

      db.prepare("DELETE FROM companies WHERE id = ?").run(id);
      res.json({ message: "Company deleted successfully" });
    } catch (error) {
      console.error("Error deleting company:", error);
      res.status(500).json({ error: "Failed to delete company" });
    }
  });

  // ============ PRODUCTS ============
  app.get("/api/products", (req: Request, res: Response) => {
    try {
      const { company_id, search } = req.query;

      let query = `
        SELECT p.*, c.name as company_name 
        FROM products p 
        LEFT JOIN companies c ON p.company_id = c.id 
        WHERE 1=1
      `;
      const params: (string | number)[] = [];

      if (company_id && company_id !== "all") {
        query += " AND p.company_id = ?";
        params.push(Number(company_id));
      }

      if (search && typeof search === "string" && search.trim() !== "") {
        query +=
          " AND (p.product_name LIKE ? OR p.composition LIKE ? OR p.batch_number LIKE ?)";
        const searchTerm = `%${search.trim()}%`;
        params.push(searchTerm, searchTerm, searchTerm);
      }

      query += " ORDER BY p.product_name ASC";

      const products = db.prepare(query).all(...params) as ProductWithCompany[];

      const allBatches = db
        .prepare(
          "SELECT * FROM product_batches WHERE is_active = 1 ORDER BY expiry_date ASC",
        )
        .all() as any[];

      const batchesByProductId = new Map<number, any[]>();
      for (const b of allBatches) {
        if (!batchesByProductId.has(b.product_id)) {
          batchesByProductId.set(b.product_id, []);
        }
        batchesByProductId.get(b.product_id)!.push(b);
      }

      const productsWithBatches = products.map((p) => ({
        ...p,
        batches: batchesByProductId.get(p.id) || [],
      }));

      res.json(productsWithBatches);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  app.get("/api/products/low-stock", (_req: Request, res: Response) => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const products = db
        .prepare(
          `
        SELECT p.*, c.name as company_name,
               COALESCE(
                 (SELECT SUM(b.current_quantity) 
                  FROM product_batches b 
                  WHERE b.product_id = p.id AND b.is_active = 1 AND date(b.expiry_date) >= date(?)),
                 p.stock_quantity
               ) as available_quantity
        FROM products p 
        LEFT JOIN companies c ON p.company_id = c.id 
        WHERE p.is_active = 1
          AND COALESCE(
            (SELECT SUM(b.current_quantity) 
             FROM product_batches b 
             WHERE b.product_id = p.id AND b.is_active = 1 AND date(b.expiry_date) >= date(?)),
            p.stock_quantity
          ) <= p.minimum_stock_level
        ORDER BY (COALESCE(
            (SELECT SUM(b.current_quantity) 
             FROM product_batches b 
             WHERE b.product_id = p.id AND b.is_active = 1 AND date(b.expiry_date) >= date(?)),
            p.stock_quantity
          ) * 1.0 / NULLIF(p.minimum_stock_level, 0)) ASC, p.stock_quantity ASC
      `,
        )
        .all(today, today, today) as ProductWithCompany[];

      res.json(products);
    } catch (error) {
      console.error("Error fetching low stock products:", error);
      res.status(500).json({ error: "Failed to fetch low stock products" });
    }
  });

  app.get("/api/products/expiring", (_req: Request, res: Response) => {
    try {
      const threeMonthsFromNow = new Date();
      threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);

      const products = db
        .prepare(
          `
        SELECT p.*, c.name as company_name 
        FROM products p 
        LEFT JOIN companies c ON p.company_id = c.id 
        WHERE date(p.expiry_date) <= date(?)
        ORDER BY p.expiry_date ASC
      `,
        )
        .all(
          threeMonthsFromNow.toISOString().split("T")[0],
        ) as ProductWithCompany[];

      res.json(products);
    } catch (error) {
      console.error("Error fetching expiring products:", error);
      res.status(500).json({ error: "Failed to fetch expiring products" });
    }
  });

  app.get("/api/products/:id", (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const product = db
        .prepare(
          `
        SELECT p.*, c.name as company_name 
        FROM products p 
        LEFT JOIN companies c ON p.company_id = c.id 
        WHERE p.id = ?
      `,
        )
        .get(id) as ProductWithCompany | undefined;

      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }

      const batches = db
        .prepare(
          "SELECT * FROM product_batches WHERE product_id = ? ORDER BY expiry_date ASC",
        )
        .all(id);

      res.json({ ...product, batches });
    } catch (error) {
      console.error("Error fetching product:", error);
      res.status(500).json({ error: "Failed to fetch product" });
    }
  });

  app.post("/api/products", (req: Request, res: Response) => {
    try {
      const data: CreateProductInput = req.body;

      if (!data.product_name || data.product_name.trim() === "") {
        return res.status(400).json({ error: "Product name is required" });
      }
      if (!data.company_id) {
        return res.status(400).json({ error: "Company is required" });
      }
      if (!data.batch_number || data.batch_number.trim() === "") {
        return res.status(400).json({ error: "Batch number is required" });
      }
      if (!data.expiry_date) {
        return res.status(400).json({ error: "Expiry date is required" });
      }
      if (data.mrp === undefined || data.mrp <= 0) {
        return res.status(400).json({ error: "MRP must be a positive number" });
      }
      if (data.purchase_price === undefined || data.purchase_price <= 0) {
        return res
          .status(400)
          .json({ error: "Purchase price must be a positive number" });
      }
      if (data.stock_quantity === undefined || data.stock_quantity < 0) {
        return res
          .status(400)
          .json({ error: "Stock quantity must be a non-negative number" });
      }

      const company = db
        .prepare("SELECT id FROM companies WHERE id = ?")
        .get(data.company_id);
      if (!company) {
        return res
          .status(400)
          .json({ error: "Selected company does not exist" });
      }

      const today = new Date().toISOString().split("T")[0];
      if (data.expiry_date < today) {
        return res
          .status(400)
          .json({ error: "Expiry date must be in the future" });
      }

      const createProductTx = db.transaction(() => {
        const result = db
          .prepare(
            `
          INSERT INTO products (
            company_id, product_name, composition, sku, category, uom, gst_rate,
            batch_number, expiry_date, mrp, purchase_price, stock_quantity, minimum_stock_level, is_active
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        `,
          )
          .run(
            data.company_id,
            data.product_name.trim(),
            data.composition || null,
            data.sku?.trim() || null,
            data.category?.trim() || null,
            data.uom?.trim() || "Units",
            data.gst_rate !== undefined ? Number(data.gst_rate) : 12,
            data.batch_number.trim(),
            data.expiry_date,
            data.mrp,
            data.purchase_price,
            data.stock_quantity,
            data.minimum_stock_level || 10,
          );

        const productId = result.lastInsertRowid;
        const sellingPrice =
          data.selling_price && data.selling_price > 0
            ? Number(data.selling_price)
            : Number(data.mrp) * 0.85;

        const batchResult = db
          .prepare(
            `
          INSERT INTO product_batches (
            product_id, batch_number, expiry_date, mrp, purchase_price, selling_price,
            initial_quantity, current_quantity, is_active
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
        `,
          )
          .run(
            productId,
            data.batch_number.trim(),
            data.expiry_date,
            data.mrp,
            data.purchase_price,
            sellingPrice,
            data.stock_quantity,
            data.stock_quantity,
          );

        db.prepare(
          `
          INSERT INTO inventory_transactions (product_id, batch_id, transaction_type, quantity, notes)
          VALUES (?, ?, 'in', ?, 'Initial stock')
        `,
        ).run(productId, batchResult.lastInsertRowid, data.stock_quantity);

        return productId;
      });

      const newProductId = createProductTx();

      const product = db
        .prepare(
          `
        SELECT p.*, c.name as company_name 
        FROM products p 
        LEFT JOIN companies c ON p.company_id = c.id 
        WHERE p.id = ?
      `,
        )
        .get(newProductId) as ProductWithCompany;

      res.status(201).json(product);
    } catch (error) {
      console.error("Error creating product:", error);
      res.status(500).json({ error: "Failed to create product" });
    }
  });

  app.put("/api/products/:id", (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const data: UpdateProductInput = req.body;

      const existing = db
        .prepare("SELECT * FROM products WHERE id = ?")
        .get(id) as Product | undefined;
      if (!existing) {
        return res.status(404).json({ error: "Product not found" });
      }

      if (data.product_name !== undefined && data.product_name.trim() === "") {
        return res.status(400).json({ error: "Product name cannot be empty" });
      }
      if (data.mrp !== undefined && data.mrp <= 0) {
        return res.status(400).json({ error: "MRP must be a positive number" });
      }
      if (data.purchase_price !== undefined && data.purchase_price <= 0) {
        return res
          .status(400)
          .json({ error: "Purchase price must be a positive number" });
      }
      if (data.stock_quantity !== undefined && data.stock_quantity < 0) {
        return res
          .status(400)
          .json({ error: "Stock quantity must be a non-negative number" });
      }

      if (data.company_id !== undefined) {
        const company = db
          .prepare("SELECT id FROM companies WHERE id = ?")
          .get(data.company_id);
        if (!company) {
          return res
            .status(400)
            .json({ error: "Selected company does not exist" });
        }
      }

      const oldStockQuantity = existing.stock_quantity;
      const newStockQuantity =
        data.stock_quantity !== undefined
          ? data.stock_quantity
          : oldStockQuantity;

      db.prepare(
        `
        UPDATE products SET
          company_id = COALESCE(?, company_id),
          product_name = COALESCE(?, product_name),
          sku = COALESCE(?, sku),
          composition = COALESCE(?, composition),
          category = COALESCE(?, category),
          form = COALESCE(?, form),
          packaging = COALESCE(?, packaging),
          uom = COALESCE(?, uom),
          gst_rate = COALESCE(?, gst_rate),
          batch_number = COALESCE(?, batch_number),
          expiry_date = COALESCE(?, expiry_date),
          mrp = COALESCE(?, mrp),
          purchase_price = COALESCE(?, purchase_price),
          stock_quantity = COALESCE(?, stock_quantity),
          minimum_stock_level = COALESCE(?, minimum_stock_level),
          updated_at = datetime('now')
        WHERE id = ?
      `,
      ).run(
        data.company_id ?? null,
        data.product_name?.trim() ?? null,
        data.sku?.trim() ?? null,
        data.composition ?? null,
        data.category ?? null,
        data.form ?? null,
        data.packaging ?? null,
        data.uom ?? null,
        data.gst_rate ?? null,
        data.batch_number?.trim() ?? null,
        data.expiry_date ?? null,
        data.mrp ?? null,
        data.purchase_price ?? null,
        data.stock_quantity ?? null,
        data.minimum_stock_level ?? null,
        id,
      );

      // Sync changes to product_batches
      if (
        data.batch_number ||
        data.expiry_date ||
        data.mrp ||
        data.purchase_price ||
        data.selling_price ||
        data.stock_quantity !== undefined
      ) {
        const existingBatch = db
          .prepare(
            `SELECT id, current_quantity FROM product_batches 
             WHERE product_id = ? AND (batch_number = ? OR id = (SELECT id FROM product_batches WHERE product_id = ? ORDER BY id DESC LIMIT 1))`,
          )
          .get(id, existing.batch_number, id) as
          | { id: number; current_quantity: number }
          | undefined;

        if (existingBatch) {
          db.prepare(
            `UPDATE product_batches SET
              batch_number = COALESCE(?, batch_number),
              expiry_date = COALESCE(?, expiry_date),
              mrp = COALESCE(?, mrp),
              purchase_price = COALESCE(?, purchase_price),
              selling_price = COALESCE(?, selling_price),
              current_quantity = CASE WHEN ? IS NOT NULL THEN ? ELSE current_quantity END,
              updated_at = datetime('now')
            WHERE id = ?`,
          ).run(
            data.batch_number?.trim() ?? null,
            data.expiry_date ?? null,
            data.mrp ?? null,
            data.purchase_price ?? null,
            data.selling_price ?? null,
            data.stock_quantity !== undefined ? data.stock_quantity : null,
            data.stock_quantity !== undefined ? data.stock_quantity : null,
            existingBatch.id,
          );
        } else if (data.batch_number || existing.batch_number) {
          const bNum = data.batch_number?.trim() || existing.batch_number;
          const expDate = data.expiry_date || existing.expiry_date;
          const batchMrp = data.mrp ?? existing.mrp;
          const batchCost = data.purchase_price ?? existing.purchase_price;
          const batchSale =
            data.selling_price ??
            (data.mrp ? data.mrp * 0.85 : existing.mrp * 0.85);
          const batchQty =
            data.stock_quantity !== undefined
              ? data.stock_quantity
              : existing.stock_quantity;

          db.prepare(
            `INSERT INTO product_batches (
              product_id, batch_number, expiry_date, mrp, purchase_price, selling_price,
              initial_quantity, current_quantity, is_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
          ).run(
            id,
            bNum,
            expDate,
            batchMrp,
            batchCost,
            batchSale,
            batchQty,
            batchQty,
          );
        }
      }

      if (
        data.stock_quantity !== undefined &&
        data.stock_quantity !== oldStockQuantity
      ) {
        const diff = newStockQuantity - oldStockQuantity;
        const transactionType = diff > 0 ? "in" : "out";
        db.prepare(
          `
          INSERT INTO inventory_transactions (product_id, transaction_type, quantity, notes)
          VALUES (?, ?, ?, 'Stock adjustment')
        `,
        ).run(id, transactionType, Math.abs(diff));
      }

      const product = db
        .prepare(
          `
        SELECT p.*, c.name as company_name 
        FROM products p 
        LEFT JOIN companies c ON p.company_id = c.id 
        WHERE p.id = ?
      `,
        )
        .get(id) as ProductWithCompany;

      const batches = db
        .prepare(
          "SELECT * FROM product_batches WHERE product_id = ? ORDER BY expiry_date ASC",
        )
        .all(id);

      res.json({ ...product, batches });
    } catch (error) {
      console.error("Error updating product:", error);
      res.status(500).json({ error: "Failed to update product" });
    }
  });

  app.delete("/api/products/:id", (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const existing = db
        .prepare("SELECT * FROM products WHERE id = ?")
        .get(id);
      if (!existing) {
        return res.status(404).json({ error: "Product not found" });
      }

      db.prepare("DELETE FROM inventory_transactions WHERE product_id = ?").run(
        id,
      );
      db.prepare("DELETE FROM products WHERE id = ?").run(id);

      res.json({ message: "Product deleted successfully" });
    } catch (error) {
      console.error("Error deleting product:", error);
      res.status(500).json({ error: "Failed to delete product" });
    }
  });

  app.patch("/api/products/:id/stock", (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { quantity, type } = req.body as {
        quantity: number;
        type: "add" | "remove";
      };

      if (!quantity || quantity <= 0) {
        return res
          .status(400)
          .json({ error: "Quantity must be a positive number" });
      }
      if (!type || !["add", "remove"].includes(type)) {
        return res
          .status(400)
          .json({ error: "Type must be 'add' or 'remove'" });
      }

      const existing = db
        .prepare("SELECT * FROM products WHERE id = ?")
        .get(id) as Product | undefined;
      if (!existing) {
        return res.status(404).json({ error: "Product not found" });
      }

      let newStock: number;
      if (type === "add") {
        newStock = existing.stock_quantity + quantity;
      } else {
        newStock = Math.max(0, existing.stock_quantity - quantity);
      }

      db.prepare(
        "UPDATE products SET stock_quantity = ?, updated_at = datetime('now') WHERE id = ?",
      ).run(newStock, id);

      const transactionType = type === "add" ? "in" : "out";
      const actualQuantity =
        type === "add" ? quantity : Math.min(quantity, existing.stock_quantity);
      db.prepare(
        `
        INSERT INTO inventory_transactions (product_id, transaction_type, quantity, notes)
        VALUES (?, ?, ?, ?)
      `,
      ).run(id, transactionType, actualQuantity, `Quick stock ${type}`);

      const product = db
        .prepare(
          `
        SELECT p.*, c.name as company_name 
        FROM products p 
        LEFT JOIN companies c ON p.company_id = c.id 
        WHERE p.id = ?
      `,
        )
        .get(id) as ProductWithCompany;

      res.json(product);
    } catch (error) {
      console.error("Error updating stock:", error);
      res.status(500).json({ error: "Failed to update stock" });
    }
  });

  // ============ REPORTS ============
  app.get("/api/reports/summary", (_req: Request, res: Response) => {
    try {
      // 1. Inventory Value Summary
      const inventoryStats = db
        .prepare(
          `
        SELECT 
          COUNT(*) as total_products,
          SUM(stock_quantity) as total_stock_quantity,
          SUM(purchase_price * stock_quantity) as total_investment,
          SUM(mrp * stock_quantity) as potential_revenue
        FROM products
      `,
        )
        .get() as {
        total_products: number;
        total_stock_quantity: number;
        total_investment: number;
        potential_revenue: number;
      };

      // 2. Stock Distribution by Company
      const companyDistribution = db
        .prepare(
          `
        SELECT 
          c.name as company_name,
          COUNT(p.id) as product_count,
          SUM(p.stock_quantity) as stock_level
        FROM companies c
        LEFT JOIN products p ON c.id = p.company_id
        GROUP BY c.id
        ORDER BY stock_level DESC
      `,
        )
        .all() as {
        company_name: string;
        product_count: number;
        stock_level: number;
      }[];

      // 3. Recent Transactions
      const recentTransactions = db
        .prepare(
          `
        SELECT 
          t.*, 
          p.product_name 
        FROM inventory_transactions t
        JOIN products p ON t.product_id = p.id
        ORDER BY t.date DESC
        LIMIT 10
      `,
        )
        .all();

      res.json({
        inventory: inventoryStats,
        distribution: companyDistribution,
        transactions: recentTransactions,
      });
    } catch (error) {
      console.error("Error fetching reports summary:", error);
      res.status(500).json({ error: "Failed to fetch reports summary" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
