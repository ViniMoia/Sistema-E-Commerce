-- ==============================================================================
-- Migration: 20260524000000_add_order_idempotency_key
-- Finding DB-002: Suporte a chave de idempotência para criação de pedidos
-- ==============================================================================

-- 1. Adicionar coluna idempotencyKey na tabela Order
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;

-- 2. Criar índice único para idempotencyKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE tablename = 'Order' AND indexname = 'Order_idempotencyKey_key'
    ) THEN
        CREATE UNIQUE INDEX "Order_idempotencyKey_key" ON "Order"("idempotencyKey");
    END IF;
END $$;
