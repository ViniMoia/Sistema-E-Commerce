import { z } from 'zod';

export const destinationSchema = z.object({
  cep: z.string().regex(/^\d{8}$/), state: z.string().regex(/^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/),
  city: z.string().min(2).max(150), municipalityCode: z.string().regex(/^\d{7}$/),
}).strict();
export type FreightDestination = z.infer<typeof destinationSchema>;
export const normalizeMunicipality = (city: string) => city.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLowerCase();

/** Remote I/O belongs before any transaction/commerce lock. Never trust the
 * browser's ViaCEP result as geographic authorization. No fake fallback CEP. */
export async function resolveFreightDestination(cep: string): Promise<FreightDestination> {
  const clean = cep.replace(/\D/g, '');
  if (!/^\d{8}$/.test(clean)) throw new Error('CEP_INVALID');
  try {
    const response = await fetch(`https://viacep.com.br/ws/${clean}/json/`, {
      cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(3500),
    });
    if (!response.ok) throw new Error('Destination unavailable');
    const body = z.object({ cep: z.string(), uf: z.string(), localidade: z.string(), ibge: z.string(), erro: z.unknown().optional() }).parse(await response.json());
    if (body.erro || body.cep.replace(/\D/g, '') !== clean) throw new Error('Destination mismatch');
    return destinationSchema.parse({ cep: clean, state: body.uf, city: body.localidade, municipalityCode: body.ibge });
  } catch { throw new Error('FREIGHT_DESTINATION_UNAVAILABLE'); }
}
