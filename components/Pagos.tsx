import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { Representante, MetodoPago, EstadoPago, RegistroPago } from '../types';
import { REQUIERE_VERIFICACION, ANIO_ESCOLAR_ACTUAL } from '../constants';
import { Search, DollarSign, CheckCircle, RefreshCw, Loader2, FileText, ArrowLeft, Printer } from 'lucide-react';
import { jsPDF } from 'jspdf';

export const Pagos: React.FC = () => {
  // Estado Principal
  const [busquedaCedula, setBusquedaCedula] = useState('');
  const [representante, setRepresentante] = useState<Representante | null>(null);
  const [error, setError] = useState('');
  const [saldoPendiente, setSaldoPendiente] = useState(0);
  const [tasaCambio, setTasaCambio] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingRep, setLoadingRep] = useState(false);

  // Estado del Formulario
  const [monto, setMonto] = useState('');
  const [montoBs, setMontoBs] = useState('');
  const [metodo, setMetodo] = useState<MetodoPago>(MetodoPago.PAGO_MOVIL);
  const [referencia, setReferencia] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [formaPago, setFormaPago] = useState('Abono'); 
  const [mesPago, setMesPago] = useState('Septiembre');
  const [anioPago, setAnioPago] = useState(ANIO_ESCOLAR_ACTUAL);
  const [studentId, setStudentId] = useState('');

  // Estado Post-Pago (Recibo)
  const [pagoExitoso, setPagoExitoso] = useState<RegistroPago | null>(null);
  const [saldoRestanteRecibo, setSaldoRestanteRecibo] = useState(0);

  const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre', 'Inscripción'];

  useEffect(() => {
    db.getConfig().then(c => setTasaCambio(c.tasaCambio || 0));
  }, []);

  const buscarRepresentante = async () => {
    if (!busquedaCedula) return;
    setLoadingRep(true);
    setError('');
    setPagoExitoso(null); // Resetear vista de recibo si busca de nuevo
    try {
      const rep = await db.getRepresentanteByCedula(busquedaCedula);
      if (rep) {
        setRepresentante(rep);
        const deuda = await db.calcularSaldoPendiente(rep.cedula);
        setSaldoPendiente(deuda || 0);
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
    const requiereVerificacion = REQUIERE_VERIFICACION.includes(metodo);
    const estadoInicial = requiereVerificacion ? EstadoPago.PENDIENTE_VERIFICACION : EstadoPago.VERIFICADO;
    
    // Calcular nombre estudiante para el recibo
    let nombreEstudiante = "VARIOS";
    if (studentId && studentId !== "VARIOS") {
        const est = representante.alumnos.find(a => a.id === studentId);
        if(est) nombreEstudiante = `${est.nombres} ${est.apellidos}`;
    }

    const nuevoPago: RegistroPago = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      fechaRegistro: new Date().toISOString().split('T')[0],
      fechaPago: new Date().toISOString().split('T')[0],
      cedulaRepresentante: representante.cedula,
      nombreRepresentante: `${representante.nombres} ${representante.apellidos}`,
      matricula: representante.matricula,
      studentId: studentId,
      mes: mesPago,
      anio: anioPago,
      formaPago: formaPago,
      metodoPago: metodo,
      referencia,
      monto: montoNum,
      montoBolivares: isMetodoBolivares(metodo) && montoBs ? parseFloat(montoBs) : undefined,
      tasaCambioAplicada: isMetodoBolivares(metodo) ? tasaCambio : undefined,
      observaciones: observaciones || (nombreEstudiante !== "VARIOS" ? `Pago de ${nombreEstudiante}` : ''),
      estado: estadoInicial
    };

    try {
      await db.savePago(nuevoPago);
      
      // Preparar datos para la vista de éxito / recibo
      const nuevoSaldo = Math.max(0, saldoPendiente - montoNum);
      setSaldoRestanteRecibo(nuevoSaldo);
      setPagoExitoso(nuevoPago);

      // Limpiar formulario interno pero mantener representante
      setMonto('');
      setMontoBs('');
      setReferencia('');
      setObservaciones('');
      
    } catch (e) {
      alert("Error guardando el pago. Verifique conexión.");
    } finally {
      setLoading(false);
    }
  };

  const generarReciboPDF = () => {
    if (!pagoExitoso || !representante) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    
    // --- Header ---
    doc.setFillColor(63, 81, 181); // Indigo Header
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text("RECIBO DE PAGO", pageWidth / 2, 20, { align: 'center' });
    doc.setFontSize(12);
    doc.text("AdminPro - Gestión Educativa", pageWidth / 2, 30, { align: 'center' });

    // --- Info General ---
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.text(`Fecha Emisión: ${new Date().toLocaleDateString()}`, 14, 50);
    doc.text(`Recibo N°: ${pagoExitoso.id.substring(0, 8).toUpperCase()}`, 14, 56);
    
    // --- Datos Representante ---
    doc.setDrawColor(200, 200, 200);
    doc.line(14, 62, pageWidth - 14, 62);
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("DATOS DEL REPRESENTANTE", 14, 70);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Nombre: ${representante.nombres} ${representante.apellidos}`, 14, 78);
    doc.text(`Cédula: ${representante.cedula}`, 14, 84);
    doc.text(`Matrícula Familiar: ${representante.matricula}`, 14, 90);

    // --- Datos del Pago ---
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("DETALLES DE LA TRANSACCIÓN", 14, 105);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    const startY = 115;
    const col2 = pageWidth / 2;

    doc.text(`Concepto: ${pagoExitoso.formaPago} - ${pagoExitoso.mes} ${pagoExitoso.anio}`, 14, startY);
    
    // Resolver nombre alumno
    let nombreAlumno = "Todos / Varios";
    if (pagoExitoso.studentId && pagoExitoso.studentId !== "VARIOS") {
         const alumno = representante.alumnos.find(a => a.id === pagoExitoso.studentId);
         if(alumno) nombreAlumno = `${alumno.nombres} ${alumno.apellidos}`;
    }
    doc.text(`Estudiante: ${nombreAlumno}`, 14, startY + 8);
    
    doc.text(`Método de Pago: ${pagoExitoso.metodoPago}`, col2, startY);
    doc.text(`Referencia: ${pagoExitoso.referencia}`, col2, startY + 8);

    if (pagoExitoso.tasaCambioAplicada) {
        doc.text(`Tasa Cambio: Bs. ${pagoExitoso.tasaCambioAplicada.toFixed(2)}`, col2, startY + 16);
    }

    // --- Caja de Montos ---
    const boxY = 150;
    doc.setDrawColor(0, 0, 0);
    doc.setFillColor(245, 247, 250);
    doc.rect(14, boxY, pageWidth - 28, 45, 'FD');

    doc.setFont("helvetica", "bold");
    doc.text("RESUMEN FINANCIERO", 20, boxY + 10);
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text("Saldo Anterior (Deuda):", 20, boxY + 20);
    doc.text(`$${saldoPendiente.toFixed(2)}`, pageWidth - 30, boxY + 20, { align: 'right' });

    doc.text("Monto Abonado:", 20, boxY + 28);
    doc.setFont("helvetica", "bold");
    doc.text(`$${(pagoExitoso.monto || 0).toFixed(2)}`, pageWidth - 30, boxY + 28, { align: 'right' });
    
    if (pagoExitoso.montoBolivares) {
        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.text(`(Bs. ${pagoExitoso.montoBolivares.toFixed(2)})`, pageWidth - 30, boxY + 33, { align: 'right' });
        doc.setTextColor(0);
        doc.setFontSize(11);
    }

    doc.setDrawColor(200);
    doc.line(20, boxY + 36, pageWidth - 20, boxY + 36);

    doc.setFont("helvetica", "bold");
    doc.text("SALDO PENDIENTE:", 20, boxY + 42);
    doc.setTextColor(200, 0, 0);
    doc.text(`$${saldoRestanteRecibo.toFixed(2)}`, pageWidth - 30, boxY + 42, { align: 'right' });

    // --- Footer ---
    doc.setTextColor(0);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`ESTADO DEL PAGO: ${pagoExitoso.estado.toUpperCase()}`, 14, 210);
    if (pagoExitoso.estado === EstadoPago.PENDIENTE_VERIFICACION) {
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text("* Este recibo es un comprobante de registro. El pago está sujeto a verificación bancaria.", 14, 215);
    }

    doc.save(`Recibo_${pagoExitoso.cedulaRepresentante}_${pagoExitoso.fechaRegistro}.pdf`);
  };

  const resetearVista = () => {
    setPagoExitoso(null);
    setSaldoPendiente(saldoRestanteRecibo); // Actualizar el saldo visual
  };

  // --- VISTA: PAGO EXITOSO / RECIBO ---
  if (pagoExitoso && representante) {
    return (
        <div className="max-w-2xl mx-auto mt-8">
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-green-100">
                <div className="bg-green-600 p-6 text-white text-center">
                    <div className="bg-white text-green-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-md">
                        <CheckCircle size={32} />
                    </div>
                    <h2 className="text-2xl font-bold">¡Pago Registrado!</h2>
                    <p className="opacity-90 mt-1">La transacción se ha guardado correctamente.</p>
                </div>
                
                <div className="p-8 space-y-6">
                    <div className="flex justify-between items-center border-b pb-4">
                        <span className="text-gray-500">Monto Registrado:</span>
                        <div className="text-right">
                             <span className="text-xl font-bold text-gray-800 block">${(pagoExitoso.monto || 0).toFixed(2)}</span>
                             {pagoExitoso.montoBolivares && (
                                <span className="text-sm text-gray-500">Bs. {pagoExitoso.montoBolivares.toFixed(2)}</span>
                             )}
                        </div>
                    </div>
                    
                    <div className="flex justify-between items-center border-b pb-4">
                        <span className="text-gray-500">Saldo Restante:</span>
                        <span className={`text-xl font-bold ${saldoRestanteRecibo > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            ${saldoRestanteRecibo.toFixed(2)}
                        </span>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg text-sm text-gray-600">
                        <p><strong>Estado:</strong> {pagoExitoso.estado}</p>
                        <p><strong>Referencia:</strong> {pagoExitoso.referencia}</p>
                        {pagoExitoso.estado === EstadoPago.PENDIENTE_VERIFICACION && (
                            <p className="mt-2 text-xs text-orange-600 flex items-center gap-1">
                                <RefreshCw size={12}/> Requiere verificación en el módulo administrativo.
                            </p>
                        )}
                    </div>

                    <div className="flex gap-4 pt-2">
                        <button 
                            onClick={generarReciboPDF}
                            className="flex-1 bg-slate-800 text-white py-3 rounded-xl font-bold hover:bg-slate-700 flex justify-center items-center gap-2 shadow-lg transition-transform hover:-translate-y-1"
                        >
                            <Printer size={20} /> Descargar Recibo
                        </button>
                        <button 
                            onClick={resetearVista}
                            className="flex-1 bg-white text-slate-700 border-2 border-slate-200 py-3 rounded-xl font-bold hover:bg-slate-50 flex justify-center items-center gap-2"
                        >
                            <ArrowLeft size={20} /> Nuevo Pago
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
  }

  // --- VISTA: FORMULARIO PAGO (DEFAULT) ---
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <DollarSign className="text-green-600" /> Caja / Registrar Pago
          </h2>
          <div className="flex items-center gap-2 text-sm bg-indigo-50 px-3 py-1 rounded-full text-indigo-700">
            <RefreshCw size={14} />
            <span>Tasa Actual: <strong>Bs. {(tasaCambio || 0).toFixed(2)}</strong></span>
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
            <h3 className="font-bold text-lg mb-4 text-slate-700">Datos Matrícula</h3>
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

              <div className="mt-6 p-4 bg-orange-50 rounded-lg border border-orange-100">
                <p className="text-orange-800 text-xs uppercase font-bold tracking-wider">Saldo Pendiente</p>
                <div className="flex flex-col">
                  <span className="text-2xl font-bold text-orange-600">${(saldoPendiente || 0).toFixed(2)}</span>
                  <span className="text-sm text-orange-400 font-medium">~ Bs. {((saldoPendiente || 0) * (tasaCambio || 0)).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 lg:col-span-2">
            <h3 className="font-bold text-lg mb-4 text-slate-700">Detalles del Pago</h3>
            
            {/* Nuevos Selectores: Estudiante, Mes, Año */}
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
                   <label className="block text-xs font-bold text-indigo-700 mb-1">Mes a Pagar</label>
                   <select value={mesPago} onChange={(e) => setMesPago(e.target.value)} className="w-full text-sm border-gray-300 rounded p-1.5">
                      {meses.map(m => <option key={m} value={m}>{m}</option>)}
                   </select>
                </div>
                <div>
                   <label className="block text-xs font-bold text-indigo-700 mb-1">Año Escolar</label>
                   <input type="text" value={anioPago} onChange={(e) => setAnioPago(e.target.value)} className="w-full text-sm border-gray-300 rounded p-1.5" />
                </div>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Forma</label>
                <div className="flex gap-4 mt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={formaPago === 'Abono'} onChange={() => setFormaPago('Abono')} />
                    <span>Abono</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={formaPago === 'Total'} onChange={() => {
                        setFormaPago('Total');
                        handleMontoUsdChange(saldoPendiente.toString());
                    }} />
                    <span>Total Deuda</span>
                  </label>
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
              className={`w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 font-bold flex justify-center items-center gap-2 shadow-md ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {loading ? <Loader2 className="animate-spin" /> : <CheckCircle size={20} />}
              {loading ? 'Procesando...' : 'Registrar Pago'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};