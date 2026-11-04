"use client";

import { useActionState } from "react";
import { ConfirmSubmitButton } from "../../../components/confirm-submit-button";
import { deleteSale } from "./actions";

type ActionState = {
  success: boolean;
  message: string;
  timestamp?: number;
};

const initialState: ActionState = {
  success: false,
  message: "",
};

export function DeleteSaleForm({
  saleId,
  className,
}: {
  saleId: string;
  className: string;
}) {
  const [state, formAction] = useActionState(deleteSale, initialState);

  return (
    <form action={formAction}>
      <input type="hidden" name="saleId" value={saleId} />
      <ConfirmSubmitButton
        label="Eliminar"
        pendingLabel="Eliminando..."
        title="Eliminar factura"
        confirmMessage="Esta acción eliminará la venta y devolverá las existencias al inventario."
        confirmLabel="Sí, eliminar"
        className={className}
      />
      {!state.success && state.message ? (
        <p role="alert" className="mt-1 text-xs text-rose-500 dark:text-rose-300">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
