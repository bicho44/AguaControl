import React, { createContext, useState, useContext, ReactNode, useCallback } from 'react';

type NotificationType = 'success' | 'error';

export interface NotificationState {
  message: string;
  type: NotificationType;
  id: number;
}

interface NotificationContextType {
  notifications: NotificationState[];
  showNotification: (message: string, type: NotificationType) => void;
  removeNotification: (id: number) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<NotificationState[]>([]);

  const removeNotification = useCallback((id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const showNotification = useCallback((message: string, type: NotificationType) => {
    const id = new Date().getTime();
    setNotifications(prev => [...prev, { message, type, id }]);
  }, []);

  return (
    <NotificationContext.Provider value={{ notifications, showNotification, removeNotification }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};
