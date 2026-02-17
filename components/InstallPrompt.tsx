
import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

export const InstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      // Prevenir que Chrome muestre el prompt automáticamente (para controlarlo nosotros)
      e.preventDefault();
      // Guardar el evento para dispararlo después
      setDeferredPrompt(e);
      // Mostrar nuestra UI
      setIsVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Mostrar el prompt nativo
    deferredPrompt.prompt();

    // Esperar a que el usuario responda
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('Usuario aceptó la instalación');
    } else {
      console.log('Usuario rechazó la instalación');
    }

    // Limpiar
    setDeferredPrompt(null);
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-indigo-600 text-white p-4 rounded-xl shadow-2xl flex items-center gap-4 max-w-sm border border-indigo-400">
        <div className="bg-white/20 p-2 rounded-lg">
            <Download size={24} />
        </div>
        <div className="flex-1">
            <h4 className="font-bold text-sm">Instalar Aplicación</h4>
            <p className="text-xs text-indigo-100">Descarga AdminPro en tu escritorio para mejor experiencia.</p>
        </div>
        <div className="flex gap-2">
            <button 
                onClick={() => setIsVisible(false)}
                className="p-1 hover:bg-white/20 rounded text-indigo-200 hover:text-white transition-colors"
            >
                <X size={18} />
            </button>
            <button 
                onClick={handleInstallClick}
                className="bg-white text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-50 shadow-sm"
            >
                Instalar
            </button>
        </div>
      </div>
    </div>
  );
};
