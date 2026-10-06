import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import prisma, { verifyTestDatabase } from '@/lib/prisma';
import { createFulfillmentFixture } from '@/tests/setup/fulfillment-fixture';
import { cleanupFixtureStores } from '@/tests/setup/fixture-scope';
import { LEGACY_AUDIT_SQL, classifyLegacyAudit } from '../../scripts/lib/legacy-commerce-audit.mjs';
import { transitionOrder } from '@/lib/commerce/order-command';
import { processExpiredOrders } from '@/services/order-timeout.service';
import { getCustomerMetrics } from '@/services/customer.service';
import { get, patch } from '@/tests/helpers/request';
beforeAll(verifyTestDatabase);
afterAll(async()=>{ await cleanupFixtureStores(); await prisma.$disconnect(); });
async function audit() {
  return prisma.$transaction(async tx=>{
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    const rows = await tx.$queryRawUnsafe<Array<{ report: unknown }>>(LEGACY_AUDIT_SQL);
    return classifyLegacyAudit(rows[0].report,'wf18-integration-salt');
  }, { isolationLevel:'RepeatableRead' });
}
async function legacy() {
  const f = await createFulfillmentFixture();
  const p = await prisma.product.create({ data:{ lojaID:f.lojaID,userID:f.admin.id,name:'Legacy',description:'',price:100,stock:4,imageUrl:'',
    productVariants:{ create:{ size:'Único',color:'Padrão',stock:4 } } },include:{ productVariants:true } });
  const o = await prisma.order.create({ data:{ lojaID:f.lojaID,userID:f.customer.id,status:'PENDING',deliveryType:'PICKUP',subtotal:100,total:100,
    items:{ create:{ productId:p.id,name:'Historical name',size:null,color:null,quantity:1,price:100,productVariantsId:null } } }, include:{ items:true } });
  return { f,p,o };
}
describe('WF-18: legacy inventory and compatibility gates',()=>{
  it('inventory classifies unknown history without adding variant/payment/reservation/keys or activating points',async()=>{
    const { f,p,o }=await legacy();
    const wallet=await prisma.loyaltyWallet.create({ data:{ lojaID:f.lojaID,userID:f.customer.id,balance:20,accountingReady:false } });
    const before=await prisma.order.findUniqueOrThrow({ where:{ id:o.id },include:{ items:true } });
    const report=await audit();
    expect(report.integrityPassed).toBe(true); expect(report.requiresReconciliation).toBe(true);
    expect(report.productionReady).toBe(false); expect(report.automaticRepairs).toEqual([]);
    const tenant=report.tenants.find(t=>t.counts.orders===1&&t.counts.missing_variant_links===1&&t.counts.unreconciled_wallets===1);
    expect(tenant).toBeTruthy();
    expect(await prisma.order.findUniqueOrThrow({ where:{ id:o.id },include:{ items:true } })).toEqual(before);
    expect(await prisma.inventoryReservation.count({ where:{ orderId:o.id } })).toBe(0);
    expect(await prisma.financialFact.count({ where:{ orderId:o.id } })).toBe(0);
    expect((await prisma.loyaltyWallet.findUniqueOrThrow({ where:{ id:wallet.id } })).accountingReady).toBe(false);
    expect(JSON.stringify(report)).not.toContain(p.id); expect(JSON.stringify(report)).not.toContain(f.customer.email);
  });
  it('active normalized duplicates audit existing cart/order links but keep their identities and separate stocks',async()=>{
    const { f,p,o }=await legacy(); const original=p.productVariants[0];
    const duplicate=await prisma.productVariants.create({ data:{ ProductID:p.id,size:' DEFAULT ',color:' padrão ',stock:7 } });
    const cart=await prisma.cart.create({ data:{ lojaID:f.lojaID,userID:f.customer.id,items:{ create:{
      productID:p.id,variantID:duplicate.id,quantity:1,price:100,productName:'Legacy',imageUrl:'',size:'default',color:'Padrão' } } } });
    await prisma.orderItem.update({ where:{ id:o.items[0].id },data:{ productVariantsId:original.id } });
    const before=await prisma.productVariants.findMany({ where:{ ProductID:p.id },orderBy:{ id:'asc' } });
    const report=await audit();
    expect(report.duplicateGroups).toHaveLength(1);
    expect(report.duplicateGroups[0]).toMatchObject({ cartLinks:1,orderLinks:1,reservationLinks:0,resolution:'REVIEW_INVENTORY_AND_LINKS_NO_MERGE' });
    expect(await prisma.productVariants.findMany({ where:{ ProductID:p.id },orderBy:{ id:'asc' } })).toEqual(before);
    expect((await prisma.cartItem.findFirstOrThrow({ where:{ cartID:cart.id } })).variantID).toBe(duplicate.id);
  });
  it('legacy cancellation and payment approval refuse without any partial stock/status/effect',async()=>{
    const { f,p,o }=await legacy();
    for(const newStatus of ['CANCELLED','PAID'] as const){
      expect(await transitionOrder({ ...f.context,orderId:o.id,newStatus,commandId:randomUUID() })).toMatchObject({
        success:false,code:'CONFLICT',error:'LEGACY_ORDER_RECONCILIATION_REQUIRED' });
    }
    expect((await prisma.order.findUniqueOrThrow({ where:{ id:o.id } })).status).toBe('PENDING');
    expect((await prisma.product.findUniqueOrThrow({ where:{ id:p.id } })).stock).toBe(4);
    expect((await prisma.productVariants.findUniqueOrThrow({ where:{ id:p.productVariants[0].id } })).stock).toBe(4);
    expect(await prisma.orderStatusHistory.count({ where:{ orderId:o.id } })).toBe(0);
    expect(await prisma.auditLog.count({ where:{ entityId:o.id } })).toBe(0);
    expect(await prisma.commerceOutbox.count({ where:{ aggregateId:o.id } })).toBe(0);
  });
  it('HTTP admin hides unsafe actions and rejects their direct route; tenant owner can still read the old order',async()=>{
    const { f,o }=await legacy(); const headers={ Host:f.host,Cookie:'session_id='+f.session.id };
    const read=await get('/api/admin/orders/'+o.id,{ headers }); expect(read.status).toBe(200);
    expect(JSON.stringify(read.body)).not.toContain('"PAID"'); expect(JSON.stringify(read.body)).not.toContain('"CANCELLED"');
    const res=await patch('/api/admin/orders/'+o.id+'/status',{ newStatus:'CANCELLED',expectedVersion:0,commandId:randomUUID() },{ headers });
    expect(res.status).toBe(409);
    const foreign=await createFulfillmentFixture();
    expect((await get('/api/admin/orders/'+o.id,{ headers:{ Host:foreign.host,Cookie:'session_id='+foreign.session.id } })).status).toBe(404);
  });
  it('legacy shipped owner receipt remains possible without approving payment or restoring historical stock',async()=>{
    const { f,p,o }=await legacy(); await prisma.order.update({ where:{ id:o.id },data:{ status:'SHIPPED',deliveryType:'DELIVERY' } });
    expect(await transitionOrder({ lojaID:f.lojaID,performedById:f.customer.id,orderId:o.id,newStatus:'DELIVERED',confirmReceipt:true })).toMatchObject({ success:true });
    expect((await prisma.product.findUniqueOrThrow({ where:{ id:p.id } })).stock).toBe(4);
    expect(await prisma.financialFact.count({ where:{ orderId:o.id } })).toBe(0);
    expect(await getCustomerMetrics({ lojaID:f.lojaID,customerId:f.customer.id })).toMatchObject({ totalSpent:0,coverage:'PARTIAL' });
  });
  it('timeout ignores old missing deadlines and modern orders keep the new paid/fulfillment contract',async()=>{
    const { f,o }=await legacy(); await prisma.order.update({ where:{ id:o.id },data:{ createdAt:new Date('2020-01-01T00:00:00Z') } });
    expect(await processExpiredOrders({ lojaID:f.lojaID })).toMatchObject({ success:true,processedCount:0,cancelledCount:0 });
    const paid=await f.order('PICKUP');
    expect(await transitionOrder({ ...f.context,orderId:paid.id,newStatus:'DELIVERED' })).toMatchObject({ success:true });
    expect(await getCustomerMetrics({ lojaID:f.lojaID,customerId:f.customer.id })).toMatchObject({ totalSpent:100,totalOrders:2,coverage:'PARTIAL' });
  });
});
