# Auditoria de Infraestrutura, Configuração e Deploy — Etapa 11/15

**Relatório:** `docs/audits/INFRASTRUCTURE-AUDIT.md`  
**Data:** 2026-09-26  
**Revisão analisada:** `0c7ef7d`  
**Escopo:** artefatos versionados de build, CI/CD, ambientes, variáveis, deploy, migrações, proxy, health checks, observabilidade, backups/restauração e rollback  
**Fora do escopo:** acesso a produção, painel de cloud, banco real, cofres de segredos, DNS, provedores externos e qualquer alteração no código de produto ou infraestrutura

## Executive Summary

O repositório contém uma aplicação Next.js 16 configurada para saída `standalone`, PostgreSQL via Prisma e um único workflow GitHub Actions. O workflow instala dependências, valida o schema Prisma, executa typecheck, testes unitários e build; apesar do nome “CI/CD”, não contém deploy, promoção de artefato, aplicação de migrações, smoke test ou rollback. Também não há Dockerfile, Compose, manifesto Vercel, Kubernetes, Terraform ou configuração equivalente que torne o runtime e o deploy reproduzíveis apenas a partir desta revisão. Uma plataforma externa pode suprir parte desses controles, mas isso exige verificação de infraestrutura.

Há dois bloqueios confirmados. Primeiro, as 20 migrações Prisma versionadas criam somente 16 dos 22 modelos do schema atual; `StockSyncLog`, `Brand`, `CategoryTag`, `ProductCategoryTag`, `JtExpressGeocom` e `JtExpressRate` não são criados por nenhuma migração. Portanto, um banco novo ou uma restauração baseada exclusivamente no histórico versionado não reproduz o schema que o código espera. Segundo, existe migração destrutiva que remove colunas e adiciona colunas obrigatórias sem default ou backfill; o próprio SQL gerado registra que sua aplicação é impossível sobre tabelas não vazias em determinadas condições.

Outros riscos relevantes incluem: script e documentação com credencial administrativa determinística; fallback de e-mail que pode registrar em log o conteúdo completo de recuperação de senha; script de RLS fora do formato de migração e incompleto para tabelas atuais; rotinas cron sem agenda versionada; endpoint mutável de simulação protegido apenas por `NODE_ENV`; contrato de variáveis incompleto; inexistência de readiness/liveness versionados; e ausência de evidência local de backup, restore testado, telemetria externa e política de rollback.

Esta auditoria não afirma que os serviços externos estejam ausentes ou incorretos. Onde o repositório não permite confirmar a realidade operacional, o estado está marcado como **REQUIRES INFRASTRUCTURE VERIFICATION**.

### Resumo por severidade

| Severidade | Quantidade |
|---|---:|
| BLOCKER | 1 |
| CRITICAL | 1 |
| HIGH | 6 |
| MEDIUM | 6 |
| LOW | 0 |
| INFORMATIONAL | 0 |
| **Total** | **14** |

### Publication Blockers

1. **INF-001 (BLOCKER):** o histórico de migrações não reconstrói o schema canônico.
2. **INF-002 (CRITICAL):** há migração destrutiva e não compatível com banco populado, sem plano versionado de expansão/backfill/contração.

Além desses bloqueios, recomenda-se não publicar até verificar e, quando aplicável, rotacionar a credencial de `INF-005`, tornar o provedor de e-mail fail-closed em produção (`INF-006`) e impedir que o simulador de pagamento alcance qualquer ambiente público (`INF-009`).

## 1. Metodologia

1. Leitura de `AGENTS.md`, documentação técnica, `package.json`, lockfile, configurações Next/Prisma, `.env.example`, workflow e código de integração operacional.
2. Inventário de artefatos de container, proxy, plataforma, IaC, CI/CD, jobs agendados, health checks, observabilidade, backup e rollback.
3. Comparação mecânica entre modelos de `prisma/schema.prisma` e tabelas criadas por `prisma/migrations/**/migration.sql`.
4. Leitura manual das migrações destrutivas, do script de RLS, dos fallbacks de configuração, do resolvedor de tenant, dos endpoints cron e do simulador de pagamento.
5. Comparação entre chaves usadas por `process.env`/Prisma e chaves documentadas em `.env.example`, sem ler valores de arquivos de ambiente reais.
6. Varredura de material sensível com saída mascarada. Nenhum segredo foi validado contra serviço externo e nenhum valor é reproduzido neste relatório.
7. Tentativa local de build sem instalar dependências. Não foram executados deploy, migração, seed, restore, carga, chamada a endpoint ou acesso a rede.

A skill de prevenção de perda acidental de dados foi aplicada: migrações, restores e scripts capazes de alterar banco foram limitados à inspeção estática. Nenhuma operação destrutiva foi executada.

### Critério de evidência

- **CONFIRMED:** comportamento ou ausência observável diretamente nos arquivos/comandos locais.
- **HIGH CONFIDENCE:** evidência forte no repositório, mas a manifestação depende de estado externo não consultado.
- **SUSPECTED:** risco plausível dependente de configuração de proxy/plataforma não versionada.
- **NOT VERIFIED:** não existe evidência suficiente no repositório para afirmar o estado real.
- **REQUIRES INFRASTRUCTURE VERIFICATION:** confirmação exige painel, configuração ou teste autorizado fora deste repositório.

Ausência de manifesto no repositório não prova ausência de controle no provedor. Da mesma forma, ausência de teste não foi convertida automaticamente em vulnerabilidade.

## 2. Inventário observado

### 2.1 Runtime, build e persistência

| Item | Evidência | Estado |
|---|---|---|
| Runtime declarado | Node 20 no CI; documentação declara Node 20/22 | Confirmado no repositório |
| Framework | Next `^16.3.5`, React 18 | Confirmado em `package.json:17-43` |
| Build | `prisma generate && next build` | Confirmado em `package.json:5-15` |
| Artefato | `output: 'standalone'` | Confirmado em `next.config.js:1-4` |
| Banco/ORM | PostgreSQL, Prisma 5.22, URLs pooler/direta separadas | Confirmado em `prisma/schema.prisma:4-12`; provedor hospedado é declarado pela documentação |
| Lockfile | `package-lock.json` presente | Confirmado |
| Container | Dockerfile/Compose ausentes | Confirmado no repositório; pode ser não aplicável ao provedor |
| Plataforma/IaC | Sem `vercel.json`, Terraform, Kubernetes, Helm, Railway, Render ou Fly | Confirmado no repositório |
| Health/readiness | Nenhuma rota ou manifesto de probe encontrado | Confirmado no repositório |

### 2.2 Pipeline real versionado

```text
push/PR em main|master|develop
  -> checkout por tag
  -> Node 20 + cache npm
  -> npm ci
  -> prisma validate
  -> tsc --noEmit
  -> testes unitários
  -> next build
  -> [fim do workflow]
```

Não há no workflow uma etapa seguinte de publicação, migração, criação/upload de artefato, promoção, aprovação de ambiente, smoke test ou rollback (`.github/workflows/ci.yml:1-42`). O destino operacional é apenas sugerido como Vercel por documentação e por ramificações do resolvedor de tenant; não há manifesto que comprove o projeto, ambientes ou políticas implantadas.

### 2.3 Dependências e limites operacionais

```text
Browser
  -> ingress/CDN/proxy externo [não versionado]
  -> Next.js standalone [configurado]
     -> Prisma -> PostgreSQL/pooler [declarado]
     -> Asaas API/webhook [código]
     -> Resend [código; fallback local]
     -> Supabase Storage [código; feature gate]
     -> stdout/stderr [logger local]
     -> scheduler externo -> rotas cron [scheduler não versionado]
```

As fronteiras em colchetes dependem de configuração externa. TLS, WAF, CDN, autoscaling, limites de função, pool, regiões, IAM, retenção de logs, alertas, domínios e regras de rede não são comprováveis por esta revisão.

### 2.4 Ambientes e configuração

| Ambiente | Evidência versionada | Lacuna |
|---|---|---|
| Desenvolvimento | `.env.example`, `next dev`, fallbacks locais | Sem validação central de variáveis |
| Teste CI | banco e segredo fictícios definidos no job; apenas unit tests | Sem serviço PostgreSQL e sem integração/E2E |
| Preview/staging | comportamento especial para `*.vercel.app` | Sem environment, secrets, agenda ou aprovação versionados |
| Produção | ramos condicionados a `NODE_ENV === 'production'` | Sem manifesto de deploy, startup validation ou prova dos valores efetivos |

O `.gitignore:1-8` exclui arquivos `.env` e preserva apenas o exemplo, o que é um controle positivo. Entretanto, o contrato do exemplo diverge do uso real, conforme `INF-010`.

### 2.5 Migrações

| Item | Resultado local |
|---|---:|
| Diretórios timestampados | 20 |
| Arquivos `migration.sql` timestampados | 20 |
| Script SQL solto | 1 (`supabase_rls_hardening.sql`) |
| Modelos no schema | 22 |
| Tabelas distintas criadas pelas migrações | 16 |
| Modelos sem `CREATE TABLE` versionado | 6 |

Não existe script em `package.json` nem passo no workflow para `prisma migrate deploy`. O build gera o Prisma Client, mas não aplica migrações (`package.json:7`; `.github/workflows/ci.yml:29-42`).

## 3. Verificações locais e resultados reproduzíveis

### 3.1 Ambiente e revisão

```powershell
git rev-parse --short HEAD
node --version
npm --version
Test-Path node_modules
Test-Path .next
```

Resultado: revisão `0c7ef7d`, Node `v24.16.0`, npm `11.13.0`, `node_modules=False`, `.next=False`.

### 3.2 Inventário de infraestrutura

```powershell
rg --files -g 'Dockerfile*' -g '*docker-compose*' -g 'compose*.yml' `
  -g 'vercel.json' -g 'fly.toml' -g 'Procfile' -g 'netlify.toml' `
  -g 'k8s/**' -g 'helm/**' -g 'terraform/**' -g '.github/workflows/**'
Get-ChildItem prisma/migrations -Directory
Get-ChildItem prisma/migrations -File -Filter '*.sql'
```

Resultado: um workflow versionado (`.github/workflows/ci.yml`), nenhum dos manifestos de runtime/IaC listados, 20 diretórios de migração e um SQL solto.

### 3.3 Comparação schema × histórico

Foi executado um script Node somente leitura que:

1. extrai `model <Nome>` de `prisma/schema.prisma`;
2. lê os 20 `migration.sql` rastreados pelo Git;
3. extrai `CREATE TABLE` e `CREATE TABLE IF NOT EXISTS`;
4. calcula a diferença.

Resultado: 22 modelos, 16 tabelas criadas e seis ausências: `StockSyncLog`, `Brand`, `CategoryTag`, `ProductCategoryTag`, `JtExpressGeocom`, `JtExpressRate`.

### 3.4 Contrato de ambiente

Uma varredura somente de nomes encontrou 27 chaves usadas e 20 documentadas. Dez chaves usadas não aparecem em `.env.example`: `ASAAS_MIN_VALUE`, `BOLETO_DUE_DAYS`, `DEFAULT_LOJA_SLUG`, `ENABLE_DIRECT_UPLOAD`, `INSTALLMENT_ABSORB_FEES`, `INSTALLMENT_MAX_COUNT`, `INSTALLMENT_MIN_VALUE`, `INSTALLMENT_MONTHLY_RATE`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e a chave exclusiva de testes `TEST_BASE_URL`. Nenhum valor foi lido ou exibido.

### 3.5 Build local

```powershell
npm run build
```

Resultado: exit 1 antes do build porque o executável local `prisma` não está disponível; `node_modules` não existe. Não foi executado `npm ci`, pois isso exigiria acesso ao registry e não era necessário para a análise estática. Logo, build, `prisma validate`, testes e comportamento do servidor não foram confirmados nesta etapa.

### 3.6 Consultas negativas

Buscas locais não encontraram:

- rota de `health`, `readiness` ou `liveness` no produto;
- configuração de probes;
- etapa de deploy, `migrate deploy`, artefato, smoke ou rollback no workflow;
- configuração direta de Sentry/OpenTelemetry/exportador/métricas (há apenas referências transitivas a `@opentelemetry/api` no lockfile);
- arquivos de backup, restore ou PITR fora de documentação de ferramentas não relacionada ao produto;
- referência executável ao script `supabase_rls_hardening.sql`.

## 4. Findings

### INF-001 — Histórico de migrações não reconstrói o schema canônico

- **Severidade:** BLOCKER
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `prisma/schema.prisma:397-415`, `470-517`, `519-550`; ausência confirmada em `prisma/migrations/**/migration.sql`
- **Fluxo e condição de manifestação:** provisionamento de banco vazio, recuperação de desastre, ambiente efêmero ou deploy que confie em `prisma migrate deploy`.
- **Evidência observada (fato):** o schema possui 22 modelos, enquanto o histórico cria 16 tabelas. Não existe `CREATE TABLE` para `StockSyncLog`, `Brand`, `CategoryTag`, `ProductCategoryTag`, `JtExpressGeocom` ou `JtExpressRate`.
- **Hipótese separada:** o banco atualmente usado pode conter essas tabelas criadas por `db push` ou SQL manual; isso não foi verificado e não torna o repositório recuperável.
- **Impacto:** ambientes novos podem compilar o client e falhar em runtime; restore/DR baseado no repositório produz banco estruturalmente incompleto; deploys deixam de ser determinísticos.
- **Correção proposta:** gerar migrações aditivas explícitas para os seis modelos a partir de um baseline conhecido; revisar dados/constraints; validar a cadeia completa em PostgreSQL descartável; nunca usar `db push` como substituto do histórico de produção.
- **Teste de regressão:** criar banco vazio, executar somente as migrações versionadas e comparar o resultado com `schema.prisma` via `prisma migrate diff` ou inspeção equivalente; executar smoke das rotas que usam cada tabela.
- **Risco residual:** um banco real pode ter drift adicional em colunas, índices, constraints, extensões e grants; a comparação de nomes de tabela não exclui essas diferenças.

### INF-002 — Migração destrutiva é incompatível com dados existentes e não tem plano de rollout

- **Severidade:** CRITICAL
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `prisma/migrations/20260513203715_/migration.sql:1-16`, `21-58`, `84-115`; `prisma/migrations/20260522000000_monetary_decimal_and_check_constraints/migration.sql:6-69`
- **Fluxo e condição de manifestação:** aplicação da cadeia sobre banco com pedidos/itens existentes ou dados que violem novas unicidades/constraints.
- **Evidência observada (fato):** o SQL remove cinco colunas de `OrderItem`, descarta FKs/índices, adiciona quatro colunas obrigatórias sem default/backfill e cria índices únicos que podem falhar com duplicatas. Os avisos do próprio arquivo dizem que a operação não é possível se as tabelas estiverem preenchidas. Outra migração converte tipos monetários e valida checks diretamente sobre dados existentes. Não há `BEGIN/COMMIT` explícito nem roteiro versionado de preflight/backfill.
- **Hipótese separada:** se a migração já foi aplicada apenas quando o banco estava vazio, o incidente pode não ter ocorrido. O estado da tabela `_prisma_migrations` é **REQUIRES INFRASTRUCTURE VERIFICATION**.
- **Impacto:** indisponibilidade no deploy, migração parcial conforme o mecanismo de execução, perda de snapshots históricos de item, lock prolongado ou rollback manual inseguro.
- **Correção proposta:** substituir rollout futuro por padrão expand/backfill/validate/contract; preservar colunas antigas até validar a cópia; executar preflight de duplicatas e nulos; definir janela, backup verificável, limite de lock/statement e plano de reversão. Não reescrever silenciosamente migração já aplicada: criar migrações corretivas versionadas conforme o estado real.
- **Teste de regressão:** restaurar fixture descartável com dados representativos e duplicatas deliberadas; aplicar a cadeia; conferir contagens, hashes/snapshots, constraints e tempo de lock; simular falha entre fases e comprovar retomada/rollback.
- **Risco residual:** DDL em tabelas comerciais continua sujeito a lock e volume real; homologação com fixture pequena não substitui ensaio sobre cópia anonimizada e autorizada.

### INF-003 — Workflow chamado CI/CD termina no build e não controla promoção, migração ou rollback

- **Severidade:** HIGH
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `.github/workflows/ci.yml:1-42`; `package.json:5-15`
- **Fluxo e condição de manifestação:** qualquer release originado desta revisão.
- **Evidência observada (fato):** o único job executa checkout, instalação, validação Prisma, typecheck, testes unitários e build. Não há lint, integração/E2E, artefato imutável, deploy, environment approval, `migrate deploy`, smoke, promoção ou rollback. `package.json` também não oferece scripts operacionais.
- **Hipótese separada:** a hospedagem pode fazer deploy automático por integração fora do GitHub; esse caminho, seu artefato e seus gates são **REQUIRES INFRASTRUCTURE VERIFICATION**.
- **Impacto:** código e schema podem ser publicados por caminhos diferentes; migração pode ocorrer fora de ordem; o build testado pode não ser o artefato executado; recuperação depende de ação manual não documentada.
- **Correção proposta:** separar CI de CD; incluir lint e testes adequados; produzir uma vez um artefato identificado por digest; promover o mesmo artefato; aplicar migração compatível uma única vez com lock; usar approvals por ambiente, smoke pós-deploy e rollback documentado de aplicação e banco.
- **Teste de regressão:** falhas deliberadas de lint, migração e smoke devem impedir promoção; comparar digest entre staging/produção; exercitar rollback em ambiente descartável.
- **Risco residual:** rollback de código não desfaz mudança de schema incompatível; por isso migrações devem permanecer backward-compatible durante a janela de rollout.

### INF-004 — Hardening RLS está fora da cadeia de migrações e não cobre o schema atual

- **Severidade:** HIGH
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `prisma/migrations/supabase_rls_hardening.sql:7-28`, `30-62`, `64-83`; `prisma/schema.prisma:397-415`, `426-468`, `470-562`
- **Fluxo e condição de manifestação:** criação/restauração de banco ou adição de tabelas acessíveis pela Data API/roles do provedor.
- **Evidência observada (fato):** o arquivo é SQL solto, não um `migration.sql` em diretório timestampado, e não é chamado por workflow/script. Ele enumera apenas tabelas existentes à época e omite tabelas atuais, inclusive ledger de fidelidade, eventos de webhook, catálogo por marcas/tags e integração logística. Também não define privilégios padrão para objetos futuros.
- **Hipótese separada:** o SQL pode ter sido aplicado manualmente e o provedor pode possuir controles adicionais. Grants, RLS e exposição efetivos são **REQUIRES INFRASTRUCTURE VERIFICATION**.
- **Impacto:** restaurações e ambientes novos não herdam o hardening; novas tabelas podem ficar com postura diferente; há falsa sensação de proteção pelo simples fato de o arquivo existir.
- **Correção proposta:** incorporar hardening idempotente à cadeia controlada de deploy; cobrir todas as tabelas e objetos futuros (`ALTER DEFAULT PRIVILEGES` conforme roles reais); validar owner/bypass RLS e políticas; manter consulta automatizada de pós-condição.
- **Teste de regressão:** em banco descartável com roles equivalentes, aplicar todas as migrações e comprovar que `anon`/`authenticated` não leem nem escrevem nenhuma tabela sensível e que a role da aplicação mantém somente os privilégios necessários.
- **Risco residual:** owners e roles com `BYPASSRLS` podem ignorar políticas; configuração real de PostgREST/Supabase precisa ser auditada no provedor.

### INF-005 — Credencial administrativa determinística está versionada e o script pode elevar conta existente

- **Severidade:** HIGH
- **Confiança:** HIGH CONFIDENCE
- **Arquivo e linhas:** `scripts/create_test_admin.ts:4-18`, `20-35`, `44-66`; `DOCUMENTACAO_TECINICA/README.md:38-42`; `DOCUMENTACAO_TECINICA/DOCUMENTACAO_TECNICA_SISTEMA.md:209-216`
- **Fluxo e condição de manifestação:** execução manual do script contra banco compartilhado ou existência de conta previamente criada por ele.
- **Evidência observada (fato):** o script contém senha fixa mascarada neste relatório, escolhe a primeira loja retornada, cria ou atualiza a conta para `ADMIN`/`ACTIVE` e imprime a credencial. Duas documentações publicam o mesmo acesso como conta administrativa de testes/homologação.
- **Hipótese separada:** não foi tentado login e não se sabe se a conta existe em ambiente acessível. A validade e presença no histórico operacional são **REQUIRES INFRASTRUCTURE VERIFICATION**.
- **Impacto:** uma credencial conhecida pode conceder administração; execução no banco errado pode elevar conta e tenant não pretendidos; logs e histórico Git prolongam a exposição.
- **Correção proposta:** invalidar/rotacionar a credencial em todos os ambientes; remover valor fixo; exigir geração aleatória de uso único ou secret manager; adicionar guard rígido de banco de teste e tenant explícito; nunca imprimir senha; revisar histórico Git sem assumir que sua reescrita substitui rotação.
- **Teste de regressão:** secret scanning deve falhar para credenciais literais; script deve recusar URL sem marcador inequívoco de teste, tenant ausente e ambiente de produção; saída não deve conter senha.
- **Risco residual:** cópias em clones, caches e logs não podem ser consideradas apagadas; somente rotação/revogação elimina o risco da credencial antiga.

### INF-006 — Falta de chave de e-mail degrada silenciosamente para logger que expõe token de reset

- **Severidade:** HIGH
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `lib/email/index.ts:13-25`; `lib/email/providers/dev.provider.ts:16-39`, `43-50`; `services/auth.service.ts:172-198`; `lib/email/templates/password-reset.template.ts:3-7`, `115-130`
- **Fluxo e condição de manifestação:** `RESEND_API_KEY` ausente ou vazia fora de testes, inclusive em produção, seguido de solicitação de recuperação de senha.
- **Evidência observada (fato):** a seleção usa `DevEmailService` sempre que a chave não existe; o provedor retorna sucesso e, fora de `NODE_ENV=test`, registra destinatário, assunto, remetente e texto integral. O texto de reset contém a URL com token de uso único.
- **Hipótese separada:** não foi verificado se produção possui a chave nem quem acessa/retem os logs.
- **Impacto:** recuperação aparenta sucesso sem entregar e-mail; operador ou invasor com acesso a logs pode capturar link de redefinição; uma falha de configuração vira vazamento de credencial temporária.
- **Correção proposta:** em produção, falhar no startup se e-mail obrigatório estiver incompleto; permitir provider dev somente por flag explícita e ambiente local; nunca registrar corpo/destinatário/token; alertar falha de entrega sem dados sensíveis.
- **Teste de regressão:** iniciar com `NODE_ENV=production` e chave ausente deve falhar antes de aceitar tráfego; teste de captura de logs deve confirmar ausência de endereço, corpo e token; provider real deve ser mockado localmente.
- **Risco residual:** se tokens já chegaram a logs, é necessária expiração/revogação e revisão de retenção/acessos no agregador externo.

### INF-007 — Jobs comerciais existem, mas sua agenda e supervisão não são versionadas

- **Severidade:** HIGH
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `app/api/cron/orders-timeout/route.ts:9-64`, `66-119`; `app/api/cron/loyalty-expiration/route.ts:9-64`, `66-135`; ausência de scheduler nos manifestos do repositório
- **Fluxo e condição de manifestação:** pedidos pendentes precisam expirar/repor estoque ou pontos precisam expirar, mas nenhum scheduler externo invoca as rotas.
- **Evidência observada (fato):** as rotas autenticam de forma fail-closed e suportam GET/POST, mas não existe `vercel.json`, workflow agendado ou IaC que defina frequência, retry, timeout, concorrência e alertas.
- **Hipótese separada:** um scheduler pode estar configurado manualmente no provedor. Existência, frequência, último sucesso e alertas são **REQUIRES INFRASTRUCTURE VERIFICATION**.
- **Impacto:** estoque pode permanecer reservado por pedidos abandonados e passivo de pontos pode não expirar; falhas silenciosas acumulam trabalho e distorcem operação.
- **Correção proposta:** versionar o scheduler ou sua IaC; definir SLO de atraso, retry com backoff, exclusão/lock de concorrência e alertas de ausência de execução/erros; manter token em secret manager.
- **Teste de regressão:** em ambiente autorizado com relógio/fixtures controlados, comprovar periodicidade, reexecução idempotente, exclusão de concorrência e alerta quando execuções deixam de ocorrer.
- **Risco residual:** indisponibilidade simultânea do scheduler e da aplicação exige reconciliação/backfill operacional documentado.

### INF-008 — Backup, PITR, restauração e objetivos de recuperação não são verificáveis

- **Severidade:** MEDIUM
- **Confiança:** NOT VERIFIED
- **Arquivo e linhas:** nenhuma configuração/runbook de produto encontrada; `.gitignore:39-42` apenas evita versionar chaves/dumps, o que não constitui backup
- **Fluxo e condição de manifestação:** corrupção lógica, exclusão acidental, falha regional ou rollback de migração.
- **Evidência observada (fato):** o repositório não contém política, automação, RPO/RTO, retenção, criptografia, teste de restore ou responsável por recuperação.
- **Hipótese separada:** o banco gerenciado pode oferecer snapshots/PITR. Estado, retenção, região, cobertura de storage e sucesso de restore são **REQUIRES INFRASTRUCTURE VERIFICATION**. Não se conclui que backup inexista.
- **Impacto:** sem evidência testada, não é possível estimar perda máxima nem tempo de recuperação, especialmente diante de `INF-001` e `INF-002`.
- **Correção proposta:** documentar e validar RPO/RTO; habilitar e monitorar backup/PITR; incluir storage/configuração crítica; manter runbook e credenciais break-glass; realizar restore periódico em ambiente isolado.
- **Teste de regressão:** restore drill com timestamp escolhido, verificação de integridade e reconciliação de pedidos/pagamentos; medir RPO/RTO e registrar evidência sem dados pessoais.
- **Risco residual:** backup íntegro não garante recuperação de dependências externas, DNS, secrets ou eventos ocorridos após o ponto restaurado.

### INF-009 — Simulador mutável é liberado em qualquer ambiente que não seja exatamente `production`

- **Severidade:** HIGH
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `app/api/webhooks/asaas/simulate/route.ts:9-20`, `29-103`; `app/checkout/confirmation/page.tsx:417-433`
- **Fluxo e condição de manifestação:** preview/staging público ou produção com `NODE_ENV` ausente/incorreto, atacante conhece um `orderId` e envia POST sem autenticação.
- **Evidência observada (fato):** a rota bloqueia somente quando `NODE_ENV === 'production'`; fora disso não exige usuário, papel ou segredo e cria evento, altera metadados/status do pedido e pode disparar estoque/pontos. A UI também oferece o botão fora de produção.
- **Hipótese separada:** a plataforma pode forçar `NODE_ENV=production` e restringir previews por rede/autenticação. Isso é **REQUIRES INFRASTRUCTURE VERIFICATION**.
- **Impacto:** alteração não autorizada de pedidos e efeitos comerciais em ambientes conectados a dados compartilhados; erro de variável pode transportar o simulador para ambiente público.
- **Correção proposta:** excluir a rota do artefato publicável ou exigir flag explícita deny-by-default, autenticação administrativa, tenant, rede autorizada e banco exclusivamente de teste; não depender apenas de `NODE_ENV`.
- **Teste de regressão:** matriz local para production/preview/staging/variável ausente deve retornar 404/403 sem qualquer escrita; teste de build deve comprovar que a rota não está no artefato de produção.
- **Risco residual:** outras rotas/debug features condicionadas apenas a ambiente devem passar pela mesma allowlist.

### INF-010 — Contrato de variáveis é incompleto e valores críticos são aceitos sem validação central

- **Severidade:** MEDIUM
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `.env.example:7-48`; `lib/config/payment.config.ts:40-51`; `services/asaas/asaas.client.ts:27-43`; `lib/tenant.ts:93-138`; `app/api/upload/route.ts:18-25`
- **Fluxo e condição de manifestação:** build/start com variável ausente, typo ou número inválido.
- **Evidência observada (fato):** dez nomes usados não constam do exemplo; configurações financeiras fazem `parseFloat`/`parseInt` sem validar `NaN`, faixa ou coerência; Asaas usa sandbox e chave vazia como defaults; tenant e feature flags possuem defaults dispersos. Por outro lado, o exemplo documenta chaves sem referência no produto, evidenciando drift do contrato.
- **Hipótese separada:** a plataforma pode validar/injetar valores externamente, mas não há prova versionada.
- **Impacto:** comportamento diferente entre ambientes, cálculo inválido, integração apontando ao destino errado, feature inesperadamente desativada e falha tardia somente ao executar o fluxo.
- **Correção proposta:** criar schema tipado único de ambiente, separar server/public/build/test, validar presença, formato, faixas e combinações no startup/build; atualizar `.env.example` somente com placeholders e comentários de obrigatoriedade por ambiente.
- **Teste de regressão:** tabela parametrizada de variáveis ausentes, inválidas e incompatíveis deve impedir startup; snapshot automatizado deve detectar divergência entre chaves usadas e documentadas.
- **Risco residual:** validação sintática não confirma permissões, saldo, domínio ou escopo das credenciais externas.

### INF-011 — Não há liveness/readiness nem preflight de dependências críticas

- **Severidade:** MEDIUM
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `package.json:5-15`; `lib/prisma.ts:8-14`; `lib/email/index.ts:13-25`; `services/asaas/asaas.client.ts:31-43`; ausência em `app/api/**` e manifestos
- **Fluxo e condição de manifestação:** processo inicia e o balanceador o considera saudável antes de validar banco, migrações ou configuração crítica.
- **Evidência observada (fato):** não existe endpoint de liveness/readiness ou script de startup check. Prisma conecta sob demanda e integrações possuem defaults/fallbacks; logo, processo vivo não implica capacidade de checkout, reset ou persistência.
- **Hipótese separada:** a plataforma pode usar health check TCP/HTTP genérico; caminho, critérios e grace period são **REQUIRES INFRASTRUCTURE VERIFICATION**.
- **Impacto:** tráfego pode alcançar instância quebrada; rollout pode ser considerado bem-sucedido antes do primeiro fluxo real; autoscaling/restart não distingue processo vivo de dependências indisponíveis.
- **Correção proposta:** liveness barata sem dependências e readiness protegida com versão, estado de migração e consulta mínima ao banco; validar secrets obrigatórios antes de aceitar tráfego; não expor detalhes internos publicamente.
- **Teste de regressão:** banco indisponível/schema atrasado deve manter liveness conforme desenho e falhar readiness; rollout só promove após readiness e smoke.
- **Risco residual:** uma consulta simples saudável não comprova disponibilidade dos gateways; usar checks e circuit breakers proporcionais, sem causar carga externa excessiva.

### INF-012 — Observabilidade é local e parcial; coleta, métricas e alertas não são demonstráveis

- **Severidade:** MEDIUM
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `lib/logger.ts:8-18`, `31-59`, `62-156`; `app/api/checkout/route.ts:11-110`; `app/api/webhooks/asaas/route.ts:328`
- **Fluxo e condição de manifestação:** incidente distribuído em checkout, webhook, cron ou migração.
- **Evidência observada (fato):** existe logger JSON com sanitização de chaves sensíveis, um controle positivo. A saída vai apenas a console; correlação explícita foi encontrada principalmente no checkout e webhook. Não há configuração direta de exporter, tracing, métricas, dashboards, retenção ou alertas no produto/infra versionada.
- **Hipótese separada:** a plataforma pode coletar stdout e ter alertas configurados manualmente. Destino, retenção, acesso e cobertura são **REQUIRES INFRASTRUCTURE VERIFICATION**.
- **Impacto:** detecção tardia e baixa capacidade de reconstruir pedido → pagamento → webhook → estoque → pontos; crons ausentes e falhas de e-mail podem passar despercebidos.
- **Correção proposta:** propagar request/correlation ID globalmente; instrumentar métricas de negócio e dependências; configurar alertas para falha/ausência de cron, erro de pagamento/webhook, migração, saturação de pool e taxa de 5xx; documentar retenção e acesso.
- **Teste de regressão:** requisição sintética deve produzir logs correlacionados ponta a ponta e métrica/alerta controlado sem PII; validar redaction com tokens aninhados.
- **Risco residual:** cardinalidade alta e logs excessivos podem elevar custo ou vazar contexto; revisar amostragem, chaves e retenção.

### INF-013 — Workflow não explicita menor privilégio e usa actions por tags mutáveis

- **Severidade:** MEDIUM
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `.github/workflows/ci.yml:3-12`, `19-30`
- **Fluxo e condição de manifestação:** execução de workflow em push ou pull request.
- **Evidência observada (fato):** não existe bloco `permissions`; `actions/checkout` e `actions/setup-node` são referenciadas por `@v4`, não por SHA imutável. Também não há gate de dependências/secret scan no workflow.
- **Hipótese separada:** defaults restritos e políticas organizacionais podem reduzir o risco. Essas políticas são **REQUIRES INFRASTRUCTURE VERIFICATION**.
- **Impacto:** permissões efetivas dependem de configuração externa e a resolução de actions pode mudar sem alteração neste repositório; controles declarados como “Security” não executam varredura correspondente.
- **Correção proposta:** declarar `permissions: contents: read` e ampliar apenas por job quando indispensável; fixar actions por commit SHA com atualização automatizada revisada; adicionar gates de secret/dependency scanning adequados ao processo.
- **Teste de regressão:** política automatizada deve rejeitar action sem SHA, permissão ampla e workflow sem gates obrigatórios; executar PR de fork com token mínimo.
- **Risco residual:** pin de SHA reduz mudança não revisada, mas não elimina risco de action ou runner comprometido.

### INF-014 — Resolução de tenant confia em `x-forwarded-host` sem contrato versionado do proxy

- **Severidade:** MEDIUM
- **Confiança:** SUSPECTED
- **Arquivo e linhas:** `lib/tenant.ts:75-87`, `93-142`; ausência de configuração de ingress/reverse proxy
- **Fluxo e condição de manifestação:** cliente envia `x-forwarded-host` e o ingress não o remove/substitui por valor confiável.
- **Evidência observada (fato):** o código prioriza `x-forwarded-host` sobre `host` e usa o resultado para selecionar tenant, inclusive fallback de preview. Não existe manifesto de proxy no repositório que prove normalização/allowlist.
- **Hipótese separada:** Vercel ou outro ingress pode sobrescrever corretamente o cabeçalho. O comportamento real é **REQUIRES INFRASTRUCTURE VERIFICATION**.
- **Impacto:** em proxy permissivo, host spoofing pode direcionar a resolução para tenant indevido, afetando catálogo, branding e qualquer fluxo que derive contexto desse tenant.
- **Correção proposta:** definir lista de proxies confiáveis e domínios permitidos; aceitar cabeçalho encaminhado somente quando sobrescrito pelo ingress controlado; rejeitar múltiplos hosts/valores ambíguos; validar domínio customizado no processo de onboarding.
- **Teste de regressão:** no ingress real de staging autorizado, enviar `Host`/`X-Forwarded-Host` conflitantes, múltiplos e fora da allowlist; confirmar rejeição ou sobrescrita antes da aplicação.
- **Risco residual:** DNS takeover e domínio customizado expirado exigem controles externos adicionais.

## 5. Controles positivos observados

- `.env*`, chaves privadas e dumps são ignorados pelo Git (`.gitignore:1-8`, `39-42`).
- O build usa lockfile via `npm ci` no CI (`.github/workflows/ci.yml:23-30`).
- A saída Next é `standalone` (`next.config.js:1-4`).
- `DATABASE_URL` e `DIRECT_URL` são separadas no schema (`prisma/schema.prisma:8-12`).
- Os endpoints cron falham fechados sem `CRON_SECRET` e comparam token em tempo constante (`app/api/cron/orders-timeout/route.ts:9-63`; `app/api/cron/loyalty-expiration/route.ts:9-63`).
- O cliente Asaas tem timeout de oito segundos e bloqueia chave de produção apontada ao sandbox (`services/asaas/asaas.client.ts:31-43`, `53-68`).
- O logger estruturado mascara campos por nome e CPF/CNPJ antes da emissão (`lib/logger.ts:20-59`). Isso não neutraliza o logger bruto do provider de e-mail descrito em `INF-006`.
- Headers de segurança, incluindo HSTS, são declarados em `next.config.js:37-80`; sua entrega efetiva pelo ingress não foi testada.

## 6. Dívida priorizada

| Prioridade | Ação | Findings |
|---|---|---|
| P0 | Reconstruir uma cadeia de migrações completa e testá-la em banco descartável populado | INF-001, INF-002 |
| P0 | Rotacionar/verificar conta administrativa fixa, bloquear fallback de e-mail e retirar simulador de ambientes públicos | INF-005, INF-006, INF-009 |
| P1 | Versionar CD, migração, artefato, smoke, scheduler e rollback | INF-003, INF-007 |
| P1 | Integrar hardening RLS à cadeia e verificar grants reais | INF-004 |
| P1 | Confirmar backup/PITR e executar restore drill | INF-008 |
| P2 | Centralizar schema de ambiente e health/readiness | INF-010, INF-011 |
| P2 | Fechar observabilidade, supply chain e contrato do proxy | INF-012, INF-013, INF-014 |

## 7. Dependências de infraestrutura — REQUIRES INFRASTRUCTURE VERIFICATION

Antes de publicação, obter evidência autorizada e sem expor segredos para:

1. provedor e projeto efetivamente usados, ambientes, regiões, runtime, limites e autoscaling;
2. valores presentes/ausentes e escopo das variáveis, com rotação das credenciais identificadas, sem copiá-las ao relatório;
3. estado de `_prisma_migrations`, drift real, roles, grants, RLS e exposição da Data API;
4. backup/PITR, retenção, criptografia, última restauração testada, RPO e RTO;
5. scheduler dos dois crons, frequência, última execução, retries e alertas;
6. proteção de previews/staging e valor efetivo de `NODE_ENV`;
7. regras do ingress para `Host`/`X-Forwarded-Host`, TLS, WAF, CORS/CDN e domínios customizados;
8. coleta de logs, redaction, acesso, retenção, métricas, traces e alertas;
9. política GitHub de token, branch protection, environments, reviewers e provenance de artefato;
10. plano de deploy/rollback realmente usado e compatibilidade de schema entre versões N e N-1.

## 8. Itens não aplicáveis ou não verificáveis

### Não aplicáveis ao repositório atual

- **Dockerfile/Compose:** não existem; portanto não há base image, usuário, capabilities, healthcheck ou secrets de container a revisar. Isso não é defeito isolado se a plataforma constrói diretamente o app.
- **Kubernetes/Helm:** não existem; probes, requests/limits, RBAC e policies Kubernetes não se aplicam ao material versionado.
- **Terraform/Pulumi/CloudFormation:** não existem; não foi possível revisar IAM, rede, banco, buckets ou políticas como código.
- **Reverse proxy próprio:** não há Nginx/Traefik/Caddy; apenas `proxy.ts`, que é a convenção de aplicação do Next, não um manifesto de ingress.
- **Filas/cache dedicados:** nenhuma configuração de broker ou Redis foi encontrada; não se presume serviço externo inexistente.

### Não verificados

- build, testes e `prisma validate`, porque dependências não estavam instaladas;
- deploy real, painel Vercel/cloud, produção e qualquer endpoint;
- banco real, migrações aplicadas, volume/locks, pool e backups;
- validade das credenciais encontradas, deliberadamente não testada;
- DNS, TLS, CDN/WAF, storage, e-mail, Asaas e Supabase;
- performance, alta disponibilidade, failover e custo operacional;
- presença de configurações externas não exportadas ao repositório.

## 9. Riscos residuais

Mesmo após corrigir os arquivos versionados, permanecem riscos dependentes de operação: drift já existente no banco, dados perdidos por migrações antigas, credenciais preservadas no histórico/clones, eventos de pagamento durante rollback, incompatibilidade entre app e schema em rollout gradual, scheduler ou log collector configurado apenas no painel e dependência de provedores gerenciados. A mitigação exige evidência externa autorizada, restore drill e deploy ensaiado; análise estática não demonstra disponibilidade nem recuperabilidade.

## 10. Conclusão

No escopo desta etapa, a infraestrutura versionada não sustenta um deploy reprodutível e recuperável: a cadeia de migrações é incompleta, contém operação destrutiva não preparada para dados existentes e não está integrada a um processo de CD observável e reversível. Há **1 BLOCKER, 1 CRITICAL, 6 HIGH e 6 MEDIUM**. A publicação deve permanecer bloqueada por `INF-001` e `INF-002`, com retenção adicional até tratar/verificar `INF-005`, `INF-006` e `INF-009`.

Nenhum código de produto, serviço externo, dado real ou infraestrutura foi alterado. A conclusão é limitada à revisão `0c7ef7d` e às evidências locais descritas; ela não certifica a configuração efetiva dos provedores.
