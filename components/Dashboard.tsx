import React, { useEffect, useState } from 'react';
import { db } from '../services/db';
import { Users, AlertCircle, Banknote, TrendingUp, Loader2 } from 'lucide-react';
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

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-indigo-600" size={48} /></div>;

  const totalRecaudado = pagos
    .filter(p => p.estado === EstadoPago.VERIFICADO)
    .reduce((sum, p) => sum + p.monto, 0);

  const pagosPendientes = pagos.filter(p => p.estado === EstadoPago.PENDIENTE_VERIFICACION).length;
  const totalAlumnos = reps.reduce((sum, r) => sum + r.alumnos.length, 0);

  const stats = [
    { label: 'Tasa de Cambio', value: `Bs. ${tasa.toFixed(2)}`, icon: TrendingUp, color: 'text-indigo-600', bg: 'bg-indigo-100' },
    { label: 'Total Alumnos', value: totalAlumnos, icon: Users, color: 'text-blue-600', bg: 'bg-blue-100' },
    { label: 'Recaudado (Total)', value: `$${totalRecaudado.toFixed(2)}`, icon: Banknote, color: 'text-green-600', bg: 'bg-green-100' },
    { label: 'Por Verificar', value: pagosPendientes, icon: AlertCircle, color: 'text-yellow-600', bg: 'bg-yellow-100' },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6 text-slate-800">Panel Principal</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={i} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
              <div className={`p-3 rounded-full ${stat.bg} ${stat.color}`}>
                <Icon size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="font-bold text-lg mb-4">Últimos Pagos Registrados</h3>
          <div className="overflow-hidden">
             {pagos.slice(-5).reverse().map((p, i) => (
               <div key={i} className="flex justify-between items-center py-3 border-b last:border-0">
                 <div>
                   <p className="font-medium text-slate-800">{p.nombreRepresentante}</p>
                   <p className="text-xs text-slate-500">{p.metodoPago} - {p.fechaRegistro}</p>
                 </div>
                 <div className="text-right">
                   <p className="font-bold text-slate-700">${p.monto.toFixed(2)}</p>
                   {p.montoBolivares && (
                     <p className="text-[10px] text-gray-400">Bs. {p.montoBolivares.toFixed(2)}</p>
                   )}
                   <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                     p.estado === EstadoPago.VERIFICADO ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                   }`}>{p.estado}</span>
                 </div>
               </div>
             ))}
             {pagos.length === 0 && <p className="text-gray-400 text-sm">No hay pagos recientes.</p>}
          </div>
        </div>

        <div className="bg-indigo-900 text-white p-6 rounded-xl shadow-md relative overflow-hidden">
          <div className="flex justify-between items-start z-10 relative">
            <div>
              <h3 className="font-bold text-lg mb-4">Información del Sistema</h3>
              <p className="mb-2 text-indigo-200 text-sm">Base de Datos: <span className="text-white font-mono">Google Sheets (En Vivo)</span></p>
              <p className="mb-2 text-indigo-200 text-sm">ID Hoja: <span className="text-white font-mono text-xs">...13pCWr4...</span></p>
            </div>
            <img 
              src="https://i.ibb.co/FbHJbvVT/images.png" 
              alt="Logo" 
              className="h-16 w-16 bg-white rounded-full p-1 object-contain opacity-90"
            />
          </div>
          <div className="mt-6 p-4 bg-indigo-800 rounded-lg relative z-10">
            <p className="text-xs text-indigo-300 mb-1">Estado de Conexión:</p>
            <p className="text-sm">
              Conectado vía Google Apps Script API. Los registros de la "Oficina Virtual" se sincronizan automáticamente.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};