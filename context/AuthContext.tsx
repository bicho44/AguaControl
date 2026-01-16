
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from '../firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import { Usuario, Rol, TipoVendedor } from '../types';

interface AuthContextType {
  user: Usuario | null;
  loading: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
            // Intentamos leer datos extendidos (Rol, etc)
            const userDocRef = doc(db, 'usuarios', firebaseUser.uid);
            const userDoc = await getDoc(userDocRef);
            
            if (userDoc.exists()) {
                setUser({ id: firebaseUser.uid, email: firebaseUser.email || '', ...userDoc.data() } as Usuario);
            } else {
                // Si el documento no existe (recién registrado), usamos datos básicos
                // Esto permite entrar aunque la DB falle momentáneamente
                console.warn("Usuario autenticado pero sin perfil en base de datos.");
                setUser({
                    id: firebaseUser.uid,
                    email: firebaseUser.email || '',
                    nombre: firebaseUser.displayName || 'Admin (Sin Perfil)',
                    rol: Rol.ADMINISTRADOR, // Asumimos Admin temporalmente para permitir configuración
                    tipo: TipoVendedor.INTERNO
                });
            }
        } catch (error) {
            console.error("Error leyendo base de datos, usando perfil básico:", error);
            // FALLBACK CRÍTICO: Si falla Firestore (permisos, reglas), logueamos igual
            setUser({
                id: firebaseUser.uid,
                email: firebaseUser.email || '',
                nombre: 'Modo Recuperación',
                rol: Rol.ADMINISTRADOR,
                tipo: TipoVendedor.INTERNO
            });
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
