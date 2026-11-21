export function calculateInvoiceBalance(total: number, payments: number[]): number {
  if (!Number.isFinite(total) || total < 0) return 0;
  const paid = payments.reduce((sum, amount) => sum + (Number.isFinite(amount) && amount > 0 ? amount : 0), 0);
  return Math.max(0, Math.round((total - paid) * 100) / 100);
}

export function validatePaymentAmount(total: number, payments: number[], amount: number): boolean {
  if (!Number.isFinite(amount) || amount <= 0) return false;
  const balance = calculateInvoiceBalance(total, payments);
  return amount <= balance;
}
