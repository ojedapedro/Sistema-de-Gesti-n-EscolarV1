
import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { Representante, MetodoPago, EstadoPago, RegistroPago, NivelConfig } from '../types';
import { ANIO_ESCOLAR_ACTUAL, MENSUALIDADES } from '../constants';
import { Search, DollarSign, CheckCircle, RefreshCw, Loader2, FileText, ArrowLeft, Printer, AlertTriangle, TrendingDown, Save, Calendar, Clock, CreditCard, Tag, FileBarChart } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export const Pagos: React.FC = () => {
  // Estado Principal
  const [busquedaCedula, setBusquedaCedula] = useState('');
  const [representante, setRepresentante] = useState<Representante | null>(null);
  const [error, setError] = useState('');
  
  // Saldo Real (Puede ser negativo si hay saldo a favor)
  const [saldoReal, setSaldoReal] = useState(0);
  
  const [tasaCambio, setTasaCambio] = useState(0);
  const [nivelesConfig, setNivelesConfig] = useState<NivelConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingRep, setLoadingRep] = useState(false);
  const [loadingReporte, setLoadingReporte] = useState(false);
  const [savingTasa, setSavingTasa] = useState(false);

  // Estado del Formulario
  const [fechaOperacion, setFechaOperacion] = useState(new Date().toISOString().split('T')[0]);
  const [monto, setMonto] = useState('');
  const [montoBs, setMontoBs] = useState('');
  const [metodo, setMetodo] = useState<MetodoPago>(MetodoPago.PAGO_MOVIL);
  const [referencia, setReferencia] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [formaPago, setFormaPago] = useState('Abono'); 
  const [mesPago, setMesPago] = useState('Septiembre');
  const [anioPago, setAnioPago] = useState(ANIO_ESCOLAR_ACTUAL);
  const [studentId, setStudentId] = useState('');
  
  // Lógica Pronto Pago
  const [aplicarProntoPago, setAplicarProntoPago] = useState(false);

  // Estado Post-Pago (Recibo)
  const [pagoExitoso, setPagoExitoso] = useState<RegistroPago | null>(null);
  const [saldoAnteriorRecibo, setSaldoAnteriorRecibo] = useState(0);
  const [saldoFinalRecibo, setSaldoFinalRecibo] = useState(0);

  const meses = ['Inscripción', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto'];

  useEffect(() => {
    const init = async () => {
      const c = await db.getConfig();
      setTasaCambio(c.tasaCambio || 0);
      const n = await db.getNiveles();
      setNivelesConfig(n);
    };
    init();
  }, []);

  // Efecto para detectar fecha de pronto pago (día <= 25)
  useEffect(() => {
    if (fechaOperacion) {
        const partes = fechaOperacion.split('-');
        const dia = parseInt(partes[2]);
        // Si es el día 25 o antes, sugerir pronto pago activado
        if (dia <= 25) {
            setAplicarProntoPago(true);
        } else {
            setAplicarProntoPago(false);
        }
    }
  }, [fechaOperacion]);

  const buscarRepresentante = async () => {
    if (!busquedaCedula) return;
    setLoadingRep(true);
    setError('');
    setPagoExitoso(null);
    try {
      // Recargar tasa al buscar para asegurar frescura
      if (tasaCambio === 0) {
          const c = await db.getConfig();
          setTasaCambio(c.tasaCambio || 0);
      }

      const rep = await db.getRepresentanteByCedula(busquedaCedula);
      if (rep) {
        setRepresentante(rep);
        const saldoCalc = await db.calcularSaldoPendiente(rep.cedula);
        setSaldoReal(saldoCalc);
        if (rep.alumnos.length > 0) setStudentId(rep.alumnos[0].id);
      } else {
        setRepresentante(null);
        setError('Representante no encontrado');
      }
    } catch (e) {
      setError('Error de conexión');
    } finally {
      setLoadingRep(false);
    }
  };

  const isMetodoBolivares = (m: MetodoPago) => {
    return [MetodoPago.PAGO_MOVIL, MetodoPago.TRANSFERENCIA, MetodoPago.EFECTIVO_BS, MetodoPago.TDD].includes(m);
  };

  const handleTasaChange = (val: string) => {
    const nuevaTasa = parseFloat(val);
    setTasaCambio(isNaN(nuevaTasa) ? 0 : nuevaTasa);

    if (!isNaN(nuevaTasa) && nuevaTasa > 0 && monto) {
        if (isMetodoBolivares(metodo)) {
             setMontoBs((parseFloat(monto) * nuevaTasa).toFixed(2));
        }
    }
  };

  const guardarTasaManual = async () => {
    if (tasaCambio <= 0) return;
    setSavingTasa(true);
    try {
        await db.saveConfig({ tasaCambio, fechaActualizacion: new Date().toISOString() });
        alert("Tasa actualizada correctamente en el sistema.");
    } catch (e) {
        alert("Error al guardar la tasa.");
    } finally {
        setSavingTasa(false);
    }
  };

  const handleMontoBsChange = (val: string) => {
    setMontoBs(val);
    const valBs = parseFloat(val);
    if (!isNaN(valBs) && tasaCambio > 0) {
      setMonto((valBs / tasaCambio).toFixed(2));
    } else {
      setMonto('');
    }
  };

  const handleMontoUsdChange = (val: string) => {
    setMonto(val);
    const valUsd = parseFloat(val);
    if (isMetodoBolivares(metodo) && !isNaN(valUsd) && tasaCambio > 0) {
      setMontoBs((valUsd * tasaCambio).toFixed(2));
    }
  };

  // Helper para calcular la mensualidad familiar total
  const calcularMensualidadFamiliar = () => {
    if (!representante) return 0;
    return representante.alumnos.reduce((acc, alu) => {
      const config = nivelesConfig.find(n => n.nivel === alu.nivel);
      const precio = config ? config.precio : (MENSUALIDADES[alu.nivel] || 0);
      return acc + precio;
    }, 0);
  };

  const calcularDescuentoProntoPago = () => {
      if (!representante) return 0;
      // $5 por cada alumno en la matrícula
      return representante.alumnos.length * 5; 
  };

  // --- REPORTE DE CIERRE DIARIO ---
  const generarCierreDiario = async () => {
    setLoadingReporte(true);
    try {
        // 1. Obtener todos los pagos
        const allPagos = await db.getPagos();

        // 2. Filtrar por la fecha seleccionada en el formulario (fechaOperacion)
        // Se considera la 'fechaPago' (contable) para el cierre
        const pagosDelDia = allPagos.filter(p => 
            p.fechaPago === fechaOperacion && 
            p.estado === EstadoPago.VERIFICADO // Solo pagos efectivos/verificados
        );

        if (pagosDelDia.length === 0) {
            alert("No hay pagos verificados registrados para la fecha seleccionada.");
            setLoadingReporte(false);
            return;
        }

        // 3. Calcular Totales por Método
        const resumenMetodos: Record<string, { count: number, totalUSD: number, totalBs: number }> = {};
        
        pagosDelDia.forEach(p => {
            if (!resumenMetodos[p.metodoPago]) {
                resumenMetodos[p.metodoPago] = { count: 0, totalUSD: 0, totalBs: 0 };
            }
            resumenMetodos[p.metodoPago].count += 1;
            resumenMetodos[p.metodoPago].totalUSD += (p.monto || 0);
            resumenMetodos[p.metodoPago].totalBs += (p.montoBolivares || 0);
        });

        // Totales Generales
        const totalGeneralUSD = pagosDelDia.reduce((sum, p) => sum + (p.monto || 0), 0);
        const totalGeneralBs = pagosDelDia.reduce((sum, p) => sum + (p.montoBolivares || 0), 0);

        // 4. Generar PDF
        const doc = new jsPDF();
        
        // Encabezado
        doc.setFontSize(18);
        doc.text("Reporte de Cierre de Caja Diario", 14, 20);
        
        doc.setFontSize(11);
        doc.text(`Fecha de Cierre: ${fechaOperacion}`, 14, 28);
        doc.text(`Generado el: ${new Date().toLocaleString()}`, 14, 34);
        doc.text(`Total Transacciones: ${pagosDelDia.length}`, 14, 40);

        // --- TABLA RESUMEN ---
        doc.setFontSize(14);
        doc.text("Resumen General por Método", 14, 55);

        const bodyResumen = Object.entries(resumenMetodos).map(([metodo, data]) => [
            metodo,
            data.count,
            `$${data.totalUSD.toFixed(2)}`,
            data.totalBs > 0 ? `Bs. ${data.totalBs.toFixed(2)}` : '-'
        ]);

        autoTable(doc, {
            startY: 60,
            head: [['Método de Pago', 'Cant.', 'Total USD', 'Total Bs']],
            body: bodyResumen,
            foot: [['TOTAL GENERAL', pagosDelDia.length, `$${totalGeneralUSD.toFixed(2)}`, `Bs. ${totalGeneralBs.toFixed(2)}`]],
            theme: 'striped',
            headStyles: { fillColor: [44, 62, 80] },
            footStyles: { fillColor: [44, 62, 80], textColor: 255, fontStyle: 'bold' }
        });

        // --- TABLA DETALLADA ---
        let finalY = (doc as any).lastAutoTable.finalY + 15;
        doc.text("Detalle de Movimientos", 14, finalY);

        const bodyDetalle = pagosDelDia.map(p => [
            p.nombreRepresentante.substring(0, 20), // Truncar nombre largo
            p.metodoPago,
            p.referencia,
            `${p.mes || '-'} / ${p.formaPago || '-'}`, // Concepto breve
            `$${(p.monto || 0).toFixed(2)}`,
            p.montoBolivares ? `Bs. ${p.montoBolivares.toFixed(2)}` : '-'
        ]);

        autoTable(doc, {
            startY: finalY + 5,
            head: [['Representante', 'Método', 'Ref', 'Concepto', 'Monto $', 'Monto Bs']],
            body: bodyDetalle,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [100, 100, 100] },
        });

        // Espacio para firmas
        const pageHeight = doc.internal.pageSize.height;
        doc.line(40, pageHeight - 30, 90, pageHeight - 30);
        doc.text("Cajero / Responsable", 45, pageHeight - 25);

        doc.line(120, pageHeight - 30, 170, pageHeight - 30);
        doc.text("Administración", 130, pageHeight - 25);

        doc.save(`Cierre_Caja_${fechaOperacion}.pdf`);

    } catch (e) {
        console.error(e);
        alert("Error generando el cierre de caja.");
    } finally {
        setLoadingReporte(false);
    }
  };

  const procesarPago = async () => {
    if (!representante || !monto || !referencia) {
      setError('Complete todos los campos del pago');
      return;
    }

    const montoNum = parseFloat(monto);
    if (isNaN(montoNum) || montoNum <= 0) {
      setError('Monto inválido');
      return;
    }

    setLoading(true);

    try {
      // 1. VERIFICACIÓN DE DUPLICADOS
      const historialPagos = await db.getPagos();
      const posibleDuplicado = historialPagos.find(p => 
          p.cedulaRepresentante === representante.cedula &&
          p.referencia.trim().toUpperCase() === referencia.trim().toUpperCase() &&
          Math.abs(p.monto - montoNum) < 0.01 
      );

      if (posibleDuplicado) {
          setLoading(false); 
          const confirmarDuplicado = window.confirm(
              `⚠️ ALERTA DE DUPLICADO ⚠️\n\nReferencia: ${referencia}\nMonto: $${montoNum}\n\n¿Registrar nuevamente?`
          );
          if (!confirmarDuplicado) return;
          setLoading(true);
      }

      // 2. LÓGICA DE ESTADO
      const esOficinaVirtual = referencia.trim().toUpperCase().startsWith('OV-');
      const estadoInicial = esOficinaVirtual ? EstadoPago.PENDIENTE_VERIFICACION : EstadoPago.VERIFICADO;
      
      let nombreEstudiante = "VARIOS";
      if (studentId && studentId !== "VARIOS") {
          const est = representante.alumnos.find(a => a.id === studentId);
          if(est) nombreEstudiante = `${est.nombres} ${est.apellidos}`;
      }

      // Construcción de Observaciones
      let obsFinal = observaciones;
      if (nombreEstudiante !== "VARIOS" && !obsFinal) {
          obsFinal = `Pago de ${nombreEstudiante}`;
      }
      if (aplicarProntoPago) {
          const descuento = calcularDescuentoProntoPago();
          obsFinal += ` [PRONTO PAGO APLICADO: -$${descuento}]`;
      }

      // Calcular Nuevo Saldo
      const nuevoSaldo = saldoReal - montoNum;
      const etiquetaFormaPago = nuevoSaldo <= 0 ? 'Cancelación / Adelanto' : 'Abono';

      const nuevoPago: RegistroPago = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        fechaRegistro: new Date().toISOString().split('T')[0], // Fecha Auditoría (Hoy)
        fechaPago: fechaOperacion, // Fecha Seleccionada (Contable)
        cedulaRepresentante: representante.cedula,
        nombreRepresentante: `${representante.nombres} ${representante.apellidos}`,
        matricula: representante.matricula,
        studentId: studentId,
        mes: mesPago,
        anio: anioPago,
        formaPago: etiquetaFormaPago,
        metodoPago: metodo,
        referencia,
        monto: montoNum,
        montoBolivares: isMetodoBolivares(metodo) && montoBs ? parseFloat(montoBs) : undefined,
        tasaCambioAplicada: isMetodoBolivares(metodo) ? tasaCambio : undefined,
        observaciones: obsFinal,
        estado: estadoInicial
      };

      await db.savePago(nuevoPago);
      
      setSaldoAnteriorRecibo(saldoReal);
      setSaldoFinalRecibo(nuevoSaldo);
      setPagoExitoso(nuevoPago);

      setMonto('');
      setMontoBs('');
      setReferencia('');
      setObservaciones('');
      
    } catch (e) {
      console.error(e);
      alert("Error procesando el pago. Verifique conexión.");
    } finally {
      setLoading(false);
    }
  };

  const generarReciboPDF = () => {
    if (!pagoExitoso || !representante) return;
    try {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.width;
        
        doc.setFillColor(63, 81, 181);
        doc.rect(0, 0, pageWidth, 40, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        
        const tituloRecibo = saldoFinalRecibo <= 0 ? "RECIBO DE PAGO" : "RECIBO DE ABONO";
        doc.text(tituloRecibo, pageWidth / 2, 20, { align: 'center' });
        doc.setFontSize(12);
        doc.text("AdminPro - Gestión Educativa", pageWidth / 2, 30, { align: 'center' });

        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);
        doc.text(`Fecha Emisión: ${new Date().toLocaleDateString()}`, 14, 50);
        doc.text(`Fecha Operación: ${pagoExitoso.fechaPago}`, 14, 56);
        doc.text(`Recibo N°: ${pagoExitoso.id.substring(0, 8).toUpperCase()}`, 14, 62);
        
        doc.setDrawColor(200, 200, 200);
        doc.line(14, 68, pageWidth - 14, 68);
        
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("DATOS DEL REPRESENTANTE", 14, 78);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.text(`Nombre: ${representante.nombres} ${representante.apellidos}`, 14, 86);
        doc.text(`Cédula: ${representante.cedula}`, 14, 92);
        doc.text(`Matrícula Familiar: ${representante.matricula}`, 14, 98);

        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("DETALLES DE LA TRANSACCIÓN", 14, 113);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);

        const startY = 123;
        const col2 = pageWidth / 2;

        doc.text(`Concepto: ${pagoExitoso.mes} ${pagoExitoso.anio}`, 14, startY);
        let nombreAlumno = "Todos / Varios";
        if (pagoExitoso.studentId && pagoExitoso.studentId !== "VARIOS") {
            const alumno = representante.alumnos.find(a => a.id === pagoExitoso.studentId);
            if(alumno) nombreAlumno = `${alumno.nombres} ${alumno.apellidos}`;
        }
        doc.text(`Estudiante: ${nombreAlumno}`, 14, startY + 8);
        doc.text(`Método: ${pagoExitoso.metodoPago}`, col2, startY);
        doc.text(`Ref: ${pagoExitoso.referencia}`, col2, startY + 8);

        if (pagoExitoso.tasaCambioAplicada) {
            doc.text(`Tasa Cambio: Bs. ${pagoExitoso.tasaCambioAplicada.toFixed(2)}`, col2, startY + 16);
        }

        const boxY = 155;
        doc.setDrawColor(0, 0, 0);
        doc.setFillColor(245, 247, 250);
        doc.rect(14, boxY, pageWidth - 28, 55, 'FD');

        doc.setFont("helvetica", "bold");
        doc.text("ESTADO DE CUENTA", 20, boxY + 10);
        doc.setFontSize(11);
        doc.setFont("helvetica", "normal");
        
        const textoSaldoAnt = saldoAnteriorRecibo > 0 ? "Saldo Anterior (Pendiente):" : "Saldo Anterior (Crédito):";
        doc.text(textoSaldoAnt, 20, boxY + 20);
        const valorAntStr = `$${Math.abs(saldoAnteriorRecibo).toFixed(2)} ${saldoAnteriorRecibo < 0 ? '(Crédito)' : ''}`;
        doc.text(valorAntStr, pageWidth - 30, boxY + 20, { align: 'right' });

        doc.text("Monto Cancelado (-):", 20, boxY + 28);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0, 100, 0);
        doc.text(`$${(pagoExitoso.monto || 0).toFixed(2)}`, pageWidth - 30, boxY + 28, { align: 'right' });
        doc.setTextColor(0);
        
        if (pagoExitoso.montoBolivares) {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(100);
            doc.text(`(Bs. ${pagoExitoso.montoBolivares.toFixed(2)})`, pageWidth - 30, boxY + 33, { align: 'right' });
            doc.setTextColor(0);
            doc.setFontSize(11);
        }

        doc.setDrawColor(200);
        doc.line(20, boxY + 38, pageWidth - 20, boxY + 38);

        doc.setFont("helvetica", "bold");
        let labelFinal = "SALDO RESTANTE (DEUDOR):";
        if (saldoFinalRecibo <= 0) labelFinal = "SALDO A FAVOR / CRÉDITO:";
        doc.text(labelFinal, 20, boxY + 45);
        if (saldoFinalRecibo > 0) doc.setTextColor(200, 0, 0); 
        else doc.setTextColor(0, 150, 0);
        doc.text(`$${Math.abs(saldoFinalRecibo).toFixed(2)}`, pageWidth - 30, boxY + 45, { align: 'right' });

        doc.setTextColor(0);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.text(`ESTADO DEL PAGO: ${pagoExitoso.estado.toUpperCase()}`, 14, 230);
        
        doc.save(`Recibo_${pagoExitoso.cedulaRepresentante}_${pagoExitoso.id.substring(0,4)}.pdf`);
    } catch (e) {
        alert("Error al generar el PDF.");
    }
  };

  // --- VISTA: FORMULARIO PAGO (DEFAULT) ---
  const mensualidadFamiliar = calcularMensualidadFamiliar();
  const descuentoProntoPago = calcularDescuentoProntoPago();
  
  // Lógica de desglose para visualización
  const deudaVencida = Math.max(0, saldoReal - mensualidadFamiliar);
  const deudaMesActual = saldoReal > 0 ? Math.min(saldoReal, mensualidadFamiliar) : 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <DollarSign className="text-green-600" /> Caja / Registrar Pago
          </h2>
          
          <div className="flex gap-2">
            {/* BOTÓN CIERRE DE CAJA */}
            <button 
                onClick={generarCierreDiario}
                disabled={loadingReporte}
                className="flex items-center gap-2 bg-slate-700 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-slate-800 transition-colors shadow-sm"
                title="Generar PDF con cierre del día seleccionado"
            >
                {loadingReporte ? <Loader2 size={16} className="animate-spin" /> : <FileBarChart size={16} />}
                Cierre Caja
            </button>

            <div className="flex items-center gap-2 bg-white border border-gray-200 p-1.5 rounded-lg shadow-sm">
                <span className="text-xs font-bold text-gray-500 pl-2">Tasa BCV:</span>
                <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-sm">Bs.</span>
                    <input
                        type="number"
                        value={tasaCambio}
                        onChange={(e) => handleTasaChange(e.target.value)}
                        className="w-24 pl-8 pr-2 py-1 border border-indigo-100 rounded bg-indigo-50 text-indigo-700 font-bold text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        placeholder="0.00"
                    />
                </div>
                <button 
                    onClick={guardarTasaManual} 
                    disabled={savingTasa}
                    className="p-1.5 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200"
                >
                    {savingTasa ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                </button>
            </div>
          </div>
        </div>
        
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="Buscar por Cédula"
            value={busquedaCedula}
            onChange={(e) => setBusquedaCedula(e.target.value)}
            className="flex-1 border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button 
            onClick={buscarRepresentante}
            disabled={loadingRep}
            className="bg-slate-800 text-white px-6 rounded-lg hover:bg-slate-700 flex items-center justify-center min-w-[80px]"
          >
            {loadingRep ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />}
          </button>
        </div>
        {error && <p className="text-red-500 mt-2 text-sm">{error}</p>}
      </div>

      {representante && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 lg:col-span-1">
            <h3 className="font-bold text-lg mb-4 text-slate-700">Ficha Financiera</h3>
            <div className="space-y-3 text-sm">
              <p><span className="font-semibold">Rep:</span> {representante.nombres} {representante.apellidos}</p>
              <p><span className="font-semibold">Cédula:</span> {representante.cedula}</p>
              <p><span className="font-semibold">Matrícula:</span> <span className="bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded text-xs">{representante.matricula}</span></p>
              
              <div className="border-t pt-3 mt-3">
                <p className="font-semibold mb-2">Alumnos:</p>
                {representante.alumnos.map((a, i) => (
                  <div key={i} className="mb-2 pl-2 border-l-2 border-indigo-200">
                    <p>{a.nombres} {a.apellidos}</p>
                    <p className="text-xs text-gray-500">{a.nivel} - Sec {a.seccion}</p>
                  </div>
                ))}
              </div>

              {/* TARJETA DE SALDO REAL */}
              <div className={`mt-6 p-4 rounded-lg border shadow-sm ${saldoReal > 0 ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'}`}>
                <p className={`text-xs uppercase font-bold tracking-wider mb-1 flex items-center gap-1 ${saldoReal > 0 ? 'text-orange-800' : 'text-green-800'}`}>
                   {saldoReal > 0 ? <AlertTriangle size={12}/> : <CheckCircle size={12}/>}
                   {saldoReal > 0 ? 'Total a Pagar (Hoy)' : 'Saldo a Favor (Crédito)'}
                </p>
                
                <div className="flex flex-col mb-2">
                  <span className={`text-3xl font-bold ${saldoReal > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                    ${Math.abs(saldoReal).toFixed(2)}
                  </span>
                  <span className={`text-sm font-medium ${saldoReal > 0 ? 'text-orange-400' : 'text-green-500'}`}>
                    ~ Bs. {Math.abs(saldoReal * (tasaCambio || 0)).toFixed(2)}
                  </span>
                </div>

                {/* DESGLOSE EXACTO: MES ACTUAL + ATRASOS */}
                {saldoReal > 0 && (
                  <div className="mt-3 bg-white/60 p-2 rounded text-xs text-gray-700 border border-gray-100">
                     <div className="flex justify-between items-center mb-1 border-b border-gray-200 pb-1">
                        <span className="flex items-center gap-1"><Calendar size={10} /> Mes en Curso:</span>
                        <span className="font-bold">${deudaMesActual.toFixed(2)}</span>
                     </div>
                     <div className="flex justify-between items-center pt-1 text-red-600">
                        <span className="flex items-center gap-1"><Clock size={10} /> Atrasos Vencidos:</span>
                        <span className="font-bold">${deudaVencida.toFixed(2)}</span>
                     </div>
                  </div>
                )}

                {saldoReal <= 0 && (
                  <div className="mt-2 text-[10px] text-green-700 leading-tight">
                    * El representante se encuentra solvente al día de hoy.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 lg:col-span-2">
            <h3 className="font-bold text-lg mb-4 text-slate-700">Registrar Nueva Transacción</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 bg-indigo-50 p-4 rounded-lg">
                <div>
                   <label className="block text-xs font-bold text-indigo-700 mb-1">Estudiante</label>
                   <select value={studentId} onChange={(e) => setStudentId(e.target.value)} className="w-full text-sm border-gray-300 rounded p-1.5">
                      <option value="VARIOS">VARIOS / TODOS</option>
                      {representante.alumnos.map(alu => (
                        <option key={alu.id} value={alu.id}>{alu.nombres}</option>
                      ))}
                   </select>
                </div>
                <div>
                   <label className="block text-xs font-bold text-indigo-700 mb-1">Mes a Imputar</label>
                   <select value={mesPago} onChange={(e) => setMesPago(e.target.value)} className="w-full text-sm border-gray-300 rounded p-1.5">
                      {meses.map(m => <option key={m} value={m}>{m}</option>)}
                   </select>
                </div>
                <div>
                   <label className="block text-xs font-bold text-indigo-700 mb-1">Fecha Operación</label>
                   <input 
                    type="date" 
                    value={fechaOperacion} 
                    onChange={(e) => setFechaOperacion(e.target.value)} 
                    className="w-full text-sm border-gray-300 rounded p-1.5" 
                   />
                </div>
            </div>

            {/* SECCIÓN PRONTO PAGO */}
            <div className="mb-4">
               <div className="flex items-center gap-2 mb-2">
                   <input 
                    type="checkbox" 
                    id="chkProntoPago"
                    checked={aplicarProntoPago}
                    onChange={(e) => setAplicarProntoPago(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                   />
                   <label htmlFor="chkProntoPago" className="text-sm font-bold text-gray-700 flex items-center gap-2 select-none cursor-pointer">
                      <Tag size={16} className={`text-${aplicarProntoPago ? 'green' : 'gray'}-600`} /> 
                      Aplicar Descuento Pronto Pago (-$5/alumno)
                   </label>
               </div>
               {aplicarProntoPago ? (
                   <p className="text-xs text-green-600 pl-6">
                       <span className="font-bold">¡ACTIVO!</span> Se descontarán <b>${descuentoProntoPago}</b> del saldo si elige pagar el "Total". 
                       (Fecha válida: Día &le; 25).
                   </p>
               ) : (
                   <p className="text-xs text-gray-400 pl-6">
                       Descuento no disponible para la fecha seleccionada (Día {parseInt(fechaOperacion.split('-')[2])}).
                   </p>
               )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
               <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Método de Pago</label>
                <select 
                  value={metodo}
                  onChange={(e) => {
                    setMetodo(e.target.value as MetodoPago);
                    setMonto('');
                    setMontoBs('');
                  }}
                  className="w-full border border-gray-300 rounded-md p-2"
                >
                  {Object.values(MetodoPago).map(m => <option key={m} value={m}>{m}</option>)}
                </select>
               </div>
               <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo Transacción</label>
                <div className="flex gap-2 mt-1">
                  <button 
                    onClick={() => {
                        setFormaPago('Abono');
                        setMonto('');
                        setMontoBs('');
                    }}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-bold border transition-all flex items-center justify-center gap-2 ${
                        formaPago === 'Abono' 
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-200' 
                        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <CreditCard size={16} /> Abono
                  </button>
                  <button 
                    onClick={() => {
                        setFormaPago('Total');
                        if(saldoReal > 0) {
                            // Si aplica pronto pago, el monto a pagar es Saldo - Descuento
                            // El sistema registrará este monto neto.
                            const montoFinal = aplicarProntoPago 
                                ? Math.max(0, saldoReal - descuentoProntoPago) 
                                : saldoReal;
                            handleMontoUsdChange(montoFinal.toString());
                        }
                    }}
                    disabled={saldoReal <= 0}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-bold border transition-all flex items-center justify-center gap-2 ${
                        formaPago === 'Total' 
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-200' 
                        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                    } ${saldoReal <= 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <CheckCircle size={16} /> Total
                  </button>
                </div>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
              {isMetodoBolivares(metodo) && (
                <div>
                  <label className="block text-sm font-bold text-indigo-700 mb-1 flex items-center gap-1">
                     Monto en Bolívares (Bs)
                  </label>
                  <input 
                    type="number" 
                    value={montoBs}
                    onChange={(e) => handleMontoBsChange(e.target.value)}
                    className="w-full border border-indigo-300 rounded-md p-2 font-mono"
                    placeholder="0.00"
                  />
                </div>
              )}
              
              <div className={!isMetodoBolivares(metodo) ? "md:col-span-2" : ""}>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                  Monto a Registrar ($ USD)
                </label>
                <input 
                  type="number" 
                  value={monto}
                  onChange={(e) => handleMontoUsdChange(e.target.value)}
                  readOnly={isMetodoBolivares(metodo) && formaPago === 'Abono' && montoBs !== ''}
                  className={`w-full border border-gray-300 rounded-md p-2 font-mono text-lg ${isMetodoBolivares(metodo) ? 'bg-gray-100 text-gray-600' : 'bg-white'}`}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Referencia / Comprobante</label>
              <input 
                type="text" 
                value={referencia}
                onChange={(e) => setReferencia(e.target.value)}
                className="w-full border border-gray-300 rounded-md p-2"
                placeholder="Ej: 12345678"
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
              <textarea 
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                className="w-full border border-gray-300 rounded-md p-2 h-20"
              ></textarea>
            </div>

            <button 
              onClick={procesarPago}
              disabled={loading}
              className={`w-full bg-slate-800 text-white py-3 rounded-lg hover:bg-slate-700 font-bold flex justify-center items-center gap-2 shadow-md ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {loading ? <Loader2 className="animate-spin" /> : <CheckCircle size={20} />}
              {loading ? 'Procesando...' : 'Registrar Operación'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
