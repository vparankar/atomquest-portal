import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { CheckCircle, XCircle, X } from 'lucide-react';

type ToastType = 'success' | 'error';
interface Toast { id: string; message: string; type: ToastType; }
interface ToastContextType { toast: { success: (m: string) => void; error: (m: string) => void; }; }

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 5000);
  }, []);

  const remove = (id: string) => setToasts(p => p.filter(t => t.id !== id));
  const toast = {
    success: (m: string) => addToast(m, 'success'),
    error:   (m: string) => addToast(m, 'error'),
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            minWidth: 300, maxWidth: 420,
            padding: '10px 14px',
            background: t.type === 'success' ? '#F0FDF4' : '#FEF2F2',
            border: `1px solid ${t.type === 'success' ? '#BBF7D0' : '#FECACA'}`,
            borderRadius: 4,
            boxShadow: '0 4px 12px rgba(0,0,0,0.10)',
            animation: 'slideUp 0.2s ease',
          }}>
            {t.type === 'success'
              ? <CheckCircle size={16} style={{ color: '#16A34A', flexShrink: 0 }} />
              : <XCircle    size={16} style={{ color: '#DC2626', flexShrink: 0 }} />
            }
            <p style={{ flex: 1, fontSize: 13, fontWeight: 500, color: t.type === 'success' ? '#15803D' : '#991B1B', margin: 0 }}>
              {t.message}
            </p>
            <button onClick={() => remove(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 0, display: 'flex' }}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
