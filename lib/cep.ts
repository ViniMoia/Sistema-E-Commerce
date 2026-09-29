const CEP_LOOKUP_TIMEOUT_MS = 3_000

export interface ResolvedBrazilianCep {
  cep: string
  city: string
  state: string
}

export function normalizeBrazilianCity(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('pt-BR')
}

export async function resolveBrazilianCep(
  rawCep: string,
  fetcher: typeof fetch = fetch
): Promise<ResolvedBrazilianCep> {
  const cep = rawCep.replace(/\D/g, '')
  if (cep.length !== 8) {
    throw new Error('CEP inválido para consulta de localidade.')
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), CEP_LOOKUP_TIMEOUT_MS)

  try {
    const response = await fetcher(`https://viacep.com.br/ws/${cep}/json/`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
    if (!response.ok) {
      throw new Error(`Consulta de CEP falhou com HTTP ${response.status}.`)
    }

    const data = await response.json() as {
      erro?: boolean
      localidade?: unknown
      uf?: unknown
    }
    if (
      data.erro === true ||
      typeof data.localidade !== 'string' ||
      !data.localidade.trim() ||
      typeof data.uf !== 'string' ||
      !/^[A-Za-z]{2}$/.test(data.uf)
    ) {
      throw new Error('CEP não possui localidade verificável.')
    }

    return {
      cep,
      city: data.localidade.trim(),
      state: data.uf.toUpperCase(),
    }
  } finally {
    clearTimeout(timeout)
  }
}
