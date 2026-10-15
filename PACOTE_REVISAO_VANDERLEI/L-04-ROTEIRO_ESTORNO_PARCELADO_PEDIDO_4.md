# L-04 — Estorno integral parcelado #4: cenário concluído

Estado atual em 15/10/2026: **cenário de estorno integral do cartão em 12 parcelas concluído no Sandbox**, incluindo histórico remoto, compensações e processamento dos 12 webhooks sem duplicação. Operador confirmou que as seis unidades continuam na loja, sem entrega/retirada. Não repetir a solicitação do #4 nem o estorno de crédito 1x do #5. As pendências deste cenário descritas abaixo são registros históricos superados pelo fechamento.

## Fechamento — 15/10/2026 às 16:31:45 UTC (13:31:45 BRT)

Após o último lote informado (inbox 2/2 concluído, sem revisão/retry), leitura READ ONLY/REPEATABLE READ confirmou **12 PAYMENT_REFUNDED COMPLETED, nenhum restante**, e quatro tarefas de outbox do pedido concluídas. Pedido CANCELLED v2 e tentativa REFUNDED sem failureCode; as mesmas 12 operações COMPLETED sem erro e todas as cobranças REFUNDED. Mantidos 12 fatos REFUNDED totalizando R$ 360,72 e apenas uma transição PAID → CANCELLED.

Reserva RETURNED de seis unidades; estoque produto/variante **98/48**, versões **16/13**, preservados após todos os eventos. Carteira e soma dos lotes **161**, pendente/déficit zero, lifetimeEarn **660**. Mesmo movimento único REFUND_EARN `9915ac6f-f730-4963-a32f-3b5ce2737ead`, **−149 pontos**, sem repetição. #8 continua PENDING v0 com sua reserva RESERVED de uma unidade.

Aceite deste cenário: estorno integral de **12 × R$ 30,06 = R$ 360,72**, prova remota fornecida às 15:50:33 UTC com um DONE por parcela, compensação única e estabilidade após os 12 eventos naturais. Nenhuma nova rodada é necessária para o #4. Não houve replay financeiro deliberado, compra real, prova em produção ou ensaio de devolução física; os demais gates do projeto continuam próprios. Registro de fechamento atualizado localmente; nenhuma nova publicação ou operação financeira foi executada pelo assistente nesta conferência.

## Histórico remoto final comprovado — 15:50:33 UTC (12:50:33 BRT)

**Segundo lote de webhooks conferido às 16:29:34 UTC (13:29:34 BRT):** confirmados **10 COMPLETED e 2 READY** do #4. Pedido CANCELLED v2, reserva RETURNED de seis, estoque 98/48 e versões 16/13, carteira 161/déficit 0/lifetimeEarn 660, 12 fatos REFUNDED totalizando R$ 360,72 e o mesmo REFUND_EARN único de −149 preservados. #8 PENDING v0/reserva RESERVED intacto. Nenhuma duplicação observada após dez eventos. Orientada uma rodada com `-Limit 2` para os dois restantes e conferência final; não repetir a solicitação REFUND.

**Primeiro lote de webhooks conferido às 16:26:11 UTC (13:26:11 BRT):** operador informou inbox 5/5 concluído, reconciliação 1 concluída e nenhuma revisão/retry. Consulta somente leitura confirmou **5 PAYMENT_REFUNDED COMPLETED e 7 READY** do #4. Pedido CANCELLED v2, reserva RETURNED de seis, estoque 98/48 e versões 16/13 preservados. Carteira 161, déficit 0, lifetimeEarn 660, mesmos 12 fatos REFUNDED totalizando R$ 360,72 e mesmo REFUND_EARN único `9915ac6f-f730-4963-a32f-3b5ce2737ead` de −149. #8 PENDING v0/reserva RESERVED preservado. Sem duplicação observada após estes cinco eventos. Próxima ação: mais uma rodada única com `-Limit 5` e conferência dos restantes; ensaio ainda aguarda sete eventos.

JSON fornecido pelo operador: HTTP 200, identidades/lista completa conferidas, 12 parcelas REFUNDED, nenhuma excluída; 12 históricos DATA_ARRAY completos, cada um com exatamente um registro DONE de R$ 30,06. Total devolvido comprovado: **R$ 360,72**. O código `INSTALLMENT_REFUND_RECORDS_FOUND` isoladamente não bastaria; a conclusão decorre dos status/valores de todos os registros.

Leitura local às **15:51:20 UTC** confirmou estabilidade: pedido CANCELLED v2, estoque 98/48 e versões 16/13, carteira 161, déficit 0, lifetimeEarn 660; mesmos 12 fatos REFUNDED (R$ 360,72) e um único REFUND_EARN. Os 12 PAYMENT_REFUNDED permanecem READY.

Acrescentado `-Limit` (1..5, padrão 1) ao script local de processamento, respeitando o limite já implantado na API. Cinco simulações validaram padrão, lote cinco, StatusOnly sem POST, escopo divergente sem POST e limite inválido; sem rede. Não requer redeploy. Próxima ação: **uma** execução de `.\scripts\homologation\process-payments-once.ps1 -Limit 5` e conferência. O limite vale para cada etapa global, não exclusivamente para #4; não executar laço automático. Depois ajustar as rodadas ao número efetivo de eventos restantes e comprovar ausência de efeitos duplicados. Não há novo estorno a solicitar.

## Estorno conciliado — leitura de 15/10 às 15:48:54 UTC (12:48:54 BRT)

Após rodada com reconciliação 1/outbox 1 concluídos, a consulta READ ONLY/REPEATABLE READ confirmou:

- #4 CANCELLED v2, `asaasPaymentStatus=REFUNDED`, tentativa REFUNDED v20 sem failureCode.
- As mesmas 12 operações COMPLETED, com submissão conjunta às 15:47:39.718 UTC e conclusão registrada às 15:47:52.502 UTC; 12 cobranças REFUNDED e 12 fatos REFUNDED somando R$ 360,72. O timestamp de conclusão é capturado pela transação antes do commit; o histórico comercial foi gravado às 15:48:08.769 UTC.
- Uma reserva RETURNED de seis unidades; estoque produto/variante **98/48**, versões **16/13**, aumento único de seis sobre 92/42.
- Um movimento `REFUND_EARN` de **−149** (`9915ac6f-f730-4963-a32f-3b5ce2737ead`), carteira **161**, déficit/pendente zero, lifetimeEarn **660**. O campo histórico `pointsCredited=149` permanece no pedido; a reversão está no ledger.
- Uma nova tarefa ORDER_STATUS_CHANGED (`ee24f3eb-5fdd-4a2d-af0f-c9d83a4704d2`) COMPLETED em uma tentativa. Nenhuma tarefa de e-mail de estorno foi identificada; não presumir envio de comunicação não registrada.
- Boleto #8 PENDING v0, reserva de uma unidade RESERVED, preservado.

Chegaram **12 PAYMENT_REFUNDED READY** entre 15:47:47 e 15:47:56 UTC. A reconciliação já aplicou os efeitos; o consumo posterior deve preservá-los, sem novo estorno/estoque/pontos. Não encerrar o ensaio completo antes dessa prova. Próxima conferência pontual: `L-04-CONFERIR_PARCELAMENTO_PEDIDO_4.ps1 -RefundHistory`, somente leitura, esperando 12 REFUNDED e histórico DONE correspondente ao total. Depois consumir os webhooks de forma controlada e comparar os mesmos fatos, movimento e saldos. Não executar novamente o script de solicitação.

## Solicitação aceita e conferida — 15/10/2026

Publicado `c210f286ba5c9d306e5a3b6f979525cd215888d5` em `homologacao_teste`; status da integração Vercel confirmou sucesso às 15:33:14 UTC (12:33:14 BRT). Operador executou o comando específico e recebeu HTTP 202, `REFUND_REQUEST_ACCEPTED`, `replay=false`, com 12 operações READY.

Consulta READ ONLY/REPEATABLE READ às **15:35:29 UTC (12:35:29 BRT)** confirmou os 12 IDs de operação retornados, uma única identidade de comando, todos READY com `submittedAt=null` e sem erros. Tentativa `41ede05c-40fd-4542-800c-311af6b25cb8` REFUND_PENDING v18, conta sandbox-hml e contrato esperado. Pedido PAID v1, parcelas CONFIRMED, 12 fatos AUTHORIZED, nenhum REFUNDED. Reserva COMMITTED de seis unidades; estoque 92/42, versões 15/12. Carteira 310, déficit/pendente zero e lifetimeEarn 809 preservados. #8 PENDING v0 com sua reserva RESERVED de uma unidade.

Próximo passo: uma rodada de `.\scripts\homologation\process-payments-once.ps1`, que já verifica escopo sandbox-hml antes de processar. O lote é global e pode selecionar outro pedido; enviar o JSON e conferir o estado do #4 antes de repetir. Não reenviar o comando REFUND. Os 12 registros acompanham as parcelas de **uma única solicitação remota do contrato**, não 12 chamadas de estorno. Nesta conferência o assistente fez somente leitura; processamento ainda não executado.

**Primeira rodada informada:** reconciliação 1 concluída e outbox 1 concluído, sem erros/revisões. Leitura às 15:40:24 UTC confirmou #4 ainda PAID v1, tentativa REFUND_PENDING v18, todas as 12 operações READY/submittedAt nulo, sem fatos de estorno. Estoque 92/42 e carteira 310 intactos. A tentativa do #8 foi atualizada às 15:38:02 UTC e continua PENDING; isso é compatível com a rodada ter conciliado o boleto, não o #4. A identidade da tarefa de outbox não foi determinada pelo contador global. Fila consultada depois mostrou #3 (revisão histórica de PIX) antes do #4 por reconcileAfter. Orientada outra rodada única e nova conferência, sem repetir o comando REFUND; eventual review do #3 não deve ser atribuída ao #4 sem leitura específica.

## Publicação e solicitação do ensaio

**Segunda rodada — revisão identificada:** operador retornou reconciliação 1 em review, demais etapas sem trabalho. Leitura somente leitura às **15:44:27 UTC (12:44:27 BRT)** confirmou atualização do PIX #3 às 15:43:55 UTC, com `PAYMENT_REFUND_CANCELLED_REVIEW` e próxima consulta às 16:43:53 UTC. O #4 permanece REFUND_PENDING v18, sem failureCode, 12 operações READY/submittedAt nulo, pedido PAID v1, sem fatos REFUNDED. Estoque 92/42, reserva COMMITTED de seis unidades e carteira 310/lifetimeEarn 809 preservados. Entre as tentativas consultadas, #4 agora precede #8 por reconcileAfter; #3 foi reagendado. Orientada mais uma rodada única seguida de conferência. Nenhuma nova solicitação REFUND deve ser criada.

Operador autorizou publicar a correção na homologação e seguir com o teste. Preparado `L-04-SOLICITAR_ESTORNO_PARCELADO_PEDIDO_4.js` para o Console do Admin autenticado no Preview, após confirmação do deployment. Nova leitura somente leitura confirmou #4 PAID v1, tentativa APPROVED, 12 parcelas CONFIRMED e nenhuma operação existente. O script exige a identidade/versão/valores/itens conferidos e valida o retorno das 12 operações. Usa `commandId=l04-card-refund-pedido4-ae14cb17-v1`, que não deve ser alterado em replay planejado.

Executar uma vez e enviar o JSON. HTTP 202 significa solicitação durável aceita, não estorno concluído; manter a sequência de conferência antes do processamento das filas. Nenhum POST é repetido automaticamente em caso de erro. Script validado sintaticamente e em seis cenários simulados (aceite, origem errada, estado alterado, operações duplicadas, timeout e HTTP de conflito), sem chamadas remotas. O assistente não dispõe da sessão de Admin do navegador; a solicitação é executada pelo operador.

## Identidade e baseline

Leitura READ ONLY/REPEATABLE READ às 15:02 UTC; complemento de fidelidade/operações às 15:06:48 UTC. Código consultado: homologação `2c9d75f`; referência main somente leitura `7f9b26e`. Nenhuma alteração na main ou em seu banco.

| Campo | Evidência interna |
|---|---|
| Pedido | #4 — `ae14cb17-49fa-47ae-98eb-b48ef3f8ada1`, PAID v1 |
| Loja | `3a82b33c-3646-4272-9a89-80bb1ba327a5` |
| Tentativa | `41ede05c-40fd-4542-800c-311af6b25cb8`, APPROVED v17, ASAAS/sandbox-hml |
| Contrato | `cb6d68ce-0b2a-4e10-ab36-8edc15cbdff4` |
| Cobrança principal | `pay_4up6nmdy5f3jnroi` |
| Valor | 12 × R$ 30,06 = **R$ 360,72**, incluindo R$ 61,32 de encargos sobre R$ 299,40 de mercadorias |
| Parcelas internas | 12 CONFIRMED, 12 fatos AUTHORIZED; nenhuma operação registrada |
| Produto | 6 aspiradores Pequeno/Vermelho, retirada, reserva COMMITTED |
| Estoque | Produto 92 / variante 42; versões 15/12 |
| Fidelidade | Carteira 310, pendente 0, déficit 0, lifetimeEarn 809; ganho original 149, lote original remanescente 85 e lote descendente restituído com 64 |

## Próximo passo: conferir o provedor sem alterar cobranças

Executar na raiz do projeto:

```powershell
.\PACOTE_REVISAO_VANDERLEI\L-04-CONFERIR_PARCELAMENTO_PEDIDO_4.ps1
```

A chave Sandbox é solicitada em entrada oculta. Compartilhar somente o JSON resultante. O script executa apenas GET, valida os 12 IDs/ordinais/valores e o vínculo com pedido/contrato. Paginação incompleta, duplicatas ou identidade divergente impedem confirmação. Não imprime dados pessoais nem credenciais.

`INSTALLMENT_IDENTITY_VERIFIED` comprova somente identidade/lista completa. Histórico ausente na resposta não equivale a ausência de estorno: `refundHistoryVerified` permanece false. Conferir depois o histórico remoto das parcelas antes de registrar qualquer comando; não executar REFUND pelo painel em paralelo.

**Resultado recebido do operador em 15/10 às 15:12:27 UTC (12:12:27 BRT):** HTTP 200, `INSTALLMENT_IDENTITY_VERIFIED`, 12 identidades corretas, R$ 360,72, todas CONFIRMED e `deleted=false`. Todos os `refundCountInList` vieram nulos; nenhum histórico remoto foi comprovado. Nenhuma solicitação/processamento ocorreu por esse script.

Para a segunda conferência, o mesmo script agora aceita:

```powershell
.\PACOTE_REVISAO_VANDERLEI\L-04-CONFERIR_PARCELAMENTO_PEDIDO_4.ps1 -RefundHistory
```

Revalida a lista e executa até 12 consultas pontuais ao [histórico oficial de estornos](https://docs.asaas.com/reference/listar-estornos-de-uma-cobranca). `INSTALLMENT_REFUND_HISTORIES_EMPTY` exige 12 históricos completos e vazios; registros existentes geram `INSTALLMENT_REFUND_RECORDS_FOUND` com status/valor sanitizados. Resposta ausente, formato desconhecido, paginação incompleta ou falha HTTP permanecem inconclusivos, informando quantas consultas terminaram e a parcela interrompida. Mesmo histórico vazio não comprova a semântica de disparo descrita abaixo nem representa snapshot atômico com o banco local.

## Adaptação do executor preparada antes do disparo

O executor publicado em `2c9d75f` cria operações por parcela e chama `refundPayment(paymentId, amount)` para cada uma (`payment-worker.service.ts` e `asaas.client.ts`). Os testes isolados cobriam esse modelo, mas não comprovavam sua equivalência ao estorno integral do contrato no provedor.

A documentação oficial oferece [estorno do parcelamento](https://docs.asaas.com/reference/estornar-parcelamento) por `POST /v3/installments/{id}/refund`, omitindo `value` para estorno integral. Também existe [estorno de cobrança](https://docs.asaas.com/reference/estornar-cobranca). Não foi comprovado que 12 chamadas individuais sejam equivalentes a uma chamada do contrato. A implementação local foi adaptada para usar diretamente o endpoint documentado do contrato, sem valor parcial, mantendo as operações individuais para acompanhamento das evidências.

Antes da única chamada, as operações de todas as parcelas passam juntas para SUBMITTING em transação com bloqueio do pedido e verificação da posse da execução. Exige contrato, parcelas/valores coerentes, mesma identidade de comando/operador e nenhuma submissão anterior. Resposta inconclusiva deixa todas UNKNOWN; a recuperação consulta evidências sem reenviar. Operações antigas parcialmente submetidas vão para revisão, sem converter o restante em novo estorno integral. Aprovação HTTP não compensa estoque/pontos: continua necessária a prova de conclusão das parcelas. Crédito 1x e PIX mantêm o endpoint por cobrança.

Validação local: **55 testes de integração** no PostgreSQL descartável `ecommerce_test_1bf051d8ae2b4c9889c919e61842626c`, **42 testes unitários**, TypeScript e ESLint aprovados. Cobertos concorrência, solicitação única, repetição do comando sem duplicação, resposta perdida, conclusão parcial, revisão de lote legado e ausência da capacidade de estorno do contrato. Integração utiliza transporte simulado; não equivale ao ensaio real no Sandbox. Sem migrations novas. **Correção ainda não publicada: publicar na homologação e verificar o deployment antes de preparar/executar o comando do #4.**

## Critérios de fechamento

- Prova remota do estorno integral de R$ 360,72 e das 12 parcelas, com histórico concluído; pedido aceito/HTTP 202 ou contadores globais não bastam.
- Fechamento local somente após evidência integral, sem compensar antecipadamente quando apenas parte das parcelas estiver estornada.
- Devolução única das seis unidades: estoque esperado 98/48 se não houver outros movimentos. Preservar a reserva de uma unidade do boleto #8.
- Reversão única do ganho de 149 pontos. A auditoria por `originTransactionId` encontrou 85 no lote original e 64 em lote descendente restituído; os 64 haviam sido resgatados e depois devolvidos. Validar consumo dos dois lotes conforme `lib/commerce/loyalty-ledger.ts`, sem presumir que só os 85 serão retirados ou que há déficit. Com o baseline atual e sem outros movimentos, expectativa de carteira 161, déficit 0 e lifetimeEarn 660.
- Conferir histórico, filas, comunicação e estabilidade dos efeitos em nova consulta. Repetição deliberada do comando/evento é um ensaio separado, mantendo sua identidade.

O boleto #8 permanece sem pagamento/cancelamento manual, aguardando os marcos registrados no roteiro de expiração. Nenhum comando de estorno ou processamento foi executado nesta preparação.

Validação do script: análise sintática PowerShell e oito verificações com transporte simulado aprovadas (lista válida, duplicata, valor, pedido, ordinal, parcela ausente, paginação incompleta e erro de rede). Verificada a distinção entre histórico ausente e vazio e a ausência de credenciais/erro bruto na saída. Nenhuma chamada remota executada nesses testes.

Validação da extensão `-RefundHistory`: 15 casos simulados aprovados, incluindo arrays vazios em três formatos, estorno pendente existente, resposta desconhecida/nula, paginação inconclusiva, status/valor inválidos, interrupção na terceira consulta, identidade divergente e compatibilidade do modo original. Corrigida a ordenação no PowerShell com objetos explícitos; saída validada de 1 a 12. Testes não acessaram rede nem substituem a execução do operador.

## Ajuste do diagnóstico após HTTP 200 inconclusivo

O operador retornou `LOOKUP_UNRESOLVED`, HTTP 200, zero históricos conferidos e falha na parcela 1. Isso localiza a interrupção após a consulta, mas não revela o corpo recebido nem comprova ausência/presença de estorno.

Encontrada uma lacuna no script: `services/payment/refund-history.ts`, commit `9d07510`, já aceita a página explicitamente vazia com `object=list`, `data=null`, `totalCount=0`, `offset=0`, `hasMore=false` e `limit` inteiro positivo. O script ainda não reproduzia essa regra. Adicionada essa compatibilidade estrita e paginação `limit=100&offset=0`; null isolado, campo ausente ou metadados divergentes continuam inconclusivos. Essa é uma causa possível para o retorno do operador, ainda não comprovada remotamente.

A versão `diagnosticVersion=2` informa a etapa da falha, motivo controlado e somente metadados estruturais conhecidos (tipo de data, paginação), sem corpo bruto, dados pessoais ou mensagem livre da exceção. Em caso de sucesso, informa o formato de cada histórico. Validada em 23 casos simulados no Windows PowerShell 5.1, sem rede, incluindo página vazia explícita, campos ausentes/tipos divergentes, preservação de registros e interrupção parcial. Próximo passo: repetir somente a consulta `-RefundHistory` com o arquivo atualizado. Nenhum estorno, processamento, banco ou main alterado.

**Reteste remoto concluído pelo operador às 15:22:57 UTC (12:22:57 BRT), em 15/10:** `INSTALLMENT_REFUND_HISTORIES_EMPTY`, HTTP 200, 12/12 históricos validados, todos `EXPLICIT_EMPTY_PAGE`, zero registros. Identidades conferidas, total R$ 360,72, 12 CONFIRMED e `deleted=false`. Confirma o formato que faltava no script. O passo de repetir esse diagnóstico acima está encerrado; não há necessidade de novas consultas apenas para obter o mesmo resultado. Essa é uma evidência anterior ao estorno, não um estorno concluído. Solicitação/processamento permanecem false.
