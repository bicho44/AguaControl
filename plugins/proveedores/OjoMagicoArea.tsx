import React, { useRef, useState, useEffect } from 'react';
import { extractFacturaData } from './ocrService';
import { useDataStore } from '../../hooks/useDataStore';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useNotification } from '../../context/NotificationContext';
import { UploadCloud, FileText, Camera, X, Check } from 'lucide-react';
import { EstadoFacturaProveedor, Proveedor } from '../../types';
import { getLocalDateString } from '../../utils/dateUtils';
import AppButton from '../../components/ui/AppButton';
import Modal from '../../components/Modal';

interface QueueItem {
    id: string;
    file?: File;
    base64?: string;
    mimeType?: string;
    status: 'pending' | 'processing' | 'done' | 'error';
    error?: string;
}

export const OjoMagicoArea: React.FC = () => {
    const { proveedores, clientes, facturasProveedor } = useDataStore();
    const { showNotification } = useNotification();
    
    // Cola de extracción
    const [queue, setQueue] = useState<QueueItem[]>([]);
    const [isExtracting, setIsExtracting] = useState(false);
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);

    // Procesamiento en background de la cola
    useEffect(() => {
        const processNextInQueue = async () => {
            const nextItem = queue.find(q => q.status === 'pending');
            
            if (!nextItem) {
                // Cola terminada
                if (isExtracting) {
                    setIsExtracting(false);
                    const doneItems = queue.filter(q => q.status === 'done').length;
                    if (doneItems > 0) {
                        showNotification(`¡Procesamiento finalizado! ${doneItems} facturas registradas.`, 'success');
                        window.dispatchEvent(new CustomEvent('ojo_magico_done', { detail: { count: doneItems } }));
                    }
                    // Limpiar cola oculta unos segundos después si queremos, o dejarla 
                    setTimeout(() => {
                        setQueue(curr => curr.filter(q => q.status !== 'done' && q.status !== 'error'));
                    }, 5000);
                }
                return;
            }

            if (!isExtracting) {
                setIsExtracting(true);
            }

            // Marcar como procesando
            setQueue(curr => curr.map(item => item.id === nextItem.id ? { ...item, status: 'processing' } : item));

            try {
                let base64String = nextItem.base64;
                let mimeType = nextItem.mimeType;

                if (nextItem.file) {
                    mimeType = nextItem.file.type;
                    const reader = new FileReader();
                    const filePromise = new Promise<string>((resolve, reject) => {
                        reader.onload = (e) => resolve((e.target?.result as string).split(',')[1]);
                        reader.onerror = reject;
                    });
                    reader.readAsDataURL(nextItem.file);
                    base64String = await filePromise;
                }

                if (base64String && mimeType) {
                    await processBase64(base64String, mimeType);
                }
                
                // Marcar como completado
                setQueue(curr => curr.map(item => item.id === nextItem.id ? { ...item, status: 'done' } : item));
                
            } catch (error: any) {
                console.error(error);
                setQueue(curr => curr.map(item => item.id === nextItem.id ? { ...item, status: 'error', error: error.message } : item));
            }
        };

        processNextInQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [queue, isExtracting]);

    useEffect(() => {
        if (isCameraModalOpen && stream && videoRef.current && !capturedImage) {
            videoRef.current.srcObject = stream;
        }
    }, [isCameraModalOpen, stream, capturedImage]);

    const startCamera = async () => {
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'environment' }, 
                audio: false 
            });
            setStream(mediaStream);
            setIsCameraModalOpen(true);
        } catch (err) {
            console.error("Error accessing camera:", err);
            showNotification('No se pudo acceder a la cámara. Verifica los permisos.', 'error');
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
        setIsCameraModalOpen(false);
        setCapturedImage(null);
    };

    const capturePhoto = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg');
                setCapturedImage(dataUrl);
            }
        }
    };

    const handleConfirmPhoto = () => {
        if (!capturedImage) return;
        
        const base64Data = capturedImage.split(',')[1];
        stopCamera();
        
        addToQueue({
            base64: base64Data,
            mimeType: 'image/jpeg'
        });
        showNotification('Foto agregada a la cola de procesamiento...', 'success');
    };

    const processBase64 = async (base64String: string, mimeType: string) => {
        try {
            const extractedData = await extractFacturaData(base64String, mimeType);
            
            let foundProvId = '';
            
            if (extractedData.proveedorCuit || extractedData.proveedorNombre) {
                const sanitizeCuit = (c: string) => c ? c.replace(/\D/g, '') : '';
                const extCuit = sanitizeCuit(extractedData.proveedorCuit || '');
                const extNombre = (extractedData.proveedorNombre || '').toLowerCase().trim();

                const matchEntity = (list: any[]) => {
                    if (extCuit) {
                        const byCuit = list.find(p => sanitizeCuit(p.cuit) === extCuit);
                        if (byCuit) return byCuit;
                    }
                    if (extNombre) {
                        const exact = list.find(p => p.nombre.toLowerCase().trim() === extNombre);
                        if (exact) return exact;
                        if (extNombre.length > 4) {
                            return list.find(p => p.nombre.toLowerCase().includes(extNombre) || extNombre.includes(p.nombre.toLowerCase()));
                        }
                    }
                    return null;
                };

                const prov = matchEntity(proveedores) as Proveedor | null;
                
                if (prov) {
                    foundProvId = prov.id;
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
                    const cli = matchEntity(clientes);
                    let baseData = {
                        nombre: extractedData.proveedorNombre || (cli ? cli.nombre : 'Desconocido'),
                        cuit: extractedData.proveedorCuit || '',
                        email: extractedData.proveedorEmail || '',
                        telefono: extractedData.proveedorTelefono || '',
                        direccion: extractedData.proveedorDireccion || '',
                        ingresosBrutos: extractedData.proveedorIIBB || '',
                        activo: true
                    };

                    if (cli) {
                        baseData.email = baseData.email || cli.email || '';
                        baseData.telefono = baseData.telefono || cli.telefono || '';
                        baseData.direccion = baseData.direccion || cli.direccion || '';
                        baseData.cuit = baseData.cuit || cli.cuit || '';
                        
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

            const tipo = (extractedData.tipoComprobante || 'A') as any;
            const existingFac = facturasProveedor.find(f => f.proveedorId === foundProvId && f.numero === extractedData.numero && f.tipoComprobante === tipo);
            if (existingFac) {
                const errorMsg = `La factura ${tipo} ${extractedData.numero} ya se encuentra registrada para este proveedor.`;
                showNotification(errorMsg, 'error');
                throw new Error(errorMsg);
            }

            const dataToSave = {
                proveedorId: foundProvId,
                numero: extractedData.numero || 'S/N',
                tipoComprobante: tipo,
                fechaEmision: extractedData.fechaEmision || getLocalDateString(new Date()),
                fechaVencimiento: extractedData.fechaVencimiento || getLocalDateString(new Date()),
                subtotalNeto: extractedData.subtotalNeto || 0,
                importeIva: extractedData.importeIva || 0,
                alicuotasIva: extractedData.alicuotasIva || [],
                otrosImpuestos: extractedData.otrosImpuestos || [],
                percepciones: extractedData.percepciones || 0,
                total: extractedData.total || 0,
                saldoPagar: extractedData.total || 0,
                estado: EstadoFacturaProveedor.PENDIENTE,
                observaciones: 'Ingresada por Ojo Mágico',
                observacionesMarkdown: extractedData.observacionesMarkdown || ''
            };

            if (!dataToSave.proveedorId || !dataToSave.total) {
                showNotification('La factura se procesó pero le faltan datos críticos (total). Revisarla.', 'error');
                return;
            }

            await addDoc(collection(db, 'facturas_proveedor'), dataToSave);
            showNotification(`Factura registrada exitosamente! ✨`, 'success');

        } catch (error: any) {
            if (error.message === "503_OVERLOADED") {
                showNotification('El servicio de IA está saturado. Reintenta en unos minutos.', 'error');
            } else {
                showNotification('Error extrayendo datos: ' + error.message, 'error');
            }
            throw error;
        }
    };

    const addToQueue = (item: Omit<QueueItem, 'id' | 'status'>) => {
        const newItem: QueueItem = {
            ...item,
            id: Math.random().toString(36).substring(7),
            status: 'pending'
        };
        setQueue(curr => [...curr, newItem]);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            Array.from(e.target.files).forEach(file => {
                addToQueue({ file });
            });
            showNotification(`${e.target.files.length} archivo(s) agregado(s) a la cola...`, 'success');
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragOver(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            Array.from(e.dataTransfer.files).forEach(file => {
                addToQueue({ file });
            });
            showNotification(`${e.dataTransfer.files.length} archivo(s) agregado(s) a la cola...`, 'success');
        }
    };

    const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragOver(true);
    };

    const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragOver(false);
    };

    const queueCount = queue.filter(q => q.status === 'pending' || q.status === 'processing').length;

    return (
        <div className="h-full relative group">
            <div 
                onDrop={onDrop}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`cursor-pointer transition-all border-2 border-dashed rounded-xl p-3 flex flex-row items-center justify-center text-left gap-3 h-full relative overflow-hidden z-10 ${
                    isDragOver ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' : 
                    isExtracting ? 'border-purple-300 bg-purple-50 dark:border-purple-800 dark:bg-gray-800 shadow-inner' :
                    'border-purple-300 bg-gradient-to-br from-purple-50 to-white dark:from-purple-900/10 dark:to-gray-800 dark:border-purple-800 hover:border-purple-500 hover:shadow-lg'
                }`}
            >
                <input 
                    type="file" 
                    accept="image/*,.pdf" 
                    multiple
                    ref={fileInputRef} 
                    className="hidden" 
                    onChange={handleFileChange} 
                />

                {isExtracting ? (
                    <>
                        <div className="w-8 h-8 rounded-full border-4 border-purple-200 border-t-purple-600 animate-spin shrink-0"></div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-bold text-gray-800 dark:text-white truncate">✨ Ojo Mágico Trabajando</h3>
                            <p className="text-xs text-purple-600 dark:text-purple-400 font-medium truncate">Procesando {queueCount} facturas restantes...</p>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="bg-white dark:bg-gray-700 p-2 rounded-full shadow-sm text-purple-600 dark:text-purple-400 shrink-0">
                            <UploadCloud className="w-6 h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-bold text-gray-800 dark:text-white truncate">✨ Ojo Mágico</h3>
                            <p className="text-xs text-gray-500 hidden md:block truncate">
                                Arrastrá varias facturas
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    startCamera();
                                }}
                                className="p-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg shadow-sm transition-all active:scale-90"
                                title="Tomar Foto"
                            >
                                <Camera className="w-4 h-4" />
                            </button>
                            <div className="hidden lg:flex gap-1 text-[10px] font-bold text-purple-500 bg-white dark:bg-gray-800/50 px-2 py-1 rounded-full shadow-sm">
                                <FileText className="w-3 h-3" /> AUTO
                            </div>
                        </div>
                    </>
                )}
            </div>

            {queue.length > 0 && (
                <div className="absolute top-full right-0 mt-2 w-72 max-h-[300px] overflow-y-auto bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 z-50 flex flex-col">
                    <div className="sticky top-0 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700 px-3 py-2 flex justify-between items-center backdrop-blur-sm">
                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Cola de Procesos</span>
                        <span className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 px-2 py-0.5 rounded-full font-bold">
                            {queue.filter(q => q.status === 'done').length} / {queue.length}
                        </span>
                    </div>
                    <div className="p-2 space-y-2">
                        {queue.map((item, index) => (
                            <div key={item.id} className="flex flex-col gap-1 text-sm bg-gray-50 dark:bg-gray-900/50 p-2 rounded-lg border border-gray-100 dark:border-gray-800">
                                <div className="flex items-center justify-between">
                                    <span className="font-semibold text-gray-700 dark:text-gray-300 truncate text-xs flex-1">
                                        {item.file?.name || `Captura #${index + 1}`}
                                    </span>
                                    <span className="shrink-0 ml-2">
                                        {item.status === 'pending' && <span className="text-[10px] font-bold px-2 py-1 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">Pendiente</span>}
                                        {item.status === 'processing' && <span className="text-[10px] font-bold px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded animate-pulse">Procesando...</span>}
                                        {item.status === 'done' && <span className="text-[10px] font-bold px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded">Completado</span>}
                                        {item.status === 'error' && <span className="text-[10px] font-bold px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded">Error</span>}
                                    </span>
                                </div>
                                {item.error && (
                                    <div className="text-[10px] text-red-600 dark:text-red-400 mt-1 line-clamp-2" title={item.error}>
                                        {item.error}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Camera Capture Modal */}
            <Modal 
                isOpen={isCameraModalOpen} 
                onClose={stopCamera} 
                title="Capturar Factura"
            >
                <div className="space-y-4">
                    <div className="relative aspect-[3/4] bg-black rounded-2xl overflow-hidden shadow-2xl border-4 border-gray-100 dark:border-gray-800">
                        {!capturedImage ? (
                            <>
                                <video 
                                    ref={videoRef} 
                                    autoPlay 
                                    playsInline 
                                    muted
                                    className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-x-6 inset-y-12 border-2 border-white/30 rounded-lg pointer-events-none">
                                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-purple-500 -mt-1 -ml-1"></div>
                                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-purple-500 -mt-1 -mr-1"></div>
                                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-purple-500 -mb-1 -ml-1"></div>
                                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-purple-500 -mb-1 -mr-1"></div>
                                </div>
                                <div className="absolute bottom-6 inset-x-0 flex justify-center">
                                    <button 
                                        onClick={capturePhoto}
                                        className="w-16 h-16 bg-white rounded-full border-4 border-purple-500 flex items-center justify-center shadow-xl active:scale-95 transition-transform"
                                    >
                                        <div className="w-12 h-12 bg-purple-600 rounded-full"></div>
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <img src={capturedImage} className="w-full h-full object-cover" />
                                <div className="absolute top-4 right-4 flex gap-2">
                                     <button 
                                        onClick={() => setCapturedImage(null)}
                                        className="p-3 bg-red-500/80 backdrop-blur-sm text-white rounded-full shadow-lg hover:bg-red-600 transition-colors"
                                    >
                                        <X className="w-6 h-6" />
                                    </button>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="flex gap-3 mt-4">
                        <AppButton 
                            variant="secondary" 
                            onClick={stopCamera}
                            className="flex-1"
                        >
                            Cancelar
                        </AppButton>
                        {capturedImage && (
                            <AppButton 
                                onClick={handleConfirmPhoto}
                                className="flex-1 bg-purple-600 hover:bg-purple-700"
                            >
                                <Check className="w-4 h-4 mr-2" /> Agregar a Cola
                            </AppButton>
                        )}
                    </div>
                </div>
                <canvas ref={canvasRef} className="hidden" />
            </Modal>
        </div>
    );
};
