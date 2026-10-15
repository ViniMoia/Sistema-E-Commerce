# L-04 — Boleto: emissão e confirmação no Sandbox

**Cenário de emissão e pagamento de boleto concluído no Sandbox em 14/10/2026.** Pedido #6 pago, e-mail recebido e conteúdo conferido pela imagem enviada pelo operador: boleto bancário, retirada no balcão, uma unidade Pequeno/Vermelho, total R$ 49,90, confirmação às 17:38 e ganho de 24 pontos. Última leitura do banco às 20:45:36 UTC: carteira/lotes 310, lifetimeEarn 809, estoques 93/43, reserva COMMITTED e efeitos sem duplicação observada. Todas as tarefas do pedido concluídas. Não executar novas rodadas nem confirmar retirada física para este cenário. Main e banco de origem permanecem somente leitura.

Este fechamento cobre emissão, apresentação do vencimento, recebimento simulado, aplicação interna, estoque, fidelidade e e-mail. Não encerra cancelamento, vencimento, pagamento tardio, estorno de boleto ou replay deliberado, nem libera produção. Os registros cronológicos e o procedimento abaixo documentam o ensaio concluído; pendências antigas foram superadas pelo fechamento acima.

**Registro às 20:39:34 UTC:** pagamento simulado pelo operador e aplicado pelo consumidor; pedido #6 PAID v1, tentativa APPROVED sem failureCode, cobrança RECEIVED com fatos AUTHORIZED e SETTLED de R$ 49,90. Um EARN de 24, carteira/lotes 310 e lifetimeEarn 809. Estoques preservados em 93/43, versões 12/9, reserva COMMITTED. E-mail e ORDER_STATUS_CHANGED ainda READY; recebimento de e-mail e leitura posterior de estabilidade pendentes. A linha de preparação acima descreve o momento anterior à simulação.

O evento PAYMENT_RECEIVED foi concluído em uma tentativa; CHECKOUT_COMMITTED também concluído. A revisão registrada na rodada corresponde ao PIX #3 (`PAYMENT_REFUND_CANCELLED_REVIEW`, atualização 20:38:57 UTC), sem failureCode no #6. O campo `PaymentCharge.settledAt` continua nulo nesta leitura; a evidência de liquidação registrada é o fato SETTLED, além do status RECEIVED. Não declarar esse timestamp preenchido.

**Leitura posterior às 20:43:25 UTC:** ORDER_STATUS_CHANGED concluído em uma tentativa. PAYMENT_CONFIRMATION_EMAIL continua READY, attempts=0, sem erro. Pedido PAID v1, tentativa APPROVED v2, mesmos IDs dos dois fatos financeiros e do único EARN de 24; carteira/lotes 310, lifetimeEarn 809, estoque 93/43, versões 12/9 e reserva COMMITTED preservados. Estabilidade observada entre as duas leituras; não equivale a teste de replay financeiro deliberado. Falta consumir e confirmar recebimento do e-mail.

## Emissão observada do pedido #6

**Última conferência — 20:45:36 UTC:** PAYMENT_CONFIRMATION_EMAIL agora COMPLETED, attempts=1, sem erro. As três tarefas do #6 e o PAYMENT_RECEIVED estão concluídos. Pedido PAID v1, tentativa APPROVED v2, mesmos fatos financeiros e único EARN de 24; carteira/lotes 310, lifetimeEarn 809, estoque 93/43 e reserva COMMITTED mantidos. Não são necessárias novas rodadas para essas tarefas. Falta o operador confirmar o recebimento e conteúdo do e-mail; conclusão do envio na fila não comprova entrega na caixa postal.

- Identidade: `0f0a05ff-2a24-4e6f-93ef-be13451388c9`, cobrança `pay_blfexx8zkousw431`, conta registrada `sandbox-hml`. Diagnóstico já parametrizado para essa identidade; não emitir outro pedido para corrigir a apresentação.
- Leitura somente leitura de 14/10/2026 às 20:20:49 UTC: pedido PENDING v0, tentativa PENDING, uma cobrança de R$ 49,90, artefatos de boleto presentes e `paidAt` nulo. Sem fatos financeiros, movimentos de fidelidade ou operações de estorno/cancelamento.
- Uma unidade RESERVED, vinculada corretamente ao item; estoque 93/43, carteira/lotes 286 e lifetimeEarn 785. Outbox CHECKOUT_COMMITTED READY; nenhum processamento executado nesta conferência.
- PDF Sandbox enviado pelo operador vence em **15/10/2026**. A tela mostrava **16/10/2026** porque apresentava o limite exclusivo `2026-10-16T03:00:00Z` como data impressa. Correção de apresentação incluída no pacote autorizado para homologação, sem alterar cobrança, expiração ou reserva. Reteste após o deploy ainda pendente. Ver seção 30 do replanejamento.
- Atualização: correção publicada em `117ec92`, deploy Vercel concluído; operador enviou tela e PDF com 15/10/2026, validando a apresentação. Em seguida utilizou **Ações de Sandbox → Confirmar pagamento** na mesma cobrança e informou status recebido.
- Leitura somente leitura às **20:36:43 UTC de 14/10/2026**: webhook PAYMENT_RECEIVED `34e43629-d26c-4982-bfd1-4510de37aa5c` chegou e está READY, attempts=0. Pedido/tentativa/cobrança ainda PENDING, `paidAt` nulo, sem fatos financeiros nem EARN; carteira/lotes 286, lifetimeEarn 785, estoque 93/43 e reserva RESERVED. Portanto a simulação remota ainda não foi aplicada internamente nesse instante.
- Próximo passo: conferir `-StatusOnly` do executor e executar uma rodada controlada conforme seção 3; depois reler o diagnóstico. Não repetir a confirmação Sandbox nem emitir outro boleto. E-mail, crédito único dos 24 pontos e estabilidade posterior permanecem pendentes de evidência.

## Ambiente e decisões reaproveitadas

- Preview: `https://continental-prototipo-git-homologacaoteste-vinimoias-projects.vercel.app`.
- Loja: `3a82b33c-3646-4272-9a89-80bb1ba327a5`, `continental-homologacao`; conta esperada `sandbox-hml`.
- `origin/main` em `7f9b26e`: `lib/config/payment.config.ts` já define vencimento padrão de um dia útil e piso de R$ 5. A homologação preserva esses defaults. O algoritmo de `services/payment/due-date.service.ts` é igual ao da main: pula fins de semana, mas não consulta calendário de feriados e usa o fuso do processo. Não declarar cobertura de feriados como homologada.
- `BOLETO_DUE_DAYS` e `ASAAS_MIN_VALUE` podem sobrescrever defaults no deployment. Seus valores efetivos no Preview não foram consultados nesta preparação; conferir proposta e vencimento retornado pelo Asaas. Para emissão em 14/10 com default D+1, espera-se 15/10/2026.
- A política atual congela `boletoConfirmationGraceHours=72` na tentativa. Não confundir tolerância de confirmação com vencimento impresso ou autorização para pagar após cancelamento remoto.

## Baseline observado

Consulta READ ONLY/REPEATABLE READ às **18:46:15 UTC / 15:46:15 de Brasília**, usando [L-04-PREPARAR_BOLETO.sql](L-04-PREPARAR_BOLETO.sql). Resultado privado em `artifacts/boleto-hml/baseline.json`, sem credenciais ou dados pessoais. A identidade do cliente foi obtida pelo #5.

| Dado | Valor observado |
|---|---|
| Boleto / retirada | Ambos habilitados; configuração da loja v5 |
| Produto | Aspirador automotivo `a26fdbc1-d8c3-4173-b114-f759654b9ca4`, R$ 49,90, estoque 94, versão 11 |
| Variante | Pequeno/Vermelho `c9422a68-9be8-4fdc-bc5f-5ee7689401d2`, estoque 44, versão 8, não retirada do catálogo |
| Indisponíveis | Zero no produto e na variante |
| Carteira / lotes | 286 disponíveis, soma dos lotes 286, zero dívida/pendentes, nenhum lote positivo vencido; lifetimeEarn 785 |
| Boletos existentes do cliente | Nenhum |
| Pedido #5 | CANCELLED v2, encerramento anterior preservado |
| Contas das tentativas observadas na loja | Apenas `sandbox-hml`; isso não prova sozinho a conexão usada pelo deployment |

Se houver movimentações concorrentes ou retomada em outro momento, atualizar o baseline. Nunca corrigir valores no banco para fazer o teste corresponder à tabela.

## 1. Montar e revisar a proposta

No Preview e com o mesmo cliente dos ensaios anteriores, colocar **uma unidade do aspirador automotivo Pequeno/Vermelho**, escolher **retirada na loja**, **boleto** e **zero pontos de resgate**. Informar endereço de cobrança completo mesmo com retirada; o contrato exige esse endereço para boleto.

Antes de confirmar, conferir:

- Mercadorias R$ 49,90; desconto R$ 0,00; frete R$ 0,00; encargos R$ 0,00; total **R$ 49,90**.
- Uma cobrança, sem parcelamento; ganho previsto **24 pontos** pela política atual (`floor(49,90 × 0,5)`). Ganho previsto não é saldo creditado.
- Método BOLETO e entrega PICKUP. O aspirador importado de outro cadastro não deve substituir o produto identificado acima.

Enviar a revisão da proposta para conferência antes da emissão. Não reservar número de pedido antecipadamente, nem presumir #6. Proposta expirada exige nova revisão.

## 2. Emitir uma vez e conferir sem simular pagamento

**Ocorrência em 14/10/2026:** a primeira proposta de R$ 49,90 foi revisada, mas o operador relatou retorno à identificação ao confirmar. Leitura às 19:25 UTC encontrou a intenção mais recente OPEN e nenhum BOLETO desse cliente, com carteira/estoque inalterados. Correção local da atualização em segundo plano validada em navegador; publicação e reteste no Preview pendentes. Antes de retomar, consultar o estado atual para não duplicar uma tentativa eventualmente concluída depois dessa leitura e gerar revisão válida se a proposta tiver expirado. Ver seção 29 do replanejamento.

Após conferir a proposta, confirmar uma única vez e guardar número/ID reais do pedido. A interface deve apresentar pagamento pendente, acesso ao boleto e linha digitável. Em resposta incerta, consultar o pedido existente; não criar outro carrinho/pedido para tentar resolver.

Preencher os dois parâmetros de [L-04-DIAGNOSTICAR_BOLETO.sql](L-04-DIAGNOSTICAR_BOLETO.sql) com ID e número reais. Manter loja e método fixos. O SQL sem parâmetros retorna `ORDER_SCOPE_REQUIRED`; uma identidade incompatível retorna `ORDER_SCOPE_NOT_FOUND`. O resultado não inclui linha digitável, URL do boleto ou dados pessoais.

Conferir no banco e no painel Sandbox a mesma cobrança, referência do pedido, valor, método e vencimento. Abrir o boleto somente pelo Preview autenticado; não publicar sua URL ou linha digitável em evidências públicas.

| Momento | Resultado esperado, sem outras movimentações |
|---|---|
| Emitido, ainda não pago | Pedido PENDING; tentativa PENDING após emissão resolvida; uma cobrança BOLETO de R$ 49,90, artefatos disponíveis e prazo persistido; `paidAt` nulo; sem fatos de aprovação/liquidação nem ganho de pontos. |
| Reserva inicial | Uma reserva RESERVED; estoques 93/43, decrementados uma única vez na criação; carteira/lotes continuam 286, sem REDEEM. |
| Resposta incompleta | Estado de processamento/UNKNOWN exige consulta e recuperação da mesma tentativa; não equivale a emissão aprovada nem justifica repetir POST. |

`asaasDueDate`/`dueAt` internos representam o limite usado pelo serviço, que grava o início do dia seguinte ao vencimento em UTC−03. Comparar o vencimento impresso/retornado em YYYY-MM-DD com essa conversão; não interpretar a mudança de dia em UTC como erro por si só.

## 3. Simular confirmação e observar os efeitos

Somente após conferir a emissão, acessar a cobrança correta no **Asaas Sandbox** e usar sua ação de confirmação de pagamento. O [guia oficial](https://docs.asaas.com/docs/como-adicionar-dinheiro-para-testes) documenta essa simulação sem movimentação real. Não pagar o boleto em aplicativo bancário e não marcar recebimento em dinheiro como substituição do fluxo de boleto.

Acompanhar o retorno do provedor e o evento correspondente. Quando necessário, usar o executor já existente `scripts/homologation/process-payments-once.ps1`: conferir primeiro `-StatusOnly` com o escopo esperado, depois uma rodada controlada e nova leitura do diagnóstico. O consumidor é global; contadores não identificam o pedido, e o PIX #3 pode continuar aparecendo em revisão. Não alterar prazos/leases nem repetir rodadas indefinidamente.

Esperado após evidência autoritativa de pagamento:

- Pedido PAID, tentativa APPROVED e mesma cobrança; fatos financeiros coerentes com CONFIRMED/RECEIVED. Somente RECEIVED e fato SETTLED comprovam liquidação registrada.
- Reserva COMMITTED; estoques mantidos em 93/43, sem segunda baixa na confirmação.
- Um EARN de 24, nenhum resgate: carteira/lotes **310**, lifetimeEarn **809**, desde que não existam outras movimentações.
- Evento e tarefas vinculados ao pedido concluídos; e-mail recebido com boleto, retirada, total R$ 49,90 e 24 pontos. Uma leitura posterior deve preservar os IDs dos efeitos e os saldos.

Não confirmar retirada física para encerrar este teste: aprovação financeira e entrega são verificações distintas.

## Limites e validação da preparação

- `services/payment/payment-operations.service.ts` bloqueia REFUND de BOLETO. O fluxo de estorno do cartão não será usado neste caso. A [referência oficial de estorno de boleto](https://docs.asaas.com/reference/estornar-boleto) descreve etapa própria com `requestUrl` e participação do pagador; implementação/ensaio ficam separados.
- Este caso não encerra vencimento, pagamento tardio, cancelamento, estorno, feriados/fuso ou habilitação produtiva. Não simular vencimento no boleto reservado para aprovação; preparar identidade e baseline próprios para esses cenários.
- Dois SQLs validados no banco de homologação em transações somente leitura; guardas do diagnóstico verificadas com parâmetros vazios e com o #5 de crédito, rejeitado pelo filtro de método. O ramo de pedido BOLETO real será conferido depois da emissão.
- **60 testes unitários aprovados** em quatro arquivos: payment-recovery-adapter, payment-plan-authority, checkout-client-contracts e order-payment-email. São verificações locais dos contratos existentes, não teste remoto de boleto. Nenhuma cobrança, confirmação, processamento de filas ou mudança de estoque foi executada nesta preparação.
