"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;

const DialogContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { size?: "sm" | "md" | "lg" | "sheet" }
>(({ className, children, size = "md", onOpenAutoFocus, onCloseAutoFocus, ...props }, ref) => {
  // Remember whichever element opened the dialog so focus returns to it even
  // when the dialog is opened from state rather than a DialogTrigger.
  const openerRef = React.useRef<HTMLElement | null>(null);
  return (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px] animate-fade-in" />
    <DialogPrimitive.Content
      ref={ref}
      onOpenAutoFocus={(e) => {
        openerRef.current = document.activeElement as HTMLElement | null;
        onOpenAutoFocus?.(e);
      }}
      onCloseAutoFocus={(e) => {
        onCloseAutoFocus?.(e);
        if (!e.defaultPrevented && openerRef.current?.isConnected) {
          e.preventDefault();
          openerRef.current.focus();
        }
      }}
      className={cn(
        "fixed z-50 flex flex-col gap-4 border border-border bg-surface-raised p-6 shadow-lg focus:outline-none",
        size === "sheet"
          ? "inset-y-0 left-0 h-full w-[min(20rem,85vw)] rounded-r-xl animate-slide-in-right [animation-name:slide-in-left]"
          : "left-1/2 top-1/2 w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl animate-rise-in",
        size === "sm" && "max-w-sm",
        size === "md" && "max-w-lg",
        size === "lg" && "max-w-2xl",
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-3 top-3 rounded-md p-1.5 text-fg-subtle hover:bg-surface-hover hover:text-fg">
        <X className="size-4" aria-hidden />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
  );
});
DialogContent.displayName = "DialogContent";

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col gap-1.5 pr-8", className)} {...props} />
);
const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...props} />
);
const DialogTitle = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn("font-display text-xl text-fg", className)} {...props} />
));
DialogTitle.displayName = "DialogTitle";
const DialogDescription = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn("text-sm text-fg-muted", className)} {...props} />
));
DialogDescription.displayName = "DialogDescription";

export { Dialog, DialogTrigger, DialogClose, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription };
