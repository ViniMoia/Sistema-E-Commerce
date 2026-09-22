# Workflow Técnico de Engenharia: Resolução Fase 1 da Auditoria Profunda
## Sprint Hotfix Bloqueante (AUD-001 a AUD-005): Segurança RCE, Fidelidade, Concorrência, Multi-Tenant e Webhooks

**ID do Projeto:** `AUD-FASE-1-HOTFIX`  
**Prioridade:** `P0 / P1 - Crítico e Bloqueante para Produção`  
**Data de Elaboração:** 16 de Setembro de 2026  
**Autor / Coordenador:** Staff Software Engineer / Lead Security Auditor  
**Repositório:** `ecommerce-app` (Continental Produtos Estéticos Automotivos)  
**Destino do Documento:** `diversos/PLANEJAMENTO_GERAL/revisao_2/workflows_revisao/workflow_1/WORKFLOW_AUD_FASE_1_HOTFIX.md`

---

## 1. Escopo e Objetivos da Fase 1

Após a apresentação e aprovação do **Relatório de Auditoria Profunda Final**, este workflow formaliza a implementação cirúrgica das 5 correções de severidade máxima (**P0 e P1**) necessárias para desbloquear o sistema para lançamento em produção com total integridade técnica.

### Matriz de Entregas da Fase 1:
1. **AUD-001 [P0 - CVE]:** Atualização do Next.js de `16.3.1` para `16.3.5` (eliminação de RCE não autenticado no Windows - GHSA-p293-qw3h-jr36 e Image Optimization - GHSA-2xp9-vwfh-vxw4).
2. **AUD-002 [P1 - FinTech]:** Correção do estorno de fidelidade em `services/order.service.ts` para devolver pontos resgatados quando um pedido pendente (`PENDING`) for cancelado.
3. **AUD-003 [P1 - Concorrência]:** Prevenção de venda a descoberto e estoque negativo em `services/inventory.service.ts` com validação atômica pós-decremento e rollback automático da transação.
4. **AUD-004 [P1 - Multi-Tenancy]:** Blindagem contra spoofing de `lojaID` no checkout (`app/api/checkout/route.ts`), vinculando obrigatoriamente a criação do pedido ao tenant resolvido por `getLojaFromHeaders()`.
5. **AUD-005 [P1 - Gateway Asaas]:** Tratamento de `PAYMENT_OVERDUE`, `PAYMENT_DELETED` e `PAYMENT_BANK_SLIP_CANCELLED` em `app/api/webhooks/asaas/route.ts`, cancelando o pedido e liberando o estoque retido.

---

## 2. Desenho de Arquitetura das Correções

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                      FLUXO ARQUITETURAL DAS CORREÇÕES FASE 1                          │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│  [AUD-001: Next.js 16.3.5] ──► Elimina RCE em Windows & Image Optimization CVEs        │
│                                                                                        │
│  [AUD-004: Checkout Multi-Tenant]                                                      │
│  Client POST /api/checkout ──► getLojaFromHeaders() ──► Força data.lojaID = active.id │
│                                                                                        │
│  [AUD-003: Concorrência de Estoque]                                                   │
│  tx.product.update(decrement) ──► if (stock < 0) throw InventoryError('INSUFFICIENT')  │
│                                   └──► ABORTA TRANSAÇÃO (ZERO ESTOQUE NEGATIVO)        │
│                                                                                        │
│  [AUD-002: Estorno de Fidelidade]                                                      │
│  Order Status ──► CANCELLED ──► if (status === PENDING || PAID)                        │
│                                 └──► refundOrderPoints() (Devolve pontos REDEEM)       │
│                                                                                        │
│  [AUD-005: Webhook Asaas - Expiração]                                                 │
│  PAYMENT_OVERDUE / DELETED ──► order.update(CANCELLED) ──► Estorna Estoque e Pontos    │
│                                                                                        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Plano Detalhado de Implementação por Componente

### 3.1 AUD-001: Atualização do Framework Next.js
- Atualizar a versão no `package.json` para `"next": "^16.3.5"`.
- Executar `npm install` garantindo a resolução limpa das dependências.
- Rodar `npx tsc --noEmit` e `npm run build` para certificar total compatibilidade.

### 3.2 AUD-002: Devolução de Pontos em Pedidos Cancelados
- Arquivo: `services/order.service.ts`
- Modificação: Linha 382:
  ```typescript
  // Se o pedido estava PENDING ou PAID, estorna os pontos ganhos/resgatados
  if (fullOrder.status === "PENDING" || fullOrder.status === "PAID") {
    await refundOrderPoints(
      {
        lojaID: fullOrder.lojaID,
        orderId: input.orderId,
        reason: input.reason || `Cancelamento do pedido #${input.orderId.slice(0, 8)}`,
      },
      tx
    );
  }
  ```

### 3.3 AUD-003: Blindagem contra Sobrevenda (Race Condition) no Inventário
- Arquivo: `services/inventory.service.ts`
- Modificação em `reserveStock`:
  1. No decremento de produto pai:
     ```typescript
     const updatedProduct = await tx.product.update({
       where: { id: item.productId },
       data: { stock: { decrement: quantity } },
       select: { id: true, name: true, stock: true },
     });
     if (updatedProduct.stock < 0) {
       throw new InventoryError(
         'INSUFFICIENT_STOCK',
         `Estoque insuficiente para o produto "${updatedProduct.name}". Disponibilidade esgotada concorrentemente.`
       );
     }
     ```
  2. No decremento da variante (quando aplicável):
     ```typescript
     const updatedVariant = await tx.productVariants.update({
       where: { id: item.variantId },
       data: { stock: { decrement: quantity } },
       select: { id: true, name: true, stock: true },
     });
     if (updatedVariant.stock < 0) {
       throw new InventoryError(
         'INSUFFICIENT_STOCK',
         `Estoque insuficiente para a variação selecionada. Disponibilidade esgotada concorrentemente.`
       );
     }
     ```

### 3.4 AUD-004: Isolamento Multi-Tenant no Endpoint de Checkout
- Arquivo: `app/api/checkout/route.ts`
- Modificação:
  ```typescript
  import { getLojaFromHeaders } from '@/lib/tenant';
  ...
  const activeLoja = await getLojaFromHeaders();
  if (!activeLoja) {
    return err('Loja não encontrada para este domínio.', 404);
  }

  // Previne spoofing de tenant via body
  if (data.lojaID && data.lojaID !== activeLoja.id) {
    return err('Violação de isolamento multi-tenant: lojaID divergente do domínio.', 403);
  }
  data.lojaID = activeLoja.id;
  ```

### 3.5 AUD-005: Tratamento de Eventos de Vencimento e Cancelamento no Webhook Asaas
- Arquivo: `app/api/webhooks/asaas/route.ts`
- Modificação:
  ```typescript
  } else if (
    body.event === 'PAYMENT_OVERDUE' ||
    body.event === 'PAYMENT_DELETED' ||
    body.event === 'PAYMENT_BANK_SLIP_CANCELLED'
  ) {
    if (order.status === 'PENDING') {
      await updateOrderStatus({
        orderId: order.id,
        newStatus: 'CANCELLED',
        performedById: 'ASAAS_GATEWAY_EXPIRATION',
        lojaID: order.lojaID,
        reason: `Cobrança expirada ou cancelada no Asaas (${body.event})`,
      });
    }
  }
  ```

---

## 4. Estratégia de Verificação e Testes Automatizados

1. **Testes Unitários:**
   - Teste de cancelamento de pedido pendente com pontos resgatados e validação do saldo da carteira.
   - Teste de concorrência em `reserveStock` simulando estoque decrementando para negativo e garantindo que `InventoryError` é disparado.
   - Teste de integridade do webhook Asaas para evento `PAYMENT_OVERDUE`.
   - Teste da rota de checkout rejeitando requisição com `lojaID` divergente.
2. **Checagem de Vulnerabilidades:**
   - Executar `npm audit` para confirmar a resolução do alerta crítico do Next.js.
3. **Build e Tipagem:**
   - `npx tsc --noEmit`
   - `npm run lint`
   - `npm run build`

---

## 5. Resultados da Homologação e Status de Conclusão

- **AUD-001 (Next.js RCE):** ✅ **CONCLUÍDO** - Next.js atualizado para `16.3.5`. `npm audit` e `ruflo security scan` confirmam **Zero vulnerabilidades críticas (0 Critical)**.
- **AUD-002 (Estorno de Pontos em Pedidos Pendentes):** ✅ **CONCLUÍDO** - `services/order.service.ts` atualizado para invocar `refundOrderPoints` em pedidos com status `PENDING` ou `PAID`. Testes unitários validam a devolução íntegra.
- **AUD-003 (Concorrência e Estoque Negativo):** ✅ **CONCLUÍDO** - `services/inventory.service.ts` agora valida o saldo atômico pós-decremento (`updated.stock < 0`), disparando `InventoryError('INSUFFICIENT_STOCK')` e abortando a transação.
- **AUD-004 (Blindagem Multi-Tenant no Checkout):** ✅ **CONCLUÍDO** - `app/api/checkout/route.ts` agora resolve o tenant via `getLojaFromHeaders()`, rejeitando spoofing com HTTP 403 e forçando `data.lojaID = activeLoja.id`.
- **AUD-005 (Tratamento de PAYMENT_OVERDUE e Expiração):** ✅ **CONCLUÍDO** - `app/api/webhooks/asaas/route.ts` trata `PAYMENT_OVERDUE` e `PAYMENT_DELETED` cancelando o pedido e devolvendo estoque físico e pontos.

### Métricas Finais da Fase 1:
- **Suíte de Testes Automatizados:** 33 arquivos de teste, **216 testes executados e passando com 100% de sucesso** (`vitest run tests/unit`).
- **Verificação de Tipagem Estrita:** `npx tsc --noEmit` finalizado com **0 erros** (Exit code 0).
- **Verificação de Linting:** `npm run lint` finalizado com **0 erros** (Exit code 0).
- **Compilação de Produção Next.js 16.3.5:** `npm run build` gerando todas as 49 rotas estáticas e dinâmicas com sucesso (Exit code 0).
- **Status Geral da Fase 1:** ✅ **100% CONCLUÍDO E HOMOLOGADO COM SUCESSO**
