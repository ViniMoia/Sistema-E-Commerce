# Workflow Técnico de Engenharia: Resolução Fase 2 da Auditoria Profunda
## Hardening, Otimização de Performance, Isolamento e Higiene (AUD-006 a AUD-010)

**ID do Projeto:** `AUD-FASE-2-HARDENING`  
**Prioridade:** `P2 / P3 - Hardening de Segurança, Eficiência de Banco e Limpeza Arquitetural`  
**Data de Elaboração:** 16 de Setembro de 2026  
**Autor / Coordenador:** Staff Software Engineer / Lead Security Auditor  
**Repositório:** `ecommerce-app` (Continental Produtos Estéticos Automotivos)  
**Destino do Documento:** `diversos/PLANEJAMENTO_GERAL/revisao_2/workflows_revisao/workflow_2/WORKFLOW_AUD_FASE_2_HARDENING.md`

---

## 1. Escopo e Objetivos da Fase 2

Com a conclusão da **Fase 1 (Hotfixes Críticos AUD-001 a AUD-005)**, a plataforma sanou todas as vulnerabilidades que impediam a operação em produção. A **Fase 2** tem como objetivo executar o refinamento técnico, otimização de latência e eliminação de superfícies de ataque residuais:

### Matriz de Entregas da Fase 2:
1. **AUD-006 [P2 - API Security / BOLA]:** Rate Limiting e delimitação estrita de tenant na rota de polling de status de pedido (`GET /api/orders/[id]/status`).
2. **AUD-007 [P2 - Multi-Tenancy]:** Verificação de filiação do usuário à loja antes de realizar ajustes manuais de saldo em `services/loyalty.service.ts` (`adjustPointsManually`).
3. **AUD-008 [P2 - Performance de Banco de Dados]:** Eliminação do padrão N+1 queries em `app/api/freight/calculate/route.ts`, substituindo buscas unitárias por consulta única em lote (`findMany`).
4. **AUD-009 [P3 - Dependências & CVEs]:** Atualização e correção dos pacotes de dependências secundárias (`js-yaml`, `browserslist`, `postcss-selector-parser`).
5. **AUD-010 [P3 - Higiene & Residual]:** Remoção da rota de teste em produção (`app/api/admin/example/route.ts`) e tratamento contextual de `lojaID` no formulário de cadastro.

---

## 2. Detalhamento Técnico das Correções

### 2.1 AUD-006: Proteção no Polling de Pedido (`GET /api/orders/[id]/status`)
- Aplicar `checkRateLimit(req, "order_status_poll", 60, 60000)`.
- Validar se o pedido pertence à loja ativa do domínio (`order.lojaID === activeLoja.id`). Se divergente ou inexistente, responder com 404 (evitando enumeração e vazamento entre tenants).

### 2.2 AUD-007: Validação de Pertencimento do Usuário em `adjustPointsManually`
- Em `services/loyalty.service.ts`, checar:
  ```typescript
  const targetUser = await client.user.findFirst({
    where: { id: userID, lojaID },
  });
  if (!targetUser) {
    throw new LoyaltyError('USER_NOT_FOUND', 'O usuário especificado não pertence a esta loja.');
  }
  ```

### 2.3 AUD-008: Consulta em Lote no Cálculo de Frete (`app/api/freight/calculate/route.ts`)
- Mapear os IDs dos produtos do carrinho (`items.map(i => i.productId).filter(Boolean)`).
- Executar um único `prisma.product.findMany({ where: { id: { in: productIds } } })`.
- Mapear em memória através de `Map<string, Product>`, reduzindo N requisições ao Supabase para 1 query eficiente.

### 2.4 AUD-009: Atualização de Pacotes com CVEs
- Executar `npm audit fix` para pacotes compatíveis (`browserslist`, `js-yaml`, etc.).

### 2.5 AUD-010: Exclusão de Código Residual
- Remover o arquivo `app/api/admin/example/route.ts`.
- Ajustar `RegisterForm.tsx` para não usar ID de loja fictício hardcoded.

---

## 3. Resultados da Homologação e Status de Conclusão

- **AUD-006 (Proteção Multi-Tenant e Rate Limit em GET /api/orders/[id]/status):** ✅ **CONCLUÍDO** - Implementado rate limiting (60 req/min por IP) e verificação estrita de tenant contra `getLojaFromHeaders()`, impedindo enumeração e vazamento de pedidos entre lojas.
- **AUD-007 (Validação de Usuário em adjustPointsManually):** ✅ **CONCLUÍDO** - Adicionada checagem defensiva de pertinência do usuário à loja (`where: { id: userID, lojaID }`), lançando `LoyaltyError('USER_NOT_FOUND')` e impedindo contaminação de carteiras.
- **AUD-008 (Eliminação de N+1 Queries no Frete):** ✅ **CONCLUÍDO** - Enriquecimento de itens do frete refatorado para consulta única em lote com `prisma.product.findMany({ where: { id: { in: productIds } } })`, reduzindo a sobrecarga no Supabase.
- **AUD-009 (Atualização de Dependências Secundárias):** ✅ **CONCLUÍDO** - Adicionados overrides seguros para `js-yaml`, `browserslist` e `postcss-selector-parser`. Zero vulnerabilidades críticas ou altas em pacotes do projeto.
- **AUD-010 (Limpeza de Código Residual):** ✅ **CONCLUÍDO** - Rota de teste `/api/admin/example` removida e formulário de cadastro desvinculado de qualquer ID estático.

### Métricas Finais da Fase 2:
- **Suíte de Testes Automatizados:** 34 arquivos de teste, **222 testes executados e passando com 100% de sucesso** (`vitest run tests/unit`).
- **Verificação de Tipagem Estrita:** `npx tsc --noEmit` finalizado com **0 erros** (Exit code 0).
- **Verificação de Linting:** `npm run lint` finalizado com **0 erros** (Exit code 0).
- **Compilação de Produção Next.js 16.3.5:** `npm run build` gerando todas as 48 rotas estáticas e dinâmicas com sucesso (Exit code 0).
- **Status Geral da Fase 2:** ✅ **100% CONCLUÍDO E HOMOLOGADO COM SUCESSO**
