# MediDist Core Overhaul: UI/UX, Data Architecture, Catalog, Customers, Orders & Credit Management

## Role and Objective

Act as a senior full-stack engineer, database architect, and product designer. Upgrade the existing MediDist medicine distribution application into a reliable, accessible, and frictionless business management system for small and medium-sized pharmaceutical distributors.

This is a foundational overhaul **before introducing voice-bot capabilities**. Prioritize correct data modeling, operational reliability, usability, and maintainable architecture over adding features quickly.

The system must support the distributor's real workflows: managing products from multiple manufacturers, tracking batches and expiry dates, selling products from different manufacturers on one invoice, managing retailers and pharmacies, recording payments, and identifying overdue accounts.

Do not rebuild the application from scratch without demonstrating why that is necessary. Reuse existing working components and services where appropriate, while avoiding architectural decisions based solely on the current implementation.

---

# Phase 0: Repository Discovery and Implementation Plan

**Do not modify code or the database until this audit is complete.**

Inspect the actual repository and establish the current state of the application.

### Review

1. Frontend framework, navigation, screen structure, theme implementation, reusable components, forms, tables, modals, and responsive layouts.
2. Backend entry points, API routes, request validation, error handling, authentication or authorization if present, and existing business logic.
3. SQLite schema, relationships, indexes, constraints, migration strategy, and current database contents.
4. Existing inventory workflows, including product CRUD, manufacturer/company management, stock adjustments, low-stock alerts, expiry alerts, catalogue imports, and reports.
5. Existing tests, build scripts, environment variables, dependencies, and deployment assumptions.
6. Existing project documentation and previous audit/cleanup reports in `docs/`.

The current project is understood to use Expo with React Native Web, Express, and SQLite through `better-sqlite3`. **Verify this against the repository rather than assuming it is still accurate.** Do not introduce Prisma, PostgreSQL, MongoDB, or another persistence layer unless a documented technical reason justifies the migration.

### Required audit output

Before implementation, produce:

- A concise architecture and file map.
- The current database schema and relationships.
- A list of working features that must remain functional.
- A gap analysis against the requirements below.
- A proposed target schema, including migration steps from the existing schema.
- A phased implementation plan identifying files to create or modify.
- Risks, dependencies, and acceptance tests for each phase.

Clearly distinguish verified repository facts from proposed design decisions.

---

# Phase 1: UI/UX and Accessibility Overhaul

## 1.1 Light theme by default

Replace the current heavy dark appearance with a professional, high-contrast light theme suitable for retail counters, pharmacies, and warehouse desks.

Use a restrained neutral palette:

- Page background: light slate or zinc.
- Content surfaces: white or near-white.
- Primary text: dark slate.
- Secondary text: muted but readable.
- Borders: subtle neutral tones.
- Primary actions: one consistent brand accent.
- Status colors: accessible green, amber, red, and neutral variants.

Centralize colors, typography, spacing, radii, shadows, and component variants in the existing theme system. Avoid scattering hardcoded colors throughout screens.

The default experience must be light mode. If dark mode is retained, it must be an optional, consistently implemented alternative.

## 1.2 SME usability standards

Design for users who may be operating quickly while handling customers and inventory.

Requirements:

- Readable typography and clear visual hierarchy.
- Comfortable touch targets, ideally around 44 × 44 CSS pixels where applicable.
- Clear stock, expiry, payment, and order status badges.
- Labels that do not rely on color alone.
- Consistent icons with text labels for important actions.
- Visible validation errors and actionable error messages.
- Confirmation before destructive operations.
- Loading, empty, success, and failure states for every data-driven screen.
- Keyboard navigation, visible focus states, and accessible labels.
- Responsive layouts for desktop, tablet, and narrow screens.
- Tables that remain usable on smaller screens, using responsive alternatives where needed.

Do not redesign every screen independently. Establish reusable design patterns and apply them consistently.

## 1.3 Persistent navigation

Provide clear, persistent navigation with these logical groups:

- **Inventory & Catalog**
  - Dashboard
  - Products
  - Low Stock
  - Expiring Stock
- **Orders & Billing**
  - Create Order
  - Orders / Invoices
  - Payments
- **Companies**
  - Manufacturers / Brands
- **Customers**
  - Retailers, Pharmacies, Clinics, Hospitals
- **Reports & Aging**
  - Sales Reports
  - Receivables Aging
  - Stock Movement

Adapt the navigation to the framework's established conventions. On desktop, use a persistent sidebar if appropriate. On smaller screens, use a compact and accessible navigation pattern.

Do not introduce dead navigation items or screens that appear functional but have no implemented behavior.

---

# Phase 2: Data Architecture and Migration-Safe Schema

## 2.1 Data modeling principles

Use the existing database technology unless the audit establishes a compelling reason to change it.

Design a normalized relational schema with explicit relationships, foreign keys, constraints, and indexes. Enforce foreign-key behavior in SQLite.

Separate product identity from physical inventory batches. A product can have multiple batches, each with a different expiry date, purchase cost, selling price, MRP, and stock quantity.

The target design should cover the following entities.

### A. Manufacturers / Companies

Fields should include:

- ID
- Company or manufacturer name
- Contact details where applicable
- Address and relevant business information
- Created and updated timestamps

One company can have many products. Each product must reference a valid parent manufacturer.

### B. Products

Fields should include:

- ID
- Company ID
- SKU or product code
- Product name
- Composition / salt
- Category or dosage form, such as tablets, syrups, injections, or ointments
- Packaging description and unit of measurement
- Tax/GST rate
- Minimum stock threshold
- Active/inactive status
- Created and updated timestamps

Support SKU uniqueness according to a documented business rule. Do not accidentally prevent legitimate products from different manufacturers from having similar names or codes.

### C. Product batches / Inventory lots

Fields should include:

- ID
- Product ID
- Batch number
- Expiry date
- MRP
- Purchase price / distributor cost
- Selling price
- Initial or received quantity where required for auditability
- Current available quantity
- Created and updated timestamps

A product can have multiple batches. Support batch-level stock validation, expiry tracking, and stock deductions.

Prevent expired batches from being sold. Where appropriate, prioritize the earliest-expiring eligible batch when suggesting stock allocation.

Do not silently merge batches with different expiry dates, costs, or batch numbers.

### D. Inventory transactions

Maintain an auditable record of inventory movements, including:

- Product and batch references
- Transaction type, such as opening stock, receipt, sale, adjustment, return, or reversal
- Quantity and direction
- Reference to the associated order or adjustment where applicable
- Timestamp
- Notes and source

Stock changes must be traceable. Avoid directly editing quantities without recording the corresponding inventory movement.

### E. Customers

Create a dedicated customer entity for retailers, pharmacies, clinics, hospitals, and other buyers.

Fields:

- ID
- Business / store name
- Contact person
- Phone
- Email
- Billing and delivery address
- GSTIN
- Drug License Number (DL No.)
- Payment terms in days
- Optional credit ceiling
- Active/inactive status
- Created and updated timestamps

Validate inputs where possible, but do not invent universal validation rules for every license or tax identifier. Support incomplete optional details when the business workflow allows them.

### F. Sales orders / Invoices

Each order must have one customer and multiple line items. Line items can reference products from different manufacturers.

Suggested order fields:

- ID and human-readable invoice number
- Customer reference
- Order / invoice date
- Due date
- Subtotal
- Discount
- Tax totals and tax breakdown
- Final payable amount
- Amount paid
- Outstanding amount, derived or maintained only through a transactionally consistent accounting mechanism
- Order and payment state
- Notes
- Created and updated timestamps

Store the relevant product description, SKU, batch number, unit price, tax rate, and other necessary values as invoice-line snapshots. Historical invoices must not change when a product's name, tax rate, or selling price is edited later.

### G. Sales order line items

Each line must support:

- Order ID
- Product ID
- Allocated batch ID
- Quantity
- Unit selling price
- Discount
- Tax rate
- Taxable value
- Tax amount and breakdown
- Line total

Where one product's requested quantity needs to be fulfilled from multiple batches, support multiple allocation records or another explicit allocation model. Never pretend a single batch fulfilled the quantity if it did not.

### H. Payments and customer ledger

Create a payment entity that supports:

- Customer reference
- Invoice reference where applicable
- Payment date
- Amount
- Payment method
- Transaction/reference number
- Notes

Support partial payments, payments against invoices, and unapplied customer advances if needed by the chosen accounting model.

Maintain an auditable customer ledger for invoices, payments, credit notes, adjustments, and reversals.

**Do not create an independently editable customer outstanding balance that can drift away from invoice and payment records.** Calculate it from the ledger or maintain a rigorously reconciled transactional balance with a clear source of truth.

### I. Distributor settings

Introduce configurable settings for:

- Default payment terms
- Due-soon warning window
- Grace period
- Default credit ceiling, where applicable
- Tax and invoice behavior where required
- Currency and invoice numbering rules

Customer-specific terms and limits should override defaults where appropriate.

## 2.2 Schema and migration requirements

Before changing tables:

1. Back up the existing SQLite database.
2. Document the current schema and existing records.
3. Design explicit, versioned, repeatable migrations.
4. Preserve existing companies, products, inventory transactions, and IDs wherever practical.
5. Migrate existing product-level batch and stock fields into the new batch model without losing information.
6. Use a documented fallback for any legacy data that cannot be mapped unambiguously.
7. Add foreign keys, indexes, uniqueness constraints, and validation.
8. Test migration on a copy of the database before applying it to the working database.

Do not delete, reset, replace, or seed over the existing production-like database. Use synthetic data for new demonstrations and tests.

If migration fails, it must not leave the database in a partially migrated state.

---

# Phase 3: Catalog and Inventory Experience

Implement this phase before customer ordering and payment workflows.

## 3.1 Catalog view

Create a clean, fast, searchable catalog.

### Search

Search across:

- Product name
- Composition / salt
- SKU / product code
- Batch number where useful

Search should be responsive and avoid fetching the entire database repeatedly for every keystroke.

### Filters

Provide filters for:

- Manufacturer / Company
- Product category or dosage form
- Stock status: In Stock, Low Stock, Out of Stock
- Expiry status, including near-expiry and expired inventory where relevant

Ensure that the stock status reflects actual eligible batch inventory, not just the existence of a product record.

### Browsing modes

Provide a toggle between:

**All Products**
- Unified searchable table or grid.
- Product name, SKU, manufacturer, category, stock status, and relevant price information.
- Expand or inspect batch-level details.

**Company-first**
- Manufacturer cards showing useful product counts and stock indicators.
- Selecting a company reveals its associated products.
- Provide a clear route back to all companies and products.

Use pagination or another suitable strategy if the catalog grows. Avoid N+1 API requests and unnecessary frontend computation.

## 3.2 Add Product modal / drawer

Create a modular, validated form that minimizes clicks while retaining data accuracy.

Fields:

- Manufacturer selection using a searchable picker.
- Inline Add New Company option.
- Product name.
- SKU / product code.
- Composition / salt.
- Category / dosage form.
- Packaging and unit of measurement.
- Tax/GST rate.
- Batch number.
- Expiry date.
- MRP.
- Purchase price.
- Selling price.
- Initial stock quantity.
- Low-stock threshold.

Keep the distinction between creating a product and receiving a batch clear. If the user creates a product with initial stock, create the product, batch, and opening inventory transaction consistently.

Use sensible defaults only where they are safe. Do not invent expiry dates, prices, quantities, or company assignments.

### Validation

- Require a valid manufacturer, product name, and the fields necessary to create a sellable batch.
- Reject negative quantities and invalid monetary values.
- Validate date ordering and expiry status.
- Validate prices and tax rates according to documented business rules.
- Display field-level errors.
- Prevent duplicate submissions.
- Return useful server-side validation errors.

## 3.3 Bot-ready API contract

The same backend workflow must support both manual forms and future structured voice extraction.

Define a stable, documented JSON request schema for `POST /api/products`, with:

- Explicit field names and types.
- Required and optional fields.
- Validation rules.
- Consistent error responses.
- Clear separation between product data and initial batch data.

If the current endpoint's payload must change, update all existing callers and document the migration. Prefer backward-compatible changes when practical.

The backend must remain the authority for validation, price calculations, company relationships, and inventory changes. Do not trust values merely because they came from the UI or a future language model.

---

# Phase 4: Customer Management

Create a dedicated Customers screen with complete CRUD workflows.

### Customer list

Include:

- Business name
- Contact person
- Phone
- Payment terms
- Outstanding balance
- Earliest due date or overdue indicator
- Credit utilization / risk status where applicable

Provide search, sorting, filtering, pagination, and useful empty states.

### Customer detail view

Include:

- Business and contact information.
- GSTIN and drug license information.
- Billing and delivery addresses.
- Agreed payment terms and credit limit.
- Invoice history.
- Payment history.
- Outstanding invoices.
- Customer ledger.
- Aging summary.

### Customer creation and editing

Use a validated form with clear required/optional fields. Allow customers to be marked inactive rather than permanently deleting customers who have financial history.

Support a walk-in customer workflow for order creation. Use a proper one-time customer or walk-in configuration that does not generate duplicate customer records on every sale.

Do not allow deletion of a customer that has historical financial records unless a safe, explicitly designed archival or migration process is used.

---

# Phase 5: Multi-Company Order Creation and Billing

Implement a single invoice that can contain products from multiple manufacturers.

## 5.1 Order creation workflow

The order entry screen should support:

1. Select an existing customer or choose a walk-in customer.
2. Set the order/invoice date.
3. Search for a product by name, SKU, or composition.
4. Display its manufacturer, available batches, expiry dates, available quantities, MRP, and selling price.
5. Select an eligible batch and enter the requested quantity.
6. Add products from other manufacturers in subsequent rows.
7. Edit quantities and discounts.
8. Remove a line before finalizing the invoice.
9. Review totals and confirm the order.

Product search and line addition should be fast enough for counter-based operations. Preserve keyboard focus and minimize unnecessary modal interactions.

## 5.2 Pricing and tax calculations

For each line, calculate:

- Quantity × unit selling price.
- Line discount, if applicable.
- Taxable value.
- GST based on the applicable tax rate and documented pricing convention.
- Line total.

At the invoice level, calculate:

- Subtotal.
- Total discount.
- Tax breakdown.
- Final payable amount.
- Amount paid.
- Outstanding amount.

Define whether entered prices are tax-inclusive or tax-exclusive and use that convention consistently throughout the application.

For Indian GST, represent the applicable tax breakdown correctly, including CGST/SGST or IGST when relevant to the distributor's configured business and place-of-supply rules. Do not infer tax treatment from a product name.

Use decimal-safe monetary arithmetic, preferably integer minor currency units or a suitable decimal strategy. Avoid floating-point rounding errors in financial calculations.

The server must independently validate or calculate financial totals. Never rely solely on client-side calculations.

## 5.3 Inventory validation and stock deduction

Before finalizing an order:

- Verify that every product and batch exists and belongs together.
- Verify that quantities are positive.
- Verify that the selected batch is not expired.
- Verify that sufficient stock is available.
- Prevent overselling.
- Check all line items before making changes.
- Deduct inventory and create inventory transaction records atomically with order finalization.
- Prevent duplicate invoice creation from repeated requests.

If any validation fails, the entire operation must roll back. Do not deduct stock for only some lines in an invoice that failed.

Where appropriate, suggest an earlier-expiring eligible batch, but do not silently substitute a different batch after the user has selected one.

## 5.4 Invoice lifecycle

Implement explicit order states, such as Draft, Confirmed, and Cancelled, according to the existing business model.

A cancelled or reversed finalized invoice must restore stock through auditable reversal transactions. Do not delete historical invoice records to simulate cancellation.

Keep the invoice's historical pricing and tax values unchanged when catalog data changes.

---

# Phase 6: Payment Cycles, Receivables, and Aging

## 6.1 Due-date calculation

Calculate the due date from the invoice date and the applicable customer payment terms.

Example: an invoice dated 1 October with 15-day terms should have a due date calculated using the documented date convention.

Define whether the invoice date counts as day zero and test boundary cases. Store dates consistently and avoid timezone-related date shifts.

Existing invoices must retain their original payment terms and due dates unless an explicit, auditable correction is made.

## 6.2 Payment status

Support the required business statuses:

- Paid
- Partially Paid
- Due Soon
- Overdue

Define their precedence and calculation rules so they cannot conflict.

Recommended logic:

1. Paid when the outstanding amount is zero.
2. Overdue when a positive balance remains after the due date and applicable grace period.
3. Partially Paid when some payment has been received but a balance remains and the invoice is not overdue.
4. Due Soon when an unpaid balance is approaching its due date within the configured warning window.
5. Otherwise, show a distinct Outstanding / Not Yet Due state.

Do not store independently editable statuses that can contradict invoice dates and payment amounts. Derive them from the underlying records and settings.

## 6.3 Credit and risk settings

Support:

- Default customer credit ceiling.
- Customer-specific credit ceiling.
- Due-soon warning window.
- Configurable grace period.
- Credit utilization.
- High-priority risk indicators for overdue balances or exceeded credit limits.

Risk indicators should explain why the account was flagged. Avoid blocking every order automatically unless the distributor explicitly configures that policy.

## 6.4 Payment entry

Allow users to:

- Record full or partial payments.
- Allocate a payment to one or more invoices where supported.
- Record payment method, date, reference, and notes.
- View the resulting outstanding amount immediately.
- Correct mistakes through auditable reversals rather than silently deleting financial records.

Make all payment and ledger updates transactionally consistent.

---

# Phase 7: Reports and Operational Insights

## 7.1 Receivables Aging Report

Provide a distributor-level report grouped into:

- Not yet due.
- Less than 15 days overdue.
- 15–30 days overdue.
- 30–60 days overdue.
- 60+ days overdue.

Define the boundaries precisely, including the treatment of exactly 15, 30, and 60 days.

Bucket balances based on days past due, not merely the age of the customer or invoice. Use the outstanding portion of each invoice, and ensure the totals reconcile with the customer ledger.

Provide drill-down from each bucket to the relevant customer and invoices.

## 7.2 Sales by Company

Provide sales summaries by manufacturer, including:

- Sales volume.
- Revenue.
- Discounts.
- Tax totals where relevant.
- Cost of goods sold where reliable cost data exists.
- Gross margin and margin contribution.

Define margin calculations explicitly. Use historical invoice-line selling prices and appropriate cost records rather than current catalog prices.

If reliable historical cost data is unavailable, display that limitation instead of presenting an invented margin.

## 7.3 Stock Movement and Expiry

Provide:

- Fast-moving products.
- Slow-moving or dead stock.
- Recent stock receipts and sales.
- Low-stock items.
- Near-expiry batches.
- Expired stock.
- Inventory valuation where cost data is reliable.

Define the lookback window and movement classification rules. Make the reporting period configurable where useful.

## 7.4 Report quality

- Use efficient database queries and suitable indexes.
- Keep financial totals consistent with invoices, payments, and inventory records.
- Include useful date filters.
- Handle empty datasets.
- Provide understandable labels and definitions.
- Ensure report totals reconcile with their underlying records.

---

# Phase 8: API Design, Validation, and Reliability

Use the existing Express architecture unless the audit establishes otherwise.

Organize routes and services by business domain, for example:

- Products and batches.
- Companies.
- Customers.
- Orders and invoices.
- Payments and ledger.
- Reports and aging.
- Distributor settings.

Do not put all business logic into route handlers or React components.

### API requirements

- Validate incoming payloads on the server.
- Use consistent HTTP status codes and error structures.
- Handle missing and invalid entities explicitly.
- Prevent duplicate submissions where financial or stock operations are involved.
- Use transactions for multi-step database operations.
- Use pagination and filtering for potentially large collections.
- Avoid exposing internal stack traces, secrets, or sensitive database information.
- Keep secrets in environment variables and out of frontend bundles.
- Maintain compatibility with existing working endpoints where practical.

Add or update API documentation with example requests, responses, validation failures, and relevant status codes.

---

# Phase 9: Testing and Acceptance Criteria

Do not consider a feature complete because the UI renders.

## Data and migration tests

- Existing records survive migration.
- Existing product and company workflows continue to work.
- Foreign-key constraints are enforced.
- Products can have multiple batches.
- Stock movements remain auditable.
- Migration can be tested on a database copy and fails safely.

## Catalog tests

- Search by name, composition, and SKU.
- Filter by company, category, stock status, and expiry.
- All Products and Company-first views show consistent data.
- Creating a product with initial stock creates the appropriate batch and opening transaction.
- Invalid or incomplete payloads are rejected.

## Customer and finance tests

- Customer CRUD and inactive-customer handling.
- Customer payment terms and due dates.
- Partial and full payments.
- Outstanding balances reconcile with invoices and payments.
- Aging boundaries are correct.
- Credit warnings trigger at the configured thresholds.

## Order tests

- One invoice contains products from multiple manufacturers.
- Line totals, discounts, and taxes are correct.
- Insufficient stock prevents finalization.
- Expired batches cannot be sold.
- Failure on any line rolls back the entire order.
- Duplicate requests do not create duplicate invoices or stock deductions.
- Invoice cancellation or reversal restores stock correctly.
- Historical invoices remain unchanged when catalog values change.

## UI/UX tests

- Light theme is applied consistently.
- Navigation works across screen sizes.
- Forms have accessible labels and field-level errors.
- Buttons have visible loading and disabled states where appropriate.
- Empty, error, and success states are present.
- Search and filtering remain responsive.
- No existing core workflow is unintentionally broken.

Run the available TypeScript checks, linting, formatting checks, production build, and relevant automated tests. Add focused tests for new business rules rather than suppressing errors to obtain a clean build.

Report actual results. Do not claim a test passed unless it was executed.

---

# Phase 10: Implementation Sequence and Deliverables

Implement the work in the following order.

### Milestone 1: Audit and design

Deliver the repository audit, current schema, target schema, migration plan, and phased file-change plan. Wait for review before making structural changes.

### Milestone 2: Theme and catalog

Implement the centralized light theme, shared UI patterns, revised Catalog view, batch-aware inventory display, filtering, search, and Add Product workflow.

Validate that existing inventory features still work.

### Milestone 3: Database and customer management

Implement the schema migrations, customer APIs, customer screens, and ledger foundation. Test on a database copy before migrating working data.

### Milestone 4: Orders and invoices

Implement multi-company order entry, batch selection, tax calculations, stock validation, transactional stock deduction, and invoice history.

### Milestone 5: Payments and reporting

Implement payment entry, due-date calculations, aging, credit-risk indicators, Sales by Company, and Stock Movement reports.

### Milestone 6: Integration and verification

Run the complete test suite, validate critical workflows end to end, review database consistency, and document any remaining limitations.

After each milestone, report:

- Files created or modified.
- Schema changes and migration results.
- Features completed.
- Commands and tests executed, including actual outcomes.
- Known issues and remaining work.
- A concise manual verification checklist.

Keep the repository organized. Remove unused code only after verifying it is genuinely unused, and do not introduce unnecessary dependencies or unrelated refactors.

---

# Important Constraints

1. Preserve existing working functionality and existing database records.
2. Back up the database and use migration-safe changes.
3. Do not replace SQLite or the existing frontend framework without a documented justification and approval.
4. Do not implement the voice bot in this phase. However, keep the APIs and business services structured so a future voice interface can reuse them.
5. Do not send WhatsApp messages or make external payments automatically.
6. Do not fabricate customer, inventory, payment, or test data in the real database.
7. Do not silently delete or overwrite records.
8. Do not use current catalog prices to rewrite historical invoices.
9. Do not report unimplemented UI as completed functionality.
10. Prefer a small, correct, tested implementation over a broad but fragile one.

## Final Definition of Done

The upgraded MediDist application should provide a clean light-theme interface, a company-linked multi-batch product catalog, reliable customer records, a single invoice containing products from multiple manufacturers, auditable inventory movements, consistent payments and outstanding balances, and useful receivables and stock reports.

The manual workflows must be dependable first. Future voice input should be able to invoke the same validated operations without changing the underlying business schema or bypassing business rules.
