
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
        // Buscar datos extendidos del usuario en Firestore (Roles, Tipo)
        // Asumimos que existe una colección 'usuarios' con el ID del UID de Auth
        try {
            const userDocRef = doc(db, 'usuarios', firebaseUser.uid);
            const userDoc = await getDoc(userDocRef);
            
            if (userDoc.exists()) {
                setUser({ id: firebaseUser.uid, email: firebaseUser.email || '', ...userDoc.data() } as Usuario);
            } else {
                // Fallback temporal si el usuario no está en base de datos pero sí en Auth
                // (útil para el primer admin)
                setUser({
                    id: firebaseUser.uid,
                    email: firebaseUser.email || '',
                    nombre: firebaseUser.displayName || 'Usuario',
                    rol: Rol.ADMINISTRADOR, // Default temp
                    tipo: TipoVendedor.INTERNO
                });
            }
        } catch (error) {
            console.error("Error fetching user data:", error);
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
