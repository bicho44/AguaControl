
import React from 'react';
import { AppPlugin } from './types';
import { Rol } from '../types';
import NotesPlugin from './notes/NotesPlugin';
import SopladoPlugin from './soplado/SopladoPlugin';

// Aquí registramos los plugins activos
export const plugins: AppPlugin[] = [
  {
    id: 'notes',
    name: 'Notas Rápidas',
    label: 'Notas',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
    roles: [Rol.ADMINISTRADOR, Rol.REPARTIDOR],
    component: NotesPlugin
  },
  {
    id: 'soplado',
    name: 'Soplado de Bidones',
    label: 'Soplado',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
      </svg>
    ),
    roles: [Rol.ADMINISTRADOR, Rol.SOPLADOR],
    component: SopladoPlugin
  }
];

export default plugins;
