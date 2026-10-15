// Execute UMA vez no Console do Admin autenticado do Preview de homologacao.
// #7: boleto nao pago, retirada, R$ 49,90. Nao confirmar pagamento no Sandbox.
// Registra CANCEL duravel; nao processa filas nem comprova cancelamento remoto.
// Preserve commandId, expectedVersion=0 e operador em eventual replay planejado.
(async () => {
  const origin = 'https://continental-prototipo-git-homologacaoteste-vinimoias-projects.vercel.app';
  const orderId = 'cd2153ce-9b36-4c9a-ba89-376bf201ae91';
  const command = { kind: 'CANCEL', commandId: 'l04-boleto-cancel-pedido7-cd2153ce-v0', expectedVersion: 0 };
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
    if (body.success !== true || !order || order.id !== orderId || order.orderNumber !== 7 ||
      order.lojaID !== '3a82b33c-3646-4272-9a89-80bb1ba327a5' || order.version !== command.expectedVersion ||
      order.status !== 'PENDING' || order.asaasPaymentStatus !== 'PENDING' || order.paymentMethod !== 'BOLETO' ||
      order.asaasPaymentId !== 'pay_ddili6nqoxts9jp3' || order.paidAt !== null ||
      Number(order.total) !== 49.9 || Number(order.financialTotal) !== 49.9 || order.installments !== 1 ||
      Number(order.financingCharge) !== 0 || Number(order.shippingCost) !== 0 || order.deliveryType !== 'PICKUP' ||
      order.pointsRedeemed !== 0 || order.pointsCredited !== 0 ||
      !Array.isArray(order.items) || order.items.length !== 1 ||
      order.items[0].id !== 'be7c9436-4c74-426a-8e3f-f4eae3ce479e' || order.items[0].quantity !== 1 ||
      order.items[0].size !== 'Pequeno' || order.items[0].color !== 'Vermelho' || Number(order.items[0].price) !== 49.9 ||
      !Array.isArray(order.statusHistory) || order.statusHistory.length !== 0) {
      return emit({ ok: false, code: 'ORDER_CHANGED_OR_UNEXPECTED',
        instruction: 'Consultar o estado; nao alterar a identidade do comando nem solicitar outra operacao.' });
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
      instruction: 'Consultar resposta e estado existente antes de qualquer nova tentativa.' });
    const data = result.data;
    const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
    if (!data || data.attemptId !== '91e50803-019e-4f56-b3c9-9cb16ebd83e6' || typeof data.replay !== 'boolean' ||
      !Array.isArray(data.operations) || data.operations.length !== 1 || !uuid(data.operations[0]?.id) ||
      data.operations[0].kind !== 'CANCEL' || data.operations[0].chargeId !== '63f47496-7646-4ca7-a6c7-80d172fb60c7' ||
      !['READY', 'SUBMITTING', 'PENDING', 'UNKNOWN', 'COMPLETED'].includes(data.operations[0].status)) {
      return emit({ ok: false, code: 'REQUEST_UNRESOLVED',
        instruction: 'Solicitacao pode estar gravada; consultar sem repetir automaticamente.' });
    }
    emit({ ok: true, code: data.replay ? 'CANCEL_REQUEST_ALREADY_EXISTS' : 'CANCEL_REQUEST_ACCEPTED',
      attemptId: data.attemptId, replay: data.replay,
      operations: data.operations.map(op => ({ id: op.id, chargeId: op.chargeId, kind: op.kind, status: op.status })),
      instruction: 'Enviar este JSON; comando aceito nao comprova cancelamento. Aguardar conferencia antes de processar filas.' });
  } catch {
    emit({ ok: false, code: requestAttempted ? 'REQUEST_UNRESOLVED' : 'READ_UNRESOLVED',
      instruction: 'Consultar o estado existente; nao repetir automaticamente nem mudar commandId/expectedVersion.' });
  }
})();
