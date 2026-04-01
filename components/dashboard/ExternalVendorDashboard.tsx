
import React, { useMemo } from 'react';
import { Usuario, VentaVendedor, RegistroPago, Producto, TipoProducto } from '../../types';
import { getLocalDateString } from '../../utils/dateUtils';
import { AppButton, AppCard } from '../ui';

interface ExternalVendorDashboardProps {
    user: Usuario;
    ventas: VentaVendedor[];
    pagos: RegistroPago[];
    productosMap: Map<string, Producto>;
    onOpenStockPurchase: () => void;
    onOpenPago: () => void;
}

const ExternalVendorDashboard: React.FC<ExternalVendorDashboardProps> = ({ 
    user, ventas, pagos, productosMap, onOpenStockPurchase, onOpenPago 
}) => {
    const misVentas = useMemo(() => ventas.filter(v => v.vendedorId === user.id && !v.clienteId), [ventas, user.id]);

    const shortName = (name: string) => {
        const prod = Array.from(productosMap.values()).find((p: any) => p.nombre === name) as Producto | undefined;
        if (prod?.abreviatura) return prod.abreviatura;
        return name.replace('Bidón ', '').replace(' Retornable', '').replace(' Descartable', '');
    };
    
    const { totalComprado, totalPagado, saldoPendiente, historial, retiradosHoy, retiradosAyer } = useMemo(() => {
        let comprado = 0;
        const historialCombinado: any[] = [];
        const todayStr = getLocalDateString();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = getLocalDateString(yesterday);

        let hoy = 0;
        let ayer = 0;

        misVentas.forEach(v => {
            let totalVenta = 0;
            const vDate = v.fecha.split('T')[0];
            v.movimientos.forEach(m => {
                const prod = productosMap.get(m.productoId);
                if (prod) {
                    const precioEsp = user.preciosEspeciales?.find(p => p.productoId === m.productoId)?.precio;
                    const precioFinal = m.precioUnitario || precioEsp || prod.precioReventa || prod.precio;
                    totalVenta += m.cantidad * precioFinal;
                    if (prod.tipo === TipoProducto.RETORNABLE) {
                        if (vDate === todayStr) hoy += m.cantidad;
                        if (vDate === yesterdayStr) ayer += m.cantidad;
                    }
                }
            });
            comprado += totalVenta;
            historialCombinado.push({
                fecha: v.fecha,
                concepto: 'Compra de Stock',
                monto: -totalVenta,
                detalle: `${v.movimientos.length} productos`
            });
        });

        const misPagos = pagos.filter(p => p.vendedorId === user.id && !p.clienteId);
        let pagado = 0;
        misPagos.forEach(p => {
            pagado += p.monto;
            historialCombinado.push({
                fecha: p.fecha,
                concepto: `Pago (${p.metodo})`,
                monto: p.monto,
                detalle: p.concepto || '-'
            });
        });

        const deuda = comprado - pagado;
        historialCombinado.sort((a,b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
        return { totalComprado: comprado, totalPagado: pagado, saldoPendiente: deuda, historial: historialCombinado, retiradosHoy: hoy, retiradosAyer: ayer };
    }, [misVentas, pagos, user.id, productosMap, user.preciosEspeciales]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: 'var(--pico-spacing)' }}>
                <h2 style={{ margin: 0, textTransform: 'uppercase', letterSpacing: '-0.02em' }}>
                    Cuenta Corriente: <span style={{ color: 'var(--pico-primary)' }}>{user.nombre}</span>
                </h2>
                <div className="grid">
                    <AppButton onClick={onOpenPago} variant="success">
                        $ Cargar Pago
                    </AppButton>
                    <AppButton onClick={onOpenStockPurchase}>
                        + Registrar Retiro
                    </AppButton>
                </div>
            </div>
            
            <div className="grid">
                <AppCard style={{ 
                  textAlign: 'center', 
                  backgroundColor: saldoPendiente > 0 ? 'rgba(255,0,0,0.05)' : 'rgba(0,255,0,0.05)',
                  border: `2px solid ${saldoPendiente > 0 ? 'rgba(255,0,0,0.2)' : 'rgba(0,255,0,0.2)'}`
                }}>
                    <small style={{ textTransform: 'uppercase', fontWeight: 900, color: saldoPendiente > 0 ? 'red' : 'green' }}>Saldo Pendiente (Deuda)</small>
                    <h2 style={{ margin: 0, color: saldoPendiente > 0 ? 'red' : 'green' }}>${saldoPendiente.toLocaleString()}</h2>
                </AppCard>

                <AppCard title="Envases Retirados" style={{ padding: 0 }}>
                    <div className="grid" style={{ padding: '1rem' }}>
                        <div style={{ textAlign: 'center' }}>
                            <h2 style={{ margin: 0, color: 'var(--pico-primary)' }}>{retiradosHoy}</h2>
                            <small style={{ textTransform: 'uppercase', fontWeight: 'bold' }}>Hoy</small>
                        </div>
                        <div style={{ textAlign: 'center', borderLeft: '1px solid var(--pico-muted-border-color)' }}>
                            <h2 style={{ margin: 0, color: 'var(--pico-muted-color)' }}>{retiradosAyer}</h2>
                            <small style={{ textTransform: 'uppercase', fontWeight: 'bold' }}>Ayer</small>
                        </div>
                    </div>
                </AppCard>
            </div>

            <AppCard title="Historial de Movimientos">
                <div style={{ overflow: 'auto' }}>
                    <table className="striped">
                        <thead>
                            <tr>
                              <th>Fecha</th>
                              <th>Concepto</th>
                              <th>Detalle</th>
                              <th style={{ textAlign: 'right' }}>Monto</th>
                            </tr>
                        </thead>
                        <tbody>
                            {historial.map((h, i) => (
                                <tr key={i}>
                                    <td style={{ fontFamily: 'var(--pico-font-family-mono)', fontSize: '0.75rem' }}>{new Date(h.fecha + 'T00:00:00').toLocaleDateString('es-AR')}</td>
                                    <td><strong>{h.concepto}</strong></td>
                                    <td><small>{h.detalle}</small></td>
                                    <td style={{ textAlign: 'right', fontWeight: 'bold', color: h.monto < 0 ? 'red' : 'green' }}>
                                        {h.monto < 0 ? '-' : '+'}${Math.abs(h.monto).toLocaleString()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </AppCard>
        </div>
    );
};

export default ExternalVendorDashboard;
