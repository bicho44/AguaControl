
import React, { useState, useCallback, useMemo } from 'react';
import Card from '../components/Card';
import { Cliente, Remito, Telefono, TipoFacturacion, TipoTelefono, EstadoCliente, EstadoProducto, TipoProducto, Producto, PrecioEspecial, Sucursal } from '../types';
import { UploadIcon } from '../components/icons/UploadIcon';
import { useNotification } from '../context/NotificationContext';
import AppButton from '../components/ui/AppButton';
import AppSelect from '../components/ui/AppSelect';

interface ImportarViewProps {
  clientes: Cliente[];
  remitos: Remito[];
  productos?: Producto[]; // Opcional por seguridad
  addMultipleClientes: (clientes: Cliente[]) => Promise<void>;
  deleteAllClientes: () => Promise<void>;
}

type Step = 'upload' | 'mapping' | 'executing';

const ImportarView: React.FC<ImportarViewProps> = ({ clientes, remitos, productos = [], addMultipleClientes, deleteAllClientes }) => {
  const [currentStep, setCurrentStep] = useState<Step>('upload');
  const [fileData, setFileData] = useState<{ headers: string[], rows: any[] } | null>(null);
  const [ivaMapping, setIvaMapping] = useState<Record<string, TipoFacturacion>>({});
  const [productMapping, setProductMapping] = useState<Record<string, string>>({}); 
  const [isReplacing, setIsReplacing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { showNotification } = useNotification();

  const activeProducts = useMemo(() => (productos || []).filter(p => p.state === undefined || p.estado === EstadoProducto.ACTIVO), [productos]);

  const parseCSV = (csvText: string): string[][] => {
      const rows: string[][] = [];
      let currentRow: string[] = [];
      let currentCell = '';
      let inQuotes = false;
      for (let i = 0; i < csvText.length; i++) {
          const char = csvText[i];
          const nextChar = csvText[i + 1];
          if (char === '"') {
              if (inQuotes && nextChar === '"') { currentCell += '"'; i++; } else { inQuotes = !inQuotes; }
          } else if (char === ',' && !inQuotes) {
              currentRow.push(currentCell.trim()); currentCell = '';
          } else if ((char === '\r' || char === '\n') && !inQuotes) {
              currentRow.push(currentCell.trim());
              // Evitar filas vacías
              if (currentRow.length > 0 && currentRow.some(c => c !== '')) { rows.push(currentRow); }
              currentRow = []; currentCell = '';
              if (char === '\r' && nextChar === '\n') i++;
          } else { currentCell += char; }
      }
      if (currentCell || (currentRow.length > 0 && currentRow.some(c => c !== ''))) { currentRow.push(currentCell.trim()); rows.push(currentRow); }
      return rows;
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const text = event.target?.result as string;
                const rows = parseCSV(text);
                const rawHeaders = rows.shift();
                if (!rawHeaders) throw new Error("Archivo vacío");
                
                const headers = rawHeaders.map(h => h.toLowerCase().trim());
                // Filtrar filas basura que a veces vienen al final
                const dataRows = rows
                    .filter(row => row.length > 0 && row.some(cell => cell.trim() !== ''))
                    .map(row => Object.fromEntries(headers.map((h, i) => [h, row[i] || ''])));
                
                if (dataRows.length === 0) throw new Error("No se encontraron datos válidos en el archivo.");

                setFileData({ headers, rows: dataRows });

                // 1. Mapeo Automático de IVA
                const ivaCol = headers.find(h => h.includes('cond_iva'));
                if (ivaCol) {
                    const uniqueIva = [...new Set(dataRows.map(r => r[ivaCol]).filter(v => v))];
                    const initialIvaMap: Record<string, TipoFacturacion> = {};
                    uniqueIva.forEach(val => {
                        const v = val.toLowerCase();
                        if (v.includes('ins') || v.includes('ri')) initialIvaMap[val] = TipoFacturacion.RESPONSABLE_INSCRIPTO;
                        else if (v.includes('mono')) initialIvaMap[val] = TipoFacturacion.MONOTRIBUTO;
                        else if (v.includes('exe')) initialIvaMap[val] = TipoFacturacion.EXENTO;
                        else initialIvaMap[val] = TipoFacturacion.CONSUMIDOR_FINAL;
                    });
                    setIvaMapping(initialIvaMap);
                }

                // 2. Mapeo Automático de Productos
                const initialProdMap: Record<string, string> = {};
                headers.forEach(h => {
                    if (h.startsWith('cant_')) {
                        if (h.includes('20')) initialProdMap[h] = activeProducts.find(p => p.nombre.includes('20'))?.id || '';
                        else if (h.includes('12')) initialProdMap[h] = activeProducts.find(p => p.nombre.includes('12'))?.id || '';
                        else if (h.includes('fcp')) initialProdMap[h] = activeProducts.find(p => p.tipo === TipoProducto.EQUIPO)?.id || '';
                        else initialProdMap[h] = '';
                    }
                });
                setProductMapping(initialProdMap);

                setCurrentStep('mapping');
            } catch (err: any) { 
                showNotification(`Error al leer archivo: ${err.message}`, 'error'); 
            }
        };
        reader.readAsText(file);
    }
  };

  const handleExecuteImport = async () => {
      if (!fileData) return;
      setIsProcessing(true);
      try {
          if (isReplacing) {
              showNotification("Limpiando base de datos...", "success");
              await deleteAllClientes();
          }

          const clientGroups = new Map<string, any[]>();
          fileData.rows.forEach(row => {
              // Asegurarnos de tener un código, sino saltamos la fila
              const madreId = (row.codigo_madre || row.codigo || '').toString().trim();
              if (!madreId) return;

              if (!clientGroups.has(madreId)) clientGroups.set(madreId, []);
              clientGroups.get(madreId)!.push(row);
          });

          const finalClientes: any[] = [];
          clientGroups.forEach((branchRows, madreId) => {
              const mainRow = branchRows.find(r => r.codigo === madreId) || branchRows[0];
              
              const sucursales: Sucursal[] = branchRows.map(r => ({
                  id: (r.codigo || `suc_${Date.now()}_${Math.random()}`).toString(),
                  nombre: branchRows.length > 1 ? (r.nombre || `Sucursal ${r.codigo}`) : 'Principal',
                  direccion: `${r.direccion || ''} ${r.localidad || ''}`.trim()
              }));

              const initialStocks: any[] = [];
              branchRows.forEach(r => {
                  Object.entries(productMapping).forEach(([col, pId]) => {
                      const qty = Number(r[col]);
                      if (pId && !isNaN(qty) && qty > 0) {
                          initialStocks.push({ productoId: pId, cantidad: qty, sucursalId: r.codigo });
                      }
                  });
              });

              finalClientes.push({
                  id: madreId,
                  nombre: mainRow.nombre || 'Sin Nombre',
                  nombreFiscal: mainRow.nombrefiscal || undefined,
                  estado: EstadoCliente.ACTIVO,
                  cuit: mainRow.cuit || '',
                  tipoFacturacion: ivaMapping[mainRow.cond_iva] || TipoFacturacion.CONSUMIDOR_FINAL,
                  tieneCuentaCorriente: (mainRow.cond_pago || '').toLowerCase().includes('cta') || false,
                  telefonos: [
                      ...(mainRow.telefono ? [{ tipo: TipoTelefono.LOCAL, numero: mainRow.telefono }] : []),
                      ...(mainRow['te. movil'] ? [{ tipo: TipoTelefono.CEL, numero: mainRow['te. movil'] }] : [])
                  ],
                  emails: mainRow.email ? [mainRow.email] : [],
                  sucursales,
                  stockInicial: initialStocks
              });
          });

          if (finalClientes.length === 0) throw new Error("No hay clientes válidos para importar (falta columna Código).");

          await addMultipleClientes(finalClientes);
          showNotification(`¡Éxito! ${finalClientes.length} clientes procesados.`, 'success');
          setCurrentStep('upload');
          setFileData(null);
      } catch (err: any) { 
          showNotification(`Error en importación: ${err.message}`, 'error'); 
      }
      finally { setIsProcessing(false); }
  };

  return (
    <div className="space-y-6 pt-12 md:pt-0 pb-12">
      <h1 className="text-3xl font-black text-gray-800 dark:text-white uppercase tracking-tighter">Asistente de Importación</h1>
      
      {currentStep === 'upload' && (
          <Card title="Paso 1: Seleccionar Archivo">
              <div className="space-y-6">
                  <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-800">
                      <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed font-mono">
                        Columnas requeridas: Codigo, Nombre, Direccion, Localidad, Cant_B20, Cant_B12, Cant_FCP, Codigo_Madre, CUIT, COND_IVA, COND_PAGO...
                      </p>
                  </div>
                  <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <UploadIcon />
                          <p className="mt-2 text-sm text-gray-500 font-bold">Clic para seleccionar el listado CSV</p>
                      </div>
                      <input type="file" className="hidden" accept=".csv" onChange={handleFileChange} />
                  </label>
              </div>
          </Card>
      )}

      {currentStep === 'mapping' && (
          <div className="space-y-6 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card title="Mapeo de IVA">
                      <div className="space-y-4">
                          <p className="text-xs text-gray-500">Mapee los valores encontrados en la columna <span className="font-bold">COND_IVA</span>.</p>
                          {Object.keys(ivaMapping).length > 0 ? Object.keys(ivaMapping).map(val => (
                              <div key={val} className="flex flex-col gap-1">
                                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{val}</span>
                                  <AppSelect 
                                    value={ivaMapping[val]} 
                                    onChange={(e) => setIvaMapping({...ivaMapping, [val]: e.target.value as any})}
                                    options={Object.values(TipoFacturacion).map(v => ({value: v, label: v}))}
                                  />
                              </div>
                          )) : <p className="text-xs text-red-500 font-bold">No se detectó columna COND_IVA</p>}
                      </div>
                  </Card>

                  <Card title="Mapeo de Productos">
                      <div className="space-y-4">
                          <p className="text-xs text-gray-500">Asigne productos a las columnas de cantidades detectadas.</p>
                          {Object.keys(productMapping).length > 0 ? Object.keys(productMapping).map(col => (
                              <div key={col} className="flex flex-col gap-1">
                                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Columna: {col}</span>
                                  <AppSelect 
                                    value={productMapping[col]} 
                                    onChange={(e) => setProductMapping({...productMapping, [col]: e.target.value})}
                                    options={[{value: '', label: '-- Ignorar Columna --'}, ...activeProducts.map(p => ({value: p.id, label: p.nombre}))]}
                                  />
                              </div>
                          )) : <p className="text-xs text-red-500 font-bold">No se detectaron columnas que empiecen con "Cant_"</p>}
                      </div>
                  </Card>
              </div>

              <Card title="Confirmación y Acción">
                  <div className="space-y-6">
                      <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-2xl border dark:border-gray-600 flex items-center justify-between">
                          <div>
                              <p className="font-bold text-gray-800 dark:text-white">Acción al importar</p>
                              <p className="text-xs text-gray-500">{isReplacing ? '⚠ CUIDADO: Se borrarán todos los clientes, remitos y facturas actuales.' : 'Se agregarán los nuevos clientes manteniendo los existentes.'}</p>
                          </div>
                          <div className="flex gap-2">
                              <button onClick={() => setIsReplacing(false)} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${!isReplacing ? 'bg-primary-600 text-white shadow-lg' : 'bg-white dark:bg-gray-700 text-gray-500 border dark:border-gray-600'}`}>Sumar</button>
                              <button onClick={() => setIsReplacing(true)} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${isReplacing ? 'bg-red-600 text-white shadow-lg' : 'bg-white dark:bg-gray-700 text-gray-500 border dark:border-gray-600'}`}>REEMPLAZAR TODO</button>
                          </div>
                      </div>

                      <div className="flex gap-3 justify-end">
                          <AppButton variant="secondary" onClick={() => setCurrentStep('upload')}>Volver a Cargar Archivo</AppButton>
                          <AppButton onClick={handleExecuteImport} isLoading={isProcessing} size="lg" className="px-12 shadow-xl">Iniciar Importación</AppButton>
                      </div>
                  </div>
              </Card>
          </div>
      )}
    </div>
  );
};

export default ImportarView;
