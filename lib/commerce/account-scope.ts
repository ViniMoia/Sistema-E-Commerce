import type { Prisma } from '@prisma/client';

/** Internal callers must supply the verified subject, never a buyer's declared ID. */
export async function requirePurchaseAccount(tx: Pick<Prisma.TransactionClient, 'user'>, userID: string, lojaID?: string) {
  if (!userID) throw new Error('PURCHASE_ACCOUNT_REQUIRED');
  const user = await tx.user.findUnique({ where: { id: userID }, select: { id: true, lojaID: true, status: true } });
  if (!user || user.status !== 'ACTIVE' || (lojaID !== undefined && (!lojaID || lojaID !== user.lojaID))) {
    throw new Error('PURCHASE_ACCOUNT_ACCESS_DENIED');
  }
  return user;
}
