import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');

if (!rootElement) {
  console.error("Error crítico: No se encontró el elemento 'root' en el DOM.");
} else {
  try {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    console.log("Aplicación montada correctamente.");
  } catch (error) {
    console.error("Error al montar la aplicación React:", error);
    rootElement.innerHTML = '<div style="color: red; padding: 20px;">Error crítico al iniciar la aplicación. Revise la consola.</div>';
  }
}