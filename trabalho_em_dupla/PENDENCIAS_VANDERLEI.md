# O que falta para Vanderlei

**Atualizado em:** 20/10/2026.

**Projeto e branch:** Sistema-E-Commerce — `homologacao_teste`.

## Situação vigente em 20/10 — candidata ae9ec9c

Esta seção prevalece sobre as listas históricas abaixo. [Publicação,
verificações e pendências com responsáveis](PUBLICACAO_HOMOLOGACAO_AE9EC9C_2026-10-20.md).

- [x] Publicar o PR #10 integrado em candidata com CI do SHA aprovado: `ae9ec9c`,
  revisão `continental-hml-ae9ec9c-review`, 0% de tráfego.
- [x] Preservar 100% na revisão anterior, checkout pausado e controles
  financeiros desligados, sem transferência de webhook ou acionadores.
- [x] Conferir catálogo, loja, login/logout, Admin e cartões mobile de
  produtos/clientes/pedidos em 320/390 px; remover contas temporárias.
- [x] Retirar provisionamento/credenciais de Storage do gerador e planejamento,
  conforme seção 70; nenhum recurso antigo apagado.
- [x] Entregar inventário e proposta G6 com fontes, limitações e recuperação.
- [ ] Publicar/conferir a futura correção de imagens/uploads de Leno após
  aprovação. Amostra da home não encerra auditoria das referências Nuvemshop.
- [ ] Configurar e validar e-mail/reset após chave válida e remetente
  confirmado pelo operador. A correção de falso sucesso já está publicada.
- [ ] Concluir G6 com inventário externo, responsável/substituto, permissões,
  custo/cadência e janela coordenada; provar alerta recebido e recuperação.
- [ ] Receber aceites de negócio/dados/financeiro de Leno e concluir gates
  externos antes de promover tráfego ou liberar compras.

Projeto de homologação confirmado: `continental-511812`, região
`southamerica-east1`. As antigas solicitações de identificar esse projeto e
republicar candidatas já entregues não são pendências atuais. Main somente leitura.

## Histórico da situação de 15/10 — base 8632514

Registro histórico. [Relatório daquela continuação](EXECUCAO_VANDERLEI_2026-10-15.md).

- [x] Incorporar as entregas publicadas por Leno até `8632514`, preservando main e pedidos encerrados.
- [x] Rever os encerramentos documentados: #4 estorno integral 12x, #5 estorno 1x, #6 boleto pago/e-mail e #7 boleto cancelado sem pagamento. Não repetir essas operações.
- [x] Identificar e corrigir a falha atual da CI nos mocks da home, preservando as guardas de mutação/recuperação do carrinho; 774 unitários aprovados.
- [x] Corrigir falso sucesso ao copiar PIX/boleto, tratar clipboard ausente/recusado, invalidar respostas tardias e tornar o botão do boleto acessível.
- [x] Adicionar regressões da confirmação em desktop/mobile emulado: fuso, retorno não autoritativo, reload, falha de consulta, vencimento, cancelamento e estorno.
- [ ] Obter CI da nova revisão. A execução de `bfaf1a1` foi aprovada em 14/10; a de `8632514` falhou e não deve ser marcada como aprovada.
- [ ] Concluir V-06/V-07: projeto Cloud Run ainda não identificado; Preview continua protegido (HTTP 302 Vercel). Entrada solicitada ao responsável.
- [ ] Validar catálogo efetivo, frete, Admin, domínio e integrações no candidato externo.
- [ ] Integrar débito após contrato de Leno e concluir critérios financeiros/de dados/aceites conjuntos.

**Preservar #8:** limite externo em 17/10 às 00:00 BRT; elegibilidade da reserva em 20/10 às 00:00 BRT. Não antecipar prazos nem executar cancelamento/pagamento manual. Testes isolados não encerram essa prova remota. Estorno parcelado #4 deixou de ser pendência; PIX #3, débito, devolução de boleto pago e devolução física continuam separados.

## Histórico da execução de 14/10 — revisão 576ad89 + correções

Registro histórico; a situação de 15/10 acima prevalece. Relatório anterior: [execução e parecer por frente](EXECUCAO_VANDERLEI_2026-10-14.md).

- [x] Consultar `origin/main` e reutilizar as decisões já registradas, sem alterar a origem ou reaplicar cargas.
- [x] Conferir a CI da revisão atual: `576ad89` falhou no lint do importador; a variável reservada foi renomeada sem mudar a lógica de dados. A aprovação histórica de `6f4fa75` não aprova essa revisão.
- [x] Reproduzir e corrigir filtros que ignoravam marca/categoria persistidas e a perda de página no reload/histórico.
- [x] Testar catálogo sintético de 519 produtos, 18 marcas e 10 categorias em desktop/mobile emulado, mantendo a validação da base real separada.
- [x] Corrigir resposta de frete atrasada após mudança de CEP e limpar cotações antigas; padronizar preços da vitrine/detalhe em reais.
- [x] Corrigir fragilidades expostas pela CI de `f89e68e`: seleção de variante no teste sem depender da ordem do banco e descarte de comandos pendentes ao desconectar o navegador. A CI completa da correção continua sendo um critério de aceite separado.
- [x] Revisar as evidências do estorno integral #5: nove verificações independentes aprovadas, sem nova operação financeira.
- [x] Consultar diretamente PAC/SEDEX pelo provider existente: dois destinos encerraram por timeout de 3,5 s, sem cotação válida. Isso registra a falha observada, não aprova Correios.
- [ ] Validar o catálogo efetivo do Preview e cotações com seus produtos: a URL está protegida pelo login Vercel; acesso autorizado/URL acessível solicitado.
- [ ] Identificar o destino Cloud Run: os projetos visíveis na conta não identificam por si só o e-commerce; confirmação solicitada, sem provisionamento.
- [ ] Obter aprovação da CI para a revisão que incorpora estas correções e concluir os critérios externos do candidato.

Permanecem com Leno o contrato de débito, demais cenários financeiros, dados de abertura e procedimentos finais. O #5 já comprova devolução integral de crédito 1x, pontos e produto não enviado; não listar mais “nenhuma devolução concluída” como situação atual. PIX/#3, estorno parcelado e devolução física continuam separados.

**Débito — investigação de 14/10:** a documentação do Asaas orienta pagamento pela Fatura (`invoiceUrl`), sem envio direto dos dados de débito pela API. A [seção 27 do replanejamento](../diversos/CORRECOES/Correcoes_logicas/Correcao_logica_1/trabalho_em_dupla/Replanejamento/REPLANEJAMENTO_PRODUCAO_48H.md#27-débito-no-asaas--levantamento-técnico-em-14102026) contém fontes, mapa de alterações e perguntas técnicas sobre Sandbox, método efetivo e estorno. Vanderlei pode preparar apresentação de encaminhamento/retorno sem habilitar o método; o contrato funcional ainda depende de Leno e da confirmação dessas lacunas. Não adaptar o formulário de crédito para capturar débito nem considerar a visita ao callback como pagamento aprovado.

**Precedência em 14/10 — consultar main antes de decidir novamente:** a [seção 24 do replanejamento](../diversos/CORRECOES/Correcoes_logicas/Correcao_logica_1/trabalho_em_dupla/Replanejamento/REPLANEJAMENTO_PRODUCAO_48H.md#24-reaproveitamento-da-main-antes-de-novas-decisões--14102026) registra a comparação de `origin/main` com código e bancos efetivos. Reaproveitar origem `67140615`, Correios habilitados, um dia adicional, políticas de fidelidade, regras de parcelamento/boleto, matriz J&T e runbooks existentes. Correios/dia adicional foram alinhados no banco de homologação, configuração v5. Projeto Cloud Run, agenda efetiva e débito não foram encontrados implementados na main; não tratar exemplos como configuração real. Catálogo de origem identificado (522 produtos/18 marcas/10 categorias); carga completa ainda não executada, com quatro diferenças de saldo geral/variantes para reconciliar. Publicação/CI do pacote de Vanderlei já concluídas conforme seção 23. As listas históricas abaixo não exigem rediscutir decisões já recuperadas.

**Referência:** quadro consolidado atualizado em 14/10 e evidências locais de 13/10/2026. Esta atualização é documental; não houve nova execução de testes ou consulta aos ambientes externos.

A base local já foi implementada e validada. O trabalho restante concentra-se na integração do débito após a entrega de Leno, na configuração e homologação do ambiente externo, na publicação do candidato e na implantação após os aceites. As pendências abaixo não significam que seja necessário refazer as implementações locais aprovadas.

## 1. Informações que Vanderlei precisa confirmar

**Catálogo disponível em 14/10, 16:58 UTC:** a carga controlada de Leno adicionou 518 produtos/variantes, 18 marcas, 10 categorias e 471 vínculos. Total de homologação: **519 produtos e 520 variantes**, incluindo o produto dos ensaios preservado. Quatro produtos da origem ficaram separados por divergência de estoque, sem alteração na main. Ver seção 25 do replanejamento e [resultado da carga](evidencias/L-CATALOGO-HOMOLOGACAO-2026-10-14.json). Vanderlei já pode conferir catálogo, filtros, Admin e apresentação do frete com essa base; estoque importado é de teste, não abertura de produção. A anotação anterior de catálogo ainda não carregado é histórica.

Estas definições permitem avançar na infraestrutura e nas integrações sem esperar a conclusão de todos os testes financeiros.

- [ ] **Google Cloud:** projeto e número do projeto, região, responsáveis por IAM/billing e limite de custo. Não assumir que o projeto atualmente selecionado no CLI é o destino da loja.
- [ ] **Domínio:** endereço da loja e da homologação, responsável pelo DNS e configuração de TLS.
- [ ] **Frete:** transportadora, contrato/conta, origem, cobertura, tarifas e pesos/dimensões do catálogo aprovados pela loja.
- [ ] **E-mail:** domínio, remetente e recursos separados para homologação e produção.
- [ ] **Imagens — seção 70:** conferir a candidata com referências Nuvemshop e bloqueio de upload entregue por Leno. Retirado o provisionamento de Storage/buckets/credenciais; não apagar recursos antigos.
- [ ] **Alertas:** canais de recebimento, responsáveis pelo atendimento e limites de atraso/falha.
- [ ] **Operação com Leno:** cadência do consumidor, limites de execução/conexões, orçamento Neon e procedimento de contenção.

Registrar identificadores e referências de configuração; manter valores secretos fora deste documento.

## 2. Pendências por pacote

| Pacote | O que Vanderlei ainda precisa fazer | Dependência | Evidência para concluir |
|---|---|---|---|
| **V-00 — Ambiente** | Manter o harness isolado nas próximas execuções e completar o mapa de configuração do destino em V-06/V-07. Não há nova instalação local identificada como pendente. | Definição dos ambientes. | Configuração documentada por ambiente, sem credenciais expostas. A validação local já está registrada. |
| **V-01 — Home** | Medir home, produto, carrinho e checkout em rede/dispositivos e no ambiente final, incluindo primeira carga. Corrigir eventuais regressões demonstradas. | Ambiente externo disponível. | Condições, amostras e percentis registrados; referência de p95 quente até 3 s e primeira carga até 5 s. |
| **V-02 — Compra no navegador** | Integrar a apresentação do débito ao contrato entregue por Leno. Conferir seleção, valores, estados e confirmação de PIX, crédito até 12x, boleto e débito; repetir cenários de abas/reload/identidade afetados pelas integrações. | Contrato e capacidades de débito; homologação financeira coordenada por Leno. | Fluxo de compra e mensagens coerentes com o estado autoritativo de cada método, sem tratar resposta incerta como sucesso. |
| **V-03 — Segurança e acesso** | Validar tenant/ownership, proxy, cookies, sessões e reset no domínio real; conferir recuperação administrativa, IAM/MFA e evidências das rotações necessárias. | Domínio, e-mail, permissões e configuração do destino; confirmação de acessos/rotação com Leno. | Tentativas indevidas recusadas, reset entregue e consumido corretamente, acesso administrativo recuperável e segredos protegidos. |
| **V-04 — Frete** | Homologar cotação e cobertura da transportadora escolhida, validade, indisponibilidade e assinatura entre instâncias; conferir origem, tarifas, pesos e medidas. | Contrato e dados reais aprovados pela loja. | Cotação externa válida e aceita no checkout; expiração/erros sem frete fictício; mesma regra entre instâncias. |
| **V-05 — Admin e operação comercial** | Conferir catálogo e ajustes de estoque no candidato/Preview correspondente; validar expedição, rastreio, retirada e métricas com fatos financeiros aprovados. | Carga de abertura e contratos/fatos de devolução, pontos e financeiro de Leno. | IDs e rascunhos preservados, alterações persistidas/auditadas e indicadores conciliados com os fatos. |
| **V-06 — Infraestrutura Cloud Run** | Aplicar a configuração declarativa no destino definido, conferir IAM/billing/secrets, domínio e banco isolado, e ensaiar a imagem/configuração implantadas. | Projeto/região/domínio confirmados; contrato de dados e migration de Leno; etapa externa autorizada. | Revisão identificada, runtime funcional, permissões adequadas e configuração de homologação/produção separada. |
| **V-07 — Executor, alertas, custo e e-mail** | Configurar Job/Scheduler autenticados e observar progresso/retomada; testar alertas recebidos; validar remetente e entrega de e-mail; medir backlog, conexões, sobreposição e custo. Storage para upload retirado pela seção 70. | Infraestrutura disponível e limites/contratos operacionais acordados com Leno. | Trabalho durável processado sem navegador, falhas detectadas, retomada demonstrada e limites sustentáveis. |
| **V-08 — Candidato e CI** | Revisar as alterações locais, publicar na branch existente e obter CI remota; identificar SHA, digest e configuração; concluir regressão/capacidade no destino e revisão recíproca. | Revisão de Leno; infraestrutura e integrações disponíveis; aceite financeiro/dados L-08 para fechamento. | Evidências associadas ao mesmo candidato/configuração e parecer conjunto dos critérios aplicáveis. |
| **V-09 — Implantação** | Coordenar janela e decisão de liberação, executar procedimentos ensaiados e deploy, conferir integrações e observar a operação técnica após a abertura. | Gates anteriores aceitos e procedimentos de dados/financeiro L-09 entregues. | Implantação e recuperação verificadas, runtime acompanhado e ciclos de negócio conciliados com Leno. |

**Frete:** a implementação existente dos Correios usa CalcPrecoPrazo; não há evidência de homologação CWS/Mini Envios. Confirmar a compatibilidade do contrato escolhido antes de declarar a integração pronta.

## 3. O que depende de Leno

Vanderlei acompanha, revisa e integra estas entregas. Sua implementação financeira e de dados permanece com Leno.

| Entrega necessária de Leno | Trabalho de Vanderlei que depende dela |
|---|---|
| Confirmar suporte do provedor/conta e implementar débito ponta a ponta. | Integrar UI, capacidades e estados de débito em V-02. |
| Homologar PIX, crédito até 12x e boleto, com devolução efetivamente concluída e tratamento de incerteza/recusa/expiração. | Validar a experiência dos métodos, confirmação e operação comercial; fechar V-02/V-05/V-08. |
| Entregar regras/fatos de pontos e devolução física/financeira. | Conferir indicadores, mensagens e operação comercial em V-05. |
| Aprovar carga e estoque inicial do banco separado; fornecer migrations, backup/restore e recuperação ensaiados. | Preparar infraestrutura do destino e executar os procedimentos combinados de V-06/V-09. |
| Definir contenção de novas compras preservando obrigações abertas e confirmar isolamento banco/conta. | Validar operação do consumidor e contingência em V-07/V-09. |
| Emitir aceite L-08, procedimentos L-09 e revisão da entrega de Vanderlei. | Fechar o candidato e realizar a implantação. |

O caso histórico de estorno #3 cancelado/em revisão não comprova devolução concluída. A existência de crédito não comprova débito. Boleto e débito são requisitos do lançamento na atualização de 13/10 e não podem ser considerados adiados pelo plano anterior.

## 4. Ordem sugerida de execução

1. **Confirmar entradas externas:** projeto/região/domínio, transportadora, e-mail e canais de alerta; reaproveitar os identificadores já conferidos. Não solicitar credenciais de Storage para upload.
2. **Preparar a publicação do trabalho local:** revisar arquivos e configuração, manter `homologacao_teste` e obter a CI remota. Não é necessário criar outra branch ou reinstalar Docker como tarefa inicial.
3. **Configurar e ensaiar homologação no destino:** aplicar o pacote de infraestrutura e validar segurança, frete, e-mail, imagens externas, consumidor e alertas em etapa autorizada. Upload deve ser recusado em UI/API conforme entrega de Leno.
4. **Integrar as entregas financeiras de Leno:** débito, demais métodos, estados, devolução e indicadores. As atividades independentes de infraestrutura podem continuar enquanto esses contratos são concluídos.
5. **Fechar o candidato:** mesma revisão/artefato/configuração, regressão pertinente, capacidade no destino e revisão cruzada. Medir 30–80 usuários e 2–5 checkouts/minuto somente em ambiente isolado e com provedores controlados.
6. **Implantar após os aceites:** combinar janela, executar V-09 e acompanhar a operação técnica com a conciliação financeira de Leno.

## 5. Checklist para considerar a parte de Vanderlei encerrada

- [ ] UI de todos os métodos obrigatórios integrada e validada com os contratos aprovados.
- [ ] Segurança, recuperação de acesso e operação administrativa comprovadas no ambiente final.
- [ ] Frete, e-mail e arquivos homologados com os recursos reais escolhidos.
- [ ] Infraestrutura, execução recorrente, retomada e alertas funcionando no destino.
- [ ] Capacidade e custo medidos nas condições acordadas com Leno.
- [ ] CI remota aprovada e evidências vinculadas ao SHA, artefato e configuração do candidato.
- [ ] Revisão recíproca e aceites de dados/financeiro recebidos; critérios de liberação atendidos.
- [ ] Implantação, contingência e observação operacional executadas e registradas.

Os testes locais já aprovados continuam sendo evidência da rodada registrada: Docker/harness, home/carrinho, segurança/frete, Admin, build otimizado, standalone, duas instâncias Linux e piloto de carga. Reexecutar os testes pertinentes quando houver alterações ou dúvidas materiais; a aprovação local não substitui os itens externos acima.

## 6. Referências

- [Quadro completo de Vanderlei e Leno](TAREFAS_E_STATUS_DOS_DESENVOLVEDORES.md).
- [Fechamento local de Vanderlei e resultados](FECHAMENTO_LOCAL_VANDERLEI.md).
- [Evidência estruturada do candidato local](evidencias/candidato-local.json).
- [Parecer sobre a entrega de Leno](evidencias/V-REVISAO-LENO.md).
- [Procedimentos Cloud Run, implantação e recuperação](../infra/cloudrun/README.md).
- [Replanejamento atualizado, incluindo boleto e débito](../diversos/CORRECOES/Correcoes_logicas/Correcao_logica_1/trabalho_em_dupla/Replanejamento/REPLANEJAMENTO_PRODUCAO_48H.md).

Atualizar cada pendência com data e evidência ao concluí-la. Este arquivo registra o trabalho restante; sua criação não executa publicação, provisionamento, operação financeira ou deploy.
