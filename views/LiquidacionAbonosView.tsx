
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
}

const LiquidacionAbonosView: React.FC<LiquidacionAbonosViewProps> = ({ 
  clientes, remitos, facturas, productos, contratos, servicios, addFactura 
}) => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [searchTerm, setSearchTerm] = useState('');
  const { showNotification } = useNotification();

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

      // 2. Remitos del mes
      const remitosMes = remitos.filter(r => 
        r.clienteId === cliente.id && 
        !r.esAjuste &&
        new Date(r.fecha + 'T00:00:00') >= startDate &&
        new Date(r.fecha + 'T00:00:00') <= endDate
      );

      // 3. Agrupar por producto de consumo (usualmente bidones)
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

        // REGLA ESPECIAL: Si supera 10 bidones por servicio, solo se cobra consumo
        if (promedioPorServicio > 10) {
          montoAFacturar = consumoReal * precioUnitario;
          concepto = `Liquidación por Consumo Excedente (>10 b/serv): ${consumoReal} x $${precioUnitario}`;
          esSoloConsumo = true;
        } else {
          const excedente = Math.max(0, consumoReal - abono.consumoIncluidoTotal);
          montoAFacturar = abono.montoFijoTotal + (excedente * precioUnitario);
          concepto = `Abono Mensual (${abono.cantidadServicios} serv.) + Excedente (${excedente} b.)`;
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
      
      // Verificar si ya tiene factura generada para este mes/tipo
      const yaFacturado = facturas.some(f => 
        f.clienteId === cliente.id && 
        new Date(f.fecha).getMonth() === selectedMonth &&
        new Date(f.fecha).getFullYear() === selectedYear &&
        f.monto === totalAFacturar // Simplificación: si el monto coincide, asumimos que es la misma
      );

      return {
        cliente,
        detalles,
        totalAFacturar,
        remitosIds: remitosMes.map(r => r.id),
        yaFacturado
      };
    }).filter(l => l !== null && l.totalAFacturar > 0) as any[];
  }, [clientes, remitos, facturas, productosMap, contratos, selectedMonth, selectedYear]);

  const filteredLiquidaciones = useMemo(() => {
    if (!searchTerm) return liquidaciones;
    return liquidaciones.filter(l => l.cliente.nombre.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [liquidaciones, searchTerm]);

  const handleFacturar = async (liq: any) => {
    try {
      await addFactura({
        clienteId: liq.cliente.id,
        fecha: getLocalDateString(),
        monto: liq.totalAFacturar,
        remitosIds: liq.remitosIds,
        concepto: `Liquidación Abonos ${months[selectedMonth].label} ${selectedYear}`
      });
      showNotification(`Factura generada para ${liq.cliente.nombre}`, 'success');
    } catch (e) {
      showNotification('Error al generar factura', 'error');
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
        <div className="p-4 border-b dark:border-gray-700">
            <div className="relative">
                <AppInput 
                    placeholder="Buscar cliente..." 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)} 
                    className="pl-10"
                />
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <SearchIcon className="h-5 w-5 text-gray-400" />
                </div>
            </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="p-4">Cliente</th>
                <th className="p-4">Detalle Abonos</th>
                <th className="p-4 text-right">Consumo Real</th>
                <th className="p-4 text-right">Monto Total</th>
                <th className="p-4 text-center">Acción</th>
              </tr>
            </thead>
            <tbody>
              {filteredLiquidaciones.map((liq, idx) => (
                <tr key={idx} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
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
