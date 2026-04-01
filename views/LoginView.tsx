
import React, { useState, useCallback } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { useNotification } from '../context/NotificationContext';
import { useFormShortcuts } from '../hooks/useFormShortcuts';

const LoginView: React.FC = () => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { showNotification } = useNotification();

  const handleResetConfig = () => {
      if (confirm('¿Estás seguro? Esto borrará la conexión actual y podrás ingresar nuevas credenciales.')) {
          localStorage.removeItem('firebase_config');
          window.location.reload();
      }
  };

  const checkEmailExistsInFirestore = async (email: string) => {
    try {
        const q = query(collection(db, 'usuarios'), where('email', '==', email.toLowerCase().trim()), limit(1));
        const snap = await getDocs(q);
        return !snap.empty;
    } catch (error: any) {
        console.error("Error al consultar Firestore:", error);
        if (error.code === 'permission-denied') {
            throw new Error('PERMISSION_DENIED_FIRESTORE');
        }
        return false;
    }
  };

  const handleAuth = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsLoading(true);
    const cleanEmail = email.toLowerCase().trim();

    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, cleanEmail, password);
        showNotification('Cuenta creada y vinculada con éxito.', 'success');
      } else {
        try {
          // 1. Intentar Login Auth
          await signInWithEmailAndPassword(auth, cleanEmail, password);
        } catch (signInError: any) {
          
          // 2. Si falla Auth, verificamos si existe en DB (Login híbrido)
          if (signInError.code === 'auth/invalid-credential' || signInError.code === 'auth/user-not-found') {
            try {
                const existsInDB = await checkEmailExistsInFirestore(cleanEmail);
                if (existsInDB) {
                  showNotification('Tu perfil existe, pero no tienes contraseña. Por favor, regístrate.', 'error');
                  setIsLoading(false);
                  return;
                }
            } catch (dbError: any) {
                if (dbError.message === 'PERMISSION_DENIED_FIRESTORE') {
                    throw { code: 'permission-denied', message: 'Bloqueo de seguridad en base de datos.' };
                }
            }
          }
          throw signInError; // Si no es caso especial, lanzar error original
        }
      }
    } catch (error: any) {
      console.error("Error de autenticación completo:", error);
      let msg = 'Error desconocido de autenticación.';
      
      // Errores de Permisos (EL TEMA ACTUAL)
      if (error.code === 'permission-denied' || error.message?.includes('permission-denied')) {
          msg = '⛔ ACCESO DENEGADO A BASE DE DATOS. Ve a Firebase Console -> Firestore -> Reglas y cámbialas a "allow read, write: if true;"';
      }
      // Errores comunes de usuario
      else if (error.code === 'auth/email-already-in-use') msg = 'Este email ya está registrado. Intenta iniciar sesión.';
      else if (error.code === 'auth/weak-password') msg = 'La contraseña debe tener al menos 6 caracteres.';
      else if (error.code === 'auth/invalid-email') msg = 'Formato de email inválido.';
      else if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') msg = 'Email o contraseña incorrectos.';
      
      // Errores de Configuración
      else if (error.code === 'auth/network-request-failed') msg = 'Error de red. Verifica tu conexión.';
      else if (error.code === 'auth/operation-not-allowed') msg = 'El inicio de sesión Email/Pass no está habilitado en Firebase.';
      else if (error.code === 'auth/invalid-api-key') msg = 'API Key inválida en configuración.';
      else if (error.code === 'auth/app-not-authorized') msg = 'Dominio no autorizado en Firebase Auth.';
      else if (error.code === 'auth/too-many-requests') msg = 'Demasiados intentos. Espera unos minutos.';

      showNotification(msg, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [email, password, isRegistering, showNotification]);

  useFormShortcuts({
    onSave: handleAuth
  });

  return (
    <main className="container" style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <article style={{ maxWidth: '400px', width: '100%', margin: 0 }}>
        <header style={{ textAlign: 'center' }}>
          <div style={{ backgroundColor: 'var(--pico-primary-background)', width: '64px', height: '64px', borderRadius: '1rem', margin: '0 auto 1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg style={{ width: '40px', height: '40px', color: 'var(--pico-primary-inverse)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15V3m0 12l-4-4m4 4l4-4M2 17l.621 2.485A2 2 0 004.561 21h14.878a2 2 0 001.94-1.515L22 17" />
            </svg>
          </div>
          <h2 style={{ margin: 0, textTransform: 'uppercase', letterSpacing: '-0.02em', fontStyle: 'italic', fontWeight: 900 }}>Aguas Puras</h2>
          <small style={{ textTransform: 'uppercase', fontWeight: 900, opacity: 0.6, letterSpacing: '0.1em' }}>
            {isRegistering ? 'Alta de Nuevo Usuario' : 'Acceso al Sistema'}
          </small>
        </header>
        
        <form onSubmit={handleAuth}>
          {isRegistering && (
            <label>
                Nombre Completo
                <input 
                  type="text" 
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  required={isRegistering}
                  placeholder="Tu nombre..."
                />
            </label>
          )}

          <label>
            Correo Electrónico
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="ejemplo@email.com"
            />
          </label>
          
          <label>
            Contraseña
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </label>
          
          <button 
            type="submit" 
            disabled={isLoading}
            style={{ width: '100%', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}
          >
            {isLoading ? 'Procesando...' : (isRegistering ? 'Crear mi Acceso' : 'Entrar al Sistema')}
          </button>
          <div style={{ textAlign: 'center' }}>
            <small style={{ opacity: 0.5 }}>(Alt+Enter para enviar)</small>
          </div>
        </form>

        <footer>
            <button 
                onClick={() => { setIsRegistering(!isRegistering); setNombre(''); setEmail(''); setPassword(''); }}
                className="contrast outline"
                style={{ width: '100%', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '1rem' }}
            >
                {isRegistering 
                    ? '¿Ya tienes cuenta? Iniciar Sesión' 
                    : '¿No tienes contraseña aún? Regístrate aquí'}
            </button>
            
            <div style={{ textAlign: 'center' }}>
                <a 
                    href="#"
                    onClick={(e) => { e.preventDefault(); handleResetConfig(); }}
                    style={{ fontSize: '0.625rem', textTransform: 'uppercase', fontWeight: 900, opacity: 0.5, color: 'var(--pico-muted-color)' }}
                >
                    Configuración de base de datos
                </a>
            </div>
        </footer>
      </article>
    </main>
  );
};

export default LoginView;
