// Execute no Console do Preview, autenticado como Admin, APOS ativar
// CHECKOUT_PAUSED=true e concluir o redeploy da revisao publicada.
// Os POSTs enviam somente {}: contrato invalido, sem intencao/consentimento,
// portanto nao criam compras mesmo se a pausa estiver desligada.
// Nao processa filas, nao paga/cancela/estorna pedidos e nao prova drenagem.
(async () => {
  const origin = 'https://continental-prototipo-git-homologacaoteste-vinimoias-projects.vercel.app';
  const orderId = 'cd2153ce-9b36-4c9a-ba89-376bf201ae91'; // #7 ja cancelado
  const result = { phase: 'checkout_pause_probe', ok: false, processingAttempted: false,
    validPurchaseSubmitted: false, probes: [], recovery: null };
  const emit = extra => console.log(JSON.stringify({ ...result, ...extra }, null, 2));
  if (location.origin !== origin) return emit({ code: 'WRONG_PREVIEW' });
  const options = { credentials: 'same-origin', cache: 'no-store', redirect: 'error' };
  try {
    const orderResponse = await fetch(`/api/admin/orders/${orderId}`, { ...options, signal: AbortSignal.timeout(60000) });
    if (!orderResponse.ok) return emit({ code: 'ADMIN_READ_FAILED', httpStatus: orderResponse.status });
    const body = await orderResponse.json();
    const order = body.data;
    if (body.success !== true || order?.id !== orderId || order.orderNumber !== 7 ||
        order.lojaID !== '3a82b33c-3646-4272-9a89-80bb1ba327a5' || order.status !== 'CANCELLED') {
      return emit({ code: 'REFERENCE_ORDER_CHANGED' });
    }
    for (const path of ['/api/checkout/intents', '/api/checkout', '/api/orders']) {
      const response = await fetch(path, { ...options, method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: '{}', signal: AbortSignal.timeout(60000) });
      const data = await response.json();
      result.probes.push({ path, httpStatus: response.status,
        paused: response.status === 503 && data.success === false && data.error === 'CHECKOUT_PAUSED',
        noStore: (response.headers.get('cache-control') ?? '').includes('no-store') });
    }
    // A sessao Admin pode nao ser a compradora do pedido. A recusa do GET deve
    // ser preservada; nunca contornar identidade para produzir sucesso no teste.
    if (typeof order.checkoutIntentID === 'string' && /^[0-9a-f-]{36}$/i.test(order.checkoutIntentID)) {
      const response = await fetch('/api/checkout/intents/' + encodeURIComponent(order.checkoutIntentID),
        { ...options, signal: AbortSignal.timeout(60000) });
      const data = await response.json();
      result.recovery = { httpStatus: response.status,
        verified: response.ok && data.success === true && data.data?.result?.order?.id === orderId,
        instruction: response.ok ? 'Conferir verified.' : 'Consultar com a sessao compradora; nao alterar permissoes.' };
    }
    emit({ ok: result.probes.every(p => p.paused && p.noStore),
      code: result.probes.every(p => p.paused && p.noStore) ? 'INVALID_COMMAND_PROBES_PAUSED' : 'PAUSE_NOT_VERIFIED',
      instruction: 'Enviar JSON. Este teste nao comprova bloqueio de proposta valida, webhook, todas as revisoes ou reabertura.' });
  } catch {
    emit({ code: 'PROBE_UNRESOLVED', instruction: 'Conferir acesso e deployment; nao enviar comando financeiro.' });
  }
})();
