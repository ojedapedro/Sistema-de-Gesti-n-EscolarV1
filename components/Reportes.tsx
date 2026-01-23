
import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Download, Bot, RefreshCw, Loader2, FileText, Filter, DollarSign, CheckCircle, XCircle, ChevronDown, ChevronUp, PieChart, TrendingUp, TrendingDown, MinusCircle } from 'lucide-react';
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
  ingresosUSD: number;
  ingresosBs: number;
  egresosServiciosUSD: number;
  egresosServiciosBs: number;
  egresosNominaUSD: number;
  egresosComprasUSD: number; // NUEVO
  totalIngresosUSD: number;
  totalEgresosUSD: number;
  resultadoNetoUSD: number;
  itemsIngresos: RegistroPago[];
  itemsServicios: PagoServicio[];
  itemsNomina: RegistroNomina[];
  itemsCompras: MovimientoInventario[]; // NUEVO
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
  const [pagosServicios, setPagosServicios] = useState<PagoServicio[]>([]);
  const [historialNomina, setHistorialNomina] = useState<RegistroNomina[]>([]);
  const [movimientosInventario, setMovimientosInventario] = useState<MovimientoInventario[]>([]);
  
  const [solvencias, setSolvencias] = useState<DeudaCalculada[]>([]);
  const [balance, setBalance] = useState<BalanceData | null>(null);

  // Filtros
  const [tipoReporte, setTipoReporte] = useState<TipoReporte>('TRANSACCIONES');
  const [filtroCedula, setFiltroCedula] = useState('');
  
  // Filtros Fechas (Compartido Transacciones y Balance)
  const [fechaInicio, setFechaInicio] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]); // Primer día del mes actual
  const [fechaFin, setFechaFin] = useState(new Date().toISOString().split('T')[0]); // Hoy

  const [filtroVerificacion, setFiltroVerificacion] = useState('TODOS'); // TODOS, VERIFICADO, PENDIENTE
  
  // Filtros Solvencia
  const [filtroEstadoSolvencia, setFiltroEstadoSolvencia] = useState('TODOS'); // TODOS, MOROSO, SOLVENTE
  const [filtroNivel, setFiltroNivel] = useState('TODOS'); // Mapea a 'Grado'
  const [filtroSeccion, setFiltroSeccion] = useState('');

  // UI
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [aiSummary, setAiSummary] = useState<string>('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  
  const hasApiKey = !!process.env.API_KEY;

  useEffect(() => {
    cargarDatosGenerales();
  }, []);

  // Efecto para recalcular balance cuando cambian fechas o datos
  useEffect(() => {
    if (tipoReporte === 'BALANCE' && !loading) {
      calcularBalance();
    }
  }, [fechaInicio, fechaFin, pagos, pagosServicios, historialNomina, movimientosInventario, tipoReporte]);

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
      setHistorialNomina(nomData);
      setMovimientosInventario(invData.movimientos);
      
      // Calcular solvencias una vez cargados los datos
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
      
      // 1. Inicializar detalle por cada alumno con pagos específicos
      const detallesAlumnos: DetalleAlumnoDeuda[] = rep.alumnos.map(alu => {
        const configNivel = niveles.find(n => n.nivel === alu.nivel);
        const precioMensual = configNivel ? (configNivel.precio || 0) : (MENSUALIDADES[alu.nivel] || 0);
        
        // Costo acumulado hasta la fecha
        const costoTotalAlumno = precioMensual * mesesTranscurridos;
        deudaEsperadaTotal += costoTotalAlumno;

        // Pagos específicos de este alumno (studentId coincide)
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

      // 2. Obtener Bolsa General de Pagos (Sin studentId o 'VARIOS')
      let bolsaGeneral = _pagos
        .filter(p => p.cedulaRepresentante === rep.cedula && p.estado === EstadoPago.VERIFICADO && (!p.studentId || p.studentId === 'VARIOS'))
        .reduce((acc, p) => acc + (p.monto || 0), 0);

      // 3. Distribuir Bolsa General para cubrir deudas individuales
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

      // 4. Si sobra dinero en la bolsa (crédito), asignarlo al primer alumno para visualización
      if (bolsaGeneral > 0 && detallesAlumnos.length > 0) {
          detallesAlumnos[0].pagado += bolsaGeneral;
          // Pendiente se mantiene en 0
      }

      // Total Pagado Global (Para consistencia)
      const totalPagadoRep = _pagos
        .filter(p => p.cedulaRepresentante === rep.cedula && p.estado === EstadoPago.VERIFICADO)
        .reduce((acc, p) => acc + (p.monto || 0), 0);

      // El saldo pendiente global
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

  const calcularBalance = () => {
    // 1. Filtrar Ingresos (Pagos Representantes)
    const ingresosFiltrados = pagos.filter(p => {
      return p.estado === EstadoPago.VERIFICADO && 
             p.fechaPago >= fechaInicio && 
             p.fechaPago <= fechaFin;
    });

    const totalIngresosUSD = ingresosFiltrados.reduce((acc, p) => acc + (p.monto || 0), 0);
    const totalIngresosBs = ingresosFiltrados.reduce((acc, p) => acc + (p.montoBolivares || 0), 0);

    // 2. Filtrar Egresos (Servicios)
    const serviciosFiltrados = pagosServicios.filter(p => {
      return p.estado === 'PAGADO' && 
             p.fechaPago >= fechaInicio && 
             p.fechaPago <= fechaFin;
    });

    const totalServiciosUSD = serviciosFiltrados.reduce((acc, p) => acc + (p.monto || 0), 0);
    const totalServiciosBs = serviciosFiltrados.reduce((acc, p) => acc + (p.montoBolivares || 0), 0);

    // 3. Filtrar Egresos (Nómina)
    const nominaFiltrada = historialNomina.filter(n => {
      return n.fechaPago >= fechaInicio && n.fechaPago <= fechaFin;
    });

    const totalNominaUSD = nominaFiltrada.reduce((acc, n) => acc + (n.totalPagar || 0), 0);

    // 4. Filtrar Egresos (Compras Inventario)
    const comprasFiltradas = movimientosInventario.filter(m => {
        return m.tipo === TipoMovimiento.ENTRADA &&
               m.fecha >= fechaInicio &&
               m.fecha <= fechaFin;
    });

    const totalComprasUSD = comprasFiltradas.reduce((acc, m) => acc + (m.costoTotal || 0), 0);

    // Totales
    const totalEgresosUSD = totalServiciosUSD + totalNominaUSD + totalComprasUSD;
    const resultadoNeto = totalIngresosUSD - totalEgresosUSD;

    setBalance({
      ingresosUSD: totalIngresosUSD,
      ingresosBs: totalIngresosBs,
      egresosServiciosUSD: totalServiciosUSD,
      egresosServiciosBs: totalServiciosBs,
      egresosNominaUSD: totalNominaUSD,
      egresosComprasUSD: totalComprasUSD, // NUEVO
      totalIngresosUSD: totalIngresosUSD,
      totalEgresosUSD: totalEgresosUSD,
      resultadoNetoUSD: resultadoNeto,
      itemsIngresos: ingresosFiltrados,
      itemsServicios: serviciosFiltrados,
      itemsNomina: nominaFiltrada,
      itemsCompras: comprasFiltradas // NUEVO
    });
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
        if (fechaInicio) cumpleFecha = cumpleFecha && p.fechaRegistro >= fechaInicio;
        if (fechaFin) cumpleFecha = cumpleFecha && p.fechaRegistro <= fechaFin;

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
      // BALANCE usa el estado 'balance' calculado separadamente
      return [];
    }
  };

  const generarPDF = async () => {
    setDownloading(true);
    try {
      const doc = new jsPDF();
      
      // Logo en la esquina derecha
      const logo = await loadImage(LOGO_URL);
      if (logo) {
          doc.addImage(logo, 'PNG', 170, 10, 25, 25);
      }

      // Encabezado
      doc.setFontSize(18);
      doc.text('Sistema de Gestión Administrativa', 14, 20);
      doc.setFontSize(12);
      doc.setTextColor(100);

      let tituloReporte = '';
      if(tipoReporte === 'TRANSACCIONES') tituloReporte = 'Reporte de Transacciones';
      if(tipoReporte === 'SOLVENCIA') tituloReporte = 'Reporte de Solvencia Escolar';
      if(tipoReporte === 'BALANCE') tituloReporte = 'Balance de Resultados Financieros';

      doc.text(tituloReporte, 14, 28);
      
      doc.setFontSize(10);
      doc.text(`Generado: ${new Date().toLocaleString()}`, 14, 35);
      
      // Filtros texto
      let filtrosTexto = '';
      if(tipoReporte === 'BALANCE') {
        filtrosTexto = `Periodo Analizado: Del ${fechaInicio} al ${fechaFin}`;
      } else {
        filtrosTexto = `Cédula: ${filtroCedula || 'Todas'}`;
        if (tipoReporte === 'TRANSACCIONES') {
          filtrosTexto += ` | Estado: ${filtroVerificacion} | Desde: ${fechaInicio || '-'} Hasta: ${fechaFin || '-'}`;
        } else if (tipoReporte === 'SOLVENCIA') {
          filtrosTexto += ` | Condición: ${filtroEstadoSolvencia}`;
          if (filtroNivel !== 'TODOS') filtrosTexto += ` | Grado: ${filtroNivel}`;
          if (filtroSeccion) filtrosTexto += ` | Sección: ${filtroSeccion.toUpperCase()}`;
        }
      }
      doc.text(filtrosTexto, 14, 42);

      // --- LOGICA BALANCE PDF ---
      if (tipoReporte === 'BALANCE' && balance) {
        let finalY = 50;
        
        // 1. RESUMEN EJECUTIVO
        doc.setFontSize(14);
        doc.setTextColor(0);
        doc.text("Resumen Ejecutivo", 14, finalY);
        finalY += 5;

        const resumenData = [
          ['INGRESOS TOTALES (+)', `$${balance.totalIngresosUSD.toFixed(2)}`, `Bs. ${balance.ingresosBs.toFixed(2)}`],
          ['EGRESOS TOTALES (-)', `$${balance.totalEgresosUSD.toFixed(2)}`, `(Servicios + Nómina + Compras)`],
          ['RESULTADO NETO (=)', `$${balance.resultadoNetoUSD.toFixed(2)}`, balance.resultadoNetoUSD >= 0 ? 'SUPERÁVIT' : 'DÉFICIT']
        ];

        autoTable(doc, {
          startY: finalY,
          head: [['Concepto', 'Monto USD', 'Notas / Bs']],
          body: resumenData,
          theme: 'grid',
          headStyles: { fillColor: [44, 62, 80] },
          bodyStyles: { fontStyle: 'bold' },
          didParseCell: (data) => {
            if (data.row.index === 2 && data.column.index === 1) {
               data.cell.styles.textColor = balance.resultadoNetoUSD >= 0 ? [0, 150, 0] : [200, 0, 0];
            }
          }
        });

        // 2. DETALLE INGRESOS
        finalY = (doc as any).lastAutoTable.finalY + 15;
        doc.text("Detalle de Ingresos (Pagos Representantes)", 14, finalY);
        
        // Agrupar ingresos por método para ahorrar espacio
        const ingresosPorMetodo = balance.itemsIngresos.reduce((acc, curr) => {
           acc[curr.metodoPago] = (acc[curr.metodoPago] || 0) + curr.monto;
           return acc;
        }, {} as Record<string, number>);

        const tablaIngresos = Object.entries(ingresosPorMetodo).map(([metodo, monto]) => [metodo, `$${monto.toFixed(2)}`]);
        
        autoTable(doc, {
          startY: finalY + 5,
          head: [['Método de Pago', 'Total Recaudado']],
          body: tablaIngresos,
          theme: 'striped',
          foot: [['TOTAL INGRESOS', `$${balance.totalIngresosUSD.toFixed(2)}`]]
        });

        // 3. DETALLE EGRESOS (SERVICIOS)
        finalY = (doc as any).lastAutoTable.finalY + 15;
        if (finalY > 250) { doc.addPage(); finalY = 20; }
        
        doc.text("Detalle de Egresos Operativos (Servicios)", 14, finalY);
        
        const tablaServicios = balance.itemsServicios.map(s => [
          s.fechaPago,
          s.categoria,
          s.proveedor,
          `$${s.monto.toFixed(2)}`
        ]);

        if (tablaServicios.length > 0) {
            autoTable(doc, {
              startY: finalY + 5,
              head: [['Fecha', 'Categoría', 'Proveedor', 'Monto']],
              body: tablaServicios,
              theme: 'striped',
              styles: { fontSize: 8 },
              foot: [['TOTAL SERVICIOS', '', '', `$${balance.egresosServiciosUSD.toFixed(2)}`]]
            });
        } else {
            doc.setFontSize(10);
            doc.text("No hay pagos de servicios en este periodo.", 14, finalY + 10);
            (doc as any).lastAutoTable = { finalY: finalY + 15 };
        }

        // 4. DETALLE EGRESOS (NÓMINA)
        finalY = (doc as any).lastAutoTable.finalY + 15;
        if (finalY > 250) { doc.addPage(); finalY = 20; }

        doc.setFontSize(14);
        doc.text("Detalle de Nómina (Pagado)", 14, finalY);

        const tablaNomina = balance.itemsNomina.map(n => [
          n.fechaPago,
          n.nombreCompleto,
          n.cargo,
          `$${n.totalPagar.toFixed(2)}`
        ]);

        if (tablaNomina.length > 0) {
          autoTable(doc, {
            startY: finalY + 5,
            head: [['Fecha', 'Empleado', 'Cargo', 'Neto Pagado']],
            body: tablaNomina,
            theme: 'striped',
            styles: { fontSize: 8 },
            foot: [['TOTAL NÓMINA', '', '', `$${balance.egresosNominaUSD.toFixed(2)}`]]
          });
        } else {
           doc.setFontSize(10);
           doc.text("No hay pagos de nómina en este periodo.", 14, finalY + 10);
           (doc as any).lastAutoTable = { finalY: finalY + 15 };
        }

        // 5. DETALLE EGRESOS (COMPRAS/INVENTARIO) - NUEVO
        finalY = (doc as any).lastAutoTable.finalY + 15;
        if (finalY > 250) { doc.addPage(); finalY = 20; }

        doc.setFontSize(14);
        doc.text("Detalle de Compras / Inventario", 14, finalY);

        const tablaCompras = balance.itemsCompras.map(c => [
          c.fecha,
          c.nombreArticulo,
          c.solicitanteOProveedor,
          `$${(c.costoTotal || 0).toFixed(2)}`
        ]);

        if (tablaCompras.length > 0) {
          autoTable(doc, {
            startY: finalY + 5,
            head: [['Fecha', 'Artículo', 'Proveedor', 'Costo']],
            body: tablaCompras,
            theme: 'striped',
            styles: { fontSize: 8 },
            foot: [['TOTAL COMPRAS', '', '', `$${balance.egresosComprasUSD.toFixed(2)}`]]
          });
        } else {
           doc.setFontSize(10);
           doc.text("No hay compras registradas en este periodo.", 14, finalY + 10);
        }

        doc.save(`Balance_Financiero_${fechaInicio}_${fechaFin}.pdf`);
        setDownloading(false);
        return; // FIN BALANCE PDF
      }

      // --- LOGICA OTROS REPORTES (Tablas existentes) ---
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

      } else if (tipoReporte === 'SOLVENCIA') {
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
      alert("Hubo un error al generar el PDF. Por favor verifique los datos o la consola.");
    } finally {
      setDownloading(false);
    }
  };

  const generarResumenIA = async () => {
    if (!hasApiKey) return;
    setLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
      let prompt = "";
      
      if (tipoReporte === 'BALANCE' && balance) {
         prompt = `Analiza este Balance Financiero Escolar del periodo ${fechaInicio} al ${fechaFin}:
         Ingresos Totales: $${balance.totalIngresosUSD} (Bs. ${balance.ingresosBs})
         Egresos Totales: $${balance.totalEgresosUSD} (Servicios: $${balance.egresosServiciosUSD}, Nómina: $${balance.egresosNominaUSD}, Compras Inventario: $${balance.egresosComprasUSD})
         Resultado Neto: $${balance.resultadoNetoUSD}
         
         Dame 3 puntos clave sobre la salud financiera y 1 recomendación breve.`;
      } else {
         // Default Solvencia
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
      setAiSummary(response.text || "Sin análisis.");
    } catch (error) {
      setAiSummary("Error IA.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-2xl font-bold mb-6 text-slate-800 flex items-center gap-2">
          <FileText className="text-indigo-600" /> Reportes y Estadísticas
        </h2>

        {/* Selector de Tipo de Reporte */}
        <div className="flex flex-col md:flex-row gap-4 mb-6 border-b pb-6">
          <button 
            onClick={() => setTipoReporte('TRANSACCIONES')}
            className={`flex-1 p-4 rounded-xl border-2 transition-all flex items-center justify-center gap-3 ${tipoReporte === 'TRANSACCIONES' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200 hover:border-gray-300'}`}
          >
            <DollarSign size={24} />
            <div className="text-left">
              <span className="block font-bold">Historial de Pagos</span>
              <span className="text-xs text-gray-500">Filtrar por fecha y verificación</span>
            </div>
          </button>
          
          <button 
            onClick={() => setTipoReporte('SOLVENCIA')}
            className={`flex-1 p-4 rounded-xl border-2 transition-all flex items-center justify-center gap-3 ${tipoReporte === 'SOLVENCIA' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200 hover:border-gray-300'}`}
          >
            <Filter size={24} />
            <div className="text-left">
              <span className="block font-bold">Estado de Solvencia</span>
              <span className="text-xs text-gray-500">Morosos vs Solventes</span>
            </div>
          </button>

          <button 
            onClick={() => setTipoReporte('BALANCE')}
            className={`flex-1 p-4 rounded-xl border-2 transition-all flex items-center justify-center gap-3 ${tipoReporte === 'BALANCE' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200 hover:border-gray-300'}`}
          >
            <PieChart size={24} />
            <div className="text-left">
              <span className="block font-bold">Balance Financiero</span>
              <span className="text-xs text-gray-500">Ingresos - Egresos (Resultados)</span>
            </div>
          </button>
        </div>

        {/* Controles de Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 bg-gray-50 p-4 rounded-lg">
          {tipoReporte !== 'BALANCE' && (
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

          {/* Filtros de Fecha (Comunes para Balance y Transacciones) */}
          {(tipoReporte === 'TRANSACCIONES' || tipoReporte === 'BALANCE') && (
            <>
               <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Desde Fecha</label>
                <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className="w-full border border-gray-300 rounded-md p-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Hasta Fecha</label>
                <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} className="w-full border border-gray-300 rounded-md p-2 text-sm" />
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
              Descargar Reporte PDF
            </button>
        </div>
      </div>

      {/* --- VISTA BALANCE --- */}
      {tipoReporte === 'BALANCE' && balance && (
         <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in">
             {/* Card Ingresos */}
             <div className="bg-green-50 p-6 rounded-xl border border-green-100 relative overflow-hidden">
                 <div className="absolute top-2 right-2 opacity-10"><TrendingUp size={64} className="text-green-800"/></div>
                 <h3 className="text-green-800 font-bold mb-2">Total Ingresos (+)</h3>
                 <p className="text-3xl font-bold text-green-700">${balance.totalIngresosUSD.toFixed(2)}</p>
                 <p className="text-sm text-green-600 mt-1">Bs. {balance.ingresosBs.toFixed(2)}</p>
                 <p className="text-xs text-green-800/60 mt-2">{balance.itemsIngresos.length} Transacciones verificadas</p>
             </div>

             {/* Card Egresos */}
             <div className="bg-red-50 p-6 rounded-xl border border-red-100 relative overflow-hidden">
                 <div className="absolute top-2 right-2 opacity-10"><TrendingDown size={64} className="text-red-800"/></div>
                 <h3 className="text-red-800 font-bold mb-2">Total Egresos (-)</h3>
                 <p className="text-3xl font-bold text-red-700">${balance.totalEgresosUSD.toFixed(2)}</p>
                 <div className="mt-2 text-xs text-red-800 space-y-1">
                     <div className="flex justify-between"><span>Servicios:</span> <span>${balance.egresosServiciosUSD.toFixed(2)}</span></div>
                     <div className="flex justify-between"><span>Nómina:</span> <span>${balance.egresosNominaUSD.toFixed(2)}</span></div>
                     <div className="flex justify-between font-bold border-t border-red-200 pt-1"><span>Compras Inv:</span> <span>${balance.egresosComprasUSD.toFixed(2)}</span></div>
                 </div>
             </div>

             {/* Card Resultado */}
             <div className={`p-6 rounded-xl border relative overflow-hidden flex flex-col justify-center ${balance.resultadoNetoUSD >= 0 ? 'bg-indigo-50 border-indigo-100' : 'bg-orange-50 border-orange-100'}`}>
                 <h3 className="text-slate-700 font-bold mb-2">Resultado Neto (=)</h3>
                 <p className={`text-4xl font-bold ${balance.resultadoNetoUSD >= 0 ? 'text-indigo-700' : 'text-orange-600'}`}>
                     ${balance.resultadoNetoUSD.toFixed(2)}
                 </p>
                 <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold mt-2 w-fit ${balance.resultadoNetoUSD >= 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-orange-100 text-orange-700'}`}>
                     {balance.resultadoNetoUSD >= 0 ? 'SUPERÁVIT (A FAVOR)' : 'DÉFICIT (EN CONTRA)'}
                 </span>
             </div>

             {/* Tablas Resumen Balance */}
             <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-4 rounded-xl border border-gray-100">
                    <h4 className="font-bold text-gray-700 mb-3 border-b pb-2">Últimos Pagos de Servicios</h4>
                    <div className="overflow-x-auto max-h-60">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-gray-50 text-gray-500">
                                <tr><th>Fecha</th><th>Proveedor</th><th className="text-right">Monto</th></tr>
                            </thead>
                            <tbody className="divide-y">
                                {balance.itemsServicios.slice(0, 5).map(s => (
                                    <tr key={s.id}>
                                        <td className="py-2">{s.fechaPago}</td>
                                        <td className="py-2">{s.proveedor}</td>
                                        <td className="py-2 text-right text-red-600">${s.monto.toFixed(2)}</td>
                                    </tr>
                                ))}
                                {balance.itemsServicios.length === 0 && <tr><td colSpan={3} className="py-4 text-center text-gray-400">Sin registros</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-gray-100">
                    <h4 className="font-bold text-gray-700 mb-3 border-b pb-2">Desglose de Ingresos por Método</h4>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-gray-50 text-gray-500">
                                <tr><th>Método</th><th className="text-right">Total Recaudado</th></tr>
                            </thead>
                            <tbody className="divide-y">
                                {Object.entries(balance.itemsIngresos.reduce((acc, curr) => {
                                    acc[curr.metodoPago] = (acc[curr.metodoPago] || 0) + curr.monto;
                                    return acc;
                                }, {} as Record<string, number>)).map(([metodo, monto]) => (
                                    <tr key={metodo}>
                                        <td className="py-2 font-medium">{metodo}</td>
                                        <td className="py-2 text-right text-green-600 font-bold">${monto.toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
             </div>
         </div>
      )}


      {/* --- PREVISUALIZACION TABLA SIMPLE (SOLO SI NO ES BALANCE) --- */}
      {tipoReporte !== 'BALANCE' && (
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

      {/* Sección IA */}
      {hasApiKey && (
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
