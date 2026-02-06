
import React, { useState, useMemo, useCallback } from 'react';
import { Cliente, Remito, Factura, Producto, RegistroPago, EstadoFactura, MetodoPago, PagoDetalle } from '../types';
import Card from '../components/Card';
import Modal from '../components/Modal';
import { ReceiptIcon } from '../components/icons/ReceiptIcon';
import { TrashIcon } from '../components/icons/TrashIcon';
import { useNotification } from '../context/NotificationContext';
import { ChevronDownIcon } from '../components/icons/ChevronDownIcon';
import { SearchIcon } from '../components/icons/SearchIcon';

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
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} required className="w-full p-2 bg-gray-200 dark:bg-gray-700 rounded-md" />
            
            <fieldset className="border-t dark:border-gray-600 pt-4">
                <legend className="text-lg font-medium text-gray-800 dark:text-white px-2">Detalle de Pago</legend>
                <div className="space-y-2 mt-2 max-h-40 overflow-y-auto pr-2">
                    {pagos.map((pago, index) => (
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
                <button type="button" onClick={onClose} className="px-4 py-2 rounded-md bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-200">Cancelar</button>
                <button type="submit" className="px-4 py-2 rounded-md bg-primary-600 text-white">Guardar Pago</button>
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
    if (remito.esAjuste) return 0; // AJUSTES NO SE FACTURAN
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
    const remitosPendientes = remitosCliente.filter(r => !r.facturaId && !r.esAjuste); // EXCLUIR AJUSTES
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
        if (newSet.has(remitoId)) newSet.delete(remitoId);
        else newSet.add(remitoId);
        return newSet;
    });
  };
  
  const handleGenerarFactura = () => {
    if (selectedRemitos.size === 0) return;
    try {
        const remitosAFacturar = clienteData?.remitosPendientes.filter(r => selectedRemitos.has(r.id)) || [];
        const montoTotal = remitosAFacturar.reduce((sum, r) => sum + getRemitoTotal(r), 0);
        addFactura({ fecha: new Date().toISOString().split('T')[0], clienteId: selectedClienteId, remitosIds: Array.from(selectedRemitos), monto: montoTotal });
        setSelectedRemitos(new Set());
        showNotification('Factura generada.', 'success');
    } catch (e) { showNotification('Error.', 'error'); }
  };

  const handleOpenPagoModal = useCallback((factura: Factura) => {
    const pagado = (factura.pagoIds || []).reduce((sum, id) => sum + (registrosPago.find(p => p.id === id)?.monto || 0), 0);
    setPagandoFacturaInfo({ factura, montoRestante: factura.monto - pagado });
  }, [registrosPago]);

  const handleSavePago = (facturaId: string, fecha: string, pagos: PagoDetalle[]) => {
    try { addPagoToFactura(facturaId, fecha, pagos); setPagandoFacturaInfo(null); showNotification('Pago registrado.', 'success'); } catch (e) { showNotification('Error.', 'error'); }
  };

  return (
    <div className="space-y-6 pt-12 md:pt-0">
      <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Cuentas Corrientes</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
            <Card>
                <div className="p-4 border-b dark:border-gray-700">
                    <div className="relative">
                        <input type="text" placeholder="Buscar cliente..." value={clientSearchTerm} onChange={(e) => setClientSearchTerm(e.target.value)} className="w-full p-2 pl-10 bg-gray-200 dark:bg-gray-700 rounded-md" />
                        <div className="absolute inset-y-0 left-0 flex items-center pl-3"><SearchIcon className="h-5 w-5 text-gray-400" /></div>
                    </div>
                </div>
                <div className="max-h-[calc(100vh-20rem)] overflow-y-auto">
                    {filteredClientesList.map(({ cliente, deudaTotal, facturasPendientes }) => (
                        <button key={cliente.id} onClick={() => { setSelectedClienteId(cliente.id); setSelectedRemitos(new Set()); }} className={`w-full text-left p-4 border-b dark:border-gray-700 hover:bg-gray-50 ${selectedClienteId === cliente.id ? 'bg-primary-50' : ''}`}>
                            <p className="font-semibold text-gray-800 dark:text-gray-200">{cliente.nombre}</p>
                            <div className="flex justify-between items-center text-sm mt-1"><span className="text-gray-500">{facturasPendientes} fac. pend.</span><span className={`font-bold ${deudaTotal > 0 ? 'text-red-500' : 'text-green-500'}`}>${deudaTotal.toLocaleString()}</span></div>
                        </button>
                    ))}
                </div>
            </Card>
        </div>
        <div className="lg:col-span-2">
            {clienteData ? (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card title="Resumen"><div className="space-y-3"><div className="flex justify-between items-baseline"><span className="text-gray-500">Deuda Facturada:</span><span className="font-bold text-2xl text-red-500">${clienteData.totalDeuda.toLocaleString()}</span></div><div className="flex justify-between items-baseline"><span className="text-gray-500">Sin Facturar:</span><span className="font-bold text-lg text-yellow-600">${clienteData.totalAFacturar.toLocaleString()}</span></div></div></Card>
                        <Card title="Acciones"><button onClick={handleGenerarFactura} disabled={selectedRemitos.size === 0} className="w-full px-4 py-2 rounded-md bg-primary-600 text-white disabled:bg-gray-400"><ReceiptIcon className="inline h-5 w-5 mr-2"/> Facturar Seleccionados (${clienteData.remitosPendientes.filter(r=>selectedRemitos.has(r.id)).reduce((s,r)=>s+getRemitoTotal(r),0).toLocaleString()})</button></Card>
                    </div>
                    <Card title="Remitos Pendientes (Sin Ajustes)">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="text-left text-gray-500 bg-gray-50"><tr><th className="p-2 w-12 text-center">Sel.</th><th className="p-2">Fecha</th><th className="p-2">Número</th><th className="p-2 text-right">Monto</th></tr></thead>
                                <tbody>{clienteData.remitosPendientes.map(r => (<tr key={r.id} className="border-b dark:border-gray-700"><td className="p-2 text-center"><input type="checkbox" checked={selectedRemitos.has(r.id)} onChange={() => handleSelectRemito(r.id)} className="form-checkbox" /></td><td className="p-2">{new Date(r.fecha + 'T00:00:00').toLocaleDateString()}</td><td className="p-2 font-mono">{r.puntoVenta}-{r.numero}</td><td className="p-2 text-right font-semibold">${getRemitoTotal(r).toLocaleString()}</td></tr>))}</tbody>
                            </table>
                        </div>
                    </Card>
                    <Card title="Facturas">
                        <div className="space-y-2">{clienteData.facturasCliente.map(f => (<div key={f.id} className="p-4 border dark:border-gray-700 rounded-md flex justify-between items-center"><div><p className="font-bold">{f.numero} - {new Date(f.fecha + 'T00:00:00').toLocaleDateString()}</p><p className="text-xs text-gray-500">Monto: ${f.monto.toLocaleString()} | Saldo: ${(f.monto - (f.pagoIds?.reduce((s,id)=>s+(registrosPago.find(p=>p.id===id)?.monto||0),0)||0)).toLocaleString()}</p></div><button onClick={() => handleOpenPagoModal(f)} className="px-3 py-1 bg-green-100 text-green-800 rounded-md">Pagar</button></div>))}</div>
                    </Card>
                </div>
            ) : <div className="h-96 flex items-center justify-center bg-gray-50 dark:bg-gray-800/50 rounded-lg text-gray-500">Seleccione un cliente.</div>}
        </div>
      </div>
      {pagandoFacturaInfo && <Modal isOpen={true} onClose={() => setPagandoFacturaInfo(null)}><PagoFacturaForm factura={pagandoFacturaInfo.factura} montoRestante={pagandoFacturaInfo.montoRestante} onSave={handleSavePago} onClose={() => setPagandoFacturaInfo(null)}/></Modal>}
    </div>
  );
};

export default CuentaCorrienteView;
