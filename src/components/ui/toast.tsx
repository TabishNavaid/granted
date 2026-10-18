"use client";

import * as React from "react";
import * as ToastPrimitive from "@radix-ui/react-toast";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastTone = "success" | "warning" | "info";

interface ToastOptions {
  title: string;
  description?: string;
  tone?: ToastTone;
  action?: { label: string; onClick: () => void };
  duration?: number;
}

interface ToastRecord extends ToastOptions {
  id: number;
}

const ToastContext = React.createContext<{ toast: (opts: ToastOptions) => void } | null>(null);

let counter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastRecord[]>([]);
  const toast = React.useCallback((opts: ToastOptions) => {
    counter += 1;
    setToasts((t) => [...t.slice(-3), { ...opts, id: counter }]);
  }, []);
  const remove = (id: number) => setToasts((t) => t.filter((x) => x.id !== id));
  const value = React.useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      <ToastPrimitive.Provider swipeDirection="right" duration={5000}>
        {children}
        {toasts.map((t) => (
          <ToastPrimitive.Root
            key={t.id}
            duration={t.duration}
            onOpenChange={(open) => !open && remove(t.id)}
            className={cn(
              "group relative flex w-full items-start gap-3 rounded-lg border border-border bg-surface-raised p-4 pr-10 shadow-md",
              "data-[state=open]:animate-rise-in data-[state=closed]:animate-fade-in data-[state=closed]:[animation-direction:reverse]",
              "data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)]",
            )}
          >
            <span
              className={cn(
                "mt-0.5 shrink-0 [&_svg]:size-5",
                t.tone === "warning" ? "text-warning" : t.tone === "info" ? "text-info" : "text-success",
              )}
              aria-hidden
            >
              {t.tone === "warning" ? <AlertTriangle /> : t.tone === "info" ? <Info /> : <CheckCircle2 />}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <ToastPrimitive.Title className="text-sm font-medium text-fg">{t.title}</ToastPrimitive.Title>
              {t.description ? (
                <ToastPrimitive.Description className="text-sm text-fg-muted">{t.description}</ToastPrimitive.Description>
              ) : null}
              {t.action ? (
                <ToastPrimitive.Action altText={t.action.label} asChild>
                  <button
                    type="button"
                    onClick={t.action.onClick}
                    className="mt-1 w-fit text-sm font-medium text-accent underline-offset-4 hover:underline"
                  >
                    {t.action.label}
                  </button>
                </ToastPrimitive.Action>
              ) : null}
            </div>
            <ToastPrimitive.Close className="absolute right-2 top-2 rounded-md p-1 text-fg-subtle hover:bg-surface-hover hover:text-fg">
              <X className="size-4" aria-hidden />
              <span className="sr-only">Dismiss</span>
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        ))}
        <ToastPrimitive.Viewport className="fixed bottom-0 right-0 z-[100] flex w-full max-w-sm flex-col gap-2 p-4 outline-none" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
