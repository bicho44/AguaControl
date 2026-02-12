import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase/config';
import { useNotification } from '../context/NotificationContext';

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
        // El AuthContext se encargará de vincular este nuevo usuario 
        // con el perfil creado por el administrador (o crear el primer admin)
        await createUserWithEmailAndPassword(auth, email, password);
        showNotification('Cuenta creada. Verificando perfil...', 'success');
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error: any) {
      console.error("Error de autenticación:", error);
      let msg = 'Error desconocido';
      
      if (error.code === 'auth/invalid-credential') msg = 'Email o contraseña incorrectos.';
      if (error.code === 'auth/email-already-in-use') msg = 'Este email ya está registrado.';
      if (error.code === 'auth/weak-password') msg = 'La contraseña debe tener al menos 6 caracteres.';
      if (error.code === 'auth/operation-not-allowed') msg = 'Error: Debes habilitar "Email/Password" en Firebase Auth.';
      
      showNotification(msg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary-600 dark:text-primary-400">Aguas Puras</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            {isRegistering ? 'Crear mi Cuenta' : 'Iniciar Sesión'}
          </p>
        </div>
        
        <form onSubmit={handleAuth} className="space-y-6">
          {isRegistering && (
            <div className="animate-fade-in-down">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre Completo</label>
                <input 
                type="text" 
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 dark:text-white"
                required={isRegistering}
                placeholder="Ej: Juan Repartidor"
                />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 dark:text-white"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contraseña</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 dark:text-white"
              required
            />
          </div>
          
          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full py-3 px-4 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-md shadow transition duration-200 disabled:opacity-50"
          >
            {isLoading ? 'Procesando...' : (isRegistering ? 'Registrarse' : 'Entrar')}
          </button>
        </form>

        <div className="mt-6 text-center space-y-4">
            <button 
                onClick={() => { setIsRegistering(!isRegistering); setNombre(''); setEmail(''); setPassword(''); }}
                className="text-sm text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 font-medium block w-full"
            >
                {isRegistering 
                    ? '¿Ya tienes cuenta? Iniciar Sesión' 
                    : '¿No tienes cuenta? Regístrate aquí'}
            </button>
            
            <button 
                onClick={handleResetConfig}
                className="text-xs text-gray-400 hover:text-red-500 underline"
            >
                Configuración de base de datos
            </button>
        </div>
      </div>
      
      <div className="mt-8 max-w-md text-xs text-gray-500 dark:text-gray-400 text-center">
        <p>Si un administrador ya creó tu perfil, regístrate con el mismo email para acceder.</p>
      </div>
    </div>
  );
};

export default LoginView;