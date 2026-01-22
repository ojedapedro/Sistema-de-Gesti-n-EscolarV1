
import React, { useEffect, useState } from 'react';
import { db } from '../services/db';
import { Users, AlertCircle, Banknote, TrendingUp, Loader2, Calendar, PieChart, DollarSign, Wallet, TrendingDown, Bot, Sparkles } from 'lucide-react';
import { EstadoPago, RegistroPago, Representante, NivelConfig } from '../types';
import { MENSUALIDADES } from '../constants';
import { GoogleGenAI } from "@google/genai";

export const Dashboard: React.FC = () => {
  const [pagos, setPagos] = useState<RegistroPago[]>([]);
  const [reps, setReps] = useState<Representante[]>([]);
  const [niveles, setNiveles] = useState<NivelConfig[]>([]);
  const [tasa, setTasa] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // Estado para IA
  const [aiSummary, setAiSummary] = useState('');
  const [generatingAI, setGeneratingAI] = useState(false);
  const hasApiKey = !!process.env.API_KEY;

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const [pData, rData, cData, nData] = await Promise.all([
          db.getPagos(),
          db.getRepresentantes(),
          db.getConfig(),
          db.getNiveles()
        ]);
        setPagos(pData);
        setReps(rData);
        setTasa(cData.tasaCambio);
        setNiveles(nData);
      } catch (e) {
        console.error("Error cargando dashboard", e);
      } finally {
        setLoading(false);
      }
    };
    cargarDatos();
  }, []);

  if (loading) return <div className="flex justify-center items-center h-[50vh]"><Loader2 className="animate-spin text-indigo-600" size={48} /></div>;

  // --- Helper Meses Escolares ---
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

  // --- Cálculos Generales ---
  const totalRecaudadoHistorico = pagos
    .filter(p => p.estado === EstadoPago.VERIFICADO)
    .reduce((sum, p) => sum + (p.monto || 0), 0);

  const pagosPendientes = pagos.filter(p => p.estado === EstadoPago.PENDIENTE_VERIFICACION).length;
  const totalAlumnos = reps.reduce((sum, r) => sum + r.alumnos.length, 0);

  // --- Cálculo de Morosidad (Deuda Pendiente Global) ---
  const mesesTranscurridos = getMesesEscolares();
  let totalMorosidad = 0;

  reps.forEach(rep => {
      // 1. Calcular lo que debería haber pagado este representante hasta hoy
      let deudaEsperadaRep = 0;
      rep.alumnos.forEach(alu => {
          const config = niveles.find(n => n.nivel === alu.nivel);
          const precio = config ? config.precio : (MENSUALIDADES[alu.nivel] || 0);
          deudaEsperadaRep += precio * mesesTranscurridos;
      });

      // 2. Calcular lo que ha pagado realmente
      const totalPagadoRep = pagos
        .filter(p => p.cedulaRepresentante === rep.cedula && p.estado === EstadoPago.VERIFICADO)
        .reduce((sum, p) => sum + (p.monto || 0), 0);

      // 3. Calcular saldo. Si es positivo (debe), se suma a la morosidad global.
      // Si es negativo (saldo a favor), NO resta la morosidad de otros.
      const saldo = deudaEsperadaRep - totalPagadoRep;
      if (saldo > 0) {
          totalMorosidad += saldo;
      }
  });

  // Cálculo en Bolívares
  const totalMorosidadBs = totalMorosidad * (tasa || 0);


  // --- Cálculos Mes Actual ---
  const fechaActual = new Date();
  const mesActualIdx = fechaActual.getMonth(); // 0-11
  const anioActual = fechaActual.getFullYear();
  const nombreMes = fechaActual.toLocaleString('es-ES', { month: 'long' });

  // Filtrar pagos verificados de ESTE mes y ESTE año
  const pagosDelMes = pagos.filter(p => {
    if (p.estado !== EstadoPago.VERIFICADO) return false;
    const parts = (p.fechaRegistro || '').split('-');
    const year = parseInt(parts[0] || '0', 10);
    const month = parseInt(parts[1] || '0', 10) - 1; // 0-based
    return year === anioActual && month === mesActualIdx;
  });

  const totalMesUSD = pagosDelMes.reduce((acc, p) => acc + (p.monto || 0), 0);
  const totalMesBs = pagosDelMes.reduce((acc, p) => acc + (p.montoBolivares || 0), 0);

  // Datos para Gráfico Simple (Por Método de Pago en USD)
  const metodosData = pagosDelMes.reduce((acc: Record<string, number>, p) => {
    const key = String(p.metodoPago);
    const current = acc[key] || 0;
    acc[key] = current + (p.monto || 0);
    return acc;
  }, {} as Record<string, number>);

  const values = Object.values(metodosData) as number[];
  const maxValChart = values.length > 0 ? Math.max(...values, 1) : 1;
  const metodosOrdenados = Object.entries(metodosData).sort((a,b) => b[1] - a[1]);

  // --- Función Análisis IA ---
  const generarAnalisisIA = async () => {
    if (!process.env.API_KEY) return;
    setGeneratingAI(true);
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        const prompt = `
            Actúa como un experto analista financiero para un colegio. 
            Analiza los siguientes datos del mes actual (${nombreMes} ${anioActual}):
            
            - Ingresos Totales del Mes: $${totalMesUSD.toFixed(2)}
            - Total Transacciones Verificadas: ${pagosDelMes.length}
            - Método de Pago más usado: ${metodosOrdenados.length > 0 ? metodosOrdenados[0][0] : 'Ninguno'}
            - Morosidad Global Acumulada (Deuda de padres): $${totalMorosidad.toFixed(2)}
            - Pagos Pendientes por Verificar (Cola de trabajo): ${pagosPendientes}
            
            Instrucciones:
            1. Genera un resumen ejecutivo breve (máximo 40 palabras) sobre el desempeño del mes.
            2. Da una recomendación financiera corta y accionable.
            3. Usa un tono profesional pero directo.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt
        });
        setAiSummary(response.text || "No se pudo generar el análisis.");
    } catch (e) {
        console.error(e);
        setAiSummary("Error conectando con el servicio de IA.");
    } finally {
        setGeneratingAI(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4">
        <h2 className="text-2xl font-bold text-slate-800">Panel de Control</h2>
        <div className="bg-white px-4 py-2 rounded-lg shadow-sm border border-indigo-100 flex items-center gap-2">
            <TrendingUp size={18} className="text-indigo-600"/>
            <span className="text-sm font-medium text-gray-600">Tasa BCV:</span>
            <span className="text-lg font-bold text-slate-800">Bs. {(tasa || 0).toFixed(2)}</span>
        </div>
      </div>

      {/* Tarjetas Principales (KPIs Globales) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4 transition-shadow hover:shadow-md">
            <div className="p-4 bg-green-100 rounded-full text-green-600">
                <Banknote size={32} />
            </div>
            <div>
                <p className="text-sm text-gray-500 font-medium">Recaudado Histórico</p>
                <h3 className="text-2xl font-bold text-slate-800">${(totalRecaudadoHistorico || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</h3>
                <p className="text-xs text-green-600 font-medium mt-1">Total acumulado</p>
            </div>
        </div>

        {/* NUEVA TARJETA: Morosidad */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-red-100 flex items-center gap-4 transition-shadow hover:shadow-md">
            <div className="p-4 bg-red-100 rounded-full text-red-600">
                <TrendingDown size={32} />
            </div>
            <div>
                <p className="text-sm text-gray-500 font-medium">Morosidad Pendiente</p>
                <h3 className="text-2xl font-bold text-red-600">${(totalMorosidad || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</h3>
                <p className="text-sm font-semibold text-red-500">~ Bs. {(totalMorosidadBs || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</p>
                <p className="text-xs text-gray-400 mt-1">Deuda por cobrar</p>
            </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4 transition-shadow hover:shadow-md">
            <div className="p-4 bg-yellow-100 rounded-full text-yellow-600">
                <AlertCircle size={32} />
            </div>
            <div>
                <p className="text-sm text-gray-500 font-medium">Pagos Pendientes</p>
                <h3 className="text-2xl font-bold text-slate-800">{pagosPendientes}</h3>
                <p className="text-xs text-gray-400 mt-1">Requieren verificación</p>
            </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4 transition-shadow hover:shadow-md">
            <div className="p-4 bg-indigo-100 rounded-full text-indigo-600">
                <Users size={32} />
            </div>
            <div>
                <p className="text-sm text-gray-500 font-medium">Estudiantes Activos</p>
                <h3 className="text-2xl font-bold text-slate-800">{totalAlumnos}</h3>
                <p className="text-xs text-gray-400 mt-1">{reps.length} Familias registradas</p>
            </div>
        </div>
      </div>
      
      {/* TARJETA IA: Análisis Financiero */}
      {hasApiKey && (
        <div className="bg-gradient-to-r from-indigo-50 to-white p-6 rounded-xl border border-indigo-200 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5">
                <Bot size={120} />
            </div>
            <div className="flex flex-col md:flex-row gap-6 relative z-10">
                <div className="flex-shrink-0 flex items-start">
                    <div className="bg-indigo-600 p-3 rounded-lg text-white shadow-lg">
                        <Sparkles size={24} />
                    </div>
                </div>
                <div className="flex-1">
                    <h3 className="text-lg font-bold text-indigo-900 mb-2">Análisis Financiero Inteligente (Mes Actual)</h3>
                    
                    {!aiSummary && !generatingAI && (
                        <p className="text-indigo-700/70 text-sm mb-4">
                            Utilice la inteligencia artificial para analizar el rendimiento de la recaudación de {nombreMes}, tendencias de pago y niveles de morosidad.
                        </p>
                    )}

                    {generatingAI && (
                        <div className="flex items-center gap-2 text-indigo-600 text-sm py-2">
                            <Loader2 className="animate-spin" size={16} /> Analizando transacciones y tendencias...
                        </div>
                    )}

                    {aiSummary && (
                        <div className="bg-white/60 p-4 rounded-lg border border-indigo-100 text-sm text-slate-700 leading-relaxed mb-4 animate-in fade-in">
                            <p className="whitespace-pre-wrap">{aiSummary}</p>
                        </div>
                    )}

                    <button 
                        onClick={generarAnalisisIA}
                        disabled={generatingAI}
                        className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm flex items-center gap-2"
                    >
                        {generatingAI ? 'Procesando...' : (aiSummary ? 'Regenerar Análisis' : 'Generar Análisis con IA')}
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* SECCIÓN: Resumen del Mes Actual */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tarjeta de Totales del Mes */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-bold text-slate-700 flex items-center gap-2 mb-6 border-b pb-2">
            <Calendar className="text-indigo-600" size={20} /> 
            Resumen Financiero: <span className="capitalize">{nombreMes} {anioActual}</span>
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
             {/* Total USD */}
             <div className="bg-green-50 rounded-xl p-4 border border-green-100 relative overflow-hidden">
                <div className="absolute right-0 top-0 p-4 opacity-10">
                   <DollarSign size={64} className="text-green-800" />
                </div>
                <p className="text-sm font-bold text-green-700 uppercase tracking-wide">Total USD ($)</p>
                <h4 className="text-3xl font-extrabold text-green-800 mt-2">
                  ${totalMesUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </h4>
                <div className="mt-3 w-full bg-green-200 rounded-full h-1.5">
                  <div className="bg-green-600 h-1.5 rounded-full" style={{ width: '100%' }}></div>
                </div>
             </div>

             {/* Total BS */}
             <div className="bg-blue-50 rounded-xl p-4 border border-blue-100 relative overflow-hidden">
                <div className="absolute right-0 top-0 p-4 opacity-10">
                   <Wallet size={64} className="text-blue-800" />
                </div>
                <p className="text-sm font-bold text-blue-700 uppercase tracking-wide">Total Bolívares</p>
                <h4 className="text-2xl font-extrabold text-blue-800 mt-2 truncate" title={totalMesBs.toFixed(2)}>
                  Bs. {totalMesBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                </h4>
                <div className="mt-3 w-full bg-blue-200 rounded-full h-1.5">
                  <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: '100%' }}></div>
                </div>
             </div>
          </div>
        </div>

        {/* Gráfico Simple: Distribución por Método */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-bold text-slate-700 flex items-center gap-2 mb-4 border-b pb-2">
            <PieChart className="text-indigo-600" size={20} /> 
            Ingresos por Método (Este Mes)
          </h3>
          
          <div className="space-y-4">
             {metodosOrdenados.length === 0 ? (
               <div className="text-center text-gray-400 py-8">No hay registros este mes.</div>
             ) : (
               metodosOrdenados.map(([metodo, monto]) => {
                 const montoNum = Number(monto);
                 const porcentaje = Math.round((montoNum / totalMesUSD) * 100);
                 const anchoBarra = Math.round((montoNum / maxValChart) * 100); // Relativo al mayor para la barra
                 return (
                   <div key={metodo}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium text-gray-700">{metodo}</span>
                        <span className="font-bold text-gray-900">${montoNum.toLocaleString()} ({porcentaje}%)</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2.5">
                        <div 
                          className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500 ease-out" 
                          style={{ width: `${anchoBarra}%` }}
                        ></div>
                      </div>
                   </div>
                 );
               })
             )}
          </div>
        </div>
      </div>

      {/* Tabla Últimos Movimientos */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
         <div className="p-6 border-b border-gray-100 bg-gray-50">
            <h3 className="font-bold text-gray-700 flex items-center gap-2"><Calendar size={20}/> Últimos Movimientos</h3>
         </div>
         <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-500">
                <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                    <tr>
                        <th className="px-6 py-3">Fecha</th>
                        <th className="px-6 py-3">Representante</th>
                        <th className="px-6 py-3">Método</th>
                        <th className="px-6 py-3">Ref</th>
                        <th className="px-6 py-3 text-right">Monto</th>
                        <th className="px-6 py-3 text-center">Estado</th>
                    </tr>
                </thead>
                <tbody>
                    {pagos.slice(-10).reverse().map((p, i) => (
                        <tr key={i} className="bg-white border-b hover:bg-gray-50">
                            <td className="px-6 py-4">{p.fechaRegistro}</td>
                            <td className="px-6 py-4 font-medium text-gray-900">{p.nombreRepresentante}</td>
                            <td className="px-6 py-4">{p.metodoPago}</td>
                            <td className="px-6 py-4 font-mono text-xs">{p.referencia}</td>
                            <td className="px-6 py-4 text-right font-bold">${(p.monto || 0).toFixed(2)}</td>
                            <td className="px-6 py-4 text-center">
                                <span className={`px-2 py-1 rounded-full text-xs ${
                                    p.estado === EstadoPago.VERIFICADO 
                                    ? 'bg-green-100 text-green-800' 
                                    : p.estado === EstadoPago.RECHAZADO
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                    {p.estado}
                                </span>
                            </td>
                        </tr>
                    ))}
                    {pagos.length === 0 && (
                        <tr><td colSpan={6} className="px-6 py-8 text-center">No hay registros aún.</td></tr>
                    )}
                </tbody>
            </table>
         </div>
      </div>
    </div>
  );
};
