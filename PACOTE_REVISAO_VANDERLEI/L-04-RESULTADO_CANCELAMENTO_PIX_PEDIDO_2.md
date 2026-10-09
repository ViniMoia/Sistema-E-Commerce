# L-04 — Resultado do cancelamento PIX do pedido #2

**Data:** 09/10/2026. **Responsável/operador:** Leno (Brega). **Revisor independente:** Vanderlei (Que dá idéia errada), parecer ainda pendente.

**Resultado:** cenário de cancelamento de PIX ainda não pago, incluindo replay do comando original, **aprovado no ensaio Sandbox descrito abaixo**. O resultado não encerra L-04, WF-19 ou os gates de produção.

## Ambiente e identidade

Código do Preview informado como Ready: `ede9cc2868c844393d9fab76a00fd3d6db9afdc5`, branch Git `homologacao_teste`. Escopo de conta recebido nas supervisões e registros: `sandbox-hml`. A identificação da seleção do banco/branch Neon é responsabilidade do operador; o agente analisou a saída enviada, sem conectar ao banco. Documentos complementares desta rodada permanecem locais até publicação posterior demonstrada.

| Elemento | Identidade |
|---|---|
| Pedido #2 | `e0bfe582-e85b-41e7-8b5c-d877b1e1a7e0` |
| Tenant | `3a82b33c-3646-4272-9a89-80bb1ba327a5` |
| Comando original | `l04-pix-cancel-pedido2-e0bfe582-v0`, CANCEL, expectedVersion=0 |
| Tentativa | `587d9515-030f-474f-9edf-ee6d1d722086` |
| Operação | `41d09e96-3454-4522-a338-be7b768e281f` |
| Cobrança Asaas | `pay_3cuzqjn8kvzirv3k` |
| Linha interna da cobrança | `e4ed6db3-2734-41c5-913a-dae994d8b8bb` |
| Item | `b0c0ea9e-e15d-44cc-90ee-e05ef66d5d6d` |
| Produto | `a26fdbc1-d8c3-4173-b114-f759654b9ca4` |
| Variante Pequeno/Vermelho | `c9422a68-9be8-4fdc-bc5f-5ee7689401d2` |

Compra de uma unidade de Aspirador de Pó automotivo, Pequeno/Vermelho, total R$ 49,90, retirada no balcão, sem resgate de pontos. O pedido #1 pago foi preservado como referência.

## Evidências combinadas

1. Antes da compra: estoque geral 8, Pequeno/Vermelho 4, Médio/Azul 4; carteira 113 disponíveis, 0 pendentes e quatro movimentações.
2. Após a compra: pedido #2 pendente, QR disponível, cobrança criada no Sandbox; estoque geral 7 e Pequeno/Vermelho 3.
3. Comando inicial: POST 202, replay=false, operação CANCEL/READY com as identidades acima. Processamento posterior concluiu conciliação e outbox, sem retry/review nos lotes informados.
4. Prova remota dirigida: GET 200, CHARGE_DELETION_VERIFIED, identityMatches=true, valor 49,90, PIX/referência conferidos pelo script e deleted=true. O status bruto PENDING do registro excluído foi normalizado para DELETED no domínio; não constitui pagamento ativo ou estorno de dinheiro recebido.
5. Replay com a identidade original: POST 202, replay=true, mesma tentativa/operação COMPLETED; GET antes/depois manteve versão 1, CANCELLED/DELETED e uma entrada de histórico. orderUnchanged=true para os campos selecionados pelo script.
6. Supervisão antes/depois do replay: às **13:20:17.639 BRT** e **13:35:09.743 BRT**, inbox 2 COMPLETED, outbox 5 COMPLETED e CANCEL 1 COMPLETED; nenhum outro estado listado, zero uncertain/overdue/abandonedLeases/untrackedLegacyOrders e oldestUnresolvedInboxAt null. Ambas somente leitura, processingAttempted=false.
7. Operador confirmou estoque, pontos e e-mail preservados após replay. Não recebeu confirmação de pagamento do #2; recebeu apenas aviso de cancelamento do Asaas.
8. [Consulta interna somente de leitura](L-04-AUDITAR_CANCELAMENTO_PEDIDO_2.sql): resultado INTERNAL_STATE_READ, processingAttempted=false, analisado abaixo. O código de leitura isolado não é aprovação automática; os registros foram comparados com os critérios do caso.

## Leitura interna recebida e conferida

| Registro | Resultado observado |
|---|---|
| Pedido | Um pedido, CANCELLED, versão 1, PIX, DELETED, total 49,90; paidAt=null, pointsRedeemed=0, pointsCredited=0. |
| Tentativa | Uma, identidade original, CANCELLED, ASAAS/sandbox-hml/PIX, externalReference do pedido, financialTotal=49,90, failureCode=null. |
| Cobrança | Uma, identidade interna acima, vinculada à tentativa, ID Asaas conhecido, ASAAS/sandbox-hml, ordinal 1, amount=49,90, DELETED, settledAt=null. |
| Operação | Uma CANCEL/COMPLETED, identidade original, mesmos attemptId/chargeId, completedAt preenchido, lastErrorCode=null. |
| Reserva | `672b5dd8-a4a2-4bc7-8894-e483d33b0055`, RELEASED, versão 1, quantidade 1, releasedAt preenchido, itemMatches=true; item/produto/variante correspondentes. |
| Fato financeiro | `fffa7f35-204c-403b-97b2-b5448ee5faa2`, único CANCELLED, ASAAS/sandbox-hml, amount=49,90, mesmos attemptId/chargeId, factKey `charge:e4ed6db3-2734-41c5-913a-dae994d8b8bb:CANCELLED`. Nenhum AUTHORIZED, SETTLED ou REFUNDED retornado. |
| Histórico | Uma entrada `cmv15dss40006rdqriz9r0f0p`, PENDING → CANCELLED, orderVersion=1. |
| Auditoria de cancelamento | Uma `c569976d-1505-4679-ad83-2ebc6c0dbdb6`, ORDER_STATUS_UPDATED, PENDING → CANCELLED, effectKey `order:e0bfe582-e85b-41e7-8b5c-d877b1e1a7e0:version:1`; uma restituição de quantidade 1 para AVAILABLE, nos mesmos produto/variante. |
| Estoque | Geral 8, indisponível 0, inventoryVersion=3; Pequeno/Vermelho 4, indisponível 0, inventoryVersion=3; Médio/Azul 4, indisponível 0, inventoryVersion=0. |
| Carteira | balance=113, pending=0, lifetimeEarn=612; walletMovementCount=4; orderLoyaltyMovementCount=0. |
| Outbox do pedido | Uma CHECKOUT_COMMITTED/COMPLETED e uma ORDER_STATUS_CHANGED/COMPLETED. Nenhuma PAYMENT_CONFIRMATION_EMAIL ou revisão retornada para o #2. |

Os timestamps sem offset no JSON do banco foram recebidos como `completedAt=2026-10-09T15:56:05.427` e `releasedAt=2026-10-09T15:56:09.885`. São preservados como valores retornados; não atribuir timezone ou converter esses campos sem confirmar a convenção de armazenamento. A leitura não trouxe horário de execução próprio.

## Aceite e limites

Os vínculos, quantidades, valores, estados e efeitos observados correspondem aos critérios do caso. Há uma reserva liberada, um fato de cancelamento, um histórico e uma restituição auditada, preservados após o replay; não há registro de pagamento/liquidação/estorno ou movimento de fidelidade do #2 na leitura. O valor do fato CANCELLED registra a cobrança cancelada, não um reembolso.

Este aceite técnico do cenário combina o retorno do operador, consulta específica do Asaas, replay, supervisões e leitura interna. Não certifica corridas concorrentes adicionais, expiração, pagamento tardio, estorno integral/parcial, outro método ou operação permanente dos consumidores. Também não audita todas as ações remotas/transitórias nem substitui o parecer independente ou a validação no candidato Google Cloud.

**Próximo cenário previsto em L-04:** estorno integral de um PIX novo pago, ainda não expedido. Preparar roteiro/identidades/referências e coordenar a revisão e a janela antes de criar/pagar/estornar externamente. A autorização excepcional de testar o cancelamento antes do parecer foi específica deste caso; não se estende automaticamente ao próximo. Preservar os pedidos #1 e #2 como evidências.
