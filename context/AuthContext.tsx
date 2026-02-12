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
            // 1. Intentar buscar perfil por UID (Usuario ya vinculado)
            const userDocRef = doc(db, 'usuarios', firebaseUser.uid);
            const userDoc = await userDocRef.get(); // Usando sintaxis compatible con esm.sh version
            // Nota: Dependiendo de la versión de firebase inyectada, puede ser getDoc(userDocRef)
            // pero para asegurar compatibilidad en este entorno usamos un wrapper seguro:
            
            let profileData: any = null;
            const snapshot = await getDoc(userDocRef);
            
            if (snapshot.exists()) {
                profileData = { id: firebaseUser.uid, ...snapshot.data() };
            } else {
                // 2. Si no existe por UID, buscar por EMAIL (Usuario invitado por Admin)
                const usersRef = collection(db, 'usuarios');
                const q = query(usersRef, where('email', '==', firebaseUser.email), limit(1));
                const querySnapshot = await getDocs(q);

                if (!querySnapshot.empty) {
                    const foundDoc = querySnapshot.docs[0];
                    const invitedData = foundDoc.data();
                    
                    // VINCULAR: Crear nuevo doc con UID y borrar el viejo con ID aleatorio
                    const newProfile: Usuario = {
                        ...invitedData as Usuario,
                        id: firebaseUser.uid,
                        email: firebaseUser.email || invitedData.email
                    };
                    
                    await setDoc(doc(db, 'usuarios', firebaseUser.uid), newProfile);
                    await deleteDoc(foundDoc.ref);
                    
                    profileData = newProfile;
                    console.log("Perfil vinculado con éxito por email.");
                } else {
                    // 3. Si no existe perfil ni por UID ni por EMAIL, verificar si es el PRIMER usuario de la historia
                    const allUsersQuery = query(collection(db, 'usuarios'), limit(1));
                    const allUsersSnap = await getDocs(allUsersQuery);
                    
                    if (allUsersSnap.empty) {
                        // Es el primer usuario: Convertir en Admin automáticamente
                        const firstAdmin: Usuario = {
                            id: firebaseUser.uid,
                            nombre: firebaseUser.displayName || 'Administrador Inicial',
                            email: firebaseUser.email || '',
                            rol: Rol.ADMINISTRADOR,
                            tipo: TipoVendedor.INTERNO
                        };
                        await setDoc(doc(db, 'usuarios', firebaseUser.uid), firstAdmin);
                        profileData = firstAdmin;
                        console.log("Primer administrador creado.");
                    } else {
                        // Usuario registrado pero no invitado ni admin
                        profileData = null;
                        console.warn("Usuario logueado pero sin perfil asignado.");
                    }
                }
            }
            
            setUser(profileData);
        } catch (error) {
            console.error("Error en AuthContext:", error);
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