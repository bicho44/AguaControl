
import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { useNotification } from '../context/NotificationContext';
import { AppButton, AppInput, AppCard } from '../components/ui';

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

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
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
      
      // Errores de Permisos
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
  };

  return (
    <main className="container" style={{ maxWidth: '600px', marginTop: '2rem' }}>
      <AppCard
        title={
          <div style={{ textAlign: 'center' }}>
            <hgroup>
              <h1>Aguas Puras</h1>
              <p>{isRegistering ? 'Alta de Nuevo Usuario' : 'Acceso al Sistema'}</p>
            </hgroup>
          </div>
        }
      >
        <form onSubmit={handleAuth}>
          {isRegistering && (
            <AppInput 
              label="Nombre Completo"
              type="text" 
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required={isRegistering}
              placeholder="Tu nombre..."
            />
          )}

          <AppInput 
            label="Correo Electrónico"
            type="email" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="ejemplo@email.com"
          />

          <AppInput 
            label="Contraseña"
            type="password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
          />
          
          <AppButton 
            type="submit" 
            isLoading={isLoading}
            className="w-full"
            style={{ width: '100%' }}
          >
            {isRegistering ? 'Crear mi Acceso' : 'Entrar al Sistema'}
          </AppButton>
        </form>

        <footer style={{ textAlign: 'center', borderTop: 'none', padding: 0, marginTop: '1rem' }}>
          <AppButton 
            variant="ghost"
            onClick={() => { setIsRegistering(!isRegistering); setNombre(''); setEmail(''); setPassword(''); }}
            style={{ fontSize: '0.8rem', width: '100%' }}
          >
            {isRegistering 
                ? '¿Ya tienes cuenta? Iniciar Sesión' 
                : '¿No tienes contraseña aún? Regístrate aquí'}
          </AppButton>
          
          <AppButton 
            variant="ghost"
            onClick={handleResetConfig}
            style={{ fontSize: '0.7rem', opacity: 0.6, width: '100%', marginTop: '0.5rem' }}
          >
            Configuración de base de datos
          </AppButton>
        </footer>
      </AppCard>
      
      <div style={{ textAlign: 'center', marginTop: '2rem' }}>
        <small style={{ color: 'var(--pico-muted-color)' }}>
          IMPORTANTE: Si eres vendedor, debes registrarte con el mismo email que te asignó el administrador para heredar tus permisos y rutas.
        </small>
      </div>
    </main>
  );
};

export default LoginView;
