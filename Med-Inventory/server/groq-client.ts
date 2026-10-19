import Groq from "groq-sdk";

function getGroqClient(): Groq {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY not configured");
  }
  return new Groq({
    apiKey: process.env.GROQ_API_KEY,
  });
}

export interface ExtractedMedicine {
  product_name: string;
  composition?: string;
  batch_number?: string;
  expiry_date?: string;
  mrp?: number;
  purchase_price?: number;
  stock_quantity?: number;
  minimum_stock_level?: number;
}

export async function extractMedicinesFromText(
  text: string,
): Promise<ExtractedMedicine[]> {
  const systemPrompt = `You are a medicine catalogue extractor. Your task is to extract medicine/pharmaceutical product information from the provided text.

IMPORTANT RULES:
1. Only extract items that are clearly medicines or pharmaceutical products
2. Ignore non-medicine items like equipment, supplies, or general goods
3. Extract as much information as available for each medicine
4. For dates, use YYYY-MM-DD format
5. For prices, extract numeric values only (no currency symbols)
6. If a field is not available, omit it from the output

Return a JSON array of medicines with these fields:
- product_name (required): Name of the medicine
- composition (optional): Chemical composition or active ingredients
- batch_number (optional): Batch/lot number
- expiry_date (optional): Expiry date in YYYY-MM-DD format
- mrp (optional): Maximum retail price as a number
- purchase_price (optional): Purchase/cost price as a number
- stock_quantity (optional): Quantity in stock as a number
- minimum_stock_level (optional): Minimum stock level as a number

Return ONLY a valid JSON array, no other text.`;

  try {
    const groq = getGroqClient();
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Extract medicine information from this catalogue data:\n\n${text}`,
        },
      ],
      temperature: 0.1,
      max_tokens: 4096,
    });

    const content = response.choices[0]?.message?.content || "[]";

    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error("No JSON array found in response");
      return [];
    }

    const medicines = JSON.parse(jsonMatch[0]) as ExtractedMedicine[];
    return medicines.filter(
      (m) => m.product_name && m.product_name.trim() !== "",
    );
  } catch (error) {
    console.error("Error extracting medicines with Groq:", error);
    throw error;
  }
}
