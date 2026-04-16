
import { describe, it, expect } from 'vitest';
import { calculateUsuarioBalance } from './balanceUtils';
import { Usuario, Rol, TipoVendedor, Producto, TipoProducto, EstadoProducto, MetodoPago } from '../types';

describe('calculateUsuarioBalance', () => {
    const mockUser: Usuario = {
        id: 'user1',
        nombre: 'Vendedor Test',
        email: 'test@test.com',
        rol: Rol.REPARTIDOR,
        tipo: TipoVendedor.EXTERNO,
        preciosEspeciales: []
    };

    const mockProductos: Producto[] = [
        { id: 'p1', nombre: 'Bidon 20L', tipo: TipoProducto.RETORNABLE, estado: EstadoProducto.ACTIVO, precio: 1000, precioReventa: 800 }
    ];
    const productosMap = new Map(mockProductos.map(p => [p.id, p]));

    it('debería calcular correctamente la deuda por compra de stock', () => {
        const remitos = [
            {
                id: 'r1',
                fecha: '2024-01-01',
                vendedorId: 'user1',
                puntoVenta: '0001',
                numero: '1',
                movimientos: [{ productoId: 'p1', entregados: 10, recibidos: 0 }]
            }
        ];
        
        const result = calculateUsuarioBalance(mockUser, remitos as any, [], [], [], productosMap);
        
        // 10 bidones * 800 (precio reventa para externo) = 8000
        expect(result.totalComprado).toBe(8000);
        expect(result.saldoPendiente).toBe(8000);
    });

    it('debería descontar los pagos realizados', () => {
        const remitos = [
            {
                id: 'r1',
                fecha: '2024-01-01',
                vendedorId: 'user1',
                puntoVenta: '0001',
                numero: '1',
                movimientos: [{ productoId: 'p1', entregados: 10, recibidos: 0 }]
            }
        ];
        const pagos = [
            {
                id: 'pay1',
                fecha: '2024-01-01',
                monto: 5000,
                metodo: MetodoPago.EFECTIVO,
                vendedorId: 'user1',
                origen: { tipo: 'remito', id: 'r1' }
            }
        ];

        const result = calculateUsuarioBalance(mockUser, remitos as any, pagos as any, [], [], productosMap);
        
        expect(result.totalPagado).toBe(5000);
        expect(result.saldoPendiente).toBe(3000); // 8000 - 5000
    });

    it('debería sumar los gastos asignados a la deuda (descontar de su saldo)', () => {
        const gastos = [
            {
                id: 'g1',
                fecha: '2024-01-01',
                concepto: 'Combustible',
                vendedorId: 'user1',
                pagos: [{ monto: 1000, metodo: MetodoPago.EFECTIVO }]
            }
        ];

        const result = calculateUsuarioBalance(mockUser, [], [], gastos as any, [], productosMap);
        
        expect(result.totalGastos).toBe(1000);
        expect(result.saldoPendiente).toBe(1000); // El gasto asignado aumenta lo que el vendedor "debe" rendir o justifica una salida
    });
});
