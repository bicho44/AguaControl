// views/UsuariosView.tsx

import React, { useState, useMemo } from 'react';
import { Usuario, Remito, Cliente, TipoVendedor, MetodoPago, Producto, PagoDetalle, VentaVendedor, MovimientoVenta, RegistroPago, Rol, EstadoProducto } from '../types';
import Card from '../components/Card';
import Modal from '../components/Modal';
import { PencilIcon } from '../components/icons/PencilIcon';
import { ChevronDownIcon } from '../components/icons/ChevronDownIcon';
import { useNotification } from '../context/NotificationContext';
import { TrashIcon } from '../components/icons/TrashIcon';

interface UsuariosViewProps {
  usuarios: Usuario[];
  registrosPago: RegistroPago[];
  remitos: Remito[];
  clientes: Cliente[];
  productos: Producto[];
  ventasVendedor: VentaVendedor[];
  addUsuario: (usuario: Omit<Usuario, 'id'>) => void;
  updateUsuario: (usuario: Usuario) => void;
  addVentaVendedor: (venta: Omit<VentaVendedor, 'id' | 'pagoIds'> & { pagos?: PagoDetalle[] }) => void;
}

const UsuarioForm: React.FC<{
  usuario: Partial<Usuario>;
  onSave: (usuario: Omit<Usuario, 'id'> | Usuario) => void;
  onClose: () => void;
}> = ({ usuario, onSave, onClose }) => {
  const [formData, setFormData] = useState(usuario);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData as Usuario);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-white">{usuario.id ? 'Editar' : 'Nuevo'} Usuario</h2>
      <input type="text" name="nombre" placeholder="Nombre" value={formData.nombre || ''} onChange={handleChange} required className="w-full p-2 bg-gray-200 dark:bg-gray-700 rounded-md"/>
      <input type="email" name="email" placeholder="Email" value={formData.email || ''} onChange={handleChange} required className="w-full p-2 bg-gray-200 dark:bg-gray-700 rounded-md"/>
      <input type="password" name="password" placeholder="Contraseña (dejar en blanco para no cambiar)" onChange={handleChange} className="w-full p-2 bg-gray-200 dark:bg-gray-700 rounded-md"/>
      
      <div className="grid grid-cols-2 gap-4">
        <select name="rol" value={formData.rol || ''} onChange={handleChange} required className="w-full p-2 bg-gray-200 dark:bg-gray-700 rounded-md">
            <option value="">Rol</option>
            {Object.values(Rol).map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select name="tipo" value={formData.tipo || ''} onChange={handleChange} required className="w-full p-2 bg-gray-200 dark:bg-gray-700 rounded-md">
            <option value="">Tipo</option>
            <option value={TipoVendedor.INTERNO}>Interno</option>
            <option value={TipoVendedor.EXTERNO}>Externo</option>
        </select>
      </div>
      <div className="flex justify-end space-x-2 pt-4">
        <button type="button" onClick={onClose} className="px-4 py-2 rounded-md bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-200 hover:bg-gray-400 dark:hover:bg-gray-500">Cancelar</button>
        <button type="submit" className="px-4 py-2 rounded-md bg-primary-600 text-white hover:bg-primary-700">Guardar</button>
      </div>
    </form>
  )
}

const VentaVendedorForm: React.FC<{
  usuarios: Usuario[];
  productos: Producto[];
  onSave: (venta: Omit<VentaVendedor, 'id'|'pagoIds'> & { pagos?: PagoDetalle[] }) => void;
  onClose: () => void;
}> = ({ usuarios, productos, onSave, onClose }) => {
    const [formData, setFormData] = useState<Partial<VentaVendedor> & { pagos?: PagoDetalle[] }>({
        fecha: new Date().toISOString().split('T')[0],
        movimientos: [],
        pagos: []
    });

    const vendedoresExternos = useMemo(() => usuarios.filter(v => v.tipo === TipoVendedor.EXTERNO), [usuarios]);
    const productosActivos = useMemo(() => productos.filter(p => p.estado === EstadoProducto.ACTIVO), [productos]);


    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleMovimientoChange = (index: number, field: keyof MovimientoVenta, value: string) => {
        const newMovimientos = [...(formData.movimientos || [])];
        const numValue = value === '' ? 0 : Number(value);
        if (field === 'cantidad') {
            newMovimientos[index] = { ...newMovimientos[index], [field]: numValue };
        } else {
            newMovimientos[index] = { ...newMovimientos[index], [field]: value };
        }
        setFormData(prev => ({ ...prev, movimientos: newMovimientos }));
    }

    const addMovimiento = () => {
        const newMovimiento: MovimientoVenta = { productoId: '', cantidad: 1 };
        setFormData(prev => ({...prev, movimientos: [...(prev.movimientos || []), newMovimiento]}));
    }

    const removeMovimiento = (index: number) => {
        setFormData(prev => ({...prev, movimientos: prev.movimientos?.filter((_, i) => i !== index)}));
    }

    const handlePagoChange = (index: number, field: keyof PagoDetalle, value: string | MetodoPago) => {
        const newPagos = [...(formData.pagos || [])];
        const updatedValue = field === 'monto' ? (value === '' ? 0 : Number(value)) : value;
        newPagos[index] = { ...newPagos[index], [field]: updatedValue };
        setFormData(prev => ({ ...prev, pagos: newPagos }));
    }

    const addPago = () => {
        const newPago: PagoDetalle = { monto: 0, metodo: MetodoPago.EFECTIVO };
        setFormData(prev => ({...prev, pagos: [...(prev.pagos || []), newPago]}));
    }

    const removePago = (index: number) => {
        setFormData(prev => ({...prev, pagos: prev.pagos?.filter((_, i) => i !== index)}));
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData as Omit<VentaVendedor, 'id'|'pagoIds'> & { pagos: PagoDetalle[] });
    };
    
    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Nueva Venta a Vendedor</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input type="date" name="fecha" value={formData.fecha || ''} onChange={handleChange} required className="w-full p-2 bg-gray-200 dark:bg-gray-700 rounded-md"/>
                <select name="vendedorId" value={formData.vendedorId || ''} onChange={handleChange} required className="w-full p-2 bg-gray-200 dark:bg-gray-700 rounded-md">
                    <option value="">Seleccionar Vendedor Externo</option>
                    {vendedoresExternos.map(v => <option key={v.id} value={v.id}>{v.nombre}</option>)}
                </select>
            </div>

            <fieldset className="border-t border-gray-300 dark:border-gray-600 pt-4">
                <legend className="text-lg font-medium text-gray-800 dark:text-white px-2">Productos Comprados</legend>
                <div className="space-y-2 mt-2 max-h-40 overflow-y-auto pr-2">
                    {(formData.movimientos || []).map((mov, index) => (
                        <div key={index} className="grid grid-cols-[2fr,1fr,auto] gap-2 items-center">
                            <select value={mov.productoId} onChange={(e) => handleMovimientoChange(index, 'productoId', e.target.value)} required className="w-full p-2 bg-gray-200 dark:bg-gray-700 rounded-md">
                                <option value="">Seleccionar Producto</option>
                                {productosActivos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                            </select>
                            <input type="number" value={mov.cantidad} onChange={(e) => handleMovimientoChange(index, 'cantidad', e.target.value)} required min="1" className="w-full text-center p-2 bg-gray-200 dark:bg-gray-700 rounded-md"/>
                            <button type="button" onClick={() => removeMovimiento(index)} className="text-red-500 hover:text-red-700 p-2"><TrashIcon className="h-4 w-4" /></button>
                        </div>
                    ))}
                </div>
                <button type="button" onClick={addMovimiento} className="mt-2 px-4 py-2 text-sm font-medium rounded-md border border-primary-500 text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:border-primary-500 dark:hover:bg-primary-500/10">+ Agregar Producto</button>
            </fieldset>

            <fieldset className="border-t border-gray-300 dark:border-gray-600 pt-4">
                <legend className="text-lg font-medium text-gray-800 dark:text-white px-2">Forma de Pago</legend>
                <div className="space-y-2 mt-2 max-h-40 overflow-y-auto pr-2">
                    {(formData.pagos || []).map((pago, index) => (
                        <div key={index} className="grid grid-cols-[1fr,1fr,auto] gap-2 items-center">
                            <input type="number" value={pago.monto || ''} onChange={(e) => handlePagoChange(index, 'monto', e.target.value)} min="0" step="0.01" placeholder="Monto" className="w-full p-2 bg-gray-200 dark:bg-gray-700 rounded-md" />
                            <select value={pago.metodo} onChange={(e) => handlePagoChange(index, 'metodo', e.target.value as MetodoPago)} className="w-full p-2 bg-gray-200 dark:bg-gray-700 rounded-md">
                                {Object.values(MetodoPago).map(metodo => <option key={metodo} value={metodo}>{metodo}</option>)}
                            </select>
                            <button type="button" onClick={() => removePago(index)} className="text-red-500 hover:text-red-700 p-2"><TrashIcon className="h-4 w-4" /></button>
                        </div>
                    ))}
                </div>
                <button type="button" onClick={addPago} className="mt-2 px-4 py-2 text-sm font-medium rounded-md border border-primary-500 text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:border-primary-500 dark:hover:bg-primary-500/10">+ Agregar Pago</button>
            </fieldset>

            <div className="flex justify-end space-x-2 pt-4">
                <button type="button" onClick={onClose} className="px-4 py-2 rounded-md bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-200 hover:bg-gray-400 dark:hover:bg-gray-500">Cancelar</button>
                <button type="submit" className="px-4 py-2 rounded-md bg-primary-600 text-white hover:bg-primary-700">Guardar Venta</button>
            </div>
        </form>
    )
}

const PagosVendedorModal: React.FC<{
    usuario: Usuario;
    pagos: RegistroPago[];
    clientesMap: Map<string, Cliente>;
    onClose: () => void;
}> = ({ usuario, pagos, clientesMap, onClose }) => (
    <Modal isOpen={true} onClose={onClose}>
        <div className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Cobranzas de {usuario.nombre}</h2>
            {/* Omitted for brevity */}
        </div>
    </Modal>
)

const ComprasVendedorModal: React.FC<{
    usuario: Usuario;
    ventas: VentaVendedor[];
    registrosPago: RegistroPago[];
    productosMap: Map<string, Producto>;
    onClose: () => void;
}> = ({ usuario, ventas, registrosPago, productosMap, onClose }) => {
    // Omitted for brevity
    return (
    <Modal isOpen={true} onClose={onClose}>
        <div className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Compras de {usuario.nombre}</h2>
             {/* Omitted for brevity */}
        </div>
    </Modal>
    )
}


const UsuariosView: React.FC<UsuariosViewProps> = ({ usuarios, registrosPago, remitos, clientes, productos, ventasVendedor, addUsuario, updateUsuario, addVentaVendedor }) => {
  const [editingUsuario, setEditingUsuario] = useState<Partial<Usuario> | null>(null);
  const [isVentaModalOpen, setIsVentaModalOpen] = useState(false);
  const [viewingPagosUsuario, setViewingPagosUsuario] = useState<any | null>(null);
  const [viewingComprasUsuario, setViewingComprasUsuario] = useState<any | null>(null);
  const { showNotification } = useNotification();

  const clientesMap = useMemo(() => new Map(clientes.map(c => [c.id, c])), [clientes]);
  const productosMap = useMemo(() => new Map(productos.map(p => [p.id, p])), [productos]);

  const usuarioStats = useMemo(() => {
    return usuarios.map(usuario => {
      if (usuario.tipo === TipoVendedor.INTERNO) {
        const usuarioPagos = registrosPago.filter(p => p.vendedorId === usuario.id)
            .sort((a,b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
        const totalCobrado = usuarioPagos.reduce((sum, p) => sum + p.monto, 0);
        const usuarioRemitos = remitos.filter(r => r.vendedorId === usuario.id);
        const productosEntregados = usuarioRemitos.reduce((sum, r) => sum + r.movimientos.reduce((movSum, mov) => movSum + mov.entregados, 0), 0);
        return { ...usuario, stats: { type: 'interno' as const, productosEntregados, totalCobrado, pagos: usuarioPagos }};
      } else { // EXTERNO
        const misVentas = ventasVendedor.filter(v => v.vendedorId === usuario.id)
            .sort((a,b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
        const productosComprados = misVentas.reduce((sum, venta) => sum + venta.movimientos.reduce((movSum, mov) => movSum + mov.cantidad, 0), 0);
        
        const misVentasIds = misVentas.map(v => v.id);
        const misPagos = registrosPago.filter(p => p.origen.tipo === 'venta_vendedor' && misVentasIds.includes(p.origen.id));
        const totalPagado = misPagos.reduce((sum, p) => sum + p.monto, 0);

        return { ...usuario, stats: { type: 'externo' as const, productosComprados, totalPagado, ventas: misVentas }};
      }
    });
  }, [usuarios, remitos, registrosPago, ventasVendedor]);
  
  const handleSaveUsuario = (usuario: Omit<Usuario, 'id'> | Usuario) => {
    try {
        if ('id' in usuario) {
          updateUsuario(usuario);
          showNotification('Usuario actualizado con éxito.', 'success');
        } else {
          addUsuario(usuario);
          showNotification('Usuario creado con éxito.', 'success');
        }
        setEditingUsuario(null);
    } catch (e) {
        showNotification('Error al guardar el usuario.', 'error');
        console.error(e);
    }
  };

  const handleSaveVenta = (venta: Omit<VentaVendedor, 'id' | 'pagoIds'> & { pagos?: PagoDetalle[] }) => {
    try {
        addVentaVendedor(venta);
        setIsVentaModalOpen(false);
        showNotification('Venta a vendedor registrada con éxito.', 'success');
    } catch (e) {
        showNotification('Error al registrar la venta.', 'error');
        console.error(e);
    }
  };

  return (
    <div className="space-y-6 pt-12 md:pt-0">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Gestión de Usuarios</h1>
        <div className="space-x-2">
            <button onClick={() => setEditingUsuario({ rol: Rol.REPARTIDOR, tipo: TipoVendedor.INTERNO })} className="px-4 py-2 rounded-md bg-green-600 text-white hover:bg-green-700">
                + Usuario
            </button>
            <button onClick={() => setIsVentaModalOpen(true)} className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700">
                + Venta a Externo
            </button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {usuarioStats.map(u => (
          <Card key={u.id}>
            <div className="flex justify-between items-start">
              <h3 className="text-xl font-semibold">{u.nombre}</h3>
               <button onClick={() => setEditingUsuario(u)} className="text-gray-400 hover:text-primary-500">
                    <PencilIcon className="h-5 w-5" />
               </button>
            </div>
            <div className="space-y-3 mt-2">
                <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">{u.rol}</span>
                    <span className="text-gray-500 dark:text-gray-400 font-mono text-xs">{u.email}</span>
                </div>
                 {u.stats.type === 'interno' ? (
                  <>
                    <p>Productos entregados: <span className="font-bold">{u.stats.productosEntregados}</span></p>
                    <p>Total cobrado: <span className="font-bold text-green-500">${u.stats.totalCobrado.toLocaleString()}</span></p>
                    <button onClick={() => setViewingPagosUsuario(u)} className="w-full text-center px-4 py-2 rounded-md bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-sm font-medium">
                        Ver Cobranzas ({u.stats.pagos.length})
                    </button>
                  </>
                ) : (
                  <>
                    <p>Productos comprados: <span className="font-bold">{u.stats.productosComprados}</span></p>
                    <p>Total pagado: <span className="font-bold text-green-500">${u.stats.totalPagado.toLocaleString()}</span></p>
                    <button onClick={() => setViewingComprasUsuario(u)} className="w-full text-center px-4 py-2 rounded-md bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-sm font-medium">
                        Ver Compras ({u.stats.ventas.length})
                    </button>
                  </>
                )}
            </div>
          </Card>
        ))}
      </div>

      {editingUsuario && (
        <Modal isOpen={!!editingUsuario} onClose={() => setEditingUsuario(null)}>
            <UsuarioForm
                usuario={editingUsuario}
                onSave={handleSaveUsuario}
                onClose={() => setEditingUsuario(null)}
            />
        </Modal>
      )}
      
      {isVentaModalOpen && (
          <Modal isOpen={isVentaModalOpen} onClose={() => setIsVentaModalOpen(false)}>
              <VentaVendedorForm
                usuarios={usuarios}
                productos={productos}
                onSave={handleSaveVenta}
                onClose={() => setIsVentaModalOpen(false)}
              />
          </Modal>
      )}

      {viewingPagosUsuario && (
          <PagosVendedorModal
            usuario={viewingPagosUsuario}
            pagos={viewingPagosUsuario.stats.pagos || []}
            clientesMap={clientesMap}
            onClose={() => setViewingPagosUsuario(null)}
          />
      )}

      {viewingComprasUsuario && (
          <ComprasVendedorModal
            usuario={viewingComprasUsuario}
            ventas={viewingComprasUsuario.stats.ventas || []}
            registrosPago={registrosPago}
            productosMap={productosMap}
            onClose={() => setViewingComprasUsuario(null)}
          />
      )}
    </div>
  );
};

export default UsuariosView;