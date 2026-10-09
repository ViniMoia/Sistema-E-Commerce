// Somente leitura: execute no Console do Admin autenticado do mesmo Preview.
// Confere a projecao do pedido antes do REFUND; nao solicita operacoes ou processa filas.
(async () => {
  const origin = 'https://continental-prototipo-git-homologacaoteste-vinimoias-projects.vercel.app';
  const orderId = '5b5bef57-2fd2-4f88-83fd-bf3d76238c40';
  let readAttempted = false;
  let httpStatus = null;
  const emit = result => console.log(JSON.stringify({ phase: 'pre_refund_order_read', orderId,
    readAttempted, requestAttempted: false, processingAttempted: false, httpStatus, ...result }, null, 2));
  try {
    if (location.origin !== origin) return emit({ ok: false, code: 'WRONG_PREVIEW' });
    readAttempted = true;
    const response = await fetch(`/api/admin/orders/${orderId}`, { credentials: 'same-origin', cache: 'no-store',
      redirect: 'error', signal: AbortSignal.timeout(60000) });
    httpStatus = response.status;
    if (!response.ok) return emit({ ok: false, code: 'ORDER_READ_FAILED' });
    const body = await response.json();
    const order = body.data;
    if (body.success !== true || !order || order.id !== orderId || order.orderNumber !== 3 ||
      order.lojaID !== '3a82b33c-3646-4272-9a89-80bb1ba327a5' ||
      order.asaasPaymentId !== 'pay_cra35xq1ltkb6oka') {
      return emit({ ok: false, code: 'ORDER_IDENTITY_MISMATCH' });
    }
    const token = value => typeof value === 'string' && /^[A-Z_]{1,40}$/.test(value) ? value : null;
    const paidAt = typeof order.paidAt === 'string' && Number.isFinite(Date.parse(order.paidAt)) &&
      /^[0-9TZ:.+-]{10,40}$/.test(order.paidAt) ? order.paidAt : null;
    const version = Number.isSafeInteger(order.version) && order.version >= 0 ? order.version : null;
    const history = Array.isArray(order.statusHistory) ? order.statusHistory : null;
    const paidHistory = history ? history.filter(row => row.status === 'PAID' &&
      row.previousStatus === 'PENDING' && row.orderVersion === version) : [];
    const itemMatches = Array.isArray(order.items) && order.items.length === 1 &&
      order.items[0].id === 'e385cec8-1c96-47da-88fa-b9c3950a0302' && order.items[0].quantity === 1 &&
      order.items[0].size === 'Pequeno' && order.items[0].color === 'Vermelho' &&
      Number(order.items[0].price) === 49.9;
    const verified = version !== null && version > 0 && order.status === 'PAID' &&
      order.asaasPaymentStatus === 'RECEIVED' && order.paymentMethod === 'PIX' &&
      Number(order.total) === 49.9 && order.pointsRedeemed === 0 && order.pointsCredited === 24 &&
      paidAt !== null && itemMatches && history !== null && history.length === 1 && paidHistory.length === 1;
    emit({ ok: verified, code: verified ? 'PRE_REFUND_ORDER_VERIFIED' : 'ORDER_CHANGED_OR_UNEXPECTED',
      orderNumber: 3, lojaID: order.lojaID, version, status: token(order.status),
      paymentMethod: token(order.paymentMethod), asaasPaymentId: order.asaasPaymentId,
      asaasPaymentStatus: token(order.asaasPaymentStatus), total: Number(order.total),
      pointsRedeemed: Number.isSafeInteger(order.pointsRedeemed) ? order.pointsRedeemed : null,
      pointsCredited: Number.isSafeInteger(order.pointsCredited) ? order.pointsCredited : null,
      paidAt, itemMatches, historyCount: history ? history.length : null, paidHistoryCount: paidHistory.length,
      financialRecordsVerified: false,
      instruction: 'Enviar este JSON; leitura nao solicita estorno nem comprova tentativa, saldo Asaas ou reserva internos.' });
  } catch {
    emit({ ok: false, code: 'READ_UNRESOLVED', instruction: 'Enviar este JSON; nao solicitar REFUND por uma leitura inconclusiva.' });
  }
})();
