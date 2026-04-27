import { render, screen, fireEvent } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import ProveedoresPlugin from './ProveedoresPlugin';
import { useDataStore } from '../../hooks/useDataStore';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';

vi.mock('../../hooks/useDataStore');
vi.mock('../../context/AuthContext');
vi.mock('../../context/NotificationContext', () => ({
    useNotification: vi.fn()
}));

describe('ProveedoresPlugin Interface', () => {
    beforeEach(() => {
        (useAuth as any).mockReturnValue({ user: { rol: 'Administrador' } });
        (useNotification as any).mockReturnValue({ showNotification: vi.fn() });

        (useDataStore as any).mockReturnValue({
            empresaSettings: { proveedoresConfig: { enabled: true } },
            proveedores: [
                { id: '1', nombre: 'Distribuidora ABC', cuit: '30-12345678-9', telefono: '123', email: 'a@c.com', activo: true }
            ],
            facturasProveedor: [
                { id: 'f1', proveedorId: '1', numero: '0001-00000001', fechaEmision: '2026-04-26', fechaVencimiento: '2026-05-26', total: 15000, saldoPagar: 10000, estado: 'Pagado Parcial' },
                { id: 'f2', proveedorId: '1', numero: '0001-00000002', fechaEmision: '2026-04-26', fechaVencimiento: '2026-05-26', total: 5000, saldoPagar: 0, estado: 'Pagado' }
            ],
            pagosProveedor: [
                { id: 'p1', facturaProveedorId: 'f1', proveedorId: '1', monto: 5000, fecha: '2026-04-26', metodo: 'Efectivo' }
            ],
            addLog: vi.fn()
        });
    });

    test('renders dashboard correctly with metrics', () => {
        render(<ProveedoresPlugin />);
        
        expect(screen.getByText('Proveedores & Compras')).toBeDefined();
        
        // Debe mostrar el saldo a pagar pendiente únicamente: 10000
        expect(screen.getAllByText('$10000.00').length).toBeGreaterThan(0);
    });

    test('shows providers list correctly', () => {
        render(<ProveedoresPlugin />);
        
        fireEvent.click(screen.getByText('Proveedores'));
        
        expect(screen.getByText('Directorio de Proveedores')).toBeDefined();
        expect(screen.getByText('Distribuidora ABC')).toBeDefined();
    });

    test('shows facturas list correctly', () => {
        render(<ProveedoresPlugin />);
        
        fireEvent.click(screen.getByText('Facturas'));
        
        expect(screen.getByText('Facturas Recibidas')).toBeDefined();
        expect(screen.getByText('0001-00000001')).toBeDefined();
    });

    test('shows pagos list correctly', () => {
        render(<ProveedoresPlugin />);
        
        fireEvent.click(screen.getByText('Pagos'));
        
        expect(screen.getByText('Pagos Emitidos')).toBeDefined();
        // $5000 payment is shown
        expect(screen.getByText('$5000.00')).toBeDefined();
    });
});
