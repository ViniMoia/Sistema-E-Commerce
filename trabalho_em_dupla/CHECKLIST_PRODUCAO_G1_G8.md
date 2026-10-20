# Checklist de produção G1–G8

**Estado vigente — 19/10:** PR #8 integrado à `homologacao_teste` em **`d63ad8a1ab2d712153177155eae518d3eddcdc86`**, com [CI após integração aprovada](https://github.com/ViniMoia/Sistema-E-Commerce/actions/runs/39295357722). A candidata contém dashboard/fidelidade, retorno físico integral e resultado de chargeback. Publicação e aceite no Cloud Run seguem pendentes de comprovação por Vanderlei. Atribuições e formato do retorno estão na **seção 66 do replanejamento**; [evidência GitHub](evidencias/L-CI-INTEGRACAO-2026-10-19.json). As referências a `55a3003` e à preparação sem commit abaixo são históricas e foram superadas nesse aspecto; não são novos bloqueios de integração.

Consolidado em **16/10/2026, 19:28 BRT**, a partir do [Replanejamento de produção](../diversos/CORRECOES/Correcoes_logicas/Correcao_logica_1/trabalho_em_dupla/Replanejamento/REPLANEJAMENTO_PRODUCAO_48H.md), inclusive decisões posteriores à matriz original. **Produção ainda sem aceite.** Este documento organiza evidências e condições de fechamento; não autoriza operações remotas nem altera o escopo comercial.

## Candidata e alcance das provas

- Código candidato: **`55a300313570f2a504a8f042ba7f228cd7382e58`**, branch `revisao/dashboard-financeiro-20261016`, [PR #8](https://github.com/ViniMoia/Sistema-E-Commerce/pull/8). Inclui as correções de Vanderlei, dashboard financeiro, fidelidade histórica e invalidação do cache.
- [CI 38969534735](https://github.com/ViniMoia/Sistema-E-Commerce/actions/runs/38969534735): **success**, concluída em **16/10, 18:54:47 BRT / 21:54:47 UTC**. Conferência pela API do GitHub em 22:28:37 UTC confirmou o SHA acima e todos os passos aprovados. Inclui tipagem, lint, unitários, migrations, isolamento, runtime com duas instâncias, manutenção/recuperação, standalone, capacidade com provedores descartáveis, build e execução do contêiner Linux.
- Essa CI valida o código no ambiente isolado. Não comprova publicação no Cloud Run, transporte real do Asaas, envio real de e-mail, capacidade/custo do destino ou prontidão comercial.
- Última evidência de Vanderlei: `continental-hml-896dc56-logout` com 100% do tráfego; `continental-hml-eff10bf-dashboard` Ready com 0%. Migration `20261016193000_order_reporting_exclusion` aplicada à homologação, sem drift e sem classificar pedidos. Fonte: [validação Cloud Run](VALIDACAO_DASHBOARD_CLOUDRUN_2026-10-16.md), tráfego conferido por ele às 18:00:57 BRT. Não é nova consulta remota nem publicação de `55a3003`.
- A validação de `eff10bf` antecede a correção do alerta do pedido #3 e o relatório de fidelidade. Não aprova a candidata atual. O resultado `COMPLETE` daquele painel é histórico; a correção posterior exige cobertura parcial enquanto persistir a revisão do #3.
- Origem consultada: `origin/main` **`7f9b26e062ec2654420fecffb6dd78ad3ba1e017`**, somente leitura. O banco de produção é o existente indicado pelo operador; nenhum novo banco é pressuposto.

**Como usar:** `[x]` significa evidência concluída apenas no ambiente descrito; `[ ]` é uma condição ainda sem fechamento documentado. Nenhum gate inteiro está aprovado só porque possui subitens concluídos. Evidências anteriores são reaproveitáveis quando código, contrato e configuração pertinentes continuam compatíveis; repetir apenas cenários afetados ou com lacunas reais.

## Decisões vigentes

1. PIX, crédito de 1x até 12x, boleto, débito, pontos e entrega compõem o escopo exigido. Débito continua dependente da resposta do Asaas e de implementação/homologação próprias; não houve decisão posterior de retirá-lo do lançamento.
2. O operador aceitou **somente o teste de expiração do boleto pendente após a abertura**, conforme seção 36 do plano. O pedido #8 permanece como cenário, com elegibilidade registrada para 20/10/2026 às 00:00 BRT. A exceção não transforma o teste em aprovado nem dispensa outras obrigações do boleto.
3. PIX manual/WhatsApp e capacidades não homologadas permanecem bloqueados conforme o plano. Esconder a opção não substitui bloqueio no servidor, inclusive para intenções antigas e chamadas diretas.
4. Os quatro produtos de teste devem ficar indisponíveis na abertura, preservando histórico: **Aspirador de Pó automotivo vermelho**, Calça Jeans, Camisa Branca e Camisa Preta. Os outros três aspiradores comerciais não entram nessa seleção. IDs devem ser conferidos por ambiente; nomes não bastam.
5. Main e seu banco permanecem estritamente somente leitura para o assistente. Tratamentos ensaiados no clone não estão automaticamente aplicados nem autorizados no banco produtivo. Nenhum dado, conta, saldo, estoque de teste ou identidade Sandbox deve ser copiado como configuração de produção.

## Resumo dos gates

| Gate | Situação | Dono / revisor | Condição principal ainda aberta |
|---|---|---|---|
| G1 — escopo e bloqueios | Parcial; débito bloqueado externamente | Leno / Vanderlei | Fechar as capacidades obrigatórias e comprovar bloqueios efetivos na candidata/configuração de abertura. |
| G2 — dados restauráveis | Ensaiado em clone; abertura pendente | Leno / Vanderlei | Backup recuperável por outro operador, inventário fresco, tratamento de legados e estoque real no destino. |
| G3 — financeiro | Casos Sandbox concluídos; aceite parcial | Leno / Vanderlei | Devolução PIX concluída, lacunas de boleto/débito e procedimentos de devolução após entrega/chargeback; transporte no destino. |
| G4 — pontos e produtos | Código e ensaios aprovados; destino pendente | Leno / Vanderlei | Conferir fidelidade publicada e abertura consistente de catálogo, estoque, carteiras e vínculos. |
| G5 — segurança | Regressões aprovadas; configuração real pendente | Vanderlei / Leno | Revisão de acessos, segredos, cookies/reset, webhook e dados de cartão na configuração efetiva. |
| G6 — execução automática | Preparação aprovada; transferência pendente | Vanderlei + Leno | Inventário completo, acionador coordenado, recuperação e alertas reais, sem depender de execução manual. |
| G7 — experiência e capacidade | Ensaios isolados e parciais remotos | Vanderlei / Leno | Aceite de compra/entrega, frete oferecido e limites sustentáveis de desempenho no destino. |
| G8 — candidata e operação | CI verde; publicação atual e aceite pendentes | Vanderlei / Leno | Mesmo artefato conferido, domínio/e-mail/Storage, contenção/recuperação e revisão cruzada final. |

## G1 — Escopo e bloqueios

- [x] Decisões de parcelamento, entrega, boleto, débito e exceção da expiração identificadas nas seções 15, 17 e 36 do plano. Não reaplicar a exclusão histórica de boleto da matriz original.
- [x] Pausa no Preview observada: três comandos vazios recusados com 503/`CHECKOUT_PAUSED`/`no-store`, recuperação do #7 preservada; aviso visual e retorno da proposta também registrados. [Evidência de contenção](evidencias/L-CONTENCAO-CHECKOUT-2026-10-15.json), seção 43. Não prova congelamento geral ou bloqueio de uma confirmação válida em todas as revisões.
- [ ] Registrar matriz final de capacidades e flags por ambiente/revisão, incluindo limites de parcelas e recusa de métodos não homologados antes de reserva/cobrança. Reaproveitar os testes isolados e conferir o ingresso efetivo de abertura.
- [ ] Fechar suporte e implementação do débito ou obter uma decisão explícita de mudança do escopo. Ausência de resposta do suporte não é aceite.

## G2 — Dados restauráveis e abertura

- [x] Pacote de abertura revisado na candidata `55a3003`, com seleção exata dos produtos, comparação antes/depois e roteiro de recuperação independente: [pacote G2](PACOTE_ABERTURA_G2.md). Reensaio em 16/10, 19:33–19:35 BRT: restore/upgrade, dados/sequências, abertura/classificação e replay aprovados; nove verificações HTTP, três testes de relatórios e cinco de proteção. [Evidência](evidencias/L-G2-REVISAO-ABERTURA-2026-10-16.json). Reutiliza snapshot antigo; não é auditoria fresca nem execução produtiva.
- [x] Origem auditada somente leitura; backup, restauração, migrations e compatibilidade da aplicação ensaiados no clone. [Preparação](evidencias/L-BANCO-PREPARACAO-2026-10-15.json), [ensaio](evidencias/L-BANCO-ENSAIO-2026-10-15.json), seções 37–40.
- [x] No clone: quatro produtos de teste indisponíveis, vínculos preservados, baixa auditada de 475 pontos de teste em duas carteiras, proteção de comandos legados e compra nova isolada. [Produtos](evidencias/L-BANCO-PRODUTOS-TESTE-2026-10-15.json), [abertura](evidencias/L-BANCO-ABERTURA-CLONE-2026-10-15.json). Esses números são do snapshot ensaiado, não saldos atuais de produção.
- [x] Vanderlei comprovou backup/restore da homologação e aplicação da migration de classificação sem alteração dos dados existentes. [Registro](VALIDACAO_DASHBOARD_CLOUDRUN_2026-10-16.md). Restauração pelo mesmo usuário Windows não prova acesso por operador alternativo.
- [ ] Conferir inventário fresco do banco de abertura, obrigações ativas, referências de gateway e diferenças desde o snapshot. Fechar estoque comercial real e tratamento explícito de testes/legados, sem apagar histórico nem inferir classificação pelo nome/data.
- [ ] Definir local e acesso recuperável ao backup, testar restauração por responsável alternativo e registrar retenção, RPO/RTO medidos e responsáveis. Os limites propostos no plano não são resultados medidos.
- [ ] Preparar e executar a abertura pelo operador responsável dentro do procedimento autorizado: conter escritores, backup, migrations revisadas, tratamento auditado e comparação antes/depois. Main/banco principal não foram modificados por este checklist.

## G3 — Financeiro e evidências

| Cenário | Evidência reaproveitável | Limite / pendência |
|---|---|---|
| #4 crédito 12x, R$ 360,72 | Estorno integral Sandbox e conciliação; seis unidades e 149 pontos revertidos uma vez, 12 eventos concluídos (seção 35). | Concluído nesse escopo. Não repetir o estorno; mercadoria ainda estava na loja. |
| #5 crédito 1x, R$ 57,20 | Compra com pontos/frete e estorno integral, efeitos únicos; [revisão de Vanderlei](evidencias/V-REVISAO-PEDIDO-5-2026-10-14.json). | Concluído nesse escopo. Não comprova devolução física depois da entrega. |
| #6 boleto pago, R$ 49,90 | Emissão/pagamento, pontos/e-mail e replay `PROCESSED`, com comparação sem duplicação (seções 32 e 46). | Reenvio manual na Vercel não comprova retentativa automática nem transporte no Cloud Run. |
| #7 boleto não pago, R$ 49,90 | Cancelamento local e `deleted=true` no Asaas, identidade verificada (seção 33). | Concluído nesse escopo; não é estorno de boleto pago. |
| #8 boleto pendente | Emissão e prazo real registrados (seções 34 e 36). | Expiração pendente, com adiamento aceito. Não pagar/cancelar manualmente para encerrar o teste. |
| #3 PIX, R$ 49,90 | Devolução cancelada pelo provedor, mantida em revisão; valores financeiros preservados (seção 56). | Não conta como devolução concluída. Não resetar/repetir automaticamente o comando. |

- [x] Apuração financeira isolada conferida contra snapshot real de homologação: R$ 542,67 reconhecidos, R$ 124,75 liquidados, R$ 417,92 estornados. [Conferência](evidencias/L-DASHBOARD-CONFERENCIA-HML-2026-10-16.json). São fatos brutos do recorte, não saldo bancário disponível, lucro ou valores líquidos de taxas.
- [ ] Conferir painel/relatório de clientes publicados na candidata atual com baseline fresco: cobertura parcial do #3, composição histórica e cache considerados. Não alterar dados para reproduzir números antigos.
- [x] Preparada a [ficha única de aceite remoto do dashboard/fidelidade](ACEITE_REMOTO_DASHBOARD_FIDELIDADE.md), com identidade da revisão, cálculo independente, referência histórica, comparação de campos, cache, apresentação e decisão. O [modelo de registro](modelos/ACEITE_DASHBOARD_FIDELIDADE.json) permanece `NOT_EXECUTED`; não comprova o aceite remoto acima nem substitui a conferência separada do relatório de clientes.
- [ ] Comprovar devolução PIX concluída em cenário apropriado; preservar #3 como caso de revisão. Fechar comportamento e procedimento de devolução de boleto pago e demais lacunas dos métodos ativos, conforme seção 5.
- [ ] Consolidar evidências de recusa, análise, incerteza, expiração, pagamento tardio e replay dos métodos oferecidos, distinguindo regressão isolada de prova necessária da conta/transporte. Não repetir casos concluídos sem mudança relevante.
- [ ] Fechar atendimento de devoluções após entrega, separando estorno financeiro de retorno físico ao estoque, e procedimento auditável de chargeback/revisão. Vincular o aceite à conta/configuração de produção correta.
- [x] [Roteiro de revisão, devolução e chargeback](ATENDIMENTO_REVISAO_DEVOLUCAO_CHARGEBACK.md) e [modelo privado de caso](modelos/CASO_REVISAO_FINANCEIRA.json) preparados em 16/10. Atualização local em 19/10 acrescenta encerramento físico integral auditado e tratamento dos resultados de chargeback, com consulta atual do provedor, auditoria por parcela e painel de leitura no Admin. Perda e reversão exigem evidência financeira compatível; não disparam outro estorno. [Testes e limites](evidencias/L-CHARGEBACK-RESULTADOS-2026-10-19.json). Envio de disputa/documentos, retorno parcial e aceite remoto continuam pendentes. A solicitação de reconciliação altera agenda/inbox, e PAYMENT_REVIEW não envia alerta de atendimento por si. Implementação isolada não encerra o aceite operacional anterior.

## G4 — Pontos, produtos e estoque

- [x] Comparação dos valores em 19/10: 56 campos das capturas de dashboard/fidelidade e 19 métricas da API autenticada coincidem com baseline fresco somente leitura. API retornou 200, identidade verificada e `private/no-store`. [Registro](evidencias/L-ACEITE-D63AD8A-2026-10-19.json). Este fechamento é restrito aos valores comparados; apresentação móvel, demais verificações de acesso/identidade e limites temporais permanecem abertos.
- [x] Regressões isoladas de ledger, lotes, concorrência, expiração, reserva e identidade de variantes disponíveis; CI atual aprovada. A classificação comercial não apaga dívidas nem movimentos.
- [x] Relatório de fidelidade corrigido: valores monetários históricos, bruto/devolvido/diferença, zero válido, cobertura parcial e testes explicitamente classificados. API e widget usam a mesma leitura; cache corrigido. [Evidência](evidencias/L-FIDELIDADE-RELATORIO-2026-10-16.json), seções 57–58.
- [ ] Conferir `/admin/fidelidade` e widget na revisão publicada com a mesma loja/base temporal: saldos/dívidas completos, escopo comercial separado e avisos de cobertura presentes. Validação de `eff10bf` não inclui essa mudança.
- [ ] Concluir abertura de produtos/variantes/estoque e carteiras de G2, preservando IDs e reservas. Estoque mostrado na tela ou herdado de teste não é evidência de estoque comercial disponível.

## G5 — Segurança

- [x] CI e ensaios existentes cobrem isolamento, permissões, ownership e controles de identidade. Vanderlei conferiu login/logout e recusa de sessão revogada em `eff10bf`, sem promover tráfego.
- [ ] Vincular a revisão cruzada de tenant/Admin/cookies/Origin/reset à candidata e ao domínio efetivo; comprovar entrega real de recuperação de senha e rejeições relevantes. Reutilizar testes válidos, sem criar acessos persistentes de teste.
- [ ] Conferir permissões mínimas de banco/serviço/Storage, bindings dos segredos e separação de contas/ambientes. Concluir rotação do segredo de bypass exposto e atualizar seu uso coordenadamente; nunca copiá-lo para este documento.
- [ ] Validar autenticação do webhook no destino, proteção dos endpoints de consumidores e ausência de PAN/CVV em persistência/logs/armazenamento do navegador. Resultado de teste isolado não certifica todas as configurações remotas.

## G6 — Execução automática

- [x] Ampliação local em 19/10: observador somente GET, sinais de revisão/chargeback/retorno físico/operações retidas/e-mail/atraso e manifestos de alerta. 21 testes de ferramentas, quatro novos de supervisão, 56 de execução durável, TypeScript, lint e build aprovados. [Evidência e limites](evidencias/L-G6-SUPERVISAO-2026-10-19.json). Ainda sem commit, CI remota ou implantação desta alteração; não faz parte de `d63ad8a`.
- [ ] Integrar G6 em candidata identificada e aprovada na CI. Comparar recursos existentes, confirmar destinatário nominal/substituto, medir custo/cadência e comprovar atenção, falha, ausência e recuperação no canal real. Fechamento automático do incidente não encerra o caso financeiro. [Procedimento](../infra/cloudrun/README.md#aceite-operacional-g6--responsabilidade-conjunta).
- [x] Manifestos, consumidor, reinício e recuperação passaram na CI isolada. Worker Cloudflare observado em 16/10 às 19:43:37 UTC com `state=disabled`; apenas essa invocação está comprovadamente sem processamento.
- [x] Projeto/região de homologação conhecidos: `continental-511812` / `southamerica-east1`. Não solicitar novamente esses dados. [Inventário de Vanderlei](evidencias/V-ACIONADORES-2026-10-16.json) registrou ausência de Jobs na consulta e API Scheduler desabilitada, com listagem de agendas incompleta.
- [ ] Terminar inventário de acionadores e requisições em voo. Ausência de cron na tela ou um evento desabilitado não comprova ausência global de execução.
- [ ] Coordenar a transferência de webhook e acionador com janela, responsáveis e reversão definidos; conferir conta/loja, autenticação, leases, limites e um único responsável por acionar o processamento. Não habilitar o antigo e o novo por inferência.
- [ ] Demonstrar progresso automático de pagamentos, reconciliação, e-mails e expirações; recuperação após falha/reinício e alerta que chegue ao responsável. Registrar cadência, backlog, limites e evidências do destino. Execução manual de PowerShell não encerra este gate.

## G7 — Experiência e capacidade

- [x] Ensaios de catálogo, variantes, checkout/confirmação e telas desktop/mobile disponíveis. CI atual inclui runtime e piloto de capacidade com provedores descartáveis; `eff10bf` teve validação remota de dashboard a 390 px. [Continuação de Vanderlei](evidencias/V-CONTINUACAO-2026-10-15.json).
- [ ] Conferir a candidata publicada nos fluxos indispensáveis: compra, recuperação/reload, estados financeiros, fidelidade, Admin e entrega. Não confundir revisão da proposta com compra concluída.
- [ ] Fechar cobertura, contratos/tarifas, peso/dimensões, preço/prazo e operação de expedição/rastreio das modalidades efetivamente ofertadas. J&T do #5 comprova aquele pedido; [Correios](evidencias/V-CORREIOS-2026-10-14.json) registrou timeout, sem cotação aceita naquela rodada.
- [ ] Registrar capacidade e latências sustentáveis no destino, limites de instâncias/pool/concorrência e custo previsto. O piloto isolado não mede a conta Cloud Run/Neon real. Se houver limite comercial reduzido, exigir limite técnico e aceite; não presumir capacidade por ausência de campanha.

## G8 — Candidata, infraestrutura e operação

- [x] PR #8 integrado em `d63ad8a`; CI do PR e CI após integração aprovadas. Árvores de arquivos de `d78fdae` e `d63ad8a` idênticas. A publicação deve identificar esse código ou um sucessor explicitamente comparado/validado; a atualização documental não comprova deploy.
- [x] Candidata integrada `55a3003` com CI verde. Revisões de domínio/logout de Vanderlei preservadas; migration aditiva já comprovada na homologação.
- [x] Consolidação local em 19/10 do conjunto de retorno físico/chargeback e documentação pendente: [manifesto de caminhos e hashes](evidencias/L-CANDIDATA-CONSOLIDACAO-2026-10-19.json), seção 65 do plano. A base já contém toda a homologação remota conferida; não foi necessário merge nem ajuste adicional de runtime. Conjunto ainda sem commit próprio e sem CI remota correspondente; os testes locais permanecem identificados pelas evidências anteriores.
- [ ] Publicar/conferir o conjunto atual, registrando SHA, digest efetivo, revisão, migrations, versão da configuração e tráfego. A revisão de `eff10bf` não substitui essa conferência. Reusar a migration já aplicada após verificar o estado, sem reclassificar pedidos.
- [ ] Validar domínio/tenant, e-mail real e Storage com upload/leitura/autorização pertinentes. Imagens antigas carregando não comprovam upload; modelo `.env.example` não comprova bindings efetivos.
- [ ] Ensaiar contenção e retomada no ingresso real: pausa de compras, congelamento de todos os escritores quando necessário, drenagem e recuperação. Sondas inválidas e manutenção isolada são provas parciais. Rollback de aplicação não deve remover a migration aditiva nem apagar dados.
- [ ] Registrar revisão cruzada e aceite final do escopo, responsáveis de operação, alertas e recuperação. Relacionar exceções explicitamente aceitas, em especial a expiração do boleto, com responsável e acompanhamento.

## Ordem de avanço enquanto Vanderlei está indisponível

1. **Leno — G2, preparação concluída em 16/10.** [Pacote revisado](PACOTE_ABERTURA_G2.md), comparação antes/depois e roteiro de recuperação independente preparados; ensaio na candidata atual aprovado. Restam baseline fresco, saldo comercial, executor final para destino autorizado e prova por operador alternativo. Não aplicar tratamento ao banco principal.
2. **Leno — G3/G4, preparação concluída.** [Ficha de aceite remoto](ACEITE_REMOTO_DASHBOARD_FIDELIDADE.md) e modelo preenchível prontos. Aguardar identificação da candidata publicada, capturar baseline fresco e executar a comparação. Preservar os casos financeiros concluídos; nenhum novo estorno é necessário para conferir relatório.
3. **Leno — G1/G3/G6, retorno integral e resultado de chargeback integrados e aprovados na CI em 19/10.** [Procedimentos e lacunas](ATENDIMENTO_REVISAO_DEVOLUCAO_CHARGEBACK.md) atualizados. Enquanto Vanderlei publica, revisar cobertura de supervisão/alertas existentes, preparar os ensaios necessários e completar o roteiro de aceite. Alertas efetivamente entregues, envio de disputa, retornos parciais e validação da conta ainda exigem trabalho e prova operacional. Não remover revisão por SQL nem tratar documento como recurso implantado.
4. **Vanderlei com revisão de Leno, quando disponível — G5–G8.** Publicação/conferência da candidata, configurações efetivas, inventário/transferência de acionadores, recuperação por outro operador e validação operacional. Não são dados que o checklist possa presumir ou substituir.

## Registro necessário para o aceite final

| Campo | Estado nesta consolidação |
|---|---|
| SHA com CI aprovada | `d63ad8a1ab2d712153177155eae518d3eddcdc86` (CI após integração); atualização documental posterior não muda esse código de referência |
| Digest/revisão publicada dessa candidata | Pendente |
| Configuração e migrations da abertura produtiva | Pendente; homologação tem prova separada |
| Baseline e comparação da abertura | Ensaiados em clone; execução final pendente |
| G1–G8 aprovados por dono/revisor, com data | Pendente |
| Exceção aceita | Teste de expiração do boleto adiado; não aprovado como teste |
| Recuperação por operador alternativo / RPO / RTO | Pendente comprovação |
| Responsáveis e canais de alertas/atendimento | Pendente aceite operacional |
| Liberação de vendas em produção | **Não concedida por este documento** |
