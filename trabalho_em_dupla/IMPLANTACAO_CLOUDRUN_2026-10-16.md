# Primeira publicação no Cloud Run — 16/10/2026

> **Estado posterior:** a revisão ativa é `continental-hml-896dc56-logout`.
> Home e catálogo passaram a retornar 200 por aliases explícitos, preservando
> o domínio Vercel e o checkout pausado. Login/Admin e logout foram validados;
> o consumidor financeiro segue desativado. Consulte o relatório atualizado:
> [Transição Vercel / Cloud Run](TRANSICAO_VERCEL_CLOUDRUN_2026-10-16.md).
> As seções abaixo registram as etapas anteriores de preparação e conexão.

## Estado mais recente: conexão de homologação publicada

**Fonte local padronizada:** foi criado `.env.homologacao` (privado e ignorado pelo
Git), derivado exclusivamente de `env.homologacao`, conforme orientação posterior
do operador. Esse arquivo substitui as fontes de conexão anteriores para futuras
configurações da homologação. Contém os nomes esperados pela aplicação, ambiente
financeiro `SANDBOX` e escopo `sandbox-hml`. A validação local do contrato de
configuração Asaas passou, sem chamada ao gateway. Conexões da mesma base e SSL
foram conferidos. Não houve nova alteração no Cloud Run ao criar esse arquivo.
Permanecem ausentes na fonte: `SESSION_SECRET`, remetente `EMAIL_FROM` e Storage;
foram registrados como pendências, sem copiar valores de outros ambientes. O
arquivo não é carregado automaticamente: valores precisam ser cadastrados em
segredos e vinculados ao container. Não compartilhar por Git ou chat público.

Após indicação explícita do operador, somente `env.homologacao` foi usado como
fonte das conexões. `DATABASE_URL_UNPOOLED` foi mapeado para `DATABASE_URL` e
`DIRECT_DATABASE_KEY` para `DIRECT_URL`. São conexões diretas Neon para a mesma
base; nenhuma conexão pooled foi inventada. Uma transação somente leitura
confirmou acesso e a loja `continental-homologacao` antes da publicação.

Foram criadas as versões **1** dos segredos `continental-hml-database-url` e
`continental-hml-direct-url`, vinculadas às respectivas variáveis do container.
A revisão ativa passou a ser **`continental-hml-00003-xhx`**, com 100% do tráfego.
A inicialização e a consulta HTTP comprovaram o acesso efetivo aos segredos pela
conta do serviço. Mantidos `APP_MAINTENANCE_MODE=false`, `CHECKOUT_PAUSED=true`
e pagamentos/worker/expiração desligados. Sem migrations ou alterações no schema.

Validação real: `GET /api/loja/continental-homologacao` retornou **200** com o slug
esperado. Home e `/api/products` continuam **404** porque o cadastro da loja tem
como `customDomain` o Preview
`continental-prototipo-git-homologacaoteste-vinimoias-projects.vercel.app`, não o
host do Cloud Run. Não foi alterado esse cadastro nem habilitado fallback de
tenant. Ainda falta resolver o vínculo do domínio antes do aceite funcional.

O arquivo privado `env.homologacao` foi adicionado ao `.gitignore`. As demais
credenciais presentes nele não foram publicadas nesta etapa. Não foram encontrados
os marcadores de erro de tenant/Prisma na consulta de logs da nova revisão feita
após as sondas; isso não substitui observação contínua.

Evidência sanitizada: [V-CLOUDRUN-DATABASE-2026-10-16.json](evidencias/V-CLOUDRUN-DATABASE-2026-10-16.json).

## Histórico das etapas anteriores

> **Atualização posterior, por solicitação do operador:** a revisão ativa agora é
> `continental-hml-00002-d6f`, com `APP_MAINTENANCE_MODE=false` e
> `CHECKOUT_PAUSED=true`. Somente essas duas variáveis foram atualizadas diretamente
> no Cloud Run, preservando imagem e demais configurações. A revisão continua sem
> `DATABASE_URL` e `SESSION_SECRET`. Sondas HTTPS após a atualização: `/login` 200,
> `/` 404 e `/api/products` 404, sem resposta de manutenção. A loja ainda não está
> pronta para homologação funcional; faltam banco isolado, segredos e configuração
> do tenant/Host. O conteúdo abaixo e a evidência JSON registram a publicação
> inicial em manutenção e não descrevem o estado atual dessas duas flags.

> **Preparação dos segredos, ainda sem conexão:** foram criados no projeto
> `continental-511812` os segredos `continental-hml-database-url` e
> `continental-hml-direct-url`. A conta
> `continental-hml-web@continental-511812.iam.gserviceaccount.com` recebeu
> `roles/secretmanager.secretAccessor` individualmente nos dois recursos; os
> bindings foram conferidos. Ambos estão sem versões. Não foram vinculados ao
> container nem houve nova revisão nesta etapa. A conexão isolada de homologação
> ainda precisa ser fornecida: nova comparação dos arquivos `env` e `env.local`
> confirmou o mesmo host normalizado e nome de banco. Nenhuma credencial do banco
> principal foi copiada para o Secret Manager. Após receber as conexões corretas,
> criar versões, fixar os respectivos números em `DATABASE_URL`/`DIRECT_URL` e
> preservar manutenção `false` e checkout pausado `true`. Não executar migrations
> para resolver a ausência dessas variáveis. O acesso efetivo ao conteúdo de uma
> versão só poderá ser comprovado quando ela existir.

O serviço foi publicado e responde por HTTPS em **modo de manutenção**.
A loja ainda não está disponível para homologação funcional. Os HTTP 503 abaixo
são o bloqueio esperado da aplicação, não um aceite de compra ou disponibilidade.

## Destino e revisão

- Projeto: `continental-511812` (número `15531616695`), faturamento confirmado ativo.
- Região: `southamerica-east1` (São Paulo).
- Serviço: `continental-hml`.
- URL: https://continental-hml-15531616695.southamerica-east1.run.app
- Revisão: `continental-hml-17366e8-maint`, recebendo 100% do tráfego.
- Código: `homologacao_teste`, commit `17366e8b5c2a44bd2c0157a159a371886b3126d1`.
- Imagem: `southamerica-east1-docker.pkg.dev/continental-511812/releases/store@sha256:239091138f051f45de3274ea38a8e8efb057b2385391ca545ed85b3100ab9fa5`.
- Conta de execução: `continental-hml-web@continental-511812.iam.gserviceaccount.com`.
- CPU: 1; memória: 1 GiB; concorrência: 20; timeout: 60 s.
- Escala mínima: 0; máxima: 1, no serviço e na revisão. CPU limitada fora de requisições.

Os limites reduzem consumo, mas não constituem teto financeiro nem garantia de
gratuidade. O operador informou finalidade de teste, sem valor mensal definido.
Nenhum orçamento ou alerta financeiro foi configurado nesta publicação.

## Isolamento aplicado

O operador identificou `env` como principal e `env.local` como homologação.
A inspeção local das conexões encontrou o mesmo host normalizado (desconsiderando
`-pooler`) e nome de banco nos dois arquivos, inclusive nas conexões diretas.
Não foi aberta conexão com esses bancos nem executada migration.

Por isso, a revisão não recebeu `DATABASE_URL`, `DIRECT_URL` ou credenciais de
Asaas, Resend e Storage. O modo `APP_MAINTENANCE_MODE=true` bloqueia páginas,
APIs, Admin, webhook e cron antes dos handlers. `CHECKOUT_PAUSED=true` e as três
flags financeiras permanecem desligadas. A declaração de ambiente é `SANDBOX`.
A conta de execução foi criada sem atribuir papéis de acesso a dados/segredos.

O serviço aceita acesso público à página de manutenção. Nenhum Scheduler ou Job
foi criado. Nenhuma operação financeira externa foi executada. Os arquivos locais
`env` e `env.local` foram adicionados ao `.gitignore`; a lista permitida do
`.dockerignore` exclui ambos e os arquivos `.env*` da imagem.

Configuração não secreta aplicada:
[`homologacao-maintenance.env.json`](../infra/cloudrun/homologacao-maintenance.env.json).
Não desligar a manutenção antes de configurar o banco isolado, segredos e tenant.
Esse arquivo é específico da publicação inicial e não deve substituir a
configuração de um serviço que já tenha sido liberado.

## Verificações realizadas

- Build Docker `linux/amd64`, Node 22.23.3, Next standalone, TypeScript aprovado.
- 43 testes de manutenção/pausa passaram em dois arquivos de testes unitários.
- Imagem local executando com UID 1000, sem arquivos de credenciais e sem variáveis
  de banco ou chave do Asaas.
- Seis sondas locais e as mesmas seis no endereço HTTPS real: GET `/`, GET `/admin`,
  GET `/api/products`, POST `/api/checkout`, POST `/api/webhooks/asaas` e
  POST `/api/cron/payments`. Todos retornaram 503 com conteúdo de manutenção.
- Respostas remotas com `Cache-Control: private, no-store`.
- Cloud Run informou `Ready=True` para a revisão publicada.

Evidência: [`V-CLOUDRUN-2026-10-16.json`](evidencias/V-CLOUDRUN-2026-10-16.json).
Esta rodada não executou novamente toda a regressão de compra, capacidade ou
recuperação. O teste de manutenção não substitui esses aceites.

## Próxima liberação

1. Obter conexão de homologação comprovadamente separada do banco principal.
2. Coordenar com Leno schema, migrations e dados de homologação nesse destino.
3. Configurar segredos de runtime no Secret Manager e cadastrar o Host efetivo
   da URL `run.app` na loja de homologação, sem reutilizar identidades de produção.
4. Publicar configuração com checkout pausado, liberar páginas após validar
   isolamento e executar os testes funcionais no ambiente real.
5. Para pagamentos, fornecer credenciais Sandbox e validar as capacidades antes
   de habilitá-las. Configurar Jobs/agendas somente com cadência e custo aprovados.
6. Configurar canal e alertas para o e-mail informado pelo operador; comprovar
   recebimento. V-06 foi iniciado; V-07/V-08/V-09 e gates externos não estão aprovados.

Para conter esta revisão, manter `APP_MAINTENANCE_MODE=true`. Esta é a primeira
revisão do serviço: não existe revisão anterior funcional para rollback. Uma
eventual remoção deve atingir somente `continental-hml` no projeto/região acima;
não remover o projeto, repositório de imagens ou dados de outros ambientes.
