"use client";

import { useEffect, useRef } from "react";

// Accesibilidad compartida de modales (sin dependencias):
//   * guarda el foco del disparador y lo devuelve al cerrar;
//   * mueve el foco al diálogo ([data-autofocus] o primer control que no abra
//     el teclado en mobile; si no hay, el propio panel);
//   * confina Tab / Shift+Tab dentro del diálogo activo;
//   * Escape cierra solo el diálogo superior (pila para modales anidados).
// El panel debe llevar role="dialog", aria-modal="true" y aria-labelledby.

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  'input:not([disabled]):not([type="hidden"])',
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

const TEXT_ENTRY_TYPES = new Set([
  "text", "email", "tel", "number", "password", "search", "url", "date",
  "datetime-local", "month", "time", "week",
]);

type StackEntry = { id: symbol };
const dialogStack: StackEntry[] = [];

// ── Bloqueo de scroll compartido ──────────────────────────────────────────────
// Con modales anidados (p. ej. plan de cuotas dentro de "Nueva venta"), cerrar el
// hijo no debe desbloquear el fondo: solo se restaura al liberar el último bloqueo.
let scrollLockCount = 0;
let savedScrollState: {
  bodyOverflow: string;
  container: HTMLElement | null;
  containerOverflowY: string;
} | null = null;

export function lockBodyScroll(): () => void {
  if (scrollLockCount === 0) {
    const container = document.querySelector<HTMLElement>("[data-scroll-container]");
    savedScrollState = {
      bodyOverflow: document.body.style.overflow,
      container,
      containerOverflowY: container?.style.overflowY ?? "",
    };
    document.body.style.overflow = "hidden";
    if (container) container.style.overflowY = "hidden";
  }
  scrollLockCount += 1;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    scrollLockCount = Math.max(0, scrollLockCount - 1);
    if (scrollLockCount === 0 && savedScrollState) {
      document.body.style.overflow = savedScrollState.bodyOverflow;
      if (savedScrollState.container) {
        savedScrollState.container.style.overflowY = savedScrollState.containerOverflowY;
      }
      savedScrollState = null;
    }
  };
}

function getFocusable(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.closest("[inert]") && el.getClientRects().length > 0
  );
}

function isTextEntry(el: HTMLElement) {
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLInputElement) return TEXT_ENTRY_TYPES.has(el.type);
  return el.isContentEditable;
}

type Options = {
  open: boolean;
  onClose?: () => void;
  // false para diálogos obligatorios (p. ej. aceptación legal)
  closeOnEscape?: boolean;
};

export function useModalAccessibility<T extends HTMLElement = HTMLDivElement>({
  open,
  onClose,
  closeOnEscape = true,
}: Options) {
  const panelRef = useRef<T | null>(null);
  const onCloseRef = useRef(onClose);
  const closeOnEscapeRef = useRef(closeOnEscape);

  useEffect(() => {
    onCloseRef.current = onClose;
    closeOnEscapeRef.current = closeOnEscape;
  });

  useEffect(() => {
    if (!open) return;

    const entry: StackEntry = { id: Symbol("dialog") };
    dialogStack.push(entry);
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const isTop = () => dialogStack[dialogStack.length - 1] === entry;

    // El panel puede montarse un frame después (portales / animaciones)
    const frame = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel || panel.contains(document.activeElement)) return;
      if (!panel.hasAttribute("tabindex")) panel.setAttribute("tabindex", "-1");

      const focusable = getFocusable(panel);
      const target =
        panel.querySelector<HTMLElement>("[data-autofocus]") ??
        focusable.find((el) => !isTextEntry(el)) ??
        panel;
      target.focus({ preventScroll: true });
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (!isTop()) return;
      const panel = panelRef.current;
      if (!panel) return;

      if (event.key === "Escape") {
        if (!closeOnEscapeRef.current || !onCloseRef.current) return;
        // Un desplegable abierto dentro del diálogo ([data-escape-layer]) se cierra primero:
        // el propio desplegable escucha Escape en document (sin depender del foco) y,
        // una vez cerrado, el siguiente Escape cierra el diálogo.
        if (panel.querySelector("[data-escape-layer]")) return;
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab") return;
      const focusable = getFocusable(panel);
      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus({ preventScroll: true });
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      const inside = !!active && panel.contains(active);

      if (event.shiftKey && (!inside || active === first || active === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (!inside || active === last)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown, true);
      const index = dialogStack.indexOf(entry);
      if (index !== -1) dialogStack.splice(index, 1);
      // Devuelve el foco al disparador si sigue en el documento
      if (previouslyFocused && previouslyFocused.isConnected) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [open]);

  return panelRef;
}
