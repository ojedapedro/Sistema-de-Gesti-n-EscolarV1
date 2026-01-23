
// Definición de Niveles
export enum NivelEducativo {
  MATERNAL = 'Maternal',
  PREESCOLAR_1 = 'Pre-escolar 1er Nivel',
  PREESCOLAR_2 = 'Pre-escolar 2do Nivel',
  PREESCOLAR_3 = 'Pre-escolar 3er Nivel',
  PRIMARIA_1 = 'Primaria 1er Grado',
  PRIMARIA_2 = 'Primaria 2do Grado',
  PRIMARIA_3 = 'Primaria 3er Grado',
  PRIMARIA_4 = 'Primaria 4to Grado',
  PRIMARIA_5 = 'Primaria 5to Grado',
  PRIMARIA_6 = 'Primaria 6to Grado',
  SECUNDARIA_1 = 'Secundaria 1er Año',
  SECUNDARIA_2 = 'Secundaria 2do Año',
  SECUNDARIA_3 = 'Secundaria 3er Año',
  SECUNDARIA_4 = 'Secundaria 4to Año',
  SECUNDARIA_5 = 'Secundaria 5to Año',
}

// Métodos de Pago
export enum MetodoPago {
  PAGO_MOVIL = 'Pago Móvil',
  TRANSFERENCIA = 'Transferencia',
  ZELLE = 'Zelle',
  EFECTIVO_BS = 'Efectivo Bs',
  EFECTIVO_USD = 'Efectivo $',
  EFECTIVO_EUR = 'Efectivo Euro',
  TDC = 'TDC (Crédito)',
  TDD = 'TDD (Débito)',
}

export enum EstadoPago {
  PENDIENTE_VERIFICACION = 'Pendiente',
  VERIFICADO = 'Verificado',
  RECHAZADO = 'Rechazado',
}

// Roles de Usuario
export enum UserRole {
  ADMIN = 'Administrador',
  AUXILIAR = 'Auxiliar Administrativo',
  CAJERO = 'Cajero',
}

export interface User {
  cedula: string;
  nombre: string;
  rol: UserRole;
  password?: string; // Nuevo campo opcional para gestión
  token?: string;
}

// Configuración de Precio por Nivel
export interface NivelConfig {
  nivel: string;
  precio: number;
}

// Configuración del Sistema
export interface SystemConfig {
  tasaCambio: number;
  fechaActualizacion: string;
}

// Estructura del Alumno
export interface Alumno {
  id: string;
  nombres: string;
  apellidos: string;
  nivel: NivelEducativo;
  seccion: string;
  mensualidad: number;
}

// Estructura del Representante (Entidad Principal)
export interface Representante {
  cedula: string; // ID Único
  nombres: string;
  apellidos: string;
  telefono: string;
  correo: string;
  direccion: string;
  matricula: string; // mat-YYYY-YY-CEDULA
  alumnos: Alumno[];
}

// Estructura del Registro de Pago (Adaptada a la hoja de cálculo)
export interface RegistroPago {
  id: string; // Col A
  timestamp: string; // Col B
  fechaRegistro: string; // Col C
  fechaPago: string; // Col D
  cedulaRepresentante: string; // Col E
  studentId?: string; // Col F (Nuevo)
  mes?: string; // Col G (Nuevo)
  anio?: string; // Col H (Nuevo)
  metodoPago: MetodoPago; // Col I
  referencia: string; // Col J
  monto: number; // Col K (USD)
  montoBolivares?: number; // Col L (Bs)
  estado: EstadoPago; // Col M (Status)
  observaciones: string; // Col N
  nombreRepresentante: string; // Col O
  matricula: string; // Col P
  formaPago: string; // Col Q (paymentForm) - Antes tipoPago
  tasaCambioAplicada?: number; // No guardado explícitamente en tabla principal
}

export interface DeudaInfo {
  totalDeuda: number;
  detalles: string[];
}

// --- TIPOS DE ALMACÉN ---

export enum CategoriaInsumo {
  LIMPIEZA = 'Insumos de Limpieza',
  ESCOLAR = 'Material Escolar',
  OFICINA = 'Material de Oficina',
  UNIFORME_DOCENTE = 'Uniformes (Docentes)',
  UNIFORME_ADMIN = 'Uniformes (Administrativo)',
  UNIFORME_MANTENIMIENTO = 'Uniformes (Mantenimiento)',
  OTROS = 'Otros'
}

export enum TipoMovimiento {
  ENTRADA = 'Compra / Entrada',
  SALIDA = 'Requisición / Salida'
}

export interface ArticuloInventario {
  id: string;
  nombre: string;
  categoria: CategoriaInsumo;
  unidadMedida: string; // Unidad, Litro, Caja, Paquete
  stockMinimo: number;
  // El stock actual se calcula, no se guarda estático para evitar inconsistencias
  stockCalculado?: number; 
}

export interface MovimientoInventario {
  id: string;
  fecha: string;
  articuloId: string;
  nombreArticulo: string; // Redundancia para reportes rápidos
  categoria: CategoriaInsumo;
  tipo: TipoMovimiento;
  cantidad: number;
  solicitanteOProveedor: string; // Quien pide (salida) o Proveedor (entrada)
  motivo: string; // "Limpieza General", "Dotación Inicio Año", etc.
  usuarioRegistra: string; // Usuario del sistema
  costoTotal?: number; // NUEVO: Costo en USD de la compra
}

// --- TIPOS DE NÓMINA ---

export enum Departamento {
  DIRECTIVO = 'Personal Directivo',
  DOCENTE = 'Personal Docente',
  ADMINISTRATIVO = 'Personal Administrativo',
  MANTENIMIENTO = 'Personal de Mantenimiento'
}

export enum Cargo {
  DIRECTOR = 'Director',
  SUB_DIRECTOR = 'Sub Director',
  JEFE_CONTROL_ESTUDIOS = 'Jefe de Control de Estudios',
  DOCENTE_I = 'Docente Tipo I',
  DOCENTE_II = 'Docente Tipo II',
  DOCENTE_III = 'Docente Tipo III',
  ADMINISTRADORA = 'Administradora',
  ANALISTA_ADMIN = 'Analista de Administración',
  CAJERA = 'Cajera',
  AUXILIAR_MANTENIMIENTO = 'Auxiliar de Mantenimiento'
}

export interface Empleado {
  id: string;
  cedula: string;
  nombres: string;
  apellidos: string;
  departamento: Departamento;
  cargo: Cargo;
  fechaIngreso: string;
  sueldoBase: number; // Mensual
  bono: number; // Mensual
  diasVacacionesPendientes: number;
  estado: 'ACTIVO' | 'INACTIVO';
}

export interface RegistroNomina {
  id: string;
  empleadoId: string;
  nombreCompleto: string;
  cedula: string;
  cargo: string;
  periodo: string; // Ej: "01-15 Septiembre 2025"
  fechaPago: string;
  sueldoBase: number;
  bono: number;
  asignacionesExtra: number; // Otros ingresos
  deduccionSSO: number; // IVSS (4%)
  deduccionSPF: number; // Paro Forzoso (0.5%)
  deduccionFAOV: number; // Vivienda (1%)
  otrasDeducciones: number;
  totalPagar: number;
}

// --- TIPOS DE PAGOS DE SERVICIOS ---

export enum CategoriaServicio {
  IMPUESTO_NACIONAL = 'Impuestos Nacionales (ISLR, SENIAT)',
  IMPUESTO_MUNICIPAL = 'Impuestos Municipales',
  SERVICIOS_BASICOS = 'Servicios Básicos (Agua, Luz)',
  TELECOMUNICACIONES = 'Telecomunicaciones (Internet, Tlf)',
  OTROS = 'Otros Pagos Administrativos'
}

export interface PagoServicio {
  id: string;
  categoria: CategoriaServicio;
  proveedor: string; // Ej: CANTV, CORPOELEC, ALCALDIA
  descripcion: string; // Ej: Factura Marzo 2025
  fechaVencimiento: string;
  fechaPago: string;
  monto: number; // Monto principal (usualmente USD referencial)
  montoBolivares: number; // Monto pagado en BS
  tasaCambio: number;
  metodoPago: MetodoPago;
  referencia: string;
  estado: 'PAGADO' | 'PENDIENTE';
  registradoPor: string;
}
