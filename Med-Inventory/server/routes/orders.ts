import { Router, Request, Response } from "express";
import db from "../db";
import type { Order, OrderItem, CreateOrderInput } from "@shared/types";

export const ordersRouter = Router();

// GET /api/orders
ordersRouter.get("/", (req: Request, res: Response) => {
  try {
    const { status, customer_id, search } = req.query;

    let query = `
      SELECT 
        o.*,
        c.store_name as customer_name,
        c.phone as customer_phone,
        (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as items_count
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      WHERE 1=1
    `;
    const params: (string | number)[] = [];

    if (customer_id) {
      query += " AND o.customer_id = ?";
      params.push(Number(customer_id));
    }

    if (status && status !== "all") {
      query += " AND o.status = ?";
      params.push(String(status));
    }

    if (search && typeof search === "string" && search.trim() !== "") {
      query += ` AND (o.invoice_number LIKE ? OR c.store_name LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term);
    }

    query += " ORDER BY o.order_date DESC, o.id DESC";

    const orders = db.prepare(query).all(...params) as (Order & {
      customer_name: string;
      customer_phone: string;
      items_count: number;
    })[];

    // Dynamically update status to Overdue if due_date has passed and unpaid
    const today = new Date().toISOString().split("T")[0];
    const normalized = orders.map((ord) => {
      if (
        ord.paid_amount < ord.total_amount &&
        ord.due_date < today &&
        ord.status !== "Cancelled"
      ) {
        return { ...ord, status: "Overdue" as const };
      }
      return ord;
    });

    res.json(normalized);
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// GET /api/orders/:id
ordersRouter.get("/:id", (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const orderQuery = `
      SELECT 
        o.*,
        c.store_name as customer_name,
        c.contact_person as customer_contact,
        c.phone as customer_phone,
        c.gstin as customer_gstin,
        c.billing_address as customer_address
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      WHERE o.id = ?
    `;

    const order = db.prepare(orderQuery).get(id) as
      | (Order & {
          customer_name: string;
          customer_contact: string;
          customer_phone: string;
          customer_gstin: string;
          customer_address: string;
        })
      | undefined;

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Line items with product name, company name, and batch info
    const itemsQuery = `
      SELECT 
        oi.*,
        p.product_name,
        p.uom,
        c.name as company_name,
        b.batch_number,
        b.expiry_date
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      JOIN companies c ON p.company_id = c.id
      JOIN product_batches b ON oi.batch_id = b.id
      WHERE oi.order_id = ?
      ORDER BY oi.id ASC
    `;
    const items = db.prepare(itemsQuery).all(id) as OrderItem[];

    // Payments settled against this order
    const payments = db
      .prepare(
        "SELECT * FROM payments WHERE order_id = ? ORDER BY payment_date DESC",
      )
      .all(id);

    res.json({
      ...order,
      items,
      payments,
    });
  } catch (error) {
    console.error("Error fetching order detail:", error);
    res.status(500).json({ error: "Failed to fetch order detail" });
  }
});

// POST /api/orders - Atomic Order Creation with Multi-Batch Deductions & Ledger Posting
ordersRouter.post("/", (req: Request, res: Response) => {
  try {
    const body: CreateOrderInput & {
      initial_payment?: {
        amount: number;
        payment_method: "cash" | "upi" | "bank_transfer" | "cheque";
        reference_number?: string;
      };
    } = req.body;

    if (!body.customer_id) {
      return res.status(400).json({ error: "Customer ID is required" });
    }
    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return res
        .status(400)
        .json({ error: "Order must have at least one product item" });
    }

    const customer = db
      .prepare("SELECT * FROM customers WHERE id = ?")
      .get(body.customer_id) as any;
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const settings = db
      .prepare("SELECT * FROM distributor_settings WHERE id = 1")
      .get() as any;
    const invoicePrefix = settings?.invoice_prefix || "INV-";
    const nextNum = settings?.next_invoice_number || 1001;
    const invoiceNumber = `${invoicePrefix}${nextNum}`;

    const orderDate = body.order_date || new Date().toISOString().split("T")[0];
    const paymentTerms =
      customer.payment_terms_days ?? settings?.default_payment_terms_days ?? 15;
    const dueDateObj = new Date(orderDate);
    dueDateObj.setDate(dueDateObj.getDate() + paymentTerms);
    const dueDate = dueDateObj.toISOString().split("T")[0];

    // Transaction execution
    const createOrderTx = db.transaction(() => {
      let subtotal = 0;
      let totalTax = 0;
      let grandTotal = 0;

      // Validate batches and stocks
      const calculatedItems: {
        product_id: number;
        batch_id: number;
        quantity: number;
        unit_price: number;
        discount_percent: number;
        tax_rate: number;
        taxable_value: number;
        tax_amount: number;
        line_total: number;
      }[] = [];

      for (const item of body.items) {
        if (
          !item.product_id ||
          !item.batch_id ||
          !item.quantity ||
          item.quantity <= 0
        ) {
          throw new Error(
            "Invalid item parameters: product_id, batch_id, and positive quantity required",
          );
        }

        const batch = db
          .prepare(
            "SELECT * FROM product_batches WHERE id = ? AND product_id = ?",
          )
          .get(item.batch_id, item.product_id) as any;

        if (!batch) {
          throw new Error(
            `Batch ID ${item.batch_id} not found for product ID ${item.product_id}`,
          );
        }

        if (batch.current_quantity < item.quantity) {
          throw new Error(
            `Insufficient stock for batch ${batch.batch_number}. Available: ${batch.current_quantity}, Requested: ${item.quantity}`,
          );
        }

        const product = db
          .prepare("SELECT * FROM products WHERE id = ?")
          .get(item.product_id) as any;
        const unitPrice =
          item.unit_price > 0
            ? Number(item.unit_price)
            : Number(batch.selling_price || batch.mrp);
        const discountPercent = item.discount_percent
          ? Number(item.discount_percent)
          : 0;
        const taxRate =
          item.tax_rate !== undefined
            ? Number(item.tax_rate)
            : Number(product?.gst_rate || 12);

        const gross = item.quantity * unitPrice;
        const discountAmount = gross * (discountPercent / 100);
        const taxableValue = Math.round((gross - discountAmount) * 100) / 100;
        const taxAmount =
          Math.round(taxableValue * (taxRate / 100) * 100) / 100;
        const lineTotal = Math.round((taxableValue + taxAmount) * 100) / 100;

        subtotal += taxableValue;
        totalTax += taxAmount;
        grandTotal += lineTotal;

        calculatedItems.push({
          product_id: item.product_id,
          batch_id: item.batch_id,
          quantity: item.quantity,
          unit_price: unitPrice,
          discount_percent: discountPercent,
          tax_rate: taxRate,
          taxable_value: taxableValue,
          tax_amount: taxAmount,
          line_total: lineTotal,
        });
      }

      // 1. Insert Order
      const initialPaid = body.initial_payment?.amount
        ? Math.min(grandTotal, Number(body.initial_payment.amount))
        : 0;
      let orderStatus: Order["status"] = "Outstanding";
      if (initialPaid >= grandTotal) {
        orderStatus = "Paid";
      } else if (initialPaid > 0) {
        orderStatus = "Partially Paid";
      }

      const insertOrder = db
        .prepare(
          `
        INSERT INTO orders (
          invoice_number, customer_id, order_date, due_date, subtotal,
          discount_amount, tax_amount, total_amount, paid_amount, status, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        )
        .run(
          invoiceNumber,
          body.customer_id,
          orderDate,
          dueDate,
          subtotal,
          0,
          totalTax,
          grandTotal,
          initialPaid,
          orderStatus,
          body.notes?.trim() || null,
        );

      const orderId = insertOrder.lastInsertRowid;

      // 2. Insert Order Items & Deduct Stock
      const insertItemStmt = db.prepare(`
        INSERT INTO order_items (
          order_id, product_id, batch_id, quantity, unit_price,
          discount_percent, tax_rate, taxable_value, tax_amount, line_total
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const updateBatchStmt = db.prepare(`
        UPDATE product_batches 
        SET current_quantity = current_quantity - ?, updated_at = datetime('now')
        WHERE id = ?
      `);

      const updateProdStmt = db.prepare(`
        UPDATE products 
        SET stock_quantity = stock_quantity - ?, updated_at = datetime('now')
        WHERE id = ?
      `);

      const insertTxStmt = db.prepare(`
        INSERT INTO inventory_transactions (
          product_id, batch_id, order_id, transaction_type, quantity, notes
        ) VALUES (?, ?, ?, 'sale', ?, ?)
      `);

      for (const item of calculatedItems) {
        insertItemStmt.run(
          orderId,
          item.product_id,
          item.batch_id,
          item.quantity,
          item.unit_price,
          item.discount_percent,
          item.tax_rate,
          item.taxable_value,
          item.tax_amount,
          item.line_total,
        );

        updateBatchStmt.run(item.quantity, item.batch_id);
        updateProdStmt.run(item.quantity, item.product_id);
        insertTxStmt.run(
          item.product_id,
          item.batch_id,
          orderId,
          item.quantity,
          `Invoice ${invoiceNumber}`,
        );
      }

      // 3. Post Debit Entry to Customer Ledger
      db.prepare(
        `
        INSERT INTO customer_ledger (
          customer_id, entry_type, reference_id, debit, credit, running_balance, notes
        ) VALUES (?, 'invoice', ?, ?, 0, 0, ?)
      `,
      ).run(
        body.customer_id,
        orderId,
        grandTotal,
        `Invoice ${invoiceNumber} created`,
      );

      // 4. Handle Upfront Payment if provided
      if (initialPaid > 0 && body.initial_payment) {
        db.prepare(
          `
          INSERT INTO payments (
            customer_id, order_id, amount, payment_method, reference_number, notes
          ) VALUES (?, ?, ?, ?, ?, ?)
        `,
        ).run(
          body.customer_id,
          orderId,
          initialPaid,
          body.initial_payment.payment_method || "cash",
          body.initial_payment.reference_number || null,
          `Initial settlement for ${invoiceNumber}`,
        );

        db.prepare(
          `
          INSERT INTO customer_ledger (
            customer_id, entry_type, reference_id, debit, credit, running_balance, notes
          ) VALUES (?, 'payment', ?, 0, ?, 0, ?)
        `,
        ).run(
          body.customer_id,
          orderId,
          initialPaid,
          `Payment for ${invoiceNumber}`,
        );
      }

      // 5. Increment Next Invoice Number
      db.prepare(
        `
        UPDATE distributor_settings 
        SET next_invoice_number = next_invoice_number + 1, updated_at = datetime('now')
        WHERE id = 1
      `,
      ).run();

      return orderId;
    });

    const newOrderId = createOrderTx();
    const createdOrder = db
      .prepare("SELECT * FROM orders WHERE id = ?")
      .get(newOrderId);

    res.status(201).json(createdOrder);
  } catch (error: any) {
    console.error("Error creating order:", error);
    res.status(400).json({ error: error.message || "Failed to create order" });
  }
});

// POST /api/orders/:id/cancel - Reverse Order, Restore Inventory, and Credit Customer Ledger
ordersRouter.post("/:id/cancel", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason = "Order cancelled by distributor" } = req.body;

    const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(id) as
      | any
      | undefined;

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (String(order.status).toLowerCase() === "cancelled") {
      return res.status(400).json({ error: "Order is already cancelled" });
    }

    const cancelTx = db.transaction(() => {
      // 1. Get all line items for this order
      const items = db
        .prepare("SELECT * FROM order_items WHERE order_id = ?")
        .all(id) as OrderItem[];

      // 2. Restore physical batch stock and product aggregate stock, logging reversal
      for (const item of items) {
        db.prepare(
          `UPDATE product_batches 
           SET current_quantity = current_quantity + ?, updated_at = datetime('now')
           WHERE id = ?`,
        ).run(item.quantity, item.batch_id);

        db.prepare(
          `UPDATE products 
           SET stock_quantity = (SELECT COALESCE(SUM(current_quantity), 0) FROM product_batches WHERE product_id = ?),
               updated_at = datetime('now')
           WHERE id = ?`,
        ).run(item.product_id, item.product_id);

        db.prepare(
          `INSERT INTO inventory_transactions (
            product_id, batch_id, order_id, transaction_type, quantity, notes
          ) VALUES (?, ?, ?, 'return', ?, ?)`,
        ).run(
          item.product_id,
          item.batch_id,
          order.id,
          item.quantity,
          `Cancelled invoice ${order.invoice_number}: ${reason}`,
        );
      }

      // 3. Reverse customer receivables in ledger
      db.prepare(
        `INSERT INTO customer_ledger (
          customer_id, entry_type, reference_id, debit, credit, running_balance, notes
        ) VALUES (?, 'credit_note', ?, 0, ?, 0, ?)`,
      ).run(
        order.customer_id,
        order.id,
        order.total_amount,
        `Reversal for cancelled invoice ${order.invoice_number}: ${reason}`,
      );

      // 4. Update order status to 'Cancelled'
      db.prepare(
        `UPDATE orders 
         SET status = 'Cancelled', notes = COALESCE(notes || ' | ', '') || 'Cancelled: ' || ?, updated_at = datetime('now')
         WHERE id = ?`,
      ).run(reason, order.id);
    });

    cancelTx();

    const updatedOrder = db
      .prepare("SELECT * FROM orders WHERE id = ?")
      .get(id);

    res.json({
      success: true,
      message: `Invoice ${order.invoice_number} successfully cancelled and inventory restored.`,
      order: updatedOrder,
    });
  } catch (error: any) {
    console.error("Error cancelling order:", error);
    res.status(500).json({ error: error.message || "Failed to cancel order" });
  }
});
