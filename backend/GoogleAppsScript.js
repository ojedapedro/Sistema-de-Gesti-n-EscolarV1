// ID de la Hoja de Cálculo (Extraído del link proporcionado)
const SPREADSHEET_ID = '13pCWr4GvNgysOCddPLhkgsj6iVNwfbrE9JyAJIJPhgs';

function doGet(e) {
  const action = e.parameter.action;
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  let result = {};
  
  try {
    if (action === 'getConfig') {
      // 1. Obtener Configuración General (Tasa)
      let sheetConfig = ss.getSheetByName('Config');
      if (!sheetConfig) {
        result = { tasaCambio: 60, fechaActualizacion: new Date().toISOString() };
      } else {
        const data = sheetConfig.getDataRange().getValues();
        result = {
          tasaCambio: data[1] ? Number(data[1][0]) : 0,
          fechaActualizacion: data[1] ? data[1][1] : new Date().toISOString()
        };
      }
    }
    else if (action === 'getNiveles') {
      // 2. Obtener Precios por Nivel
      let sheetLevels = ss.getSheetByName('Levels');
      if (!sheetLevels) {
        // Retornar vacío si no existe, el frontend manejará defaults
        result = [];
      } else {
        const rows = sheetLevels.getDataRange().getValues();
        rows.shift(); // Eliminar headers
        result = rows.map(row => ({
          nivel: String(row[0]),
          precio: Number(row[1])
        }));
      }
    }
    else if (action === 'getRepresentantes') {
      const sheetRep = ss.getSheetByName('Representatives');
      const dataRep = sheetRep.getDataRange().getValues();
      dataRep.shift(); 
      
      const sheetStu = ss.getSheetByName('Students');
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
        const nameParts = fullName.split(' ');
        
        return {
          cedula: cedula,
          nombres: nameParts[0] || fullName,
          apellidos: nameParts.slice(1).join(' ') || "",
          telefono: row[2],
          correo: row[3],
          direccion: row[4],
          matricula: row[5],
          alumnos: studentsMap[cedula] || []
        };
      }).filter(r => r.cedula && r.cedula !== "");
    }
    else if (action === 'getPagos') {
      const sheet = ss.getSheetByName('Payments');
      const rows = sheet.getDataRange().getValues();
      rows.shift(); 
      
      result = rows.map(row => ({
        id: String(row[0]),
        timestamp: row[1],
        fechaRegistro: row[2] ? formatDate(new Date(row[2])) : '', 
        fechaPago: row[3] ? formatDate(new Date(row[3])) : '',
        cedulaRepresentante: String(row[4]),
        nombreRepresentante: "Cargando...", 
        nivel: "General",
        matricula: "", 
        tipoPago: "Abono",
        metodoPago: row[8],
        referencia: String(row[9]),
        monto: Number(row[10]),
        observaciones: row[12],
        estado: row[11] || 'Pendiente Verificación',
        montoBolivares: 0 
      })).filter(p => p.id && p.id !== "");
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
      let sheet = ss.getSheetByName('Config');
      if (!sheet) {
        sheet = ss.insertSheet('Config');
        sheet.appendRow(['Tasa', 'Fecha']);
      }
      sheet.getRange('A2').setValue(data.tasaCambio);
      sheet.getRange('B2').setValue(data.fechaActualizacion);
      return success('Configuración guardada');
    }

    if (action === 'saveNiveles') {
      let sheet = ss.getSheetByName('Levels');
      if (!sheet) {
        sheet = ss.insertSheet('Levels');
        sheet.appendRow(['Level', 'PriceUSD']);
      }
      
      // Limpiar datos existentes (menos header)
      const lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        sheet.getRange(2, 1, lastRow - 1, 2).clearContent();
      }
      
      // Escribir nuevos datos
      // data debe ser un array de objetos {nivel, precio}
      const rows = data.map(item => [item.nivel, item.precio]);
      if (rows.length > 0) {
        sheet.getRange(2, 1, rows.length, 2).setValues(rows);
      }
      
      return success('Precios actualizados');
    }
    
    if (action === 'saveRepresentante') {
      const sheetRep = ss.getSheetByName('Representatives');
      const sheetStu = ss.getSheetByName('Students');
      const fullName = `${data.nombres} ${data.apellidos}`.trim();
      
      const reps = sheetRep.getDataRange().getValues();
      let repRowIndex = -1;
      for(let i=1; i<reps.length; i++) {
        if(String(reps[i][0]) === String(data.cedula)) {
          repRowIndex = i + 1;
          break;
        }
      }
      
      const repData = [data.cedula, fullName, data.telefono, data.correo, data.direccion, data.matricula];
      
      if (repRowIndex > 0) {
        sheetRep.getRange(repRowIndex, 1, 1, 6).setValues([repData]);
      } else {
        sheetRep.appendRow(repData);
      }
      
      if (data.alumnos && data.alumnos.length > 0) {
        data.alumnos.forEach(alu => {
          const stuId = alu.id || `${data.cedula}-${Math.floor(Math.random()*1000)}`;
          const stuName = `${alu.nombres} ${alu.apellidos}`.trim();
          sheetStu.appendRow([
            stuId,
            data.cedula,
            stuName,
            alu.nivel, 
            "N/A",     
            alu.seccion
          ]);
        });
      }
      return success('Familia registrada correctamente');
    }
    
    if (action === 'savePago') {
      const sheet = ss.getSheetByName('Payments');
      const dateObj = new Date(data.fechaPago);
      const month = dateObj.getMonth() + 1;
      const year = dateObj.getFullYear();
      
      const rowData = [
        data.id,                     
        new Date().toISOString(),    
        data.fechaRegistro,          
        data.fechaPago,              
        data.cedulaRepresentante,    
        "",                          
        month,                       
        year,                        
        data.metodoPago,             
        data.referencia,             
        data.monto,                  
        data.estado,                 
        data.observaciones           
      ];
      sheet.appendRow(rowData);
      return success('Pago registrado');
    }
    
    if (action === 'updateEstadoPago') {
      const sheet = ss.getSheetByName('Payments');
      const rows = sheet.getDataRange().getValues();
      let rowIndex = -1;
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]) === String(data.id)) {
          rowIndex = i + 1;
          break;
        }
      }
      if (rowIndex > 0) {
        sheet.getRange(rowIndex, 12).setValue(data.nuevoEstado);
        return success('Estado actualizado');
      } else {
        return errorResponse('Pago no encontrado');
      }
    }
    
  } catch (err) {
    return errorResponse(err.toString());
  }
}

function formatDate(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function success(msg) {
  return ContentService.createTextOutput(JSON.stringify({status: 'success', message: msg}))
    .setMimeType(ContentService.MimeType.JSON);
}

function errorResponse(msg) {
  return ContentService.createTextOutput(JSON.stringify({status: 'error', message: msg}))
    .setMimeType(ContentService.MimeType.JSON);
}

function setup() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  if (!ss.getSheetByName('Config')) {
    const s = ss.insertSheet('Config');
    s.appendRow(['Tasa', 'Fecha']);
    s.appendRow([60, new Date()]);
  }
  if (!ss.getSheetByName('Levels')) {
    const s = ss.insertSheet('Levels');
    s.appendRow(['Level', 'PriceUSD']);
    // Valores por defecto
    s.appendRow(['Maternal', 120]);
    s.appendRow(['Pre-escolar 1er Nivel', 100]);
    s.appendRow(['Primaria 1er Grado', 110]);
    s.appendRow(['Secundaria 1er Año', 130]);
  }
}