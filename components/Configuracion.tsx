
import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { Settings, Save, RefreshCw, Loader2, DollarSign, Moon, Sun } from 'lucide-react';
import { SystemConfig, NivelConfig, NivelEducativo } from '../types';
import { useTheme } from '../context/ThemeContext';

export const Configuracion: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const [tasa, setTasa] = useState<string>('');
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [niveles, setNiveles] = useState<NivelConfig[]>([]);
  
  const [mensaje, setMensaje] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [loadingPrecios, setLoadingPrecios] = useState(false);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      const config = await db.getConfig();
      setTasa((config.tasaCambio || 0).toString());
      setLastUpdate(new Date(config.fechaActualizacion).toLocaleString());

      const dataNiveles = await db.getNiveles();
      
      // Asegurarnos de que todos los niveles del Enum estén presentes
      const todosLosNiveles = Object.values(NivelEducativo).map(nombreNivel => {
        const existente = dataNiveles.find(n => n.nivel === nombreNivel);
        return existente || { nivel: nombreNivel, precio: 0 };
      });
      
      setNiveles(todosLosNiveles);

    } catch (e) {
      console.error(e);
      setMensaje({ type: 'error', text: 'Error cargando datos iniciales.' });
    }
  };

  const guardarConfiguracion = async () => {
    const nuevaTasa = parseFloat(tasa);
    if (isNaN(nuevaTasa) || nuevaTasa <= 0) {
      setMensaje({ type: 'error', text: 'Ingrese una tasa de cambio válida mayor a 0.' });
      return;
    }

    setLoadingConfig(true);
    const newConfig: SystemConfig = {
      tasaCambio: nuevaTasa,
      fechaActualizacion: new Date().toISOString()
    };

    try {
      await db.saveConfig(newConfig);
      setLastUpdate(new Date(newConfig.fechaActualizacion).toLocaleString());
      setMensaje({ type: 'success', text: 'Tasa de cambio actualizada correctamente.' });
      setTimeout(() => setMensaje(null), 3000);
    } catch (e) {
      setMensaje({ type: 'error', text: 'Error guardando configuración.' });
    } finally {
      setLoadingConfig(false);
    }
  };

  const handlePrecioChange = (index: number, val: string) => {
    const nuevos = [...niveles];
    nuevos[index].precio = parseFloat(val) || 0;
    setNiveles(nuevos);
  };

  const handlePrecioBsChange = (index: number, valBs: string) => {
    const rate = parseFloat(tasa);
    if (!rate || rate <= 0) return;

    const bs = parseFloat(valBs);
    const nuevos = [...niveles];
    if (!isNaN(bs)) {
      // Calcular USD basado en BS y Tasa
      nuevos[index].precio = parseFloat((bs / rate).toFixed(2));
    } else {
      nuevos[index].precio = 0;
    }
    setNiveles(nuevos);
  };

  const guardarPrecios = async () => {
    setLoadingPrecios(true);
    try {
      await db.saveNiveles(niveles);
      setMensaje({ type: 'success', text: 'Lista de precios actualizada correctamente.' });
      setTimeout(() => setMensaje(null), 3000);
    } catch (e) {
      console.error(e);
      setMensaje({ type: 'error', text: 'Error guardando precios en la base de datos.' });
    } finally {
      setLoadingPrecios(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in">
      <div className="bg-white dark:bg-[#151521] dark:border-gray-800 p-8 rounded-xl shadow-sm border border-gray-100 transition-colors duration-300">
        <h2 className="text-2xl font-bold mb-6 text-slate-800 dark:text-white flex items-center gap-2">
          <Settings className="text-indigo-600" /> Configuración del Sistema
        </h2>

        {mensaje && (
          <div className={`p-4 mb-6 rounded-lg ${mensaje.type === 'success' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'}`}>
            {mensaje.text}
          </div>
        )}

        {/* SECCIÓN DE TEMA */}
        <div className="mb-8 border-b border-gray-200 dark:border-gray-700 pb-8">
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-4 flex items-center gap-2">
             {theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />} Apariencia
          </h3>
          <div className="bg-slate-50 dark:bg-[#1e1e2d] p-6 rounded-lg border border-slate-200 dark:border-gray-700 flex items-center justify-between">
             <div>
                <p className="font-medium text-slate-800 dark:text-white">Tema de la Aplicación</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Cambia entre modo claro y modo oscuro (estilo nocturno).</p>
             </div>
             
             <button 
               onClick={toggleTheme}
               className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none ${theme === 'dark' ? 'bg-indigo-600' : 'bg-gray-300'}`}
             >
               <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${theme === 'dark' ? 'translate-x-7' : 'translate-x-1'}`} />
             </button>
          </div>
        </div>

        <div className="mb-8 border-b border-gray-200 dark:border-gray-700 pb-8">
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-4 flex items-center gap-2">
             <RefreshCw size={20} /> Parámetros Financieros (Tasa del día)
          </h3>
          
          <div className="bg-slate-50 dark:bg-[#1e1e2d] p-6 rounded-lg border border-slate-200 dark:border-gray-700">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tasa de Cambio (Bs / $)</label>
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-xs">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 font-bold">Bs.</span>
                <input 
                  type="number" step="0.01" value={tasa} onChange={(e) => setTasa(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-[#151521] dark:text-white rounded-lg text-lg font-mono outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="0.00"
                />
              </div>
              <button onClick={guardarConfiguracion} disabled={loadingConfig} className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 font-medium flex items-center gap-2 min-w-[120px] justify-center shadow-lg shadow-indigo-600/20">
                {loadingConfig ? <Loader2 className="animate-spin" /> : <Save size={20} />}
                {loadingConfig ? '...' : 'Guardar Tasa'}
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Última actualización: {lastUpdate}</p>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-4 flex items-center gap-2">
             <DollarSign size={20} /> Costos de Mensualidad por Nivel
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Puede editar el precio en Dólares ($) o en Bolívares (Bs). El sistema guardará el valor base en Dólares.
          </p>

          <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-[#1e1e2d]">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nivel Educativo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Precio ($)</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Precio (Bs)</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-[#151521] divide-y divide-gray-200 dark:divide-gray-700">
                {niveles.map((nivel, index) => {
                  const precioBs = ((nivel.precio || 0) * (parseFloat(tasa) || 0)).toFixed(2);
                  return (
                    <tr key={nivel.nivel}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        {nivel.nivel}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="relative rounded-md shadow-sm max-w-[150px]">
                          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <span className="text-gray-500 dark:text-gray-400 sm:text-sm">$</span>
                          </div>
                          <input
                            type="number"
                            value={nivel.precio}
                            onChange={(e) => handlePrecioChange(index, e.target.value)}
                            className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-[#1e1e2d] dark:text-white pl-7 py-1 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border"
                            placeholder="0.00"
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="relative rounded-md shadow-sm max-w-[150px]">
                           <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <span className="text-gray-500 dark:text-gray-400 sm:text-sm font-bold">Bs.</span>
                          </div>
                          <input
                            type="number"
                            value={precioBs}
                            onChange={(e) => handlePrecioBsChange(index, e.target.value)}
                            className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-[#1e1e2d] dark:text-gray-300 pl-9 py-1 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border bg-slate-50"
                            placeholder="0.00"
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          <div className="mt-4 flex justify-end">
            <button 
              onClick={guardarPrecios}
              disabled={loadingPrecios}
              className="bg-slate-800 text-white px-6 py-3 rounded-lg hover:bg-slate-700 font-medium flex items-center gap-2"
            >
              {loadingPrecios ? <Loader2 className="animate-spin" /> : <Save size={20} />}
              {loadingPrecios ? 'Guardando...' : 'Guardar Precios'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
