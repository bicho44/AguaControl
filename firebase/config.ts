import { initializeApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';

let app: FirebaseApp | undefined;
let db: Firestore;
let auth: Auth;

export const initFirebase = (config: any) => {
    try {
        // Evitar doble inicialización si ya existe la app
        if (app) return true;

        app = initializeApp(config);
        db = getFirestore(app);
        auth = getAuth(app);
        
        console.log("Firebase inicializado correctamente.");
        return true;
    } catch (error) {
        console.error("Firebase init error:", error);
        return false;
    }
};

// --- LOGICA DE INICIALIZACIÓN ---

let isInitialized = false;

// 1. PRIORIDAD MÁXIMA: Variables de Entorno (Vercel / .env)
// Esto asegura que en producción siempre se use la config del despliegue, ignorando datos viejos del navegador.
try {
    const envConfig = {
        apiKey: (import.meta as any).env.VITE_FIREBASE_API_KEY,
        authDomain: (import.meta as any).env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: (import.meta as any).env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: (import.meta as any).env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: (import.meta as any).env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: (import.meta as any).env.VITE_FIREBASE_APP_ID
    };

    // Verificamos si al menos la API Key existe para considerar válida la config de entorno
    if (envConfig.apiKey && envConfig.apiKey.length > 0) {
        console.log("Detectadas variables de entorno (Vercel/Local). Usando esta configuración.");
        isInitialized = initFirebase(envConfig);
    }
} catch (e) {
    console.warn("No se pudieron leer las variables de entorno.", e);
}

// 2. FALLBACK: LocalStorage (Configuración Manual / Link)
// Solo se ejecuta si NO se pudo inicializar con las variables de entorno.
if (!isInitialized) {
    const savedConfig = localStorage.getItem('firebase_config');
    if (savedConfig) {
        try {
            console.log("Usando configuración guardada en navegador (Fallback).");
            isInitialized = initFirebase(JSON.parse(savedConfig));
        } catch (e) {
            console.error("Configuración guardada corrupta", e);
            localStorage.removeItem('firebase_config');
        }
    }
}

export { app, db, auth };