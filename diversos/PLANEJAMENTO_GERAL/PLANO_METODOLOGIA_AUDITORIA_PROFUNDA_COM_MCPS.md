# Plano de Metodologia para Auditoria Completa e Profunda do Sistema
## Orquestração Avançada com Model Context Protocol (MCP) & Ruflo Swarm

**Data de Elaboração:** 16 de Setembro de 2026  
**Responsável Técnico:** Staff Software Engineer / Lead Security Auditor  
**Repositório:** `ecommerce-app` (Continental Produtos Estéticos Automotivos)  
**Destino do Documento:** `diversos/PLANEJAMENTO_GERAL/PLANO_METODOLOGIA_AUDITORIA_PROFUNDA_COM_MCPS.md`

---

## 1. Objetivo da Auditoria Profunda

Após a conclusão e homologação bem-sucedida dos 5 itens prioritários de correção pós-auditoria (**REV-001** a **REV-005**), este plano estabelece a metodologia técnica, as ferramentas especializadas de **Model Context Protocol (MCP)** e os critérios de inspeção para realizar uma **Auditoria Completa, Profunda e Multidimensional** em todo o sistema.

O objetivo é escanear exaustivamente o ecossistema da aplicação antes do lançamento em produção, identificando:
1. **Falhas Ocultas de Funcionamento / Negócio:** Race conditions residuais, edge cases de checkout, cálculo de frete, regras de concorrência e transações financeiras.
2. **Vulnerabilidades de Segurança (OWASP Top 10, CWE & ASVS):** Quebras de isolamento multi-tenant, autorização quebrada a nível de objeto (BOLA/IDOR), injeção de parâmetros, spoofing de cabeçalhos e exposição de dados sensíveis (PII/LGPD).
3. **Resiliência Arquitetural & Performance:** Conformidade SOLID, vazamentos de memória, N+1 queries no Prisma, dependências circulares e modernização para Next.js 16.

> [!IMPORTANT]
> **REGRA DE GOVERNANÇA:** Nenhuma alteração de código ou execução invasiva da auditoria será realizada antes da aprovação expressa do usuário sobre esta metodologia.

---

## 2. Ecossistema MCP e Ferramentas Especializadas Utilizadas

Para elevar a auditoria ao patamar de engenharia de segurança corporativa (*Infosec-grade*), utilizaremos o conjunto integrado de ferramentas MCP disponibilizado pelo **RuFlo v3.42** (`ruflo mcp exec` e subcomandos de análise), combinadas com as ferramentas nativas de análise do ambiente:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        SUÍTE MCP & MATRIZ DE FERRAMENTAS DE AUDITORIA                  │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│  [MCP: MODELAGEM & SEGURANÇA]                                                          │
│  ├── metaharness_threat_model  ──► Mapeamento formal de superfícies de ataque e riscos│
│  ├── metaharness_security_bench──► Benchmark estrito de vulnerabilidades OWASP / ASVS  │
│  ├── aidefence_scan            ──► Detecção de injeção, poluição de payload e ataques  │
│  └── aidefence_has_pii         ──► Identificação de vazamento de dados sensíveis/LGPD  │
│                                                                                        │
│  [MCP: ANÁLISE ESTÁTICA & RISCO DE CÓDIGO]                                             │
│  ├── analyze_file-risk         ──► Pontuação de risco por arquivo e camada de código  │
│  ├── analyze_deps --security   ──► Auditoria de vulnerabilidades de dependências (CVE)│
│  ├── analyze_circular          ──► Detecção de dependências circulares e acoplamento  │
│  └── analyze_boundaries        ──► Mapeamento de fronteiras arquiteturais e DDD       │
│                                                                                        │
│  [MCP: DESEMPENHO & BANCO DE DADOS]                                                    │
│  ├── performance_bottleneck    ──► Diagnóstico de contenção de locks e lentidões       │
│  └── agentdb_graph-query       ──► Consulta estruturada aos grafos de dados e entidades│
│                                                                                        │
│  [MCP: ORQUESTRAÇÃO MULTI-AGENTE (SWARM)]                                              │
│  ├── swarm_init                ──► Inicialização de topologia em malha (Mesh Topology) │
│  └── hive-mind_consensus       ──► Validação cruzada e consenso entre agentes peritos │
│                                                                                        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. As 5 Trilhas de Investigação da Auditoria Profunda

A auditoria será organizada em 5 trilhas de trabalho independentes e aprofundadas:

### Trilha 1: Segurança Ofensiva & Defensiva (OWASP Top 10 / ASVS)
- **MCPs Utilizados:** `metaharness_threat_model`, `metaharness_security_bench`, `aidefence_scan`, `aidefence_has_pii`.
- **Focos de Investigação:**
  1. **BOLA / IDOR:** Varredura em todas as rotas de API (`/api/orders/[id]`, `/api/customers/[id]`, `/api/admin/*`, `/api/loyalty/*`) para assegurar que um usuário não consiga acessar ou modificar recursos de outros usuários alterando IDs na URL.
  2. **Zero-Trust Multi-Tenancy:** Garantir que 100% das queries executadas pelo Prisma incluam o delimitador `lojaID`, sem possibilidade de contorno via injeção de cabeçalhos ou parâmetros `undefined`.
  3. **Proteção de Dados PII (LGPD):** Checagem contra log de senhas, hashes, CPFs ou tokens em `console.log`, respostas de erro da API ou traces de telemetria.
  4. **Controle de Sessão & Autenticação:** Validação da expiração de tokens JWT/Cookies de sessão, fluxo de logout, revogação de tokens de reset e políticas de CORS.

### Trilha 2: Integridade Financeira, Gateway Asaas & Webhooks
- **MCPs Utilizados:** `metaharness_threat_model`, `aidefence_scan`, `performance_bottleneck`.
- **Focos de Investigação:**
  1. **Validação Criptográfica de Webhooks:** Verificação se o webhook do Asaas (`/api/webhooks/asaas`) rejeita sumariamente (Fail-Closed com HTTP 401/500) qualquer requisição que não possua o token de autenticação exato (`asaas-access-token` vs `ASAAS_WEBHOOK_TOKEN`).
  2. **Idempotência de Pagamentos:** Garantir que webhooks duplicados enviados pelo Asaas (retentativas de rede) não gerem confirmações duplicadas, acréscimos indevidos de pontos de fidelidade ou inconsistências contábeis.
  3. **Arredondamento e Invariantes Monetárias:** Conferir se `total = subtotal - desconto + frete` é mantido sem divergência de ponto flutuante em todas as etapas (carrinho, checkout, gateway e pedido gravado).

### Trilha 3: Concorrência, Transações e Estoque sob Carga
- **MCPs Utilizados:** `performance_bottleneck`, `performance_benchmark`.
- **Focos de Investigação:**
  1. **Race Conditions no Estoque:** Testar se múltiplas requisições simultâneas de compra da última unidade restante de uma variante podem gerar venda a descoberto (estoque negativo).
  2. **Concorrência no Saldo de Fidelidade:** Validar se o resgate simultâneo de pontos em duas abas pelo mesmo cliente impede o gasto duplo (*double-spending*).
  3. **Integridade de Estorno:** Checar se todas as ordens que transitam para `CANCELLED` (por tempo expirado, desistência ou recusa de pagamento) estornam perfeitamente o estoque tanto em `ProductVariants` quanto no produto pai `Product`.

### Trilha 4: Arquitetura Limpa, Qualidade de Código & Next.js 16
- **MCPs Utilizados:** `analyze_file-risk`, `analyze_circular`, `analyze_boundaries`, `analyze_deps`.
- **Focos de Investigação:**
  1. **Adesão ao SOLID:** Verificação de violações de responsabilidade única (SRP) ou acoplamento indevido entre rotas e banco.
  2. **Dependências & Vulnerabilidades (CVE):** Varredura de pacotes npm em busca de vulnerabilidades conhecidas (`npm audit` / `ruflo analyze deps --security`).
  3. **Modernização Next.js 16:** Identificação de padrões depreciados (como o aviso do `middleware.ts` sugerindo migração para convenção de proxy).
  4. **Código Órfão ou Residual:** Detecção de endpoints de teste (ex: `/api/admin/example`) e colunas não utilizadas no banco de dados.

### Trilha 5: Performance, Consultas N+1 & Resiliência
- **MCPs Utilizados:** `performance_bottleneck`, `agentdb_graph-query`.
- **Focos de Investigação:**
  1. **Consultas Prisma Ineficientes:** Identificação de queries com loops desnecessários (`for ... await prisma.findUnique`) que deveriam utilizar `findMany({ where: { id: { in: [...] } } })`.
  2. **Estratégia de Cache Multi-Tenant:** Checagem da invalidação adequada de cache de catálogo e configurações de loja quando ocorrem atualizações administrativas.
  3. **Rate Limiting em Rotas Críticas:** Assegurar que login, registro, recuperação de senha, checkout e cálculo de frete possuem limitação adequada de taxa de requisições por IP.

---

## 4. Divisão de Agentes Especialistas (Swarm Mesh)

Para garantir máxima profundidade sem viés de confirmação, a auditoria será conduzida por 4 Agentes Especialistas orquestrados via RuFlo Swarm:

| Agente | Especialidade | Trilha Atribuída | Missão Crítica |
| :---: | :--- | :--- | :--- |
| **Agente Vermelho (Red Team)** | *Security & Pentest Auditor* | Trilha 1 (OWASP & BOLA) | Buscar ativamente brechas de bypass, injeção de parâmetros, vazamento de dados e falhas de autorização. |
| **Agente Financeiro (FinTech)** | *Gateway & Concurrency Auditor* | Trilhas 2 e 3 (Asaas & Estoque) | Analisar a consistência de centavos, idempotência de webhooks, race conditions e integridade de transações. |
| **Agente de Arquitetura (Arch)** | *Clean Code & Next.js Specialist* | Trilha 4 (SOLID & Framework) | Avaliar acoplamento, circularidades, conformidade com Next.js 16 e dependências npm. |
| **Agente de Performance (Perf)** | *Database & Latency Specialist* | Trilha 5 (Prisma & Latência) | Auditar eficiência de consultas SQL, indexação do Supabase, contenção de poolers e caching. |

---

## 5. Estrutura do Relatório Final de Auditoria

Ao término das investigações, será gerado o documento consolidado:  
📁 `diversos/PLANEJAMENTO_GERAL/RELATORIO_AUDITORIA_PROFUNDA_FINAL.md`

O relatório conterá:
1. **Sumário Executivo:** Score geral de segurança, prontidão para produção e veredito do sistema.
2. **Matriz de Vulnerabilidades Encontradas:**
   - Código identificador (`AUD-001`, `AUD-002`...)
   - Classificação de Severidade (Crítico P0, Alto P1, Médio P2, Baixo P3)
   - Vetor de Ataque / Falha Operacional
   - Arquivo e linha exata do código
   - Prova de Conceito (PoC) ou Demonstração do Impacto
   - Plano de Correção Recomendado
3. **Métricas de Cobertura e Desempenho:** Tempos de resposta, integridade das transações e grafo de dependências.

---

## 6. Próximo Passo e Ponto de Decisão

Este documento formaliza a estratégia, o escopo e o emprego dos MCPs para a auditoria profunda do sistema.

**Status Atual:** ⏳ **Aguardando autorização expressa do usuário para iniciar a execução da auditoria.**
