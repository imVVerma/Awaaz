# MediDist: Operational Refinement, Purchase Workflows, Catalog Improvements & End-to-End Verification

## Role

Act as a Senior Full-Stack Engineer and Product Architect refining the existing MediDist pharmaceutical distribution application.

The previous overhaul report marks the light theme, batch-aware catalog, customer management, multi-company sales invoicing, payments, reports, and navigation as complete.

**Treat those statuses as claims to verify, not as proof of correct implementation.** Inspect the current code and running application before modifying anything.

The objective is to close operational gaps, correct workflow ambiguities, and ensure the application reliably supports real distributor operations.

## Implementation Rules

1. Start with a targeted audit of the current implementation.
2. Reuse existing components, APIs, database tables, and business logic wherever they are correct.
3. Do not rewrite the completed overhaul or change the framework without a clear technical justification.
4. Preserve existing SQLite records and working workflows.
5. Do not use production-like records as test fixtures or replace existing data with mock data.
6. Implement in small phases, testing each phase before proceeding.
7. Report actual test results and distinguish verified functionality from incomplete functionality.
8. Do not implement voice-bot features in this task.

---

# Phase 0: Verify the Current Implementation

Inspect the current repository, database schema, API routes, frontend navigation, and relevant screens.

Verify the following workflows in the running application:

- Light theme and responsive navigation.
- Catalog search, company filters, stock-status filters, and batch-level inventory.
- Product creation and editing.
- Customer creation, editing, and selection during sales order creation.
- Sales invoice creation across multiple manufacturers.
- Batch-level stock deduction and inventory transaction logging.
- Payment recording, partial payments, and outstanding balance calculations.
- Receivables aging and sales-by-company reports.
- Existing PDF, Excel, or CSV catalog import functionality.

### Required output

Before changing code, provide:

- A feature-by-feature verification table.
- Relevant API routes and database tables.
- Reproducible bugs or missing functionality.
- Existing automated tests and their results.
- A prioritized implementation plan.

Do not report a feature as working solely because its screen or endpoint exists.

---

# Phase 1: Dashboard Metrics and Operational Priorities

## 1.1 Remove low-value overview cards

Remove these cards from the primary dashboard overview:

- Total Products.
- Number of Companies.
- Number of Pharmacies / Customers.

Retain these figures elsewhere if useful, such as in catalog summaries or dedicated reports.

## 1.2 Prioritize actionable metrics

Display three primary operational indicators:

### Low Stock

- Count products or stock lines that are below their configured minimum threshold.
- Show a concise preview of the most urgent items.
- Include product name, company, available quantity, and minimum threshold.
- Clicking the indicator opens the filtered low-stock view.

Clearly define how products with multiple batches contribute to the count. Avoid counting the same product repeatedly merely because it has multiple batches.

### Expiring Soon

- Provide 30-day, 60-day, and 90-day views or selectable filters.
- Show product, company, batch number, expiry date, and available quantity.
- Exclude expired stock from the "expiring soon" count and display it separately.
- Use consistent date boundaries and the distributor's local date.
- Clicking the indicator opens the corresponding filtered inventory view.

### Total Outstanding Receivables

- Display the total unpaid amount owed by customers across finalized sales invoices.
- Exclude draft and cancelled invoices.
- Account for full and partial payments, credit notes, and reversals where implemented.
- Distinguish total outstanding from the portion that is overdue.
- Clicking the indicator opens the receivables report with the appropriate filters.

Label this metric clearly as **Customer Receivables** or **Outstanding from Customers**.

## 1.3 Dashboard quality

- Use live API data, not hardcoded counts.
- Show loading, error, and empty states.
- Ensure dashboard totals reconcile with the underlying catalog, inventory, and financial records.
- Avoid duplicating expensive database queries unnecessarily.

---

# Phase 2: Separate Purchasing from Sales

This is a core business distinction and must be reflected in both the user interface and the underlying data model.

## 2.1 Sales / Outbound Invoices

Sales represent goods supplied to customers.

The existing sales workflow should support:

- Selecting a customer or configured walk-in customer.
- Adding products from multiple manufacturers.
- Selecting eligible batches.
- Calculating discounts and applicable taxes.
- Validating stock.
- Deducting stock when the sale is finalized.
- Creating the customer receivable.
- Recording subsequent customer payments.
- Viewing and printing the invoice.

A finalized sale must not deduct stock twice if the request is repeated.

## 2.2 Purchases / Inbound Supplier Invoices

Purchases represent goods acquired by the distributor.

Add a dedicated **Purchases** or **Inbound Invoices** section with a workflow to:

- Select a supplier.
- Record supplier invoice number and invoice date.
- Add one or more products.
- Select an existing product or create a new catalog product where appropriate.
- Enter batch number, expiry date, received quantity, purchase price, MRP, selling price where available, and applicable tax details.
- Review line totals and invoice totals.
- Confirm and record the purchase.
- Increase the corresponding batch inventory.
- Create inventory movement records.
- Preserve the supplier invoice and its line-item values for historical reference.

If supplier invoices are imported from a file, preview and validate the extracted data before confirmation.

## 2.3 Manufacturer versus supplier

A manufacturer or brand is not necessarily the entity from which the distributor purchases stock. A distributor may procure medicines through a wholesaler or stockist.

Inspect the current Company model and determine whether it represents a manufacturer, a supplier, or both.

If these are distinct in actual business operations, model them separately:

- Manufacturers / Brands: own or manufacture products.
- Suppliers / Vendors: issue purchase invoices and receive payments.

Do not overload the existing company entity with contradictory meanings. If one business can act in both roles, support an explicit relationship or role model.

## 2.4 Supplier financial records

If supplier purchases create amounts payable, establish a separate supplier-payables workflow.

Do not record supplier liabilities in the customer receivables ledger.

If supplier payment management is outside the immediate scope, still preserve the purchase invoice, supplier identity, and outstanding payable information needed for future implementation. Clearly document any deferred functionality.

## 2.5 Navigation

Organize the interface around distinct workflows:

- Dashboard.
- Sales / Orders.
- Purchases.
- Customers / Pharmacies.
- Products / Inventory.
- Reports.

Manufacturers and suppliers should have clear labels and appropriate navigation. Avoid an overcrowded navigation bar; use grouped navigation or secondary menus where appropriate.

---

# Phase 3: Catalog Import and Upload Reliability

Inspect the existing catalog-import implementation before replacing or extending it. Preserve useful PDF or AI-assisted extraction functionality where it already works, but provide a dependable structured CSV/Excel import path.

## 3.1 Downloadable templates

Provide downloadable CSV and Excel templates with documented headers:

- Company
- SKU
- Product Name
- Composition
- Category
- Form
- Packaging
- Batch
- Expiry
- MRP
- Purchase Price
- Sale Price
- GST Rate
- Quantity
- Minimum Stock Threshold

Clarify the distinction between Category and Form. For example, a category may represent a therapeutic grouping, while Form represents a dosage form such as tablet, capsule, syrup, powder, oil, or ointment.

Define which fields are mandatory for creating a product and which are mandatory for creating an initial stock batch.

Include a short instructions sheet in the Excel template if practical.

## 3.2 Import workflow

Implement a clear staged process:

1. Select a CSV or Excel file.
2. Parse the file.
3. Display a preview of the detected columns and rows.
4. Validate each row.
5. Display errors and warnings before importing.
6. Allow the user to correct the source file and retry.
7. Confirm the import.
8. Display a final summary.

The preview must identify:

- Missing required fields.
- Invalid numbers or dates.
- Invalid or missing company references.
- Duplicate SKUs or batch records.
- Invalid prices, quantities, and tax rates.
- Expired batches.
- Rows that may match existing products.
- Rows that would create a new product versus add a new batch.

Do not silently create duplicate companies or duplicate product masters.

## 3.3 Import safety

- Perform server-side validation even when the frontend validates the file.
- Never execute arbitrary formulas or code from uploaded spreadsheets.
- Limit file size and accepted file types.
- Handle malformed files gracefully.
- Do not partially commit an import without explicitly reporting the committed and rejected rows.
- Prefer an atomic import: either commit all validated rows or none.
- If partial imports are deliberately supported, make the behavior explicit and auditable.
- Prevent duplicate stock creation when a user retries the same import.
- Record the resulting inventory transactions for imported opening or received stock.

Keep the product and batch relationships consistent with the current normalized schema.

## 3.4 Import acceptance tests

Test at least:

- A valid file with multiple manufacturers.
- Multiple batches for the same product.
- A missing required field.
- An invalid expiry date.
- An invalid quantity or price.
- A duplicate SKU.
- A duplicate batch.
- An unknown company.
- A repeated import of the same file.
- A file that fails partway through validation.

Verify that failed imports do not corrupt existing catalog data or inventory.

---

# Phase 4: Company-Centric Catalog Refinements

## 4.1 Company selector

Retain the existing All Products and Company-First browsing modes.

In Company-First mode:

- Display selectable manufacturer cards or tabs.
- Include an All Companies option.
- Show the selected company's name and useful summary information.
- Display only products belonging to the selected company.
- Keep the selected company visible while navigating or filtering the catalog.

Do not confuse manufacturers with purchasing suppliers.

## 4.2 Filters

Provide clear, combinable filters:

- All Products.
- In Stock.
- Low Stock.
- Out of Stock.
- Near Expiry.
- Product category or dosage form.
- Manufacturer / Company.

Define stock status consistently:

- In Stock: eligible, non-expired inventory is available and above the low-stock threshold.
- Low Stock: eligible inventory is positive but at or below the configured threshold.
- Out of Stock: no eligible inventory is available.
- Near Expiry: at least one eligible batch falls within the configured expiry window.

Expired stock should be identifiable separately and must not be counted as sellable stock.

Ensure filters work together, search remains responsive, and users can reset filters easily.

## 4.3 Batch-level visibility

Display enough information for a distributor to distinguish batches:

- Batch number.
- Expiry date.
- Available quantity.
- MRP.
- Purchase price.
- Selling price where applicable.
- Stock status.

Do not combine batches in a way that hides different expiry dates or costs.

---

# Phase 5: Customer Management Polish

Use **Customers / Pharmacies** consistently for buyers throughout the application.

Verify the create, read, update, and archive workflows.

The form should support:

- Business / Store Name.
- Contact Person.
- Phone.
- Email.
- Billing Address.
- Delivery Address.
- Drug License Number.
- GSTIN.
- Payment Terms / Credit Period in Days.
- Credit Limit.

Requirements:

- Validate required fields and sensible input formats.
- Keep optional fields optional where appropriate.
- Show clear validation errors.
- Prevent accidental duplicate submissions.
- Preserve customer history when a customer is deactivated.
- Display outstanding balances and payment status using the actual ledger or invoice data.

After creating or updating a customer, invalidate or refresh the relevant queries so the customer appears immediately in order-entry selectors without requiring a full page reload.

Walk-in customer handling must use the existing configured walk-in customer or an explicitly designed equivalent, rather than creating a duplicate record for each order.

---

# Phase 6: Reports and Financial Consistency

Use actual application data for functional verification. Use isolated test fixtures or a clearly separated demo database when sample data is required.

Never seed mock invoices, customers, or payments into the real working database merely to make charts look populated.

## 6.1 Receivables Aging

Provide clearly defined buckets:

- Not Yet Due.
- 1–14 Days Overdue.
- 15–30 Days Overdue.
- 31–60 Days Overdue.
- 61+ Days Overdue.

These labels use days overdue, not total invoice age.

Define the exact boundary logic and test it. Reconcile the sum of the buckets with total outstanding customer receivables.

Show customer and invoice drill-downs from each bucket.

## 6.2 Sales by Manufacturer

Report:

- Sales quantity.
- Revenue.
- Discounts.
- Tax where relevant.
- Cost of goods sold where reliable historical cost data is available.
- Gross margin where it can be calculated accurately.

Group sales using the manufacturer recorded on the product or a reliable historical invoice-line reference.

Do not calculate historical margin from current catalog prices if the original cost is unavailable.

## 6.3 Stock Movement and Expiry

Show:

- Stock receipts.
- Sales and stock deductions.
- Adjustments and reversals.
- Current stock.
- Near-expiry and expired inventory.
- Fast-moving and slow-moving items.

Define the reporting period and movement formulas.

For stock turnover, use a documented calculation based on actual movement data. Do not infer demand or classify an item as dead stock solely because its current stock quantity is high.

## 6.4 Financial invariants

Verify these relationships across the application:

- Customer receivables reconcile with finalized sales invoices, allocated payments, and applicable credits or reversals.
- Supplier payables remain separate from customer receivables.
- Inventory quantities reconcile with opening stock and subsequent stock movements.
- Cancelled or reversed invoices do not leave stale receivables or incorrect stock deductions.
- Report totals reconcile with the source records.

---

# Phase 7: End-to-End Verification

Run tests against an isolated database copy or controlled test fixtures.

At minimum, verify these scenarios:

### Scenario A: Purchasing

Receive a supplier invoice containing products from two manufacturers. Confirm that the correct batches are created or updated, inventory increases exactly once, and the supplier invoice is retained.

### Scenario B: Sales

Create one customer invoice containing products from two manufacturers and different batches. Confirm tax calculations, invoice totals, stock deductions, and customer receivables.

### Scenario C: Partial payment

Record a partial customer payment. Confirm the outstanding amount, invoice status, customer ledger, dashboard receivables, and aging report all update consistently.

### Scenario D: Catalog import

Import a file containing several valid rows and one invalid row. Verify the documented atomic or partial-import behavior and ensure there is no silent data loss or duplicate stock.

### Scenario E: Expiry and stock filters

Create controlled test batches with different quantities and expiry dates. Verify In Stock, Low Stock, Out of Stock, Near Expiry, and Expired classifications.

### Scenario F: Cancellation and reversal

Cancel or reverse a finalized sale using the supported workflow. Verify that stock and financial records are corrected through auditable transactions.

### Scenario G: Regression

Verify that the existing dashboard, product CRUD, company management, catalog import, stock adjustment, and reports still work.

Run the available checks:

- TypeScript typecheck.
- ESLint.
- Prettier formatting check.
- Production build.
- Relevant automated tests.
- API and end-to-end workflow tests.

Do not suppress legitimate errors merely to obtain a clean report.

---

# Final Deliverables

After implementation, provide:

1. A concise list of bugs found and fixed.
2. A list of files created or modified.
3. Any database schema changes and migration details.
4. A clear explanation of the difference between purchase and sales workflows.
5. Import-template locations and supported formats.
6. Automated test results and commands executed.
7. Manual verification steps for the running application.
8. Known limitations and deferred functionality.

Use a status table with three states: Verified, Implemented but Not Fully Verified, and Not Implemented.

Do not mark the overall task complete until the critical purchase, sales, inventory, and financial workflows have been tested end to end.