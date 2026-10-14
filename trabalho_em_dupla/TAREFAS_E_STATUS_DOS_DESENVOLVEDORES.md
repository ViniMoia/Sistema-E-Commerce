# Tarefas e status dos desenvolvedores — Vanderlei e Leno

> **Atualização posterior em 14/10:** consultar [execução atual de Vanderlei](EXECUCAO_VANDERLEI_2026-10-14.md) e [pendências atualizadas](PENDENCIAS_VANDERLEI.md). O pacote `6f4fa75` foi publicado e teve CI aprovada; a revisão posterior `576ad89` falhou no lint, com causa corrigida nesta continuação. Leno entregou o catálogo de homologação e o estorno integral de crédito 1x do #5, com pontos e produto não enviado. As tabelas abaixo preservam o checkpoint anterior e não negam essas entregas posteriores. Nenhum desses resultados encerra os gates de produção.

**Atualização documental:** 14/10/2026. **Última rodada de validação registrada:** 13/10/2026.

**Projeto:** Sistema-E-Commerce. **Branch de trabalho:** `homologacao_teste`.

**Base Git conferida:** `a6ab64293ca78b9fa378af9c19cf5eec4028bbf0`.

Este é o quadro consolidado de acompanhamento. Reúne as atribuições do plano em dupla, as evidências de homologação e as decisões posteriores do replanejamento. Os documentos históricos são preservados; pendências antigas já resolvidas localmente estão atualizadas abaixo. Esta atualização não executou novamente os testes nem consultou ambientes remotos.

**Situação geral:** a implementação e a regressão local de Vanderlei estão entregues, com infraestrutura preparada para revisão. Há entregas de código e ensaios de Leno, mas dados, métodos financeiros e aceite externo ainda têm pendências. **Produção não está liberada; WF-18 e WF-19 permanecem abertos e a implantação/observação de WF-20 não foi executada.**

As alterações de Vanderlei permanecem locais, sem novo commit, push ou execução da CI no GitHub. A base recebida de Leno e a validação do candidato local são identificadas nos relatórios; publicação de código não equivale a aprovação do ambiente implantado.

## 1. Responsabilidades e escopo vigente

| Desenvolvedor | Responsabilidade principal | Revisão e integração |
|---|---|---|
| **Leno** | Núcleo financeiro, checkout no servidor, estoque, pontos, dados, schema/migrations, contratos e operações financeiras externas. | Revisa loja, segurança e infraestrutura de Vanderlei; fornece aceite e procedimentos de dados/financeiro. |
| **Vanderlei** | Home, carrinho/checkout/confirmação no navegador, identidade/acesso, frete, Admin/operação comercial, métricas, infraestrutura, observabilidade e deploy no Google Cloud. | Revisa a entrega de Leno, integra os contratos e executa a implantação após os gates. |

Decisões posteriores prevalecem sobre as premissas iniciais dos documentos:

- O lançamento exige **PIX, crédito até 12x, boleto, débito, pontos e entrega**. Boleto e débito passaram a P0 na seção 17 do replanejamento de 13/10; não permanecem adiados.
- A política registrada de parcelamento é teto de 12x, piso de R$ 20 e juros de 2,99% ao mês pagos pelo comprador por padrão. Sua configuração não comprova homologação da conta/provedor.
- O banco atual foi declarado como contendo dados de teste. A trajetória prevista é **banco de produção separado**, com carga aprovada de catálogo, configuração e estoque, preservando a homologação e sem copiar vendas, carteiras ou referências Sandbox fictícias.
- O trabalho está centralizado em `homologacao_teste`, conforme decisão do usuário; não há tarefa de criar outra branch ou worktree.
- A atualização deste quadro não reinicia o prazo original de 48 horas nem autoriza provisionamento, operações financeiras ou deploy.

**Como ler os status:** “validado localmente” comprova somente os cenários e condições registrados; “parcial” indica entrega existente com critérios abertos; “preparado” indica configuração/procedimento ainda não executado no destino; “pendente” indica ausência de entrega ou de evidência suficiente. Uma tarefa pode estar implementada e continuar pendente de aceite externo.

## 2. Tarefas de Vanderlei

Revisor principal: **Leno**. O fechamento de cada pacote depende também dos critérios externos indicados.

| ID | Tarefa atribuída | Já realizado | O que falta para encerrar | Status |
|---|---|---|---|---|
| **V-00** | Ambiente local, onboarding e mapa de configuração. | Docker Linux operacional; Node 22 e dependências; PostgreSQL descartável, sentinelas e provas negativas; correção do esgotamento de conexões no harness; descarte dos recursos temporários comprovado. Arquivo privado `env.example` preservado e não carregado nos testes. | Manter isolamento nas próximas rodadas; completar configuração real do destino em V-06/V-07. | **Entrega local validada.** |
| **V-01** | Prontidão da home e desempenho percebido. | Conteúdo e botões independentes do vídeo/JavaScript; movimento reduzido; remoção da opacidade inicial que escondia a home; prontidão medida em desktop/mobile emulado. | Conferir rede, dispositivos e primeira carga no ambiente final. | **Implementado e validado localmente.** |
| **V-02** | Carrinho, checkout e confirmação no navegador. | Regressões de abas, reload, identidade, storage indisponível, respostas atrasadas e confirmação/QR. Corrigida a entrada no checkout por navegação de documento, inclusive sob foco/revalidação concorrentes. | Integrar UI de débito após contrato de Leno; validar métodos externos e seus estados no candidato, incluindo boleto e crédito até 12x. | **Fluxos existentes validados localmente; integração financeira pendente.** |
| **V-03** | Identidade, acesso, reset, privilégios e proteção de dados expostos. | Auditoria/regressão de tenant, ownership, sessão, reset, Admin e DTOs; endurecimento da resolução de Host, redação de segredos/cartão nos logs e permissões/erros de upload. | Validar domínio/proxy/cookies reais, reset por e-mail, recuperação administrativa, IAM/MFA e comprovação das rotações necessárias. | **Parte local validada; aceite externo pendente.** |
| **V-04** | Frete autoritativo, validade, assinatura e cache entre instâncias. | Correções de limites/lacunas da tabela J&T e interpretação estrita das respostas dos Correios; testes de validade, assinatura e consistência entre instâncias; rejeição de frete inválido. | Confirmar transportadora/contrato, origem, tarifas e dimensões; ensaiar cotação, cobertura, indisponibilidade, expiração e expedição reais. Correios existente usa CalcPrecoPrazo, não comprova integração CWS/Mini Envios. | **Parte local validada; transportadora pendente.** |
| **V-05** | Catálogo, Admin, expedição, rastreio, retirada e métricas. | Regressões de operação comercial; IDs preservados; entrega de estoque de Leno mantida e testes `inventory-admin-browser`/`inventory-admin-integrity` incluídos e aprovados. Indicadores exercitados com fatos controlados. | Aceite comercial no candidato; métricas e devoluções dependem dos produtores/fatos financeiros e da carga aprovada de Leno. | **Parte local validada; aceite integrado pendente.** |
| **V-06** | Empacotamento e arquitetura Google Cloud. | Dockerfile standalone Node 22, Linux sem root, duas instâncias, assets e reinício testados; configuração declarativa Cloud Run e procedimento operacional preparados. | Confirmar projeto/número/região/domínio, IAM, billing, banco e secrets; provisionar e ensaiar o destino em etapa autorizada. | **Pacote local validado; nuvem não provisionada.** |
| **V-07** | Executor, observabilidade, custo Neon e e-mail. | Cloud Run Job e Scheduler com IAM/OAuth preparados; chamadas existentes autenticadas por `CRON_SECRET`; limites e logs de execução; manifestos de alertas/heartbeat e roteiro preparados/testados localmente. | Ativar e observar execução recorrente; testar alerta recebido, remetente/domínio, Storage e entrega real; acordar com Leno cadência, sobreposição, pool/locks, backlog e custo Neon. | **Implementação local preparada; operação externa pendente.** |
| **V-08** | CI, regressão integrada e capacidade do candidato. | Workflow inclui `homologacao_teste`, testes operacionais, isolamento, migrations, builds, standalone, capacidade e Linux. Rodada final passou com hashes registrados; parecer sobre Leno produzido. | Publicar revisão após revisão do trabalho, executar CI remota, identificar digest/configuração e validar capacidade no destino; receber aceite de L-08 e concluir revisão recíproca. | **Candidato local validado; candidato remoto não aprovado.** |
| **V-09** | Deploy final, entrada em produção e observação operacional. | Roteiro de implantação, contenção e recuperação disponível em `infra/cloudrun/README.md`. | Gates aceitos, janela coordenada, procedimentos L-09, publicação, verificações e observação conjunta do runtime/negócio. | **Procedimento preparado; deploy não executado.** |

## 3. Tarefas de Leno

Revisor principal: **Vanderlei**. As entregas existentes abaixo são atribuídas conforme os documentos de passagem; os resultados locais de Vanderlei reforçam a regressão do conjunto, mas não substituem o aceite de Leno sobre dados e operações financeiras.

| ID | Tarefa atribuída | Já realizado / evidência disponível | O que falta para encerrar | Status |
|---|---|---|---|---|
| **L-00** | Base compartilhada e acesso controlado. | Pacote de revisão, scripts, testes, documentação e modelo seguro de ambiente disponíveis na base recebida em `homologacao_teste`; Vanderlei conseguiu executar o harness. | Confirmar SHA/configuração do Preview usado nas próximas sessões, acessos nominais, reserva do ambiente e rotação do bypass anteriormente exposto. | **Base entregue; controles externos a confirmar.** |
| **L-01** | Recuperação financeira, concorrência e falhas entre processos. | Correções de resposta atrasada e aplicação de evidências; testes com processos separados, leases, falha/retomada e efeitos únicos entregues. Regressão integrada local do candidato passou. | Fechar os critérios de recuperação com executor/configuração finais e consolidar as evidências aplicáveis; não inferir contrato externo a partir de transporte simulado. | **Implementado/testado localmente; aceite final pendente.** |
| **L-02** | Inventário de dados e tratamento de legados. | Auditoria histórica, barreiras para escritores e tratamento demonstrável de compatibilidade documentados. Decisão posterior por banco de produção separado, pois a origem contém testes. | Identificar destino e inventário atual; aprovar carga de catálogo/configuração/estoque físico de abertura e isolamento da origem. Não reconstruir vendas/pontos fictícios como obrigações reais. | **Trajetória definida; preparação e aceite dos dados pendentes.** |
| **L-03** | Schema, migrations, restauração e contrato dos dados. | Migrations e ensaios existentes; reconstrução, replay, legado e retomada aprovados na rodada local com PostgreSQL 16 descartável. | Ensaiar backup/restore e carga no banco alvo, volume/locks/janela; entregar comandos e pontos de parada identificados para a implantação. | **Base técnica validada localmente; destino pendente.** |
| **L-04** | Ciclo financeiro e métodos de pagamento. | PIX positivo e cancelamento de PIX não pago têm evidências históricas; contratos locais de PIX/crédito/boleto, tratamento de estorno cancelado/inconclusivo e política explícita Sandbox/produção entregues. | Homologar PIX/crédito até 12x/boleto e devolução efetivamente concluída; confirmar suporte do provedor/conta e **implementar débito ponta a ponta**; provar recusa, expiração, pagamento tardio, incerteza, replay e efeitos conforme método. | **Parcial; débito e aceites financeiros são bloqueadores.** |
| **L-05** | Pontos, devolução física e conservação dos efeitos. | Lotes, FEFO, resgate, expiração, dívida e ganho congelado implementados com testes locais de invariantes. | Aceitar política comercial/arredondamento/prazos; provar compensações com ciclos externos, devolução física/parcial e conservação dos efeitos; fornecer fatos/critérios para as métricas de V-05. | **Base local existente; aceite integrado pendente.** |
| **L-06** | Checkout no servidor, estoque e carrinho concorrentes. | Intenção, reserva, revisão, consumo único e contratos de variantes existentes; entrega de ajuste geral/por variante preservando IDs e rascunho recebida em `a6ab642`. Testes de navegador/integridade antes bloqueados pelo Docker agora passaram com Vanderlei. | Conferir a entrega no Preview correspondente, consolidar inventário de escritores e validar capacidades financeiras/carga de abertura no candidato final. | **Entrega local validada; fechamento integrado pendente.** |
| **L-07** | Contrato do consumidor e operação permanente. | APIs e processamento durável existentes integrados ao acionador local de Vanderlei; recuperação e autenticação exercitadas. | Aprovar limites/retries/review/leases/cadência com V-07; observar pagamentos, outbox e expirações no destino; fornecer contenção de novas compras que preserve recebimentos e obrigações abertas. Confirmar isolamento banco/conta. | **Integração local disponível; operação final pendente.** |
| **L-08** | Consolidação financeira e aceite WF-18/WF-19. | Pacotes de passagem e evidências disponíveis; parecer independente de Vanderlei emitido com condições abertas. | Consolidar LA/E aplicáveis na mesma revisão, fechar dados e métodos obrigatórios, resolver exceções e entregar aceite financeiro do candidato. | **Pendente de fechamento.** |
| **L-09** | Prontidão dos dados e acompanhamento financeiro da implantação. | Responsabilidades e sequência de atuação definidas no plano. | Entregar parecer, backup/restore/carga e procedimentos ensaiados; coordenar habilitação financeira com Vanderlei e acompanhar primeiras conciliações, estoque, pontos e backlog após deploy. | **Aceite/procedimentos finais pendentes; observação não executada.** |

**Caso financeiro #3:** a evidência histórica é de estorno cancelado no provedor e revisão interna, preservando os efeitos pagos. Não comprova devolução concluída. Não rearmar REFUND nem repetir scripts históricos de retomada como parte da instalação. O parecer de Vanderlei também exige atenção à premissa de uma conta Asaas por instalação e ao fato de `PAYMENT_WORKER_ENABLED=false` afetar o recebimento de webhook, não sendo contenção geral segura de novas compras.

## 4. Atualizações que substituem pendências antigas

- [x] Recuperação do ambiente Docker e execução dos ensaios locais de Vanderlei.
- [x] Execução de `inventory-admin-browser` e `inventory-admin-integrity`, antes impedida pela indisponibilidade do Docker na entrega de Leno.
- [x] Parecer independente de Vanderlei sobre a entrega de Leno, com condições de liberação explicitadas.
- [x] Configuração da CI para incluir `homologacao_teste`; sua execução remota ainda está pendente.
- [x] Regressão local final, build otimizado, standalone, duas instâncias Linux e piloto de carga.
- [ ] Implementação do débito por Leno e integração da apresentação por Vanderlei após o contrato.
- [ ] Homologação externa dos métodos obrigatórios, incluindo boleto e crédito até 12x, e prova de devolução concluída.
- [ ] Banco de produção separado com carga aprovada e recuperação ensaiada.
- [ ] Integrações e execução automática no destino, revisão remota, gates e implantação.

## 5. Evidências locais mais recentes

Fonte: [Fechamento local de Vanderlei](FECHAMENTO_LOCAL_VANDERLEI.md) e [evidência estruturada do candidato](evidencias/candidato-local.json). Resultados da rodada registrada em 13/10/2026, sem nova execução nesta atualização.

| Verificação | Resultado registrado |
|---|---|
| Unitários | 719 aprovados em 84 arquivos. |
| Operação/harness | 15 aprovados. |
| TypeScript e lint | Tipagem aprovada; lint com zero erros e 18 avisos. |
| Provas negativas de isolamento | 2 aprovadas; escrita recusada sem a sentinela correta. |
| Migrations existentes | Reconstrução, replay, legado e retomada aprovados em PostgreSQL 16 descartável. |
| Integração em desenvolvimento | 338 aprovados em 28 suítes. |
| Build otimizado / Chrome | 347 aprovados em 30 suítes. |
| Standalone realocado / Edge | 347 aprovados em 30 suítes. |
| Capacidade/invariantes | 11 aprovados em 3 suítes; perfis de 30/80 usuários HTTP e 2/5 checkouts manuais por minuto, durante 120 s cada, sem falhas medidas. |
| Imagem Linux | Duas instâncias sem root, assets, autenticação do cron, consumidor e reinício aprovados. |
| Prontidão home/produto/carrinho/checkout | Metas locais de primeira amostra até 5 s e p95 quente até 3 s atendidas; maior p95 de prontidão aproximadamente 435 ms. |
| Encerramento do harness | Contêineres descartáveis da rodada removidos; PostgreSQL preexistente preservado. |

Os totais de testes se sobrepõem e não devem ser somados. A medição usa loopback, dados sintéticos, provedores controlados e mídia externa bloqueada; mobile é viewport emulado. Não comprova 80 navegadores completos, pagamentos Asaas, dispositivos físicos, cold start Cloud Run ou capacidade/custo Neon. Os hashes completos e as condições estão nas fontes acima. Alterações posteriores exigem revalidar o que for afetado.

## 6. Gates compartilhados para lançamento

G1 e G3 abaixo incorporam a ampliação de escopo de 13/10. **Nenhum gate está integralmente aprovado pelas evidências locais.**

| Gate | Dono / revisor | Situação atual e requisito restante |
|---|---|---|
| **G1 — Escopo e bloqueios** | Leno / Vanderlei | Aberto: incluir PIX, crédito até 12x, boleto, débito, pontos e entrega; capacidades precisam de implementação/aceite e recusa efetiva quando não aprovadas. |
| **G2 — Dados restauráveis** | Leno / Vanderlei | Aberto: destino separado, inventário/carga aprovados e backup/restore aplicáveis ao lançamento. |
| **G3 — Financeiro** | Leno / Vanderlei | Aberto: ciclos externos dos métodos obrigatórios e devolução concluída com efeitos únicos. |
| **G4 — Pontos/produtos** | Leno / Vanderlei | Evidência local disponível; faltam aceite comercial/financeiro e dados de abertura. |
| **G5 — Segurança** | Vanderlei / Leno | Evidência local disponível; faltam domínio, proxy/cookies, recuperação real e controles externos. |
| **G6 — Execução automática** | Vanderlei + Leno | Acionador local preparado; faltam execução recorrente no destino, retomada, alertas recebidos e limites/custos aprovados. |
| **G7 — Experiência e capacidade** | Vanderlei / Leno | Piloto local aprovado nas condições registradas; faltam operação comercial e capacidade no destino. |
| **G8 — Candidato e operação** | Vanderlei / Leno | Faltam revisão recíproca final, CI remota, artefato/configuração identificados, integrações e recuperação ensaiada no destino. |

## 7. Próximas ações por responsável

### Leno

1. Confirmar suporte de débito na conta/provedor, entregar o contrato e implementar a cadeia financeira completa; fornecer a Vanderlei os estados/capacidades para a UI.
2. Concluir os ensaios coordenados de PIX, crédito até 12x, boleto e devolução, preservando as evidências históricas e sem duplicar operações.
3. Preparar inventário/carga aprovada do banco separado e ensaiar migrations, backup/restore e recuperação para o destino.
4. Fechar pontos/devolução física, contenção segura, isolamento banco/conta e critérios do consumidor com Vanderlei.
5. Emitir aceite de L-08 e procedimentos de L-09; revisar a entrega de infraestrutura/loja de Vanderlei.

### Vanderlei

1. Confirmar projeto/número/região do Google Cloud, domínio e canais de alerta; registrar responsáveis e limites de custo com Leno. O projeto previamente selecionado no CLI não foi assumido como destino da loja.
2. Confirmar transportadora/contrato/origem e recursos de e-mail/Storage; preparar e validar as integrações no ambiente escolhido.
3. Revisar/publicar o trabalho local na branch existente e obter execução da CI remota; vincular o candidato a SHA, digest e configuração identificados, sem incluir segredos.
4. Integrar o contrato de débito quando recebido; validar a experiência completa dos métodos homologados, operação comercial e capacidade no destino.
5. Concluir G5–G8 com Leno e, após os aceites, executar V-09 na janela combinada, acompanhando a observação técnica.

**Entradas ainda necessárias:** destino Google Cloud, domínio, transportadora/contrato/origem, remetente, recursos de armazenamento, canais de alerta, política de custo/cadência e carga/estoque de abertura aprovados. Credenciais devem permanecer em canal privado/gestor de segredos, nunca neste quadro.

## 8. Fontes e manutenção

- [Plano de execução em dupla, cópia no projeto](../diversos/CORRECOES/Correcoes_logicas/Correcao_logica_1/trabalho_em_dupla/PLANO_DE_EXECUCAO_EM_DUPLA_PARA_PRODUCAO.md): atribuições L-00–L-09 e V-00–V-09, revisão e critérios originais.
- [Relatório geral, cópia no projeto](../diversos/HOMOLOGACAO/Relatorio_1/RELATORIO_GERAL_HOMOLOGACAO_E_GUIA_DE_CONTINUIDADE.md): histórico, arquitetura, evidências e limites WF-18/WF-19/WF-20.
- [Replanejamento atualizado no projeto](../diversos/CORRECOES/Correcoes_logicas/Correcao_logica_1/trabalho_em_dupla/Replanejamento/REPLANEJAMENTO_PRODUCAO_48H.md): seções 6 e 14–18, incluindo banco separado, ambiente financeiro, parcelamento, boleto/débito e estoque.
- [Entrega e continuidade de Leno](../PACOTE_REVISAO_VANDERLEI/REVISAO_LENO_L01_L04_PARA_VANDERLEI.md): contratos e resultados da entrega financeira.
- [Parecer de Vanderlei sobre Leno](evidencias/V-REVISAO-LENO.md): revisão independente e condições ainda abertas.
- [Relatório inicial de Vanderlei](RELATORIO_VANDERLEI.md) e [fechamento local atualizado](FECHAMENTO_LOCAL_VANDERLEI.md): implementações e validação final, distinguindo a base histórica da atual.
- [Evidência estruturada](evidencias/candidato-local.json): identidade, hashes e resultados do candidato local.
- [Procedimento Cloud Run / V-09](../infra/cloudrun/README.md): preparação, implantação e recuperação.

Em cada atualização, registrar data, revisão/artefato, responsável e evidência. Alterar “pendente” para “concluído” somente quando o critério do pacote estiver demonstrado; manter separadas implementação, teste local, homologação externa e observação de produção. Não atribuir aprovação retroativa a uma revisão ou configuração diferente.
