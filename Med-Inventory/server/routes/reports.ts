import { Router, Request, Response } from "express";
import db from "../db";

export const reportsRouter = Router();

// GET /api/reports/receivables-aging
reportsRouter.get("/receivables-aging", (_req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().split("T")[0];

    // Fetch all unpaid orders (excluding Cancelled)
    const unpaidOrders = db
      .prepare(
        `
      SELECT 
        o.id,
        o.invoice_number,
        o.customer_id,
        c.store_name as customer_name,
        c.phone as customer_phone,
        o.order_date,
        o.due_date,
        o.total_amount,
        o.paid_amount,
        (o.total_amount - o.paid_amount) as outstanding_amount,
        CAST(julianday(?) - julianday(o.due_date) AS INTEGER) as days_overdue
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      WHERE o.paid_amount < o.total_amount AND LOWER(o.status) != 'cancelled'
      ORDER BY days_overdue DESC
    `,
      )
      .all(today) as {
      id: number;
      invoice_number: string;
      customer_id: number;
      customer_name: string;
      customer_phone: string;
      order_date: string;
      due_date: string;
      total_amount: number;
      paid_amount: number;
      outstanding_amount: number;
      days_overdue: number;
    }[];

    const buckets = {
      // Standard exact operational boundaries
      not_yet_due: 0, // days_overdue <= 0
      days_1_14: 0, // 1 <= days_overdue <= 14
      days_15_30: 0, // 15 <= days_overdue <= 30
      days_31_60: 0, // 31 <= days_overdue <= 60
      days_61_plus: 0, // days_overdue >= 61
      total_receivables: 0,

      // Aliases for backward compatibility
      current: 0,
      days_1_15: 0,
      days_16_30: 0,
      days_60_plus: 0,
    };

    const customerMap: Record<
      number,
      {
        customer_id: number;
        customer_name: string;
        customer_phone: string;
        not_yet_due: number;
        days_1_14: number;
        days_15_30: number;
        days_31_60: number;
        days_61_plus: number;
        current: number;
        days_1_15: number;
        days_16_30: number;
        days_60_plus: number;
        total_outstanding: number;
        invoices_count: number;
      }
    > = {};

    for (const ord of unpaidOrders) {
      const amount = ord.outstanding_amount;
      buckets.total_receivables += amount;

      if (!customerMap[ord.customer_id]) {
        customerMap[ord.customer_id] = {
          customer_id: ord.customer_id,
          customer_name: ord.customer_name,
          customer_phone: ord.customer_phone,
          not_yet_due: 0,
          days_1_14: 0,
          days_15_30: 0,
          days_31_60: 0,
          days_61_plus: 0,
          current: 0,
          days_1_15: 0,
          days_16_30: 0,
          days_60_plus: 0,
          total_outstanding: 0,
          invoices_count: 0,
        };
      }

      const cust = customerMap[ord.customer_id];
      cust.total_outstanding += amount;
      cust.invoices_count += 1;

      if (ord.days_overdue <= 0) {
        buckets.not_yet_due += amount;
        buckets.current += amount;
        cust.not_yet_due += amount;
        cust.current += amount;
      } else if (ord.days_overdue <= 14) {
        buckets.days_1_14 += amount;
        buckets.days_1_15 += amount;
        cust.days_1_14 += amount;
        cust.days_1_15 += amount;
      } else if (ord.days_overdue <= 30) {
        buckets.days_15_30 += amount;
        buckets.days_16_30 += amount;
        cust.days_15_30 += amount;
        cust.days_16_30 += amount;
      } else if (ord.days_overdue <= 60) {
        buckets.days_31_60 += amount;
        cust.days_31_60 += amount;
      } else {
        buckets.days_61_plus += amount;
        buckets.days_60_plus += amount;
        cust.days_61_plus += amount;
        cust.days_60_plus += amount;
      }
    }

    res.json({
      summary: buckets,
      customers: Object.values(customerMap).sort(
        (a, b) => b.total_outstanding - a.total_outstanding,
      ),
      invoices: unpaidOrders,
    });
  } catch (error) {
    console.error("Error generating receivables aging report:", error);
    res.status(500).json({ error: "Failed to generate aging report" });
  }
});

// GET /api/reports/sales-by-company
reportsRouter.get("/sales-by-company", (_req: Request, res: Response) => {
  try {
    const report = db
      .prepare(
        `
      SELECT 
        c.id as company_id,
        c.name as company_name,
        COUNT(DISTINCT oi.order_id) as orders_count,
        SUM(oi.quantity) as units_sold,
        SUM(oi.taxable_value) as total_taxable,
        SUM(oi.tax_amount) as total_tax,
        SUM(oi.line_total) as total_revenue,
        SUM(oi.taxable_value * (oi.discount_percent / 100.0)) as total_discounts,
        SUM(oi.quantity * COALESCE(b.purchase_price, p.purchase_price)) as total_cogs,
        SUM(oi.taxable_value - (oi.quantity * COALESCE(b.purchase_price, p.purchase_price))) as gross_margin
      FROM companies c
      JOIN products p ON c.id = p.company_id
      JOIN order_items oi ON p.id = oi.product_id
      LEFT JOIN product_batches b ON oi.batch_id = b.id
      JOIN orders o ON oi.order_id = o.id
      WHERE LOWER(o.status) != 'cancelled'
      GROUP BY c.id
      ORDER BY total_revenue DESC
    `,
      )
      .all();

    res.json(report);
  } catch (error) {
    console.error("Error generating sales by company report:", error);
    res.status(500).json({ error: "Failed to generate sales report" });
  }
});

// GET /api/reports/stock-movement
reportsRouter.get("/stock-movement", (req: Request, res: Response) => {
  try {
    const { limit = 100 } = req.query;

    const movements = db
      .prepare(
        `
      SELECT 
        t.*,
        p.product_name,
        p.uom,
        c.name as company_name,
        b.batch_number,
        b.expiry_date
      FROM inventory_transactions t
      JOIN products p ON t.product_id = p.id
      LEFT JOIN companies c ON p.company_id = c.id
      LEFT JOIN product_batches b ON t.batch_id = b.id
      ORDER BY t.date DESC, t.id DESC
      LIMIT ?
    `,
      )
      .all(Number(limit));

    res.json(movements);
  } catch (error) {
    console.error("Error fetching stock movement:", error);
    res.status(500).json({ error: "Failed to fetch stock movement" });
  }
});
