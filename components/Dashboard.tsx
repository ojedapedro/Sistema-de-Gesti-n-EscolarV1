import React, { useEffect, useState } from 'react';
import { db } from '../services/db';
import { Users, AlertCircle, Banknote, TrendingUp, Loader2, Wallet, CalendarCheck } from 'lucide-react';
import { EstadoPago, RegistroPago, Representante } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

export const Dashboard: React.FC = () => {
  const [pagos, setPagos] = useState<RegistroPago[]>([]);
  const [reps, setReps] = useState<Representante[]>([]);
  const [tasa, setTasa] = useState(0);
  const [loading, setLoading] = useState(true);

  // Datos para gráficos
  const [dataIngresos, setDataIngresos] = useState<any[]>([]);
  const [dataMetodos, setDataMetodos] = useState<any[]>([]);

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const [pData, rData, cData] = await Promise.all([
          db.getPagos(),
          db.getRepresentantes(),
          db.getConfig()
        ]);
        setPagos(pData);
        setReps(rData);
        setTasa(cData.tasaCambio);
        procesarDatosGraficos(pData);
      } catch (e) {
        console.error("Error cargando dashboard", e);
      } finally {
        setLoading(false);
      }
    };
    cargarDatos();
  }, []);

  const procesarDatosGraficos = (pagosData: RegistroPago[]) => {
    // 1. Procesar Ingresos por Fecha (Últimos días con actividad)
    const ingresosMap: Record<string, number> = {};
    
    // Filtrar solo verificados y ordenar cronológicamente
    const pagosVerificados = pagosData.filter(p => p.estado === EstadoPago.VERIFICADO);
    
    pagosVerificados.forEach(p => {
        // Usar fechaRegistro o fechaPago
        const fecha = p.fechaPago || p.fechaRegistro;
        if (fecha) {
            // Formato corto DD/MM
            const dateObj = new Date(fecha);
            const key = `${dateObj.getDate()}/${dateObj.getMonth() + 1}`;
            ingresosMap[key] = (ingresosMap[key] || 0) + p.monto;
        }
    });

    // Convertir a array y tomar los últimos 7 registros
    const arrayIngresos = Object.keys(ingresosMap).map(key => ({
        fecha: key,
        monto: ingresosMap[key]
    })).slice(-7);

    setDataIngresos(arrayIngresos);

    // 2. Procesar Métodos de Pago
    const metodosMap: Record<string, number> = {};
    pagosData.forEach(p => {
        metodosMap[p.metodoPago] = (metodosMap[p.metodoPago] || 0) + 1;
    });

    const arrayMetodos = Object.keys(metodosMap).map(key => ({
        name: key,
        value: metodosMap[key]
    }));

    setDataMetodos(arrayMetodos);
  };

  if (loading) return <div className="flex justify-center items-center h-[50vh]"><Loader2 className="animate-spin text-indigo-600" size={48} /></div>;

  // Cálculos de KPI
  const totalRecaudado = pagos
    .filter(p => p.estado === EstadoPago.VERIFICADO)
    .reduce((sum, p) => sum + p.monto, 0);

  const pagosPendientes = pagos.filter(p => p.estado === EstadoPago.PENDIENTE_VERIFICACION).length;
  const totalAlumnos = reps.reduce((sum, r) => sum + r.alumnos.length, 0);
  
  // Colores para Gráficos
  const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
        <div>
           <h2 className="text-2xl font-bold text-slate-800">Panel de Control</h2>
           <p className="text-gray-500 text-sm">Resumen financiero y académico en tiempo real.</p>
        </div>
        <div className="bg-white px-4 py-2 rounded-lg shadow-sm border border-indigo-100 flex items-center gap-2">
            <TrendingUp size={18} className="text-indigo-600"/>
            <span className="text-sm font-medium text-gray-600">Tasa BCV:</span>
            <span className="text-lg font-bold text-slate-800">Bs. {tasa.toFixed(2)}</span>
        </div>
      </div>
      
      {/* KPIs Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 p-6 rounded-2xl shadow-lg text-white relative overflow-hidden">
            <div className="relative z-10">
                <p className="text-indigo-100 font-medium text-sm mb-1">Total Recaudado (Histórico)</p>
                <h3 className="text-3xl font-bold">${totalRecaudado.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h3>
                <p className="text-xs text-indigo-200 mt-2">Pagos verificados</p>
            </div>
            <Banknote className="absolute right-[-10px] bottom-[-10px] text-white opacity-20" size={100} />
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative group hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-gray-500 font-medium text-sm mb-1">Pagos Pendientes</p>
                    <h3 className="text-3xl font-bold text-slate-800">{pagosPendientes}</h3>
                </div>
                <div className="p-3 bg-yellow-100 rounded-xl text-yellow-600 group-hover:scale-110 transition-transform">
                    <AlertCircle size={24} />
                </div>
            </div>
            <p className="text-xs text-yellow-600 mt-4 font-medium flex items-center gap-1">
                {pagosPendientes > 0 ? 'Requieren verificación' : 'Todo al día'}
            </p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative group hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-gray-500 font-medium text-sm mb-1">Matrícula Total</p>
                    <h3 className="text-3xl font-bold text-slate-800">{totalAlumnos}</h3>
                </div>
                <div className="p-3 bg-blue-100 rounded-xl text-blue-600 group-hover:scale-110 transition-transform">
                    <Users size={24} />
                </div>
            </div>
            <p className="text-xs text-blue-600 mt-4 font-medium">Alumnos activos</p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative group hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-gray-500 font-medium text-sm mb-1">Familias (Reps)</p>
                    <h3 className="text-3xl font-bold text-slate-800">{reps.length}</h3>
                </div>
                <div className="p-3 bg-purple-100 rounded-xl text-purple-600 group-hover:scale-110 transition-transform">
                    <Wallet size={24} />
                </div>
            </div>
            <p className="text-xs text-purple-600 mt-4 font-medium">Representantes registrados</p>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico de Barras: Ingresos */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 lg:col-span-2">
            <h3 className="font-bold text-lg text-slate-800 mb-6 flex items-center gap-2">
                <TrendingUp size={20} className="text-indigo-600"/> Tendencia de Ingresos (Verificados)
            </h3>
            <div className="h-[300px] w-full">
                {dataIngresos.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dataIngresos}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                            <XAxis dataKey="fecha" axisLine={false} tickLine={false} tick={{fill: '#64748B'}} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748B'}} tickFormatter={(val) => `$${val}`}/>
                            <Tooltip 
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                cursor={{fill: '#F1F5F9'}}
                            />
                            <Bar dataKey="monto" fill="#4F46E5" radius={[4, 4, 0, 0]} barSize={40} />
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-full flex items-center justify-center text-gray-400">
                        No hay suficientes datos recientes
                    </div>
                )}
            </div>
        </div>

        {/* Gráfico Circular: Métodos de Pago */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-lg text-slate-800 mb-6 flex items-center gap-2">
                <Wallet size={20} className="text-indigo-600"/> Métodos de Pago
            </h3>
            <div className="h-[300px] w-full relative">
                {dataMetodos.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={dataMetodos}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {dataMetodos.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip />
                            <Legend verticalAlign="bottom" height={36}/>
                        </PieChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-full flex items-center justify-center text-gray-400">
                        Sin datos
                    </div>
                )}
            </div>
        </div>
      </div>

      {/* Lista de Transacciones Recientes */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
         <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
            <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                <CalendarCheck size={20} className="text-indigo-600"/> Últimas Transacciones
            </h3>
         </div>
         <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-500 uppercase bg-gray-50/50">
                    <tr>
                        <th className="px-6 py-4">Representante</th>
                        <th className="px-6 py-4">Método</th>
                        <th className="px-6 py-4 text-right">Monto</th>
                        <th className="px-6 py-4 text-center">Estado</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {pagos.slice(-5).reverse().map((p, i) => (
                        <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-6 py-4 font-medium text-slate-700">
                                {p.nombreRepresentante}
                                <div className="text-xs text-gray-400 font-normal">{p.fechaRegistro}</div>
                            </td>
                            <td className="px-6 py-4 text-gray-500">
                                {p.metodoPago}
                            </td>
                            <td className="px-6 py-4 text-right">
                                <span className="font-bold text-slate-700">${p.monto.toFixed(2)}</span>
                                {p.montoBolivares && (
                                    <div className="text-xs text-gray-400">Bs. {p.montoBolivares.toFixed(2)}</div>
                                )}
                            </td>
                            <td className="px-6 py-4 text-center">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
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
                        <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-400">No hay movimientos recientes.</td></tr>
                    )}
                </tbody>
            </table>
         </div>
      </div>
    </div>
  );
};