// Leno (Brega): execute UMA vez no Console do Admin autenticado do mesmo Preview.
// Pedido #3: email de pagamento recebido e saldo Sandbox >= R$ 49,90 conferidos.
// Registra REFUND duravel; nao processa filas nem comprova estorno remoto.
// Preserve commandId, expectedVersion=1 e operador em qualquer replay planejado.
(async () => {
  const origin = 'https://continental-prototipo-git-homologacaoteste-vinimoias-projects.vercel.app';
  const orderId = '5b5bef57-2fd2-4f88-83fd-bf3d76238c40';
  const command = { kind: 'REFUND', commandId: 'l04-pix-refund-pedido3-5b5bef57-v1', expectedVersion: 1 };
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
    if (body.success !== true || !order || order.id !== orderId || order.orderNumber !== 3 ||
      order.lojaID !== '3a82b33c-3646-4272-9a89-80bb1ba327a5' || order.version !== command.expectedVersion ||
      order.status !== 'PAID' || order.asaasPaymentStatus !== 'RECEIVED' || order.paymentMethod !== 'PIX' ||
      order.asaasPaymentId !== 'pay_cra35xq1ltkb6oka' || Number(order.total) !== 49.9 ||
      order.pointsRedeemed !== 0 || order.pointsCredited !== 24 || order.paidAt !== '2026-10-09T18:15:24.207Z' ||
      !Array.isArray(order.items) || order.items.length !== 1 ||
      order.items[0].id !== 'e385cec8-1c96-47da-88fa-b9c3950a0302' || order.items[0].quantity !== 1 ||
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
    if (!data || !uuid(data.attemptId) || typeof data.replay !== 'boolean' || !Array.isArray(data.operations) ||
      data.operations.length !== 1 || !uuid(data.operations[0].id) || data.operations[0].kind !== 'REFUND' ||
      !['READY', 'SUBMITTING', 'PENDING', 'UNKNOWN', 'COMPLETED'].includes(data.operations[0].status)) {
      return emit({ ok: false, code: 'REQUEST_UNRESOLVED',
        instruction: 'Solicitacao pode estar gravada; consultar sem repetir automaticamente.' });
    }
    emit({ ok: true, code: data.replay ? 'REFUND_REQUEST_ALREADY_EXISTS' : 'REFUND_REQUEST_ACCEPTED',
      attemptId: data.attemptId, replay: data.replay,
      operations: data.operations.map(op => ({ id: op.id, kind: op.kind, status: op.status })),
      instruction: 'Enviar este JSON; comando aceito nao comprova estorno. Aguardar conferencia antes de processar filas.' });
  } catch {
    emit({ ok: false, code: requestAttempted ? 'REQUEST_UNRESOLVED' : 'READ_UNRESOLVED',
      instruction: 'Consultar o estado existente; nao repetir automaticamente nem mudar commandId/expectedVersion.' });
  }
})();
