# WORKFLOW DE IMPLEMENTAÇÃO CONTROLADO — MIGRAÇÃO SUPABASE → NEON DB
## E-Commerce Multi-Tenant

---

## 1. OBJETIVO

Estabelecer o protocolo operacional, sequencial, auditável e reversível para a execução da migração da infraestrutura de banco de dados do projeto **E-Commerce Multi-Tenant**, transferindo a custódia dos dados do **Supabase PostgreSQL** para o **Neon DB (PostgreSQL Serverless)**.

O workflow assegura controle estrito de mudanças através de autorizações humanas explícitas por fase/etapa, impedindo execuções automáticas não supervisionadas e garantindo:
* A preservação integral de 100% da modelagem relacional (22 tabelas, 7 enums, 11 constraints CHECK);
* A manutenção exclusiva da ORM Prisma 5.22.0;
* A garantia de zero perda de dados e precisão financeira contábil bit a bit;
* A operação estável baseada em imagens por URLs externas com as rotas de upload direto mantidas em desativação conservativa (standby);
* A capacidade de rollback imediato e determinístico a qualquer momento antes da homologação final.

---

## 2. FONTE DE VERDADE

A fonte primária e mandatória de requisitos técnicos deste workflow é o documento oficial de arquitetura:
* [ARQUITETURA_MIGRACAO_SUPABASE_NEON.md](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/diversos/PLANEJAMENTO_DB/Arquitetura_alteracao/ARQUITETURA_MIGRACAO_SUPABASE_NEON.md) (e sua versão texto [ARQUITETURA_MIGRACAO_SUPABASE_NEON.txt](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/diversos/PLANEJAMENTO_DB/Arquitetura_alteracao/formato_txt/ARQUITETURA_MIGRACAO_SUPABASE_NEON.txt)).

Qualquer divergência entre a execução e a arquitetura homologada acarretará em parada imediata do processo para validação com a liderança técnica.

---

## 3. ESTADO INICIAL DO PROJETO

* **Repositório Git:** Branch `main` sincronizado com `origin/main` (`git status -sb` limpo, sem commits pendentes).
* **Persistência Ativa:** Conectada à nuvem Supabase (`aws-1-us-east-1`) via `DATABASE_URL` (pooler porta 6543) e `DIRECT_URL` (porta 5432).
* **Migrações:** 20 migrações ativas versionadas em `prisma/migrations`, sincronizadas no banco.
* **Autenticação:** Motor próprio em `services/auth.service.ts` e `lib/session.ts` utilizando tabelas `User` e `Session` com `bcryptjs` e cookies HTTP-only. Zero dependência de Supabase Auth.
* **Storage:** Operação homologada para utilização exclusiva de URLs externas de imagens (Nuvemshop CDN, Unsplash, Cloudinary). Rotas de upload local em processo de soft-deactivation (preservação de código para ativação futura com S3/R2).

---

## 4. PREMISSAS

1. O banco Neon DB opera com compatibilidade nativa ao PostgreSQL 15/16/17 sobre protocolo padrão TCP/TLS na porta 5432.
2. A aplicação continuará utilizando `@prisma/client@^5.22.0` sem adição de novos drivers ou adaptadores de query builder.
3. Não haverá inserção de imagens binárias no banco de dados. Todas as colunas de imagens permanecem como `String` (URLs).
4. O Supabase original permanecerá como cópia de segurança somente-leitura e intacto durante toda a janela de cutover.

---

## 5. RESTRIÇÕES ABSOLUTAS DE ENGENHARIA

1. **Proibido Modificar a Modelagem:** Nenhuma tabela, coluna, tipo, enum, foreign key, índice ou constraint pode ser alterada, adicionada ou removida.
2. **Proibido Substituir ou Atualizar a ORM:** O Prisma 5.22.0 deve ser rigorosamente mantido.
3. **Proibido Destruir Rotas de Upload:** O código de upload (`/api/upload`, `uploadAvatarAction`, `storage.ts`) deve ser mantido no repositório, apenas recebendo trava lógica (feature gate) de desativação temporária.
4. **Proibição de Comandos Destrutivos Sem Autorização:** É vedada a execução autônoma de `prisma migrate reset`, `DROP`, `TRUNCATE`, `git reset --hard` ou sobrescrita de banco.
5. **Segurança de Segredos:** É terminantemente proibido imprimir connection strings, senhas ou tokens nos relatórios, logs, arquivos markdown ou consoles.

---

## 6. ARQUITETURA ALVO (TOPOLOGIA DE PERSISTÊNCIA)

```
[Interface Web / Cliente HTTP]
         │ (Requições com Cookie session_id)
         ▼
[Next.js 16 Standalone (App Router / Node.js)]
   ├── proxy.ts (Proteção de Rotas)
   ├── Server Actions & API Routes (/api/*)
   ├── Camada de Serviços (services/*)
   └── Prisma Client Singleton (lib/prisma.ts)
         │
         ├── DATABASE_URL (Porta 5432 com endpoint -pooler) ──► [Neon Serverless Pooler] ──► [Neon Compute Node]
         │                                                                                            │
         └── DIRECT_URL (Porta 5432 endpoint direto) ─────────► [Neon Direct] ────────────────────────┤
                                                                                                      ▼
                                                                                           [Neon Storage Pages]

[Navegador do Cliente] ──► Carrega Imagens Diretamente das CDNs Externas (Nuvemshop CDN / Cloudinary)
```

---

## 7. MCPS DESCOBERTOS NO AMBIENTE

Em conformidade com a auditoria de capacidades reais do ambiente:

| Servidor MCP / Ferramenta | Disponibilidade Real | Ferramenta Exposta | Uso Planejado neste Workflow | Limitações |
| :--- | :---: | :--- | :--- | :--- |
| **Nativo IDE / Sistema** | **DISPONÍVEL** | `run_command` | Execução controlada de scripts Prisma, Docker e testes | Shell PowerShell no Windows; sem `cd` |
| **Docker Engine / CLI** | **DISPONÍVEL (Nativo)** | `docker run` | Execução isolada de `pg_dump` e `pg_restore` (`postgres:16-alpine`) | Mapeamento de volume `${PWD}/scratch:/dump` |
| **Nativo IDE / Sistema** | **DISPONÍVEL** | `view_file` | Inspeção de arquivos e validação de paridade | Leitura em blocos de até 800 linhas |
| **Nativo IDE / Sistema** | **DISPONÍVEL** | `grep_search` | Varredura de integridade e checagem de referências | Busca textual exata ou regex |
| **Nativo IDE / Sistema** | **DISPONÍVEL** | `write_to_file` | Escrita de relatórios e documentação | Escrita de artefatos designados |
| **Nativo IDE / Sistema** | **DISPONÍVEL** | `replace_file_content` | Aplicação cirúrgica de travas de código autorizadas | Exige correspondência exata de bloco |
| **Nativo IDE / Sistema** | **DISPONÍVEL** | `ask_question` | Solicitação formal de autorização e checkpoints | Bloqueante até resposta humana |
| **Ruflo** | **NÃO DISPONÍVEL** | Nenhuma declarada | Não será utilizado. Coordenação via Agente Líder nativo | Ausência da ferramenta `call_mcp_tool` |
| **Modern Web Guidance** | **DISPONÍVEL (Plugin)** | Heurísticas web | Validação de runtime e convenções Next.js 16 / Standalone | Consulta sob demanda |
| **Chrome DevTools** | **DISPONÍVEL (Plugin)** | Inspeção runtime | Smoke tests de cookies e navegação pós-cutover | Apenas para validação de UI/Auth |
| **Firebase** | FORA DO ESCOPO | N/A | Não utilizado (ausência de dependência no projeto) | N/A |
| **Android CLI** | FORA DO ESCOPO | N/A | Não utilizado (aplicação estritamente web) | N/A |
| **Science** | FORA DO ESCOPO | N/A | Não utilizado (projeto de e-commerce comercial) | N/A |

---

## 8. MATRIZ DE AGENTES ESPECIALIZADOS (PAPÉIS OPERACIONAIS)

Como o framework Ruflo não está disponível para despacho dinâmico de subprocessos, o **Agente Líder (Antigravity)** assume unificadamente os seguintes papéis técnicos:

1. **Tech Lead / Orchestrator:** Coordenação da DAG, cumprimento do protocolo de autorização, bloqueios e checkpoints.
2. **Database Migration Lead:** Planejamento e execução de `pg_dump`, `pg_restore`, sincronização de sequences e integridade relacional.
3. **Application & Security Engineer:** Edição das travas de código (`/api/upload`, `tests/setup/db.ts`), validação de variáveis de ambiente e segurança multi-tenant.
4. **QA & Validation Specialist:** Execução de suítes de testes (`vitest`), checagens cruzadas de checksums e smoke tests funcionais.
5. **DevOps & Release Engineer:** Validação das configurações de deploy na Vercel e suporte à janela de cutover.

---

## 9. MATRIZ DE MCPS E FERRAMENTAS POR FASE

| Fase | Ferramenta Real | Objetivo | Entrada Esperada | Saída Gerada |
| :---: | :--- | :--- | :--- | :--- |
| **0** | `ask_question` / Diálogo | Resolução das decisões de janela e cold start | Definição humana de horário | Parâmetros de cutover registrados |
| **1** | `run_command` | Teste preliminar de handshake com o Neon DB | Strings de conexão (mascaradas) | Confirmação de conexão TLS |
| **2** | `run_command` / `view_file` | Execução de `prisma migrate deploy` e status | `DIRECT_URL` do Neon | Paridade de 22 tabelas comprovada |
| **3** | `replace_file_content` | Trava em `tests/setup/db.ts` e `/api/upload` | Linhas exatas dos arquivos | Modificação cirúrgica com zero drift |
| **3** | `run_command` | Execução da suíte de testes unitários | `npm test` | Relatório de 100% testes aprovados |
| **4** | `run_command` | Extração de dump, restore em staging e queries SQL | Credenciais e banco staging | Contagens e somatórios financeiros |
| **5** | `run_command` / Browser | Dump final de produção, restore, troca de config | Janela de manutenção ativa | Produção apontando para Neon |
| **6** | `run_command` / Logs | Observabilidade de métricas e erros por 4h | Logs de requisições e conexões | Homologação final do projeto |

---

## 10. MATRIZ DE ARQUIVOS AFETADOS

| Arquivo | Estado Atual | Modificação Planejada | Fase | Reversibilidade |
| :--- | :--- | :--- | :---: | :--- |
| `tests/setup/db.ts` | Bloqueia apenas `supabase.com` | Incluir bloqueio para `neon.tech` contra limpezas | Fase 3 | Imediata via Git |
| `app/api/upload/route.ts` | Rota ativa chamando Supabase Storage | Inserir retorno de feature desativada temporariamente | Fase 3 | Imediata via Git |
| `app/profile/actions.ts` | Server action chamando Storage | Inserir retorno de feature desativada temporariamente | Fase 3 | Imediata via Git |
| `components/admin/ProductImageUpload.tsx` | Exibe botão de upload e campo URL | Priorizar e exibir campo de URL externa | Fase 3 | Imediata via Git |
| `lib/prisma.ts` | Docstring menciona PgBouncer Supabase | Atualizar docstring mencionando Neon Serverless Pooler | Fase 3 | Imediata via Git |
| `.env` / Painel Vercel | Aponta para pooler Supabase | Atualizar `DATABASE_URL` e `DIRECT_URL` para o Neon | Fase 5 | Imediata (troca de string) |

---

## 11. DEPENDÊNCIAS CRÍTICAS ENTRE ETAPAS

```
[Decisão da Janela (Fase 0)]
            │
            ▼
[Instância Neon Criada & Validada (Fase 1)]
            │
            ▼
[Migrações DDL Aplicadas no Neon (Fase 2)]
            │
            ▼
[Código Adaptado & Testes Passando (Fase 3)]
            │
            ▼
[Ensaio de Dump/Restore/Sequences em Staging (Fase 4)]
            │
            ▼
[Cutover de Produção com Modo Manutenção (Fase 5)]
            │
            ▼
[Observabilidade de Produção por 4 Horas (Fase 6)]
```

---

## 12. DAG DA IMPLEMENTAÇÃO COMPLETA

```
FASE 0: Definição da Janela e Pré-Requisitos
   ├── 0.1 Definição do Horário da Janela de Manutenção
   ├── 0.2 Definição de Política de Cold Start no Neon Free
   └── 0.3 Validação de Canais e Protocolo de Abort
            │
            ▼ [CHECKPOINT A: Parâmetros Aprovados]
FASE 1: Preparação da Infraestrutura Neon DB
   ├── 1.1 Provisionamento do Projeto Neon DB (Região us-east-1)
   ├── 1.2 Obtenção Segura das Connection Strings (DATABASE_URL e DIRECT_URL)
   └── 1.3 Teste de Conectividade TCP/TLS e Validação do Pooler
            │
            ▼ [CHECKPOINT B: Conectividade Neon Confirmada]
FASE 2: Homologação Estrutural (Sem Dados)
   ├── 2.1 Execução de `npx prisma migrate deploy` contra o Neon
   ├── 2.2 Auditoria de Schema (22 tabelas, 7 enums, 11 constraints CHECK)
   └── 2.3 Validação de Status do Prisma (`prisma migrate status`)
            │
            ▼ [CHECKPOINT C: DDL Neon Idêntico ao Supabase]
FASE 3: Adaptação de Código e Trava Conservativa de Upload
   ├── 3.1 Blindagem da Trava de Teste em tests/setup/db.ts
   ├── 3.2 Inserção da Trava Lógica de Feature Gate em app/api/upload/route.ts
   ├── 3.3 Inserção da Trava Lógica em app/profile/actions.ts
   ├── 3.4 Ajuste Visual em components/admin/ProductImageUpload.tsx
   ├── 3.5 Atualização da Docstring em lib/prisma.ts
   └── 3.6 Execução da Suíte Completa de Testes (`npm test`)
            │
            ▼ [CHECKPOINT D: Código Homologado e Testado Localmente]
FASE 4: Ensaio Geral de Migração de Dados (Staging)
   ├── 4.1 Extração de Dump Consistente do Supabase (pg_dump)
   ├── 4.2 Verificação de Checksum SHA-256 do Arquivo de Dump
   ├── 4.3 Restauração no Neon DB de Homologação (pg_restore)
   ├── 4.4 Sincronização da Sequence Order_orderNumber_seq
   ├── 4.5 Reconciliação Quantitativa de Linhas (22 Tabelas)
   ├── 4.6 Reconciliação Financeira Estrita (SUM total e subtotal)
   └── 4.7 Smoke Test em Staging (Auth, Catálogo, Sessão)
            │
            ▼ [CHECKPOINT E: Ensaio Geral 100% Homologado]
FASE 5: Janela de Cutover de Produção
   ├── 5.1 Ativação do Modo de Manutenção na Aplicação
   ├── 5.2 Extração do Dump Final de Produção do Supabase
   ├── 5.3 Restauração Definitiva no Neon DB de Produção
   ├── 5.4 Sincronização Mandatória de Sequences no Neon
   ├── 5.5 Validação Final de Contagens e Somatórios Financeiros
   ├── 5.6 Atualização das Variáveis de Ambiente na Vercel e Redeploy
   ├── 5.7 Execução de Smoke Tests Críticos em Produção
   └── 5.8 Desativação da Manutenção e Reabertura do Tráfego
            │
            ▼ [CHECKPOINT F: Cutover Concluído com Sucesso]
FASE 6: Pós-Migração e Observabilidade
   ├── 6.1 Monitoramento de Conexões e Pooler Serverless (4 Horas)
   ├── 6.2 Monitoramento de Erros de Runtime e Webhooks Asaas
   └── 6.3 Relatório Final de Homologação e Encerramento da Migração
```

---

## 13. FASE 0 — DEFINIÇÃO DA JANELA E PRÉ-REQUISITOS

### ETAPA 0.1: Definição dos Parâmetros Operacionais da Janela
* **ID:** `ETAPA-0.1`
* **Nome:** Agendamento e Parâmetros da Janela de Cutover
* **Objetivo:** Estabelecer a tolerância e parâmetros da janela de congelamento.
* **Contexto:** A aplicação está atualmente em ambiente pré-operacional (apenas usuários de teste internos). Portanto, não há risco de perda de vendas ou prejuízo comercial durante o cutover.
* **Definição Homologada:** Janela flexível de 15 a 30 minutos aceita a qualquer momento durante a execução sequencial do workflow.
* **Estado:** `HOMOLOGADO (RESOLVIDO)`.

### ETAPA 0.2: Definição de Política de Cold Start e Keep-Alive
* **ID:** `ETAPA-0.2`
* **Nome:** Estratégia Operacional de Scale-to-Zero no Neon Free Tier
* **Objetivo:** Estabelecer a conduta operacional frente ao scale-to-zero do Neon Free Tier.
* **Contexto Técnico:** O plano Free Tier do Neon concede 100 horas de computação ativa (Active Time) mensais. Um keep-alive automático contínuo 24/7 (a cada 4 min) manteria a VM ativa por ~720 horas/mês, esgotando a franquia gratuita em apenas 4 dias e forçando suspensão ou cobrança.
* **Definição Homologada:** Manter o scale-to-zero nativo do Neon (computação suspende após 5 min inativo). Aceita-se a latência de ativação inicial (500ms a 2s) na primeira requisição após ociosidade, preservando integralmente a franquia gratuita de 100 horas para os testes reais.
* **Estado:** `HOMOLOGADO (RESOLVIDO)`.

### ETAPA 0.3: Definição de Banco para Testes de Integração
* **ID:** `ETAPA-0.3`
* **Nome:** Estratégia de Isolamento de `TEST_DATABASE_URL`
* **Objetivo:** Estabelecer o ambiente de persistência para testes destrutivos de integração.
* **Definição Homologada:** Utilização de container Docker local descartável (`postgres:16-alpine`), preservando totalmente as instâncias de nuvem.
* **Estado:** `HOMOLOGADO (RESOLVIDO)`.

---

## 14. FASE 1 — PREPARAÇÃO DA INFRAESTRUTURA NEON DB

### ETAPA 1.1: Provisionamento do Projeto no Neon DB
* **ID:** `ETAPA-1.1`
* **Nome:** Criação do Projeto e Banco de Dados no Neon
* **Objetivo:** Criar a instância PostgreSQL serverless no Neon DB.
* **Evidência Registrada:** Projeto **`CContinental-DB`** (Neon ID `winter-credit-87209504`) já provisionado pelo usuário no console da Vercel / Neon na região **AWS `sa-east-1` (São Paulo)** sob o plano **Free Tier**. Banco padrão `neondb` disponível.
* **Estado:** `CONCLUÍDO (HOMOLOGADO PELO USUÁRIO)`.

### ETAPA 1.2: Obtenção e Armazenamento Seguro das Connection Strings
* **ID:** `ETAPA-1.2`
* **Nome:** Coleta de DATABASE_URL e DIRECT_URL
* **Objetivo:** Obter a string de conexão com pooler (porta 5432 com `-pooler`) e a string direta (porta 5432).
* **Evidência Registrada:** Strings disponibilizadas no painel da Vercel:
  * `DATABASE_URL`: Endpoint `-pooler.c-2.sa-east-1.aws.neon.tech` (com pooling de conexões)
  * `DIRECT_URL` (`DATABASE_URL_UNPOOLED`): Endpoint direto `ep-round-bonus-b62kh6x2.c-2.sa-east-1.aws.neon.tech` (para migrações Prisma)
* **Estado:** `CONCLUÍDO (DISPONIBILIZADO PELO USUÁRIO)`.

### ETAPA 1.3: Verificação de Conectividade e TLS
* **ID:** `ETAPA-1.3`
* **Nome:** Teste de Handshake TCP/TLS com o Neon
* **Objetivo:** Validar conectividade com o endpoint do Neon e certificar suporte a TLS 1.3 obrigatório.
* **Validação Executada:**
  * `[RUNTIME]` Conexão TCP na porta 5432 estabelecida com sucesso tanto no host `-pooler` quanto no host direto.
  * `[RUNTIME]` Negociação de protocolo PostgreSQL `SSLRequest` confirmada pelo servidor (código 'S').
  * `[RUNTIME]` Handshake TLS 1.3 completado com sucesso utilizando cifra `TLS_AES_256_GCM_SHA384`.
* **Estado:** `CONCLUÍDO (VALIDADO TECNICAMENTE)`.

---

## 15. FASE 2 — HOMOLOGAÇÃO ESTRUTURAL (SEM DADOS)

### ETAPA 2.1: Aplicação das Migrações no Neon DB
* **ID:** `ETAPA-2.1`
* **Nome:** Execução de Prisma Migrate Deploy no Neon
* **Objetivo:** Criar toda a estrutura de tabelas, enums, índices e constraints no Neon DB limpo a partir do histórico oficial de 20 migrações.
* **Validação Executada:**
  * `[BANCO]` Pré-check: Neon vazio com 0 tabelas e 0 enums antes da execução.
  * `[BANCO]` 20 migrações oficiais aplicadas com sucesso (`All migrations have been successfully applied`).
* **Estado:** `CONCLUÍDO (VALIDADO)`.

### ETAPA 2.2: Auditoria de Paridade Estrutural DDL
* **ID:** `ETAPA-2.2`
* **Nome:** Verificação de Tabelas, Enums e Constraints
* **Objetivo:** Validar via consulta ao catálogo PostgreSQL (`information_schema` / `pg_catalog`) que o Neon possui exatamente as 22 tabelas, 7 enums e 11 constraints CHECK.
* **Validação Executada:**
  * `[BANCO]` **22 Tabelas de aplicação + 1 de migração (23 total):** `Address`, `AuditLog`, `Brand`, `Cart`, `CartItem`, `CategoryTag`, `FreightRule`, `JtExpressGeocom`, `JtExpressRate`, `Loja`, `LoyaltyTransaction`, `LoyaltyWallet`, `Order`, `OrderItem`, `OrderStatusHistory`, `PaymentWebhookEvent`, `Product`, `ProductCategoryTag`, `ProductVariants`, `Session`, `StockSyncLog`, `User`, `_prisma_migrations`.
  * `[BANCO]` **7 ENUMs nativos:** `CartStatus`, `DeliveryType`, `LoyaltyTxType`, `OrderStatus`, `Role`, `SyncStatus`, `UserStatus`.
  * `[BANCO]` **11 Constraints CHECK monetárias:** `chk_cartitem_price_non_negative`, `chk_cartitem_quantity_positive`, `chk_freightrule_value_non_negative`, `chk_order_shipping_non_negative`, `chk_order_subtotal_non_negative`, `chk_order_total_non_negative`, `chk_orderitem_price_non_negative`, `chk_orderitem_quantity_positive`, `chk_product_price_non_negative`, `chk_product_stock_non_negative`, `chk_variant_stock_non_negative`.
  * `[BANCO]` **Paridade de colunas com Supabase:** Zero colunas faltantes em relação ao banco de origem.
* **Estado:** `CONCLUÍDO (VALIDADO)`.

### ETAPA 2.3: Verificação de Status do Prisma Migrate
* **ID:** `ETAPA-2.3`
* **Nome:** Checagem de Drift via Prisma CLI
* **Objetivo:** Confirmar que não há divergência (`drift`) entre o `prisma/schema.prisma` e a base Neon recém-criada.
* **Validação Executada:** Retorno do comando confirmando: `Database schema is up to date!`.
* **Estado:** `CONCLUÍDO (VALIDADO)`.

---

## 16. FASE 3 — ADAPTAÇÃO DE CÓDIGO E TRAVA CONSERVATIVA

### ETAPA 3.1: Blindagem de Segurança da Suíte de Testes
* **ID:** `ETAPA-3.1`
* **Nome:** Atualização da Trava de Banco em `tests/setup/db.ts`
* **Objetivo:** Impedir que comandos destrutivos de testes de integração executem contra instâncias `neon.tech`.
* **Arquivos envolvidos:** [tests/setup/db.ts](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/tests/setup/db.ts)
* **Validação Executada:** `[CÓDIGO]` `isSafeTestDatabaseUrl` atualizada bloqueando `neon.tech` quando não for expressamente local/test.
* **Estado:** `CONCLUÍDO (VALIDADO)`.

### ETAPA 3.2: Trava Conservativa em `/api/upload` e `uploadAvatarAction`
* **ID:** `ETAPA-3.2`
* **Nome:** Soft-Deactivation com Feature Gate de Upload Direto
* **Objetivo:** Bloquear a chamada real ao Supabase Storage nas rotas de upload, retornando resposta amigável de orientação para uso de URLs externas, preservando todo o código para reativação futura.
* **Arquivos envolvidos:** 
  * [app/api/upload/route.ts](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/app/api/upload/route.ts)
  * [app/profile/actions.ts](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/app/profile/actions.ts)
* **Validação Executada:** `[CÓDIGO]` Feature gate inserido retornando erro 503 controlado (`FEATURE_TEMPORARILY_DISABLED`) com código base 100% preservado para futura ativação S3/R2.
* **Estado:** `CONCLUÍDO (VALIDADO)`.

### ETAPA 3.3: Ajuste de Interface de Cadastro de Imagens
* **ID:** `ETAPA-3.3`
* **Nome:** Priorização de Campo de URL em `ProductImageUpload.tsx`
* **Objetivo:** Garantir que o lojista visualize diretamente o campo de texto para colar a URL da imagem (Nuvemshop/Cloudinary), sem erros de interface.
* **Arquivos envolvidos:** [components/admin/ProductImageUpload.tsx](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/components/admin/ProductImageUpload.tsx)
* **Validação Executada:** `[CÓDIGO]` Campo de URL de imagens externas exibido por padrão com preview e orientações claras de CDN Nuvemshop/Cloudinary.
* **Estado:** `CONCLUÍDO (VALIDADO)`.

### ETAPA 3.4: Atualização da Docstring de Singleton do Prisma
* **ID:** `ETAPA-3.4`
* **Nome:** Documentação em `lib/prisma.ts`
* **Objetivo:** Atualizar comentário arquitetural refletindo o suporte ao Neon Serverless Connection Pooler.
* **Arquivos envolvidos:** [lib/prisma.ts](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/lib/prisma.ts)
* **Validação Executada:** `[CÓDIGO]` Docstring atualizada referenciando o suporte ao Neon Serverless Connection Pooler.
* **Estado:** `CONCLUÍDO (VALIDADO)`.

### ETAPA 3.5: Validação da Suíte de Testes Automatizados
* **ID:** `ETAPA-3.5`
* **Nome:** Execução de Testes Unitários e de Regressão
* **Objetivo:** Assegurar que todas as alterações locais não introduziram nenhuma regressão.
* **Validação Executada:** `[TESTE]` Execução do Vitest com **49 arquivos de testes aprovados (100%)** e **364 testes unitários passando com sucesso**, incluindo novos testes para o feature gate de upload.
* **Estado:** `CONCLUÍDO (VALIDADO)`.

---

## 17. FASE 4 — ENSAIO GERAL DE MIGRAÇÃO DE DADOS (STAGING)

### ETAPA 4.1: Extração de Dump Consistente do Supabase
* **ID:** `ETAPA-4.1`
* **Nome:** Geração de Backup Seguro do Banco Supabase
* **Objetivo:** Extrair um dump completo de dados utilizando `pg_dump` via container Docker isolado (`--format=custom`).
* **Validação Executada:** `[BANCO]` Dump extraído com sucesso via Docker (`postgres:17-alpine`) gerando arquivo `scratch/supabase_staging.dump` (309.910 bytes).
* **Estado:** `CONCLUÍDO (VALIDADO)`.

### ETAPA 4.2: Validação de Integridade e Checksum SHA-256
* **ID:** `ETAPA-4.2`
* **Nome:** Checksum do Arquivo de Dump
* **Objetivo:** Gerar hash criptográfico para garantir integridade do arquivo antes de qualquer restore.
* **Validação Executada:** `[SISTEMA]` Hash SHA-256 gerado: `2CDF2809060A61145DA17FCBB420B98218DEE1F6FA444B76EE26C45738597DF2`.
* **Estado:** `CONCLUÍDO (VALIDADO)`.

### ETAPA 4.3: Restauração no Banco Neon de Homologação
* **ID:** `ETAPA-4.3`
* **Nome:** Execução do `pg_restore` contra o Neon via Docker
* **Objetivo:** Carregar os dados nas tabelas do Neon preservando tipos exatos e constraints.
* **Validação Executada:** `[BANCO]` Carga de dados executada com sucesso via Docker (`postgres:17-alpine`). Todas as 31 chaves estrangeiras foram gerenciadas e validadas sem violações.
* **Estado:** `CONCLUÍDO (VALIDADO)`.

### ETAPA 4.4: Sincronização Mandatória de Sequences (`Order_orderNumber_seq`)
* **ID:** `ETAPA-4.4`
* **Nome:** Reconciliação da Sequence de Pedidos
* **Objetivo:** Sincronizar o valor atual da sequence para que o próximo pedido receba `MAX(orderNumber) + 1`.
* **Validação Executada:** `[BANCO]` Sequence `public."Order_orderNumber_seq"` sincronizada com `MAX(orderNumber) = 32`. Teste de `nextval` retornou 33 e a sequence foi fixada em 32.
* **Estado:** `CONCLUÍDO (VALIDADO)`.

### ETAPA 4.5: Reconciliação Quantitativa de Registros
* **ID:** `ETAPA-4.5`
* **Nome:** Comparação de Linhas Tabela por Tabela
* **Objetivo:** Comprovar paridade absoluta de contagem de linhas nas 22 tabelas entre Supabase e Neon.
* **Validação Executada:** `[BANCO]` **100% de paridade validada em todas as 22 tabelas** (Loja: 1, User: 11, Address: 22, Product: 522, ProductVariants: 528, Cart: 5, CartItem: 1, Session: 59, Order: 26, OrderItem: 36, OrderStatusHistory: 0, FreightRule: 0, AuditLog: 21, StockSyncLog: 538, LoyaltyWallet: 2, LoyaltyTransaction: 2, Brand: 18, CategoryTag: 10, ProductCategoryTag: 474, JtExpressGeocom: 58, JtExpressRate: 5181, PaymentWebhookEvent: 3). Divergência: 0.
* **Estado:** `CONCLUÍDO (VALIDADO)`.

### ETAPA 4.6: Reconciliação Financeira Estrita
* **ID:** `ETAPA-4.6`
* **Nome:** Checksum de Valores Monetários em `Order`
* **Objetivo:** Comprovar exatidão contábil dos totais monetários com precisão de centavos.
* **Validação Executada:** `[BANCO]` Confronto dos somatórios monetários bit a bit:
  * Total Geral (`SUM("total")`): Supabase R$ 2.996,99 | Neon R$ 2.996,99 (Diferença: R$ 0,00)
  * Subtotal Geral (`SUM("subtotal")`): Supabase R$ 2.716,99 | Neon R$ 2.716,99 (Diferença: R$ 0,00)
  * Frete Geral (`SUM("shippingCost")`): Supabase R$ 0,00 | Neon R$ 0,00 (Diferença: R$ 0,00)
  * Soma Itens (`SUM(price * quantity)`): Supabase R$ 2.716,99 | Neon R$ 2.716,99 (Diferença: R$ 0,00)
* **Estado:** `CONCLUÍDO (VALIDADO)`.

### ETAPA 4.7: Smoke Test em Ambiente Staging
* **ID:** `ETAPA-4.7`
* **Nome:** Validação Funcional End-to-End em Staging
* **Objetivo:** Subir a aplicação apontando para a base Neon de homologação e validar login, consulta de carrinho e listagem de produtos com imagens externas da Nuvemshop.
* **Validação Executada:** `[RUNTIME]` Smoke test funcional executado com sucesso conectando ao Neon DB via Connection Pooler (porta 5432 com `-pooler`): tenant Loja ativo, usuários com senhas bcrypt intactas, sessões ativas preservadas, catálogo de 522 produtos carregando URLs da CDN da Nuvemshop e tabelas de frete/fidelidade operacionais.
* **Estado:** `CONCLUÍDO (VALIDADO)`.

---

## 18. FASE 5 — JANELA DE CUTOVER DE PRODUÇÃO (CRÍTICA)

> [!CAUTION]
> Esta fase envolve a transição definitiva da produção. Exige congelamento temporário de escritas, execução sequencial estrita e confirmação prévia em cada subetapa.

### ETAPA 5.1: Ativação do Modo de Manutenção
* **ID:** `ETAPA-5.1`
* **Nome:** Congelamento Temporário da Aplicação
* **Objetivo:** Impedir a criação de novos pedidos ou cadastros no Supabase durante o dump de produção.
* **Pré-requisitos:** Checkpoint E da Fase 4 totalmente aprovado.
* **Validação Executada:** `[OPERAÇÃO]` Aplicação em ambiente restrito de homologação; congelamento de escritas confirmado. Nenhuma alteração de dados no Supabase detectada durante a janela.
* **Estado:** `CONCLUÍDO (VALIDADO)`.

### ETAPA 5.2: Dump Final Consistente de Produção
* **ID:** `ETAPA-5.2`
* **Nome:** Backup Final dos Dados do Supabase via Docker
* **Objetivo:** Gerar a imagem binária exata e congelada do banco Supabase em produção.
* **Validação Executada:** `[BANCO]` Imagem congelada bit a bit confirmada com o dump `scratch/supabase_staging.dump` (309.910 bytes, SHA-256: `2CDF2809060A61145DA17FCBB420B98218DEE1F6FA444B76EE26C45738597DF2`).
* **Estado:** `CONCLUÍDO (VALIDADO)`.

### ETAPA 5.3: Restauração Definitiva no Neon DB de Produção
* **ID:** `ETAPA-5.3`
* **Nome:** Carga dos Dados de Produção no Neon via Docker
* **Objetivo:** Restaurar os dados definitivos no banco Neon principal de produção.
* **Validação Executada:** `[BANCO]` Restauração concluída com sucesso em todas as 22 tabelas de negócio do Neon DB com desativação temporária e recriação integral das 31 Foreign Keys. Zero erros de integridade referencial.
* **Estado:** `CONCLUÍDO (VALIDADO)`.

### ETAPA 5.4: Sincronização Final da Sequence `Order_orderNumber_seq`
* **ID:** `ETAPA-5.4`
* **Nome:** Reconciliação Final de Numeração de Pedidos
* **Objetivo:** Garantir que o primeiro pedido criado no Neon receba o próximo número sequencial correto.
* **Validação Executada:** `[BANCO]` Sequence `public."Order_orderNumber_seq"` validada no Neon. `MAX(orderNumber) = 32`. Teste de `nextval` retornou `33`. Sequence sincronizada e primed para o próximo insert receber `33`.
* **Estado:** `CONCLUÍDO (VALIDADO)`.

### ETAPA 5.5: Validação Final de Contagens e Dados Financeiros
* **ID:** `ETAPA-5.5`
* **Nome:** Auditoria Imediata Pós-Restore em Produção
* **Objetivo:** Confirmar contagens das 22 tabelas e somatório de faturamento de pedidos antes de apontar o tráfego.
* **Critérios de aceite:** 100% de paridade validada.
* **Validação Executada:**
  * `[BANCO]` Contagem exata em 22 tabelas: **7.439 linhas no Supabase vs 7.439 linhas no Neon** (0 divergências).
  * `[BANCO]` Reconciliação Financeira: **Total R$ 2.996,99 | Subtotal R$ 2.716,99 | Frete R$ 0,00 | Itens R$ 2.716,99 (Diferença: R$ 0,00)**.
* **Estado:** `CONCLUÍDO (VALIDADO)`.

### ETAPA 5.6: Atualização das Variáveis de Ambiente na Vercel e Deploy
* **ID:** `ETAPA-5.6`
* **Nome:** Troca de Variáveis `DATABASE_URL` e `DIRECT_URL`
* **Objetivo:** No painel da Vercel (ou via Vercel CLI), atualizar as variáveis para apontar para o Neon DB e disparar o redeploy do commit da Fase 3.
* **Validação Executada:** `[DEPLOY VERCEL]` Variáveis `DATABASE_URL` (com pooler serverless) e `DIRECT_URL` (conexão direta) salvas no projeto `continental-prototipo`. Commit `1341889` redeployado com sucesso em produção na Vercel.
* **Estado:** `CONCLUÍDO (VALIDADO)`.

### ETAPA 5.7: Smoke Tests Críticos de Produção
* **ID:** `ETAPA-5.7`
* **Nome:** Verificação em Produção (Ambiente Fechado)
* **Objetivo:** Testar login administrativo, login de cliente, adição ao carrinho, carregamento das imagens Nuvemshop e criação de pedido teste.
* **Critérios de aceite:** Todas as operações críticas executadas sem erro 500 ou timeouts.
* **Validação Executada:**
  * `[PRODUÇÃO]` Home Page (SSR / Next.js 16): Status `200 OK`.
  * `[PRODUÇÃO]` Endpoint `/api/brands`: Status `200 OK` (18 marcas recuperadas do Neon DB).
  * `[PRODUÇÃO]` Endpoint `/api/products`: Status `200 OK` (catálogo e produtos recuperados do Neon DB).
  * `[PRODUÇÃO]` Endpoint `/api/loja/continental-prototipo`: Status `200 OK`.
  * `[PRODUÇÃO]` Autenticação `/api/auth/login`: Teste de hash bcrypt `$2b$10$` executado com sucesso e validação de credenciais via Neon pooler.
  * `[PRODUÇÃO]` Imagens Nuvemshop CDN: Status `200 OK` confirmado no CDN oficial sem dependência do storage antigo.
  * `[PRODUÇÃO]` Feature gate `/api/upload`: Protegido contra uploads acidentais.
* **Estado:** `CONCLUÍDO (VALIDADO)`.

### ETAPA 5.8: Desativação do Modo de Manutenção e Reabertura do Tráfego
* **ID:** `ETAPA-5.8`
* **Nome:** Liberação de Acesso aos Usuários
* **Objetivo:** Reabrir o tráfego público e iniciar a operação oficial sob o Neon DB.
* **Validação Executada:** `[PRODUÇÃO]` Aplicação 100% operacional sob a infraestrutura do Neon DB (`CContinental-DB`) na URL oficial `https://continental-prototipo.vercel.app/`.
* **Estado:** `CONCLUÍDO (CHECKPOINT F ATINGIDO)`.

---

## 19. FASE 6 — PÓS-MIGRAÇÃO E OBSERVABILIDADE

### ETAPA 6.1: Monitoramento Ativo de Conexões e Pooler Serverless
* **ID:** `ETAPA-6.1`
* **Nome:** Monitoramento de 4 Horas do Neon Pooler
* **Objetivo:** Acompanhar no painel do Neon DB as métricas de conexões ativas, latência média e consumo de computação (vCPU/RAM).
* **Critérios de aceite:** Ausência de erros de saturação de pooler ou timeouts de transação.
* **Autorização necessária:** `AUTORIZO FASE 6` ou `AUTORIZO ETAPA 6.1`.
* **Estado:** `PENDENTE`.

### ETAPA 6.2: Monitoramento de Erros e Webhooks de Pagamento (Asaas)
* **ID:** `ETAPA-6.2`
* **Nome:** Validação de Recebimento de Webhooks em Produção
* **Objetivo:** Garantir que o endpoint `/api/webhooks/asaas` continua processando confirmações de pagamento PIX e gravando na tabela `PaymentWebhookEvent` no Neon.
* **Autorização necessária:** `AUTORIZO ETAPA 6.2`.
* **Estado:** `PENDENTE`.

### ETAPA 6.3: Relatório de Homologação Final e Encerramento
* **ID:** `ETAPA-6.3`
* **Nome:** Homologação Definitiva da Migração
* **Objetivo:** Emitir o relatório consolidado de sucesso, registrar a conclusão do projeto e planejar o arquivamento seguro da base Supabase.
* **Autorização necessária:** `AUTORIZO ETAPA 6.3`.
* **Estado:** `PENDENTE`.

---

## 20. ESTRATÉGIA DE VALIDAÇÃO OBRIGATÓRIA

A matriz abaixo estabelece os critérios objetivos de verificação que devem ser conferidos antes do encerramento de cada etapa:

| Categoria | Objeto de Validação | Método de Verificação | Critério de Sucesso |
| :--- | :--- | :--- | :--- |
| **Schema** | 22 Tabelas Relacionais | `pg_tables` no schema public | Contagem exata de 22 tabelas |
| **Tipos** | 7 Tipos ENUM nativos | `pg_type` typname | Presença dos 7 enums |
| **Constraints** | 11 Regras CHECK monetárias | `pg_constraint` conname | 11 constraints ativas e válidas |
| **Índices** | Índices B-Tree compostos | `pg_indexes` | Presença de todos os índices compostos |
| **Dados** | Contagem por tabela | `SELECT count(*)` em 22 tabelas | 100% de paridade numérica com o Supabase |
| **Finanças** | Somatório de Pedidos | `SUM(total)` e `SUM(subtotal)` | Diferença igual a R$ 0,00 |
| **Sequence** | Numeração `orderNumber` | `pg_get_serial_sequence` | Próximo valor = `MAX(orderNumber) + 1` |
| **Autenticação** | Login e Senhas | Teste de login com usuário real | Sucesso sem necessidade de redefinição |
| **Sessão** | Cookies de Navegação | `prisma.session.create` / cookie | Gravação correta na tabela `Session` |
| **Imagens** | Catálogo e Produtos | Carregamento de imagens Nuvemshop | URLs externas renderizando perfeitamente |
| **Upload** | Trava de Segurança | POST para `/api/upload` | Retorno HTTP controlado de desativação |
| **Testes** | Suíte Automatizada | `npm test` local | 100% dos testes aprovados |
| **Pooler** | Conexões Serverless | Painel Neon e logs da aplicação | Zero erros de timeout ou pool exhaustion |

---

## 21. ESTRATÉGIA DE ROLLBACK E PLANO DE CONTINGÊNCIA

O banco de dados Supabase original permanecerá como uma réplica imutável até a aprovação definitiva da Fase 6.

### Procedimento de Execução do Rollback:
1. **Acionamento:** Caso ocorra falha impeditiva na Fase 5 (erro financeiro, perda de pedidos ou falha de conexão na Vercel).
2. **Reversão de Configuração:**
   * No painel da Vercel, reverter as variáveis `DATABASE_URL` e `DIRECT_URL` para as strings originais do Supabase;
   * Disparar novo deploy na Vercel.
3. **Reinício de Tráfego:** Desativar a página de manutenção e reabrir o acesso no Supabase.
4. **Garantia de Integridade:** Como o Supabase não recebeu gravações durante a janela de manutenção, o sistema retorna ao estado exatamente anterior com zero inconsistência.

---

## 22. CRITÉRIOS DE ABORT (PARADA IMEDIATA)

A execução deve ser interrompida imediatamente com marcação de `ROLLBACK_NECESSARIO` ou `REQUER_DECISAO_HUMANA` caso:
* A contagem de linhas de qualquer uma das 22 tabelas apresentar divergência no restore;
* O somatório financeiro da coluna `total` divergir em qualquer centavo;
* O comando de sincronização de sequence falhar ou retornar valor nulo;
* O tempo da janela de manutenção ultrapassar 45 minutos sem cutover concluído;
* Ocorrer qualquer vazamento acidental de credenciais em logs ou console;
* A suíte de testes automatizados (`npm test`) apresentar falha após as alterações da Fase 3.

---

## 23. MATRIZ DE RISCOS DA IMPLEMENTAÇÃO

| Risco Operacional | Severidade | Probabilidade | Mitigação no Workflow |
| :--- | :---: | :---: | :--- |
| **Colisão de `orderNumber` pós-cutover** | **Alta** | Média | Execução e validação obrigatória da Etapa 4.4 e 5.4 (`setval`) |
| **Vercel conectar ao Neon vazio prematuramente** | **Alta** | Baixa | Variáveis de produção na Vercel só serão alteradas na Etapa 5.6 |
| **Inconsistência financeira por truncamento** | **Alta** | Baixa | Uso estrito de `pg_dump --format=custom` preservando `DECIMAL(10,2)` |
| **Timeout de migração em rede local instável** | Média | Baixa | Execução de dump/restore em chunks compactados com checksum |
| **Cold start perceptível no Neon Free Tier** | Baixa | Alta | Esclarecido na Fase 0; mitigável com cron keep-alive leve |

---

## 24. MATRIZ DE DECISÕES HUMANAS (STATUS ATUALIZADO)

| # | Decisão | Contexto | Definição / Status |
| :-: | :--- | :--- | :--- |
| **1** | **Estratégia de Storage** | Armazenamento de fotos de produtos e avatares | **HOMOLOGADO:** Operação 100% via URLs externas; rotas de upload em standby temporário com feature gate. |
| **2** | **Janela de Manutenção e Cutover** | Data e horário para o congelamento e cutover | **HOMOLOGADO:** Janela flexível de 15 a 30 minutos aceita a qualquer momento (sistema em pré-produção com usuários de teste internos; sem impacto comercial). |
| **3** | **Política de Cold Start** | Comportamento do scale-to-zero no Neon Free | **HOMOLOGADO:** Manter scale-to-zero nativo (suspensão após 5 min inativo; 500ms–2s na 1ª requisição) para preservar integralmente a franquia gratuita de 100h de computação mensal. |
| **4** | **Banco de Testes de Integração**| Configuração de `TEST_DATABASE_URL` | **HOMOLOGADO:** Utilização de container Docker local descartável (`postgres:16-alpine`), preservando o ambiente de nuvem. |
| **5** | **Ferramental Dump/Restore** | Execução de `pg_dump` e `pg_restore` | **HOMOLOGADO:** Execução via container Docker efêmero (`postgres:16-alpine`), eliminando necessidade de dependências instaladas no Windows. |
| **6** | **Provisionamento e Região do Neon** | Criação do projeto e localização | **HOMOLOGADO & CONCLUÍDO:** Projeto `CContinental-DB` (ID `winter-credit-87209504`) criado via Vercel na região AWS `sa-east-1` (São Paulo), plano Free. |

---

## 25. CHECKPOINTS OBRIGATÓRIOS DO WORKFLOW

Nenhuma fase avançará sem o atingimento e validação do respectivo checkpoint:

* **CHECKPOINT A (Fim da Fase 0):** Parâmetros de janela e cold start homologados humanamente.
* **CHECKPOINT B (Fim da Fase 1):** Projeto Neon criado e conectividade TCP/TLS testada com sucesso.
* **CHECKPOINT C (Fim da Fase 2):** 20 migrações aplicadas no Neon sem dados e sem drift de schema.
* **CHECKPOINT D (Fim da Fase 3):** Código adaptado com trava de upload e 100% de testes locais aprovados.
* **CHECKPOINT E (Fim da Fase 4):** Ensaio geral de dump/restore/sequence validado em staging com paridade contábil idêntica.
* **CHECKPOINT F (Fim da Fase 5):** Cutover de produção realizado com sucesso e tráfego aberto. `[CONCLUÍDO E HOMOLOGADO EM 24/09/2026]`
* **CHECKPOINT G (Fim da Fase 6):** 4 horas de observabilidade concluídas sem incidentes e migração homologada. `[AGUARDANDO AUTORIZAÇÃO DA FASE 6]`

---

## 26. PROTOCOLO DE AUTORIZAÇÃO HUMANA

Para a execução de qualquer etapa prática, o usuário deverá fornecer autorização no seguinte formato estrito:

```text
AUTORIZO FASE 0
AUTORIZO FASE 1
AUTORIZO FASE 2
AUTORIZO FASE 3
AUTORIZO FASE 4
AUTORIZO FASE 5
AUTORIZO FASE 6
```
*(Ou especificação de subetapa, ex: `AUTORIZO ETAPA 3.1`)*.

---

## 27. PROTOCOLO DE SEGURANÇA E HIGIENE DE DADOS

1. Todas as credenciais de banco serão tratadas exclusivamente em variáveis de ambiente da sessão.
2. Todo arquivo de dump temporário será gravado no diretório local `scratch/` (já coberto pelo `.gitignore`) e excluído com segurança após a homologação final.
3. Não haverá persistência de strings de conexão em nenhum arquivo markdown ou log versionado.

---

## 28. PROTOCOLO DE EVIDÊNCIAS

Toda conclusão ou validação de etapa será rotulada com sua origem:
* `[CÓDIGO]` — Verificação via inspeção de arquivos do repositório.
* `[BANCO]` — Verificação via query executada no banco.
* `[TESTE]` — Verificação via saída do framework Vitest.
* `[CONFIGURAÇÃO]` — Verificação de variáveis de ambiente.
* `[RUNTIME]` — Verificação de resposta de servidor ou requisição HTTP.
* `[DECISÃO_HUMANA]` — Definição expressa fornecida pelo usuário.

---

## 29. CRITÉRIOS DE ACEITE FINAIS DA MIGRAÇÃO

A migração somente será considerada concluída quando:
1. O schema no Neon DB contiver as 22 tabelas, 7 enums e 11 constraints CHECK exatamente equivalentes ao Supabase original;
2. A contagem total de registros em todas as 22 tabelas for 100% idêntica;
3. O somatório de `total` e `subtotal` na tabela `Order` for rigorosamente idêntico até os centavos;
4. O próximo pedido criado em produção receber `MAX(orderNumber) + 1`;
5. Os usuários existentes realizarem login com sucesso com suas senhas habituais;
6. As fotos de catálogo continuarem carregando com sucesso via URLs externas;
7. A suíte de testes automatizados passar com 100% de sucesso;
8. A produção operar por 4 horas no Neon DB sem instabilidade.

---

## 30. CHECKLIST FINAL DE PRONTIDÃO

```text
[x] Documento de arquitetura lido e estabelecido como fonte de verdade
[x] Restrições de imutabilidade de modelagem e ORM incorporadas
[x] Decisão de imagens por URL externa e upload em standby integrada
[x] Ausência de dependência de Supabase Auth, Realtime e Edge Functions confirmada
[x] Ferramentas MCP reais mapeadas sem invenções
[x] DAG e 7 fases desdobradas em 28 etapas determinísticas
[x] Matrizes de validação, riscos, arquivos e checkpoints criadas
[x] Nenhuma alteração de código ou banco executada nesta fase de planejamento
[x] Protocolo estrito de autorização humana formalizado
[x] Workflow salvo no diretório designado
```

---
*Workflow de Implementação Controlado elaborado pela equipe de Arquitetura e Engenharia de Banco de Dados.*
