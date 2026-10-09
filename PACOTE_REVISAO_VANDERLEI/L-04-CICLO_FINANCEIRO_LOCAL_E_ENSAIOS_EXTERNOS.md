# L-04 — Ciclo financeiro: evidência local e preparação externa

**Responsável:** Leno (Brega). **Revisor previsto:** Vanderlei (Que dá idéia errada), pendente. **Data:** 09/10/2026.

**Base de desenvolvimento:** `e0214e699b71de51696133de19808a1f8dbdc795`, branch de origem `trabalho/leno/l01-recuperacao-financeira`. L-04 começou sobre a entrega local de L-01. **Compartilhamento autorizado em 09/10/2026:** `homologacao_teste`, com commit identificável pelo roteiro de revisão desta pasta. A autorização posterior aos testes não aprova revisão, contratos externos ou implantação em produção.

## 1. Objetivo e escopo

Verificar que prazos por método, aprovação, recusa e reversão produzem efeitos persistidos corretos. A evidência local usa PostgreSQL 16 Docker descartável, 33 migrations, identidade/sentinela do harness e provedores explicitamente injetados. Sem acesso ao Neon, Preview, Asaas ou Resend nesta rodada. A referência do pedido #1 permanece preservada.

Este primeiro bloco não encerra L-04, WF-19 ou os critérios E06/E07/E08/E13. A integração externa, políticas comerciais, devolução física, chargeback e produtor de estorno de valor parcial continuam exigindo aceites próprios.

## 2. Duas regressões demonstradas antes da correção

A política existente `paymentEvidenceTransactionOptions` estabelece `maxWait=5000` e `timeout=30000` para transações locais que aplicam evidência financeira. Inbox e reconciliação já a utilizavam; checkout e expiração ainda dependiam do timeout padrão de cinco segundos.

Com atraso controlado de 5,5 s em uma consulta de pedido, dentro de uma transação PostgreSQL real:

- Criação PIX com resposta CONFIRMED terminou PROCESSING, pois a aprovação local foi revertida por transação expirada.
- Expiração encontrou a cobrança RECEIVED, mas a transação de aplicação expirou: `success=false`, `errorCount=1`, sem concluir a aprovação naquela execução.

Os dois testes falharam antes do patch, com diagnóstico Prisma de transação expirada. Os seis outros casos novos passaram na mesma rodada inicial.

**Correção:** `services/payment/checkout-payment.service.ts` e `services/order-timeout.service.ts` passaram a reutilizar a política existente nas respectivas transações de aplicação. Consultas/criação no provedor continuam fora delas. Não se alterou globalmente o timeout Prisma, nem schema, migration ou prazo de vencimento comercial. O limite de 30 s permanece finito; capacidade, locks e latência no ambiente candidato ainda pertencem à medição de V-08/L-08.

## 3. Oito cenários novos

| Cenário | Evidência esperada/verificada no teste |
|---|---|
| Aprovação imediata no checkout, banco lento | Pedido Pago, reserva COMMITTED, um ganho de pontos e uma confirmação na outbox; replay de conciliação não reemite cobrança nem duplica efeitos. |
| Expiração encontra pagamento recebido, banco lento | Aplica aprovação e fato SETTLED uma vez, sem cancelar a cobrança ou restituir estoque. |
| Boleto vencido dentro da tolerância congelada | Preserva reserva; não consulta/cancela pelo mero status de atraso. A política atual da proposta congela 72 h de tolerância; testar esse valor não constitui aceite comercial dela. |
| Boleto após a tolerância | Persiste CANCEL_PENDING e operação READY, mantendo estoque; só a prova de exclusão fornecida pela consulta permite cancelar o pedido e liberar uma unidade. |
| Cartão em análise de risco | Não usa expiração de PIX, mesmo se a fixture contiver prazo antigo; preserva reserva. |
| Todas as três parcelas recusadas | Cancela o pedido e libera estoque uma vez, sem ganho de pontos nem confirmação de pagamento. |
| Uma parcela inteira de três estornada | `applyPaymentEvidence` produz um fato REFUNDED de R$33,33 a partir da inspeção controlada; exige revisão, sem presumir estorno integral ou retorno físico. Replay não duplica o fato. |
| Estado de chargeback ainda não implementado | Exige PAYMENT_EXTERNAL_STATE_REVIEW; não inventa fato REFUNDED, compensação de pontos ou devolução de estoque. |

**Limite do caso de reversão parcial:** trata-se de uma parcela inteira estornada num contrato parcelado. Não é uma homologação de estorno de valor menor que uma parcela, comando de devolução parcial ou chargeback real. Os fatos foram produzidos pelo serviço de evidência, sem inserir FinancialFact diretamente, mas o transporte é controlado e não certifica o adapter ou a conta externos.

## 4. Reprodução e validação

```powershell
npm run test:integration:isolated -- tests/integration/payment-lifecycle-homologation.test.ts tests/integration/payment-durable-execution.test.ts tests/integration/payment-plan-authority.test.ts tests/integration/payment-process-recovery.test.ts
node node_modules/typescript/bin/tsc --noEmit --incremental false
node node_modules/eslint/bin/eslint.js services/payment/checkout-payment.service.ts services/order-timeout.service.ts tests/integration/payment-lifecycle-homologation.test.ts
```

**Resultado final:** **90 testes aprovados em quatro arquivos**: oito de ciclo financeiro, 40 de execução durável, 21 de autoridade do plano e 21 entre processos. Vitest **147,97 s**, testes **144,59 s**, sem incluir provisionamento. TypeScript e ESLint direcionado aprovados. Os dois casos de banco lento falharam antes do patch e passaram nesta seleção após a correção. Não somar os resultados de L-01 à execução atual, pois seus casos já estão incluídos.

Não houve build de release, carga, navegador, teste Linux ou recurso externo nesta rodada. As provas negativas de isolamento registradas em L-01 não foram repetidas porque o harness/proteção não mudou.

## 5. Ensaio externo a preparar após revisão/integração

**Operador da janela financeira:** Leno (Brega). **Revisor/consumidores de UI e infraestrutura:** Vanderlei (Que dá idéia errada). Os dois continuam com bancos locais próprios; nenhum muda configuração ou processa o Preview durante a janela do outro.

Antes da janela, identificar commit/deployment contendo esta entrega, conferir escopo sandbox-hml, tenant, hostname do banco, métodos efetivamente disponíveis na conta, webhook, remetente/destinatário permitido e filas já prontas. A resposta de disponibilidade dos métodos da conta ainda não foi recebida nesta preparação; não inferi-la da lista retornada pelo adapter. Preservar o pedido #1 e criar pedidos novos por cenário.

| Ordem proposta | Caso novo | Critério para encerrar |
|---|---|---|
| 1 | PIX criado e ainda pendente; solicitar cancelamento | Comando durável com identidade; resultado remoto conferido; pedido Cancelado, estoque liberado uma vez, sem crédito ou confirmação de pagamento. |
| 2 | PIX pago novo, ainda não expedido; solicitar estorno integral | Prova de estorno remoto, fato e valor corretos, estoque e pontos compensados uma vez, repetição sem novo efeito. |
| 3 | PIX vencido e pagamento tardio | Prazo real documentado; reserva mantida até prova de cancelamento; pagamento posterior não reabre o pedido ou retoma estoque; revisão/estorno tratado explicitamente. |
| 4 | Boleto e cartão 1x/parcelado/recusa | Só métodos disponíveis na conta; contrato completo, valores/datas bancárias, estados e instruções conferidos. Parcelamento permanece sujeito à aprovação específica. |
| 5 | Devolução parcial, física e chargeback | Primeiro fechar política e implementação aplicável, depois conferir produtor/contrato real; não encerrar com a revisão conservadora ensaiada acima. |

O endpoint existente `POST /api/admin/orders/[orderId]/payment-operation` aceita `kind`, `commandId` e `expectedVersion`, autenticando Admin e tenant no servidor. Registrar o comando uma vez e conservar sua identidade nos replays. Solicitar uma operação não comprova seu envio nem conclusão; o consumidor e a consulta de evidência completam o ciclo.

Para supervisão e processamento dirigido, usar o guia existente e `scripts/homologation/process-payments-once.ps1`. Iniciar por `-StatusOnly`; `limit=1` não seleciona exclusivamente um pedido nem limita todos os efeitos do lote. Um resultado incerto exige consulta do estado existente, sem repetição automática. A expiração real requer sessão própria e controle dos prazos; não alterar diretamente o banco compartilhado para acelerar seu vencimento. Nenhum dos passos desta tabela foi executado nesta rodada.

## 6. Entrega à outra frente

**Leno (Brega):** entregar código, testes/evidências e matriz de estados; depois coordenar os casos externos e decisões de política. Segredos continuam em canal privado e não fazem parte do material de revisão.

**Vanderlei (Que dá idéia errada):** revisar os patches, integrar as suítes ao fluxo apropriado de CI e verificar a UI para CANCEL_PENDING, REFUND_PENDING e revisão sem antecipar cancelamento/pagamento. Não mudar a semântica financeira para acompanhar um rótulo da interface. Google Cloud e deploy final continuam sob sua responsabilidade após os gates.
