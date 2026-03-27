
import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { useNotification } from '../context/NotificationContext';
import AppButton from '../components/ui/AppButton';

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
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 border border-gray-100 dark:border-gray-700">
        <div className="text-center mb-8">
          <div className="bg-primary-600 w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg shadow-primary-500/30">
            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15V3m0 12l-4-4m4 4l4-4M2 17l.621 2.485A2 2 0 004.561 21h14.878a2 2 0 001.94-1.515L22 17" />
            </svg>
          </div>
          <h1 className="text-3xl font-black text-gray-800 dark:text-white tracking-tighter uppercase italic">Aguas Puras</h1>
          <p className="text-gray-400 dark:text-gray-500 text-xs font-black uppercase tracking-widest mt-1">
            {isRegistering ? 'Alta de Nuevo Usuario' : 'Acceso al Sistema'}
          </p>
        </div>
        
        <form onSubmit={handleAuth} className="space-y-5">
          {isRegistering && (
            <div className="animate-fade-in-down">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Nombre Completo</label>
                <input 
                  type="text" 
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full p-3.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-700/50 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                  required={isRegistering}
                  placeholder="Tu nombre..."
                />
            </div>
          )}

          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Correo Electrónico</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-700/50 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 transition-all"
              required
              placeholder="ejemplo@email.com"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Contraseña</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-700/50 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 transition-all"
              required
              placeholder="••••••••"
            />
          </div>
          
          <AppButton 
            type="submit" 
            disabled={isLoading}
            className="w-full py-4 px-4 bg-primary-600 hover:bg-primary-700 text-white font-black uppercase tracking-widest rounded-xl shadow-xl shadow-primary-500/20 transition-all transform active:scale-95 disabled:opacity-50"
          >
            {isLoading ? 'Procesando...' : (isRegistering ? 'Crear mi Acceso' : 'Entrar al Sistema')}
          </AppButton>
        </form>

        <div className="mt-8 text-center space-y-4">
            <AppButton 
                onClick={() => { setIsRegistering(!isRegistering); setNombre(''); setEmail(''); setPassword(''); }}
                variant="secondary"
                className="text-xs text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 font-black uppercase tracking-tighter block w-full bg-transparent border-transparent shadow-none"
            >
                {isRegistering 
                    ? '¿Ya tienes cuenta? Iniciar Sesión' 
                    : '¿No tienes contraseña aún? Regístrate aquí'}
            </AppButton>
            
            <AppButton 
                onClick={handleResetConfig}
                variant="secondary"
                className="text-[9px] text-gray-400 hover:text-red-500 uppercase font-bold tracking-widest pt-4 block mx-auto opacity-50 bg-transparent border-transparent shadow-none"
            >
                Configuración de base de datos
            </AppButton>
        </div>
      </div>
      
      <div className="mt-8 max-w-sm text-[10px] text-gray-400 dark:text-gray-500 text-center font-bold uppercase tracking-widest leading-relaxed">
        <p>IMPORTANTE: Si eres vendedor, debes registrarte con el mismo email que te asignó el administrador para heredar tus permisos y rutas.</p>
      </div>
    </div>
  );
};

export default LoginView;
