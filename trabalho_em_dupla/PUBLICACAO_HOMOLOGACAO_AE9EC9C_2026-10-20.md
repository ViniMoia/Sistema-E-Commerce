# Publicação e devolutiva de Vanderlei — 20/10/2026

**Estado às 14:30 BRT / 17:30 UTC:** candidata pronta para conferência, com
**0% de tráfego**, checkout pausado e controles financeiros desligados.
Atende à publicação do PR #10 e à retirada das tarefas de Storage da seção 70
do direcionamento. Não encerra os aceites de negócio, imagens ou operação G6.

## A. Candidata disponível

| Informação | Evidência |
|---|---|
| Projeto / região | `continental-511812` / `southamerica-east1` |
| SHA publicado | `ae9ec9c62b80d927ea9a59de626c62b1e1ca3f60` |
| PR #10 integrado | Merge `dfcb3b7d4e8e5bdbec64319d6a96ed858b9eba9e`; diferença até o SHA publicado é somente o documento de direcionamento |
| CI do SHA publicado | [39462623396 — sucesso](https://github.com/ViniMoia/Sistema-E-Commerce/actions/runs/39462623396), concluída às 17:23:32 UTC |
| Imagem | `southamerica-east1-docker.pkg.dev/continental-511812/releases/store` |
| Digest do índice enviado ao registro | `sha256:d15b9cc7f1ee450df2c5d1e49ad8dc44f453cf6c45601e7d7bdece2c343b8f69` |
| Digest Linux/amd64 resolvido pelo Cloud Run | `sha256:0165e678e299c6f6fc6169ca675fa9f6f42f7bc11c5840bbf9803944759788b0` |
| Revisão | `continental-hml-ae9ec9c-review`, `Ready=True` |
| URL de teste | https://review-ae9ec9c---continental-hml-jctvprygla-rj.a.run.app |
| Tráfego principal | `continental-hml-896dc56-logout`: **100%** |
| Demais revisões | `ae9ec9c-review`, `17fd1a7-review`, `d63ad8a-review` e `eff10bf-dashboard`: **0%**, tags anteriores preservadas |

Houve mudança após a publicação de `17fd1a7`: esta candidata incorpora o PR #10
(WhatsApp ausente no Admin e cartões mobile de produtos/pedidos/clientes),
além da correção de e-mail e do harness de `450a807`. A imagem foi construída
de um `git archive` do SHA aprovado, sem arquivos privados ou alterações locais.
Os ajustes do gerador/documentação feitos nesta devolutiva são posteriores e
não são apresentados como parte dessa imagem.

A URL de teste responde sem autenticação Google/IAM. O Admin exige uma conta
administrativa da loja de homologação. A conta sintética usada no ensaio foi
removida; o acesso individual de Leno depende de sua conta autorizada e não foi
conferido. Nenhuma credencial foi incluída nesta devolutiva.

Configuração efetiva preservada:

```text
APP_MAINTENANCE_MODE=false
CHECKOUT_PAUSED=true
PAYMENT_REMOTE_ENABLED=false
PAYMENT_WORKER_ENABLED=false
PAYMENT_EXPIRATION_ENABLED=false
PAYMENT_DEPLOYMENT_ENVIRONMENT=SANDBOX
ASAAS_ACCOUNT_SCOPE=sandbox-hml
```

Foi acrescentado somente o host exato da nova tag ao mapa de aliases da mesma
loja. Referências de segredos, conta de serviço, aliases antigos e distribuição
de tráfego foram comparados antes/depois. Domínio Vercel, webhook e acionadores
não foram alterados.

## Banco e verificações

Conexões privadas de `.env.homologacao` comparadas em memória com as versões
efetivamente vinculadas à revisão, sem divulgar os valores. Destino: Neon,
host `ep-blue-feather-b6l24gbu.c-2.sa-east-1.aws.neon.tech`, banco `neondb`,
loja `continental-homologacao`. `DATABASE_URL` e `DIRECT_URL` continuam
vinculadas aos segredos `continental-hml-database-url:1` e
`continental-hml-direct-url:1`.

Pré-check somente leitura: **34 migrations aplicadas, nenhuma pendente,
falha ou divergência de checksum**. Não houve migration nesta publicação.
Main e seu banco não foram alterados.

- Catálogo, página de login, API de produtos e resolução da loja responderam
  HTTP 200 tanto na candidata quanto na URL principal. Admin anônimo redirecionou
  para login. Checkout vazio foi recusado com HTTP 503 / `CHECKOUT_PAUSED`.
- Login administrativo, cookie Secure/HttpOnly/SameSite, seis páginas Admin e
  quatro APIs administrativas passaram. Logout retornou ao caminho relativo `/`;
  sessões revogadas e chamadas anônimas foram recusadas com HTTP 401.
- Navegador real com emulação de 320/390 px: cartões de produtos, clientes e
  pedidos sem transbordamento horizontal; controles conferidos com pelo menos
  44 × 44 px e alcançáveis por toque.
- Produtos: diálogo mostrou o produto selecionado, foi **cancelado** e o editor
  correto abriu. Clientes: perfil correto abriu/fechou. Pedidos: detalhes do
  pedido selecionado carregaram. Nenhum produto/pedido foi alterado.
- WhatsApp ausente nas seis rotas administrativas visitadas nas duas larguras.
  Menu do dashboard e fidelidade abriu/fechou, separado do conteúdo.
- Guarda de rede bloqueava mutações de negócio durante a coleta dos cartões;
  nenhuma foi solicitada. Escritas limitadas às contas/sessões sintéticas
  explicitamente autorizadas. Consulta independente final encontrou **zero**
  contas temporárias e zero perfis locais de navegador remanescentes.
- Na home, 22 de 69 elementos de imagem estavam carregados e nenhum carregado
  apresentou erro naquele instante. As imagens ainda não carregadas/lazy e
  todos os detalhes do catálogo **não** foram auditados por essa amostra.

A primeira tentativa do teste parou ao conferir o título do pedido antes do
fim da consulta. O teste passou a aguardar o título carregado, como a regressão
isolada existente; a segunda rodada passou integralmente. Contas e perfis
foram descartados em ambas. Não foi necessária mudança na aplicação.

CI integral do SHA publicado aprovada, incluindo tipagem, lint, unitários,
integração, build, duas instâncias, standalone, capacidade e contêiner Linux.
Para o ajuste posterior do gerador: **27 testes de ferramentas aprovados** e
lint dos arquivos alterados sem erros. Testes isolados não aprovam os gates
financeiros ou operacionais externos.

## B. Política de imagens da seção 70

**Recebida e aplicada ao planejamento de infraestrutura.** Retiradas as tarefas
de provisionar buckets, cadastrar credenciais de Storage e habilitar upload.
O gerador deixou de exigir `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`.
README, exemplo de ambiente e listas de pendências foram atualizados.

Na configuração da candidata não há bindings dessas variáveis de Storage.
Não foram criados nem apagados buckets/segredos. A existência de recursos
desvinculados em outras contas não foi conferida.

Dependência entregue para Leno: `app/api/upload/route.ts` ainda contém o caminho
condicional de upload, condicionado a `ENABLE_DIRECT_UPLOAD`, e
`lib/supabase/storage.ts` mantém o adaptador legado. Ausência de credenciais ou
flag desligada não comprova a proibição permanente na UI/API. Leno deve auditar
importação Nuvemshop, produtos e avatares e entregar a correção/testes em seu
escopo. Vanderlei publica/confere a candidata aprovada dessa entrega depois.
Não foi enviado arquivo para demonstrar essa pendência.

## C. Pendências e responsáveis

| Pendência | Responsável / próxima ação |
|---|---|
| Aceite independente mobile, dashboard/fidelidade, retorno físico/chargeback | Leno: usar a nova URL e a matriz existente; consultar casos por leitura, sem fabricar fatos ou alterar pedidos |
| Referências Nuvemshop e proibição permanente de upload UI/API | Leno: auditoria/correção própria e CI; Vanderlei: publicação e conferência após aprovação |
| E-mail real e recuperação de senha | Operador: chave Resend válida e remetente confirmado em arquivo privado; Vanderlei: revisar bindings e validar entrega em janela autorizada |
| G6 operacional | Vanderlei + Leno + operadores: completar inventário externo, responsáveis/substituto, permissões, custo/cadência e janela; depois ensaiar alertas e recuperação |
| Tráfego, compras e transferência financeira | Etapas coordenadas próprias, após os aceites; não autorizadas por esta publicação |

O problema de falso sucesso de e-mail sem chave em produção está corrigido
nesta candidata. Isso **não** configura entrega real: `RESEND_API_KEY` e
`EMAIL_FROM` continuam ausentes no runtime; a consulta anterior ao provedor com
a chave privada retornou 401. Nenhum e-mail foi enviado nesta rodada.

Inventário Google Cloud reconferido: nenhum Cloud Run Job em `southamerica-east1`;
API Cloud Scheduler desabilitada. Não houve criação/habilitação de agenda.
Para webhook Sandbox, Vercel/Cloudflare, alertas, IAM, custos e recuperação,
vale a [devolutiva G6](DEVOLUTIVA_VANDERLEI_SECAO_69_2026-10-20.md), com horários,
fontes e lacunas explícitos; esses destinos não foram consultados novamente
nesta publicação. A ausência de Jobs nessa região não prova ausência de outros
processadores. G6 continua sem aceite.

[Evidência sanitizada](evidencias/V-CLOUDRUN-AE9EC9C-2026-10-20.json).
Artefatos auxiliares locais: `artifacts/cloudrun-ae9ec9c-20261020/`, ignorados
pelo Git. Não armazenar credenciais ou dados de clientes no pacote de evidências.
