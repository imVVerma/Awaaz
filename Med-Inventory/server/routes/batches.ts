import { Router, Request, Response } from "express";
import db from "../db";
import type { ProductBatch } from "@shared/types";

export const batchesRouter = Router();

// GET /api/batches/expiring - Filtered expiring soon and expired batch lots
batchesRouter.get("/expiring", (req: Request, res: Response) => {
  try {
    const { days = "90", status } = req.query;
    const today = new Date().toISOString().split("T")[0];

    let query = `
      SELECT 
        b.id,
        b.product_id,
        p.product_name,
        c.name as company_name,
        b.batch_number,
        b.expiry_date,
        b.current_quantity,
        CAST(julianday(b.expiry_date) - julianday(?) AS INTEGER) as days_until_expiry,
        CASE WHEN date(b.expiry_date) < date(?) THEN 1 ELSE 0 END as is_expired
      FROM product_batches b
      JOIN products p ON b.product_id = p.id
      JOIN companies c ON p.company_id = c.id
      WHERE b.is_active = 1 AND b.current_quantity > 0
    `;
    const params: (string | number)[] = [today, today];

    if (status === "expired" || days === "expired") {
      query += " AND date(b.expiry_date) < date(?)";
      params.push(today);
    } else {
      const numDays = Number(days) || 90;
      query +=
        " AND date(b.expiry_date) >= date(?) AND date(b.expiry_date) <= date(?, '+' || ? || ' days')";
      params.push(today, today, numDays);
    }

    query += " ORDER BY b.expiry_date ASC, b.current_quantity DESC";

    const items = db.prepare(query).all(...params);
    res.json(items);
  } catch (error) {
    console.error("Error fetching expiring batches:", error);
    res.status(500).json({ error: "Failed to fetch expiring batches" });
  }
});

// GET /api/batches - List all active batches with product and company details
batchesRouter.get("/", (req: Request, res: Response) => {
  try {
    const { product_id, expiring_within_days } = req.query;

    let query = `
      SELECT 
        b.*,
        p.product_name,
        p.category,
        p.uom,
        c.name as company_name
      FROM product_batches b
      JOIN products p ON b.product_id = p.id
      JOIN companies c ON p.company_id = c.id
      WHERE b.is_active = 1
    `;
    const params: (string | number)[] = [];

    if (product_id) {
      query += " AND b.product_id = ?";
      params.push(Number(product_id));
    }

    if (expiring_within_days) {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + Number(expiring_within_days));
      query += " AND date(b.expiry_date) <= date(?)";
      params.push(targetDate.toISOString().split("T")[0]);
    }

    query += " ORDER BY b.expiry_date ASC, b.current_quantity DESC";

    const batches = db.prepare(query).all(...params);
    res.json(batches);
  } catch (error) {
    console.error("Error fetching batches:", error);
    res.status(500).json({ error: "Failed to fetch batches" });
  }
});

// GET /api/products/:id/batches - Batches for a specific product
batchesRouter.get("/product/:productId", (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const batches = db
      .prepare(
        `
        SELECT * 
        FROM product_batches 
        WHERE product_id = ? AND is_active = 1
        ORDER BY expiry_date ASC
      `,
      )
      .all(productId) as ProductBatch[];

    res.json(batches);
  } catch (error) {
    console.error("Error fetching product batches:", error);
    res.status(500).json({ error: "Failed to fetch product batches" });
  }
});

// POST /api/batches - Add a new batch to an existing product
batchesRouter.post("/", (req: Request, res: Response) => {
  try {
    const {
      product_id,
      batch_number,
      expiry_date,
      mrp,
      purchase_price,
      selling_price,
      quantity,
    } = req.body;

    if (!product_id) {
      return res.status(400).json({ error: "Product ID is required" });
    }
    if (!batch_number || batch_number.trim() === "") {
      return res.status(400).json({ error: "Batch number is required" });
    }
    if (!expiry_date) {
      return res.status(400).json({ error: "Expiry date is required" });
    }
    if (!quantity || Number(quantity) <= 0) {
      return res.status(400).json({ error: "Quantity must be greater than 0" });
    }

    const cleanBatchNum = batch_number.trim();
    const qty = Number(quantity);
    const parsedMrp = Number(mrp);
    const parsedPurchase = Number(purchase_price);
    const parsedSelling = selling_price
      ? Number(selling_price)
      : parsedMrp * 0.85;

    const product = db
      .prepare("SELECT * FROM products WHERE id = ?")
      .get(product_id) as any;
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    const addBatchTx = db.transaction(() => {
      // 1. Insert Batch
      const insertBatch = db
        .prepare(
          `
        INSERT INTO product_batches (
          product_id, batch_number, expiry_date, mrp, purchase_price, selling_price,
          initial_quantity, current_quantity, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
      `,
        )
        .run(
          product_id,
          cleanBatchNum,
          expiry_date,
          parsedMrp,
          parsedPurchase,
          parsedSelling,
          qty,
          qty,
        );

      const batchId = insertBatch.lastInsertRowid;

      // 2. Update Product's total stock
      db.prepare(
        `
        UPDATE products 
        SET stock_quantity = stock_quantity + ?, updated_at = datetime('now')
        WHERE id = ?
      `,
      ).run(qty, product_id);

      // 3. Log inventory transaction
      db.prepare(
        `
        INSERT INTO inventory_transactions (
          product_id, batch_id, transaction_type, quantity, notes
        ) VALUES (?, ?, 'in', ?, ?)
      `,
      ).run(product_id, batchId, qty, `New batch lot ${cleanBatchNum}`);

      return batchId;
    });

    const newBatchId = addBatchTx();
    const createdBatch = db
      .prepare("SELECT * FROM product_batches WHERE id = ?")
      .get(newBatchId);

    res.status(201).json(createdBatch);
  } catch (error) {
    console.error("Error creating batch:", error);
    res.status(500).json({ error: "Failed to create batch" });
  }
});
