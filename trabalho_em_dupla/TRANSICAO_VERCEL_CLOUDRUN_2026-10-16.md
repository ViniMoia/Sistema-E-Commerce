# Transição Vercel / Cloud Run — 16/10/2026

O Cloud Run agora resolve a mesma loja de homologação sem substituir o domínio
da Vercel. Home e catálogo estão acessíveis; compras seguem pausadas. A validação
com contas temporárias de cliente/Admin foi concluída, inclusive no navegador
para o Admin. As contas e suas sessões foram removidas. Webhook e processamento
financeiro não foram transferidos.

- URL: https://continental-hml-15531616695.southamerica-east1.run.app
- URL alternativa: https://continental-hml-jctvprygla-rj.a.run.app
- Projeto/região: `continental-511812` / `southamerica-east1`.
- Revisão ativa: `continental-hml-896dc56-logout`, 100% do tráfego.
- Código: commit local `896dc564a6365bfbf2dd64fddb32b5a7aca8c951`, branch
  `homologacao_teste`. Não houve push nem deployment na Vercel nesta rodada.
- Imagem: `southamerica-east1-docker.pkg.dev/continental-511812/releases/store@sha256:742784f75af449390d077b5ec1f7f63fa0ca6156403127b2b76475d63ee48881`.

## Validação autenticada e correção do logout

Concluída em 16/10/2026, aproximadamente 19:04 UTC (16:04 BRT). O operador
autorizou explicitamente um administrador temporário após a conta inicialmente
informada não ser encontrada nesta loja. Foi criada uma identidade sintética
exclusiva da homologação, sem alterar contas existentes.

- Admin: 19 verificações aprovadas, incluindo login pelo formulário em navegador
  real; dashboard, produtos, pedidos, clientes e configurações; APIs de usuários,
  pedidos e frete; bloqueio após logout.
- Cliente: 11 verificações aprovadas, incluindo cadastro, login, perfil,
  bloqueio do Admin (403), checkout pausado (503) e rejeição de sessão revogada (401).
- Cookies com `HttpOnly`, `Secure` e `SameSite=Lax`. Contas temporárias e sessões
  removidas; consulta posterior encontrou zero contas sintéticas desta validação.
- Nenhuma compra, alteração de catálogo ou operação financeira executada.

O primeiro teste do Admin identificou logout com `Location: https://0.0.0.0:8080/`.
Corrigido em `app/api/auth/logout/route.ts` para `Location: /`, status 303 e
`Cache-Control: no-store`, preservando a origem pública sem confiar em headers
de host encaminhados. A revisão publicada passou no teste real de logout e
revogação. A correção tem quatro testes unitários; a execução conjunta com os
testes de aliases aprovou 27 testes em dois arquivos. Lint e build Linux standalone
com TypeScript aprovados. Os 840 testes citados adiante pertencem à etapa anterior,
não constituem uma nova execução completa após a correção do logout.

Consulta de logs da revisão atual (janela de uma hora, limite 50) encontrou
somente o HTTP 503 esperado do teste de checkout pausado; nenhum marcador de
erro de tenant ou logout foi encontrado nessa consulta.

Evidência desta etapa: [V-CLOUDRUN-AUTENTICACAO-2026-10-16.json](evidencias/V-CLOUDRUN-AUTENTICACAO-2026-10-16.json).

## Inventário da transição financeira

Consultas somente leitura confirmaram um webhook Sandbox habilitado, não
interrompido, ainda apontando para `/api/webhooks/asaas` na Vercel. Nenhuma
configuração foi alterada. Com a autorização de automação já configurada nesse
destino, home, API de produtos e supervisão financeira da Vercel retornaram 200.
Isso valida essas consultas, não o login de usuário nem o checkout completo na Vercel.
O valor dessa autorização não foi salvo nas evidências.

A supervisão do Cloud Run retornou 200 com escopo `sandbox-hml`: 30 eventos de
inbox concluídos, 22 comandos de outbox concluídos e um `DEAD_LETTER`, uma
operação de reembolso pendente e nenhuma lease ativa no instante consultado.
O pendente corresponde ao pedido #3, com `PAYMENT_REFUND_CANCELLED_REVIEW` e
`PAYMENT_REVIEW_REQUIRED`, já reservado à revisão de Leno. Nenhum replay foi feito.
Ausência de leases em um instante não comprova ausência de agendador.

O operador identificou o Worker Cloudflare `continental-pagamentos-hml`: a
execução conferida terminou como `disabled`, sem processamento financeiro, e a
configuração consultada não possui Cron atualmente. Essa informação foi recebida
do operador; o Cloudflare não foi consultado nem acionado nesta rodada. Manter
esse Worker desativado durante a transição.

A listagem global de Cloud Run Jobs no projeto `continental-511812` retornou
vazia. O Cloud Scheduler está com a API desativada; tanto a consulta de regiões
quanto a listagem de agendas em `southamerica-east1` foram recusadas com
`SERVICE_DISABLED`. A falha não deve ser registrada como lista vazia ou prova de
inexistência de agendas antigas. Nenhuma API foi habilitada para esse levantamento.

Service Usage confirmou `cloudscheduler.googleapis.com` como `DISABLED`.
A consulta de auditoria desse serviço, com janela solicitada de 400 dias e limite
de 100 registros, retornou vazia; a retenção dos logs limita essa evidência e ela
não substitui a listagem de agendas. A revisão ativa foi reconferida com
`CHECKOUT_PAUSED=true` e as três flags de processamento financeiro em `false`.

O inventário de Scheduler permanece inconclusivo até obter uma listagem válida;
o gate de ativação do consumidor segue aberto. Antes de eventual habilitação da
API, avaliar agendas preexistentes e a possibilidade de retomada de disparos,
mantendo os consumidores desativados. Não transferir webhook nem ativar
recorrência enquanto essa verificação e a coordenação com Leno estiverem pendentes.
O pedido #8 e seus prazos reais permanecem preservados.

A documentação alerta que reabilitar a API pode executar imediatamente agendas
que perderam disparos durante a desativação:
[comportamento de retomada do Scheduler](https://docs.cloud.google.com/scheduler/docs/configuring/cron-job-schedules).

Evidência do levantamento: [V-ACIONADORES-2026-10-16.json](evidencias/V-ACIONADORES-2026-10-16.json).
O escopo global de `gcloud run jobs list` está documentado na
[referência oficial](https://docs.cloud.google.com/sdk/gcloud/reference/run/jobs/list).

## Implementação e isolamento

`TENANT_HOST_ALIASES` mapeia somente os dois hosts acima ao ID da loja
`continental-homologacao`. Cada alias resolve pelo ID existente, sem fallback
para outro tenant. Hosts desconhecidos, sufixos semelhantes, curingas e
configuração inválida não autorizam acesso. Domínios cadastrados têm precedência
e cabeçalhos encaminhados não recebem confiança adicional.

Uma consulta posterior em transação somente leitura confirmou que o `customDomain`
da loja continua sendo o Preview da Vercel. Nenhum cadastro de domínio, schema,
migration, senha ou privilégio de usuário existente foi alterado. Links canônicos, inclusive
de recuperação de senha, continuam usando o domínio persistido da Vercel.

Foram adicionados três segredos, com versão 1 e acesso individual para a conta web:
`continental-hml-asaas-api-key`, `continental-hml-cron-secret` e
`continental-hml-freight-quote-secret`. Os dois bindings de banco existentes foram
preservados. A fonte exclusiva foi o arquivo privado `.env.homologacao`, que também
recebeu o mapeamento não secreto de hosts para futuras configurações.

Flags verificadas na revisão ativa:

```env
APP_MAINTENANCE_MODE=false
CHECKOUT_PAUSED=true
PAYMENT_DEPLOYMENT_ENVIRONMENT=SANDBOX
ASAAS_ACCOUNT_SCOPE=sandbox-hml
PAYMENT_REMOTE_ENABLED=false
PAYMENT_WORKER_ENABLED=false
PAYMENT_EXPIRATION_ENABLED=false
```

Nenhum Job ou Scheduler novo foi criado. `ASAAS_WEBHOOK_TOKEN` não foi vinculado
ao Cloud Run nesta etapa, e o destino remoto de webhook não foi alterado.

## Validação anterior — revisão de aliases `8c7f865`

| Verificação | Resultado |
|---|---|
| Unitários | 840 testes, 91 arquivos, aprovados; incluindo 23 casos novos de aliases |
| Lint dos arquivos de código alterados | Aprovado |
| Build Linux standalone / TypeScript | Aprovado, Node 22.23.3 |
| Home e API de produtos | HTTP 200 nos hosts do Cloud Run |
| Tela de login | HTTP 200; campo de senha renderizado |
| Login com conta inexistente | HTTP 401; credenciais rejeitadas |
| Admin sem sessão | Página redireciona ao login; API retorna 401 |
| Checkout e proposta de checkout | POST retorna 503 `CHECKOUT_PAUSED`, sem criação de compra |
| Capacidades de pagamento | HTTP 200, loja esperada, métodos remotos não habilitados |
| Webhook / consumidor Cloud Run | HTTP 503, não habilitados |
| Consulta Sandbox Asaas | GET `/v3/myAccount/status` retorna 200; estados cadastrais `APPROVED` |
| Domínio da Vercel no banco | Preservado, confirmado por consulta somente leitura |
| URL do Preview Vercel sem autenticação | HTTP 302 para proteção de acesso em `vercel.com` |
| Logs da nova revisão | Nenhum marcador de falha de tenant/inicialização Prisma na consulta realizada |

A consulta ao Asaas foi feita uma única vez a partir da máquina do operador, sem
criar cobrança. A chave consultada foi comparada, sem exposição, à versão vinculada
no Secret Manager. Isso comprova autenticação Sandbox e consistência do segredo;
não comprova emissão de pagamento nem todo o fluxo de rede a partir do Cloud Run.
Referência do endpoint: https://docs.asaas.com/reference/consultar-situacao-cadastral-da-conta

O navegador real percorreu home desktop (1440 px), home mobile (390 px) e login.
Sem erros de JavaScript, respostas HTTP de erro ou overflow horizontal observados.
Havia 69 elementos de imagem na home, com 23/29 carregados nas passagens desktop/mobile;
nenhuma imagem carregada foi identificada como quebrada. Elementos ainda em lazy
loading não foram tratados como imagens validadas. Login: 3 de 3 imagens carregadas.

Evidência sanitizada: [V-CLOUDRUN-TRANSICAO-2026-10-16.json](evidencias/V-CLOUDRUN-TRANSICAO-2026-10-16.json).
Capturas e detalhes locais em `artifacts/cloudrun-transition-20261016/`, ignorados
pelo Git. Os testes não acessaram nem alteraram a main ou seu banco.

## Pendências antes da transferência

1. Validar upload de imagens e entrega de e-mail após configuração de Storage e
   remetente de homologação, ainda ausentes na fonte. Imagens públicas existentes
   carregam sem exigir essas credenciais privilegiadas.
2. Concluir a listagem válida de Cloud Scheduler e, com Leno, coordenar
   agendas/leases/webhook. O Worker Cloudflare já foi identificado e deve permanecer
   desativado. Garantir um único
   acionador ativo durante a transferência. Não executar dois consumidores por
   conveniência nem abandonar eventos já recebidos.
3. Após transferência coordenada, habilitar capacidades Sandbox e compras de
   teste, validar efeitos financeiros/estoque/pontos, e só então encerrar a Vercel
   de homologação. Etapas 3/4 e gates financeiros permanecem abertos.

`SESSION_SECRET` não é utilizado pelo fluxo de sessão desta revisão: o código usa
identificadores aleatórios e sessões no banco. Sua ausência não deve ser apresentada
como impedimento comprovado de login. O teste positivo com conta foi aprovado nesta etapa.

## Recuperação desta alteração

A revisão `continental-hml-8c7f865-alias` é a referência anterior à correção de
logout: mantém aliases, mas reintroduz o redirecionamento interno no logout.
Rollback de tráfego não restaura transações financeiras nem requer restaurar banco.
A revisão mais antiga `continental-hml-00003-xhx` tem banco
configurado, mas não resolve a home pelo host Cloud Run. Retornar tráfego para ela
reverte o suporte aos aliases, não transações financeiras. Não alterar o domínio
Vercel nem restaurar banco para reverter esta mudança. Para contenção geral,
considerar as implicações operacionais de manutenção conforme o runbook existente.
