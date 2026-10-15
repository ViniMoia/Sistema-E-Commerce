# L-04 — Vencimento e expiração de boleto não pago

Preparação em 15/10/2026; **pedido #8 emitido e identificado**, aguardando marcos de vencimento/expiração. Preservar #6 pago, #7 cancelado e PIX #3 em revisão. Main e banco de origem são somente leitura.

## Emissão do #8 conferida — 15/10/2026

Operador enviou proposta válida até 11:49:59, BOLETO/PICKUP, uma unidade Pequeno/Vermelho, total R$ 49,90 e ganho previsto de 24 pontos, sem desconto/frete/encargos. Após a conferência, enviou tela de emissão do #8, aguardando pagamento, vencimento 16/10/2026 nas duas ocorrências. PDF e detalhe remoto deste novo boleto ainda não foram apresentados.

Leitura READ ONLY/REPEATABLE READ às **14:37:51 UTC (11:37:51 BRT)** confirmou:

| Referência | Evidência |
|---|---|
| Pedido | `a7f348d4-7a75-41c1-a309-3b750b1a896e`, #8 PENDING v0, R$ 49,90, BOLETO/PICKUP, paidAt nulo |
| Tentativa | `115916a2-ea28-4b74-8fb9-6f46ed4aa219`, PENDING v1, ASAAS/sandbox-hml, sem erro |
| Cobrança | `f993c6c8-ecaf-461f-a167-7e3cccc71270`, `pay_9czuud2frrqpzov4`, PENDING, R$ 49,90 |
| Item | `432a0e08-1b67-4aa5-8dd2-29b02fdf32b5`, uma unidade, vínculos de produto/variante conferidos |
| Reserva | `4caa466a-7a88-412c-9d50-2cf8bbf234c1`, RESERVED |
| Estoque produto/variante | 92/42, versões 15/12 |
| Carteira/lotes | 310, lifetimeEarn 809, dívida/pendentes zero, sem movimentos de fidelidade do #8; creditados/resgatados zero |
| Operações/fatos/histórico/inbox | Vazios |
| Outbox | CHECKOUT_COMMITTED READY, sem tentativas |
| Limite externo | `2026-10-17T03:00:00Z` = **17/10 às 00:00 BRT** |
| Limite da reserva | `2026-10-20T03:00:00Z` = **20/10 às 00:00 BRT**, política congelada de 72 horas |

Preparado [diagnóstico dirigido ao #8](L-04-DIAGNOSTICAR_EXPIRACAO_BOLETO_PEDIDO_8.sql), incluindo auditoria de expiração e exclusão explícita dos #6/#7. Validado somente leitura às 14:38:39 UTC: um alvo correto, sem operação ou auditoria de expiração. Diagnóstico histórico do #7 preservado. Nenhuma fila processada pelo assistente.

Próxima conferência temporal: a partir de **17/10 às 00:00 BRT**, reler o mesmo pedido, verificar apresentação após vencimento e reserva preservada durante a tolerância. Em **20/10 a partir de 00:00 BRT**, realizar a etapa de expiração conforme seção 3, com habilitação efetiva do Preview antes de processar. Pode ser executada mais tarde nesse dia; não é necessário operar à meia-noite. Não afirmar que há agendamento automático validado. Até lá, manter boleto sem pagamento e sem CANCEL manual. A outbox READY está registrada, mas não requer rodadas financeiras apenas para avançar o relógio do ensaio.

## Fontes e estado inicial

- `origin/main` atualizado por fetch e conferido em `7f9b26e062ec2654420fecffb6dd78ad3ba1e017`: `lib/config/payment.config.ts` define boleto D+1 e piso R$ 5. `services/payment/due-date.service.ts` não tem diferenças entre main e homologação; pula fins de semana, usa o fuso do processo e não consulta feriados.
- Homologação: `services/checkout-plan.service.ts` congela `boletoConfirmationGraceHours=72`; `payment-evidence.service.ts` calcula `reservationExpiresAt = externalExpiresAt + 72 horas`. Horas corridas, não dias úteis. O limite externo representa o início do dia seguinte ao vencimento impresso em UTC−03.
- `services/order-timeout.service.ts` usa relógio do banco e prazo persistido. Antes de criar CANCEL, consulta o provedor e reconfere pedido/prazo sob bloqueio. OVERDUE não é prova de cancelamento. A reserva permanece até a evidência definitiva.
- Preview: `https://continental-prototipo-git-homologacaoteste-vinimoias-projects.vercel.app`, loja `3a82b33c-3646-4272-9a89-80bb1ba327a5`, conta esperada sandbox-hml.
- Na preparação, operador informou **PAYMENT_EXPIRATION_ENABLED=false** no Preview. Depois da emissão do #8, informou atualização para true e redeploy. Essa habilitação foi relatada pelo operador, sem inspeção independente da configuração do deployment pelo assistente. A rota `/api/cron/payments` passa `dryRun=true` quando a variável não é true: pode contabilizar candidatos sem efetivar expiração. `-StatusOnly` não expõe essa variável e não comprova sua habilitação.

Baseline READ ONLY/REPEATABLE READ às **14:27:16 UTC (11:27:16 BRT)**, usando `L-04-PREPARAR_BOLETO.sql`, host de homologação fixado:

| Referência | Valor |
|---|---|
| Configuração | v5, boleto e retirada habilitados |
| Produto | `a26fdbc1-d8c3-4173-b114-f759654b9ca4`, R$ 49,90, estoque 93, versão 14 |
| Variante | `c9422a68-9be8-4fdc-bc5f-5ee7689401d2`, Pequeno/Vermelho, ativa, estoque 43, versão 11 |
| Indisponíveis | Zero no produto e variante |
| Carteira/lotes | 310, lifetimeEarn 809, carteira v11, pendentes/dívida zero, nenhum lote vencido positivo |
| Boletos existentes do cliente | #6 PAID/RECEIVED; #7 CANCELLED/DELETED; nenhum pendente |

Revalidar em outra sessão ou diante de atividade concorrente. Não alterar saldos/estoques para coincidir com o baseline.

## 1. Emitir o novo boleto

1. No Preview, montar uma unidade do aspirador Pequeno/Vermelho, retirada no balcão, BOLETO, sem resgatar pontos e com endereço de cobrança completo.
2. Enviar a revisão antes de confirmar: mercadorias/total R$ 49,90, desconto/frete/encargos zero, ganho apenas previsto de 24 pontos.
3. Após conferência, confirmar uma vez. Em resposta incerta, consultar pedido/intenção antes de repetir. Registrar número/UUID, cobrança, tentativa, item, reserva e versões reais.
4. Conferir vencimento na tela, PDF e cobrança Sandbox. Não simular pagamento, pagar boleto/QR, confirmar retirada ou solicitar cancelamento manual. Não usar os scripts de CANCEL do #7.
5. Confirmar PENDING, paidAt nulo, uma reserva RESERVED, estoque 92/42, carteira/lotes 310 e zero movimentos de fidelidade, fatos de pagamento ou operações de cancelamento. Fixar o diagnóstico no novo alvo, preservando exclusões dos #6/#7.

## 2. Cronograma, condicionado ao vencimento efetivamente emitido

Se emitido em 15/10 com vencimento **16/10/2026** e política de 72 horas confirmada na nova tentativa:

| Momento em Brasília (UTC−03) | O que conferir |
|---|---|
| Emissão até o fim de 16/10 | Instruções válidas antes do limite, pedido pendente, uma unidade reservada, sem ganho de pontos |
| A partir de 17/10 às 00:00 (`2026-10-17T03:00:00Z`) | Limite externo alcançado. A projeção de compra deixa de oferecer PAY_BOLETO; conferir tela após nova consulta. Pedido/reserva podem continuar pendentes durante a tolerância. Status remoto OVERDUE depende de evidência do provedor, não do relógio local |
| De 17/10 até antes de 20/10 às 00:00 | Ainda dentro das 72h: a expiração local não deve solicitar CANCEL nem devolver estoque apenas por vencimento. Registrar eventual exclusão iniciada pelo provedor separadamente |
| A partir de 20/10 às 00:00 (`2026-10-20T03:00:00Z`) | Reserva elegível à expiração se pedido e tentativa ainda forem pendentes. É necessária execução do consumidor habilitado, não há garantia de execução exatamente nesse horário |

Confirmar datas reais de `externalExpiresAt`, `reservationExpiresAt` e `expiryPolicy` após a emissão. Não modificar vencimento remoto, timestamps do banco, política de tolerância ou relógio para acelerar este ensaio. Testes acelerados existentes usam fixtures isoladas; não substituem o resultado remoto.

## 3. Preparar a execução efetiva da expiração

Antes da rodada que deve efetivar a expiração, conferir todos os candidatos elegíveis na homologação: o executor é global, `limit=1` não fixa um pedido, e a habilitação também afeta a rota orders-timeout. Conferir consumidores/agendamentos ativos e escopo do deployment. Então configurar `PAYMENT_EXPIRATION_ENABLED=true` **somente para o Preview de homologação**, com redeploy e verificação do deployment efetivo. Não modificar Production/main. A configuração false relatada nesta preparação não foi alterada pelo assistente.

Usar `scripts/homologation/process-payments-once.ps1 -StatusOnly` para validar sandbox-hml e zero legados não rastreados. A consulta de status não prova que a expiração está habilitada; essa verificação é separada. Com o prazo real atingido, estado e configuração conferidos, executar uma única rodada controlada sem -StatusOnly e reler o diagnóstico antes de outra.

Ordem da rota: inbox → reconciliação → expiração → outbox. Se a expiração criar CANCEL nesta rodada, a reconciliação que despacha a operação normalmente ocorrerá em rodada posterior. É esperado `processedCount=1` com `cancelledCount=0` quando apenas a intenção de cancelamento foi criada. Com dryRun ativo esses contadores também não comprovam mutação: conferir operação/auditoria do alvo.

Exigir no novo pedido operação CANCEL de origem automática, chave derivada de `expiry:<attemptId>` e auditoria `PAYMENT_EXPIRATION_REQUESTED`/`ORDER_TIMEOUT`, efeito `payment-expiry:<attemptId>`. Um CANCEL manual não aprova este cenário. Enquanto a operação estiver pendente, manter reserva; erro/revisão ou falta de progresso exige diagnóstico, sem rodadas automáticas.

Se a consulta descobrir pagamento confirmado/recebido, não forçar cancelamento: aplicar evidência real e registrar que o cenário de boleto não pago mudou. Um recebimento após fechamento pertence ao teste separado de pagamento tardio.

## 4. Critérios de fechamento

- Mesma cobrança com exclusão confirmada por consulta identificada ao Asaas; não inferir exclusão por lista vazia/404 ou apenas HTTP do DELETE.
- Pedido/tentativa CANCELLED, operação COMPLETED, um fato CANCELLED de R$ 49,90 e histórico coerente, com auditoria comprovando origem por expiração.
- Reserva RELEASED uma vez, estoque 93/43 sem outras movimentações; carteira/lotes 310 e lifetimeEarn 809, sem ganho/resgate no novo pedido.
- Cliente vê pedido cancelado sem instruções ativas de pagamento; tarefas aplicáveis concluídas e leitura posterior estável.
- Distinguir execução controlada do serviço de expiração de comprovação de agendamento automático. Nenhum scheduler foi validado nesta preparação.

Preparação baseada em leitura do código, defaults da main, configuração informada pelo operador e baseline do banco. Nenhuma emissão, mutação financeira, mudança de configuração, processamento ou publicação executada pelo assistente. Ensaios de vencimento, tolerância e expiração continuam pendentes. Não cobre replay, todos os webhooks, pagamento tardio, estorno de boleto ou aceite de produção.
