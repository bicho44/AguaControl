
import React, { useState, useMemo } from 'react';
import { LogEntry, LogLevel } from '../types';
import Card from '../components/Card';
import AppButton from '../components/ui/AppButton';
import AppInput from '../components/ui/AppInput';
import { SearchIcon } from '../components/icons/SearchIcon';
import Modal from '../components/Modal';
import { useNotification } from '../context/NotificationContext';

// Force sync

interface SystemLogsViewProps {
    logs: LogEntry[];
}

const SystemLogsView: React.FC<SystemLogsViewProps> = ({ logs }) => {
    const [filter, setFilter] = useState('');
    const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
    const { showNotification } = useNotification();

    const filteredLogs = useMemo(() => {
        return logs.filter(log => 
            log.message.toLowerCase().includes(filter.toLowerCase()) || 
            log.userEmail?.toLowerCase().includes(filter.toLowerCase()) ||
            log.level.toLowerCase().includes(filter.toLowerCase())
        );
    }, [logs, filter]);

    const handleCopyLog = () => {
        if (!selectedLog) return;
        const text = JSON.stringify(selectedLog, null, 2);
        navigator.clipboard.writeText(text);
        showNotification('Log copiado al portapapeles.', 'success');
    };

    return (
        <div className="space-y-6 pt-12 md:pt-0 pb-12">
            <h1 className="text-3xl font-black text-gray-800 dark:text-white uppercase tracking-tighter">Registros de Sistema (Logs)</h1>
            
            <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 p-4 rounded-xl text-sm text-yellow-800 dark:text-yellow-200">
                <p><strong>ℹ️ Herramienta de Soporte:</strong> Si ocurre un error, busca el registro aquí, haz clic en "Ver Detalle" y luego en "Copiar JSON" para enviar el reporte técnico.</p>
            </div>

            <Card>
                <div className="p-4 border-b dark:border-gray-700">
                    <div className="relative">
                        <AppInput 
                            placeholder="Buscar error, usuario..." 
                            value={filter} 
                            onChange={(e) => setFilter(e.target.value)} 
                            className="pl-10"
                        />
                        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pt-6 pointer-events-none">
                            <SearchIcon className="h-5 w-5 text-gray-400" />
                        </div>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                            <tr>
                                <th className="px-6 py-3">Fecha / Hora</th>
                                <th className="px-6 py-3">Nivel</th>
                                <th className="px-6 py-3">Mensaje</th>
                                <th className="px-6 py-3">Usuario</th>
                                <th className="px-6 py-3 text-right">Acción</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredLogs.map(log => (
                                <tr key={log.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                    <td className="px-6 py-4 font-mono text-xs">
                                        {new Date(log.timestamp).toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                                            log.level === LogLevel.ERROR ? 'bg-red-100 text-red-800' : 
                                            log.level === LogLevel.WARNING ? 'bg-yellow-100 text-yellow-800' : 
                                            'bg-blue-100 text-blue-800'
                                        }`}>
                                            {log.level}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white truncate max-w-xs" title={log.message}>
                                        {log.message}
                                    </td>
                                    <td className="px-6 py-4 text-gray-500 text-xs">
                                        {log.userEmail || 'Sistema'}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button 
                                            onClick={() => setSelectedLog(log)}
                                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 font-bold hover:underline"
                                        >
                                            Ver Detalle
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {filteredLogs.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="text-center py-8 text-gray-500">
                                        No se encontraron registros.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {selectedLog && (
                <Modal isOpen={true} onClose={() => setSelectedLog(null)} className="max-w-4xl">
                    <div className="space-y-4">
                        <div className="flex justify-between items-start border-b dark:border-gray-700 pb-4 pr-12">
                            <h2 className="text-2xl font-bold text-gray-800 dark:text-white pr-12">Detalle del Log</h2>
                            <span className={`px-3 py-1 rounded text-sm font-bold uppercase ${
                                selectedLog.level === LogLevel.ERROR ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                            }`}>
                                {selectedLog.level}
                            </span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="block text-gray-500 font-bold uppercase text-xs">Fecha</span>
                                <span className="font-mono">{new Date(selectedLog.timestamp).toLocaleString()}</span>
                            </div>
                            <div>
                                <span className="block text-gray-500 font-bold uppercase text-xs">Usuario</span>
                                <span>{selectedLog.userEmail || 'Anónimo'} ({selectedLog.userId || 'N/A'})</span>
                            </div>
                            <div className="col-span-2">
                                <span className="block text-gray-500 font-bold uppercase text-xs">Mensaje</span>
                                <p className="font-bold text-lg">{selectedLog.message}</p>
                            </div>
                            <div className="col-span-2">
                                <span className="block text-gray-500 font-bold uppercase text-xs mb-1">Stack Trace / Detalles</span>
                                <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-xs overflow-auto max-h-60 whitespace-pre-wrap">
                                    {selectedLog.details || 'Sin detalles adicionales.'}
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
                            <AppButton variant="secondary" onClick={() => setSelectedLog(null)}>Cerrar</AppButton>
                            <AppButton variant="primary" onClick={handleCopyLog}>Copiar JSON para Soporte</AppButton>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default SystemLogsView;
