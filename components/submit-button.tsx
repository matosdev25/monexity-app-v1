"use client";

import type { MouseEventHandler, ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { ButtonSpinner } from "./button-spinner";

type SubmitButtonProps = {
  idleText: string;
  pendingText: string;
  className?: string;
};

export function SubmitButton({
  idleText,
  pendingText,
  className,
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      aria-busy={pending}
      className={`transition-[opacity,transform] duration-150 active:scale-[0.97] active:opacity-90 disabled:pointer-events-none ${className ?? ""}`}
    >
      {pending ? (
        <span className="inline-flex items-center justify-center gap-2">
          <ButtonSpinner variant="current" />
          {pendingText}
        </span>
      ) : (
        idleText
      )}
    </button>
  );
}

type FormSubmitButtonProps = {
  children: ReactNode;
  pendingText?: string;
  className?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
};

// Botón submit para formularios de Server Actions sin estado propio:
// conserva el className exacto y bloquea el doble envío mientras está pendiente.
export function FormSubmitButton({
  children,
  pendingText,
  className,
  onClick,
}: FormSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      onClick={onClick}
      disabled={pending}
      aria-disabled={pending}
      aria-busy={pending}
      className={`disabled:cursor-not-allowed disabled:opacity-60 ${className ?? ""}`}
    >
      {pending ? (
        <span className="inline-flex items-center justify-center gap-2">
          <ButtonSpinner variant="current" />
          {pendingText ?? children}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
