
import { Representante, RegistroPago, EstadoPago, SystemConfig, NivelConfig, User, ArticuloInventario, MovimientoInventario, Empleado, RegistroNomina, PagoServicio } from '../types';
import { ANIO_ESCOLAR_ACTUAL, MENSUALIDADES, GOOGLE_SCRIPT_URL } from '../constants';

class DatabaseService {
  
  private isDemoMode(): boolean {
    try {
      const userStr = localStorage.getItem('adminpro_user');
      if (userStr) {
        const user = JSON.parse(userStr);
        if (user.email === 'demo@adminpro.com') return true;
      }
      return new URLSearchParams(window.location.search).get('demo') === 'true';
    } catch (e) {
      return false;
    }
  }

  private async mockFetchAPI(action: string, params: any = {}, method: 'GET' | 'POST' = 'GET'): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, 300)); // Simulate network

    const getStorage = (key: string, defaultValue: any) => {
      const data = localStorage.getItem(`demo_${key}`);
      return data ? JSON.parse(data) : defaultValue;
    };

    const setStorage = (key: string, value: any) => {
      localStorage.setItem(`demo_${key}`, JSON.stringify(value));
    };

    switch (action) {
      case 'login':
        if (params.email === 'demo@adminpro.com') {
          return { email: 'demo@adminpro.com', nombre: 'Usuario Demo', rol: 'Administrador', token: 'demo-token' };
        }
        throw new Error('Credenciales inválidas en modo demo');
      
      case 'getUsers': return getStorage('users', []);
      case 'saveUser': 
        const users = getStorage('users', []);
        setStorage('users', [...users.filter((u: any) => u.email !== params.email), params]);
        return { status: 'success' };
      case 'deleteUser':
        setStorage('users', getStorage('users', []).filter((u: any) => u.email !== params.email));
        return { status: 'success' };
        
      case 'getConfig': return getStorage('config', { tasaCambio: 60, fechaActualizacion: new Date().toISOString() });
      case 'saveConfig': setStorage('config', params); return { status: 'success' };
      
      case 'getNiveles': return getStorage('niveles', []);
      case 'saveNiveles': setStorage('niveles', params); return { status: 'success' };
      
      case 'getRepresentantes': return getStorage('representantes', [
        {
          cedula: 'V-12345678',
          nombres: 'Juan',
          apellidos: 'Pérez',
          telefono: '0414-1234567',
          correo: 'juan.perez@example.com',
          direccion: 'Av. Principal',
          matricula: 'mat-2024-V-12345678',
          alumnos: [
            {
              id: 'A-001',
              nombres: 'Carlos',
              apellidos: 'Pérez',
              nivel: 'Primaria 1er Grado',
              seccion: 'A',
              mensualidad: 50
            }
          ]
        }
      ]);
      case 'saveRepresentante':
        const reps = getStorage('representantes', []);
        setStorage('representantes', [...reps.filter((r: any) => r.cedula !== params.cedula), params]);
        return { status: 'success' };
        
      case 'getPagos': return getStorage('pagos', []);
      case 'savePago':
        const pagos = getStorage('pagos', []);
        setStorage('pagos', [...pagos, params]);
        return { status: 'success' };
      case 'updateEstadoPago':
        const pagosToUpdate = getStorage('pagos', []);
        const updatedPagos = pagosToUpdate.map((p: any) => p.id === params.id ? { ...p, estado: params.nuevoEstado } : p);
        setStorage('pagos', updatedPagos);
        return { status: 'success' };
        
      case 'getInventarioData':
        return {
          articulos: getStorage('articulos', []),
          movimientos: getStorage('movimientos', [])
        };
      case 'saveArticulo':
        const arts = getStorage('articulos', []);
        setStorage('articulos', [...arts.filter((a: any) => a.id !== params.id), params]);
        return { status: 'success' };
      case 'saveMovimiento':
        const movs = getStorage('movimientos', []);
        setStorage('movimientos', [...movs, params]);
        return { status: 'success' };
      case 'saveMovimientoBatch':
        const movsBatch = getStorage('movimientos', []);
        setStorage('movimientos', [...movsBatch, ...params]);
        return { status: 'success' };
        
      case 'getEmpleados': return getStorage('empleados', []);
      case 'saveEmpleado':
        const emps = getStorage('empleados', []);
        setStorage('empleados', [...emps.filter((e: any) => e.id !== params.id), params]);
        return { status: 'success' };
      case 'saveNominaBatch':
        const nomina = getStorage('nomina', []);
        setStorage('nomina', [...nomina, ...params]);
        return { status: 'success' };
      case 'getNominaHistory': return getStorage('nomina', []);
        
      case 'getPagosServicios': return getStorage('pagosServicios', []);
      case 'savePagoServicio':
        const servs = getStorage('pagosServicios', []);
        setStorage('pagosServicios', [...servs.filter((s: any) => s.id !== params.id), params]);
        return { status: 'success' };
        
      default:
        return { status: 'success' };
    }
  }

  private async fetchAPI(action: string, params: any = {}, method: 'GET' | 'POST' = 'GET'): Promise<any> {
    if (this.isDemoMode()) {
      return this.mockFetchAPI(action, params, method);
    }
    
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
  async login(email: string, password: string): Promise<User> {
    const response = await this.fetchAPI('login', { email, password }, 'POST');
    return {
      email: response.email,
      nombre: response.nombre,
      rol: response.rol,
      cedula: response.cedula,
      token: response.token
    };
  }

  async recoverPassword(email: string): Promise<{message: string}> {
    const response = await this.fetchAPI('recoverPassword', { email }, 'POST');
    return response;
  }

  async getUsers(): Promise<User[]> {
    const data = await this.fetchAPI('getUsers');
    return Array.isArray(data) ? data : [];
  }

  async saveUser(user: User): Promise<void> {
    await this.fetchAPI('saveUser', user, 'POST');
  }

  async deleteUser(email: string): Promise<void> {
    await this.fetchAPI('deleteUser', { email }, 'POST');
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

  async saveMovimientoBatch(movimientos: MovimientoInventario[]): Promise<void> {
    await this.fetchAPI('saveMovimientoBatch', movimientos, 'POST');
  }
  
  // --- NOMINA / EMPLEADOS ---
  
  async getEmpleados(): Promise<Empleado[]> {
    const data = await this.fetchAPI('getEmpleados');
    return Array.isArray(data) ? data : [];
  }
  
  async saveEmpleado(empleado: Empleado): Promise<void> {
    await this.fetchAPI('saveEmpleado', empleado, 'POST');
  }
  
  async saveNominaBatch(registros: RegistroNomina[]): Promise<void> {
    await this.fetchAPI('saveNominaBatch', registros, 'POST');
  }

  async getNominaHistory(): Promise<RegistroNomina[]> {
    const data = await this.fetchAPI('getNominaHistory');
    return Array.isArray(data) ? data : [];
  }

  // --- PAGOS SERVICIOS (Nuevo Módulo) ---

  async getPagosServicios(): Promise<PagoServicio[]> {
    const data = await this.fetchAPI('getPagosServicios');
    return Array.isArray(data) ? data : [];
  }

  async savePagoServicio(pago: PagoServicio): Promise<void> {
    await this.fetchAPI('savePagoServicio', pago, 'POST');
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
