import { NivelEducativo } from './types';

// IMPORTANTE: REEMPLAZA ESTA URL CON LA DE TU APP SCRIPT PUBLICADA
export const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwb7uZZfw5hxWpwwQOmG7-5MpNyOV1wtMS0M8m1fux-XxfoRuTTyM28710_DwEC6Sp5/exec"; 

export const MENSUALIDADES: Record<NivelEducativo, number> = {
  [NivelEducativo.MATERNAL]: 120,
  [NivelEducativo.PREESCOLAR_1]: 100,
  [NivelEducativo.PREESCOLAR_2]: 100,
  [NivelEducativo.PREESCOLAR_3]: 100,
  [NivelEducativo.PRIMARIA_1]: 110,
  [NivelEducativo.PRIMARIA_2]: 110,
  [NivelEducativo.PRIMARIA_3]: 110,
  [NivelEducativo.PRIMARIA_4]: 110,
  [NivelEducativo.PRIMARIA_5]: 110,
  [NivelEducativo.PRIMARIA_6]: 110,
  [NivelEducativo.SECUNDARIA_1]: 130,
  [NivelEducativo.SECUNDARIA_2]: 130,
  [NivelEducativo.SECUNDARIA_3]: 130,
  [NivelEducativo.SECUNDARIA_4]: 140,
  [NivelEducativo.SECUNDARIA_5]: 150,
};

export const ANIO_ESCOLAR_ACTUAL = "2025-26";

// Ayuda para detectar si requiere verificación manual
export const REQUIERE_VERIFICACION = [
  'Pago Móvil',
  'Transferencia',
  'Zelle'
];