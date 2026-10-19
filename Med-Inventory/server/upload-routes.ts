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
import type { ProductWithCompany } from "@shared/types";

const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 10 * 1024 * 1024 },
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
      cb(new Error("Only PDF, Excel, and CSV files are allowed"));
    }
  },
});

async function extractTextFromPDF(filePath: string): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const dataBuffer = fs.readFileSync(filePath);
  const parser = new PDFParse({ data: dataBuffer });
  const result = await parser.getText();
  await parser.destroy();
  return result.text;
}

function extractTextFromExcel(filePath: string): string {
  const workbook = XLSX.readFile(filePath);
  let text = "";

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

  return text;
}

export function registerUploadRoutes(app: Express) {
  if (!fs.existsSync("uploads")) {
    fs.mkdirSync("uploads", { recursive: true });
  }

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
            "Groq API key not configured. Please add GROQ_API_KEY to secrets.",
        });
      }

      try {
        let text: string;
        const ext = path.extname(file.originalname).toLowerCase();

        if (ext === ".pdf") {
          text = await extractTextFromPDF(file.path);
        } else if ([".xlsx", ".xls", ".csv"].includes(ext)) {
          text = extractTextFromExcel(file.path);
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
        console.error("Error processing file:", error);
        res.status(500).json({ error: "Failed to process file" });
      }
    },
  );

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

      for (const medicine of medicines) {
        try {
          if (!medicine.product_name || medicine.product_name.trim() === "") {
            errors.push("Skipped: Medicine without name");
            continue;
          }

          const today = new Date();
          const defaultExpiry = new Date(today);
          defaultExpiry.setFullYear(defaultExpiry.getFullYear() + 2);

          const result = db
            .prepare(
              `
            INSERT INTO products (
              company_id, product_name, composition, batch_number, 
              expiry_date, mrp, purchase_price, stock_quantity, minimum_stock_level
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
            )
            .run(
              companyId,
              medicine.product_name.trim(),
              medicine.composition || null,
              medicine.batch_number || `BATCH-${Date.now()}`,
              medicine.expiry_date || defaultExpiry.toISOString().split("T")[0],
              medicine.mrp || 0,
              medicine.purchase_price || 0,
              medicine.stock_quantity || 0,
              medicine.minimum_stock_level || 10,
            );

          if (medicine.stock_quantity && medicine.stock_quantity > 0) {
            db.prepare(
              `
              INSERT INTO inventory_transactions (product_id, transaction_type, quantity, notes)
              VALUES (?, 'in', ?, 'Imported from catalogue')
            `,
            ).run(result.lastInsertRowid, medicine.stock_quantity);
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
            .get(result.lastInsertRowid) as ProductWithCompany;

          imported.push(product);
        } catch (err) {
          errors.push(`Failed to import: ${medicine.product_name}`);
        }
      }

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
