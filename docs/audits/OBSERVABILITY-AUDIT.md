# Auditoria de Observabilidade e Tratamento de Falhas — Etapa 12/15

**Relatório:** `docs/audits/OBSERVABILITY-AUDIT.md`  
**Data:** 2026-09-26  
**Revisão analisada:** `0c7ef7d`  
**Escopo:** logs, métricas, traces, IDs de requisição/correlação, alertas, health checks, retries, timeouts, circuit breakers, graceful shutdown e tratamento de falhas em checkout, pagamento, webhook, estoque, pedido, reembolso e fidelidade  
**Fora do escopo:** alteração de código, acesso a produção, banco real, painéis de observabilidade, serviços externos e execução de falhas contra ambientes compartilhados

## Executive Summary

O repositório possui um logger JSON com timestamp, níveis, contexto e mascaramento por nome de campo. Checkout e integração Asaas também registram `orderId`, número do pedido, identificador do pagamento e duração em pontos importantes; mudanças de pedido e pontos usam transações e trilhas persistidas. Esses controles são úteis, mas não formam uma cadeia observável ponta a ponta.

O principal bloqueio confirmado está no webhook de pagamento. O evento é inserido em `PaymentWebhookEvent` — com `processedAt` preenchido imediatamente — antes de localizar e atualizar o pedido. Qualquer falha posterior deixa o evento existente; a reentrega retorna `ALREADY_PROCESSED` sem repetir os efeitos. O mesmo ocorre quando o pedido não é encontrado. Portanto, o sistema pode reconhecer definitivamente um webhook cujo pagamento, estoque e pontos não foram processados.

Também foram confirmados: estorno de estoque que engole falhas e permite concluir cancelamento parcial; tratamento de timeout do gateway como falha definitiva, embora a cobrança remota possa ter sido criada; retorno de sucesso em reembolsos cujas transições falharam; logs com e-mail completo, corpo transacional e token de reset; e-mail fire-and-forget registrado como sucesso mesmo quando o provider retorna falha; jobs que retornam HTTP 200 ou `success: true` diante de falha parcial; correlação restrita a poucos pontos; ausência de métricas, traces, alertas e health endpoints versionados; e encerramento do Prisma que não desconecta o client de produção.

**É possível investigar uma falha comercial sem consultar dados pessoais ou produção?** Apenas parcialmente. Sucessos de checkout/webhook podem ser ligados por `orderId` e identificador do pagamento, mas erros iniciais não devolvem o correlation ID ao cliente, o contexto não chega aos serviços, transições administrativas vivem principalmente em `AuditLog`, e o registro de webhook contém payload bruto. Falhas de estoque, e-mail e cron não possuem estado operacional durável suficiente. Para vários incidentes, seria necessário consultar banco/logs reais com PII, o que não atende ao requisito de investigação segura e minimizada.

### Resumo por severidade

| Severidade | Quantidade |
|---|---:|
| BLOCKER | 0 |
| CRITICAL | 1 |
| HIGH | 4 |
| MEDIUM | 8 |
| LOW | 1 |
| INFORMATIONAL | 0 |
| **Total** | **14** |

### Publication Blockers

1. **OBS-001 (CRITICAL):** webhooks são considerados processados antes dos efeitos e não podem ser retomados após falha.

Embora não classificados como `BLOCKER`, recomenda-se reter publicação até corrigir `OBS-002`, `OBS-003`, `OBS-004` e `OBS-005`, pois podem ocultar divergência financeira, de estoque, pontos ou reembolso.

## 1. Metodologia

1. Leitura de `AGENTS.md`, documentação técnica, scripts, workflow, schema Prisma e configurações relevantes.
2. Inventário mecânico de `logger.*`, `console.*`, IDs de requisição/correlação, `fetch`, `AbortController`, timeouts, retries, circuit breakers, handlers de sinal, health endpoints e dependências de telemetria.
3. Rastreamento manual dos fluxos navegador → checkout → transação → gateway → webhook → pedido → estoque → pontos → e-mail.
4. Inspeção dos fluxos de cancelamento, reembolso, pagamento tardio e expiração por cron, distinguindo erro lançado, erro convertido em retorno, erro engolido e resposta HTTP.
5. Comparação dos dados emitidos nos logs com a função de sanitização e com os campos persistidos em `AuditLog`, ledger e `PaymentWebhookEvent`.
6. Leitura dos testes de logger, webhook, estoque, cron e e-mail para identificar quais comportamentos negativos são realmente protegidos.
7. Tentativa local de executar os testes unitários, sem instalar dependências e sem acessar rede ou serviços.

Nenhum endpoint, banco, provider ou painel externo foi consultado. Nenhum valor de segredo ou dado pessoal real foi exibido.

### Critério de classificação

- **CONFIRMED:** comportamento demonstrável diretamente pelo caminho do código ou comando local.
- **HIGH CONFIDENCE:** manifestação depende de timing/estado externo, mas o tratamento correspondente está demonstrado no código.
- **SUSPECTED:** hipótese plausível sem evidência suficiente para afirmar manifestação.
- **NOT VERIFIED:** depende exclusivamente de configuração ou dado externo não consultado.

Ausência de teste foi tratada como lacuna de regressão, não como prova autônoma de defeito.

## 2. Arquitetura observável encontrada

### 2.1 Fluxo de checkout e pagamento

```text
Browser
  -> POST /api/checkout
     -> correlationId recebido do cliente ou UUID local
     -> createOrder (correlationId não é propagado)
        -> transação: pedido + estoque + pontos resgatados
        -> AsaasClient (timeout de 8 s)
           -> criação de cliente/cobrança
        -> persistência do paymentId no pedido
     -> log de sucesso/erro no controller
     -> resposta sem correlationId
```

O adapter Asaas registra `orderId`, `orderNumber`, `asaasPaymentId`, duração e status. Contudo, não recebe o `correlationId` criado na borda HTTP. Se o provider processar a requisição e a resposta expirar, o checkout cancela o pedido e restaura estoque, sem estado `UNKNOWN` nem reconciliação automática.

### 2.2 Fluxo de webhook

```text
Asaas
  -> valida token
  -> deriva eventId
  -> consulta PaymentWebhookEvent
  -> INSERE evento com processedAt=agora
  -> localiza pedido
  -> grava metadados de pagamento
  -> transiciona pedido / estoque / pontos
  -> dispara e-mail sem aguardar o ciclo da requisição
  -> loga sucesso com correlationId=eventId
  -> HTTP 200
```

O ponto de inserção precede todos os efeitos. `PaymentWebhookEvent` não tem estado `RECEIVED/PROCESSING/PROCESSED/FAILED`, número de tentativas, erro, `orderId` ou lease. A existência do registro é usada como sinônimo de conclusão.

### 2.3 Cancelamento, estoque e fidelidade

- `updateOrderStatus` usa transação para status, `AuditLog`, estoque e ledger.
- `InventoryService.restoreStock` captura erros por item e não os relança; a transação pode continuar e confirmar `CANCELLED`.
- O cron de pedidos agrega sucesso/erro por pedido, mas a rota sempre responde HTTP 200 quando o serviço retorna um resumo.
- O cron de pontos captura erros por carteira, mas a rota sempre responde `success: true` e loga “concluída com sucesso”, apenas incluindo `errorCount`.
- O ledger de fidelidade fornece trilha persistida, porém não há métrica, alerta ou correlação global ligando-o ao request/webhook.

## 3. Cobertura dos sinais

| Área | Logs | Métricas | Traces | Correlação | Estado durável de falha | Alertas/health |
|---|---|---|---|---|---|---|
| Checkout | Estruturados na rota e gateway | Não encontrado | Não encontrado | Apenas controller | Pedido/audit parcial | Não encontrado |
| Cobrança Asaas | Sucesso/erro e duração | Não encontrado | Não encontrado | `orderId`, sem request ID | Pedido após resposta | Não encontrado |
| Webhook | Estruturado no sucesso/erro | Não encontrado | Não encontrado | `eventId` somente no log final | Evento sem status de processamento | Não encontrado |
| Estoque | Falha de restore em `console.warn` | Não encontrado | Não encontrado | IDs locais | `StockSyncLog` declarado, sem uso encontrado | Não encontrado |
| Pedido | Alguns logs; `AuditLog` no banco | Não encontrado | Não encontrado | `orderId`, sem request ID | `AuditLog` | Não encontrado |
| Reembolso | Log final genérico do webhook | Não encontrado | Não encontrado | `eventId` no sucesso | Evento sem resultado | Não encontrado |
| Pontos/cashback | Resumo do cron e ledger | Não encontrado | Não encontrado | Sem run ID | `LoyaltyTransaction` | Não encontrado |
| E-mail | Logs mistos e resultado em memória/provider | Não encontrado | Não encontrado | `orderId` em parte do fluxo | Nenhuma outbox | Não encontrado |

### 3.1 Inventário quantitativo local

Em 109 arquivos TypeScript/TSX rastreados sob `app`, `lib` e `services`, a varredura encontrou:

| Sinal | Quantidade |
|---|---:|
| Chamadas diretas a `console.*` | 53 em 36 arquivos |
| Chamadas ao logger estruturado | 41 em 12 arquivos |
| Uso de `logger.withContext(...)` | 0 |
| Pontos explícitos de `x-request-id`/`x-correlation-id` | checkout |
| Correlação explícita adicional | `eventId` no log final do webhook |

Essas contagens são inventário mecânico, não avaliação isolada de qualidade.

## 4. Verificações locais e resultados reproduzíveis

### 4.1 Inventário de logging e correlação

```powershell
rg -n --glob '*.ts' --glob '*.tsx' `
  'logger\.(info|warn|error|debug)|console\.(log|warn|error|debug)' `
  app lib services

rg -n --glob '*.ts' --glob '*.tsx' `
  'correlationId|requestId|x-request-id|x-correlation-id|traceparent' `
  app lib services
```

Resultado: logger estruturado coexistindo com `console.*`; correlação gerada no checkout e `eventId` usado no final do webhook, sem propagação global.

### 4.2 Resiliência e lifecycle

```powershell
rg -n --glob '*.ts' `
  'AbortController|timeout|retry|backoff|circuit|SIGTERM|SIGINT|beforeExit|disconnect' `
  app lib services
```

Resultado: timeout explícito no Asaas (8 s) e Correios (3,5 s); Resend sem timeout; nenhuma implementação de circuit breaker ou retry/backoff de integração; apenas `beforeExit` para Prisma; nenhum handler `SIGTERM`/`SIGINT`.

### 4.3 Health, métricas, traces e alertas

```powershell
rg --files app | rg 'health|readiness|liveness|metrics'
rg --files | rg 'instrumentation\.(ts|js)|sentry|otel|opentelemetry|prometheus'
rg -n -i 'alertmanager|pagerduty|opsgenie|SLO|SLI' .github app lib services package.json
```

Resultado: nenhuma rota operacional de health/metrics, nenhum arquivo de instrumentação e nenhum alerta versionado. O lockfile contém referências transitivas a `@opentelemetry/api`, mas não existe dependência/configuração direta observada.

### 4.4 Testes

```powershell
npm test
```

Resultado: exit 1 antes da coleta porque `vitest` não está instalado; `node_modules` está ausente. Os testes foram lidos, mas não executados. Não foi feito `npm ci` nem acesso ao registry.

## 5. Findings

### OBS-001 — Webhook é marcado como processado antes dos efeitos e reentregas são descartadas

- **Severidade:** CRITICAL
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `app/api/webhooks/asaas/route.ts:133-169`, `171-207`, `209-349`; `prisma/schema.prisma:552-562`
- **Fluxo e condição de manifestação:** um evento novo é inserido; depois disso, pedido não é encontrado, uma atualização de banco lança erro ou a transição de status falha; o Asaas reentrega o mesmo `eventId`.
- **Evidência observada (fato):** o registro é criado antes de localizar o pedido e antes dos efeitos. `processedAt` recebe default no insert. Qualquer registro existente retorna imediatamente `ALREADY_PROCESSED`. O modelo não diferencia recebimento, processamento, sucesso ou falha. Quando o pedido não é encontrado, a rota retorna 200 e conserva o evento terminal.
- **Hipótese separada:** a frequência real de reentregas/falhas depende do provider e do banco; não foi testada externamente.
- **Impacto:** pagamento confirmado pode permanecer `PENDING`; reembolso pode não cancelar/restaurar estoque/pontos; a resposta 200 impede recuperação automática e cria divergência financeira silenciosa.
- **Correção proposta:** modelar estados `RECEIVED/PROCESSING/PROCESSED/FAILED`, tentativas, erro sanitizado, `orderId`, timestamps e lease; adquirir processamento de forma atômica; marcar sucesso somente após todos os efeitos; permitir retry de `FAILED`/lease expirado; criar reconciliação por status do gateway. Não confiar apenas na existência do evento.
- **Teste de regressão:** injetar falha após o insert e antes/depois de cada efeito; reentregar o mesmo evento e comprovar conclusão única, retomável e sem duplicar estoque/pontos; cobrir pedido inicialmente ausente que aparece depois.
- **Risco residual:** eventos fora de ordem e indisponibilidade prolongada exigem política de replay e reconciliação periódica com o gateway.

### OBS-002 — Falhas de estorno de estoque são engolidas e cancelamento pode ser confirmado parcialmente

- **Severidade:** HIGH
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `services/inventory.service.ts:88-129`; `services/order.service.ts:359-413`
- **Fluxo e condição de manifestação:** cancelamento de pedido `PENDING`/`PAID`; incremento do produto ou variante falha.
- **Evidência observada (fato):** `restoreStock` captura cada exceção, emite `console.warn` e continua. `updateOrderStatus` chama o método dentro da transação, depois grava audit/estorno de pontos e retorna sucesso. O contrato `Promise<void>` não informa itens não restaurados.
- **Hipótese separada:** a taxa real de falha depende de drift/exclusão/indisponibilidade do banco, não verificada nesta etapa.
- **Impacto:** pedido fica `CANCELLED` e pontos podem ser estornados enquanto estoque pai ou variante permanece incorreto; o único sinal é log não estruturado sem correlation ID ou alerta.
- **Correção proposta:** falhar a transação para erros não recuperáveis ou retornar resultado tipado que impeça sucesso; persistir tentativa de compensação/outbox com estado e itens; alertar divergência; oferecer reconciliação idempotente.
- **Teste de regressão:** forçar falha no segundo incremento e comprovar rollback integral ou estado `COMPENSATION_PENDING`; verificar que nenhuma resposta/log declara cancelamento concluído até a reconciliação.
- **Risco residual:** reconciliação precisa distinguir estoque já restaurado de item ainda pendente para não incrementar em duplicidade.

### OBS-003 — Timeout do gateway é tratado como falha definitiva sem estado incerto ou reconciliação

- **Severidade:** HIGH
- **Confiança:** HIGH CONFIDENCE
- **Arquivo e linhas:** `services/asaas/asaas.client.ts:53-68`, `157-176`; `services/checkout.service.ts:480-501`, `522-665`; `app/api/webhooks/asaas/route.ts:248-280`
- **Fluxo e condição de manifestação:** o POST de cobrança é aceito pelo gateway, mas a resposta local expira/é perdida após oito segundos.
- **Evidência observada (fato):** toda exceção do gateway aciona cancelamento local e compensação. Não existe resultado `UNKNOWN`, payment attempt durável ou consulta/reconciliação antes de cancelar. Se a confirmação chegar depois, o webhook apenas grava nota administrativa e `AuditLog`; não há alerta operacional emitido, reativação segura ou reembolso automático.
- **Hipótese separada:** a cobrança remota ter sido criada apesar do timeout é uma possibilidade distribuída, não um incidente observado. Por isso a confiança é `HIGH CONFIDENCE`, não confirmação de ocorrência.
- **Impacto:** cobrança pode coexistir com pedido cancelado e estoque devolvido; o cliente pode repetir a compra; resolução depende de descoberta e ação manual.
- **Correção proposta:** persistir tentativa antes da chamada com chave idempotente aceita pelo provider, estado `PENDING/UNKNOWN/SUCCEEDED/FAILED`; em timeout, não assumir falha; consultar por referência/idempotency key; reconciliar assincronamente; emitir alerta para pagamento tardio.
- **Teste de regressão:** mock deve criar cobrança e lançar timeout antes da resposta; reconciliação precisa encontrar a cobrança e convergir sem duplicar pedido, estoque ou pontos.
- **Risco residual:** não adicionar retry cego de POST; retry só é seguro com idempotência remota comprovada e mesma chave.

### OBS-004 — Logs expõem PII e token de reset; sanitização não cobre erros nem campos comuns

- **Severidade:** HIGH
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `lib/logger.ts:20-59`, `88-118`; `app/api/checkout/route.ts:107-116`; `services/asaas/asaas.adapter.ts:57-68`, `78-89`; `app/api/webhooks/asaas/route.ts:75-79`; `lib/email/providers/dev.provider.ts:19-35`; `services/auth.service.ts:172-198`
- **Fluxo e condição de manifestação:** checkout/gateway registra cliente, confirmação de pagamento registra destinatário ou produção sem provider de e-mail usa o provider dev durante recuperação de senha.
- **Evidência observada (fato):** o sanitizador mascara CPF/CNPJ e nomes de chave relacionados a segredo, mas deixa `email`, telefone, nome e endereço. `Error.message` e `stack` são copiados sem sanitização. Logs de checkout/Asaas incluem e-mail completo; confirmação registra `to`; provider dev registra destinatário e texto integral, que no reset contém URL com token.
- **Hipótese separada:** acesso, retenção e coleta efetiva dos logs são externos e não foram verificados.
- **Impacto:** investigação e agregação de logs passam a tratar PII e credencial temporária; operador com acesso a logs pode usar token ainda válido; erros de provider/DB podem carregar valores inesperados.
- **Correção proposta:** allowlist de campos observáveis; pseudonimizar e-mail/telefone; nunca registrar corpo, URL assinada, token ou endereço; sanitizar mensagem/stack e exceções aninhadas; bloquear provider dev fora de ambiente local explícito; definir retenção e acesso.
- **Teste de regressão:** usar marcadores fictícios em e-mail, telefone, endereço, token, URL e `Error.message`; capturar toda saída `stdout/stderr` e confirmar ausência literal em logs estruturados e `console.*`.
- **Risco residual:** identificadores estáveis também podem ser dados pessoais quando correlacionáveis; retenção e acesso continuam sendo controles necessários.

### OBS-005 — Reembolso e expiração ignoram resultado de transição e ainda retornam sucesso

- **Severidade:** HIGH
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `app/api/webhooks/asaas/route.ts:282-311`, `326-340`; `services/order.service.ts:265-296`
- **Fluxo e condição de manifestação:** `PAYMENT_REFUNDED`, `PAYMENT_OVERDUE` ou `PAYMENT_DELETED` chama `updateOrderStatus`, e o serviço retorna `{ success: false }` em vez de lançar.
- **Evidência observada (fato):** somente o caminho de pagamento confirmado verifica `updateResult.success`. Os caminhos de refund/overdue/deleted aguardam a função, ignoram o retorno e chegam ao log `ASAAS_WEBHOOK_PROCESSED` e HTTP 200.
- **Hipótese separada:** a frequência de transições inválidas ou pedidos ausentes não foi medida.
- **Impacto:** gateway considera o evento aceito enquanto pedido, estoque e pontos mantêm o estado anterior; o evento já persistido também bloqueia reentrega por `OBS-001`.
- **Correção proposta:** validar todos os resultados; marcar evento `FAILED` e responder de modo que permita retry quando o erro for transitório; classificar erros permanentes para reconciliação/manual review; registrar estado esperado/observado sem PII.
- **Teste de regressão:** mockar `{ success:false }` em cada evento e confirmar ausência de log/status `PROCESSED`, persistência do erro e reprocessamento posterior.
- **Risco residual:** uma resposta não-2xx pode gerar repetição; os efeitos devem ser idempotentes antes de habilitar retry.

### OBS-006 — E-mail fire-and-forget pode desaparecer e provider que retorna falha é logado como sucesso

- **Severidade:** MEDIUM
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `app/api/webhooks/asaas/route.ts:10-85`, `241-247`; `lib/email/providers/resend.provider.ts:20-68`
- **Fluxo e condição de manifestação:** pagamento vira `PAID`; resposta do provider é não-2xx ou runtime encerra após responder ao webhook.
- **Evidência observada (fato):** o handler dispara a Promise sem `await`/outbox. Dentro da função, o retorno `EmailResult` não é inspecionado e o log “despachado com sucesso” é emitido mesmo quando o provider resolve `{ success:false }`. O fetch do Resend também não tem timeout.
- **Hipótese separada:** alguns runtimes podem permitir que a Promise termine; isso não é garantia durável e requer verificação externa.
- **Impacto:** notificação pode não ser enviada enquanto o log afirma sucesso; não existe retry, estado por mensagem nem reconciliação.
- **Correção proposta:** outbox transacional e worker idempotente, ou primitive de background oficialmente garantida pelo runtime; checar `EmailResult.success`; registrar `messageId`, tentativa e erro sanitizado; timeout e retry somente para falhas seguras.
- **Teste de regressão:** provider retorna `success:false`, rejeita, expira e falha após resposta HTTP; cada caso deve ficar pendente/falhado e ser retomável sem duplicar e-mail.
- **Risco residual:** resposta 2xx do provider comprova aceitação, não entrega; webhooks/bounces do e-mail podem ser necessários.

### OBS-007 — Jobs sinalizam falha parcial como sucesso operacional

- **Severidade:** MEDIUM
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `services/order-timeout.service.ts:120-160`; `app/api/cron/orders-timeout/route.ts:89-108`; `services/loyalty.service.ts:768-828`; `app/api/cron/loyalty-expiration/route.ts:82-124`
- **Fluxo e condição de manifestação:** consulta de pedidos falha, cancelamento individual falha ou uma carteira de pontos falha.
- **Evidência observada (fato):** timeout de pedidos devolve resumo `success:false`, mas a rota responde HTTP 200. Expiração de pontos captura erros por carteira, porém a rota loga “concluída com sucesso”, responde `success:true` e HTTP 200 mesmo com `errors.length > 0`.
- **Hipótese separada:** o scheduler pode inspecionar o corpo e alertar por `errorCount`; essa configuração é **NOT VERIFIED**.
- **Impacto:** monitor baseado em status HTTP/sucesso não detecta falha; estoque reservado e passivo de pontos podem acumular sem alerta.
- **Correção proposta:** separar `SUCCESS/PARTIAL/FAILED`, retornar status contratual compatível com o scheduler, emitir run ID/heartbeat e métricas, persistir itens falhos para retry; alertar por ausência e erro.
- **Teste de regressão:** simular erro global e parcial; scheduler fake deve detectar ambos; próxima execução deve retomar somente itens pendentes de forma idempotente.
- **Risco residual:** HTTP não substitui monitor de ausência; job que nunca iniciou não gera resposta.

### OBS-008 — Correlation ID não é ponta a ponta, não é devolvido e aceita valor arbitrário do cliente

- **Severidade:** MEDIUM
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `lib/logger.ts:8-18`, `74-86`; `app/api/checkout/route.ts:10-14`, `90-118`; `services/checkout.service.ts:110-115`, `480-665`; `app/api/webhooks/asaas/route.ts:326-345`
- **Fluxo e condição de manifestação:** suporte tenta correlacionar erro informado pelo cliente com gateway, webhook, transação e compensação.
- **Evidência observada (fato):** checkout aceita headers do cliente sem validar tamanho/formato ou distinguir ID externo/interno, cria UUID apenas como fallback e não o devolve em header/corpo. `createOrder`/gateway não recebem o ID. `logger.withContext` existe, mas não é usado. Erros do webhook não incluem o `eventId` no contexto final quando a exceção ocorre antes do log de sucesso.
- **Hipótese separada:** ingress externo pode injetar outro ID, mas não existe propagação comprovada no código.
- **Impacto:** busca manual por múltiplos IDs; erro antes da criação do pedido não pode ser relacionado pelo cliente; valor arbitrário aumenta cardinalidade e confusão operacional.
- **Correção proposta:** gerar ID interno em middleware/instrumentação, preservar ID externo separadamente, limitar/validar ambos, propagar por contexto assíncrono e headers downstream, devolver `X-Request-ID` e incluir em toda resposta/log/evento.
- **Teste de regressão:** uma requisição deve manter o mesmo ID em controller, serviço, gateway mock, webhook/reconciliação e resposta; header enorme/inválido deve ser substituído com segurança.
- **Risco residual:** processos assíncronos precisam de causation/correlation IDs próprios, não apenas o request ID original.

### OBS-009 — Não há métricas, traces, alertas ou health endpoints versionados

- **Severidade:** MEDIUM
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `package.json:17-56`; `.github/workflows/ci.yml:1-42`; ausência em `app/api/**` e de `instrumentation.ts`
- **Fluxo e condição de manifestação:** degradação de checkout/webhook, cron parado, saturação do banco ou aumento de compensações.
- **Evidência observada (fato):** não foi encontrada instrumentação direta, exporter, endpoint health/readiness/metrics, regra de alerta, SLI ou SLO. Há logs locais e durações pontuais, mas não agregação versionada.
- **Hipótese separada:** a plataforma pode coletar stdout e configurar alertas fora do repositório. Isso é **NOT VERIFIED** e não permite avaliar cobertura.
- **Impacto:** detecção depende de relato do cliente ou inspeção manual; não há taxa/latência/erro por etapa, backlog de webhook/outbox, heartbeat de cron ou alerta de divergência.
- **Correção proposta:** métricas RED e de negócio com baixa cardinalidade; tracing de checkout/gateway/webhook/reconciliação; readiness/liveness; alertas para 5xx, falha de webhook, eventos `FAILED`, compensação, cron ausente, pool e latência do provider; versionar dashboards/alertas quando possível.
- **Teste de regressão:** falhas sintéticas locais/staging autorizado devem produzir métrica, trace correlacionado e alerta controlado sem PII.
- **Risco residual:** telemetria pode falhar; controles de negócio duráveis e reconciliação não devem depender apenas dela.

### OBS-010 — Orçamentos de tempo e circuit breakers são incompletos

- **Severidade:** MEDIUM
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `services/asaas/asaas.client.ts:53-68`; `services/freight/providers/correios.provider.ts:31-57`, `89-92`; `lib/email/providers/resend.provider.ts:29-68`; usos de `prisma.$transaction` em `services/checkout.service.ts:115` e `services/order.service.ts:313-438`
- **Fluxo e condição de manifestação:** latência ou indisponibilidade de Asaas, Correios, Resend ou banco.
- **Evidência observada (fato):** Asaas e Correios têm timeout e Correios possui fallback, controles positivos. Resend não tem timeout; transações críticas não definem orçamento explícito no call site; nenhum circuit breaker/bulkhead foi encontrado. Não há deadline único propagado do request.
- **Hipótese separada:** runtime, SDK, banco ou plataforma podem impor limites externos; valores e comportamento são **NOT VERIFIED**.
- **Impacto:** requisições podem ocupar workers além do orçamento do usuário; falha em cascata não é isolada; timeout de uma camada pode ocorrer depois de efeitos remotos.
- **Correção proposta:** definir orçamento ponta a ponta e timeouts menores por dependência; cancelamento propagado; circuit breaker apenas onde reduz cascata; concorrência/bulkhead; retry com backoff e jitter somente para leituras ou mutações idempotentes.
- **Teste de regressão:** mocks lentos e indisponíveis devem provar limite total, cancelamento e fallback; confirmar explicitamente que POST de cobrança não sofre retry cego.
- **Risco residual:** timeout não cancela necessariamente trabalho remoto já aceito, exigindo `OBS-003`.

### OBS-011 — Graceful shutdown não desconecta o Prisma em produção e não trata sinais de término

- **Severidade:** MEDIUM
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `lib/prisma.ts:17-35`; `next.config.js:1-4`
- **Fluxo e condição de manifestação:** runtime standalone recebe término/redeploy durante request/transação.
- **Evidência observada (fato):** o client só é atribuído a `globalThis.prismaGlobal` fora de produção. O callback `beforeExit` desconecta apenas `globalThis.prismaGlobal`, portanto não alcança o client local em produção. Não há handlers `SIGTERM`/`SIGINT`, drenagem de requests ou prazo de shutdown.
- **Hipótese separada:** em serverless o provider pode gerenciar lifecycle; para o artefato `standalone`, o processo pode ser persistente. O runtime efetivo é **NOT VERIFIED**.
- **Impacto:** conexões e operações em voo podem ser interrompidas sem drain; deploy pode perder trabalho assíncrono, especialmente o e-mail fire-and-forget.
- **Correção proposta:** adequar shutdown ao runtime suportado; manter referência desconectável em produção; tratar sinais quando aplicável, parar aceitação de tráfego, aguardar trabalho durável/in-flight com timeout e então desconectar.
- **Teste de regressão:** iniciar servidor local com request lento controlado, enviar sinal e comprovar drain, timeout máximo e encerramento das conexões sem duplicar efeitos.
- **Risco residual:** plataformas podem terminar instância sem janela suficiente; trabalho crítico deve ser durável, não apenas aguardado em memória.

### OBS-012 — Erros internos e de provider são devolvidos diretamente em várias APIs

- **Severidade:** MEDIUM
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `app/api/checkout/route.ts:107-118`; `app/api/webhooks/asaas/route.ts:341-349`; `app/api/cart/route.ts:51-57`, `85-91`, `118-124`; `app/api/upload/route.ts:82-89`; `app/api/admin/loyalty/reports/route.ts:115-118`
- **Fluxo e condição de manifestação:** provider, Prisma ou serviço lança mensagem técnica inesperada.
- **Evidência observada (fato):** várias rotas usam `error.message` como resposta; webhook inclui `details`; checkout converte qualquer exceção em HTTP 400 e devolve mensagem do gateway/infra. Não há envelope central com código público estável e referência de suporte.
- **Hipótese separada:** mensagens atuais podem ser benignas na maioria dos casos; dependências futuras podem incluir SQL, caminhos ou identificadores.
- **Impacto:** vazamento de detalhe interno, classificação incorreta de erro transitório como 4xx, cliente sem ID para suporte e métricas de 5xx subcontadas.
- **Correção proposta:** mapear erros tipados a código/status/mensagem pública; registrar detalhes sanitizados com request ID; usar 4xx somente para erro do cliente e 5xx/502/503/504 para infraestrutura/provider.
- **Teste de regressão:** lançar erro fictício contendo marcador sensível e confirmar que resposta não o contém, status é correto e log sanitizado conserva apenas código/request ID.
- **Risco residual:** schemas de validação podem expor caminhos aceitáveis; revisar mensagens caso a caso.

### OBS-013 — Investigação depende de banco de produção e payloads brutos sem política de retenção

- **Severidade:** MEDIUM
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `prisma/schema.prisma:378-413`, `426-468`, `552-562`; `app/api/webhooks/asaas/route.ts:149-158`; `services/order.service.ts:327-350`, `379-406`
- **Fluxo e condição de manifestação:** suporte precisa explicar status, estoque, pontos ou webhook sem consultar dados pessoais.
- **Evidência observada (fato):** mudanças críticas são persistidas em `AuditLog`/ledger, mas não existe projeção operacional sanitizada ou exportação observada. O webhook armazena o payload inteiro; o tipo admite identificadores de cliente, URLs e dados de cartão retornados pelo provider. Não há retenção/expurgo versionado nem estado de processamento suficiente.
- **Hipótese separada:** o payload real pode omitir alguns campos e o banco pode ter controles/retention externos; ambos são **NOT VERIFIED**.
- **Impacto:** investigação exige acesso privilegiado ao banco e aumenta exposição de PII; operadores não conseguem consultar uma timeline mínima por IDs pseudônimos; payload cresce sem ciclo de vida demonstrado.
- **Correção proposta:** criar timeline operacional sanitizada por `orderId/eventId/paymentId`, com estados e códigos; armazenar apenas campos necessários ou criptografar/separar payload bruto; definir retenção e acesso auditado; fornecer ferramenta read-only com RBAC.
- **Teste de regressão:** fixture com PII/token fictícios não deve aparecer na projeção; incidente deve ser reconstruído por IDs técnicos sem acesso às tabelas de cliente/payload bruto.
- **Risco residual:** alguns incidentes legítimos exigirão acesso excepcional a dados; adotar break-glass auditado e minimização.

### OBS-014 — Testes não cobrem os principais caminhos negativos de observabilidade

- **Severidade:** LOW
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `tests/unit/asaas-webhook.test.ts:128-153`, `350-374`, `420-488`; `tests/unit/logger.test.ts:27-63`; `tests/unit/inventory-lifecycle.test.ts:85-105`; ausência de cenários correspondentes
- **Fluxo e condição de manifestação:** regressão altera ordem do webhook, sanitização, restore, e-mail ou sinalização de cron.
- **Evidência observada (fato):** testes cobrem duplicata já existente e colisão P2002, mas não falha depois do insert seguida de reentrega. O mock de evento usa um campo `status` inexistente no schema, sinal de divergência de contrato. Logger não testa e-mail/telefone/endereço nem segredo dentro de `Error`. Não há teste de falha no restore; e-mail do webhook testa rejeição da busca, não `EmailResult.success=false`; crons não exercitam resposta parcial.
- **Hipótese separada:** testes externos podem existir fora do repositório; não foram assumidos.
- **Impacto:** defeitos confirmados podem reaparecer sem gate. A ausência de teste, isoladamente, não prova falha adicional.
- **Correção proposta:** adicionar testes de fault injection e contratos de sinais depois de corrigir os comportamentos; evitar sleeps para fire-and-forget usando outbox/worker controlável.
- **Teste de regressão:** os próprios cenários descritos em OBS-001 a OBS-013 devem compor uma suíte negativa determinística.
- **Risco residual:** mocks não reproduzem término abrupto, rede incerta ou semântica real do scheduler; complementar com integração autorizada e ambiente descartável.

## 6. Controles positivos observados

- Logger estruturado em JSON com timestamp e níveis (`lib/logger.ts:62-156`).
- Mascaramento recursivo de CPF/CNPJ e chaves nomeadas como token/secret/password (`lib/logger.ts:20-59`).
- Checkout gera UUID de correlação quando o header não existe (`app/api/checkout/route.ts:10-14`).
- Adapter Asaas registra duração, pedido e identificador externo em sucesso/erro (`services/asaas/asaas.adapter.ts:24-109`, `176-220`, `278-324`, `331-370`).
- Asaas tem timeout de oito segundos; Correios tem timeout de 3,5 segundos e fallback (`services/asaas/asaas.client.ts:53-68`; `services/freight/providers/correios.provider.ts:31-92`).
- Não foi encontrado retry automático cego de criação de cobrança, o que evita duplicação por uma política ingênua. A lacuna é reconciliação do resultado incerto, não “adicionar retries”.
- Transições de pedido e ledger usam transações de banco e `AuditLog` (`services/order.service.ts:312-438`).
- Cron de timeout agrega erros por pedido e duração (`services/order-timeout.service.ts:17-25`, `135-160`).
- Webhook autentica de forma fail-closed e usa `eventId` único, base adequada após corrigir a máquina de processamento (`app/api/webhooks/asaas/route.ts:88-169`).

## 7. Dívida priorizada

| Prioridade | Ação | Findings |
|---|---|---|
| P0 | Tornar webhook retomável com estados, lease, tentativas e reconciliação | OBS-001, OBS-005 |
| P0 | Tornar cancelamento/restore atômico ou explicitamente pendente | OBS-002 |
| P0 | Modelar resultado incerto do gateway e pagamento tardio | OBS-003 |
| P0 | Remover PII/tokens dos logs e sanear erros | OBS-004 |
| P1 | Implantar outbox de e-mail e sinalização correta dos crons | OBS-006, OBS-007 |
| P1 | Propagar correlação e padronizar contrato de erro | OBS-008, OBS-012 |
| P1 | Criar métricas, traces, health e alertas | OBS-009 |
| P2 | Definir budgets/circuit breakers e shutdown por runtime | OBS-010, OBS-011 |
| P2 | Criar timeline sanitizada, retenção e testes negativos | OBS-013, OBS-014 |

## 8. Itens não aplicáveis ou não verificados

### Não aplicáveis com a evidência atual

- **Fila/broker:** nenhuma fila durável foi encontrada; portanto não há DLQ, consumer lag ou retry policy de broker para auditar. A ausência é tratada como lacuna nos fluxos que precisam de durabilidade, não como configuração defeituosa de um broker inexistente.
- **Kubernetes probes:** não há manifests Kubernetes; a avaliação limita-se à ausência de health endpoints na aplicação.
- **Circuit breaker de SDK:** a integração Asaas usa `fetch` próprio; não há SDK com política interna observável.

### Não verificados

- coleta real de stdout/stderr, backend de logs, retenção, RBAC e alertas configurados no provedor;
- traces/métricas injetados externamente pela hospedagem;
- health check, drain e grace period do runtime real;
- comportamento de retry do Asaas, Resend e scheduler;
- volume de erros, latências, timeouts, eventos fora de ordem e pagamentos tardios reais;
- conteúdo efetivo dos webhooks e classificação de dados pelo provider;
- testes, pois as dependências locais não estavam instaladas;
- estado e consultas do banco de produção, deliberadamente não acessados.

## 9. Riscos residuais

Mesmo após instrumentação, logs e traces não substituem estados duráveis, idempotência e reconciliação. Falhas distribuídas podem ocorrer depois que o provider aceitou uma cobrança e antes da persistência local; eventos podem chegar fora de ordem; shutdown pode interromper trabalho; e telemetria pode estar indisponível durante o incidente. A resposta deve combinar observabilidade minimizada, outbox/inbox, replay seguro, reconciliação e runbooks testados.

## 10. Conclusão

No escopo desta etapa, o sistema oferece sinais úteis, mas não permite investigar nem recuperar de forma confiável todos os fluxos críticos sem consultar produção ou dados pessoais. Há **1 CRITICAL, 4 HIGH, 8 MEDIUM e 1 LOW**. `OBS-001` bloqueia publicação; `OBS-002` a `OBS-005` também devem ser tratados antes do go-live por representarem divergência silenciosa de estoque, cobrança, reembolso ou dados sensíveis.

Nenhum código de produto, dado real ou serviço externo foi alterado. A conclusão limita-se à revisão `0c7ef7d` e não certifica controles configurados fora do repositório.


---

## Revalidação de 2026-09-29 — etapa 12/15

O conteúdo anterior é histórico e foi preservado. Esta seção avalia o código local atual, incluindo mudanças sem commit, após as correções registradas em docs/remediation. Base: HEAD 0c7ef7ddfa5fb4520c4bc794163cbc71257c2bc4. O responsável autorizou continuar as etapas sem pausas. Somente relatórios são alterados.

### Resultado

Corrigido: **6**; Parcialmente corrigido: **8**. Pendências confirmadas/parciais por risco residual: HIGH 1, MEDIUM 7. Itens não verificados ficam separados de defeitos confirmados.

Corrigido refere-se ao defeito original no recorte verificado; não certifica toda a funcionalidade ou serviços externos. Confiança CONFIRMED identifica código observado e/ou teste executado, conforme a evidência; não transforma inspeção em teste dinâmico. Severidade original é preservada, e risco residual não deve ser somado entre relatórios sem deduplicação.

### Matriz dos achados

| ID | Severidade original | Estado | Risco residual | Confiança | Evidência atual, fluxo e impacto | Encerramento / regressão / limite |
|---|---|---|---|---|---|---|
| OBS-001 | CRITICAL | Corrigido | LOW | CONFIRMED | `app/api/webhooks/asaas/route.ts:220-290,590-630` persiste inbox com lease e conclusão após efeitos; testes negativos e concorrência webhook/worker passaram. | Reentrega real do gateway continua sem prova; crash lógico foi simulado no DB local. |
| OBS-002 | HIGH | Corrigido | LOW | CONFIRMED | `services/inventory.service.ts:88-129`; rollback real em `tests/integration/database-invariants.test.ts` impede cancelamento parcialmente efetivado. | Manter regressão com falha no meio da reposição. |
| OBS-003 | HIGH | Parcialmente corrigido | HIGH | CONFIRMED | `services/checkout.service.ts:690`; `services/payment-reconciliation.service.ts:1` persistem intenção antes do gateway, estado ambíguo e recovery; duas claims/crash lógico passaram no PostgreSQL. | Worker corrigido localmente; consulta por referência, entrega de webhook e agenda no destino ainda precisam de homologação. |
| OBS-004 | HIGH | Parcialmente corrigido | MEDIUM | CONFIRMED | `lib/logger.ts:1` sanitiza estruturas/erros; `lib/session.ts:131` e `app/api/loyalty/simulate/route.ts:44` ainda usam console.error com objeto bruto. | Migrar caminhos restantes para logger e testar erro com PII/token fictício. Retenção, RBAC e limpeza de logs históricos não verificados. |
| OBS-005 | HIGH | Corrigido | LOW | CONFIRMED | Webhook e `services/order-timeout.service.ts:57-76` verificam resultado; transição concorrente/estorno único passaram. | Não contar falha de transição como sucesso de efeito; pós-condições locais verificadas. |
| OBS-006 | MEDIUM | Parcialmente corrigido | MEDIUM | CONFIRMED | `app/api/webhooks/asaas/route.ts:90-150,413-416` aguarda email e trata resultado; `lib/email/providers/resend.provider.ts:60` limita tempo. | Não há outbox durável para retry após falha/process kill; registrar tentativa e reenvio idempotente. Entrega/bounce não comprovados. |
| OBS-007 | MEDIUM | Corrigido | LOW | CONFIRMED | `app/api/cron/orders-timeout/route.ts:68`, `loyalty-expiration/route.ts:78`, `payment-reconciliation/v1/route.ts:46` retornam 503 em falha parcial; unitários passaram. | Scheduler precisa interpretar status, evitar retries cegos e alarmar ausência de sucesso. |
| OBS-008 | MEDIUM | Corrigido | LOW | CONFIRMED | `lib/observability/request-context.ts:11-49` valida ID externo, cria UUID local, propaga contexto e devolve x-request-id; testes de correlação passaram. | Correção comprovada no processo/fluxos instrumentados; propagação por proxy e serviços externos não verificada. |
| OBS-009 | MEDIUM | Parcialmente corrigido | MEDIUM | CONFIRMED | `app/api/health/ready/route.ts:1`, `app/api/internal/metrics/route.ts:8-48` e `ops/observability/alerts.example.yml:1` oferecem probes/métricas/alertas. | Counters em memória não sobrevivem a restart; métricas financeiras consultam persistência. Coleta, tracing distribuído, dashboards e paging externo pendentes. |
| OBS-010 | MEDIUM | Parcialmente corrigido | MEDIUM | CONFIRMED | `lib/email/providers/resend.provider.ts:60`, `services/asaas/asaas.client.ts:53`, provider Correios possuem timeout; não há deadline global ou circuit breaker geral. | Definir orçamento por fluxo e ensaiar lentidão/falhas com fakes. Não adicionar retry automático a POST financeiro sem idempotência. |
| OBS-011 | MEDIUM | Parcialmente corrigido | MEDIUM | CONFIRMED | `lib/prisma.ts:65-70` registra beforeExit; `scripts/start-runtime.mjs:1` encaminha sinais no modo subprocesso; não se provou drain de requisições no standalone. | Testar SIGTERM durante pedido/reconciliação em runtime isolado, parar admissão e medir término; beforeExit não prova comportamento de SIGTERM. |
| OBS-012 | MEDIUM | Parcialmente corrigido | MEDIUM | CONFIRMED | Erros genéricos foram adotados nas rotas centrais; `app/api/auth/register/route.ts:61` ainda devolve error.message e `app/api/loyalty/simulate/route.ts:44` mantém catch com erro bruto. | Usar erros públicos allowlisted e correlação; testar falha Prisma/provider sem retorno de detalhes internos. |
| OBS-013 | MEDIUM | Parcialmente corrigido | MEDIUM | CONFIRMED | `app/api/webhooks/asaas/route.ts:61-85` persiste payload allowlisted; IDs e intents financeiras permitem rastreio; runbooks orientam acesso/retencão. | Retenção efetiva, expurgo de dados antigos e acesso operacional continuam pendentes; não consultar PII real para validar. |
| OBS-014 | LOW | Corrigido | LOW | CONFIRMED | Unitários de logger/health/cron/email e integrações reais de rollback, lease e recuperação passaram no conjunto 613+26. | Cobre falhas locais reproduzidas; kill de processo, alerta, scheduler e indisponibilidade real de provedor não exercitados. |

### Confronto, investigação e limites
Revisados `docs/remediation/OBSERVABILITY-FIXES.md:13-30` e a implementação posterior de reconciliação/reembolso. As declarações históricas de logs/erros corrigidos não são estendidas aos catches remanescentes; OBS-004/012 permanecem parciais.

Rastreio disponível: requestId/correlationId → loja/pedido → referência de pagamento → inbox do webhook → PaymentReconciliation/RefundIntent → transição e ledger. Essa cadeia permite começar a investigação por identificadores técnicos sem listar dados pessoais. Ela não prova centralização dos logs ou propagação externa.

Verificações: inspeção `rg -n` de erros, timeout, métricas e contexto; suíte unitária 613/613 e sete integrações 26/26. Provas negativas incluem resultado parcial de cron, sanitização, timeout fake, rollback e recovery após efeitos persistidos. Nenhum email, webhook externo, alerta real ou retry de cobrança foi disparado. Tempos do runner não são SLO de checkout.

Para encerrar: instrumentar caminhos restantes, estabelecer outbox/recovery de notificações, executar ensaio de shutdown e comprovar alertas/retencão/agenda no destino. Métricas protegidas e exemplos versionados são implementação local; não demonstram serviço externo instalado.
