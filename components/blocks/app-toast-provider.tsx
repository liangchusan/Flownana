"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle, type LucideIcon } from "lucide-react";

type ToastVariant = "info" | "success" | "warning" | "error";

type ToastInput = {
  title?: string;
  message: string;
  variant?: ToastVariant;
};

type ToastItem = Required<ToastInput> & {
  id: number;
};

type ToastContextValue = {
  showToast: (toast: ToastInput) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const variantConfig: Record<
  ToastVariant,
  {
    icon: LucideIcon;
    iconClassName: string;
    title: string;
  }
> = {
  info: {
    icon: Info,
    iconClassName: "text-stone-600",
    title: "Notice",
  },
  success: {
    icon: CheckCircle2,
    iconClassName: "text-emerald-700",
    title: "Success",
  },
  warning: {
    icon: AlertTriangle,
    iconClassName: "text-amber-700",
    title: "Notice",
  },
  error: {
    icon: XCircle,
    iconClassName: "text-red-600",
    title: "Something went wrong",
  },
};

export function AppToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    ({ title, message, variant = "info" }: ToastInput) => {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      const nextToast: ToastItem = {
        id,
        title: title || variantConfig[variant].title,
        message,
        variant,
      };

      setToasts((current) => [...current, nextToast].slice(-4));
      window.setTimeout(() => dismissToast(id), 5000);
    },
    [dismissToast]
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[60] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-3 sm:right-6 sm:top-6">
        {toasts.map((toast) => {
          const config = variantConfig[toast.variant];
          const Icon = config.icon;

          return (
            <div
              key={toast.id}
              className="pointer-events-auto rounded-xl border border-stone-200/50 bg-white p-4 shadow-lg shadow-stone-200/20 transition-all duration-300"
            >
              <div className="flex items-start gap-3">
                <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${config.iconClassName}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-stone-900">{toast.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-stone-600">
                    {toast.message}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => dismissToast(toast.id)}
                  className="rounded-lg p-1 text-stone-400 transition-all duration-300 hover:bg-stone-100 hover:text-stone-700"
                  aria-label="Dismiss notification"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within AppToastProvider");
  }
  return context;
}
