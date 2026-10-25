# G3 — Atendimento de revisão financeira, devolução e chargeback

**Próximo ensaio preparado em 21/10:** [roteiro de aceite financeiro G3](ROTEIRO_ACEITE_FINANCEIRO_G3.md) e [modelo de execução](modelos/ACEITE_FINANCEIRO_G3.json), baseados na integração `9495ff9`. Contêm pré-requisitos de publicação/consumidores, resultados esperados, evidências e critérios de interrupção para PIX, boleto, retorno físico e chargeback. Estado NOT_EXECUTED; não autorizam estornos ou reaproveitamento dos pedidos antigos. O fluxo de boleto está integrado, mas permanece sem aceite na conta/destino.

## Implementação de boleto pago — 21/10/2026, ainda sem publicação

O fluxo específico foi implementado na branch `feat/boleto-refund-20261021`, sobre `cc405e8`. As lacunas de código descritas na triagem abaixo são o estado anterior desta entrega. **O ensaio na conta Sandbox e o aceite de G3 continuam pendentes.** [Registro da implementação e validações](evidencias/L-BOLETO-DEVOLUCAO-2026-10-21.json).

**Revisão/CI:** [PR #12](https://github.com/ViniMoia/Sistema-E-Commerce/pull/12), inicialmente em `97cd252`. A [primeira execução](https://github.com/ViniMoia/Sistema-E-Commerce/actions/runs/39611228718) falhou em duas verificações de boleto no runtime compilado: a configuração isolada não declarava o ambiente de pagamentos, e `NODE_ENV=production` fazia a API recusar o link Sandbox da fixture. O provisionador descartável passou a declarar Sandbox e a mesma conta de teste para build, aplicação e trabalhadores dos testes, sem herdar o ambiente Vercel da máquina. A validação de links por ambiente permanece ativa. A repetição local de `test:production:isolated` passou com **430 testes em 46 arquivos**, duas instâncias e provedores simulados (registro `06252485e6af69afc7c69e96aa6af553`). A aprovação da nova CI e a integração continuam necessárias antes de migration/publicação em homologação.

- No detalhe de um pedido BOLETO elegível, o Admin confere o valor integral e solicita a devolução. A operação é durável e vinculada a loja, operador, versão e cobrança; o aceite HTTP 202 não executa nem comprova devolução por si.
- O consumidor atualizado utiliza exclusivamente `/payments/{id}/bankSlip/refund`. O pedido precisa de cobrança RECEIVED, uma parcela e identidade/valor consistentes. Não há fallback ao estorno genérico, valor parcial, reenvio automático do POST ou reabertura de operação antiga.
- O link retornado é validado para o ambiente Asaas, persistido em campo privado da operação e consultável pelo Admin da mesma loja com `private, no-store`. Não aparece na resposta do comando/replay, no detalhe genérico do pedido nem em auditorias. O Admin o encaminha ao pagador por canal privado; dados e documentos ficam no formulário do Asaas, sem upload no projeto. Não foi automatizado envio de mensagem/e-mail ao pagador.
- Após resposta válida, histórico vazio completo pode significar espera pelos dados do pagador; permanece pendente. HTTP 200, obtenção do link e histórico PENDING não geram fato REFUNDED. A confirmação exige histórico integral DONE e estado financeiro REFUNDED correlacionados. Conclusão remove o link persistido e aplica compensações uma vez. Depois da entrega, estoque aguarda inspeção física.
- Resposta perdida, link inválido, falha ao persistir/auditar ou histórico cancelado/incompleto levam a conferência, sem um segundo POST. Se o link foi perdido, o atendimento deve verificar a solicitação no provedor; esta entrega não possui uma recuperação automática de link nem botão de reenvio. Uma confirmação financeira posterior ainda pode encerrar a operação.
- A rota também passou a recusar Origin externo e comandos sem JSON. A tela requer confirmação, impede nova solicitação automática e oferece uma consulta que não processa filas.

**Migration e publicação:** `20261021140000_boleto_refund_request` acrescenta o campo privado `PaymentOperation.refundRequestUrl`, o estado inicial `BOLETO_READY` e a proteção contra retorno a esse estado após submissão. Operações anteriores não são rearmadas. O estado separado impede que consumidores antigos, que selecionam READY, enviem o boleto pelo endpoint genérico. Isso não torna a mistura de versões apta ao ensaio: **alinhar web, consumidores de conciliação e inbox ao mesmo artefato aprovado**, pois leitores antigos não conhecem a espera pelos dados do pagador. Aplicar a migration revisada antes de iniciar a nova aplicação. Em rollback, conter consumidores e preservar banco/filas; não converter BOLETO_READY em READY nem remover a coluna com o novo código ativo.

**Ensaio posterior, coordenado com Vanderlei:** registrar SHA/digest/URL e migration, confirmar identidade Sandbox, permissões do endpoint, consumidores e transporte; preparar um pedido novo e autorizado. Conferir solicitação única, interação do pagador, estados intermediários, DONE/REFUNDED e efeitos únicos. Registrar também recuperação/alerta para casos incertos. Não utilizar #3/#6 como atalho, não liberar checkout/tráfego/agenda implicitamente e não armazenar links privados nos registros Git. A implementação não comprova a elegibilidade da conta ou que o Sandbox permitirá concluir a etapa documental do pagador.

## Triagem vigente — 21/10/2026

**Prioridade confirmada pelo usuário:** devolução PIX, boleto pago e atendimento de chargeback. Débito fica adiado nesta etapa; não aguardar resposta do suporte para avançar nesses três itens. O usuário informou que ainda não recebeu resposta do Asaas. Isso não habilita débito nem o declara homologado; a decisão final do escopo de abertura deverá refletir esse adiamento. Domínio/e-mail serão retomados depois.

Base de código: `homologacao_teste` em `cc405e8f41a403b4608d98585c53b968b2f359af`; origem `main` consultada somente leitura em `7f9b26e062ec2654420fecffb6dd78ad3ba1e017`. Retorno físico integral e resultado de chargeback já integram a candidata; a publicação de `ae9ec9c` está documentada em [publicação de homologação](PUBLICACAO_HOMOLOGACAO_AE9EC9C_2026-10-20.md). Os avisos de implementação apenas local, abaixo, descrevem 19/10. O aceite operacional continua aberto. Não foi feita nova inspeção de runtime nem publicação nesta triagem.

Leituras realizadas em 21/10, **10:23–10:24 BRT**: transação `REPEATABLE READ / READ ONLY` na homologação e GETs no Asaas Sandbox. Loja/pedido #6 foram usados como referência; identidade de cobrança, referência externa, método e valor foram conferidos antes das conclusões. Banco e provedor são leituras sequenciais, não um snapshot atômico entre sistemas. [Evidência sanitizada](evidencias/L-G3-TRIAGEM-2026-10-21.json).

| Frente | Resultado observado | Próxima ação / condição de fechamento |
|---|---|---|
| PIX #3, R$ 49,90 | Pedido PAID; tentativa REFUND_PENDING; operação PENDING com `PAYMENT_REFUND_CANCELLED_REVIEW`; nenhum fato REFUNDED. Provedor RECEIVED e histórico dedicado com uma devolução CANCELLED de R$ 49,90. | Manter esse caso em revisão. Leno prepara um cenário PIX novo e controlado para comprovar devolução concluída, com consumidores/candidata identificados por Vanderlei antes da execução. Para resolver #3, obter motivo e encaminhamento do provedor; não rearmar a operação nem criar outro comando para contornar o cancelamento. |
| Boleto #6, R$ 49,90 | Pedido PAID; tentativa APPROVED; fatos AUTHORIZED/SETTLED; nenhuma operação local. Provedor RECEIVED. Listagem de estornos informa totalCount=0/hasMore=false, mas sem array de registros reconhecido pelo coletor; não é prova de contrato completo da resposta. | Pagamento continua comprovado; devolução não foi ensaiada. Leno deve implementar/revisar o fluxo específico de boleto antes de novo cenário autorizado. Preservar #6 como referência de pagamento, sem estorná-lo apenas para testar. |
| Chargeback | GET paginado da conta Sandbox, sem filtros de situação/data: HTTP 200, totalCount=0, hasMore=false. | Não há caso nessa leitura para demonstrar disputa ou encerramento. Leno prepara o atendimento e a evidência; Vanderlei comprova ingestão/alerta no destino em janela coordenada. A ausência de casos não aprova o fluxo. |
| Crédito #4/#5 | No banco, tentativas REFUNDED e operações COMPLETED; fatos REFUNDED somam R$ 360,72 / R$ 57,20. Não houve nova consulta dessas cobranças no provedor. | Reaproveitar provas anteriores; não repetir estornos. Esses casos não comprovam retorno físico após entrega. |
| Boleto #8 | Local PENDING, reserva RESERVED; provedor OVERDUE, não excluído, vencimento em 16/10. | Registrar diferença observada e verificar consumidor/configuração antes de qualquer execução. Vencimento no provedor não comprova cancelamento/expiração local. Mantida a exceção de prazo aceita anteriormente; nenhum cancelamento, pagamento ou processamento executado. |

### Boleto pago: contrato necessário antes da implementação

O Asaas documenta `POST /v3/payments/{id}/bankSlip/refund`, com permissão `PAYMENT_REFUND:WRITE`. A resposta fornece `requestUrl` para o pagador completar dados/documentos no provedor. Esse link inicia o atendimento; conclusão exige estorno `DONE`. Fonte consultada em 21/10: [estornar boleto](https://docs.asaas.com/reference/estornar-boleto). **O endpoint não foi chamado.** A documentação não comprova elegibilidade ou configuração desta conta.

O serviço atual recusa REFUND quando `attempt.method === 'BOLETO'`; o adaptador só oferece o estorno genérico e de parcelamento. Retirar a recusa isoladamente seria insuficiente. A próxima entrega técnica deve:

1. Acrescentar comando durável e adaptação específicos, com identidade/loja/operador/versão, elegibilidade e proteção contra uma segunda solicitação em timeout ou replay. Não reutilizar cegamente o endpoint genérico de estorno.
2. Tratar a obtenção do link como solicitação em andamento. Disponibilizá-lo apenas ao atendimento/pagador autorizado; não colocá-lo em logs, evidências Git ou mensagens públicas. Dados/documentos devem ser preenchidos no Asaas, sem upload ou armazenamento de imagens/documentos no projeto.
3. Acompanhar histórico e eventos correlacionados; manter pendência/revisão para resposta incerta, cancelamento ou dados incompletos. Somente prova financeira compatível confirma devolução e produz os efeitos de pontos/estoque uma vez.
4. Cobrir em testes isolados: início, timeout, replay, conclusão, cancelamento, isolamento de loja e devolução após envio/entrega. Nessa última situação, separar encerramento financeiro de inspeção física.
5. Após revisão/CI/publicação, executar um cenário Sandbox novo e autorizado, registrando início, interação do pagador, conclusão, transporte até a candidata e comparação de efeitos. Nenhum desses passos operacionais foi executado nesta triagem.

### PIX e chargeback: evidência ainda necessária

- **PIX:** concluir uma devolução apropriada com histórico `DONE`, cobrança/valor correlacionados, fato REFUNDED e compensações únicas. O GET da cobrança #3 veio com `refunds=null`, mas o [GET dedicado de estornos](https://docs.asaas.com/reference/listar-estornos-de-uma-cobranca) mostrou CANCELLED; não interpretar o campo embutido vazio como ausência de histórico. Novo ensaio não encerra automaticamente o atendimento de #3.
- **Chargeback:** o [GET de chargebacks](https://docs.asaas.com/reference/listar-chargebacks) vazio comprova apenas essa consulta. Preparar atendimento com responsável nominal, substituto, prazo informado pelo provedor e acesso privado aos comprovantes. Exercitar caso elegível no mecanismo suportado pelo Sandbox, quando disponível, e comprovar alerta recebido, leitura correlacionada, decisão e resultado financeiro. Se a conta não permitir simulação, registrar essa limitação e acordar uma prova alternativa explícita; não inventar evento como evidência do provedor.
- O envio de disputa permanece fora da aplicação; confirmar o canal operacional disponível na conta. Enviar documentos diretamente ao provedor, quando autorizado, é distinto de criar upload no projeto. As regras de resultado e de retorno físico das seções 4–5 continuam aplicáveis.

**Divisão do próximo trabalho:** Leno prepara contrato/testes de boleto e cenários de aceite; Vanderlei identifica revisão efetiva, transporte, consumidores e janela de observação; o responsável comercial define atendimento/substituto/prazos do caso antes de uma operação. Não há data de execução nem substituto confirmados nesta triagem. O próximo avanço independente é o contrato técnico de devolução de boleto, sem depender de débito ou domínio. G3/G6 continuam abertos. Nenhum POST financeiro, reconciliação, reenvio, disputa, fila, saldo ou estoque foi alterado.

Preparação de 16/10/2026, baseada na candidata `55a300313570f2a504a8f042ba7f228cd7382e58`. Consultados o código atual e `origin/main` `7f9b26e062ec2654420fecffb6dd78ad3ba1e017` somente leitura. **Procedimento preparado, ainda sem ensaio operacional no destino ou aceite de produção.** Complementa o [checklist G1–G8](CHECKLIST_PRODUCAO_G1_G8.md).

**Atualização de 19/10/2026:** implementados localmente o retorno físico integral e o tratamento de resultados de chargeback descritos abaixo. Essas alterações ainda precisam integrar a candidata publicada; as lacunas de código registradas na preparação de 16/10 são históricas. Envio de disputa/documentos, retornos parciais e aceite operacional continuam pendentes.

Leno conduz a conferência de pedido, pagamento, estoque e pontos; Vanderlei confere acesso, revisão publicada, consumidores e alertas. Cada caso precisa de responsável nominal, substituto, próxima ação e prazo de acompanhamento. A pessoa que recebe/confere mercadoria deve ser identificada no caso; não presumir retorno físico a partir de uma resposta financeira.

## 1. O que o código permite hoje

| Capacidade | Implementação encontrada | Limite operacional |
|---|---|---|
| Consultar pedido | GET administrativo autenticado e escopo da loja. | Não comprova sozinho o estado atual do provedor. |
| Solicitar CANCEL/REFUND Asaas | `requestPaymentOperation`, rota `payment-operation`; comando durável, versão e identidade do operador. Boleto recebido usa o novo fluxo específico, ainda sem publicação. | 202 significa solicitação aceita. Boleto depende do formulário do pagador e de prova financeira posterior. Contrato não recebe valor parcial. |
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
