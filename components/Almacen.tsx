
import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { ArticuloInventario, MovimientoInventario, CategoriaInsumo, TipoMovimiento } from '../types';
import { useAuth } from '../context/AuthContext';
import { Package, Plus, Minus, Search, History, AlertTriangle, ArrowRight, ArrowLeft, Archive, ShoppingCart, Filter, X, Printer, CheckCircle, FileText, Trash2, Save } from 'lucide-react';
import autoTable from 'jspdf-autotable';
import { jsPDF } from 'jspdf';
import { LOGO_URL } from '../constants';

// Helper Imagen
const loadImage = (url: string): Promise<string | null> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = url;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (ctx) { ctx.drawImage(img, 0, 0); resolve(canvas.toDataURL("image/png")); } 
      else { resolve(null); }
    };
    img.onerror = () => resolve(null);
  });
};

interface CartItem {
    id: string; // Temp ID
    articuloId: string;
    nombreArticulo: string;
    categoria: CategoriaInsumo;
    cantidad: number;
    precioUnitario: number;
    subtotal: number;
}

export const Almacen: React.FC = () => {
  const { user } = useAuth();
  
  const [view, setView] = useState<'INVENTARIO' | 'COMPRA' | 'REQUISICION' | 'HISTORIAL'>('INVENTARIO');
  const [articulos, setArticulos] = useState<ArticuloInventario[]>([]);
  const [movimientos, setMovimientos] = useState<MovimientoInventario[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros Inventario
  const [filtroCategoria, setFiltroCategoria] = useState<string>('TODAS');
  const [busqueda, setBusqueda] = useState('');

  // Filtros Historial (Auditoría)
  const [historialFechaInicio, setHistorialFechaInicio] = useState('');
  const [historialFechaFin, setHistorialFechaFin] = useState('');
  const [historialBusqueda, setHistorialBusqueda] = useState('');

  // Formulario Articulo Nuevo
  const [nuevoArticulo, setNuevoArticulo] = useState<Partial<ArticuloInventario>>({});
  const [mostrarFormArticulo, setMostrarFormArticulo] = useState(false);

  // Formulario Movimiento Simple (Para Salidas)
  const [movimientoForm, setMovimientoForm] = useState<Partial<MovimientoInventario>>({
    fecha: new Date().toISOString().split('T')[0]
  });

  // --- LOGICA CARRITO COMPRAS (FACTURA) ---
  const [cart, setCart] = useState<CartItem[]>([]);
  const [invoiceHeader, setInvoiceHeader] = useState({
      fecha: new Date().toISOString().split('T')[0],
      proveedor: '',
      referencia: ''
  });
  const [currentItem, setCurrentItem] = useState<{articuloId: string, cantidad: string, precio: string}>({
      articuloId: '',
      cantidad: '',
      precio: ''
  });
  const [aplicarIva, setAplicarIva] = useState(false);
  const IVA_RATE = 0.16;

  // Estado para el Modal de Verificación de Salida
  const [showReciboSalida, setShowReciboSalida] = useState(false);
  const [ultimoMovimiento, setUltimoMovimiento] = useState<MovimientoInventario | null>(null);

  useEffect(() => {
    cargarInventario();
  }, []);

  const cargarInventario = async () => {
    setLoading(true);
    try {
      const { articulos: arts, movimientos: movs } = await db.getInventarioData();
      
      // Calcular Stock Actual en el Frontend
      const articulosConStock = arts.map(art => {
         const entradas = movs.filter(m => m.articuloId === art.id && m.tipo === TipoMovimiento.ENTRADA).reduce((sum, m) => sum + m.cantidad, 0);
         const salidas = movs.filter(m => m.articuloId === art.id && m.tipo === TipoMovimiento.SALIDA).reduce((sum, m) => sum + m.cantidad, 0);
         return {
            ...art,
            stockCalculado: entradas - salidas
         };
      });

      setArticulos(articulosConStock);
      setMovimientos(movs.sort((a,b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()));
    } catch (e) {
      console.error(e);
      alert("Error cargando inventario");
    } finally {
      setLoading(false);
    }
  };

  const guardarArticulo = async () => {
    if(!nuevoArticulo.nombre || !nuevoArticulo.categoria || !nuevoArticulo.unidadMedida) {
      alert("Complete los campos obligatorios del artículo");
      return;
    }
    setLoading(true);
    try {
      const item: ArticuloInventario = {
        id: nuevoArticulo.id || crypto.randomUUID(),
        nombre: nuevoArticulo.nombre,
        categoria: nuevoArticulo.categoria as CategoriaInsumo,
        unidadMedida: nuevoArticulo.unidadMedida,
        stockMinimo: Number(nuevoArticulo.stockMinimo) || 0
      };
      await db.saveArticulo(item);
      setMostrarFormArticulo(false);
      setNuevoArticulo({});
      await cargarInventario(); // Recargar para actualizar listas
      alert("Artículo guardado correctamente");
    } catch(e) {
      alert("Error guardando artículo");
    } finally {
      setLoading(false);
    }
  };

  // --- LOGICA DE CARRITO (COMPRAS) ---
  const agregarItemAlCarrito = () => {
      if(!currentItem.articuloId || !currentItem.cantidad || !currentItem.precio) {
          alert("Seleccione un artículo, cantidad y precio."); return;
      }
      const cant = parseFloat(currentItem.cantidad);
      const prec = parseFloat(currentItem.precio);
      if(isNaN(cant) || cant <= 0) { alert("Cantidad inválida"); return; }
      if(isNaN(prec) || prec < 0) { alert("Precio inválido"); return; }

      const art = articulos.find(a => a.id === currentItem.articuloId);
      if(!art) return;

      const newItem: CartItem = {
          id: crypto.randomUUID(),
          articuloId: art.id,
          nombreArticulo: art.nombre,
          categoria: art.categoria,
          cantidad: cant,
          precioUnitario: prec,
          subtotal: cant * prec
      };

      setCart([...cart, newItem]);
      setCurrentItem({ articuloId: '', cantidad: '', precio: '' }); // Reset item inputs
  };

  const removerItemCarrito = (id: string) => {
      setCart(cart.filter(item => item.id !== id));
  };

  const guardarFacturaCompra = async () => {
      if(cart.length === 0) { alert("El carrito está vacío"); return; }
      if(!invoiceHeader.proveedor || !invoiceHeader.referencia) { alert("Indique proveedor y número de factura/referencia"); return; }

      setLoading(true);
      try {
          const movimientosBatch: MovimientoInventario[] = cart.map(item => {
              // Calcular IVA proporcional si aplica
              const itemTotal = aplicarIva ? item.subtotal * (1 + IVA_RATE) : item.subtotal;
              
              return {
                  id: crypto.randomUUID(),
                  fecha: invoiceHeader.fecha,
                  articuloId: item.articuloId,
                  nombreArticulo: item.nombreArticulo,
                  categoria: item.categoria,
                  tipo: TipoMovimiento.ENTRADA,
                  cantidad: item.cantidad,
                  solicitanteOProveedor: invoiceHeader.proveedor,
                  motivo: `Factura ${invoiceHeader.referencia}`, // Agrupar por Ref
                  usuarioRegistra: user?.nombre || 'Admin',
                  costoTotal: parseFloat(itemTotal.toFixed(2)),
                  precioUnitario: item.precioUnitario
              };
          });

          await db.saveMovimientoBatch(movimientosBatch);
          
          alert("Factura cargada correctamente. Inventario actualizado.");
          setCart([]);
          setInvoiceHeader({ ...invoiceHeader, proveedor: '', referencia: '' });
          await cargarInventario();
          setView('INVENTARIO');

      } catch(e) {
          console.error(e);
          alert("Error guardando la factura.");
      } finally {
          setLoading(false);
      }
  };

  // --- LOGICA DE SALIDAS (REQUISICION) ---
  const procesarSalida = async () => {
    if (!movimientoForm.articuloId || !movimientoForm.cantidad || !movimientoForm.solicitanteOProveedor || !movimientoForm.motivo) {
        alert("Todos los campos son obligatorios.");
        return;
    }

    const art = articulos.find(a => a.id === movimientoForm.articuloId);
    if (art && (art.stockCalculado || 0) < Number(movimientoForm.cantidad)) {
        alert(`Stock insuficiente. Disponible: ${art.stockCalculado}`);
        return;
    }

    setLoading(true);
    try {
        const nuevoMov: MovimientoInventario = {
            id: crypto.randomUUID(),
            fecha: movimientoForm.fecha || new Date().toISOString().split('T')[0],
            articuloId: movimientoForm.articuloId!,
            nombreArticulo: art?.nombre || 'Desconocido',
            categoria: art?.categoria || CategoriaInsumo.OTROS,
            tipo: TipoMovimiento.SALIDA,
            cantidad: Number(movimientoForm.cantidad),
            solicitanteOProveedor: movimientoForm.solicitanteOProveedor!,
            motivo: movimientoForm.motivo!,
            usuarioRegistra: user?.nombre || 'Admin',
            costoTotal: 0,
            precioUnitario: 0
        };

        await db.saveMovimiento(nuevoMov);
        setMovimientoForm({ fecha: new Date().toISOString().split('T')[0] }); 
        await cargarInventario();

        setUltimoMovimiento(nuevoMov);
        setShowReciboSalida(true);

    } catch(e) {
        console.error(e);
        alert("Error registrando movimiento");
    } finally {
        setLoading(false);
    }
  };

  const generarPDFInventario = async () => {
    const doc = new jsPDF();
    const logo = await loadImage(LOGO_URL);
    if(logo) doc.addImage(logo, 'PNG', 170, 10, 25, 25);
    
    doc.setFontSize(16);
    doc.text("Reporte de Inventario General", 14, 20);
    doc.setFontSize(10);
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 14, 26);
    doc.text(`Categoría: ${filtroCategoria}`, 14, 32);

    const data = articulosFiltrados.map(a => [
        a.categoria,
        a.nombre,
        a.unidadMedida,
        a.stockCalculado,
        a.stockMinimo,
        (a.stockCalculado || 0) <= a.stockMinimo ? 'BAJO' : 'OK'
    ]);

    autoTable(doc, {
        startY: 40,
        head: [['Categoría', 'Artículo', 'Unidad', 'Stock Actual', 'Mínimo', 'Estado']],
        body: data,
        didParseCell: (data) => {
             if (data.section === 'body' && data.column.index === 5) {
                 if (data.cell.raw === 'BAJO') data.cell.styles.textColor = [200, 0, 0];
             }
        }
    });
    doc.save("inventario_actual.pdf");
  };

  // Imprimir Comprobante de Salida (Con Firmas)
  const imprimirComprobanteSalida = async () => {
    if(!ultimoMovimiento) return;

    const doc = new jsPDF();
    const logo = await loadImage(LOGO_URL);
    if(logo) doc.addImage(logo, 'PNG', 15, 10, 25, 25);

    // Header
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("COMPROBANTE DE SALIDA DE ALMACÉN", 105, 25, { align: 'center' });
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Fecha: ${ultimoMovimiento.fecha}`, 105, 32, { align: 'center' });
    doc.text(`Control N°: ${ultimoMovimiento.id.substring(0,8).toUpperCase()}`, 105, 38, { align: 'center' });

    doc.setLineWidth(0.5);
    doc.line(15, 45, 195, 45);

    // Detalles
    doc.setFontSize(12);
    doc.text("Detalles de la Requisición:", 15, 55);
    
    const detailsData = [
        ['Artículo / Insumo', ultimoMovimiento.nombreArticulo],
        ['Categoría', ultimoMovimiento.categoria],
        ['Cantidad Entregada', String(ultimoMovimiento.cantidad)],
        ['Solicitado Por', ultimoMovimiento.solicitanteOProveedor],
        ['Departamento / Motivo', ultimoMovimiento.motivo],
        ['Registrado por (Sistema)', ultimoMovimiento.usuarioRegistra],
    ];

    autoTable(doc, {
        startY: 60,
        head: [['Concepto', 'Descripción']],
        body: detailsData,
        theme: 'grid',
        headStyles: { fillColor: [220, 220, 220], textColor: 20 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 } }
    });

    // Zona de Firmas
    const finalY = (doc as any).lastAutoTable.finalY + 40;
    
    doc.setFontSize(10);
    
    // Firma 1: Almacenista
    doc.line(20, finalY, 80, finalY);
    doc.text("Entregado Por (Almacén)", 50, finalY + 5, { align: 'center' });
    doc.text(`${ultimoMovimiento.usuarioRegistra}`, 50, finalY + 10, { align: 'center' });

    // Firma 2: Solicitante
    doc.line(130, finalY, 190, finalY);
    doc.text("Recibido Conforme", 160, finalY + 5, { align: 'center' });
    doc.text(`${ultimoMovimiento.solicitanteOProveedor}`, 160, finalY + 10, { align: 'center' });

    // Footer
    doc.setFontSize(8);
    doc.text("Este documento certifica la salida de inventario y la recepción conforme del material.", 105, 280, { align: 'center' });

    doc.save(`Salida_Almacen_${ultimoMovimiento.id.substring(0,4)}.pdf`);
  };

  const articulosFiltrados = articulos.filter(a => {
    const matchCat = filtroCategoria === 'TODAS' || a.categoria === filtroCategoria;
    const matchSearch = a.nombre.toLowerCase().includes(busqueda.toLowerCase());
    return matchCat && matchSearch;
  });

  // Lógica Filtrado Historial
  const movimientosFiltrados = movimientos.filter(m => {
      const matchProd = m.nombreArticulo.toLowerCase().includes(historialBusqueda.toLowerCase());
      
      let matchFecha = true;
      if (historialFechaInicio) matchFecha = matchFecha && m.fecha >= historialFechaInicio;
      if (historialFechaFin) matchFecha = matchFecha && m.fecha <= historialFechaFin;

      return matchProd && matchFecha;
  });

  // Cálculos de Totales del Carrito
  const subtotalCarrito = cart.reduce((acc, item) => acc + item.subtotal, 0);
  const montoIVA = aplicarIva ? subtotalCarrito * IVA_RATE : 0;
  const totalFactura = subtotalCarrito + montoIVA;

  // --- UI RENDER ---

  if(loading && articulos.length === 0) return <div className="flex justify-center p-12 text-indigo-600">Cargando inventario...</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
       
       {/* HEADER & TABS */}
       <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
              <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                 <Package className="text-indigo-600" /> Gestión de Almacén
              </h2>
          </div>
          <div className="flex bg-slate-100 p-1 rounded-lg">
              <button onClick={() => setView('INVENTARIO')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${view === 'INVENTARIO' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Inventario</button>
              <button onClick={() => setView('COMPRA')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${view === 'COMPRA' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>+ Compras</button>
              <button onClick={() => setView('REQUISICION')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${view === 'REQUISICION' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>- Salidas</button>
              <button onClick={() => setView('HISTORIAL')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${view === 'HISTORIAL' ? 'bg-white text-slate-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Auditoría</button>
          </div>
       </div>

       {/* VIEW: INVENTARIO */}
       {view === 'INVENTARIO' && (
           <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
               <div className="flex flex-col md:flex-row gap-4 justify-between mb-6">
                   <div className="flex gap-4 flex-1">
                       <div className="relative flex-1 max-w-xs">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
                          <input 
                            type="text" 
                            placeholder="Buscar artículo..." 
                            value={busqueda} 
                            onChange={e => setBusqueda(e.target.value)}
                            className="pl-9 w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                          />
                       </div>
                       <select 
                         value={filtroCategoria} 
                         onChange={e => setFiltroCategoria(e.target.value)}
                         className="border border-gray-300 rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-indigo-500"
                       >
                           <option value="TODAS">Todas las Categorías</option>
                           {Object.values(CategoriaInsumo).map(c => <option key={c} value={c}>{c}</option>)}
                       </select>
                   </div>
                   <div className="flex gap-2">
                       <button onClick={() => setMostrarFormArticulo(!mostrarFormArticulo)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-indigo-700">
                           <Plus size={16} /> Nuevo Artículo
                       </button>
                       <button onClick={generarPDFInventario} className="bg-slate-100 text-slate-600 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-slate-200">
                           <Archive size={16} /> PDF
                       </button>
                   </div>
               </div>

               {/* Formulario Inline Nuevo Articulo */}
               {mostrarFormArticulo && (
                   <div className="bg-indigo-50 p-4 rounded-lg mb-6 border border-indigo-100 animate-in fade-in slide-in-from-top-2">
                       <h3 className="font-bold text-indigo-800 text-sm mb-3">Definir Nuevo Artículo de Inventario</h3>
                       <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-3">
                           <input type="text" placeholder="Nombre del Artículo" className="md:col-span-2 p-2 rounded border text-sm" value={nuevoArticulo.nombre || ''} onChange={e => setNuevoArticulo({...nuevoArticulo, nombre: e.target.value})} />
                           <select className="p-2 rounded border text-sm" value={nuevoArticulo.categoria || ''} onChange={e => setNuevoArticulo({...nuevoArticulo, categoria: e.target.value as CategoriaInsumo})}>
                               <option value="">Seleccione Categoría</option>
                               {Object.values(CategoriaInsumo).map(c => <option key={c} value={c}>{c}</option>)}
                           </select>
                           <select className="p-2 rounded border text-sm" value={nuevoArticulo.unidadMedida || ''} onChange={e => setNuevoArticulo({...nuevoArticulo, unidadMedida: e.target.value})}>
                               <option value="">Unidad Medida</option>
                               <option value="Unidad">Unidad</option>
                               <option value="Caja">Caja</option>
                               <option value="Paquete">Paquete</option>
                               <option value="Litro">Litro</option>
                               <option value="Kg">Kg</option>
                               <option value="Par">Par</option>
                           </select>
                           <input type="number" placeholder="Stock Mínimo" className="p-2 rounded border text-sm" value={nuevoArticulo.stockMinimo || ''} onChange={e => setNuevoArticulo({...nuevoArticulo, stockMinimo: Number(e.target.value)})} />
                       </div>
                       <div className="flex justify-end gap-2">
                           <button onClick={() => setMostrarFormArticulo(false)} className="px-3 py-1 text-sm text-gray-500 hover:text-gray-700">Cancelar</button>
                           <button onClick={guardarArticulo} className="px-3 py-1 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700">Guardar Definición</button>
                       </div>
                   </div>
               )}

               {/* Tabla Inventario */}
               <div className="overflow-x-auto">
                   <table className="w-full text-sm text-left text-gray-500">
                       <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                           <tr>
                               <th className="px-6 py-3">Artículo</th>
                               <th className="px-6 py-3">Categoría</th>
                               <th className="px-6 py-3 text-center">Unidad</th>
                               <th className="px-6 py-3 text-right">Stock Actual</th>
                               <th className="px-6 py-3 text-center">Estado</th>
                           </tr>
                       </thead>
                       <tbody className="divide-y divide-gray-100">
                           {articulosFiltrados.map(art => (
                               <tr key={art.id} className="hover:bg-gray-50">
                                   <td className="px-6 py-4 font-medium text-slate-800">{art.nombre}</td>
                                   <td className="px-6 py-4"><span className="bg-slate-100 px-2 py-1 rounded text-xs">{art.categoria}</span></td>
                                   <td className="px-6 py-4 text-center">{art.unidadMedida}</td>
                                   <td className="px-6 py-4 text-right font-mono font-bold text-lg">{art.stockCalculado}</td>
                                   <td className="px-6 py-4 text-center">
                                       {(art.stockCalculado || 0) <= art.stockMinimo ? (
                                           <span className="text-red-600 flex items-center justify-center gap-1 text-xs font-bold"><AlertTriangle size={12}/> BAJO</span>
                                       ) : (
                                           <span className="text-green-600 text-xs font-bold">OK</span>
                                       )}
                                   </td>
                               </tr>
                           ))}
                           {articulosFiltrados.length === 0 && (
                               <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400">No hay artículos registrados en esta categoría.</td></tr>
                           )}
                       </tbody>
                   </table>
               </div>
           </div>
       )}

       {/* VIEW: COMPRAS (ENTRADAS MULTIPLES - FACTURA) */}
       {view === 'COMPRA' && (
           <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
               <h3 className="text-xl font-bold text-green-700 mb-6 flex items-center gap-2">
                   <ShoppingCart /> Carga de Factura de Compra
               </h3>
               
               {/* 1. Cabecera de Factura */}
               <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                   <div>
                       <label className="block text-xs font-bold text-gray-500 mb-1">Fecha Factura</label>
                       <input 
                           type="date" 
                           className="w-full border p-2 rounded text-sm" 
                           value={invoiceHeader.fecha} 
                           onChange={e => setInvoiceHeader({...invoiceHeader, fecha: e.target.value})} 
                       />
                   </div>
                   <div>
                       <label className="block text-xs font-bold text-gray-500 mb-1">Proveedor</label>
                       <input 
                           type="text" 
                           className="w-full border p-2 rounded text-sm" 
                           placeholder="Ej: Office Depot" 
                           value={invoiceHeader.proveedor} 
                           onChange={e => setInvoiceHeader({...invoiceHeader, proveedor: e.target.value})} 
                       />
                   </div>
                   <div>
                       <label className="block text-xs font-bold text-gray-500 mb-1">Nro. Factura / Referencia</label>
                       <input 
                           type="text" 
                           className="w-full border p-2 rounded text-sm" 
                           placeholder="Ej: FAC-00123" 
                           value={invoiceHeader.referencia} 
                           onChange={e => setInvoiceHeader({...invoiceHeader, referencia: e.target.value})} 
                       />
                   </div>
               </div>

               {/* 2. Formulario Agregar Item */}
               <div className="border-b border-gray-200 pb-6 mb-6">
                   <h4 className="font-bold text-gray-700 mb-3 text-sm">Agregar Artículos</h4>
                   <div className="flex flex-wrap gap-4 items-end">
                       <div className="flex-1 min-w-[200px]">
                           <label className="block text-xs font-bold text-gray-500 mb-1">Artículo</label>
                           <select 
                               className="w-full border p-2 rounded text-sm"
                               value={currentItem.articuloId}
                               onChange={e => setCurrentItem({...currentItem, articuloId: e.target.value})}
                           >
                               <option value="">-- Seleccione --</option>
                               {articulos.map(a => (
                                   <option key={a.id} value={a.id}>{a.nombre} ({a.unidadMedida})</option>
                               ))}
                           </select>
                       </div>
                       <div className="w-24">
                           <label className="block text-xs font-bold text-gray-500 mb-1">Cantidad</label>
                           <input 
                               type="number" 
                               min="1" 
                               className="w-full border p-2 rounded text-sm text-center" 
                               value={currentItem.cantidad} 
                               onChange={e => setCurrentItem({...currentItem, cantidad: e.target.value})} 
                           />
                       </div>
                       <div className="w-32">
                           <label className="block text-xs font-bold text-gray-500 mb-1">Precio Unit. ($)</label>
                           <input 
                               type="number" 
                               min="0" 
                               className="w-full border p-2 rounded text-sm text-right" 
                               placeholder="0.00"
                               value={currentItem.precio} 
                               onChange={e => setCurrentItem({...currentItem, precio: e.target.value})} 
                           />
                       </div>
                       <button 
                           onClick={agregarItemAlCarrito}
                           className="bg-slate-800 text-white px-4 py-2 rounded text-sm font-bold hover:bg-slate-700 flex items-center gap-1 h-[38px]"
                       >
                           <Plus size={16}/> Agregar
                       </button>
                   </div>
                   <p className="text-xs text-gray-400 mt-2">
                       ¿No aparece el artículo? <button onClick={() => setView('INVENTARIO')} className="text-indigo-600 underline">Créalo en Inventario</button> primero.
                   </p>
               </div>

               {/* 3. Tabla Carrito */}
               <div className="mb-6">
                   <table className="w-full text-sm text-left">
                       <thead className="bg-gray-100 text-xs uppercase font-bold text-gray-600">
                           <tr>
                               <th className="px-4 py-2">Artículo</th>
                               <th className="px-4 py-2 text-center">Cant.</th>
                               <th className="px-4 py-2 text-right">Precio Unit.</th>
                               <th className="px-4 py-2 text-right">Subtotal</th>
                               <th className="px-4 py-2 text-center"></th>
                           </tr>
                       </thead>
                       <tbody className="divide-y">
                           {cart.map(item => (
                               <tr key={item.id} className="hover:bg-gray-50">
                                   <td className="px-4 py-2">{item.nombreArticulo}</td>
                                   <td className="px-4 py-2 text-center">{item.cantidad}</td>
                                   <td className="px-4 py-2 text-right">${item.precioUnitario.toFixed(2)}</td>
                                   <td className="px-4 py-2 text-right font-bold">${item.subtotal.toFixed(2)}</td>
                                   <td className="px-4 py-2 text-center">
                                       <button onClick={() => removerItemCarrito(item.id)} className="text-red-500 hover:text-red-700">
                                           <Trash2 size={16} />
                                       </button>
                                   </td>
                               </tr>
                           ))}
                           {cart.length === 0 && (
                               <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400 italic">No hay artículos agregados a la factura.</td></tr>
                           )}
                       </tbody>
                   </table>
               </div>

               {/* 4. Totales y Guardar */}
               <div className="flex flex-col items-end gap-2 border-t pt-4">
                   <div className="flex justify-between w-full md:w-1/3 text-sm">
                       <span className="text-gray-600">Subtotal:</span>
                       <span className="font-bold">${subtotalCarrito.toFixed(2)}</span>
                   </div>
                   <div className="flex justify-between w-full md:w-1/3 text-sm items-center">
                       <label className="flex items-center gap-2 cursor-pointer select-none">
                           <input type="checkbox" checked={aplicarIva} onChange={e => setAplicarIva(e.target.checked)} className="rounded text-indigo-600"/>
                           <span className="text-gray-600">IVA ({IVA_RATE * 100}%):</span>
                       </label>
                       <span className="font-bold">${montoIVA.toFixed(2)}</span>
                   </div>
                   <div className="flex justify-between w-full md:w-1/3 text-lg font-bold text-indigo-700 border-t border-indigo-100 pt-2 mt-2">
                       <span>Total Factura:</span>
                       <span>${totalFactura.toFixed(2)}</span>
                   </div>

                   <button 
                       onClick={guardarFacturaCompra}
                       disabled={loading || cart.length === 0}
                       className="mt-4 bg-green-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-green-700 flex items-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                   >
                       {loading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : <Save size={20}/>}
                       Procesar Factura y Cargar Stock
                   </button>
               </div>
           </div>
       )}

       {/* VIEW: REQUISICION (SALIDAS) */}
       {view === 'REQUISICION' && (
           <div className="max-w-2xl mx-auto bg-white p-8 rounded-xl shadow-sm border border-gray-100">
               <h3 className="text-xl font-bold text-orange-700 mb-6 flex items-center gap-2">
                   <Archive /> Registrar Requisición / Salida
               </h3>
               
               <div className="space-y-4">
                   <div>
                       <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Salida</label>
                       <input type="date" className="w-full border p-2 rounded" value={movimientoForm.fecha} onChange={e => setMovimientoForm({...movimientoForm, fecha: e.target.value})} />
                   </div>
                   <div>
                       <label className="block text-sm font-medium text-gray-700 mb-1">Seleccionar Artículo a Retirar</label>
                       <select 
                         className="w-full border p-2 rounded"
                         value={movimientoForm.articuloId || ''}
                         onChange={e => setMovimientoForm({...movimientoForm, articuloId: e.target.value})}
                       >
                           <option value="">-- Seleccione Insumo --</option>
                           {articulos.map(a => (
                               <option key={a.id} value={a.id} disabled={(a.stockCalculado || 0) <= 0}>
                                   {a.nombre} (Disp: {a.stockCalculado})
                               </option>
                           ))}
                       </select>
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                       <div>
                           <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad a Retirar</label>
                           <input type="number" min="1" className="w-full border p-2 rounded font-bold" value={movimientoForm.cantidad || ''} onChange={e => setMovimientoForm({...movimientoForm, cantidad: Number(e.target.value)})} />
                       </div>
                       <div>
                           <label className="block text-sm font-medium text-gray-700 mb-1">Solicitante (Persona)</label>
                           <input type="text" className="w-full border p-2 rounded" placeholder="Ej: Profe. María" value={movimientoForm.solicitanteOProveedor || ''} onChange={e => setMovimientoForm({...movimientoForm, solicitanteOProveedor: e.target.value})} />
                       </div>
                   </div>
                   <div>
                       <label className="block text-sm font-medium text-gray-700 mb-1">Departamento / Motivo</label>
                       <input type="text" className="w-full border p-2 rounded" placeholder="Ej: Mantenimiento Baños PB" value={movimientoForm.motivo || ''} onChange={e => setMovimientoForm({...movimientoForm, motivo: e.target.value})} />
                   </div>

                   <button 
                     onClick={procesarSalida}
                     disabled={loading}
                     className="w-full bg-orange-600 text-white py-3 rounded-lg font-bold hover:bg-orange-700 mt-4 flex justify-center items-center gap-2"
                   >
                       <ArrowLeft size={20} /> Registrar Salida de Almacén
                   </button>
               </div>
           </div>
       )}

       {/* VIEW: HISTORIAL AUDITABLE */}
       {view === 'HISTORIAL' && (
           <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
               <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><History size={20}/> Auditoría de Movimientos</h3>
               
               {/* BARRA DE FILTROS */}
               <div className="flex flex-col md:flex-row gap-4 mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <div className="flex-1">
                        <label className="block text-xs font-bold text-gray-500 mb-1">Buscar Producto / Insumo</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
                            <input 
                                type="text" 
                                placeholder="Nombre del insumo..." 
                                value={historialBusqueda}
                                onChange={e => setHistorialBusqueda(e.target.value)}
                                className="pl-9 w-full border border-gray-300 rounded p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Desde Fecha</label>
                        <input 
                            type="date" 
                            value={historialFechaInicio}
                            onChange={e => setHistorialFechaInicio(e.target.value)}
                            className="border border-gray-300 rounded p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Hasta Fecha</label>
                        <input 
                            type="date" 
                            value={historialFechaFin}
                            onChange={e => setHistorialFechaFin(e.target.value)}
                            className="border border-gray-300 rounded p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                    <div className="flex items-end">
                        <button 
                            onClick={() => { setHistorialBusqueda(''); setHistorialFechaInicio(''); setHistorialFechaFin(''); }}
                            className="bg-white border border-gray-300 text-gray-600 px-4 py-2 rounded text-sm hover:bg-gray-100 flex items-center gap-2 h-[38px]"
                        >
                            <X size={16} /> Limpiar
                        </button>
                    </div>
               </div>

               <div className="overflow-x-auto max-h-[600px]">
                   <table className="w-full text-sm text-left text-gray-500">
                       <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0">
                           <tr>
                               <th className="px-6 py-3">Fecha</th>
                               <th className="px-6 py-3">Tipo</th>
                               <th className="px-6 py-3">Artículo</th>
                               <th className="px-6 py-3 text-right">Cant.</th>
                               <th className="px-6 py-3 text-right">Costo Total ($)</th>
                               <th className="px-6 py-3">Responsable / Prov.</th>
                               <th className="px-6 py-3">Motivo</th>
                               <th className="px-6 py-3">Usuario Reg.</th>
                           </tr>
                       </thead>
                       <tbody className="divide-y divide-gray-100">
                           {movimientosFiltrados.map(mov => (
                               <tr key={mov.id} className="hover:bg-gray-50">
                                   <td className="px-6 py-4 whitespace-nowrap">{mov.fecha}</td>
                                   <td className="px-6 py-4">
                                       <span className={`px-2 py-1 rounded text-xs font-bold ${mov.tipo === TipoMovimiento.ENTRADA ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                           {mov.tipo === TipoMovimiento.ENTRADA ? 'ENTRADA' : 'SALIDA'}
                                       </span>
                                   </td>
                                   <td className="px-6 py-4 font-medium">{mov.nombreArticulo}</td>
                                   <td className="px-6 py-4 text-right font-mono text-gray-800 font-bold">{mov.cantidad}</td>
                                   <td className="px-6 py-4 text-right font-mono text-gray-800">
                                       {mov.costoTotal ? `$${mov.costoTotal.toFixed(2)}` : '-'}
                                   </td>
                                   <td className="px-6 py-4">{mov.solicitanteOProveedor}</td>
                                   <td className="px-6 py-4 text-xs">{mov.motivo}</td>
                                   <td className="px-6 py-4 text-xs text-gray-400">{mov.usuarioRegistra}</td>
                               </tr>
                           ))}
                           {movimientosFiltrados.length === 0 && (
                               <tr>
                                   <td colSpan={8} className="text-center py-8 text-gray-400">
                                       No se encontraron movimientos con los filtros seleccionados.
                                   </td>
                               </tr>
                           )}
                       </tbody>
                   </table>
               </div>
           </div>
       )}

       {/* MODAL VERIFICACIÓN DE REQUISICIÓN */}
       {showReciboSalida && ultimoMovimiento && (
           <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
               <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl overflow-hidden animate-in zoom-in duration-200">
                   <div className="bg-orange-600 p-4 flex justify-between items-center text-white">
                       <h3 className="font-bold flex items-center gap-2"><CheckCircle /> Requisición Exitosa</h3>
                       <button onClick={() => { setShowReciboSalida(false); setView('INVENTARIO'); }} className="hover:bg-orange-700 rounded p-1"><X /></button>
                   </div>
                   
                   <div className="p-6">
                       <div className="text-center mb-6">
                           <div className="bg-orange-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-2">
                               <Archive size={32} className="text-orange-600"/>
                           </div>
                           <h4 className="text-xl font-bold text-gray-800">Comprobante de Salida</h4>
                           <p className="text-gray-500 text-sm">Control N°: {ultimoMovimiento.id.substring(0,8)}</p>
                       </div>

                       <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-sm space-y-2 mb-6">
                           <div className="flex justify-between border-b pb-2">
                               <span className="text-gray-500">Fecha:</span>
                               <span className="font-bold">{ultimoMovimiento.fecha}</span>
                           </div>
                           <div className="flex justify-between">
                               <span className="text-gray-500">Artículo:</span>
                               <span className="font-bold text-gray-900">{ultimoMovimiento.nombreArticulo}</span>
                           </div>
                           <div className="flex justify-between">
                               <span className="text-gray-500">Cantidad Retirada:</span>
                               <span className="font-bold text-xl text-orange-600">{ultimoMovimiento.cantidad}</span>
                           </div>
                           <div className="flex justify-between">
                               <span className="text-gray-500">Solicitante:</span>
                               <span className="font-bold">{ultimoMovimiento.solicitanteOProveedor}</span>
                           </div>
                           <div className="flex justify-between">
                               <span className="text-gray-500">Motivo/Depto:</span>
                               <span className="font-bold">{ultimoMovimiento.motivo}</span>
                           </div>
                       </div>

                       <div className="flex gap-3">
                           <button 
                             onClick={() => { setShowReciboSalida(false); setView('INVENTARIO'); }} 
                             className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-50 font-medium"
                           >
                               Cerrar
                           </button>
                           <button 
                             onClick={imprimirComprobanteSalida} 
                             className="flex-1 bg-slate-800 text-white py-2 rounded-lg hover:bg-slate-700 font-medium flex justify-center items-center gap-2"
                           >
                               <Printer size={18} /> Imprimir Comprobante
                           </button>
                       </div>
                   </div>
               </div>
           </div>
       )}

    </div>
  );
};
