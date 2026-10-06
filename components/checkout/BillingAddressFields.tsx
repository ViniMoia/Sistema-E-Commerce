'use client';
import type { CheckoutAddress } from '@/lib/commerce/checkout-address';
export const emptyCheckoutAddress = (): CheckoutAddress => ({ state: '', city: '', neighborhood: '', street: '', number: '', complement: '', cep: '' });
export function BillingAddressFields({ value, onChange }: { value: CheckoutAddress; onChange: (address: CheckoutAddress) => void }) {
  const fields = [['cep','CEP'],['state','Estado (UF)'],['city','Cidade'],['neighborhood','Bairro'],['street','Rua'],['number','Número'],['complement','Complemento (opcional)']] as const;
  return <fieldset className="grid grid-cols-2 gap-3"><legend className="mb-3 font-mono text-sm">Endereço de cobrança</legend>
    {fields.map(([key,label]) => <label key={key} className="text-xs text-catalog-muted">{label}<input
      name={'billingAddress.' + key} aria-label={'Cobrança: ' + label} value={value[key] ?? ''}
      onChange={e => onChange({ ...value, [key]: e.target.value })} autoComplete="off"
      className="mt-1 w-full rounded-xl border border-catalog-gold/30 bg-[#0B132B]/70 p-3 text-white" /></label>)}
  </fieldset>;
}
