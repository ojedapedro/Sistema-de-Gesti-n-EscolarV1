
import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { Empleado, Departamento, Cargo } from '../types';
import { Briefcase, UserPlus, Edit, Trash2, Calculator, Calendar, DollarSign, Save, X, Plane, Palmtree, Printer, CheckCircle } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { LOGO_URL } from '../constants';

// Helper Imagen
const loadImage = (url: string): Promise<string | null> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = url;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (ctx) { ctx.drawImage(img, 0, 0); resolve(canvas.toDataURL("image/png")); } 
      else { resolve(null); }
    };
    img.onerror = () => resolve(null);
  });
};

export const Nomina: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'PERSONAL' | 'CALCULADORA' | 'VACACIONES'>('PERSONAL');
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Estado Formulario Empleado
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [empleadoForm, setEmpleadoForm] = useState<Partial<Empleado>>({});
  
  // Estado Calculadora Prestaciones
  const [calcEmpleadoId, setCalcEmpleadoId] = useState('');
  const [calcFechaEgreso, setCalcFechaEgreso] = useState(new Date().toISOString().split('T')[0]);
  const [calcSueldoIntegral, setCalcSueldoIntegral] = useState(0);

  // Estado Calculadora Vacaciones
  const [vacacionEmpId, setVacacionEmpId] = useState('');
  const [vacacionFechaInicio, setVacacionFechaInicio] = useState(new Date().toISOString().split('T')[0]);
  const [vacacionDiasDisfrute, setVacacionDiasDisfrute] = useState(15);
  const [vacacionDiasBono, setVacacionDiasBono] = useState(15);
  const [vacacionSalarioDiario, setVacacionSalarioDiario] = useState(0);

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

  // --- LOGICA CALCULADORA PRESTACIONES ---
  const calcularPrestaciones = () => {
      if(!calcEmpleadoId) return null;
      const emp = empleados.find(e => e.id === calcEmpleadoId);
      if(!emp) return null;

      const fIngreso = new Date(emp.fechaIngreso);
      const fEgreso = new Date(calcFechaEgreso);
      
      let years = fEgreso.getFullYear() - fIngreso.getFullYear();
      let months = fEgreso.getMonth() - fIngreso.getMonth();
      if (months < 0 || (months === 0 && fEgreso.getDate() < fIngreso.getDate())) {
        years--;
        months += 12;
      }
      
      const diasAntiguedad = years * 30; 
      const diasAdicionales = Math.max(0, years - 1) * 2;
      const totalDiasPagar = diasAntiguedad + diasAdicionales;
      
      const sueldoMensual = emp.sueldoBase + emp.bono;
      const salarioDiario = sueldoMensual / 30;
      
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

  const resultadoPrestaciones = calcularPrestaciones();

  // --- LOGICA CALCULADORA VACACIONES ---
  const calcularVacaciones = () => {
      if(!vacacionEmpId) return null;
      const emp = empleados.find(e => e.id === vacacionEmpId);
      if(!emp) return null;

      // Calcular años de servicio
      const fIngreso = new Date(emp.fechaIngreso);
      const fActual = new Date(); // Asumimos calculo a la fecha actual o inicio vac
      let years = fActual.getFullYear() - fIngreso.getFullYear();
      if (fActual.getMonth() < fIngreso.getMonth() || (fActual.getMonth() === fIngreso.getMonth() && fActual.getDate() < fIngreso.getDate())) {
          years--;
      }
      years = Math.max(0, years);

      const sueldoMensual = emp.sueldoBase + emp.bono;
      const salarioDiarioBase = sueldoMensual / 30;
      
      // Usar manual o calculado
      const salarioDiario = vacacionSalarioDiario > 0 ? vacacionSalarioDiario : salarioDiarioBase;

      const totalPagoDias = vacacionDiasDisfrute * salarioDiario;
      const totalBonoVacacional = vacacionDiasBono * salarioDiario;
      const totalPagar = totalPagoDias + totalBonoVacacional;

      return {
          emp,
          yearsService: years,
          salarioDiario,
          totalPagoDias,
          totalBonoVacacional,
          totalPagar
      };
  };

  const resultadoVacaciones = calcularVacaciones();

  const handleSelectVacacionEmp = (empId: string) => {
      setVacacionEmpId(empId);
      const emp = empleados.find(e => e.id === empId);
      if(emp) {
          // Autocalcular años para sugerir días
          const fIngreso = new Date(emp.fechaIngreso);
          const now = new Date();
          let years = now.getFullYear() - fIngreso.getFullYear();
          if (now.getMonth() < fIngreso.getMonth()) years--;
          years = Math.max(0, years);
          
          // Regla estándar: 15 días + 1 por cada año de servicio (hasta un tope, ej 30)
          const diasLegales = Math.min(30, 15 + years);
          
          setVacacionDiasDisfrute(diasLegales);
          setVacacionDiasBono(diasLegales); // Usualmente el bono vacacional iguala los días de disfrute
          setVacacionSalarioDiario(0); // Reset para que calcule auto
      }
  };

  const registrarDescuentoVacaciones = async () => {
      if(!resultadoVacaciones) return;
      if(window.confirm(`¿Desea descontar ${vacacionDiasDisfrute} días del saldo pendiente de vacaciones de ${resultadoVacaciones.emp.nombres}?`)) {
          const emp = resultadoVacaciones.emp;
          const nuevoSaldo = (emp.diasVacacionesPendientes || 0) - vacacionDiasDisfrute;
          
          setLoading(true);
          try {
              await db.saveEmpleado({ ...emp, diasVacacionesPendientes: nuevoSaldo });
              await cargarEmpleados();
              alert("Días descontados y registro actualizado.");
          } catch(e) {
              alert("Error al actualizar empleado.");
          } finally {
              setLoading(false);
          }
      }
  };

  const imprimirReciboVacaciones = async () => {
      if(!resultadoVacaciones) return;
      
      const doc = new jsPDF();
      const logo = await loadImage(LOGO_URL);
      if(logo) doc.addImage(logo, 'PNG', 15, 10, 25, 25);

      // Header
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("RECIBO DE PAGO DE VACACIONES", 105, 25, { align: 'center' });
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Fecha de Emisión: ${new Date().toLocaleDateString()}`, 105, 32, { align: 'center' });

      // Datos del Trabajador
      doc.setFillColor(240, 240, 240);
      doc.rect(15, 45, 180, 25, 'F');
      
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("DATOS DEL TRABAJADOR", 20, 52);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Nombre: ${resultadoVacaciones.emp.nombres} ${resultadoVacaciones.emp.apellidos}`, 20, 60);
      doc.text(`Cédula: ${resultadoVacaciones.emp.cedula}`, 120, 60);
      doc.text(`Cargo: ${resultadoVacaciones.emp.cargo}`, 20, 66);
      doc.text(`Fecha Ingreso: ${resultadoVacaciones.emp.fechaIngreso}`, 120, 66);

      // Detalles del Periodo
      doc.text(`Fecha Inicio Vacaciones: ${vacacionFechaInicio}`, 20, 80);
      doc.text(`Años de Servicio: ${resultadoVacaciones.yearsService}`, 120, 80);

      // Tabla de Cálculos
      const tableData = [
          [
              'Días de Disfrute', 
              `${vacacionDiasDisfrute} días`, 
              `$${resultadoVacaciones.salarioDiario.toFixed(2)}`, 
              `$${resultadoVacaciones.totalPagoDias.toFixed(2)}`
          ],
          [
              'Bono Vacacional', 
              `${vacacionDiasBono} días`, 
              `$${resultadoVacaciones.salarioDiario.toFixed(2)}`, 
              `$${resultadoVacaciones.totalBonoVacacional.toFixed(2)}`
          ]
      ];

      autoTable(doc, {
          startY: 90,
          head: [['Concepto', 'Cantidad', 'Salario Diario', 'Total a Pagar']],
          body: tableData,
          foot: [['', '', 'TOTAL A PAGAR:', `$${resultadoVacaciones.totalPagar.toFixed(2)}`]],
          theme: 'grid',
          headStyles: { fillColor: [63, 81, 181] },
          footStyles: { fillColor: [240, 240, 240], textColor: 20, fontStyle: 'bold' }
      });

      // Firmas
      const finalY = (doc as any).lastAutoTable.finalY + 40;
      doc.setLineWidth(0.5);
      
      doc.line(25, finalY, 85, finalY);
      doc.text("Empleado (Recibí Conforme)", 55, finalY + 5, { align: 'center' });
      doc.text(resultadoVacaciones.emp.cedula, 55, finalY + 10, { align: 'center' });

      doc.line(125, finalY, 185, finalY);
      doc.text("Empleador / Administración", 155, finalY + 5, { align: 'center' });

      doc.save(`Recibo_Vacaciones_${resultadoVacaciones.emp.cedula}.pdf`);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Briefcase className="text-indigo-600" /> Gestión de Nómina y RRHH
          </h2>
          <p className="text-sm text-gray-500">Control de personal, sueldos y beneficios sociales.</p>
        </div>
        
        <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
            <button 
                onClick={() => setActiveTab('PERSONAL')}
                className={`px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors ${activeTab === 'PERSONAL' ? 'bg-white shadow text-indigo-600' : 'text-gray-600 hover:text-gray-800'}`}
            >
                <Briefcase size={16}/> Personal
            </button>
            <button 
                onClick={() => setActiveTab('VACACIONES')}
                className={`px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors ${activeTab === 'VACACIONES' ? 'bg-white shadow text-green-600' : 'text-gray-600 hover:text-gray-800'}`}
            >
                <Palmtree size={16}/> Vacaciones
            </button>
            <button 
                onClick={() => setActiveTab('CALCULADORA')}
                className={`px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors ${activeTab === 'CALCULADORA' ? 'bg-white shadow text-indigo-600' : 'text-gray-600 hover:text-gray-800'}`}
            >
                <Calculator size={16}/> Prestaciones
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
                                    <button onClick={() => { setVacacionEmpId(emp.id); setActiveTab('VACACIONES'); }} title="Ir a Vacaciones" className="p-1 text-green-600 hover:bg-green-50 rounded"><Palmtree size={16}/></button>
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

      {activeTab === 'VACACIONES' && (
         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 md:col-span-1 h-fit">
                 <h3 className="font-bold text-green-700 mb-4 flex items-center gap-2"><Palmtree size={18}/> Parámetros Vacacionales</h3>
                 
                 <div className="space-y-4">
                     <div>
                         <label className="block text-xs font-bold text-gray-500 mb-1">Empleado</label>
                         <select className="w-full border rounded p-2 text-sm" value={vacacionEmpId} onChange={e => handleSelectVacacionEmp(e.target.value)}>
                             <option value="">-- Seleccione --</option>
                             {empleados.filter(e => e.estado === 'ACTIVO').map(e => (
                                 <option key={e.id} value={e.id}>{e.nombres} {e.apellidos}</option>
                             ))}
                         </select>
                     </div>
                     
                     <div>
                         <label className="block text-xs font-bold text-gray-500 mb-1">Fecha Inicio Vacaciones</label>
                         <input type="date" className="w-full border rounded p-2 text-sm" value={vacacionFechaInicio} onChange={e => setVacacionFechaInicio(e.target.value)} />
                     </div>

                     <div className="grid grid-cols-2 gap-2">
                        <div>
                             <label className="block text-xs font-bold text-gray-500 mb-1">Días Disfrute</label>
                             <input type="number" className="w-full border rounded p-2 text-sm font-bold text-gray-700" value={vacacionDiasDisfrute} onChange={e => setVacacionDiasDisfrute(Number(e.target.value))} />
                        </div>
                        <div>
                             <label className="block text-xs font-bold text-gray-500 mb-1">Días Bono Vac.</label>
                             <input type="number" className="w-full border rounded p-2 text-sm font-bold text-gray-700" value={vacacionDiasBono} onChange={e => setVacacionDiasBono(Number(e.target.value))} />
                        </div>
                     </div>

                     <div>
                         <label className="block text-xs font-bold text-gray-500 mb-1">Salario Diario Integral ($) (Opcional)</label>
                         <input type="number" className="w-full border rounded p-2 text-sm" placeholder="Auto-calculado" value={vacacionSalarioDiario || ''} onChange={e => setVacacionSalarioDiario(Number(e.target.value))} />
                         <p className="text-[10px] text-gray-400 mt-1">Si es 0, se calcula (Sueldo + Bono) / 30.</p>
                     </div>
                 </div>
             </div>

             <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 md:col-span-2">
                 <h3 className="font-bold text-gray-800 text-lg mb-6 border-b pb-2 flex items-center justify-between">
                     <span>Recibo de Pago de Vacaciones</span>
                     {resultadoVacaciones && (
                         <div className="flex gap-2">
                            <button 
                                onClick={registrarDescuentoVacaciones}
                                className="bg-green-100 text-green-700 text-xs px-3 py-1.5 rounded-lg hover:bg-green-200 flex items-center gap-1 font-bold"
                            >
                                <CheckCircle size={14}/> Descontar Días
                            </button>
                            <button 
                                onClick={imprimirReciboVacaciones}
                                className="bg-slate-800 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-slate-700 flex items-center gap-1"
                            >
                                <Printer size={14}/> Imprimir Recibo
                            </button>
                         </div>
                     )}
                 </h3>
                 
                 {resultadoVacaciones ? (
                     <div className="space-y-6 font-mono text-sm">
                         <div className="grid grid-cols-2 gap-4">
                             <div>
                                 <p className="text-gray-500 text-xs uppercase">Trabajador</p>
                                 <p className="font-bold text-base">{resultadoVacaciones.emp.nombres} {resultadoVacaciones.emp.apellidos}</p>
                                 <p className="text-xs text-gray-400">C.I: {resultadoVacaciones.emp.cedula}</p>
                             </div>
                             <div className="text-right">
                                 <p className="text-gray-500 text-xs uppercase">Cargo</p>
                                 <p className="font-bold">{resultadoVacaciones.emp.cargo}</p>
                                 <p className="text-xs text-gray-400">Antigüedad: {resultadoVacaciones.yearsService} años</p>
                             </div>
                         </div>

                         <div className="bg-green-50 p-4 rounded border border-green-100">
                             <table className="w-full text-sm">
                                 <thead>
                                     <tr className="border-b border-green-200 text-green-800">
                                         <th className="text-left pb-2">Concepto</th>
                                         <th className="text-center pb-2">Días</th>
                                         <th className="text-right pb-2">Salario Diario</th>
                                         <th className="text-right pb-2">Total</th>
                                     </tr>
                                 </thead>
                                 <tbody className="divide-y divide-green-100">
                                     <tr>
                                         <td className="py-2">Pago de Días de Disfrute</td>
                                         <td className="text-center">{vacacionDiasDisfrute}</td>
                                         <td className="text-right">${resultadoVacaciones.salarioDiario.toFixed(2)}</td>
                                         <td className="text-right font-bold">${resultadoVacaciones.totalPagoDias.toFixed(2)}</td>
                                     </tr>
                                     <tr>
                                         <td className="py-2">Bono Vacacional</td>
                                         <td className="text-center">{vacacionDiasBono}</td>
                                         <td className="text-right">${resultadoVacaciones.salarioDiario.toFixed(2)}</td>
                                         <td className="text-right font-bold">${resultadoVacaciones.totalBonoVacacional.toFixed(2)}</td>
                                     </tr>
                                 </tbody>
                             </table>
                         </div>

                         <div className="flex justify-between items-center py-4 bg-gray-50 px-4 rounded mt-4 border border-gray-200">
                             <span className="text-lg font-bold text-gray-700">Total a Pagar:</span>
                             <span className="text-2xl font-bold text-green-600">${resultadoVacaciones.totalPagar.toFixed(2)}</span>
                         </div>
                         
                         <p className="text-xs text-center text-gray-400 mt-2">
                            Saldo actual de días pendientes (antes de descontar): <span className="font-bold">{resultadoVacaciones.emp.diasVacacionesPendientes} días</span>.
                         </p>
                     </div>
                 ) : (
                     <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                         <Palmtree size={48} className="mb-2 opacity-50"/>
                         <p>Seleccione un empleado para calcular vacaciones.</p>
                     </div>
                 )}
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
                 
                 {resultadoPrestaciones ? (
                     <div className="space-y-6 font-mono text-sm">
                         <div className="grid grid-cols-2 gap-4">
                             <div>
                                 <p className="text-gray-500 text-xs uppercase">Trabajador</p>
                                 <p className="font-bold text-base">{resultadoPrestaciones.emp.nombres} {resultadoPrestaciones.emp.apellidos}</p>
                                 <p className="text-xs text-gray-400">C.I: {resultadoPrestaciones.emp.cedula}</p>
                             </div>
                             <div className="text-right">
                                 <p className="text-gray-500 text-xs uppercase">Cargo</p>
                                 <p className="font-bold">{resultadoPrestaciones.emp.cargo}</p>
                             </div>
                         </div>

                         <div className="bg-gray-50 p-4 rounded border border-gray-200">
                             <div className="flex justify-between mb-2">
                                 <span className="text-gray-600">Fecha Ingreso:</span>
                                 <span className="font-bold">{resultadoPrestaciones.emp.fechaIngreso}</span>
                             </div>
                             <div className="flex justify-between mb-2">
                                 <span className="text-gray-600">Fecha Egreso/Corte:</span>
                                 <span className="font-bold">{calcFechaEgreso}</span>
                             </div>
                             <div className="flex justify-between border-t pt-2 mt-2">
                                 <span className="text-gray-800 font-bold">Tiempo de Servicio:</span>
                                 <span className="font-bold text-indigo-700">{resultadoPrestaciones.years} Años (aprox)</span>
                             </div>
                         </div>

                         <div className="space-y-2">
                             <div className="flex justify-between items-center py-2 border-b border-dashed">
                                 <span>Base de Cálculo (Salario Diario Integral):</span>
                                 <span className="font-bold">${resultadoPrestaciones.baseCalculo.toFixed(2)}</span>
                             </div>
                             <div className="flex justify-between items-center py-2 border-b border-dashed">
                                 <span>Días a Pagar (Antigüedad + Adicionales):</span>
                                 <span className="font-bold">{resultadoPrestaciones.totalDiasPagar} días</span>
                             </div>
                             <div className="flex justify-between items-center py-4 bg-indigo-50 px-4 rounded mt-4">
                                 <span className="text-lg font-bold text-indigo-900">Total Prestaciones Sociales:</span>
                                 <span className="text-2xl font-bold text-indigo-600">${resultadoPrestaciones.totalPrestaciones.toFixed(2)}</span>
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
