import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { NivelEducativo, Representante, Alumno, NivelConfig, MetodoPago, RegistroPago, EstadoPago } from '../types';
import { Plus, Save, User, DollarSign, CheckCircle, Loader2, CreditCard } from 'lucide-react';
import { MENSUALIDADES, REQUIERE_VERIFICACION } from '../constants';

export const RegistroAlumno: React.FC = () => {
  // Datos Representante
  const [cedula, setCedula] = useState('');
  const [nombreRep, setNombreRep] = useState('');
  const [apellidoRep, setApellidoRep] = useState('');
  const [telefono, setTelefono] = useState('');
  const [correo, setCorreo] = useState('');
  const [direccion, setDireccion] = useState('');
  
  // Datos Alumno
  const [alumnos, setAlumnos] = useState<Omit<Alumno, 'id'>[]>([]);
  const [nombreAlu, setNombreAlu] = useState('');
  const [apellidoAlu, setApellidoAlu] = useState('');
  const [nivel, setNivel] = useState<NivelEducativo>(NivelEducativo.MATERNAL);
  const [seccion, setSeccion] = useState('A');

  // Datos Financieros (Pago Inicial)
  const [incluirPago, setIncluirPago] = useState(false);
  const [montoInicial, setMontoInicial] = useState('');
  const [metodoPago, setMetodoPago] = useState<MetodoPago>(MetodoPago.PAGO_MOVIL);
  const [referenciaPago, setReferenciaPago] = useState('');
  const [observacionPago, setObservacionPago] = useState('Inscripción / Pago Inicial');

  // Configuración
  const [preciosNiveles, setPreciosNiveles] = useState<NivelConfig[]>([]);
  const [tasaCambio, setTasaCambio] = useState(0);

  // UI States
  const [mensaje, setMensaje] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const initData = async () => {
      try {
        const [niveles, config] = await Promise.all([
          db.getNiveles(),
          db.getConfig()
        ]);
        setPreciosNiveles(niveles);
        setTasaCambio(config.tasaCambio);
      } catch (e) {
        console.error("Error cargando configuración", e);
      }
    };
    initData();
  }, []);

  const obtenerPrecio = (niv: NivelEducativo) => {
    const config = preciosNiveles.find(n => n.nivel === niv);
    return config ? config.precio : (MENSUALIDADES[niv] || 0);
  };

  const handleAgregarAlumno = () => {
    if (!nombreAlu || !apellidoAlu) return;

    setAlumnos([
      ...alumnos,
      {
        nombres: nombreAlu,
        apellidos: apellidoAlu,
        nivel,
        seccion,
        mensualidad: obtenerPrecio(nivel)
      }
    ]);

    setNombreAlu('');
    setApellidoAlu('');
    setNivel(NivelEducativo.MATERNAL);
  };

  const handleGuardarTodo = async () => {
    // Validaciones básicas
    if (!cedula || !nombreRep || !telefono || alumnos.length === 0) {
      setMensaje({ type: 'error', text: 'Complete los datos obligatorios y agregue al menos un alumno.' });
      return;
    }

    if (incluirPago && (!montoInicial || !referenciaPago)) {
      setMensaje({ type: 'error', text: 'Si activa el pago inicial, debe indicar monto y referencia.' });
      return;
    }

    setLoading(true);
    setMensaje(null);

    const matricula = db.generarMatricula(cedula);
    const nombreCompletoRep = `${nombreRep} ${apellidoRep}`;

    try {
      // 1. Guardar Representante y Alumnos
      const nuevoRepresentante: Representante = {
        cedula,
        nombres: nombreRep,
        apellidos: apellidoRep,
        telefono,
        correo,
        direccion,
        matricula,
        alumnos: alumnos.map((a, idx) => ({ ...a, id: `${cedula}-${idx + 1}` }))
      };

      await db.saveRepresentante(nuevoRepresentante);

      // 2. Guardar Pago Inicial (si aplica)
      if (incluirPago) {
        const montoNum = parseFloat(montoInicial);
        const requiereVerificacion = REQUIERE_VERIFICACION.includes(metodoPago);
        
        // Determinar si es pago en Bs para guardar el histórico
        const esPagoBs = [MetodoPago.PAGO_MOVIL, MetodoPago.TRANSFERENCIA, MetodoPago.EFECTIVO_BS].includes(metodoPago);
        const montoBs = esPagoBs ? (montoNum * tasaCambio) : undefined;

        const nuevoPago: RegistroPago = {
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          fechaRegistro: new Date().toISOString().split('T')[0],
          fechaPago: new Date().toISOString().split('T')[0],
          cedulaRepresentante: cedula,
          nombreRepresentante: nombreCompletoRep,
          matricula: matricula,
          nivel: alumnos.map(a => a.nivel).join(', '),
          tipoPago: 'Abono',
          metodoPago: metodoPago,
          referencia: referenciaPago,
          monto: montoNum, // Siempre en USD base
          montoBolivares: montoBs,
          tasaCambioAplicada: esPagoBs ? tasaCambio : undefined,
          observaciones: observacionPago,
          estado: requiereVerificacion ? EstadoPago.PENDIENTE_VERIFICACION : EstadoPago.VERIFICADO
        };

        await db.savePago(nuevoPago);
      }

      setMensaje({ type: 'success', text: `¡Registro Completo! Familia registrada con matrícula: ${matricula}` });
      
      // Limpiar formulario
      setCedula(''); setNombreRep(''); setApellidoRep(''); setTelefono(''); setCorreo(''); setDireccion('');
      setAlumnos([]);
      setIncluirPago(false); setMontoInicial(''); setReferenciaPago('');

    } catch (e) {
      console.error(e);
      setMensaje({ type: 'error', text: 'Error al conectar con la base de datos. Intente nuevamente.' });
    } finally {
      setLoading(false);
    }
  };

  const totalMensualidades = alumnos.reduce((acc, curr) => acc + curr.mensualidad, 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-2xl font-bold mb-6 text-slate-800 flex items-center gap-2">
          <User className="text-indigo-600" /> Nuevo Ingreso (Ficha Académica)
        </h2>

        {mensaje && (
          <div className={`p-4 mb-6 rounded-lg border ${mensaje.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
            <p className="font-medium flex items-center gap-2">
              {mensaje.type === 'success' ? <CheckCircle size={20}/> : null}
              {mensaje.text}
            </p>
          </div>
        )}

        {/* Datos del Representante */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cédula Rep. *</label>
            <input type="text" value={cedula} onChange={(e) => setCedula(e.target.value)} className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="V-12345678" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono *</label>
            <input type="text" value={telefono} onChange={(e) => setTelefono(e.target.value)} className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombres *</label>
            <input type="text" value={nombreRep} onChange={(e) => setNombreRep(e.target.value)} className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Apellidos *</label>
            <input type="text" value={apellidoRep} onChange={(e) => setApellidoRep(e.target.value)} className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Dirección de Habitación</label>
            <input type="text" value={direccion} onChange={(e) => setDireccion(e.target.value)} className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>
        </div>

        {/* Sección Agregar Alumnos */}
        <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2 mt-8">Datos del Alumno(s)</h3>
        <div className="bg-slate-50 p-6 rounded-lg mb-6 border border-slate-200">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-4 items-end">
            <div className="md:col-span-3">
               <label className="block text-xs text-gray-500 mb-1">Nombres</label>
               <input value={nombreAlu} onChange={(e) => setNombreAlu(e.target.value)} className="w-full border border-gray-300 rounded-md p-2" />
            </div>
            <div className="md:col-span-3">
               <label className="block text-xs text-gray-500 mb-1">Apellidos</label>
               <input value={apellidoAlu} onChange={(e) => setApellidoAlu(e.target.value)} className="w-full border border-gray-300 rounded-md p-2" />
            </div>
            <div className="md:col-span-3">
               <label className="block text-xs text-gray-500 mb-1">Nivel</label>
               <select value={nivel} onChange={(e) => setNivel(e.target.value as NivelEducativo)} className="w-full border border-gray-300 rounded-md p-2">
                  {Object.values(NivelEducativo).map((niv) => <option key={niv} value={niv}>{niv}</option>)}
              </select>
            </div>
            <div className="md:col-span-1">
               <label className="block text-xs text-gray-500 mb-1">Sección</label>
               <input value={seccion} onChange={(e) => setSeccion(e.target.value)} className="w-full border border-gray-300 rounded-md p-2 text-center" />
            </div>
            <div className="md:col-span-2">
              <button onClick={handleAgregarAlumno} className="w-full flex items-center justify-center gap-1 bg-slate-800 text-white p-2 rounded-md hover:bg-slate-700 text-sm h-[42px]">
                <Plus size={16} /> Agregar
              </button>
            </div>
          </div>
          <div className="text-right text-xs text-gray-500">
            Costo Mensualidad: <span className="font-bold text-slate-800">${obtenerPrecio(nivel)}</span>
          </div>
        </div>

        {/* Lista de Alumnos */}
        {alumnos.length > 0 && (
          <div className="mb-8">
            <h4 className="font-medium text-gray-700 mb-2">Alumnos a inscribir ({alumnos.length}):</h4>
            <ul className="space-y-2">
              {alumnos.map((a, i) => (
                <li key={i} className="flex justify-between items-center bg-indigo-50 p-3 rounded border border-indigo-100 text-sm">
                  <span className="font-medium text-indigo-900">{a.nombres} {a.apellidos} <span className="text-gray-500 font-normal">- {a.nivel} ({a.seccion})</span></span>
                  <span className="font-bold text-gray-600">${a.mensualidad}</span>
                </li>
              ))}
            </ul>
            <div className="flex justify-end mt-2 pt-2 border-t border-gray-100">
                <p className="text-sm font-bold text-gray-700">Total Mensualidades: ${totalMensualidades}</p>
            </div>
          </div>
        )}
      </div>

      {/* Sección de Pago Inicial */}
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
         <div className="flex items-center gap-3 mb-6">
            <input 
              type="checkbox" 
              id="checkPago" 
              checked={incluirPago} 
              onChange={(e) => setIncluirPago(e.target.checked)}
              className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
            />
            <label htmlFor="checkPago" className="text-lg font-bold text-slate-800 flex items-center gap-2 cursor-pointer select-none">
              <CreditCard className="text-green-600" /> Registrar Pago de Inscripción / Inicial
            </label>
         </div>

         {incluirPago && (
            <div className="bg-green-50 p-6 rounded-xl border border-green-100 animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Monto a Pagar (USD)</label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                            <input 
                              type="number" 
                              value={montoInicial} 
                              onChange={(e) => setMontoInicial(e.target.value)} 
                              className="w-full pl-8 border border-gray-300 rounded-md p-2 font-bold text-gray-800"
                              placeholder="0.00" 
                            />
                        </div>
                        {tasaCambio > 0 && montoInicial && (
                            <p className="text-xs text-green-700 mt-1 font-mono">
                                Aprox: Bs. {(parseFloat(montoInicial) * tasaCambio).toFixed(2)}
                            </p>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Método de Pago</label>
                        <select 
                          value={metodoPago} 
                          onChange={(e) => setMetodoPago(e.target.value as MetodoPago)} 
                          className="w-full border border-gray-300 rounded-md p-2"
                        >
                            {Object.values(MetodoPago).map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Referencia / Comprobante</label>
                        <input 
                          type="text" 
                          value={referenciaPago} 
                          onChange={(e) => setReferenciaPago(e.target.value)} 
                          className="w-full border border-gray-300 rounded-md p-2"
                          placeholder="Ej: 123456" 
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Concepto / Observación</label>
                        <input 
                          type="text" 
                          value={observacionPago} 
                          onChange={(e) => setObservacionPago(e.target.value)} 
                          className="w-full border border-gray-300 rounded-md p-2"
                        />
                    </div>
                </div>
            </div>
         )}
      </div>

      <button 
        onClick={handleGuardarTodo} 
        disabled={loading} 
        className={`w-full flex justify-center items-center gap-2 bg-indigo-600 text-white px-6 py-4 rounded-xl hover:bg-indigo-700 font-bold text-lg shadow-lg transition-all hover:shadow-xl hover:-translate-y-1 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
      >
        {loading ? <Loader2 className="animate-spin" /> : <Save size={24} />}
        {loading ? 'Procesando Registro...' : 'Guardar Ficha y Pago'}
      </button>
    </div>
  );
};