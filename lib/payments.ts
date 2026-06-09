export type PaymentMethodOption = {
  value: string;
  label: string;
};

// Tipo compartido para métodos de pago enriquecidos (de DB o fallback).
// Definido aquí para que componentes client de cualquier módulo puedan importarlo
// sin cruzar la barrera "use server" de sales/actions.
export type PaymentMethodOptionFull = {
  id: string;
  type: string;
  label: string;
  details: string | null;
};

export const PAYMENT_METHODS: readonly PaymentMethodOption[] = [
  { value: "cash",     label: "Efectivo" },
  { value: "card",     label: "Tarjeta" },
  { value: "transfer", label: "Transferencia" },
  { value: "yappy",    label: "Yappy" },
  { value: "other",    label: "Otro" },
];
