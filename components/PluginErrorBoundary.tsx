
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { LogLevel } from '../types';

interface Props {
  children: ReactNode;
  pluginName: string;
  onCatch: (error: Error, info: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
}

class PluginErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.props.onCatch(error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
          <h2 className="text-xl font-bold text-red-700 dark:text-red-400 mb-2">Error en Plugin: {this.props.pluginName}</h2>
          <p className="text-red-600 dark:text-red-300">
            Hubo un problema al cargar este componente. El error ha sido registrado en el sistema.
          </p>
          <button 
            onClick={() => this.setState({ hasError: false })}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            Reintentar
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default PluginErrorBoundary;
