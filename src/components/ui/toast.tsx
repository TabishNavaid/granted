"use client";

import * as React from "react";
import * as ToastPrimitive from "@radix-ui/react-toast";
import { X } from "lucide-react";
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

/** A small sheet at the corner of the page. A red edge means something went wrong. */
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
              "sheet-raised-sm group relative flex w-full items-start gap-3 p-4 pr-10",
              t.tone === "warning" && "border-l-4 border-l-alert",
              "data-[state=open]:animate-sheet-in data-[state=closed]:animate-fade-in data-[state=closed]:[animation-direction:reverse]",
              "data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)]",
            )}
          >
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <ToastPrimitive.Title className="text-base font-bold text-ink">{t.title}</ToastPrimitive.Title>
              {t.description ? <ToastPrimitive.Description className="text-sm text-ink-muted">{t.description}</ToastPrimitive.Description> : null}
              {t.action ? (
                <ToastPrimitive.Action altText={t.action.label} asChild>
                  <button type="button" onClick={t.action.onClick} className="mt-1 w-fit text-sm font-semibold text-ink underline decoration-[1.5px] underline-offset-4 hover:decoration-ink">
                    {t.action.label}
                  </button>
                </ToastPrimitive.Action>
              ) : null}
            </div>
            <ToastPrimitive.Close className="absolute right-2 top-2 rounded-sm p-1 text-ink-muted hover:bg-paper-tint hover:text-ink">
              <X className="size-4" aria-hidden />
              <span className="sr-only">Dismiss</span>
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        ))}
        {/* On a phone toasts sit at the top, so they never cover a flower growing on the item just approved. */}
        <ToastPrimitive.Viewport className="fixed right-0 top-0 z-[100] flex w-full max-w-sm flex-col gap-3 p-4 outline-none sm:bottom-0 sm:top-auto" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
