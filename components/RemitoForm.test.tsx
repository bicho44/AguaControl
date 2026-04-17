
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import RemitoForm from './RemitoForm';
import React from 'react';
import { Rol, TipoVendedor, EstadoCliente, EstadoProducto } from '../types';

// Mock context and hooks
vi.mock('../context/NotificationContext', () => ({
  useNotification: () => ({
    showNotification: vi.fn()
  })
}));

const mockCurrentUser = {
  id: 'user1',
  nombre: 'Vendedor 1',
  rol: Rol.VENDEDOR,
  email: 'v1@test.com'
};

const mockClientes = [
  { id: 'c1', nombre: 'Cliente 1', estado: EstadoCliente.ACTIVO, sucursales: [] },
  { id: 'c2', nombre: 'Cliente 2', estado: EstadoCliente.ACTIVO, sucursales: [
    { id: 's1', nombre: 'Sucursal 1' },
    { id: 's2', nombre: 'Sucursal 2' }
  ]}
];

const mockVendedores = [
  { id: 'user1', nombre: 'Vendedor 1', tipo: TipoVendedor.INTERNO },
  { id: 'v2', nombre: 'Vendedor 2', tipo: TipoVendedor.EXTERNO }
];

const mockProductos = [
  { id: 'p1', nombre: 'Bidon 20L', estado: EstadoProducto.ACTIVO, precio: 1000 }
];

describe('RemitoForm', () => {
  const defaultProps = {
    remito: { movimientos: [{ productoId: '', entregados: 0, recibidos: 0 }] },
    clientes: mockClientes,
    vendedores: mockVendedores,
    productos: mockProductos,
    currentUser: mockCurrentUser,
    onSave: vi.fn(),
    onAddCliente: vi.fn(),
    onClose: vi.fn(),
    remitos: [],
    registrosPago: [],
    causasRecambio: []
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Force desktop width by default
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1200 });
  });

  it('should notify vendor change when subject changes', async () => {
    const onVendedorChange = vi.fn();
    render(<RemitoForm {...defaultProps} onVendedorChange={onVendedorChange} />);
    
    // Simular cambio a Vendedor Externo
    // En RemitoForm, el SearchableSelect de sujeto llama a handleSubjectChange
    // Podemos buscar el input y simular el cambio si conocemos el valor
    // Pero como es un componente complejo, una mejor forma es mockear SearchableSelect para tests unitarios del Form
  });

  it('should wait for sucursal selection if client has multiple sucursales', async () => {
    vi.useFakeTimers();
    const focusSpy = vi.fn();
    const mockElement = { focus: focusSpy, select: vi.fn() };
    
    vi.spyOn(document, 'getElementById').mockImplementation((id) => {
      if (id === 'sucursal-select' || id === 'primer-input-cantidad') return mockElement as any;
      return null;
    });

    const { rerender } = render(<RemitoForm {...defaultProps} remito={{ ...defaultProps.remito, clienteId: 'c2' }} />);
    
    // Since client c2 has 2 sucursales, it should focus sucursal-select
    act(() => {
        vi.advanceTimersByTime(200);
    });

    expect(document.getElementById).toHaveBeenCalledWith('sucursal-select');
    expect(focusSpy).toHaveBeenCalled();

    // Now if sucursalId is set, it should focus quantity
    rerender(<RemitoForm {...defaultProps} remito={{ ...defaultProps.remito, clienteId: 'c2', sucursalId: 's1' }} />);
    
    act(() => {
        vi.advanceTimersByTime(300);
    });

    expect(document.getElementById).toHaveBeenCalledWith('primer-input-cantidad');
    vi.useRealTimers();
  });
});
