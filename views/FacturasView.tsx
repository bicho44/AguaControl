
import React, { useState, useMemo, useCallback } from 'react';
import { Cliente, Remito, Factura, Producto, RegistroPago, EstadoFactura, MetodoPago, PagoDetalle } from '../types';
import Card from '../components/Card';
import Modal from '../components/Modal';
import { ReceiptIcon } from '../components/icons/ReceiptIcon';
import { TrashIcon } from '../components/icons/TrashIcon';
import { useNotification } from '../context/NotificationContext';
import { ChevronDownIcon } from '../components/icons/ChevronDownIcon';
import { SearchIcon } from '../components/icons/SearchIcon';
import AppButton from '../components/ui/AppButton';
import AppInput from '../components/ui/AppInput';
import AppSelect from '../components/ui/AppSelect';

interface CuentaCorrienteViewProps {
  clientes: Cliente[];
  remitos: Remito[];
  facturas: Factura[];
  productos: Producto[];
  registrosPago: RegistroPago[];
  addFactura: (factura: Omit<Factura, 'id' | 'pagoIds' | 'estado' | 'numero'>) => void;
  addPagoToFactura: (facturaId: string, fecha: string, pagos: PagoDetalle[]) => void;
}

interface PagoFacturaFormProps {
    factura: Factura;
    montoRestante: number;
    onSave: (facturaId: string, fecha: string, pagos: PagoDetalle[]) => void;
    onClose: () => void;
}

const PagoFacturaForm: React.FC<PagoFacturaFormProps> = ({ factura, montoRestante, onSave, onClose }) => {
    const montoInicial = Math.round(montoRestante * 100) / 100;
    const [pagos, setPagos] = useState<PagoDetalle[]>([{ monto: montoInicial, metodo: MetodoPago.EFECTIVO }]);
    const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);

    const handlePagoChange = (index: number, field: keyof PagoDetalle, value: string | MetodoPago) => {
        const newPagos = [...pagos];
        const updatedValue = field === 'monto' ? (value === '' ? 0 : Number(value)) : value;
        newPagos[index] = { ...newPagos[index], [field]: updatedValue };
        setPagos(newPagos);
    };

    const addPago = () => setPagos([...pagos, { monto: 0, metodo: MetodoPago.EFECTIVO }]);
    const removePago = (index: number) => setPagos(pagos.filter((_, i) => i !== index));

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const pagosValidos = pagos.filter(p => p.monto > 0);
        if (pagosValidos.length > 0) {
            onSave(factura.id, fecha, pagosValidos);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Registrar Pago para Factura {factura.numero}</h2>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    <span>Total Factura: <strong>${factura.monto.toLocaleString('es-AR')}</strong></span>
                    <span className="mx-2">|</span>
                    <span>Saldo Restante: <strong>${montoRestante.toLocaleString('es-AR')}</strong></span>
                </div>
            </div>
            <AppInput type="date" value={fecha} onChange={e => setFecha(e.target.value)} required />
            
            <fieldset className="border-t dark:border-gray-600 pt-4">
                <legend className="text-lg font-medium text-gray-800 dark:text-white px-2">Detalle de Pago</legend>
                <div className="space-y-2 mt-2 max-h-40 overflow-y-auto pr-2">
                    {pagos.map((pago, index) => (
                        <div key={index} className="grid grid-cols-[1fr,1fr,auto] gap-2 items-center">
                            <AppInput type="number" value={pago.monto} onChange={e => handlePagoChange(index, 'monto', e.target.value)} placeholder="Monto" step="0.01" required />
                            <AppSelect value={pago.metodo} onChange={e => handlePagoChange(index, 'metodo', e.target.value as MetodoPago)} options={Object.values(MetodoPago).map(m => ({value: m, label: m}))} />
                            <AppButton variant="danger" size="sm" onClick={() => removePago(index)} className="!p-2"><TrashIcon className="h-5 w-5" /></AppButton>
                        </div>
                    ))}
                </div>
                <AppButton variant="secondary" size="sm" onClick={addPago} className="mt-2 w-full border-dashed border-2">+ Agregar forma de pago</AppButton>
            </fieldset>

            <div className="flex justify-end gap-2 pt-4 border-t dark:border-gray-700">
                <AppButton variant="secondary" onClick={onClose}>Cancelar</AppButton>
                <AppButton type="submit" variant="primary">Guardar Pago</AppButton>
            </div>
        </form>
    );
};

const CuentaCorrienteView: React.FC<CuentaCorrienteViewProps> = ({ clientes, remitos, facturas, productos, registrosPago, addFactura, addPagoToFactura }) => {
  const [selectedClienteId, setSelectedClienteId] = useState<string>('');
  const [selectedRemitos, setSelectedRemitos] = useState<Set<string>>(new Set());
  const [pagandoFacturaInfo, setPagandoFacturaInfo] = useState<{ factura: Factura; montoRestante: number } | null>(null);
  const [expandedFacturaId, setExpandedFacturaId] = useState<string | null>(null);
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const { showNotification } = useNotification();

  const productosMap = useMemo(() => new Map(productos.map(p => [p.id, p])), [productos]);
  const clientesMap = useMemo(() => new Map(clientes.map(c => [c.id, c])), [clientes]);
  const remitosMap = useMemo(() => new Map(remitos.map(r => [r.id, r])), [remitos]);

  const clientesCtaCteConDeuda = useMemo(() => {
    const clientesCtaCte = clientes.filter(c => c.tieneCuentaCorriente);
    return clientesCtaCte.map(cliente => {
      const facturasCliente = facturas.filter(f => f.clienteId === cliente.id && f.estado !== EstadoFactura.PAGADO && f.estado !== EstadoFactura.ANULADO);
      const deudaTotal = facturasCliente.reduce((sum, f) => {
        const pagado = (f.pagoIds || []).reduce((pagoSum, id) => {
            const pago = registrosPago.find(p => p.id === id);
            return pagoSum + (pago?.monto || 0);
        }, 0);
        return sum + (f.monto - pagado);
      }, 0);
      return {
        cliente,
        deudaTotal,
        facturasPendientes: facturasCliente.length,
      };
    }).sort((a,b) => b.deudaTotal - a.deudaTotal);
  }, [clientes, facturas, registrosPago]);

  const filteredClientesList = useMemo(() => {
    if (!clientSearchTerm) return clientesCtaCteConDeuda;
    return clientesCtaCteConDeuda.filter(c => 
      c.cliente.nombre.toLowerCase().includes(clientSearchTerm.toLowerCase())
    );
  }, [clientesCtaCteConDeuda, clientSearchTerm]);
  
  const getRemitoTotal = useCallback((remito: Remito) => {
    const cliente = clientesMap.get(remito.clienteId);
    const preciosEspecialesMap = new Map(cliente?.preciosEspeciales?.map(p => [p.productoId, p.precio]));
    
    return remito.movimientos.reduce((sum, mov) => {
        const producto = productosMap.get(mov.productoId);
        if (!producto) return sum;
        const precio = preciosEspecialesMap.get(mov.productoId) ?? producto.precio;
        return sum + (mov.entregados * precio);
    }, 0);
  }, [productosMap, clientesMap]);
  
  const clienteData = useMemo(() => {
    if (!selectedClienteId) return null;
    
    const remitosCliente = remitos.filter(r => r.clienteId === selectedClienteId);
    const facturasCliente = facturas.filter(f => f.clienteId === selectedClienteId).sort((a,b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
    
    const remitosPendientes = remitosCliente.filter(r => !r.facturaId);
    const totalAFacturar = remitosPendientes.reduce((sum, r) => sum + getRemitoTotal(r), 0);
    
    const facturasPendientes = facturasCliente.filter(f => f.estado !== EstadoFactura.PAGADO && f.estado !== EstadoFactura.ANULADO);
    const totalDeuda = facturasPendientes.reduce((sum, f) => {
        const pagado = (f.pagoIds || []).reduce((pagoSum, id) => {
            const pago = registrosPago.find(p => p.id === id);
            return pagoSum + (pago?.monto || 0);
        }, 0);
        return sum + (f.monto - pagado);
    }, 0);
    
    return { remitosPendientes, facturasCliente, totalAFacturar, totalDeuda };
  }, [selectedClienteId, remitos, facturas, registrosPago, getRemitoTotal]);
  
  const handleSelectRemito = (remitoId: string) => {
    setSelectedRemitos(prev => {
        const newSet = new Set(prev);
        if (newSet.has(remitoId)) {
            newSet.delete(remitoId);
        } else {
            newSet.add(remitoId);
        }
        return newSet;
    });
  };
  
  const handleGenerarFactura = () => {
    if (selectedRemitos.size === 0) return;
    try {
        const remitosAFacturar = clienteData?.remitosPendientes.filter(r => selectedRemitos.has(r.id)) || [];
        const montoTotal = remitosAFacturar.reduce((sum, r) => sum + getRemitoTotal(r), 0);
        
        addFactura({
            fecha: new Date().toISOString().split('T')[0],
            clienteId: selectedClienteId,
            remitosIds: Array.from(selectedRemitos),
            monto: montoTotal,
        });
        
        setSelectedRemitos(new Set());
        showNotification('Factura generada con éxito.', 'success');
    } catch (e) {
        showNotification('Error al generar la factura.', 'error');
        console.error(e);
    }
  };

  const handleOpenPagoModal = useCallback((factura: Factura) => {
    const pagado = (factura.pagoIds || []).reduce((sum, id) => {
        const pago = registrosPago.find(p => p.id === id);
        return sum + (pago?.monto || 0);
    }, 0);
    const montoRestante = factura.monto - pagado;
    setPagandoFacturaInfo({ factura, montoRestante });
  }, [registrosPago]);

  const handleSavePago = (facturaId: string, fecha: string, pagos: PagoDetalle[]) => {
    try {
        addPagoToFactura(facturaId, fecha, pagos);
        setPagandoFacturaInfo(null);
        showNotification('Pago registrado con éxito.', 'success');
    } catch (e) {
        showNotification('Error al registrar el pago.', 'error');
        console.error(e);
    }
  };

  const totalSeleccionado = useMemo(() => {
    if (selectedRemitos.size === 0) return 0;
    const remitosSeleccionados = clienteData?.remitosPendientes.filter(r => selectedRemitos.has(r.id)) || [];
    return remitosSeleccionados.reduce((sum, r) => sum + getRemitoTotal(r), 0);
  }, [selectedRemitos, clienteData, getRemitoTotal]);

  const handleSelectCliente = (clienteId: string) => {
    setSelectedClienteId(clienteId);
    setSelectedRemitos(new Set());
    setExpandedFacturaId(null);
  }

  return (
    <div className="space-y-6 pt-12 md:pt-0">
      <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Gestión de Cuentas Corrientes</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
            <Card>
                <div className="p-4 border-b dark:border-gray-700">
                    <div className="relative">
                        <AppInput
                            placeholder="Buscar cliente..."
                            value={clientSearchTerm}
                            onChange={(e) => setClientSearchTerm(e.target.value)}
                            className="pl-8"
                        />
                        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none mt-6">
                            <SearchIcon className="h-5 w-5 text-gray-400" />
                        </div>
                    </div>
                </div>
                <div className="max-h-[calc(100vh-20rem)] overflow-y-auto">
                    {filteredClientesList.map(({ cliente, deudaTotal, facturasPendientes }) => (
                        <button
                            key={cliente.id}
                            onClick={() => handleSelectCliente(cliente.id)}
                            className={`w-full text-left p-4 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 ${selectedClienteId === cliente.id ? 'bg-primary-50 dark:bg-primary-900/30' : ''}`}
                        >
                            <p className="font-semibold text-gray-800 dark:text-gray-200">{cliente.nombre}</p>
                            <div className="flex justify-between items-center text-sm mt-1">
                                <span className="text-gray-500 dark:text-gray-400">{facturasPendientes} facturas pendientes</span>
                                <span className={`font-bold ${deudaTotal > 0 ? 'text-red-500' : 'text-green-500'}`}>${deudaTotal.toLocaleString('es-AR')}</span>
                            </div>
                        </button>
                    ))}
                </div>
            </Card>
        </div>
        
        <div className="lg:col-span-2">
            {clienteData ? (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card title="Resumen de Cuenta">
                            <div className="space-y-3">
                                <div className="flex justify-between items-baseline">
                                    <span className="text-gray-500 dark:text-gray-400">Deuda Total (Facturas impagas):</span>
                                    <span className="font-bold text-2xl text-red-500">${clienteData.totalDeuda.toLocaleString('es-AR')}</span>
                                </div>
                                <div className="flex justify-between items-baseline">
                                    <span className="text-gray-500 dark:text-gray-400">Pendiente de Facturar:</span>
                                    <span className="font-bold text-lg text-yellow-600">${clienteData.totalAFacturar.toLocaleString('es-AR')}</span>
                                </div>
                            </div>
                        </Card>
                         <Card title="Facturación">
                            <div className="space-y-3">
                                <p className="text-sm text-gray-500 dark:text-gray-400">Ha seleccionado {selectedRemitos.size} remitos para facturar.</p>
                                <div className="flex justify-between items-baseline">
                                    <span className="font-semibold">Monto a Facturar:</span>
                                    <span className="font-bold text-xl text-primary-600">${totalSeleccionado.toLocaleString('es-AR')}</span>
                                </div>
                                <AppButton 
                                    onClick={handleGenerarFactura}
                                    disabled={selectedRemitos.size === 0}
                                    fullWidth
                                    icon={<ReceiptIcon className="h-5 w-5"/>}
                                >
                                   Generar Factura
                                </AppButton>
                            </div>
                        </Card>
                    </div>
                    
                    <Card title="Remitos Pendientes de Facturar">
                        <div className="overflow-x-auto max-h-96">
                            <table className="w-full text-sm">
                                 <thead className="text-left text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 sticky top-0">
                                    <tr>
                                        <th className="p-2 w-12 text-center">Sel.</th>
                                        <th className="p-2">Fecha</th>
                                        <th className="p-2">Número</th>
                                        <th className="p-2 text-right">Monto</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {clienteData.remitosPendientes.map(r => (
                                        <tr key={r.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                            <td className="p-2 text-center"><input type="checkbox" checked={selectedRemitos.has(r.id)} onChange={() => handleSelectRemito(r.id)} className="form-checkbox rounded text-primary-600"/></td>
                                            <td className="p-2">{new Date(r.fecha + 'T00:00:00').toLocaleDateString()}</td>
                                            <td className="p-2 font-mono">{`${r.puntoVenta.padStart(4, '0')}-${r.numero.padStart(8, '0')}`}</td>
                                            <td className="p-2 text-right font-semibold">${getRemitoTotal(r).toLocaleString('es-AR')}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {clienteData.remitosPendientes.length === 0 && <p className="text-center p-4 text-gray-500">No hay remitos pendientes.</p>}
                        </div>
                    </Card>

                    <Card title="Historial de Facturas">
                        <div className="space-y-2 p-2">
                            {clienteData.facturasCliente.map(factura => {
                                const isExpanded = expandedFacturaId === factura.id;
                                const pagado = (factura.pagoIds || []).reduce((sum, id) => sum + (registrosPago.find(p => p.id === id)?.monto || 0), 0);
                                const saldo = factura.monto - pagado;
                                
                                let estadoInfo;
                                switch (factura.estado) {
                                    case EstadoFactura.PAGADO: estadoInfo = { text: 'Pagado', color: 'text-green-600 dark:text-green-400' }; break;
                                    case EstadoFactura.PAGADO_PARCIAL: estadoInfo = { text: 'Pagado Parcial', color: 'text-yellow-600 dark:text-yellow-400' }; break;
                                    case EstadoFactura.PENDIENTE: estadoInfo = { text: 'Pendiente', color: 'text-red-600 dark:text-red-400' }; break;
                                    default: estadoInfo = { text: factura.estado, color: 'text-gray-500' };
                                }

                                return (
                                    <div key={factura.id} className="bg-white dark:bg-gray-800 rounded-md shadow-sm border dark:border-gray-700">
                                        <div className="flex items-center p-4 cursor-pointer" onClick={() => setExpandedFacturaId(isExpanded ? null : factura.id)}>
                                            <div className="flex-grow grid grid-cols-2 sm:grid-cols-4 gap-4 items-center">
                                                <div>
                                                    <p className="text-xs text-gray-500">Fecha</p>
                                                    <p className="font-medium text-gray-900 dark:text-white">{new Date(factura.fecha + 'T00:00:00').toLocaleDateString()}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500">Número</p>
                                                    <p className="font-medium text-gray-900 dark:text-white font-mono">{factura.numero}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500">Monto</p>
                                                    <p className="font-semibold text-gray-900 dark:text-white">${factura.monto.toLocaleString('es-AR')}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500">Estado</p>
                                                    <p className={`font-bold text-sm ${estadoInfo.color}`}>{estadoInfo.text}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center pl-4">
                                                {factura.estado !== EstadoFactura.PAGADO && factura.estado !== EstadoFactura.ANULADO && (
                                                    <AppButton size="sm" variant="success" onClick={(e) => { e.stopPropagation(); handleOpenPagoModal(factura); }} className="mr-2">
                                                        Pagar
                                                    </AppButton>
                                                )}
                                                <ChevronDownIcon className={`h-5 w-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                            </div>
                                        </div>

                                        {isExpanded && (
                                            <div className="border-t dark:border-gray-700 p-4 space-y-4">
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    <div>
                                                        <h4 className="font-semibold mb-2 text-gray-800 dark:text-gray-200">Remitos Incluidos</h4>
                                                        <ul className="space-y-1 text-sm">
                                                            {factura.remitosIds.map(remitoId => {
                                                                const remito = remitosMap.get(remitoId);
                                                                return (
                                                                    <li key={remitoId} className="flex justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded-md">
                                                                        <span>Remito {remito ? `${remito.puntoVenta}-${remito.numero}` : 'N/A'}</span>
                                                                    </li>
                                                                );
                                                            })}
                                                        </ul>
                                                    </div>
                                                    <div>
                                                        <h4 className="font-semibold mb-2 text-gray-800 dark:text-gray-200">Pagos Registrados</h4>
                                                        <ul className="space-y-1 text-sm">
                                                            {(factura.pagoIds || []).length > 0 ? (
                                                                (factura.pagoIds || []).map(pagoId => {
                                                                    const pago = registrosPago.find(p => p.id === pagoId);
                                                                    return (
                                                                        <li key={pagoId} className="flex justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded-md">
                                                                            <span>{pago?.metodo} ({new Date(pago?.fecha + 'T00:00:00').toLocaleDateString()})</span>
                                                                            <span className="font-semibold">${pago?.monto.toLocaleString('es-AR')}</span>
                                                                        </li>
                                                                    )
                                                                })
                                                            ) : (
                                                                <p className="text-sm text-gray-500 p-2">Sin pagos registrados.</p>
                                                            )}
                                                        </ul>
                                                    </div>
                                                </div>
                                                <div className="flex justify-end gap-6 p-3 bg-gray-100 dark:bg-gray-700/50 rounded-md text-sm">
                                                    <div className="text-right">
                                                        <span className="text-gray-500 dark:text-gray-400">Total Facturado</span>
                                                        <p className="font-bold text-base">${factura.monto.toLocaleString('es-AR')}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-gray-500 dark:text-gray-400">Total Pagado</span>
                                                        <p className="font-bold text-base text-green-600">${pagado.toLocaleString('es-AR')}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-gray-500 dark:text-gray-400">Saldo Pendiente</span>
                                                        <p className="font-bold text-base text-red-600">${saldo.toLocaleString('es-AR')}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            {clienteData.facturasCliente.length === 0 && <p className="text-center p-4 text-gray-500">No hay facturas emitidas.</p>}
                        </div>
                    </Card>
                </div>
            ) : (
                 <div className="flex items-center justify-center h-96 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <p className="text-gray-500 dark:text-gray-400">Seleccione un cliente para ver los detalles de su cuenta corriente.</p>
                </div>
            )}
        </div>
      </div>
      {pagandoFacturaInfo && (
          <Modal isOpen={!!pagandoFacturaInfo} onClose={() => setPagandoFacturaInfo(null)}>
              <PagoFacturaForm
                factura={pagandoFacturaInfo.factura}
                montoRestante={pagandoFacturaInfo.montoRestante}
                onSave={handleSavePago}
                onClose={() => setPagandoFacturaInfo(null)}
              />
          </Modal>
      )}
    </div>
  );
};

export default CuentaCorrienteView;
