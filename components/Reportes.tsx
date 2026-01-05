import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { Download, Bot, RefreshCw, Loader2, FileText, Filter, Calendar, DollarSign, CheckCircle, XCircle } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { RegistroPago, Representante, EstadoPago, NivelConfig } from '../types';
import { MENSUALIDADES } from '../constants';

type TipoReporte = 'TRANSACCIONES' | 'SOLVENCIA';

interface DeudaCalculada {
  cedula: string;
  nombre: string;
  matricula: string;
  totalAlumnos: number;
  deudaEsperada: number;
  totalPagado: number;
  saldoPendiente: number;
  esMoroso: boolean;
}

export const Reportes: React.FC = () => {
  // Estado de Datos
  const [pagos, setPagos] = useState<RegistroPago[]>([]);
  const [representantes, setRepresentantes] = useState<Representante[]>([]);
  const [nivelesConfig, setNivelesConfig] = useState<NivelConfig[]>([]);
  const [solvencias, setSolvencias] = useState<DeudaCalculada[]>([]);

  // Filtros
  const [tipoReporte, setTipoReporte] = useState<TipoReporte>('TRANSACCIONES');
  const [filtroCedula, setFiltroCedula] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [filtroVerificacion, setFiltroVerificacion] = useState('TODOS'); // TODOS, VERIFICADO, PENDIENTE
  const [filtroEstadoSolvencia, setFiltroEstadoSolvencia] = useState('TODOS'); // TODOS, MOROSO, SOLVENTE

  // UI
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [aiSummary, setAiSummary] = useState<string>('');
  const hasApiKey = !!process.env.API_KEY;

  useEffect(() => {
    cargarDatosGenerales();
  }, []);

  const cargarDatosGenerales = async () => {
    setLoading(true);
    try {
      const [pData, rData, nData] = await Promise.all([
        db.getPagos(),
        db.getRepresentantes(),
        db.getNiveles()
      ]);
      setPagos(pData);
      setRepresentantes(rData);
      setNivelesConfig(nData);
      
      // Calcular solvencias una vez cargados los datos
      calcularSolvencias(rData, pData, nData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const calcularSolvencias = (reps: Representante[], _pagos: RegistroPago[], niveles: NivelConfig[]) => {
    const resultados: DeudaCalculada[] = reps.map(rep => {
      let deudaEsperada = 0;
      
      // Calcular deuda total esperada según alumnos inscritos
      rep.alumnos.forEach(alu => {
        const configNivel = niveles.find(n => n.nivel === alu.nivel);
        const precio = configNivel ? configNivel.precio : (MENSUALIDADES[alu.nivel] || 0);
        deudaEsperada += precio; 
      });

      // Sumar pagos verificados
      const totalPagado = _pagos
        .filter(p => p.cedulaRepresentante === rep.cedula && p.estado === EstadoPago.VERIFICADO)
        .reduce((acc, p) => acc + p.monto, 0);

      const saldoPendiente = Math.max(0, deudaEsperada - totalPagado);

      return {
        cedula: rep.cedula,
        nombre: `${rep.nombres} ${rep.apellidos}`,
        matricula: rep.matricula,
        totalAlumnos: rep.alumnos.length,
        deudaEsperada,
        totalPagado,
        saldoPendiente,
        esMoroso: saldoPendiente > 0
      };
    });

    setSolvencias(resultados);
  };

  // --- Lógica de Filtrado para Reportes ---

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
    } else {
      // Reporte de Solvencia
      return solvencias.filter(s => {
        const cumpleCedula = filtroCedula ? s.cedula.includes(filtroCedula) : true;
        const cumpleEstado = filtroEstadoSolvencia === 'TODOS'
          ? true
          : (filtroEstadoSolvencia === 'MOROSO' ? s.esMoroso : !s.esMoroso);
        return cumpleCedula && cumpleEstado;
      });
    }
  };

  const generarPDF = () => {
    setDownloading(true);
    const doc = new jsPDF();
    const datos = obtenerDatosFiltrados();

    // Encabezado
    doc.setFontSize(18);
    doc.text('Sistema de Gestión Administrativa', 14, 20);
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(tipoReporte === 'TRANSACCIONES' ? 'Reporte de Pagos y Transacciones' : 'Reporte de Solvencia (Representantes)', 14, 28);
    
    doc.setFontSize(10);
    doc.text(`Generado: ${new Date().toLocaleString()}`, 14, 35);
    
    let filtrosTexto = `Filtros: Cédula: ${filtroCedula || 'Todas'}`;
    if (tipoReporte === 'TRANSACCIONES') {
      filtrosTexto += ` | Estado: ${filtroVerificacion} | Desde: ${fechaInicio || '-'} Hasta: ${fechaFin || '-'}`;
    } else {
      filtrosTexto += ` | Condición: ${filtroEstadoSolvencia}`;
    }
    doc.text(filtrosTexto, 14, 42);

    // Tablas
    if (tipoReporte === 'TRANSACCIONES') {
      const data = (datos as RegistroPago[]).map(p => [
        p.fechaRegistro,
        p.cedulaRepresentante,
        p.nombreRepresentante,
        p.metodoPago,
        p.referencia,
        `$${p.monto.toFixed(2)}`,
        p.estado
      ]);

      (doc as any).autoTable({
        startY: 50,
        head: [['Fecha', 'Cédula', 'Representante', 'Método', 'Ref', 'Monto', 'Estado']],
        body: data,
      });

      // Totales
      const total = (datos as RegistroPago[]).reduce((sum, p) => sum + p.monto, 0);
      doc.text(`Total en este reporte: $${total.toFixed(2)}`, 14, (doc as any).lastAutoTable.finalY + 10);

    } else {
      const data = (datos as DeudaCalculada[]).map(s => [
        s.cedula,
        s.nombre,
        s.matricula,
        s.totalAlumnos,
        `$${s.deudaEsperada.toFixed(2)}`,
        `$${s.totalPagado.toFixed(2)}`,
        `$${s.saldoPendiente.toFixed(2)}`,
        s.esMoroso ? 'MOROSO' : 'SOLVENTE'
      ]);

      (doc as any).autoTable({
        startY: 50,
        head: [['Cédula', 'Representante', 'Matrícula', 'Alumnos', 'Deuda Total', 'Pagado', 'Pendiente', 'Estado']],
        body: data,
        styles: { fontSize: 8 },
        columnStyles: {
          7: { fontStyle: 'bold', textColor: (row: any) => row.raw === 'MOROSO' ? [200, 0, 0] : [0, 150, 0] }
        }
      });
      
      const totalDeuda = (datos as DeudaCalculada[]).reduce((sum, s) => sum + s.saldoPendiente, 0);
      doc.text(`Total Saldo Pendiente (Deuda) en reporte: $${totalDeuda.toFixed(2)}`, 14, (doc as any).lastAutoTable.finalY + 10);
    }

    doc.save(`reporte_${tipoReporte.toLowerCase()}_${new Date().getTime()}.pdf`);
    setDownloading(false);
  };

  const generarResumenIA = async () => {
    if (!hasApiKey) return;
    setLoading(true);
    try {
      const resumenDatos = {
        totalEstudiantes: representantes.reduce((acc, r) => acc + r.alumnos.length, 0),
        totalPagadoVerificado: pagos.filter(p => p.estado === EstadoPago.VERIFICADO).reduce((acc, p) => acc + p.monto, 0),
        morosos: solvencias.filter(s => s.esMoroso).length,
        solventes: solvencias.filter(s => !s.esMoroso).length,
        deudaTotal: solvencias.reduce((acc, s) => acc + s.saldoPendiente, 0)
      };

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Analiza estos datos financieros escolares y da un resumen ejecutivo breve (3 items): ${JSON.stringify(resumenDatos)}`,
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
        </div>

        {/* Controles de Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 bg-gray-50 p-4 rounded-lg">
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

          {tipoReporte === 'TRANSACCIONES' && (
            <>
               <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Desde Fecha</label>
                <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className="w-full border border-gray-300 rounded-md p-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Hasta Fecha</label>
                <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} className="w-full border border-gray-300 rounded-md p-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Verificación</label>
                <select value={filtroVerificacion} onChange={(e) => setFiltroVerificacion(e.target.value)} className="w-full border border-gray-300 rounded-md p-2 text-sm">
                  <option value="TODOS">Todos</option>
                  <option value="PENDIENTE">Pendientes</option>
                  <option value="VERIFICADO">Verificados</option>
                </select>
              </div>
            </>
          )}

          {tipoReporte === 'SOLVENCIA' && (
             <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Estado Financiero</label>
                <select value={filtroEstadoSolvencia} onChange={(e) => setFiltroEstadoSolvencia(e.target.value)} className="w-full border border-gray-300 rounded-md p-2 text-sm">
                  <option value="TODOS">Todos</option>
                  <option value="MOROSO">Morosos (Con Deuda)</option>
                  <option value="SOLVENTE">Solventes (Al día)</option>
                </select>
              </div>
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

      {/* Previsualización Rápida (Estilo Tabla Simple) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
            <h3 className="font-bold text-gray-700">Previsualización de Datos ({obtenerDatosFiltrados().length} registros)</h3>
        </div>
        <div className="overflow-x-auto max-h-96">
            <table className="w-full text-sm text-left text-gray-500">
                <thead className="text-xs text-gray-700 uppercase bg-gray-100 sticky top-0">
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
                        <tr key={idx} className="bg-white border-b hover:bg-gray-50">
                             {tipoReporte === 'TRANSACCIONES' ? (
                                <>
                                    <td className="px-6 py-4">{item.fechaRegistro}</td>
                                    <td className="px-6 py-4 text-xs">{item.cedulaRepresentante}</td>
                                    <td className="px-6 py-4">{item.nombreRepresentante}</td>
                                    <td className="px-6 py-4 text-right font-mono">${item.monto}</td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`px-2 py-1 rounded text-[10px] ${item.estado === EstadoPago.VERIFICADO ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                            {item.estado}
                                        </span>
                                    </td>
                                </>
                            ) : (
                                <>
                                    <td className="px-6 py-4 text-xs">{item.cedula}</td>
                                    <td className="px-6 py-4">{item.nombre}</td>
                                    <td className="px-6 py-4 text-right font-mono text-gray-400">${item.deudaEsperada}</td>
                                    <td className="px-6 py-4 text-right font-mono text-green-600">${item.totalPagado}</td>
                                    <td className="px-6 py-4 text-right font-mono font-bold text-slate-800">${item.saldoPendiente}</td>
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
                    ))}
                </tbody>
            </table>
        </div>
      </div>

      {/* Sección IA */}
      {hasApiKey && (
        <div className="bg-indigo-50 p-6 rounded-xl border border-indigo-100 mt-6">
            <h3 className="font-bold text-indigo-900 flex items-center gap-2 mb-2"><Bot size={20}/> Análisis IA</h3>
            <p className="text-sm text-indigo-700 mb-4">Genera un resumen ejecutivo basado en la solvencia actual.</p>
            {aiSummary && <p className="bg-white p-4 rounded text-sm text-gray-700 mb-4 whitespace-pre-wrap">{aiSummary}</p>}
            <button onClick={generarResumenIA} disabled={loading} className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 text-sm">
                {loading ? 'Analizando...' : 'Generar Análisis'}
            </button>
        </div>
      )}
    </div>
  );
};