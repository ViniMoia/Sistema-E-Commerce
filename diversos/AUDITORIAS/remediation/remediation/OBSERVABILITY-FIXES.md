# Etapa 11 — Observabilidade e tratamento de falhas

Data da revisão: 2026-09-28  
Escopo: `OBS-001` a `OBS-014` e correlatos de transações  
Estado global: correções locais concluídas; integrações e operação externa permanecem sem verificação

## Resultado executivo

Os 14 achados foram novamente comparados com o código atual. Os problemas transacionais críticos já estavam resolvidos pelas etapas anteriores e foram retestados; as lacunas confirmadas de correlação, sanitização, sinalização de falha parcial, timeout de e-mail, health e métricas receberam correções locais. Nenhum serviço real, conta externa, produção ou configuração remota foi acessado.

Este documento não declara o sistema `READY` ou `APPROVED`. Coleta distribuída, alertas, entrega de e-mail, reentrega do gateway, agendadores, retenção de logs e encerramento gracioso precisam ser validados em ambiente autorizado.

## Classificação dos achados

| ID | Severidade original | Confiança do relatório | Verificação no estado atual | Estado desta etapa | Risco residual |
|---|---|---|---|---|---|
| `OBS-001` | CRITICAL | HIGH | O inbox de webhook já persiste `PROCESSING/PROCESSED/FAILED`, tentativas e lease; uma falha não consome definitivamente o evento. | `ALREADY RESOLVED` | MEDIUM: reentrega real do Asaas não foi exercitada. |
| `OBS-002` | HIGH | HIGH | Falha na restauração de estoque volta a abortar a transação. | `ALREADY RESOLVED` | LOW. |
| `OBS-003` | HIGH | HIGH | Ambiguidade após chamada ao gateway gera `RECONCILIATION_REQUIRED`, sem repetir cegamente a cobrança. | `ALREADY RESOLVED` | HIGH: worker/sandbox de reconciliação são externos e estão `DEFERRED`. |
| `OBS-004` | HIGH | HIGH | Havia chaves sensíveis e erros de provedor chegando a logs. | `FIXED` no repositório | MEDIUM: retenção/RBAC/expurgo do backend de logs não verificados. |
| `OBS-005` | HIGH | HIGH | Refund e expiração já verificam retorno sem sucesso e preservam falha. | `ALREADY RESOLVED` | LOW. |
| `OBS-006` | MEDIUM | HIGH | E-mail podia ser disparado sem aguardar e o provedor não tinha limite de tempo. | `FIXED` parcial | MEDIUM: outbox, bounce e confirmação de entrega estão `DEFERRED`. |
| `OBS-007` | MEDIUM | HIGH | Crons respondiam sucesso mesmo com itens falhos. | `FIXED` no repositório | MEDIUM: retry/heartbeat do agendador requer infraestrutura. |
| `OBS-008` | MEDIUM | HIGH | Correlação era parcial, aceitava valor arbitrário e não era devolvida. | `FIXED` no repositório | LOW em processo único; propagação entre serviços externos não verificada. |
| `OBS-009` | MEDIUM | HIGH | Não havia endpoints de liveness/readiness nem métricas operacionais. | `FIXED` parcial | MEDIUM: métricas são locais ao processo; collector/dashboard/alertas requerem infraestrutura. |
| `OBS-010` | MEDIUM | MEDIUM | Alguns provedores tinham timeout, mas o Resend não tinha. | `FIXED` parcial | MEDIUM: deadline ponta a ponta/circuit breaker continuam `DEFERRED`; POST financeiro não recebeu retry. |
| `OBS-011` | MEDIUM | HIGH | O hook do Prisma não desconectava a instância de produção. | `FIXED` parcial | MEDIUM: sinais, drain do proxy e comportamento da plataforma são `NOT VERIFIED`. |
| `OBS-012` | MEDIUM | HIGH | Rotas auditadas devolviam detalhes internos em respostas 500. | `FIXED` no escopo auditado | LOW/MEDIUM: novas rotas devem manter o contrato genérico. |
| `OBS-013` | MEDIUM | HIGH | O webhook armazenava payload bruto e não havia política operacional. | `FIXED` parcial | MEDIUM: limpeza dos registros antigos, retenção e RBAC estão pendentes. |
| `OBS-014` | LOW | HIGH | Faltavam provas negativas de falha parcial e indisponibilidade. | `FIXED` para regressões locais | MEDIUM: kill/restart, scheduler e provedores reais continuam `NOT VERIFIED`. |

`NOT VERIFIED` nunca foi convertido em defeito confirmado: ele identifica exatamente os comportamentos que dependem de ambiente ou provedor externo.

## Grupos por causa raiz e evidências

### 1. Durabilidade e ambiguidade financeira

IDs: `OBS-001`, `OBS-002`, `OBS-003`, `OBS-005`; correlatos de transações.

- Antes das etapas transacionais, o relatório descrevia evento consumido antes dos efeitos, restauração silenciosa e resultado financeiro ambíguo tratado como definitivo.
- No estado atual, o inbox do webhook mantém estado, tentativas, lease e erro sanitizado; o processamento só conclui depois dos efeitos. O checkout mantém estado explícito de reconciliação e não repete automaticamente uma criação de cobrança não idempotente.
- Os testes de inbox, última unidade, rollback, transição e idempotência passaram novamente. A reconciliação externa continua deliberadamente pendente.

### 2. Contexto de requisição, correlação e logs seguros

IDs: `OBS-004`, `OBS-008`, `OBS-012`, `OBS-013`.

- Foi criado contexto por `AsyncLocalStorage` com UUID interno. Um `X-Request-ID` recebido só é preservado como identificador externo se obedecer a formato e tamanho seguros; ele nunca substitui o ID interno.
- `X-Request-ID` é devolvido no checkout e webhook, inclusive em erro. O logger incorpora automaticamente request, correlação, tenant, pedido, pagamento e evento quando disponíveis.
- A sanitização passou a remover credenciais em URL, cookies, tokens, senha, documentos, telefone, e-mail e corpos/conteúdo livres. Respostas 500 das rotas auditadas foram reduzidas a mensagens públicas genéricas.
- O novo inbox não persiste o payload bruto: conserva apenas o envelope mínimo necessário para idempotência e processamento. A remoção de payloads antigos exige operação de dados separada.

### 3. E-mail, crons e falha parcial

IDs: `OBS-006`, `OBS-007`, `OBS-010`.

- O provedor Resend usa timeout configurável por `AbortSignal.timeout` e retorna código genérico; não há retry automático.
- O webhook aguarda o envio limitado e verifica `EmailResult.success`; uma falha de e-mail é observável sem desfazer o pagamento já persistido.
- Os crons de expiração e pedidos vencidos criam `runId`, contabilizam resultados e respondem `503` com estado `PARTIAL` ou `FAILED` quando a execução não termina integralmente. Nenhum detalhe pessoal é devolvido.

### 4. Health, métricas e ciclo de vida

IDs: `OBS-009`, `OBS-011`, `OBS-014`.

- `/api/health/live` prova somente que o processo responde; `/api/health/ready` faz verificação limitada e temporizada do banco.
- `/api/internal/metrics` exige token próprio e exporta apenas métricas/labels de allowlist, sem IDs de usuário, pedido ou pagamento. O armazenamento é local ao processo, portanto não é apresentado como telemetria distribuída.
- O Prisma desconecta a instância realmente utilizada no evento de encerramento suportado. Sinais de sistema e drenagem de tráfego precisam ser confirmados no runtime de implantação.
- `ops/observability/alerts.example.yml` é configuração revisável, não prova de alertas ativos.

## Rastreio fictício demonstrado

O caminho coberto pelos testes usa somente identificadores fictícios e payload inofensivo:

1. O checkout cria um `requestId` interno e devolve `X-Request-ID`.
2. Após o commit local, `CHECKOUT_LOCAL_TRANSACTION_COMMITTED` registra apenas tenant, pedido, pagamento e quantidade de itens; os logs subsequentes herdam o contexto.
3. O webhook recebe um novo `requestId`, correlaciona `eventId`, `orderId`, `paymentId` e referência externa validada, e grava o inbox mínimo.
4. `PAYMENT_EFFECTS_COMMITTED` marca a transação que confirma o pedido e credita pontos. No cancelamento, `ORDER_CANCELLATION_EFFECTS_COMMITTED` cobre restauração de estoque e reversão de pontos.
5. `ASAAS_WEBHOOK_PROCESSED` conclui o evento. Métricas usam apenas rótulos de baixa cardinalidade, como resultado e tipo de operação.

A propagação foi provada por testes do contexto/logger e pelos testes comportamentais de checkout/webhook; não foi fabricado um trace distribuído nem foi chamado o Asaas.

## Testes e comandos executados

| Comando/escopo | Resultado |
|---|---|
| Regressão inicial de webhook/inventário/transações | 3 arquivos unitários, 30 testes aprovados; integração inicialmente não iniciou por ausência de `DATABASE_URL`. |
| Testes negativos antes da correção | Falharam como esperado por módulo de contexto/health ausente, falta de `X-Request-ID`, detalhe interno no webhook, cron parcial respondendo 200 e Resend sem timeout. |
| Suítes focadas após cada grupo | Passagens sucessivas de 57/57, 59/59 e 72/72; typecheck aprovado. |
| `npm.cmd run test:unit` | 75 arquivos, 504/504, exit 0. |
| Migrações em PostgreSQL 16 descartável | As 24 migrações foram aplicadas após informar `DATABASE_URL` e `DIRECT_URL` locais fictícias. |
| `npm.cmd run test:integration:core` | 5 arquivos, 14/14, exit 0. |
| `status-transitions.test.ts` isolado | 15 casos não executaram o comportamento: receberam 404 por depender de servidor HTTP externo em `localhost:3000`; registrado como limitação, não como sucesso nem regressão do produto. |
| `npm.cmd run lint` | Exit 0, zero erros e 16 warnings já conhecidos. |
| `npm.cmd run build` | Next.js 16.3.5, compilação/tipos/51 páginas, exit 0. |
| HTTP local do build em porta 3011 | live 200, ready 200, métricas sem token 401 e métricas com token fictício 200. Servidor encerrado. |

## Arquivos alterados nesta etapa

- `.env.example`
- `lib/observability/request-context.ts`, `lib/observability/metrics.ts`, `lib/logger.ts`, `lib/prisma.ts`
- `app/api/health/live/route.ts`, `app/api/health/ready/route.ts`, `app/api/internal/metrics/route.ts`
- `app/api/checkout/route.ts`, `app/api/webhooks/asaas/route.ts`
- `app/api/cron/orders-timeout/route.ts`, `app/api/cron/loyalty-expiration/route.ts`
- `lib/email/providers/resend.provider.ts`, `services/checkout.service.ts`, `services/order.service.ts`
- rotas auditadas de upload, frete, fidelidade e administração com respostas/logs sanitizados
- `ops/observability/alerts.example.yml`
- testes de logger, health/métricas, checkout, webhook, crons, e-mail, segurança e storage

Não houve commit nesta etapa.

## Verificações externas pendentes

| Serviço/componente real | Verificação posterior exigida | Responsável externo sugerido |
|---|---|---|
| Asaas | assinatura, reentrega, eventos fora de ordem, reconciliação e ambiguidade em sandbox autorizada | Pagamentos/Operações |
| Resend/DNS de e-mail | entrega, bounce, suppression, timeout e política de idempotência | Plataforma/Marketing |
| Scheduler da hospedagem | retry de 503, exclusão mútua, heartbeat e alerta de execução ausente | SRE/Plataforma |
| Collector e backend de logs/métricas | scraping autenticado, TLS, retenção, RBAC, cardinalidade e expurgo | SRE/Segurança |
| Alertmanager/dashboard/on-call | carregar e calibrar regras, rotas e runbooks | SRE/Operações |
| Runtime/proxy/orquestrador | SIGTERM, readiness durante drain, prazo de encerramento e restart | Plataforma |
| Banco gerenciado | pool, timeout, failover e credencial de readiness com privilégio mínimo | DBA/Plataforma |
| Retenção do inbox | limpeza de payloads históricos, prazo, auditoria e acesso somente necessário | DBA/Segurança |

## Limitações e risco residual

- Métricas locais são perdidas no restart e não agregam réplicas.
- Não foi adicionado retry a chamadas financeiras não idempotentes.
- A confirmação de pagamento pode exigir reconciliação externa; o estado local evita afirmar sucesso, mas não substitui o worker operacional.
- E-mail continua sem outbox durável e confirmação de entrega.
- O teste HTTP legado de transições precisa de fixture de servidor explícita antes de poder servir como gate.
- Nenhum segredo foi exibido ou rotacionado. Nenhuma produção, cloud, gateway, e-mail ou conta real foi acessada.

Critério de encerramento local desta etapa: regressões unitárias e de integração centrais aprovadas, build aprovado, health/métricas exercitados por HTTP local e cada dependência externa explicitamente mantida como pendente. Esse critério foi atingido apenas no repositório.
