"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2, Info, XCircle, type LucideIcon } from "lucide-react";

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
    iconClassName: "text-muted-foreground",
    title: "Notice",
  },
  success: {
    icon: CheckCircle2,
    iconClassName: "text-success",
    title: "Success",
  },
  warning: {
    icon: AlertTriangle,
    iconClassName: "text-warning",
    title: "Notice",
  },
  error: {
    icon: XCircle,
    iconClassName: "text-destructive",
    title: "Something went wrong",
  },
};

export function AppToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [toastHost, setToastHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const findTopDialog = () => {
      const dialogs = Array.from(document.querySelectorAll<HTMLDialogElement>("dialog[open]"));
      setToastHost(dialogs.at(-1) ?? null);
    };
    findTopDialog();
    const observer = new MutationObserver(findTopDialog);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["open"] });
    return () => observer.disconnect();
  }, [toasts.length]);

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

      setToasts((current) => [...current, nextToast].slice(-3));
      window.setTimeout(() => dismissToast(id), 3000);
    },
    [dismissToast]
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  const toastLayer = (
    <div className="pointer-events-none fixed inset-0 z-[2147483647] flex w-full flex-col items-center justify-start gap-3 p-4 pt-[33.333vh]">
      {toasts.map((toast) => {
        const config = variantConfig[toast.variant];
        const Icon = config.icon;

        return (
          <div
            key={toast.id}
            className="pointer-events-auto w-full max-w-sm rounded-ui-lg border border-border bg-background px-4 py-3 shadow-float transition-all duration-300"
          >
            <div className="flex items-start gap-3">
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${config.iconClassName}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug text-foreground">{toast.message}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toastHost ? createPortal(toastLayer, toastHost) : toastLayer}
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
