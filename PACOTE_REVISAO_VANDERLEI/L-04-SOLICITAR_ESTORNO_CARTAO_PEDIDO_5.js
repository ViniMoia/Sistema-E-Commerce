// HISTORICO: ensaio #5 concluido em 14/10/2026. Nao executar novamente.
// A instrucao original abaixo documenta a solicitacao ja realizada.
// Leno (Brega): execute UMA vez no Console do Admin autenticado do mesmo Preview.
// Preparado para #5, cartao 1x, R$ 57,20. Nao executar antes de conferir o roteiro.
// Exige produto ainda na loja, baseline e cobranca Sandbox sem estorno em curso.
// Registra REFUND duravel; nao processa filas nem comprova estorno remoto.
// Preserve commandId, expectedVersion=1 e operador em qualquer replay planejado.
(async () => {
  const origin = 'https://continental-prototipo-git-homologacaoteste-vinimoias-projects.vercel.app';
  const orderId = 'bb3f722b-8392-4a23-863b-d2d428444faa';
  const command = { kind: 'REFUND', commandId: 'l04-card-refund-pedido5-bb3f722b-v1', expectedVersion: 1 };
  let phase = 'origin_check';
  let requestAttempted = false;
  let httpStatus = null;
  const emit = result => console.log(JSON.stringify({ phase, requestAttempted, processingAttempted: false,
    orderId, commandId: command.commandId, expectedVersion: command.expectedVersion, httpStatus, ...result }, null, 2));
  try {
    if (location.origin !== origin) return emit({ ok: false, code: 'WRONG_PREVIEW' });
    phase = 'order_check';
    const read = await fetch(`/api/admin/orders/${orderId}`, { credentials: 'same-origin', cache: 'no-store',
      redirect: 'error', signal: AbortSignal.timeout(60000) });
    httpStatus = read.status;
    if (!read.ok) return emit({ ok: false, code: 'ORDER_READ_FAILED' });
    const body = await read.json();
    const order = body.data;
    if (body.success !== true || !order || order.id !== orderId || order.orderNumber !== 5 ||
      order.lojaID !== '3a82b33c-3646-4272-9a89-80bb1ba327a5' || order.version !== command.expectedVersion ||
      order.status !== 'PAID' || !['CONFIRMED', 'RECEIVED'].includes(order.asaasPaymentStatus) || order.paymentMethod !== 'CREDIT_CARD' ||
      order.asaasPaymentId !== 'pay_806g4snct6ky0smq' || Number(order.total) !== 57.2 || Number(order.financialTotal) !== 57.2 ||
      order.installments !== 1 || Number(order.financingCharge) !== 0 || order.deliveryType !== 'DELIVERY' ||
      Number(order.shippingCost) !== 12.3 || Number(order.pointsDiscountValue) !== 5 ||
      order.pointsRedeemed !== 100 || order.pointsCredited !== 22 || order.paidAt !== '2026-10-14T13:45:29.357Z' ||
      !Array.isArray(order.items) || order.items.length !== 1 ||
      order.items[0].id !== '9984f9e2-bdaf-4a9f-8c25-01a7610aa27d' || order.items[0].quantity !== 1 ||
      order.items[0].size !== 'Pequeno' || order.items[0].color !== 'Vermelho' || Number(order.items[0].price) !== 49.9 ||
      !Array.isArray(order.statusHistory) || order.statusHistory.length !== 1 ||
      order.statusHistory[0].status !== 'PAID' || order.statusHistory[0].previousStatus !== 'PENDING' ||
      order.statusHistory[0].orderVersion !== command.expectedVersion) {
      return emit({ ok: false, code: 'ORDER_CHANGED_OR_UNEXPECTED',
        instruction: 'Consultar o estado; nao alterar a identidade do comando nem solicitar outra operacao.' });
    }
    phase = 'request_refund';
    httpStatus = null;
    requestAttempted = true;
    const response = await fetch(`/api/admin/orders/${orderId}/payment-operation`, { method: 'POST',
      credentials: 'same-origin', redirect: 'error', signal: AbortSignal.timeout(60000),
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(command) });
    httpStatus = response.status;
    const result = await response.json();
    if (response.status !== 202) return emit({ ok: false,
      code: typeof result.error === 'string' && /^PAYMENT_[A-Z_]+$/.test(result.error) ? result.error : 'REQUEST_NOT_ACCEPTED',
      instruction: 'Consultar resposta e estado existente antes de qualquer nova tentativa.' });
    const data = result.data;
    const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
    if (!data || data.attemptId !== '9255971c-e963-43f5-888c-3bec74ae1ab3' || typeof data.replay !== 'boolean' || !Array.isArray(data.operations) ||
      data.operations.length !== 1 || !uuid(data.operations[0].id) || data.operations[0].kind !== 'REFUND' ||
      data.operations[0].chargeId !== 'b6da2a01-bf54-4484-a571-e257c1699cf1' ||
      !['READY', 'SUBMITTING', 'PENDING', 'UNKNOWN', 'COMPLETED'].includes(data.operations[0].status)) {
      return emit({ ok: false, code: 'REQUEST_UNRESOLVED',
        instruction: 'Solicitacao pode estar gravada; consultar sem repetir automaticamente.' });
    }
    emit({ ok: true, code: data.replay ? 'REFUND_REQUEST_ALREADY_EXISTS' : 'REFUND_REQUEST_ACCEPTED',
      attemptId: data.attemptId, replay: data.replay,
      operations: data.operations.map(op => ({ id: op.id, chargeId: op.chargeId, kind: op.kind, status: op.status })),
      instruction: 'Enviar este JSON; comando aceito nao comprova estorno. Aguardar conferencia antes de processar filas.' });
  } catch {
    emit({ ok: false, code: requestAttempted ? 'REQUEST_UNRESOLVED' : 'READ_UNRESOLVED',
      instruction: 'Consultar o estado existente; nao repetir automaticamente nem mudar commandId/expectedVersion.' });
  }
})();
