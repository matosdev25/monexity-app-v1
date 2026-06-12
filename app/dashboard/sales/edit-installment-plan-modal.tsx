"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  InstallmentPlanModal,
  type InstallmentPlanData,
  defaultPlanData,
} from "./installment-plan-modal";
import {
  fetchEditableInstallmentPlan,
  updateSaleInstallmentPlan,
  type EditableInstallmentPlan,
} from "./actions";
import type { Sale } from "./types";

function toInitialPlanData(plan: EditableInstallmentPlan): InstallmentPlanData {
  return {
    customerPhone: plan.customerPhone ?? "",
    rawPaidAmount: String(plan.downPaymentAmount || ""),
    rawInstallmentAmount: String(plan.installmentAmount || ""),
    installmentsCount: String(plan.installmentsCount || ""),
    frequency: plan.frequency,
    startDate: plan.startDate,
    planName: plan.planName ?? "",
    planNotes: plan.planNotes ?? "",
  };
}

export function EditInstallmentPlanModal({ sale }: { sale: Sale }) {
  const router = useRouter();
  const [plan, setPlan] = useState<EditableInstallmentPlan | null>(null);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [isLoading, startLoading] = useTransition();
  const [isSaving, startSaving] = useTransition();

  function handleOpen() {
    setMessage("");
    startLoading(async () => {
      const currentPlan = await fetchEditableInstallmentPlan(sale.id);

      if (!currentPlan) {
        setMessage("No se pudo cargar el plan de cuotas.");
        return;
      }

      setPlan(currentPlan);
      setOpen(true);
    });
  }

  function handleConfirm(data: InstallmentPlanData) {
    setMessage("");
    startSaving(async () => {
      const formData = new FormData();
      formData.set("saleId", sale.id);
      formData.set("customerPhone", data.customerPhone);
      formData.set("paidAmount", data.rawPaidAmount);
      formData.set("installmentAmount", data.rawInstallmentAmount);
      formData.set("installmentsCount", data.installmentsCount);
      formData.set("frequency", data.frequency);
      formData.set("startDate", data.startDate);
      formData.set("planName", data.planName);
      formData.set("planNotes", data.planNotes);

      const result = await updateSaleInstallmentPlan(
        { success: false, message: "" },
        formData
      );

      setMessage(result.message);

      if (result.success) {
        router.refresh();
      }
    });
  }

  const initialData = plan ? toInitialPlanData(plan) : defaultPlanData;
  const totalAmount = plan?.saleAmount ?? Number(sale.amount ?? 0);

  return (
    <>
      <div className="inline-flex flex-col gap-1">
        <button
          type="button"
          onClick={handleOpen}
          disabled={isLoading || isSaving}
          className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 transition-[background-color,border-color,color,opacity,transform] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-amber-300 hover:bg-amber-100 hover:text-amber-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/15 dark:hover:text-amber-200"
        >
          {isLoading ? "Cargando..." : isSaving ? "Guardando..." : "Editar cuotas"}
        </button>

        {message ? (
          <p className="max-w-48 text-xs text-slate-500 dark:text-slate-400">
            {message}
          </p>
        ) : null}
      </div>

      <InstallmentPlanModal
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={handleConfirm}
        initialData={initialData}
        totalAmount={totalAmount}
        today={initialData.startDate || new Date().toISOString().slice(0, 10)}
      />
    </>
  );
}
