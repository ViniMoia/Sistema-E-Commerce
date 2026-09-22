# Workflow Técnico de Engenharia: Resolução REV-001 (P0)
## Unificação da Autoridade de Estoque e Eliminação do Duplo Decremento / Travamento de Pedidos

**ID do Problema:** `REV-001`  
**Prioridade:** `P0 - Crítico (Bloqueador de Produção)`  
**Data de Elaboração:** 16 de Setembro de 2026  
**Autor / Coordenador:** Staff Software Engineer / Tech Lead  
**Repositório:** `ecommerce-app` (Continental Produtos Estéticos Automotivos)  
**Destino do Documento:** `diversos/PLANEJAMENTO_GERAL/revisao_1/workflows_revisao/workflow_1/WORKFLOW_REV_001_ESTOQUE_E_PEDIDOS.md`

---

## 1. Visão Geral do Problema e Causa Raiz

### 1.1 Diagnóstico Técnico Factual
No estado atual da aplicação, coexistem duas abordagens concorrentes de manipulação de estoque que entram em colisão destrutiva:

1. **No Checkout (`services/checkout.service.ts` - Linhas 213–234)**:
   - Quando o cliente conclui o checkout, o pedido é criado com status inicial `PENDING`.
   - O serviço executa uma **reserva atômica de estoque imediata**, debitando o estoque tanto do produto pai (`product.stock`) quanto da variante selecionada (`productVariants.stock`):
     ```typescript
     // Decremento atômico de estoque no ato do pedido PENDING
     await tx.product.update({
       where: { id: item.productId },
       data: { stock: { decrement: item.quantity } }
     });
     if (item.variantId) {
       await tx.productVariants.update({
         where: { id: item.variantId },
         data: { stock: { decrement: item.quantity } }
       });
     }
     ```

2. **Na Confirmação de Pagamento (`services/order.service.ts` - Linhas 280–309)**:
   - Quando o webhook do Asaas notifica a confirmação do pagamento (`PAYMENT_RECEIVED` ou `PAYMENT_CONFIRMED`) ou o administrador aprova manualmente o pedido para `PAID`, a função `updateOrderStatus` executa uma **segunda rotina de verificação e decremento**:
     ```typescript
     // Verificação redundante de estoque
     const available = stockMap.get(item.productVariantsId) ?? 0;
     if (available < item.quantity) {
       return {
         success: false,
         error: `Estoque insuficiente para a variante ${item.productVariantsId}.`,
         code: "INVALID_TRANSITION",
       };
     }
     // SEGUNDO decremento no mesmo pedido!
     await tx.productVariants.update({
       where: { id: item.productVariantsId, stock: { gte: item.quantity } },
       data: { stock: { decrement: item.quantity } },
     });
     ```

3. **No Cancelamento de Pedidos (`services/order.service.ts` - Linhas 350–358)**:
   - Se um pedido com status `PENDING` for cancelado (desistência do cliente, timeout de PIX ou cancelamento administrativo), a rotina possui a seguinte trava:
     ```typescript
     // O estoque SÓ é devolvido se o pedido já estiver PAID!
     if (fullOrder.status === "PAID") {
       for (const item of itemsWithVariant) {
         await tx.productVariants.update({
           where: { id: item.productVariantsId },
           data: { stock: { increment: item.quantity } },
         });
       }
     }
     ```
   - **Resultado do Cancelamento:** Pedidos `PENDING` cancelados nunca devolvem o estoque. As unidades reservadas evaporam do sistema. Além disso, quando o pedido `PAID` é cancelado, apenas a variante é incrementada; o `product.stock` pai permanece decrementado para sempre.

### 1.2 Impacto Crítico em Produção
* **Cenário de Baixo Estoque (Estoque = 1 unidade):**
  - Cliente compra a última unidade.
  - Checkout decrementa o estoque para `0`. Pedido gravado como `PENDING`.
  - Cliente transfere o valor via PIX. Webhook do Asaas é disparado.
  - `updateOrderStatus` tenta mudar para `PAID`, mas `stockMap.get(...)` retorna `0`.
  - O sistema avalia `0 < 1` como verdadeiro e **rejeita o pagamento com erro `"Estoque insuficiente"`**.
  - **Efeito:** O dinheiro do cliente foi recebido, mas o pedido fica eternamente travado em `PENDING`, jamais emitindo notificação de envio ou liberando o despacho.
* **Cenário de Estoque Múltiplo:**
  - Em produtos com estoque abundante, cada venda de $N$ unidades causa a baixa contábil de $2N$ unidades, gerando furos catastróficos no controle de inventário da empresa.

---

## 2. Decisão de Arquitetura de Software (Clean Architecture & SOLID)

Adotaremos o padrão canônico da indústria de e-commerce (Shopify / Amazon / Mercado Livre): **Reserva Atômica no Checkout + Confirmação Idempotente no Pagamento + Estorno Integral no Cancelamento**.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        PIPELINE DE INVENTÁRIO                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. CHECKOUT (createOrder)                                              │
│     └── Status: PENDING                                                 │
│     └── Ação: RESERVA ATÔMICA (InventoryService.reserveStock)           │
│         • Decrementa product.stock                                      │
│         • Decrementa productVariants.stock (se houver)                  │
│                                                                         │
│  2. PAGAMENTO CONFIRMADO (updateOrderStatus -> PAID)                   │
│     └── Status: PAID                                                    │
│     └── Ação: CONFIRMAÇÃO IDEMPOTENTE                                   │
│         • O estoque JÁ FOI reservado no checkout                        │
│         • NÃO debita novamente!                                         │
│         • Apenas credita pontos de fidelidade e transiciona estado      │
│                                                                         │
│  3. CANCELAMENTO (updateOrderStatus -> CANCELLED)                       │
│     └── De: PENDING ou PAID -> CANCELLED                                │
│     └── Ação: ESTORNO INTEGRAL (InventoryService.restoreStock)          │
│         • Incrementa product.stock                                      │
│         • Incrementa productVariants.stock                              │
│         • Estorna / devolve pontos de fidelidade                        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Princípios SOLID Aplicados:
1. **Single Responsibility Principle (SRP):**
   - Criação de um serviço isolado de domínio: `services/inventory.service.ts`.
   - Nem `order.service.ts` nem `checkout.service.ts` devem conter lógicas manuais de queries Prisma para manipular estoque. Ambos devem delegar diretamente para o `InventoryService`.
2. **Open/Closed Principle (OCP):**
   - A lógica de inventário pode receber novas estratégias de reserva (ex: fila de reserva com lock distribuído Redis ou TTL) sem necessidade de refatorar a máquina de estados de pedidos.
3. **Liskov Substitution & Interface Segregation (LSP / ISP):**
   - Definição estrita do contrato `IInventoryItem`:
     ```typescript
     export interface InventoryItemInput {
       productId: string;
       variantId?: string | null;
       quantity: number;
     }
     ```
4. **Dependency Inversion Principle (DIP):**
   - As operações de inventário recebem opcionalmente uma transação Prisma (`Prisma.TransactionClient`), garantindo integridade ACID transacional acoplada à transação principal do pedido.

---

## 3. Estrutura Operacional da Equipe de Agentes e Uso de MCPs

Para garantir máxima velocidade, precisão cirúrgica e auditoria mútua, a resolução será executada por **4 Agentes Especializados**, orquestrados pelo Tech Lead.

```
                  ┌─────────────────────────────────────┐
                  │       AGENTE 0: TECH LEAD           │
                  │   Orquestrador & Auditor Chefe      │
                  └──────────────────┬──────────────────┘
                                     │
         ┌───────────────────────────┼───────────────────────────┐
         ▼                           ▼                           ▼
┌───────────────────┐       ┌───────────────────┐       ┌───────────────────┐
│     AGENTE 1      │       │     AGENTE 2      │       │     AGENTE 3      │
│   Domain Eng      │       │    Service Eng    │       │    QA & Security  │
│ (InventoryService)│       │ (Checkout & Order)│       │(Tests & Regression│
└───────────────────┘       └───────────────────┘       └───────────────────┘
```

### 3.1 Definição dos Papéis e Alocação de MCPs

| Agente | Papel e Responsabilidade | Objetivos Técnicos | MCPs e Ferramentas Empregadas |
| :--- | :--- | :--- | :--- |
| **Agente 0: Tech Lead** | Orquestração, revisão de código e aprovação de gates de qualidade. | Garantir conformidade com Clean Architecture, evitar breaking changes e aprovar o merge formal de cada fase. | • `analyze_diff`<br>• `analyze_diff-risk`<br>• `ruflo / progress_check`<br>• `policy_evaluate` |
| **Agente 1: Domain Engineer** | Especialista em Regras de Negócio e Persistência do Inventário. | Criar `services/inventory.service.ts` com métodos `verifyStock`, `reserveStock` e `restoreStock`, operando com queries atômicas e suporte a `tx`. | • `write_to_file`<br>• `replace_file_content`<br>• `view_file`<br>• `agentdb_pattern-store` |
| **Agente 2: Service Engineer** | Especialista em Fluxos de Checkout e Transição de Estados de Pedidos. | 1. Refatorar `checkout.service.ts` para usar `InventoryService.reserveStock`.<br>2. Refatorar `order.service.ts` (`updateOrderStatus`) para remover o segundo débito em `PAID` e implementar `InventoryService.restoreStock` em `CANCELLED` (tanto de `PENDING` quanto de `PAID`). | • `replace_file_content`<br>• `view_file`<br>• `grep_search`<br>• `hooks_pre-edit / post-edit` |
| **Agente 3: QA & Security Auditor** | Engenheiro de Qualidade e Testes de Regressão. | Criar suíte de testes unitários para testar cenários de borda (estoque unitário = 1, compras simultâneas, cancelamentos pendentes/pagos). Validar `tsc`, `lint`, `vitest` e `next build`. | • `run_command` (`vitest`, `tsc`, `lint`)<br>• `write_to_file`<br>• `performance_benchmark` |

---

## 4. Fases do Workflow de Execução (Passo a Passo)

### FASE 1: Construção do Domínio de Inventário (`InventoryService`)
- **Responsável:** Agente 1 (Domain Engineer).
- **Ação:**
  - Criar o arquivo `services/inventory.service.ts`.
  - Implementar método `verifyAndReserveStock(items: InventoryItemInput[], tx: Prisma.TransactionClient)`:
    - Valida se o produto pertence à loja e se há saldo suficiente.
    - Executa o decremento atômico condicional (`stock: { gte: quantity }`).
    - Lança `InventoryError('INSUFFICIENT_STOCK')` em caso de falha.
  - Implementar método `restoreStock(items: InventoryItemInput[], tx: Prisma.TransactionClient)`:
    - Incrementa atômica e simetricamente tanto `product.stock` quanto `productVariants.stock`.
- **Auditoria do Tech Lead (Gate 1):**
  - Checagem via `analyze_diff` garantindo que o serviço não contenha efeitos colaterais fora da transação `tx`.

---

### FASE 2: Refatoração do Pipeline de Checkout
- **Responsável:** Agente 2 (Service Engineer).
- **Ação:**
  - Em `services/checkout.service.ts`:
    - Substituir o bloco manual de decremento (linhas 213–234) pela chamada centralizada `await InventoryService.reserveStock(itemsToReserve, tx)`.
    - Manter a integridade de dados e auditoria do carrinho.
- **Auditoria do Tech Lead (Gate 2):**
  - Garantir que o payload de checkout continue autoritativo no servidor e protegido contra manipulação de preços/estoque no cliente.

---

### FASE 3: Refatoração da Máquina de Estados de Pedidos (`updateOrderStatus`)
- **Responsável:** Agente 2 (Service Engineer).
- **Ação:**
  - Em `services/order.service.ts`:
    - **No bloco `if (input.newStatus === "PAID")`**:
      - **REMOVER** a verificação de estoque e o segundo decremento de `productVariants.update({ data: { stock: decrement } })`.
      - Manter a transição de status para `PAID`, a emissão do log de auditoria e o crédito de pontos de fidelidade (`creditEarnedPoints`).
    - **No bloco `if (input.newStatus === "CANCELLED")`**:
      - Alterar a condição de estorno: em vez de estornar apenas se `fullOrder.status === "PAID"`, estornar se o status anterior for `PENDING` OU `PAID`!
      - Executar `await InventoryService.restoreStock(itemsToRestore, tx)`, garantindo devolução de estoque tanto na variante quanto no produto pai.
      - Executar estorno de pontos de fidelidade (`refundOrderPoints`).
- **Auditoria do Tech Lead (Gate 3):**
  - Revisar se pedidos com status `SHIPPED` ou `DELIVERED` continuam protegidos contra cancelamentos indevidos (de acordo com `isValidTransition`).

---

### FASE 4: Criação de Testes de Borda e Validação de Regressão
- **Responsável:** Agente 3 (QA & Security Auditor).
- **Ação:**
  - Criar o arquivo de teste dedicado: `tests/unit/inventory-lifecycle.test.ts`.
  - Cenários de Teste Obrigatórios:
    1. **Cenário Crítico 1 (Estoque Unitário):** Produto com 1 unidade em estoque. Checkout reserva 1 unidade (saldo vira 0). Webhook do Asaas confirma pagamento (`PAID`). O pedido transiciona para `PAID` com **100% de sucesso sem erro de estoque insuficiente**.
    2. **Cenário Crítico 2 (Cancelamento Pendente):** Pedido `PENDING` é cancelado por timeout. O estoque do produto pai e da variante é **integralmente restaurado**.
    3. **Cenário Crítico 3 (Cancelamento Pago):** Pedido `PAID` é cancelado pelo admin. O estoque é **integralmente restaurado** e os pontos de fidelidade são estornados.
    4. **Cenário de Concorrência:** Duas tentativas de reserva simultâneas para um item com 1 unidade. Uma deve ter sucesso e a outra falhar com `INSUFFICIENT_STOCK` sem permitir saldo negativo.
- **Auditoria Final do Tech Lead (Gate 4):**
  - Execução dos gates de qualidade obrigatórios:
    - `npx vitest run tests/unit` (100% passing).
    - `npx tsc --noEmit` (0 erros).
    - `npm run lint` (0 erros).
    - `npm run build` (build de produção limpo com código 0).

---

## 5. Critérios de Aceite e Fechamento do REV-001

A issue `REV-001` será considerada formalmente encerrada quando todos os seguintes critérios forem comprovados por evidências técnicas:

- [ ] **AC-01:** O serviço `InventoryService` centraliza 100% das operações de reserva e estorno de estoque da aplicação.
- [ ] **AC-02:** Um pedido gerado no checkout (`PENDING`) debita o estoque exatamente uma única vez.
- [ ] **AC-03:** A transição para `PAID` (via Asaas webhook ou admin) conclui com sucesso mesmo quando o estoque atual do produto/variante for 0 após o checkout.
- [ ] **AC-04:** O cancelamento de pedidos `PENDING` restaura o estoque da variante e do produto pai.
- [ ] **AC-05:** O cancelamento de pedidos `PAID` restaura o estoque da variante e do produto pai.
- [ ] **AC-06:** 100% dos testes unitários novos e pré-existentes são aprovados.
- [ ] **AC-07:** Build de produção (`npm run build`) concluído com status de saída `0`.

---

## 6. Próximo Passo

Este documento formaliza a estratégia técnica e o modelo operacional para a execução da correção do item **REV-001**.

**Status Atual:** Aguardando revisão, feedback e autorização expressa do usuário para iniciar a execução da Fase 1.
