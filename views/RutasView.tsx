
import React, { useState, useMemo } from 'react';
import { Cliente, Usuario, Rol, DiaSemana, TipoVendedor } from '../types';
import Card from '../components/Card';
import AppButton from '../components/ui/AppButton';
import AppInput from '../components/ui/AppInput';
import { SearchIcon } from '../components/icons/SearchIcon';
import { useNotification } from '../context/NotificationContext';

interface RutasViewProps {
  clientes: Cliente[];
  usuarios: Usuario[];
  updateRutasMasivo: (updates: { clienteId: string, sucursalId: string, dia: DiaSemana, repartidorId: string | null }[]) => Promise<void>;
}

// Helper para obtener las iniciales del repartidor
const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
};

const RutasView: React.FC<RutasViewProps> = ({ clientes, usuarios, updateRutasMasivo }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRepartidorId, setSelectedRepartidorId] = useState<string>('');
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set()); // IDs compuestos "clienteId_sucursalId"
  const [isSaving, setIsSaving] = useState(false);
  const { showNotification } = useNotification();

  const repartidores = useMemo(() => usuarios.filter(u => u.rol === Rol.REPARTIDOR), [usuarios]);
  const diasOrdenados = [DiaSemana.LUNES, DiaSemana.MARTES, DiaSemana.MIERCOLES, DiaSemana.JUEVES, DiaSemana.VIERNES, DiaSemana.SABADO];

  // Aplanar la estructura Cliente -> Sucursales para mostrar en tabla
  const flatRows = useMemo(() => {
      const rows: { 
          id: string, 
          clienteId: string, 
          clienteNombre: string, 
          sucursalId: string, 
          sucursalNombre: string, 
          direccion: string, 
          dias: Record<string, string | null> // Mapa Dia -> RepartidorId (o null)
      }[] = [];

      clientes.forEach(c => {
          if (c.estado === 'Inactivo') return;
          c.sucursales.forEach(s => {
              // Construir mapa de días
              const diasMap: Record<string, string | null> = {};
              diasOrdenados.forEach(d => {
                  // Prioridad: 1. repartidoresPorDia, 2. diasReparto (legacy, usa el primer repartidor disponible)
                  if (s.repartidoresPorDia && s.repartidoresPorDia[d]) {
                      diasMap[d] = s.repartidoresPorDia[d];
                  } else if (s.diasReparto?.includes(d)) {
                      // Fallback legacy: si está marcado el día pero no tiene repartidor asignado, asumimos el primero de la lista (o null visualmente)
                      diasMap[d] = repartidores.length > 0 ? repartidores[0].id : 'unknown'; 
                  } else {
                      diasMap[d] = null;
                  }
              });

              rows.push({
                  id: `${c.id}_${s.id}`,
                  clienteId: c.id,
                  clienteNombre: c.nombre,
                  sucursalId: s.id,
                  sucursalNombre: s.nombre,
                  direccion: s.direccion,
                  dias: diasMap
              });
          });
      });

      return rows.filter(r => 
          r.clienteNombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
          r.direccion.toLowerCase().includes(searchTerm.toLowerCase())
      );
  }, [clientes, repartidores, searchTerm]);

  // Selección automática del primer repartidor si no hay ninguno seleccionado
  React.useEffect(() => {
      if (!selectedRepartidorId && repartidores.length > 0) {
          setSelectedRepartidorId(repartidores[0].id);
      }
  }, [repartidores, selectedRepartidorId]);

  const handleCellClick = (rowId: string, dia: DiaSemana, currentDriverId: string | null) => {
      // Toggle logic: 
      // Si la celda está vacía -> Asignar repartidor seleccionado.
      // Si la celda tiene ALGUN repartidor -> Vaciarla (Desasignar día).
      const newDriverId = currentDriverId ? null : selectedRepartidorId;
      
      const [clienteId, sucursalId] = rowId.split('_');
      
      // Actualización atómica inmediata
      handleBulkUpdate([{ clienteId, sucursalId, dia, repartidorId: newDriverId }]);
  };

  const handleBulkUpdate = async (updates: { clienteId: string, sucursalId: string, dia: DiaSemana, repartidorId: string | null }[]) => {
      setIsSaving(true);
      try {
          await updateRutasMasivo(updates);
          // showNotification('Ruta actualizada', 'success'); // Muy ruidoso si es click a click
      } catch (e) {
          showNotification('Error al actualizar', 'error');
      } finally {
          setIsSaving(false);
      }
  };

  const handleMassAssignDay = (dia: DiaSemana) => {
      if (selectedRows.size === 0) return;
      const updates: any[] = [];
      
      selectedRows.forEach(rowId => {
          const [clienteId, sucursalId] = rowId.split('_');
          updates.push({ clienteId, sucursalId, dia, repartidorId: selectedRepartidorId });
      });

      handleBulkUpdate(updates);
      showNotification(`Asignado ${dia} a ${selectedRows.size} sucursales`, 'success');
      setSelectedRows(new Set()); // Limpiar selección
  };

  const handleMassRemoveDay = (dia: DiaSemana) => {
      if (selectedRows.size === 0) return;
      const updates: any[] = [];
      
      selectedRows.forEach(rowId => {
          const [clienteId, sucursalId] = rowId.split('_');
          updates.push({ clienteId, sucursalId, dia, repartidorId: null });
      });

      handleBulkUpdate(updates);
      showNotification(`Removido ${dia} de ${selectedRows.size} sucursales`, 'success');
      setSelectedRows(new Set());
  };

  const toggleRowSelection = (rowId: string) => {
      const newSet = new Set(selectedRows);
      if (newSet.has(rowId)) newSet.delete(rowId);
      else newSet.add(rowId);
      setSelectedRows(newSet);
  };

  const toggleAllRows = () => {
      if (selectedRows.size === flatRows.length) setSelectedRows(new Set());
      else setSelectedRows(new Set(flatRows.map(r => r.id)));
  };

  return (
    <div className="space-y-6 pt-12 md:pt-0 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h1 className="text-3xl font-black text-gray-800 dark:text-white uppercase tracking-tighter italic">Matriz de Rutas</h1>
            <p className="text-sm text-gray-500">Asigna días y repartidores de forma masiva.</p>
        </div>
        
        {/* Selector de Repartidor Activo (Contexto) */}
        <div className="bg-white dark:bg-gray-800 p-2 rounded-xl shadow-sm border border-primary-200 dark:border-primary-900 flex items-center gap-3">
            <span className="text-[10px] font-black uppercase text-gray-400 pl-2">Repartidor Activo:</span>
            <div className="flex gap-1">
                {repartidores.map(rep => (
                    <button
                        key={rep.id}
                        onClick={() => setSelectedRepartidorId(rep.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                            selectedRepartidorId === rep.id 
                            ? 'bg-primary-600 text-white shadow-md scale-105' 
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
                        }`}
                    >
                        <div className={`w-2 h-2 rounded-full ${selectedRepartidorId === rep.id ? 'bg-white' : 'bg-gray-400'}`}></div>
                        {rep.nombre}
                    </button>
                ))}
            </div>
        </div>
      </div>

      <Card>
        {/* Filtros */}
        <div className="p-4 border-b dark:border-gray-700">
            <div className="relative">
                <AppInput 
                    placeholder="Buscar por cliente, dirección o barrio..." 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)} 
                    className="pl-10"
                />
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pt-6 pointer-events-none">
                    <SearchIcon className="h-5 w-5 text-gray-400" />
                </div>
            </div>
        </div>

        {/* Tabla Matriz */}
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
                <thead className="text-[10px] uppercase bg-gray-50 dark:bg-gray-700 text-gray-500 font-black tracking-widest sticky top-0 z-10">
                    <tr>
                        <th className="p-4 w-10 text-center border-r dark:border-gray-600">
                            <input type="checkbox" checked={flatRows.length > 0 && selectedRows.size === flatRows.length} onChange={toggleAllRows} className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                        </th>
                        <th className="p-4 border-r dark:border-gray-600 min-w-[200px]">Cliente / Sucursal</th>
                        {diasOrdenados.map(dia => (
                            <th key={dia} className="p-2 text-center border-r dark:border-gray-600 min-w-[60px]">{dia.substring(0,3)}</th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {flatRows.map(row => (
                        <tr key={row.id} className={`hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${selectedRows.has(row.id) ? 'bg-blue-50 dark:bg-blue-900/10' : ''}`}>
                            <td className="p-4 text-center border-r dark:border-gray-700">
                                <input type="checkbox" checked={selectedRows.has(row.id)} onChange={() => toggleRowSelection(row.id)} className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                            </td>
                            <td className="p-4 border-r dark:border-gray-700">
                                <div className="font-bold text-gray-900 dark:text-white">{row.clienteNombre}</div>
                                <div className="text-xs text-gray-500 flex items-center gap-1">
                                    <span className="bg-gray-100 dark:bg-gray-700 px-1.5 rounded text-[9px] uppercase">{row.sucursalNombre}</span>
                                    <span className="truncate max-w-[200px]">{row.direccion}</span>
                                </div>
                            </td>
                            {diasOrdenados.map(dia => {
                                const assignedDriverId = row.dias[dia];
                                const assignedDriver = repartidores.find(r => r.id === assignedDriverId);
                                const isAssigned = !!assignedDriverId;
                                
                                return (
                                    <td 
                                        key={dia} 
                                        onClick={() => handleCellClick(row.id, dia, assignedDriverId)}
                                        className={`p-2 text-center border-r dark:border-gray-700 cursor-pointer select-none transition-all duration-200 hover:bg-gray-200 dark:hover:bg-gray-600 ${isAssigned ? 'bg-green-50 dark:bg-green-900/20' : ''}`}
                                    >
                                        {isAssigned ? (
                                            <div className="flex flex-col items-center justify-center">
                                                <div 
                                                    className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black text-white shadow-sm"
                                                    style={{ backgroundColor: assignedDriverId === selectedRepartidorId ? '#2563eb' : '#9ca3af' }} // Azul si coincide con el seleccionado, Gris si es otro
                                                    title={assignedDriver?.nombre || 'Desconocido'}
                                                >
                                                    {assignedDriver ? getInitials(assignedDriver.nombre) : '?'}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="w-8 h-8 mx-auto rounded-full border-2 border-dashed border-gray-200 dark:border-gray-600"></div>
                                        )}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
            {flatRows.length === 0 && <div className="p-8 text-center text-gray-400 text-sm font-bold uppercase">No se encontraron sucursales</div>}
        </div>
      </Card>

      {/* Footer de Acciones Masivas (Sticky) */}
      {selectedRows.size > 0 && (
          <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white p-4 rounded-2xl shadow-2xl z-50 flex items-center gap-6 animate-fade-in-up border border-gray-700">
              <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">{selectedRows.size} Sucursales Seleccionadas</span>
                  <span className="font-bold text-sm">Aplicar al Repartidor: <span className="text-primary-400">{repartidores.find(r => r.id === selectedRepartidorId)?.nombre}</span></span>
              </div>
              <div className="h-8 w-px bg-gray-700"></div>
              <div className="flex gap-2">
                  {diasOrdenados.map(dia => (
                      <button 
                        key={dia} 
                        onClick={() => handleMassAssignDay(dia)}
                        className="px-3 py-1.5 bg-gray-800 hover:bg-primary-600 rounded-lg text-xs font-bold transition-colors border border-gray-600 hover:border-primary-500"
                        title={`Asignar ${dia} a la selección`}
                      >
                          {dia.substring(0,1)}
                      </button>
                  ))}
              </div>
              <div className="h-8 w-px bg-gray-700"></div>
              <button onClick={() => setSelectedRows(new Set())} className="text-xs text-red-400 hover:text-red-300 font-bold uppercase">Cancelar</button>
          </div>
      )}
    </div>
  );
};

export default RutasView;
