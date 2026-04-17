
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import RemitoForm from './RemitoForm';
import React from 'react';
import { Rol, EstadoCliente, TipoVendedor } from '../types';

// Mock Notification Context
vi.mock('../context/NotificationContext', () => ({
    useNotification: () => ({
        showNotification: vi.fn()
    })
}));

const mockProps = {
    remito: { movimientos: [], pagos: [] },
    clientes: [
        { 
            id: 'c1', 
            nombre: 'Cliente 1', 
            estado: EstadoCliente.ACTIVO, 
            sucursales: [
                { id: 's1', nombre: 'Sucursal A', direccion: 'Dir A', diasReparto: [] },
                { id: 's2', nombre: 'Sucursal B', direccion: 'Dir B', diasReparto: [] }
            ],
            telefonos: []
        }
    ],
    vendedores: [
        { id: 'v1', nombre: 'Vendedor 1', rol: Rol.VENDEDOR, tipo: TipoVendedor.INTERNO }
    ],
    productos: [
        { id: 'p1', nombre: 'Producto 1', precio: 100, precioReventa: 80, stock: 10, estado: 'ACTIVO' as any }
    ],
    currentUser: { id: 'u1', nombre: 'Admin', rol: Rol.ADMINISTRADOR, email: 'admin@test.com' } as any,
    onSave: vi.fn(),
    onAddCliente: vi.fn(),
    onClose: vi.fn(),
    remitos: [],
    registrosPago: [],
    causasRecambio: []
};

describe('RemitoForm Focus Management', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Mock window.innerWidth for desktop
        Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1200 });
    });

    it('should focus client select on mount (Desktop)', async () => {
        render(<RemitoForm {...mockProps} />);
        
        await waitFor(() => {
            const clientSelect = document.getElementById('client-select');
            expect(document.activeElement).toBe(clientSelect);
        }, { timeout: 2000 });
    });

    it('should NOT auto-focus on mobile', async () => {
        Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 500 });
        render(<RemitoForm {...mockProps} />);
        
        const clientSelect = document.getElementById('client-select');
        await new Promise(r => setTimeout(r, 500));
        expect(document.activeElement).not.toBe(clientSelect);
    });
});
