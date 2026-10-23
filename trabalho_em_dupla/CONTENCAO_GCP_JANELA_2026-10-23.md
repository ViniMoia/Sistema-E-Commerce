# Reconferência da contenção GCP — 23/10/2026

**Contenção de ontem confirmada e preservada. Nenhuma alteração remota foi necessária nesta execução.** Foram feitas consultas GCP/SQL somente leitura, inspeção local e 56 sondas GET sem efeitos comerciais. Não houve retomada nem temporizador de retomada.

Coleta GCP iniciada em **23/10/2026 11:55:29 BRT / 14:55:29 UTC**. Consolidação encerrada em **23/10/2026 12:04:16 BRT / 15:04:16 UTC**. [Evidência sanitizada](evidencias/V-CONTENCAO-GCP-2026-10-23.json). As consultas abaixo têm seus próprios horários; a consolidação não representa nova consulta ao banco.

## Identidades e fontes

- Projeto `continental-511812`, número `15531616695`; região `southamerica-east1`; serviço `continental-hml`. O projeto padrão do gcloud é outro; todas as chamadas usaram o projeto autorizado explicitamente, sem alterar o padrão.
- Banco `neondb`, host `ep-blue-feather-b6l24gbu.c-2.sa-east-1.aws.neon.tech`. Os dois bindings efetivos DATABASE_URL/DIRECT_URL da revisão em tráfego foram resolvidos em memória e conferidos. A conexão SQL local reconfirmou a loja `continental-homologacao`, ID `3a82b33c-3646-4272-9a89-80bb1ba327a5`.
- HEAD `9d57dc14e9b1b895a0350c47897018db26577eeb`; PR #14 integrado em `bcdce982dffc4b61dd9f22e9a21f90bcaa3b68b1`, ancestral do HEAD. Nenhum vínculo aplicado.
- `origin/main` consultada somente leitura em `7f9b26e062ec2654420fecffb6dd78ad3ba1e017`: auditoria de infraestrutura e runbook de implantação. O procedimento atual de homologação corrige pressupostos históricos; documentos exemplificativos não foram tratados como configuração implantada. Não houve conexão ao banco principal.
- Lidos AGENTS.md, `infra/cloudrun/README.md`, runbook atual em `diversos/AUDITORIAS/operations/operations/DEPLOYMENT-RUNBOOK.md`, publicação 9495ff9, preparação de produção de 22/10 e relatório/evidência de contenção de 22/10. Guia local Next sobre Proxy consultado; nenhuma mudança de aplicação.
- Revisão efetiva `continental-hml-maint-20261022`; fonte publicada `9495ff942e832db6588219e57163982b246e16d7`; digest `sha256:7a360eb28fd93be1606d6b8c1591e12c61c3d1db5f06fdb51ca86fe81d056202`.

## Histórico separado da verificação atual

O documento de preparação de 22/10, às 12h, era preparação sem contenção aplicada. O relatório local posterior e seus artefatos registram ações entre 17h09 e 17h11. **Hoje os Cloud Audit Logs confirmaram** atualizações bem-sucedidas de ambos os Jobs às 17:09:47/49 BRT, desabilitação da identidade às 17:09:56 BRT e alterações do serviço às 17:10:03 e 17:11:06 BRT de 22/10. Esses horários são os do servidor, distintos dos horários de envio registrados ontem.

O inventário remoto atual coincide com esse resultado; a projeção do serviço (incluindo flags, imagem, bindings e tráfego) coincide com a salva ontem, e os templates completos dos Jobs coincidem com os templates anteriores acrescidos apenas de `/bin/false` e remoção de argumentos. O etag do serviço permaneceu igual entre a primeira e a última leitura de hoje. A consulta de auditoria não retornou novas alterações depois da contenção no intervalo consultado. Portanto, a conclusão usa auditoria remota e estado atual, não a existência de um prompt ou plano anterior.

## Recursos, ações e resultado

| Recurso | Estado encontrado hoje | Ação nesta execução | Estado final | Evidência JSON |
|---|---|---|---|---|
| Serviço principal, duas URLs | 100% na revisão de manutenção; flag true; geração observada 12/12 | Conferência e sondas | Preservado; 503 em páginas/APIs | inventory.service, finalControls, httpProbes |
| Tags dashboard-eff10bf, review-d63ad8a, review-17fd1a7, review-ae9ec9c, review-9495ff9 e maintenance-20261022 | Todas na manutenção | Sondas em cada origem | Nenhuma aponta para revisão antiga | inventory.service.trafficStatuses, httpProbes |
| Onze revisões, dez anteriores à manutenção | Revisões antigas preservadas, sem tráfego/tag | Inventário completo | Preservadas sem rota ativa | inventory.revisions |
| continental-hml-payments | `/bin/false`, sem args, retries=0, zero execuções | Conferência de template, IAM e execuções | Consumidor não inicia | inventory.jobs, finalControls.jobs |
| continental-hml-supervision | Mesmo bloqueio, zero execuções | Mesma conferência | Consumidor não inicia | inventory.jobs, finalControls.jobs |
| Conta continental-hml-consumer | disabled=true | Consulta IAM | Continua desabilitada; web habilitada | inventory.accounts, finalControls |
| Cloud Run em todas as regiões | Um serviço e os dois Jobs conhecidos | Listagens sem filtro regional | Nenhum serviço/Job adicional encontrado | inventory.servicesAllRegions, inventory.jobs |
| Pub/Sub | Zero tópicos e assinaturas; paginação concluída | Leitura | Nada excluído ou reconhecido | inventory.extra |
| Worker pools e domain mappings na região | Listagens vazias | Leitura | Sem receptor/mapeamento adicional identificado | inventory.extra |
| Scheduler, Cloud Tasks, Eventarc | APIs desabilitadas, listagens recusadas com SERVICE_DISABLED | Preservadas, sem habilitar APIs | Destinos HTTP/Jobs continuam contidos | inventory.extra, inventory.enabledApis |
| Outros executores | APIs Compute, GKE, Functions, Workflows, Batch e Cloud Build não habilitadas | Inventário de APIs | Nenhuma ativação | inventory.enabledApis |
| Banco/leases/locks | Três observações sem trabalho ativo | REPEATABLE READ / READ ONLY | Sem outras sessões, transações, leases ou locks; backup direto acessível | databaseSnapshots |
| Processos/tarefas desta máquina | Nenhum escritor HML ativo identificado | Inventário, sem encerrar processos | Sem servidor, importador, cliente SQL, serviço ou tarefa relacionada ativo | local |

## Acesso anônimo, autenticado e privilegiado

Foram **48 sondas GET**: seis rotas em cada uma das oito origens (`/`, `/admin`, `/api/products`, `/api/checkout/context`, `/api/cron/payments/status`, `/api/webhooks/asaas`). Todas retornaram 503 de manutenção com `private, no-store`. As oito sondas de cron usaram a credencial correspondente ao binding efetivo, mantida apenas em memória.

Outras **oito sondas** combinaram token de identidade Google em `X-Serverless-Authorization` e credencial do cron no cabeçalho da aplicação: também 503 de manutenção. IAM do serviço permanece público (`allUsers`); não se apresenta esse teste como revogação IAM. O roteamento e o guard antes da autenticação aplicam-se igualmente a invocadores autenticados. Para Admin/Server Actions, a evidência combina configuração, sondas GET e fonte do digest publicado: Proxy com matcher `/:path*`, manutenção antes da autenticação e guard Prisma global. Não foi utilizada sessão real de administrador nem enviado POST de evento financeiro.

Os operadores continuam com `run.jobs.run`, `run.jobs.runWithOverrides` e `run.jobs.update`; não houve revogação ampla. O comando fixo `/bin/false` impede executar o consumidor, mesmo com override normal de argumentos; a identidade está adicionalmente desabilitada. Não foi criado um registro de execução para testar. [Contrato oficial de overrides](https://docs.cloud.google.com/run/docs/reference/rest/v2/projects.locations.jobs/run).

Owner, Editor herdado e deployers capazes de reconfiguração ainda podem desfazer os controles. **Devem manter serviço, tags, Jobs e identidade inalterados durante a janela.** Acesso de backup, administração SQL e logs foi preservado; não foi implementado bloqueio exclusivo do banco.

## Drenagem e preservação

As consultas SQL confirmaram `transaction_read_only=on`, identidade da loja e visibilidade `pg_read_all_stats`. A própria sessão de observação foi excluída das contagens.

| Início da consulta (BRT / UTC) | Outras sessões | Outras transações | Locks públicos de outras sessões | Leases reivindicados inbox / outbox / attempt |
|---|---:|---:|---:|---|
| 23/10/2026 11:56:08 BRT / 14:56:08 UTC | 0 | 0 | 0 | 0 / 0 / 0 |
| 23/10/2026 11:57:08 BRT / 14:57:08 UTC | 0 | 0 | 0 | 0 / 0 / 0 |
| 23/10/2026 11:59:15 BRT / 14:59:15 UTC | 0 | 0 | 0 | 0 / 0 / 0 |

A terceira transação foi observada no servidor em **23/10/2026 11:59:17 BRT / 14:59:17 UTC** e a conexão terminou em **23/10/2026 11:59:18 BRT / 14:59:18 UTC**. Ela também verificou **zero transações preparadas e zero locks relevantes**, incluindo os não restritos a tabelas públicas. Leases não expirados e expirados com proprietário: zero nas três tabelas.

O intervalo entre a primeira observação e o fechamento da terceira conexão foi de **189.9 segundos**. A prova não depende apenas desse intervalo: o controle continua igual desde 22/10 às 17:11 BRT, muito além dos timeouts configurados de 60s web/supervisão e 1800s pagamentos; ambos os Jobs registram zero execuções em todas as listagens. Não houve cancelamento forçado nem processamento para tentar esvaziar filas.

A coleta de requests em **23/10/2026 11:59:19 BRT / 14:59:19 UTC** retornou 106 registros desde 22/10 às 17:04 BRT, com paginação concluída. O único acesso à revisão antiga foi às 17:07:22 BRT de ontem, concluído em 4,85s, antes do corte. Os 56 requests de hoje são as sondas desta tarefa e todos terminaram com 503 na manutenção. A métrica das 11:58 BRT registra manutenção com zero instâncias ativas e uma ociosa; não há amostras recentes das revisões antigas. Ausência de amostra não foi convertida em contagem zero. Logs/métricas têm atraso de ingestão e foram combinados com controles, histórico e SQL, conforme a [documentação de migração de tráfego](https://docs.cloud.google.com/run/docs/rollouts-rollbacks-traffic-migration), que preserva requisições em voo durante o corte.

Pendências persistidas permaneceram idênticas nas três consultas e ao registro de ontem:

- PaymentInbox: 1 READY, 30 COMPLETED.
- CommerceOutbox: 1 DEAD_LETTER, 22 COMPLETED.
- PaymentOperation: 1 PENDING, 15 COMPLETED.

São pendências preservadas, não operações com lease ativo. Nenhuma fila, mensagem, assinatura, revisão ou dado foi excluído; nenhum evento foi confirmado, rearmado ou reenviado. Nenhum receptor adicional foi interrompido hoje. A recuperação de eventos no provedor não é inferida do HTTP 503.

## Máquina local e limites de observação

Inventários locais às **23/10/2026 11:56:12 BRT / 14:56:12 UTC** e **23/10/2026 11:58:20 BRT / 14:58:20 UTC**, complementados às **23/10/2026 12:00:18 BRT / 15:00:18 UTC**. O primeiro inventário viu a conexão PostgreSQL do próprio coletor READ ONLY `database.cjs` (PID 16072); ela terminou. O segundo encontrou zero conexões locais nas portas PostgreSQL e nenhum servidor Next, importador ou ferramenta SQL ativo. A última checagem complementar não encontrou processos Node/Python/SQL/VM em execução.

Nenhuma tarefa Windows ou serviço com referência ao projeto, Neon, Prisma, consumidor financeiro ou Nuvemshop foi encontrado. Há scripts de importação, sincronização, reparo, seed e processamento no disco, listados em `local.additional.potentialWriterFilesPresent`; não foram executados. Sua mera existência não é processo ativo. Credenciais e editores continuam disponíveis: operadores não devem iniciar servidores, scripts, SQL manual ou novas automações durante a janela.

O shell persistente PID 14124 foi identificado como native messaging do Brave/Bitdefender (`bdtrackersnmh.exe`). As chamadas Python/PowerShell observadas pertenciam aos coletores desta tarefa; chamadas Docker transitórias pertenciam ao editor. Docker Desktop Linux estava sem engine disponível e a distribuição WSL `docker-desktop` estava **Stopped**. Não foi iniciado Docker/WSL para inspecionar.

**Limites de acesso registrados:** `Get-VM` foi negado, de modo que VMs cadastradas no Hyper-V não foram inventariadas; não havia processo `vmwp`/`vmmem` ou motor de VM na lista de processos. Linhas de comando de processos de sistema não estavam acessíveis; seus nomes foram registrados. Essas limitações impedem afirmar auditoria integral da máquina, mas não deixaram escritor HML ativo identificado sem tratamento, nem impedem a prova dos recursos GCP inventariados. Não foram encerrados editores ou processos genéricos sem vínculo com a homologação.

As APIs de Scheduler/Tasks/Eventarc desabilitadas impedem enumerar agendas/filas históricas; não se afirma inexistência delas ou de acionadores externos. Qualquer invocação dos destinos GCP identificados encontra o bloqueio HTTP ou o Job neutralizado. Nenhuma API foi habilitada para essa auditoria.

## Frentes externas: contexto recebido, não conferido aqui

O usuário informou conferência de Vinícius em **23/10 às 11:01 BRT / 14:01 UTC**: domínio HML e deployment Vercel antigo com HTTP 403 usando acesso de automação; Asaas Sandbox `enabled=true`, `interrupted=true`; responsável apenas acompanhando painéis. Cloudflare foi comunicado desabilitado e sem cron em 22/10, com reconferência a cargo de Vinícius. **Nenhuma dessas plataformas foi consultada ou alterada nesta execução.**

Retenção/reentrega do provedor e contenção das outras máquinas continuam sob coordenação de Vinícius. A conclusão GCP não libera isoladamente a aplicação dos vínculos nem declara suspensão global.

## Retomada exata dos controles existentes — não executada

Não há alteração de hoje para reverter. Os metadados anteriores à contenção de ontem foram preservados e reconferidos em `restore` na evidência JSON e nos artefatos de 22/10. Não foi inventada nova configuração de retorno.

Executar somente após comunicação explícita de conclusão dos vínculos e da conferência, compatibilidade da versão com os dados e coordenação com Vinícius. Antes de cada comando, comparar o recurso com a evidência atual; se houve mudança posterior, interromper a reversão automática. A compatibilidade após os vínculos não foi atestada nesta tarefa.

1. Restaurar o valor anterior do template por nova revisão sem tráfego, preservando imagem e bindings: `gcloud run services update continental-hml --project=continental-511812 --region=southamerica-east1 --update-env-vars=APP_MAINTENANCE_MODE=false --no-traffic`. Isso não muda a revisão imutável de manutenção nem reabre seu tráfego.
2. Repor exatamente o tráfego/tag anterior; `--set-tags` substitui o conjunto e retira a tag temporária, sem excluir revisões:

```powershell
gcloud run services update-traffic continental-hml --project=continental-511812 --region=southamerica-east1 --to-revisions=continental-hml-896dc56-logout=100 --set-tags=dashboard-eff10bf=continental-hml-eff10bf-dashboard,review-d63ad8a=continental-hml-d63ad8a-review,review-17fd1a7=continental-hml-17fd1a7-review,review-ae9ec9c=continental-hml-ae9ec9c-review,review-9495ff9=continental-hml-9495ff9-review
```

3. Reabilitar somente a conta consumidora, com os Jobs ainda neutralizados: `gcloud iam service-accounts enable continental-hml-consumer@continental-511812.iam.gserviceaccount.com --project=continental-511812`.
4. Restaurar somente comando e argumentos dos dois Jobs, conferindo os templates anteriores:

```powershell
gcloud run jobs update continental-hml-payments --project=continental-511812 --region=southamerica-east1 --command=node --args=scripts/cloudrun-consumer.mjs
gcloud run jobs update continental-hml-supervision --project=continental-511812 --region=southamerica-east1 --command=node --args=scripts/cloudrun-consumer.mjs
```

5. Revalidar roteamento, acesso, filas e logs. Manter checkout pausado e flags financeiras false conforme baseline; não criar agenda, iniciar Job, replay, sincronização ou venda como consequência automática da reversão. Ativação posterior e tratamento de pendências exigem sua própria coordenação.

Arquivos: `trabalho_em_dupla/CONTENCAO_GCP_JANELA_2026-10-23.md`, `trabalho_em_dupla/evidencias/V-CONTENCAO-GCP-2026-10-23.json`; coletores/snapshots sanitizados em `artifacts/gcp-maintenance-20261023/` (ignorado pelo Git), com hashes na evidência. Registros de 22/10 preservados. Nenhum commit/push realizado.

**GCP CONTIDO E DRENADO PARA A JANELA.** Controles efetivos de ontem preservados e reconferidos hoje, sem execuções ou escritas GCP em andamento identificadas pelas observações combinadas. A conclusão limita-se à frente GCP e aos processos locais observados; Vercel, Cloudflare, Asaas e demais operadores dependem de Vinícius. Manter os controles até comunicação explícita de retomada.
