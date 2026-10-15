// HISTORICO: solicitacao #4 aceita e estorno conciliado em 15/10/2026. NAO executar novamente.
// Cenario encerrado: historico remoto, 12 webhooks e compensacoes conferidos; instrucoes abaixo sao historicas.
// Leno (Brega): execute UMA vez no Console do Admin autenticado do mesmo Preview.
// #4, 12x R$ 30,06 = R$ 360,72. Exige deploy do estorno por contrato conferido.
// Exige produto ainda na loja, baseline e cobranca Sandbox sem estorno em curso.
// Registra REFUND duravel; nao processa filas nem comprova estorno remoto.
// Preserve commandId, expectedVersion=1 e operador em qualquer replay planejado.
(async () => {
  const origin = 'https://continental-prototipo-git-homologacaoteste-vinimoias-projects.vercel.app';
  const orderId = 'ae14cb17-49fa-47ae-98eb-b48ef3f8ada1';
  const command = { kind: 'REFUND', commandId: 'l04-card-refund-pedido4-ae14cb17-v1', expectedVersion: 1 };
  const chargeIds = [
    "7739c3f8-6a87-455f-add6-6b1b59209249",
    "e6f5a9e8-1922-4617-9235-a495cf82e34e",
    "4f7dc619-c363-4188-a84f-b82a5b163c41",
    "3160e580-699d-48f8-8174-612ac29d776f",
    "79466a00-12e0-4343-b7b5-7ab4c278f104",
    "803b5053-315d-4d04-8d86-c167f72a350b",
    "57e5d632-98a9-4196-a9e5-f87b013968c4",
    "780d04cf-59e1-4cfb-befb-91a5ffba2098",
    "7f4ff7ee-4e4f-447f-a39d-44c6d4b0b6b2",
    "41094955-13de-4cd7-b864-932891618eb2",
    "81fe7239-ddfc-48fe-9e05-a4903fb300bf",
    "f218d9bc-b5b8-4e9a-a341-cb779b0c4790"
  ];
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
    if (body.success !== true || !order || order.id !== orderId || order.orderNumber !== 4 ||
      order.lojaID !== '3a82b33c-3646-4272-9a89-80bb1ba327a5' || order.version !== command.expectedVersion ||
      order.status !== 'PAID' || !['CONFIRMED', 'RECEIVED'].includes(order.asaasPaymentStatus) || order.paymentMethod !== 'CREDIT_CARD' ||
      order.asaasPaymentId !== 'pay_4up6nmdy5f3jnroi' || Number(order.total) !== 299.4 || Number(order.financialTotal) !== 360.72 ||
      order.installments !== 12 || Number(order.installmentValue) !== 30.06 || Number(order.financingCharge) !== 61.32 || order.deliveryType !== 'PICKUP' ||
      Number(order.shippingCost) !== 0 || Number(order.pointsDiscountValue) !== 0 ||
      order.pointsRedeemed !== 0 || order.pointsCredited !== 149 || order.paidAt !== '2026-10-13T17:11:24.278Z' ||
      !Array.isArray(order.items) || order.items.length !== 1 ||
      order.items[0].id !== '6c084775-3ee4-4ff4-a76e-f52dacf05433' || order.items[0].quantity !== 6 ||
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
    if (!data || data.attemptId !== '41ede05c-40fd-4542-800c-311af6b25cb8' || typeof data.replay !== 'boolean' || !Array.isArray(data.operations) ||
      data.operations.length !== 12 || new Set(data.operations.map(op => op.id)).size !== 12 ||
      new Set(data.operations.map(op => op.chargeId)).size !== 12 ||
      data.operations.some(op => !uuid(op.id) || op.kind !== 'REFUND' || !chargeIds.includes(op.chargeId) ||
        !['READY', 'SUBMITTING', 'PENDING', 'UNKNOWN', 'COMPLETED'].includes(op.status))) {
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
