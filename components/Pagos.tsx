import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { Representante, MetodoPago, EstadoPago, RegistroPago } from '../types';
import { REQUIERE_VERIFICACION } from '../constants';
import { Search, DollarSign, CheckCircle, Calculator, RefreshCw, Loader2 } from 'lucide-react';

export const Pagos: React.FC = () => {
  const [busquedaCedula, setBusquedaCedula] = useState('');
  const [representante, setRepresentante] = useState<Representante | null>(null);
  const [error, setError] = useState('');
  const [saldoPendiente, setSaldoPendiente] = useState(0);
  const [tasaCambio, setTasaCambio] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingRep, setLoadingRep] = useState(false);

  // Formulario Pago
  const [monto, setMonto] = useState('');
  const [montoBs, setMontoBs] = useState('');
  const [metodo, setMetodo] = useState<MetodoPago>(MetodoPago.PAGO_MOVIL);
  const [referencia, setReferencia] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [tipoPago, setTipoPago] = useState<'Abono' | 'Total'>('Abono');

  useEffect(() => {
    db.getConfig().then(c => setTasaCambio(c.tasaCambio));
  }, []);

  const buscarRepresentante = async () => {
    if (!busquedaCedula) return;
    setLoadingRep(true);
    setError('');
    try {
      const rep = await db.getRepresentanteByCedula(busquedaCedula);
      if (rep) {
        setRepresentante(rep);
        const deuda = await db.calcularSaldoPendiente(rep.cedula);
        setSaldoPendiente(deuda);
      } else {
        setRepresentante(null);
        setError('Representante no encontrado');
      }
    } catch (e) {
      setError('Error de conexión');
    } finally {
      setLoadingRep(false);
    }
  };

  const isMetodoBolivares = (m: MetodoPago) => {
    return [MetodoPago.PAGO_MOVIL, MetodoPago.TRANSFERENCIA, MetodoPago.EFECTIVO_BS, MetodoPago.TDD].includes(m);
  };

  const handleMontoBsChange = (val: string) => {
    setMontoBs(val);
    const valBs = parseFloat(val);
    if (!isNaN(valBs) && tasaCambio > 0) {
      setMonto((valBs / tasaCambio).toFixed(2));
    } else {
      setMonto('');
    }
  };

  const handleMontoUsdChange = (val: string) => {
    setMonto(val);
    const valUsd = parseFloat(val);
    if (isMetodoBolivares(metodo) && !isNaN(valUsd) && tasaCambio > 0) {
      setMontoBs((valUsd * tasaCambio).toFixed(2));
    }
  };

  const procesarPago = async () => {
    if (!representante || !monto || !referencia) {
      setError('Complete todos los campos del pago');
      return;
    }

    const montoNum = parseFloat(monto);
    if (isNaN(montoNum) || montoNum <= 0) {
      setError('Monto inválido');
      return;
    }

    setLoading(true);
    const requiereVerificacion = REQUIERE_VERIFICACION.includes(metodo);
    const estadoInicial = requiereVerificacion ? EstadoPago.PENDIENTE_VERIFICACION : EstadoPago.VERIFICADO;
    
    const niveles = Array.from(new Set(representante.alumnos.map(a => a.nivel))).join(', ');

    const nuevoPago: RegistroPago = {
      id: crypto.randomUUID(), // ID temporal, el backend generará row ID
      timestamp: new Date().toISOString(),
      fechaRegistro: new Date().toISOString().split('T')[0],
      fechaPago: new Date().toISOString().split('T')[0],
      cedulaRepresentante: representante.cedula,
      nombreRepresentante: `${representante.nombres} ${representante.apellidos}`,
      matricula: representante.matricula,
      nivel: niveles,
      tipoPago,
      metodoPago: metodo,
      referencia,
      monto: montoNum,
      montoBolivares: isMetodoBolivares(metodo) && montoBs ? parseFloat(montoBs) : undefined,
      tasaCambioAplicada: isMetodoBolivares(metodo) ? tasaCambio : undefined,
      observaciones,
      estado: estadoInicial
    };

    try {
      await db.savePago(nuevoPago);
      alert(requiereVerificacion 
        ? 'Pago registrado. Pendiente de verificación.' 
        : 'Pago registrado y verificado exitosamente.'
      );
      setMonto('');
      setMontoBs('');
      setReferencia('');
      setObservaciones('');
      const nuevaDeuda = await db.calcularSaldoPendiente(representante.cedula);
      setSaldoPendiente(nuevaDeuda);
    } catch (e) {
      alert("Error guardando el pago. Verifique conexión.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <DollarSign className="text-green-600" /> Caja / Registrar Pago
          </h2>
          <div className="flex items-center gap-2 text-sm bg-indigo-50 px-3 py-1 rounded-full text-indigo-700">
            <RefreshCw size={14} />
            <span>Tasa Actual: <strong>Bs. {tasaCambio.toFixed(2)}</strong></span>
          </div>
        </div>
        
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="Buscar por Cédula"
            value={busquedaCedula}
            onChange={(e) => setBusquedaCedula(e.target.value)}
            className="flex-1 border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button 
            onClick={buscarRepresentante}
            disabled={loadingRep}
            className="bg-slate-800 text-white px-6 rounded-lg hover:bg-slate-700 flex items-center justify-center min-w-[80px]"
          >
            {loadingRep ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />}
          </button>
        </div>
        {error && <p className="text-red-500 mt-2 text-sm">{error}</p>}
      </div>

      {representante && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 lg:col-span-1">
            <h3 className="font-bold text-lg mb-4 text-slate-700">Datos Matrícula</h3>
            <div className="space-y-3 text-sm">
              <p><span className="font-semibold">Rep:</span> {representante.nombres} {representante.apellidos}</p>
              <p><span className="font-semibold">Cédula:</span> {representante.cedula}</p>
              <p><span className="font-semibold">Matrícula:</span> <span className="bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded text-xs">{representante.matricula}</span></p>
              
              <div className="border-t pt-3 mt-3">
                <p className="font-semibold mb-2">Alumnos:</p>
                {representante.alumnos.map((a, i) => (
                  <div key={i} className="mb-2 pl-2 border-l-2 border-indigo-200">
                    <p>{a.nombres} {a.apellidos}</p>
                    <p className="text-xs text-gray-500">{a.nivel} - Sec {a.seccion}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 p-4 bg-orange-50 rounded-lg border border-orange-100">
                <p className="text-orange-800 text-xs uppercase font-bold tracking-wider">Saldo Pendiente</p>
                <div className="flex flex-col">
                  <span className="text-2xl font-bold text-orange-600">${saldoPendiente.toFixed(2)}</span>
                  <span className="text-sm text-orange-400 font-medium">~ Bs. {(saldoPendiente * tasaCambio).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 lg:col-span-2">
            <h3 className="font-bold text-lg mb-4 text-slate-700">Detalles del Pago</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
               <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Método de Pago</label>
                <select 
                  value={metodo}
                  onChange={(e) => {
                    setMetodo(e.target.value as MetodoPago);
                    setMonto('');
                    setMontoBs('');
                  }}
                  className="w-full border border-gray-300 rounded-md p-2"
                >
                  {Object.values(MetodoPago).map(m => <option key={m} value={m}>{m}</option>)}
                </select>
               </div>
               <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                <div className="flex gap-4 mt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={tipoPago === 'Abono'} onChange={() => setTipoPago('Abono')} />
                    <span>Abono</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={tipoPago === 'Total'} onChange={() => {
                        setTipoPago('Total');
                        handleMontoUsdChange(saldoPendiente.toString());
                    }} />
                    <span>Total Deuda</span>
                  </label>
                </div>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
              {isMetodoBolivares(metodo) && (
                <div>
                  <label className="block text-sm font-bold text-indigo-700 mb-1 flex items-center gap-1">
                     Monto en Bolívares (Bs)
                  </label>
                  <input 
                    type="number" 
                    value={montoBs}
                    onChange={(e) => handleMontoBsChange(e.target.value)}
                    className="w-full border border-indigo-300 rounded-md p-2 font-mono"
                    placeholder="0.00"
                  />
                </div>
              )}
              
              <div className={!isMetodoBolivares(metodo) ? "md:col-span-2" : ""}>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                  Monto a Registrar ($ USD)
                </label>
                <input 
                  type="number" 
                  value={monto}
                  onChange={(e) => handleMontoUsdChange(e.target.value)}
                  readOnly={isMetodoBolivares(metodo) && tipoPago === 'Abono' && montoBs !== ''}
                  className={`w-full border border-gray-300 rounded-md p-2 font-mono text-lg ${isMetodoBolivares(metodo) ? 'bg-gray-100 text-gray-600' : 'bg-white'}`}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Referencia / Comprobante</label>
              <input 
                type="text" 
                value={referencia}
                onChange={(e) => setReferencia(e.target.value)}
                className="w-full border border-gray-300 rounded-md p-2"
                placeholder="Ej: 12345678"
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
              <textarea 
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                className="w-full border border-gray-300 rounded-md p-2 h-20"
              ></textarea>
            </div>

            <button 
              onClick={procesarPago}
              disabled={loading}
              className={`w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 font-bold flex justify-center items-center gap-2 shadow-md ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {loading ? <Loader2 className="animate-spin" /> : <CheckCircle size={20} />}
              {loading ? 'Procesando...' : 'Registrar Pago'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};