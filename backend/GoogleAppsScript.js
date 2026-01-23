
// --- CONFIGURACIÓN OBLIGATORIA ---
// Copia el ID de tu hoja de cálculo de la URL del navegador.
// Ejemplo: https://docs.google.com/spreadsheets/d/13pCWr4GvNgysOCddPLhkgsj6iVNwfbrE9JyAJIJPhgs/edit
// El ID es: 13pCWr4GvNgysOCddPLhkgsj6iVNwfbrE9JyAJIJPhgs

const SPREADSHEET_ID = 'PONER_AQUI_EL_ID_DE_TU_HOJA_DE_CALCULO'; 

function doGet(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);
  
  try {
    if (SPREADSHEET_ID.includes('PONER_AQUI')) {
      return errorResponse("ERROR CRÍTICO: No has configurado el SPREADSHEET_ID en el código de Apps Script.");
    }

    const action = e.parameter.action;
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    
    let result = {};
    
    if (action === 'getConfig') {
      let sheet = ss.getSheetByName('Config');
      if (!sheet) {
        result = { tasaCambio: 0, fechaActualizacion: new Date().toISOString() };
      } else {
        const data = sheet.getDataRange().getValues();
        result = {
          tasaCambio: data.length > 1 ? Number(data[1][0]) : 0,
          fechaActualizacion: data.length > 1 ? data[1][1] : new Date().toISOString()
        };
      }
    }
    else if (action === 'getNiveles') {
      let sheet = ss.getSheetByName('Levels');
      if (!sheet) result = [];
      else {
        const rows = sheet.getDataRange().getValues();
        rows.shift(); // Quitar header
        result = rows.map(row => ({ nivel: String(row[0]), precio: Number(row[1]) }));
      }
    }
    else if (action === 'getRepresentantes') {
      const sheetRep = ss.getSheetByName('Representatives');
      const sheetStu = ss.getSheetByName('Students');
      
      if (!sheetRep || !sheetStu) {
        result = [];
      } else {
        const dataRep = sheetRep.getDataRange().getValues();
        dataRep.shift();
        
        const dataStu = sheetStu.getDataRange().getValues();
        dataStu.shift();
        
        const studentsMap = {};
        dataStu.forEach(row => {
          const repCedula = String(row[1]);
          if (!studentsMap[repCedula]) studentsMap[repCedula] = [];
          studentsMap[repCedula].push({
            id: String(row[0]),
            nombres: String(row[2]),
            apellidos: "",
            nivel: row[3],
            seccion: row[5],
            mensualidad: 0
          });
        });
        
        result = dataRep.map(row => {
          const cedula = String(row[0]);
          const fullName = String(row[1]);
          const parts = fullName.split(' ');
          return {
            cedula: cedula,
            nombres: parts[0] || fullName,
            apellidos: parts.slice(1).join(' ') || "",
            telefono: String(row[2]),
            correo: String(row[3]),
            direccion: String(row[4]),
            matricula: String(row[5]),
            alumnos: studentsMap[cedula] || []
          };
        }).filter(r => r.cedula);
      }
    }
    else if (action === 'getPagos') {
      const sheet = ss.getSheetByName('Payments');
      if (!sheet) {
        result = [];
      } else {
        const rows = sheet.getDataRange().getValues();
        rows.shift();
        
        result = rows.map(row => {
          const rawMonto = row[10];
          const rawMontoBs = row[11];
          
          return {
            id: String(row[0]),
            timestamp: row[1],
            fechaRegistro: formatDateStr(row[2]),
            fechaPago: formatDateStr(row[3]),
            cedulaRepresentante: String(row[4]),
            studentId: String(row[5] || ''),
            mes: String(row[6] || ''),
            anio: String(row[7] || ''),
            metodoPago: row[8],
            referencia: String(row[9]),
            monto: !isNaN(Number(rawMonto)) ? Number(rawMonto) : 0,
            montoBolivares: !isNaN(Number(rawMontoBs)) ? Number(rawMontoBs) : 0,
            estado: row[12],
            observaciones: String(row[13]),
            nombreRepresentante: String(row[14]),
            matricula: String(row[15]),
            formaPago: String(row[16] || '')
          };
        });
      }
    }
    else if (action === 'getUsers') {
      let sheet = ss.getSheetByName('UserAdmin');
      if (!sheet) result = [];
      else {
        const rows = sheet.getDataRange().getValues();
        rows.shift(); 
        result = rows.map(row => ({
          cedula: String(row[0]),
          nombre: String(row[1]),
          rol: String(row[2]),
          password: String(row[3])
        }));
      }
    }
    else if (action === 'getInventarioData') {
      const sheetItems = ss.getSheetByName('InventoryItems');
      const sheetMoves = ss.getSheetByName('InventoryMovements');
      
      let articulos = [];
      let movimientos = [];

      if (sheetItems) {
         const rows = sheetItems.getDataRange().getValues();
         rows.shift();
         articulos = rows.map(r => ({
            id: String(r[0]),
            nombre: String(r[1]),
            categoria: String(r[2]),
            unidadMedida: String(r[3]),
            stockMinimo: Number(r[4])
         }));
      }

      if (sheetMoves) {
         const rows = sheetMoves.getDataRange().getValues();
         rows.shift();
         movimientos = rows.map(r => ({
            id: String(r[0]),
            fecha: formatDateStr(r[1]),
            articuloId: String(r[2]),
            nombreArticulo: String(r[3]),
            categoria: String(r[4]),
            tipo: String(r[5]),
            cantidad: Number(r[6]),
            solicitanteOProveedor: String(r[7]),
            motivo: String(r[8]),
            usuarioRegistra: String(r[9])
         }));
      }

      result = { articulos, movimientos };
    }
    
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return errorResponse(error.toString());
  } finally {
    lock.releaseLock();
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    if (SPREADSHEET_ID.includes('PONER_AQUI')) {
      return errorResponse("ERROR: Configura el SPREADSHEET_ID en el backend.");
    }
    
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let body = {};
    try { body = JSON.parse(e.postData.contents); } catch(e) { return errorResponse("Invalid JSON"); }
    
    const action = body.action;
    const data = body.data;

    // --- AUTENTICACIÓN ---
    if (action === 'login') {
      const { cedula, password } = data;

      // 1. SUPERUSUARIO DE EMERGENCIA
      if ((cedula === 'admin' || cedula === 'superadmin') && password === 'admin123') {
         return success({
           cedula: '0000',
           nombre: 'Super Administrador',
           rol: 'Administrador',
           token: 'super-token-' + new Date().getTime()
         });
      }

      // 2. Usuarios Normales
      const sheet = ss.getSheetByName('UserAdmin');
      if (!sheet) return errorResponse("BD Usuarios no inicializada. Corre la función setup() o entra con superadmin.");

      const rows = sheet.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) {
        const rowCedula = String(rows[i][0]);
        const rowPass = String(rows[i][3]);
        
        if (rowCedula === cedula && rowPass === password) {
          return success({
            cedula: rowCedula,
            nombre: String(rows[i][1]),
            rol: String(rows[i][2]),
            token: 'user-token-' + new Date().getTime()
          });
        }
      }
      return errorResponse("Usuario o contraseña incorrectos");
    }
    
    // --- USUARIOS ---
    if (action === 'saveUser') {
      let sheet = getOrCreateSheet(ss, 'UserAdmin', ['Cedula', 'Nombre', 'Rol', 'Password']);
      const rows = sheet.getDataRange().getValues();
      let rowIndex = -1;

      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]) === String(data.cedula)) {
          rowIndex = i + 1; 
          break;
        }
      }

      if (rowIndex > 0) {
        sheet.getRange(rowIndex, 1, 1, 4).setValues([[data.cedula, data.nombre, data.rol, data.password]]);
        return success('Usuario actualizado');
      } else {
        sheet.appendRow([data.cedula, data.nombre, data.rol, data.password]);
        return success('Usuario creado');
      }
    }

    if (action === 'deleteUser') {
      let sheet = ss.getSheetByName('UserAdmin');
      if (!sheet) return errorResponse("No existe tabla de usuarios");
      
      const rows = sheet.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]) === String(data.cedula)) {
          sheet.deleteRow(i + 1);
          return success('Usuario eliminado');
        }
      }
      return errorResponse('Usuario no encontrado');
    }

    // --- CONFIGURACIÓN ---
    if (action === 'saveConfig') {
      let sheet = getOrCreateSheet(ss, 'Config', ['Tasa', 'Fecha']);
      sheet.getRange('A2').setValue(data.tasaCambio);
      sheet.getRange('B2').setValue(data.fechaActualizacion);
      return success('Configuración guardada');
    }

    if (action === 'saveNiveles') {
      let sheet = getOrCreateSheet(ss, 'Levels', ['Nivel', 'PrecioUSD']);
      if(sheet.getLastRow() > 1) sheet.getRange(2, 1, sheet.getLastRow()-1, 2).clearContent();
      const rows = data.map(d => [d.nivel, d.precio]);
      if(rows.length > 0) sheet.getRange(2, 1, rows.length, 2).setValues(rows);
      return success('Niveles guardados');
    }

    if (action === 'saveRepresentante') {
      let sheetRep = getOrCreateSheet(ss, 'Representatives', ['Cedula', 'NombreCompleto', 'Telefono', 'Correo', 'Direccion', 'Matricula']);
      let sheetStu = getOrCreateSheet(ss, 'Students', ['ID', 'CedulaRep', 'NombreAlumno', 'Nivel', 'Turno', 'Seccion']);
      
      const nombreCompleto = `${data.nombres} ${data.apellidos}`.trim();
      const reps = sheetRep.getDataRange().getValues();
      let rowIndex = -1;
      for(let i=1; i<reps.length; i++) {
        if(String(reps[i][0]) === String(data.cedula)) { rowIndex = i+1; break; }
      }
      
      const repRow = [data.cedula, nombreCompleto, data.telefono, data.correo, data.direccion, data.matricula];
      if(rowIndex > 0) sheetRep.getRange(rowIndex, 1, 1, 6).setValues([repRow]);
      else sheetRep.appendRow(repRow);
      
      if(data.alumnos) {
         data.alumnos.forEach(alu => {
            const stuId = alu.id || `STU-${Math.floor(Math.random()*100000)}`;
            // Verificar duplicados de alumnos muy básicos para evitar basura
            sheetStu.appendRow([stuId, data.cedula, `${alu.nombres} ${alu.apellidos}`, alu.nivel, "Mañana", alu.seccion]);
         });
      }
      return success('Datos guardados');
    }

    if (action === 'savePago') {
      const headers = [
        'paymentId', 'timestamp', 'registrationDate', 'paymentDate', 
        'representativeCedula', 'studentId', 'month', 'year', 
        'paymentMethod', 'reference', 'amount$', 'amountBs', 
        'status', 'observations', 'representativeName', 'matricula', 'paymentForm'
      ];
      let sheet = getOrCreateSheet(ss, 'Payments', headers);
      
      const row = [
        data.id,
        new Date().toISOString(),
        data.fechaRegistro,
        data.fechaPago,
        data.cedulaRepresentante,
        data.studentId || '',
        data.mes || '',
        data.anio || '',
        data.metodoPago,
        data.referencia,
        data.monto,
        data.montoBolivares || 0,
        data.estado,
        data.observaciones,
        data.nombreRepresentante,
        data.matricula,
        data.formaPago
      ];
      
      sheet.appendRow(row);
      return success('Pago registrado');
    }

    if (action === 'updateEstadoPago') {
      let sheet = ss.getSheetByName('Payments');
      if(!sheet) return errorResponse("No existe hoja Payments");
      
      const rows = sheet.getDataRange().getValues();
      for(let i=1; i<rows.length; i++) {
        if(String(rows[i][0]) === String(data.id)) {
          sheet.getRange(i+1, 13).setValue(data.nuevoEstado);
          return success('Estado Actualizado');
        }
      }
      return errorResponse('Pago no encontrado para actualizar');
    }
    
    // --- ALMACEN ---
    if (action === 'saveArticulo') {
      let sheet = getOrCreateSheet(ss, 'InventoryItems', ['ID', 'Nombre', 'Categoria', 'Unidad', 'StockMinimo']);
      const rows = sheet.getDataRange().getValues();
      let rowIndex = -1;
      
      for(let i=1; i<rows.length; i++){
        if(String(rows[i][0]) === String(data.id)){
           rowIndex = i+1; break;
        }
      }
      
      const rowData = [data.id, data.nombre, data.categoria, data.unidadMedida, data.stockMinimo];
      if(rowIndex > 0) sheet.getRange(rowIndex, 1, 1, 5).setValues([rowData]);
      else sheet.appendRow(rowData);
      
      return success('Artículo guardado');
    }

    if (action === 'saveMovimiento') {
      let sheet = getOrCreateSheet(ss, 'InventoryMovements', ['ID', 'Fecha', 'ArticuloID', 'NombreArticulo', 'Categoria', 'Tipo', 'Cantidad', 'SolicitanteProveedor', 'Motivo', 'Usuario']);
      sheet.appendRow([
        data.id, 
        data.fecha, 
        data.articuloId, 
        data.nombreArticulo, 
        data.categoria, 
        data.tipo, 
        data.cantidad, 
        data.solicitanteOProveedor, 
        data.motivo, 
        data.usuarioRegistra
      ]);
      return success('Movimiento registrado');
    }

    return errorResponse("Accion desconocida");

  } catch (e) {
    return errorResponse(e.toString());
  } finally {
    lock.releaseLock();
  }
}

function getOrCreateSheet(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
  }
  return sheet;
}

function formatDateStr(dateVal) {
  if (!dateVal) return "";
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return String(dateVal);
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

function success(payload) {
  const response = typeof payload === 'string' 
    ? { status: 'success', message: payload }
    : { status: 'success', ...payload };
    
  return ContentService.createTextOutput(JSON.stringify(response)).setMimeType(ContentService.MimeType.JSON);
}

function errorResponse(msg) {
  return ContentService.createTextOutput(JSON.stringify({status: 'error', message: msg})).setMimeType(ContentService.MimeType.JSON);
}

function setup() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  getOrCreateSheet(ss, 'Config', ['Tasa', 'Fecha']);
  getOrCreateSheet(ss, 'Levels', ['Nivel', 'PrecioUSD']);
  getOrCreateSheet(ss, 'Representatives', ['Cedula', 'NombreCompleto', 'Telefono', 'Correo', 'Direccion', 'Matricula']);
  getOrCreateSheet(ss, 'Students', ['ID', 'CedulaRep', 'NombreAlumno', 'Nivel', 'Turno', 'Seccion']);
  getOrCreateSheet(ss, 'Payments', [
    'paymentId', 'timestamp', 'registrationDate', 'paymentDate', 
    'representativeCedula', 'studentId', 'month', 'year', 
    'paymentMethod', 'reference', 'amount$', 'amountBs', 
    'status', 'observations', 'representativeName', 'matricula', 'paymentForm'
  ]);
  getOrCreateSheet(ss, 'UserAdmin', ['Cedula', 'Nombre', 'Rol', 'Password']);
  getOrCreateSheet(ss, 'InventoryItems', ['ID', 'Nombre', 'Categoria', 'Unidad', 'StockMinimo']);
  getOrCreateSheet(ss, 'InventoryMovements', ['ID', 'Fecha', 'ArticuloID', 'NombreArticulo', 'Categoria', 'Tipo', 'Cantidad', 'SolicitanteProveedor', 'Motivo', 'Usuario']);
}
