
import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { PagoServicio, CategoriaServicio, MetodoPago } from '../types';
import { useAuth } from '../context/AuthContext';
import { Receipt, Calendar, AlertTriangle, CheckCircle, Plus, Search, FileText, X, Save, Loader2, Landmark } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { LOGO_URL } from '../constants';

// Helper Imagen
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

export const PagosServicios: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'REGISTRAR' | 'HISTORIAL'>('REGISTRAR');
  const [pagos, setPagos] = useState<PagoServicio[]>([]);
  const [loading, setLoading] = useState(false);
  const [tasaCambio, setTasaCambio] = useState(0);

  // Filtros
  const [filtroCategoria, setFiltroCategoria] = useState<string>('TODAS');
  const [filtroFecha, setFiltroFecha] = useState(new Date().toISOString().split('T')[0]);

  // Formulario
  const [formData, setFormData] = useState<Partial<PagoServicio>>({
    fechaPago: new Date().toISOString().split('T')[0],
    fechaVencimiento: new Date().toISOString().split('T')[0],
    metodoPago: MetodoPago.TRANSFERENCIA,
    estado: 'PAGADO'
  });

  useEffect(() => {
    const init = async () => {
        setLoading(true);
        try {
            const [p, conf] = await Promise.all([db.getPagosServicios(), db.getConfig()]);
            setPagos(p.sort((a,b) => new Date(b.fechaPago).getTime() - new Date(a.fechaPago).getTime()));
            setTasaCambio(conf.tasaCambio);
        } catch(e) { console.error(e); }
        finally { setLoading(false); }
    };
    init();
  }, []);

  const handleMontoChange = (val: string, type: 'USD' | 'BS') => {
      const num = parseFloat(val);
      if(isNaN(num)) {
          setFormData(prev => ({ ...prev, monto: 0, montoBolivares: 0 }));
          return;
      }

      if (type === 'USD') {
          setFormData(prev => ({ 
              ...prev, 
              monto: num, 
              montoBolivares: tasaCambio > 0 ? parseFloat((num * tasaCambio).toFixed(2)) : 0 
          }));
      } else {
          setFormData(prev => ({ 
              ...prev, 
              montoBolivares: num, 
              monto: tasaCambio > 0 ? parseFloat((num / tasaCambio).toFixed(2)) : 0 
          }));
      }
  };

  const guardarPago = async () => {
      if(!formData.categoria || !formData.proveedor || !formData.monto) {
          alert("Complete los campos obligatorios (Categoría, Proveedor, Monto)");
          return;
      }

      setLoading(true);
      try {
          const nuevoPago: PagoServicio = {
              id: crypto.randomUUID(),
              categoria: formData.categoria as CategoriaServicio,
              proveedor: formData.proveedor!,
              descripcion: formData.descripcion || '',
              fechaVencimiento: formData.fechaVencimiento!,
              fechaPago: formData.fechaPago!,
              monto: Number(formData.monto),
              montoBolivares: Number(formData.montoBolivares),
              tasaCambio: tasaCambio,
              metodoPago: formData.metodoPago as MetodoPago,
              referencia: formData.referencia || '',
              estado: formData.estado as 'PAGADO' | 'PENDIENTE',
              registradoPor: user?.nombre || 'Admin'
          };

          await db.savePagoServicio(nuevoPago);
          setPagos(prev => [nuevoPago, ...prev]);
          alert("Pago registrado correctamente.");
          
          // Reset parcial
          setFormData({
            fechaPago: new Date().toISOString().split('T')[0],
            fechaVencimiento: new Date().toISOString().split('T')[0],
            metodoPago: MetodoPago.TRANSFERENCIA,
            estado: 'PAGADO',
            categoria: undefined,
            proveedor: '',
            descripcion: '',
            monto: 0,
            montoBolivares: 0,
            referencia: ''
          });
      } catch(e) {
          console.error(e);
          alert("Error al guardar.");
      } finally {
          setLoading(false);
      }
  };

  const generarReporteConciliacion = async () => {
      const pagosDelDia = pagos.filter(p => p.fechaPago === filtroFecha && p.estado === 'PAGADO');
      
      if(pagosDelDia.length === 0) {
          alert("No hay pagos registrados para la fecha seleccionada.");
          return;
      }

      const doc = new jsPDF();
      const logo = await loadImage(LOGO_URL);
      if(logo) doc.addImage(logo, 'PNG', 170, 10, 25, 25);

      doc.setFontSize(16);
      doc.text("Conciliación Diaria de Egresos (Servicios)", 14, 20);
      doc.setFontSize(10);
      doc.text(`Fecha de Conciliación: ${filtroFecha}`, 14, 26);
      doc.text(`Generado por: ${user?.nombre}`, 14, 32);

      // Agrupar por Categoría
      const categorias = [...new Set(pagosDelDia.map(p => p.categoria))];
      let granTotalUSD = 0;
      let granTotalBS = 0;

      let finalY = 40;

      categorias.forEach(cat => {
          const items = pagosDelDia.filter(p => p.categoria === cat);
          const subtotalUSD = items.reduce((acc, curr) => acc + curr.monto, 0);
          const subtotalBS = items.reduce((acc, curr) => acc + curr.montoBolivares, 0);
          
          granTotalUSD += subtotalUSD;
          granTotalBS += subtotalBS;

          doc.setFontSize(11);
          doc.setFont("helvetica", "bold");
          doc.text(cat, 14, finalY);
          
          const bodyData = items.map(p => [
              p.proveedor,
              p.descripcion,
              p.referencia,
              `$${p.monto.toFixed(2)}`,
              `Bs. ${p.montoBolivares.toFixed(2)}`
          ]);

          autoTable(doc, {
              startY: finalY + 2,
              head: [['Proveedor', 'Descripción', 'Ref', 'Monto USD', 'Monto BS']],
              body: bodyData,
              theme: 'grid',
              styles: { fontSize: 8 },
              headStyles: { fillColor: [100, 100, 100] }
          });

          finalY = (doc as any).lastAutoTable.finalY + 10;
          doc.setFontSize(9);
          doc.setFont("helvetica", "bold");
          doc.text(`Subtotal ${cat}: $${subtotalUSD.toFixed(2)} / Bs. ${subtotalBS.toFixed(2)}`, 14, finalY - 3);
          finalY += 5;
      });

      doc.line(14, finalY, 196, finalY);
      doc.setFontSize(12);
      doc.text(`TOTAL EGRESOS DEL DÍA: $${granTotalUSD.toFixed(2)}`, 14, finalY + 10);
      doc.text(`Equivalente en Bs: ${granTotalBS.toFixed(2)}`, 14, finalY + 16);

      doc.save(`Conciliacion_Servicios_${filtroFecha}.pdf`);
  };

  // Filtrado para la tabla
  const pagosFiltrados = pagos.filter(p => {
      const matchCat = filtroCategoria === 'TODAS' || p.categoria === filtroCategoria;
      return matchCat;
  });

  const getDiasVencimiento = (fechaVenc: string) => {
      const hoy = new Date();
      const venc = new Date(fechaVenc);
      const diffTime = venc.getTime() - hoy.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
      return diffDays;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div>
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <Landmark className="text-indigo-600" /> Pagos de Servicios e Impuestos
                </h2>
                <p className="text-sm text-gray-500">Gestión de egresos operativos y obligaciones fiscales.</p>
            </div>
            <div className="flex gap-2 bg-slate-100 p-1 rounded-lg">
                <button onClick={() => setActiveTab('REGISTRAR')} className={`px-4 py-2 rounded text-sm font-medium ${activeTab === 'REGISTRAR' ? 'bg-white shadow text-indigo-600' : 'text-gray-600'}`}>Registrar Pago</button>
                <button onClick={() => setActiveTab('HISTORIAL')} className={`px-4 py-2 rounded text-sm font-medium ${activeTab === 'HISTORIAL' ? 'bg-white shadow text-indigo-600' : 'text-gray-600'}`}>Historial y Conciliación</button>
            </div>
        </div>

        {activeTab === 'REGISTRAR' && (
            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-700 mb-6 flex items-center gap-2"><Receipt size={20}/> Nuevo Registro de Egreso</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                        <select 
                            className="w-full border p-2 rounded-lg"
                            value={formData.categoria || ''}
                            onChange={e => setFormData({...formData, categoria: e.target.value as CategoriaServicio})}
                        >
                            <option value="">Seleccione...</option>
                            {Object.values(CategoriaServicio).map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor / Entidad</label>
                        <input 
                            type="text" 
                            className="w-full border p-2 rounded-lg" 
                            placeholder="Ej: CORPOELEC, SENIAT, CANTV"
                            value={formData.proveedor || ''}
                            onChange={e => setFormData({...formData, proveedor: e.target.value})}
                        />
                    </div>
                    
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Descripción / Concepto</label>
                        <input 
                            type="text" 
                            className="w-full border p-2 rounded-lg" 
                            placeholder="Ej: Factura de Electricidad Marzo 2025"
                            value={formData.descripcion || ''}
                            onChange={e => setFormData({...formData, descripcion: e.target.value})}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Monto (USD Referencial)</label>
                        <input 
                            type="number" 
                            className="w-full border p-2 rounded-lg font-bold" 
                            value={formData.monto || ''}
                            onChange={e => handleMontoChange(e.target.value, 'USD')}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Monto Pagado (Bs)</label>
                        <input 
                            type="number" 
                            className="w-full border p-2 rounded-lg bg-slate-50" 
                            value={formData.montoBolivares || ''}
                            onChange={e => handleMontoChange(e.target.value, 'BS')}
                        />
                        <p className="text-xs text-gray-400 mt-1">Tasa actual: {tasaCambio}</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Pago</label>
                        <input 
                            type="date" 
                            className="w-full border p-2 rounded-lg" 
                            value={formData.fechaPago}
                            onChange={e => setFormData({...formData, fechaPago: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Vencimiento (Factura)</label>
                        <input 
                            type="date" 
                            className="w-full border p-2 rounded-lg" 
                            value={formData.fechaVencimiento}
                            onChange={e => setFormData({...formData, fechaVencimiento: e.target.value})}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Método de Pago</label>
                        <select 
                            className="w-full border p-2 rounded-lg"
                            value={formData.metodoPago}
                            onChange={e => setFormData({...formData, metodoPago: e.target.value as MetodoPago})}
                        >
                            {Object.values(MetodoPago).map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Referencia</label>
                        <input 
                            type="text" 
                            className="w-full border p-2 rounded-lg" 
                            value={formData.referencia || ''}
                            onChange={e => setFormData({...formData, referencia: e.target.value})}
                        />
                    </div>
                </div>

                <div className="mt-8 flex justify-end">
                    <button 
                        onClick={guardarPago}
                        disabled={loading}
                        className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-indigo-700 flex items-center gap-2"
                    >
                        {loading ? <Loader2 className="animate-spin"/> : <Save size={20}/>}
                        Registrar Egreso
                    </button>
                </div>
            </div>
        )}

        {activeTab === 'HISTORIAL' && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div className="flex flex-col md:flex-row justify-between items-end gap-4 mb-6">
                    <div className="flex gap-4 w-full md:w-auto">
                        <div className="flex-1">
                            <label className="block text-xs font-bold text-gray-500 mb-1">Filtrar Categoría</label>
                            <select 
                                className="border p-2 rounded text-sm w-full"
                                value={filtroCategoria}
                                onChange={e => setFiltroCategoria(e.target.value)}
                            >
                                <option value="TODAS">Todas</option>
                                {Object.values(CategoriaServicio).map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div className="flex-1">
                            <label className="block text-xs font-bold text-gray-500 mb-1">Fecha Reporte</label>
                            <input 
                                type="date" 
                                className="border p-2 rounded text-sm w-full"
                                value={filtroFecha}
                                onChange={e => setFiltroFecha(e.target.value)}
                            />
                        </div>
                    </div>
                    <button 
                        onClick={generarReporteConciliacion}
                        className="bg-slate-800 text-white px-4 py-2 rounded text-sm font-bold flex items-center gap-2 hover:bg-slate-700 h-[38px]"
                    >
                        <FileText size={16}/> Reporte Conciliación Diaria
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-500">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                            <tr>
                                <th className="px-6 py-3">Fecha Pago</th>
                                <th className="px-6 py-3">Proveedor / Concepto</th>
                                <th className="px-6 py-3">Categoría</th>
                                <th className="px-6 py-3 text-right">Monto $</th>
                                <th className="px-6 py-3 text-right">Monto Bs</th>
                                <th className="px-6 py-3 text-center">Status Vencimiento</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {pagosFiltrados.map(p => {
                                const diasRestantes = getDiasVencimiento(p.fechaVencimiento);
                                return (
                                    <tr key={p.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">{p.fechaPago}</td>
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-gray-800">{p.proveedor}</div>
                                            <div className="text-xs text-gray-400">{p.descripcion}</div>
                                        </td>
                                        <td className="px-6 py-4 text-xs">{p.categoria}</td>
                                        <td className="px-6 py-4 text-right font-bold text-slate-700">${p.monto.toFixed(2)}</td>
                                        <td className="px-6 py-4 text-right text-xs">Bs. {p.montoBolivares.toFixed(2)}</td>
                                        <td className="px-6 py-4 text-center">
                                            {p.estado === 'PAGADO' ? (
                                                <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-[10px] font-bold">PAGADO</span>
                                            ) : diasRestantes < 0 ? (
                                                <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-[10px] font-bold flex items-center justify-center gap-1"><AlertTriangle size={10}/> VENCIDO ({Math.abs(diasRestantes)}d)</span>
                                            ) : (
                                                <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-[10px] font-bold">Vence en {diasRestantes} días</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        )}
    </div>
  );
};
