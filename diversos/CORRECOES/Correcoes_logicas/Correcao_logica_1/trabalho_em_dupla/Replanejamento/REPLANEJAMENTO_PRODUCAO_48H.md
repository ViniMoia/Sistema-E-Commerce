# Replanejamento para produção em até 48 horas

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

Em 12/10 o usuário confirmou que o banco atual contém somente dados de teste. Preparar **banco de produção separado**, com migrations e carga aprovada de catálogo/configuração/estoque; preservar a origem de homologação. Destino, inventário de carga e estoque físico de abertura ainda precisam ser verificados. Não copiar pedidos #1/#2/#3, carteiras fictícias, referências Asaas Sandbox ou credenciais para produção. Essa decisão evita reconstruir todo o histórico de teste como obrigação comercial; não autoriza apagar a origem.

| Situação comprovada | Caminho mais curto aceitável |
|---|---|
| Dados exclusivamente de teste, sem obrigação comercial | Banco de produção separado, migrations ensaiadas, carga aprovada apenas de catálogo/configuração/estoque inicial. Não excluir origem ou copiar segredos/contas Sandbox. |
| Existem clientes, pontos, estoque ou pagamentos reais | Inventário atual, backup restaurável e conciliação das obrigações ativas; preservar IDs e histórico. Não reiniciar saldos nem abandonar clientes. |
| Histórico incompleto sem efeito ativo | Preservar leitura autorizada e cobertura parcial; bloquear escritores perigosos, documentar exceções, responsável e prazo. Reconstrução histórica pode ser posterior. |
| Saldo/estoque ativo ou titularidade sem prova | Bloqueador da entidade/fluxo afetado. Se o isolamento não impedir prejuízo ou impedir operação essencial, bloqueador do lançamento. |

As contagens de 04/10 — 24 pedidos, 33 itens sem variante e duas carteiras — são históricas e sobrepostas. Não repetir saneamento com base nelas. O gate WF-18 do escopo exige inventário atual, conservação e tratamento das exceções; não exige fabricar fatos retroativos para zerar uma lista.

Matriz mínima de produto no candidato: produto sem variação (`Único/Padrão` e leitura dos neutros legados), produto com variações, edição conservando IDs, combinação repetida recusada, variante sem estoque indisponível, ajuste de estoque com revisão, edição concorrente com reserva e retirada de variante com carrinho/pedido vinculado. Verificar imagem/upload e permissões. Usar `lib/product-variants.ts`; conservar vínculos e separar o ID persistido da chave interna do formulário. Backup e auditoria antecedem qualquer reparo real.

## 7. Infraestrutura e segurança que entram no primeiro dia

**Vanderlei é responsável pelo Google Cloud e deploy.** Leno fornece contratos financeiros, dados e revisão. Usar o serviço já preparado se for adequado; se não houver escolha, avaliar Cloud Run com o standalone existente e decidir em H+2. Não migrar novamente de plataforma dentro das 48 horas por preferência estética.

### Configuração e executor

- Identificar projeto, região, domínio/TLS, imagem, segredos por referência, pool, limites de instâncias, conta Asaas e tenant. Isolar Sandbox e produção inclusive armazenamento de imagens.
- Integrar/revisar a correção local de 12/10 da política financeira (seção 14) antes do Sandbox em Google Cloud. Sem declaração explícita, `lib/config/asaas-environment.mjs` conserva a inferência anterior de PRODUCTION de `NODE_ENV=production` fora do Preview Vercel. Não simular Vercel nem usar runtime de desenvolvimento como contorno.
- Ensaiar Host/proxy/origem canônica/cookies no destino real. Cabeçalhos encaminhados não podem permitir escolher tenant arbitrário; origem e links de reset não vêm de entrada não confiável.
- Reusar inbox/outbox/leases. Escolher **um executor durável principal**, com recuperação; não redesenhar todo o sistema de filas. Webhook que grava READY não basta, nem Promise solta após resposta HTTP.
- Se Cloud Scheduler/Cloud Run forem escolhidos, adaptar autenticação real do endpoint. OIDC de infraestrutura não substitui automaticamente o Bearer/CRON_SECRET do aplicativo; não deixar cron público nem sobrescrever o header errado. Demonstrar chamada legítima e recusa de anônimo/origem indevida. [Agendamento autenticado no Cloud Run](https://docs.cloud.google.com/run/docs/triggering/using-scheduler).
- Dimensionar lote pela chegada de trabalho e tempo de execução, não pelo `limit=1` dos ensaios manuais. Incluir pagamento, reconciliação, expiração de pedidos, email e expiração de pontos. Ajustar timeout do chamador/runtime e lease; timeout pode coexistir com execução ainda em curso. [Timeout do Cloud Run](https://docs.cloud.google.com/run/docs/configuring/request-timeout).
- Testar um executor interrompido e recuperação sem operador; monitorar idade da fila, falta de progresso, revisão, erros de email e quotas. Alertas precisam chegar a Leno/Vanderlei ou ao substituto registrado.

### Segurança e continuidade mínimas

Verificar acesso alheio por ID/tenant em pedidos, carteira, catálogo/Admin e upload; papel administrativo, último Admin e revogação de sessão; reset de uso único e email real; proteção contra requisições de mutação de origem indevida; credenciais de webhook e rejeição de evento falso; limitação de abuso em login/reset/checkout. Conferir DTO público/Admin, caches e logs sem segredos ou dados sensíveis desnecessários. Rotação de credencial já exposta precisa de prova, não apenas remoção do texto.

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

| Gate | Dono / revisor | Evidência necessária |
|---|---|---|
| G1 — escopo e bloqueios | Leno / Vanderlei | PIX, cartão à vista/parcelado e entrega ativos e validados; boleto/manual/parcelas acima do limite e modalidades não homologadas recusados em UI e chamadas diretas, antes de reserva/cobrança. |
| G2 — dados restauráveis | Leno / Vanderlei | Banco alvo identificado, inventário atual, obrigações ativas conciliadas ou isolamento comprovado, backup/restore e migrations ensaiados. |
| G3 — financeiro | Leno / Vanderlei | Aprovação/recusa/expiração/incerteza/replay/devolução dos métodos ativos, conta correta e efeitos únicos. #3 não substitui devolução concluída. |
| G4 — pontos/produtos | Leno / Vanderlei | Ganho/resgate/déficit/expiração e cadastro/edição/variantes/reserva concorrentes conservados. |
| G5 — segurança | Vanderlei / Leno | Tenant/ownership/Admin/reset/cookies/webhook/segredos/cartão aprovados; exposição crítica resolvida. |
| G6 — execução automática | Vanderlei + Leno | Pagamentos, emails e rotinas de expiração progridem; reinício recupera trabalho; alertas testados e responsável disponível. |
| G7 — experiência e capacidade | Vanderlei / Leno | Fluxo mobile/desktop e operação comercial corretos; limites de latência/carga registrados e sustentáveis. |
| G8 — candidato e operação | Vanderlei / Leno | Revisão cruzada, mesmo artefato, domínio/email/storage/configuração corretos, procedimento de contenção/recuperação ensaiado e aceite do escopo. |

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
| Banco de lançamento / obrigações legadas | Usuário confirmou apenas testes em 12/10. Preparar base de produção separada; destino/carga/estoque inicial ainda pendentes. |
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
