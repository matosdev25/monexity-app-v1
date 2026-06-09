"use client";

import Link from "next/link";
import { useActionState, useState, useTransition, useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import {
  Building2,
  ImageIcon,
  LayoutDashboard,
  ShieldCheck,
  User2,
  CheckCircle2,
  AlertCircle,
  Monitor,
} from "lucide-react";
import { ThemeSelector } from "../../../components/theme-selector";
import { ButtonSpinner } from "../../../components/button-spinner";
import {
  updateBusinessSettings,
  disableInventory,
} from "./actions";
import type { UpdateBusinessState } from "./types";
import { PLAN_MAP } from "../../../lib/plans/plans";

type BusinessSettingsFormProps = {
  initialData: {
    companyId: string;
    companyName: string;
    contactFooter: string;
    logoUrl: string;
    logoStoredPath: string;
    logoIsUploadedPath: boolean;
    needsInventory: boolean;
    role: string;
    profileName: string;
    profileEmail: string;
    profilePhone: string;
    username: string;
    subscriptionPlan: string | null;
    invoiceRuc: string;
    invoiceDv: string;
    invoiceAddress: string;
    invoiceEmail: string;
    invoicePhone: string;
  };
  paymentMethodsSlot?: ReactNode;
};

function formatPlanLabel(value: string | null | undefined) {
  const plans: Record<string, string> = {
    emprende: "Emprende",
    control: "Control",
    equipo: "Equipo",
  };
  return plans[value ?? ""] ?? "Sin plan seleccionado";
}

function formatRoleLabel(value: string | null | undefined) {
  const roles: Record<string, string> = {
    owner: "Dueño",
    admin: "Administrador",
    seller: "Vendedor",
  };
  return roles[value ?? ""] ?? "Miembro";
}

const initialState: UpdateBusinessState = {
  success: false,
  fieldErrors: {},
};

function extractPanamaDigits(stored: string): string {
  const digits = stored.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("507")) return digits.slice(3);
  if (digits.length === 8) return digits;
  return "";
}

function buildPhoneHidden(digits: string): string {
  if (digits.length !== 8) return "";
  return `+507 ${digits.slice(0, 4)}-${digits.slice(4)}`;
}

function handleDigitsChange(raw: string, setter: (v: string) => void) {
  setter(raw.replace(/\D/g, "").slice(0, 8));
}

function PhoneInput({
  digits,
  onChange,
  id,
  errorMsg,
}: {
  digits: string;
  onChange: (v: string) => void;
  id: string;
  errorMsg?: string;
}) {
  const display =
    digits.length <= 4
      ? digits
      : `${digits.slice(0, 4)}-${digits.slice(4)}`;

  return (
    <div>
      <div
        className={[
          "flex items-center rounded-2xl border bg-[var(--surface-card-strong)] transition-[background-color,border-color,box-shadow] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] focus-within:shadow-[0_0_0_3px_rgba(14,165,233,0.12)] motion-reduce:transition-none sm:rounded-[20px]",
          errorMsg
            ? "border-red-400/70 focus-within:border-red-400 dark:border-red-400/50"
            : "border-app focus-within:border-app-strong",
        ].join(" ")}
      >
        <span className="select-none pl-4 pr-2 text-sm text-app-muted">+507</span>
        <div className="h-4 w-px bg-app shrink-0" />
        <input
          id={id}
          type="tel"
          inputMode="numeric"
          value={display}
          onChange={(e) => handleDigitsChange(e.target.value, onChange)}
          placeholder="6000-0000"
          maxLength={9}
          className="min-w-0 flex-1 bg-transparent py-2.5 sm:py-3.5 pr-4 pl-3 text-sm text-app outline-none placeholder:text-app-soft"
        />
      </div>
      {errorMsg && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-300">{errorMsg}</p>
      )}
    </div>
  );
}

// ── Dashboard widget prefs (localStorage only) ────────────────────────────────

const DASHBOARD_PREFS_KEY = "monexity:chart_prefs";

const WIDGET_ORDER = [
  "balance-pie",
  "daily-bar",
  "trend-line",
  "payment-methods",
  "top-products",
  "monthly-compare",
] as const;
type WidgetKey = typeof WIDGET_ORDER[number];

const WIDGET_LABELS: Record<WidgetKey, string> = {
  "balance-pie": "Balance del mes",
  "daily-bar": "Hoy vs ayer",
  "trend-line": "Tendencia",
  "payment-methods": "Métodos de pago",
  "top-products": "Productos vendidos",
  "monthly-compare": "Comparativo mensual",
};
const WIDGET_DESCS: Record<WidgetKey, string> = {
  "balance-pie": "Ventas vs. gastos del mes en curso",
  "daily-bar": "Comparación rápida de hoy y ayer",
  "trend-line": "Flujo del rango seleccionado",
  "payment-methods": "Ingresos agrupados por método de pago",
  "top-products": "Productos o servicios con más unidades vendidas",
  "monthly-compare": "Últimos 3 meses: ventas, gastos o balance",
};

function loadHiddenWidgets(): Set<WidgetKey> {
  try {
    const raw = localStorage.getItem(DASHBOARD_PREFS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.hiddenWidgets)) return new Set();
    return new Set<WidgetKey>(parsed.hiddenWidgets);
  } catch {
    return new Set();
  }
}

function saveHiddenWidgets(hidden: Set<WidgetKey>) {
  try {
    const raw = localStorage.getItem(DASHBOARD_PREFS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    localStorage.setItem(DASHBOARD_PREFS_KEY, JSON.stringify({ ...parsed, hiddenWidgets: [...hidden] }));
  } catch {}
}

function WidgetToggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={onToggle}
      className={[
        "relative inline-flex h-[26px] w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent",
        "transition-[background-color,box-shadow,transform] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:shadow-sm active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/45 motion-reduce:transition-none",
        enabled ? "bg-sky-500 dark:bg-cyan-400" : "bg-[var(--border-strong)]",
      ].join(" ")}
    >
      <span
        className={[
          "pointer-events-none h-[22px] w-[22px] rounded-full bg-white shadow-sm ring-0 transition-transform duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
          enabled ? "translate-x-[18px]" : "translate-x-0",
        ].join(" ")}
      />
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const labelClass =
  "mb-1.5 sm:mb-2 block text-xs sm:text-sm font-medium tracking-[-0.01em] text-app-muted";

const baseFieldClass =
  "w-full rounded-2xl border bg-[var(--surface-card-strong)] px-3 py-2.5 text-sm text-app outline-none transition-[background-color,border-color,box-shadow] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] placeholder:text-app-soft focus:shadow-[0_0_0_3px_rgba(14,165,233,0.12)] motion-reduce:transition-none sm:rounded-[20px] sm:px-4 sm:py-3.5";

const normalFieldClass =
  `${baseFieldClass} border-app focus:border-app-strong`;

const errorFieldClass =
  `${baseFieldClass} border-red-400/70 focus:border-red-400 dark:border-red-400/50 dark:focus:border-red-400/60`;

const errorTextClass = "mt-2 text-sm text-red-600 dark:text-red-300";

function SaveButton({ visible }: { visible: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      tabIndex={visible ? 0 : -1}
      disabled={pending}
      className="inline-flex items-center justify-center gap-2 rounded-full bg-sky-600 px-5 py-2 text-sm font-semibold text-white transition-[background-color,box-shadow,transform] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-sky-700 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/45 disabled:opacity-70 motion-reduce:transition-none dark:bg-cyan-400 dark:text-slate-950 dark:hover:bg-cyan-300"
    >
      {pending ? (
        <>
          <ButtonSpinner />
          Guardando...
        </>
      ) : "Guardar"}
    </button>
  );
}

export function BusinessSettingsForm({
  initialData,
  paymentMethodsSlot,
}: BusinessSettingsFormProps) {
  const router = useRouter();
  const [state, formAction] = useActionState(
    updateBusinessSettings,
    initialState
  );
  const [inventoryEnabled, setInventoryEnabled] = useState(
    initialData.needsInventory
  );
  const [phoneDigits, setPhoneDigits] = useState(() =>
    extractPanamaDigits(initialData.profilePhone)
  );
  const [bizPhoneDigits, setBizPhoneDigits] = useState(() =>
    extractPanamaDigits(initialData.invoicePhone)
  );
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [disableError, setDisableError] = useState<string | null>(null);
  const [isPendingDisable, startDisableTransition] = useTransition();
  const [showPlanLock, setShowPlanLock] = useState(false);
  const [showDestructive, setShowDestructive] = useState(false);
  const [dirtyFields, setDirtyFields] = useState<Set<string>>(new Set());
  const [hasFile, setHasFile] = useState(false);
  const [hiddenWidgets, setHiddenWidgets] = useState<Set<WidgetKey>>(new Set());
  const isOwner = String(initialData.role ?? "").toLowerCase() === "owner";

  const trackedInitials: Record<string, string> = {
    logoUrl: initialData.logoUrl,
    contactFooter: initialData.contactFooter,
    invoiceRuc: initialData.invoiceRuc,
    invoiceDv: initialData.invoiceDv,
    invoiceAddress: initialData.invoiceAddress,
    invoiceEmail: initialData.invoiceEmail,
  };

  const isDirty =
    dirtyFields.size > 0 ||
    hasFile ||
    phoneDigits !== extractPanamaDigits(initialData.profilePhone) ||
    bizPhoneDigits !== extractPanamaDigits(initialData.invoicePhone) ||
    inventoryEnabled !== initialData.needsInventory;

  useEffect(() => {
    if (state.success) {
      const timer = window.setTimeout(() => {
        setDirtyFields(new Set());
        setHasFile(false);
      }, 0);

      return () => window.clearTimeout(timer);
    }
  }, [state.success]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setHiddenWidgets(loadHiddenWidgets());
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  function handleWidgetToggle(key: WidgetKey) {
    setHiddenWidgets((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      saveHiddenWidgets(next);
      return next;
    });
  }

  function handleFormChange(e: React.FormEvent<HTMLFormElement>) {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement;
    const { name } = target;
    if (!name) return;

    if (name === "logoFile") {
      setHasFile(((target as HTMLInputElement).files?.length ?? 0) > 0);
      return;
    }

    if (!(name in trackedInitials)) return;

    const current = (target as HTMLInputElement | HTMLTextAreaElement).value;
    setDirtyFields((prev) => {
      const next = new Set(prev);
      if (current !== trackedInitials[name]) {
        next.add(name);
      } else {
        next.delete(name);
      }
      return next;
    });
  }

  const touch = (name: string) =>
    setTouched((prev) => ({ ...prev, [name]: true }));

  function handleActivateClick() {
    const planConfig = PLAN_MAP[initialData.subscriptionPlan ?? ""];
    if (planConfig && !planConfig.hasInventory) {
      setShowPlanLock(true);
      return;
    }
    setInventoryEnabled(true);
  }

  function handleDeactivateClick() {
    if (initialData.needsInventory) {
      setShowDestructive(true);
      return;
    }
    setInventoryEnabled(false);
  }

  function handleConfirmDisable() {
    setDisableError(null);
    setShowDestructive(false);
    startDisableTransition(async () => {
      const result = await disableInventory(initialData.companyId);
      if (result.success) {
        setInventoryEnabled(false);
        router.refresh();
      } else {
        setDisableError(result.error ?? "No se pudo desactivar el inventario.");
      }
    });
  }

  const getFieldClass = (
    name: "companyName" | "logoUrl" | "contactFooter"
  ) =>
    touched[name] && state.fieldErrors?.[name]
      ? errorFieldClass
      : normalFieldClass;

  return (
    <form action={formAction} onChange={handleFormChange}>
      <div className="grid gap-3 sm:gap-4 pb-16 sm:pb-24 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-3 sm:space-y-4">
          {state.formError && (
            <div className="flex items-start gap-3 rounded-[22px] border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{state.formError}</p>
            </div>
          )}

          {state.success && (
            <div className="flex items-start gap-3 rounded-[22px] border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-200">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Los cambios del negocio se guardaron correctamente.</p>
            </div>
          )}

          <section className="app-card rounded-[28px] p-4 sm:p-6">
            <div className="mb-3 sm:mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold tracking-[-0.02em] text-app">
                  Información general
                </h2>
                <p className="mt-1 text-sm text-app-soft">
                  Datos principales de tu empresa dentro de Monexity.
                </p>
              </div>

              <div className="rounded-full border border-app bg-app-soft p-2 text-app-muted">
                <Building2 className="h-4 w-4" />
              </div>
            </div>

            <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="companyName" className={labelClass}>
                  Nombre del negocio
                </label>
                <input
                  id="companyName"
                  name="companyName"
                  type="text"
                  value={initialData.companyName}
                  readOnly
                  className={`${normalFieldClass} cursor-not-allowed opacity-65 select-none`}
                />
                <p className="mt-1.5 text-xs text-app-soft">
                  El nombre de la empresa no se puede cambiar desde aquí.
                </p>
              </div>

              <div>
                <label htmlFor="companyId" className={labelClass}>
                  ID de empresa
                </label>
                <input
                  id="companyId"
                  name="companyId"
                  type="text"
                  defaultValue={initialData.companyId}
                  readOnly
                  className={`${normalFieldClass} cursor-not-allowed opacity-65`}
                />
              </div>
            </div>
          </section>

          <section className="app-card rounded-[28px] p-4 sm:p-6">
            <div className="mb-3 sm:mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold tracking-[-0.02em] text-app">
                  Personalización
                </h2>
                <p className="mt-1 text-sm text-app-soft">
                  Elementos visuales y texto corto para tu negocio.
                </p>
              </div>

              <div className="rounded-full border border-app bg-app-soft p-2 text-app-muted">
                <ImageIcon className="h-4 w-4" />
              </div>
            </div>

            <div className="space-y-3 sm:space-y-4">
              <div>
                <label htmlFor="logoFile" className={labelClass}>
                  {initialData.logoIsUploadedPath ? "Reemplazar logo" : "Subir logo"}
                </label>

                <div className="overflow-hidden rounded-[22px] border border-dashed border-app bg-app-soft p-4">
                  <input
                    id="logoFile"
                    name="logoFile"
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                    className="block w-full text-sm text-app file:mr-4 file:rounded-full file:border-0 file:bg-sky-600 file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-white file:transition-[background-color,color] file:duration-[180ms] file:ease-[cubic-bezier(0.16,1,0.3,1)] hover:file:bg-sky-700 dark:file:bg-cyan-400 dark:file:text-slate-950 dark:hover:file:bg-cyan-300"
                  />
                  <p className="mt-3 text-xs text-app-soft">
                    PNG, JPG, WEBP o SVG. Máximo 2 MB.
                  </p>
                </div>

                {state.fieldErrors?.logoFile && (
                  <p className={errorTextClass}>{state.fieldErrors.logoFile}</p>
                )}
              </div>

              {initialData.logoUrl && (
                <div>
                  <p className="mb-2 block text-sm font-medium tracking-[-0.01em] text-app-muted">
                    Logo actual
                  </p>

                  <div className="flex items-center gap-4 rounded-[22px] border border-app bg-app-soft p-4">
                    <img
                      src={initialData.logoUrl}
                      alt="Logo del negocio"
                      className="h-16 w-16 rounded-2xl object-cover ring-1 ring-[var(--border-strong)]"
                    />

                    <div className="min-w-0">
                      <p className="text-sm text-app-muted">
                        Logo guardado actualmente
                      </p>
                      {!initialData.logoIsUploadedPath && (
                        <p className="truncate text-xs text-app-soft">
                          {initialData.logoUrl}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {initialData.logoIsUploadedPath && (
                <input
                  type="hidden"
                  name="logoStoredPath"
                  value={initialData.logoStoredPath}
                />
              )}

              {!initialData.logoIsUploadedPath && (
                <div>
                  <label htmlFor="logoUrl" className={labelClass}>
                    O usa una URL del logo
                  </label>
                  <input
                    id="logoUrl"
                    name="logoUrl"
                    type="url"
                    defaultValue={initialData.logoUrl}
                    placeholder="https://tusitio.com/logo.png"
                    className={getFieldClass("logoUrl")}
                    onBlur={() => touch("logoUrl")}
                  />
                  {touched.logoUrl && state.fieldErrors?.logoUrl && (
                    <p className={errorTextClass}>{state.fieldErrors.logoUrl}</p>
                  )}
                </div>
              )}

              <div className="rounded-[22px] border border-app bg-app-soft/50 p-3 sm:p-4 space-y-3 sm:space-y-4">
                <p className="text-sm font-medium text-app-muted">
                  Datos del emisor
                </p>
                <p className="text-xs text-app-soft -mt-2">
                  Aparecen en tus facturas. Todos los campos son opcionales.
                </p>

                <div className="grid grid-cols-[1fr_80px] gap-3 sm:gap-4">
                  <div>
                    <label htmlFor="invoiceRuc" className={labelClass}>
                      RUC
                    </label>
                    <input
                      id="invoiceRuc"
                      name="invoiceRuc"
                      type="text"
                      defaultValue={initialData.invoiceRuc}
                      placeholder="8-123-456789"
                      maxLength={30}
                      className={normalFieldClass}
                    />
                  </div>

                  <div>
                    <label htmlFor="invoiceDv" className={labelClass}>
                      DV
                    </label>
                    <input
                      id="invoiceDv"
                      name="invoiceDv"
                      type="text"
                      defaultValue={initialData.invoiceDv}
                      placeholder="12"
                      maxLength={5}
                      className={normalFieldClass}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="invoiceAddress" className={labelClass}>
                    Dirección
                  </label>
                  <input
                    id="invoiceAddress"
                    name="invoiceAddress"
                    type="text"
                    defaultValue={initialData.invoiceAddress}
                    placeholder="Ciudad de Panamá, Panamá"
                    maxLength={200}
                    className={normalFieldClass}
                  />
                </div>

                <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="invoicePhone" className={labelClass}>
                      Teléfono del negocio
                    </label>
                    <input
                      type="hidden"
                      name="invoicePhone"
                      value={buildPhoneHidden(bizPhoneDigits)}
                    />
                    <PhoneInput
                      id="invoicePhone"
                      digits={bizPhoneDigits}
                      onChange={setBizPhoneDigits}
                    />
                  </div>

                  <div>
                    <label htmlFor="invoiceEmail" className={labelClass}>
                      Correo del negocio
                    </label>
                    <input
                      id="invoiceEmail"
                      name="invoiceEmail"
                      type="email"
                      defaultValue={initialData.invoiceEmail}
                      placeholder="factura@minegocio.com"
                      maxLength={120}
                      className={normalFieldClass}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="contactFooter" className={labelClass}>
                    Nota adicional
                  </label>
                  <textarea
                    id="contactFooter"
                    name="contactFooter"
                    defaultValue={initialData.contactFooter}
                    placeholder="Ej: Exento de ITBMS"
                    rows={2}
                    maxLength={300}
                    className={`${getFieldClass("contactFooter")} resize-none`}
                    onBlur={() => touch("contactFooter")}
                  />
                  {touched.contactFooter && state.fieldErrors?.contactFooter && (
                    <p className={errorTextClass}>
                      {state.fieldErrors.contactFooter}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </section>

          {paymentMethodsSlot ?? null}

          <section className="app-card rounded-[28px] p-4 sm:p-6">
            <div className="mb-3 sm:mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold tracking-[-0.02em] text-app">
                  Operación
                </h2>
                <p className="mt-1 text-sm text-app-soft">
                  Ajustes base del funcionamiento de la empresa.
                </p>
              </div>

              <div className="rounded-full border border-app bg-app-soft p-2 text-app-muted">
                <ShieldCheck className="h-4 w-4" />
              </div>
            </div>

            <div>
              <label className={labelClass}>Inventario</label>

              <div className="inline-grid w-full grid-cols-2 rounded-[20px] border border-app bg-app-soft p-1">
                <button
                  type="button"
                  onClick={handleActivateClick}
                  className={[
                    "rounded-[16px] px-4 py-3 text-sm font-medium transition-[background-color,color,box-shadow,transform] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/45 motion-reduce:transition-none",
                    inventoryEnabled
                      ? "bg-[var(--surface-card-strong)] text-app shadow-sm ring-1 ring-[var(--border-strong)]"
                      : "text-app-muted hover:text-app",
                  ].join(" ")}
                >
                  <span className="flex items-center justify-center gap-2">
                    {inventoryEnabled && (
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    )}
                    Activado
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleDeactivateClick}
                  className={[
                    "rounded-[16px] px-4 py-3 text-sm font-medium transition-[background-color,color,box-shadow,transform] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/45 motion-reduce:transition-none",
                    !inventoryEnabled
                      ? "bg-[var(--surface-card-strong)] text-app shadow-sm ring-1 ring-[var(--border-strong)]"
                      : "text-app-muted hover:text-app",
                  ].join(" ")}
                >
                  Desactivado
                </button>
              </div>

              <input
                type="hidden"
                name="needsInventory"
                value={inventoryEnabled ? "yes" : "no"}
              />

              {(state.fieldErrors?.needsInventory || disableError) && (
                <p className={errorTextClass}>
                  {state.fieldErrors?.needsInventory ?? disableError}
                </p>
              )}
            </div>
          </section>

          <section className="app-card rounded-[28px] p-4 sm:p-6">
            <div className="mb-3 sm:mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold tracking-[-0.02em] text-app">
                  Dashboard
                </h2>
                <p className="mt-1 text-sm text-app-soft">
                  Elige qué widgets ver en el panel principal.
                </p>
              </div>
              <div className="rounded-full border border-app bg-app-soft p-2 text-app-muted">
                <LayoutDashboard className="h-4 w-4" />
              </div>
            </div>

            <div className="divide-y divide-app">
              {WIDGET_ORDER.map((key) => (
                <div
                  key={key}
                  className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-app">{WIDGET_LABELS[key]}</p>
                    <p className="mt-0.5 text-xs text-app-soft">{WIDGET_DESCS[key]}</p>
                  </div>
                  <WidgetToggle
                    enabled={!hiddenWidgets.has(key)}
                    onToggle={() => handleWidgetToggle(key)}
                  />
                </div>
              ))}
            </div>

            <p className="mt-4 text-[11px] text-app-soft">
              Se aplica solo en este dispositivo.
            </p>
          </section>

          {/* Modal: plan no incluye inventario */}
          {showPlanLock && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div
                className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
                onClick={() => setShowPlanLock(false)}
                aria-hidden="true"
              />
              <div className="app-card-strong relative w-full max-w-sm overflow-hidden rounded-[28px] shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
                <div className="p-6">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-[14px] bg-amber-500/15">
                    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-amber-500" aria-hidden="true">
                      <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <h3 className="text-base font-semibold tracking-[-0.02em] text-app">
                    Este plan no incluye inventario
                  </h3>
                  <p className="mt-2 text-sm text-app-soft">
                    El plan <strong className="font-medium text-app-muted">{formatPlanLabel(initialData.subscriptionPlan)}</strong> no incluye el módulo de inventario. Cambia a Control o Equipo para activarlo.
                  </p>
                  <div className="mt-5 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowPlanLock(false)}
                      className="flex-1 rounded-[18px] border border-app bg-app-soft px-4 py-2.5 text-sm text-app-muted transition-[background-color,border-color,color,transform] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-app-strong hover:text-app active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/45 motion-reduce:transition-none"
                    >
                      Ahora no
                    </button>
                    {isOwner ? (
                      <Link
                        href={`/onboarding/plan?cid=${initialData.companyId}`}
                        onClick={() => setShowPlanLock(false)}
                        className="flex flex-1 items-center justify-center rounded-[18px] bg-sky-600 px-4 py-2.5 text-sm font-medium text-white transition-[background-color,box-shadow,transform] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-sky-700 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/45 motion-reduce:transition-none dark:bg-cyan-400 dark:text-slate-950 dark:hover:bg-cyan-300"
                      >
                        Cambiar plan
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Modal: desactivar inventario (destructivo) */}
          {showDestructive && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div
                className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
                onClick={() => setShowDestructive(false)}
                aria-hidden="true"
              />
              <div className="app-card-strong relative w-full max-w-sm overflow-hidden rounded-[28px] shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
                <div className="p-6">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-[14px] bg-red-500/10">
                    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-red-500" aria-hidden="true">
                      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <h3 className="text-base font-semibold tracking-[-0.02em] text-app">
                    Desactivar inventario
                  </h3>
                  <p className="mt-2 text-sm text-app-soft">
                    Se eliminarán <strong className="font-medium text-red-600 dark:text-red-400">todos los productos</strong> de tu negocio. Esta acción no se puede deshacer.
                  </p>
                  <div className="mt-5 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowDestructive(false)}
                      className="flex-1 rounded-[18px] border border-app bg-app-soft px-4 py-2.5 text-sm text-app-muted transition-[background-color,border-color,color,transform] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-app-strong hover:text-app active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/45 motion-reduce:transition-none"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmDisable}
                      disabled={isPendingDisable}
                      className="flex-1 rounded-[18px] bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-[background-color,box-shadow,transform] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-red-500 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/45 disabled:opacity-60 motion-reduce:transition-none"
                    >
                      {isPendingDisable ? "Borrando..." : "Sí, desactivar y borrar"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <aside className="min-w-0 order-first space-y-4 lg:order-last">
          <section className="app-card rounded-[28px] p-4 sm:p-6">
            <h3 className="text-base font-semibold text-app">Tu acceso</h3>

            <div className="mt-3 space-y-2 sm:space-y-3 text-sm text-app-soft">
              <div className="flex items-start gap-3">
                <User2 className="mt-0.5 h-4 w-4 text-app-soft" />
                <div>
                  <p className="text-app-muted">
                    {initialData.profileName || "Sin nombre"}
                  </p>
                  <p className="text-app-soft">
                    @{initialData.username || "sin-username"}
                  </p>
                </div>
              </div>

              <div className="rounded-[20px] border border-app bg-app-soft px-3 py-2 sm:px-4 sm:py-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-app-soft">
                  Rol actual
                </p>
                <p className="mt-1 text-sm font-medium text-app-muted">
                  {formatRoleLabel(initialData.role)}
                </p>
              </div>

              <div className="rounded-[20px] border border-app bg-app-soft px-3 py-2 sm:px-4 sm:py-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-app-soft">
                  Correo
                </p>
                <p className="mt-1 truncate text-sm text-app-muted">
                  {initialData.profileEmail || "No disponible"}
                </p>
              </div>

              <div className="rounded-[20px] border border-app bg-app-soft px-3 py-2 sm:px-4 sm:py-3">
                <label
                  htmlFor="profilePhone"
                  className="text-[11px] uppercase tracking-[0.18em] text-app-soft"
                >
                  Teléfono
                </label>
                <input
                  type="hidden"
                  name="profilePhone"
                  value={buildPhoneHidden(phoneDigits)}
                />
                <div className="mt-1 flex items-center gap-2">
                  <span className="select-none text-sm text-app-muted">+507</span>
                  <div className="h-3.5 w-px bg-app shrink-0" />
                  <input
                    id="profilePhone"
                    type="tel"
                    inputMode="numeric"
                    value={phoneDigits.length <= 4 ? phoneDigits : `${phoneDigits.slice(0, 4)}-${phoneDigits.slice(4)}`}
                    onChange={(e) => handleDigitsChange(e.target.value, setPhoneDigits)}
                    placeholder="6000-0000"
                    maxLength={9}
                    className="min-w-0 flex-1 bg-transparent text-sm text-app outline-none placeholder:text-app-soft focus-visible:outline-none"
                  />
                </div>
                {state.fieldErrors?.profilePhone && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-300">
                    {state.fieldErrors.profilePhone}
                  </p>
                )}
              </div>
            </div>

          </section>

          {/* Apariencia */}
          <section className="app-card rounded-[28px] p-4 sm:p-6">
            <div className="mb-3 flex items-start justify-between gap-4">
              <h3 className="text-base font-semibold text-app">Apariencia</h3>
              <div className="rounded-full border border-app bg-app-soft p-2 text-app-muted">
                <Monitor className="h-4 w-4" />
              </div>
            </div>
            <ThemeSelector />
          </section>
        </aside>
      </div>

      {/* Floating save bar */}
      <div className="sticky bottom-0 z-20 mt-4 flex justify-center px-4 pb-6 pt-1 pointer-events-none">
        <div
          className={[
            "w-full max-w-xs transition-[opacity,transform] motion-reduce:transition-none sm:w-auto sm:max-w-none",
            isDirty
              ? "pointer-events-auto opacity-100 translate-y-0 duration-[180ms]"
              : "pointer-events-none opacity-0 translate-y-3 duration-[180ms]",
          ].join(" ")}
          aria-hidden={!isDirty}
        >
          <div className="app-card-strong flex items-center justify-between gap-3 rounded-full py-2 pl-5 pr-2 shadow-[0_8px_30px_rgba(0,0,0,0.12)] sm:justify-start">
            <span className="whitespace-nowrap text-sm font-medium text-app-muted">
              <span className="hidden sm:inline">Recuerda guardar tus cambios</span>
              <span className="sm:hidden">Cambios sin guardar</span>
            </span>
            <SaveButton visible={isDirty} />
          </div>
        </div>
      </div>
    </form>
  );
}
