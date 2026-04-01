
import React from 'react';
import { Producto } from '../../types';
import { AppCard } from '../ui';

interface StatsCardProps {
  title: string;
  stats: { byProduct: { [key: string]: number } };
  productos: Producto[];
}

const StatsCard: React.FC<StatsCardProps> = ({ title, stats, productos }) => {
  const shortName = (name: string) => {
    const prod = productos.find(p => p.nombre === name);
    if (prod?.abreviatura) return prod.abreviatura;
    return name.replace('Bidón ', '').replace(' Retornable', '').replace(' Descartable', '');
  };

  return (
    <AppCard title={title}>
      <div style={{ minHeight: '120px' }}>
        {Object.keys(stats.byProduct).length > 0 ? (
          Object.entries(stats.byProduct)
            .sort(([, valueA], [, valueB]) => (valueB as number) - (valueA as number))
            .map(([name, value]) => (
              <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ color: 'var(--pico-muted-color)', fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {shortName(name)}
                </span>
                <strong style={{ fontSize: '1.125rem', color: 'var(--pico-primary)' }}>{value}</strong>
              </div>
            ))
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '120px', opacity: 0.5 }}>
            <svg style={{ width: '32px', height: '32px', marginBottom: '0.5rem' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0a2 2 0 01-2 2H6a2 2 0 01-2-2m16 0l-3.586 3.586a2 2 0 01-2.828 0L7 14m10 0v1a2 2 0 01-2 2H9a2 2 0 01-2-2v-1" />
            </svg>
            <p style={{ textAlign: 'center', fontSize: '0.625rem', textTransform: 'uppercase', fontWeight: 900, letterSpacing: '-0.02em' }}>
              Sin movimientos
            </p>
          </div>
        )}
      </div>
    </AppCard>
  );
};

export default StatsCard;
