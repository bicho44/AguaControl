import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DashboardView from './DashboardView';
import { Rol, TipoVendedor, Usuario } from '../types';

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

let mockCurrentUser: Partial<Usuario> = { id: 'test-user', rol: Rol.ADMINISTRADOR };

vi.mock('../context/AuthContext', () => ({
    useAuth: () => ({
        user: mockCurrentUser
    })
}));

vi.mock('../context/NotificationContext', () => ({
    useNotification: () => ({
        showNotification: vi.fn(),
        showError: vi.fn(),
        showSuccess: vi.fn()
    })
}));

vi.mock('../hooks/useDataStore', () => ({
    useDataStore: () => ({
        productos: [],
        usuarios: [],
        remitos: [],
        ventasVendedor: [],
        gastos: [],
        registrosPago: [],
        movimientosPlanta: [],
        contratos: [],
        isLoading: false
    })
}));

const mockAdmin: Usuario = {
    id: 'admin-1',
    rol: Rol.ADMINISTRADOR,
    nombre: 'Admin General',
    tipo: TipoVendedor.INTERNO,
    estado: 'ACTIVO'
};

const mockExternalVendor: Usuario = {
    id: 'vendor-1',
    rol: Rol.REPARTIDOR,
    nombre: 'Ariel Martin',
    tipo: TipoVendedor.EXTERNO,
    estado: 'ACTIVO'
};

const mockInternalVendor: Usuario = {
    id: 'vendor-2',
    rol: Rol.REPARTIDOR,
    nombre: 'Juan Perez',
    tipo: TipoVendedor.INTERNO,
    estado: 'ACTIVO'
};

vi.mock('react-sortablejs', () => ({
    ReactSortable: ({ children }: any) => <div>{children}</div>
}));

const defaultProps = {
    remitos: [],
    productos: [],
    registrosPago: [],
    gastos: [],
    usuarios: [],
    clientes: [],
    ventasVendedor: [],
    empresaSettings: {} as any,
    causasRecambio: [],
    planillas: [],
    movimientosPlanta: [],
    preformas: [],
    moldes: [],
    produccionSoplado: [],
    entregasSoplado: [],
    facturas: [],
    addRemito: vi.fn(),
    addPagoManual: vi.fn(),
    addGasto: vi.fn(),
    addVentaVendedor: vi.fn(),
    addCliente: vi.fn(),
    addPagoToFactura: vi.fn()
};

describe('DashboardView', () => {
    it('renders correct header for Administrador', () => {
        mockCurrentUser = mockAdmin;
        render(<DashboardView {...defaultProps} usuarios={[mockAdmin]} />);
        expect(screen.getByText('Dashboard Operativo')).toBeDefined();
    });

    it('renders correct title in external dashboard', () => {
        mockCurrentUser = mockExternalVendor;
        render(<DashboardView {...defaultProps} usuarios={[mockExternalVendor]} />);
        expect(screen.getByText((content) => content.includes('Cuenta Corriente:'))).toBeDefined();
    });

    it('renders correct header for internal vendor', () => {
        mockCurrentUser = mockInternalVendor;
        render(<DashboardView {...defaultProps} usuarios={[mockInternalVendor]} />);
        expect(screen.getByText((content) => content.includes('Rendimiento:'))).toBeDefined();
    });
});
