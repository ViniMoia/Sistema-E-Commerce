# Retomada controlada do GCP — 23/10/2026

**Acesso à homologação restaurado e validado.** Foram repostos os controles anteriores à janela: roteamento, tags, flag de manutenção do template, conta consumidora e comandos dos dois Jobs. Checkout e capacidades financeiras permanecem desligados, conforme o estado anterior. Nenhum Job foi executado e nenhuma agenda foi criada ou ativada.

Início da coleta: **23/10/2026 14:32:34 BRT / 17:32:34 UTC**. Última conferência do serviço/execuções: **23/10/2026 14:38:09 BRT / 17:38:09 UTC**. Consolidação: **23/10/2026 14:40:03 BRT / 17:40:03 UTC**. [Evidência sanitizada](evidencias/V-RETOMADA-GCP-2026-10-23.json).

## Autorização, histórico e identidade

Retomada autorizada explicitamente pelo usuário após a conclusão comunicada por Vinícius: 517 vínculos, backup com restore de 38 tabelas, 11 auditorias de lote, duas exceções fora do lote e preservação de estoque, preços, IDs, pedidos e pontos. **O arquivo `L-NUVEMSHOP-APLICACAO-VINCULOS-2026-10-23.json` não estava disponível localmente nem em `origin/homologacao_teste` após fetch. Não foi lido; os resultados são informação recebida de Vinícius.** Esta execução não reaplicou nem revalidou os 517 vínculos.

Lidos AGENTS.md, relatórios de contenção de 22/10 e reconferência de 23/10, seus snapshots de reversão, README Cloud Run e guia local Next de Proxy. Consultada `origin/main` somente leitura em `7f9b26e062ec2654420fecffb6dd78ad3ba1e017`, incluindo o runbook histórico. HEAD e `origin/homologacao_teste` permanecem em `9d57dc14e9b1b895a0350c47897018db26577eeb`. Não houve publicação da main, acesso ao seu banco, commit ou push.

Confirmados antes das alterações: projeto `continental-511812` / número `15531616695`, região `southamerica-east1`, serviço `continental-hml`, Jobs `continental-hml-payments` e `continental-hml-supervision`. Banco `neondb`, host `ep-blue-feather-b6l24gbu.c-2.sa-east-1.aws.neon.tech`, loja `continental-homologacao`, ID `3a82b33c-3646-4272-9a89-80bb1ba327a5`. A consulta SQL foi READ ONLY. Bindings de banco foram resolvidos em memória, sem registrar credenciais; reconferidos também em todas as seis revisões novamente acessíveis.

A inspeção inicial encontrou a contenção exatamente como registrada: manutenção recebendo 100% e seis tags; Jobs com `/bin/false`; conta consumer desabilitada; nenhuma execução. Metadados e hashes de reversão foram salvos antes de cada alteração. A retomada usou esses snapshots, não configurações reconstruídas por inferência.

## Execução por recurso

| Recurso | Durante a manutenção | Reversão aplicada | Estado final / evidência |
|---|---|---|---|
| Template do serviço | APP_MAINTENANCE_MODE=true | Restaurado false por revisão técnica `continental-hml-resume-20261023`, sem tráfego/tag | Hash do template confirma que somente flag e nome técnico da revisão mudaram; mesma imagem, bindings, recursos e demais configurações. `changes.template-change`, `technicalRevisionValidation` |
| Tráfego principal | 100% na manutenção | Reposto exatamente o alvo anterior `continental-hml-896dc56-logout=100` | Distribuição original confirmada; nenhuma candidata promovida. `finalState`, `finalApplicationConfig` |
| Cinco tags anteriores | Todas apontando à manutenção | Repostos seus destinos anteriores | Todas acessíveis e validadas; mapa abaixo. `changes.traffic-change`, `probes` |
| Tag maintenance-20261022 | Apontava à manutenção | Retirada do conjunto de tags, como previsto | Revisão de manutenção preservada, sem tráfego/tag. Nenhuma revisão apagada |
| Conta continental-hml-consumer | disabled=true | Reabilitada após validação HTTP, com Jobs ainda neutralizados | disabled=false; conta web mantida habilitada. `changes.consumer-change`, `finalVerification.accounts` |
| continental-hml-payments | `/bin/false`, sem argumentos | Restaurados `node` e `scripts/cloudrun-consumer.mjs` | Template completo idêntico ao anterior; modo payments, mesma origem/imagem/segredo, timeout 1800s e retries=0; zero execuções. `finalVerification.jobs` |
| continental-hml-supervision | `/bin/false`, sem argumentos | Mesma restauração de comando/argumentos | Template completo idêntico ao anterior; modo supervision, timeout 60s e retries=0; zero execuções. `finalVerification.jobs` |
| IAM de projeto/serviço/Jobs | Não havia grants temporários para reverter | Nenhuma política modificada | Comparações antes/depois iguais; sem ampliação de permissões |
| Scheduler / Tasks / Eventarc | APIs já desabilitadas antes da janela | Nenhuma ativação | Permanecem desabilitadas; nenhuma agenda anteriormente ativa identificada para restaurar. Inventário histórico indisponível por SERVICE_DISABLED |
| Pub/Sub / pools / domain mappings | Listagens vazias no inventário inicial | Nenhuma alteração | Nada excluído, criado ou processado |
| Checkout e controles financeiros | Checkout pausado; remote/worker/expiration=false | Preservados | Todas as revisões acessíveis mantêm os controles anteriores desligados |

Horários das solicitações e confirmações:

- Restauração do template solicitada em **23/10/2026 14:33:13 BRT / 17:33:13 UTC**, revisão técnica Ready confirmada diretamente. O tráfego ainda estava integralmente na manutenção nesse ponto.
- Restauração do tráfego/tags solicitada em **23/10/2026 14:34:11 BRT / 17:34:11 UTC**; estado Ready do serviço após roteamento em **23/10/2026 14:34:22 BRT / 17:34:22 UTC**.
- Conta consumer reabilitada e conferida em **23/10/2026 14:35:53 BRT / 17:35:53 UTC**.
- Job payments: atualização aceita em **23/10/2026 14:36:26 BRT / 17:36:26 UTC**. Job supervision: **23/10/2026 14:36:34 BRT / 17:36:34 UTC**. Ambas as operações posteriormente confirmadas `done=true`, sem erro e sem reconciliação pendente.

## Roteamento e artefatos finais

As duas URLs principais são `https://continental-hml-15531616695.southamerica-east1.run.app` e `https://continental-hml-jctvprygla-rj.a.run.app`. As cinco URLs de tag constam integralmente na evidência.

| Ingresso | Revisão | Tráfego principal | Digest efetivo preservado |
|---|---|---:|---|
| Serviço principal | `continental-hml-896dc56-logout` | 100% | `sha256:00dde59c69248b51cd05cb402f835520e810cd6786912c91ce6cb7c2a185c686` |
| dashboard-eff10bf | `continental-hml-eff10bf-dashboard` | 0% | `sha256:152430471d6699e2a7cf9e6ddf74d13e78d7762d60e5a1f9c6cb02b86bf2d199` |
| review-17fd1a7 | `continental-hml-17fd1a7-review` | 0% | `sha256:fc46874ed4993a46c1e4e4c601483650356c5619fd6123201d71abbf5dd02368` |
| review-9495ff9 | `continental-hml-9495ff9-review` | 0% | `sha256:7a360eb28fd93be1606d6b8c1591e12c61c3d1db5f06fdb51ca86fe81d056202` |
| review-ae9ec9c | `continental-hml-ae9ec9c-review` | 0% | `sha256:0165e678e299c6f6fc6169ca675fa9f6f42f7bc11c5840bbf9803944759788b0` |
| review-d63ad8a | `continental-hml-d63ad8a-review` | 0% | `sha256:ba883be27218190f2f5256134b586e891b853afdee9ff577053abbf66f25c455` |

A revisão técnica `continental-hml-resume-20261023` tem **0% e nenhuma tag**. Usa o mesmo digest do template anterior e dos Jobs: `sha256:7a360eb28fd93be1606d6b8c1591e12c61c3d1db5f06fdb51ca86fe81d056202`. Não houve build, troca de artefato de uma revisão existente, promoção de candidata ou novo split de tráfego; foi reposto o mapa anterior à contenção. A revisão de manutenção também continua preservada sem tráfego/tag. Há 12 revisões após acrescentar somente a revisão técnica autorizada.

O campo `latestReadyRevision` da API v2 ainda indicava a revisão de manutenção. Ele não foi usado como indicação de tráfego: `trafficStatuses`, condições Ready das revisões e sondas comprovam os destinos acima. A revisão técnica foi consultada diretamente e está Ready.

## Validação sem efeitos comerciais

Foram **42 sondas GET**, seis por origem, nas sete origens restauradas. Todas passaram:

| Sonda por origem | Resultado em todas as sete origens |
|---|---|
| `/` | 200, aplicação disponível |
| `/admin`, sem cookie | 307 para `/login`, autenticação esperada |
| `/api/loja/active` | 200, ID/slug da homologação corretos; demais campos pessoais não registrados |
| `/api/products?limit=1` | 200, JSON válido, sem armazenar conteúdo de catálogo |
| `/api/cron/payments/status`, anônimo | 401, proteção mantida |
| Mesmo status com credencial correspondente ao binding | 200, schemaVersion=1, accountScope=sandbox-hml; leitura de supervisão |

Nenhuma sonda retornou manutenção. Não houve POST, criação de sessão/pedido, simulação de pagamento, reenvio de webhook nem alteração de catálogo/estoque. Não foram sondadas rotas de checkout/carrinho que poderiam criar contexto. Acesso Admin foi validado somente pelo redirecionamento anônimo; não se declara ensaio administrativo autenticado.

Antes de restaurar cada Job, houve nova consulta autenticada ao seu destino real: `https://review-9495ff9---continental-hml-jctvprygla-rj.a.run.app/api/cron/payments/status`, com 200 e contrato esperado. Ambos apontam ao próprio GCP, portanto **não havia dependência da liberação da Vercel para restaurar esses templates**. Nenhum Job foi executado para testar.

Os logs coletados em **23/10/2026 14:37:26 BRT / 17:37:26 UTC** contêm **45 requests**, incluindo as 42 sondas e as três conferências de destino relacionadas às tentativas de atualização dos Jobs. Distribuição HTTP: `{200: 31, 307: 7, 401: 7}`. Nenhum 5xx, nenhuma resposta de manutenção e **zero entradas de aplicação com severity>=ERROR** no intervalo consultado. Cloud Audit Logs confirmam as alterações de serviço, habilitação da conta e atualizações dos Jobs com status de sucesso. Os logs têm atraso de ingestão; foram combinados com respostas concluídas e configuração efetiva.

A consulta SQL posterior, iniciada em **23/10/2026 14:37:19 BRT / 17:37:19 UTC**, reconfirmou a identidade em READ ONLY: **21 conexões ociosas, zero transações abertas nessas conexões, zero transações preparadas, zero locks relevantes e zero leases**. As conexões são compatíveis com a aplicação novamente acessível; não foram encerradas. Pendências iguais antes/depois: inbox 1 READY + 30 COMPLETED; outbox 1 DEAD_LETTER + 22 COMPLETED; operações 1 PENDING + 15 COMPLETED. Isso não é auditoria integral de dados comerciais nem prova de sincronização.

## Ocorrências tratadas e limites

1. Uma verificação local inicialmente esperava que `latestReadyRevision` apontasse imediatamente à revisão técnica sem tráfego. Ela interrompeu o procedimento antes de alterar o roteamento. A verificação foi corrigida para consultar diretamente a condição Ready e o digest da revisão técnica, mantendo as comparações de template e tráfego.
2. A primeira chamada PATCH do Job payments foi recusada com HTTP 400 porque essa API não aceita `updateMask`. Nenhuma mudança foi aplicada nessa tentativa. Após reconferir `/bin/false` e o template original, foi usado o mesmo contrato PATCH da contenção, com etag e os campos atuais preservados, alterando apenas comando/argumentos. Ambas as atualizações terminaram com sucesso.
3. Uma comparação auxiliar de arrays inicialmente considerou a ordenação das tags. A API normalizou a ordem; a comparação final usa tuplas revisão/tag/percentual e confirma igualdade, com o mesmo etag. Registro inicial preservado em `state-initial.json`. Nenhuma alteração remota adicional foi feita por isso.

Nenhuma pendência técnica de retomada GCP identificada no escopo. As APIs desabilitadas impedem enumerar agendas históricas; não foram habilitadas para a conferência. IAM continua permitindo reconfiguração por operadores privilegiados. A existência de Jobs restaurados não significa execução financeira liberada: flags e ausência de agendas permanecem como antes.

Vercel e reativação posterior da fila Asaas pertencem a Vinícius. Cloudflare deve permanecer desativado conforme a instrução recebida; não foi consultado ou alterado nesta execução. Nenhum endpoint ou configuração dessas três plataformas foi modificado. Nenhuma importação, migration, reaplicação de vínculos, saneamento, alteração de preço/estoque/pedido/pontos ou nova sincronização foi executada. Não foi iniciado servidor/consumidor local.

## Evidências e recuperação

- Relatório: `trabalho_em_dupla/RETOMADA_GCP_JANELA_2026-10-23.md`.
- Evidência: `trabalho_em_dupla/evidencias/V-RETOMADA-GCP-2026-10-23.json`.
- Coletores, snapshots anteriores a cada mudança, operações e erros tratados: `artifacts/gcp-resume-20261023/`, ignorado pelo Git; hashes na evidência consolidada.
- Snapshots originais de 22/10 e reconferência de 23/10 preservados. Nenhuma configuração de retorno foi reconstruída por suposição.

Se surgir falha posterior, os controles conhecidos permanecem disponíveis para o componente afetado: tag problemática pode voltar à revisão `continental-hml-maint-20261022`; Job afetado pode voltar a `/bin/false`, preservando argumentos anteriores e sem cancelar indiscriminadamente trabalho. Nenhuma nova contenção foi necessária após a validação final e não há ação automática programada.

Referências de contrato consultadas: [tráfego e tags](https://docs.cloud.google.com/sdk/gcloud/reference/run/services/update-traffic), [habilitação de service accounts](https://docs.cloud.google.com/iam/docs/service-accounts-disable-enable). Esses contratos não substituem os snapshots reais registrados acima.

**GCP RETOMADO E VALIDADO NO ESCOPO REGISTRADO.** Acesso da aplicação e controles temporários restaurados ao estado comprovado anterior; checkout, processamento financeiro e agendas permanecem conforme baseline. A retomada e os vínculos comunicados não comprovam integração SMB Store → Nuvemshop → Continental, sincronização automática ou baixa de estoque no ERP.
