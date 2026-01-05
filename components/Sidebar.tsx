import React from 'react';
import { LayoutDashboard, UserPlus, Banknote, FileCheck, FileText, Menu, Settings, BookOpen } from 'lucide-react';

interface SidebarProps {
  currentView: string;
  setView: (view: string) => void;
  isOpen: boolean;
  toggleSidebar: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, setView, isOpen, toggleSidebar }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'registro', label: 'Registro Alumnos', icon: UserPlus },
    { id: 'pagos', label: 'Caja / Pagos', icon: Banknote },
    { id: 'verificacion', label: 'Verificación Pagos', icon: FileCheck },
    { id: 'libro', label: 'Libro Contable', icon: BookOpen },
    { id: 'reportes', label: 'Reportes', icon: FileText },
    { id: 'configuracion', label: 'Configuración', icon: Settings },
  ];

  const logoUrl = "https://i.ibb.co/FbHJbvVT/images.png";

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
          <p className="text-xs text-slate-400 mt-1 uppercase tracking-wider">Gestión Educativa</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {menuItems.map((item) => {
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

        <div className="p-4 border-t border-slate-700 text-xs text-slate-500 text-center">
          v1.0.1 | BD: Google Sheets
        </div>
      </div>
    </>
  );
};