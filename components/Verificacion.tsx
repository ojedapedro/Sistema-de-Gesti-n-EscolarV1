import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { RegistroPago, EstadoPago } from '../types';
import { Check, X, AlertTriangle, RefreshCw, Search, Monitor, Loader2 } from 'lucide-react';

export const Verificacion: React.FC = () => {
  const [pagos, setPagos] = useState<RegistroPago[]>([]);
  const [activeTab, setActiveTab] = useState<'PENDIENTE' | 'RECHAZADO'>('PENDIENTE');
  const [filtroRef, setFiltroRef] = useState('');
  const [loading, setLoading] = useState(true);

  const cargarPagos = async () => {
    setLoading(true);
    try {
      const todos = await db.getPagos();
      
      const estadoObjetivo = activeTab === 'PENDIENTE' 
        ? EstadoPago.PENDIENTE_VERIFICACION 
        : EstadoPago.RECHAZADO;

      let filtrados = todos.filter(p => p.estado === estadoObjetivo);

      if (filtroRef) {
        filtrados = filtrados.filter(p => 
          p.referencia.toLowerCase().includes(filtroRef.toLowerCase()) ||
          p.cedulaRepresentante.includes(filtroRef)
        );
      }

      filtrados.sort((a, b) => {
        const dateA = new Date(a.timestamp).getTime();
        const dateB = new Date(b.timestamp).getTime();
        return activeTab === 'PENDIENTE' ? dateA - dateB : dateB - dateA;
      });

      setPagos(filtrados);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarPagos();
  }, [activeTab, filtroRef]);

  const procesarPago = async (pago: RegistroPago, accion: 'APROBAR' | 'RECHAZAR' | 'RECUPERAR') => {
    let nuevoEstado: EstadoPago;
    let mensaje = "";

    switch (accion) {
      case 'APROBAR':
        nuevoEstado = EstadoPago.VERIFICADO;
        mensaje = `¿Está seguro de APROBAR este pago?\n\n👤 Representante: ${pago.nombreRepresentante}\n🧾 Referencia: ${pago.referencia}\n💰 Monto: $${(pago.monto || 0).toFixed(2)}\n\nEl pago será registrado en el Libro Contable.`;
        break;
      case 'RECHAZAR':
        nuevoEstado = EstadoPago.RECHAZADO;
        mensaje = `¿Está seguro de RECHAZAR este pago?\n\n👤 Representante: ${pago.nombreRepresentante}\n🧾 Referencia: ${pago.referencia}\n\nEl pago será movido al historial de Rechazados.`;
        break;
      case 'RECUPERAR': 
        nuevoEstado = EstadoPago.VERIFICADO;
        mensaje = `¿Está seguro de RECUPERAR y APROBAR este pago?\n\n👤 Representante: ${pago.nombreRepresentante}\n🧾 Referencia: ${pago.referencia}\n\nEl pago será marcado como verificado.`;
        break;
      default:
        return;
    }

    if (window.confirm(mensaje)) {
      setLoading(true);
      try {
        await db.updateEstadoPago(pago.id, pago.referencia, pago.cedulaRepresentante, nuevoEstado);
        await cargarPagos();
      } catch (e) {
        alert("Error actualizando estado.");
        setLoading(false);
      }
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Verificación de Transacciones</h2>
          <p className="text-sm text-gray-500">Gestión de pagos electrónicos (Móvil, Transferencias, Zelle)</p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar referencia o cédula..." 
            value={filtroRef}
            onChange={(e) => setFiltroRef(e.target.value)}
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none w-64"
          />
        </div>
      </div>

      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('PENDIENTE')}
          className={`px-6 py-3 font-medium text-sm focus:outline-none border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'PENDIENTE' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500'
          }`}
        >
          <RefreshCw size={16} /> Pendientes
        </button>
        <button
          onClick={() => setActiveTab('RECHAZADO')}
          className={`px-6 py-3 font-medium text-sm focus:outline-none border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'RECHAZADO' ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500'
          }`}
        >
          <AlertTriangle size={16} /> Rechazados
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100 min-h-[300px]">
        {loading ? (
          <div className="flex justify-center items-center h-full py-20">
            <Loader2 className="animate-spin text-indigo-600" size={48} />
          </div>
        ) : pagos.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <p>No hay pagos en esta bandeja.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-500">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3">Fecha</th>
                  <th className="px-6 py-3">Concepto</th>
                  <th className="px-6 py-3">Representante</th>
                  <th className="px-6 py-3">Método / Ref</th>
                  <th className="px-6 py-3 text-right">Monto</th>
                  <th className="px-6 py-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {pagos.map((pago) => (
                  <tr key={pago.id} className="bg-white border-b hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      {pago.fechaRegistro}
                    </td>
                     <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-bold text-gray-700">{pago.mes || 'N/A'}</div>
                      <div className="text-xs text-gray-400">{pago.anio}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{pago.nombreRepresentante}</div>
                      <div className="text-xs text-gray-400">{pago.cedulaRepresentante}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-semibold text-gray-700">{pago.metodoPago}</span>
                      <div className="font-mono text-xs bg-gray-100 inline-block px-2 py-1 rounded mt-1 border">
                        Ref: {pago.referencia}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="font-bold text-gray-900">${(pago.monto || 0).toFixed(2)}</div>
                      {pago.montoBolivares && pago.montoBolivares > 0 && (
                        <div className="text-xs text-gray-500">Bs. {(pago.montoBolivares || 0).toFixed(2)}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center gap-3">
                        {activeTab === 'PENDIENTE' && (
                          <>
                            <button onClick={() => procesarPago(pago, 'APROBAR')} className="p-2 bg-green-50 rounded-full hover:bg-green-100 text-green-600" title="Aprobar Pago"><Check size={20} /></button>
                            <button onClick={() => procesarPago(pago, 'RECHAZAR')} className="p-2 bg-red-50 rounded-full hover:bg-red-100 text-red-600" title="Rechazar Pago"><X size={20} /></button>
                          </>
                        )}
                        {activeTab === 'RECHAZADO' && (
                           <button onClick={() => procesarPago(pago, 'RECUPERAR')} className="flex items-center gap-1 text-xs bg-gray-100 px-2 py-1 rounded border border-gray-300 hover:bg-gray-200">Recuperar</button>
                        )}
                      </div>
                    </td>
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