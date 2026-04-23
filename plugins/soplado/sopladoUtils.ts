import { EntregaSoplado, InsumoSoplado, Molde, ProduccionSoplado } from './types';
import { Producto } from '../../types';

export const calculateInsumoStockUpdates = (entrega: Omit<EntregaSoplado, 'id'>, currentInsumos: InsumoSoplado[]) => {
    const updates: { id: string; newStock: number }[] = [];
    
    if (entrega.insumos && entrega.insumos.length > 0) {
        entrega.insumos.forEach(insumoEntrega => {
            const insumoDb = currentInsumos.find(i => i.id === insumoEntrega.insumoId);
            if (insumoDb) {
                const currentStock = Number(insumoDb.stockActual) || 0;
                const cantidadADescontar = Number(insumoEntrega.cantidad) || 0;
                updates.push({
                    id: insumoDb.id,
                    newStock: currentStock - cantidadADescontar
                });
            }
        });
    }
    
    return updates;
};

export const calculateInsumoStockReversions = (entrega: EntregaSoplado, currentInsumos: InsumoSoplado[]) => {
    const updates: { id: string; newStock: number }[] = [];
    
    if (entrega.insumos && entrega.insumos.length > 0) {
        entrega.insumos.forEach(insumoEntrega => {
            const insumoDb = currentInsumos.find(i => i.id === insumoEntrega.insumoId);
            if (insumoDb) {
                const currentStock = Number(insumoDb.stockActual) || 0;
                const cantidadAReportar = Number(insumoEntrega.cantidad) || 0;
                updates.push({
                    id: insumoDb.id,
                    newStock: currentStock + cantidadAReportar
                });
            }
        });
    }
    
    return updates;
};

export const calculateProduccionSubmits = (
    prod: Omit<ProduccionSoplado, 'id'>, 
    moldes: Molde[]
) => {
    const molde = moldes.find(m => m.id === prod.moldeId);
    if (!molde) return null;

    const currentStock = Number(molde.stockActual) || 0;
    const cantidadForm = Number(prod.cantidadProducida) || 0;

    return {
        moldeId: molde.id,
        newStock: currentStock + cantidadForm,
        preformaId: molde.preformaId
    };
};

export const calculateProduccionReversions = (
    prod: ProduccionSoplado, 
    moldes: Molde[]
) => {
    const molde = moldes.find(m => m.id === prod.moldeId);
    if (!molde) return null;

    const currentStock = Number(molde.stockActual) || 0;
    const cantidadForm = Number(prod.cantidadProducida) || 0;

    return {
        moldeId: molde.id,
        newStock: currentStock - cantidadForm,
        preformaId: molde.preformaId
    };
};

export const calculateEntregaMoldeUpdates = (
    entrega: Omit<EntregaSoplado, 'id'>,
    moldes: Molde[]
) => {
    const molde = moldes.find(m => m.id === entrega.moldeId);
    if (!molde) return null;

    const currentStock = Number(molde.stockActual) || 0;
    const cantidadForm = Number(entrega.cantidad) || 0;

    return {
        moldeId: molde.id,
        newStock: currentStock - cantidadForm
    };
};

export const calculateEntregaMoldeReversions = (
    entrega: EntregaSoplado,
    moldes: Molde[]
) => {
    const molde = moldes.find(m => m.id === entrega.moldeId);
    if (!molde) return null;

    const currentStock = Number(molde.stockActual) || 0;
    const cantidadForm = Number(entrega.cantidad) || 0;

    return {
        moldeId: molde.id,
        newStock: currentStock + cantidadForm
    };
};

export const calculateEntregaPlantaUpdates = (
    entrega: Omit<EntregaSoplado, 'id'>,
    productos: Producto[]
) => {
    if (entrega.destino !== 'PLANTA' || !entrega.productoDestinoId) return null;

    const producto = productos.find(p => p.id === entrega.productoDestinoId);
    if (!producto) return null;

    const currentStockEnvases = Number(producto.stockEnvases) || 0;
    const cantidadForm = Number(entrega.cantidad) || 0;

    return {
        productoId: producto.id,
        newStockEnvases: currentStockEnvases + cantidadForm
    };
};

export const calculateEntregaPlantaReversions = (
    entrega: EntregaSoplado,
    productos: Producto[]
) => {
    if (entrega.destino !== 'PLANTA' || !entrega.productoDestinoId) return null;

    const producto = productos.find(p => p.id === entrega.productoDestinoId);
    if (!producto) return null;

    const currentStockEnvases = Number(producto.stockEnvases) || 0;
    const cantidadForm = Number(entrega.cantidad) || 0;

    return {
        productoId: producto.id,
        newStockEnvases: currentStockEnvases - cantidadForm
    };
};
