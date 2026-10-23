import { randomUUID } from 'node:crypto';
import prisma from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { paymentNow } from './payment-evidence.service';

export type WorkTable = 'PaymentInbox' | 'CommerceOutbox';
export type PaymentInboxTarget = { inboxId: string; orderId: string; lojaID: string; providerAccount: string };

// Operational single-event processing requires an already correlated charge.
// A missing/mismatched target must never fall back to the general queue.
export async function claimPaymentInboxEvent(target: PaymentInboxTarget) {
  if (!target || [target.inboxId, target.orderId, target.lojaID, target.providerAccount]
    .some(value => typeof value !== 'string' || !value.trim())) throw new Error('PAYMENT_INBOX_TARGET_REQUIRED');
  const owner = randomUUID();
  const ids = await prisma.$transaction(async tx => {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT i.id FROM "PaymentInbox" i
      JOIN "PaymentCharge" c ON c.provider='ASAAS' AND c."providerPaymentId"=i.payload->'payment'->>'id'
      JOIN "PaymentAttempt" a ON a.id=c."attemptId"
      JOIN "Order" o ON o.id=a."orderId"
      WHERE i.id=${target.inboxId} AND o.id=${target.orderId} AND o."lojaID"=${target.lojaID}
        AND i.provider=${'ASAAS:' + target.providerAccount}
        AND a.provider='ASAAS' AND a."providerAccount"=${target.providerAccount}
        AND c."providerAccount"=${target.providerAccount}
        AND a."externalReference"=i.payload->'payment'->>'externalReference'
        AND a.method=i.payload->'payment'->>'billingType'
        AND ((i.status='READY' AND i."nextAttemptAt"<=clock_timestamp())
          OR (i.status='LEASED' AND i."leaseExpiresAt"<=clock_timestamp()))
      FOR UPDATE OF i SKIP LOCKED`;
    for (const row of rows) await tx.$executeRaw`UPDATE "PaymentInbox" SET status='LEASED',
      "leaseOwner"=${owner}, "leaseExpiresAt"=clock_timestamp()+interval '10 minutes', attempts=attempts+1
      WHERE id=${row.id}`;
    return rows.map(row => row.id);
  });
  return { owner, ids };
}

export async function claimWork(table: WorkTable, limit: number) {
  const owner = randomUUID();
  const ids = await prisma.$transaction(async tx => {
    // The table name is a closed server-side union, never user input.
    const claimed = await tx.$queryRawUnsafe<Array<{ id: string }>>(`SELECT id FROM "${table}"
      WHERE (status='READY' AND "nextAttemptAt"<=clock_timestamp()) OR (status='LEASED' AND "leaseExpiresAt"<=clock_timestamp())
      ORDER BY "nextAttemptAt",id FOR UPDATE SKIP LOCKED LIMIT $1`, limit);
    for (const row of claimed) await tx.$executeRawUnsafe(`UPDATE "${table}" SET status='LEASED', "leaseOwner"=$1,
      "leaseExpiresAt"=clock_timestamp()+interval '10 minutes', attempts=attempts+1 WHERE id=$2`, owner, row.id);
    return claimed.map(r => r.id);
  });
  return { owner, ids };
}
export async function fenceWork(tx: Prisma.TransactionClient, table: WorkTable, id: string, owner: string) {
  const held = await tx.$queryRawUnsafe<Array<{ id: string }>>(`SELECT id FROM "${table}" WHERE id=$1 AND status='LEASED'
    AND "leaseOwner"=$2 AND "leaseExpiresAt">clock_timestamp() FOR UPDATE`, id, owner);
  if (held.length !== 1) throw new Error('DURABLE_WORK_LEASE_LOST');
}
export async function completeWork(tx: Prisma.TransactionClient, table: WorkTable, id: string, owner: string, review = false) {
  await fenceWork(tx, table, id, owner);
  await tx.$executeRawUnsafe(`UPDATE "${table}" SET status=$1::"DurableWorkStatus", "leaseOwner"=NULL, "leaseExpiresAt"=NULL,
    "completedAt"=CASE WHEN $1='COMPLETED' THEN clock_timestamp() ELSE NULL END,
    "lastErrorCode"=$2 WHERE id=$3`, review ? 'DEAD_LETTER' : 'COMPLETED', review ? 'PAYMENT_REVIEW_REQUIRED' : null, id);
}
export async function retryWork(table: WorkTable, id: string, owner: string, code = 'DURABLE_WORK_RETRY') {
  await prisma.$transaction(async tx => {
    const rows = await tx.$queryRawUnsafe<Array<{ attempts: number }>>(`SELECT attempts FROM "${table}" WHERE id=$1 AND status='LEASED' AND "leaseOwner"=$2 FOR UPDATE`, id, owner);
    if (!rows.length) return;
    const dead = rows[0].attempts >= 10;
    const now = await paymentNow(tx);
    await tx.$executeRawUnsafe(`UPDATE "${table}" SET status=$1::"DurableWorkStatus", "lastErrorCode"=$2,
      "nextAttemptAt"=$3,"leaseOwner"=NULL,"leaseExpiresAt"=NULL WHERE id=$4`, dead ? 'DEAD_LETTER' : 'READY', code,
      new Date(now.getTime() + Math.min(3600000, 1000 * 2 ** rows[0].attempts)), id);
  });
}
