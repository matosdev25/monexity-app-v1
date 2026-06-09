"use client";

import { Toaster } from "sonner";

export function AppToaster() {
  return (
    <Toaster
      position="top-right"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast: "bg-slate-900 border border-white/10 text-white",
          title: "text-white",
          description: "text-slate-300",
        },
      }}
    />
  );
}
