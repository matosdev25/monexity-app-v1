import type { Sale } from "./types";

export function roundMoney(value: number) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

type SalePaymentSummaryInput = {
  sale: Pick<Sale, "amount" | "payment_type" | "has_payment_plan"> &
    Partial<Pick<Sale, "paid_amount" | "balance_due">>;
  paymentsAmount?: number;
  downPaymentAmount?: number;
};

export function calculateSalePaymentSummary({
  sale,
  paymentsAmount = 0,
  downPaymentAmount = 0,
}: SalePaymentSummaryInput) {
  const total = roundMoney(Number(sale.amount ?? 0));
  const storedPaid = roundMoney(Number(sale.paid_amount ?? 0));
  const storedBalance = roundMoney(Number(sale.balance_due ?? total));
  const paidFromBalance = roundMoney(Math.max(0, total - storedBalance));
  const laterPayments = roundMoney(Math.max(0, paymentsAmount));
  const downPayment = roundMoney(Math.max(0, downPaymentAmount));
  const isInstallment =
    String(sale.payment_type ?? "").toLowerCase() === "installment" ||
    Boolean(sale.has_payment_plan);
  const hasRelatedPaymentData = downPayment > 0 || laterPayments > 0;
  const collectedAmount = isInstallment && hasRelatedPaymentData
    ? downPayment + laterPayments
    : Math.max(storedPaid, paidFromBalance, laterPayments);
  const safeCollectedAmount = roundMoney(Math.min(total, Math.max(0, collectedAmount)));
  const pendingBalance = roundMoney(Math.max(0, total - safeCollectedAmount));

  return {
    total,
    collectedAmount: safeCollectedAmount,
    pendingBalance,
  };
}
