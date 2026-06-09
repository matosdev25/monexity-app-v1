"use client";

import { useFormStatus } from "react-dom";

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
      className={`transition-[opacity,transform] duration-150 active:scale-[0.97] active:opacity-90 disabled:pointer-events-none ${className ?? ""}`}
    >
      {pending ? pendingText : idleText}
    </button>
  );
}
