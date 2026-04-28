import React, { useRef, useState } from 'react';
import { extractFacturaData } from './ocrService';
import { useDataStore } from '../../hooks/useDataStore';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useNotification } from '../../context/NotificationContext';
import { UploadCloud, FileText } from 'lucide-react';
import { EstadoFacturaProveedor, Proveedor } from '../../types';
import { getLocalDateString } from '../../utils/dateUtils';
import AppButton from '../../components/ui/AppButton';

export const OjoMagicoArea: React.FC = () => {
    const { proveedores, clientes, facturasProveedor } = useDataStore();
    const { showNotification } = useNotification();
    const [isExtracting, setIsExtracting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragOver, setIsDragOver] = useState(false);

    const processFile = async (file: File) => {
        setIsExtracting(true);
        showNotification('Procesando factura con IA...', 'success');

        try {
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const base64String = (event.target?.result as string).split(',')[1];
                    const extractedData = await extractFacturaData(base64String, file.type);
                    
                    let foundProvId = '';
                    
                    if (extractedData.proveedorCuit || extractedData.proveedorNombre) {
                        const prov = proveedores.find(p => 
                            (extractedData.proveedorCuit && p.cuit && p.cuit.includes(extractedData.proveedorCuit)) ||
                            (extractedData.proveedorNombre && p.nombre.toLowerCase().includes(extractedData.proveedorNombre.toLowerCase()))
                        );
                        
                        if (prov) {
                            foundProvId = prov.id;
                            
                            // Actualizar proveedor si hay data faltante
                            const updates: Partial<Proveedor> = {};
                            if (!prov.email && extractedData.proveedorEmail) updates.email = extractedData.proveedorEmail;
                            if (!prov.telefono && extractedData.proveedorTelefono) updates.telefono = extractedData.proveedorTelefono;
                            if (!prov.direccion && extractedData.proveedorDireccion) updates.direccion = extractedData.proveedorDireccion;
                            if (!prov.ingresosBrutos && extractedData.proveedorIIBB) updates.ingresosBrutos = extractedData.proveedorIIBB;
                            
                            if (Object.keys(updates).length > 0) {
                                await updateDoc(doc(db, 'proveedores', prov.id), updates);
                                showNotification(`Información de proveedor "${prov.nombre}" actualizada`, 'success');
                            }
                        } else {
                            // Revisar si existe en clientes (por nombre o CUIT)
                            const clienteMatches = clientes.filter(c => 
                                (extractedData.proveedorCuit && c.cuit && c.cuit.includes(extractedData.proveedorCuit)) ||
                                (extractedData.proveedorNombre && c.nombre.toLowerCase().includes(extractedData.proveedorNombre.toLowerCase()))
                            );

                            let baseData = {
                                nombre: extractedData.proveedorNombre || (clienteMatches.length > 0 ? clienteMatches[0].nombre : 'Desconocido'),
                                cuit: extractedData.proveedorCuit || '',
                                email: extractedData.proveedorEmail || '',
                                telefono: extractedData.proveedorTelefono || '',
                                direccion: extractedData.proveedorDireccion || '',
                                ingresosBrutos: extractedData.proveedorIIBB || '',
                                activo: true
                            };

                            if (clienteMatches.length > 0) {
                                const cli = clienteMatches[0];
                                baseData.email = baseData.email || cli.email || '';
                                baseData.telefono = baseData.telefono || cli.telefono || '';
                                baseData.direccion = baseData.direccion || cli.direccion || '';
                                baseData.cuit = baseData.cuit || cli.cuit || '';
                                
                                // También actualizar el cliente si le falta información
                                const cliUpdates: any = {};
                                if (!cli.email && extractedData.proveedorEmail) cliUpdates.email = extractedData.proveedorEmail;
                                if (!cli.telefono && extractedData.proveedorTelefono) cliUpdates.telefono = extractedData.proveedorTelefono;
                                if (!cli.direccion && extractedData.proveedorDireccion) cliUpdates.direccion = extractedData.proveedorDireccion;
                                if (!cli.cuit && extractedData.proveedorCuit) cliUpdates.cuit = extractedData.proveedorCuit;
                                
                                if (Object.keys(cliUpdates).length > 0) {
                                    await updateDoc(doc(db, 'clientes', cli.id), cliUpdates);
                                }
                            }

                            const newProvRef = await addDoc(collection(db, 'proveedores'), baseData);
                            foundProvId = newProvRef.id;
                            showNotification(`Proveedor "${baseData.nombre}" creado automáticamente`, 'success');
                        }
                    }

                    // Verificar duplicados de factura
                    const existingFac = facturasProveedor.find(f => 
                        f.proveedorId === foundProvId && 
                        f.numero === extractedData.numero
                    );

                    if (existingFac) {
                        showNotification(`Esta factura (${extractedData.numero}) ya se encuentra registrada`, 'error');
                        setIsExtracting(false);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                        return;
                    }

                    // No está duplicada, la registramos!
                    const dataToSave = {
                        proveedorId: foundProvId,
                        numero: extractedData.numero || 'S/N',
                        tipoComprobante: (extractedData.tipoComprobante || 'A') as any,
                        fechaEmision: extractedData.fechaEmision || getLocalDateString(new Date()),
                        fechaVencimiento: extractedData.fechaVencimiento || getLocalDateString(new Date()),
                        subtotalNeto: extractedData.subtotalNeto || 0,
                        importeIva: extractedData.importeIva || 0,
                        alicuotaIva: extractedData.alicuotaIva || 21,
                        percepciones: extractedData.percepciones || 0,
                        total: extractedData.total || 0,
                        saldoPagar: extractedData.total || 0,
                        estado: EstadoFacturaProveedor.PENDIENTE,
                        observaciones: 'Ingresada por Ojo Mágico'
                    };

                    if (!dataToSave.proveedorId || !dataToSave.total) {
                        showNotification('La factura se procesó pero le faltan datos críticos (total). Revisarla.', 'error');
                        return; // O podríamos abrir el modal pre-relleno en todo caso
                    }

                    await addDoc(collection(db, 'facturas_proveedor'), dataToSave);
                    showNotification(`Factura registrada exitosamente! ✨`, 'success');

                } catch (error: any) {
                    console.error(error);
                    showNotification('Error extrayendo datos: ' + error.message, 'error');
                } finally {
                    setIsExtracting(false);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                    setIsDragOver(false);
                }
            };
            reader.readAsDataURL(file);
        } catch (error) {
            setIsExtracting(false);
            showNotification('Error leyendo archivo', 'error');
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            processFile(e.target.files[0]);
        }
    };

    const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragOver(false);
        if (isExtracting) return;
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            processFile(e.dataTransfer.files[0]);
        }
    };

    const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        if (!isExtracting) setIsDragOver(true);
    };

    const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragOver(false);
    };

    return (
        <div 
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onClick={() => {
                if (!isExtracting) fileInputRef.current?.click();
            }}
            className={`cursor-pointer transition-all border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center ${
                isDragOver ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' : 
                isExtracting ? 'border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-800 opacity-70 cursor-not-allowed' :
                'border-purple-300 bg-gradient-to-br from-purple-50 to-white dark:from-purple-900/10 dark:to-gray-800 dark:border-purple-800 hover:border-purple-500 hover:shadow-lg'
            }`}
        >
            <input 
                type="file" 
                accept="image/*,.pdf" 
                ref={fileInputRef} 
                className="hidden" 
                onChange={handleFileChange} 
                disabled={isExtracting}
            />

            {isExtracting ? (
                <>
                    <div className="w-16 h-16 mb-4 rounded-full border-4 border-purple-200 border-t-purple-600 animate-spin"></div>
                    <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">✨ Ojo Mágico Trabajando...</h3>
                    <p className="text-gray-500 max-w-md">Analizando la factura e insertándola automáticamente.</p>
                </>
            ) : (
                <>
                    <div className="bg-white dark:bg-gray-700 p-4 rounded-full shadow-md mb-4 text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform">
                        <UploadCloud className="w-10 h-10" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">✨ Ojo Mágico (Drag & Drop)</h3>
                    <p className="text-gray-500 max-w-md mb-4">
                        Arrastrá una imagen o PDF de tu factura aquí, o hacé clic para seleccionar. La IA hará el resto, verificando duplicados y cargando la data instantáneamente.
                    </p>
                    <div className="flex gap-2 text-xs font-bold text-purple-500 bg-white dark:bg-gray-800/50 px-3 py-1 rounded-full shadow-sm">
                        <FileText className="w-4 h-4" /> AUTO-CARGA
                    </div>
                </>
            )}
        </div>
    );
};
