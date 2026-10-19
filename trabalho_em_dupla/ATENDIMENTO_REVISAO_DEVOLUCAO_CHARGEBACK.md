# G3 — Atendimento de revisão financeira, devolução e chargeback

Preparação de 16/10/2026, baseada na candidata `55a300313570f2a504a8f042ba7f228cd7382e58`. Consultados o código atual e `origin/main` `7f9b26e062ec2654420fecffb6dd78ad3ba1e017` somente leitura. **Procedimento preparado, ainda sem ensaio operacional no destino ou aceite de produção.** Complementa o [checklist G1–G8](CHECKLIST_PRODUCAO_G1_G8.md).

**Atualização de 19/10/2026:** implementados localmente o retorno físico integral e o tratamento de resultados de chargeback descritos abaixo. Essas alterações ainda precisam integrar a candidata publicada; as lacunas de código registradas na preparação de 16/10 são históricas. Envio de disputa/documentos, retornos parciais e aceite operacional continuam pendentes.

Leno conduz a conferência de pedido, pagamento, estoque e pontos; Vanderlei confere acesso, revisão publicada, consumidores e alertas. Cada caso precisa de responsável nominal, substituto, próxima ação e prazo de acompanhamento. A pessoa que recebe/confere mercadoria deve ser identificada no caso; não presumir retorno físico a partir de uma resposta financeira.

## 1. O que o código permite hoje

| Capacidade | Implementação encontrada | Limite operacional |
|---|---|---|
| Consultar pedido | GET administrativo autenticado e escopo da loja. | Não comprova sozinho o estado atual do provedor. |
| Solicitar CANCEL/REFUND Asaas | `requestPaymentOperation`, rota `payment-operation`; comando durável, versão e identidade do operador. | 202 significa solicitação aceita. REFUND de boleto é recusado. Contrato não recebe valor parcial. |
| Solicitar reconciliação | `requestPaymentReconciliation`, rota `payment-reconcile`. | **É escrita:** agenda tentativa, altera prazo de revisão e recoloca inbox DEAD_LETTER correlacionada em READY. Não é consulta de diagnóstico; repetição pode mudar novamente a agenda. Não reseta PaymentOperation para permitir novo POST. |
| Revisão financeira | `markPaymentReview` registra auditoria/código e outbox PAYMENT_REVIEW. | A outbox de revisão não envia e-mail de atendimento; seu processamento pode terminar em DEAD_LETTER. O alerta e o responsável precisam ser comprovados separadamente em G6. |
| Estorno integral de pedido SHIPPED/DELIVERED | Reconciliação registra financeiro, compensa pontos pelo serviço existente quando há usuário e marca `PHYSICAL_RETURN_REQUIRED`. | Preserva estado físico e estoque até conferência. A alteração local de 19/10 acrescenta comando específico para retorno integral, ainda sem aceite no destino. |
| Encerrar retorno físico integral | `physical-return`, GET/POST administrativo, conferência no detalhe do pedido; comprovante único por pedido, com operador, versão, referência e destino por item. | Exige estorno integral comprovado, revisão física e reservas COMMITTED correlacionadas. Não recebe retorno parcial, não dispara estorno e não substitui conferência humana de reposições genéricas anteriores. |
| Ajustar estoque | `adjustInventory`, rota `/api/products/[id]/inventory`, com identidade, lock, versão quando fornecida e auditoria. | Ajuste genérico não comprova devolução, não fecha reserva/pedido/revisão e não impede uma duplicação feita com outro commandId. |
| Estorno manual | `manualRefund`, exclusivamente para provider MANUAL e WHATSAPP_PIX. | Não é alternativa para confirmar manualmente estorno Asaas, boleto ou chargeback. PIX manual continua fora do escopo habilitado de lançamento. |
| Resultado de chargeback | Objeto de contestação correlacionado à cobrança, observações auditadas e painel por parcela; `PAYMENT_CHARGEBACK_REVIEW` para casos abertos/incompletos. Encerramento exige estado financeiro compatível. | Envio de disputa/documentos não implementado. Resultado parcial mantém revisão do pedido. Estorno local já retido não é rearmado automaticamente após reversão da contestação. |

Rotas são referências do contrato, **não comandos para executar agora**. Não converter os casos de teste #3/#4/#5/#6/#7/#8 em operações novas para validar este procedimento.

## 2. Abrir e classificar um caso

Usar uma cópia do [modelo de caso](modelos/CASO_REVISAO_FINANCEIRA.json). O modelo vazio não representa atendimento realizado.

1. Registrar ambiente, loja, pedido, tentativa, cobrança/contrato e eventual evento/chargeback. Número do pedido e valor isolados não identificam uma cobrança. Conferir conta do provedor, método, moeda, quantidade de parcelas e valores.
2. Registrar solicitação e motivo, autor e horário, estado financeiro e físico conhecido, versão do pedido, operações existentes e último código de revisão. Referenciar evidências privadas; não copiar documento pessoal, cartão, token, endereço completo ou conversa do comprador para o Git.
3. Consultar estado local e provedor com acesso autorizado, distinguindo leitura de comandos. Conferir histórico completo de estornos quando pertinente e provas de recebimento da mercadoria. Não usar tela antiga ou total agregado de filas como comprovação do caso.
4. Classificar: resultado incerto, conflito de identidade/valor, pagamento tardio, estorno em revisão, retorno físico, reversão parcial ou chargeback. Registrar se a próxima ação é leitura, decisão comercial, alteração no provedor ou mutação local.
5. Definir responsável, substituto, próxima conferência e prazo efetivo do caso. Se houver prazo do provedor, registrar a fonte e o horário; não aplicar um prazo genérico presumido.

O painel pode permanecer `PARTIAL` enquanto existe revisão real. Não apagar `failureCode`, transformar filas em COMPLETED por SQL, alterar versão/saldo ou fabricar fatos para remover o aviso.

## 3. Revisão financeira: sequência e decisões

| Situação observada | Encaminhamento | Condição de saída |
|---|---|---|
| Timeout / resposta perdida / UNKNOWN | Preservar commandId, operador, versão e resultado parcial. Ler operação e provedor antes de qualquer repetição. | Identidade e resultado remoto/local correlacionados; nenhuma segunda cobrança/estorno criado por tentativa cega. |
| MISMATCH / CONFLICT / histórico incompleto | Guardar diferenças e solicitar conferência técnica da conta/contrato e histórico. | Causa esclarecida e evidência completa; caso não é resolvido mudando dados para coincidir. |
| Pagamento tardio de pedido cancelado | Conferir recebimento e obrigação de devolução; preservar cancelamento físico/reserva. | Destinação financeira comprovada, sem reabrir estoque/compra por inferência. |
| Estorno solicitado, ainda não confirmado | Acompanhar operação e histórico por identidade; comunicar “em processamento”. | Confirmação efetiva ou estado de revisão com responsável e próxima ação. |
| Histórico de estorno CANCELLED / autorização crítica | Tratar como revisão específica; não reenviar comando para escapar do estado. | Resolução suportada pelo provedor e conciliada; pedido #3 segue neste grupo até prova nova. |
| Reversão parcial | Preservar os fatos efetivos e a revisão. | Procedimento específico de rateio/efeitos e suporte contratual revisados; não tratar como devolução integral. |

**Se a causa foi resolvida e a reconciliação existente for apropriada:** preparar uma ação por pedido, registrar o estado anterior e a razão, conferir consumidores que poderão executar trabalho e então usar o comando autorizado. A rota pode recolocar eventos e produzir efeitos de domínio durante o processamento; não chamar apenas para “ver o status”. A mesma commandId conserva a auditoria, mas o serviço não retorna antes de atualizar a agenda em uma repetição.

**Se uma nova solicitação financeira for necessária e suportada:** conferir ausência de operação incompatível, elegibilidade, versão, todas as cobranças e histórico de estorno. Registrar o comando exato uma vez; 202/READY ou outbox concluída não são comprovantes de devolução. No crédito parcelado, conferir o contrato e todas as parcelas: o número de operações locais não determina o número de chamadas remotas.

Após processamento, comparar pedido, tentativa, cobranças/fatos, operações, reservas, estoque, ledger e auditoria. Anotar efeitos únicos e pendências que continuaram abertas. Não repetir o executor global `process-payments-once.ps1` como se fosse uma consulta limitada ao caso.

## 4. Devolução após envio ou entrega: dinheiro e mercadoria separados

1. **Receber a solicitação:** registrar itens/quantidades e decisão comercial, sem alterar o estado físico para permitir um estorno. Este roteiro não define política jurídica de devoluções nem condiciona automaticamente o direito ao reembolso à inspeção física.
2. **Tratar a parte financeira:** se a devolução integral for autorizada e suportada, usar o fluxo do meio original após preflight. Em SHIPPED/DELIVERED, a confirmação financeira deve manter estoque e estado físico, tratar pontos pelo serviço existente e abrir `PHYSICAL_RETURN_REQUIRED`. Boleto pago e estorno parcial continuam lacunas específicas; não usar confirmação manual de WHATSAPP_PIX como atalho.
3. **Receber e inspecionar a mercadoria:** registrar data, recebedor, produto/variante persistidos, quantidade recebida, condição e evidência. Separar unidades revendáveis, avariadas e não recebidas. Rastreio entregue ao lojista é indício de transporte; não substitui conferência de conteúdo/quantidade.
4. **Controlar eventual reposição:** conferir estoque atual, reservas, versões e auditorias anteriores do caso. Somente unidades recebidas e aprovadas para venda podem compor uma reposição. Não ajustar produto agregado e variante para contar duas vezes; usar o ID exato. Produtos retirados exigem revisão própria, não reativação automática.
5. **Conferir reposições anteriores:** consultar reservas e auditorias de estoque. Não usar ajuste genérico para este fluxo. Se alguma unidade já foi reposta por outro ajuste, separar o caso para análise; o comando não identifica automaticamente a origem física de ajustes genéricos anteriores. Não confirmar a declaração de ausência de reposição nesse caso.
6. **Encerramento físico integral, após publicar a alteração de 19/10:** no detalhe do pedido, conferir todas as quantidades, informar unidades aptas para venda e referência privada da inspeção (sem dados pessoais), confirmar recebimento de todas as unidades ainda sem reposição e registrar uma vez. O servidor exige fato financeiro integral, revisão `PHYSICAL_RETURN_REQUIRED`, IDs e quantidades compatíveis com as reservas COMMITTED, operador Admin ativo da loja e versão atual. Unidades não aptas e todas as unidades de produtos/variantes retirados vão para `unavailableStock`. Produto e variante recebem a mesma movimentação, a reserva passa a RETURNED e o comprovante registra a alteração numa única transação. O pedido preserva SHIPPED/DELIVERED e ganha uma versão; o comando não cria fatos financeiros nem altera pontos. Não limpar códigos por SQL.
7. **Consultar o resultado:** o comprovante aparece no detalhe e no GET sem cache. Em timeout/resposta incerta, consultar antes de repetir. A interface não repete o POST automaticamente. Replay técnico exige o mesmo operador e conteúdo integral, incluindo commandId/versão; outro comando não pode repor novamente o mesmo pedido. A revisão física é encerrada e uma conciliação financeira posterior reconhece o comprovante. Revisões de outros motivos não são resolvidas pelo comando físico.

Os testes de #4/#5 foram feitos com mercadoria ainda na loja. São provas válidas de seus cenários, mas não fecham atendimento após entrega. A validação isolada do novo comando não substitui o aceite no destino. Quantidade ainda não recebida não pode ser declarada recebida para encerrar um caso: retornos parciais continuam fora do contrato.

## 5. Chargeback: atendimento e lacunas

Ao receber notificação ou identificar uma contestação na conta correta, registrar o ID do chargeback separado do ID da cobrança, estado, valor, datas, prazo aplicável e responsável. Consultar o caso real e preservar comprovantes pertinentes de compra/entrega e comunicações em local privado autorizado. Não enviar documentos pessoais por este repositório.

A documentação do Asaas prevê consulta de chargebacks e envio de disputa com documentação quando o caso é elegível; o identificador da disputa é o do chargeback, e o envio não garante reversão. Ver [consulta/listagem](https://docs.asaas.com/reference/list-chargebacks) e [criação de disputa](https://docs.asaas.com/reference/create-a-chargeback-dispute), consultadas em 16/10/2026. Essa disponibilidade documental não comprova configuração, prazo ou ensaio da conta do projeto.

Sequência operacional proposta:

1. Leno confere identidade financeira e situação de envio/entrega; Vanderlei verifica ingestão/revisão e acesso do responsável aos alertas. Não despachar uma compra que está sob revisão sem resolver sua elegibilidade operacional.
2. Responsável comercial decide o encaminhamento com os dados do caso e o canal autorizado do provedor. Registrar prazo, evidências e decisão; não criar automaticamente um REFUND adicional por causa do chargeback, pois pode duplicar a devolução.
3. Se houver contestação autorizada, registrar protocolo e referências dos documentos enviados pelo mecanismo disponível da conta, com acompanhamento até decisão. Não foi enviada disputa nesta preparação.
4. Após resultado do provedor, deixar o fluxo de conciliação consultar a cobrança atual. `REQUESTED`/`IN_DISPUTE` mantêm revisão; `DISPUTE_LOST`/`DONE` precisam de cobrança `REFUNDED` para confirmar devolução. `REVERSED` precisa de `CONFIRMED`/`RECEIVED`. Estado desconhecido, resposta incompleta ou combinação incompatível não libera o pedido. Fonte: [estados de chargeback](https://docs.asaas.com/docs/chargeback) e [fluxo financeiro](https://docs.asaas.com/docs/payment-events), conferidos em 19/10/2026. Aguardar reversão não equivale a saldo recuperado.
5. O fluxo grava observações selecionadas por cobrança/parcela na auditoria e apresenta a última evidência no Admin. Não armazena documentos, texto livre ou payload completo do provedor. Na ausência do objeto em cobrança com contestação conhecida, o adaptador consulta `GET /payments/{id}/chargeback`; falha não significa vitória. Webhook apenas provoca consulta; não confirma o resultado por conta própria.
6. Devolução confirmada reutiliza os fatos REFUNDED, compensações de pontos e proteção de estoque já existentes. Uma parcela não equivale ao contrato inteiro. Se houve entrega/envio, manter o histórico e aguardar inspeção física pelo procedimento da seção 4. Reversão favorável não duplica ganho de pontos, autorização ou e-mail. Cobrança anteriormente REFUNDED não volta a paga automaticamente.
7. Se existia REFUND local ainda READY quando surgiu a contestação, ele fica retido. Mesmo após vitória, conferir esse comando separadamente; não limpar `lastErrorCode`, trocar commandId ou voltar a fila por SQL. A confirmação de devolução pelo provedor pode concluir a operação existente sem outro POST. O código desta etapa não cria uma função de retomada desses comandos retidos.

**Lacunas para aceite:** publicar/revisar a candidata, demonstrar chegada real do evento/consulta e alerta ao responsável, validar procedimento de contestação disponível na conta e acompanhar um caso correlacionado no destino. Testes isolados de resultado financeiro, pontos, reserva, replay e retorno físico não provam envio de disputa nem comportamento da conta real. Prazos e documentos seguem responsabilidade do atendimento; nenhuma disputa foi enviada nesta implementação.

## 6. Comunicação com o cliente — textos para adaptar ao caso

- **Em revisão:** “Recebemos sua solicitação e estamos conferindo o pagamento do pedido. Não refaça o pagamento. Retornaremos pelo canal combinado até [prazo definido no caso].”
- **Estorno solicitado:** “A devolução foi solicitada e ainda aguardamos a confirmação do processamento. Vamos acompanhar e informar o resultado.”
- **Estorno confirmado:** “A devolução foi confirmada pelo meio de pagamento. [Referência permitida do comprovante.] O acompanhamento da mercadoria será tratado separadamente.” Usar somente após prova efetiva; não prometer data de crédito na fatura sem informação do provedor.
- **Retorno físico em conferência:** “Registramos o recebimento de [itens/quantidades conferidos] e estamos verificando a condição dos produtos. Informaremos o resultado pelo canal combinado.” Não afirmar recebimento antes da conferência.

## 7. Critérios de fechamento e próximos ensaios

| Parte do caso | Evidência mínima de fechamento |
|---|---|
| Financeira | Resultado remoto e local correlacionados; valor/moeda/parcelas corretos; fatos/auditoria e ausência de devolução duplicada. |
| Pontos | Compensações e eventual dívida registradas uma vez; saldo não ajustado para mascarar falta de origem. |
| Física | Recebimento/inspeção, destino das unidades, estoque/reserva e auditoria consistentes; ausência de reposição duplicada. |
| Comunicação | Cliente informado do estado comprovado e próxima ação; referências privadas preservadas. |
| Operacional | Responsável/revisor, horários, pendências, alerta e decisão registrados. Campo em branco significa desconhecido. |

Os ensaios isolados do retorno integral estão em `physical-return-atomicity.test.ts`, `physical-return-browser.test.ts` e na regressão financeira de `payment-durable-execution.test.ts`. O resultado de chargeback possui `chargeback-results.test.ts` e `chargeback-browser.test.ts`, além das regressões financeiras. O aceite remoto exige a candidata atual publicada. Envio de disputa e acompanhamento de prazo/documentação continuam fora do runtime desta etapa. Reutilizar os testes existentes quando não houver mudança.

**Estado desta entrega:** roteiro e modelo preparados; retorno integral e tratamento dos resultados de chargeback implementados localmente em 19/10. Os 16 testes finais de chargeback, incluindo navegador e rollback, passaram; a rodada anterior aprovou 97 testes de integração/regressão. [Registro técnico e hashes](evidencias/L-CHARGEBACK-RESULTADOS-2026-10-19.json). Operações de teste ficam restritas a fixtures descartáveis. Nenhum evento reenviado, comando financeiro/estoque executado em banco compartilhado, disputa enviada ou produção liberada. G3/G6 continuam abertos conforme suas evidências.

## Fontes de código revisadas

- `services/payment/payment-operations.service.ts`: elegibilidade e registro de CANCEL/REFUND.
- `services/payment/payment-supervision.service.ts`: backlog e efeitos da solicitação de reconciliação.
- `services/payment/payment-evidence.service.ts` e `refund-history.ts`: fatos, revisão, estorno e retorno físico.
- `services/payment/payment-outbox.service.ts`: revisão não é notificação de atendimento enviada.
- `services/payment/manual-refund.service.ts`: escopo exclusivo de pagamento manual.
- `lib/commerce/inventory-command.ts` e `order-fulfillment.ts`: ajuste auditado e bloqueios de expedição.
- `services/payment/chargeback.ts` e `components/admin/orders/ChargebackPanel.tsx`: classificação conservadora e apresentação da última evidência conciliada.
- `tests/integration/payment-durable-execution.test.ts`, `payment-lifecycle-homologation.test.ts` e `chargeback-results.test.ts`: proteção de estoque após entrega, revisão de resultado incompleto, perda/reversão e prevenção de estorno duplicado.
