# Estorno integral no cartão — pedido #5

**Resultado em 14/10/2026, 13:11 de Brasília: ensaio aprovado no recorte cartão 1x, pontos, frete e produto não enviado.** Provedor confirmou REFUNDED e histórico DONE de R$ 57,20. Operação única COMPLETED; pedido CANCELLED v2; carteira/lotes 286 após REFUND_EARN -22 e REFUND_REDEEM +100 únicos; estoque 94/44 e reserva RETURNED v2. Webhook PAYMENT_REFUNDED consumido às 16:10:39.497 UTC, uma tentativa, sem erro. Comparação READ ONLY às 16:11:06 UTC com o estado anterior ao webhook confirmou igualdade de pedido, operação, fatos, carteira, lotes, alocações, movimentos, histórico e estoque. Dois eventos e quatro comandos da outbox do #5 COMPLETED. Nenhum novo lote necessário para este ensaio. Evidência em materiais/homologacao/pedido-5-estorno-apos-webhook.json. O caso #3, cartão parcelado e demais gates continuam separados. As instruções e checkpoints abaixo preservam a sequência executada; não repetir a solicitação.

Preparação em 14/10/2026. Ambiente: Preview `homologacao_teste`, conta `sandbox-hml`, loja `3a82b33c-3646-4272-9a89-80bb1ba327a5`. Esta etapa preparou arquivos e consultou o banco de homologação em transação somente leitura. Nenhum REFUND ou lote de processamento foi enviado. Main não foi alterada.

**Checkpoint remoto de 14/10, 12:13 de Brasília:** GET da cobrança confirmou ID, referência do #5, cartão e R$ 57,20, status CONFIRMED, deleted=false. GET do histórico retornou HTTP 200, object=list, hasMore=false, totalCount=0, offset=0 e data=null, inclusive com limit=100. Isso informa ausência de registros remotos nessa leitura; a seção de notificações do painel, isoladamente, não comprova histórico financeiro. Evidência em materiais/homologacao/pedido-5-remoto-antes-estorno-cartao.json.

**Bloqueio técnico encontrado antes do envio:** o parser publicado interpreta esse formato vazio como incompleto e encaminharia uma operação nova para PAYMENT_REFUND_HISTORY_REVIEW antes do despacho. Preparada correção restrita ao envelope explícito de primeira página vazia (object/list, contagem zero, offset zero, hasMore false, limite inteiro positivo e data null). Null sem essas provas continua inconclusivo. Mesmo com histórico vazio válido, operação já submetida ou cobrança REFUNDED continua exigindo revisão/prova de conclusão. Publicar e verificar a correção em homologação antes de executar o script de solicitação. Nenhuma operação do #5 foi enviada nesta investigação.

## Identidade e estado anterior

Validação local da correção do histórico vazio: 37 testes unitários (refund-history e asaas-adapter), 52 testes de integração de execução financeira durável com PostgreSQL descartável, TypeScript e ESLint direcionado aprovados. Publicação autorizada em 14/10/2026: commit `9d07510` enviado para homologacao_teste, deploy Vercel concluído para esse SHA. GitHub Actions ainda em execução na conferência da publicação. Estes testes não são um estorno remoto do #5; nenhuma solicitação financeira foi enviada durante o deploy.

Evidência local: [leitura anterior ao estorno](../materiais/homologacao/pedido-5-antes-estorno-cartao.json), às **14:42:33 UTC / 11:42:33 de Brasília**. O operador confirmou que o produto não foi enviado nem entregue.

| Campo | Estado observado |
|---|---|
| Pedido | #5, `bb3f722b-8392-4a23-863b-d2d428444faa`, PAID, versão 1 |
| Pagamento | CREDIT_CARD, 1x, R$ 57,20, CONFIRMED; sem prova de liquidação |
| Composição | Mercadorias R$ 49,90 − desconto R$ 5,00 + frete R$ 12,30; juros zero |
| Tentativa | `9255971c-e963-43f5-888c-3bec74ae1ab3`, APPROVED, conta sandbox-hml |
| Cobrança | `pay_806g4snct6ky0smq`, charge `b6da2a01-bf54-4484-a571-e257c1699cf1` |
| Operações/fatos de devolução | Nenhuma operação; nenhum fato REFUNDED |
| Carteira | Saldo 208, pendente 0, dívida 0, lifetimeEarn 807; lotes somam 208 |
| Pontos do pedido | REDEEM −100 e EARN +22, uma vez cada |
| Estoque | Produto 93 (versão 10), variante Pequeno/Vermelho 43 (versão 7) |
| Reserva | `67df065e-3818-45c8-b8a7-2505e386ce55`, uma unidade COMMITTED, versão 1 |
| Filas do pedido | Um evento de pagamento e três comandos da outbox COMPLETED |

## 1. Conferir antes de solicitar

1. No painel **Sandbox** do Asaas, localizar exatamente `pay_806g4snct6ky0smq`. Conferir cartão, R$ 57,20, referência do #5 e ausência de estorno já solicitado/em curso. Registrar somente status e histórico de estorno, sem dados do cartão ou credenciais. A consulta ao banco acima não prova o estado remoto atual.
2. Não clicar em estornar no painel do provedor: o ensaio usa a operação durável da aplicação. Se já existir devolução remota, interromper a solicitação e conciliar esse estado existente.
3. Se houver intervalo ou outra movimentação desde a preparação, repetir [o SQL de diagnóstico](L-04-DIAGNOSTICAR_ESTORNO_CARTAO_PEDIDO_5.sql). Não assumir saldo ou estoque globais imutáveis.

## 2. Solicitação única pela aplicação

Depois da conferência, abrir o Admin autenticado da loja no mesmo Preview e executar **uma vez** [L-04-SOLICITAR_ESTORNO_CARTAO_PEDIDO_5.js](L-04-SOLICITAR_ESTORNO_CARTAO_PEDIDO_5.js) no Console.

O script confere origem, loja, pedido, versão, cobrança, valores, método, item e histórico comercial antes do POST. O servidor valida autorização, conta financeira, tentativa, cobranças e estado sob transação. A leitura anterior ao POST não é uma trava; divergências são tratadas pelo servidor.

Comando fixo: `kind=REFUND`, `commandId=l04-card-refund-pedido5-bb3f722b-v1`, `expectedVersion=1`. O endpoint não recebe valor parcial: a operação abrange a cobrança integral de **R$ 57,20**, incluindo frete. Os R$ 5,00 de desconto serão restituídos como **100 pontos**, e não como dinheiro adicional.

Guardar o JSON. Esperado: HTTP 202, tentativa conhecida, uma operação REFUND vinculada à charge conhecida. A aceitação não comprova devolução financeira nem autoriza cancelamento manual do pedido. O script não processa filas; um consumidor já ativo pode avançar o estado independentemente.

Resposta perdida, erro, conflito ou estado inesperado: consultar o SQL e o provedor antes de repetir qualquer comando. Preservar commandId, versão e operador; não criar nova identidade para contornar conflito.

## 3. Consumo e conferência

**Solicitação aceita em 14/10/2026:** operador retornou HTTP 202, replay=false e operação `79a50d2d-6ff7-4e32-929f-05d677d645eb` REFUND/READY, vinculada à charge esperada. Leitura READ ONLY às 16:03:32 UTC (13:03:32 de Brasília) confirma uma operação, createdAt 16:03:05.084, submittedAt/completedAt nulos e sem erro; tentativa REFUND_PENDING, reconcileAfter 16:03:05.516. Pedido PAID v1, nenhum fato REFUNDED, carteira 208 e estoques 93/43 preservados. Evidência local em materiais/homologacao/pedido-5-estorno-solicitado.json. Próxima ação: um lote pelo executor com conferência de escopo embutida; não repetir a solicitação. Aceitação durável ainda não é devolução remota.

Primeiro conferir o JSON de aceitação e o estado atual. Se o trabalho continuar pendente, executar o consumidor existente em janela acompanhada:

```powershell
.\scripts\homologation\process-payments-once.ps1 -StatusOnly
# Depois de conferir escopo sandbox-hml e necessidade de consumo:
.\scripts\homologation\process-payments-once.ps1
```

O lote com limite 1 é global: pode selecionar outro pedido. Correlacionar contadores com o SQL específico do #5. O caso antigo #3 permanece em revisão; não rearmar, limpar ou reenviar sua operação.

Reler o SQL do #5 após o lote e conferir o histórico remoto. Se o provedor informar pendência de autorização, cancelamento, ambiguidade ou indisponibilidade, preservar a operação e diagnosticar a causa. Não repetir lotes continuamente nem antecipar compensações por SQL.

## 4. Critérios de aprovação

**Terceiro lote — devolução comprovada:** retorno reconciliation.completed=1 e outbox.completed=1, sem retries/review. Consulta READ ONLY às 16:09:01 UTC de 14/10 confirma operação original COMPLETED (submittedAt 16:08:05.001, completedAt 16:08:08.763), tentativa REFUNDED sem erro, cobrança REFUNDED e um único fato REFUNDED de R$ 57,20. Pedido CANCELLED v2, uma transição PAID → CANCELLED. REFUND_EARN -22 e REFUND_REDEEM +100 únicos, originais preservados; carteira/lotes 286, dívida/pendente zero, lifetimeEarn 785. Reserva RETURNED v2, produto 94/versão 11, variante 44/versão 8. Quatro tarefas da outbox COMPLETED. Evidência em materiais/homologacao/pedido-5-estorno-terceiro-lote.json.

GETs somente leitura ao Asaas Sandbox às 16:09:16 UTC confirmam a mesma cobrança/referência, cartão, R$ 57,20, status REFUNDED e histórico completo com um registro DONE de R$ 57,20 (data literal do provedor 2026-10-14 13:08:06). Evidência em materiais/homologacao/pedido-5-estorno-confirmacao-remota.json. Devolução remota e aplicação local comprovadas neste caso.

**Conferência ainda pendente:** webhook PAYMENT_REFUNDED `55c06163-aa1d-4446-9deb-cf8d2f90e347`, recebido às 16:08:07.615, permanece READY com zero tentativas. Orientar um lote para consumir esse evento e depois comparar IDs de fato, operação, movimentos, histórico e reserva, além dos saldos. Não solicitar outro estorno. O encerramento do ensaio com preservação dos efeitos após consumo depende dessa leitura posterior; o gate financeiro global continua separado.

**Segundo lote:** reconciliation.claimed=1/completed=1, sem revisão/retry, demais filas sem itens. A leitura às 16:06:37 UTC ainda mostra #5 inalterado: operação READY sem submittedAt, tentativa REFUND_PENDING v3, pedido PAID v1, nenhum fato REFUNDED, carteira 208 e estoques 93/43. Consulta das tentativas da loja correlaciona o processamento ao #4 (updatedAt 16:06:11.842, próxima conciliação 17:06:02.755). Na consulta, #5 é a única tentativa elegível dessa loja/conta; #1/#3/#4 têm datas futuras e #2 está CANCELLED. Orientado um próximo lote global e nova conferência, sem nova solicitação financeira. Evidência em materiais/homologacao/pedido-5-estorno-segundo-lote.json. completed=1 representa conclusão de trabalho do consumidor, não conclusão do estorno do #5.

**Primeiro lote após solicitação:** operador informou reconciliation.claimed=1/review=1, demais filas sem itens e expiração sem ações. Consulta somente leitura às 16:04:57 UTC correlaciona o resultado à revisão anterior do #3: tentativa atualizada às 16:04:28.325, PAYMENT_REFUND_CANCELLED_REVIEW, próxima consulta 17:04:25.379. O #5 permanece sem processamento: tentativa REFUND_PENDING v3 atualizada apenas na solicitação, operação original READY, submittedAt nulo, sem erro/fato de devolução. Pedido PAID v1, carteira 208 e estoques 93/43 preservados. Orientado mais um lote global seguido de nova conferência, sem repetir a solicitação do estorno. Evidência do #5 em materiais/homologacao/pedido-5-estorno-primeiro-lote.json.

| Evidência | Resultado esperado após conclusão, sem outros movimentos |
|---|---|
| Provedor | Cobrança REFUNDED e histórico de devolução integral concluída, total R$ 57,20 |
| Operação/tentativa | Uma REFUND COMPLETED, mesma charge; tentativa REFUNDED, sem erro pendente |
| Fatos | Um novo fato REFUNDED de R$ 57,20; fato original preservado |
| Pedido ainda não enviado | CANCELLED, versão 2, uma transição PAID → CANCELLED |
| Pontos | Uma REFUND_EARN −22 e uma REFUND_REDEEM +100; originais preservados |
| Carteira | Saldo e soma dos lotes 286; pendente/dívida zero; lifetimeEarn 785 |
| Estoque | Uma unidade restituída: produto 94, variante 44; reserva RETURNED, versão 2 |
| Auditoria/filas | Solicitação e transição rastreáveis; eventos e efeitos do #5 consumidos sem erro |
| Preservação dos efeitos | Nova leitura após consumo de eventos mantém os mesmos IDs, movimentos e saldos, sem segunda compensação |

Valores globais dependem da ausência de outras compras, ajustes ou expirações. Sempre correlacionar movimentos pelo pedido, charge, reserva e effectKey. O status comercial final é CANCELLED; REFUNDED pertence à tentativa/cobrança/fato financeiro. Não exigir que os campos históricos pointsRedeemed/pointsCredited sejam zerados para comprovar a reversão.

Se houver envio físico antes da execução, este roteiro de reposição automática deixa de se aplicar: estorno financeiro não comprova retorno físico. Não alterar o status para forçar o cenário.

Este ensaio cobre **cartão 1x com pontos e frete**. Não encerra estorno de cartão parcelado, devolução de mercadoria já enviada, estorno PIX nem a homologação global.
