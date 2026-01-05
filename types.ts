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
  PENDIENTE_VERIFICACION = 'Pendiente Verificación',
  VERIFICADO = 'Verificado',
  RECHAZADO = 'Rechazado',
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

// Estructura del Registro de Pago (Base de datos unificada)
export interface RegistroPago {
  id: string;
  timestamp: string; // ISO String
  fechaRegistro: string; // YYYY-MM-DD
  fechaPago: string; // YYYY-MM-DD
  cedulaRepresentante: string;
  nombreRepresentante: string;
  nivel: string; // Nivel del alumno (o concatenado si paga por varios)
  matricula: string;
  tipoPago: 'Abono' | 'Total';
  metodoPago: MetodoPago;
  referencia: string;
  monto: number; // Siempre almacenado en USD base
  tasaCambioAplicada?: number; // Tasa usada en el momento del pago
  montoBolivares?: number; // Monto original en Bs si aplica
  observaciones: string;
  estado: EstadoPago;
}

export interface DeudaInfo {
  totalDeuda: number;
  detalles: string[];
}