# L-04 — Cancelamento de boleto ainda não pago no Sandbox

Preparado em 14/10/2026 após o fechamento da emissão/pagamento do #6. O novo pedido ainda não foi emitido nesta preparação. Não presumir número #7. Preservar o #6 pago e o PIX #3 em revisão. Main e seu banco são somente leitura.

## Base reaproveitada e ambiente

- Preview: `https://continental-prototipo-git-homologacaoteste-vinimoias-projects.vercel.app`, branch `homologacao_teste`, correção de vencimento publicada em `117ec92`.
- Loja `3a82b33c-3646-4272-9a89-80bb1ba327a5`, slug `continental-homologacao`; conta esperada `sandbox-hml`.
- Consultada `origin/main` em `7f9b26e`: defaults de boleto D+1 e piso R$ 5 em `lib/config/payment.config.ts`, já preservados. Não alterar políticas ou prazos para acelerar o ensaio.
- Reutilizar o fluxo durável de homologação em `services/payment/payment-operations.service.ts`: CANCEL exige pedido e tentativa PENDING e cobranças ainda não pagas. O consumidor despacha a operação uma vez e consulta o provedor; a resposta ao pedido de cancelamento não é prova de conclusão. `payment-evidence.service.ts` aplica evidência de exclusão/cancelamento e `order-command.ts` libera a reserva não consumida. Não substituir esse fluxo por edição direta de status ou exclusão manual no painel Asaas.
- REFUND de boleto continua bloqueado e é outro cenário. Se a cobrança receber pagamento durante o ensaio, interromper o cancelamento e conferir a evidência atual; não forçar CANCEL nem reutilizar scripts de crédito/PIX.

## Baseline somente leitura

[L-04-PREPARAR_BOLETO.sql](L-04-PREPARAR_BOLETO.sql) executado em transação READ ONLY/REPEATABLE READ às **21:05:48 UTC (18:05:48 BRT)** de 14/10/2026. A consulta usa o cliente do #5, sem retornar dados pessoais; não altera esse pedido.

| Referência | Valor observado |
|---|---|
| Boleto e retirada | Habilitados; configuração da loja v5 |
| Produto | Aspirador automotivo `a26fdbc1-d8c3-4173-b114-f759654b9ca4`, preço R$ 49,90 |
| Variante | `c9422a68-9be8-4fdc-bc5f-5ee7689401d2`, Pequeno/Vermelho, ativa |
| Estoques produto/variante | 93/43; indisponíveis zero; versões 12/9 |
| Carteira/lotes | 310; pendentes/dívida zero; lifetimeEarn 809; carteira v11 |
| Boletos existentes do cliente | Apenas #6 PAID v1, Asaas RECEIVED |
| Lotes vencidos positivos | Zero |

Revalidar se houver outra compra, alteração de estoque ou retomada em outro dia. O baseline não comprova por si só o ambiente do deployment nem ausência de atividade concorrente.

### Retomada em 15/10/2026

Baseline revalidado às **13:44:50 UTC (10:44:50 BRT)** no banco de homologação, com host conferido e transação READ ONLY/REPEATABLE READ. Resultado `BASELINE_READ`: configuração v5, boleto/retirada habilitados, estoque produto/variante 93/43 (versões 12/9), carteira/lotes 310, lifetimeEarn 809, pendentes/dívida zero e nenhum lote vencido positivo. O único boleto existente do cliente continua sendo o #6 PAID/RECEIVED; nenhuma nova emissão foi identificada nessa leitura.

Proposta enviada pelo operador conferida: uma unidade Pequeno/Vermelho, PICKUP/BOLETO, total R$ 49,90, desconto/frete/encargos zero, sem resgate e ganho apenas previsto de 24 pontos; validade exibida 10:57:53. Próximo passo: confirmar uma vez no Preview enquanto a proposta estiver válida e enviar o número real e a tela do novo pedido. Manter sem pagamento. Nenhuma emissão, cancelamento ou execução de filas foi feita pelo assistente nesta conferência.

## 1. Revisar e emitir um novo boleto, sem pagar

1. No mesmo Preview, montar uma unidade do aspirador **Pequeno/Vermelho**, **retirada no balcão**, **boleto**, **sem resgatar pontos** e endereço de cobrança completo.
2. Conferir a proposta: mercadorias/total **R$ 49,90**; desconto/frete/encargos zero; ganho previsto **24 pontos**, que não deve ser creditado neste teste. Enviar a revisão antes da confirmação.
3. Após a conferência, confirmar uma única vez. Registrar número e UUID reais, versão e identidade da cobrança. Se a resposta for incerta, consultar a intenção/pedido existente antes de tentar outra compra.
4. Conferir mesma cobrança no Sandbox, valor, referência, vencimento e estado pendente. **Não usar Confirmar pagamento**, não pagar boleto/QR e não confirmar retirada.

Usar [L-04-DIAGNOSTICAR_CANCELAMENTO_BOLETO.sql](L-04-DIAGNOSTICAR_CANCELAMENTO_BOLETO.sql). Após a emissão e a leitura de 15/10, o alvo foi fixado no #7, UUID `cd2153ce-9b36-4c9a-ba89-376bf201ae91`. A consulta originalmente sem alvo continua excluindo explicitamente o #6. Não alterar essa proteção.

## 2. Conferir emissão e preparar comando específico

Antes de solicitar cancelamento, confirmar: uma tentativa/cobrança BOLETO pendente; pedido PENDING; `paidAt` nulo; nenhuma operação anterior; reserva RESERVED de uma unidade; estoque **92/42**; carteira/lotes **310**, lifetimeEarn **809**, nenhum movimento de fidelidade do novo pedido e nenhum fato AUTHORIZED/SETTLED/REFUNDED.

Somente com essas identidades e versão observadas preparar o script específico de CANCEL para execução no Admin autenticado. O comando deve fixar origem, loja, pedido, cobrança, tentativa, valor, método, versão e item, mantendo commandId e operador em eventual replay planejado. Não deixar um POST genérico executável com identidades presumidas; não adaptar os scripts históricos do #2/#5 por troca manual de números.

HTTP 202 indica aceitação da operação durável. Guardar o ID retornado e conferir o estado antes do consumidor. Em timeout ou resposta inconclusiva, consultar a operação existente; não mudar commandId/version para criar outra solicitação.

## 3. Consumir e comprovar o cancelamento

Conferir primeiro o escopo com `scripts/homologation/process-payments-once.ps1 -StatusOnly`; exigir SCOPE_VERIFIED, sandbox-hml e ausência de legados não rastreados. Depois, uma rodada controlada sem -StatusOnly e nova leitura do diagnóstico. O executor é global e limitado; os contadores podem incluir outros pedidos. Não repetir automaticamente em erro/revisão ou falta de progresso. O #3 permanece separado.

| Momento | Resultado esperado sem outras movimentações |
|---|---|
| Emissão | Estoque 93/43 → 92/42; reserva RESERVED; pontos 310; `paidAt` nulo |
| Solicitação aceita | Operação CANCEL durável; cancelamento remoto ainda não comprovado; não antecipar retorno do estoque |
| Evidência final aplicada | Operação COMPLETED, tentativa e pedido CANCELLED; mesma cobrança observada como excluída/cancelada pelo provedor; fato CANCELLED de R$ 49,90; reserva RELEASED; estoque 93/43 |
| Fidelidade | Carteira/lotes 310, lifetimeEarn 809; zero EARN/REDEEM/REFUND do novo pedido |
| Leitura posterior | Mesmos IDs de efeitos, saldos e estado final; nenhuma segunda liberação de estoque |

Confirmar no provedor a mesma cobrança, sem inferir cancelamento a partir de 404, ausência de listagem ou apenas resposta ao DELETE. Conferir também histórico, tarefas e apresentação ao cliente: pedido cancelado sem instruções ativas de pagamento. Registrar notificação aplicável quando gerada; não exigir e-mail de pagamento aprovado para um boleto cancelado sem pagamento.

Um replay explícito do comando, se planejado depois do fechamento, exige preservar exatamente commandId, versão original e operador. Estabilidade em leituras sucessivas não equivale a esse teste. Vencimento automático, pagamento tardio e estorno de boleto continuam cenários separados.

## Emissão do #7 conferida em 15/10/2026

O operador enviou a tela do pedido #7 e o PDF Sandbox: ambos mostram **R$ 49,90**, retirada e vencimento **16/10/2026**. Leitura às **13:50:03 UTC (10:50:03 BRT)**, no host de homologação e transação READ ONLY/REPEATABLE READ:

| Referência | Estado observado |
|---|---|
| Pedido | `cd2153ce-9b36-4c9a-ba89-376bf201ae91`, #7 PENDING v0, paidAt nulo |
| Tentativa | `91e50803-019e-4f56-b3c9-9cb16ebd83e6`, BOLETO/PENDING v1, ASAAS/sandbox-hml |
| Cobrança | `63f47496-7646-4ca7-a6c7-80d172fb60c7`, `pay_ddili6nqoxts9jp3`, PENDING, R$ 49,90 |
| Item/reserva | `be7c9436-4c74-426a-8e3f-f4eae3ce479e` / `ff13f5ab-da72-4ddb-9172-2fb26ea7a5b8`, uma unidade, RESERVED, vínculos conferidos |
| Estoque produto/variante | 92/42, versões 13/10 |
| Fidelidade | Carteira/lotes 310; lifetimeEarn 809; dívida/pendentes zero; nenhum movimento do #7; pontos creditados/resgatados zero |
| Operações/fatos/histórico/inbox | Vazios para o #7 |
| Outbox | Uma CHECKOUT_COMMITTED READY |

O limite interno `dueAt`/`asaasDueDate` é `2026-10-17T03:00:00Z`, início do dia seguinte ao vencimento em UTC−03, conforme a semântica já documentada no roteiro de boleto. Não confundir esse limite exclusivo com a data impressa de 16/10. A leitura local não substitui consulta atual ao provedor.

Preparado [L-04-SOLICITAR_CANCELAMENTO_BOLETO_PEDIDO_7.js](L-04-SOLICITAR_CANCELAMENTO_BOLETO_PEDIDO_7.js) com o comando `l04-boleto-cancel-pedido7-cd2153ce-v0`, versão esperada 0. Executar uma vez no Console do Admin autenticado do mesmo Preview e enviar o JSON antes de processar filas. Não pagar, confirmar recebimento ou cancelar diretamente no Asaas. A solicitação durável ainda não foi executada pelo assistente; cancelamento remoto e retorno do estoque continuam pendentes de evidência.

Validação do script: sintaxe aprovada e 13 verificações com transporte simulado, incluindo bloqueio de outro ambiente, pedido pago/alterado/#6, versão/cobrança/item/pontos inesperados, leitura 401, aceitação, replay e incerteza após envio. Nenhuma chamada HTTP externa nesses testes; não comprovam cancelamento no Sandbox.

### Solicitação aceita e conferida em 15/10

O operador executou o script e retornou HTTP 202, `CANCEL_REQUEST_ACCEPTED`, `replay: false`. Operação `9e76ebab-ebe1-44f1-8372-af5d9939b868`, CANCEL/READY, vinculada à cobrança `63f47496-7646-4ca7-a6c7-80d172fb60c7` e à tentativa esperada.

Leitura somente leitura de **13:54:54 UTC (10:54:54 BRT)** confirmou a operação persistida, `submittedAt`/`completedAt` nulos, sem erro; tentativa CANCEL_PENDING v2. Pedido permanece PENDING v0, cobrança PENDING, paidAt nulo, reserva RESERVED, estoque 92/42 e carteira/lotes 310, sem movimentos de fidelidade ou fatos financeiros. Nenhum processamento executado pelo assistente. Próximo passo: conferir escopo do Preview com `-StatusOnly`, depois uma rodada controlada e nova leitura. Cancelamento remoto ainda não comprovado.

### Primeira rodada após a solicitação

Escopo informado pelo operador às **13:55:59 UTC**: SCOPE_VERIFIED, sandbox-hml, zero legados não rastreados. Rodada retornou reconciliation claimed=1/completed=0/review=1 e outbox claimed=1/completed=1, sem expiração ou inbox processados.

Leitura às **13:58:13 UTC** identificou que a revisão foi do **PIX #3**, atualizado às 13:57:30 UTC com `PAYMENT_REFUND_CANCELLED_REVIEW`, próximo reconcileAfter às 14:57:27 UTC. O #7 ainda tem reconcileAttempts=0, tentativa CANCEL_PENDING v2 e operação READY com submittedAt nulo: seu cancelamento não foi despachado nessa rodada. A outbox CHECKOUT_COMMITTED do #7 foi concluída. Estoque 92/42, reserva RESERVED e carteira/lotes 310 permanecem iguais, sem fatos financeiros ou movimentos de pontos do #7. Orientada uma nova rodada única, seguida de conferência; não reenviar a solicitação CANCEL nem alterar o #3. Os contadores globais não comprovam qual pedido será selecionado na próxima rodada.

### Segunda rodada: reconciliação do #4

Operador retornou reconciliation claimed=1/completed=1, sem review/retry; inbox/outbox/expiração sem trabalho. Leitura somente leitura às **14:00:29 UTC (11:00:29 BRT)** confirmou atualização do #4 às 13:59:43 UTC, permanecendo APPROVED, sem falha, próximo reconcileAfter às 14:59:34 UTC. O #7 continua CANCEL_PENDING v2, operação READY sem submittedAt, reconcileAttempts=0; pedido PENDING v0, estoque 92/42, reserva RESERVED, carteira/lotes 310, nenhum fato ou movimento de fidelidade.

O worker ordena elegíveis por reconcileAfter (nulos primeiro), depois ID, e o executor usa limit=1. Portanto, completed=1 não comprova conclusão da operação CANCEL do #7. Orientada outra rodada única e nova conferência; não reenviar CANCEL nem considerar o cancelamento aprovado com base no contador global.

### Terceira rodada: cancelamento aplicado ao #7

Rodada do operador: reconciliation claimed=1/completed=1, outbox claimed=1/completed=1, sem review/retry/expiração/inbox processados. Leitura READ ONLY/REPEATABLE READ às **14:02:40 UTC (11:02:40 BRT)** confirmou:

- Pedido #7 CANCELLED v1, paidAt nulo; tentativa CANCELLED v4, sem failureCode; mesma cobrança `pay_ddili6nqoxts9jp3` registrada como DELETED.
- Operação `9e76ebab-ebe1-44f1-8372-af5d9939b868` COMPLETED, submittedAt 14:02:01.907 UTC, completedAt 14:02:05.196 UTC, sem erro.
- Um fato CANCELLED de R$ 49,90 (`e4de109b-a798-41ef-8571-a3491d95c491`); um histórico PENDING → CANCELLED v1.
- Mesma reserva RELEASED; estoque produto/variante **93/43**, versões **14/11**, restituindo a unidade reservada.
- Carteira/lotes **310**, lifetimeEarn **809**, dívida/pendentes zero; nenhum movimento de fidelidade do #7, nenhum crédito/resgate de pontos.
- CHECKOUT_COMMITTED e ORDER_STATUS_CHANGED COMPLETED, uma tentativa cada. Nenhum evento inbox do #7 observado até esta leitura.

Cancelamento e efeitos internos conferidos. Não são necessárias novas rodadas para concluir essas tarefas. Próxima conferência visual: atualizar o pedido #7 no Preview e verificar cancelado sem instruções ativas de boleto/PIX; conferir a mesma cobrança no painel Sandbox sem executar ações financeiras. Os artefatos permanecem historicamente armazenados, mas o DTO em `purchase-result.ts` deve omiti-los em estado terminal. Ainda faltam essa evidência visual e a leitura posterior de estabilidade; não registrar replay deliberado, teste de webhook ou liberação de produção como concluídos. O assistente apenas leu o banco e atualizou a documentação.

### Conferência visual e consulta independente ao provedor

Operador enviou imagem do #7 cancelado na loja, sem ações de pagamento no cartão do histórico. A imagem inicial do Asaas era do #6, não do #7. Depois, a busca por cobranças removidas retornou vazia. Isso não comprova nem desfaz a exclusão: o detalhe do #7 no painel continua não localizado, e a tela vazia não deve encerrar o ensaio.

Nova leitura somente leitura às **14:23:05 UTC** confirmou estabilidade: pedido CANCELLED v1, mesma operação COMPLETED, mesmo fato CANCELLED, reserva RELEASED, estoque 93/43 (versões 14/11), carteira 310/lifetimeEarn 809 e nenhum movimento de fidelidade. Outboxes continuam concluídas em uma tentativa; inbox ainda vazio. Não houve replay financeiro.

Preparado [L-04-CONFERIR_COBRANCA_BOLETO_PEDIDO_7.ps1](L-04-CONFERIR_COBRANCA_BOLETO_PEDIDO_7.ps1): um único GET para `https://api-sandbox.asaas.com/v3/payments/pay_ddili6nqoxts9jp3`, conforme [documentação oficial](https://docs.asaas.com/reference/recuperar-uma-unica-cobranca). Solicita a mesma ASAAS_API_KEY Sandbox do Preview em entrada oculta; não usa CRON_SECRET, não altera cobrança, não processa filas e não imprime dados pessoais ou chave. Chave local ausente, portanto a consulta externa depende da execução pelo operador. Exige HTTP 200, ID/referência/método/valor corretos, deleted booleano verdadeiro e estado compatível com boleto não pago; 404 é inconclusivo.

Sintaxe e sete cenários simulados aprovados (exclusão, não exclusão, deleted textual, identidade divergente, estado recebido, falha de transporte e chave de produção rejeitada). Nenhuma consulta real ao Asaas foi realizada pelo assistente. Aguardando JSON da consulta independente antes do fechamento. Código revisado: o worker reinspeciona o provedor após DELETE e só aplica a evidência posterior; DELETED local não deriva apenas do sucesso HTTP do DELETE.

## Fechamento do cenário — 15/10/2026

**Cancelamento do boleto não pago #7 aprovado no Sandbox.** Operador retornou a consulta direta às **14:23:58.8889471 UTC (11:23:58 BRT)**: HTTP 200, `CHARGE_DELETION_VERIFIED`, `identityMatches: true`, cobrança `pay_ddili6nqoxts9jp3`, pedido `cd2153ce-9b36-4c9a-ba89-376bf201ae91`, BOLETO/R$ 49,90 conferidos pelo script, `status: PENDING`, `deleted: true`, `processingAttempted: false`. O estado remoto observado combina PENDING com a marca explícita de exclusão; não interpretar PENDING isoladamente como cobrança ativa. A confirmação veio da consulta identificada à API, não da ausência na listagem do painel.

Evidências reunidas: exclusão remota confirmada, pedido cancelado no histórico do cliente sem ações de pagamento visíveis, operação COMPLETED, um fato CANCELLED e uma transição PENDING → CANCELLED, reserva RELEASED, estoque restituído a 93/43, carteira/lotes 310 e lifetimeEarn 809 sem movimentos do #7. Leitura posterior de 14:23:05 UTC preservou IDs, versões e saldos da leitura de 14:02:40 UTC. As pendências históricas de consulta remota, visualização do histórico e estabilidade acima estão encerradas. Não repetir CANCEL nem executar filas para este pedido.

O motivo de o painel não listar a cobrança removida permanece não identificado; não é evidência de falha de cancelamento diante do GET identificado com deleted=true. Esta aprovação cobre o cenário executado, sem comprovar replay deliberado, consumo de webhook (inbox vazio na última leitura), todas as telas de recuperação/checkout, expiração, pagamento tardio, estorno de boleto ou liberação de produção. Documentação atualizada localmente; nenhuma publicação ou nova mutação financeira foi realizada pelo assistente.

## Estado da preparação original em 14/10

Nenhuma compra, operação financeira ou execução de filas foi feita pelo assistente. Apenas leitura do banco de homologação e preparação de documentos/SQL. Próximo passo do operador: enviar a nova proposta para conferência; o script de CANCEL será fixado após a emissão e a leitura das identidades reais.

Validação: SQL executado em transação somente leitura com parâmetros vazios (ORDER_SCOPE_REQUIRED) e com o #6 pago (ORDER_SCOPE_NOT_FOUND, zero pedidos), confirmando sintaxe e proteção do alvo. Dez testes existentes de `payment-recovery-adapter` aprovados com transporte simulado, incluindo consulta de cobrança excluída e 404 como incerteza. Não comprovam cancelamento remoto de boleto; esse resultado ainda será obtido no ensaio. Nenhuma alteração de código da aplicação ou publicação foi necessária nesta preparação.
