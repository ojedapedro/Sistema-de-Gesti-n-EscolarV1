import React, { useEffect, useState } from 'react';
import { db } from '../services/db';
import { Users, AlertCircle, Banknote, TrendingUp, Loader2, Calendar } from 'lucide-react';
import { EstadoPago, RegistroPago, Representante } from '../types';

export const Dashboard: React.FC = () => {
  const [pagos, setPagos] = useState<RegistroPago[]>([]);
  const [reps, setReps] = useState<Representante[]>([]);
  const [tasa, setTasa] = useState(0);
  const [loading, setLoading] = useState(true);

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
      } catch (e) {
        console.error("Error cargando dashboard", e);
      } finally {
        setLoading(false);
      }
    };
    cargarDatos();
  }, []);

  if (loading) return <div className="flex justify-center items-center h-[50vh]"><Loader2 className="animate-spin text-indigo-600" size={48} /></div>;

  const totalRecaudado = pagos
    .filter(p => p.estado === EstadoPago.VERIFICADO)
    .reduce((sum, p) => sum + p.monto, 0);

  const pagosPendientes = pagos.filter(p => p.estado === EstadoPago.PENDIENTE_VERIFICACION).length;
  const totalAlumnos = reps.reduce((sum, r) => sum + r.alumnos.length, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4">
        <h2 className="text-2xl font-bold text-slate-800">Panel de Control</h2>
        <div className="bg-white px-4 py-2 rounded-lg shadow-sm border border-indigo-100 flex items-center gap-2">
            <TrendingUp size={18} className="text-indigo-600"/>
            <span className="text-sm font-medium text-gray-600">Tasa BCV:</span>
            <span className="text-lg font-bold text-slate-800">Bs. {tasa.toFixed(2)}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4 transition-shadow hover:shadow-md">
            <div className="p-4 bg-green-100 rounded-full text-green-600">
                <Banknote size={32} />
            </div>
            <div>
                <p className="text-sm text-gray-500 font-medium">Total Recaudado</p>
                <h3 className="text-2xl font-bold text-slate-800">${totalRecaudado.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h3>
                <p className="text-xs text-green-600 font-medium mt-1">Ingresos verificados</p>
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
                            <td className="px-6 py-4 text-right font-bold">${p.monto.toFixed(2)}</td>
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