// ID de la Hoja de Cálculo
const SPREADSHEET_ID = '13pCWr4GvNgysOCddPLhkgsj6iVNwfbrE9JyAJIJPhgs';

function doGet(e) {
  const action = e.parameter.action;
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  let result = {};
  
  try {
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
        
        // Mapeo EXACTO según la imagen proporcionada (Cols A-Q)
        // A=0, B=1, ... M=12 (Status), N=13, O=14, P=15, Q=16
        result = rows.map(row => ({
          id: String(row[0]),                  // A: paymentId
          timestamp: row[1],                   // B: timestamp
          fechaRegistro: formatDateStr(row[2]),// C: registrationDate
          fechaPago: formatDateStr(row[3]),    // D: paymentDate
          cedulaRepresentante: String(row[4]), // E: representativeCedula
          studentId: String(row[5] || ''),     // F: studentId
          mes: String(row[6] || ''),           // G: month
          anio: String(row[7] || ''),          // H: year
          metodoPago: row[8],                  // I: paymentMethod
          referencia: String(row[9]),          // J: reference
          monto: Number(row[10]),              // K: amount$
          montoBolivares: Number(row[11] || 0),// L: amountBs
          estado: row[12],                     // M: status
          observaciones: String(row[13]),      // N: observations
          nombreRepresentante: String(row[14]),// O: representativeName
          matricula: String(row[15]),          // P: matricula
          formaPago: String(row[16] || '')     // Q: paymentForm
        }));
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({status: 'error', message: error.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let body = {};
  try { body = JSON.parse(e.postData.contents); } catch(e) { return errorResponse("Invalid JSON"); }
  
  const action = body.action;
  const data = body.data;

  try {
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
        data.id,                     // A
        new Date().toISOString(),    // B
        data.fechaRegistro,          // C
        data.fechaPago,              // D
        data.cedulaRepresentante,    // E
        data.studentId || '',        // F
        data.mes || '',              // G
        data.anio || '',             // H
        data.metodoPago,             // I
        data.referencia,             // J
        data.monto,                  // K (USD)
        data.montoBolivares || 0,    // L (Bs)
        data.estado,                 // M
        data.observaciones,          // N
        data.nombreRepresentante,    // O
        data.matricula,              // P
        data.formaPago               // Q
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
          // Status está en Columna M, que es la columna 13
          sheet.getRange(i+1, 13).setValue(data.nuevoEstado);
          return success('Estado Actualizado');
        }
      }
      return errorResponse('Pago no encontrado para actualizar');
    }

    return errorResponse("Accion desconocida");

  } catch (e) {
    return errorResponse(e.toString());
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

function success(msg) {
  return ContentService.createTextOutput(JSON.stringify({status: 'success', message: msg})).setMimeType(ContentService.MimeType.JSON);
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
}