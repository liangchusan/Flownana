"use client";

import { useLayoutEffect, useRef, type ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

let openModals = 0;
let previousOverflow = "";

/** Native modal isolation, focus restoration and topmost-only Escape handling.
 * Mount only while open; rerenders must not close/reopen or reset user focus. */
export function Modal({ onClose, dismissible = true, className, children, ...props }:
  Omit<ComponentPropsWithoutRef<"dialog">, "open" | "onClose" | "onCancel" | "onKeyDown"> & {
    onClose: () => void;
    dismissible?: boolean;
  }) {
  const ref = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    dialog.showModal();
    if (openModals++ === 0) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    return () => {
      dialog.close();
      if (--openModals === 0) document.body.style.overflow = previousOverflow;
    };
  }, []);

  return <dialog {...props} ref={ref} aria-modal="true"
    className={cn("fixed inset-0 m-0 h-[100dvh] max-h-none w-full max-w-none border-0 p-0 text-foreground backdrop:bg-transparent", className)}
    onKeyDown={(event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        if (dismissible) onClose();
      } else if (event.key === "Tab") {
        event.stopPropagation();
        const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
          'button, a[href], input, select, textarea, video[controls], audio[controls], [tabindex]'
        )).filter((item) => item.tabIndex >= 0 && !item.matches(':disabled, [hidden]') && item.getClientRects().length > 0);
        const first = focusable[0], last = focusable.at(-1);
        if (first && last && ((event.shiftKey && document.activeElement === first) ||
          (!event.shiftKey && document.activeElement === last))) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        }
      }
    }}
    onCancel={(event) => {
      event.preventDefault();
      event.stopPropagation();
      if (dismissible) onClose();
    }}>
    {children}
  </dialog>;
}
