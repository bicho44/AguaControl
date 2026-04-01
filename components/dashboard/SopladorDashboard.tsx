
import React from 'react';
import { Calendar, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Usuario, EmpresaSettings } from '../../types';
import { Preforma, Molde, ProduccionSoplado, EntregaSoplado } from '../../plugins/soplado/types';
import SopladoDashboardWidget from '../../plugins/soplado/SopladoDashboardWidget';

interface SopladorDashboardProps {
  user: Usuario;
  empresaSettings?: EmpresaSettings;
  preformas?: Preforma[];
  moldes?: Molde[];
  produccionSoplado?: ProduccionSoplado[];
  entregasSoplado?: EntregaSoplado[];
  handleSopladoAction: (type: 'produccion' | 'entrega') => void;
}

const SopladorDashboard: React.FC<SopladorDashboardProps> = ({
  user,
  empresaSettings,
  preformas,
  moldes,
  produccionSoplado,
  entregasSoplado,
  handleSopladoAction
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingTop: '3rem', paddingBottom: '3rem' }}>
      <header style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--pico-color)', textTransform: 'uppercase', letterSpacing: '-0.05em', fontStyle: 'italic', margin: 0 }}>
            Panel de Soplado
          </h1>
          <p style={{ color: 'var(--pico-muted-color)', fontWeight: 500, margin: 0 }}>Bienvenido, {user.nombre}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'var(--pico-card-background-color)', padding: '0.5rem 1rem', borderRadius: 'var(--pico-border-radius)', border: '1px solid var(--pico-muted-border-color)' }}>
          <Calendar className="h-5 w-5" style={{ color: 'var(--pico-primary)' }} />
          <span style={{ fontWeight: 'bold', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '-0.02em' }}>
            {format(new Date(), "EEEE, d 'de' MMMM", { locale: es })}
          </span>
        </div>
      </header>

      {empresaSettings?.sopladoConfig?.enabled ? (
        <SopladoDashboardWidget 
          preformas={preformas || []}
          moldes={moldes || []}
          produccion={produccionSoplado || []}
          entregas={entregasSoplado || []}
          settings={empresaSettings.sopladoConfig}
          onAction={handleSopladoAction}
        />
      ) : (
        <div style={{ backgroundColor: 'rgba(255, 193, 7, 0.1)', borderLeft: '4px solid #ffc107', padding: '1.5rem', borderRadius: 'var(--pico-border-radius)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <AlertTriangle className="h-6 w-6" style={{ color: '#ffc107' }} />
            <p style={{ fontSize: '0.875rem', fontWeight: 'bold', color: '#856404', textTransform: 'uppercase', letterSpacing: '-0.01em', margin: 0 }}>
              El plugin de soplado está desactivado. Contacte al administrador para habilitarlo.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default SopladorDashboard;
