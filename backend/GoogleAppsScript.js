// ID de la Hoja de Cálculo proporcionado
const SPREADSHEET_ID = '13pCWr4GvNgysOCddPLhkgsj6iVNwfbrE9JyAJIJPhgs';

function doGet(e) {
  const action = e.parameter.action;
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  let result = {};
  
  try {
    if (action === 'getConfig') {
      const sheet = ss.getSheetByName('Config');
      const data = sheet.getDataRange().getValues();
      // Asumimos fila 2: [Tasa, Fecha]
      result = {
        tasaCambio: data[1] ? Number(data[1][0]) : 0,
        fechaActualizacion: data[1] ? data[1][1] : new Date().toISOString()
      };
    } 
    else if (action === 'getRepresentantes') {
      const sheet = ss.getSheetByName('Representantes');
      const rows = sheet.getDataRange().getValues();
      const headers = rows.shift(); // Remover headers
      
      result = rows.map(row => {
        // Reconstruir objeto. Nota: Alumnos se guarda como JSON string para simplificar
        return {
          cedula: String(row[0]),
          nombres: row[1],
          apellidos: row[2],
          telefono: row[3],
          correo: row[4],
          direccion: row[5],
          matricula: row[6],
          alumnos: row[7] ? JSON.parse(row[7]) : []
        };
      }).filter(r => r.cedula); // Filtrar filas vacías
    }
    else if (action === 'getPagos') {
      const sheet = ss.getSheetByName('Pagos');
      const rows = sheet.getDataRange().getValues();
      const headers = rows.shift();
      
      result = rows.map((row, index) => ({
        id: String(index + 2), // ID basado en fila para referencia simple
        timestamp: row[0],
        fechaRegistro: row[1], // Fecha Registro
        fechaPago: row[2],     // Fecha Pago
        cedulaRepresentante: String(row[3]),
        nombreRepresentante: row[4],
        nivel: row[5],
        matricula: row[6],
        tipoPago: row[7],
        referencia: String(row[8]),
        monto: Number(row[9]),
        observaciones: row[10],
        metodoPago: row[11],
        estado: row[12] || 'Pendiente Verificación',
        montoBolivares: row[13] ? Number(row[13]) : 0
      })).filter(p => p.cedulaRepresentante);
    }
    
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({error: error.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const body = JSON.parse(e.postData.contents);
  const action = body.action;
  const data = body.data;
  
  try {
    if (action === 'saveConfig') {
      const sheet = ss.getSheetByName('Config');
      sheet.getRange('A2').setValue(data.tasaCambio);
      sheet.getRange('B2').setValue(data.fechaActualizacion);
      return success('Configuración guardada');
    }
    
    if (action === 'saveRepresentante') {
      const sheet = ss.getSheetByName('Representantes');
      // Buscar si existe para actualizar, sino agregar
      const textFinder = sheet.createTextFinder(data.cedula).matchEntireCell(true);
      const firstOccur = textFinder.findNext();
      
      const rowData = [
        data.cedula,
        data.nombres,
        data.apellidos,
        data.telefono,
        data.correo,
        data.direccion,
        data.matricula,
        JSON.stringify(data.alumnos)
      ];
      
      if (firstOccur) {
        // Actualizar
        const row = firstOccur.getRow();
        sheet.getRange(row, 1, 1, rowData.length).setValues([rowData]);
      } else {
        // Nuevo
        sheet.appendRow(rowData);
      }
      return success('Representante guardado');
    }
    
    if (action === 'savePago') {
      const sheet = ss.getSheetByName('Pagos');
      // Estructura solicitada + campos extra de la app
      // Timestamp, F.Reg, F.Pago, Cedula, Nombre, Nivel, Matricula, Tipo, Ref, Monto, Obs, Metodo, Estado, MontoBs
      const rowData = [
        data.timestamp,
        data.fechaRegistro,
        data.fechaPago,
        data.cedulaRepresentante,
        data.nombreRepresentante,
        data.nivel,
        data.matricula,
        data.tipoPago,
        data.referencia,
        data.monto,
        data.observaciones,
        data.metodoPago, // Extra para app interna
        data.estado,      // Extra para app interna
        data.montoBolivares
      ];
      sheet.appendRow(rowData);
      return success('Pago registrado');
    }
    
    if (action === 'updateEstadoPago') {
      const sheet = ss.getSheetByName('Pagos');
      // data.id asumimos que es el numero de fila (offset +2 porque headers + 1 index)
      // Nota: En un sistema real usaríamos un ID único (UUID) y buscaríamos la fila.
      // Para este ejemplo, usaremos búsqueda por referencia y timestamp para ser más seguros que el índice de fila
      
      const allData = sheet.getDataRange().getValues();
      // Buscamos coincidencia (Filas comienzan en 0 en el array, Headers es 0)
      // La columna Referencia es la I (index 8) y Timestamp la A (index 0)
      
      let rowIndex = -1;
      // Empezamos en 1 para saltar header
      for (let i = 1; i < allData.length; i++) {
        if (String(allData[i][8]) === String(data.referencia) && 
            String(allData[i][3]) === String(data.cedulaRepresentante)) {
          rowIndex = i + 1; // +1 porque Sheet es 1-based
          break;
        }
      }
      
      if (rowIndex > 0) {
        sheet.getRange(rowIndex, 13).setValue(data.nuevoEstado); // Columna M (Estado)
        return success('Estado actualizado');
      } else {
        return errorResponse('Pago no encontrado para actualizar');
      }
    }
    
  } catch (err) {
    return errorResponse(err.toString());
  }
}

function success(msg) {
  return ContentService.createTextOutput(JSON.stringify({status: 'success', message: msg}))
    .setMimeType(ContentService.MimeType.JSON);
}

function errorResponse(msg) {
  return ContentService.createTextOutput(JSON.stringify({status: 'error', message: msg}))
    .setMimeType(ContentService.MimeType.JSON);
}

// EJECUTAR ESTA FUNCION UNA VEZ PARA CREAR LA ESTRUCTURA
function setup() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  // 1. Hoja Config
  let sheetConfig = ss.getSheetByName('Config');
  if (!sheetConfig) {
    sheetConfig = ss.insertSheet('Config');
    sheetConfig.appendRow(['TasaCambio', 'FechaActualizacion']);
    sheetConfig.appendRow([60.00, new Date().toISOString()]);
  }
  
  // 2. Hoja Representantes
  let sheetRep = ss.getSheetByName('Representantes');
  if (!sheetRep) {
    sheetRep = ss.insertSheet('Representantes');
    sheetRep.appendRow(['Cedula', 'Nombres', 'Apellidos', 'Telefono', 'Correo', 'Direccion', 'Matricula', 'Alumnos_JSON']);
  }
  
  // 3. Hoja Pagos (Estructura Oficina Virtual compatible)
  let sheetPagos = ss.getSheetByName('Pagos');
  if (!sheetPagos) {
    sheetPagos = ss.insertSheet('Pagos');
    // Timestamp Fecha Registro Fecha Pago Cedula Representante, nombre del representante Nivel Matricula Tipo Pago Referencia Monto Observaciones
    // Agregamos al final MetodoPago, Estado, MontoBs para control interno
    sheetPagos.appendRow([
      'Timestamp', 
      'Fecha Registro', 
      'Fecha Pago', 
      'Cedula Representante', 
      'Nombre Representante', 
      'Nivel', 
      'Matricula', 
      'Tipo Pago', 
      'Referencia', 
      'Monto', 
      'Observaciones',
      'Metodo Pago',
      'Estado',
      'Monto Bolivares'
    ]);
  }
}