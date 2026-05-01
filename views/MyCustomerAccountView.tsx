
import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useDataStore } from '../hooks/useDataStore';
import { AccountStatement } from '../components/AccountStatement';
import { AlertCircle } from 'lucide-react';

const MyCustomerAccountView: React.FC = () => {
    const { user } = useAuth();
    const { clientes, facturas, remitos, productos, registrosPago } = useDataStore();

    const clienteId = user?.clienteId;
    const cliente = clientes.find(c => c.id === clienteId);

    if (!clienteId || !cliente) {
        return (
            <div className="flex flex-col items-center justify-center h-96 text-center p-6 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
                <div className="text-4xl mb-4">⚠️</div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white tracking-widest uppercase">Cuenta no vinculada</h2>
                <p className="text-gray-500 dark:text-gray-400 mt-2">Su usuario no está vinculado a ninguna cuenta de cliente. Por favor, contacte con administración.</p>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-4 animate-fade-in pb-20">
            <AccountStatement 
                cliente={cliente}
                facturas={facturas}
                remitos={remitos}
                productos={productos}
                registrosPago={registrosPago}
            />

            <footer className="mt-12 p-6 bg-blue-50 dark:bg-blue-900/10 rounded-3xl border border-blue-100 dark:border-blue-800/50">
                <div className="flex items-start gap-4">
                    <div className="bg-blue-500 text-white p-2 rounded-xl">
                        <AlertCircle className="w-5 h-5" />
                    </div>
                    <div>
                        <h4 className="font-bold text-blue-900 dark:text-blue-100 text-sm">¿Dudas con tu saldo?</h4>
                        <p className="text-blue-700 dark:text-blue-300 text-xs mt-1 leading-relaxed">
                            El saldo mostrado contempla todas las facturas impagas y los remitos pendientes de facturación. Si realizaste un pago y no figura en la lista, por favor contactanos enviando el comprobante.
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default MyCustomerAccountView;

