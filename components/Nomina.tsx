
import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { Empleado, Departamento, Cargo } from '../types';
import { Briefcase, UserPlus, Edit, Trash2, Calculator, Calendar, DollarSign, Save, X, Plane } from 'lucide-react';

export const Nomina: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'PERSONAL' | 'CALCULADORA'>('PERSONAL');
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Estado Formulario Empleado
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [empleadoForm, setEmpleadoForm] = useState<Partial<Empleado>>({});
  
  // Estado Calculadora Prestaciones
  const [calcEmpleadoId, setCalcEmpleadoId] = useState('');
  const [calcFechaEgreso, setCalcFechaEgreso] = useState(new Date().toISOString().split('T')[0]);
  const [calcSueldoIntegral, setCalcSueldoIntegral] = useState(0);

  useEffect(() => {
    cargarEmpleados();
  }, []);

  const cargarEmpleados = async () => {
    setLoading(true);
    try {
      const data = await db.getEmpleados();
      setEmpleados(data);
    } catch (e) {
      console.error(e);
      alert("Error cargando empleados");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (emp?: Empleado) => {
    if (emp) {
      setEmpleadoForm(emp);
    } else {
      setEmpleadoForm({
        fechaIngreso: new Date().toISOString().split('T')[0],
        estado: 'ACTIVO',
        diasVacacionesPendientes: 15
      });
    }
    setIsModalOpen(true);
  };

  const guardarEmpleado = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!empleadoForm.cedula || !empleadoForm.nombres || !empleadoForm.cargo) {
       alert("Campos obligatorios incompletos"); return;
    }
    
    setLoading(true);
    try {
      const toSave: Empleado = {
        id: empleadoForm.id || crypto.randomUUID(),
        cedula: empleadoForm.cedula!,
        nombres: empleadoForm.nombres!,
        apellidos: empleadoForm.apellidos || '',
        departamento: empleadoForm.departamento as Departamento,
        cargo: empleadoForm.cargo as Cargo,
        fechaIngreso: empleadoForm.fechaIngreso!,
        sueldoBase: Number(empleadoForm.sueldoBase) || 0,
        bono: Number(empleadoForm.bono) || 0,
        diasVacacionesPendientes: Number(empleadoForm.diasVacacionesPendientes) || 0,
        estado: empleadoForm.estado as 'ACTIVO' | 'INACTIVO' || 'ACTIVO'
      };
      
      await db.saveEmpleado(toSave);
      setIsModalOpen(false);
      await cargarEmpleados();
    } catch(e) {
      alert("Error guardando empleado");
    } finally {
      setLoading(false);
    }
  };
  
  const darDeBaja = async (emp: Empleado) => {
     if(window.confirm(`¿Seguro desea dar de baja a ${emp.nombres} ${emp.apellidos}? Pasará a estado INACTIVO.`)){
        const updated = { ...emp, estado: 'INACTIVO' as const };
        await db.saveEmpleado(updated);
        cargarEmpleados();
     }
  };

  const registrarVacaciones = async (emp: Empleado) => {
      const dias = prompt(`Días de vacaciones a descontar para ${emp.nombres}:`, "0");
      if(dias) {
          const numDias = parseInt(dias);
          if(!isNaN(numDias) && numDias > 0) {
             const nuevosDias = (emp.diasVacacionesPendientes || 0) - numDias;
             await db.saveEmpleado({ ...emp, diasVacacionesPendientes: nuevosDias });
             cargarEmpleados();
          }
      }
  };

  // --- LOGICA CALCULADORA PRESTACIONES ---
  const calcularPrestaciones = () => {
      if(!calcEmpleadoId) return null;
      const emp = empleados.find(e => e.id === calcEmpleadoId);
      if(!emp) return null;

      const fIngreso = new Date(emp.fechaIngreso);
      const fEgreso = new Date(calcFechaEgreso);
      
      // Diferencia en años y meses
      let years = fEgreso.getFullYear() - fIngreso.getFullYear();
      let months = fEgreso.getMonth() - fIngreso.getMonth();
      if (months < 0 || (months === 0 && fEgreso.getDate() < fIngreso.getDate())) {
        years--;
        months += 12;
      }
      
      // Antigüedad en días (Simple: 30 días por año si > 3 meses? 
      // Usaremos un estandar mixto: 15 dias por trimestre + 2 dias adicionales por año despues del primero)
      // Para simplificar "Plantilla": (Años * 30 días) es el cálculo de retroactivo común.
      
      const diasAntiguedad = years * 30; // Base simple retroactivo
      const diasAdicionales = Math.max(0, years - 1) * 2;
      const totalDiasPagar = diasAntiguedad + diasAdicionales;
      
      // Salario Integral Diario Estimado
      // (Sueldo + Bono + (Utilidades/12) + (BonoVacacional/12)) / 30
      // Simplificaremos usando el input manual o autocalculado simple
      const sueldoMensual = emp.sueldoBase + emp.bono;
      const salarioDiario = sueldoMensual / 30;
      
      // Si el usuario metio un integral manual, usar ese
      const baseCalculo = calcSueldoIntegral > 0 ? calcSueldoIntegral : salarioDiario;
      const totalPrestaciones = totalDiasPagar * baseCalculo;
      
      return {
          emp,
          years,
          totalDiasPagar,
          baseCalculo,
          totalPrestaciones
      };
  };

  const resultadoCalculo = calcularPrestaciones();

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Briefcase className="text-indigo-600" /> Gestión de Nómina y RRHH
          </h2>
          <p className="text-sm text-gray-500">Control de personal, sueldos y prestaciones sociales.</p>
        </div>
        
        <div className="flex gap-2">
            <button 
                onClick={() => setActiveTab('PERSONAL')}
                className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${activeTab === 'PERSONAL' ? 'bg-indigo-600 text-white' : 'bg-white border text-gray-600'}`}
            >
                <Briefcase size={18}/> Personal
            </button>
            <button 
                onClick={() => setActiveTab('CALCULADORA')}
                className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${activeTab === 'CALCULADORA' ? 'bg-indigo-600 text-white' : 'bg-white border text-gray-600'}`}
            >
                <Calculator size={18}/> Prestaciones
            </button>
        </div>
      </div>

      {activeTab === 'PERSONAL' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <h3 className="font-bold text-gray-700">Listado de Empleados</h3>
                <button onClick={() => handleOpenModal()} className="bg-slate-800 text-white px-3 py-1.5 rounded text-sm flex items-center gap-2 hover:bg-slate-700">
                    <UserPlus size={16} /> Nuevo Ingreso
                </button>
            </div>
            
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-500">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                        <tr>
                            <th className="px-6 py-3">Empleado</th>
                            <th className="px-6 py-3">Cargo / Dept</th>
                            <th className="px-6 py-3">Ingreso</th>
                            <th className="px-6 py-3 text-right">Sueldo Base</th>
                            <th className="px-6 py-3 text-right">Bono</th>
                            <th className="px-6 py-3 text-center">Vacaciones</th>
                            <th className="px-6 py-3 text-center">Estado</th>
                            <th className="px-6 py-3 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {empleados.map(emp => (
                            <tr key={emp.id} className={`hover:bg-gray-50 ${emp.estado === 'INACTIVO' ? 'opacity-60 bg-gray-50' : ''}`}>
                                <td className="px-6 py-4">
                                    <div className="font-bold text-gray-800">{emp.nombres} {emp.apellidos}</div>
                                    <div className="text-xs text-gray-400">{emp.cedula}</div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="text-indigo-700 font-medium">{emp.cargo}</div>
                                    <div className="text-xs text-gray-500">{emp.departamento}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">{emp.fechaIngreso}</td>
                                <td className="px-6 py-4 text-right font-mono text-gray-800">${emp.sueldoBase.toFixed(2)}</td>
                                <td className="px-6 py-4 text-right font-mono text-green-600">+${emp.bono.toFixed(2)}</td>
                                <td className="px-6 py-4 text-center">
                                    <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-bold">{emp.diasVacacionesPendientes} días</span>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <span className={`px-2 py-1 rounded text-[10px] font-bold ${emp.estado === 'ACTIVO' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                        {emp.estado}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right flex justify-end gap-2">
                                    <button onClick={() => registrarVacaciones(emp)} title="Registrar Vacaciones" className="p-1 text-blue-500 hover:bg-blue-50 rounded"><Plane size={16}/></button>
                                    <button onClick={() => handleOpenModal(emp)} title="Editar" className="p-1 text-gray-600 hover:bg-gray-100 rounded"><Edit size={16}/></button>
                                    {emp.estado === 'ACTIVO' && (
                                        <button onClick={() => darDeBaja(emp)} title="Dar de Baja" className="p-1 text-red-500 hover:bg-red-50 rounded"><Trash2 size={16}/></button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
      )}

      {activeTab === 'CALCULADORA' && (
         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 md:col-span-1 h-fit">
                 <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><Calculator size={18}/> Parámetros</h3>
                 
                 <div className="space-y-4">
                     <div>
                         <label className="block text-xs font-bold text-gray-500 mb-1">Seleccionar Empleado</label>
                         <select className="w-full border rounded p-2 text-sm" value={calcEmpleadoId} onChange={e => {
                             setCalcEmpleadoId(e.target.value);
                             // Resetear manual override al cambiar emp
                             setCalcSueldoIntegral(0); 
                         }}>
                             <option value="">-- Seleccione --</option>
                             {empleados.filter(e => e.estado === 'ACTIVO').map(e => (
                                 <option key={e.id} value={e.id}>{e.nombres} {e.apellidos}</option>
                             ))}
                         </select>
                     </div>
                     
                     <div>
                         <label className="block text-xs font-bold text-gray-500 mb-1">Fecha de Egreso / Corte</label>
                         <input type="date" className="w-full border rounded p-2 text-sm" value={calcFechaEgreso} onChange={e => setCalcFechaEgreso(e.target.value)} />
                     </div>

                     <div>
                         <label className="block text-xs font-bold text-gray-500 mb-1">Salario Diario Integral ($) (Opcional)</label>
                         <input type="number" className="w-full border rounded p-2 text-sm" placeholder="Auto-calculado si vacío" value={calcSueldoIntegral || ''} onChange={e => setCalcSueldoIntegral(Number(e.target.value))} />
                         <p className="text-[10px] text-gray-400 mt-1">Si se deja en 0, se usa (Sueldo+Bono)/30.</p>
                     </div>
                 </div>
             </div>

             <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 md:col-span-2">
                 <h3 className="font-bold text-gray-800 text-lg mb-6 border-b pb-2">Plantilla de Cálculo de Prestaciones Sociales</h3>
                 
                 {resultadoCalculo ? (
                     <div className="space-y-6 font-mono text-sm">
                         <div className="grid grid-cols-2 gap-4">
                             <div>
                                 <p className="text-gray-500 text-xs uppercase">Trabajador</p>
                                 <p className="font-bold text-base">{resultadoCalculo.emp.nombres} {resultadoCalculo.emp.apellidos}</p>
                                 <p className="text-xs text-gray-400">C.I: {resultadoCalculo.emp.cedula}</p>
                             </div>
                             <div className="text-right">
                                 <p className="text-gray-500 text-xs uppercase">Cargo</p>
                                 <p className="font-bold">{resultadoCalculo.emp.cargo}</p>
                             </div>
                         </div>

                         <div className="bg-gray-50 p-4 rounded border border-gray-200">
                             <div className="flex justify-between mb-2">
                                 <span className="text-gray-600">Fecha Ingreso:</span>
                                 <span className="font-bold">{resultadoCalculo.emp.fechaIngreso}</span>
                             </div>
                             <div className="flex justify-between mb-2">
                                 <span className="text-gray-600">Fecha Egreso/Corte:</span>
                                 <span className="font-bold">{calcFechaEgreso}</span>
                             </div>
                             <div className="flex justify-between border-t pt-2 mt-2">
                                 <span className="text-gray-800 font-bold">Tiempo de Servicio:</span>
                                 <span className="font-bold text-indigo-700">{resultadoCalculo.years} Años (aprox)</span>
                             </div>
                         </div>

                         <div className="space-y-2">
                             <div className="flex justify-between items-center py-2 border-b border-dashed">
                                 <span>Base de Cálculo (Salario Diario Integral):</span>
                                 <span className="font-bold">${resultadoCalculo.baseCalculo.toFixed(2)}</span>
                             </div>
                             <div className="flex justify-between items-center py-2 border-b border-dashed">
                                 <span>Días a Pagar (Antigüedad + Adicionales):</span>
                                 <span className="font-bold">{resultadoCalculo.totalDiasPagar} días</span>
                             </div>
                             <div className="flex justify-between items-center py-4 bg-indigo-50 px-4 rounded mt-4">
                                 <span className="text-lg font-bold text-indigo-900">Total Prestaciones Sociales:</span>
                                 <span className="text-2xl font-bold text-indigo-600">${resultadoCalculo.totalPrestaciones.toFixed(2)}</span>
                             </div>
                         </div>
                         
                         <p className="text-xs text-center text-gray-400 mt-4">
                             * Cálculo estimado basado en la antigüedad (Art. 142 LOTTT - Literal C "Garantía"). 
                             Este monto puede variar si se aplica cálculo retroactivo detallado.
                         </p>
                     </div>
                 ) : (
                     <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                         <Calculator size={48} className="mb-2 opacity-50"/>
                         <p>Seleccione un empleado para generar la plantilla.</p>
                     </div>
                 )}
             </div>
         </div>
      )}

      {/* MODAL EMPLEADO */}
      {isModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-lg font-bold">{empleadoForm.id ? 'Editar Empleado' : 'Nuevo Empleado'}</h3>
                      <button onClick={() => setIsModalOpen(false)}><X size={24} className="text-gray-400"/></button>
                  </div>
                  
                  <form onSubmit={guardarEmpleado} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                          <label className="text-xs font-bold text-gray-500">Cédula</label>
                          <input required className="w-full border rounded p-2" value={empleadoForm.cedula || ''} onChange={e => setEmpleadoForm({...empleadoForm, cedula: e.target.value})} />
                      </div>
                      <div>
                          <label className="text-xs font-bold text-gray-500">Nombres</label>
                          <input required className="w-full border rounded p-2" value={empleadoForm.nombres || ''} onChange={e => setEmpleadoForm({...empleadoForm, nombres: e.target.value})} />
                      </div>
                      <div>
                          <label className="text-xs font-bold text-gray-500">Apellidos</label>
                          <input className="w-full border rounded p-2" value={empleadoForm.apellidos || ''} onChange={e => setEmpleadoForm({...empleadoForm, apellidos: e.target.value})} />
                      </div>
                      <div>
                          <label className="text-xs font-bold text-gray-500">Fecha Ingreso</label>
                          <input type="date" required className="w-full border rounded p-2" value={empleadoForm.fechaIngreso || ''} onChange={e => setEmpleadoForm({...empleadoForm, fechaIngreso: e.target.value})} />
                      </div>
                      
                      <div>
                          <label className="text-xs font-bold text-gray-500">Departamento</label>
                          <select className="w-full border rounded p-2" value={empleadoForm.departamento || ''} onChange={e => setEmpleadoForm({...empleadoForm, departamento: e.target.value as Departamento})}>
                              <option value="">Seleccione Dept</option>
                              {Object.values(Departamento).map(d => <option key={d} value={d}>{d}</option>)}
                          </select>
                      </div>
                      <div>
                          <label className="text-xs font-bold text-gray-500">Cargo</label>
                          <select className="w-full border rounded p-2" value={empleadoForm.cargo || ''} onChange={e => setEmpleadoForm({...empleadoForm, cargo: e.target.value as Cargo})}>
                              <option value="">Seleccione Cargo</option>
                              {Object.values(Cargo).map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                      </div>
                      
                      <div>
                          <label className="text-xs font-bold text-gray-500">Sueldo Base ($)</label>
                          <input type="number" required className="w-full border rounded p-2" value={empleadoForm.sueldoBase || ''} onChange={e => setEmpleadoForm({...empleadoForm, sueldoBase: parseFloat(e.target.value)})} />
                      </div>
                      <div>
                          <label className="text-xs font-bold text-gray-500">Bono Mensual ($)</label>
                          <input type="number" className="w-full border rounded p-2" value={empleadoForm.bono || ''} onChange={e => setEmpleadoForm({...empleadoForm, bono: parseFloat(e.target.value)})} />
                      </div>

                      <div className="md:col-span-2 flex gap-3 pt-4 border-t mt-2">
                          <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 bg-gray-100 text-gray-700 py-2 rounded font-medium">Cancelar</button>
                          <button type="submit" className="flex-1 bg-indigo-600 text-white py-2 rounded font-medium flex justify-center items-center gap-2">
                              {loading ? 'Guardando...' : <><Save size={18}/> Guardar Ficha</>}
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};
