"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";

// Split de bundle: carga el form solo al primer uso
const CreateExpenseForm = dynamic(
  () => import("./create-expense-form").then((m) => ({ default: m.CreateExpenseForm })),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-3 pt-1 animate-pulse">
        <div className="h-10 rounded-2xl bg-slate-100 dark:bg-slate-800" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-10 rounded-2xl bg-slate-100 dark:bg-slate-800" />
          <div className="h-10 rounded-2xl bg-slate-100 dark:bg-slate-800" />
        </div>
        <div className="h-10 rounded-2xl bg-slate-100 dark:bg-slate-800" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-10 rounded-2xl bg-slate-100 dark:bg-slate-800" />
          <div className="h-10 rounded-2xl bg-slate-100 dark:bg-slate-800" />
        </div>
        <div className="h-20 rounded-2xl bg-slate-100 dark:bg-slate-800" />
        <div className="h-11 rounded-2xl bg-slate-100 dark:bg-slate-800" />
      </div>
    ),
  }
);

type CreateExpenseQuickModalProps = {
  today: string;
  canEditManualDates?: boolean;
  trigger?: ReactNode;
};

const defaultTriggerClass =
  "inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 shadow-[0_6px_18px_rgba(15,23,42,0.03)] transition-colors duration-150 hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:bg-white/4 dark:text-white dark:shadow-none dark:hover:border-white/20 dark:hover:bg-white/[0.06]";

export function CreateExpenseQuickModal({
  today,
  canEditManualDates = false,
  trigger,
}: CreateExpenseQuickModalProps) {
  const [open, setOpen] = useState(false);
  // Una vez abierto, el portal persiste (solo se oculta con CSS)
  const [everOpened, setEverOpened] = useState(false);
  // Cambia al cerrar para resetear el form mientras está oculto
  const [formKey, setFormKey] = useState(0);
  // Cambia al abrir para re-disparar animate-mx-scale-in en el panel
  const [animKey, setAnimKey] = useState(0);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const closeModal = useCallback(() => {
    setOpen(false);
    clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => setFormKey((k) => k + 1), 50);
  }, []);

  const openModal = useCallback(() => {
    clearTimeout(resetTimerRef.current);
    setEverOpened(true);
    setAnimKey((k) => k + 1);
    setOpen(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") closeModal(); };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, closeModal]);

  const modalContent =
    everOpened
      ? createPortal(
          <div
            className="fixed inset-0 z-999"
            style={open ? undefined : { display: "none" }}
          >
            <button
              type="button"
              aria-label="Cerrar modal"
              className="animate-mx-fade-in absolute inset-0 bg-slate-950/35 backdrop-blur-sm dark:bg-slate-950/55"
              onClick={closeModal}
            />

            <div className="absolute inset-0 overflow-y-auto overscroll-contain p-4">
              <div className="flex min-h-full items-center justify-center">
                <div key={animKey} className="animate-mx-scale-in relative my-4 w-full max-w-2xl rounded-[28px] border border-slate-200 bg-white/95 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.18)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/80 dark:shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Registro rápido
                      </p>
                      <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
                        Nuevo gasto
                      </h2>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                        Registra un gasto sin salir del dashboard.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={closeModal}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition-colors duration-150 hover:border-slate-300 hover:text-slate-950 dark:border-white/10 dark:bg-white/4 dark:text-slate-300 dark:hover:border-white/20 dark:hover:text-white"
                      aria-label="Cerrar modal"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50/90 p-4 shadow-[0_6px_18px_rgba(15,23,42,0.03)] dark:border-white/10 dark:bg-white/4 dark:shadow-none">
                    <CreateExpenseForm
                      key={formKey}
                      today={today}
                      canEditManualDates={canEditManualDates}
                      onSuccess={closeModal}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      {trigger ? (
        <div
          role="button"
          tabIndex={0}
          className="cursor-pointer"
          onClick={openModal}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openModal();
            }
          }}
        >
          {trigger}
        </div>
      ) : (
        <button type="button" onClick={openModal} className={defaultTriggerClass}>
          Nuevo gasto
        </button>
      )}

      {modalContent}
    </>
  );
}
