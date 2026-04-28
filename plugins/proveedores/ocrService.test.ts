import { describe, it, expect, vi } from 'vitest';
import { extractFacturaData } from './ocrService';

// Mocking @google/genai SDK
vi.mock('@google/genai', () => {
    class MockGoogleGenAI {
        getGenerativeModel = vi.fn().mockReturnValue({
            generateContent: vi.fn().mockResolvedValue({
                response: {
                    text: () => JSON.stringify({
                        tipoComprobante: 'A',
                        numero: '0001-00000123',
                        fechaEmision: '2026-04-20',
                        fechaVencimiento: '2026-05-20',
                        subtotalNeto: 1000,
                        importeIva: 210,
                        alicuotaIva: 21,
                        percepciones: 0,
                        total: 1210,
                        proveedorNombre: 'PRUEBA SA',
                        proveedorCuit: '30-12345678-9'
                    })
                }
            })
        });
    }

    return {
        GoogleGenAI: MockGoogleGenAI,
        Type: {
            OBJECT: 'OBJECT',
            STRING: 'STRING',
            NUMBER: 'NUMBER'
        }
    };
});

describe('ocrService within plugin', () => {
    it('debería contactar con la API de Gemini y devolver JSON parseado', async () => {
        const dummyBase64 = 'dummybase64string';
        const dummyMime = 'image/jpeg';
        
        // Mock environment variables using vi.stubEnv if supported, or just ensure OCR finds a key
        vi.stubEnv('VITE_GEMINI_API_KEY', 'test-key');

        const result = await extractFacturaData(dummyBase64, dummyMime);
        
        expect(result).toBeDefined();
        expect(result.tipoComprobante).toBe('A');
        expect(result.total).toBe(1210);
        expect(result.importeIva).toBe(210);
        expect(result.proveedorNombre).toBe('PRUEBA SA');
    });

    it('debería fallar si no hay API key', async () => {
        vi.stubEnv('VITE_GEMINI_API_KEY', '');
        
        await expect(extractFacturaData('b64', 'mime')).rejects.toThrow(/API Key de Gemini no encontrada/);
    });
});
