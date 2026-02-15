
import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { User, UserRole } from '../types';
import { useAuth } from '../context/AuthContext';
import { Shield, Plus, Edit2, Trash2, Save, X, Loader2, User as UserIcon, Lock, Users, Mail, FileText } from 'lucide-react';

export const Usuarios: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [mensaje, setMensaje] = useState<{type: 'success' | 'error', text: string} | null>(null);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Partial<User>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    cargarUsuarios();
  }, []);

  const cargarUsuarios = async () => {
    setLoading(true);
    try {
      const data = await db.getUsers();
      setUsers(data);
    } catch (e) {
      console.error(e);
      setMensaje({ type: 'error', text: 'Error cargando usuarios' });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (userToEdit?: User) => {
    if (userToEdit) {
      setEditingUser(userToEdit);
    } else {
      setEditingUser({ rol: UserRole.CAJERO }); // Default
    }
    setIsModalOpen(true);
  };

  const handleDelete = async (email: string) => {
    if (email === currentUser?.email) {
      alert("No puedes eliminar tu propio usuario.");
      return;
    }
    if (window.confirm("¿Seguro que desea eliminar este usuario?")) {
      setLoading(true);
      try {
        await db.deleteUser(email);
        await cargarUsuarios();
        setMensaje({ type: 'success', text: 'Usuario eliminado' });
      } catch (e) {
        setMensaje({ type: 'error', text: 'Error eliminando usuario' });
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser.email || !editingUser.nombre || !editingUser.password || !editingUser.rol) {
      alert("Todos los campos obligatorios deben llenarse");
      return;
    }

    setSaving(true);
    try {
      await db.saveUser(editingUser as User);
      setIsModalOpen(false);
      await cargarUsuarios();
      setMensaje({ type: 'success', text: 'Datos guardados correctamente' });
    } catch (e) {
      console.error(e);
      setMensaje({ type: 'error', text: 'Error guardando usuario' });
    } finally {
      setSaving(false);
    }
  };

  // Protección de Acceso
  if (currentUser?.rol !== UserRole.ADMIN) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-gray-500">
        <Shield size={64} className="text-gray-300 mb-4" />
        <h2 className="text-xl font-bold">Acceso Restringido</h2>
        <p>Solo administradores pueden gestionar usuarios.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Users className="text-indigo-600" /> Personal Administrativo
          </h2>
          <p className="text-sm text-gray-500">Gestión de usuarios y permisos (Login con Email).</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-700 flex items-center gap-2 text-sm font-medium"
        >
          <Plus size={16} /> Nuevo Usuario
        </button>
      </div>

      {mensaje && (
        <div className={`p-4 rounded-lg border flex items-center gap-2 ${mensaje.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
           {mensaje.text}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
        {loading ? (
          <div className="flex justify-center p-12"><Loader2 className="animate-spin text-indigo-600" /></div>
        ) : (
          <table className="w-full text-sm text-left text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3">Usuario (Email)</th>
                <th className="px-6 py-3">Nombre</th>
                <th className="px-6 py-3">Cédula</th>
                <th className="px-6 py-3">Rol Asignado</th>
                <th className="px-6 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center">No hay usuarios registrados.</td></tr>
              ) : (
                users.map((u) => (
                  <tr key={u.email} className="bg-white border-b hover:bg-gray-50">
                    <td className="px-6 py-4 font-bold text-indigo-700">{u.email}</td>
                    <td className="px-6 py-4">{u.nombre}</td>
                    <td className="px-6 py-4 text-gray-500">{u.cedula || '-'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs border ${
                        u.rol === UserRole.ADMIN ? 'bg-indigo-50 border-indigo-200 text-indigo-700' :
                        u.rol === UserRole.AUXILIAR ? 'bg-blue-50 border-blue-200 text-blue-700' :
                        'bg-gray-50 border-gray-200 text-gray-700'
                      }`}>
                        {u.rol}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right flex justify-end gap-2">
                      <button onClick={() => handleOpenModal(u)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Edit2 size={16} /></button>
                      <button onClick={() => handleDelete(u.email)} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal Formulario */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-slate-800">
                {editingUser.token ? 'Editar Usuario' : 'Nuevo Usuario'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Correo Electrónico *</label>
                <div className="relative">
                   <Mail size={16} className="absolute left-3 top-3 text-gray-400" />
                   <input 
                      type="email" 
                      value={editingUser.email || ''}
                      onChange={e => setEditingUser({...editingUser, email: e.target.value})}
                      className="w-full pl-9 border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none"
                      placeholder="usuario@colegio.com"
                      // disabled={!!editingUser.token} // Permitir corregir email si es necesario
                   />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Completo *</label>
                <div className="relative">
                   <UserIcon size={16} className="absolute left-3 top-3 text-gray-400" />
                   <input 
                    type="text" 
                    value={editingUser.nombre || ''}
                    onChange={e => setEditingUser({...editingUser, nombre: e.target.value})}
                    className="w-full pl-9 border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="Ej: Juan Pérez"
                   />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cédula (Opcional)</label>
                <div className="relative">
                   <FileText size={16} className="absolute left-3 top-3 text-gray-400" />
                   <input 
                    type="text" 
                    value={editingUser.cedula || ''}
                    onChange={e => setEditingUser({...editingUser, cedula: e.target.value})}
                    className="w-full pl-9 border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="Ej: V-12345678"
                   />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rol / Privilegios *</label>
                <select 
                  value={editingUser.rol}
                  onChange={e => setEditingUser({...editingUser, rol: e.target.value as UserRole})}
                  className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  {Object.values(UserRole).map(role => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña *</label>
                <div className="relative">
                   <Lock size={16} className="absolute left-3 top-3 text-gray-400" />
                   <input 
                      type="text" 
                      value={editingUser.password || ''}
                      onChange={e => setEditingUser({...editingUser, password: e.target.value})}
                      className="w-full pl-9 border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm"
                      placeholder="Alfa-numérica"
                   />
                </div>
                <p className="text-[10px] text-gray-500 mt-1">
                   * La contraseña es visible para facilitar la administración.
                </p>
              </div>

              <div className="pt-4 flex gap-3">
                 <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200"
                 >
                   Cancelar
                 </button>
                 <button 
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 flex justify-center items-center gap-2"
                 >
                   {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                   Guardar
                 </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
