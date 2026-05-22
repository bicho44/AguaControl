import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PedidosPluginView from './PedidosPluginView';
import { NotificationProvider } from '../../context/NotificationContext';
import PedidosDashboardWidget from './PedidosDashboardWidget';

describe('Gestión de Pedidos Plugin', () => {
    it('Renderiza la vista principal de carga de pedidos', () => {
        const mockDataStore = {
            clientes: [],
            productos: [],
            pedidos: [],
            addPedido: vi.fn(),
            updatePedido: vi.fn(),
            deletePedido: vi.fn(),
        };

        render(
            <NotificationProvider>
                <PedidosPluginView dataStore={mockDataStore} />
            </NotificationProvider>
        );
        expect(screen.getByText(/Toma de Pedidos/i)).toBeInTheDocument();
    });

    it('Muestra los pedidos pendientes en el Dashboard Widget', () => {
        const mockDataStore = {
            clientes: [{ id: 'c1', nombre: 'Juan Perez' }],
            productos: [{ id: 'p1', nombre: 'Bidon 20L', precio: 1000 }],
            pedidos: [{
                id: '1',
                fechaCreacion: '2023-10-01',
                fechaEsperada: '2023-10-05',
                clienteId: 'c1',
                estado: 'PENDIENTE',
                pagado: true,
                montoTotal: 2000,
                productos: [{ productoId: 'p1', cantidad: 2, precioUnitario: 1000 }]
            }]
        };

        render(<PedidosDashboardWidget dataStore={mockDataStore} />);
        
        expect(screen.getByText('Juan Perez')).toBeInTheDocument();
        expect(screen.getByText('Entrega Estimada: 5/10/2023')).toBeInTheDocument();
        expect(screen.getByText(/Pagado/i)).toBeInTheDocument();
    });

    it('Carga un nuevo pedido correctamente', async () => {
        const mockDataStore = {
            clientes: [{ id: 'c1', nombre: 'Juan Perez', estado: 'Activo' }],
            productos: [{ id: 'p1', nombre: 'Bidon 20L', precio: 1000, estado: 'Activo' }],
            pedidos: [],
            addPedido: vi.fn().mockResolvedValue(undefined),
            updatePedido: vi.fn(),
            deletePedido: vi.fn(),
        };

        render(
            <NotificationProvider>
                <PedidosPluginView dataStore={mockDataStore} />
            </NotificationProvider>
        );
        
        // Open modal
        fireEvent.click(screen.getByText(/Nuevo Pedido/i));
        
        // El cliente
        const selects = screen.getAllByPlaceholderText('Seleccionar...'); 
        const selectCliente = selects[0];
        fireEvent.change(selectCliente, { target: { value: 'Juan Perez' } }); // En nuestro SearchableSelect, se tipea
        fireEvent.click(screen.getByText('Juan Perez')); // Y luego se clickea la opción (si es que renderiza asi)
        
        // Agregamos un producto estimado
        fireEvent.click(screen.getByText('+ Agregar Producto Estimado'));
        
        // Wait for product select to appear
        const newSelects = screen.getAllByPlaceholderText('Seleccionar...');
        const selectProducto = newSelects[1];
        fireEvent.change(selectProducto, { target: { value: 'Bidon 20L' } });
        fireEvent.click(screen.getByText('Bidon 20L'));

        // Submit form
        fireEvent.click(screen.getByText(/Guardar Pedido/i));

        await waitFor(() => {
            expect(mockDataStore.addPedido).toHaveBeenCalled();
        });
        
        // Check addPedido arguments
        const addPedidoCall = mockDataStore.addPedido.mock.calls[0];
        expect(addPedidoCall[0].clienteId).toBe('c1');
        // El precio unitario es 1000, la cantida es 1, total: 1000
        expect(addPedidoCall[0].montoTotal).toBe(1000);
        expect(addPedidoCall[0].productos[0].productoId).toBe('p1');
    });
});
