
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/db';
import { Representante, RegistroPago, MetodoPago, EstadoPago, NivelConfig } from '../types';
import { Search, DollarSign, Printer, Loader2, Calendar, User, CreditCard, RefreshCw, CheckCircle, AlertCircle, BarChart3, Calculator } from 'lucide-react';
import { MENSUALIDADES, ANIO_ESCOLAR_ACTUAL, LOGO_URL } from '../constants';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Helper de Imagen
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
      if (ctx) { ctx.drawImage(img, 0, 0); resolve(canvas.toDataURL("image/png")); } 
      else { resolve(null); }
    };
    img.onerror = () => resolve(null);
  });
};

interface DetalleSaldoAlumno {
    id: string;
    nombre: string;
    nivel: string;
    seccion: string;
    costo: number;
    pagado: number;
    pendiente: number;
    estado: 'SOLVENTE' | 'DEBE';
}

export const Pagos: React.FC = () => {
    // --- ESTADOS ---
    const [cedulaBusqueda, setCedulaBusqueda] = useState('');
    const [representante, setRepresentante] = useState<Representante | null>(null);
    const [historialPagos, setHistorialPagos] = useState<RegistroPago[]>([]);
    
    // Configuración
    const [tasaCambio, setTasaCambio] = useState(0);
    const [nivelesConfig, setNivelesConfig] = useState<NivelConfig[]>([]);
    
    // UI Loading
    const [loading, setLoading] = useState(false);
    const [searching, setSearching] = useState(false);
    
    // Cierre de Caja
    const [loadingCierre, setLoadingCierre] = useState(false);
    const [fechaCierre, setFechaCierre] = useState(new Date().toISOString().split('T')[0]);

    // Formulario de Pago
    const [estudianteId, setEstudianteId] = useState('TODOS');
    const [mesPago, setMesPago] = useState('Septiembre');
    const [anioPago, setAnioPago] = useState(ANIO_ESCOLAR_ACTUAL);
    
    const [metodo, setMetodo] = useState<MetodoPago>(MetodoPago.PAGO_MOVIL);
    const [formaPago, setFormaPago] = useState<'ABONO' | 'TOTAL'>('ABONO');
    
    const [montoUSD, setMontoUSD] = useState('');
    const [montoBs, setMontoBs] = useState('');
    
    const [referencia, setReferencia] = useState('');
    const [observacion, setObservacion] = useState('');
    
    // Estado calculado (Saldo)
    const [saldoReal, setSaldoReal] = useState(0);
    const [detallesAlumnos, setDetallesAlumnos] = useState<DetalleSaldoAlumno[]>([]);

    const MESES = [
        "Inscripción", "Septiembre", "Octubre", "Noviembre", "Diciembre", 
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto"
    ];

    // --- EFECTOS ---
    useEffect(() => {
        const loadConfig = async () => {
            try {
                const [conf, niv] = await Promise.all([db.getConfig(), db.getNiveles()]);
                setTasaCambio(conf.tasaCambio);
                setNivelesConfig(niv);
                
                // Determinar mes actual por defecto
                const mesActualIdx = new Date().getMonth();
                if (mesActualIdx >= 8) setMesPago(MESES[mesActualIdx - 7]); 
                else setMesPago(MESES[mesActualIdx + 5]);
                
            } catch (e) { console.error(e); }
        };
        loadConfig();
    }, []);

    // Efecto para calcular saldos detallados cada vez que cambia el representante o su historial
    useEffect(() => {
        if (representante) {
            calcularEstadoCuenta();
        }
    }, [historialPagos, representante, nivelesConfig]);

    // --- LOGICA DE CÁLCULO ---
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

    const calcularEstadoCuenta = () => {
        if (!representante) return;
        
        // Usar historialPagos local que ya contiene los pagos actualizados
        const pagosValidos = historialPagos.filter(p => p.estado === EstadoPago.VERIFICADO);
        const meses = getMesesEscolares();
        
        // 1. Calcular costos y pagos individuales
        const detalles = representante.alumnos.map(alu => {
            const config = nivelesConfig.find(n => n.nivel === alu.nivel);
            const precio = config ? (config.precio || 0) : (MENSUALIDADES[alu.nivel] || 0);
            const costoTotal = precio * meses;
            
            // Sumar pagos específicos a este alumno
            const pagadoIndividual = pagosValidos
                .filter(p => p.studentId === alu.id)
                .reduce((sum, p) => sum + (p.monto || 0), 0);
                
            return {
                id: alu.id,
                nombre: `${alu.nombres} ${alu.apellidos || ''}`.trim(), 
                nivel: alu.nivel,
                seccion: alu.seccion,
                costo: costoTotal,
                pagado: pagadoIndividual,
                pendiente: Math.max(0, costoTotal - pagadoIndividual),
                estado: 'SOLVENTE' as 'SOLVENTE' | 'DEBE'
            };
        });

        // 2. Identificar Bolsa General (pagos a TODOS o sin ID específico)
        let bolsaGeneral = pagosValidos
            .filter(p => !p.studentId || p.studentId === 'VARIOS' || p.studentId === 'TODOS')
            .reduce((sum, p) => sum + (p.monto || 0), 0);

        // 3. Distribuir Bolsa General a las deudas pendientes de los alumnos
        detalles.forEach(d => {
            if (bolsaGeneral > 0 && d.pendiente > 0) {
                const cubrir = Math.min(d.pendiente, bolsaGeneral);
                d.pagado += cubrir;
                d.pendiente -= cubrir;
                bolsaGeneral -= cubrir;
            }
        });
        
        // 4. Si sobra bolsa general, asignarlo visualmente al primer alumno (como saldo a favor global)
        if (bolsaGeneral > 0 && detalles.length > 0) {
            detalles[0].pagado += bolsaGeneral;
        }

        // 5. Definir estados y calcular Saldo Total (Suma de Pendientes)
        let totalDeuda = 0;
        detalles.forEach(d => {
            d.estado = d.pendiente > 0.5 ? 'DEBE' : 'SOLVENTE';
            totalDeuda += d.pendiente;
        });

        setDetallesAlumnos(detalles);
        setSaldoReal(totalDeuda);
    };

    const buscarRepresentante = async () => {
        if (!cedulaBusqueda) return;
        setSearching(true);
        setRepresentante(null);
        setDetallesAlumnos([]);
        setHistorialPagos([]);
        setSaldoReal(0);
        
        try {
            const rep = await db.getRepresentanteByCedula(cedulaBusqueda);
            if (rep) {
                setRepresentante(rep);
                
                // Cargar historial
                const all = await db.getPagos();
                const repPagos = all.filter(p => p.cedulaRepresentante === rep.cedula);
                setHistorialPagos(repPagos.sort((a,b) => new Date(b.fechaRegistro).getTime() - new Date(a.fechaRegistro).getTime()));

                // Reset form defaults
                setEstudianteId('TODOS');
                setMontoUSD('');
                setMontoBs('');
                setFormaPago('ABONO');
                setReferencia('');
                setObservacion('');
            } else {
                alert("Representante no encontrado");
            }
        } catch (e) {
            console.error(e);
            alert("Error buscando datos");
        } finally {
            setSearching(false);
        }
    };

    // Manejador de Cambio de Montos (Bidireccional)
    const handleMontoChange = (val: string, type: 'USD' | 'BS') => {
        if (type === 'USD') {
            setMontoUSD(val);
            const num = parseFloat(val);
            if (!isNaN(num) && tasaCambio > 0) {
                setMontoBs((num * tasaCambio).toFixed(2));
            } else {
                setMontoBs('');
            }
        } else {
            setMontoBs(val);
            const num = parseFloat(val);
            if (!isNaN(num) && tasaCambio > 0) {
                setMontoUSD((num / tasaCambio).toFixed(2));
            } else {
                setMontoUSD('');
            }
        }
    };

    const handleFormaPagoChange = (forma: 'ABONO' | 'TOTAL') => {
        setFormaPago(forma);
        if (forma === 'TOTAL') {
            handleMontoChange(saldoReal.toFixed(2), 'USD');
        } else {
            handleMontoChange('', 'USD');
        }
    };

    const procesarPago = async () => {
        if (!representante || !montoUSD || !referencia) {
            alert("Complete Monto y Referencia."); return;
        }

        setLoading(true);
        try {
            const montoNum = parseFloat(montoUSD);
            const montoBsNum = parseFloat(montoBs) || (montoNum * tasaCambio);
            
            // Determinar nombre del alumno para el registro
            let nombreAlumnoRegistro = "VARIOS";
            if (estudianteId !== 'TODOS') {
                const alu = representante.alumnos.find(a => a.id === estudianteId);
                if (alu) nombreAlumnoRegistro = `${alu.nombres}`; 
            }

            // Lógica de concepto
            let concepto = `${mesPago}`;
            if (formaPago === 'TOTAL') concepto += " (Cancelación Total)";
            else concepto += " (Abono)";

            // Verificación OV
            const esOV = referencia.trim().toUpperCase().startsWith('OV-');
            const estadoInicial = esOV ? EstadoPago.PENDIENTE_VERIFICACION : EstadoPago.VERIFICADO;

            const nuevoPago: RegistroPago = {
                id: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
                fechaRegistro: new Date().toISOString().split('T')[0],
                fechaPago: new Date().toISOString().split('T')[0],
                cedulaRepresentante: representante.cedula,
                nombreRepresentante: `${representante.nombres} ${representante.apellidos}`,
                matricula: representante.matricula,
                studentId: estudianteId, // Guardamos ID específico o TODOS
                mes: concepto,
                anio: anioPago,
                formaPago: formaPago,
                metodoPago: metodo,
                referencia: referencia,
                monto: montoNum,
                montoBolivares: montoBsNum,
                observaciones: observacion || `Pago de ${nombreAlumnoRegistro}`,
                estado: estadoInicial
            };

            await db.savePago(nuevoPago);
            
            // Actualizar Historial Local (esto disparará el useEffect de cálculo)
            setHistorialPagos(prev => [nuevoPago, ...prev]);
            
            alert(`Pago registrado exitosamente. Estado: ${estadoInicial}`);
            
            if (estadoInicial === EstadoPago.VERIFICADO) {
                if(window.confirm("¿Desea generar el recibo?")) {
                    generarRecibo(nuevoPago, saldoReal); 
                }
            }

            // Limpiar campos clave
            setMontoUSD(''); setMontoBs(''); setReferencia(''); setObservacion(''); setFormaPago('ABONO');

        } catch (e) {
            console.error(e);
            alert("Error al procesar el pago.");
        } finally {
            setLoading(false);
        }
    };

    const generarRecibo = async (pago: RegistroPago, saldoAnterior: number) => {
        const doc = new jsPDF();
        const logo = await loadImage(LOGO_URL);
        const pageWidth = doc.internal.pageSize.width;
        
        const saldoRestante = Math.max(0, saldoAnterior - (pago.monto || 0));
        const esDeudaPendiente = saldoRestante > 0.5;
        const tituloRecibo = esDeudaPendiente ? "COMPROBANTE DE ABONO" : "RECIBO DE PAGO (SOLVENTE)";
        const colorHeader = esDeudaPendiente ? [230, 81, 0] : [63, 81, 181];

        doc.setFillColor(colorHeader[0], colorHeader[1], colorHeader[2]);
        doc.rect(0, 0, pageWidth, 40, 'F');
        if (logo) doc.addImage(logo, 'PNG', 10, 5, 30, 30);
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(20);
        doc.text(tituloRecibo, pageWidth/2, 25, { align: 'center' });
        
        doc.setTextColor(0);
        doc.setFontSize(10);
        doc.text(`Fecha: ${pago.fechaPago}`, 14, 50);
        doc.text(`Control: ${pago.id.substring(0,8).toUpperCase()}`, 14, 56);
        doc.text(`Representante: ${pago.nombreRepresentante}`, 14, 62);
        doc.text(`Cedula: ${pago.cedulaRepresentante}`, 14, 68);

        autoTable(doc, {
            startY: 80,
            head: [['Concepto', 'Método', 'Ref', 'Monto $', 'Monto Bs']],
            body: [[pago.mes, pago.metodoPago, pago.referencia, `$${(pago.monto || 0).toFixed(2)}`, `Bs.${(pago.montoBolivares || 0).toFixed(2)}`]]
        });

        const finalY = (doc as any).lastAutoTable.finalY + 10;
        doc.setFillColor(245, 247, 250);
        doc.setDrawColor(200);
        doc.rect(14, finalY, pageWidth-28, 40, 'FD');
        
        doc.text("Resumen de Operación", 20, finalY + 10);
        doc.text(`Saldo Anterior: $${saldoAnterior.toFixed(2)}`, 180, finalY + 15, {align: 'right'});
        doc.text(`(-) Abono: $${(pago.monto || 0).toFixed(2)}`, 180, finalY + 22, {align: 'right'});
        doc.setFont("helvetica", "bold");
        doc.text(`(=) Restante: $${saldoRestante.toFixed(2)}`, 180, finalY + 32, {align: 'right'});

        doc.save("recibo.pdf");
    };

    const generarCierreDiario = async () => {
        setLoadingCierre(true);
        try {
            const allPagos = await db.getPagos();
            const pagosCierre = allPagos.filter(p => 
                p.fechaRegistro === fechaCierre && 
                p.estado === EstadoPago.VERIFICADO
            );

            if (pagosCierre.length === 0) {
                alert("No hay transacciones verificadas para la fecha seleccionada.");
                setLoadingCierre(false);
                return;
            }

            const doc = new jsPDF();
            const logo = await loadImage(LOGO_URL);
            const pageWidth = doc.internal.pageSize.width;

            doc.setFillColor(40, 40, 60);
            doc.rect(0, 0, pageWidth, 40, 'F');
            if (logo) doc.addImage(logo, 'PNG', 15, 5, 30, 30);
            
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(18);
            doc.text("CIERRE DE CAJA DIARIO", pageWidth / 2, 25, { align: 'center' });
            doc.setFontSize(10);
            doc.text(`Fecha: ${fechaCierre}`, pageWidth / 2, 32, { align: 'center' });

            const resumen: Record<string, {usd:number, bs:number}> = {};
            pagosCierre.forEach(p => {
                if(!resumen[p.metodoPago]) resumen[p.metodoPago] = {usd:0, bs:0};
                resumen[p.metodoPago].usd += (p.monto||0);
                resumen[p.metodoPago].bs += (p.montoBolivares||0);
            });

            const resumenRows = Object.entries(resumen).map(([k, v]) => [k, `$${v.usd.toFixed(2)}`, `Bs. ${v.bs.toFixed(2)}`]);
            const totalUSD = pagosCierre.reduce((s,p) => s + (p.monto||0), 0);
            const totalBs = pagosCierre.reduce((s,p) => s + (p.montoBolivares||0), 0);
            resumenRows.push(['TOTAL', `$${totalUSD.toFixed(2)}`, `Bs. ${totalBs.toFixed(2)}`]);

            autoTable(doc, {
                startY: 50,
                head: [['Método', 'Total USD', 'Total Bs']],
                body: resumenRows,
                theme: 'grid'
            });

            autoTable(doc, {
                startY: (doc as any).lastAutoTable.finalY + 10,
                head: [['Hora', 'Ref', 'Cliente', 'Monto']],
                body: pagosCierre.map(p => [
                    p.timestamp ? new Date(p.timestamp).toLocaleTimeString() : '-',
                    p.referencia,
                    p.nombreRepresentante.substring(0, 20),
                    `$${(p.monto||0).toFixed(2)}`
                ]),
                styles: { fontSize: 8 }
            });

            doc.save(`Cierre_${fechaCierre}.pdf`);

        } catch (e) { console.error(e); } finally { setLoadingCierre(false); }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6 pb-20">
            
            {/* ENCABEZADO */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <DollarSign className="text-green-600" size={28} /> Caja / Registrar Pago
                    </h2>
                    <p className="text-xs text-gray-500 mt-1">Gestión de Cobranza</p>
                </div>
                
                <div className="flex items-center gap-3">
                    {/* Cierre de Caja Mini */}
                    <div className="flex items-center gap-2 bg-gray-100 p-1.5 rounded-lg border border-gray-200">
                        <input 
                            type="date" 
                            className="bg-transparent text-xs border-none outline-none text-gray-600 w-24"
                            value={fechaCierre}
                            onChange={(e) => setFechaCierre(e.target.value)}
                        />
                        <button 
                            onClick={generarCierreDiario}
                            disabled={loadingCierre}
                            className="bg-slate-800 text-white p-1.5 rounded hover:bg-slate-700"
                            title="Generar Cierre PDF"
                        >
                            {loadingCierre ? <Loader2 size={14} className="animate-spin"/> : <BarChart3 size={14}/>}
                        </button>
                    </div>

                    <div className="bg-indigo-50 px-4 py-2 rounded-lg border border-indigo-100 flex items-center gap-2">
                        <RefreshCw size={16} className="text-indigo-600" />
                        <span className="text-sm font-medium text-indigo-900">Tasa: <span className="font-bold text-lg">Bs. {tasaCambio.toFixed(2)}</span></span>
                    </div>
                </div>
            </div>

            {/* BÚSQUEDA */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div className="flex gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input 
                            type="text" 
                            className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-lg transition-all"
                            placeholder="Ingrese Cédula del Representante..."
                            value={cedulaBusqueda}
                            onChange={(e) => setCedulaBusqueda(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && buscarRepresentante()}
                        />
                    </div>
                    <button 
                        onClick={buscarRepresentante}
                        disabled={searching}
                        className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-slate-800 transition-colors flex items-center gap-2"
                    >
                        {searching ? <Loader2 className="animate-spin" /> : <Search size={20} />}
                    </button>
                </div>
            </div>

            {representante ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    
                    {/* COLUMNA IZQUIERDA: DATOS MATRICULA DESGLOSADOS */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-full">
                            <h3 className="text-lg font-bold text-slate-700 mb-4 border-b pb-2 flex items-center gap-2">
                                <User size={20} className="text-indigo-500"/> Datos Matrícula
                            </h3>
                            
                            <div className="space-y-2 mb-4">
                                <div>
                                    <p className="text-xs font-bold text-gray-400 uppercase">Representante</p>
                                    <p className="font-medium text-slate-800">{representante.nombres} {representante.apellidos}</p>
                                    <p className="text-xs text-gray-500">{representante.cedula}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-gray-400 uppercase">Matrícula</p>
                                    <p className="font-mono text-xs bg-gray-100 p-1 rounded inline-block mt-1">{representante.matricula}</p>
                                </div>
                            </div>

                            {/* LISTA DETALLADA DE ALUMNOS */}
                            <div className="mb-6 space-y-3">
                                {detallesAlumnos.length > 0 ? detallesAlumnos.map((alu) => (
                                    <div key={alu.id} className="bg-gray-50 rounded-lg p-3 border border-gray-200 text-sm">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="font-bold text-indigo-900">{alu.nombre}</span>
                                            {alu.estado === 'DEBE' ? (
                                                <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded text-[10px] font-bold">DEBE</span>
                                            ) : (
                                                <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded text-[10px] font-bold">SOLVENTE</span>
                                            )}
                                        </div>
                                        <div className="text-xs text-gray-500 mb-2">{alu.nivel}</div>
                                        <div className="flex justify-between text-xs border-t border-gray-200 pt-2">
                                            <div className="text-center">
                                                <p className="text-gray-400">Total</p>
                                                <p className="font-medium">${alu.costo.toFixed(0)}</p>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-gray-400">Abonado</p>
                                                <p className="font-medium text-green-600">${alu.pagado.toFixed(0)}</p>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-gray-400">Pendiente</p>
                                                <p className={`font-bold ${alu.pendiente > 0 ? 'text-red-600' : 'text-gray-600'}`}>${alu.pendiente.toFixed(0)}</p>
                                            </div>
                                        </div>
                                    </div>
                                )) : (
                                    <div className="text-center py-4 text-gray-400 text-xs italic">
                                        Calculando deuda o sin alumnos registrados...
                                    </div>
                                )}
                            </div>

                            {/* TARJETA SALDO TOTAL */}
                            <div className={`p-5 rounded-xl border-2 ${saldoReal > 0 ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'} text-center`}>
                                <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${saldoReal > 0 ? 'text-orange-700' : 'text-green-700'}`}>
                                    {saldoReal > 0 ? 'Saldo Pendiente Total' : 'Familia Solvente'}
                                </p>
                                <h2 className={`text-3xl font-extrabold ${saldoReal > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                                    ${saldoReal.toFixed(2)}
                                </h2>
                                <p className="text-sm font-medium text-gray-500 mt-1">
                                    ~ Bs. {(saldoReal * tasaCambio).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* COLUMNA DERECHA: DETALLES PAGO */}
                    <div className="lg:col-span-2">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <h3 className="text-lg font-bold text-slate-700 mb-6 border-b pb-2 flex items-center gap-2">
                                <CreditCard size={20} className="text-indigo-500"/> Detalles del Pago
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                                {/* Fila 1 */}
                                <div>
                                    <label className="block text-xs font-bold text-indigo-900 mb-1.5">Estudiante</label>
                                    <select 
                                        className="w-full p-2.5 bg-indigo-50/50 border border-indigo-100 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                        value={estudianteId}
                                        onChange={e => setEstudianteId(e.target.value)}
                                    >
                                        <option value="TODOS">Todos / Familiar</option>
                                        {representante.alumnos.map(a => (
                                            <option key={a.id} value={a.id}>{a.nombres}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-indigo-900 mb-1.5">Mes a Pagar</label>
                                    <select 
                                        className="w-full p-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                        value={mesPago}
                                        onChange={e => setMesPago(e.target.value)}
                                    >
                                        {MESES.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-indigo-900 mb-1.5">Año Escolar</label>
                                    <input 
                                        type="text" 
                                        className="w-full p-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                        value={anioPago}
                                        onChange={e => setAnioPago(e.target.value)}
                                    />
                                </div>

                                {/* Fila 2 */}
                                <div>
                                    <label className="block text-xs font-bold text-indigo-900 mb-1.5">Método de Pago</label>
                                    <select 
                                        className="w-full p-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                        value={metodo}
                                        onChange={e => setMetodo(e.target.value as MetodoPago)}
                                    >
                                        {Object.values(MetodoPago).map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-indigo-900 mb-1.5">Forma</label>
                                    <div className="flex gap-4 items-center h-[42px]">
                                        <label className="flex items-center gap-2 cursor-pointer bg-white border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors w-full">
                                            <input 
                                                type="radio" 
                                                name="formaPago" 
                                                checked={formaPago === 'ABONO'} 
                                                onChange={() => handleFormaPagoChange('ABONO')}
                                                className="text-indigo-600 focus:ring-indigo-500"
                                            />
                                            <span className="text-sm font-medium">Abono</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer bg-white border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors w-full">
                                            <input 
                                                type="radio" 
                                                name="formaPago" 
                                                checked={formaPago === 'TOTAL'} 
                                                onChange={() => handleFormaPagoChange('TOTAL')}
                                                className="text-indigo-600 focus:ring-indigo-500"
                                            />
                                            <span className="text-sm font-medium">Total Deuda</span>
                                        </label>
                                    </div>
                                </div>

                                {/* Fila 3: MONTOS */}
                                <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
                                    <div>
                                        <label className="block text-xs font-bold text-indigo-900 mb-1.5">Monto en Bolívares (Bs)</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">Bs</span>
                                            <input 
                                                type="number" 
                                                className="w-full pl-8 pr-4 py-3 bg-white border border-indigo-200 rounded-lg text-lg font-medium focus:ring-2 focus:ring-indigo-500 outline-none text-indigo-700"
                                                placeholder="0.00"
                                                value={montoBs}
                                                onChange={e => handleMontoChange(e.target.value, 'BS')}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-indigo-900 mb-1.5">Monto a Registrar ($ USD)</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-green-600 font-bold text-lg">$</span>
                                            <input 
                                                type="number" 
                                                className="w-full pl-8 pr-4 py-3 bg-white border-2 border-green-100 rounded-lg text-xl font-bold focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-green-700 placeholder-green-200"
                                                placeholder="0.00"
                                                value={montoUSD}
                                                onChange={e => handleMontoChange(e.target.value, 'USD')}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Fila 4 */}
                                <div className="md:col-span-3">
                                    <label className="block text-xs font-bold text-gray-500 mb-1.5">Referencia / Comprobante</label>
                                    <input 
                                        type="text" 
                                        className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                        placeholder="Ej: 12345678 (Use OV- para oficina virtual)"
                                        value={referencia}
                                        onChange={e => setReferencia(e.target.value)}
                                    />
                                </div>
                                <div className="md:col-span-3">
                                    <label className="block text-xs font-bold text-gray-500 mb-1.5">Observaciones</label>
                                    <textarea 
                                        className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none h-20"
                                        placeholder="Detalles adicionales..."
                                        value={observacion}
                                        onChange={e => setObservacion(e.target.value)}
                                    ></textarea>
                                </div>
                            </div>

                            <div className="flex justify-end pt-4 border-t border-gray-100">
                                <button 
                                    onClick={procesarPago}
                                    disabled={loading}
                                    className="bg-indigo-600 text-white px-10 py-3 rounded-xl font-bold hover:bg-indigo-700 shadow-lg hover:shadow-xl transition-all active:scale-95 flex items-center gap-2"
                                >
                                    {loading ? <Loader2 className="animate-spin" /> : <CheckCircle size={20} />}
                                    {loading ? 'Procesando...' : 'Procesar Pago'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border-2 border-dashed border-gray-200">
                    <div className="bg-indigo-50 p-4 rounded-full mb-4">
                        <Search size={40} className="text-indigo-300" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-400">Busque un representante para comenzar</h3>
                    <p className="text-sm text-gray-400 mt-1">Ingrese la cédula en el campo superior</p>
                </div>
            )}

            {/* SECCIÓN HISTORIAL (Para referencia) */}
            {historialPagos.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-4 border-b border-gray-100 bg-gray-50">
                        <h3 className="font-bold text-gray-700">Historial Reciente</h3>
                    </div>
                    <div className="overflow-x-auto max-h-[300px]">
                        <table className="w-full text-sm text-left text-gray-500">
                            <thead className="bg-gray-100 text-xs text-gray-700 uppercase">
                                <tr>
                                    <th className="px-6 py-3">Fecha</th>
                                    <th className="px-6 py-3">Concepto</th>
                                    <th className="px-6 py-3">Método / Ref</th>
                                    <th className="px-6 py-3 text-right">Monto</th>
                                    <th className="px-6 py-3 text-center">Estado</th>
                                    <th className="px-6 py-3 text-center">Recibo</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {historialPagos.map(p => (
                                    <tr key={p.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4">{p.fechaPago}</td>
                                        <td className="px-6 py-4">{p.mes}</td>
                                        <td className="px-6 py-4">
                                            <div className="font-bold">{p.metodoPago}</div>
                                            <div className="text-xs text-gray-400">{p.referencia}</div>
                                        </td>
                                        <td className="px-6 py-4 text-right font-bold text-gray-800">${(p.monto || 0).toFixed(2)}</td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-2 py-1 rounded text-[10px] font-bold ${
                                                p.estado === EstadoPago.VERIFICADO ? 'bg-green-100 text-green-700' :
                                                p.estado === EstadoPago.RECHAZADO ? 'bg-red-100 text-red-700' :
                                                'bg-yellow-100 text-yellow-700'
                                            }`}>
                                                {p.estado}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {p.estado === EstadoPago.VERIFICADO && (
                                                <button onClick={() => generarRecibo(p, 0)} className="text-gray-500 hover:text-indigo-600">
                                                    <Printer size={18} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};
