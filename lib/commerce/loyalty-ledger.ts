import { createHash, randomUUID } from 'node:crypto';
import { Prisma, LoyaltyTxType, type LoyaltyWallet, type LoyaltyLot } from '@prisma/client';
import { CommerceLocks } from './locks';
import { assertPoints, creditExpiry, LoyaltyError, LOYALTY_POLICY, orderLots } from './loyalty-policy';

type Tx = Prisma.TransactionClient;
type Scope = { lojaID: string; userID: string };
type State = { tx: Tx; wallet: LoyaltyWallet; lots: LoyaltyLot[]; now: Date };
type CreditPiece = { points: number; expiry: Date | null; allocationId?: string; originId?: string | null };
type Effect = { key: string; hash: string; type: LoyaltyTxType; points: number; description: string;
  orderId?: string; monetaryValue?: Prisma.Decimal | number | null; expiry?: Date | null; policy?: Prisma.InputJsonObject };
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const loyaltyEffect = (kind: string, scope: Scope, identity: string, content: unknown) => ({
  key: `loyalty:${kind}:${digest([scope.lojaID, scope.userID, identity])}`, hash: digest(content),
});

/** Caller must hold any order/product/variant locks BEFORE entering this engine.
 * New standalone order commands lock their order in the service adapter. */
export async function lockLoyaltyWallet(tx: Tx, scope: Scope, create = false, now = new Date()): Promise<State | null> {
  scope = { lojaID: scope.lojaID, userID: scope.userID };
  if (!Number.isFinite(now.getTime())) throw new LoyaltyError('INVALID_DATE', 'Data de fidelidade inválida.');
  const user = await tx.user.findUnique({ where: { id_lojaID: { id: scope.userID, lojaID: scope.lojaID } }, select: { id: true } });
  if (!user) throw new LoyaltyError('USER_NOT_FOUND', 'O usuário não pertence a esta loja ou não existe.');
  // Native ON CONFLICT prevents a missing-row upsert race. Do not mutate a
  // historical wallet or infer lots from its balance when it already exists.
  if (create) {
    const historical = await tx.loyaltyTransaction.findFirst({ where: { ...scope, availableDelta: null }, select: { id: true } });
    await tx.loyaltyWallet.createMany({ data: { id: randomUUID(), ...scope, accountingReady: !historical }, skipDuplicates: true });
  }
  const found = await tx.loyaltyWallet.findUnique({ where: { lojaID_userID: scope } });
  if (!found) return null;
  const locks = new CommerceLocks(tx);
  await locks.acquire('wallet', [found.id]);
  const wallet = await tx.loyaltyWallet.findUniqueOrThrow({ where: { id: found.id } });
  const ids = await tx.loyaltyLot.findMany({ where: { walletId: wallet.id }, select: { id: true } });
  await locks.acquire('lot', ids.map(lot => lot.id));
  const lots = await tx.loyaltyLot.findMany({ where: { walletId: wallet.id } });
  const state = { tx, wallet, lots, now };
  if (wallet.accountingReady) assertConserved(state);
  return state;
}

function ready(state: State | null): asserts state is State {
  if (!state || !state.wallet.accountingReady) throw new LoyaltyError('RECONCILIATION_REQUIRED', 'Carteira legada exige conciliação antes desta operação.');
}
function assertConserved(state: State) {
  const total = state.lots.reduce((sum, lot) => sum + lot.remaining, 0);
  if (total !== state.wallet.balance || state.wallet.balance < 0 || state.wallet.debt < 0
    || (state.wallet.debt > 0 && state.wallet.balance > 0)) throw new LoyaltyError('ACCOUNTING_DIVERGENCE', 'Saldo, déficit e lotes da carteira divergem.');
}
async function replay(state: State, effect: Effect) {
  const previous = await state.tx.loyaltyTransaction.findUnique({ where: { effectKey: effect.key } });
  if (previous && previous.contentHash !== effect.hash) throw new LoyaltyError('CONFLICT', 'Identidade já utilizada com outro conteúdo.');
  return previous;
}
async function write(state: State, effect: Effect, balance: number, debt: number, lifetimeDelta = 0) {
  assertPoints(balance); assertPoints(debt);
  const availableDelta = balance - state.wallet.balance;
  const debtDelta = debt - state.wallet.debt;
  if (effect.points !== availableDelta - debtDelta) throw new LoyaltyError('ACCOUNTING_DIVERGENCE', 'Movimento de pontos não fecha com saldo e déficit.');
  state.wallet = await state.tx.loyaltyWallet.update({ where: { id: state.wallet.id }, data: {
    balance, debt, version: { increment: 1 }, ...(lifetimeDelta ? { lifetimeEarn: { increment: lifetimeDelta } } : {}),
  } });
  return state.tx.loyaltyTransaction.create({ data: {
    lojaID: state.wallet.lojaID, userID: state.wallet.userID, orderId: effect.orderId,
    type: effect.type, points: effect.points, balanceAfter: balance, debtAfter: debt,
    availableDelta, debtDelta, effectKey: effect.key, contentHash: effect.hash,
    description: effect.description, monetaryValue: effect.monetaryValue, expiresAt: effect.expiry,
    policy: { version: LOYALTY_POLICY, ...effect.policy },
  } });
}
async function setRemaining(state: State, lot: LoyaltyLot, remaining: number) {
  await state.tx.loyaltyLot.update({ where: { id: lot.id }, data: { remaining } });
  lot.remaining = remaining;
}
async function consume(state: State, amount: number, transactionId: string, selected = state.lots) {
  let needed = amount;
  for (const lot of orderLots(selected)) {
    const points = Math.min(needed, lot.remaining);
    if (!points) continue;
    await setRemaining(state, lot, lot.remaining - points);
    await state.tx.loyaltyAllocation.create({ data: { lotId: lot.id, transactionId, points } });
    needed -= points;
    if (!needed) break;
  }
  if (needed) throw new LoyaltyError('ACCOUNTING_DIVERGENCE', 'Créditos remanescentes insuficientes para o movimento.');
}

/** Each expired lot has one effect. Restorations create a different lot; they
 * never reopen the original expired one or change its deadline. */
export async function expireLockedLoyalty(state: State) {
  ready(state);
  const transactions = [];
  let pointsExpired = 0;
  for (const lot of orderLots(state.lots)) {
    if (!lot.remaining || !lot.expiresAt || lot.expiresAt > state.now) continue;
    const points = lot.remaining;
    const effect: Effect = { key: `loyalty:expire:${lot.id}`, hash: digest([lot.id, lot.expiresAt.toISOString()]),
      type: LoyaltyTxType.EXPIRATION, points: -points, description: 'Expiração do remanescente do crédito', policy: { lotId: lot.id } };
    if (await replay(state, effect)) throw new LoyaltyError('ACCOUNTING_DIVERGENCE', 'Lote expirado possui remanescente após sua baixa.');
    const transaction = await write(state, effect, state.wallet.balance - points, state.wallet.debt);
    await consume(state, points, transaction.id, [lot]);
    pointsExpired += points; transactions.push(transaction);
  }
  assertConserved(state);
  return { wallet: state.wallet, transactions, transaction: transactions.at(-1) ?? null, pointsExpired };
}

export async function creditLockedLoyalty(state: State, effect: Effect, pieces: CreditPiece[], lifetimeDelta = 0) {
  ready(state); assertPoints(effect.points);
  const previous = await replay(state, effect);
  if (previous) return { wallet: state.wallet, transaction: previous, replay: true };
  await expireLockedLoyalty(state);
  if (pieces.reduce((sum, piece) => sum + piece.points, 0) !== effect.points) throw new LoyaltyError('ACCOUNTING_DIVERGENCE', 'Origens não fecham com crédito.');
  let debtPayment = Math.min(state.wallet.debt, effect.points);
  const transaction = await write(state, effect, state.wallet.balance + effect.points - debtPayment, state.wallet.debt - debtPayment, lifetimeDelta);
  for (const piece of pieces) {
    assertPoints(piece.points);
    if (!piece.points) continue;
    const paid = Math.min(debtPayment, piece.points); debtPayment -= paid;
    const lot = await state.tx.loyaltyLot.create({ data: {
      walletId: state.wallet.id, sourceTransactionId: transaction.id,
      sourceKey: piece.allocationId ?? 'credit', sourceAllocationId: piece.allocationId,
      originTransactionId: piece.originId ?? transaction.id,
      credited: piece.points, remaining: piece.points - paid, expiresAt: piece.expiry,
    } });
    state.lots.push(lot);
    // Allocation documents the part of this credit used to settle the deficit.
    if (paid) await state.tx.loyaltyAllocation.create({ data: { lotId: lot.id, transactionId: transaction.id, points: paid } });
  }
  assertConserved(state);
  return { wallet: state.wallet, transaction, replay: false };
}

export async function debitLockedLoyalty(state: State, effect: Effect) {
  ready(state); assertPoints(-effect.points);
  const previous = await replay(state, effect);
  if (previous) return { wallet: state.wallet, transaction: previous, replay: true };
  await expireLockedLoyalty(state);
  const points = -effect.points;
  if (state.wallet.balance < points) throw new LoyaltyError('INSUFFICIENT_POINTS', 'Saldo insuficiente para resgate/ajuste.');
  const transaction = await write(state, effect, state.wallet.balance - points, state.wallet.debt);
  await consume(state, points, transaction.id);
  assertConserved(state);
  return { wallet: state.wallet, transaction, replay: false };
}

/** Spent credits become a separate obligation; credits already expired are
 * not charged again. Include restored descendants of the original credit. */
export async function reverseEarnLockedLoyalty(state: State, original: { id: string; points: number; orderId: string | null; monetaryValue: Prisma.Decimal | null }, description: string) {
  ready(state);
  const identity = loyaltyEffect('refund-earn', state.wallet, original.id, [original.id]);
  const prior = await state.tx.loyaltyTransaction.findUnique({ where: { effectKey: identity.key } });
  if (prior) return prior;
  await expireLockedLoyalty(state);
  const originLots = state.lots.filter(lot => lot.originTransactionId === original.id);
  if (!originLots.length) throw new LoyaltyError('RECONCILIATION_REQUIRED', 'Crédito original não possui lotes rastreáveis.');
  const expired = await state.tx.loyaltyAllocation.aggregate({ where: { lotId: { in: originLots.map(lot => lot.id) }, transaction: { type: 'EXPIRATION' } }, _sum: { points: true } });
  const points = original.points - (expired._sum.points ?? 0);
  if (points < 0) throw new LoyaltyError('ACCOUNTING_DIVERGENCE', 'Expirações excedem o crédito original.');
  const remaining = originLots.reduce((sum, lot) => sum + lot.remaining, 0);
  if (remaining > points) throw new LoyaltyError('ACCOUNTING_DIVERGENCE', 'Restituições excedem o crédito original.');
  const spent = points - remaining;
  const offset = Math.min(state.wallet.balance - remaining, spent);
  const transaction = await write(state, { ...identity, type: 'REFUND_EARN', points: -points,
    orderId: original.orderId ?? undefined, monetaryValue: original.monetaryValue, description,
    policy: { originalTransactionId: original.id, alreadyExpired: expired._sum.points ?? 0 } },
  state.wallet.balance - remaining - offset, state.wallet.debt + spent - offset, -original.points);
  if (remaining) await consume(state, remaining, transaction.id, originLots);
  if (offset) await consume(state, offset, transaction.id, state.lots.filter(lot => !originLots.includes(lot)));
  // Preserve the existing lifetimeEarn rule: credited gains minus revoked gains.
  assertConserved(state);
  return transaction;
}

export async function restoreRedeemLockedLoyalty(state: State, original: { id: string; points: number; orderId: string | null; monetaryValue: Prisma.Decimal | null }, description: string, expiryDays: number | null) {
  ready(state);
  const identity = loyaltyEffect('refund-redeem', state.wallet, original.id, [original.id]);
  const prior = await state.tx.loyaltyTransaction.findUnique({ where: { effectKey: identity.key } });
  if (prior) return prior;
  const allocations = await state.tx.loyaltyAllocation.findMany({ where: { transactionId: original.id }, include: { lot: true }, orderBy: { id: 'asc' } });
  if (allocations.some(allocation => allocation.lot.walletId !== state.wallet.id)) throw new LoyaltyError('ACCOUNTING_DIVERGENCE', 'Alocação pertence a outra carteira.');
  if (allocations.reduce((sum, allocation) => sum + allocation.points, 0) !== -original.points) throw new LoyaltyError('RECONCILIATION_REQUIRED', 'Resgate original não possui alocações completas.');
  const pieces = allocations.map(allocation => ({ points: allocation.points, allocationId: allocation.id,
    originId: allocation.lot.originTransactionId,
    expiry: allocation.lot.expiresAt && allocation.lot.expiresAt <= state.now
      ? creditExpiry(expiryDays, state.now) : allocation.lot.expiresAt }));
  const result = await creditLockedLoyalty(state, { ...identity, type: 'REFUND_REDEEM', points: -original.points,
    orderId: original.orderId ?? undefined, description, monetaryValue: original.monetaryValue,
    policy: { originalTransactionId: original.id, expiredReturnTermDays: expiryDays, returnedAt: state.now.toISOString() } }, pieces);
  return result.transaction;
}

/** Durable evidence, not a silent success or a guessed backfill. WF-18/14 must
 * reconcile these before enabling the complete production candidate. */
export async function deferLegacyLoyalty(tx: Tx, kind: 'EARN' | 'REFUND', scope: Scope & { orderId: string }, payload: Prisma.InputJsonObject) {
  const effectKey = `loyalty:legacy:${kind}:${scope.orderId}`;
  await tx.commerceOutbox.upsert({ where: { effectKey }, update: {}, create: {
    effectKey, commandType: `LOYALTY_RECONCILE_${kind}`, aggregateId: scope.orderId,
    payload: { schemaVersion: 1, lojaID: scope.lojaID, userID: scope.userID, orderId: scope.orderId, ...payload, policyVersion: LOYALTY_POLICY },
  } });
}

export async function inspectLoyaltyAccounting(tx: Tx, scope: Scope) {
  const state = await lockLoyaltyWallet(tx, scope);
  if (!state) return { accountingReady: true, balance: 0, debt: 0, lotRemaining: 0, ledgerAvailable: 0, ledgerDebt: 0, conserved: true };
  const ledger = await tx.loyaltyTransaction.aggregate({ where: { ...scope, availableDelta: { not: null } }, _sum: { availableDelta: true, debtDelta: true } });
  const lotRemaining = state.lots.reduce((sum, lot) => sum + lot.remaining, 0);
  const ledgerAvailable = ledger._sum.availableDelta ?? 0; const ledgerDebt = ledger._sum.debtDelta ?? 0;
  return { accountingReady: state.wallet.accountingReady, balance: state.wallet.balance, debt: state.wallet.debt,
    lotRemaining, ledgerAvailable, ledgerDebt, conserved: state.wallet.accountingReady && lotRemaining === state.wallet.balance
      && ledgerAvailable === state.wallet.balance && ledgerDebt === state.wallet.debt };
}
