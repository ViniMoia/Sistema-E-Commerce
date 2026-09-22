# Workflow de Correção: Sistema de Pagamento (Timeout de PIX & Notificações de Pagamento)
## Orquestração Multi-Agente com Model Context Protocol (MCP) & Ruflo Swarm

**Projeto:** E-Commerce Multi-Tenant & Plataforma Continental Produtos Estéticos Automotivos  
**Versão do Workflow:** 2.0 (Refatorada com Integração Completa de MCPs)  
**Data:** 22 de Setembro de 2026  
**Documento de Origem:** `RELATORIO_AUDITORIA_PRONTIDAO_PRODUCAO.md`  
**Escopo Restrito:**  
- **PEND-FIN-003:** Cancelamento Automático por Timeout de PIX e Liberação de Recursos (Estoque e Fidelidade)  
- **PEND-COM-002:** Notificação Transacional de Confirmação de Pagamento ao Cliente via E-mail  
**Status:** Aguardando Autorização do Usuário para Início da Implementação  

---

## 1. Contexto e Deliberações Estratégicas

Com base nas decisões homologadas pelo responsável pelo projeto:
1. **ACT-P0-03 (Smoke Test / Homologação Real Ponta a Ponta):** Será executado manualmente pelo desenvolvedor em ambiente de produção em momento posterior.
2. **PEND-FIN-002 (Destino e Saque dos Valores Recebidos):** **Despriorizado e removido do escopo técnico**. O lojista manterá os valores na conta digital do Asaas, operando saques e transferências diretamente pelo portal/aplicativo do Asaas.
3. **Escopo Ativo Deste Workflow:** Resolver definitiva e robustamente o cancelamento automático de pedidos não pagos (eliminando retenção indevida de estoque e de pontos) e a comunicação formal transacional ao comprador após a liquidação do pagamento PIX.

---

## 2. Princípios Norteadores da Correção

A implementação futura deste workflow é estritamente regida por três pilares de engenharia de software:

### 2.1 Princípio 1: Respeito à Arquitetura Existente do Projeto
- **Next.js 16 (App Router) & Prisma ORM:** Totalmente compatível com a estrutura de rotas do App Router e o schema PostgreSQL no Supabase.
- **Reutilização da FSM Existente:** O cancelamento de pedidos **não** recria regras atômicas de forma isolada; aciona `updateOrderStatus` (`services/order.service.ts`), que já executa o estorno de estoque (`InventoryService.restoreStock`) e a devolução contábil no ledger de fidelidade (`refundOrderPoints`).
- **Isolamento Multi-Tenant:** Preservação estrita do contexto de loja (`lojaID`) em todas as queries do Prisma, logs de auditoria e renderização de templates de e-mail.
- **Observabilidade:** Registro no logger estruturado (`lib/logger.ts`) e auditoria persistida no banco (`AuditLog`).

### 2.2 Princípio 2: Respeito aos Padrões de Segurança Corporativa
- **Proteção do Cron contra Invocação Externa:** O endpoint de execução do timeout (`/api/cron/orders-timeout`) é protegido por cabeçalho `Authorization: Bearer <CRON_SECRET>`.
- **Mitigação de Timing Attacks:** Validação do token de autenticação via comparação de buffers em tempo constante (`crypto.timingSafeEqual`).
- **Fail-Closed:** Se `CRON_SECRET` não estiver configurado no servidor ou se o token recebido divergir, a rota aborta imediatamente com HTTP 401/500 antes de consultar o banco de dados.
- **Sanitização contra Injeção de E-mail / XSS:** Sanitização rigorosa de entradas de texto nos templates HTML de e-mail (evitando injeção de tags em clientes de e-mail).
- **Trilha de Auditoria AuditLog:** Registro com `actorId: "SYSTEM_CRON_TIMEOUT"` para cada pedido cancelado automaticamente.
- **Idempotência & Resiliência Concorrente:** Tratamento de colisão para o caso de um webhook de pagamento do Asaas chegar no mesmo instante em que a rotina de timeout tenta cancelar o pedido.

### 2.3 Princípio 3: Princípios SOLID e Escalabilidade
- **Single Responsibility Principle (SRP):**
  - Controller HTTP (`app/api/cron/orders-timeout/route.ts`): autentica e orquestra a chamada.
  - Serviço de Domínio (`services/order-timeout.service.ts`): localiza pedidos elegíveis e dispara a transição.
  - Template e Mensageria (`lib/email/`): isolamento visual e envio pelo provedor.
- **Open/Closed Principle (OCP):** Políticas de expiração baseadas em estratégias (60 min para Asaas PIX; 24h para WhatsApp PIX), extensíveis sem modificar o loop central.
- **Liskov Substitution Principle (LSP):** `ResendEmailService`, `DevEmailService` e mocks implementam `IEmailService` de forma intercambiável.
- **Interface Segregation Principle (ISP):** Interfaces enxutas (`OrderPaymentConfirmedEmailParams`, `OrderTimeoutResult`).
- **Dependency Inversion Principle (DIP):** Webhook e serviços dependem da interface `IEmailService`, permitindo mocks determinísticos em testes.
- **Escalabilidade & Batching:**
  - Processamento em lotes (*batch chunks* de até 50 pedidos) com transações atômicas individuais por pedido para evitar locks prolongados no banco Supabase.
  - Disparo de e-mails no webhook de forma desacoplada (*non-blocking / fire-and-forget* seguro) para responder ao Asaas em menos de 100ms.

---

## 3. Matriz do Ecossistema MCP Instalado

Para garantir velocidade analítica, segurança estrita e cobertura à prova de falhas, utilizaremos as ferramentas dos **6 servidores MCP instalados no ambiente**:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        MATRIZ DE SERVIDORES MCP & ATRIBUIÇÕES                          │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│  [1. RUFLO MCP SUITE (Orquestração, Segurança & Análise Estática)]                     │
│  ├── swarm_init / hive-mind_consensus ──► Orquestração do time e consenso arquitetural │
│  ├── metaharness_threat_model         ──► Modelagem de ameaças e blindagem do Cron     │
│  ├── metaharness_security_bench       ──► Verificação de conformidade OWASP / ASVS     │
│  ├── aidefence_scan / aidefence_has_pii──► Detecção de injeção em HTML e vazamento PII │
│  ├── analyze_file-risk / boundaries   ──► Verificação estática de acoplamento SOLID    │
│  └── performance_bottleneck           ──► Análise de contenção de locks e batch queries│
│                                                                                        │
│  [2. SEQUENTIAL-THINKING MCP (Raciocínio Algorítmico & FSM)]                           │
│  └── sequentialthinking               ──► Decomposição lógica da máquina de estados,   │
│                                           reserva de estoque e concorrência no timeout │
│                                                                                        │
│  [3. POSTGRES MCP (Inspeção de Dados & Performance)]                                   │
│  └── postgres queries / explain       ──► Validação de planos de execução de índices,  │
│                                           integridade referencial e auditoria relacional│
│                                                                                        │
│  [4. PUPPETEER MCP (Validação Visual End-to-End)]                                      │
│  └── puppeteer screenshot / evaluate  ──► Renderização do e-mail HTML Continental Dark │
│                                           em navegadores reais (desktop e mobile)      │
│                                                                                        │
│  [5. GIT MCP (Controle de Versão & Rastreabilidade)]                                   │
│  └── git branch / status / diff       ──► Rastreabilidade atômica de commits e staging │
│                                                                                        │
│  [6. MEMORY MCP (Grafo de Conhecimento & Decisões)]                                    │
│  └── memory create_entities / read    ──► Persistência de invariantes de negócio e     │
│                                           decisões compartilhadas entre os agentes     │
│                                                                                        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Coordenação da Equipe de Agentes e Operação dos MCPs

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│               ORQUESTRADOR: STAFF ARCHITECT & TECH LEAD                                │
│               MCPs: ruflo (swarm_init, hive-mind), memory, git                         │
└───────┬────────────────────────┬───────────────────────┬───────────────────────────────┘
        │                        │                       │
        ▼                        ▼                       ▼
┌──────────────┐         ┌──────────────┐        ┌──────────────┐
│   AGENTE 1   │         │   AGENTE 2   │        │   AGENTE 3   │
│   Backend    │         │  Mensageria  │        │  Segurança   │
│  & Timeout   │         │  & Templates │        │   & SecOps   │
│  MCPs:       │         │  MCPs:       │        │  MCPs:       │
│  sequential, │         │  puppeteer,  │        │  metaharness,│
│  postgres,   │         │  aidefence,  │        │  aidefence,  │
│  bottleneck  │         │  boundaries  │        │  security    │
└───────┬──────┘         └───────┬──────┘        └───────┬──────┘
        │                        │                       │
        └────────────────────────┼───────────────────────┘
                                 │
                                 ▼
                         ┌──────────────┐
                         │   AGENTE 4   │
                         │      QA      │
                         │ & Automação  │
                         │  MCPs:       │
                         │  ruflo test, │
                         │  git diff    │
                         └──────────────┘
```

### 4.1 Orquestrador: Staff Software Architect & Tech Lead
- **Objetivo:** Coordenar o ciclo de vida da correção, estabelecer os contratos entre os agentes e garantir a convergência de decisões.
- **MCPs Operados:**
  - `ruflo:swarm_init`: Inicializa o enxame de agentes com topologia em malha e metas sincronizadas.
  - `ruflo:hive-mind_consensus`: Submete decisões de fronteira (ex: janelas de timeout de 60m vs 24h) ao consenso dos agentes peritos.
  - `memory:create_entities` / `memory:create_relations`: Registra os invariantes contábeis no grafo de conhecimento.
  - `git:git_branch` / `git:git_status`: Cria branch de trabalho limpa (`feat/payment-timeout-notification`).

### 4.2 Agente 1: Engenheiro de Backend / Core Domain (Order & Timeout Specialist)
- **Objetivo:** Construir o serviço de timeout e cancelamento em lote com estorno atômico de recursos.
- **MCPs Operados:**
  - `sequential-thinking:sequentialthinking`: Modela o pipeline da FSM passo a passo (identificação de pedidos expirados -> trava de lock individual -> rollback de estoque no `InventoryService` -> estorno de pontos no `refundOrderPoints` -> atualização para `CANCELLED`).
  - `postgres:query`: Executa `EXPLAIN ANALYZE` na query de busca de pedidos `PENDING` para verificar o uso eficiente do índice composto `[status, createdAt]` e checar integridade das tabelas `Order`, `InventoryMovement` e `LoyaltyTransaction`.
  - `ruflo:performance_bottleneck`: Analisa a contenção de conexões no Supabase Connection Pooler durante o cancelamento em batches de 50 registros.

### 4.3 Agente 2: Especialista em Mensageria & Notificações (Email Specialist)
- **Objetivo:** Criar e integrar o template de confirmação de pagamento e estender os contratos de envio.
- **MCPs Operados:**
  - `puppeteer:puppeteer_navigate` / `puppeteer:screenshot`: Renderiza o HTML compilado de `order-payment-confirmed.template.ts` em viewport desktop (1280x800) e mobile (375x667), validando o contraste da paleta Continental Dark com dourado `#DDAF02`.
  - `ruflo:aidefence_scan`: Escaneia o template de e-mail em busca de injeções de conteúdo ou HTML quebrado em tags dinâmicas (`customerName`, `productName`).
  - `ruflo:analyze_boundaries`: Garante que `lib/email/` não dependa de camadas superiores de UI do frontend ou do Next.js Request Context, respeitando o princípio DIP.

### 4.4 Agente 3: Engenheiro de Segurança & SecOps (Security Specialist)
- **Objetivo:** Blindar o endpoint de Cron, garantir tempo constante nas checagens de token e prevenir vazamento de dados sensíveis.
- **MCPs Operados:**
  - `ruflo:metaharness_threat_model`: Realiza a modelagem de ameaças da rota `/api/cron/orders-timeout` (vetores de spoofing, exaustão de CPU e timing attacks).
  - `ruflo:metaharness_security_bench`: Valida conformidade OWASP A01 (Broken Access Control) e A07 (Identification and Authentication Failures).
  - `ruflo:aidefence_has_pii`: Audita os payloads de resposta do cron e os logs gerados em `lib/logger.ts`, garantindo que CPFs, tokens e nomes completos não vazem em logs públicos.

### 4.5 Agente 4: Engenheiro de Qualidade & Testes (QA Specialist)
- **Objetivo:** Desenvolver e executar os testes unitários e de integração, garantindo 100% de sucesso contínuo na suíte.
- **MCPs Operados:**
  - `ruflo:test_runner`: Executa seletivamente as suítes de testes Vitest (`order-timeout.test.ts`, `cron-orders-timeout.test.ts`, `order-payment-email.test.ts`).
  - `git:git_diff`: Inspeciona os diffs linha a linha para assegurar que nenhum efeito colateral não intencional foi introduzido.

---

## 5. Roteiro Passo a Passo de Execução com MCPs

Cada fase descreve os artefatos a serem criados, a ferramenta MCP acionada, os dados de entrada, a saída esperada e o gate de aprovação:

```
[FASE 1: PREPARAÇÃO, TOPOLOGIA SWARM & CONTRATOS]
├── Aciona ruflo:swarm_init & memory
└── Cria contratos em lib/email/email.types.ts

[FASE 2: CONSTRUÇÃO DO MOTOR DE TIMEOUT & CANCELAMENTO]
├── Aciona sequential-thinking & postgres
├── Constrói services/order-timeout.service.ts
└── Aciona ruflo:performance_bottleneck

[FASE 3: CONSTRUÇÃO DO ENDPOINT DE CRON & BLINDAGEM SECOPS]
├── Aciona ruflo:metaharness_threat_model & security_bench
├── Constrói app/api/cron/orders-timeout/route.ts
└── Aciona ruflo:aidefence_has_pii

[FASE 4: TEMPLATE DE E-MAIL TRANSACIONAL & VALIDAÇÃO VISUAL]
├── Constrói lib/email/templates/order-payment-confirmed.template.ts
├── Atualiza lib/email/providers/resend.provider.ts & dev.provider.ts
└── Aciona puppeteer:screenshot para inspeção visual do layout

[FASE 5: INTEGRAÇÃO NO WEBHOOK ASAAS & DESACOPLAMENTO]
├── Integra disparo em app/api/webhooks/asaas/route.ts
└── Aciona ruflo:analyze_boundaries para validação SOLID

[FASE 6: BATERIA COMPLETA DE TESTES & VERIFICAÇÃO DE REGRESSÃO]
├── Executa Vitest (269 testes pré-existentes + novos testes)
├── Executa npx tsc --noEmit e npm run lint
└── Aciona git:git_diff para validação final
```

### Detalhamento por Fase:

#### Fase 1: Preparação, Topologia Swarm & Contratos
1. **Ativação MCP:**
   - Chamada a `ruflo:swarm_init` configurando topologia `mesh` entre `backend-agent`, `email-agent`, `secops-agent` e `qa-agent`.
   - Chamada a `memory:create_entities` para gravar os limites temporais do projeto:
     - `TIMEOUT_ASAAS_PIX = 60 minutos`
     - `TIMEOUT_MANUAL_PIX = 24 horas`
     - `BATCH_SIZE = 50 pedidos`
2. **Ação Técnica:**
   - Criação da tipagem em `lib/email/email.types.ts`:
     - `OrderPaymentConfirmedEmailParams`
     - Atualização da interface `IEmailService` com `sendOrderPaymentConfirmedEmail(params)`.
3. **Gate de Saída:** Compilação do TypeScript validada sem quebras em consumidores existentes.

#### Fase 2: Construção do Motor de Timeout & Cancelamento (PEND-FIN-003)
1. **Ativação MCP:**
   - Chamada a `sequential-thinking:sequentialthinking` para mapear a decomposição do ciclo de cancelamento:
     - Passo 1: Buscar pedidos `PENDING` criados antes do cutoff.
     - Passo 2: Iterar em série com tratamento de erro isolado por pedido.
     - Passo 3: Executar `updateOrderStatus({ newStatus: 'CANCELLED', performedById: 'SYSTEM_CRON_TIMEOUT' })`.
     - Passo 4: Retornar consolidado de sucesso/falhas.
   - Chamada a `postgres:query` para inspecionar o plano de execução (`EXPLAIN`) da consulta Prisma no Supabase, garantindo que o índice `[status, createdAt]` seja utilizado.
2. **Ação Técnica:**
   - Criação de `services/order-timeout.service.ts` com a função exportada `processExpiredOrders(options?: { batchSize?: number, lojaID?: string })`.
3. **Ativação MCP de Validação:**
   - Chamada a `ruflo:performance_bottleneck` para auditar riscos de lock prolongado no PostgreSQL.
4. **Gate de Saída:** Função testada unitariamente com mocks de Prisma e devolução comprovada de estoque e pontos.

#### Fase 3: Endpoint de Cron & Blindagem de Segurança
1. **Ativação MCP:**
   - Chamada a `ruflo:metaharness_threat_model` na rota `app/api/cron/orders-timeout/route.ts`:
     - Avaliação de risco de acesso não autenticado.
     - Verificação de ataques de timing na comparação do token Bearer.
2. **Ação Técnica:**
   - Criação de `app/api/cron/orders-timeout/route.ts` suportando métodos `GET` e `POST`.
   - Implementação da trava:
     ```typescript
     const expectedToken = process.env.CRON_SECRET;
     if (!expectedToken || !crypto.timingSafeEqual(Buffer.from(receivedToken), Buffer.from(expectedToken))) {
       return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
     }
     ```
3. **Ativação MCP de Validação:**
   - Chamada a `ruflo:aidefence_has_pii` na resposta JSON do endpoint para certificar que apenas métricas numéricas (`{ processed, cancelled, errors, executionTimeMs }`) são retornadas.
4. **Gate de Saída:** Requisições não autenticadas retornando HTTP 401 em tempo constante.

#### Fase 4: Template de E-mail Transacional & Validação Visual (PEND-COM-002)
1. **Ação Técnica:**
   - Criação de `lib/email/templates/order-payment-confirmed.template.ts` (HTML inline CSS, paleta Continental Dark `#121212` com dourado `#DDAF02`, resumo de itens, frete, pontos ganhos e link do pedido).
   - Implementação de `sendOrderPaymentConfirmedEmail` em `lib/email/providers/resend.provider.ts` e `lib/email/providers/dev.provider.ts`.
   - Exportação do helper `emailService.sendOrderPaymentConfirmedEmail` em `lib/email/index.ts`.
2. **Ativação MCP de Validação:**
   - Chamada a `puppeteer:puppeteer_navigate` carregando o HTML do template e executando `puppeteer:screenshot` para checagem visual de responsividade, contraste e legibilidade.
   - Chamada a `ruflo:aidefence_scan` no template garantindo escape de caracteres HTML especiais (`&`, `<`, `>`, `"`, `'`) nos dados dinâmicos injetados.
3. **Gate de Saída:** Template validado visualmente e imune a XSS.

#### Fase 5: Integração no Webhook Asaas & Desacoplamento
1. **Ação Técnica:**
   - Em `app/api/webhooks/asaas/route.ts`, conectar a chamada ao `emailService.sendOrderPaymentConfirmedEmail` imediatamente após a transição bem-sucedida para `PAID`.
   - Envolver o disparo em bloco isolado não-bloqueante:
     ```typescript
     // Disparo assíncrono não-bloqueante (fire-and-forget seguro)
     sendPaymentConfirmationEmail(order.id).catch((emailErr) => {
       logger.error('Falha ao enviar e-mail de confirmação de pagamento', emailErr, {
         action: 'PAYMENT_CONFIRMATION_EMAIL_FAILED',
         orderId: order.id,
       });
     });
     ```
2. **Ativação MCP de Validação:**
   - Chamada a `ruflo:analyze_boundaries` garantindo que o webhook não quebre sua resposta HTTP 200 caso o serviço de e-mail falhe ou esteja sem chave configurada.
3. **Gate de Saída:** Webhook Asaas respondendo HTTP 200 em < 100ms mesmo quando simulada falha na API do Resend.

#### Fase 6: Bateria Completa de Testes, Linter e Git Diff
1. **Ação Técnica:**
   - Criação dos seguintes arquivos de teste unitário:
     - `tests/unit/order-timeout.test.ts` (expiração Asaas 60m, expiração manual 24h, estorno de estoque com variantes, estorno de pontos no ledger, isolamento multi-tenant).
     - `tests/unit/cron-orders-timeout.test.ts` (segurança do Bearer token, timing attacks, método permitido).
     - `tests/unit/order-payment-email.test.ts` (renderização do HTML, sanitização anti-XSS, resiliência do webhook ante falhas do Resend).
2. **Ativação MCP de Validação:**
   - Chamada a `ruflo:test_runner` para rodar os 269 testes existentes + novos testes (meta: 100% de sucesso).
   - Execução de `git:git_diff` para inspecionar que nenhuma alteração não planejada ocorreu no repositório.
3. **Gate de Saída:** 100% dos testes aprovados, TypeScript limpo (`tsc --noEmit`), ESLint sem erros.

---

## 6. Critérios de Aceite e Homologação Final

- [ ] **Timeout Asaas PIX:** Pedidos `PENDING` com cobrança Asaas emitida há > 60 min são cancelados pelo endpoint do Cron, restaurando estoque e estornando pontos.
- [ ] **Timeout WhatsApp PIX:** Pedidos `PENDING` manuais criados há > 24 horas são cancelados pelo Cron, liberando recursos.
- [ ] **Segurança Estrita do Cron:** `/api/cron/orders-timeout` retorna HTTP 401 para qualquer requisição sem token Bearer válido, com checagem imune a timing attacks.
- [ ] **E-mail Transacional Aprovado:** Pagamento confirmado via webhook Asaas dispara e-mail com layout Continental Dark/Gold validado via Puppeteer.
- [ ] **Tolerância a Falhas de Mensageria:** Se o Resend estiver offline ou a chave `RESEND_API_KEY` ausente, o webhook Asaas processa a liquidação financeira com HTTP 200 sem interrupção.
- [ ] **Conformidade de Qualidade:** Todos os testes unitários aprovados, 0 erros no TypeScript e 0 violações de linter.

---
*Workflow v2.0 refatorado com a suíte de MCPs e pronto para execução sob autorização do usuário.*
