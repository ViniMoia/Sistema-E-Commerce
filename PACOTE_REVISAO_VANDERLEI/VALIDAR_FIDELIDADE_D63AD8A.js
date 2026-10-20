// Execute no Console do Admin autenticado na URL de revisao d63ad8a.
// Somente dois GETs: confirma loja/pedido de referencia e consulta o relatorio.
// Nao imprime transacoes recentes, nomes, emails, cookies ou tokens.
// Baseline: 19/10/2026 22:30 BRT. Divergencia exige nova conferencia, nunca ajuste de saldo.
(async () => {
  const origin = 'https://review-d63ad8a---continental-hml-jctvprygla-rj.a.run.app';
  const orderId = '0f0a05ff-2a24-4e6f-93ef-be13451388c9';
  const result = { phase: 'loyalty_report_read', at: new Date().toISOString(),
    processingAttempted: false, mutationAttempted: false, identityVerified: false };
  const emit = extra => console.log(JSON.stringify({ ...result, ...extra }, null, 2));
  if (location.origin !== origin) return emit({ ok: false, code: 'WRONG_REVIEW_ORIGIN' });
  const options = () => ({ method: 'GET', credentials: 'same-origin', cache: 'no-store',
    redirect: 'error', signal: AbortSignal.timeout(30000) });
  try {
    const reference = await fetch(`/api/admin/orders/${orderId}`, options());
    if (!reference.ok) return emit({ ok: false, code: 'REFERENCE_READ_FAILED', httpStatus: reference.status });
    const body = await reference.json(), order = body.data;
    if (body.success !== true || order?.id !== orderId || order.orderNumber !== 6 ||
        order.lojaID !== '3a82b33c-3646-4272-9a89-80bb1ba327a5' || order.asaasPaymentId !== 'pay_blfexx8zkousw431') {
      return emit({ ok: false, code: 'REFERENCE_IDENTITY_MISMATCH' });
    }
    result.identityVerified = true;
    const response = await fetch('/api/admin/loyalty/reports', options());
    if (!response.ok) return emit({ ok: false, code: 'REPORT_READ_FAILED', httpStatus: response.status });
    const report = await response.json(), m = report.data?.metrics;
    if (report.success !== true || !m || !m.commercial) return emit({ ok: false, code: 'REPORT_CONTRACT_UNRESOLVED' });
    const expected = { totalCirculatingPoints: 161, totalDebtPoints: 0, projectedFinancialLiability: 8.05,
      activeCustomersWithPoints: 1, totalLifetimeEarnedPoints: 660, legacyWallets: 0,
      totalRedeemedPoints: 599, totalRedeemedMonetaryValue: 29.95 };
    const expectedCommercial = { earnedPoints: 231, reversedEarnedPoints: 171, redeemedPoints: 599,
      returnedPoints: 100, netRedeemedPoints: 499, redeemedValue: 29.95, returnedValue: 5,
      netRedeemedValue: 24.95, missingMonetaryValues: 0, unlinkedTransactions: 0 };
    const select = (source, keys) => Object.fromEntries(Object.keys(keys).map(key => {
      if (typeof source[key] !== 'number' || !Number.isFinite(source[key])) throw new Error('INVALID_METRIC');
      return [key, source[key]];
    }));
    const metrics = select(m, expected), commercial = select(m.commercial, expectedCommercial);
    if (!['COMPLETE', 'PARTIAL'].includes(m.commercial.coverage)) throw new Error('INVALID_COVERAGE');
    commercial.coverage = m.commercial.coverage;
    const differences = [
      ...Object.keys(expected).filter(k => metrics[k] !== expected[k]),
      ...Object.keys(expectedCommercial).filter(k => commercial[k] !== expectedCommercial[k]).map(k => 'commercial.' + k),
      ...(commercial.coverage !== 'COMPLETE' ? ['commercial.coverage'] : []),
    ];
    const cache = response.headers.get('cache-control') ?? '';
    const privateNoStore = cache.includes('private') && cache.includes('no-store');
    emit({ ok: privateNoStore && differences.length === 0,
      code: !privateNoStore ? 'CACHE_POLICY_UNVERIFIED' : differences.length ? 'BASELINE_DIFFERENCE' : 'LOYALTY_API_MATCHES_BASELINE',
      httpStatus: response.status, privateNoStore, baselineAt: '2026-10-20T01:30:00.046Z',
      metrics: { ...metrics, commercial }, differences,
      instruction: 'Enviar somente este JSON. Comparacao com baseline anterior; nao comprova ausencia de mudancas entre leituras nem aceite completo.' });
  } catch {
    emit({ ok: false, code: 'READ_UNRESOLVED', instruction: 'Conferir sessao, revisao e disponibilidade; nao ajustar pontos ou processar filas.' });
  }
})();
