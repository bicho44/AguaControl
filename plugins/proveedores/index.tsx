import React from 'react';
import { AppPlugin } from '../types';
import { Rol } from '../../types';
import ProveedoresPlugin from './ProveedoresPlugin';
import { ProveedoresSettings } from './ProveedoresSettings';

const proveedoresPlugin: AppPlugin = {
  id: 'proveedores',
  name: 'Proveedores & Compras',
  label: 'Proveedores',
  icon: (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z" />
    </svg>
  ),
  roles: [Rol.ADMINISTRADOR],
  component: ProveedoresPlugin,
  isEnabled: (settings: any) => settings?.proveedoresConfig?.enabled === true,
  settingsComponent: ProveedoresSettings,
  getCajaMovements: (dataStore: any) => {
    if (!dataStore || !dataStore.pagosProveedor) return [];
    return dataStore.pagosProveedor.map((p: any) => {
      const proveedorStr = dataStore.proveedores?.find((pr: any) => pr.id === p.proveedorId)?.nombre || 'Proveedor';
      return {
        id: p.id,
        fecha: p.fecha,
        type: 'gasto',
        concepto: `${proveedorStr} - Pago a Proveedor${p.observaciones ? ': ' + p.observaciones : ''}`,
        pagos: [{ metodo: p.metodo, monto: p.monto }],
        total: p.monto,
        original: p,
      };
    });
  }
};

export default proveedoresPlugin;
