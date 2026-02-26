
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Cliente, Remito, Factura, Producto, RegistroPago, EstadoFactura, MetodoPago, PagoDetalle, Contrato, Servicio } from '../types';
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
import { getLocalDateString } from '../utils/dateUtils';
import LiquidacionAbonosView from './LiquidacionAbonosView';

interface FacturacionViewProps {
  clientes: Cliente[];
  remitos: Remito[];
  facturas: Factura[];
  productos: Producto[];
  contratos: Contrato[];
  servicios: Servicio[];
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
    const [fecha, setFecha] = useState(getLocalDateString());

    const handlePagoChange = (index: number, field: keyof PagoDetalle, value: string | MetodoPago) => {
        const newPagos = [...pagos];
        const updatedValue = field === 'monto' ? (value === '' ? 0 : Number(value)) : value;
        newPagos[index] = { ...newPagos[index], [field]: updatedValue };
        setPagos(newPagos);
    };

    const addPago = useCallback(() => setPagos(prev => [...prev, { monto: 0, metodo: MetodoPago.EFECTIVO }]), []);
    const removePago = (index: number) => setPagos(pagos.filter((_, i) => i !== index));

    const handleSubmit = useCallback((e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const pagosValidos = pagos.filter(p => p.monto > 0);
        if (pagosValidos.length > 0) onSave(factura.id, fecha, pagosValidos);
    }, [pagos, factura.id, fecha, onSave]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                handleSubmit();
            } else if (e.altKey && (e.key === 'p' || e.key === 'P')) {
                e.preventDefault();
                addPago();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleSubmit, addPago]);

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white uppercase tracking-tighter pr-12">Cobro de Factura {factura.numero}</h2>
                <div className="text-xs text-gray-500 mt-1 uppercase font-black">
                    Saldo Restante: <span className="text-red-600">${montoRestante.toLocaleString('es-AR')}</span>
                </div>
            </div>
            <AppInput label="Fecha de Pago" type="date" value={fecha} onChange={e => setFecha(e.target.value)} required />
            
            <fieldset className="border-t dark:border-gray-600 pt-4">
                <legend className="text-sm font-black text-gray-400 uppercase tracking-widest px-2 mb-4">Medios de Pago</legend>
                <div className="space-y-3">
                    {pagos.map((pago, index) => (
                        <div key={index} className="grid grid-cols-[2fr,1fr,auto] gap-2 items-center">
                            <AppInput type="number" value={pago.monto} onChange={e => handlePagoChange(index, 'monto', e.target.value)} placeholder="Monto" step="0.01" required className="font-bold text-green-600" />
                            <AppSelect value={pago.metodo} onChange={e => handlePagoChange(index, 'metodo', e.target.value as MetodoPago)} options={Object.values(MetodoPago).map(m => ({value: m, label: m}))} />
                            <AppButton variant="danger" size="sm" onClick={() => removePago(index)} className="!p-2"><TrashIcon className="h-5 w-5" /></AppButton>
                        </div>
                    ))}
                    <AppButton variant="secondary" size="sm" onClick={addPago} className="w-full border-dashed border-2">+ Otro Medio <span className="opacity-60 text-[10px] ml-1 font-normal">(Alt+P)</span></AppButton>
                </div>
            </fieldset>

            <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
                <AppButton variant="secondary" onClick={onClose}>Cancelar</AppButton>
                <AppButton variant="primary" type="submit">Registrar Cobro <span className="opacity-60 text-[10px] ml-1 font-normal">(Ctrl+Enter)</span></AppButton>
            </div>
        </form>
    );
};

const FacturacionView: React.FC<FacturacionViewProps> = ({ clientes, remitos, facturas, productos, contratos, servicios, registrosPago, addFactura, addPagoToFactura }) => {
  const [activeTab, setActiveTab] = useState<'cuentacorriente' | 'liquidacion'>('cuentacorriente');
  const [selectedClienteId, setSelectedClienteId] = useState<string>('');
  const [selectedRemitos, setSelectedRemitos] = useState<Set<string>>(new Set());
  const [pagandoFacturaInfo, setPagandoFacturaInfo] = useState<{ factura: Factura; montoRestante: number } | null>(null);
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'nombre' | 'deuda'>('nombre');
  const { showNotification } = useNotification();

  const productosMap = useMemo(() => new Map(productos.map(p => [p.id, p])), [productos]);
  const clientesMap = useMemo(() => new Map(clientes.map(c => [c.id, c])), [clientes]);

  const filteredClientesList = useMemo(() => {
    const clientesCtaCte = clientes.filter(c => c.tieneCuentaCorriente);
    return clientesCtaCte.map(cliente => {
      const facturasCliente = facturas.filter(f => f.clienteId === cliente.id && f.estado !== EstadoFactura.PAGADO && f.estado !== EstadoFactura.ANULADO);
      const deudaTotal = facturasCliente.reduce((sum, f) => {
        const pagado = (f.pagoIds || []).reduce((ps, id) => ps + (registrosPago.find(p => p.id === id)?.monto || 0), 0);
        return sum + (f.monto - pagado);
      }, 0);
      return { cliente, deudaTotal, facturasPendientes: facturasCliente.length };
    })
    .filter(c => !clientSearchTerm || c.cliente.nombre.toLowerCase().includes(clientSearchTerm.toLowerCase()))
    .sort((a,b) => {
        if (sortOrder === 'deuda') {
            return b.deudaTotal - a.deudaTotal;
        }
        return a.cliente.nombre.localeCompare(b.cliente.nombre);
    });
  }, [clientes, facturas, registrosPago, clientSearchTerm, sortOrder]);
  
  const getRemitoTotal = useCallback((remito: Remito) => {
    if (remito.esAjuste) return 0;
    const cliente = clientesMap.get(remito.clienteId);
    const preciosEspecialesMap = new Map(cliente?.preciosEspeciales?.map(p => [p.productoId, p.precio]));
    return remito.movimientos.reduce((sum, mov) => {
        const prod = productosMap.get(mov.productoId);
        if (!prod) return sum;
        return sum + (mov.entregados * (preciosEspecialesMap.get(mov.productoId) ?? prod.precio));
    }, 0);
  }, [productosMap, clientesMap]);
  
  const clienteData = useMemo(() => {
    if (!selectedClienteId) return null;
    const rems = remitos.filter(r => r.clienteId === selectedClienteId && !r.facturaId && !r.esAjuste);
    const facts = facturas.filter(f => f.clienteId === selectedClienteId).sort((a,b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
    const totalDeuda = facts.filter(f => f.estado !== EstadoFactura.PAGADO && f.estado !== EstadoFactura.ANULADO).reduce((sum, f) => {
        const pagado = (f.pagoIds || []).reduce((ps, id) => ps + (registrosPago.find(p => p.id === id)?.monto || 0), 0);
        return sum + (f.monto - pagado);
    }, 0);
    return { remitosPendientes: rems, facturasCliente: facts, totalDeuda };
  }, [selectedClienteId, remitos, facturas, registrosPago]);
  
  const handleGenerarFactura = () => {
    if (selectedRemitos.size === 0) return;
    const rems = clienteData?.remitosPendientes.filter(r => selectedRemitos.has(r.id)) || [];
    const mt = rems.reduce((sum, r) => sum + getRemitoTotal(r), 0);
    addFactura({ fecha: getLocalDateString(), clienteId: selectedClienteId, remitosIds: Array.from(selectedRemitos), monto: mt });
    setSelectedRemitos(new Set());
    showNotification('Factura generada.', 'success');
  };

  return (
    <div className="space-y-6 pt-12 md:pt-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white uppercase tracking-tighter italic">Facturación</h1>
        <div className="flex bg-gray-200 dark:bg-gray-800 p-1 rounded-xl w-fit">
            <button 
                onClick={() => setActiveTab('cuentacorriente')}
                className={`px-4 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === 'cuentacorriente' ? 'bg-white dark:bg-gray-700 text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
                Cuentas Corrientes
            </button>
            <button 
                onClick={() => setActiveTab('liquidacion')}
                className={`px-4 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === 'liquidacion' ? 'bg-white dark:bg-gray-700 text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
                Liquidación Abonos
            </button>
        </div>
      </div>

      {activeTab === 'cuentacorriente' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
            <Card>
                <div className="p-4 border-b dark:border-gray-700 space-y-3">
                    <div className="relative">
                        <AppInput placeholder="Buscar cliente..." value={clientSearchTerm} onChange={(e) => setClientSearchTerm(e.target.value)} className="pl-10" />
                        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none"><SearchIcon className="h-5 w-5 text-gray-400" /></div>
                    </div>
                    <div className="flex gap-2">
                        <button 
                            onClick={() => setSortOrder('nombre')} 
                            className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition-colors ${sortOrder === 'nombre' ? 'bg-primary-600 text-white border-primary-600' : 'bg-gray-50 dark:bg-gray-700 text-gray-500 border-gray-200 dark:border-gray-600 hover:bg-gray-100'}`}
                        >
                            A-Z (Nombre)
                        </button>
                        <button 
                            onClick={() => setSortOrder('deuda')} 
                            className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition-colors ${sortOrder === 'deuda' ? 'bg-primary-600 text-white border-primary-600' : 'bg-gray-50 dark:bg-gray-700 text-gray-500 border-gray-200 dark:border-gray-600 hover:bg-gray-100'}`}
                        >
                            $$$ (Mayor Deuda)
                        </button>
                    </div>
                </div>
                <div className="max-h-[calc(100vh-20rem)] overflow-y-auto">
                    {filteredClientesList.map(({ cliente, deudaTotal, facturasPendientes }) => (
                        <button key={cliente.id} onClick={() => { setSelectedClienteId(cliente.id); setSelectedRemitos(new Set()); }} className={`w-full text-left p-4 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${selectedClienteId === cliente.id ? 'bg-primary-50 dark:bg-primary-900/20 border-l-4 border-l-primary-600' : ''}`}>
                            <p className="font-bold text-gray-800 dark:text-gray-200">{cliente.nombre}</p>
                            <div className="flex justify-between items-center text-xs mt-1 uppercase font-black tracking-tighter"><span className="text-gray-400">{facturasPendientes} fac. pend.</span><span className={`${deudaTotal > 0 ? 'text-red-500' : 'text-green-500'}`}>${deudaTotal.toLocaleString()}</span></div>
                        </button>
                    ))}
                </div>
            </Card>
        </div>
        <div className="lg:col-span-2">
            {clienteData ? (
                <div className="space-y-6 animate-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card title="Resumen"><div className="space-y-3"><div className="flex justify-between items-baseline"><span className="text-[10px] font-black uppercase text-gray-400">Deuda Facturada:</span><span className="font-black text-2xl text-red-500">${clienteData.totalDeuda.toLocaleString()}</span></div></div></Card>
                        <Card title="Acciones"><AppButton onClick={handleGenerarFactura} disabled={selectedRemitos.size === 0} className="w-full h-full py-4 uppercase">Generar Factura (${clienteData.remitosPendientes.filter(r=>selectedRemitos.has(r.id)).reduce((s,r)=>s+getRemitoTotal(r),0).toLocaleString()})</AppButton></Card>
                    </div>
                    <Card title="Remitos Pendientes de Facturación">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 dark:bg-gray-700 dark:text-gray-400"><tr><th className="p-3 w-12 text-center">Sel.</th><th className="p-3">Fecha</th><th className="p-3">Número</th><th className="p-3 text-right">Monto</th></tr></thead>
                                <tbody>{clienteData.remitosPendientes.map(r => (<tr key={r.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"><td className="p-3 text-center"><input type="checkbox" checked={selectedRemitos.has(r.id)} onChange={() => { const ns = new Set(selectedRemitos); if(ns.has(r.id)) ns.delete(r.id); else ns.add(r.id); setSelectedRemitos(ns); }} className="w-5 h-5 rounded" /></td><td className="p-3">{new Date(r.fecha + 'T00:00:00').toLocaleDateString()}</td><td className="p-3 font-mono">{r.puntoVenta}-{r.numero}</td><td className="p-3 text-right font-black text-primary-600 dark:text-primary-400">${getRemitoTotal(r).toLocaleString()}</td></tr>))}</tbody>
                            </table>
                        </div>
                    </Card>
                    <Card title="Facturas Emitidas">
                        <div className="space-y-3">{clienteData.facturasCliente.map(f => {
                            const pagado = (f.pagoIds || []).reduce((s, id) => s + (registrosPago.find(p => p.id === id)?.monto || 0), 0);
                            return (<div key={f.id} className="p-4 border dark:border-gray-700 rounded-2xl bg-white dark:bg-gray-800 flex justify-between items-center shadow-sm"><div><p className="font-black uppercase tracking-tighter">{f.numero}</p><p className="text-[10px] text-gray-400 font-bold uppercase">{new Date(f.fecha + 'T00:00:00').toLocaleDateString()} | Saldo: ${(f.monto - pagado).toLocaleString()}</p></div><AppButton size="sm" onClick={() => setPagandoFacturaInfo({ factura: f, montoRestante: f.monto - pagado })} disabled={f.estado === EstadoFactura.PAGADO}>Pagar</AppButton></div>);
                        })}</div>
                    </Card>
                </div>
            ) : <div className="h-96 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-800/50 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700 text-gray-400 uppercase font-black text-xs tracking-widest">Seleccione un cliente para ver su estado</div>}
        </div>
      </div>
      ) : (
        <LiquidacionAbonosView 
            clientes={clientes}
            remitos={remitos}
            facturas={facturas}
            productos={productos}
            contratos={contratos}
            servicios={servicios}
            addFactura={addFactura as any}
        />
      )}
      {pagandoFacturaInfo && <Modal isOpen={true} onClose={() => setPagandoFacturaInfo(null)}><PagoFacturaForm factura={pagandoFacturaInfo.factura} montoRestante={pagandoFacturaInfo.montoRestante} onSave={(fid, fec, pgs) => { addPagoToFactura(fid, fec, pgs); setPagandoFacturaInfo(null); showNotification('Cobro registrado.', 'success'); }} onClose={() => setPagandoFacturaInfo(null)}/></Modal>}
    </div>
  );
};

export default FacturacionView;
