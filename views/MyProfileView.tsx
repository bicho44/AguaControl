
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { db, auth as firebaseAuth } from '../firebase/config';
import { doc, updateDoc } from 'firebase/firestore';
import { updatePassword, updateProfile } from 'firebase/auth';
import { LogLevel } from '../types';
import { useDataStore } from '../hooks/useDataStore';

const MyProfileView: React.FC = () => {
    const { user } = useAuth();
    const { showNotification } = useNotification();
    const { addLog } = useDataStore();
    
    const [nombre, setNombre] = useState(user?.nombre || '');
    const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setLoading(true);

        try {
            // 1. Actualizar en Firestore
            const userRef = doc(db, 'usuarios', user.id);
            await updateDoc(userRef, {
                nombre: nombre,
                avatarUrl: avatarUrl
            });

            // 2. Intentar actualizar en Firebase Auth (para el displayName)
            if (firebaseAuth.currentUser) {
                await updateProfile(firebaseAuth.currentUser, {
                    displayName: nombre,
                    photoURL: avatarUrl
                });
            }

            showNotification('Perfil actualizado con éxito. Refresca la página si no ves los cambios.', 'success');
            addLog({
                level: LogLevel.INFO,
                message: 'Usuario actualizó su perfil',
                userId: user.id,
                userEmail: user.email
            });
        } catch (error: any) {
            console.error(error);
            showNotification('Error al actualizar perfil: ' + error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            showNotification('Las contraseñas no coinciden', 'error');
            return;
        }
        if (newPassword.length < 6) {
            showNotification('La contraseña debe tener al menos 6 caracteres', 'error');
            return;
        }

        setLoading(true);
        try {
            if (firebaseAuth.currentUser) {
                await updatePassword(firebaseAuth.currentUser, newPassword);
                showNotification('Contraseña actualizada con éxito', 'success');
                setNewPassword('');
                setConfirmPassword('');
            }
        } catch (error: any) {
            console.error(error);
            if (error.code === 'auth/requires-recent-login') {
                showNotification('Para cambiar la contraseña debes haber iniciado sesión recientemente. Por favor, cierra sesión y vuelve a entrar.', 'error');
            } else {
                showNotification('Error al cambiar contraseña: ' + error.message, 'error');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result as string;
            setAvatarUrl(base64String);
        };
        reader.readAsDataURL(file);
    };

    return (
        <div className="max-w-4xl mx-auto p-4 animate-fade-in">
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Mi Perfil</h1>
                <p className="text-gray-500 dark:text-gray-400">Gestiona tu información personal y seguridad</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Columna izquierda: Avatar */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center">
                    <div className="relative mb-4 group">
                        <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700 border-4 border-primary-50 dark:border-primary-900/30">
                            {avatarUrl ? (
                                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-primary-600 dark:text-primary-400">
                                    {nombre.charAt(0).toUpperCase()}
                                </div>
                            )}
                        </div>
                        <label className="absolute bottom-0 right-0 p-2 bg-primary-600 rounded-full text-white cursor-pointer hover:bg-primary-700 transition-colors shadow-lg">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
                        </label>
                    </div>
                    <div className="text-center">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">{nombre || 'Usuario'}</h2>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-400">
                            {user?.rol}
                        </span>
                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{user?.email}</p>
                    </div>
                </div>

                {/* Columna derecha: Formularios */}
                <div className="md:col-span-2 space-y-6">
                    {/* Datos Personales */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Datos Personales</h3>
                        <form onSubmit={handleUpdateProfile} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre Completo</label>
                                <input
                                    type="text"
                                    value={nombre}
                                    onChange={(e) => setNombre(e.target.value)}
                                    className="w-full px-4 py-2 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-primary-500 outline-none transition-all dark:text-white"
                                    placeholder="Tu nombre"
                                    required
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-6 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50 font-medium"
                            >
                                {loading ? 'Guardando...' : 'Guardar Cambios'}
                            </button>
                        </form>
                    </div>

                    {/* Seguridad */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Seguridad</h3>
                        <form onSubmit={handleChangePassword} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nueva Contraseña</label>
                                    <input
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        className="w-full px-4 py-2 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-primary-500 outline-none transition-all dark:text-white"
                                        placeholder="••••••••"
                                        minLength={6}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confirmar Contraseña</label>
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="w-full px-4 py-2 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-primary-500 outline-none transition-all dark:text-white"
                                        placeholder="••••••••"
                                        minLength={6}
                                    />
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={loading || !newPassword}
                                className="px-6 py-2 bg-gray-900 dark:bg-white dark:text-gray-900 text-white rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors disabled:opacity-50 font-medium"
                            >
                                {loading ? 'Actualizando...' : 'Cambiar Contraseña'}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MyProfileView;
