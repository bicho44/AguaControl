import React from 'react';

type NotificationType = 'success' | 'error';

interface NotificationProps {
  message: string;
  type: NotificationType;
  onClose: () => void;
}

const Notification: React.FC<NotificationProps> = ({ message, type, onClose }) => {
  React.useEffect(() => {
    const timerId = setTimeout(onClose, 4000);
    return () => clearTimeout(timerId);
  }, [onClose]);

  const baseStyles: React.CSSProperties = {
    padding: '1rem',
    borderRadius: 'var(--pico-border-radius)',
    backgroundColor: type === 'success' ? 'var(--pico-ins-background-color)' : 'var(--pico-del-background-color)',
    color: type === 'success' ? 'var(--pico-ins-color)' : 'var(--pico-del-color)',
    border: `1px solid ${type === 'success' ? 'var(--pico-ins-border-color)' : 'var(--pico-del-border-color)'}`,
    boxShadow: 'var(--pico-card-box-shadow)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '0.5rem',
    width: '320px',
    maxWidth: '90vw',
    pointerEvents: 'auto'
  };

  return (
    <div role="alert" style={baseStyles}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {type === 'success' ? (
          <svg style={{ width: '20px', height: '20px', flexShrink: 0 }} fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5Zm3.707 8.207-4 4a1 1 0 0 1-1.414 0l-2-2a1 1 0 0 1 1.414-1.414L9 10.586l3.293-3.293a1 1 0 0 1 1.414 1.414Z"/>
          </svg>
        ) : (
          <svg style={{ width: '20px', height: '20px', flexShrink: 0 }} fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5Zm3.707 11.793a1 1 0 1 1-1.414 1.414L10 11.414l-2.293 2.293a1 1 0 0 1-1.414-1.414L8.586 10 6.293 7.707a1 1 0 0 1 1.414-1.414L10 8.586l2.293-2.293a1 1 0 0 1 1.414 1.414L11.414 10l2.293 2.293Z"/>
          </svg>
        )}
        <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>{message}</span>
      </div>
      <button 
        type="button" 
        onClick={onClose} 
        className="outline contrast"
        style={{ padding: '0.25rem', width: 'auto', border: 'none', marginBottom: 0, fontSize: '0.75rem', background: 'transparent', color: 'inherit' }}
      >
        ✕
      </button>
    </div>
  );
};

export default Notification;
