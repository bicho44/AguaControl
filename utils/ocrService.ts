import { GoogleGenAI, Type } from "@google/genai";

let aiInstance: GoogleGenAI | null = null;

function getAI() {
  if (!aiInstance) {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY filter not found. Please set VITE_GEMINI_API_KEY or GEMINI_API_KEY.");
    }
    aiInstance = new GoogleGenAI(apiKey);
  }
  return aiInstance;
}

export async function extractFacturaData(fileBase64: string, mimeType: string): Promise<any> {
    const ai = getAI();
    const imagePart = {
    inlineData: {
      mimeType,
      data: fileBase64,
    },
  };

  const PROMPT = `
    Extrae la información de esta factura de proveedor en Argentina.
    Identifica:
    - tipoComprobante: Puede ser "A", "B", "C", "M", "X", o "Ticket".
    - numero: El número de la factura completo (ej: 0001-00000123).
    - fechaEmision: En formato YYYY-MM-DD.
    - fechaVencimiento: En formato YYYY-MM-DD (si no se encuentra, usa la de emisión).
    - subtotalNeto: El importe neto gravado.
    - importeIva: El importe del IVA.
    - alicuotaIva: La alícuota del IVA principal (ej: 21, 10.5, 27). Usa 0 si no tiene.
    - percepciones: Suma de percepciones o impuestos adicionales.
    - total: Importe total de la factura.
    - proveedorNombre: Razón social del emisor de la factura.
    - proveedorCuit: CUIT del emisor de la factura (solo números, o con guiones).
  `;

  const model = ai.getGenerativeModel({ 
    model: "gemini-2.0-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          tipoComprobante: { type: Type.STRING },
          numero: { type: Type.STRING },
          fechaEmision: { type: Type.STRING },
          fechaVencimiento: { type: Type.STRING },
          subtotalNeto: { type: Type.NUMBER },
          importeIva: { type: Type.NUMBER },
          alicuotaIva: { type: Type.NUMBER },
          percepciones: { type: Type.NUMBER },
          total: { type: Type.NUMBER },
          proveedorNombre: { type: Type.STRING },
          proveedorCuit: { type: Type.STRING },
        },
      },
    },
  });

  const result = await model.generateContent([imagePart, { text: PROMPT }]);
  const response = result.response;
  const text = response.text();

  if (!text) {
    throw new Error("No se pudo extraer la información.");
  }

  return JSON.parse(text.trim());
}
