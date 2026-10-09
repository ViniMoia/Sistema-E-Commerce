# L-04 — Primeiro cancelamento PIX no Sandbox

**Operador: Leno (Brega). Revisor: Vanderlei (Que dá idéia errada).** Ensaio de 09/10/2026: cancelamento do pedido #2 e replay aprovados no Sandbox, com prova remota, supervisão, auditoria interna e conferência de estoque/pontos/e-mail. [Resultado consolidado](L-04-RESULTADO_CANCELAMENTO_PIX_PEDIDO_2.md). As seções abaixo preservam os checkpoints históricos; parecer independente e L-04 como um todo continuam pendentes.

## 1. Estado da entrega e revisão

- Código e pacote de revisão publicados em `homologacao_teste`: `ede9cc2868c844393d9fab76a00fd3d6db9afdc5`, confirmado novamente no remoto nesta preparação.
- Validação local já registrada: 90 testes em quatro suítes, TypeScript e lint aprovados. Não houve mudança de código desde essa validação nem motivo para repetir a mesma bateria nesta preparação.
- Releitura técnica local conferiu a projeção financeira, transações de evidência, comando de cancelamento e consumidor. O parecer independente de Vanderlei (Que dá idéia errada) continua pendente; informar o colega não equivale a aprovar a revisão.
- Leno (Brega) confirmou por imagem o Preview Ready da branch `homologacao_teste` no commit `ede9cc2`, em 09/10/2026. Deployment ID não informado. O parecer independente permanece pendente.
- Execução financeira no Preview compartilhado requer janela de Leno (Brega), sem outro operador/deployment alterando o estado durante o ensaio.

### Decisão de continuidade de Leno (Brega), em 09/10/2026

Leno (Brega) solicitou iniciar este teste mesmo sem a revisão de Vanderlei (Que dá idéia errada). Para este caso, a revisão foi adiada: é permitido avançar no **ensaio de cancelamento de um pedido PIX novo no Sandbox**, no Preview `homologacao_teste`/commit `ede9cc2`, com um operador e acompanhamento por etapas. A decisão substitui a espera pela revisão como pré-condição deste ensaio; não registra parecer aprovado, não encerra L-01/L-04 e não libera produção ou outros cenários automaticamente. O aceite da entrega e os gates de produção continuam dependendo da revisão e das evidências previstas no plano.

O próximo passo autorizado é criar uma unidade de Vermelho, com PIX automático, retirada e sem resgate de pontos, preservando o pedido #1. Depois da criação, conferir pedido/cobrança/estoque antes de enviar a operação financeira. Não iniciar cron automático nem repetir checkout/comando/lote quando a resposta estiver inconclusiva.

## 2. Primeiro passo: conferência sem processamento

No painel da Vercel, conferir que o Preview da branch `homologacao_teste` ficou **Ready**, com commit `ede9cc2`. Registrar o deployment ID e o parecer do revisor quando estiver disponível.

Na raiz do projeto, executar somente:

```powershell
.\scripts\homologation\process-payments-once.ps1 -StatusOnly
```

O script pede CRON_SECRET e bypass da homologação em entrada oculta. Não colar os segredos no chat ou enviar cabeçalhos/URL com bypass. Nesta modalidade ele realiza apenas GET de supervisão; não envia POST de processamento.

Resultado esperado para conferir: `ok=true`, `code=SCOPE_VERIFIED`, `accountScope=sandbox-hml`, `processingAttempted=false`. Analisar também inbox/outbox, uncertain, overdue, leases, operações e legados. As contagens antigas são uma referência histórica, não um valor atual obrigatório. Trabalho READY pode interferir no lote posterior e precisa ser identificado antes dele.

Se houver 401, redirecionamento, escopo diferente ou resultado inconclusivo, resolver o acesso/estado antes da criação do novo pedido. Não enviar um lote para testar a autenticação. Não se presume acesso ao Preview com base no Git.

### Evidência recebida de Leno (Brega)

Consulta de `2026-10-09T14:39:38.783Z` (11:39:38.783 BRT), enviada por Leno (Brega): `ok=true`, `code=SCOPE_VERIFIED`, `schemaVersion=1`, `accountScope=sandbox-hml`, `processingAttempted=false`.

| Indicador | Resultado da consulta |
|---|---|
| Inbox | 2 COMPLETED; nenhum outro estado listado. |
| Outbox | 3 COMPLETED; nenhum outro estado listado. |
| uncertain / overdue / abandonedLeases | 0 / 0 / 0. |
| operations | Lista vazia. |
| untrackedLegacyOrders | 0. |
| oldestUnresolvedInboxAt | null. |

A resposta confirma acesso à supervisão e ausência de trabalho pendente listado naquele instante. Não identifica commit/deployment, não comprova revisão independente e não demonstra cancelamento. A imagem posterior enviada por Leno (Brega) confirmou Preview Ready no commit `ede9cc2`; ele informou que Vanderlei (Que dá idéia errada) ainda não poderá fornecer aprovação. A revisão cruzada prevista na seção 10.1 do plano permanece pendente. A orientação inicial era coletar referências sem criar o pedido; a decisão posterior de continuidade na seção 1 permite iniciar este ensaio antes do parecer. Reconferir as referências imediatamente antes da compra, pois o ambiente é compartilhado.

### Referência inicial de estoque recebida

Primeira imagem enviada por Leno (Brega) em 09/10/2026: Item selecionado **Limite geral do produto**, disponível **8**, indisponível **0**. Naquela mensagem, nome/ID do produto e variante ainda não haviam sido informados. O componente `components/admin/InventoryPanel.tsx` mostra o estoque do produto quando essa opção está selecionada e o estoque individual ao selecionar uma variante; portanto, não atribuir as oito unidades a uma variante sem consultá-la.

**Complemento posterior enviado por Leno (Brega), em 09/10/2026:** produto **Aspirador de Pó automotivo**, estoque geral **8**, variante **Vermelho: 4**, variante **Azul: 4**. A imagem dos pontos demonstra a referência abaixo.

| Referência anterior à compra | Valor informado/visível |
|---|---|
| Produto | Aspirador de Pó automotivo. |
| Estoque geral disponível | 8. |
| Estoque Vermelho | 4. |
| Estoque Azul | 4. |
| Estoque geral indisponível | 0 na primeira imagem. |
| Pontos disponíveis | 113, equivalentes a R$ 5,65. |
| Pontos pendentes | 0. |
| Total já acumulado | 612. |
| Movimentações | 4 registros. |
| Crédito de pagamento existente | Uma movimentação de +12 pontos, de 08/10/2026 às 17:00, preservada como referência histórica. |

Variante escolhida para o caso: **Vermelho**, conforme a indicação anterior de Leno (Brega). Tamanho, IDs do produto/variante e quantidades indisponíveis das variantes ainda não constam desta coleta; conferir a combinação exata antes de comprar, sem presumir a identidade de uma variante apenas pela cor. Os saldos são observações do operador, não uma auditoria dos registros internos.

Para uma compra de uma unidade de Vermelho, sem outro operador alterando o estoque, comparar a reserva com geral **8 → 7**, Vermelho **4 → 3** e Azul **4**. Após cancelamento comprovado e liberação única da reserva, esperar geral **8**, Vermelho **4** e Azul **4**. Como o ensaio não utiliza pontos nem recebe pagamento, conferir a preservação dos saldos/movimentações e a ausência de novo ganho por pagamento. Não marcar esses resultados como executados.

**Registrar ajuste** altera estoque e não faz parte desta coleta. Nenhum pedido novo ou comando de cancelamento foi informado nesta etapa. Reconferir a referência imediatamente antes da compra na janela aprovada; a revisão independente permanece pendente.

## 3. Preparar um pedido novo, ainda sem cancelar

Após a conferência inicial e na janela exclusiva de Leno (Brega), aplicando a decisão de continuidade da seção 1 para este caso:

1. Registrar estoque do produto e da variante, saldo/pontos pendentes/movimentações e estado das filas antes da compra.
2. Criar uma compra nova de **uma unidade**, usando **PIX automático**, **retirada no balcão** e **sem resgatar pontos**. Utilizar somente a loja de homologação e o comprador de teste autorizado.
3. Registrar número e UUID do pedido, ID da cobrança, valor, versão do pedido e deployment. A versão vem da leitura do pedido; não presumir que seja zero.
4. Conferir uma única cobrança PIX no Asaas Sandbox com externalReference igual ao UUID do pedido, mesmo valor e estado ainda pendente. Conferir QR/copia e cola no sistema. Não simular pagamento neste caso.
5. Conferir a redução de uma unidade no estoque e reserva mantida. Não deve existir ganho de pontos por pagamento nem confirmação de pagamento por e-mail.

Preservar o pedido #1 e sua cobrança. Um checkout com resposta incerta deve ser investigado pela intenção/pedido existente, sem refazer a compra. Este ensaio não altera prazos diretamente no banco nem usa expiração para substituir a solicitação explícita de cancelamento.

Enviar para orientação da próxima etapa apenas número/UUID do pedido novo, versão, ID da cobrança, valor, estados e contagens de estoque/pontos. Não enviar dados completos de cliente, cookies, credenciais ou instruções PIX.

### Evidência da criação do pedido novo

Leno (Brega) informou que realizou o pedido e enviou imagem da página de confirmação, em 09/10/2026. Elementos visíveis: **pedido #2**, **R$ 49,90**, método **PIX**, **Retirada no Balcão**, estado **Aguardando pagamento**, QR Code e campo de copia e cola apresentados. A imagem demonstra a apresentação das instruções de pagamento; não demonstra recebimento, cancelamento, unicidade da cobrança ou os efeitos internos de estoque/pontos.

A orientação de compra foi **uma unidade de Aspirador de Pó automotivo, Pequeno/Vermelho**, sem pontos. Os itens não aparecem nesta imagem; confirmar a combinação nos detalhes antes de atribuir o efeito a uma variante. Ainda faltam UUID, versão atual, ID da cobrança, estado no Asaas e estoque após a compra. Não copiar o QR/payload para a evidência textual nem presumir versão zero.

Próxima leitura: no Admin, abrir **Pedidos → Detalhes do pedido #2**. Em Rede/Network, a leitura `GET /api/admin/orders/{UUID}` retorna os detalhes. Compartilhar somente os campos `data.id`, `data.orderNumber`, `data.version`, `data.status`, `data.asaasPaymentId` e `data.asaasPaymentStatus`, além da confirmação dos itens/estoques e do estado da cobrança no Sandbox. Não enviar o JSON completo com cliente/endereço. Esta consulta não envia a operação financeira.

**Imagens posteriores recebidas de Leno (Brega):** catálogo mostra estoque geral **7**, **Pequeno/Vermelho: 3**, **Médio/Azul: 4**. Drawer do Admin mostra **pedido #2 Pendente**, uma unidade de Aspirador de Pó automotivo **Vermelho/Pequeno**, total **R$ 49,90**, retirada na loja e data de criação exibida **09/10/2026 às 12:02**. As reduções visíveis correspondem à referência geral 8 e Vermelho 4; Azul permanece em 4. Isso comprova os saldos apresentados, não substitui a auditoria da reserva interna.

O painel Asaas enviado mostra **Aguardando pagamento**, **R$ 49,90**, uma cobrança e um cliente. Corrobora a criação pendente pelo valor, mas ainda é necessário ligar a cobrança ao UUID do pedido usando o ID e a referência externa. Não registrar o valor líquido do provedor como total cobrado. UUID, versão e ID da cobrança ainda não foram recebidos; nenhum cancelamento demonstrado.

A captura de Rede mostra principalmente navegações `orders?_rsc=...`, não a resposta dirigida do pedido. Com a aba Rede aberta, filtrar por `/api/admin/orders/`, fechar os detalhes e reabrir **Detalhes do #2** para capturar o GET. Selecionar a linha correspondente e **Resposta**; compartilhar somente os campos solicitados, sem dados pessoais/cookies. Não usar **Atualizar status** nesta coleta.

## 4. Solicitar o comando financeiro

### Identidade conferida e comando preparado

O texto anexado por Leno (Brega) foi lido sem reproduzir cliente/endereço/credenciais nesta documentação. O objeto `data` confirma **id `e0bfe582-e85b-41e7-8b5c-d877b1e1a7e0`**, **orderNumber 2**, **version 0**, **status PENDING**, **asaasPaymentId `pay_3cuzqjn8kvzirv3k`**, **asaasPaymentStatus PENDING**, **paymentMethod PIX**, **total R$ 49,90**, **pointsRedeemed 0** e uma unidade **Pequeno/Vermelho**. A versão utilizada é a do pedido, não a versão textual da política de preços aninhada no payload.

Comando deste caso: `kind=CANCEL`, `commandId=l04-pix-cancel-pedido2-e0bfe582-v0`, `expectedVersion=0`. Identidade fixa para conservar em eventual replay planejado. O [script do Console](L-04-SOLICITAR_CANCELAMENTO_PEDIDO_2.js) só aceita o host exato do Preview; faz GET atualizado para conferir pedido/tenant/versão/cobrança/método/valor/itens/pontos antes de um único POST. A sessão de Admin fica no navegador; nenhum segredo deve ser colado no script. O servidor revalida o estado dentro da transação.

Executar o conteúdo do script uma vez no **Console** do navegador na página Admin desse Preview, autenticado com o mesmo operador. Enviar somente o JSON sanitizado que ele imprime. Não disparar o lote de processamento antes de avaliar essa resposta. Se ocorrer falha/timeout, comando inconclusivo ou conflito, consultar o estado existente; não recriar identidade nem repetir automaticamente. A preparação do script não comprova seu envio ou aceitação.

**Validação local do script:** sintaxe conferida com `node --check`; 11 conferências em VM com transporte simulado aprovadas (host incorreto sem requisição, versão/estado/cobrança/tenant/pontos/método alterados sem POST, aceite 202, conflito 409 e resposta perdida/ilegível sem repetição). Saída sanitizada e identidade do corpo verificadas, nenhuma chamada externa. Essa validação não certifica execução no navegador ou aceite remoto; os 90 testes anteriores do núcleo financeiro não foram repetidos, pois não houve alteração do núcleo.

O caminho revisado é `POST /api/admin/orders/[orderId]/payment-operation`, autenticado como Admin do tenant. O servidor aceita `kind=CANCEL`, um `commandId` persistido para este ensaio e `expectedVersion` obtido da leitura. Preservar exatamente esses valores em qualquer replay planejado.

O seletor atual em `OrderStatusManager.tsx` usa `PATCH /api/admin/orders/[orderId]/status`; ele não é a solicitação financeira acima. A UI financeira permanece frente de Vanderlei (Que dá idéia errada). A orientação operacional para chamar o endpoint será feita com o pedido novo identificado e as pré-condições conferidas, sem implementar uma segunda regra na interface.

O servidor verifica pedido/tenant, Admin ativo, conta, tentativa/cobrança, versão e estado. Um retorno **202** comprova a aceitação do comando durável, não a exclusão da cobrança. Esperar tentativa CANCEL_PENDING/operação READY, com pedido ainda PENDING e estoque ainda reservado até o consumidor obter a prova.

Não excluir diretamente a cobrança pelo painel do Asaas neste caso: o objetivo é comprovar que o comando da loja alcança o provedor e que a consulta aplica os efeitos corretamente. Se o pagamento for recebido antes da execução, revisar o estado e tratar outro cenário; não forçar o cancelamento de uma compra paga.

## 5. Processar e conferir a prova externa

### Resposta de aceitação recebida de Leno (Brega)

O operador enviou a saída do script do Console: `phase=request_cancel`, `requestAttempted=true`, `processingAttempted=false`, **httpStatus 202**, **ok=true**, **code=CANCEL_REQUEST_ACCEPTED**, **replay=false**. Identidades correspondem ao caso registrado:

| Elemento | Identidade/estado retornado |
|---|---|
| Pedido | `e0bfe582-e85b-41e7-8b5c-d877b1e1a7e0` (#2). |
| Comando | `l04-pix-cancel-pedido2-e0bfe582-v0`. |
| Tentativa | `587d9515-030f-474f-9edf-ee6d1d722086`. |
| Operação | `41d09e96-3454-4522-a338-be7b768e281f`. |
| Tipo/estado | CANCEL / READY, uma operação retornada. |

Isso demonstra aceite do comando durável, sem replay, não conclusão no provedor. Nenhum lote de processamento foi demonstrado nessa saída. Não executar novamente o script de solicitação nem presumir estoque liberado ou cobrança excluída.

**Próximo passo:** no Terminal PowerShell, na raiz do projeto, executar `./scripts/homologation/process-payments-once.ps1 -StatusOnly` e enviar o JSON sanitizado. Essa nova leitura confere o escopo e o trabalho pronto no Preview compartilhado após a criação do pedido e do comando. Esperar uma operação `kind=CANCEL`, `status=READY`, `_count=1`, salvo mudança de estado a investigar; avaliar também outras filas/pendências antes de orientar o lote. A consulta não envia o POST de processamento. A referência antiga de filas não comprova o estado atual.

### Supervisão após o comando e orientação do primeiro lote

Leno (Brega) enviou a consulta de **2026-10-09T15:52:53.005Z** (**12:52:53.005 BRT**), `SCOPE_VERIFIED`, `sandbox-hml`, `processingAttempted=false`:

- Inbox: **2 COMPLETED**, sem outro estado listado e oldestUnresolvedInboxAt null.
- Outbox: **3 COMPLETED e 1 READY**.
- Operações: **1 CANCEL/READY**.
- uncertain, overdue, abandonedLeases e untrackedLegacyOrders: **0**.

A operação pronta é coerente com a aceitação registrada. A outbox adicional é compatível com a entrada **CHECKOUT_COMMITTED** criada em `services/checkout.service.ts`; a supervisão agregada não demonstra o tipo ou pedido dessa linha. O consumidor `services/payment/payment-outbox.service.ts` conclui CHECKOUT_COMMITTED sem envio de e-mail; trata ORDER_STATUS_CHANGED e só cria confirmação quando o destino é PAID. A mera contagem READY não comprova e-mail enviado nem pagamento. O lote também pode consumir essa saída.

Com base na leitura, orientar **uma execução** de `./scripts/homologation/process-payments-once.ps1` **sem -StatusOnly**, em PowerShell na raiz do projeto, mantendo a janela com um operador. O script verifica novamente escopo/legados e solicita `POST /api/cron/payments?limit=1`. Não repetir o comando de cancelamento. A seleção da conciliação é global por vencimento, não por UUID; um contador completed não demonstra sozinho que o pedido #2 foi cancelado. Receber o resumo e depois conferir o estado dirigido do pedido/cobrança/estoque/pontos/filas. Falha ou resultado incerto requer leitura, sem repetição automática. A orientação do lote não comprova que ele foi executado.

Após aceitar e conferir o comando, orientar **um lote** com o script existente sem `-StatusOnly`. O consumidor consultará o estado antes de despachar a operação e consultará novamente após o envio. `limit=1` limita seleções por etapa, não escolhe exclusivamente o pedido; analisar o trabalho pronto antes de executar.

O adapter chama `DELETE /payments/{id}` para excluir a cobrança. A documentação do Asaas descreve essa exclusão e o evento PAYMENT_DELETED ([fonte oficial](https://docs.asaas.com/reference/excluir-cobranca)). A evidência esperada pela aplicação é a consulta da cobrança identificada com sinal de exclusão; um HTTP bem-sucedido isolado não substitui essa conferência.

Registrar resumo do lote e leitura posterior do pedido, filas e cobrança. Sem conclusão ou com retry/review, preservar o estado e investigar; não repetir o comando/lote automaticamente. O webhook pode chegar depois do lote: analisar a entrada antes de orientar outra execução.

## 6. Critérios de aceite deste caso

### Primeiro lote recebido e próxima conferência

Leno (Brega) enviou o resumo do primeiro processamento após a solicitação:

| Etapa | claimed | completed | retried | review |
|---|---:|---:|---:|---:|
| Inbox | 0 | 0 | 0 | 0 |
| Conciliação | 1 | 1 | 0 | 0 |
| Outbox | 1 | 1 | 0 | 0 |

Expiração: success=true, processedCount=0, cancelledCount=0, errorCount=0, listas de cancelamentos/erros vazias e executionTimeMs=589. A ausência de cancelamentos na etapa de **expiração** não significa falha do comando CANCEL: a operação solicitada é despachada pela **conciliação**. Ainda assim, completed=1 não identifica a tentativa selecionada nem comprova cancelamento do pedido #2.

**Conferência seguinte, sem novo processamento:** consultar o pedido #2 e sua cobrança `pay_3cuzqjn8kvzirv3k`, estoques e pontos; obter `process-payments-once.ps1 -StatusOnly` para o estado atual da operação/filas. Esperar pedido CANCELLED, cobrança com exclusão comprovada, estoque geral 8 / Pequeno-Vermelho 4 / Médio-Azul 4, preservação de 113 pontos disponíveis / 0 pendentes / 4 movimentações e nenhum e-mail de pagamento confirmado para o #2. São critérios esperados, não observados ainda. Avaliar webhook novo e demais filas antes de orientar outro lote. Não repetir a solicitação ou o processamento automaticamente.

| Elemento | Resultado a demonstrar |
|---|---|
| Cobrança | Mesma referência/valor/método; exclusão comprovada por consulta no Sandbox. |
| Tentativa/operação | Tentativa CANCELLED; operação CANCEL COMPLETED com identidade preservada. |
| Pedido | CANCELLED, um histórico de cancelamento e reserva RELEASED. |
| Estoque | Produto e variante voltam ao saldo anterior à compra, uma única vez. |
| Financeiro | Um fato CANCELLED, sem inventar pagamento/estorno de valor recebido. |
| Pontos/e-mail | Nenhum ganho por pagamento e nenhuma confirmação de pagamento enviada para este pedido. |
| Repetição controlada | Depois de concluir e inspecionar, repetição do mesmo comando/evento não duplica efeitos. Não usar uma nova identidade para simular replay. |
| Filas/pendências | Trabalho deste ensaio concluído, sem lease abandonada, retry/review ou operação inconclusiva não tratada. |

### Conferência do operador após o lote

Leno (Brega) confirmou **pedido #2 Cancelado**, **estoque geral 8 / Pequeno-Vermelho 4 / Médio-Azul 4** e os valores de pontos da referência (**113 disponíveis, 0 pendentes, 4 movimentações**). Sua expressão “pontos restaurados” é registrada como preservação dos saldos informados: pointsRedeemed era 0, portanto não se deduz um estorno de pontos nem se inventa nova movimentação.

A imagem do painel geral Asaas mostra **Aguardando pagamento R$ 0,00 / 0 cobranças**, recebidas **R$ 24,95 / 1 cobrança**, confirmadas/vencidas zeradas para o período/filtros exibidos. É compatível com a retirada da cobrança de R$ 49,90 dos pagamentos pendentes e preservação do pagamento anterior, mas não identifica `pay_3cuzqjn8kvzirv3k`, seu externalReference ou flag de exclusão. A consulta dessa identidade ainda é necessária para a prova remota dirigida; zero no agregado não basta sozinho.

Próxima ação orientada: `process-payments-once.ps1 -StatusOnly`, somente GET. Receber estado final da operação/filas antes de decidir sobre eventual trabalho READY do webhook. Ausência de novo e-mail de pagamento do #2 ainda não foi confirmada. Não repetir o processamento nem marcar replay/efeitos únicos como aprovados com base apenas nesta conferência.

### Supervisão recebida após o primeiro lote

Consulta de **2026-10-09T16:04:56.668Z** (**13:04:56.668 BRT**) enviada por Leno (Brega): SCOPE_VERIFIED, sandbox-hml, processingAttempted=false. **Uma operação CANCEL/COMPLETED**, inbox **2 COMPLETED**, outbox **4 COMPLETED + 1 READY**; uncertain/overdue/abandonedLeases/untrackedLegacyOrders **0**, oldestUnresolvedInboxAt null. Não há inbox pendente listada.

A operação concluída, em conjunto com o comando identificado e a conferência do pedido Cancelado, confirma progresso do caso; a consulta agregada não substitui a prova remota/fatos dirigidos. A fila que ainda contém trabalho é a outbox. `lib/commerce/order-command.ts` cria ORDER_STATUS_CHANGED na transição, e `payment-outbox.service.ts` só gera confirmação de pagamento para o destino PAID. A linha pronta é compatível com a mudança para CANCELLED, porém seu tipo/aggregateId não são expostos nesta supervisão.

**Orientado um segundo lote, uma vez**, pelo script existente **sem -StatusOnly**, para tratar o trabalho pronto observado. Isso não repete o comando do Console: o consumidor despacha somente operações READY, enquanto CANCEL está COMPLETED. O endpoint continua executando suas outras etapas globais; não assumir exclusividade por pedido. Receber o resumo real antes de marcar a fila concluída. Depois, conferir supervisão sem READY/retry/review e continuar prova da cobrança, ausência de e-mail e replay dirigido. Segundo lote ainda não informado.

O lote e as telas sozinhos não demonstram todas as linhas: operação, reserva, fatos e identidade exigem evidência dirigida. Não publicar dump/PII; quando necessário, preparar leitura com escopo no pedido e saída sanitizada. Cancelamento do pedido e saldos apresentados estão confirmados pelo operador; a auditoria completa do caso permanece aberta.

### Segundo lote recebido e consulta dirigida preparada

Leno (Brega) enviou o resumo do segundo lote: inbox **0 claimed/0 completed**, conciliação **0 claimed/0 completed**, outbox **1 claimed/1 completed**, todos os retried/review **0**. Expiração success=true, processedCount/cancelledCount/errorCount **0**, listas vazias, executionTimeMs **717**. A saída pronta foi concluída no lote; não houve nova conciliação. A contagem final global ainda depende de supervisão atual, sem presumir que nenhum webhook chegará depois.

Para a prova remota, preparado [L-04-CONFERIR_COBRANCA_PEDIDO_2.ps1](L-04-CONFERIR_COBRANCA_PEDIDO_2.ps1): entrada oculta da chave Sandbox, **um GET** no host Sandbox fixo, com ID conhecido, sem redirecionamentos, mutações ou consulta de QR. A [documentação oficial](https://docs.asaas.com/reference/recuperar-uma-unica-cobranca) descreve o GET por ID para conferência pontual. O script só indica CHARGE_DELETION_VERIFIED se HTTP 200, identidade/referência/método/valor correspondentes e `deleted` booleano true; 404, falha ou ausência da flag não são aceitos como prova. O critério de `deleted` também é utilizado pelo adapter local para classificar exclusão.

Executar no Terminal PowerShell: `./PACOTE_REVISAO_VANDERLEI/L-04-CONFERIR_COBRANCA_PEDIDO_2.ps1`. Enviar somente o JSON sanitizado. Chave Asaas fica apenas na entrada oculta, não no chat/arquivo. Depois conferir supervisão final, ausência de confirmação de pagamento para #2 e o replay dirigido. Nenhuma consulta remota desse script foi demonstrada na preparação.

**Validação local da consulta:** parser PowerShell aprovado e sete cenários com cmdlets simulados aprovados: exclusão/identidade comprovadas, deleted=false, flag ausente, referência diferente, falha de transporte, resposta ilegível e rejeição de chave com prefixo de produção antes do GET. Conferidos GET único, destino fixo, bloqueio de redirecionamento, ausência de processamento e saída sem chave/corpo privado. Nenhuma chamada externa ou leitura de `.env` nesta validação. Não substitui o resultado real do operador.

## 7. Próximas dependências

### Prova remota dirigida recebida

Leno (Brega) enviou o resultado de `L-04-CONFERIR_COBRANCA_PEDIDO_2.ps1`: **phase=charge_lookup**, **ok=true**, **code=CHARGE_DELETION_VERIFIED**, **httpStatus=200**, **lookupAttempted=true**, **processingAttempted=false**, **identityMatches=true**, **status=PENDING**, **deleted=true**. Identidades esperadas: pedido `e0bfe582-e85b-41e7-8b5c-d877b1e1a7e0`, cobrança `pay_3cuzqjn8kvzirv3k`, valor **R$ 49,90**. Pelo critério validado do script, o retorno corresponde também ao externalReference do pedido e ao método PIX.

Essa leitura comprova a exclusão da cobrança específica, superando a limitação do painel agregado. **PENDING com deleted=true não significa cobrança ativa neste caso**: `payment-evidence.service.ts` interpreta esse par como DELETED e produz a evidência de cancelamento. Estados financeiros de pagamento/estorno têm precedência no domínio; não generalizar exclusão como estorno de uma compra paga.

Próximo passo sem processamento: obter `process-payments-once.ps1 -StatusOnly` após o segundo lote, para a referência de filas/operacão antes do replay; confirmar ausência de e-mail de pagamento para #2 na caixa de entrada e spam. Espera-se outbox 5 COMPLETED e nenhuma READY, caso nenhum trabalho adicional tenha chegado; aceitar somente o estado efetivamente observado. O teste de repetição precisará de roteiro próprio, com **mesmos commandId/expectedVersion/operador**, porque o script original da primeira solicitação exige pedido PENDING e não deve ser reutilizado após CANCELLED. Replay e auditoria de fatos/reserva ainda não executados.

Leno (Brega) registra os resultados e coordena o pedido novo. Vanderlei (Que dá idéia errada) fornece o parecer e mantém o trabalho independente de UI/infraestrutura. Cancelamento externo aprovado ainda não encerra L-04: estorno integral, pagamento tardio, outros métodos, reversões parciais, políticas e infraestrutura candidata seguem no plano.

## 8. Referência final e replay planejado do comando

Supervisão recebida de Leno (Brega) em **2026-10-09T16:20:17.639Z** (**13:20:17.639 BRT**): SCOPE_VERIFIED/sandbox-hml, processingAttempted=false, **inbox 2 COMPLETED**, **outbox 5 COMPLETED**, **operação CANCEL 1 COMPLETED**, zero uncertain/overdue/abandonedLeases/untrackedLegacyOrders e oldestUnresolvedInboxAt null. Nenhum outro estado de fila listado. Esta é a referência agregada anterior ao replay, não um snapshot transacional das filas.

Preparado [script específico de replay](L-04-REPETIR_COMANDO_CANCELAMENTO_PEDIDO_2.js), distinto da solicitação inicial: GET do pedido já CANCELLED/DELETED, exatamente uma entrada de histórico CANCELLED; um POST com **commandId original e expectedVersion=0**; valida replay=true e os IDs de tentativa/operação COMPLETED já registrados; GET posterior compara versão, projeção financeira, itens, pontos do pedido e histórico sanitizado. Exige host fixo e usa a sessão do Admin atual, que deve ser o mesmo operador da primeira solicitação. O servidor identifica replay antes de comparar a versão atual, conforme `requestPaymentOperation`; não trocar a versão original pela versão atual.

Executar uma vez no Console do Admin, mantendo a janela isolada. Antes/depois, conferir e-mail de pagamento do #2 na entrada/spam (confirmação do operador ainda pendente nesta preparação). Enviar JSON do replay; depois obter somente `process-payments-once.ps1 -StatusOnly` e reconferir estoque geral 8 / Pequeno-Vermelho 4 / Médio-Azul 4, pontos 113 disponíveis / 0 pendentes / 4 movimentações. Não enviar lote automaticamente: efeito esperado do replay é devolver a operação existente, sem reabrir trabalho. O script não audita a carteira global, reservas ou FinancialFact; essas provas têm escopo próprio e não serão presumidas pela comparação do pedido. Nenhum replay externo demonstrado nesta preparação.

**Validação local do script de replay:** sintaxe JavaScript aprovada e oito cenários com transporte simulado aprovados: host incorreto, estado inicial inesperado, replay correto, conflito, resposta sem replay/identidade existente, mudança de versão posterior, histórico de cancelamento duplicado e perda da resposta. Conferidos o POST único com a identidade original, ausência de processamento de filas, interrupção sem repetição automática e saída sem dados pessoais. Nenhuma chamada externa nesta validação; o resultado real do operador permanece pendente.

### Conferência de e-mail recebida antes do replay

Em 09/10/2026, Leno (Brega) confirmou que não recebeu mensagem de pagamento confirmado para o pedido #2; recebeu apenas e-mail do Asaas informando cancelamento. Essa notificação do provedor é distinta da confirmação de pagamento enviada pela loja e não viola o critério de ausência de confirmação de pagamento deste pedido. Registro baseado no relato do operador, sem inspeção direta da caixa postal ou auditoria dos envios. A ausência está confirmada para este momento anterior ao replay; repetir a conferência após o teste. Replay, comparação posterior das filas e auditoria dirigida de reserva/fatos continuam pendentes; L-04 permanece aberto.

## 9. Replay do comando demonstrado no Preview

Em 09/10/2026, Leno (Brega) enviou o resultado real do script: **CANCEL_REPLAY_VERIFIED**, ok=true, phase=after_check, requestAttempted=true, processingAttempted=false, replayHttpStatus=202 e httpStatus=200 da leitura posterior. O servidor retornou **replay=true**, a tentativa original `587d9515-030f-474f-9edf-ee6d1d722086` e a mesma operação `41d09e96-3454-4522-a338-be7b768e281f`, **COMPLETED**, para o comando `l04-pix-cancel-pedido2-e0bfe582-v0` do pedido #2. Nenhuma execução de consumidor foi solicitada pelo script.

| Campo do pedido | Antes do replay | Depois do replay |
|---|---|---|
| Versão | 1 | 1 |
| Status | CANCELLED | CANCELLED |
| Estado da cobrança no pedido | DELETED | DELETED |
| Total de entradas de histórico | 1 | 1 |
| Entradas de cancelamento | 1 | 1 |

**orderUnchanged=true**: o script comparou também os campos selecionados de identidade, total, itens, pontos do pedido, paidAt e histórico. Isso demonstra reutilização da operação e preservação dessa projeção, sem criar outra transição de cancelamento. Não comprova sozinho ausência de novas filas ou linhas financeiras/reservas fora do GET.

**Próximo passo somente de conferência:** executar `./scripts/homologation/process-payments-once.ps1 -StatusOnly` e comparar com a referência anterior (inbox 2 COMPLETED, outbox 5 COMPLETED, CANCEL 1 COMPLETED, sem pendências). Reconferir estoque geral 8 / Pequeno-Vermelho 4 / Médio-Azul 4, pontos 113 disponíveis / 0 pendentes / 4 movimentações e ausência de novo e-mail de pagamento confirmado do #2, inclusive spam. Se houver divergência, investigar o estado existente antes de qualquer processamento. Auditoria dirigida de reserva/fatos e revisão independente continuam pendentes; não encerrar L-04 com o replay isolado.

### Supervisão recebida após o replay

Consulta enviada por Leno (Brega), de **2026-10-09T16:35:09.743Z** (**09/10/2026 às 13:35:09.743 BRT**): SCOPE_VERIFIED, schemaVersion=1, accountScope=sandbox-hml, processingAttempted=false. Permanecem **inbox 2 COMPLETED**, **outbox 5 COMPLETED** e **CANCEL 1 COMPLETED**, sem outros estados listados. uncertain, overdue, abandonedLeases e untrackedLegacyOrders permanecem **0**; oldestUnresolvedInboxAt permanece null.

As contagens/estados agregados são iguais à referência anterior ao replay de 13:20:17.639 BRT; nenhum aumento de filas ou trabalho pendente aparece nessas duas leituras. Com o replay=true e a identidade da operação preservada, a supervisão sustenta o resultado esperado da repetição. Não constitui auditoria de eventos transitórios entre consultas nem substitui a leitura dirigida dos registros internos. **Ainda aguardados após o replay:** conferência de estoque, pontos e ausência de novo e-mail de pagamento confirmado, além de auditoria dirigida de reserva/fatos e revisão independente. Nenhum novo lote de processamento orientado; L-04 permanece aberto.

## 10. Conferência posterior confirmada e auditoria interna preparada

Em 09/10/2026, após a orientação de conferir telas e e-mail, Leno (Brega) confirmou que está tudo correto: estoque geral **8**, Pequeno/Vermelho **4**, Médio/Azul **4**; pontos **113 disponíveis / 0 pendentes / 4 movimentações**; nenhuma nova confirmação de pagamento do pedido #2, inclusive spam. Registro por relato do operador, sem inspeção direta das plataformas pelo agente. Com a comparação das filas e do pedido já recebidas, os efeitos observáveis após replay permanecem na referência.

Próximo passo preparado: [guia de auditoria interna](L-04-GUIA_AUDITORIA_CANCELAMENTO_PEDIDO_2.md) e [consulta somente de leitura](L-04-AUDITAR_CANCELAMENTO_PEDIDO_2.sql). O operador seleciona no Neon o banco/branch usados pelo Preview e envia o JSON técnico da coluna evidence. A consulta expõe reserva, tentativa, cobrança, operação, fatos, histórico, restituição auditada, estoque, pontos e outbox do pedido, sem dados pessoais ou mutações. INTERNAL_STATE_READ não significa aprovação automática.

Validada contra o schema local e em PostgreSQL 17 descartável, sem rede, com dados sintéticos: oito cenários aprovados (ausência, caso esperado/saída sanitizada, tenant diferente, vínculo incorreto, reserva ausente, fato inesperado, e-mail inesperado e conta diferente). Container removido; nenhuma leitura do Neon ou de segredos nessa validação. **Leitura real dos registros internos e revisão independente ainda pendentes.** L-04 aberto, sem novo lote de processamento orientado.

## 11. Leitura interna recebida e aceite deste cenário

Em 09/10/2026, Leno (Brega) enviou o resultado real da consulta, com INTERNAL_STATE_READ e processingAttempted=false. Conferidos pedido, tentativa, cobrança e operação originais; uma reserva RELEASED/versão 1/quantidade 1/itemMatches=true; um fato CANCELLED de 49,90 na mesma cobrança; um histórico PENDING → CANCELLED/versão 1 e uma restituição auditada para AVAILABLE. Estoque 8/4/4, indisponíveis zero; carteira 113/0/612, quatro movimentos globais e zero ligados ao #2. Outbox dirigida contém somente CHECKOUT_COMMITTED e ORDER_STATUS_CHANGED, ambas uma vez/COMPLETED. Nenhum pagamento, liquidação, estorno ou confirmação de pagamento indevidos apareceu nesses registros.

**Cancelamento PIX ainda não pago e replay aprovados neste ensaio Sandbox.** O [resultado consolidado](L-04-RESULTADO_CANCELAMENTO_PIX_PEDIDO_2.md) preserva identidades, evidências e limites. Parecer independente ainda pendente; este aceite não encerra L-04 ou libera produção. Próxima preparação prevista: estorno integral de um PIX novo pago e ainda não expedido, preservando #1/#2 e coordenando revisão/janela antes de novas mutações. Não ampliar automaticamente a exceção de revisão concedida apenas para o cancelamento.

**Preparação seguinte de 09/10/2026:** [roteiro de estorno integral PIX antes da expedição](L-04-ROTEIRO_ESTORNO_INTEGRAL_PIX_SANDBOX.md) preparado após Leno (Brega) pedir seguimento. Leno (Brega) informou que o parecer ainda não foi enviado. Orientada reconferência do Preview, supervisão -StatusOnly, referências e saldo Sandbox; nenhuma nova compra/pagamento/REFUND foi demonstrada. As identidades e os scripts específicos serão definidos somente com o pedido real identificado.
