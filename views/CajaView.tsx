import React, { useState, useMemo, useEffect } from 'react';
import { RegistroPago, Gasto, Cliente, Usuario, Remito, VentaVendedor, PagoDetalle, MetodoPago, Factura } from '../types';
import Card from '../components/Card';
import Modal from '../components/Modal';
import { PencilIcon } from '../components/icons/PencilIcon';
import { TrashIcon } from '../components/icons/TrashIcon';
import { ChevronDownIcon } from '../components/icons/ChevronDownIcon';
import { useNotification } from '../context/NotificationContext';
import SearchableSelect from '../components/SearchableSelect';

interface CajaViewProps {
  registrosPago: RegistroPago[];
  gastos: Gasto[];
  clientes: Cliente[];
  vendedores: Usuario[];
  remitos: Remito[];
  facturas: Factura[];
  ventasVendedor: VentaVendedor[];
  addPagoManual: (pagoData: {
    fecha: string;
    clienteId?: string;
    vendedorId?: string;
    concepto?: string;
    pagos: PagoDetalle[];
  }) => void;
  addGasto: (gasto: Omit<Gasto, 'id'>) => void;
  updateRegistroPago: (updatedPago: RegistroPago) => void;
  updateGasto: (updatedGasto: Gasto) => void;
  deleteRegistroPago: (pagoId: string) => void;
  deleteGasto: (gastoId: string) => void;
  updateRemito: (remito: Remito & { pagos?: PagoDetalle[] }) => void;
  updateVentaVendedor: (venta: VentaVendedor & { pagos?: PagoDetalle[] }) => void;
}

interface CombinedMovement {
  id: string;
  fecha: string;
  type: 'ingreso' | 'gasto';
  concepto: string;
  pagos: PagoDetalle[];
  total: number;
  original: Gasto | RegistroPago[];
}

// Combined form for creating/editing both Incomes (RegistroPago) and Expenses (Gasto)
const MovimientoCajaForm: React.FC<{
  movimiento: Partial<Gasto> | Partial<RegistroPago> | { pagos: PagoDetalle[], fecha: string, concepto?: string };
  type: 'ingreso' | 'gasto';
  clientes: Cliente[];
  vendedores: Usuario[];
  onSave: (data: any) => void;
  onClose: () => void;
  isEdit: boolean;
  contextText?: string;
}> = ({ movimiento, type, onSave, onClose, isEdit, contextText, clientes, vendedores }) => {
  const [formData, setFormData] = useState<any>(movimiento);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev: any) => ({ ...prev, [name]: value }));
  };

  const handlePagoChange = (index: number, field: keyof PagoDetalle, value: string | MetodoPago) => {
    const newPagos = [...(formData.pagos || [])];
    const updatedValue = field === 'monto' ? (value === '' ? 0 : Number(value)) : value;
    newPagos[index] = { ...newPagos[index], [field]: updatedValue };
    setFormData((prev: any) => ({ ...prev, pagos: newPagos }));
  };

  const addPago = () => {
    setFormData((prev: any) => ({ ...prev, pagos: [...(prev.pagos || []), { monto: 0, metodo: MetodoPago.EFECTIVO }] }));
  };

  const removePago = (index: number) => {
    setFormData((prev: any) => ({ ...prev, pagos: prev.pagos?.filter((_: any, i: number) => i !== index) }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const title = isEdit 
    ? `Editar ${type === 'ingreso' ? 'Ingreso' : 'Gasto'}`
    : `Registrar ${type === 'ingreso' ? 'Ingreso' : 'Gasto'}`;

  const clienteOptions = useMemo(() => clientes.map(c => ({ value: c.id, label: c.nombre })), [clientes]);
  const vendedorOptions = useMemo(() => vendedores.map(v => ({ value: v.id, label: v.nombre })), [vendedores]);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-white">{title}</h2>
      {contextText && <p className="text-sm p-2 bg-blue-100 dark:bg-blue-900/50 rounded-md text-blue-800 dark:text-blue-200">{contextText}</p>}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <input type="date" name="fecha" value={formData.fecha || ''} onChange={handleChange} className="w-full p-2 bg-gray-200 dark:bg-gray-700 rounded-md" required />
        <input type="text" name="concepto" placeholder="Concepto" value={formData.concepto || ''} onChange={handleChange} className="w-full p-2 bg-gray-200 dark:bg-gray-700 rounded-md" required />
      </div>
      
      {type === 'gasto' && (
        <input type="text" name="nroRecibo" placeholder="Nro Recibo (Opcional)" value={formData.nroRecibo || ''} onChange={handleChange} className="w-full p-2 bg-gray-200 dark:bg-gray-700 rounded-md" />
      )}

      {type === 'ingreso' && !isEdit && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SearchableSelect
            options={clienteOptions}
            value={formData.clienteId || ''}
            onChange={(value) => handleSelectChange('clienteId', value)}
            placeholder="Asignar a Cliente (Opcional)"
          />
          <SearchableSelect
            options={vendedorOptions}
            value={formData.vendedorId || ''}
            onChange={(value) => handleSelectChange('vendedorId', value)}
            placeholder="Asignar a Usuario (Opcional)"
          />
        </div>
      )}

      <fieldset className="border-t dark:border-gray-600 pt-4">
        <legend className="text-lg font-medium text-gray-800 dark:text-white px-2">Detalle de Pago</legend>
        <div className="space-y-2 mt-2 max-h-40 overflow-y-auto pr-2">
            {(formData.pagos || []).map((pago: PagoDetalle, index: number) => (
              <div key={index} className="flex gap-2 items-center">
                <input type="number" value={pago.monto} onChange={e => handlePagoChange(index, 'monto', e.target.value)} className="w-full p-2 bg-gray-200 dark:bg-gray-700 rounded-md" placeholder="Monto" step="0.01" required />
                <select value={pago.metodo} onChange={e => handlePagoChange(index, 'metodo', e.target.value as MetodoPago)} className="w-full p-2 bg-gray-200 dark:bg-gray-700 rounded-md">
                  {Object.values(MetodoPago).map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <button type="button" onClick={() => removePago(index)} className="text-red-500 p-2 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-full"><TrashIcon className="h-5 w-5" /></button>
              </div>
            ))}
        </div>
        <button type="button" onClick={addPago} className="mt-2 px-4 py-2 text-sm font-medium rounded-md border border-primary-500 text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:border-primary-500 dark:hover:bg-primary-500/10">+ Agregar forma de pago</button>
      </fieldset>

      <div className="flex justify-end gap-2 pt-4">
        <button type="button" onClick={onClose} className="px-4 py-2 rounded-md bg-gray-300 dark:bg-gray-600">Cancelar</button>
        <button type="submit" className="px-4 py-2 rounded-md bg-primary-600 text-white">Guardar Cambios</button>
      </div>
    </form>
  )
}


const CajaView: React.FC<CajaViewProps> = ({
    registrosPago, gastos, clientes, vendedores, remitos, facturas, ventasVendedor,
    addPagoManual, addGasto, updateRegistroPago, updateGasto, deleteRegistroPago, deleteGasto, updateRemito, updateVentaVendedor
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<{ type: 'ingreso' | 'gasto', data: any, isEdit: boolean }>({ type: 'ingreso', data: {}, isEdit: false });
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const { showNotification } = useNotification();
  const [movimientoParaBorrar, setMovimientoParaBorrar] = useState<CombinedMovement | null>(null);

  const clientesMap = useMemo(() => new Map(clientes.map(c => [c.id, c.nombre])), [clientes]);
  const vendedoresMap = useMemo(() => new Map(vendedores.map(v => [v.id, v.nombre])), [vendedores]);
  const remitosMap = useMemo(() => new Map(remitos.map(r => [r.id, r])), [remitos]);
  const ventasVendedorMap = useMemo(() => new Map(ventasVendedor.map(v => [v.id, v])), [ventasVendedor]);
  const facturasMap = useMemo(() => new Map(facturas.map(f => [f.id, f])), [facturas]);

  const balances: Record<string, number> = useMemo(() => {
    const balancesPorMetodo = Object.values(MetodoPago).reduce((acc, metodo) => {
        acc[metodo] = 0;
        return acc;
    }, {} as Record<MetodoPago, number>);

    registrosPago.forEach(pago => {
        balancesPorMetodo[pago.metodo] += pago.monto;
    });
    gastos.forEach(gasto => {
        gasto.pagos.forEach(pago => {
            balancesPorMetodo[pago.metodo] -= pago.monto;
        });
    });

    const total = Object.values(balancesPorMetodo).reduce((sum, monto) => sum + monto, 0);
    return { ...balancesPorMetodo, total };
  }, [registrosPago, gastos]);

  const combinedMovements = useMemo(() => {
    const allMovements: CombinedMovement[] = [];

    // Process Gastos
    gastos.forEach(gasto => {
      allMovements.push({
        id: gasto.id,
        fecha: gasto.fecha,
        type: 'gasto',
        concepto: `${gasto.concepto}${gasto.nroRecibo ? ` (Recibo: ${gasto.nroRecibo})` : ''}`,
        pagos: gasto.pagos,
        total: gasto.pagos.reduce((sum, p) => sum + p.monto, 0),
        original: gasto,
      });
    });

    // Separate invoice payments from other payments
    const invoicePayments = registrosPago.filter(p => p.origen.tipo === 'factura');
    const otherPayments = registrosPago.filter(p => p.origen.tipo !== 'factura');

    // Group and Process other payments (remitos, manual, venta_vendedor)
    // FIX: Explicitly type the accumulator `acc` to resolve type inference issues.
    const pagosAgrupados = otherPayments.reduce((acc: Record<string, RegistroPago[]>, pago) => {
      const key = pago.origen.id;
      if (!acc[key]) acc[key] = [];
      acc[key].push(pago);
      return acc;
    }, {});

    Object.values(pagosAgrupados).forEach((grupo: RegistroPago[]) => {
      if (grupo.length === 0) return;
      const primerPago = grupo[0];
      let concepto = '';
      switch (primerPago.origen.tipo) {
        case 'remito':
          const remito = remitosMap.get(primerPago.origen.id);
          concepto = `Remito ${remito?.puntoVenta}-${remito?.numero} (${clientesMap.get(primerPago.clienteId!) || 'N/A'})`;
          break;
        case 'venta_vendedor':
           concepto = `Venta a Vendedor (${vendedoresMap.get(primerPago.vendedorId!) || 'N/A'})`;
          break;
        case 'pago_manual':
           concepto = `${primerPago.concepto || 'Ingreso Manual'} (${clientesMap.get(primerPago.clienteId!) || vendedoresMap.get(primerPago.vendedorId!) || 'N/A'})`;
          break;
      }
      allMovements.push({
        id: primerPago.origen.id,
        fecha: primerPago.fecha,
        type: 'ingreso',
        concepto,
        pagos: grupo.map(p => ({ metodo: p.metodo, monto: p.monto })),
        total: grupo.reduce((sum, p) => sum + p.monto, 0),
        original: grupo,
      });
    });

    // Process individual invoice payments
    invoicePayments.forEach(pago => {
        const factura = facturasMap.get(pago.origen.id);
        const concepto = `Cobro Factura ${factura?.numero || 'N/A'} (${clientesMap.get(pago.clienteId!) || 'N/A'})`;
        allMovements.push({
            id: pago.id, // Use payment ID for uniqueness
            fecha: pago.fecha,
            type: 'ingreso',
            concepto,
            pagos: [{ metodo: pago.metodo, monto: pago.monto }],
            total: pago.monto,
            original: [pago],
        });
    });
    
    return allMovements.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime() || b.id.localeCompare(a.id));
  }, [gastos, registrosPago, remitosMap, ventasVendedorMap, clientesMap, vendedoresMap, facturasMap]);


  const handleOpenModal = (type: 'ingreso' | 'gasto', isEdit = false, data: CombinedMovement | null = null) => {
    if (isEdit && data) {
      if (type === 'gasto') {
        setModalConfig({ type, isEdit, data: data.original as Gasto });
      } else { // ingreso
        if (Array.isArray(data.original)) {
          const original: RegistroPago[] = data.original;
          const primerPago = original[0];
          // FIX: Replaced unsafe object spread with explicit property mapping to avoid type conflicts.
          setModalConfig({
            type, isEdit, data: {
              id: primerPago.id,
              fecha: data.fecha,
              concepto: data.concepto,
              clienteId: primerPago.clienteId,
              vendedorId: primerPago.vendedorId,
              origen: primerPago.origen,
              original: data.original,
              pagos: original.map(p => ({ monto: p.monto, metodo: p.metodo }))
            }
          });
        }
      }
    } else { // new
      setModalConfig({ type, isEdit, data: { fecha: new Date().toISOString().split('T')[0], pagos: [] } });
    }
    setIsModalOpen(true);
  };
  
  const handleSave = (data: any) => {
    try {
        if (modalConfig.isEdit) {
          if (modalConfig.type === 'gasto') {
            updateGasto(data);
          } else { // ingreso
            const originalData = modalConfig.data.original;
            if (Array.isArray(originalData)) {
                const primerPago = originalData[0];
                if (primerPago.origen.tipo === 'pago_manual') {
                    // Update RegistroPago directly, this is a simplified update
                    const updatedPago = { ...primerPago, ...data, monto: data.pagos[0].monto, metodo: data.pagos[0].metodo };
                    updateRegistroPago(updatedPago);
                } else if (primerPago.origen.tipo === 'remito') {
                    const remito = remitosMap.get(primerPago.origen.id);
                    if (remito) {
                       const updatedPagosDetalle = data.pagos.map((p: any) => ({monto: p.monto, metodo: p.metodo}));
                       updateRemito({ ...remito, pagos: updatedPagosDetalle });
                    }
                } else if (primerPago.origen.tipo === 'venta_vendedor') {
                     const venta = ventasVendedorMap.get(primerPago.origen.id);
                     if (venta) {
                        const updatedPagosDetalle = data.pagos.map((p: any) => ({monto: p.monto, metodo: p.metodo}));
                        updateVentaVendedor({...venta, pagos: updatedPagosDetalle });
                     }
                }
            }
          }
        } else { // new
          if (modalConfig.type === 'gasto') {
            addGasto(data);
          } else { // ingreso
            addPagoManual(data);
          }
        }
        showNotification('Movimiento guardado con éxito.', 'success');
        setIsModalOpen(false);
    } catch(e) {
        showNotification('Error al guardar el movimiento.', 'error');
        console.error(e);
    }
  };

  const handleDelete = (movimiento: CombinedMovement) => {
    try {
      if (movimiento.type === 'gasto') {
        deleteGasto(movimiento.id);
      } else { // ingreso
        if (Array.isArray(movimiento.original)) {
          movimiento.original.forEach((pago: RegistroPago) => {
            deleteRegistroPago(pago.id);
          });
        }
      }
      showNotification('Movimiento eliminado con éxito.', 'success');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Error al eliminar el movimiento.';
      showNotification(message, 'error');
    }
  };

  const confirmDelete = () => {
    if (!movimientoParaBorrar) return;
    handleDelete(movimientoParaBorrar);
    setMovimientoParaBorrar(null);
  };

  return (
    <div className="space-y-6 pt-12 md:pt-0">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Caja y Movimientos</h1>
        <div className="space-x-2">
            <button onClick={() => handleOpenModal('ingreso')} className="px-4 py-2 rounded-md bg-green-600 text-white hover:bg-green-700">
                + Ingreso
            </button>
            <button onClick={() => handleOpenModal('gasto')} className="px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700">
                - Gasto
            </button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-center">
        {Object.entries(balances).map(([metodo, monto]) => (
            <div key={metodo} className={`p-4 rounded-lg ${metodo === 'total' ? 'bg-primary-600 text-white shadow-lg' : 'bg-white dark:bg-gray-800 shadow-sm'}`}>
                <p className={`text-sm font-medium ${metodo === 'total' ? 'opacity-80' : 'text-gray-500 dark:text-gray-400'}`}>{metodo === 'total' ? 'Balance Total' : metodo}</p>
                <p className={`text-2xl font-bold ${metodo === 'total' ? '' : 'text-gray-800 dark:text-gray-200'}`}>${monto.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
        ))}
      </div>

      <Card>
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                    <tr>
                        <th className="px-6 py-3 w-24">Fecha</th>
                        <th className="px-6 py-3">Concepto</th>
                        <th className="px-6 py-3 text-right">Ingreso</th>
                        <th className="px-6 py-3 text-right">Gasto</th>
                        <th className="px-6 py-3 w-16"><span className="sr-only">Acciones</span></th>
                    </tr>
                </thead>
                <tbody>
                    {combinedMovements.map(mov => {
                        const isExpanded = expandedRowId === mov.id;
                        const isEditDisabled = mov.type === 'ingreso' && Array.isArray(mov.original) && mov.original[0].origen.tipo === 'factura';
                        return (
                            <React.Fragment key={mov.id}>
                                <tr className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer" onClick={() => setExpandedRowId(isExpanded ? null : mov.id)}>
                                    <td className="px-6 py-4">{new Date(mov.fecha + 'T00:00:00').toLocaleDateString()}</td>
                                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{mov.concepto}</td>
                                    <td className="px-6 py-4 text-right font-semibold text-green-600">{mov.type === 'ingreso' ? `$${mov.total.toLocaleString()}` : ''}</td>
                                    <td className="px-6 py-4 text-right font-semibold text-red-600">{mov.type === 'gasto' ? `$${mov.total.toLocaleString()}` : ''}</td>
                                    <td className="px-6 py-4 text-right flex justify-end gap-2">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleOpenModal(mov.type, true, mov); }}
                                            className="text-blue-500 hover:text-blue-700 p-1 disabled:opacity-30 disabled:cursor-not-allowed"
                                            disabled={isEditDisabled}
                                            title={isEditDisabled ? 'No se puede modificar un pago de factura desde aquí' : 'Editar'}
                                        >
                                            <PencilIcon />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setMovimientoParaBorrar(mov);
                                            }}
                                            className="text-red-500 hover:text-red-700 p-1 disabled:opacity-30 disabled:cursor-not-allowed"
                                            disabled={isEditDisabled}
                                            title={isEditDisabled ? 'No se puede modificar un movimiento de factura desde aquí' : 'Eliminar'}
                                        >
                                            <TrashIcon />
                                        </button>
                                        <ChevronDownIcon className={`h-5 w-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                    </td>
                                </tr>
                                {isExpanded && (
                                    <tr className="bg-gray-50 dark:bg-gray-700/50">
                                        <td colSpan={5} className="p-4">
                                            <h4 className="font-semibold mb-2">Detalle de Pagos</h4>
                                            <ul className="space-y-1 text-sm">
                                                {mov.pagos.map((p, index) => (
                                                    <li key={index} className="flex justify-between p-2 bg-white dark:bg-gray-800 rounded-md">
                                                        <span>{p.metodo}</span>
                                                        <span className="font-semibold">${p.monto.toLocaleString()}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        );
                    })}
                </tbody>
            </table>
        </div>
      </Card>

      {isModalOpen && (
        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
            <MovimientoCajaForm
                type={modalConfig.type}
                movimiento={modalConfig.data}
                isEdit={modalConfig.isEdit}
                onSave={handleSave}
                onClose={() => setIsModalOpen(false)}
                clientes={clientes}
                vendedores={vendedores}
                contextText={modalConfig.isEdit && modalConfig.data.origen?.tipo === 'factura' ? 'No se puede modificar un pago de factura desde aquí.' : undefined}
            />
        </Modal>
      )}

      {movimientoParaBorrar && (
        <Modal isOpen={!!movimientoParaBorrar} onClose={() => setMovimientoParaBorrar(null)}>
            <div className="p-4 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/50">
                    <svg className="h-6 w-6 text-red-600 dark:text-red-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white mt-4">Confirmar Eliminación</h2>
                <p className="text-gray-600 dark:text-gray-300 my-4">
                    ¿Está seguro de que desea eliminar este {movimientoParaBorrar.type === 'ingreso' ? 'ingreso' : 'gasto'}?
                    <br />
                    Esta acción es irreversible y afectará los saldos de la caja.
                </p>
                <div className="flex justify-center space-x-4">
                    <button
                        onClick={() => setMovimientoParaBorrar(null)}
                        className="px-6 py-2 rounded-md bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={confirmDelete}
                        className="px-6 py-2 rounded-md bg-red-600 text-white hover:bg-red-700"
                    >
                        Sí, Eliminar
                    </button>
                </div>
            </div>
        </Modal>
      )}

    </div>
  );
};

export default CajaView;
