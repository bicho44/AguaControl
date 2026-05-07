import React, { useState, useEffect } from 'react';
import Modal from '../../components/Modal';
import AppButton from '../../components/ui/AppButton';
import { deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useNotification } from '../../context/NotificationContext';
import { Trash2, RotateCw, Eye, Play } from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    queue: any[];
}

export const OjoMagicoQueueModal: React.FC<Props> = ({ isOpen, onClose, queue }) => {
    const { showNotification } = useNotification();
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [previewType, setPreviewType] = useState<'pdf' | 'image' | null>(null);

    const handleClearQueue = async () => {
        const toDelete = queue.filter(q => q.status === 'done' || q.status === 'error');
        for (const item of toDelete) {
            try {
                await deleteDoc(doc(db, 'ojo_magico_queue', item.id));
            } catch(e) { console.error("Error deleting", e); }
        }
        setPreviewUrl(null);
        showNotification(`${toDelete.length} archivos limpiados de la cola.`, 'success');
    };

    const handleDelete = async (itemId: string) => {
        try {
            await deleteDoc(doc(db, 'ojo_magico_queue', itemId));
            setPreviewUrl(null);
        } catch(e) { console.error("Error deleting", e); }
    };

    const handleRetry = async (item: any) => {
        if (!item.base64) {
             showNotification('La imagen original no está disponible. Debes subirla de nuevo.', 'error');
             return;
        }
        try {
            const currentSession = sessionStorage.getItem('sessionId') || Math.random().toString(36).substring(2, 15);
            sessionStorage.setItem('sessionId', currentSession);
            await updateDoc(doc(db, 'ojo_magico_queue', item.id), { 
                status: 'pending', 
                error: '',
                uploaderSessionId: currentSession
            });
            showNotification('Encolado nuevamente para proceso.', 'success');
        } catch (e) { }
    };

    const handlePreview = (item: any) => {
        if (!item.base64) {
            showNotification('El archivo originario no está adjunto o se eliminó.', 'error');
            return;
        }
        
        let type: 'pdf' | 'image' = 'image';
        if (item.mimeType === 'application/pdf') type = 'pdf';
        if (item.fileName?.toLowerCase().endsWith('.pdf')) type = 'pdf';
        
        setPreviewType(type);

        try {
            // Decodificamos el base64 a binario para crear un blob, lo que permite preview de PDF sin problemas de largo URI
            const byteCharacters = atob(item.base64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: item.mimeType || 'image/jpeg' });
            const url = URL.createObjectURL(blob);
            setPreviewUrl(url);
        } catch (e) {
            // Fallback
            const url = `data:${item.mimeType || 'image/jpeg'};base64,${item.base64}`;
            setPreviewUrl(url);
        }
    };

    // Clean up preview url
    useEffect(() => {
        return () => {
             if (previewUrl && previewUrl.startsWith('blob:')) {
                 URL.revokeObjectURL(previewUrl);
             }
        };
    }, [previewUrl]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Gestión de Cola de Extração">
            <div className="space-y-4">
                <div className="flex justify-between items-center bg-purple-50 dark:bg-purple-900/10 p-3 rounded-lg border border-purple-100 dark:border-purple-800">
                    <p className="text-sm font-medium text-purple-800 dark:text-purple-300">
                        {queue.length} elementos en cola.
                    </p>
                    <div className="space-x-2">
                        <AppButton variant="secondary" size="sm" onClick={handleClearQueue}>
                             Limpiar Completados/Errores
                        </AppButton>
                    </div>
                </div>

                <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2">
                    {queue.length === 0 && (
                        <p className="text-center text-gray-500 py-4">No hay archivos en la cola</p>
                    )}
                    {queue.map((item, index) => (
                        <div key={item.id} className="flex flex-col gap-2 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
                            <div className="flex items-center justify-between">
                                <span className="font-semibold text-gray-700 dark:text-gray-300 truncate text-sm flex-1 mr-2" title={item.fileName}>
                                    {item.fileName || `Captura #${index + 1}`}
                                </span>
                                <div className="flex items-center gap-2 shrink-0">
                                    {item.status === 'pending' && <span className="text-[10px] font-bold px-2 py-1 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">Pendiente</span>}
                                    {item.status === 'processing' && <span className="text-[10px] font-bold px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded animate-pulse">Procesando...</span>}
                                    {item.status === 'done' && <span className="text-[10px] font-bold px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded">Completado</span>}
                                    {item.status === 'error' && <span className="text-[10px] font-bold px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded">Error</span>}
                                    
                                    <button onClick={() => handlePreview(item)} className="p-1.5 text-gray-500 hover:text-purple-600 bg-white dark:bg-gray-700 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded" title="Previsualizar">
                                        <Eye className="w-4 h-4" />
                                    </button>
                                    
                                    {(item.status === 'error' || item.status === 'done') && (
                                        <button onClick={() => handleRetry(item)} className="p-1.5 text-gray-500 hover:text-blue-600 bg-white dark:bg-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded" title="Re-intentar">
                                            <RotateCw className="w-4 h-4" />
                                        </button>
                                    )}
                                    {item.status === 'pending' && (
                                        <button onClick={() => handleRetry(item)} className="p-1.5 text-gray-500 hover:text-green-600 bg-white dark:bg-gray-700 hover:bg-green-50 dark:hover:bg-green-900/30 rounded" title="Procesar ahora">
                                            <Play className="w-4 h-4 text-green-500" />
                                        </button>
                                    )}
                                    <button onClick={() => handleDelete(item.id)} className="p-1.5 text-gray-500 hover:text-red-600 bg-white dark:bg-gray-700 hover:bg-red-50 dark:hover:bg-red-900/30 rounded" title="Eliminar">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            {item.error && (
                                <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/10 p-2 rounded" title={item.error}>
                                    <p className="font-bold">Error de extracción:</p>
                                    <p className="line-clamp-2">{item.error}</p>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {previewUrl && (
                    <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4">
                        <div className="flex justify-between items-center mb-2">
                            <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200">Previsualización</h4>
                            <AppButton variant="secondary" size="sm" onClick={() => setPreviewUrl(null)}>Cerrar Previsualización</AppButton>
                        </div>
                        <div className="bg-gray-100 dark:bg-gray-900 rounded-lg overflow-hidden flex items-center justify-center min-h-[200px] p-2">
                            {previewType === 'pdf' ? (
                                <iframe src={previewUrl} className="w-full h-[60vh] rounded" title="PDF Preview" />
                            ) : (
                                <img src={previewUrl} alt="Preview" className="max-w-full max-h-[60vh] object-contain rounded" />
                            )}
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};
