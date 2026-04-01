
import React, { useState, useCallback, useMemo } from 'react';
import Card from '../components/Card';
import { Cliente, Remito, Telefono, TipoFacturacion, TipoTelefono, EstadoCliente, EstadoProducto, TipoProducto, Producto, PrecioEspecial, Sucursal } from '../types';
import { UploadIcon } from '../components/icons/UploadIcon';
import { useNotification } from '../context/NotificationContext';
import AppButton from '../components/ui/AppButton';
import AppSelect from '../components/ui/AppSelect';
import { useFormShortcuts } from '../hooks/useFormShortcuts';

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

  // Fix: Property 'state' does not exist on type 'Producto'. Use 'estado'.
  const activeProducts = useMemo(() => (productos || []).filter(p => p.estado === undefined || p.estado === EstadoProducto.ACTIVO), [productos]);

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
                const dataRows = rows
                    .filter(row => row.length > 0 && row.some(cell => cell.trim() !== ''))
                    .map(row => Object.fromEntries(headers.map((h, i) => [h, row[i] || ''])));
                
                if (dataRows.length === 0) throw new Error("No se encontraron datos válidos.");

                setFileData({ headers, rows: dataRows });

                // Mapeo Automático IVA
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

                // Mapeo Automático Productos
                const initialProdMap: Record<string, string> = {};
                headers.forEach(h => {
                    if (h.startsWith('cant_')) {
                        if (h.includes('20')) initialProdMap[h] = activeProducts.find(p => p.nombre.includes('20'))?.id || '';
                        else if (h.includes('12')) initialProdMap[h] = activeProducts.find(p => p.nombre.includes('12'))?.id || '';
                        else if (h.includes('fcp')) initialProdMap[h] = activeProducts.find(p => p.tipo === TipoProducto.EQUIPO)?.id || '';
                    }
                });
                setProductMapping(initialProdMap);
                setCurrentStep('mapping');
            } catch (err: any) { 
                showNotification(`Error: ${err.message}`, 'error'); 
            }
        };
        reader.readAsText(file);
    }
  };

  const handleExecuteImport = useCallback(async () => {
      if (!fileData) return;
      setIsProcessing(true);
      try {
          if (isReplacing) {
              showNotification("Limpiando base de datos...", "success");
              await deleteAllClientes();
          }

          const clientGroups = new Map<string, any[]>();
          fileData.rows.forEach(row => {
              const madreId = (row.codigo_madre || row.codigo || '').toString().trim();
              if (!madreId) return;
              if (!clientGroups.has(madreId)) clientGroups.set(madreId, []);
              clientGroups.get(madreId)!.push(row);
          });

          const finalClientes: any[] = [];
          clientGroups.forEach((branchRows, madreId) => {
              const mainRow = branchRows.find(r => r.codigo === madreId) || branchRows[0];
              
              const sucursales: Sucursal[] = branchRows.map(r => ({
                  id: r.codigo.toString(),
                  nombre: branchRows.length > 1 ? (r.nombre || `Sucursal ${r.codigo}`) : 'Principal',
                  direccion: `${r.direccion || ''} ${r.localidad || ''}`.trim()
              }));

              const initialStocks: any[] = [];
              branchRows.forEach(r => {
                  Object.entries(productMapping).forEach(([col, pId]) => {
                      const qty = Number(r[col]);
                      if (pId && !isNaN(qty) && qty > 0) {
                          // IMPORTANTE: el sucursalId debe coincidir con el r.codigo mapeado arriba
                          initialStocks.push({ productoId: pId, cantidad: qty, sucursalId: r.codigo.toString() });
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

          await addMultipleClientes(finalClientes);
          showNotification(`¡Éxito! ${finalClientes.length} clientes procesados.`, 'success');
          setCurrentStep('upload');
          setFileData(null);
      } catch (err: any) { 
          showNotification(`Error: ${err.message}`, 'error'); 
      }
      finally { setIsProcessing(false); }
  }, [fileData, isReplacing, deleteAllClientes, productMapping, ivaMapping, addMultipleClientes, showNotification]);

  useFormShortcuts({
    onSave: handleExecuteImport,
    onCancel: () => {
        if (currentStep === 'mapping') {
            setCurrentStep('upload');
            setFileData(null);
        }
    }
  });

  return (
    <div className="space-y-6 pt-12 md:pt-0 pb-12">
      <h1 className="text-3xl font-black text-gray-800 dark:text-white uppercase tracking-tighter">Asistente de Importación</h1>
      
      {currentStep === 'upload' && (
          <Card title="Paso 1: Seleccionar Archivo">
              <div className="space-y-6">
                  <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-800 font-mono text-[10px] text-blue-800 dark:text-blue-300">
                    Columnas: Codigo, Nombre, Direccion, Localidad, Cant_B20, Cant_B12, Cant_FCP, Codigo_Madre, CUIT, COND_IVA, COND_PAGO...
                  </div>
                  <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50">
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
                          {Object.keys(ivaMapping).map(val => (
                              <div key={val} className="flex flex-col gap-1">
                                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{val}</span>
                                  <AppSelect value={ivaMapping[val]} onChange={(e) => setIvaMapping({...ivaMapping, [val]: e.target.value as any})} options={Object.values(TipoFacturacion).map(v => ({value: v, label: v}))} />
                              </div>
                          ))}
                      </div>
                  </Card>
                  <Card title="Mapeo de Productos">
                      <div className="space-y-4">
                          {Object.keys(productMapping).map(col => (
                              <div key={col} className="flex flex-col gap-1">
                                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Columna: {col}</span>
                                  <AppSelect value={productMapping[col]} onChange={(e) => setProductMapping({...productMapping, [col]: e.target.value})} options={[{value: '', label: '-- Ignorar --'}, ...activeProducts.map(p => ({value: p.id, label: p.nombre}))]} />
                              </div>
                          ))}
                      </div>
                  </Card>
              </div>
              <Card title="Finalizar">
                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-2xl border dark:border-gray-600">
                      <p className="font-bold text-sm">Modo de Importación</p>
                      <div className="flex gap-2">
                          <button onClick={() => setIsReplacing(false)} className={`px-4 py-2 rounded-lg text-xs font-bold ${!isReplacing ? 'bg-primary-600 text-white shadow-lg' : 'bg-white dark:bg-gray-700 text-gray-500'}`}>Sumar</button>
                          <button onClick={() => setIsReplacing(true)} className={`px-4 py-2 rounded-lg text-xs font-bold ${isReplacing ? 'bg-red-600 text-white shadow-lg' : 'bg-white dark:bg-gray-700 text-gray-500'}`}>REEMPLAZAR</button>
                      </div>
                  </div>
                  <div className="flex gap-3 justify-end mt-6">
                      <AppButton variant="secondary" onClick={() => setCurrentStep('upload')}>Volver</AppButton>
                      <AppButton onClick={handleExecuteImport} isLoading={isProcessing} className="px-12">Iniciar <span className="opacity-60 text-[10px] ml-1 font-normal">(Alt+Enter)</span></AppButton>
                  </div>
              </Card>
          </div>
      )}
    </div>
  );
};

export default ImportarView;
