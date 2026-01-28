
import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, getDocs, limit, query, doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { useNotification } from '../context/NotificationContext';
import { Rol, TipoVendedor, Usuario } from '../types';
import AppButton from '../components/ui/AppButton';
import AppInput from '../components/ui/AppInput';

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

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (isRegistering) {
        // 1. Verificar base de datos
        try {
            const usersRef = collection(db, 'usuarios');
            const q = query(usersRef, limit(1));
            const snapshot = await getDocs(q);

            if (!snapshot.empty) {
                showNotification('El sistema ya está inicializado. Inicie sesión.', 'error');
                setIsLoading(false);
                return;
            }
        } catch (dbError: any) {
            console.warn("No se pudo verificar existencia de usuarios. Intentando crear Admin...", dbError);
        }

        // 2. Crear usuario en Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 3. Crear documento
        try {
            const newUser: Usuario = {
                id: user.uid,
                nombre: nombre,
                email: email,
                rol: Rol.ADMINISTRADOR,
                tipo: TipoVendedor.INTERNO
            };
            await setDoc(doc(db, 'usuarios', user.uid), newUser);
            showNotification('¡Cuenta creada! Ingresando...', 'success');
        } catch (writeError) {
            console.error("Error escritura DB:", writeError);
            showNotification('Usuario creado, pero hubo un error guardando el perfil.', 'success');
        }

      } else {
        // Login Normal
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error: any) {
      console.error("Error de autenticación:", error);
      let msg = 'Error desconocido';
      
      if (error.code === 'auth/invalid-credential') msg = 'Email o contraseña incorrectos.';
      if (error.code === 'auth/email-already-in-use') msg = 'Este email ya está registrado.';
      if (error.code === 'auth/operation-not-allowed') msg = 'Error de configuración en Firebase (Auth).';
      if (error.code === 'permission-denied') msg = 'Error de permisos en Firestore.';
      
      showNotification(msg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 border dark:border-gray-700">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary-600 dark:text-primary-400">Aguas Puras</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            {isRegistering ? 'Crear Primer Administrador' : 'Iniciar Sesión'}
          </p>
        </div>
        
        <form onSubmit={handleAuth} className="space-y-6">
          {isRegistering && (
            <div className="animate-fade-in-down">
                <AppInput 
                    label="Nombre Completo"
                    type="text" 
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    required={isRegistering}
                    placeholder="Ej: Admin Principal"
                />
            </div>
          )}

          <AppInput
            label="Email"
            type="email" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="usuario@ejemplo.com"
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
            disabled={isLoading}
            fullWidth
            size="lg"
          >
            {isLoading ? 'Procesando...' : (isRegistering ? 'Registrar y Entrar' : 'Iniciar Sesión')}
          </AppButton>
        </form>

        <div className="mt-6 text-center space-y-4">
            <button 
                onClick={() => { setIsRegistering(!isRegistering); setNombre(''); setEmail(''); setPassword(''); }}
                className="text-sm text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 font-medium block w-full transition-colors"
            >
                {isRegistering 
                    ? '¿Ya tienes cuenta? Iniciar Sesión' 
                    : '¿Primera vez? Crear cuenta Admin'}
            </button>
            
            <button 
                onClick={handleResetConfig}
                className="text-xs text-gray-400 hover:text-red-500 transition-colors"
            >
                Restablecer conexión a base de datos
            </button>
        </div>
      </div>
    </div>
  );
};

export default LoginView;
