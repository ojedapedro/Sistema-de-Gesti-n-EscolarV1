
// --- CONFIGURACIÓN OBLIGATORIA ---
// 1. Abre tu hoja de cálculo en el navegador.
// 2. Mira la URL: https://docs.google.com/spreadsheets/d/1abc123.../edit
// 3. Copia el texto largo entre '/d/' y '/edit'. ESE ES EL ID.
// 4. Pégalo abajo dentro de las comillas.

const SPREADSHEET_ID = 'PONER_AQUI_EL_ID_DE_TU_HOJA_DE_CALCULO'; 

function doGet(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);
  
  try {
    validarSpreadsheetId();
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
          email: String(row[0]), // Column A: Email
          nombre: String(row[1]),
          rol: String(row[2]),
          // password: String(row[3]), // No devolvemos password en lista
          cedula: String(row[4] || '')
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
            usuarioRegistra: String(r[9]),
            costoTotal: Number(r[10] || 0),
            precioUnitario: Number(r[11] || 0)
         }));
      }

      result = { articulos, movimientos };
    }
    else if (action === 'getEmpleados') {
       const sheet = ss.getSheetByName('Employees');
       if (!sheet) result = [];
       else {
         const rows = sheet.getDataRange().getValues();
         rows.shift();
         result = rows.map(r => ({
           id: String(r[0]),
           cedula: String(r[1]),
           nombres: String(r[2]),
           apellidos: String(r[3]),
           departamento: String(r[4]),
           cargo: String(r[5]),
           fechaIngreso: formatDateStr(r[6]),
           sueldoBase: Number(r[7] || 0),
           bono: Number(r[8] || 0),
           diasVacacionesPendientes: Number(r[9] || 0),
           estado: String(r[10] || 'ACTIVO')
         }));
       }
    }
    else if (action === 'getNominaHistory') {
       const sheet = ss.getSheetByName('PayrollHistory');
       if (!sheet) result = [];
       else {
         const rows = sheet.getDataRange().getValues();
         rows.shift();
         result = rows.map(r => ({
           id: String(r[0]),
           empleadoId: String(r[1]),
           nombreCompleto: String(r[2]),
           cedula: String(r[3]),
           cargo: String(r[4]),
           periodo: String(r[5]),
           fechaPago: formatDateStr(r[6]),
           sueldoBase: Number(r[7] || 0),
           bono: Number(r[8] || 0),
           asignacionesExtra: Number(r[9] || 0),
           deduccionSSO: Number(r[10] || 0),
           deduccionSPF: Number(r[11] || 0),
           deduccionFAOV: Number(r[12] || 0),
           otrasDeducciones: Number(r[13] || 0),
           totalPagar: Number(r[14] || 0)
         }));
       }
    }
    else if (action === 'getPagosServicios') {
       const sheet = ss.getSheetByName('ServicePayments');
       if (!sheet) result = [];
       else {
         const rows = sheet.getDataRange().getValues();
         rows.shift();
         result = rows.map(r => ({
           id: String(r[0]),
           categoria: String(r[1]),
           proveedor: String(r[2]),
           descripcion: String(r[3]),
           fechaVencimiento: formatDateStr(r[4]),
           fechaPago: formatDateStr(r[5]),
           monto: Number(r[6] || 0),
           montoBolivares: Number(r[7] || 0),
           tasaCambio: Number(r[8] || 0),
           metodoPago: String(r[9]),
           referencia: String(r[10]),
           estado: String(r[11]),
           registradoPor: String(r[12])
         }));
       }
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
    validarSpreadsheetId();
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let body = {};
    try { body = JSON.parse(e.postData.contents); } catch(e) { return errorResponse("Invalid JSON"); }
    
    const action = body.action;
    const data = body.data;

    // --- AUTENTICACIÓN ---
    if (action === 'login') {
      const { email, password } = data;

      // 1. SUPERUSUARIOS DE SISTEMA (Hardcoded)
      if ((email === 'admin@admin.com') && password === 'admin123') {
         return success({
           email: 'admin@admin.com',
           nombre: 'Super Administrador',
           rol: 'Administrador',
           token: 'super-token-' + new Date().getTime()
         });
      }

      // Nuevo Super Usuario Solicitado
      if ((email === 'analistadedatosnova@gmail.com') && password === 'Gene.2302') {
         return success({
           email: 'analistadedatosnova@gmail.com',
           nombre: 'Soporte Nova',
           rol: 'Administrador',
           token: 'nova-token-' + new Date().getTime()
         });
      }

      // 2. Usuarios Normales (Email en Columna A)
      const sheet = ss.getSheetByName('UserAdmin');
      if (!sheet) return errorResponse("BD Usuarios no inicializada.");

      const rows = sheet.getDataRange().getValues();
      // Empezar en 1 para saltar header
      for (let i = 1; i < rows.length; i++) {
        const rowEmail = String(rows[i][0]).trim().toLowerCase();
        const rowPass = String(rows[i][3]);
        
        if (rowEmail === email.trim().toLowerCase() && rowPass === password) {
          return success({
            email: rowEmail,
            nombre: String(rows[i][1]),
            rol: String(rows[i][2]),
            cedula: String(rows[i][4] || ''),
            token: 'user-token-' + new Date().getTime()
          });
        }
      }
      return errorResponse("Correo electrónico o contraseña incorrectos");
    }

    if (action === 'recoverPassword') {
      const { email } = data;
      const sheet = ss.getSheetByName('UserAdmin');
      if (!sheet) return errorResponse("BD no inicializada.");

      const rows = sheet.getDataRange().getValues();
      let foundUser = null;

      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]).trim().toLowerCase() === email.trim().toLowerCase()) {
          foundUser = {
            nombre: rows[i][1],
            password: rows[i][3]
          };
          break;
        }
      }

      if (foundUser) {
        // Enviar correo (Requiere permisos de MailApp)
        try {
          MailApp.sendEmail({
            to: email,
            subject: "Recuperación de Contraseña - AdminPro",
            htmlBody: `
              <h3>Hola ${foundUser.nombre},</h3>
              <p>Has solicitado recuperar tu contraseña para el sistema de gestión escolar.</p>
              <p>Tus credenciales son:</p>
              <ul>
                <li><b>Usuario:</b> ${email}</li>
                <li><b>Contraseña:</b> ${foundUser.password}</li>
              </ul>
              <p>Por seguridad, te recomendamos eliminar este correo una vez hayas ingresado.</p>
              <hr>
              <small>Sistema AdminPro</small>
            `
          });
          return success({ message: "Correo de recuperación enviado exitosamente." });
        } catch (mailError) {
          return errorResponse("Error enviando el correo: " + mailError.toString());
        }
      } else {
        return errorResponse("El correo no se encuentra registrado en el sistema.");
      }
    }
    
    // --- USUARIOS ---
    if (action === 'saveUser') {
      let sheet = getOrCreateSheet(ss, 'UserAdmin', ['Email', 'Nombre', 'Rol', 'Password', 'Cedula']);
      const rows = sheet.getDataRange().getValues();
      let rowIndex = -1;

      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]).trim().toLowerCase() === String(data.email).trim().toLowerCase()) {
          rowIndex = i + 1; 
          break;
        }
      }

      if (rowIndex > 0) {
        // Actualizar (Manteniendo la fila, sobreescribiendo datos)
        // Col A: Email, Col B: Nombre, Col C: Rol, Col D: Password, Col E: Cedula
        sheet.getRange(rowIndex, 1, 1, 5).setValues([[data.email, data.nombre, data.rol, data.password, data.cedula || '']]);
        return success('Usuario actualizado');
      } else {
        sheet.appendRow([data.email, data.nombre, data.rol, data.password, data.cedula || '']);
        return success('Usuario creado');
      }
    }

    if (action === 'deleteUser') {
      let sheet = ss.getSheetByName('UserAdmin');
      if (!sheet) return errorResponse("No existe tabla de usuarios");
      
      const rows = sheet.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]).trim().toLowerCase() === String(data.email).trim().toLowerCase()) {
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
      let sheet = getOrCreateSheet(ss, 'InventoryMovements', ['ID', 'Fecha', 'ArticuloID', 'NombreArticulo', 'Categoria', 'Tipo', 'Cantidad', 'SolicitanteProveedor', 'Motivo', 'Usuario', 'CostoTotal', 'PrecioUnitario']);
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
        data.usuarioRegistra,
        data.costoTotal || 0,
        data.precioUnitario || 0
      ]);
      return success('Movimiento registrado');
    }

    if (action === 'saveMovimientoBatch') {
      let sheet = getOrCreateSheet(ss, 'InventoryMovements', ['ID', 'Fecha', 'ArticuloID', 'NombreArticulo', 'Categoria', 'Tipo', 'Cantidad', 'SolicitanteProveedor', 'Motivo', 'Usuario', 'CostoTotal', 'PrecioUnitario']);
      if (!Array.isArray(data)) return errorResponse("Data debe ser un array");
      
      data.forEach(m => {
        sheet.appendRow([
          m.id, 
          m.fecha, 
          m.articuloId, 
          m.nombreArticulo, 
          m.categoria, 
          m.tipo, 
          m.cantidad, 
          m.solicitanteOProveedor, 
          m.motivo, 
          m.usuarioRegistra,
          m.costoTotal || 0,
          m.precioUnitario || 0
        ]);
      });
      return success('Movimientos registrados en lote');
    }
    
    // --- EMPLEADOS ---
    if (action === 'saveEmpleado') {
      let sheet = getOrCreateSheet(ss, 'Employees', ['ID', 'Cedula', 'Nombres', 'Apellidos', 'Departamento', 'Cargo', 'FechaIngreso', 'Sueldo', 'Bono', 'Vacaciones', 'Estado']);
      const rows = sheet.getDataRange().getValues();
      let rowIndex = -1;

      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]) === String(data.id)) {
          rowIndex = i + 1;
          break;
        }
      }
      
      const rowData = [data.id, data.cedula, data.nombres, data.apellidos, data.departamento, data.cargo, data.fechaIngreso, data.sueldoBase, data.bono, data.diasVacacionesPendientes, data.estado];
      
      if (rowIndex > 0) sheet.getRange(rowIndex, 1, 1, 11).setValues([rowData]);
      else sheet.appendRow(rowData);
      
      return success('Empleado guardado');
    }

    if (action === 'saveNominaBatch') {
      let sheet = getOrCreateSheet(ss, 'PayrollHistory', [
          'ID', 'EmpleadoID', 'Nombre', 'Cedula', 'Cargo', 'Periodo', 'FechaPago', 
          'SueldoBase', 'Bono', 'Extra', 'DeduccionSSO', 'DeduccionSPF', 'DeduccionFAOV', 'OtrasDeducciones', 'Total'
      ]);
      
      if (!Array.isArray(data)) return errorResponse("Data debe ser un array");

      data.forEach(item => {
        sheet.appendRow([
          item.id,
          item.empleadoId,
          item.nombreCompleto,
          item.cedula,
          item.cargo,
          item.periodo,
          item.fechaPago,
          item.sueldoBase,
          item.bono,
          item.asignacionesExtra,
          item.deduccionSSO,
          item.deduccionSPF,
          item.deduccionFAOV,
          item.otrasDeducciones,
          item.totalPagar
        ]);
      });

      return success('Nómina guardada');
    }

    if (action === 'savePagoServicio') {
      let sheet = getOrCreateSheet(ss, 'ServicePayments', [
        'ID', 'Categoria', 'Proveedor', 'Descripcion', 'FechaVencimiento', 
        'FechaPago', 'MontoUSD', 'MontoBS', 'Tasa', 'Metodo', 'Referencia', 'Estado', 'RegistradoPor'
      ]);
      
      const row = [
        data.id, data.categoria, data.proveedor, data.descripcion, data.fechaVencimiento,
        data.fechaPago, data.monto, data.montoBolivares, data.tasaCambio, data.metodoPago,
        data.referencia, data.estado, data.registradoPor
      ];
      
      sheet.appendRow(row);
      return success('Pago de servicio registrado');
    }

    return errorResponse("Accion desconocida");

  } catch (e) {
    return errorResponse(e.toString());
  } finally {
    lock.releaseLock();
  }
}

function validarSpreadsheetId() {
  if (!SPREADSHEET_ID || SPREADSHEET_ID.includes('PONER_AQUI')) {
    throw new Error("ERROR DE CONFIGURACIÓN: No has configurado el SPREADSHEET_ID en el archivo Código.gs. Por favor, abre el script, pega el ID de tu hoja de cálculo en la línea 9 y vuelve a implementar.");
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
  validarSpreadsheetId();
  let ss;
  try {
    ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  } catch (e) {
    throw new Error("ERROR DE CONEXIÓN: El ID '" + SPREADSHEET_ID + "' no es válido o no tienes permisos para acceder a esta hoja. Verifica que copiaste solo el ID (cadena alfanumérica) y no la URL completa.");
  }

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
  // Tabla UserAdmin Actualizada: Email en Col A
  getOrCreateSheet(ss, 'UserAdmin', ['Email', 'Nombre', 'Rol', 'Password', 'Cedula']);
  
  getOrCreateSheet(ss, 'InventoryItems', ['ID', 'Nombre', 'Categoria', 'Unidad', 'StockMinimo']);
  getOrCreateSheet(ss, 'InventoryMovements', ['ID', 'Fecha', 'ArticuloID', 'NombreArticulo', 'Categoria', 'Tipo', 'Cantidad', 'SolicitanteProveedor', 'Motivo', 'Usuario', 'CostoTotal', 'PrecioUnitario']);
  getOrCreateSheet(ss, 'Employees', ['ID', 'Cedula', 'Nombres', 'Apellidos', 'Departamento', 'Cargo', 'FechaIngreso', 'Sueldo', 'Bono', 'Vacaciones', 'Estado']);
  getOrCreateSheet(ss, 'PayrollHistory', [
    'ID', 'EmpleadoID', 'Nombre', 'Cedula', 'Cargo', 'Periodo', 'FechaPago', 
    'SueldoBase', 'Bono', 'Extra', 'DeduccionSSO', 'DeduccionSPF', 'DeduccionFAOV', 'OtrasDeducciones', 'Total'
  ]);
  getOrCreateSheet(ss, 'ServicePayments', [
    'ID', 'Categoria', 'Proveedor', 'Descripcion', 'FechaVencimiento', 
    'FechaPago', 'MontoUSD', 'MontoBS', 'Tasa', 'Metodo', 'Referencia', 'Estado', 'RegistradoPor'
  ]);
}
