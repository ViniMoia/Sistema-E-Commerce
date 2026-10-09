// Replay planejado: execute UMA vez no Console do Admin do mesmo Preview/operador.
// Conserve a identidade ORIGINAL, inclusive expectedVersion=0, mesmo apos cancelamento.
// Nao processa filas; compara somente o pedido/historico expostos pelo GET.
(async () => {
  const origin = 'https://continental-prototipo-git-homologacaoteste-vinimoias-projects.vercel.app';
  const orderId = 'e0bfe582-e85b-41e7-8b5c-d877b1e1a7e0';
  const command = { kind: 'CANCEL', commandId: 'l04-pix-cancel-pedido2-e0bfe582-v0', expectedVersion: 0 };
  let phase = 'origin_check', requestAttempted = false, httpStatus = null;
  const emit = result => console.log(JSON.stringify({ phase, requestAttempted, processingAttempted: false,
    orderId, commandId: command.commandId, httpStatus, ...result }, null, 2));
  const snapshot = order => ({ id: order.id, version: order.version, status: order.status,
    asaasPaymentId: order.asaasPaymentId, asaasPaymentStatus: order.asaasPaymentStatus, total: Number(order.total),
    pointsRedeemed: order.pointsRedeemed, pointsCredited: order.pointsCredited, paidAt: order.paidAt,
    items: order.items.map(item => ({ id: item.id, quantity: item.quantity, size: item.size, color: item.color, price: Number(item.price) })),
    history: order.statusHistory.map(row => ({ id: row.id, status: row.status, previousStatus: row.previousStatus,
      orderVersion: row.orderVersion, createdAt: row.createdAt })).sort((a, b) => a.id.localeCompare(b.id)) });
  const brief = order => ({ version: order.version, status: order.status, asaasPaymentStatus: order.asaasPaymentStatus,
    historyCount: order.history.length, cancelledHistoryCount: order.history.filter(row => row.status === 'CANCELLED').length });
  async function readOrder() {
    const response = await fetch(`/api/admin/orders/${orderId}`, { credentials: 'same-origin', cache: 'no-store',
      redirect: 'error', signal: AbortSignal.timeout(60000) });
    httpStatus = response.status;
    if (!response.ok) throw new Error('ORDER_READ_FAILED');
    const result = await response.json();
    const order = result.data;
    if (result.success !== true || !order || order.id !== orderId || order.orderNumber !== 2 ||
      order.lojaID !== '3a82b33c-3646-4272-9a89-80bb1ba327a5' || !Number.isInteger(order.version) ||
      order.status !== 'CANCELLED' || order.asaasPaymentStatus !== 'DELETED' || order.paymentMethod !== 'PIX' ||
      order.asaasPaymentId !== 'pay_3cuzqjn8kvzirv3k' || Number(order.total) !== 49.9 || order.pointsRedeemed !== 0 ||
      !Array.isArray(order.items) || order.items.length !== 1 || order.items[0].quantity !== 1 ||
      order.items[0].size !== 'Pequeno' || order.items[0].color !== 'Vermelho' || !Array.isArray(order.statusHistory) ||
      order.statusHistory.filter(row => row.status === 'CANCELLED').length !== 1) throw new Error('ORDER_UNEXPECTED');
    return snapshot(order);
  }
  try {
    if (location.origin !== origin) return emit({ ok: false, code: 'WRONG_PREVIEW' });
    phase = 'before_check';
    const before = await readOrder();
    phase = 'replay_cancel'; httpStatus = null; requestAttempted = true;
    const response = await fetch(`/api/admin/orders/${orderId}/payment-operation`, { method: 'POST',
      credentials: 'same-origin', redirect: 'error', signal: AbortSignal.timeout(60000),
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(command) });
    httpStatus = response.status;
    const result = await response.json();
    if (response.status !== 202) return emit({ ok: false,
      code: typeof result.error === 'string' && /^PAYMENT_[A-Z_]+$/.test(result.error) ? result.error : 'REPLAY_NOT_ACCEPTED',
      instruction: 'Consultar o estado; nao alterar a identidade ou repetir automaticamente.' });
    const data = result.data;
    if (!data || data.replay !== true || data.attemptId !== '587d9515-030f-474f-9edf-ee6d1d722086' ||
      !Array.isArray(data.operations) || data.operations.length !== 1 ||
      data.operations[0].id !== '41d09e96-3454-4522-a338-be7b768e281f' || data.operations[0].kind !== 'CANCEL' ||
      data.operations[0].status !== 'COMPLETED') {
      return emit({ ok: false, code: 'REPLAY_NOT_VERIFIED', instruction: 'Resposta inesperada; consultar sem processar.' });
    }
    const replayHttpStatus = response.status;
    phase = 'after_check';
    const after = await readOrder();
    const orderUnchanged = JSON.stringify(before) === JSON.stringify(after);
    emit({ ok: orderUnchanged, code: orderUnchanged ? 'CANCEL_REPLAY_VERIFIED' : 'ORDER_CHANGED_AFTER_REPLAY',
      replayHttpStatus, replay: data.replay, attemptId: data.attemptId,
      operationId: data.operations[0].id, operationStatus: data.operations[0].status,
      before: brief(before), after: brief(after), orderUnchanged,
      instruction: 'Conferir filas com StatusOnly, estoque, pontos e email; nao enviar lote automaticamente.' });
  } catch {
    emit({ ok: false, code: requestAttempted ? 'REPLAY_CHECK_UNRESOLVED' : 'READ_UNRESOLVED',
      instruction: 'Consultar o estado existente; nao repetir automaticamente.' });
  }
})();
