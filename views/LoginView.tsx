
import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, getDocs, limit, query, doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { useNotification } from '../context/NotificationContext';
import { Rol, TipoVendedor, Usuario } from '../types';

const LoginView: React.FC = () => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { showNotification } = useNotification();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (isRegistering) {
        // 1. Verificar si ya existen usuarios (Solo permitimos registro público al primer usuario/admin)
        const usersRef = collection(db, 'usuarios');
        const q = query(usersRef, limit(1));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            showNotification('El sistema ya está inicializado. Solo el Administrador puede crear nuevas cuentas.', 'error');
            setIsLoading(false);
            return;
        }

        // 2. Crear usuario en Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 3. Crear documento de usuario en Firestore (Como Administrador)
        const newUser: Usuario = {
            id: user.uid,
            nombre: nombre,
            email: email,
            rol: Rol.ADMINISTRADOR,
            tipo: TipoVendedor.INTERNO
        };

        await setDoc(doc(db, 'usuarios', user.uid), newUser);
        showNotification('¡Bienvenido! Sistema inicializado correctamente.', 'success');

      } else {
        // Login Normal
        await signInWithEmailAndPassword(auth, email, password);
      }
      // AuthContext manejará la redirección al detectar el cambio de estado
    } catch (error: any) {
      console.error(error);
      let msg = isRegistering ? 'Error al registrarse' : 'Error al iniciar sesión';
      
      if (error.code === 'auth/invalid-credential') msg = 'Credenciales incorrectas';
      if (error.code === 'auth/email-already-in-use') msg = 'Este email ya está registrado';
      if (error.code === 'auth/weak-password') msg = 'La contraseña debe tener al menos 6 caracteres';
      if (error.code === 'auth/too-many-requests') msg = 'Demasiados intentos. Intente más tarde.';
      
      showNotification(msg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary-600 dark:text-primary-400">Aguas Puras</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            {isRegistering ? 'Configuración Inicial' : 'Sistema de Gestión v2.5'}
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
                placeholder="Ej: Admin Principal"
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
            {isLoading ? 'Procesando...' : (isRegistering ? 'Crear Cuenta Administrador' : 'Iniciar Sesión')}
          </button>
        </form>

        <div className="mt-6 text-center">
            <button 
                onClick={() => { setIsRegistering(!isRegistering); setNombre(''); setEmail(''); setPassword(''); }}
                className="text-sm text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 font-medium"
            >
                {isRegistering 
                    ? '¿Ya tienes cuenta? Iniciar Sesión' 
                    : '¿Primera vez? Crear cuenta Admin'}
            </button>
        </div>
      </div>
    </div>
  );
};

export default LoginView;
