# Roteiro de aceite financeiro — PIX, boleto, retorno físico e chargeback

Preparado em 21/10/2026. **NOT_EXECUTED: nenhum ensaio remoto foi realizado por este roteiro.** Base: `homologacao_teste`, commit `9495ff942e832db6588219e57163982b246e16d7`, que integra o PR #12 (boleto e correção do ambiente isolado). CI do PR aprovada; CI após integração [39619498248](https://github.com/ViniMoia/Sistema-E-Commerce/actions/runs/39619498248) ainda em execução na preparação. Confirmar seu resultado antes da janela. A publicação desse SHA não foi comprovada.

Complementa o [atendimento financeiro](ATENDIMENTO_REVISAO_DEVOLUCAO_CHARGEBACK.md) e o [checklist G1–G8](CHECKLIST_PRODUCAO_G1_G8.md). Origem `origin/main` consultada somente leitura em `7f9b26e`; não há pacote de `trabalho_em_dupla` nessa revisão. Nenhum banco principal foi acessado ou modificado nesta preparação. Débito permanece adiado e indisponível; expiração do boleto #8 conserva a exceção já aceita, sem ser declarada aprovada.

## 1. Pré-requisitos comuns — preencher antes de executar

| Responsável | Entrega exigida | Condição para iniciar |
|---|---|---|
| Vanderlei | SHA aprovado, digest, revisão Cloud Run e URL efetiva; comparação se usar sucessor de `9495ff9` | Aplicação e consumidores executam o mesmo artefato ou uma composição explicitamente revisada. |
| Vanderlei | Backup e registro de aplicação da migration `20261021140000_boleto_refund_request`, sem drift pendente | Coluna privada e estado `BOLETO_READY` disponíveis antes do novo runtime. Não converter esse estado em READY. |
| Vanderlei | Conta/escopo Sandbox, loja, destino do webhook, autenticação e identificação dos consumidores de inbox/conciliação/supervisão | Demonstrar qual revisão receberá o evento e qual processará o caso. Abrir uma URL de review não redireciona o webhook para ela. |
| Vanderlei + Leno | Inventário de agendas/consumidores antigos e novos, trabalho pendente e alcance do processamento | Nenhum acionador concorrente desconhecido. Consumidor global pode alcançar outros pedidos; não executá-lo supondo isolamento pelo pedido exibido. |
| Vanderlei + operador | Janela, flags efetivas, tráfego, contenção e retomada | Registrar explicitamente qualquer habilitação temporária. Este documento não libera checkout, tráfego ou agendas. |
| Leno + responsável comercial | Pedido novo por cenário, identidade, valor integral, método e autorização da operação | Não usar vendas reais nem os pedidos antigos para facilitar o teste. Confirmar suporte da conta Sandbox antes de criar a cobrança. |
| Responsável comercial | Nome, substituto, canal privado, prazo de acompanhamento e participação do pagador | Campos ausentes bloqueiam atendimento que dependa deles. Não inventar prazo do provedor. |
| Vanderlei + destinatário | Canal de alerta habilitado para a janela e destinatário disponível | Configuração de política não equivale a alerta entregue; registrar recebimento e ciência. |

Se qualquer identidade, destino ou consumidor divergir, registrar **BLOCKED** e resolver a lacuna antes da mutação. Campo desconhecido não significa aprovação. O banco principal e a main continuam somente leitura para o assistente.

## 2. Baseline e pacote mínimo de evidência

Preencher uma cópia do [modelo de execução](modelos/ACEITE_FINANCEIRO_G3.json), vinculando o [caso privado de atendimento](modelos/CASO_REVISAO_FINANCEIRA.json). O modelo em branco não é evidência.

Antes, durante e depois, registrar horário UTC (e BRT na comunicação), ambiente/loja, pedido/tentativa/cobrança, conta, método, moeda, valor, parcelas, versão, estados e códigos de revisão. Leituras sequenciais não são um snapshot atômico entre banco e provedor.

| Camada | Evidência a coletar |
|---|---|
| Provedor | Consulta pontual da cobrança e histórico dedicado completo de estornos; para chargeback, identidade e resultado do caso. Guardar referência privada da consulta/protocolo, não payload bruto. |
| Transporte | Evento correlacionado, destino efetivo, horário, resposta HTTP e processamento interno. HTTP 200/PROCESSED isolado não comprova efeitos financeiros. |
| Aplicação | Pedido, tentativa, operação, fatos financeiros por cobrança, revisão e auditoria. Registrar commandId/versão apenas no caso privado e nunca criar outro comando para contornar incerteza. |
| Pontos | Movimentos vinculados ao pedido e saldos/dívida antes/depois; calcular a compensação esperada a partir do próprio caso, não de números antigos. |
| Estoque | IDs persistidos de produto/variante, quantidades, reserva, estoque disponível e indisponível antes/depois; distinguir cancelamento anterior ao envio de retorno físico. |
| Atendimento/G6 | Alerta recebido, destinatário, ciência, próxima ação/prazo e comunicação privada ao pagador, quando cabível. |
| Interface | Capturas sanitizadas na revisão identificada, desktop e mobile quando afetados; leitura autenticada sem cache e sem exposição do link privado em outros contratos. |

No Git, guardar somente resumo sanitizado e referências opacas. Não guardar link `requestUrl`, URLs com tokens, cookies, chaves, documentos, dados de cartão ou dados pessoais do pagador. Documentos ficam no canal privado autorizado/provedor; não criar upload no projeto.

## 3. Matriz de cenários pendentes

### PIX-01 — devolução integral concluída antes do envio

**Entrada:** pedido PIX novo, pago e ainda não enviado, sem estorno/operação incompatível; conta, cobrança, histórico completo e valor conferidos. Definir previamente os efeitos esperados de pontos/reserva/estoque conforme a configuração do caso.

1. Capturar baseline e registrar uma solicitação integral pelo fluxo autorizado, preservando identidade do comando. Observar operação e acionador previsto; não repetir o POST para acelerar o teste.
2. Acompanhar evento e conciliação até resultado remoto e local coerentes. Uma solicitação aceita ou pendente ainda não representa devolução concluída.
3. Fazer nova leitura após outro ciclo automático observado, sem nova solicitação financeira, para conferir ausência de efeitos duplicados.

**Esperado:** histórico completo com DONE no valor integral e cobrança REFUNDED; operação local concluída, fato REFUNDED correlacionado, pedido cancelado antes do envio, compensações de pontos/reservas/estoque uma única vez. Nenhuma segunda devolução no provedor.

**Evidência exigida:** baseline e comparação final por cobrança, operação/auditoria, evento e execução do consumidor, movimentos de pontos/estoque e segunda leitura sem novos efeitos.

**Interrupção:** CANCELLED, autorização crítica, timeout ou identidade/valor divergente ficam em revisão com responsável e próxima conferência. Não rearmar nem trocar commandId. O pedido #3 permanece preservado; sucesso de PIX-01 não resolve seu atendimento.

### BOL-01 — solicitação, formulário do pagador e conclusão

**Entrada:** boleto novo efetivamente RECEIVED, uma cobrança/parcela, valor integral e elegibilidade confirmados. Vanderlei comprova a permissão necessária na conta; o pagador de teste está disponível e o mecanismo suportado pelo Sandbox foi verificado.

1. No detalhe do pedido, conferir valor e confirmação explícita do Admin. Solicitar uma vez. O estado inicial BOLETO_READY/aceite HTTP não comprova envio ao provedor ou devolução.
2. Observar o consumidor atualizado utilizar o fluxo específico de boleto. Após resposta válida, consultar o link privado no painel. Reabrir o detalhe deve recuperar a mesma solicitação, sem outro POST.
3. Encaminhar o link ao pagador por canal privado autorizado; ele completa as informações exigidas diretamente no Asaas. Registrar somente referência e andamento, nunca o link/documentos neste roteiro.
4. Enquanto aguarda, conferir que não há fato de devolução nem compensação antecipada. Após a confirmação remota, acompanhar transporte e conciliação; reler após outro ciclo automático.

**Esperado:** solicitação única; link apenas para Admin autorizado da loja, sem cache e sem exposição no detalhe genérico/auditoria. Estado de espera não representa dinheiro devolvido. Encerramento exige DONE integral e cobrança REFUNDED compatíveis; operação COMPLETED, link removido, fato e compensações únicos.

**Evidência exigida:** autorização/identidade, estados intermediários, disponibilidade privada do formulário sem capturar sua URL, conclusão do pagador, histórico/cobrança, evento, consumidor, operação/fatos, pontos e estoque antes/depois.

**Interrupção:** link perdido/inválido, resposta incerta ou indisponibilidade documental da conta deixam o caso BLOCKED ou em revisão. Consultar o provedor; não há recuperação automática do link nem novo POST autorizado por este roteiro. Se o Sandbox não permitir a conclusão, registrar a limitação e o protocolo: não declarar o fluxo homologado.

O formulário e a permissão `PAYMENT_REFUND:WRITE` constam no [contrato oficial de boleto](https://docs.asaas.com/reference/estornar-boleto). A obtenção do link inicia o processo; não confirma devolução. O histórico é consultado pelo [endpoint dedicado](https://docs.asaas.com/reference/listar-estornos-de-uma-cobranca). Fontes conferidas em 21/10/2026; disponibilidade documental não comprova habilitação da conta.

### FIS-01 — devolução financeira após entrega, seguida de retorno integral

**Entrada:** pedido controlado efetivamente preparado para o ensaio de envio/entrega, com itens e reservas COMMITTED identificados, sem reposição prévia. Pode ser a fase física de BOL-01 se isso for planejado antes da compra/entrega; nesse caso, o esperado de estoque após o estorno é o desta seção. Não reutilizar PIX-01, definido antes do envio, nem os casos #4/#5 já encerrados.

1. Registrar estado SHIPPED/DELIVERED, estoque e pontos antes da devolução financeira. Executar o fluxo financeiro autorizado uma única vez e comprovar sua conclusão.
2. Antes da inspeção, conferir estado físico preservado, estoque sem reposição, reserva COMMITTED e revisão PHYSICAL_RETURN_REQUIRED. A compensação financeira/pontos não comprova recebimento da mercadoria.
3. Receber e inspecionar todos os itens do cenário, identificar recebedor/inspector, quantidades revendáveis e não revendáveis e referência privada da inspeção. Quantidade ainda não recebida bloqueia o encerramento integral.
4. Usar o comando específico de retorno físico com versão atual e declaração verdadeira de ausência de reposição anterior. Não usar ajuste genérico de estoque. Consultar comprovante e reler após novo ciclo de conciliação.

**Esperado:** unidades aptas retornam ao estoque disponível; não aptas e variantes retiradas ficam indisponíveis, conforme contrato. Reserva RETURNED, um comprovante/auditoria, versão atualizada e histórico SHIPPED/DELIVERED preservado. O comando físico não gera novo estorno, fato financeiro ou movimento de pontos. Uma consulta posterior não repõe novamente.

**Evidência exigida:** comparação das três fases (antes do estorno / estornado sem inspeção / retorno encerrado), IDs e quantidades, estoque disponível/indisponível, reserva, comprovante privado de inspeção e auditoria do comando.

**Interrupção:** falta de item, ajuste prévio, versão divergente ou devolução parcial seguem para atendimento específico. Não confirmar recebimento fictício, remover revisão por SQL ou apresentar encenação de logística como entrega real. Identificar explicitamente o que o ensaio simulou.

### CB-01 — ingresso, atendimento e resultado de chargeback

**Entrada:** caso elegível de cartão no mecanismo suportado pela conta Sandbox, ou limitação formalmente registrada. A consulta vazia de 21/10 não fornece um caso. Não fabricar webhook/payload para alegar evidência do Asaas. Testes sintéticos ficam identificados como isolados.

1. Confirmar ID do chargeback, cobrança/contrato/parcelas, valor, estado atual e prazo com fonte. Registrar responsável comercial, substituto, canal e próxima ação.
2. Observar ingresso e consulta no destino correto, painel de revisão e alerta efetivamente recebido. REQUESTED/IN_DISPUTE não liberam o caso nem disparam REFUND adicional.
3. Responsável comercial decide a contestação; se autorizada e elegível, encaminha documentos diretamente pelo mecanismo disponível do provedor. Registrar protocolo, prazo e referências privadas. A aplicação não automatiza esse envio.
4. Acompanhar o resultado financeiro e reler após outro ciclo automático; conferir pedido, fatos, pontos, estoque e comandos de REFUND que já existiam.

| Resultado observado | Esperado pelo código da candidata | Evidência específica |
|---|---|---|
| REQUESTED / IN_DISPUTE | Revisão aberta; atendimento e prazo em acompanhamento; nenhum estorno automático adicional. | Caso atual, painel, alerta recebido e ciência do responsável. |
| DISPUTE_LOST / DONE + cobrança REFUNDED | Resultado de devolução correlacionado, efeitos únicos; após envio/entrega, retorno físico permanece separado. Uma parcela não encerra o contrato inteiro. | Estado do caso e cobrança por parcela, fatos e compensações; FIS-01 se aplicável. |
| REVERSED + CONFIRMED/RECEIVED, sem cobrança previamente REFUNDED | Resultado favorável sem duplicar autorização, pontos ou e-mail; comando de REFUND retido continua sob análise própria. | Consulta atual, histórico anterior e comparação sem novos efeitos indevidos. |
| Resultado incompleto ou incompatível | Manter revisão, sem inferir vitória/perda nem limpar o erro. | Divergência, responsável e próxima consulta. |

Os estados vêm da [documentação de chargeback](https://docs.asaas.com/docs/chargeback); as combinações financeiras da tabela são os critérios implementados em `services/payment/chargeback.ts`, não promessa de simulação disponível. Se um dos resultados não puder ser exercitado, registrar cobertura parcial e a prova isolada reaproveitada; o revisor deverá decidir explicitamente sobre a lacuna, sem aprová-la automaticamente.

## 4. Verificação conjunta de automação e recuperação — G6

Para cada caso aplicável, anexar identidade e horários de evento, inbox, consumidor e resultado. Distinguir processamento automático de intervenção manual. Cron ativo, fila vazia ou operação COMPLETED isoladamente não comprovam a cadeia inteira.

Para o aceite de recuperação, Vanderlei prepara uma falha controlada e reversível dentro da janela e do escopo autorizado, com contenção, efeito esperado e forma de retomada definidos antes. Reaproveitar as provas locais de timeout/crash/replay; não interromper uma chamada financeira externa incerta apenas para reproduzir todos os testes no ambiente compartilhado. Observar alerta recebido, responsável atuando, recuperação e ausência de efeitos duplicados. Se apenas houve execução manual, deixar o aceite automático aberto.

Reenvio deliberado de evento ou replay de comando não faz parte da preparação: requer caso e alcance previamente definidos. Não repetir o executor global como consulta. Não desligar a conciliação de obrigações existentes para conter apenas novas compras.

## 5. Ordem de execução e decisão

1. Receber os pré-requisitos de Vanderlei e registrar baseline fresco. Conferir a candidata, sem operação financeira.
2. Executar PIX-01 em caso novo autorizado; tratar qualquer incerteza antes de iniciar outro caso.
3. Executar BOL-01; se planejado para após entrega, associar FIS-01. Aguardar o pagador/resultado sem repetir a solicitação.
4. Concluir FIS-01 e CB-01 conforme elegibilidade e janela; chargeback não depende de repetir estornos já concluídos.
5. Consolidar provas de automação, relatórios afetados, pendências e decisão por cenário. Registrar a configuração ao encerrar a janela; contenção/retomada de tráfego e consumidores segue o plano combinado.

Estados de aceite: **NOT_EXECUTED**, **BLOCKED**, **PARTIAL**, **FAILED**, **PASSED**. PASS exige resultado esperado e referências de evidência verificadas por executor/revisor; tempo decorrido não transforma pendência em sucesso. Separar aceite de código, comportamento da conta, transporte, efeitos financeiros, efeitos físicos e atendimento. Fechar um caso não libera produção nem encerra todos os requisitos de G3/G6.

Preservar: #3 (PIX em revisão), #4/#5 (estornos de crédito comprovados), #6 (referência de boleto pago), #7 (cancelamento sem pagamento) e #8 (expiração com exceção). Não ajustar saldos, estoque ou classificação para reproduzir um baseline antigo. Identificar os novos ensaios conforme o procedimento existente, sem ocultar obrigações do processamento.
