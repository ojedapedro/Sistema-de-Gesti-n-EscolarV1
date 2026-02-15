
import { NivelEducativo } from './types';

// IMPORTANTE:
// 1. Crea una Hoja de Cálculo en Google.
// 2. Ve a Extensiones > Apps Script y pega el código de backend/GoogleAppsScript.js
// 3. En el Script, pon el ID de tu hoja de cálculo.
// 4. Publica como Web App (Acceso: "Cualquier persona").
// 5. Pega la URL generada (termina en /exec) abajo:

export const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzohIgQT-yX1cW_0JfiuPjMwKwXDPKf3IWKnPbhssBEG6rQ_7hDnvuObNRc3dCyFtv2/exec"; 

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

export const LOGO_URL = "https://i.ibb.co/FbHJbvVT/images.png";

// Ayuda para detectar si requiere verificación manual
export const REQUIERE_VERIFICACION = [
  'Pago Móvil',
  'Transferencia',
  'Zelle'
];
