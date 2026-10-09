# L-04 — Estorno integral de PIX pago, antes da expedição

**Preparação:** 09/10/2026. **Operador/responsável:** Leno (Brega). **Revisor independente:** Vanderlei (Que dá idéia errada).

**Estado atual:** Leno (Brega) autorizou explicitamente em 09/10/2026 iniciar este ensaio no Sandbox antes do parecer de Vanderlei (Que dá idéia errada), conforme seção 9. Pedido #3 Pago, ganho de 24 pontos e confirmação da loja recebidos. Histórico remoto mostrou exatamente um estorno de 49,90 CANCELLED, nenhum valor DONE e cobrança RECEIVED. Nova leitura interna em 09/10/2026 às 20:27:40 UTC confirmou operação PENDING e tentativa REFUND_PENDING inalteradas, conforme seção 29. Tratamento local dessa divergência implementado na primeira etapa autorizada, conforme seção 30, junto ao patch anterior de agendamento; publicação e validação no Preview ainda pendentes. Motivo do cancelamento remoto permanece desconhecido; preservar a operação original. Estorno concluído e compensações reais ainda não comprovados; parecer independente e gates de produção continuam pendentes.

## 1. Objetivo e referências preservadas

Demonstrar que uma cobrança PIX recebida pode ser estornada integralmente pelo comando durável da aplicação, com identidade, prova remota e compensações locais únicas. O produto permanece fisicamente na loja: não expedir, entregar ou confirmar retirada durante este ensaio. Devolução após entrega, valor parcial e pagamento tardio são casos distintos.

- Preservar o pedido #1 pago como referência positiva e o [pedido #2 cancelado e auditado](L-04-RESULTADO_CANCELAMENTO_PIX_PEDIDO_2.md).
- Criar um pedido novo apenas na etapa coordenada. Não presumir seu número, UUID ou ID Asaas; pode ser #3, mas o número depende do estado real.
- Escolha proposta: uma unidade de Aspirador de Pó automotivo, **Pequeno/Vermelho**, retirada no balcão, **PIX com cobrança dinâmica Asaas**, sem resgate de pontos e sem cupom. Aqui o termo PIX refere-se à cobrança do checkout; não é o produto de recorrência Pix Automático do provedor.
- Referência recebida após o cancelamento: geral **8**, Pequeno/Vermelho **4**, Médio/Azul **4**; carteira **113 disponíveis**, **0 pendentes**, **612 acumulados**, **4 movimentações**. Reconferir antes da compra; esses valores não são uma consulta atual automática.
- IDs de catálogo já conferidos: produto `a26fdbc1-d8c3-4173-b114-f759654b9ca4`, Pequeno/Vermelho `c9422a68-9be8-4fdc-bc5f-5ee7689401d2`, Médio/Azul `d392d80a-43ec-46b3-99ed-9905f45c204d`. Confirmar que a seleção ainda corresponde aos mesmos IDs.

## 2. Preparação e leitura inicial — etapa imediata

Esta etapa não cria cobrança, não confirma pagamento nem solicita estorno.

1. Conferir no painel Vercel o Preview **Ready**, commit e deployment atuais. A referência do ensaio anterior era `ede9cc2868c844393d9fab76a00fd3d6db9afdc5`; não presumir que o alias continua servindo essa revisão após o trabalho do colega.
2. Executar na raiz do projeto:

   ```powershell
   .\scripts\homologation\process-payments-once.ps1 -StatusOnly
   ```

3. Enviar somente o JSON sanitizado e reconferir estoque/pontos. Esperar SCOPE_VERIFIED/sandbox-hml, processingAttempted=false e analisar pendências reais. A última referência era inbox 2 COMPLETED, outbox 5 COMPLETED e CANCEL 1 COMPLETED, sem pendências. Contagens diferentes não são falha automática; identificar sua origem antes de um lote.
4. Conferir que a conta Asaas continua no Sandbox e registrar o saldo disponível atual para planejar o estorno. A suficiência do saldo será exigida imediatamente antes do REFUND, depois do recebimento simulado, que pode aumentar esse saldo; não exigir antecipadamente o valor integral como condição para a compra. Não enviar credenciais ou extrato completo. O valor esperado pela compra, se catálogo/frete/desconto permanecerem iguais, é R$ 49,90.
5. Registrar o parecer da revisão quando recebido e coordenar a nova janela com um operador. Até essa definição, avançar nas leituras e preparação; criação, simulação de recebimento e REFUND permanecem etapas futuras. Se Leno (Brega) decidir adiar a revisão também neste caso, registrar essa decisão específica e seus limites antes da mutação, sem apresentá-la como parecer aprovado.

O script existente solicita CRON_SECRET e bypass em entrada oculta. Não usa a chave Asaas; não colar segredos no chat. Não retirar `-StatusOnly` nesta etapa.

## 3. Contrato atual conferido no código

Releitura de `services/payment/payment-operations.service.ts`, `payment-worker.service.ts`, `payment-evidence.service.ts`, `services/asaas/asaas.client.ts`, `lib/commerce/order-command.ts`, `services/loyalty.service.ts`, `lib/commerce/loyalty-ledger.ts` e `payment-outbox.service.ts`:

- `POST /api/admin/orders/<UUID>/payment-operation` recebe `{ kind: 'REFUND', commandId, expectedVersion }`, com Admin ativo, tenant e conta conferidos pelo servidor. Para este caso, exige pedido PAID, tentativa APPROVED e cobrança recebida; a API também aceita outros caminhos que não serão utilizados aqui.
- O comando cria operação READY e altera a tentativa para REFUND_PENDING. Não conclui o estorno, não cancela o pedido e não devolve estoque/pontos pela mera solicitação.
- O consumidor consulta o provedor, persiste SUBMITTING antes do I/O e envia o valor integral da cobrança conhecida a `/payments/<id>/refund`. Resposta perdida conserva UNKNOWN; operações incertas não são despachadas novamente só porque o transporte falhou.
- Prova REFUNDED na inspeção produz fato REFUNDED, conclui a operação e a tentativa e aplica a transição PAID → CANCELLED. Uma reserva COMMITTED passa a **RETURNED**, não RELEASED. O estoque ainda na loja é restituído uma vez.
- O ganho EARN é compensado por REFUND_EARN com identidade do lançamento original. O código conserva a regra de lifetimeEarn como ganhos menos ganhos revogados. Sem uso/expiração/interferência, os saldos voltam à referência anterior.
- O e-mail de pagamento é legítimo neste caso: deve ser concluído antes de solicitar o estorno. Não esperar ausência de e-mail como no pedido #2. O código conferido não cria um tipo próprio de e-mail de estorno da loja; notificações do Asaas são registradas separadamente.
- O replay usa os mesmos operador, commandId e **expectedVersion original**, mesmo após a versão do pedido mudar. O servidor identifica a operação existente antes da comparação da versão atual.

Nenhum código da aplicação ou migration foi alterado nesta preparação. Os casos locais de estorno e recuperação já integram a seleção registrada de 90 testes; não foram reexecutados só para escrever este roteiro. Isso não substitui o contrato externo da conta ou sua revisão.

## 4. Condições específicas do Asaas

Fontes oficiais consultadas em 09/10/2026:

- [Estornar cobrança](https://docs.asaas.com/reference/estornar-cobranca): PIX recebido admite estorno; o endpoint aceita `value`. Tarifas podem reduzir o saldo disponível, causando erro de saldo insuficiente no estorno integral. Conferir saldo antes de despachar; não reduzir o valor para fazer um teste integral passar.
- [Adicionar saldo no Sandbox](https://docs.asaas.com/docs/como-adicionar-dinheiro-para-testes): a interface permite simular a confirmação de uma cobrança PIX de teste, disponibilizando saldo sem movimentar dinheiro real. Se for preciso saldo adicional, identificar uma cobrança separada para esse fim e coordenar sua criação; não alterar pedidos preservados.
- [Eventos de cobrança](https://docs.asaas.com/docs/webhook-para-cobrancas): PAYMENT_RECEIVED informa recebimento; PAYMENT_REFUND_IN_PROGRESS é processamento; PAYMENT_REFUNDED informa estorno. Não tomar progresso ou HTTP 200 isolado como prova final.

A disponibilidade geral no Sandbox não garante sucesso da conta específica. Não simular recebimento em dinheiro ou alterar o banco da aplicação para forçar PAID: isso não demonstra o caminho PIX pretendido. Não usar aplicativo bancário real para pagar este QR de homologação.

Se o provedor devolver estado em processamento, falha de saldo, timeout ou resposta inconclusiva, preservar reserva/estado e consultar a cobrança específica antes de decidir outra ação. Não estornar diretamente no painel/API Asaas durante o teste do produtor da aplicação: isso contornaria justamente o fluxo que será homologado.

## 5. Etapas futuras da janela coordenada

### A. Criar e identificar o pedido novo

Após a coordenação da janela e revisão/decisão específica, criar a compra descrita na seção 1. Conferir UUID, número, tenant, item/IDs, total, PIX, pointsRedeemed=0, cobrança única e estado PENDING. Registrar QR existente sem compartilhar payload/imagem desnecessários. Estoque esperado, se referência preservada: geral 7, Pequeno/Vermelho 3, Médio/Azul 4; pontos continuam na referência, sem EARN.

O agente preparará a leitura sanitizada com o UUID efetivamente recebido. Não reutilizar scripts fixos do pedido #2 nem preencher dados fictícios como se fossem identidade real.

### B. Demonstrar pagamento e seus efeitos antes do estorno

Na cobrança específica do Sandbox, simular o recebimento pelo controle de teste apropriado. Conferir ID, externalReference, PIX, valor e **RECEIVED**. A mera mudança de tela ou entrada de webhook não comprova a aplicação local.

Consultar supervisão e decidir processamento por etapa, usando o script existente sem `-StatusOnly` apenas quando orientado para trabalho identificado. `limit=1` é por etapa, não seleciona exclusivamente este pedido; consumidores globais podem incluir trabalho de outros pedidos. Receber cada resultado e fazer nova leitura antes de outro lote.

Demonstrar pedido **PAID**, tentativa **APPROVED**, reserva **COMMITTED**, fatos AUTHORIZED e SETTLED corretos, um crédito EARN e **uma confirmação de pagamento entregue**. Concluir a outbox correspondente antes de solicitar REFUND. Não usar nem resgatar o ganho e não fazer outras compras/ajustes na carteira durante o ensaio.

Definir **Q** pelo snapshot congelado e pelo crédito efetivamente aplicado, não pelos 12 pontos do pedido #1. Se ganho elegível >0, referência esperada após pagamento: balance=113+Q, pending=0, lifetimeEarn=612+Q, cinco movimentações. Se a política atual produzir Q=0, registrar esse fato e a limitação: o cenário não terá demonstrado compensação de um ganho positivo. Não mudar configuração para fabricar Q.

### C. Solicitar o estorno pela aplicação

Após demonstrar B, ler novamente o pedido, saldo Asaas suficiente e supervisão. Exigir pedido PAID, sem expedição/entrega/retirada confirmada, tentativa APPROVED e cobrança RECEIVED do valor integral. Capturar a versão atual real e conservar o mesmo operador.

Preparar então um script específico do pedido com identidade fixa, pré-checagens, um POST REFUND e saída sanitizada. O commandId será definido uma vez com base no UUID/versão reais; não há comando executável de mutação neste roteiro. O retorno esperado é 202/replay=false, tentativa original e uma operação REFUND/READY. Persistir esses IDs antes de processar.

Após solicitação e antes da prova remota, não aceitar devolução antecipada de estoque ou pontos. A tentativa deve indicar REFUND_PENDING e a operação pronta/encaminhada conforme a etapa; o pedido ainda pode estar PAID. Nenhum seletor genérico de status deve ser usado como atalho.

### D. Consumir, comprovar e auditar

Consultar estado e orientar um lote por vez. Depois consultar a cobrança específica no Sandbox: identidade/valor/PIX correspondentes e estado final REFUNDED; quando fornecidos, conferir os registros de devolução e sua conclusão. HTTP da solicitação e resumo do lote não bastam. Não aceitar DELETED como prova de estorno de dinheiro recebido.

Preparar leitura interna dirigida aos IDs reais, contemplando pedido/tentativa/cobrança/operação, reserva, fatos, histórico/auditoria, lançamentos/lotes de fidelidade e outbox. Ampliar a consulta do caso anterior: RETURNED e REFUNDED são estados distintos de RELEASED e CANCELLED, e este pedido deve ter movimentos de ganho/compensação.

| Bloco | Critério deste cenário, sem interferência |
|---|---|
| Pedido | CANCELLED; versão 2 se houve somente aprovação e cancelamento; asaasPaymentStatus=REFUNDED. |
| Metadados do pagamento | paidAt permanece como registro do pagamento anterior; pointsCredited pode preservar Q. Não exigir null/zero como no pedido nunca pago. |
| Tentativa / operação | REFUNDED; uma REFUND/COMPLETED, IDs preservados, sem erro pendente. |
| Reserva | Uma RETURNED, quantidade 1, versão 2 se somente RESERVED → COMMITTED → RETURNED; releasedAt preenchido; vínculos corretos. |
| Fatos | AUTHORIZED e SETTLED anteriores preservados; um REFUNDED integral de 49,90 na mesma cobrança; não fabricar fato CANCELLED ou apagar os pagamentos. |
| Histórico / auditoria | PENDING → PAID e PAID → CANCELLED, cada uma única; uma restituição de estoque para AVAILABLE. |
| Estoque | Volta ao geral 8 / Pequeno-Vermelho 4 / Médio-Azul 4, uma vez, se catálogo/referência preservados. |
| Pontos com Q positivo | Um EARN +Q e um REFUND_EARN −Q do mesmo pedido; saldo 113, pending=0, lifetimeEarn=612, seis movimentações globais; lotes/allocations conservados e sem dívida nova. |
| Outbox do pedido | Uma CHECKOUT_COMMITTED, duas ORDER_STATUS_CHANGED e uma PAYMENT_CONFIRMATION_EMAIL concluídas, sem revisão pendente. Conferir tipos/identidades reais; contagem global não tem total fixo garantido. |
| E-mail | Uma confirmação legítima do pagamento anterior, sem duplicata da loja causada pelo estorno ou replay; avisos do Asaas separados. |

Não manter os valores absolutos como aprovados se houver expiracão de lotes, uso de pontos, mudança de catálogo ou outra operação concorrente: investigar e registrar a condição real. Uma compensação que exija dívida/retorno físico pertence a um cenário distinto.

### E. Repetição controlada e conclusão

Com operação concluída, registros e referências conferidos, preparar replay específico preservando commandId, expectedVersion e operador originais. Esperar replay=true e mesma operação, sem nova solicitação remota demonstrada pelo produtor ou novos efeitos. Conferir pedido/histórico/fatos/lotes, estoque/pontos, e-mail e supervisão antes/depois, sem enviar lote por rotina.

Repetição de webhook e eventos antigos exige janela/identidade próprias e distinção entre evento real e sintético. Não afirmar que replay de comando certifica todas essas condições.

Leno (Brega) registra o resultado real e os limites; Vanderlei (Que dá idéia errada) fornece o parecer independente e verifica a apresentação dos estados na sua frente. Só apresentar este cenário como aprovado após as provas de A–E. L-04, demais cenários e gates de produção continuam abertos.

## 6. Campos a preencher com evidências reais

| Campo | Estado nesta preparação |
|---|---|
| Parecer de Vanderlei (Que dá idéia errada) | Ainda não recebido. |
| Decisão específica para a nova janela | Leno (Brega) respondeu “Sim” à pergunta sobre iniciar este ensaio antes do parecer de Vanderlei, em 09/10/2026. Escopo e limites na seção 9. |
| Commit/deployment atuais do Preview | Leno (Brega) confirmou Preview Ready no commit ede9cc2 por imagem em 09/10/2026; ID específico do deployment não informado. |
| Status atual das filas e baseline imediatamente anterior | Supervisão recebida às 14:02:03.652 BRT, conforme seção 7; depois, operador confirmou estoque geral 8, Pequeno/Vermelho 4, Médio/Azul 4 e carteira com 113 disponíveis, 0 pendentes e 4 movimentações, conforme seção 8. |
| Saldo Sandbox suficiente para estorno integral | A conferir pelo operador antes do REFUND, após simular o recebimento. |
| Número/UUID/AsaasPaymentId do novo pedido | #3 / 5b5bef57-2fd2-4f88-83fd-bf3d76238c40 / pay_cra35xq1ltkb6oka. GET de detalhe PENDING/versão 0 recebido, conforme seção 11. |
| Q e ganho/lote original | Painel mostra crédito novo +24, saldo 137, pending 0, lifetimeEarn 636 e cinco movimentações; Q observado=24. Vínculo do EARN/lote ao #3 e política congelada ainda a conferir internamente, conforme seção 17. |
| Versão/commandId/attemptId/operationId do REFUND | Versão original 1; commandId l04-pix-refund-pedido3-5b5bef57-v1; attemptId 03422a6b-8223-41eb-9240-089c6dd9cf22; operationId 895e8eec-8052-49ae-86b8-f35812003b7e. POST 202/replay=false/REFUND READY recebido, conforme seção 21. |
| Prova remota REFUNDED e auditoria interna | Não executadas. |
| Replay e referência posterior | Não executados. |

## 7. Supervisão inicial recebida

Leno (Brega) enviou em 09/10/2026 o resultado de **2026-10-09T17:02:03.652Z**, correspondente a **14:02:03.652 BRT**: SCOPE_VERIFIED, ok=true, schemaVersion=1, accountScope=sandbox-hml e processingAttempted=false.

| Indicador | Resultado observado |
|---|---|
| Inbox | 2 COMPLETED; nenhum outro estado listado. |
| Outbox | 5 COMPLETED; nenhum outro estado listado. |
| Operações | Uma CANCEL/COMPLETED do caso anterior; nenhum REFUND listado. |
| uncertain / overdue / abandonedLeases / untrackedLegacyOrders | 0 / 0 / 0 / 0. |
| oldestUnresolvedInboxAt | null. |

A referência de filas permanece igual à última conferência do cancelamento. Não há trabalho pendente listado que justifique enviar outro lote neste momento. A consulta não informa commit/deployment, estoque, carteira, saldo Asaas ou parecer independente; não comprova criação/pagamento/estorno do novo pedido. A coleta complementar de Preview e referências foi recebida posteriormente, conforme seção 8. Parecer independente continua pendente segundo a resposta mais recente do operador; decisão específica da nova janela ainda não registrada.

## 8. Preview e referências reconfirmados pelo operador

Em 09/10/2026, após a supervisão da seção 7, Leno (Brega) enviou imagem com **Preview Ready no commit ede9cc2** e confirmou **estoque geral 8, Pequeno/Vermelho 4, Médio/Azul 4**, além de **113 pontos disponíveis, 0 pendentes e 4 movimentações**. O horário exato dessa confirmação não foi informado. O total lifetimeEarn=612 permanece como referência da auditoria anterior; não foi novamente informado nesta confirmação.

As referências estão preservadas e a preparação do cenário está concluída. Neste checkpoint ainda faltava a decisão específica de executar sem o parecer; a resposta posterior está registrada na seção 9. A conferência, por si só, não ampliou a exceção do cancelamento do pedido #2. Nenhum recebimento, REFUND ou processamento do novo cenário foi demonstrado. Não há necessidade de outro lote pelos estados de filas já recebidos.

## 9. Decisão específica e início do ensaio

Em 09/10/2026, à pergunta “Você quer iniciar esse ensaio antes do parecer de Vanderlei?”, Leno (Brega) respondeu **“Sim”**. A autorização abrange este ensaio de **pagamento simulado e estorno integral de um pedido PIX novo no Sandbox, antes de expedição/entrega**, incluindo as conferências e repetição controlada descritas neste roteiro. Não exige nova autorização a cada etapa já abrangida; exige analisar os resultados reais antes de orientar a etapa seguinte.

Leno (Brega) mantém a operação da janela financeira. Evitar mudanças no Preview, processamento concorrente, outras compras ou ajustes de estoque/pontos durante o ensaio; coordenação com Vanderlei (Que dá idéia errada) continua conforme o plano. Preservar os pedidos #1 e #2. Parecer independente, demais cenários de L-04 e gates de produção continuam pendentes.

**Orientação inicial:** criar uma compra no mesmo Preview homologado com uma unidade de Aspirador de Pó automotivo, Pequeno/Vermelho, retirada no balcão, PIX dinâmico, sem pontos ou cupom, total esperado de R$ 49,90. Após criação, enviar número, UUID, ID da cobrança Asaas e total, sem dados pessoais ou credenciais. Conferir PENDING/Aguardando pagamento, estoque geral 7 / Pequeno-Vermelho 3 / Médio-Azul 4 e pontos 113 disponíveis / 0 pendentes / 4 movimentações. Se valores ou estados divergirem, analisar antes de simular o recebimento. Não assumir que o próximo número será #3.

Nesta primeira etapa, somente criar e identificar o pedido. A simulação de recebimento e o REFUND serão orientados após as respectivas provas; não pagar o QR com dinheiro real nem usar o painel Asaas para contornar o comando de estorno da aplicação.

## 10. Criação do pedido #3 e referências posteriores

Em 09/10/2026, Leno (Brega) enviou imagem do **pedido #3**, **Aguardando pagamento**, **PIX**, **R$ 49,90**, **retirada no balcão**, com instruções de pagamento presentes. O operador confirmou **estoque geral 7 / Pequeno-Vermelho 3 / Médio-Azul 4**, além de **113 pontos disponíveis / 0 pendentes / 4 movimentações**. Horário exato da confirmação não informado. A diferença de estoque é compatível com a reserva da unidade pretendida; a reserva e seus vínculos internos ainda não foram consultados neste caso.

**Próxima leitura:** no Admin autenticado do mesmo Preview, abrir DevTools → Rede → Fetch/XHR antes de abrir os detalhes do pedido #3. Selecionar o GET `/api/admin/orders/<UUID>` e, em Resposta, enviar somente `data.id`, `data.orderNumber`, `data.lojaID`, `data.version`, `data.status`, `data.paymentMethod`, `data.asaasPaymentId`, `data.asaasPaymentStatus`, `data.total` e `data.pointsRedeemed`. Não enviar a resposta inteira com dados pessoais nem cabeçalhos/cookies. Se o pedido já estava aberto, fechar e reabrir para capturar a leitura.

O endpoint e a leitura feita pelo componente OrderDetailDrawer foram conferidos no código. Essa leitura não altera dados. Identidade remota, vínculos do item, recebimento, fatos, ganho e estorno ainda não demonstrados. Não simular recebimento nem processar filas até analisar essa identidade; não reutilizar os scripts fixos do pedido #2.

## 11. Identidade local do pedido #3 recebida

Texto do GET de detalhe enviado por Leno (Brega), em 09/10/2026, conferido apenas nos campos técnicos; dados pessoais não reproduzidos neste material.

| Campo | Valor observado |
|---|---|
| Pedido / UUID | #3 / 5b5bef57-2fd2-4f88-83fd-bf3d76238c40. |
| Tenant | 3a82b33c-3646-4272-9a89-80bb1ba327a5. |
| Versão / estado | 0 / PENDING. |
| Método / cobrança / estado Asaas local | PIX / pay_cra35xq1ltkb6oka / PENDING. |
| Total / frete | 49,90 / 0. |
| pointsRedeemed / pointsCredited / paidAt | 0 / 0 / null. |
| Item | e385cec8-1c96-47da-88fa-b9c3950a0302; uma unidade Pequeno/Vermelho; preço 49,90. |
| Históricos retornados | Nenhum. |
| createdAt | 2026-10-09T17:17:15.766Z, correspondente a 14:17:15.766 BRT. |

Identidade e projeção local compatíveis com o caso pretendido. O trecho recebido não fornece IDs de produto/variante nem prova direta dos registros de tentativa, reserva ou provedor; não inferir esses vínculos só pelo nome/cor. Os IDs de catálogo da seção 1 permanecem referências a verificar na auditoria interna.

**Etapa orientada:** no Asaas Sandbox, localizar exatamente `pay_cra35xq1ltkb6oka`, conferir PIX, valor 49,90, pendente e correspondência ao pedido #3; quando exposta, externalReference deve ser `5b5bef57-2fd2-4f88-83fd-bf3d76238c40`. Simular o pagamento pela opção de confirmação de teste do Sandbox, conforme [guia oficial](https://docs.asaas.com/docs/como-adicionar-dinheiro-para-testes), reconferido em 09/10/2026. Não usar recebimento em dinheiro nem pagamento bancário real. Se a identidade/valor/estado divergirem ou a opção de simulação não estiver disponível, enviar a condição observada antes de escolher outro caminho.

Depois da simulação, enviar estado da cobrança e JSON de `process-payments-once.ps1 -StatusOnly`. Essa consulta continua somente de leitura; um webhook aceito ou estado remoto recebido ainda não comprova os efeitos locais. Não solicitar REFUND antes de demonstrar PAID, crédito/ganho real e confirmação legítima de pagamento entregue; orientar consumidores por resultado real, sem repetição automática.

## 12. Supervisão recebida após identificação do pedido #3

Leno (Brega) enviou o resultado de **2026-10-09T17:53:27.156Z**, correspondente a **14:53:27.156 BRT**, em 09/10/2026: SCOPE_VERIFIED, ok=true, accountScope=sandbox-hml, schemaVersion=1 e processingAttempted=false.

| Indicador | Resultado observado |
|---|---|
| Inbox | 2 COMPLETED; mesma contagem da referência anterior, nenhum novo evento listado. |
| Outbox | 5 COMPLETED + 1 READY. |
| Operações | Uma CANCEL/COMPLETED; nenhum REFUND listado. |
| uncertain / overdue / abandonedLeases / untrackedLegacyOrders | 0 / 0 / 0 / 0. |
| oldestUnresolvedInboxAt | null. |

A saída READY é compatível com a criação do novo pedido, mas a supervisão não fornece tipo ou aggregateId; não afirmar que seja CHECKOUT_COMMITTED nem confirmação de pagamento sem leitura dirigida. Não foi enviado junto deste resultado o estado remoto da cobrança `pay_cra35xq1ltkb6oka`, nem confirmação explícita da simulação. A inbox inalterada não comprova recebimento, falha de webhook ou ausência de pagamento no provedor.

**Esclarecimento posterior do operador:** Leno (Brega) informou que ainda não havia executado a confirmação de teste quando fez essa consulta. Portanto, este checkpoint antecede a simulação; não registrar a ausência de novo evento como falha de webhook.

**Próxima informação necessária:** confirmar se a simulação foi executada na cobrança exata e qual seu estado atual no Sandbox. Se ainda PENDING, seguir a etapa de confirmação de teste; se RECEIVED, conferir o evento/webhook e os vínculos antes de orientar consumidores. Não reenviar simulação se já recebida, não retirar -StatusOnly nem solicitar REFUND somente com este resumo. L-04 e este cenário continuam abertos.

## 13. Confirmação de teste realizada pelo operador

Em 09/10/2026, Leno (Brega) informou ter confirmado o pagamento e enviou imagem do Asaas com marca SBOX/Ações de Sandbox, mensagem “Cobrança confirmada com sucesso”, situação **Recebida**, valor pago **49,90**, forma **Pix** e saldo em conta **72,87**. Datas mostradas: criação e recebimento em 09/10/2026, vencimento em 10/10/2026. Horário exato da ação não informado. O ID da cobrança não aparece no recorte; correspondência a `pay_cra35xq1ltkb6oka` está no relato contextual do operador, ainda sem nova consulta remota dirigida.

O saldo exibido supera o estorno integral pretendido de 49,90 nesse momento; reconferir sua disponibilidade imediatamente antes do REFUND. O operador informou que executará `process-payments-once.ps1 -StatusOnly`; o resultado posterior ainda não foi recebido. Não há prova de ingestão do evento, PAID local, ganho de pontos ou confirmação de pagamento entregue neste checkpoint.

Manter apenas a consulta de supervisão até analisar o retorno. Os controles “Estornar cobrança” e “Solicitar estorno” aparecem no painel, mas não são o produtor que este ensaio pretende homologar: o estorno será solicitado pelo comando durável da aplicação depois das provas de pagamento e e-mail. Não acionar esses controles do Asaas durante este caso.

## 14. Evento pronto e primeiro lote orientado

Supervisão enviada por Leno (Brega) em **2026-10-09T18:10:30.604Z**, correspondente a **15:10:30.604 BRT**, em 09/10/2026: SCOPE_VERIFIED/sandbox-hml, schemaVersion=1, processingAttempted=false.

| Indicador | Resultado observado |
|---|---|
| Inbox | 2 COMPLETED + 1 READY. |
| Outbox | 5 COMPLETED + 1 READY. |
| Operações | Uma CANCEL/COMPLETED; nenhum REFUND listado. |
| uncertain / overdue / abandonedLeases / untrackedLegacyOrders | 0 / 0 / 0 / 0. |
| oldestUnresolvedInboxAt | 2026-10-09T18:08:49.938Z. |

Há um novo evento pronto após a confirmação de teste relatada, compatível com o recebimento do #3; o resumo agregado ainda não fornece eventType ou paymentId. A saída READY já existia antes da simulação, sem tipo ou vínculo comprovado por esta supervisão. Não classificar essa saída como e-mail de pagamento apenas pela contagem.

**Orientado um único lote**, na janela de Leno (Brega), pelo script existente **sem -StatusOnly**: `.\scripts\homologation\process-payments-once.ps1`. O script confere novamente o escopo e envia uma vez POST `/api/cron/payments?limit=1`. Código conferido: executa inbox, conciliação, expiração conforme configuração e outbox nessa ordem; o limite vale por etapa, não isola um pedido. Sem alteração de configuração ou despacho de REFUND. Nenhum lote foi executado pelo agente; aguardar o resultado do operador.

Depois do retorno, analisar completed/retried/review e qualquer erro, conferir pedido #3, estoque, ganho real e supervisão antes de orientar outro lote. Outbox limitada a um item pode exigir etapas posteriores para status/e-mail, mesmo se o pedido já passar a PAID. Não reenviar simulação nem repetir lote automaticamente em timeout; consultar estado existente. O recebimento remoto, efeitos internos e e-mail serão comprovados antes do REFUND. L-04 continua aberto.

## 15. Primeiro lote concluído e conferência dos efeitos

Resultado enviado por Leno (Brega) em 09/10/2026, sem timestamp próprio no JSON:

| Etapa | Resultado observado |
|---|---|
| Inbox | claimed=1, completed=1, retried=0, review=0. |
| Conciliação | claimed=0, completed=0, retried=0, review=0. |
| Expiração | success=true; processedCount=0, cancelledCount=0, errorCount=0; listas vazias; executionTimeMs=586. |
| Outbox | claimed=1, completed=1, retried=0, review=0. |

Lote concluído sem falha reportada. Resumo não identifica evento/pedido/tipo de saída nem comprova entrega de e-mail; não encerrar o pagamento ou atribuir a conclusão da saída a PAYMENT_CONFIRMATION_EMAIL com base nesses contadores. Ganho Q permanece a observar, sem fixar 12 ou 24 pontos antecipadamente.

**Próxima etapa orientada:** executar -StatusOnly e enviar o JSON; conferir no Admin pedido #3 Pago, estoque geral 7 / Pequeno-Vermelho 3 / Médio-Azul 4, carteira com saldo disponível, pendentes, quantidade de movimentações e valor do crédito deste pedido. Conferir também a confirmação de pagamento da loja para o #3, inclusive spam, distinguindo avisos Asaas. Se Q positivo e referência preservada, esperar cinco movimentações e saldo 113+Q. A saída de checkout anterior e novas saídas de status/e-mail podem exigir novos lotes, a decidir somente após a consulta. Nenhum novo lote ou REFUND orientado neste checkpoint.

## 16. Duas saídas prontas após o primeiro lote

Supervisão recebida de Leno (Brega) em **2026-10-09T18:17:50.925Z**, correspondente a **15:17:50.925 BRT**, em 09/10/2026: SCOPE_VERIFIED/sandbox-hml, schemaVersion=1, processingAttempted=false; **inbox 3 COMPLETED**, **outbox 6 COMPLETED + 2 READY**, uma CANCEL/COMPLETED; uncertain, overdue, abandonedLeases e untrackedLegacyOrders todos zero; oldestUnresolvedInboxAt=null.

Contagens compatíveis com a conclusão do evento e da saída anteriores e a criação de duas novas saídas. O resumo não informa seus commandTypes ou aggregateIds; status e e-mail são hipótese compatível com o caminho de pagamento, não prova dirigida. Confirmações de PAID, estoque, ganho Q e entrega de e-mail ainda não foram recebidas neste checkpoint.

**Orientado o segundo lote, uma única vez**, pelo script sem -StatusOnly, na mesma janela de Leno (Brega). O consumidor continua limitado a um item de outbox; não enviar automaticamente dois lotes nem elevar o limite. Aguardar JSON antes da próxima decisão. Nenhum REFUND solicitado ou orientado. Conferências do pedido #3/estoque/pontos/e-mail permanecem necessárias antes do estorno; L-04 aberto.

## 17. Segundo lote e ganho observado no painel

Em 09/10/2026, Leno (Brega) enviou o resultado do segundo lote e confirmou estoque geral **7**, Pequeno/Vermelho **3**, Médio/Azul **4**. Não recebeu confirmação de pagamento da loja para o #3, inclusive spam; recebeu somente aviso do Asaas sobre atualização de status.

| Etapa | Resultado observado |
|---|---|
| Inbox / conciliação | Todos os contadores zero. |
| Expiração | success=true; processedCount=0, cancelledCount=0, errorCount=0; listas vazias; executionTimeMs=711. |
| Outbox | claimed=1, completed=1, retried=0, review=0. |

Imagem da carteira mostra **137 disponíveis**, **0 pendentes**, **636 acumulados** e **5 registros**; um novo lançamento de ganho **+24 pontos**, equivalente a 1,20, exibido em 09/10/2026 às 15:15, com saldo restante 137. Ganho observado **Q=24**, coerente com 113+24 e 612+24. O painel não expõe orderId/transactionId/lotId desse lançamento; demonstrar os vínculos na auditoria dirigida, sem tomar o resumo como prova de todos os registros internos. Não usar/resgatar os pontos durante o ensaio.

Havia duas saídas READY na consulta anterior e este lote concluiu uma. Pode restar a saída de confirmação, mas o resultado do lote não informa tipo/aggregateId nem estado atual das filas; ausência de e-mail ainda não comprova falha de entrega. **Orientada nova supervisão -StatusOnly**, com confirmação explícita do pedido #3 Pago. Não reenviar simulação, não repetir lote por rotina nem solicitar REFUND antes de analisar a saída pendente e comprovar a confirmação legítima da loja. Nenhuma nova prova de estado PAID foi recebida neste checkpoint.

Se Q=24 e carteira não sofrer interferência/expiração/uso, depois do estorno integral esperar uma compensação REFUND_EARN de -24, saldo 113, pending 0, lifetimeEarn 612 e seis movimentações. Estes são critérios futuros, não resultados já executados. L-04 continua aberto.

## 18. Supervisão sem filas pendentes após as conferências

Leno (Brega) enviou supervisão de **2026-10-09T18:35:49.019Z**, correspondente a **15:35:49.019 BRT**, em 09/10/2026: SCOPE_VERIFIED/sandbox-hml, schemaVersion=1, processingAttempted=false; **inbox 3 COMPLETED**, **outbox 8 COMPLETED**, uma CANCEL/COMPLETED; uncertain, overdue, abandonedLeases e untrackedLegacyOrders todos zero, oldestUnresolvedInboxAt=null. Nenhum outro estado listado.

A leitura demonstra filas concluídas nesse instante e não justifica novo lote. A última supervisão anterior tinha outbox 6 COMPLETED + 2 READY; depois dela foi recebido um lote com uma conclusão. Agora há oito conclusões; a conclusão adicional não tem resultado de lote informado nesta sequência. Não inventar um terceiro lote ou atribuir a execução a um operador/scheduler sem evidência. Se necessário para rastreabilidade, consultar logs/timestamps dirigidos; essa diferença não é prova de duplicação de efeito.

Releitura do consumidor confirma que CHECKOUT_COMMITTED/ORDER_STATUS_CHANGED podem ser concluídos sem envio de e-mail; PAYMENT_CONFIRMATION_EMAIL exige resultado de envio com success e messageId quando há snapshot válido para pagamento. Mesmo assim, uma contagem agregada não demonstra commandType, vínculo ou recebimento pelo destinatário. O código também conclui a saída sem envio se, antes de congelar o snapshot, o pedido não estiver PAID/SHIPPED/DELIVERED. Portanto, não declarar entrega de confirmação pelo total de oito conclusões.

**Próxima conferência do operador:** confirmar explicitamente #3 Pago e reconferir chegada de uma confirmação de pagamento da loja para #3, inclusive spam. Se ainda não recebida, realizar auditoria dirigida da saída PAYMENT_CONFIRMATION_EMAIL, seu snapshot/estado e resultado no Resend antes de qualquer reenvio. Não enviar credenciais ou payload de destinatário/conteúdo no chat. Estoque e carteira permanecem com a última referência recebida 7/3/4 e 137/0/636/cinco, Q=24, sem nova leitura automática aqui. Não orientar novo lote nem REFUND neste checkpoint; L-04 aberto.

## 19. Pedido Pago e confirmação da loja recebidos

Em 09/10/2026, Leno (Brega) confirmou explicitamente **pedido #3 Pago** e recebimento da **confirmação de pagamento da loja**. Imagem do Gmail mostra loja Continental — Homologação, pedido **#3**, confirmação PIX dinâmico, retirada no balcão e uma unidade Aspirador de Pó automotivo Vermelho/Pequeno de **49,90**. Data de liquidação exibida: **09/10/2026 às 15:15**. Dados pessoais do comprador não reproduzidos. O horário de recebimento do e-mail não está exposto no recorte; não tratá-lo como 15:15. Esta prova demonstra recebimento da mensagem informada, ainda sem auditoria da unicidade dos envios.

Pagamento/ganho/e-mail agora têm confirmação funcional. Preparado [script somente de leitura do pedido #3](L-04-CONFERIR_PAGAMENTO_PEDIDO_3.js) para capturar **versão atual real**, PAID/RECEIVED, total, pointsRedeemed=0, pointsCredited=24, paidAt e histórico único PENDING → PAID; confere item/tenant/cobrança conhecidos. Saída sanitizada, sem comprador/conteúdo do e-mail. Não solicita operação, não processa filas e não comprova diretamente a tentativa/reserva/fatos.

**Próxima etapa orientada:** executar esse arquivo no Console do Admin autenticado do mesmo Preview e enviar o JSON. Reconferir no Asaas Sandbox que o saldo disponível permanece **pelo menos 49,90** e manter produto sem expedição/retirada/entrega. Isso prepara o comando específico com expectedVersion observado; não reutilizar identidade/versionamento do cancelamento #2. Nenhum REFUND deste pedido foi solicitado até este registro. Parecer independente e L-04 permanecem abertos.

## 20. Leitura pré-estorno verificada e comando preparado

Resultado real enviado por Leno (Brega) em 09/10/2026: **PRE_REFUND_ORDER_VERIFIED**, HTTP 200, readAttempted=true, requestAttempted=false e processingAttempted=false. Identidade #3/UUID/tenant/cobrança confirmada; **versão 1**, **PAID**, **PIX**, **RECEIVED**, total **49,90**, pointsRedeemed=0, pointsCredited=24; **paidAt=2026-10-09T18:15:24.207Z** (15:15:24.207 BRT), itemMatches=true, historyCount=1, paidHistoryCount=1. financialRecordsVerified=false: a projeção de detalhe não comprova diretamente tentativa/reserva/fatos; a API do comando fará suas validações no servidor, e a auditoria dirigida permanece necessária.

Operador também reconfirmou saldo disponível Sandbox e enviou imagem com **72,87**. Esse valor supera 49,90 na conferência informada; não afirmar leitura automática de saldo pelo script nem garantir disponibilidade futura. Estoque e carteira na última referência 7/3/4 e 137/0/636/cinco; confirmação da loja recebida anteriormente. Parecer independente continua pendente e autorização específica da seção 9 continua válida para este cenário.

Preparado [comando específico para solicitar estorno do #3](L-04-SOLICITAR_ESTORNO_PEDIDO_3.js): uma nova leitura com identidade fixa e conferências de PAID/RECEIVED, versão, total, ganho, paidAt, item e histórico; só depois um POST para o endpoint durável. Identidade original a preservar:

```json
{
  "kind": "REFUND",
  "commandId": "l04-pix-refund-pedido3-5b5bef57-v1",
  "expectedVersion": 1
}
```

**Orientado executar uma única vez** no Console do Admin autenticado do mesmo Preview/operador. Esperar HTTP 202, replay=false e uma operação REFUND/READY, guardando attemptId/operationId retornados. A aceitação registra trabalho durável; não demonstra estorno remoto nem compensações locais. Script não processa filas. Após retorno, orientar supervisão e consumidor por etapa. Se erro de pré-checagem, resposta inconclusiva ou timeout, consultar estado existente sem repetir automaticamente ou alterar a identidade.

Validação local do script: sintaxe Node aprovada e **15 cenários com mocks em VM**, incluindo identidade/versão/valor/item/ganho/estado/histórico divergentes, leitura negada/timeout, timeout de POST, conflito de servidor, resposta 202 incompleta e comando existente. Guardas impediram POST nos estados inválidos; cenários de POST enviaram no máximo uma solicitação com identidade exata; saída sem dados pessoais nem mensagens brutas de erro. Nenhum acesso ao Preview/Asaas/Neon, alteração de aplicação/migration ou execução de REFUND pelo agente. Este checkpoint prepara a solicitação; resultado real ainda a receber e L-04 continua aberto.

## 21. Solicitação de REFUND aceita

Em 09/10/2026, Leno (Brega) enviou resultado real do solicitador: phase=request_refund, requestAttempted=true, processingAttempted=false, **HTTP 202**, **REFUND_REQUEST_ACCEPTED**, ok=true, **replay=false**. Horário exato do POST não informado.

| Identidade a preservar | Valor recebido |
|---|---|
| Pedido / cobrança | #3 / 5b5bef57-2fd2-4f88-83fd-bf3d76238c40 / pay_cra35xq1ltkb6oka. |
| commandId / expectedVersion original | l04-pix-refund-pedido3-5b5bef57-v1 / 1. |
| attemptId | 03422a6b-8223-41eb-9240-089c6dd9cf22. |
| operationId / kind / status | 895e8eec-8052-49ae-86b8-f35812003b7e / REFUND / READY. |

Trabalho durável aceito. Isso não demonstra submissão da devolução ao Asaas, estado REFUNDED ou compensações locais. Pela implementação, a tentativa passa a REFUND_PENDING; pedido ainda PAID, estoque 7/3/4 e carteira 137/0/636/cinco devem ser conservados até a prova remota. Esses estados são critérios pré-despacho, não nova leitura automática recebida neste checkpoint.

**Orientada somente supervisão -StatusOnly**, enviar JSON antes de consumidor. Esperar escopo sandbox-hml, uma REFUND/READY além da CANCEL/COMPLETED anterior, e analisar quaisquer novas pendências. Não reenviar o solicitador, não mudar commandId/expectedVersion, não acionar estorno no painel Asaas nem processar lote automaticamente. IDs preservados para futura prova dirigida e replay. L-04 continua aberto.

## 22. Supervisão pré-despacho e lote de estorno orientado

Leno (Brega) enviou supervisão de **2026-10-09T19:26:53.230Z**, correspondente a **16:26:53.230 BRT**, em 09/10/2026: SCOPE_VERIFIED/sandbox-hml, schemaVersion=1 e processingAttempted=false.

| Indicador | Resultado observado |
|---|---|
| Inbox | 3 COMPLETED, sem pendências listadas. |
| Outbox | 8 COMPLETED, sem pendências listadas. |
| Operações | Uma CANCEL/COMPLETED anterior e uma REFUND/READY. |
| uncertain / overdue / abandonedLeases / untrackedLegacyOrders | 0 / 0 / 0 / 0. |
| oldestUnresolvedInboxAt | null. |

Estado compatível com a operação aceita do pedido #3, ainda pronta para consumo. A supervisão agrega operações sem IDs; as identidades específicas permanecem as recebidas na seção 21. Esta leitura não prova envio, saldo corrente, estado do pedido/carteira ou devolução remota.

**Orientado um único lote de processamento do estorno**, pelo script existente **sem -StatusOnly**, na mesma janela de Leno (Brega), sem reenviar o comando. O script reconfere escopo e envia uma vez POST `/api/cron/payments?limit=1`; a conciliação poderá consultar e despachar a operação pronta, conservando a identidade original. Não usar botões de estorno no painel Asaas, elevar limite ou repetir automaticamente.

Aguardar JSON do lote antes de nova decisão. Completed no resumo de conciliação não certifica operação financeira COMPLETED nem estado final REFUNDED: consulta remota dirigida, aplicação local, compensações, saída de status e replay ainda precisam ser demonstrados. Em timeout/erro, consultar o estado existente sem tentar novo REFUND. Nenhum lote executado pelo agente neste registro; L-04 permanece aberto.

## 23. Lote informado sem trabalho selecionado: diagnóstico dirigido

O operador reenviou primeiro a supervisão de 19:26:53.230Z já registrada; tratada como duplicata da evidência, sem nova execução inferida. Depois enviou o resultado de processamento: **inbox, conciliação e outbox com todos os contadores zero**; expiração success=true, processedCount=0, cancelledCount=0, errorCount=0, listas vazias e executionTimeMs=**683**. Sem timestamp próprio no resultado.

Nenhuma tentativa foi selecionada pela conciliação nesse lote, apesar da operação REFUND/READY na consulta anterior. Não registrar despacho ou devolução como concluídos, nem repetir automaticamente o lote ou o comando. Também não afirmar defeito confirmado ou operação ainda READY após o lote sem nova leitura: pode ter ocorrido alteração concorrente, agendamento futuro ou lease ativo, entre outras condições a verificar.

Releitura do consumidor: seleção de **PaymentAttempt**, não de PaymentOperation diretamente. Exige provider=ASAAS, reconcileAfter nulo/vencido, leaseExpiresAt nulo/vencido e status diferente de DECLINED/CANCELLED/REFUNDED; usa FOR UPDATE SKIP LOCKED. READY no resumo da operação não fornece esses dados. O código preserva REFUND_PENDING em evidência recebida, mas uma nova aplicação de evidência também pode atualizar reconcileAfter; isso é uma possibilidade de código, não causa demonstrada para este pedido.

Preparado [diagnóstico SQL somente de leitura do consumo de REFUND #3](L-04-DIAGNOSTICAR_CONSUMO_ESTORNO_PEDIDO_3.sql), com escopo por UUID/tenant/número, relógio/timezone do banco, tentativa esperada, status/prazos/lease/contadores, elegibilidade segundo os filtros, cobrança/operação/fatos, inbox/outbox correlacionadas e carteira. Não mostra payloads de cliente/e-mail, leaseOwner ou segredos; não altera prazos, status ou locks. Elegibilidade por filtros não garante ausência de bloqueio concorrente nem mesma conexão usada pelo deployment.

Validação: oito cenários sintéticos no PostgreSQL 17 temporário, sem rede/portas expostas, armazenamento efêmero e contêiner removido ao final. Casos cobriram alvo ausente, tentativa elegível, prazo futuro, lease ativo, estado terminal, conta inesperada, tenant errado e lease vencido; saída sem sentinela de dados pessoais. Schema de teste contempla colunas escalares reais, não todas as constraints de produção. Nenhum acesso ao Neon/Preview/Asaas.

**Próxima etapa orientada:** Leno (Brega) executa a consulta inteira no SQL Editor do **mesmo banco/branch efetivamente usado pelo Preview**, como no caso #2, e envia a coluna evidence. Não usar clone só por conter os mesmos IDs. Não executar UPDATE, liberar lease, antecipar reconcileAfter ou estornar manualmente. Aguardar resultado real para decidir correção/retomada conservando comando e operação originais. L-04 e estorno #3 permanecem abertos.

## 24. Diagnóstico real: submissão existente e prazo de conciliação inadequado

Leitura recebida do operador em **2026-10-09T19:35:05.204044+00:00**, databaseTimeZone=GMT, processingAttempted=false, alvo único e identidades de tentativa/conta/operação confirmadas. Campos timestamp sem offset abaixo são preservados literalmente como retornados pelo SQL.

| Registro | Estado observado |
|---|---|
| Pedido | PAID, versão 1, RECEIVED, 49,90, paidAt `2026-10-09T18:15:24.207`, 24 pontos creditados e zero resgatados. |
| Tentativa `03422a6b-8223-41eb-9240-089c6dd9cf22` | REFUND_PENDING, versão 5, reconcileAttempts=0, failureCode=null. |
| Operação `895e8eec-8052-49ae-86b8-f35812003b7e` | REFUND/PENDING, submittedAt `2026-10-09T19:29:07.726`, completedAt=null, lastErrorCode=null. |
| Próxima conciliação / revisão | `2026-10-10T19:29:10.705` / `2026-10-10T18:58:41.396`; a conciliação foi agendada após o prazo de revisão. |
| Elegibilidade | reconcileDue=false, leaseAvailable=true, leaseExpiresAt=null, leaseOwnerPresent=false, eligibleByWorkerFilters=false. |
| Cobrança interna `1e67b68f-ae79-4559-abf0-15e04b5f5301` | ASAAS/sandbox-hml, pay_cra35xq1ltkb6oka, ordinal 1, RECEIVED, 49,90, settledAt=null. |
| Fatos | AUTHORIZED e SETTLED, 49,90 cada, vinculados à mesma tentativa/cobrança/conta; nenhum REFUNDED retornado. |
| Eventos e efeitos | PAYMENT_RECEIVED concluído; CHECKOUT_COMMITTED, ORDER_STATUS_CHANGED e PAYMENT_CONFIRMATION_EMAIL concluídos uma vez cada. |
| Carteira | 137 disponíveis, 0 pendentes, 636 acumulados; uma movimentação vinculada ao #3. |

O estorno já foi submetido; PENDING não significa conclusão. A leitura atual demonstra inelegibilidade pelo prazo futuro, sem lease ativo. O lote sem timestamp e todos os contadores zero não identifica quem realizou a submissão anterior, nem permite atribuir a execução a esse lote. Não reenviar REFUND nem resetar operação/status/prazos diretamente no banco. O pedido e o ganho histórico permanecem preservados até evidência remota de devolução.

Causa reproduzida localmente: `applyPaymentEvidence` conservava REFUND_PENDING, porém usava o intervalo de 24 horas de uma cobrança RECEIVED. Dois testes de integração falharam no código anterior: resposta de submissão aceita ainda pendente e resposta perdida/UNKNOWN, ambos com próxima consulta em aproximadamente 86.400.000 ms. O patch em `services/payment/payment-evidence.service.ts` agenda nova leitura em 60 segundos para tentativa persistida CANCEL_PENDING/REFUND_PENDING; pagamentos aprovados sem reversão mantêm os intervalos existentes de uma hora (CONFIRMED) ou 24 horas (RECEIVED). A seleção efetiva ainda depende da execução do consumidor; o patch não instala um agendador.

O patch preserva autorização de despacho somente para operações READY. Os novos testes também verificam consulta por retomada auditada sem novo POST, conservação de PAID/reserva/estoque enquanto o provedor não confirma, e conclusão com a mesma operação e um único fato/retorno de estoque depois de REFUNDED. Não há migration, alteração do comando original ou mutação no ambiente compartilhado pelo agente. A mudança local não corrige retroativamente o prazo já persistido no Preview.

Preparado [GET específico de prova de estorno #3](L-04-CONFERIR_ESTORNO_PEDIDO_3.ps1), conforme [endpoint oficial de leitura Asaas](https://docs.asaas.com/reference/recuperar-uma-unica-cobranca). Executar uma vez no PowerShell; chave Sandbox em entrada oculta. Saída restrita a identidade, HTTP, status e deleted, sem dados pessoais ou respostas brutas. CHARGE_REFUND_VERIFIED exige HTTP 200, identidade/PIX/valor corretos e status REFUNDED sem deleted=true. RECEIVED, REFUND_IN_PROGRESS, identidade divergente ou leitura inconclusiva não comprovam estorno. Sintaxe e dez cenários com mocks aprovados; nenhum GET real executado pelo agente.

**Próxima etapa:** operador envia JSON desse GET. Aguardar a prova antes de escolher retomada pelo endpoint auditado `payment-reconcile`, processamento ou espera por webhook. Essa retomada conserva a operação existente; não repetir solicitador nem acionar estorno no painel. Compensação de pontos/estoque, auditoria final e replay continuam pendentes; L-04 não está encerrado.

Validação final local: **93 testes aprovados nas quatro suítes financeiras**, com PostgreSQL descartável e migrations reais; TypeScript, lint dos arquivos alterados e verificação do diff aprovados. [Detalhes da execução e reprodução anterior à correção](L-04-CICLO_FINANCEIRO_LOCAL_E_ENSAIOS_EXTERNOS.md#7-regressão-observada-no-estorno-assíncrono-do-pedido-3). Não houve commit/push/deploy deste patch ou consulta remota pelo agente; publicação para revisão e atualização do Preview continuam a demonstrar.

## 25. GET remoto recebido: cobrança ainda RECEIVED; consultar refunds

Operador enviou resultado real do script inicial: phase=refund_charge_lookup, **HTTP 200**, identityMatches=true, status=**RECEIVED**, deleted=false, ok=false e **REFUND_NOT_PROVEN**. Cobrança/UUID/PIX/49,90 corretos; lookupAttempted=true, requestAttempted=false, processingAttempted=false. Sem timestamp na saída: não atribuir horário exato a essa consulta. A resposta restrita inicial não mostrava o campo refunds; não concluir ausência, cancelamento ou processamento pendente do estorno remoto a partir dela. O registro interno anterior continua sendo REFUND/PENDING já submetido, sem autorização para outro POST.

Na [documentação oficial de estornos](https://docs.asaas.com/docs/estornos), o campo refunds informa status e valor de cada devolução: PENDING indica processamento, CANCELLED não comprova devolução e somente DONE compõe o total devolvido. A [consulta pontual da cobrança](https://docs.asaas.com/reference/recuperar-uma-unica-cobranca) fornece esses detalhes quando retornados. Não inferir que o botão de simulação Sandbox deve ser acionado, nem causa de falha financeira, sem os registros específicos.

Ampliado **o mesmo [script de leitura](L-04-CONFERIR_ESTORNO_PEDIDO_3.ps1)** para retornar refundRecordsPresent/refundRecordsValid, refundCount, totais separados DONE/PENDING/CANCELLED e lista restrita a status/value/dateCreated. Mantém **um único GET** e nenhum POST/DELETE; omite descrição, URL/comprovante, identificação bancária e dados pessoais. Campos ausentes/malformados permanecem inconclusivos. A aprovação específica deste ensaio exige cobrança REFUNDED sem deleted=true e exatamente um registro DONE de 49,90; DONE com cobrança ainda RECEIVED gera REFUND_STATUS_DIVERGENCE, não compensações automáticas. Múltiplos registros ou devolução parcial exigem análise, sem encerrar este caso de estorno integral único.

Validação da ampliação: sintaxe PowerShell e **17 cenários com mocks sem rede**, incluindo DONE integral, PENDING, CANCELLED, array vazio/ausente/malformado, divergência de status, valores parciais/múltiplos/inválidos, identidade incorreta, deleted=true, chave de produção rejeitada, JSON inválido e timeout. Número de GETs e omissão de dados sensíveis conferidos. Nenhuma alteração adicional da aplicação/migration ou acesso financeiro externo pelo agente; os 93 testes do patch de agendamento continuam sendo a execução anterior documentada.

**Próxima etapa orientada:** executar uma vez o script atualizado e enviar somente seu JSON. A nova leitura revela campos não expostos na primeira saída; não repete o comando financeiro. Não processar filas para tentar forçar o resultado, resetar operação ou acionar estorno no painel. A correção local do agendamento muda quando o consumidor consulta; não força a devolução no Asaas. Encerramento financeiro, compensações, auditoria final, replay, revisão independente e L-04 permanecem pendentes.

## 26. Registro remoto aguarda autorização de ação crítica

Operador enviou GET HTTP 200, identidade correta, cobrança RECEIVED e deleted=false, com um registro em refunds: **AWAITING_CRITICAL_ACTION_AUTHORIZATION**, **49,90**, dateCreated **`2026-10-09 16:29:08`**. Preservar esse timestamp sem atribuir timezone não declarado. O script retornou REFUND_DETAILS_UNRESOLVED/refundRecordsValid=false porque esse estado não constava de sua lista de estados reconhecidos; o JSON contém evidência remota legível de uma solicitação de estorno aguardando autorização, sem provar devolução concluída. Os valores null dos totais não significam saldo ou valor financeiro desconhecido no Asaas; eram a saída conservadora do parser diante de estado não reconhecido.

Atualizado o diagnóstico para reconhecer exatamente esse status, separar awaitingAuthorizationRefundAmount e retornar **REFUND_AWAITING_PROVIDER_AUTHORIZATION**, mantendo ok=false e completedRefundAmount=0 para esse registro. Estados adicionais inesperados continuam inconclusivos. Sintaxe e **19 mocks aprovados sem rede**, incluindo a resposta real reproduzida sinteticamente e mistura de DONE parcial com autorização pendente; a espera de autorização jamais conta como DONE. Nenhuma alteração adicional no consumidor, API financeira ou banco.

O [guia oficial de ações críticas no Sandbox](https://docs.asaas.com/docs/como-testar-a%C3%A7%C3%B5es-cr%C3%ADticas) informa que operações protegidas podem exigir confirmação adicional e que o token de teste **000000** é aceito exclusivamente no Sandbox, no campo/etapa solicitado pelo fluxo. O token confirma a autorização; demais validações e conclusão financeira ainda se aplicam. Não inventar endpoint de autorização ou desativar proteção da conta para concluir o teste.

**Próxima etapa orientada ao operador:** no painel da mesma conta **Asaas Sandbox**, abrir a cobrança pay_cra35xq1ltkb6oka do #3 e procurar a autorização pendente da solicitação de estorno existente, conferindo 49,90. Aprovar essa solicitação pelo fluxo apresentado; se pedir token de ação crítica, usar 000000 nesse ambiente de teste. Não clicar em Solicitar estorno/Estornar cobrança para criar outra operação, nem reenviar o POST original. Se a autorização não estiver visível, enviar imagem apenas da área de ações/pendências, sem códigos ou credenciais, para localizar o fluxo antes de qualquer nova ação.

Após a autorização, executar uma vez o GET atualizado e enviar o JSON antes de conciliação/compensações. Autorização aprovada não substitui DONE integral e cobrança REFUNDED. Quando a prova remota estiver disponível, escolher retomada auditada da tentativa existente ou consumo de webhook e conferir efeitos locais, estoque, pontos, filas e replay. A correção local de agendamento permanece distinta desta exigência remota. L-04 continua aberto.

## 27. Autorização informada e consulta sem refunds: histórico específico

Operador mostrou o painel **Sandbox** com um evento crítico pendente de criação de reembolso de crédito Pix de 49,90; conteúdo compatível com a leitura específica anterior, embora a imagem não mostre o ID da cobrança. Saldo mostrado 22,97; esse saldo não é prova de devolução concluída. Depois informou **"Autorizei"** e enviou o GET atualizado: HTTP 200, identidade correta, cobrança **RECEIVED**, deleted=false, **REFUND_DETAILS_UNRESOLVED**, refundRecordsPresent=false/refundRecordsValid=false, refundCount e totais null, lista de saída refunds vazia. Sem timestamp do GET ou da autorização.

A saída vazia é gerada pelo script quando o campo não está presente; não é leitura de uma lista remota vazia e não prova cancelamento, ausência histórica ou DONE. Preservar as evidências anteriores de submissão e autorização pendente. Autorização relatada é um checkpoint do operador; não substitui prova atual da situação financeira.

Acrescentado ao mesmo [script de leitura](L-04-CONFERIR_ESTORNO_PEDIDO_3.ps1) o modo **-RefundHistory**. Primeiro valida cobrança/UUID/PIX/49,90 pelo GET original; somente depois consulta `GET /v3/payments/pay_cra35xq1ltkb6oka/refunds`, conforme [referência oficial de histórico de estornos](https://docs.asaas.com/reference/listar-estornos-de-uma-cobranca). No máximo dois GETs fixos, sem corpo, QR, redirecionamento, repetição automática ou operação financeira. Chave Sandbox reutilizada em memória a partir da mesma entrada oculta.

Saída identifica fonte/forma do histórico, status HTTP de cada leitura e preserva somente status/value/dateCreated e totais classificados. Reconhece array na raiz, refunds array ou data array; para resposta paginada exige hasMore=false. Formatos desconhecidos, lista extensa, página incompleta, valor/estado inválido ou timeout permanecem inconclusivos. Historico vazio corretamente lido retorna REFUND_RECORD_NOT_OBSERVED, sem autorização para repetir a operação. Aprovação continua exigindo exatamente um DONE de 49,90 e cobrança REFUNDED; DONE com RECEIVED gera divergência. As duas consultas não formam um snapshot atômico e não acionam efeitos comerciais.

Validação local: sintaxe PowerShell, **19 casos do modo original e 16 casos do histórico**, sem rede. Cobriram arrays de zero/um/múltiplos registros no Windows PowerShell, respostas pendente/concluída/cancelada/autorização, wrappers e paginação, identidade divergente impedindo segundo GET, formato/JSON/valor inválidos e timeout da segunda consulta sem atribuir a ela o HTTP 200 da primeira. Saídas sem sentinelas de credencial/dados pessoais. Nenhuma alteração de aplicação/migration, publicação adicional ou acesso ao Asaas/Preview/Neon pelo agente nesta etapa.

**Próxima etapa orientada:** executar uma vez `.\PACOTE_REVISAO_VANDERLEI\L-04-CONFERIR_ESTORNO_PEDIDO_3.ps1 -RefundHistory` e enviar o JSON. Aguardar esse histórico antes de retomada auditada ou processamento; não reenviar REFUND, criar outro estorno ou alterar registros no banco. Estorno #3, compensações, auditoria, replay e L-04 seguem abertos.

## 28. Histórico remoto: solicitação de estorno cancelada no provedor

Operador enviou o resultado real de `-RefundHistory`: **REFUND_CANCELLED_AT_PROVIDER**, HTTP 200 nas duas leituras, identityMatches=true, fonte refund_history, formato DATA_ARRAY e hasMore=false. Cobrança `pay_cra35xq1ltkb6oka` do pedido #3 permanece **RECEIVED**, deleted=false. Registros presentes e válidos, refundCount=1: **CANCELLED**, value=49,90, dateCreated=`2026-10-09 16:29:08`. Totais retornados: DONE=0, PENDING=0, aguardando autorização=0 e CANCELLED=49,90. requestAttempted=false e processingAttempted=false. A saída não informa o horário da consulta nem o momento ou motivo do cancelamento; dateCreated é a criação do registro, sem timezone declarado.

Essa evidência confirma cancelamento da **solicitação de estorno no Asaas**, sem devolução concluída nesse histórico. Não significa cancelamento do pedido comercial ou do pagamento recebido. O relato de autorização e o estado remoto anterior aguardando autorização permanecem registrados; não atribuir a causa ao operador, saldo insuficiente, expiração ou falha do provedor sem evidência específica. As duas consultas não constituem snapshot atômico.

A última leitura interna disponível é a da seção 24 (operação PENDING, tentativa REFUND_PENDING, pedido PAID, carteira 137/0/636); ela antecede este resultado remoto e não comprova o estado interno atual. A correção local de agendamento não resolve por si só um estorno cancelado no provedor. Não marcar operação COMPLETED, compensar pontos/estoque, resetar status ou reenviar REFUND para contornar esse resultado.

**Próxima etapa:** consultar no Asaas Sandbox os detalhes/histórico da devolução existente de 49,90 e obter a mensagem ou motivo do cancelamento. Preservar comando `l04-pix-refund-pedido3-5b5bef57-v1` e operação `895e8eec-8052-49ae-86b8-f35812003b7e`; nenhuma nova solicitação orientada. Depois correlacionar a causa e uma leitura interna atual antes de definir recuperação. Caso de estorno e L-04 continuam abertos. Nesta etapa foram atualizados somente registros locais; nenhum acesso remoto, processamento, mutação financeira ou publicação pelo agente.

## 29. Nova leitura interna confirma divergência após cancelamento remoto

Operador relatou que não houve extrato de saída de 49,90; esse relato não informa a causa do cancelamento. Em seguida enviou nova execução do SQL dirigido, às **2026-10-09T20:27:40.723124+00:00** (17:27:40 em Brasília), banco GMT, orderCount=1 e identidades/conta esperadas correspondentes. Resultado:

- Pedido PAID, versão 1, cobrança RECEIVED, total 49,90, paidAt original preservado, pointsCredited=24 e pointsRedeemed=0.
- Mesma tentativa `03422a6b-8223-41eb-9240-089c6dd9cf22`, REFUND_PENDING, versão 5, updatedAt ainda 19:29:12.370 UTC; failureCode=null e reconcileAttempts=0.
- Mesma operação `895e8eec-8052-49ae-86b8-f35812003b7e`, PENDING, submittedAt original 19:29:07.726 UTC, completedAt=null e lastErrorCode=null.
- reconcileAfter continua 10/10/2026 às 19:29:10.705 UTC (16:29:10 em Brasília), posterior a reviewAfter=18:58:41.396 UTC. reconcileDue=false, leaseAvailable=true, nenhum lease ativo, eligibleByWorkerFilters=false. O prazo futuro explica a inelegibilidade observada, sem indicar bloqueio por lease.
- Fatos AUTHORIZED e SETTLED preservados; nenhum fato REFUNDED na saída. Carteira 137 disponíveis, 0 pendentes, 636 acumulados e uma movimentação vinculada ao pedido. Nenhuma reversão de pontos evidenciada. Esta consulta não lê estoque/reservas, portanto não atualiza sua prova.
- Único inbox relacionado: PAYMENT_RECEIVED, COMPLETED. Três registros de outbox do pedido (checkout, alteração de status e confirmação de pagamento), todos COMPLETED; nenhum evento de estorno consta deste recorte.

Conferência do código local e do adapter no commit ede9cc2: `AsaasPaymentAdapter.inspectAttempt` consulta cobranças e projeta status/deleted/identidade, sem consultar ou incorporar o histórico de estornos. `applyPaymentEvidence` conserva REFUND_PENDING enquanto não há cobrança REFUNDED; não distingue histórico remoto CANCELLED de devolução ainda em processamento. `dispatchPaymentOperations` envia somente operações READY, preservando PENDING sem reenvio. Logo, antecipar consultas não basta para reconhecer esse cancelamento: há uma lacuna de classificação além do defeito de agendamento já corrigido localmente. Isso não explica por que o Asaas cancelou a devolução.

**Pendência técnica para correção e revisão:** consultar e validar o histórico remoto da cobrança para operações de estorno submetidas; correlacionar registros com a operação preservando IDs/valores e tratando ambiguidades como revisão, sem presumir que qualquer CANCELLED histórico pertence à operação atual. Encaminhar cancelamento comprovado para revisão auditada, preservando pedido pago, fatos de pagamento, pontos e estoque; nunca rearmar READY nem criar outro REFUND automaticamente. Cobrir histórico cancelado, autorização pendente, histórico incompleto/ambíguo e conclusão posterior com testes de ausência de reenvio e compensações indevidas. Essa correção adicional ainda não foi implementada neste checkpoint; os 93 testes anteriores validam o patch de agendamento, não essa lacuna.

Nenhum novo comando operacional necessário para repetir esta constatação. Motivo remoto ainda desconhecido; ensaio de estorno não aprovado. Nesta etapa somente documentação atualizada e código inspecionado; nenhuma mutação no Sandbox/Preview/banco, processamento, commit ou deploy.

## 30. Primeira etapa autorizada: correção e testes locais

Leno solicitou iniciar a primeira etapa do plano de encerramento. Implementada leitura do histórico específico para cobranças com operação REFUND e revisão auditada de cancelamento, autorização pendente ou evidência incompleta/ambígua. IDs, estado original e datas da operação são preservados; lastErrorCode/failureCode, auditoria e outbox tornam a revisão visível. **Não existe novo status REVIEW na tabela PaymentOperation**: a constraint existente foi mantida, sem migration.

O consumidor bloqueia envio de READY com erro de revisão e não rearma operações quando o histórico muda para vazio/pendente. Conclusão posterior exige cobrança REFUNDED e total DONE integral, sem devolução ativa, conservando a operação e aplicando compensações únicas. Testes com banco real descartável cobrem carteira/estoque, replay de comando e webhook, resposta perdida, histórico ausente e revisão descoberta após envio. O motivo do cancelamento remoto não é inferido pelo código.

[Implementação, validações e limites completos](L-04-CICLO_FINANCEIRO_LOCAL_E_ENSAIOS_EXTERNOS.md#8-tratamento-local-de-histórico-de-estorno-cancelado-ou-inconclusivo): 102 testes de integração e 55 unitários passaram. A validação é local, sem acesso financeiro remoto; não comprova estorno do pedido #3. Nenhuma publicação, reenvio, compensação manual ou alteração no banco compartilhado nesta etapa.

**Etapa seguinte:** preparar/revisar a atualização do Preview e confirmar sua identidade antes de retomar a leitura existente sob supervisão. O patch não altera retroativamente reconcileAfter persistido; eventual antecipação usa o endpoint auditado de conciliação, nunca UPDATE manual ou repetição do solicitador. A leitura deve mostrar revisão específica para o histórico cancelado, preservando o pedido pago e os pontos. Decisão sobre recuperação/nova tentativa continua separada, dependente da situação no provedor e da preservação do histórico original. Parecer independente e encerramento real do ensaio continuam pendentes.

## 31. Publicação de homologação e conferência anterior à retomada

Leno autorizou a próxima etapa após a conclusão local. Destino permanece `origin/homologacao_teste`; antes da preparação do commit, fetch confirmou HEAD e destino em ede9cc2 sem divergência. Build de produção isolado aprovado, além dos 157 testes distintos da etapa anterior. Esta entrega inclui correção, testes e os roteiros/evidências acumulados dos pedidos #2 e #3, sem migration, segredos ou mudança de variáveis remotas.

Identificar o commit desta entrega por `git log -1 --format=%H -- services/payment/refund-history.ts`. Conferir push e resultado Vercel para esse SHA; build local aprovado não comprova deployment Ready. O CI genérico atual não dispara para push direto em homologacao_teste; não declarar seus jobs executados por essa publicação.

Depois de o deployment correspondente estar Ready, a primeira ação operacional é **somente** `.\scripts\homologation\process-payments-once.ps1 -StatusOnly`. Conferir sandbox-hml, pendências e identidade da janela antes de escolher o próximo processamento. O agente não executa esse script com credenciais do operador nesta etapa.

O pedido #3 e a operação original permanecem como alvo. Se ainda não estiver elegível, preparar a retomada pelo endpoint auditado `payment-reconcile`, que antecipa consulta e não redefine permissão de REFUND. Somente depois de conferir a resposta e as filas, processar a janela coordenada e reler o SQL dirigido. Resultado esperado enquanto o histórico remoto continua cancelado: pedido PAID v1, carteira 137/0/636 e uma movimentação do pedido; operação original sem nova submittedAt/COMPLETED e lastErrorCode/failureCode `PAYMENT_REFUND_CANCELLED_REVIEW`, com revisão auditada. Reconferir estoque separadamente (referência 7/3/4); esse SQL não o consulta.

Nenhum novo estorno solicitado ou cancelamento manual do pedido orientado. O motivo remoto e eventual recuperação financeira continuam pendentes; esta etapa valida a identificação da divergência, sem aprovar o cenário de devolução concluída.
