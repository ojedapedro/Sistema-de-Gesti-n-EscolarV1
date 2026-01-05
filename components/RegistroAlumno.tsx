import React, { useState } from 'react';
import { db } from '../services/db';
import { NivelEducativo, Representante, Alumno } from '../types';
import { Plus, Save, User, Mail, MapPin, Phone, Loader2 } from 'lucide-react';
import { MENSUALIDADES } from '../constants';

export const RegistroAlumno: React.FC = () => {
  const [cedula, setCedula] = useState('');
  const [nombreRep, setNombreRep] = useState('');
  const [apellidoRep, setApellidoRep] = useState('');
  const [telefono, setTelefono] = useState('');
  const [correo, setCorreo] = useState('');
  const [direccion, setDireccion] = useState('');
  
  const [alumnos, setAlumnos] = useState<Omit<Alumno, 'id'>[]>([]);
  const [nombreAlu, setNombreAlu] = useState('');
  const [apellidoAlu, setApellidoAlu] = useState('');
  const [nivel, setNivel] = useState<NivelEducativo>(NivelEducativo.MATERNAL);
  const [seccion, setSeccion] = useState('A');

  const [mensaje, setMensaje] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAgregarAlumno = () => {
    if (!nombreAlu || !apellidoAlu) return;

    setAlumnos([
      ...alumnos,
      {
        nombres: nombreAlu,
        apellidos: apellidoAlu,
        nivel,
        seccion,
        mensualidad: MENSUALIDADES[nivel]
      }
    ]);

    setNombreAlu('');
    setApellidoAlu('');
    setNivel(NivelEducativo.MATERNAL);
  };

  const handleGuardarTodo = async () => {
    if (!cedula || !nombreRep || !telefono || alumnos.length === 0) {
      setMensaje({ type: 'error', text: 'Complete los datos obligatorios y agregue al menos un alumno.' });
      return;
    }

    setLoading(true);
    const matricula = db.generarMatricula(cedula);

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

    try {
      await db.saveRepresentante(nuevoRepresentante);
      setMensaje({ type: 'success', text: `Registro exitoso. Matrícula: ${matricula}` });
      setCedula('');
      setNombreRep('');
      setApellidoRep('');
      setTelefono('');
      setCorreo('');
      setDireccion('');
      setAlumnos([]);
    } catch (e) {
      setMensaje({ type: 'error', text: 'Error al conectar con la base de datos.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto bg-white p-8 rounded-xl shadow-sm border border-gray-100">
      <h2 className="text-2xl font-bold mb-6 text-slate-800 flex items-center gap-2">
        <User className="text-indigo-600" /> Nuevo Ingreso
      </h2>

      {mensaje && (
        <div className={`p-4 mb-6 rounded-lg ${mensaje.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {mensaje.text}
        </div>
      )}

      {/* Datos del Representante */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Cédula *</label>
          <input type="text" value={cedula} onChange={(e) => setCedula(e.target.value)} className="w-full border border-gray-300 rounded-md p-2" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono *</label>
          <input type="text" value={telefono} onChange={(e) => setTelefono(e.target.value)} className="w-full border border-gray-300 rounded-md p-2" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nombres *</label>
          <input type="text" value={nombreRep} onChange={(e) => setNombreRep(e.target.value)} className="w-full border border-gray-300 rounded-md p-2" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Apellidos *</label>
          <input type="text" value={apellidoRep} onChange={(e) => setApellidoRep(e.target.value)} className="w-full border border-gray-300 rounded-md p-2" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Correo</label>
          <input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} className="w-full border border-gray-300 rounded-md p-2" />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
          <input type="text" value={direccion} onChange={(e) => setDireccion(e.target.value)} className="w-full border border-gray-300 rounded-md p-2" />
        </div>
      </div>

      <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2 mt-8">Datos del Alumno</h3>
      <div className="bg-gray-50 p-6 rounded-lg mb-6 border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <input placeholder="Nombres" value={nombreAlu} onChange={(e) => setNombreAlu(e.target.value)} className="w-full border border-gray-300 rounded-md p-2" />
          <input placeholder="Apellidos" value={apellidoAlu} onChange={(e) => setApellidoAlu(e.target.value)} className="w-full border border-gray-300 rounded-md p-2" />
          <select value={nivel} onChange={(e) => setNivel(e.target.value as NivelEducativo)} className="w-full border border-gray-300 rounded-md p-2">
              {Object.values(NivelEducativo).map((niv) => <option key={niv} value={niv}>{niv}</option>)}
          </select>
          <input placeholder="Sección" value={seccion} onChange={(e) => setSeccion(e.target.value)} className="w-full border border-gray-300 rounded-md p-2" />
        </div>
        <button onClick={handleAgregarAlumno} className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-md hover:bg-slate-700 text-sm">
          <Plus size={16} /> Agregar Alumno
        </button>
      </div>

      {alumnos.length > 0 && (
        <div className="mb-8">
          <h4 className="font-medium text-gray-700 mb-2">Alumnos a registrar:</h4>
          <ul className="space-y-2">
            {alumnos.map((a, i) => (
              <li key={i} className="flex justify-between items-center bg-indigo-50 p-3 rounded border border-indigo-100">
                <span>{a.nombres} {a.apellidos} - {a.nivel}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button onClick={handleGuardarTodo} disabled={loading} className={`w-full flex justify-center items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 font-semibold shadow-md transition ${loading ? 'opacity-70' : ''}`}>
        {loading ? <Loader2 className="animate-spin" /> : <Save size={20} />}
        {loading ? 'Guardando...' : 'Registrar Familia'}
      </button>
    </div>
  );
};