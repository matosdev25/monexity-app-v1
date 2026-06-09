"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";

type ConfirmSubmitButtonProps = {
  label: string;
  pendingLabel?: string;
  title?: string;
  confirmMessage?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  className?: string;
};

function TriggerButton({
  label,
  pendingLabel,
  className,
  onOpen,
}: {
  label: string;
  pendingLabel: string;
  className: string;
  onOpen: (e: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={pending}
      aria-disabled={pending}
      className={`transition-[opacity,transform] duration-150 active:scale-[0.97] active:opacity-90 disabled:pointer-events-none ${className ?? ""}`}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

export function ConfirmSubmitButton({
  label,
  pendingLabel = "Procesando...",
  title = "Confirmar acción",
  confirmMessage = "¿Seguro que quieres continuar?",
  confirmLabel = "Sí, continuar",
  cancelLabel = "Cancelar",
  className = "",
}: ConfirmSubmitButtonProps) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);

  const openDialog = (e: React.MouseEvent<HTMLButtonElement>) => {
    formRef.current = e.currentTarget.form ?? e.currentTarget.closest("form");
    setOpen(true);
  };

  const closeDialog = () => setOpen(false);

  const handleConfirm = () => {
    const form = formRef.current;
    if (!form) return;
    closeDialog();
    form.requestSubmit();
  };

  return (
    <>
      <TriggerButton
        label={label}
        pendingLabel={pendingLabel}
        className={className}
        onOpen={openDialog}
      />

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
            onClick={closeDialog}
            aria-hidden="true"
          />
          {/* Panel */}
          <div className="animate-mx-scale-in relative w-full max-w-115 overflow-hidden rounded-[28px] border border-app bg-[rgba(255,255,255,0.92)] p-0 text-app shadow-[0_24px_80px_rgba(15,23,42,0.22)] dark:bg-[rgba(15,23,42,0.92)] dark:text-white dark:shadow-[0_24px_80px_rgba(2,6,23,0.50)]">
            <div className="rounded-[28px] border border-app bg-app-panel p-5">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-rose-500/80 dark:text-rose-300/80">
                  Confirmación
                </p>

                <h3 className="mt-1 text-xl font-semibold tracking-tight text-app">
                  {title}
                </h3>

                <p className="mt-3 text-sm leading-6 text-app-muted">
                  {confirmMessage}
                </p>
              </div>

              <div className="mt-5 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeDialog}
                  className="rounded-2xl border border-app bg-app-soft px-4 py-2 text-sm font-medium text-app-muted transition-[color,opacity,transform] duration-150 hover:text-app active:scale-[0.97] active:opacity-90"
                >
                  {cancelLabel}
                </button>

                <button
                  type="button"
                  onClick={handleConfirm}
                  className="rounded-2xl border border-rose-200/80 bg-rose-50/80 px-4 py-2 text-sm font-medium text-rose-600 transition-[background-color,border-color,color,opacity,transform] duration-150 hover:border-rose-300 hover:bg-rose-100 hover:text-rose-700 active:scale-[0.97] active:opacity-90 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/15 dark:hover:text-rose-200"
                >
                  {confirmLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}