# Replanejamento para produção em até 48 horas

**Roteiro de aceite preparado — 21/10:** [PIX, boleto, retorno físico e chargeback](../../../../../../trabalho_em_dupla/ROTEIRO_ACEITE_FINANCEIRO_G3.md). Antes da execução, retornar SHA/CI/digest/revisão/URL, prova da migration de boleto, destino e autenticação do webhook, versões/alcance dos consumidores e inventário de acionadores concorrentes. Informar janela, contenção/retomada e destinatário disponível para receber alertas. Leno prepara baseline e conduz os cenários novos autorizados; responsável comercial define atendimento, substituto e prazos. O roteiro está NOT_EXECUTED e não solicita reenvio, ativação de agenda ou estorno dos pedidos antigos. G3/G6 continuam abertos.

**21/10 — nova entrega de boleto em preparação para revisão/CI, ainda não publicada:** após aprovação/integração, Vanderlei deverá aplicar a migration `20261021140000_boleto_refund_request` dentro do procedimento de backup/deploy e alinhar **web e todos os consumidores financeiros** ao artefato aprovado. Retornar SHA/digest/revisão/URL, migration aplicada, identidade dos consumidores e estado dos controles. Preservar pausa, tráfego e agendas até a janela combinada. Não reclassificar BOLETO_READY como READY nem rearmar operações existentes. A migration não foi executada em homologação nesta implementação. Leno conduzirá o aceite de negócio em cenário novo autorizado; não usar o boleto #6 apenas para obter um link. [Procedimento, rollback e limites](../../../../../../trabalho_em_dupla/ATENDIMENTO_REVISAO_DEVOLUCAO_CHARGEBACK.md#implementação-de-boleto-pago--21102026-ainda-sem-publicação).

**21/10 — prioridade G3 e retorno esperado:** o usuário adiou débito nesta etapa; não aguardar o suporte para avançar em PIX, boleto pago e chargeback. Domínio/e-mail serão retomados depois. A triagem somente leitura confirmou PIX #3 com estorno CANCELLED, boleto #6 RECEIVED sem devolução comprovada e nenhum chargeback na conta Sandbox. #8 está OVERDUE no provedor/PENDING local; não processar apenas para igualar os estados.

Leno prepara o contrato específico de devolução de boleto e os cenários de aceite. **Vanderlei deve retornar** a revisão/SHA efetivos, URL de teste, configuração e destino dos consumidores/webhook, destinatário do alerta e janela proposta para observar um cenário controlado. Informar o que está efetivamente ativo e o que continua apenas preparado, sem segredos. Essa preparação não pede ativação de agendas, reenvio de eventos ou estorno dos casos antigos. O ensaio deverá registrar transporte, efeitos únicos e alerta recebido. Procedimento, limites e evidências estão no [atendimento G3](../../../../../../trabalho_em_dupla/ATENDIMENTO_REVISAO_DEVOLUCAO_CHARGEBACK.md#triagem-vigente--21102026). Débito permanece indisponível; refletir seu adiamento no escopo final. G3/G6 continuam sem aceite.

**21/10/2026 — entrega de Leno para cumprir a política de imagens da seção 70.**
Upload de produto/avatar recusado permanentemente no servidor, sem flag de reativação;
seletor de arquivo e adaptador de Storage removidos. URLs HTTP(S) externas continuam
permitidas; imagens embutidas em campos de URL são recusadas. Auditoria somente leitura
de origem/homologação e testes locais aprovados constam na
[evidência de imagens](../../../../../../trabalho_em_dupla/evidencias/L-IMAGENS-SEM-UPLOAD-2026-10-21.json).
**Atribuição seguinte de Vanderlei:** após CI/revisão/integração desta entrega, publicar
o SHA aprovado e conferir o editor de produtos, perfil e recusa da API na candidata.
Registrar SHA/digest/URL/resultados; manter checkout pausado, controles financeiros e
tráfego existentes. Não criar Storage, copiar imagens ou executar nova importação.
A candidata `ae9ec9c` ainda não contém este bloqueio. Disponibilidade completa das
imagens na CDN, e-mail, G6 e demais aceites continuam separados.

**Devolutiva de Vanderlei — 20/10, 14:30 BRT:** PR #10 já integrado e publicado
no SHA `ae9ec9c62b80d927ea9a59de626c62b1e1ca3f60`, com CI própria aprovada.
Revisão `continental-hml-ae9ec9c-review`, 0% de tráfego;
[URL de teste](https://review-ae9ec9c---continental-hml-jctvprygla-rj.a.run.app).
Checkout pausado, controles financeiros desligados e 100% na revisão anterior.
Conferências de login/logout/Admin e cartões em 320/390 px aprovadas, sem
alterar produtos ou pedidos. Tarefas de provisionar Storage retiradas do
gerador e planejamento. [Identidade completa, evidências e pendências](../../../../../../trabalho_em_dupla/PUBLICACAO_HOMOLOGACAO_AE9EC9C_2026-10-20.md).
Leno conserva a auditoria/correção de imagens e uploads da seção 70 e os
aceites de negócio. G6 e e-mail real continuam pendentes; esta entrega não
aprova produção nem ativa agendas. Avisos de publicação pendente do PR #10
abaixo são históricos.

**Decisão vigente sobre imagens — 20/10/2026:** por determinação explícita do operador, **usuários e administradores não poderão fazer upload de imagens**. As imagens dos produtos vêm da Nuvemshop; o projeto deve trabalhar com suas referências externas, sem armazenar arquivos/binários de imagem no banco nem provisionar Object Storage para esse fluxo. **Vanderlei não deve criar buckets, cadastrar segredos de Storage ou habilitar upload para atender às pendências antigas deste documento.** Esses requisitos foram retirados do escopo e substituídos pela conferência das referências importadas, carregamento das imagens e bloqueio de upload na interface e nas APIs. Ver **seção 70**, que prevalece sobre menções anteriores conflitantes. A decisão está registrada; o bloqueio efetivo no código ainda precisa ser verificado. E-mail e recuperação de senha continuam pendentes, de forma independente.

**Clientes mobile — complemento do PR #10:** captura do operador mostrou “Ver Perfil” fora da largura inicial da tabela. A lista recebe cartões no celular com identificação, contato, pedidos, LTV, datas e acesso ao perfil dentro da largura. A opção responsiva de `DataTable` é habilitada somente para a lista de clientes; a tabela desktop e o histórico de pedidos do perfil mantêm o comportamento anterior. Vanderlei deve publicar o último SHA aprovado do PR, retornando SHA/digest/revisão/URL. Leno inclui `/admin/customers` na conferência, abrindo e fechando o perfil correto sem alterar dados. Métricas financeiras e aceite completo permanecem sujeitos às evidências próprias, não apenas à aparência dos cartões.

Também corrigido o deslocamento de 32 px da lista quando o aviso “Consultando base...” surgia ao recuperar foco, fazendo o toque atingir o rótulo acima do botão. O aviso passa a ter espaço reservado. TypeScript/lint e quatro testes de navegador aprovados, incluindo toque em 320/390 pixels, desktop e regressões financeiras. [Registro da validação e limites](../../../../../../trabalho_em_dupla/evidencias/L-CLIENTES-MOBILE-2026-10-20.json).

**Lista de pedidos mobile — complemento do PR #10:** nova captura mostrou status/total/detalhes fora da largura visível. A lista passa a apresentar cartões no celular, com número/data e status no topo, cliente/contato, envio, total e acesso aos detalhes. Tabela desktop preservada. TypeScript, lint e dois testes de navegador aprovados em banco descartável: apresentação em 320/390 pixels, desktop 1440, abertura do pedido correto sem comando de alteração, além da regressão de busca/filtros/paginação/isolamento. [Evidência e limites](../../../../../../trabalho_em_dupla/evidencias/L-PEDIDOS-MOBILE-2026-10-20.json). Vanderlei deve usar a CI do **último SHA** do PR e retornar identidade/URL da candidata; Leno inclui `/admin/orders` na conferência visual, sem alterar status ou executar operação financeira.

**Complemento de aceite mobile — 20/10/2026, PR #10:** o operador conferiu dashboard financeiro e Fidelidade & Pontos no celular. Os valores visíveis coincidem com as referências anteriores; a faixa do menu aparece separada dos títulos. O botão global de WhatsApp ainda cobre conteúdo e controles nas capturas. A correção em revisão remove esse botão de **todas as rotas `/admin`**, conforme solicitação explícita do operador. A captura de Produtos & Variantes também mostrou as ações fora da área visível: o mesmo PR passa a incluir apresentação em cartões no mobile, ações Editar/Excluir visíveis e confirmação de exclusão ajustada à largura. A tabela desktop e as regras de catálogo/variantes permanecem.

**Devolutiva de Vanderlei para este complemento:** após conferir a CI do SHA final do [PR #10](https://github.com/ViniMoia/Sistema-E-Commerce/pull/10), integrar/publicar a candidata conforme o procedimento de revisão, mantendo tráfego e controles combinados. Retornar SHA, digest, revisão e URL de teste. Leno fará a conferência visual de dashboard/fidelidade/produtos nessa URL: ausência de WhatsApp em todo o Admin, ações acessíveis sem rolagem horizontal e abertura do editor/diálogo do produto correto. Na coleta remota, cancelar o diálogo; não excluir produto real para demonstrar acesso ao botão. A revisão `17fd1a7` não contém essas correções adicionais. Aceite completo e produção seguem pendentes; a CI antiga não aprova o novo SHA.

**Validação local de produtos:** teste de navegador aprovado em banco descartável nas larguras 320/390 e desktop 1440, com ações alcançáveis, cancelamento sem DELETE e abertura do editor correto. TypeScript aprovado; lint sem erros, com aviso preexistente de `<img>`. [Registro da rodada e limites](../../../../../../trabalho_em_dupla/evidencias/L-PRODUTOS-MOBILE-2026-10-20.json).

**Cópia de direcionamento para Vanderlei — 20/10/2026.** Publicada como arquivo separado na branch `homologacao_teste`, a pedido do operador, preservando `REPLANEJAMENTO_PRODUCAO_48H.md`. Conteúdo proveniente do commit `3c3bf725e96f33bcb38143cfd2e3f4c017298049`; consultar primeiro a seção 69 para tarefas e formato da devolutiva. Os links da matriz de aceite e do modelo de coleta apontam para essa versão documental no GitHub. Esta cópia registra o estado daquela atualização; mudanças posteriores devem ser conferidas antes da execução.

**Direcionamento vigente — 20/10/2026:** PR #9 integrado em `17fd1a7`, CI aprovada e publicação para teste documentada por Vanderlei no commit `3eb4023`. A revisão `continental-hml-17fd1a7-review` já contém a correção móvel e G6; não solicitar outro deploy para repetir essa entrega. [Admin da candidata](https://review-17fd1a7---continental-hml-jctvprygla-rj.a.run.app/admin). A seção 68 preserva a evidência do executor; a **[seção 69](#69-devolutiva-pendente-de-vanderlei-e-divisão-da-próxima-rodada--20102026)** define tarefas restantes e o formato do retorno. Avisos anteriores de CI/publicação pendentes são históricos. Aceite de negócio, promoção de tráfego e operação G6 continuam separados.

**Frente de Leno enquanto aguarda publicação:** preparada a [matriz de aceite remoto de retorno físico e chargeback](https://github.com/ViniMoia/Sistema-E-Commerce/blob/3c3bf725e96f33bcb38143cfd2e3f4c017298049/trabalho_em_dupla/ATENDIMENTO_REVISAO_DEVOLUCAO_CHARGEBACK.md#8-matriz-da-próxima-rodada-de-aceite-remoto), com dez verificações, resultados esperados, fontes de prova e [modelo de coleta](https://github.com/ViniMoia/Sistema-E-Commerce/blob/3c3bf725e96f33bcb38143cfd2e3f4c017298049/trabalho_em_dupla/modelos/ACEITE_RETORNO_CHARGEBACK.json). Próxima ação: após identificar a revisão publicada, localizar casos existentes por GET e registrar evidências sanitizadas; sem caso, manter cenário pendente e planejar ensaio descartável separado. Regras/painéis comparados entre `d63ad8a` e `079bc9c` não mudaram; reaproveitar as provas isoladas já registradas. Preparação documental não comprova execução no destino, envio de disputa/documentos ou alertas G6. Nenhuma operação remota nesta etapa.

**CI de `2fdcdef` — testes aprovados, encerramento pendente:** a execução [39356614989](https://github.com/ViniMoia/Sistema-E-Commerce/actions/runs/39356614989) aprovou os 406 testes de integração, inclusive interação e geometria do menu móvel. A etapa falhou depois, com `ENOTEMPTY` ao remover `.next/dev/cache` do projeto temporário. O harness enviava SIGTERM sem aguardar o encerramento do servidor. Ajustado para aguardar `close` com limite de 15 segundos e preservar o diretório se não confirmar a parada; descarte mantém escopo temporário validado e recebe tentativas limitadas para erros transitórios de filesystem. Ainda exige nova CI integral; build/runtime posteriores não foram executados nessa rodada. A captura móvel enviada continua mostrando a apresentação anterior: nenhuma publicação da correção do cabeçalho ocorreu.

**CI do PR #9 — correção do teste de interação:** a execução [39355276601](https://github.com/ViniMoia/Sistema-E-Commerce/actions/runs/39355276601), head `bcf27aa`, falhou ao esperar a abertura do menu móvel: o teste clicava após encontrar o HTML, sem aguardar o handler do React. Foram aprovados 843 unitários e 405 de 406 testes de integração; as etapas posteriores de build/runtime não executaram. Corrigida a sincronização do teste para aguardar o handler antes do clique, também na aba do extrato. As verificações de geometria, ausência de transbordamento e abertura/fechamento foram preservadas. Dois testes de navegador isolados, TypeScript e lint passaram localmente após o ajuste. Exige nova CI integral aprovada antes da integração/publicação; não considerar `bcf27aa` aprovado. Nenhuma mudança adicional no código da aplicação, banco compartilhado, tráfego ou controles financeiros nesta correção.

**Atualização da revisão:** incorporado sem conflitos o commit de Vanderlei `7882aea`, com [publicação documentada de d63ad8a](../../../../../../trabalho_em_dupla/PUBLICACAO_HOMOLOGACAO_D63AD8A_2026-10-19.md). SHA/digest, loja/banco, pausa, tráfego, acesso anônimo e logout agora têm evidência versionada do executor; os avisos anteriores de ausência desse registro são históricos. O PR #9 passa a reunir G6, correção móvel do Admin e as evidências de comparação dos relatórios. A nova revisão exige nova CI: a aprovação anterior de `fc2eefc` não cobre a correção móvel. Nenhuma dessas mudanças foi implantada ou teve tráfego promovido por esta atualização.

**Aceite móvel — correção local:** capturas do operador revelaram sobreposição do botão do menu aos cabeçalhos do dashboard/fidelidade. Ajustada a navegação móvel para reservar espaço no layout compartilhado, mantendo o desktop em colunas. Ainda não publicado e não coberto pela CI anterior de `fc2eefc`. A imagem `d63ad8a` continua com a apresentação observada; nova conferência depende da publicação da correção. [Ficha e limites](../../../../../../trabalho_em_dupla/ACEITE_REMOTO_DASHBOARD_FIDELIDADE.md).

**API de fidelidade validada — 19/10, rodada iniciada às 22:35:44 BRT:** resultado fornecido pelo operador confirmou loja/pedido de referência, HTTP 200, `private/no-store` e 19 métricas sem divergência frente ao baseline das 22:30 BRT. Com as capturas, 75 comparações de campos aprovadas. Cobertura comercial da fidelidade `COMPLETE`; cobertura financeira do dashboard continua corretamente `PARTIAL`. [Registro](../../../../../../trabalho_em_dupla/evidencias/L-ACEITE-D63AD8A-2026-10-19.json). Ainda faltam verificações restantes de apresentação/acesso, identidade independente do artefato e fechamento dos limites temporais da rodada. Próxima coleta: as duas páginas a 390 px. G3/G4/G8 não estão integralmente encerrados; G6 permanece separado da revisão publicada.

**Conferência dos relatórios — 19/10, 22:30 BRT:** consulta de homologação somente leitura, com destino/loja/conta conferidos, encontrou oito pedidos, 34 fatos e nenhuma exclusão comercial. Apuração independente coincidiu com 56 campos das capturas do dashboard e da página/widget de fidelidade, incluindo cobertura financeira parcial, R$ 542,67 reconhecidos, R$ 124,75 liquidados, R$ 417,92 estornados e saldo de 161 pontos. Migration de classificação presente e concluída. A API autenticada e demais verificações de aceite continuam pendentes; imagens anteriores e base atual não são snapshot simultâneo. [Evidência](../../../../../../trabalho_em_dupla/evidencias/L-ACEITE-D63AD8A-2026-10-19.json) e [próxima consulta](../../../../../../PACOTE_REVISAO_VANDERLEI/VALIDAR_FIDELIDADE_D63AD8A.js). Nenhuma alteração em banco, operação financeira ou processamento de fila nesta rodada.

**Devolutiva de publicação — 19/10:** Vanderlei informou publicação de `d63ad8a1ab2d712153177155eae518d3eddcdc86` na revisão `continental-hml-d63ad8a-review`, sem promoção de tráfego; a revisão anterior conserva 100%. Digest: `sha256:ba883be27218190f2f5256134b586e891b853afdee9ff577053abbf66f25c455`. [URL de teste](https://review-d63ad8a---continental-hml-jctvprygla-rj.a.run.app). Relatou checkout pausado, controles financeiros preservados, webhook/acionadores inalterados e verificações de catálogo, login, logout e acesso ao Admin/fidelidade aprovadas. **Fonte: relato do executor, ainda sem conferência independente de configuração/digest.** Dashboard, fidelidade, retorno físico e chargeback aguardam aceite funcional. [Registro e rodada pendente](../../../../../../trabalho_em_dupla/evidencias/L-ACEITE-D63AD8A-2026-10-19.json). Próxima ação: baseline fresco e comparação somente leitura na URL de teste, conforme [ficha de aceite](../../../../../../trabalho_em_dupla/ACEITE_REMOTO_DASHBOARD_FIDELIDADE.md).

**G6 em revisão — 19/10:** commit `fc2eefcfc3b58c4a0edb7d389a6989dcf36f2359`, [PR #9](https://github.com/ViniMoia/Sistema-E-Commerce/pull/9), [CI aprovada](https://github.com/ViniMoia/Sistema-E-Commerce/actions/runs/39307567422). Essa alteração não integra `d63ad8a` e não foi implantada. A integração e publicação de G6 devem ser tratadas separadamente; aprovação da CI não comprova alerta recebido ou operação automática. Os avisos anteriores abaixo permanecem como histórico de suas etapas.

**Avanço local G6 — 19/10:** ampliada a supervisão de pendências financeiras e preparado um observador que faz somente GET autenticado, com alertas nos manifestos existentes. Validação local aprovada; **ainda sem commit, CI remota ou implantação desta alteração**. Detalhes, evidência e sequência de aceite na **seção 67**. Isso não substitui a candidata `d63ad8a` que Vanderlei está preparando conforme seção 66. G6 permanece aberto até execução automática, recebimento real dos alertas e recuperação comprovados no destino.

**Direcionamento vigente para Vanderlei — 19/10:** o [PR #8](https://github.com/ViniMoia/Sistema-E-Commerce/pull/8) foi integrado à `homologacao_teste` em **`d63ad8a1ab2d712153177155eae518d3eddcdc86`**. A [CI após integração](https://github.com/ViniMoia/Sistema-E-Commerce/actions/runs/39295357722) passou, assim como a CI da candidata `d78fdae`; as árvores de arquivos são idênticas. Dashboard/fidelidade, retorno físico integral e resultado de chargeback estão integrados. **Publicação e aceite dessa revisão no Cloud Run ainda não foram comprovados.** Executar as atribuições e devolver as evidências da **[seção 66](#66-publicação-da-candidata-e-atribuições-de-vanderlei--19102026)**. A próxima atualização de Git contém somente documentação; o SHA acima continua identificando o código aprovado. Os avisos antigos abaixo descrevem seus respectivos momentos e não substituem este direcionamento.

**Atendimento G3 preparado — 16/10:** [roteiro de revisão financeira, devolução após entrega e chargeback](https://github.com/ViniMoia/Sistema-E-Commerce/blob/3c3bf725e96f33bcb38143cfd2e3f4c017298049/trabalho_em_dupla/ATENDIMENTO_REVISAO_DEVOLUCAO_CHARGEBACK.md) e modelo de caso disponíveis. Revisão do código confirmou que reconciliação é mutação, retorno físico não tem comando específico de encerramento e chargeback entra em revisão sem ciclo próprio completo. Ajuste de estoque e outbox de revisão não substituem, respectivamente, encerramento físico e alerta ao responsável. Nenhuma operação executada; G3/G6 permanecem abertos. Seção 62.

**Aceite remoto preparado — 16/10:** [ficha de dashboard e fidelidade](../../../../../../trabalho_em_dupla/ACEITE_REMOTO_DASHBOARD_FIDELIDADE.md) e [modelo de registro](../../../../../../trabalho_em_dupla/modelos/ACEITE_DASHBOARD_FIDELIDADE.json) disponíveis para a candidata `55a3003`. Definidos identidade da revisão/loja, baseline independente, campos e critérios de comparação, cache, telas e resultado. Estado remoto permanece **não executado**; nenhum saldo de fidelidade foi presumido e os números financeiros de 16/10 são somente referência histórica. Seção 61.

**G2 preparado e reensaiado — 16/10, 19:35 BRT:** [pacote de abertura do banco](../../../../../../trabalho_em_dupla/PACOTE_ABERTURA_G2.md) revisado por identidade de produto, pedido e carteira. A candidata `55a3003` passou novamente no clone restaurado do backup existente: upgrade sem drift, dados/sequências preservados, indisponibilidade dos quatro produtos de teste, abertura/classificação e replay sem duplicação. Nove verificações HTTP, três testes de relatórios e cinco de proteção aprovados. Nenhuma nova conexão à origem ou escrita em banco compartilhado. Baseline fresco, saldo comercial, executor final específico e recuperação por operador alternativo continuam pendentes. Seção 60.

**Consolidação atual — 16/10, 19:28 BRT:** [checklist G1–G8](../../../../../../trabalho_em_dupla/CHECKLIST_PRODUCAO_G1_G8.md) reúne as evidências, os responsáveis e as condições de fechamento, respeitando as decisões posteriores deste plano. A CI de `55a3003` está **aprovada**, incluindo runtime isolado e contêiner Linux. A migration de classificação já foi aplicada na homologação por Vanderlei, mas a publicação/conferência da candidata atual continua pendente; `eff10bf` não contém todas as correções posteriores. Seção 59. Os avisos datados abaixo são históricos quando superados por esta consolidação; produção continua sem aceite.

**Conferência financeira de homologação em 16/10, 17:42 BRT:** consulta somente leitura confirmou oito pedidos/34 fatos e ausência da tabela da migration de classificação naquele instante. Projeção isolada do dashboard e cálculo independente fecharam R$ 542,67 reconhecidos, R$ 124,75 liquidados, R$ 417,92 estornados e R$ 124,75 reconhecidos após estornos. Identificada e corrigida a falta de alerta para `PAYMENT_REFUND_CANCELLED_REVIEW` do #3; exige usar o novo head do PR #8, posterior a `eff10bf`. Detalhes e limites na seção 56; ainda não é conferência da tela publicada.

**Integração do push de Vanderlei em 16/10:** recebido `93e6459`, com aliases de domínio (`8c7f865`), logout no host público (`896dc56`) e evidências do Cloud Run. Integrado sem conflitos à candidata do dashboard no PR #8; a lacuna de código mencionada na seção 54 foi resolvida. Migration e conferência da revisão integrada no destino continuam pendentes. Resultado da validação na seção 55.

**Preparação da publicação em 16/10:** candidata organizada na branch de revisão `revisao/dashboard-financeiro-20261016`, baseada em `17366e8`. O remoto `origin/homologacao_teste` continua nessa base após novo fetch; a revisão Cloud Run informada por Vanderlei (`continental-hml-896dc56-logout`) não foi localizada no histórico Git disponível. Antes de promover a candidata, incorporar/preservar o trabalho dele e comprovar a migration no banco de homologação. Sequência e conferência na seção 54. Preparar/enviar código para revisão não comprova implantação.

**Atualização de 16/10 — interpretação financeira:** implementada localmente a apuração compartilhada entre dashboard e métricas dos clientes, separando reconhecimento, liquidação bruta e estornos, sem duplicar autorização/liquidação. Períodos pela data de registro dos fatos, cobertura parcial explícita e composição de produtos/frete/encargos. Seção 53. A classificação dos 24 testes e a correção do zero da fidelidade permanecem conforme seção 52. Nenhuma publicação, classificação ou migration aplicada a banco compartilhado nesta etapa. A transferência financeira para Cloud Run aguarda o levantamento de Vanderlei; não reativar o acionador antigo por causa desta correção de relatório.

**Retomada da revisão de compra observada no Preview:** após as instruções para retirar a pausa e fazer redeploy, imagem enviada pelo operador mostra proposta PIX/retirada de R$ 49,90 e botão de confirmação. Fechados os checkpoints de sondas bloqueadas, aviso visual, recuperação do #7 e retorno da proposta. Não comprova conclusão/replay de compra, continuidade financeira durante pausa ou congelamento dos demais escritores. Evidências e limites na seção 43.

**Pausa observada no Preview — evidência enviada pelo operador:** três POSTs com contrato vazio retornaram 503/`CHECKOUT_PAUSED`/`no-store`; GET de recuperação do pedido #7 retornou 200 com identidade verificada. Primeiro checkpoint remoto aprovado nesse escopo. Ainda faltam proposta válida, aviso visual, continuidade financeira, cobertura das revisões e reabertura. Registro na seção 43; não equivale a congelamento geral do banco.

**Candidata integrada para publicação em 15/10:** incorporado por fast-forward o trabalho de Vanderlei `515a27d` (clipboard de pagamento e CI da home), preservando as entregas das seções 37–42. Conjunto aprovado em 790 unitários, 19 testes de ferramentas e build de produção isolado; lint sem erros. Publicação autorizada na homologação; ativação/ensaio da pausa no Preview ainda pendentes. Procedimento de conferência na seção 43.

**Contenção de novas compras preparada em 15/10:** adicionada `CHECKOUT_PAUSED`, privada e independente dos consumidores financeiros. Pausa propostas/conclusões de todos os meios, preservando recuperação por GET; não congela banco nem interrompe requisições em voo. Implementação e limites na seção 42; validação no Preview compartilhado ainda pendente. Operador confirmou que projeto/região Google Cloud e local compartilhado de backup ainda não foram definidos.

**Procedimento de implantação/recuperação consolidado em 15/10:** runbooks da main revisados à luz do código atual e dos ensaios das seções 37–40; removidas referências a scripts npm inexistentes e corrigida a premissa de novo banco. Definidas fases de bloqueio de compras, congelamento de writers e retomada de obrigações. Faltam comprovar contenção no ingresso real, recuperação por responsável alternativo e identificadores/configuração do destino. Seção 41. Nenhuma implantação ou escrita na main realizada.

**Abertura dos dados de teste ensaiada em 15/10, 16:29 BRT:** duas carteiras iniciadas com saldo zero no clone, com baixa explícita dos 475 pontos de teste, movimentos antigos preservados e auditoria. Repetição sem duplicar ajuste; 20 comandos inseguros sobre dez pedidos antigos recusados. Compra nova pelo serviço real, com pagamento manual controlado, consumiu estoque e creditou pontos uma única vez. Três testes no clone, quatro testes de proteção, TypeScript e lint aprovados. Seção 40. Tratamento ainda não aplicado aos bancos compartilhados; não equivale a aceite de produção ou teste Asaas.

**Produtos de teste identificados e ensaio aprovado em 15/10, 16:17 BRT:** operador confirmou a indisponibilidade das três roupas e somente do aspirador portátil vermelho. Identidade e imagem conferidas entre main/homologação; nomes e IDs diferem entre ambientes. No clone da main, quatro produtos/dez variantes ficaram indisponíveis, restando 518 produtos no catálogo; três aspiradores comerciais e dois acessórios preservados. Histórico e estoques não foram apagados/recalculados. Seção 39. Nenhuma alteração nos bancos compartilhados.

**Aplicação e legados conferidos em 15/10, até 16:00 BRT:** a aplicação atual consultou por HTTP os 522 produtos, 24 pedidos e duas carteiras do clone restaurado/sanitizado, preservando todas as tabelas. Acesso sem sessão e por loja desconhecida recusados. Os 33 itens antigos foram classificados e as quatro divergências de estoque detalhadas. Tratamento proposto e lacunas reais na seção 38; nenhuma escrita na origem ou no banco compartilhado de homologação. Ainda não é aceite de produção.

**Preparação do banco executada em 15/10:** auditoria da origem somente leitura, backup criptografado, restaurações e aplicação das 13 migrações em cópia descartável aprovados, sem diferenças residuais de schema e com dados/sequências preservados. Mais 37 testes com fixtures isoladas aprovados. **Compatibilidade estrutural ensaiada; dados legados ainda exigem tratamento antes da abertura.** Resultado, limites e sequência operacional na seção 37. Nenhuma alteração aplicada à main ou a seus dados.

**Decisões posteriores de 15/10 — prevalecem sobre premissas históricas abaixo:** o operador definiu como destino de produção o banco já conectado/configurado no projeto da `main`; não há tarefa de criar outro banco por padrão. Main e seu banco permanecem estritamente somente leitura para o assistente. Preparar a compatibilidade da versão de homologação e a classificação dos dados existentes em cópia isolada, sem aplicar migrations, limpeza ou carga no banco principal. O operador também aceitou a entrada em produção com o teste de expiração do boleto pendente, a concluir depois ou antes caso o projeto se prolongue até sua elegibilidade. Essa pendência não será contabilizada como teste aprovado. Detalhes e evidência somente leitura na seção 36.

**Situação em 15/10:** boleto #6 com emissão/pagamento concluídos; #7 com cancelamento sem pagamento concluído; #8 emitido para acompanhar vencimento em 16/10 e elegibilidade à expiração em 20/10, após tolerância de 72 horas. Operador informou habilitação da expiração no Preview e redeploy. Perguntas sobre débito enviadas ao Asaas, sem resposta registrada nesta conversa. Prioridades que podem avançar durante a espera na seção 34. A emissão pendente descrita em registros anteriores é histórica.

**Estorno parcelado concluído em 15/10 às 13:31 BRT:** pedido #4, 12 × R$ 30,06 = R$ 360,72, comprovado no Asaas Sandbox e conciliado. Seis unidades devolvidas ao estoque, 149 pontos revertidos uma única vez; todos os 12 webhooks e tarefas do pedido concluídos, sem duplicação. Fechamento na seção 35. Não repetir este ensaio nem o estorno 1x do #5; demais cenários e gates continuam pendentes conforme seus registros.

**Investigação de débito em 14/10:** documentação oficial aponta pagamento pela Fatura Asaas (`invoiceUrl`), sem envio direto dos dados do cartão de débito pela API. Levantamento técnico, limites da evidência e perguntas ao provedor na [seção 27](#27-débito-no-asaas--levantamento-técnico-em-14102026). Fluxo ainda não implementado/homologado; não habilitar como equivalente ao crédito transparente.

**Trabalho liberado para Vanderlei em 14/10:** catálogo, filtros, Admin/variantes, frete, regressões do checkout e revisão das evidências financeiras já podem avançar. Preparação e ensaios isolados de infraestrutura também podem continuar. Ordem de execução, entregáveis e dependências na [seção 26](#26-trabalho-que-vanderlei-já-pode-executar--14102026). Isso não libera produção nem encerra a implementação de débito.

**Carga de catálogo em 14/10, 16:58 UTC:** homologação agora possui 519 produtos, 520 variantes, 18 marcas e 10 categorias; produto e vínculos dos ensaios preservados. Quatro produtos da origem permanecem fora da carga por divergência de estoque. Ver [seção 25](#25-carga-do-catálogo-para-desbloquear-vanderlei--14102026). Main somente leitura; estoque de teste não representa abertura de produção.

**Regra de continuidade em 14/10:** antes de solicitar decisões/configurações, consultar a main e reaproveitar o que já existe. Auditoria inicial das prioridades para Vanderlei e alinhamento efetivo do frete na [seção 24](#24-reaproveitamento-da-main-antes-de-novas-decisões--14102026). A main e seu banco permanecem somente leitura.

**Consolidação em 14/10/2026:** entregas de Leno e Vanderlei atualizadas na [seção 23](#23-consolidação-das-entregas-de-leno-e-vanderlei--14102026). Homologação conferida em `9d07510795f88420db1f654e4f6f07f590c8ecfd`, incluindo o pacote de Vanderlei `6f4fa75`. CI remota e status de deployment Vercel aprovados para ambas as revisões. Compra #4 em 12x, compra #5 em 1x com pontos/entrega e estorno integral do #5 concluídos nos recortes descritos. **Produção continua sem aceite.** Registros anteriores de publicação/CI/revisão pendentes são históricos quando superados pela seção 23; os demais critérios continuam exigidos. O prazo original não foi reiniciado.

**Atualização de escopo em 13/10/2026:** o usuário tornou **boleto e cartão de débito obrigatórios antes da produção**, além de PIX, crédito até 12x e entrega. Esta decisão substitui as exclusões/adiamentos de boleto nas matrizes e no backlog anteriores deste documento. Débito é uma lacuna de implementação, não uma modalidade já habilitável por flag: os contratos e o adapter atuais não o oferecem. Ver seção 17. Nenhuma publicação ou aprovação de gates decorre desta atualização local.

**Data:** 10/10/2026; retomada e escopo atualizados em 12/10/2026 — America/Sao_Paulo.

**Prazo:** até 48 horas corridas a partir do início coordenado em 10/10; limite no mesmo horário de 12/10/2026. Registrar o horário de início no quadro de execução.

**Responsáveis:** Leno (Brega), dados e financeiro; Vanderlei (Que dá idéia errada), loja, segurança, infraestrutura e deploy no Google Cloud. Revisão recíproca.

**Base histórica da retomada:** `461437d60a77f2ba5150a30527f188b5c5d8e437`, mais complementos locais do roteiro e da retomada do pedido #3. A revisão atual conferida está identificada na seção 23; nenhuma dessas bases é uma release de produção aprovada.

**Natureza:** plano de execução e redução de escopo. Não executa deploy, não aprova gates e não altera configurações financeiras.

**Decisão de 12/10/2026:** usuário confirmou **parcelamento e entrega obrigatórios**, **máximo de 12 parcelas** e **banco atual composto somente por dados de teste**. Essas decisões substituem as premissas iniciais de cartão limitado a 1x/retirada. Juros e modalidades foram localizados no projeto: repasse ao comprador, taxa padrão de 2,99% a.m., parcela mínima de R$ 20; Correios PAC/SEDEX, J&T Express e tabela local, com retirada e frete a combinar como opções adicionais. Regras e limites de implementação estão na seção 15; configuração efetiva e homologação continuam pendentes. A retomada em 12/10 não reinicia automaticamente o prazo original nem comprova execução dos blocos H+n anteriores; não há horário de início coordenado registrado. Priorizar agora os bloqueios reais, sem declarar cumprimento do prazo por deslocamento das datas.

## 1. Decisão principal

Concentrar as 48 horas em uma versão comercial utilizável, com **PIX, cartão de crédito, pontos, cadastro/edição de produtos, estoque e acesso seguros**. O usuário confirmou expressamente que **cartão é indispensável**; abrir apenas com PIX não atende à entrega.

Reutilizar o código e as provas já existentes. Adiar recursos não essenciais somente quando não puderem ser acionados por UI, API, intenção antiga ou escritor alternativo. Antecipar infraestrutura, domínio e revisão de código, em paralelo ao fechamento financeiro. Substituir a sequência de conferências isoladas por um relatório único por cenário, com estado anterior, execução, estado posterior e conclusão.

O prazo é um compromisso de execução, não prova de prontidão. Não é tecnicamente honesto prometer que pendências externas serão resolvidas em 48 horas. Se faltar uma condição crítica de PIX ou cartão, dados, segurança ou operação, a versão não recebe aceite para vendas. Publicar um catálogo sem checkout pode ser contingência de comunicação, mas **não conta como entrega comercial concluída**.

### Escopo de lançamento adotado no planejamento

| Capacidade | Decisão para as 48 horas | Condição |
|---|---|---|
| PIX dinâmico | Obrigatório | Pagamento, expiração, recuperação e devolução verificáveis. |
| Cartão de crédito à vista, 1x | Obrigatório | Conta habilitada, aprovação/recusa/resultado incerto e devolução validados. |
| Parcelamento | Obrigatório, até 12x por decisão de 12/10 | Repasse ao comprador, padrão 2,99% a.m., mínimo R$ 20; validar configuração, contrato completo, centavos, aprovação e reversão de todas as parcelas. |
| Boleto | Obrigatório por decisão de 13/10 | Validar emissão, pagamento, vencimento, recuperação, devolução e efeitos únicos em estoque/pontos antes da produção. |
| Cartão de débito | Obrigatório por decisão de 13/10 | Validar suporte do provedor/conta e implementar contrato, fluxo e recuperação próprios; não tratar cartão de crédito como débito. |
| PIX manual/WhatsApp | Bloqueado inicialmente | Decisão anterior não alterada especificamente; obrigações existentes continuam atendidas. |
| Pontos | Obrigatório | Ganho, resgate, expiração, compensação e saldo/déficit corretos; não desligar silenciosamente para cumprir prazo. |
| Catálogo, variantes e estoque | Obrigatório | Criar, editar, retirar variante vinculada e ajustar estoque sem perder IDs ou sobrescrever reservas. |
| Retirada no balcão | Modalidade adicional se ofertada | Não substitui entrega no lançamento. |
| Frete externo/entrega | Obrigatório por decisão de 12/10 | Validar Correios PAC/SEDEX, J&T por tabela e entrega local conforme cobertura/configuração: cotação, preço, prazo, endereço, expedição e rastreio. Não liberar frete fictício. |
| Devolução parcial e automações após entrega | Automação completa pode ser posterior | Atendimento real de devoluções é obrigatório; exigir procedimento operacional seguro antes da abertura, conforme seção 5. |
| Convidado | Habilitar apenas se passar a segurança mínima | Se não validado, bloquear no servidor e exigir conta; isso não permite adiar ownership/tenant dos usuários autenticados. |

Nenhum bloqueio desta tabela está implementado apenas pela criação deste arquivo. Não remover funcionalidades já seguras sem necessidade; a restrição deve corresponder ao que realmente não obteve aceite.

## 2. O que muda em relação ao plano anterior

| Antes | A partir deste replanejamento |
|---|---|
| Todos os métodos e modalidades na mesma fila de liberação | PIX, cartão à vista/parcelado e entrega são o caminho crítico; boleto e capacidades adicionais permanecem bloqueados até aceite. |
| Meta de 1–1,5 s de página completa como exigência ampla | Corrigir bloqueio de navegação/checkout agora; refinamento até essa meta pode continuar depois, com medidas e limite provisório explícitos. |
| Resolver todo histórico antes de qualquer entrega | Resolver integridade e obrigações ativas do banco de lançamento; histórico sem efeito ativo pode permanecer preservado e isolado, sem falsificar fatos. |
| Repetir leitura, lote e confirmação em várias conversas | Um pacote de evidências por cenário; leitura adicional só se surgir mudança, falha ou dúvida material. |
| Aguardar o caso #3 para avançar toda a equipe | Preservar o #3 como teste de cancelamento remoto e revisão; investigar causa em paralelo, com prazo de decisão e prova de devolução em caso isolado. |
| Revisão ampla no fim | Revisão dirigida dos pontos críticos durante os blocos; parecer consolidado até H+36. |
| Observação longa como pré-requisito para publicar | Prontidão antes da abertura, verificação controlada na implantação e observação contínua depois. WF-20 só se encerra após as evidências. |

Este plano atualiza a prioridade do [plano em dupla](../PLANO_DE_EXECUCAO_EM_DUPLA_PARA_PRODUCAO.md) a pedido do usuário. Não apaga os critérios originais do [Workflow](../../Workflow/WORKFLOW_IMPLEMENTACAO_CORRECOES_LOGICAS.md). **Liberação do escopo inicial não significa conclusão dos 38 achados em todas as capacidades.** Registrar os itens como validados no escopo, bloqueados por capacidade ou adiados; não marcar todo WF-18/19/20 como encerrado por redução de prazo.

## 3. Ponto de partida: aproveitar o que já existe

| Evidência disponível | Aproveitamento | O que ainda falta |
|---|---|---|
| Implementação principal de 36 achados; LA-002/033 parciais | Revisar e integrar, sem reconstruir módulos. | Aceite do escopo ativo e tratamento das partes financeiras/legadas ainda abertas. |
| 102 testes de integração e 55 unitários do ciclo financeiro recente, build isolado, tipagem/lint | Reutilizar provas associadas ao código; não somar rodadas históricas sobrepostas. | Regressão selecionada do candidato integrado e transporte real da conta para métodos ativos. |
| Recuperação entre processos, lease, concorrência e resposta atrasada | Não refazer manualmente todas as falhas no Sandbox. | Reexecutar cenários afetados por novo código; demonstrar retomada do executor no destino final. |
| PIX pago, email, duplicata e evento antigo sintético | Caminho positivo e idempotência já têm referência. | Configuração final, consumidor permanente e prova dirigida do ambiente Google Cloud. |
| Pedido #2 cancelado com replay e auditoria interna | Cancelamento PIX não pago tem evidência externa. | Não repetir só para produzir outro screenshot. |
| Pedido #3 pago, estorno cancelado no provedor, classificação corrigida | Teste do tratamento de cancelamento remoto aprovado no Preview. | Devolução efetivamente concluída ainda não demonstrada. |
| Migrations/restore, standalone e duas instâncias ensaiados | Usar os harnesses existentes. | Banco atual de lançamento, pacote final, configuração e restore aplicáveis. |

**Último estado conhecido do #3:** SQL de 10/10/2026 às 01:08:33 UTC e StatusOnly de 01:12:21 UTC, ambos de 09/10 à noite em Brasília. Pedido PAID v1/RECEIVED, tentativa REFUND_PENDING, operação original PENDING com `PAYMENT_REFUND_CANCELLED_REVIEW`, sem fato REFUNDED. Carteira 137/0/636 e uma movimentação do pedido. Estoque 7/3/4 confirmado pelo operador. Inbox 3 COMPLETED, outbox 8 COMPLETED e um PAYMENT_REVIEW em DEAD_LETTER. Nenhuma nova consulta remota foi feita para este planejamento.

O [roteiro do estorno, seções 35/36](../../../../../../PACOTE_REVISAO_VANDERLEI/L-04-ROTEIRO_ESTORNO_INTEGRAL_PIX_SANDBOX.md) contém essa atualização, posterior aos cabeçalhos antigos do Workflow. O parecer independente de Vanderlei ainda não foi apresentado nesta conversa. Não assumir que trabalhos dele estejam ausentes: receber o resumo de entregas em H+2.

## 4. Caminho crítico e agenda de dois dias

**Caminho crítico:** definir escopo e base → integridade de dados + PIX/cartão + infraestrutura em paralelo → candidato único → gates → implantação controlada → abertura e observação.

H+n significa horas corridas desde o início coordenado. Orçamento de planejamento: cerca de **16 horas de trabalho técnico de cada responsável**, distribuídas em dois dias; as demais horas absorvem testes automatizados, espera de DNS/provedor, descanso e observação. Não pressupor 48 horas contínuas de trabalho por pessoa. Os blocos paralelos abaixo são atribuições à equipe, não delegação executada por este documento.

| Janela | Leno (Brega) | Vanderlei (Que dá idéia errada) | Saída obrigatória / decisão |
|---|---|---|---|
| H+0 a H+2 | Conferir base, evidências e origem dos dados; abrir triagem PIX/cartão e #3. | Conferir trabalho já pronto, acesso Google Cloud, conta/cartão, domínio, DNS, email e executor; iniciar revisão financeira. | Escopo registrado; definir limite/juros do parcelamento e transportadoras para entrega obrigatória. |
| H+2 a H+8 | Inventário atual, decisão de legados e restore; ensaios externos dirigidos PIX/cartão e leitura de efeitos. | Preparar destino final e executor; corrigir ambiente Asaas/proxy com Leno; TLS/cookies/secrets/email; Admin/segurança. | Infra ensaiável e provas financeiras em andamento. Dependência externa não resolvida vira risco explícito, não espera silenciosa. |
| H+8 a H+12 | Fechar resgate/ganho/compensação, estoque/variantes e tratamento de devoluções; integrar correções necessárias. | Fechar catálogo/Admin/retirada e navegador mobile; proteção de rotas, recuperação de conta; remoção de bloqueio visual da home. | Fluxos críticos funcionais; lista fechada de correções para dia 2. |
| H+12 a H+24 | Acompanhar apenas tarefas automatizadas programadas e retorno externo; evitar novos ensaios financeiros sem operador. | Idem; verificar provisionamento/DNS e registrar handoff. | H+24: todas as dependências críticas externas precisam ter caminho viável demonstrado. |
| H+24 a H+30 | Corrigir lacunas residuais, migrations/backup atuais, comparação de efeitos e revisão da segurança de Vanderlei. | Integrar pacote/configuração final, revisão do financeiro de Leno, capacidade e retomada do consumidor. | Congelar candidato em H+30: commit, schema, artefato, configuração e escopo. |
| H+30 a H+36 | Regressão financeira/dados do candidato e aceite dos casos ativos. | Build/regressão integrada, navegador, carga limitada e aceite infra/segurança. | Checklist único com evidências; nenhuma falha crítica aberta. Alteração crítica exige repetir apenas cobertura afetada + smoke integrado. |
| H+36 a H+40 | Fornecer aceite de dados/financeiro e procedimento de recuperação. | Consolidar decisão de liberação, backup, implantação e contas/domínio finais. | Decisão explícita de liberar ou não. H+36 reserva até 12 h para implantação/observação, não para iniciar funcionalidades grandes. |
| H+40 a H+44 | Conferir primeiras operações controladas e efeitos por método, estorno e pontos. | Executar implantação, jobs/alertas e verificação de domínio/email; abrir gradualmente após prova. | Compra controlada por PIX e cartão sem divergência; executor funcionando sem console do operador. |
| H+44 a H+48 | Conciliar operações e revisões; entregar rotina diária e backlog. | Observar runtime/cotas, atendimento de alertas e recuperação; entregar operação ao responsável. | Release operável até H+48 se gates atendidos. Observação prolongada segue após abertura. |

### Limites de investigação e troca de prioridade

- Em H+2, cada dependência externa tem titular e prazo: conta Asaas/cartão, Google Cloud, DNS/Resend, banco, estoque e política de pontos. Não aguardar financeiro para começar infraestrutura.
- Até H+8, dedicar no máximo duas horas técnicas à investigação inicial do cancelamento #3. Preservar evidências e encaminhar diagnóstico ao titular/suporte, se necessário; seguir o ensaio isolado descrito na seção 5. Tempo esgotado não transforma um estorno cancelado em sucesso.
- Até H+24, se não houver acesso/conta/cartão/executor/domínio viável, comunicar imediatamente que a data está em risco. Não descobrir essa dependência em H+46.
- Em H+30, congelar escopo. Refinamento visual, relatório e expansão de métodos saem da janela para absorver uma correção crítica.
- Falha crítica não corrigida em H+36 mantém o gate aberto. Usar as horas restantes para corrigir e revalidar; não trocar evidência por aceite informal de risco financeiro.

## 5. Pagamentos, estorno e pontos: mínimo que não pode ser adiado

### PIX e cartão obrigatório

Leno entrega uma tabela por método com IDs sanitizados, conta/ambiente, total, estado remoto, tentativa/operação, fatos, reserva, estoque, carteira e outbox. Vanderlei revisa o vínculo entre prova e conclusão.

| Caso | Prova mínima antes da abertura |
|---|---|
| PIX aprovado | Cobrança certa, pagamento aplicado uma vez, pedido pago, crédito correto, email e consumo automático. Aproveitar os casos existentes e fazer smoke da configuração final. |
| PIX cancelado/expirado | Cancelamento comprovado antes de liberar reserva; disputa com recebimento e pagamento tardio sem estoque indevido. Simular relógio apenas no harness; conferir contrato real de expiração. |
| Cartão 1x aprovado | Total autoritativo, endereço/titular conforme contrato, conta real habilitada e estado financeiro mapeado corretamente. Não exigir que cartão sempre tenha o mesmo status RECEIVED observado no PIX. |
| Cartão parcelado | Contrato e todas as parcelas correlacionados, soma exata em centavos, política de taxas consentida, aprovação integral/recusa/estado parcial tratados; reversão sem compensar contrato inteiro por uma parcela isolada. |
| Entrega | Cotação real assinada/revalidada, cobrança e destino separados, prazo/valor corretos, falha sem frete grátis, expedição/rastreio persistidos e acesso autorizado. |
| Cartão recusado ou em análise | Recusa não vira pago; análise não expira pelo prazo PIX; reserva/recuperação têm resultado definido e sem crédito de pontos antecipado. |
| Resposta perdida, duplo clique, webhook duplicado ou anterior à resposta | Mesmo pedido/tentativa e efeitos únicos; estado incerto fica recuperável. Cobrir em PostgreSQL/processos e conferir integração do adapter, sem induzir falhas destrutivas em produção. |
| Devolução integral por PIX e cartão | Prova remota definitiva e aplicação local única; pedido/fatos, pontos e estoque compatíveis com o estágio físico. HTTP 200/202 ou solicitação aceita não bastam. |
| Contestação/chargeback de cartão | Receber e identificar o evento sem inventar pagamento/estorno, impedir liberação física indevida quando aplicável e alertar responsável. Procedimento manual auditado de tratamento antes da abertura; automação completa pode seguir depois. |
| Segurança do cartão | Nenhum PAN/CVV em banco, inbox/outbox, logs, analytics, erro, snapshot, storage do navegador ou retry durável. HTTPS, autorização e identidade corretas. Não gravar instrumento para recuperar timeout. |

O adapter atual recebe dados do cartão para processamento direto; tokenização não foi presumida implementada. Validar o fluxo e requisitos da conta. Não iniciar migração ampla de checkout/tokenização só por preferência nesta janela, mas **vazamento ou persistência insegura bloqueia cartão e, portanto, a entrega solicitada**. Se uma capacidade de tokenização for necessária, a disponibilidade Sandbox não prova habilitação em produção. [Criação de cobrança com cartão](https://docs.asaas.com/reference/criar-cobranca-com-cartao-de-credito), [tokenização](https://docs.asaas.com/reference/tokenizacao-de-cartao-de-credito).

### Resolver o impasse do pedido #3 sem repetir a operação

1. Conservar o #3 como evidência de detecção de cancelamento e encaminhamento para revisão. Não apagar DEAD_LETTER, redefinir PENDING para READY nem reenviar o REFUND para tentar concluir o teste.
2. Investigar motivo e autorização no provedor em paralelo. A conta ter exibido reserva/débito temporário não prova devolução; o histórico conhecido é CANCELLED.
3. Planejar **outro pedido de teste isolado**, identificado, pago no Sandbox, para comprovar devolução integral. Antes de enviá-la, conferir capacidade, saldo, procedimento de autorização e ausência de devolução em curso nessa nova cobrança. Novo caso exige identidade própria; nunca reciclar a operação do #3.
4. Preferir o fluxo da aplicação. Se a ação precisar ser feita por operador no painel, ela só serve como contingência de lançamento quando esse procedimento completo tiver sido ensaiado: uma solicitação identificada, prova remota, conciliação pela aplicação, efeitos únicos e registro de autoria. Um estorno no painel sem importação/aplicação local não fecha o gate.
5. Se a prova de devolução concluída continuar indisponível, registrar a dependência externa; não eliminar o gate sob o argumento de que o ambiente é Sandbox. A investigação da causa específica do #3 pode continuar depois **somente se** a capacidade de devolver novos pagamentos já estiver comprovada e o caso permanecer isolado do banco de produção.

Não é necessário esperar o crédito aparecer na fatura real do titular para validar o protocolo: diferenciar conclusão informada pelo provedor do prazo bancário de apresentação. A API documenta devolução de PIX/cartão e acompanhamento dos eventos; isso não substitui a prova da nossa conta. [Estornar cobrança](https://docs.asaas.com/reference/estornar-cobranca).

### Pontos e devolução física

- Validar uma compra com resgate e ganho: saldo antes/depois, total pago, política congelada, centavos, lotes e ledger; replay não repete movimento.
- Devolução deve restaurar resgate e compensar ganho conforme a política existente, incluindo ganho já gasto/déficit. Nenhuma leitura cria movimento.
- Provar expiração de lote uma vez, inclusive concorrência, e que sua rotina terá executor. Não adiar correção contábil ou zerar carteiras para iniciar.
- Antes de abrir vendas, registrar como atender devolução após retirada/entrega: dinheiro devolvido não significa mercadoria recebida. Estoque só retorna após prova física e decisão de destino disponível/indisponível.
- Automação parcial pode ficar para depois, mas precisa existir atendimento capaz de calcular/devolver o valor e reconciliar pontos/fatos sem SQL improvisado. Se o procedimento manual ainda não tiver contrato e prova, o gate continua aberto; desabilitar o botão não elimina a obrigação de atendimento.

## 6. Dados e produto: reduzir migração, não integridade

Em 12/10 o usuário informou dados de teste; em 15/10 esclareceu que **o destino comercial será o banco já configurado na main**, distinto da homologação. A proposta anterior de provisionar outra base foi superada. Reaproveitar catálogo/configuração existentes e preparar auditoria de dados, compatibilidade de schema, backup/restauração e estoque de abertura. Ensaios de escrita devem ocorrer em cópia isolada; a origem permanece somente leitura. A indicação do destino não autoriza apagar registros, aplicar migrations ou promover pedidos/pontos fictícios a obrigações comerciais. Ver seção 36.

| Situação comprovada | Caminho mais curto aceitável |
|---|---|
| Dados exclusivamente de teste, sem obrigação comercial | Destino existente da main indicado pelo operador em 15/10; classificar registros e ensaiar atualização em cópia isolada. Não excluir dados da origem nem tratar saldos/contas Sandbox como abertura comercial. |
| Existem clientes, pontos, estoque ou pagamentos reais | Inventário atual, backup restaurável e conciliação das obrigações ativas; preservar IDs e histórico. Não reiniciar saldos nem abandonar clientes. |
| Histórico incompleto sem efeito ativo | Preservar leitura autorizada e cobertura parcial; bloquear escritores perigosos, documentar exceções, responsável e prazo. Reconstrução histórica pode ser posterior. |
| Saldo/estoque ativo ou titularidade sem prova | Bloqueador da entidade/fluxo afetado. Se o isolamento não impedir prejuízo ou impedir operação essencial, bloqueador do lançamento. |

As contagens de 04/10 — 24 pedidos, 33 itens sem variante e duas carteiras — são históricas e sobrepostas. Não repetir saneamento com base nelas. O gate WF-18 do escopo exige inventário atual, conservação e tratamento das exceções; não exige fabricar fatos retroativos para zerar uma lista.

Matriz mínima de produto no candidato: produto sem variação (`Único/Padrão` e leitura dos neutros legados), produto com variações, edição conservando IDs, combinação repetida recusada, variante sem estoque indisponível, ajuste de estoque com revisão, edição concorrente com reserva e retirada de variante com carrinho/pedido vinculado. Verificar referências de imagens importadas da Nuvemshop, carregamento e bloqueio de upload na interface e nas APIs, conforme seção 70. Usar `lib/product-variants.ts`; conservar vínculos e separar o ID persistido da chave interna do formulário. Backup e auditoria antecedem qualquer reparo real.

## 7. Infraestrutura e segurança que entram no primeiro dia

**Vanderlei é responsável pelo Google Cloud e deploy.** Leno fornece contratos financeiros, dados e revisão. Usar o serviço já preparado se for adequado; se não houver escolha, avaliar Cloud Run com o standalone existente e decidir em H+2. Não migrar novamente de plataforma dentro das 48 horas por preferência estética.

### Configuração e executor

- Identificar projeto, região, domínio/TLS, imagem de implantação, segredos por referência, pool, limites de instâncias, conta Asaas e tenant. Isolar Sandbox e produção; conferir a origem das referências externas de imagens sem provisionar Storage para upload, conforme seção 70.
- Integrar/revisar a correção local de 12/10 da política financeira (seção 14) antes do Sandbox em Google Cloud. Sem declaração explícita, `lib/config/asaas-environment.mjs` conserva a inferência anterior de PRODUCTION de `NODE_ENV=production` fora do Preview Vercel. Não simular Vercel nem usar runtime de desenvolvimento como contorno.
- Ensaiar Host/proxy/origem canônica/cookies no destino real. Cabeçalhos encaminhados não podem permitir escolher tenant arbitrário; origem e links de reset não vêm de entrada não confiável.
- Reusar inbox/outbox/leases. Escolher **um executor durável principal**, com recuperação; não redesenhar todo o sistema de filas. Webhook que grava READY não basta, nem Promise solta após resposta HTTP.
- Se Cloud Scheduler/Cloud Run forem escolhidos, adaptar autenticação real do endpoint. OIDC de infraestrutura não substitui automaticamente o Bearer/CRON_SECRET do aplicativo; não deixar cron público nem sobrescrever o header errado. Demonstrar chamada legítima e recusa de anônimo/origem indevida. [Agendamento autenticado no Cloud Run](https://docs.cloud.google.com/run/docs/triggering/using-scheduler).
- Dimensionar lote pela chegada de trabalho e tempo de execução, não pelo `limit=1` dos ensaios manuais. Incluir pagamento, reconciliação, expiração de pedidos, email e expiração de pontos. Ajustar timeout do chamador/runtime e lease; timeout pode coexistir com execução ainda em curso. [Timeout do Cloud Run](https://docs.cloud.google.com/run/docs/configuring/request-timeout).
- Testar um executor interrompido e recuperação sem operador; monitorar idade da fila, falta de progresso, revisão, erros de email e quotas. Alertas precisam chegar a Leno/Vanderlei ou ao substituto registrado.

### Segurança e continuidade mínimas

Verificar acesso alheio por ID/tenant em pedidos, carteira e catálogo/Admin; recusa de upload para usuários e administradores, inclusive por chamada direta às APIs, conforme seção 70; papel administrativo, último Admin e revogação de sessão; reset de uso único e email real; proteção contra requisições de mutação de origem indevida; credenciais de webhook e rejeição de evento falso; limitação de abuso em login/reset/checkout. Conferir DTO público/Admin, caches e logs sem segredos ou dados sensíveis desnecessários. Rotação de credencial já exposta precisa de prova, não apenas remoção do texto.

Domínio/remetente da loja, links e entrega externa de confirmação/reset fazem parte do lançamento. Prepará-los em H+0, não ao final. Não transportar payload de email Sandbox para cliente real.

### Neon e desempenho sem projeto de otimização novo

Manter a preferência Neon Free, mas verificar franquia e consumo efetivo da conta. A publicação oficial recente informa 100 CU-hours por projeto/mês; a configuração real e a margem precisam ser conferidas. Polling contínuo a 0,25 CU por 30 dias representa 180 CU-hours, portanto não cabe nesse cenário hipotético. [Atualização oficial Neon](https://neon.com/blog/neon-free-plan-1-gb-per-project).

Não desligar processamento noturno para esconder esse custo. Em H+8, escolher configuração que conserve prazos e medir projeção; se Free não comportar o executor e tráfego, levar custo concreto ao titular até H+24. O orçamento pode ser decidido, mas não presumido. Uma eventual otimização sofisticada por demanda pode ficar no backlog apenas se o executor inicial já for sustentável; se for indispensável para caber nas cotas, ela é bloqueadora e ameaça o prazo.

Proposta de limites provisórios para aprovação em H+2: conteúdo principal e ação de compra utilizáveis em até 3 s no p95 quente no dispositivo/rede registrados; primeira carga fria até 5 s; ausência de bloqueio por vídeo/animação. Medir home, produto, carrinho e checkout, não apenas HTTP. A meta anterior de 1–1,5 s continua no backlog. São metas propostas, não medições nem aceite já obtido.

Manter o perfil original de 30–80 simultâneos e 2–5 checkouts/minuto como referência. Validar carga em ambiente isolado equivalente, sem bombardear gateway real; medir pool/locks e nenhuma duplicação/saldo inválido. Capacidade inferior só permite abertura reduzida se houver limite técnico verificável e aceite comercial; “sem campanha” sozinho não limita concorrência. Monitorar dados reais após abrir.

## 8. Homologação compacta: uma rodada por mudança relevante

Não reexecutar todo o Workflow desde WF-00. Aplicar esta matriz ao candidato e reutilizar provas anteriores quando o código/contrato/configuração não mudaram.

| Bloco | Execução | Evidência de saída |
|---|---|---|
| Financeiro/recuperação | Suítes existentes de payment-durable-execution, payment-process-recovery, payment-plan-authority, payment-lifecycle-homologation e refund-history em wrappers isolados. | Falha/replay/concorrência sem duplo efeito, mudança de código revisada. |
| Pontos/estoque/identidade | Suítes de loyalty-lot-accounting, inventory-admin-integrity, checkout-intent-authority, purchase-tenant-scope e auth-eligibility-atomicity. | Ledger/reservas/IDs conservados e acessos recusados. |
| Dados | Restore de snapshot atual aplicável e migrations no clone; vazio se novo schema/base. | Recuperação medida, vínculos, sequência e inventário antes/depois. |
| Candidato integrado | Build, tipagem, lint e seleção auditada de runtime/standalone com duas instâncias. | Commit/artefato/configuração únicos, sem tratar resultado antigo como teste novo. |
| Navegador | Desktop e um mobile representativo, duas abas/reload/troca de identidade, catálogo/Admin, PIX/cartão, retirada e reset. | Fluxo essencial sem erro ou ação incompatível com estado. Matriz de navegadores adicional pode seguir depois. |
| Conta e transporte | Casos dirigidos Sandbox dos dois métodos e devolução; integração de webhook/email. | Contrato real; mocks explicitamente identificados. |
| Destino final | Origem/tenant/cookies, jobs/alertas, capacidade e canários controlados. | Fluxo não depende de Console/PowerShell manual para funcionar. |

Comandos disponíveis: `npm run test:integration:isolated -- <arquivo>`, `npm run test:unit`, `npm run test:isolation:negative`, `npm run test:migrations:isolated`, `npm run test:legacy:isolated`, `npm run build:isolated`, `npm run test:production:isolated`, `npm run test:standalone:linux` e `npm run test:capacity:isolated`. Selecionar a rodada final sem duplicar builds/suítes já incluídos pelo wrapper. Ler o script antes de executar; nunca apontar testes destrutivos ao Neon compartilhado.

Entrega de cada cenário: `candidato + configuração + ambiente/conta + caso + antes/depois + resultado + limite + revisor`. Capturar por um coletor/relatório sanitizado sempre que possível. Não pedir confirmação humana para cada leitura segura; reservar a interação para ambiente, operação financeira, dado faltante ou resultado divergente.

## 9. Bloqueadores de lançamento e critério objetivo de aceite

Nenhum item abaixo está aprovado por este documento. Um defeito crítico é perda/duplicação de dinheiro, estoque ou pontos, acesso indevido, indisponibilidade do fluxo indispensável ou obrigação durável sem recuperação.

Estado consolidado, fontes e condições de fechamento em 16/10: [checklist G1–G8](../../../../../../trabalho_em_dupla/CHECKLIST_PRODUCAO_G1_G8.md). A matriz abaixo define critérios; a consolidação distingue provas locais, clone, Sandbox, Cloud Run e aceite produtivo.

| Gate | Dono / revisor | Evidência necessária |
|---|---|---|
| G1 — escopo e bloqueios | Leno / Vanderlei | PIX, crédito até 12x, boleto, débito e entrega conforme decisões posteriores; respeitar a exceção do teste de expiração do boleto da seção 36. Manual/parcelas acima do limite e modalidades não homologadas recusados em UI e chamadas diretas, antes de reserva/cobrança. Débito não homologado continua lacuna do escopo obrigatório, não exclusão aprovada. |
| G2 — dados restauráveis | Leno / Vanderlei | Banco alvo identificado, inventário atual, obrigações ativas conciliadas ou isolamento comprovado, backup/restore e migrations ensaiados. |
| G3 — financeiro | Leno / Vanderlei | Aprovação/recusa/expiração/incerteza/replay/devolução dos métodos ativos, conta correta e efeitos únicos. #3 não substitui devolução concluída. |
| G4 — pontos/produtos | Leno / Vanderlei | Ganho/resgate/déficit/expiração e cadastro/edição/variantes/reserva concorrentes conservados. |
| G5 — segurança | Vanderlei / Leno | Tenant/ownership/Admin/reset/cookies/webhook/segredos/cartão aprovados; exposição crítica resolvida. |
| G6 — execução automática | Vanderlei + Leno | Pagamentos, emails e rotinas de expiração progridem; reinício recupera trabalho; alertas testados e responsável disponível. |
| G7 — experiência e capacidade | Vanderlei / Leno | Fluxo mobile/desktop e operação comercial corretos; limites de latência/carga registrados e sustentáveis. |
| G8 — candidato e operação | Vanderlei / Leno | Revisão cruzada, mesmo artefato, domínio/e-mail/configuração corretos, imagens externas e bloqueio de upload conforme seção 70, procedimento de contenção/recuperação ensaiado e aceite do escopo. |

**Não liberam produção:** Preview Ready, testes locais verdes sozinhos, `uncertain=0` com revisão não atendida, “refund solicitado”, estoque apenas visual para validar concorrência, ocultar botão, ignorar retorno de gateway, desabilitar testes ou ajustar saldo/status por SQL.

Pontos de partida operacionais propostos: pagamento reconhecido até 2 min após evento/consulta disponível e email aceito até 5 min; alerta por backlog sem progresso por 5 min ou três execuções falhas. Prazos devem ser dimensionados em H+8 e verificados no candidato; indisponibilidade do provedor precisa de estado visível e atendimento, não falso sucesso. Proposta de recuperação: RTO até 60 min e RPO até 15 min, com reconciliação de todas as operações financeiras do intervalo. Se o ambiente não puder demonstrá-los, definir e aprovar limites reais antes da abertura; não prometer perda financeira zero apenas com backup.

## 10. Rastreabilidade: os 38 achados continuam visíveis

P0 = invariantes do escopo ativo antes de vender. B = parte de capacidade bloqueada até aceite. P1 = melhoria posterior sem permitir efeito incorreto. As marcações são prioridades, não status de conclusão.

| LA | Tratamento nesta release |
|---|---|
| 001 | P0: variante persistida, produto/Admin e reserva correta. |
| 002 | P0: transições e efeitos do escopo; B/P1: automação parcial/física, somente com procedimento seguro já atendendo devoluções. |
| 003 | P0: inbox/outbox, falha e recuperação automática. |
| 004 | P0: intenção durável e replay; P1: expansão da matriz de dispositivos. |
| 005 | P0: separação financeiro/reserva e obrigações ativas. |
| 006 | P0: isolamento do harness e candidato. |
| 007 | P0 entrega com transportadora escolhida; B apenas transportadoras adicionais não ofertadas. |
| 008 | Mesma divisão de 007; não aceitar tarifa do cliente nem frete gratuito de fallback. |
| 009 | P0 cartão à vista e parcelado, centavos/taxas e contrato completo; B somente quantidades acima do limite homologado. |
| 010 | P0 expiração PIX/cartão e corrida; B boleto. |
| 011 | P0 idempotência por identidade/tenant no domínio final. |
| 012 | P0 replay após resposta perdida/restart. |
| 013 | P0 inventário de todos os escritores de compra e bloqueios. |
| 014 | P0 ownership/tenant, inclusive proxy real. |
| 015 | P0 consumo único de carrinho. |
| 016 | P0 reload/troca de identidade; P1 navegadores adicionais. |
| 017 | P0 concorrência/revisão/locks no volume liberado. |
| 018 | P0 retirada de variante sem perder vínculo ou reabrir estoque. |
| 019 | P0 catálogo separado de ajuste de estoque. |
| 020 | P0 isolamento de identidade; B convidado se desabilitado efetivamente. |
| 021 | P0 carteiras ativas/lotes; P1 reconstrução histórica sem efeito ativo. |
| 022 | P0 expiração de pontos idempotente com executor. |
| 023 | P0 política/ganho congelados e arredondamento. |
| 024 | P0 dados de cobrança PIX/cartão/retirada; B modalidades não ofertadas. |
| 025 | P0 confirmação e ações dos métodos ativos; B telas de método bloqueado. |
| 026 | P0 expedição/rastreio de entrega, com persistência e autoria. |
| 027 | P0 autoria/histórico nas novas operações; P1 reconstrução comprovável do passado. |
| 028 | P0 reset, token e revogação de sessão reais. |
| 029 | P0 último Admin e recuperação administrativa. |
| 030 | P0 migrations/restore atuais e recuperação medida. |
| 031 | P0 configuração/revogação de capacidades; B cache de transportadora desabilitada. |
| 032 | P0 carteira da identidade correta e leitura sem efeitos. |
| 033 | P0 proveniência, cartão/PIX, pagamento tardio, revisão e atendimento de devoluções/contestação; B/P1 automações adicionais e histórico inativo. |
| 034 | P0 respostas assíncronas não corrompem compra; P1 cobertura visual ampliada. |
| 035 | P0 disponibilidade real de PIX/cartão e recusa dos demais métodos. |
| 036 | P0 informação não engana operador; P1 relatórios/EXPLAIN/ampliação histórica. Ocultar indicador não confiável, mantendo pedidos/fatos acessíveis. |
| 037 | P0 retirada/entrega conforme modalidade ativa, somente com pagamento autorizado e autoria. |
| 038 | P0 nenhum segredo exposto em DTO/cache/logs; rotação quando necessária. |

E01–E09 e E12 continuam pré-requisitos do escopo ativo; E10 é integral para frete ativo ou bloqueio testado; E11 tem matriz mínima agora e expansão depois; E13 conserva operação/efeitos corretos e permite adiar enriquecimento de métricas; E14 exige destino/recuperação/capacidade agora e otimização adicional depois. Referências de testes e critérios originais: [matriz WF-19](../../Workflow/MATRIZ_HOMOLOGACAO_INTEGRADA_WF19.md).

## 11. Backlog posterior à abertura

D+N significa dias corridos após abertura efetiva. Não habilitar uma capacidade por ter chegado sua data: precisa de ensaio, revisão e publicação identificada.

| Entrega posterior | Dono | Prazo-alvo | Contenção até conclusão |
|---|---|---|---|
| Fechamento da observação WF-20, primeira conciliação diária e revisão de alertas | Ambos | D+1 e D+3 | Operação assistida e contenção de novos pedidos afetados se houver divergência. |
| Causa definitiva do cancelamento #3 e parecer consolidado do caso | Leno | D+3 ou prazo formal do provedor | Caso Sandbox preservado; devolução funcional de novos pagamentos já provada para abrir. |
| Meta refinada de home/páginas 1–1,5 s e otimização de mídia | Vanderlei | D+7 | Navegação/compra já disponíveis dentro do limite provisório aprovado. |
| Mais dispositivos/navegadores, leitores alternativos e acessibilidade adicional | Vanderlei | D+7 | Fluxo essencial acessível e testado em desktop/mobile no lançamento. |
| Métricas avançadas, cobertura histórica e ajustes de consultas | Vanderlei + Leno | D+7 | Indicadores parciais identificados ou ocultos; valores operacionais corretos. |
| Transportadoras adicionais além das homologadas no lançamento | Vanderlei | D+7 | API/UI bloqueadas para essas opções; entrega inicial e rastreio já funcionais. |
| Boleto e ampliação de parcelas além do limite de lançamento | Leno + Vanderlei | D+7 a D+14 | Boleto indisponível e limite homologado respeitado no servidor; parcelamento inicial obrigatório. |
| Automação completa de parcial, retorno físico e contestação | Leno | D+14 | Procedimento auditado já ensaiado antes da abertura; financeiro e estoque não são acertados por improviso. |
| Reconstrução histórica não operacional | Leno | D+14, por ocorrência | Preservação, leitura autorizada e restrições aos writers; nenhuma dívida/ponto ativo abandonado. |
| Economia avançada, executor por demanda e relatórios de capacidade de longo prazo | Vanderlei + Leno | D+7 a D+14 | Infra inicial já sustentável; não serve para adiar solução de quota insuficiente. |

## 12. Implantação, contenção e fechamento do Workflow

1. **Antes de vender:** G1–G8 aceitos na mesma release; cenário de devolução concluída e procedimento após entrega comprovados; banco/conta de produção distintos da homologação. Leno assina dados/financeiro, Vanderlei infra/segurança e ambos o escopo.
2. **Publicação:** Vanderlei aplica o procedimento de deploy final; migrations são uma etapa controlada, não efeito de build ou subida de cada instância. Backup e plano de recuperação disponíveis; conferir diferenças desde o snapshot.
3. **Verificação restrita antes da abertura pública:** compras controladas pelos responsáveis nos dois métodos, valores/alvos previamente definidos, efeitos e processamento conferidos. Instrumentos de teste só no Sandbox; não usar cartões de cliente como fixture. Um estado bancário assíncrono deve ser acompanhado conforme contrato, sem chamar pedido aceito de pagamento finalizado.
4. **Abertura gradual:** habilitar o escopo aceito e observar continuamente na janela; conferir filas, método/conta, estoque, pontos, email, recursos e primeira operação comercial real. Em até 24 h, conciliação completa do período inicial; em D+3, revisão operacional.
5. **Incidente:** interromper novas compras afetadas por controle de checkout/capacidade já testado, mantendo recepção de webhook e recuperação das obrigações abertas. Não usar `PAYMENT_WORKER_ENABLED=false` como interruptor universal: pode interromper recebimento/processamento necessário. Preservar IDs, fatos e evidência; Vanderlei contém runtime e Leno reconcilia efeitos.
6. **Recuperação:** reverter código somente se compatível com schema/mensagens; preferir correção adiante quando necessário. Restore não desfaz pagamentos no Asaas e não pode apagar operações posteriores ao snapshot; reconciliar o intervalo.
7. **WF-18/19:** registrar aceite do banco e do escopo inicial, mais a lista explícita de capacidades bloqueadas/adiadas. O fechamento integral permanece aberto onde houver trabalho original pendente.
8. **WF-20:** iniciar com implantação controlada; encerrar os LA aplicáveis após evidência operacional, sem transformar quatro horas de observação em garantia de todos os ciclos futuros.

### Quadro único de execução a preencher

| Campo | Registro |
|---|---|
| Início coordenado / limite de 48 h | Plano datado de 10/10; retomada efetiva nesta sessão em 12/10/2026. Horário inicial não registrado; sem extensão automática de prazo. |
| Escopo comercial final | PIX, cartão à vista/até 12x e entrega obrigatórios. Juros e modalidades encontrados no projeto, detalhados na seção 15; validar implantação efetiva. |
| Banco de lançamento / obrigações legadas | Destino definido em 15/10: banco já configurado na main. Classificação dos dados, compatibilidade, recuperação e estoque de abertura continuam pendentes; origem somente leitura. Seção 36. |
| Conta/cartão, domínio/email, Google Cloud e executor | Titular e estado a registrar em H+2. |
| Candidato congelado | Commit + imagem/hash + migrations + versões de configuração, sem valores secretos. |
| G1–G8 | Por gate: pendente/aprovado/reprovado, prova e revisor; não preencher por inferência. |
| Parecer de Leno / Vanderlei | Data, resultado e bloqueios; revisão recíproca obrigatória dos pontos críticos. |
| Decisão H+36 / liberação | Data, responsáveis, capacidades efetivamente habilitadas e critérios restantes. |
| Observação / incidentes / retomada | Registro por operação e responsável; backlog com prazo. |

## 13. Fontes e limites desta revisão

Foram conferidos o plano em dupla, o [Workflow](../../Workflow/WORKFLOW_IMPLEMENTACAO_CORRECOES_LOGICAS.md), o [registro de execução](../../Workflow/REGISTRO_EXECUCAO_CORRECOES_LOGICAS.md), a [matriz de legados](../../Workflow/MATRIZ_COMPATIBILIDADE_E_RECONCILIACAO_LEGADOS.md), a [matriz WF-19](../../Workflow/MATRIZ_HOMOLOGACAO_INTEGRADA_WF19.md), os [contratos comuns](../../Workflow/CONTRATOS_COMUNS_CORRECOES_LOGICAS.md) e o roteiro/evidências recentes do pacote financeiro. Documentos antigos preservam checkpoints; o plano usa as evidências posteriores sem promovê-las a aceite global.

Inspeção local dirigida confirmou `services/payment/capabilities.service.ts`, `services/asaas/asaas.adapter.ts`, `lib/config/payment.config.ts` e `lib/config/asaas-environment.mjs`. Há controles `enablePix`, `enableCreditCard`, `enableBoleto`, `enableManualPix`, `INSTALLMENT_MAX_COUNT` e `ASAAS_INSTALLMENTS_APPROVED`; isso não prova que todos os escritores respeitem o bloqueio no candidato. Em 12/10, parcelamento passou a obrigatório: definir e homologar limite/taxas antes de ativar sua aprovação. Manter os métodos não ofertados bloqueados e testar chamadas diretas. Não foram criadas flags fictícias para frete/devolução.

Documentação oficial de Google Cloud, Neon e Asaas foi consultada em 10/10/2026 e vinculada nas decisões correspondentes. Nenhum preço, quota da conta, habilitação de cartão/tokenização, política comercial ou recurso remoto foi tratado como inspecionado. A elaboração inicial em 10/10 não executou testes novos, modificou código/banco ou publicou deployments. A execução local posterior está registrada abaixo.

## 14. Execução retomada em 12/10 — ambiente financeiro explícito

**Responsável: Leno (Brega). Revisão/integração com Vanderlei pendente.** Base local permanece `461437d`; preservados os complementos locais anteriores do roteiro e do script de retomada #3. Não foi realizada consulta ao remoto para certificar novas branches/deployments de Vanderlei. Seu resumo de entregas foi solicitado e ainda não recebido nesta sessão.

### Correção implementada localmente

O bloqueio reproduzido era a recusa de Sandbox em runtime otimizado fora do Preview Vercel, impedindo ensaio da infraestrutura final com a configuração de homologação. A política compartilhada pelo cliente Asaas e pelo preflight agora aceita a variável de servidor `PAYMENT_DEPLOYMENT_ENVIRONMENT`, com valores exatos `SANDBOX` ou `PRODUCTION`.

| Configuração | Resultado |
|---|---|
| Variável ausente | Compatibilidade anterior: Preview Vercel identificado usa Sandbox; runtime otimizado comum espera produção. |
| `SANDBOX` + `NODE_ENV=production` fora da Vercel | Permite capacidade Sandbox se URL/chave e escopo explícito forem compatíveis; credencial de produção é recusada. |
| `PRODUCTION` | Requer runtime otimizado, escopo explícito válido e URL/prefixo de chave de produção. |
| Valor vazio, desconhecido, com caixa/espaço diferente | Política INVALID, capacidade remota indisponível; não recua silenciosamente para produção. |
| Escopo ausente/inválido com declaração explícita | INVALID. `ASAAS_ACCOUNT_SCOPE` deve usar 1–24 caracteres alfanuméricos, `_` ou `-`. |
| Declaração contradiz Preview/produção Vercel | INVALID; não permite Sandbox em produção Vercel nem produção no Preview. |

O preflight retorna `PAYMENT_DEPLOYMENT_ENVIRONMENT_INVALID` quando a declaração conflita, inclusive com execução remota desabilitada. Mantém `productionReady=false`, sem chamadas externas e sem valores de credenciais no resultado. `ASAAS_ACCOUNT_SCOPE` identifica a conta no domínio, mas sua sintaxe/nome não comprova a propriedade ou o ambiente da conta. Banco e integrações precisam de conferência independente; não renomear o escopo de tentativas já existentes durante rotação de chave.

**Contrato proposto para Vanderlei no Google Cloud:** homologação usa runtime `NODE_ENV=production`, declaração `SANDBOX`, escopo próprio da conta Sandbox, URL/chave Sandbox e banco de homologação identificado; produção usa declaração `PRODUCTION`, escopo próprio da conta real, URL/chave reais e banco de produção separado. Usar referências de segredos; a variável não é `NEXT_PUBLIC_*`. Não inventar marcadores `VERCEL` nesse ambiente. Configuração exige publicação/revisão própria e não foi aplicada remotamente nesta sessão. Allowlist de lojas, autenticação de webhook/cron e flags de capacidade continuam necessários.

### Validação e limites

- Antes da implementação, os 13 casos novos de política falharam, reproduzindo a lacuna; os sete casos anteriores passaram.
- Após a correção, **64 testes em seis arquivos passaram**: asaas-environment, production-environment-policy, asaas-adapter, asaas-credit-card, asaas-boleto e refund-history. São testes locais, com transporte simulado quando aplicável, não novas cobranças nem homologação de cartão parcelado.
- TypeScript (`--noEmit --incremental false`) e ESLint nos quatro arquivos alterados de código/testes passaram. Aviso preexistente do Vite sobre futuro configLoader não impediu a execução.
- Sem alteração de schema, dados, variáveis remotas, credenciais, compra, estorno, fila ou deploy. Não executado build final nesta etapa; o candidato integrado e a implantação Google Cloud ainda exigem seus gates.

### Próximo trabalho concreto e dependências

| Frente | Situação / próxima ação |
|---|---|
| G1 — escopo | Confirmados PIX + cartão até 12x + entrega. Regras comerciais recuperadas na seção 15; validar configuração efetiva, limites no servidor e cotação. |
| G2 — dados | Usuário confirmou apenas testes. Preparar provisionamento separado, migrations e inventário de carga aprovado; preservar Sandbox e não importar carteiras/vendas fictícias. |
| G3 — financeiro | Conferir configuração aplicada e capacidade da conta à luz das regras já definidas; executar roteiro consolidado de cartão à vista/parcelado, recusa e estorno. #3 permanece preservado como revisão, não rearmado. |
| G5/G6/G8 — destino | Vanderlei revisa o contrato acima, informa entregas/commit e prepara proxy/domínio/email/executor. Correção local ainda não comprova configuração remota ou operação automática. |

O replanejamento foi atualizado com as decisões de 12/10; não foi reiniciado o relógio de 48 horas nem aprovado qualquer gate global. Trabalhos locais independentes podem continuar enquanto a configuração implantada e o resumo de Vanderlei são conferidos.

## 15. Relatório das regras existentes — parcelamento, juros e entrega

**Inspeção local em 12/10/2026.** O usuário confirmou o teto de 12 parcelas e solicitou recuperar as demais decisões no projeto. Foram comparados documentos e código; não foram consultados segredos, configuração remota, tabelas do banco implantado ou serviços externos nesta inspeção. Portanto, os valores abaixo são decisões documentadas e comportamento do código, não comprovação de capacidades ativas em produção.

### 15.1. Parcelamento e responsabilidade pelos juros

Fonte comercial: `diversos/PALENJAMENTO_BANCO/Correcao/correcao_2/WORKFLOW_IMPLEMENTACAO_CARTAO_E_BOLETO.md`, seção 17, decisões 1 e 3. O lojista já deliberou repassar as taxas de parcelamento ao comprador inicialmente e permitir absorção pela loja no futuro.

| Ponto | Regra encontrada e implementação atual |
|---|---|
| Máximo | Até **12 parcelas**, confirmado novamente pelo usuário. O schema rejeita configuração acima de 12. |
| Juros | Comprador arca com o financiamento por padrão: `INSTALLMENT_ABSORB_FEES=false`. A opção `true` permite parcelamento sem juros ao comprador. |
| Taxa | Padrão **2,99% ao mês**, por `INSTALLMENT_MONTHLY_RATE=0.0299`; configurável. O código usa essa taxa, não consulta automaticamente a tarifa contratada da conta Asaas. Não comprova repasse exato de todas as tarifas cobradas pelo provedor. |
| Parcela mínima | **R$ 20**, configurável por `INSTALLMENT_MIN_VALUE`. Para mais de 1x, o limite considera o total comercial antes dos juros dividido pelo piso, arredondado para baixo. |
| À vista | 1x não recebe acréscimo de financiamento nesse motor. |
| Cálculo | Tabela Price com aritmética racional em centavos, arredondamento HALF_UP e ajuste de resíduo na última parcela quando necessário. |
| Base financiada | Mercadorias menos desconto de pontos mais frete. O ganho de pontos usa mercadorias líquidas do desconto, excluindo frete e juros. |
| Ativação | Cartão depende das capacidades da loja/conta. O adapter restringe a **1x** se `ASAAS_INSTALLMENTS_APPROVED` não for `true`; essa flag não comprova habilitação da conta por si só. |

Exemplos de quantidade máxima com piso R$ 20: total comercial R$ 49,90 permite até 2x; R$ 100 permite até 5x; R$ 240 permite até 12x, sujeitos à capacidade ativa. As prestações finais recebem os juros configurados; os exemplos de divisão simples do documento histórico não representam o valor final com juros.

Arquivos conferidos: `lib/config/payment.config.ts`, `services/payment/installment.service.ts`, `services/payment/financial-plan.service.ts`, `services/payment/capabilities.service.ts`, `services/asaas/asaas.adapter.ts` e `services/checkout-plan.service.ts`. A política de parcelas atualmente é lida de variáveis de servidor; não assumir edição por loja no Admin apenas porque o documento antigo propõe ambiente/banco como alternativas.

### 15.2. Modalidades de entrega existentes

O documento `diversos/PLANEJAMENNTO_DASHBOARD/WORKFLOW_IMPLEMENTACAO_DASHBOARD.md` lista os cinco provedores encontrados no orquestrador atual:

| Modalidade | Como calcula / quando oferece |
|---|---|
| **Correios — PAC e SEDEX** | Consulta HTTP com CEP de origem/destino, peso, dimensões e valor declarado. Depende de `enableCorreios` e dados da loja. Soma `additionalDays` ao prazo retornado. Não utiliza a matriz J&T. |
| **J&T Express Standard** | Consulta tabelas `JtExpressGeocom` e `JtExpressRate`, por faixa de CEP e peso. A matriz instalada só é aplicada à origem **67140-615, Ananindeua/PA**. Exige tarifas existentes e destino coberto. |
| **Entrega local/própria** | Valor fixo em `FreightRule` da loja, associado a UF, código de município e nome normalizado da cidade. Prazo calculado: 1 dia mais prazo adicional da loja. |
| **Retirada no balcão** | `STORE_PICKUP`, condicionado a `enablePickup`, custo e prazo de frete zero. |
| **A combinar via WhatsApp** | `NONE`, condicionado a `enableNoFreight`, sem frete cobrado no pedido. É combinação posterior, não promessa de transporte gratuito nem substituto da entrega obrigatória. Não confundir modalidade logística com método de pagamento PIX manual/WhatsApp. |

Detalhe J&T: peso tarifável é o maior entre peso físico e cubagem `(comprimento × largura × altura) / 6000`. O preço soma tarifa da faixa, quilos adicionais quando aplicáveis e configurados, mais seguro/risco sobre o valor das mercadorias: **0,6%** em área normal (0,2% + 0,4%) ou **1,3%** em área de risco (0,3% + 1%). Prazo é o da região, com fallback de 3 dias, mais `additionalDays`, limitado a no mínimo 1 dia. A documentação menciona 58 faixas e 5.181 tarifas; essa quantidade não foi recontada no banco nesta sessão.

Implementações: `services/freight/providers/{correios,jt-express,custom-table,pickup,none}.provider.ts`. O orquestrador separa entrega, retirada e combinação; uma falha de cotação não converte entrega silenciosamente em retirada ou frete gratuito. Sem opção válida para a modalidade solicitada, retorna indisponibilidade. As opções são ordenadas por preço e a cotação tem validade de até 30 minutos, vinculada aos dados e revisões do servidor.

### 15.3. Diferenças relevantes e próximos testes

1. **Correios:** o roadmap descreve CWS e menciona Mini Envios, mas o provider atual usa `CalcPrecoPrazo.aspx`, serviços 04014/04510 e apenas PAC/SEDEX. CWS/Mini Envios não devem ser declarados implementados com base no roadmap. Validar cotação real no candidato antes de ofertar esses serviços.
2. **J&T e base limpa:** levar para a produção as tabelas/revisões tarifárias aprovadas e confirmar CEP de origem compatível. Preservar configurações comerciais necessárias mesmo separando vendas/clientes/carteiras de teste. Conferir também limites de peso e disponibilidade de tarifa adicional; o código busca a maior faixa quando não encontra correspondência.
3. **Catálogo:** a autoridade de frete usa padrões de 300 g e 16 × 11 × 4 cm quando faltam medidas. Cadastrar pesos/dimensões reais dos produtos de lançamento para evitar subcotação.
4. **Parcelamento:** usar a política já decidida; conferir configuração aplicada e tarifa contratada, disponibilidade até 12x, piso de R$ 20, total com frete/desconto, consentimento do total, aprovação/recusa e estorno. A existência do cálculo local não encerra homologação financeira.
5. **Entrega:** conferir um destino coberto por cada modalidade ofertada, destino fora de cobertura, alteração de carrinho/endereço, cotação expirada e indisponibilidade de provedor, além de expedição/rastreio. Provedores citados apenas como expansão no roadmap não entram como funcionalidades existentes.

**Resultado:** não há necessidade de solicitar novamente ao usuário quem paga os juros ou quais provedores foram previstos. A próxima etapa é validar os parâmetros efetivamente aplicados e executar a matriz objetiva de cartão até 12x e entrega, preservando os bloqueios financeiros já registrados.

## 16. Entrega para Vanderlei — 13/10/2026

O usuário autorizou publicar a versão atual em `homologacao_teste`. A conferência por fetch encontrou o remoto em `461437d60a77f2ba5150a30527f188b5c5d8e437`, igual à base local antes do novo commit. A entrega reúne a correção de ambiente da seção 14, seus testes, este replanejamento, evidências posteriores do #3 e o script histórico de retomada, além do modelo de ambiente e do guia de continuidade atualizados. Não há migration nova nem ativação de configuração remota neste pacote.

Ponto de entrada do colega: [guia de revisão e continuidade](../../../../../../PACOTE_REVISAO_VANDERLEI/REVISAO_LENO_L01_L04_PARA_VANDERLEI.md), seção inicial de 13/10. Identificar o SHA entregue pelo commit que contém esta seção e pelo HEAD remoto; conferir separadamente o SHA e o resultado do deployment Preview. Credenciais, arquivos `.env` privados, backups e dados do banco não integram a publicação. O `.env.example` contém apenas exemplos e instruções, mantendo capacidades remotas desativadas por padrão.

**Validação executada em 13/10:** 64 testes dirigidos em seis arquivos passaram, TypeScript e ESLint direcionado passaram, sintaxe do script de retomada passou e build otimizado isolado passou (Next 16.3.5, 55 páginas, PostgreSQL 18 descartável). Isso confirma a validação local desta entrega; não comprova Preview Ready, deploy Google Cloud, cartão/estorno externos ou gates G1–G8. A CI atual não dispara para push em homologacao_teste; não atribuir sua aprovação a esta publicação. A instrução para reproduzir os testes está no guia.

O prazo original permanece registrado, sem reinício. Próximas ações continuam sendo revisão de Vanderlei, configuração e identificação do candidato, ensaio financeiro de cartão até 12x/PIX/devolução, validação de frete e preparação do ambiente de produção separado.

## 17. Ampliação do escopo e retomada da homologação — 13/10/2026

O usuário informou ter habilitado crédito e boleto no Admin de homologação e determinou que boleto e compras com cartão de débito estejam prontos antes do lançamento. Boleto passa a P0, substituindo seu adiamento em G1, LA-010, nas matrizes financeiras e no backlog D+7–14. Débito também passa a P0: levantar contrato do provedor/conta, implementar e testar a cadeia completa antes de declará-lo disponível. A inspeção local de `types/payment-gateway.types.ts`, `lib/commerce/contracts.ts` e `services/asaas/asaas.adapter.ts` encontrou somente PIX, BOLETO, CREDIT_CARD e, no domínio, WHATSAPP_PIX. Não foi verificado nesta etapa o suporte externo a débito; não inferi-lo pelo uso de cartão físico ou múltiplo.

G1/G3 devem incluir todos os novos métodos exigidos, assim como os gates transversais de segurança, pontos, estoque, recuperação e operação. O requisito de prontidão integral não equivale a prova de ausência absoluta de falhas nem permite considerar habilitação de UI como homologação. O prazo original não é automaticamente prorrogado ou reiniciado.

Próximo passo de crédito: recarregar o checkout do mesmo Preview após salvar a configuração, selecionar cartão e verificar o seletor de parcelas e totais, ainda sem concluir compra. Com o total comercial de R$ 49,90 mostrado anteriormente, o piso R$ 20 permite até 2x. Para conferir o teto 12x, preparar total comercial de pelo menos R$ 240 antes dos juros, usando produtos/variantes com estoque disponível, sem resgatar pontos nessa conferência inicial. Registrar subtotal, frete, total comercial e oferta de 12x (prestação e total financiado). Não alterar estoque/preço apenas para forçar o teste. Depois dessa conferência, preparar o pagamento Sandbox e evidências anteriores/posteriores em uma rodada coordenada.

## 18. Estoque geral e por variante — entrega de homologação de 13/10/2026

Em 13/10/2026, o usuário solicitou a correção do saldo exibido após ajustes, a edição explícita por variante e a adequação visual ao design do Admin. Em seguida, autorizou publicar este pacote na branch `homologacao_teste` para atualização do Preview Vercel. Identificar a entrega pelo commit que contém esta seção e conferir seu SHA no remoto e no deployment. A publicação para homologação não aprova produção nem encerra os testes pendentes abaixo.

- `InventoryPanel` comunica o saldo consultado ao `ProductForm`, atualizando estoque geral e variantes por ID persistido. Nome, preço, combinações em edição e revisão do catálogo são preservados; salvar catálogo continua sem sobrescrever estoque.
- O painel apresenta a tabela **Estoque por variante**, com disponível, indisponível e botão **Ajustar estoque** em cada linha. O botão seleciona a variante e direciona ao campo Quantidade; o operador informa a contagem ou reposição/baixa e o motivo, depois usa **Registrar ajuste**. Trocar de item limpa quantidade e motivo para evitar reaplicar o rascunho a outra variante.
- O ajuste reutiliza o endpoint administrativo existente, com ID da variante, controle de revisão, identidade do comando e auditoria. O limite geral permanece independente das variantes. Variantes novas no cadastro em edição precisam ser salvas antes de receber ajuste; itens retirados continuam sujeitos à reativação explícita.
- Adequação visual ao cadastro de produtos: fundo `catalog-card`, bordas e títulos `catalog-gold`, campos azul-escuros, tipografia monoespaçada de rótulos, cantos arredondados e botão principal amarelo. Saldos em destaque, tabela com seleção visível, foco de teclado e rolagem acessível no celular, campos em duas colunas no desktop e empilhados no celular. Mensagens em caixa própria e indicador de processamento. Não há migration nem alteração de configuração de ambiente.

**Conferência visual:** renderização estática do componente com dados fictícios e CSS do projeto inspecionada no Chrome em desktop e viewport móvel de 390 px, sem transbordamento horizontal da página; a tabela tem rolagem própria. Essa conferência não substitui o teste funcional de navegador com banco descrito abaixo. Após a adequação visual, os 14 testes unitários, TypeScript e ESLint foram executados novamente e passaram.

**Validação local:** 14 testes unitários passaram (`product-form-variants`, `inventory-draft`, `inventory-lifecycle`); TypeScript e ESLint dos arquivos envolvidos passaram. O teste novo `tests/integration/inventory-admin-browser.test.ts` cobre ajuste de duas variantes e do geral, preservação do rascunho, persistência após recarregar e três auditorias. Sua execução junto de `inventory-admin-integrity` ficou pendente: Docker Desktop não iniciou, impedindo provisionar PostgreSQL descartável. Não houve acesso ou ajuste no banco de homologação por esta execução.

Antes de aprovar a entrega, executar em ambiente isolado:

```powershell
node scripts/run-isolated-tests.mjs tests/integration/inventory-admin-browser.test.ts tests/integration/inventory-admin-integrity.test.ts
```

Esta entrega reúne os dois componentes e os testes unitário/de navegador, junto desta documentação. A conferência anterior ao commit encontrou a base local e remota em `d66a416`, sem divergência; 14 testes, TypeScript e ESLint passaram novamente. Docker permaneceu indisponível. No Preview correspondente, conferir que o ajuste de uma variante atualiza tabela e campo do formulário, preserva as outras variantes e o limite geral, e que ajustar o geral também atualiza seu campo sem recarregar. Confirmar persistência e auditoria com dados de teste dedicados. Este pacote não encerra os gates financeiros nem comprova resolução do atraso no carrinho.

## 19. Retomada do cartão — oferta de 12 parcelas

O pacote de estoque foi enviado como `a6ab64293ca78b9fa378af9c19cf5eec4028bbf0` à branch `homologacao_teste`. O status Vercel desse SHA retornou `success` / `Deployment has completed`. O usuário informou que as particularidades do cadastro foram resolvidas e retomou a homologação financeira, sem concluir a compra.

A imagem enviada mostra seis unidades de R$ 49,90, subtotal R$ 299,40, retirada sem frete e opções de 1x a 12x. A oferta de 12x é R$ 30,06 por parcela, total R$ 360,72; diferença de R$ 61,32 sobre o valor comercial. O cálculo Price em centavos a 2,99% a.m. confere com essa oferta. Isso evidencia a apresentação do parcelamento; não comprova cobrança, aprovação do cartão ou contrato do provedor.

Na captura, a lista está aberta com 12x destacado, mas o campo ainda exibe 1x e o resumo R$ 299,40. Próxima conferência: efetivar a seleção de 12x e fechar a lista; o resumo deve atualizar para R$ 360,72 e apresentar o plano escolhido. Manter sem resgate de pontos neste caso. Depois conferir a proposta calculada no servidor e preparar a rodada de pagamento Sandbox com evidências anteriores/posteriores. Não considerar o destaque na lista como comprovação de seleção, nem esta etapa como encerramento do gate de cartão, entrega, boleto ou débito.

**Evidências posteriores:** outra captura confirmou 12x selecionado e resumo de R$ 360,72. Em seguida, o usuário apresentou a confirmação do pedido **#4**, cartão de crédito em 12x, retirada no balcão, total R$ 360,72 e **pagamento em verificação**. A imagem da proposta intermediária não foi recebida. Ainda não foram conferidos ID interno do pedido, tentativa/cobranças, estado remoto do Asaas, reservas ou efeitos nos pontos. Não registrar aprovação financeira a partir dessa tela. Próximo passo: consultar `process-payments-once.ps1 -StatusOnly` e obter a identidade do #4 para correlacionar as evidências; os contadores globais também incluem o caso de revisão do #3 e não comprovam o estado individual do #4. Não repetir a compra.

**Diagnóstico recebido às 17:06 UTC de 13/10:** pedido #4 identificado como `ae14cb17-49fa-47ae-98eb-b48ef3f8ada1`, `PENDING`, versão 0; tentativa `41ede05c-40fd-4542-800c-311af6b25cb8`, `UNKNOWN`, `PAYMENT_RESULT_UNRESOLVED`, conta `sandbox-hml`, 12 parcelas, total financeiro R$ 360,72. Sem `PaymentCharge` ou fatos financeiros internos; pontos creditados/resgatados zero. Há 12 eventos `PAYMENT_CONFIRMED` associados ao pedido, com IDs de cobrança distintos, todos `READY`, e um `CHECKOUT_COMMITTED` também `READY`. O retorno inicial inconclusivo não comprova timeout nem recusa; cobranças internas vazias não provam ausência de cobrança remota. A tentativa do #4 explica `uncertain=1`, mas não está vencida (`countedAsOverdue=false`). A origem individual do `overdue=1` global ainda não foi consultada nesta rodada.

Próxima ação orientada: um único lote pelo script `scripts/homologation/process-payments-once.ps1` sem `-StatusOnly`, depois conferir resposta e repetir a leitura SQL do #4. O consumidor consulta o contrato remoto completo antes de aplicar evidências; não é necessário consumir 12 eventos individualmente para que a primeira consulta possa recuperar as parcelas. O lote também executa conciliação, expiração conforme configuração e outbox globais; um eventual `review` pode se referir ao caso anterior e precisa ser correlacionado. A operação antiga `REFUND/PENDING` não é elegível ao despacho que seleciona somente `READY` sem erro. Não reenviar compra ou solicitar nova operação financeira. Pagamento, total das parcelas, estoque, pontos e notificações seguem pendentes de comprovação posterior.

**Resultado após o lote, leitura de 17:12:54 UTC:** #4 `PAID`, versão 1, `paidAt=2026-10-13T17:11:24.278`; mesma tentativa `APPROVED`, versão 2, erro nulo, contrato `cb6d68ce-0b2a-4e10-ab36-8edc15cbdff4`. Foram registrados 12 IDs de cobrança distintos, ordinais 1–12, todos `CONFIRMED`, R$ 30,06 cada, soma R$ 360,72; 12 fatos `AUTHORIZED`, um por cobrança. Não há fatos `SETTLED` nesta evidência; não confundir aprovação com liquidação/disponibilidade para saque. O pedido registra 149 pontos creditados e zero resgatados. Um evento da inbox e `CHECKOUT_COMMITTED` concluídos; outros 11 eventos e `PAYMENT_CONFIRMATION_EMAIL` / `ORDER_STATUS_CHANGED` ainda `READY`. A recuperação de `UNKNOWN` para aprovado está evidenciada, mas o motivo do retorno inicial inconclusivo não foi determinado.

A consulta SQL do #4 foi ampliada, mantendo somente leitura, para trazer carteira, movimentos de pontos do pedido, histórico de status, itens, reservas e saldos de estoque. Usar a versão atualizada na próxima leitura após mais um lote; conferir que consumir novos eventos não altera novamente os 149 pontos, as 12 cobranças ou a versão do pedido. Estoque, unicidade dos lançamentos, conclusão das filas e recebimento de e-mail ainda pendentes. Nenhuma aprovação integral do gate de cartão ou de produção é declarada.

**Leitura de 13/10/2026 às 17:20:34 UTC, após o segundo lote:** #4 permanece `PAID`, versão 1, mesma data de pagamento; tentativa `APPROVED`, versão 3, erro nulo, sem incerteza ou prazo de revisão vencido. Permanecem 12 cobranças, soma R$ 360,72. Há um único movimento `EARN` de 149 pontos e uma única transição `PENDING → PAID`; carteira com saldo 286, pendente 0 e ganho histórico 785. Não há duplicação de crédito de pontos nesta leitura.

A reserva `d7741c55-d625-495c-a5b2-9c1547fbf80a` está `COMMITTED`, quantidade 6, correspondendo ao item Pequeno/Vermelho. Saldos atuais: produto 94 e variante 44, ambos com indisponível zero. Esses saldos servem de referência para conferir estabilidade nos próximos consumos; a leitura anterior ao pagamento não trouxe saldo da variante, portanto não demonstra isoladamente toda a sequência histórica de baixas.

Dois eventos da inbox estão concluídos e dez continuam `READY`. `CHECKOUT_COMMITTED` e `ORDER_STATUS_CHANGED` estão concluídos; `PAYMENT_CONFIRMATION_EMAIL` permanece `READY`, sem tentativa. O `review=1` do lote global não aparece como erro na tentativa do #4; sua origem individual não foi comprovada por esta consulta. Próxima ação: executar mais um lote pelo script existente, conferir seu retorno, repetir a leitura do #4 e verificar recebimento do e-mail. Não repetir a compra. Conclusão das filas, estabilidade dos efeitos após todos os eventos e demais cenários financeiros continuam pendentes.

**Leitura de 13/10/2026 às 18:20:17 UTC:** após novo lote, #4 continua `PAID`, versão 1, mesma data de pagamento, 12 cobranças somando R$ 360,72. Tentativa `APPROVED`, versão 4, erro nulo. Permanecem o mesmo movimento único de 149 pontos, carteira 286/0/785 e histórico único. Reserva de 6 unidades continua `COMMITTED`; estoques geral 94 e variante 44, inclusive versões de inventário 9 e 6, não mudaram em relação à leitura de 17:20. A repetição de consumo observada preservou esses efeitos.

As três tarefas da outbox do #4 estão `COMPLETED`, incluindo `PAYMENT_CONFIRMATION_EMAIL` com uma tentativa e sem erro. Isso comprova conclusão interna da tarefa; recebimento na caixa do destinatário ainda depende de confirmação do usuário. Inbox: 3 concluídos e 9 `READY`. O lote voltou a retornar uma conciliação em revisão, sem erro correspondente no #4. Antes de orientar novos lotes, consultar o diagnóstico somente leitura do #3 para verificar se a revisão corresponde ao estorno cancelado já conhecido; não atribuir o contador global a esse pedido sem a correlação. A fila do #4 e o gate financeiro completo permanecem abertos.

**Recebimento do e-mail confirmado pelo operador em 13/10:** a imagem mostra pedido #4, total R$ 360,72 e +149 pontos. Entretanto, informa PIX Dinâmico e Data de Liquidação, embora o caso seja cartão em 12x apenas confirmado. O recebimento está comprovado; o conteúdo apresentou defeito. A inspeção encontrou PIX fixo nas versões HTML/texto do template e ausência de método/parcelas nos parâmetros fornecidos pela outbox.

Correção local preparada em `payment-outbox.service.ts`, tipos e template de e-mail: repassar método, quantidade/valor das parcelas e juros persistidos; renderizar cartão, boleto e PIX conforme o pedido; informar Data da Confirmação e Total do pagamento. Não recalcular condições comerciais a partir da configuração atual. Método ausente/desconhecido aparece como Não informado, sem assumir PIX. O pedido parcelado passa a mostrar 12x de R$ 30,06 e juros de R$ 61,32. Os 14 testes unitários do e-mail passaram, incluindo regressão do #4, boleto, PIX, método desconhecido e cartão em 1x; TypeScript passou. A alteração ainda não foi publicada nem conferida em novo envio no Preview. E-mails já enviados e snapshots congelados não são reescritos ou reenviados automaticamente; a confirmação recebida do #4 permanece como evidência do defeito anterior.

**Publicação autorizada em 13/10:** pacote destinado à branch `homologacao_teste`, contendo correção e testes de e-mail, diagnóstico somente leitura do #4 e este registro de continuidade. ESLint direcionado também passou. Fetch anterior ao commit confirmou base local e remota iguais em `a6ab642`, sem divergência. Identificar a nova entrega pelo commit que contém este parágrafo e conferir o status Vercel desse SHA. Não há migration, alteração de ambiente ou reenvio de e-mail nesta publicação. Validar o conteúdo corrigido em um próximo envio de homologação após o deploy; os testes locais não substituem essa evidência.

**Correlação da revisão em 13/10 às 18:40:14 UTC:** diagnóstico do #3 confirma a tentativa esperada em `REFUND_PENDING`, versão 8, três conciliações, erro `PAYMENT_REFUND_CANCELLED_REVIEW`, atualizada às 18:17:49.180, compatível com a revisão do lote que consumiu o terceiro evento do #4 às 18:17. Mesma operação `REFUND/PENDING`, mesmo erro e data de submissão de 09/10; sem fato de devolução. Pedido permanece `PAID`, versão 1, 24 pontos e um movimento de fidelidade. A carteira 286/0/785 é compartilhada com o #4 e inclui seu crédito de 149; não representa um novo crédito pelo #3. A tarefa antiga `PAYMENT_REVIEW` continua `DEAD_LETTER`. Revisão permanece pendente de resolução operacional, sem encerramento artificial.

Na leitura, o #3 não estava elegível: próxima conciliação às 19:17:46.632 UTC, sem lease. O consumidor despacha somente operações `READY` sem erro; a operação `PENDING` observada não é reenviada por esse despacho. É possível continuar a inbox do #4 sem redefinir o #3. Próxima rodada orientada: até três execuções sequenciais do script existente, uma chamada por vez, interrompendo em erro, timeout, retry, revisão de inbox/outbox ou ausência de progresso na inbox; depois retornar os resumos e a leitura SQL do #4. Os nove eventos restantes eram o estado da leitura de 18:32:58, não uma contagem consultada novamente neste momento.

Publicação do e-mail confirmada: commit `bb3414f3b82bacca323b214b4623efd00231de6d` em `homologacao_teste`, status Vercel `success` / `Deployment has completed` às 18:37:19 UTC. O teste de conteúdo recebido após a correção continua pendente.

**Leitura do #4 de 13/10 às 18:57:28 UTC:** os três lotes informados concluíram um evento cada, sem retry ou review; a consulta confirma seis eventos `COMPLETED` e seis `READY`. Comparação dos campos completos com a leitura de 18:32:58: pedido, cobranças, fatos financeiros, carteira, movimentos de pontos, histórico, itens/estoque e outbox não mudaram. Mantidos `PAID` versão 1, 12 cobranças/R$ 360,72, 12 fatos `AUTHORIZED`, único crédito de 149 pontos, carteira 286/0/785, reserva `COMMITTED` de seis e estoque 94/44 com versões 9/6. Tentativa segue `APPROVED`, erro nulo, agora versão 7; o avanço de sua versão não duplicou os efeitos comerciais observados.

Próxima rodada: até seis execuções sequenciais do script de lote único, conferindo cada retorno e interrompendo em erro, timeout, retry, revisão de inbox/outbox ou ausência de conclusão na inbox. Depois obter os resumos, diagnóstico do #4 e status global somente leitura. Não executar chamadas adicionais para tentar zerar a revisão conhecida do #3. A conclusão dos seis eventos restantes e os demais cenários de homologação ainda não estão comprovados.

**Conclusão da inbox do #4, leitura de 13/10 às 19:37:31 UTC:** os seis lotes finais informados concluíram um evento cada, sem retry ou review. A consulta individual confirma todos os 12 eventos em `COMPLETED` e as três tarefas da outbox concluídas. Comparação integral com a leitura de 18:57:28: pedido, cobranças, fatos financeiros, carteira, movimentos de pontos, histórico, itens/estoque e outbox permanecem iguais. Pedido `PAID` versão 1; tentativa `APPROVED` versão 13, erro nulo, sem incerteza ou revisão vencida; 12 cobranças de R$ 30,06, soma R$ 360,72 e 12 fatos `AUTHORIZED`. Não há comprovação de liquidação (`SETTLED`) neste caso de cartão.

O consumo dos 12 eventos preservou um único crédito de 149 pontos, carteira 286/0/785, uma transição para pago e reserva de seis unidades `COMMITTED`, com estoque geral 94 e variante 44, versões 9/6. O recebimento do e-mail anterior já foi confirmado pelo operador. Esta etapa de aprovação em 12x e preservação dos efeitos após consumo está concluída no cenário observado; não é homologação integral do cartão ou autorização de produção. Permanecem a consulta global `-StatusOnly`, validação de conteúdo de um e-mail gerado após a correção, investigação do retorno inicial inconclusivo e os demais cenários/gates do plano, incluindo revisão do estorno do #3. Não orientar novos lotes para a inbox deste ensaio já concluída.

**Status global de 13/10 às 19:40:39 UTC recebido:** `SCOPE_VERIFIED`, conta `sandbox-hml`, `processingAttempted=false`. Inbox: 15 `COMPLETED`, sem entrada pendente e `oldestUnresolvedInboxAt=null`; outbox: 11 `COMPLETED` e 1 `DEAD_LETTER`; `uncertain=0`, `overdue=1`, `abandonedLeases=0`, `untrackedLegacyOrders=0`; operações: um `CANCEL/COMPLETED` e um `REFUND/PENDING`. Os contadores são compatíveis com o diagnóstico individual do #3 (estorno cancelado em revisão, prazo vencido e tarefa `PAYMENT_REVIEW/DEAD_LETTER`) e com o #4 aprovado sem pendências de inbox/outbox. A consulta global solicitada está concluída. Encerrar o ensaio específico de aprovação do #4 em 12x e consumo dos eventos com preservação dos efeitos; não declarar ambiente sem pendências nem encerrar homologação integral. Nenhum novo lote é necessário para esse ensaio. Permanecem a resolução auditada do #3, conteúdo do e-mail corrigido em novo envio e demais cenários/gates já registrados.

## 20. Próxima etapa — cartão 1x com resgate e entrega

Iniciada a preparação a pedido do usuário em 13/10. Reutilizar o encerramento do #4 e reunir três pendências da seção 5 em um caso: aprovação do crédito em 1x, resgate/ganho de pontos e entrega com cotação efetiva. O novo e-mail também verifica a correção publicada em `bb3414f`. Não assumir número/ID de pedido ainda não criado. Esta sequência não encerra devolução integral, boleto/débito, recusa, executor automático ou os demais gates.

Arquivos preparados: [roteiro](../../../../../../PACOTE_REVISAO_VANDERLEI/L-04-ROTEIRO_CARTAO_1X_PONTOS_ENTREGA.md) e [leitura inicial](../../../../../../PACOTE_REVISAO_VANDERLEI/L-04-PREPARAR_CARTAO_1X_PONTOS_ENTREGA.sql). Campos da consulta conferidos com `prisma/schema.prisma`; não executada pelo assistente no banco remoto. A leitura usa o comprador do #4 sem expor dados pessoais e retorna política de fidelidade, carteira, lotes, preço e estoque do produto/variante. `BASELINE_READ` não significa ambiente validado ou compra autorizada pelo servidor.

Operador: executar leitura e preparar proposta com uma unidade Pequeno/Vermelho, cartão 1x, resgate de 100 pontos e entrega oferecida ao destino escolhido. Retornar JSON e resumo da proposta antes da confirmação. Se preço/política permanecerem iguais, referência de mercadoria líquida R$ 44,90, acrescida do frete real, juros zero e ganho de 22 pontos. Não fabricar cotação ou alterar saldos para coincidir com a referência. A revisão da proposta é o próximo marco; pagamento e verificações posteriores serão vinculados ao ID efetivamente criado. Provedores/destinos não usados e expedição/rastreio continuam pendentes.

### 20.1 Bloqueio de cotação no Preview e apresentação do frete

Na tentativa de entrega, o operador recebeu HTTP 503 em `/api/freight/calculate` e confirmou o JSON com `code=FREIGHT_QUOTE_SECRET_MISSING`. O orquestrador chama `assertFreightSigningReady()` antes de consultar destino/tarifas; a causa deste retorno é a chave ausente ou menor que 32 caracteres no runtime. Não é evidência de CEP sem cobertura ou indisponibilidade das transportadoras. Não foi inspecionado nem alterado qualquer segredo remoto.

Regularização operacional: no projeto `continental-prototipo` da Vercel, configurar `FREIGHT_QUOTE_SECRET` como segredo privado aleatório com pelo menos 32 caracteres, no ambiente **Preview**, incluindo a branch `homologacao_teste`. Conferir se existe sobrescrita específica da branch; arquivos `.env` locais não configuram o deployment remoto. Fazer novo deployment dessa branch após salvar. Não copiar o valor ilustrativo de `.env.example`, não adicionar prefixo `NEXT_PUBLIC_` e não enviar o valor ao chat. Usar a mesma chave nas instâncias do mesmo ambiente. Alterações/rotação invalidam tokens antigos, exigindo nova cotação/proposta. Referência: [variáveis de ambiente da Vercel](https://vercel.com/docs/environment-variables), que só se aplicam a novos deployments.

A seleção de serviços já existe no checkout e é preenchida apenas após cotação válida. A implementação consulta Correios (PAC/SEDEX), matriz J&T e tabela local; cadastro sozinho não assegura elegibilidade ao destino/pacote. A oferta efetiva ainda precisa ser verificada após corrigir o segredo. Não adicionar serviços fictícios ou preços de contingência.

Correção local preparada em `CheckoutForm`: sem cotação válida, resumo mostra **A calcular/Calculando** e **Subtotal sem frete**, impede avanço da entrega e revisão/confirmação do pagamento, e orienta recotar. Cotação válida de valor zero continua gratuita; retirada continua gratuita e modalidade a combinar é identificada como tal. A seção **Modalidade de frete** explica onde os serviços aparecerão e os botões ocupam a largura disponível com estado selecionado acessível. Validação existente no servidor e assinatura obrigatória preservadas. `.env.example` recebeu orientação do Preview, sem segredo real.

Teste de navegador ajustado para exigir botão bloqueado e ausência de frete gratuito em falha, mantendo o caso de entrega com cotação persistida. A primeira execução ficou bloqueada porque Docker Desktop não iniciava; após reinício pelo operador em 13/10, Docker 28.5.1 respondeu e `node scripts/run-isolated-tests.mjs tests/integration/checkout-browser-state.test.ts` concluiu com **5 testes aprovados**, código de saída 0. O executor provisionou PostgreSQL descartável, aplicou 33 migrações e confirmou a identidade do servidor/banco antes da suíte. Os cenários validam falha sem frete gratuito/avanço, seleção e conclusão de entrega com cotação assinada persistida, além de recuperação do checkout, sincronização de carrinho e apresentação do PIX. Destino e disponibilidade do provedor usam fixtures controladas; isso não comprova cotação real das transportadoras. A confirmação no Preview e a publicação destas mudanças de interface permanecem pendentes. Retomar o ensaio 1x/pontos apenas após cotação válida e revisão da proposta.

Validação local: 43 testes unitários aprovados (`freight-contract`, `checkout-client-contracts`, `checkout-content-result`), incluindo chave ausente/curta em runtime de produção; `tsc --noEmit --incremental false` aprovado; ESLint dos três arquivos de código/testes alterados sem erros, com aviso preexistente de `<img>` no checkout. `git diff --check` sem erros. Esses testes não substituem a cotação real no Preview após configuração.

**Reteste após configuração/redeploy informados pelo operador:** a captura agora mostra `FREIGHT_OPTIONS_UNAVAILABLE`, substituindo `FREIGHT_QUOTE_SECRET_MISSING`. Na implementação atual, isso indica que a validação da chave passou e nenhum provedor retornou opção válida; não comprova que todas as transportadoras estejam fora do ar ou que o CEP não tenha cobertura. A interface publicada ainda mostra o falso gratuito; as alterações locais não foram publicadas. Subi-las corrige a apresentação, mas não assegura tarifa disponível.

Preparada a leitura `PACOTE_REVISAO_VANDERLEI/L-04-DIAGNOSTICAR_FRETE_HOMOLOGACAO.sql`, com campos conferidos no schema, ainda não executada no banco remoto. Inspeciona origem/Correios da loja, regras locais e cobertura/tarifas J&T para o CEP do ensaio, sem retornar credenciais. A matriz instalada exige origem `67140615`; não alterar a origem real para forçar elegibilidade. Regras locais precisam coincidir em UF, IBGE e nome normalizado. Se os dados estiverem adequados, correlacionar a requisição com os logs `[FREIGHT_PROVIDER_FAILURE]` na Vercel. Não enviar URLs de requisição dos Correios com credenciais. Próxima evidência: resultado da leitura; proposta 1x/pontos/entrega continua pendente de cotação válida.

**Diagnóstico recebido em 13/10 às 21:21:39 UTC (18:21:39 de Brasília):** uma loja `continental-homologacao`, origem nula, Correios desabilitados, contrato/senha ausentes, zero tarifas J&T, nenhuma faixa J&T correspondente ao destino do ensaio e zero regras locais. Esses dados explicam por que nenhum dos provedores de entrega retorna opção. O resultado não informa a contagem global das faixas geográficas J&T; informa ausência de faixa para o CEP consultado. Publicar o frontend não preenche esses cadastros.

Próximo passo: configurar a origem real em `/admin/settings` e preparar ao menos uma modalidade válida no ambiente efetivo. Correios exigem ativação/configuração e validação de cotação remota; J&T exige origem compatível e importação auditada das faixas/tarifas autorizadas; entrega própria utiliza `/admin/freight`, com município/UF/IBGE e valor aprovado pela loja. Não presumir frete zero. Documentos históricos citam 58 faixas/5.181 tarifas em outra leitura de base, mas não comprovam sua presença nesta homologação nem fornecem autorização para copiar outro banco inteiro. Nenhum cadastro ou importação foi alterado a partir dessa evidência; falta confirmar origem e fonte das tarifas antes de preparar carga. O ensaio 1x/pontos continua aguardando cotação válida.

### 20.2 Preparação da tabela J&T TF2026

O operador confirmou a origem **67140-615**, informou que a tabela está atualizada e autorizou utilizá-la enquanto solicita acesso de integração à J&T por meio do proprietário. Arquivo fornecido: `materiais/J&T/Tabela/TABELA_COMERCIAL_OFICIAL_TF2026.xlsx`, SHA-256 `0078cb605ad7ad785e4e7f829dffa5b2d8a43704dbb5cceafefe200825b329ed`. O operador confirmou que este é o único arquivo disponível. Não foi solicitada senha pessoal do proprietário; o acesso futuro deve utilizar credenciais de integração.

Inspeção das duas abas, textos e imagens incorporadas: a aba `PROPOSTA PADRÃO` contém 157 códigos GEOCOM, 33 faixas de peso de 0 a 30 kg, **5.181 preços base**, adicional por kg e generalidades comerciais. A outra aba contém imagem comercial, sem tabela de abrangência. As 157 colunas de preço não equivalem às 58 faixas geográficas mencionadas em registros históricos; não inferir a correspondência.

Preparação executada com `python scripts/prepare-jt-tariffs.py "materiais/J&T/Tabela/TABELA_COMERCIAL_OFICIAL_TF2026.xlsx" "materiais/J&T/Tabela/preparado"`. Saídas: `tarifas-revisao.csv` e `auditoria.json` nessa pasta. O CSV preserva valores originais, preços arredondados com `ROUND_HALF_UP` a duas casas, intervalos de peso a três casas, região e células de origem. O script verifica estrutura, códigos únicos, continuidade dos intervalos e preços positivos; não acessa banco nem avalia fórmulas sem valor armazenado. Auditoria marca explicitamente `readyForCheckout=false` e `databaseChanged=false`. Nenhum arquivo comercial foi publicado ou enviado ao GitHub.

Pendências para ativação: relação CEP → GEOCOM, prazos/regras de contagem, classificação de zonas de risco e confirmação de como ICMS compõe o preço contratado. A planilha menciona ICMS, mas não fornece uma regra operacional suficiente para implementá-lo. Não presumir que Ananindeua pertence a `PA-CAP`, nem criar abrangência genérica por UF, prazo padrão ou tarifa final de R$ 12,00. A tarifa base não comprova o preço final.

Diferenças para revisar no motor antes da ativação: a planilha determina **167 kg/m³**, enquanto o provedor usa volume em cm³ dividido por 6000 (166,666... kg/m³); prevê maior lado de 120 cm e soma de dimensões de 240 cm; pesos cubados entre intervalos não podem cair no fallback atual que busca a última faixa. A classificação de risco e os prazos precisam de fonte verificável. Nenhuma dessas lacunas foi contornada nesta preparação.

Validação da preparação: `python -B tests/unit/test_prepare_jt_tariffs.py` — **4 testes aprovados**, incluindo contagem e valores de células da planilha, precisão/arredondamento, reprodução dos artefatos e rejeição de estrutura alterada. Os três testes que dependem do arquivo comercial são explicitamente ignorados quando ele não está disponível. Próxima ação externa necessária: obter a abrangência, prazos, zonas de risco e definição de encargos com o proprietário/J&T, ou uma exportação identificada e validada desses dados já existentes no banco anterior. A carga/ativação em homologação permanece pendente desses dados; o frete ainda não está liberado.

### 20.3 Consulta autorizada ao banco principal — somente leitura

Em 13/10 o operador autorizou consultar o banco do projeto principal/main e proibiu qualquer alteração nessa branch ou banco. Conexão original disponível localmente consultada com cliente Prisma independente, sem executar serviços/migrations/seeds. Ambas as transações aplicaram `SET TRANSACTION READ ONLY`, verificaram `transaction_read_only=on` e limitaram o tempo de consulta. Exportação usou isolamento `REPEATABLE READ`. Credenciais ficaram somente em memória e não foram incluídas nas saídas. A branch de trabalho permaneceu `homologacao_teste`; `origin/main` foi apenas lida por `git show`.

Origem identificada: loja `continental-prototipo`, ID `536bfa58-0531-49e8-9209-3a046281e516`, CEP `67140615`, Correios habilitados. Encontradas **58 faixas geográficas e 5.181 tarifas**. Comparação por GEOCOM e limites de peso: todas as 5.181 tarifas coincidem com os preços base e adicionais da planilha após arredondamento para a precisão monetária do banco; zero diferenças, zero registros extras e zero chaves duplicadas. Todas as faixas geográficas apontam para códigos com tarifas e não há sobreposição entre intervalos de CEP.

Para o destino do ensaio `67140180`, há uma correspondência: intervalo `66000000–67999999`, `PA-CAP`, `deliveryDays=2`, `isRiskZone=false`. Isso recupera o vínculo CEP/GEOCOM e o prazo **cadastrados na base anterior**. A existência desses dados não comprova sua validação atual pela transportadora. Todas as 58 faixas têm `isRiskZone=false`; a revisão dessa classificação continua pendente. O código consultado em `origin/main` aplica Ad-Valorem/GRIS, mas não contém tratamento explícito de ICMS, portanto essa confirmação comercial continua pendente, assim como as diferenças de cubagem já registradas.

Exportações locais em `materiais/J&T/Tabela/preparado/`: `banco-origem-jt-somente-leitura.json` (campos autorizados de logística e identidade da captura), `abrangencia-banco-origem-revisao.csv` (58 faixas) e `comparacao-banco-planilha.json` (resultado da comparação). O snapshot tem SHA-256 `92dfdd216d47d950d526168b62db4834502a965ef3b8c30bbaf838ce1f08e6b5`. Não foram exportados clientes, pedidos, senhas ou contratos dos Correios. Nenhum dado foi alterado no banco principal ou importado em homologação.

A ausência da abrangência na planilha deixa de impedir sua preparação: a configuração anterior foi recuperada e está disponível para uma carga controlada em homologação. Essa futura carga deve validar a identidade `continental-homologacao`, preservar a origem principal e respeitar os triggers `freight_jt_rate_revision`, `freight_jt_geography_revision` e `freight_settings_revision` que invalidam cotações antigas. Não considerar esta consulta como ativação remota ou homologação comercial completa da J&T.

### 20.4 Importação J&T em homologação e cotação no Preview

Importação solicitada expressamente pelo operador e concluída em **13/10/2026, 22:11:48 UTC (19:11:48 de Brasília)**. Destino confirmado por endpoint distinto do principal, única loja `continental-homologacao` com ID `3a82b33c-3646-4272-9a89-80bb1ba327a5`, contas de pagamento existentes restritas a `sandbox-hml`, tabelas J&T inicialmente vazias e triggers de revisão ativos. O banco principal e a branch main não receberam alterações.

`scripts/import-jt-homologation.mjs` usa somente `HML_DIRECT_URL` fornecida em memória, rejeita outros hosts/parâmetros de conexão, verifica o SHA-256 do snapshot autorizado e executa leitura por padrão. Com `--apply`, usa transação serializável, bloqueia a revisão antes das tabelas, exige destino vazio na primeira carga, salva backup antes da primeira escrita e compara todos os campos importados antes do commit. Uma chave única de auditoria evita reaplicação; diferenças posteriores abortam com `IMPORTED_DATA_DRIFT`. Não carrega `.env` da aplicação, não executa migrações no destino e não copia contratos ou senhas dos Correios.

Resultado: **5.181 tarifas e 58 faixas de CEP** importadas; origem configurada como `67140615`, confirmada pelo operador. Revisão tarifária passou de 0 para **12** (11 lotes de tarifas e 1 de geografia); versão da configuração da loja passou de 3 para **4**, pelos triggers existentes. `additionalDays=0` e Correios desabilitados foram preservados. Criado um registro `AuditLog` de ação `JT_TARIFF_IMPORT`, com proveniência e limitações comerciais. Uma nova leitura independente após o commit retornou `ALREADY_IMPORTED`, sem escrita, conferindo novamente a igualdade de todos os registros.

Validação anterior à carga: `node scripts/verify-jt-import.mjs` aprovado em PostgreSQL descartável com as migrações reais. Conferiu rejeição do endpoint principal e parâmetros alternativos, prévia somente leitura, rollback de todos os lotes após falha proposital no último lote, importação integral, atualização de revisões, auditoria única, reaplicação sem mudança, rejeição de divergência e de loja incorreta. O container de teste foi descartado. Os dois scripts passaram em `node --check`.

**Cotação efetiva na Vercel em 22:12:19 UTC:** POST no Preview de `homologacao_teste`, `/api/freight/calculate`, destino `67140180`, uma unidade do produto/variante do ensaio. Resposta **HTTP 200, `success=true`**, mercadorias **R$ 49,90**, pacote **300 g, 16 × 11 × 4 cm**, opção **J&T Express Standard / JT_STANDARD**, frete **R$ 12,30**, prazo informado **2 dias**, cotação persistida e token assinado presente. Cotação de diagnóstico `0f321319-1045-4edf-a027-86ce2a2a6f96`, expiração em 22:42:16 UTC; não reutilizá-la na sessão do comprador. Nenhum pedido ou pagamento foi criado pelo diagnóstico. Esta cotação comprova que o Preview utiliza os dados importados; não foi necessário publicar código ou fazer novo deploy para essa ativação de dados.

Evidências locais, sem credenciais ou token de cotação: `materiais/J&T/Tabela/preparado/backup-hml-jt-*.json`, `resultado-importacao-hml-*.json` e `cotacao-hml-apos-importacao.json`. A planilha comercial e as exportações continuam locais, sem publicação no GitHub. As alterações anteriores da interface de frete permanecem locais e precisam de publicação própria; o sucesso da cotação não comprova sua publicação.

**Próxima etapa liberada: ensaio controlado de cartão 1x + 100 pontos + entrega pela J&T**, conforme o roteiro L-04. Atualizar a página, recalcular na sessão do comprador, selecionar o serviço e conferir a proposta antes de concluir. Se preço/política/cotação permanecerem iguais, referência do total: **R$ 57,20 = 49,90 − 5,00 + 12,30**. A homologação completa continua aberta: Correios/SEDEX ainda não configurados neste destino; classificação de risco, ICMS, limites dimensionais e diferença de cubagem/faixas da J&T permanecem pendentes antes de produção. Não houve correção dessas regras comerciais nesta importação.


### 20.5 Pedido #5 — cartão 1x, 100 pontos e entrega J&T

**Fechamento do cenário observado em 14/10/2026:** o operador confirmou o recebimento do e-mail e apresentou imagem do pedido #5. Conteúdo conferido: Cartão de Crédito, **1x de R$ 57,20**, juros **R$ 0,00**, **Data da Confirmação: 14/10/2026, 10:45**, **J&T Express Standard**, estimativa de **2 dias úteis**, uma unidade Pequeno/Vermelho a R$ 49,90 e ganho de **22 pontos**. A mensagem informa aprovação e total do pagamento, sem assumir PIX ou liquidação financeira. Esta evidência valida o novo envio com a correção do template publicada em `bb3414f`; o e-mail antigo do #4 permanece como registro do defeito anterior.

Com as leituras posteriores ao processamento já registradas abaixo, ficam comprovados neste ensaio: aprovação em 1x, resgate/ganho únicos, carteira e lotes em 208, estoque 93/43 com reserva correta, cotação J&T vinculada, filas concluídas e recebimento/conteúdo do e-mail. **Cenário de compra #5 concluído no recorte testado**, sem necessidade de novas rodadas para suas filas. A imagem não discrimina frete de R$ 12,30 nem desconto de R$ 5,00 em linhas próprias; não confundir o total correto com comprovação dessa apresentação detalhada. A composição foi validada na proposta e no banco.

Próxima etapa a preparar segundo a seção 5: devolução integral controlada de cartão, com identificação do caso e verificação de elegibilidade/ausência de operação em curso antes de solicitar qualquer estorno. Nenhuma devolução foi solicitada neste fechamento. Postagem/rastreio e entrega física, endereço de cobrança distinto, demais provedores, confirmação comercial das tarifas, PIX/devolução, boleto/débito, recusa/análise e executor automático continuam nos gates correspondentes. Não há liberação de produção decorrente deste fechamento.

Em 14/10/2026 o operador retomou o ensaio, conferiu a proposta de R$ 57,20 e confirmou uma vez. A tela retornou pagamento confirmado para o pedido #5. Identidade obtida no banco efetivo de homologa??o: pedido `bb3f722b-8392-4a23-863b-d2d428444faa`, loja `3a82b33c-3646-4272-9a89-80bb1ba327a5`. Duas consultas em transa??o READ ONLY/REPEATABLE READ, ?s 13:46:43 e 13:47:35 UTC (10:46:43 e 10:47:35 de Bras?lia), confirmaram:

- Pedido PAID, vers?o 1, CREDIT_CARD/DELIVERY, 1 parcela de R$ 57,20, encargos zero. Mercadorias R$ 49,90, desconto R$ 5,00 e frete R$ 12,30.
- Uma tentativa APPROVED em sandbox-hml, sem failureCode, sem incerteza ou revis?o vencida; uma cobran?a de R$ 57,20, estado registrado CONFIRMED. Um fato AUTHORIZED; settledAt nulo, portanto esta leitura confirma aprova??o registrada, n?o liquida??o financeira. N?o houve consulta remota ao Asaas nesta etapa.
- Um REDEEM de 100 pontos (saldo 186) e um EARN de 22 (saldo 208). Carteira 208 dispon?veis, zero pendentes, zero d?vida, lifetimeEarn 807 e accountingReady=true. Aloca??es de 12 + 24 + 64 = 100 pontos; um lote de ganho de 22; soma restante dos lotes 208, igual ? carteira.
- Uma reserva COMMITTED de uma unidade, vinculada corretamente ao item Pequeno/Vermelho. Estoques produto 93 e variante 43, indispon?veis zero; vers?es 10 e 7. Valores compat?veis com as refer?ncias anteriores de 94/44; n?o houve nova coleta de baseline imediatamente antes da compra.
- Cota??o persistida vinculada ao pedido: JT_EXPRESS/JT_STANDARD, R$ 12,30 e prazo informado de 2 dias, com matchesOrder=true. Um ?nico hist?rico PENDING ? PAID.

Ainda pendentes na ?ltima leitura: um PAYMENT_CONFIRMED na inbox em READY e tr?s comandos da outbox em READY, todos sem tentativas/erro: CHECKOUT_COMMITTED, ORDER_STATUS_CHANGED e PAYMENT_CONFIRMATION_EMAIL. N?o foram processadas filas nem enviado e-mail por este diagn?stico. A aprova??o inicial est? consistente, mas idempot?ncia ap?s consumir o evento e conclus?o do envio de e-mail ainda precisam ser comprovadas.

Preparado e executado com sucesso o SQL somente leitura `PACOTE_REVISAO_VANDERLEI/L-04-DIAGNOSTICAR_CARTAO_1X_PONTOS_ENTREGA_PEDIDO_5.sql`, fixado por loja, n?mero e ID; inclui aloca??es/lotes e correspond?ncia da cota??o. Pr?ximo passo: uma rodada pelo executor de homologa??o existente, conferir retorno e repetir este diagn?stico do #5. O executor ? global e pode tamb?m observar a pend?ncia hist?rica do #3; n?o manipular sua tentativa/estorno. Confirmar recebimento/conte?do do e-mail com o operador. N?o repetir a compra nem declarar encerrados os gates de entrega, devolu??o ou produ??o.


**Atualiza??o do #5 em 14/10/2026, 13:59:15 UTC (10:59:15 de Bras?lia):** ap?s os retornos do operador (401 no scope_check sem POST, posterior SCOPE_VERIFIED e lote com reconciliation.completed=1/outbox.completed=1), nova consulta READ ONLY ao banco efetivo mostra PAYMENT_CONFIRMED COMPLETED, uma tentativa; CHECKOUT_COMMITTED e ORDER_STATUS_CHANGED COMPLETED, uma tentativa cada, sem erros. PAYMENT_CONFIRMATION_EMAIL continua READY, zero tentativas. O lote enviado tem inbox.claimed=0; os contadores globais n?o permitem atribuir todas as mudan?as ?quela ?nica execu??o. O evento j? consta conclu?do no banco ?s 13:51:33 UTC.

Pedido mant?m PAID/vers?o 1, uma cobran?a CONFIRMED de R$ 57,20 e um fato AUTHORIZED, sem liquida??o registrada. Tentativa APPROVED/vers?o 2, failureCode nulo. Mesmos IDs do REDEEM -100, EARN +22, lote de ganho e tr?s aloca??es que somam 100; carteira e soma restante dos lotes permanecem 208, sem d?vida/pend?ncias. Mesma reserva COMMITTED de uma unidade, estoques 93/43 e vers?es 10/7. Frete R$ 12,30, JT_STANDARD, prazo 2 dias e matchesOrder=true. O consumo do evento preservou os efeitos observados sem duplica??o. Pr?ximo passo: uma rodada adicional pelo executor existente e nova leitura para verificar a tarefa de e-mail; recebimento/conte?do ainda dependem da confirma??o do operador. Nenhum processamento remoto foi disparado por esta consulta.


**Conclus?o das filas do #5 em 14/10/2026, leitura ?s 14:01:47 UTC (11:01:47 de Bras?lia):** ap?s o lote informado com outbox.claimed=1/completed=1 e demais consumidores sem itens, a consulta READ ONLY confirma PAYMENT_CONFIRMATION_EMAIL COMPLETED, uma tentativa, lastErrorCode nulo. As tr?s tarefas da outbox do #5 e seu evento PAYMENT_CONFIRMED est?o COMPLETED. Mantidos pedido PAID/vers?o 1, tentativa APPROVED/vers?o 2, cobran?a ?nica de R$ 57,20, resgate ?nico de 100, ganho ?nico de 22, carteira e lotes 208, reserva COMMITTED, estoques 93/43 e vers?es 10/7. Sem novos efeitos ou duplica??o em rela??o ?s leituras anteriores. N?o h? necessidade de novas rodadas para concluir as filas atualmente vinculadas ao #5. O estado COMPLETED da tarefa de e-mail comprova conclus?o do processamento registrado; recebimento na caixa do operador e conte?do ainda precisam ser conferidos. Ensaio de compra 1x/pontos/frete tecnicamente consistente neste recorte; entrega f?sica, estorno, demais cen?rios e gates de produ??o continuam separados.


## 21. Resposta dos campos de cartão durante atualização do carrinho

Em 14/10/2026, após encerrar o ensaio do pedido #5, o operador pediu corrigir a demora percebida no primeiro clique dos campos do cartão. Causa reproduzida: ao retornar à janela/aba, CartProvider consulta o carrinho; isLoading/loadState tornam sourcePending verdadeiro e CheckoutForm desabilitava todo o fieldset durante a resposta HTTP. O atraso dependia da rede, sem temporizador específico de um segundo nos campos.

Correção local em app/checkout/page.tsx e components/checkout/CheckoutForm.tsx: distinguir atualização pendente de fonte indisponível. A consulta em segundo plano permite foco e digitação; falha de carregamento, ausência/divergência de identidade e envio efetivo continuam bloqueando a edição. Revisar/confirmar e o handler de submissão continuam bloqueados enquanto sourcePending ou sourceUnavailable; nenhuma validação financeira, de sessão ou de estoque foi removida. Dados do cartão permanecem apenas no estado transitório existente, sem nova persistência.

Regressão em tests/integration/checkout-browser-state.test.ts: resposta de GET /api/cart retida, evento de foco e clique real via protocolo do navegador nos quatro campos, seguido de digitação. Confere campos habilitados, foco no primeiro clique, valores preservados após a resposta e botão de revisão bloqueado até a atualização terminar. Antes da correção, falhou por campo desabilitado; depois, passou. Ajustada a espera do teste antigo de recuperação para aguardar o término da consulta, pois campo editável não representa mais consulta concluída.

Validação final: 6 testes de navegador aprovados em Next/Chrome e PostgreSQL descartável (33 migrações); 48 testes unitários de cart-client-state, checkout-client-contracts e checkout-content-result aprovados; TypeScript sem erros; ESLint direcionado sem erros, com aviso preexistente de img; git diff --check aprovado. Os bancos principal/homologação não foram usados para estes testes. A reprodução comprova este bloqueio na retomada de foco; não constitui garantia de latência zero em todo dispositivo ou durante a carga inicial da página.

Status: correção local pronta, ainda sem commit/push/deploy nesta etapa. O Preview precisa receber esta versão antes do reteste pelo operador. Mantidas as alterações locais anteriores de apresentação do frete.

**Publicações posteriores autorizadas:** correção de foco publicada em `d0717ba`; tradução do carrinho e preços em reais publicada em `83c8c00`, ambas em homologacao_teste com conclusão de deploy confirmada pela Vercel. A versão integrada de foco passou em 66 testes unitários, seis de navegador e build isolado; a tradução passou nos três testes existentes do carrinho. Esses resultados não representam aprovação da CI completa nem encerramento da homologação financeira.

## 22. Preparação do estorno integral no cartão — pedido #5

**Encerramento do ensaio em 14/10/2026, 13:11 de Brasília:** estorno integral do cartão 1x do #5 aprovado no recorte de pontos/frete e produto não enviado. Correção de histórico remoto vazio publicada em homologacao_teste, commit 9d07510, deploy Vercel concluído. Solicitação única pelo operador criou REFUND 79a50d2d-6ff7-4e32-929f-05d677d645eb. Os dois primeiros lotes conciliavam #3 e #4; o terceiro concluiu o #5. Consulta ao Sandbox confirmou cobrança REFUNDED e histórico completo com DONE R$ 57,20. Banco confirmou operação COMPLETED, fato REFUNDED único, pedido CANCELLED v2, reserva RETURNED v2, estoques 94/44, movimentos únicos REFUND_EARN -22 e REFUND_REDEEM +100, saldo/lotes 286, dívida/pendente zero e lifetimeEarn 785. O quarto lote consumiu PAYMENT_REFUNDED; leitura READ ONLY às 16:11:06 UTC comprovou mesmos registros, versões e saldos, sem compensação duplicada. Ambos os eventos e quatro tarefas da outbox do #5 COMPLETED. Roteiro específico contém IDs, datas e evidências locais. Não são necessárias novas rodadas para esse caso. Não encerra PIX/#3, cartão parcelado, retorno físico de mercadoria enviada nem demais gates de produção. Preparação original abaixo preservada como histórico.

Em 14/10/2026, retomado o ensaio financeiro a pedido do operador. Ele confirmou que o produto do #5 permanece na loja, sem envio físico. [Roteiro específico](../../../../../../PACOTE_REVISAO_VANDERLEI/L-04-ROTEIRO_ESTORNO_INTEGRAL_CARTAO_PEDIDO_5.md), SQL antes/depois e comando de solicitação preparados. Nenhum REFUND ou processamento enviado nesta preparação.

Consulta direta ao banco de homologação, com host fixado e transação REPEATABLE READ/READ ONLY, às 14:42:33 UTC: pedido `bb3f722b-8392-4a23-863b-d2d428444faa` PAID v1, cartão 1x R$ 57,20, tentativa APPROVED, cobrança CONFIRMED, nenhuma operação financeira e nenhum fato REFUNDED. Carteira 208, lotes 208, pendente/dívida zero, lifetimeEarn 807; movimentos originais REDEEM -100 e EARN +22. Reserva de uma unidade COMMITTED v1, estoques produto/variante 93/43. Evidência sanitizada salva localmente em materiais/homologacao/pedido-5-antes-estorno-cartao.json.

O teste devolverá a cobrança integral, incluindo frete, e restituirá o desconto como pontos. Após prova remota definitiva e aplicação local, espera-se pedido CANCELLED v2, tentativa REFUNDED, operação COMPLETED, fato REFUNDED de R$ 57,20, REFUND_EARN -22 e REFUND_REDEEM +100 únicos, reserva RETURNED v2. Sem outras movimentações, saldo/lotes 286, lifetimeEarn 785 e estoques 94/44. Não inferir conclusão a partir de HTTP 202 ou aceitação da solicitação.

SQL executado com sucesso somente para leitura; sintaxe do script validada e nove verificações isoladas de guardas/respostas passaram sem rede. Próxima ação: conferir cobrança e ausência de estorno em curso no painel Sandbox antes da solicitação única pela aplicação. Pedido #3 permanece preservado em revisão. Este ensaio não comprova estorno parcelado, PIX ou retorno físico de produto já enviado.

## 23. Consolidação das entregas de Leno e Vanderlei — 14/10/2026

Atualização solicitada pelo operador após revisão da branch remota `homologacao_teste`, do código e das evidências. Este quadro reúne o estado mais recente; as sequências anteriores permanecem como histórico. “Concluído no cenário” significa somente o caso identificado, “implementado/testado” não substitui aceite externo e “preparado” não significa implantado. Não houve nova execução de testes, operação financeira ou alteração de banco nesta atualização documental.

### 23.1 Revisão publicada e verificações remotas

- **Base atual conferida:** `9d07510795f88420db1f654e4f6f07f590c8ecfd`, presente no remoto de homologação após fetch.
- **Vanderlei:** pacote `6f4fa75a01bc79db577ee4886a0ebd568a5f4bac`, autoria Git `ZapCannonEd`, de 14/10, já integrado à base atual. [CI desse commit concluída com sucesso](https://github.com/ViniMoia/Sistema-E-Commerce/actions/runs/38559641363).
- **Candidato atual:** [CI de `9d07510` concluída com sucesso](https://github.com/ViniMoia/Sistema-E-Commerce/actions/runs/38594348446). Conferidas as etapas de tipos, lint, unitários, consumidor/manifestos, migrations, isolamento negativo, integração, build com duas instâncias, standalone, capacidade e container Linux. Nenhuma dessas etapas estava omitida ou marcada como falha na consulta.
- O GitHub registrou status **Vercel `success`** para as duas revisões. Isso comprova a conclusão reportada do deployment, sem substituir ensaio funcional de todos os fluxos ou implantação no Google Cloud.
- O documento de preparação de Vanderlei registrava **726 testes unitários e 15 operacionais aprovados** após integrar `bb3414f`. São resultados históricos documentados, não uma nova execução nesta revisão; não somar contagens de suítes sobrepostas.

Portanto, estão superadas as pendências históricas de publicação do pacote de Vanderlei, disparo da CI em `homologacao_teste`, aprovação dessa CI e recebimento de seu parecer técnico. Permanecem o aceite recíproco final e a validação da configuração de produção.

### 23.2 Leno — entregas e cenários concluídos

| Frente | Entrega comprovada até esta atualização | Limite / trabalho restante |
|---|---|---|
| **L-00 — Base compartilhada** | Pacote de revisão, contratos de ambiente Sandbox/produção, scripts e documentação entregues; Vanderlei utilizou a base nos testes. Publicação de passagem em `d66a416`. | Confirmar configuração e acessos do destino final, incluindo rotações necessárias. |
| **L-01 — Recuperação financeira** | Tratamento de respostas inconclusivas e conciliação com efeitos únicos implementado/testado; #4 recuperado de `UNKNOWN` para `APPROVED`. Correção do histórico remoto explicitamente vazio do Asaas publicada em `9d07510`. | Demais falhas/retomadas e critérios de recuperação no executor final continuam exigidos. |
| **L-02/L-03 — Dados e migrations** | Base de migrations exercitada nas regressões integradas; consulta da logística da origem somente leitura, comparação com a planilha e carga auditada J&T concluídas em homologação. | Isso não prepara o banco de produção: faltam destino, inventário/carga de abertura e backup/restore ensaiados nele. |
| **L-04 — Crédito parcelado #4** | Aprovação em **12x de R$ 30,06, total R$ 360,72**; 12 cobranças e 12 fatos `AUTHORIZED`; 12 eventos e três tarefas concluídos; crédito único de 149 pontos e efeitos estáveis após consumo. Seção 19. | Não comprova liquidação, estorno das 12 parcelas ou todos os cenários de crédito. |
| **L-04 — Crédito 1x #5** | Compra de **R$ 57,20 = R$ 49,90 − R$ 5,00 + R$ 12,30**, resgate de 100 pontos, ganho de 22, entrega J&T e filas concluídas. Seção 20.5. | Entrega física/rastreio e demais meios/cenários não são encerrados por essa compra. |
| **L-04/L-05 — Estorno integral #5** | Asaas `REFUNDED`, histórico `DONE` de R$ 57,20; operação/fato únicos; pedido `CANCELLED` v2; reserva `RETURNED` v2; estoques 94/44; compensações únicas −22/+100; carteira/lotes 286. Consumo posterior do webhook preservou efeitos. Seção 22. | Cenário concluído para cartão 1x e produto **não enviado**. Não encerra PIX/#3, estorno parcelado nem retorno de produto entregue. |
| **L-05 — Fidelidade** | Resgate/ganho e sua compensação integral comprovados no #5, com alocações/lotes, saldo e ausência de duplicidade conferidos. | Políticas comerciais, expiração, déficit e devoluções em outros cenários continuam exigindo aceite. |
| **L-06 — Estoque e checkout** | Ajuste geral/por variante preservando IDs publicado em `a6ab642`; regressões de Admin/integridade executadas por Vanderlei. Foco imediato dos campos durante atualização do carrinho corrigido em `d0717ba`, com regressão de navegador; tradução do carrinho em `83c8c00`. | Não garante latência zero em qualquer dispositivo; permanecem aceite do inventário de abertura e validações integradas no destino final. |
| **L-07 — Consumidor/outbox** | APIs duráveis integradas ao acionador de Vanderlei; lotes controlados concluíram eventos e tarefas dos #4/#5. E-mail corrigido em `bb3414f`, com recebimento e conteúdo correto comprovados no #5. | Rodadas manuais não comprovam execução automática permanente; cadência, retomada, alertas e contenção de novas compras continuam abertos. |
| **L-08/L-09 — Aceite e implantação** | Evidências por cenário e parecer independente de Vanderlei disponíveis para consolidação. | Aceite financeiro/dados final, procedimentos de abertura e acompanhamento após implantação **não concluídos**. |

**Frete J&T, entrega operacional de Leno:** importadas **5.181 tarifas e 58 faixas de CEP**, origem `67140615`; cotação efetiva do Preview de R$ 12,30 vinculada ao #5. Banco e branch principal preservados. A configuração usa a tabela fornecida e a abrangência recuperada da origem, sem API J&T. ICMS, cubagem, limites e zonas de risco ainda dependem de confirmação comercial; Correios/SEDEX permanecem sem configuração neste destino. Planilha/exportações e artefatos locais não devem ser considerados publicados apenas porque a importação foi concluída.

### 23.3 Vanderlei — entregas publicadas

| Frente | Entrega comprovada em `6f4fa75` | Limite / trabalho restante |
|---|---|---|
| **V-00 — Ambiente** | Docker Linux, Node 22, PostgreSQL descartável, sentinelas/provas negativas e correções de conexões do harness. | Entrega de testes concluída; configuração do destino permanece separada. |
| **V-01 — Home** | Conteúdo/botões independentes da reprodução do vídeo, movimento reduzido, retirada da opacidade inicial e navegação por teclado; medições desktop/mobile emulado. | Medir rede, dispositivos e primeira carga no ambiente final. |
| **V-02 — Navegador** | Navegação carrinho → checkout corrigida; regressões de abas, reload, identidade, armazenamento indisponível, respostas atrasadas e confirmação/QR. | Integração de débito após contrato de Leno e homologação completa dos meios obrigatórios. |
| **V-03 — Segurança** | Validação estrita de Host, restrição do fallback Vercel ao Preview, redação de segredos/cartão nos logs e restrição de buckets/erros de upload; regressões de tenant, ownership, sessão, reset e Admin. | Domínio/proxy/cookies, reset real, recuperação administrativa, IAM/MFA e rotações no destino. |
| **V-04 — Frete** | Rejeição de lacunas/valores inválidos da J&T; leitura estrita de preço/prazo/erro dos Correios; testes de validade, assinatura e consistência entre instâncias. | Contratos/cobertura/expedição reais; implementação existente dos Correios não comprova CWS/Mini Envios. |
| **V-05 — Operação comercial** | Regressões de catálogo, Admin, expedição, rastreio, retirada e métricas; testes de estoque de Leno incorporados e aprovados. | Aceite comercial com catálogo/carga aprovados e fatos financeiros do candidato. |
| **V-06 — Cloud Run** | Dockerfile standalone Node 22, Linux sem root, duas instâncias, assets/reinício e configuração declarativa testados. | Projeto, região, domínio, IAM, billing, banco e secrets finais; provisionamento/ensaio real não comprovados. |
| **V-07 — Executor** | Acionador, Jobs/Scheduler, autenticação, limites/logs e modelos de heartbeat/alertas preparados e testados. | Ativar recorrência, provar recuperação/alertas recebidos, validar e-mail/Storage e medir cadência/conexões/custo Neon. |
| **V-08 — CI e candidato** | Workflow de homologação publicado e **CI remota aprovada**; integração, migrations, standalone, capacidade e container exercitados; parecer técnico sobre Leno entregue. | Identificar artefato/configuração finais, medir capacidade no destino e concluir revisão recíproca/aceite L-08. |
| **V-09 — Produção** | Roteiro de deploy, contenção e recuperação disponível. | Implantação final e observação conjunta **não comprovadas**; procedimento preparado não encerra o gate. |

Fontes do pacote: [quadro de tarefas](../../../../../../trabalho_em_dupla/TAREFAS_E_STATUS_DOS_DESENVOLVEDORES.md), [fechamento local](../../../../../../trabalho_em_dupla/FECHAMENTO_LOCAL_VANDERLEI.md), [validação anterior à publicação](../../../../../../trabalho_em_dupla/VALIDACAO_PARA_PUBLICACAO_2026-10-14.md), [parecer sobre Leno](../../../../../../trabalho_em_dupla/evidencias/V-REVISAO-LENO.md) e [procedimento Cloud Run](../../../../../../infra/cloudrun/README.md). As ressalvas desses registros sobre publicação/CI foram superadas pela consulta remota da seção 23.1; suas limitações de ambiente permanecem válidas.

### 23.4 Pendências conjuntas e próxima sequência

1. **Leno, G1/G3/G4:** concluir métodos/cenários obrigatórios restantes, incluindo boleto e implementação/homologação de débito, recusa/expiração/pagamento tardio conforme método e estorno parcelado. Resolver o #3 por revisão auditada; seu estorno cancelado não foi resolvido pelo sucesso do #5. Completar procedimentos de devolução física e aceites de fidelidade.
2. **Leno, com revisão de Vanderlei, G2:** definir banco separado de produção, inventário e carga de abertura aprovados; ensaiar backup/restore e migrações no destino. Não promover dados de testes a obrigações reais.
3. **Vanderlei, com revisão de Leno, G5/G6:** configurar o destino real e ativar execução automática; validar domínio/acessos, secrets, e-mail/Storage, recuperação, alertas recebidos e custo/capacidade. O escopo de conta informado pelo status não prova sozinho isolamento do banco. `PAYMENT_WORKER_ENABLED=false` não serve como contenção geral de novas compras, pois afeta webhooks.
4. **Ambos, G7/G8:** concluir aceites comerciais de entrega/frete, medir o ambiente final e congelar commit, schema, imagem/configuração e evidências da mesma release; assinar a revisão recíproca e ensaiar contenção/recuperação antes da implantação.

**Estado dos gates:** há entregas e cenários aprovados dentro de G1–G8, mas nenhum gate global é encerrado apenas por esta consolidação. **WF-18/WF-19 continuam abertos; implantação/observação de WF-20 não comprovadas.** As pendências acima orientam a continuidade sem repetir os ensaios #4/#5 já encerrados, salvo alteração relevante, falha ou nova divergência. Esta atualização não publica código nem autoriza automaticamente ações financeiras ou produção.

### 23.5 Pacote de continuidade para Vanderlei — publicação autorizada em 14/10

O operador autorizou publicar o trabalho pendente na `homologacao_teste`. Esta entrega reúne a consolidação acima, os roteiros/diagnósticos do #5 e do frete, o comando histórico de estorno, os três scripts de preparação/importação/verificação J&T e os testes Python. Inclui também os oito JSONs de evidência Sandbox do #5 e os resultados revisados de comparação, importação e cotação J&T. Identificar a publicação pelo commit que contém esta seção; a CI desta nova revisão precisa ser conferida separadamente das execuções da seção 23.1.

**Primeira ação de Vanderlei:** atualizar sua cópia de `homologacao_teste`, ler a seção 23 e revisar [o fechamento do estorno #5](../../../../../../PACOTE_REVISAO_VANDERLEI/L-04-ROTEIRO_ESTORNO_INTEGRAL_CARTAO_PEDIDO_5.md), [a confirmação remota](../../../../../../materiais/homologacao/pedido-5-estorno-confirmacao-remota.json) e [a estabilidade após o webhook](../../../../../../materiais/homologacao/pedido-5-estorno-apos-webhook.json). Esses registros já permitem revisar os efeitos de devolução, pontos/estoque e integrar a operação comercial. O comando de solicitação está arquivado para auditoria: **não repetir o estorno nem recriar o pedido**.

**Dependência de implementação prioritária de Leno:** confirmar suporte do provedor/conta e entregar o contrato de débito ponta a ponta, com estados, capacidades, respostas e testes, para Vanderlei integrar V-02. Em paralelo, fornecer identificação do banco separado, procedimentos de dados e limites/contenção do consumidor para V-06/V-07. Vanderlei pode avançar nas definições de projeto/domínio/IAM e no ensaio da infraestrutura sem esperar o fechamento de todos os métodos; publicação deste pacote não equivale à entrega do débito ou ao aceite financeiro final.

**Arquivos privados preservados:** o repositório é público. `.env`, credenciais, planilha comercial completa, CSVs tarifários/de abrangência, snapshot bruto da origem e backup da carga permanecem fora do Git. Os JSONs publicados contêm campos selecionados do Sandbox, sem identidade pessoal do comprador, instrumento de cartão, credenciais ou token de cotação. A referência a arquivos privados nos registros históricos indica sua localização local, não disponibilidade pública.

**Reprodução da carga J&T:** `scripts/prepare-jt-tariffs.py` recebe a planilha privada por caminho; `tests/unit/test_prepare_jt_tariffs.py` pula somente os casos dependentes dela quando ausente. `scripts/import-jt-homologation.mjs` e `scripts/verify-jt-import.mjs` dependem do snapshot privado `materiais/J&T/Tabela/preparado/banco-origem-jt-somente-leitura.json`, com SHA-256 fixado no importador; obtê-lo por canal privado autorizado se for necessário repetir o ensaio em PostgreSQL descartável. O importador está restrito à homologação existente e não constitui procedimento de carga de produção. A importação remota já foi concluída; publicar os scripts não exige executá-la novamente.

**Validação desta publicação:** quatro testes Python aprovados com a planilha local; verificação J&T em PostgreSQL descartável aprovada (isolamento de host, leitura inicial, rollback, importação integral, revisões, reaplicação sem duplicidade, divergência e identidade da loja). Sintaxe dos scripts JavaScript e `git diff --check` aprovados. Nenhum teste desta rodada acessou os bancos principal ou de homologação. Os arquivos privados usados nos testes permanecem locais.

## 24. Reaproveitamento da main antes de novas decisões — 14/10/2026

Diretriz expressa do operador: verificar o código/documentação de main e a configuração existente antes de pedir decisões ou refazer trabalho; trazer definições aplicáveis para homologação. Registrada também em `AGENTS.md`. A origem é somente leitura; alterações ficam na homologação. Não restaurar defeitos corrigidos, trocar identidades/credenciais de ambientes ou promover dados de teste a produção.

### 24.1 Comparação de origem, código e bancos

Fetch de `main` e `homologacao_teste` realizado. Origem auditada: `7f9b26e062ec2654420fecffb6dd78ad3ba1e017`; homologação de partida `b8b7f3bbe9ba93fc651d1eeaa67db22adb4d478d`. `git merge-base --is-ancestor origin/main HEAD` confirmou ancestralidade; contagem main...HEAD: **0 commits exclusivos de main e 29 da homologação**. Portanto não faltam commits da main nesse recorte; diferenças efetivas podem estar em alterações posteriores de código e nos dados/ambientes separados. Não foi feito merge que reverta correções.

Consultas das duas bases usaram transações `READ ONLY`/`REPEATABLE READ`, timeout e seleção explícita de campos; a leitura da origem verificou `transaction_read_only=on`. Credenciais fornecidas apenas em memória. As conexões locais `.env`/`.env.local` apontam para a origem, não para homologação: não usá-las implicitamente para executar migrations/importações.

| Definição | Evidência na main/origem | Aplicação na homologação |
|---|---|---|
| Parcelamento | `lib/config/payment.config.ts`: até 12x; mínimo R$ 20; repasse ao comprador, taxa 0,0299 a.m. | Mesmos defaults preservados com validação mais estrita; não requer nova decisão comercial. |
| Boleto/piso do gateway | Mesmo arquivo: um dia útil de vencimento e piso R$ 5. | Defaults já preservados. Configuração existente não substitui homologação externa do boleto. |
| Métodos disponíveis | `types/payment-gateway.types.ts`: PIX, CREDIT_CARD, BOLETO, WHATSAPP_PIX; adapter implementa PIX/crédito/boleto. | Débito não está implementado na origem nem no destino. Ocorrências de débito de pontos não são pagamento por cartão de débito. |
| Origem e opções de entrega | Banco da origem: CEP `67140615`, retirada e a combinar habilitados. | Iguais nas duas bases; nenhum recadastro necessário. |
| Correios e preparação | Origem: `enableCorreios=true`, `additionalDays=1`; homologação estava false/0. | **Importados nesta etapa**, com backup/auditoria; detalhes na seção 24.2. |
| Credenciais Correios | Contrato/senha ausentes em ambas as bases; apenas presença foi consultada. | Não há credencial existente a recuperar nessa origem. Habilitar não comprova cotação bem-sucedida. |
| Tarifas J&T | 5.181 tarifas e 58 faixas. Comparação agregada dos campos comerciais, sem datas/IDs, igual entre bases. | Carga anterior já corresponde à origem; nenhuma nova importação tarifária necessária. Não há tabela local de frete em nenhuma das lojas. |
| Fidelidade | Ativa; ganho 0,5; ponto R$ 0,05; mínimo 100; teto de desconto 50%; validade 365 dias. | Todos esses campos já coincidem. Saldos/carteiras e obrigações continuam próprios de cada ambiente. |
| Banco e operação | Origem efetiva Neon e homologação em endpoint distinto; runbooks de deployment e backup/restore já presentes na main. | Reutilizar os procedimentos existentes. Esses dois bancos são de testes; nenhum novo banco comercial de produção foi identificado por esta auditoria. |
| Consumidor | Main contém endpoints de expiração de pedidos/pontos, lote de pedidos padrão 50, máximo 100. Não contém `vercel.json`, `ops/`, `infra/` ou Dockerfile; auditoria de infraestrutura da própria main marca scheduler externo como não verificado. | Reutilizar endpoints/limites aplicáveis e o consumidor durável posterior. Cadência efetiva externa não foi comprovada. Proposta de minuto/hora do Cloud Run não é decisão recuperada da main. |
| Expiração antiga | Main usa 60 minutos para Asaas e 24 horas para manual. | Não restaurar cancelamento remoto por idade: homologação usa prazos persistidos/evidência do provedor. Prazo manual e lote já preservados; não confundir validade do pedido com frequência do scheduler. |
| Catálogo | Origem: **522 produtos, 528 variantes, 18 marcas, 10 categorias**. Homologação: um produto, zero marcas/categorias. | Origem identificada para preparar carga sem solicitar novamente o catálogo. Carga completa ainda não realizada; seção 24.3. |

Os runbooks existentes são `diversos/AUDITORIAS/operations/operations/DEPLOYMENT-RUNBOOK.md` e `BACKUP-RESTORE-RUNBOOK.md`. São procedimentos revisáveis, não prova de recursos implantados: comandos citados precisam corresponder aos scripts atuais. O `.env.example` da main contém exemplos de pool Supabase, enquanto as conexões locais efetivas são Neon; não copiar placeholders como decisão operacional.

### 24.2 Configurações de frete importadas

Aplicado às **16:46 UTC de 14/10** em `continental-homologacao`, loja `3a82b33c-3646-4272-9a89-80bb1ba327a5`: Correios false → **true**, preparação 0 → **1 dia**. Origem lida novamente antes da escrita. Somente esses dois campos foram enviados ao UPDATE; o trigger elevou `configurationVersion` de **4 para 5**. Registro `AuditLog/MAIN_FREIGHT_SETTINGS_IMPORT` contém anterior/posterior e proveniência. Backup e resultados privados em `artifacts/main-hml-settings/`.

Implementação: `scripts/sync-main-hml-freight-settings.mjs`, somente leitura por padrão, URLs/lojas fixadas e diferentes, origem sempre em transação somente leitura, lista de dois campos permitidos, aborta divergência do baseline, backup antes da escrita e validação da revisão. `--apply` é explícito. Leitura independente posterior retornou `ALREADY_ALIGNED`, sem escrita.

Verificação em PostgreSQL descartável (`scripts/verify-main-hml-settings.mjs`) aprovada: bloqueio de destino incorreto/mistura de lojas, prévia sem escrita, backup obrigatório, rollback após falha de auditoria, preservação dos demais campos, revisão incrementada e reaplicação sem duplicar auditoria. Main não recebeu qualquer escrita. Não foram processados pedidos, filas ou cobranças.

**Efeito nos próximos ensaios:** recotar e gerar nova proposta; cotações anteriores ficam desatualizadas pela revisão. Para o destino J&T de dois dias, a composição passa a prever **três dias** incluindo preparação. O #5 já concluído mantém seu snapshot original de dois dias. Correios habilitados reproduzem a decisão original, mas PAC/SEDEX ainda exigem retorno válido da API; não foi disparada cotação remota nesta etapa.

### 24.3 Prioridades para Vanderlei após consultar a origem

1. **Reutilizar agora:** revisão do #5/seções 23–24, regras financeiras/fidelidade, matriz/origem/prazo de frete e runbooks existentes. Não pedir novamente taxa de juros, quantidade de parcelas, CEP, prazo adicional ou a planilha J&T para esse recorte.
2. **Carga de catálogo — Leno:** preparar carga a partir da origem identificada, preservando vínculos e saldos dos ensaios da homologação. Auditoria somente leitura com a normalização de `lib/product-variants.ts` encontrou **zero combinações duplicadas, zero produtos sem variantes, zero dimensões inválidas e quatro produtos com estoque geral diferente da soma das variantes**. Essa divergência precisa ser conciliada como dado, sem inventar estoque físico nem substituir silenciosamente o produto usado nos #4/#5. Não houve importação dos 522 produtos ou cópia de usuários, pedidos, carteiras ou saldos nesta etapa.
3. **Infraestrutura/consumidor — ambos:** aproveitar a base técnica atual e os procedimentos da main; identificar recursos reais externos e sua configuração antes de solicitar novos valores. Projeto Cloud Run, agenda implantada, canais de alerta e banco comercial separado não foram encontrados nos arquivos auditados; sua ausência no Git não prova inexistência nos painéis. O banco de origem conhecido não deve ser reutilizado como produção por conveniência.
4. **Débito — Leno:** a busca no contrato/adapter e na documentação de main não recuperou implementação. A lacuna é real; confirmar suporte do provedor e construir o contrato para Vanderlei integrar V-02. Não anunciar essa tarefa como configuração esquecida ou funcionalidade já herdada.

Esta etapa reaproveita o que foi comprovado e delimita o que ainda precisa de trabalho técnico/consulta externa. Não solicita novas decisões comerciais, não aprova gates e não declara concluída a carga de catálogo nem a infraestrutura final.

## 25. Carga do catálogo para desbloquear Vanderlei — 14/10/2026

Em continuidade à autorização de reaproveitar a origem na homologação, executada carga **somente no banco de homologação**, encerrada às **16:58:14 UTC / 13:58:14 de Brasília**. A branch main e seu banco foram usados exclusivamente para consulta; nenhuma migration, atualização ou saneamento foi aplicado na origem.

### Resultado e uso imediato

| Registro | Adicionado | Total após carga |
|---|---:|---:|
| Produtos | 518 | 519 |
| Variantes | 518 | 520 |
| Marcas | 18 | 18 |
| Categorias | 10 | 10 |
| Vínculos produto/categoria | 471 | 471 |

O aspirador automotivo dos ensaios (`a26fdbc1-d8c3-4173-b114-f759654b9ca4`) e suas duas variantes foram preservados integralmente: IDs, atributos, estoque, versões e vínculos. Os registros novos mantêm IDs e atributos comerciais da origem, com loja/autor remapeados para a loja e o administrador já existentes na homologação; não foram copiados usuários da origem. Variantes neutras foram normalizadas pelo helper `lib/product-variants.ts` para Único/Padrão. Não houve importação de pedidos, clientes, carteiras ou movimentos financeiros.

**Vanderlei pode prosseguir com V-01/V-04/V-05:** conferir catálogo, marcas/categorias/filtros, edição no Admin, variantes e cotação por peso/medidas dos produtos. Recarregar a interface para obter a base atual. Os preços/estoques são a base de testes herdada, não uma contagem física aprovada para venda real. Débito, infraestrutura externa e os demais gates continuam separados.

### Produtos separados para conciliação

| Produto na origem | Estoque geral | Soma das variantes | Tratamento |
|---|---:|---:|---|
| Camisa Branca | 16 | 30 | Não importado; saldo não foi inferido. |
| Calça Jeans | 13 | 30 | Não importado; saldo não foi inferido. |
| Aspirador de Pó | 1 | 10 | Não importado; é distinto do aspirador automotivo dos ensaios. |
| Camisa Preta | 8 | 30 | Não importado; saldo não foi inferido. |

Essas quatro pendências não impedem o uso dos 518 produtos consistentes. Não ajustar main, substituir o estoque geral pela soma ou distribuir a diferença arbitrariamente. Qualquer conciliação posterior terá seu próprio diagnóstico e auditoria. A carga integral dos 522 produtos da origem não está declarada concluída.

### Garantias e validação

- `scripts/import-main-hml-catalog.mjs`: somente leitura por padrão; leitura da origem em transação `READ ONLY`/`REPEATABLE READ`, com identidade confirmada. Destino fixado por host/loja, conta Sandbox e administrador local; sem carregar `.env` implicitamente.
- Aplicação exige `--apply` e `CATALOG_SOURCE_SHA256` igual ao hash da prévia revisada: `2df9de4b044f267d1923dbbb9da1925a746fce9ce15b5d610532ea6998dc5f72`. Não executa migrations nem processamento financeiro.
- Transação serializável com bloqueio do catálogo e linhas de produtos antes da leitura/reconciliação; backup privado obrigatório antes da primeira escrita. Somente inserções: registros existentes nunca são sobrescritos. Auditoria única `MAIN_CATALOG_IMPORT`, com origem, hash, quantidades e exclusões.
- Conferidos contagens, campos comerciais/variantes, vínculos e igualdade dos registros preexistentes antes do commit. Comparação externa antes/depois das **16 tabelas** de pedidos/histórico, pagamentos/operações/fatos/filas, fidelidade/lotes/alocações, reservas e carrinhos retornou **zero diferenças**.
- `scripts/verify-main-hml-catalog.mjs <snapshot-privado>` passou em PostgreSQL descartável: combinações duplicadas recusadas, prévia sem escrita, backup obrigatório/falho, rollback integral após falha de auditoria, remapeamento do autor, preservação de produto/variante/carrinho existente, exclusão das divergências, escopo incorreto recusado e reaplicação sem duplicidade. Sintaxe dos scripts também validada.
- Consulta independente posterior retornou `NO_NEW_RECORDS`, com os mesmos quatro produtos separados. Esse código informa ausência de novas inserções, não certifica futuras alterações de estoque ou edição comercial.

Evidência compartilhável: [resultado da carga](../../../../../../trabalho_em_dupla/evidencias/L-CATALOGO-HOMOLOGACAO-2026-10-14.json). Snapshot, backup e hashes completos das tabelas protegidas ficam em `artifacts/main-hml-catalog/`, fora do Git. Para reproduzir o teste descartável, disponibilizar o snapshot por canal privado autorizado; não apontar o teste para main ou homologação. Não é necessário reaplicar a importação no Preview.

## 26. Trabalho que Vanderlei já pode executar — 14/10/2026

**Vanderlei está liberado para continuar as frentes abaixo.** A falta do catálogo deixou de ser bloqueio geral: a carga da seção 25 já foi aplicada ao banco de homologação. O código e as evidências dessa entrega foram publicados na `homologacao_teste` em `7b26b14db1d4f746d34fb4432657954ab53d17a7`; o alinhamento de frete da seção 24 foi publicado em `31f2d78`. Esta atualização é documental: não registra novos testes, não atesta CI/deploy dessas revisões e não altera bancos ou a main.

### 26.1 Ordem sugerida e resultado esperado

Primeiro, atualizar a cópia de `homologacao_teste`, conferir o commit efetivamente usado pelo Preview e o destino de homologação. Conferir a CI correspondente antes de usar seus resultados como aceite. Não reaplicar as cargas já concluídas. As conexões locais `.env`/`.env.local` identificadas na auditoria apontam para a origem; não usá-las implicitamente em testes que escrevem dados.

| Prioridade / frente | O que pode fazer agora | Entrega esperada |
|---|---|---|
| **1 — V-01/V-05: catálogo e navegação** | Validar listagem, busca, filtros por marca/categoria, detalhes, imagens e navegação com os 519 produtos, 520 variantes, 18 marcas e 10 categorias disponíveis. | Registrar cenários, revisão testada, resultado e defeitos encontrados; a carga não equivale a aceite da interface. |
| **2 — V-05: Admin e variantes** | Validar cadastro/edição, seleção de variantes, estoque e preservação de IDs/vínculos. Exercitar alterações em dados próprios de teste na homologação ou em banco descartável, preservando o produto e os registros dos ensaios #4/#5. | Evidências das regressões de Admin, incluindo produto sem variação, dimensões distintas e variante sem estoque; corrigir falhas na branch de homologação. |
| **3 — V-04: frete** | Gerar novas cotações com pesos/medidas do catálogo e conferir seleção de serviço, preço/prazo e consistência entre proposta e checkout. Reutilizar CEP de origem `67140615`, matriz J&T e um dia adicional de preparação. Verificar retorno real de PAC/SEDEX e apresentação de indisponibilidade; habilitação dos Correios não comprova resposta válida da API. | Relatório por serviço/destino, com resultado ou erro observado. No destino do #5, conferir a composição atual de três dias para J&T; preservar o prazo histórico de dois dias do pedido. |
| **4 — V-02/V-05/V-08: checkout e revisão financeira** | Retestar navegação, tradução do carrinho, foco/digitação nos campos e integração visual dos métodos já implementados. Revisar as evidências de compra #4/#5, e-mail e estorno integral #5, confrontando pontos, estoque, frete e efeitos únicos. | Parecer de revisão com cenários aceitos e lacunas. Usar testes isolados para regressão; não repetir compra, estorno ou processamento dos casos encerrados apenas para revisar a entrega. |
| **5 — V-03/V-06/V-07/V-08: segurança e infraestrutura** | Continuar testes isolados de container, duas instâncias, consumidor, recuperação, logs e segurança. Reaproveitar os runbooks da main e conferir recursos/configurações externos existentes antes de propor novos valores. Preparar ajustes dos manifestos e procedimentos para o destino identificado. | Relatório técnico e configuração preparada para revisão, separando recursos comprovados de exemplos e pendências. Ativação do executor real, carga de produção e abertura comercial dependem dos itens abaixo. |

As quatro divergências de estoque da seção 25 não impedem essas atividades com os produtos já importados. Não precisam ser decididas novamente para começar a validação do restante do catálogo. A main e seu banco continuam estritamente somente leitura; correções e dados de ensaio ficam nos ambientes autorizados de homologação/teste.

### 26.2 Dependências que continuam com Leno ou com ambos

| Dependência | Responsável / próximo resultado necessário | O que ainda depende dela |
|---|---|---|
| **Débito** | Leno: confirmar suporte do provedor/conta e entregar contrato, capacidades, estados, recuperação e testes. Não foi encontrada implementação na main. | Integração e homologação de débito por Vanderlei em V-02. Não bloqueia os métodos existentes nem as frentes da seção 26.1. |
| **Banco e carga de produção** | Leno, com revisão de Vanderlei: identificar destino separado, inventário físico aprovado e procedimento de carga/migrations/backup/restore. Consultar recursos já existentes antes de pedir novas decisões. | Configuração definitiva de dados e abertura comercial. Estoque importado para homologação não é inventário de produção aprovado. |
| **Operação permanente do consumidor** | Ambos: fechar limites, cadência, conexões, retomada, alertas e contenção de novas compras, preservando obrigações existentes. | Ativação e aceite do executor no destino real. Os ensaios isolados e a preparação de manifestos podem continuar. |
| **Aceite financeiro e comercial restante** | Leno executa/consolida; Vanderlei revisa. Permanecem boleto, débito, revisão do PIX/#3, estorno parcelado e demais cenários ainda abertos no plano. | Encerramento dos gates e autorização de produção; o sucesso do #5 cobre somente o cenário documentado. |

**Próxima entrega de Vanderlei:** devolver um parecer por frente da seção 26.1, indicando commit/ambiente, cenários executados, evidências, falhas e dependências concretas. Não é necessário aguardar débito ou a conciliação dos quatro produtos para iniciar esse trabalho. **WF-18/WF-19 continuam abertos e WF-20 não está comprovado; não há liberação de produção.**

## 27. Débito no Asaas — levantamento técnico em 14/10/2026

Iniciada a prioridade de Leno. Consultados os guias/referências oficiais e o código local em `576ad89`, além de `origin/main` em `7f9b26e`. A leitura de `types/payment-gateway.types.ts` da main confirmou novamente ausência de método/contrato próprio para débito. Esta etapa não consultou credenciais ou habilitação da conta, não criou cobranças, não processou filas e não alterou bancos. O resultado é uma especificação preliminar com dependências explícitas, não uma integração pronta.

### 27.1 O que a documentação confirma

| Tema | Evidência oficial consultada | Consequência para este projeto |
|---|---|---|
| Pagamento online por débito | O [guia de cartão](https://docs.asaas.com/docs/cobrancas-via-cartao-de-credito), seção Cartão de débito, orienta usar `invoiceUrl` de cobrança criada com `CREDIT_CARD` ou `UNDEFINED`; não permite enviar diretamente os dados do cartão de débito pela API. | Preparar jornada hospedada, sem reaproveitar o formulário de captura do crédito como se processasse débito. A existência dessa jornada documentada não comprova habilitação na conta usada pela loja. |
| Criação | A referência de [criação de cobrança](https://docs.asaas.com/reference/criar-nova-cobranca) lista `UNDEFINED`, `BOLETO`, `CREDIT_CARD` e `PIX` como entrada de `billingType`. | Não enviar `DEBIT_CARD` arbitrariamente ao POST. Separar método escolhido pelo comprador, tipo enviado ao provedor e método efetivamente pago. |
| Retorno ao site | O [guia de redirecionamento](https://docs.asaas.com/docs/redirecionamento-apos-o-pagamento) oferece `callback.successUrl`/`autoRedirect` e exige domínio correspondente ao cadastrado na conta. | Conferir domínio do Preview/conta antes de configurar callback; chegada à página de retorno não será autoridade para aprovar o pedido. |
| Eventos | O [guia de eventos](https://docs.asaas.com/docs/webhook-para-cobrancas) descreve débito com `PAYMENT_CREATED`, `PAYMENT_CONFIRMED` e `PAYMENT_RECEIVED`, podendo incluir vencimento. | Preservar distinção entre aprovação e liquidação. O diagrama não define sozinho todos os campos de uma resposta real de débito; coletar exemplos sanitizados de consulta e webhook. |
| Devolução | A [central de ajuda sobre devolução de débito](https://central.ajuda.asaas.com/hc/pt-br/articles/31973207592219-Como-devolver-um-pagamento-recebido-por-cart%C3%A3o-de-d%C3%A9bito) descreve solicitação pelo painel e participação do cliente por link/documentos. A referência de [estorno de cobrança](https://docs.asaas.com/reference/estornar-cobranca) descreve crédito e Pix. | Não considerar comprovado o uso do estorno automático de crédito para débito. Confirmar endpoint aplicável, etapas e evidência de conclusão antes de implementar o despacho. |

**Lacunas da consulta:** não foi localizado, nas páginas consultadas, roteiro específico de simulação de débito em Sandbox nem contrato completo de estorno de débito por API. Isso não prova inexistência do recurso. Também não ficou comprovado como restringir a Fatura exclusivamente a débito ou como o método efetivamente pago aparece em cada etapa. Menção a `DEBIT_CARD` nas [estatísticas de cobranças](https://docs.asaas.com/reference/estatisticas-de-cobrancas) não é contrato de criação, consulta ou webhook.

### 27.2 Trabalho técnico identificado e contrato preliminar

| Área / arquivos existentes | Alteração necessária antes de disponibilizar débito |
|---|---|
| `types/payment-gateway.types.ts`, `types/asaas.types.ts`, `lib/commerce/contracts.ts` | Distinguir escolha local, jornada hospedada e método remoto observado. Definir contrato versionado de capacidades/resultado sem prometer débito exclusivo onde só há seleção na Fatura. |
| `services/asaas/asaas.adapter.ts`, `services/payment/checkout-payment.service.ts` | Criar cobrança avulsa sem dados de cartão, obter/persistir instrução de pagamento e recuperar a mesma cobrança em resposta incerta. O despacho atual precisa de ramo explícito: sua alternativa final cria Pix; adicionar somente um enum seria incorreto. |
| `services/payment/gateway-contract.ts`, `payment-inbox.service.ts`, `payment-worker.service.ts`, `payment-evidence.service.ts` | Tratar explicitamente o mapeamento de método: hoje há enums restritos e comparações exatas entre método da tentativa e `billingType` remoto. Não remover essas guardas globalmente; validar a transição documentada, conta, cobrança, referência, valor e quantidade. |
| Capacidades, proposta e apresentação | Capacidade própria, inicialmente indisponível. Débito à vista, sem parcelas ou juros de financiamento. Usar mensagem de encaminhamento ao Asaas; não coletar PAN/CVV nesse fluxo. Confirmar restrição de escolha/método efetivo antes de fixar nomenclatura pública. |
| Retorno, consulta e retomada | Reutilizar `AWAITING_PAYMENT`/`instructions.invoiceUrl` onde compatível, exigindo URL HTTPS de host autorizado do ambiente e validação no servidor. Reabrir o pedido existente após reload/volta; callback apenas conduz à consulta autoritativa. Não disparar nova cobrança por abandono/timeout. |
| Cancelamento, estorno, pontos e estoque | Definir vencimento/cancelamento remoto da jornada hospedada e prova final de devolução. Manter solicitação pendente até evidência definitiva; devolver pontos/estoque uma única vez. Não reutilizar o despacho de estorno do crédito sem suporte confirmado para débito. |

Os itens acima são requisitos de implementação propostos a partir da análise local, não capacidades já disponíveis. Preservar o crédito transparente existente e o fechamento dos #4/#5. Não há motivo para alterar a main ou recriar os ensaios encerrados.

### 27.3 Confirmação técnica necessária do Asaas

Texto preparado para o responsável pela conta encaminhar ao suporte de integrações, sem credenciais ou dados de compradores. Nenhuma mensagem foi enviada nesta etapa:

> Estamos integrando cartão de débito em um e-commerce próprio. O guia orienta criar cobrança com billingType CREDIT_CARD ou UNDEFINED e encaminhar o pagador à invoiceUrl. Precisamos confirmar:
>
> 1. Como verificar/habilitar débito na nossa conta e como testar aprovação, recusa e abandono no Sandbox, usando exclusivamente dados fictícios?
> 2. A Fatura pode ficar restrita a débito? Qual parâmetro oficial faz isso? Se o comprador escolher crédito ou outro método, como identificar o meio efetivamente pago?
> 3. Quais valores de billingType/status aparecem na criação, no GET da cobrança e nos webhooks após pagamento por débito? Podem fornecer exemplos sanitizados, incluindo identificação da cobrança e externalReference?
> 4. Qual é o procedimento/endpoint de estorno integral para débito confirmado e recebido? Há link ou ação do cliente? Quais respostas, eventos e consulta comprovam conclusão, pendência ou recusa?
> 5. Como cancelar/expirar uma Fatura não paga e confirmar que não poderá receber pagamento tardio? Como configurar o retorno para um Preview com domínio diferente do site principal?

**Critério para avançar à habilitação:** resposta verificável ou ensaio Sandbox controlado que feche essas lacunas; depois implementar o contrato e provar criação única, retomada, recusa/abandono, callbacks não autoritativos, eventos duplicados/fora de ordem, pagamento tardio e estorno com efeitos únicos. Simulações locais poderão validar as guardas, mas não serão apresentadas como prova de aceitação do provedor.

**Passagem para Vanderlei:** já pode preparar a jornada visual de encaminhamento/retorno a partir destes requisitos, sem expor o método aos compradores. A integração funcional de débito permanece dependente do contrato final de Leno e das confirmações acima. As tarefas liberadas na seção 26 continuam disponíveis. Débito permanece obrigatório no escopo; esta investigação não o remove nem libera produção.

## 28. Preparação do ensaio de boleto — 14/10/2026

O operador informou ter enviado as perguntas da seção 27 ao suporte Asaas e autorizou seguir com a preparação de boleto enquanto aguarda a resposta. Reutilizados os defaults da main (D+1 e piso R$ 5); não houve nova decisão comercial nem alteração na origem. Overrides do deployment ainda precisam ser confrontados com a emissão; o algoritmo herdado pula fins de semana, sem calendário de feriados, usando fuso do processo.

Consulta READ ONLY/REPEATABLE READ ao banco fixado de homologação às **18:46:15 UTC** confirmou `enableBoleto=true`, retirada habilitada, configuração v5, produto/variante dos ensaios com estoque **94/44**, versões **11/8**, preço **R$ 49,90**, carteira/lotes **286**, dívida/pendente zero e lifetimeEarn **785**. Nenhum boleto anterior do cliente do #5; pedido #5 continua CANCELLED v2. Contas observadas nas tentativas da loja: apenas sandbox-hml. Isso não substitui validação do deployment/conta remota.

Preparados [roteiro de boleto](../../../../../../PACOTE_REVISAO_VANDERLEI/L-04-ROTEIRO_BOLETO.md), [SQL de baseline](../../../../../../PACOTE_REVISAO_VANDERLEI/L-04-PREPARAR_BOLETO.sql) e [diagnóstico após emissão](../../../../../../PACOTE_REVISAO_VANDERLEI/L-04-DIAGNOSTICAR_BOLETO.sql). O último exige ID/número reais, mantendo loja/método fixos; não presume número #6. Artefato do baseline em `artifacts/boleto-hml/baseline.json`, fora do Git.

**Andamento atualizado:** operador conferiu proposta de uma unidade do aspirador automotivo Pequeno/Vermelho, retirada na loja, boleto, sem resgate, total R$ 49,90 e ganho previsto de 24 pontos. Relatou retorno à identificação ao confirmar. A leitura das 19:25 UTC não encontrou pedido BOLETO desse cliente e mostrou a intenção mais recente OPEN; investigação e correção local descritas na seção 29. Retomar após publicação/conferência da correção e nova revisão válida, verificando antes se existe pedido da tentativa anterior. Depois da emissão, conferir cobrança/vencimento no Sandbox e diagnóstico antes de simular pagamento.

Sem outras movimentações, emissão deve reservar uma unidade (estoques 93/43), sem ganho antecipado; pagamento autoritativo deve manter esses estoques, comprometer a reserva e creditar 24 pontos uma única vez (saldo/lotes 310, lifetimeEarn 809). O estorno de boleto está bloqueado no comando atual e exige fluxo próprio; não reutilizar o estorno de crédito. Vencimento, atraso, cancelamento, estorno e fuso/feriados continuam cenários separados.

Validação: baseline executado; diagnóstico executado com parâmetros vazios e identidade de crédito para conferir recusa de escopo; **60 testes unitários em quatro arquivos aprovados** (recuperação do adapter, autoridade do plano, contratos do cliente e e-mail). Não houve teste remoto de emissão/pagamento, escrita em banco ou processamento de filas. Não há novo aceite de produção.

## 29. Checkout perde revisão ao atualizar em segundo plano — 14/10/2026

O operador relatou retorno à identificação após confirmar boleto e ocorrência anterior no crédito. Consulta somente leitura às **19:25:11 UTC (16:25 BRT)** encontrou a intenção mais recente OPEN, revisão 1, criada às 19:19:29 UTC; nenhum pedido BOLETO do cliente do #5, carteira 286 e estoques 94/44. Essa leitura não é comprovação remota de ausência de cobrança no provedor nem resultado posterior a esse horário.

Encontradas duas causas no fluxo compartilhado: `CartProvider` executava consulta do carrinho e `router.refresh()` ao receber foco/visibilidade/BroadcastChannel; o store substituía o carrinho e seus itens por novos objetos mesmo quando toda a resposta era idêntica. A alteração da referência dos itens invalidava a proposta revisada. A atualização da rota também era desnecessária durante o checkout, que acrescenta `intent` à URL e mantém os campos em memória.

**Limite da reprodução:** teste de navegador com o código anterior reproduziu perda da revisão ao voltar à aba, permanecendo na etapa de pagamento com os campos preenchidos. O retorno completo à identificação observado pelo operador ainda não foi reproduzido; não tratá-lo como causa única comprovada. A correção elimina a atualização automática da rota em `/checkout`, mantendo a consulta do carrinho, e preserva o objeto anterior somente quando o snapshot validado inteiro é idêntico. Alteração real, inclusive preço na mesma versão, continua sendo adotada; revisão e identidade continuam protegidas. Dados de cartão não foram persistidos.

**Validação local:** regressão falhou antes da correção; 49 testes unitários em três arquivos passaram depois, além de TypeScript e ESLint. Os **7 testes de navegador passaram em build de produção**, duas instâncias `next start`, PostgreSQL descartável e sem provedores externos (run `9141497bf19d509e08fe64f2d32af18d`, build `4EZEsih60A1waF-yRZEBL`). Cobertos foco com carrinho idêntico, revisão invalidada por mudança real sem apagar identificação, confirmação após foco, digitação de cartão, frete, troca de identidade e recuperação. Isso não substitui o reteste no Preview.

Correção preparada localmente, **ainda não publicada nesta etapa**. Main e seu banco não foram alterados; nenhuma compra, confirmação de pagamento ou execução de filas foi disparada em homologação durante a investigação.

**Preparação da publicação autorizada pelo operador:** incorporados os commits remotos de Vanderlei `f89e68e` e `bfaf1a1`, preservando as duas atualizações no documento de pendências. Correção em `d55d635`. Após a integração, passaram 54 testes unitários (incluindo o protocolo de navegador), ESLint e os 7 testes de navegador no build de produção com duas instâncias (run `4d9fda258ea3e53a723f8f14bcea294f`, build `vGIQjAVOHpM6eaACMPoPH`). O build também aprovou a checagem TypeScript. Pacote destinado exclusivamente a `homologacao_teste`; aprovação do deploy Vercel e reteste manual do boleto são verificações posteriores, separadas destes resultados locais.

## 30. Boleto #6 emitido e divergência de data na apresentação — 14/10/2026

**Fechamento atual: cenário de emissão e pagamento de boleto aprovado no Sandbox.** Operador confirmou recebimento do e-mail e enviou imagem com pedido #6, boleto bancário, retirada no balcão, uma unidade Pequeno/Vermelho, R$ 49,90, confirmação em 14/10/2026 às 17:38 e ganho de 24 pontos. Conteúdo coerente com a leitura das 20:45:36 UTC: pedido PAID v1, tentativa APPROVED, cobrança RECEIVED, fatos AUTHORIZED/SETTLED, EARN único de 24, carteira/lotes 310, lifetimeEarn 809, estoque 93/43 e reserva COMMITTED; evento e três tarefas concluídos. IDs e saldos permaneceram estáveis nas leituras posteriores ao pagamento. Não há novas rodadas necessárias para este pedido. As pendências históricas de e-mail abaixo estão encerradas.

**Limites do fechamento:** aprovação deste cenário não cobre cancelamento, vencimento, pagamento tardio, estorno de boleto, replay financeiro deliberado ou retirada física. `PaymentCharge.settledAt` permaneceu nulo, conforme registro; a liquidação é evidenciada pelo fato SETTLED e status RECEIVED. Outros cenários financeiros e gates de produção permanecem abertos. Documentação atualizada localmente; nenhuma publicação, mutação de banco ou processamento adicional realizado nesta conferência do e-mail.

Publicação anterior concluída em `9bc85c3` na homologação; Vercel informou sucesso. O operador repetiu a revisão válida e chegou à confirmação de emissão do pedido #6, sem relatar novo retorno à identificação. Isso comprova essa execução, não todos os cenários de navegação.

Consulta READ ONLY/REPEATABLE READ às **20:20:49 UTC**: pedido `0f0a05ff-2a24-4e6f-93ef-be13451388c9` PENDING v0, BOLETO/PICKUP R$ 49,90, sem desconto/frete/encargos, `paidAt` nulo; uma tentativa PENDING e uma cobrança `pay_blfexx8zkousw431` na conta registrada sandbox-hml, com artefatos presentes. Uma reserva RESERVED, estoque 93/43 (versões 12/9), carteira/lotes 286 e lifetimeEarn 785. Sem ganho antecipado, fatos financeiros ou operações. CHECKOUT_COMMITTED READY, sem processamento nesta conferência. Diagnóstico de boleto parametrizado com ID/número reais; confirmação remota de pagamento ainda pendente.

**Defeito de apresentação identificado:** PDF enviado pelo operador informa 15/10; checkout mostrava 16/10. Criação e reconciliação convertem a data do provedor no limite exclusivo de pagamento em UTC−03: `2026-10-16T03:00:00Z`, também projetado em `asaasDueDate`. A página herdou da main a formatação direta desse campo, mas a main o preenchia com fim do próprio dia. A tela atual estava exibindo o dia do limite, não o vencimento impresso.

Correção local em `formatBoletoDueDate` e na confirmação: apresentar o último dia incluído antes desse limite, na convenção UTC−03 já utilizada, sem depender do fuso do navegador. Dados ausentes/inválidos não inventam próximo dia útil. Não foram alterados o prazo autoritativo, os 72h de tolerância da reserva, valores ou registros bancários. **39 testes unitários aprovados** cobrem contratos, projeção, mudanças de mês/ano, ano bissexto, offsets equivalentes e bloqueio no instante exato de expiração. Correção ainda não publicada nesta etapa; reteste da data no Preview e simulação de pagamento permanecem próximos passos. Main e seu banco intactos.

**Atualização de publicação:** operador autorizou enviar a correção à `homologacao_teste`. Pacote inclui a apresentação corrigida, testes, roteiro e diagnóstico fixado no pedido #6. TypeScript aprovado; ESLint sem erros, com aviso preexistente sobre a imagem PIX. Não houve mudança de código desde essas verificações. Conferência no Preview após deploy deve mostrar 15/10/2026 nas duas ocorrências do vencimento e preservar o mesmo pedido/cobrança; não emitir novo boleto nem simular pagamento como parte da publicação.

**Reteste e simulação:** commit `117ec92` publicado com deploy Vercel concluído. Operador enviou tela do #6 e PDF com vencimento 15/10/2026, validando a correção visual; depois confirmou pagamento nas Ações de Sandbox e informou recebimento no Asaas. Consulta somente leitura às **20:36:43 UTC** encontrou PAYMENT_RECEIVED `34e43629-d26c-4982-bfd1-4510de37aa5c` READY, attempts=0. Pedido PENDING v0, tentativa/cobrança PENDING, `paidAt` nulo, sem fatos ou pontos creditados; carteira/lotes 286, lifetimeEarn 785, estoque 93/43 e reserva RESERVED. O evento chegou, mas ainda não foi consumido: aprovação interna, liquidação registrada, EARN único de 24, e-mail e estabilidade posterior continuam pendentes. Próxima ação é conferência do escopo e uma rodada controlada do executor, seguida do diagnóstico. Nenhum processamento foi disparado por esta leitura; não repetir a simulação remota.

**Após a primeira rodada do operador:** escopo sandbox-hml conferido às 20:37:47 UTC; rodada informou inbox 1 concluído, reconciliação 1 em revisão e outbox 1 concluído. Consulta somente leitura às **20:39:34 UTC** confirmou #6 PAID v1 (`paidAt` 20:38:41.490 UTC), tentativa APPROVED sem failureCode, mesma cobrança RECEIVED, um fato AUTHORIZED e um SETTLED de R$ 49,90. Um movimento EARN de 24 (`8d6ba3fb-500d-45da-b2aa-ad3301e4b36b`), carteira/lotes 310, lifetimeEarn 809, estoque 93/43 e versões 12/9 preservados; reserva COMMITTED. PAYMENT_RECEIVED e CHECKOUT_COMMITTED concluídos em uma tentativa. A revisão é do PIX #3 (`PAYMENT_REFUND_CANCELLED_REVIEW`, atualizado 20:38:57 UTC), não do boleto #6. `PaymentCharge.settledAt` permanece nulo; liquidação registrada comprovada pelo fato SETTLED e status RECEIVED, não por esse timestamp. PAYMENT_CONFIRMATION_EMAIL e ORDER_STATUS_CHANGED estão READY, sem tentativas; próximos passos são consumo controlado dessas tarefas, confirmação do e-mail e nova leitura para verificar estabilidade dos efeitos. Ensaio ainda não encerrado e sem liberação de produção.

**Segunda rodada e estabilidade:** operador informou reconciliação 1 concluída e outbox 1 concluído, sem revisão/erros. Consulta somente leitura às **20:43:25 UTC** confirmou ORDER_STATUS_CHANGED COMPLETED em uma tentativa e e-mail ainda READY, attempts=0. #6 PAID v1, tentativa APPROVED v2, mesmos IDs de AUTHORIZED/SETTLED e do EARN único de 24, carteira/lotes 310, lifetimeEarn 809, estoque 93/43 e versões 12/9 preservados. Estabilidade observada; não houve replay financeiro deliberado. Falta uma rodada controlada para a tarefa de e-mail e confirmação de recebimento. O contador global de reconciliação dessa rodada não identifica sozinho qual pedido foi consultado.

**Terceira rodada — envio concluído:** após retorno de reconciliação 1 e outbox 1 concluídos, leitura somente leitura às **20:45:36 UTC** confirmou PAYMENT_CONFIRMATION_EMAIL COMPLETED, attempts=1, sem erro; todas as três tarefas do #6 e o PAYMENT_RECEIVED concluídos. Pedido PAID v1, tentativa APPROVED v2, mesmos fatos AUTHORIZED/SETTLED e EARN único de 24, carteira/lotes 310, lifetimeEarn 809, estoque 93/43 e reserva COMMITTED preservados. Não executar novas rodadas para essas tarefas. Recebimento e conteúdo do e-mail ainda aguardam confirmação do operador; conclusão da fila não comprova entrega na caixa postal. Demais cenários de boleto e aceite de produção continuam fora deste resultado.

## 31. Preparação do cancelamento de boleto não pago — 14/10/2026

Operador autorizou iniciar o próximo cenário após o fechamento do #6. Preparados [roteiro de cancelamento de boleto](../../../../../../PACOTE_REVISAO_VANDERLEI/L-04-ROTEIRO_CANCELAMENTO_BOLETO.md) e [diagnóstico somente leitura](../../../../../../PACOTE_REVISAO_VANDERLEI/L-04-DIAGNOSTICAR_CANCELAMENTO_BOLETO.sql), inicialmente sem alvo e com exclusão explícita do #6. Não presumir número #7; preparar comando específico somente depois da emissão e da identificação do novo pedido, cobrança e versão.

Consultada origin/main em `7f9b26e`, preservando os defaults de boleto D+1/piso R$ 5; reutilizado o fluxo durável de homologação para CANCEL de tentativa e pedido PENDING. Não substituir por edição de status, cancelamento manual no Asaas, REFUND ou alteração de prazos. Confirmação remota deve preceder o fechamento local e a liberação única da reserva.

Baseline READ ONLY/REPEATABLE READ às **21:05:48 UTC (18:05:48 BRT)**: configuração v5, boleto/retirada habilitados, aspirador Pequeno/Vermelho R$ 49,90, estoque 93/43 e versões 12/9, indisponíveis zero, carteira/lotes 310, pendentes/dívida zero, lifetimeEarn 809, carteira v11 e nenhum lote positivo vencido. Único boleto desse cliente é #6 PAID v1/RECEIVED. Main e banco de origem intactos.

Próximo passo do operador: montar nova proposta de uma unidade, retirada, boleto e sem pontos; enviar revisão antes de confirmar. Esperado R$ 49,90 e ganho previsto de 24, sem crédito efetivo neste cenário. Após emissão, estoque esperado 92/42 e reserva RESERVED; após cancelamento comprovado, retorno a 93/43 e reserva RELEASED, mantendo carteira/lotes 310 e lifetimeEarn 809, sem movimentos de fidelidade do novo pedido. Conferir mesma cobrança, operação/fato CANCELLED e estabilidade posterior; preservar #6 pago e #3 em revisão.

SQL validado sem alvo e com identidade protegida do #6, retornando respectivamente ORDER_SCOPE_REQUIRED e ORDER_SCOPE_NOT_FOUND. Dez testes existentes de recuperação do adapter aprovados com transporte simulado; não constituem prova de cancelamento remoto de boleto. Nenhuma compra, solicitação financeira, processamento de filas, alteração de banco ou publicação foi executada nesta preparação. O cenário continuava em preparação naquele momento; andamento de 15/10 abaixo, sem novo aceite de produção.

## 32. Cancelamento do boleto #7 — 15/10/2026

Baseline revalidado às 13:44:50 UTC: estoque 93/43, carteira/lotes 310 e lifetimeEarn 809. Operador emitiu #7, UUID `cd2153ce-9b36-4c9a-ba89-376bf201ae91`, BOLETO/PICKUP R$ 49,90, sem pontos, cobrança `pay_ddili6nqoxts9jp3`; tela e PDF com vencimento 16/10. Leitura às 13:50:03 UTC confirmou PENDING v0, uma reserva RESERVED, estoque 92/42 e nenhum ganho antecipado.

Comando específico `l04-boleto-cancel-pedido7-cd2153ce-v0` executado pelo operador, HTTP 202, replay=false. Operação `9e76ebab-ebe1-44f1-8372-af5d9939b868` inicialmente READY; tentativa CANCEL_PENDING. Escopo sandbox-hml verificado às 13:55:59 UTC, zero legados não rastreados. Primeira rodada tratou revisão antiga do PIX #3 e CHECKOUT_COMMITTED do #7; segunda reconciliou o #4; terceira concluiu o CANCEL do #7 e ORDER_STATUS_CHANGED. Cada rodada foi seguida de leitura, sem inferir identidade pelos contadores globais.

**Estado conferido às 14:02:40 UTC (11:02:40 BRT):** pedido CANCELLED v1, tentativa CANCELLED v4, cobrança DELETED; operação COMPLETED às 14:02:05.196 UTC, sem erro; um fato CANCELLED de R$ 49,90 e um histórico PENDING → CANCELLED. Reserva RELEASED, estoque restaurado a **93/43** (versões 14/11); carteira/lotes **310**, lifetimeEarn **809**, sem movimentos de fidelidade ou crédito/resgate. Duas outboxes COMPLETED em uma tentativa cada; nenhum inbox do #7 observado nessa leitura.

**Fechamento: cenário de cancelamento de boleto não pago aprovado no Sandbox.** Operador enviou imagem do histórico do #7 cancelado sem ações de pagamento. A consulta do painel, inclusive com filtro de removidas, não localizou a cobrança; isso foi tratado como inconclusivo, sem reenviar cancelamento. O operador executou o script somente leitura `L-04-CONFERIR_COBRANCA_BOLETO_PEDIDO_7.ps1` e retornou às **14:23:58.8889471 UTC** HTTP 200, `CHARGE_DELETION_VERIFIED`, identidade/método/valor conferidos, `status: PENDING` e **`deleted: true`** para a mesma cobrança. A marca de exclusão confirma o resultado remoto; PENDING isolado não significa cobrança ativa. A causa da ausência na listagem do painel não foi identificada.

Leitura READ ONLY/REPEATABLE READ às **14:23:05 UTC** confirmou estabilidade desde 14:02:40 UTC: mesmos IDs de operação/fato/reserva, pedido CANCELLED v1, estoque 93/43 (versões 14/11), carteira/lotes 310, lifetimeEarn 809, nenhum movimento de fidelidade e duas outboxes concluídas em uma tentativa. Nenhum inbox do #7 observado. Não executar novas rodadas para este pedido nem reenviar a solicitação. Este fechamento não comprova replay deliberado, consumo de webhook, todas as telas de recuperação/checkout, expiração, pagamento tardio ou estorno de boleto. Main e banco de origem intactos; nenhuma nova operação financeira realizada pelo assistente. Evidências no roteiro da seção 31; atualização documental local, sem publicação ou novo aceite de produção.

## 33. Preparação de vencimento e expiração de boleto — 15/10/2026

Operador autorizou iniciar o cenário após fechar o cancelamento do #7. Preparado [roteiro de expiração de boleto](../../../../../../PACOTE_REVISAO_VANDERLEI/L-04-ROTEIRO_EXPIRACAO_BOLETO.md). `origin/main` atualizado por fetch e consultado em `7f9b26e`: D+1/piso R$ 5 preservados; serviço de dias úteis idêntico, sem calendário de feriados. Homologação congela tolerância de confirmação de 72 horas corridas após o limite externo. Não antecipar vencimentos ou editar prazos no banco compartilhado.

Baseline READ ONLY/REPEATABLE READ às **14:27:16 UTC (11:27:16 BRT)**: configuração v5 com boleto/retirada habilitados, produto/variante R$ 49,90 e estoque **93/43**, versões **14/11**, indisponíveis zero; carteira/lotes **310**, lifetimeEarn **809**, pendentes/dívida zero. Só #6 PAID e #7 CANCELLED entre os boletos do cliente; nenhum pendente. Nova emissão ainda não identificada, sem presumir #8.

**Configuração efetiva informada pelo operador: PAYMENT_EXPIRATION_ENABLED=false no Preview.** Nesse estado, a etapa de expiração é dryRun e não cria CANCEL por prazo. Podemos emitir e acompanhar o novo boleto, mas antes do processamento efetivo é necessário conferir candidatos/consumidores, habilitar a variável somente no Preview e fazer redeploy. A supervisão -StatusOnly não expõe esse sinalizador. Nenhuma configuração alterada nesta preparação.

Próximo passo: revisão de nova compra com uma unidade Pequeno/Vermelho, BOLETO/PICKUP, sem resgate, total R$ 49,90, previsão de 24 pontos sem crédito antecipado. Emitir uma vez após conferência, identificar alvo real e manter sem pagamento/cancelamento manual. Se vencer em **16/10**, o limite externo esperado é **17/10 às 00:00 BRT**, e a reserva só fica elegível à expiração em **20/10 às 00:00 BRT**. Esses horários dependem dos dados efetivamente persistidos na nova tentativa e do vencimento confirmado pelo provedor.

Vencimento não libera estoque sozinho. Após tolerância, o serviço reinspeciona o provedor e, se continuar pendente, cria CANCEL durável com auditoria ORDER_TIMEOUT/PAYMENT_EXPIRATION_REQUESTED; a unidade só volta após evidência definitiva. Reconciliação precede expiração na rodada, portanto o despacho de uma operação recém-criada pode exigir outra rodada controlada. Distinguir teste do serviço de expiração de validação de scheduler automático. Estado inicial desta preparação: roteiro preparado, sem novo aceite de produção, publicação ou mutação financeira pelo assistente.

**Emissão identificada — #8:** operador confirmou a proposta e enviou tela aguardando pagamento, R$ 49,90, BOLETO/PICKUP, vencimento 16/10/2026. Leitura somente leitura às **14:37:51 UTC**: pedido `a7f348d4-7a75-41c1-a309-3b750b1a896e` PENDING v0, tentativa `115916a2-ea28-4b74-8fb9-6f46ed4aa219` PENDING v1, cobrança `pay_9czuud2frrqpzov4` PENDING/sandbox-hml, paidAt nulo. Uma reserva RESERVED, estoque **92/42** (versões 15/12), carteira/lotes **310**, lifetimeEarn **809**, sem movimentos de fidelidade, operações, fatos ou histórico; CHECKOUT_COMMITTED READY. PDF/detalhe remoto não apresentados nesta conferência.

**Cronograma confirmado nos dados persistidos:** `externalExpiresAt=2026-10-17T03:00:00Z` (**17/10 às 00:00 BRT**) e `reservationExpiresAt=2026-10-20T03:00:00Z` (**20/10 às 00:00 BRT**), política congelada de 72 horas. Preparado diagnóstico específico `L-04-DIAGNOSTICAR_EXPIRACAO_BOLETO_PEDIDO_8.sql`, validado em leitura às 14:38:39 UTC, com auditoria da origem automática e proteção dos #6/#7. Aguardar marcos reais: conferir a apresentação/reserva após o primeiro limite e processar expiração após o segundo, com habilitação do Preview conforme acima. Nenhuma rodada adicional necessária agora para este ensaio; boleto deve permanecer sem pagamento e sem cancelamento manual. Teste de expiração ainda não concluído, sem scheduler ou execução à meia-noite prometidos.

**Atualização de configuração informada pelo operador:** após essa preparação, informou ter habilitado `PAYMENT_EXPIRATION_ENABLED` e concluído o redeploy do Preview. Considerar a declaração de true como evidência operacional informada, não como consulta independente do deployment. Os prazos do #8 permanecem inalterados; habilitação não comprova execução recorrente automática.

## 34. Prioridades durante a espera do boleto — 15/10/2026

O operador reforçou a necessidade de finalizar em 48 horas. Isso não apaga o prazo original histórico nem comprova gates. Uma janela de 48h iniciada em 15/10 termina em 17/10; o ensaio remoto de expiração do #8 só fica elegível em 20/10. Portanto, o escopo integral com essa prova remota não cabe nessa janela sem revisão explícita de prazo/aceite. Nenhuma redução do escopo obrigatório foi autorizada. Testes acelerados isolados não devem ser apresentados como execução remota concluída.

Consulta à branch remota nesta revisão: `origin/homologacao_teste` em `2c9d75f`, sem commits à frente/atrás do HEAD local. Documentos e novos scripts dos últimos ensaios permanecem locais; publicação não foi realizada nesta revisão. As entregas de Vanderlei já comprovadas nas seções 23/26 devem ser reaproveitadas; trabalho ainda não publicado não foi inferido como ausente.

| Ordem / janela proposta | Frente e responsável | Entrega concreta possível sem aguardar o #8 |
|---|---|---|
| 1 — Concluído em 15/10 às 13:31 BRT | Leno: reversão integral de crédito parcelado | #4 aprovado no Sandbox: 12 parcelas/R$ 360,72, seis unidades devolvidas e 149 pontos revertidos uma vez; 12 webhooks concluídos sem duplicação. Evidências na seção 35. Não repetir o comando. |
| 2 — Primeiro dia | Leno: expiração, pagamento tardio e efeitos únicos em ambiente isolado | Reutilizar suítes existentes com banco descartável e transporte simulado; conferir cobertura de boleto dentro/fora da tolerância, pagamento concorrente, eventos duplicados/fora de ordem e não duplicação de estoque/pontos. Corrigir lacunas reais e registrar limites, sem reexecutar indiscriminadamente testes aprovados do mesmo código. |
| 3 — Primeiro dia, dependências externas em paralelo | Leno: débito e devolução de boleto pago | Consolidar resposta Asaas quando disponível e especificar o contrato de implementação/recuperação. Nenhuma implementação de débito na main; REFUND de boleto bloqueado no comando atual. Não liberar métodos sem contrato/prova. Preparação de interface pode avançar, com capacidade bloqueada. |
| 4 — Primeiro dia | Leno + revisão de Vanderlei: dados de produção | Destino informado: banco já configurado na main. Auditar compatibilidade e registros existentes, conferir estoque físico e preparar migrations/backup/restore em cópia isolada. Não escrever na origem nem carregar vendas, pontos ou estoque fictício como produção. Seção 36. |
| 5 — Primeiro dia, em paralelo | Vanderlei + revisão de Leno: destino e executor | Concluir as evidências ainda abertas de Cloud Run, domínio/TLS, secrets, e-mail/Storage, cadência, recuperação e alertas. Manifestos preparados não equivalem a recursos ativos. Comprovar progresso sem Console/PowerShell manual e preservar o #8. |
| 6 — Segundo dia | Ambos: candidato e aceites | Consolidar commit/schema/configuração, revisar entregas, executar somente a regressão afetada e smoke integrado, conferir Admin/variantes/frete/expedição/mobile no candidato, consolidar resultados e bloqueios. Publicação final e abertura dependem de gates comprovados. |

Prioridade prática da próxima sessão financeira: conferir a cobertura existente de expiração, pagamento tardio e efeitos únicos em ambiente isolado, corrigindo somente lacunas reais; não repetir os casos encerrados #4/#5/#6/#7. O #3 permanece em revisão própria; o #8 permanece intacto aguardando os marcos reais. Em paralelo, tratar a resposta de débito e o fluxo de devolução de boleto como riscos críticos de prazo, não como tarefas já resolvidas. O plano propõe trabalho simultâneo entre os responsáveis humanos; não envia mensagens nem delega automaticamente tarefas a agentes.

Resultado buscado nas 48h: candidato com o máximo de frentes concluídas e evidências consolidadas, mais bloqueios restantes identificados por dono e condição de fechamento. Não prometer entrega comercial integral enquanto débito, devoluções, operação/dados ou aceite temporal obrigatório continuarem sem prova.

## 35. Estorno parcelado #4 — concluído em 15/10/2026

Operador confirmou que as seis unidades permanecem na loja e reforçou que a compra é fictícia, no ambiente de testes. Preparados `PACOTE_REVISAO_VANDERLEI/L-04-ROTEIRO_ESTORNO_PARCELADO_PEDIDO_4.md` e `L-04-CONFERIR_PARCELAMENTO_PEDIDO_4.ps1` (somente GET no Sandbox, sem dados pessoais/credenciais no resultado).

Baseline somente leitura às 15:02 UTC: pedido #4 PAID v1, 12 parcelas CONFIRMED de R$ 30,06, total financeiro R$ 360,72; tentativa APPROVED v17 e contrato `cb6d68ce-0b2a-4e10-ab36-8edc15cbdff4`. Complemento às 15:06:48 UTC: nenhuma operação existente, carteira 310, déficit 0, lifetimeEarn 809; ganho original 149 com 85 remanescentes no lote. Estoque 92/42 inclui a reserva do #8. Expectativas condicionadas à ausência de novos movimentos: estoque 98/48, carteira 161, déficit 0 e lifetimeEarn 660 após compensação integral única.

Complemento da auditoria dos lotes: além dos 85 no lote original, há 64 em lote descendente restituído, totalizando os 149 disponíveis para reversão. Não interpretar a diferença do lote original como déficit atual. Script validado em oito casos simulados, sem rede.

**Conferência remota apresentada pelo operador às 15:12:27 UTC:** HTTP 200, 12 parcelas identificadas no contrato, todas CONFIRMED, `deleted=false`, soma R$ 360,72. Histórico de estorno ausente na listagem (`refundCountInList=null`), portanto ainda inconclusivo. Acrescentada opção `-RefundHistory` ao script para leitura pontual dos 12 históricos após revalidar a identidade; 15 casos simulados aprovados sem rede. Nenhum comando REFUND, execução de filas ou publicação nesta conferência.

**Retorno da consulta de históricos:** HTTP 200, `LOOKUP_UNRESOLVED` na parcela 1, zero históricos validados. Corrigida lacuna do script em relação ao parser existente (`9d07510`): aceitar página `data=null` somente com metadados explícitos de lista vazia. Diagnóstico v2 acrescenta etapa/motivo/metadados sanitizados e paginação explícita; 23 casos simulados aprovados no PowerShell 5.1. Causa remota ainda depende do novo resultado; não concluir histórico vazio a partir do HTTP 200. Ensaio permanece em preparação, sem estorno disparado.

**Reteste remoto às 15:22:57 UTC (12:22:57 BRT):** operador apresentou `INSTALLMENT_REFUND_HISTORIES_EMPTY`, 12/12 históricos completos com `EXPLICIT_EMPTY_PAGE`, nenhum registro de estorno, todas as parcelas CONFIRMED e não excluídas, total R$ 360,72. Baseline remoto concluído; nenhuma solicitação/processamento efetuado pelo diagnóstico.

**Adaptação local concluída:** crédito parcelado passa a solicitar estorno integral por uma única chamada ao contrato Asaas, sem `value`, mantendo acompanhamento por parcela. Submissão das operações marcada atomicamente antes do POST, sem reenvio após timeout/resultado inconclusivo. Lote legado parcialmente submetido exige revisão, sem fallback por parcela. Compensação comercial permanece condicionada à conclusão integral; crédito 1x/PIX preservados. Não exige migration.

Validação: 55 testes de integração em PostgreSQL descartável e transporte simulado, 42 unitários, TypeScript e ESLint aprovados. Não comprova execução remota do estorno. Próxima ação: publicar a correção na homologação e conferir o deployment antes de preparar/executar o comando do #4; a implementação publicada anteriormente ainda usa chamadas individuais. Nenhum estorno foi solicitado. #8 preservado, main/banco principal intactos; alterações ainda locais, sem publicação.

**Atualização posterior — publicação e aceite do comando:** commit `c210f28` publicado exclusivamente em `homologacao_teste`, Vercel confirmou deployment concluído às 15:33:14 UTC. Operador recebeu HTTP 202/REFUND_REQUEST_ACCEPTED para `l04-card-refund-pedido4-ae14cb17-v1`, replay=false, 12 operações READY. Leitura às 15:35:29 UTC confirmou os registros, uma identidade de comando, nenhuma submissão/erro: tentativa REFUND_PENDING v18, pedido PAID v1 e 12 parcelas CONFIRMED. Estoque 92/42, reserva COMMITTED de seis unidades, carteira 310, déficit 0 e lifetimeEarn 809 intactos; #8 PENDING/reserva RESERVED preservado. Próxima ação: uma rodada do executor do Preview e conferência específica do #4. Solicitação durável aceita não comprova estorno remoto; não repetir REFUND. Esta atualização documental é local, posterior à publicação.

**Após a primeira rodada:** contadores globais de reconciliação/outbox 1 concluído cada. Leitura às 15:40:24 UTC: #4 permanece PAID v1/REFUND_PENDING v18, 12 operações READY sem submissão, estoque 92/42 e carteira 310 preservados. #8 teve reconciliação recente e segue PENDING. Fila por reconcileAfter ainda tem a revisão histórica do PIX #3 antes do #4. Orientada nova rodada única com conferência posterior; teste do estorno parcelado ainda não concluído.

**Após a segunda rodada:** reconciliação 1 em review. Leitura às 15:44:27 UTC confirmou que a revisão pertence ao PIX #3 (`PAYMENT_REFUND_CANCELLED_REVIEW`, atualizado às 15:43:55 UTC, reagendado para 16:43:53 UTC). #4 continua sem erro, 12 operações READY não submetidas, PAID v1/REFUND_PENDING v18; estoque e pontos intactos. #4 precede #8 na fila consultada. Próxima ação: outra rodada única e conferência do alvo, sem reenviar REFUND. O resultado não indica falha do estorno parcelado nem comprova sua execução.

**Estorno parcelado conciliado — 15:48:54 UTC:** após nova rodada concluída, #4 CANCELLED v2, tentativa REFUNDED v20 sem erro, 12 operações COMPLETED e 12 parcelas/fatos REFUNDED somando R$ 360,72. Reserva RETURNED de seis; estoque 98/48 (versões 16/13). REFUND_EARN único de −149, carteira 161, déficit 0, lifetimeEarn 660. ORDER_STATUS_CHANGED concluído, #8 preservado. Chegaram 12 webhooks PAYMENT_REFUNDED ainda READY. Próximos passos: diagnóstico remoto final somente leitura, consumo controlado dos eventos e prova de estabilidade. Compensações locais conferidas; ensaio completo ainda não encerrado. Não repetir a solicitação de estorno.

**Prova remota final — 15:50:33 UTC:** operador apresentou 12 parcelas REFUNDED, cada histórico completo com um DONE de R$ 30,06, total R$ 360,72. Estorno integral comprovado no Sandbox. Às 15:51:20 UTC, pedido/estoque/pontos/fatos permaneciam estáveis, mas 12 webhooks ainda READY. Script local agora aceita `-Limit 5`, dentro do contrato já publicado da API; cinco simulações aprovadas, sem rede. Próximo passo: uma rodada com esse limite e conferir consumo/estabilidade, sem nova solicitação REFUND. Encerramento do ensaio aguarda os eventos; demais gates de produção não são liberados por este resultado.

**Primeiro lote de webhooks — 16:26:11 UTC:** confirmados 5 PAYMENT_REFUNDED COMPLETED e 7 READY do #4. Pedido CANCELLED v2, estoque 98/48/versões 16/13, carteira 161, déficit 0, lifetimeEarn 660, 12 fatos de estorno/R$ 360,72 e mesmo REFUND_EARN único de −149 preservados; #8 intacto. Não houve duplicação dos efeitos após esses cinco eventos. Orientada outra rodada única `-Limit 5` e nova conferência; sete eventos ainda pendentes.

**Segundo lote — 16:29:34 UTC:** 10 PAYMENT_REFUNDED COMPLETED e 2 READY do #4. Pedido/estoque/versões/carteira/fatos e o mesmo REFUND_EARN único permanecem estáveis; #8 preservado. Orientada uma rodada `-Limit 2` e conferência final. Estorno remoto comprovado; encerramento do ensaio aguarda esses dois eventos.

**Fechamento do cenário — 16:31:45 UTC (13:31:45 BRT):** após inbox 2/2 concluído, leitura somente leitura confirmou os 12 PAYMENT_REFUNDED COMPLETED, nenhuma pendência de inbox do estorno, quatro tarefas de outbox do pedido COMPLETED e 12 operações concluídas sem erro. #4 CANCELLED v2, tentativa/cobranças REFUNDED, 12 fatos/R$ 360,72 e uma transição de cancelamento. Estoque 98/48 (versões 16/13), reserva RETURNED de seis, carteira/lotes 161, déficit/pendente zero, lifetimeEarn 660 e mesmo REFUND_EARN único de −149 preservados. #8 intacto. **Estorno integral parcelado aprovado no Sandbox, com estabilidade após todos os eventos naturais.** Não exige novas rodadas para #4. Isso não representa replay financeiro deliberado, aceite de produção ou fechamento dos demais gates. Registro local posterior à publicação `c210f28`.


## 36. Destino existente de produção e pendência temporal aceita — 15/10/2026

O operador esclareceu que o banco de produção já está conectado/configurado no projeto da main. Essa definição substitui a proposta anterior de criar outra base e as pendências históricas de escolha do banco. Preservar a separação em relação à homologação. **Main e seu banco continuam somente leitura; não houve autorização de escrita na origem.**

Conferência realizada às **18:35:25 UTC (15:35:25 BRT)**, referência origin/main `7f9b26e062ec2654420fecffb6dd78ad3ba1e017` e homologação `8632514`:

- Schema da main utiliza DATABASE_URL/DIRECT_URL. A configuração local .env corresponde ao endpoint de origem já fixado nos scripts de auditoria; .env.local corresponde ao endpoint distinto de homologação. Valores de conexão não foram publicados. Isso verifica as conexões locais e a origem conhecida; não representa consulta das variáveis efetivas de um deployment externo.
- Transação READ ONLY/REPEATABLE READ, com verificação de transaction_read_only=on, host/base e identidade da loja. Encontrados **522 produtos e 24 pedidos** da loja de origem. Contagem não classifica esses pedidos como reais ou fictícios.
- **13 migrações presentes na homologação não estão registradas como aplicadas** na origem. A consulta do schema também confirmou ausência de Product.inventoryVersion e das tabelas PaymentAttempt, PaymentOperation e InventoryReservation. Banco configurado para a versão antiga não equivale a compatibilidade com a versão nova.
- Nenhuma migration, importação, alteração de estoque, limpeza, cobrança ou processamento foi executado. Não foram consultados dados pessoais dos pedidos nem exibidas credenciais.

**Próxima frente de Leno:** inventariar dependências das 13 migrações e classificar vínculos/obrigações existentes por consulta somente leitura; preparar uma cópia isolada e o ensaio de atualização/restauração, com comparação antes/depois. Reutilizar catálogo e configurações comprovados, sem recarga indiscriminada. O levantamento deve determinar o tratamento necessário dos dados e o estoque comercial de abertura. A execução futura na origem exige autorização específica e não decorre desta definição do destino.

**Decisão sobre o boleto:** o operador aceita publicar produção mesmo que o teste de expiração ainda não tenha terminado; será concluído após a abertura, ou antes se o projeto se prolongar até lá. O #8 continua com elegibilidade em **20/10/2026 às 00:00 BRT**, sem antecipar relógio/prazos ou cancelar manualmente. A exigência histórica de aguardar essa prova para abrir foi alterada; conservar o cenário como **pendente, com conclusão posterior aceita pelo operador**, nunca aprovado por inferência. A alteração se refere ao teste de expiração em discussão; não comprova implementação de débito, devolução de boleto pago ou encerramento dos demais critérios financeiros/operacionais.

Registro documental local na homologação. Nenhuma publicação de produção, alteração da main ou nova operação financeira ocorreu nesta conferência.

## 37. Preparação da atualização do banco existente — ensaio de 15/10/2026

### Escopo e fontes reaproveitadas

Operador autorizou iniciar a preparação descrita: auditoria somente leitura e ensaio isolado, preservando a restrição de escrita na main. Base principal `7f9b26e062ec2654420fecffb6dd78ad3ba1e017`, candidato de homologação `8632514f03bded8ca0143f0ac053fa8ceadade30`. Nenhuma migration foi criada ou modificada nesta rodada.

Reutilizados o `BACKUP-RESTORE-RUNBOOK.md` de origin/main, `scripts/verify-restored-clone.mjs`, `scripts/lib/legacy-commerce-audit.mjs`, o provisionador PostgreSQL descartável e as suítes de integração existentes. O executor original carrega variáveis Next; nesta execução a conexão de origem foi lida explicitamente de `.env`, conferida contra host/base conhecidos e fixada em memória antes da importação do executor. **Não executar `--capture-source` com resolução implícita de ambiente:** `.env.local` aponta para homologação. Não há autorização para migrations remotas ou limpeza da origem.

Evidências compartilháveis, com agregados e sem credenciais/dados pessoais:

- [Auditoria somente leitura da origem](../../../../../../trabalho_em_dupla/evidencias/L-BANCO-PREPARACAO-2026-10-15.json), às 18:45:06 UTC.
- [Resultado do backup, restauração, upgrade e regressões](../../../../../../trabalho_em_dupla/evidencias/L-BANCO-ENSAIO-2026-10-15.json).

### Resultado da auditoria e tratamento necessário

| Recorte | Evidência atual | Consequência para a abertura |
|---|---|---|
| Catálogo | 522 produtos, 528 variantes, 18 marcas, 10 categorias; zero produtos sem variante e zero grupos de combinações normalizadas duplicadas no clone. | Reutilizar a base; não recarregar indiscriminadamente nem substituir IDs. |
| Estoque | Quatro produtos com saldo geral diferente da soma das variantes. | Conciliar com estoque físico e vínculos; não escolher automaticamente um dos saldos. |
| Pedidos antigos | 24: dez PENDING, quatro PAID, dez CANCELLED; 33 itens sem vínculo de variante e 24 pedidos sem histórico. | Preservar os registros. Identificar quais são testes e se existe obrigação comercial antes de decidir tratamento; a declaração histórica de dados de teste não autoriza exclusão. |
| Pagamentos antigos | Duas referências remotas; quatro pedidos pagos sem fatos financeiros no novo modelo; nenhum protocolo/reserva histórica fabricado pelo upgrade. | Consultar procedência/ambiente das referências quando necessário; não disparar cobranças, estornos ou fabricar fatos retroativos. URLs de fatura não identificaram ambiente nesta auditoria. |
| Fidelidade antiga | Duas carteiras, dois movimentos, saldo agregado 475, nenhum saldo negativo. | Saldo preservado, mas `accountingReady=false`; ganho/resgate dessas carteiras exige conciliação. Não zerar ou ativar só para liberar compra. |
| Entrega antiga | Dezesseis pedidos de entrega sem snapshot autoritativo de frete. | Preservar leitura histórica; não inventar uma cotação retroativa. |
| Carrinhos e vínculos | Três carrinhos, um item; zero duplicatas ACTIVE por proprietário e zero violações de ownership/proveniência nos recortes auditados. | Backfill de loja derivado dos vínculos reais passou no clone, sem transferir propriedade. |
| Histórico de migrations | Vinte nomes anteriores, com dois registros concluídos por nome; checksums compatíveis e nenhum rollback registrado. Treze nomes novos pendentes. | Duplicidade histórica preservada. Não reescrever `_prisma_migrations`; o deploy no clone reconheceu as anteriores e aplicou somente as pendentes. |

As contagens de lacunas se sobrepõem; não somá-las como entidades distintas. `integrityPassed=true` no classificador confirma as verificações estruturais/proveniência codificadas, mas `requiresReconciliation=true` e `productionReady=false` permanecem. Não representa prova de estoque físico, titularidade comercial dos saldos ou liberação do catálogo inteiro.

### Revisão das 13 migrações, na ordem versionada

| Migração | Alteração principal e cuidado de implantação |
|---|---|
| `20261003000000_complete_runtime_schema` | Completa objetos de catálogo/logística, índices e FKs. Conversão monetária recusa precisão incompatível; usa locks exclusivos. Não arredonda silenciosamente histórico. |
| `20261004000000_commerce_contracts_expansion` | Cria estruturas de intenção, tentativa, cobrança, fatos, reserva, lotes, inbox/outbox e versões de estoque. Estruturas novas não reconstroem fatos antigos. |
| `20261005000000_purchase_tenant_scope` | Preenche loja de carrinho/item pelos vínculos de usuário e carrinho; recusa ownership inconsistente antes da alteração e fortalece FKs. |
| `20261005010000_separate_guest_buyer` | Permite comprador convidado, exigindo usuário ou comprador identificado no pedido; não inventa compradores históricos. |
| `20261005020000_order_command_receipts` | Adiciona hash/versão ao histórico de comandos e unicidade por versão; registros antigos permanecem sem recibos fabricados. |
| `20261005030000_catalog_revision` | Adiciona versão de catálogo com restrição não negativa. |
| `20261005040000_cart_active_uniqueness` | Recusa múltiplos carrinhos ativos do mesmo proprietário; não mescla/apaga carrinhos. Lock exclusivo e índice parcial. |
| `20261005050000_loyalty_lot_accounting` | Acrescenta origem/efeitos e proteção de expiração. Carteiras antigas ficam não conciliadas; não infere lotes, validade ou dívida. |
| `20261005060000_password_reset_lookup` | Índice de recuperação por loja/token; não transforma tokens antigos em novos links válidos. |
| `20261005070000_freight_authority` | Revisões, triggers e snapshots de frete; inicializa apenas a revisão tarifária. Geografia/cotações antigas não são presumidas. |
| `20261005080000_payment_plan_authority` | Planos financeiros e política versionada; novos controles de métodos nas lojas começam desabilitados. Habilitação real é configuração posterior, não parte automática do upgrade. |
| `20261005090000_checkout_intent_authority` | Carrinho convidado, fonte de intenção e triggers de completude/imutabilidade/proveniência; não cria reservas para vendas antigas. |
| `20261005100000_durable_payment_execution` | Leases, escopo de conta, operações e proteção contra reenvio/fatos inconsistentes. Não cria acompanhamento financeiro para referências legadas. |

Há alterações com locks e migrações sem bloco transacional próprio explícito; o sucesso no clone não elimina risco de concorrência ou falha durante a aplicação real. Não executar junto a escritores antigos, nem resolver falhas marcando migrações aplicadas sem auditoria.

### Backup, restauração e preservação comprovados

Captura/ensaio `9343e285df85d60fdcfb1ba15daade73`, **18:43:55–18:44:53 UTC**, cerca de **57,7 s** no ambiente local. Conexão de captura usou `default_transaction_read_only=on`, timeout e catálogo/versionamento conferidos. Backup do schema public em formato restaurável, criptografia AES-256-GCM, chave DPAPI do usuário Windows e diretório com ACL restrita. Localizador privado: `%LOCALAPPDATA%\logic-audit-backups\9343e285df85d60fdcfb1ba15daade73`; arquivos brutos e diagnósticos privados não entram no Git.

- Duas restaurações independentes do backup persistido, conferindo fingerprints e sequências, aprovadas.
- Dados pessoais, sessões, credenciais e referências de integrações sanitizados **somente no clone**; comparação das demais colunas confirmou preservação. Novo backup sanitizado restaurado e conferido.
- Checksums do histórico conferidos contra os artefatos versionados; 13 migrações aplicadas na cópia em aproximadamente **3,7 s**. Segunda chamada de deploy sem novas migrações.
- Diff final vazio em relação ao schema atual, constraints/triggers verificados, valores/vínculos/IDs e sequências preservados. Nenhuma carteira legada ativada, plano/reserva/fato financeiro histórico fabricado ou método habilitado.
- Segunda execução `953902a2457b0d0fbf013392b2dfe20e`, **18:45:20–18:46:12 UTC**, reutilizou o mesmo backup sem nova conexão com a origem; inventário de legados somente leitura aprovado e pendências classificadas. Essa segunda duração não é medição independente de captura remota.
- Containers do ensaio foram descartados pelos próprios executores após verificar a identidade; backup protegido retido. Nenhum envio de e-mail, chamada Asaas ou processamento externo foi iniciado.

Limites: backup cobre schema public, não roles/grants/ACL do provedor, Storage, DNS ou secrets externos. DPAPI comprova recuperação nesta conta Windows, não recuperação em outra máquina ou acesso de Vanderlei; ainda é necessário definir cópia de recuperação e acesso operacional adequados. Tempos locais não equivalem a janela de indisponibilidade, RTO/RPO ou execução sob carga no banco principal. Não houve teste HTTP da aplicação sobre o clone restaurado nesta rodada.

### Regressão da aplicação executada separadamente

Servidor Next isolado e PostgreSQL 16 descartável com fixtures sintéticas, identidade/sentinela conferidas, run `253964551a91f4740663fd73c50748fa`. **37 testes aprovados em três suítes:** `legacy-commerce-compatibility` (6), `inventory-admin-integrity` (14), `loyalty-lot-accounting` (17), duração Vitest 20,77 s. Não confundir essa base sintética com o clone restaurado PostgreSQL 18.

Comprovados nos casos das suítes: leitura autorizada de pedido legado, recusa de aprovação/cancelamento inseguro, expiração sem prazo não inferida, vínculos/estoque preservados, concorrência e rollback de ajuste, lotes/déficit/expiração e efeitos únicos. Erros de constraints exibidos durante os casos negativos eram esperados; três suítes encerraram aprovadas. Limpeza do servidor/containers concluída, sem containers com label de ensaio remanescentes na conferência final.

### Procedimento preparado e próximo trabalho

1. **Agora, sem escrita na origem:** revisar a classificação dos 24 pedidos, duas referências e duas carteiras; preparar a resolução das quatro divergências de estoque com inventário físico. Usar os registros existentes e a declaração do operador, sem inventar obrigações ou apagar testes automaticamente.
2. **Ainda em ambiente isolado:** definir e ensaiar o tratamento aprovado dos legados, validar a aplicação com o clone sanitizado e conferir comportamento das integrações com transporte controlado. A atualização estrutural já foi ensaiada; não precisa recomeçar do zero sem mudança relevante.
3. **Preparação de Vanderlei:** revisar o procedimento, permissões/roles e política de recuperação externa, identificar artefato/configuração e como suspender novas compras/escritores antigos preservando recebimentos e obrigações. Não usar `PAYMENT_WORKER_ENABLED=false` como contenção geral.
4. **Somente em futura etapa de implantação autorizada:** reauditar origem, comparar schema/checksums/dados ao baseline, conferir recursos de recuperação e janela, bloquear escritores concorrentes conforme procedimento aprovado e aplicar o conjunto revisado. Interromper em divergência, timeout ou migration falha; não resetar, limpar tabelas ou marcar histórico por conveniência.
5. **Antes de abrir vendas:** conferir schema, contagens, estoque/pontos, legados e métodos efetivamente habilitados; testar a versão/configuração final, webhooks e executor no destino. A ativação dos métodos não é fornecida pelo default das migrações.
6. **Recuperação:** restauração foi comprovada em destinos vazios isolados. Se houver falha real, preservar os registros e inspecionar a etapa atingida; recuperação/troca de conexão depende do procedimento aprovado e da conciliação de eventos externos. Não restaurar cegamente um snapshot antigo depois de novas vendas.

**Resultado desta etapa:** preparação estrutural e recuperação local comprovadas; tratamento dos dados, recuperação operacional externa e aceite comercial continuam abertos. Main, seu banco e o banco de homologação não receberam escrita. Documentação e evidências atualizadas localmente, sem commit/push nesta rodada.

## 38. Aplicação no clone e proposta de tratamento dos legados — 15/10/2026

Continuação autorizada pelo operador. Reutilizado exclusivamente o backup protegido capturado às **18:43:55 UTC**, referente à origem auditada com `origin/main` em `7f9b26e062ec2654420fecffb6dd78ad3ba1e017`. Código da aplicação em `8632514f03bded8ca0143f0ac053fa8ceadade30`, mais ferramentas locais de ensaio. **Não houve nova conexão à origem nesta continuação**, nem escrita em main ou no banco compartilhado de homologação. Os resultados representam o snapshot, não uma nova observação do banco vivo.

### Compatibilidade de leitura comprovada

Ensaio `d59ddc9146f41a8239891d04d902019b`: servidor Next real, iniciado em projeto isolado sem arquivos `.env` da origem; PostgreSQL 18 restaurado, sanitizado e atualizado. Verificações HTTP entre **18:57:20 e 18:57:43 UTC**:

- Identidade do servidor/banco descartável conferida antes das consultas.
- Catálogo paginado: **522 produtos distintos**, com loja, variantes e versão de estoque presentes.
- Leitura autenticada dos **24 pedidos antigos**, conferindo identidade, status, total e quantidade de itens.
- Pedido sem sessão recusado com HTTP 401; domínio de loja inexistente recusado com HTTP 404.
- **Duas carteiras** consultadas, saldos preservados e `accountingReady=false`.
- Lista de métodos disponíveis vazia, conforme isolamento configurado; isso não comprova configuração comercial final.
- Comparação de todas as tabelas da aplicação antes/depois aprovada. Sessões temporárias de ensaio inseridas somente no clone e removidas antes da comparação; conexão da aplicação com transações somente leitura por padrão.

Esta prova complementa os 37 testes sintéticos da seção 37 e supera sua pendência específica de leitura HTTP sobre o clone restaurado. Não cobre compra com escrita, integração externa, navegação visual ou carga de produção. Evidência: [L-BANCO-APLICACAO-CLONE-2026-10-15.json](../../../../../../trabalho_em_dupla/evidencias/L-BANCO-APLICACAO-CLONE-2026-10-15.json).

### Classificação e tratamento proposto

Segunda execução `59a5f7d954fbdfd2b4e2751e50991291`, **18:59:51–19:00:41 UTC**, restaurou novamente o mesmo backup e auditou os legados em transação somente leitura. A classificação utiliza a normalização de `lib/product-variants.ts`; dimensão histórica ausente permanece desconhecida. Variantes sem estoque ou retiradas podem ser candidatas históricas, sem serem liberadas para compra.

| Recorte confirmado | Tratamento proposto para preparar a abertura |
|---|---|
| 16 dos 33 itens não têm produto vinculado. | Preservar os snapshots existentes. Não recriar produto nem localizar por nome como se isso comprovasse a identidade original. |
| 16 itens têm dimensões preenchidas e uma única variante atual compatível. | Manter como candidatos para revisão. Não preencher automaticamente o vínculo nem gerar reserva/devolução: correspondência atual não comprova movimento histórico. |
| Um item tem dimensões incompletas e apenas uma candidata atual. | Preservar a ausência; uma variante atual única não prova a escolha antiga. |
| 24 pedidos antigos; dez pendentes, quatro pagos e dez cancelados. | Reaproveitar a declaração do operador de 12/10 de que a base contém dados de teste. Proposta: preservar como histórico legado, sem transformá-los em vendas novas, cancelá-los remotamente ou executar compensações. Arquivamento/exclusão não foi aplicado nem implementado por este ensaio. |
| Duas referências remotas antigas. | Manter fora da automação financeira nova. Não converter a referência em cobrança de produção sem prova de ambiente/procedência; nenhum contato com o provedor ocorreu nesta etapa. |
| Carteira vazia: saldo 0, zero movimentos e zero lotes. | Candidata a inicialização controlada, após revisão das regras de abertura; não foi ativada nesta etapa. |
| Outra carteira: saldo 475, soma de dois movimentos 475, zero lotes. | Aritmética confere, mas faltam origem/validade dos lotes. Não carregar pontos de teste como saldo comercial nem fabricar lotes. Preparar separação do histórico de teste e abertura sem transportar esse saldo, com escopo explícito e ensaio prévio. Nenhum saldo foi zerado. |

As categorias de itens somam 33; não houve candidatos múltiplos nem produto preenchido sem variante compatível. As lacunas de pedidos, pagamentos e fidelidade se sobrepõem. A concordância numérica dos pontos não equivale à conciliação contábil do novo modelo.

### Estoque: quatro casos que exigem definição de abertura

| Produto existente | Saldo do produto | Soma das variantes | Itens de pedido vinculados ao produto | Itens de carrinho vinculados |
|---|---:|---:|---:|---:|
| Aspirador de Pó | 1 | 10 | 0 | 1 |
| Calça Jeans | 13 | 30 | 7 | 0 |
| Camisa Branca | 16 | 30 | 5 | 0 |
| Camisa Preta | 8 | 30 | 4 | 0 |

Esses valores são observações da base de origem restaurada, **não contagens físicas**. O Aspirador de Pó desta tabela tem ID diferente do Aspirador de Pó automotivo usado nas compras de homologação. **Conferência posterior identificou a mesma imagem vermelha nos dois cadastros, ambos abrangidos pela identificação de produto de teste do operador; ver seção 39.** Preservar a separação entre seus IDs e vínculos. Não substituir o saldo geral pela soma das variantes, escolher o menor valor ou importar estoque dos testes para resolver a diferença.

Para cada produto que realmente será vendido, falta informar o estoque de abertura por variante. **Decisão posterior do operador: esses quatro produtos são testes e devem ficar indisponíveis; ensaio isolado e identificação exata na seção 39.** Os demais 518 produtos não apresentaram essa divergência aritmética, o que por si só também não comprova estoque físico de abertura.

Evidência agregada, sem compradores ou credenciais: [L-BANCO-TRATAMENTO-2026-10-15.json](../../../../../../trabalho_em_dupla/evidencias/L-BANCO-TRATAMENTO-2026-10-15.json).

### Próxima execução e limites

1. Definir o catálogo/estoque real de abertura, começando pelos quatro casos acima. A informação pendente é o saldo real ou a retirada do catálogo comercial; não é necessário perguntar novamente se as compras anteriores eram testes.
2. Concretizar em clone a separação do histórico e dos saldos de teste, com comparação antes/depois e preservação de vínculos. Não existe aprovação implícita para limpar a origem, inicializar carteiras antigas ou excluir pedidos.
3. Ensaiar uma compra nova e seus efeitos no clone tratado com integrações controladas; a rodada atual comprovou leitura, não esse fluxo de escrita.
4. Vanderlei pode avançar no acesso ao backup de recuperação fora desta conta Windows, roles/permissões, configuração final e suspensão coordenada de escritores antigos. A recuperação local já foi demonstrada; a operação no destino ainda precisa ser preparada.

Ferramentas adicionadas ao executor: `--backup-dir <diretório privado> --smoke-app` (inclui auditoria) e classificação detalhada em `--audit-legacy`. Ambas reutilizam backup e exigem clone; não habilitam aplicação na origem. Dois testes das proteções de destino/classificação aprovados. Containers dos ensaios descartados; backup protegido retido. Estado final: **compatibilidade estrutural e leitura da aplicação aprovadas no clone; tratamento comercial dos dados e implantação permanecem pendentes**. Documentação e ferramentas locais, sem commit/push nesta continuação.

## 39. Identificação dos produtos de teste e indisponibilidade para abertura — 15/10/2026

O operador confirmou que Calça Jeans, Camisa Branca, Camisa Preta e **somente o aspirador automotivo de imagem vermelha** são produtos de teste e devem ficar indisponíveis. Os demais aspiradores são comerciais e devem ser preservados. Essa decisão resolve a pergunta de estoque dos quatro produtos de teste da seção 38; não autoriza indisponibilizar todos os produtos com a palavra “aspirador”.

### Identidade conferida nos dois ambientes

Consultas explícitas em transações somente leitura, às **19:12:22–19:12:23 UTC**, nos bancos de main e homologação, conferindo destino antes da conexão. Nenhum segredo reproduzido. O cadastro da origem usa o nome **Aspirador de Pó**, ID `6a6e98eb-98c3-4ba2-aede-a357d43893cf`; o de homologação usa **Aspirador de Pó automotivo**, ID `a26fdbc1-d8c3-4173-b114-f759654b9ca4`. Ambos apontam para a mesma imagem `images__teste_aspirador_1_geqkhm.jpg`, inspecionada visualmente: aspirador portátil vermelho/preto com tomada automotiva. A diferença de nome/ID não indica outro modelo comercial neste caso, mas os registros e seus vínculos continuam distintos.

| Alvo exato no clone da main | ID preservado |
|---|---|
| Aspirador de Pó, imagem vermelha confirmada | `6a6e98eb-98c3-4ba2-aede-a357d43893cf` |
| Calça Jeans | `622731a7-0158-486c-9626-0a739b3ddb91` |
| Camisa Branca, com espaço final no cadastro | `6178ba96-b383-4e50-be1d-93a506912011` |
| Camisa Preta | `fdd4cc6a-c8e4-4a58-b45c-04a6d5c07e13` |

Preservar expressamente os três equipamentos comerciais: **ASPIRADOR KARCHER 3 EM 1WDL 1S 1700W** (`c6b3097f-6174-44f1-86c9-e06aba7c9733`), **ASPIRADOR PÓ E AGUA ECOCLEAN LITE 1200W IPC** (`0486f861-4e39-426a-81ce-8b39f60a177f`) e **LAVADORA EXTRATORA E ASPIRADOR LAVA PRO LITE 1200W IPC** (`5e86739a-6114-4df1-a15a-df88b7a349c3`). Os acessórios BICO FLEXIVEL (`7fd834af-d2be-4ea5-8d30-9790bd48a79e`) e BOCAL BICO EXTRATORA (`bc076f2d-740c-45f3-84c5-9d0fb8657d84`) também permanecem intactos.

### Tratamento delimitado ao clone

Preparado `--backup-dir <diretório privado> --rehearse-test-products` em `scripts/verify-restored-clone.mjs`. Exige restauração/sanitização/upgrade prévios e identidade de container local com label aleatória. A seleção de escrita usa exclusivamente os quatro UUIDs acima, valida loja, nome exato, imagem do aspirador e número de variantes; não usa busca por nome para alterar registros e recusa o ID parecido da homologação.

O ensaio bloqueia linhas de produtos/variantes e marca `retiredAt`, incrementando versões e atualizando timestamps. Preserva os valores de estoque como histórico, sem reconciliá-los artificialmente, apagar variantes, remover itens de carrinho/pedido ou efetuar movimentos financeiros. São quatro produtos e dez variantes. Fingerprints de todas as tabelas excluem da comparação somente os campos deliberadamente alterados desses IDs; todo o restante precisa permanecer idêntico. O servidor isolado deve demonstrar catálogo sem esses quatro produtos e com os três aspiradores comerciais e dois acessórios presentes, mantendo a leitura dos 24 pedidos antigos.

O produto de teste da homologação permanece intacto para os ensaios de pagamento em andamento, inclusive boleto #8; seu estoque não será carga de produção. Main e seu banco continuam estritamente somente leitura. O executor é um **ensaio descartável**, não um comando para aplicar alterações ao destino real. A decisão de indisponibilidade está registrada para a futura implantação, respeitando esse limite vigente.

### Resultado do ensaio

Execução `a5c12771c4fc46f375e960f18d22b304`, **19:15:35–19:17:12 UTC**, aprovada. Quatro produtos e dez variantes indisponíveis no clone; **518 produtos ativos consultados por HTTP**. Ausência dos quatro IDs de teste e presença dos cinco IDs comerciais protegidos conferidas explicitamente. Leitura dos 24 pedidos e duas carteiras preservada; acessos sem sessão/por loja desconhecida recusados. Comparação confirmou estoques, vínculos e demais dados intactos; leitura HTTP posterior também preservou todas as tabelas. Container descartado ao final, backup protegido retido.

Três testes das proteções de destino/identidade/classificação aprovados, lint dos scripts aprovado. Uma tentativa anterior interrompeu antes das mutações por formato multilinha de JSON do cliente SQL; ajustada serialização para JSONB e ensaio refeito com sucesso. Nenhuma tentativa escreveu nos bancos compartilhados. Evidência agregada: [L-BANCO-PRODUTOS-TESTE-2026-10-15.json](../../../../../../trabalho_em_dupla/evidencias/L-BANCO-PRODUTOS-TESTE-2026-10-15.json).

**Próxima pendência de dados:** preparar no clone o tratamento dos saldos de pontos de teste e dos pedidos legados, seguido de compra nova com integrações controladas. Não é mais necessário pedir inventário físico dessas quatro referências retiradas do catálogo comercial. Estoque real dos produtos comerciais, configuração operacional e demais gates mantêm seus próprios critérios. Esta etapa não publicou código nem aplicou alterações ao destino final.

## 40. Abertura das carteiras e convivência com pedidos de teste — 15/10/2026

Continuação autorizada pelo operador, reaproveitando sua declaração de 12/10 de que a base contém dados de teste. Referência principal consultada: `origin/main` em `7f9b26e062ec2654420fecffb6dd78ad3ba1e017`; o modelo antigo já possui `ADMIN_ADJUSTMENT`, carteira única por loja/usuário e histórico de movimentos. A versão candidata `8632514f03bded8ca0143f0ac053fa8ceadade30` acrescenta controle por lotes e recusa operações inseguras sobre pedidos sem protocolo de checkout. Nenhuma dessas estruturas permite tratar uma simples mudança de flag como prova de origem dos 475 pontos antigos.

Preparado `--backup-dir <diretório privado> --rehearse-opening`. Reutiliza o backup auditado de 15/10 às 18:43:55 UTC, sem nova conexão à origem; restaura, sanitiza, aplica migrations, ensaia a indisponibilidade dos quatro produtos e executa a abertura **exclusivamente no clone descartável**. Não adiciona uma migration que limpe dados automaticamente e não aceita execução desse tratamento na main ou em banco compartilhado.

### Tratamento dos pontos de teste

- Bloqueia as carteiras e relê o estado dentro da transação. Exige exatamente duas carteiras com saldos 0/475, dois movimentos antigos cuja soma fecha por titular, zero pendências, zero déficit, ausência de lotes, leases e atividade moderna.
- Preserva os dois movimentos antigos integralmente. Acrescenta dois registros `ADMIN_ADJUSTMENT` identificados: um de **−475** para encerrar o saldo de teste e outro de **0** para registrar a abertura da carteira vazia. Não atribui os ajustes a compra, cancelamento, expiração ou estorno remoto.
- Os ajustes pertencem explicitamente ao segmento histórico de teste, com campos de delta do modelo novo nulos. Não se inventam lotes nem deltas modernos negativos sem origem. O segmento moderno inicia com soma zero, saldo zero, déficit zero e nenhum lote.
- Ambas as carteiras ficam com saldo/pendência/déficit/acumulado de teste zerados e `accountingReady=true` **no clone**. IDs, titularidade e data de criação são mantidos; versões avançam. Valores anteriores completos ficam no registro de política do ajuste e em dois registros de auditoria com identidade de operação.
- A repetição imediata reconhece os registros existentes, sem novo ajuste ou incremento de versão. Estado divergente, novos lotes ou atividade incompatível causam recusa; o procedimento não serve para zerar uma carteira comercial em uso.
- Compara os movimentos originais e todas as demais tabelas durante a transação. Nenhum pedido, item, estoque, configuração de loja ou fato financeiro é alterado pelo tratamento das carteiras.

Esse encerramento usa a classificação explícita de dados de teste; não é regra geral para migrar carteiras de clientes reais. Os identificadores pessoais e os snapshots completos permanecem nos dados/diagnósticos privados do clone e do backup protegido, sem publicação nos relatórios agregados.

### Tratamento dos pedidos antigos

Os **24 pedidos e 33 itens permanecem como histórico**, com IDs, status, valores e vínculos preservados. Não são apagados, marcados como pagos/cancelados, convertidos em checkout moderno ou associados a reservas/fatos financeiros inventados. As duas referências remotas antigas não são transformadas em operações do executor novo.

O teste exercita a recusa de aprovação e cancelamento dos dez pedidos PENDING pelos serviços reais: **20 comandos devem retornar `LEGACY_ORDER_RECONCILIATION_REQUIRED`**, sem reserva, fato financeiro ou tarefa de outbox. A leitura histórica continua disponível. Isso verifica a proteção existente; **não implementa uma tela de arquivo nem retira automaticamente esses pedidos de todas as contagens administrativas**. O classificador continua apontando as lacunas históricas, sem transformar esse histórico em reconciliação financeira aprovada.

### Compra nova e limites do ensaio

A suíte exclusiva `tests/clone/restored-opening.test.ts`, habilitada somente pelo executor do clone, verifica:

1. Conservação das duas carteiras abertas: saldo, lotes e soma dos deltas modernos iguais a zero. Crédito novo de 100 pontos em conta antiga, repetido com a mesma identidade, deve gerar somente 100; a transação de prova é revertida integralmente.
2. Recusa dos 20 comandos sobre pedidos antigos descritos acima.
3. Criação de um cliente sintético e compra nova de um produto comercial existente, pelo serviço real de proposta/checkout. Repetir a compra deve conservar o mesmo pedido e uma única reserva, reduzindo produto e variante uma vez. Confirmação manual controlada repetida deve gerar apenas um crédito de ganho, sustentado por lote e movimento do modelo novo.

A terceira verificação habilita retirada, pagamento manual e ganho de 0,5 ponto por real **somente como configuração de fixture no clone**, com chave/contato fictícios. Não define os meios de pagamento da produção. Chamadas externas são recusadas pelo transporte do teste, nenhum worker de outbox é executado e o container inteiro é descartado ao final. A suíte compara os pedidos/itens antigos e os movimentos anteriores após as operações novas.

Esta compra exercita serviços e banco reais em cópia sanitizada; não é teste de interface do checkout, cobrança Asaas, PIX dinâmico, cartão ou boleto. O teste HTTP separado continua verificando catálogo, pedidos, carteiras e controles de acesso, sem habilitar meios remotos.

### Evidência final e próxima etapa

Execução **`8850982a30036f5a68a846142318151b`**, de **19:28:20 a 19:29:57 UTC**, aprovada: abertura e replay, leitura HTTP de 518 produtos/24 pedidos/duas carteiras, preservação dos produtos comerciais e **três testes de abertura/legados/compra nova aprovados**. Na conta antiga, a prova de crédito/replay de 100 pontos foi revertida; a compra persistida no clone usou cliente sintético novo e gerou somente os próprios pontos. Contagens finais dessa compra são dados do ensaio, não carga de produção.

Quatro testes unitários das proteções de destino, identidade, classificação e baseline aprovados. `tsc --noEmit --incremental false`, lint dos arquivos alterados e `git diff --check` aprovados. A primeira rodada detectou chamada incorreta da função de inspeção no teste (objeto de carteira inteiro em vez do par loja/usuário); corrigida a chamada, sem alterar a regra de negócio, e repetido o ensaio completo. Containers descartados e backup protegido mantido. Nenhuma conexão à origem ou escrita em main/homologação compartilhada nesta continuação; nenhum commit/push.

Evidência agregada: [L-BANCO-ABERTURA-CLONE-2026-10-15.json](../../../../../../trabalho_em_dupla/evidencias/L-BANCO-ABERTURA-CLONE-2026-10-15.json). Os relatórios anteriores continuam representando seus snapshots pré-tratamento; não substituir os saldos/contagens antigos para aparentar que a origem foi modificada.

**Concluído no recorte:** procedimento de tratamento dos produtos e pontos de teste ensaiado, preservação dos pedidos antigos e compatibilidade com compra nova demonstradas no clone. **Ainda necessário para implantação:** recuperação operacional acessível fora desta conta Windows, revisão do escopo final e apresentação do histórico nos indicadores, configuração efetiva do destino e coordenação da janela/escritores. Antes de qualquer aplicação real, reauditar o destino contra o snapshot e interromper diante de atividade nova ou divergência; o executor desta seção permanece restrito a clones. Main e seu banco continuam somente leitura para o assistente.

## 41. Procedimento de implantação e recuperação consolidado — 15/10/2026

Continuação autorizada para preparar a implantação; mantém a restrição explícita de escrita na main e no banco de origem. Consultados os runbooks presentes em `origin/main` `7f9b26e062ec2654420fecffb6dd78ad3ba1e017`, o pacote Cloud Run de Vanderlei, package.json, Dockerfile, controles de checkout/webhook/cron e executor de backup. Esta rodada não consultou nem alterou banco remoto e não provisionou recursos.

### Entregas concretas

- [Runbook de implantação e recuperação](../../../../../AUDITORIAS/operations/operations/DEPLOYMENT-RUNBOOK.md): ficha da release, responsáveis, sequência antes/durante/depois da janela, verificações de migrations/dados, critérios de interrupção e matriz de recuperação.
- [Runbook de backup e restauração](../../../../../AUDITORIAS/operations/operations/BACKUP-RESTORE-RUNBOOK.md): cobertura efetiva do dump, limites de DPAPI, prova por responsável alternativo, cutoff, conciliação de eventos e registro de recuperação.
- [Pacote Cloud Run atualizado](../../../../../../infra/cloudrun/README.md): destino existente da main, aceite da pendência temporal do boleto, vínculo com os procedimentos e separação entre runtime e executor de migration.

Os links acima apontam a documentos do repositório; não foram enviadas mensagens a Vanderlei nem aplicadas configurações externas.

### Achados que alteraram o procedimento

| Achado no código/material atual | Consequência operacional |
|---|---|
| `validate:env`, `migrate:status`, `migrate:deploy` e `smoke:deployment` não constam do package.json. | Substituídas orientações fictícias por comandos da CLI Prisma instalada, cuja ajuda foi conferida sem conexão ao banco. Nenhum comando de deploy foi executado. |
| Não há modo geral de manutenção comprovado. Criação entra por POST `/api/checkout/intents`, `/api/checkout` e `/api/orders`. | É necessário materializar/ensaiar contenção no ingresso real ou na aplicação; esconder UI não basta. Preservar recuperação por GET e mapear outros writers da versão antiga/Admin/importadores. |
| Webhook retorna 503 quando `PAYMENT_WORKER_ENABLED` não é true; cron de pagamentos executa várias etapas juntas. | Não usar a flag como contenção universal nem supor pausa seletiva. Durante drenagem manter obrigações; no trecho exclusivo coordenar todos os writers e a reentrega/retenção efetiva de eventos. |
| Backup restaurável está criptografado com chave protegida pela conta Windows atual. | Recuperação local aprovada; capacidade de Vanderlei/outra máquina ainda não demonstrada. Copiar arquivos não prova acesso à chave nem restore. |
| Cloud Run usa configuração de exemplo; a imagem standalone não é um executor de migration garantido. | Confirmar projeto/região/serviço/digest/segredos reais e preparar job/checkout de migration separado. Não presumir recursos ativos ou instalar configurações usando placeholders. |
| Readiness geral e compatibilidade dos writers antigos com o schema novo não foram comprovadas. | Não usar probe TCP como aceite completo nem reverter para main antiga com escrita por pressuposição. Preferir diagnóstico/correção para frente e recuperação isolada quando necessária. |

### Ordem operacional definida

1. Congelar revisão/artefato e reauditar o banco existente contra o baseline, sem copiar dados de homologação.
2. Comprovar recuperação independente, revisar o tratamento final dos dados e ensaiar a contenção.
3. Impedir novas compras, drenar trabalhos, registrar cutoff/backup fresco e suspender os escritores no trecho exclusivo com continuidade de eventos comprovada.
4. Aplicar migrations pelo operador autorizado; verificar histórico/schema/guards. Aplicar tratamento de dados separadamente, com escopo revisado e auditoria. Os executores de clone permanecem restritos e não devem ser redirecionados para o destino real.
5. Validar aplicação/dados/configuração; retomar eventos/consumidores e observar progresso antes de abrir novas compras.
6. Em falha, manter contenção, preservar o estado e escolher ação conforme a etapa realmente alcançada. Restore não desfaz efeitos do provedor nem autoriza reenvio financeiro.

### Pendências externas e de execução

Solicitada ao operador a informação já definida por Vanderlei sobre **projeto/região do Google Cloud e local de backup acessível por ambos**, sem credenciais. O operador respondeu **“Ainda não”**: permanecem por definir, sem nova solicitação das mesmas informações. Não foi localizado manifesto efetivo que resolva essas lacunas; os exemplos não foram promovidos a configuração real. RPO/RTO, retenção, responsáveis alternativos, janela, mecanismo de contenção e critérios quantitativos de observação ainda precisam de registro/prova operacional. A implementação local de contenção avançou depois, conforme seção 42.

**Situação:** roteiro consolidado e revisável; preparação documental concluída nesta rodada. Aplicação no destino, controle de contenção, recuperação independente e observação real continuam pendentes. Os ensaios das seções anteriores não foram repetidos apenas por edição de documentos. Main/homologação compartilhada intactas; sem commit, push, deploy ou nova operação financeira.

Verificação documental: sete links relativos dos procedimentos/seção conferidos, comandos confrontados com package.json e ajuda da CLI instalada, `git diff --check` aprovado. Registro: [L-BANCO-IMPLANTACAO-PREPARACAO-2026-10-15.json](../../../../../../trabalho_em_dupla/evidencias/L-BANCO-IMPLANTACAO-PREPARACAO-2026-10-15.json). Essa conferência não executou status/deploy contra banco remoto nem valida recursos externos.

## 42. Pausa de novas compras implementada e testada localmente — 15/10/2026

Continuação autorizada pelo operador após a preparação da seção 41. Consultado `origin/main` em `7f9b26e062ec2654420fecffb6dd78ad3ba1e017`: não foi encontrado controle equivalente nos serviços/rotas/configuração de exemplo. A nova variável é exclusivamente de runtime; não altera configuração comercial no banco. Código desenvolvido na homologação local, sem conexão aos bancos compartilhados e sem publicar deployment.

### Comportamento entregue

- `CHECKOUT_PAUSED=true` bloqueia proposta e conclusão de compras PIX, boleto, crédito e manual; valor ausente ou `false` preserva o comportamento anterior. Valor configurado vazio/desconhecido bloqueia por segurança.
- Proteção nos serviços `proposeCheckout` e `createOrder`, antes da transação, e nas entradas HTTP. As três rotas de criação respondem 503 com `CHECKOUT_PAUSED` e `private, no-store`; a rota legada `/api/orders` mantém a exigência de autenticação. Rate limit continua podendo responder 429 antes da pausa.
- O formulário apresenta mensagem de pausa e mantém o acompanhamento dos pedidos já realizados. Não repete submissão automaticamente.
- GET de recuperação mantém verificação de identidade/loja. Replay por POST também fica bloqueado durante a pausa; consultar o resultado por GET. Pedidos, propostas, estoque, pontos e instruções existentes não são apagados. Reabertura mantém validação de prazo/revisão/consentimento e idempotência.
- Webhook e executor financeiro não dependem dessa flag. Seus próprios controles de autenticação e ativação continuam valendo; não desligar `PAYMENT_WORKER_ENABLED` para pausar compras.
- Manifestos iniciais Cloud Run passam a incluir `CHECKOUT_PAUSED=true`, para não abrir compras manuais por acidente antes das verificações. Não reaplicar o manifesto inicial sobre serviço ativo apenas para pausar: seus outros defaults desligam consumidores.

### Evidências e limites

Executados **16 testes unitários**, **89 de integração em PostgreSQL/Next descartáveis** e **3 de manifesto**, todos aprovados. TypeScript sem emissão aprovado; lint dos arquivos alterados sem erros, com um aviso preexistente de `<img>` no formulário. Regressões financeiras incluem falhas intencionais de constraints, tratadas pelos testes; nenhum erro final de suíte.

Os casos novos demonstram bloqueio antes da transação nos quatro meios, 503 nas três entradas, autenticação de webhook/cron preservada, recuperação de compras de cliente e visitante durante pausa, recusa de outra loja e retomada sem duplicar estoque/pedido. Uma cobrança de fixture já emitida recebeu evento durável, foi conciliada/aprovada durante a pausa e produziu histórico/notificação uma única vez. Gateway controlado, sem chamadas Asaas reais.

Run descartável: `1e1ab54fb93bed2d5e6b2cfec0de700d`; 56 casos financeiros e 33 de checkout concluídos às 17:00 BRT, executor encerrado com código 0 e recursos descartados. Nas suítes de integração, a pausa foi aplicada aos serviços no processo de teste; as três rotas pausadas foram exercitadas diretamente pelos testes unitários. **Não equivale a ensaio HTTP da flag em um Preview publicado nem a teste visual do aviso no navegador.** Registro: [L-CONTENCAO-CHECKOUT-2026-10-15.json](../../../../../../trabalho_em_dupla/evidencias/L-CONTENCAO-CHECKOUT-2026-10-15.json).

### Próxima comprovação operacional

Publicar a candidata em homologação e executar o roteiro do [runbook](../../../../../AUDITORIAS/operations/operations/DEPLOYMENT-RUNBOOK.md): ativar pausa no Preview, conferir propostas anteriores, cliente/visitante, recuperação, webhook/consumidor e reabertura sem duplicação. Preservar o boleto #8 e os comandos de estorno já concluídos; não usá-los para gerar novos efeitos de teste. Não há publicação ou ativação remota nesta rodada.

Aplicar a variável em todas as instâncias/revisões acessíveis, drenar requisições em voo e tratar URLs antigas. A pausa não é instantânea entre deployments e **não congela todos os writers**: carrinho, contexto GET/PATCH (que pode criar cesta), Admin, autenticação, importadores e tarefas continuam ativos. Congelamento para DDL, retenção/reentrega de eventos, backup independente e configuração real do Google Cloud permanecem frentes separadas. Main e seu banco seguem somente leitura.

## 43. Candidata integrada e roteiro de conferência no Preview — 15/10/2026

Operador autorizou dar seguimento à publicação/validação. O fetch encontrou a homologação remota em `515a27d44a9897e8deecbeed082af9fd4c7b353a`; incorporada por fast-forward, sem conflitos ou perda das mudanças locais. Essa revisão de Vanderlei corrige clipboard e mocks da home. Main continua sem alterações. Incluídos na candidata os scripts de ensaio em clones, evidências agregadas, procedimentos e pausa de checkout preparados nas etapas anteriores; nenhum backup privado ou arquivo de ambiente real integra a publicação.

Verificação do conjunto integrado: 790 unitários em 89 arquivos, 19 testes de ferramentas/manifestos/proteções de clone, lint completo com zero erros e 17 avisos preexistentes, build otimizado Next/TypeScript aprovado em cópia sem `.env` e PostgreSQL descartável. Os 89 testes de integração de checkout/pagamentos da seção 42 foram executados antes deste fast-forward; não representam nova CI da revisão integrada. A nova publicação exige seu próprio resultado de CI/deployment.

### Conferência assistida da pausa

Não foi encontrado acesso autenticado à administração Vercel nesta máquina; não foi alterada variável remota. A integração GitHub permite consultar o status de deployment, mas não concede a sessão do Preview ou a edição de seu ambiente.

1. Conferir que o deployment publicado da branch `homologacao_teste` está Ready. Na Vercel, definir **somente para o Preview desta branch** `CHECKOUT_PAUSED=true` e fazer redeploy. Preservar as flags financeiras existentes.
2. No Preview autenticado como Admin, executar [VALIDAR_PAUSA_CHECKOUT.js](../../../../../../PACOTE_REVISAO_VANDERLEI/VALIDAR_PAUSA_CHECKOUT.js). O script verifica origem e identidade do pedido #7 já cancelado; envia apenas `{}` às três entradas, contrato que não cria compra mesmo com a pausa desligada. Não processa filas nem solicita pagamento/cancelamento/estorno. Saída sem dados pessoais/credenciais.
3. As três sondas devem retornar 503/`CHECKOUT_PAUSED` e `no-store`. A consulta de recuperação do #7 só passa se a sessão também for a compradora; uma recusa de identidade não deve ser contornada. Nesse caso, conferir acompanhamento na sessão compradora.
4. Essas sondas verificam apenas comandos incompletos. Ainda conferir proposta válida anterior à pausa, cliente/visitante, aviso visual, recepção/processamento Sandbox já planejados, cobertura das revisões acessíveis e reabertura conforme runbook. Não usar o #8 nem repetir os estornos encerrados para produzir atividade.
5. Após coleta, retornar `CHECKOUT_PAUSED=false` no mesmo Preview e redeploy; confirmar comportamento normal sem duplicação. Não remover outros bloqueios de segurança para facilitar o teste.

O script teve sintaxe validada localmente; ainda não foi executado na sessão remota. Publicar código não ativa a pausa quando a variável está ausente, nem conclui o congelamento geral de escritores/recuperação/produção. Projeto/região Google Cloud e local de backup compartilhado continuam não definidos pelo operador.

### Resultado recebido após a publicação

O commit `b90b41dbe2f795f95fdd0f0f78ea648febaa3427` foi publicado em `homologacao_teste`, com status Vercel `success` conferido via GitHub na etapa anterior. Depois das orientações de ativação/redeploy, o operador enviou a saída de `VALIDAR_PAUSA_CHECKOUT.js`: `ok=true`, `INVALID_COMMAND_PROBES_PAUSED`; `/api/checkout/intents`, `/api/checkout` e `/api/orders` responderam **503**, com `paused=true` e `noStore=true`. A recuperação do pedido #7 respondeu **200**, `verified=true`. Nenhuma proposta válida foi submetida e nenhuma fila foi processada pelo script.

Evidência declarada pelo operador, não uma execução remota independente pelo assistente. O JSON não informa horário ou ID do redeploy posterior; não atribuir a esse redeploy a identidade do deployment inicial por suposição. Arquivo: [L-CONTENCAO-PREVIEW-SONDAS.json](../../../../../../trabalho_em_dupla/evidencias/L-CONTENCAO-PREVIEW-SONDAS.json).

Na sequência, o operador enviou imagem do formulário normal com PIX selecionado: aviso **“As compras estão temporariamente pausadas. Você pode continuar acompanhando os pedidos já realizados.”**, botão **“Revisar proposta de compra”** ainda presente e erro HTTP **503 em `/api/checkout/intents`** no Console. O bloqueio visual da tentativa de revisão foi observado. A imagem não contém o payload da requisição, não comprova sua validade no servidor e não substitui consulta de efeitos no banco. Não foi exibida uma proposta nova na imagem.

O Console também mostra bloqueio CSP do script de feedback `vercel.live` e uma falha de conexão de outro script; não atribuir a eles o bloqueio de compra, que tem resposta 503 e aviso próprios. Nenhuma alteração de CSP foi proposta para este ensaio.

Após a orientação para definir `CHECKOUT_PAUSED=false` no mesmo Preview, fazer redeploy e recarregar, o operador enviou imagem com a proposta novamente exibida: PIX, retirada, uma unidade do aspirador automotivo Pequeno/Vermelho, total R$ 49,90, sem desconto/frete/encargos e ganho previsto de 24 pontos. O botão mudou para **“Confirmar proposta e concluir compra”**. **Retomada da revisão de compra observada**; nenhuma confirmação de pedido ou pagamento foi apresentada nem solicitada neste checkpoint. A configuração efetiva e o ID desse redeploy não foram consultados independentemente.

O ciclo observado fecha sondas bloqueadas, aviso visual, recuperação do #7 e retorno da proposta na sessão mostrada. Não precisa concluir essa compra apenas para fechar a evidência visual. Proposta aceita antes da pausa/conclusão, cliente/visitante, webhook/consumidor e abrangência das revisões continuam pendentes até evidência própria. A próxima frente de preparação é mapear e coordenar a suspensão dos demais escritores na janela do banco, com retenção/reentrega de eventos e recuperação independente; não repetir operações financeiras encerradas nem alterar o boleto #8. Esses registros de observação permanecem locais até nova publicação documental.

## 44. Suspensão dos escritores da aplicação preparada e ensaiada — 15/10/2026

Continuação autorizada após as evidências de pausa e retorno da proposta. Referência somente leitura `origin/main` em `7f9b26e062ec2654420fecffb6dd78ad3ba1e017`: não localizado controle equivalente nas entradas/configurações pesquisadas. Base de homologação publicada `b90b41dbe2f795f95fdd0f0f78ea648febaa3427`; alterações desta seção permanecem locais, sem commit/push/deploy. Nenhuma consulta ou mutação dos bancos compartilhados foi executada nesta rodada.

### Implementação e inventário

Preparado `APP_MAINTENANCE_MODE`: `false` ou ausente preserva operação; demais valores configurados fecham a aplicação. O Proxy bloqueia páginas, APIs, Server Actions, assets, Admin, jobs HTTP e webhook com **503 e no-store**, antes de autenticação/renderização. APIs recebem `APP_MAINTENANCE`; páginas recebem aviso de manutenção. O singleton Prisma também recusa todas as consultas, inclusive raw e operações em transações. Não substitui `CHECKOUT_PAUSED`: durante drenagem, a manutenção completa fica desligada para permitir recepção e processamento existentes.

O inventário encontrou escrita indireta em consultas: remoção de sessão expirada e criação de cesta pelo contexto de checkout. Por isso, filtrar apenas POST/PUT/PATCH/DELETE não seria suficiente. Inventariados também carrinho, Admin/catálogo/estoque/configurações, perfil, fidelidade, webhook, crons, consumers/schedulers e importadores com clientes próprios. Cobertura e sequência estão no [runbook de implantação](../../../../../AUDITORIAS/operations/operations/DEPLOYMENT-RUNBOOK.md).

O gerador Cloud Run inclui a flag completa **desligada**, junto à pausa inicial de checkout. Ensaio reproduzível adicionado a `npm run test:maintenance:isolated`, à CI e à seleção de integração pertinente. A adição à CI não representa uma execução publicada desta revisão.

### Verificação executada

- **817 testes unitários em 90 arquivos aprovados**, incluindo 27 casos da nova proteção.
- **Um teste de integração com Prisma real**: recusa de ORM, SQL raw e operações em transações; retomada com a flag desligada, usando PostgreSQL descartável.
- **Build otimizado e TypeScript aprovados**, em cópia sem `.env`. O mesmo artefato foi reiniciado aberto/fechado/aberto; 23 chamadas de API e quatro acessos de página/ação receberam a resposta esperada durante manutenção. Hashes de todas as tabelas públicas e sequências permaneceram iguais. Retomada confirmou autenticação e checkout ainda pausado.
- **89 regressões de checkout/pagamentos aprovadas** em banco e servidor descartáveis, com gateway controlado; nenhuma chamada financeira real.
- **15 testes de ferramentas e manifestos aprovados**, incluindo o default de manutenção desligada e a seleção das suítes da CI.
- Lint dos arquivos de código alterados: zero erros e um aviso preexistente de diretiva não utilizada em `lib/prisma.ts`.

Evidência agregada: [L-MANUTENCAO-APLICACAO-2026-10-15.json](../../../../../../trabalho_em_dupla/evidencias/L-MANUTENCAO-APLICACAO-2026-10-15.json). Recursos temporários dos ensaios encerrados e descartados. Não há declaração de congelamento do banco real, de reentrega do Asaas ou de prontidão para produção.

### Aplicação operacional ainda pendente

O controle não revoga contas SQL, não alcança revisões antigas/clientes independentes e não desfaz consultas ou efeitos externos em voo. Para a janela: pausar novas compras, drenar, parar agendas/importadores, comprovar retenção/reentrega e cobrir todas as revisões; então ativar manutenção completa, aguardar trabalhos e conferir sessões/leases antes do backup/cutoff e DDL pelo operador autorizado. A main e seu banco continuam somente leitura para o assistente.

O webhook também responderá 503, sem confirmar evento não persistido. A documentação do Asaas prevê interrupção da fila após falhas consecutivas e retenção limitada; não presumir reentrega automática indefinida. Fontes e procedimento de recuperação estão no runbook. Essa continuidade precisa ser comprovada na conta antes de interromper seu recebimento; a flag completa **não foi ativada no Preview**.

Retomar primeiro com `APP_MAINTENANCE_MODE=false` e `CHECKOUT_PAUSED=true`, conferir eventos e consumidores; somente depois reabrir novas compras. Permanecem pendentes recuperação por operador alternativo, local de backup compartilhado, projeto/região/serviço reais e coordenação da janela. Boleto #8 e operações financeiras já encerradas foram preservados.

## 45. Encaminhamento da manutenção para homologação — 15/10/2026

O operador autorizou publicar a preparação da seção 44 e conferir deployment/CI, sem aguardar retorno de Vanderlei. O fetch prévio confirmou `origin/homologacao_teste` em `b90b41dbe2f795f95fdd0f0f78ea648febaa3427`, sem mudanças concorrentes a integrar, e `origin/main` em `7f9b26e062ec2654420fecffb6dd78ad3ba1e017`.

Escopo da candidata: manutenção completa, testes/CI, defaults de exemplo, runbooks e evidências agregadas das seções 43–44. Nenhum segredo, dump privado ou configuração real integra o commit. Os resultados locais da seção 44 continuam válidos para este código; esta etapa não os apresenta como CI remota. O JSON de evidência registra o estado no momento do ensaio, quando as alterações ainda não estavam publicadas.

A publicação não ativa `APP_MAINTENANCE_MODE`: ausente/`false` mantém funcionamento normal. Não alterar flags remotas, main, bancos compartilhados ou comandos financeiros. Conferir os resultados de Vercel/GitHub vinculados ao SHA publicado; status de build não comprova navegação autenticada ou reentrega de eventos. A ativação remota do modo completo continua dependente da coordenação descrita na seção 44.

### Resultado da publicação

Publicado `17366e8b5c2a44bd2c0157a159a371886b3126d1` em `homologacao_teste`. Vercel: `success`, deployment Preview `7104520978`. [CI 38808225101](https://github.com/ViniMoia/Sistema-E-Commerce/actions/runs/38808225101): `completed/success`, conferido pela API GitHub antes de iniciar a próxima etapa. O acesso anônimo ao deployment retornou 302 para login Vercel; não foi apresentado como navegação autenticada. Nenhuma flag remota foi alterada.

## 46. Preparação do ensaio de reentrega de webhook — 15/10/2026

Operador autorizou iniciar após aprovação da CI. Consultado o receptor da main de referência, que não deve ser confundido com o processamento durável da candidata. As leituras efetivas foram exclusivamente no banco de homologação, com host fixo validado e transações `READ ONLY / REPEATABLE READ`. Primeira verificação da ferramenta recusou a precedência de configuração inadequada antes da conexão; corrigida ordem de carregamento para resolver `.env.local` antes de importar Prisma. Main e seu banco não receberam conexão ou alteração nesta etapa.

Selecionado como **candidato** o evento `PAYMENT_RECEIVED` do pedido #6, `evt_d26e303b238e509335ac9ba210e51b0f&22120169`, único registro correlacionado na inbox, `COMPLETED` com uma tentativa de processamento. Pedido `PAID`, versão 1, R$ 49,90, 24 pontos creditados; tentativa `APPROVED`, sem operações de reversão. O #7 não possui evento na inbox e não foi selecionado. #8 preservado.

Criado `scripts/homologation/webhook-recovery-baseline.mjs`: coleta e compara contagens/hashes de 17 recortes de pedido/estoque/pontos/efeitos e do registro do #8. Não envia webhooks nem processa filas. Baseline privado agregado salvo em `artifacts/webhook-recovery/baseline-order-6.json`; comparação de controle, sem evento intermediário, terminou `unchanged=true`, `providerRedeliveryVerified=false`, em 15/10 às 22:47 BRT (16/10 01:47 UTC). **Sete testes do comparador aprovados**. O baseline deverá ser atualizado antes do ensaio efetivo se houver intervalo/atividade concorrente.

Procedimento detalhado incorporado ao [runbook de implantação](../../../../../AUDITORIAS/operations/operations/DEPLOYMENT-RUNBOOK.md). Fontes oficiais consultadas: logs de entrega acessíveis pela interface web e idempotência por ID. Não há acesso autenticado à interface Asaas nesta sessão. Solicitado ao operador conferir estado da fila e existência de reenvio individual; resposta pendente. Não foi presumido botão/API de reenvio nem utilizada a função de remover penalidade como replay.

**Limite da evidência:** replay de evento já concluído testa reconhecimento de duplicata; não prova processamento inicial de evento novo retido. Envio manual de JSON não prova retry automático do provedor. No ensaio real, correlacionar o mesmo ID nos logs de entrega e distinguir 503 da aplicação de bloqueio de acesso Vercel. Não rodar lote financeiro global para um evento já `COMPLETED`.

Manutenção completa continua sem ativação remota; sem compra, confirmação, cancelamento, estorno, reenvio ou processamento novo. Preparação local ainda não publicada. Continuidade financeira, recuperação independente e janela produtiva continuam pendentes.

### Evento confirmado pelo operador e referência anterior ao replay

A imagem do operador confirmou a existência de **Reenviar** nos detalhes dos logs e respostas históricas HTTP 200; não comprovou o estado atual da fila. O primeiro item mostrado era de estorno e não foi usado. Depois, o operador forneceu o evento exato do #6: ID completo acima, `PAYMENT_RECEIVED`, pagamento `pay_blfexx8zkousw431`, referência `0f0a05ff-2a24-4e6f-93ef-be13451388c9`, boleto R$ 49,90, `RECEIVED`, data de criação `2026-10-14 17:35:43`. Não é necessário versionar o payload bruto ou os dados do cliente.

Nova leitura confirmou igualdade dos campos efetivamente aceitos pelo receptor com o payload persistido; evento permanece `COMPLETED`, uma tentativa. Baseline anterior ao reenvio salvo em `artifacts/webhook-recovery/before-provider-replay-2026-10-16T01-52-41-530Z.json` (15/10 22:52:41 BRT), com 17 recortes, uma inbox, um histórico, uma transação/lote de pontos, duas evidências financeiras e três registros de outbox. Nenhuma escrita no banco ou envio de evento.

Próxima ação orientada: **um reenvio manual desse evento pela interface Asaas, com aplicação funcionando e manutenção desligada**. Esperado HTTP 200 com `received=true`, mesmo `eventId` e `status=PROCESSED`; coletar resposta antes de qualquer repetição e comparar com o baseline preservado. Não executar lote financeiro global. Esse primeiro passo prova reconhecimento de duplicata se confirmado; não simula indisponibilidade nem prova retry automático. Resultado do reenvio ainda pendente.

A imagem anterior expôs parâmetro de bypass Vercel. Não copiado para arquivos ou ferramentas; operador orientado a ocultá-lo e coordenar rotação/atualização da integração. Nenhuma credencial foi alterada pelo assistente.

### Retomada do ensaio em 16/10 às 15:05 BRT

Operador autorizou retomar o webhook enquanto Vanderlei resolve o domínio Cloud Run. Captura atual em transação somente leitura confirmou pedido #6 `PAID`, versão 1, R$ 49,90, 24 pontos creditados; evento selecionado `COMPLETED`, uma tentativa, sem operações de reversão. Preservado novo baseline privado `artifacts/webhook-recovery/before-provider-replay-2026-10-16T18-05-23-291Z.json`, com os 17 recortes de comparação; baseline anterior não sobrescrito.

Solicitada confirmação do destino Vercel e do estado ativo da fila no Asaas antes do reenvio, porque a transição para Google Cloud está em andamento. GET anônimo de `/login` no Preview retornou 302, o que não comprova disponibilidade do receptor autenticado nem manutenção desligada. Nenhum webhook enviado, fila processada ou estado financeiro alterado. O resultado do reenvio continua pendente; conferir o mesmo ID e a resposta real antes de comparar o estado posterior. Se houver demora ou mudanças concorrentes, atualizar novamente o baseline.

### Destino e fila confirmados pelo operador — 16/10 às 15:17 BRT

Operador confirmou destino no Preview Vercel, caminho `/api/webhooks/asaas`, e fila de sincronização ativa. Parâmetros secretos da URL não foram registrados. Sua exposição na conversa exige rotação coordenada do segredo de bypass e atualização do destino no Asaas; rotação ainda não executada.

Atualizada a captura somente leitura imediatamente antes da orientação de reenvio: `artifacts/webhook-recovery/before-provider-replay-2026-10-16T18-17-41-004Z.json`. Evento do #6 permanece `COMPLETED`, uma tentativa, sem operação de reversão; 17 recortes preservados para comparação. Próximo passo: operador reenviar uma única vez o evento exato da seção 46 e fornecer horário, HTTP e corpo da resposta sanitizado. Esperado `received=true`, mesmo `eventId`, `status=PROCESSED`. Não executar processador global, rearmar inbox ou confirmar outro pagamento. Reenvio e comparação posterior ainda pendentes.

### Reenvio informado; comparação sem alterações — 16/10 às 15:35 BRT

Operador informou reenvio e apresentou aviso do Asaas de notificação reenviada com sucesso. A imagem não mostra o HTTP nem o conteúdo da resposta da nova entrega; a data original exibida não comprova o horário do reenvio. Confirmação do receptor continua pendente.

Comparação somente leitura com o baseline das 15:17 BRT concluída às 15:35:32 BRT: `unchanged=true`, `changedParts=[]` nos 17 recortes, incluindo estoque, variantes, carteira, movimentos/lotes de pontos, histórico, evidências financeiras, inbox/outbox e pedido #8. Evento segue `COMPLETED`, uma tentativa. Evidência privada: `artifacts/webhook-recovery/after-provider-replay-2026-10-16T18-35-32-114Z.json`. Nenhuma duplicação observada nessa consulta, mas estado inalterado isoladamente não prova recebimento do reenvio. Próxima evidência: HTTP e resposta da nova entrega com o mesmo eventId; esperado 200 / `received=true` / `PROCESSED`. Não reenviar novamente nem executar processador global para obter essa evidência.

### Resposta do reenvio recebida — 16/10/2026

Operador forneceu o conteúdo da resposta: `received=true`, `eventId=evt_d26e303b238e509335ac9ba210e51b0f&22120169`, `status=PROCESSED`. A identidade corresponde ao evento selecionado. Junto do reenvio manual informado na interface Asaas e da comparação independente dos 17 recortes sem alterações, a evidência valida o reconhecimento de duplicata sem efeitos repetidos no recorte do pedido #6. Não é necessário repetir o reenvio ou processar filas.

Limites: o código HTTP e o horário exato da nova tentativa não foram fornecidos; não registrar HTTP 200 como observado. A resposta do provedor foi apresentada pelo operador, sem acesso autenticado do assistente aos logs. Este ensaio não valida retry automático, retenção durante manutenção, evento novo retido ou entrega ao Google Cloud. A rotação coordenada do segredo de bypass continua pendente. O comparador isolado mantém `providerRedeliveryVerified=false` por contrato, pois ele só compara banco; a correlação com o relato e a resposta do operador está registrada aqui.

## 47. Alinhamento da configuração Google Cloud de homologação — 16/10/2026

O operador informou que Vanderlei está preparando o primeiro deployment Google Cloud **para homologação**, tendo este replanejamento como referência. Reenvio do webhook permanece aguardando; não há resultado de replay recebido. Vanderlei relatou conexões Supabase em um arquivo, URL Asaas Sandbox e ausência de `PAYMENT_DEPLOYMENT_ENVIRONMENT`, `ASAAS_ENABLED_LOJA_IDS` e `SUPABASE_URL`. O arquivo de ambiente efetivamente inspecionado por ele não foi identificado: este Markdown não representa a configuração carregada no runtime.

### Conferência desta máquina e das fontes existentes

Fetch confirmou `origin/main` em `7f9b26e062ec2654420fecffb6dd78ad3ba1e017`; código e documentos consultados sem alteração. Configuração local examinada em memória, sem imprimir URLs de conexão, chaves ou tokens e sem conectar a bancos/provedores nesta rodada. Tanto `.env` quanto `.env.local` locais apontam a **Neon** nas duas variáveis de banco. A configuração efetiva, com precedência do Next, resolve a homologação já usada nos testes; as declarações financeiras faltantes no `.env` base estão presentes em `.env.local`.

Isso não comprova o conteúdo do arquivo de Vanderlei. As conexões Supabase relatadas divergem da homologação auditada; não tratá-las como equivalentes apenas porque Asaas está em Sandbox. Banco relacional e Storage são serviços independentes nesta configuração: **Neon para PostgreSQL, Supabase para arquivos**. Não foi autorizada migração da base de homologação para Supabase.

Identidade de referência do banco de homologação: host direto `ep-blue-feather-b6l24gbu.c-2.sa-east-1.aws.neon.tech`, database `neondb`, loja `3a82b33c-3646-4272-9a89-80bb1ba327a5`. Fonte: guard de `scripts/import-jt-homologation.mjs`, configuração local efetiva e leituras das seções anteriores. O host contém `sa-east-1`; a região Google Cloud efetiva continua sem confirmação e não deve ser deduzida de `config.example.json`. Confirmar painel/identidade do provedor e região real antes de fechar o registro de implantação. Não enviar strings de conexão pelo chat.

### Valores não secretos definidos para este deployment de homologação

```dotenv
NODE_ENV=production
PAYMENT_DEPLOYMENT_ENVIRONMENT=SANDBOX
ASAAS_ACCOUNT_SCOPE=sandbox-hml
ASAAS_ENABLED_LOJA_IDS=3a82b33c-3646-4272-9a89-80bb1ba327a5
ASAAS_API_URL=https://api-sandbox.asaas.com/v3
CHECKOUT_PAUSED=true
APP_MAINTENANCE_MODE=false
```

`NODE_ENV=production` corresponde ao build otimizado; a declaração financeira explícita mantém Sandbox fora da Vercel. Preservar `sandbox-hml` ao usar a mesma conta e seus registros duráveis. A allowlist libera somente a loja indicada e não substitui as demais flags/credenciais/capacidades. Não reutilizar esses valores de Sandbox para o futuro deployment produtivo.

`scripts/render-cloudrun.mjs` já materializa `PAYMENT_DEPLOYMENT_ENVIRONMENT` e `ASAAS_ACCOUNT_SCOPE` a partir da configuração e referencia `ASAAS_ENABLED_LOJA_IDS` por Secret Manager. Conferir o manifesto efetivamente gerado/aplicado, não apenas um `.env` enviado. `DATABASE_URL` e `DIRECT_URL` devem corresponder à mesma base Neon de homologação, com as credenciais apropriadas; nenhuma credencial foi copiada ou transmitida nesta rodada.

### Storage existente e lacuna real

**Registro histórico superado pela decisão da seção 70 em 20/10:** as instruções abaixo descrevem a hipótese anterior de uso de Storage e não devem ser executadas. A presença de código ou configuração herdada não autoriza habilitar upload nem criar buckets/segredos.

Na candidata, `lib/supabase/storage.ts` resolve **`SUPABASE_URL || NEXT_PUBLIC_SUPABASE_URL`**, junto de **`SUPABASE_SERVICE_ROLE_KEY`** no servidor. Na main de referência, o código herdado usava `NEXT_PUBLIC_SUPABASE_URL`. Localmente, o fallback e a chave estão presentes; presença não valida autenticação, permissões ou isolamento do projeto.

O gerador Cloud Run referencia `SUPABASE_URL` explicitamente como segredo: preencher essa configuração com a URL do projeto de Storage confirmado, e a chave correspondente, pelo mecanismo de segredos. A existência do fallback no código não cria uma versão ausente no Secret Manager. Conferir buckets `products` e `avatars`, permissões e acesso às imagens. `STORAGE_BUCKET_URL` isolada não substitui a URL/chave usadas pelo cliente de upload; não foi encontrada implementação alternativa baseada nela no código executável pesquisado.

### Próximas conferências para Vanderlei

1. Comparar o banco do arquivo/manifestações dele com a identidade Neon acima; confirmar qual arquivo está sendo usado se continuar indicando Supabase. Não trocar destino nem executar migrations nesse banco desconhecido.
2. Registrar projeto/região/serviço Google Cloud reais e versões de segredos, sem valores no repositório. Selecionar `environment=SANDBOX` e `accountScope=sandbox-hml` no gerador existente.
3. Confirmar projeto de Storage e a correspondência da chave/buckets; a validação remota ainda está pendente.
4. Publicar primeiro o serviço de homologação com novas compras pausadas, manutenção completa desligada e capacidades financeiras conforme o manifesto inicial. Não reaplicar esses defaults ao Preview ativo. Manter webhook/consumidores existentes no destino atual até coordenar a transição, evitando duplicar agendadores ou interromper recebimento por trocar URL antes da validação.

Este registro é local e não foi enviado diretamente a Vanderlei. Nenhuma variável de ambiente, recurso Google Cloud, segredo, banco, domínio ou webhook foi alterado. Identidade do banco de Vanderlei, Storage remoto e runtime efetivamente aplicado permanecem por conferir.

## 48. Primeiro acesso ao Google Cloud de homologação — 16/10/2026

Operador informou publicação por Vanderlei em `https://continental-hml-15531616695.southamerica-east1.run.app/`, commit `17366e8`. Esse SHA corresponde à candidata aprovada pela CI registrada na seção 45; a revisão/digest efetivamente em execução no Cloud Run ainda não foram consultados independentemente. A região consta na URL fornecida; o projeto e demais recursos efetivos não foram inventariados nesta sessão.

Cinco GETs anônimos, sem cookies e sem seguir redirects, chegaram à aplicação: `/`, `/login` e `/admin` responderam HTTP **503**, título **Manutenção temporária**; `/api/loja/active` e `/api/payment/capabilities` responderam HTTP **503**, `success=false`, `error=APP_MAINTENANCE`. Todas as respostas apresentaram `private, no-store`. O ingresso está acessível, mas a aplicação está em manutenção completa. A flag efetiva não foi lida: pelo contrato da candidata, `true` ou qualquer valor configurado diferente de `false` produz esse bloqueio.

Registro: [L-CLOUDRUN-INGRESSO-2026-10-16.json](../../../../../../trabalho_em_dupla/evidencias/L-CLOUDRUN-INGRESSO-2026-10-16.json). Esses resultados não validam conexão/identidade do banco, Sandbox, Storage, autenticação, configuração de checkout ou saúde financeira; a resposta ocorre antes dessas consultas.

Próximo ajuste pelo operador do novo serviço de homologação: definir **`APP_MAINTENANCE_MODE=false`** literalmente e manter/confirmar **`CHECKOUT_PAUSED=true`**, publicando a revisão e conferindo o tráfego efetivo. Preservar demais controles financeiros, URL de webhook e agendas existentes. Não houve alteração remota pelo assistente. Após o ajuste, repetir conferência pública de loja/capacidades e então fechar as verificações autenticadas e de dados. Não ativar consumidores duplicados nem mover webhook para o serviço em manutenção.

Nenhuma compra, POST financeiro, replay, processamento de fila, upload ou migração foi executado. O replay do pedido #6 continua pendente; seu baseline deverá ser atualizado antes de retomá-lo, considerando o intervalo desde a captura.

## 49. Manutenção retirada; resolução de loja pendente no Cloud Run — 16/10/2026

Após o operador informar a alteração por Vanderlei, repetida a conferência às **10:59 BRT**. `/login` retornou 200 e `/admin` redirecionou para `/login` (307), sem cookie. A manutenção completa deixou de ser observada. Dois POSTs com apenas `{}`, sem sessão/identidade/proposta válida, para `/api/checkout/intents` e `/api/checkout` responderam **503 / CHECKOUT_PAUSED**, `private, no-store`. Não criaram compra nem processaram pagamentos; a pausa foi observada nesses comandos incompletos, sem comprovar todas as rotas, revisões ou submissões autenticadas.

O catálogo `/`, `/api/loja/active` e `/api/payment/capabilities` agora retornam **404 / loja não encontrada**. Uma consulta somente leitura à base Neon de homologação conhecida confirmou a loja `3a82b33c-3646-4272-9a89-80bb1ba327a5`, atualmente com slug **`continental-homologacao`** e `customDomain` **`continental-prototipo-git-homologacaoteste-vinimoias-projects.vercel.app`**. O slug atual difere da referência anterior; nenhuma correção ou renomeação foi feita pelo assistente.

O endereço Cloud Run não corresponde a esse domínio cadastrado. Entretanto, os GETs diretos `/api/loja/continental-homologacao` e `/api/loja/continental-prototipo` também retornaram 404. A implementação `getLojaBySlug` consulta por slug independentemente do Host, mas converte exceções do banco em `null`/404. Portanto, **não atribuir a falha somente ao domínio nem considerar comprovada a conexão do Cloud Run com a base conhecida**. São necessárias conferência de `DATABASE_URL`/`DIRECT_URL` efetivos, banco/schema e logs da revisão para distinguir conexão, schema, ausência de registro ou divergência de versão/configuração.

Próximo diagnóstico com Vanderlei: confirmar sem expor segredos que a revisão usa a conexão Neon de homologação, e fornecer o código/mensagem sanitizada de erro relacionado a `GET_LOJA_FROM_HEADERS_ERROR`, `GET_LOJA_BY_SLUG` ou Prisma. Após localizar a loja pelo slug, coordenar o vínculo do domínio Cloud Run à loja correta e a origem canônica dos links. Não trocar o `customDomain` compartilhado nem cadastrar outra loja por tentativa; essa mudança afeta também a Vercel e requer coordenação dos acessos existentes.

Evidência atualizada em [L-CLOUDRUN-INGRESSO-2026-10-16.json](../../../../../../trabalho_em_dupla/evidencias/L-CLOUDRUN-INGRESSO-2026-10-16.json). Nenhuma conexão Cloud Run autenticada, segredo, banco, domínio ou agenda foi alterado. Main preservada. Validação de Sandbox, Storage e compra permanece pendente enquanto a loja não for resolvida.

### Diagnóstico confirmado por Vanderlei

Operador transmitiu o retorno de Vanderlei: **`DATABASE_URL` ausente no ambiente da revisão publicada**, impedindo a inicialização da conexão Prisma. Conferência de Vanderlei somente leitura, sem configuração alterada. A referência `schema.prisma:10` identifica `env("DATABASE_URL")`, e não uma linha do `.env`. Diagnóstico relatado pelo responsável; ambiente Cloud Run não foi inspecionado diretamente pelo assistente.

Correção a aplicar por Vanderlei: vincular `DATABASE_URL` ao segredo da conexão Neon de homologação e conferir `DIRECT_URL` para a mesma base. O gerador local, para serviço `continental-hml`, prevê os nomes `continental-hml-database-url` e `continental-hml-direct-url`; confirmar existência, versão e permissão da conta do serviço nos segredos realmente usados. Criar o segredo isoladamente não injeta a variável no container: o manifesto/revisão precisa conter o vínculo. Não copiar o `.env` base inteiro, que pode conter configuração de outro ambiente.

Publicar nova revisão com esses vínculos, preservando `APP_MAINTENANCE_MODE=false`, `CHECKOUT_PAUSED=true` e os demais controles; verificar qual revisão recebe tráfego. Depois repetir a consulta por slug e a resolução por Host. A ausência da variável explica a falha de acesso ao banco; o vínculo de domínio Cloud Run continua sendo uma verificação separada. Nenhuma migration, alteração de loja ou escrita em banco foi executada ou indicada como correção para a variável ausente.

## 50. Leitura da loja restabelecida; acesso por domínio pendente — 16/10/2026

Após o operador informar que Vanderlei concluiu a configuração, a consulta pública direta `/api/loja/continental-homologacao` retornou **200 às 14:51 BRT**, com a loja esperada `3a82b33c-3646-4272-9a89-80bb1ba327a5`. A conexão necessária para essa leitura funciona; isso não verifica independentemente o host do banco, `DIRECT_URL`, todas as revisões ou o schema completo.

`/api/loja/active` ainda retornou **404 / Loja não encontrada**. A consulta direta revelou `customDomain=continental-prototipo-git-homologacaoteste-vinimoias-projects.vercel.app`, diferente do endereço Cloud Run. O próximo passo é coordenar a resolução do domínio Cloud Run para essa mesma loja e a origem canônica dos links, considerando os acessos e integrações ainda usados na Vercel. Não substituir o domínio compartilhado por tentativa nem criar outra loja. Algumas leituras iniciais retornaram 429; consultas pontuais posteriores responderam 404/200, sem causa do 429 determinada.

Nesta rodada, dois POSTs incompletos `{}` para `/api/checkout/intents` e `/api/checkout` continuaram retornando **503 / CHECKOUT_PAUSED**, com `no-store`. Nenhuma compra válida, processamento de fila ou alteração remota foi executada. Evidência: `trabalho_em_dupla/evidencias/L-CLOUDRUN-INGRESSO-2026-10-16.json`, campo `afterOperatorDatabaseBinding`. Sandbox, Storage, webhook no novo destino e abertura de compras continuam pendentes de validação.

## 51. Indicadores após abertura do banco existente — auditoria no clone em 16/10/2026

Revisados dashboard, métricas de clientes e relatório de fidelidade, reaproveitando a decisão de preservar os pedidos classificados como teste. Consultados serviço e runbook de `origin/main` `7f9b26e062ec2654420fecffb6dd78ad3ba1e017`; candidata local baseada em `17366e8`. Reutilizado o backup de 15/10 às 18:43:55 UTC, sem nova conexão com a origem. Restauração/sanitização, migrations e abertura ocorreram exclusivamente em containers descartáveis.

**Achados reproduzidos:** os 24 pedidos históricos geram quatro pagos/R$ 1.069,99, dez pendentes/R$ 1.209,00 e dez cancelados/R$ 580,00 no dashboard, além de dois despachos e duas retiradas. As métricas de clientes preservam R$ 0 reconhecido e 24 pedidos sem evidência financeira. Após zerar as carteiras no clone, o relatório de fidelidade ainda retorna 475 pontos concedidos pelo fallback que trata zero como ausência; saldo disponível permanece zero, sem recrédito.

Cenários sintéticos adicionais: recebimento com `paidAt` nulo entra pelo `createdAt`; encargos não entram na soma por `total`; estorno solicitado mantém R$ 100 no painel, e sua confirmação leva o recebido a zero e o cancelado a R$ 100, enquanto as métricas de clientes distinguem bruto e estornado. Os testes caracterizam o comportamento atual e não aprovam essa interpretação para abertura.

**Entrega:** modo `--audit-indicators` no executor de clone e suíte dedicada com três cenários. Corrigido também o falso drift da ferramenta causado por aviso de atualização da CLI Prisma: SQL lido de `--output`, sem relaxar validação. Execução final `71a813f2e80c0e910bc6889ac68bde96`, 16:00:40–16:02:07 BRT: três cenários passaram, histórico de pedidos/carteiras/transações preservado, diff vazio e dados/sequências preservados. Quatro testes de proteções, tipagem e lint passaram. A fixture inicialmente incompleta foi corrigida sem remover constraints. Containers descartados; sem chamadas ao Asaas, escrita compartilhada, deploy ou publicação.

Relatório com propostas e limites: [INDICADORES_ABERTURA_AUDITORIA_2026-10-16.md](../../../../../AUDITORIAS/operations/operations/INDICADORES_ABERTURA_AUDITORIA_2026-10-16.md). Evidência: [L-INDICADORES-ABERTURA-CLONE-2026-10-16.json](../../../../../../trabalho_em_dupla/evidencias/L-INDICADORES-ABERTURA-CLONE-2026-10-16.json).

**Próxima implementação:** classificar explicitamente os pedidos de teste auditados e separá-los dos indicadores/ações comerciais sem apagá-los; unificar a interpretação financeira com evidências e datas próprias de recebimento/devolução; corrigir o zero válido e o escopo do relatório de fidelidade. Não inferir teste genericamente por falta de intenção de checkout, nome de produto ou data. Nenhum cálculo de negócio foi alterado nesta auditoria, e o banco principal permanece somente leitura. Evidência do snapshot não substitui reauditoria antes da aplicação real.

## 52. Pedidos de teste separados dos indicadores comerciais — 16/10/2026

Implementada a primeira correção da seção 51, com a decisão anterior do operador e a mesma origem/revisão auditadas. A nova relação `OrderReportingExclusion` registra pedido, motivo, lote, responsável e data; não altera status, pagamento, estoque ou pontos. A migration `20261016193000_order_reporting_exclusion` cria somente a estrutura: **não classifica nenhum pedido automaticamente**. Ausência de intenção, data antiga, produto ou status não são usados como regra genérica de exclusão.

Dashboard: contagens, valores por status/período, listas recentes, logística e caixa de ações passam a considerar pedidos sem classificação de teste. Métricas financeiras de clientes usam o mesmo escopo, mantendo suas regras de evidência, bruto, estorno e líquido. Admin abre em **Comerciais** e permite **Histórico de testes** ou **Todos**, com identificação na lista/detalhe; busca e filtros são feitos no servidor e o histórico pode ser paginado. A API sem filtro explícito continua retornando todos para preservar compatibilidade das consultas existentes. Busca numérica identifica o número do pedido, sem confundi-lo com dígitos em emails.

O acumulado de fidelidade preserva zero válido da carteira, sem recuperar os 475 pontos antigos por fallback. Histórico de movimentações e obrigações financeiras continuam preservados; classificar pedidos não liquida/cancela cobranças nem sana carteiras ou estoques. A abertura das carteiras continua sendo o tratamento separado da seção 40.

Ensaio restrito ao clone: `node scripts/verify-restored-clone.mjs --backup-dir <diretório privado existente> --rehearse-reporting`. Exige o backup aprovado e o fingerprint completo dos 24 pedidos do snapshot de 15/10, confere identidade do container/banco e recusa divergências. Grava 24 classificações e 24 auditorias em transação; replay mantém uma classificação por pedido e não duplica auditoria. Não é ferramenta de aplicação em homologação compartilhada ou produção.

Execução `64ba5a45a66728c774138db05b754884`, **16:14:06–16:15:36 BRT**: três cenários passaram. Dashboard comercial sem pedidos/valores/ações do histórico; 24 pedidos acessíveis e pagináveis; pedido antigo não classificado continua no escopo comercial. Compra manual sintética nova de R$ 100 aparece uma vez, solicitação de estorno conserva o valor e confirmação/replay resultam em R$ 100 bruto, R$ 100 devolvido e R$ 0 líquido nas métricas do cliente. Pedidos/itens/históricos originais preservados. SQL de diff vazio, segundo deploy de migrations e preservação dos dados/sequências aprovados; leituras HTTP preservaram todas as tabelas. A primeira rodada detectou a ambiguidade da busca por número/email, corrigida antes deste resultado.

**Validação complementar:** nove testes unitários focados, cinco proteções do clone, três testes do executor de homologação, 16 testes financeiros de clientes e quatro testes de operações no navegador aprovados. Novo cenário no navegador passou com 103 pedidos sintéticos: escopos, busca fora da primeira página, paginação, identificação no detalhe, rejeição de filtro inválido e acesso a pedido de outra loja. A primeira execução desse teste falhou apenas na comparação da capitalização do rótulo renderizado; corrigida a asserção, o cenário completo passou. TypeScript, lint, diff e build de produção isolado aprovados. Evidência: [L-INDICADORES-CLASSIFICACAO-CLONE-2026-10-16.json](../../../../../../trabalho_em_dupla/evidencias/L-INDICADORES-CLASSIFICACAO-CLONE-2026-10-16.json).

**Publicação e limites ao concluir esta etapa:** candidata local, ainda sem commit/push/deploy desta alteração. Aplicar a migration estrutural antes de executar esta versão da aplicação; a classificação de dados exige reauditoria dos IDs/estado e procedimento próprio no destino, pois o ensaio não é reaplicável a outro banco. A main e seu banco permanecem somente leitura. A interpretação financeira, então pendente, foi tratada posteriormente na seção 53. Escopo histórico de resgates de fidelidade, recuperação por outro operador e validações remotas continuam pendentes.

## 53. Interpretação financeira do dashboard — 16/10/2026

Retomada autorizada enquanto Vanderlei levanta os acionadores para a transferência financeira ao Cloud Run. Referências de continuidade: `origin/main` em `7f9b26e062ec2654420fecffb6dd78ad3ba1e017` e candidata local baseada em `17366e8b5c2a44bd2c0157a159a371886b3126d1`. Reaproveitada a política de evidências das métricas de clientes, preservando as correções posteriores à main.

**Implementação local:** `lib/commerce/financial-evidence.ts` concentra a interpretação compartilhada. `services/dashboard-financial.service.ts` consulta os fatos em um único snapshot, por loja, incluindo visitantes e excluindo somente pedidos explicitamente classificados como teste. A tela apresenta hoje, mês e histórico, cada um com reconhecimento bruto, liquidação bruta, estornos confirmados e reconhecimento menos estornos. Autorização e liquidação do mesmo instrumento contam uma única venda; parcelas são somadas e o denominador do ticket conta pedidos. Solicitar estorno não reduz o valor; confirmação/replay não duplicam a devolução. Cancelamento sem valor reconhecido fica separado.

**Datas e limites contábeis:** períodos em Brasília pela primeira data de registro de cada confirmação no livro (`FinancialFact.createdAt`), com política `RECORDED_FINANCIAL_FACTS_V1`. O escritor existente pode reutilizar a data original do pagamento em `occurredAt` de estorno/liquidação; por isso, esse campo não foi apresentado como data bancária própria. Não houve reescrita dos fatos imutáveis nem alteração do processamento de pagamentos. Devolução registrada em outro mês entra nesse mês e preserva o reconhecimento anterior; o líquido do período pode ser negativo. Liquidação é bruta e exige fato `SETTLED`; não é saldo bancário disponível, receita líquida de taxas ou lucro.

**Composição e cobertura:** produtos após descontos, frete e encargos usam o contrato congelado integralmente reconhecido, no histórico e antes dos estornos. Reconhecimento parcial ou contrato sem composição conferida aparece como não alocado, sem rateio inventado. Legados sem provas e inconsistências tornam a cobertura parcial; status `PAID`, datas do pedido e total do contrato não fabricam recebimento. O total de frete da logística foi renomeado para contratado, incluindo pendentes/cancelados. Conversão passa a identificar pedidos com valor reconhecido. Cache `aggregated_metrics_v3`, TTL de 60 segundos e instante da consulta visível.

**Validação:** oito integrações do agregador e as 16 regressões financeiras de clientes passaram em PostgreSQL descartável; incluem reconhecimento versus liquidação, parcelas/encargos, devoluções parciais e duplicadas, meses distintos, meia-noite de Brasília, sessão PostgreSQL em fusos diferentes, visitantes, isolamento de loja, fatos futuros e exclusão dos testes. Um cenário real no navegador passou em desktop e 390 px, incluindo cobertura parcial e valores separados. Seis unitários focados, TypeScript, lint e build de produção isolado aprovados. As primeiras rodadas detectaram uma fixture sem modalidade de entrega e uma asserção dependente da capitalização visual; corrigidas antes da aprovação, sem afrouxar regras financeiras.

No clone restaurado do backup de 15/10, o ensaio de classificação `7dabcb77bc339ec06375cc5c27c94900`, **17:00:37–17:02:19 BRT**, passou nos três cenários com a nova apuração: histórico preservado, classificação/replay auditáveis, compra nova e estorno sem duplicação; dados/sequências preservados, diff vazio e repetição das migrations aprovada. Evidências agregadas e hashes: [L-DASHBOARD-FINANCEIRO-2026-10-16.json](../../../../../../trabalho_em_dupla/evidencias/L-DASHBOARD-FINANCEIRO-2026-10-16.json). Registros e hashes das etapas anteriores continuam como evidências históricas, sem atualização retroativa.

Conferência complementar `71ebc10e70a3639084d880862923613e`, **17:09:10–17:11:33 BRT**: três cenários de indicadores aprovados no clone, incluindo legados pagos sem fatos com cobertura parcial/zero reconhecido e ciclo manual de estorno alinhado aos clientes; tabelas, dados/sequências e histórico preservados. Duas tentativas anteriores pararam na limpeza do servidor temporário por retorno não zero do `taskkill`. O helper passou a aceitar encerramento somente após comprovar saída do processo e fechamento da porta local; as proteções de destino/identidade e os cinco testes de guardas continuam aprovados. Não houve mudança de regra financeira para fazer o ensaio passar. Três testes do executor de homologação também aprovados.

**Estado e próximo passo:** correção implementada e validada localmente; publicação e conferência no ambiente de homologação ainda pendentes de coordenação com Vanderlei. Não acrescenta migration além da classificação já preparada na seção 52. Nenhuma alteração em banco compartilhado, main, webhook, agendador, segredos ou deployment. Permanecem separados o histórico de resgates de fidelidade, a recuperação por operador alternativo e os demais gates de produção. Não usar esta aprovação de relatório como autorização para reativar consumidores ou trocar destino financeiro.

## 54. Candidata para revisão e implantação coordenada — 16/10/2026

O operador autorizou iniciar o próximo passo: coordenar a publicação e conferir o dashboard na homologação. Novo `git fetch origin` confirmou `origin/homologacao_teste=17366e8b5c2a44bd2c0157a159a371886b3126d1`; `origin/main` permanece referência somente leitura em `7f9b26e062ec2654420fecffb6dd78ad3ba1e017`. Nenhum commit de logout foi localizado no histórico disponível. O nome da revisão Cloud Run informado pelo operador não prova qual árvore Git foi implantada nem que alterações locais de Vanderlei estejam publicadas.

**Entrega preparada:** branch `revisao/dashboard-financeiro-20261016` com a classificação explícita, apuração financeira, testes, ferramentas de clone e evidências das seções 51–53. Inclui também a coleta somente leitura do replay do webhook e o registro histórico do ingresso Cloud Run já preparados anteriormente. Os arquivos `.env`, `.env.local` e `.env.homologacao` permanecem ignorados; valores de conexão e credenciais não compõem a entrega. A branch de revisão permite comparar o conjunto antes de atualizar a homologação compartilhada. Não atualizar `main` nem forçar histórico.

**Dependência solicitada:** Vanderlei deve indicar a branch/SHA acessível das alterações presentes em `continental-hml-896dc56-logout`, ou confirmar que continuam locais. Enquanto essa identidade estiver pendente, não substituir a revisão ativa com uma reconstrução da base antiga. A integração deve conservar logout e demais correções dele, resolver conflitos explicitamente e executar os gates no commit combinado.

**Conferência antes do envio:** 809 testes unitários em 90 arquivos e sete testes da coleta de replay passaram. Os 16 hashes de fontes/testes/ferramentas da evidência financeira correspondem à candidata; verificações de whitespace e de padrões de segredos nas alterações não encontraram ocorrências. Permanecem válidos os ensaios focados, navegador, clones e build descritos na seção 53. Isso não substitui a CI da futura revisão integrada nem valida automaticamente um deployment do Google Cloud.

**Sequência de implantação pelo responsável do Cloud Run:**

1. Integrar as duas entregas em uma revisão identificada e aprovada nos gates; gerar a imagem dessa revisão e registrar o digest. Confirmar banco separado de homologação e a identidade da loja, sem expor valores secretos. Não usar credenciais de origem/main.
2. Preservar backup/estado de migrations do destino. Pelo procedimento de migrations já configurado para esse banco, conferir `prisma migrate status` e aplicar somente a cadeia pendente revisada. A candidata exige `20261016193000_order_reporting_exclusion`; se houver outras pendências/falhas, investigar antes de aplicar. O SQL cria estrutura e restrições; não classifica nem altera os pedidos existentes. Não usar `db push`, `reset` nem o classificador de clone em banco compartilhado.
3. Confirmar migration aplicada, ausência de drift e compatibilidade da revisão anterior. Publicar a candidata primeiro sem transferir tráfego, mantendo `APP_MAINTENANCE_MODE=false` e `CHECKOUT_PAUSED=true` conforme a configuração informada para Cloud Run. Preservar as configurações financeiras efetivas; esta entrega não define nova agenda nem muda webhook.
4. Na revisão candidata, conferir catálogo, autenticação e logout; abrir o dashboard como Admin. Registrar revisão/digest, horário/loja, cobertura e valores de hoje/mês/histórico. Comparar com fatos válidos do mesmo banco e a mesma base temporal de registro, considerando o cache de até 60 segundos. Um screenshot isolado não comprova o cálculo nem a ausência de efeitos repetidos.
5. Conferir: autorização não aparece como liquidação; estorno confirmado não apaga o bruto; produtos/frete/encargos pertencem à composição histórica; legados sem fatos sinalizam cobertura parcial; pedidos explicitamente classificados como teste continuam acessíveis no histórico. Não classificar todos os pedidos da homologação como teste por data/nome e não repetir cobranças/estornos para testar a tela.
6. Só promover o digest conferido após preservar o trabalho de Vanderlei e aprovar a conferência. Em erro de schema ou de interpretação, manter/restaurar o tráfego na revisão anterior e investigar. Não remover a tabela aditiva nem desfazer dados para rollback da aplicação.

**Evidência a retornar:** branch/SHA integrado, revisão Cloud Run/digest, resultado da migration e conferência do painel/logout. Sem credenciais, tokens ou payloads pessoais. O inventário dos acionadores e a transferência financeira continuam em frente separada; o Worker antigo permanece desabilitado conforme o log observado, e esse único log não comprova ausência de outros acionadores.

## 55. Integração das correções de Vanderlei — 16/10/2026

Após o operador confirmar o push, `git fetch origin` trouxe `93e6459d06e6e9a5fbc8f1b77fc1fdd95435a004` em `homologacao_teste`. O histórico contém `8c7f8651a3319c8568206be50acb8d7675c00d34` (aliases exatos de host para a loja), `896dc564a6365bfbf2dd64fddb32b5a7aca8c951` (logout relativo ao host público) e as evidências de implantação/acionadores. Resolvida a lacuna de disponibilidade do código da seção 54; não é necessário pedir a Vanderlei novamente esses commits.

Integrado por merge, sem conflitos e sem reescrever histórico, à branch `revisao/dashboard-financeiro-20261016`, candidata anterior `0eef7240d3b0b0f94fa6c26e5627b3cee3303340`. Os arquivos de domínio/logout e seus testes permanecem idênticos aos do commit de Vanderlei. Nenhuma configuração remota foi aplicada pelo merge. O arquivo versionado `homologacao-maintenance.env.json` descreve manutenção inicial; sua presença não substitui a evidência da configuração efetiva da revisão ativa.

**Validação da árvore integrada:** 836 testes unitários em 92 arquivos aprovados; 25 testes com PostgreSQL/Next/Chrome isolados aprovados (oito do dashboard, 16 das métricas de clientes e um cenário de tela desktop/celular). TypeScript, lint dos arquivos incorporados, verificação de whitespace e build de produção isolado aprovados. Run isolado `577cc149d69e7fae4c68b84564b4aeb6`. Evidência: [L-DASHBOARD-INTEGRACAO-VANDERLEI-2026-10-16.json](../../../../../../trabalho_em_dupla/evidencias/L-DASHBOARD-INTEGRACAO-VANDERLEI-2026-10-16.json). A CI do GitHub deve ser conferida para o novo head do PR; o resultado de um head anterior não é aprovação do merge integrado.

**Infraestrutura informada por Vanderlei:** [V-ACIONADORES-2026-10-16.json](../../../../../../trabalho_em_dupla/evidencias/V-ACIONADORES-2026-10-16.json) registra em 16/10 às 19:56:50 UTC ausência de Cloud Run Jobs no levantamento, API Cloud Scheduler desabilitada e listagem de agendas não concluída. Revisão `continental-hml-896dc56-logout` com 100% do tráfego, manutenção desligada, checkout pausado e `PAYMENT_REMOTE_ENABLED`, `PAYMENT_WORKER_ENABLED`, `PAYMENT_EXPIRATION_ENABLED` em `false`. Isso é evidência fornecida por Vanderlei, não nova consulta independente nem autorização para habilitar consumidores. Inventário de acionadores ainda incompleto segundo a própria evidência.

**Próximo passo de implantação:** revisar o novo head do [PR #8](https://github.com/ViniMoia/Sistema-E-Commerce/pull/8), conferir os gates e executar a sequência 54.1–54.6 usando a revisão integrada. Vanderlei deve comprovar a migration `20261016193000_order_reporting_exclusion` no destino de homologação antes de direcionar tráfego à nova aplicação e registrar revisão/digest e conferência autenticada do dashboard/logout. Não reaplicar o classificador de clone no banco compartilhado. Publicar código não classifica pedidos automaticamente nem transfere o webhook/consumidor financeiro. Nenhuma escrita em banco compartilhado, alteração da main, merge do PR ou promoção de tráfego ocorreu nesta integração.

## 56. Conferência dos valores e evidências reais de homologação — 16/10/2026

Consulta às **17:42:15 BRT**, transação `RepeatableRead` e `transaction_read_only=on`, conexão fixa de homologação validada por host/banco, loja e identidade do #6. Nesta cópia, `.env.homologacao` não contém as conexões; foi usada a conexão aprovada de `.env.local`, sem carregar a origem/main. Nenhuma credencial foi exposta. O banco contém oito pedidos e 34 fatos financeiros; `OrderReportingExclusion` ainda não existe no snapshot, e não há registro dessa migration aplicada. Nenhuma DDL/DML ou chamada ao Asaas foi executada.

Para adiantar a nossa conferência, os campos financeiros mínimos foram reproduzidos em PostgreSQL descartável, com classificação vazia explicitamente assumida. Executada a consulta real da candidata transpilada localmente e comparados os totais a uma apuração independente em centavos por instrumento. Trata-se de projeção financeira, não restauração integral, prova de deployment ou leitura do dashboard remoto. Evidência sanitizada: [L-DASHBOARD-CONFERENCIA-HML-2026-10-16.json](../../../../../../trabalho_em_dupla/evidencias/L-DASHBOARD-CONFERENCIA-HML-2026-10-16.json). Snapshot técnico privado e scripts da conferência ficam em `artifacts/dashboard-review/`, ignorados pelo Git.

| Pedido | Reconhecido bruto | Liquidação registrada | Estorno confirmado | Reconhecido após estornos |
|---|---:|---:|---:|---:|
| #1 PIX | R$ 24,95 | R$ 24,95 | R$ 0,00 | R$ 24,95 |
| #2 PIX cancelado sem pagamento | R$ 0,00 | R$ 0,00 | R$ 0,00 | R$ 0,00 |
| #3 PIX, devolução em revisão | R$ 49,90 | R$ 49,90 | R$ 0,00 | R$ 49,90 |
| #4 crédito 12x | R$ 360,72 | R$ 0,00 | R$ 360,72 | R$ 0,00 |
| #5 crédito 1x | R$ 57,20 | R$ 0,00 | R$ 57,20 | R$ 0,00 |
| #6 boleto pago | R$ 49,90 | R$ 49,90 | R$ 0,00 | R$ 49,90 |
| #7 boleto cancelado sem pagamento | R$ 0,00 | R$ 0,00 | R$ 0,00 | R$ 0,00 |
| #8 boleto pendente | R$ 0,00 | R$ 0,00 | R$ 0,00 | R$ 0,00 |
| **Total** | **R$ 542,67** | **R$ 124,75** | **R$ 417,92** | **R$ 124,75** |

Mês e histórico coincidem nesse recorte; os quatro valores de hoje (16/10, Brasília) são zero. #4/#5 têm autorização e devolução, sem fato `SETTLED`: não inventar liquidação por causa do status anterior ou do estorno. Os dois valores finais de R$ 124,75 coincidem nesta base, mas representam medidas diferentes e não comprovam saldo bancário disponível.

**Achado e correção:** #3 mantém tentativa `REFUND_PENDING` com `PAYMENT_REFUND_CANCELLED_REVIEW`, mas a expressão de revisão compartilhada não incluía esse código. Foi acrescentado ao alerta, preservando R$ 49,90 reconhecidos/liquidados e zero estorno confirmado. Dashboard e clientes agora sinalizam cobertura **parcial, um pedido em revisão**. Não foi reaberto o estorno, alterado o pedido ou consultado o provedor. A correção é posterior a `eff10bf`; Vanderlei deve usar o novo head do PR #8.

**Outros valores esperados:** pendente R$ 49,90 (#8); cancelados sem reconhecimento R$ 99,80 (#2/#7); cinco pedidos reconhecidos entre oito (63% arredondados); ticket após estornos R$ 24,95. Composição histórica antes dos estornos: produtos R$ 419,15, frete R$ 12,30, encargos R$ 61,32 e R$ 49,90 não alocados enquanto #3 está em revisão. A soma é R$ 542,67. Não são valores líquidos de taxas nem lucro. Nenhum pedido foi excluído apenas por ser um ensaio Sandbox; exclusão exige classificação explícita, distinta dos 24 legados ensaiados no clone da origem.

**Validação da correção:** nove testes de integração do dashboard, 16 regressões dos clientes e um navegador desktop/celular aprovados (run `ca8beccbc1a0686d29d9c3c2a17b8bfa`). Incluída regressão do estorno cancelado no provedor, exigindo cobertura parcial e preservação dos valores nos dois relatórios. Projeção real `cfeb9859981d1c43d7bd0fdd0ab786ff` fechou com a apuração independente.

**Conferência remota restante:** após migration e publicação da revisão corrigida, capturar baseline fresco e comparar o painel autenticado na mesma loja, data e escopo, após o cache de até 60 segundos. Conferir aviso de cobertura parcial e os quatro indicadores por período. Se houver fatos/classificações novos, recalcular antes de comparar; não alterar dados para reproduzir os números acima. O código e as evidências já permitem adiantar nossa análise, mas não encerram a validação da revisão publicada nem a pendência operacional do #3.

## 57. Escopo histórico e valores do relatório de fidelidade — 16/10/2026

Operador autorizou avançar nesta pendência das seções 51–53 enquanto a publicação de `dbfeb1f` aguarda Vanderlei. Consultados novamente código e runbook de `origin/main` `7f9b26e062ec2654420fecffb6dd78ad3ba1e017`, sem alteração da origem ou consulta ao banco principal. Base local desta entrega: `dbfeb1f` na branch de revisão do dashboard.

**Achados:** a API do relatório somava resgates de todos os pedidos e multiplicava os pontos pelo valor atual, alterando retroativamente o desconto histórico quando a configuração mudava. O widget somava os valores monetários registrados, mas também incluía pedidos de teste e chamava o bruto de “Economia Gerada”, sem separar devoluções. O acumulador válido igual a zero já estava corrigido; não foi reaberto esse problema nem usado o ledger antigo para repor o zero.

**Correção local:** `services/loyalty-report.service.ts` passa a atender API e widget, em transação `RepeatableRead`, somente leitura. Concessões, reversões de ganhos, resgates e devoluções são separados, vinculados a pedidos da loja e excluem apenas a classificação explícita de teste. O total de resgates não depende de `PAID`: representa o movimento de pontos registrado, inclusive no checkout, e não recebimento financeiro. `monetaryValue` preserva a cotação histórica; ausência não é substituída pela cotação atual. A tela mostra bruto, devolvido e diferença, com aviso quando existem valores ausentes ou movimentos sem vínculo com pedido da loja. Os valores monetários nesses casos são subtotais conhecidos, não estimativas do total ausente.

Carteiras, dívidas e histórico de auditoria continuam completos, incluindo efeitos de testes e ajustes. A classificação não apaga nem reduz obrigações. `lifetimeEarn` permanece o acumulador registrado das carteiras, separado das concessões comerciais brutas; carteiras legadas recebem aviso de conciliação pendente. A cotação atual só valoriza o saldo para uma estimativa sujeita às regras de resgate. As movimentações de pedidos de teste permanecem visíveis com identificação. Nenhum escritor de pontos, cancelamento, expiração, pagamento ou estorno foi modificado; nenhuma migration adicional foi criada. Cache do dashboard atualizado para `aggregated_metrics_v4`, TTL mantido em 60 segundos; API do relatório sem cache.

**Validação:** quatro integrações novas e um cenário de navegador autenticado passaram em PostgreSQL/Next/Chrome descartáveis, run `b60ac50ac0f1045067956674e75b3ac4`. Cobrem mudança de cotação, classificação explícita, isolamento entre lojas, valores ausentes versus zero, preservação de saldo/dívida/histórico, replay real de resgate/devolução, igualdade da API com o dashboard e telas desktop/celular. Os 17 testes existentes de lotes/concorrência/expiração e o navegador financeiro também passaram na rodada anterior `1644473951410eb633ae1bd81192438f`; essa rodada falhou em três cenários novos por duas fixtures inválidas e zero negativo na projeção. Corrigidas as fixtures conforme as restrições existentes e normalizado o zero na projeção, sem flexibilizar controles de negócio; todos os cinco novos cenários passaram na repetição. Os 46 unitários de fidelidade, TypeScript e lint passaram. Resultado do build e hashes registrados em `trabalho_em_dupla/evidencias/L-FIDELIDADE-RELATORIO-2026-10-16.json`.

**Continuidade remota:** o fetch trouxe `eb0708c` de Vanderlei, somente documentação, relatando migration aplicada e validação de `eff10bf` em revisão com 0% de tráfego. O registro é anterior à correção de cobertura de `dbfeb1f` e não prova publicação desta revisão de fidelidade. Sua evidência inclui restauração pelo próprio operador, mantendo pendente recuperação por operador alternativo. Não houve merge, publicação, promoção, nova consulta/escrita no banco compartilhado, mudança de webhook ou ativação de consumidor nesta etapa.

**Próximo passo:** revisar/publicar o conjunto atualizado em homologação e conferir `/admin/fidelidade` e o widget no mesmo escopo, com baseline fresco e cache considerado. A implementação e a validação isolada do escopo histórico estão concluídas; o aceite remoto permanece pendente. Não usar esta correção de relatório para classificar pedidos, sanear carteiras ou retomar a operação financeira do #3.

## 58. Correção da CI e da invalidação do dashboard — 16/10/2026

Na ausência de Vanderlei, retomada a preparação da candidata. A entrega de fidelidade `f7762b3` e a documentação dele `eb0708c` foram reunidas em `d65c1ed` no PR #8. A [CI 38968865487](https://github.com/ViniMoia/Sistema-E-Commerce/actions/runs/38968865487) desse head falhou em dois unitários de `dashboard-service.test.ts`: o mock anterior de Prisma não representava o novo serviço compartilhado de fidelidade. A falha foi reproduzida localmente antes da correção.

O unitário passou a simular a dependência `readLoyaltyReport`, assim como já fazia com a apuração financeira, mantendo os testes de banco real da seção 57. Acrescentadas asserções de cobertura parcial, valores históricos, dívida, zero válido, validade sem expiração, histórico de teste e isolamento de cache entre lojas. Ao alcançar novamente a asserção de invalidação, foi identificado um defeito real: gravação em `aggregated_metrics_v4` e exclusão ainda em `aggregated_metrics_v3`. Leitura e invalidação agora usam a mesma constante; o teste comprova nova consulta após invalidar uma loja e preservação do cache de outra.

As duas suítes novas de fidelidade foram incluídas em `homologation-suites.mjs`, utilizado pela CI e pelos executores isolados. Nenhum teste foi desabilitado nem foi alterada a apuração de dinheiro/pontos para obter aprovação.

**Validação local:** 836 unitários em 92 arquivos, três testes do executor, TypeScript, lint focado e whitespace aprovados. A rodada anterior com 835/836 aprovados registrou a falha de invalidação antes de corrigi-la. Os testes de integração/navegador e build da seção 57 permanecem evidências da implementação anterior; a nova execução completa da CI deve aprovar o novo head antes da publicação. Não declarar que o resultado de `eff10bf` aprova esta entrega.

**Trabalho independente que pode avançar enquanto a publicação aguarda:** acompanhar os gates do novo head e resolver falhas; consolidar uma matriz G1–G8 vinculada a evidências/revisões, distinguindo ensaio local, homologação e produção; revisar o pacote de abertura do banco existente e a conferência comercial final, preservando decisões já tomadas. Continuam dependentes de coordenação a publicação/promover tráfego, troca de webhook/agendadores, configuração real de Storage/e-mail, recuperação por operador alternativo e aplicação do tratamento no banco produtivo. Nenhuma dessas operações foi executada nesta correção.

## 59. Checklist G1–G8 e aprovação da CI da candidata — 16/10/2026

Consolidado o [checklist de produção G1–G8](../../../../../../trabalho_em_dupla/CHECKLIST_PRODUCAO_G1_G8.md), por solicitação do operador, com responsáveis, evidências reaproveitáveis, limites por ambiente e condições objetivas de fechamento. Consultada a referência somente leitura `origin/main` `7f9b26e062ec2654420fecffb6dd78ad3ba1e017` e incorporadas as evidências de Vanderlei disponíveis em `eb0708c`. Não há solicitação nova de projeto/região: a homologação Google Cloud já está identificada como `continental-511812` / `southamerica-east1`.

**CI aprovada:** [execução 38969534735](https://github.com/ViniMoia/Sistema-E-Commerce/actions/runs/38969534735), SHA **`55a300313570f2a504a8f042ba7f228cd7382e58`**, concluída às **21:54:47 UTC / 18:54:47 BRT**. Conferência da API do GitHub às 22:28:37 UTC confirmou `completed/success` e todos os passos aprovados, incluindo testes, migrations, isolamento, build/runtime com duas instâncias, manutenção/recuperação, standalone, capacidade com provedores descartáveis e contêiner Linux. Está resolvida a pendência de CI da seção 58 para esse SHA. A aprovação não prova deploy, configuração efetiva ou capacidade comercial do destino.

**Evidência remota já recebida:** a migration de classificação foi aplicada à homologação por Vanderlei e `eff10bf` foi conferido em revisão com 0% de tráfego, conforme seção 57 e o documento dele. Isso resolve a pendência histórica da migration nesse banco. Não comprova publicação das correções posteriores de cobertura financeira, fidelidade e invalidação. Mantém-se necessária a conferência da candidata atual com baseline fresco; não usar o `COMPLETE` observado em `eff10bf` para encerrar a revisão do #3.

**Decisões preservadas:** boleto e débito fazem parte do escopo obrigatório; a exceção aceita é o adiamento do teste de expiração do boleto, que permanece pendente. A linha G1 da seção 9 foi alinhada a essas decisões para não continuar orientando a exclusão histórica de boleto. Casos #4/#5/#6/#7 concluídos nos recortes registrados não serão repetidos sem alteração relevante. #3 permanece em revisão e #8 preserva os prazos reais. A retirada dos produtos de teste inclui somente o aspirador automotivo vermelho, preservando os outros aspiradores comerciais.

**Próxima frente independente recomendada:** G2, revisão do pacote de abertura do banco existente, com comparação dos ensaios, inventário/diferenças a conferir e roteiro de recuperação por operador alternativo. Preparar também o aceite remoto de dashboard/fidelidade e os procedimentos comerciais pendentes. Publicação, transferência financeira, configurações reais e abertura produtiva permanecem dependentes de suas evidências e coordenação; nenhum gate global foi aprovado por esta consolidação. Esta etapa alterou apenas documentação, sem testes adicionais desnecessários, escrita em banco, operação financeira, deploy, promoção de tráfego ou alteração de segredos.

## 60. Revisão e reensaio do pacote de abertura G2 — 16/10/2026

Operador autorizou dar continuidade à preparação. Reconsultados `origin/main` `7f9b26e062ec2654420fecffb6dd78ad3ba1e017`, runbooks, evidências e executores de clone. Preparado o [pacote G2](../../../../../../trabalho_em_dupla/PACOTE_ABERTURA_G2.md) com IDs dos quatro produtos de teste e cinco produtos protegidos, limites do tratamento dos 24 pedidos/33 itens, abertura auditada das duas carteiras, matriz de comparação antes/depois e ficha de recuperação por operador alternativo. Os runbooks receberam referências ao estado atual, sem apresentar o Cloud Run de homologação como infraestrutura ainda inexistente.

**Validação nova:** entre **22:33:33 e 22:35:07 UTC / 19:33:33 e 19:35:07 BRT**, executado `verify-restored-clone.mjs --backup-dir <diretório privado existente> --rehearse-reporting` com o código de `55a3003`. Reutilizado o backup capturado em 15/10 às 18:43:55 UTC; nenhuma leitura nova da origem, nenhuma carga automática de conexão compartilhada. Dois restores equivalentes, sanitização exclusiva do clone, novo restore sanitizado, histórico/upgrade de migrations, preservação de dados/sequências e diff vazio aprovados. Quatro produtos/dez variantes ficaram indisponíveis, preservando os outros aspiradores; abertura das carteiras e classificação dos 24 pedidos tiveram replay sem duplicação.

Nove verificações HTTP da aplicação, três testes dos relatórios sobre o clone e cinco testes de proteção do executor aprovados. Dashboard e API de fidelidade atuais preservaram o zero comercial após classificação e o histórico acessível; fixtures controladas verificaram reconhecimento/estorno sem chamadas externas. A rodada não repetiu os 20 comandos de legado nem a compra completa da seção 40; essas provas permanecem históricas e identificadas separadamente. Contêiner principal descartado e ausência conferida. Evidência sanitizada, hashes e limites: [L-G2-REVISAO-ABERTURA-2026-10-16.json](../../../../../../trabalho_em_dupla/evidencias/L-G2-REVISAO-ABERTURA-2026-10-16.json).

**Resultado e limite:** preparação de G2 avançou, mas o gate continua aberto. Os executores atuais recusam banco compartilhado e não constituem o executor final de produção. Faltam manifesto/baseline fresco, confirmação de saldos comerciais e obrigações, execução final especificamente preparada/revisada, contenção no destino e recuperação por outro operador. O backup depende da conta Windows original; aproximadamente 94 segundos de ensaio local não são RTO comercial. Nenhum segredo foi exportado, banco principal modificado, provedor financeiro acionado ou deployment realizado. A próxima preparação independente pode avançar para a ficha única de aceite remoto do dashboard/fidelidade, já prevista no checklist, sem repetir pagamentos/estornos.

## 61. Ficha única de aceite remoto do dashboard e fidelidade — 16/10/2026

A pedido do operador, preparada a [ficha de aceite remoto](../../../../../../trabalho_em_dupla/ACEITE_REMOTO_DASHBOARD_FIDELIDADE.md) e seu [modelo JSON](../../../../../../trabalho_em_dupla/modelos/ACEITE_DASHBOARD_FIDELIDADE.json). Consultados a origem somente leitura `7f9b26e062ec2654420fecffb6dd78ad3ba1e017`, os contratos da candidata `55a3003`, componentes, API e evidências existentes. Não houve alteração no código da aplicação ou consulta remota de banco/aplicação nesta etapa.

A ficha exige SHA/digest/revisão/URL e loja efetivos antes de comparar; baseline fresco em transação somente leitura, cálculo independente e registro de esperado/observado/diferença por campo. Dashboard, widget e API não são um snapshot global único: considerar cache de até 60 segundos, horários, alterações concorrentes e mudança de dia/mês. Resposta da API não serve como cálculo independente de si mesma. Estado financeiro usa data de registro dos fatos e cobertura explícita; fidelidade separa saldo/dívida das carteiras de concessões/resgates/devoluções comerciais e valores monetários históricos.

Os números da seção 56 permanecem referência do recorte antigo, sujeitos a comprovação de equivalência; a fidelidade remota ainda precisa de apuração numérica atual. A ficha prevê comparação API/página/widget, diferenças de nomes dos campos e limites de cinco/dez movimentos recentes, cobertura parcial, avisos de legado, desktop/390 px, acesso anônimo e logout. Não pede criação de dados, ajustes, pagamento, estorno ou replay para validar relatórios. Dados pessoais das movimentações e credenciais não devem integrar a evidência compartilhável.

**Validação desta entrega:** leitura dos contratos/rotas/componentes, sintaxe do modelo JSON, verificação dos links locais e whitespace. Não foram repetidas suítes da aplicação, pois houve somente preparação documental. Modelo permanece `NOT_EXECUTED`, campos não observados como `null` e nenhum aceite global de G3/G4/G8. Próximo passo dependente da publicação: obter a identidade efetiva da revisão atual de Vanderlei e executar a rodada única com baseline fresco. Enquanto isso, procedimentos de atendimento de revisão financeira/devolução após entrega/chargeback continuam como frente independente do checklist.

## 62. Procedimento de revisão financeira, devolução e chargeback — 16/10/2026

Preparados o [roteiro operacional](https://github.com/ViniMoia/Sistema-E-Commerce/blob/3c3bf725e96f33bcb38143cfd2e3f4c017298049/trabalho_em_dupla/ATENDIMENTO_REVISAO_DEVOLUCAO_CHARGEBACK.md) e [modelo de caso](../../../../../../trabalho_em_dupla/modelos/CASO_REVISAO_FINANCEIRA.json), com responsáveis, preflight por identidade, separação de dinheiro/pontos/mercadoria, comunicação e condições de fechamento. Revisados código de `55a3003`, origem somente leitura `7f9b26e062ec2654420fecffb6dd78ad3ba1e017`, testes existentes e documentação oficial de consulta/disputa do Asaas. Nenhum prazo universal de contestação ou crédito foi presumido; registrar prazo e elegibilidade do caso na conta efetiva.

**Achados operacionais:** `payment-reconcile` altera `reconcileAfter`/`reviewAfter` e recoloca inbox correlacionada de DEAD_LETTER em READY; não é consulta inofensiva e a repetição não é eliminada antes dessas escritas. `PAYMENT_REVIEW` mantém revisão/auditoria, mas não envia e-mail de atendimento no processamento atual. Após estorno de pedido SHIPPED/DELIVERED, o código preserva estoque/estado físico, compensa pontos pelo serviço existente e marca `PHYSICAL_RETURN_REQUIRED`. Não foi encontrado comando próprio para recebimento/inspeção/encerramento físico; `adjustInventory` é genérico, auditado e idempotente por comando, sem vínculo obrigatório com devolução ou fechamento de reserva/revisão. Não limpar o código por SQL como substituição.

**Chargeback:** o teste isolado de `CHARGEBACK_REQUESTED` exige `PAYMENT_EXTERNAL_STATE_REVIEW` sem estorno inventado, reposição de estoque ou reversão indevida de pontos. Isso não implementa disputa nem encerramento do resultado do provedor. O procedimento prevê registro de ID próprio do chargeback, prazo/evidências privadas, responsável, decisão e acompanhamento; a disponibilidade na documentação oficial não comprova homologação da conta. As lacunas de resultado financeiro, pontos, reserva e encerramento auditado continuam explícitas.

**Limites preservados:** REFUND de boleto é recusado pelo comando atual; não há valor parcial no contrato de CANCEL/REFUND. `manualRefund` é exclusivo de MANUAL/WHATSAPP_PIX e não serve para forçar confirmação de estorno Asaas. #3 permanece em revisão; #4/#5/#6/#7 não foram repetidos; #8 permanece reservado. Relatório com cobertura parcial correta não encerra a obrigação financeira.

**Validação:** revisão documental dos contratos e testes existentes, links locais, JSON e whitespace; nenhuma suíte foi reexecutada porque não houve mudança de runtime. O modelo está `NOT_OPENED`, sem efeitos, aprovação ou dados pessoais. Não houve mensagem a terceiros, consulta ao banco, chamada autenticada ao Asaas, comando de estoque/financeiro, disputa, reativação de fila ou deploy. Próxima frente técnica independente: definir e implementar o encerramento físico auditado em ambiente isolado, com vínculo de recebimento/item e prevenção de reposição duplicada, preservando o estado financeiro. G3 e G6 não são aprovados pela elaboração deste roteiro.

## 63. Encerramento auditado do retorno físico integral — 19/10/2026

Implementado o próximo avanço independente previsto na seção 62: o Admin pode registrar recebimento e inspeção de todos os itens de pedido SHIPPED/DELIVERED após estorno integral confirmado. Base `55a3003`; consultados `origin/main` `7f9b26e062ec2654420fecffb6dd78ad3ba1e017` e `origin/homologacao_teste` `eb0708c`, sem escrita na origem. A lacuna de comando físico registrada em 16/10 passa a ter implementação local; isso não demonstra publicação ou aceite no Cloud Run.

**Contrato:** GET/POST `/api/admin/orders/[orderId]/physical-return`, Admin ativo da mesma loja, versão e commandId. Exige tentativa REFUNDED com PHYSICAL_RETURN_REQUIRED, fatos de estorno somando o valor integral, conta/provedor coerentes e reservas COMMITTED vinculadas aos IDs e quantidades de cada item. Recebimento parcial é recusado. A conferência informa unidades aptas para venda; o restante vai para estoque indisponível. Produtos/variantes retirados permanecem indisponíveis, independentemente da quantidade declarada apta. Não há seleção automática de outra variante.

**Efeito único:** transação com bloqueio de pedido/produtos/variantes grava estoques, reservas RETURNED, versão do pedido, fechamento da revisão física e comprovante de auditoria único por pedido. Replay idêntico pelo mesmo operador retorna o comprovante; outro conteúdo ou commandId não repõe novamente. Mantém o histórico SHIPPED/DELIVERED, sem chamada financeira, novo fato ou alteração de pontos. Invalida eventual lease da outbox da revisão física para impedir conclusão atrasada com estado antigo; não fecha alertas de outros motivos. A conciliação posterior reconhece o comprovante e não reabre essa revisão nem repõe estoque.

**Admin:** formulário no detalhe do pedido elegível, referência da inspeção sem dados pessoais, quantidades aptas por item e declaração de recebimento integral ainda sem reposição. O comprovante permanece consultável após reload. Em resposta incerta, a interface oferece consulta e não repete o POST automaticamente. Reposições feitas por ajuste genérico antes deste fluxo exigem conferência humana e análise do caso; o comando não identifica a origem física desses ajustes. Não usar o fluxo para duplicá-los.

**Validação isolada:** 88 testes aprovados em quatro suítes PostgreSQL/Next/Chrome, run `bebc1fafd175ff4a4305a972c061b143`: 10 do comando físico, um navegador, 56 de pagamentos duráveis e 21 de expedição/retirada. Cobrem concorrência/replay, unidades avariadas/retiradas, divisão entre disponível/indisponível, rollback na falha de auditoria, operador/loja, evidência financeira insuficiente, revisão concorrente e conciliação após fechamento. A primeira rodada aprovou 65/66 e identificou a ausência de invalidação do lease na versão carregada; a proteção e a regressão passaram na rodada final. Os 836 unitários, TypeScript e lint focado também passaram. As novas suítes foram incluídas na lista usada pela CI; a CI remota anterior de `55a3003` não valida automaticamente esta alteração.

**Verificação final:** build de produção em cópia isolada, 15 testes dos executores e `git diff --check` aprovados. O Docker Desktop estava parado na primeira tentativa de provisionamento; foi iniciado e todos os testes de banco usaram PostgreSQL descartável. Nenhum resultado isolado foi promovido a aceite remoto.

**Limites e continuidade:** sem nova migration; usa comprovante durável e restrição única de AuditLog existentes. Nenhum banco compartilhado, pedido Sandbox existente, webhook, agenda ou deployment foi alterado. [Procedimento de atendimento](https://github.com/ViniMoia/Sistema-E-Commerce/blob/3c3bf725e96f33bcb38143cfd2e3f4c017298049/trabalho_em_dupla/ATENDIMENTO_REVISAO_DEVOLUCAO_CHARGEBACK.md) e [checklist G1–G8](../../../../../../trabalho_em_dupla/CHECKLIST_PRODUCAO_G1_G8.md) atualizados. Restam integração/revisão e publicação da candidata, aceite remoto do retorno, retornos parciais e tratamento do resultado de chargeback. G3/G6/G8 permanecem abertos. [Evidências técnicas e hashes desta entrega](../../../../../../trabalho_em_dupla/evidencias/L-RETORNO-FISICO-2026-10-19.json).

## 64. Tratamento conciliado dos resultados de chargeback — 19/10/2026

Implementada localmente a continuidade da seção 63 sobre a base `55a3003`, preservando o retorno físico integral. Conferidos por fetch `origin/main` `7f9b26e062ec2654420fecffb6dd78ad3ba1e017` (somente leitura) e `origin/homologacao_teste` `eb0708c69ddda41e5b456f36b5df2e4cc6ca3cab`. Não houve mudança de configuração ou consulta a banco compartilhado. A CI histórica da base não comprova esta nova implementação.

**Resultado financeiro:** REQUESTED/IN_DISPUTE, estados desconhecidos e evidências incompatíveis mantêm revisão, bloqueio de expedição e cobertura financeira parcial. DISPUTE_LOST/DONE somente encerram a parte financeira quando a cobrança atual está REFUNDED. REVERSED exige CONFIRMED/RECEIVED e não reabre cobrança previamente estornada como paga. O tratamento segue a distinção entre [estados de chargeback](https://docs.asaas.com/docs/chargeback) e [eventos financeiros](https://docs.asaas.com/docs/payment-events), consultados em 19/10. Situação da disputa isolada não prova débito/crédito.

**Consulta e auditoria:** webhook provoca inspeção atual da cobrança; não determina sozinho o resultado. Para contestações conhecidas sem objeto na listagem, o adaptador usa a [consulta de chargeback](https://docs.asaas.com/reference/retrieve-a-single-chargeback). Falha ou identidade incompatível mantém revisão. Persiste apenas status, motivo classificado, identificador e resultado conciliado por cobrança/parcela, com auditoria idempotente da observação. O Admin apresenta a última evidência sem botão para disparar outra devolução. Não são armazenados documentos ou payload completo nessa projeção. Sem migration nova.

**Efeitos e concorrência:** devolução confirmada reutiliza fatos REFUNDED, compensações de pontos e regras existentes de retorno físico. Uma parcela devolvida não encerra o contrato integral. Reversão favorável não duplica pontos, autorização ou e-mail. REFUND local ainda READY quando surge a contestação fica retido e não é retomado automaticamente após vitória; a devolução confirmada pelo provedor pode concluir a operação sem novo POST. O resultado terminal fecha somente a revisão específica de chargeback e invalida seu lease antigo, sem apagar revisão física ou parcial ainda necessária. Recebimento/inspeção de mercadoria permanece separado do resultado financeiro.

**Validação:** 843 unitários em 93 arquivos aprovados; 97 testes de integração/navegador em seis suítes na rodada `b4b7dfe4f197bf86eb21e5c79a03b9b6`. Após acrescentar a proteção contra conclusão atrasada do alerta, a rodada final `e63912b8e532584e1819fb33ed5e06f9` aprovou 16 testes de chargeback (15 de serviço e um navegador), incluindo dois casos adicionais de webhook sem objeto e rollback da auditoria. Não somar as rodadas como casos distintos. TypeScript, lint focado, build de produção em cópia isolada e 15 testes dos executores aprovados. Banco PostgreSQL, aplicação Next e Chrome descartáveis; nenhum provedor financeiro real acionado. [Evidências e hashes](../../../../../../trabalho_em_dupla/evidencias/L-CHARGEBACK-RESULTADOS-2026-10-19.json).

**Continuidade:** integrar/revisar o conjunto de retorno físico e chargeback, executar CI da nova candidata e coordenar publicação e aceite remoto. Envio de disputa/documentos, alerta efetivamente entregue, retomada controlada de estorno retido e retornos parciais permanecem fora desta entrega. Nenhum commit/push, deploy, operação Asaas, alteração de webhook/agenda ou mutação em banco compartilhado foi realizado nesta etapa. G3/G6/G8 seguem abertos; implementação isolada não é liberação produtiva.

## 65. Consolidação local da próxima candidata — 19/10/2026

Concluída a primeira ação do roadmap, a pedido do operador: conferência das branches remotas, revisão do conjunto local e preparação do manifesto para o próximo commit. Após `git fetch origin`, a base local continua `55a300313570f2a504a8f042ba7f228cd7382e58`, em `revisao/dashboard-financeiro-20261016`. `origin/homologacao_teste` permanece `eb0708c69ddda41e5b456f36b5df2e4cc6ca3cab`, inteiramente ancestral da base local (seis commits locais à frente, zero exclusivos do remoto). Não há merge pendente para incorporar as correções de Vanderlei. Tenant por aliases e logout público, inclusive seus testes, foram comparados e estão idênticos aos da homologação remota. `origin/main` permanece `7f9b26e062ec2654420fecffb6dd78ad3ba1e017`, somente leitura.

**Conjunto revisado:** retorno físico integral, resultado conciliado de chargeback, integração no detalhe do pedido/Admin, cobertura financeira e testes/fixtures correspondentes. Revisados elegibilidade, isolamento de loja/operador, vínculo de item/reserva/variante, transação/auditoria, replay, retenção de estorno e fechamento de leases de revisão. Não foi identificada correção adicional de runtime nesta revisão. As atualizações documentais de G2/G1–G8 e aceite remoto já presentes no workspace também são preservadas, como documentação de preparação, sem transformar modelos pendentes em aceites. O manifesto enumera caminhos, grupos e hashes: [L-CANDIDATA-CONSOLIDACAO-2026-10-19.json](../../../../../../trabalho_em_dupla/evidencias/L-CANDIDATA-CONSOLIDACAO-2026-10-19.json).

**Rastreabilidade:** os 18 hashes da evidência de chargeback correspondem aos arquivos atuais. Na evidência anterior de retorno físico, nove hashes ainda coincidem; três arquivos compartilhados foram posteriormente ampliados por chargeback (`payment-evidence.service.ts`, `OrderDetailDrawer.tsx` e seleção de suítes). As evidências históricas foram preservadas; o manifesto atual registra essa sucessão, sem atribuir os testes antigos a arquivos diferentes. Nenhum código foi modificado nesta consolidação, portanto não foram repetidas as suítes já aprovadas. Conferidos JSON, links locais adicionados, whitespace e inclusão das quatro novas suítes na seleção da CI. Busca de padrões de credenciais nos trechos adicionados/arquivos novos não encontrou ocorrências; não equivale a certificação de todos os segredos do projeto. Nenhum arquivo `.env` foi lido ou incluído no conjunto.

**Próxima ação concreta:** registrar o conjunto revisado em commit na branch de revisão, publicar essa branch e atualizar a proposta de integração destinada à homologação. A CI atual dispara para pull requests destinados a `homologacao_teste` e para pushes nessa branch; um push isolado na branch `revisao/...` não garante execução sem PR correspondente ou disparo explícito. Registrar a referência efetivamente testada pela CI (inclusive o merge sintético do PR) e conferir sua equivalência ao artefato publicado. Se a base remota mudar antes da integração, repetir a comparação e as verificações afetadas. Esta etapa não criou commit, não alterou o index, não fez push, merge, deploy ou escrita em banco compartilhado. Nova candidata ainda sem SHA próprio/CI/aceite remoto; G3/G6/G8 permanecem abertos.

## 66. Publicação da candidata e atribuições de Vanderlei — 19/10/2026

### Estado comprovado e referência de publicação

- PR #8 integrado em 19/10 às 14:35:01 BRT / 17:35:01 UTC. Commit de integração: **`d63ad8a1ab2d712153177155eae518d3eddcdc86`**, branch `homologacao_teste`.
- CI da candidata **`d78fdaea03ab5ce96952a71b66914500a000a178`**: [39284614540](https://github.com/ViniMoia/Sistema-E-Commerce/actions/runs/39284614540), aprovada. CI após integração: [39295357722](https://github.com/ViniMoia/Sistema-E-Commerce/actions/runs/39295357722), aprovada, registro atualizado às 14:56:54 BRT / 17:56:54 UTC. SHA de árvore comum: `04572c84ac59ea06172c4fd47e005e426ce5db9e`.
- Registro consultado diretamente no GitHub: [evidência de integração/CI](../../../../../../trabalho_em_dupla/evidencias/L-CI-INTEGRACAO-2026-10-19.json). Não alterar o manifesto histórico de consolidação para fazê-lo parecer um registro de deploy.
- **Código integrado não é código publicado.** A última distribuição de tráfego conhecida é histórica e precisa ser consultada novamente. Aguardar SHA/digest/revisão/URL efetivos antes do aceite.
- Esta atualização é documental. Publicar o código fixado em `d63ad8a`, ou registrar explicitamente um sucessor e sua comparação/validação; não construir um HEAD mutável sem registrar qual commit foi usado.

### Atribuições de Vanderlei: preparar e publicar em homologação

1. **Confirmar o destino existente:** projeto `continental-511812`, região `southamerica-east1`, serviço `continental-hml`. URL principal conhecida: `https://continental-hml-15531616695.southamerica-east1.run.app`. Conferir configuração efetiva, identidade do banco de homologação e Asaas Sandbox por referências sanitizadas. Não inferir ambiente pelo nome do arquivo `.env`, não copiar conexões da main e não divulgar valores de segredos.
2. **Registrar a situação anterior:** revisão/digest e tráfego atuais, referências das versões de segredos, migrations aplicadas, destino do webhook e acionadores conhecidos. Preservar a revisão anterior recuperável. O checklist registra migration `20261016193000_order_reporting_exclusion` aplicada anteriormente; conferir o estado atual, sem reset/db push ou repetição de classificação. Retorno físico/chargeback não acrescentam migration.
3. **Construir o artefato identificado:** usar checkout limpo do commit aprovado, lockfile e processo de build existente. Registrar SHA, digest imutável e origem da imagem. Se usar outro commit, explicar a diferença e relacionar a CI correspondente. Não incorporar arquivos de ambiente, backups ou evidências privadas na imagem.
4. **Criar a revisão sem promoção inicial de tráfego:** manter `APP_MAINTENANCE_MODE=false` para inspeção e `CHECKOUT_PAUSED=true`. Preservar bindings e controles financeiros combinados. Enquanto Vercel ainda for responsável pelo webhook/processamento, seguir a separação de responsabilidades do [procedimento Cloud Run](../../../../../../infra/cloudrun/README.md). Se o inventário atual divergir, registrar a divergência e coordenar a troca antes de alterar flags; `PAYMENT_WORKER_ENABLED=false` também afeta a recepção de webhooks. Não habilitar um segundo acionador nesta publicação.
5. **Conferir acesso à revisão candidata:** garantir que a URL de teste resolva a loja correta, usando aliases exatos quando necessários. Verificar inicialização/conexão, catálogo e imagens, login/logout, Admin e ausência de erros inesperados. Sem promover tráfego, enviar a URL de teste e identidade da revisão para Leno.
6. **Preparar a recuperação:** em falha de inicialização, isolamento, dados ou comportamento crítico, preservar o tráfego anterior e registrar o erro sanitizado. Não remover migrations aditivas nem restaurar o banco somente para trocar a revisão da aplicação. Promoção de tráfego depende da conferência conjunta; ainda não libera vendas em produção.

### Conferência conjunta depois da publicação

| Responsável | Verificação | Evidência necessária |
|---|---|---|
| Vanderlei | SHA/digest/revisão/URL e configuração efetiva | Identidade da candidata, distribuição de tráfego, conta/ambiente por referência e estado das flags, sem segredos. |
| Leno | Dashboard, clientes e fidelidade | Baseline fresco e cálculo independente; diferenças explicadas; cobertura parcial de pendências reais preservada. Usar a [ficha existente](../../../../../../trabalho_em_dupla/ACEITE_REMOTO_DASHBOARD_FIDELIDADE.md) com o SHA sucessor e registrar separadamente o relatório de clientes. |
| Leno + Vanderlei | Admin e retorno físico | Permissões, elegibilidade, leitura do comprovante; ensaio de mutação somente em caso de homologação previamente identificado e planejado. Conferir estoque disponível/indisponível, reservas e efeitos únicos. |
| Leno + Vanderlei | Chargeback | Resultado por parcela e evidência financeira correlacionados; revisão quando incompleto, ausência de outro estorno e separação do retorno físico. Distinguir resultado isolado de consulta/evento real disponível no Sandbox. |
| Vanderlei + Leno | Infraestrutura operacional | Registrar o que já está implantado de acionadores, canais de alerta, e-mail, Storage e recuperação; separar provas disponíveis das pendências de G5/G6/G8. |

Não repetir os estornos #4/#5, reenviar eventos, rearmar #3, pagar/cancelar #8 ou criar fatos por SQL somente para fazer a tela passar. Os casos antigos são evidências históricas; novos ensaios precisam de identidade e baseline próprios. GET de consulta não autoriza POST de reconciliação, retorno ou operação financeira. Se o Sandbox não oferecer um caso de chargeback, registrar a limitação em vez de declará-lo homologado.

### Retorno que Vanderlei deve enviar

Preencher com dados observados; `pendente` significa não conferido:

```text
Commit publicado:
CI vinculada:
Imagem / digest:
Projeto / região / serviço:
Revisão candidata / URL de teste sem parâmetros secretos:
Tráfego atual (revisões e percentuais):
Revisão anterior recuperável:
Banco identificado como homologação / migrations conferidas:
APP_MAINTENANCE_MODE / CHECKOUT_PAUSED:
Estado efetivo das flags financeiras e acionadores:
Destino atual do webhook (host e caminho, sem token):
Resultado de login/logout, tenant, catálogo, Admin e logs:
Pendências / bloqueios / próxima ação:
Executor / horário UTC:
```

### Trabalho de Leno enquanto aguarda e limites desta etapa

Leno prepara a revisão de **supervisão e alertas G6**, reaproveitando os manifestos existentes: mapear pagamento incerto, estorno retido, chargeback, filas sem progresso e falhas de envio; verificar cobertura antes de implementar lacunas. `PAYMENT_REVIEW` registra a pendência, mas não envia notificação ao atendimento por si. A frente ainda não foi implementada por esta atualização documental. Vanderlei informa os canais/recursos efetivos disponíveis; preparação no Git não comprova alerta entregue.

Leno também complementa o roteiro de aceite e o procedimento de atendimento com responsável, próxima ação, prazo e evidência. Envio de disputa/documentos ao Asaas, retomada controlada de estorno retido e retorno parcial permanecem pendentes. Transferência de webhook/acionadores exige inventário e janela coordenada próprios; não está incluída no simples deploy desta candidata. Main e banco principal permanecem somente leitura. G1–G8 só fecham pelas respectivas evidências, e a exceção de expiração do boleto continua limitada ao teste já aceito como adiado.

## 67. Supervisão e alertas G6 — implementação local em 19/10/2026

**Estado:** implementação e testes locais concluídos na branch `trabalho/g6-supervisao-20261019`, a partir de `e644b01`. Ainda não integra a candidata publicada/entregue a Vanderlei. [Evidência da rodada e hashes](../../../../../../trabalho_em_dupla/evidencias/L-G6-SUPERVISAO-2026-10-19.json). A consulta ao código/documentos de `origin/main` (`7f9b26e`) não identificou implementação equivalente a reaproveitar; nenhuma configuração do banco principal foi consultada ou alterada nesta etapa.

### Lacuna corrigida e escopo entregue

O consumidor podia informar ausência de trabalho mesmo com pagamento incerto ou operação retida. O status agora reúne contagens de revisão, chargeback, retorno físico, operações com erro, e-mails pendentes, leases vencidos, contas divergentes e idade da conciliação/outbox. A consulta usa transação somente leitura com snapshot consistente, preserva o contrato anterior e não retorna payloads financeiros ou dados de compradores.

`CONSUMER_MODE=supervision` executa somente um GET autenticado: não aciona filas, expiração, e-mail ou gateway. Emite `attentionReasons` e `processingAttempted=false`. Servidor sem a nova extensão resulta em cobertura incompleta explícita; `idle` significa somente ausência dos sinais observados naquele instante. A credencial reutilizada é CRON_SECRET e ainda tem permissão para outros endpoints: não é um token dedicado exclusivamente à leitura.

Os manifestos passam a preparar um terceiro Job/agenda para observação, separado de pagamentos e pontos, com heartbeat e alerta de atenção/falha. Canais existentes devem ser reaproveitados. Corrigido o filtro para erros cuja severidade é promovida ao campo próprio pelo Cloud Logging. Limite de notificações e fechamento automático de incidente não substituem atendimento nem encerramento financeiro. O gerador apenas produz arquivos; não criou recursos, agendas ou notificações. [Sinais, limites e procedimento de aceite](../../../../../../infra/cloudrun/README.md#execução-e-observabilidade).

### Validação local

- 21 testes de consumidor, manifestos e seleção de suítes aprovados.
- Quatro testes novos com PostgreSQL e HTTP reais em ambiente descartável: autenticação, consulta sem mutações, retenções sem atividade de fila, atraso e recuperação. A primeira rodada encontrou uma falha na leitura de cabeçalho pelo teste; corrigida e repetida com 4/4 aprovados.
- Os 56 testes existentes de execução durável passaram na rodada conjunta. As duas rodadas totalizam cobertura aprovada de 60 cenários distintos, não 60 aprovações na primeira execução.
- TypeScript, lint dos arquivos alterados e build isolado aprovados. Nenhuma migration criada ou aplicada em banco compartilhado. Os novos testes foram incluídos na seleção de homologação para a próxima CI.

### Próximas ações e responsáveis

| Responsável | Ação | Critério de conclusão |
|---|---|---|
| Leno | Revisar e integrar esta alteração em candidata própria, registrar commit e executar CI. | SHA e CI aprovados identificados; comparar com eventuais mudanças de Vanderlei antes da integração. |
| Vanderlei | Retornar a identidade da publicação da seção 66 e inventário de Jobs, agendas, canais/políticas efetivos. | Revisão/digest, tráfego, origem dos acionadores e referências sem segredos. Não ativar um segundo processador. |
| Vanderlei + Leno | Comparar os manifestos G6 com recursos existentes, definir destinatário nominal/substituto e medir custo/latência/cadência. | Configuração revisada, responsável e orçamento de recorrência registrados. Proposta de um minuto não é cadência aprovada. |
| Leno + Vanderlei | Ensaiar observação, atenção, falha, ausência e recuperação na homologação com caso controlado. | GET sem efeitos, alerta recebido no canal real, caso atribuído, próxima ação/prazo e resolução com evidência. |
| Vanderlei + Leno | Concluir transferência coordenada e demonstrar execução automática dos consumidores. | Progresso de filas/e-mails/expirações, recuperação e heartbeats independentes do observador, sem depender de execução manual. |

O ensaio deve registrar SHA/digest/revisão, modo, runId, horários UTC, contagens/motivos, incidente/canal, recebimento, executor, responsável pelo caso, próxima ação e evidência de resolução. Alertas por ausência exigem uma série inicial; testar tanto o observador quanto os processadores. Não limpar revisão, rearmar estornos ou alterar pedidos históricos por SQL para gerar sinal. Baseline e mutações de teste devem pertencer a caso descartável identificado em homologação.

**Não comprovado:** provisionamento, entrega real, destinatário/substituto, custo e cadência sustentáveis, transferência dos acionadores, aceite remoto ou produção. A publicação de `d63ad8a` pode seguir seu procedimento próprio; não presumir que contenha G6. Envio de disputa/documentos ao Asaas e demais lacunas de atendimento continuam separados desta supervisão.

## 68. PR #9 integrado e publicado para teste no Cloud Run — 20/10/2026

**Executor: Vanderlei. Estado: revisão pronta, com 0% de tráfego.** Esta seção atualiza a identidade da candidata e a situação de publicação da seção 67. O código da supervisão G6 e a correção do menu mobile estão publicados; a execução automática, os alertas e a recuperação operacional de G6 continuam reservados à etapa coordenada própria.

### Integração e identidade do artefato

- [PR #9](https://github.com/ViniMoia/Sistema-E-Commerce/pull/9), origem `trabalho/g6-supervisao-20261019`, head `079bc9c4fef4e35f33abf00b615d007796eb9302`.
- [CI do PR 39359261390](https://github.com/ViniMoia/Sistema-E-Commerce/actions/runs/39359261390): `success`, conferida antes do merge.
- Merge em `homologacao_teste` às **11:44:37 UTC / 08:44:37 BRT**, commit **`17fd1a7456441fd98c32957116c7f1247c68be22`**.
- [CI do merge 39417132437](https://github.com/ViniMoia/Sistema-E-Commerce/actions/runs/39417132437): `completed/success`, aguardada antes de enviar a imagem e publicar. Tipagem, lint, unitários, migrations, integração, duas instâncias, manutenção/recuperação, standalone, capacidade isolada e contêiner Linux aprovados.
- Árvore do merge idêntica à do head aprovado do PR: `c04188add6573f6f1f03c5a8f36de5564fe13516`.
- Build local Linux/amd64 do `git archive` desse SHA, com Dockerfile/lockfile existentes, Node 22.23.3 e usuário `node`. Arquivos privados de ambiente ficaram fora do contexto da imagem.
- Projeto / região / serviço: **`continental-511812` / `southamerica-east1` / `continental-hml`**.
- Repositório da imagem: `southamerica-east1-docker.pkg.dev/continental-511812/releases/store`.
- Digest do índice enviado: `sha256:adbd6a8f7fd245355344f2b9dd82baa73a92829877fac7e996559b4d0c0b386e`.
- **Digest Linux/amd64 efetivamente resolvido no Cloud Run:** `sha256:fc46874ed4993a46c1e4e4c601483650356c5619fd6123201d71abbf5dd02368`.
- **Revisão:** `continental-hml-17fd1a7-review`, Ready=True.
- **URL de teste:** https://review-17fd1a7---continental-hml-jctvprygla-rj.a.run.app

### Configuração e tráfego preservados

Distribuição reconferida às **12:17:47 UTC / 09:17:47 BRT**:

| Revisão | Tráfego | Tag |
|---|---:|---|
| `continental-hml-896dc56-logout` | 100% | Endereço principal |
| `continental-hml-eff10bf-dashboard` | 0% | `dashboard-eff10bf`, preservada |
| `continental-hml-d63ad8a-review` | 0% | `review-d63ad8a`, preservada |
| `continental-hml-17fd1a7-review` | 0% | `review-17fd1a7`, nova |

Publicação com digest fixado e `--no-traffic`. Acrescentado somente o alias exato do novo host para a loja de homologação `3a82b33c-3646-4272-9a89-80bb1ba327a5`; aliases anteriores e domínio da Vercel preservados. Comparação das demais variáveis/bindings antes e depois e conferência da conta do serviço aprovadas.

```dotenv
CHECKOUT_PAUSED=true
APP_MAINTENANCE_MODE=false
PAYMENT_REMOTE_ENABLED=false
PAYMENT_WORKER_ENABLED=false
PAYMENT_EXPIRATION_ENABLED=false
PAYMENT_DEPLOYMENT_ENVIRONMENT=SANDBOX
ASAAS_ACCOUNT_SCOPE=sandbox-hml
```

Fonte privada considerada: `.env.homologacao`. Consulta ao banco em transação somente leitura confirmou loja `continental-homologacao`, 34 migrations aplicadas, nenhuma pendência/falha/divergência de checksum. O diff de `prisma` entre `d63ad8a` e `17fd1a7` é vazio. Não houve migration, classificação, carga ou alteração de dados comerciais.

Inventário antes e depois: nenhum Cloud Run Job e API Scheduler desativada. A limitação anterior de inventário de agendas permanece; não se presume ausência global de acionadores. Nenhum Job/agenda foi criado ou habilitado, nenhuma supervisão ou fila foi invocada, e o webhook permaneceu fora das alterações desta rodada. Recursos e recebimento de alertas G6 continuam sem aceite operacional.

**Ocorrência de publicação resolvida:** a espera local do comando atingiu 240 segundos enquanto o Cloud Run finalizava a prontidão/rotas. Os logs mostraram inicialização do Next.js e sonda TCP aprovada. Sem repetir o deploy, consultas posteriores confirmaram Ready=True, URL HTTP 200, digest correto e distribuição de tráfego preservada. O resultado remoto confirmado, e não o timeout local, fundamenta o estado acima.

### Verificações de acesso

- URL candidata e principal: home, produtos, loja ativa e login retornaram 200; tenant correto; Admin anônimo redirecionou ao login com 307.
- **29 verificações autenticadas aprovadas**, incluindo login por API/formulário real, cookies HttpOnly/Secure/SameSite=Lax, páginas/APIs do Admin e acesso à fidelidade.
- Home observada com 69 elementos de imagem, 22 carregados e nenhum quebrado; imagens ainda em lazy loading não foram consideradas validadas.
- Em **390 × 844 px**, `/admin` e `/admin/fidelidade` apresentaram largura de página de 390 px, botão do menu terminando em 54 px e conteúdo principal iniciando em 67 px. Menu abriu/fechou, sem sobreposição nem transbordamento horizontal nesse ensaio.
- Logout com 303 e destino relativo `/`; sessões revogadas e acesso anônimo recusados com 401.
- POST vazio ao checkout recusado com **503 / `CHECKOUT_PAUSED`**, sem compra criada.
- Administrador sintético previamente autorizado e sessões removidos; consulta somente leitura posterior confirmou zero contas temporárias desse ensaio.

As verificações acima cobrem acesso e a regressão básica do menu. A conferência conjunta móvel dos relatórios, apuração independente, aceite de retorno físico e chargeback continuam separados. Não foram repetidos estornos, rearmado o pedido #3, pago/cancelado o #8 ou criado caso financeiro para gerar sinais.

**Evidência sanitizada:** [V-CLOUDRUN-17FD1A7-2026-10-20.json](../../../../../../trabalho_em_dupla/evidencias/V-CLOUDRUN-17FD1A7-2026-10-20.json). Artefatos auxiliares locais em `artifacts/cloudrun-17fd1a7-20261020/`, ignorados pelo Git. Próxima ação: Leno e Vanderlei usam a URL de teste para a conferência móvel e os aceites planejados; promoção de tráfego, abertura de compras e ativação operacional G6 permanecem etapas próprias.

## 69. Devolutiva pendente de Vanderlei e divisão da próxima rodada — 20/10/2026

### O que já recebemos e não precisa ser repetido

O commit `3eb4023bdc1842b7389e4736a122bef69316e8d9` contém a seção 68 e a evidência `V-CLOUDRUN-17FD1A7-2026-10-20.json`. Esta atualização leu esse registro; não é uma nova consulta independente ao Cloud Run.

- SHA publicado: `17fd1a7456441fd98c32957116c7f1247c68be22`; CI do PR e CI do merge aprovadas.
- Revisão: `continental-hml-17fd1a7-review`; [URL de teste](https://review-17fd1a7---continental-hml-jctvprygla-rj.a.run.app); Ready=True e digest Linux/amd64 registrado na seção 68.
- Tráfego observado às 09:17:47 BRT de 20/10: revisão `896dc56-logout` com 100%; candidata com 0%, acessível pela tag.
- Banco/loja de homologação e 34 migrations conferidos; nenhum reset, carga ou migration executado nessa publicação.
- Acesso autenticado, logout, recusa de acesso anônimo e checkout pausado conferidos. Menu testado nas duas páginas a 390 px, com abertura/fechamento e espaço acima do conteúdo.
- Nenhum Cloud Run Job encontrado; API Scheduler desativada. Isso não inventaria agendas de outras plataformas nem comprova que não existe acionador externo.

Referenciar essas provas na devolutiva. Só repetir uma verificação se houver alteração posterior, divergência ou informação necessária fora do escopo já registrado. Não reconstruir a imagem para incorporar esta documentação.

### A. Retorno imediato para liberar a conferência de Leno

| Atribuição de Vanderlei | O que retornar |
|---|---|
| Informar se houve mudança após a seção 68 | “Sem mudanças desde o registro” ou lista das mudanças, com revisão/SHA/flags/tráfego afetados e horário. Não presumir que o estado observado em 20/10 permanece atual indefinidamente. |
| Confirmar o acesso que Leno deve usar | URL exata da candidata e eventual restrição de acesso. Não enviar senha, cookie ou token. Reaproveitar as verificações de acesso já registradas. |
| Manter a revisão disponível para o aceite | Confirmar checkout pausado e controles financeiros preservados. A URL principal continua na revisão anterior enquanto não houver promoção coordenada. |
| Informar bloqueios concretos | Para cada bloqueio: qual etapa impede, responsável, próxima ação e previsão; quando não houver previsão, escrever “a definir”. |

**Leno assume a partir desse retorno:** conferência visual móvel do conteúdo completo em `/admin` e `/admin/fidelidade`; seleção por leitura dos casos existentes em `/admin/orders`; matriz de [retorno físico/chargeback](https://github.com/ViniMoia/Sistema-E-Commerce/blob/3c3bf725e96f33bcb38143cfd2e3f4c017298049/trabalho_em_dupla/ATENDIMENTO_REVISAO_DEVOLUCAO_CHARGEBACK.md#8-matriz-da-próxima-rodada-de-aceite-remoto) e [modelo de coleta](https://github.com/ViniMoia/Sistema-E-Commerce/blob/3c3bf725e96f33bcb38143cfd2e3f4c017298049/trabalho_em_dupla/modelos/ACEITE_RETORNO_CHARGEBACK.json). A confirmação de revisão/acesso permite começar essa parte mesmo que o levantamento G6 abaixo ainda esteja pendente. Falta de caso elegível deve ser registrada como pendência, sem fabricar contestação, retorno ou fato financeiro.

O script `VALIDAR_FIDELIDADE_D63AD8A.js` está deliberadamente vinculado à revisão antiga. Não deve ser executado na nova URL como se fosse um coletor genérico; a comparação nova precisa de identidade e baseline próprios quando necessária. As 75 comparações anteriores permanecem provas da rodada anterior, não da nova revisão.

### B. Levantamento de Vanderlei para preparar G6

Esta parte é inventário e proposta. Não inclui ativação de Jobs/agendas, invocação de consumidores, transferência de webhook nem teste de alerta com efeito financeiro.

1. **Mapear acionadores e receptor do webhook:** retornar plataforma, nome, ambiente, modo (processamento ou supervisão), destino sem parâmetros secretos, estado habilitado/desabilitado, agenda/fuso e última execução com resultado, quando disponíveis. Distinguir evento agendado de processamento efetivo; o log histórico `state=disabled` não prova execução financeira. Incluir Vercel, Cloudflare, Google Cloud e rotinas externas conhecidas; execuções manuais devem ser identificadas como manuais. Quando não tiver acesso, declarar a lacuna e quem pode conferi-la. Não habilitar a API Scheduler somente para preencher a planilha sem coordenar essa mudança.
2. **Informar o receptor atual do Asaas:** host e caminho do webhook, ambiente Sandbox, fila ativa/interrompida e fonte/horário da consulta, se puder conferir somente leitura. “Não alterado nesta publicação” não é uma consulta atual ao destino. Não reenviar evento nem incluir bypass/token na devolutiva.
3. **Inventariar alertas existentes:** referências dos canais/políticas e se estão apenas propostos, configurados ou com entrega comprovada. Indicar destinatário responsável e substituto; referências de contato sensíveis ficam no canal privado combinado. Se não existirem, retornar “não configurado”, sem registrar recebimento fictício.
4. **Propor o ensaio G6:** recursos existentes a reaproveitar, componentes faltantes, permissões/identidade de execução necessárias, intervalo proposto, estimativa de custo com premissas, janela sugerida e critérios de parada/recuperação. Separar observador `CONSUMER_MODE=supervision` dos processadores financeiros e de pontos. Cadência proposta não é agenda aprovada.
5. **Explicitar a transição:** quem suspende o acionador antigo, como comprovar ausência de execução em voo, quem habilita o novo e como retornar ao estado anterior se o ensaio falhar. A proposta será revisada com Leno antes de executar. Ausência de Jobs no Cloud Run não basta para declarar exclusividade de processamento.

Aceite futuro de G6 exige execução automática comprovada, alerta realmente recebido, responsável pelo caso, próxima ação/prazo e recuperação verificada. Logs do observador ou políticas criadas isoladamente não fecham o gate.

### C. Formato da devolutiva

Enviar o bloco preenchido por etapas; não esperar concluir todo G6 para liberar o acesso da parte A. Usar `não conferido`, `sem acesso` ou `não configurado` onde couber, com responsável pela pendência.

```text
Executor / data e horário da conferência:

A — Revisão disponível para Leno
Referência recebida: seção 68 / commit 3eb4023 / evidência V-CLOUDRUN-17FD1A7-2026-10-20.json
Mudanças após esse registro: nenhuma / descrever
SHA / revisão efetivamente disponível:
URL de teste:
Restrição de acesso, se houver:
Tráfego atual ou referência do último estado conferido, com horário:
CHECKOUT_PAUSED / APP_MAINTENANCE_MODE:
PAYMENT_REMOTE_ENABLED / PAYMENT_WORKER_ENABLED / PAYMENT_EXPIRATION_ENABLED:
Bloqueios para Leno consultar a candidata:

B — Inventário e proposta G6 (sem ativação)
Acionadores: plataforma | nome | modo | destino | habilitado? | agenda/fuso | última execução/resultado | fonte/horário
Plataformas não conferidas / responsável por conferir:
Webhook Sandbox: host/caminho | fila ativa/interrompida | fonte/horário
Canais e políticas: referência | proposto/configurado/entrega comprovada
Responsável pelos alertas / substituto:
Recursos e permissões faltantes:
Cadência / custo estimados e premissas:
Janela proposta / executor / revisor:
Contenção do acionador antigo / prevenção de execução simultânea:
Critérios de parada / recuperação:
Pendências: item | responsável | próxima ação | previsão
Referências sanitizadas de evidência:
```

**Limites da solicitação:** manter `CHECKOUT_PAUSED=true`, `APP_MAINTENANCE_MODE=false` e os três controles financeiros `false` conforme a publicação documentada; não promover tráfego, habilitar processamento, alterar webhook, reenviar eventos ou enviar disputa/documentos nesta coleta. Main e banco principal continuam somente leitura. Caso a configuração encontrada divergir, relatar antes de executar a transferência; não substituir silenciosamente uma configuração para coincidir com o modelo.

## 70. Imagens da Nuvemshop, sem upload ou Object Storage — decisão de 20/10/2026

**Fonte:** determinação explícita do operador nesta conversa, após a leitura da devolutiva de Vanderlei. Atualização documental baseada na `homologacao_teste` em `dfcb3b7d4e8e5bdbec64319d6a96ed858b9eba9e`. Não houve auditoria nova de runtime ou banco nesta atualização.

### Escopo definido

- Imagens de produtos são importadas da Nuvemshop. Conferir o fluxo para que mantenha referências externas válidas às imagens, sem copiar os arquivos para armazenamento próprio.
- Usuários e administradores não poderão enviar arquivos de imagem. A conferência abrange formulários e endpoints existentes, inclusive produtos e avatares, se houver esses caminhos.
- Não salvar arquivos/binários de imagem no banco da aplicação. Referências/URLs não são os arquivos de imagem e devem permanecer vinculadas aos produtos corretos.
- Retirar das pendências de produção o provisionamento de Object Storage, a criação de buckets e a configuração de credenciais destinadas a habilitar upload. Não solicitar `SUPABASE_SERVICE_ROLE_KEY` ou URL de Storage para viabilizar esse recurso.
- A ausência de Object Storage não comprova que o upload esteja bloqueado. A restrição precisa ser efetiva na interface e no servidor, sem depender de falha por credencial ausente.

### Atribuições e devolutiva

| Responsável | Ação | Retorno esperado |
|---|---|---|
| Vanderlei | Aplicar esta decisão ao planejamento de infraestrutura; não executar as antigas tarefas de provisionar/configurar Storage para imagens. | Confirmar retirada dessas tarefas. Se já houver recurso ou segredo configurado, informar somente referência e dependências conhecidas; esta atualização não solicita apagar recursos. |
| Leno | Conferir importação Nuvemshop e vínculo das URLs com os produtos, reaproveitando decisões existentes e mantendo main/banco principal somente leitura. | Identificar arquivos/rotas e evidências de carregamento no catálogo e nos detalhes; registrar URLs quebradas ou dependências de armazenamento próprio que precisem de correção. |
| Leno | Auditar controles de upload e APIs, corrigindo o que contrariar a decisão em uma entrega própria. | Registrar caminhos encontrados, comportamento esperado e testes de recusa para usuário e Admin, incluindo requisições diretas, sem gravar arquivos em serviços compartilhados. |
| Vanderlei + Leno | Após eventual correção de código, publicar/conferir a candidata aprovada na homologação. | SHA, revisão/URL e resultado da conferência: imagens externas carregam e upload indisponível para ambos os perfis. |

Formato de retorno de Vanderlei:

```text
Política de imagens da seção 70 recebida: sim/não
Tarefas antigas de provisionar/configurar Storage para upload: retiradas/pendência
Recurso ou segredo preexistente relacionado, se houver: referência, sem valor
Dependência conhecida que exige revisão: nenhuma conhecida/descrever/não conferida
Revisão/URL atualmente disponível para a conferência de imagens:
Pendências de e-mail/remetente/recuperação de senha, tratadas separadamente:
```

### Critérios de fechamento e limites

1. Imagens de produtos carregam por referências externas provenientes do fluxo Nuvemshop, no catálogo e nos detalhes.
2. Interface não oferece upload aos usuários ou administradores; chamadas diretas às rotas de upload também são recusadas.
3. Conferência do fluxo não encontra persistência de arquivos/binários no banco nem cópia para Object Storage próprio.
4. Evidências identificam código/revisão e distinguem testes locais de validação remota. **Nesta atualização, esses critérios permanecem pendentes de verificação; somente a decisão de escopo foi concluída.**

As instruções históricas de criar/configurar Storage, buckets `products`/`avatars` e validar upload permitido deixam de ser tarefas de Vanderlei. Isso também atualiza a interpretação das pendências antigas de G4/G5/G8 e da devolutiva de infraestrutura. **E-mail real, remetente, recuperação de senha e demais gates continuam necessários.** Nenhum código, segredo, bucket, banco, tráfego ou implantação foi alterado por esta atualização documental.
