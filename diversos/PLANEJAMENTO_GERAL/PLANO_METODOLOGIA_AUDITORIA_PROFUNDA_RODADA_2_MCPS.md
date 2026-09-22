# Plano de Metodologia para Auditoria Profunda e Contínua do Sistema (Rodada 2)
## Inspeção Avançada de Concorrência, Pentest OWASP API 2023, FSM e MCP Swarm

**Data de Elaboração:** 16 de Setembro de 2026  
**Responsável Técnico:** Staff Software Engineer / Lead Security Auditor  
**Repositório:** `ecommerce-app` (Continental Produtos Estéticos Automotivos)  
**Destino do Documento:** `diversos/PLANEJAMENTO_GERAL/PLANO_METODOLOGIA_AUDITORIA_PROFUNDA_RODADA_2_MCPS.md`

---

## 1. Contexto e Objetivos da Rodada 2 de Auditoria

Com a implementação e homologação com 100% de êxito das correções das Fases 1 e 2 (**REV-001 a REV-005** e **AUD-001 a AUD-010**), o sistema alcançou um patamar robusto:
- 34 suítes de testes unitários com **222 testes passando (100%)**;
- Tipagem estrita TypeScript (`tsc --noEmit`) limpa com 0 erros;
- ESLint limpo com 0 erros;
- Build de produção Next.js 16.3.5 compilando todas as 48 rotas;
- Zero vulnerabilidades críticas ou altas no ecossistema npm.

O propósito desta **Rodada 2 de Auditoria Profunda** é realizar uma varredura ainda mais exaustiva, atuando como um time de segurança ofensiva (*Red Team*) e engenharia de resiliência (*Chaos Engineering*), com foco nas camadas mais profundas de domínio:

1. **Testes de Borda em Concorrência & Deadlocks no PostgreSQL:** Ordenação de locks em transações com múltiplos produtos e variantes, e race conditions em carrinhos simultâneos.
2. **Pentest OWASP API Security Top 10 (2023):** Varredura de contorno de Rate Limiting via injeção de headers de proxy (`X-Forwarded-For`, `CF-Connecting-IP`), segurança de cookies de sessão, manipulação de payloads no carrinho e exploração de BOLA/IDOR em rotas administrativas.
3. **Máquina de Estados Finita (FSM) & Edge Cases do Gateway Asaas:** Validação de transições anômalas em webhooks (ex: webhook de confirmação chegando para pedido já cancelado, retentativas concorrentes idênticas, estornos pós-entrega).
4. **Proteção LGPD & Superfície PII:** Auditoria de respostas de APIs e logs de auditoria contra vazamento de CPFs, telefones e e-mails de clientes.
5. **Modernização Arquitetural Next.js 16:** Migração da convenção depreciada `middleware.ts` para o novo padrão de `proxy.ts`, e verificação de índices e poolers de banco no Supabase.

> [!IMPORTANT]
> **COMPROMISSO DE GOVERNANÇA:** Em conformidade estrita com as instruções do usuário, nenhuma alteração de código ou execução invasiva da auditoria será iniciada sem a sua expressa permissão e autorização prévia sobre este plano.

---

## 2. Ecossistema MCP e Emprego Operacional das Ferramentas

Para esta Rodada 2, empregaremos as ferramentas do **Model Context Protocol (MCP)** providas pelo **RuFlo v3.42** de forma cirúrgica e parametrizada:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                   MATRIZ OPERACIONAL DE MCPS NA AUDITORIA RODADA 2                    │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│  [MCP: OFENSIVO & SEGURANÇA AVANÇADA]                                                  │
│  ├── metaharness_threat_model  ──► Modela vetores de ataque em FSM e Webhooks Asaas   │
│  ├── metaharness_security_bench──► Benchmark estrito contra OWASP API Security 2023    │
│  ├── aidefence_scan            ──► Detecta injeção de payloads e manipulação de sessão │
│  └── aidefence_has_pii         ──► Escaneia rotas e DTOs contra vazamento de dados PII │
│                                                                                        │
│  [MCP: ANÁLISE ESTÁTICA, COMPLEXIDADE & RISCO]                                         │
│  ├── analyze_file-risk         ──► Prioriza arquivos mais densos e propensos a falhas  │
│  ├── analyze_boundaries        ──► Mapeia o acoplamento entre Domínio, API e Prisma    │
│  └── analyze_complexity        ──► Isola funções com alta complexidade ciclomática    │
│                                                                                        │
│  [MCP: CONCORRÊNCIA, DESEMPENHO & BANCO DE DADOS]                                      │
│  ├── performance_bottleneck    ──► Diagnostica contenção de locks no Postgres/Prisma   │
│  └── agentdb_graph-query       ──► Inspeciona grafos relacionais e integridade refer.  │
│                                                                                        │
│  [MCP: ORQUESTRAÇÃO SWARM MULTI-AGENTE]                                                │
│  ├── swarm_init                ──► Inicializa a topologia Mesh de 4 Agentes Peritos    │
│  └── hive-mind_consensus       ──► Validação cruzada e classificação consensual (P0-P3)│
│                                                                                        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. As 5 Trilhas de Investigação da Rodada 2

A auditoria será estruturada em 5 trilhas técnicas com escopo aprofundado:

### Trilha 1: Segurança Ofensiva, Sessões & Pentest de API (OWASP 2023)
- **Ferramentas MCP:** `metaharness_security_bench`, `aidefence_scan`, `aidefence_has_pii`.
- **Focos Específicos:**
  1. **Bypass de Rate Limiting via Header Spoofing:** Inspecionar `lib/rate-limit.ts` para verificar se um invasor pode forjar `x-forwarded-for` com múltiplos IPs randômicos e contornar os limites de requisições de login, registro, checkout e polling.
  2. **Segurança de Cookies e Fixação de Sessão:** Checar atributos `HttpOnly`, `SameSite=Lax/Strict`, `Secure` e rotação do `sessionId` no login e logout em `lib/session.ts`.
  3. **Autorização a Nível de Objeto (BOLA/IDOR):** Varredura nos endpoints `/api/customers/[id]`, `/api/admin/users/[id]/role`, `/api/admin/orders/[orderId]/notes` e `/api/admin/orders/[orderId]/tracking`.
  4. **Proteção de Dados PII (LGPD):** Checar se endpoints públicos ou erros de validação Zod vazam dados sensíveis (hashes, CPFs não mascarados).

### Trilha 2: Integridade de Carrinho, Catálogo e Regras de Negócio
- **Ferramentas MCP:** `metaharness_threat_model`, `aidefence_scan`.
- **Focos Específicos:**
  1. **Manipulação de Itens no Carrinho (`/api/cart`):** Testar se é possível adicionar produtos inativos, produtos de outra loja (`cross-tenant cart`), quantidades negativas ou decimais (`quantity = -5` ou `0.5`), ou burlar a verificação de estoque no momento da adição.
  2. **Integridade de Cupons e Descontos:** Avaliar se descontos manuais, regras de frete grátis e resgate de fidelidade podem resultar em pedidos com total negativo (`total < 0`).
  3. **Persistência de Preço Autoritativo:** Garantir que nenhuma alteração nos dados do carrinho pelo cliente afete o cálculo do subtotal autoritativo no banco de dados.

### Trilha 3: Concorrência Extrema, Transações e Deadlocks no PostgreSQL
- **Ferramentas MCP:** `performance_bottleneck`, `performance_benchmark`.
- **Focos Específicos:**
  1. **Prevenção de Deadlocks em Pedidos com Múltiplos Itens:** Analisar se em `services/inventory.service.ts` a iteração sobre `items` segue uma ordenação determinística (ex: ordenada por `productId`). Se dois pedidos concorrentes tentarem travar o Produto A e Produto B em ordens invertidas (A depois B vs B depois A), pode ocorrer deadlock na transação do PostgreSQL.
  2. **Double-Spending Concorrente de Pontos de Fidelidade:** Avaliar a janela de concorrência se o cliente tentar submeter checkouts em paralelo em abas distintas usando o mesmo saldo de pontos.
  3. **Concorrência em Confirmação de Entrega (`confirm-delivery`):** Checar se dois cliques simultâneos do cliente podem registrar duplicidade no `auditLog`.

### Trilha 4: Máquina de Estados Finita (FSM) de Pedidos & Gateway Asaas
- **Ferramentas MCP:** `metaharness_threat_model`, `performance_bottleneck`.
- **Focos Específicos:**
  1. **Transições Anômalas de Estados:** O que ocorre se um webhook `PAYMENT_CONFIRMED` chegar após o pedido ter sido cancelado por timeout? Ele deve ser rejeitado ou gerar alerta administrativo para estorno manual no gateway?
  2. **Replay e Concorrência de Webhooks Idênticos:** Como a tabela `PaymentWebhookEvent` lida com requisições com o mesmo `eventId` enviadas simultaneamente antes da primeira escrita ser comitada?
  3. **Reconciliação e Cron de Limpeza:** Avaliar a necessidade de um endpoint agendado (ex: `/api/cron/reconcile-orders`) protegido por secret para limpar pedidos pendentes órfãos.

### Trilha 5: Modernização Next.js 16, Arquitetura Limpa & Performance
- **Ferramentas MCP:** `analyze_file-risk`, `analyze_boundaries`, `analyze_complexity`.
- **Focos Específicos:**
  1. **Migração do `middleware.ts` para `proxy.ts`:** O Next.js 16 emite aviso de depreciação para a convenção de middleware. Planejar a modernização para a convenção de Proxy recomendada.
  2. **Eficiência de Índices e Pooling do Supabase:** Verificar no `schema.prisma` se as chaves estrangeiras e campos de filtro recorrentes possuem índices B-Tree (`@@index([lojaID, status])`, etc.).
  3. **Vazamento de Memória em Rate Limiter:** Avaliar se o `rate-limit.ts` possui expiração de cache para evitar crescimento infinito do mapa em memória.

---

## 4. Agentes Especialistas Alocados (Swarm Mesh)

| Agente | Especialidade | Trilha Atribuída | Foco de Inspeção |
| :---: | :--- | :--- | :--- |
| **Red Team Agent** | *Security & Pentest Auditor* | Trilha 1 (OWASP & Auth) | Tentar contornar Rate Limit, spoofing de IP, fixação de sessão e IDOR. |
| **Business Logic Agent** | *Cart, Catalog & FinTech* | Trilha 2 (Carrinho & Negócio) | Testar integridade de valores de carrinho, itens inativos e cupons. |
| **Concurrency Agent** | *DB Locks & Deadlock Specialist* | Trilha 3 (Locks & Transações) | Analisar ordenação de locks de estoque e concorrência no Postgres. |
| **FSM & Gateway Agent** | *Payments & State Machine* | Trilha 4 (Asaas & Estados) | Validar resiliência a webhooks anômalos e reconciliação. |
| **Architecture Agent** | *Next.js 16 & Performance* | Trilha 5 (Clean Code & Proxy) | Analisar índices do Prisma, proxy do Next.js e consumo de memória. |

---

## 5. Entregável Final da Rodada 2

Ao término de todas as análises coordenadas pelos MCPs, será gerado o relatório técnico:  
📁 `diversos/PLANEJAMENTO_GERAL/RELATORIO_AUDITORIA_PROFUNDA_RODADA_2.md`

O relatório conterá:
1. **Quadro de Pontuação de Prontidão (Health Score);**
2. **Matriz de Vulnerabilidades Encontradas (AUD2-001, AUD2-002...);**
3. **Classificação CVSS / Severidade (P0 a P3);**
4. **Linhas de Código Exatas, Provas de Conceito (PoCs) e Impacto Operacional;**
5. **Recomendações e Plano de Resolução Sequencial.**

---

## 6. Ponto de Decisão e Próximo Passo

Este plano formaliza o método, as ferramentas MCP e o escopo investigativo da Rodada 2 de auditoria.

**Status Atual:** ⏳ **Aguardando autorização expressa do usuário para iniciar a execução da Rodada 2 da auditoria profunda.**
