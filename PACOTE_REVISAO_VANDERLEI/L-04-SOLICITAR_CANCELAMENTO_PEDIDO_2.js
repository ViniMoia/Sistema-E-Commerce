// Execute uma vez no Console do navegador, no Admin do Preview autenticado.
// Solicita a operacao duravel; nao processa filas nem comprova cancelamento remoto.
(async () => {
  const origin = 'https://continental-prototipo-git-homologacaoteste-vinimoias-projects.vercel.app';
  const orderId = 'e0bfe582-e85b-41e7-8b5c-d877b1e1a7e0';
  const command = { kind: 'CANCEL', commandId: 'l04-pix-cancel-pedido2-e0bfe582-v0', expectedVersion: 0 };
  let phase = 'origin_check';
  let requestAttempted = false;
  let httpStatus = null;
  const emit = result => console.log(JSON.stringify({ phase, requestAttempted, processingAttempted: false,
    orderId, commandId: command.commandId, httpStatus, ...result }, null, 2));
  try {
    if (location.origin !== origin) return emit({ ok: false, code: 'WRONG_PREVIEW' });
    phase = 'order_check';
    const read = await fetch(`/api/admin/orders/${orderId}`, { credentials: 'same-origin', cache: 'no-store',
      redirect: 'error', signal: AbortSignal.timeout(60000) });
    httpStatus = read.status;
    if (!read.ok) return emit({ ok: false, code: 'ORDER_READ_FAILED' });
    const body = await read.json();
    const order = body.data;
    if (body.success !== true || !order || order.id !== orderId || order.orderNumber !== 2 ||
      order.lojaID !== '3a82b33c-3646-4272-9a89-80bb1ba327a5' || order.version !== command.expectedVersion ||
      order.status !== 'PENDING' || order.asaasPaymentStatus !== 'PENDING' || order.paymentMethod !== 'PIX' ||
      order.asaasPaymentId !== 'pay_3cuzqjn8kvzirv3k' || Number(order.total) !== 49.9 || order.pointsRedeemed !== 0 ||
      !Array.isArray(order.items) || order.items.length !== 1 || order.items[0].quantity !== 1 ||
      order.items[0].size !== 'Pequeno' || order.items[0].color !== 'Vermelho') {
      return emit({ ok: false, code: 'ORDER_CHANGED_OR_UNEXPECTED', instruction: 'Consultar o estado; nao enviar outro comando.' });
    }
    phase = 'request_cancel';
    httpStatus = null;
    requestAttempted = true;
    const response = await fetch(`/api/admin/orders/${orderId}/payment-operation`, { method: 'POST',
      credentials: 'same-origin', redirect: 'error', signal: AbortSignal.timeout(60000),
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(command) });
    httpStatus = response.status;
    const result = await response.json();
    if (response.status !== 202) return emit({ ok: false,
      code: typeof result.error === 'string' && /^PAYMENT_[A-Z_]+$/.test(result.error) ? result.error : 'REQUEST_NOT_ACCEPTED',
      instruction: 'Conferir a resposta e o estado antes de qualquer nova tentativa.' });
    if (!result.data || typeof result.data.attemptId !== 'string' || !Array.isArray(result.data.operations) ||
      result.data.operations.length !== 1 || result.data.operations[0].kind !== 'CANCEL') {
      return emit({ ok: false, code: 'REQUEST_UNRESOLVED', instruction: 'A solicitacao pode estar gravada; consultar sem repetir.' });
    }
    emit({ ok: true, code: 'CANCEL_REQUEST_ACCEPTED', attemptId: result.data.attemptId,
      replay: result.data.replay, operations: result.data.operations.map(op => ({ id: op.id, kind: op.kind, status: op.status })),
      instruction: 'Comando aceito; aguardar orientacao para processamento e prova do cancelamento.' });
  } catch {
    emit({ ok: false, code: requestAttempted ? 'REQUEST_UNRESOLVED' : 'READ_UNRESOLVED',
      instruction: 'Consultar o estado existente; nao repetir automaticamente.' });
  }
})();
