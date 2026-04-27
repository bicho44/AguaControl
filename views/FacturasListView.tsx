
import React, { useState, useMemo, useCallback } from 'react';
import { Factura, Cliente, RegistroPago, EstadoFactura, PagoDetalle, MetodoPago, Remito, EmpresaSettings, Producto } from '../types';
import Card from '../components/Card';
import SearchableSelect from '../components/SearchableSelect';
import Modal from '../components/Modal';
import AppInput from '../components/ui/AppInput';
import AppSelect from '../components/ui/AppSelect';
import AppButton from '../components/ui/AppButton';
import { useNotification } from '../context/NotificationContext';
import { TrashIcon } from '../components/icons/TrashIcon';
import { ChevronDownIcon } from '../components/icons/ChevronDownIcon';
import { generateInvoicePDF } from '../utils/invoiceGenerator';
import { getLocalDateString } from '../utils/dateUtils';

// Force sync

interface FacturasListViewProps {
  facturas: Factura[];
  clientes: Cliente[];
  remitos: Remito[];
  productos: Producto[];
  registrosPago: RegistroPago[];
  addPagoToFactura: (facturaId: string, fecha: string, pagos: PagoDetalle[]) => void;
  empresaSettings: EmpresaSettings;
  markFacturaAsSent: (facturaId: string) => void;
}

const PagoFacturaForm: React.FC<{
    factura: Factura;
    montoRestante: number;
    onSave: (facturaId: string, fecha: string, pagos: PagoDetalle[]) => void;
    onClose: () => void;
}> = ({ factura, montoRestante, onSave, onClose }) => {
    const montoInicial = Math.round(montoRestante * 100) / 100;
    const [pagos, setPagos] = useState<PagoDetalle[]>([{ monto: montoInicial, metodo: MetodoPago.EFECTIVO }]);
    const [fecha, setFecha] = useState(getLocalDateString());

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
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white pr-12">Registrar Pago para Factura {factura.numero}</h2>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    <span>Total Factura: <strong>${factura.monto.toLocaleString('es-AR')}</strong></span>
                    <span className="mx-2">|</span>
                    <span>Saldo Restante: <strong>${montoRestante.toLocaleString('es-AR')}</strong></span>
                </div>
            </div>
            
            <AppInput 
                type="date" 
                label="Fecha de Pago" 
                value={fecha} 
                onChange={e => setFecha(e.target.value)} 
                required 
            />
            
            <fieldset className="border-t dark:border-gray-600 pt-4">
                <legend className="text-lg font-medium text-gray-800 dark:text-white px-2">Detalle de Pago</legend>
                <div className="space-y-4 mt-2 max-h-60 overflow-y-auto pr-2">
                    {pagos.map((pago, index) => (
                        <div key={index} className="flex gap-4 items-end">
                            <div className="flex-1">
                                <AppInput 
                                    type="number" 
                                    label="Monto"
                                    value={pago.monto} 
                                    onChange={e => handlePagoChange(index, 'monto', e.target.value)} 
                                    placeholder="Monto" 
                                    step="0.01" 
                                    required 
                                />
                            </div>
                            <div className="flex-1">
                                <AppSelect 
                                    label="Método de Pago"
                                    value={pago.metodo} 
                                    onChange={e => handlePagoChange(index, 'metodo', e.target.value as MetodoPago)}
                                    options={Object.values(MetodoPago).map(m => ({ value: m, label: m }))}
                                />
                            </div>
                            <div>
                                <AppButton type="button" variant="danger" onClick={() => removePago(index)} title="Eliminar pago">
                                    <TrashIcon className="h-5 w-5" />
                                </AppButton>
                            </div>
                        </div>
                    ))}
                </div>
                <AppButton type="button" variant="secondary" onClick={addPago} className="w-full border-dashed border-2 mt-4">+ Agregar forma de pago</AppButton>
            </fieldset>

            <div className="flex justify-end gap-2 pt-4">
                <AppButton type="button" variant="secondary" onClick={onClose}>Cancelar</AppButton>
                <AppButton type="submit" variant="primary">Guardar Pago</AppButton>
            </div>
        </form>
    );
};


const FacturasListView: React.FC<FacturasListViewProps> = ({ facturas, clientes, remitos, productos, registrosPago, addPagoToFactura, empresaSettings, markFacturaAsSent }) => {
  const [clienteFilter, setClienteFilter] = useState('');
  const [dateFilter, setDateFilter] = useState({ from: '', to: '' });
  const [pagandoFacturaInfo, setPagandoFacturaInfo] = useState<{ factura: Factura; montoRestante: number } | null>(null);
  const [expandedFacturaId, setExpandedFacturaId] = useState<string | null>(null);
  const { showNotification } = useNotification();


  const clientesMap = useMemo(() => new Map(clientes.map(c => [c.id, c])), [clientes]);
  const clienteOptions = useMemo(() => clientes.map(c => ({ 
      value: c.id, 
      label: c.nombre,
      searchTerms: [c.direccionFiscal, ...(c.sucursales || []).map(s => s.direccion), ...(c.telefonos || []).map(t => t.numero)].filter(Boolean).join(' ')
  })), [clientes]);
  const remitosMap = useMemo(() => new Map(remitos.map(r => [r.id, r])), [remitos]);
  const productosMap = useMemo(() => new Map(productos.map(p => [p.id, p])), [productos]);


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

  const handleDownloadPDF = async (factura: Factura) => {
      try {
          const cliente = clientesMap.get(factura.clienteId);
          if (!cliente) {
              showNotification('No se encontró el cliente de la factura.', 'error');
              return;
          }
          const remitosFactura = factura.remitosIds.map(id => remitosMap.get(id)).filter(r => r !== undefined) as Remito[];
          
          showNotification('Generando PDF...', 'success');
          const success = await generateInvoicePDF(factura, cliente, remitosFactura, productos, empresaSettings, 'print'); // Modo Print (A5 Doble)
          
          if (!success) {
              showNotification('Error al generar el PDF.', 'error');
          } else {
              showNotification('PDF generado con éxito.', 'success');
          }
      } catch (error) {
          console.error(error);
          showNotification('Error al generar el PDF.', 'error');
      }
  };

  const handleSendEmail = async (factura: Factura) => {
      try {
          const cliente = clientesMap.get(factura.clienteId);
          if (!cliente) return;
          
          if (!cliente.emails || cliente.emails.length === 0) {
              showNotification('El cliente no tiene email configurado.', 'error');
              return;
          }

          const remitosFactura = factura.remitosIds.map(id => remitosMap.get(id)).filter(r => r !== undefined) as Remito[];
          
          showNotification('Generando PDF para envío...', 'success');

          // 1. Generar y descargar PDF (Modo Email - Vertical)
          const pdfGenerated = await generateInvoicePDF(factura, cliente, remitosFactura, productos, empresaSettings, 'email');
          
          if (!pdfGenerated) {
              showNotification('Error al generar el PDF. No se puede enviar el correo.', 'error');
              return;
          }

          showNotification('PDF descargado. Preparando correo...', 'success');

          // 2. Preparar Template
          const template = empresaSettings.emailTemplate || {
              asunto: "Factura {{numero}}",
              cuerpo: "Adjuntamos su factura."
          };

          // Generar lista DETALLADA de remitos para el cuerpo del mail
          const remitosListText = remitosFactura.map(r => {
              const header = `- Remito N° ${r.puntoVenta}-${r.numero} (${new Date(r.fecha + 'T00:00:00').toLocaleDateString('es-AR')}):`;
              const items = r.movimientos
                  .filter(m => m.entregados > 0)
                  .map(m => {
                      const prod = productosMap.get(m.productoId);
                      return `    * ${m.entregados} x ${prod?.nombre || 'Producto'}`;
                  }).join('\n');
              
              return items ? `${header}\n${items}` : `${header} (Sin productos entregados)`;
          }).join('\n\n');

          const replacements: Record<string, string> = {
              '{{cliente}}': cliente.nombre,
              '{{numero}}': factura.numero,
              '{{monto}}': factura.monto.toLocaleString('es-AR'),
              '{{fecha}}': new Date(factura.fecha + 'T00:00:00').toLocaleDateString('es-AR'),
              '{{empresa}}': empresaSettings.nombreFantasia || empresaSettings.nombre,
              '{{remitos}}': remitosListText
          };

          let subject = template.asunto;
          let body = template.cuerpo;

          Object.entries(replacements).forEach(([key, value]) => {
              subject = subject.replace(new RegExp(key, 'g'), value);
              body = body.replace(new RegExp(key, 'g'), value);
          });

          // 3. Abrir Mailto CON RETRASO para asegurar que la descarga del PDF inicie primero
          setTimeout(() => {
              const encodedSubject = encodeURIComponent(subject);
              // replace \n with %0D%0A for proper line breaks in mailto body
              const encodedBody = encodeURIComponent(body).replace(/%0A/g, '%0D%0A');
              const mailtoLink = `mailto:${cliente.emails![0]}?subject=${encodedSubject}&body=${encodedBody}`;
              
              const link = document.createElement('a');
              link.href = mailtoLink;
              link.target = '_self'; // Evita abrir pestaña en blanco innecesaria
              link.click();

              // 4. Marcar como enviado
              markFacturaAsSent(factura.id);
              showNotification('Cliente de correo abierto. Adjunte el PDF descargado.', 'success');
          }, 3000); // 3 segundos de espera

      } catch (error) {
          console.error(error);
          showNotification('Error al preparar el envío.', 'error');
      }
  };


  const filteredFacturas = useMemo(() => {
    return facturas.filter(f => {
      const clienteMatch = !clienteFilter || f.clienteId === clienteFilter;
      if (!clienteMatch) return false;

      const facturaDate = new Date(f.fecha + 'T00:00:00');
      const fromDate = dateFilter.from ? new Date(dateFilter.from + 'T00:00:00') : null;
      const toDate = dateFilter.to ? new Date(dateFilter.to + 'T00:00:00') : null;

      if (fromDate && facturaDate < fromDate) return false;
      if (toDate && facturaDate > toDate) return false;

      return true;
    }).sort((a, b) => {
        const dateComparison = new Date(b.fecha + 'T00:00:00').getTime() - new Date(a.fecha + 'T00:00:00').getTime();
        if (dateComparison !== 0) return dateComparison;
        return parseInt(b.numero.split('-')[2]) - parseInt(a.numero.split('-')[2]);
    });
  }, [facturas, clienteFilter, dateFilter]);

  return (
    <div className="space-y-6 pt-12 md:pt-0">
      <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Listado de Facturas</h1>

      <Card>
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <SearchableSelect
              label="Cliente"
              options={clienteOptions}
              value={clienteFilter}
              onChange={setClienteFilter}
              placeholder="Todos los Clientes"
            />
          </div>
          <div className="flex-1 min-w-[140px]">
            <AppInput type="date" label="Desde" value={dateFilter.from} onChange={(e) => setDateFilter(prev => ({ ...prev, from: e.target.value }))} />
          </div>
          <div className="flex-1 min-w-[140px]">
            <AppInput type="date" label="Hasta" value={dateFilter.to} onChange={(e) => setDateFilter(prev => ({ ...prev, to: e.target.value }))} />
          </div>
          <div>
            <AppButton variant="secondary" onClick={() => { setClienteFilter(''); setDateFilter({ from: '', to: '' }); }}>Limpiar</AppButton>
          </div>
        </div>
        <div className="space-y-2 p-2">
            {filteredFacturas.map(factura => {
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
                
                return(
                    <div key={factura.id} className="bg-white dark:bg-gray-800 rounded-md shadow-sm border dark:border-gray-700">
                        <div className="flex items-center p-4 cursor-pointer" onClick={() => setExpandedFacturaId(isExpanded ? null : factura.id)}>
                            <div className="flex-grow grid grid-cols-2 sm:grid-cols-5 gap-4 items-center">
                                <div>
                                    <p className="text-xs text-gray-500">Fecha</p>
                                    <p className="font-medium text-gray-900 dark:text-white">{new Date(factura.fecha + 'T00:00:00').toLocaleDateString('es-AR')}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Número</p>
                                    <div className="flex items-center gap-2">
                                        <p className="font-medium text-gray-900 dark:text-white font-mono">{factura.numero}</p>
                                        {factura.enviada && (
                                            <span className="text-green-500" title="Enviada por email">
                                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" /><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" /></svg>
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Cliente</p>
                                    <p className="font-medium text-gray-900 dark:text-white truncate">{clientesMap.get(factura.clienteId)?.nombre || 'N/A'}</p>
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
                            <div className="flex items-center pl-4 gap-2">
                                {factura.estado !== EstadoFactura.PAGADO && factura.estado !== EstadoFactura.ANULADO && (
                                    <AppButton variant="success" size="sm" onClick={(e) => { e.stopPropagation(); handleOpenPagoModal(factura); }}>
                                        Pagar
                                    </AppButton>
                                )}
                                <AppButton 
                                    variant="secondary"
                                    size="sm"
                                    onClick={(e) => { e.stopPropagation(); handleDownloadPDF(factura); }} 
                                    className="!p-2"
                                    title="Descargar PDF (Impresión)"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                                </AppButton>
                                <AppButton 
                                    variant="secondary"
                                    size="sm"
                                    onClick={(e) => { e.stopPropagation(); handleSendEmail(factura); }} 
                                    className={`!p-2 ${factura.enviada ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 border-transparent' : 'bg-primary-100 text-primary-700 hover:bg-primary-200 dark:bg-primary-900/50 dark:text-primary-300 border-transparent'}`}
                                    title="Enviar por Email"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                </AppButton>
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
                                                            <span>{pago?.metodo} ({new Date(pago?.fecha + 'T00:00:00').toLocaleDateString('es-AR')})</span>
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
                )
            })}
          {filteredFacturas.length === 0 && <p className="text-center p-8 text-gray-500">No se encontraron facturas con los filtros seleccionados.</p>}
        </div>
      </Card>
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

export default FacturasListView;
