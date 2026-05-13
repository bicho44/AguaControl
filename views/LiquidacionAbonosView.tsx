
import React, { useState, useMemo, useCallback } from 'react';
import { Cliente, Remito, Factura, Producto, Contrato, Servicio, EstadoContrato, TipoServicio, EstadoFactura } from '../types';
import Card from '../components/Card';
import AppButton from '../components/ui/AppButton';
import AppSelect from '../components/ui/AppSelect';
import { useNotification } from '../context/NotificationContext';
import { getLocalDateString } from '../utils/dateUtils';
import { SearchIcon } from '../components/icons/SearchIcon';
import AppInput from '../components/ui/AppInput';

// Force sync

interface LiquidacionAbonosViewProps {
  clientes: Cliente[];
  remitos: Remito[];
  facturas: Factura[];
  productos: Producto[];
  contratos: Contrato[];
  servicios: Servicio[];
  addFactura: (factura: any) => Promise<void>;
  initialSearchTerm?: string;
}

const LiquidacionAbonosView: React.FC<LiquidacionAbonosViewProps> = ({ 
  clientes, remitos, facturas, productos, contratos, servicios, addFactura, initialSearchTerm = ''
}) => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [observations, setObservations] = useState<Record<string, string>>({});
  const [puntoVenta, setPuntoVenta] = useState<number | ''>('');
  const [numeroComprobante, setNumeroComprobante] = useState<number | ''>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { showNotification } = useNotification();

  const maxFacturas = useMemo(() => {
    const lastPv = facturas.length > 0 ? facturas[facturas.length - 1].puntoVenta || 1 : 1;
    const fncs = facturas.filter(f => f.puntoVenta === lastPv).map(f => f.numeroComprobante || 0);
    return { pv: lastPv, nc: fncs.length > 0 ? Math.max(...fncs) + 1 : 1 };
  }, [facturas]);

  React.useEffect(() => {
    if (puntoVenta === '' && numeroComprobante === '') {
        setPuntoVenta(maxFacturas.pv);
        setNumeroComprobante(maxFacturas.nc);
    }
  }, [maxFacturas, puntoVenta, numeroComprobante]);

  const productosMap = useMemo(() => new Map(productos.map(p => [p.id, p])), [productos]);
  const clientesMap = useMemo(() => new Map(clientes.map(c => [c.id, c])), [clientes]);

  const months = [
    { value: 0, label: 'Enero' }, { value: 1, label: 'Febrero' }, { value: 2, label: 'Marzo' },
    { value: 3, label: 'Abril' }, { value: 4, label: 'Mayo' }, { value: 5, label: 'Junio' },
    { value: 6, label: 'Julio' }, { value: 7, label: 'Agosto' }, { value: 8, label: 'Septiembre' },
    { value: 9, label: 'Octubre' }, { value: 10, label: 'Noviembre' }, { value: 11, label: 'Diciembre' }
  ];

  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => ({ value: currentYear - i, label: (currentYear - i).toString() }));
  }, []);

  const liquidaciones = useMemo(() => {
    const startDate = new Date(selectedYear, selectedMonth, 1);
    const endDate = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59);

    return clientes.map(cliente => {
      // 1. Contratos activos en este mes
      const contratosActivos = contratos.filter(c => 
        c.clienteId === cliente.id && 
        c.estado === EstadoContrato.ACTIVO &&
        new Date(c.fechaInicio) <= endDate
      );

      if (contratosActivos.length === 0) return null;

      // 2. Remitos del mes (Solo los NO facturados)
      const remitosMes = remitos.filter(r => 
        r.clienteId === cliente.id && 
        !r.esAjuste &&
        !r.facturaId && // Inteligencia: Solo remitos sin factura
        new Date(r.fecha + 'T00:00:00') >= startDate &&
        new Date(r.fecha + 'T00:00:00') <= endDate
      );

      // 3. Verificar si el ABONO ya fue facturado este mes
      const conceptoBusqueda = `Liquidación Abonos ${months[selectedMonth].label} ${selectedYear}`;
      const abonoYaFacturado = facturas.some(f => 
        f.clienteId === cliente.id && 
        f.observaciones?.includes(conceptoBusqueda) &&
        f.estado !== EstadoFactura.ANULADO
      );

      if (remitosMes.length === 0 && abonoYaFacturado) return null;

      // 4. Agrupar por producto de consumo (usualmente bidones)
      // Para simplificar, asumimos que el cliente tiene un abono principal
      // Pero el sistema debe ser modular.
      
      interface AbonoResumen {
        montoFijoTotal: number;
        consumoIncluidoTotal: number;
        cantidadServicios: number;
        productoId: string;
      }

      const resumenAbonos: Record<string, AbonoResumen> = {};
      contratosActivos.forEach(c => {
        if (c.tipo !== TipoServicio.ABONO_FIJO) return;
        const prodId = c.productoConsumoId || '';
        if (!resumenAbonos[prodId]) {
          resumenAbonos[prodId] = {
            montoFijoTotal: 0,
            consumoIncluidoTotal: 0,
            cantidadServicios: 0,
            productoId: prodId
          };
        }
        resumenAbonos[prodId].montoFijoTotal += (c.montoMensual || 0);
        resumenAbonos[prodId].consumoIncluidoTotal += (c.consumoIncluido || 0);
        resumenAbonos[prodId].cantidadServicios += 1;
      });

      const detalles = Object.values(resumenAbonos).map((abono: AbonoResumen) => {
        const prod = productosMap.get(abono.productoId);
        const precioEspecial = cliente.preciosEspeciales?.find(p => p.productoId === abono.productoId)?.precio;
        const precioUnitario = precioEspecial ?? prod?.precio ?? 0;

        // Consumo real del mes para este producto
        const consumoReal = remitosMes.reduce((sum, r) => {
          const mov = r.movimientos.find(m => m.productoId === abono.productoId);
          return sum + (mov?.entregados || 0);
        }, 0);

        const promedioPorServicio = consumoReal / abono.cantidadServicios;
        
        let montoAFacturar = 0;
        let concepto = '';
        let esSoloConsumo = false;

        // Si el abono ya se facturó, el monto fijo es 0, solo cobramos excedentes de remitos nuevos
        const montoFijoEfectivo = abonoYaFacturado ? 0 : abono.montoFijoTotal;
        const consumoIncluidoEfectivo = abonoYaFacturado ? 0 : abono.consumoIncluidoTotal;

        // REGLA ESPECIAL: Si supera 10 bidones por servicio, solo se cobra consumo
        if (promedioPorServicio > 10) {
          montoAFacturar = consumoReal * precioUnitario;
          concepto = `Liquidación por Consumo Excedente (>10 b/serv): ${consumoReal} x $${precioUnitario}`;
          esSoloConsumo = true;
        } else {
          const excedente = Math.max(0, consumoReal - consumoIncluidoEfectivo);
          montoAFacturar = montoFijoEfectivo + (excedente * precioUnitario);
          
          if (abonoYaFacturado) {
            concepto = `Excedente de nuevos remitos (${excedente} b.)`;
          } else {
            concepto = `Abono Mensual (${abono.cantidadServicios} serv.) + Excedente (${excedente} b.)`;
          }
        }

        return {
          ...abono,
          productoNombre: prod?.nombre || 'Producto Desconocido',
          consumoReal,
          precioUnitario,
          montoAFacturar,
          concepto,
          esSoloConsumo,
          promedioPorServicio
        };
      });

      const totalAFacturar = detalles.reduce((sum, d) => sum + d.montoAFacturar, 0);
      
      return {
        cliente,
        detalles,
        totalAFacturar,
        remitosIds: remitosMes.map(r => r.id),
        yaFacturado: false // Ya filtramos arriba, si llega aquí es porque hay algo pendiente
      };
    }).filter(l => l !== null && l.totalAFacturar > 0) as any[];
  }, [clientes, remitos, facturas, productosMap, contratos, selectedMonth, selectedYear]);

  const filteredLiquidaciones = useMemo(() => {
    if (!searchTerm) return liquidaciones;
    return liquidaciones.filter(l => l.cliente.nombre.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [liquidaciones, searchTerm]);

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const pendingToInvoice = useMemo(() => 
    filteredLiquidaciones.filter(l => !l.yaFacturado),
    [filteredLiquidaciones]
  );

  const allFilteredSelected = useMemo(() => 
    pendingToInvoice.length > 0 && pendingToInvoice.every(l => selectedIds.includes(l.cliente.id)),
    [pendingToInvoice, selectedIds]
  );

  const handleSelectAll = () => {
    if (allFilteredSelected) {
      const filteredIds = pendingToInvoice.map(l => l.cliente.id);
      setSelectedIds(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      const filteredIds = pendingToInvoice.map(l => l.cliente.id);
      setSelectedIds(prev => Array.from(new Set([...prev, ...filteredIds])));
    }
  };

  const handleFacturar = async (liq: any) => {
    if (puntoVenta === '' || numeroComprobante === '') {
        showNotification('Debe establecer Punto Venta y Nro Comprobante inicial en las opciones.', 'error');
        return;
    }
    try {
      await addFactura({
        clienteId: liq.cliente.id,
        fecha: getLocalDateString(),
        monto: liq.totalAFacturar,
        remitosIds: liq.remitosIds,
        puntoVenta: Number(puntoVenta),
        numeroComprobante: Number(numeroComprobante),
        concepto: `Liquidación Abonos ${months[selectedMonth].label} ${selectedYear}`,
        observaciones: observations[liq.cliente.id] || ''
      });
      showNotification(`Factura generada para ${liq.cliente.nombre}`, 'success');
      setNumeroComprobante(prev => prev === '' ? '' : Number(prev) + 1);
      setSelectedIds(prev => prev.filter(id => id !== liq.cliente.id));
      setObservations(prev => {
        const next = { ...prev };
        delete next[liq.cliente.id];
        return next;
      });
    } catch (e) {
      showNotification('Error al generar factura', 'error');
    }
  };

  const handleFacturarSeleccionados = async () => {
    if (puntoVenta === '' || numeroComprobante === '') {
        showNotification('Debe establecer Punto Venta y Nro Comprobante inicial en las opciones.', 'error');
        return;
    }
    const toInvoice = filteredLiquidaciones.filter(l => selectedIds.includes(l.cliente.id) && !l.yaFacturado);
    if (toInvoice.length === 0) return;

    let successCount = 0;
    let nroCurrent = Number(numeroComprobante);
    for (const liq of toInvoice) {
      try {
        await addFactura({
          clienteId: liq.cliente.id,
          fecha: getLocalDateString(),
          monto: liq.totalAFacturar,
          remitosIds: liq.remitosIds,
          puntoVenta: Number(puntoVenta),
          numeroComprobante: nroCurrent,
          concepto: `Liquidación Abonos ${months[selectedMonth].label} ${selectedYear}`,
          observaciones: observations[liq.cliente.id] || ''
        });
        nroCurrent++;
        successCount++;
      } catch (e) {
        console.error(`Error facturando a ${liq.cliente.nombre}:`, e);
      }
    }

    if (successCount > 0) {
      showNotification(`${successCount} facturas generadas correctamente`, 'success');
      setNumeroComprobante(nroCurrent);
      setSelectedIds([]);
      setObservations({});
    } else {
      showNotification('Error al generar las facturas seleccionadas', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-2xl font-black uppercase tracking-tighter italic text-gray-800 dark:text-white">Liquidación Mensual de Abonos</h2>
        <div className="flex items-center gap-2">
          <AppSelect 
            value={selectedMonth} 
            onChange={e => setSelectedMonth(Number(e.target.value))} 
            options={months} 
          />
          <AppSelect 
            value={selectedYear} 
            onChange={e => setSelectedYear(Number(e.target.value))} 
            options={years} 
          />
        </div>
      </div>

      <Card>
        <div className="p-4 border-b dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="relative flex-1">
                <AppInput 
                    placeholder="Filtrar por nombre de cliente..." 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)} 
                    className="pl-10 pr-10"
                />
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <SearchIcon className="h-5 w-5 text-gray-400" />
                </div>
                {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm('')}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </button>
                )}
            </div>
            {selectedIds.length > 0 && (
              <AppButton 
                onClick={handleFacturarSeleccionados}
                className="bg-primary-600 hover:bg-primary-700 text-white"
              >
                Facturar Seleccionados ({selectedIds.length})
              </AppButton>
            )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="p-4 w-10">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                    checked={allFilteredSelected}
                    onChange={handleSelectAll}
                  />
                </th>
                <th className="p-4">Cliente</th>
                <th className="p-4">Detalle Abonos</th>
                <th className="p-4 text-right">Consumo Real</th>
                <th className="p-4 text-right">Monto Total</th>
                <th className="p-4">Observaciones</th>
                <th className="p-4 text-center">Acción</th>
              </tr>
            </thead>
            <tbody>
              {filteredLiquidaciones.map((liq, idx) => (
                <tr key={idx} className={`border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${selectedIds.includes(liq.cliente.id) ? 'bg-primary-50/50 dark:bg-primary-900/10' : ''}`}>
                  <td className="p-4">
                    {!liq.yaFacturado && (
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                        checked={selectedIds.includes(liq.cliente.id)}
                        onChange={() => handleToggleSelect(liq.cliente.id)}
                      />
                    )}
                  </td>
                  <td className="p-4">
                    <p className="font-bold text-gray-800 dark:text-white">{liq.cliente.nombre}</p>
                    <p className="text-[10px] text-gray-400 uppercase font-bold">{liq.remitosIds.length} remitos en el mes</p>
                  </td>
                  <td className="p-4">
                    {liq.detalles.map((d: any, i: number) => (
                      <div key={i} className="mb-1">
                        <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                          {d.productoNombre}: {d.concepto}
                        </p>
                        {d.esSoloConsumo && (
                          <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-black uppercase">Exceso &gt; 10 b/serv</span>
                        )}
                      </div>
                    ))}
                  </td>
                  <td className="p-4 text-right font-mono font-bold">
                    {liq.detalles.reduce((s: number, d: any) => s + d.consumoReal, 0)} b.
                  </td>
                  <td className="p-4 text-right">
                    <p className="font-black text-lg text-primary-600 dark:text-primary-400">${liq.totalAFacturar.toLocaleString('es-AR')}</p>
                  </td>
                  <td className="p-4">
                    <input 
                      type="text"
                      placeholder="Nota..."
                      className="w-full text-xs p-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg outline-none focus:ring-1 focus:ring-primary-500"
                      value={observations[liq.cliente.id] || ''}
                      onChange={(e) => setObservations(prev => ({ ...prev, [liq.cliente.id]: e.target.value }))}
                    />
                  </td>
                  <td className="p-4 text-center">
                    {liq.yaFacturado ? (
                      <span className="text-[10px] font-black uppercase text-green-500 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded">Ya Facturado</span>
                    ) : (
                      <AppButton size="sm" onClick={() => handleFacturar(liq)}>Facturar</AppButton>
                    )}
                  </td>
                </tr>
              ))}
              {filteredLiquidaciones.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-gray-400 uppercase font-black text-xs tracking-widest">
                    No hay abonos pendientes de liquidar para este período
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      
      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-800">
        <h4 className="text-xs font-black uppercase text-blue-600 dark:text-blue-400 mb-2">Información sobre la mecánica</h4>
        <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
          El sistema calcula automáticamente el abono mensual sumando todos los contratos activos del cliente. 
          Si el consumo promedio por servicio supera los 10 bidones, se anula el cargo fijo y se factura únicamente el consumo real al precio unitario. 
          De lo contrario, se factura el cargo fijo más los bidones excedentes (Consumo Real - Consumo Incluido).
        </p>
      </div>
    </div>
  );
};

export default LiquidacionAbonosView;
