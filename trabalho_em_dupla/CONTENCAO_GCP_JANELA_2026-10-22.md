# Contenção GCP — janela de homologação de 22/10/2026

**GCP CONTIDO E DRENADO PARA A JANELA.** Confirmação dos escritores configurados no GCP, limitada ao inventário e às verificações abaixo. Vercel, Cloudflare e clientes SQL/scripts externos dependem dos respectivos responsáveis. A contenção permanece aplicada, sem prazo de retomada automática.

Início do registro da preparação: **17:05:00 BRT / 20:05:00 UTC**. Término da verificação técnica: **17:14:55 BRT / 20:14:55 UTC**, em 22/10/2026. Este término não encerra a manutenção.

[Evidência estruturada](evidencias/V-CONTENCAO-GCP-2026-10-22.json). Metadados completos de reversão e coletores locais ficam em `artifacts/gcp-maintenance-20261022/`, ignorado pelo Git. Não foram registrados valores secretos, conexões com credenciais ou conteúdos de eventos.

## Contexto reconferido

- Projeto `continental-511812`; região `southamerica-east1`; único serviço listado no projeto: `continental-hml`.
- Banco `neondb`, host `ep-blue-feather-b6l24gbu.c-2.sa-east-1.aws.neon.tech`. Bindings efetivos DATABASE_URL/DIRECT_URL comparados em memória; loja `continental-homologacao`, ID `3a82b33c-3646-4272-9a89-80bb1ba327a5`, conferida em transação READ ONLY.
- `bcdce982dffc4b61dd9f22e9a21f90bcaa3b68b1` é ancestral do HEAD `9d57dc14e9b1b895a0350c47897018db26577eeb`. Nenhum vínculo desse PR foi aplicado nesta preparação.
- Lidos AGENTS, runbook de implantação/manutenção, README Cloud Run, publicação 9495ff9 e documentos Nuvemshop. Consultada `origin/main` em `7f9b26e062ec2654420fecffb6dd78ad3ba1e017`, incluindo auditoria de infraestrutura. O README Cloud Run atual não existe nessa revisão da main; foram usadas as evidências posteriores de homologação. Main e banco principal não foram alterados.
- Revisão de manutenção: **`continental-hml-maint-20261022`**, com fonte `9495ff942e832db6588219e57163982b246e16d7` e o mesmo artefato aprovado da candidata. [CI de referência](https://github.com/ViniMoia/Sistema-E-Commerce/actions/runs/39619498248).
- Imagem: `southamerica-east1-docker.pkg.dev/continental-511812/releases/store@sha256:7a360eb28fd93be1606d6b8c1591e12c61c3d1db5f06fdb51ca86fe81d056202`.
- URL principal: https://continental-hml-15531616695.southamerica-east1.run.app — responde manutenção.

## Alterações e comprovação

| Recurso | Estado anterior | Alteração aplicada | Estado atual / evidência |
|---|---|---|---|
| Serviço / tráfego principal | `896dc56-logout`, 100%; manutenção false | Nova revisão com APP_MAINTENANCE_MODE=true, mesmo digest da candidata; 100% direcionado a ela | Configuração reconciliada; ambas as URLs principais retornam 503 APP_MAINTENANCE nas APIs |
| Cinco tags antigas | Cada tag apontava para sua revisão anterior | Todas redirecionadas à revisão de manutenção | Cada URL conferida em seis rotas; nenhuma tag alcança revisão antiga |
| Tag `maintenance-20261022` | Inexistente | Criada para verificar manutenção antes do redirecionamento | 503 com credencial válida do cron; permanece na revisão de manutenção |
| Job `continental-hml-payments` | `node scripts/cloudrun-consumer.mjs`; zero execuções; retries=0 | Entrypoint fixo `/bin/false`, argumentos vazios | Comparação confirma que somente comando/argumentos mudaram; zero execuções; programa consumidor não inicia |
| Job `continental-hml-supervision` | Mesmo programa, modo supervision; zero execuções; retries=0 | Entrypoint fixo `/bin/false`, argumentos vazios | Mesma comparação e zero execuções; programa consumidor não inicia |
| Conta `continental-hml-consumer` | Habilitada; usada pelos dois Jobs | Desabilitada às 17:09:54 BRT / 20:09:54 UTC | IAM confirma disabled=true; conta web permanece habilitada |
| Scheduler / Tasks / Eventarc e demais executores | APIs desabilitadas no projeto | Nenhuma API habilitada ou recurso apagado | Listagem de agendas históricas indisponível; qualquer chamada aos Jobs/ingressos identificados encontra a contenção |
| Pub/Sub, worker pools e domain mappings | Nenhum tópico/assinatura no projeto; nenhum pool/mapeamento na região | Nenhuma alteração | Listagens vazias, sem paginação pendente |
| Banco / filas / acesso de backup | Acesso direto disponível; pendências financeiras existentes | Somente consultas READ ONLY | Sem alteração de roles, credenciais, dados, locks persistentes, filas ou procedimentos de backup |

As alterações dos Jobs foram aceitas às **17:09:45–17:09:47 BRT**. A publicação da revisão começou às **17:09:58 BRT**; o redirecionamento foi solicitado às **17:11:02 BRT / 20:11:02 UTC**. Todas as sondas estavam concluídas às **17:11:41 BRT / 20:11:41 UTC**.

**Precisão sobre invocação manual:** IAM continua concedendo `run.jobs.run` e `run.jobs.runWithOverrides` ao operador. Não foi declarada revogação dessas permissões. Uma solicitação pode criar um registro de execução que falhará, mas não executa o consumidor: o comando fixo é `/bin/false`, não substituível pelos overrides de argumentos de `jobs.run`; a identidade também está desabilitada. Reativar o programa exige alterar a configuração do Job/identidade, fora do acionamento manual normal. Nenhum Job foi executado como teste. O operador não dispõe de `iam.denypolicies.create/update/delete`; nenhuma ampliação de privilégios foi feita. [Contrato de overrides](https://docs.cloud.google.com/run/docs/reference/rest/v2/projects.locations.jobs/run), [desabilitação de contas](https://docs.cloud.google.com/iam/docs/service-accounts-disable-enable).

As dez revisões preexistentes foram inventariadas e preservadas. As seis antes acessíveis eram `896dc56-logout`, `eff10bf-dashboard`, `d63ad8a-review`, `17fd1a7-review`, `ae9ec9c-review` e `9495ff9-review` (prefixo `continental-hml-`). As demais não tinham tráfego/tag: `8c7f865-alias`, `00003-xhx`, `00002-d6f` e `17366e8-maint`. Nenhuma revisão antiga recebe tráfego ou tem tag no estado final.

## Ingressos, autenticação e drenagem

Foram feitas **48 sondas GET**, seis rotas em cada uma das oito URLs: `/`, `/admin`, `/api/products`, `/api/checkout/context`, `/api/cron/payments/status` e `/api/webhooks/asaas`. Todas retornaram 503 de manutenção com `private, no-store`.

As oito origens são as duas URLs principais do serviço e as tags `dashboard-eff10bf`, `review-d63ad8a`, `review-17fd1a7`, `review-ae9ec9c`, `review-9495ff9` e `maintenance-20261022`. O JSON registra cada URL, horário, método e resultado.

O status foi sondado com a mesma credencial válida que retornara 200 antes da contenção. O bloqueio não foi inferido de 401/403 anônimo. Para Admin, a evidência combina o Proxy global da fonte publicada — manutenção antes de autenticação/renderização, matcher `/:path*` —, configuração efetiva e sondas 503. Não foi utilizada uma sessão real de administrador. O cliente Prisma compartilhado também recusa consultas quando a flag está ativa. Isso cobre APIs, GETs com efeitos indiretos e Server Actions pelo guard global; não foi disparado POST financeiro para testar.

Consultas READ ONLY em **17:07:15**, **17:11:33**, **17:12:40** e **17:14:42 BRT** confirmaram identidade da loja. Nas três consultas após o redirecionamento: nenhuma outra sessão/transação no banco, nenhum lock de outra sessão nas tabelas públicas e zero leases em PaymentInbox, CommerceOutbox e PaymentAttempt. A conta de observação possui `pg_read_all_stats`; a própria sessão foi excluída da contagem. Não houve término forçado de processo/transação.

Os dois Jobs continuaram com zero execuções. A coleta de logs até **17:14:46 BRT** encontrou 50 requisições desde 17:04: a única em revisão antiga foi a leitura autenticada anterior à contenção, às 17:07:22 BRT, concluída em 4,85 segundos. As demais 49 responderam 503 na manutenção. A métrica de instâncias da candidata antiga mostrou zero instâncias ativas e ociosas às 17:13 BRT. Logs/métricas têm atraso de ingestão; foram combinados com configuração e snapshots do banco, e não usados isoladamente como prova de exclusividade global.

## Preservação de eventos e pendências externas

Não havia receptor Pub/Sub identificado nem webhook Asaas apontando ao GCP. O webhook Sandbox continua em `continental-prototipo-git-homologacaoteste-vinimoias-projects.vercel.app/api/webhooks/asaas`, com envio sequencial, enabled=true e **interrupted=true**, observado às **17:07:29 BRT**, antes de qualquer alteração GCP desta rodada. Esse estado difere da consulta anterior e precisa de conferência de Vinícius. O destino, token e configuração do provedor não foram alterados; nenhum evento foi reenviado. O GCP já mantinha o worker financeiro desligado antes desta janela.

As contagens persistidas permaneceram iguais antes/depois: **inbox 1 READY + 30 COMPLETED; outbox 1 DEAD_LETTER + 22 COMPLETED; operações 1 PENDING + 15 COMPLETED**. Nenhuma fila, mensagem ou registro foi removido, reconhecido ou rearmado. A pendência retida de operação não é lease ativo; deve seguir o tratamento financeiro autorizado.

Continuidade/reentrega da fila interrompida na Vercel ainda depende do responsável externo; não foi comprovada nesta execução. A liberação conjunta para aplicar vínculos depende também da contenção Vercel/Cloudflare e da suspensão dos scripts/importadores/Admin/SQL de cada desenvolvedor. Essas confirmações não foram presumidas. Administradores do GCP ainda podem desfazer os controles por reconfiguração; devem preservá-los durante a janela. Não foi criado bloqueio exclusivo no banco que impediria o backup ou o operador autorizado.

## Retomada — somente após comunicação explícita de conclusão e conferência

Os comandos abaixo são procedimento, **não foram executados**. Conferir primeiro que a configuração continua igual à evidência e que os dados/esquema são compatíveis; não sobrescrever mudança posterior de outro operador. Manter checkout pausado e todas as flags financeiras false.

1. Conferir com Vinícius a auditoria dos vínculos, backup e situação da recepção/reentrega na Vercel. Decidir conjuntamente quando liberar os ingressos. Não reenviar operações antigas automaticamente.
2. Reverter a flag do template por nova revisão sem tráfego, preservando a imagem e os demais bindings: `gcloud run services update continental-hml --project=continental-511812 --region=southamerica-east1 --update-env-vars=APP_MAINTENANCE_MODE=false --no-traffic`. Isso gera uma revisão; não modifica a revisão imutável de manutenção nem abre o serviço por si só.
3. Restaurar o roteamento e as cinco tags originais com o comando abaixo. O `--set-tags` retira a tag temporária; nenhuma revisão será excluída. Conferir configuração e sondas após a reconciliação. [Semântica oficial de tráfego/tags](https://docs.cloud.google.com/sdk/gcloud/reference/run/services/update-traffic).

```powershell
gcloud run services update-traffic continental-hml --project=continental-511812 --region=southamerica-east1 --to-revisions=continental-hml-896dc56-logout=100 --set-tags=dashboard-eff10bf=continental-hml-eff10bf-dashboard,review-d63ad8a=continental-hml-d63ad8a-review,review-17fd1a7=continental-hml-17fd1a7-review,review-ae9ec9c=continental-hml-ae9ec9c-review,review-9495ff9=continental-hml-9495ff9-review
```

4. Reabilitar a identidade **enquanto os Jobs ainda estão neutralizados**: `gcloud iam service-accounts enable continental-hml-consumer@continental-511812.iam.gserviceaccount.com --project=continental-511812`.
5. Para cada um dos dois Jobs, restaurar exclusivamente `--command=node --args=scripts/cloudrun-consumer.mjs` com `gcloud run jobs update NOME --project=continental-511812 --region=southamerica-east1`. Comparar com o template anterior: manter imagem, modo, origem, segredo, retries=0, paralelismo e timeout originais. Não criar agenda nem executar os Jobs como parte dessa reversão.
6. Revalidar estado das filas, logs e acessos, preservando o tratamento das pendências existentes. A eventual ativação de processamento/sincronização exige o aceite específico; não decorre da retirada da manutenção.

Nenhum backup, migration, vínculo, sincronização, pedido, pagamento, estorno ou reenvio foi executado nesta preparação. Nenhuma ação no SMB Store/Nuvemshop ou no banco principal. Nenhum temporizador de retomada foi instalado.

**GCP CONTIDO E DRENADO PARA A JANELA.** Contenção mantida; aplicação dos vínculos condicionada às confirmações externas e à coordenação com Vinícius.
