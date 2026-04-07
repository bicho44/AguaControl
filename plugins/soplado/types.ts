
import { Rol } from '../../types';

export interface Preforma {
    id: string;
    color: string;
    peso: number; // en gramos
    material: string; // ej: PET
    stockActual: number;
    puntoReposicion: number;
}

export interface Molde {
    id: string;
    nombre: string; // ej: Bidón 5L, Bidón 8L
    litros: number;
    preformaId: string; // La preforma que usa este molde
}

export interface InsumoSoplado {
    id: string;
    nombre: string; // ej: Tapas, Manijas
    stockActual: number;
    puntoReposicion: number;
}

export interface ProduccionSoplado {
    id: string;
    fecha: string;
    moldeId: string;
    cantidadProducida: number;
    merma: number; // descarte
    operadorId: string;
}

export interface EntregaSoplado {
    id: string;
    fecha: string;
    moldeId: string;
    destino: 'PLANTA' | string; // ID del cliente o 'PLANTA'
    cantidad: number;
    insumos?: { insumoId: string; cantidad: number }[];
}

export interface SopladoDashboardSettings {
    enabled?: boolean;
    integratedWithPlant?: boolean;
    dashboardCards?: string[];
    showProductionChart?: boolean;
    showStockAlerts?: boolean;
    showDailyGoals?: boolean;
}
