
import { Cliente, TipoFacturacion, EstadoCliente } from '../types';

export interface AfipResponse {
    success: boolean;
    data?: any;
    error?: string;
}

const mapImpuestoToCondicion = (impuestos: any[] = [], monotributo: any): TipoFacturacion => {
    // Lógica para determinar condición frente al IVA basada en respuesta de AFIP
    if (monotributo && monotributo.categoria) {
        return TipoFacturacion.MONOTRIBUTO;
    }

    const isExento = impuestos.some((i: any) => i.idImpuesto === 32 || i.descripcionImpuesto?.includes('EXENTO')); // 32 es IVA Exento usualmente
    const isInscripto = impuestos.some((i: any) => i.idImpuesto === 30); // 30 es IVA

    if (isInscripto) return TipoFacturacion.RESPONSABLE_INSCRIPTO;
    if (isExento) return TipoFacturacion.EXENTO;
    
    return TipoFacturacion.CONSUMIDOR_FINAL;
};

const extractAddress = (domicilios: any[] = []): { direccion: string, localidad: string, provincia: string, cp: string } => {
    // Priorizar domicilio FISCAL (tipoDomicilio 1 en padron a13 suele ser fiscal)
    const fiscal = domicilios.find((d: any) => d.tipoDomicilio === 'FISCAL' || d.tipoDomicilio === '1') || domicilios[0];
    
    if (!fiscal) return { direccion: '', localidad: '', provincia: '', cp: '' };

    const calle = fiscal.direccion || fiscal.calle || '';
    const numero = fiscal.numero || '';
    const piso = fiscal.piso ? ` P:${fiscal.piso}` : '';
    const depto = fiscal.oficinaDpto ? ` D:${fiscal.oficinaDpto}` : '';
    
    return {
        direccion: `${calle} ${numero}${piso}${depto}`.trim(),
        localidad: fiscal.localidad || '',
        provincia: fiscal.descripcionProvincia || '',
        cp: fiscal.codigoPostal || ''
    };
};

// Ahora fetchDatosPadron acepta la URL base como parámetro opcional
export const fetchDatosPadron = async (cuit: string, baseUrl?: string): Promise<Partial<Cliente>> => {
    // 1. Obtener URL (Prioridad: Argumento > Env Var)
    const ENV_URL = (import.meta as any).env?.VITE_AFIP_API_URL;
    const API_URL = baseUrl || ENV_URL;

    // Validación básica de CUIT (11 números)
    const cleanCuit = cuit.replace(/\D/g, '');
    if (cleanCuit.length !== 11) throw new Error("CUIT inválido. Debe tener 11 dígitos.");

    // Si no hay URL configurada en ningún lado
    if (!API_URL) {
        throw new Error("Servicio AFIP no configurado. Vaya a Configuración > Integración AFIP.");
    }

    try {
        const response = await fetch(`${API_URL}/${cleanCuit}`);
        
        if (!response.ok) {
            throw new Error(`Error del servidor: ${response.statusText}`);
        }

        const json = await response.json();
        
        // ESTRUCTURA ESTÁNDAR (Adaptar según el proveedor de API que elijas)
        // Asumimos estructura similar a "ws_sr_padron_a13" plana o wrapper común.
        const persona = json.persona || json.data || json;

        if (!persona) throw new Error("No se encontraron datos para este CUIT.");

        // Mapeo de datos
        const nombre = persona.razonSocial || `${persona.apellido || ''} ${persona.nombre || ''}`.trim();
        const condicionIva = mapImpuestoToCondicion(persona.impuestos, persona.monotributo);
        const { direccion, localidad, provincia, cp } = extractAddress(persona.domicilios);

        return {
            cuit: cleanCuit,
            nombreFiscal: nombre, // Razón Social Oficial
            tipoFacturacion: condicionIva,
            direccionFiscal: direccion,
            localidad: localidad,
            provincia: provincia,
            codPostal: cp,
            estado: EstadoCliente.ACTIVO // Default
        };

    } catch (error) {
        console.error("AFIP Fetch Error:", error);
        throw error;
    }
};
