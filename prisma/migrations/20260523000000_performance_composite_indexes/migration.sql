-- ==============================================================================
-- Migration: 20260523000000_performance_composite_indexes
-- Finding SCL-002: Criação de índices compostos para otimização de queries multi-tenant
-- ==============================================================================

-- 1. Índices compostos na tabela User
CREATE INDEX IF NOT EXISTS "User_lojaID_status_idx" ON "User"("lojaID", "status");
CREATE INDEX IF NOT EXISTS "User_lojaID_role_idx" ON "User"("lojaID", "role");

-- 2. Índices compostos na tabela Address
CREATE INDEX IF NOT EXISTS "Address_userID_createdAt_idx" ON "Address"("userID", "createdAt");

-- 3. Índices compostos na tabela Product
CREATE INDEX IF NOT EXISTS "Product_lojaID_createdAt_idx" ON "Product"("lojaID", "createdAt");
CREATE INDEX IF NOT EXISTS "Product_lojaID_stock_idx" ON "Product"("lojaID", "stock");

-- 4. Índices compostos na tabela Cart
CREATE INDEX IF NOT EXISTS "Cart_userID_status_idx" ON "Cart"("userID", "status");

-- 5. Índices compostos na tabela Order (críticos para listOrders, métricas e isolamento)
CREATE INDEX IF NOT EXISTS "Order_lojaID_createdAt_idx" ON "Order"("lojaID", "createdAt");
CREATE INDEX IF NOT EXISTS "Order_lojaID_status_idx" ON "Order"("lojaID", "status");
CREATE INDEX IF NOT EXISTS "Order_userID_createdAt_idx" ON "Order"("userID", "createdAt");
CREATE INDEX IF NOT EXISTS "Order_lojaID_userID_idx" ON "Order"("lojaID", "userID");

-- 6. Índices na tabela AuditLog
CREATE INDEX IF NOT EXISTS "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
