# Publicação de d63ad8a em homologação — 19/10/2026

Revisão publicada e acesso conferido, **sem promoção de tráfego**. Preparação
concluída por Vanderlei para a conferência conjunta de dashboard, fidelidade,
retorno físico e chargeback. Este registro não concede aceite dessas regras de
negócio nem autoriza processamento financeiro.

## Identidade publicada

- SHA: `d63ad8a1ab2d712153177155eae518d3eddcdc86`.
- Origem: merge do [PR #8](https://github.com/ViniMoia/Sistema-E-Commerce/pull/8)
  em `homologacao_teste`.
- Árvore idêntica a `d78fdaea03ab5ce96952a71b66914500a000a178`:
  `04572c84ac59ea06172c4fd47e005e426ce5db9e`.
- [CI do merge 39295357722](https://github.com/ViniMoia/Sistema-E-Commerce/actions/runs/39295357722):
  concluída com `success`, conferida antes de publicar.
- O HEAD local `e644b01` contém documentação posterior. A imagem foi construída
  explicitamente do `git archive` de **d63ad8a**, sem incorporar esse HEAD mutável.
- Projeto / região / serviço: `continental-511812` / `southamerica-east1` / `continental-hml`.
- Revisão: **`continental-hml-d63ad8a-review`**, Ready=True.
- URL: https://review-d63ad8a---continental-hml-jctvprygla-rj.a.run.app
- Repositório: `southamerica-east1-docker.pkg.dev/continental-511812/releases/store`.
- Digest do índice enviado:
  `sha256:d5892fb3962990dd779a492ab1a762dfdabbc63c522db7aa226589bad488788a`.
- **Digest Linux/amd64 resolvido no Cloud Run:**
  `sha256:ba883be27218190f2f5256134b586e891b853afdee9ff577053abbf66f25c455`.
- Revisão conferida às **19:13:45 UTC / 16:13:45 BRT**. Tráfego reconferido às
  **19:14:43 UTC / 16:14:43 BRT**.

O Docker Desktop foi iniciado; engine 29.8.2. Build Linux/amd64 standalone passou
com a configuração existente e lockfile, Node 22.23.3 e usuário `node`. A label
`org.opencontainers.image.revision` corresponde ao SHA publicado. O índice e o
manifesto da plataforma têm digests distintos, ambos registrados acima.

## Tráfego e configuração preservados

| Revisão | Percentual do serviço | Acesso por tag |
|---|---:|---|
| `continental-hml-896dc56-logout` | 100% | URL principal |
| `continental-hml-eff10bf-dashboard` | 0% | `dashboard-eff10bf`, preservada |
| `continental-hml-d63ad8a-review` | 0% | `review-d63ad8a`, nova |

Publicado com `--no-traffic`, digest fixado e alias exato do novo host para a loja
`3a82b33c-3646-4272-9a89-80bb1ba327a5`. Os aliases existentes, o domínio persistido
da Vercel e todas as demais variáveis/referências de segredo foram preservados.

```dotenv
APP_MAINTENANCE_MODE=false
CHECKOUT_PAUSED=true
PAYMENT_REMOTE_ENABLED=false
PAYMENT_WORKER_ENABLED=false
PAYMENT_EXPIRATION_ENABLED=false
PAYMENT_DEPLOYMENT_ENVIRONMENT=SANDBOX
ASAAS_ACCOUNT_SCOPE=sandbox-hml
```

Banco confirmado em consulta somente leitura: Neon,
`ep-blue-feather-b6l24gbu.c-2.sa-east-1.aws.neon.tech`, database `neondb`, loja
`continental-homologacao`. As 34 migrations estão aplicadas, incluindo
`20261016193000_order_reporting_exclusion`; nenhuma pendência, falha ou divergência
de checksum ao considerar LF/CRLF. A tabela de exclusão continua vazia. O diff
Git de `prisma` entre `eff10bf` e `d63ad8a` é vazio. Não foi executada migration,
classificação, reset ou alteração de dados comerciais nesta publicação.

As versões 1 de `continental-hml-database-url`, `continental-hml-direct-url` e
`continental-hml-asaas-api-key` foram comparadas em memória com a fonte privada
`.env.homologacao`: correspondem ao destino confirmado. Os bindings existentes
de `continental-hml-cron-secret` e `continental-hml-freight-quote-secret` também
foram preservados. Nenhum valor secreto foi publicado no registro.

## Webhook e acionadores

GET autenticado somente leitura no Sandbox confirmou um webhook habilitado,
não interrompido, em:
`continental-prototipo-git-homologacaoteste-vinimoias-projects.vercel.app/api/webhooks/asaas`.
Parâmetros de autorização não foram registrados. Nenhuma configuração ou entrega
foi alterada, nenhum consumidor foi chamado.

Listagem de Cloud Run Jobs vazia; API Cloud Scheduler ausente dos serviços
habilitados. O inventário de agendas antigas continua limitado pela API
desativada. Nenhuma API foi habilitada. Worker Cloudflare
`continental-pagamentos-hml`: informação anterior do operador permanece
`disabled`, sem Cron; não houve consulta nem execução do Worker nesta rodada.

## Acesso conferido

- URL de teste e principal: home, produtos, loja ativa e login retornam 200;
  Admin anônimo redireciona ao login. A loja ativa tem o ID esperado.
- **25 verificações autenticadas aprovadas**, com administrador temporário
  previamente autorizado: login pela API e formulário real, dashboard, produtos,
  pedidos, clientes, configurações, fidelidade e APIs administrativas.
- Cookies com HttpOnly, Secure e SameSite=Lax. Logout 303 com `Location: /`;
  sessão revogada rejeitada com 401. Conta temporária e sessões removidas;
  consulta posterior encontrou zero administradores sintéticos restantes.
- Home: 69 elementos de imagem, 22 carregados e nenhum quebrado observado.
  Imagens ainda em lazy loading não foram consideradas validadas.
- POST de checkout com corpo vazio retornou 503 `CHECKOUT_PAUSED`; nenhuma compra.
- Logs da candidata: janela de uma hora, limite 100; apenas o 503 esperado do
  teste de checkout, sem marcadores de falha de tenant/logout nessa consulta.

O acesso a `/admin/fidelidade` e à API de relatórios retornou 200. Isso comprova
acesso, não a correção dos valores. A conferência independente das regras de
dashboard/fidelidade, retorno físico e chargeback será feita com Leno, usando
baseline novo e os roteiros existentes. Não foram acionados retorno físico,
reconciliação, estorno, ajustes de pontos ou processamento de filas.

## Evidência e próxima ação

[V-CLOUDRUN-D63AD8A-2026-10-19.json](evidencias/V-CLOUDRUN-D63AD8A-2026-10-19.json)
contém a CI, referências de imagem/ambiente, tráfego e resultados sanitizados.
Detalhes locais em `artifacts/cloudrun-d63ad8a-20261019/`, ignorado pelo Git.

Usar a URL de teste acima para a conferência conjunta. Não presumir que a URL
principal já serve d63ad8a. A promoção permanece pendente; a revisão anterior
está preservada e atende 100%. Em falha da candidata, manter esse tráfego e
investigar, sem remover a migration aditiva ou restaurar o banco para trocar código.
