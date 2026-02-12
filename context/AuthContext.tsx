import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from '../firebase/config';
import { doc, getDoc, setDoc, collection, query, where, getDocs, limit, deleteDoc } from 'firebase/firestore';
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
      setLoading(true);
      if (firebaseUser) {
        try {
            // normalizar email para búsquedas
            const userEmail = firebaseUser.email?.toLowerCase().trim() || "";
            
            // 1. Intentar buscar perfil por UID (Usuario ya vinculado correctamente)
            const userDocRef = doc(db, 'usuarios', firebaseUser.uid);
            const snapshot = await getDoc(userDocRef);
            
            let profileData: any = null;
            
            if (snapshot.exists()) {
                profileData = { id: firebaseUser.uid, ...snapshot.data() };
            } else {
                // 2. Si no existe por UID, buscar por EMAIL (Usuario invitado por Admin)
                // Usamos la colección usuarios buscando coincidencias de email
                const usersRef = collection(db, 'usuarios');
                const q = query(usersRef, where('email', '==', userEmail), limit(1));
                const querySnapshot = await getDocs(q);

                if (!querySnapshot.empty) {
                    const foundDoc = querySnapshot.docs[0];
                    const invitedData = foundDoc.data();
                    
                    // VINCULAR: Crear nuevo doc con UID (ID definitivo) y borrar el temporal
                    const newProfile: Usuario = {
                        ...invitedData as Usuario,
                        id: firebaseUser.uid,
                        email: userEmail // Asegurar email normalizado
                    };
                    
                    await setDoc(doc(db, 'usuarios', firebaseUser.uid), newProfile);
                    
                    // Si el ID del documento encontrado no es el UID, borrar el viejo
                    if (foundDoc.id !== firebaseUser.uid) {
                        await deleteDoc(foundDoc.ref);
                    }
                    
                    profileData = newProfile;
                    console.log("Perfil vinculado con éxito por email.");
                } else {
                    // 3. Verificar si es el PRIMER usuario absoluto del sistema
                    // Si no hay perfiles por UID ni por Email, y la tabla está vacía -> Auto-Admin
                    const allUsersQuery = query(collection(db, 'usuarios'), limit(1));
                    const allUsersSnap = await getDocs(allUsersQuery);
                    
                    if (allUsersSnap.empty) {
                        const firstAdmin: Usuario = {
                            id: firebaseUser.uid,
                            nombre: firebaseUser.displayName || 'Administrador Inicial',
                            email: userEmail,
                            rol: Rol.ADMINISTRADOR,
                            tipo: TipoVendedor.INTERNO
                        };
                        await setDoc(doc(db, 'usuarios', firebaseUser.uid), firstAdmin);
                        profileData = firstAdmin;
                        console.log("Primer administrador creado.");
                    } else {
                        // Usuario registrado que no coincide con invitaciones previas
                        profileData = null;
                        console.warn("Acceso denegado: No existe perfil para este email.");
                    }
                }
            }
            
            setUser(profileData);
        } catch (error) {
            console.error("Error crítico en AuthContext:", error);
            setUser(null);
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