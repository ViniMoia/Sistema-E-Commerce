# Replanejamento para produção em até 48 horas

**Atualização de escopo em 13/10/2026:** o usuário tornou **boleto e cartão de débito obrigatórios antes da produção**, além de PIX, crédito até 12x e entrega. Esta decisão substitui as exclusões/adiamentos de boleto nas matrizes e no backlog anteriores deste documento. Débito é uma lacuna de implementação, não uma modalidade já habilitável por flag: os contratos e o adapter atuais não o oferecem. Ver seção 17. Nenhuma publicação ou aprovação de gates decorre desta atualização local.

**Data:** 10/10/2026; retomada e escopo atualizados em 12/10/2026 — America/Sao_Paulo.

**Prazo:** até 48 horas corridas a partir do início coordenado em 10/10; limite no mesmo horário de 12/10/2026. Registrar o horário de início no quadro de execução.

**Responsáveis:** Leno (Brega), dados e financeiro; Vanderlei (Que dá idéia errada), loja, segurança, infraestrutura e deploy no Google Cloud. Revisão recíproca.

**Base local conferida:** `461437d60a77f2ba5150a30527f188b5c5d8e437`, mais complementos locais do roteiro e da retomada do pedido #3. A base não é uma release de produção aprovada.

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
