import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FacturasList } from './FacturasList';
import { useDataStore } from '../../hooks/useDataStore';
import { useNotification } from '../../context/NotificationContext';

vi.mock('../../hooks/useDataStore');
vi.mock('../../context/NotificationContext');
vi.mock('firebase/firestore', () => ({
    collection: vi.fn(),
    addDoc: vi.fn(),
    doc: vi.fn(),
    updateDoc: vi.fn(),
    deleteDoc: vi.fn(),
    getFirestore: vi.fn(),
}));

// Mock the file and ocrService
vi.mock('./ocrService', () => ({
    extractFacturaData: vi.fn()
}));

const mockFacturas = [
    { id: '1', proveedorId: 'p1', numero: '0001-00000001', fechaEmision: '2026-04-01', fechaVencimiento: '2026-04-15', total: 1000, saldoPagar: 1000, estado: 'Pendiente' }
];

const mockProveedores = [
    { id: 'p1', nombre: 'Proveedor Test' }
];

describe('FacturasList Component', () => {
    beforeEach(() => {
        (useNotification as any).mockReturnValue({ showNotification: vi.fn() });
        (useDataStore as any).mockReturnValue({
            facturasProveedor: mockFacturas,
            proveedores: mockProveedores
        });
    });

    it('renders the list of facturas', () => {
        render(<FacturasList />);
        expect(screen.getByText('0001-00000001')).toBeDefined();
        expect(screen.getByText('Proveedor Test')).toBeDefined();
    });

    it('opens the add factura modal', async () => {
        render(<FacturasList />);
        const addButton = screen.getByText('+ Ingresar Factura');
        fireEvent.click(addButton);
        expect(screen.getByText('Total ($) *')).toBeDefined(); // Form element
    });

    it('opens the edit factura modal', async () => {
        render(<FacturasList />);
        
        // Find edit buttons (in action column)
        const editButtons = screen.getAllByTitle('Editar');
        fireEvent.click(editButtons[0]);
        
        expect(screen.getByText('Total ($) *')).toBeDefined();
        // and should pre-fill with total 1000 from mockFacturas
        const numberInput = screen.getByDisplayValue('1000') as HTMLInputElement;
        expect(numberInput).toBeDefined();
    });
});
