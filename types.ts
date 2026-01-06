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