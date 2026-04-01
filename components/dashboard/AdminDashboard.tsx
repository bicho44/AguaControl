
import React from 'react';
import { 
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { 
  Producto, EmpresaSettings, TipoProducto 
} from '../../types';
import { 
  Preforma, Molde, ProduccionSoplado, EntregaSoplado 
} from '../../plugins/soplado/types';
import SopladoDashboardWidget from '../../plugins/soplado/SopladoDashboardWidget';
import { AppButton, AppCard } from '../ui';
import LeafletMap from '../LeafletMap';

const lightTooltipStyle = {
    backgroundColor: '#f3f4f6',
    border: '1px solid #d1d5db',
    borderRadius: '0.75rem',
    color: '#111827',
    fontSize: '12px',
    fontWeight: 'bold',
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
    zIndex: 100
};

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

interface AdminDashboardProps {
  empresaSettings?: EmpresaSettings;
  preformas?: Preforma[];
  moldes?: Molde[];
  produccionSoplado?: ProduccionSoplado[];
  entregasSoplado?: EntregaSoplado[];
  handleSopladoAction: (type: 'produccion' | 'entrega') => void;
  saldoEfectivo: number;
  saldoOtros: number;
  metricsOrder: string[];
  metricsComponents: Record<string, React.ReactNode>;
  returnableProductNames: string[];
  visibleProducts: string[];
  toggleProductVisibility: (name: string) => void;
  productColors: Record<string, string>;
  shortName: (name: string) => string;
  currentMonthDailySalesData: any[];
  productos: Producto[];
  stockEnCalle: [string, number][];
  monthlySalesVolumeChartData: any[];
  nonReturnableMonthlyData: any[];
  externalVendorsPieData: any[];
  vendedoresComisiones: { nombre: string, monto: number }[];
  todayName: string;
  mapMarkers: { lat: number, lng: number, title: string }[];
  routeLine: { lat: number, lng: number }[];
  optimizeRoute: () => void;
  isOptimized: boolean;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({
  empresaSettings,
  preformas,
  moldes,
  produccionSoplado,
  entregasSoplado,
  handleSopladoAction,
  saldoEfectivo,
  saldoOtros,
  metricsOrder,
  metricsComponents,
  returnableProductNames,
  visibleProducts,
  toggleProductVisibility,
  productColors,
  shortName,
  currentMonthDailySalesData,
  productos,
  stockEnCalle,
  monthlySalesVolumeChartData,
  nonReturnableMonthlyData,
  externalVendorsPieData,
  vendedoresComisiones,
  todayName,
  mapMarkers,
  routeLine,
  optimizeRoute,
  isOptimized
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <h2 style={{ textTransform: 'uppercase', letterSpacing: '-0.02em', marginBottom: 'var(--pico-spacing)' }}>
        Dashboard <span style={{ color: 'var(--pico-primary)' }}>Operativo</span>
      </h2>
      
      {empresaSettings?.sopladoConfig?.enabled && (
        <div style={{ marginBottom: 'var(--pico-spacing)' }}>
          <SopladoDashboardWidget 
            preformas={preformas || []}
            moldes={moldes || []}
            produccion={produccionSoplado || []}
            entregas={entregasSoplado || []}
            settings={empresaSettings.sopladoConfig}
            onAction={handleSopladoAction}
          />
        </div>
      )}

      <div className="grid">
          <AppCard style={{ textAlign: 'center', border: '2px solid rgba(0,255,0,0.1)' }}>
              <small style={{ textTransform: 'uppercase', fontWeight: 900, color: 'green' }}>Efectivo Total</small>
              <h2 style={{ margin: 0 }}>${saldoEfectivo.toLocaleString('es-AR')}</h2>
          </AppCard>
          <AppCard style={{ textAlign: 'center', border: '2px solid rgba(0,0,255,0.1)' }}>
              <small style={{ textTransform: 'uppercase', fontWeight: 900, color: 'blue' }}>Caja Virtual / Bancos</small>
              <h2 style={{ margin: 0 }}>${saldoOtros.toLocaleString('es-AR')}</h2>
          </AppCard>
      </div>

      <section>
        <h6 style={{ textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.6, marginBottom: '1rem' }}>Entregas Consolidadas</h6>
        <div className="grid">
            {metricsOrder.map(key => <div key={key}>{metricsComponents[key]}</div>)}
        </div>
      </section>

      <div className="grid">
          <div style={{ gridColumn: 'span 2' }}>
              <AppCard title="Evolución Diaria (Mes Actual vs Anterior)">
                  <div style={{ marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <small style={{ textTransform: 'uppercase', fontWeight: 900, opacity: 0.6 }}>Filtro de Productos</small>
                            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.625rem', fontWeight: 'bold', textTransform: 'uppercase' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><div style={{ width: '12px', height: '2px', backgroundColor: 'currentColor' }}></div> Mes Actual</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', opacity: 0.5 }}><div style={{ width: '12px', height: '2px', borderBottom: '1px dashed currentColor' }}></div> Mes Anterior</div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                            {returnableProductNames.map(name => {
                                const isVisible = visibleProducts.includes(name);
                                return (
                                    <button
                                        key={name}
                                        onClick={() => toggleProductVisibility(name)}
                                        className={isVisible ? '' : 'secondary outline'}
                                        style={{ 
                                            padding: '0.25rem 0.5rem',
                                            fontSize: '0.625rem',
                                            fontWeight: 900,
                                            borderRadius: 'var(--pico-border-radius)',
                                            backgroundColor: isVisible ? productColors[name] : undefined,
                                            borderColor: isVisible ? productColors[name] : undefined,
                                            color: isVisible ? 'white' : undefined,
                                            opacity: isVisible ? 1 : 0.5,
                                            margin: 0
                                        }}
                                    >
                                        {shortName(name).toUpperCase()}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                  <div style={{ height: '320px' }}>
                      <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={currentMonthDailySalesData}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128, 128, 128, 0.1)" />
                              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                              <YAxis axisLine={false} tickLine={false} />
                              <Tooltip contentStyle={lightTooltipStyle} itemStyle={{ color: '#111827' }} labelFormatter={(l) => `Día ${l}`} />
                              <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                              
                              <Line type="monotone" dataKey="Total Mes Actual" stroke="#3b82f6" strokeWidth={4} dot={false} name="📦 TOTAL ACTUAL" />
                              <Line type="monotone" dataKey="Internos Mes Actual" stroke="#10b981" strokeWidth={2} dot={false} name="👤 INTERNOS ACTUAL" />
                              <Line type="monotone" dataKey="Externos Mes Actual" stroke="#f59e0b" strokeWidth={2} dot={false} name="🤝 EXTERNOS ACTUAL" />
                              
                              <Line type="monotone" dataKey="Total Mes Anterior" stroke="#9ca3af" strokeWidth={2} strokeDasharray="5 5" dot={false} name="📦 TOTAL ANTERIOR" opacity={0.5} />

                              {returnableProductNames.map(name => visibleProducts.includes(name) ? (
                                  <React.Fragment key={name}>
                                      <Line type="monotone" dataKey={name} stroke={productColors[name]} strokeWidth={2} dot={false} name={shortName(name)} />
                                  </React.Fragment>
                              ) : null)}
                          </LineChart>
                      </ResponsiveContainer>
                  </div>
              </AppCard>
          </div>

          <div>
              <AppCard title="Stock en Planta">
                  <div style={{ overflowY: 'auto', maxHeight: '420px' }}>
                      <small style={{ textTransform: 'uppercase', fontWeight: 900, opacity: 0.6, display: 'block', marginBottom: '0.5rem' }}>Productos y Envases en Fábrica</small>
                      {productos.filter(p => p.tipo === TipoProducto.RETORNABLE || p.tipo === TipoProducto.DESCARTABLE).length > 0 ? (
                          <table className="striped">
                              <thead>
                                  <tr>
                                      <th style={{ fontSize: '0.625rem' }}>Producto</th>
                                      <th style={{ fontSize: '0.625rem', textAlign: 'right' }}>Llenos</th>
                                      <th style={{ fontSize: '0.625rem', textAlign: 'right' }}>Vacíos</th>
                                  </tr>
                              </thead>
                              <tbody>
                                  {productos
                                    .filter(p => p.tipo === TipoProducto.RETORNABLE || p.tipo === TipoProducto.DESCARTABLE)
                                    .map(p => (
                                      <tr key={p.id}>
                                          <td><small>{p.abreviatura || p.nombre}</small></td>
                                          <td style={{ textAlign: 'right' }}><strong>{p.stockPlanta || 0}</strong></td>
                                          <td style={{ textAlign: 'right' }}><strong>{p.tipo === TipoProducto.RETORNABLE ? (p.stockEnvases || 0) : '-'}</strong></td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      ) : (
                          <div style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>
                              <small>Sin productos registrados</small>
                          </div>
                      )}
                  </div>
              </AppCard>
          </div>

          <div>
              <AppCard title="Stock en Poder de Clientes">
                  <div style={{ overflowY: 'auto', maxHeight: '420px' }}>
                      <small style={{ textTransform: 'uppercase', fontWeight: 900, opacity: 0.6, display: 'block', marginBottom: '0.5rem' }}>Activos pendientes de devolución</small>
                      {stockEnCalle.length > 0 ? (
                          <table className="striped">
                              <tbody>
                                  {stockEnCalle.map(([name, count]) => (
                                      <tr key={name}>
                                          <td><small>{shortName(name)}</small></td>
                                          <td style={{ textAlign: 'right' }}><strong>{count.toLocaleString()}</strong></td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      ) : (
                          <div style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>
                              <small>Sin stock pendiente</small>
                          </div>
                      )}
                  </div>
              </AppCard>
          </div>

          <div style={{ gridColumn: 'span 2' }}>
              <AppCard title="Volumen de Ventas (Histórico 12 Meses)">
                  <div style={{ height: '320px' }}>
                      <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={monthlySalesVolumeChartData}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128, 128, 128, 0.1)" />
                              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold'}} />
                              <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                              <Tooltip contentStyle={lightTooltipStyle} itemStyle={{ color: '#111827' }} />
                              <Legend iconType="circle" formatter={(v) => v} />
                              
                              <Line type="monotone" dataKey="Total General" stroke="#111827" strokeWidth={4} dot={{ r: 5 }} name="📈 TOTAL VENTAS" />
                              <Line type="monotone" dataKey="Internos" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} name="👤 INTERNOS" />
                              <Line type="monotone" dataKey="Externos" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} name="🤝 EXTERNOS" />

                              {returnableProductNames.map(name => {
                                  if (!visibleProducts.includes(name)) return null;
                                  return <Line key={name} type="monotone" dataKey={name} stroke={productColors[name]} strokeWidth={2} dot={{ r: 4 }} name={shortName(name)} animationDuration={1000} />;
                              })}
                          </LineChart>
                      </ResponsiveContainer>
                  </div>
              </AppCard>
          </div>

          <div>
              <AppCard title="Ventas Productos Descartables">
                  <div style={{ height: '320px' }}>
                      {nonReturnableMonthlyData.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={nonReturnableMonthlyData} layout="vertical" margin={{ left: 20, right: 20, top: 10, bottom: 10 }}>
                                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(128, 128, 128, 0.1)" />
                                  <XAxis type="number" hide />
                                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} width={80} />
                                  <Tooltip contentStyle={lightTooltipStyle} cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
                                  <Legend verticalAlign="top" height={36} />
                                  <Area dataKey="actual" name="Mes Actual" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
                                  <Area dataKey="anterior" name="Mes Anterior" stroke="#9ca3af" fill="#9ca3af" fillOpacity={0.3} />
                              </AreaChart>
                          </ResponsiveContainer>
                      ) : (
                          <div style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>
                              <small>Sin ventas descartables</small>
                          </div>
                      )}
                  </div>
              </AppCard>
          </div>

          <div>
              <AppCard title="Comisiones Vendedores">
                  <div style={{ overflowY: 'auto', maxHeight: '420px' }}>
                      <small style={{ textTransform: 'uppercase', fontWeight: 900, opacity: 0.6, display: 'block', marginBottom: '0.5rem' }}>Mes Actual (Internos)</small>
                      {vendedoresComisiones.length > 0 ? (
                          <table className="striped">
                              <tbody>
                                  {vendedoresComisiones.map(v => (
                                      <tr key={v.nombre}>
                                          <td><small>{v.nombre}</small></td>
                                          <td style={{ textAlign: 'right' }}><strong>${v.monto.toLocaleString()}</strong></td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      ) : (
                          <div style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>
                              <small>Sin comisiones este mes</small>
                          </div>
                      )}
                  </div>
              </AppCard>
          </div>

          <div>
              <AppCard title="Vendedores Externos">
                  <div style={{ height: '320px' }}>
                      {externalVendorsPieData.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                  <Pie
                                      data={externalVendorsPieData}
                                      cx="50%"
                                      cy="50%"
                                      innerRadius={60}
                                      outerRadius={80}
                                      paddingAngle={5}
                                      dataKey="value"
                                      label={({ value }) => `${value}`}
                                  >
                                      {externalVendorsPieData.map((entry, index) => (
                                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                      ))}
                                  </Pie>
                                  <Tooltip contentStyle={lightTooltipStyle} itemStyle={{ color: '#111827' }} />
                                  <Legend verticalAlign="bottom" height={36} />
                              </PieChart>
                          </ResponsiveContainer>
                      ) : (
                          <div style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>
                              <small>Sin ventas externas</small>
                          </div>
                      )}
                  </div>
              </AppCard>
          </div>
      </div>

      <AppCard title={`Ruta de Reparto Estimada (${todayName})`}>
          <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <small style={{ textTransform: 'uppercase', fontWeight: 900, opacity: 0.6 }}>{mapMarkers.length} puntos de entrega hoy</small>
              <AppButton onClick={optimizeRoute} disabled={isOptimized} size="sm">
                  {isOptimized ? 'Ruta Optimizada' : 'Optimizar Ruta'}
              </AppButton>
          </div>
          <div style={{ height: '400px', borderRadius: 'var(--pico-border-radius)', overflow: 'hidden', border: '1px solid var(--pico-muted-border-color)' }}>
              <LeafletMap markers={mapMarkers} routeLine={routeLine} />
          </div>
      </AppCard>
    </div>
  );
};

export default AdminDashboard;
