import React, { useRef, useState, useEffect } from 'react';
import { extractFacturaData } from './ocrService';
import { useDataStore } from '../../hooks/useDataStore';
import { collection, addDoc, updateDoc, doc, onSnapshot, query, orderBy, limit, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useNotification } from '../../context/NotificationContext';
import { UploadCloud, FileText, Camera, X, Check, List } from 'lucide-react';
import { EstadoFacturaProveedor, Proveedor } from '../../types';
import { getLocalDateString } from '../../utils/dateUtils';
import AppButton from '../../components/ui/AppButton';
import Modal from '../../components/Modal';
import { formatFacturaNumber } from './FacturasList';
import { OjoMagicoQueueModal } from './OjoMagicoQueueModal';

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
    const [queue, setQueue] = useState<any[]>([]);
    const [isExtracting, setIsExtracting] = useState(false);
    const [isQuotaPaused, setIsQuotaPaused] = useState(false);
    const [showQueueUI, setShowQueueUI] = useState(false);
    
    // Auth no se usa estrictamente, pero le podemos poner "unknown" si falla
    
    useEffect(() => {
        // Aseguramos una session para restringir el auto-procesamiento al uploader
        if (!sessionStorage.getItem('sessionId')) {
            sessionStorage.setItem('sessionId', Math.random().toString(36).substring(2, 15));
        }

        const q = query(collection(db, 'ojo_magico_queue'), orderBy('createdAt', 'desc'), limit(30));
        const unsub = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            // Ordenar por fecha asc para que los mas viejos se muestren primero (si fuesen pendientes) o como se prefiera
            data.sort((a: any, b: any) => a.createdAt - b.createdAt);
            setQueue(data);
        });
        return () => unsub();
    }, []);
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);

    const isProcessingRef = useRef(false);
    const queueRef = useRef(queue);

    useEffect(() => {
        queueRef.current = queue;
    }, [queue]);

    const [queueTrigger, setQueueTrigger] = useState(0);

    // Procesamiento en background de la cola de archivos locales (subidos por este usuario)
    useEffect(() => {
        const processNextInQueue = async () => {
            if (isQuotaPaused) return;
            if (isProcessingRef.current) return;

            const sessionId = sessionStorage.getItem('sessionId');
            
            // Usamos directamente `queue` del state que viene mapeado del snapshot
            const nextItem = queue.find(fi => fi.status === 'pending');
            
            if (!nextItem) {
                // Cola terminada localmente (ningún archivo en 'pending')
                setIsExtracting(false);
                setTimeout(() => window.dispatchEvent(new CustomEvent('ojo_magico_done', { detail: { count: 1 } })), 1000);
                return;
            }

            isProcessingRef.current = true;
            setIsExtracting(true);

            // Marcar como procesando en Firestore
            try {
                await updateDoc(doc(db, 'ojo_magico_queue', nextItem.id), { status: 'processing' });
            } catch(e) {
                console.error("Error setting state to processing", e);
            }

            try {
                let base64String = nextItem.base64;
                let mimeType = nextItem.mimeType;

                if (base64String && mimeType) {
                    await processBase64(base64String, mimeType);
                }
                
                // Esperar 3 segundos antes de marcar como completado para dar respiro a la API
                await new Promise(resolve => setTimeout(resolve, 3000));
                
                // Marcar como completado en firebase
                await updateDoc(doc(db, 'ojo_magico_queue', nextItem.id), { status: 'done' });
                
            } catch (error: any) {
                console.error("Error processing factura:", error);
                if (error.message?.includes("429_QUOTA_EXCEEDED") || error.message?.includes("NETWORK_ERROR")) {
                    await updateDoc(doc(db, 'ojo_magico_queue', nextItem.id), { status: 'pending' });
                    setIsExtracting(false);
                    setIsQuotaPaused(true);
                } else {
                    await updateDoc(doc(db, 'ojo_magico_queue', nextItem.id), { status: 'error', error: error.message });
                }
            } finally {
                // Liberar para la próxima re-renderización disparada por updateDoc ('done')
                isProcessingRef.current = false;
                setQueueTrigger(t => t + 1); // Forzar re-ejecución por si la cola se actualizó mientras estaba bloqueado
            }
        };

        processNextInQueue();
    }, [queue, isQuotaPaused, queueTrigger]);

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
        // stopCamera(); // Remove this so the user can keep taking photos
        
        addToQueue({
            base64: base64Data,
            mimeType: 'image/jpeg'
        });
        showNotification('Foto agregada a la cola de procesamiento...', 'success');
        setCapturedImage(null); // Go back to camera preview
    };

    const processBase64 = async (base64String: string, mimeType: string) => {
        try {
            const extractedData = await extractFacturaData(base64String, mimeType);
            
            const tipo = (extractedData.tipoComprobante || 'A') as any;
            const pVenta = extractedData.puntoVenta || 0;
            const nComprobante = extractedData.numeroComprobante || 0;

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
                    // Check duplicate for this provider BEFORE updating or doing anything
                    if (pVenta && nComprobante) {
                        const existingFac = facturasProveedor.find(f => 
                            f.proveedorId === prov.id && 
                            f.puntoVenta === pVenta && 
                            f.numeroComprobante === nComprobante && 
                            f.tipoComprobante === tipo
                        );
                        
                        if (existingFac) {
                            const errorMsg = `La factura ${tipo} ${formatFacturaNumber({ puntoVenta: pVenta, numeroComprobante: nComprobante })} ya se encuentra registrada para el proveedor ${prov.nombre}.`;
                            showNotification(errorMsg, 'error');
                            throw new Error(errorMsg);
                        }
                    }

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

            const dataToSave = {
                proveedorId: foundProvId,
                puntoVenta: extractedData.puntoVenta || 0,
                numeroComprobante: extractedData.numeroComprobante || 0,
                numero: extractedData.numero || '', // legacy fallback
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
            } else if (error.message === "429_QUOTA_EXCEEDED") {
                showNotification('Sin créditos de IA. El procesamiento se ha pausado.', 'error');
            } else if (error.message === "NETWORK_ERROR") {
                showNotification('Error de red. El procesamiento se ha pausado. Revisa tu conexión.', 'error');
            } else {
                showNotification('Error extrayendo datos: ' + error.message, 'error');
            }
            throw error;
        }
    };

    const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const img = new Image();
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        let { width, height } = img;
                        const MAX_SIZE = 600;
                        if (width > height) {
                            if (width > MAX_SIZE) {
                                height *= MAX_SIZE / width;
                                width = MAX_SIZE;
                            }
                        } else {
                            if (height > MAX_SIZE) {
                                width *= MAX_SIZE / height;
                                height = MAX_SIZE;
                            }
                        }
                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        if (ctx) ctx.drawImage(img, 0, 0, width, height);
                        resolve(canvas.toDataURL('image/jpeg', 0.6).split(',')[1]);
                    };
                    img.onerror = reject;
                    img.src = e.target?.result as string;
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            } else {
                const reader = new FileReader();
                reader.onload = () => resolve((reader.result as string).split(',')[1]);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            }
        });
    };

    const addToQueue = async (item: Omit<QueueItem, 'id' | 'status'>) => {
        const fileName = item.file ? item.file.name : `Captura-${new Date().toLocaleTimeString()}`;
        try {
            let base64 = item.base64;
            let mimeType = item.mimeType;
            if (item.file && !base64) {
                 base64 = await fileToBase64(item.file);
                 mimeType = item.file.type.startsWith('image/') ? 'image/jpeg' : item.file.type;
            }
            
            await addDoc(collection(db, 'ojo_magico_queue'), {
                fileName,
                status: 'pending',
                createdAt: Date.now(),
                base64: base64 || null,
                mimeType: mimeType || null,
                uploaderSessionId: sessionStorage.getItem('sessionId') || ''
            });

        } catch (e) {
            console.error("Error al encolar en firestore", e);
            showNotification("Error de conexión o archivo muy grande", "error");
        }
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
                    isQuotaPaused ? 'border-red-400 bg-red-50 dark:border-red-800 dark:bg-gray-800 shadow-inner' :
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

                {isQuotaPaused ? (
                    <>
                        <div className="bg-red-100 dark:bg-red-900/30 p-2 rounded-full shadow-sm text-red-600 dark:text-red-400 shrink-0">
                            <FileText className="w-6 h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-bold text-gray-800 dark:text-white truncate">✨ Ojo Mágico Pausado</h3>
                            <p className="text-xs text-red-600 dark:text-red-400 font-medium truncate">Proceso en pausa por límites de servidor ({queueCount} pendientes).</p>
                            <p className="text-[10px] text-gray-500 mt-0.5">La cuota de IA es manejada internamente. Se reanudará solo (intenta subir de a lotes más pequeños).</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsQuotaPaused(false);
                                }}
                                className="text-xs px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-sm transition-all active:scale-95 whitespace-nowrap"
                            >
                                Reintentar
                            </button>
                            {queue.length > 0 && (
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowQueueUI(!showQueueUI);
                                    }}
                                    className={`p-2 rounded-lg shadow-sm transition-all active:scale-90 ${showQueueUI ? 'bg-purple-700 text-white' : 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'}`}
                                    title="Ver Cola de Procesos"
                                >
                                    <List className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </>
                ) : isExtracting ? (
                    <>
                        <div className="w-8 h-8 rounded-full border-4 border-purple-200 border-t-purple-600 animate-spin shrink-0"></div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-bold text-gray-800 dark:text-white truncate">✨ Ojo Mágico Trabajando</h3>
                            <p className="text-xs text-purple-600 dark:text-purple-400 font-medium truncate">Procesando {queueCount} facturas restantes...</p>
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
                            {queue.length > 0 && (
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowQueueUI(!showQueueUI);
                                    }}
                                    className={`p-2 rounded-lg shadow-sm transition-all active:scale-90 ${showQueueUI ? 'bg-purple-700 text-white' : 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'}`}
                                    title="Ver Cola de Procesos"
                                >
                                    <List className="w-4 h-4" />
                                </button>
                            )}
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
                            {queue.length > 0 && (
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowQueueUI(!showQueueUI);
                                    }}
                                    className={`p-2 rounded-lg shadow-sm transition-all active:scale-90 ${showQueueUI ? 'bg-purple-700 text-white' : 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'}`}
                                    title="Ver Cola de Procesos"
                                >
                                    <List className="w-4 h-4" />
                                </button>
                            )}
                            <div className="hidden lg:flex gap-1 text-[10px] font-bold text-purple-500 bg-white dark:bg-gray-800/50 px-2 py-1 rounded-full shadow-sm">
                                <FileText className="w-3 h-3" /> AUTO
                            </div>
                        </div>
                    </>
                )}
            </div>

            {showQueueUI && (
                <OjoMagicoQueueModal 
                    isOpen={showQueueUI}
                    onClose={() => setShowQueueUI(false)}
                    queue={queue}
                />
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
