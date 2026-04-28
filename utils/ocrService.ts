import { GoogleGenAI, Type } from "@google/genai";

/**
 * Nota: En AI Studio Build, GEMINI_API_KEY se inyecta automáticamente.
 * Para despliegues externos (Vercel), DEBES configurar VITE_GEMINI_API_KEY en el panel de control de Vercel.
 */
const getApiKey = () => {
  // @ts-ignore - En entornos Vite, process.env puede no estar definido, pero import.meta.env sí
  return import.meta.env.VITE_GEMINI_API_KEY || (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : '');
};

export async function extractFacturaData(fileBase64: string, mimeType: string): Promise<any> {
  const apiKey = getApiKey();
  
  if (!apiKey || apiKey === '') {
    throw new Error(
      "API Key de Gemini no encontrada. Si estás en Vercel, asegúrate de configurar VITE_GEMINI_API_KEY en las variables de entorno del proyecto."
    );
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const imagePart = {
    inlineData: {
      mimeType,
      data: fileBase64,
    },
  };

  const PROMPT = `
    Analiza esta factura de proveedor de Argentina. Extrae los datos en formato JSON.
    - tipoComprobante: (A, B, C, M, X o Ticket)
    - numero: número de comprobante completo
    - fechaEmision: YYYY-MM-DD
    - fechaVencimiento: YYYY-MM-DD
    - subtotalNeto: valor numérico
    - importeIva: valor numérico
    - alicuotaIva: porcentaje (ej: 21)
    - percepciones: suma de otros impuestos/percepciones
    - total: valor total final
    - proveedorNombre: razón social del emisor
    - proveedorCuit: CUIT del emisor
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
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
          required: ["tipoComprobante", "numero", "fechaEmision", "total", "proveedorNombre", "proveedorCuit"]
        },
      },
    });

    if (!response.text) {
      throw new Error("La IA no pudo procesar la imagen de la factura.");
    }

    return JSON.parse(response.text.trim());
  } catch (error: any) {
    console.error("Error en OCR Service:", error);
    if (error.message?.includes("API key")) {
      throw new Error("Error de API Key: Verifica que la clave sea válida y tenga permisos para el modelo Gemini 2.5.");
    }
    throw error;
  }
}
