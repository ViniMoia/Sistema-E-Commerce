# Handoff — reconciliador durável de pagamentos ambíguos

Data: 2026-09-29  
Escopo: `FINAL-008`, `ARCH-007`, `BE-007`, `CTR-004`, `CTR-007`, `CTR-011`, `CTR-012`, `SEC-012`, `OBS-003`, `OBS-010`  
Publication Status: **não alterado**; a revalidação final continua responsável por essa decisão.

## Resultado

O estado observado em 28/09/2026 mudou no repositório: além da contenção `RECONCILIATION_REQUIRED`, agora existe uma referência financeira persistida antes do POST, uma fila relacional, um worker com claim/lease, tentativas limitadas e backoff, consulta do Asaas por `externalReference`, convergência com webhook e métricas persistentes de backlog/idade.

A implementação local passou por adapter fake e pela suíte unitária completa. A migration e a suíte PostgreSQL foram preparadas, porém **não foram executadas**: esta sessão não recebeu `DATABASE_URL`/`TEST_DATABASE_URL`, e nenhum serviço PostgreSQL local estava disponível. A sandbox Asaas também está **NOT VERIFIED** porque `ASAAS_API_KEY`/`ASAAS_API_URL` não estavam configuradas. O scheduler foi documentado, mas sua instalação na plataforma é **pendente**.

## Matriz ID → antes → alteração → prova depois → residual

| ID | Evidência antes | Alteração | Prova depois | Estado e residual |
|---|---|---|---|---|
| `FINAL-008` | Existia contenção do retry, mas nenhum worker durável nem lookup quando `asaasPaymentId` não havia sido salvo. | Operação persistida por `paymentReference`, fila/lease/backoff/dead-letter, lookup somente leitura, FSM e trigger v1. | Regressões do worker, adapter e webhook; suíte unitária 588/588; build inclui `/api/cron/payment-reconciliation/v1`. | `PARTIALLY FIXED`: local/fake verificado; PostgreSQL, sandbox e agenda externa `NOT VERIFIED`. |
| `ARCH-007` | Pedido persistia antes do gateway e podia ficar indefinidamente em estado incerto. | A mesma transação inicial cria `PaymentReconciliation`; lock abandonado é retomável e falha/idade ficam persistidas. | Testes de restart, duas instâncias e falha após efeitos. | `FIXED VERIFIED` no modelo/fake; migration aplicada e operação multi-réplica externa `NOT VERIFIED`. |
| `BE-007` | Fingerprint/chave impediam retry, mas não fechavam a descoberta do efeito remoto. | Referência financeira única é criada antes do POST e reutilizada para descoberta; o worker nunca chama criação de cobrança. | Teste de timeout/ausência afirma zero chamadas aos três métodos de criação. | `FIXED VERIFIED` local; idempotência/consistência efetiva do Asaas `NOT VERIFIED`. |
| `CTR-004` | Timeout após resposta podia deixar cobrança sem vínculo local e sem rotina de recuperação. | Resultado ambíguo agenda reconciliação; busca por referência liga a cobrança e aplica efeitos por CAS. | Teste existente de resposta externa + falha de persistência e teste de recuperação até `CONFIRMED`. | `FIXED VERIFIED` com fake; corte de conexão e persistência no sandbox/PostgreSQL `NOT VERIFIED`. |
| `CTR-007` | Checkout já tinha chave/fingerprint; a referência enviada ao provedor ainda era acoplada ao ID do pedido. | `paymentReference` único e estável passa a ser o `externalReference` do Asaas. | Adapter confirma payload e endpoint de busca com referência codificada. | `ALREADY RESOLVED` na idempotência local, com reforço; sandbox do provedor `NOT VERIFIED`. |
| `CTR-011` | Gate de configuração já falhava fechado para métodos automáticos. | Revalidado; fila só é criada para tentativa automática real, nunca para `WHATSAPP_PIX`. | Suíte completa permaneceu verde. | `ALREADY RESOLVED`; credencial revogada continua detectável apenas em ambiente autorizado. |
| `CTR-012` | Timeout consultava somente cobranças cujo ID local já existia. | Reconciliação também descobre por referência, classifica pendente/confirmado/encerrado/estornado e não cria cobrança em ausência/indisponibilidade. | Matriz unitária de status, retry e dead-letter. | `FIXED VERIFIED` local; semântica real dos status Asaas `NOT VERIFIED`. |
| `SEC-012` | Chave/fingerprint existiam, mas faltava constraint/referência financeira recuperável. | Constraints únicas em pedido/fila, vínculo 1:1, claim CAS e trigger protegido por `CRON_SECRET`. | Typecheck, schema válido, testes de auth do cron e concorrência fake. | `FIXED VERIFIED` no repositório; migration e scheduler externos `NOT VERIFIED`. |
| `OBS-003` | Ambiguidade era registrada, mas não drenada nem alertada por idade. | Tentativas/erro/idade/estado terminal persistentes, gauges de backlog/SLA e alertas de manual/dead-letter/heartbeat. | Testes de retry/dead-letter e endpoint de métricas; lint/build verdes. | `FIXED VERIFIED` local; collector/alert manager/scheduler `NOT VERIFIED`. |
| `OBS-010` | POST financeiro não tinha retry automático, corretamente evitando duplicação, mas faltava recuperação segura. | O POST continua sem retry cego; o worker repete apenas GET por referência com backoff limitado. | Timeout do fake agenda retry e não invoca create PIX/cartão/boleto. | `ALREADY RESOLVED` para timeout/sem retry cego, com recuperação local; circuit breaker externo `DEFERRED`. |

## Máquina de reconciliação

Estados persistidos:

- `PENDING` → item criado junto com o pedido antes do gateway;
- `PROCESSING` → claim por compare-and-set, com `lockedAt` e `leaseOwner`;
- `RETRY_SCHEDULED` → indisponibilidade ou cobrança ainda não encontrada, com backoff exponencial limitado;
- `RESOLVED` → cobrança vinculada e estado local convergido;
- `MANUAL_REVIEW` → duplicidade, identidade/valor/método divergente, pagamento após cancelamento, estorno após fulfillment ou status financeiro não automatizável;
- `DEAD_LETTER` → tentativas esgotadas, preservando primeira detecção, tentativas, último erro e idade.

Tratamento de respostas:

| Resposta do gateway | Decisão local |
|---|---|
| nenhuma cobrança | retry limitado; depois dead-letter; nunca criar nova cobrança |
| uma cobrança pendente/análise | persistir ID, `AWAITING_PAYMENT`, resolver ambiguidade |
| confirmada/recebida | `PENDING → PAID` por CAS; pontos uma vez; estado financeiro `CONFIRMED` |
| estornada | `PENDING/PAID → CANCELLED` com confirmação financeira; estoque/pontos uma vez; fulfillment avançado vai para revisão |
| expirada/excluída | cancelar apenas pedido pendente; estado incompatível vai para revisão |
| mais de uma por referência | `MANUAL_REVIEW`, sem escolher cobrança arbitrariamente |
| indisponibilidade/timeout | retry de consulta com backoff; nenhum POST |

Webhook e worker podem competir: ambos aceitam como convergência uma transição já concluída. `updateOrderStatus` mantém o CAS e os efeitos de estoque/pontos na transação local. Se o processo cai depois desses efeitos e antes de fechar a fila, a próxima tentativa relê `PAID`/`CANCELLED` e finaliza sem reaplicar efeitos.

## Contrato Asaas e sandbox

A implementação segue a orientação oficial de manter uma referência estável antes da primeira tentativa e, diante de falha de comunicação, verificar o efeito anterior antes de repetir. O adapter usa `GET /v3/payments?externalReference=...` e não tenta recriar a cobrança durante reconciliação:

- https://docs.asaas.com/docs/retries-e-idempot%C3%AAncia
- https://docs.asaas.com/reference/list-payments
- https://docs.asaas.com/reference/create-new-payment
- https://docs.asaas.com/docs/what-can-be-tested

Nenhuma chamada de sandbox foi feita. Logo, permanecem `NOT VERIFIED`: aceitação do identificador na conta do projeto, consistência temporal da listagem, status reais, reentrega real de webhook e prova externa de ausência de duplicidade.

## Persistência e operação

- Migration: `20260929081500_durable_payment_reconciliation`.
- Trigger: `GET|POST /api/cron/payment-reconciliation/v1`, protegido por autenticação timing-safe compartilhada.
- Contrato provider-neutral: `ops/scheduler/jobs.example.yml`, a cada minuto, concorrência permitida porque o lease arbitra workers.
- Métricas sem IDs/PII: `payment_reconciliation_attempts_total`, `payment_reconciliation_backlog`, `payment_reconciliation_over_sla`, `payment_reconciliation_oldest_age_seconds`.
- Alertas de exemplo: item acima do SLA, manual/dead-letter e heartbeat ausente.

O arquivo de scheduler é somente contrato. Não agenda nada por si só; ativação, segredo, timeout, retry e alertas na plataforma continuam pendentes de autorização/operação.

## Evidência antes/depois

Antes da alteração:

- baseline focado existente: 6 arquivos, 54/54 casos passaram, comprovando apenas a contenção;
- regressão nova: `payment-reconciliation.test.ts` falhou antes de coletar testes porque `services/payment-reconciliation.service.ts` não existia.

Depois da alteração:

- foco financeiro final: 10 arquivos, 81/81 casos;
- unitários completos: 86 arquivos, 588/588 casos;
- `tsc --noEmit`: exit 0;
- `prisma validate` com DSN sintática local fictícia: schema válido; `prisma format --check`: verde;
- lint: exit 0, 0 erros e 15 warnings preexistentes;
- build Next 16.3.5: exit 0, 51 páginas, incluindo o trigger v1;
- scanner de segredos: exit 0;
- contrato de ambiente: exit 0.

Tentativa PostgreSQL:

```text
NODE_ENV=test npx vitest run tests/integration/payment-reconciliation-postgres.test.ts
→ FAIL antes dos casos: [TEST_DATABASE_BLOCKED]
→ 5 casos não executados
```

O guard exigiu `DATABASE_URL === TEST_DATABASE_URL`, PostgreSQL local, banco `ecommerce_test`, schema `public`. Nenhuma variável foi fornecida e nenhum banco foi criado ou limpo. A suíte pronta usa IDs por execução e cleanup limitado ao próprio tenant/fixtures; cobre duas instâncias, restart, webhook simultâneo, fora de ordem e estoque/pontos uma vez.

## Arquivos alterados nesta etapa

- persistência: `prisma/schema.prisma`, migration `20260929081500_durable_payment_reconciliation`;
- domínio/gateway: `types/payment-gateway.types.ts`, `types/asaas.types.ts`, `services/asaas/asaas.client.ts`, `services/asaas/asaas.adapter.ts`;
- checkout/worker/webhook: `services/checkout.service.ts`, `services/payment-reconciliation.service.ts`, `app/api/webhooks/asaas/route.ts`;
- acionamento/observabilidade: `app/api/cron/payment-reconciliation/v1/route.ts`, `lib/observability/metrics.ts`, `lib/observability/payment-reconciliation-metrics.ts`, `app/api/internal/metrics/route.ts`, `ops/scheduler/jobs.example.yml`, `ops/observability/alerts.example.yml`, `.env.example`;
- regressões: testes do adapter, checkout, webhook, métricas, cron, worker e `tests/integration/payment-reconciliation-postgres.test.ts`;
- documentação: este handoff e uma entrada append-only em `docs/remediation/PROGRESS.md`.

## Risco residual e encerramento

Risco residual global: **HIGH** enquanto não houver:

1. migration aplicada e suíte concorrente verde em PostgreSQL local descartável;
2. criação/consulta/reentrega exercitadas na sandbox Asaas autorizada, provando uma cobrança por referência;
3. scheduler v1, collector e alertas instalados e observados na plataforma;
4. procedimento operacional para `MANUAL_REVIEW`/`DEAD_LETTER`;
5. trabalho separado de refund iniciado pela aplicação, parcial e logística reversa (`FINAL-009`), que não foi ampliado neste escopo.

Por isso `FINAL-008` não é promovido para `FIXED VERIFIED` global nem para READY.
