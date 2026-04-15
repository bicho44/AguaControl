import { describe, it, expect } from 'vitest';
import { getPendingFacturas } from './invoiceUtils';
import { Factura, RegistroPago, EstadoFactura, MetodoPago } from '../types';

describe('getPendingFacturas', () => {
    const clienteId = 'cliente-1';
    
    const facturas: Factura[] = [
        {
            id: 'factura-1',
            fecha: '2026-04-01',
            clienteId: 'cliente-1',
            numero: '0001-00000001',
            monto: 1000,
            remitosIds: ['remito-1'],
            estado: EstadoFactura.PENDIENTE
        },
        {
            id: 'factura-2',
            fecha: '2026-04-02',
            clienteId: 'cliente-1',
            numero: '0001-00000002',
            monto: 500,
            remitosIds: ['remito-2'],
            estado: EstadoFactura.PENDIENTE
        },
        {
            id: 'factura-3',
            fecha: '2026-04-03',
            clienteId: 'cliente-2', // Otro cliente
            numero: '0001-00000003',
            monto: 2000,
            remitosIds: ['remito-3'],
            estado: EstadoFactura.PENDIENTE
        },
        {
            id: 'factura-4',
            fecha: '2026-04-04',
            clienteId: 'cliente-1',
            numero: '0001-00000004',
            monto: 300,
            remitosIds: ['remito-4'],
            estado: EstadoFactura.ANULADO // Anulada
        }
    ];

    const registrosPago: RegistroPago[] = [
        {
            id: 'pago-1',
            fecha: '2026-04-05',
            clienteId: 'cliente-1',
            monto: 400,
            metodo: MetodoPago.EFECTIVO,
            origen: { tipo: 'factura', id: 'factura-1' }
        },
        {
            id: 'pago-2',
            fecha: '2026-04-06',
            clienteId: 'cliente-1',
            monto: 100,
            metodo: MetodoPago.TRANSFERENCIA,
            origen: { tipo: 'factura', id: 'factura-2' }
        }
    ];

    it('should return pending invoices for the specified client', () => {
        const result = getPendingFacturas(clienteId, facturas, registrosPago);
        
        expect(result).toHaveLength(2);
        
        const f1 = result.find(f => f.id === 'factura-1');
        expect(f1).toBeDefined();
        expect(f1?.totalPagado).toBe(400);
        expect(f1?.saldoPendiente).toBe(600);
        
        const f2 = result.find(f => f.id === 'factura-2');
        expect(f2).toBeDefined();
        expect(f2?.totalPagado).toBe(100);
        expect(f2?.saldoPendiente).toBe(400);
    });

    it('should exclude fully paid invoices', () => {
        const pagosCompletos: RegistroPago[] = [
            ...registrosPago,
            {
                id: 'pago-3',
                fecha: '2026-04-07',
                clienteId: 'cliente-1',
                monto: 600,
                metodo: MetodoPago.EFECTIVO,
                origen: { tipo: 'factura', id: 'factura-1' }
            }
        ];
        
        const result = getPendingFacturas(clienteId, facturas, pagosCompletos);
        
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('factura-2');
    });

    it('should return an empty array if no pending invoices exist', () => {
        const result = getPendingFacturas('cliente-3', facturas, registrosPago);
        expect(result).toHaveLength(0);
    });
});
