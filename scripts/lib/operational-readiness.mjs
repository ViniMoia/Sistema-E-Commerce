// Proposal for the paths exercised by the disposable lab, not a remote rollout.
export const runtimeGrants = {
  Loja: ['SELECT'], User: ['SELECT'], Address: ['SELECT'], FreightRule: ['SELECT'],
  FreightTariffRevision: ['SELECT'], JtExpressGeocom: ['SELECT'], JtExpressRate: ['SELECT'],
  Product: ['SELECT', 'UPDATE'], ProductVariants: ['SELECT', 'UPDATE'],
  CheckoutBasket: ['SELECT', 'INSERT', 'UPDATE'], CheckoutIntent: ['SELECT', 'INSERT', 'UPDATE'],
  Cart: ['SELECT', 'INSERT', 'UPDATE'], CartItem: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
  OrderBuyer: ['SELECT', 'INSERT', 'UPDATE'], Order: ['SELECT', 'INSERT', 'UPDATE'],
  OrderItem: ['SELECT', 'INSERT'], OrderStatusHistory: ['SELECT', 'INSERT'],
  PaymentAttempt: ['SELECT', 'INSERT', 'UPDATE'], PaymentCharge: ['SELECT', 'INSERT', 'UPDATE'],
  PaymentOperation: ['SELECT', 'INSERT', 'UPDATE'], FinancialFact: ['SELECT', 'INSERT'],
  PaymentInbox: ['SELECT', 'INSERT', 'UPDATE'], PaymentWebhookEvent: ['SELECT', 'INSERT', 'UPDATE'],
  CommerceOutbox: ['SELECT', 'INSERT', 'UPDATE'], InventoryReservation: ['SELECT', 'INSERT', 'UPDATE'],
  AuditLog: ['SELECT', 'INSERT'], LoyaltyWallet: ['SELECT', 'INSERT', 'UPDATE'],
  LoyaltyTransaction: ['SELECT', 'INSERT'], LoyaltyLot: ['SELECT', 'INSERT', 'UPDATE'],
  LoyaltyAllocation: ['SELECT', 'INSERT', 'UPDATE'], FreightQuote: ['SELECT', 'INSERT', 'UPDATE'],
};
export const routines = ['check_inventory_reservation_source', 'check_checkout_commit',
  'keep_checkout_intent_immutable', 'keep_checkout_source_consumed', 'payment_operation_provenance',
  'financial_fact_provenance', 'boleto_refund_operation_guard'];
// PostgreSQL SELECT ... FOR SHARE also requires UPDATE on at least one column.
export const lockColumnGrants = { Loja: 'id', User: 'id', FreightTariffRevision: 'id' };
export function grantSql() {
  return `REVOKE CREATE ON SCHEMA public FROM ecommerce_test;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ecommerce_test;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM ecommerce_test;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO ecommerce_test;
GRANT SELECT ON "_TestDatabaseSentinel" TO ecommerce_test;
${Object.entries(lockColumnGrants).map(([table, column]) => `GRANT UPDATE ("${column}") ON "${table}" TO ecommerce_test;`).join('\n')}
${Object.entries(runtimeGrants).map(([table, permissions]) => `GRANT ${permissions.join(', ')} ON TABLE "${table}" TO ecommerce_test;`).join('\n')}
GRANT USAGE, SELECT ON SEQUENCE "Order_orderNumber_seq" TO ecommerce_test;
${routines.map(name => `GRANT EXECUTE ON FUNCTION ${name}() TO ecommerce_test;`).join('\n')}`;
}

// Allowlist only the OS variables needed to locate Node/Docker and temporary files.
// Never forward process.env wholesale to migration, Vitest or provider code.
export function systemEnvironment(source = process.env) {
  const names = new Set(['path', 'pathext', 'systemroot', 'windir', 'comspec', 'temp', 'tmp',
    'tmpdir', 'userprofile', 'home', 'appdata', 'localappdata', 'programfiles', 'programfiles(x86)',
    'programdata', 'systemdrive', 'number_of_processors', 'processor_architecture']);
  return Object.fromEntries(Object.entries(source).filter(([key]) => names.has(key.toLowerCase())));
}
export function poolBudget({ pool = 4, revisions = 6, instancesPerRevision = 1,
  overlappingRevisions = 1, administration = 4, maxConnections = 112, reserved = 4,
  externalConnections = null } = {}) {
  for (const value of [pool, revisions, instancesPerRevision, overlappingRevisions, administration, maxConnections, reserved]) {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error('INVALID_POOL_BUDGET');
  }
  if (externalConnections !== null && (!Number.isSafeInteger(externalConnections) || externalConnections < 0)) throw new Error('INVALID_POOL_BUDGET');
  const cloudRun = pool * instancesPerRevision * (revisions + overlappingRevisions);
  const known = cloudRun + administration;
  return { pool, revisions, instancesPerRevision, overlappingRevisions, administration,
    maxConnections, reserved, cloudRun, known, externalConnections,
    remainingBeforeExternal: maxConnections - reserved - known,
    approved: false, note: 'Planning arithmetic only; external workload, memory and database limits require separate evidence.' };
}

export function alertProposals(baseline) {
  const result = structuredClone(baseline);
  result.state = 'PREPARED_NOT_APPLIED';
  result.basedOn = 'V-PROPOSTAS-G6-2026-10-22.json';
  result.pilotLimits.payments.timeoutCandidate = {
    state: 'EXPERIMENTAL_NOT_APPLIED', webSeconds: 60, httpMilliseconds: 75000, jobSeconds: 240,
    maxBatches: 1, tasks: 1, parallelism: 1, maxRetries: 0,
    reasoning: 'Keep web bound; HTTP adds 15s to observe its response; Job covers 3 requests at 75s plus 15s process allowance.',
    limitation: 'Synthetic measurements are not a worst-case bound. Provider calls, cold starts and DB contention require a coordinated measurement before adoption.',
    stopOnTimeout: 'UNKNOWN_OUTCOME_NO_POST_RETRY',
  };
  for (const addition of result.additions) {
    if (addition.resource !== 'alertPolicy') continue;
    addition.body.enabled = false;
    for (const condition of addition.body.conditions) {
      if (condition.conditionAbsent) {
        condition.conditionAbsent.filter +=
          ' AND resource.labels.project_id="continental-511812" AND resource.labels.location="southamerica-east1" AND resource.labels.job_name="continental-hml-payments"';
        // Cloud Monitoring recommends >=10min alignment for log-based metrics.
        condition.conditionAbsent.aggregations[0].alignmentPeriod = '600s';
      }
    }
  }
  return result;
}

// Deliberately small evaluator for the exact proposal filters. Unsupported syntax
// fails closed. This is a local contract test, not the Cloud Logging API validator.
export function matchesLogFilter(filter, entry) {
  const tokens = filter.match(/\(|\)|>=|=|"[^"]*"|[A-Za-z_][A-Za-z0-9_.]*/g) ?? [];
  if (tokens.join('') !== filter.replace(/\s+(?=(?:[^"]*"[^"]*")*[^"]*$)/g, '')) throw new Error('UNSUPPORTED_FILTER');
  let i = 0;
  const ranks = ['DEFAULT', 'DEBUG', 'INFO', 'NOTICE', 'WARNING', 'ERROR', 'CRITICAL', 'ALERT', 'EMERGENCY'];
  const atom = () => {
    if (tokens[i] === '(') { i++; const result = or(); if (tokens[i++] !== ')') throw new Error('UNSUPPORTED_FILTER'); return result; }
    const field = tokens[i++], op = tokens[i++], token = tokens[i++];
    if (!field || !['=', '>='].includes(op) || !token) throw new Error('UNSUPPORTED_FILTER');
    const expected = token.startsWith('"') ? JSON.parse(token) : token;
    const value = field.split('.').reduce((v, key) => v?.[key], entry);
    if (op === '=') return value === expected;
    if (field !== 'severity' || !ranks.includes(expected)) throw new Error('UNSUPPORTED_FILTER');
    return ranks.includes(value) && ranks.indexOf(value) >= ranks.indexOf(expected);
  };
  const and = () => { let value = atom(); while (tokens[i] === 'AND') { i++; const right = atom(); value = value && right; } return value; };
  const or = () => { let value = and(); while (tokens[i] === 'OR') { i++; const right = and(); value = value || right; } return value; };
  const result = or(); if (i !== tokens.length) throw new Error('UNSUPPORTED_FILTER'); return result;
}
