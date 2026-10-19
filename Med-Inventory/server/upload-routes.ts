import type { Express, Request, Response } from "express";
import multer, { type FileFilterCallback } from "multer";
import * as XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";
import {
  extractMedicinesFromText,
  type ExtractedMedicine,
} from "./groq-client";
import db from "./db";
import type {
  ProductWithCompany,
  CatalogImportRow,
  CatalogImportPreviewResult,
  CatalogImportCommitInput,
} from "@shared/types";

const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
  fileFilter: (
    _req: Request,
    file: Express.Multer.File,
    cb: FileFilterCallback,
  ) => {
    const allowedTypes = [
      "application/pdf",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/csv",
    ];
    const allowedExtensions = [".pdf", ".xlsx", ".xls", ".csv"];
    const ext = path.extname(file.originalname).toLowerCase();

    if (
      allowedTypes.includes(file.mimetype) ||
      allowedExtensions.includes(ext)
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF, Excel (.xlsx, .xls), and CSV files are allowed"));
    }
  },
});

export function parseDateString(val: any): string | null {
  if (val === undefined || val === null || val === "") return null;
  if (typeof val === "number") {
    try {
      const parsed = XLSX.SSF.parse_date_code(val);
      if (parsed) {
        const y = String(parsed.y).padStart(4, "0");
        const m = String(parsed.m).padStart(2, "0");
        const d = String(parsed.d).padStart(2, "0");
        return `${y}-${m}-${d}`;
      }
    } catch {}
  }
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
    const parts = str.split("/");
    const d = parts[0].padStart(2, "0");
    const m = parts[1].padStart(2, "0");
    const y = parts[2];
    return `${y}-${m}-${d}`;
  }
  if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(str)) {
    const parts = str.split("-");
    const d = parts[0].padStart(2, "0");
    const m = parts[1].padStart(2, "0");
    const y = parts[2];
    return `${y}-${m}-${d}`;
  }
  if (/^\d{1,2}\/\d{4}$/.test(str)) {
    const parts = str.split("/");
    const m = parts[0].padStart(2, "0");
    const y = parts[1];
    return `${y}-${m}-28`;
  }
  const dt = new Date(str);
  if (!isNaN(dt.getTime())) {
    return dt.toISOString().split("T")[0];
  }
  return null;
}

function normalizeHeader(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function extractTextFromPDF(filePath: string): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const dataBuffer = fs.readFileSync(filePath);
  const parser = new PDFParse({ data: dataBuffer });
  const result = await parser.getText();
  await parser.destroy();
  return result.text;
}

export function registerUploadRoutes(app: Express) {
  if (!fs.existsSync("uploads")) {
    fs.mkdirSync("uploads", { recursive: true });
  }

  // 1. Downloadable CSV Template
  app.get("/api/upload/template/csv", (_req: Request, res: Response) => {
    const headers = [
      "Company",
      "SKU",
      "Product Name",
      "Composition",
      "Category",
      "Form",
      "Packaging",
      "Batch",
      "Expiry",
      "MRP",
      "Purchase Price",
      "Sale Price",
      "GST Rate",
      "Quantity",
      "Minimum Stock Threshold",
    ];

    const sampleRows = [
      [
        "Sun Pharma",
        "SUN-PAN40",
        "Pantocid 40mg",
        "Pantoprazole 40mg",
        "Gastrointestinal",
        "Tablet",
        "10 Tablets/Strip",
        "PANT-2026A",
        "2027-12-31",
        "165.00",
        "110.00",
        "145.00",
        "12",
        "100",
        "20",
      ],
      [
        "Cipla",
        "CIP-AZI500",
        "Azee 500mg",
        "Azithromycin 500mg",
        "Antibiotics",
        "Tablet",
        "5 Tablets/Strip",
        "AZEE-891",
        "2027-06-30",
        "120.00",
        "82.00",
        "105.00",
        "12",
        "50",
        "15",
      ],
    ];

    const csvContent =
      headers.join(",") +
      "\n" +
      sampleRows
        .map((row) => row.map((cell) => `"${cell}"`).join(","))
        .join("\n") +
      "\n";

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="medidist_catalog_template.csv"',
    );
    res.send(csvContent);
  });

  // 2. Downloadable Excel (.xlsx) Template with Instructions Sheet
  app.get("/api/upload/template/excel", (_req: Request, res: Response) => {
    const wb = XLSX.utils.book_new();

    const templateData = [
      [
        "Company",
        "SKU",
        "Product Name",
        "Composition",
        "Category",
        "Form",
        "Packaging",
        "Batch",
        "Expiry",
        "MRP",
        "Purchase Price",
        "Sale Price",
        "GST Rate",
        "Quantity",
        "Minimum Stock Threshold",
      ],
      [
        "Sun Pharma",
        "SUN-PAN40",
        "Pantocid 40mg",
        "Pantoprazole 40mg",
        "Gastrointestinal",
        "Tablet",
        "10 Tablets/Strip",
        "PANT-2026A",
        "2027-12-31",
        165.0,
        110.0,
        145.0,
        12,
        100,
        20,
      ],
      [
        "Cipla",
        "CIP-AZI500",
        "Azee 500mg",
        "Azithromycin 500mg",
        "Antibiotics",
        "Tablet",
        "5 Tablets/Strip",
        "AZEE-891",
        "2027-06-30",
        120.0,
        82.0,
        105.0,
        12,
        50,
        15,
      ],
    ];

    const wsTemplate = XLSX.utils.aoa_to_sheet(templateData);
    XLSX.utils.book_append_sheet(wb, wsTemplate, "Catalog Template");

    const instructionsData = [
      ["MediDist Product Catalog Import - Guidelines & Field Specifications"],
      [""],
      ["Field Name", "Required", "Description", "Example"],
      [
        "Company",
        "Yes",
        "Manufacturer / Brand name. Auto-created if new.",
        "Sun Pharma",
      ],
      [
        "SKU",
        "No",
        "Stock Keeping Unit code. If empty, auto-generated.",
        "SUN-PAN40",
      ],
      [
        "Product Name",
        "Yes",
        "Brand or Trade name of the medicine.",
        "Pantocid 40mg",
      ],
      [
        "Composition",
        "No",
        "Active pharmaceutical ingredients / generic salts.",
        "Pantoprazole 40mg",
      ],
      [
        "Category",
        "No",
        "Therapeutic classification (e.g. Antibiotics, Gastrointestinal).",
        "Gastrointestinal",
      ],
      [
        "Form",
        "No",
        "Physical dosage form (Tablet, Capsule, Syrup, Ointment, etc.).",
        "Tablet",
      ],
      [
        "Packaging",
        "No",
        "Pack style and unit description.",
        "10 Tablets/Strip",
      ],
      [
        "Batch",
        "Conditional",
        "Physical lot/batch number. Required if Quantity > 0.",
        "PANT-2026A",
      ],
      [
        "Expiry",
        "Conditional",
        "Expiry date in YYYY-MM-DD or DD/MM/YYYY format. Required if Batch provided.",
        "2027-12-31",
      ],
      ["MRP", "Yes", "Maximum Retail Price per unit (numeric > 0).", 165.0],
      [
        "Purchase Price",
        "Yes",
        "Procurement / cost price per unit (numeric >= 0).",
        110.0,
      ],
      [
        "Sale Price",
        "No",
        "Distributor selling price to retailers. Defaults to MRP if omitted.",
        145.0,
      ],
      [
        "GST Rate",
        "No",
        "Applicable GST percentage (e.g. 0, 5, 12, 18). Default 12.",
        12,
      ],
      [
        "Quantity",
        "No",
        "Initial opening lot quantity received (default 0).",
        100,
      ],
      [
        "Minimum Stock Threshold",
        "No",
        "Alert threshold for low stock indicator (default 10).",
        20,
      ],
      [""],
      ["Note on Category vs Form:"],
      [
        "Category represents therapeutic action (e.g., Antibiotic, Analgesic, Ayurvedic), while Form represents the physical presentation (e.g., Tablet, Capsule, Syrup).",
      ],
    ];

    const wsInstructions = XLSX.utils.aoa_to_sheet(instructionsData);
    XLSX.utils.book_append_sheet(wb, wsInstructions, "Instructions");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="medidist_catalog_template.xlsx"',
    );
    res.send(buffer);
  });

  // 3. Staged Import: Preview and Validate Spreadsheet
  app.post(
    "/api/upload/preview",
    upload.single("file"),
    async (req: Request & { file?: Express.Multer.File }, res: Response) => {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      try {
        const ext = path.extname(file.originalname).toLowerCase();
        if (![".xlsx", ".xls", ".csv"].includes(ext)) {
          if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
          return res.status(400).json({
            error:
              "Structured preview supports Excel (.xlsx, .xls) and CSV files. Use AI scan for PDFs.",
          });
        }

        const workbook = XLSX.readFile(file.path, { cellDates: true });
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
          return res
            .status(400)
            .json({ error: "The uploaded file contains no sheets." });
        }

        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          defval: "",
        }) as any[][];

        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);

        if (!rawRows || rawRows.length < 2) {
          return res.status(400).json({
            error:
              "The uploaded file is empty or does not contain data rows below the header.",
          });
        }

        // Header mapping
        const headerRow = rawRows[0].map((h) =>
          normalizeHeader(String(h || "")),
        );
        const findColumnIndex = (...candidates: string[]) => {
          for (const cand of candidates) {
            const idx = headerRow.findIndex(
              (h) => h === cand || h.includes(cand),
            );
            if (idx !== -1) return idx;
          }
          return -1;
        };

        const colCompany = findColumnIndex(
          "company",
          "manufacturer",
          "brand",
          "mfg",
        );
        const colSku = findColumnIndex("sku", "itemcode", "code");
        const colProductName = findColumnIndex(
          "productname",
          "product",
          "itemname",
          "medicine",
        );
        const colComposition = findColumnIndex(
          "composition",
          "generic",
          "salt",
          "formula",
        );
        const colCategory = findColumnIndex("category", "therapeutic");
        const colForm = findColumnIndex("form", "dosageform", "type");
        const colPackaging = findColumnIndex("packaging", "pack", "packsize");
        const colBatch = findColumnIndex("batch", "batchnumber", "lot");
        const colExpiry = findColumnIndex(
          "expiry",
          "expdate",
          "expirydate",
          "exp",
        );
        const colMrp = findColumnIndex("mrp", "maxretailprice", "retailprice");
        const colPurchasePrice = findColumnIndex(
          "purchaseprice",
          "costprice",
          "cost",
          "buyprice",
          "rate",
        );
        const colSalePrice = findColumnIndex(
          "saleprice",
          "sellingprice",
          "selling",
          "distributorprice",
        );
        const colGstRate = findColumnIndex("gstrate", "gst", "taxrate", "tax");
        const colQuantity = findColumnIndex("quantity", "qty", "stock");
        const colMinStock = findColumnIndex(
          "minimumstockthreshold",
          "minimumstocklevel",
          "minstock",
          "minthreshold",
          "reorderlevel",
        );

        if (colProductName === -1 || colCompany === -1) {
          return res.status(400).json({
            error:
              "Mandatory columns 'Company' and 'Product Name' were not detected. Please use the downloadable template.",
          });
        }

        // Preload existing companies and products to identify duplicates / action
        const existingCompanies = db
          .prepare("SELECT id, name FROM companies")
          .all() as { id: number; name: string }[];
        const existingProducts = db
          .prepare("SELECT id, company_id, sku, product_name FROM products")
          .all() as {
          id: number;
          company_id: number;
          sku: string | null;
          product_name: string;
        }[];

        const todayStr = new Date().toISOString().split("T")[0];
        const rows: CatalogImportRow[] = [];
        let validRowsCount = 0;
        let errorRowsCount = 0;
        let warningCount = 0;

        const seenSkusInFile = new Set<string>();
        const seenBatchesInFile = new Set<string>();

        for (let i = 1; i < rawRows.length; i++) {
          const raw = rawRows[i];
          if (
            !raw ||
            raw.every(
              (cell) => cell === "" || cell === null || cell === undefined,
            )
          ) {
            continue; // Skip entirely blank row
          }

          const rowErrors: string[] = [];
          const rowWarnings: string[] = [];

          const companyName = String(raw[colCompany] || "").trim();
          const productName = String(raw[colProductName] || "").trim();
          const sku =
            colSku !== -1 ? String(raw[colSku] || "").trim() : undefined;
          const composition =
            colComposition !== -1
              ? String(raw[colComposition] || "").trim()
              : undefined;
          const category =
            colCategory !== -1
              ? String(raw[colCategory] || "").trim()
              : undefined;
          const form =
            colForm !== -1 ? String(raw[colForm] || "").trim() : undefined;
          const packaging =
            colPackaging !== -1
              ? String(raw[colPackaging] || "").trim()
              : undefined;
          const rawBatch =
            colBatch !== -1 ? String(raw[colBatch] || "").trim() : undefined;
          const rawExpiry = colExpiry !== -1 ? raw[colExpiry] : undefined;
          const parsedExpiry = parseDateString(rawExpiry);

          const mrp = colMrp !== -1 ? Number(raw[colMrp]) : NaN;
          const purchasePrice =
            colPurchasePrice !== -1 ? Number(raw[colPurchasePrice]) : NaN;
          const rawSalePrice =
            colSalePrice !== -1 && raw[colSalePrice] !== ""
              ? Number(raw[colSalePrice])
              : undefined;
          const gstRate =
            colGstRate !== -1 && raw[colGstRate] !== ""
              ? Number(raw[colGstRate])
              : 12;
          const quantity =
            colQuantity !== -1 && raw[colQuantity] !== ""
              ? Number(raw[colQuantity])
              : 0;
          const minStock =
            colMinStock !== -1 && raw[colMinStock] !== ""
              ? Number(raw[colMinStock])
              : 10;

          // 1. Mandatory Product Fields
          if (!companyName) {
            rowErrors.push("Company / Manufacturer name is required.");
          }
          if (!productName) {
            rowErrors.push("Product Name is required.");
          }
          if (isNaN(mrp) || mrp <= 0) {
            rowErrors.push("Valid positive MRP is required.");
          }
          if (isNaN(purchasePrice) || purchasePrice < 0) {
            rowErrors.push("Valid non-negative Purchase Price is required.");
          }

          // 2. Quantity & Batch validation
          if (quantity < 0) {
            rowErrors.push("Quantity cannot be negative.");
          }
          if (quantity > 0 && !rawBatch) {
            rowErrors.push("Batch number is required when quantity > 0.");
          }
          if (rawBatch && !parsedExpiry) {
            rowErrors.push(
              "Valid Expiry Date (YYYY-MM-DD) is required for lot.",
            );
          } else if (parsedExpiry && parsedExpiry < todayStr) {
            rowWarnings.push(
              `Batch ${rawBatch} is already expired (${parsedExpiry}).`,
            );
          }

          // 3. Price warnings
          const salePrice =
            rawSalePrice !== undefined && !isNaN(rawSalePrice)
              ? rawSalePrice
              : mrp;
          if (salePrice < purchasePrice) {
            rowWarnings.push(
              `Sale price (₹${salePrice}) is below purchase price (₹${purchasePrice}).`,
            );
          }

          // 4. Duplicate SKU in sheet
          if (sku) {
            if (seenSkusInFile.has(sku.toLowerCase())) {
              rowErrors.push(
                `Duplicate SKU '${sku}' found within this spreadsheet.`,
              );
            } else {
              seenSkusInFile.add(sku.toLowerCase());
            }
          }

          // 5. Duplicate Batch in sheet
          if (rawBatch && productName) {
            const batchKey = `${productName.toLowerCase()}::${rawBatch.toLowerCase()}`;
            if (seenBatchesInFile.has(batchKey)) {
              rowWarnings.push(
                `Batch '${rawBatch}' for '${productName}' appears multiple times in file. Quantities will be aggregated.`,
              );
            } else {
              seenBatchesInFile.add(batchKey);
            }
          }

          // 6. DB matching
          const matchedCompany = existingCompanies.find(
            (c) => c.name.toLowerCase() === companyName.toLowerCase(),
          );
          const companyStatus = matchedCompany ? "existing" : "new";
          const companyId = matchedCompany ? matchedCompany.id : undefined;

          let productAction: "new_product" | "add_batch" = "new_product";
          let productId: number | undefined;

          if (matchedCompany) {
            const matchedProduct = existingProducts.find((p) => {
              if (sku && p.sku && p.sku.toLowerCase() === sku.toLowerCase())
                return true;
              return (
                p.company_id === matchedCompany.id &&
                p.product_name.toLowerCase() === productName.toLowerCase()
              );
            });

            if (matchedProduct) {
              productAction = "add_batch";
              productId = matchedProduct.id;
            }
          }

          const isValid = rowErrors.length === 0;
          if (isValid) {
            validRowsCount++;
          } else {
            errorRowsCount++;
          }
          warningCount += rowWarnings.length;

          rows.push({
            rowNumber: i + 1,
            company: companyName,
            companyStatus,
            companyId,
            product_name: productName,
            productAction,
            productId,
            sku: sku || undefined,
            composition: composition || undefined,
            category: category || undefined,
            form: form || undefined,
            packaging: packaging || undefined,
            batch_number: rawBatch || undefined,
            expiry_date: parsedExpiry || undefined,
            mrp: isNaN(mrp) ? 0 : mrp,
            purchase_price: isNaN(purchasePrice) ? 0 : purchasePrice,
            sale_price: salePrice,
            gst_rate: isNaN(gstRate) ? 12 : gstRate,
            quantity: isNaN(quantity) ? 0 : quantity,
            minimum_stock_level: isNaN(minStock) ? 10 : minStock,
            errors: rowErrors,
            warnings: rowWarnings,
            isValid,
          });
        }

        const previewResult: CatalogImportPreviewResult = {
          success: true,
          filename: file.originalname,
          totalRows: rows.length,
          validRowsCount,
          errorRowsCount,
          warningCount,
          canCommit: validRowsCount > 0,
          rows,
        };

        return res.json(previewResult);
      } catch (error: any) {
        if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
        console.error("Error previewing catalog file:", error);
        return res
          .status(500)
          .json({ error: error.message || "Failed to parse spreadsheet file" });
      }
    },
  );

  // 4. Staged Import: Atomic Commit Validated Rows
  app.post("/api/upload/commit", (req: Request, res: Response) => {
    try {
      const { rows, atomic = true } = req.body as CatalogImportCommitInput;

      if (!rows || !Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ error: "No rows provided for import" });
      }

      // If atomic mode is requested and any row has errors, reject entirely
      if (atomic) {
        const invalidRows = rows.filter(
          (r) => !r.isValid || r.errors.length > 0,
        );
        if (invalidRows.length > 0) {
          return res.status(400).json({
            error: `Atomic import rejected: ${invalidRows.length} rows contain validation errors. Fix errors or disable atomic mode.`,
            invalidRows,
          });
        }
      }

      const rowsToImport = atomic
        ? rows
        : rows.filter((r) => r.isValid && r.errors.length === 0);
      if (rowsToImport.length === 0) {
        return res
          .status(400)
          .json({ error: "No valid rows available to import." });
      }

      let createdCompaniesCount = 0;
      let importedProductsCount = 0;
      let importedBatchesCount = 0;

      const commitTransaction = db.transaction(() => {
        const companyCache = new Map<string, number>();

        // Preload company cache
        const allCompanies = db
          .prepare("SELECT id, name FROM companies")
          .all() as { id: number; name: string }[];
        for (const c of allCompanies) {
          companyCache.set(c.name.toLowerCase(), c.id);
        }

        for (const row of rowsToImport) {
          const compNameLower = row.company.toLowerCase();
          let companyId = companyCache.get(compNameLower);

          if (!companyId) {
            const insertComp = db
              .prepare("INSERT INTO companies (name) VALUES (?)")
              .run(row.company.trim());
            companyId = Number(insertComp.lastInsertRowid);
            companyCache.set(compNameLower, companyId);
            createdCompaniesCount++;
          }

          // Find or create product
          let productId = row.productId;
          if (!productId) {
            const matchQuery = row.sku
              ? "SELECT id FROM products WHERE sku = ? OR (company_id = ? AND LOWER(product_name) = LOWER(?))"
              : "SELECT id FROM products WHERE company_id = ? AND LOWER(product_name) = LOWER(?)";

            const existingProduct = (
              row.sku
                ? db
                    .prepare(matchQuery)
                    .get(row.sku, companyId, row.product_name)
                : db.prepare(matchQuery).get(companyId, row.product_name)
            ) as { id: number } | undefined;

            if (existingProduct) {
              productId = existingProduct.id;
            } else {
              const defaultBatch = row.batch_number || `BATCH-${Date.now()}`;
              const defaultExp = row.expiry_date || "2027-12-31";

              const insertProd = db
                .prepare(
                  `
                INSERT INTO products (
                  company_id, sku, product_name, composition, category, form, packaging,
                  uom, gst_rate, batch_number, expiry_date, mrp, purchase_price,
                  stock_quantity, minimum_stock_level, is_active
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Units', ?, ?, ?, ?, ?, 0, ?, 1)
              `,
                )
                .run(
                  companyId,
                  row.sku || null,
                  row.product_name.trim(),
                  row.composition || null,
                  row.category || null,
                  row.form || null,
                  row.packaging || null,
                  row.gst_rate || 12,
                  defaultBatch,
                  defaultExp,
                  row.mrp,
                  row.purchase_price,
                  row.minimum_stock_level || 10,
                );

              productId = Number(insertProd.lastInsertRowid);
              importedProductsCount++;
            }
          }

          // Create/update batch if batch details or quantity > 0 provided
          if (row.batch_number && row.expiry_date) {
            const existingBatch = db
              .prepare(
                "SELECT id, current_quantity FROM product_batches WHERE product_id = ? AND batch_number = ?",
              )
              .get(productId, row.batch_number) as
              | { id: number; current_quantity: number }
              | undefined;

            const qty = row.quantity && row.quantity > 0 ? row.quantity : 0;
            let batchId: number;

            if (existingBatch) {
              batchId = existingBatch.id;
              if (qty > 0) {
                db.prepare(
                  `UPDATE product_batches 
                   SET current_quantity = current_quantity + ?, updated_at = datetime('now')
                   WHERE id = ?`,
                ).run(qty, batchId);
              }
            } else {
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
                  productId,
                  row.batch_number,
                  row.expiry_date,
                  row.mrp,
                  row.purchase_price,
                  row.sale_price || row.mrp,
                  qty,
                  qty,
                );
              batchId = Number(insertBatch.lastInsertRowid);
              importedBatchesCount++;
            }

            if (qty > 0) {
              db.prepare(
                `
                INSERT INTO inventory_transactions (
                  product_id, batch_id, transaction_type, quantity, notes
                ) VALUES (?, ?, 'in', ?, ?)
              `,
              ).run(
                productId,
                batchId,
                qty,
                `Catalog opening stock: Lot ${row.batch_number}`,
              );
            }

            // Sync aggregate products table
            db.prepare(
              `
              UPDATE products 
              SET stock_quantity = (SELECT COALESCE(SUM(current_quantity), 0) FROM product_batches WHERE product_id = ?),
                  batch_number = ?,
                  expiry_date = ?,
                  updated_at = datetime('now')
              WHERE id = ?
            `,
            ).run(productId, row.batch_number, row.expiry_date, productId);
          }
        }
      });

      commitTransaction();

      return res.json({
        success: true,
        committedRowsCount: rowsToImport.length,
        createdCompaniesCount,
        importedProductsCount,
        importedBatchesCount,
      });
    } catch (error: any) {
      console.error("Error committing catalog import:", error);
      return res
        .status(500)
        .json({ error: error.message || "Failed to commit catalog import" });
    }
  });

  // 5. Groq AI Extractor (Kept and fully integrated with product_batches)
  app.post(
    "/api/upload/extract",
    upload.single("file"),
    async (req: Request & { file?: Express.Multer.File }, res: Response) => {
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      if (!process.env.GROQ_API_KEY) {
        fs.unlinkSync(file.path);
        return res.status(500).json({
          error:
            "Groq API key not configured. For standard CSV/Excel files, please use the Structured Import tab instead.",
        });
      }

      try {
        let text: string;
        const ext = path.extname(file.originalname).toLowerCase();

        if (ext === ".pdf") {
          text = await extractTextFromPDF(file.path);
        } else if ([".xlsx", ".xls", ".csv"].includes(ext)) {
          const workbook = XLSX.readFile(file.path);
          text = "";
          for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(sheet, {
              header: 1,
            }) as string[][];
            for (const row of jsonData) {
              if (row && row.length > 0) {
                text += row.join(" | ") + "\n";
              }
            }
            text += "\n";
          }
        } else {
          fs.unlinkSync(file.path);
          return res.status(400).json({ error: "Unsupported file type" });
        }

        if (!text || text.trim().length < 10) {
          fs.unlinkSync(file.path);
          return res.status(400).json({
            error: "Could not extract text from file or file is empty",
          });
        }

        const medicines = await extractMedicinesFromText(text);
        fs.unlinkSync(file.path);

        res.json({
          success: true,
          extractedCount: medicines.length,
          medicines,
        });
      } catch (error) {
        if (file && fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
        console.error("Error processing file with AI:", error);
        res.status(500).json({ error: "Failed to process file with AI" });
      }
    },
  );

  // 6. Legacy / AI Extractor Commit (Upgraded to atomically insert into product_batches)
  app.post("/api/upload/import", async (req: Request, res: Response) => {
    try {
      const { medicines, companyId } = req.body as {
        medicines: ExtractedMedicine[];
        companyId: number;
      };

      if (!medicines || !Array.isArray(medicines) || medicines.length === 0) {
        return res.status(400).json({ error: "No medicines to import" });
      }

      if (!companyId) {
        return res.status(400).json({ error: "Company ID is required" });
      }

      const company = db
        .prepare("SELECT id FROM companies WHERE id = ?")
        .get(companyId);

      if (!company) {
        return res
          .status(400)
          .json({ error: "Selected company does not exist" });
      }

      const imported: ProductWithCompany[] = [];
      const errors: string[] = [];

      const today = new Date();
      const defaultExpiry = new Date(today);
      defaultExpiry.setFullYear(defaultExpiry.getFullYear() + 2);
      const defaultExpiryStr = defaultExpiry.toISOString().split("T")[0];

      const commitImport = db.transaction(() => {
        for (const medicine of medicines) {
          try {
            if (!medicine.product_name || medicine.product_name.trim() === "") {
              errors.push("Skipped: Medicine without name");
              continue;
            }

            const batchNumber = medicine.batch_number || `BATCH-${Date.now()}`;
            const expiryDate = medicine.expiry_date || defaultExpiryStr;
            const mrp = medicine.mrp || 0;
            const purchasePrice = medicine.purchase_price || 0;
            const qty = medicine.stock_quantity || 0;

            const result = db
              .prepare(
                `
              INSERT INTO products (
                company_id, product_name, composition, batch_number, 
                expiry_date, mrp, purchase_price, stock_quantity, minimum_stock_level, is_active
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
            `,
              )
              .run(
                companyId,
                medicine.product_name.trim(),
                medicine.composition || null,
                batchNumber,
                expiryDate,
                mrp,
                purchasePrice,
                qty,
                medicine.minimum_stock_level || 10,
              );

            const productId = Number(result.lastInsertRowid);

            // Insert lot into product_batches
            const batchResult = db
              .prepare(
                `
              INSERT INTO product_batches (
                product_id, batch_number, expiry_date, mrp, purchase_price, selling_price,
                initial_quantity, current_quantity, is_active
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
            `,
              )
              .run(
                productId,
                batchNumber,
                expiryDate,
                mrp,
                purchasePrice,
                mrp * 0.85,
                qty,
                qty,
              );

            if (qty > 0) {
              db.prepare(
                `
                INSERT INTO inventory_transactions (product_id, batch_id, transaction_type, quantity, notes)
                VALUES (?, ?, 'in', ?, 'Imported from catalogue')
              `,
              ).run(productId, batchResult.lastInsertRowid, qty);
            }

            const product = db
              .prepare(
                `
              SELECT p.*, c.name as company_name 
              FROM products p 
              LEFT JOIN companies c ON p.company_id = c.id 
              WHERE p.id = ?
            `,
              )
              .get(productId) as ProductWithCompany;

            imported.push(product);
          } catch (err: any) {
            errors.push(
              `Failed to import ${medicine.product_name}: ${err.message}`,
            );
          }
        }
      });

      commitImport();

      res.json({
        success: true,
        importedCount: imported.length,
        errorCount: errors.length,
        errors: errors.length > 0 ? errors : undefined,
        products: imported,
      });
    } catch (error) {
      console.error("Error importing medicines:", error);
      res.status(500).json({ error: "Failed to import medicines" });
    }
  });
}
