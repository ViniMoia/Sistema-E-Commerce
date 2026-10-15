import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import prisma, { verifyTestDatabase } from '@/lib/prisma';
import { inspectLoyaltyAccounting, lockLoyaltyWallet, creditLockedLoyalty, loyaltyEffect } from '@/lib/commerce/loyalty-ledger';
import { transitionOrder } from '@/lib/commerce/order-command';
import { proposeCheckout } from '@/services/checkout-intent.service';
import { createOrder, type CreateOrderParams } from '@/services/checkout.service';
import type { PaymentGateway } from '@/types/payment-gateway.types';

// Only the restored-clone orchestrator enables this suite, after backup and treatment.
describe.skipIf(process.env.TEST_RESTORED_OPENING !== 'true')('restored clone opening', () => {
  const lojaID = '536bfa58-0531-49e8-9209-3a046281e516';
  let adminId: string;
  let oldOrders: Awaited<ReturnType<typeof prisma.order.findMany>>;
  let oldTransactions: Awaited<ReturnType<typeof prisma.loyaltyTransaction.findMany>>;
  beforeAll(async () => {
    await verifyTestDatabase();
    expect(await prisma.loja.count()).toBe(1);
    oldOrders = await prisma.order.findMany({include:{items:true},orderBy:{id:'asc'}});
    oldTransactions = await prisma.loyaltyTransaction.findMany({orderBy:{id:'asc'}});
    expect(oldOrders).toHaveLength(24); expect(oldTransactions).toHaveLength(4);
    adminId = (await prisma.user.findFirstOrThrow({where:{lojaID,role:'ADMIN',status:'ACTIVE'}})).id;
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('EXTERNAL_NETWORK_FORBIDDEN'); }));
  });
  afterAll(async () => {
    try {
      if(oldOrders) expect(await prisma.order.findMany({where:{id:{in:oldOrders.map(o=>o.id)}},include:{items:true},orderBy:{id:'asc'}})).toEqual(oldOrders);
      if(oldTransactions) expect(await prisma.loyaltyTransaction.findMany({where:{id:{in:oldTransactions.map(t=>t.id)}},orderBy:{id:'asc'}})).toEqual(oldTransactions);
    } finally { vi.unstubAllGlobals(); await prisma.$disconnect(); }
    // The orchestrator discards the whole clone. Never delete shared historical data.
  });
  it('zero opening conserves both ledgers; old account can earn only fresh points', async () => {
    const wallets = await prisma.loyaltyWallet.findMany({where:{lojaID}});
    expect(wallets).toHaveLength(2);
    for(const wallet of wallets) expect(await prisma.$transaction(tx=>inspectLoyaltyAccounting(tx,{lojaID:wallet.lojaID,userID:wallet.userID}))).toMatchObject({accountingReady:true,balance:0,debt:0,lotRemaining:0,ledgerAvailable:0,conserved:true});
    const w = wallets[0];
    const rollback = new Error('EXPECTED_PROBE_ROLLBACK');
    await expect(prisma.$transaction(async tx=>{
      const state = (await lockLoyaltyWallet(tx,w))!;
      const effect = {...loyaltyEffect('opening-probe',w,'credit-100',{points:100}),type:'ADMIN_ADJUSTMENT' as const,points:100,description:'Clone rollback probe'};
      await creditLockedLoyalty(state,effect,[{points:100,expiry:null}]);
      await creditLockedLoyalty(state,effect,[{points:100,expiry:null}]);
      expect(await inspectLoyaltyAccounting(tx,{lojaID:w.lojaID,userID:w.userID})).toMatchObject({balance:100,lotRemaining:100,ledgerAvailable:100,conserved:true});
      throw rollback;
    })).rejects.toBe(rollback);
    expect(await prisma.loyaltyWallet.findUniqueOrThrow({where:{id:w.id}})).toEqual(w);
  });
  it('all ten pending legacy orders refuse approval and cancellation', async () => {
    const pending = oldOrders.filter(o=>o.status==='PENDING'); expect(pending).toHaveLength(10);
    for(const order of pending) for(const newStatus of ['PAID','CANCELLED'] as const) {
      expect(await transitionOrder({lojaID,performedById:adminId,orderId:order.id,newStatus,expectedVersion:order.version,commandId:randomUUID()}))
        .toMatchObject({success:false,error:'LEGACY_ORDER_RECONCILIATION_REQUIRED'});
    }
    expect(await prisma.inventoryReservation.count()).toBe(0);
    expect(await prisma.financialFact.count()).toBe(0);
    expect(await prisma.commerceOutbox.count()).toBe(0);
  });
  it('new purchase consumes once and earns only its own points under controlled manual payment', async () => {
    // Explicit fixture settings on the clone, not production configuration.
    await prisma.loja.update({where:{id:lojaID},data:{enablePickup:true,enableManualPix:true,
      pixKey:'clone@example.invalid',whatsappNumber:'11999999999',loyaltyEnabled:true,loyaltyEarnRate:0.5}});
    const user = await prisma.user.create({data:{lojaID,name:'Clone opening customer',email:randomUUID()+'@example.invalid',password:'',status:'ACTIVE'}});
    const product = await prisma.product.findFirstOrThrow({where:{lojaID,retiredAt:null,stock:{gte:2},price:{gte:2},productVariants:{some:{retiredAt:null,stock:{gte:2}}}},include:{productVariants:true},orderBy:{id:'asc'}});
    const variant = product.productVariants.find(v=>!v.retiredAt && v.stock>=2)!;
    const cart = await prisma.cart.create({data:{lojaID,userID:user.id,items:{create:{productID:product.id,variantID:variant.id,quantity:1,price:product.price,productName:product.name,imageUrl:'',size:variant.size,color:variant.color}}}});
    const forbidden = vi.fn(async()=>{throw new Error('REMOTE_PAYMENT_FORBIDDEN');});
    const gateway = {capabilities:vi.fn(async()=>({configured:false,methods:[],maximumInstallments:1})),createPixCharge:forbidden,createBoletoCharge:forbidden,createCreditCardCharge:forbidden,getPaymentStatus:forbidden} as PaymentGateway;
    const draft: CreateOrderParams = {lojaID,customer:{userId:user.id,name:user.name,email:user.email,phone:'11999999999',cpfCnpj:'52998224725'},
      items:[{productId:product.id,variantId:variant.id,quantity:1}],deliveryType:'PICKUP',paymentMethod:'WHATSAPP_PIX',paymentGateway:gateway,cartID:cart.id,cartVersion:cart.version};
    const quote = await proposeCheckout(draft);
    const accepted = {...draft,checkoutIntentID:quote.checkoutIntentID,acceptedRevision:quote.revision,acceptedContentHash:quote.contentHash};
    const purchase = await createOrder(accepted);
    expect((await createOrder(accepted)).order.id).toBe(purchase.order.id);
    expect(await prisma.order.count()).toBe(25);
    expect(await prisma.inventoryReservation.count({where:{orderId:purchase.order.id}})).toBe(1);
    expect((await prisma.product.findUniqueOrThrow({where:{id:product.id}})).stock).toBe(product.stock-1);
    expect((await prisma.productVariants.findUniqueOrThrow({where:{id:variant.id}})).stock).toBe(variant.stock-1);
    const approval = {lojaID,performedById:adminId,orderId:purchase.order.id,newStatus:'PAID' as const,expectedVersion:0,commandId:randomUUID()};
    expect(await transitionOrder(approval)).toMatchObject({success:true});
    expect(await transitionOrder(approval)).toMatchObject({success:true});
    const expected = Math.floor(Number(product.price)*0.5);
    expect(await prisma.$transaction(tx=>inspectLoyaltyAccounting(tx,{lojaID,userID:user.id}))).toMatchObject({balance:expected,lotRemaining:expected,ledgerAvailable:expected,conserved:true});
    expect(await prisma.loyaltyTransaction.count({where:{userID:user.id,type:'EARN'}})).toBe(1);
    expect(forbidden).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
  });
});
