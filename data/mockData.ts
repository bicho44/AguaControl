

import { Cliente, Usuario, Remito, TipoVendedor, MetodoPago, Factura, Producto, TipoProducto, TipoFacturacion, TipoTelefono, VentaVendedor, RegistroPago, Gasto, Rol, EstadoFactura, EmpresaSettings, CondicionIVA, Contrato, TipoServicio, EstadoContrato, Servicio, EstadoCliente, EstadoServicio, EstadoProducto, DiaSemana, PlanillaDiaria, EstadoPlanilla } from '../types';

// Determinamos el día actual para que el mock siempre tenga algo que mostrar hoy
const days = [DiaSemana.DOMINGO, DiaSemana.LUNES, DiaSemana.MARTES, DiaSemana.MIERCOLES, DiaSemana.JUEVES, DiaSemana.VIERNES, DiaSemana.SABADO];
const todayIndex = new Date().getDay(); 
const diaActual = days[todayIndex];

// Definimos un día alternativo
const diaAlternativo = days[(todayIndex + 2) % 7];


export const mockClientes: Cliente[] = [
  {
    id: 'c1',
    nombre: 'Supermercado La Confianza',
    estado: EstadoCliente.ACTIVO,
    sucursales: [
      { 
        id: 's1-1', 
        nombre: 'Centro', 
        direccion: 'Mitre 123, Bariloche',
        lat: -41.1343, 
        lng: -71.3093, // Centro Cívico
        diasReparto: [diaActual, diaAlternativo] // Reparte hoy y otro día
      },
      { 
        id: 's1-2', 
        nombre: 'KM 8', 
        direccion: 'Av. Bustillo 8500',
        lat: -41.1275,
        lng: -71.4082, // KM 8
        diasReparto: [DiaSemana.JUEVES]
      },
    ],
    cuit: '30-12345678-9',
    tipoFacturacion: TipoFacturacion.RESPONSABLE_INSCRIPTO,
    telefonos: [
      { tipo: TipoTelefono.LOCAL, numero: '442-0000' },
      { tipo: TipoTelefono.WHATSAPP, numero: '294-456-7890' }
    ],
    emails: ['compras@laconfianza.com', 'admin@laconfianza.com'],
    web: 'www.laconfianza.com',
    tieneCuentaCorriente: true,
    preciosEspeciales: [
      { productoId: 'p1', precio: 1400 }, // Precio especial para Bidón 20L
    ]
  },
  { 
    id: 'c2', 
    nombre: 'Kiosco El Sol', 
    estado: EstadoCliente.ACTIVO,
    sucursales: [
        {
            id: 's2-1', 
            nombre: 'Dina Huapi', 
            direccion: 'Los Notros 500, Dina Huapi',
            lat: -41.0705,
            lng: -71.1652, // Dina Huapi
            diasReparto: [diaActual] // También hoy
        }
    ],
    tipoFacturacion: TipoFacturacion.CONSUMIDOR_FINAL,
    telefonos: [{ tipo: TipoTelefono.CEL, numero: '294-411-2233' }],
    emails: ['kioscoelsol@email.com']
  },
  {
    id: 'c3',
    nombre: 'Hostería Buen Descanso',
    estado: EstadoCliente.ACTIVO,
    sucursales: [
        { 
            id: 's3-1', 
            nombre: 'Única', 
            direccion: 'Av. Bustillo KM 13',
            lat: -41.0872,
            lng: -71.4678, // KM 13
            diasReparto: [diaAlternativo]
        }
    ],
    cuit: '33-87654321-0',
    tipoFacturacion: TipoFacturacion.RESPONSABLE_INSCRIPTO,
    telefonos: [{ tipo: TipoTelefono.WHATSAPP, numero: '294-455-6677' }],
    emails: ['reservas@buendescanso.com.ar'],
    web: 'www.buendescanso.com.ar'
  },
];

export const mockUsuarios: Usuario[] = [
  { id: 'u1', nombre: 'Juan Pérez', email: 'juan.perez@aguaspuras.com', rol: Rol.REPARTIDOR, tipo: TipoVendedor.INTERNO },
  { id: 'u2', nombre: 'Ana Gómez', email: 'ana.gomez@aguaspuras.com', rol: Rol.ADMINISTRADOR, tipo: TipoVendedor.INTERNO },
  { id: 'u3', nombre: 'Distribuidora del Sur', email: 'distrisur@email.com', rol: Rol.REPARTIDOR, tipo: TipoVendedor.EXTERNO },
];

export const mockProductos: Producto[] = [
  { id: 'p1', nombre: 'Bidón 20L Retornable', tipo: TipoProducto.RETORNABLE, estado: EstadoProducto.ACTIVO, litros: 20, precio: 1500, color: '#3b82f6' },
  { id: 'p2', nombre: 'Bidón 12L Retornable', tipo: TipoProducto.RETORNABLE, estado: EstadoProducto.ACTIVO, litros: 12, precio: 1200, color: '#10b981' },
  { id: 'p3', nombre: 'Bidón 8L Descartable', tipo: TipoProducto.DESCARTABLE, estado: EstadoProducto.ACTIVO, litros: 8, precio: 1000, color: '#f59e0b' },
  { id: 'p4', nombre: 'Dispenser Natural', tipo: TipoProducto.EQUIPO, estado: EstadoProducto.ACTIVO, litros: 0, precio: 25000, color: '#64748b' },
  { id: 'p5', nombre: 'Maquina Frio/Calor de Red', tipo: TipoProducto.EQUIPO, estado: EstadoProducto.ACTIVO, litros: 0, precio: 80000, color: '#8b5cf6' },
  { id: 'p_serv_1', nombre: 'Abono Mensual 4 Bidones', tipo: TipoProducto.OTRO, estado: EstadoProducto.ACTIVO, litros: 0, precio: 5000, color: '#ec4899' },
];

const today = new Date();
const formatDate = (date: Date) => date.toISOString().split('T')[0];

export const mockRemitos: Remito[] = [
  {
    id: 'r1',
    fecha: formatDate(new Date(new Date().setDate(today.getDate() - 35))),
    clienteId: 'c1',
    sucursalId: 's1-1',
    vendedorId: 'u1',
    puntoVenta: '1',
    numero: '1234',
    movimientos: [
        { productoId: 'p1', entregados: 20, recibidos: 18 },
        { productoId: 'p3', entregados: 10, recibidos: 0 },
    ],
    pagoIds: [],
    facturaId: 'f1',
  },
  {
    id: 'r2',
    fecha: formatDate(new Date(new Date().setDate(today.getDate() - 15))),
    clienteId: 'c2',
    vendedorId: 'u1',
    puntoVenta: '1',
    numero: '1235',
    movimientos: [
        { productoId: 'p2', entregados: 5, recibidos: 5 },
    ],
    pagoIds: ['rp-r2-1'],
  },
  {
    id: 'r3',
    fecha: formatDate(new Date(new Date().setDate(today.getDate() - 2))),
    clienteId: 'c1',
    sucursalId: 's1-2',
    vendedorId: 'u1',
    puntoVenta: '1',
    numero: '1236',
    movimientos: [
        { productoId: 'p1', entregados: 15, recibidos: 14 },
        { productoId: 'p3', entregados: 5, recibidos: 0 },
    ],
    pagoIds: [],
  },
  // Remito de Servicio
  {
    id: 'r4',
    fecha: formatDate(new Date()),
    clienteId: 'c3',
    sucursalId: 's3-1',
    vendedorId: 'u2',
    puntoVenta: '1',
    numero: '1237',
    movimientos: [
        { productoId: 'p_serv_1', entregados: 1, recibidos: 0 }
    ],
    pagoIds: [],
    facturaId: 'f2'
  }
];

export const mockVentasVendedor: VentaVendedor[] = [
  {
    id: 'vv1',
    fecha: formatDate(new Date(new Date().setDate(today.getDate() - 10))),
    vendedorId: 'u3', // Distribuidora Externa
    movimientos: [
      { productoId: 'p1', cantidad: 10 },
      { productoId: 'p3', cantidad: 20 },
    ],
    pagoIds: ['rp4']
  },
  {
    id: 'vv2',
    fecha: formatDate(new Date()),
    vendedorId: 'u3', // Distribuidora Externa
    movimientos: [
      { productoId: 'p2', cantidad: 5 },
    ],
    pagoIds: ['rp5', 'rp6']
  }
];

export const mockRegistrosPago: RegistroPago[] = [
  { id: 'rp-f1-1', fecha: formatDate(new Date(new Date().setDate(today.getDate() - 30))), monto: 10000, metodo: MetodoPago.TRANSFERENCIA, origen: { tipo: 'factura', id: 'f1' }, clienteId: 'c1' },
  { id: 'rp-r2-1', fecha: mockRemitos[1].fecha, monto: 6000, metodo: MetodoPago.EFECTIVO, origen: { tipo: 'remito', id: 'r2' }, clienteId: 'c2', vendedorId: 'u1'},
  { id: 'rp4', fecha: mockVentasVendedor[0].fecha, monto: 5000, metodo: MetodoPago.TRANSFERENCIA, origen: { tipo: 'venta_vendedor', id: 'vv1' }, vendedorId: 'u3' },
  { id: 'rp5', fecha: mockVentasVendedor[1].fecha, monto: 1000, metodo: MetodoPago.EFECTIVO, origen: { tipo: 'venta_vendedor', id: 'vv2' }, vendedorId: 'u3' },
  { id: 'rp6', fecha: mockVentasVendedor[1].fecha, monto: 500, metodo: MetodoPago.MERCADO_PAGO, origen: { tipo: 'venta_vendedor', id: 'vv2' }, vendedorId: 'u3' },
  { id: 'rpm1', fecha: formatDate(new Date(new Date().setDate(today.getDate() - 5))), monto: 1200, metodo: MetodoPago.MERCADO_PAGO, origen: { tipo: 'pago_manual', id: 'rpm1' }, vendedorId: 'u1', clienteId: 'c2', concepto: 'Adelanto Kiosco' },
];

export const mockGastos: Gasto[] = [
  {
    id: 'g1',
    fecha: formatDate(new Date(new Date().setDate(today.getDate() - 3))),
    pagos: [{ monto: 2500, metodo: MetodoPago.EFECTIVO }],
    concepto: 'Combustible Camioneta',
    nroRecibo: 'TK-001-5896'
  },
  {
    id: 'g2',
    fecha: formatDate(new Date(new Date().setDate(today.getDate() - 1))),
    pagos: [{ monto: 15000, metodo: MetodoPago.TRANSFERENCIA }],
    concepto: 'Pago a proveedor de botellas',
  },
];

export const mockFacturas: Factura[] = [
    {
        id: 'f1',
        fecha: formatDate(new Date(new Date().setDate(today.getDate() - 32))),
        clienteId: 'c1',
        numero: 'F-001-0001',
        monto: 28000, // 20 * 1400 (precio especial) = 28000
        remitosIds: ['r1'],
        pagoIds: ['rp-f1-1'],
        estado: EstadoFactura.PAGADO_PARCIAL,
        enviada: true,
    },
    {
        id: 'f2',
        fecha: formatDate(new Date()),
        clienteId: 'c3',
        numero: 'F-001-0002',
        monto: 5000,
        remitosIds: ['r4'],
        pagoIds: [],
        estado: EstadoFactura.PENDIENTE,
        enviada: false,
    }
];

export const mockEmpresaSettings: EmpresaSettings = {
    nombre: 'Aguas Puras Bariloche S.R.L.',
    nombreFantasia: 'Aguas Puras',
    direccion: 'Esandi 123, Bariloche',
    lat: -41.1150, // Zona Esandi / Circunvalación
    lng: -71.2680,
    telefonos: [
        { tipo: TipoTelefono.LOCAL, numero: '443-5555' },
        { tipo: TipoTelefono.WHATSAPP, numero: '294-444-5555' }
    ],
    emails: ['contacto@aguaspuras.com.ar'],
    cuit: '30-98765432-1',
    condicionIVA: CondicionIVA.RESPONSABLE_INSCRIPTO,
    iibb: '901-123456-7',
    fechaInicioActividad: '2015-06-01',
    logo: '',
    emailTemplate: {
        asunto: "Factura {{numero}} - {{empresa}}",
        cuerpo: "Hola {{cliente}},\n\nAdjuntamos la factura correspondiente a sus últimos pedidos.\n\nTotal a pagar: ${{monto}}\n\nDetalle:\n{{remitos}}\n\nGracias por su compra.\n{{empresa}}"
    }
};

export const mockServicios: Servicio[] = [
  {
    id: 'serv1',
    nombre: 'Comodato Dispenser Natural',
    tipo: TipoServicio.COMODATO,
    estado: EstadoServicio.ACTIVO,
    descripcion: 'Se entrega un dispenser natural sin cargo. Solo se cobra el consumo de bidones.',
    productoId: 'p4', // Dispenser Natural
  },
  {
    id: 'serv2',
    nombre: 'Abono Fijo 4 Bidones',
    tipo: TipoServicio.ABONO_FIJO,
    estado: EstadoServicio.ACTIVO,
    descripcion: 'Incluye un dispenser y 4 bidones de 20L. El excedente se cobra aparte.',
    productoId: 'p4', // Dispenser Natural
    montoMensual: 5000,
    productoConsumoId: 'p1', // Bidón 20L
    consumoIncluido: 4,
  },
  {
    id: 'serv3',
    nombre: 'Alquiler Máquina de Red',
    tipo: TipoServicio.ALQUILER_PURO,
    estado: EstadoServicio.ACTIVO,
    descripcion: 'Alquiler mensual de máquina conectada a la red de agua. Incluye mantenimiento.',
    productoId: 'p5', // Maquina Frio/Calor de Red
    montoMensual: 8500,
  },
];

export const mockContratos: Contrato[] = [
  {
    id: 'ct1',
    servicioId: 'serv1',
    clienteId: 'c1',
    sucursalId: 's1-1',
    tipo: TipoServicio.COMODATO,
    fechaInicio: '2022-01-15',
    productoId: 'p4', // Dispenser Natural
    numeroSerie: 'DN-10234',
    estado: EstadoContrato.ACTIVO,
    condicionesEspeciales: 'Un dispenser en sucursal Centro.'
  },
  {
    id: 'ct2',
    servicioId: 'serv2',
    clienteId: 'c3',
    tipo: TipoServicio.ABONO_FIJO,
    fechaInicio: '2023-05-20',
    productoId: 'p4', // Dispenser Natural
    numeroSerie: 'DN-10589',
    estado: EstadoContrato.ACTIVO,
    montoMensual: 5000,
    productoConsumoId: 'p1', // Bidón 20L
    consumoIncluido: 4,
  }
];

export const mockPlanillas: PlanillaDiaria[] = [
    {
        id: 'pd1',
        fecha: formatDate(new Date()),
        repartidorId: 'u1', // Juan Perez
        estado: EstadoPlanilla.ABIERTA,
        cargaInicial: [
            { productoId: 'p1', cantidad: 50 }, // 50 Bidones 20L
            { productoId: 'p2', cantidad: 20 }, // 20 Bidones 12L
        ]
    }
];
