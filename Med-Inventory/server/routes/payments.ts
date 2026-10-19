import { Router, Request, Response } from "express";
import db from "../db";
import type { Payment } from "@shared/types";

export const paymentsRouter = Router();

// GET /api/payments
paymentsRouter.get("/", (req: Request, res: Response) => {
  try {
    const { customer_id } = req.query;

    let query = `
      SELECT 
        p.*,
        c.store_name as customer_name,
        o.invoice_number
      FROM payments p
      JOIN customers c ON p.customer_id = c.id
      LEFT JOIN orders o ON p.order_id = o.id
      WHERE 1=1
    `;
    const params: (string | number)[] = [];

    if (customer_id) {
      query += " AND p.customer_id = ?";
      params.push(Number(customer_id));
    }

    query += " ORDER BY p.payment_date DESC, p.id DESC";

    const payments = db.prepare(query).all(...params) as Payment[];
    res.json(payments);
  } catch (error) {
    console.error("Error fetching payments:", error);
    res.status(500).json({ error: "Failed to fetch payments" });
  }
});

// POST /api/payments
paymentsRouter.post("/", (req: Request, res: Response) => {
  try {
    const {
      customer_id,
      order_id,
      amount,
      payment_method,
      reference_number,
      notes,
    } = req.body;

    if (!customer_id) {
      return res.status(400).json({ error: "Customer ID is required" });
    }
    const payAmount = Number(amount);
    if (!payAmount || payAmount <= 0) {
      return res
        .status(400)
        .json({ error: "Payment amount must be greater than zero" });
    }

    const customer = db
      .prepare("SELECT * FROM customers WHERE id = ?")
      .get(customer_id) as any;
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const recordPaymentTx = db.transaction(() => {
      // 1. Insert Payment
      const insertPayment = db
        .prepare(
          `
        INSERT INTO payments (
          customer_id, order_id, amount, payment_method, reference_number, notes
        ) VALUES (?, ?, ?, ?, ?, ?)
      `,
        )
        .run(
          customer_id,
          order_id || null,
          payAmount,
          payment_method || "bank_transfer",
          reference_number?.trim() || null,
          notes?.trim() || null,
        );

      const paymentId = insertPayment.lastInsertRowid;

      // 2. Post Credit to Customer Ledger
      let invoiceRef = "";
      if (order_id) {
        const ord = db
          .prepare("SELECT invoice_number FROM orders WHERE id = ?")
          .get(order_id) as any;
        invoiceRef = ord?.invoice_number ? ` for ${ord.invoice_number}` : "";
      }

      db.prepare(
        `
        INSERT INTO customer_ledger (
          customer_id, entry_type, reference_id, debit, credit, running_balance, notes
        ) VALUES (?, 'payment', ?, 0, ?, 0, ?)
      `,
      ).run(
        customer_id,
        paymentId,
        payAmount,
        `Payment received (${payment_method || "bank_transfer"})${invoiceRef}`,
      );

      // 3. Update Invoice Settlement
      if (order_id) {
        const order = db
          .prepare("SELECT * FROM orders WHERE id = ?")
          .get(order_id) as any;
        if (order) {
          const newPaid = order.paid_amount + payAmount;
          let newStatus = order.status;
          if (newPaid >= order.total_amount) {
            newStatus = "Paid";
          } else if (newPaid > 0) {
            newStatus = "Partially Paid";
          }

          db.prepare(
            `
            UPDATE orders 
            SET paid_amount = ?, status = ?, updated_at = datetime('now')
            WHERE id = ?
          `,
          ).run(newPaid, newStatus, order_id);
        }
      } else {
        // FIFO auto-allocation: Apply payment to oldest outstanding invoices for this customer
        let remaining = payAmount;
        const outstandingOrders = db
          .prepare(
            `
          SELECT * FROM orders 
          WHERE customer_id = ? AND paid_amount < total_amount AND status != 'Cancelled'
          ORDER BY order_date ASC, id ASC
        `,
          )
          .all(customer_id) as any[];

        for (const ord of outstandingOrders) {
          if (remaining <= 0) break;
          const due = ord.total_amount - ord.paid_amount;
          const apply = Math.min(remaining, due);
          const newPaid = ord.paid_amount + apply;
          const newStatus =
            newPaid >= ord.total_amount ? "Paid" : "Partially Paid";

          db.prepare(
            `
            UPDATE orders 
            SET paid_amount = ?, status = ?, updated_at = datetime('now')
            WHERE id = ?
          `,
          ).run(newPaid, newStatus, ord.id);

          remaining -= apply;
        }
      }

      return paymentId;
    });

    const newPaymentId = recordPaymentTx();
    const createdPayment = db
      .prepare("SELECT * FROM payments WHERE id = ?")
      .get(newPaymentId) as Record<string, any>;

    // Get current updated balance
    const balance = db
      .prepare(
        `
      SELECT SUM(debit) - SUM(credit) as bal 
      FROM customer_ledger 
      WHERE customer_id = ?
    `,
      )
      .get(customer_id) as { bal: number };

    res.status(201).json({
      ...(createdPayment || {}),
      updated_balance: balance?.bal || 0,
    });
  } catch (error) {
    console.error("Error recording payment:", error);
    res.status(500).json({ error: "Failed to record payment" });
  }
});
