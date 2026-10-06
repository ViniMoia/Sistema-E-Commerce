import { describe, expect, it } from 'vitest';
import { newGuestOrderAccess, validGuestOrderAccess, orderCustomer, snapshotDeliveryAddress } from '@/lib/commerce/order-buyer';

describe('Credencial e snapshot de comprador convidado', () => {
  it('gera segredos independentes, persiste hash distinto do token e recusa credencial de outra compra', () => {
    const one = newGuestOrderAccess(); const two = newGuestOrderAccess();
    expect(one.token).not.toBe(two.token); expect(one.hash).not.toBe(one.token);
    const buyer = { recoveryTokenHash: one.hash, recoveryExpiresAt: one.expiresAt };
    expect(validGuestOrderAccess(one.token, buyer)).toBe(true);
    expect(validGuestOrderAccess(two.token, buyer)).toBe(false);
    for (const invalid of [null, '', one.token + 'x', '../' + one.token]) expect(validGuestOrderAccess(invalid, buyer)).toBe(false);
    expect(validGuestOrderAccess(one.token, { ...buyer, recoveryExpiresAt: new Date(Date.now() - 1) })).toBe(false);
  });
  it('usa snapshot do comprador e não infere vínculo de conta pelo email', () => {
    expect(orderCustomer({ buyer: { name: 'Guest', email: 'same@example.invalid', phone: '123', authenticatedUserID: null } })).toMatchObject({ id: null, name: 'Guest' });
    expect(orderCustomer({ buyer: { name: 'Snapshot', email: 'same@example.invalid', authenticatedUserID: 'user-1' }, user: { id: 'user-1', name: 'Changed profile' } })).toMatchObject({ id: 'user-1', name: 'Snapshot' });
    expect(orderCustomer({ user: { id: 'legacy', name: 'Historical' } })).toMatchObject({ id: 'legacy', name: 'Historical' });
  });
  it('snapshot de endereço malformado não é tratado como endereço válido', () => {
    expect(snapshotDeliveryAddress({ deliveryAddress: { city: 'Missing fields' } })).toBeNull();
    expect(snapshotDeliveryAddress({ deliveryAddress: { cep: '01001000', state: 'SP', city: 'São Paulo', neighborhood: 'Centro', street: 'Rua', number: '1' } })).toMatchObject({ district: 'Centro', complement: null });
  });
});
