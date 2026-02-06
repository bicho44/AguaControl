
import React, { useState, useCallback } from 'react';
import Card from '../components/Card';
import { Cliente, Remito, Telefono, TipoFacturacion, TipoTelefono, EstadoCliente, EstadoProducto, TipoProducto, Producto, PrecioEspecial, Sucursal } from '../types';
import { UploadIcon } from '../components/icons/UploadIcon';
import { useNotification } from '../context/NotificationContext';
import AppButton from '../components/ui/AppButton';

interface ImportarViewProps {
  clientes: Cliente[];
  remitos: Remito[];
  addMultipleClientes: (clientes: Cliente[]) => void;
  addMultipleRemitos: (remitos: Remito[]) => void;
}

const ImportarView: React.FC<ImportarViewProps> = ({ clientes, remitos, addMultipleClientes, addMultipleRemitos }) => {
  const [file, setFile] = useState<File | null>(null);
  const [importType, setImportType] = useState<'clientes' | 'remitos'>('clientes');
  const { showNotification } = useNotification();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
    }
  };

  const parseCSV = (csvText: string): string[][] => {
      const rows: string[][] = [];
      let currentRow: string[] = [];
      let currentCell = '';
      let inQuotes = false;

      for (let i = 0; i < csvText.length; i++) {
          const char = csvText[i];
          const nextChar = csvText[i + 1];

          if (char === '"') {
              if (inQuotes && nextChar === '"') {
                  currentCell += '"';
                  i++;
              } else {
                  inQuotes = !inQuotes;
              }
          } else if (char === ',' && !inQuotes) {
              currentRow.push(currentCell.trim());
              currentCell = '';
          } else if ((char === '\r' || char === '\n') && !inQuotes) {
              currentRow.push(currentCell.trim());
              if (currentRow.length > 0 || currentRow.some(c => c !== '')) {
                  rows.push(currentRow);
              }
              currentRow = [];
              currentCell = '';
              if (char === '\r' && nextChar === '\n') i++;
          } else {
              currentCell += char;
          }
      }
      if (currentCell || currentRow.length > 0) {
          currentRow.push(currentCell.trim());
          rows.push(currentRow);
      }
      return rows;
  }

  const handleImport = useCallback(() => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const rows = parseCSV(text);
        // El formato esperado tiene encabezados
        const headers = rows.shift()?.map(h => h.toLowerCase().replace(/ /g, '_').trim());
        if (!headers) throw new Error("Archivo vacío.");

        if (importType === 'clientes') {
            /**
             * Columnas: Codigo,Nombre,Direccion,Localidad,Tipo_Cliente,Cant_B20,Cant_B12,Cant_FCP,Codigo_Madre,
             * CUIT,TELEFONO,TE._MOVIL,EMAIL,COND_IVA,COND_PAGO,NOMBREFISCAL,DOMICILIOFISCAL,LOCALIDADFISCAL,ALTA,REQUIERE_COMPROBANTE
             */
            
            const clientGroups = new Map<string, any[]>();
            rows.forEach((row) => {
                const data = Object.fromEntries(headers.map((h, i) => [h, row[i]]));
                const madreId = data.codigo_madre || data.codigo;
                if (!clientGroups.has(madreId)) clientGroups.set(madreId, []);
                clientGroups.get(madreId)!.push(data);
            });

            const finalClientes: Cliente[] = [];
            clientGroups.forEach((branchRows, madreId) => {
                // Buscamos la fila que representa al cliente principal (la madre)
                const mainRow = branchRows.find(r => r.codigo === madreId) || branchRows[0];
                
                const sucursales: Sucursal[] = branchRows.map(r => ({
                    id: r.codigo,
                    nombre: branchRows.length > 1 ? r.nombre : 'Principal',
                    direccion: `${r.direccion || ''} ${r.localidad || ''}`.trim()
                }));

                const initialStocks: any[] = [];
                branchRows.forEach(r => {
                    if (Number(r.cant_b20) > 0) initialStocks.push({ productoId: 'p1', cantidad: Number(r.cant_b20), sucursalId: r.codigo });
                    if (Number(r.cant_b12) > 0) initialStocks.push({ productoId: 'p2', cantidad: Number(r.cant_b12), sucursalId: r.codigo });
                    if (Number(r.cant_fcp) > 0) initialStocks.push({ productoId: 'p4', cantidad: Number(r.cant_fcp), sucursalId: r.codigo });
                });

                const cliente: Cliente & { stockInicial?: any[] } = {
                    id: madreId,
                    nombre: mainRow.nombre || 'Sin Nombre',
                    nombreFiscal: mainRow.nombrefiscal || undefined,
                    estado: EstadoCliente.ACTIVO,
                    cuit: mainRow.cuit || '',
                    tipoFacturacion: mainRow.cond_iva as TipoFacturacion,
                    tieneCuentaCorriente: mainRow.cond_pago?.toLowerCase().includes('cta') || false,
                    telefonos: [
                        ...(mainRow.telefono ? [{ tipo: TipoTelefono.LOCAL, numero: mainRow.telefono }] : []),
                        ...(mainRow['te._movil'] ? [{ tipo: TipoTelefono.CEL, numero: mainRow['te._movil'] }] : [])
                    ],
                    emails: mainRow.email ? [mainRow.email] : [],
                    sucursales,
                    stockInicial: initialStocks // Pasamos stock para que useDataStore lo procese
                };
                finalClientes.push(cliente);
            });

            addMultipleClientes(finalClientes);
            showNotification(`${finalClientes.length} clientes (y sus sucursales) procesados.`, 'success');
        } else {
            // Lógica para remitos permanece similar o ajustada al formato necesario
            showNotification('Importador de remitos en desarrollo para este formato.', 'error');
        }
        setFile(null);
      } catch (error: any) {
          showNotification(`Error: ${error.message}`, 'error');
      }
    };
    reader.readAsText(file);
  }, [file, importType, addMultipleClientes]);

  return (
    <div className="space-y-6 pt-12 md:pt-0 pb-12">
      <h1 className="text-3xl font-black text-gray-800 dark:text-white uppercase tracking-tighter">Importar / Exportar</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card title="Carga Masiva de Clientes">
              <div className="space-y-6">
                  <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-800 space-y-3">
                      <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Formato de Columnas Detectado</p>
                      <p className="text-[10px] text-blue-800 dark:text-blue-300 leading-relaxed font-mono break-all">
                        Codigo, Nombre, Direccion, Localidad, Tipo_Cliente, Cant_B20, Cant_B12, Cant_FCP, Codigo_Madre, CUIT, TELEFONO, TE. MOVIL, EMAIL, COND_IVA, COND_PAGO, NOMBREFISCAL...
                      </p>
                  </div>

                  <div className="relative group">
                      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all">
                          <div className="flex flex-col items-center justify-center pt-5 pb-6">
                              <UploadIcon />
                              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 font-bold">{file ? file.name : 'Seleccionar Archivo .CSV'}</p>
                          </div>
                          <input type="file" className="hidden" accept=".csv" onChange={handleFileChange} />
                      </label>
                  </div>

                  <AppButton onClick={handleImport} disabled={!file} className="w-full py-4 shadow-xl" size="lg">Procesar e Importar Clientes</AppButton>
              </div>
          </Card>
      </div>
    </div>
  );
};

export default ImportarView;
