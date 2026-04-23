import { describe, expect, test } from 'vitest';
import { 
    calculateInsumoStockUpdates, 
    calculateInsumoStockReversions,
    calculateProduccionSubmits,
    calculateEntregaMoldeUpdates,
    calculateEntregaPlantaUpdates
} from './sopladoUtils';
import { EntregaSoplado, InsumoSoplado, ProduccionSoplado, Molde } from './types';
import { Producto, EstadoProducto } from '../../types';

describe('Soplado Logic: Insumos Stock', () => {
    test('calculateInsumoStockUpdates deducciones correctas con strings y numbers', () => {
        const entrega: Omit<EntregaSoplado, 'id'> = {
            fecha: '2026-04-21',
            moldeId: '1',
            destino: 'CLIENTE',
            cantidad: 100,
            insumos: [
                { insumoId: 'ins1', cantidad: 50 },
                { insumoId: 'ins2', cantidad: '20' as any } // Simulating dirty UI input
            ]
        };

        const currentInsumos: InsumoSoplado[] = [
            { id: 'ins1', nombre: 'Tapa', stockActual: 1000, puntoReposicion: 100 },
            { id: 'ins2', nombre: 'Manija', stockActual: '500' as any, puntoReposicion: 50 }, // Simulating dirty DB
            { id: 'ins3', nombre: 'Etiqueta', stockActual: 300, puntoReposicion: 10 }
        ];

        const updates = calculateInsumoStockUpdates(entrega, currentInsumos);

        expect(updates).toHaveLength(2);
        
        const update1 = updates.find(u => u.id === 'ins1');
        expect(update1?.newStock).toBe(950); // 1000 - 50

        const update2 = updates.find(u => u.id === 'ins2');
        expect(update2?.newStock).toBe(480); // 500 - 20
    });


    test('calculateInsumoStockReversions devoluciones correctas con strings y numbers', () => {
        const entrega: EntregaSoplado = {
            id: 'ent1',
            fecha: '2026-04-21',
            moldeId: '1',
            destino: 'CLIENTE',
            cantidad: 100,
            insumos: [
                { insumoId: 'ins1', cantidad: 50 },
                { insumoId: 'ins2', cantidad: '20' as any }
            ]
        };

        const currentInsumos: InsumoSoplado[] = [
            { id: 'ins1', nombre: 'Tapa', stockActual: 950, puntoReposicion: 100 },
            { id: 'ins2', nombre: 'Manija', stockActual: '480' as any, puntoReposicion: 50 }
        ];

        const updates = calculateInsumoStockReversions(entrega, currentInsumos);

        expect(updates).toHaveLength(2);
        
        const update1 = updates.find(u => u.id === 'ins1');
        expect(update1?.newStock).toBe(1000); // 950 + 50

        const update2 = updates.find(u => u.id === 'ins2');
        expect(update2?.newStock).toBe(500); // 480 + 20
    });
});

describe('Soplado Logic: Produccion y Logistica', () => {
    test('calculateProduccionSubmits suma el stock terminado de bidones', () => {
        const prod: Omit<ProduccionSoplado, 'id'> = {
            fecha: '2026-04-22',
            moldeId: 'molde-12',
            cantidadProducida: 250,
            merma: 5,
            operadorId: 'op1'
        };

        const moldes: Molde[] = [
            { id: 'molde-12', nombre: 'Bidón 12L', litros: 12, preformaId: 'pref-A', stockActual: 100 }
        ];

        const result = calculateProduccionSubmits(prod, moldes);
        
        expect(result?.moldeId).toBe('molde-12');
        expect(result?.newStock).toBe(350); // 100 + 250
        expect(result?.preformaId).toBe('pref-A');
    });

    test('calculateEntregaMoldeUpdates resta el stock de soplado al entregar', () => {
        const entrega: Omit<EntregaSoplado, 'id'> = {
            fecha: '2026-04-22',
            moldeId: 'molde-12',
            destino: 'CLIENTE',
            cantidad: 50
        };

        const moldes: Molde[] = [
            { id: 'molde-12', nombre: 'Bidón 12L', litros: 12, preformaId: 'pref-A', stockActual: 350 }
        ];

        const result = calculateEntregaMoldeUpdates(entrega, moldes);
        
        expect(result?.newStock).toBe(300); // 350 - 50
    });

    test('calculateEntregaPlantaUpdates impacta el producto interno en PLANTA asumiendo envases', () => {
        const entrega: Omit<EntregaSoplado, 'id'> = {
            fecha: '2026-04-22',
            moldeId: 'molde-12',
            destino: 'PLANTA',
            productoDestinoId: 'prod-desc-12',
            cantidad: 50
        };

        const productos: Producto[] = [
            { id: 'prod-desc-12', nombre: 'Bidón Descartable 12L', tipo: 'Descartable', litros: 12, precio: 0, estado: EstadoProducto.ACTIVO, stockEnvases: 1000 }
        ];

        const result = calculateEntregaPlantaUpdates(entrega, productos);
        
        expect(result?.productoId).toBe('prod-desc-12');
        expect(result?.newStockEnvases).toBe(1050); // 1000 + 50
    });
});
