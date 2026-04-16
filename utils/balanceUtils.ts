
import { Remito, RegistroPago, Gasto, VentaVendedor, Producto, Usuario, TipoVendedor } from '../types';

export interface BalanceResult {
    totalComprado: number;
    totalPagado: number;
    totalGastos: number;
    saldoPendiente: number;
    historial: any[];
}

/**
 * Calcula el balance de cuenta corriente de un usuario (Vendedor)
 */
export const calculateUsuarioBalance = (
    user: Usuario,
    remitos: Remito[],
    pagos: RegistroPago[],
    gastos: Gasto[],
    ventasVendedor: VentaVendedor[],
    productosMap: Map<string, Producto>
): BalanceResult => {
    let comprado = 0;
    let totalG = 0;
    let pagado = 0;
    const historial: any[] = [];

    // 1. Ventas Históricas (VentaVendedor)
    const misVentas = ventasVendedor.filter(v => v.vendedorId === user.id && !v.clienteId);
    misVentas.forEach(v => {
        const totalVenta = v.movimientos.reduce((sum, m) => {
            const prod = productosMap.get(m.productoId);
            const precio = m.precioUnitario || prod?.precio || 0;
            return sum + (m.cantidad * precio);
        }, 0);
        comprado += totalVenta;
        const detalleProductos = v.movimientos.map(m => {
            const prod = productosMap.get(m.productoId);
            return `${m.cantidad}x ${prod?.nombre || '?'}`;
        }).join(', ');
        
        historial.push({
            id: v.id,
            type: 'sale',
            fecha: v.fecha,
            concepto: 'Compra de Stock (Histórica)',
            monto: -totalVenta,
            detalle: detalleProductos,
            original: v
        });
    });

    // 2. Ventas Unificadas (Remitos)
    const misRemitos = remitos.filter(r => r.vendedorId === user.id && !r.clienteId);
    misRemitos.forEach(r => {
        let totalRemito = 0;
        const defaultPriceType = user.tipo === TipoVendedor.EXTERNO ? 'reventa' : 'lista';

        r.movimientos.forEach(m => {
            const prod = productosMap.get(m.productoId);
            if (prod) {
                const precioEsp = user.preciosEspeciales?.find(p => p.productoId === m.productoId)?.precio;
                const precioSugerido = defaultPriceType === 'reventa' ? (prod.precioReventa || prod.precio) : prod.precio;
                const precioFinal = m.precioUnitario || precioEsp || precioSugerido;
                totalRemito += m.entregados * precioFinal;
            }
        });
        comprado += totalRemito;
        const detalleProductos = r.movimientos.map(m => {
            const prod = productosMap.get(m.productoId);
            return `${m.entregados}x ${prod?.nombre || '?'}`;
        }).join(', ');

        historial.push({
            id: r.id,
            type: 'remito',
            fecha: r.fecha,
            concepto: `Compra de Stock (#${r.puntoVenta}-${r.numero})`,
            monto: -totalRemito,
            detalle: detalleProductos,
            original: r
        });
    });

    // 3. Gastos asignados (Aumentan la deuda del usuario)
    const misGastos = gastos.filter(g => g.vendedorId === user.id);
    misGastos.forEach(g => {
        const montoGasto = g.pagos.reduce((sum, p) => sum + p.monto, 0);
        totalG += montoGasto;
        historial.push({
            id: g.id,
            type: 'expense',
            fecha: g.fecha,
            concepto: `Gasto Asignado: ${g.concepto}`,
            monto: -montoGasto,
            detalle: g.nroRecibo ? `Recibo: ${g.nroRecibo}` : '-',
            original: g
        });
    });

    // 4. Pagos realizados por el usuario
    const misPagos = pagos.filter(p => p.vendedorId === user.id && !p.clienteId);
    const pagosAgrupados = misPagos.reduce((acc: Record<string, RegistroPago[]>, p) => {
        const k = p.origen.id;
        if (!acc[k]) acc[k] = [];
        acc[k].push(p);
        return acc;
    }, {});

    Object.values(pagosAgrupados).forEach((grupo: RegistroPago[]) => {
        const p1 = grupo[0];
        const totalGrupo = grupo.reduce((sum, p) => sum + p.monto, 0);
        pagado += totalGrupo;
        
        historial.push({
            id: p1.origen.id,
            type: 'payment',
            fecha: p1.fecha,
            concepto: `Pago (${grupo.length > 1 ? 'Múltiple' : p1.metodo})`,
            monto: totalGrupo,
            detalle: p1.concepto || '-',
            original: grupo
        });
    });

    historial.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

    return {
        totalComprado: comprado,
        totalPagado: pagado,
        totalGastos: totalG,
        saldoPendiente: (comprado + totalG) - pagado,
        historial
    };
};
