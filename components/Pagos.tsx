
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/db';
import { Representante, RegistroPago, MetodoPago, EstadoPago, NivelConfig } from '../types';
import { Search, CreditCard, DollarSign, CheckCircle, Printer, Loader2, AlertTriangle, FileText, ArrowRight, Wallet, Calculator, Clock, Calendar, Edit, Percent, ToggleLeft, ToggleRight, Download, BarChart3 } from 'lucide-react';
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
    // Estados Principales
    const [cedulaBusqueda, setCedulaBusqueda] = useState('');
    const [representante, setRepresentante] = useState<Representante | null>(null);
    const [historialPagos, setHistorialPagos] = useState<RegistroPago[]>([]);
    
    // Configuración
    const [tasaCambio, setTasaCambio] = useState(0);
    const [nivelesConfig, setNivelesConfig] = useState<NivelConfig[]>([]);
    const [loading, setLoading] = useState(false);
    const [searching, setSearching] = useState(false);
    
    // Estados para Cierre de Caja
    const [loadingCierre, setLoadingCierre] = useState(false);
    const [fechaCierre, setFechaCierre] = useState(new Date().toISOString().split('T')[0]);
    
    // Formulario de Pago
    const [metodo, setMetodo] = useState<MetodoPago>(MetodoPago.PAGO_MOVIL);
    const [referencia, setReferencia] = useState('');
    const [monto, setMonto] = useState('');
    const [observacion, setObservacion] = useState('');
    const [conceptoMes, setConceptoMes] = useState(''); 
    
    // Estado Pronto Pago
    const [aplicarProntoPago, setAplicarProntoPago] = useState(false);

    // Estado calculado (asíncrono) para deuda
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
        
        // Verificar fecha para Pronto Pago Automático (<= día 25)
        const day = new Date().getDate();
        if (day <= 25) {
            setAplicarProntoPago(true);
        }
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

    // Cálculo del Descuento de Pronto Pago ($5 por alumno)
    const descuentoTotal = useMemo(() => {
        if (!representante) return 0;
        return representante.alumnos.length * 5;
    }, [representante]);

    // --- LÓGICA DE DESGLOSE DE DEUDA ---
    const desgloseDeuda = useMemo(() => {
        if (saldoReal <= 0) return { mesActual: 0, anterior: 0, total: 0 };
        
        let anterior = 0;
        let mesActual = 0;

        if (saldoReal > mensualidadFamiliar) {
            anterior = saldoReal - mensualidadFamiliar;
            mesActual = mensualidadFamiliar;
        } else {
            // Si debe menos de una mensualidad completa (ej: pagó una parte)
            mesActual = saldoReal;
            anterior = 0;
        }

        return { mesActual, anterior, total: saldoReal };
    }, [saldoReal, mensualidadFamiliar]);

    // Acciones rápidas de monto
    const setPagoTotal = () => {
        let totalAPagar = desgloseDeuda.total;
        let concepto = "Cancelación Total Deuda";

        if (aplicarProntoPago && descuentoTotal > 0) {
            totalAPagar = Math.max(0, desgloseDeuda.total - descuentoTotal);
            concepto = `Mensualidad (Inc. Desc. Pronto Pago $${descuentoTotal})`;
        }

        setMonto(totalAPagar.toFixed(2));
        setConceptoMes(concepto);
    };

    const setAbono = () => {
        setMonto('');
        setConceptoMes('Abono a Cuenta');
        // Poner foco en el input de monto
        const input = document.getElementById('inputMonto');
        if(input) input.focus();
    };

    // --- GENERAR REPORTE DE CIERRE DE CAJA ---
    const generarCierreDiario = async () => {
        setLoadingCierre(true);
        try {
            const allPagos = await db.getPagos();
            
            // 1. Filtrar pagos: Fecha seleccionada y estado VERIFICADO
            // Esto incluye pagos registrados en caja hoy Y pagos de Oficina Virtual verificados hoy
            const pagosCierre = allPagos.filter(p => 
                p.fechaRegistro === fechaCierre && 
                p.estado === EstadoPago.VERIFICADO
            );

            if (pagosCierre.length === 0) {
                alert("No hay transacciones verificadas para la fecha seleccionada.");
                setLoadingCierre(false);
                return;
            }

            // 2. Agrupar para Resumen
            const resumen: Record<string, { count: number, usd: number, bs: number }> = {};
            let granTotalUSD = 0;
            let granTotalBS = 0;

            pagosCierre.forEach(p => {
                const metodo = p.metodoPago;
                if (!resumen[metodo]) resumen[metodo] = { count: 0, usd: 0, bs: 0 };
                
                resumen[metodo].count++;
                resumen[metodo].usd += (p.monto || 0);
                resumen[metodo].bs += (p.montoBolivares || 0);

                granTotalUSD += (p.monto || 0);
                granTotalBS += (p.montoBolivares || 0);
            });

            // 3. Crear PDF
            const doc = new jsPDF();
            const logo = await loadImage(LOGO_URL);
            const pageWidth = doc.internal.pageSize.width;

            // Header
            doc.setFillColor(40, 40, 60); // Gris oscuro
            doc.rect(0, 0, pageWidth, 40, 'F');
            
            if (logo) doc.addImage(logo, 'PNG', 15, 5, 30, 30);
            
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(18);
            doc.setFont("helvetica", "bold");
            doc.text("REPORTE DE CIERRE DE CAJA DIARIO", pageWidth / 2, 20, { align: 'center' });
            
            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            doc.text(`Fecha de Cierre: ${fechaCierre}`, pageWidth / 2, 28, { align: 'center' });
            doc.text(`Generado: ${new Date().toLocaleTimeString()}`, pageWidth / 2, 33, { align: 'center' });

            // RESUMEN GENERAL
            doc.setTextColor(0);
            doc.setFontSize(12);
            doc.setFont("helvetica", "bold");
            doc.text("1. RESUMEN CONSOLIDADO POR MÉTODO", 14, 55);

            const resumenRows = Object.entries(resumen).map(([metodo, datos]) => [
                metodo,
                datos.count,
                `$${datos.usd.toFixed(2)}`,
                `Bs. ${datos.bs.toFixed(2)}`
            ]);

            // Fila Total
            resumenRows.push(['TOTAL GENERAL', pagosCierre.length, `$${granTotalUSD.toFixed(2)}`, `Bs. ${granTotalBS.toFixed(2)}`]);

            autoTable(doc, {
                startY: 60,
                head: [['Método de Pago', 'Cant.', 'Total USD', 'Total Bs']],
                body: resumenRows,
                theme: 'grid',
                headStyles: { fillColor: [60, 60, 60] },
                columnStyles: { 0: { cellWidth: 70 }, 2: { halign: 'right' }, 3: { halign: 'right' } },
                didParseCell: (data) => {
                    if (data.row.index === resumenRows.length - 1) {
                        data.cell.styles.fontStyle = 'bold';
                        data.cell.styles.fillColor = [220, 220, 220];
                    }
                }
            });

            // DETALLE TRANSACCIONES
            const finalY1 = (doc as any).lastAutoTable.finalY + 15;
            doc.text("2. DETALLE DE OPERACIONES (Incluye Oficina Virtual)", 14, finalY1);

            const detalleRows = pagosCierre.map(p => {
                // Hora aproximada si existe timestamp
                let hora = "";
                try {
                    if (p.timestamp) hora = new Date(p.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                } catch(e) {}

                // Marcar si es OV
                const esOV = p.referencia.startsWith('OV-') ? '(OV)' : '';

                return [
                    hora,
                    p.referencia,
                    p.nombreRepresentante.substring(0, 25), // Truncar
                    p.mes + (esOV ? ` ${esOV}` : ''),
                    p.metodoPago,
                    `$${(p.monto || 0).toFixed(2)}`
                ];
            });

            autoTable(doc, {
                startY: finalY1 + 5,
                head: [['Hora', 'Ref', 'Representante', 'Concepto', 'Método', 'Monto']],
                body: detalleRows,
                theme: 'striped',
                styles: { fontSize: 8 },
                headStyles: { fillColor: [63, 81, 181] },
                columnStyles: { 5: { halign: 'right', fontStyle: 'bold' } }
            });

            // FIRMAS
            const finalY2 = (doc as any).lastAutoTable.finalY + 40;
            
            // Nueva página si no cabe
            if (finalY2 > 250) doc.addPage();
            
            const firmaPos = finalY2 > 250 ? 40 : finalY2;

            doc.setLineWidth(0.5);
            doc.setDrawColor(0);
            
            doc.line(30, firmaPos, 90, firmaPos);
            doc.setFontSize(10);
            doc.text("Cajero(a) Responsable", 60, firmaPos + 5, { align: 'center' });

            doc.line(120, firmaPos, 180, firmaPos);
            doc.text("Supervisor / Administración", 150, firmaPos + 5, { align: 'center' });

            doc.save(`Cierre_Caja_${fechaCierre}.pdf`);

        } catch (e) {
            console.error(e);
            alert("Error generando el cierre de caja.");
        } finally {
            setLoadingCierre(false);
        }
    };

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
            
            const esOficinaVirtual = referencia.trim().toUpperCase().startsWith('OV-');
            const estadoInicial = esOficinaVirtual ? EstadoPago.PENDIENTE_VERIFICACION : EstadoPago.VERIFICADO;

            const deudaConsiderada = aplicarProntoPago ? (saldoReal - descuentoTotal) : saldoReal;
            const esAbono = deudaConsiderada - montoNum > 0.1;
            
            let conceptoFinal = conceptoMes || (esAbono ? 'Abono Parcial' : 'Cancelación Mensualidad');
            
            if (aplicarProntoPago && !conceptoFinal.includes('Desc')) {
                conceptoFinal += ` (Desc. Pronto Pago Aplicado)`;
            }

            const nuevoPago: RegistroPago = {
                id: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
                fechaRegistro: new Date().toISOString().split('T')[0],
                fechaPago: new Date().toISOString().split('T')[0],
                cedulaRepresentante: representante.cedula,
                nombreRepresentante: `${representante.nombres} ${representante.apellidos}`,
                matricula: representante.matricula,
                studentId: 'VARIOS',
                mes: conceptoFinal,
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
            
            alert(`Pago registrado con éxito. Estado: ${estadoInicial}`);
            
            if (estadoInicial === EstadoPago.VERIFICADO) {
                 if(window.confirm(`¿Desea descargar el recibo de ${esAbono ? 'Abono' : 'Pago'} ahora?`)) {
                     // Importante: Pasamos saldoReal porque es el saldo ANTES de restar este pago recién guardado
                     generarRecibo(nuevoPago, saldoReal);
                 }
            }
            
            setMonto('');
            setReferencia('');
            setObservacion('');
            setConceptoMes('');

        } catch (e) {
            console.error(e);
            alert("Error guardando pago en el sistema.");
        } finally {
            setLoading(false);
        }
    };

    const generarRecibo = async (pago: RegistroPago, saldoAnterior: number = 0) => {
        if (!representante) return;
        const doc = new jsPDF();
        const logo = await loadImage(LOGO_URL);
        const pageWidth = doc.internal.pageSize.width;
        
        // --- CÁLCULOS CLAROS ---
        const montoPagado = pago.monto || 0;
        // Saldo restante es lo que debía antes menos lo que pagó ahora
        const saldoRestante = Math.max(0, saldoAnterior - montoPagado);
        
        // Determinar tipo de recibo
        // Usamos 0.5 de holgura por temas de redondeo en flotantes
        const esDeudaPendiente = saldoRestante > 0.5;
        const tituloRecibo = esDeudaPendiente ? "COMPROBANTE DE ABONO" : "RECIBO DE PAGO (SOLVENTE)";
        const colorHeader = esDeudaPendiente ? [230, 81, 0] : [63, 81, 181]; // Naranja para Abono, Azul para Pago

        // --- HEADER ---
        doc.setFillColor(colorHeader[0], colorHeader[1], colorHeader[2]); 
        doc.rect(0, 0, pageWidth, 40, 'F');
        
        if (logo) doc.addImage(logo, 'PNG', 10, 5, 30, 30);
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.setFont("helvetica", "bold");
        doc.text(tituloRecibo, pageWidth / 2, 20, { align: 'center' });
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text("Sistema Administrativo Escolar", pageWidth / 2, 28, { align: 'center' });
        doc.text(`Fecha Emisión: ${new Date().toLocaleDateString()}`, pageWidth - 15, 35, { align: 'right' });

        // --- INFO GENERAL ---
        doc.setTextColor(0, 0, 0);
        doc.text(`Fecha Pago: ${pago.fechaPago}`, 14, 50);
        doc.text(`Control N°: ${pago.id.substring(0, 8).toUpperCase()}`, 14, 56);
        
        // --- DATOS REPRESENTANTE ---
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text("DATOS DEL REPRESENTANTE", 14, 66);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.text(`Nombre: ${representante.nombres} ${representante.apellidos}`, 14, 72);
        doc.text(`Cédula: ${representante.cedula}`, 14, 78);
        doc.text(`Matrícula Familiar: ${representante.matricula}`, 14, 84);

        // --- DETALLES PAGO ---
        autoTable(doc, {
            startY: 90,
            head: [['Concepto / Mes', 'Método de Pago', 'Referencia', 'Monto ($)', 'Monto (Bs)']],
            body: [[
                `${pago.mes} ${pago.anio}`,
                pago.metodoPago,
                pago.referencia,
                `$${montoPagado.toFixed(2)}`,
                pago.montoBolivares ? `Bs. ${pago.montoBolivares.toFixed(2)}` : '-'
            ]],
            theme: 'grid',
            headStyles: { fillColor: [50, 50, 50] }
        });

        // --- CAJA DE SALDOS Y ESTADO DE CUENTA ---
        const finalY = (doc as any).lastAutoTable.finalY + 10;
        
        // Fondo gris suave para la caja
        doc.setFillColor(245, 247, 250);
        doc.setDrawColor(200, 200, 200);
        doc.rect(14, finalY, pageWidth - 28, 50, 'FD');

        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(60, 60, 60);
        doc.text("RESUMEN DE OPERACIÓN Y SALDO", 20, finalY + 10);
        
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        
        // Línea 1: Deuda Anterior
        doc.text("Deuda Total Antes del Pago:", 20, finalY + 22);
        doc.text(`$${saldoAnterior.toFixed(2)}`, 180, finalY + 22, { align: 'right' });
        
        // Línea 2: Pago Actual (Resta)
        doc.text("(-) Monto Abonado Hoy:", 20, finalY + 30);
        doc.setTextColor(0, 128, 0); // Verde para el pago
        doc.setFont("helvetica", "bold");
        doc.text(`$${montoPagado.toFixed(2)}`, 180, finalY + 30, { align: 'right' });
        
        // Línea Divisoria
        doc.setDrawColor(150);
        doc.setLineWidth(0.5);
        doc.line(20, finalY + 34, 185, finalY + 34);
        
        // Línea 3: Saldo Restante (Resultado)
        doc.setTextColor(0);
        const labelSaldo = esDeudaPendiente ? "(=) SALDO DEUDOR RESTANTE:" : "(=) SALDO PENDIENTE:";
        doc.text(labelSaldo, 20, finalY + 42);
        
        if (esDeudaPendiente) {
            doc.setTextColor(220, 0, 0); // Rojo si debe
            doc.text(`$${saldoRestante.toFixed(2)}`, 180, finalY + 42, { align: 'right' });
            
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text("* El representante mantiene una deuda pendiente. Favor regularizar.", 20, finalY + 48);
        } else {
            doc.setTextColor(0, 0, 150); // Azul si está solvente
            doc.text(`$0.00 (SOLVENTE)`, 180, finalY + 42, { align: 'right' });
        }

        // --- PIE DE PÁGINA ---
        doc.setTextColor(150);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        
        // Espacio para firmas
        const firmaY = finalY + 70;
        doc.setDrawColor(100);
        
        doc.line(30, firmaY, 90, firmaY);
        doc.text("Cajero / Administración", 60, firmaY + 5, { align: 'center' });
        
        doc.line(120, firmaY, 180, firmaY);
        doc.text("Representante (Conforme)", 150, firmaY + 5, { align: 'center' });

        doc.text("Este recibo fue generado electrónicamente por el sistema AdminPro.", 105, 280, { align: 'center' });

        const nombreArchivo = esDeudaPendiente ? `Abono_${pago.cedulaRepresentante}.pdf` : `PagoTotal_${pago.cedulaRepresentante}.pdf`;
        doc.save(nombreArchivo);
    };

    const montoBsEstimado = monto ? (parseFloat(monto) * tasaCambio).toFixed(2) : '0.00';

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            
            {/* --- HEADER: TÍTULO Y CIERRE DE CAJA --- */}
            <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-100 gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <CreditCard className="text-indigo-600" /> Registro de Pagos (Caja)
                    </h2>
                    <p className="text-sm text-gray-500">Gestión de Cobranza y Cierre Diario</p>
                </div>

                {/* Controles Cierre de Caja */}
                <div className="flex items-center gap-3 bg-gray-50 p-2 rounded-lg border border-gray-200 shadow-sm">
                    <div className="flex flex-col">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide px-1">Fecha de Cierre</label>
                        <input 
                            type="date" 
                            className="bg-transparent border-none text-sm font-bold text-slate-700 focus:ring-0 cursor-pointer p-1"
                            value={fechaCierre}
                            onChange={(e) => setFechaCierre(e.target.value)}
                        />
                    </div>
                    <div className="h-8 w-px bg-gray-300 mx-2"></div>
                    <button 
                        onClick={generarCierreDiario}
                        disabled={loadingCierre}
                        className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 flex items-center gap-2 transition-colors disabled:opacity-50"
                    >
                        {loadingCierre ? <Loader2 size={16} className="animate-spin" /> : <BarChart3 size={16} />}
                        {loadingCierre ? 'Generando...' : 'Generar Cierre PDF'}
                    </button>
                </div>
            </div>

            {/* 1. SECCIÓN BÚSQUEDA */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
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

                        {/* TARJETA DE DEUDA DESGLOSADA */}
                        <div className={`p-6 rounded-lg border flex flex-col justify-center ${saldoReal > 0 ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'}`}>
                            
                            {saldoReal <= 0 ? (
                                <div className="text-center">
                                    <p className="text-sm font-bold text-green-700 uppercase tracking-wide flex items-center justify-center gap-2">
                                        <CheckCircle size={18}/> Estado Solvente
                                    </p>
                                    <h3 className="text-3xl font-extrabold my-2 text-green-800">$0.00</h3>
                                    <p className="text-xs text-green-600">El representante está al día con sus pagos.</p>
                                </div>
                            ) : (
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-bold text-orange-800 uppercase">Total Pendiente</span>
                                        <span className="bg-orange-200 text-orange-900 text-[10px] px-2 py-0.5 rounded-full font-bold">DEUDA</span>
                                    </div>
                                    <h3 className="text-4xl font-extrabold text-orange-700 mb-4">${desgloseDeuda.total.toFixed(2)}</h3>
                                    
                                    <div className="space-y-2 pt-3 border-t border-orange-200">
                                        <div className="flex justify-between text-sm items-center">
                                            <span className="text-gray-600 flex items-center gap-1"><Calendar size={14}/> Mes en Curso:</span>
                                            <span className="font-bold text-gray-800">${desgloseDeuda.mesActual.toFixed(2)}</span>
                                        </div>
                                        {desgloseDeuda.anterior > 0 && (
                                            <div className="flex justify-between text-sm items-center">
                                                <span className="text-red-600 flex items-center gap-1 font-medium"><Clock size={14}/> Remanente Anterior:</span>
                                                <span className="font-bold text-red-600">+ ${desgloseDeuda.anterior.toFixed(2)}</span>
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-[10px] text-gray-500 mt-3 italic">* Incluye mensualidad del mes actual + deuda arrastrada.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* 2. SECCIÓN FORMULARIO DE PAGO */}
            {representante && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                     <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                            <DollarSign className="text-green-600" /> Nuevo Ingreso
                        </h3>
                     </div>

                     <div className="p-6">
                         {/* Datos del Comprobante */}
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                             <div>
                                 <label className="block text-xs font-bold text-gray-500 mb-1">Método de Pago</label>
                                 <select 
                                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm bg-white"
                                    value={metodo}
                                    onChange={(e) => setMetodo(e.target.value as MetodoPago)}
                                 >
                                     {Object.values(MetodoPago).map(m => <option key={m} value={m}>{m}</option>)}
                                 </select>
                             </div>
                             <div>
                                 <label className="block text-xs font-bold text-gray-500 mb-1">Referencia / Comprobante</label>
                                 <input 
                                    type="text"
                                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm"
                                    placeholder="Ej: 12345678"
                                    value={referencia}
                                    onChange={(e) => setReferencia(e.target.value)}
                                 />
                             </div>
                             <div>
                                 <label className="block text-xs font-bold text-gray-500 mb-1">Concepto (Mes/Motivo)</label>
                                 <input 
                                    type="text"
                                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm"
                                    placeholder="Ej: Octubre + Inscripción"
                                    value={conceptoMes}
                                    onChange={(e) => setConceptoMes(e.target.value)}
                                 />
                             </div>
                             <div>
                                 <label className="block text-xs font-bold text-gray-500 mb-1">Observaciones</label>
                                 <input 
                                    type="text"
                                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm"
                                    placeholder="Opcional..."
                                    value={observacion}
                                    onChange={(e) => setObservacion(e.target.value)}
                                 />
                             </div>
                         </div>

                         {/* Sección Pronto Pago */}
                         <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-blue-50 border border-blue-100 rounded-lg p-3 mb-6">
                             <div className="flex items-center gap-3">
                                 <div className={`p-2 rounded-full ${aplicarProntoPago ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-500'}`}>
                                     <Percent size={20} />
                                 </div>
                                 <div>
                                     <p className="text-sm font-bold text-gray-700">Descuento de Pronto Pago</p>
                                     <p className="text-xs text-gray-500">
                                         Aplica los días 25 o antes. Descuento de $5 por alumno (${descuentoTotal} total).
                                     </p>
                                 </div>
                             </div>
                             <button 
                                onClick={() => setAplicarProntoPago(!aplicarProntoPago)}
                                className={`mt-2 sm:mt-0 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${aplicarProntoPago ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-300 text-gray-600 hover:bg-gray-400'}`}
                             >
                                 {aplicarProntoPago ? <ToggleRight size={18}/> : <ToggleLeft size={18}/>}
                                 {aplicarProntoPago ? 'ACTIVO' : 'INACTIVO'}
                             </button>
                         </div>

                         {/* Área de Cálculo y Monto */}
                         <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
                             {/* Botones de Ayuda para Monto */}
                             {saldoReal > 0 && (
                                 <div className="flex gap-3 mb-4 flex-wrap">
                                     <button 
                                        onClick={setPagoTotal}
                                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow hover:bg-indigo-700 transition-colors"
                                     >
                                         <CheckCircle size={16} /> 
                                         {aplicarProntoPago 
                                            ? `Pago Total con Descuento ($${Math.max(0, desgloseDeuda.total - descuentoTotal).toFixed(2)})`
                                            : `Pago Total ($${desgloseDeuda.total.toFixed(2)})`
                                         }
                                     </button>
                                     <button 
                                        onClick={setAbono}
                                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                                     >
                                         <Edit size={16} /> Abono
                                     </button>
                                 </div>
                             )}

                             <div className="flex flex-col md:flex-row items-center gap-6">
                                 {/* Input Monto USD */}
                                 <div className="flex-1 w-full">
                                     <label className="block text-sm font-bold text-green-800 mb-2 flex items-center gap-2">
                                         <DollarSign size={18}/> MONTO A PAGAR (USD)
                                     </label>
                                     <div className="relative">
                                         <span className="absolute left-4 top-1/2 -translate-y-1/2 text-green-600 font-bold text-xl">$</span>
                                         <input 
                                            id="inputMonto"
                                            type="number"
                                            className="w-full pl-10 pr-4 py-4 border-2 border-green-200 rounded-xl text-3xl font-bold text-green-700 focus:ring-4 focus:ring-green-100 focus:border-green-400 outline-none transition-all placeholder-green-200"
                                            placeholder="0.00"
                                            value={monto}
                                            onChange={(e) => setMonto(e.target.value)}
                                         />
                                     </div>
                                     
                                     {/* Saldo Restante en Tiempo Real */}
                                     {representante && saldoReal > 0 && (
                                         <div className="flex justify-between items-center mt-2 text-xs px-1">
                                             <span className="text-gray-500">Saldo Actual: ${saldoReal.toFixed(2)}</span>
                                             <span className={`font-bold ${
                                                 (saldoReal - (parseFloat(monto)||0)) > 0 ? 'text-orange-600' : 'text-green-600'
                                             }`}>
                                                 Restante: ${Math.max(0, saldoReal - (parseFloat(monto)||0)).toFixed(2)}
                                             </span>
                                         </div>
                                     )}
                                 </div>

                                 {/* Icono Conversión */}
                                 <div className="hidden md:flex flex-col items-center justify-center text-gray-300 px-2">
                                     <Calculator size={32} />
                                     <ArrowRight size={24} className="mt-[-10px]"/>
                                 </div>

                                 {/* Display BS */}
                                 <div className="flex-1 w-full bg-white border border-blue-100 rounded-xl p-4 shadow-sm relative overflow-hidden">
                                     <div className="absolute right-0 top-0 p-3 opacity-10">
                                         <Wallet size={64} className="text-blue-800"/>
                                     </div>
                                     <label className="block text-xs font-bold text-blue-800 mb-1 uppercase tracking-wide">Equivalente en Bolívares</label>
                                     <div className="text-3xl font-bold text-blue-700 font-mono tracking-tight">
                                         Bs. {montoBsEstimado}
                                     </div>
                                     <div className="mt-2 inline-flex items-center gap-2 bg-blue-50 px-2 py-1 rounded text-[10px] text-blue-600 font-medium">
                                         <span>Tasa BCV: {tasaCambio.toFixed(2)}</span>
                                     </div>
                                 </div>
                             </div>
                         </div>

                         <div className="mt-8 flex justify-end">
                             <button 
                                onClick={ejecutarGuardadoPago}
                                disabled={loading}
                                className="bg-slate-900 text-white px-8 py-4 rounded-xl font-bold hover:bg-slate-800 shadow-lg flex items-center gap-2 transition-transform active:scale-95"
                             >
                                 {loading ? <Loader2 className="animate-spin" /> : <CheckCircle size={22} />}
                                 Procesar Pago
                             </button>
                         </div>
                     </div>
                </div>
            )}

            {/* 3. SECCIÓN HISTORIAL */}
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
