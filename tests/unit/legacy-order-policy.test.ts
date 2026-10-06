import { describe, expect, it } from 'vitest';
import { allowedOrderActions, fulfillmentPaymentError } from '@/lib/commerce/order-fulfillment';
const legacy = { status:'PENDING' as const,deliveryType:'PICKUP',shippingProvider:null,checkoutIntentID:null,financialPlan:null,paymentMethod:null };
describe('WF-18: unresolved history is not permission to mutate financial/inventory state',()=>{
  it.each(['PAID','SHIPPED','CANCELLED'] as const)('blocks %s without proof of the accepted source',next=>{
    expect(fulfillmentPaymentError(legacy,next,'USER',null)).toBe('LEGACY_ORDER_RECONCILIATION_REQUIRED');
    expect(fulfillmentPaymentError(legacy,next,'SYSTEM',null)).toBe('LEGACY_ORDER_RECONCILIATION_REQUIRED');
  });
  it('a partial financial snapshot or approved attempt cannot manufacture a historical inventory debit',()=>{
    expect(fulfillmentPaymentError({ ...legacy,financialPlan:{},paymentMethod:'PIX' },'CANCELLED','USER',
      { provider:'ASAAS',status:'REFUNDED',failureCode:null })).toBe('LEGACY_ORDER_RECONCILIATION_REQUIRED');
  });
  it('unresolved pending history exposes no approval or cancellation in the administrative actions',()=>{
    expect(allowedOrderActions(legacy,null,'ADMIN').statuses).toEqual([]);
  });
  it('existing physical delivery can be acknowledged without inventing a payment/refund',()=>{
    const shipped={ ...legacy,status:'SHIPPED' as const,deliveryType:'DELIVERY' };
    expect(allowedOrderActions(shipped,null,'CUSTOMER').statuses).toEqual(['DELIVERED']);
    expect(fulfillmentPaymentError(shipped,'DELIVERED','USER',null)).toBeNull();
  });
});
