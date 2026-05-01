
export type View = 'dashboard' | 'remitos' | 'clientes' | 'usuarios' | 'productos' | 'servicios' | 'cuentacorriente' | 'facturas' | 'importar' | 'caja' | 'settings' | 'contratos' | 'planillas' | 'rutas' | 'logs' | 'login' | 'setup' | 'stock_planta' | 'my_profile' | 'my_account' | string;

export enum Rol {
    ADMINISTRADOR = 'Administrador',
    REPARTIDOR = 'Repartidor',
    SOPLADOR = 'Soplador',
    CLIENTE = 'Cliente'
}

export enum LogLevel {
    ERROR = 'ERROR',
    WARNING = 'WARNING',
    INFO = 'INFO'
}

export enum TipoVendedor {
    INTERNO = 'Interno',
    EXTERNO = 'Externo'
}

export enum MetodoPago {
    EFECTIVO = 'Efectivo',
    TRANSFERENCIA = 'Transferencia',
    MERCADO_PAGO = 'Mercado Pago',
    CHEQUE = 'Cheque',
    CTA_CTE = 'Cta. Cte.',
    OTRO = 'Otro'
}

export enum TipoProducto {
    RETORNABLE = 'Retornable',
    DESCARTABLE = 'Descartable',
    EQUIPO = 'Equipo',
    OTRO = 'Otro'
}

export enum EstadoProducto {
    ACTIVO = 'Activo',
    INACTIVO = 'Inactivo'
}

export enum TipoFacturacion {
    RESPONSABLE_INSCRIPTO = 'Responsable Inscripto',
    MONOTRIBUTO = 'Monotributo',
    EXENTO = 'Exento',
    CONSUMIDOR_FINAL = 'Consumidor Final'
}

export enum CondicionIVA {
    RESPONSABLE_INSCRIPTO = 'Responsable Inscripto',
    MONOTRIBUTO = 'Monotributo',
    EXENTO = 'Exento',
    CONSUMIDOR_FINAL = 'Consumidor Final'
}

export enum TipoTelefono {
    CEL = 'Celular',
    LOCAL = 'Fijo',
    WHATSAPP = 'WhatsApp'
}

export interface Telefono {
    tipo: TipoTelefono;
    numero: string;
}

export enum EstadoFactura {
    PENDIENTE = 'Pendiente',
    PAGADO = 'Pagado',
    PAGADO_PARCIAL = 'Pagado Parcial',
    ANULADO = 'Anulado'
}

export enum EstadoFacturaProveedor {
    PENDIENTE = 'Pendiente',
    PAGADO = 'Pagado',
    PAGADO_PARCIAL = 'Pagado Parcial',
    ANULADO = 'Anulado'
}

export enum EstadoContrato {
    ACTIVO = 'Activo',
    INACTIVO = 'Inactivo',
    PENDIENTE = 'Pendiente'
}

export enum TipoServicio {
    COMODATO = 'Comodato',
    ABONO_FIJO = 'Abono Fijo',
    ALQUILER_PURO = 'Alquiler Puro',
    SOLO_CONSUMO = 'Solo Consumo'
}

export enum EstadoServicio {
    ACTIVO = 'Activo',
    INACTIVO = 'Inactivo'
}

export enum EstadoCliente {
    ACTIVO = 'Activo',
    INACTIVO = 'Inactivo'
}

export enum DiaSemana {
    LUNES = 'Lunes',
    MARTES = 'Martes',
    MIERCOLES = 'Miércoles',
    JUEVES = 'Jueves',
    VIERNES = 'Viernes',
    SABADO = 'Sábado',
    DOMINGO = 'Domingo'
}

export enum EstadoPlanilla {
    ABIERTA = 'Abierta',
    CERRADA = 'Cerrada'
}

export interface Sucursal {
    id: string;
    nombre: string;
    direccion: string;
    lat?: number;
    lng?: number;
    diasReparto?: DiaSemana[];
    repartidoresPorDia?: Record<string, string | null>; // Map DiaSemana -> UsuarioId
}

export interface PrecioEspecial {
    productoId: string;
    precio: number;
}

export interface Cliente {
    id: string;
    nombre: string;
    estado: EstadoCliente;
    creadoPor?: string; // ID del usuario que creó el cliente (para Vendedores Externos)
    sucursales: Sucursal[];
    cuit?: string;
    tipoFacturacion?: TipoFacturacion;
    nombreFiscal?: string;
    direccionFiscal?: string;
    localidad?: string;
    provincia?: string;
    codPostal?: string;
    telefonos?: Telefono[];
    emails?: string[];
    web?: string;
    tieneCuentaCorriente?: boolean;
    preciosEspeciales?: PrecioEspecial[];
    stockInicial?: any[];
    contratosIniciales?: any[];
}

export interface ComisionProducto {
    productoId: string;
    monto: number;
}

export interface Usuario {
    id: string;
    nombre: string;
    email: string;
    rol: Rol;
    tipo: TipoVendedor;
    comisiones?: ComisionProducto[];
    preciosEspeciales?: PrecioEspecial[];
    avatarUrl?: string;
    clienteId?: string; // Para vincular el usuario con un cliente específico
}

export interface Producto {
    id: string;
    nombre: string;
    abreviatura?: string;
    tipo: TipoProducto;
    estado: EstadoProducto;
    litros?: number;
    precio: number;
    precioReventa?: number;
    color?: string;
    stockPlanta?: number; // Stock de productos llenos en planta
    stockEnvases?: number; // Stock de envases vacíos en planta
}

export interface Movimiento {
    productoId: string;
    entregados: number;
    recibidos: number;
    precioUnitario?: number;
}

export interface Remito {
    id: string;
    fecha: string;
    clienteId?: string;
    sucursalId?: string;
    vendedorId: string;
    puntoVenta: string;
    numero: string;
    esAjuste?: boolean;
    esVentaMostrador?: boolean;
    movimientos: Movimiento[];
    recambios?: Recambio[];
    pagoIds?: string[];
    facturaId?: string;
    observaciones?: string;
}

export interface Recambio {
    productoId: string;
    cantidad: number;
    causaId: string;
}

export interface CausaRecambio {
    id: string;
    nombre: string;
    esPerdidaStock: boolean; // true = se rompió (baja de stock), false = recuperable (vuelve a fábrica)
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
    origen: { tipo: string; id: string };
    clienteId?: string;
    vendedorId?: string;
    concepto?: string;
}

export interface CombinedMovement {
  id: string;
  fecha: string;
  type: 'ingreso' | 'gasto';
  concepto: string;
  pagos: any[];
  total: number;
  original: any;
  ventaId?: string;
  isCtaCtePura?: boolean;
}

export interface Gasto {
    id: string;
    fecha: string;
    pagos: PagoDetalle[];
    concepto: string;
    nroRecibo?: string;
    vendedorId?: string;
    observaciones?: string;
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
    observaciones?: string;
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

export interface Contrato {
    id: string;
    tempId?: string;
    servicioId: string;
    clienteId: string;
    sucursalId?: string;
    tipo: TipoServicio;
    fechaInicio: string;
    productoId?: string;
    numeroSerie?: string;
    estado: EstadoContrato;
    condicionesEspeciales?: string;
    montoMensual?: number;
    productoConsumoId?: string;
    consumoIncluido?: number;
}

export interface ItemStock {
    productoId: string;
    cantidad: number;
}

export interface MovimientoStockPlanta {
    id: string;
    fecha: string;
    productoId: string;
    cantidad: number;
    tipo: 'entrada' | 'salida' | 'ajuste' | 'cierre_fisico';
    concepto: string; // Compra, Producción, Rotura, etc.
    esEnvase?: boolean; // Si es true, afecta stockEnvases, si es false afecta stockPlanta
}

export interface CierrePlanta {
    id: string;
    fecha: string;
    saldos: {
        productoId: string;
        cantidadFisica: number;
        cantidadTeorica: number;
        produccionDia: number;
    }[];
    cerradoPor: string;
}

export interface ItemDevolucion {
    productoId: string;
    cantidadLlenos: number;
    cantidadVacios: number;
}

export interface Recarga {
    hora: string;
    items: ItemStock[];
    vaciosDescargados?: ItemStock[];
}

export interface PlanillaDiaria {
    id: string;
    fecha: string;
    repartidorId: string;
    estado: EstadoPlanilla;
    cargaInicial: ItemStock[];
    recargas?: Recarga[];
    devolucion?: ItemDevolucion[];
    observaciones?: string;
}

export interface LogEntry {
    id: string;
    timestamp: number;
    level: LogLevel;
    message: string;
    details?: string;
    userEmail?: string;
    userId?: string;
    route?: string;
}

export interface EmailTemplate {
    asunto: string;
    cuerpo: string;
}

export interface Proveedor {
    id: string;
    nombre: string;
    cuit?: string;
    razonSocial?: string;
    telefono?: string;
    email?: string;
    direccion?: string;
    ingresosBrutos?: string;
    activo: boolean;
}

export interface ItemFacturaProveedor {
    descripcion: string;
    cantidad: number;
    precioUnitario: number;
}

export interface FacturaProveedor {
    id: string;
    proveedorId: string;
    numero: string;
    tipoComprobante?: 'A' | 'B' | 'C' | 'M' | 'X' | 'Ticket';
    fechaEmision: string;
    fechaVencimiento: string;
    subtotalNeto?: number;
    importeIva?: number;
    alicuotasIva?: { alicuota: number, importe: number }[];
    alicuotaIva?: number; // Ej: 21, 10.5, 27
    percepciones?: number;
    otrosImpuestos?: { nombre: string, monto: number }[];
    total: number;
    saldoPagar: number;
    estado: EstadoFacturaProveedor;
    items?: ItemFacturaProveedor[];
    archivoUrl?: string; // Optional URL for uploaded PDF/image
    observaciones?: string;
    observacionesMarkdown?: string;
}

export interface PagoProveedor {
    id: string;
    facturaProveedorId?: string; // Optional, might be generic advance payment
    proveedorId: string;
    monto: number;
    fecha: string;
    metodo: MetodoPago;
    observaciones?: string;
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
    [key: string]: any; // Allow plugin configurations to be stored here
    afipConfig?: {
        enabled: boolean;
        apiUrl?: string;
        cert?: string;
        key?: string;
        production?: boolean;
    };
    sopladoConfig?: {
        enabled: boolean;
        integratedWithPlant: boolean;
        dashboardCards?: string[];
    };
    proveedoresConfig?: {
        enabled: boolean;
    };
}
