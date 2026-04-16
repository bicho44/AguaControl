
import { Remito, Cliente, Usuario, Producto, Movimiento, TipoVendedor, TipoProducto } from '../types';

/**
 * Determina si la sección de pagos debe ser visible en un formulario de venta
 */
export const shouldShowPaymentSection = (
    isCtaCte: boolean,
    esVentaMostrador: boolean,
    pagosCount: number,
    esAjuste: boolean
): boolean => {
    // Si es un ajuste, nunca mostrar pagos
    if (esAjuste) return false;
    
    // Mostrar siempre si (No es Cta Cte) O (Es Venta Mostrador/Caja) O (Ya tiene pagos cargados)
    return !isCtaCte || esVentaMostrador || pagosCount > 0;
};

/**
 * Calcula el total de un remito o venta considerando precios especiales y tipo de vendedor
 */
export const calculateRemitoTotal = (
    remito: Partial<Remito>,
    clientes: Cliente[],
    vendedores: Usuario[],
    productosMap: Map<string, Producto>
): number => {
    if (remito.esAjuste) return 0;
    if (!remito.movimientos) return 0;
    
    let preciosEspecialesMap = new Map<string, number>();
    let defaultPriceType: 'lista' | 'reventa' = 'lista';

    if (remito.clienteId) {
        const cliente = clientes.find(c => c.id === remito.clienteId);
        if (cliente) {
            preciosEspecialesMap = new Map(cliente.preciosEspeciales?.map(p => [p.productoId, p.precio]));
        }
    } else if (remito.vendedorId) {
        const vendedor = vendedores.find(v => v.id === remito.vendedorId);
        if (vendedor) {
            preciosEspecialesMap = new Map(vendedor.preciosEspeciales?.map(p => [p.productoId, p.precio]));
            if (vendedor.tipo === TipoVendedor.EXTERNO) defaultPriceType = 'reventa';
        }
    }

    return remito.movimientos.reduce((total, mov) => {
        if (!mov.productoId) return total;
        const producto = productosMap.get(mov.productoId);
        if (!producto) return total;
        
        const precioSugerido = defaultPriceType === 'reventa' ? (producto.precioReventa || producto.precio) : producto.precio;
        const precio = mov.precioUnitario ?? preciosEspecialesMap.get(mov.productoId) ?? precioSugerido;
        
        return total + (mov.entregados * precio);
    }, 0);
};

/**
 * Calcula el stock de envases retornables que tiene un cliente o vendedor
 */
export const calculateStockAtentivo = (
    subjectId: string,
    isClient: boolean,
    sucursalId: string | undefined,
    remitos: Remito[],
    productosMap: Map<string, Producto>
): Record<string, number> => {
    const stock: Record<string, number> = {};
    
    remitos.filter(r => {
        if (isClient) {
            if (r.clienteId !== subjectId) return false;
            if (!sucursalId) return true;
            const rSucId = r.sucursalId || 'main';
            return rSucId === sucursalId;
        } else {
            return r.vendedorId === subjectId && !r.clienteId;
        }
    }).forEach(r => {
        r.movimientos.forEach(m => {
            const prod = productosMap.get(m.productoId);
            if (prod?.tipo === TipoProducto.RETORNABLE) {
                stock[m.productoId] = (stock[m.productoId] || 0) + (m.entregados - m.recibidos);
            }
        });
    });
    
    return stock;
};
