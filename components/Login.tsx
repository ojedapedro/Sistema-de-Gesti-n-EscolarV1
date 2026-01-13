import React, { useState } from 'react';
import { db } from '../services/db';
import { useAuth } from '../context/AuthContext';
import { Loader2, Lock, User as UserIcon, LogIn, AlertCircle } from 'lucide-react';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const [cedula, setCedula] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cedula || !password) {
      setError('Ingrese cédula y contraseña');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const user = await db.login(cedula, password);
      login(user);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Credenciales inválidas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="bg-indigo-900 p-8 text-center">
            <div className="bg-white w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                <img src="https://i.ibb.co/FbHJbvVT/images.png" alt="Logo" className="w-16 h-16 object-contain" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-wide">AdminPro</h1>
            <p className="text-indigo-200 text-sm mt-1">Gestión Administrativa Escolar</p>
        </div>
        
        <div className="p-8">
            <h2 className="text-xl font-bold text-slate-800 mb-6 text-center">Iniciar Sesión</h2>
            
            {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-6 flex items-center gap-2 border border-red-100">
                    <AlertCircle size={18} />
                    {error}
                </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cédula / Usuario</label>
                    <div className="relative">
                        <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input 
                            type="text" 
                            value={cedula}
                            onChange={(e) => setCedula(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="Ingrese su cédula"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
                    <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input 
                            type="password" 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="••••••••"
                        />
                    </div>
                </div>

                <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 font-bold flex justify-center items-center gap-2 transition-all shadow-md hover:shadow-lg mt-4"
                >
                    {loading ? <Loader2 className="animate-spin" /> : <LogIn size={20} />}
                    {loading ? 'Accediendo...' : 'Entrar al Sistema'}
                </button>
            </form>
            
            <p className="text-center text-xs text-gray-400 mt-8">
                v1.1 | Acceso restringido a personal autorizado
            </p>
        </div>
      </div>
    </div>
  );
};