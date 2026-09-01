-- ==============================================================================
-- Migration: 20260521000000_reconcile_schema_drift
-- Finding DB-001: Reconciliação do drift entre schema.prisma e histórico de migrations
-- ==============================================================================

-- 1. Campos de customização visual e domínio na tabela Loja
ALTER TABLE "Loja" ADD COLUMN IF NOT EXISTS "primaryColor" TEXT DEFAULT '#DDAF02';
ALTER TABLE "Loja" ADD COLUMN IF NOT EXISTS "secondaryColor" TEXT DEFAULT '#050505';
ALTER TABLE "Loja" ADD COLUMN IF NOT EXISTS "customDomain" TEXT;

-- 2. Índice único para customDomain
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE tablename = 'Loja' AND indexname = 'Loja_customDomain_key'
    ) THEN
        CREATE UNIQUE INDEX "Loja_customDomain_key" ON "Loja"("customDomain");
    END IF;
END $$;

-- 3. Galeria de imagens adicionais na tabela Product
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "galleryUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];
