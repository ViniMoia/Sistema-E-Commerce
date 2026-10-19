# Cloud Run — pacote de preparação do Vanderlei

## Transição com Vercel e Cloud Run simultâneos

`TENANT_HOST_ALIASES` é uma variável somente do servidor: um objeto JSON de hosts
exatos para IDs de lojas existentes. Exemplo de formato:

```json
{"servico-exemplo.run.app":"00000000-0000-0000-0000-000000000001"}
```

Configure apenas os endereços efetivamente atribuídos ao serviço, com o ID da
mesma loja de homologação. Não usar curingas, URLs completas, portas ou um
fallback para qualquer `*.run.app`. Configuração ausente, inválida ou loja
inexistente não autoriza um host. Domínios já cadastrados têm precedência.
O resolver mantém a política existente de confiança em `X-Forwarded-Host`;
não habilitar proxy genérico para fazer o alias funcionar.

Esse mapeamento não altera `customDomain`, schema ou migrations. O domínio da
Vercel e a origem canônica de links continuam como estão durante a transição.
Sem essa variável na Vercel, seu comportamento permanece o existente. URLs
Cloud Run não autorizadas continuam sem acesso a uma loja.

Atualize somente as variáveis necessárias no serviço existente, preservando os
bindings de segredos. Valide catálogo, imagens, autenticação e Admin com
`CHECKOUT_PAUSED=true`. `PAYMENT_REMOTE_ENABLED`, `PAYMENT_WORKER_ENABLED` e
`PAYMENT_EXPIRATION_ENABLED` ficam desligados no Cloud Run enquanto Vercel mantém
o destino de webhook e o processamento. Não criar um segundo agendador ativo.
O fornecimento de uma chave Sandbox não é autorização para consumir filas.

Transferência posterior exige coordenação com Leno: inventariar agendas e
invocações em voo, pausar o acionamento anterior, observar leases, transferir o
webhook com reentrega preservada e habilitar somente o novo acionador. Só então
liberar compras de teste, validar efeitos e encerrar a Vercel de homologação.

Testes de aliases: `npx vitest run tests/unit/tenant-host-aliases.test.ts`.

Este pacote gera arquivos locais e não provisiona recursos. Produção exige G1–G8,
aceite de dados/financeiro de Leno e janela coordenada. O projeto selecionado no
gcloud não é considerado destino autorizado por este material.

Atualização de 15/10: o destino de dados é o banco existente da main, conforme
decisão do operador; separado da homologação, sem criar outra base por padrão.
Main e seu banco continuam somente leitura para o assistente. Procedimentos
consolidados: [implantação](../../diversos/AUDITORIAS/operations/operations/DEPLOYMENT-RUNBOOK.md)
e [recuperação](../../diversos/AUDITORIAS/operations/operations/BACKUP-RESTORE-RUNBOOK.md).
Ensaios de dados/compra passaram em clone; isso não provisiona recursos Cloud Run
nem comprova recuperação do backup por outra pessoa/máquina.

## Construir e verificar localmente

Antes de pedir parâmetros comerciais novamente, consultar a comparação de main na
seção 24 do replanejamento. A configuração da origem já define parcelamento até
12x, mínimo R$ 20, juros repassados de 2,99% a.m., boleto em um dia útil e piso
Asaas de R$ 5; os defaults atuais preservam essas decisões. Origem de frete,
prazo adicional, fidelidade e tabelas são dados da loja, não variáveis fictícias
do manifesto. Não copiar a URL do banco principal para o runtime de homologação.
O projeto/região/domínio de `config.example.json` continuam exemplos, pois não
foi encontrado manifesto Cloud Run efetivo na main auditada em 14/10/2026.

Use a versão de Node de `.nvmrc` e Docker Desktop em modo Linux:

```powershell
npm ci
npx prisma generate
npm run test:isolation:negative
npm run test:operations
docker build --build-arg RELEASE_SHA=<SHA-do-candidato> -t continental-vanderlei:candidate .
npm run test:container:isolated -- continental-vanderlei:candidate
```

O verificador cria PostgreSQL próprio em localhost, aplica as migrations existentes
somente nessa base, inicia duas instâncias da imagem, verifica sentinela, home,
assets, rejeição de cron anônimo, reinício e consumidor autenticado de filas vazias.
Nenhuma chave de Asaas/Resend é fornecida. Contêineres são removidos por identidade;
a imagem candidata permanece disponível para inspeção. Não usar `docker system prune`.

O Dockerfile faz instalação pelo lockfile e build standalone Linux. A imagem final
executa como `node` (UID 1000), inclui assets e o acionador, e não executa migrations.
O contexto Docker usa uma lista explícita de fontes: `.env`, credenciais, relatórios,
backups, Git e dependências do host não entram. Identifique a imagem por digest após
publicação autorizada; não promova uma tag mutável como evidência da release.

## Gerar os arquivos declarativos

Copie `config.example.json` para um arquivo local fora de Git, substituindo projeto,
número do projeto, região, domínio, digest da imagem, versões de segredos e canais
de notificação. São identificadores e referências, nunca valores secretos.

```powershell
npm run infra:render -- caminho/config.json artifacts/cloudrun-candidate
```

O destino precisa estar sem os arquivos gerados; o gerador usa criação exclusiva
para não sobrescrever evidências anteriores. O exemplo pode ser renderizado para
revisão, mas seus identificadores fictícios não são implantáveis.

Saídas: serviço web, três Jobs, três agendadores, políticas de invocação, métricas
de conclusão, alertas de ausência/falha e `readiness.json`. A sintaxe JSON é aceita
como YAML pelo fluxo de substituição declarativa do Cloud Run; métricas, alertas e
agendadores usam os respectivos corpos da API. Não há comando de aplicação automática.

## Autenticação, conta e segredos

- A loja tem páginas públicas. A política `web-invoker-policy.json` representa isso;
  ela não dispensa autenticação na aplicação. Cron/status exigem `CRON_SECRET`.
- O Scheduler usa uma service account própria e OAuth para chamar a API `jobs:run`.
  Somente essa conta recebe `roles/run.invoker` nos Jobs. Não conceder `allUsers`
  aos Jobs. Políticas fornecidas são propostas de bindings; preserve membros
  preexistentes ao aplicá-las, sem substituir cegamente a política IAM completa.
- A conta `consumer` recebe acesso somente ao segredo do cron. Ela não recebe
  conexão direta ao banco, credencial de gateway ou credencial de e-mail.
- A conta `web` recebe `secretAccessor` apenas nos segredos necessários ao serviço.
  Não criar/exportar arquivos de chave de service account.
- Segredos usam o prefixo do serviço, nome da variável em minúsculas e hífens.
  Exemplo: `continental-hml-cron-secret`. O manifesto fixa uma versão numérica.
- O acionador exige `CRON_SECRET` com ao menos 32 caracteres, igual ao do serviço,
  origem HTTPS sem caminho e `ASAAS_ACCOUNT_SCOPE` idêntico ao contrato de status.
- `DATABASE_URL` deve usar o endpoint/pool aprovado do ambiente; dimensionar
  `connection_limit` e timeout em conjunto com as duas instâncias e os consumidores.
  `DIRECT_URL` é separado. Não executar migrations na inicialização de instâncias.
- `SUPABASE_URL` é a configuração de Storage no servidor. O código mantém o fallback
  legado `NEXT_PUBLIC_SUPABASE_URL`, sem exigir chave privilegiada em build.
- Conferir `EMAIL_FROM`, domínio Resend, destinatários, buckets e permissões no
  ambiente separado. Ativação de upload permanece uma decisão de capacidade.

As capacidades financeiras dos manifestos começam desativadas. Após aceite, Leno
conduz configuração de métodos/lojas e Vanderlei aplica a configuração de runtime
acordada, com conta/escopo corretos e política de juros já definida. A seção 17 do
replanejamento de 13/10 ampliou os requisitos para PIX, crédito até 12x, boleto e
débito. Em 15/10 o operador aceitou concluir o teste de expiração do boleto depois
da abertura, se necessário; a pendência permanece explícita, sem aprovação fictícia.
Débito ainda depende de contrato e
implementação financeira de Leno. O manifesto não inventa uma capacidade de débito
nem ativa métodos sem homologação. PIX manual não substitui esses requisitos.
Manifesto gerado não comprova ativação ou aceite de nenhum método.

Referências: [Scheduler para Jobs](https://docs.cloud.google.com/run/docs/execute/jobs-on-schedule),
[segredos de serviços](https://docs.cloud.google.com/run/docs/configuring/services/secrets),
[segredos de Jobs](https://docs.cloud.google.com/run/docs/configuring/jobs/secrets).

## Host, domínio e isolamento

Homologação usa `NODE_ENV=production` e `PAYMENT_DEPLOYMENT_ENVIRONMENT=SANDBOX`;
produção usa `PRODUCTION`. Não simular variáveis Vercel. Banco, escopo, storage e
segredos precisam ser distintos. Dados de teste não se tornam vendas reais.

`TRUSTED_PROXY_PROVIDER` fica vazio: cabeçalhos `X-Forwarded-Host` arbitrários não
escolhem tenant. Cadastrar o domínio canônico aprovado na loja e conferir o Host
real recebido no caminho final. Não habilitar `generic` como atalho. Se houver load
balancer, documentar e testar quais cabeçalhos ele sobrescreve antes de confiar neles.
Domínio não cadastrado deve falhar fechado. Validar TLS, cookies Secure/HttpOnly,
reset, redirecionamentos e links de e-mail no domínio final.

## Execução e observabilidade

O acionador verifica o contrato de status e o escopo da conta antes de qualquer
POST. Pagamentos usam `/api/cron/payments?limit=5`, no máximo cinco lotes por
execução; a API atual inclui inbox, conciliação, expiração de pedidos e outbox/email.
Pontos usam `/api/cron/loyalty-expiration` em Job separado. Não incluir novamente o
cron legado de expiração de pedidos, evitando um segundo agendamento do mesmo ciclo.

**Preparação G6 em 19/10 (ainda não implantada):** `CONSUMER_MODE=supervision`
executa somente um GET autenticado de `/api/cron/payments/status`. Não chama o
processamento, expira pontos/pedidos, envia e-mail ou reabre trabalho. Usa a mesma
imagem/conta consumer e referência de CRON_SECRET; não recebe conexão de banco.
O segredo compartilhado ainda permite chamar outros endpoints de cron: o modo é
um contrato do programa, não uma credencial com permissão exclusiva de leitura.
Não executar um Job configurado como `payments` esperando esse comportamento.

O status preserva `schemaVersion=1` e acrescenta `supervision.schemaVersion=1`.
Sua leitura usa transação REPEATABLE READ / READ ONLY, com contagens por instalação
e sem payloads, IDs de compradores ou documentos. A conta configurada identifica
a instalação; dados Asaas vinculados a outra conta (inclusive sem vínculo) geram
atenção explícita e não são silenciosamente descartados. Não é relatório por loja
nem comprovação de que a conexão de banco pertence ao ambiente pretendido.

| Sinal nos logs `attentionReasons` | Encaminhamento do operador |
|---|---|
| PAYMENT_UNCERTAIN / PAYMENT_OVERDUE | Conferir tentativa e evidência atual; não repetir um POST incerto. |
| PAYMENT_REVIEW / CHARGEBACK_REVIEW / PHYSICAL_RETURN_REVIEW | Abrir/acompanhar o caso de atendimento e separar resultado financeiro de mercadoria. |
| OPERATION_HELD | Conferir estorno/operação retida, sem limpar erro ou rearmar a fila. |
| EMAIL_REVIEW / EMAIL_DELAY | Conferir entrega e janela de idempotência; evitar reenvio cego. |
| INBOX_DELAY / OUTBOX_DELAY / RECONCILIATION_DELAY / EXPIRED_LEASES | Conferir execução, backlog e leases; não habilitar consumidores concorrentes por inferência. |
| STORED_ACCOUNT_MISMATCH / UNTRACKED_LEGACY | Conferir configuração/proveniência e obrigações históricas, sem copiar ou apagar registros. |
| SUPERVISION_UNAVAILABLE | O servidor ainda não fornece a extensão de supervisão; não declarar saúde completa. |

Os campos antigos permanecem para os clientes existentes. O novo consumidor
sinaliza cobertura incompleta em servidor antigo; extensão malformada falha com
erro sanitizado. `idle` no modo supervision significa ausência dos sinais de
atenção observados naquele snapshot, não prova de fila vazia, entrega de alerta
ou execução financeira saudável. O resultado inclui `processingAttempted=false`.

Os Jobs não repetem automaticamente um POST incerto. Nova execução recupera
trabalho pelas filas/leases já implementadas. Nenhum comando de nova cobrança,
cancelamento ou estorno é inventado pelo acionador. Um timeout do cliente pode
coexistir com execução ainda em andamento; observar os leases antes de intervir.

Logs: `consumer_started`, `consumer_completed` e `consumer_failed`, com runId,
modo, escopo, duração e contagens permitidas. `idle` indica ausência de progresso
e dos sinais de atenção naquele snapshot, conforme o modo;
`progress` registra conclusões; `attention` sinaliza retry, revisão, atraso ou falta
de progresso. Nenhum corpo bruto de resposta, instrumento de cartão ou segredo é
registrado. HTTP 200 sozinho não comprova progresso financeiro.

Os agendamentos propostos para medição são pagamento a cada minuto e pontos uma vez
por hora. **Não estão aprovados para Neon Free nem para os prazos financeiros.**
`parallelism=1` limita tarefas de uma execução, não execuções simultâneas de Jobs.
Ensaiar sobreposição/recuperação e medir chegada, duração, backlog, conexões e locks
antes de criar agendamentos ativos. Ajustes de cadência exigem revisão de Leno;
não abandonar obrigações durante a madrugada.

Alertas preparados: falta de conclusão por 10 minutos (pagamentos) ou 2 horas
(pontos), e logs de falha/atenção. Esses limites são parâmetros iniciais, não SLA
financeiro aprovado. Após provisionamento, provocar falha controlada e ausência
de execução, confirmar recebimento no canal nominal e registrar atendimento.
Alertas por ausência de métrica requerem que a série tenha sido inicialmente emitida.

O gerador acrescenta Job, agenda, heartbeat e alerta de atenção para `supervision`,
com filtros de projeto/região/Job. A proposta de intervalo é um minuto e a ausência
de conclusão é de dez minutos, sujeitos à mesma medição de custo/cadência dos
consumidores. A consulta agrega diversas tabelas: medir latência, volume e compute
do banco antes de criar recorrência. O gerador não implanta ou ativa os recursos.

As políticas por log mantêm intervalo mínimo de 300 segundos entre notificações e
autoClose de 86400 segundos. O programa emite observações em cada rodada; não envia
mensagem de atendimento por rodada. Limite de notificação é aplicado pelo Monitoring
e deve ser comprovado no canal real. **Fechamento automático do incidente não encerra
o caso financeiro** nem comprova atendimento. Referências oficiais:
[configuração de notificações](https://docs.cloud.google.com/logging/docs/alerting/log-based-alerts)
e [ciclo do incidente](https://docs.cloud.google.com/monitoring/alerts/log-based-incidents).

O filtro inclui `severity>=ERROR` no LogEntry, além do campo JSON e do resultado
`attention`: o Cloud Run pode retirar campos especiais do JSON ao ingerir logs
estruturados. Conferir os registros efetivamente ingeridos durante o aceite;
teste local do manifesto não comprova entrega. Referência:
[logs estruturados no Cloud Run](https://docs.cloud.google.com/run/docs/logging).

### Aceite operacional G6 — responsabilidade conjunta

1. Vanderlei identifica políticas/canais já existentes e compara os manifestos;
   não criar políticas duplicadas ou reaplicar o serviço web para acrescentar alertas.
   Registrar destinatário nominal, substituto, referências de canal/política e revisão.
2. Leno define caso controlado e baseline de homologação. Primeiro executar uma
   observação supervision e conferir que só houve GET. Não usar #3/#4/#5/#6/#7/#8
   como mutações novas para provocar incidente, nem operar na base principal.
3. Demonstrar sinal de atenção, entrega real ao destinatário e atribuição do caso.
   Registrar incidente, horários, responsável, próxima ação e prazo. Repetição deve
   preservar os dados e respeitar o intervalo de notificações configurado.
4. Demonstrar falha do observador e ausência de execução após emitir a primeira
   série. Um observador saudável não prova que o Job de pagamentos funciona: manter
   seus heartbeats independentes. Fechar o caso apenas com evidência do domínio.
5. Após resolver o caso controlado, observar redução dos sinais; conferir separadamente
   comportamento do incidente de monitoramento. Atraso de ingestão e autoClose não
   autorizam declarar obrigação encerrada. Registrar recuperação e pendências.

Até executar essa rodada no destino, ficam pendentes destinatário/canal efetivos,
alerta recebido, atendimento, recorrência sustentável e aceite G6. Nenhum ensaio
isolado confirma esses itens e nenhuma notificação real foi enviada pelo desenvolvimento.

Medir compute ativo do Neon, CU efetivos, pool/locks e consumo do Google Cloud.
Projeção mensal: CU médio ativo × horas ativas/dia × dias do período; usar cotas
vigentes da conta. Como cenário, 0,25 CU ativos 24h × 30 dias = 180 CU-hours.
Polling pode impedir suspensão. Sem consumo sustentável comprovado, G6/G8 ficam
abertos; não contratar plano nem declarar economia automaticamente.

## V-09 — aplicação futura, contenção e recuperação

1. Reunir pareceres, SHA, digest, configuração versionada e aceite G1–G8. Leno
   entrega inventário/carga aprovada, backup/restore e procedimento de migrations.
2. Confirmar projeto/billing/IAM/região, banco existente da main como destino de
   produção (separado da homologação), domínio/TLS,
   contas de integração, storage, segredos e destinatários de alertas.
3. Aplicar migrations na janela controlada de Leno. Publicar a mesma imagem
   validada, confirmar domínio e testar configuração antes de habilitar métodos.
4. Publicar Jobs/IAM/alertas; criar agendamentos ativos somente quando cadência,
   custo e prazos estiverem aceitos. Testar invocação legítima e recusa de anônimo.
5. Leno acompanha compras controladas, devoluções e efeitos; Vanderlei acompanha
   runtime, entrega de e-mail, progresso e alertas. Abrir vendas somente após prova.
6. Em incidente, conter novas compras afetadas pelo controle aprovado com Leno.
   Preservar webhook, recuperação, IDs e fatos de operações abertas. Desligar
   `PAYMENT_WORKER_ENABLED` não é contenção universal segura.
7. Rollback de imagem não reverte transações no gateway. Não restaurar banco nem
   rearmar operações financeiras por conveniência; conciliar com Leno e registrar
   revisão implantada, ação, resultado e critérios de retomada.

O gerador agora prepara o serviço com `CHECKOUT_PAUSED=true`: pausa novas propostas
e conclusões, incluindo pagamento manual. Antes da janela, comprovar a flag em
todas as revisões que recebem tráfego e drenar requisições em voo. Não reaplicar o
manifesto inicial sobre serviço ativo para fazer somente a pausa: ele também traz
flags financeiras desligadas. Preservar as flags efetivas de webhook/consumidores.
Recuperação permanece por GET; replay por POST fica bloqueado. Para abrir vendas,
definir `CHECKOUT_PAUSED=false` após as verificações, sem dispensar outras flags.
A validação no ingresso real ainda está pendente; mapear também escritores antigos,
Admin e importadores. Durante o trecho exclusivo de
DDL, webhook também é writer: coordenar retenção/reentrega comprovada, sem
responder sucesso a evento não persistido. Não presumir rollback seguro para
writers da main antiga. A imagem standalone não é um job de migration; separar
o executor com Prisma CLI e dependências da revisão congelada.

WF-20 permanece aberto até implantação e observação reais. Este pacote é preparação.

### Manutenção completa durante o trecho exclusivo do banco

O gerador inclui `APP_MAINTENANCE_MODE=false`. A pausa inicial de checkout permite
receber/processar obrigações existentes conforme as demais flags. Já
`APP_MAINTENANCE_MODE=true` retorna 503 em páginas, APIs, Admin, cron e webhook,
e bloqueia consultas no cliente Prisma da aplicação. Não ativar durante drenagem.
Valor configurado diferente de `false` também fecha; ausência mantém operação normal.

Antes de usar esse modo, comprovar retenção/reentrega, parar agendas/importadores,
cobrir revisões antigas e aguardar transações. Ele não controla clientes SQL
independentes nem congela globalmente o banco. Retomar com manutenção `false` e
checkout ainda pausado, reconciliar eventos e só então abrir vendas. Procedimento
e inventário: `diversos/AUDITORIAS/operations/operations/DEPLOYMENT-RUNBOOK.md`.
Ensaio local: `npm run test:maintenance:isolated`; ativação no Cloud Run não realizada.
