import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/db';
import { Representante, RegistroPago, MetodoPago, EstadoPago, NivelConfig } from '../types';
import { Search, CreditCard, DollarSign, CheckCircle, Printer, Loader2, AlertTriangle, FileText } from 'lucide-react';
import { MENSUALIDADES, ANIO_ESCOLAR_ACTUAL, REQUIERE_VERIFICACION, LOGO_URL } from '../constants';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Helper de Imagen (Reutilizado)
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

export const Pagos: React.FC = () => {
    // Estados
    const [cedulaBusqueda, setCedulaBusqueda] = useState('');
    const [representante, setRepresentante] = useState<Representante | null>(null);
    const [historialPagos, setHistorialPagos] = useState<RegistroPago[]>([]);
    
    // Configuración
    const [tasaCambio, setTasaCambio] = useState(0);
    const [nivelesConfig, setNivelesConfig] = useState<NivelConfig[]>([]);
    const [loading, setLoading] = useState(false);
    const [searching, setSearching] = useState(false);
    
    // Formulario de Pago
    const [metodo, setMetodo] = useState<MetodoPago>(MetodoPago.PAGO_MOVIL);
    const [referencia, setReferencia] = useState('');
    const [monto, setMonto] = useState('');
    const [observacion, setObservacion] = useState('');
    const [conceptoMes, setConceptoMes] = useState(''); 

    // Estado calculado (asíncrono)
    const [saldoReal, setSaldoReal] = useState(0);

    // Cargar Configuración Inicial
    useEffect(() => {
        const loadConfig = async () => {
            try {
                const [conf, niv] = await Promise.all([db.getConfig(), db.getNiveles()]);
                setTasaCambio(conf.tasaCambio);
                setNivelesConfig(niv);
            } catch (e) {
                console.error("Error cargando configuración", e);
            }
        };
        loadConfig();
    }, []);

    // Actualizar Saldo cuando cambia representante o historial
    useEffect(() => {
        const updateSaldo = async () => {
            if (representante) {
                try {
                    const s = await db.calcularSaldoPendiente(representante.cedula);
                    setSaldoReal(s);
                } catch (e) {
                    console.error("Error calculando saldo", e);
                }
            } else {
                setSaldoReal(0);
            }
        };
        updateSaldo();
    }, [representante, historialPagos]);

    // Buscar Representante
    const buscarRepresentante = async () => {
        if (!cedulaBusqueda) return;
        setSearching(true);
        setRepresentante(null);
        try {
            const rep = await db.getRepresentanteByCedula(cedulaBusqueda);
            if (rep) {
                setRepresentante(rep);
                // Cargar historial específico
                const allPagos = await db.getPagos();
                const repPagos = allPagos.filter(p => p.cedulaRepresentante === rep.cedula);
                setHistorialPagos(repPagos.sort((a,b) => new Date(b.fechaRegistro).getTime() - new Date(a.fechaRegistro).getTime()));
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

    // Cálculos de Mensualidad
    const mensualidadFamiliar = useMemo(() => {
        if (!representante) return 0;
        return representante.alumnos.reduce((acc, alu) => {
            const conf = nivelesConfig.find(n => n.nivel === alu.nivel);
            return acc + (conf ? conf.precio : (MENSUALIDADES[alu.nivel] || 0));
        }, 0);
    }, [representante, nivelesConfig]);

    const ejecutarGuardadoPago = async () => {
        if (!representante || !monto || !referencia) {
            alert("Complete los datos obligatorios del pago (Monto y Referencia).");
            return;
        }
        
        setLoading(true);
        try {
            const montoNum = parseFloat(monto);
            const esPagoBs = [MetodoPago.PAGO_MOVIL, MetodoPago.TRANSFERENCIA, MetodoPago.TDD].includes(metodo);
            const montoBs = esPagoBs ? (montoNum * tasaCambio) : undefined;
            
            // Lógica de verificación automática vs manual
            const esOficinaVirtual = referencia.trim().toUpperCase().startsWith('OV-');
            const estadoInicial = esOficinaVirtual ? EstadoPago.PENDIENTE_VERIFICACION : EstadoPago.VERIFICADO;

            const nuevoPago: RegistroPago = {
                id: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
                fechaRegistro: new Date().toISOString().split('T')[0],
                fechaPago: new Date().toISOString().split('T')[0],
                cedulaRepresentante: representante.cedula,
                nombreRepresentante: `${representante.nombres} ${representante.apellidos}`,
                matricula: representante.matricula,
                studentId: 'VARIOS',
                mes: conceptoMes || 'Abono',
                anio: ANIO_ESCOLAR_ACTUAL,
                formaPago: 'Abono',
                metodoPago: metodo,
                referencia: referencia,
                monto: montoNum,
                montoBolivares: montoBs,
                observaciones: observacion,
                estado: estadoInicial
            };

            await db.savePago(nuevoPago);
            
            setHistorialPagos([nuevoPago, ...historialPagos]);
            setMonto('');
            setReferencia('');
            setObservacion('');
            setConceptoMes('');
            
            alert(`Pago registrado con éxito. Estado: ${estadoInicial}`);
            
            if (estadoInicial === EstadoPago.VERIFICADO) {
                 if(window.confirm("¿Desea descargar el recibo ahora?")) {
                     generarRecibo(nuevoPago);
                 }
            }

        } catch (e) {
            console.error(e);
            alert("Error guardando pago en el sistema.");
        } finally {
            setLoading(false);
        }
    };

    const generarRecibo = async (pago: RegistroPago) => {
        if (!representante) return;
        const doc = new jsPDF();
        const logo = await loadImage(LOGO_URL);
        if (logo) doc.addImage(logo, 'PNG', 10, 10, 25, 25);
        
        doc.setFontSize(16);
        doc.text("RECIBO DE PAGO", 105, 20, { align: 'center' });
        doc.setFontSize(10);
        doc.text(`N° Control: ${pago.id.substring(0,8)}`, 105, 26, { align: 'center' });

        doc.text(`Fecha: ${pago.fechaPago}`, 15, 40);
        doc.text(`Representante: ${pago.nombreRepresentante}`, 15, 46);
        doc.text(`Cédula: ${pago.cedulaRepresentante}`, 15, 52);

        doc.text(`Concepto: ${pago.mes} ${pago.anio}`, 15, 65);
        doc.text(`Método: ${pago.metodoPago}`, 15, 71);
        doc.text(`Referencia: ${pago.referencia}`, 15, 77);

        doc.setFontSize(14);
        doc.text(`Monto: $${(pago.monto || 0).toFixed(2)}`, 15, 90);
        if (pago.montoBolivares) {
            doc.text(`(Bs. ${pago.montoBolivares.toFixed(2)})`, 60, 90);
        }

        doc.save(`Recibo_${pago.id.substring(0,8)}.pdf`);
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h2 className="text-2xl font-bold mb-6 text-slate-800 flex items-center gap-2">
                  <CreditCard className="text-indigo-600" /> Registro de Pagos (Caja)
                </h2>

                <div className="flex gap-4 mb-6">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input 
                            type="text" 
                            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="Buscar por Cédula del Representante..."
                            value={cedulaBusqueda}
                            onChange={(e) => setCedulaBusqueda(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && buscarRepresentante()}
                        />
                    </div>
                    <button 
                        onClick={buscarRepresentante}
                        disabled={searching}
                        className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                    >
                        {searching ? <Loader2 className="animate-spin" /> : 'Buscar'}
                    </button>
                </div>

                {representante && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in">
                        <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                            <h3 className="font-bold text-lg text-slate-700 mb-4">{representante.nombres} {representante.apellidos}</h3>
                            <div className="space-y-2 text-sm text-gray-600">
                                <p><strong>Cédula:</strong> {representante.cedula}</p>
                                <p><strong>Matrícula:</strong> {representante.matricula}</p>
                                <p><strong>Alumnos:</strong> {representante.alumnos.length}</p>
                                <ul className="pl-4 list-disc text-xs text-gray-500 mt-2">
                                    {representante.alumnos.map((a, idx) => (
                                        <li key={idx}>{a.nombres} - {a.nivel}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>

                        <div className="bg-indigo-50 p-6 rounded-lg border border-indigo-100 flex flex-col justify-center items-center text-center">
                            <p className="text-sm font-bold text-indigo-800 uppercase tracking-wide">Saldo Estimado (Deuda)</p>
                            <h3 className={`text-4xl font-extrabold my-2 ${saldoReal > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                ${Math.abs(saldoReal).toFixed(2)}
                            </h3>
                            <p className="text-xs text-indigo-600 font-medium">
                                {saldoReal > 0 ? 'Pendiente por Pagar' : 'Solvente / A Favor'}
                            </p>
                            <div className="mt-4 text-xs text-gray-500">
                                Mensualidad Total Familiar: <strong>${mensualidadFamiliar.toFixed(2)}</strong>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {representante && (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                     <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                        <DollarSign className="text-green-600" /> Registrar Nuevo Pago
                     </h3>

                     <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                         <div>
                             <label className="block text-sm font-medium text-gray-700 mb-1">Método de Pago</label>
                             <select 
                                className="w-full border border-gray-300 rounded-lg p-3"
                                value={metodo}
                                onChange={(e) => setMetodo(e.target.value as MetodoPago)}
                             >
                                 {Object.values(MetodoPago).map(m => <option key={m} value={m}>{m}</option>)}
                             </select>
                         </div>
                         <div>
                             <label className="block text-sm font-medium text-gray-700 mb-1">Referencia / Nro. Comprobante</label>
                             <input 
                                type="text"
                                className="w-full border border-gray-300 rounded-lg p-3"
                                placeholder="Ej: 123456"
                                value={referencia}
                                onChange={(e) => setReferencia(e.target.value)}
                             />
                         </div>
                         <div>
                             <label className="block text-sm font-medium text-gray-700 mb-1">Monto (USD)</label>
                             <input 
                                type="number"
                                className="w-full border border-gray-300 rounded-lg p-3 font-bold text-gray-800"
                                placeholder="0.00"
                                value={monto}
                                onChange={(e) => setMonto(e.target.value)}
                             />
                             {tasaCambio > 0 && monto && (
                                 <p className="text-xs text-green-700 mt-1 font-mono">
                                     Ref: Bs. {(parseFloat(monto) * tasaCambio).toFixed(2)}
                                 </p>
                             )}
                         </div>
                         <div>
                             <label className="block text-sm font-medium text-gray-700 mb-1">Concepto (Mes/Motivo)</label>
                             <input 
                                type="text"
                                className="w-full border border-gray-300 rounded-lg p-3"
                                placeholder="Ej: Octubre"
                                value={conceptoMes}
                                onChange={(e) => setConceptoMes(e.target.value)}
                             />
                         </div>
                         <div className="md:col-span-2">
                             <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
                             <input 
                                type="text"
                                className="w-full border border-gray-300 rounded-lg p-3"
                                placeholder="Opcional..."
                                value={observacion}
                                onChange={(e) => setObservacion(e.target.value)}
                             />
                         </div>
                     </div>

                     <div className="mt-8 flex justify-end">
                         <button 
                            onClick={ejecutarGuardadoPago}
                            disabled={loading}
                            className="bg-green-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-green-700 shadow-lg flex items-center gap-2"
                         >
                             {loading ? <Loader2 className="animate-spin" /> : <CheckCircle size={20} />}
                             Procesar Pago
                         </button>
                     </div>
                </div>
            )}

            {historialPagos.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-4 border-b border-gray-100 bg-gray-50">
                        <h3 className="font-bold text-gray-700">Historial de Transacciones (Recientes)</h3>
                    </div>
                    <div className="overflow-x-auto max-h-[400px]">
                        <table className="w-full text-sm text-left text-gray-500">
                            <thead className="bg-gray-100 text-xs text-gray-700 uppercase sticky top-0">
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
                                                <button onClick={() => generarRecibo(p)} className="text-gray-500 hover:text-indigo-600">
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
