/** WF-09 policy v1. The configured shop term is snapshotted for expired-credit
 * compensation; missing term means explicitly non-expiring, never unknown=expired. */
export const LOYALTY_POLICY = 'lots-fefo-debt-v1';
export const MAX_POINTS = 2147483647;
export class LoyaltyError extends Error {
  constructor(public readonly code: string, message: string) { super(message); this.name = 'LoyaltyError'; }
}
export function assertPoints(points: number, allowNegative = false): void {
  if (!Number.isSafeInteger(points) || Math.abs(points) > MAX_POINTS || (!allowNegative && points < 0)) {
    throw new LoyaltyError('INVALID_POINTS', 'Quantidade de pontos inválida.');
  }
}
export function creditExpiry(days: number | null, now: Date): Date | null {
  if (days === null) return null;
  if (!Number.isSafeInteger(days) || days <= 0) throw new LoyaltyError('INVALID_POLICY', 'Prazo de fidelidade inválido.');
  const result = new Date(now.getTime() + days * 86400000);
  if (!Number.isFinite(result.getTime())) throw new LoyaltyError('INVALID_POLICY', 'Prazo fora do intervalo suportado.');
  return result;
}
export function orderLots<T extends { expiresAt: Date | null; createdAt: Date; id: string }>(lots: T[]): T[] {
  return [...lots].sort((a, b) => (a.expiresAt?.getTime() ?? Infinity) - (b.expiresAt?.getTime() ?? Infinity)
    || a.createdAt.getTime() - b.createdAt.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
