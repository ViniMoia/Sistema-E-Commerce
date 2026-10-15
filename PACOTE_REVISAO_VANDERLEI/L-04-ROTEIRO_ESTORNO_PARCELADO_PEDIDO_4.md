# L-04 — Preparação do estorno integral parcelado #4

Estado em 15/10/2026: preparação, sem solicitação remota. Ensaio fictício no Asaas Sandbox/homologação. Operador confirmou que as seis unidades continuam na loja, sem entrega/retirada. Não repetir o estorno de crédito 1x do #5, já encerrado.

## Publicação e solicitação do ensaio

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
