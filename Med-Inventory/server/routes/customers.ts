import { Router, Request, Response } from "express";
import db from "../db";
import type {
  Customer,
  CreateCustomerInput,
  CustomerLedgerEntry,
  Order,
} from "@shared/types";

export const customersRouter = Router();

// GET /api/customers
customersRouter.get("/", (req: Request, res: Response) => {
  try {
    const { search } = req.query;

    let query = `
      SELECT 
        c.*,
        COALESCE(
          (SELECT SUM(debit) - SUM(credit) 
           FROM customer_ledger 
           WHERE customer_id = c.id), 
          0
        ) as outstanding_balance,
        (SELECT COUNT(*) FROM orders WHERE customer_id = c.id) as total_invoices,
        (SELECT COUNT(*) FROM orders WHERE customer_id = c.id AND status = 'Overdue') as overdue_invoices
      FROM customers c
      WHERE c.is_active = 1
    `;
    const params: string[] = [];

    if (search && typeof search === "string" && search.trim() !== "") {
      query += `
        AND (
          c.store_name LIKE ? OR 
          c.contact_person LIKE ? OR 
          c.phone LIKE ? OR 
          c.gstin LIKE ?
        )
      `;
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term);
    }

    query += " ORDER BY c.store_name ASC";

    const customers = db.prepare(query).all(...params) as (Customer & {
      total_invoices: number;
      overdue_invoices: number;
    })[];

    res.json(customers);
  } catch (error) {
    console.error("Error fetching customers:", error);
    res.status(500).json({ error: "Failed to fetch customers" });
  }
});

// GET /api/customers/:id
customersRouter.get("/:id", (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        c.*,
        COALESCE(
          (SELECT SUM(debit) - SUM(credit) 
           FROM customer_ledger 
           WHERE customer_id = c.id), 
          0
        ) as outstanding_balance,
        (SELECT COUNT(*) FROM orders WHERE customer_id = c.id) as total_invoices,
        (SELECT COUNT(*) FROM orders WHERE customer_id = c.id AND status = 'Overdue') as overdue_invoices
      FROM customers c
      WHERE c.id = ?
    `;

    const customer = db.prepare(query).get(id) as
      | (Customer & {
          total_invoices: number;
          overdue_invoices: number;
        })
      | undefined;

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    // Recent invoices
    const invoices = db
      .prepare(
        "SELECT * FROM orders WHERE customer_id = ? ORDER BY order_date DESC LIMIT 5",
      )
      .all(id) as Order[];

    // Recent ledger movements
    const ledger = db
      .prepare(
        "SELECT * FROM customer_ledger WHERE customer_id = ? ORDER BY entry_date DESC, id DESC LIMIT 10",
      )
      .all(id) as CustomerLedgerEntry[];

    res.json({
      ...customer,
      recent_invoices: invoices,
      recent_ledger: ledger,
    });
  } catch (error) {
    console.error("Error fetching customer details:", error);
    res.status(500).json({ error: "Failed to fetch customer details" });
  }
});

// POST /api/customers
customersRouter.post("/", (req: Request, res: Response) => {
  try {
    const data: CreateCustomerInput = req.body;

    if (!data.store_name || data.store_name.trim() === "") {
      return res.status(400).json({ error: "Store/Pharmacy name is required" });
    }
    if (!data.phone || data.phone.trim() === "") {
      return res
        .status(400)
        .json({ error: "Contact phone number is required" });
    }

    const cleanStoreName = data.store_name.trim();
    const cleanPhone = data.phone.trim();

    // Check for duplicate store name
    const existing = db
      .prepare(
        "SELECT id FROM customers WHERE store_name = ? AND is_active = 1",
      )
      .get(cleanStoreName);
    if (existing) {
      return res
        .status(400)
        .json({ error: "Customer with this pharmacy name already exists" });
    }

    const result = db
      .prepare(
        `
      INSERT INTO customers (
        store_name, contact_person, phone, email, billing_address,
        delivery_address, gstin, dl_number, payment_terms_days, credit_limit, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `,
      )
      .run(
        cleanStoreName,
        data.contact_person?.trim() || null,
        cleanPhone,
        data.email?.trim() || null,
        data.billing_address?.trim() || null,
        data.delivery_address?.trim() || data.billing_address?.trim() || null,
        data.gstin?.trim() || null,
        data.dl_number?.trim() || null,
        data.payment_terms_days !== undefined
          ? Number(data.payment_terms_days)
          : 15,
        data.credit_limit !== undefined ? Number(data.credit_limit) : 50000,
      );

    const newCustomer = db
      .prepare(
        `
        SELECT 
          c.*,
          0 as outstanding_balance,
          0 as total_invoices,
          0 as overdue_invoices
        FROM customers c 
        WHERE c.id = ?
      `,
      )
      .get(result.lastInsertRowid) as Customer;

    res.status(201).json(newCustomer);
  } catch (error) {
    console.error("Error creating customer:", error);
    res.status(500).json({ error: "Failed to create customer" });
  }
});

// PUT /api/customers/:id
customersRouter.put("/:id", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data: Partial<CreateCustomerInput> = req.body;

    const existing = db
      .prepare("SELECT * FROM customers WHERE id = ?")
      .get(id) as Customer | undefined;
    if (!existing) {
      return res.status(404).json({ error: "Customer not found" });
    }

    if (data.store_name !== undefined && data.store_name.trim() === "") {
      return res.status(400).json({ error: "Store name cannot be empty" });
    }
    if (data.phone !== undefined && data.phone.trim() === "") {
      return res.status(400).json({ error: "Phone cannot be empty" });
    }

    db.prepare(
      `
      UPDATE customers SET
        store_name = COALESCE(?, store_name),
        contact_person = COALESCE(?, contact_person),
        phone = COALESCE(?, phone),
        email = COALESCE(?, email),
        billing_address = COALESCE(?, billing_address),
        delivery_address = COALESCE(?, delivery_address),
        gstin = COALESCE(?, gstin),
        dl_number = COALESCE(?, dl_number),
        payment_terms_days = COALESCE(?, payment_terms_days),
        credit_limit = COALESCE(?, credit_limit),
        updated_at = datetime('now')
      WHERE id = ?
    `,
    ).run(
      data.store_name?.trim() ?? null,
      data.contact_person?.trim() ?? null,
      data.phone?.trim() ?? null,
      data.email?.trim() ?? null,
      data.billing_address?.trim() ?? null,
      data.delivery_address?.trim() ?? null,
      data.gstin?.trim() ?? null,
      data.dl_number?.trim() ?? null,
      data.payment_terms_days !== undefined
        ? Number(data.payment_terms_days)
        : null,
      data.credit_limit !== undefined ? Number(data.credit_limit) : null,
      id,
    );

    const updated = db
      .prepare("SELECT * FROM customers WHERE id = ?")
      .get(id) as Customer;
    res.json(updated);
  } catch (error) {
    console.error("Error updating customer:", error);
    res.status(500).json({ error: "Failed to update customer" });
  }
});

// DELETE /api/customers/:id
customersRouter.delete("/:id", (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (Number(id) === 1) {
      return res
        .status(400)
        .json({ error: "Cannot delete the default Walk-in Customer" });
    }

    const existing = db.prepare("SELECT * FROM customers WHERE id = ?").get(id);
    if (!existing) {
      return res.status(404).json({ error: "Customer not found" });
    }

    // Check outstanding balance
    const balance = db
      .prepare(
        "SELECT SUM(debit) - SUM(credit) as bal FROM customer_ledger WHERE customer_id = ?",
      )
      .get(id) as { bal: number | null };

    if (balance && balance.bal && balance.bal > 0) {
      return res.status(400).json({
        error: `Cannot delete customer with active outstanding balance of ₹${balance.bal.toFixed(2)}`,
      });
    }

    // Soft delete to maintain audit history
    db.prepare(
      "UPDATE customers SET is_active = 0, updated_at = datetime('now') WHERE id = ?",
    ).run(id);

    res.json({ message: "Customer deactivated successfully" });
  } catch (error) {
    console.error("Error deleting customer:", error);
    res.status(500).json({ error: "Failed to delete customer" });
  }
});

// GET /api/customers/:id/ledger
customersRouter.get("/:id/ledger", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const ledger = db
      .prepare(
        `
        SELECT * 
        FROM customer_ledger 
        WHERE customer_id = ? 
        ORDER BY entry_date DESC, id DESC
      `,
      )
      .all(id) as CustomerLedgerEntry[];

    res.json(ledger);
  } catch (error) {
    console.error("Error fetching customer ledger:", error);
    res.status(500).json({ error: "Failed to fetch customer ledger" });
  }
});

// GET /api/customers/:id/invoices
customersRouter.get("/:id/invoices", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const invoices = db
      .prepare(
        "SELECT * FROM orders WHERE customer_id = ? ORDER BY order_date DESC",
      )
      .all(id) as Order[];

    res.json(invoices);
  } catch (error) {
    console.error("Error fetching customer invoices:", error);
    res.status(500).json({ error: "Failed to fetch customer invoices" });
  }
});
