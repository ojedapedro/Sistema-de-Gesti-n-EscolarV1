import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { RegistroPago, EstadoPago } from '../types';
import { BookOpen, Download, TrendingUp, Calendar, Loader2 } from 'lucide-react';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

export const LibroContable: React.FC = () => {
  const [pagosVerificados, setPagosVerificados] = useState<RegistroPago[]>([]);
  const [fechaFiltro, setFechaFiltro] = useState('');
  const [loading, setLoading] = useState(true);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const todos = await db.getPagos();
      let filtrados = todos.filter(p => p.estado === EstadoPago.VERIFICADO);

      if (fechaFiltro) {
          filtrados = filtrados.filter(p => p.fechaPago === fechaFiltro || p.fechaRegistro.startsWith(fechaFiltro));
      }

      filtrados.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setPagosVerificados(filtrados);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, [fechaFiltro]);

  const totalUSD = pagosVerificados.reduce((acc, p) => acc + p.monto, 0);
  const totalBsEstimado = pagosVerificados.reduce((acc, p) => acc + (p.montoBolivares || 0), 0);

  const descargarReporteLibro = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Libro de Pagos Verificados (Ingresos)', 14, 20);
    doc.setFontSize(10);
    doc.text(`Generado: ${new Date().toLocaleDateString()}`, 14, 28);
    
    const tableData = pagosVerificados.map(p => [
        p.fechaPago,
        p.nombreRepresentante,
        p.metodoPago,
        p.referencia,
        `$${p.monto.toFixed(2)}`,
        p.montoBolivares ? `Bs ${p.montoBolivares.toFixed(2)}` : '-'
    ]);

    (doc as any).autoTable({
        startY: 35,
        head: [['Fecha', 'Representante', 'Método', 'Referencia', 'Monto USD', 'Monto Bs']],
        body: tableData,
        foot: [[ 'TOTALES', '', '', '', `$${totalUSD.toFixed(2)}`, `Bs ${totalBsEstimado.toFixed(2)}` ]]
    });

    doc.save('libro_contable.pdf');
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-indigo-600" size={48} /></div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <BookOpen className="text-indigo-600" /> Libro de Cuentas (Verificadas)
          </h2>
          <p className="text-sm text-gray-500">Historial de todos los ingresos confirmados.</p>
        </div>
        
        <div className="flex gap-4 items-center">
            <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <input 
                    type="date" 
                    value={fechaFiltro}
                    onChange={(e) => setFechaFiltro(e.target.value)}
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
            </div>
            <button 
                onClick={descargarReporteLibro}
                className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 flex items-center gap-2"
            >
                <Download size={16} /> Exportar
            </button>
        </div>
      </div>

      {/* Tarjetas de Totales */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-green-50 p-6 rounded-xl border border-green-100 flex items-center justify-between">
            <div>
                <p className="text-sm font-medium text-green-700 uppercase tracking-wider">Total Ingresos USD</p>
                <h3 className="text-3xl font-bold text-green-800 mt-1">${totalUSD.toFixed(2)}</h3>
            </div>
            <div className="p-3 bg-green-200 rounded-full text-green-700">
                <TrendingUp size={24} />
            </div>
        </div>
        <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 flex items-center justify-between">
            <div>
                <p className="text-sm font-medium text-blue-700 uppercase tracking-wider">Total Ingresos Bs (Ref)</p>
                <h3 className="text-3xl font-bold text-blue-800 mt-1">Bs. {totalBsEstimado.toFixed(2)}</h3>
            </div>
            <div className="p-3 bg-blue-200 rounded-full text-blue-700">
                <TrendingUp size={24} />
            </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3">Fecha Pago</th>
                <th className="px-6 py-3">Representante / Cédula</th>
                <th className="px-6 py-3">Método</th>
                <th className="px-6 py-3 text-right">Monto (USD)</th>
                <th className="px-6 py-3 text-right">Monto (Bs)</th>
              </tr>
            </thead>
            <tbody>
                {pagosVerificados.length === 0 ? (
                     <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400">No hay pagos verificados.</td></tr>
                ) : (
                    pagosVerificados.map(pago => (
                        <tr key={pago.id} className="bg-white border-b hover:bg-gray-50">
                            <td className="px-6 py-4">{pago.fechaPago}</td>
                            <td className="px-6 py-4">
                                <div className="font-medium text-gray-900">{pago.nombreRepresentante}</div>
                                <div className="text-xs text-gray-400">{pago.cedulaRepresentante}</div>
                            </td>
                            <td className="px-6 py-4">
                                <span className="block text-gray-700">{pago.metodoPago}</span>
                                <span className="text-xs font-mono text-gray-400">Ref: {pago.referencia}</span>
                            </td>
                            <td className="px-6 py-4 text-right font-bold text-gray-900">${pago.monto.toFixed(2)}</td>
                            <td className="px-6 py-4 text-right text-gray-600">{pago.montoBolivares ? `Bs. ${pago.montoBolivares.toFixed(2)}` : '-'}</td>
                        </tr>
                    ))
                )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};