import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { RegistroAlumno } from './components/RegistroAlumno';
import { Pagos } from './components/Pagos';
import { Verificacion } from './components/Verificacion';
import { Reportes } from './components/Reportes';
import { Configuracion } from './components/Configuracion';
import { LibroContable } from './components/LibroContable';

function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const renderView = () => {
    switch (currentView) {
      case 'dashboard': return <Dashboard />;
      case 'registro': return <RegistroAlumno />;
      case 'pagos': return <Pagos />;
      case 'verificacion': return <Verificacion />;
      case 'libro': return <LibroContable />;
      case 'reportes': return <Reportes />;
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
}

export default App;