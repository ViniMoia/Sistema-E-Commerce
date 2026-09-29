# Etapa 15 — Validação final das correções

**Data:** 2026-09-28  
**Escopo:** 15 relatórios de auditoria, `PLAN.md`, `PROGRESS.md`, 13 relatórios de correção existentes, código e testes locais  
**Recomendação de publicação:** **BLOCKED — NÃO PUBLICAR**  
**Motivo objetivo:** os controles locais principais passam, mas ainda existem um rollout de migration histórica com risco `CRITICAL`, reconciliação/refund financeiros incompletos, ausência de E2E em browser, RLS/backup/scheduler não verificados e dependências reais sem homologação.

## 1. Resultado executivo

Os 198 IDs originais foram reencontrados uma única vez no mapa consolidado de 36 causas raiz. Todos aparecem na matriz da seção 5; nenhum `NOT VERIFIED` foi convertido em defeito confirmado. Os 15 relatórios esperados de auditoria existem. Há, porém, somente 13 handoffs `*-FIXES.md`: **`docs/remediation/FRONTEND-FIXES.md` não existe**. A etapa 08 também não possui bloco próprio no `PROGRESS.md`. Por isso, os `FUX-*` foram reavaliados somente pelo relatório original, código atual, correções correlatas de web/performance/backend e testes observáveis.

O estado consolidado conservador ficou assim:

| Estado final da causa raiz | Grupos | Quantidade |
|---|---|---:|
| `FIXED VERIFIED` | `FINAL-011`, `FINAL-013` | 2 |
| `PARTIALLY FIXED` | 001, 002, 004–007, 010, 012, 014–016, 018–019, 022–032, 035 | 25 |
| `BLOCKED` | `FINAL-003`, `FINAL-008`, `FINAL-009`, `FINAL-020`, `FINAL-021`, `FINAL-033` | 6 |
| `DEFERRED` | `FINAL-017`, `FINAL-036` | 2 |
| `NOT VERIFIED` | `FINAL-034` | 1 |
| `ALREADY RESOLVED` | nenhum grupo consolidado; aparece em IDs individuais dos handoffs | 0 |
| `INVALID` | nenhum grupo consolidado; somente a subalegação de múltiplos `h1` de `WEB-009` foi invalidada | 0 |

`FIXED VERIFIED` foi reservado a causas encerradas por comportamento local observável e sem dependência material pendente para o defeito original. Um controle implementado no repositório, mas dependente de gateway, browser, dados preexistentes ou infraestrutura real, permaneceu `PARTIALLY FIXED`, `BLOCKED` ou `NOT VERIFIED`.

## 2. Evidência direta no código atual

### Segurança e contas A/B

- Detalhe e confirmação de pedido exigem simultaneamente proprietário e tenant em `app/api/orders/[id]/route.ts` e `app/api/orders/[id]/confirm-delivery/route.ts`.
- A simulação de fidelidade deriva `userID` e `lojaID` da sessão em `app/api/loyalty/simulate/route.ts`; IDs do cliente não provam posse.
- O checkout descarta `userId` de convidado, vincula usuário autenticado ao tenant ativo e exige `Idempotency-Key` em `app/api/checkout/route.ts`.
- Os testes `order-resource-authorization`, `cross-tenant-matrix` e `authz-account-matrix` cobrem anônimo/customer A/customer B/admin. A amostra crítica completa passou: **10 arquivos, 90/90 testes**.

### Concorrência, pagamentos e integridade

- `services/order.service.ts` reivindica transição com `updateMany` condicionado a ID/status/tenant/proprietário antes dos efeitos.
- `services/checkout.service.ts` compara fingerprint, bloqueia repetição em `PROCESSING`/`RECONCILIATION_REQUIRED`, recalcula catálogo/valores e persiste intent antes da chamada externa.
- `app/api/webhooks/asaas/route.ts` só considera `PROCESSED` como concluído; faz claim de `RECEIVED/FAILED`, usa lease, persiste falha e conclui depois dos efeitos.
- Em PostgreSQL 16 local, `transactions-invariants` comprovou uma única venda da última unidade, uma única cobrança fictícia e resposta idempotente; `database-invariants` comprovou CAS de cancelamento, rollback e crédito de pontos único.

### Nova falha encontrada e corrigida nesta validação

1. O scanner de segredos falhou porque três URLs **fictícias** de `test-database-safety.test.ts` não usavam o marcador de fixture reconhecido. As credenciais literais foram trocadas por `test_user:test_password`; o teste do guard continuou 7/7 e o scanner passou sem achados.
2. A suíte completa encontrou uma falha intermitente em `logger.test.ts`: uma sequência numérica interna de UUID podia casar com a regex de telefone, alterando o `requestId` sanitizado. `lib/logger.ts` agora exige fronteiras não hexadecimais ao redor de telefone, e foi criada regressão determinística com o UUID que falhou. O foco passou 8/8 e a suíte completa passou 77 arquivos/526 testes.

## 3. Gates finais executados

| Comando/verificação | Resultado final |
|---|---|
| `npm run security:secrets` | Exit 0; nenhum padrão não permitido. A primeira execução identificou somente três fixtures fictícias e foi corrigida antes da repetição. |
| `npm run validate:env-contract` | Exit 0; 31 nomes usados/exigidos cobertos. |
| `npx tsc --noEmit` | Exit 0. |
| `npm run lint` | Exit 0; 0 erros e 16 warnings, exatamente o budget atual. |
| Amostra BLOCKER/CRITICAL/HIGH | 10 arquivos, 90/90 testes. |
| `npm test` | Primeira execução: 524/525 por UUID mutilado; após correção: 77 arquivos, 526/526. |
| `npm run build` | Exit 0; Next.js 16.3.5, 51 páginas/rotas geradas. |
| `npx prisma validate` | Exit 0. |
| `npx prisma migrate status` | 24 migrations; banco `ecommerce_test` atualizado. |
| `npx prisma migrate deploy` | Nenhuma migration pendente. |
| `npx prisma migrate diff --from-url ... --to-schema-datamodel ... --exit-code` | Exit 0; `No difference detected`. |
| `npm run test:integration:core` | 6 arquivos, 15/15 em PostgreSQL 16 local. |
| Smoke HTTP final | **Não executado.** Duas tentativas foram bloqueadas pela política do executor antes de iniciar processo. O sucesso documentado na etapa 12 não foi contado como repetição nesta etapa. |
| Browser E2E/a11y | **Não executado:** não há Playwright/Cypress/axe nem browser automatizado disponível no projeto. |

O contêiner local `codex-remediation11-postgres` foi apenas iniciado e parado; não foi removido. Nenhum banco, volume ou dado externo foi apagado. As duas primeiras tentativas do gate de banco falharam por premissas do harness — ausência de `HEALTHCHECK` e `POSTGRES_DB` representar apenas o banco inicial — antes de qualquer teste. A execução corrigida usou `pg_isready` e confirmou diretamente `ecommerce_test`.

## 4. Bloqueios de publicação

| Bloqueio | IDs | Critério objetivo para liberar | Responsável/ambiente |
|---|---|---|---|
| Upgrade de migration histórica populada | `FINAL-003`, `DB-010`, `INF-002` | Inventariar versões reais; snapshot/backup restaurável; ensaiar cada caminho populado; validar constraints e rollback. | DBA/Plataforma em cópia autorizada. |
| Resultado financeiro ambíguo sem reconciliador durável | `FINAL-008`, `ARCH-007`, `CTR-004`, `OBS-003` | Worker idempotente por referência, retry seguro, alerta por idade e prova no sandbox Asaas sem cobrança duplicada. | Pagamentos/Operações. |
| Refund/cancelamento incompleto | `FINAL-009`, `ADM-001`, `CTR-014`, `BE-012` | Comando idempotente de refund, estados de processamento, confirmação por webhook, compensação/reconciliação e testes de refund total/parcial. | Produto financeiro/Pagamentos. |
| Gate browser/HTTP insuficiente | `FINAL-020`, `TST-002`, `TST-004`, `TST-008` | Fixture isolada, servidor iniciado pela suíte e E2E de login, A/B, carrinho, checkout e admin bloqueando CI. | QA/Frontend/Backend. |
| Jobs/outbox/scheduler não comprovados | `FINAL-021`, `ARCH-013`, `INF-007`, `OBS-006`, `OBS-007` | Agenda versionada na plataforma, exclusão, heartbeat, retry, dead-letter/alerta e prova de execução/falha. | Plataforma/Operações. |
| Release/recuperação externa não comprovada | `FINAL-033`, `INF-008`, `INF-012` | Restore completo cronometrado, RPO/RTO, collector/dashboard/alerta e promoção/rollback de release exercitados. | SRE/Plataforma. |
| Grants/RLS/storage | `FINAL-034`, `DB-016`, `INF-004`, parcela de `SEC-014` | Inventário read-only de roles/grants/policies; política tenant-aware versionada; teste service-role/anon e rollback. | DBA/Segurança/Storage. |

## 5. Inventário completo: IDs originais → causa raiz → mudança → teste → estado → residual

Cada linha conserva todos os IDs originais. O estado é da **causa raiz agregada**; exceções individuais continuam nos handoffs de domínio e não elevam o grupo inteiro a resolvido.

| Causa raiz e IDs originais | Mudança/evidência atual | Prova final | Estado | Risco residual |
|---|---|---|---|---|
| `FINAL-001` — `ARCH-001`, `BE-001`, `CTR-001`, `FUX-001` | Contrato compartilhado e única rota `/api/checkout`; envelope e tipagem alinhados. | Checkout autoritativo, typecheck e build. | `PARTIALLY FIXED` | Falta jornada real PIX/cartão/boleto em browser. |
| `FINAL-002` — `ARCH-002`, `DB-001`, `INF-001` | Migration corretiva e gate de migrations/drift. | 24 migrations, deploy sem pendência e diff vazio. | `PARTIALLY FIXED` | Banco vazio comprovado; upgrades populados intermediários não. |
| `FINAL-003` — `DB-002`, `DB-010`, `INF-002` | Unicidade residual removida e rollout aditivo preparado; migration histórica não reescrita. | Integrações de variantes e runbook. | `BLOCKED` | Risco crítico de upgrade conforme o snapshot real. |
| `FINAL-004` — `ARCH-003`, `DB-009`, `BE-003`, `CTR-006`, `CTR-010`, `CTR-015`, `FUX-002`, `ADM-002` | Preço/frete/parcelas recalculados no servidor, cotação assinada, Decimal e schema de frete. | Unitários de checkout/frete/admin e constraints. | `PARTIALLY FIXED` | Provedores/tarifas reais não verificados; `Cart.shippingCost` ainda Float. |
| `FINAL-005` — `ARCH-004`, `DB-006`, `DB-011`, `BE-004`, `CTR-002`, `AUTH-005`, `SEC-006` | Caminho alternativo retorna 410; owner+tenant e FKs compostas nas entidades centrais. | Matriz A/B e integrações multi-tenant. | `PARTIALLY FIXED` | FKs físicas incompletas para Cart/Address/OrderItem e inventário histórico. |
| `FINAL-006` — `ARCH-005`, `DB-004`, `BE-005`, `CTR-003`, `CTR-009`, `SEC-013`, `OBS-001` | Inbox retomável com claim/lease/erro e validação de identidade/valor. | Webhook unitário e integrações de efeitos. | `PARTIALLY FIXED` | Reentrega Asaas, monitoramento e reconciliador externos. |
| `FINAL-007` — `ARCH-006`, `DB-003`, `DB-012`, `BE-006`, `CTR-005` | CAS de transição, histórico e efeitos idempotentes. | Concorrência PostgreSQL e 90 testes críticos. | `PARTIALLY FIXED` | Unicidade de carrinho/CPF depende de política e dados legados. |
| `FINAL-008` — `ARCH-007`, `BE-007`, `CTR-004`, `CTR-007`, `CTR-011`, `CTR-012`, `SEC-012`, `OBS-003`, `OBS-010` | Intent/fingerprint/idempotência e estado `RECONCILIATION_REQUIRED`; timeout não recobra cegamente. | Unitários de repetição/timeout/ambiguidade. | `BLOCKED` | Sem worker durável nem semântica comprovada no gateway. |
| `FINAL-009` — `DB-005`, `BE-012`, `CTR-008`, `CTR-014`, `CQ-001`, `OBS-002`, `OBS-005`, `ADM-001` | Restore propaga falha; cancelamento pago falha fechado; refund tardio abre reconciliação. | Rollback/CAS em PostgreSQL e testes admin. | `BLOCKED` | Iniciação de refund, parcial, reversa e compensação não encerradas. |
| `FINAL-010` — `BE-002`, `AUTH-001`, `SEC-001`, `ADM-007` | DTO público allowlist; segredo operacional removido do cliente. | Regressões de fronteira pública e scanner. | `PARTIALLY FIXED` | Rotação/revogação e cópias históricas externas não verificadas. |
| `FINAL-011` — `AUTH-002`, `SEC-002` | Guest não reutiliza conta por e-mail nem altera PII/gasta pontos. | Testes de checkout guest/autenticado e corrida de e-mail. | `FIXED VERIFIED` | Account linking futuro exige prova de posse; não reabre o defeito atual. |
| `FINAL-012` — `BE-009`, `AUTH-003`, `SEC-003` | Reset usa origem canônica HTTPS e ignora `Origin`/`Referer`. | `tenant-canonical-origin` na amostra crítica. | `PARTIALLY FIXED` | DNS/TLS e domínio publicado não verificados. |
| `FINAL-013` — `TST-005` | Guard exato para `ecommerce_test`, URLs idênticas e cleanup por lojas registradas. | 7/7 negativos/positivo e sentinel PostgreSQL no gate 15/15. | `FIXED VERIFIED` | Contêiner local deve continuar exclusivo e efêmero. |
| `FINAL-014` — `ARCH-009`, `DB-007`, `BE-008`, `CTR-013`, `AUTH-004`, `SEC-005`, `ADM-003` | BOLA fechada; ledger/ajuste com chaves idempotentes e limites. | Unitários e invariantes reais de crédito único. | `PARTIALLY FIXED` | Clawback após gasto, teto e dupla aprovação dependem de negócio. |
| `FINAL-015` — `DB-008`, `BE-011`, `CTR-016`, `FUX-003`, `ADM-010` | Variante preservada, reserva condicional, lock de carrinho e estoque pai derivado no admin. | Última unidade, 20 adições concorrentes e testes admin. | `PARTIALLY FIXED` | Reload/limpeza canônica do carrinho ainda falham; ERP/backfill não verificados. |
| `FINAL-016` — `AUTH-006`, `AUTH-007`, `AUTH-009`, `SEC-007`, `SEC-008`, `SEC-009`, `SEC-021`, `INF-006` | Sessão/reset hash, CAS de uso único, logout fail-closed e e-mail de produção fail-closed. | `session-security`, auth e build/runtime contratual. | `PARTIALLY FIXED` | Deploy invalida sessões antigas; entrega do provedor não verificada. |
| `FINAL-017` — `ARCH-011`, `AUTH-008`, `SEC-010`, `SEC-015`, `PERF-005`, `PERF-008` | Limites locais, trust de proxy explícito, cache LRU/coalescido e leitura em lote. | Unitários de abuso/cache/tenant. | `DEFERRED` | Limiter/cache/WAF compartilhados exigem topologia e duas réplicas. |
| `FINAL-018` — `BE-010`, `AUTH-010`, `AUTH-011`, `SEC-011`, `SEC-014`, `INF-009` | Simulador fail-closed/admin/tenant; upload admin com bucket fixo. | Testes de simulator/upload/autorização. | `PARTIALLY FIXED` | ACL/RLS, magic bytes, cota e conteúdo do storage real. |
| `FINAL-019` — `AUTH-012`, `AUTH-015`, `SEC-004`, `SEC-020`, `INF-005`, `ADM-004` | Último admin protegido em `Serializable`; bootstrap determinístico removido; secret scan. | Testes de papéis/admin e scanner final. | `PARTIALLY FIXED` | Rotação, revogação e clones/histórico fora do repositório. |
| `FINAL-020` — `ARCH-012`, `DB-017`, `BE-017`, `FUX-015`, `TST-001`, `TST-002`, `TST-003`, `TST-004`, `TST-006`, `TST-007`, `TST-008`, `TST-009`, `TST-010`, `PERF-010`, `CQ-005`, `CQ-006`, `ADM-011`, `OBS-014` | CI ganhou PostgreSQL, migrations, drift, integração, lint/audit/build; guard e flakiness corrigidos. | 526 unitários, 15 integrações, build e lint. | `BLOCKED` | Sem E2E/browser; suíte HTTP legada, strictness e coverage ainda incompletos. |
| `FINAL-021` — `ARCH-013`, `INF-007`, `OBS-006`, `OBS-007` | Crons reportam falha; timeout de e-mail e runbook de scheduler. | Unitários dos crons/e-mail. | `BLOCKED` | Scheduler, outbox, exclusão, heartbeat e alertas reais não comprovados. |
| `FINAL-022` — `DB-013`, `DB-014`, `DB-015`, `BE-015`, `FUX-007`, `FUX-009`, `PERF-001`, `PERF-007`, `PERF-009` | Catálogo inicial limitado, filtros/paginação no servidor e agregações de clientes. | Testes de performance e build. | `PARTIALLY FIXED` | Histórico de pedidos continua limitado a 10; expiração/N+1 e índices reais pendem de volume. |
| `FINAL-023` — `FUX-004`, `WEB-005`, `WEB-006`, `WEB-007` | Links/controles semânticos, labels, erros e radios/fieldset no checkout. | Testes estáticos e build. | `PARTIALLY FIXED` | Teclado/leitor de tela em browser não executados. |
| `FINAL-024` — `FUX-005`, `WEB-008` | Overlays principais migrados para `Sheet`/Radix controlado. | Testes estáticos e build. | `PARTIALLY FIXED` | Trap, ordem e retorno de foco não medidos dinamicamente. |
| `FINAL-025` — `FUX-006`, `WEB-001`, `WEB-002` | Rota SSR de produto, canonical, robots e sitemap tenant-aware. | Build e testes de metadata/rotas. | `PARTIALLY FIXED` | DNS/proxy/crawlers e política de slug/redirect. |
| `FINAL-026` — `ARCH-008`, `BE-013`, `ADM-005`, `ADM-006`, `ADM-008`, `ADM-009`, `ADM-012` | FSM única, histórico/tracking transacional e mutações de catálogo protegidas/auditadas. | Unitários e invariantes admin PostgreSQL. | `PARTIALLY FIXED` | Brands/categories ausentes; settings/fidelidade não usam trilha uniforme. |
| `FINAL-027` — `BE-014`, `BE-016`, `SEC-018`, `OBS-004`, `OBS-008`, `OBS-012`, `OBS-013` | Logger sanitizado, contexto/correlação e erros 5xx genéricos; UUID preservado nesta etapa. | `logger` 8/8, foco crítico e suíte completa. | `PARTIALLY FIXED` | Retenção, RBAC, expurgo e propagação no collector externo. |
| `FINAL-028` — `ARCH-010`, `CQ-003`, `CQ-004`, `CQ-007`, `CQ-008`, `CQ-009`, `CQ-010` | Fronteiras incrementais, aliases removidos, ciclo do carrinho quebrado e cron auth centralizado. | Testes arquiteturais, typecheck e build. | `PARTIALLY FIXED` | `strict=false`, módulos grandes e cinco módulos sem consumidor não decididos. |
| `FINAL-029` — `FUX-008`, `FUX-010`, `PERF-004`, `PERF-006`, `CQ-002` | Checkout deixa de ter waterfall de tenant; histórico de pedidos não mascara exceção. | Performance checkout e erro do perfil. | `PARTIALLY FIXED` | Pontos e carrinho ainda mascaram falha; request ainda aguarda gateway. |
| `FINAL-030` — `FUX-011`, `PERF-002`, `PERF-003`, `WEB-010` | Hero poster/reduced motion, vídeo diferido e imagens críticas otimizadas. | Testes de mídia, build e lint. | `PARTIALLY FIXED` | `<img>` permanece em áreas secundárias; LCP/dispositivos não medidos. |
| `FINAL-031` — `FUX-012`, `WEB-009`, `WEB-011` | Skip link, landmarks/headings e foco visível nos pontos web auditados. | Testes estáticos/build; subalegação de múltiplos `h1` invalidada. | `PARTIALLY FIXED` | Formulários auth ainda carecem de semântica consistente; contraste/a11y real. |
| `FINAL-032` — `SEC-016`, `SEC-017`, `WEB-003`, `WEB-004`, `WEB-012`, `WEB-013` | HTML de e-mail escapado, metadata/noindex, 404/boundaries e CSP endurecida. | Unitários de segurança/web e build. | `PARTIALLY FIXED` | CSP mantém `unsafe-inline`; previews, CDN e boundary injetado não verificados. |
| `FINAL-033` — `INF-003`, `INF-008`, `INF-010`, `INF-011`, `INF-012`, `INF-013`, `INF-014`, `OBS-009`, `OBS-011`, `CQ-011` | Docker não-root, CI fixada, contrato de env, health/métricas e runbooks. | Env, secrets, build; smoke final não reexecutado. | `BLOCKED` | Backup/restore, CD, ingress, collector, alertas e shutdown reais. |
| `FINAL-034` — `DB-016`, `INF-004` | Query/checklist read-only preparados; nenhuma policy aplicada às cegas. | Nenhuma prova autorizada de roles/grants/RLS. | `NOT VERIFIED` | Isolamento físico do Supabase/storage desconhecido. |
| `FINAL-035` — `AUTH-013`, `AUTH-014`, `SEC-019` | Respostas uniformes, bcrypt para usuário ausente e mínimo de 8 caracteres. | Testes de enumeração e auth. | `PARTIALLY FIXED` | Política central/breached-password e limite distribuído pendentes. |
| `FINAL-036` — `FUX-013`, `FUX-014` | Nenhum handoff da etapa 08; código ainda mostra inglês/USD no carrinho e ignora `next` após login. | Inspeção direta; sem regressão correspondente. | `DEFERRED` | Inconsistência UX confirmada permanece. |

## 6. Divergências e achados ainda reproduzíveis

- `FRONTEND-FIXES.md` ausente: não foi inferido sucesso da etapa 08.
- `FUX-003`: checkout depende do Zustand e a confirmação chama apenas `clearCart()` local; o carrinho persistido não é fechado nessa UI.
- `FUX-008`/`FUX-010`: store/widget de pontos/carrinho ainda não distinguem de forma uniforme `error` de `empty/zero`.
- `FUX-009`: `app/profile/page.tsx` chama `getUserOrderHistory(..., 10, 0, ...)` sem navegação para os demais pedidos.
- `FUX-012`: formulários de autenticação ainda têm mensagens sem a associação acessível uniforme pedida no relatório.
- `FUX-013`: `CartDrawer`, `CartItem` e `CartSummary` ainda contêm textos em inglês e formatação inconsistente.
- `FUX-014`: `/login?next=...` é gerado, mas `LoginForm` ainda faz `router.push('/')`.
- `PERF-009`/`DB-015`, `DB-016`, `ARCH-013`, `INF-008` e parcelas externas de `INF-014` permanecem `NOT VERIFIED`; não foram convertidos em defeitos confirmados.

## 7. Verificação posterior em ambiente autorizado

1. **Banco/DBA:** descobrir versão e drift read-only, restaurar snapshot em ambiente isolado, ensaiar upgrade populado, validar `NOT VALID`, roles/grants/RLS e rollback.
2. **Asaas/Pagamentos:** sandbox com idempotência nativa, timeout antes/depois da resposta, evento repetido/fora de ordem, refund total/parcial, chargeback e reconciliador.
3. **Frete/ViaCEP/transportadoras:** cotação real, timeout, precisão, indisponibilidade e divergência apresentada ao usuário antes da cobrança.
4. **E-mail/DNS:** origem canônica, TLS, SPF/DKIM/DMARC, entrega/bounce e reset sem vazamento.
5. **Supabase/storage:** anon/customer A/customer B/admin/service-role, bucket, MIME/magic bytes, quota e URLs.
6. **Browser/assistivo:** Chrome/Firefox/Safari, 320/375/768/1366/1920 px, teclado, foco, NVDA/VoiceOver, reload do carrinho, falha de rede e checkout PIX/cartão/boleto.
7. **Plataforma/SRE:** smoke da imagem promovida, non-root, proxy/tenant, scheduler, métricas/alertas, graceful shutdown, backup/restore e rollback.

## 8. Limitações e risco residual

- Nenhuma produção, conta, gateway, e-mail, DNS, storage, cloud ou credencial real foi acessado.
- Não houve migration de produção, rotação, backup/restore, carga externa nem chamada de pagamento.
- O banco local é descartável e não representa cardinalidade/distribuição de produção.
- O audit de dependências online não foi repetido; a evidência anterior de duas moderadas no conjunto total/dev permanece, enquanto produção havia retornado zero.
- O workspace já continha todas as mudanças das etapas anteriores e continua sem commits; esta validação não separa autoria por commit.
- O risco residual agregado permanece **HIGH**, com um risco de migration classificado como `CRITICAL` até inventário/ensaio autorizado.

## 9. Arquivos alterados nesta etapa

- `lib/logger.ts` — fronteira segura da regex de telefone para preservar UUIDs.
- `tests/unit/logger.test.ts` — regressão determinística de UUID + telefone.
- `tests/unit/test-database-safety.test.ts` — credenciais explicitamente fictícias compatíveis com o scanner.
- `docs/remediation/FINAL-VALIDATION.md` — este inventário.
- `docs/remediation/PROGRESS.md` — registro append-only da etapa 15.

**Conclusão:** os gates locais de código, schema e concorrência estão verdes após duas correções pequenas encontradas pela própria validação. Isso não supera os bloqueios de rollout, refund/reconciliação, browser e infraestrutura. A recomendação objetiva é **não publicar** até que todos os itens da seção 4 tenham evidência autorizada e sejam reclassificados sem presumir sucesso externo.

## 2026-09-29 — execução dos prompts atualizados e correções locais

**Resultado:** execução contínua dos prompts aplicáveis concluída no ambiente local isolado. Os 17 arquivos da série (README + 00–15) indicam **GPT Astra (`gpt-6-astra`)** e a revalidação de 29/09/2026. Histórico acima preservado; este complemento prevalece sobre afirmações antigas de falta de worker/refund, Node incompatível, fixtures inválidas e jornadas não executadas. Não houve commit ou publicação.

### Escopo, ambiente e confiança

Node **22.22.1**, npm **10.9.4**, Next **16.3.5**, PostgreSQL **16**. Node temporário oficial com checksum conferido; instalação global intacta. PostgreSQL próprio desta execução, container `codex-astra-remediation-20260929`, tmpfs, sem volumes/mounts, bind127.0.0.1:55439. Outra base dentro do mesmo container serviu ao preflight negativo. O banco da aplicação não foi usado.

Os launchers forneceram variáveis de sistema permitidas e valores fictícios explícitos. O Prisma CLI registrou carregamento de .env, mas DATABASE_URL/DIRECT_URL já estavam explicitamente substituídas pela base descartável; nenhuma integração configurada foi acionada. Build em cópia sem .env; rede dos processos de teste bloqueada fora do loopback autorizado, inclusive portas 5432/5433. Gateway/Resend foram interceptados por respostas locais fictícias. Nenhuma cobrança, estorno, mensagem, upload ou webhook foi enviado a serviço externo. Downloads do runtime oficial foram somente leitura e não reutilizaram as integrações da aplicação.

Confiança **CONFIRMED** nas reproduções/testes locais descritos. Os outros estados foram herdados da revalidação de 29/09, preservando suas limitações; não se declara uma nova auditoria integral de 198 achados. Auditorias em `docs/audits/` não foram reescritas.

### Gates da versão final

| Verificação | Resultado efetivamente obtido |
|---|---|
| Unitários | **93 arquivos / 622 testes aprovados**, rodada final13:58 |
| Integrações | **11 arquivos / 68 testes aprovados**, rodada final13:59 |
| Core PostgreSQL | 8 suites /34 casos, incluindo reconciliação10 e novos invariantes8; fazem parte das68 integrações |
| HTTP real | 26 casos com sessões persistidas por hash; anônimo, dono/não dono e admins de duas lojas; fazem parte das68 |
| Performance de consultas | 8 casos; massa1.000 clientes/1.650 pedidos, estatísticas explícitas apenas no banco descartável |
| Tipos | `tsc --noEmit`, exit 0 |
| Lint | exit 0, **0 erros /15 avisos** de imagens/hooks; nenhum limite relaxado para esta rodada |
| Contrato de ambiente | **38 nomes** cobertos; `ALLOW_ASAAS_SANDBOX_WRITE=0` documentado |
| Scanner de segredos | exit 0; sem padrões proibidos nos arquivos examinados |
| Migrations | 29 aplicadas desde zero; diff Prisma: **No difference detected** |
| Preflight negativo | 28 migrations anteriores + dado inválido;29ª aborta, preserva1 linha e instala0 triggers |
| Build isolado | webpack, exit 0, **51 páginas geradas**, com typecheck |
| Navegador | Jornadas Chrome/CDP reais com DB/provedores fictícios, evidências abaixo |
| Encerramento | Linux/Next16.3.5: SIGTERM durante requisição atrasada, HTTP 200 antes de exit 143, novas conexões recusadas,7,738 s |

Comandos, condições de isolamento e limitações de reprodução: [commands.md](evidence/astra-20260929/commands.md). Resultados estruturados: [validation.json](evidence/astra-20260929/validation.json). O diff Prisma não prova triggers customizados: testes negativos e corrida pai/filho cobrem essa parte.

### Correções e evidências comportamentais

- **Sessões/HTTP:** fixtures armazenam SHA-256 e entregam token bruto ao cliente (`tests/setup/auth.ts:7`, `tests/setup/db.ts:91`, `lib/session-token.ts:4`). Cliente HTTP preserva Host, recusa origem externa e não segue redirects. Matriz valida status/payload específicos e ausência de mutação indevida. Reconciliação PostgreSQL e invariantes novas incluídas no core CI.
- **Isolamento físico:** migration `20260929170000_commerce_child_ownership/migration.sql:1` verifica dados antes de instalar triggers; protege referências de loja/dono/variante e mudanças nos pais. Negativos, concorrência e rollback aprovados. Ensaio inválido não corrigiu/apagou dados silenciosamente.
- **Erros/validação/logs:** falhas inesperadas de cadastro, pontos, frete e endereço não retornam mensagens internas. Nome é validado após trim e limites seguem colunas. Logger sanitizado substitui console.error bruto nos caminhos server; Prisma não imprime SQL/payload de falha. Erros de negócio conhecidos mantêm contrato.
- **Administração:** serviço `services/store-settings-audit.service.ts:15` valida ator/tenant e grava settings + auditoria na mesma transação. Snapshots excluem PIX, contato, endereço, credenciais e texto livre; metadata registra nomes dos campos enviados. Falha de gravação do audit ou do callback reverte a mutação. Settings e fidelidade propagam requestId.
- **Navegador:** login com next, carrinho, PIX fake, offline/retry, confirmação, reload, duas abas e administração exercitados. Retorno de foco após Escape do carrinho estava em BODY e foi corrigido. Checkout agora explica falha de conexão em português e foca o resumo.14 controles administrativos receberam labels associados. Duas compras geraram dois pagamentos fictícios distintos, dois carrinhos concluídos e estoque100→98; salvar settings gerou audit.
- **Paginação/lotes:** desempate por id em clientes/pedidos/extrato; páginas com timestamp igual testadas. Expiração carrega100 carteiras/100 eventos por lote, continua após falha individual e interrompe leitura do ledger quando cobre saldo. Testes com205 carteiras e duas páginas de ganhos aprovados.
- **Qualidade:** teste autorreferente do cabeçalho substituído por renderização dos componentes reais; extrações limitadas a hash puro e auditoria compartilhada. Checkout, reconciliador e refund canônicos preservados.

Evidência de browser: [recuperação do checkout](evidence/astra-20260929/checkout-recovery.json), [pós-condições no banco](evidence/astra-20260929/database-postconditions.json), [plataforma web](evidence/astra-20260929/web-checks.json), [confirmação](evidence/astra-20260929/confirmation.png), [375 px](evidence/astra-20260929/login-375.png), [768 px](evidence/astra-20260929/login-768.png), [1440 px](evidence/astra-20260929/login-1440.png), [administração](evidence/astra-20260929/admin-orders.png).27 sessões CDP capturadas sem exceção Runtime; isso não certifica todos os caminhos de hidratação. Larguras375/768/1366/1440/1920 sem overflow observado; zoom foi simulado por largura equivalente a200%, não zoom nativo/tecnologia assistiva. Reduced-motion impediu carregar vídeo.

### Contagens e rastreabilidade atuais

| Universo | Corrigido | Parcialmente corrigido | Persistente | Regressão | Não verificado |
|---|---:|---:|---:|---:|---:|
| 198 IDs de origem | **133** | **48** | **11** | **0** | **6** |
| 36 grupos FINAL | **15** | **19** | **1** | **0** | **1** |

Alterações de estado de origem desta rodada: DB-006, DB-013, INF-010, TST-002, TST-008, OBS-012 e CQ-011 → corrigidos; TST-004 → parcial. Demais estados vêm da revalidação de 29/09, com evidências complementadas nos handoffs. ADM-008 e DB-014 mantêm classificação parcial por seus resíduos, embora as correções locais descritas tenham prova. FINAL-005 passa a corrigido; FINAL-033 deixa regressão e fica parcial. Severidade original é preservada, separada do risco residual.

Classificação individual completa e proveniência: [source-status.json](evidence/astra-20260929/source-status.json). A matriz abaixo cobre cada um dos198IDs exatamente uma vez, com responsável e critério de encerramento.

| Grupo / IDs de origem | Severidade original / residual | Estado atual | Responsável / prompt | Prova e encerramento restante |
|---|---|---|---|---|
| FINAL-001 — ARCH-001, BE-001, CTR-001, FUX-001 | BLOCKER / LOW | corrigido | 05/08 | Checkout PIX fake, falha offline, retry e confirmação concluídos; manter regressão e homologar fornecedor separadamente. |
| FINAL-002 — ARCH-002, DB-001, INF-001 | BLOCKER / LOW | corrigido | 03/12 | 29 migrations em banco descartável + diff sem diferenças; preflight negativo preservou dado inconsistente. Upgrade da base que será preservada continua no FINAL-003. |
| FINAL-003 — DB-002, DB-010, INF-002 | CRITICAL / HIGH | persistente | 03 + responsável pelos dados | Risco condicionado à versão/dados que serão preservados. Inventariar origem e ensaiar cópia sanitizada; não extrapolar sucesso do banco vazio. |
| FINAL-004 — ARCH-003, DB-009, BE-003, CTR-006, CTR-010, CTR-015, FUX-002, ADM-002 | CRITICAL / MEDIUM | parcialmente corrigido | 04 + financeiro | Homologar centavos/tarifas/parcelas com provedor; não houve cálculo financeiro externo nesta rodada. |
| FINAL-005 — ARCH-004, DB-006, DB-011, BE-004, CTR-002, AUTH-005, SEC-006 | CRITICAL / LOW | corrigido | 03/05 | Invariantes físicas cobrem CartItem/OrderItem, variante-produto, endereço e carrinho de origem; negativos e concorrência passaram. Publicação exige inventário/preflight no destino, separado em FINAL-003. |
| FINAL-006 — ARCH-005, DB-004, BE-005, CTR-003, CTR-009, SEC-013, OBS-001 | CRITICAL / LOW | corrigido | 04/11 | Provar redelivery real posteriormente; o defeito original de consumo prematuro não permanece. |
| FINAL-007 — ARCH-006, DB-003, DB-012, BE-006, CTR-005 | CRITICAL / MEDIUM | parcialmente corrigido | 03 + negócio | Definir unicidade de CPF e impor invariante adequada; não reabrir transição de pedido já corrigida. |
| FINAL-008 — ARCH-007, BE-007, CTR-004, CTR-007, CTR-011, CTR-012, SEC-012, OBS-003, OBS-010 | CRITICAL / HIGH | parcialmente corrigido | 04/11 + operação | Homologar busca por referência e falhas ambíguas no provedor, instalar agenda/alertas e medir deadlines; ausência de worker no código é alegação superada. |
| FINAL-009 — DB-005, BE-012, CTR-008, CTR-014, CQ-001, OBS-002, OBS-005, ADM-001 | CRITICAL / HIGH | parcialmente corrigido | 04/07 + financeiro | Validar provedor e operação de boleto, pedido enviado/entregue, disputa e pontos gastos; manual não equivale a estorno financeiro confirmado. |
| FINAL-010 — BE-002, AUTH-001, SEC-001, ADM-007 | CRITICAL / LOW | corrigido | 01/05 | Revogação de exposição histórica permanece agrupada em FINAL-019; scanner não prova inexistência em todos os históricos. |
| FINAL-011 — AUTH-002, SEC-002 | CRITICAL / LOW | corrigido | 02/04 | Vínculo de conta futuro deve exigir posse; nenhum account linking externo executado. |
| FINAL-012 — BE-009, AUTH-003, SEC-003 | CRITICAL / LOW | corrigido | 02/12 | DNS/TLS do destino são requisitos de publicação; não alteram correção da entrada controlada pelo solicitante. |
| FINAL-013 — TST-005 | CRITICAL / LOW | corrigido | 13 | Manter banco de teste exclusivo e validar ambiente antes de qualquer cleanup. |
| FINAL-014 — ARCH-009, DB-007, BE-008, CTR-013, AUTH-004, SEC-005, ADM-003 | HIGH / HIGH | parcialmente corrigido | 04/07 + negócio | Decidir e implementar tratamento de cashback já gasto, teto e reversão vinculada; governança depende do negócio. |
| FINAL-015 — DB-008, BE-011, CTR-016, FUX-003, ADM-010 | HIGH / MEDIUM | parcialmente corrigido | 03/07 + estoque | Reconciliar dados legados e definir fonte única física/ERP se aplicável; cenário de carrinho antigo do relatório de correção foi superado. |
| FINAL-016 — AUTH-006, AUTH-007, AUTH-009, SEC-007, SEC-008, SEC-009, SEC-021, INF-006 | HIGH / LOW | corrigido | 02/13 | Login/cookie no navegador e fixtures por hash comprovados. Entrega real de email não verificada. |
| FINAL-017 — ARCH-011, AUTH-008, SEC-010, SEC-015, PERF-005, PERF-008 | HIGH / MEDIUM | parcialmente corrigido | 01/06/12 + operação | Localhost de uma instância não demonstra falha horizontal; definir proxy/IP confiável e compartilhamento conforme topologia futura. |
| FINAL-018 — BE-010, AUTH-010, AUTH-011, SEC-011, SEC-014, INF-009 | HIGH / LOW | corrigido | 01/05 | Políticas ACL/storage e arquivo malicioso em ambiente real não testados; não houve upload ou simulador externo. |
| FINAL-019 — AUTH-012, AUTH-015, SEC-004, SEC-020, INF-005, ADM-004 | HIGH / MEDIUM | parcialmente corrigido | 01/02 + titular das credenciais | Rotação/revogação de valores históricos e recuperação operacional não verificadas. |
| FINAL-020 — ARCH-012, DB-017, BE-017, FUX-015, TST-001, TST-002, TST-003, TST-004, TST-006, TST-007, TST-008, TST-009, TST-010, PERF-010, CQ-005, CQ-006, ADM-011, OBS-014 | HIGH / MEDIUM | parcialmente corrigido | 13/15 | 622 unitários, 68 integrações atuais, HTTP e CDP local; reconciliação + invariantes novas entram no core CI. Falta bootstrap browser portátil/CI, coverage, mutation testing e outros navegadores. |
| FINAL-021 — ARCH-013, INF-007, OBS-006, OBS-007 | HIGH / HIGH | parcialmente corrigido | 11/12 + operação | Agenda/heartbeat externo não comprovados; email sem outbox/retry durável pode perder notificação. Provar operação antes de atendimento contínuo. |
| FINAL-022 — DB-013, DB-014, DB-015, BE-015, FUX-007, FUX-009, PERF-001, PERF-007, PERF-009 | HIGH / MEDIUM | parcialmente corrigido | 10/03 | Paginação com desempate e lotes de 100 em carteiras/ledger; medições locais de consultas passaram. Falta EXPLAIN/cardinalidade do destino, checkpoint durável e limites de duração do job. |
| FINAL-023 — FUX-004, WEB-005, WEB-006, WEB-007 | HIGH / LOW | corrigido | 08/09 | Labels administrativas associadas aos 14 controles e formulário testado no DOM; leitores assistivos e contraste completo por tenant não certificados. |
| FINAL-024 — FUX-005, WEB-008 | HIGH / LOW | corrigido | 08/09 | Defeito de retorno de foco foi reproduzido no browser e corrigido; trap/Escape/restauração ao disparador passaram no Chrome. |
| FINAL-025 — FUX-006, WEB-001, WEB-002 | HIGH / LOW | corrigido | 09 | Rastreamento/indexação externos não executados; taxonomia/slug continua decisão de produto. |
| FINAL-026 — ARCH-008, BE-013, ADM-005, ADM-006, ADM-008, ADM-009, ADM-012 | HIGH / MEDIUM | parcialmente corrigido | 07 + produto | Settings e fidelidade usam auditoria transacional sanitizada, ator/tenant/requestId; falha do insert reverte mutação. Retenção e políticas de administração/taxonomia continuam condicionais. |
| FINAL-027 — BE-014, BE-016, SEC-018, OBS-004, OBS-008, OBS-012, OBS-013 | HIGH / MEDIUM | parcialmente corrigido | 01/05/11 | Console.error bruto removido dos caminhos server app/api, lib e services; Prisma não imprime payload de erro; fronteiras públicas testadas. Coletor, retenção, RBAC e expurgo histórico seguem pendentes. |
| FINAL-028 — ARCH-010, CQ-003, CQ-004, CQ-007, CQ-008, CQ-009, CQ-010 | MEDIUM / MEDIUM | parcialmente corrigido | 06/14 | Strict incremental e decomposição por fluxo após testes; módulos sem uso aparente requerem análise de grafo antes de remoção. |
| FINAL-029 — FUX-008, FUX-010, PERF-004, PERF-006, CQ-002 | HIGH / MEDIUM | parcialmente corrigido | 10/04 | Checkout fake online medido em 166,8 ms (uma amostra), erro offline recuperável e foco corrigido. Isso não prova p95/p99/SLO do gateway. |
| FINAL-030 — FUX-011, PERF-002, PERF-003, WEB-010 | HIGH / MEDIUM | parcialmente corrigido | 10/08 | Medições locais de imagens/recursos e reduced-motion realizadas; sem vídeo carregado em reduced-motion. LCP/CLS/INP representativos e ativos reais permanecem pendentes. |
| FINAL-031 — FUX-012, WEB-009, WEB-011 | MEDIUM / LOW | corrigido | 09 | Sem overflow nos recortes 375/768/1366/1440/1920; teste de largura equivalente a zoom200%. Contraste completo e leitores assistivos pendentes. |
| FINAL-032 — SEC-016, SEC-017, WEB-003, WEB-004, WEB-012, WEB-013 | MEDIUM / MEDIUM | parcialmente corrigido | 09/01 | Nonce/hash e rollout report-only com validação Next; não foi provada exploração XSS. |
| FINAL-033 — INF-003, INF-008, INF-010, INF-011, INF-012, INF-013, INF-014, OBS-009, OBS-011, CQ-011 | HIGH / MEDIUM | parcialmente corrigido | 12/11 | Checker restaurado; Node 22/npm10, build e SIGTERM/drain local passaram. Imagem Linux de ensaio não certifica imagem de release; DNS, backup/restore, métricas e rollout dependem de operação autorizada. |
| FINAL-034 — DB-016, INF-004 | HIGH / HIGH | não verificado | 03/12 + titular do ambiente | Inspecionar políticas no destino autorizado e testar fronteiras; não inferir vazamento por falta de evidência externa. |
| FINAL-035 — AUTH-013, AUTH-014, SEC-019 | MEDIUM / MEDIUM | parcialmente corrigido | 02 + produto | Definir resposta pública uniforme e avaliar enumeração/limites no fluxo completo; não enfraquecer validação de senha. |
| FINAL-036 — FUX-013, FUX-014 | LOW / LOW | corrigido | 08 | Revisão visual/tradução completa continua fora do recorte comprovado. |

### Limitações, falhas de ensaio e próximo encerramento

As primeiras rodadas identificaram fixtures/token inadequados, Host descartado pelo fetch do Node 22, foco perdido no carrinho e falha de rede em inglês; todos foram corrigidos e retestados. Performance inicialmente excedeu o limiar em massa recém-inserida sem estatísticas; ANALYZE foi acrescentado ao setup descartável, preservando limites absolutos. Uma tentativa de build omitiu a pasta store da cópia e uma tentativa de drain usou imagem sem o runtime webpack; o harness foi corrigido, sem classificar essas tentativas como passes.

Medições finais locais: clientes 11 ms/2 queries, busca 8 ms/2 queries, cinco páginas5/5/5/3/4 ms; métricas100/1000 pedidos 13/10 ms; listagem de pedidos 10 ms/5 queries. Checkout fake166,8 ms/1.259 bytes em uma amostra bem-sucedida. Não equivalem a p95/p99, teste de carga representativo, EXPLAIN do destino ou Core Web Vitals.

Permanecem separados:

1. **Decisões comerciais:** cashback já gasto, disputas, logística/boleto, unicidade de CPF e governança de exceções. Manter casos sem política bloqueados; não inventar compensação financeira.
2. **Dados a preservar:** inventário de versão/drift e ensaio de cópia sanitizada populada, especialmente a cadeia histórica de migrations (FINAL-003). Sucesso em banco vazio não autoriza migrar o banco do cliente.
3. **Operação externa:** homologar gateway/reconciliação/refund/centavos; scheduler/alertas, entrega durável de notificações, storage/RLS/grants, rotação/revogação histórica, DNS/TLS/proxy, backup/restore e rollout. Email aguardado não garante durabilidade; outbox/retries/dead-letter continuam requisito próprio.
4. **Dívida local condicionada:** runner browser portátil/CI, demais engines e leitores de tela, coverage/mutation, CSP nonce/hash, strictness incremental e módulos grandes, checkpoint/duração dos jobs. Não criar cupons/taxonomia/soft delete ou infraestrutura distribuída sem necessidade aprovada.

O teste de SIGTERM reutilizou imagem local com arquivos atuais montados somente leitura e rede desativada; comprova drain HTTP naquele ensaio, não uma imagem de release promovida ou kill durante aceitação financeira. O aviso de raiz inferida no build decorreu da cópia isolada; Vite também avisou sobre futuro configLoader native. npm audit online não foi repetido. Os15 avisos de lint permanecem visíveis.

**Publicação não liberada por esta execução.** A operação somente local é contexto; requisitos de ambiente publicado permanecem com responsáveis e testes próprios, sem transformar ausência de deploy em defeito da aplicação.

**Encerramento do ensaio:** navegador com perfil próprio e servidor da porta 3209 encerrados; container descartável conferido por ID/label/tmpfs e parado, com remoção automática. O banco da aplicação permaneceu intocado. Artefatos temporários ficaram em `.tmp/`, agora ignorado pelo Git; evidências revisáveis estão neste diretório. A comparação com os hashes iniciais confirmou nenhum arquivo ausente e nenhuma alteração em `docs/audits/`; inventário em [change-inventory.json](evidence/astra-20260929/change-inventory.json). `git diff --check` passou.
