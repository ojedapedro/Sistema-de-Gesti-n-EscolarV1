
import React, { useState } from 'react';
import { db } from '../services/db';
import { useAuth } from '../context/AuthContext';
import { Loader2, Lock, User as UserIcon, LogIn, AlertCircle, Eye, EyeOff, Mail, ArrowLeft } from 'lucide-react';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Estado para recuperación
  const [view, setView] = useState<'LOGIN' | 'RECOVER'>('LOGIN');
  const [recoverEmail, setRecoverEmail] = useState('');
  const [recoverMsg, setRecoverMsg] = useState('');

  const logoUrl = "https://i.ibb.co/FbHJbvVT/images.png";
  // Illustration URL (Usando un placeholder 3D similar a la referencia)
  const illustrationUrl = "https://img.freepik.com/free-psd/3d-render-avatar-character_23-2150611765.jpg?w=740&t=st=1708900000~exp=1708900600~hmac=example"; // Placeholder

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Por favor complete todos los campos');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const user = await db.login(email, password);
      login(user);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Credenciales inválidas');
    } finally {
      setLoading(false);
    }
  };

  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoverEmail) {
      setError('Ingrese su correo registrado');
      return;
    }
    setLoading(true);
    setError('');
    setRecoverMsg('');

    try {
      const res = await db.recoverPassword(recoverEmail);
      // db.ts ya maneja el error si status === 'error', por lo que si llegamos aquí es success.
      setRecoverMsg(res.message || 'Se ha enviado la contraseña a su correo electrónico.');
    } catch (err: any) {
      setError(err.message || 'Error al intentar recuperar contraseña.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#1e1e2d] flex items-center justify-center p-4 md:p-8">
      <div className="bg-[#151521] rounded-3xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col md:flex-row min-h-[600px] border border-gray-800">
        
        {/* Left Side - Illustration (Solo visible en desktop) */}
        <div className="hidden md:flex md:w-1/2 bg-[#1e1e2d] relative items-center justify-center p-12">
            {/* Background Circle Gradient */}
            <div className="absolute w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
            
            <div className="relative z-10 flex flex-col items-center">
                <img 
                  src={logoUrl} 
                  alt="Logo" 
                  className="w-24 h-24 object-contain mb-8 drop-shadow-lg"
                />
                
                {/* Simulated Floating Cards */}
                <div className="relative">
                    {/* Illustration - Using a generic 3D character placeholder that matches the style */}
                    <img 
                        src="https://img.freepik.com/free-psd/3d-illustration-human-avatar-profile_23-2150671142.jpg?size=626&ext=jpg" 
                        alt="3D Character" 
                        className="w-64 h-auto object-cover rounded-2xl shadow-2xl z-20 relative mix-blend-lighten"
                    />
                    
                    {/* Floating Card 1 */}
                    <div className="absolute -left-16 top-10 bg-white p-3 rounded-xl shadow-lg z-30 animate-bounce delay-700">
                        <div className="flex items-center gap-2 mb-1">
                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                            <span className="text-[10px] font-bold text-gray-700">Ingresos</span>
                        </div>
                        <div className="h-1 w-12 bg-gray-200 rounded mb-1"></div>
                        <div className="h-1 w-8 bg-gray-200 rounded"></div>
                    </div>

                    {/* Floating Card 2 */}
                    <div className="absolute -right-10 bottom-20 bg-white p-3 rounded-xl shadow-lg z-30 animate-pulse">
                        <div className="flex items-center gap-2 mb-1">
                            <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                            <span className="text-[10px] font-bold text-gray-700">Alumnos</span>
                        </div>
                        <div className="flex gap-1 mt-1">
                            <div className="h-4 w-1 bg-indigo-400 rounded-sm"></div>
                            <div className="h-6 w-1 bg-indigo-400 rounded-sm"></div>
                            <div className="h-3 w-1 bg-indigo-400 rounded-sm"></div>
                            <div className="h-5 w-1 bg-indigo-400 rounded-sm"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* Right Side - Form */}
        <div className="w-full md:w-1/2 p-8 md:p-16 flex flex-col justify-center bg-[#151521]">
            <div className="md:hidden flex justify-center mb-8">
                <img src={logoUrl} alt="Logo" className="w-16 h-16 object-contain" />
            </div>

            {view === 'LOGIN' ? (
                <div className="animate-in fade-in slide-in-from-right-8 duration-500">
                    <h2 className="text-3xl font-bold text-white mb-2">AdminPro</h2>
                    <p className="text-gray-400 mb-8 text-sm">Sistema de Gestión Administrativa Escolar</p>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-xl text-sm mb-6 flex items-center gap-2">
                            <AlertCircle size={18} />
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-5">
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1 ml-1">Correo Electrónico</label>
                            <div className="relative group">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-indigo-500 transition-colors" size={20} />
                                <input 
                                    type="email" 
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3.5 bg-[#1e1e2d] border border-gray-700 rounded-xl text-white placeholder-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                                    placeholder="usuario@colegio.com"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1 ml-1">Contraseña</label>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-indigo-500 transition-colors" size={20} />
                                <input 
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-12 pr-12 py-3.5 bg-[#1e1e2d] border border-gray-700 rounded-xl text-white placeholder-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                                    placeholder="••••••••"
                                />
                                <button 
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <div className="flex justify-between items-center text-xs mt-2">
                            <label className="flex items-center gap-2 text-gray-400 cursor-pointer hover:text-white">
                                <input type="checkbox" className="rounded bg-gray-700 border-gray-600 text-indigo-500 focus:ring-0" />
                                Recordarme
                            </label>
                            <button type="button" onClick={() => setView('RECOVER')} className="text-indigo-400 hover:text-indigo-300 font-medium">
                                ¿Olvidó su contraseña?
                            </button>
                        </div>

                        <button 
                            type="submit" 
                            disabled={loading}
                            className="w-full bg-indigo-600 text-white py-3.5 rounded-xl hover:bg-indigo-700 font-bold text-sm tracking-wide flex justify-center items-center gap-2 transition-all shadow-lg shadow-indigo-600/20 mt-4 active:scale-[0.98]"
                        >
                            {loading ? <Loader2 className="animate-spin" /> : 'Iniciar Sesión'}
                        </button>
                    </form>
                </div>
            ) : (
                /* VISTA RECUPERACIÓN */
                <div className="animate-in fade-in slide-in-from-right-8 duration-500">
                    <button 
                        onClick={() => setView('LOGIN')}
                        className="text-gray-400 hover:text-white flex items-center gap-2 text-sm mb-6 transition-colors"
                    >
                        <ArrowLeft size={16} /> Volver al Login
                    </button>

                    <h2 className="text-2xl font-bold text-white mb-2">Recuperar Acceso</h2>
                    <p className="text-gray-400 mb-8 text-sm">Ingrese su correo para recibir sus credenciales.</p>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-xl text-sm mb-6 flex items-center gap-2">
                            <AlertCircle size={18} />
                            {error}
                        </div>
                    )}

                    {recoverMsg && (
                        <div className="bg-green-500/10 border border-green-500/50 text-green-400 p-3 rounded-xl text-sm mb-6">
                            {recoverMsg}
                        </div>
                    )}

                    <form onSubmit={handleRecover} className="space-y-5">
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1 ml-1">Correo Registrado</label>
                            <div className="relative group">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-indigo-500 transition-colors" size={20} />
                                <input 
                                    type="email" 
                                    value={recoverEmail}
                                    onChange={(e) => setRecoverEmail(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3.5 bg-[#1e1e2d] border border-gray-700 rounded-xl text-white placeholder-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                                    placeholder="usuario@ejemplo.com"
                                />
                            </div>
                        </div>

                        <button 
                            type="submit" 
                            disabled={loading || !!recoverMsg}
                            className="w-full bg-indigo-600 text-white py-3.5 rounded-xl hover:bg-indigo-700 font-bold text-sm tracking-wide flex justify-center items-center gap-2 transition-all shadow-lg shadow-indigo-600/20 mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? <Loader2 className="animate-spin" /> : 'Enviar Credenciales'}
                        </button>
                    </form>
                </div>
            )}
            
            <p className="text-center text-xs text-gray-500 mt-10">
                v1.2 | AdminPro School Management
            </p>
        </div>
      </div>
    </div>
  );
};
