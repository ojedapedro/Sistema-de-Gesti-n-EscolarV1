
import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Download, Bot, RefreshCw, Loader2, FileText, Filter, DollarSign, CheckCircle, XCircle, ChevronDown, ChevronUp, PieChart, TrendingUp, TrendingDown, Scale, AlertCircle, Sparkles } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { RegistroPago, Representante, EstadoPago, NivelConfig, NivelEducativo, PagoServicio, RegistroNomina, MovimientoInventario, TipoMovimiento } from '../types';
import { MENSUALIDADES, LOGO_URL } from '../constants';

type TipoReporte = 'TRANSACCIONES' | 'SOLVENCIA' | 'BALANCE';

// Interfaces para el detalle
interface DetalleAlumnoDeuda {
  nombre: string;
  nivel: string;
  seccion: string;
  costo: number;
  pagado: number;
  pendiente: number;
}

interface DeudaCalculada {
  cedula: string;
  nombre: string;
  matricula: string;
  totalAlumnos: number;
  deudaEsperada: number;
  totalPagado: number;
  saldoPendiente: number;
  esMoroso: boolean;
  detallesAlumnos: DetalleAlumnoDeuda[];
}

interface BalanceData {
    ingresosRepresentantes: number;
    egresosServicios: number;
    egresosNomina: number;
    egresosCompras: number;
    totalIngresos: number;
    totalEgresos: number;
    resultadoNeto: number;
    cuentasPorCobrar: number;
}

// Helper
const loadImage = (url: string): Promise<string | null> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = url;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } else {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
  });
};

export const Reportes: React.FC = () => {
  // Estado de Datos
  const [pagos, setPagos] = useState<RegistroPago[]>([]);
  const [representantes, setRepresentantes] = useState<Representante[]>([]);
  const [nivelesConfig, setNivelesConfig] = useState<NivelConfig[]>([]);
  const [solvencias, setSolvencias] = useState<DeudaCalculada[]>([]);
  
  // Datos para Balance
  const [pagosServicios, setPagosServicios] = useState<PagoServicio[]>([]);
  const [nominaHistory, setNominaHistory] = useState<RegistroNomina[]>([]);
  const [movimientosInv, setMovimientosInv] = useState<MovimientoInventario[]>([]);

  // Filtros
  const [tipoReporte, setTipoReporte] = useState<TipoReporte>('TRANSACCIONES');
  const [filtroCedula, setFiltroCedula] = useState('');
  
  // Fechas (Default: Mes Actual)
  const date = new Date();
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];

  const [filtroFechaInicio, setFiltroFechaInicio] = useState(firstDay);
  const [filtroFechaFin, setFiltroFechaFin] = useState(lastDay);
  
  const [filtroVerificacion, setFiltroVerificacion] = useState('TODOS'); 
  const [filtroEstadoSolvencia, setFiltroEstadoSolvencia] = useState('TODOS'); 
  const [filtroNivel, setFiltroNivel] = useState('TODOS');
  const [filtroSeccion, setFiltroSeccion] = useState('');

  // UI
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [aiSummary, setAiSummary] = useState<string>('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  
  // Verificación de existencia de Key (para mostrar UI)
  const hasApiKey = !!process.env.API_KEY;

  useEffect(() => {
    cargarDatosGenerales();
  }, []);

  const cargarDatosGenerales = async () => {
    setLoading(true);
    try {
      const [pData, rData, nData, sData, nomData, invData] = await Promise.all([
        db.getPagos(),
        db.getRepresentantes(),
        db.getNiveles(),
        db.getPagosServicios(),
        db.getNominaHistory(),
        db.getInventarioData()
      ]);
      
      setPagos(pData);
      setRepresentantes(rData);
      setNivelesConfig(nData);
      setPagosServicios(sData);
      setNominaHistory(nomData);
      setMovimientosInv(invData.movimientos);
      
      calcularSolvencias(rData, pData, nData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getMesesEscolares = () => {
    const now = new Date();
    const currentMonth = now.getMonth(); 
    let meses = 0;
    if (currentMonth >= 8) { 
       meses = currentMonth - 7; 
    } else { 
       meses = 4 + (currentMonth + 1);
    }
    return Math.max(1, meses);
  };

  const calcularSolvencias = (reps: Representante[], _pagos: RegistroPago[], niveles: NivelConfig[]) => {
    const mesesTranscurridos = getMesesEscolares();

    const resultados: DeudaCalculada[] = reps.map(rep => {
      let deudaEsperadaTotal = 0;
      
      const detallesAlumnos: DetalleAlumnoDeuda[] = rep.alumnos.map(alu => {
        const configNivel = niveles.find(n => n.nivel === alu.nivel);
        const precioMensual = configNivel ? (configNivel.precio || 0) : (MENSUALIDADES[alu.nivel] || 0);
        
        const costoTotalAlumno = precioMensual * mesesTranscurridos;
        deudaEsperadaTotal += costoTotalAlumno;

        const pagosEspecificos = _pagos
          .filter(p => p.cedulaRepresentante === rep.cedula && p.estado === EstadoPago.VERIFICADO && p.studentId === alu.id)
          .reduce((acc, p) => acc + (p.monto || 0), 0);
        
        return {
          nombre: `${alu.nombres} ${alu.apellidos}`,
          nivel: alu.nivel,
          seccion: alu.seccion,
          costo: costoTotalAlumno,
          pagado: pagosEspecificos,
          pendiente: Math.max(0, costoTotalAlumno - pagosEspecificos)
        };
      });

      let bolsaGeneral = _pagos
        .filter(p => p.cedulaRepresentante === rep.cedula && p.estado === EstadoPago.VERIFICADO && (!p.studentId || p.studentId === 'VARIOS'))
        .reduce((acc, p) => acc + (p.monto || 0), 0);

      detallesAlumnos.forEach(detalle => {
         if (bolsaGeneral > 0) {
             const deudaActual = detalle.pendiente;
             if (deudaActual > 0) {
                 const montoACubrir = Math.min(deudaActual, bolsaGeneral);
                 detalle.pagado += montoACubrir;
                 detalle.pendiente -= montoACubrir;
                 bolsaGeneral -= montoACubrir;
             }
         }
      });

      if (bolsaGeneral > 0 && detallesAlumnos.length > 0) {
          detallesAlumnos[0].pagado += bolsaGeneral;
      }

      const totalPagadoRep = _pagos
        .filter(p => p.cedulaRepresentante === rep.cedula && p.estado === EstadoPago.VERIFICADO)
        .reduce((acc, p) => acc + (p.monto || 0), 0);

      const saldoPendiente = Math.max(0, deudaEsperadaTotal - totalPagadoRep);

      return {
        cedula: rep.cedula,
        nombre: `${rep.nombres} ${rep.apellidos}`,
        matricula: rep.matricula,
        totalAlumnos: rep.alumnos.length,
        deudaEsperada: deudaEsperadaTotal,
        totalPagado: totalPagadoRep,
        saldoPendiente,
        esMoroso: saldoPendiente > 0,
        detallesAlumnos
      };
    });

    setSolvencias(resultados);
  };

  const getBalanceData = (): BalanceData => {
      const start = filtroFechaInicio;
      const end = filtroFechaFin;

      // 1. Ingresos (Pagos Representantes Verificados)
      const ingresosRep = pagos
          .filter(p => p.estado === EstadoPago.VERIFICADO && p.fechaRegistro >= start && p.fechaRegistro <= end)
          .reduce((acc, p) => acc + (p.monto || 0), 0);

      // 2. Egresos Servicios
      const egresosServ = pagosServicios
          .filter(p => p.estado === 'PAGADO' && p.fechaPago >= start && p.fechaPago <= end)
          .reduce((acc, p) => acc + (p.monto || 0), 0);

      // 3. Egresos Nomina
      const egresosNom = nominaHistory
          .filter(n => n.fechaPago >= start && n.fechaPago <= end)
          .reduce((acc, n) => acc + (n.totalPagar || 0), 0);

      // 4. Egresos Compras (Movimientos de Entrada con Costo)
      const egresosComp = movimientosInv
          .filter(m => m.tipo === TipoMovimiento.ENTRADA && m.fecha >= start && m.fecha <= end)
          .reduce((acc, m) => acc + (m.costoTotal || 0), 0);

      const totalEgresos = egresosServ + egresosNom + egresosComp;

      // 5. Cuentas por Cobrar (Deuda Total Actual)
      const totalPorCobrar = solvencias.reduce((acc, s) => acc + s.saldoPendiente, 0);

      return {
          ingresosRepresentantes: ingresosRep,
          egresosServicios: egresosServ,
          egresosNomina: egresosNom,
          egresosCompras: egresosComp,
          totalIngresos: ingresosRep,
          totalEgresos: totalEgresos,
          resultadoNeto: ingresosRep - totalEgresos,
          cuentasPorCobrar: totalPorCobrar
      };
  };

  const toggleRow = (cedula: string) => {
    if (expandedRow === cedula) {
      setExpandedRow(null);
    } else {
      setExpandedRow(cedula);
    }
  };

  const obtenerDatosFiltrados = () => {
    if (tipoReporte === 'TRANSACCIONES') {
      return pagos.filter(p => {
        const cumpleCedula = filtroCedula ? p.cedulaRepresentante.includes(filtroCedula) : true;
        const cumpleEstado = filtroVerificacion === 'TODOS' 
          ? true 
          : (filtroVerificacion === 'PENDIENTE' ? p.estado === EstadoPago.PENDIENTE_VERIFICACION : p.estado === EstadoPago.VERIFICADO);
        
        let cumpleFecha = true;
        if (filtroFechaInicio) cumpleFecha = cumpleFecha && p.fechaRegistro >= filtroFechaInicio;
        if (filtroFechaFin) cumpleFecha = cumpleFecha && p.fechaRegistro <= filtroFechaFin;

        return cumpleCedula && cumpleEstado && cumpleFecha;
      }).sort((a,b) => new Date(b.fechaRegistro).getTime() - new Date(a.fechaRegistro).getTime());
    } else if (tipoReporte === 'SOLVENCIA') {
      return solvencias.filter(s => {
        const cumpleCedula = filtroCedula ? s.cedula.includes(filtroCedula) : true;
        const cumpleEstado = filtroEstadoSolvencia === 'TODOS'
          ? true
          : (filtroEstadoSolvencia === 'MOROSO' ? s.esMoroso : !s.esMoroso);
          
        let cumpleNivel = true;
        if (filtroNivel !== 'TODOS') {
            cumpleNivel = s.detallesAlumnos.some(alu => alu.nivel === filtroNivel);
        }

        let cumpleSeccion = true;
        if (filtroSeccion) {
            cumpleSeccion = s.detallesAlumnos.some(alu => alu.seccion.trim().toUpperCase() === filtroSeccion.trim().toUpperCase());
        }

        return cumpleCedula && cumpleEstado && cumpleNivel && cumpleSeccion;
      });
    } else {
        return []; // Balance se calcula directo
    }
  };

  const generarPDF = async () => {
    setDownloading(true);
    try {
      const doc = new jsPDF();
      const logo = await loadImage(LOGO_URL);
      if (logo) {
          doc.addImage(logo, 'PNG', 170, 10, 25, 25);
      }

      doc.setFontSize(18);
      doc.text('Sistema de Gestión Administrativa', 14, 20);
      doc.setFontSize(10);
      doc.text(`Generado: ${new Date().toLocaleString()}`, 14, 28);

      // --- PDF BALANCE ---
      if (tipoReporte === 'BALANCE') {
          const balance = getBalanceData();
          doc.setTextColor(100);
          doc.setFontSize(14);
          doc.text("BALANCE DE RESULTADOS (INGRESOS vs EGRESOS)", 14, 40);
          doc.setFontSize(10);
          doc.text(`Período: ${filtroFechaInicio} al ${filtroFechaFin}`, 14, 46);

          // Caja Resumen
          doc.setDrawColor(0);
          doc.setFillColor(245, 247, 250);
          doc.rect(14, 55, 180, 40, 'FD');
          
          doc.setFont("helvetica", "bold");
          doc.setTextColor(0, 100, 0); // Verde
          doc.text(`INGRESOS TOTALES: $${balance.totalIngresos.toFixed(2)}`, 20, 65);
          
          doc.setTextColor(200, 0, 0); // Rojo
          doc.text(`EGRESOS TOTALES:  $${balance.totalEgresos.toFixed(2)}`, 20, 72);
          
          const netoColor = balance.resultadoNeto >= 0 ? [0, 0, 0] : [200, 0, 0];
          doc.setTextColor(netoColor[0], netoColor[1], netoColor[2]);
          doc.setFontSize(12);
          doc.text(`RESULTADO NETO:   $${balance.resultadoNeto.toFixed(2)}`, 20, 81);

          doc.setFontSize(10);
          doc.setTextColor(200, 100, 0); // Naranja
          doc.text(`CUENTAS POR COBRAR (MOROSIDAD ACTUAL): $${balance.cuentasPorCobrar.toFixed(2)}`, 20, 90);

          // Tablas Detalladas
          doc.setTextColor(0);
          doc.setFontSize(11);
          doc.text("Desglose de Egresos Operativos", 14, 110);

          autoTable(doc, {
              startY: 115,
              head: [['Concepto / Partida', 'Monto Total ($)']],
              body: [
                  ['Servicios Públicos e Impuestos', `$${balance.egresosServicios.toFixed(2)}`],
                  ['Nómina de Personal', `$${balance.egresosNomina.toFixed(2)}`],
                  ['Compras / Inventario', `$${balance.egresosCompras.toFixed(2)}`]
              ],
              foot: [['TOTAL EGRESOS', `$${balance.totalEgresos.toFixed(2)}`]],
              theme: 'grid',
              headStyles: { fillColor: [200, 50, 50] }
          });

          doc.text("Detalle de Ingresos", 14, (doc as any).lastAutoTable.finalY + 15);
          autoTable(doc, {
            startY: (doc as any).lastAutoTable.finalY + 20,
            head: [['Concepto', 'Monto Total ($)']],
            body: [
                ['Cobranza (Mensualidades/Inscripción)', `$${balance.ingresosRepresentantes.toFixed(2)}`]
            ],
            theme: 'grid',
            headStyles: { fillColor: [50, 150, 50] }
          });

          // --- AGREGAR INFORME IA AL PDF SI EXISTE ---
          if (aiSummary && !aiSummary.startsWith("Error")) {
              doc.addPage();
              if (logo) doc.addImage(logo, 'PNG', 170, 10, 25, 25);
              
              doc.setFillColor(240, 240, 255);
              doc.rect(0, 0, 210, 40, 'F');
              
              doc.setFontSize(16);
              doc.setTextColor(63, 81, 181);
              doc.setFont("helvetica", "bold");
              doc.text("INFORME DE ANÁLISIS FINANCIERO INTELIGENTE", 105, 25, { align: 'center' });
              
              doc.setFontSize(10);
              doc.setTextColor(100);
              doc.setFont("helvetica", "normal");
              doc.text("Generado por AdminPro AI", 105, 32, { align: 'center' });

              doc.setTextColor(0);
              doc.setFontSize(11);
              
              const splitText = doc.splitTextToSize(aiSummary, 180);
              doc.text(splitText, 14, 50);
              
              doc.setFontSize(8);
              doc.setTextColor(150);
              doc.text("Nota: Este informe es generado por IA basado en los datos proporcionados. Verificar con administración.", 14, 280);
          }

          doc.save(`balance_financiero_${filtroFechaInicio}_${filtroFechaFin}.pdf`);
          setDownloading(false);
          return;
      }

      // --- PDF TRANSACCIONES Y SOLVENCIA (Lógica existente) ---
      doc.setTextColor(100);
      doc.setFontSize(12);
      doc.text(tipoReporte === 'TRANSACCIONES' ? 'Reporte de Transacciones' : 'Reporte de Solvencia Escolar', 14, 40);
      
      const datos = obtenerDatosFiltrados();
      
      if (tipoReporte === 'TRANSACCIONES') {
        const data = (datos as RegistroPago[]).map(p => [
          p.fechaRegistro,
          p.cedulaRepresentante,
          p.nombreRepresentante,
          p.metodoPago,
          p.referencia,
          `$${(p.monto || 0).toFixed(2)}`,
          p.estado
        ]);

        autoTable(doc, {
          startY: 50,
          head: [['Fecha', 'Cédula', 'Representante', 'Método', 'Ref', 'Monto', 'Estado']],
          body: data,
        });

        const total = (datos as RegistroPago[]).reduce((sum, p) => sum + (p.monto || 0), 0);
        const finalY = (doc as any).lastAutoTable?.finalY || 60;
        doc.text(`Total en este reporte: $${total.toFixed(2)}`, 14, finalY + 10);

      } else {
        // SOLVENCIA
        const data = (datos as DeudaCalculada[]).map(s => {
          const alumnosParaReporte = s.detallesAlumnos.filter(alu => {
              let match = true;
              if (filtroNivel !== 'TODOS') match = match && alu.nivel === filtroNivel;
              if (filtroSeccion) match = match && alu.seccion.trim().toUpperCase() === filtroSeccion.trim().toUpperCase();
              return match;
          });
          
          const alumnosMostrar = alumnosParaReporte.length > 0 ? alumnosParaReporte : s.detallesAlumnos;
          const textoAlumnos = alumnosMostrar.map(a => `${a.nombre} (Sec: ${a.seccion})`).join('\n');

          return [
            s.cedula,
            s.nombre,
            s.matricula,
            textoAlumnos, 
            `$${s.deudaEsperada.toFixed(2)}`,
            `$${s.totalPagado.toFixed(2)}`,
            `$${s.saldoPendiente.toFixed(2)}`,
            s.esMoroso ? 'MOROSO' : 'SOLVENTE'
          ];
        });

        autoTable(doc, {
          startY: 50,
          head: [['Cédula', 'Representante', 'Matrícula', 'Alumnos (Sección)', 'Deuda Total', 'Pagado', 'Pendiente', 'Estado']],
          body: data,
          styles: { fontSize: 8, valign: 'middle' },
          didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === 7) {
              const texto = data.cell.raw as string;
              if (texto === 'MOROSO') {
                data.cell.styles.textColor = [200, 0, 0];
                data.cell.styles.fontStyle = 'bold';
              } else {
                data.cell.styles.textColor = [0, 150, 0];
                data.cell.styles.fontStyle = 'bold';
              }
            }
          }
        });
        
        const totalDeuda = (datos as DeudaCalculada[]).reduce((sum, s) => sum + s.saldoPendiente, 0);
        const finalY = (doc as any).lastAutoTable?.finalY || 60;
        doc.text(`Total Saldo Pendiente (Deuda) en reporte: $${totalDeuda.toFixed(2)}`, 14, finalY + 10);
      }

      doc.save(`reporte_${tipoReporte.toLowerCase()}_${new Date().getTime()}.pdf`);
    } catch (e) {
      console.error("Error al generar PDF:", e);
      alert("Hubo un error al generar el PDF.");
    } finally {
      setDownloading(false);
    }
  };

  const generarResumenIA = async () => {
    // Verificar si la clave es la por defecto o está vacía
    const apiKey = process.env.API_KEY;
    if (!apiKey || apiKey === '' || apiKey.includes('PEGAR_AQUI')) {
        setAiSummary("Error de Configuración: La API Key no está configurada.\n\nPor favor, edite el archivo 'index.html' y pegue su API Key de Google AI Studio donde se indica.");
        return;
    }

    setLoading(true);
    setAiSummary(''); // Limpiar anterior
    try {
      const ai = new GoogleGenAI({ apiKey: apiKey });
      
      let prompt = "";
      
      if(tipoReporte === 'BALANCE') {
          const bal = getBalanceData();
          prompt = `
            Actúa como un Auditor Financiero Experto para un Colegio Privado. Genera un "INFORME EJECUTIVO DE GESTIÓN" detallado basado en estos datos del período ${filtroFechaInicio} al ${filtroFechaFin}:

            DATOS FINANCIEROS:
            - Ingresos Totales (Cobranza): $${bal.totalIngresos.toFixed(2)}
            - Egresos Operativos Totales: $${bal.totalEgresos.toFixed(2)}
              * Nómina: $${bal.egresosNomina.toFixed(2)}
              * Servicios: $${bal.egresosServicios.toFixed(2)}
              * Compras/Inventario: $${bal.egresosCompras.toFixed(2)}
            - Resultado Neto (Utilidad/Déficit): $${bal.resultadoNeto.toFixed(2)}
            - Cuentas por Cobrar (Morosidad Acumulada): $${bal.cuentasPorCobrar.toFixed(2)}

            ESTRUCTURA DEL INFORME (Usa títulos claros y viñetas):
            1. ANÁLISIS DE RENTABILIDAD: Evalúa el margen neto. ¿Los ingresos cubren los costos operativos?
            2. ANÁLISIS DE GASTOS: Identifica qué partida (Nómina, Servicios, Compras) consume más recursos y si es proporcional.
            3. SALUD DE LA CARTERA: Analiza la relación entre Ingresos Reales vs Cuentas por Cobrar (Morosidad). ¿Es crítico el nivel de deuda?
            4. RECOMENDACIONES ESTRATÉGICAS: Dame 3 acciones concretas para mejorar el flujo de caja o reducir gastos el próximo mes.

            El tono debe ser profesional, directivo y formal.
          `;
      } else {
          const resumenDatos = {
            totalEstudiantes: representantes.reduce((acc, r) => acc + r.alumnos.length, 0),
            totalPagadoVerificado: pagos.filter(p => p.estado === EstadoPago.VERIFICADO).reduce((acc, p) => acc + (p.monto || 0), 0),
            morosos: solvencias.filter(s => s.esMoroso).length,
            solventes: solvencias.filter(s => !s.esMoroso).length,
            deudaTotal: solvencias.reduce((acc, s) => acc + s.saldoPendiente, 0)
          };
          prompt = `Analiza estos datos de solvencia escolar y da un resumen ejecutivo breve (3 items): ${JSON.stringify(resumenDatos)}`;
      }
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });
      setAiSummary(response.text || "La IA no generó respuesta.");
    } catch (error: any) {
      console.error("Error completo IA:", error);
      const msg = error.message || error.toString();
      
      if (msg.includes("API key")) {
          setAiSummary("Error de Autenticación: La API Key proporcionada en index.html no es válida.");
      } else {
          setAiSummary(`Error de conexión con el servicio de IA:\n${msg}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const renderBalanceView = () => {
      const balance = getBalanceData();
      return (
          <div className="space-y-6 animate-in fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {/* CARD INGRESOS */}
                  <div className="bg-white p-6 rounded-xl border border-green-100 shadow-sm flex items-center justify-between">
                      <div>
                          <p className="text-sm font-bold text-gray-500 uppercase">Ingresos Totales</p>
                          <h3 className="text-2xl font-bold text-green-600 mt-1">${balance.totalIngresos.toLocaleString(undefined, {minimumFractionDigits: 2})}</h3>
                          <p className="text-xs text-gray-400 mt-1">Cobranza Verificada</p>
                      </div>
                      <div className="bg-green-100 p-3 rounded-full text-green-600">
                          <TrendingUp size={24}/>
                      </div>
                  </div>

                  {/* CARD EGRESOS */}
                  <div className="bg-white p-6 rounded-xl border border-red-100 shadow-sm flex items-center justify-between">
                      <div>
                          <p className="text-sm font-bold text-gray-500 uppercase">Egresos Totales</p>
                          <h3 className="text-2xl font-bold text-red-600 mt-1">${balance.totalEgresos.toLocaleString(undefined, {minimumFractionDigits: 2})}</h3>
                          <p className="text-xs text-gray-400 mt-1">Servicios + Nómina</p>
                      </div>
                      <div className="bg-red-100 p-3 rounded-full text-red-600">
                          <TrendingDown size={24}/>
                      </div>
                  </div>

                  {/* CARD NETO */}
                  <div className="bg-white p-6 rounded-xl border border-indigo-100 shadow-sm flex items-center justify-between">
                      <div>
                          <p className="text-sm font-bold text-gray-500 uppercase">Resultado Neto</p>
                          <h3 className={`text-2xl font-bold mt-1 ${balance.resultadoNeto >= 0 ? 'text-indigo-600' : 'text-red-600'}`}>
                              ${balance.resultadoNeto.toLocaleString(undefined, {minimumFractionDigits: 2})}
                          </h3>
                          <p className="text-xs text-gray-400 mt-1">Utilidad / Déficit</p>
                      </div>
                      <div className="bg-indigo-100 p-3 rounded-full text-indigo-600">
                          <Scale size={24}/>
                      </div>
                  </div>

                  {/* CARD CUENTAS POR COBRAR (NUEVO) */}
                  <div className="bg-white p-6 rounded-xl border border-orange-100 shadow-sm flex items-center justify-between">
                      <div>
                          <p className="text-sm font-bold text-gray-500 uppercase">Cuentas por Cobrar</p>
                          <h3 className="text-2xl font-bold text-orange-600 mt-1">${balance.cuentasPorCobrar.toLocaleString(undefined, {minimumFractionDigits: 2})}</h3>
                          <p className="text-xs text-gray-400 mt-1">Morosidad Acumulada</p>
                      </div>
                      <div className="bg-orange-100 p-3 rounded-full text-orange-600">
                          <AlertCircle size={24}/>
                      </div>
                  </div>
              </div>

              {/* CONTENEDOR GRÁFICO Y ANÁLISIS IA */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* DETALLE EGRESOS (2 Columnas) */}
                  <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden h-full">
                      <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
                          <h3 className="font-bold text-gray-700">Desglose de Egresos Operativos</h3>
                      </div>
                      <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="flex justify-between items-center border-b pb-2">
                              <span className="text-gray-600">Nómina y Personal</span>
                              <span className="font-bold text-gray-800">${balance.egresosNomina.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-center border-b pb-2">
                              <span className="text-gray-600">Servicios e Impuestos</span>
                              <span className="font-bold text-gray-800">${balance.egresosServicios.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-center border-b pb-2">
                              <span className="text-gray-600">Compras e Insumos</span>
                              <span className="font-bold text-gray-800">${balance.egresosCompras.toFixed(2)}</span>
                          </div>
                      </div>
                      <div className="px-6 pb-6">
                          <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden flex">
                              <div className="bg-red-400 h-full" style={{ width: `${(balance.egresosNomina / (balance.totalEgresos || 1)) * 100}%` }} title="Nómina"></div>
                              <div className="bg-orange-400 h-full" style={{ width: `${(balance.egresosServicios / (balance.totalEgresos || 1)) * 100}%` }} title="Servicios"></div>
                              <div className="bg-blue-400 h-full" style={{ width: `${(balance.egresosCompras / (balance.totalEgresos || 1)) * 100}%` }} title="Compras"></div>
                          </div>
                          <div className="flex gap-4 mt-2 text-xs text-gray-500 justify-center">
                              <span className="flex items-center gap-1"><div className="w-3 h-3 bg-red-400 rounded-full"></div> Nómina</span>
                              <span className="flex items-center gap-1"><div className="w-3 h-3 bg-orange-400 rounded-full"></div> Servicios</span>
                              <span className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-400 rounded-full"></div> Compras</span>
                          </div>
                      </div>
                  </div>

                  {/* CAJA DE ANÁLISIS IA (1 Columna) */}
                  <div className="bg-gradient-to-br from-indigo-50 to-white p-5 rounded-xl border border-indigo-200 shadow-sm flex flex-col h-full">
                      <div className="flex items-center gap-2 mb-4">
                          <div className="bg-indigo-600 p-2 rounded-lg text-white shadow-sm">
                              <Sparkles size={20} />
                          </div>
                          <h3 className="font-bold text-indigo-900 leading-tight">Análisis Financiero Inteligente (Mes)</h3>
                      </div>
                      
                      <div className="flex-1 overflow-y-auto min-h-[150px] mb-4 text-sm text-slate-700 bg-white/60 p-3 rounded border border-indigo-100">
                          {loading && !aiSummary ? (
                              <div className="flex items-center gap-2 text-indigo-600 h-full justify-center">
                                  <Loader2 className="animate-spin" size={20}/> Analizando datos...
                              </div>
                          ) : aiSummary ? (
                              <p className={`whitespace-pre-wrap leading-relaxed text-xs ${aiSummary.startsWith('Error') ? 'text-red-600 font-bold' : ''}`}>{aiSummary}</p>
                          ) : (
                              <p className="text-gray-400 italic text-center mt-10">
                                  Haga clic en "Generar Análisis" para obtener un informe de auditoría detallado.
                              </p>
                          )}
                      </div>

                      <button 
                          onClick={generarResumenIA}
                          disabled={loading}
                          className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium shadow-sm hover:bg-indigo-700 disabled:opacity-50 text-sm flex justify-center items-center gap-2"
                      >
                          {loading ? 'Procesando...' : <><Bot size={16}/> Generar Análisis</>}
                      </button>
                      {aiSummary && !aiSummary.startsWith("Error") && (
                          <p className="text-[10px] text-indigo-500 mt-2 text-center">
                              * El informe se incluirá al descargar el PDF.
                          </p>
                      )}
                  </div>
              </div>
          </div>
      );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-2xl font-bold mb-6 text-slate-800 flex items-center gap-2">
          <FileText className="text-indigo-600" /> Reportes y Estadísticas
        </h2>

        {/* Selector de Tipo de Reporte */}
        <div className="flex flex-col md:flex-row gap-4 mb-6 border-b pb-4">
          <button 
            onClick={() => setTipoReporte('TRANSACCIONES')}
            className={`flex-1 p-4 rounded-xl border-2 transition-all flex items-center justify-center gap-3 ${tipoReporte === 'TRANSACCIONES' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200 hover:border-gray-300'}`}
          >
            <DollarSign size={24} />
            <div className="text-left">
              <span className="block font-bold">Ingresos</span>
              <span className="text-xs text-gray-500">Pagos Recibidos</span>
            </div>
          </button>
          
          <button 
            onClick={() => setTipoReporte('SOLVENCIA')}
            className={`flex-1 p-4 rounded-xl border-2 transition-all flex items-center justify-center gap-3 ${tipoReporte === 'SOLVENCIA' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200 hover:border-gray-300'}`}
          >
            <Filter size={24} />
            <div className="text-left">
              <span className="block font-bold">Solvencia</span>
              <span className="text-xs text-gray-500">Deudores vs Al Día</span>
            </div>
          </button>

          <button 
            onClick={() => setTipoReporte('BALANCE')}
            className={`flex-1 p-4 rounded-xl border-2 transition-all flex items-center justify-center gap-3 ${tipoReporte === 'BALANCE' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200 hover:border-gray-300'}`}
          >
            <Scale size={24} />
            <div className="text-left">
              <span className="block font-bold">Balance Financiero</span>
              <span className="text-xs text-gray-500">Resultados Ingresos/Egresos</span>
            </div>
          </button>
        </div>

        {/* Controles de Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 bg-gray-50 p-4 rounded-lg">
          {(tipoReporte === 'TRANSACCIONES' || tipoReporte === 'SOLVENCIA') && (
            <div className="md:col-span-1">
              <label className="block text-xs font-bold text-gray-500 mb-1">Cédula Representante</label>
              <input 
                type="text" 
                value={filtroCedula}
                onChange={(e) => setFiltroCedula(e.target.value)}
                className="w-full border border-gray-300 rounded-md p-2 text-sm"
                placeholder="V-..."
              />
            </div>
          )}

          {(tipoReporte === 'TRANSACCIONES' || tipoReporte === 'BALANCE') && (
            <>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Desde Fecha</label>
                <input type="date" value={filtroFechaInicio} onChange={(e) => setFiltroFechaInicio(e.target.value)} className="w-full border border-gray-300 rounded-md p-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Hasta Fecha</label>
                <input type="date" value={filtroFechaFin} onChange={(e) => setFiltroFechaFin(e.target.value)} className="w-full border border-gray-300 rounded-md p-2 text-sm" />
              </div>
            </>
          )}

          {tipoReporte === 'TRANSACCIONES' && (
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Verificación</label>
                <select value={filtroVerificacion} onChange={(e) => setFiltroVerificacion(e.target.value)} className="w-full border border-gray-300 rounded-md p-2 text-sm">
                  <option value="TODOS">Todos</option>
                  <option value="PENDIENTE">Pendientes</option>
                  <option value="VERIFICADO">Verificados</option>
                </select>
              </div>
          )}

          {tipoReporte === 'SOLVENCIA' && (
             <>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Estado Financiero</label>
                  <select value={filtroEstadoSolvencia} onChange={(e) => setFiltroEstadoSolvencia(e.target.value)} className="w-full border border-gray-300 rounded-md p-2 text-sm">
                    <option value="TODOS">Todos</option>
                    <option value="MOROSO">Morosos (Con Deuda)</option>
                    <option value="SOLVENTE">Solventes (Al día)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Grado</label>
                  <select value={filtroNivel} onChange={(e) => setFiltroNivel(e.target.value)} className="w-full border border-gray-300 rounded-md p-2 text-sm">
                    <option value="TODOS">Todos los Grados</option>
                    {Object.values(NivelEducativo).map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Sección</label>
                  <input 
                    type="text" 
                    value={filtroSeccion} 
                    onChange={(e) => setFiltroSeccion(e.target.value)} 
                    className="w-full border border-gray-300 rounded-md p-2 text-sm"
                    placeholder="Ej: A"
                  />
                </div>
             </>
          )}
        </div>

        {/* Botón Descarga */}
        <div className="flex justify-end gap-3">
            <button 
              onClick={cargarDatosGenerales} 
              className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center gap-2"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} /> Actualizar Datos
            </button>
            <button 
              onClick={generarPDF}
              disabled={downloading || loading}
              className="px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 font-medium flex items-center gap-2 shadow-md"
            >
              {downloading ? <Loader2 className="animate-spin" /> : <Download size={20} />}
              Descargar PDF
            </button>
        </div>
      </div>

      {/* VISTA PRINCIPAL SEGUN TIPO */}
      {tipoReporte === 'BALANCE' ? renderBalanceView() : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                  <h3 className="font-bold text-gray-700">Previsualización de Datos ({obtenerDatosFiltrados().length} registros)</h3>
              </div>
              <div className="overflow-x-auto max-h-[600px]">
                  <table className="w-full text-sm text-left text-gray-500">
                      <thead className="text-xs text-gray-700 uppercase bg-gray-100 sticky top-0 z-10">
                          <tr>
                              {tipoReporte === 'TRANSACCIONES' ? (
                                  <>
                                      <th className="px-6 py-3">Fecha</th>
                                      <th className="px-6 py-3">Cédula</th>
                                      <th className="px-6 py-3">Nombre</th>
                                      <th className="px-6 py-3 text-right">Monto</th>
                                      <th className="px-6 py-3 text-center">Estado</th>
                                  </>
                              ) : (
                                  <>
                                      <th className="px-2 py-3 w-8"></th>
                                      <th className="px-6 py-3">Cédula</th>
                                      <th className="px-6 py-3">Nombre</th>
                                      <th className="px-6 py-3 text-right">Deuda Total</th>
                                      <th className="px-6 py-3 text-right">Pagado</th>
                                      <th className="px-6 py-3 text-right">Pendiente</th>
                                      <th className="px-6 py-3 text-center">Condición</th>
                                  </>
                              )}
                          </tr>
                      </thead>
                      <tbody>
                          {obtenerDatosFiltrados().map((item: any, idx) => (
                            <React.Fragment key={idx}>
                              <tr className="bg-white border-b hover:bg-gray-50">
                                  {tipoReporte === 'TRANSACCIONES' ? (
                                      <>
                                          <td className="px-6 py-4">{item.fechaRegistro}</td>
                                          <td className="px-6 py-4 text-xs">{item.cedulaRepresentante}</td>
                                          <td className="px-6 py-4">{item.nombreRepresentante}</td>
                                          <td className="px-6 py-4 text-right font-mono">${(item.monto || 0).toFixed(2)}</td>
                                          <td className="px-6 py-4 text-center">
                                              <span className={`px-2 py-1 rounded text-[10px] ${item.estado === EstadoPago.VERIFICADO ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                  {item.estado}
                                              </span>
                                          </td>
                                      </>
                                  ) : (
                                      <>
                                          <td className="px-2 py-4 text-center">
                                            <button 
                                              onClick={() => toggleRow(item.cedula)}
                                              className="p-1 hover:bg-gray-200 rounded-full text-gray-500 transition-colors"
                                            >
                                              {expandedRow === item.cedula ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                            </button>
                                          </td>
                                          <td className="px-6 py-4 text-xs font-medium text-slate-700">{item.cedula}</td>
                                          <td className="px-6 py-4 font-medium text-slate-800">{item.nombre}</td>
                                          <td className="px-6 py-4 text-right font-mono text-gray-400">${item.deudaEsperada.toFixed(2)}</td>
                                          <td className="px-6 py-4 text-right font-mono text-green-600">${item.totalPagado.toFixed(2)}</td>
                                          <td className="px-6 py-4 text-right font-mono font-bold text-slate-800">${item.saldoPendiente.toFixed(2)}</td>
                                          <td className="px-6 py-4 text-center">
                                              {item.esMoroso ? (
                                                  <span className="flex items-center justify-center gap-1 text-red-600 font-bold text-xs"><XCircle size={14}/> MOROSO</span>
                                              ) : (
                                                  <span className="flex items-center justify-center gap-1 text-green-600 font-bold text-xs"><CheckCircle size={14}/> SOLVENTE</span>
                                              )}
                                          </td>
                                      </>
                                  )}
                              </tr>
                              {/* Fila Expandida para Detalle de Alumnos */}
                              {tipoReporte === 'SOLVENCIA' && expandedRow === item.cedula && (
                                <tr className="bg-slate-50">
                                  <td colSpan={7} className="px-8 py-4 border-b">
                                    <div className="bg-white rounded border border-gray-200 overflow-hidden shadow-inner">
                                      <div className="px-4 py-2 bg-slate-100 border-b border-gray-200 text-xs font-bold text-slate-700 uppercase tracking-wider flex justify-between">
                                        <span>Detalle Financiero por Estudiante</span>
                                        <span>Matrícula: {item.matricula}</span>
                                      </div>
                                      <table className="w-full text-xs">
                                        <thead className="bg-gray-50 text-gray-500 border-b border-gray-200">
                                          <tr>
                                            <th className="px-4 py-3 text-left">Alumno</th>
                                            <th className="px-4 py-3 text-left">Nivel (Sección)</th>
                                            <th className="px-4 py-3 text-right">Costo Calculado</th>
                                            <th className="px-4 py-3 text-right">Total Pagado</th>
                                            <th className="px-4 py-3 text-right">Deuda Pendiente</th>
                                            <th className="px-4 py-3 text-center">Estado</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                          {item.detallesAlumnos.map((alu: DetalleAlumnoDeuda, i: number) => (
                                            <tr key={i} className="hover:bg-slate-50 transition-colors">
                                              <td className="px-4 py-3 font-medium text-slate-700">{alu.nombre}</td>
                                              <td className="px-4 py-3 text-gray-500">{alu.nivel} <span className="text-gray-400">({alu.seccion})</span></td>
                                              <td className="px-4 py-3 text-right font-mono text-gray-500">${alu.costo.toFixed(2)}</td>
                                              <td className="px-4 py-3 text-right font-mono text-green-600 font-medium">${alu.pagado.toFixed(2)}</td>
                                              <td className="px-4 py-3 text-right font-mono font-bold text-red-600">${alu.pendiente.toFixed(2)}</td>
                                              <td className="px-4 py-3 text-center">
                                                  {alu.pendiente > 0 ? (
                                                      <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold">DEBE</span>
                                                  ) : (
                                                      <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold">AL DÍA</span>
                                                  )}
                                              </td>
                                            </tr>
                                          ))}
                                          {item.detallesAlumnos.length === 0 && (
                                            <tr><td colSpan={6} className="px-4 py-4 text-center text-gray-400 italic">Sin alumnos registrados</td></tr>
                                          )}
                                        </tbody>
                                      </table>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {/* Sección IA (Solo si no es Balance, ya que Balance tiene su propia UI) */}
      {hasApiKey && tipoReporte !== 'BALANCE' && (
        <div className="bg-indigo-50 p-6 rounded-xl border border-indigo-100 mt-6">
            <h3 className="font-bold text-indigo-900 flex items-center gap-2 mb-2"><Bot size={20}/> Análisis IA</h3>
            <p className="text-sm text-indigo-700 mb-4">Genera un resumen ejecutivo basado en los datos visualizados.</p>
            {aiSummary && <p className="bg-white p-4 rounded text-sm text-gray-700 mb-4 whitespace-pre-wrap">{aiSummary}</p>}
            <button onClick={generarResumenIA} disabled={loading} className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 text-sm">
                {loading ? 'Analizando...' : 'Generar Análisis'}
            </button>
        </div>
      )}
    </div>
  );
};
