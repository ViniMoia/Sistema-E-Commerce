# Workflow de Implementação — Cartão de Crédito e Boleto Bancário

**Projeto:** E-Commerce Multi-Tenant & Plataforma Continental Produtos Estéticos Automotivos  
**Ambiente Auditado:** Local (Windows 11 / Node.js v22.15.0 / Next.js 16.3.5) & Produção (Vercel / Supabase Nuvem / Asaas Produção)  
**Autor:** Staff Software Engineer, Software Architect & Tech Lead  
**Papel Operacional:** Coordenador Técnico de Equipe de Agentes de IA  
**Data de Emissão:** 22 de Setembro de 2026  
**Localização do Arquivo:** `diversos/PALENJAMENTO_BANCO/Correcao/correcao_2/WORKFLOW_IMPLEMENTACAO_CARTAO_E_BOLETO.md`  
**Status do Documento:** **PLANEJAMENTO ARQUITETURAL APROVADO — NÃO EXECUTAR CÓDIGO NESTA ETAPA**

---

## 1. Resumo Executivo

No dia 22 de Setembro de 2026, durante a realização do primeiro teste de transação em produção (*Smoke Test* de R$ 1,00) no ambiente de homologação (`continental-prototipo.vercel.app/checkout`), dois problemas fundamentais foram detectados:

1. **Rejeição do PIX com Erro HTTP 400:** A API comercial do Asaas (`POST /v3/payments`) rejeitou a cobrança com a mensagem oficial:  
   `"O valor da cobrança (R$ 1,00) menos o valor do desconto (R$ 0,00) não pode ser menor que R$ 5,00."`  
   O backend capturou o erro e devolveu ao cliente uma mensagem genérica (*"verifique seus dados"*), ocultando a regra bancária de piso mínimo.
2. **Ausência de Outros Meios de Pagamento:** A tela de checkout encontrava-se 100% amarrada e codificada de forma rígida exclusivamente para PIX via WhatsApp/QR Code. Não havia no frontend, no contrato de gateway ou no banco de dados suporte a Cartão de Crédito parcelado ou Boleto Bancário.

A auditoria forense do código revelou que o projeto nasceu como um protótipo com pedido via WhatsApp (`WHATSAPP_PIX`) e recebeu no commit `eca0575` uma integração direcionada exclusivamente para PIX. Os documentos de roadmap anteriores avaliaram a conformidade em relação a esse escopo delimitado, gerando um descompasso entre a expectativa comercial do lojista (loja completa com Cartão e Boleto) e o código efetivamente entregue.

Este documento estabelece o **Workflow Arquitetural Completo, Sequencial e Coordenável por Agentes Autônomos** para projetar, integrar, blindar e testar os meios de pagamento **Cartão de Crédito** e **Boleto Bancário** na plataforma Continental, respeitando rigorosamente os padrões SOLID, Clean Architecture, isolamento multi-tenant, segurança PCI-DSS e idempotência financeira.

---

## 2. Objetivo

Projetar uma arquitetura de pagamentos desacoplada, extensível e auditável que permita ao cliente final da Continental escolher entre:
* **PIX Dinâmico** (instantâneo, com QR Code e Copia e Cola);
* **Cartão de Crédito** (com validação em tempo real, seleção de 1x até 12x e autorização online imediata);
* **Boleto Bancário** (com geração de linha digitável, código de barras e link do PDF com compensação D+1 a D+3).

O workflow organiza o trabalho de agentes de IA especializados através de fases delimitadas, com pré-condições, matriz de responsabilidades, dependências sequenciais/paralelas, gates objetivos de aprovação, gestão de riscos e procedimentos de contingência/rollback.

---

## 3. Documento de Referência Utilizado

O diagnóstico de referência que originou esta necessidade encontra-se em:
* [`diversos/PALENJAMENTO_BANCO/Correcao/correcao_1/DIAGNOSTICO_ERRO_PIX_E_METODOS_PAGAMENTO_ASAAS.md`](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/diversos/PALENJAMENTO_BANCO/Correcao/correcao_1/DIAGNOSTICO_ERRO_PIX_E_METODOS_PAGAMENTO_ASAAS.md)

Documentos complementares inspecionados:
* [`diversos/PALENJAMENTO_BANCO/GUIA_CONFIGURACAO_E_INTEGRACAO_ASAAS.md`](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/diversos/PALENJAMENTO_BANCO/GUIA_CONFIGURACAO_E_INTEGRACAO_ASAAS.md)
* [`diversos/PLANEJAMENTO_GERAL/Funcionalidades/Auditoria_2/RELATORIO_AUDITORIA_PRONTIDAO_PRODUCAO_RODADA_2.md`](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/diversos/PLANEJAMENTO_GERAL/Funcionalidades/Auditoria_2/RELATORIO_AUDITORIA_PRONTIDAO_PRODUCAO_RODADA_2.md)

---

## 4. Estado Atual do Projeto

### 4.1. Stack Tecnológica
* **Linguagem:** TypeScript 5.8 estrito (`strict: true`, `noEmit: true` com 0 erros);
* **Framework Web & API:** Next.js 16.3.5 (App Router, Turbopack, React 19);
* **Persistência / Banco:** PostgreSQL hospedado no Supabase Nuvem (AWS US-East-1);
* **ORM:** Prisma 5.22.0 (com connection pooling via PgBouncer / direct URL);
* **Autenticação:** Sessões seguras HTTP-only baseadas em cookie com criptografia e isolamento multi-tenant (`lib/session.ts`);
* **Estilização / UI:** Tailwind CSS v3, Radix UI Primitives, Lucide React, Sonner Toasts;
* **Gateway de Pagamentos:** Asaas REST API v3 (`https://api.asaas.com/v3`);
* **E-mails Transacionais:** Resend API v2 via HTTP com templates responsivos;
* **Qualidade e Testes:** Vitest 4.1.6 (45 suítes, 334 testes unitários 100% verdes).

### 4.2. Mapeamento de Camadas e Componentes
* **Camada de Apresentação (Frontend):**
  * `app/checkout/page.tsx`: Página cliente que consome o carrinho e carrega o lojista ativo;
  * `components/checkout/CheckoutForm.tsx`: Componente com stepper (1. Dados Pessoais -> 2. Entrega/Frete -> 3. Revisão & Pagamento);
  * `components/checkout/LoyaltyPointsWidget.tsx`: Resgate e simulação de saldo de fidelidade.
* **Camada de Aplicação / Controladores (API Routes):**
  * `app/api/checkout/route.ts`: Endpoint `POST` protegido por rate limit (15 req/min) e isolamento multi-tenant;
  * `app/api/webhooks/asaas/route.ts`: Endpoint `POST` para recebimento de webhooks do Asaas com verificação em tempo constante (`crypto.timingSafeEqual`) e tabela de idempotência (`PaymentWebhookEvent`).
* **Camada de Domínio e Regras de Negócio (Services):**
  * `services/checkout.service.ts`: Orquestrador de checkout (validação autoritativa de preços, reserva de estoque atômica, débito de fidelidade e emissão de cobrança no gateway);
  * `services/order.service.ts`: FSM (Máquina de Estados) de pedidos (`updateOrderStatus`) com estorno de estoque e crédito de pontos;
  * `services/order-timeout.service.ts`: Worker de cancelamento automático por timeout.
* **Camada de Infraestrutura / Gateway:**
  * `services/asaas/asaas.client.ts`: Cliente HTTP encapsulado com timeouts, cabeçalho `access_token` e tratamento de erros;
  * `services/asaas/asaas.adapter.ts`: Implementação concreta do contrato `PaymentGateway`.

### 4.3. Fluxo de Pagamento Existente (Real no Código)

```text
[Cliente no Navegador]
       │ Submete formulário no CheckoutForm.tsx (Passo 3)
       ▼
[POST /api/checkout]
       │ 1. Valida schema Zod (createOrderSchema)
       │ 2. Valida domínio multi-tenant (activeLoja)
       │ 3. Valida sessão do usuário (Anti-IDOR)
       ▼
[checkout.service.ts -> createOrder()]
       │ 4. Transação Prisma ($transaction):
       │    ├── Valida preços e variantes diretamente no Banco
       │    ├── Reserva estoque atômico (InventoryService.reserveStock)
       │    ├── Cria Pedido (status = PENDING, paymentMethod = 'WHATSAPP_PIX')
       │    └── Debita pontos se houve resgate (debitRedeemedPoints)
       │
       │ 5. Geração de Cobrança (Fase 2 - Pós-DB):
       ▼
[asaas.adapter.ts -> createPixCharge()]
       │ 6. asaasClient.getOrCreateCustomer(customer)
       │ 7. asaasClient.createPayment({ billingType: 'PIX', value, dueDate })
       │ 8. asaasClient.getPixQrCode(paymentId)
       ▼
[Retorno para UI]
       │ Exibe QR Code Base64 e Copia-e-Cola
       ▼
[Webhook Asaas -> POST /api/webhooks/asaas]
       │ 9. Valida token com timingSafeEqual
       │ 10. Garante idempotência via PaymentWebhookEvent.create()
       │ 11. Se PAYMENT_CONFIRMED ou PAYMENT_RECEIVED:
       │     └── updateOrderStatus(orderId, 'PAID')
       │         ├── Atualiza status no banco e grava AuditLog
       │         ├── Credita pontos ganhos (creditEarnedPoints)
       │         └── Dispara e-mail de confirmação assíncrono (Resend)
```

---

## 5. Auditoria dos Meios de Pagamento Existentes

| Capacidade | Classificação | Evidência Técnica no Código |
| :--- | :---: | :--- |
| **PIX Dinâmico (Asaas)** | `Implementada com problemas` | O fluxo de emissão existe em `services/asaas/asaas.adapter.ts`, mas falha em valores abaixo de R$ 5,00 devido à restrição de API do Asaas. O rollback em caso de falha possui bug de chave estrangeira (`performedById: 'CHECKOUT_PAYMENT_FAILURE'`). |
| **PIX Manual (WhatsApp)** | `Existente e validada` | Chave estática do lojista (`loja.pixKey`) armazenada no banco e persistida em `Order.pixKeyUsed`. |
| **Cartão de Crédito (Formulário UI)** | `Não implementada` | `components/checkout/CheckoutForm.tsx` não possui campos de cartão (número, titular, validade, CVV ou parcelamento). |
| **Cartão de Crédito (Validação de Entrada)** | `Não implementada` | `lib/validators/checkout.validators.ts` não possui schema para validar dados de cartão ou parcelas. |
| **Cartão de Crédito (Contrato de Domínio)** | `Não implementada` | `types/payment-gateway.types.ts` só contém `createPixCharge` e `getPaymentStatus`. |
| **Cartão de Crédito (Integração Asaas)** | `Não implementada` | `services/asaas/asaas.adapter.ts` só envia `billingType: 'PIX'`. Não há método `createCreditCardCharge`. |
| **Boleto Bancário (Interface e Emissão)** | `Não implementada` | Não há geração de linha digitável, código de barras ou disponibilização de URL de fatura de boleto no frontend. |
| **Webhook de Liquidação de PIX** | `Existente e validada` | Rota `/api/webhooks/asaas` processa `PAYMENT_RECEIVED` e `PAYMENT_CONFIRMED` com idempotência e timing attack defense. |
| **Webhook de Liquidação de Cartão** | `Parcialmente implementada` | O webhook escuta `PAYMENT_CONFIRMED`, mas não trata recusas imediatas ou status `AWAITING_RISK_ANALYSIS`. |
| **Webhook de Liquidação de Boleto** | `Parcialmente implementada` | O webhook escuta `PAYMENT_RECEIVED`, mas não captura dados específicos de compensação bancária D+1. |
| **Estorno e Cancelamento (Refund)** | `Existente e validada` | `services/order.service.ts` possui `InventoryService.restoreStock` e `refundOrderPoints` atômicos. |

---

## 6. Divergências Encontradas (Confrontação Rigorosa)

Durante a confrontação entre o **Documento de Referência**, a **Arquitetura Atual**, o **Código** e o **Banco de Dados**, foram identificadas as seguintes divergências críticas:

```text
DOCUMENTO DE REFERÊNCIA (DIAGNOSTICO_ERRO_PIX_E_METODOS_PAGAMENTO_ASAAS.md)
        vs.
GUIA HISTÓRICO (GUIA_CONFIGURACAO_E_INTEGRACAO_ASAAS.md)
        vs.
CÓDIGO ATUAL (services/checkout.service.ts & types/payment-gateway.types.ts)
        vs.
BANCO DE DADOS (prisma/schema.prisma)
```

### Divergência 1: O Guia Histórico presumiu teste de R$ 1,00 sem checar o piso da API do Asaas
* **Evidência:** Em `GUIA_CONFIGURACAO_E_INTEGRACAO_ASAAS.md`, linha 99, consta textualmente: *"Faremos um pedido de teste de R$ 1,00 na loja virtual"*.
* **Realidade no Código e API:** A API comercial de produção do Asaas retorna HTTP 400 exigindo piso mínimo de R$ 5,00 (`invalid_action`).
* **Impacto:** O teste manual falhou com banner de erro genérico.
* **Origem:** `DOCUMENTAÇÃO` desatualizada versus `REQUISITO` bancário da API Asaas.
* **Decisão Arquitetural:** O validador de checkout (`lib/validators/checkout.validators.ts`) deve bloquear previamente pedidos inferiores a R$ 5,00 caso o método selecionado seja processado pelo Asaas, retornando mensagem clara antes de disparar requisições inúteis.

### Divergência 2: Bug de Chave Estrangeira no Rollback do Checkout
* **Evidência no Código:** Em `services/checkout.service.ts`, linha 522:
  `performedById: 'CHECKOUT_PAYMENT_FAILURE'`.
  Em `services/order.service.ts`, linhas 302-303:
  `const isSystemActor = input.performedById === "ASAAS_GATEWAY" || input.performedById === "SYSTEM";`
  `const effectiveActorId = isSystemActor ? fullOrder.userID : input.performedById;`
* **Realidade no Banco:** Na tabela `AuditLog`, o campo `actorId` é uma foreign key para `User.id`. Como `'CHECKOUT_PAYMENT_FAILURE'` não é `"ASAAS_GATEWAY"` nem `"SYSTEM"`, o Prisma lança violação de foreign key.
* **Impacto:** O pedido 32 falhou na criação do Asaas, mas a compensação para `CANCELLED` falhou silenciosamente no bloco `catch`, deixando o pedido órfão em `PENDING`.
* **Origem:** `CÓDIGO` com falha de integração na FSM de auditoria.
* **Decisão Arquitetural:** Padronizar `performedById: 'SYSTEM'` em todas as operações de compensação automática de erro de gateway.

### Divergência 3: Campo `paymentMethod` no Prisma é String Genérica sem Enum
* **Evidência no Banco:** Em `prisma/schema.prisma`, linha 278:
  `paymentMethod String?` (valor gravado fixo no código: `'WHATSAPP_PIX'`).
* **Impacto:** Não há tipagem estrita no banco para distinguir `PIX`, `CREDIT_CARD` e `BOLETO`.
* **Origem:** `BANCO` modelado na fase embrionária do projeto.
* **Decisão Arquitetural:** Manter o campo `paymentMethod` como String para preservar compatibilidade com pedidos legados no banco, mas criar um Enum TypeScript estrito na camada de domínio e validação:
  `export type PaymentMethod = 'PIX' | 'CREDIT_CARD' | 'BOLETO' | 'WHATSAPP_PIX';`

---

## 7. Arquitetura-Alvo (SOLID, Clean Architecture & Ports/Adapters)

A arquitetura para suportar múltiplos métodos de pagamento sem violar o Princípio Aberto/Fechado (OCP) e da Responsabilidade Única (SRP) seguirá o padrão **Ports and Adapters (Arquitetura Hexagonal)**:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                         CAMADA DE APRESENTAÇÃO                         │
│  [CheckoutForm.tsx] (Abas: PIX / Cartão de Crédito / Boleto Bancário)  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP POST (Payload Tipado)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        CAMADA DE CONTROLADORES                         │
│  [app/api/checkout/route.ts] (Rate Limit, Multi-Tenant, Zod Validator) │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         CAMADA DE APLICAÇÃO                            │
│  [services/checkout.service.ts] (Orquestração de Pedido, Estoque, FSM) │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                          PORTA DE DOMÍNIO                              │
│  [types/payment-gateway.types.ts] (Interface Abstrata PaymentGateway)   │
│  ├── createPixCharge(input)                                            │
│  ├── createCreditCardCharge(input)                                     │
│  ├── createBoletoCharge(input)                                         │
│  └── getPaymentStatus(paymentId)                                       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        ADAPTADOR DE INFRAESTRUTURA                     │
│  [services/asaas/asaas.adapter.ts] (AsaasPaymentAdapter)                │
│  ├── Traduz modelos de domínio para o payload do Asaas                 │
│  └── Comunica-se via [services/asaas/asaas.client.ts]                  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTPS (API REST v3)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                           PROVEDOR EXTERNO                             │
│  Asaas API (https://api.asaas.com/v3/payments)                         │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Equipe de Agentes de IA

Para garantir segregação estrita de responsabilidades e revisão cruzada independente, a equipe de agentes será estruturada como se segue:

| Agente | Perfil / Especialidade | Responsabilidade Primária | Dependências | Entregáveis (Saída) |
| :--- | :--- | :--- | :--- | :--- |
| **Agente 1 — Tech Architect** | Staff Architect & Tech Lead | Modelagem de tipos, contratos SOLID, expansão da porta `PaymentGateway` e governança das transições. | Nenhuma | Contratos em `types/`, interfaces e regras de parcelamento. |
| **Agente 2 — Payment Specialist** | Especialista em Domínio Financeiro | Máquina de estados financeiros, regras de compensação de boleto, regras de antifraude e parcelamento. | Agente 1 | Matriz de estados, validações financeiras e regras de juros. |
| **Agente 3 — Gateway Specialist** | Especialista em Integrações Asaas | Implementação das chamadas de Cartão e Boleto no `AsaasClient` e `AsaasPaymentAdapter`. | Agente 1, 2 | Métodos concretos em `services/asaas/` e tratamento de erros HTTP 400/401/422. |
| **Agente 4 — Backend Engineer** | Senior Backend Engineer | Atualização de `checkout.service.ts`, `checkout.validators.ts` e fix do rollback de auditoria. | Agente 1, 3 | Rota de API atualizada, persistência dos metadados e FSM unificada. |
| **Agente 5 — Frontend / UX** | Senior Frontend Engineer | Desenvolvimento das abas de seleção no `CheckoutForm.tsx`, máscaras de cartão, feedback de loading e tela de confirmação. | Agente 1, 4 | Interface de checkout elegante (Dark/Gold), campos de cartão/boleto e acessibilidade. |
| **Agente 6 — Security Engineer** | Application Security Specialist | Conformidade PCI-DSS (não armazenamento de PAN/CVV), sanitização de logs, validação de token do webhook. | Agente 3, 4, 5 | Auditoria de segurança, sanitização de logs e proteção anti-tampering. |
| **Agente 7 — QA Engineer** | Senior Quality Assurance | Construção de testes unitários com Vitest, simulação de falhas, cenários de concorrência e idempotência. | Agente 3, 4, 5 | Novas suítes de testes unitários com 100% de aprovação. |
| **Agente 8 — SecOps & Observability** | DevOps & Observability Engineer | Métricas de conversão de checkout, rastreabilidade estruturada (`logger.ts`) e checklist de ativação. | Agente 4, 6 | Painel de telemetria, logs de auditoria e roteiro de go-live. |

---

## 9. Matriz MCP × Fase

| Fase | MCP / Ferramenta | Objetivo | Operação Planejada | Resultado Esperado |
| :--- | :--- | :--- | :--- | :--- |
| **Fase 0** | *Ruflo* | Descoberta e orquestração | Carregar contexto e dependências dos agentes | Mapa de dependências inicializado |
| **Fase 1** | *Modern Web Guidance* | Validação de arquitetura | Inspecionar padrão de Server/Client Components | Padrão arquitetural validado |
| **Fase 3** | *Ruflo* | Paralelização de tarefas | Delegar tipagens e interfaces simultaneamente | Contratos de tipos gerados sem bloqueio mútuo |
| **Fase 5** | *Modern Web Guidance* | Boas práticas de validação | Revisar schemas Zod para payloads de cartão | Validação estrita sem vazamento de dados |
| **Fase 6** | *Modern Web Guidance* | Padrões de acessibilidade e UX | Inspecionar inputs de cartão e máscaras | Formulário acessível, reativo e sem layout shift |
| **Fase 8** | *Chrome DevTools* | Inspeção de checkout visual | Validar interações e requisições no DOM/Console | Ausência de erros no console do navegador |
| **Fase 9** | *Ruflo* | Consolidação de relatórios | Consolidar métricas de cobertura de testes | Relatório de prontidão técnica emitido |

> [!NOTE]
> **MCPs Não Utilizados:**
> * `Firebase`: Não utilizado — O projeto utiliza Supabase PostgreSQL nativo.
> * `Android CLI`: Não utilizado — Aplicação Web responsiva sem compilação Android.
> * `Science`: Não utilizado — Sem relação com o domínio de pagamentos e e-commerce.

---

## 10. Workflow Detalhado por Fases

```text
┌────────────────────────────────────────────────────────────────────────────────┐
│                             DAG DE EXECUÇÃO DO WORKFLOW                        │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│  [Fase 0: Reconhecimento] ──► [Fase 1: Auditoria] ──► [Fase 2: Modelagem]      │
│                                                              │                 │
│                                                              ▼                 │
│                                                   [Fase 3: Arquitetura & Tipos]│
│                                                              │                 │
│                         ┌────────────────────────────────────┴──────────────┐  │
│                         ▼                                                   ▼  │
│              [Fase 4: Segurança PCI]                             [Fase 5: Backend]
│                         │                                                   │  │
│                         └─────────────────┬─────────────────────────────────┘  │
│                                           ▼                                    │
│                                  [Fase 6: Frontend]                            │
│                                           │                                    │
│                                           ▼                                    │
│                            [Fase 7: Webhooks & Reconciliação]                  │
│                                           │                                    │
│                                           ▼                                    │
│                                  [Fase 8: Suíte de QA]                         │
│                                           │                                    │
│                                           ▼                                    │
│                           [Fase 9: Validação Operacional]                      │
│                                           │                                    │
│                                           ▼                                    │
│                                  [Fase 10: Go-Live]                            │
│                                                                                │
└────────────────────────────────────────────────────────────────────────────────┘
```

### Fase 0 — Descoberta e Reconhecimento
* **Objetivo:** Estabelecer a baseline técnica e confrontar as premissas do documento de referência com o código real.
* **Pré-condições:** Acesso de leitura à base de código e documentação.
* **Agentes:** Agente 1 (Tech Architect).
* **MCPs:** Ruflo.
* **Tarefas:**
  1. Mapear o schema Prisma atual e identificar metadados necessários para Cartão e Boleto.
  2. Mapear o cliente Asaas e documentar os endpoints necessários (`/v3/payments`, `/v3/payments/{id}/identificationField`).
* **Saídas:** Mapa de campos a criar e lista de endpoints Asaas mapeados.
* **Gate 0:** Compreensão completa do fluxo de ponta a ponta documentada.

---

### Fase 1 — Auditoria dos Meios de Pagamento Existentes
* **Objetivo:** Auditar todos os pontos de falha no fluxo de pagamento atual (PIX).
* **Pré-condições:** Fase 0 concluída.
* **Agentes:** Agente 1 (Tech Architect), Agente 3 (Gateway Specialist).
* **Tarefas:**
  1. Isolar o bug do `performedById: 'CHECKOUT_PAYMENT_FAILURE'` no cancelamento de pedidos.
  2. Documentar o comportamento de erro genérico versus erro real do gateway em `checkout.service.ts`.
  3. Mapear os status de pedido que precisam receber os metadados de boleto e cartão.
* **Saídas:** Relatório de correções prévias necessárias.
* **Gate 1:** Todos os bugs da infraestrutura atual mapeados e compreendidos.

---

### Fase 2 — Modelagem Financeira e de Estados
* **Objetivo:** Definir as regras de negócio para Cartão de Crédito e Boleto Bancário.
* **Pré-condições:** Fase 1 concluída.
* **Agentes:** Agente 2 (Payment Specialist).
* **Tarefas:**
  1. Definir o prazo de validade do Boleto Bancário como estritamente 1 dia útil (D+1), minimizando a retenção indevida de estoque físico.
  2. Parametrizar a política de parcelamento em Cartão com repasse de juros/taxas ao comprador e parcela mínima de R$ 20,00, mantendo a arquitetura 100% preparada para alternar para "sem juros" no futuro via flag configurável.
  3. Mapear o ciclo de vida completo: autorização imediata, análise de risco (antifraude) e liquidação.
* **Saídas:** Especificação funcional das regras de cartão e boleto parametrizadas.
* **Gate 2:** Regras de negócio alinhadas com as deliberações homologadas pelo lojista.

---

### Fase 3 — Arquitetura de Software e Contratos (Ports & Adapters)
* **Objetivo:** Expandir os contratos de domínio sem quebrar o código existente.
* **Pré-condições:** Fase 2 concluída.
* **Agentes:** Agente 1 (Tech Architect), Agente 3 (Gateway Specialist).
* **Tarefas:**
  1. Em `types/payment-gateway.types.ts`, criar:
     * `CreateCreditCardChargeInput` (dados do titular, dados do cartão, parcelamento);
     * `CreditCardChargeResult` (status da transação, bandeira, últimos 4 dígitos, autorização);
     * `CreateBoletoChargeInput` (dados do cliente, vencimento, instruções);
     * `BoletoChargeResult` (linha digitável, código de barras, URL do PDF da fatura).
  2. Expandir a interface `PaymentGateway` com `createCreditCardCharge` e `createBoletoCharge`.
  3. Em `types/asaas.types.ts`, adicionar os nós `creditCard`, `creditCardHolderInfo` e `installmentCount`.
* **Saídas:** Interfaces TypeScript estritas compilando com 0 erros.
* **Gate 3:** Tipagem completa e retrocompatível com o PIX existente.

---

### Fase 4 — Segurança da Informação e Conformidade PCI-DSS
* **Objetivo:** Blindar o sistema contra captura ou vazamento indevido de dados de cartão.
* **Pré-condições:** Fase 3 concluída.
* **Agentes:** Agente 6 (Security Engineer).
* **Tarefas:**
  1. Estabelecer a diretriz de **Zero-Storage de Dados Sensíveis**:
     * **NUNCA** gravar no banco de dados local: Número completo do cartão, CVV ou data de validade.
     * Gravar apenas: Bandeira (`creditCardBrand`) e Últimos 4 dígitos (`creditCardLast4`).
  2. Auditar `lib/logger.ts` para garantir que o número do cartão e o CVV sejam interceptados e mascarados caso passem por logs acidentais.
  3. Definir política de headers de segurança e CSP para requisições de pagamento.
* **Saídas:** Matriz de conformidade de segurança e regras de sanitização ativas.
* **Gate 4:** Modelo de dados aprovado pelo Agente de Segurança.

---

### Fase 5 — Engenharia de Backend e Integração Asaas
* **Objetivo:** Implementar o suporte a Cartão e Boleto nos serviços de backend.
* **Pré-condições:** Fases 3 e 4 concluídas.
* **Agentes:** Agente 3 (Gateway Specialist), Agente 4 (Backend Engineer).
* **Tarefas:**
  1. Em `services/asaas/asaas.client.ts`:
     * Implementar método `getBoletoIdentificationField(paymentId)` para buscar linha digitável e código de barras.
  2. Em `services/asaas/asaas.adapter.ts`:
     * Implementar `createCreditCardCharge`: enviar `billingType: 'CREDIT_CARD'`, nós de cartão e parcelamento;
     * Implementar `createBoletoCharge`: enviar `billingType: 'BOLETO'` e recuperar linha digitável e PDF.
  3. Em `services/checkout.service.ts`:
     * Corrigir a captura de erro para repassar a mensagem real do Asaas ao cliente;
     * Corrigir o rollback para usar `performedById: 'SYSTEM'`;
     * Ramificar o pós-pedido conforme `paymentMethod` (PIX, CREDIT_CARD, BOLETO);
     * Gravar os metadados específicos no pedido (`Order`).
  4. Em `lib/validators/checkout.validators.ts`:
     * Adicionar validações condicionais: se `CREDIT_CARD`, validar número (Luhn algorithm), CVV (3-4 dígitos), validade (MM/AA) e parcelas; se `BOLETO`, validar endereço completo.
* **Saídas:** Backend totalmente integrado com as 3 modalidades.
* **Gate 5:** Compilação TypeScript com 0 erros e testes de integração com mocks aprovados.

---

### Fase 6 — Engenharia de Frontend e Experiência do Usuário (UX)
* **Objetivo:** Criar a interface de seleção de pagamento no checkout.
* **Pré-condições:** Fase 5 concluída.
* **Agentes:** Agente 5 (Frontend / UX).
* **MCPs:** Modern Web Guidance, Chrome DevTools.
* **Tarefas:**
  1. No Passo 3 de `components/checkout/CheckoutForm.tsx`:
     * Substituir o texto fixo de PIX por um seletor visual em 3 abas na identidade Continental Dark/Gold:
       * **Aba 1: PIX (Recomendado):** Informa desconto e geração instantânea de QR Code.
       * **Aba 2: Cartão de Crédito:**
         * Campo "Número do Cartão" com detecção automática de bandeira (Visa, Mastercard, Elo, etc.);
         * Campo "Nome Impresso no Cartão";
         * Campos em grid: "Validade (MM/AA)" e "CVV";
          * Seletor dinâmico de Parcelas (de 1x até 12x com cálculo de repasse de juros e parcela mínima de R$ 20,00);
         * Checkbox opcional "Endereço da fatura é o mesmo da entrega".
       * **Aba 3: Boleto Bancário:**
          * Informa prazo de vencimento de 1 dia útil e aviso sobre prazo de compensação bancária (1 a 3 dias úteis);
         * Informa que o envio dos produtos ocorre após a compensação.
     * Atualizar o botão de submissão dinamicamente:
       * Se PIX: *"Confirmar e Pagar via PIX"*;
       * Se Cartão: *"Pagar R$ XX,XX com Cartão"*;
       * Se Boleto: *"Gerar Boleto Bancário"*.
  2. Na tela de sucesso pós-pedido (`/order/success` ou modal):
     * Se Cartão aprovado: Exibir confirmação imediata e status "PAGAMENTO APROVADO";
     * Se Cartão em análise: Exibir status "EM ANÁLISE DE SEGURANÇA";
     * Se Boleto: Exibir botão "Imprimir / Visualizar Boleto em PDF", código de barras e botão "Copiar Linha Digitável".
* **Saídas:** Componente de checkout atualizado, responsivo e validado visualmente.
* **Gate 6:** UX fluida, sem layout shift, acessível e validada em telas mobile e desktop.

---

### Fase 7 — Webhooks, Ciclo de Vida e Reconciliação
* **Objetivo:** Garantir a consistência assíncrona dos pagamentos de Cartão e Boleto.
* **Pré-condições:** Fases 5 e 6 concluídas.
* **Agentes:** Agente 2 (Payment Specialist), Agente 4 (Backend Engineer).
* **Tarefas:**
  1. Atualizar `app/api/webhooks/asaas/route.ts` para tratar os eventos específicos:
     * `PAYMENT_CONFIRMED`: Cartão aprovado online ou compensação do boleto confirmada -> Transiciona pedido para `PAID` e dispara e-mail;
     * `PAYMENT_RECEIVED`: Pagamento creditado em conta -> Confirma pedido caso ainda esteja pendente;
     * `PAYMENT_OVERDUE`: Boleto vencido sem pagamento após 1 dia útil -> Transiciona pedido para `CANCELLED`, restaura estoque físico e estorna pontos de fidelidade;
     * `PAYMENT_AWAITING_RISK_ANALYSIS`: Alerta que o cartão está sob análise manual no Asaas (mantém pedido em `PENDING` sem liberar envio);
     * `PAYMENT_CHARGEBACK_REQUESTED` / `PAYMENT_REFUNDED`: Registra contestação ou estorno no pedido.
  2. Ajustar os logs de auditoria para usar `performedById: 'ASAAS_GATEWAY'`.
* **Saídas:** Processador de webhooks robusto e resiliente a falhas de rede.
* **Gate 7:** Tratamento de todos os eventos de ciclo de vida com testes unitários cobrindo transições e reversões.

---

### Fase 8 — Suíte Abrangente de Testes Automatizados (QA)
* **Objetivo:** Validar a corretude matemática, regras de negócio e estabilidade da aplicação.
* **Pré-condições:** Fases 5, 6 e 7 concluídas.
* **Agentes:** Agente 7 (QA Engineer).
* **Tarefas:**
  1. Criar `tests/unit/asaas-credit-card.test.ts`:
     * Cenário 1: Cartão de crédito aprovado na hora (`CONFIRMED`);
     * Cenário 2: Cartão de crédito recusado pela operadora (saldo insuficiente, cartão inválido);
     * Cenário 3: Validação de algoritmo de Luhn e datas de expiração expiradas;
     * Cenário 4: Parcelamento com 1x, 3x, 6x e 12x com cálculo de parcelas;
     * Cenário 5: Garantir que CVV e número completo nunca são persistidos.
  2. Criar `tests/unit/asaas-boleto.test.ts`:
     * Cenário 1: Geração de boleto com linha digitável e código de barras;
     * Cenário 2: Compensação bancária via webhook (`PAYMENT_RECEIVED`);
     * Cenário 3: Vencimento e cancelamento por timeout (`PAYMENT_OVERDUE`) com restauração de estoque.
  3. Atualizar `tests/unit/checkout-authoritative.test.ts` para testar os 3 métodos de pagamento.
  4. Executar bateria de regressão: `npm run test:unit` e `npx tsc --noEmit`.
* **Saídas:** Mínimo de 25 novos testes unitários adicionados; 100% de sucesso na suíte.
* **Gate 8:** 0 erros de compilação, 0 falhas em testes unitários.

---

### Fase 9 — Validação Operacional e Observabilidade
* **Objetivo:** Instrumentar métricas e validar comportamento em ambiente de homologação.
* **Pré-condições:** Fase 8 concluída.
* **Agentes:** Agente 8 (SecOps & Observability).
* **Tarefas:**
  1. Adicionar tags de métricas estruturadas no `lib/logger.ts`:
     * `CHECKOUT_PAYMENT_METHOD_SELECTED` (PIX, CREDIT_CARD, BOLETO);
     * `PAYMENT_CARD_AUTHORIZED` / `PAYMENT_CARD_REFUSED`;
     * `PAYMENT_BOLETO_GENERATED`.
  2. Criar script de verificação de integridade operacional de contingência.
* **Saídas:** Painel de logs estruturados e rastreamento de ponta a ponta ativo.
* **Gate 9:** Observabilidade validada em homologação.

---

### Fase 10 — Homologação Final e Go-Live
* **Objetivo:** Executar o Smoke Test Real de Produção e liberar para os clientes.
* **Pré-condições:** Todos os Gates anteriores (0 a 9) aprovados; decisão humana homologada.
* **Agentes:** Tech Lead & Usuário/Lojista.
* **Tarefas:**
  1. Executar o Smoke Test de PIX com produto de **R$ 5,00** para homologar o gateway Asaas em produção.
  2. Executar teste com Cartão de Crédito real (valor de R$ 5,00 ou superior) para validar aprovação imediata e compensação.
  3. Gerar 1 Boleto de teste para checar visualização e leitura da linha digitável.
  4. Ativação oficial na branch de produção.
* **Gate Final:** Todas as transações liquidadas e registradas no Asaas e banco Supabase com sucesso.

---

## 11. Fluxo Detalhado de Cartão de Crédito

```text
[Cliente]
   │ 1. Seleciona aba "Cartão de Crédito" no Passo 3
   │ 2. Preenche: Número, Nome Impresso, Validade (MM/AA), CVV
   │ 3. Seleciona número de parcelas (1x a 12x)
   │ 4. Clica em "Pagar com Cartão"
   ▼
[Frontend - CheckoutForm.tsx]
   │ 5. Validação local: Algoritmo de Luhn (número), data futura (validade), 3-4 dígitos (CVV)
   │ 6. Envio via HTTPS POST /api/checkout (Payload criptografado em trânsito)
   ▼
[API /api/checkout -> checkout.service.ts]
   │ 7. Transação Atômica no Banco de Dados:
   │    ├── Reserva estoque físico de todos os itens
   │    ├── Cria o Pedido com status 'PENDING' e paymentMethod 'CREDIT_CARD'
   │    └── Registra snapshot do titular e endereço
   │
   │ 8. Chamada ao Gateway Asaas (asaas.adapter.ts):
   ▼
[Asaas API v3: POST /v3/payments]
   │ Payload:
   │ {
   │   customer: "cus_...",
   │   billingType: "CREDIT_CARD",
   │   value: 150.00,
   │   dueDate: "2026-09-23",
   │   creditCard: { holderName, number, expiryMonth, expiryYear, ccv },
   │   creditCardHolderInfo: { name, email, cpfCnpj, postalCode, addressNumber, phone },
   │   installmentCount: 3,
   │   installmentValue: 50.00
   │ }
   ▼
[Resposta do Asaas]:
   ├── SE STATUS == 'CONFIRMED':
   │     ├── Atualiza Pedido no Banco: status = 'PAID', asaasPaymentStatus = 'CONFIRMED'
   │     ├── Salva metadados seguros: creditCardBrand (ex: VISA), creditCardLast4 (ex: 1234)
   │     ├── Credita pontos ganhos (creditEarnedPoints)
   │     ├── Envia e-mail de confirmação ao cliente (Resend)
   │     └── Retorna { success: true, status: 'PAID' } para o navegador
   │
   ├── SE STATUS == 'AWAITING_RISK_ANALYSIS':
   │     ├── Mantém Pedido em status 'PENDING', asaasPaymentStatus = 'AWAITING_RISK_ANALYSIS'
   │     └── Retorna mensagem: "Pagamento em análise de segurança. Avisaremos por e-mail."
   │
   └── SE ERRO / RECUSA DA OPERADORA:
         ├── Executa Rollback Atômico com performedById: 'SYSTEM'
         │     ├── Libera estoque reservado (InventoryService.restoreStock)
         │     ├── Estorna pontos resgatados (refundOrderPoints)
         │     └── Marca Pedido como 'CANCELLED'
         └── Retorna erro descritivo ao cliente (ex: "Transação não autorizada pelo banco emissor.")
```

---

## 12. Fluxo Detalhado de Boleto Bancário

```text
[Cliente]
   │ 1. Seleciona aba "Boleto Bancário" no Passo 3
   │ 2. Visualiza alerta: "Vencimento em 1 dia útil. Compensação em 1 a 3 dias úteis."
   │ 3. Clica em "Gerar Boleto Bancário"
   ▼
[Frontend - CheckoutForm.tsx]
   │ 4. Envio via HTTPS POST /api/checkout com paymentMethod = 'BOLETO'
   ▼
[API /api/checkout -> checkout.service.ts]
   │ 5. Transação Atômica no Banco de Dados:
   │    ├── Reserva estoque físico
   │    └── Cria Pedido com status 'PENDING', paymentMethod = 'BOLETO'
   │
   │ 6. Chamada ao Gateway Asaas (asaas.adapter.ts):
   ▼
[Asaas API v3: POST /v3/payments]
   │ Payload: { customer, billingType: "BOLETO", value, dueDate: now + 1 dia útil }
   │ Consulta auxiliar: GET /v3/payments/{id}/identificationField
   ▼
[Resposta do Asaas]:
   │ Retorna: paymentId, bankSlipUrl (PDF), identificationField (linha digitável), barCode
   │ 7. Atualiza Pedido no Banco:
   │    ├── asaasPaymentId = paymentId
   │    ├── asaasInvoiceUrl = bankSlipUrl
   │    ├── asaasDigitableLine = identificationField
   │    └── asaasBarCode = barCode
   ▼
[Retorno para UI]:
   │ 8. Exibe na tela e envia por e-mail:
   │    ├── Botão "Visualizar / Imprimir Boleto em PDF"
   │    ├── Linha digitável com botão "Copiar Código do Boleto"
   │    └── Código de barras legível
   ▼
[Ciclo Pós-Emissão via Webhook Asaas]:
   ├── SE PAGO NO BANCO:
   │     ├── Asaas recebe compensação bancária (D+1 ou D+2)
   │     ├── Dispara Webhook: PAYMENT_RECEIVED ou PAYMENT_CONFIRMED
   │     ├── Endpoint /api/webhooks/asaas transiciona Pedido para 'PAID'
   │     ├── Credita pontos de fidelidade
   │     └── Dispara e-mail de confirmação de pagamento
   │
   └── SE NÃO FOR PAGO ATÉ O VENCIMENTO:
         ├── Asaas detecta expiração da data limite
         ├── Dispara Webhook: PAYMENT_OVERDUE
         ├── Endpoint transiciona Pedido para 'CANCELLED'
         ├── Estorna o estoque físico para a loja
         └── Estorna pontos de fidelidade resgatados
```

---

## 13. Modelo de Estados e Transições Financeiras

### Matriz de Mapeamento: `AsaasPaymentStatus` × `OrderStatus`

| Estado Asaas | Significado no Gateway | Status no Pedido (`OrderStatus`) | Pode Avançar Para | Pode Retornar? | Impacto no Estoque / Pontos |
| :--- | :--- | :---: | :--- | :---: | :--- |
| `PENDING` | Cobrança criada, aguardando pagamento | `PENDING` | `PAID`, `CANCELLED` | Não | Estoque reservado; pontos resgatados retidos. |
| `AWAITING_RISK_ANALYSIS` | Cartão em análise de segurança antifraude | `PENDING` | `PAID`, `CANCELLED` | Não | Estoque permanece reservado sem liberar despacho. |
| `CONFIRMED` | Cartão aprovado online ou Boleto liquidado | `PAID` | `SHIPPED`, `CANCELLED` | Não | Confirma estoque definitivamente; credita pontos ganhos. |
| `RECEIVED` | Dinheiro creditado na conta do Asaas | `PAID` | `SHIPPED`, `CANCELLED` | Não | Confirma estoque definitivamente; credita pontos ganhos. |
| `OVERDUE` | Boleto ou PIX venceu sem pagamento | `CANCELLED` | Nenhum (Terminal) | Não | **Estorna estoque físico** e **estorna pontos resgatados**. |
| `REFUNDED` | Pagamento estornado ao comprador | `CANCELLED` | Nenhum (Terminal) | Não | Estorna pontos creditados; registra alerta administrativo. |
| `CHARGEBACK_REQUESTED` | Comprador contestou a compra no cartão | `PAID` (com alerta) | `CANCELLED` (se perdido) | Sim | Bloqueia novas compras do cliente; alerta imediato no dashboard. |

---

## 14. Segurança e Conformidade PCI-DSS

```text
┌──────────────────────────────────────────────────────────────────────────┐
│                  DIRETRIZES DE SEGURANÇA E PCI-DSS                       │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  [DADOS PROIBIDOS DE GRAVAR EM DISCO / BANCO / LOGS]                    │
│  ├── NUNCA armazenar o Código de Segurança (CVV/CVC)                     │
│  ├── NUNCA armazenar o Número Completo do Cartão (PAN)                   │
│  └── NUNCA armazenar a Data de Validade completa vinculada ao CVV         │
│                                                                          │
│  [DADOS PERMITIDOS PARA PERSISTÊNCIA HISTÓRICA]                          │
│  ├── Bandeira do cartão (ex: "VISA", "MASTERCARD", "ELO")                │
│  ├── Últimos 4 dígitos do cartão (ex: "1234")                            │
│  ├── Quantidade de parcelas e valor da parcela                           │
│  └── Identificador de transação do Asaas (ex: "pay_987654321")           │
│                                                                          │
│  [TRÂNSITO E CRIPTOGRAFIA]                                               │
│  ├── Comunicação estritamente sobre HTTPS / TLS 1.3                      │
│  ├── Validação de integridade de payloads via Zod                        │
│  └── Máscara automática em lib/logger.ts para dados sensíveis            │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 15. Persistência e Alterações no Banco de Dados

### 15.1. Novas Colunas no Model `Order` (`prisma/schema.prisma`)

As seguintes colunas devem ser adicionadas ao modelo `Order` de forma retrocompatível (todas opcionais / `nullable`), sem afetar nenhum pedido legados:

```prisma
// Campos de Cartão de Crédito e Boleto (Asaas Expansion)
creditCardBrand       String?              // Bandeira: "VISA", "MASTERCARD", "ELO", etc.
creditCardLast4       String?              // Últimos 4 dígitos: "1234"
installments          Int?                 @default(1) // Número de parcelas
installmentValue      Decimal?             @db.Decimal(10, 2) // Valor de cada parcela

// Metadados de Boleto Bancário
asaasBankSlipUrl      String?              // URL do PDF oficial do boleto
asaasDigitableLine    String?              // Linha digitável (Cópia e Cola de 47/48 dígitos)
asaasBarCode          String?              // Código de barras numérico
asaasDueDate          DateTime?            // Data de vencimento efetiva
```

> [!TIP]
> **Estratégia de Migration Segura:**  
> A migração deve ser gerada via `npx prisma migrate dev` adicionando campos com cláusula `NULL`. Nenhuma coluna existente será modificada ou renomeada. O campo `paymentMethod` continuará recebendo valores em String (`'PIX'`, `'CREDIT_CARD'`, `'BOLETO'`, `'WHATSAPP_PIX'`).

---

## 16. Gestão de Riscos

| Risco | Nível | Evidência / Cenário | Impacto | Mitigação Arquitetural | Responsável |
| :--- | :---: | :--- | :--- | :--- | :--- |
| **Piso Mínimo do Asaas** | `ALTO` | Carrinho com total < R$ 5,00 submetido ao Asaas | Falha 400 com erro na tela | Validação preventiva no frontend e no Zod bloqueando < R$ 5,00 | Agente 4 (Backend) |
| **Vazamento de Cartão (PCI)** | `CRÍTICO` | CVV ou número de cartão salvo no banco ou log | Multas graves e não-conformidade | Sanitizador no logger e exclusão de campos no schema Prisma | Agente 6 (Security) |
| **Estoque Preso em Boleto** | `MÉDIO` | Cliente gera boleto e não paga | Estoque retido por 3 dias | Worker de timeout e cancelamento por webhook `PAYMENT_OVERDUE` | Agente 2 (Payment) |
| **Fraude em Cartão (Chargeback)** | `ALTO` | Transação fraudulenta contestada | Perda da mercadoria e chargeback | Análise de risco nativa do Asaas (`AWAITING_RISK_ANALYSIS`) | Agente 2 (Payment) |
| **Bug no Rollback de Auditoria** | `MÉDIO` | `performedById: 'CHECKOUT_PAYMENT_FAILURE'` viola FK | Pedido fica órfão em `PENDING` | Padronizar `performedById: 'SYSTEM'` no rollback | Agente 4 (Backend) |
| **Timing Attack em Webhook** | `BAIXO` | Comparação de token suscetível a timing | Invasão potencial | Manter `crypto.timingSafeEqual` obrigatório | Agente 6 (Security) |

---

## 17. Decisões Homologadas pelo Lojista & Diretrizes de Parametrização Flexível

As três decisões comerciais e financeiras foram formalmente deliberadas e homologadas pelo lojista. A arquitetura de software deve ser construída com **total parametrização dinâmica**, permitindo que o lojista ajuste ou alterne essas regras no futuro sem necessidade de refatoração de código:

### Decisão 1: Política de Juros no Parcelamento em Cartão de Crédito
* **Deliberação do Lojista:**  
  > *"A princípio vamos repassar as taxas de parcelamento ao comprador, contudo pode ser que meu cliente posteriormente queira absorver as taxas do Asaas oferecendo parcelamento 'sem juros', então você deve deixar este sistema preparado para esta possível mudança no futuro."*
* **Diretriz Arquitetural de Implementação:**
  * O sistema contará com uma camada de configuração de pagamento (`lib/config/payment.config.ts` com fallback para variáveis de ambiente ou tabela `Loja`):
    * `INSTALLMENT_ABSORB_FEES: false` (Padrão inicial: juros/taxas repassadas ao comprador na composição das parcelas);
    * `INSTALLMENT_MAX_COUNT: 12` (Máximo de 12 parcelas);
    * `INSTALLMENT_MONTHLY_RATE: 0.0299` (Taxa mensal padrão de 2,99% ao mês ou taxa contratada no Asaas).
  * O motor de cálculo de parcelas (`services/payment/installment.service.ts`) verificará a flag `INSTALLMENT_ABSORB_FEES`:
    * Se `false`: Aplica o coeficiente de financiamento/juros da tabela Asaas nas parcelas a partir da 2ª parcela e exibe na tela: `2x de R$ XX,XX com juros`;
    * Se `true` (futuro): Divide o valor total diretamente pelo número de parcelas (`total / N`) e exibe: `Nx de R$ XX,XX sem juros`.
  * A troca de comportamento exigirá apenas a alteração de uma flag (`true`/`false`), garantindo 100% de flexibilidade futura.

### Decisão 2: Prazo de Vencimento do Boleto Bancário
* **Deliberação do Lojista:**  
  > *"Vamos dar como prazo 1 dia útil (para não reter o estoque físico da loja por muito tempo)."*
* **Diretriz Arquitetural de Implementação:**
  * O cálculo da data de vencimento (`dueDate`) no momento da emissão do boleto via `AsaasPaymentAdapter` adotará estritamente **1 dia útil**:
    * Emissão de Segunda a Quinta: Vencimento no dia seguinte (D+1);
    * Emissão na Sexta-feira: Vencimento na Segunda-feira subsequente;
    * Emissão no Sábado ou Domingo: Vencimento na Terça-feira subsequente.
  * O worker de timeout e a escuta do webhook `PAYMENT_OVERDUE` cancelarão pedidos e liberarão o estoque no dia útil subsequente caso o pagamento não seja identificado, minimizando a retenção de produtos no estoque da Continental.

### Decisão 3: Valor Mínimo da Parcela
* **Deliberação do Lojista:**  
  > *"Vamos definir o valor de R$ 20,00 neste momento, contudo pode ser que meu cliente queira alterar este valor mínimo, tanto para cima como para baixo, então o sistema deve estar preparado para essa alteração."*
* **Diretriz Arquitetural de Implementação:**
  * O valor mínimo da parcela será parametrizado como uma constante/variável configurável:
    `INSTALLMENT_MIN_VALUE = 20.00` (com suporte a override via ambiente / banco).
  * O seletor de parcelas no frontend (`CheckoutForm.tsx`) limitará dinamicamente o número máximo de parcelas disponíveis utilizando a fórmula:
    $$\text{maxParcelasPermitidas} = \min\left(12, \max\left(1, \left\lfloor \frac{\text{total}}{\text{INSTALLMENT\_MIN\_VALUE}} \right\rfloor\right)\right)$$
    * *Exemplo 1 (Compra de R$ 50,00):* Limita a até 2x de R$ 25,00 (não exibe opções de 3x ou 4x).
    * *Exemplo 2 (Compra de R$ 100,00):* Permite até 5x de R$ 20,00.
    * *Exemplo 3 (Compra de R$ 240,00):* Permite até 12x de R$ 20,00.
  * Caso o lojista decida no futuro alterar esse piso para R$ 10,00, R$ 30,00 ou R$ 50,00, a alteração no parâmetro refletirá automaticamente em todo o catálogo e checkout da loja.

---

## 18. Critérios de Aceite por Meio de Pagamento

### 18.1. Critérios de Aceite: Cartão de Crédito
- [ ] **AC-CC-01 (Validação de Formulário):** O checkout deve rejeitar números de cartão inválidos via algoritmo de Luhn, datas de validade passadas e códigos CVV com menos de 3 dígitos antes de chamar a API.
- [ ] **AC-CC-02 (Aprovação Imediata):** Ao submeter um cartão válido com saldo, a transação deve ser aprovada na hora, o status do pedido deve atualizar para `PAID`, o estoque deve ser confirmado, os pontos de fidelidade devem ser creditados e o e-mail de confirmação enviado.
- [ ] **AC-CC-03 (Recusa com Feedback Claro):** Se a operadora recusar o pagamento (saldo insuficiente, cartão bloqueado), o sistema deve cancelar o pedido no banco, liberar o estoque reservado e exibir a mensagem real da operadora de forma amigável (sem frases genéricas de "verifique seus dados").
- [ ] **AC-CC-04 (Parcelamento Correto & Repasse de Juros):** O seletor de parcelas deve respeitar o valor mínimo de R$ 20,00 por parcela, repassando as taxas ao comprador conforme configurado e calculando com exatidão o valor de cada prestação, mantendo a arquitetura pronta para alternar para modo "sem juros" via flag.
- [ ] **AC-CC-05 (Conformidade PCI-DSS):** O banco de dados e os logs estruturados não devem conter o número completo do cartão nem o código CVV em nenhum momento.

### 18.2. Critérios de Aceite: Boleto Bancário
- [ ] **AC-BOL-01 (Geração Completa):** Ao selecionar Boleto, o sistema deve gerar e retornar: Link para o PDF do boleto (`bankSlipUrl`), Linha Digitável de 47/48 dígitos e Código de Barras numérico.
- [ ] **AC-BOL-02 (Disponibilização Visual):** A tela de sucesso pós-pedido e o e-mail transacional devem exibir botão direto para abrir o boleto e botão de 1 clique para copiar a linha digitável.
- [ ] **AC-BOL-03 (Compensação Assíncrona):** Quando o cliente pagar o boleto e o Asaas enviar o webhook `PAYMENT_RECEIVED` ou `PAYMENT_CONFIRMED`, o pedido deve transicionar para `PAID` sem qualquer intervenção manual.
- [ ] **AC-BOL-04 (Expiração e Estorno em 1 Dia Útil):** Se o boleto não for pago até a data de vencimento (1 dia útil) e o Asaas enviar `PAYMENT_OVERDUE`, o pedido deve ser cancelado automaticamente, o estoque físico liberado e os pontos resgatados estornados ao cliente.

---

## 19. Estratégia de Rollback

Em caso de incidentes críticos durante o processo de deploy ou homologação:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        PLANO DE ROLLBACK TÉCNICO                       │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  1. INCIDENTE NO FRONTEND (Checkout quebrado ou instável):             │
│     * Procedimento: Reverter o componente CheckoutForm.tsx para exibir │
│       apenas a aba de PIX, desabilitando as abas de Cartão e Boleto    │
│       via feature flag (ex: ENABLE_CREDIT_CARD=false).                 │
│     * Impacto: A loja volta imediatamente ao modo operacional PIX.     │
│                                                                        │
│  2. INCIDENTE NO GATEWAY ASAAS (Erros 500 no processamento de cartão): │
│     * Procedimento: O backend rejeita a tentativa e executa o rollback │
│       atômico do pedido (liberação de estoque e estorno de pontos).    │
│     * Impacto: Nenhum estoque fica retido indevidamente.               │
│                                                                        │
│  3. INCONSISTÊNCIA NO BANCO DE DADOS:                                  │
│     * Procedimento: Como as novas colunas adicionadas ao model Order   │
│       são opcionais (nullable), a remoção ou não preenchimento delas   │
│       não afeta nenhuma query existente.                               │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 20. Checklist Pré-Produção

Antes de autorizar a primeira transação de cliente final com Cartão ou Boleto:

- [ ] Todas as 10 Fases do Workflow foram formalmente executadas e validadas;
- [ ] Credenciais de produção do Asaas (`ASAAS_API_KEY`, `ASAAS_API_URL`, `ASAAS_WEBHOOK_TOKEN`) ativas no painel da Vercel;
- [ ] Webhook do Asaas configurado em produção apontando para `https://continental-prototipo.vercel.app/api/webhooks/asaas`;
- [ ] Todos os eventos de webhook (`PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`) marcados no painel Asaas;
- [ ] Suíte de testes unitários com 100% de sucesso (mínimo de 350 testes aprovados);
- [ ] Compilação TypeScript estrita (`npx tsc --noEmit`) com 0 erros;
- [ ] Verificação de que nenhum dado de CVV ou número completo de cartão é registrado em log ou banco;
- [ ] Smoke Test real de R$ 5,00 via PIX homologado;
- [ ] Smoke Test real de Cartão de Crédito aprovado e liquidado;
- [ ] Smoke Test de Boleto Bancário com emissão de PDF e código de barras conferido.

---

## 21. Sequência Final de Execução (Roteiro para a Próxima Etapa)

Quando o lojista fornecer a instrução:
> **"Execute o workflow aprovado de Cartão e Boleto"**

A equipe de agentes seguirá a seguinte ordem de execução estrita:

```text
1. Agente 1 (Architect)       ➔ Expande types/payment-gateway.types.ts e types/asaas.types.ts
2. Agente 6 (Security)        ➔ Audita os novos tipos e valida diretriz PCI-DSS
3. Agente 3 (Gateway)         ➔ Implementa chamadas no asaas.client.ts e asaas.adapter.ts
4. Agente 4 (Backend)         ➔ Atualiza prisma/schema.prisma, checkout.service.ts e validators
5. Agente 5 (Frontend)        ➔ Constrói o seletor visual em 3 abas no CheckoutForm.tsx
6. Agente 2 (Payment Domain)  ➔ Atualiza o processamento de webhooks em app/api/webhooks/asaas/
7. Agente 7 (QA Engineer)     ➔ Cria e executa testes unitários de Cartão e Boleto
8. Agente 8 (SecOps)          ➔ Verifica logs, telemetria e validação em homologação
9. Tech Lead / Usuário        ➔ Executa os Smoke Tests reais e libera o Go-Live
```

---
*Documento de Arquitetura e Workflow de Implementação finalizado, validado e arquivado em `diversos/PALENJAMENTO_BANCO/Correcao/correcao_2/`.*
