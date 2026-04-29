import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OjoMagicoArea } from './OjoMagicoArea';
import { useDataStore } from '../../hooks/useDataStore';
import { useNotification } from '../../context/NotificationContext';
import * as ocrService from './ocrService';

vi.mock('../../hooks/useDataStore');
vi.mock('../../context/NotificationContext');
vi.mock('firebase/firestore', () => ({
    collection: vi.fn(),
    addDoc: vi.fn().mockResolvedValue({ id: 'new_doc_id' }),
    doc: vi.fn(),
    updateDoc: vi.fn(),
    deleteDoc: vi.fn(),
    getFirestore: vi.fn(),
}));

vi.mock('./ocrService', () => ({
    extractFacturaData: vi.fn()
}));

describe('OjoMagicoArea Component', () => {
    beforeEach(() => {
        (useNotification as any).mockReturnValue({ showNotification: vi.fn() });
        (useDataStore as any).mockReturnValue({
            proveedores: [{ id: 'p1', nombre: 'Test Proveedor', cuit: '30-12345678-9' }],
            clientes: [],
            facturasProveedor: []
        });
    });

    it('renders correctly', () => {
        render(<OjoMagicoArea />);
        expect(screen.getByText(/Ojo Mágico \(Drag \& Drop\)/i)).toBeDefined();
    });

    it('shows loading state and triggers parsing on drop', async () => {
        const mockExtract = vi.mocked(ocrService.extractFacturaData).mockResolvedValue({
            numero: '123',
            total: 1000,
            proveedorCuit: '30-12345678-9'
        });

        const { container } = render(<OjoMagicoArea />);
        
        const fileInput = container.querySelector('input[type="file"]')!;
        
        // Mock FileReader
        class MockFileReader {
            onload: any;
            readAsDataURL() {
                setTimeout(() => {
                    if (this.onload) this.onload({ target: { result: 'data:image/png;base64,dummy' } });
                }, 10);
            }
        }
        vi.stubGlobal('FileReader', MockFileReader);

        const file = new File(['dummy'], 'test.png', { type: 'image/png' });
        
        fireEvent.change(fileInput, {
            target: { files: [file] }
        });

        await waitFor(() => {
            expect(screen.getByText(/Analizando factura/i)).toBeDefined();
        });

        await waitFor(() => {
            expect(mockExtract).toHaveBeenCalled();
        });
    });
});
