
import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { Empleado, Departamento, Cargo, RegistroNomina } from '../types';
import { Briefcase, UserPlus, Edit, Trash2, Calculator, Calendar, DollarSign, Save, X, Plane, Palmtree, Printer, CheckCircle, FileText, Settings, Users } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<'PERSONAL' | 'CALCULADORA' | 'VACACIONES' | 'PROCESAR'>('PERSONAL');
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

  // --- ESTADOS PROCESAR NOMINA ---
  const [nominaPeriodo, setNominaPeriodo] = useState('');
  const [nominaFechaPago, setNominaFechaPago] = useState(new Date().toISOString().split('T')[0]);
  const [nominaDetalles, setNominaDetalles] = useState<RegistroNomina[]>([]);
  const [savingNomina, setSavingNomina] = useState(false);
  const [historialNomina, setHistorialNomina] = useState<RegistroNomina[]>([]);
  const [verHistorial, setVerHistorial] = useState(false);

  useEffect(() => {
    cargarEmpleados();
    // Default periodo description
    const today = new Date();
    const day = today.getDate();
    const month = today.toLocaleString('es-ES', { month: 'long' });
    const year = today.getFullYear();
    const quincena = day <= 15 ? "1era Quincena" : "2da Quincena";
    setNominaPeriodo(`${quincena} de ${month} ${year}`);
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

  // --- LOGICA PROCESAR NOMINA ---
  
  const prepararNomina = () => {
    const activos = empleados.filter(e => e.estado === 'ACTIVO');
    
    // Cálculo automático de deducciones (Ley Venezuela Standard)
    const registros: RegistroNomina[] = activos.map(emp => {
      const sueldo = emp.sueldoBase;
      const bono = emp.bono;
      
      // Deducciones sobre SUELDO BASE
      const sso = sueldo * 0.04;     // IVSS 4%
      const spf = sueldo * 0.005;    // Paro Forzoso 0.5%
      const faov = sueldo * 0.01;    // FAOV 1%
      
      const totalDeducciones = sso + spf + faov;
      const totalPagar = (sueldo + bono) - totalDeducciones;

      return {
        id: crypto.randomUUID(),
        empleadoId: emp.id,
        nombreCompleto: `${emp.nombres} ${emp.apellidos}`,
        cedula: emp.cedula,
        cargo: emp.cargo,
        periodo: nominaPeriodo,
        fechaPago: nominaFechaPago,
        sueldoBase: sueldo,
        bono: bono,
        asignacionesExtra: 0,
        deduccionSSO: parseFloat(sso.toFixed(2)),
        deduccionSPF: parseFloat(spf.toFixed(2)),
        deduccionFAOV: parseFloat(faov.toFixed(2)),
        otrasDeducciones: 0,
        totalPagar: parseFloat(totalPagar.toFixed(2))
      };
    });

    setNominaDetalles(registros);
    setVerHistorial(false);
  };

  const actualizarDetalleNomina = (id: string, campo: keyof RegistroNomina, valor: number) => {
    setNominaDetalles(prev => prev.map(reg => {
      if (reg.id === id) {
        const update = { ...reg, [campo]: valor };
        // Recalcular total
        const deducciones = (Number(update.deduccionSSO) || 0) + (Number(update.deduccionSPF) || 0) + (Number(update.deduccionFAOV) || 0) + (Number(update.otrasDeducciones) || 0);
        const asignaciones = (Number(update.sueldoBase) || 0) + (Number(update.bono) || 0) + (Number(update.asignacionesExtra) || 0);
        update.totalPagar = parseFloat((asignaciones - deducciones).toFixed(2));
        return update;
      }
      return reg;
    }));
  };

  const guardarNomina = async () => {
    if(!window.confirm(`¿Seguro que desea procesar y guardar la nómina de ${nominaDetalles.length} empleados?`)) return;

    setSavingNomina(true);
    try {
       await db.saveNominaBatch(nominaDetalles);
       alert("Nómina guardada exitosamente.");
       setNominaDetalles([]);
       setVerHistorial(true);
       cargarHistorialNomina();
    } catch(e) {
       console.error(e);
       alert("Error guardando la nómina.");
    } finally {
       setSavingNomina(false);
    }
  };

  const cargarHistorialNomina = async () => {
    setLoading(true);
    try {
      const data = await db.getNominaHistory();
      // Ordenar por fecha desc
      data.sort((a,b) => new Date(b.fechaPago).getTime() - new Date(a.fechaPago).getTime());
      setHistorialNomina(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const imprimirReciboNomina = async (reg: RegistroNomina) => {
      const doc = new jsPDF();
      const logo = await loadImage(LOGO_URL);
      if(logo) doc.addImage(logo, 'PNG', 15, 10, 20, 20);

      // Header
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("RECIBO DE PAGO DE NÓMINA", 105, 20, { align: 'center' });
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Período: ${reg.periodo}`, 105, 26, { align: 'center' });
      doc.text(`Fecha de Pago: ${reg.fechaPago}`, 105, 31, { align: 'center' });

      // Info Empleado
      doc.setFillColor(240, 240, 240);
      doc.rect(15, 40, 180, 20, 'F');
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(reg.nombreCompleto, 20, 48);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`Cédula: ${reg.cedula}`, 20, 54);
      doc.text(`Cargo: ${reg.cargo}`, 120, 48);
      doc.text(`Control: ${reg.id.substring(0,8)}`, 120, 54);

      // Tabla Detalles
      const bodyData = [
          ['Sueldo Base', `$${reg.sueldoBase.toFixed(2)}`, 'Seguro Social (IVSS 4%)', `$${reg.deduccionSSO.toFixed(2)}`],
          ['Bono / Primas', `$${reg.bono.toFixed(2)}`, 'Paro Forzoso (0.5%)', `$${reg.deduccionSPF.toFixed(2)}`],
          ['Asignaciones Extra', `$${reg.asignacionesExtra.toFixed(2)}`, 'FAOV (Vivienda 1%)', `$${reg.deduccionFAOV.toFixed(2)}`],
          ['', '', 'Otras Deducciones', `$${reg.otrasDeducciones.toFixed(2)}`]
      ];

      const totalAsignaciones = reg.sueldoBase + reg.bono + reg.asignacionesExtra;
      const totalDeducciones = reg.deduccionSSO + reg.deduccionSPF + reg.deduccionFAOV + reg.otrasDeducciones;

      autoTable(doc, {
          startY: 65,
          head: [['ASIGNACIONES', 'MONTO', 'DEDUCCIONES', 'MONTO']],
          body: bodyData,
          foot: [['TOTAL ASIGNACIONES', `$${totalAsignaciones.toFixed(2)}`, 'TOTAL DEDUCCIONES', `$${totalDeducciones.toFixed(2)}`]],
          theme: 'grid',
          headStyles: { fillColor: [60, 60, 60], halign: 'center' },
          columnStyles: { 1: { halign: 'right' }, 3: { halign: 'right' } },
          footStyles: { fillColor: [220, 220, 220], textColor: 20, fontStyle: 'bold', halign: 'right' }
      });

      const finalY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(`NETO A COBRAR: $${reg.totalPagar.toFixed(2)}`, 195, finalY, { align: 'right' });

      // Firmas
      const firmaY = finalY + 40;
      doc.setLineWidth(0.5);
      doc.line(30, firmaY, 90, firmaY);
      doc.setFontSize(9);
      doc.text("Firma del Empleado", 60, firmaY + 5, { align: 'center' });
      doc.text("Recibí Conforme", 60, firmaY + 10, { align: 'center' });

      doc.line(120, firmaY, 180, firmaY);
      doc.text("Administración", 150, firmaY + 5, { align: 'center' });

      doc.save(`Nomina_${reg.cedula}_${reg.fechaPago}.pdf`);
  };

  const handleSelectVacacionEmp = (empId: string) => {
      setVacacionEmpId(empId);
      const emp = empleados.find(e => e.id === empId);
      if(emp) {
          const fIngreso = new Date(emp.fechaIngreso);
          const now = new Date();
          let years = now.getFullYear() - fIngreso.getFullYear();
          if (now.getMonth() < fIngreso.getMonth()) years--;
          years = Math.max(0, years);
          const diasLegales = Math.min(30, 15 + years);
          setVacacionDiasDisfrute(diasLegales);
          setVacacionDiasBono(diasLegales);
          setVacacionSalarioDiario(0); 
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
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("RECIBO DE PAGO DE VACACIONES", 105, 25, { align: 'center' });
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Fecha de Emisión: ${new Date().toLocaleDateString()}`, 105, 32, { align: 'center' });
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
      doc.text(`Fecha Inicio Vacaciones: ${vacacionFechaInicio}`, 20, 80);
      doc.text(`Años de Servicio: ${resultadoVacaciones.yearsService}`, 120, 80);
      const tableData = [
          ['Días de Disfrute', `${vacacionDiasDisfrute} días`, `$${resultadoVacaciones.salarioDiario.toFixed(2)}`, `$${resultadoVacaciones.totalPagoDias.toFixed(2)}`],
          ['Bono Vacacional', `${vacacionDiasBono} días`, `$${resultadoVacaciones.salarioDiario.toFixed(2)}`, `$${resultadoVacaciones.totalBonoVacacional.toFixed(2)}`]
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
        
        <div className="flex gap-2 bg-gray-100 p-1 rounded-lg flex-wrap">
            <button 
                onClick={() => setActiveTab('PERSONAL')}
                className={`px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors ${activeTab === 'PERSONAL' ? 'bg-white shadow text-indigo-600' : 'text-gray-600 hover:text-gray-800'}`}
            >
                <Users size={16}/> Personal
            </button>
            <button 
                onClick={() => setActiveTab('PROCESAR')}
                className={`px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors ${activeTab === 'PROCESAR' ? 'bg-white shadow text-orange-600' : 'text-gray-600 hover:text-gray-800'}`}
            >
                <Settings size={16}/> Procesar Pago
            </button>
            <button 
                onClick={() => setActiveTab('VACACIONES')}
                className={`px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors ${activeTab === 'VACACIONES' ? 'bg-white shadow text-green-600' : 'text-gray-600 hover:text-gray-800'}`}
            >
                <Palmtree size={16}/> Vacaciones
            </button>
            <button 
                onClick={() => setActiveTab('CALCULADORA')}
                className={`px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors ${activeTab === 'CALCULADORA' ? 'bg-white shadow text-indigo-600' : 'text-gray-600 hover:text-gray-800'}`}
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

      {/* PROCESAR NOMINA */}
      {activeTab === 'PROCESAR' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex justify-between items-center mb-6">
                  <div>
                      <h3 className="text-lg font-bold text-gray-800">Carga de Nómina y Deducciones</h3>
                      <p className="text-sm text-gray-500">Genere los recibos para el período actual.</p>
                  </div>
                  <div className="flex gap-2">
                      <button onClick={() => { setVerHistorial(true); cargarHistorialNomina(); }} className="px-4 py-2 border rounded hover:bg-gray-50 text-sm">Ver Historial</button>
                  </div>
              </div>

              {!verHistorial ? (
                  <>
                      {/* Formulario de Configuración del Periodo */}
                      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-6 flex flex-wrap gap-4 items-end">
                          <div>
                              <label className="block text-xs font-bold text-gray-500 mb-1">Descripción del Período</label>
                              <input 
                                  type="text" 
                                  className="border rounded p-2 text-sm w-64" 
                                  value={nominaPeriodo} 
                                  onChange={e => setNominaPeriodo(e.target.value)}
                                  placeholder="Ej: 1era Quincena Septiembre 2025"
                              />
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-gray-500 mb-1">Fecha de Pago</label>
                              <input 
                                  type="date" 
                                  className="border rounded p-2 text-sm" 
                                  value={nominaFechaPago} 
                                  onChange={e => setNominaFechaPago(e.target.value)}
                              />
                          </div>
                          <button 
                              onClick={prepararNomina}
                              className="bg-indigo-600 text-white px-4 py-2 rounded text-sm font-bold hover:bg-indigo-700 h-[38px]"
                          >
                              Calcular Deducciones y Generar Tabla
                          </button>
                      </div>

                      {/* Tabla de Edición de Nómina */}
                      {nominaDetalles.length > 0 && (
                          <div className="space-y-4 animate-in fade-in">
                              <div className="overflow-x-auto border rounded-lg">
                                  <table className="w-full text-xs text-left">
                                      <thead className="bg-gray-100 text-gray-700 uppercase font-bold">
                                          <tr>
                                              <th className="px-4 py-2 min-w-[150px]">Empleado</th>
                                              <th className="px-2 py-2 text-right">Sueldo Base</th>
                                              <th className="px-2 py-2 text-right bg-blue-50">IVSS (4%)</th>
                                              <th className="px-2 py-2 text-right bg-blue-50">SPF (0.5%)</th>
                                              <th className="px-2 py-2 text-right bg-blue-50">FAOV (1%)</th>
                                              <th className="px-2 py-2 text-right bg-red-50">Otras Ded.</th>
                                              <th className="px-2 py-2 text-right bg-green-50">Asig. Extra</th>
                                              <th className="px-4 py-2 text-right font-bold text-indigo-700">NETO A PAGAR</th>
                                          </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-100">
                                          {nominaDetalles.map(reg => (
                                              <tr key={reg.id} className="hover:bg-gray-50">
                                                  <td className="px-4 py-2 font-medium">
                                                      {reg.nombreCompleto}
                                                      <div className="text-[10px] text-gray-400">{reg.cargo}</div>
                                                  </td>
                                                  <td className="px-2 py-2 text-right">${reg.sueldoBase}</td>
                                                  <td className="px-2 py-2 text-right bg-blue-50/30">${reg.deduccionSSO}</td>
                                                  <td className="px-2 py-2 text-right bg-blue-50/30">${reg.deduccionSPF}</td>
                                                  <td className="px-2 py-2 text-right bg-blue-50/30">${reg.deduccionFAOV}</td>
                                                  <td className="px-2 py-2 text-right bg-red-50/30">
                                                      <input 
                                                          type="number" 
                                                          className="w-16 border rounded p-1 text-right text-xs"
                                                          value={reg.otrasDeducciones}
                                                          onChange={e => actualizarDetalleNomina(reg.id, 'otrasDeducciones', Number(e.target.value))}
                                                      />
                                                  </td>
                                                  <td className="px-2 py-2 text-right bg-green-50/30">
                                                      <input 
                                                          type="number" 
                                                          className="w-16 border rounded p-1 text-right text-xs"
                                                          value={reg.asignacionesExtra}
                                                          onChange={e => actualizarDetalleNomina(reg.id, 'asignacionesExtra', Number(e.target.value))}
                                                      />
                                                  </td>
                                                  <td className="px-4 py-2 text-right font-bold text-indigo-700 text-sm">
                                                      ${reg.totalPagar}
                                                  </td>
                                              </tr>
                                          ))}
                                      </tbody>
                                  </table>
                              </div>
                              
                              <div className="flex justify-end p-4 bg-gray-50 rounded-lg border">
                                  <div className="text-right mr-6">
                                      <p className="text-xs text-gray-500">Total Empleados</p>
                                      <p className="font-bold">{nominaDetalles.length}</p>
                                  </div>
                                  <div className="text-right mr-6">
                                      <p className="text-xs text-gray-500">Total a Desembolsar</p>
                                      <p className="font-bold text-xl text-green-600">
                                          ${nominaDetalles.reduce((acc, curr) => acc + curr.totalPagar, 0).toFixed(2)}
                                      </p>
                                  </div>
                                  <button 
                                      onClick={guardarNomina}
                                      disabled={savingNomina}
                                      className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-green-700 flex items-center gap-2"
                                  >
                                      {savingNomina ? 'Procesando...' : <><Save size={18}/> Guardar y Cerrar Nómina</>}
                                  </button>
                              </div>
                          </div>
                      )}
                  </>
              ) : (
                  /* VISTA HISTORIAL */
                  <div className="animate-in fade-in">
                      <div className="flex justify-between items-center mb-4">
                          <h4 className="font-bold text-gray-700">Historial de Pagos Procesados</h4>
                          <button onClick={() => setVerHistorial(false)} className="text-sm text-indigo-600 underline">Volver a Procesar</button>
                      </div>
                      <div className="overflow-x-auto max-h-[500px]">
                          <table className="w-full text-sm text-left">
                              <thead className="bg-gray-100 text-xs uppercase">
                                  <tr>
                                      <th className="px-4 py-2">Fecha Pago</th>
                                      <th className="px-4 py-2">Periodo</th>
                                      <th className="px-4 py-2">Empleado</th>
                                      <th className="px-4 py-2 text-right">Monto</th>
                                      <th className="px-4 py-2 text-center">Recibo</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y">
                                  {historialNomina.map(h => (
                                      <tr key={h.id} className="hover:bg-gray-50">
                                          <td className="px-4 py-2 whitespace-nowrap">{h.fechaPago}</td>
                                          <td className="px-4 py-2">{h.periodo}</td>
                                          <td className="px-4 py-2 font-medium">{h.nombreCompleto}</td>
                                          <td className="px-4 py-2 text-right font-bold">${h.totalPagar.toFixed(2)}</td>
                                          <td className="px-4 py-2 text-center">
                                              <button onClick={() => imprimirReciboNomina(h)} className="text-gray-600 hover:text-indigo-600">
                                                  <Printer size={16}/>
                                              </button>
                                          </td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      </div>
                  </div>
              )}
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
    