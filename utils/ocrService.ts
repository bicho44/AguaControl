import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function extractFacturaData(fileBase64: string, mimeType: string): Promise<any> {
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

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: { parts: [imagePart, { text: PROMPT }] },
    config: {
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

  if (!response.text) {
    throw new Error("No se pudo extraer la información.");
  }

  return JSON.parse(response.text.trim());
}
