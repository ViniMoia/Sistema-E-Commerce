# Execução financeira por alvo

Entrega para revisão sobre `homologacao_teste`, base `c2a6933`. O cron geral seleciona lotes: `limit=1` não identifica um pedido. Esta alteração acrescenta entradas internas que reutilizam o processamento financeiro existente e selecionam um evento ou uma tentativa com pedido, loja e conta correspondentes.

| Entrada | Seleção e efeito |
| --- | --- |
| `processPaymentInboxEvent(target)` | Evento exato, cobrança já correlacionada, referência e método compatíveis. Respeita prazo de nova tentativa e lease; não reabre COMPLETED/DEAD_LETTER. |
| `processExpiredOrders({ target })` | Tentativa e pedido exatos, prazo persistido vencido, sem revisão ou lease ativo. Consulta o provedor e solicita cancelamento quando ainda cabível; preserva a reserva enquanto não houver confirmação definitiva. Um alvo explicitamente nulo ou indefinido é rejeitado. A chamada sem propriedade `target` mantém o contrato de lote existente. |
| `reconcilePaymentCancellation(target)` | Somente tentativa CANCEL_PENDING do pedido/loja/conta informados, com operação CANCEL e sem operações de outro tipo. Respeita lease, revisão e prazo de reconciliação; consulta o provedor antes do envio e confirma o resultado depois. Operação possivelmente enviada não é reenviada. |

Não há nova rota HTTP, cron, migration ou mudança de configuração remota. São funções internas; não substituem autenticação e autorização de uma futura interface operacional. A publicação do código não habilita consumidores nem executa comandos financeiros. Os scripts privados usados para a execução local não integram a entrega.

## Evidência já concluída

1. [Evento PAYMENT_OVERDUE do nº 8](evidencias/L-PROCESSAMENTO-EVENTO-PEDIDO8-2026-10-23.json): concluído sem aprovação de pagamento ou liberação prematura.
2. [Revisão do prazo](evidencias/L-REVISAO-RESERVA-PEDIDO8-2026-10-23.json): `PaymentAttempt.reservationExpiresAt` era 20/10 às 00h BRT, incluindo 72 horas de tolerância. `InventoryReservation.expiresAt=null` não significava ausência de prazo efetivo.
3. [Cancelamento e reserva](evidencias/L-EXPIRACAO-PEDIDO8-2026-10-23.json): uma solicitação DELETE ao Asaas Sandbox, confirmação `deleted=true`, pedido CANCELLED e unidade RELEASED. Produto 98→99, variante 48→49; demais registros conferidos em 38 tabelas, inclusive a revisão do nº 3.

Os JSONs anteriores registram os estados e hashes de cada momento; flags como `codePublished=false` descrevem a execução local anterior à publicação deste pacote. Eles não são uma consulta do estado atual de implantação. Os horários sem sufixo nos snapshots PostgreSQL são UTC.

## Revisão por Vanderlei

Revisar correlação, seleção sem fallback, concorrência, repetição, bloqueios ativos, espera de confirmação e preservação dos demais pedidos. Aguardar a CI desta entrega e registrar a revisão aprovada antes de incorporá-la à candidata operacional. O guia [2.0/VANDERLEI.md](evidencias/guia/2.0/VANDERLEI.md) permanece como registro da distribuição anterior: a revisão da reserva nº 8 foi concluída e este pacote fornece o código antes ausente para análise.

Não repetir o evento nem o cancelamento do nº 8. A revisão de estorno do nº 3 continua independente; nenhuma operação de estorno foi rearmada. O evento ORDER_STATUS_CHANGED produzido pelo cancelamento continua fora da execução realizada. Sincronização SMB, exportação Nuvemshop e aceite de uma compra nova não estão comprovados por este caso.

## Validação

Na execução local anterior: 65 testes de integração e 8 testes unitários, tipos e lint aprovados. Para esta publicação, acrescentado teste para alvo explicitamente nulo/indefinido não selecionar lote. A validação da candidata e seus hashes estão em [L-PACOTE-EXECUTORES-2026-10-23.json](evidencias/L-PACOTE-EXECUTORES-2026-10-23.json). Bancos usados nos testes são descartáveis; main e seu banco permanecem somente leitura.
