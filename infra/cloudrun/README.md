# Cloud Run — pacote de preparação do Vanderlei

Este pacote gera arquivos locais e não provisiona recursos. Produção exige G1–G8,
aceite de dados/financeiro de Leno e janela coordenada. O projeto selecionado no
gcloud não é considerado destino autorizado por este material.

## Construir e verificar localmente

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

Saídas: serviço web, dois Jobs, dois agendadores, políticas de invocação, métricas
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
débito. Boleto deixou de ser adiamento aceito; débito ainda depende de contrato e
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

Os Jobs não repetem automaticamente um POST incerto. Nova execução recupera
trabalho pelas filas/leases já implementadas. Nenhum comando de nova cobrança,
cancelamento ou estorno é inventado pelo acionador. Um timeout do cliente pode
coexistir com execução ainda em andamento; observar os leases antes de intervir.

Logs: `consumer_started`, `consumer_completed` e `consumer_failed`, com runId,
modo, escopo, duração e contagens permitidas. `idle` é fila sem trabalho observado;
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

Medir compute ativo do Neon, CU efetivos, pool/locks e consumo do Google Cloud.
Projeção mensal: CU médio ativo × horas ativas/dia × dias do período; usar cotas
vigentes da conta. Como cenário, 0,25 CU ativos 24h × 30 dias = 180 CU-hours.
Polling pode impedir suspensão. Sem consumo sustentável comprovado, G6/G8 ficam
abertos; não contratar plano nem declarar economia automaticamente.

## V-09 — aplicação futura, contenção e recuperação

1. Reunir pareceres, SHA, digest, configuração versionada e aceite G1–G8. Leno
   entrega inventário/carga aprovada, backup/restore e procedimento de migrations.
2. Confirmar projeto/billing/IAM/região, banco de produção separado, domínio/TLS,
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

WF-20 permanece aberto até implantação e observação reais. Este pacote é preparação.
