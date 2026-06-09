"use client";

import { useState } from "react";
import { formatInviteCode } from "../../../lib/invites/invite-utils";

type InviteCodeDisplayProps = {
  code: string;
};

export function InviteCodeDisplay({ code }: InviteCodeDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // fallback silencioso
    }
  };

  const formatted = formatInviteCode(code);
  const parts = formatted.split("-");

  return (
    <div className="flex items-center gap-2.5">
      <div className="flex items-center gap-1">
        {parts.map((part, i) => (
          <span key={i} className="flex items-center gap-1">
            <span className="font-mono text-[15px] font-semibold tracking-[0.12em] text-app">
              {part}
            </span>
            {i < parts.length - 1 && (
              <span className="select-none text-xs text-app-soft">·</span>
            )}
          </span>
        ))}
      </div>

      <button
        type="button"
        onClick={handleCopy}
        aria-label="Copiar código"
        className={[
          "inline-flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-medium transition-all duration-150",
          copied
            ? "border-emerald-300/60 bg-emerald-50/80 text-emerald-600 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
            : "border-app bg-app-soft text-app-muted hover:text-app",
        ].join(" ")}
      >
        {copied ? (
          <>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3 w-3"
              aria-hidden="true"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
            Copiado
          </>
        ) : (
          <>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3 w-3"
              aria-hidden="true"
            >
              <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
            </svg>
            Copiar
          </>
        )}
      </button>
    </div>
  );
}