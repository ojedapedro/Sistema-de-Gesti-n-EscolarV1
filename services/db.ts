
import { Representante, RegistroPago, EstadoPago, SystemConfig, NivelConfig, User, ArticuloInventario, MovimientoInventario } from '../types';
import { ANIO_ESCOLAR_ACTUAL, MENSUALIDADES, GOOGLE_SCRIPT_URL } from '../constants';

class DatabaseService {
  
  private async fetchAPI(action: string, params: any = {}, method: 'GET' | 'POST' = 'GET'): Promise<any> {
    
    // Validación de Configuración
    if (GOOGLE_SCRIPT_URL.includes("PONER_AQUI") || GOOGLE_SCRIPT_URL.includes("xxxxxx") || !GOOGLE_SCRIPT_URL.startsWith("http")) {
      console.warn("URL de Google Script no configurada correctamente.");
      const errorMsg = "ERROR DE CONFIGURACIÓN: Debes configurar la URL de tu Google Apps Script en el archivo constants.ts. Ve a Extensiones > Apps Script > Implementar.";
      if (method === 'GET') return []; 
      throw new Error(errorMsg);
    }

    try {
      let response;
      if (method === 'GET') {
        const url = `${GOOGLE_SCRIPT_URL}?action=${action}`;
        response = await fetch(url);
      } else {
        response = await fetch(GOOGLE_SCRIPT_URL, {
          method: 'POST',
          body: JSON.stringify({ action, data: params }),
          headers: { "Content-Type": "text/plain;charset=utf-8" },
        });
      }

      const text = await response.text();
      let json;
      
      try {
        json = JSON.parse(text);
      } catch (parseError) {
        console.error("Respuesta no es JSON válido:", text);
        // Si Google devuelve HTML (error 404, 401, o error de script), captúralo aquí
        if (text.includes("<!DOCTYPE html>")) {
           throw new Error("Error de Conexión: La URL del Script es incorrecta, no tienes permisos públicos o el Script ha fallado. Revisa la consola.");
        }
        throw new Error("Error en el servidor: Respuesta inválida.");
      }
      
      if (json && json.status === 'error') {
        throw new Error(json.message || 'Error desconocido del backend');
      }

      return json;

    } catch (error: any) {
      console.error("API Error:", error);
      // Re-lanzar para que los componentes muestren el error en la UI
      throw error;
    }
  }

  // --- Auth & Users ---
  async login(cedula: string, password: string): Promise<User> {
    const response = await this.fetchAPI('login', { cedula, password }, 'POST');
    return {
      cedula: response.cedula,
      nombre: response.nombre,
      rol: response.rol,
      token: response.token
    };
  }

  async getUsers(): Promise<User[]> {
    const data = await this.fetchAPI('getUsers');
    return Array.isArray(data) ? data : [];
  }

  async saveUser(user: User): Promise<void> {
    await this.fetchAPI('saveUser', user, 'POST');
  }

  async deleteUser(cedula: string): Promise<void> {
    await this.fetchAPI('deleteUser', { cedula }, 'POST');
  }

  // --- Configuración ---
  async getConfig(): Promise<SystemConfig> {
    try {
      const config = await this.fetchAPI('getConfig');
      return config.tasaCambio ? config : { tasaCambio: 60, fechaActualizacion: new Date().toISOString() };
    } catch (e) {
      // Si falla, retornamos default para no romper la app en carga inicial, pero logueamos
      console.warn("Usando config default por error de red.");
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
    await this.fetchAPI('updateEstadoPago', { id, referencia, cedulaRepresentante: cedula, nuevoEstado }, 'POST');
  }

  // --- ALMACEN / INVENTARIO ---

  async getInventarioData(): Promise<{ articulos: ArticuloInventario[], movimientos: MovimientoInventario[] }> {
    return await this.fetchAPI('getInventarioData');
  }

  async saveArticulo(articulo: ArticuloInventario): Promise<void> {
    await this.fetchAPI('saveArticulo', articulo, 'POST');
  }

  async saveMovimiento(movimiento: MovimientoInventario): Promise<void> {
    await this.fetchAPI('saveMovimiento', movimiento, 'POST');
  }

  // --- Lógica de Negocio (Helpers Locales) ---
  generarMatricula(cedula: string): string {
    return `mat-${ANIO_ESCOLAR_ACTUAL}-${cedula}`;
  }

  private getMesesEscolaresTranscurridos(): number {
    const now = new Date();
    const currentMonth = now.getMonth(); 
    let meses = 0;
    
    if (currentMonth >= 8) { 
       meses = currentMonth - 7; 
    } else { 
       meses = 4 + (currentMonth + 1);
    }
    return Math.max(1, meses);
  }

  async calcularSaldoPendiente(cedula: string): Promise<number> {
    const rep = await this.getRepresentanteByCedula(cedula);
    if (!rep) return 0;

    const nivelesConfig = await this.getNiveles();
    
    const mesesTranscurridos = this.getMesesEscolaresTranscurridos();
    let deudaTotalEsperada = 0;
    
    rep.alumnos.forEach(alumno => {
       const configNivel = nivelesConfig.find(n => n.nivel === alumno.nivel);
       const precioMensual = configNivel ? configNivel.precio : (MENSUALIDADES[alumno.nivel] || 0);
       
       const mesesCobranza = mesesTranscurridos; 
       
       deudaTotalEsperada += (precioMensual * mesesCobranza);
    });

    const pagos = await this.getPagos();
    const totalPagado = pagos
      .filter(p => p.cedulaRepresentante === cedula && p.estado === EstadoPago.VERIFICADO)
      .reduce((sum, p) => sum + p.monto, 0);

    return deudaTotalEsperada - totalPagado;
  }
}

export const db = new DatabaseService();
