
import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { RegistroAlumno } from './components/RegistroAlumno';
import { Pagos } from './components/Pagos';
import { Verificacion } from './components/Verificacion';
import { Reportes } from './components/Reportes';
import { Configuracion } from './components/Configuracion';
import { LibroContable } from './components/LibroContable';
import { Usuarios } from './components/Usuarios';
import { Almacen } from './components/Almacen';
import { Nomina } from './components/Nomina';
import { PagosServicios } from './components/PagosServicios';
import { Login } from './components/Login';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Loader2 } from 'lucide-react';

const AppContent: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [currentView, setCurrentView] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Si está cargando la sesión (leyendo localStorage), mostrar spinner
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-indigo-600" size={48} />
      </div>
    );
  }

  // Si no hay usuario, mostrar Login
  if (!user) {
    return <Login />;
  }

  // Router interno simple
  const renderView = () => {
    switch (currentView) {
      case 'dashboard': return <Dashboard />;
      case 'registro': return <RegistroAlumno />;
      case 'pagos': return <Pagos />;
      case 'verificacion': return <Verificacion />;
      case 'pagos_servicios': return <PagosServicios />;
      case 'almacen': return <Almacen />;
      case 'nomina': return <Nomina />;
      case 'libro': return <LibroContable />;
      case 'reportes': return <Reportes />;
      case 'usuarios': return <Usuarios />;
      case 'configuracion': return <Configuracion />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar 
        currentView={currentView} 
        setView={setCurrentView} 
        isOpen={sidebarOpen}
        toggleSidebar={() => setSidebarOpen(!sidebarOpen)}
      />
      
      <main className="flex-1 p-6 md:ml-64 transition-all duration-200">
        <div className="max-w-7xl mx-auto">
          {renderView()}
        </div>
      </main>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
