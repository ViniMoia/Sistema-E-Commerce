# Correções de backend, APIs e regras de negócio — etapa 05

**Data:** 2026-09-27  
**Escopo:** `BACKEND-AUDIT.md`, `ARCHITECTURE-AUDIT.md`, `FINAL-AUDIT.md`, plano e progresso de remediação, código e testes locais.  
**Estado da entrega:** correções locais concluídas para carrinho, máquina de estados e catálogo; contratos globais, CI e decisões de domínio listadas como pendentes. Publicação continua bloqueada.

## Resultado executivo

O carrinho deixou de criar variantes de catálogo em uma ação de cliente. Produto, variante, usuário e itens são conferidos contra o tenant autenticado; quantidade é validada também no serviço; e as mutações do mesmo usuário são serializadas por lock de linha dentro de transação. Em PostgreSQL 16 descartável, 20 adições simultâneas produziram exatamente um carrinho, um item, quantidade 20 e uma única variante.

A transição de pedido passou a carregar `deliveryType`, persistir `trackingCode`, criar `OrderStatusHistory` na mesma transação do compare-and-set e atender admin, webhook e confirmação do cliente pelo mesmo comando. A UI importa a mesma tabela de transições do domínio. O wrapper administrativo duplicado também passou a apenas delegar. Assim, retirada/sem frete aceita `PAID → DELIVERED`, enquanto entrega comum exige `SHIPPED`.

O catálogo passou a aplicar a allowlist de `sortBy`, desempate determinístico, filtros estritos e metadados de paginação. Para não quebrar os clientes que esperam array, o corpo foi preservado e os metadados são enviados em headers. A migração para envelope versionado permanece explícita como dívida de contrato.

Nenhum serviço, conta, banco compartilhado, produção, cloud ou credencial real foi acessado. O PostgreSQL local descartável foi removido após as provas; seus dados efêmeros não são recuperáveis.

## Classificação dos achados

`VALID` descreve o estado confirmado antes da correção. `NOT VERIFIED` não foi promovido a defeito confirmado.

| ID | Severidade / confiança | Revalidação | Estado nesta etapa | Evidência e risco residual |
|---|---|---|---|---|
| BE-001 | BLOCKER / CONFIRMED | ALREADY RESOLVED na etapa 04 | ALREADY RESOLVED | Contrato e rota canônicos de checkout revalidados pelo build e pelos 440 testes unitários. Browser real continua NOT VERIFIED. |
| BE-002 | CRITICAL / CONFIRMED | ALREADY RESOLVED nas etapas 01–02 | ALREADY RESOLVED | DTO público e isolamento de configuração permanecem cobertos pelas regressões de segurança. |
| BE-003 | CRITICAL / CONFIRMED | ALREADY RESOLVED na etapa 04 | ALREADY RESOLVED | Frete autoritativo e cotação vinculada foram revalidados; provedores reais continuam NOT VERIFIED. |
| BE-004 | CRITICAL / HIGH CONFIDENCE | ALREADY RESOLVED na etapa 04 | ALREADY RESOLVED | Caminho público alternativo de criação responde 410; carrinho agora também fecha a seleção cross-tenant que alimentava a cadeia. |
| BE-005 | CRITICAL / HIGH CONFIDENCE | ALREADY RESOLVED parcialmente nas etapas 03–04 | DEFERRED parcial | Inbox retomável e reconciliação de identidade/valor estão implementadas. Worker de reconciliação e Asaas real permanecem pendentes. |
| BE-006 | CRITICAL / HIGH CONFIDENCE | ALREADY RESOLVED na etapa 03 | ALREADY RESOLVED | CAS e efeitos idempotentes passaram novamente em PostgreSQL; histórico agora acompanha o mesmo commit. |
| BE-007 | HIGH / CONFIRMED | ALREADY RESOLVED parcialmente na etapa 04 | DEFERRED parcial | Chave e fingerprint obrigatórios evitam nova cobrança; resultado externo incerto ainda exige reconciliador operacional. |
| BE-008 | HIGH / CONFIRMED | ALREADY RESOLVED nas etapas 01–02 | ALREADY RESOLVED | Simulação de pontos usa identidade/tenant autenticados; suite completa permaneceu verde. |
| BE-009 | HIGH / CONFIRMED | ALREADY RESOLVED nas etapas 01–02 | ALREADY RESOLVED | Recuperação deriva origem canônica e não faz fallback cross-tenant. |
| BE-010 | HIGH / CONFIRMED | ALREADY RESOLVED na etapa 01 | ALREADY RESOLVED | Simulador fail-closed/autorizado permaneceu coberto pelas regressões. |
| BE-011 / FINAL-015 | HIGH / HIGH CONFIDENCE | VALID | FIXED | Sem mutação de catálogo; tenant obrigatório; lock transacional por usuário; 20 adições reais resultaram em 1 carrinho, 1 item e soma 20. Estoque é apenas validado aqui e continua reservado no checkout. |
| BE-012 | HIGH / CONFIRMED | ALREADY RESOLVED parcialmente na etapa 04 | DEFERRED parcial | Refund tardio abre reconciliação sem regredir fulfillment. Refund parcial, logística reversa e política comercial dependem de decisão externa. |
| BE-013 / ARCH-008 / FINAL-026 | MEDIUM + HIGH / CONFIRMED | VALID | FIXED localmente | Fonte única de transições, `deliveryType`, tracking, histórico e confirmação do cliente centralizados e testados. Importadores futuros devem usar o mesmo comando. |
| BE-014 / FINAL-027 | MEDIUM / CONFIRMED | VALID | DEFERRED parcial | Carrinho e status agora usam schema estrito, 422 e códigos estáveis; erros de domínio usam 404/409/422 e 5xx não expõe detalhe. Padronização global/envelope versionado não foi imposta para evitar quebra de clientes. |
| BE-015 / FINAL-022 | MEDIUM / CONFIRMED | VALID | FIXED localmente | `sortBy`, filtros, limite, total, próxima página e cursor foram implementados. `relevance` usa fallback lexical, pois não existe ranking full-text. |
| BE-016 / FINAL-027 | MEDIUM / CONFIRMED | ALREADY RESOLVED na etapa 01 | ALREADY RESOLVED | Redação de e-mail/documentos/segredos no logger revalidada pela suite. Retenção do coletor externo continua NOT VERIFIED. |
| BE-017 / ARCH-012 / FINAL-020 | MEDIUM + HIGH / CONFIRMED | VALID | DEFERRED parcial | DTO legado `toStatus` foi corrigido, história/tracking existem e foram adicionadas provas unitárias e PostgreSQL concorrente. A suite HTTP antiga ainda falha no `beforeAll` porque sua fixture não cria a Loja exigida pela FK; CI continua sem job PostgreSQL/E2E. |

Nenhum achado foi classificado como `INVALID` nesta etapa.

## Correções por causa raiz

### 1. Carrinho sem autoridade sobre catálogo

**Antes:** adicionar sem `variantID` podia criar `ProductVariants`; produto/primeiro item não era vinculado ao tenant da sessão; criação e incremento eram read-then-write sem transação.

**Depois:** a API passa o `lojaID` autenticado; o serviço exige variante persistida pertencente ao produto e à loja; produto sem variante retorna conflito e jamais escreve no catálogo. A transação bloqueia a linha do usuário antes de localizar/criar carrinho e item. Quantidade fora de 1–99 falha antes do banco. O snapshot de nome/preço/imagem vem do banco.

**Trust boundary:** `productID`, `variantID` e quantidade vêm do navegador; usuário/tenant vêm da sessão; produto, variante, preço e estoque vêm do banco; somente dados reconciliados alcançam `Cart`/`CartItem`.

**Provas:** unitários cobrem 0, negativo, fracionário, >99, tenant diferente, produto sem variante, snapshot autoritativo e estoque pai/variante. A integração real cobriu 20 reenvios concorrentes.

**Critério de encerramento atendido:** nenhuma escrita em `ProductVariants`, um carrinho/item e soma exata sob concorrência. Não foi adicionada migration nesta etapa.

### 2. Uma máquina de estados para todos os canais

**Antes:** serviço, UI, wrapper admin e confirmação do cliente tinham regras próprias; `deliveryType` não chegava ao validador; tracking era descartado; timeline ficava vazia.

**Depois:** `lib/order-transitions.ts` expõe a lista canônica usada pelo backend e UI. `updateOrderStatus` lê `deliveryType`, faz claim `id + estado anterior + tenant (+ proprietário)`, grava tracking/confirmação, histórico e auditoria na mesma transação. Admin, sistemas/webhook e cliente delegam a esse comando. A confirmação do cliente mantém dupla checagem proprietário+tenant e repete-a no CAS.

**Provas:** regressões cobrem retirada `PAID → DELIVERED`, bloqueio do mesmo salto em entrega normal, tracking em `SHIPPED`, histórico com ator, campos extras rejeitados e conflito concorrente. O teste PostgreSQL anterior confirmou apenas um cancelamento/histórico sob duas operações simultâneas.

**Risco residual:** `OrderStatusHistory` registra ator e IP, mas ainda não possui coluna explícita de origem/canal ou motivo; adicionar isso exige migration e contrato histórico. Refund financeiro continua separado do fulfillment conforme etapa 04.

### 3. Catálogo ordenado e paginável sem quebra de cliente

**Antes:** `sortBy` era aceito e ignorado; a resposta era um array sem total/continuação; `all` removia o teto internamente.

**Depois:** ordenações por preço e data têm desempate por `id`; busca com `relevance` usa fallback lexical declarado; filtros são estritos, limitados e rejeitam faixa invertida ou `page + cursor`. A rota continua devolvendo array e publica `X-Total-Count`, `X-Page`, `X-Page-Size`, `X-Has-Next-Page` e `X-Next-Cursor`. `all` não existe no schema HTTP e permanece apenas no SSR interno atual.

**Plano de transição:** um futuro `/v2` pode mover os headers para `{ data, pagination }`; consumidores atuais devem primeiro ler os headers. Não houve alteração silenciosa do corpo usado por admin/vitrine.

**Risco residual:** fallback lexical não é ranking de relevância; paginação por cursor baseada apenas em `id` não representa cursor composto da ordenação. Até uma versão de contrato, paginação por página é a prova principal para ordenações não baseadas em ID.

### 4. Validação, HTTP e erros

Nos endpoints alterados, JSON/DTO inválido retorna 422 com código `VALIDATION_ERROR`; recurso ausente retorna 404; conflito de estoque/tenant/concorrência retorna 409; e erro inesperado retorna 500 sem mensagem interna. O sucesso legado do carrinho (objeto) e catálogo (array) foi preservado.

A taxonomia global de todas as rotas não foi reescrita nesta etapa. `BE-014` continua `DEFERRED parcial`, pois padronizar envelopes sem versionamento quebraria consumidores e extrapolaria os grupos corrigidos.

## Extremos solicitados

| Cenário | Resultado |
|---|---|
| Quantidade 0, negativa, fracionária ou >99 | Rejeitada no schema e no serviço; nenhuma transação iniciada. |
| Produto sem variante | Rejeitado com 409; catálogo não é mutado. |
| Produto indisponível/sem estoque | Estoque zero é rejeitado com 409 em serviço e PostgreSQL local. O modelo `Product` não possui estado ativo/inativo; portanto “produto desativado” permanece NOT VERIFIED, sem equiparar indevidamente desativado a estoque zero. |
| Cupom expirado/reutilizado | Não existe modelo, rota ou serviço de cupom no código inspecionado. O cenário é NOT VERIFIED/não aplicável à superfície atual; nenhum defeito ou sucesso foi inventado. |
| Pontos insuficientes | ALREADY RESOLVED; `loyalty-security-concurrency.test.ts` prova rejeição e rollback sob duas tentativas. Reexecutado dentro dos 440 unitários. |
| Reenvio de requests | Carrinho: 20 operações concorrentes somaram 20 sem duplicar estruturas. Checkout: idempotência da etapa 04 foi revalidada. |
| Tracking e retirada | Tracking persiste em `SHIPPED`; retirada/NONE permite `PAID → DELIVERED`; entrega comum não permite. |

## Itens arquiteturais correlatos

| ID | Estado | Próximo passo objetivo |
|---|---|---|
| ARCH-008 | FIXED localmente | Adicionar origem/motivo versionados ao histórico somente com migration revisada. |
| ARCH-009 | DEFERRED | Produto/financeiro devem definir vesting ou dívida de pontos; provar pago → gasto → cancelamento sem saldo semanticamente inválido. |
| ARCH-010 | DEFERRED parcial | Order/cart foram centralizados; ainda há acesso Prisma e serviços duplicados fora destes agregados. Migrar por caracterização, não por refatoração global. |
| ARCH-011 | DEFERRED / NOT VERIFIED externamente | Selecionar backend compartilhado e provar rate limit/cache entre duas instâncias. |
| ARCH-012 | DEFERRED parcial | CI deve subir PostgreSQL, aplicar migrations e executar unit/integration/build; fixture HTTP legada precisa criar Loja/Product e fazer cleanup escopado. |
| ARCH-013 | NOT VERIFIED | Confirmar scheduler/IaC fora do repositório em ambiente autorizado; não foi promovido de SUSPECTED para defeito. |

## Serviços e ambientes reais pendentes

| Responsável / ambiente | Verificação posterior | Estado |
|---|---|---|
| PostgreSQL de cada ambiente / DBA | Existência de carrinhos ativos duplicados/itens cross-tenant legados, plano de saneamento e locks sob carga real. | NOT VERIFIED |
| Asaas / financeiro | Reconciliação, refund parcial, chargeback e idempotência externa conforme etapa 04. | NOT VERIFIED |
| ERP/catálogo / produto | Fonte de verdade de estoque pai/variante e eventual ciclo ativo/inativo de produto. | DEFERRED |
| CI / plataforma | PostgreSQL efêmero, migrations, integrações e E2E como gates obrigatórios. | DEFERRED |
| Scheduler/cache/rate limit / operações | Agenda durável, duas instâncias, invalidation e política fail-open/fail-closed. | NOT VERIFIED |
| Política de cupons / produto | Decidir se cupons pertencem ao escopo; só então modelar validade, uso e idempotência. | NOT VERIFIED |

## Comandos e resultados

| Comando / verificação | Resultado |
|---|---|
| `npm run test:unit` | 59 arquivos, 440/440 testes, exit 0. |
| `npx tsc --noEmit` | Exit 0. |
| `npm run lint` | Exit 0, 0 erros e 20 warnings preexistentes/fora do escopo. |
| `npm run build` | Exit 0; Next.js 16.3.5, 51 páginas/rotas. |
| `npx prisma migrate deploy` em PostgreSQL 16 vazio | 24 migrations aplicadas, exit 0. |
| `npx vitest run` nos três arquivos de integração focal | 3 arquivos, 9/9 testes, exit 0. |
| `npx vitest run tests/integration/status-transitions.test.ts` | Suite falhou no `beforeAll`: FK `User_lojaID_fkey`; 17 testes não executados. Registrado como limitação de fixture, não como sucesso. |
| ESLint direcionado + `git diff --check` | Exit 0; diff sem erro, apenas avisos LF/CRLF. |
| Remoção do banco descartável | `codex-remediation05-postgres` removido; dados efêmeros não recuperáveis. |

O aviso do Vitest sobre futura mudança de `configLoader` e os 20 warnings globais do ESLint foram preservados como dívida, sem serem tratados como falhas aprovadas.

## Arquivos da etapa

### Produto

- `services/cart.service.ts`
- `app/api/cart/route.ts`
- `services/order.service.ts`
- `services/admin.service.ts`
- `lib/order-transitions.ts`
- `lib/validators/order.validators.ts`
- `app/api/admin/orders/[orderId]/status/route.ts`
- `app/api/orders/[id]/confirm-delivery/route.ts`
- `components/admin/orders/OrderStatusManager.tsx`
- `components/admin/orders/OrderDetailDrawer.tsx`
- `types/admin.types.ts`
- `services/product.service.ts`
- `lib/validators/product.ts`
- `app/api/products/route.ts`

### Testes

- `tests/unit/cart.test.ts`
- `tests/unit/backend-order-contracts.test.ts`
- `tests/unit/client-confirmation.test.ts`
- `tests/unit/product-pagination.test.ts`
- mocks de histórico atualizados nas regressões de pedido/fidelidade
- `tests/integration/backend-invariants.test.ts`
- `tests/integration/database-invariants.test.ts`
- `tests/integration/status-transitions.test.ts` (contrato atualizado; fixture ainda bloqueada)

### Documentação

- `docs/remediation/BACKEND-FIXES.md`
- `docs/remediation/PROGRESS.md`

**Migration desta etapa:** nenhuma.  
**Commit:** nenhum. Alterações preexistentes no workspace foram preservadas.

## Risco residual e encerramento

Risco residual da etapa: **HIGH**, principalmente por CI sem integração obrigatória, fixture HTTP legada bloqueada, decisões de clawback/cupom/produto ativo, sistemas horizontais e integrações externas não verificadas. As correções locais de `BE-011`, `BE-013/ARCH-008` e `BE-015` possuem prova comportamental; `BE-014` e `BE-017` permanecem parciais. Nenhum estado `APPROVED` ou `READY` foi atribuído.
