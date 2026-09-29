# Correções de arquitetura e estrutura — etapa 06

**Data:** 2026-09-27  
**Entradas:** `docs/audits/FINAL-AUDIT.md`, `docs/audits/ARCHITECTURE-AUDIT.md`, `docs/audits/BACKEND-AUDIT.md`, `docs/remediation/PLAN.md` e estado atual do código/testes  
**Escopo executado:** revalidação de `ARCH-001` a `ARCH-013`, correção incremental de fronteiras com impacto prático e reforço do gate de banco na CI  
**Estado da publicação:** `BLOCKED`  
**Risco residual agregado:** `HIGH`

## 1. Resultado

O projeto permanece deliberadamente um **monólito modular em camadas**. Não há declaração ou implementação consistente de arquitetura hexagonal que justifique uma conversão ampla. A decisão e seus limites foram registrados em `docs/adr/ADR-001-modular-layered-architecture.md`.

Nesta etapa foram corrigidos três cortes verificáveis de `ARCH-010` e a lacuna de banco da CI relacionada a `ARCH-002/ARCH-012`:

1. A invalidação de cache específica do Next saiu do serviço de loja e ficou no Route Handler; o serviço preserva apenas persistência e cache interno por tenant.
2. O layout administrativo deixou de acessar Prisma diretamente e passou a usar o serviço de loja.
3. A projeção do histórico de pedidos foi incorporada ao serviço canônico `order.service.ts`; o serviço duplicado `orders.service.ts` foi removido e o DTO compartilhado saiu da camada `app/`.
4. A CI passou a criar PostgreSQL 16, aplicar as migrations desde zero, detectar drift e executar as integrações centrais com banco real.

Não foram criadas portas para cada consulta Prisma. O acoplamento do serviço à persistência foi mantido onde não há segunda implementação, necessidade de teste que o justifique ou desvio de invariantes. Essa escolha evita uma refatoração horizontal sem prova de valor.

## 2. Revalidação dos achados

| ID | Severidade / confiança originais | Evidência no estado atual | Classificação desta etapa | Residual / encerramento objetivo |
|---|---|---|---|---|
| `ARCH-001` | BLOCKER / CONFIRMED | Contrato compartilhado e fluxo `/api/checkout` já haviam sido corrigidos e cobertos nas etapas 04/05. | `ALREADY RESOLVED` | LOW local; encerrar externamente após E2E do navegador e sandbox de pagamento. |
| `ARCH-002` | BLOCKER / CONFIRMED | As migrations de reconciliação já existiam da etapa 03; faltava impedir regressão no pipeline. Banco vazio recebeu 24 migrations e `migrate diff` não detectou diferença. | `ALREADY RESOLVED` no produto; `FIXED` no gate de CI | MEDIUM até ensaio autorizado com dados preexistentes e execução do workflow remoto. |
| `ARCH-003` | CRITICAL / CONFIRMED | Cotação assinada e cálculo autoritativo do servidor já estavam implementados na etapa 04. | `ALREADY RESOLVED` | MEDIUM até prova com ViaCEP/Correios/J&T autorizados. |
| `ARCH-004` | CRITICAL / CONFIRMED | Carrinho e criação de pedido aplicam tenant, catálogo autoritativo e invariantes comuns; etapas 04/05. | `ALREADY RESOLVED` | LOW local; inventário histórico cross-tenant ainda requer ambiente autorizado. |
| `ARCH-005` | CRITICAL / CONFIRMED | Inbox possui estados retomáveis e só conclui após efeitos de domínio; etapas 03/04. | `ALREADY RESOLVED` | MEDIUM até replay/sandbox Asaas e monitoramento operacional. |
| `ARCH-006` | CRITICAL / HIGH CONFIDENCE | CAS, chaves de operação e constraints foram provados com concorrência real em PostgreSQL descartável; etapas 03/04. | `ALREADY RESOLVED` | LOW local; monitorar conflitos e reconciliação no ambiente autorizado. |
| `ARCH-007` | HIGH / HIGH CONFIDENCE | Há workflow persistido e bloqueio de repetição ambígua, mas não há worker durável de reconciliação automática. | `DEFERRED` parcial | HIGH; encerra com worker idempotente, alertas por idade, retry seguro e prova no sandbox. |
| `ARCH-008` | HIGH / CONFIRMED | Uma FSM canônica, CAS, histórico e tracking foram centralizados na etapa 05. | `ALREADY RESOLVED` | LOW local; origem/motivo adicional de histórico depende de decisão de contrato. |
| `ARCH-009` | HIGH / CONFIRMED | Idempotência do ledger foi reforçada, porém a política de clawback quando pontos ganhos já foram gastos não foi definida pelo negócio. | `DEFERRED` | HIGH; exige política aprovada, modelo compatível, cenários de saldo e plano de dados. |
| `ARCH-010` | MEDIUM / CONFIRMED | As violações citadas em loja, layout admin, DTO de perfil e duplicidade `order/orders` foram confirmadas. | `VALID` → `FIXED` nos cortes migrados; `DEFERRED` global | MEDIUM; migrar outro fluxo somente quando um desvio prático for reproduzido e coberto. |
| `ARCH-011` | MEDIUM / HIGH CONFIDENCE | Cache e rate limit continuam locais ao processo; a documentação do Next confirma que revalidação multi-instância precisa de handler compartilhado. | `VALID` no código; runtime distribuído `NOT VERIFIED`; correção `DEFERRED` | MEDIUM/HIGH; exige backend compartilhado, topologia de deploy e testes entre duas instâncias. |
| `ARCH-012` | HIGH / CONFIRMED | CI não tinha PostgreSQL, deploy de migrations, drift nem integração real. Esses gates centrais foram adicionados; HTTP legado/E2E ainda não fazem parte do gate. | `VALID` → `FIXED` parcial / `DEFERRED` | MEDIUM; encerra quando fixture HTTP for isolada, servidor local for iniciado e um E2E crítico bloquear a CI. |
| `ARCH-013` | MEDIUM / SUSPECTED | Existem endpoints de cron protegidos, mas o repositório não comprova se há scheduler externo nem entrega durável. | `NOT VERIFIED` | MEDIUM/HIGH; somente inventário da plataforma e prova de execução/alerta autorizados podem confirmar ou invalidar. |

`NOT VERIFIED` não foi convertido em defeito confirmado. Os IDs correlatos de backend mantêm os estados detalhados em `docs/remediation/BACKEND-FIXES.md`; este documento não reabre correções já comprovadas em etapas anteriores.

## 3. Grupos corrigidos

### 3.1 Fronteira framework → aplicação (`ARCH-010`)

**Antes:** `services/loja.service.ts` importava `next/cache` e invocava `revalidateTag` por cast; `app/admin/layout.tsx` consultava Prisma diretamente. O detalhe do framework vazava para o serviço e havia dois caminhos para ler configurações da loja.

**Depois:** `app/api/loja/settings/route.ts` faz a invalidação Next com a assinatura documentada `revalidateTag(tag, 'max')`; a tag é compartilhada por `lib/cache-tags.ts`; `services/loja.service.ts` cuida somente da atualização e do cache local por tenant; o layout usa `getLojaSettings`.

**Provas de regressão:** sucesso atualiza e revalida; falha de persistência não revalida; falha no guard não chega ao serviço; falha de revalidação não converte uma persistência já concluída em erro; teste estático impede import `next/*` no serviço e acesso Prisma no layout.

**Risco de migração:** baixo. A resposta HTTP foi preservada. A invalidação global da tag continua ampla entre tenants como antes; uma tag por tenant pode ser adotada depois, com contrato de cache explícito.

### 3.2 Projeção e DTO de pedidos (`ARCH-010`)

**Antes:** `services/orders.service.ts` coexistia com `services/order.service.ts`, importava `UserOrder` de `app/profile/types.ts` e era usado apenas pelo perfil.

**Depois:** `getUserOrderHistory` está no serviço canônico singular; o arquivo duplicado foi removido; `UserOrder` e `OrderItemSummary` vivem em `types/order.types.ts`; a página de perfil importa o caso de uso canônico.

**Provas de regressão:** filtro opcional por tenant, `take/skip`, ordenação, projeção, conversão de `Decimal` e shape consumido pela UI permaneceram iguais. Um teste de fronteira falha se o serviço plural reaparecer ou se serviços voltarem a importar `@/app`.

**Risco de migração:** baixo; não houve alteração de endpoint ou formato. O comportamento legado de retornar lista vazia em erro foi preservado para não quebrar o cliente silenciosamente e deve ser reavaliado junto à taxonomia global de erros.

### 3.3 Banco reproduzível na CI (`ARCH-002`, `ARCH-012`)

**Antes:** o workflow declarava URLs locais sem serviço PostgreSQL e executava apenas validação do schema, unitários e build. Um banco vazio e o histórico real de migrations não eram exercitados.

**Depois:** o workflow provisiona PostgreSQL 16 com healthcheck, executa `prisma migrate deploy`, compara banco e schema com `prisma migrate diff --exit-code` e roda `test:integration:core`. O script reúne invariantes de banco, transações e backend sem incluir a suíte HTTP legada ainda não isolada.

**Provas de regressão:** em PostgreSQL local descartável, 24 migrations foram aplicadas desde zero; o diff retornou `No difference detected`; três arquivos e nove testes de integração passaram, incluindo concorrência e invariantes transacionais.

**Risco de migração:** médio. A prova cobre banco vazio, não a aplicação sobre dados reais preexistentes. As migrations estão prontas para execução externa, mas não foram aplicadas em produção, staging ou banco compartilhado.

## 4. Decisão e trade-offs

O ADR local define as seguintes regras incrementais:

- `app/` e Route Handlers são adaptadores de entrada e podem depender de Next/React;
- serviços não devem importar `app/`, React ou APIs do Next;
- DTOs usados por mais de uma camada pertencem a `types/` ou a um módulo compartilhado estável;
- acesso Prisma em serviços é permitido enquanto for a implementação única e não provocar duplicação/desvio de regra;
- portas são criadas para integrações externas, múltiplas implementações ou quando um teste comportamental demonstra a necessidade;
- uma migração arquitetural deve ser vertical, pequena e acompanhada de prova antes/depois.

O status do ADR é `proposed`, pois a decisão ainda precisa de aceite dos mantenedores. A skill de ADR indicava registro em AgentDB, mas essas ferramentas não estavam disponíveis nesta sessão; foi criado apenas o artefato versionável local, sem simular registro externo.

## 5. Testes e comandos executados

| Comando | Resultado |
|---|---|
| `npx vitest run tests/unit/public-store-boundary.test.ts tests/unit/cache-tenant.test.ts` | Baseline: 2 arquivos, 7/7 testes, exit 0. |
| Focais de loja/fronteira/consulta de pedidos | Após os cortes: até 5 arquivos, 15/15 testes; após consolidação final, 4 arquivos, 11/11; exit 0. |
| `npm run test:unit` | 63 arquivos, 451/451 testes, exit 0. |
| `npm run test:integration:core` | 3 arquivos, 9/9 testes em PostgreSQL descartável, exit 0. |
| `npx prisma migrate deploy` | 24 migrations aplicadas em banco vazio, exit 0. |
| `npx prisma migrate diff --from-url "$DIRECT_URL" --to-schema-datamodel prisma/schema.prisma --exit-code` | `No difference detected`, exit 0. |
| Leitura de `.github/workflows/ci.yml` com `js-yaml` | YAML válido e serviço PostgreSQL presente. |
| `npx tsc --noEmit` | Exit 0. |
| `npm run lint` | Exit 0, 0 erros e 20 warnings preexistentes/fora do corte. |
| `npm run build` | Exit 0; Next.js 16.3.5; 51 páginas/rotas geradas. |
| `git diff --check` | Exit 0 antes da documentação; apenas avisos de normalização LF/CRLF. |

Foram lidos os guias versionados do Next 16.3.5 sobre revalidação e funcionamento do cache antes da mudança. Nenhum teste foi registrado como sucesso quando não executou casos.

## 6. Pendências, dependências e responsáveis

| Pendência | IDs | Dependência/responsável | Critério objetivo de encerramento |
|---|---|---|---|
| Worker de reconciliação de pagamento | `ARCH-007` | Backend/Payments + operação; sandbox Asaas | Workflow idempotente processa estados ambíguos, não duplica cobrança e alerta itens vencidos. |
| Política de clawback | `ARCH-009` | Produto/Financeiro + Backend/DB | Política aprovada, casos de saldo insuficiente cobertos, migration/backfill ensaiados e ledger conciliado. |
| Cache/rate limit distribuídos | `ARCH-011` | Infra/Plataforma + Backend | Duas instâncias compartilham limites/invalidação e um teste prova consistência, TTL e falha do backend. |
| HTTP/E2E no gate | `ARCH-012` | Backend/QA | Fixture cria tenant próprio, cleanup é escopado, 17 testes HTTP executam e um E2E checkout bloqueia CI. |
| Scheduler durável | `ARCH-013` | Infra/Plataforma + Operação | Inventário autorizado mostra agenda, autenticação, retries, exclusão mútua, logs e alerta; falha controlada é observada. |
| Aceite do ADR | `ARCH-010` | Mantenedores/Arquitetura | ADR aceito ou substituído; fronteiras aplicadas aos próximos fluxos alterados. |

## 7. Serviços reais a verificar posteriormente

- plataforma de CI hospedada: execução real do novo serviço PostgreSQL e dos gates;
- banco de staging/produção: estado de migrations, dados incompatíveis e plano de rollback/backfill;
- Asaas sandbox: criação, consulta, webhook fora de ordem, timeout, estorno e reconciliação;
- infraestrutura de deploy: número de instâncias, cache compartilhado, rate limiting e afinidade;
- scheduler/cron externo: frequência, segredo, timeout, retries, sobreposição e alertas;
- ViaCEP, Correios e J&T: contrato, timeout e comportamento das cotações;
- Supabase Storage e Resend: somente nos fluxos autorizados das etapas correspondentes.

Nenhum desses serviços foi acessado nesta etapa.

## 8. Limitações e risco residual

- A suíte HTTP legada não foi promovida ao gate: na etapa 05 ela parou no `beforeAll` por `User_lojaID_fkey`, antes de executar 17 casos. Ela não foi apresentada como aprovada nesta etapa.
- Não foi executado navegador/E2E, sandbox externo, staging, produção nem banco compartilhado.
- O workflow foi validado localmente como YAML e por comandos equivalentes; a execução no provedor de CI permanece pendente.
- A remoção de todo acesso Prisma em handlers/serviços não foi tentada: o achado global `ARCH-010` permanece parcial.
- O PostgreSQL local `codex-remediation06-postgres`, porta 55436, foi confirmado pelo nome antes da remoção. Seus dados eram descartáveis e não são recuperáveis.
- Não houve migration nova nem commit nesta etapa.

Por `ARCH-007`, `ARCH-009`, `ARCH-011`, `ARCH-012` parcial e `ARCH-013` não verificado, a publicação continua bloqueada e o risco residual agregado permanece `HIGH`.

## 9. Caminhos alterados nesta etapa

- `.github/workflows/ci.yml`
- `package.json`
- `app/admin/layout.tsx`
- `app/api/loja/settings/route.ts`
- `app/profile/page.tsx`
- `app/profile/types.ts`
- `lib/cache-tags.ts`
- `lib/tenant.ts`
- `services/loja.service.ts`
- `services/order.service.ts`
- `services/orders.service.ts` (removido)
- `types/order.types.ts`
- `tests/unit/architecture-boundaries.test.ts`
- `tests/unit/loja-service-cache.test.ts`
- `tests/unit/loja-settings-architecture.test.ts`
- `tests/unit/order-history-query.test.ts`
- `docs/adr/ADR-001-modular-layered-architecture.md`
- `docs/remediation/ARCHITECTURE-FIXES.md`
- `docs/remediation/PROGRESS.md`



## 2026-09-29 — execução dos prompts atualizados e correções locais

**IDs:** ARCH-010/012/013, FINAL-020/028. Mantido monólito modular e os fluxos financeiros canônicos. Extrações limitadas a hash puro de sessão e serviço compartilhado de auditoria transacional. O provider do carrinho mantém contexto separado; ref de foco não reintroduz ciclo drawer/provider.

Integrações físicas/HTTP, testes renderizados do cabeçalho, tipos e build validaram as fronteiras alteradas. Não houve repository por tabela, microserviço ou infraestrutura distribuída. Partialidade arquitetural permanece por módulos extensos, strictness global e operação externa; não constitui defeito financeiro por si só.

**Validação consolidada:** [complemento de FINAL-VALIDATION](FINAL-VALIDATION.md#2026-09-29--execução-dos-prompts-atualizados-e-correções-locais). Histórico acima preservado; homologação externa não inferida.
