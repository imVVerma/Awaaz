import { Router, Request, Response } from "express";
import db from "../db";
import type {
  Supplier,
  CreateSupplierInput,
  Purchase,
  PurchaseItem,
  CreatePurchaseInput,
} from "@shared/types";

export const suppliersRouter = Router();
export const purchasesRouter = Router();

// ================= SUPPLIERS (VENDORS) =================

// GET /api/suppliers - List active suppliers
suppliersRouter.get("/", (_req: Request, res: Response) => {
  try {
    const suppliers = db
      .prepare("SELECT * FROM suppliers WHERE is_active = 1 ORDER BY name ASC")
      .all() as Supplier[];
    res.json(suppliers);
  } catch (error) {
    console.error("Error fetching suppliers:", error);
    res.status(500).json({ error: "Failed to fetch suppliers" });
  }
});

// GET /api/suppliers/:id - Supplier details
suppliersRouter.get("/:id", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const supplier = db
      .prepare("SELECT * FROM suppliers WHERE id = ?")
      .get(id) as Supplier | undefined;

    if (!supplier) {
      return res.status(404).json({ error: "Supplier not found" });
    }

    res.json(supplier);
  } catch (error) {
    console.error("Error fetching supplier details:", error);
    res.status(500).json({ error: "Failed to fetch supplier details" });
  }
});

// POST /api/suppliers - Create supplier
suppliersRouter.post("/", (req: Request, res: Response) => {
  try {
    const data: CreateSupplierInput = req.body;

    if (!data.name || data.name.trim() === "") {
      return res.status(400).json({ error: "Supplier name is required" });
    }

    const cleanName = data.name.trim();
    const existing = db
      .prepare("SELECT id FROM suppliers WHERE name = ? AND is_active = 1")
      .get(cleanName);
    if (existing) {
      return res
        .status(400)
        .json({ error: "Supplier with this name already exists" });
    }

    const result = db
      .prepare(
        `
      INSERT INTO suppliers (
        name, contact_person, phone, email, address, gstin, dl_number, payment_terms_days, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `,
      )
      .run(
        cleanName,
        data.contact_person?.trim() || null,
        data.phone?.trim() || null,
        data.email?.trim() || null,
        data.address?.trim() || null,
        data.gstin?.trim() || null,
        data.dl_number?.trim() || null,
        data.payment_terms_days ? Number(data.payment_terms_days) : 30,
      );

    const newSupplier = db
      .prepare("SELECT * FROM suppliers WHERE id = ?")
      .get(result.lastInsertRowid) as Supplier;

    res.status(201).json(newSupplier);
  } catch (error) {
    console.error("Error creating supplier:", error);
    res.status(500).json({ error: "Failed to create supplier" });
  }
});

// ================= PURCHASES (INBOUND INVOICES) =================

// GET /api/purchases - List purchase invoices
purchasesRouter.get("/", (req: Request, res: Response) => {
  try {
    const { supplier_id, search } = req.query;

    let query = `
      SELECT 
        p.*,
        s.name as supplier_name,
        s.phone as supplier_phone,
        (SELECT COUNT(*) FROM purchase_items WHERE purchase_id = p.id) as items_count
      FROM purchases p
      JOIN suppliers s ON p.supplier_id = s.id
      WHERE 1=1
    `;
    const params: (string | number)[] = [];

    if (supplier_id) {
      query += " AND p.supplier_id = ?";
      params.push(Number(supplier_id));
    }

    if (search && typeof search === "string" && search.trim() !== "") {
      query += ` AND (p.purchase_invoice_number LIKE ? OR s.name LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term);
    }

    query += " ORDER BY p.invoice_date DESC, p.id DESC";

    const purchases = db.prepare(query).all(...params) as (Purchase & {
      supplier_name: string;
      supplier_phone: string;
      items_count: number;
    })[];

    res.json(purchases);
  } catch (error) {
    console.error("Error fetching purchases:", error);
    res.status(500).json({ error: "Failed to fetch purchases" });
  }
});

// GET /api/purchases/:id - Detail view with line items
purchasesRouter.get("/:id", (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const purchase = db
      .prepare(
        `
      SELECT 
        p.*,
        s.name as supplier_name,
        s.contact_person as supplier_contact,
        s.phone as supplier_phone,
        s.gstin as supplier_gstin,
        s.address as supplier_address
      FROM purchases p
      JOIN suppliers s ON p.supplier_id = s.id
      WHERE p.id = ?
    `,
      )
      .get(id) as Purchase | undefined;

    if (!purchase) {
      return res.status(404).json({ error: "Purchase invoice not found" });
    }

    const items = db
      .prepare(
        `
      SELECT 
        pi.*,
        p.product_name,
        c.name as company_name
      FROM purchase_items pi
      JOIN products p ON pi.product_id = p.id
      JOIN companies c ON p.company_id = c.id
      WHERE pi.purchase_id = ?
      ORDER BY pi.id ASC
    `,
      )
      .all(id) as PurchaseItem[];

    res.json({
      ...purchase,
      items,
    });
  } catch (error) {
    console.error("Error fetching purchase details:", error);
    res.status(500).json({ error: "Failed to fetch purchase details" });
  }
});

// POST /api/purchases - Atomic Inbound Stock Purchase
purchasesRouter.post("/", (req: Request, res: Response) => {
  try {
    const body: CreatePurchaseInput = req.body;

    if (!body.supplier_id) {
      return res.status(400).json({ error: "Supplier ID is required" });
    }
    if (
      !body.purchase_invoice_number ||
      body.purchase_invoice_number.trim() === ""
    ) {
      return res
        .status(400)
        .json({ error: "Supplier invoice number is required" });
    }
    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return res
        .status(400)
        .json({ error: "Purchase must contain at least one product lot item" });
    }

    const supplier = db
      .prepare("SELECT * FROM suppliers WHERE id = ?")
      .get(body.supplier_id) as Supplier | undefined;
    if (!supplier) {
      return res.status(404).json({ error: "Supplier not found" });
    }

    const invoiceDate =
      body.invoice_date || new Date().toISOString().split("T")[0];
    const paymentTerms = supplier.payment_terms_days || 30;
    const dueDateObj = new Date(invoiceDate);
    dueDateObj.setDate(dueDateObj.getDate() + paymentTerms);
    const dueDate = body.due_date || dueDateObj.toISOString().split("T")[0];

    // Transaction execution
    const createPurchaseTx = db.transaction(() => {
      let subtotal = 0;
      let totalTax = 0;
      let grandTotal = 0;

      const processedItems: {
        product_id: number;
        batch_id: number;
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
      }[] = [];

      for (const item of body.items) {
        if (!item.product_id) {
          throw new Error("Product ID is required for each line item");
        }
        if (!item.batch_number || item.batch_number.trim() === "") {
          throw new Error("Batch number is required for each line item");
        }
        if (!item.expiry_date) {
          throw new Error("Expiry date is required for each line item");
        }
        if (!item.quantity || Number(item.quantity) <= 0) {
          throw new Error("Received quantity must be greater than zero");
        }
        if (!item.purchase_price || Number(item.purchase_price) <= 0) {
          throw new Error("Purchase price must be greater than zero");
        }

        const product = db
          .prepare("SELECT * FROM products WHERE id = ?")
          .get(item.product_id) as any;
        if (!product) {
          throw new Error(`Product ID ${item.product_id} not found in catalog`);
        }

        const qty = Number(item.quantity);
        const buyPrice = Number(item.purchase_price);
        const itemMrp = item.mrp ? Number(item.mrp) : buyPrice * 1.25;
        const sellPrice = item.selling_price
          ? Number(item.selling_price)
          : itemMrp * 0.85;
        const taxRate =
          item.tax_rate !== undefined
            ? Number(item.tax_rate)
            : Number(product.gst_rate || 12);

        const taxableValue = Math.round(qty * buyPrice * 100) / 100;
        const taxAmount =
          Math.round(taxableValue * (taxRate / 100) * 100) / 100;
        const lineTotal = Math.round((taxableValue + taxAmount) * 100) / 100;

        subtotal += taxableValue;
        totalTax += taxAmount;
        grandTotal += lineTotal;

        const cleanBatchNum = item.batch_number.trim();

        // 1. Check if batch lot exists for this product
        const existingBatch = db
          .prepare(
            `
          SELECT * FROM product_batches 
          WHERE product_id = ? AND batch_number = ?
        `,
          )
          .get(item.product_id, cleanBatchNum) as any;

        let batchId: number;
        if (existingBatch) {
          batchId = existingBatch.id;
          // Increase batch quantity
          db.prepare(
            `
            UPDATE product_batches 
            SET current_quantity = current_quantity + ?,
                purchase_price = ?,
                mrp = ?,
                selling_price = ?,
                expiry_date = ?,
                updated_at = datetime('now')
            WHERE id = ?
          `,
          ).run(qty, buyPrice, itemMrp, sellPrice, item.expiry_date, batchId);
        } else {
          // Insert new batch lot
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
              item.product_id,
              cleanBatchNum,
              item.expiry_date,
              itemMrp,
              buyPrice,
              sellPrice,
              qty,
              qty,
            );
          batchId = Number(insertBatch.lastInsertRowid);
        }

        // 2. Increase product master stock
        db.prepare(
          `
          UPDATE products 
          SET stock_quantity = stock_quantity + ?,
              updated_at = datetime('now')
          WHERE id = ?
        `,
        ).run(qty, item.product_id);

        processedItems.push({
          product_id: item.product_id,
          batch_id: batchId,
          batch_number: cleanBatchNum,
          expiry_date: item.expiry_date,
          quantity: qty,
          purchase_price: buyPrice,
          mrp: itemMrp,
          selling_price: sellPrice,
          tax_rate: taxRate,
          taxable_value: taxableValue,
          tax_amount: taxAmount,
          line_total: lineTotal,
        });
      }

      // 3. Insert Purchase Inbound Invoice
      const insertPurchase = db
        .prepare(
          `
        INSERT INTO purchases (
          purchase_invoice_number, supplier_id, invoice_date, due_date,
          subtotal, tax_amount, total_amount, paid_amount, payment_status, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'unpaid', ?)
      `,
        )
        .run(
          body.purchase_invoice_number.trim(),
          body.supplier_id,
          invoiceDate,
          dueDate,
          subtotal,
          totalTax,
          grandTotal,
          body.notes?.trim() || null,
        );

      const purchaseId = Number(insertPurchase.lastInsertRowid);

      // 4. Insert Purchase Line Items and Log Inventory Transactions
      const insertItemStmt = db.prepare(`
        INSERT INTO purchase_items (
          purchase_id, product_id, batch_id, batch_number, expiry_date,
          quantity, purchase_price, mrp, selling_price, tax_rate, taxable_value, tax_amount, line_total
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const insertTxStmt = db.prepare(`
        INSERT INTO inventory_transactions (
          product_id, batch_id, transaction_type, quantity, notes
        ) VALUES (?, ?, 'in', ?, ?)
      `);

      for (const pItem of processedItems) {
        insertItemStmt.run(
          purchaseId,
          pItem.product_id,
          pItem.batch_id,
          pItem.batch_number,
          pItem.expiry_date,
          pItem.quantity,
          pItem.purchase_price,
          pItem.mrp,
          pItem.selling_price,
          pItem.tax_rate,
          pItem.taxable_value,
          pItem.tax_amount,
          pItem.line_total,
        );

        insertTxStmt.run(
          pItem.product_id,
          pItem.batch_id,
          pItem.quantity,
          `Purchase Invoice ${body.purchase_invoice_number.trim()}`,
        );
      }

      return purchaseId;
    });

    const newPurchaseId = createPurchaseTx();
    const created = db
      .prepare(
        `
      SELECT 
        p.*,
        s.name as supplier_name,
        (SELECT COUNT(*) FROM purchase_items WHERE purchase_id = p.id) as items_count
      FROM purchases p
      JOIN suppliers s ON p.supplier_id = s.id
      WHERE p.id = ?
    `,
      )
      .get(newPurchaseId);

    res.status(201).json(created);
  } catch (error: any) {
    console.error("Error recording purchase:", error);
    res
      .status(400)
      .json({ error: error.message || "Failed to record purchase" });
  }
});
