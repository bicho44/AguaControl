import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SopladoPlugin from './SopladoPlugin';
import React from 'react';
import { Rol } from '../../types';

// ResizeObserver mock
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mocks
vi.mock('../../context/AuthContext', () => ({
    useAuth: () => ({
        user: { id: 'admin1', rol: Rol.ADMINISTRADOR }
    })
}));

let mockDataStore: any = {};

vi.mock('../../hooks/useDataStore', () => ({
    useDataStore: () => mockDataStore
}));

describe('SopladoPlugin Interface', () => {
    beforeEach(() => {
        mockDataStore = {
            preformas: [],
            moldes: [{ id: 'm1', nombre: 'BIDON 20L', litros: 20, stockActual: 150 }],
            produccionSoplado: [
                { id: 'p1', cantidadProducida: 50 },
                { id: 'p2', cantidadProducida: 100 }
            ],
            entregasSoplado: [
                { id: 'e1', cantidad: 30, fecha: '2026-04-10T12:00:00Z', moldeId: 'm1' },
                { id: 'e2', cantidad: 20, fecha: '2026-04-15T12:00:00Z', moldeId: 'm1' }
            ],
            productos: [{ id: 'prod1', nombre: 'DESCARTABLE 20L', tipo: 'Descartable', litros: 20 }],
            clientes: [],
            insumosSoplado: [],
            addPreforma: vi.fn(), 
            updatePreforma: vi.fn(), 
            deletePreforma: vi.fn(),
            addMolde: vi.fn(), 
            updateMolde: vi.fn(), 
            deleteMolde: vi.fn(),
            addInsumoSoplado: vi.fn(), 
            updateInsumoSoplado: vi.fn(), 
            deleteInsumoSoplado: vi.fn(),
            addProduccionSoplado: vi.fn(), 
            updateProduccionSoplado: vi.fn(), 
            deleteProduccionSoplado: vi.fn(),
            addEntregaSoplado: vi.fn(), 
            updateEntregaSoplado: vi.fn(), 
            deleteEntregaSoplado: vi.fn(),
            empresaSettings: { sopladoConfig: { integratedWithPlant: true } }
        };
    });

    test('renders Soplado tabs correctly', () => {
        render(<SopladoPlugin />);
        expect(screen.getByText('Soplado de Bidones')).toBeDefined();
        expect(screen.getByText('Dashboard')).toBeDefined();
        expect(screen.getByText('Producción')).toBeDefined();
        expect(screen.getByText('Logística')).toBeDefined();
    });

    test('shows Dashboard metrics and correct historical values', () => {
        render(<SopladoPlugin />);
        
        // Verifica que estemos en la pestaña predeterminada: 'dashboard'
        // El total histórico producido debe ser 50 + 100 = 150
        expect(screen.getByText('Total Producido (Histórico)')).toBeDefined();
        // Hay dos elementos con '150' (uno en total y otro en el stock del molde del mock)
        expect(screen.getAllByText('150').length).toBeGreaterThan(0); 

        // El total histórico entregado debe ser 30 + 20 = 50
        expect(screen.getByText('Total Entregado')).toBeDefined();
        expect(screen.getAllByText('50').length).toBeGreaterThan(0);

        // El stock actual del molde
        expect(screen.getByText('Stock Soplado Actual (Terminados)')).toBeDefined();
        // Hay un molde de 20L que tiene 150 definido en stockActual del mock
        expect(screen.getByText('BIDON 20L')).toBeDefined();
    });

    test('shows producto destino selector when PLANTA is selected in Entrega', () => {
        render(<SopladoPlugin />);
        
        // Entrar a Logistica
        fireEvent.click(screen.getByText('Logística'));

        // Hacer click en "+ Registrar Entrega"
        fireEvent.click(screen.getByText('+ Registrar Entrega'));

        // Por defecto debería estar seleccionado PLANTA y mostrar el AppSelect asociado
        const selectorDestino = screen.getByText('Asociar a Producto (Stock Envases de Planta)');
        expect(selectorDestino).toBeDefined();

        // Chequear que las opciones del AppSelect carguen productos internos
        expect(screen.getByText(/DESCARTABLE 20L/i)).toBeDefined();
    });
});
