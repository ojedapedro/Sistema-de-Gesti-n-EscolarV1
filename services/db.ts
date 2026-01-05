import { Representante, RegistroPago, EstadoPago, SystemConfig, NivelConfig } from '../types';
import { ANIO_ESCOLAR_ACTUAL, MENSUALIDADES, GOOGLE_SCRIPT_URL } from '../constants';

class DatabaseService {
  
  private async fetchAPI(action: string, params: any = {}, method: 'GET' | 'POST' = 'GET'): Promise<any> {
    // Si no se ha configurado la URL, devolver error o datos dummy
    if (GOOGLE_SCRIPT_URL.includes("xxxxxx")) {
      console.warn("URL de Google Script no configurada en constants.ts");
      return method === 'GET' ? [] : { status: 'error', message: 'Configurar URL API' };
    }

    try {
      let response;
      if (method === 'GET') {
        const url = `${GOOGLE_SCRIPT_URL}?action=${action}`;
        response = await fetch(url);
      } else {
        // Google Apps Script requiere text/plain para evitar CORS preflight complex
        response = await fetch(GOOGLE_SCRIPT_URL, {
          method: 'POST',
          body: JSON.stringify({ action, data: params }),
          headers: { "Content-Type": "text/plain;charset=utf-8" },
        });
      }

      const json = await response.json();
      
      // Verificar si el backend devolvió un error explícito
      if (json && json.status === 'error') {
        throw new Error(json.message || 'Error desconocido del servidor');
      }

      return json;

    } catch (error) {
      console.error("API Error:", error);
      throw error;
    }
  }

  // --- Configuración ---
  
  async getConfig(): Promise<SystemConfig> {
    try {
      const config = await this.fetchAPI('getConfig');
      return config.tasaCambio ? config : { tasaCambio: 60, fechaActualizacion: new Date().toISOString() };
    } catch (e) {
      return { tasaCambio: 60, fechaActualizacion: new Date().toISOString() };
    }
  }

  async saveConfig(config: SystemConfig): Promise<void> {
    await this.fetchAPI('saveConfig', config, 'POST');
  }

  // --- Niveles y Precios ---

  async getNiveles(): Promise<NivelConfig[]> {
    try {
      const data = await this.fetchAPI('getNiveles');
      return Array.isArray(data) ? data : [];
    } catch (e) {
      return [];
    }
  }

  async saveNiveles(niveles: NivelConfig[]): Promise<void> {
    await this.fetchAPI('saveNiveles', niveles, 'POST');
  }

  // --- Representantes ---

  async getRepresentantes(): Promise<Representante[]> {
    const data = await this.fetchAPI('getRepresentantes');
    return Array.isArray(data) ? data : [];
  }

  async saveRepresentante(rep: Representante): Promise<void> {
    await this.fetchAPI('saveRepresentante', rep, 'POST');
  }

  async getRepresentanteByCedula(cedula: string): Promise<Representante | undefined> {
    const reps = await this.getRepresentantes();
    return reps.find(r => r.cedula === cedula);
  }

  // --- Pagos ---

  async getPagos(): Promise<RegistroPago[]> {
    const data = await this.fetchAPI('getPagos');
    return Array.isArray(data) ? data : [];
  }

  async savePago(pago: RegistroPago): Promise<void> {
    await this.fetchAPI('savePago', pago, 'POST');
  }

  async updateEstadoPago(id: string, referencia: string, cedula: string, nuevoEstado: EstadoPago): Promise<void> {
    // Necesitamos referencia y cedula para encontrar la fila exacta en el script simple
    await this.fetchAPI('updateEstadoPago', { id, referencia, cedulaRepresentante: cedula, nuevoEstado }, 'POST');
  }

  // --- Lógica de Negocio (Helpers Locales) ---

  generarMatricula(cedula: string): string {
    return `mat-${ANIO_ESCOLAR_ACTUAL}-${cedula}`;
  }

  async calcularSaldoPendiente(cedula: string): Promise<number> {
    const rep = await this.getRepresentanteByCedula(cedula);
    if (!rep) return 0;

    // Obtener precios actualizados de la BD
    const nivelesConfig = await this.getNiveles();
    
    let deudaTotalEsperada = 0;
    
    rep.alumnos.forEach(alumno => {
       // Buscar precio en BD, si no existe usar constante local como fallback
       const configNivel = nivelesConfig.find(n => n.nivel === alumno.nivel);
       const precioMensual = configNivel ? configNivel.precio : (MENSUALIDADES[alumno.nivel] || 0);
       deudaTotalEsperada += precioMensual;
    });

    const pagos = await this.getPagos();
    const totalPagado = pagos
      .filter(p => p.cedulaRepresentante === cedula && p.estado === EstadoPago.VERIFICADO)
      .reduce((sum, p) => sum + p.monto, 0);

    return Math.max(0, deudaTotalEsperada - totalPagado);
  }
}

export const db = new DatabaseService();