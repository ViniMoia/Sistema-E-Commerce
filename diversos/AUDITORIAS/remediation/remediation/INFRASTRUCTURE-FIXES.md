# Etapa 12 — Infraestrutura, configuração e deploy

Data da revisão: 2026-09-28  
Entradas: `INFRASTRUCTURE-AUDIT.md`, `SECURITY-AUDIT.md`, `FINAL-AUDIT.md`, plano e estado atual do código  
Estado global: melhorias locais implementadas; publicação continua condicionada às verificações externas abaixo

## Resultado executivo

Os 14 achados `INF-001`–`INF-014` foram novamente comparados com o repositório. Sete já tinham correção local de etapas anteriores; esta etapa acrescentou runtime Docker não-root e reproduzível, startup fail-closed, contrato central de ambiente, documentação anti-drift, hardening do CI/supply chain, smoke read-only, confiança explícita no proxy, redaction de credenciais históricas e runbooks de deploy/restore/scheduler.

Nenhum deploy, backup, restore, rotação, DNS, cloud, gateway, e-mail, storage ou banco real foi acessado. O sistema não é declarado `READY` ou `APPROVED`: `INF-002` e `INF-004` ainda exigem estado e ensaio de banco autorizado; `INF-007`, `INF-008`, `INF-012` e parcelas dos demais dependem do provedor.

## Classificação revalidada

| ID | Severidade / confiança original | Estado inicial no código atual | Resultado desta etapa | Severidade residual |
|---|---|---|---|---|
| `INF-001` | BLOCKER / CONFIRMED | `ALREADY RESOLVED`: migration corretiva já cria os seis modelos; cadeia havia passado do zero. | Revalidado: 24 migrations, status atual e diff vazio no PostgreSQL descartável. Drift real segue `NOT VERIFIED`. | HIGH externo / LOW local |
| `INF-002` | CRITICAL / CONFIRMED | `VALID`: a migration histórica destrutiva continua versionada; a correção aditiva não prova upgrade de todo snapshot populado intermediário. | `DEFERRED/BLOCKED` para ambiente real. Runbook exige snapshot, preflight, backup restaurável e ensaio por versão; a migration antiga não foi reescrita. | CRITICAL até confirmar estado; depois depende do ensaio |
| `INF-003` | HIGH / CONFIRMED | `VALID` parcial: CI já tinha banco/migrations/integração, mas faltavam lint, ambiente, supply chain e artefato de runtime. | `FIXED` no escopo do repositório: gates, imagem Docker e runbook. Promoção/CD real permanece `REQUIRES INFRASTRUCTURE VERIFICATION`. | MEDIUM |
| `INF-004` | HIGH / CONFIRMED | `VALID`: SQL RLS continua solto e incompleto para o schema atual. | `DEFERRED`, sem aplicar política perigosa às cegas. Consulta read-only e critérios de roles/grants/RLS foram versionados. | HIGH |
| `INF-005` | HIGH / HIGH CONFIDENCE | Bootstrap já estava fail-closed e sem credencial fixa. A nova varredura encontrou outros valores com aparência real em documentação histórica. | `FIXED` na cópia atual: quatro referências foram redigidas e scanner bloqueia recorrência. Revogação/rotação permanece `NOT VERIFIED`. | HIGH externo / LOW no HEAD |
| `INF-006` | HIGH / CONFIRMED | Provider dev já não logava corpo/destinatário e produção falhava ao primeiro uso. | `FIXED` no runtime empacotado: contrato é validado antes do servidor e falta de Resend/configuração encerra com exit 1. Entrega real não verificada. | MEDIUM |
| `INF-007` | HIGH / CONFIRMED | `VALID`: rotas existiam, mas scheduler não era versionado. | `FIXED` apenas como contrato provider-neutral e runbook; agenda, exclusão, retry e alertas reais são `REQUIRES INFRASTRUCTURE VERIFICATION`. | HIGH |
| `INF-008` | MEDIUM / NOT VERIFIED | Continuava `NOT VERIFIED`; ausência de evidência não prova ausência de backup. | Permanece `NOT VERIFIED`. Runbook seguro de restore foi criado, sem alegar backup/PITR existente. | HIGH operacional |
| `INF-009` | HIGH / CONFIRMED | `ALREADY RESOLVED`: simulator opt-in, indisponível em produção, com ADMIN, tenant e schema. | Regressão mantida; contrato de ambiente impede flags mutáveis em ambiente implantado. | LOW local / MEDIUM em configuração externa |
| `INF-010` | MEDIUM / CONFIRMED | `VALID`: faltavam nomes e validação numérica/combinações no startup. | `FIXED` no repositório: contrato central, `.env.example` completo para nomes usados, checker anti-drift e faixas financeiras. Valores/permissões reais continuam não verificados. | MEDIUM |
| `INF-011` | MEDIUM / CONFIRMED | `ALREADY RESOLVED` pela etapa 11: liveness/readiness existiam. | Revalidado dentro da imagem; healthcheck usa liveness e smoke exige readiness. Configuração do balanceador é externa. | LOW local / MEDIUM externo |
| `INF-012` | MEDIUM / CONFIRMED | `ALREADY RESOLVED` parcial pela etapa 11: contexto, logs, métricas e alertas de exemplo. | Mantido; checklist separa collector/dashboard/alerta real. | MEDIUM |
| `INF-013` | MEDIUM / CONFIRMED | `VALID`: workflow sem `permissions` e actions em tags móveis. | `FIXED` no repositório: `contents: read`, credencial não persistida, SHAs fixos, Node/pacotes fixados, secret scan, audit e Dependabot. Políticas da organização são externas. | LOW local / MEDIUM externo |
| `INF-014` | MEDIUM / SUSPECTED | `NOT VERIFIED`: o risco dependia do comportamento do ingress; o código aceitava forwarded host sem declaração. | `FIXED` parcial no código: ignora `X-Forwarded-Host` sem provider allowlisted e rejeita cadeia ambígua. Ingress/DNS permanecem `NOT VERIFIED`; o achado não foi convertido em defeito operacional confirmado. | MEDIUM |

## IMPLEMENTED IN REPO

### Runtime e build reproduzíveis

- `Dockerfile` multi-stage baseado em Node `22.22.1` fixado por digest, saída `standalone`, OpenSSL/CA para Prisma, usuário `nextjs` sem root e healthcheck de liveness.
- `.dockerignore` exclui Git, `.env*`, testes, documentação, caches e artefatos locais do contexto.
- `.nvmrc`, `packageManager` e `engines` alinham Node/npm; `deploymentId` aceita o identificador imutável da release.
- O bootstrap de runtime valida configuração antes de iniciar o Next. Sem `APP_ENV`, o container terminou com exit 1; com configuração fictícia e banco descartável, ficou `healthy` e passou liveness/readiness/métricas.
- A primeira imagem expôs OpenSSL ausente durante o build. Após instalá-lo, uma segunda prova revelou que o estágio final não herdava a biblioteca. Ambas as causas foram corrigidas e o smoke foi repetido; esses insucessos não foram ocultados.

### Contrato de ambiente

- `lib/config/environment.cjs` valida ambiente lógico, URLs, secrets mínimos, flags, combinação produção/sandbox, Supabase condicional e faixas financeiras sem incluir valores na exceção.
- `instrumentation.ts` mantém a defesa dentro do Next e `scripts/start-runtime.mjs` garante exit antes do servidor no caminho operacional.
- `.env.example` agora documenta todos os nomes encontrados no código/tooling, inclusive pagamento, teste, deployment ID e proxy. Variáveis públicas continuam explicitamente públicas/fixas no build.
- `scripts/check-env-contract.mjs` falha se um nome usado deixa de aparecer no exemplo.
- `getPaymentConfig` rejeita `NaN`, inteiros inválidos e valores fora de faixa; o frete deixou de aceitar fallbacks de segredo com nomes obsoletos.

### CI e supply chain

- Workflow com `permissions: contents: read`, concorrência cancelável, timeout e checkout sem persistir credencial.
- `checkout`/`setup-node` estão fixados em SHA, PostgreSQL em digest e runtime Node em versão/digest conhecidos.
- Gates: scanner de segredos, audit de dependências de produção, contrato/anti-drift de ambiente, migrations/diff, typecheck, lint, unitários, integração, build, Docker build e usuário não-root.
- Dependabot foi configurado para npm, GitHub Actions e Docker. Habilitação/política da organização continua externa.
- Quatro referências históricas com aparência de credencial foram substituídas por placeholders. O valor não é reproduzido neste documento. Remoção do HEAD não revoga histórico.

### Host/proxy, health e operação

- `X-Forwarded-Host` só é usado quando `TRUSTED_PROXY_PROVIDER` é um provider allowlisted; múltiplos hosts e quebras de linha falham fechados.
- Smoke read-only exige opt-in adicional para destino remoto e nunca chama checkout/pagamento.
- `ops/scheduler/jobs.example.yml` define frequência, 503 retry, timeout, concorrência e heartbeat como contrato; não se apresenta como scheduler ativo.
- `ops/database/verify-access.sql` consulta RLS, grants, `BYPASSRLS` e default privileges sem alterar banco.
- Runbooks de implantação/rollback, backup/restore e checklist externo foram adicionados.

## REQUIRES INFRASTRUCTURE VERIFICATION

| Componente real | Prova pendente | Owner sugerido / critério de encerramento |
|---|---|---|
| PostgreSQL/Supabase | `_prisma_migrations`, drift, snapshots intermediários, volume/locks e ensaio de `INF-002` | DBA; upgrade de cópia sanitizada, integridade e rollback/forward-fix medidos |
| Roles/RLS/Data API | owner, `BYPASSRLS`, grants, políticas e default privileges | DBA/Segurança; consulta read-only aprovada e migration específica ensaiada |
| Backup/PITR | existência, retenção, região, criptografia, RPO/RTO e restore real | DBA/Operações; drill isolado com métricas e reconciliação |
| Registry/CD | upload, assinatura/provenance, aprovação e promoção do mesmo digest | Plataforma; staging/produção usam o mesmo digest e rollback ensaiado |
| Ingress/DNS/TLS/WAF/CDN | headers, body/rate limits, TLS, cache keys e domínio customizado | Plataforma/Segurança; matriz Host/XFH, TLS e cache por tenant passa |
| Scheduler | implantação do contrato, token, retry, exclusão e alerta de ausência | SRE; duas rotas executam fixtures idempotentes e alertas controlados disparam |
| Asaas/Resend/Supabase Storage | secrets rotacionados, sandbox/webhooks, entrega/DNS e políticas de bucket | Pagamentos/Plataforma; evidência autorizada sem dados reais |
| Observabilidade | collector, TLS, retenção/RBAC, dashboards, alertas e drain | SRE; teste sintético correlacionado e alerta reconhecido |
| GitHub | branch protection, environments, reviewers, runner e Dependabot | DevSecOps; política exportada/revisada e PR de fork exercitado |
| Next multi-instância | encryption key, deployment ID, cache/tag compartilhado e SIGTERM | Plataforma; rolling deploy e drain sem erro/mistura de tenant |

## Comandos e resultados

| Prova | Resultado |
|---|---|
| Ausências antes da correção | `Dockerfile`, `.dockerignore`, `.nvmrc`, validação/startup e runbooks não existiam; workflow usava tags e permissões implícitas. |
| Scanner antes/depois | Identificou referências suspeitas sem imprimir valores; após redaction, `npm run security:secrets` exit 0. |
| Contrato negativo | `APP_ENV=production` sem configuração foi rejeitado, listando somente nomes/regras. |
| Contrato positivo | Fixture completa passou em modo production + migration, sem imprimir valores. |
| Anti-drift | `.env.example` cobre 31 nomes usados ou exigidos por tooling. |
| Regressões focadas | Infra/config/logger/e-mail/reset e tenant/rate limit: 7 arquivos, 53 testes aprovados nas duas execuções focadas. |
| Unitários completos | 76 arquivos, 513/513, exit 0. |
| PostgreSQL descartável | 24 migrations encontradas, schema up to date, `No difference detected`; integração core 5 arquivos, 14/14. |
| Query RLS/ACL local | Script inicialmente falhou em duas referências de catálogo e foi corrigido; depois executou read-only. Banco local é superuser/BYPASSRLS e não representa o provedor. |
| Typecheck | Exit 0. |
| Lint | A inclusão no gate revelou plugin não visível no objeto flat config; configuração corrigida. Resultado final: 0 erros, 16 warnings conhecidos. |
| Audit de produção | `npm audit --omit=dev --audit-level=high`: 0 vulnerabilidades. `npm ci` completo da imagem ainda reporta 2 moderadas em dependências totais/dev. |
| YAML | Workflow, Dependabot e contrato de scheduler: 3 arquivos válidos. |
| Build local | Next.js 16.3.5, tipos e 51 páginas, exit 0. |
| Docker build | Primeira tentativa revelou OpenSSL/Prisma; segunda revelou biblioteca ausente no runtime; imagem final construída sem esses erros. |
| Startup negativo | Container sem contrato terminou exit 1; usuário configurado `nextjs`. |
| Smoke final | Container `healthy`, usuário `nextjs`; live/ready 200, métricas 401 sem token e 200 com token fictício. |

## Arquivos principais alterados

- Runtime/config: `Dockerfile`, `.dockerignore`, `.nvmrc`, `instrumentation.ts`, `next.config.js`, `.env.example`, `package.json`, `package-lock.json`.
- Validação/scripts: `lib/config/environment.cjs`, `scripts/start-runtime.mjs`, `scripts/validate-environment.mjs`, `scripts/check-env-contract.mjs`, `scripts/scan-secrets.mjs`, `scripts/smoke-deployment.mjs`.
- CI: `.github/workflows/ci.yml`, `.github/dependabot.yml`, `eslint.config.mjs`.
- Proxy/regras: `lib/tenant.ts`, `lib/config/payment.config.ts`, `lib/freight-quote.ts`.
- Operação: `ops/scheduler/jobs.example.yml`, `ops/database/verify-access.sql`, `docs/operations/*.md`.
- Testes: `tests/unit/infrastructure-config.test.ts`, `tests/unit/tenant-canonical-origin.test.ts` e fixtures de tokens tornadas inequivocamente fictícias.
- Documentos históricos com valores redigidos: quatro arquivos sob `diversos/`; rotação externa continua obrigatória.

Não houve commit.

## Limitações e risco residual

- `INF-002` permanece o principal bloqueio: cadeia vazia não prova upgrade seguro de todas as versões populadas.
- `INF-004` não foi convertido em migration porque a role local é superuser com `BYPASSRLS`; ativar RLS/revogar grants sem topologia real seria uma correção parcial perigosa.
- Backup, scheduler, collector, DNS, TLS, WAF, registry, GitHub policies e secrets reais continuam sem evidência.
- Imagem base está fixada por digest; pacotes Debian instalados no build ainda dependem do snapshot do repositório apt. O digest final da imagem deve ser produzido/assinado pelo CI autorizado.
- As dependências totais do build reportaram duas vulnerabilidades moderadas; dependências de produção reportaram zero. Atualização precisa de PR e regressão, não de `audit fix` automático.
- Containers e imagem locais de prova foram parados e mantidos, sem remoção destrutiva. Nenhum dado real foi usado.

Critério de encerramento desta etapa: correções testáveis no repositório implementadas e verificadas, cada item externo mantido explicitamente como `NOT VERIFIED`, `DEFERRED` ou `REQUIRES INFRASTRUCTURE VERIFICATION`. Esse critério foi atingido; prontidão de produção não foi declarada.
