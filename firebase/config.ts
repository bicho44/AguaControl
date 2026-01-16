
import { initializeApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';

let app: FirebaseApp | undefined;
let db: Firestore;
let auth: Auth;

export const initFirebase = (config: any) => {
    try {
        app = initializeApp(config);
        db = getFirestore(app);
        auth = getAuth(app);
        return true;
    } catch (error) {
        console.error("Firebase init error:", error);
        return false;
    }
};

// 1. Intentar cargar desde LocalStorage (Persistencia del usuario)
const savedConfig = localStorage.getItem('firebase_config');

if (savedConfig) {
    try {
        initFirebase(JSON.parse(savedConfig));
    } catch (e) {
        console.error("Configuración guardada corrupta", e);
        localStorage.removeItem('firebase_config');
    }
} else {
    // 2. Fallback: Intentar cargar desde variables de entorno (.env) si existen (Modo Desarrollador)
    try {
        const envConfig = {
            apiKey: (import.meta as any).env.VITE_FIREBASE_API_KEY,
            authDomain: (import.meta as any).env.VITE_FIREBASE_AUTH_DOMAIN,
            projectId: (import.meta as any).env.VITE_FIREBASE_PROJECT_ID,
            storageBucket: (import.meta as any).env.VITE_FIREBASE_STORAGE_BUCKET,
            messagingSenderId: (import.meta as any).env.VITE_FIREBASE_MESSAGING_SENDER_ID,
            appId: (import.meta as any).env.VITE_FIREBASE_APP_ID
        };

        // Solo inicializar si al menos hay una API Key válida en el env
        if (envConfig.apiKey && envConfig.apiKey.length > 0) {
            initFirebase(envConfig);
        }
    } catch (e) {
        // Ignorar error si no hay env vars
    }
}

export { app, db, auth };
