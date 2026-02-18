
export type View =
  | 'dashboard'
  | 'caja'
  | 'cuentacorriente'
  | 'facturas'
  | 'remitos'
  | 'clientes'
  | 'usuarios'
  | 'productos'
  | 'importar'
  | 'settings'
  | 'contratos'
  | 'servicios'
  | 'planillas'
  | 'rutas'
  | 'logs'; // Nueva vista

export enum Rol {
  ADMINISTRADOR = 'Administrador',
  REPARTIDOR = 'Repartidor',
}

export enum TipoVendedor {
  INTERNO = 'Interno',
  EXTERNO = 'Externo',
}

export interface ComisionProducto {
    productoId: string;
    monto: number;
}

export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  password?: string;
  rol: Rol;
  tipo: TipoVendedor;
  preciosEspeciales?: PrecioEspecial[];
  comisiones?: ComisionProducto[]; // Nuevo: Array de comisiones por producto
}

export enum TipoTelefono {
    LOCAL = 'Local',
    CEL = 'Celular',
    WHATSAPP = 'WhatsApp',
}

export interface Telefono {
    tipo: TipoTelefono;
    numero: string;
}

export enum TipoFacturacion {
    RESPONSABLE_INSCRIPTO = 'Responsable Inscripto',
    CONSUMIDOR_FINAL = 'Consumidor Final',
    MONOTRIBUTO = 'Monotributo',
    EXENTO = 'Exento',
}

export enum CondicionIVA {
    RESPONSABLE_INSCRIPTO = 'Responsable Inscripto',
    MONOTRIBUTISTA = 'Monotributista',
    EXENTO = 'Exento',
    CONSUMIDOR_FINAL = 'Consumidor Final',
}

export enum DiaSemana {
    LUNES = 'Lunes',
    MARTES = 'Martes',
    MIERCOLES = 'Miércoles',
    JUEVES = 'Jueves',
    VIERNES = 'Viernes',
    SABADO = 'Sábado',
    DOMINGO = 'Domingo',
}

export interface Sucursal {
    id: string;
    nombre: string;
    direccion: string;
    lat?: number;
    lng?: number;
    diasReparto?: DiaSemana[]; // Mantenemos por compatibilidad
    repartidoresPorDia?: Record<string, string>; // Nuevo: { 'Lunes': 'id_juan', 'Jueves': 'id_pedro' }
    observaciones?: string;
}

export interface PrecioEspecial {
    productoId: string;
    precio: number;
}

export enum EstadoCliente {
    ACTIVO = 'Activo',
    INACTIVO = 'Inactivo',
}

export interface Cliente {
  id: string;
  nombre: string;
  nombreFiscal?: string; // Nuevo campo para facturación
  estado: EstadoCliente;
  sucursales: Sucursal[];
  cuit?: string;
  tipoFacturacion?: TipoFacturacion;
  telefonos?: Telefono[];
  emails?: string[];
  web?: string;
  tieneCuentaCorriente?: boolean;
  preciosEspeciales?: PrecioEspecial[];
  stockInicial?: any[]; // Helper para importación
  contratosIniciales?: any[]; // Helper para importación
}

export enum TipoProducto {
    RETORNABLE = 'Retornable',
    DESCARTABLE = 'Descartable',
    EQUIPO = 'Equipo',
    OTRO = 'Otro',
}

export enum EstadoProducto {
    ACTIVO = 'Activo',
    INACTIVO = 'Inactivo',
}

export interface Producto {
    id: string;
    nombre: string;
    tipo: TipoProducto;
    estado: EstadoProducto;
    litros: number;
    precio: number;
    precioReventa?: number;
    color?: string;
}

export interface Movimiento {
    productoId: string;
    entregados: number;
    recibidos: number;
}

export interface Remito {
  id: string;
  fecha: string;
  clienteId: string;
  sucursalId?: string;
  vendedorId: string;
  puntoVenta: string;
  numero: string;
  movimientos: Movimiento[];
  pagoIds?: string[];
  facturaId?: string;
  esAjuste?: boolean; // Nuevo campo para stock inicial histórico
}

export enum MetodoPago {
    EFECTIVO = 'Efectivo',
    TRANSFERENCIA = 'Transferencia',
    MERCADO_PAGO = 'Mercado Pago',
    CHEQUE = 'Cheque',
    DEBITO = 'Débito',
    CREDITO = 'Crédito',
}

export interface PagoDetalle {
    monto: number;
    metodo: MetodoPago;
}

export interface RegistroPago {
    id: string;
    fecha: string;
    monto: number;
    metodo: MetodoPago;
    origen: {
        tipo: 'remito' | 'factura' | 'pago_manual' | 'venta_vendedor';
        id: string;
    };
    clienteId?: string;
    vendedorId?: string;
    concepto?: string;
}

export enum EstadoFactura {
    PENDIENTE = 'Pendiente',
    PAGADO_PARCIAL = 'Pagado Parcial',
    PAGADO = 'Pagado',
    ANULADO = 'Anulado',
}

export interface Factura {
    id: string;
    fecha: string;
    clienteId: string;
    numero: string;
    monto: number;
    remitosIds: string[];
    pagoIds?: string[];
    estado: EstadoFactura;
    enviada?: boolean;
}

export interface MovimientoVenta {
    productoId: string;
    cantidad: number;
    recibidos?: number;
    precioUnitario?: number;
}

export interface VentaVendedor {
    id: string;
    fecha: string;
    vendedorId: string;
    clienteId?: string;
    movimientos: MovimientoVenta[];
    pagoIds?: string[];
}

export interface Gasto {
    id: string;
    fecha: string;
    pagos: PagoDetalle[];
    concepto: string;
    nroRecibo?: string;
}

export interface EmailTemplate {
    asunto: string;
    cuerpo: string;
}

export interface EmpresaSettings {
    nombre: string;
    nombreFantasia?: string;
    direccion?: string;
    lat?: number;
    lng?: number;
    telefonos?: Telefono[];
    emails?: string[];
    cuit?: string;
    condicionIVA?: CondicionIVA;
    iibb?: string;
    fechaInicioActividad?: string;
    logo?: string;
    cbu?: string;
    alias?: string;
    banco?: string;
    observacionesFactura?: string;
    emailTemplate?: EmailTemplate;
}

export enum TipoServicio {
    COMODATO = 'Comodato',
    ABONO_FIJO = 'Abono Fijo',
    ALQUILER_PURO = 'Alquiler Puro',
    SOLO_CONSUMO = 'Solo Consumo',
}

export enum EstadoServicio {
    ACTIVO = 'Activo',
    INACTIVO = 'Inactivo',
}

export interface Servicio {
    id: string;
    nombre: string;
    tipo: TipoServicio;
    estado: EstadoServicio;
    descripcion?: string;
    productoId?: string; 
    montoMensual?: number;
    productoConsumoId?: string; 
    consumoIncluido?: number;
}

export enum EstadoContrato {
    ACTIVO = 'Activo',
    FINALIZADO = 'Finalizado',
}

export interface Contrato {
    id: string;
    servicioId: string;
    clienteId: string;
    sucursalId?: string;
    tipo: TipoServicio;
    fechaInicio: string;
    fechaFin?: string;
    productoId?: string; 
    numeroSerie?: string;
    estado: EstadoContrato;
    montoMensual?: number;
    productoConsumoId?: string; 
    consumoIncluido?: number;
    condicionesEspeciales?: string;
}

export enum EstadoPlanilla {
    ABIERTA = 'Abierta',
    CERRADA = 'Cerrada',
}

export interface ItemStock {
    productoId: string;
    cantidad: number;
}

export interface ItemDevolucion {
    productoId: string;
    cantidadLlenos: number;
    cantidadVacios: number;
}

export interface PlanillaDiaria {
    id: string;
    fecha: string;
    repartidorId: string;
    estado: EstadoPlanilla;
    cargaInicial: ItemStock[];
    recargas?: { 
        hora: string; 
        items: ItemStock[];
        vaciosDescargados?: ItemStock[];
    }[];
    devolucion?: ItemDevolucion[];
    observaciones?: string;
}

// --- LOGGING ---
export enum LogLevel {
    INFO = 'Info',
    ERROR = 'Error',
    WARNING = 'Warning'
}

export interface LogEntry {
    id: string;
    timestamp: number; // Date.now()
    level: LogLevel;
    message: string;
    details?: string;
    userId?: string;
    userEmail?: string;
    route?: string;
    version?: string;
}
