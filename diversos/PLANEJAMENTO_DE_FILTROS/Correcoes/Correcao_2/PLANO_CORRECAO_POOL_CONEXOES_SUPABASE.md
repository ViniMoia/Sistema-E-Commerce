# Plano de Implementação: Resolução do Limite de Conexões do Banco de Dados (Supabase Connection Pooler)

**Data de Elaboração:** 23 de Setembro de 2026  
**Localização:** `diversos/PLANEJAMENTO_DE_FILTROS/Correcoes/Correcao_2/PLANO_CORRECAO_POOL_CONEXOES_SUPABASE.md`  
**Escopo:** Solução definitiva para o esgotamento do pool de conexões do Supabase PostgreSQL (`FATAL: (EMAXCONNSSESSION) max clients reached in session mode`), garantindo alta concorrência e estabilidade em desenvolvimento (Turbopack) e produção.  
**Regra Estrita de Execução:** Nenhuma alteração no código será iniciada antes da aprovação explícita do usuário. A execução seguirá estritamente uma etapa por vez, mediante autorização.

---

## 1. Contexto e Diagnóstico Técnico do Problema

### 1.1. O Erro Observado
Ao iniciar o servidor com `npm run dev` e acessar a vitrine da loja no navegador, o Next.js 16.3.5 (Turbopack) aborta o carregamento com a seguinte falha crítica:
```text
PrismaClientInitializationError: Invalid `prisma.loja.findUnique()` invocation in lib/tenant.ts (64:30)
Error querying the database: FATAL: (EMAXCONNSSESSION) max clients reached in session mode - max clients are limited to pool_size: 15
```

### 1.2. Causa Raiz
No arquivo [`.env`](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/.env), a variável `DATABASE_URL` está configurada da seguinte forma:
```env
DATABASE_URL="postgresql://postgres.hzewcqjjiglwpohdsjmq:AWDsxf%401423@aws-1-us-east-1.pooler.supabase.com:5432/postgres?connection_limit=2"
DIRECT_URL="postgresql://postgres.hzewcqjjiglwpohdsjmq:AWDsxf%401423@aws-1-us-east-1.pooler.supabase.com:5432/postgres"
```

* **Session Mode (Porta 5432):** No host `aws-1-us-east-1.pooler.supabase.com`, a porta **`5432`** força o Supavisor / PgBouncer a operar em **Modo Sessão**. Nesse modo, cada conexão aberta pelo cliente retém um slot físico dedicado e exclusivo no banco durante todo o tempo de vida do processo. No Supabase, o Session Mode possui um teto rígido e global de **apenas 15 conexões** (`pool_size: 15`).
* **Concorrência do Next.js (Turbopack):** Na montagem do SSR de [`app/page.tsx`](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/app/page.tsx), ocorrem múltiplas chamadas concorrentes em paralelo (`getLojaFromHeaders`, `getProducts`, `getBrandsWithProductCount` e cache do RootLayout), somadas a múltiplos workers de compilação e eventuais conexões residuais ociosas (*idle*). A 16ª tentativa de conexão é sumariamente rejeitada pelo Supabase com o erro fatal `EMAXCONNSSESSION`.
* **A Solução Recomendada (Transaction Mode - Porta 6543):** O Supabase e a Prisma recomendam expressamente que aplicações web e Serverless se conectem através da porta **`6543`** com o parâmetro `?pgbouncer=true`. No modo transação, as conexões físicas não ficam presas ao cliente; elas são emprestadas por milissegundos apenas para a execução da query e devolvidas instantaneamente ao pool, suportando milhares de requisições concorrentes sem qualquer gargalo.

---

## 2. Matriz de Utilização dos MCPs em Cada Etapa

Em conformidade com a arquitetura do projeto e os MCPs instalados na IDE, cada etapa da solução empregará as ferramentas especializadas correspondentes:

| Etapa | MCP Designado | Ferramentas / Módulos | Função Técnica na Etapa |
| :--- | :--- | :--- | :--- |
| **Etapa 1: Planejamento Analítico & Reconfiguração de Ambiente** | **`sequential-thinking`** | `sequentialthinking` | Avaliar a decomposição analítica das portas (6543 vs 5432), dimensionar os parâmetros da query string (`pgbouncer=true`, `connection_limit=10`, `pool_timeout=20`) e garantir retrocompatibilidade com o Prisma Migrate. |
| **Etapa 2: Diagnóstico e Validação do Banco PostgreSQL** | **`postgres`** | `query` | Inspecionar a tabela de sistema `pg_stat_activity` do PostgreSQL, monitorar conexões ativas/ociosas (*idle* vs *active*) e validar o handshake seguro no modo transação (porta 6543). |
| **Etapa 3: Blindagem do Singleton & Auditoria de Risco** | **`ruflo`** | `analyze_diff-risk`, `performance_profile`, `system_health` | Analisar o risco das alterações no código do singleton (`lib/prisma.ts`), mensurar latência de queries pós-chaveamento para Transaction Mode e garantir conformidade operacional. |
| **Etapa 4: Versionamento Seguro & Governança de Código** | **`git`** | `git_status`, `git_diff`, `git_commit`, `git_push` | Assegurar que as alterações de configuração e código sejam encapsuladas em commits atômicos com rastreabilidade formal na branch `main`. |

---

## 3. Plano de Implementação Dividido em Etapas

A implementação será executada de forma estritamente sequencial, avançando uma etapa por vez sob autorização do usuário.

```mermaid
graph TD
    A["Etapa 1: Reconfiguração no .env e .env.example<br/>(Porta 6543 + Transaction Mode)"] -->|Autorização| B["Etapa 2: Aprimoramento do Singleton Prisma<br/>(lib/prisma.ts + Gestão de Lifecycle)"]
    B -->|Autorização| C["Etapa 3: Drenagem de Conexões Ociosas & Handshake<br/>(Validação de Conectividade via MCP Postgres)"]
    C -->|Autorização| D["Etapa 4: Testes de Carga Concorrente & Start Dev<br/>(Validação no Navegador + Zero EMAXCONNSSESSION)"]
```

---

### Etapa 1: Reconfiguração das Strings de Conexão ([`.env`](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/.env) & [`.env.example`](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/.env.example))
* **MCP Designado:** `sequential-thinking` (decomposição de flags de conexão).
* **Ações Técnicas:**
  1. Alterar a porta de `DATABASE_URL` de `5432` para **`6543`** (Transaction Mode oficial do pooler).
  2. Adicionar o parâmetro obrigatório do Prisma para PgBouncer: `?pgbouncer=true&connection_limit=10&pool_timeout=20`.
  3. Manter a `DIRECT_URL` intacta na porta **`5432`** (necessária exclusivamente para migrações do Prisma Migrate que exigem Session Mode para advisory locks temporários).
  4. Sincronizar as instruções documentadas no `.env.example`.
* **Resultado Esperado:** A aplicação passa a rotear consultas normais pelo modo transação com pool virtual ilimitado.

---

### Etapa 2: Blindagem e Otimização do Singleton do Prisma Client ([`lib/prisma.ts`](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/lib/prisma.ts))
* **MCP Designado:** `ruflo` (`analyze_diff-risk`).
* **Ações Técnicas:**
  1. Revisar o singleton global em [`lib/prisma.ts`](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/lib/prisma.ts) para assegurar que o Next.js com Turbopack em modo dev não recrie instâncias do `PrismaClient` a cada hot-reload de Server Components.
  2. Implementar logging estruturado para capturar eventos de desconexão e reconexão de forma graciosa.
  3. Garantir tratamento defensivo caso o pooler precise reciclar conexões sob carga.
* **Resultado Esperado:** Garantia de uma única instância de conexão compartilhada em memória pelo Node.js.

---

### Etapa 3: Drenagem de Conexões Ociosas e Validação de Conectividade
* **MCP Designado:** `postgres` (`query`) + `ruflo` (`system_health`).
* **Ações Técnicas:**
  1. Executar consulta diagnóstica de verificação de conexões ativas na instância do Supabase.
  2. Executar script de teste automatizado de handshake disparando 20 consultas simultâneas na porta 6543 para verificar se o pooler atende todas sem erro `EMAXCONNSSESSION`.
  3. Validar se a latência média das queries permanece abaixo de 50ms.
* **Resultado Esperado:** Confirmação de que o pooler transacional aceita concorrência massiva com sucesso.

---

### Etapa 4: Validação Funcional Completa e Testes de Carga Concorrente
* **MCP Designado:** `ruflo` (`performance_profile`) + `git` (`git_commit`, `git_push`).
* **Ações Técnicas:**
  1. Executar a suíte de testes unitários (`npm run test:unit`) para assegurar que todos os 362 testes permanecem 100% verdes.
  2. Executar verificação de tipagem estática TypeScript (`npx tsc --noEmit`).
  3. Iniciar o servidor de desenvolvimento (`npm run dev`) e carregar a home page no navegador (`http://localhost:3000`).
  4. Navegar pelo catálogo, filtrar por marcas (Autoamerica, Cadillac, etc.) e simular frete para certificar que o SSR funciona sem nenhuma instabilidade ou lentidão.
  5. Versionar as alterações e registrar os resultados no `walkthrough.md`.
* **Resultado Esperado:** Plataforma operando com 100% de estabilidade e sem nenhum erro de conexão com o banco de dados.

---

## 4. Critérios de Aceite (Definition of Done)

- [ ] **AC-POOL-01 (Eliminação do Erro):** Zero ocorrências do erro `FATAL: (EMAXCONNSSESSION)` ao acessar a home page ou navegar no catálogo com `npm run dev`.
- [ ] **AC-POOL-02 (Transaction Mode):** `DATABASE_URL` configurada na porta `6543` com parâmetro `?pgbouncer=true`.
- [ ] **AC-POOL-03 (Direct URL Preservada):** `DIRECT_URL` preservada na porta `5432` garantindo compatibilidade com migrações e Prisma Studio.
- [ ] **AC-POOL-04 (Concorrência Aprovada):** A aplicação suporta múltiplas requisições paralelas sem travar workers do Turbopack.
- [ ] **AC-POOL-05 (Regressão Zero):** 362 testes unitários aprovados (`npm run test:unit`) e 0 erros de TypeScript.
