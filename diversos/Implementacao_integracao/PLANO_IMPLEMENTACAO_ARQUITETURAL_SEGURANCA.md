# Plano de Implementação Arquitetural e de Segurança: Integração E-Commerce & Estoque (Nuvemshop / SMB Store Bridge)

Este documento detalha o plano de engenharia de software para a implementação da integração bidirecional de catálogo, estoque e pedidos entre o **E-Commerce Próprio** e o sistema **SMB Store Online** através da ponte da **Nuvemshop**, priorizando **arquitetura defensiva, segurança criptográfica, alta disponibilidade e escalabilidade**.

---

## 1. Visão Geral da Arquitetura do Sistema

```
                                ARQUITETURA GERAL DE INTEGRAÇÃO
  
  [ Cliente Final ] ──► [ Frontend Next.js ] ──► [ Cache / PostgreSQL Local ]
                                                          │
   ┌──────────────────────────────────────────────────────┴──────────────────────────────────────┐
   │                                CAMADA DE INTEGRAÇÃO ASSÍNCRONA                              │
   │                                                                                            │
   │  [ Inbound: Webhook Receiver ] ◄── (HMAC SHA-256) ── [ Nuvemshop Webhook ]                 │
   │           │                                                                                │
   │           ▼                                                                                │
   │  [ Reconciliador de Estoque ]                                                              │
   │                                                                                            │
   │  [ Outbound: Order Dispatcher ] ── (Fila / Retentativas) ──► [ Nuvemshop API ] ──► [ SMB ] │
   └────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Pilares de Engenharia e Requisitos Não-Funcionais

1. **Segurança Defensiva:**
   - Validação criptográfica de Webhooks usando assinaturas HMAC-SHA256 (`x-linkedstore-hmac-sha256`).
   - Isolamento de credenciais e tokens em variáveis de ambiente seguras com suporte a multi-tenant por loja.
   - Proteção estrita contra *SQL Injection*, *Replay Attacks* e consumo não autorizado de endpoints de integração.
2. **Escalabilidade & Multi-Loja (Multi-Tenant):**
   - Suporte a múltiplas lojas/filiais (`lojaID`), com configurações e catálogos segregados.
   - Índices de alta performance no PostgreSQL para respostas sub-milissegundo em consultas de catálogo e estoque.
3. **Resiliência e Desacoplamento Assíncrono (Non-blocking):**
   - O checkout do cliente nunca espera a resposta da API externa para confirmar a compra.
   - Filas com retentativas automáticas e recuo exponencial (*Exponential Backoff*) para lidar com oscilações de rede.
4. **Idempotência:**
   - Garantia de que eventos repetidos ou reenvios de pedidos nunca gerem duplicações de compras ou alterações indevidas de estoque.

---

## 3. Fases de Implementação

---

### 🧭 FASE 1: Fundação de Dados, Índices e Isolamento (Database Layer)
*Objetivo: Preparar o banco de dados para suportar sincronização de alta performance, sem concorrência destrutiva e com suporte a multi-lojas.*

#### Ações Técnicas:
1. **Atualização do Schema Prisma (`prisma/schema.prisma`):**
   * **Modelo `Product` & `ProductVariants`:**
     * `sku`: Código único de referência (indexado: `@@index([sku])`).
     * `nuvemshopProductId`: ID numérico do produto na Nuvemshop (`String?`).
     * `nuvemshopVariantId`: ID da variante correspondente na Nuvemshop (`String?`).
     * `stockBuffer`: Quantidade mínima de segurança (padrão: 1 unidade) para evitar venda simultânea em caso de latência de sincronização.
   * **Modelo `Order`:**
     * `nuvemshopOrderId`: ID de correlação do pedido registrado no ERP/Nuvemshop.
     * `syncStatus`: Status da sincronização (`PENDING`, `PROCESSING`, `SYNCED`, `FAILED`).
     * `syncAttempts`: Contador de tentativas de despacho.
     * `lastSyncError`: Registro em texto do log de erro para auditoria.
   * **Modelo `Loja` (Multi-tenant):**
     * Armazenar configurações de credenciais de forma isolada (`nuvemshopStoreId`, `nuvemshopAccessToken` opcional por loja).
2. **Otimização de Índices:**
   * Criação de índices compostos (`@@index([lojaID, sku])`, `@@index([nuvemshopVariantId])`) para garantir consultas rápidas no banco de dados.

---

### 🔐 FASE 2: Cliente HTTP Seguro e Camada de Tipagem (Integration Core)
*Objetivo: Criar uma camada de comunicação robusta, com timeout, controle de rate limit e isolamento de falhas.*

#### Ações Técnicas:
1. **Tipagem TypeScript Estrita (`types/nuvemshop.ts`):**
   * `NuvemshopProduct`, `NuvemshopVariant`, `NuvemshopOrderPayload`, `NuvemshopWebhookPayload`.
2. **Cliente HTTP com Resiliência (`lib/services/nuvemshop.service.ts`):**
   * **User-Agent Padronizado:** Cabeçalho exigido pela Nuvemshop (`NomeDoApp (contato@email.com)`).
   * **Controle de Taxa (*Rate-Limit Throttling*):** Respeito ao limite padrão de requisições para evitar erro `429 Too Many Requests`.
   * **Timeout de Segurança:** Limite estrito de 8 segundos por requisição HTTP.
   * **Modo Mock / Sandbox:** Capacidade de rodar em modo simulado durante o desenvolvimento local sem depender das chaves de produção.

---

### ⚡ FASE 3: Sincronização de Estoque em Tempo Real (Inbound Sync)
*Objetivo: Receber alterações de estoque da loja física instantaneamente e com segurança criptográfica.*

#### Ações Técnicas:
1. **Endpoint Receptor de Webhooks (`app/api/webhooks/nuvemshop/route.ts`):**
   * **Validação Criptográfica HMAC-SHA256:**
     * Validar o header `x-linkedstore-hmac-sha256` gerado com o `NUVEMSHOP_WEBHOOK_SECRET`.
     * Rejeitar com `401 Unauthorized` qualquer requisição não assinada.
2. **Processamento Idempotente:**
   * Validar se a atualização já foi aplicada recentemente, evitando retrabalho no banco de dados.
3. **Atualização Atômica de Saldo:**
   * Executar a atualização do `stock` no PostgreSQL via transação rápida (`prisma.$transaction`).

---

### 🛒 FASE 4: Despacho Assíncrono de Pedidos (Outbound Sync)
*Objetivo: Garantir que compras no site dêem baixa no ERP sem que o cliente do site precise esperar a API externa para ver a tela de "Pedido Concluído".*

#### Ações Técnicas:
1. **Arquitetura Desacoplada (Non-blocking Checkout):**
   * Ao aprovar o pagamento, o pedido é salvo como `PAID` no banco local e a resposta de sucesso é devolvida instantaneamente ao cliente.
   * O envio do pedido para a Nuvemshop/SMB Store é disparado em segundo plano.
2. **Fila e Retentativa Inteligente (*Exponential Backoff*):**
   * Se a API estiver instável no momento da compra:
     * O pedido é marcado como `syncStatus: PENDING`.
     * Um worker ou rotina de background tenta reenviar nos intervalos de 1min, 5min, 15min e 1h.

---

### 🛡️ FASE 5: Reconciliação, Auditoria e Auto-Recuperação (Self-Healing)
*Objetivo: Garantir que nenhuma divergência passe despercebida ao longo dos meses de operação.*

#### Ações Técnicas:
1. **Rotina de Reconciliação Diária (Cron Job):**
   * Execução diária (ex: 03:00h da madrugada) que compara todos os SKUs entre o e-commerce e a Nuvemshop para corrigir eventuais divergências de saldo.
2. **Logs de Auditoria no Banco (`AuditLog`):**
   * Histórico detalhado de todas as alterações de estoque vindas do ERP.
3. **Painel de Monitoramento no Admin:**
   * Interface administrativa para o lojista acompanhar o status da integração e acionar sincronização manual de emergência.

---

### 🧪 FASE 6: Homologação, Testes de Stress e Ativação em Produção
*Objetivo: Validar o sistema de ponta a ponta antes de liberar para os clientes finais.*

#### Ações Técnicas:
1. **Testes de Concorrência e Conflito:**
   * Testar a compra de um item com 1 unidade no estoque físico enquanto uma compra no site é finalizada.
2. **Validação de Webhooks em Ambiente de Staging:**
   * Testar fluxo de ponta a ponta com simulação de vendas e validação de baixa em menos de 3 segundos.
3. **Virada de Chave (Go-Live):**
   * Configuração das chaves de produção no `.env` e execução da sincronização inicial de todo o catálogo.

---

## 4. Matriz de Entregas por Etapa

| Etapa | Foco Principal | Entregável Concreto |
| :--- | :--- | :--- |
| **Fase 1** | Modelagem & Banco | Schema Prisma com suporte a multi-loja, campos de correlação e índices rápidos. |
| **Fase 2** | SDK & Resiliência | Cliente de API tipado com proteção contra rate-limit e suporte a modo Mock. |
| **Fase 3** | Entrada (Loja ➔ Site) | Webhook com validação criptográfica HMAC SHA-256 e estoque em tempo real. |
| **Fase 4** | Saída (Site ➔ Loja) | Despacho de pedidos assíncrono com fila de retentativas automáticas. |
| **Fase 5** | Segurança & Auditoria | Rotina de auto-recuperação (Cron) e tela de status para o administrador. |
| **Fase 6** | Validação & Go-Live | Testes finais de concorrência e ativação das chaves reais. |
