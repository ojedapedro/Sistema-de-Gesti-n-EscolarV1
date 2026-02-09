
import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { RegistroPago, EstadoPago, Representante } from '../types';
import { Check, X, AlertTriangle, RefreshCw, Search, Monitor, Loader2, Printer } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { LOGO_URL } from '../constants';

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

export const Verificacion: React.FC = () => {
  const [pagos, setPagos] = useState<RegistroPago[]>([]);
  const [activeTab, setActiveTab] = useState<'PENDIENTE' | 'RECHAZADO'>('PENDIENTE');
  const [filtroRef, setFiltroRef] = useState('');
  const [loading, setLoading] = useState(true);

  const cargarPagos = async () => {
    setLoading(true);
    try {
      const todos = await db.getPagos();
      
      const estadoObjetivo = activeTab === 'PENDIENTE' 
        ? EstadoPago.PENDIENTE_VERIFICACION 
        : EstadoPago.RECHAZADO;

      let filtrados = todos.filter(p => p.estado === estadoObjetivo);

      if (filtroRef) {
        filtrados = filtrados.filter(p => 
          p.referencia.toLowerCase().includes(filtroRef.toLowerCase()) ||
          p.cedulaRepresentante.includes(filtroRef)
        );
      }

      filtrados.sort((a, b) => {
        const dateA = new Date(a.timestamp).getTime();
        const dateB = new Date(b.timestamp).getTime();
        return activeTab === 'PENDIENTE' ? dateA - dateB : dateB - dateA;
      });

      setPagos(filtrados);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarPagos();
  }, [activeTab, filtroRef]);

  const generarReciboAprobacion = async (pago: RegistroPago, rep: Representante, saldoRestante: number) => {
    try {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.width;
        
        // --- CÁLCULOS VISUALES ---
        // saldoRestante es el saldo calculado DESPUES de aprobar este pago.
        // Por tanto, el saldo anterior era: saldoRestante + pago.monto
        const saldoAnterior = saldoRestante + (pago.monto || 0);

        // --- HEADER ---
        doc.setFillColor(63, 81, 181); // Indigo
        doc.rect(0, 0, pageWidth, 40, 'F');
        
        const logo = await loadImage(LOGO_URL);
        if (logo) {
            doc.addImage(logo, 'PNG', 10, 5, 30, 30);
        }

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        
        // Si hay saldo restante > 0, es un ABONO. Si no, es PAGO TOTAL.
        const tituloRecibo = saldoRestante > 0 ? "RECIBO DE ABONO" : "RECIBO DE PAGO (SOLVENTE)";
        doc.text(tituloRecibo, pageWidth / 2, 20, { align: 'center' });
        doc.setFontSize(12);
        doc.text("AdminPro - Verificación de Pagos", pageWidth / 2, 30, { align: 'center' });

        // --- INFO GENERAL ---
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);
        doc.text(`Fecha Emisión: ${new Date().toLocaleDateString()}`, 14, 50);
        doc.text(`Fecha Pago: ${pago.fechaPago}`, 14, 56);
        doc.text(`Recibo N°: ${pago.id.substring(0, 8).toUpperCase()}`, 14, 62);
        
        doc.setDrawColor(200, 200, 200);
        doc.line(14, 68, pageWidth - 14, 68);
        
        // --- DATOS REPRESENTANTE ---
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("DATOS DEL REPRESENTANTE", 14, 78);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.text(`Nombre: ${rep.nombres} ${rep.apellidos}`, 14, 86);
        doc.text(`Cédula: ${rep.cedula}`, 14, 92);
        doc.text(`Matrícula Familiar: ${rep.matricula}`, 14, 98);

        // --- DETALLES TRANSACCIÓN (Tabla) ---
        // Usar autoTable para mejor presentación de Bs y $
        autoTable(doc, {
            startY: 110,
            head: [['Concepto', 'Método', 'Referencia', 'Monto USD', 'Monto Bs']],
            body: [[
                `${pago.mes} ${pago.anio}`,
                pago.metodoPago,
                pago.referencia,
                `$${(pago.monto || 0).toFixed(2)}`,
                pago.montoBolivares ? `Bs. ${pago.montoBolivares.toFixed(2)}` : '-'
            ]],
            headStyles: { fillColor: [50, 50, 50] }
        });

        // --- CAJA FINANCIERA (SALDOS) ---
        const boxY = (doc as any).lastAutoTable.finalY + 15;
        doc.setDrawColor(0, 0, 0);
        doc.setFillColor(245, 247, 250);
        doc.rect(14, boxY, pageWidth - 28, 55, 'FD');

        doc.setFont("helvetica", "bold");
        doc.text("ESTADO DE CUENTA ACTUALIZADO", 20, boxY + 10);
        doc.setFontSize(11);
        doc.setFont("helvetica", "normal");
        
        // Saldo Anterior
        const textoSaldoAnt = "Saldo Anterior Estimado:";
        doc.text(textoSaldoAnt, 20, boxY + 20);
        doc.text(`$${Math.abs(saldoAnterior).toFixed(2)}`, pageWidth - 30, boxY + 20, { align: 'right' });

        // Monto Pagado (Abono)
        doc.text("(-) Monto Abonado:", 20, boxY + 28);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0, 100, 0); // Verde oscuro
        doc.text(`$${(pago.monto || 0).toFixed(2)}`, pageWidth - 30, boxY + 28, { align: 'right' });
        doc.setTextColor(0);

        doc.setDrawColor(200);
        doc.line(20, boxY + 38, pageWidth - 20, boxY + 38);

        // Saldo Final
        doc.setFont("helvetica", "bold");
        let labelFinal = "SALDO PENDIENTE (DEUDA):";
        if (saldoRestante <= 0) labelFinal = "SALDO RESTANTE (SOLVENTE):";
        doc.text(labelFinal, 20, boxY + 45);
        
        if (saldoRestante > 0) doc.setTextColor(200, 0, 0); // Rojo si debe
        else doc.setTextColor(0, 150, 0); // Verde si está a favor
        
        doc.text(`$${Math.abs(saldoRestante).toFixed(2)}`, pageWidth - 30, boxY + 45, { align: 'right' });

        // --- PIE ---
        doc.setTextColor(150);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text(`Recibo generado automáticamente tras verificación.`, 105, 270, { align: 'center' });
        doc.text(`Fecha impresión: ${new Date().toLocaleString()}`, 105, 275, { align: 'center' });

        doc.save(`Recibo_Verificado_${pago.cedulaRepresentante}_${pago.id.substring(0,4)}.pdf`);
    } catch (e) {
        console.error(e);
        alert("Error generando el PDF del recibo.");
    }
  };

  const procesarPago = async (pago: RegistroPago, accion: 'APROBAR' | 'RECHAZAR' | 'RECUPERAR') => {
    let nuevoEstado: EstadoPago;
    let mensaje = "";

    switch (accion) {
      case 'APROBAR':
        nuevoEstado = EstadoPago.VERIFICADO;
        mensaje = `⚠️ CONFIRMACIÓN DE APROBACIÓN ⚠️\n\n¿Está seguro de que desea APROBAR este pago?\n\n👤 Representante: ${pago.nombreRepresentante}\n💳 Referencia: ${pago.referencia}\n💰 Monto: $${(pago.monto || 0).toFixed(2)}\n\n✅ Esta acción validará el ingreso y generará el recibo automáticamente.`;
        break;
      case 'RECHAZAR':
        nuevoEstado = EstadoPago.RECHAZADO;
        mensaje = `⛔ CONFIRMACIÓN DE RECHAZO ⛔\n\n¿Está seguro de que desea RECHAZAR este pago?\n\n👤 Representante: ${pago.nombreRepresentante}\n💳 Referencia: ${pago.referencia}\n💰 Monto: $${(pago.monto || 0).toFixed(2)}\n\n❌ El pago será marcado como inválido.`;
        break;
      case 'RECUPERAR': 
        nuevoEstado = EstadoPago.VERIFICADO;
        mensaje = `🔄 CONFIRMACIÓN DE RECUPERACIÓN 🔄\n\n¿Desea RECUPERAR y APROBAR este pago previamente rechazado?\n\n👤 Representante: ${pago.nombreRepresentante}\n💳 Referencia: ${pago.referencia}\n\n✅ Se marcará como verificado y se generará el recibo.`;
        break;
      default:
        return;
    }

    if (window.confirm(mensaje)) {
      setLoading(true);
      try {
        // 1. Actualizar estado en BD
        await db.updateEstadoPago(pago.id, pago.referencia, pago.cedulaRepresentante, nuevoEstado);
        
        // 2. Si se aprueba, calcular saldo y generar recibo
        if (accion === 'APROBAR' || accion === 'RECUPERAR') {
             const rep = await db.getRepresentanteByCedula(pago.cedulaRepresentante);
             
             // NOTA: calcularSaldoPendiente devuelve el saldo TOTAL actual de la BD.
             // Como acabamos de marcar el pago como VERIFICADO en el paso 1,
             // el saldo que retorna esta función YA incluye el descuento de este pago.
             const saldoRestanteReal = await db.calcularSaldoPendiente(pago.cedulaRepresentante);
             
             if (rep) {
                 await generarReciboAprobacion(pago, rep, saldoRestanteReal);
             }
        }

        await cargarPagos();
      } catch (e) {
        console.error(e);
        alert("Error actualizando estado o generando recibo.");
        setLoading(false);
      }
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Monitor className="text-indigo-600" /> Verificación de Transacciones
          </h2>
          <p className="text-sm text-gray-500">Gestión de pagos electrónicos (Móvil, Transferencias, Zelle)</p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar referencia o cédula..." 
            value={filtroRef}
            onChange={(e) => setFiltroRef(e.target.value)}
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none w-64"
          />
        </div>
      </div>

      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('PENDIENTE')}
          className={`px-6 py-3 font-medium text-sm focus:outline-none border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'PENDIENTE' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500'
          }`}
        >
          <RefreshCw size={16} /> Pendientes
        </button>
        <button
          onClick={() => setActiveTab('RECHAZADO')}
          className={`px-6 py-3 font-medium text-sm focus:outline-none border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'RECHAZADO' ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500'
          }`}
        >
          <AlertTriangle size={16} /> Rechazados
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100 min-h-[300px]">
        {loading ? (
          <div className="flex justify-center items-center h-full py-20">
            <Loader2 className="animate-spin text-indigo-600" size={48} />
          </div>
        ) : pagos.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <p>No hay pagos en esta bandeja.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-500">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3">Fecha</th>
                  <th className="px-6 py-3">Concepto</th>
                  <th className="px-6 py-3">Representante</th>
                  <th className="px-6 py-3">Método / Ref</th>
                  <th className="px-6 py-3 text-right">Monto</th>
                  <th className="px-6 py-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {pagos.map((pago) => (
                  <tr key={pago.id} className="bg-white border-b hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      {pago.fechaRegistro}
                    </td>
                     <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-bold text-gray-700">{pago.mes || 'N/A'}</div>
                      <div className="text-xs text-gray-400">{pago.anio}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{pago.nombreRepresentante}</div>
                      <div className="text-xs text-gray-400">{pago.cedulaRepresentante}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-semibold text-gray-700">{pago.metodoPago}</span>
                      <div className="font-mono text-xs bg-gray-100 inline-block px-2 py-1 rounded mt-1 border">
                        Ref: {pago.referencia}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="font-bold text-gray-900">${(pago.monto || 0).toFixed(2)}</div>
                      {pago.montoBolivares && pago.montoBolivares > 0 && (
                        <div className="text-xs text-gray-500">Bs. {(pago.montoBolivares || 0).toFixed(2)}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center gap-3">
                        {activeTab === 'PENDIENTE' && (
                          <>
                            <button onClick={() => procesarPago(pago, 'APROBAR')} className="p-2 bg-green-50 rounded-full hover:bg-green-100 text-green-600" title="Aprobar Pago y Generar Recibo"><Check size={20} /></button>
                            <button onClick={() => procesarPago(pago, 'RECHAZAR')} className="p-2 bg-red-50 rounded-full hover:bg-red-100 text-red-600" title="Rechazar Pago"><X size={20} /></button>
                          </>
                        )}
                        {activeTab === 'RECHAZADO' && (
                           <button onClick={() => procesarPago(pago, 'RECUPERAR')} className="flex items-center gap-1 text-xs bg-gray-100 px-2 py-1 rounded border border-gray-300 hover:bg-gray-200">Recuperar</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
