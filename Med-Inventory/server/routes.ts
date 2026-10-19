import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import db from "./db";
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
  // ============ DASHBOARD ============
  app.get("/api/dashboard/stats", (_req: Request, res: Response) => {
    try {
      const totalProducts = db
        .prepare("SELECT COUNT(*) as count FROM products")
        .get() as { count: number };
      const totalCompanies = db
        .prepare("SELECT COUNT(*) as count FROM companies")
        .get() as { count: number };
      const lowStockCount = db
        .prepare(
          "SELECT COUNT(*) as count FROM products WHERE stock_quantity <= minimum_stock_level",
        )
        .get() as { count: number };

      const threeMonthsFromNow = new Date();
      threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);
      const expiringCount = db
        .prepare(
          "SELECT COUNT(*) as count FROM products WHERE date(expiry_date) <= date(?)",
        )
        .get(threeMonthsFromNow.toISOString().split("T")[0]) as {
        count: number;
      };

      const stats: DashboardStats = {
        totalProducts: totalProducts.count,
        totalCompanies: totalCompanies.count,
        lowStockCount: lowStockCount.count,
        expiringCount: expiringCount.count,
      };

      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
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
      res.json(products);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  app.get("/api/products/low-stock", (_req: Request, res: Response) => {
    try {
      const products = db
        .prepare(
          `
        SELECT p.*, c.name as company_name 
        FROM products p 
        LEFT JOIN companies c ON p.company_id = c.id 
        WHERE p.stock_quantity <= p.minimum_stock_level
        ORDER BY (p.stock_quantity * 1.0 / p.minimum_stock_level) ASC
      `,
        )
        .all() as ProductWithCompany[];

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

      res.json(product);
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

      const result = db
        .prepare(
          `
        INSERT INTO products (
          company_id, product_name, composition, batch_number, 
          expiry_date, mrp, purchase_price, stock_quantity, minimum_stock_level
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        )
        .run(
          data.company_id,
          data.product_name.trim(),
          data.composition || null,
          data.batch_number.trim(),
          data.expiry_date,
          data.mrp,
          data.purchase_price,
          data.stock_quantity,
          data.minimum_stock_level || 10,
        );

      db.prepare(
        `
        INSERT INTO inventory_transactions (product_id, transaction_type, quantity, notes)
        VALUES (?, 'in', ?, 'Initial stock')
      `,
      ).run(result.lastInsertRowid, data.stock_quantity);

      const product = db
        .prepare(
          `
        SELECT p.*, c.name as company_name 
        FROM products p 
        LEFT JOIN companies c ON p.company_id = c.id 
        WHERE p.id = ?
      `,
        )
        .get(result.lastInsertRowid) as ProductWithCompany;

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
          composition = COALESCE(?, composition),
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
        data.composition ?? null,
        data.batch_number?.trim() ?? null,
        data.expiry_date ?? null,
        data.mrp ?? null,
        data.purchase_price ?? null,
        data.stock_quantity ?? null,
        data.minimum_stock_level ?? null,
        id,
      );

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

      res.json(product);
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
