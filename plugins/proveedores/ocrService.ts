import { GoogleGenAI, Type } from "@google/genai";

/**
 * Nota: En AI Studio Build, GEMINI_API_KEY se inyecta automáticamente.
 * Para despliegues externos (Vercel), DEBES configurar VITE_GEMINI_API_KEY.
 */
const getApiKey = () => {
  // En Vite, se usa import.meta.env
  // @ts-ignore
  return (import.meta.env?.VITE_GEMINI_API_KEY) || (typeof process !== 'undefined' ? process.env?.GEMINI_API_KEY : '');
};

export async function extractFacturaData(fileBase64: string, mimeType: string): Promise<any> {
    const apiKey = getApiKey();
    
    if (!apiKey || apiKey === '') {
        throw new Error(
            "API Key de Gemini no encontrada. Por favor, configura VITE_GEMINI_API_KEY en las variables de entorno."
        );
    }

    // Inicializamos el SDK dentro de la función para evitar errores en el import
    // y permitir que el failsafe del plugin maneje el error si falta la clave.

    const PROMPT = `
        Analiza esta factura de proveedor de Argentina. Extrae los datos en formato JSON.
        - tipoComprobante: (A, B, C, M, X o Ticket)
        - numero: número de comprobante completo (ej: 0001-00000123)
        - fechaEmision: YYYY-MM-DD
        - subtotalNeto: valor numérico
        - importeIva: valor numérico
        - alicuotasIva: arreglo de objetos con "alicuota" y "importe" para desglosar múltiples IVAs si los hay (ej: [{"alicuota": 21, "importe": 100}])
        - otrosImpuestos: arreglo de objetos con "nombre" (ej: Combustibles, IIBB, No Gravado) y "monto" (ej: [{"nombre": "ITC", "monto": 50}])
        - percepciones: suma de otros impuestos/percepciones no desglosados
        - total: valor total final
        - proveedorNombre: razón social del emisor
        - proveedorCuit: CUIT del emisor
        - proveedorEmail: email del emisor (si existe)
        - proveedorTelefono: teléfono del emisor (si existe)
        - proveedorDireccion: dirección del emisor (si existe)
        - proveedorIIBB: número de Ingresos Brutos del emisor (si existe)
        - observacionesMarkdown: Una descripción clara, concisa y en formato Markdown (ej: con viñetas) de los ÍTEMS, productos o servicios principales adquiridos según detalla la factura.
    `;

    try {
        const ai = new GoogleGenAI({ apiKey: apiKey });

        const result = await ai.models.generateContent({ 
            model: "gemini-2.5-flash",
            contents: [
                {
                    role: "user",
                    parts: [
                        { inlineData: { mimeType, data: fileBase64 } },
                        { text: PROMPT }
                    ]
                }
            ],
            config: {
                responseMimeType: "application/json",
            }
        });
        
        const text = result.text;

        if (!text) {
            throw new Error("La IA no pudo procesar la imagen de la factura o no devolvió texto.");
        }

        return JSON.parse(text.trim());
    } catch (error: any) {
        console.error("Error en OCR Service:", error);
        // Personalizamos el error para que sea informativo pero no mate la app
        if (error.message?.includes("API key")) {
            throw new Error("Error de Configuración: La API Key de Gemini no es válida o no tiene permisos.");
        }
        throw new Error("Error de Procesamiento: " + (error.message || "No se pudo analizar la factura."));
    }
}
