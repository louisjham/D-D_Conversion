import React, { useState, useCallback, useContext, createContext, useRef, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  action?: { label: string; onClick: () => void };
}

interface ToastContextValue {
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Return a no-op fallback so components outside the provider don't crash
    return { addToast: () => '', removeToast: () => {} };
  }
  return ctx;
}

const TOAST_ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />,
  error: <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />,
  info: <Info className="w-4 h-4 text-sky-400 shrink-0" />,
  warning: <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />,
};

const TOAST_STYLES: Record<ToastType, string> = {
  success: 'border-emerald-800/60 bg-emerald-950/90',
  error: 'border-red-800/60 bg-red-950/90',
  info: 'border-sky-800/60 bg-sky-950/90',
  warning: 'border-amber-800/60 bg-amber-950/90',
};

const TOAST_PROGRESS: Record<ToastType, string> = {
  success: 'bg-emerald-500',
  error: 'bg-red-500',
  info: 'bg-sky-500',
  warning: 'bg-amber-500',
};

function ToastItem({
  toast,
  onRemove,
}: {
  toast: Toast;
  onRemove: (id: string) => void;
}) {
  const duration = toast.duration ?? 4000;
  const [isExiting, setIsExiting] = useState(false);
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (progressRef.current) {
      // Trigger CSS animation on next frame
      requestAnimationFrame(() => {
        if (progressRef.current) {
          progressRef.current.style.transition = `width ${duration}ms linear`;
          progressRef.current.style.width = '0%';
        }
      });
    }

    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => onRemove(toast.id), 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, toast.id, onRemove]);

  return (
    <div
      className={`
        relative overflow-hidden rounded-lg border backdrop-blur-md shadow-xl
        ${TOAST_STYLES[toast.type]}
        ${isExiting ? 'animate-toast-exit' : 'animate-toast-enter'}
        max-w-sm w-full pointer-events-auto
      `}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start gap-2.5 p-3">
        <div className="mt-0.5">{TOAST_ICONS[toast.type]}</div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-100 leading-tight">{toast.title}</p>
          {toast.message && (
            <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{toast.message}</p>
          )}
          {toast.action && (
            <button
              onClick={() => {
                toast.action!.onClick();
                onRemove(toast.id);
              }}
              className="mt-1.5 text-[11px] font-bold text-amber-300 hover:text-amber-200 underline underline-offset-2 transition-colors"
            >
              {toast.action.label}
            </button>
          )}
        </div>
        <button
          onClick={() => {
            setIsExiting(true);
            setTimeout(() => onRemove(toast.id), 300);
          }}
          className="text-slate-500 hover:text-slate-300 transition-colors shrink-0"
          aria-label="Dismiss notification"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      {/* Progress bar */}
      <div className="h-[2px] w-full bg-slate-800/50">
        <div
          ref={progressRef}
          className={`h-full ${TOAST_PROGRESS[toast.type]}`}
          style={{ width: '100%' }}
        />
      </div>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counterRef = useRef(0);

  const addToast = useCallback((toast: Omit<Toast, 'id'>): string => {
    const id = `toast-${++counterRef.current}-${Date.now()}`;
    setToasts((prev) => [...prev.slice(-4), { ...toast, id }]); // Max 5 visible toasts
    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      {/* Toast Container - bottom right */}
      <div
        className="fixed bottom-12 right-4 z-[9999] flex flex-col gap-2 pointer-events-none"
        aria-label="Notifications"
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
