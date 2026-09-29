import crypto from 'node:crypto'

const baseUrl = process.env.ASAAS_API_URL?.replace(/\/$/, '')
const accessToken = process.env.ASAAS_API_KEY

if (process.env.ALLOW_ASAAS_SANDBOX_WRITE !== '1') {
  throw new Error('Defina ALLOW_ASAAS_SANDBOX_WRITE=1 para autorizar a fixture descartavel.')
}
if (!baseUrl || !accessToken) {
  throw new Error('ASAAS_API_URL e ASAAS_API_KEY sao obrigatorios.')
}
const apiHost = new URL(baseUrl).hostname.toLowerCase()
if (!apiHost.includes('sandbox')) {
  throw new Error('Execucao recusada: ASAAS_API_URL nao aponta para sandbox.')
}

function syntheticCpf(seed) {
  const digits = seed.replace(/\D/g, '').padEnd(9, '7').slice(0, 9).split('').map(Number)
  const check = (values, factor) => {
    const remainder = values.reduce((sum, value) => sum + value * factor--, 0) % 11
    return remainder < 2 ? 0 : 11 - remainder
  }
  digits.push(check(digits, 10))
  digits.push(check(digits, 11))
  return digits.join('')
}

async function asaas(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    signal: AbortSignal.timeout(20_000),
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      access_token: accessToken,
      ...(init.headers ?? {}),
    },
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    const codes = Array.isArray(body.errors)
      ? body.errors.map((error) => error.code).filter(Boolean).join(',')
      : 'UNKNOWN'
    throw new Error(`ASAAS_HTTP_${response.status}:${codes}`)
  }
  return body
}

async function waitForRefund(paymentId, operationReference) {
  for (let attempt = 1; attempt <= 15; attempt += 1) {
    const list = await asaas(`/payments/${encodeURIComponent(paymentId)}/refunds`)
    const match = list.data?.find((refund) => refund.description === operationReference)
    if (match?.status === 'DONE' || match?.status === 'CANCELLED') return match
    await new Promise((resolve) => setTimeout(resolve, 2_000))
  }
  throw new Error('ASAAS_REFUND_CONFIRMATION_TIMEOUT')
}

const runId = `${Date.now()}-${crypto.randomUUID()}`
const customer = await asaas('/customers', {
  method: 'POST',
  body: JSON.stringify({
    name: 'Cliente Ficticio - Validacao Refund',
    email: `refund-sandbox-${runId}@example.com`,
    cpfCnpj: syntheticCpf(runId),
    notificationDisabled: true,
  }),
})
const dueDate = new Date(Date.now() + 24 * 60 * 60_000).toISOString().slice(0, 10)
const payment = await asaas('/payments', {
  method: 'POST',
  body: JSON.stringify({
    customer: customer.id,
    billingType: 'PIX',
    value: 10,
    dueDate,
    description: 'Cobranca ficticia para validacao de refund',
    externalReference: `refund-sandbox-${runId}`,
  }),
})
await asaas(`/sandbox/payment/${encodeURIComponent(payment.id)}/confirm`, {
  method: 'POST',
  body: '{}',
})

const operationOne = `refund:${crypto.randomUUID()}`
await asaas(`/payments/${encodeURIComponent(payment.id)}/refund`, {
  method: 'POST',
  body: JSON.stringify({ value: 2, description: operationOne }),
})
const first = await waitForRefund(payment.id, operationOne)
if (first.status !== 'DONE') throw new Error(`FIRST_REFUND_${first.status}`)

const operationTwo = `refund:${crypto.randomUUID()}`
await asaas(`/payments/${encodeURIComponent(payment.id)}/refund`, {
  method: 'POST',
  body: JSON.stringify({ value: 2, description: operationTwo }),
})
const second = await waitForRefund(payment.id, operationTwo)
if (second.status !== 'DONE') throw new Error(`SECOND_REFUND_${second.status}`)

const finalList = await asaas(`/payments/${encodeURIComponent(payment.id)}/refunds`)
const verified = finalList.data.filter((refund) =>
  refund.status === 'DONE' && [operationOne, operationTwo].includes(refund.description)
)
if (verified.length !== 2 || verified.reduce((sum, refund) => sum + refund.value, 0) !== 4) {
  throw new Error('ASAAS_REFUND_LIST_MISMATCH')
}

console.log(JSON.stringify({
  environment: 'sandbox',
  billingType: 'PIX',
  requestedRefunds: 2,
  confirmedRefunds: verified.length,
  confirmedAmount: verified.reduce((sum, refund) => sum + refund.value, 0),
  statuses: verified.map((refund) => refund.status),
}))
