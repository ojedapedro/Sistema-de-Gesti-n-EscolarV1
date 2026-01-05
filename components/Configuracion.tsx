import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { Settings, Save, RefreshCw, Loader2 } from 'lucide-react';
import { SystemConfig } from '../types';

export const Configuracion: React.FC = () => {
  const [tasa, setTasa] = useState<string>('');
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [mensaje, setMensaje] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    db.getConfig().then(config => {
      setTasa(config.tasaCambio.toString());
      setLastUpdate(new Date(config.fechaActualizacion).toLocaleString());
    });
  }, []);

  const guardarConfiguracion = async () => {
    const nuevaTasa = parseFloat(tasa);
    if (isNaN(nuevaTasa) || nuevaTasa <= 0) {
      setMensaje({ type: 'error', text: 'Ingrese una tasa de cambio válida mayor a 0.' });
      return;
    }

    setLoading(true);
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
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-2xl font-bold mb-6 text-slate-800 flex items-center gap-2">
          <Settings className="text-indigo-600" /> Configuración del Sistema
        </h2>

        {mensaje && (
          <div className={`p-4 mb-6 rounded-lg ${mensaje.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {mensaje.text}
          </div>
        )}

        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-700 mb-4 border-b pb-2">Parámetros Financieros</h3>
          
          <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
            <label className="block text-sm font-medium text-gray-700 mb-2">Tasa de Cambio (Bs / $)</label>
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 font-bold">Bs.</span>
                <input 
                  type="number" step="0.01" value={tasa} onChange={(e) => setTasa(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg text-lg font-mono"
                  placeholder="0.00"
                />
              </div>
              <button onClick={guardarConfiguracion} disabled={loading} className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 font-medium flex items-center gap-2 min-w-[120px] justify-center">
                {loading ? <Loader2 className="animate-spin" /> : <Save size={20} />}
                {loading ? '...' : 'Guardar'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
              <RefreshCw size={12} /> Última actualización: {lastUpdate}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};