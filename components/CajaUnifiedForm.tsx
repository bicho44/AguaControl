
import React, { useState, useMemo } from 'react';
import { Usuario, Cliente, Producto, MetodoPago, PagoDetalle, Remito, RegistroPago, CausaRecambio, Gasto } from '../types';
import RemitoForm from './RemitoForm';
import AppButton from './ui/AppButton';
import AppInput from './ui/AppInput';
import AppSelect from './ui/AppSelect';
import { ShoppingCartIcon, ArrowDownCircleIcon, PlusIcon } from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import MarkdownEditor from './ui/MarkdownEditor';

interface CajaUnifiedFormProps {
    clientes: Cliente[];
    vendedores: Usuario[];
    productos: Producto[];
    currentUser: Usuario;
    remitos: Remito[];
    registrosPago: RegistroPago[];
    causasRecambio: CausaRecambio[];
    onSaveRemito: (remito: any) => Promise<void>;
    onSaveGasto: (gasto: any) => Promise<void>;
    onAddCliente: (cliente: any) => Promise<string>;
    onClose: () => void;
    initialType?: 'VENTA' | 'GASTO';
}

const CajaUnifiedForm: React.FC<CajaUnifiedFormProps> = ({
    clientes, vendedores, productos, currentUser, remitos, registrosPago, causasRecambio,
    onSaveRemito, onSaveGasto, onAddCliente, onClose, initialType = 'VENTA'
}) => {
    const [mode, setMode] = useState<'VENTA' | 'GASTO'>(initialType === 'GASTO' ? 'GASTO' : 'VENTA');
    
    // Estado para Loop de Ventas
    const [remitoInstanceId, setRemitoInstanceId] = useState(0);
    const [remitoData, setRemitoData] = useState({
        fecha: new Date().toISOString().split('T')[0],
        puntoVenta: '999',
        numero: '',
        vendedorId: currentUser.id,
        esVentaMostrador: true,
        movimientos: [{ productoId: '', entregados: 0, recibidos: 0 }],
        pagos: []
    });

    const handleSaveLoopRemito = async (data: any) => {
        await onSaveRemito(data, true); // preventClose = true
        setRemitoData(prev => ({
            ...prev,
            fecha: data.fecha, // Conserve the date
            puntoVenta: data.puntoVenta,
            numero: '',
            vendedorId: data.vendedorId
        }));
        setRemitoInstanceId(prev => prev + 1);
    };
    const [gastoData, setGastoData] = useState({
        fecha: new Date().toISOString().split('T')[0],
        concepto: '',
        monto: 0,
        metodo: MetodoPago.EFECTIVO,
        vendedorId: '',
        observaciones: ''
    });

    const handleSaveGasto = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await onSaveGasto({
                fecha: gastoData.fecha,
                concepto: gastoData.concepto,
                pagos: [{ monto: gastoData.monto, metodo: gastoData.metodo }],
                vendedorId: gastoData.vendedorId || undefined,
                observaciones: gastoData.observaciones
            });
            onClose();
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="flex flex-col h-full gap-4">
            {/* TABS DE MODO */}
            <div className="flex items-center justify-center p-1 bg-gray-100 dark:bg-gray-800 rounded-2xl w-fit mx-auto shadow-inner border border-gray-200 dark:border-gray-700">
                <button
                    onClick={() => setMode('VENTA')}
                    className={`flex items-center gap-2 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                        mode === 'VENTA' 
                        ? 'bg-white dark:bg-gray-700 text-primary-600 shadow-sm' 
                        : 'text-gray-400 hover:text-gray-600'
                    }`}
                >
                    <ShoppingCartIcon className="w-3.5 h-3.5" />
                    Venta / Cobro
                </button>
                <button
                    onClick={() => setMode('GASTO')}
                    className={`flex items-center gap-2 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                        mode === 'GASTO' 
                        ? 'bg-white dark:bg-gray-700 text-red-600 shadow-sm' 
                        : 'text-gray-400 hover:text-gray-600'
                    }`}
                >
                    <ArrowDownCircleIcon className="w-3.5 h-3.5" />
                    Gasto
                </button>
            </div>

            {mode === 'VENTA' ? (
                <div className="flex-1">
                    <RemitoForm 
                        key={`remito-loop-${remitoInstanceId}`}
                        remito={remitoData}
                        clientes={clientes}
                        vendedores={vendedores}
                        productos={productos}
                        currentUser={currentUser}
                        remitos={remitos}
                        registrosPago={registrosPago}
                        causasRecambio={causasRecambio}
                        onSave={handleSaveLoopRemito}
                        onAddCliente={onAddCliente}
                        onClose={onClose}
                    />
                </div>
            ) : (
                <form onSubmit={handleSaveGasto} className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <AppInput 
                            label="Fecha" 
                            type="date" 
                            value={gastoData.fecha} 
                            onChange={e => setGastoData({...gastoData, fecha: e.target.value})} 
                            required 
                        />
                        <AppInput 
                            label="Concepto" 
                            placeholder="Ej: Materiales, Viáticos..." 
                            value={gastoData.concepto} 
                            onChange={e => setGastoData({...gastoData, concepto: e.target.value})} 
                            required 
                        />
                        <AppInput 
                            label="Monto" 
                            type="number" 
                            value={gastoData.monto} 
                            onChange={e => setGastoData({...gastoData, monto: Number(e.target.value)})} 
                            required 
                        />
                        <AppSelect 
                            label="Método de Pago" 
                            value={gastoData.metodo} 
                            onChange={e => setGastoData({...gastoData, metodo: e.target.value as MetodoPago})} 
                            options={Object.values(MetodoPago).map(m => ({value: m, label: m}))} 
                        />
                        <div className="md:col-span-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1 block">Asignar a Usuario (Opcional)</label>
                            <SearchableSelect 
                                placeholder="Seleccionar Usuario"
                                options={vendedores.map(v => ({value: v.id, label: v.nombre}))}
                                value={gastoData.vendedorId}
                                onChange={v => setGastoData({...gastoData, vendedorId: v})}
                            />
                            <p className="text-[9px] text-gray-400 mt-1 ml-1">Si se asigna a un usuario, afectará su cuenta corriente.</p>
                        </div>
                    </div>

                    <div className="px-1 border-t dark:border-gray-700 pt-4">
                        <MarkdownEditor 
                            value={gastoData.observaciones} 
                            onChange={val => setGastoData({...gastoData, observaciones: val})}
                            placeholder="Ej: Detalles del gasto, motivo, etc..."
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-6 border-t dark:border-gray-700">
                        <AppButton variant="secondary" onClick={onClose} type="button">Cancelar</AppButton>
                        <AppButton variant="primary" type="submit">Registrar Gasto</AppButton>
                    </div>
                </form>
            )}
        </div>
    );
};

export default CajaUnifiedForm;
