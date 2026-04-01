
import React, { useState, useEffect } from 'react';
import { initFirebase } from '../firebase/config';

// Force sync

interface SetupViewProps {
    onConfigured: () => void;
}

const SetupView: React.FC<SetupViewProps> = ({ onConfigured }) => {
    const [input, setInput] = useState('');
    const [error, setError] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    // Auto-configuración vía URL
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const configEncoded = params.get('config');

        if (configEncoded) {
            setIsProcessing(true);
            try {
                // Decodificar Base64
                const configStr = atob(configEncoded);
                const config = JSON.parse(configStr);

                if (config && config.apiKey && config.projectId) {
                    const success = initFirebase(config);
                    if (success) {
                        localStorage.setItem('firebase_config', JSON.stringify(config));
                        // Limpiar URL para que no quede la config visible y evitar re-procesamiento al refrescar
                        window.history.replaceState({}, document.title, window.location.pathname);
                        onConfigured();
                    } else {
                        setError("La configuración del enlace no es válida.");
                        setIsProcessing(false);
                    }
                } else {
                    setError("El enlace de configuración está incompleto.");
                    setIsProcessing(false);
                }
            } catch (e) {
                console.error(e);
                setError("Enlace de configuración corrupto.");
                setIsProcessing(false);
            }
        }
    }, [onConfigured]);

    const handleConnect = () => {
        setError('');
        setIsProcessing(true);

        setTimeout(() => {
            try {
                let jsonStr = input.trim();
                
                // 1. Limpieza de comentarios (// o /* */) que rompen el parseo
                jsonStr = jsonStr.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '');

                // 2. Extracción inteligente del objeto
                // Busca desde el primer '{' hasta el último '}' ignorando lo que haya antes (const x = ...)
                const firstBrace = jsonStr.indexOf('{');
                const lastBrace = jsonStr.lastIndexOf('}');

                if (firstBrace !== -1 && lastBrace !== -1) {
                    jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
                }

                // 3. Parseo
                // Firebase da un objeto JS (claves sin comillas), no JSON estricto.
                let config;
                try {
                    // eslint-disable-next-line no-new-func
                    config = new Function('return ' + jsonStr)();
                } catch (e) {
                    // Si falla new Function, intentamos limpiar un poco más y usar JSON.parse
                    // Esto es un intento desesperado si el usuario pegó JSON estricto
                    try {
                        config = JSON.parse(jsonStr);
                    } catch (jsonError) {
                        throw new Error("No se pudo interpretar el código. Asegúrate de copiar solo el objeto de configuración (desde '{' hasta '}') o el bloque completo.");
                    }
                }

                if (!config || !config.apiKey || !config.projectId) {
                    throw new Error("El código no contiene 'apiKey' o 'projectId'. Verifica que hayas copiado las credenciales correctas.");
                }

                // 4. Intentar inicializar
                const success = initFirebase(config);
                if (success) {
                    // Guardar para futuras sesiones
                    localStorage.setItem('firebase_config', JSON.stringify(config));
                    onConfigured();
                } else {
                    setError("No se pudo conectar con Firebase. Verifique que los datos sean correctos.");
                }
            } catch (err: any) {
                console.error(err);
                setError(err.message || "Error desconocido al procesar la configuración.");
            } finally {
                setIsProcessing(false);
            }
        }, 500);
    };

    return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4 font-sans">
            <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl overflow-hidden relative">
                
                {/* Header Azul */}
                <div className="bg-blue-600 p-8 text-center relative overflow-hidden">
                    {/* Elementos decorativos de fondo */}
                    <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                        <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                            <circle cx="0" cy="0" r="40" fill="white" />
                            <circle cx="100" cy="100" r="30" fill="white" />
                        </svg>
                    </div>

                    <div className="relative z-10 flex flex-col items-center">
                        <div className="bg-white/20 p-4 rounded-2xl backdrop-blur-sm mb-4">
                            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                            </svg>
                        </div>
                        <h1 className="text-2xl font-black text-white tracking-wide italic">AGUAS PURAS SETUP</h1>
                        <p className="text-blue-100 text-xs font-bold tracking-widest mt-1 uppercase">Conexión de Base de Datos</p>
                    </div>
                </div>

                {/* Body */}
                <div className="p-8 space-y-6">
                    
                    {/* Instrucciones */}
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2 text-blue-800">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="font-bold text-sm">INSTRUCCIONES</span>
                        </div>
                        <p className="text-sm text-gray-600 leading-relaxed">
                            Pegá el código de <code className="font-bold text-gray-800">firebaseConfig</code> que te da la consola de Google Firebase.
                        </p>
                        <div className="mt-2 bg-white/50 p-2 rounded text-xs font-mono text-gray-500 border border-blue-100 whitespace-pre-wrap">
                            {`const firebaseConfig = {
  apiKey: "...",
  authDomain: "..."
};`}
                        </div>
                    </div>

                    {/* Input Area */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Configuración de Firebase</label>
                        <div className="relative">
                            <textarea 
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                className="w-full h-32 p-4 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none transition-all"
                                placeholder={`Pega aquí el código completo...`}
                            />
                            {/* Icono de esquina decorativo */}
                            <div className="absolute bottom-2 right-2 text-gray-300 pointer-events-none">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                                </svg>
                            </div>
                        </div>
                        {error && (
                            <p className="text-red-500 text-xs font-medium animate-pulse border-l-2 border-red-500 pl-2">
                                {error}
                            </p>
                        )}
                    </div>

                    {/* Botón */}
                    <button 
                        onClick={handleConnect}
                        disabled={(!input && !isProcessing) || isProcessing}
                        className="w-full py-4 bg-gray-900 text-white rounded-xl font-bold text-sm tracking-wide shadow-lg hover:bg-black hover:shadow-xl transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isProcessing ? (
                            <span>CONECTANDO...</span>
                        ) : (
                            <>
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                CONECTAR SISTEMA
                            </>
                        )}
                    </button>

                    <p className="text-center text-[10px] text-gray-400 font-medium px-4">
                        TUS CLAVES SE GUARDARÁN LOCALMENTE PARA SINCRONIZAR TU STOCK Y REMITOS.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default SetupView;
