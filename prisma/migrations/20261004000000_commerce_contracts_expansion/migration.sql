BEGIN;
SET LOCAL lock_timeout = '10s';
-- CreateEnum
CREATE TYPE "CommerceActorType" AS ENUM ('USER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "CheckoutIntentStatus" AS ENUM ('OPEN', 'ACCEPTED', 'PROCESSING', 'COMPLETED', 'REQUIRES_REVIEW', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentAttemptStatus" AS ENUM ('NOT_STARTED', 'SUBMITTING', 'UNKNOWN', 'PENDING', 'APPROVED', 'DECLINED', 'CANCEL_PENDING', 'CANCELLED', 'REFUND_PENDING', 'REFUNDED');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('RESERVED', 'COMMITTED', 'RELEASED', 'RETURNED');

-- CreateEnum
CREATE TYPE "DurableWorkStatus" AS ENUM ('READY', 'LEASED', 'COMPLETED', 'DEAD_LETTER');

-- CreateEnum
CREATE TYPE "FinancialFactType" AS ENUM ('AUTHORIZED', 'SETTLED', 'REFUNDED', 'CANCELLED');

-- DropForeignKey
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_actorId_fkey";

-- DropForeignKey
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_targetId_fkey";

-- DropForeignKey
ALTER TABLE "OrderStatusHistory" DROP CONSTRAINT "OrderStatusHistory_performedById_fkey";

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "actorType" "CommerceActorType" NOT NULL DEFAULT 'USER',
ADD COLUMN     "effectKey" TEXT,
ADD COLUMN     "systemActor" TEXT,
ALTER COLUMN "targetId" DROP NOT NULL,
ALTER COLUMN "actorId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Cart" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Loja" ADD COLUMN     "configurationVersion" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "LoyaltyTransaction" ADD COLUMN     "effectKey" TEXT;

-- AlterTable
ALTER TABLE "LoyaltyWallet" ADD COLUMN     "debt" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "buyerID" TEXT,
ADD COLUMN     "checkoutIntentID" TEXT,
ADD COLUMN     "financialSnapshot" JSONB,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "OrderStatusHistory" ADD COLUMN     "actorType" "CommerceActorType" NOT NULL DEFAULT 'USER',
ADD COLUMN     "commandKey" TEXT,
ADD COLUMN     "previousStatus" "OrderStatus",
ADD COLUMN     "systemActor" TEXT,
ALTER COLUMN "performedById" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "inventoryVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "retiredAt" TIMESTAMP(3),
ADD COLUMN     "unavailableStock" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ProductVariants" ADD COLUMN     "inventoryVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "retiredAt" TIMESTAMP(3),
ADD COLUMN     "unavailableStock" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "OrderBuyer" (
    "id" TEXT NOT NULL,
    "lojaID" TEXT NOT NULL,
    "authenticatedUserID" TEXT,
    "name" VARCHAR(150) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(20),
    "cpfCnpj" VARCHAR(20),
    "deliveryAddress" JSONB,
    "billingAddress" JSONB,
    "recoveryTokenHash" TEXT,
    "recoveryExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderBuyer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckoutIntent" (
    "id" TEXT NOT NULL,
    "lojaID" TEXT NOT NULL,
    "ownerKey" VARCHAR(128) NOT NULL,
    "userID" TEXT,
    "buyerID" TEXT,
    "key" VARCHAR(128) NOT NULL,
    "cartID" TEXT,
    "cartVersion" INTEGER,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "contentHash" VARCHAR(64) NOT NULL,
    "snapshot" JSONB NOT NULL,
    "status" "CheckoutIntentStatus" NOT NULL DEFAULT 'OPEN',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CheckoutIntent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAttempt" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "provider" VARCHAR(32) NOT NULL,
    "method" VARCHAR(32) NOT NULL,
    "status" "PaymentAttemptStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "externalReference" VARCHAR(128) NOT NULL,
    "providerContractId" TEXT,
    "financialTotal" DECIMAL(10,2) NOT NULL,
    "installments" INTEGER NOT NULL DEFAULT 1,
    "planSnapshot" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "submittedAt" TIMESTAMP(3),
    "externalExpiresAt" TIMESTAMP(3),
    "reconcileAfter" TIMESTAMP(3),
    "failureCode" VARCHAR(96),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentCharge" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "provider" VARCHAR(32) NOT NULL,
    "providerPaymentId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "providerStatus" VARCHAR(64) NOT NULL,
    "dueAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "instructions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentCharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialFact" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "attemptId" TEXT,
    "chargeId" TEXT,
    "provider" VARCHAR(32) NOT NULL,
    "factKey" VARCHAR(160) NOT NULL,
    "type" "FinancialFactType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialFact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryReservation" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'RESERVED',
    "version" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyLot" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "sourceTransactionId" TEXT NOT NULL,
    "sourceKey" VARCHAR(128) NOT NULL,
    "sourceAllocationId" TEXT,
    "credited" INTEGER NOT NULL,
    "remaining" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyLot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyAllocation" (
    "id" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentInbox" (
    "id" TEXT NOT NULL,
    "provider" VARCHAR(32) NOT NULL,
    "eventId" VARCHAR(160) NOT NULL,
    "eventType" VARCHAR(64) NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "DurableWorkStatus" NOT NULL DEFAULT 'READY',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "leaseOwner" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastErrorCode" VARCHAR(96),
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "PaymentInbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommerceOutbox" (
    "id" TEXT NOT NULL,
    "effectKey" VARCHAR(160) NOT NULL,
    "commandType" VARCHAR(64) NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "DurableWorkStatus" NOT NULL DEFAULT 'READY',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "leaseOwner" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastErrorCode" VARCHAR(96),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "CommerceOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FreightQuote" (
    "id" TEXT NOT NULL,
    "lojaID" TEXT NOT NULL,
    "ownerKey" VARCHAR(128) NOT NULL,
    "cartContentHash" VARCHAR(64) NOT NULL,
    "destinationHash" VARCHAR(64) NOT NULL,
    "configurationVersion" INTEGER NOT NULL,
    "deliveryType" "DeliveryType" NOT NULL,
    "provider" VARCHAR(32) NOT NULL,
    "serviceName" VARCHAR(120) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "estimatedDays" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FreightQuote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrderBuyer_recoveryTokenHash_key" ON "OrderBuyer"("recoveryTokenHash");

-- CreateIndex
CREATE INDEX "OrderBuyer_lojaID_authenticatedUserID_idx" ON "OrderBuyer"("lojaID", "authenticatedUserID");

-- CreateIndex
CREATE UNIQUE INDEX "OrderBuyer_id_lojaID_key" ON "OrderBuyer"("id", "lojaID");

-- CreateIndex
CREATE INDEX "CheckoutIntent_status_expiresAt_idx" ON "CheckoutIntent"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutIntent_lojaID_ownerKey_key_key" ON "CheckoutIntent"("lojaID", "ownerKey", "key");

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutIntent_id_lojaID_key" ON "CheckoutIntent"("id", "lojaID");

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutIntent_cartID_cartVersion_key" ON "CheckoutIntent"("cartID", "cartVersion");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_externalReference_key" ON "PaymentAttempt"("externalReference");

-- CreateIndex
CREATE INDEX "PaymentAttempt_status_reconcileAfter_idx" ON "PaymentAttempt"("status", "reconcileAfter");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_orderId_number_key" ON "PaymentAttempt"("orderId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentCharge_provider_providerPaymentId_key" ON "PaymentCharge"("provider", "providerPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentCharge_attemptId_ordinal_key" ON "PaymentCharge"("attemptId", "ordinal");

-- CreateIndex
CREATE INDEX "FinancialFact_orderId_type_occurredAt_idx" ON "FinancialFact"("orderId", "type", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialFact_provider_factKey_key" ON "FinancialFact"("provider", "factKey");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryReservation_orderItemId_key" ON "InventoryReservation"("orderItemId");

-- CreateIndex
CREATE INDEX "InventoryReservation_status_expiresAt_idx" ON "InventoryReservation"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "InventoryReservation_productId_variantId_idx" ON "InventoryReservation"("productId", "variantId");

-- CreateIndex
CREATE INDEX "LoyaltyLot_walletId_expiresAt_createdAt_idx" ON "LoyaltyLot"("walletId", "expiresAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyLot_sourceTransactionId_sourceKey_key" ON "LoyaltyLot"("sourceTransactionId", "sourceKey");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyAllocation_transactionId_lotId_key" ON "LoyaltyAllocation"("transactionId", "lotId");

-- CreateIndex
CREATE INDEX "PaymentInbox_status_nextAttemptAt_leaseExpiresAt_idx" ON "PaymentInbox"("status", "nextAttemptAt", "leaseExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentInbox_provider_eventId_key" ON "PaymentInbox"("provider", "eventId");

-- CreateIndex
CREATE UNIQUE INDEX "CommerceOutbox_effectKey_key" ON "CommerceOutbox"("effectKey");

-- CreateIndex
CREATE INDEX "CommerceOutbox_status_nextAttemptAt_leaseExpiresAt_idx" ON "CommerceOutbox"("status", "nextAttemptAt", "leaseExpiresAt");

-- CreateIndex
CREATE INDEX "CommerceOutbox_aggregateId_commandType_idx" ON "CommerceOutbox"("aggregateId", "commandType");

-- CreateIndex
CREATE INDEX "FreightQuote_lojaID_expiresAt_idx" ON "FreightQuote"("lojaID", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuditLog_effectKey_key" ON "AuditLog"("effectKey");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyTransaction_effectKey_key" ON "LoyaltyTransaction"("effectKey");

-- CreateIndex
CREATE UNIQUE INDEX "Order_checkoutIntentID_lojaID_key" ON "Order"("checkoutIntentID", "lojaID");

-- CreateIndex
CREATE UNIQUE INDEX "OrderStatusHistory_commandKey_key" ON "OrderStatusHistory"("commandKey");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariants_id_ProductID_key" ON "ProductVariants"("id", "ProductID");

-- CreateIndex
CREATE UNIQUE INDEX "User_id_lojaID_key" ON "User"("id", "lojaID");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_buyerID_lojaID_fkey" FOREIGN KEY ("buyerID", "lojaID") REFERENCES "OrderBuyer"("id", "lojaID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_checkoutIntentID_lojaID_fkey" FOREIGN KEY ("checkoutIntentID", "lojaID") REFERENCES "CheckoutIntent"("id", "lojaID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderBuyer" ADD CONSTRAINT "OrderBuyer_lojaID_fkey" FOREIGN KEY ("lojaID") REFERENCES "Loja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderBuyer" ADD CONSTRAINT "OrderBuyer_authenticatedUserID_lojaID_fkey" FOREIGN KEY ("authenticatedUserID", "lojaID") REFERENCES "User"("id", "lojaID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutIntent" ADD CONSTRAINT "CheckoutIntent_lojaID_fkey" FOREIGN KEY ("lojaID") REFERENCES "Loja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutIntent" ADD CONSTRAINT "CheckoutIntent_userID_lojaID_fkey" FOREIGN KEY ("userID", "lojaID") REFERENCES "User"("id", "lojaID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutIntent" ADD CONSTRAINT "CheckoutIntent_buyerID_lojaID_fkey" FOREIGN KEY ("buyerID", "lojaID") REFERENCES "OrderBuyer"("id", "lojaID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutIntent" ADD CONSTRAINT "CheckoutIntent_cartID_fkey" FOREIGN KEY ("cartID") REFERENCES "Cart"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentCharge" ADD CONSTRAINT "PaymentCharge_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "PaymentAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialFact" ADD CONSTRAINT "FinancialFact_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialFact" ADD CONSTRAINT "FinancialFact_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "PaymentAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialFact" ADD CONSTRAINT "FinancialFact_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "PaymentCharge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_variantId_productId_fkey" FOREIGN KEY ("variantId", "productId") REFERENCES "ProductVariants"("id", "ProductID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyLot" ADD CONSTRAINT "LoyaltyLot_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "LoyaltyWallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyLot" ADD CONSTRAINT "LoyaltyLot_sourceTransactionId_fkey" FOREIGN KEY ("sourceTransactionId") REFERENCES "LoyaltyTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyLot" ADD CONSTRAINT "LoyaltyLot_sourceAllocationId_fkey" FOREIGN KEY ("sourceAllocationId") REFERENCES "LoyaltyAllocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyAllocation" ADD CONSTRAINT "LoyaltyAllocation_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "LoyaltyLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyAllocation" ADD CONSTRAINT "LoyaltyAllocation_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "LoyaltyTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreightQuote" ADD CONSTRAINT "FreightQuote_lojaID_fkey" FOREIGN KEY ("lojaID") REFERENCES "Loja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Expanded structures are empty on legacy upgrade; validate their invariants
-- now. Do not add a non-negative legacy wallet balance CHECK before WF-09/18.
ALTER TABLE "AuditLog" ADD CONSTRAINT "chk_audit_actor_shape" CHECK (
  ("actorType"='USER' AND "actorId" IS NOT NULL AND "systemActor" IS NULL) OR
  ("actorType"='SYSTEM' AND "actorId" IS NULL AND length(btrim("systemActor"))>0 AND "systemActor" IS NOT NULL));
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "chk_history_actor_shape" CHECK (
  ("actorType"='USER' AND "performedById" IS NOT NULL AND "systemActor" IS NULL) OR
  ("actorType"='SYSTEM' AND "performedById" IS NULL AND length(btrim("systemActor"))>0 AND "systemActor" IS NOT NULL));
ALTER TABLE "CheckoutIntent" ADD CONSTRAINT "chk_intent_cart_revision" CHECK (
  ("cartID" IS NULL AND "cartVersion" IS NULL) OR ("cartID" IS NOT NULL AND "cartVersion" IS NOT NULL AND "cartVersion">=0));
ALTER TABLE "CheckoutIntent" ADD CONSTRAINT "chk_intent_revision_hash" CHECK (revision>=0 AND "contentHash" ~ '^[0-9a-f]{64}$');
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "chk_attempt_values" CHECK (number>0 AND "financialTotal">=0 AND installments BETWEEN 1 AND 12 AND version>=0);
ALTER TABLE "PaymentCharge" ADD CONSTRAINT "chk_charge_values" CHECK (ordinal>0 AND amount>=0);
ALTER TABLE "FinancialFact" ADD CONSTRAINT "chk_financial_fact_amount" CHECK (amount>=0 AND length(btrim("factKey"))>0);
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "chk_reservation_values" CHECK (quantity>0 AND version>=0);
ALTER TABLE "LoyaltyLot" ADD CONSTRAINT "chk_lot_remaining" CHECK (credited>0 AND remaining>=0 AND remaining<=credited);
ALTER TABLE "LoyaltyAllocation" ADD CONSTRAINT "chk_allocation_positive" CHECK (points>0);
ALTER TABLE "LoyaltyWallet" ADD CONSTRAINT "chk_wallet_debt" CHECK (debt>=0);
ALTER TABLE "FreightQuote" ADD CONSTRAINT "chk_quote_values" CHECK (amount>=0 AND "estimatedDays">=0 AND "configurationVersion">=0);
ALTER TABLE "PaymentInbox" ADD CONSTRAINT "chk_inbox_lease" CHECK (attempts>=0 AND (
  (status='LEASED' AND "leaseOwner" IS NOT NULL AND "leaseExpiresAt" IS NOT NULL) OR
  (status<>'LEASED' AND "leaseOwner" IS NULL AND "leaseExpiresAt" IS NULL)));
ALTER TABLE "CommerceOutbox" ADD CONSTRAINT "chk_outbox_lease" CHECK (attempts>=0 AND (
  (status='LEASED' AND "leaseOwner" IS NOT NULL AND "leaseExpiresAt" IS NOT NULL) OR
  (status<>'LEASED' AND "leaseOwner" IS NULL AND "leaseExpiresAt" IS NULL)));
COMMIT;
