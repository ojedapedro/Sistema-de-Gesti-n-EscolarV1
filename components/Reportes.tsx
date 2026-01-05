import React, { useState } from 'react';
import { db } from '../services/db';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { Download, Bot, RefreshCw, Loader2 } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';

export const Reportes: React.FC = () => {
  const [filtroCedula, setFiltroCedula] = useState('');
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [aiSummary, setAiSummary] = useState<string>('');
  
  const hasApiKey = !!process.env.API_KEY;

  const generarPDF = async () => {
    setDownloading(true);
    try {
      const doc = new jsPDF();
      
      doc.setFontSize(18);
      doc.text('Reporte Administrativo Escolar', 14, 22);
      doc.setFontSize(11);
      doc.setTextColor(100);
      doc.text(`Fecha de emisión: ${new Date().toLocaleDateString()}`, 14, 30);

      let pagos = await db.getPagos();
      
      if (filtroCedula) {
        pagos = pagos.filter(p => p.cedulaRepresentante.includes(filtroCedula));
        doc.text(`Filtro Cédula: ${filtroCedula}`, 14, 38);
      }

      const tableData = pagos.map(p => [
        p.fechaRegistro,
        p.cedulaRepresentante,
        p.nombreRepresentante,
        p.monto.toFixed(2),
        p.metodoPago,
        p.referencia,
        p.estado
      ]);

      (doc as any).autoTable({
        startY: 45,
        head: [['Fecha', 'Cédula', 'Nombre', 'Monto ($)', 'Método', 'Ref', 'Estado']],
        body: tableData,
      });

      doc.save(`reporte_${new Date().getTime()}.pdf`);
    } catch (e) {
      alert("Error generando reporte");
    } finally {
      setDownloading(false);
    }
  };

  const generarResumenIA = async () => {
    if (!hasApiKey) {
      setAiSummary("API Key de Gemini no configurada.");
      return;
    }

    setLoading(true);
    try {
      const pagos = await db.getPagos();
      const reps = await db.getRepresentantes();
      
      const resumenDatos = {
        totalEstudiantes: reps.reduce((acc, r) => acc + r.alumnos.length, 0),
        totalRecaudado: pagos.filter(p => p.estado === 'Verificado').reduce((acc, p) => acc + p.monto, 0),
        pagosPendientesVerificacion: pagos.filter(p => p.estado === 'Pendiente Verificación').length,
        transaccionesRecientes: pagos.slice(-10).map(p => ({ monto: p.monto, metodo: p.metodoPago, estado: p.estado }))
      };

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Analiza estos datos financieros de un colegio y dame un resumen ejecutivo de 3 párrafos. JSON: ${JSON.stringify(resumenDatos)}`,
      });

      setAiSummary(response.text || "No se pudo generar el resumen.");
    } catch (error) {
      console.error(error);
      setAiSummary("Error conectando con Gemini AI.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-2xl font-bold mb-6 text-slate-800">Generador de Reportes</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Filtrar por Cédula (Opcional)</label>
            <input 
              type="text" 
              value={filtroCedula}
              onChange={(e) => setFiltroCedula(e.target.value)}
              className="w-full border border-gray-300 rounded-md p-2"
              placeholder="V-..."
            />
          </div>
        </div>

        <button 
          onClick={generarPDF}
          disabled={downloading}
          className="bg-slate-800 text-white px-6 py-3 rounded-lg hover:bg-slate-700 flex items-center gap-2 font-medium"
        >
          {downloading ? <Loader2 className="animate-spin" /> : <Download size={20} />}
          {downloading ? 'Generando...' : 'Descargar PDF Detallado'}
        </button>
      </div>

      <div className="bg-indigo-50 p-8 rounded-xl border border-indigo-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Bot size={120} />
        </div>
        <h3 className="text-xl font-bold text-indigo-900 mb-4 flex items-center gap-2">
          <Bot className="text-indigo-600" /> Asistente Financiero AI
        </h3>
        
        {aiSummary ? (
          <div className="bg-white p-6 rounded-lg shadow-sm mb-4 text-slate-700 leading-relaxed whitespace-pre-line">
            {aiSummary}
          </div>
        ) : null}

        <button 
          onClick={generarResumenIA}
          disabled={loading}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg font-medium transition-colors
            ${loading ? 'bg-indigo-300 cursor-not-allowed text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
        >
          {loading ? <RefreshCw className="animate-spin" size={20} /> : <Bot size={20} />}
          {loading ? 'Analizando...' : 'Generar Análisis Financiero'}
        </button>
      </div>
    </div>
  );
};