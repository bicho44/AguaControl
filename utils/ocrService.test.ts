import { extractFacturaData } from './ocrService';

// Mocking @google/genai GoogleGenAI class
jest.mock('@google/genai', () => {
    return {
        GoogleGenAI: jest.fn().mockImplementation(() => {
            return {
                models: {
                    generateContent: jest.fn().mockResolvedValue({
                        text: JSON.stringify({
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
                    })
                }
            }
        }),
        Type: {
            OBJECT: 'OBJECT',
            STRING: 'STRING',
            NUMBER: 'NUMBER'
        }
    }
});

describe('ocrService', () => {
    it('debería contactar con la API de Gemini y devolver JSON parseado', async () => {
        const dummyBase64 = 'dummybase64string';
        const dummyMime = 'image/jpeg';
        
        const result = await extractFacturaData(dummyBase64, dummyMime);
        
        expect(result).toBeDefined();
        expect(result.tipoComprobante).toBe('A');
        expect(result.total).toBe(1210);
        expect(result.importeIva).toBe(210);
        expect(result.proveedorNombre).toBe('PRUEBA SA');
    });
});
