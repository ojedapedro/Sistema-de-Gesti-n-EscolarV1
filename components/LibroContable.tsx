
import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { RegistroPago, EstadoPago, PagoServicio, RegistroNomina } from '../types';
import { BookOpen, Download, TrendingUp, TrendingDown, Loader2, DollarSign, Users, Briefcase } from 'lucide-react';
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

type TabLibro = 'INGRESOS' | 'COMPRAS' | 'NOMINA';

export const LibroContable: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabLibro>('INGRESOS');
  
  // Data States
  const [ingresos, setIngresos] = useState<RegistroPago[]>([]);
  const [egresos, setEgresos] = useState<PagoServicio[]>([]);
  const [nomina, setNomina] = useState<RegistroNomina[]>([]);
  
  // Filtros
  const [fechaInicio, setFechaInicio] = useState(new Date().getFullYear() + '-' + (new Date().getMonth() + 1).toString().padStart(2,'0') + '-01'); // Primer día del mes
  const [fechaFin, setFechaFin] = useState(new Date().toISOString().split('T')[0]); // Hoy
  const [loading, setLoading] = useState(true);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const [allIngresos, allEgresos, allNomina] = await Promise.all([
        db.getPagos(),
        db.getPagosServicios(),
        db.getNominaHistory()
      ]);

      // 1. Filtrar Ingresos (Verificados)
      const ingresosFiltrados = allIngresos.filter(p => 
        p.estado === EstadoPago.VERIFICADO &&
        p.fechaPago >= fechaInicio && 
        p.fechaPago <= fechaFin
      ).sort((a, b) => new Date(b.fechaPago).getTime() - new Date(a.fechaPago).getTime());

      // 2. Filtrar Egresos (Compras y Servicios)
      // Se muestran tanto PAGADOS como PENDIENTES (Cuentas por pagar) si la fecha registro/vencimiento cae en rango
      const egresosFiltrados = allEgresos.filter(p => 
        (p.fechaPago >= fechaInicio && p.fechaPago <= fechaFin) || 
        (p.fechaVencimiento >= fechaInicio && p.fechaVencimiento <= fechaFin)
      ).sort((a, b) => new Date(b.fechaPago).getTime() - new Date(a.fechaPago).getTime());

      // 3. Filtrar Nómina
      const nominaFiltrada = allNomina.filter(n => 
        n.fechaPago >= fechaInicio && n.fechaPago <= fechaFin
      ).sort((a, b) => new Date(b.fechaPago).getTime() - new Date(a.fechaPago).getTime());

      setIngresos(ingresosFiltrados);
      setEgresos(egresosFiltrados);
      setNomina(nominaFiltrada);

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, [fechaInicio, fechaFin]);

  // --- CÁLCULOS ---
  const totalIngresosUSD = ingresos.reduce((acc, curr) => acc + (curr.monto || 0), 0);
  
  const totalComprasContadoUSD = egresos
    .filter(e => e.estado === 'PAGADO')
    .reduce((acc, curr) => acc + (curr.monto || 0), 0);
    
  const totalCuentasPorPagarUSD = egresos
    .filter(e => e.estado === 'PENDIENTE')
    .reduce((acc, curr) => acc + (curr.monto || 0), 0);

  const totalNominaUSD = nomina.reduce((acc, curr) => acc + (curr.totalPagar || 0), 0);

  const flujoCajaNeto = totalIngresosUSD - (totalComprasContadoUSD + totalNominaUSD);

  // --- EXPORTAR PDF ---
  const descargarReporteActual = async () => {
    try {
      const doc = new jsPDF();
      const logo = await loadImage(LOGO_URL);
      if (logo) doc.addImage(logo, 'PNG', 170, 10, 25, 25);

      doc.setFontSize(16);
      let titulo = "";
      let colorHeader = [0, 0, 0];

      if(activeTab === 'INGRESOS') {
          titulo = "LIBRO DE INGRESOS (Cobranza)";
          colorHeader = [46, 125, 50]; // Green
      } else if (activeTab === 'COMPRAS') {
          titulo = "LIBRO DE COMPRAS Y GASTOS";
          colorHeader = [198, 40, 40]; // Red
      } else {
          titulo = "LIBRO DE NÓMINA";
          colorHeader = [21, 101, 192]; // Blue
      }

      doc.setTextColor(colorHeader[0], colorHeader[1], colorHeader[2]);
      doc.text(titulo, 14, 20);
      
      doc.setTextColor(0);
      doc.setFontSize(10);
      doc.text(`Desde: ${fechaInicio}  Hasta: ${fechaFin}`, 14, 28);
      doc.text(`Generado: ${new Date().toLocaleString()}`, 14, 34);

      if (activeTab === 'INGRESOS') {
          autoTable(doc, {
              startY: 40,
              head: [['Fecha', 'Representante', 'Método', 'Ref', 'Monto USD']],
              body: ingresos.map(p => [p.fechaPago, p.nombreRepresentante, p.metodoPago, p.referencia, `$${(p.monto || 0).toFixed(2)}`]),
              foot: [['TOTAL INGRESOS', '', '', '', `$${totalIngresosUSD.toFixed(2)}`]],
              headStyles: { fillColor: [46, 125, 50] }
          });
      } else if (activeTab === 'COMPRAS') {
          autoTable(doc, {
              startY: 40,
              head: [['Fecha', 'Proveedor', 'Concepto', 'Categoría', 'Estado', 'Monto USD']],
              body: egresos.map(p => [p.fechaPago, p.proveedor, p.descripcion, p.categoria, p.estado, `$${p.monto.toFixed(2)}`]),
              foot: [['TOTAL (Contado + CxP)', '', '', '', '', `$${(totalComprasContadoUSD + totalCuentasPorPagarUSD).toFixed(2)}`]],
              headStyles: { fillColor: [198, 40, 40] }
          });
          
          doc.setFontSize(10);
          doc.text(`Resumen: Contado ($${totalComprasContadoUSD.toFixed(2)}) | Cuentas por Pagar ($${totalCuentasPorPagarUSD.toFixed(2)})`, 14, (doc as any).lastAutoTable.finalY + 10);

      } else if (activeTab === 'NOMINA') {
          autoTable(doc, {
              startY: 40,
              head: [['Fecha', 'Periodo', 'Empleado', 'Cargo', 'Total Pagado']],
              body: nomina.map(n => [n.fechaPago, n.periodo, n.nombreCompleto, n.cargo, `$${n.totalPagar.toFixed(2)}`]),
              foot: [['TOTAL NÓMINA', '', '', '', `$${totalNominaUSD.toFixed(2)}`]],
              headStyles: { fillColor: [21, 101, 192] }
          });
      }

      doc.save(`Libro_${activeTab}_${fechaInicio}_${fechaFin}.pdf`);
    } catch (error) {
      console.error(error);
      alert("Error generando PDF.");
    }
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-indigo-600" size={48} /></div>;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* HEADER CONTROLES */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <BookOpen className="text-indigo-600" /> Libros Contables
          </h2>
          <p className="text-sm text-gray-500">Gestión Integral de Ingresos, Compras, CxP y Nómina.</p>
        </div>
        
        <div className="flex flex-wrap gap-4 items-end bg-gray-50 p-3 rounded-lg border border-gray-200">
            <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Desde</label>
                <input 
                    type="date" 
                    value={fechaInicio}
                    onChange={(e) => setFechaInicio(e.target.value)}
                    className="border border-gray-300 rounded-md p-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
            </div>
            <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Hasta</label>
                <input 
                    type="date" 
                    value={fechaFin}
                    onChange={(e) => setFechaFin(e.target.value)}
                    className="border border-gray-300 rounded-md p-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
            </div>
            <button 
                onClick={descargarReporteActual}
                className="bg-slate-800 text-white px-4 py-1.5 rounded-md text-sm font-medium hover:bg-slate-700 flex items-center gap-2 h-[34px]"
            >
                <Download size={16} /> PDF
            </button>
        </div>
      </div>

      {/* TARJETAS RESUMEN FINANCIERO (DASHBOARD MINI) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-green-50 p-4 rounded-xl border border-green-100">
              <p className="text-xs font-bold text-green-700 uppercase">Total Ingresos</p>
              <h3 className="text-2xl font-bold text-green-800 mt-1">${totalIngresosUSD.toLocaleString(undefined, {minimumFractionDigits: 2})}</h3>
              <div className="flex items-center gap-1 text-xs text-green-600 mt-1"><TrendingUp size={12}/> Cobranza Efectiva</div>
          </div>
          
          <div className="bg-red-50 p-4 rounded-xl border border-red-100">
              <p className="text-xs font-bold text-red-700 uppercase">Gastos Operativos</p>
              <h3 className="text-2xl font-bold text-red-800 mt-1">${(totalComprasContadoUSD).toLocaleString(undefined, {minimumFractionDigits: 2})}</h3>
              <div className="flex items-center gap-1 text-xs text-red-600 mt-1"><TrendingDown size={12}/> Compras Contado</div>
          </div>

          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
              <p className="text-xs font-bold text-blue-700 uppercase">Nómina Pagada</p>
              <h3 className="text-2xl font-bold text-blue-800 mt-1">${totalNominaUSD.toLocaleString(undefined, {minimumFractionDigits: 2})}</h3>
              <div className="flex items-center gap-1 text-xs text-blue-600 mt-1"><Users size={12}/> Personal</div>
          </div>

          <div className={`p-4 rounded-xl border ${flujoCajaNeto >= 0 ? 'bg-indigo-50 border-indigo-100' : 'bg-orange-50 border-orange-100'}`}>
              <p className={`text-xs font-bold uppercase ${flujoCajaNeto >= 0 ? 'text-indigo-700' : 'text-orange-700'}`}>Flujo de Caja Neto</p>
              <h3 className={`text-2xl font-bold mt-1 ${flujoCajaNeto >= 0 ? 'text-indigo-800' : 'text-orange-800'}`}>${flujoCajaNeto.toLocaleString(undefined, {minimumFractionDigits: 2})}</h3>
              <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">Ingresos - (Gastos + Nómina)</div>
          </div>
      </div>

      {/* NAVEGACIÓN DE TABS */}
      <div className="flex border-b border-gray-200 bg-white rounded-t-xl px-4 pt-2">
          <button
            onClick={() => setActiveTab('INGRESOS')}
            className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'INGRESOS' ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            <DollarSign size={16}/> Libro de Ingresos
          </button>
          <button
            onClick={() => setActiveTab('COMPRAS')}
            className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'COMPRAS' ? 'border-red-600 text-red-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            <Briefcase size={16}/> Libro de Compras y CxP
          </button>
          <button
            onClick={() => setActiveTab('NOMINA')}
            className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'NOMINA' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            <Users size={16}/> Libro de Nómina
          </button>
      </div>

      {/* CONTENIDO DE TABLAS */}
      <div className="bg-white rounded-b-xl rounded-tr-xl shadow-sm overflow-hidden border-x border-b border-gray-100 min-h-[400px]">
        
        {/* TABLA INGRESOS */}
        {activeTab === 'INGRESOS' && (
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-500">
                    <thead className="text-xs text-gray-700 uppercase bg-green-50 border-b border-green-100">
                        <tr>
                            <th className="px-6 py-3">Fecha Pago</th>
                            <th className="px-6 py-3">Representante</th>
                            <th className="px-6 py-3">Método / Ref</th>
                            <th className="px-6 py-3 text-right">Monto USD</th>
                            <th className="px-6 py-3 text-right">Monto Bs</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {ingresos.length === 0 ? <tr><td colSpan={5} className="text-center py-8">No hay ingresos en este período.</td></tr> : ingresos.map(p => (
                            <tr key={p.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap">{p.fechaPago}</td>
                                <td className="px-6 py-4 font-medium text-gray-900">
                                    {p.nombreRepresentante}
                                    <div className="text-xs text-gray-400">{p.cedulaRepresentante}</div>
                                </td>
                                <td className="px-6 py-4">
                                    {p.metodoPago}
                                    <div className="text-xs font-mono">{p.referencia}</div>
                                </td>
                                <td className="px-6 py-4 text-right font-bold text-green-700">${(p.monto || 0).toFixed(2)}</td>
                                <td className="px-6 py-4 text-right text-gray-600">{p.montoBolivares ? `Bs ${p.montoBolivares.toFixed(2)}` : '-'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}

        {/* TABLA COMPRAS (EGRESOS) */}
        {activeTab === 'COMPRAS' && (
            <div>
                <div className="p-4 bg-red-50/50 border-b border-red-100 flex justify-end gap-4 text-xs font-bold text-gray-600">
                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500"></div> DE CONTADO: ${totalComprasContadoUSD.toFixed(2)}</span>
                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-orange-500"></div> POR PAGAR: ${totalCuentasPorPagarUSD.toFixed(2)}</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-500">
                        <thead className="text-xs text-gray-700 uppercase bg-red-50 border-b border-red-100">
                            <tr>
                                <th className="px-6 py-3">Fecha</th>
                                <th className="px-6 py-3">Proveedor</th>
                                <th className="px-6 py-3">Concepto / Categoría</th>
                                <th className="px-6 py-3 text-center">Estado</th>
                                <th className="px-6 py-3 text-right">Monto USD</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {egresos.length === 0 ? <tr><td colSpan={5} className="text-center py-8">No hay compras/gastos en este período.</td></tr> : egresos.map(e => (
                                <tr key={e.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap">{e.fechaPago}</td>
                                    <td className="px-6 py-4 font-medium text-gray-900">{e.proveedor}</td>
                                    <td className="px-6 py-4">
                                        {e.descripcion}
                                        <div className="text-xs text-indigo-600 font-medium bg-indigo-50 inline-block px-1 rounded ml-2">{e.categoria}</div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`px-2 py-1 rounded text-[10px] font-bold ${e.estado === 'PAGADO' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                            {e.estado === 'PAGADO' ? 'CONTADO' : 'CX POR PAGAR'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right font-bold text-red-700">${e.monto.toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {/* TABLA NOMINA */}
        {activeTab === 'NOMINA' && (
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-500">
                    <thead className="text-xs text-gray-700 uppercase bg-blue-50 border-b border-blue-100">
                        <tr>
                            <th className="px-6 py-3">Fecha Pago</th>
                            <th className="px-6 py-3">Periodo</th>
                            <th className="px-6 py-3">Empleado</th>
                            <th className="px-6 py-3">Cargo</th>
                            <th className="px-6 py-3 text-right">Total Pagado</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {nomina.length === 0 ? <tr><td colSpan={5} className="text-center py-8">No hay pagos de nómina en este período.</td></tr> : nomina.map(n => (
                            <tr key={n.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap">{n.fechaPago}</td>
                                <td className="px-6 py-4">{n.periodo}</td>
                                <td className="px-6 py-4 font-medium text-gray-900">
                                    {n.nombreCompleto}
                                    <div className="text-xs text-gray-400">{n.cedula}</div>
                                </td>
                                <td className="px-6 py-4">{n.cargo}</td>
                                <td className="px-6 py-4 text-right font-bold text-blue-700">${n.totalPagar.toFixed(2)}</td>
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
