
import React, { useState, useCallback } from 'react';
import Card from '../components/Card';
import { Cliente, Remito, Telefono, TipoFacturacion, TipoTelefono, EstadoCliente } from '../types';
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
      return csvText.split('\n').map(row => row.split(',').map(cell => cell.trim()));
  }

  // --- Funciones de Exportación ---

  const downloadCSV = (content: string, filename: string) => {
      const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const escapeCSV = (value: string | number | undefined | null) => {
      if (value === undefined || value === null) return '';
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
  };

  const handleExportClientes = () => {
      const headers = ["id", "nombre", "cuit", "tipo_facturacion", "web", "emails", "telefonos", "sucursal_nombre", "sucursal_direccion"];
      let csvContent = headers.join(',') + "\n";

      clientes.forEach(c => {
          const emailsStr = (c.emails || []).join(';');
          const telefonosStr = (c.telefonos || []).map(t => `${t.tipo}:${t.numero}`).join(';');
          
          if (c.sucursales && c.sucursales.length > 0) {
              c.sucursales.forEach(s => {
                  const row = [
                      escapeCSV(c.id),
                      escapeCSV(c.nombre),
                      escapeCSV(c.cuit),
                      escapeCSV(c.tipoFacturacion),
                      escapeCSV(c.web),
                      escapeCSV(emailsStr),
                      escapeCSV(telefonosStr),
                      escapeCSV(s.nombre),
                      escapeCSV(s.direccion)
                  ];
                  csvContent += row.join(',') + "\n";
              });
          } else {
              // Cliente sin sucursales (caso raro pero posible)
              const row = [
                  escapeCSV(c.id),
                  escapeCSV(c.nombre),
                  escapeCSV(c.cuit),
                  escapeCSV(c.tipoFacturacion),
                  escapeCSV(c.web),
                  escapeCSV(emailsStr),
                  escapeCSV(telefonosStr),
                  "", "" // Sin sucursal
              ];
              csvContent += row.join(',') + "\n";
          }
      });

      downloadCSV(csvContent, `clientes_export_${new Date().toISOString().split('T')[0]}.csv`);
      showNotification('Clientes exportados correctamente.', 'success');
  };

  const handleExportRemitos = () => {
      const headers = ["id", "fecha", "clienteId", "sucursalId", "vendedorId", "puntoVenta", "numero", "productoId", "entregados", "recibidos"];
      let csvContent = headers.join(',') + "\n";

      remitos.forEach(r => {
          if (r.movimientos && r.movimientos.length > 0) {
              r.movimientos.forEach(m => {
                  const row = [
                      escapeCSV(r.id),
                      escapeCSV(r.fecha),
                      escapeCSV(r.clienteId),
                      escapeCSV(r.sucursalId),
                      escapeCSV(r.vendedorId),
                      escapeCSV(r.puntoVenta),
                      escapeCSV(r.numero),
                      escapeCSV(m.productoId),
                      escapeCSV(m.entregados),
                      escapeCSV(m.recibidos)
                  ];
                  csvContent += row.join(',') + "\n";
              });
          } else {
              // Remito sin movimientos
               const row = [
                  escapeCSV(r.id),
                  escapeCSV(r.fecha),
                  escapeCSV(r.clienteId),
                  escapeCSV(r.sucursalId),
                  escapeCSV(r.vendedorId),
                  escapeCSV(r.puntoVenta),
                  escapeCSV(r.numero),
                  "", 0, 0
              ];
              csvContent += row.join(',') + "\n";
          }
      });

      downloadCSV(csvContent, `remitos_export_${new Date().toISOString().split('T')[0]}.csv`);
      showNotification('Remitos exportados correctamente.', 'success');
  };

  const handleDownloadTemplate = () => {
      let csvContent = "";
      if (importType === 'clientes') {
          // Encabezados
          csvContent = "id,nombre,cuit,tipo_facturacion,web,emails,telefonos,sucursal_nombre,sucursal_direccion\n";
          // Ejemplo 1: Cliente completo
          csvContent += "c_imp_1,Cliente Ejemplo S.A.,30-12345678-9,Responsable Inscripto,www.ejemplo.com,contacto@ejemplo.com,celular:11223344,Casa Central,Av. Siempre Viva 123\n";
          // Ejemplo 2: Misma ID, otra sucursal
          csvContent += "c_imp_1,Cliente Ejemplo S.A.,,,,,,,Sucursal Norte,Calle Falsa 123\n";
          // Ejemplo 3: Cliente simple
          csvContent += "c_imp_2,Kiosco Pepe,,Consumidor Final,,,,Local,Mitre 500";
          downloadCSV(csvContent, `modelo_importacion_clientes.csv`);
      } else {
          // Encabezados
          csvContent = "id,fecha,clienteId,sucursalId,vendedorId,puntoVenta,numero,productoId,entregados,recibidos\n";
          // Ejemplo
          csvContent += "r_imp_1,2023-10-25,c1,,u1,1,1001,p1,10,5\n";
          csvContent += "r_imp_1,2023-10-25,c1,,u1,1,1001,p2,5,0";
          downloadCSV(csvContent, `modelo_importacion_remitos.csv`);
      }
  };

  const handleImport = useCallback(() => {
    if (!file) {
      showNotification('Por favor, seleccione un archivo.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const rows = parseCSV(text);
        const headers = rows.shift()?.map(h => h.toLowerCase());
        if (!headers) throw new Error("Archivo CSV vacío o sin cabecera.");

        if (importType === 'clientes') {
            const clientesMap = new Map<string, Cliente>();
            rows.forEach((row, index) => {
                if (row.length < 2 || row.every(cell => cell === '')) return;
                const clienteData = Object.fromEntries(headers.map((h, i) => [h, row[i]]));
                const { id, nombre, sucursal_nombre, sucursal_direccion, cuit, tipo_facturacion, web, emails, telefonos } = clienteData;

                if (!id || !nombre) throw new Error(`Fila ${index + 2}: Faltan id o nombre del cliente.`);
                
                if (!clientesMap.has(id)) {
                    const parsedTelefonos = telefonos ? telefonos.split(';').map(t => {
                        const parts = t.split(':');
                        if (parts.length !== 2) return null;
                        const [tipo, numero] = parts.map(p => p.trim());
                        
                        const validTipo = Object.values(TipoTelefono).find(val => val.toLowerCase() === (tipo as string).toLowerCase());
                        
                        if (!validTipo || !numero) return null;
                        return { tipo: validTipo, numero: numero };
                    }).filter((t): t is Telefono => t !== null) : [];

                    const validTipoFacturacion = Object.values(TipoFacturacion).find(val => val.toLowerCase() === (tipo_facturacion as string)?.toLowerCase());

                    clientesMap.set(id, {
                        id,
                        nombre,
                        estado: EstadoCliente.ACTIVO,
                        cuit: cuit || undefined,
                        tipoFacturacion: validTipoFacturacion || undefined,
                        web: web || undefined,
                        emails: emails ? emails.split(';').map(e => e.trim()) : [],
                        telefonos: parsedTelefonos,
                        sucursales: []
                    });
                }

                if (sucursal_nombre && sucursal_direccion) {
                    clientesMap.get(id)?.sucursales.push({
                        id: `s${id}-${clientesMap.get(id)!.sucursales.length + 1}`,
                        nombre: sucursal_nombre,
                        direccion: sucursal_direccion
                    });
                }
            });
            addMultipleClientes(Array.from(clientesMap.values()));
            showNotification(`${clientesMap.size} clientes importados correctamente.`, 'success');
        } else { // 'remitos'
            const remitosMap = new Map<string, Remito>();
            rows.forEach((row, index) => {
                if (row.length < 8 || row.every(cell => cell === '')) return;
                const rowData = Object.fromEntries(headers.map((h, i) => [h, row[i]]));
                const { id, fecha, clienteid, sucursalid, vendedorid, puntoventa, numero, productoid, entregados, recibidos } = rowData;

                if (!id || !fecha || !clienteid || !vendedorid || !puntoventa || !numero || !productoid) {
                  throw new Error(`Fila ${index + 2}: Faltan datos obligatorios del remito o movimiento.`);
                }

                if (!remitosMap.has(id)) {
                    remitosMap.set(id, {
                        id,
                        fecha,
                        clienteId: clienteid,
                        sucursalId: sucursalid || undefined,
                        vendedorId: vendedorid,
                        puntoVenta: puntoventa,
                        numero: numero,
                        movimientos: [],
                    });
                }
                
                remitosMap.get(id)!.movimientos.push({
                    productoId: productoid,
                    entregados: Number(entregados || 0),
                    recibidos: Number(recibidos || 0),
                });
            });
            addMultipleRemitos(Array.from(remitosMap.values()));
            showNotification(`${remitosMap.size} remitos importados correctamente.`, 'success');
        }
        setFile(null);
      } catch (error) {
          const message = error instanceof Error ? error.message : "Un error desconocido ocurrió.";
          showNotification(`Error al procesar el archivo: ${message}`, 'error');
      }
    };
    reader.readAsText(file);
  }, [file, importType, addMultipleClientes, addMultipleRemitos, showNotification]);
  
  const clienteCSVInfo = "Formato: id,nombre,cuit,tipo_facturacion,web,emails,telefonos,sucursal_nombre,sucursal_direccion";
  const remitoCSVInfo = "Formato: id,fecha,clienteId,sucursalId,vendedorId,puntoVenta,numero,productoId,entregados,recibidos";
  const clienteCSVDetails = [
    "emails: separados por punto y coma (;). Ej: 'mail1@a.com;mail2@b.com'",
    "telefonos: tipo y número separados por dos puntos (:), y cada par separado por punto y coma (;). Ej: 'whatsapp:11223344;local:45678899'",
    `Tipos de teléfono válidos: ${Object.values(TipoTelefono).join(', ')}`,
    `Tipos de facturación válidos: ${Object.values(TipoFacturacion).join(', ')}`
];


  return (
    <div className="space-y-6 pt-12 md:pt-0">
      <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Importación y Exportación de Datos</h1>
      
      {/* Sección Exportar */}
      <Card title="Exportar Datos a CSV">
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-md border border-gray-200 dark:border-gray-600">
                  <h3 className="font-semibold text-lg text-gray-800 dark:text-white mb-2">Clientes</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                      Descargue la lista completa de clientes, incluyendo sucursales y datos de contacto.
                  </p>
                  <AppButton 
                      onClick={handleExportClientes}
                      variant="primary"
                      fullWidth
                  >
                      Exportar Clientes (.csv)
                  </AppButton>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-md border border-gray-200 dark:border-gray-600">
                  <h3 className="font-semibold text-lg text-gray-800 dark:text-white mb-2">Histórico de Remitos</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                      Descargue todos los remitos históricos con sus movimientos de productos.
                  </p>
                  <AppButton 
                      onClick={handleExportRemitos}
                      variant="success"
                      fullWidth
                  >
                      Exportar Remitos (.csv)
                  </AppButton>
              </div>
          </div>
      </Card>

      {/* Sección Importar */}
      <Card title="Importar desde CSV">
        <div className="p-6 space-y-4">
          <div className="flex space-x-4">
            <label className="flex items-center cursor-pointer">
              <input type="radio" name="importType" value="clientes" checked={importType === 'clientes'} onChange={() => setImportType('clientes')} className="form-radio text-primary-600" />
              <span className="ml-2 font-medium">Clientes</span>
            </label>
            <label className="flex items-center cursor-pointer">
              <input type="radio" name="importType" value="remitos" checked={importType === 'remitos'} onChange={() => setImportType('remitos')} className="form-radio text-primary-600" />
              <span className="ml-2 font-medium">Histórico Remitos</span>
            </label>
          </div>

          <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-md text-sm text-gray-600 dark:text-gray-300">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
                <div>
                    <h4 className="font-semibold">Formato CSV esperado:</h4>
                    <p className="font-mono text-xs mt-1 break-all">{importType === 'clientes' ? clienteCSVInfo : remitoCSVInfo}</p>
                    {importType === 'clientes' && (
                        <ul className="text-xs mt-1 list-disc list-inside space-y-1">
                            {clienteCSVDetails.map((detail, i) => <li key={i}>{detail}</li>)}
                        </ul>
                    )}
                    {importType === 'remitos' && <p className="text-xs mt-1">Nota: Cada fila representa un producto dentro de un remito. Agrupe las filas por el 'id' del remito.</p>}
                </div>
                <AppButton 
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadTemplate}
                >
                    Descargar Plantilla Vacía
                </AppButton>
            </div>
          </div>
          
          <div>
            <label className="w-full flex flex-col items-center px-4 py-6 bg-white dark:bg-gray-700 text-primary-600 rounded-lg shadow-lg tracking-wide uppercase border border-blue cursor-pointer hover:bg-primary-50 dark:hover:bg-gray-600 transition-colors">
              <UploadIcon />
              <span className="mt-2 text-base leading-normal">{file ? file.name : 'Seleccione un archivo .csv'}</span>
              <input type='file' accept=".csv" className="hidden" onChange={handleFileChange} />
            </label>
          </div>

          <AppButton 
            onClick={handleImport} 
            disabled={!file} 
            fullWidth
            size="lg"
          >
            Importar Datos
          </AppButton>
        </div>
      </Card>
    </div>
  );
};

export default ImportarView;
