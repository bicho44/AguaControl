
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
  | 'planillas'; // Nueva vista

export enum Rol {
  ADMINISTRADOR = 'Administrador',
  REPARTIDOR = 'Repartidor',
}

export enum TipoVendedor {
  INTERNO = 'Interno',
  EXTERNO = 'Externo',
}

export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  password?: string;
  rol: Rol;
  tipo: TipoVendedor;
  preciosEspeciales?: PrecioEspecial[]; // Precios de reventa para externos
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
    diasReparto?: DiaSemana[];
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
  estado: EstadoCliente;
  sucursales: Sucursal[];
  cuit?: string;
  tipoFacturacion?: TipoFacturacion;
  telefonos?: Telefono[];
  emails?: string[];
  web?: string;
  tieneCuentaCorriente?: boolean;
  preciosEspeciales?: PrecioEspecial[];
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
    precioReventa?: number; // Precio default para vendedores externos
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
    enviada?: boolean; // Nuevo campo para tracking de envío
}

export interface MovimientoVenta {
    productoId: string;
    cantidad: number;
}

export interface VentaVendedor {
    id: string;
    fecha: string;
    vendedorId: string;
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
    
    // Datos Bancarios y Extras para Factura
    cbu?: string;
    alias?: string;
    banco?: string;
    observacionesFactura?: string;
    
    // Plantilla de Email
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

// --- NUEVOS TYPES PARA CONTROL DE STOCK ---

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
    
    // Carga Inicial (Salida de Fábrica)
    cargaInicial: ItemStock[];
    
    // Recargas durante el día
    recargas?: { 
        hora: string; 
        items: ItemStock[];
        vaciosDescargados?: ItemStock[];
    }[];
    
    // Devolución / Rendición (Vuelta a Fábrica - Cierre final)
    devolucion?: ItemDevolucion[];
    
    // Observaciones del cierre
    observaciones?: string;
}
