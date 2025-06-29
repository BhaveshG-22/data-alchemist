import { useState, useCallback } from 'react';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = `toast_${Date.now()}_${Math.random()}`;
    const newToast = { ...toast, id };
    
    setToasts(prev => [...prev, newToast]);
    
    // Auto remove toast after duration
    const duration = toast.duration || 5000;
    setTimeout(() => {
      removeToast(id);
    }, duration);
    
    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const showSuccess = useCallback((message: string, duration?: number) => {
    return addToast({ message, type: 'success', duration });
  }, [addToast]);

  const showError = useCallback((message: string, duration?: number) => {
    return addToast({ message, type: 'error', duration });
  }, [addToast]);

  const showWarning = useCallback((message: string, duration?: number) => {
    return addToast({ message, type: 'warning', duration });
  }, [addToast]);

  const showInfo = useCallback((message: string, duration?: number) => {
    return addToast({ message, type: 'info', duration });
  }, [addToast]);

  return {
    toasts,
    addToast,
    removeToast,
    showSuccess,
    showError,
    showWarning,
    showInfo
  };
}