
import React from 'react';
import { LayoutDashboard, UserPlus, Banknote, FileCheck, FileText, Menu, Settings, BookOpen, LogOut, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';

interface SidebarProps {
  currentView: string;
  setView: (view: string) => void;
  isOpen: boolean;
  toggleSidebar: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, setView, isOpen, toggleSidebar }) => {
  const { user, logout, hasRole } = useAuth();

  const logoUrl = "https://i.ibb.co/FbHJbvVT/images.png";

  // Definir ítems y permisos
  const allMenuItems = [
    { 
      id: 'dashboard', 
      label: 'Dashboard', 
      icon: LayoutDashboard,
      roles: [UserRole.ADMIN, UserRole.AUXILIAR] 
    },
    { 
      id: 'registro', 
      label: 'Registro Alumnos', 
      icon: UserPlus,
      roles: [UserRole.ADMIN, UserRole.AUXILIAR]
    },
    { 
      id: 'pagos', 
      label: 'Caja / Pagos', 
      icon: Banknote,
      roles: [UserRole.ADMIN, UserRole.AUXILIAR, UserRole.CAJERO]
    },
    { 
      id: 'verificacion', 
      label: 'Verificación Pagos', 
      icon: FileCheck,
      roles: [UserRole.ADMIN, UserRole.AUXILIAR, UserRole.CAJERO]
    },
    { 
      id: 'libro', 
      label: 'Libro Contable', 
      icon: BookOpen,
      roles: [UserRole.ADMIN, UserRole.AUXILIAR, UserRole.CAJERO]
    },
    { 
      id: 'reportes', 
      label: 'Reportes', 
      icon: FileText,
      roles: [UserRole.ADMIN, UserRole.AUXILIAR]
    },
    { 
      id: 'usuarios', 
      label: 'Gestión Usuarios', 
      icon: Shield,
      roles: [UserRole.ADMIN]
    },
    { 
      id: 'configuracion', 
      label: 'Configuración', 
      icon: Settings,
      roles: [UserRole.ADMIN]
    },
  ];

  // Filtrar ítems visibles para el usuario actual
  const visibleItems = allMenuItems.filter(item => hasRole(item.roles));

  return (
    <>
      {/* Mobile Toggle */}
      <div className="md:hidden p-4 bg-indigo-900 text-white flex justify-between items-center sticky top-0 z-20 shadow-md">
        <div className="flex items-center gap-3">
          <img src={logoUrl} alt="Logo" className="h-10 w-10 bg-white rounded-full p-1 object-contain" />
          <h1 className="font-bold text-lg">AdminEscolar</h1>
        </div>
        <button onClick={toggleSidebar}>
          <Menu size={24} />
        </button>
      </div>

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 bg-slate-900 text-white w-64 transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 transition-transform duration-200 ease-in-out z-10 flex flex-col shadow-2xl`}>
        <div className="p-6 border-b border-slate-700 flex flex-col items-center text-center">
          <div className="h-24 w-24 bg-white rounded-full p-2 mb-4 flex items-center justify-center shadow-lg">
             <img src={logoUrl} alt="Logo Institucional" className="h-full w-full object-contain" />
          </div>
          <h1 className="text-xl font-bold text-indigo-400 tracking-wide">AdminPro</h1>
          
          <div className="mt-2 bg-slate-800 px-3 py-1 rounded-full border border-slate-600">
             <p className="text-xs text-slate-300 font-medium truncate max-w-[150px]">{user?.nombre}</p>
             <p className="text-[10px] text-indigo-400 uppercase tracking-wider">{user?.rol}</p>
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setView(item.id);
                  if (window.innerWidth < 768) toggleSidebar();
                }}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                  currentView === item.id 
                    ? 'bg-indigo-600 text-white shadow-lg' 
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-700">
          <button 
            onClick={logout}
            className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-red-900/30 text-red-400 hover:bg-red-900/50 rounded-lg transition-colors text-sm font-medium"
          >
            <LogOut size={16} />
            <span>Cerrar Sesión</span>
          </button>
          <div className="mt-3 text-[10px] text-slate-600 text-center">
             v1.1 | BD: Google Sheets
          </div>
        </div>
      </div>
    </>
  );
};
