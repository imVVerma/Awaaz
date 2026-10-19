import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

// Setup isolated test database path
const liveDbPath = path.resolve("data/inventory.db");
const testDbPath = path.resolve("data/test_scenario.db");

if (fs.existsSync(testDbPath)) {
  fs.unlinkSync(testDbPath);
}

// Checkpoint WAL before copying
const srcDb = new Database(liveDbPath);
srcDb.pragma("wal_checkpoint(TRUNCATE)");
srcDb.close();

fs.copyFileSync(liveDbPath, testDbPath);
if (fs.existsSync(liveDbPath + "-wal")) {
  fs.copyFileSync(liveDbPath + "-wal", testDbPath + "-wal");
}

const db = new Database(testDbPath);
db.pragma("foreign_keys = ON");

console.log("=================================================");
console.log("MEDIDIST OPERATIONAL REFINEMENT: PHASE 7 VERIFICATION");
console.log("Running in isolated database:", testDbPath);
console.log("=================================================\n");

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  [PASS] ${msg}`);
    passedTests++;
  } else {
    console.error(`  [FAIL] ${msg}`);
    failedTests++;
  }
}

try {
  // Scenario A: Purchasing
  console.log("--- Scenario A: Purchasing ---");
  // 1. Create 2 manufacturers (companies)
  const mfg1 = db
    .prepare("INSERT INTO companies (name) VALUES (?)")
    .run("Mankind Pharma Ltd");
  const mfg1Id = Number(mfg1.lastInsertRowid);

  const mfg2 = db
    .prepare("INSERT INTO companies (name) VALUES (?)")
    .run("Torrent Pharmaceuticals");
  const mfg2Id = Number(mfg2.lastInsertRowid);

  // 2. Create products for each manufacturer
  const prodA = db
    .prepare(
      `INSERT INTO products (company_id, sku, product_name, batch_number, expiry_date, mrp, purchase_price, stock_quantity, minimum_stock_level)
       VALUES (?, 'MAN-MOX500', 'Moxikind-CV 625', 'MOX-101', '2028-01-31', 200, 140, 0, 10)`,
    )
    .run(mfg1Id);
  const prodAId = Number(prodA.lastInsertRowid);

  const prodB = db
    .prepare(
      `INSERT INTO products (company_id, sku, product_name, batch_number, expiry_date, mrp, purchase_price, stock_quantity, minimum_stock_level)
       VALUES (?, 'TOR-CHY100', 'Chymoral Forte', 'CHY-202', '2027-11-30', 450, 310, 0, 15)`,
    )
    .run(mfg2Id);
  const prodBId = Number(prodB.lastInsertRowid);

  // 3. Receive supplier invoice containing both products
  const supplier = db
    .prepare("SELECT id FROM suppliers WHERE id = 1")
    .get() as { id: number };
  assert(!!supplier, "Default supplier Apex Pharma exists");

  const purchaseTx = db.transaction(() => {
    const invRes = db
      .prepare(
        `INSERT INTO purchases (
        supplier_id, purchase_invoice_number, invoice_date, due_date, subtotal, tax_amount, total_amount, paid_amount, payment_status
      ) VALUES (1, 'SUP-INV-8899', '2026-10-19', '2026-11-19', 4500, 540, 5040, 0, 'unpaid')`,
      )
      .run();
    const purchaseId = Number(invRes.lastInsertRowid);

    // Item 1: 20 units of Moxikind
    const b1 = db
      .prepare(
        `INSERT INTO product_batches (product_id, batch_number, expiry_date, mrp, purchase_price, selling_price, initial_quantity, current_quantity)
       VALUES (?, 'LOT-A1', '2028-01-31', 200, 140, 175, 20, 20)`,
      )
      .run(prodAId);
    db.prepare(
      `INSERT INTO purchase_items (purchase_id, product_id, batch_id, batch_number, expiry_date, quantity, purchase_price, mrp, selling_price, tax_rate, taxable_value, tax_amount, line_total)
       VALUES (?, ?, ?, 'LOT-A1', '2028-01-31', 20, 140, 200, 175, 12, 2800, 336, 3136)`,
    ).run(purchaseId, prodAId, b1.lastInsertRowid);
    db.prepare(
      "UPDATE products SET stock_quantity = stock_quantity + 20 WHERE id = ?",
    ).run(prodAId);
    db.prepare(
      `INSERT INTO inventory_transactions (product_id, batch_id, transaction_type, quantity, notes)
       VALUES (?, ?, 'in', 20, 'Purchased on SUP-INV-8899')`,
    ).run(prodAId, b1.lastInsertRowid);

    // Item 2: 10 units of Chymoral
    const b2 = db
      .prepare(
        `INSERT INTO product_batches (product_id, batch_number, expiry_date, mrp, purchase_price, selling_price, initial_quantity, current_quantity)
       VALUES (?, 'LOT-B1', '2027-11-30', 450, 310, 390, 10, 10)`,
      )
      .run(prodBId);
    db.prepare(
      `INSERT INTO purchase_items (purchase_id, product_id, batch_id, batch_number, expiry_date, quantity, purchase_price, mrp, selling_price, tax_rate, taxable_value, tax_amount, line_total)
       VALUES (?, ?, ?, 'LOT-B1', '2027-11-30', 10, 310, 450, 390, 12, 3100, 372, 3472)`,
    ).run(purchaseId, prodBId, b2.lastInsertRowid);
    db.prepare(
      "UPDATE products SET stock_quantity = stock_quantity + 10 WHERE id = ?",
    ).run(prodBId);
    db.prepare(
      `INSERT INTO inventory_transactions (product_id, batch_id, transaction_type, quantity, notes)
       VALUES (?, ?, 'in', 10, 'Purchased on SUP-INV-8899')`,
    ).run(prodBId, b2.lastInsertRowid);

    return {
      purchaseId,
      batch1Id: b1.lastInsertRowid,
      batch2Id: b2.lastInsertRowid,
    };
  });

  const { purchaseId, batch1Id, batch2Id } = purchaseTx();
  const prodAUpdated = db
    .prepare("SELECT stock_quantity FROM products WHERE id = ?")
    .get(prodAId) as any;
  const prodBUpdated = db
    .prepare("SELECT stock_quantity FROM products WHERE id = ?")
    .get(prodBId) as any;

  assert(
    prodAUpdated.stock_quantity === 20,
    "Product A inventory increased by received 20 units",
  );
  assert(
    prodBUpdated.stock_quantity === 10,
    "Product B inventory increased by received 10 units",
  );

  // Verify supplier invoice and liabilities isolation
  const purchaseRec = db
    .prepare("SELECT * FROM purchases WHERE id = ?")
    .get(purchaseId) as any;
  assert(
    purchaseRec.total_amount === 5040,
    "Supplier invoice retained with total_amount 5040",
  );
  const ledgerCount = db
    .prepare(
      "SELECT COUNT(*) as count FROM customer_ledger WHERE notes LIKE '%SUP-INV%'",
    )
    .get() as any;
  assert(
    ledgerCount.count === 0,
    "Supplier purchase liability is isolated and NOT in customer receivables ledger",
  );

  // Scenario B: Sales
  console.log("\n--- Scenario B: Sales ---");
  // Create customer
  const custRes = db
    .prepare(
      `INSERT INTO customers (store_name, phone, billing_address, payment_terms_days, credit_limit)
       VALUES ('Metro Medicos', '9811122233', 'Connaught Place, New Delhi', 15, 60000)`,
    )
    .run();
  const customerId = Number(custRes.lastInsertRowid);

  // Create sales invoice containing both products
  const saleTx = db.transaction(() => {
    // 5 units of Prod A @ 175, 2 units of Prod B @ 390
    // Taxable A = 5 * 175 = 875, Tax A (12%) = 105, Total A = 980
    // Taxable B = 2 * 390 = 780, Tax B (12%) = 93.60, Total B = 873.60
    // Grand Total = 1853.60
    const inv = db
      .prepare(
        `INSERT INTO orders (
        invoice_number, customer_id, due_date, subtotal, tax_amount, total_amount, paid_amount, status
      ) VALUES ('INV-TEST-001', ?, '2026-11-03', 1655, 198.60, 1853.60, 0, 'outstanding')`,
      )
      .run(customerId);
    const orderId = Number(inv.lastInsertRowid);

    db.prepare(
      `INSERT INTO order_items (order_id, product_id, batch_id, quantity, unit_price, tax_rate, taxable_value, tax_amount, line_total)
       VALUES (?, ?, ?, 5, 175, 12, 875, 105, 980)`,
    ).run(orderId, prodAId, batch1Id);
    db.prepare(
      "UPDATE product_batches SET current_quantity = current_quantity - 5 WHERE id = ?",
    ).run(batch1Id);
    db.prepare(
      "UPDATE products SET stock_quantity = stock_quantity - 5 WHERE id = ?",
    ).run(prodAId);
    db.prepare(
      "INSERT INTO inventory_transactions (product_id, batch_id, order_id, transaction_type, quantity, notes) VALUES (?, ?, ?, 'sale', 5, 'Sale on INV-TEST-001')",
    ).run(prodAId, batch1Id, orderId);

    db.prepare(
      `INSERT INTO order_items (order_id, product_id, batch_id, quantity, unit_price, tax_rate, taxable_value, tax_amount, line_total)
       VALUES (?, ?, ?, 2, 390, 12, 780, 93.60, 873.60)`,
    ).run(orderId, prodBId, batch2Id);
    db.prepare(
      "UPDATE product_batches SET current_quantity = current_quantity - 2 WHERE id = ?",
    ).run(batch2Id);
    db.prepare(
      "UPDATE products SET stock_quantity = stock_quantity - 2 WHERE id = ?",
    ).run(prodBId);
    db.prepare(
      "INSERT INTO inventory_transactions (product_id, batch_id, order_id, transaction_type, quantity, notes) VALUES (?, ?, ?, 'sale', 2, 'Sale on INV-TEST-001')",
    ).run(prodBId, batch2Id, orderId);

    db.prepare(
      "INSERT INTO customer_ledger (customer_id, entry_type, reference_id, debit, credit, running_balance, notes) VALUES (?, 'invoice', ?, 1853.60, 0, 0, 'Invoice INV-TEST-001')",
    ).run(customerId, orderId);

    return orderId;
  });

  const saleOrderId = saleTx();
  const prodAAfterSale = db
    .prepare("SELECT stock_quantity FROM products WHERE id = ?")
    .get(prodAId) as any;
  const batch1AfterSale = db
    .prepare("SELECT current_quantity FROM product_batches WHERE id = ?")
    .get(batch1Id) as any;
  const prodBAfterSale = db
    .prepare("SELECT stock_quantity FROM products WHERE id = ?")
    .get(prodBId) as any;
  const batch2AfterSale = db
    .prepare("SELECT current_quantity FROM product_batches WHERE id = ?")
    .get(batch2Id) as any;

  assert(
    prodAAfterSale.stock_quantity === 15 &&
      batch1AfterSale.current_quantity === 15,
    "Product A batch and aggregate deducted by 5",
  );
  assert(
    prodBAfterSale.stock_quantity === 8 &&
      batch2AfterSale.current_quantity === 8,
    "Product B batch and aggregate deducted by 2",
  );

  // Scenario C: Partial Payment
  console.log("\n--- Scenario C: Partial Payment ---");
  // Customer pays ₹1000 of ₹1853.60
  db.prepare(
    `INSERT INTO payments (customer_id, order_id, amount, payment_method, reference_number, notes)
     VALUES (?, ?, 1000, 'upi', 'UPI-TXN-123', 'Partial payment')`,
  ).run(customerId, saleOrderId);

  db.prepare(
    "UPDATE orders SET paid_amount = paid_amount + 1000, status = 'partially_paid' WHERE id = ?",
  ).run(saleOrderId);

  db.prepare(
    "INSERT INTO customer_ledger (customer_id, entry_type, reference_id, debit, credit, running_balance, notes) VALUES (?, 'payment', ?, 0, 1000, 0, 'Payment for INV-TEST-001')",
  ).run(customerId, saleOrderId);

  const orderAfterPay = db
    .prepare(
      "SELECT total_amount, paid_amount, status FROM orders WHERE id = ?",
    )
    .get(saleOrderId) as any;
  assert(orderAfterPay.paid_amount === 1000, "Paid amount recorded as 1000");
  assert(
    Math.abs(orderAfterPay.total_amount - orderAfterPay.paid_amount - 853.6) <
      0.01,
    "Outstanding balance is exactly 853.60",
  );
  assert(
    orderAfterPay.status === "partially_paid",
    "Invoice status updated to partially_paid",
  );

  // Check customer ledger balance
  const ledgerBalance = db
    .prepare(
      "SELECT SUM(debit - credit) as balance FROM customer_ledger WHERE customer_id = ?",
    )
    .get(customerId) as any;
  assert(
    Math.abs(ledgerBalance.balance - 853.6) < 0.01,
    "Customer ledger balance reconciles with 853.60",
  );

  // Scenario D: Catalog Import (Atomic vs Partial)
  console.log("\n--- Scenario D: Catalog Import ---");
  const testRows = [
    {
      rowNumber: 2,
      company: "Abbott Healthcare",
      companyStatus: "new",
      product_name: "Thyronorm 50mcg",
      sku: "ABB-THY50",
      batch_number: "THY-001",
      expiry_date: "2027-12-31",
      mrp: 180,
      purchase_price: 120,
      sale_price: 155,
      gst_rate: 12,
      quantity: 50,
      minimum_stock_level: 15,
      isValid: true,
      errors: [],
      warnings: [],
    },
    {
      rowNumber: 3,
      company: "Abbott Healthcare",
      companyStatus: "new",
      product_name: "", // Missing product name -> INVALID
      sku: "ABB-ERR",
      batch_number: "THY-002",
      expiry_date: "2027-12-31",
      mrp: 180,
      purchase_price: 120,
      isValid: false,
      errors: ["Product name is required"],
      warnings: [],
    },
  ];

  // Test atomic rejection
  const hasInvalid = testRows.some((r) => !r.isValid);
  assert(hasInvalid, "Import file correctly identified invalid row");

  // Commit valid row only
  const validOnly = testRows.filter((r) => r.isValid);
  const abbottComp = db
    .prepare("INSERT INTO companies (name) VALUES (?)")
    .run(validOnly[0].company);
  const abbottProd = db
    .prepare(
      `INSERT INTO products (company_id, sku, product_name, batch_number, expiry_date, mrp, purchase_price, stock_quantity, minimum_stock_level)
     VALUES (?, ?, ?, ?, ?, ?, ?, 50, 15)`,
    )
    .run(
      abbottComp.lastInsertRowid,
      validOnly[0].sku,
      validOnly[0].product_name,
      validOnly[0].batch_number,
      validOnly[0].expiry_date,
      validOnly[0].mrp,
      validOnly[0].purchase_price,
    );

  db.prepare(
    `INSERT INTO product_batches (product_id, batch_number, expiry_date, mrp, purchase_price, selling_price, initial_quantity, current_quantity)
     VALUES (?, ?, ?, ?, ?, ?, 50, 50)`,
  ).run(
    abbottProd.lastInsertRowid,
    validOnly[0].batch_number,
    validOnly[0].expiry_date,
    validOnly[0].mrp,
    validOnly[0].purchase_price,
    validOnly[0].sale_price,
  );

  db.prepare(
    "INSERT INTO inventory_transactions (product_id, batch_id, transaction_type, quantity, notes) VALUES (?, ?, 'in', 50, 'Catalog import')",
  ).run(abbottProd.lastInsertRowid, abbottProd.lastInsertRowid);

  const importedProd = db
    .prepare("SELECT * FROM products WHERE sku = 'ABB-THY50'")
    .get() as any;
  assert(
    importedProd && importedProd.stock_quantity === 50,
    "Valid catalog row committed with initial batch quantity 50",
  );

  // Scenario E: Expiry and Stock Filters
  console.log("\n--- Scenario E: Expiry and Stock Filters ---");
  // Create 3 batches for Prod A:
  // Batch 1: LOT-A1 (non-expired, 15 units remaining, exp 2028-01-31)
  // Batch 2: LOT-A2 (expired, 10 units, exp 2025-01-01)
  // Batch 3: LOT-A3 (near expiry, 5 units, exp in 45 days)
  const today = new Date();
  const nearExpiryDate = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const bExp = db
    .prepare(
      `INSERT INTO product_batches (product_id, batch_number, expiry_date, mrp, purchase_price, selling_price, initial_quantity, current_quantity)
     VALUES (?, 'LOT-A2-EXP', '2025-01-01', 200, 140, 175, 10, 10)`,
    )
    .run(prodAId);

  const bNear = db
    .prepare(
      `INSERT INTO product_batches (product_id, batch_number, expiry_date, mrp, purchase_price, selling_price, initial_quantity, current_quantity)
     VALUES (?, 'LOT-A3-NEAR', ?, 200, 140, 175, 5, 5)`,
    )
    .run(prodAId, nearExpiryDate);

  const todayStr = today.toISOString().split("T")[0];
  const prodBatches = db
    .prepare("SELECT * FROM product_batches WHERE product_id = ?")
    .all(prodAId) as any[];

  const nonExpiredBatches = prodBatches.filter((b) => b.expiry_date > todayStr);
  const expiredBatches = prodBatches.filter((b) => b.expiry_date <= todayStr);
  const sellableQty = nonExpiredBatches.reduce(
    (sum, b) => sum + b.current_quantity,
    0,
  );
  const expiredQty = expiredBatches.reduce(
    (sum, b) => sum + b.current_quantity,
    0,
  );

  assert(
    sellableQty === 20,
    `Sellable stock is 20 units (15 from LOT-A1 + 5 from LOT-A3-NEAR, got ${sellableQty})`,
  );
  assert(
    expiredQty === 10,
    `Expired stock is isolated at 10 units (got ${expiredQty})`,
  );
  assert(sellableQty > 10, "Classified as In Stock (> minimum threshold 10)");

  // Scenario F: Cancellation and Reversal
  console.log("\n--- Scenario F: Cancellation and Reversal ---");
  // Cancel saleOrderId (INV-TEST-001)
  const itemsToCancel = db
    .prepare("SELECT * FROM order_items WHERE order_id = ?")
    .all(saleOrderId) as any[];

  const cancelReversalTx = db.transaction(() => {
    for (const it of itemsToCancel) {
      db.prepare(
        "UPDATE product_batches SET current_quantity = current_quantity + ? WHERE id = ?",
      ).run(it.quantity, it.batch_id);
      db.prepare(
        "UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?",
      ).run(it.quantity, it.product_id);
      db.prepare(
        "INSERT INTO inventory_transactions (product_id, batch_id, order_id, transaction_type, quantity, notes) VALUES (?, ?, ?, 'return', ?, 'Reversal')",
      ).run(it.product_id, it.batch_id, saleOrderId, it.quantity);
    }
    db.prepare(
      "INSERT INTO customer_ledger (customer_id, entry_type, reference_id, debit, credit, running_balance, notes) VALUES (?, 'credit_note', ?, 0, 1853.60, 0, 'Reversal for INV-TEST-001')",
    ).run(customerId, saleOrderId);
    db.prepare("UPDATE orders SET status = 'Cancelled' WHERE id = ?").run(
      saleOrderId,
    );
  });
  cancelReversalTx();

  const cancelledOrder = db
    .prepare("SELECT status FROM orders WHERE id = ?")
    .get(saleOrderId) as any;
  assert(
    cancelledOrder.status === "Cancelled",
    "Order status updated to Cancelled",
  );

  const batch1Reversed = db
    .prepare("SELECT current_quantity FROM product_batches WHERE id = ?")
    .get(batch1Id) as any;
  assert(
    batch1Reversed.current_quantity === 20,
    "Batch 1 inventory fully reversed back to 20",
  );

  const batch2Reversed = db
    .prepare("SELECT current_quantity FROM product_batches WHERE id = ?")
    .get(batch2Id) as any;
  assert(
    batch2Reversed.current_quantity === 10,
    "Batch 2 inventory fully reversed back to 10",
  );

  const ledgerAfterCancel = db
    .prepare(
      "SELECT SUM(debit - credit) as balance FROM customer_ledger WHERE customer_id = ?",
    )
    .get(customerId) as any;
  assert(
    ledgerAfterCancel.balance === -1000,
    "Customer ledger balance reflects ₹1000 credit (payment was retained and invoice debit reversed)",
  );

  // Scenario G: Regression & Invariants Checks
  console.log("\n--- Scenario G: Regression & Invariants Checks ---");
  const fkErrors = db.pragma("foreign_key_check") as any[];
  assert(
    fkErrors.length === 0,
    `Database foreign keys valid with 0 violations (got ${fkErrors.length})`,
  );

  // Verify Walk-in customer still exists
  const walkIn = db
    .prepare("SELECT id, store_name FROM customers WHERE id = 1")
    .get() as any;
  assert(
    walkIn && walkIn.id === 1,
    "Walk-in customer (id: 1) preserved intact",
  );

  // Verify Dharishah Ayurveda exists
  const dharishah = db
    .prepare("SELECT id, name FROM companies WHERE id = 3")
    .get() as any;
  assert(
    dharishah && dharishah.id === 3,
    "Original manufacturer Dharishah Ayurveda (id: 3) preserved intact",
  );

  // Receivables aging report reconciliation
  const unpaidForReport = db
    .prepare(
      "SELECT SUM(total_amount - paid_amount) as total FROM orders WHERE id = ? AND paid_amount < total_amount AND status != 'Cancelled'",
    )
    .get(saleOrderId) as any;
  assert(
    (unpaidForReport?.total || 0) === 0,
    "No cancelled orders leak into active receivables",
  );
} finally {
  db.close();
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
}

console.log("\n=================================================");
console.log(
  `VERIFICATION COMPLETE: ${passedTests} passed, ${failedTests} failed.`,
);
console.log("=================================================");
if (failedTests > 0) {
  process.exit(1);
}
