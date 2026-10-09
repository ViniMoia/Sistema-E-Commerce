# L-04 — Conferência interna do cancelamento do pedido #2

**Operador:** Leno (Brega). **Revisor independente:** Vanderlei (Que dá idéia errada).

## Estado já demonstrado em 09/10/2026

Pedido #2 Cancelado, cobrança específica excluída no Asaas Sandbox, operação CANCEL concluída. Replay do comando original retornou a mesma operação e preservou versão 1, CANCELLED/DELETED e um único histórico de cancelamento. Supervisão posterior manteve inbox 2 COMPLETED, outbox 5 COMPLETED e CANCEL 1 COMPLETED, sem pendências listadas. Após o replay, Leno (Brega) confirmou novamente estoque geral 8 / Pequeno-Vermelho 4 / Médio-Azul 4, pontos 113 disponíveis / 0 pendentes / 4 movimentações e ausência de nova confirmação de pagamento do #2. O aviso de cancelamento do Asaas é uma notificação distinta.

A leitura dirigida dos registros internos foi recebida posteriormente e correspondeu aos critérios abaixo. O [resultado consolidado do caso](L-04-RESULTADO_CANCELAMENTO_PIX_PEDIDO_2.md) registra os IDs e o aceite técnico deste ensaio; revisão independente e L-04 como um todo seguem pendentes. As instruções a seguir preservam o procedimento utilizado, sem orientar repetição automática da consulta.

## Executar a leitura no ambiente correto

1. No Console Neon, abrir **SQL Editor** e selecionar o projeto, branch e banco **efetivamente usados por este Preview**. O nome da branch Git `homologacao_teste` não determina o nome da branch Neon. Conferir a seleção com a configuração do Preview, sem enviar a URL de conexão ou suas credenciais. A [orientação oficial do Neon](https://github.com/neondatabase/website/blob/main/content/faqs/create-tables-with-sql-neon.md) descreve a seleção de branch/banco no SQL Editor.
2. Abrir [L-04-AUDITAR_CANCELAMENTO_PEDIDO_2.sql](L-04-AUDITAR_CANCELAMENTO_PEDIDO_2.sql), copiar **todo** o conteúdo e executar uma vez. É um único SELECT com CTEs de leitura, limitado ao pedido, tenant e vínculos. Não usa funções da aplicação, chamadas ao Asaas ou processamento de filas.
3. Copiar o JSON da coluna **evidence** e enviá-lo para análise. O resultado inclui somente os campos técnicos selecionados e os saldos necessários, sem nome, e-mail, documento, endereço, IP, QR ou payload completo de auditoria/outbox.

O arquivo usa `public` e os nomes de tabelas/colunas de `prisma/schema.prisma`. Se aparecer erro de tabela/coluna, enviar apenas a mensagem técnica sem conexão/credenciais; investigar a versão e o schema selecionado antes de alterar qualquer coisa. Não aplicar migração, corrigir dados ou processar filas para fazer a leitura passar.

**ORDER_SCOPE_NOT_FOUND** significa que o pedido/tenant/número não foi localizado na seleção: revisar o ambiente. **INTERNAL_STATE_READ** indica somente que o pedido foi encontrado e a consulta retornou registros; não aprova automaticamente o caso. Mesmo IDs e providerAccount corretos não comprovam qual branch está selecionada, pois um clone pode conter os mesmos dados. A identificação do banco depende também da conferência do operador.

## Como interpretar o retorno

Os valores abaixo são critérios esperados pelo caso e pelo código. Só marcar observado depois de receber a leitura real.

| Bloco | Critério esperado |
|---|---|
| orderCount / order | 1 pedido; versão 1; CANCELLED; PIX; DELETED; cobrança `pay_3cuzqjn8kvzirv3k`; total 49,90; pointsRedeemed=0, pointsCredited=0, paidAt=null. |
| items | Um item, quantidade 1, Pequeno/Vermelho; conservar IDs de produto/variante para comparar os outros blocos. |
| attempts | Uma tentativa `587d9515-030f-474f-9edf-ee6d1d722086`, ASAAS/sandbox-hml/PIX, CANCELLED, externalReference do pedido, financialTotal=49,90 e failureCode=null. |
| charges | Uma cobrança com providerPaymentId conhecido, ASAAS/sandbox-hml, vinculada à tentativa, ordinal=1, amount=49,90, providerStatus=DELETED e settledAt=null. O ID interno desta linha é distinto do ID Asaas. |
| operations | Uma operação `41d09e96-3454-4522-a338-be7b768e281f`, CANCEL/COMPLETED, completedAt preenchido, lastErrorCode=null; attemptId e chargeId iguais às linhas correspondentes. |
| reservations | Uma reserva RELEASED, quantidade 1, versão 1, releasedAt preenchido, itemMatches=true. IDs de item/produto/variante correspondentes. RETURNED não é o destino esperado para uma reserva ainda não paga neste caso. |
| financialFacts | Um fato CANCELLED, ASAAS/sandbox-hml, amount=49,90, mesma tentativa/cobrança e factKey `charge:<ID interno da cobrança>:CANCELLED`. Nenhum AUTHORIZED, SETTLED ou REFUNDED. Esse valor registra a cobrança cancelada; não representa dinheiro recebido ou reembolsado. |
| history | Uma entrada PENDING → CANCELLED, orderVersion=1. |
| cancellationAudits | Uma auditoria ORDER_STATUS_UPDATED, PENDING → CANCELLED, effectKey `order:<UUID do pedido>:version:1`; uma restituição de quantidade 1 para AVAILABLE, nos mesmos produto/variante. |
| wallet / walletMovementCount | balance=113, pending=0, lifetimeEarn=612 e quatro movimentações para o comprador no tenant. |
| orderLoyaltyMovementCount | Zero movimentos de fidelidade ligados a este pedido: não houve resgate ou pagamento confirmado. |
| products / variants | Produto com stock=8 e unavailableStock=0; Pequeno/Vermelho stock=4 e Médio/Azul stock=4. Conferir os IDs persistidos. A versão de inventário é exibida, sem presumir seu número absoluto. |
| outboxForOrder | Pelo fluxo esperado, uma CHECKOUT_COMMITTED/COMPLETED e uma ORDER_STATUS_CHANGED/COMPLETED; nenhuma PAYMENT_CONFIRMATION_EMAIL ou revisão pendente do pedido. São registros dirigidos ao #2, diferentes das cinco saídas globais concluídas. |

Se aparecer outra linha, vínculo diferente, campo inesperado ou registro ausente, conservar o resultado e analisar a origem. Esta consulta não repara dados nem solicita novo CANCEL. Não tentar normalizar o resultado por UPDATE/DELETE.

## Limites e validação

Leitura única oferece um snapshot dos registros acessíveis à conexão, conforme o isolamento do PostgreSQL. Não comprova todo o histórico de execuções remotas, ausência de ações transitórias anteriores ou entrega de e-mails. Para efeitos únicos, combinar esta leitura, constraints/código e testes locais com o replay e as referências antes/depois já obtidas. Manter a janela de homologação isolada.

A consulta foi conferida contra o schema local e executada em **PostgreSQL 17 temporário, sem rede, com dados sintéticos**, em oito cenários: pedido ausente, caso esperado/saída sanitizada, tenant diferente, vínculo de reserva incorreto, reserva ausente, fato financeiro inesperado, e-mail inesperado na outbox e providerAccount diferente. Os casos anômalos permanecem visíveis; não são filtrados para produzir uma aprovação. Banco temporário removido ao final, sem acesso ao Neon, `.env` ou segredos. Não substitui a execução real do operador.

Depois de avaliar o retorno, atualizar o roteiro/evidência do caso e manter a revisão independente pendente enquanto não houver parecer. **L-04 como um todo continua aberto**, incluindo os demais cenários externos previstos no plano.
