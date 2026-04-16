
import { describe, it, expect } from 'vitest';
import { shouldShowPaymentSection, calculateRemitoTotal, calculateStockAtentivo } from './salesUtils';
import { Cliente, Usuario, Producto, TipoVendedor, Rol, EstadoCliente, MetodoPago, TipoProducto } from '../types';

describe('salesUtils', () => {
    describe('shouldShowPaymentSection', () => {
        it('should show payment if not Cta Cte', () => {
            expect(shouldShowPaymentSection(false, false, 0, false)).toBe(true);
        });

        it('should show payment if it is Mostrador/Caja even if Cta Cte', () => {
            expect(shouldShowPaymentSection(true, true, 0, false)).toBe(true);
        });

        it('should show payment if it already has payments even if Cta Cte', () => {
            expect(shouldShowPaymentSection(true, false, 1, false)).toBe(true);
        });

        it('should NOT show payment if it is Cta Cte and not Mostrador and has no payments', () => {
            expect(shouldShowPaymentSection(true, false, 0, false)).toBe(false);
        });

        it('should NOT show payment if it is an adjustment', () => {
            expect(shouldShowPaymentSection(false, true, 5, true)).toBe(false);
        });
    });

    describe('calculateRemitoTotal', () => {
        const mockProductos: Producto[] = [
            { id: 'p1', nombre: 'Bidon 20L', precio: 1000, precioReventa: 800 } as any,
            { id: 'p2', nombre: 'Sifón', precio: 500, precioReventa: 400 } as any
        ];
        const productosMap = new Map(mockProductos.map(p => [p.id, p]));

        it('should return 0 for adjustments', () => {
            const remito = { esAjuste: true, movimientos: [{ productoId: 'p1', entregados: 10, recibidos: 0 }] };
            expect(calculateRemitoTotal(remito, [], [], productosMap)).toBe(0);
        });

        it('should calculate total with standard prices', () => {
            const remito = { 
                movimientos: [
                    { productoId: 'p1', entregados: 2, recibidos: 0 },
                    { productoId: 'p2', entregados: 5, recibidos: 0 }
                ] 
            };
            expect(calculateRemitoTotal(remito, [], [], productosMap)).toBe(2 * 1000 + 5 * 500);
        });

        it('should use reventa price for external vendors', () => {
            const externalVendor = { id: 'v1', tipo: TipoVendedor.EXTERNO, nombre: 'Ariel' } as Usuario;
            const remito = { 
                vendedorId: 'v1',
                movimientos: [{ productoId: 'p1', entregados: 10, recibidos: 0 }] 
            };
            expect(calculateRemitoTotal(remito, [], [externalVendor], productosMap)).toBe(10 * 800);
        });

        it('should respect special prices for clients', () => {
            const cliente = { 
                id: 'c1', 
                nombre: 'Juan', 
                preciosEspeciales: [{ productoId: 'p1', precio: 900 }] 
            } as Cliente;
            const remito = { 
                clienteId: 'c1',
                movimientos: [{ productoId: 'p1', entregados: 10, recibidos: 0 }] 
            };
            expect(calculateRemitoTotal(remito, [cliente], [], productosMap)).toBe(10 * 900);
        });

        it('should override with manual price if present in movimiento (Crucial Fix)', () => {
            const remito = { 
                movimientos: [{ productoId: 'p1', entregados: 10, recibidos: 0, precioUnitario: 1200 }] 
            };
            expect(calculateRemitoTotal(remito, [], [], productosMap)).toBe(10 * 1200);
        });

        it('should handle zero entregados', () => {
            const remito = { movimientos: [{ productoId: 'p1', entregados: 0, recibidos: 5 }] };
            expect(calculateRemitoTotal(remito, [], [], productosMap)).toBe(0);
        });
    });

    describe('calculateStockAtentivo', () => {
        const mockProductos = [{ id: 'p1', tipo: TipoProducto.RETORNABLE }, { id: 'p2', tipo: TipoProducto.DESCARTABLE }] as Producto[];
        const productosMap = new Map(mockProductos.map(p => [p.id, p]));
        
        const remitos = [
            { clienteId: 'c1', movimientos: [{ productoId: 'p1', entregados: 10, recibidos: 5 }] },
            { clienteId: 'c1', movimientos: [{ productoId: 'p1', entregados: 2, recibidos: 4 }] }
        ] as any[];

        it('should calculate net balance of returnable products', () => {
            const stock = calculateStockAtentivo('c1', true, undefined, remitos, productosMap);
            expect(stock['p1']).toBe(3); // (10-5) + (2-4) = 5 - 2 = 3
        });

        it('should ignore non-returnable products', () => {
            const r2 = [{ clienteId: 'c1', movimientos: [{ productoId: 'p2', entregados: 10, recibidos: 0 }] }] as any[];
            const stock = calculateStockAtentivo('c1', true, undefined, r2, productosMap);
            expect(stock['p2']).toBeUndefined();
        });
    });
});
