import { Factura, RegistroPago, EstadoFactura } from '../types';

export interface FacturaPendiente extends Factura {
    totalPagado: number;
    saldoPendiente: number;
}

export const getPendingFacturas = (
    clienteId: string,
    facturas: Factura[],
    registrosPago: RegistroPago[]
): FacturaPendiente[] => {
    const facturasCliente = facturas.filter(f => f.clienteId === clienteId && f.estado !== EstadoFactura.ANULADO);
    
    return facturasCliente.map(f => {
        const pagosFactura = registrosPago.filter(p => p.origen.tipo === 'factura' && p.origen.id === f.id);
        const totalPagado = pagosFactura.reduce((sum, p) => sum + p.monto, 0);
        return { ...f, totalPagado, saldoPendiente: f.monto - totalPagado };
    }).filter(f => f.saldoPendiente > 0);
};
