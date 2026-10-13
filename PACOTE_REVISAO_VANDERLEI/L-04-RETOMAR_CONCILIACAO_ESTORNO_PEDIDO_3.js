// ARQUIVO HISTORICO: retomada ja executada; resultado registrado nas secoes 33–36 do roteiro.
// Nao executar como parte da instalacao/atualizacao nem repetir para limpar a revisao do #3.
// Instrucao original: executar UMA vez no Console do Admin do Preview homologacao_teste.
// Retomada auditada: antecipa reconcileAfter e renova reviewAfter; nao e somente leitura.
// Nao cria REFUND, nao redefine operacoes e nao processa filas.
// O endpoint tambem pode reenfileirar inbox DEAD_LETTER; esperado aqui: zero.
(async () => {
  const origin = 'https://continental-prototipo-git-homologacaoteste-vinimoias-projects.vercel.app';
  const orderId = '5b5bef57-2fd2-4f88-83fd-bf3d76238c40';
  const attemptId = '03422a6b-8223-41eb-9240-089c6dd9cf22';
  const commandId = 'l04-pix-reconcile-pedido3-461437d-v1';
  let phase = 'origin_check', requestAttempted = false, httpStatus = null;
  const emit = result => console.log(JSON.stringify({ phase, orderId, commandId, requestAttempted,
    refundRequested: false, processingAttempted: false, httpStatus, ...result }, null, 2));
  try {
    if (location.origin !== origin) return emit({ ok: false, code: 'WRONG_PREVIEW' });
    phase = 'order_check';
    const read = await fetch(`/api/admin/orders/${orderId}`, { credentials: 'same-origin', cache: 'no-store',
      redirect: 'error', signal: AbortSignal.timeout(60000) });
    httpStatus = read.status;
    if (!read.ok) return emit({ ok: false, code: 'ORDER_READ_FAILED' });
    const body = await read.json(), order = body.data;
    if (body.success !== true || !order || order.id !== orderId || order.orderNumber !== 3 ||
      order.lojaID !== '3a82b33c-3646-4272-9a89-80bb1ba327a5' || order.version !== 1 ||
      order.status !== 'PAID' || order.asaasPaymentStatus !== 'RECEIVED' || order.paymentMethod !== 'PIX' ||
      order.asaasPaymentId !== 'pay_cra35xq1ltkb6oka' || Number(order.total) !== 49.9 ||
      order.pointsRedeemed !== 0 || order.pointsCredited !== 24 || order.paidAt !== '2026-10-09T18:15:24.207Z' ||
      !Array.isArray(order.items) || order.items.length !== 1 ||
      order.items[0].id !== 'e385cec8-1c96-47da-88fa-b9c3950a0302' || order.items[0].quantity !== 1 ||
      order.items[0].size !== 'Pequeno' || order.items[0].color !== 'Vermelho' || Number(order.items[0].price) !== 49.9 ||
      !Array.isArray(order.statusHistory) || order.statusHistory.length !== 1 ||
      order.statusHistory[0].status !== 'PAID' || order.statusHistory[0].previousStatus !== 'PENDING' ||
      order.statusHistory[0].orderVersion !== 1) {
      return emit({ ok: false, code: 'ORDER_CHANGED_OR_UNEXPECTED', instruction: 'Enviar este JSON; consultar o estado antes de prosseguir.' });
    }
    phase = 'request_reconciliation'; httpStatus = null; requestAttempted = true;
    const response = await fetch(`/api/admin/orders/${orderId}/payment-reconcile`, { method: 'POST',
      credentials: 'same-origin', redirect: 'error', signal: AbortSignal.timeout(60000),
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ commandId }) });
    httpStatus = response.status;
    const result = await response.json();
    if (response.status !== 202) return emit({ ok: false,
      code: typeof result.error === 'string' && /^PAYMENT_[A-Z_]+$/.test(result.error) ? result.error : 'RECONCILIATION_NOT_ACCEPTED',
      instruction: 'Enviar este JSON; consultar sem repetir automaticamente.' });
    const data = result.data;
    if (!data || data.attemptId !== attemptId || data.status !== 'REFUND_PENDING' || data.requeuedEvents !== 0) {
      return emit({ ok: false, code: 'RECONCILIATION_RESPONSE_UNEXPECTED',
        instruction: 'A retomada pode ter sido registrada; enviar este JSON antes de processar. Nao repetir.' });
    }
    emit({ ok: true, code: 'RECONCILIATION_REQUEST_ACCEPTED', attemptId, attemptStatus: data.status,
      requeuedEvents: data.requeuedEvents,
      instruction: 'Enviar este JSON. Retomada registrada; aguardar conferencia antes de processar um lote.' });
  } catch {
    emit({ ok: false, code: requestAttempted ? 'RECONCILIATION_REQUEST_UNRESOLVED' : 'READ_UNRESOLVED',
      instruction: 'Consultar o estado existente; nao repetir automaticamente nem solicitar outro REFUND.' });
  }
})();
