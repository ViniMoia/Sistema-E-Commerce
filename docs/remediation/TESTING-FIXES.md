# Etapa 13 — Testes e cobertura de regressão

**Data:** 2026-09-28  
**Entradas:** `docs/audits/TESTING-AUDIT.md`, `docs/audits/FINAL-AUDIT.md`, `docs/remediation/PLAN.md`  
**Escopo:** harness e regressões locais; nenhum serviço externo ou ambiente compartilhado foi acessado  
**Estado:** correções locais comprovadas; jornada browser e coverage/strictness continuam pendentes

## Resultado executivo

Os dez IDs `TST-001`–`TST-010` foram reavaliados contra o estado atual. O relatório de origem analisou uma revisão sem dependências instaladas e antecede as etapas 01–12; por isso vários fatos mudaram. A suíte atual passou em **77 arquivos/521 testes unitários**, e o núcleo PostgreSQL em **6 arquivos/15 testes**. Uma matriz crítica de 58 casos foi repetida três vezes sem falha.

O risco `TST-005` foi corrigido: o guard não usa mais fallback, exige que `TEST_DATABASE_URL` seja exatamente a URL usada pelo Prisma, aceita somente PostgreSQL local no banco `ecommerce_test`/schema `public` e falha antes de conectar. O cleanup deixou de apagar tabelas inteiras e remove apenas lojas registradas pelo run. Uma integração real provou que a fixture própria é removida e uma sentinel de outro run sobrevive.

Não se declara cobertura completa. Não há runner/browser E2E, threshold de coverage nem `strict` global. As suítes HTTP legadas ainda dependem de servidor explicitamente fornecido e contêm expectativas de payload/status que precisam ser redesenhadas; elas não foram promovidas ao gate. Cupons continuam `N/A`, pois o recurso não existe no código.

## Revalidação por ID

| ID | Severidade original | Classificação atual | Evidência atual e decisão | Severidade residual |
|---|---|---|---|---|
| `TST-001` | HIGH | **ALREADY RESOLVED** no gate de banco; E2E em `TST-004` | CI possui PostgreSQL 16, migrations, drift, unitários e `test:integration:core`. O gate central passou localmente. | MEDIUM |
| `TST-002` | HIGH | **VALID → FIXED parcial / DEFERRED** | Loja/produto do seed, `newStatus`, número automático e e-mails únicos já estavam corrigidos. O comando HTTP completo ainda não inicia servidor e `route-protection` mantém bodies/status genéricos incompatíveis. Não foi contado como aprovado. | HIGH |
| `TST-003` | HIGH | **ALREADY RESOLVED** | Integrações PostgreSQL reais provam última unidade concorrente, idempotência, rollback de estoque, crédito por pedido, cancelamento concorrente e pontos administrativos. | LOW |
| `TST-004` | HIGH | **VALID / DEFERRED** | Continua sem Playwright/Cypress ou teste de componente/browser. Unit/integration não substituem cookie, hidratação, navegação e UI reais. | HIGH |
| `TST-005` | CRITICAL | **VALID → FIXED** | Guard exato, sem fallback, cleanup namespaced e teste sentinel em PostgreSQL. Seis casos negativos provam fail-closed sem conexão. | LOW |
| `TST-006` | MEDIUM | **ALREADY RESOLVED** | Prisma emite eventos em teste, o profiler exige habilitação e `query-profiler.test.ts` prova contagem maior que zero e unsubscribe. | LOW |
| `TST-007` | MEDIUM | **VALID / DEFERRED** | Casos auto-referentes como `header-spec` ainda existem. Eles não foram usados como evidência dos fluxos críticos nem removidos sem substituição comportamental. | MEDIUM |
| `TST-008` | MEDIUM | **VALID → FIXED parcial / DEFERRED** | Há matriz anon/customer A/customer B/admin em handlers e integrações tenant-scoped para admin/pontos/produto. Falta matriz HTTP real completa com cookie e pós-condição para todos os recursos. | MEDIUM |
| `TST-009` | MEDIUM | **VALID → FIXED** no escopo reproduzido | Sleep fixo foi trocado por `vi.waitFor`, global `fetch` é restaurado, IDs de integração são namespaced; 58 casos críticos passaram três vezes. | LOW |
| `TST-010` | MEDIUM | **VALID / DEFERRED** | Typecheck passa, mas `strict=false`; não há provider/threshold de coverage. Não foi criado número arbitrário para aparentar qualidade. | MEDIUM |

## Matriz de regressão de maior risco

| Fluxo solicitado | Prova atual | Limite honesto |
|---|---|---|
| Cadastro/login/sessão | validação de cadastro, enumeração, senha, rate limit e sessão em unitários | sem browser e entrega real de e-mail |
| BOLA/conta A-B/admin | `authz-account-matrix`, `order-resource-authorization`, isolamento multi-tenant | handlers usam dependências controladas; matriz HTTP completa pendente |
| Produto/admin | mutações e auditoria unitárias; variantes/estoque/delete bloqueado em PostgreSQL | UI admin não exercitada |
| Cupom | **N/A** | nenhum modelo, rota, serviço ou UI de cupom encontrado |
| Checkout | autoridade de preço/tenant/guest em unitário e concorrência/idempotência em PostgreSQL | gateway real proibido; compensação externa não verificada |
| Última unidade | duas compras concorrentes: uma vence, uma falha; estoque final zero e um pedido | não reproduz pool/latência de produção |
| Pagamento/webhook repetido | token, duplicação, lease/falha e e-mail em unitário; unicidade/idempotência financeira no banco | redelivery de sandbox Asaas pendente |
| Pontos | ledger/idempotência por pedido e duas intenções admin concorrentes em PostgreSQL | políticas operacionais externas pendentes |
| Admin | autorização/auditoria unitária e efeitos de produto/pontos/frete em PostgreSQL | jornada browser e HTTP completa pendentes |

## Alterações

- `tests/setup/db.ts`: vínculo inequívoco das URLs, allowlist local exata, registro de lojas do run e cleanup tenant-scoped.
- `tests/unit/test-database-safety.test.ts`: matriz de URLs permitida/negadas sem abrir conexão.
- `tests/integration/test-db-isolation.test.ts`: sentinel externa ao run deve sobreviver ao cleanup.
- `tests/unit/asaas-webhook.test.ts`: espera observável com `vi.waitFor`, sem sleep de 50 ms.
- `tests/unit/asaas-customer.test.ts`: restauração explícita de globals stubados.
- `package.json`: a prova de isolamento entrou em `test:integration:core` e, portanto, no CI.

Não houve commit nesta etapa.

## Evidência antes/depois

| Grupo | Antes revalidado | Depois |
|---|---|---|
| Harness seguro | fallback `TEST_DATABASE_URL || DATABASE_URL`, substring `test`, `deleteMany({})` global | 6 negativos fail-closed + sentinel preservada em banco real |
| Banco/transações | etapa 12: 5 arquivos, 14/14 | 6 arquivos, 15/15 em 1,40 s (tempo Vitest) |
| Unitários | etapa 12: 76 arquivos, 513/513 | 77 arquivos, 521/521 em 5,97 s (7,706 s wall clock) |
| Flakiness crítica | sleep real e restauração incompleta de `fetch` | 3 execuções de 8 arquivos/58 casos: 975 ms, 897 ms e 920 ms Vitest; zero falha |

## Comandos e resultados

| Comando | Resultado |
|---|---|
| `npx vitest run tests/unit/test-database-safety.test.ts tests/unit/asaas-webhook.test.ts tests/unit/asaas-customer.test.ts` | 3 arquivos, 33/33, exit 0 |
| `npx tsc --noEmit` | exit 0 após corrigir o nome da relação Prisma (`orders`) |
| `npx prisma migrate deploy` | 24 migrations aplicadas ao PostgreSQL local descartável |
| `npm run test:integration:core` | 6 arquivos, 15/15, exit 0 |
| `npm run test:unit` | 77 arquivos, 521/521, exit 0 |
| matriz crítica Vitest, 3 execuções | 8 arquivos/58 testes em cada execução; 3/3 exit 0 |

Dois ensaios iniciais de integração falharam antes dos testes: primeiro por usuário/senha assumidos incorretamente, depois porque o banco `ecommerce_test` ainda não existia no container retido da etapa anterior. A credencial foi lida sem impressão do próprio container, o banco descartável foi criado, migrations aplicadas e o comando passou. Essas falhas são classificadas como configuração local pré-teste, não regressão do produto.

## Pendências e critérios de encerramento

- `TST-002`: substituir a suíte HTTP legada por harness autocontido com build/servidor local, payload por rota e duas execuções limpas; até lá, permanece fora do gate.
- `TST-004`: adicionar poucos E2E de receita/autorização com browser real, gateway fake local, banco descartável e trace somente em falha.
- `TST-007`: substituir cada teste auto-referente por import/render da implementação antes de considerar remoção.
- `TST-008`: completar matriz HTTP anon/owner/non-owner/admin e provar ausência de efeito negado no banco.
- `TST-010`: medir baseline por módulos críticos, instalar provider compatível em lote revisável e adotar thresholds graduais; ativar strictness incremental sem mudança massiva.

## Limitações e risco residual

- Nenhum serviço, conta, credencial, sandbox externa, produção ou banco compartilhado foi acessado.
- Não foi executada carga HTTP: ela exige servidor/cookie compatível e não deve ser mascarada por autenticação enfraquecida.
- O PostgreSQL local não reproduz rede, pool, deadlocks ou topologia de produção.
- O container local foi parado ao final e mantido para recuperação; nenhum artefato foi removido por prevenção de perda acidental.
- Esta etapa não declara `READY` ou `APPROVED`.


## 2026-09-29 — execução dos prompts atualizados e correções locais

**IDs:** TST-001/002/004/008, ARCH-012, BE-017, FUX-015, FINAL-020. `tests/setup/auth.ts:7` e `tests/setup/db.ts:91` persistem hash SHA-256 e retornam token bruto aleatório; `lib/session-token.ts:4` é compartilhado sem importar cookies no harness. Cleanup inclui auditoria/loyalty/frete e permanece restrito às lojas registradas; sentinel preservada.

`tests/helpers/request.ts` exige URL HTTP loopback e NODE_ENV=test, impede troca de origem e usa HTTP nativo: uma sonda demonstrou que fetch do Node 22 ignorava Host, causando 401. A matriz agora envia payload e status corretos (incluindo 201 de frete), valida anon/customer owner/non-owner/admin A/B e recusa sem alteração. HTTP passou em rodadas sucessivas. Core CI inclui reconciliação PostgreSQL e commerce-child-ownership em `package.json:28`.

TST-002 e TST-008: **FIXED VERIFIED** (LOW). TST-004: **PARTIALLY FIXED** (MEDIUM): jornadas CDP locais reais passaram; orquestração portátil/CI de browser, demais engines, coverage e mutation testing seguem pendentes. Header-spec agora renderiza os componentes reais, com os ramos guest/customer/admin. Contagens finais e comandos estão no complemento de FINAL-VALIDATION; não reutilizar os números históricos acima como resultado atual.

**Validação consolidada:** [complemento de FINAL-VALIDATION](FINAL-VALIDATION.md#2026-09-29--execução-dos-prompts-atualizados-e-correções-locais). Histórico acima preservado; homologação externa não inferida.
