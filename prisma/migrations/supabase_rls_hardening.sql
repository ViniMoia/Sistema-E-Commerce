-- ==============================================================================
-- Script de Blindagem Supabase / PostgREST Data API & Row Level Security (RLS)
-- Finding DB-004: Impedir acesso direto anônimo ou de usuários não autorizados
-- às tabelas do schema public através da Data API (REST / GraphQL) do Supabase.
-- ==============================================================================

-- 1. Habilitar RLS em todas as tabelas da aplicação
DO $$
BEGIN
    -- Tabelas Centrais
    EXECUTE 'ALTER TABLE IF EXISTS "Loja" ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'ALTER TABLE IF EXISTS "User" ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'ALTER TABLE IF EXISTS "Address" ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'ALTER TABLE IF EXISTS "Session" ENABLE ROW LEVEL SECURITY;';
    
    -- Catálogo e Carrinho
    EXECUTE 'ALTER TABLE IF EXISTS "Product" ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'ALTER TABLE IF EXISTS "ProductVariants" ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'ALTER TABLE IF EXISTS "Cart" ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'ALTER TABLE IF EXISTS "CartItem" ENABLE ROW LEVEL SECURITY;';
    
    -- Pedidos e Auditoria
    EXECUTE 'ALTER TABLE IF EXISTS "Order" ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'ALTER TABLE IF EXISTS "OrderItem" ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'ALTER TABLE IF EXISTS "OrderStatusHistory" ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'ALTER TABLE IF EXISTS "FreightRule" ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'ALTER TABLE IF EXISTS "AuditLog" ENABLE ROW LEVEL SECURITY;';
END $$;

-- 2. Revogar todos os privilégios padrão dos papéis da API Supabase (anon e authenticated)
-- Como a aplicação opera 100% via Prisma com conexão direta/pooler no backend Next.js,
-- a API HTTP direta (PostgREST) NÃO deve conceder leitura/escrita pública a dados privados.
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
        REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
        REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon;
    END IF;

    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
        REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated;
        REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM authenticated;
    END IF;
END $$;

-- 3. Garantir permissões completas apenas para as roles de serviço da aplicação (postgres e service_role)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'postgres') THEN
        GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;
        GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres;
        GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres;
    END IF;

    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
        GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
        GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
        GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role;
    END IF;
END $$;

-- 4. Definir políticas explícitas de "Default Deny" para acesso via Data API REST
-- Usuários anon e authenticated são bloqueados por padrão em todas as tabelas sensíveis.
DO $$
DECLARE
    tbl text;
    tables text[] := ARRAY[
        'User', 'Session', 'Address', 'Order', 'OrderItem', 
        'OrderStatusHistory', 'AuditLog', 'Cart', 'CartItem', 'FreightRule'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = tbl) THEN
            EXECUTE format('DROP POLICY IF EXISTS "deny_direct_api_access" ON %I;', tbl);
            EXECUTE format('CREATE POLICY "deny_direct_api_access" ON %I FOR ALL USING (false);', tbl);
        END IF;
    END LOOP;
END $$;

-- 5. Consulta de verificação do status de RLS (Para auditoria)
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
