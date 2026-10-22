# Devolutiva de Vanderlei — preparação para produção, 22/10/2026

**Preparação e inspeção executadas; produção e ensaios financeiros não liberados.**
Aplicação, banco, Jobs, webhook, tráfego e controles financeiros foram preservados.
Nenhum pedido antigo foi processado, rearmado, reenviado ou usado para provocar falha.
Não houve novo deploy, migration, backup, restore, contratação ou envio de alerta/e-mail.

Base: `homologacao_teste`, `443fd4e`; `origin/main` local consultada somente leitura em
`7f9b26e062ec2654420fecffb6dd78ad3ba1e017`, inclusive o plano histórico de e-mail.
Não houve conexão ao banco principal. As alterações entre `9495ff9` e a base são
documentais; o código da aplicação coincide com a candidata.

**Atualização durante a publicação deste relatório:** a branch recebeu o PR #14
em `bcdce98`, com vinculação auditável de variantes Nuvemshop. O relatório foi
reaplicado sobre essa integração sem conflitos. `L-NUVEMSHOP-FLUXO-PROPOSTO-2026-10-22.json`
agora está disponível. Os resultados abaixo preservam a base e o horário da
inspeção; não atestam publicação ou validação operacional do código novo do PR #14.

Evidências novas, sanitizadas: [inventário e verificações](evidencias/V-PREPARACAO-PRODUCAO-2026-10-22.json)
e [propostas de recursos/limites G6, não aplicadas](evidencias/V-PROPOSTAS-G6-2026-10-22.json).
Consultas principais entre **15:00 e 15:12 UTC / 12:00 e 12:12 BRT**, em 22/10.
Scripts de coleta, relatórios locais e capturas públicas: `artifacts/vanderlei-preparacao-20261022/`, ignorado pelo Git.
Não copiar perfis de navegador, arquivos privados ou dados brutos para a evidência pública.

O usuário confirmou nesta sessão que **domínio/remetente, responsável/substituto e
disponibilidade da janela ainda não foram definidos**. A janela proposta é
**23/10/2026, 14h–15h30 BRT**, não confirmada. Após confirmação, priorizar supervisão
e alertas; o processamento financeiro depende também de roteiro/casos e exclusividade.

## 1. Release e estado efetivo

| Item | Conferência de 22/10 |
|---|---|
| SHA da aplicação | `9495ff942e832db6588219e57163982b246e16d7` |
| CI | [39619498248](https://github.com/ViniMoia/Sistema-E-Commerce/actions/runs/39619498248), `completed/success`, SHA exato reconferido |
| Projeto / região | `continental-511812` / `southamerica-east1` |
| Revisão | `continental-hml-9495ff9-review`, pronta |
| Digest efetivo web/Jobs | `sha256:7a360eb28fd93be1606d6b8c1591e12c61c3d1db5f06fdb51ca86fe81d056202` |
| URL de teste | https://review-9495ff9---continental-hml-jctvprygla-rj.a.run.app |
| Tráfego | Candidata 0%; `continental-hml-896dc56-logout` permanece com 100%; tags anteriores preservadas |
| Banco / loja | Neon `neondb`, host `ep-blue-feather-b6l24gbu.c-2.sa-east-1.aws.neon.tech`; `continental-homologacao`, ID `3a82b33c-3646-4272-9a89-80bb1ba327a5` |
| Migrations | 35 aplicadas; nenhuma pendente, falha ou divergência de checksum após normalização CRLF/LF. Nenhuma reaplicação |
| Contenção | `CHECKOUT_PAUSED=true`; `PAYMENT_REMOTE_ENABLED`, `PAYMENT_WORKER_ENABLED` e `PAYMENT_EXPIRATION_ENABLED=false`; manutenção geral `false` |
| Conta | Endpoint Asaas Sandbox autenticado por GET; escopo `sandbox-hml`. Não é comprovação de conta produtiva |

## 2. G6 — inventário de acionadores e pendências

| Acionador/destino | Comprovado agora | Limite / responsável |
|---|---|---|
| Cloud Run pagamentos | Job `continental-hml-payments`, mesmo digest e URL da candidata; 0 execuções, nenhuma em andamento; uma tarefa, paralelismo 1, zero retries; 5 lotes, timeout HTTP 240s, Job 1800s | Não foi executado. Vanderlei prepara; Vinícius/Leno autorizam casos e janela. Endpoint também executa conciliação, expiração e outbox |
| Cloud Run supervisão | Job `continental-hml-supervision`, mesmo digest/URL; 0 execuções; 1 lote, timeout HTTP 30s, Job 60s; somente GET de status | Não comprova saúde ou execução dos pagamentos |
| Cloud Scheduler | API desabilitada | Agendas não inventariadas; não afirmar ausência global. Não habilitada nesta preparação |
| Asaas → Vercel | Um webhook habilitado, `interrupted=false`, envio sequencial; host `continental-prototipo-git-homologacaoteste-vinimoias-projects.vercel.app`, caminho `/api/webhooks/asaas` | Query contém bypass, omitido integralmente. API não devolve token para comparação. Rotação não comprovada; administrador Vercel/Asaas deve demonstrá-la |
| Vercel | Destino efetivo confirmado no provedor | Sem credencial administrativa localizada nos locais consultados: cron, deployments/flags, invocações e requisições em voo não conferidos |
| Cloudflare | Worker previsto no código: `continental-pagamentos-hml`, destino Vercel; manifesto local sem cron, habilitação false | Sem credencial administrativa localizada. Manifesto e evento histórico `disabled` não comprovam estado efetivo atual |
| Invocações manuais | Nenhuma tarefa Windows relacionada ao projeto encontrada nesta máquina | Não exclui shells, CI, outras máquinas, integrações e operadores; responsáveis devem registrar suspensão |

Às **15:00:50 UTC**, o status autenticado registrou inbox `READY=1`, outbox
`DEAD_LETTER=1`, devolução `PENDING=1`, uma tentativa em revisão e uma operação retida;
`overdue=1`, sem tentativas incertas. A consulta SQL posterior encontrou zero leases
reivindicados/ativos/expirados nas três tabelas com esse mecanismo. Esses snapshots
não provam exclusividade nem encerram pendências. Encaminhar a Vinícius/Leno para
triagem; não executar o Job financeiro como teste de infraestrutura.

### Sequência preparada para transferência

| Passo / responsável | Ação e critério de avanço | Interrupção / retorno |
|---|---|---|
| 0 — Vinícius/Leno + Vanderlei | Publicar roteiro financeiro, identificar casos novos, baseline e backlog; confirmar operadores, custo e janela. Comprovar todos os acionadores e writers externos | Sem inventário/casos, permanecer no estado atual; apenas leituras |
| 1 — administradores Vercel/Cloudflare/CI + operadores | Conter agendas, scripts manuais e integrações antigas; registrar flags/agendas efetivas, última execução e duração máxima. Manter recepção durável enquanto drena | Se algum acionador não estiver sob controle, não ativar o novo |
| 2 — Vanderlei + Leno | Conferir execuções e requisições em voo, leases, transações e pendências repetidamente pelo período máximo de execução conhecido; estabelecer exclusividade também das chamadas HTTP diretas | Timeout não prova cancelamento; não repetir POST incerto nem liberar dois escritores |
| 3 — administradores + Vanderlei | Preparar receptor persistente na candidata com token/loja corretos e proteção de cron; comprovar retenção/reentrega do provedor e política de duplicados | **Nesta versão, webhook exige `PAYMENT_WORKER_ENABLED=true`, que também libera as rotas de cron.** Só mudar a flag depois de impedir invocadores antigos e coordenar nova credencial/bindings; caso não seja possível, voltar à revisão de código/arquitetura |
| 4 — administrador Asaas + Vanderlei | Transferir apenas o webhook homologado; conferir destino sem query secreta, autenticação e persistência de evento novo autorizado; comparar IDs do provedor/inbox | Sem persistência, não aceitar sucesso fictício. Reverter destino apenas após conter o receptor/consumidor novo e garantir que o anterior está apto; preservar eventos já recebidos |
| 5 — Vanderlei + Vinícius/Leno | Um único mecanismo de acionamento, um lote inicial, nenhuma retentativa automática de POST, baseline segregado e acompanhamento dos efeitos | A API atual não tem allowlist por pedido e usa `limit=5` no acionador. Um lote pode alcançar casos antigos de inbox/conciliação/outbox. Sem segregação/revisão, execução continua bloqueada |
| 6 — equipe conjunta | Conferir progresso, deduplicação, revisão/leases, alertas, reconciliação de eventos da transição e responsabilidades | Parar novas invocações e novas compras diante de efeito inesperado; preservar recepção e obrigações quando seguro. Reversão de imagem não desfaz efeito no gateway |

Timeouts atuais divergem: web 60s, cliente do Job de pagamentos 240s, Job 1800s.
Medir o ciclo antes de alinhar esses limites; não aumentar timeout nem repetir POST
para esconder execução incerta. `parallelism=1` só limita tarefas de uma execução.

## 3. G5 — matriz de segurança e correções preparadas

Todas as linhas abaixo referem-se à candidata/revisão e HML da seção 1. Evidências:
`controls`, `database`, `httpProbes`, `logs`, `unitTests` e `runtime` no JSON associado.

| Controle | Estado, verificação e resultado | Limite / correção / responsável |
|---|---|---|
| IAM web/consumidor | Concluído o inventário: contas distintas, zero chaves gerenciadas pelo usuário; segredos individuais com acesso da web, cron compartilhado com consumer; Jobs sem binding público | Política de projeto mantém Compute padrão como Editor e um Owner humano. Administrador deve mapear uso e substituir permissões amplas por papéis necessários antes de qualquer revogação; heranças fora do projeto não auditadas |
| Permissão do banco | Concluído o diagnóstico: mesma conta em `DATABASE_URL` e `DIRECT_URL`; dona de 38 tabelas, `CREATEDB`, `CREATEROLE`, `BYPASSRLS` e membro de `neon_superuser` | Preparar conta runtime separada, DML/sequências/rotinas estritamente necessários e migrador distinto; ensaiar grants/locks/trigger com artefato aprovado antes de alterar binding. Não revogar ownership/roles às cegas. Administrador Neon + Vanderlei |
| Segredos / ambientes | Bindings de banco, cron e token de webhook comparados em memória com fonte HML: iguais; versões numéricas fixas; conta/API Sandbox | Não comprova separação do ambiente produtivo sem seus metadados. Não copiar identidades Sandbox. `CRON_SECRET` permite processamento, não é credencial somente leitura de supervisão |
| Admin / loja / Origin | Anônimo recebe 307 para login no Admin, carrinho 401; host encaminhado forjado não troca loja. 73 testes unitários passaram, incluindo isolamento, sanitização e reset | Navegação anônima não comprova todas as ações Admin autenticadas. Reaproveitar provas compatíveis de login/logout e CI; expansão com contas controladas no roteiro |
| Sessões / cookies / logout | Provas anteriores da correção de logout e CI do SHA reaproveitadas; nenhuma alteração de código da aplicação nesta base | Não houve novo login/reset em conta real. Confirmar cookies Secure/HttpOnly/SameSite e invalidação de sessão no domínio final durante ensaio |
| Webhook | Token vinculado; ausência/token errado: 401; token correto com corpo inválido: 503, worker desligado. Nenhum evento enviado | Autenticação da candidata não comprova processamento/persistência, token do destino Vercel ou rotação do bypass. Administradores + Vanderlei |
| Logs / persistência de cartão | Consulta agregada de 18 colunas JSON: zero correspondências ao padrão de campos numéricos PAN/CVV/CVC/CCV. Logs das 24h anteriores: zero correspondências ao filtro; apenas metadados coletados. Sanitização passou em teste | Busca por padrões não é prova exaustiva de ausência de todo dado sensível. Dois ERROR de requisição com status 503 em 21/10 foram encontrados; sem corpos/valores coletados. Ampliar cobertura por nomes/formatos se surgir evidência concreta |
| Meios bloqueados | `/api/payment/capabilities`: lista vazia; checkout inválido: 503/`CHECKOUT_PAUSED`. Código/contrato não aceitam débito; PIX manual desligado na loja | Pausa global não substitui homologação dos métodos na abertura. Confirmar capabilities após configuração autorizada; débito continua adiado |
| Upload | Anônimo recebe 401/no-store; testes de política permanente recusam usuário/Admin mesmo com flag e Storage configurados | Não houve sessão Admin real nesta rodada. Imagens externas; nenhum recurso de upload provisionado |

**Estado anterior/posterior de configurações remotas: idêntico.** Correções de
permissões e domínio estão preparadas para revisão, não aplicadas. Nenhuma mudança
de código de aplicação ou PR técnico foi necessária nesta rodada de preparação.

## 4. G6 — alertas e atendimento

Canal existente `3617580342119339067`, destinatário configurado igual ao contato
anterior, sem reproduzir o endereço. Canal desabilitado. Políticas de supervisão
`16768859373754969259` (ausência, 600s) e `2245739515294212144` (falha/atenção)
desabilitadas; métrica `continental-hml-supervision-completed` presente.
**Pagamentos não tem métrica/políticas próprias no inventário.**

Foram preparados os corpos JSON da métrica de conclusão e das duas políticas de
pagamentos, com filtros por Job/região/projeto e políticas desabilitadas. Não foram
implantados. Antes de aplicar, repetir inventário e recusar duplicação por nome/filtro.
Preservar canal existente; sua presença não comprova responsável disponível.

| Cenário preparado | Execução futura e evidência exigida |
|---|---|
| Inicialização | Confirmar destinatário, responsável/substituto e janela; habilitar somente recursos aprovados. Emitir série de conclusão de cada Job antes do teste de ausência |
| Atenção | Caso sintético autorizado/fixture isolada, identificado como ensaio; comprovar sinal, incidente, entrega humana e atribuição. Nunca usar a devolução antiga em revisão para provocar falha |
| Falha | Falha controlada de transporte/configuração em execução de ensaio isolada, sem enviar comando financeiro; registrar erro sanitizado e recebimento. Não alterar segredo compartilhado para produzir falha |
| Ausência | Após série inicial, suspender o acionador do ensaio por mais de 600s, considerando atraso de ingestão; comprovar aviso separado por Job. Supervisão saudável não substitui heartbeat financeiro |
| Recuperação | Repor configuração/acionador do ensaio, comprovar conclusão/progresso e resposta humana. Incidente resolvido/autoClose não encerra pendência financeira |
| Duplicação / atendimento | Comparar IDs e efeitos antes/depois do caso autorizado; observar intervalo mínimo de 300s entre notificações de log. Registrar disparo, recebimento, atendimento, recuperação, responsável e pendências |

Proposta inicial para supervisão: 1 execução a cada 5 minutos, 1 lote, HTTP 30s,
Job 60s, zero retries, teto de 18 execuções em 90 minutos e parada ao fim da janela.
Isso é proposta de piloto, não SLA nem cadência comercial aprovada. Pagamentos fica
condicionado à triagem/segregação e alinhamento dos timeouts da seção 2. Não criar
recorrência permanente antes de orçamento, capacidade e prazos aceitos.

## 5. G7 — capacidade, custo, experiência e frete

**Configuração:** web 1 vCPU/1 GiB, concorrência 20, timeout 60s, máximo 1 por revisão,
sem mínimo explícito; Jobs 1 vCPU/512 MiB. Tags antigas continuam acessíveis:
limite por revisão não é um teto global do serviço. `DATABASE_URL` usa host direto,
sem parâmetros explícitos `connection_limit`, `pool_timeout` ou `pgbouncer`;
SSL requerido. PostgreSQL informa 112 conexões máximas, 4 reservadas; snapshot com
1 ativa (a inspeção) e 1 idle. Isso não comprova margem em pico. Neon control plane,
CU efetivo, suspensão e uso da conta não puderam ser consultados.

Monitoring, intervalo **21/10 15:06:10 a 22/10 15:06:10 UTC**: 18 requisições,
18,4505 segundos de tempo faturável de instância; maior contagem por série 1;
máximo entre séries dos percentis 95 alinhados no período: CPU 12,25%, memória
16,895%. São agregados de um intervalo com pouca carga e possível atraso de coleta;
não demonstram capacidade, latência sustentável ou custo total da conta.

Preços on-demand consultados no catálogo autenticado de billing para
`southamerica-east1`, USD, vigência 22/10/2026 07:00 UTC: Jobs CPU
`AF17-DF9D-44AC` = **US$ 0,0000216/vCPU-s**; memória `237B-7B65-23B9` =
**US$ 0,0000024/GiB-s**. [Jobs têm mínimo de cobrança de 60s](https://cloud.google.com/run/pricing).
Premissa: uma tarefa 1 vCPU/0,5 GiB, duração até 60s, 30 dias, sem descontar franquias.

| Cadência hipotética | Execuções/mês/Job | Custo bruto por Job/mês |
|---|---:|---:|
| 1 minuto | 43.200 | US$ 59,0976 |
| 5 minutos | 8.640 | US$ 11,81952 |
| 60 minutos | 720 | US$ 0,98496 |

Dois Jobs, 18 execuções cada no piloto de 90 minutos: **US$ 0,049248** de compute
sob essas premissas. Duração maior, novas execuções/retries, web, Neon, rede, logs,
Monitoring e Scheduler acrescentam custos. Não é orçamento aprovado. Billing está
habilitado; consulta de budgets retornou `403 PERMISSION_DENIED`. Não inferir saldo
de franquia disponível. Exemplo Neon não medido: 0,25 CU × 24h × 30 dias = 180 CU-h;
polling pode impedir suspensão. **Sustentabilidade dentro do orçamento não comprovada.**

**Ensaio de capacidade preparado, não executado:** primeiro registrar orçamento e
limites Neon/pool; somente GET público de catálogo/API, sem cotação que persista,
checkout ou pedidos. Rampa proposta 1/2/5 clientes, 60s por etapa, máximo 300 GETs,
duração total 5 minutos, nenhuma recorrência. Separar aquecimento e cold start.
Interromper em 429, dois 5xx consecutivos, erro de conexão, CPU/memória >80% por
60s ou uso de conexões >70% da margem disponível; suspender aumento se p95 >2s.
Medir p50/p95/p99, erros, conexões/locks e consumo antes/depois. Limiares são critérios
propostos de ensaio, não capacidade/SLA aceitos. Proposta de pool: dimensionar
`revisões/instâncias simultâneas × connection_limit + demais clientes` com reserva
operacional, validar endpoint pooled e manter conexão direta só no migrador.

Navegação nova em Chrome isolado, anônimo, **1366px e 390px**: home, catálogo com
12 cards visíveis na página, detalhe de produto, login, recuperação de senha e
redirecionamento de Admin. Sem overflow horizontal nos estados observados e sem
falha HTTP própria registrada; nenhum POST de navegação disparado. O produto
observado não exibiu grupos de variantes: não aprova seleção entre variantes
distintas. Carrinho autenticado, recuperação de pedido, estados financeiros e ações
Admin devem reutilizar as provas compatíveis da CI/publicações e receber aceite
com contas/casos controlados; esta navegação não os substitui.

Frete: retirada, sem frete e Correios habilitados; CEP de origem presente; contrato
e credencial Correios ausentes na loja; adicional de 1 dia. Os **519 produtos ativos**
têm dimensões positivas, mas todos coincidem com os padrões **300g / 16×11×4cm**:
consistência estrutural não comprova embalagem real. Há 31 registros de cotação
`JT_EXPRESS`, R$ 12,30/2 dias, último em 14/10; isso não é nova cotação nem prova
Correios. Não foi emitida etiqueta ou feita nova cotação persistente.

Roteiro comercial restante: Vinícius define modalidades/contratos/cobertura e
embalagens reais; Vanderlei confere integração e Leno prepara casos. Para cada
modalidade, conferir CEP coberto e recusado, peso/dimensões, preço/prazo aprovado,
expedição e rastreio. Manter timeout Correios anterior como pendência até evidência
posterior; a ausência de contrato local não prova sozinha a causa daquele timeout.

## 6. G8/G2 — implantação, contenção, recuperação e retomada

1. **Preparar (Vanderlei):** congelar SHA/digest e configuração sanitizada, conferir CI,
   imagem web/Jobs, domínio/loja, migrations e segredos por referência; registrar
   baseline e inventário completo dos writers, conta/escopo e evidências G1–G8.
2. **Autorizar fase (Vinícius/Leno + revisão conjunta):** liberar escopo específico e
   janela. Este documento não libera produção, migrations na main, estornos ou estoque.
3. **Conter compras (Vanderlei + administradores):** checkout pausado em todas as
   revisões/ingressos; preservar recuperação e obrigações financeiras conforme o plano.
   Não desligar worker como atalho se isso impedir persistência do webhook.
4. **Drenar (equipe):** conter agendas, invocações manuais, Admin/importadores e
   integrações; acompanhar chamadas em voo e transações. Para trecho exclusivo,
   comprovar retenção/reentrega antes de manutenção; `APP_MAINTENANCE_MODE` não
   controla SQL externo e `CHECKOUT_PAUSED` não congela o banco.
5. **Implantar somente quando autorizado:** executor de migrations separado e
   revisão compatível com schema; publicação sem promoção antes das sondas.
   Na candidata atual não existe migration pendente nem motivo para repetir deploy.
6. **Conferir/retomar:** conta/loja/domínio, auth, persistência, backlog/leases, efeitos,
   deduplicação e alertas; manutenção false com checkout ainda pausado; reconciliar
   eventos do intervalo antes de promoção/abertura explicitamente aceitas.
7. **Reverter:** conter novas execuções e compras; escolher imagem previamente
   conferida como compatível com as migrations aditivas. Preservar schema, dados,
   eventos e trilha; não presumir que a revisão de 100% é rollback seguro. Nunca
   restaurar banco compartilhado ou desfazer transação do gateway por conveniência.

G2: o guia de 22/10 informa recuperação técnica já realizada e metas aprovadas de
**RPO 15 minutos / RTO 60 minutos**. Reaproveitar essa entrega; não repetir restore
idêntico. `FECHAMENTO_G2.md` e `L-G2-BACKUP-ENSAIO-2026-10-21.json` não estão nesta
base, logo não é possível anexar/comparar seus tempos e alcance. As cópias HML
locais com DPAPI e provas anteriores não substituem essa evidência nem o banco
de origem. Nenhum backup foi gerado/descriptografado/restaurado nesta etapa.

Complemento operacional preparado: obter documento de fechamento; identificar
custodiante e alternativo com contas pessoais, localização aprovada fora da máquina,
retenção/cutoff, acesso independente à chave e logs de acesso; registrar cobertura
de roles/grants, segredos, DNS, imagens externas e configurações/integrações fora
do dump. Confrontar tempos realmente demonstrados com 15/60 e reconciliar eventos
posteriores ao cutoff. Recuperação comercial e continuidade ainda dependem desses
itens; disponibilidade de arquivo não encerra G2.

## 7. G5/G8 — e-mail e reset

Bindings `RESEND_API_KEY` e `EMAIL_FROM` continuam ausentes na web; arquivo privado
tem chave e não tem remetente. Consulta Node GET `/domains` retornou
**401 `restricted_api_key`** às **15:09:56 UTC**. A primeira sonda Python retornou
403 sem código específico; a diferença foi registrada, sem concluir revogação.
[Chaves `sending_access` podem enviar sem administrar domínios](https://resend.com/docs/api-reference/api-keys/create-api-key).
**Não há motivo demonstrado para substituir a chave apenas por esse GET.**

O `customDomain` da loja ainda é o host Vercel; ele prevalece sobre
`NEXT_PUBLIC_APP_URL` na formação de links sensíveis. Logo, enviar reset pela
candidata hoje produziria origem Vercel. Preparar domínio canônico consistente
com o destino do ensaio antes de enviar; não trocar domínio da loja por inferência,
pois a mesma base atende ingressos antigos. Domínio/remetente seguem indefinidos,
conforme resposta do usuário, e nenhum envio foi realizado.

Procedimento pronto: Vinícius define domínio/remetente e conta/destinatário controlado;
administrador confirma DNS/domínio e autorização de envio da chave pelo uso necessário;
Vanderlei prepara versões/bindings restritos à web e revisão sem tráfego, preservando
flags e ingressos. Verificar origem canônica e cookies, solicitar reset do usuário de
teste, registrar recebimento sem token/link, usar uma vez, recusar reutilização e
confirmar login com nova senha/logout. Não publicar senha, destinatário ou URL privada.
Testes unitários de reset/e-mail passaram, mas não comprovam entrega real.

## 8. Estado final por frente e retorno necessário

| Frente/gate | Estado | Próxima ação / responsável / dependência |
|---|---|---|
| G6 inventário acessível / backlog | **Concluído com evidência**, alcance GCP/HML/GET Asaas | Administradores completam Vercel/Cloudflare/manual e rotação; Vinícius/Leno fazem triagem financeira |
| G5 configuração / bloqueios | **Concluído diagnóstico e sondas parciais** | Administradores/Vanderlei revisam IAM/role/pool/domínio; aceite autenticado e segurança integral permanecem abertos |
| G6 transferência / alertas | **Preparado sem execução** | Roteiro, propostas JSON e limites prontos; faltam owner/substituto, janela, orçamento, exclusividade e casos autorizados |
| G7 capacidade / frete | **Configuração e consumo levantados; ensaio preparado** | Acesso Neon/budgets, teto financeiro, contratos/embalagens e casos comerciais; nenhuma capacidade de venda aprovada |
| G7 interface | **Leituras desktop/mobile concluídas no alcance registrado** | Variantes distintas, carrinho autenticado, pedidos/financeiro/Admin no roteiro coordenado |
| G8 publicação / contenção / G2 operacional | **Procedimento preparado; release existente reconferida** | Vinícius entrega fechamento G2; equipe fecha custódia/acessos/cobertura e autorizações de cada fase |
| G5/G8 e-mail | **Preparado; bloqueado por definições identificadas** | Vinícius define domínio/remetente e conta controlada; depois bindings e ensaio real |

Continuam ausentes após a integração: `ROTEIRO_ACEITE_FINANCEIRO_G3.md`,
`FECHAMENTO_G2.md` e `L-G2-BACKUP-ENSAIO-2026-10-21.json`.
`L-NUVEMSHOP-FLUXO-PROPOSTO-2026-10-22.json`, ausente na inspeção e assim registrado
no snapshot JSON, foi recebido com o PR #14 durante a publicação deste relatório.
Não reimportar produtos Nuvemshop, alterar quantidades ou classificar catálogo real
como teste. Débito e o ensaio específico de expiração continuam adiados. Nenhum gate
inteiro foi declarado concluído por CI, recurso criado ou candidata publicada.
