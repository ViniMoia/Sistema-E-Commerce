-- ==============================================================================
-- Migration: 20260831000000_add_loyalty_engine
-- Scope: Sistema de Fidelidade & Bonificação por Pontos (Loyalty Engine)
-- ==============================================================================

-- 1. Criação do Enum LoyaltyTxType
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LoyaltyTxType') THEN
        CREATE TYPE "LoyaltyTxType" AS ENUM (
            'EARN',
            'REDEEM',
            'REFUND_EARN',
            'REFUND_REDEEM',
            'EXPIRATION',
            'ADMIN_ADJUSTMENT'
        );
    END IF;
END $$;

-- 2. Alteração da Tabela Loja (Configurações de Fidelidade)
ALTER TABLE "Loja" 
    ADD COLUMN IF NOT EXISTS "loyaltyEnabled" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "loyaltyEarnRate" DECIMAL(5,2) NOT NULL DEFAULT 0.5,
    ADD COLUMN IF NOT EXISTS "loyaltyPointValue" DECIMAL(5,4) NOT NULL DEFAULT 0.05,
    ADD COLUMN IF NOT EXISTS "loyaltyMinPointsRedeem" INTEGER NOT NULL DEFAULT 100,
    ADD COLUMN IF NOT EXISTS "loyaltyMaxDiscountPct" DECIMAL(5,2) NOT NULL DEFAULT 50.0,
    ADD COLUMN IF NOT EXISTS "loyaltyPointsExpiryDays" INTEGER DEFAULT 365;

-- 3. Alteração da Tabela Order (Auditoria e Desconto de Pontos)
ALTER TABLE "Order"
    ADD COLUMN IF NOT EXISTS "pointsEarned" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "pointsRedeemed" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "pointsDiscountValue" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- 4. Criação da Tabela LoyaltyWallet (Carteira de Saldo O(1) com Versionamento)
CREATE TABLE IF NOT EXISTS "LoyaltyWallet" (
    "id" TEXT NOT NULL,
    "lojaID" TEXT NOT NULL,
    "userID" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "pending" INTEGER NOT NULL DEFAULT 0,
    "lifetimeEarn" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyWallet_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LoyaltyWallet_lojaID_userID_key" ON "LoyaltyWallet"("lojaID", "userID");
CREATE INDEX IF NOT EXISTS "LoyaltyWallet_lojaID_idx" ON "LoyaltyWallet"("lojaID");
CREATE INDEX IF NOT EXISTS "LoyaltyWallet_userID_idx" ON "LoyaltyWallet"("userID");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LoyaltyWallet_lojaID_fkey') THEN
        ALTER TABLE "LoyaltyWallet" ADD CONSTRAINT "LoyaltyWallet_lojaID_fkey" FOREIGN KEY ("lojaID") REFERENCES "Loja"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LoyaltyWallet_userID_fkey') THEN
        ALTER TABLE "LoyaltyWallet" ADD CONSTRAINT "LoyaltyWallet_userID_fkey" FOREIGN KEY ("userID") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- 5. Criação da Tabela LoyaltyTransaction (Ledger Imutável de Auditoria Contábil)
CREATE TABLE IF NOT EXISTS "LoyaltyTransaction" (
    "id" TEXT NOT NULL,
    "lojaID" TEXT NOT NULL,
    "userID" TEXT NOT NULL,
    "orderId" TEXT,
    "type" "LoyaltyTxType" NOT NULL,
    "points" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "monetaryValue" DECIMAL(10,2),
    "description" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyTransaction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LoyaltyTransaction_lojaID_userID_idx" ON "LoyaltyTransaction"("lojaID", "userID");
CREATE INDEX IF NOT EXISTS "LoyaltyTransaction_orderId_idx" ON "LoyaltyTransaction"("orderId");
CREATE INDEX IF NOT EXISTS "LoyaltyTransaction_createdAt_idx" ON "LoyaltyTransaction"("createdAt");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LoyaltyTransaction_lojaID_fkey') THEN
        ALTER TABLE "LoyaltyTransaction" ADD CONSTRAINT "LoyaltyTransaction_lojaID_fkey" FOREIGN KEY ("lojaID") REFERENCES "Loja"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LoyaltyTransaction_userID_fkey') THEN
        ALTER TABLE "LoyaltyTransaction" ADD CONSTRAINT "LoyaltyTransaction_userID_fkey" FOREIGN KEY ("userID") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LoyaltyTransaction_orderId_fkey') THEN
        ALTER TABLE "LoyaltyTransaction" ADD CONSTRAINT "LoyaltyTransaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
