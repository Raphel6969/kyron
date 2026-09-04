import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { CheckCircle2, XOctagon, AlertTriangle, Info, X } from 'lucide-react';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

interface ToastContextType {
  addToast: (toast: Omit<Toast, 'id'>) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { ...toast, id }]);
  }, []);

  const success = useCallback((message: string, duration?: number) => addToast({ type: 'success', message, duration }), [addToast]);
  const error = useCallback((message: string, duration?: number) => addToast({ type: 'error', message, duration }), [addToast]);
  const warning = useCallback((message: string, duration?: number) => addToast({ type: 'warning', message, duration }), [addToast]);
  const info = useCallback((message: string, duration?: number) => addToast({ type: 'info', message, duration }), [addToast]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, success, error, warning, info }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

const ToastItem: React.FC<{ toast: Toast; onClose: () => void }> = ({ toast, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, toast.duration || 4000);
    return () => clearTimeout(timer);
  }, [toast, onClose]);

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-teal-400" />,
    error: <XOctagon className="w-5 h-5 text-rose-400" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-400" />,
    info: <Info className="w-5 h-5 text-blue-400" />
  };

  const borders = {
    success: 'border-teal-500/30',
    error: 'border-rose-500/30',
    warning: 'border-amber-500/30',
    info: 'border-blue-500/30'
  };

  return (
    <div className={`pointer-events-auto max-w-sm w-full bg-slate-900/90 backdrop-blur-md border ${borders[toast.type]} rounded-xl p-4 shadow-xl flex items-start gap-3 animate-in slide-in-from-right-8 duration-300`}>
      <div className="flex-shrink-0 mt-0.5">{icons[toast.type]}</div>
      <div className="flex-1 text-sm text-slate-200">{toast.message}</div>
      <button onClick={onClose} className="flex-shrink-0 text-slate-400 hover:text-white transition-colors">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
