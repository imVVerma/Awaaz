# Med-Inventory: Comprehensive Frontend Interaction Walkthrough & User Journey

> **Document Metadata**  
> **Author:** Lead Product Designer & System Architect  
> **Target Audience:** Product Teams, Frontend/Full-Stack Engineers, QA Leads, and Domain Specialists  
> **Application:** Med-Inventory (MediDist Distribution Platform)  
> **Export File:** `antigravity_user_journey.md`  
> **Baseline Release:** v2.4 (Core Overhaul & Operational Refinement)

---

## Executive Summary & Architectural Philosophy

As the Lead Product Designer and System Architect for Med-Inventory, I engineered this frontend experience around a single core reality: **wholesale pharmaceutical distribution is a high-velocity, low-margin, strictly regulated business where data errors lead directly to financial loss or regulatory non-compliance.**

A distributor does not have time to navigate multi-level nested menus or puzzle over ambiguous icons. Every morning, they face physical stock trucks unloading cartons at their dock, ringing phones from retail chemists demanding credit dispatch within two hours, and looming expiry dates that turn costly stock into worthless biohazard waste.

Our frontend interface reflects these high-stakes realities through four guiding design principles:
1. **Zero-Ambiguity Operational States:** High-risk variables (expired lots, overdue debts, depleted stock) are aggressively color-coded and isolated from regular operational numbers.
2. **FEFO-Enforced Workflows:** First-Expiry-First-Out is not an optional suggestion; the user interface automatically surfaces and prioritizes lots expiring earliest during sales invoicing.
3. **Decoupled Commercial Streams:** Procurement (Inbound Bills from Suppliers) and Distribution (Outbound Invoices to Pharmacies) are strictly segregated across database models, ledgers, and navigation tabs.
4. **Resilient Local Operations:** Designed with optimistic query caching, instant search filtering, keyboard-first form navigation, and clear visual receipts for every transaction.

Below is an exhaustive, scenario-driven walkthrough of every route, interaction, modal, state machine transition, and underlying architectural rationale in the Med-Inventory client.

---

## 1. Global Navigation & Layout Architecture

```
+---------------------------------------------------------------------------------------------------+
|  [MediDist Brand Logo]   Active Route Header: "Dashboard" / "Sales"        [Theme: Light Mode]    |
+---------------------------------------------------------------------------------------------------+
|                                                                                                   |
|                                       PAGE WORKSPACE                                              |
|                                                                                                   |
+---------------------------------------------------------------------------------------------------+
|   [Home]           [File-Text]         [Truck]           [Users]          [Package]    [Bar-Chart]|
|  Dashboard            Sales           Purchases         Customers         Products      Reports   |
+---------------------------------------------------------------------------------------------------+
```

### 1.1 Structural Shell & Accessibility
The application is wrapped in a responsive shell adhering to React Navigation's bottom tab architecture, optimized for desktop screens (via Chrome/Electron/Web) and tablet viewports used on warehouse counters.

- **Theme & Palette System:** Uses a clean, medical-grade Light Mode baseline (`#F8FAFC` root background, `#FFFFFF` cards, `#0EA5E9` primary cyan-blue, `#10B981` success green, `#F59E0B` alert amber, `#EF4444` danger red). Dark mode toggle is available in theme settings.
- **Glassmorphic Bottom App Bar:** Anchored at the bottom with a 60px fixed height, 1px top border (`#E2E8F0`), and blur backdrop (`expo-blur`) on supported devices.
- **Persistent Route Indicators:** Active tab icons and typography render in `theme.primary` with a 600-font-weight label; inactive tabs remain muted in `theme.tabIconDefault` (`#64748B`).

### 1.2 Global Tabs Mapping

| Tab Title | Icon | Route Identifier | Target Stack Navigator | Core Operational Domain |
| :--- | :---: | :--- | :--- | :--- |
| **Dashboard** | `home` | `DashboardTab` | `DashboardStackNavigator` | High-level triage, morning alerts, priority KPIs |
| **Sales** | `file-text` | `OrdersTab` | `OrdersStackNavigator` | Outbound tax invoicing, counter billing, customer receipts |
| **Purchases** | `truck` | `PurchasesTab` | `PurchasesStackNavigator` | Inbound vendor shipments, goods receipt, lot creation |
| **Customers** | `users` | `CustomersTab` | `CustomersStackNavigator` | Retail chemist directory, credit aging, customer ledgers |
| **Products** | `package` | `ProductsTab` | `ProductsStackNavigator` | Master product catalog, batch stock, company filtering |
| **Reports** | `bar-chart-2`| `ReportsTab` | `ReportsStackNavigator` | Receivables aging, brand turnover, stock movement |

---

## 2. Dashboard (`/`) — Morning Operational Triage

> **Scenario:**  
> It is 08:30 AM. Ramesh, the distribution manager, arrives at the wholesale warehouse. Before taking customer phone calls or unloading new shipments, he opens Med-Inventory on his desktop counter. He needs to immediately answer three critical questions:
> 1. *What medicines are out of stock or close to running dry?*
> 2. *Are there near-expiry batches that need to be pushed out or returned to the manufacturer for credit notes?*
> 3. *How much capital is trapped in unpaid market credit, and what is critically overdue?*

```
+---------------------------------------------------------------------------------------------------+
|  DASHBOARD                                                                     [Pull to Refresh]  |
+---------------------------------------------------------------------------------------------------+
|  [ ! Alert ] Low Stock            [ Clock ] Expiring Soon         [ Credit ] Customer Receivables |
|  14 products below threshold      8 lots within 90d (2 <30d)      Rs 4,82,350.00 Total Due        |
|  [ > View Filtered ]              [ ! 3 Expired Lots Isolated ]   Rs 1,12,400 Overdue (6 Invoices)|
+---------------------------------------------------------------------------------------------------+
|  SECTION: Urgent Low Stock Items                                               [ View All (14) > ]|
|  - Amoxyclav 625 (Cipla Ltd) ........................................ 4 / 20 units [==------]     |
|  - Pan-D Capsules (Alkem Labs) ...................................... 0 / 15 units [--------]     |
+---------------------------------------------------------------------------------------------------+
|  SECTION: Near Expiry Batches (<90 Days)                                       [ Manage (8) > ]   |
|  - Azithral 500 | Lot: AZ-202 | Exp: 2026-11-15 ..................... [ 27d left - Urgent Danger ] |
|  - Telma-H 40   | Lot: TL-881 | Exp: 2026-12-30 ..................... [ 72d left - Alert Amber ]  |
+---------------------------------------------------------------------------------------------------+
```

### 2.1 Actionable KPI Metric Cards (Top Row)

Rather than cluttering the screen with vanity numbers (like total product counts or system user IDs), the dashboard displays three actionable cards linked to underlying live database queries:

#### 1. Low Stock Indicator Card
- **UI Structure:** Left accent border in Warning Amber (`#F59E0B`), alert-triangle badge icon, large numerical count, and subtext `"products below threshold"`.
- **Underlying Logic:** Evaluates total non-expired sellable stock for each product against its configured `minimum_stock_level`. If a product has multiple batches, their sellable quantities are summed prior to threshold comparison.
- **Micro-Interaction:** 
  - *Trigger:* User clicks the card or the right chevron.
  - *State Transition:* Navigates directly to `DashboardStackNavigator -> LowStock` (filtered catalog view showing strictly products whose sellable quantity is $\le$ threshold).
  - *Intent:* Allows Ramesh to instantly generate a reorder purchase sheet for his suppliers before morning stocks run out.

#### 2. Expiring Soon Indicator Card
- **UI Structure:** Left accent border in Danger Red (`#EF4444`), clock icon badge, batch count expiring within 90 days, breakdown indicator (`<30d`), and a distinct Danger Badge if expired lots are present (`"X expired lot(s) isolated"`).
- **Underlying Logic:** Queries `product_batches` where `expiry_date` is between today and `today + 90 days` with `current_quantity > 0`. Crucially, lots with `expiry_date <= today` are excluded from the "soon" tally and flagged separately as isolated non-sellable inventory.
- **Micro-Interaction:**
  - *Trigger:* Clicking the card.
  - *State Transition:* Redirects to `ExpiringSoonScreen` with full breakdown tabs (`<30d`, `<60d`, `<90d`, and `Expired Lots`).
  - *Intent:* Prevents distributor dead-stock loss by enabling rapid return-to-vendor (RTV) claims or clearance discounts before the expiration date arrives.

#### 3. Customer Receivables Indicator Card
- **UI Structure:** Left accent border in Primary Blue (`#0EA5E9`), credit-card badge icon, formatted total currency (`₹ 4,82,350.00`), and a secondary colored line indicating overdue debt (`"₹ 1,12,400.00 overdue (6 invoices)"`).
- **Underlying Logic:** Aggregates all unpaid balances from finalized, non-cancelled sales invoices (`total_amount - paid_amount`). Reconciles against the `customer_ledger` debit/credit entries. Cancelled and draft invoices are excluded.
- **Micro-Interaction:**
  - *Trigger:* Clicking the card.
  - *State Transition:* Jumps across tabs to `ReportsTab -> ReceivablesAging`.
  - *Intent:* Informs the distributor which pharmacies have exhausted their credit terms so dispatch can be paused until payments are collected.

### 2.2 Lower-Half Operational Modules

#### Module A: Urgent Low Stock Preview
- **Display:** Displays the top 5 most critically depleted medicines.
- **Visual Ratio Bar:** Each row renders an urgency track:
  - If available quantity is `0`: Bar is 100% Danger Red (`#EF4444`) with `"0 / 15 units left"`.
  - If available quantity is $> 0$ but below threshold: Bar fills proportionally in Warning Amber (`#F59E0B`).
- **Interaction:** Tapping any product navigates to the Product Edit view; tapping `"View All (N)"` opens the full low-stock list.

#### Module B: Near-Expiry Batches Preview
- **Display:** Displays up to 4 batches approaching expiry sorted chronologically (FEFO).
- **Badge Indicators:**
  - Batches $< 30$ days: Danger Red pill badge (`"14d left"` or `"Expired"`).
  - Batches $31 - 90$ days: Warning Amber pill badge (`"54d left"`).
- **Interaction:** Tapping `"Manage (N)"` opens `ExpiringSoonScreen`.

---

## 3. Sourcing & Inbound Stock (`/purchases`)

> **Scenario:**  
> At 10:15 AM, a delivery van from "Apex Healthcare Distributors" arrives at the warehouse dock with 3 sealed cartons. The delivery agent hands Ramesh a physical paper bill: Invoice `#APEX-2026-9081`, dated today, listing 50 strips of *Augmentin 625 Duo* (Batch: `AUG-991`, Exp: 2028-04) and 100 bottles of *Ascoril LS Syrup* (Batch: `ASC-410`, Exp: 2027-11). Ramesh must ingest these goods into the system to increase inventory lots and log the purchase liability.

```
+---------------------------------------------------------------------------------------------------+
|  PURCHASES (Inbound Invoices)                    [ Search by supplier / invoice # ]  [🚚]  [ + ]  |
+---------------------------------------------------------------------------------------------------+
|  +---------------------------------------------------------------------------------------------+  |
|  | Invoice #APEX-2026-9081                           Rs 34,500.00                              |  |
|  | Apex Healthcare Distributors                      Inbound * PENDING                         |  |
|  | Date: 2026-10-19 * 2 line items                                                          >  |  |
|  +---------------------------------------------------------------------------------------------+  |
|  +---------------------------------------------------------------------------------------------+  |
|  | Invoice #CIP-90122                                Rs 1,12,000.00                            |  |
|  | Cipla Direct Depot                                Inbound * PAID                            |  |
|  | Date: 2026-10-15 * 5 line items                                                          >  |  |
|  +---------------------------------------------------------------------------------------------+  |
+---------------------------------------------------------------------------------------------------+
```

### 3.1 Purchases Directory Screen (`PurchasesScreen.tsx`)

#### Header Actions
- **Supplier Directory Shortcut (`truck` icon):** Navigates to `SuppliersScreen` to view or register vendor contact details, drug license numbers, and GSTINs.
- **New Inbound Bill (`+` icon):** Opens `CreatePurchaseScreen`.

#### Search & List Filtering
- **Search Bar:** Real-time client-side filter matching both supplier name and supplier invoice number.
- **Invoice Card Details:** Shows purchase invoice number, supplier name, grand total, payment status pill (`PENDING`, `PARTIALLY_PAID`, `PAID`), invoice date, and count of line items.
- **Card Click:** Opens `PurchaseDetailScreen` showing line-item breakdowns and audit logs.

---

### 3.2 Inbound Invoice Recording Walkthrough (`CreatePurchaseScreen.tsx`)

```
+---------------------------------------------------------------------------------------------------+
|  < Back   RECORD INBOUND PURCHASE                                                                 |
+---------------------------------------------------------------------------------------------------+
|  SUPPLIER / VENDOR DETAILS                                                                        |
|  Select Supplier: [ Apex Healthcare Distributors                      v ]   [ + Quick Add Vendor ]|
|  Supplier Bill / Invoice #: [ APEX-2026-9081                     ]                                |
|  Bill Date: [ 2026-10-19        ]   Notes: [ Cartons inspected in good condition.               ] |
+---------------------------------------------------------------------------------------------------+
|  PURCHASE LINE ITEMS (2 items recorded)                                     [ + Add Medicine Lot ]|
|  1. Augmentin 625 Duo (GSK) | Lot: AUG-991 | Exp: 2028-04 | 50 units @ Rs 180.00 + 12% GST        |
|  2. Ascoril LS Syrup (Glenmark) | Lot: ASC-410 | Exp: 2027-11 | 100 units @ Rs 75.00 + 12% GST     |
+---------------------------------------------------------------------------------------------------+
|  INVOICE FINANCIAL SUMMARY                                                                        |
|  Taxable Subtotal: Rs 16,500.00    | Total GST Tax: Rs 1,980.00    | Grand Total: Rs 18,480.00    |
+---------------------------------------------------------------------------------------------------+
|                                 [ CONFIRM & INGEST INBOUND STOCK ]                                |
+---------------------------------------------------------------------------------------------------+
```

#### Step 1: Selecting or Creating a Supplier
1. **Dropdown Trigger:** User clicks `Select Supplier`. A modal/picker opens showing registered vendors.
2. **Inline Vendor Addition:** If this is a new distributor vendor:
   - User taps `+ Quick Add Vendor`.
   - A modal dialog appears with fields: `Vendor Name*`, `Contact Person`, `Phone Number`, `GSTIN`.
   - On tapping `Save Supplier`, the system calls `POST /api/suppliers`, invalidates `["/api/suppliers"]`, automatically selects the newly created vendor in the dropdown, and closes the modal without losing user input in other fields.

#### Step 2: Sourcing Metadata Entry
- **Invoice Number Input:** Mandatory alphanumeric field. E.g., `APEX-2026-9081`. Prevents duplicate bill entry from the same vendor.
- **Invoice Date Picker:** Date input default to current system date (`YYYY-MM-DD`).
- **Internal Notes:** Optional field for recording delivery vehicle numbers, carton conditions, or breakages.

#### Step 3: Adding Medicine Lots via Modal (`Add Medicine Lot`)
Clicking `+ Add Medicine Lot` opens a focused batch creation modal:

```
+---------------------------------------------------------------------------------------------------+
|  ADD INBOUND MEDICINE LOT                                                                     [X] |
+---------------------------------------------------------------------------------------------------+
|  Select Master Product: [ Augmentin 625 Duo (GlaxoSmithKline)                                  v ]|
|  Batch / Lot Number*:   [ AUG-991                         ]  (Auto-uppercased)                    |
|  Expiry Date*:          [ 2028-04-30                      ]                                       |
|  Received Quantity*:    [ 50                              ]  (Units / Strips)                     |
|  Purchase Rate (Cost)*: [ 180.00                          ]  (Excl. GST)                          |
|  Maximum Retail Price:  [ 245.00                          ]  (MRP printed on pack)                |
|  Default Selling Price: [ 210.00                          ]  (Trade rate to retail chemist)       |
|  Applicable GST Rate:   [ 12%                             v ]                                     |
+---------------------------------------------------------------------------------------------------+
|                                      [ + ADD TO INVOICE ITEMS ]                                   |
+---------------------------------------------------------------------------------------------------+
```

- **Product Selection Auto-Fill:** Selecting `Augmentin 625 Duo` automatically looks up product defaults:
  - Pre-fills `purchase_price` with previous purchase rate.
  - Pre-fills `mrp` with default MRP.
  - Calculates trade `selling_price` at wholesale benchmark ($MRP \times 0.85$).
  - Pre-fills `tax_rate` (e.g., 12% standard pharma GST).
- **Field Validations:**
  - `Batch Number`: Mandatory; automatically converted to uppercase.
  - `Expiry Date`: Mandatory; validates format and rejects expired dates.
  - `Quantity`: Must be an integer $> 0$.
  - `Purchase Price`: Must be a decimal $> 0$.
- **Add to Invoice:** Tapping `+ ADD TO INVOICE ITEMS` validates the inputs, pushes the item into the draft table, and dismisses the modal.

#### Step 4: Submission & State Machine (`Confirm Inbound Stock`)
When Ramesh clicks the primary button:
1. **Frontend Disables Input:** Button state changes to loading spinner (`ActivityIndicator`).
2. **API Payload:** `POST /api/purchases` with `{ supplier_id, purchase_invoice_number, invoice_date, items: [...] }`.
3. **Database Transaction:**
   - Creates row in `purchases` table.
   - Inserts rows into `purchase_items`.
   - Locates or creates matching `product_batches` row (`batch_number`, `expiry_date`, `purchase_price`, `mrp`, `selling_price`).
   - Increments `current_quantity` on `product_batches`.
   - Increments aggregate `stock_quantity` on `products`.
   - Logs an audit row in `inventory_transactions` with `transaction_type = 'purchase'`.
4. **Cache Invalidation:** Invalidates `["/api/purchases"]`, `["/api/products"]`, `["/api/batches"]`, and `["/api/dashboard/stats"]`.
5. **Redirection:** Navigates back to `PurchasesScreen` with the newly ingested invoice appearing at the top of the list.

---

## 4. Sales & Customer Invoicing (`/sales`)

> **Scenario:**  
> At 11:30 AM, Dr. Sharma from "Apollo Pharmacy - Metro Branch" calls on the wholesale counter line:  
> *"Ramesh bhai, send me 10 strips of Augmentin 625 Duo and 5 bottles of Ascoril LS immediately. Give me standard 5% trade discount. Bill it to my monthly credit account."*  
> Ramesh opens the **Sales** tab to generate a compliant GST Tax Invoice.

```
+---------------------------------------------------------------------------------------------------+
|  < Back   NEW SALES INVOICE (Tax Invoice)                                                         |
+---------------------------------------------------------------------------------------------------+
|  CUSTOMER SELECTION                                                                               |
|  Select Pharmacy / Buyer: [ Apollo Pharmacy - Metro Branch (DL-20B-1192)                       v ]|
|  Balance: Rs 14,200 (Credit Limit: Rs 1,00,000) * 30 Days Credit Term                             |
+---------------------------------------------------------------------------------------------------+
|  LINE ITEMS (Add medicines from any manufacturer)                                                 |
|  Select Product: [ Augmentin 625 Duo (GSK)               v ]                                      |
|  Available Batch (FEFO): [ AUG-991 (Exp: 2028-04) - 50 avail v ]                                  |
|  Quantity: [ 10      ]   Rate: [ 210.00    ]   Disc %: [ 5.0 ]   GST: [ 12% ]  [ + Add Line Item ]|
+---------------------------------------------------------------------------------------------------+
|  BILLED ITEMS LIST                                                                                |
|  1. Augmentin 625 Duo | Lot: AUG-991 | 10 pcs @ Rs 210.00 (-5% disc) = Rs 1,995.00 + 12% GST     |
|  2. Ascoril LS Syrup  | Lot: ASC-410 |  5 pcs @ Rs 110.00 (-5% disc) = Rs   522.50 + 12% GST     |
+---------------------------------------------------------------------------------------------------+
|  FINANCIAL SUMMARY                                                                                |
|  Taxable Subtotal: Rs 2,517.50   | Total GST (6% CGST + 6% SGST): Rs 302.10                       |
|  GRAND TOTAL PAYABLE: Rs 2,819.60                                                                 |
+---------------------------------------------------------------------------------------------------+
|  SETTLEMENT & TERMS                                                                               |
|  [ ] Collect Payment Immediately at Counter (Cash / UPI / Bank)                                   |
|  [X] Bill to Customer Account Ledger (Net 30 Days Credit)                                         |
+---------------------------------------------------------------------------------------------------+
|                                     [ GENERATE TAX INVOICE ]                                      |
+---------------------------------------------------------------------------------------------------+
```

### 4.1 Order Creation Interaction Flow (`CreateOrderScreen.tsx`)

#### Step 1: Customer Selection
- **Default Customer:** Pre-selects `Walk-in Customer` (`id: 1`) for over-the-counter retail cash transactions.
- **Account Lookup Modal:** Clicking customer name opens a searchable directory of registered pharmacies.
- **Credit Limit & Term Badges:** Upon selecting "Apollo Pharmacy", the header displays:
  - Current outstanding ledger balance (`₹ 14,200.00`).
  - Permitted credit ceiling (`₹ 1,00,000.00`).
  - Credit period in days (`30 Days`).
  - Visual warning badge if credit ceiling is breached or overdue invoices exist.

#### Step 2: Line Item Selection & FEFO Batch Enforcer
1. **Product Dropdown:** Ramesh types "Augmentin". The system filters products regardless of company (supporting multi-manufacturer orders on a single invoice).
2. **FEFO Batch Auto-Selection:**
   - Once the product is selected, the system filters active batches for that product where `current_quantity > 0` and `expiry_date > today`.
   - **FEFO Logic:** Sorts batches ascending by `expiry_date`. The batch expiring earliest is pre-selected by default.
   - Batch selector explicitly renders: `Batch Number`, `Expiry Date`, and `Available Units` (e.g., `AUG-991 | Exp: 2028-04 | 50 units available`).
3. **Quantity & Stock Validation:**
   - Ramesh types `10`.
   - If the user types a quantity higher than the selected batch's physical stock (e.g., `60`), the system triggers an alert:  
     `"Stock Limit Exceeded: Batch AUG-991 has only 50 units available."` and blocks line insertion.
4. **Wholesale Pricing & Discount Calculation:**
   - Unit price pre-fills with the batch's trade rate (`₹ 210.00`). Ramesh enters `5` in `Discount %`.
   - Real-time arithmetic calculates:
     $$\text{Gross} = 10 \times 210.00 = ₹ 2,100.00$$
     $$\text{Discount} = 2,100.00 \times 0.05 = ₹ 105.00$$
     $$\text{Taxable} = 2,100.00 - 105.00 = ₹ 1,995.00$$
     $$\text{GST (12\%)} = 1,995.00 \times 0.12 = ₹ 239.40$$
     $$\text{Line Total} = 1,995.00 + 239.40 = ₹ 2,234.40$$
5. **Item Staging:** Ramesh clicks `+ Add Line Item`. The row is appended to the draft list with an inline red `trash` icon for rapid deletion.

#### Step 3: Payment Settlement Selection
- **Option A (Counter Settlement):** Checkbox `Collect Payment Immediately`. Expands radio buttons for `Cash`, `UPI`, or `Bank Transfer`. On invoice creation, immediately logs a matching payment and marks the invoice as `Paid`.
- **Option B (Credit Account):** Left unchecked. The grand total of `₹ 2,819.60` is posted as an open receivable on Apollo Pharmacy's account with a due date calculated as `Today + 30 Days`.

#### Step 4: Submission & State Updates
Ramesh clicks `GENERATE TAX INVOICE`:
- **API Call:** `POST /api/orders`
- **Database Atomic Execution:**
  - Assigns sequential invoice number: `INV-2026-0042`.
  - Creates row in `orders` with `status = 'Pending'` (or `'Paid'`).
  - Inserts line items into `order_items` preserving batch IDs and historical prices.
  - **Stock Deduction:** Decrements `AUG-991` batch quantity by 10; decrements product aggregate stock by 10.
  - **Audit Logging:** Inserts row into `inventory_transactions` with `transaction_type = 'sale'`.
  - **Ledger Posting:** Inserts debit entry into `customer_ledger`.
- **Visual Feedback & Redirection:** Navigates directly to `OrderDetailScreen` rendering the formal tax invoice.

---

### 4.2 Invoice Document & Cancellation Workflow (`OrderDetailScreen.tsx`)

```
+---------------------------------------------------------------------------------------------------+
|  < Sales Directory        TAX INVOICE #INV-2026-0042                  [ Print ]   [ Cancel Invoice ]|
+---------------------------------------------------------------------------------------------------+
|  MediDist Pharma Distributors                                                                     |
|  Shop 14, Wholesale Medicine Market, Delhi * GSTIN: 07AAAAA0000A1Z5 | DL: DL-20B/21B-987654       |
+---------------------------------------------------------------------------------------------------+
|  BILLED TO: Apollo Pharmacy - Metro Branch                                                        |
|  Address: 12 Ring Road, Lajpat Nagar, Delhi * GSTIN: 07BBAAP9911C1Z2                              |
|  Date: 2026-10-19 * Due Date: 2026-11-18 * Status: [ PENDING ]                                    |
+---------------------------------------------------------------------------------------------------+
|  #   Product Name        Batch      Exp      Qty   Rate     Disc%   Taxable     GST      Total    |
|  1   Augmentin 625 Duo   AUG-991    2028-04  10    210.00   5.0%    1,995.00    12%      2,234.40 |
|  2   Ascoril LS Syrup    ASC-410    2027-11   5    110.00   5.0%      522.50    12%        585.20 |
+---------------------------------------------------------------------------------------------------+
|  CGST (6%): Rs 151.05 | SGST (6%): Rs 151.05 | GRAND TOTAL: Rs 2,819.60                           |
|  Paid Amount: Rs 0.00 | OUTSTANDING BALANCE: Rs 2,819.60                                          |
+---------------------------------------------------------------------------------------------------+
|  PAYMENT ACTIONS                                                                                  |
|  [ + Record Payment Received ]   (Opens Payment Modal: Amount, Method, Reference #)               |
+---------------------------------------------------------------------------------------------------+
```

#### Invoice Actions & Modals

##### 1. Record Customer Payment Modal
- **Trigger:** Clicking `+ Record Payment Received`.
- **Form Inputs:**
  - `Payment Amount`: Defaults to remaining balance (`₹ 2,819.60`); allows partial amount (e.g., `₹ 1,000.00`).
  - `Payment Method`: Segmented selector (`UPI`, `Cash`, `Bank Transfer`, `Cheque`).
  - `Transaction / Cheque Reference`: E.g., `UPI/UTR/88129031`.
- **Execution:** Calls `POST /api/payments`. Updates invoice `paid_amount` and status (`partially_paid` or `Paid`). Posts credit entry to `customer_ledger`.

##### 2. Order Cancellation & Stock Reversal Modal
- **Trigger:** Clicking `Cancel Invoice` in header.
- **Confirmation Modal:** Displays a warning: *"Cancelling this invoice will immediately return 10 units of Augmentin 625 and 5 units of Ascoril LS back to inventory and post a credit note reversal of ₹ 2,819.60 to Apollo Pharmacy's account."*
- **Reason Field:** Mandatory input (e.g., `"Customer cancelled order prior to dispatch"`).
- **Execution:** Calls `POST /api/orders/:id/cancel`.
  - Batch stock is restored.
  - Audit transaction is written with `transaction_type = 'return'`.
  - Status updates to `Cancelled`.
  - Reversal is posted to customer ledger to eliminate stale receivables.

---

## 5. Customers & Ledger Directory (`/customers`)

> **Scenario:**  
> A new chemist shop, "Gupta Medicos", opens in the neighborhood. The proprietor visits Ramesh's office with their state drug license and GST certificate to open a wholesale purchasing account with 15 days credit.

```
+---------------------------------------------------------------------------------------------------+
|  CUSTOMERS (Pharmacies Directory)             [ Search store / contact / GSTIN ]   [ + Add Pharmacy ]|
+---------------------------------------------------------------------------------------------------+
|  Filter: [ All Pharmacies (24) ]    [ Outstanding Balance (8) ]    [ Overdue Accounts (3) ]       |
+---------------------------------------------------------------------------------------------------+
|  +---------------------------------------------------------------------------------------------+  |
|  | Apollo Pharmacy - Metro Branch                             Outstanding: Rs 14,200.00        |  |
|  | Contact: Dr. Sharma * Ph: 9811002233                       [ OVERDUE * 1 INVOICE ]          |  |
|  | Credit: Rs 14,200 / Rs 1,00,000 (14% utilized) [==------]  Term: 30 Days                    |  |
|  | Actions: [ Call: 9811002233 ]   [ New Order Shortcut ]     [ View Detailed Ledger > ]       |  |
|  +---------------------------------------------------------------------------------------------+  |
+---------------------------------------------------------------------------------------------------+
```

### 5.1 Customer Directory Screen (`CustomersScreen.tsx`)

#### Filter Chips
- **All Pharmacies:** Shows complete customer list.
- **Outstanding Balance:** Filters to accounts where `outstanding_balance > 0`.
- **Overdue Accounts:** Filters to accounts where at least one invoice is past its due date.

#### Quick Actions on Customer Card
- **Call Button:** Triggers native OS phone dialer (`tel:<phone>`).
- **New Order Shortcut:** Opens `CreateOrderScreen` with this customer pre-selected in the customer dropdown.
- **Card Body Press:** Navigates to `CustomerDetailScreen` showing historical orders, credit ledger, and payment receipts.

---

### 5.2 Add Pharmacy Form Walkthrough (`AddCustomerScreen.tsx`)

```
+---------------------------------------------------------------------------------------------------+
|  < Back   REGISTER NEW PHARMACY ACCOUNT                                                           |
+---------------------------------------------------------------------------------------------------+
|  BUSINESS IDENTIFICATION                                                                          |
|  Pharmacy / Store Name*: [ Gupta Medicos                               ]                          |
|  Contact Person Name:    [ Rakesh Gupta                                ]                          |
|  Phone Number*:          [ 9876543210        ]   Email: [ guptamedicos@gmail.com                ] |
+---------------------------------------------------------------------------------------------------+
|  REGULATORY COMPLIANCE                                                                            |
|  Drug License Number*:   [ DL-20B/21B-44109  ]   (Mandatory for pharma distribution)              |
|  GSTIN (15 Digits):      [ 07AAAPG1234D1Z9   ]                                                    |
+---------------------------------------------------------------------------------------------------+
|  ADDRESS DETAILS                                                                                  |
|  Billing / Shop Address: [ Shop 4, DDA Market, Rohini Sector 7, Delhi 110085                     ] |
+---------------------------------------------------------------------------------------------------+
|  CREDIT POLICY & TERMS                                                                            |
|  Credit Period (Days)*:  [ 15     ]  (Days before invoice becomes overdue)                       |
|  Credit Limit (Rs)*:     [ 50000  ]  (Maximum allowable outstanding debt)                        |
+---------------------------------------------------------------------------------------------------+
|                                      [ SAVE PHARMACY PROFILE ]                                    |
+---------------------------------------------------------------------------------------------------+
```

#### Field Validations & Rules
1. **Store Name:** Mandatory; validated against existing records to avoid accidental duplicate accounts.
2. **Phone Number:** Mandatory 10-digit numeric check.
3. **Drug License Number:** Strictly mandatory. Under Indian Drugs and Cosmetics Act regulations, a wholesale distributor cannot legally issue an invoice to an entity lacking a valid 20B/21B retail drug license.
4. **GSTIN:** Optional for unregistered micro-chemists, but validated for 15-character structure if provided.
5. **Credit Terms:** Sets invoice due date calculation (`Today + credit_period_days`).

#### Mutation & State Transition
- **API Call:** `POST /api/customers`
- **Cache Invalidation:** Calls `queryClient.invalidateQueries({ queryKey: ["/api/customers"] })`.
- **Immediate Availability:** The newly created customer is immediately available across order-entry selectors without requiring a browser page refresh.
- **Redirection:** Closes form and returns to `CustomersScreen`.

---

## 6. Product Catalog & Inventory Management (`/products`)

> **Scenario:**  
> Ramesh wants to review his stock of *Dharishah Ayurveda* herbal products. Alternatively, he has received a new product price list spreadsheet from a manufacturer and needs to bulk import 50 new SKU lines with initial batches into Med-Inventory.

```
+---------------------------------------------------------------------------------------------------+
|  PRODUCT CATALOG                                    [ Search medicine or SKU... ]   [ 📥 ]  [ + ] |
+---------------------------------------------------------------------------------------------------+
|  View Mode:  (o) All Products View       ( ) Company-First View                                   |
|  Manufacturer Filter: [ All Manufacturers (6)                                                   v ]|
|  Stock Status Filter: [ All ]   [ In Stock ]   [ Low Stock (14) ]   [ Near Expiry (8) ]   [ Expired ]|
+---------------------------------------------------------------------------------------------------+
|  +---------------------------------------------------------------------------------------------+  |
|  | Dharishah Kasni Cough Syrup 100ml                    SKU: DHR-KAS-100                        |  |
|  | Dharishah Ayurveda * Syrup                           Total Sellable: 45 units                |  |
|  | MRP: Rs 120.00 * Trade Price: Rs 90.00               [ IN STOCK ]                            |  |
|  | ------------------------------------------------------------------------------------------- |  |
|  | Physical Batches (Expandable breakdown):                                                    |  |
|  | - Lot: DHR-24A | Exp: 2027-08-31 | 30 units avail | Buy: Rs 70.00 | Sell: Rs 90.00 | Valid   |  |
|  | - Lot: DHR-23C | Exp: 2026-11-20 | 15 units avail | Buy: Rs 68.00 | Sell: Rs 90.00 | NearExp |  |
|  | [ + Adjust Stock ]   [ Edit Product ]   [ Delete Product ]                                  |  |
|  +---------------------------------------------------------------------------------------------+  |
+---------------------------------------------------------------------------------------------------+
```

### 6.1 Catalog Browsing & Filter State Machine (`ProductsScreen.tsx`)

#### 1. View Modes
- **All Products View:** Flat list of all products across all pharmaceutical companies, sorted alphabetically.
- **Company-First View:** Displays manufacturer cards (e.g., *Cipla*, *Sun Pharma*, *Dharishah Ayurveda*) showing total SKUs, total inventory units, and low-stock count. Clicking a company card filters the product list exclusively to that company's portfolio.

#### 2. Stock Filters
- **In Stock:** Products where total sellable, non-expired batch quantity is $> \text{minimum stock level}$.
- **Low Stock:** Products where sellable quantity is $> 0$ but $\le \text{minimum stock level}$.
- **Out of Stock:** Products with zero sellable stock.
- **Near Expiry:** Products having at least one batch expiring within 90 days.
- **Expired:** Products holding batches with `expiry_date <= today`. **Expired batches are strictly segregated and not counted in sellable stock tallies.**

#### 3. Expandable Batch Breakdown (`ProductListItem.tsx`)
Each product card features an expandable lot drawer. Clicking anywhere on the card toggles the visibility of every physical batch currently stored in the warehouse:
- `Batch Lot Number`
- `Expiry Date` (with color badge: Green for valid, Amber for $<90$d, Red for expired)
- `Current Physical Stock`
- `Purchase Price vs. Selling Price vs. MRP`

---

### 6.2 Catalog Bulk Import Walkthrough (`ImportCatalogueScreen.tsx`)

Clicking the import icon (`📥`) in the catalog header opens the two-phase bulk import screen:

```
+---------------------------------------------------------------------------------------------------+
|  < Back   IMPORT MEDICINE CATALOGUE                                                               |
+---------------------------------------------------------------------------------------------------+
|  STEP 1: DOWNLOAD OFFICIAL TEMPLATES                                                              |
|  Download standardized templates with pre-configured headers and instructions:                   |
|  [ 📄 Download CSV Template ]               [ 📊 Download Excel Template (.xlsx) ]                |
+---------------------------------------------------------------------------------------------------+
|  STEP 2: UPLOAD FILLED SPREADSHEET                                                                |
|  +---------------------------------------------------------------------------------------------+  |
|  |                           [ Upload Cloud Icon ]                                             |  |
|  |              Drag & Drop your .csv or .xlsx file here, or browse files                      |  |
|  |              Selected: Dharishah_Price_List_2026.xlsx (24.5 KB)                             |  |
|  +---------------------------------------------------------------------------------------------+  |
|  [ Analyze & Preview File ]                                                                       |
+---------------------------------------------------------------------------------------------------+
```

#### Step 1: Download Templates
- **CSV Template (`/api/upload/template/csv`):** Standard comma-separated header row.
- **Excel Template (`/api/upload/template/excel`):** Formatted multi-tab workbook:
  - *Sheet 1 ("Catalogue Template"):* Includes 15 standard headers: `Company`, `SKU`, `Product Name`, `Composition`, `Category`, `Form`, `Packaging`, `Batch`, `Expiry`, `MRP`, `Purchase Price`, `Sale Price`, `GST Rate`, `Quantity`, `Minimum Stock Threshold`.
  - *Sheet 2 ("Instructions"):* Explains mandatory vs. optional fields, date format conventions (`YYYY-MM-DD` or `MM/YYYY`), and clarifies the distinction between **Therapeutic Category** (e.g., Antibiotic, Analgesic) and **Dosage Form** (e.g., Tablet, Capsule, Syrup).

#### Step 2: File Upload & Structured Validation
When Ramesh uploads `Dharishah_Price_List_2026.xlsx` and clicks `Analyze & Preview File`:
1. The frontend streams the file to `POST /api/upload/preview`.
2. The server-side non-AI parser verifies every row against business invariants:
   - Validates company name (matches existing or marks as new company).
   - Verifies numeric formats for prices and quantities.
   - Parses expiry date and flags past dates.
   - Detects duplicate SKUs or batch numbers within the sheet.
3. The UI transitions to **Preview State**:

```
+---------------------------------------------------------------------------------------------------+
|  IMPORT PREVIEW & AUDIT                                                                           |
|  Total Rows: 25   |   [ Valid: 24 ]   |   [ Errors: 1 ]   |   [ Warnings: 2 ]                     |
|  Filter Rows:  (o) All Rows (25)     ( ) Errors Only (1)     ( ) Valid Only (24)                  |
|  Import Mode:  [X] Atomic Commit (All-or-Nothing)  --  Reject entire file if any error exists     |
+---------------------------------------------------------------------------------------------------+
|  Row  Status   Product Name             Batch     Expiry     Qty   Price    Issues Detected       |
|  1    [ OK ]   Kasni Cough Syrup 100ml  DHR-101   2028-02    50    70.00    None (Valid)          |
|  2    [ OK ]   Chyawanprash Special     DHR-902   2027-09    20   220.00    None (Valid)          |
|  3    [ERR!]   Ashwagandha Tablets      ASH-01    2022-01    10   110.00    BATCH EXPIRED IN 2022 |
+---------------------------------------------------------------------------------------------------+
|  [ Cancel & Re-upload ]                                 [ COMMIT 24 VALID ITEMS TO INVENTORY ]    |
+---------------------------------------------------------------------------------------------------+
```

#### Step 3: Atomic Safety Toggle & Commit
- **Atomic Safety:** When checked (default), if even a single row has an error (such as Row 3 having an expired date), the commit button is disabled until the user either fixes the sheet or toggles off atomic mode to import only valid rows.
- **Commit Execution:** Clicking `COMMIT` calls `POST /api/upload/commit`.
  - Inserts missing companies.
  - Inserts or updates master product records.
  - Creates physical batch rows.
  - Increments stock.
  - Logs `opening_stock` transactions in the inventory audit ledger.
- **Success State:** Displays an import summary receipt: `"Successfully committed 24 products and 24 batches across 1 company."`

---

## 7. Financial & Operational Reports (`/reports`)

> **Scenario:**  
> Every Saturday afternoon, Ramesh conducts a financial and inventory audit. He must identify which retail pharmacies are delaying payments, determine which drug companies generated the highest gross margins, and pinpoint slow-moving inventory.

```
+---------------------------------------------------------------------------------------------------+
|  FINANCIAL & OPERATIONAL REPORTS                                                                  |
+---------------------------------------------------------------------------------------------------+
|  [ Clock: Receivables Aging ]  [ Briefcase: Sales by Brand ]  [ Activity: Stock Movement ]        |
+---------------------------------------------------------------------------------------------------+
```

### 7.1 Report Tabs & Analytical Workflows

#### Tab 1: Receivables Aging Report (`activeTab === 'aging'`)

```
+---------------------------------------------------------------------------------------------------+
|  TOTAL OUTSTANDING MARKET RECEIVABLES: Rs 4,82,350.00  (Across 18 Active Pharmacies)              |
+---------------------------------------------------------------------------------------------------+
|  AGING BUCKETS (Based strictly on Days Overdue past credit period):                               |
|  [ Current (Within Terms) ]   Rs 2,40,000.00   (50% of market debt)                               |
|  [ 1 - 14 Days Overdue    ]   Rs 1,10,000.00   (Mild delay - reminder calls needed)               |
|  [ 15 - 30 Days Overdue   ]   Rs  82,350.00   (Moderate delay - pause additional credit dispatch) |
|  [ 31 - 60 Days Overdue   ]   Rs  35,000.00   (High risk - field agent collection visit)          |
|  [ 61+ Days Overdue       ]   Rs  15,000.00   (Severe delinquency - legal notice / stop supply)   |
+---------------------------------------------------------------------------------------------------+
|  DEBTOR PHARMACY DRILLDOWN                                                                        |
|  - Apollo Pharmacy Metro: Rs 14,200.00 Total Due | [ 1-14d Overdue: Rs 14,200.00 ]                |
|  - Verma Medical Store:   Rs 32,500.00 Total Due | [ 31-60d Overdue: Rs 20,000.00 ]               |
+---------------------------------------------------------------------------------------------------+
```

- **Exact Boundary Logic:**
  $$\text{Days Overdue} = \text{Current Date} - \text{Invoice Due Date}$$
  - $\text{Days Overdue} \le 0 \implies \text{Current (Not Yet Due)}$
  - $1 \le \text{Days Overdue} \le 14 \implies \text{1--14 Days Bucket}$
  - $15 \le \text{Days Overdue} \le 30 \implies \text{15--30 Days Bucket}$
  - $31 \le \text{Days Overdue} \le 60 \implies \text{31--60 Days Bucket}$
  - $\text{Days Overdue} \ge 61 \implies \text{61+ Days Bucket}$
- **Reconciliation Invariant:** The sum of all five buckets equals the total outstanding receivables shown on the main dashboard.

#### Tab 2: Sales by Manufacturer Report (`activeTab === 'sales'`)
- **Metric Breakdown:** Groups sales orders by product manufacturer over the selected date range.
- **Columns Rendered:**
  - `Manufacturer / Brand Name` (e.g., *GlaxoSmithKline*, *Cipla Ltd*, *Dharishah Ayurveda*)
  - `Units Sold` (Total physical packs dispatched)
  - `Gross Sales Revenue` ($\sum \text{quantity} \times \text{unit price}$)
  - `Total Trade Discounts Given`
  - `Cost of Goods Sold (COGS)` (Calculated from historical batch purchase cost)
  - `Gross Profit Margin (₹ and %)` ($\text{Revenue} - \text{COGS}$)
- **Operational Purpose:** Allows the distributor to renegotiate distribution commission margins with manufacturers based on verified sales volume.

#### Tab 3: Stock Movement & Expiry Velocity Report (`activeTab === 'movement'`)
- **Stock Receipts:** Total units ingested via purchase invoices and opening stock imports.
- **Stock Dispatches:** Total units deducted through customer sales orders.
- **Returns & Adjustments:** Units restored via cancelled orders or written off due to expiry damage.
- **Fast vs. Slow Moving Classification:** Highlights products with zero turnover over the last 60 days to prevent capital stagnation.

---

## 8. State Machine & Transition Matrix

The table below documents every primary state transition in the Med-Inventory client:

| Screen / Component | User Action / Trigger | Visual State Change | Network / API Call | Cache Invalidation Keys | Final Destination |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Dashboard** | Click `Low Stock Card` | Highlight card border | None | None | `LowStockScreen` |
| **Dashboard** | Click `Expiring Soon Card` | Highlight card border | None | None | `ExpiringSoonScreen` |
| **Dashboard** | Click `Receivables Card` | Active tab changes | None | None | `ReportsTab (Receivables)` |
| **Purchases** | Click `+ Inbound Invoice` | Push navigation | None | None | `CreatePurchaseScreen` |
| **CreatePurchase** | Tap `+ Add Medicine Lot` | Modal slides up | None | None | Item modal open |
| **CreatePurchase** | Tap `Confirm Inbound Stock` | Button shows spinner | `POST /api/purchases` | `/api/purchases`, `/api/products`, `/api/batches`, `/api/dashboard/stats` | `PurchasesScreen` |
| **CreateOrder** | Select Product in Dropdown | Pre-fills price & batch | None | None | Active form with FEFO batch |
| **CreateOrder** | Tap `Generate Tax Invoice` | Button shows spinner | `POST /api/orders` | `/api/orders`, `/api/products`, `/api/batches`, `/api/customers`, `/api/dashboard/stats` | `OrderDetailScreen` |
| **OrderDetail** | Tap `Cancel Invoice` | Confirmation modal | `POST /api/orders/:id/cancel` | `/api/orders/:id`, `/api/orders`, `/api/products`, `/api/batches`, `/api/customers` | Invoice updated with `Cancelled` badge |
| **OrderDetail** | Tap `Record Payment` | Payment modal opens | `POST /api/payments` | `/api/orders/:id`, `/api/orders`, `/api/customers`, `/api/dashboard/stats` | Balance decrements; status updates |
| **AddCustomer** | Tap `Save Pharmacy` | Button shows spinner | `POST /api/customers` | `/api/customers` | `CustomersScreen` |
| **Products** | Toggle Company Chip | Active chip switches | None (client memo filter) | None | Filtered product catalog |
| **ImportCatalogue**| Upload Spreadsheet | File dropzone turns green | `POST /api/upload/preview` | None | Staged Preview Table |
| **ImportCatalogue**| Tap `Commit Valid Items` | Progress indicator | `POST /api/upload/commit` | `/api/products`, `/api/dashboard/stats`, `/api/companies` | Success Summary Receipt |

---

## 9. Conclusion & Architect's Sign-Off

The Med-Inventory frontend represents a hardened, domain-accurate pharmaceutical distribution interface. By enforcing FEFO lot selection, separating supplier purchasing liabilities from customer receivables, guaranteeing atomic catalog imports, and standardizing overdue aging buckets, this design provides the distributor with an intuitive, reliable tool for daily commercial operations.

Future modules—including automated voice-order processing and external GST portal integrations—can seamlessly attach to this foundation by calling the exact same validated endpoints and state machines documented in this specification.

*Lead Product Designer & System Architect, Med-Inventory*  
*October 2026*
