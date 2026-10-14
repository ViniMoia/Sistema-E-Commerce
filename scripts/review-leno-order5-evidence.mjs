// Offline review of the committed Sandbox evidence. No database, env loader,
// HTTP request, payment command or queue processing is used here.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const inputs = {};
function read(name) {
  const bytes = fs.readFileSync(new URL('../materiais/homologacao/' + name, import.meta.url));
  inputs[name] = createHash('sha256').update(bytes).digest('hex');
  return JSON.parse(bytes.toString('utf8'));
}
const before = read('pedido-5-antes-estorno-cartao.json');
const completed = read('pedido-5-estorno-terceiro-lote.json');
const after = read('pedido-5-estorno-apos-webhook.json').evidence;
const remote = read('pedido-5-estorno-confirmacao-remota.json');
const checks = [];
const check = (name, fn) => { fn(); checks.push(name); };

check('same-order-and-provider-reference', () => {
  assert.equal(before.orders.length, 1);
  for (const data of [completed, after]) {
    assert.equal(data.orders.length, 1);
    assert.equal(data.orders[0].id, before.orders[0].id);
    assert.equal(data.orders[0].asaasPaymentId, remote.paymentId);
    assert.equal(data.orders[0].id, remote.externalReference);
  }
});
check('one-installment-with-points-and-freight', () => {
  const order = before.orders[0];
  assert.equal(order.paymentMethod, 'CREDIT_CARD'); assert.equal(order.installments, 1);
  assert.equal(order.subtotal, 49.9); assert.equal(order.pointsDiscountValue, 5);
  assert.equal(order.shippingCost, 12.3); assert.equal(order.total, 57.2);
  assert.equal(order.shippingProvider, 'JT_EXPRESS'); assert.equal(order.shippingEstimatedDays, 2);
  assert.equal(order.pointsRedeemed, 100); assert.equal(order.pointsCredited, 22);
});
check('remote-refund-is-final-and-full', () => {
  assert.equal(remote.environment, 'sandbox'); assert.equal(remote.status, 'REFUNDED');
  assert.equal(remote.historyComplete, true); assert.equal(remote.deleted, false);
  assert.equal(remote.refunds.length, 1); assert.equal(remote.refunds[0].status, 'DONE');
  assert.equal(remote.value, before.orders[0].total); assert.equal(remote.refunds[0].value, remote.value);
});
check('single-completed-refund-operation-and-fact', () => {
  assert.equal(before.operations.length, 0);
  assert.equal(after.operations.length, 1); assert.equal(after.operations[0].kind, 'REFUND');
  assert.equal(after.operations[0].status, 'COMPLETED');
  const facts = after.financialFacts.filter(f => f.type === 'REFUNDED');
  assert.equal(facts.length, 1); assert.equal(facts[0].amount, remote.value);
  assert.equal(facts[0].providerAccount, 'sandbox-hml');
});
check('order-cancelled-once-and-historical-freight-preserved', () => {
  assert.equal(before.orders[0].status, 'PAID'); assert.equal(before.orders[0].version, 1);
  assert.equal(after.orders[0].status, 'CANCELLED'); assert.equal(after.orders[0].version, 2);
  assert.equal(after.orders[0].shippingEstimatedDays, 2);
  assert.equal(after.orders[0].freightQuoteId, before.orders[0].freightQuoteId);
});
check('reservation-returned-with-identical-variant-and-unit', () => {
  assert.equal(before.itemsAndStock.length, 1); assert.equal(after.itemsAndStock.length, 1);
  const a = before.itemsAndStock[0], b = after.itemsAndStock[0];
  assert.equal(b.productId, a.productId); assert.equal(b.variantId, a.variantId);
  assert.equal(b.reservationId, a.reservationId); assert.equal(b.reservationMatchesItem, true);
  assert.equal(a.reservationStatus, 'COMMITTED'); assert.equal(b.reservationStatus, 'RETURNED');
  assert.equal(b.productStock, a.productStock + 1); assert.equal(b.variantStock, a.variantStock + 1);
  assert.equal(b.productUnavailableStock, 0); assert.equal(b.variantUnavailableStock, 0);
});
check('points-compensated-once-and-lots-conserved', () => {
  for (const [type, points] of [['REDEEM', -100], ['EARN', 22], ['REFUND_EARN', -22], ['REFUND_REDEEM', 100]]) {
    const movements = after.orderLoyaltyMovements.filter(m => m.type === type);
    assert.equal(movements.length, 1); assert.equal(movements[0].points, points);
  }
  assert.equal(after.wallet.balance, before.wallet.balance - 22 + 100);
  assert.equal(after.wallet.lifetimeEarn, before.wallet.lifetimeEarn - 22);
  assert.equal(after.walletLotRemaining, after.wallet.balance);
  assert.equal(after.wallet.pending, 0); assert.equal(after.wallet.debt, 0);
});
check('later-webhook-did-not-repeat-business-effects', () => {
  for (const key of ['orders', 'operations', 'financialFacts', 'wallet', 'walletLotRemaining',
    'orderLoyaltyMovements', 'history', 'itemsAndStock', 'loyaltyAllocations', 'earnedLots']) {
    assert.deepEqual(after[key], completed[key], key);
  }
});
check('order-queues-completed', () => {
  assert.equal(after.inboxForPayment.length, 2); assert.equal(after.outboxForOrder.length, 4);
  for (const record of [...after.inboxForPayment, ...after.outboxForOrder]) {
    assert.equal(record.status, 'COMPLETED'); assert.equal(record.lastErrorCode, null);
  }
});
console.log(JSON.stringify({ reviewedAt: new Date().toISOString(), scope: 'offline-order-5-sandbox-evidence',
  inputs, checks, passed: true, remoteOperationsExecuted: false, productionApproved: false,
  limits: ['credit 1x, full refund, product not shipped', 'no current remote state attested',
    'does not approve PIX, installments refund, boleto, debit or physical returns'] }, null, 2));
