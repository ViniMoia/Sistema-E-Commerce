# Devolutiva de Vanderlei — seção 69 — 20/10/2026

**Atualização às 14:30 BRT:** houve nova publicação do PR #10 integrado,
`ae9ec9c`, sem promoção de tráfego. A [devolutiva da nova candidata](PUBLICACAO_HOMOLOGACAO_AE9EC9C_2026-10-20.md)
substitui a identidade/URL da parte A abaixo. A CI do código publicado está
aprovada. O inventário da parte B mantém seus horários e limitações; Jobs na
região e estado da API Scheduler foram reconferidos sem mudança. Não houve
ativação G6, transferência de webhook ou processamento financeiro.

**Escopo atualizado pela seção 70:** a política de imagens foi recebida.
Provisionar/configurar Storage para uploads foi retirado das tarefas de Vanderlei.
Usar referências externas Nuvemshop; Leno verifica importação e bloqueio em UI/API.
Nenhum recurso antigo será excluído por esta decisão. E-mail/reset e G6 mantêm
as pendências próprias descritas abaixo.

Referência consultada: branch `docs/aceite-e-devolutiva-20261020`, commit
`3c3bf725e96f33bcb38143cfd2e3f4c017298049`, seção 69 do Replanejamento.
Consulta por `git show`, sem integrar essa branch ou repetir a publicação.
Executor: Vanderlei. Consultas remotas somente leitura entre **14:31 e 14:35 UTC /
11:31 e 11:35 BRT**. Evidências:
[V-G6-INVENTARIO-2026-10-20.json](evidencias/V-G6-INVENTARIO-2026-10-20.json).

## A. Revisão disponível para a conferência de Leno

**Sem mudanças observadas na publicação desde a seção 68:** mesma imagem, revisão,
variáveis/referências de segredo, aliases e distribuição de tráfego. Houve apenas
trabalho documental no Git e coleta de informações; nenhuma nova implantação,
promoção, alteração de flags, webhook ou acionadores nesta rodada.

- SHA: `17fd1a7456441fd98c32957116c7f1247c68be22`.
- Revisão: `continental-hml-17fd1a7-review`, Ready=True.
- Digest Linux/amd64: `sha256:fc46874ed4993a46c1e4e4c601483650356c5619fd6123201d71abbf5dd02368`.
- URL: https://review-17fd1a7---continental-hml-jctvprygla-rj.a.run.app
- Cloud Run permite invocação pública; não exige login Google nem bypass Vercel.
  Home e login responderam 200. O Admin exige conta ativa ADMIN da própria loja:
  `/admin` anônimo respondeu 307 para `/login`; `/api/admin/users`, 401.
  As contas temporárias dos ensaios anteriores foram removidas. Não foi criada
  conta nem repetido o login nesta coleta.

| Revisão | Tráfego conferido em 20/10, 11:31:49 BRT |
|---|---:|
| `continental-hml-896dc56-logout` | 100% |
| `continental-hml-eff10bf-dashboard` | 0% |
| `continental-hml-d63ad8a-review` | 0% |
| `continental-hml-17fd1a7-review` | 0% |

```dotenv
CHECKOUT_PAUSED=true
APP_MAINTENANCE_MODE=false
PAYMENT_REMOTE_ENABLED=false
PAYMENT_WORKER_ENABLED=false
PAYMENT_EXPIRATION_ENABLED=false
PAYMENT_DEPLOYMENT_ENVIRONMENT=SANDBOX
ASAAS_ACCOUNT_SCOPE=sandbox-hml
```

**Bloqueios para consultar a candidata:** nenhum bloqueio de infraestrutura
identificado. Leno confirma acesso com sua conta autorizada; a posse de credenciais
por Leno não foi conferida nesta coleta. Se faltar acesso, o operador da loja
providencia a conta pelo canal privado, com apoio de Vanderlei; previsão a definir.
Ausência de caso elegível de retorno/chargeback deve ser registrada por Leno,
sem fabricar fatos. G6 não precisa estar ativado para iniciar essas consultas.

O erro de CI do commit documental `3eb4023` permanece uma pendência separada
(`BROWSER_START_FAILED`, execução `39421575989`, diagnosticada anteriormente).
Ele não alterou a revisão publicada, cuja CI do merge foi aprovada. Vanderlei
deve esclarecer/corrigir a inicialização do navegador e obter CI completa para
uma próxima candidata; nenhuma correção ou reexecução foi feita nesta coleta.

## B. Acionadores conhecidos e lacunas

| Plataforma / nome | Modo e destino | Estado / agenda / fuso | Última execução ou resultado | Fonte e limite |
|---|---|---|---|---|
| Google Cloud / Jobs | Propostos `continental-hml-payments`, `continental-hml-loyalty`, `continental-hml-supervision` | **Não configurados:** listagem sem filtro de região retornou zero Jobs | Não aplicável aos recursos inexistentes; histórico de Jobs removidos não conferido | Consulta atual ao projeto `continental-511812` às 11:34:58 BRT |
| Google Cloud / Scheduler | Propostas chamadas OAuth à API `jobs:run` | API desativada; agendas **não conferidas**; nenhuma API habilitada nesta coleta | Não conferido | Listagem bloqueada por API desativada; não presumir ausência global |
| Cloudflare / `continental-pagamentos-hml` | Código aponta para o Preview Vercel abaixo; modo `status` faz GET `/api/cron/payments/status`; modo `process` pode fazer POST `/api/cron/payments?limit=1` | **Sem acesso autenticado atual.** Arquivo local: `HML_SCHEDULER_ENABLED=false`, modo `status`, crons vazios | Última evidência recebida: 16/10, 19:43:37 UTC, `disabled`, sem processamento naquele evento | Relato do operador e registros de 16/10; configuração no Git não comprova estado implantado atual |
| Vercel / projeto `continental-prototipo` | Receptor Sandbox e possível destino de chamadas externas | **Sem acesso autenticado ao painel/API.** Cron nativo, flags e agenda efetivos não conferidos | Não conferido | Receptor confirmado pelo Asaas; inventário de execuções cabe ao administrador da conta com Leno |
| Execução manual / `scripts/homologation/process-payments-once.ps1` | Acionamento financeiro manual do Preview | Script existente; nenhuma execução nesta coleta; não é agenda | Última execução manual não conferida | Leno/operadores devem relacionar invocações recentes e em voo |
| Windows deste computador | Tarefas com nome/argumentos relacionados ao projeto e scripts de pagamento | Nenhuma tarefa correspondente encontrada | Não aplicável às tarefas não encontradas | Consulta às 11:35:43 BRT; não cobre outras máquinas ou processos manuais |
| GitHub Actions / CI | Testes com ambiente descartável | Workflow de CI tem disparo manual; nenhum cron encontrado nos workflows locais | CI não comprova processamento financeiro da homologação | Leitura da configuração local; outras automações externas permanecem não conferidas |

Host de destino definido no código do Worker:
`continental-prototipo-git-homologacaoteste-vinimoias-projects.vercel.app`.

Não foram encontrados CLI autenticado, token no ambiente ou arquivos padrão de
autenticação Cloudflare/Vercel nos locais conferidos. O plugin Vercel foi localizado
no catálogo, mas não está instalado/conectado. O administrador dessas contas deve
fornecer inventário sanitizado ou acesso de leitura autorizado; não enviar tokens
no chat/Git. Responsável pela obtenção: Vanderlei com operador/Leno. Previsão:
antes de qualquer transferência, data a definir.

## C. Webhook Sandbox e filas

Consulta **GET autenticada ao Asaas Sandbox**, às **11:31:52 BRT**,
usando a chave vinculada à revisão e conferida em memória com `.env.homologacao`:
um webhook listado, sem páginas adicionais.

- Host: `continental-prototipo-git-homologacaoteste-vinimoias-projects.vercel.app`.
- Caminho: `/api/webhooks/asaas`.
- `enabled=true`, `interrupted=false`: receptor habilitado e fila de sincronização
  **não interrompida** no Asaas.
- Entrega sequencial, API v3; e-mail de alerta cadastrado, sem divulgar destinatário.
- Quantidade de entregas pendentes no Asaas, última entrega e recebimento do alerta:
  **não conferidos**. Não interrompida não significa fila vazia ou processamento local saudável.

Consulta única **GET `/api/cron/payments/status`** da candidata, às
**11:31:49 BRT**, escopo `sandbox-hml`. A rota usa transação
`REPEATABLE READ / READ ONLY`; não foi executado Job, observador CLI ou consumidor.

| Estado interno observado | Resultado |
|---|---:|
| Inbox COMPLETED / READY | 30 / 1 |
| Outbox COMPLETED / DEAD_LETTER | 22 / 1 |
| Operações REFUND COMPLETED / PENDING | 13 / 1 |
| Operações CANCEL COMPLETED | 2 |
| Tentativas em revisão / operações retidas | 1 / 1 |
| Tentativas com revisão vencida (`overdue`) | 1 |
| Pagamentos incertos / leases abandonados / leases de fila vencidos | 0 / 0 / 0 |
| Revisões de chargeback / retorno físico | 0 / 0 |
| E-mails DEAD_LETTER / pedidos legados sem rastreio / contas divergentes | 0 / 0 / 0 |

Inbox não resolvida mais antiga: `2026-10-17T07:01:24.694Z`; outbox não resolvida:
`2026-10-10T00:59:17.814Z`; conciliação vencida mais antiga:
`2026-10-15T16:32:06.938Z`. São agregados da instalação, não IDs de casos nem
diagnóstico individual. Leno deve correlacionar os casos por leitura e registrar
responsável/próxima ação, sem rearmar o #3, repetir estornos ou processar o #8 nesta etapa.
Zero leases nesse instante não prova ausência de todas as requisições em voo.

## D. Alertas, responsáveis e permissões

Consulta completa das páginas das APIs Monitoring às **11:32:36 BRT**:
**zero canais de notificação e zero políticas de alerta** no projeto.
Listagem do Logging: **zero métricas personalizadas**. APIs Monitoring e Logging
habilitadas; isso não constitui uma política/entrega de alerta.

Os manifestos de heartbeat, ausência e falha/atenção dos três modos existem no Git:
**propostos, não implantados, sem entrega comprovada**. O e-mail indicado anteriormente
pelo operador é uma entrada de configuração, não um canal já criado.
O aviso de CI recebido do GitHub não comprova notificação G6.
O Asaas tem e-mail de alerta cadastrado, mas sua entrega não foi comprovada.

**Responsável de plantão e substituto: não definidos/aceitos formalmente.**
Proposta: Vanderlei atende infraestrutura/entrega de alertas; Leno atende a
interpretação financeira e os casos; operador nomeia substituto e confirma
disponibilidade/canal antes do ensaio. Essa proposta não declara aceite de escala.

Recursos e acessos:

- Existem `continental-hml-web` e a conta padrão Compute; as contas
  `continental-hml-consumer` e `continental-hml-scheduler` **não existem**.
- A política do segredo `continental-hml-cron-secret` concede acesso à conta web.
  Consumidor futuro precisará de `secretAccessor` apenas nesse segredo, com versão
  fixada; sem conexões diretas de banco, chave Asaas ou credencial de e-mail.
- Scheduler futuro chama `jobs:run` por OAuth; sua conta precisa de invocação no
  Job correspondente. O executor da configuração precisa poder anexar essas contas
  e criar/gerenciar os recursos aprovados. Conferir privilégios mínimos antes de conceder.
- Faltam Jobs, agendas, canais, métricas de conclusão e políticas.
  Comparar os manifestos antes de aplicar; não reaplicar o serviço web inteiro
  para provisionar alertas.
- IAM geral do projeto: **não conferido**, pois a consulta `projects get-iam-policy`
  retornou `SERVICE_DISABLED` para Resource Manager. Isso não prova ausência de
  permissões. Administrador do projeto deve conferir a política e coordenar a
  eventual habilitação das APIs necessárias; nenhuma API foi habilitada nesta coleta.
- Acesso de leitura efetivo a Cloud Run, Monitoring, Logging, lista de contas e
  política do segredo foi comprovado. Não foi testada permissão de escrita.
- `CRON_SECRET` continua compartilhado com rotas de processamento. O modo
  `supervision` é GET-only por contrato do programa, não uma credencial restrita a GET.

Referências: [Jobs com segredos](https://docs.cloud.google.com/run/docs/configuring/jobs/secrets)
e os contratos de `infra/cloudrun/README.md` / `scripts/render-cloudrun.mjs`.

## E. Proposta de ensaio, cadência e custo — não aprovada nem agendada

**Janela sugerida:** 21/10/2026, **14h–15h BRT / 17h–18h UTC**, somente após
confirmação de disponibilidade, inventário externo, acessos e canal/substituto.
Se os pré-requisitos não estiverem atendidos, reagendar; não iniciar automaticamente.
Vanderlei executa infraestrutura, Leno revisa baseline/caso, operador confirma atendimento.

Primeiro ensaio: apenas `CONSUMER_MODE=supervision`, GET de status a cada minuto
durante a janela assistida. Emitir série inicial; validar atenção/falha controlada,
pausa suficiente para observar ausência e retorno do heartbeat. Usar caso descartável
planejado por Leno, sem usar pendências históricas para gerar mutações.
Reservar tempo para atraso de ingestão e notificação; uma hora proposta não garante
que todas as evidências estarão disponíveis dentro dela.

Manter checkout pausado, controles financeiros desligados, webhook e processadores
antigos/novos sem alteração nessa fase. Sem habilitação permanente após a janela.
Uma cadência contínua do observador de cinco minutos pode ser avaliada depois,
considerando custo e banco. Pagamentos por minuto e pontos por hora são propostas
existentes para medição posterior com Leno, não agendas aprovadas.

**Estimativa de computação dos Jobs**, em USD, para São Paulo, sem franquias ou
descontos, com 1 vCPU / 512 MiB, uma tarefa, sem retries e duração total de cada
execução de até 60 segundos. O mínimo faturável é um minuto. Preços consultados
na tabela regional oficial: CPU US$ 0,0000216/vCPU-s e memória
US$ 0,0000024/GiB-s. Custo por execução: `60 × (0,0000216 + 0,5 × 0,0000024)`.

| Cenário de computação | Estimativa |
|---|---:|
| Uma execução de até 60 s | US$ 0,001368 |
| Até 60 execuções no piloto | US$ 0,08208 |
| Um Job por minuto, 30 dias contínuos | US$ 59,10/mês |
| Um Job a cada cinco minutos, 30 dias | US$ 11,82/mês |
| Um Job por hora, 30 dias | US$ 0,98/mês |

Esses valores **não são o custo total**: faltam aplicação web, Neon, logs/métricas/
alertas, rede, imagens e eventuais excedentes de duração. O plano/custo Neon e
franquias disponíveis na conta estão **não conferidos**. Consultas frequentes podem
manter o compute ativo; medir duração, conexões e custo antes de recorrência contínua.
Scheduler cobra por Job, com referência de US$ 0,10/Job/mês antes da franquia
compartilhada; disponibilidade de franquia na conta não foi conferida.
Fontes: [Cloud Run, tabela São Paulo](https://cloud.google.com/run/pricing) e
[Cloud Scheduler](https://cloud.google.com/scheduler/pricing).

## F. Exclusividade de processamento e recuperação proposta

1. Vanderlei e o administrador de Vercel/Cloudflare identificam todas as agendas,
   endpoints, invocações manuais e requisições recentes; Leno identifica trabalho,
   leases e operações incertas. Não liberar transferência com inventário incompleto.
2. Na futura janela de transferência, o operador com acesso suspende o acionamento
   antigo, registra configuração/horário e impede chamadas manuais concorrentes.
   Pausar acionamento não equivale a desativar o receptor do webhook.
3. Confirmar término das execuções/HTTP em voo e ausência de leases ativos nos
   respectivos domínios. Um timeout do cliente pode deixar trabalho no servidor.
   `parallelism=1` limita tarefas de uma execução, não impede execuções de Jobs
   sobrepostas; impedir novo disparo enquanto houver execução ativa, além das
   proteções por lease/idempotência da aplicação. Essa garantia ainda precisa de ensaio.
4. Após aceite, coordenar destino/autenticação do webhook e flags com Leno,
   mantendo preservação de entregas. `PAYMENT_WORKER_ENABLED=false` também afeta
   recepção; não usá-lo como simples interruptor de agenda. Habilitar apenas o novo
   responsável pelo processamento, em etapa separada da observação.
5. Parar o ensaio se houver POST/processamento inesperado no modo observador,
   conta/loja divergente, sobreposição, erro persistente, alerta não entregue,
   custo/latência incompatíveis ou resultado financeiro incerto.
6. Recuperação: suspender novos disparos, confirmar o término do trabalho em voo,
   ler estado atual e preservar dados/comandos/IDs. Restaurar somente configuração,
   webhook e agendas ao snapshot acordado, sem dois executores ativos. Nesta
   baseline os processadores Cloud Run estão desligados; voltar ao anterior não
   autoriza ligar o Worker histórico. Para um ensaio só de observação, basta
   suspender sua agenda e preservar a aplicação.
7. Manter as revisões recuperáveis e o tráfego anterior. Não restaurar banco,
   apagar auditoria, limpar erros ou repetir cobranças/estornos para desfazer
   uma mudança de agendamento. Casos incertos permanecem com Leno para conciliação.

## Pendências com responsáveis

| Pendência | Responsável / próxima ação | Previsão |
|---|---|---|
| Acesso de Leno à candidata e casos elegíveis | Leno; operador da loja se faltar conta; iniciar consultas e registrar lacunas | Pode iniciar com conta autorizada; acesso individual não conferido |
| Inventário atual Vercel/Cloudflare e manuais | Administradores das contas + Leno, consolidação por Vanderlei | Antes da transferência; data a definir |
| Scheduler e IAM geral não conferidos | Administrador Google Cloud + Vanderlei; revisar APIs/política sem habilitação automática | Antes do provisionamento; data a definir |
| Canais, políticas, Jobs, contas e agenda | Vanderlei, após configuração revisada com Leno/operador | Preparação anterior à janela proposta |
| Plantão/substituto e recebimento real | Operador nomeia e confirma; Vanderlei verifica entrega | Antes e durante o ensaio |
| Inbox/outbox/revisão/estorno retido | Leno correlaciona por leitura e define próxima ação por caso | A definir; nenhuma reativação automática |
| Cadência, Neon e custo total | Vanderlei mede infraestrutura; Leno valida prazos; operador aprova orçamento | Ensaio assistido antes de recorrência |
| CI documental com falha de navegador | Vanderlei diagnostica executor e obtém execução completa | A definir; não bloqueia consultas à revisão aprovada |

Esta devolutiva não libera compras, transferência financeira ou G6. A parte A
está disponível para a conferência solicitada, enquanto as lacunas operacionais
da parte B permanecem identificadas.
