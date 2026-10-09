# Registro de execução das correções de lógica

**Início:** 03/10/2026. **Atualização:** 06/10/2026. **Revisão de partida:** `1d513c2`.

**Origem:** [workflow](WORKFLOW_IMPLEMENTACAO_CORRECOES_LOGICAS.md), [propostas](../Propostas/PROPOSTAS_CORRECAO_PRONTIDAO_PRODUCAO.md) e [auditoria](../../relatorio_geral/logic-audit-report.md).

O usuário autorizou iniciar e continuar a implementação. O bloco inicial F0 foi seguido pelo clone, expansão de WF-04, módulos de WF-05/WF-07/WF-08/WF-09/WF-10/WF-11/WF-12/WF-13/WF-14/WF-15/WF-16/WF-17 e comando transacional de WF-06. Este registro não declara os 38 achados corrigidos nem prontidão para produção. Nenhum banco persistente foi migrado/limpo; não houve operação financeira externa, commit ou deploy. A origem foi acessada somente para metadados/exportação em modo read-only em 04/10; em 05/10 o backup protegido foi reutilizado sem nova conexão à origem.

## 1. Base e estado

- Baseline: 444 testes unitários em 59 arquivos passaram; typecheck inicial passou.
- Alterações preexistentes: `next-env.d.ts` modificado e documentação da correção não rastreada. Preservados; o servidor de desenvolvimento que já estava executando não foi encerrado.
- Next.js instalado: 16.3.5; Prisma: 5.22.0. Lidos os guias locais de Route Handlers e `revalidateTag`; a invalidação alterada usa a assinatura com segundo argumento, sem cast.
- Executor: agente de implementação nesta sessão. Revisão humana/aceite operacional ainda não registrados; os estados abaixo significam evidência local, não aprovação de implantação.

| Etapa | Estado nesta entrega | Evidência ou pendência |
|---|---|---|
| WF-00 | Base F0 registrada; decisões posteriores pendentes | Baseline, alterações preexistentes, escritores iniciais e decisões técnicas abaixo |
| WF-01 / LA-006 | INTEGRADO nos ensaios locais | Provisionador, cliente protegido, sentinela, servidor isolado, cleanup transacional e testes negativos |
| WF-02 / LA-038 | IMPLEMENTADO NO MÓDULO, com ensaio HTTP local | DTOs, edição de credenciais, canários de JSON/cache/log de aplicação e persistência; avaliação da exposição/rotação e homologação de UI/frete externo pendentes |
| WF-03 / LA-030 | INTEGRADO nos ensaios locais | Banco vazio/sintético e clone restaurado passaram; dados, sequências, CHECKs, checksums e diff verificados. WF-19/20 pendentes |
| WF-04 | Base IMPLEMENTADA e ensaiada | Contratos versionados, 11 tabelas, atores, revisões/lotes e helper de locks; ver contratos comuns. Integração dos writers nas etapas seguintes |
| WF-05 / LA-014/020/032 | IMPLEMENTADO NO MÓDULO, com ensaios de serviço/HTTP/PostgreSQL | Conta/tenant/ownership, snapshots de comprador e endereço, credencial de convidado, leitura pessoal sem escrita; intenção/replay integrados localmente em WF-13; UX final pendente |
| WF-06 / LA-027 | IMPLEMENTADO NO MÓDULO | Status/histórico/auditoria/outbox no mesmo commit; autoria e versão; rollback real e disputa ensaiados |
| WF-06 / LA-002/033 | EM EXECUÇÃO, base transacional ensaiada | Repetição serializada e atores válidos; reservas novas integradas em WF-13 e fatos financeiros/inbox/worker em WF-14; legado, devoluções parciais/físicas e homologação do candidato permanecem pendentes |
| WF-07 / LA-018/019 | IMPLEMENTADO NO MÓDULO, com ensaios locais | Retirada explícita, restituição indisponível, comandos auditados/idempotentes, revisão e Admin; integração completa e homologação de navegador pendentes |
| WF-08 / LA-017 | IMPLEMENTADO NO MÓDULO, com ensaios locais | Unicidade parcial ACTIVE, lock de escopo antes da criação, recibo/revisão e consumo serializado; intenção/consumo integrados em WF-13; contrato das mutações do frontend pendente em WF-15 |
| WF-09 / LA-021/022 | IMPLEMENTADO NO MÓDULO, com ensaios locais | Lotes/FEFO, alocações, déficit e expiração com lease/retry; legado protegido e pendências duráveis. Conciliação/consumidor/ativação em WF-14/18/19/20 |
| WF-10 / LA-028/029 | IMPLEMENTADO NO MÓDULO, com ensaios locais | Consumo/revogação atômicos, sessão revalidada e elegibilidade administrativa serializada; revisão/rollout/recuperação operacional pendentes |
| WF-11 / LA-031/008 | IMPLEMENTADO NO MÓDULO, com ensaios locais | Cotação v2 persistida/assinada, identidade/geografia e revisões de cache; integração final, frete externo e ativação legada pendentes |
| WF-12 / LA-035/009/023 | IMPLEMENTADO NO MÓDULO, com ensaios locais | Capacidades explícitas, plano financeiro em centavos, tentativa antes do I/O e ganho congelado; worker/eventos/estornos integrados localmente em WF-14; gateway real/QA/rollout pendentes |
| WF-13 / LA-011/004/001/015/013/012 | IMPLEMENTADO NO MÓDULO, com ensaios locais | Intenção/revisão/consentimento, comando único, consumo/reservas e recuperação persistida; conciliação integrada localmente em WF-14; navegador e ativação pendentes |
| WF-14 / LA-005/003/010 | IMPLEMENTADO NO MÓDULO, com ensaios locais | Inbox/outbox duráveis, conciliação, operações de cancelamento/estorno e expiração por método; sandbox, scheduler/alertas e ativação pendentes |
| WF-15 / LA-034/007/024/016/025 | IMPLEMENTADO NO MÓDULO, com ensaios locais em PostgreSQL/Next e navegador | Revisões de CEP/frete, comandos de carrinho, endereços separados e confirmação financeira; candidato de produção, matriz ampliada de navegadores e serviços reais ainda dependem de WF-19 |
| WF-16 / LA-026/037 | IMPLEMENTADO NO MÓDULO, com ensaios locais em PostgreSQL/HTTP/Next e navegador | Expedição/rastreio no mesmo commit, revisão/recibo/auditoria, ações por modalidade e autoria distinta; homologação operacional em WF-19/20 pendente |
| WF-17 / LA-036 | IMPLEMENTADO NO MÓDULO, com ensaios locais em PostgreSQL/HTTP/Next e navegador | LTV/ticket por fatos reconhecidos, estornos identificados e cobertura parcial; lista/perfil equivalentes; candidato/legado/aceite financeiro em WF-18/19/20 pendentes |
| WF-18 | EM EXECUÇÃO; ensaio técnico local de clone/backfill/compatibilidade realizado | Inventário readonly, backup/restore, constraints, interrupção/replay e barreira de writers legados; resolução/aceite das exceções e contrato operacional permanecem pendentes |
| WF-19 | EM EXECUÇÃO; piloto de capacidade e contrato Sandbox/Preview preparados |635 unitários/78 arquivos e30 testes dirigidos/3 arquivos na seção28;289 testes/24 arquivos por modo, Linux e piloto de11 testes nos checkpoints anteriores. Home fora da meta; Sandbox real, páginas completas/capacidade Vercel/Neon, dados e aceites pendentes |
| WF-20 | NÃO INICIADO | Homologação integral/aceite de WF-19, fechamento de WF-18 e requisitos operacionais precedem rollout |

Não há LA VALIDADO em WF-19 ou ENCERRADO EM PRODUÇÃO. Trinta e seis itens têm módulo ou integração local ensaiados: LA-001/003/004/005/006/007/008/009/010/011/012/013/014/015/016/017/018/019/020/021/022/023/024/025/026/027/028/029/030/031/032/034/035/036/037/038. LA-002/033 continuam parciais até integração final/legado/homologação; não resta achado sem implementação principal. Todos exigem validação no candidato completo. Os checkpoints anteriores foram conservados como histórico; o estado atual está nesta tabela e na seção28.

## 2. Decisões técnicas efetivamente adotadas no F0

1. PostgreSQL 16 em container descartável por execução, bind apenas em `127.0.0.1`, dados em tmpfs, identidade aleatória e descarte conferido pela label do próprio container. A versão do banco persistente ainda precisa ser confirmada no clone.
2. Papel `ecommerce_test` sem superusuário, criação de bancos ou papéis; sem propriedade do banco/schema; recebe apenas CONNECT e USAGE/CREATE no schema da execução. A sentinela pertence ao provisionador e é apenas legível pelo cliente da aplicação.
3. O cliente Prisma real de testes recebe explicitamente TEST_DATABASE_URL e verifica current_database/current_user/sentinela antes de qualquer operação, inclusive raw queries e imports anteriores ao setup. Não há fallback para DATABASE_URL nem reutilização do singleton da aplicação nos testes.
4. O servidor de integração recebe a mesma identidade e um token de handshake privado. Helpers recusam servidor externo, path com outro host, redirects e divergência entre servidor/fixture. Sem ambiente provisionado, os clientes unitários não mockados apontam a uma porta local indisponível; nunca usam a conexão configurada da aplicação.
5. O Next de teste executa em cópia temporária dos fontes, sem copiar `.env`, com dependências compartilhadas e saída própria. Isso preserva `.next`, `next-env.d.ts` e a execução do servidor do desenvolvedor. Chaves de provedores relevantes ficam vazias no executor; não há homologação externa neste bloco.
6. Credenciais armazenadas dos Correios são exclusivamente entradas de escrita e dados privados da integração. APIs públicas não as consultam; Admin recebe somente indicadores de configuração. Campo de substituição vazio preserva; `null` remove explicitamente; placeholders/vazio enviados como senha são rejeitados. O formulário limpa os drafts após sucesso.
7. A reconciliação monetária conserva DECIMAL(10,2) já usado nas migrations, os índices de desempenho e os CHECKs existentes. A migration nova bloqueia as tabelas monetárias antes da verificação e rejeita valores que exigiriam arredondamento/perda. `lock_timeout` de 10 segundos evita espera indefinida; janela/custo em volume real ainda precisam de ensaio.

As escolhas de D01–D10 e seus limites de ativação estão no [documento de contratos comuns](CONTRATOS_COMUNS_CORRECOES_LOGICAS.md). O bloco F0 não alterou políticas de compra; os blocos seguintes já integraram comprador/tenant e o protocolo de status. Capacidade, RPO/RTO, responsáveis, alertas e janela operacional continuam necessários para a liberação.

## 3. LA-006 — o que mudou

- `lib/testing/database-policy.ts`: parsing estrito de host, banco por execução, papel, protocolo e parâmetros; validação de metadados reais e servidor. Não registra URL/credenciais em erros de validação.
- `lib/prisma.ts`: override explícito do datasource e middleware que bloqueia operações até verificar a sentinela pelo mesmo cliente. Contexto assíncrono interno limita o bypass à consulta de verificação; não existe flag externa para desativá-lo.
- `scripts/lib/disposable-postgres.mjs`: provisionamento/descarte por identidade e papel restrito; readiness TCP evita confundir o PostgreSQL temporário de bootstrap com o servidor definitivo.
- `scripts/run-isolated-tests.mjs`: migrations no banco próprio, servidor em projeto temporário, handshake, execução das suites selecionadas e teardown dos processos/container/diretório pertencentes à execução.
- `tests/setup/fixture-scope.ts`: lojas de fixtures identificadas, recusa de adoção de loja preexistente e cleanup limitado a esse conjunto numa transação. A falha de FK reverte também as exclusões anteriores.
- `tests/setup/db.ts`, factories e helpers de autenticação: loja/produto/variante válidos, IDs de pedido por sequência, seleção de itens por tenant/produto e eliminação da limpeza global. O token/identificador de fixture não concede acesso a banco externo.
- `tests/helpers/request.ts` e helper HTTP alternativo: handshake antes de requests; sem default implícito para localhost:3000; sem redirects.
- Vitest/`.env.example`: documentam e aplicam a configuração fornecida pelo provisionador. O teste unitário de boleto agora mocka explicitamente a consulta de evento que antes não estava mockada.

**Ensaios realizados:** URL com test em senha/usuário, banco local arbitrário, papel indevido, parâmetro de host/schema e parâmetros duplicados são recusados; metadados divergentes são recusados; um DATABASE_URL externo simulado não altera o datasource real do teste; servidor de outra identidade impede POST; sentinela ausente/divergente bloqueia setup/create/seed/cleanup, com zero lojas observado pelo provisionador; o papel da aplicação não modifica/exclui a sentinela nem o schema; cleanup com FK externa falha e reverte, preservando dados fora do escopo.

**Limite:** essas evidências não tornam corretos os asserts/fluxos das suites antigas. Integração/carga completas continuam a depender das correções posteriores e de WF-19. O teste opt-in do produto histórico não recebe acesso ao banco persistente através deste executor; sua fixture precisa ser adaptada ao ambiente descartável na etapa pertinente.

## 4. LA-038 — o que mudou

- `lib/loja-dto.ts`: whitelists públicas e administrativas, tipos derivados do select, serializadores que removem inclusive campos inesperados/futuros e helper de comandos explícitos de credenciais.
- `services/loja.service.ts`: consulta pública sem senha/código do contrato; retorno/caching administrativo apenas do DTO com indicadores; chave de cache administrativo versionada; update não ecoa credenciais e invalida as configurações; erros da camada não incluem a exceção com dados sensíveis.
- Rotas `/api/loja/[slug]` e `/api/loja/settings`: aplicam os serializadores na fronteira HTTP. Respostas administrativas usam no-store. Autorização Admin foi mantida.
- `app/admin/settings/page.tsx`: mostra configuração existente por indicadores, mantém substituições em drafts vazios e oferece remoção explícita; salvar dados comuns não sobrescreve segredo nem reenviará uma senha armazenada.
- A integração de frete mantém a leitura privada que já realiza diretamente no servidor; não foi migrada para o DTO público.

**Ensaios realizados:** canários de senha, código do contrato, token ERP e campo secreto adicional não aparecem no JSON público/administrativo ou DTO cacheado. Update comum preserva a senha no PostgreSQL; substituição e remoção funcionam via HTTP sem retornar o valor. Erro de persistência não imprime o canário no log da camada alterada. Placeholder/vazio são recusados e os comandos do formulário distinguem preservar/substituir/remover.

**Pendências:** revisão visual/hidratação do Admin e cotação externa com credenciais reais em sandbox; diagnóstico da exposição anterior e necessidade de rotação/purga por operação. Nenhuma credencial real foi rotacionada. A proteção contra divulgação deve permanecer também em eventual rollback.

## 5. LA-030 — o que mudou

Nova migration: `prisma/migrations/20261003000000_complete_runtime_schema/migration.sql`. Nenhuma das 20 migrations históricas foi editada.

Ela completa tabelas/colunas/índices/enum/FKs usados pelo aplicativo e ausentes do histórico, incluindo catálogo de marcas/tags, tabelas J&T, integração/stock sync, configuração logística, cartão/boleto e modalidade NONE. Reconcilia a unicidade de email por loja e permite múltiplas variantes do mesmo produto no pedido, conforme o schema já usado pelo código. Conserva os índices de desempenho e CHECKs anteriores; o schema foi ajustado para refletir esses índices e a precisão monetária das migrations existentes.

DDL executa em transação e trata a presença de objetos previamente sincronizados. Isso **não aceita qualquer drift automaticamente**: o diff completo e a inspeção de constraints/ownership devem passar no clone antes de implantação. Valores monetários incompatíveis abortam; não são arredondados para fazer a migration passar. Não foi usado reset/db push nem alterado `_prisma_migrations` de banco persistente.

`scripts/verify-runtime-migrations.mjs` verifica histórico integral em banco vazio, diff para schema, os 11 CHECKs não representados pelo Prisma e segundo deploy sem alteração. Também verifica upgrade sintético: histórico antigo, fixture com FKs/estoque/preço/pedido, objetos já sincronizados e aplicação da migration nova pelo papel proprietário dos objetos. O cenário preservou IDs, referências, valores, estoque e número do pedido.

**Requisito de saída atendido localmente em 04/10:** versão PostgreSQL identificada e backup do banco configurado restaurado/sanitizado em clone. Evidências e limites na seção 9. O ensaio sintético anterior, sozinho, não comprovava suporte dos dados reais. A aplicação a banco persistente continua pertencendo ao rollout posterior, com backup/janela/revisão operacional atuais.

## 6. Verificações e automação

Resultados históricos do F0 de 03/10; ver a seção 10 para a continuação de 05/10.

| Verificação | Resultado local |
|---|---|
| `npm test -- --reporter=dot` | 472 testes passaram, 62 arquivos |
| `npx --no-install tsc --noEmit --incremental false` | Passou |
| `npx --no-install prisma validate` | Passou |
| `npm run test:migrations:isolated` | Banco vazio e upgrade sintético passaram; diff vazio, 11 CHECKs e reaplicação sem alterações |
| `npm run test:isolation:negative` | 1 cenário por ambiente: missing e mismatched; ambos passaram e permaneceram com zero lojas |
| `npm run test:integration:isolated -- tests/integration/test-environment-isolation.test.ts tests/integration/loja-credentials.test.ts` | 6 testes passaram em 2 arquivos; PostgreSQL e Next reais, sem mocks de persistência |
| ESLint direcionado aos módulos/testes/scripts alterados | Sem erros; 2 avisos de trechos preexistentes: hook de carregamento no Admin e comentário eslint-disable do singleton |
| `git diff --check` | Sem erros de whitespace |

A CI foi atualizada para rodar reconstrução de migrations, rejeições da sentinela e os ensaios HTTP F0. Esses jobs foram reproduzidos localmente; não houve push/disparo de execução no GitHub nesta sessão. As suites antigas completas não foram habilitadas como gate aprovado antes de tratar seus fluxos de negócio.

**Geração/build local em 03/10:** a tentativa de `prisma generate` encontrou EPERM ao substituir a DLL do engine mantida em uso pelo servidor preexistente, que foi preservado. **Em 04/10**, sem esse engine em uso, geração passou e o build foi executado em cópia temporária, com PostgreSQL descartável. Não foram atualizadas dependências nem ignorados erros TypeScript para contornar o bloqueio. Ver resultados atuais na seção 9.

## 7. Inventário inicial de escritores para os próximos blocos

Este inventário organiza as entradas conhecidas; cada etapa ainda deve conferir seus consumidores/caminhos alternativos antes de alterar regra ou schema.

| Entidade/efeito | Escritores/entradas que precisam convergir |
|---|---|
| Pedido e reserva | `/api/checkout` → `checkout.service`; POST `/api/orders` → `createOrderFromCart`; `inventory.service` |
| Status, estoque e pontos relacionados | `order.service.updateOrderStatus`; Admin/status; cancelamento do cliente; webhook/simulador Asaas; `order-timeout.service` e cron |
| Pagamento externo/metadados | Checkout; adapter/client Asaas; webhook; consulta/timeout; futura reconciliação durável |
| Carrinho/itens | `cart.service`; `/api/cart`; consumo pelos dois caminhos de pedido; estado cliente |
| Produto/variante/estoque Admin | `product.service`; schemas/payload Admin; estoque/reserva/restituição por `inventory.service`; auditor de variantes continua sem apply por padrão |
| Carteira/ledger | `loyalty.service`: ganho, resgate, estornos, ajuste manual, expiração; checkout/status/cron e rotas loyalty |
| Identidade/sessão/papéis | `auth.service`; login/register/reset; `user.service.updateUserRole`; dados de comprador no checkout; guards |
| Frete/configuração | Orchestrator/providers, regras Admin, configuração Loja, token/cotação e checkout |
| Expedição/histórico/indicadores | Status/tracking/confirmação de entrega, histórico/auditoria, customer/dashboard/indicadores financeiros |

## 8. Próximo requisito e critérios de continuidade

O requisito anterior de backup/versão foi atendido pela inspeção read-only e backup protegido em 04/10. WF-03 tem ensaio de clone aprovado; WF-04/WF-05, a base WF-06 e os módulos WF-07/WF-08 foram implementados e ensaiados exclusivamente em ambientes isolados. As 27 migrations ainda não foram aplicadas ao banco persistente.

Próximo pacote: WF-09, lotes, expiração e déficit da fidelidade. Seguir WF-10–WF-20 conforme dependências, retomando os efeitos de LA-002/033 após reservas/lotes/gateway. Não aplicar automaticamente DDL/backfills ao banco persistente. Manter os gates E01–E14; a outbox recebe registros novos, mas ainda não tem consumidor operacional.

**Estado de produção:** não pronto/homologado. Construção e testes locais não substituem os itens ainda abertos, integração financeira externa, saneamento/homologação de WF-18/19 nem operação de WF-20.

## 9. Continuação de 04/10 — clone, WF-04 e início de WF-05

### 9.1. Origem, backup e restauração

- Consulta de metadados/exportação pela conexão direta configurada, com `default_transaction_read_only=on`, timeout e SSL. Nenhum DDL/DML foi enviado à origem. Não foram expostas URLs com senha, credenciais ou registros pessoais no terminal/documentação.
- Origem: PostgreSQL **18.6**, schema público com **23 tabelas** e **7.498 linhas** no snapshot, incluindo 40 registros de migrations. A exportação é consistente; fingerprints/contagens usados para equivalência vieram do snapshot restaurado, sem confundir consultas realizadas em instantes diferentes na origem.
- Duas entradas concluídas para cada migration histórica: todos os checksums conferiram com os 20 artefatos versionados, aceitando LF/CRLF. Não foram apagadas entradas nem usado `migrate resolve`/baseline para fazer o ensaio passar.
- Encontrados **11 índices ausentes** no clone apesar do histórico concluído. A migration nova de 03/10, ainda não aplicada ao persistente, passou a recriá-los com `IF NOT EXISTS`. Os arquivos históricos foram preservados.
- `scripts/verify-restored-clone.mjs`: exportação `pg_dump` custom, AES-256-GCM, chave protegida por DPAPI e ACL exclusiva do usuário Windows. Backup fora do repositório; dados em claro somente na memória/pipeline. Modo `--backup-dir` reutiliza o artefato sem nova conexão à origem.
- Dois restores independentes do backup original comprovaram equivalência de todas as linhas e sequências. Sanitização somente no clone preservou PKs/vínculos/valores/estoque/pontos/status/datas de negócio; campos pessoais, segredos, sessões válidas e referências operáveis de gateway foram neutralizados. Um terceiro restore do backup sanitizado também foi verificado.
- Owners/constraints/enums/defaults/índices foram inventariados. O papel de deploy do clone recebeu ownership equivalente aos objetos da aplicação; papéis, senha e ACL da origem não foram importados. Sentinela permanece pertencendo ao provisionador.
- PostgreSQL alvo major **18**; build também usa 18. O provisionador suporta 16/18 com `PGDATA` explícito em tmpfs. Os ensaios sintéticos/HTTP locais ainda usam default 16; isso não substitui o ensaio do clone no major real.

Evidência privada: `C:\Users\Vmoia\AppData\Local\logic-audit-backups\5f81d9017b05f5313103caccd20470e4\`. `source.dump.enc`, `key.dpapi`, backups sanitizados e `evidence-*.json` permanecem protegidos e fora do Git. O primeiro `evidence.json` registra a tentativa inicial; os arquivos posteriores registram os ensaios aprovados. Logs privados de falhas de restore não devem ser publicados.

SHA-256 do dump original em claro, antes da criptografia: `d7cb6f42998b1d4cd17195a2a0937ec5e3cd99415eb21500bb36465146670fc9`. O hash é conferido depois do unwrap DPAPI/decrypt, e GCM também autentica o artefato. A chave depende desta identidade/máquina Windows: este backup local não é uma política operacional de disaster recovery, nem define RPO/RTO/retention.

Ensaio F0 isolado levou 612 ms para a migration no snapshot. O ensaio posterior aplicou as duas migrations novas, preservou os campos originais e sequências, manteve os 11 CHECKs anteriores e produziu diff vazio; segundo deploy não alterou estado. Depois da sanitização, a comparação do upgrade inclui todos os campos originais, inclusive JSON/campos redigidos, e as sequências incluem `last_value` e `is_called`. Não extrapolar esse tempo para uma janela de produção sem volume/carga/janela atuais.

O uso de ferramentas major 18 segue a compatibilidade de exportação documentada: `pg_dump` não exporta servidor de major superior. [PostgreSQL 18 — pg_dump](https://www.postgresql.org/docs/18/app-pgdump.html). O destino/PGDATA foi conferido na implementação oficial do container. [Docker PostgreSQL — entrypoint](https://github.com/docker-library/postgres/blob/master/docker-entrypoint.sh).

### 9.2. Base comum de WF-04

Implementação e decisões no [documento de contratos comuns](CONTRATOS_COMUNS_CORRECOES_LOGICAS.md). Artefatos: `lib/commerce/contracts.ts`, `gateway.ts`, `locks.ts`, expansão Prisma e migration `20261004000000_commerce_contracts_expansion`.

São 11 tabelas novas, seis enums, campos de revisão/retirada/estoque indisponível/déficit, atores humano/sistema e 14 CHECKs novos. Migrations ensaiadas em banco vazio, upgrade sintético e clone restaurado. Não foram criadas reservas, compradores, fatos ou lotes retroativos; saldo negativo legado não foi escondido por saneamento para permitir uma constraint.

Testes verificam valores/parcelas/base de pontos, exclusão de cartão de snapshots, estados que não podem ser tratados como confirmação, FKs de tenant/variante, deduplicação, estornos parciais, atores válidos, lote não negativo, lease completo e serialização concorrente de revisão. Isso não torna os writers antigos transacionais/recuperáveis automaticamente.

### 9.3. LA-032 e consumidores

`/api/loyalty/simulate` vincula loja ao domínio e pessoa à sessão. ID externo diferente é rejeitado; ID próprio fica compatível com clientes antigos, mas não fornece autoridade. Visitante recebe apenas estimativa genérica de ganho, sem saldo e sem resgate. Serviço confere conta ACTIVE no tenant também para chamadas internas.

Simulação e resumo/extrato próprio consultam carteira com `findUnique`, sem upsert; carteira ausente retorna zero. O resumo pode representar `walletId=null`. GET wallet também exige compatibilidade entre domínio e tenant da sessão. A criação de carteira permanece nos comandos de domínio, e não ocorreu exclusão de carteiras antigas.

Widget não envia userID, solicita wallet sem cache, abandona respostas antigas na troca de loja/revisão, remove desconto quando a simulação falha e orienta login para acumular. Callback usa referência estável, sem acrescentar dependência que faria o pai disparar simulação indefinidamente. Revisão visual/E2E em navegador continua pendente. Essas mudanças não encerram LA-034 de endereço/frete/carrinho global.

### 9.4. Verificações em 04/10

| Verificação | Resultado |
|---|---|
| Prisma generate/validate | Passaram; bloqueio anterior de DLL superado sem matar servidor alheio |
| Unitários | 490 passaram em 64 arquivos |
| Typecheck sem emissão/incremental | Passou |
| Reconstrução/upgrade sintético | 22 migrations, diff vazio, 11 CHECKs históricos e reaplicação sem alteração |
| Clone/restores | Original e sanitizado restauráveis; upgrade preservou dados/sequências, checksums e diff |
| Integração PostgreSQL/HTTP | 19 testes passaram juntos em 4 arquivos: F0 6; modelos/locks 8; identidade/simulação 5. Gate incluído na CI |
| Build Next de produção isolado | Passou, com tipagem e 51 páginas geradas; workspace `.next`/`next-env.d.ts` preservados |
| ESLint dos novos módulos/scripts/testes e lógica de fidelidade | Passou sem erros/avisos nos alvos desta continuação |
| Whitespace | `git diff --check` sem erros; Git informa conversão LF/CRLF pela configuração existente |

CI passou a usar build isolado e incluir modelos/identidade de fidelidade nos ensaios HTTP. Não houve push/execução remota de CI. Dependências não foram atualizadas.

O primeiro ensaio conjunto detectou que `fetch` substituía o Host virtual pelo endereço da URL local, fazendo o GET wallet do teste resolver a loja local. O helper passou a usar HTTP nativo para Host explícito, conservando o destino de rede loopback e o handshake obrigatório. O teste confere a loja efetivamente resolvida por `/api/loja/active` antes da recusa de sessão cruzada. Três testes unitários reais do transporte comprovam Host preservado, redirect externo recusado e handshake divergente bloqueando POST. Não foi relaxado o controle da aplicação para fazer o teste passar.

**Limites em 04/10:** naquela entrega havia 34 findings sem implementação principal, e comprador convidado/status ainda aguardavam migração. A continuação abaixo registra o avanço posterior. Não foram realizados testes externos Asaas/Correios/ERP, carga completa, recuperação operacional fora desta máquina, saneamento de legados, rollout ou observação de produção. O executor de backup tem limite de 256 MiB em memória e escopo public, não importa roles/ACL globais e não substitui backup operacional completo. Geração de Client com schema expandido exige migrations correspondentes antes de executar código novo contra banco persistente.

## 10. Continuação de 05/10 — WF-05 e base transacional de WF-06

### 10.1. Escopo e preservação do ambiente

O trabalho continuou com a autorização existente. Foram relidos workflow/propostas/código e guias locais do Next instalado. Nenhuma correção foi aplicada ao banco configurado em `.env`. As migrations de construção foram aplicadas somente em PostgreSQL descartável e no clone do backup protegido de 04/10. Esse clone foi reutilizado sem abrir conexão à origem. Não houve envio externo de email, chamada financeira real, commit, alteração de dependências ou deploy.

Docker Desktop estava parado; o aplicativo instalado foi iniciado em segundo plano para provisionar os ambientes descartáveis. Somente containers identificados pela execução foram descartados. O servidor de build/teste continua em cópia temporária sem `.env` do projeto. API keys externas ficam vazias; a credencial de recebimento de webhook é aleatória e exclusiva do ambiente descartável, para testar o handler por HTTP local. Não corresponde à credencial de produção.

### 10.2. WF-05 / LA-014 — contexto e vínculos da compra

- `lib/commerce/account-scope.ts`: conta existente, ACTIVE e pertencente à loja; contexto externo não substitui o sujeito autenticado. Serviços diretos também validam o escopo.
- `Cart`/`CartItem` receberam `lojaID` obrigatório; FKs compostas vinculam cart/conta/loja, item/cart/loja, item/produto/loja e variante/produto. Pedido/titular usa relação composta de tenant.
- `20261005000000_purchase_tenant_scope`: bloqueia tabelas antes da auditoria/backfill, rejeita vínculos misturados e endereços alheios; não transfere dados para satisfazer constraints. Ensaio sintético criou contaminação permitida pelo schema antigo, comprovou recusa antes de adicionar coluna/backfill e preservação do estado anterior.
- `cart.service.ts`: quantidades inteiras de 1 a 99, variante pertencente ao produto, disponibilidade e estoque relidos sob locks; não cria variante durante a compra. Valida carrinho ACTIVE e próprio; múltiplos ativos ambíguos são recusados até WF-08.
- `InventoryService`: exige loja e valida o lote inteiro antes da primeira reserva; writes filtram produto/loja e variante/produto. Restituição não engole falha de vínculo: erro propaga e reverte a transação.
- `/api/cart`, `/api/orders`, checkout, detalhe/status e Admin Orders verificam tenant/contexto. Administração usa guard de loja; fallback de loja do body/sessão não autoriza domínio desconhecido.
- `createOrderFromCart` valida conta, carrinho, item e endereço na transação, bloqueia/rele o carrinho antes de consumi-lo; duas chamadas simultâneas deste caminho não criam dois pedidos. Isso não encerra LA-015/017: unicidade de ativo, revisão e convergência com intenção canônica continuam em WF-08/13.

Evidência: sete cenários reais em `purchase-tenant-scope.test.ts`, incluindo serviços diretos, FKs, HTTP entre lojas, endereço alheio, validação de inventário e consumo concorrente. Nenhuma concessão à validação da aplicação foi introduzida para os mocks antigos; testes foram adaptados às releituras reais.

### 10.3. WF-05 / LA-020 — comprador convidado separado

- `20261005010000_separate_guest_buyer`: permite `Order.userID=null` e exige titular ou comprador. Mantém pedidos antigos e seus vínculos; não vincula novos pedidos pela coincidência de email.
- `order-buyer.ts`: dados declarados limitados e snapshot de comprador/endereço; seleção segura para consumidores; token aleatório de 32 bytes, hash SHA-256, comparação constante e expiração de sete dias.
- Checkout grava `OrderBuyer` por compra. Sem sessão, não busca/cria/atualiza User por email, não altera CPF/telefone/endereço/carteira e não resgata/acumula pontos de conta. Com sessão, valida titular/tenant/estado e grava vínculo sem atualizar o perfil.
- Endereços de novas compras ficam no snapshot; não são inseridos no cadastro de outra pessoa nem salvos automaticamente no perfil autenticado. Pedidos legados continuam lendo Address quando existente.
- `/api/orders/[id]/recovery` exige token específico no header e tenant. Status/polling exige titular/Admin da loja ou credencial do convidado. DTO e cache `no-store` não entregam token/hash/identidade de conta; conhecer ID/email não concede acesso.
- Checkout/confirmacão guardam a credencial retornada no `sessionStorage` e enviam o header no polling. Admin, dashboard, fidelidade, auditoria e template de email aceitam titular opcional e snapshot; envelope de detalhe Admin é extraído antes de atualizar o drawer.
- O teste real detectou uma escrita nested incompatível do Prisma para item com variante: substituição pelo vínculo nested de `variant` permitiu persistir o pedido com as relações corretas. A resolução canônica dos itens continua em LA-001/WF-13.

Evidência: oito testes em `guest-buyer-identity.test.ts`, com sessão/cookies reais e controle de perfil/carteira/endereços/ledger antes e depois, token errado/outra compra/outro tenant/vencido, replay sem autorização, DTO Admin e transições de convidado. Três testes unitários adicionais verificam token, snapshot e fallback legado.

**Limites:** não há renovação/reemissão de credencial de convidado nem recuperação permanente por email implementada. Perda da primeira resposta antes de obter o token exige intenção/identidade anônima anterior à compra em WF-13; não será resolvida permitindo replay por email. `sessionStorage` não sobrevive a todo cenário de perda/troca de navegador. A confirmação completa, reload, navegação visual e notificações externas ainda precisam de WF-15/19. Valores/prazos do gateway não foram homologados.

### 10.4. WF-06 / LA-002/027/033 — comando transacional

`lib/commerce/order-command.ts` passou a concentrar transições; `order.service.updateOrderStatus`, o adapter Admin e a confirmação do titular convergem para ele. Writers conhecidos de status em webhook/simulador/checkout/timeout chamam esse serviço. Campos financeiros/metadados externos desses caminhos ainda aguardam WF-14.

Protocolo ensaiado:

1. Validar formato de comando/status/revisão e adquirir lock do pedido.
2. Reler pedido e validar tenant, ator, titular, estado e modalidade dentro da transação. Papel/estado do humano são consultados no banco; prefixo SYSTEM inventado não dá privilégio. Confirmação de recebimento exige titular, mesmo quando o ator também é Admin.
3. Verificar recibo da identidade escopada de comando e hash de conteúdo; replay compatível retorna o estado atual, uso incompatível retorna conflito. Revisão esperada obsoleta também retorna conflito.
4. Executar restituição/ledger pela mesma TransactionClient quando aplicável; aprovação não decrementa estoque já reservado.
5. Gravar status com predicado de versão e incremento, AuditLog, OrderStatusHistory e CommerceOutbox no mesmo commit. Mesmo status/replay não repete efeitos.

`20261005020000_order_command_receipts` adiciona hash de conteúdo e versão ao histórico, CHECKs de coerência/versão positiva e unicidade pedido/versão. Registros históricos anteriores ficam com versão nula; não foram reconstruídos artificialmente. Leitura Admin ordena versão/data/ID e mostra autor humano ou código de sistema. As rotas Admin e alternativa aceitam commandId/expectedVersion e constroem o ator pela sessão; o body não pode escolher SYSTEM.

O alerta existente de pagamento em pedido CANCELLED deixou de usar `actorId='ASAAS_GATEWAY'` e `targetId=order.id`. Agora usa ator SYSTEM, User afetado real ou null, entidade Order separada e transação para auditoria/notas, preservando notas anteriores. HTTP local comprovou escrita com FKs válidas e reentrega do mesmo evento. **Ainda não registra FinancialFact nem implementa inbox/consumidor/reconciliação de WF-14**, portanto LA-033 permanece parcial.

Evidência: 13 testes em `order-transition-atomicity.test.ts`:

- duas aprovações e dois cancelamentos simultâneos, com um efeito de estoque/ledger/histórico;
- cancelamento pago repetido com saldo e lifetimeEarn preservados;
- PAID×CANCELLED da mesma revisão: um vencedor e conflito do perdedor;
- falhas reais por constraint de unicidade em auditoria, histórico e outbox depois dos efeitos, revertendo status, estoque e/ou carteira/ledger;
- constraints de recibo/versão, conteúdo diferente com mesma chave, atores inválidos e propagação da falha pelo adapter legado;
- confirmação do titular, endpoint Admin com conflito e webhook de pagamento tardio local.

**Limites:** idempotência dos efeitos está protegida pelo comando/versão do pedido nos cenários atuais; serviços de carteira chamados isoladamente, lotes, reserva com procedência, retirada de variante e callbacks financeiros completos continuam pendentes. O consumidor da outbox não existe: registros READY não são notificações entregues. A invalidação imediata de cache é best effort; recuperação após processo morto depende de WF-14. Aprovação tardia, cancelamento financeiro e vencimento ainda precisam da máquina financeira e política específicas.

### 10.5. Verificações da continuação

| Verificação | Resultado local de 05/10 |
|---|---|
| Prisma Client | Gerado com o schema atual, sem atualização de dependências |
| Unitários | **495 passaram em 65 arquivos** |
| TypeScript | `tsc --noEmit --incremental false` passou |
| Integração PostgreSQL/HTTP | **47 passaram juntos em sete arquivos**: 19 anteriores, sete de tenant, oito de comprador e 13 de transição |
| Histórico vazio/upgrade sintético | **25 migrations**, diff vazio, 11 CHECKs históricos preservados, reaplicação sem alterações; cenário contaminado bloqueado sem backfill parcial |
| Clone do backup de 04/10 | Restores original/sanitizado conferidos; 25 migrations aplicadas no clone, colunas originais e sequências preservadas, checksums históricos e diff aprovados; nenhuma nova conexão à origem |
| Build de produção isolado | Passou com compilação/tipagem e 51 páginas; `.next` e `next-env.d.ts` do workspace preservados |
| ESLint direcionado | Sem erros; dois avisos preexistentes nos alvos amplos: `<img>` na confirmação e função declarada após hook na página inicial de checkout. Últimos módulos/rotas/testes alterados passaram sem avisos |
| CI | Gate de integração inclui os sete arquivos; não houve push nem execução remota de CI |

Os primeiros ensaios identificaram mocks antigos sem lock/ator/outbox e uma expectativa incorreta sobre como o Prisma 5.22 apresenta CHECK PostgreSQL. Os testes finais validam a constraint pelo nome efetivo e verificam ausência de efeitos. Não foi relaxada constraint/validação da aplicação para fazer teste passar.

### 10.6. Pendências para a sequência

WF-07/WF-08 foram construídos na continuação abaixo. Continuar por **WF-09** (lotes/expiração/déficit) e **WF-10** (recuperação/papéis concorrentes). Depois cumprir frete/capacidade/planos, intenção/replay canônicos, pipeline financeiro durável, frontend/expedição/indicadores e gates de dados/homologação/rollout.

Os códigos já modificados exigem as migrations correspondentes antes de serem executados contra banco persistente; não foi feito `db push`, reset ou DDL de origem. O backup usado no ensaio representa 04/10, não um backup atualizado para implantação. Carga, providers reais, observabilidade/supervisão do worker, revisão humana, DR operacional e observação de produção continuam abertos. O projeto **ainda não está pronto para produção**.

## 11. Continuação de 05/10 — WF-07 / LA-018/019

**Estado:** IMPLEMENTADO NO MÓDULO, com integração local de serviço/HTTP/PostgreSQL. O aceite do candidato completo e a homologação operacional permanecem abertos.

### 11.1. Catálogo e disponibilidade

- `20261005030000_catalog_revision`: adiciona revisão independente de catálogo e CHECK não negativo; não interpreta estoque zero legado como retirada.
- `product.service.updateProduct` bloqueia o produto e relê catálogo/variantes dentro da transação. Payload com variantes exige `expectedCatalogVersion`; snapshot obsoleto retorna conflito. Metadados não escrevem `Product.stock` nem estoque de variantes existentes. Novas variantes de uma edição começam em zero; o cadastro inicial continua admitindo quantidades iniciais declaradas e auditadas.
- IDs são reconciliados por posse/combinação normalizada. Variante retirada não é reativada implicitamente por formulário antigo, nem recriada com outra identidade. Uma duplicata legada já retirada não impede editar a combinação ativa existente; reativá-la enquanto existe combinação ativa conflitante é recusado.
- A retirada grava `retiredAt`, transfere disponibilidade para `unavailableStock`, incrementa revisão e registra quantidades anteriores/destino na auditoria de catálogo. Exclusão física exige ausência de vínculos de carrinho/pedido/reserva e ausência de quantidade indisponível. Quantidade física sem vínculo também é preservada para revisão operacional.
- Vitrine/resolução compartilhada excluem retiradas; carrinho, checkout e reserva recusam produto/variante retirados. Omitir a variante não permite comprar unidades retiradas nem contornar dimensões distintas. Isso não encerra resolução/quantidade/aceite canônicos de LA-001/WF-13.

### 11.2. Estoque intencional e restituição

`POST /api/products/[id]/inventory` usa sessão/tenant/ADMIN ACTIVE verificados no servidor e comando estrito. Não aceita ator escolhido pelo corpo. Oferece contagem absoluta, delta e reativação explícita com quantidade/motivo; contagem e reativação exigem revisão. O comando adquire produto → variante, relê estado/versão e grava ajuste/revisão/auditoria no mesmo commit.

`AuditLog.effectKey` contém recibo escopado por loja/produto/commandId. Hash de ator/conteúdo distingue replay de reutilização incompatível. Retry devolve o estado atual sem mover estoque novamente. Falha da auditoria reverte também quantidade/revisão. Reativação recusa combinação ativa conflitante e incrementa revisão de catálogo para invalidar formulários que poderiam retirar novamente a variante recém-reativada.

`InventoryService` incrementa revisões em reservas e restituições e compartilha locks com Admin. Cancelar pedido com produto/variante retirados devolve unidade para indisponível, preservando o vínculo; não incrementa disponibilidade do pai nem da variante. O destino é registrado na auditoria transacional do comando de pedido. Pedido repetido continua sem repetir a restituição.

**D02:** pai e variante conservam limites independentes. Exemplo ensaiado: pai10/variante5 → compra1 → pai9/variante4 → retirada → variante indisponível4 → cancelamento → pai disponível9/indisponível1 e variante disponível0/indisponível5. Não somar indisponíveis de pai/filho como unidades diferentes. Reativação explicitamente contada da variante não altera automaticamente o limite geral do produto; quantidade remanescente indisponível não é descartada por inferência. Conferência física é declaração administrativa auditada, não integração homologada com armazém.

### 11.3. Admin, scripts e testes

O formulário conserva ID persistido separado de `_formKey`, envia revisão de catálogo e não reenvia o saldo geral antigo; quantidades das variantes do payload de edição não são comandos de estoque. `InventoryPanel` mantém rascunho/comando de estoque separado e apresenta conflitos. Após perda de resposta, até atualizar a consulta mantém a requisição original/commandId/revisão para retry do mesmo ajuste. Após sucesso confirmado, eventual falha da consulta seguinte é apresentada como falha de atualização da consulta, sem transformar o ajuste confirmado em resultado incerto.

Escritores mapeados: cadastro/reconciliação de produto, comando Admin, reserva/restituição compartilhadas pelos dois caminhos de compra e pelo comando de status. `ensure-default-variants.ts` foi convertido em auditoria somente leitura. `repair-product-variants.mjs --apply` permanece bloqueado até procedimento WF-18 compatível com revisões/retiradas/reservas; o helper histórico também recusa modelos novos antes de qualquer alteração. Nenhum saneamento foi aplicado ao banco persistente, nem quantidades duplicadas somadas automaticamente.

Evidência: **13 testes PostgreSQL/HTTP** em `inventory-admin-integrity.test.ts`: revisão negativa recusada no banco; formulário aberto10/venda9/edição mantém9; nova variante zero; retirada×cancelamento sem revenda; preservação de IDs em carrinho/pedido; exclusão apenas vazia e sem vínculos; reativação/duplicata/conflito; duas contagens da mesma revisão com um vencedor; deltas/replay; rollback após falha real da auditoria; tenant/ator/parentesco e endpoints; retirada×compra concorrentes. Testes unitários cobrem retry após consulta atualizada, validação, seleção retirada, payload real do Admin e preservação de rascunho no conflito.

**Ainda pendente:** reservas persistidas com procedência em WF-13, auditoria/saneamento dos legados em WF-18, políticas/lotes de WF-09 e homologação em navegador/candidato de WF-15/19. Não foi criada reserva retroativa nem backfill de retirada. Não houve validação de estoque físico real ou ERP externo.

## 12. Continuação de 05/10 — WF-08 / LA-017

**Estado:** IMPLEMENTADO NO MÓDULO; sincronização do cliente e intenção canônica continuam em WF-13/15/19.

### 12.1. Persistência, serialização e contrato

- `20261005040000_cart_active_uniqueness` bloqueia Cart durante verificação e impõe índice SQL único parcial de ACTIVE por loja/usuário. Duplicidades preexistentes abortam com instrução de auditoria/backup, sem escolher, mesclar, abandonar ou excluir carrinhos automaticamente. O datamodel Prisma não representa esse índice; verificação SQL própria foi incluída.
- `CommerceLocks.acquireCartOwner` usa advisory lock transacional de rank15, após intenção/rank10 e antes de carrinho/rank20. Protege a criação quando ainda não existe linha. Leituras/mutações e consumo alternativo convergem para escopo → carrinho → produtos → variantes. O índice protege também escritores fora do protocolo.
- Colisão de criação `P2002` do índice/colunas de ativo provoca no máximo uma tentativa nova, após rollback integral. Autorização e leituras são repetidas; nunca se continua usando a transação SQL abortada. Outras violações de unicidade não são confundidas com colisão de ativo.
- Cada mutação e recibo em AuditLog são gravados no mesmo commit. Identidade é escopada por loja/usuário/commandId; hash contém operação, alvo, revisão declarada e parâmetros. Conteúdo incompatível conflita. Adição distinta acumula sob lock; retry não soma novamente. Absoluto/remoção exigem carrinho e revisão. Cada escrita aceita incrementa versão uma vez. O limite geral do produto considera a demanda somada das diferentes variantes desse produto no carrinho, sem sobrescrever seus estoques independentes.
- A resposta é o snapshot obtido sob o mesmo lock/transação da mutação, sem segundo `getCart` que poderia responder por outro carrinho/revisão. GET também protege a leitura do carrinho. Replay consulta o carrinho originalmente vinculado ao recibo, inclusive depois de COMPLETED; não reaplica a mutação num carrinho posterior.
- Consumo em `createOrderFromCart` também usa lock de escopo/carrinho e incrementa revisão quando muda para COMPLETED. Isso não unifica os caminhos de checkout nem substitui os requisitos de LA-015/WF-13.

Contrato público atual, com autenticação/tenant no servidor:

| Operação | Campos exigidos além do item | Resultado |
|---|---|---|
| POST incremento | `commandId`; `cartId` opcional; revisão opcional somente com cartId | Snapshot com id/status/version/replay; primeiro aceite201, replay200 |
| PATCH quantidade absoluta | `commandId`, `cartId`, `expectedVersion` | Snapshot200 ou conflito409; quantidade inteira de 1 a 99 |
| DELETE remoção | `commandId`, `cartId`, `expectedVersion`, `variantID`, no corpo ou query | Snapshot200; retry compatível aceita ausência posterior do item |
| GET | Sessão da loja | Snapshot atual; se inexistente, id/version nulos e items vazio |

Campos externos não autorizados são recusados; respostas têm `Cache-Control: no-store`. Payloads antigos sem identidade/revisão recebem400, sem fallback que repetiria efeitos. Um replay de carrinho consumido devolve seu status real; consumidores não devem tratá-lo como carrinho ACTIVE novo. Estado do frontend local/Zustand ainda não foi migrado para sincronização persistida; adaptar/validar consumidores conhecidos antes do rollout conjunto. Contrato novo não significa LA-016 concluído.

### 12.2. Evidências e limites

**12 testes reais** em `cart-mutation-atomicity.test.ts`: criação inicial concorrente; mesmo comando simultâneo; qty1 + dois incrementos =3/retry mantém3; contagens da mesma revisão com um vencedor; remoção/replay/PATCH obsoleto; teto99 sob concorrência; demanda de variantes distintas dentro do limite geral do produto; mutação×consumo e replay contra carrinho anterior; rollback real após falha de auditoria; índice parcial e coexistência de carrinhos encerrados; ordem de locks; contrato HTTP com versões, campos antigos e conflitos. Fixtures anteriores foram adaptadas à identidade/revisão explícitas, sem relaxar guarda de tenant/estoque. Unitários verificam recuperação controlada de colisão, limite de tentativas e ausência de retry para outro índice.

O ensaio sintético de migrations reproduziu duplicatas ACTIVE antes do índice: a migration abortou, manteve ambos os carrinhos/versões e não criou índice parcial. Depois de resolução **explícita somente da fixture**, a migration/índice passaram. Não existe escolha automática de resolução de dados reais nesta entrega. O clone sanitizado do backup passou no índice, mas representa 04/10; preflight atual e auditoria dos carrinhos no momento da implantação continuam obrigatórios.

## 13. Verificações consolidadas desta continuação e próxima etapa

| Verificação | Resultado local de 05/10 |
|---|---|
| Unitários | **504 passaram, 66 arquivos** |
| Integração PostgreSQL/HTTP | **72 passaram juntos em nove arquivos**, incluindo 13 de estoque e 12 de carrinho; execução final inclui a fixture de vínculo com carrinho e limite agregado entre variantes |
| TypeScript | `tsc --noEmit --incremental false` passou após as alterações finais de tipos/fixtures |
| ESLint direcionado | Sem erros/avisos nos módulos, rotas, Admin, scripts e testes desta continuação |
| Migrations | **27 migrations**, banco vazio e upgrade sintético aprovados; diff vazio, CHECKs históricos e índice parcial conferidos; guards de contaminação/duplicatas e reaplicação aprovados |
| Clone | Backup protegido de 04/10 reutilizado; duas restaurações conferidas, upgrade das 27 migrations, colunas originais/sequências/checksums/diff/reaplicação aprovados; sem nova conexão à origem |
| Build isolado | Compilação/tipagem e 51 páginas aprovadas após os ajustes finais; `.next`/`next-env.d.ts` do workspace preservados |
| CI | Seleção de integração ampliada para os nove arquivos; nenhum push/job remoto disparado |

Os testes de falha criam/removem constraints temporárias limitadas à fixture no banco descartável verificado pela sentinela. Não alteram schema/configuração de banco persistente. As falhas intermediárias foram divergências de expectativa/nome de evento ou montagem de mocks/fixtures; foram corrigidas e reexecutadas sem remover validação/constraint da aplicação.

**Próxima etapa:** WF-09, lotes/expiração/déficit; depois WF-10–WF-20 e integração dos efeitos pendentes de LA-002/033. Dez LA têm módulo/integração local ensaiados, dois permanecem parciais e 26 aguardam implementação principal. Nenhum foi validado no candidato completo ou encerrado em produção. O projeto continua **não pronto para produção**; migrations no banco persistente, homologação externa, saneamento atual, revisão operacional e rollout permanecem pendentes.

## 14. Continuação de 05/10 — WF-09 / LA-021/022

**Estado:** IMPLEMENTADO NO MÓDULO, com ensaios de serviço/HTTP/PostgreSQL. As afirmações ao final da seção 13 descrevem o checkpoint anterior; a próxima etapa de construção agora é **WF-10**. O aceite integrado/operacional e a ativação de legado continuam pendentes.

### 14.1. Política de construção e persistência

- Política versionada `lots-fefo-debt-v1`, derivada de D05 e da proposta: ganho conserva o prazo configurado no momento do crédito; consumo FEFO, desempate por criação/ID, sem expiração por último. Ajustes positivos sem prazo declarado não expiram. Ajuste com prazo exige data futura explícita; ajuste negativo não escolhe prazo.
- Devolução referencia cada alocação original. Prazo ainda válido é preservado, inclusive ausência de prazo. Crédito devolvido após vencer gera **novo lote compensatório** com prazo da configuração vigente no instante da devolução, registrado no ledger (`expiredReturnTermDays`, `returnedAt`); configuração null significa compensação explicitamente não expirante. O lote/prazo original nunca é reaberto/reescrito. Não foi escolhido um número de dias externo à configuração existente da loja.
- Ganho cancelado já consumido vira `LoyaltyWallet.debt`, separado do disponível. Remanescentes dessa origem, inclusive descendentes de restituições, são removidos antes de formar obrigação. Outros créditos disponíveis compensam a obrigação; futuros créditos abatem o déficit antes de disponibilizar pontos. Crédito já efetivamente expirado não é cobrado novamente no cancelamento. `lifetimeEarn` conserva a regra anterior de ganhos creditados menos ganhos estornados; não foi convertido em acumulador bruto.
- `20261005050000_loyalty_lot_accounting` é expansão: adiciona `accountingReady`, lease de expiração, origem dos lotes e campos do efeito no ledger. Cada movimento novo registra `availableDelta`, `debtDelta`, `debtAfter`, hash/conteúdo e política. CHECK verifica `points = availableDelta - debtDelta`, completude do efeito e saldo pronto não negativo; disponível positivo e déficit positivo não coexistem.
- **Sem backfill de origem ou saldo.** Todas as carteiras preexistentes ficam não prontas, inclusive zero; saldos negativos permanecem identificáveis, sem clamp no banco. Carteira criada pelo protocolo novo começa pronta apenas quando não há ledger histórico desconhecido. A policy de construção e a compensação precisam da revisão operacional prevista em WF-19/20 antes de ativação; este registro não é homologação comercial externa.

### 14.2. Escritores, locks e repetição

`lib/commerce/loyalty-ledger.ts` concentra ganho, resgate, ajuste, restituição e expiração. Autorização/parentesco são conferidos; comandos de pedido independentes bloqueiam pedido antes de carteira/lotes. Chamadores dentro de uma transação devem já possuir o pedido ou tê-lo acabado de criar. Ganho exige pedido PAID; novo resgate exige PENDING e conta ACTIVE; ajuste exige ADMIN ACTIVE e alvo ACTIVE na mesma loja. Não há chamada externa mantendo locks.

Criação de carteira usa INSERT com ON CONFLICT; depois ocorre lock/releitura da carteira e de todos os lotes em ordem estável. Saldo/debt, lotes, alocações, ledger e revisão pertencem ao mesmo commit. Ganho/resgate deduplicam por operação/pedido/escopo; restituição deduplica por transação original; ajuste exige `commandId` e distingue conteúdo incompatível. Retry retorna estado atual sem repetir movimento. A conciliação somente leitura `reconcileLoyaltyWallet` confere remanescentes e somas de deltas de disponível/déficit com a carteira pronta; não ativa nem repara carteira.

Toda expiração lê prazo/remanescente **depois do lock**, escreve efeito único por lote, aloca a baixa e zera o remanescente. O parâmetro antigo `points` de `expireUserPoints` é apenas compatibilidade ignorada: não autoriza descontar quantidade externa. Estimativa de expiração consulta lotes demonstrados; não reconstrói créditos a partir de EARN nem classifica saldo desconhecido como vencido.

O job pagina candidatos de 100 carteiras, obtém lease persistido por carteira de 60 segundos e recalcula na transação. Lease vencido é retomável; liberação tem predicado de proprietário. Sem heartbeat, execução longa pode perder exclusividade do lease; locks/recibos continuam garantindo correção mesmo com execução duplicada. Falhas deixam remanescentes elegíveis para próxima invocação. O cron retorna503 com `success=false` em falha parcial e registra contagens/códigos, sem transformar falha em sucesso. A resposta informa carteiras legadas preservadas. Agendamento, alertas, supervisão, carga e orçamento de tempo continuam em WF-19/20.

### 14.3. Legados e consumidores

Carteiras não conciliadas não entram na expiração e recusam resgate/ajuste. Saldo histórico permanece consultável e é sinalizado como aguardando conferência. Ganho/estorno ligados a legado geram `LOYALTY_RECONCILE_EARN`/`LOYALTY_RECONCILE_REFUND` em CommerceOutbox, com identidade por operação/pedido e dados necessários à análise, na mesma transação do comando. Cancelamento conserva restituição de estoque e seu commit sem fabricar saldo/origem de fidelidade. Esses registros representam **pendência**, não benefício creditado, estorno de pontos concluído ou reembolso financeiro externo realizado. O consumidor de WF-14 e a conciliação de WF-18 ainda devem ser construídos e homologados; ganhos pendentes de pedidos posteriormente cancelados não podem ser creditados por consulta obsoleta.

DTO da carteira/extrato inclui déficit e estado de conciliação. Checkout sinaliza conferência pendente e déficit sem oferecer saldo legado como resgatável; simulação desconta remanescentes comprovadamente vencidos da estimativa, sem realizar escrita. Comando definitivo valida novamente sob lock. As duas telas de ajuste Admin enviam identidade explícita e conservam a mesma identidade no retry após resultado incerto, enquanto o rascunho é igual. Novo ajuste após sucesso ou mudança intencional usa nova identidade. Esta preservação está em memória do componente: recuperação após desmontagem/reload, múltiplas abas e QA em navegador continuam em WF-15/19. Não declarar a persistência do cliente homologada pelo teste do helper.

### 14.4. Evidências desta continuação

| Verificação | Resultado local |
|---|---|
| Unitários | **507 passaram, 67 arquivos**; substituída reconstrução incorreta por testes de origem/estimativa e política; concorrência/rollback contábil verificados no PostgreSQL real |
| Integração conjunta | **89 passaram, dez arquivos**, incluindo **17** de fidelidade; regressão dos nove módulos anteriores preservada |
| Cenários WF-09 | Ajuste100 sem EARN; FEFO parcial; duas expirações150→50; criação/replay concorrentes; double-spending; expiração×resgate; falha real do ledger/rollback; cancelamento após gasto/déficit/compensação futura; crédito já expirado; restituição antes/depois do prazo e descendentes; retomada de lease; legado; CHECKs; replay de ganho após mudança/desativação da política e ganho legado pendente; HTTP com sessão real/tenant/ator/identidade |
| TypeScript e ESLint | `tsc --noEmit --incremental false` passou; lint direcionado dos módulos/rotas/consumidores/scripts/testes novos sem erros/avisos |
| Migrations | **28 migrations**, diff vazio, CHECKs históricos e três CHECKs novos conferidos, reaplicação sem alterações; upgrade sintético preservou carteiras positivas/negativas e ledger sem inferir lotes/ativação |
| Clone do backup protegido | Restores original/sanitizado conferidos, upgrade/diff/colunas originais/sequências/checksums aprovados; constraints novas presentes e nenhuma carteira histórica ativada; sem nova conexão à origem |
| Build isolado | Passou compilação/tipagem e geração de 51 páginas; `.next`/`next-env.d.ts` do workspace preservados |
| CI | Seleção ampliada para dez arquivos; nenhum push/job remoto disparado |

Falhas intermediárias: fixtures usavam header fictício de identidade (substituído por sessão real); ALTER parametrizado não é aceito pelo Prisma (DDL de teste passou a usar somente UUID/identificador gerados pela própria fixture verificada); testes antigos reconstruíam EARN ou simulavam concorrência em mock; uma regressão no contador vitalício foi corrigida preservando a semântica anterior. Validações/constraints da aplicação não foram removidas para fazer testes passar. Nenhum DDL/teste foi executado no banco persistente.

### 14.5. Próximos requisitos

Seguir com **WF-10 / LA-028/029**, consumo atômico do token de recuperação e existência de administrador ativo sob concorrência. Depois WF-11–WF-20 e conclusão das dependências de LA-002/033. O estado atual é **12 LA com módulo/integração local, dois parciais e 24 sem implementação principal**. Nenhum LA foi validado em WF-19 ou encerrado em produção.

Não liberar fidelidade no banco existente apenas aplicando esta expansão: faltam auditoria/ativação explícitas das carteiras, consumo/reconciliação das pendências, homologação de política/UX e rollout conjunto. O backup utilizado representa 04/10; preflight/backup atuais, ambiente externo, DR operacional e observação de produção continuam pendentes. O projeto **ainda não está pronto para produção**.

## 15. Continuação de 05/10 — WF-10 / LA-028/029

**Estado:** IMPLEMENTADO NO MÓDULO, com ensaios reais de PostgreSQL/HTTP. A seção 14 descreve o checkpoint anterior; a próxima etapa principal agora é **WF-11**. Este pacote não declara prontidão para produção nem execução de recuperação/migration no banco persistente.

### 15.1. Recuperação e compatibilidade

- Bearer mantém 32 bytes/256 bits, hex de 64 caracteres, e uma hora de validade. Banco guarda somente `h1:SHA256(bearer)`; o digest não é aceito como bearer. Leitura inicial usa loja/status ACTIVE/digest/prazo e recusa ambiguidade, sem escolher uma conta arbitrária.
- Emissão bloqueia User antes de calcular prazo no relógio do banco e revalida elegibilidade/tenant no UPDATE. Bloqueio entre leitura e escrita impede emissão/envio. Email ocorre depois do commit, fora de locks/transações.
- Reset calcula bcrypt fora da transação; dentro dela bloqueia User e depois executa UPDATE condicional por ID, loja, status ACTIVE, mesmo digest e deadline maior que `clock_timestamp()`. Exige exatamente uma linha. Password/limpeza do token e revogação das sessões pertencem ao mesmo commit; falha reverte tudo.
- Lock explícito antes do UPDATE cobre também espera em SELECT FOR UPDATE sem mudança da tupla. Não basta presumir reavaliação pelo mecanismo de concurrent UPDATE. Teste real mantém esse lock, espera o prazo vencer no relógio do banco e confirma rejeição sem mudar senha/sessões.
- Rota resolve a loja pelo contexto servidor; body não escolhe tenant. Token inválido/legado/expirado/consumido/conta bloqueada recebe erro genérico instruindo solicitar novo link. `20261005060000_password_reset_lookup` adiciona só índice loja/token, sem backfill de passwords/tokens/deadlines.
- **Links plaintext preexistentes ficam inválidos no código novo**, inclusive hex de 64 caracteres; solicitar reemissão pelo domínio correto. Não há fallback inseguro. Aplicar DDL não converte links antigos; código antigo também não pode autenticar os novos digests.

### 15.2. Emissão de sessão

A inspeção do caminho alternativo identificou login que verifica senha antiga e cria sessão depois do reset. `issueAuthenticatedSession` compara bcrypt fora do lock, adquire User e relê password/status/loja antes de inserir Session. Mudança do hash recusa a emissão. Se login ganhou, reset serializado revoga a sessão; se reset ganhou, a sessão antiga não nasce depois dele. Login/cadastro passam senha/loja pelo fluxo interno, sem senha/hash nos DTOs.

Substituição da sessão anterior e criação da nova pertencem à mesma transação; falha não é ignorada como sessão inexistente. Cookie é escrito após commit, preservando flags e prazo de sete dias. Nova comparação bcrypt tem custo ainda a medir em WF-19. Interrupção HTTP depois do commit pode deixar sessão órfã até expirar; ausência de cookie não confirma login no cliente. Navegador, cache por requisição e operações administrativas em curso ainda exigem gate integrado.

### 15.3. Elegibilidade e escritores

`changeUserEligibility` valida ROLE/STATUS e serializa Loja → User ordenados por ID. Loja pré-lida é apenas pista; ator/alvo são relidos sob locks. Ator deve continuar ADMIN ACTIVE na mesma loja do alvo. Autopapel/autobloqueio são recusados. Redução de elegibilidade conta apenas ADMIN ACTIVE depois dos locks.

Mudança, auditoria USER com antes/depois e revogação de sessões pertencem ao mesmo commit. Bloqueio também limpa token/deadline. Só comando aceito gera auditoria de sucesso; falha da auditoria reverte papel/status/tokens/sessões. Rota de papel exige concordância sessão/host e rejeita campos extras no payload.

| Escritor/caminho conferido | Resultado |
|---|---|
| Rota Admin de papel | Comando comum, ator/tenant/status relidos sob locks |
| Adapter interno de bloqueio/desbloqueio | Mesmo comando; nenhuma nova rota pública |
| Exclusão/transferência de User | Não há rotas/writers operacionais; tipos DELETE/TRANSFER recusados, preservando FKs. Implementação futura exige protocolo comum e definição de todos os vínculos |
| Cadastro | Cria CUSTOMER ACTIVE; não promove/transfere/rebaixa administrador existente |
| Perfil/avatar/endereço | Whitelists de nome/contato/avatar/endereço; não escrevem role/status/lojaID |
| create_test_admin.ts | Desabilitado sem conexão; removidas credenciais fixas/promoção arbitrária/saída de senha. Termina código 1 orientando fixtures/recuperação |
| Fixtures/restores/saneamento do clone | Escopos isolados já verificados; não são rotinas operacionais |

Loja legada sem ADMIN ACTIVE não é autopromovida. O [runbook de recuperação administrativa](RECUPERACAO_ADMINISTRATIVA_WF10.md) exige identidade/autorização fora da aplicação, operador/revisor, conta/loja aprovadas, backup, mesmo lock de loja, auditoria SYSTEM e revogação atômicas. Escolha/ensaio de IAM/MFA, recuperação e revisão operacional ainda são gates WF-18/19/20; nenhum procedimento foi executado na origem. Exclusão/transferência não foram implementadas/homologadas como novas funcionalidades por serem recusadas.

### 15.4. Evidências finais

| Verificação | Resultado local |
|---|---|
| Unitários | **514 passaram, 67 arquivos**; digests/formato/ambiguidade/predicado/rotas/tenant/emissão após bloqueio e regressão geral |
| Integração conjunta | **104 passaram, onze arquivos**, incluindo **15** de WF-10 |
| LA-028 / PostgreSQL | Duas senhas, mesmo token e dois PIDs aguardando lock: uma vencedora, senha final correspondente; reemissão durante hash; vencimento durante lock sem mudança da tupla; falha real de DELETE de sessão/rollback; bloqueio durante hash; legado/digest como bearer/tenant/ambiguidade; login antigo não recria sessão |
| LA-029 / PostgreSQL | Despromoções cruzadas; bloqueio×despromoção com perda de elegibilidade do ator; conta bloqueada/zero-admin sem autopromoção; own/tenant/DELETE/TRANSFER recusados; falha real de auditoria reverte papel/status/sessões/tokens e sucesso revoga; HTTP com sessão real/host/DTO |
| HTTP autenticação | Host errado recusa reset; correto aceita e replay é recusado; senha antiga rejeitada, atual recebe cookie sem hashes no JSON |
| TypeScript/ESLint | Typecheck sem incremental e lint direcionado dos módulos/rotas/scripts/testes passaram, sem erros/avisos de lint |
| Migrations | **29 migrations** em vazio e upgrade sintético; diff vazio, índice novo/constraints anteriores/reaplicação conferidos. Password/token em texto/deadline/role/status/loja legados preservados, sem backfill |
| Clone protegido | Duas restaurações equivalentes; upgrade/diff/dados originais/sequências/checksums/reaplicação aprovados; sem nova conexão à origem. Snapshot continua de 04/10 |
| Build isolado | Compilação/tipagem e 51 páginas passaram após os locks finais; .next/next-env.d.ts do workspace preservados |
| CI | Seleção ampliada para onze arquivos; nenhum push/job remoto/commit/deploy |

Triggers/constraints de falha foram criados/removidos apenas no banco descartável com sentinela e IDs das fixtures. Não são DDL persistente. Montagem de it.each e tipagem de Sql foram corrigidas durante a validação; nenhuma regra/constraint foi removida para passar testes. Revisão adicional reforçou o teste de prazo e lock antes da escrita; suites conjuntas e build repetidos após essa mudança. Aviso preexistente do carregador Vite permanece; dependências não foram atualizadas.

### 15.5. Ativação e próximos gates

Em WF-18/20: preflight/backup atuais, índice em volume/janela adequados e troca coordenada de todas as instâncias/writers de autenticação/papéis. Não misturar código antigo que escreve/consome plaintext ou rebaixa sem lock com protocolo novo. Drenar requisições antigas durante a troca, comunicar reemissão e testar domínio/cookie com mailer homologado. Mailer de desenvolvimento existente e entrega/provedor real não foram homologados aqui; sucesso genérico não prova entrega externa. Contingência deve preservar dados e restringir fluxo afetado até artefato seguro, sem voltar aos writers vulneráveis.

Verificar contas criadas pelo script antigo e eventual exposição/rotação. Desativar o script não bloqueia contas nem revoga credenciais já persistidas. Essa investigação e recuperação out-of-band exigem execução operacional separada com identidade/evidência.

**Próxima etapa: WF-11 / LA-031/008**, cotação autoritativa/cache de frete. Restam **dez etapas principais, WF-11–WF-20**, além da integração/aceite das etapas construídas e conclusão de LA-002/033. Estado dos 38 LA: **14 com módulo/integração local, dois parciais e 22 sem implementação principal**. Nenhum LA VALIDADO em WF-19 ou ENCERRADO EM PRODUÇÃO. O projeto **ainda não está pronto para produção**.

## 16. Continuação de 05/10 — WF-11 / LA-031/008

**Estado:** IMPLEMENTADO NO MÓDULO, com ensaios reais de PostgreSQL/HTTP. A seção 15 é o checkpoint anterior; a próxima etapa principal agora é **WF-12**. Nenhuma migration foi aplicada no banco persistente e nenhuma cotação externa de transportadora foi solicitada nos ensaios.

### 16.1. Contrato de autoridade e preço

- Emissão recebe IDs/quantidades e resolve loja pelo host. Body divergente de loja é recusado; não há inferência de loja pelo primeiro produto nem `findFirst` como fallback de contexto. Preço/peso/dimensões enviados pelo cliente não participam do cálculo.
- Serviço consulta produtos/variantes disponíveis da loja, IDs persistidos, quantidade agregada por produto e preços DECIMAL do catálogo. Itens repetidos/retirados, variante inválida e estoque insuficiente são recusados. Dados externos não são aceitos por cast.
- Destino DELIVERY é obtido no servidor pelo CEP: UF, município e código IBGE. Resposta errada/incompleta, timeout ou CEP divergente impedem emissão; cidade enviada pelo comprador não escolhe uma regra. O [contrato ViaCEP](https://viacep.com.br/) documenta CEP/localidade/UF/IBGE e erro de CEP inexistente; os testes usam respostas controladas, sem homologação do serviço externo.
- Protocolo v2 persiste `FreightQuote` e assina com HMAC-SHA256 um identificador, hash do vínculo e deadline. O hash cobre loja, dono, conteúdo, destino, revisão, modalidade, provider/serviço, valor/prazo e snapshot. Token não carrega credenciais da loja, cookie ou dados pessoais. Segredo ausente em produção bloqueia emissão; fallback de desenvolvimento é restrito a ambiente não produtivo.
- Dono é `u:ID` para conta ACTIVE da mesma loja ou digest de cookie aleatório HttpOnly de convidado. O servidor estabelece o contexto; campos de identidade enviados no body não o substituem. Cookie usa Secure em produção, SameSite=Lax e validade de um dia; cotação tem validade comercial máxima de 30 minutos. Migração de convidado para sessão exige recotação para a nova identidade.
- Aceite de DELIVERY exige token v2/registro/dono/loja/modalidade compatíveis. CEP/UF/cidade declarados devem corresponder ao destino canônico. Revê catálogo/configuração/revisão global e relógio do banco após os locks, antes de comprador/reserva/pedido. Cotação inválida não escreve parcialmente esses efeitos. Repetição autorizada de pedido já criado conserva o resultado contratado; escopo integral de conteúdo/idempotência continua em WF-13.
- `shippingCost`, `freightValue`, provider, nome e prazo livres do payload não autorizam preço. Pedido novo congela `freightQuoteId` e `freightSnapshot`, além dos campos de frete existentes. No caminho alternativo do carrinho, subtotal e preços dos itens também usam o catálogo corrente que sustentou a cotação; preço antigo de CartItem não substitui o valor declarado aceito.
- **PICKUP/NONE sem token** são políticas explícitas gratuitas: flags relidas no servidor, custo definido pelo servidor como 0 e snapshot da política/revisão. Omitir token não libera DELIVERY nem modalidade desabilitada. Quando existe token de PICKUP/NONE, ele também é validado; desligar a flag revoga tokens anteriores. Regra local de entrega com tarifa0 continua possível quando válida geograficamente.

### 16.2. Revisões, cache e concorrência

Migration `20261005070000_freight_authority` eleva o histórico a **30 migrations**, sem alterar as 20 históricas. Acrescenta UF/IBGE nullable de regra, fingerprint/serviço/snapshot nullable de cotação, campos de frete aceito no pedido e `FreightTariffRevision`. Quatro triggers ativados incrementam revisões na mesma transação: configurações de frete de Loja, INSERT/UPDATE/DELETE de FreightRule e INSERT/UPDATE/DELETE/TRUNCATE de cada tabela global J&T. Constraint exige par UF/IBGE válido ou ambos null. Instalação não adivinha município, token ou snapshot de pedidos anteriores.

Cache por instância guarda **cálculo/lista de serviços**, nunca token. Chave v2 combina modalidade e fingerprint de loja/origem/destino, itens normalizados em ordem estável, revisões de catálogo, preços/valor declarado, pesos/dimensões/pacote, quantidade, configuração e versão global de tarifas. Cada instância tem conjunto fixo de providers; assinatura do resultado individual acrescenta provider/serviço/preço/prazo. Alteração relevante é relida no PostgreSQL antes de cache hit/emissão/aceite; invalidação de um Map isolado não é a garantia.

Valor declarado usa subtotal integral das mercadorias antes dos pontos; desconto não reduz silenciosamente a proteção da carga. Dois carrinhos com mesmo pacote e valores 100/1000 recebem seguros distintos. O snapshot canônico de destino tem ordem explícita de campos: reordenação pelo JSONB não altera o hash. Itens equivalentes reordenados reutilizam cálculo, mas cada emissão ganha ID/token próprio ligado ao dono e conserva o deadline original do resultado. Cache tem limite de 500 entradas por instância e remove vencidas em novas consultas; TTL não substitui revisão.

Ordem de leitura/emissão: revisão global FOR SHARE → Loja FOR SHARE → produtos ordenados FOR SHARE → relógio do banco. Aceite usa produtos FOR UPDATE desde o início, porque inventário os escreverá depois; não faz upgrade concorrente de locks compartilhados. Caminho de carrinho obtém as revisões/pai antes do escopo do dono/Cart e dos produtos, preservando protocolo de consumo. Comando de regra usa Loja FOR UPDATE, reautoriza ADMIN ACTIVE da mesma loja e persiste regra/auditoria USER/revisão no mesmo commit. Mudança de papel/status da etapa10 utiliza o mesmo pai serializador.

Consulta de geografia e providers acontece **fora** da transação/locks. Após I/O, serviço abre nova transação, revalida fingerprint/deadline e só então persiste/assina. Alteração durante I/O exige recotação e não emite token de resultado obsoleto. Falha/resultado inválido de provider não vira preço grátis e não é cacheado como sucesso. Outros providers válidos podem retornar suas opções, sem cachear a lista degradada. Correios deixou de retornar tarifas estimadas após falha; timeout cobre leitura do corpo, e valor declarado vem do catálogo.

### 16.3. Escritores, consumidores e legado

| Caminho conferido | Contrato aplicado |
|---|---|
| `/api/freight/calculate` e POST `/api/freight` | Mesmo emissor/identidade, respostas `private, no-store`, sem autoridade monetária do cliente |
| GET `/api/freight?city=...` | Retirado do contrato:410; nome livre não autoriza regra ou cotação |
| Checkout principal e POST `/api/orders` | Cotação obrigatória em DELIVERY, validação antes do inventário, snapshot aceito e erro de recotação no caminho alternativo |
| Configuração de Loja | Trigger compara origem/flags/dias/credenciais relevantes; leitores de autoridade consultam DB sem DTO público cacheado |
| Admin FreightRule | Host/sessão/tenant conferidos, ator revalidado sob lock, geografia e moeda validadas, audit/revision atômicos |
| J&T | Revisão persistida cobre alterações de ambas as tabelas, inclusive SQL/TRUNCATE; não há importador operacional adicional encontrado nos scripts atuais |
| Catálogo/inventário | Usa IDs/retirada/revisões de WF-07; preço/dimensão efetivos também compõem hash; stock físico não entra no hash, mas disponibilidade é revalidada |
| CheckoutForm | Envia IDs/quantidades/token, lê envelope correto e não usa dimensões inventadas. Descarta respostas de CEP/frete superadas; divergência de subtotal pede atualizar carrinho e confirmar novamente |
| Calculadora do produto | Envia variante selecionada resolvida pelo helper de domínio; mudança de seleção remonta a calculadora, sem usar preço livre |
| Admin de frete | Campos UF/IBGE e aviso de regra legada indisponível; cadastro não fabrica geografia |

Regras antigas só com cityName mantêm ID/vínculos/tarifa, mas **não autorizam entrega** até configuração explícita de UF/código IBGE/cidade compatíveis. Não escolher automaticamente município homônimo. A unicidade histórica loja/cityName foi conservada; cadastrar duas regras de mesmo nome em UFs distintas continua exigindo evolução deliberada desse contrato, não backfill automático.

Tokens antigos/v1 precisam de recotação. Pedidos já contratados conservam valor/serviço/prazo e permanecem sem novos snapshots quando a origem histórica é desconhecida. Alterar regra atual não reescreve frete de pedido aceito. Novos snapshots não dependem de manutenção eterna da linha de cotação para preservar valor contratado; política de retenção/limpeza das cotações ainda deve ser definida e supervisionada no rollout.

Matriz J&T existente é aplicada somente à origem 67140-615 para a qual o adapter declara a importação; outra origem não recebe tarifa dessa matriz. Autenticidade/vigência/abrangência comercial dessa tabela não foi homologada nesta sessão. Correios conserva o adapter existente, sem fallback tarifário; serviço/contrato real precisa de homologação externa antes de habilitar vendas dependentes dele.

### 16.4. Evidências finais

| Verificação | Resultado local |
|---|---|
| Unitários | **524 passaram, 68 arquivos**; protocolo/segredo/CEP/pacote/valor declarado/falha dos Correios e regressão dos módulos anteriores |
| Integração conjunta | **123 passaram, 12 arquivos**, incluindo **19** de frete; PostgreSQL/Next reais em ambientes descartáveis com sentinela |
| Cenários de frete | 100/1000 e seguro J&T real de fixture; ordem dos itens/JSONB; duas instâncias; preço/dimensão/configuração/tarifa alterados; dono/tenant/CEP/UF/quantidade/variante/serviço; token/registro adulterado; desabilitação; I/O com revisão alterada; deadline após espera de lock; regra legada/homônima; gratuidades; provider indisponível e falha parcial; auditoria/rollback; caminho alternativo com preço atualizado; HTTP com sessão real/host |
| TypeScript | `tsc --noEmit --incremental false` passou |
| ESLint direcionado | Sem erros; sete avisos preexistentes dos consumidores: seis de `<img>` e um de dependência de hook da calculadora, que continua no escopo de QA de cliente |
| Migrations | **30 migrations**; vazio/sintético, diff vazio, CHECKs históricos/novos, quatro triggers habilitados e revisão global conferidos; reaplicação sem alterações. Legado preservado sem inferir geografia/cotação/snapshot |
| Clone protegido | Duas restaurações equivalentes e upgrade/diff/colunas originais/sequências/checksums aprovados; triggers/constraint conferidos e nenhuma geografia/cotação histórica fabricada. Sem nova conexão à origem; snapshot de 04/10 |
| Build isolado | Compilação/tipagem e geração de 51 páginas passaram após alterações finais dos consumidores; .next/next-env.d.ts do workspace preservados |
| CI | Seleção ampliada para 12 arquivos; nenhum push/job remoto/commit/deploy |

Falhas intermediárias expuseram ordenação de destino incompatível após JSONB, corrigida pela normalização antes de assinar e reproduzida em teste real. Testes anteriores de identidade/carrinho foram adaptados para obter cotações verdadeiras; concorrência com conteúdo alterado exige recotação, e não aceite de preço antigo. Testes unitários de outros domínios isolam frete por snapshot autorizado explícito; não são evidência de assinatura/locks, que pertence à suite PostgreSQL real. Corrigidas tipagem do mock e memoização rejeitada pelo compilador React; regras/constraints não foram removidas para passar testes. Aviso preexistente do Vite permanece; dependências não foram atualizadas.

### 16.5. Limites, ativação e próxima etapa

Ainda falta validar o candidato completo com intenção canônica/valores financeiros/estado assíncrono em WF-12/13/15/19. Atualização do carrinho, consentimento integral, múltiplas abas, refresh, expiração visível, erros de rede e regressão em navegador não estão homologados pela tipagem/build. Cálculo de pacote continua uma estimativa do helper existente, com defaults de catálogo 300g/16×11×4 quando ausentes e rejeição de dimensão calculada acima de 100cm; medição real, limites comerciais, composição de caixas/múltiplos volumes e política de dados logísticos devem ser confirmados antes de vendas que dependam dessas condições. Não afirmar homologação física ou comercial pelo teste do hash.

Em WF-18/20: preflight/backup atuais, DDL antes do código que consulta as colunas novas, configuração geográfica explícita das regras legadas, segredo privado aleatório consistente entre todas as instâncias e ativação coordenada de emissores/consumidores. Drenar writers/requisições antigas; invalidar tokens/cache antigos e orientar recotação. Não permitir retorno ao fallback de preço livre/estimado como contingência. API de CEP, origem/matriz/credenciais/serviços reais, HTTPS/cookies, retenção/capacidade, alertas e observação precisam de ensaio operacional. A `.env` não foi alterada e o DDL existe apenas como migration versionada ensaiada em clones/bancos descartáveis.

**Próxima etapa: WF-12 / LA-035/009/023**, capacidades reais de pagamento, parcelas/encargos autoritativos e política de ganho congelada. Restam **nove etapas principais, WF-12–WF-20**, além da integração/aceite das já construídas e conclusão de LA-002/033. Estado dos 38 LA: **16 com módulo/integração local, dois parciais e 20 sem implementação principal**. Nenhum LA VALIDADO em WF-19 ou ENCERRADO EM PRODUÇÃO. O projeto **ainda não está pronto para produção**.

## 17. WF-12 / LA-035/009/023 — autoridade financeira e capacidades, 05/10/2026

**Resultado:** construção local dos três módulos e integração com os módulos anteriores ensaiadas. Homologação externa, intenção canônica, worker financeiro e aceite de produção permanecem pendentes. Os números da seção 16 descrevem o checkpoint anterior; o estado atual está nesta seção e na tabela inicial.

### 17.1. Métodos explícitos e preflight

- Loja tem quatro flags independentes: `enableManualPix`, `enablePix`, `enableCreditCard`, `enableBoleto`, todas **false por padrão** na migration. Não habilitar métodos históricos pela presença de uma chave PIX ou de campos Asaas.
- `paymentCapabilities` combina configuração relida da loja com a porta do gateway. GET `/api/payment/capabilities` resolve o tenant pelo host, consulta a loja e responde `private, no-store`; contém métodos, revisão, limites e parâmetros financeiros públicos. Não contém chave PIX, WhatsApp, CPF, token Asaas ou credenciais de frete. Não emite cobrança nem faz probe remoto para testar uma chave.
- Capacidade remota exige `PAYMENT_REMOTE_ENABLED=true`, ID exato da loja na allowlist `ASAAS_ENABLED_LOJA_IDS` e configuração do cliente efetivamente construído: chave capturada, HTTPS/host/path de API e ambiente compatíveis. Mudar a variável depois de construir um cliente sem chave não lhe concede capacidade. Em produção, host/chave de produção; nos demais ambientes, host/chave de sandbox. Parcelamento remoto fica limitado a 1 até `ASAAS_INSTALLMENTS_APPROVED=true`; flags da loja continuam obrigatórias.
- PIX manual exige sua flag, chave armazenada não vazia e WhatsApp de formato utilizável. Chave do payload não substitui a da loja. É conferência manual, sem criação remota nem aprovação automática. Presença/formato de configuração não prova titularidade da chave, habilitação da conta ou disponibilidade externa: essa homologação continua pendente.
- Antes de reservar: método/capacidade, CPF/CNPJ válido para métodos remotos, cartão válido e endereço de cobrança quando necessário, frete autorizado, catálogo, resgate e plano/piso/consentimento. O pedido e sua tentativa só são gravados após essas validações. Falha aborta a transação inteira, inclusive comprador; nenhuma reserva/cobrança parcial permanece nesses cenários.
- Configuração de flags via HTTP exige Admin/host compatíveis; o serviço relê ADMIN ACTIVE da loja sob `Loja FOR UPDATE`. Aceite usa `Loja FOR SHARE`, conservando a política durante a transação. Trigger atualiza a revisão junto com alterações de capacidades/instruções/fidelidade. Cache do DTO administrativo não autoriza cobrança.
- Suspender novas vendas remotas remove a capacidade de criação. Consulta de pagamentos existentes pelo adapter não depende desse gate; a execução supervisionada dessa conciliação ainda será construída em WF-14.

### 17.2. Plano e contrato de parcelamento

`services/payment/installment.service.ts` e `lib/config/payment.config.ts` consolidam o cálculo para servidor e exibição. Valores monetários são validados e convertidos para centavos inteiros. Taxa tem até seis casas; contagem inteira 1–12, mínimo de parcela e piso remoto são validados. Configuração malformada não é aceita por `parseFloat` parcial. Preservado o limite comercial pelo principal/mínimo antes de juros.

Regra persistida: `price-rational-half-up-last-residual-v1`. Usa aritmética racional BigInt para Price, arredonda a prestação em HALF_UP e calcula encargo sem valor negativo. Taxa 0 ou absorção de taxas conserva o principal. Distribui centavos residuais na **última** parcela:100/3 =33,33+33,33+33,34. Com taxa mensal 10%,100/3 resulta em3×40,21, total120,63. Isso é a política técnica adotada para a construção; tarifas reais/CET, limites comerciais, obrigações de apresentação e aprovação do financeiro não foram homologados por esse cálculo.

`Order.total` conserva o total comercial: mercadorias − fidelidade + frete. `financialTotal`, `financingCharge` e `financialPlan` guardam o valor financeiro, sua diferença e parcelas aceitas; a tentativa conserva plano/regra/taxa/configuração. Cartão exige `acceptedFinancialTotal` igual ao calculado no servidor. `installmentValue` externo não autoriza valor: se enviado, deve coincidir com o plano. Alteração de valor exige reconfirmação antes da chamada. Consentimento de revisão/conteúdo completo e concorrência da intenção pertencem a WF-13.

Adapter envia apenas `value` em 1x; em 2+ envia `totalValue` e `installmentCount`, sem `value`/`installmentValue` contraditórios. Guarda ID do contrato e todos os IDs/ordinais/valores/status de `PaymentCharge`. Consulta exige lista completa, sem IDs repetidos, com referência ao pedido/contrato e distribuição corretas. Retorno POST da primeira cobrança também deve corresponder à lista. Uma única parcela confirmada não comprova aprovação do contrato inteiro. A documentação oficial distingue os formatos e o ajuste residual na última parcela: [Asaas — installment payments](https://docs.asaas.com/docs/installment-payments). Mapeamento foi ensaiado com respostas controladas, **sem homologação da conta/endpoint externos**.

### 17.3. Persistência anterior ao I/O e resultado incerto

1. Mesma transação grava pedido e `PaymentAttempt`: manual `NOT_STARTED`; remoto `SUBMITTING`, referência estável ao pedido e plano aceito. PAN/CVV ficam somente na chamada transitória, fora dos snapshots, tentativas, audit/outbox.
2. Transação termina antes da chamada externa. Capacidade é conferida novamente; o gateway é uma porta explicitamente injetada nos testes, sem inspeção de mock ou bypass por `NODE_ENV`.
3. Resultado é validado antes de persistir ID/valor/status/artefatos. PIX precisa QR/payload; boleto precisa URL/linha/data válida. Cartão exige contrato completo, soma/ordinais/primeiro ID compatíveis e prova integral para aprovação. Metadados de bandeira/final são limitados; não persistir PAN em um campo de final do cartão. Logs do adapter não recebem a exceção remota bruta.
4. Tentativa/cobranças/artefatos são gravados sob lock do pedido. Status `APPROVED` exige prova integral de cartão ou confirmação da cobrança única de PIX/boleto; demais emissões válidas ficam `PENDING`. Aprovação chama o comando transacional de pedido e verifica seu resultado.
5. Timeout, contrato incompleto, artefato ausente ou falha local depois de possível aceite externo deixam `UNKNOWN` e prazo de conciliação. Se a prova `APPROVED` já foi gravada e a aplicação local falhou, preserva a prova e agenda `PAYMENT_APPROVAL_PENDING_APPLICATION`. Não recria cobrança, não libera estoque e não converte para PIX manual.

HTTP diferencia emissão válida/manual 200 de resultado em verificação 202. O consumidor exibe pagamento em verificação, sem artefatos fictícios; aprovação posterior pode atualizar a confirmação pelo polling. Replay autorizado de pedido com tentativa incompleta/UNKNOWN ou aprovação ainda não aplicada mantém PROCESSING; replay de PIX emitido lê instruções persistidas. Isso protege o caminho existente, mas **não substitui** a intenção/idempotência por conteúdo, recuperação de convidado após resposta perdida e consumo de carrinho de WF-13/15.

Para pedidos novos com plano remoto, o comando PAID exige tentativa APPROVED. CANCELLED exige recusa/cancelamento/reembolso confirmado da tentativa; tentativa inexistente ou pagável não autoriza restituição. Assim o cron/webhook antigo não pode liberar esses pedidos por mera passagem de tempo. Legados sem plano conservam o caminho anterior até conciliação explícita. Worker/inbox/fatos financeiros, consulta por referência, ordenação de eventos, cancelamento/estorno e expiração por método ainda estão em WF-14. Falha de banco que impeça também o registro de UNKNOWN pode interromper a resposta HTTP, mas a tentativa SUBMITTING já existe para recuperação; não prometer202 quando o armazenamento está indisponível.

### 17.4. Política de ganho e legado

`net-merchandise-floor-v1`: base = mercadorias − desconto de fidelidade, excluindo frete e encargos; pontos = floor(Decimal(base) × Decimal(taxa)). Desconto integral produz base/pontos 0. Checkout e criação pelo carrinho congelam configuração, base, taxa, prazo, elegibilidade e pontos previstos. `pointsEarned` continua previsão; `pointsCredited` registra o crédito aplicado pelo protocolo, com ledger/lotes no mesmo commit.

Pedido100, desconto20, taxa 0,5 congela40. Confirmação usa esse snapshot, mesmo que a loja depois desabilite o programa ou altere taxa/prazo. O prazo congelado inicia na aprovação; repetição não credita outra vez. Reversão integral conserva as origens/alocações de WF-09. Tratamento financeiro proporcional de devolução parcial e integração com fatos de reembolso continuam pendentes em WF-14/19; não marcar esse requisito encerrado.

Pedido antigo sem snapshot não recebe política deduzida da configuração atual: cria pendência `LEGACY_EARN_POLICY_UNKNOWN`, sem crédito inventado. Migration deixa snapshots/valores financeiros null e `pointsCredited=0` como projeção inicialmente não preenchida pelo protocolo novo. Em legado, isso **não comprova ausência de ganho histórico**: o snapshot nulo e o ledger antigo precisam ser conciliados antes de apresentar valor histórico como conhecido. Sem mutações de saldo/ledger histórico ou backfill presumido.

### 17.5. Evidências e compatibilidade

| Verificação | Resultado local |
|---|---|
| Unitários | **543 passaram, 69 arquivos**, incluindo 19 novos casos financeiros/capacidades/contrato e regressão dos módulos anteriores |
| Integração conjunta | **144 passaram, 13 arquivos**, incluindo 21 da WF-12, em PostgreSQL/Next reais, com gateway explicitamente injetado e sem I/O financeiro externo |
| Cenários | Método/flags/chave ausentes; manual explícito; CPF/endereço/piso/consentimento adulterados; parcelas/juros/residual; primeiro pagamento parcial; artefatos ausentes; perda de capacidade; timeout/replay; falha de persistência após aceite; falha de confirmação com prova APPROVED preservada; DTO HTTP; flags com ator inválido; ganho 40 congelado, taxa/prazo alterados, crédito único e legado sem política |
| TypeScript | `tsc --noEmit --incremental false` passou; build também verificou tipos |
| ESLint direcionado | Sem erros; quatro avisos preexistentes: dois `<img>` e dois sobre declaração de callbacks usados em hooks. Não são homologação de navegador |
| Migration | **31 migrations**; vazio/sintético/diff/reaplicação passaram; dois CHECKs financeiros e trigger de revisão habilitados; legado sem plano/ganho inferido nem métodos habilitados |
| Clone protegido | Duas restaurações equivalentes, upgrade/diff/checks/trigger, dados originais/sequências preservados. Snapshot 04/10 reutilizado, sem nova conexão à origem |
| Build isolado | Compilação/tipagem e geração de 52 páginas passaram; `.next`/`next-env.d.ts` da árvore preservados |
| CI | Seleção ampliada para 13 suites; nenhum job remoto/push/commit/deploy executado |

Testes antigos de outros domínios passaram a declarar método manual/política de fixture ou porta remota explícita. Não relaxaram a regra de produção. Fixtures de ganho da WF-09 congelam política **antes** da confirmação; exemplos legados continuam identificados. Falhas intermediárias do ensaio de confirmação envolveram a constraint de injeção: ator de sistema é `systemActor`, não User fictício, e a constraint temporária não pode validar/rejeitar confirmações anteriores. O teste final provoca a falha na escrita nova e remove sua constraint em `finally`, apenas no banco descartável.

### 17.6. Ativação, limites e próximo pacote

Não aplicar esta versão a uma base sem as colunas/migration novas. Em WF-18/20, repetir backup/preflight atual, ensaiar DDL antes dos leitores/writers e drenar instâncias antigas. Flags false são intencionais; ativar PIX manual exige instruções verificadas e conferência operacional, e ativar métodos remotos exige os gates da conta/loja/ambiente mais homologação integral. `.env.example` documenta defaults desabilitados e parâmetros; a `.env` não foi alterada. Nenhuma cobrança, estorno, email externo, migration persistente ou deploy foi executado.

Antes de produção: intenção/consentimento completo e reserva com procedência em WF-13; worker/inbox/outbox e fatos financeiros, reconciliação dos SUBMITTING/UNKNOWN e APPROVED não aplicado, callbacks, cancelamento/estorno/expiração em WF-14; UX/refresh/abas/carrinho e histórico de pontos em WF-15/16/17; legado/observabilidade em WF-18; homologação sandbox e do candidato completo em WF-19; ativação supervisionada em WF-20. Revisar timeout do transporte Asaas também para leitura do corpo; o timeout atual da resposta inicial não comprova limite de todo o I/O. Calendário/vencimentos/taxas/conta reais e limites de parcelamento precisam de homologação, não apenas de teste unitário.

**Próxima etapa naquele checkpoint: WF-13 / LA-011/004/001/015/013/012**, intenção e conclusão canônicas de compra. Na conclusão da WF-12 restavam **oito etapas principais, WF-13–WF-20**, além da integração/aceite e conclusão de LA-002/033. Dos 38 LA: **19 com módulo/integração local, dois parciais e 17 sem implementação principal**. Este é o checkpoint anterior; consultar a seção 18 para o estado atual.

## 18. WF-13 / LA-011/004/001/015/013/012 — intenção e conclusão canônicas, 05/10/2026

**Resultado:** os seis módulos foram construídos e integrados nos ensaios locais. Há um comando de compra, consentimento persistido, fonte consumível, reservas por item e recuperação com autorização. Isso não conclui a conciliação de WF-14 nem homologação de navegador/produção.

### 18.1. Identidade, fonte e consentimento

- `CheckoutIntent` do protocolo 1 exige uma fonte: carrinho autenticado com dono/tenant/versão ou `CheckoutBasket` de convidado. Banco garante intenção única por carrinho/versão, por basket e por tenant/dono/chave. `Order.sourceCartID` é único e tem FK composta de tenant; pedido/intenção têm unicidade própria.
- A sessão autentica a conta; o serviço relê ACTIVE, tenant e email quando declarado, mantendo a linha User sob SHARE. Convidado usa o cookie opaco HttpOnly `freight_owner`, derivado no contexto HTTP; email, ID de conta, token de pedido e chave de transporte não substituem essa identidade. O body não concede `freightOwnerKey` nem autoridade de gateway.
- Lock de revisão global → Loja, serialização por tenant/dono → intenção → escopo/linha de carrinho → produtos/variantes → carteira/lotes. Emissão e conclusão do mesmo dono convergem mesmo antes de existir uma intenção. Nenhuma chamada de criação remota acontece dentro da transação.
- GET `/api/checkout/intents` inicializa/recupera o contexto. POST emite a proposta por fonte, com revisão e hash do conteúdo normalizado pelo servidor. Hash inclui catálogo/preços, variante/quantidade, comprador/endereço, frete aceito, método/parcelas/encargos, resgate, ganho e instruções manuais congeladas. Não inclui PAN/CVV, preço declarado nem chaves aleatórias de transporte. Quotes de frete diferentes ou termos distintos podem exigir nova revisão da mesma intenção.
- Conclusão exige `checkoutIntentID`, `acceptedRevision`, `acceptedContentHash`; cartão fica transitório. Alteração real dos termos exige nova proposta exibida e novo aceite. Fonte, itens, estoque e plano são relidos antes de escrever. Expiração é conferida com `clock_timestamp()` do PostgreSQL depois dos locks/recalculo; o relógio da instância não decide a validade do consentimento.
- Fonte de convidado usa gerações monotônicas, uma ACTIVE por tenant/dono. Refresh recupera a fonte concluída. PATCH com `previousBasketID` inicia explicitamente outra compra somente a partir da última fonte e de resultado financeiro conhecido. SUBMITTING/UNKNOWN/cancelamento ou estorno pendentes/aprovação ainda não aplicada bloqueiam essa ação. Carrinho autenticado concluído não reabre: adicionar produtos cria outro ACTIVE pelo protocolo anterior.

### 18.2. Comando único, estoque e atomicidade

`createOrder` é a única criação de pedido de aplicação encontrada em `app/services/lib`. POST `/api/checkout` e POST autenticado `/api/orders` usam o mesmo handler/comando e DTO. `createOrderFromCart` delega somente quando recebe intenção/aceite completos; não cria mais pedido sem método/plano/tentativa. O contrato HTTP antigo incompleto recebe422, com indicação de `/api/checkout/intents` e evento estruturado `CHECKOUT_INCOMPLETE_CONTRACT_REJECTED`, sem body/CPF/cartão no log. Falha interna inesperada recebe500 genérico, sem imprimir o erro bruto ou transformar indisponibilidade em validação comercial.

Quantidade não é arredondada: inteiro1–99, no máximo100 linhas; repetição da mesma variante é agregada e novamente limitada. Total por produto também é conferido. ID deve pertencer ao produto/tenant e estar ativo/com estoque. Omissão só resolve seleção inequívoca pelo helper compartilhado, incluindo neutros legados; catálogo sem variante válida não recebe venda nova. Descrições, preço, cor e tamanho são autoritativos; o ID segue para proposta, pedido, reserva e DTO.

Mesmo commit grava comprador, pedido com plano/snapshot de aceite, decrementos, `InventoryReservation` por `OrderItem`, débito/lotes de pontos, tentativa, consumo de fonte, intenção aceita, auditoria e outbox. Falha de auditoria provocada no banco descartável reverte todas essas etapas. Perder a resposta depois do commit não desfaz a compra: repetição reencontra o pedido e nunca inicia outra chamada financeira.

Migration `20261005090000_checkout_intent_authority` eleva o histórico a **32**. É aditiva: fontes históricas continuam null; não fabrica associação de carrinho, intenção, comprador ou reserva. CHECK distingue protocolo novo de legado. Cinco triggers protegem procedência da reserva, completude do commit, imutabilidade do conteúdo contratado e não reabertura de fontes consumidas. Trigger diferido verifica itens/reservas, tentativa/plano, aceite/comprador e consumo no final da criação; constraints únicas/FKs continuam necessárias. Conciliação/limpeza histórica permanecem em WF-18.

PAID de pedido com intenção compromete suas reservas; cancelamento utiliza a procedência, restitui uma vez e marca RELEASED/RETURNED. Produto/variante retirados conservam a restituição indisponível de WF-07. Reserva ausente/incompatível exige revisão. Isso avança LA-002, mas não encerra reservas históricas, callbacks ou reembolsos parciais/físicos de WF-14/18/19. Reservas ainda não possuem executor de expiração por método implantado.

### 18.3. Replay, recuperação e consumidor

- `purchaseResultFromOrder` produz o mesmo contrato na primeira resposta, replay e GET autorizado `/api/checkout/intents/[id]`: `approved`, `action_required`, `manual`, `processing`, `declined`, `cancelled`, `review`, com estado comercial/versão, valores, itens/variante e dados persistidos. `success=true` confirma o processamento do comando, não aprovação do pagamento.
- SUBMITTING/UNKNOWN/aprovação ainda não aplicada/cartão pendente retornam PROCESSING sem PIX fictício. PIX/boleto só apresentam instruções completas persistidas quando acionáveis. CANCELLED/REFUNDED/DECLINED/revisão não recebem instruções para refazer pagamento; estado pago usa a projeção comercial e prova compatível. Recusa/estorno/worker reais ainda pertencem a WF-14, não foram inferidos de timeout.
- `financialSnapshot` conserva revisão/hash/plano e instruções manuais aceitas, incluindo destinatário WhatsApp. Replay não usa configuração nova da loja para mudar uma compra contratada. Pedido manual aprovado/cancelado não reapresenta a chave como nova solicitação de pagamento.
- Recuperação de convidado usa cookie/dono/tenant e devolve a credencial específica, de sete dias, derivada com HMAC separado por finalidade do segredo privado de frete. Banco guarda apenas hash/prazo. Não renova prazo, não altera comprador em GET e não devolve uma credencial derivada após rotação que não corresponda ao hash registrado. Perda do cookie exige a credencial de pedido já entregue; email declarado não recupera compra. Rotação/coexistência de chave e retenção precisam de política operacional em WF-18/20.
- Checkout exibe proposta do servidor antes de confirmar e guarda apenas o ID na URL antes da conclusão. Mudança do draft solicita nova revisão, sem cobrar automaticamente. URL permite recuperar a compra mesmo sem `sessionStorage` ou resposta anterior. Confirmação busca/polla o DTO autorizado, conserva estados de processamento/recusa/cancelamento/revisão, recupera também WhatsApp do snapshot e só limpa o estado local se o ID do carrinho consumido corresponder ao carregado.
- A recuperação no primeiro render foi colocada em efeito independente do callback de conclusão; não acessa um `const` situado depois do retorno de loading. Guards de desmontagem evitam atualizar a tela a partir do efeito inicial cancelado. Esses ajustes foram compilados; homologação completa de efeitos/abas em navegador continua pendente.

### 18.4. Evidências finais

| Verificação | Resultado local |
|---|---|
| Unitários | **558 passaram, 70 arquivos**;15 casos novos de conteúdo/contrato/credencial/DTO e regressão dos demais domínios |
| Integração conjunta | **175 passaram, 14 arquivos**, em PostgreSQL/Next reais;31 casos da WF-13 mais as144 verificações anteriores adaptadas ao protocolo |
| Concorrência/consentimento | Emissão simultânea/chaves diferentes; duas conclusões com estoque abundante; última unidade entre donos; mutação versus conclusão; alteração sem revisão por writer inválido; preço/telefone/expiração; relógio da aplicação divergente |
| Estoque/atomicidade | Identidade de variante, neutros/ambiguidade/retirada/esgotamento, agregação por variante e produto; rollback de auditoria; trigger rejeita reserva incompatível e compra sem efeitos; comprometer/devolver uma vez; fonte não reabre |
| Pagamento/retomada | Timeout com UNKNOWN e uma chamada; recusa de nova fonte incerta; aprovação integral/replay; PAN/CVV fora dos snapshots; instruções manuais congeladas; convidado após resposta perdida; bloqueios de outra identidade/loja; duas APIs com mesmo resultado e mesma exigência de recotação |
| TypeScript/build | Tipagem passou; build isolado compilou, verificou tipos e gerou **53 páginas**, conservando `.next`/`next-env.d.ts` do workspace |
| ESLint direcionado | Sem erros; três avisos preexistentes nos arquivos incluídos: dois `<img>` e uma navegação por `window.location` no store. Callbacks de recuperação não acrescentam avisos de hooks |
| Banco vazio/sintético |32 migrations, diff vazio, reaplicação sem mudanças, CHECK e cinco triggers conferidos; compatibilidade/legado preservados |
| Clone protegido | Dois restores equivalentes; upgrade/diff/reaplicação, CHECK/triggers novos e preservação de dados/sequências; nenhuma intenção/reserva/fonte histórica fabricada |
| CI | Seleção ampliada para14 suites; não foi executado job remoto/push/deploy |

As suites antigas de domínio passaram a emitir/aceitar uma proposta real em fixtures de integração. Fixtures de carrinho declaram PIX manual explicitamente; isso não concede default ao endpoint antigo de produção. Nos unitários que isolam preço/comprador/fidelidade/adapter, a autoridade de intenção é mockada explicitamente no helper de testes; não há bypass de produção por `NODE_ENV`, detecção de mock ou parâmetro HTTP. A comprovação de identidade/locks/consumo está na suite real da WF-13. As falhas iniciais de adaptação envolveram formato nested de CartItem, contrato antigo, contagem de auditoria de criação versus transição e classificação de cartão pendente. Foram resolvidas sem relaxar os invariantes de produção.

### 18.5. Limites, ativação e próximo pacote

A migration foi executada somente em bancos descartáveis/clones. Backup protegido de04/10 reutilizado sem conexão à origem. Não houve alteração da `.env`, cobrança/estorno/email externos, commit, deploy nem migration persistente. Não iniciar leitores/writers novos contra uma base sem as colunas/constraints correspondentes.

WF-18/20 devem repetir backup/preflight atuais, inventariar clientes antigos, drenar writers e coordenar DDL/código; suspender criação no intervalo da troca e orientar revisão das propostas. Preservar ordens/credenciais históricas e não remover o índice global antigo com uma inferência de ownership. Segredo privado deve ser aleatório, consistente entre instâncias e planejado para rotação. Não reativar o caminho sem intenção como contingência.

Ainda pendem: inbox/fatos/outbox e worker de conciliação; retomada de SUBMITTING/UNKNOWN e aprovação não aplicada; cancelamento/estorno/expiração por método; conciliação de reservas/lotes legados; UX completa, contrato das mutações do store de carrinho, navegador/rede/abas, logout/troca de identidade e histórico; frete/gateway reais em sandbox; observabilidade/retencão/IAM/MFA/aceite e ativação supervisionada. A integração mínima do consumidor aqui **não homologa WF-15** nem resolve por si só as mutações de carrinho ainda no contrato antigo.

**Próxima etapa naquele checkpoint: WF-14 / LA-005/003/010**, gateway, eventos e expiração com execução durável. Restam **sete etapas principais, WF-14–WF-20**, além de integração/aceite e conclusão de LA-002/033. Dos38 LA: **25 com módulo/integração local, dois parciais e11 sem implementação principal**. Nenhum VALIDADO em WF-19 ou ENCERRADO EM PRODUÇÃO. O projeto **ainda não está pronto para produção**.

## 19. WF-14 / LA-005/003/010 — execução financeira durável, 05/10/2026

**Resultado:** núcleo implementado e ensaiado localmente com PostgreSQL/Next reais e porta financeira controlada. Eventos recebidos, evidências, efeitos comerciais e notificações possuem persistência e retomada. A conciliação permite recuperar uma criação com resposta perdida sem outra cobrança. Cancelamento comercial, exclusão da cobrança, estorno financeiro e retorno físico são decisões distintas. Este checkpoint não homologa os contratos externos nem ativa produção.

### 19.1. Recepção e processamento dos eventos

`services/payment/payment-inbox.service.ts` e `app/api/webhooks/asaas/route.ts` substituem a aplicação imediata do webhook por inbox durável. Token configurado é comparado sem diferença de tempo por conteúdo; ausente503, inválido401, executor desabilitado503, JSON inválido400, conteúdo conflitante para a mesma identidade409, limite de payload413 e falha de persistência503. HTTP200 com RECEIVED significa recebimento persistido, não pagamento aplicado. PROCESSED só é retornado para inbox COMPLETED; DEAD_LETTER aparece como NEEDS_REVIEW.

Identidade combina provedor, conta estável configurada no servidor e ID do evento; ausência de ID usa hash determinístico do envelope normalizado. Whitelist remove atributos desconhecidos/cartão/tokens antes de persistir. O marcador legado `PaymentWebhookEvent` não é apagado, reaproveitado como prova financeira nem convertido em fato por suposição.

`durable-work.service.ts` e `payment-worker.service.ts` reivindicam trabalho com FOR UPDATE SKIP LOCKED, lease de dez minutos, dono aleatório, prazo e tentativas. Dono vencido não pode confirmar trabalho. Retry tem backoff limitado a uma hora e inbox/outbox vão a DEAD_LETTER após dez falhas; isso exige intervenção observável, não exclusão. Uma lease abandonada volta a ser elegível.

Webhook dispara consulta completa ao provedor. ID da cobrança tem precedência e externalReference deve concordar; não há OR que combine pedidos diferentes. Lookup inconclusivo, indisponível ou sem contrato completo mantém pendência. Consulta ocorre fora dos locks; Order é relido sob lock, lease é conferida e fatos/status/reservas/pontos/histórico/auditoria/outbox/ack são escritos na mesma transação. Falha nessa fronteira reverte também o ack. Eventos antecipados, simultâneos e fora de ordem não conferem autoridade financeira ao payload recebido.

### 19.2. Conta, contrato e fatos financeiros

Arquivos principais: `lib/commerce/payment-account.ts`, `services/asaas/asaas.client.ts`, `services/asaas/asaas.adapter.ts`, `services/payment/checkout-payment.service.ts` e `services/payment/payment-evidence.service.ts`.

- `ASAAS_ACCOUNT_SCOPE` é um identificador estável de instalação (default primary, até24 caracteres); tentativa/cobrança/fato e inbox guardam esse escopo. Troca da chave da mesma conta conserva o identificador; troca de conta exige migração operacional explícita. Escopo não é prova criptográfica de titularidade nem configuração de contas diferentes por loja.
- Timeout Asaas de oito segundos abrange resposta e leitura de JSON. Listagem por referência exige página completa; paginação adicional não é tratada como “primeiro resultado correto”. IDs conhecidos são consultados individualmente quando não aparecem na lista, inclusive cobrança excluída. Recuperar artefato/consultar referência não inicia novo POST.
- A evidência verifica referência, método, IDs, cardinalidade, ordem, valores em centavos e total/contrato de parcelamento. Cobrança extra, valor divergente ou vínculo com outro pedido geram revisão; não escolhe um resultado conveniente.
- AUTHORIZED, SETTLED, REFUNDED e CANCELLED são fatos únicos por cobrança/tipo. CONFIRMED autoriza; RECEIVED permite registrar liquidação. Primeiro recebimento de uma parcela não aprova o contrato inteiro. Estado antigo PENDING/OVERDUE não desfaz prova confirmada; REFUNDED não regride.
- Aprovação síncrona e reconciliação usam o mesmo motor transacional. Se a aplicação comercial falha antes do commit, nenhuma aprovação/fato/reserva parcialmente aplicada é assumida como sucesso: a tentativa fica recuperável. SUBMITTING abandonado é consultado, não reenviado.
- Pagamento tardio em CANCELLED registra dinheiro e alerta SYSTEM sem FK de User fictício, conserva notas anteriores e não reabre pedido/reserva. DTO canônico inclui `financialState` separado do status comercial e prioriza REVIEW nas divergências; não mostra instrução fictícia em incerteza/reversão.

ExternalReference é filtro de busca, sem garantia de unicidade remota assumida. A listagem admite paginação; a distinção entre confirmação/recebimento e os demais eventos deve ser homologada na conta real. Fontes: [listagem Asaas](https://docs.asaas.com/reference/listar-cobrancas), [consulta da cobrança](https://docs.asaas.com/reference/recuperar-uma-unica-cobranca) e [eventos de cobrança](https://docs.asaas.com/docs/webhook-para-cobrancas).

**Limite de datas:** `occurredAt` utiliza `paidAt` normalizado quando a porta o fornece; no adapter atual, que não mapeia todas as datas de liquidação/estorno, conserva o instante de observação no banco. Não é evidência de data bancária histórica/fiscal. WF-17/18/19 precisam definir datas por tipo e a política das métricas; não fabricar datas ausentes.

### 19.3. Cancelamento, estorno e conferência manual

`payment-operations.service.ts` e a rota POST `/api/admin/orders/[orderId]/payment-operation` exigem ADMIN ACTIVE da loja, comando, versão comercial e método/estado compatíveis. User é protegido durante a reautorização e Order durante a decisão. Uma operação é persistida por cobrança/tipo; replay aceita o mesmo comando/ator, outro comando conflitante é rejeitado.

Worker consulta antes de enviar. Registra SUBMITTING antes do I/O; sucesso HTTP apenas marca PENDING. Falha/timeout marca UNKNOWN. Retomada consulta o estado e **não reenvia** operação SUBMITTING/UNKNOWN, pois a chamada anterior pode ter sido aceita. Estorno parcelado interrompido retoma apenas operações READY ainda não submetidas; confirmação parcial conserva revisão até a evidência completa. Pagamento que ganha a corrida de cancelamento impede DELETE indevido.

O prazo de revisão de uma reversão nova começa na solicitação (24h pelo relógio do banco), inclusive no cancelamento solicitado pela expiração. Não herda o prazo da criação da compra: um pedido de dias atrás não pode iniciar estorno já vencido. Replay do mesmo comando conserva o prazo original da solicitação. Dois cenários foram reproduzidos falhando antes do ajuste (cancelamento com prazo antigo e estorno sem expedição), e os testes finais também verificam a expiração remota com esse prazo anterior vencido.

Cancelamento só conclui com prova de exclusão/recusa compatível; estorno só conclui com confirmação integral. Pedido pago não expedido cancelado/estornado restitui uma vez pelo protocolo de reservas. SHIPPED/DELIVERED estornado mantém estado comercial e estoque COMMITTED, reverte pontos pelo protocolo e marca PHYSICAL_RETURN_REQUIRED. Retorno físico exige procedimento próprio posterior, não inferência bancária.

PIX manual não usa gateway como autoridade de transferência. PAID exige confirmação humana de administrador e grava AUTHORIZED manual; não inventa SETTLED bancário. Cancelar um manual pago pode encerrar o compromisso comercial/restituir reserva, mas conserva REFUND_PENDING/MANUAL_REFUND_REVIEW até conferência da devolução. POST `/api/admin/orders/[orderId]/manual-refund`, em `manual-refund.service.ts`, permite REQUEST_REFUND/CONFIRM_REFUND com identidade, versão, autoria e referência da operação bancária guardada somente como hash. CONFIRM_REFUND é uma **atestação administrativa**, não uma integração bancária; não transfere dinheiro. Entregue estornado manualmente também não retorna estoque sozinho.

Não foram habilitados estorno parcial, chargeback automático ou estorno automático de boleto sem dados bancários/contrato homologado. Estados externos desconhecidos ou reversões parciais vão à revisão. Excluir cobrança não substitui estornar transferência; aceite de uma solicitação não comprova seu resultado final. Fontes: [exclusão Asaas](https://docs.asaas.com/reference/excluir-cobranca) e [estorno Asaas](https://docs.asaas.com/reference/estornar-cobranca).

### 19.4. Prazos e expiração

Política versão1 faz parte do conteúdo aceito em `checkout-plan.service.ts` e é persistida no plano/tentativa:

| Método | Validade e reserva no protocolo novo |
|---|---|
| WHATSAPP_PIX | Reserva de24h desde a criação pelo relógio do banco; confirmação humana sob lock vence a seleção antiga do job |
| PIX remoto | Expiração ISO com timezone obtida do artefato; sem prazo comprovado não inventa vencimento |
| BOLETO | Data do vencimento interpretada como final do dia brasileiro (03:00 UTC do dia seguinte); reserva acrescenta72h de tolerância de confirmação congeladas no plano |
| CREDIT_CARD | Não usa expiração de PIX/boleto nem regra genérica de uma hora; análise/resultado incerto exige conciliação/revisão |

`services/order-timeout.service.ts` seleciona por prazo persistido e consulta o remoto sem lock. Depois relê prazo/estado/Order sob lock e aplica evidência. PAID não é cancelado por snapshot antigo. Remoto ainda pagável gera CANCEL_PENDING/operação durável, mantendo estoque até prova final; falha de consulta não libera estoque. Jobs manuais simultâneos liberam uma vez. dryRun é somente leitura. Opções antigas de “60min”/relógio do chamador permanecem apenas como compatibilidade, sem decidir o vencimento.

NULL legado não recebe prazo calculado da idade nem cancelamento presumido. A tolerância72h/manual24h é política técnica congelada e precisa de aceite financeiro/operacional e calendário real em WF-19/20 antes de ativar expiração. Mudanças de política exigem revisão nova da proposta para compras futuras.

### 19.5. Outbox, supervisão e execução

`payment-outbox.service.ts` processa recibos internos, revisão e confirmação por email. Prova de pagamento grava intenção de notificar no mesmo commit, sem email dentro da transação. Mensagem usa destinatário/conteúdo/from/data congelados no primeiro envio e a mesma chave de idempotência em todos os retries. Falha de envio ou perda de resposta não apaga o registro financeiro. Resend tem janela de idempotência de24h; o consumidor interrompe tentativas automáticas após23h e exige revisão, conservando o payload. Fonte: [idempotência Resend](https://resend.com/changelog/idempotency-keys).

Mensagens de revisão e comandos ainda sem consumidor específico vão a DEAD_LETTER visível, sem falsa conclusão. Em especial, trabalhos legados de conciliação de fidelidade não são resolvidos por este worker financeiro; permanecem para WF-18. Reversão SUBMITTING/UNKNOWN antiga ou com prazo vencido mantém status/revisão, nunca ganha permissão automática de novo POST.

Novas interfaces:

| Interface | Proteção/finalidade |
|---|---|
| GET/POST `/api/cron/payments?limit=1` | Bearer CRON_SECRET; limite1–5; inbox → conciliação → expiração → outbox, aguardados |
| GET `/api/cron/payments/status` | Mesmo segredo; agregados de backlog/pendências/operações/leases/legados, sem dados de comprador |
| POST `/api/admin/orders/[orderId]/payment-reconcile` | ADMIN ACTIVE/tenant/comando; agenda consulta e reabre inbox em revisão da referência correspondente, sem rearmar cobranças/estornos |
| POST `/api/admin/orders/[orderId]/payment-operation` | Solicita cancelamento/estorno integral persistido, não significa execução financeira |
| POST `/api/admin/orders/[orderId]/manual-refund` | Atestação administrativa explícita, distinta de chamada bancária |

Flags `PAYMENT_WORKER_ENABLED` e `PAYMENT_EXPIRATION_ENABLED` foram documentadas com default false na `.env.example`. A `.env` não foi alterada. Endpoint financeiro não instala scheduler nem comprova que o scheduler está vivo: infraestrutura/frequência/alertas/heartbeat e suporte operacional são gates de WF-18/19/20. Só aceitar webhook com flag habilitada **depois** de consumidor implantado e scheduler monitorado. Consultas de pagamentos existentes continuam possíveis com novas vendas remotas desabilitadas, desde que a conta/chave estejam configuradas. Simulador antigo de webhook não modifica pedidos:403 em produção,410 no desenvolvimento; ensaios usam portas explicitamente controladas.

### 19.6. Schema, compatibilidade e evidências

Migration `20261005100000_durable_payment_execution` eleva o histórico a **33 migrations** (13 novas nesta execução). Acrescenta leases/retry/deadlines/conta e `PaymentOperation`, quatro CHECKs e dois triggers. É transacional e não fabrica operações/prazos/fatos/contas históricos. Trigger protege identidade/procedência da operação e impede rearmar READY após submissão. FinancialFact rejeita mutação e valida os vínculos fornecidos entre pedido/tentativa/cobrança/provedor/conta/valor/estado. Dados genéricos legados sem esses vínculos não são automaticamente convertidos em prova completa.

| Verificação | Evidência final local |
|---|---|
| Unitários | **568 passaram,71 arquivos**;10 novos casos de adapter/conta/timeout do corpo e regressão geral |
| Integração conjunta | **211 passaram,15 arquivos**, incluindo36 cenários novos da WF-14, PostgreSQL/Next reais e porta de pagamento controlada |
| Inbox/atomicidade | Duplicatas concorrentes; conteúdo conflitante; evento antecipado; ID×referência de outro pedido; lease abandonada/dono vencido; SQL interrompendo commit; ack e efeitos revertidos juntos |
| Financeiro | Resposta de criação perdida/QR; consulta vazia/indisponível; conta alterada; valor/contrato extra; parcela isolada; ordem de eventos; fatos únicos/imutáveis/vínculo SQL incompatível |
| Operações | Identidade/Admin; cancelamento incerto não reenviado; PAID×cancelamento; estorno integral/entregue; interrupção entre parcelas; estorno UNKNOWN sem reenvio; pagamento tardio com estorno explícito |
| Prazos/manual | Boleto válido após1h/cartão em análise; jobs manuais sobrepostos; consulta indisponível/dryRun; candidato que virou PAID; cancelamento com estoque retido; confirmação/estorno manual auditados |
| Notificação/HTTP | Payload/chave congelados após falha; janela23h respeitada; autenticação e persistência HTTP; endpoint de supervisão; retry administrativo não concede nova submissão |
| TypeScript/ESLint | Typecheck/build passaram; ESLint dos arquivos da etapa e fixtures adaptadas sem erros ou avisos |
| Migrations | Banco vazio/sintético, diff vazio,33 migrations, segundo deploy sem alterações, checks/triggers conferidos e legado preservado |
| Clone protegido | Dois restores equivalentes do backup04/10; upgrade/diff/reaplicação e dados/sequências preservados; sem nova conexão à origem |
| Build isolado | Build de produção/tipagem e geração de **55 páginas** passaram; `.next` e `next-env.d.ts` do workspace preservados |
| CI | Seleção ampliada para15 suites; nenhum job remoto, push, commit ou deploy executado |

Comandos usados: `node scripts/run-isolated-tests.mjs` com as15 suites explicitadas no CI; `node node_modules/vitest/vitest.mjs run tests/unit`; `tsc --noEmit --incremental false`; ESLint direcionado; `node scripts/verify-runtime-migrations.mjs`; `node scripts/verify-restored-clone.mjs --backup-dir <backup-protegido-existente>`; `node scripts/verify-isolated-build.mjs`. URLs de testes/provedores foram controladas pelo executor; nenhum teste financeiro acessou o gateway real.

Na primeira regressão conjunta,210 cenários passaram e um teste de identidade convidada falhou porque esperava que ASAAS_GATEWAY atestasse um PIX **manual**. A fixture passou a exigir administrador real, manteve cancelamento SYSTEM sem User fictício e verificou ausência de efeitos na conta declarada pelo convidado. Não foi introduzido bypass de produção. Testes antigos de webhook/expiração foram ajustados para recebimento durável/deadline persistido, e falha de aprovação local passou a exigir rollback da transação completa.

### 19.7. Limites de homologação, liberação e próximo pacote

Nenhuma migration foi aplicada ao banco persistente e nenhum pagamento/cancelamento/estorno/email externo foi executado. Snapshot protegido04/10 não substitui backup/preflight atuais antes de rollout. Código com modelos novos não deve iniciar contra schema antigo. Não houve commit/deploy/alteração de `.env`; as alterações anteriores foram preservadas.

A suíte comprova abandono de lease e falhas/interrupções controladas, **não** morte real de processo em infraestrutura de produção. Permanecem obrigatórios: sandbox da conta e métodos/parcelas; eventos reais de recusa/reembolso/chargeback; consulta de exclusão e recuperação de artefatos; provas/calendário de boleto/PIX; envio Resend e perda real de resposta; cron externo/concorrência entre instâncias/carga/limites de duração; alertas e revisão operacional; retorno físico/estorno parcial; datas bancárias/histórico; inventário e conciliação legados. Não habilitar método sem contrato/evidência correspondente.

WF-15 deve integrar consumidor ao contrato completo: revisões das respostas assíncronas, frete/quantidade, pontos/histórico, mutações versionadas do carrinho, identidade/logout/abas e confirmação incluindo REVIEW/CANCEL_PENDING/REFUND_PENDING. WF-16 conclui Admin/expedição/retirada; WF-17 métricas; WF-18 legado/contratos/observabilidade; WF-19 candidato/sandbox/recuperação; WF-20 implantação/observação.

**Próxima etapa naquele checkpoint: WF-15 / LA-034/007/024/016/025. Restavam seis etapas principais, WF-15–WF-20.** Dos38 LA: **28 com módulo/integração local, dois parciais (LA-002/033) e oito sem implementação principal**. Nenhum achado foi VALIDADO em WF-19 ou ENCERRADO EM PRODUÇÃO. Consultar a seção20 para o avanço posterior.

## 20. WF-15 — cliente, carrinho, frete, cobrança e confirmação

**Data:** 05/10/2026. **Autorização:** “pode seguir para a próxima etapa”. **Escopo:** LA-034/007/024/016/025, integrando os contratos construídos em WF-11/13/14. Estado: **IMPLEMENTADO NO MÓDULO, com ensaios locais de serviço, PostgreSQL, HTTP e navegador**. Os gates de candidato/sandbox/produção continuam abertos.

### 20.1. Revisões e sincronização do carrinho — LA-034/016

- `AsyncRevision` cerca CEP, frete e proposta por geração. AbortController interrompe transporte quando possível, mas uma resposta antiga continua sem autoridade mesmo quando o transporte ignora cancelamento. CEP novo revoga dados derivados antigos; resposta não sobrescreve campos editados enquanto a consulta estava pendente. Alteração de endereço, itens, revisão da fonte ou modalidade revoga cotação/consentimento anteriores.
- `createCartStore` mantém uma fila por loja/usuário, valida DTO/identidade e envia commandId, cartId e expectedVersion. Só uma falha de transporte admite repetir o mesmo comando/corpo uma vez;409 exige leitura/reconciliação, sem repetir a intenção sobre outra versão. Não há rollback de um objeto inteiro que restaure item removido por outro comando. Recibo COMPLETED não vira ACTIVE no cliente.
- `CartProvider` recebe a identidade resolvida no layout servidor. Mudança de contexto descarta estado/requisições antigas;401/403 ou resposta de outra identidade bloqueiam o cliente com erro explícito. BroadcastChannel transmite somente invalidação, sem dados de compra. Foco, retomada e visibilidade buscam o ACTIVE atual e revalidam o contexto servidor.
- Checkout carrega o carrinho ao entrar e distingue carregamento, erro, identidade convidada e vazio. Leitura em segundo plano mantém o formulário e seus campos, inclusive após erro temporário; confirmação fica bloqueada até sincronizar. Uma fonte diferente reinicia o contexto do formulário. Preços atuais vêm do catálogo na leitura, sem alterar artificialmente a revisão do carrinho; servidor continua recalculando/validando a proposta.
- Recuperação usa a intenção autorizada no backend. O URL transporta o ID; `sessionStorage` guarda apenas apoio opcional, sem autoridade financeira. A confirmação recebe sourceCartID/sourceCartVersion, cerca leituras anteriores e busca o ACTIVE atual. Reabrir compra antiga não elimina itens adicionados depois, nem arquiva todos os ACTIVE da conta.

### 20.2. Contrato de frete — LA-007

`lib/commerce/freight-contract.ts` é consumido pelo handler de cotação, autoridade de itens e formulário. Request envia IDs/quantidades e CEP; preço, dimensões, configuração e vínculo continuam autoritativos no servidor. Response é `{success:true,data:{serverTime,merchandiseSubtotal,options}}`, com token/ID/prazo obrigatórios por opção. Não aceita array solto, opção sem autorização ou preço negativo como cotação válida.

Loading, opções, lista vazia, erro e expiração são estados distintos. DELIVERY só avança com endereço completo e opção atual não expirada. Subtotal divergente exige leitura dos preços e nova cotação; falha não inventa frete zero. Validades usam relógio do banco fornecido pelo servidor mais tempo monotônico decorrido no navegador, sem confiar no calendário configurado no dispositivo. A base local começa antes da requisição, incluindo seu tempo conservadoramente: transporte lento não prolonga cotação, consentimento ou instrução de pagamento.

A prova de navegador atravessa o **Route Handler real** de frete executado no processo da fixture, com identidade/consulta geográfica injetadas, `FreightOrchestratorService` real, provider de tabela local real e PostgreSQL real. Seu envelope é entregue ao formulário; a cotação persistida/assinada é aceita pelo checkout HTTP canônico do Next isolado. Não foi fabricado token/preço/envelope para fazer a UI passar. Autenticação/geografia desse handler injetado não substituem homologação externa; o restante das sessões, carrinho, intenção, conclusão e recuperação usa handlers HTTP reais do Next.

### 20.3. Entrega e cobrança independentes — LA-024

`checkoutAddressSchema` e `checkoutAddresses` definem shippingAddress, billingAddress e reutilização explícita via billingSameAsShipping. Boleto/cartão exigem cobrança completa em DELIVERY/PICKUP/NONE antes de persistir comprador, pedido ou reserva. Retirada/negociação não recebem endereço logístico artificial. O passo de pagamento coleta cobrança própria ou permite reutilizar entrega somente quando existe; a revisão apresenta ambos separadamente.

Snapshots `OrderBuyer.deliveryAddress` e `billingAddress` conservam as duas finalidades. O gateway recebe CEP/número/complemento de cobrança, inclusive em retirada. Não há escrita no endereço pessoal durante compra nem interpretação/backfill de endereço histórico.

Compatibilidade: `address` legado é traduzido apenas quando nenhum campo novo/reutilização explícita foi enviado. Novos consumidores devem usar campos explícitos. Endereços passam a integrar hash/revisão da proposta; propostas abertas com conteúdo antigo precisam de nova revisão/aceite. Pedido já colocado é recuperado pelo comando/ID persistido, sem reinterpretar seus snapshots ou cobrar novamente. Mudança de DTO/handler/formulário exige publicação coordenada; consumidor novo bloqueia resposta antiga incompleta em vez de presumir validade.

### 20.4. Confirmação financeira completa — LA-025

DTO canônico inclui financialState, paymentState, allowedActions, versão comercial, serverTime e prazo persistido. Backend remove instruções/ações quando o prazo encerrou sem inferir cancelamento ou devolução de estoque. Cliente valida o DTO e representa aprovação, análise/verificação, revisão, recusa, cancelamento pendente/final e estorno pendente/final separadamente.

PIX/boleto precisam de artefatos completos e ação autorizada. PIX manual informa conferência da loja, sem afirmar emissão dinâmica, aprovação imediata ou liquidação bancária. Modalidade NONE/local não é rotulada automaticamente como Correios/J&T. QR não é enviado a gerador externo. Valores financeiros apresentados vêm do snapshot/DTO do backend.

Polling é sequencial, usa backoff em falhas e suspende consultas em aba oculta. Continua acompanhando estado depois de PAID, pois ainda pode haver estorno. Foco/retomada retomam a leitura; falha mantém somente resumo de consulta e suspende ações, sem reativar artefatos antigos. Troca de identidade invalida resposta anterior. Recuperação de convidado continua com autorização por cookie/tenant do protocolo WF-13; não se ampliou leitura pública por ID/email.

### 20.5. Evidências finais e comandos

| Verificação | Resultado local |
|---|---|
| Unitários | **597 passaram,73 arquivos**;29 casos novos de fila/identidade/revisão, contrato de endereço/frete e apresentação financeira |
| Integração conjunta | **230 passaram,17 arquivos**;211 anteriores,15 cenários novos de domínio e quatro casos de navegador |
| Matriz método × entrega | PIX/WHATSAPP_PIX/BOLETO/CREDIT_CARD × DELIVERY/PICKUP/NONE, com entrega/cobrança diferentes; adapter recebe cobrança; invalidação prévia sem efeitos locais |
| Navegador / caso1 | Entrada direta, preservação de campos após atualização e erro do carrinho, compra sem storage, fonte COMPLETED, novo ACTIVE preservado, PAID → REFUND_PENDING → REFUNDED e suspensão de ações em503 |
| Navegador / caso2 | CEP A/B deliberadamente fora de ordem, transporte ignorando abort, edição manual durante B, request sem preços/dimensões e503 de frete impedindo entrega por zero |
| Navegador / caso3 | Envelope do handler/orquestrador real, cotação local assinada/persistida, seleção, revisão e compra DELIVERY HTTP; frete15 e total215 conferidos no banco |
| Navegador / caso4 | Cancelamento com tela aberta e após reload removendo instruções; duas abas no mesmo perfil descartável, invalidação por BroadcastChannel, nova quantidade reconciliada e troca real de cookie/identidade sem itens do titular anterior |
| TypeScript | `tsc --noEmit --incremental false` passou |
| ESLint direcionado | Zero erros; dois avisos preexistentes de `<img>` em formulário/QR, sem correção estilística incidental |
| Build isolado | Produção/tipagem e **55 páginas** aprovadas; `.next` e `next-env.d.ts` do workspace preservados |
| Persistência | **Nenhuma migration nova** em WF-15; as33 existentes foram aplicadas a cada banco descartável. Não houve novo restore/consulta à origem; evidência de clone permanece na seção19 |
| CI | Seleção ampliada para17 suites, Node22 para WebSocket nativo do harness; não executado job remoto, commit ou deploy |

`scripts/lib/isolated-browser.mjs` usa Chrome/Chromium instalado com perfil temporário próprio e [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/). Só encaminha HTTP/WebSocket ao Next descartável que confirmou sentinela/run/database; não se conecta ao navegador do usuário. URLs externas são bloqueadas. O proxy suporta os canais internos de desenvolvimento usados antes da hidratação. Ausência de navegador falha explicitamente; BROWSER_BIN pode indicar seu executável absoluto. Não foram adicionadas dependências npm nem alterada `.env`.

Comandos: `node node_modules/vitest/vitest.mjs run tests/unit`; `node scripts/run-isolated-tests.mjs` com as17 suites do CI; `npm run test:browser:isolated` para os quatro casos; typecheck sem incremental; ESLint direcionado; `node scripts/verify-isolated-build.mjs`. A rodada conjunta230 passou; após reforçar o erro de carrinho/contexto, repetiram-se597 unitários e os quatro casos de navegador, aprovados. Build/typecheck também passaram na revisão final.

Durante a investigação, a comparação de replay foi adaptada para ignorar somente serverTime, que é observação atual, mantendo igualdade de todos os campos de negócio. A fixture unitária antiga de frete que devolvia array foi substituída pelo envelope do contrato. O harness foi corrigido para conservar regex injetada e encaminhar WebSocket do Next; não houve bypass de hidratação/estado no produto. O navegador também revelou texto legado que rotulava PIX manual como dinâmico; a apresentação passou a usar método/estado completos.

### 20.6. Limitações, contingência e próximo pacote

Não houve pagamento, estorno, email, transportadora ou CEP externo real; portas externas são controladas. Ensaios de navegador usam Chrome headless contra Next dev/webpack isolado; **não comprovam** a execução do candidato sob next start, navegadores/mobile de produção, proxy público, latência/carga/instâncias reais ou política de cookies do domínio final. A matriz financeira passa em PostgreSQL com gateway injetado; validação visual de cobrança em todas as trocas de método/parcelas e geografia externa permanece no candidato de WF-19. Logout/troca de contexto são cercados por unidade/HTTP e troca de cookie em navegador, sem certificar todos os provedores de autenticação.

BroadcastChannel é o mecanismo entre abas nos navegadores que o oferecem; foco/retomada revalidam como contingência. Sem ele, aba que permanece aberta precisa retomar/atualizar antes de exibir alterações de outra aba. Em qualquer caso, backend conserva locks/revisões e não aceita compra sobre fonte incompatível. Não se usa armazenamento local como prova de compra.

Rollback operacional precisa conservar intenção/reserva/recibo e contratos compatíveis; não recolocar consumidor antigo que confie em sessionStorage/frete não autorizado ou limpar ACTIVE em massa. Nova versão exige publicação coordenada e leitura/aceite atuais de propostas abertas. Backup/preflight atuais, legado, revisão de políticas e flags, métodos sandbox, scheduler/alertas e homologação continuam obrigatórios. Nenhuma flag financeira foi habilitada.

**Próxima etapa naquele checkpoint: WF-16 / LA-026/037 — expedição/rastreio atômicos e retirada no Admin. Restavam cinco etapas principais: WF-16, WF-17, WF-18, WF-19 e WF-20.** Dos38 LA: **33 com módulo/integração local, dois parciais (LA-002/033) e três sem implementação principal (LA-026/036/037)**. Nenhum está VALIDADO em WF-19 ou ENCERRADO EM PRODUÇÃO. O projeto **ainda não está pronto para produção**.

## 21. WF-16 / LA-026/037 — expedição, rastreio e retirada no Admin

**Data:** 05/10/2026. **Autorização:** “pode seguir para a próxima etapa”. **Estado:** IMPLEMENTADO NO MÓDULO, com ensaios locais de serviço/PostgreSQL/HTTP/Next e navegador. Este checkpoint não substitui a homologação do candidato de WF-19 nem o rollout de WF-20.

### 21.1. Expedição transacional — LA-026

O modal encaminha trackingCode, a versão lida, commandId e uma asserção do shippingProvider contratado ao handler de status. O schema conserva esses campos e o comando central relê modalidade, provedor, status e tentativa financeira sob o lock do pedido. ShippingProvider enviado só verifica correspondência: não troca transportadora, cotação, preço ou snapshot financeiro.

Status SHIPPED, trackingCode, incremento de versão, auditoria, histórico e outbox são gravados no mesmo commit. Colisão/falha real de auditoria, histórico ou outbox reverte status e rastreio. O código integra o conteúdo do recibo; reusar commandId com outro rastreio é conflito, assim como mudar de campo omitido para null. Repetição compatível retorna o estado atual sem repetir efeitos. Um pedido já SHIPPED não responde sucesso por um código diferente que não gravou; a edição posterior usa comando próprio.

| Modalidade / provedor persistidos | Regra efetivamente implementada |
|---|---|
| DELIVERY / CORREIOS | Código obrigatório ao expedir; duas letras, nove dígitos e duas letras, com trim e normalização para maiúsculas. Formato não comprova emissão/postagem real. |
| DELIVERY / LOCAL_TABLE | Código opcional; não fabricar código para entrega local. Trim preserva caixa; máximo128 caracteres, sem espaços internos/controles. |
| DELIVERY / provedor nulo ou outro legado | Formato genérico opcional. Não inferir Correios pelo nome do serviço nem inventar provedor. Reconciliação/decisão operacional permanece em WF-18/19. |
| PICKUP / NONE | Sem etapa SHIPPED nova e sem rastreio artificial. Conclusão usa a política de modalidade. |

Não há backfill. Códigos históricos inválidos não bloqueiam automaticamente pagamento, cancelamento ou confirmação de recebimento. Nova expedição/edição aplica a regra contextual. Pedido legado SHIPPED sem código não é preenchido artificialmente: o titular pode confirmar recebimento sem converter ausência histórica em dado fictício.

### 21.2. Edição posterior, versão e efeitos

PATCH de tracking exige trackingCode (string ou null), expectedVersion e commandId; corpo incompleto retorna400. Reutiliza o mesmo executor/validação/autorização/lock/recibo do status. Permite edição somente em DELIVERY nos estados PAID/SHIPPED/DELIVERED e com evidência financeira compatível. Pedido pendente/cancelado ou em revisão não é alterado. Código obrigatório não pode ser apagado depois de expedir.

A edição mantém status e altera a versão; gera ORDER_TRACKING_UPDATED com valores anterior/novo, ator, histórico da versão e outbox durável. Histórico administrativo diferencia edição de rastreio de transição. Outbox informa changeType=TRACKING; o consumidor não cria email de confirmação financeira apenas porque uma edição ocorreu em PAID. Teste drena o evento real usando porta de email controlada e comprova ausência desse efeito.

Admin ACTIVE da mesma loja é revalidado na transação, com lock compartilhado do ator antes do pedido, consistente com supervisão/estorno. A edição não ganha autoridade SYSTEM ou por identidade enviada pelo corpo HTTP. Falha de autorização não grava efeito.

### 21.3. Ações por modalidade e autoria — LA-037

A exceção PAID→DELIVERED para PICKUP/NONE já existia no comando central após WF-06; a tabela duplicada do modal ainda ocultava a ação. Ela foi removida. A leitura administrativa fornece actions/statuses e política de tracking, derivadas da modalidade/status persistidos e da tentativa financeira mais recente por função compartilhada. O comando aplica a mesma política novamente sob lock; ações exibidas não constituem autorização permanente.

PICKUP/NONE pago conclui diretamente, sem envio. DELIVERY conserva PAID→SHIPPED→DELIVERED. Retiradas históricas SHIPPED por contorno podem concluir sem reclassificação em massa. Confirmação do cliente usa o mesmo comando e a mesma regra de transição, com ownership próprio. Admin é registrado como autor administrativo; não preenche deliveredConfirmedBy/At como se o cliente tivesse confirmado. Confirmação pessoal do titular continua identificada separadamente na auditoria e nesses campos.

A evidência financeira também filtra ações: APPROVED com flag de revisão/conflito não permite expedir/concluir; refund/unknown/submitting não dão permissão logística. Os limites de tratamento financeiro/legado/devolução física de LA-002/033 permanecem abertos.

### 21.4. Consumidor administrativo real

Modal mantém identidade do comando para repetir o mesmo conteúdo após falha de transporte; alteração de conteúdo cria outro comando. Durante envio, não aceita confirmação duplicada e bloqueia alterações no modal. Campo obrigatório desabilita confirmação vazia; validação do servidor continua autoritativa.

Após sucesso, drawer busca o detalhe completo novamente, valida o contrato de operação e apresenta a versão/ações/rastreio persistidos. Não aplica patch otimista sobre objeto antigo. Edição de tracking segue a mesma leitura; notas também releem o detalhe para não restaurar status/versão antigos ao terminar em paralelo. Leituras de outro pedido ou de geração anterior são descartadas. Falha de releitura informa que a mutação foi salva mas a consulta falhou, bloqueia ações sobre o detalhe antigo e oferece recarga.

Conflito409 recarrega detalhe e listagem e conserva a mensagem de conflito no modal. O cenário de navegador inicialmente revelou que o reset ao mudar a versão apagava essa mensagem; o reset foi separado da mudança de versão e o cenário passou. Não se repete automaticamente a intenção sobre o novo estado.

### 21.5. Arquivos e evidências finais

Arquivos principais: lib/commerce/order-command.ts; lib/commerce/order-fulfillment.ts; lib/order-transitions.ts; lib/validators/order.validators.ts; types/admin.types.ts; services/order.service.ts; services/payment/payment-outbox.service.ts; handlers administrativos status/tracking; app/api/orders/[id]/confirm-delivery/route.ts; OrderStatusManager e OrderDetailDrawer.

| Verificação | Resultado local final |
|---|---|
| Unitários | **612 passaram,74 arquivos**;15 casos novos de modalidade, evidência financeira e normalização contextual |
| Integração conjunta | **255 passaram,19 arquivos**;230 anteriores +21 casos de domínio/HTTP +quatro casos de navegador do Admin |
| PostgreSQL/HTTP | Campos persistidos/normalização, recibo e conteúdo, ausência/invalidade de código, provedor imutável, rollback real de auditoria/histórico/outbox e edição, conflitos, tenant/ator/status financeiro, legado e autoria |
| Concorrência | Expedição×cancelamento, conclusão de retirada×cancelamento, edição×cancelamento e duas edições da mesma versão; um vencedor, revisão e estoque/reservas compatíveis |
| Navegador / expedição | Modal real bloqueia vazio, recebe erro422 por código inválido sem mudar PAID, grava/releitura SHIPPED e código, edita rastreio com nova versão e histórico |
| Navegador / PICKUP e NONE | Dois casos reais sem ação SHIPPED, com conclusão direta e autoria administrativa sem confirmação pessoal do cliente |
| Navegador / disputa | Request real do modal retido no proxy; cancelamento vence; resposta409 aparece e estado/ações são recarregados sem rastreio parcial |
| TypeScript | tsc --noEmit --incremental false passou |
| ESLint direcionado | Zero erros/avisos nos arquivos desta etapa |
| Build isolado | Produção/tipagem e **55 páginas** aprovadas, preservando .next e next-env.d.ts do workspace |
| Persistência | Nenhuma migration/schema/backfill novo;33 migrations existentes aplicadas aos bancos descartáveis |
| CI/harness | Seleção ampliada para19 suites; test:browser:isolated cobre oito cenários (quatro checkout, quatro Admin). Nenhuma dependência nova ou job remoto executado |

Suites novas: tests/unit/order-fulfillment.test.ts, tests/integration/order-fulfillment-atomicity.test.ts e tests/integration/order-fulfillment-browser.test.ts. Preparação em tests/setup/fulfillment-fixture.ts usa checkout/consentimento/pagamento manual reais do protocolo; identidade de transportadora é preparada explicitamente na fixture de fulfillment, sem chamar API de postagem. Cada loja/dado pertence ao banco descartável e é limpo pelo escopo existente.

Comandos: node node_modules/vitest/vitest.mjs run tests/unit; node scripts/run-isolated-tests.mjs com as19 suites do CI; tsc sem incremental; ESLint direcionado; node scripts/verify-isolated-build.mjs. A rodada254 passou antes do último cenário de outbox; a rodada final conjunta **255** passou com esse cenário. No primeiro ensaio, uma fixture usou status de usuário inexistente; passou a usar BLOCKED, o enum real. O primeiro ensaio de disputa no browser revelou a perda da mensagem409 descrita acima; a correção passou na repetição dirigida e nas rodadas conjuntas.

### 21.6. Limitações, contingência e próximo pacote

Navegador usa Chrome headless sobre Next dev/webpack descartável. Build passou, mas testes de execução do candidato sob next start, domínio/proxy/cookies finais, mobile/matriz ampliada, carga/instâncias e homologação operacional continuam em WF-19. Não houve Correios/transportadora, CEP, gateway, email ou postagem externa real; código com formato válido não prova que o objeto existe. Métodos/flags financeiros e .env não foram ativados/alterados. Não houve conexão ao banco de origem, migration/limpeza persistente, commit ou deploy.

A entrega precisa coordenar handlers, política, consumidor de outbox e UI: a edição passa a exigir versão/commandId e o drawer depende de actions no DTO. Não retornar ao endpoint que grava tracking fora da transação, nem fabricar códigos/reclassificar legados para liberar operação. Reversão deve conservar pedidos/versões/recibos/auditoria/outbox e, se necessário, suspender essas ações até publicar consumidor compatível. Política de transportadoras novas e exceções legadas exige revisão operacional; nenhum rollout foi realizado.

**Próxima etapa naquele checkpoint: WF-17 / LA-036 — métricas financeiras (LTV/ticket) derivadas dos fatos reconhecidos. Restavam quatro etapas principais: WF-17, WF-18, WF-19 e WF-20.** Dos38 LA: **35 com módulo/integração local, dois parciais (LA-002/033) e um sem implementação principal (LA-036)**. Nenhum está VALIDADO em WF-19 ou ENCERRADO EM PRODUÇÃO. O projeto **ainda não está pronto para produção**.

## 22. WF-17 / LA-036 — métricas financeiras de clientes

**Data:** 05/10/2026. **Autorização:** “pode seguir para a próxima etapa”. **Estado:** IMPLEMENTADO NO MÓDULO, com ensaios locais de serviço/PostgreSQL/HTTP/Next e navegador. Não equivale à validação do candidato em WF-19, aceite de política pelo financeiro ou implantação em WF-20.

### 22.1. Fórmula, população e composição

A política versionada LIFETIME_RECOGNIZED_NET_V1 define LTV líquido como principal financeiro reconhecido menos estornos confirmados. AUTHORIZED e SETTLED referentes ao mesmo instrumento representam uma só base; liquidação registrada também aparece separadamente. Não se soma Order.total só porque existe pedido, status PAID ou autorização comercial local. Fatos pertencem ao pedido/tentativa/provedor/conta correlacionados.

Ticket líquido usa esse LTV dividido pela quantidade de pedidos com principal reconhecido; um pedido com várias parcelas conta uma vez. Pedido totalmente estornado permanece nesse denominador e contribui zero ao líquido. Sem reconhecimento, ticket é zero. A divisão/arredondamento HALF_UP ocorre no NUMERIC do PostgreSQL, e a conversão ao DTO valida centavos e intervalo seguro de representação.

O período é todo o histórico até o snapshot da consulta, em BRL; não há filtro de período ou janela móvel. Busca/paginação selecionam clientes, não recortam as transações do cliente. Datas recebidas são instantes UTC e a UI formata explicitamente em America/Sao_Paulo. firstOrderAt/lastOrderAt indicam criação comercial, não pagamento. asOf informa transaction_timestamp do retrato consultado.

LTV inclui o frete e os encargos de financiamento que integrem o contrato reconhecido, já descontados os abatimentos desse contrato. Não consulta preço atual de catálogo. totalOrderValue é a soma dos valores congelados dos pedidos criados; totalMerchandiseOrdered soma os subtotais brutos de mercadorias solicitadas antes dos descontos, sem frete/juros. Ambos incluem tentativas/cancelamentos e estão rotulados como valores comerciais, não receita nem mercadoria paga. Não há rateio fictício de estorno parcial por produto/frete, nem indicador novo de mercadoria líquida paga. A política não transforma LTV em saldo bancário, margem, receita contábil fiscal ou previsão futura.

### 22.2. Evidência, deduplicação e cobertura parcial

A leitura agrupa instrumentos dentro de cada tentativa. Aprovação e liquidação usam o mesmo principal. Estornos vinculados a charge seguem a garantia atual de proveniência do banco: são devoluções integrais daquela cobrança; o mesmo instrumento não é devolvido duas vezes por repetição. Fatos de estorno sem charge e com identidades de operação distintas são somados; repetição da mesma provider/factKey não cria outro fato. Três parcelas aprovadas somam o total financeiro congelado sem multiplicar o denominador por parcela.

A consulta valida ausência/vínculo de tentativa, provedor/conta, divergência de principal, mistura de autorização integral com autorizações por parcela, devolução maior que o reconhecimento e eventos no futuro. Grupos inconsistentes são excluídos e assinalados para revisão; não são corrigidos silenciosamente por clipping. Se dois recebimentos distintos excederem o contrato do pedido, o dinheiro comprovado não desaparece: a divergência fica sinalizada. Situações SUBMITTING/UNKNOWN, correlação/contrato incompatíveis, estado externo incerto, reversão parcial em revisão e conciliação/reversão vencidas produzem cobertura PARTIAL.

Pedidos legados sem checkoutIntent e sem fatos financeiros ficam em unverifiedOrders e não fabricam receita a partir de PAID/SHIPPED. financialReviewOrders sinaliza revisão; coverage e asOf acompanham lista e perfil. A UI mostra “base parcial” com contagens e explica que os valores representam a parcela verificável. Falta de evidência não significa que o cliente realmente gastou zero no histórico.

Cancelamento comercial, REQUEST_REFUND, REFUND_PENDING e necessidade de retorno físico não provam que dinheiro foi devolvido. Valor só cai quando há fato REFUNDED confirmado. Os testes usam estornos manuais reais e conciliação financeira real com porta de gateway controlada; os cenários de estorno parcial inserem fatos identificados exclusivamente na fixture descartável. **Este leitor não implementa/habilita produtor ou API externa de estorno parcial.** LA-002/033 continuam parciais; o modelo atual também não tem um tipo de fato CHARGEBACK e esta etapa não certifica essa integração.

### 22.3. Leitura única, tenant e consumidores

services/customer-financial-metrics.service.ts é a fonte compartilhada para listCustomers e getCustomerMetrics. Cada serviço lê sob RepeatableRead. A lista agrega os clientes da página em uma consulta financeira; perfil lê os fatos e depois as preferências no mesmo snapshot. Um estorno concorrente não mistura partes antigas/novas dessa leitura; a consulta seguinte observa o commit.

User.lojaID e Order.lojaID devem corresponder ao tenant solicitado; IDs/cursor não dão acesso a outra loja. Lista continua selecionando clientes com pedidos, enquanto perfil de usuário pertencente à loja e sem pedido retorna métricas zero. Cursor de outra loja é rejeitado. O adaptador antigo de services/admin.service.ts delega à mesma fonte, preserva o alias averageTicket e exige tenant em vez de somar pedidos sem escopo.

Preferências usam somente pedidos reconhecidos, com saldo líquido positivo e não cancelados; tentativas não pagas e estornos integrais deixam de contaminar produto/modalidade preferidos. NONE é modalidade explícita. Não há reconstrução da quantidade devolvida por produto no estorno parcial; preferências não representam uma apuração física de devolução.

Handlers de lista/métricas retornam private, no-store. Não foi criada projeção/cache financeiro, nem writer de invalidação: cada request consulta os fatos persistidos no PostgreSQL. DTO tem schema compartilhado de política/cobertura/contagens/datas/moeda/valores. Consumidores administrativos validam o envelope, ignoram leituras antigas e abortam requisições substituídas; erro remove os valores anteriores em vez de exibi-los como consulta atual bem-sucedida.

A UI reconsulta ao focar/retomar, ao retornar do perfil à lista e a cada30 segundos enquanto visível; lista volta à primeira página para não manter páginas de snapshots diferentes. Não há push de webhook para a aba: uma aba ativa pode mostrar o retrato anterior até a próxima reconsulta. Autoridade financeira é o backend, não o estado de React.

### 22.4. Arquivos e evidências finais

Principais arquivos: services/customer-financial-metrics.service.ts; services/customer.service.ts; services/admin.service.ts; lib/commerce/customer-metrics-contract.ts; lib/utils/customer-metrics.ts; handlers administrativos de lista/métricas; app/admin/customers/page.tsx; CustomersTable, CustomerProfilePage e CustomerMetricsPanel.

| Verificação | Resultado local final |
|---|---|
| Unitários | **612 passaram,74 arquivos**; fixture CPF/CNPJ adaptada ao retorno do agregador, sem fallback fictício no produto |
| Integração conjunta | **274 passaram,21 arquivos**;255 anteriores +16 cenários financeiros/PostgreSQL/HTTP +três cenários de navegador |
| Casos financeiros | Tentativa não paga, cancelada sem pagamento,100 pago menos30 parcial, replay de fato, estorno integral/manual, aprovação mais liquidação, três parcelas com juros105,03, arredondamento em centavos e preço histórico |
| Escopo e incerteza | Cliente vazio, tenant/ownership/adaptador sem loja/cursor, DTO HTTP/cache, legado sem fatos, eventos futuros, evidência desequilibrada, UNKNOWN e revisão de estado externo/conciliador |
| Concorrência | Refund commit fora da transação de leitura; antes/depois dentro do RepeatableRead permanecem100, consulta seguinte retorna70 |
| Navegador | Lista/perfil100 equivalentes; solicitação de estorno mantém100; confirmação real e foco atualizam ambos para0; legado marcado parcial;503 remove métricas anteriores e retomada recupera leitura |
| TypeScript | tsc --noEmit --incremental false passou |
| ESLint direcionado | Zero erros/avisos nos arquivos de código/testes desta etapa |
| Build isolado | Produção/tipagem e **55 páginas** aprovadas; .next e next-env.d.ts do workspace preservados |
| Persistência | Nenhuma migration/schema/backfill novo;33 migrations existentes aplicadas aos bancos descartáveis |
| CI/harness | Seleção ampliada para21 suites; test:browser:isolated cobre11 casos (quatro checkout, quatro fulfillment, três métricas). Sem dependência nova/job remoto executado |

Novas suites: tests/integration/customer-financial-metrics.test.ts e tests/integration/customer-financial-metrics-browser.test.ts. Usam a infraestrutura descartável/escopada existente; não leem nem alteram o banco configurado da aplicação. Chrome headless acessa o consumidor administrativo real no Next dev/webpack da cópia isolada. HTTP e persistência reais são usados;503 é injetado no proxy do harness para ensaiar falha de leitura.

Comandos: node node_modules/vitest/vitest.mjs run tests/unit; node scripts/run-isolated-tests.mjs com as21 suites do CI; tsc --noEmit --incremental false; ESLint direcionado; node scripts/verify-isolated-build.mjs. O primeiro caso de parcelamento usou paymentId externo diferente da primeira parcela e foi corretamente mantido UNKNOWN pelo contrato existente; a fixture passou a devolver a referência correlacionada, sem afrouxar validação. A rodada dirigida final16 passou antes da rodada conjunta. Nenhum teste externo de gateway/correio/email foi chamado.

### 22.5. Limitações, contingência e próximo pacote

Os ensaios não certificam volumes de clientes/pedidos/fatos reais, EXPLAIN e latência sob carga, candidato executando sob next start, domínios/proxies/cookies finais, mobile e matriz de navegadores, nem consistência de fatos de gateway real. Métricas leem o ledger disponível: a confiabilidade de sandbox/conciliação/legado depende de WF-18/19. Taxas/impostos não existentes no contrato não são inventados pelo agregador; qualquer composição adicional requer política/fatos próprios.

O aceite financeiro da fórmula, aprovação versus caixa liquidado, denominador e apresentação da cobertura parcial precisa ser registrado no candidato. Extensões de período, chargeback, alocação física de devolução e produtores parciais não podem ser declaradas concluídas pelo resultado desses testes. A suite antiga de desempenho que provisiona grande volume não foi usada como certificado; medição representativa/índices ficam nos gates de carga de WF-19.

Publicação deve coordenar API/DTO/serviços e UI. Rollback não deve voltar a apresentar toda tentativa de pedido como receita, apagar fatos ou inventar estornos; se não houver consumidor compatível, suspender indicadores até recuperar leitura confiável. Não há backfill/correção do histórico nesta etapa. Flags financeiras/worker/expiração continuam sem ativação; .env, credenciais, banco de origem e migrações persistentes permaneceram intocados. Sem operação financeira externa, commit ou deploy.

**Próxima etapa naquele checkpoint: WF-18 — ensaiar dados legados e contrato final. Restavam três etapas principais: WF-18, WF-19 e WF-20.** Dos38 LA: **36 com módulo/integração local e dois parciais (LA-002/033)**; nenhum permanece sem implementação principal. Nenhum está VALIDADO em WF-19 ou ENCERRADO EM PRODUÇÃO. O projeto **ainda não está pronto para produção**.

## 23. WF-18 — clone, inventário dos legados e compatibilidade do contrato

**Data:** 05/10/2026. **Autorização:** “pode seguir para a próxima etapa”. **Estado:** EM EXECUÇÃO. Ensaios técnicos locais realizados; resolução/aceite das exceções de negócio e contrato operacional ainda pendentes. Não foi declarado encerramento dos legados ou prontidão para produção.

### 23.1. Entregáveis e limite de execução

Criada a [matriz de compatibilidade e reconciliação](MATRIZ_COMPATIBILIDADE_E_RECONCILIACAO_LEGADOS.md), com fonte/datas, contagens por domínio, leitores/escritores/constraints, procedimento de repetição e pontos de parada. scripts/lib/legacy-commerce-audit.mjs produz inventário somente leitura com contagens por tenant, tags de registros, vínculos de variantes e gates. Normalização de combinações reutiliza lib/product-variants.ts; transpila a função pura em memória, sem arquivo gerado ou dependência nova.

scripts/verify-restored-clone.mjs aceita --audit-legacy somente com --backup-dir. O clone é criado e conferido pela identidade do container/banco, e a consulta executa em RepeatableRead READ ONLY com timeout120s. Fingerprints/sequências antes/depois confirmam ausência de mutação pelo inventário. Nenhum datasource do aplicativo é usado pelo modo de reutilização; não houve nova captura/conexão com a origem.

Relatório não publica nome/email/CPF/senha/dimensões comerciais/ID remoto ou conteúdo das linhas; usa tags salgadas e contagens. Manifesto fica criptografado AES-GCM no mesmo diretório externo protegido por DPAPI/ACL do backup. automaticRepairs=[] e productionReady=false são explícitos. integrityPassed não certifica efeitos históricos: requiresReconciliation continua true.

### 23.2. Evidência do clone atualizada

Reutilizado backup de public, PostgreSQL18, capturado em **2026-10-04T15:48:28.600Z**. Ensaio final **2026-10-06T00:01:36.434Z a 00:02:35.720Z** (05/10 no fuso local). Dois restores integrais equivalentes, sanitização restrita e restore sanitizado conferidos. IDs/vínculos/valores/colunas históricas/sequências mantidos;33 migrations passaram, diff vazio e segundo deploy sem mudanças. migrate deploy levou **990 ms** nesse clone pequeno, sem extrapolação para volume de produção.

Evidência privada: LOCALAPPDATA/logic-audit-backups/5f81d9017b05f5313103caccd20470e4/evidence-60cb4b9030e5008879ba3955290c0851.json. Manifesto: legacy-commerce-60cb4b9030e5008879ba3955290c0851.json.enc, fora do repositório. Na rodada inicial, o inventário já passou; repetiu-se o clone após ampliar a inspeção de proveniência financeira/reservas/fidelidade, gerando esta evidência final.

| Situação no snapshot restaurado | Quantidade / interpretação |
|---|---|
| Pedidos anteriores ao checkout atual |24; todos sem intenção/chave e reserva demonstrada |
| PENDING histórico |10; idade não prova expiração nem restituição |
| Itens sem variante |33; não foram reassociados a variantes atuais |
| Pedidos com referência remota sem tentativa rastreada |2; conciliação de conta/contrato/efeitos pendente |
| Status financeiro comercial pago sem fatos |4; receita histórica permanece não verificada |
| Pedidos sem snapshot de comprador / sem histórico de status |24/24; lacunas conservadas |
| Entregas sem snapshot da cotação |16; geografia/preço antigos não inventados |
| Carteiras não prontas / movimentos legados de pontos |2/2; nenhum lote, prazo ou saldo novo inferido |
| Duplicatas de combinações de variantes ativas / produtos ativos sem variante ativa |0/0 no snapshot |
| Carrinhos ACTIVE duplicados / vínculos cross-tenant inspecionados |0/0 |
| Proveniência inválida de fatos/reservas/fidelidade inspecionada |0; ausência de fato não prova inexistência de obrigação |
| Constraints não validadas / índices inválidos / triggers desativados |0/0/0; sete guards críticos presentes/ativos |

Categorias se sobrepõem e não devem ser somadas. Antes da sanitização, cinco sessões ainda não estavam vencidas no tempo do ensaio e zero reset tokens ativos tinham formato legado inspecionado. Sanitização vence sessões e redige tokens/endereço/rastreio somente no clone; esses campos não foram homologados como valores reais. O snapshot é de04/10, portanto a reconciliação operacional exige uma base atual antes de liberar.

### 23.3. Barreiras para writers não comprovados

A passagem pelos legados demonstrou que o comando central ainda tinha um caminho de cancelamento que usava OrderItem histórico para incrementar Product.stock sem uma reserva/débito anterior comprovado. Ter variantId preenchido tampouco prova que a baixa ocorreu. Não se preencheram os33 vínculos para autorizar esse caminho.

fulfillmentPaymentError, compartilhada entre ações do Admin e comando sob lock, agora recusa PAID/SHIPPED/CANCELLED em pedido sem checkoutIntentID. A resposta é CONFLICT/LEGACY_ORDER_RECONCILIATION_REQUIRED antes de estoque, ledger, histórico, auditoria ou outbox. Um snapshot financeiro parcial ou tentativa aparentemente aprovada não contorna a falta de origem de estoque. Admin e SYSTEM passam pela mesma barreira; replay/no-op já concluído não reaplica efeitos.

Leitura com ownership e confirmação de entrega física já existente permanecem possíveis. Confirmação SHIPPED→DELIVERED do titular registra sua autoria sem fabricar pagamento, reserva ou restituição. Edição/nova expedição histórica não é reaberta para contornar conciliação. Timeout continua selecionando somente tentativas com prazo persistido, deixando PENDING histórico sem prazo intacto.

Pedidos do protocolo novo mantêm aprovação manual/financeira, reserva, cancelamento, déficit de pontos e fulfillment. O cancelamento de um pedido novo cujo crédito já foi gasto foi reensaiado usando proposta/aceite/pagamento manual reais, gerando dívida100 uma vez. O caso legado recusa a transição e não cria efeitos; pedido explícito de conciliação de fidelidade conserva sua pendência durável idempotente sem alterar saldo/lotes. Não foi implementado um bypass para resolver o histórico por status.

### 23.4. Backfill seguro, interrupção e contrato

Não há migration nova ou alteração das33 migrations anteriores. Foi ampliado scripts/verify-runtime-migrations.mjs para ensaiar o backfill determinístico já versionado: Cart.lojaID herda o User relacionado, CartItem.lojaID herda o Cart relacionado, após auditoria de vínculos e lock de tabelas.

Uma fixture sintética de carrinho arquivado/item com FKs originais válidas foi atualizada. Trigger exclusiva do ensaio lançou erro durante UPDATE, após o ADD COLUMN da migration: a transação reverteu schema e dados; a retomada do mesmo artefato passou. Replay de migrate deploy preservou o resultado e não repetiu efeito. Duplicata ACTIVE/cross-tenant também impediram a migration; resoluções explícitas dessas fixtures não são saneamentos autorizados dos dados reais.

A primeira rodada sintética deixou a fixture de ownership ACTIVE em conflito com as duas fixtures de duplicidade; o carrinho de ownership foi preparado como ABANDONED, sem afrouxar a unicidade ou a migration. A primeira rodada de compatibilidade usou POST onde o handler exige PATCH e enviou lojaID duplicado no nested create de CartItem; ambos foram corrigidos na fixture. A regressão inicial encontrou antigas fixtures de cancelamento que não possuíam origem do pedido: asserts foram alinhados à recusa legada, e o cenário de débito/estorno real passou a construir o protocolo novo.

Inventário e ensaios confirmam constraints atuais, mas não autorizam contraction/NOT NULL global sobre variante/intenção/chave histórica. Não houve remoção de campos/rotas, soma de estoques, escolha de variante primária, backfill de comprador/frete/pagamento/reserva ou ativação de carteira. O saneador antigo de variantes continua bloqueado.

### 23.5. Evidências de testes e comandos

| Verificação | Resultado local final |
|---|---|
| Unitários | **618 passaram,75 arquivos**; seis casos novos da política de legado e sete casos antigos alinhados à recusa de mutação sem prova |
| Integração conjunta | **280 passaram,22 arquivos**;274 anteriores +seis de compatibilidade/inventário/serviço/HTTP |
| Compatibilidade | Inventário não muda dados; duplicatas neutras são reconhecidas com vínculos/estoques separados; financeiro/reserva/chave não fabricados; carteira permanece bloqueada |
| Barreiras HTTP/serviço | Recusa409 com zero efeitos; Admin não oferece ação inválida; loja externa não lê pedido; confirmação pessoal histórica preservada |
| Protocolo novo | Checkout/manual/fulfillment e cancelamento com déficit de pontos continuam ensaiados; timeout não infere prazo antigo |
| Banco vazio/upgrade sintético |33 migrations, diff/checks/guards, backfill de tenant, interrupção no UPDATE com rollback, retomada/replay e rejeição de dados contaminados/duplicados passaram |
| Clone protegido real | Restaurações, hashes, sanitização, histórico, sequências, catálogo, upgrade/replay, diff vazio e inventário readonly passaram |
| TypeScript | tsc --noEmit --incremental false passou |
| ESLint direcionado | Zero erros/avisos nos arquivos de código/scripts/testes desta etapa |
| Build isolado | Produção/tipagem e55 páginas aprovadas, preservando .next e next-env.d.ts do workspace |
| CI |22 suites selecionadas; novo script test:legacy:isolated. Sem dependência nova ou job remoto executado |

Novas suites: tests/unit/legacy-order-policy.test.ts e tests/integration/legacy-commerce-compatibility.test.ts. Atualizadas fixtures de inventory-lifecycle, loyalty-integration, audit-hotfix-phase1 e loyalty-lot-accounting. O teste de estoque direto continua cobrindo reserva/restauração simétricas; cenário de status legado não se faz passar por pedido novo.

Comandos: node node_modules/vitest/vitest.mjs run tests/unit; node scripts/run-isolated-tests.mjs com as22 suites do CI; node scripts/verify-runtime-migrations.mjs; node scripts/verify-restored-clone.mjs --backup-dir <diretório privado existente> --audit-legacy; tsc sem incremental; ESLint direcionado; node scripts/verify-isolated-build.mjs. O ensaio sintético não é descrito como clone real: ambos tiveram execuções/evidências próprias. A rodada conjunta inicial mostrou278/280; após adaptar as duas fixtures de fidelidade e usar o email do titular real no novo checkout de teste, o cenário dirigido e a rodada conjunta final foram repetidos.

### 23.6. Exceções e gate ainda aberto

Conciliação de24 pedidos/33 itens, duas referências financeiras externas e duas carteiras exige comprovantes/identidades históricas, movimentos físicos, conta/contrato do gateway, origem/consumo/validade de pontos e decisão operacional registrada. Nenhuma dessas evidências pode ser derivada com certeza do status, do saldo, da variante atual ou de uma chave nula. O inventário identifica necessidade de revisão, não confirma pagamento/débito/cancelamento antigos.

O bloqueio de writers protege dados, mas recurso suspenso não conta como achado encerrado. LA-002/033 permanecem parciais. Falta ainda o aceite da matriz/contrato final, o tratamento ou resolução explícita das exceções, snapshot atualizado, impacto/tempo/locks em volume representativo e procedimento de operação com responsáveis. Não há responsável/assinatura/RPO/RTO fictícios.

Não houve conexão à origem, alteração de .env/credenciais, DDL/DML persistente, estorno/cobrança/email/transportadora reais, ativação de flags, commit ou deploy. Publicação precisa conservar as barreiras e os contratos novos; rollback não deve reativar restituição histórica por inferência ou apagar fatos para zerar divergências.

**Próximo trabalho disponível: preparar os ensaios técnicos de WF-19, mantendo aberto o fechamento de dados de WF-18.** WF-19 e WF-20 são as duas etapas principais seguintes; além delas resta a conciliação/aceite de WF-18. Dos38 LA,36 têm módulo/integração local e dois continuam parciais; nenhum foi VALIDADO em WF-19 ou ENCERRADO EM PRODUÇÃO. O projeto **ainda não está pronto para produção**.


## 24. WF-19 — regressão integrada em runtime de produção

**Data local:** 05/10/2026. **Autorização:** “Pode dar seguimento”. **Estado:** EM EXECUÇÃO. Foi executada a regressão técnica disponível no build de produção, com duas instâncias independentes, mantendo abertos os gates de dados de WF-18, sandbox, capacidade/infra e aceite do candidato. WF-20 não foi iniciada.

### 24.1. Harness, isolamento e rastreabilidade

Criados scripts/run-production-tests.mjs, scripts/lib/homologation-suites.mjs, tests/helpers/production-request.ts, tests/production/multi-instance.test.ts e a [matriz de homologação integrada](MATRIZ_HOMOLOGACAO_INTEGRADA_WF19.md). package.json passa a oferecer test:production:isolated; CI substitui o build isolado separado por build + regressão de duas instâncias, preservando os gates anteriores. Não houve dependência nova ou pipeline remoto executado.

O executor provisiona PostgreSQL16 em container/banco próprios e papel restrito, aplica as33 migrations e verifica sentinela. Copia fontes para diretório temporário sem .env, realiza next build --webpack, replica o mesmo BUILD_ID em outro diretório e inicia dois next start sob NODE_ENV=production. Cada instância tem processos/caches/arquivos próprios e handshake anterior aos testes. Dependências locais permanecem compartilhadas; não há uso do banco configurado do aplicativo.

Controlador de restart pertence ao harness em loopback, exige token efêmero e só reinicia o processo secundário iniciado pelo executor. Não foi adicionada rota de controle ao aplicativo. Helpers recusam path/origem externa, redirects, identidade divergente ou ausência de duas instâncias. Teardown encerra os próprios processos e descarta container/projetos com escopo conferido; docker ps filtrado pela label do runId final ficou vazio.

Os guias instalados de CLI, deployment, self-hosting e output foram consultados antes da implementação. next.config.js usa output=standalone; o teste de next start consome o build completo. A cópia não replica o pacote standalone nem cache de build. Empacotamento mínimo/engine Prisma/static/CDN/entrypoint da implantação ainda precisam de ensaio no ambiente final.

### 24.2. Falha encontrada entre processos e correção

Primeira execução dirigida de tests/production mostrou cinco cenários passando e dois falhando. Um comprovou dado stale no Admin: B aqueceu settings/admin-config-v2 com enablePickup=true; A confirmou PUT false e invalidou apenas seu cache; novo GET em B ainda respondeu true. A TTL de cinco minutos não assegurava leitura vigente entre instâncias.

getLojaSettings agora consulta a persistência a cada request, mantendo adminLojaSelect e o DTO com indicadores de credenciais. Não houve novo cache distribuído ou migration. Usar apenas configurationVersion para cache de todos os campos administrativos exigiria garantia de revisão para campos adicionais; a leitura direta evita presumir isso. O teste unitário foi atualizado para conferir valores diferentes em duas leituras, sem canários; o teste real entre processos passou.

A outra falha foi recusa correta FREIGHT_QUOTE_SECRET_MISSING em production sem chave de assinatura. scripts/lib/disposable-postgres.mjs passou a gerar FREIGHT_QUOTE_SECRET aleatória por banco, compartilhada por fixtures/servidores, sem chave real/fallback de desenvolvimento. Uma tentativa inicial de replicar a junction de node_modules do pacote standalone encontrou EPERM no Windows; o executor passou a copiar somente a saída consumida por next start, excluindo standalone/cache. Nenhuma dessas falhas foi transformada em sucesso ou contornada no aplicativo.

### 24.3. Cenários novos e resultado conjunto

Os sete cenários reais entre processos verificaram: handshake sem token/errado e destinos externos recusados; mesmo comando de carrinho incrementa uma vez; edição absoluta da mesma revisão tem um vencedor; uma intenção aceita produz um pedido/tentativa/reserva/outbox e replay depois de restart; dois compradores disputam a última unidade sem overselling; Admin B lê a configuração commitada por A; cotação/consentimento são recusados em B após revogação da modalidade por A.

| Verificação | Resultado final |
|---|---|
| Unitários | **618 passaram,75 arquivos**,8,14s |
| Regressão integrada sob o novo harness | **287 passaram,23 arquivos**,89,95s de Vitest:280 integrações anteriores +sete entre processos |
| Navegador | **11 cenários** dentro dos280: quatro checkout, quatro fulfillment, três indicadores, com páginas do build de produção |
| Isolamento negativo | Sentinela missing/mismatched: setup/create/seed/cleanup bloqueados, zero lojas |
| TypeScript | tsc --noEmit --incremental false passou |
| ESLint direcionado | Zero erros/avisos nos arquivos desta etapa |
| ESLint geral | Zero erros/18 avisos; diagnóstico JSON em TEMP, sem autofix |
| Build/runtime |55 páginas, tipagem/compilação e dois next start com mesmo BUILD_ID passaram |
| Schema |33 migrations aplicadas nesta execução; nenhuma migration/schema/constraint nova |
| Teardown | Container do runId final não permaneceu executando; descartes pelo próprio executor |

O Vitest usa NODE_ENV=test para serviços importados diretamente e fixtures; HTTP/páginas executam NODE_ENV=production. A seleção inclui22 suites auditadas mais tests/production; não significa aprovação de todas as suites antigas, execução de carga ou287 E2E. Os11 casos de navegador preservam interceptações de portas externas descritas em suas fixtures.

Comandos desta etapa: node scripts/run-production-tests.mjs (rodada final completa); node node_modules/vitest/vitest.mjs run tests/unit; tsc sem incremental; ESLint direcionado e geral sem autofix; node scripts/verify-test-isolation.mjs; diff --check direcionado e verificação da label do container. A rodada dirigida anterior encontrou os dois problemas descritos acima; a rodada final completa foi feita após suas correções.

### 24.4. Identificação da evidência final

Início/fim UTC: **2026-10-06T02:08:24.468Z / 2026-10-06T02:10:51.534Z**,05/10 local. runId **59012221f1c6d1775b2e9a8eb0a26463**. Build ID **D6DJw9_xjRuHv07DOdtfy**. Node22.15.0, Next16.3.5, Prisma5.22.0, PostgreSQL16. HEAD de partida permanece1d513c217bbeb265234e939d9000a51201bfaaa7 com alterações locais, sem commit/candidato aprovado.

SHA-256 dos fontes copiados antes do build: 8e6cfb4238ff82744f66e9c87093a6aa07c23d0506985f8e9fb99041f0ee8406. tests: a5da38ba7eb5711de096da7b72d451aefbb82ad08323ef984e753db58cc28b02. scripts: 85a8717bccd5f83a129398835165095a8840ecda60271ab198e75172b9be8636. O harness imprime metadados/hashes e externalProviders=false/productionReady=false, sem .env, credenciais ou payload de dados reais. Não registra uma assinatura de release.

Os hashes identificam os inputs desta rodada; alterações posteriores requerem nova evidência. Restaurações reais/vazio/upgrade/backfill da seção23 são evidências próprias de WF-18 e não foram falsamente descritas como reexecutadas aqui.

### 24.5. Homologação ainda aberta

A matriz nova relaciona E01–E14 e os38 LA com cenários/suites e pendências. Todos continuam com homologação final PENDENTE; LA-002/033 têm implementação parcial. Nenhum foi promovido automaticamente a VALIDADO ou ENCERRADO EM PRODUÇÃO.

WF-18 exige provas/aceite das exceções históricas e snapshot atualizado. WF-19 ainda exige sandbox da conta/método com contrato oficial atual, frete/email isolados, morte real antes/depois do I/O e commit com outro executor, produtores parciais/devolução física, política bancária/financeira e matriz ampliada de UI/identidade/navegadores. Restart depois do commit foi demonstrado; não prova recuperação em todos os pontos da operação externa.

Carga não foi executada: faltam volume/pico, latência aceitável, infraestrutura/pool e orçamento de locks. Foi solicitada essa informação ao usuário durante a execução; não foi inventada meta/RPS para aprovar capacidade. A suite antiga de customer-load não serve como certificado sem revisar fixtures/aserts financeiros e instrumentação: o profiler do cliente Prisma do Vitest não observa queries do servidor HTTP separado.

Lint geral tem15 avisos no-img-element, um de declaração/callback no Admin, um de dependência do effect no simulador de frete e uma diretiva de disable sem uso. Avisos não foram convertidos em bugs confirmados sem evidência funcional nem removidos com mudanças de estilo amplas. Revisão de consumidores alternativos permanece na matriz visual do candidato.

### 24.6. Estado e próximo requisito concreto

Avançou-se no trabalho técnico de WF-19, com runtime de produção/duas instâncias e regressão conjunta aprovados. Falta fechar WF-18 e completar integrações/capacidade/infra/aceites de WF-19 antes de WF-20. A próxima execução depende da identificação do ambiente de homologação/contas isoladas, metas de capacidade e provas/decisões de legado. Scheduler/heartbeat/alertas, RPO/RTO, responsáveis, janela e rollout/rollback continuam requisitos operacionais.

.env, credenciais e banco da aplicação permaneceram sem alteração; não houve nova captura da origem, DDL/DML persistente, operação externa, ativação de métodos/worker/expiração, commit ou deploy. Worker true existe apenas nos ambientes efêmeros do teste.

**WF-19 EM EXECUÇÃO; WF-20 NÃO INICIADO; fechamento de WF-18 pendente.** Dos38 LA,36 têm módulo/integração local e dois continuam parciais. O projeto **ainda não está pronto para produção**.


## 25. WF-19 — pacote standalone independente e preflight de configuração

**Data local:** 05/10/2026. **Autorização:** “Pode dar seguimento”. **Estado:** EM EXECUÇÃO. Prosseguiram os ensaios locais de empacotamento do output=standalone e diagnóstico de configuração. Não houve promoção a produção nem encerramento de WF-18/19/20.

### 25.1. Pacote real, fontes removidos e duas instâncias

scripts/run-production-tests.mjs agora aceita a opção fixa --standalone; package.json oferece test:standalone:isolated. O modo padrão next start permanece disponível. Configuração livre, origem externa e seleção de comando arbitrário continuam recusadas.

scripts/lib/isolated-project.mjs permite materializar node_modules em uma cópia temporária por dereference, sem junction para o workspace, instalação ou geração que altere as dependências originais. Descarte verifica caminho em TEMP/prefixo próprio; distingue diretório real de junction e desvincula somente a junction antes do rm do diretório pertencente ao executor.

scripts/lib/standalone-package.mjs inspeciona a saída: recusa .env/.env.*, links simbólicos/junctions e arquivos especiais; exige server.js/BUILD_ID, e produz hash/contagem/tamanho. Copia o artefato rastreado e acrescenta public e .next/static, conforme guia instalado do Next. Não acrescenta todos os node_modules do aplicativo ao pacote.

Dois pacotes com hash idêntico foram relocados para diretórios independentes. **A cópia usada no build, incluindo suas dependências, foi removida antes de iniciar qualquer pacote.** Cada processo executa node server.js, com PORT/HOSTNAME explícitos, NODE_PATH vazio, banco/sentinela descartáveis e segredos efêmeros. O runtime não recebe os fontes do aplicativo ou uma junction para as dependências do workspace. Scripts/fixtures do Vitest continuam usando suas próprias dependências para instrumentar o ensaio.

Prisma realizou consultas reais pelo pacote; GET da página de login e seu JavaScript compilado, asset SVG de public, checkout/carrinho/fulfillment e11 cenários Chrome/CDP foram reensaiados. Restart do processo secundário conserva consulta/replay da compra commitada. A evidência é Windows/x64; não certifica engine Linux, fresh install, imagem/container/CDN/proxy/TLS ou infraestrutura final.

### 25.2. Testes e CI

Novos tests/unit/standalone-package.test.ts (quatro casos), tests/production/package-assets.test.ts (dois casos), tests/unit/production-environment-policy.test.ts (cinco casos). O inventário de pacote rejeita dependência externa/segredo e exige identidade; estágio preserva assets/hash depois de remover a fonte. Testes HTTP verificam conteúdo do SVG e arquivo JavaScript referenciado por uma página renderizada, em ambas as instâncias.

O harness compara hashes de scripts/tests novamente depois do Vitest e recusa registrar evidência se os inputs mudaram durante o ensaio. A rodada exploratória dirigida passou nove testes, mas não substitui as duas rodadas completas finais, que tiveram inputs estáveis. Ambos os modos foram ensaiados com bancos diferentes, sem acessar a origem.

| Verificação | Resultado final local |
|---|---|
| Unitários após preflight | **627 passaram,77 arquivos**,6,92s |
| next start, duas instâncias | **289 passaram,24 arquivos**,99,10s |
| standalone/server.js, dois pacotes | **289 passaram,24 arquivos**,79,60s |
| Decomposição dos289 |280 integrações anteriores (incluindo11 de navegador), sete cenários entre processos e dois de assets; mesmo conjunto repetido, não578 casos distintos |
| Build em cada modo |55 páginas, compilação/tipagem passaram |
| Pacote standalone |2454 arquivos;74.779.703 bytes; dois hashes iguais antes do startup; sem .env/links externos; fontes/dependências do build removidos |
| TypeScript | tsc --noEmit --incremental false passou |
| ESLint direcionado | Zero erros/avisos nos arquivos de scripts/testes desta etapa |
| Teardown | docker ps por label dos dois runIds finais vazio; descarte dos próprios diretórios/processos |
| CI | Gate de standalone acrescentado ao gate de next start; pipeline remoto não foi executado |

As rodadas de runtime ocorreram antes da inclusão do preflight somente leitura e de seus cinco testes unitários. Os hashes abaixo identificam precisamente esses inputs. Esses acréscimos não mudaram a aplicação/artefato em runtime, mas scripts/tests finais têm novo conteúdo; os627 unitários/tipagem/lint foram executados após sua inclusão. Não há commit ou candidato imutável aprovado.

### 25.3. Evidências das rodadas completas

| Campo | next start | standalone/server.js |
|---|---|---|
| runId |f2b53823dae68622c51c589f20166d61 |6e08bfefecd424146edc6848fcbb5013 |
| Início UTC |2026-10-06T02:29:19.499Z |2026-10-06T02:29:19.497Z |
| Fim UTC |2026-10-06T02:31:55.596Z |2026-10-06T02:34:16.631Z |
| Build ID |i4bNqBuKunnPFKzL4epfm |kgRUXOjoFIsLWMn61xUA2 |
| Plataforma |Windows/x64 |Windows/x64 |

SHA-256 dos fontes copiados: **1d63f595bb152ba99f9f16d14d2f667a786bcc9d3b81a6354a6405b12840bdad**. tests nas rodadas de runtime: **5f2d5a19814519d4530fbff8f5480394276fb1ea8aa5b91dfcf521c445926371**. scripts nas rodadas: **e7ffe1afeb6af37eb352bafdf44640fe7e3aee0be089600c5c2d9dcb9f2d3b51**. Hash do pacote standalone pré-runtime: **436f7468e76b199b06e744c88e0069300fa0fffbba0bbe5079bb9cc24c9bcfb8**.

Node22.15.0, Next16.3.5, Prisma5.22.0, PostgreSQL16. As33 migrations foram aplicadas em cada banco próprio; não houve migration/schema novo ou repetição de restore real nesta etapa. externalProviders=false e productionReady=false constam na evidência.

### 25.4. Preflight real sem exposição de segredos

Criados scripts/check-production-environment.mjs e scripts/lib/production-environment-policy.mjs. O comando usa @next/env instalado em processo efêmero para aplicar parser, expansão e precedência reais de NODE_ENV=production. Não imprime chave/token/URL/conexão ou valores de arquivos; reporta códigos, severidade, flags e classificação de destino. Não aceita overrides ou operações remotas e não escreve .env.

A inspeção de texto com parseEnv indicava chave não vazia; **o loader real do Next demonstrou que o valor efetivo ficava vazio**. Em .env, a chave declarada contém uma referência com dólar não escapado. Ao carregá-la, Next expande essa referência e a chave deixa de existir como valor utilizável. .env.local também foi considerado pela precedência; seu conteúdo não foi publicado.

A regra de dólar literal foi conferida no guia local environment-variables. .env.example passou a usar dólar escapado e uma instrução explícita. **.env e .env.local reais não foram alterados**, e nenhum segredo foi copiado/rotacionado. A correção da entrada real requer preservar o valor privado/ambiente correto através do mecanismo de configuração da implantação.

Execução node scripts/check-production-environment.mjs terminou com código1, corretamente:

- ERROR FREIGHT_QUOTE_SECRET_MISSING: chave de pelo menos32 caracteres ausente na configuração efetiva; runtime production recusa assinar cotações.
- WARNING ASAAS_KEY_REMOVED_BY_ENV_EXPANSION: há declaração no arquivo, mas o Next carrega valor vazio. Severidade sobe para ERROR se pagamento remoto estiver habilitado.
- Destino configurado do gateway: PRODUCTION. PAYMENT_REMOTE_ENABLED, PAYMENT_WORKER_ENABLED e PAYMENT_EXPIRATION_ENABLED continuam false; allowlist de lojas remotas ausente.
- Zero chamadas externas, zero mutações persistentes e productionReady=false.

Presença/prefixo de credencial não comprovam validade ou propriedade da conta. Flags false não são defeito: conservam as barreiras até homologação. O preflight verifica sintaxe/pré-condições de configuração; não aprova métodos, scheduler, tenant real, política financeira ou release.

Contrato atual do AsaasClient é explícito: NODE_ENV=production aceita somente endpoint/chave de produção; no modo não production exige sandbox. Homologar o gateway no build otimizado requer definir um contrato de ambiente de homologação compatível, sem usar uma conta de produção como ensaio nem declarar sucesso de adapter controlado como sandbox. O preflight reporta esse contrato existente e não o alterou.

### 25.5. Gate e próximos requisitos

WF-19 ganhou prova do pacote relocável no OS local, assets, dependências rastreadas e Prisma em duas instâncias. Ainda faltam ambiente/OS de implantação definidos, fresh install/infra final, volumes/pico/latência/pool/locks, sandbox/contrato por conta/método e falhas reais entre I/O/commit. Perguntas sobre ambiente de deployment e homologação separada foram apresentadas; não houve resposta usada como aprovação.

WF-18 continua exigindo snapshot atual, provas dos24 pedidos/33 itens e conciliação das referências financeiras/carteiras; dados da origem não foram revisitados. Política financeira/retorno físico/parcial, recuperação administrativa e matriz ampliada de navegadores permanecem pendentes. WF-20 exige responsáveis/janela, RPO/RTO, scheduler/heartbeat/alertas, rollout/rollback e observação.

.env/.env.local, banco e credenciais da aplicação permaneceram intactos. Nenhuma ativação de flags reais, conexão nova à origem, cobrança/estorno/email/transportadora, commit ou deploy.

**WF-19 EM EXECUÇÃO; WF-20 NÃO INICIADO; WF-18 com fechamento pendente.**36 LA têm módulos/integração local; LA-002/033 continuam parciais. O projeto **ainda não está pronto para produção**.

## 26. WF-19 — configuração corrigida e instalação limpa Linux

**Data local:** 06/10/2026. **Autorização:** “Faça isso”, dando continuidade às pendências comunicadas. **Estado:** WF-19 EM EXECUÇÃO; fechamento de WF-18 e liberação WF-20 continuam pendentes.

### 26.1. Correção local de configuração

Foi feito backup privado de .env em diretório próprio sob LOCALAPPDATA/Projeto/private-config-backups, fora do repositório. A alteração foi guardada por conferência dos bytes antes da escrita e verificação do loader real @next/env; falha teria restaurado os bytes originais. Nenhuma chave ou conteúdo do backup foi impresso.

A declaração ASAAS_API_KEY recebeu escape de dólar literal. O valor carregado pelo Next foi comparado integralmente ao valor privado original, em memória: **credencial preservada**, sem troca de conta ou rotação. FREIGHT_QUOTE_SECRET estava ausente e recebeu32 bytes criptograficamente aleatórios representados por64 caracteres hexadecimais. Valores efetivos das demais variáveis foram comparados antes/depois e permaneceram iguais; .env.local não foi editado.

O preflight passou duas vezes após a correção, com código0 e issues=[]: configurationPassed=true, productionReady=false, destino PRODUCTION e flags remoto/worker/expiração false. Não foi chamada a API Asaas, validada a conta ou habilitado método/scheduler. .env/.env.local permanecem ignorados pelo Git.

A correção vale para novos processos que carreguem a configuração. Processo já iniciado precisa receber reinício controlado; não foi encerrado um servidor do usuário. Cotações assinadas com outra chave precisam ser recalculadas. A chave local não foi enviada à infraestrutura final; todas as instâncias do mesmo ambiente precisarão usar a mesma chave via armazenamento privado de configuração, sem incluí-la no artefato.

### 26.2. Executor Linux reproduzível e isolado

Criado scripts/verify-linux-standalone.mjs, disponível por **npm run test:standalone:linux**. Não aceita argumentos, URLs, contas ou comandos livres. Requer Docker operando em Linux e acesso ao registro npm/imagem base. Não monta o workspace, o Docker socket ou arquivos reais de configuração dentro dos containers.

copyIsolatedProject ganhou linkDependencies=false: nesse modo copia a lista existente de fontes/configurações/public/schema, sem copiar/juntar node_modules. O comportamento dos outros executores foi preservado.

O ensaio cria imagem própria a partir de node:22.15.0-bookworm-slim com OpenSSL/CA, container de build e PostgreSQL16 descartável. Executa npm ci --include=dev, geração Prisma, as33 migrations e build --webpack exclusivamente no container. Configuração Docker é uma allowlist explícita de valores efêmeros; não repassa process.env ou .env do workspace.

Banco é aleatório, papel restrito, sentinela obrigatória e tenant sintético. Containers de build/runtime compartilham somente o namespace de rede do PostgreSQL próprio, mantendo localhost como exigido pelas proteções existentes. HTTP fica interno, sem porta pública adicional. Mutações limitam-se às migrations/fixture do banco descartável.

O mesmo inspector de standalone recusa .env, links e arquivos especiais, acrescenta public/static e calcula identidade. A transferência Linux→TEMP foi conferida por hash. Duas instâncias recebem o mesmo pacote em diretórios próprios. **O container de build, fontes e suas dependências instaladas foram removidos antes de iniciar as instâncias de runtime.** A imagem de runtime contém Node/OpenSSL, sem fontes/dependências do builder.

### 26.3. Resultado e identidade

| Verificação | Resultado nesta execução |
|---|---|
| Preflight real local | Código0, sem issues; nenhuma ativação financeira ou de jobs |
| Unitários | **627 passaram,77 arquivos**,16,85s |
| TypeScript | tsc --noEmit --incremental false passou |
| Sintaxe/lint | node --check e ESLint direcionado do executor/helper passaram, zero erros/avisos |
| Instalação Linux | npm ci e geração Prisma passaram; dependências originais do workspace intactas |
| Linux build | Next16.3.5 em Node22.15.0, Prisma5.22.0; output standalone compilado |
| Runtime Linux | Duas instâncias: sentinela Prisma real, handshake protegido, login renderizado, JavaScript referenciado e SVG público conferidos |
| Restart Linux | Segunda instância reiniciada; todas as verificações HTTP/Prisma repetidas com sucesso |
| Pacote Linux |2457 arquivos;90.386.046 bytes; hash de transferência idêntico ao inspector no builder |
| Descarte | Consulta Docker por label do runId sem containers/imagens próprios remanescentes; diretórios temporários descartados pelo executor |

runId: **95d21e8ebb019a4316bf43b172659d38**. Início/fim do ensaio UTC: **2026-10-06T03:03:03.287Z / 2026-10-06T03:06:40.785Z** (06/10 local). Plataforma **Linux/x64, Debian Bookworm/OpenSSL3**, base node:22.15.0-bookworm-slim. Build ID **cCxDrh_to8XEbiTT2WEnm**. SHA-256 dos fontes copiados: **39aa6545691394ab40589a7fd14a19963a12ae3cf232385751813051d27f6c1f**. SHA-256 do pacote: **0b7eff717b2652b1683d101665b0c4dac4570e61b3075c57b03ecc74fddbf57d**.

O ensaio Linux é **compatibilidade de instalação/build/Prisma/HTTP/assets/restart**, não regressão completa, carga, checkout financeiro real ou imagem final de produção. As rodadas de289 testes em cada modo são as evidências Windows da seção25 e não foram reexecutadas em Linux. A imagem diagnóstica executa com usuário padrão da base; permissões/usuário restrito, volumes, TLS/proxy/CDN, scheduler, limites e configuração final ainda exigem ensaio no deployment escolhido. Não é uma recomendação de provedor de hospedagem nem um release aprovado.

### 26.4. Preparação operacional e bloqueios concretos

Os procedimentos e contratos de supervisão/recuperação foram detalhados na seção19 dos contratos comuns: distingue status de execução, efeitos financeiros e filas; exige avaliação do corpo da resposta, heartbeat do scheduler, política de incidentes e contingência compatível com dados novos. Nenhum cron/monitoramento real foi ativado; documentação não equivale à implantação de WF-20.

Foi solicitada identificação da hospedagem, existência/localização privada de Asaas sandbox e pico/latência esperado. Nenhuma resposta foi usada para presumir ambiente, conta ou aprovação. Permanecem:

1. **WF-18:** atualizar snapshot e conciliar/decidir com provas os24 pedidos/33 itens sem variante, duas referências financeiras e duas carteiras identificados no snapshot anterior. Não atribuir variante, estoque, pagamento ou origem de pontos por suposição; nenhuma nova consulta/mutação na origem foi realizada.
2. **WF-19 externo:** contrato de ambiente sandbox compatível com NODE_ENV=production, conta/credenciais isoladas, PIX/boleto/cartão/estorno, email/frete e morte antes/depois do I/O/commit.
3. **WF-19 capacidade/infra:** hospedagem, volume/pico/latência/pool/locks, carga e regressão no candidato/infra final, navegadores/métodos/identidades e revisão/aceite por LA.
4. **WF-20:** responsáveis, RPO/RTO/janela, backup/restore atual, scheduler/heartbeat/alertas funcionais, liberação gradual, contingência e observação de ciclos reais após fechamento dos gates anteriores.

Banco persistente, flags, conta/credencial do Asaas e .env.local não foram alterados. .env recebeu somente as duas correções locais descritas. Houve download de dependências/imagem e operações exclusivamente em infraestrutura descartável; não houve chamada a provedores comerciais, cobrança/estorno/email/frete, migration persistente, commit ou deploy.

**36 LA com módulo/integração local; LA-002/033 parciais; nenhum VALIDADO ou ENCERRADO EM PRODUÇÃO. WF-19 EM EXECUÇÃO; WF-20 NÃO INICIADO. O projeto ainda não está pronto para produção.**

## 27. WF-19 — metas recebidas e piloto de capacidade com navegador

**Data local:**06/10/2026. Continuidade da homologação autorizada pelo usuário. O fornecimento de estimativas e a confirmação do significado do tempo de resposta permitiram preparar um piloto limitado; não houve aprovação de implantação ou de chamadas financeiras no ambiente publicado.

### 27.1. Informações recebidas e limites de verificação

| Informação | Estado nesta etapa |
|---|---|
| Visitantes/dia |100–300, informado pelo usuário |
| Usuários simultâneos |30–80 no pico, informado pelo usuário |
| Checkouts/minuto |2–5 no pico, informado pelo usuário |
| Tempo desejado |Menos de1s /1,5s; o usuário esclareceu que se refere ao **carregamento completo das páginas**, não à resposta da API |
| Métodos |Pix, cartão, boleto; sandbox Asaas existente, conforme relato |
| Aplicação |Vercel Hobby, Fluid Compute habilitado, duração300s, região iad1/Washington; URL provisória continental-prototipo.vercel.app |
| Banco |Neon Free, AWS São Paulo, compute atual0,25 CU mínimo/máximo, scale to zero habilitado, só branch main |
| Configuração privada |Usuário informou chaves Asaas cadastradas na Vercel; conta/escopo/validade/endpoint/webhook e revisão publicada não inspecionados |
| Campanhas e condições de cliente |Campanhas, dispositivos/rede e critérios finais de percentil/máximo não definidos |

Recursos efetivos das Functions ainda precisam de conferência: o usuário apresentou valores alternativos de CPU/memória. Não foi presumido um tamanho com base no relato. A configuração do projeto no Neon não foi generalizada como limite universal do plano.

O contrato de medição e os próximos gates estão na seção20 dos contratos comuns. Para implantação comercial, o Hobby deve ser substituído por um plano compatível com uso comercial; cron diário não atende automaticamente ao consumidor financeiro com prazos de minutos. Distância iad1→São Paulo e retomada do banco após suspensão devem entrar nos ensaios reais. Não houve alteração de plano/região, criação de branch, provisionamento de variáveis na Vercel ou acesso às chaves. Fontes oficiais: [Hobby](https://vercel.com/docs/plans/hobby), [cron](https://vercel.com/docs/cron-jobs/usage-and-pricing), [regiões](https://vercel.com/docs/functions/configuring-functions/region), [compute Neon](https://neon.com/docs/manage/endpoints/).

### 27.2. Executor e modelo do piloto

Criado **npm run test:capacity:isolated**, opção fixa --capacity do executor de produção. Não aceita URLs, seleção de arquivos, parâmetros de carga ou comandos livres. Copia fontes sem .env, aplica as33 migrations em PostgreSQL16 descartável/sentinela e compila Next16.3.5; duas instâncias next start recebem o mesmo build e banco, com diretórios/caches separados. O provisionador e o navegador mantêm as proteções e o descarte do escopo próprio.

tests/load/storefront-capacity.test.ts cria loja própria,36 produtos/variantes neutras,80 contas/sessões/carrinhos e estoque200 no produto usado pelos checkouts. Dois perfis sequenciais de120s:30 usuários HTTP e2 checkouts/minuto;80 usuários HTTP e5 checkouts/minuto. Cada usuário alterna HTML da vitrine, API de produtos com limite100 e carrinho, com cinco segundos entre requests. Essa frequência e a duração são hipóteses delimitadas do piloto; não foram inferidas dos visitantes/dia. Reporta atraso de emissão, concorrência HTTP em voo e drenagem, sem confundir usuários virtuais com requisições simultâneas efetivas.

Um Chrome desktop por perfil navega alternadamente em / e /checkout, com cache desabilitado. A instrumentação registra evento load, LCP auxiliar e prontidão de conteúdo após documento/fontes, imagens visíveis, título/botões da home e formulário habilitado de checkout. Conferência de pathname evita capturar métricas do documento anterior. Imagens sintéticas são locais; mídia HTTPS externa é bloqueada pelas proteções existentes do navegador. Portanto o indicador de prontidão é **parcial para a meta de página completa**, não uma certificação de conteúdo remoto ou de todos os dispositivos.

Os fluxos de compra usam **WHATSAPP_PIX/MANUAL com retirada**, sem Asaas: inclusão no carrinho→intenção→aceite→commit→replay em outra instância. Ao fim de cada perfil, verifica pedidos/tentativas/itens, uma reserva e outbox por pedido e redução exata de estoques. Métricas HTTP abrangem toda a resposta; o handshake de identidade ocorre antes e acrescenta carga, mas fica fora do cronômetro da resposta. Tempos de fluxo incluem as etapas HTTP de compra e excluem preparação da conta e replay posterior.

O piloto **não falha automaticamente pelo tempo de página**: aprova ou reprova as invariantes funcionais e relata separadamente localReadinessWithinTarget. Assim, testes verdes não significam meta de desempenho atendida. A associação exploratória1s/30 usuários e1,5s/80 usuários não é um SLO final aprovado. Não mede80 browsers reais, rede móvel/CDN/TLS, resources Vercel/Neon, scale to zero, locks/pool instrumentados, catálogo real, tráfego diário prolongado, campanhas ou gateway/email/frete externos.

Vitest detectava execução por agente e ocultava console de testes aprovados. A primeira rodada passou11 testes/3 arquivos, mas não produziu métricas visíveis utilizáveis; não se inventaram tempos. O executor passou a selecionar explicitamente o reporter default apenas no perfil de capacidade. A suite é omitida fora de TEST_CAPACITY_RUN=true, para não introduzir este perfil de quatro minutos nos ensaios antigos de load/dev; execução avulsa comprovou dois casos omitidos sem conexão ao banco. A guarda de identidade/ambiente permanece obrigatória quando o perfil está ativo.

### 27.3. Resultado final e identidade

**11 testes passaram em3 arquivos,251,14s**: dois perfis de capacidade, sete cenários entre processos e dois de assets. Essa seleção não equivale a repetir a regressão completa de289 testes nem a homologar os métodos do gateway. Typecheck sem incremental e ESLint direcionado passaram, zero erros/avisos nos três arquivos de código da etapa. Build isolado compilou55 páginas. Vitest emitiu o aviso existente sobre formato CommonJS da configuração para um loader futuro; não impediu o ensaio.

Valores abaixo arredondados para milissegundos. O p95 de páginas, com somente14–15 amostras por rota/perfil, coincide com o máximo observado; é exploratório, não uma estimativa estável de produção.

| Indicador |30 usuários /2 checkouts por minuto |80 usuários /5 checkouts por minuto |
|---|---:|---:|
| Janela programada |120s |120s |
| Janela medida, incluindo drenagem/verificações |121,963s |121,955s |
| Requisições cronometradas pelo helper |736 |1960 |
| Falhas HTTP/exceções do helper |0 |0 |
| Máximo de requisições do helper em voo |2 |2 |
| Resposta HTTP agregada, p95 |29,0ms |24,2ms |
| Atraso de emissão, p95 |14,0ms |13,9ms |
| Compras manuais únicas |4 |10 |
| Fluxo manual de compra, p95 |533,8ms |317,3ms |
| Home, amostras |15 |15 |
| Home, evento load, p95 |321,3ms |296,3ms |
| Home, conteúdo pronto, p95 |**6116,6ms** |**6094,9ms** |
| Checkout, amostras |14 |14 |
| Checkout, evento load, p95 |130,7ms |116,8ms |
| Checkout, formulário/conteúdo pronto, p95 |255,6ms |227,2ms |
| Limite exploratório do perfil |1000ms |1500ms |
| localReadinessWithinTarget |**false** |**false** |

As2696 respostas cronometradas não incluem requests de assets/navegador, warm-up ou handshake; não são o total de acessos gerados. Concorrência de usuários representa sessões HTTP com pausas, não80 requests simultâneos: houve no máximo dois requests do helper em voo neste servidor rápido. Não se demonstrou capacidade para80 browsers ativos ou80 requests concorrentes.

O p95 das rotas foi: HTML da home21,9/17,9ms; produtos13,4/12,5ms; carrinho31,8/29,1ms; intenção71,7/50,3ms; checkout197,5/152,8ms, respectivamente nos perfis30/80. Isso descreve o ambiente local quente; não estima a latência do Neon, CDN ou Asaas. Ao final havia14 pedidos manuais únicos,14 reservas/outboxes e estoque186 no produto/variante, sem duplicação pelos replays. Fixtures foram descartadas; esses dados não são compras reais.

| Identificação da rodada final | Valor |
|---|---|
| runId |ea894c7765e03be08da4e6ddeb000df2 |
| Início / fim UTC |2026-10-06T15:55:24.079Z /2026-10-06T16:00:22.955Z |
| Build ID |CQlJaggqjCFYrZp1IymN1 |
| Runtime |Windows/x64, Node22.15.0, Next16.3.5, Prisma5.22.0, PostgreSQL16; dois next start |
| Fontes copiados, SHA-256 |e8a9bc273b5462a2af013add37af839ea07771fdf6ab855e3bd2827cf9d8b3a8 |
| Tests, SHA-256 |be171afe84f95ecc9b5739e5b8212cb6dd58a6d4a526823d88f670661c83d283 |
| Scripts, SHA-256 |51869d9cc20522d344dd80601558ae0a2c5d7d6349dbdb19932067c7e280880b |
| Certificação de página completa / provedores / produção |fullPageCertified=false / externalProviders=false / productionReady=false |

Os inputs de scripts/tests permaneceram estáveis durante a rodada final. A tentativa inicial encontrou Docker indisponível antes do provisionamento; iniciado o Docker Desktop local, os ensaios seguintes usaram somente containers próprios. A rodada exploratória sem métricas visíveis teve runId7cf5023f4f201081240a397681408c62 e passou11 testes, mas não substitui a evidência final acima. Não somar essas repetições como22 casos distintos.

### 27.4. Interpretação e próximas ações

**A meta de prontidão da home não foi atendida no piloto.** components/home/HeroVideo.tsx mantém o conteúdo inicialmente oculto, revela após currentTime>=2,8s e, com vídeo bloqueado, aciona fallback em3800ms seguido da animação GSAP dos botões. Esse caminho explica a diferença entre evento load abaixo de0,33s e conteúdo pronto perto de6,1s. Não é evidência de um gargalo no PostgreSQL nem um novo finding de lógica da auditoria: é incompatibilidade entre a abertura visual existente e a meta desejada.

Foi apresentada uma escolha entre disponibilizar título/botões imediatamente mantendo o vídeo ao fundo ou preservar a abertura cinematográfica com uma meta maior para a home. A decisão não foi recebida nesta rodada; o componente visual não foi alterado. Mesmo eventual aprovação dessa mudança não dispensará repetir as medições com vídeo/imagens externos, rede/dispositivos representativos e candidato publicado.

O checkout passou abaixo dos limites no indicador local parcial, mas **não foi certificado o carregamento completo em produção**. Não houve sandbox Asaas, requisições de carga ao domínio publicado, acesso à branch main do Neon, ativação de flags reais, mudança de .env ou migration persistente, commit ou deploy nesta etapa.

Próximos requisitos: decidir abertura/critério final de página; preparar homologação e credenciais sandbox isoladas com contrato de runtime apropriado; identificar candidato/recursos/ambientes e plano comercial/scheduler; ensaiar páginas completas e Pix/cartão/boleto, estados frios/quentes, concorrência/pool/locks e campanhas no ambiente correto; fechar provas/aceites de WF-18 e requisitos de operação. **WF-19 EM EXECUÇÃO; WF-20 NÃO INICIADO; LA-002/033 parciais; nenhum LA VALIDADO ou ENCERRADO EM PRODUÇÃO. O projeto ainda não está pronto para produção.**

## 28. WF-19 — contrato Asaas Sandbox no Preview Vercel

**Data local:**06/10/2026. Continuidade da implementação autorizada. O usuário confirmou possuir a chave API e o webhook da conta Sandbox. Localização/configuração/validade não foram presumidas; foi solicitada apenas localização e escopo, sem valores privados. A preparação de código é verificável sem acesso à conta; homologação remota depende do ambiente separado.

### 28.1. Observação local e implementação

Preflight com @next/env passou antes/depois, issues=[], configurationPassed=true e productionReady=false. Inspeção efêmera imprimiu somente classificação: endpoint de produção, chave com PRODUCTION_PREFIX e token de webhook presente. Remoto/worker/expiração continuam false. Nenhum valor, hash de credencial ou conexão foi divulgado. .env/.env.local e a conta não foram alterados; possuir chaves Sandbox não implica que as variáveis atuais já foram substituídas ou isoladas.

Criado **lib/config/asaas-environment.mjs**, compartilhado por **AsaasClient.configurationReady** e **scripts/lib/production-environment-policy.mjs**. Antes, NODE_ENV=production tornava Sandbox inelegível também em Preview otimizado. Agora:

| Contexto | Exigência de capacidade/configuração |
|---|---|
| VERCEL=1 e VERCEL_ENV=preview | Endpoint/família de chave Sandbox, mesmo em NODE_ENV=production; produção inelegível |
| VERCEL_ENV=production | Produção; Sandbox inelegível mesmo sob NODE_ENV indevidamente declarado development/test |
| Runtime otimizado fora de Preview identificado | Produção; VERCEL_ENV=preview sozinho não abre a exceção |
| Desenvolvimento/teste ordinário | Sandbox, preservando a regra anterior |

Hosts, HTTPS e paths continuam restritos; URL com credenciais/query/fragmento ou porta não padrão é inelegível. O construtor mantém a recusa de chave de produção em URL Sandbox. Preflight acrescenta expectedGatewayTarget e ASAAS_SANDBOX_CONFIGURATION_MISSING para configuração remota incompatível no Preview. Não ativa métodos, consumer ou chamadas; capacidade/configuração não validam a conta.

.env.example documenta Preview/banco separado sem segredos reais. VERCEL/VERCEL_ENV devem vir da plataforma, com variáveis de sistema habilitadas; não há flag nova de staging nem mudança de NODE_ENV para development. Fontes: [variáveis de sistema](https://vercel.com/docs/environment-variables/system-environment-variables) e [ambientes Vercel](https://vercel.com/docs/deployments/environments).

A **seção21 dos contratos comuns** detalha configuração privada, allowlist/conta estável, banco/tenant de fixtures, URL/token de webhook e sequência de ensaio. O projeto informado ainda tem apenas main no Neon: Preview não isola automaticamente esse banco. Não habilitar workers sobre dados/filas reais; o consumidor pode ler pendências globais além da allowlist de novas compras.

### 28.2. Verificações e identidade

| Verificação | Resultado |
|---|---|
| Unitários completos |**635 passaram/78 arquivos,10,74s**; oito casos novos: sete de ambiente/capacidade e um de preflight Preview |
| TypeScript |tsc --noEmit --incremental false passou |
| ESLint direcionado |Zero erros/avisos nos cinco arquivos de código/testes da etapa |
| Build isolado |Next16.3.5,55 páginas; nova importação .mjs compilou; cópia sem .env |
| Runtime dirigido |**30 passaram/3 arquivos,9,87s**:21 de autoridade de plano financeiro e nove de processos/assets |
| Preflight local final |Código0, issues=[], gatewayTarget/expectedGatewayTarget=PRODUCTION, flags false |
| Provedor/prontidão |Credenciais CANARY nos testes; nenhuma chamada à conta real; externalProviders=false e productionReady=false |

runId **6f324b8e289bd600031e37200147c57e**; início/fim UTC **2026-10-06T16:41:23.571Z /2026-10-06T16:42:29.593Z**. Build **ztayChy2vrnz2H5ARNkQT**; Windows/x64, Node22.15.0, Next16.3.5, Prisma5.22.0, PostgreSQL16; duas instâncias next start. Fontes SHA-256 **ae543bd1a29b0b2c6d977f17dfd514744018e92b159b55e1a3bb24e31f6d9dc7**; tests **8cbd021c98582b2021a21d8a1ecf7aefe87a66bc62ab3823498e26815d8a7b77**; scripts **580f662277f70fc79834797f552f861bbebbf0788917172c46371f59b0dd9072**. Inputs estáveis durante a rodada; recursos próprios descartados pelo executor e consulta Docker por label.

Os casos Preview usam variáveis/chaves controladas, sem fetch. Os30 testes dirigidos são locais: **não são deployment Preview real, autenticação Sandbox ou repetição dos289 da regressão completa, do Linux ou da carga**. Os checkpoints anteriores conservam hashes/limites próprios. O aviso existente do Vitest sobre configuração CommonJS para loader futuro permaneceu, sem falha no ensaio.

### 28.3. Requisitos para execução remota

1. Identificar onde as credenciais Sandbox estão configuradas e seu escopo, sem valores na conversa; não gerar/rotacionar chaves somente por esta preparação.
2. Preparar banco/branch, fixtures/tenant e migrations de homologação comprovados; identificar revisão/build do Preview e variáveis de sistema. Conferir conta/configuração nesse ambiente.
3. Conferir URL/token/eventos e acesso do Asaas ao webhook; preparar consumer/scheduler/alertas e habilitar controladamente o fluxo isolado. HTTP200 do webhook confirma inbox persistida, não liquidação.
4. Ensaiar Pix, cartão e boleto, eventos/falhas/replays/cancelamentos/estornos elegíveis e efeitos finais. Fechar também provas/aceites de WF-18, página completa/capacidade e demais serviços de WF-19, operação e rollout WF-20.

**Sem chamada financeira externa, mutação no banco persistente, configuração/deploy na Vercel, alteração de .env, commit ou promoção de LA. WF-19 EM EXECUÇÃO; WF-20 NÃO INICIADO; LA-002/033 parciais. O projeto ainda não está pronto para produção.**

## 29. WF-19 — cadastro no Preview: validação e apresentação de erros

**Requisito vigente:** mínimo de6 caracteres, conforme solicitação posterior do usuário registrada em29.5. As referências a8 caracteres em29.1–29.4 descrevem o diagnóstico e a implementação anteriores a essa solicitação.

**Data local:**06/10/2026. O usuário informou concluir as migrations do banco separado de homologação, criar a loja fictícia, cadastrar variáveis para Preview da branch homologacao_teste e concluir o redeploy. As imagens anteriores mostraram as migrations, a loja e o escopo das variáveis; seus valores privados e o funcionamento completo do ambiente remoto não foram verificados por acesso autenticado.

### 29.1. Ocorrência e diagnóstico

A imagem da tentativa de cadastro mostra POST /api/auth/register com HTTP400 e uma mensagem genérica. A resposta JSON dessa tentativa foi solicitada em Network/Response; não foi recebida nesta etapa. Não se inferiu o tamanho da senha pelos caracteres mascarados nem se atribuíram os401 anteriores de login, a falha de extensão do navegador ou o bloqueio CSP do feedback Vercel como causa do cadastro.

Dois defeitos independentes foram confirmados nas fontes publicadas na revisão56f3d345d8248adea567993ca8a50ea3f4930213:

1. **Validações incompatíveis:** components/forms/RegisterForm.tsx aceitava senhas a partir de6 caracteres e anunciava esse mínimo. lib/validators/auth.ts exige8 caracteres, e app/api/auth/register/route.ts utiliza esse schema. Com6 ou7 caracteres, o formulário envia dados que a API rejeita com400. Essa sequência é demonstrável pelo código, mas não confirma a senha da tentativa remota.
2. **Erro real ocultado:** a API responde com error e, em falhas de validação, details.fieldErrors. O formulário procurava somente message, mantendo a mensagem genérica mesmo quando a resposta explicava a rejeição. Isso também ocultava o erro de e-mail já cadastrado na loja.

HTTP400 sozinho não distingue validação, e-mail duplicado e falhas posteriores: o catch do handler também devolve400. A causa exata da tentativa publicada permanece pendente da resposta ou dos logs correspondentes.

### 29.2. Correção local

O formulário passou a utilizar registerSchema e RegisterInput compartilhados com a API; mantém a exigência de telefone/endereço dessa interface, associa problemas de endereço aos campos correspondentes e envia os dados validados. O aviso da senha anuncia8 caracteres. Nenhuma regra de senha foi relaxada no servidor.

O tratamento de falha lê error, preserva compatibilidade com message e respostas em texto, apresenta os detalhes de validação e verifica os tipos antes de usar valores externos. Uma resposta inesperada conserva a mensagem genérica, sem renderizar objetos como texto. Campos preenchidos permanecem disponíveis para correção e uma rejeição não mostra sucesso.

### 29.3. Verificação

| Verificação | Resultado e alcance |
|---|---|
| TypeScript | npx --no-install tsc --noEmit --incremental false passou |
| ESLint direcionado | Zero erros/avisos em RegisterForm.tsx e registration-browser.test.ts |
| Unitários existentes |23 passaram em validators.test.ts e cpf-cnpj-persistence.test.ts;2 arquivos,2,07s |
| Navegador isolado |3 passaram em tests/integration/registration-browser.test.ts;17,13s no total da suite |
| Cadastro real local | React/Next, handler, serviço e PostgreSQL: senha de8 caracteres, hash verificável, endereço padrão, sessão persistida e perfil autenticado com HTTP200 |
| Rejeições no navegador | Senhas de6/7 caracteres, CEP curto e telefone ausente não enviam cadastro; e-mail duplicado exibe a resposta real e não duplica usuário |
| Respostas controladas | Proxy do teste injeta details.fieldErrors e corpo de erro inesperado para verificar a apresentação; essas respostas não representam uma falha observada na conta remota |

Executor: node scripts/run-isolated-tests.mjs tests/integration/registration-browser.test.ts. PostgreSQL16 descartável,33 migrations, identidade/sentinela conferidas, cópia temporária de fontes sem arquivos .env e navegador com perfil próprio. RunId final **eed61b3ae0ac95437944721a5edf6f54**. O executor descartou os recursos próprios.

Duas rodadas exploratórias falharam em condições da automação: interação antes de hidratação completa, comparação sensível à caixa de texto transformado por CSS e seleção do formulário de logout após autenticação. O teste foi ajustado para aguardar o formulário de cadastro hidratado e seus valores controlados, localizar esse formulário pelo campo de senha e comparar o texto visível sem depender da caixa. Essas rodadas não são evidência de novos defeitos de cadastro e não entram na contagem de26 testes aprovados na verificação final desta etapa. O aviso existente do Vitest sobre seu loader futuro permaneceu sem impedir os testes.

### 29.4. Estado e próximo requisito

Correção e teste permanecem **locais, sem commit/push ou redeploy nesta etapa**. HEAD continua56f3d345d8248adea567993ca8a50ea3f4930213 na branch homologacao_teste; main local80f00369029fe06360dbe6a150096c5e04e24e6f e origin/main7f9b26e062ec2654420fecffb6dd78ad3ba1e017 foram preservadas. Não houve mudança de schema, migration nova, alteração de .env, acesso ao banco persistente ou chamada financeira externa.

Para confirmar a ocorrência publicada, obter somente o JSON da resposta400, sem o payload que contém senha. A versão remota continua sujeita às incompatibilidades anteriores até receber a correção; senha com pelo menos8 caracteres atende ao requisito atual, mas não elimina outras possíveis causas. Depois da publicação, repetir cadastro/login no Preview e prosseguir com os demais ensaios de WF-19. **WF-19 EM EXECUÇÃO; WF-20 NÃO INICIADO. Esta validação local não certifica prontidão para produção.**

### 29.5. Alteração autorizada do mínimo para6 caracteres

Em06/10/2026, o usuário solicitou que o cadastro aceite senhas com pelo menos6 caracteres. Atualizado registerSchema em lib/validators/auth.ts, utilizado pela API e pelo formulário, e ajustados aviso e mensagens do cadastro. O tratamento de error/details implementado anteriormente permanece. Não houve mudança de schema do banco ou necessidade de migration.

Atualizados os testes de limite: senha de5 caracteres é rejeitada pelo schema; senha de exatamente6 é aceita. O ensaio no navegador rejeita4/5 caracteres antes do envio e conclui um cadastro real local com6 caracteres, verificando hash, endereço padrão, sessão persistida e perfil autenticado. Também verifica e-mail duplicado e apresentação de respostas de erro.

**Verificações:**23 unitários passaram/2 arquivos,1,99s;3 testes no navegador passaram/1 arquivo,16,47s; TypeScript e ESLint direcionado passaram. RunId do PostgreSQL16 descartável **a807106f49fa52eb5715b13f585db037**;33 migrations aplicadas no banco temporário, com identidade/sentinela conferidas. Não houve acesso ao banco persistente ou chamada financeira externa.

Alteração permanece local em homologacao_teste, sem commit, push ou redeploy. main permanece inalterada. O requisito de6 caracteres só estará disponível na versão publicada após envio dessa revisão e novo deployment Preview; essa mudança não confirma, por si só, a causa do400 da tentativa anterior.

### 29.6. Orientação discreta sobre a senha no cadastro

Em06/10/2026, o usuário relatou sucesso após acrescentar um caractere especial e solicitou regras claras sem poluição visual. A inspeção do schema, serviço de cadastro e emissão de sessão não encontrou exigência de símbolos. Acrescentar um caractere também altera o comprimento da senha; a versão publicada ainda não recebeu as alterações locais anteriores. Não foi atribuída uma causa definitiva à tentativa remota sem sua resposta JSON.

Incluída uma orientação permanente em texto pequeno e cor secundária abaixo do campo: **“Pelo menos 6 caracteres; símbolos são opcionais.”** REGISTRATION_PASSWORD_MIN_LENGTH, em lib/validators/auth.ts, é compartilhado pelo schema, placeholder e orientação, evitando mínimos independentes nesses pontos. O campo vincula orientação/erro com aria-describedby, informa o estado inválido com aria-invalid e utiliza autoComplete=new-password. Não foram adicionados painéis, medidores ou listas de requisitos.

**Verificações:**14 testes unitários de validação passaram;3 testes no navegador passaram,16,40s, incluindo cadastro real local com senha abc123, sem símbolos, e perfil autenticado. TypeScript e ESLint direcionado passaram. Executor isolado com PostgreSQL16,33 migrations e runId **8283bd35848c3b2394018363a2bb1c99**; recursos próprios descartados. Nenhum teste novo foi criado para a alteração de texto.

Alteração local em homologacao_teste, sem commit, push, redeploy, mudança de .env ou acesso ao banco persistente. main preservada. Publicação no Preview e verificação no ambiente remoto continuam pendentes; WF-19 EM EXECUÇÃO e WF-20 NÃO INICIADO.

## 30. Alterações pontuais para o Preview de homologação

**Data local:**06/10/2026. O usuário solicitou o ID no painel de usuários e informou que ele ainda não aparecia no site. A conferência da branch remota mostrou a revisão56f3d345d8248adea567993ca8a50ea3f4930213, cujo painel ainda não exibe o ID. As alterações descritas em29 estavam somente na cópia local; um redeploy da revisão antiga não incorpora esses arquivos.

**Escopo desta publicação:** ID completo abaixo do nome na tabela administrativa, em texto discreto e selecionável; validação compartilhada de cadastro com mínimo de6 caracteres; orientação de que símbolos são opcionais; apresentação dos erros da API; atualização dos testes relacionados e deste registro. O ID já faz parte da resposta autenticada de /api/admin/users; não foi necessário alterar a API, o schema ou o banco. A listagem continua limitada à loja do administrador. Não foram criados testes para essa pequena alteração de apresentação.

**Verificação do candidato:**635 testes unitários passaram/78 arquivos,11,29s; TypeScript sem emissão e ESLint direcionado passaram. O cadastro com6 caracteres sem símbolos já foi verificado em3 testes de navegador isolado na etapa29.6. Essas provas locais não demonstram a disponibilidade do novo deployment na Vercel.

**Destino:** somente refs/heads/homologacao_teste. Base local e remota anterior56f3d345d8248adea567993ca8a50ea3f4930213. main local80f00369029fe06360dbe6a150096c5e04e24e6f e main remota7f9b26e062ec2654420fecffb6dd78ad3ba1e017 são referências de preservação. .env/.env.local não integram o envio. Não há migration nova, promoção para Production, alteração de credenciais ou acesso ao banco persistente.

Após o push, a integração Git/Vercel deve construir um novo Preview dessa branch. A confirmação do ID no site exige que esse deployment esteja Ready e que a página esteja usando essa revisão. A imagem anterior comprova a ausência do ID na versão antiga, não uma falha de renderização na nova. **Validação visual remota e continuidade dos ensaios de WF-19 permanecem pendentes; WF-20 NÃO INICIADO.**

## 31. WF-19 — rodapé do carrinho durante atualização

**Data local:** 06/10/2026. A publicação anterior, revisão `b86c2328466c661925027cd8507662886233c730`, recebeu status de sucesso da integração Vercel/GitHub. O usuário confirmou o ID no painel e a inclusão do produto no carrinho. Em seguida, relatou que os totais e os botões desapareciam durante a abertura, com imagens do mesmo produto e um indicador de carregamento na ocorrência.

**Causa confirmada no código:** `CartDrawer` consultava novamente `/api/cart` ao abrir. O store preservava os itens anteriores, mas alterava `loadState` para `loading` e `isLoading` para `true`. O rodapé exigia simultaneamente itens, estado `ready` e ausência de carregamento, desmontando a área completa até o término da consulta. Atualizações ao retornar à aba e mutações também podiam ocultar os botões. O tempo de resposta do banco remoto não foi medido nesta etapa.

**Correção:** manter o resumo enquanto houver itens no snapshot do carrinho. Desabilitar nativamente apenas “Finalizar compra” enquanto uma operação estiver pendente ou os dados não estiverem em estado `ready`; manter “Continue Shopping” disponível. O indicador de carregamento já existente permanece no cabeçalho. Uma falha mantém o resumo anterior, bloqueia checkout e apresenta o erro com tentativa de atualização. Limpeza/troca de identidade continua eliminando o snapshot pelo store existente. Cabeçalho e rodapé não encolhem; a área dos produtos pode encolher e rolar dentro do painel.

**Verificações:** 24 testes unitários existentes do carrinho passaram em dois arquivos; TypeScript sem emissão e ESLint direcionado passaram. Dois testes novos em `tests/integration/cart-drawer-browser.test.ts` passaram em navegador real com Next/React e PostgreSQL16 descartável: abertura e retorno à aba com resposta retida, resumo sem deslocamento, checkout desabilitado, fechamento durante a consulta, falha503 e recuperação; viewport móvel390×700 com sete produtos, rolagem dos itens sem deslocar o rodapé e navegação para `/checkout` após atualização. Nenhum pedido foi criado por esses cliques.

Executor: `node scripts/run-isolated-tests.mjs tests/integration/cart-drawer-browser.test.ts`; runId final `1844a45e5b0a1753ee50fed1e704f251`, 33 migrations no banco temporário, dois testes aprovados em19,24s. Uma rodada exploratória falhou na asserção de texto do resumo e deixou uma resposta retida para o teste seguinte; a automação foi ajustada para consultar o diálogo aberto e liberar respostas após cada caso. Os recursos próprios foram descartados. Não houve teste no banco persistente, chamada financeira externa, mudança de schema ou edição de `.env`.

**Publicação:** destino exclusivo `refs/heads/homologacao_teste`, a partir de `b86c2328466c661925027cd8507662886233c730`. Preservar `main` local `80f00369029fe06360dbe6a150096c5e04e24e6f` e remota `7f9b26e062ec2654420fecffb6dd78ad3ba1e017`. A confirmação visual pelo usuário deve usar o novo Preview após o build. O cenário remoto de pagamento Sandbox permanece pendente; **WF-19 EM EXECUÇÃO; WF-20 NÃO INICIADO**.

## 32. WF-19 — contador, navegação do carrinho e métodos indisponíveis

**Data local:** 06/10/2026. O usuário confirmou a correção do rodapé publicada em `cc6c897b8dde5118feb21b3dc26976ed779264f2`, mas relatou ausência do contador no header e espera para clicar em “Finalizar compra”. A imagem do checkout mostra nenhum método disponível, embora o Pix estivesse visualmente selecionado e acompanhado de instruções de QR Code. O usuário confirmou que **ainda não cadastrou as credenciais Sandbox na Vercel**.

**Navegação:** a espera decorre do bloqueio introduzido em31, associado à consulta realizada a cada abertura. Retirado esse bloqueio do botão que apenas navega para `/checkout`. O rodapé continua estável. O checkout mantém `sourcePending`, a obtenção dos dados atuais, as revisões da proposta e todas as validações do servidor antes de criar o pedido. Entrar na página não emite cobrança nem cria pedido. Leituras simultâneas do store agora compartilham a consulta pendente; uma mutação ou troca de identidade separa as leituras para preservar a ordem e a identidade. Uma conclusão antiga não remove o registro de uma leitura nova.

**Contador:** o componente já derivava a quantidade do carrinho persistido, mas usava `.animate-in`, cuja regra global começa com `opacity: 0`, deslocamento30px e blur. Removida essa animação do contador, adicionados camada/borda e mantido o nome acessível do botão com a quantidade. O número aparece assim que os dados estiverem disponíveis, sem esperar a animação. A imagem recebida não mostra o header; não foi atribuída uma causa exclusiva a toda possível ausência remota do contador. A nova exibição foi comprovada por estilo calculado, geometria e posição na frente dos elementos no navegador local.

**Pagamentos:** conforme a configuração anterior, `PAYMENT_REMOTE_ENABLED=false` e os métodos da loja recém-criada ficam desativados por padrão. O gateway também exige chave/URL compatíveis e autorização do ID da loja. Não foram alteradas essas configurações. Corrigida a apresentação: método desativado não aparece selecionado nem oferece conteúdo de QR Code/cartão/boleto; o botão de revisão da compra fica desabilitado sem método selecionado disponível. A mensagem de ausência de métodos exige resposta de capacidades, separando-a da consulta ainda em andamento. As credenciais Sandbox, o webhook, o executor e a ativação dos métodos continuam pendentes.

**Verificações:** 45 testes unitários passaram em três arquivos, incluindo quatro cenários de consultas compartilhadas e sua separação por mutação/identidade. TypeScript passou; ESLint direcionado sem erros, com um aviso preexistente de `<img>` em `CheckoutForm.tsx`. Sete testes de navegador passaram em `cart-drawer-browser.test.ts` e `checkout-browser-state.test.ts`: contador visível desktop/mobile, rodapé e navegação durante consulta retida, rolagem mobile, ausência de seleção/instruções/revisão sem método disponível e regressão de checkout, recuperação financeira, frete e troca de identidade entre abas. Não foi testada a latência real do Neon/Vercel nem a conta Sandbox.

Executor isolado com PostgreSQL16 e33 migrations; runId final `7e2abaef0ed967f9d7f78a129cc867a1`, sete testes em35,79s. Uma rodada exploratória exigiu ajustar a espera inicial do teste: o botão navegável deixou de indicar o término da consulta, que passou a ser aguardado pelo indicador próprio antes de reter a próxima resposta. Recursos próprios descartados, sem acesso ao banco persistente, mudança de `.env`, schema ou credenciais.

**Destino desta publicação:** somente `refs/heads/homologacao_teste`, a partir de `cc6c897b8dde5118feb21b3dc26976ed779264f2`; preservar as referências de `main` registradas em31. Confirmação visual remota da nova revisão e homologação Sandbox continuam pendentes. **WF-19 EM EXECUÇÃO; WF-20 NÃO INICIADO**.

## 33. WF-19 — rodada financeira local para preservar as franquias Neon

**Data local:** 07/10/2026. O operador autorizou concentrar os testes extensos em PostgreSQL Docker local, reservando verificações breves para o Preview com o banco separado de homologação. O Billing fornecido confirma plano Neon Free, período de 01/10/2026 a 01/11/2026 e assinatura gerenciada pela Vercel. O dashboard de `CContinental-DB` informa 2,2 CU-hours utilizadas, compute padrão de 0,25 CU, Storage de 38,6 MB e Network transfer de 90,82 MB. A análise de consumo e as hipóteses estão em [ANALISE_LIMITES_VERCEL_HOBBY.md](../../../../ANALISE_DE_INFRAESTRUTURA/ANALISE_LIMITES_VERCEL_HOBBY.md).

**Execução:** `scripts/run-isolated-tests.mjs` com `payment-durable-execution.test.ts`, `payment-plan-authority.test.ts`, `checkout-intent-authority.test.ts`, `checkout-browser-state.test.ts` e `test-environment-isolation.test.ts`. Docker disponível, PostgreSQL 16 descartável, 33 migrations aplicadas e identidade/sentinela conferida entre o executor e a aplicação local. RunId **`a668bf392e7de4a8791fe93f8e2660d2`**. Gateway e operações remotas são controlados/simulados nas fixtures; não houve chamada financeira ao Asaas real ou acesso aos bancos Neon.

**Resultado:** **97 testes aprovados, cinco arquivos, 64,10 segundos**. Cobertura direcionada de disponibilidade e autoridade dos métodos, contratos financeiros, checkout/intenção, processamento durável, reconciliação, notificações repetidas, recuperação de falhas e estados do checkout no navegador, além da proteção do banco de testes. O container próprio foi descartado pelo executor e não aparece na conferência final por seu runId. O Vite emitiu aviso sobre futura mudança do carregador de configuração; a rodada terminou com código zero.

**Limites da evidência:** a aplicação dessa rodada utiliza runtime local de desenvolvimento. O resultado não valida credenciais ou métodos da conta Asaas Sandbox, agendamento Cloudflare, entrega real de e-mail, latência/capacidade Neon/Vercel ou prontidão de produção. Os ensaios anteriores de runtime de produção permanecem registrados nas seções anteriores; não foram repetidos ou substituídos por esta rodada.

Preparados localmente o Worker `scripts/homologation/payment-scheduler.worker.mjs`, sua configuração inicialmente desabilitada/sem cron e o [guia do agendador](GUIA_AGENDADOR_PAGAMENTOS_HOMOLOGACAO.md), agora com a sequência Docker antes de publicação. O Worker destina-se somente ao Preview de `homologacao_teste`, inicia com leitura de status, possui prazo obrigatório, não segue redirecionamentos e não registra segredos ou respostas financeiras completas. Seus 14 testes de contrato passaram em uma etapa anterior de 07/10/2026; publicação e métricas reais ainda pendentes. A conta Cloudflare ainda será criada pelo operador.

**Estado do repositório:** HEAD `542c7a7ddab7a1aa22996cb1917e0939e15de65f`, branch `homologacao_teste`; esta etapa registra documentação e verifica código existente, sem mudança na aplicação, `.env`, schema ou credenciais, sem commit/push, redeploy ou contratação de plano. Os arquivos de preparação do agendador continuam locais. **WF-18/19 permanecem abertos; WF-20 NÃO INICIADO.** Próximas evidências: acesso/agendamento breve no Preview, integração financeira real Sandbox e demais critérios da matriz.

## 34. WF-19 — primeira consulta publicada do agendador de homologação

**Data local:** 07/10/2026. O operador criou a conta Cloudflare, verificou o e-mail e publicou `continental-pagamentos-hml` com Wrangler. O resultado informado confirma o endereço `https://continental-pagamentos-hml.vancer-automacoes.workers.dev`, versão inicial `791f3aa2-08b8-4e39-afba-02d4ae88c7ad`, configuração desativada e modo `status`. Depois, cadastrou `CRON_SECRET` e `VERCEL_BYPASS_SECRET` como Secrets no ambiente publicado desse Worker. O rótulo Production da Cloudflare refere-se ao Worker de homologação; o destino da aplicação continua sendo o Preview da Vercel. Nenhum valor secreto é registrado nesta documentação.

**Evidência fornecida pelo operador:** uma consulta com `event: hml-payment-scheduler`, `state: status_checked`, `mode: status` e `accountScope: sandbox-hml`. Início `2026-10-07T20:04:19.940Z`, término `2026-10-07T20:04:24.808Z` (17:04:24.808 em Brasília), duração de 4.868 ms. Contadores `uncertain`, `overdue`, `abandonedLeases`, `untrackedLegacyOrders`, `inbox`, `outbox` e `operations` iguais a zero. A consulta comprova o caminho autenticado Cloudflare → Preview → endpoint de status; não demonstra processamento financeiro, validade da API Asaas ou identidade independente do host do banco.

**Encerramento e contagem:** o operador informou ter publicado `HML_SCHEDULER_ENABLED=false` e excluído o Cron após contar três registros. A análise dos detalhes mostrou que registros de início, conclusão e invocação podem pertencer à mesma execução. O evento de 17:05 retornou `state: disabled`, sem consulta. Após procurar no histórico, o operador confirmou somente um registro com `status_checked`. Portanto, o critério de três consultas consecutivas permanece pendente; o agendador deve continuar desativado até uma nova sessão breve, acompanhando três conclusões em horários distintos antes de desligar a flag e excluir o Cron novamente.

**Limites e continuidade:** testes extensos permanecem locais via Docker; a verificação publicada utiliza o projeto Neon separado de homologação. O consumo dessa sessão não foi medido no painel Neon. Nenhuma operação financeira ou alteração de produção foi executada pelo agente nesta etapa; somente o registro e o guia locais foram atualizados. **WF-18/19 permanecem abertos; WF-20 NÃO INICIADO.**

## 35. WF-19 — quatro consultas consecutivas de status na segunda sessão publicada

**Data local:** 07/10/2026. O operador forneceu três JSONs completos de execuções agendadas do Worker `continental-pagamentos-hml`, versão `0fa31673-4ce2-436d-83da-90538a9cd896`, com Cron `* * * * *`. Todos contêm `event: hml-payment-scheduler`, `state: status_checked`, `mode: status`, `accountScope: sandbox-hml` e `truncated: false`. Os horários e identificadores de execução são distintos.

Na conferência seguinte, o operador forneceu também os três registros da execução de 18:02: início, conclusão `status_checked` e invocação com `outcome: ok`. Os três compartilham o mesmo requestId e representam uma única consulta. A invocação informa `wallTimeMs: 1451` e `cpuTimeMs: 1`; esse dado é uma medição dessa execução, não uma comprovação geral de capacidade do Workers Free.

| Término em Brasília (07/10/2026) | Término UTC | Duração |
| --- | --- | --- |
| 18:01:21.491 | 2026-10-07T21:01:21.491Z | 1.587 ms |
| 18:02:21.355 | 2026-10-07T21:02:21.355Z | 1.451 ms |
| 18:03:21.340 | 2026-10-07T21:03:21.340Z | 1.437 ms |
| 18:04:22.811 | 2026-10-07T21:04:22.811Z | 2.908 ms |

**Resultado:** quatro consultas consecutivas bem-sucedidas confirmadas, de 18:01 a 18:04, todas com os sete contadores de backlog iguais a zero. O critério de pelo menos três consultas consecutivas está atendido. A integração publicada Cloudflare → Preview → endpoint de status e sua recorrência estão validadas para esta sessão observada. Não é necessário repetir o ensaio de status.

**Encerramento informado:** o painel apresentado pelo operador mostrou `No cron triggers configured`, e o operador informou ter alterado `HML_SCHEDULER_ENABLED=false`. Não houve inspeção direta da configuração remota pelo agente. Manter o agendador desativado até a próxima sessão controlada. Os resultados continuam restritos a consultas de status: processamento das filas, integrações financeiras Sandbox, consumo medido do Neon e capacidade/SLO de produção não foram validados por estes JSONs. Próximo passo: revisar o isolamento do Preview e as configurações Sandbox antes da ativação controlada do processador, conforme seção 6 do guia. **WF-18/19 permanecem abertos; WF-20 NÃO INICIADO.**

## 36. WF-19 — preparação do Preview para a sessão do processador

**Data local:** 08/10/2026. Como `DATABASE_URL` e `DIRECT_URL` estão cadastradas como Secret, foi orientado ao operador recadastrar conexões obtidas em Connect no projeto Neon `continental-homologacao`: pooled para `DATABASE_URL`, direta para `DIRECT_URL`, exclusivamente no Preview da branch `homologacao_teste`. O operador informou ter cadastrado as conexões e confirmado os hostnames. Em seguida, confirmou as configurações solicitadas, a alteração de `PAYMENT_WORKER_ENABLED=true` e a realização do redeploy. Essas são evidências declaradas pelo operador; o agente não acessou os valores secretos ou inspecionou o deployment remoto.

**Configuração prevista para o ensaio:** `ASAAS_ACCOUNT_SCOPE=sandbox-hml`, URL/chave Sandbox e ID da loja de homologação, `PAYMENT_REMOTE_ENABLED=false`, `PAYMENT_EXPIRATION_ENABLED=false`, webhook Asaas inativo. O próximo ensaio usa `HML_SCHEDULER_MODE=process`, prazo UTC renovado, um único Cron de um minuto e encerramento após três conclusões `processed` distintas sem falhas ou revisão. A conclusão traz `mode` e `summary`; não contém `accountScope`, que já é conferido pelo Worker na leitura de status anterior ao POST. Uma fila vazia com contadores zerados comprova acionamento e contrato do executor, não tratamento de uma cobrança real.

**Estado:** ensaio publicado do processador ainda pendente de resultados. Nenhuma alteração de código, credencial, plano ou configuração remota foi executada pelo agente nesta etapa; somente este registro foi atualizado. **WF-18/19 permanecem abertos; WF-20 NÃO INICIADO.**

## 37. WF-19 — três execuções publicadas do processador com filas vazias

**Data local:** 08/10/2026. O operador forneceu quatro JSONs do Worker `continental-pagamentos-hml`, versão `c2e2e224-0985-4f3a-9e70-a5bce42d031a`, com Cron `* * * * *`, modo `process` e registros sem truncamento. Os pares `started`/`processed` compartilham os respectivos requestIds e constituem duas execuções distintas, não quatro.

Na conferência seguinte, o operador forneceu a terceira conclusão `processed`, às 11:14:52.233 de Brasília, com requestId distinto, a mesma versão do Worker e os mesmos parâmetros. O critério desta rodada é três conclusões distintas bem-sucedidas; não foi exigida consecutividade para este ensaio do processador. Os eventos de 11:12 e 11:13 não foram apresentados, portanto não há afirmação sobre seus resultados.

| Início em Brasília | Conclusão em Brasília | Conclusão UTC | Duração total | Etapa de expiração |
| --- | --- | --- | --- | --- |
| 11:10:49.812 | 11:10:59.543 | 2026-10-08T14:10:59.543Z | 9.731 ms | 683 ms |
| 11:11:48.561 | 11:11:52.202 | 2026-10-08T14:11:52.202Z | 3.641 ms | 455 ms |
| 11:14:48.683 | 11:14:52.233 | 2026-10-08T14:14:52.233Z | 3.550 ms | 454 ms |

**Resultado observado:** as três terminaram com `state: processed` e `mode: process`. Em `inbox`, `reconciliation` e `outbox`, os contadores `claimed`, `completed`, `retried` e `review` são zero. Em `expiration`, `processedCount`, `cancelledCount` e `errorCount` são zero, com `success: true`. O critério de três conclusões distintas está atendido; não é necessário repetir o teste com filas vazias. Os dados comprovam três invocações autenticadas e respostas compatíveis do executor publicado com filas vazias; não houve trabalho reclamado ou concluído pelos três processadores nessas respostas. Não validam criação ou liquidação de uma cobrança, envio de e-mail, expiração efetiva ou capacidade sob carga. Os JSONs não apresentam medição de CPU; `durationMs` é duração total, não CPU do Worker nem consumo CU-hours do Neon.

**Encerramento e continuidade:** após receber a orientação de desativar `HML_SCHEDULER_ENABLED` e excluir o Cron, o operador informou que encerrou a sessão. Trata-se de confirmação declarada pelo operador; não houve inspeção direta da configuração remota pelo agente. Manter o agendador desativado, `PAYMENT_REMOTE_ENABLED=false`, `PAYMENT_EXPIRATION_ENABLED=false` e webhook Asaas inativo até preparar o próximo teste com cobrança Sandbox. Nenhuma configuração remota, `.env`, código ou credencial foi modificada pelo agente. **WF-18/19 permanecem abertos; WF-20 NÃO INICIADO.**

## 38. WF-19 — preparação do e-mail para o teste de pagamento Sandbox

**Data local:** 08/10/2026. O operador informou que `RESEND_API_KEY` e um remetente autorizado ainda não estão configurados para o Preview da branch `homologacao_teste`.

**Esclarecimento posterior:** o operador informou que já possui uma chave Resend cadastrada no projeto em produção. Não é necessário criar outra conta Resend. A recomendação é criar uma chave adicional de homologação na mesma conta e cadastrá-la no Preview da branch `homologacao_teste`, preservando a configuração de produção. Essa separação é uma recomendação para administrar as credenciais, não uma exigência técnica de uma segunda conta. A existência de chave em produção não comprova a configuração do Preview nem a verificação do domínio remetente; a situação do domínio ainda deve ser conferida no painel Resend. Se já houver um domínio verificado, o remetente de homologação pode usar esse domínio, em vez do remetente de teste.

**Dependência confirmada no código:** `services/payment/payment-outbox.service.ts` exige `RESEND_API_KEY` para a entrega real da confirmação de pagamento. A falta da chave gera uma tentativa para repetição, em vez de concluir a entrega. O remetente é congelado no payload antes da chamada de envio; por isso, configurar também `EMAIL_FROM` antes do primeiro processamento dessa confirmação. O valor padrão usa o domínio `continentalestetica.com.br`, cuja autorização no Resend não foi comprovada. Os testes com filas vazias da seção 37 não exercitaram esse envio.

**Preparação orientada:** criar uma chave específica de homologação no Resend, com permissão `Sending access`, e cadastrá-la como `RESEND_API_KEY` do tipo Secret exclusivamente no Preview da branch `homologacao_teste`. Para o ensaio inicial sem domínio verificado, cadastrar `EMAIL_FROM` do tipo Config com o valor `Continental Homologação <onboarding@resend.dev>`. O e-mail do comprador desse ensaio deve ser exatamente o endereço associado à conta Resend: o domínio de teste só permite enviar para esse destinatário. Salvar as variáveis e realizar o redeploy desse Preview antes de prosseguir com a cobrança. A confirmação da configuração e a entrega real permanecem pendentes; nenhum e-mail foi enviado pelo agente.

**Fontes oficiais:** [criação de chave e permissão de envio](https://resend.com/docs/create-an-api-key); [restrição de destinatários do domínio de teste](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain). Para produção, verificar um domínio próprio e substituir o remetente de teste. Não há contratação de plano, ativação do agendador ou alteração de Production nesta preparação. **WF-18/19 permanecem abertos; WF-20 NÃO INICIADO.**

**Configuração informada e redeploy:** a captura posterior mostra `RESEND_API_KEY` como Secret e `EMAIL_FROM=onboarding@resend.dev` no Preview da branch `homologacao_teste`. O endereço sem nome de exibição é válido. A captura também mostra uma entrada adicional de `RESEND_API_KEY` no escopo geral Preview; a entrada específica da branch tem prioridade. Foi orientada a remoção da entrada geral somente se criada por engano para este teste; essa remoção não foi confirmada. O operador informou em seguida que realizou o redeploy. O agente não inspecionou os valores secretos nem o status remoto Ready. Cadastro e redeploy informados não comprovam autorização da chave ou entrega de e-mail; essa prova permanece para o teste do pedido.

## 39. WF-19 — preparação da primeira cobrança Pix no Sandbox

**Data local:** 08/10/2026. Após o redeploy informado com a configuração Resend, a próxima etapa orientada é habilitar a criação de uma cobrança Pix exclusivamente no Preview da branch `homologacao_teste`, usando o Neon separado `continental-homologacao` e a conta Asaas Sandbox já configurados. `services/asaas/asaas.adapter.ts` exige `PAYMENT_REMOTE_ENABLED=true`, credenciais compatíveis com Sandbox e a loja presente em `ASAAS_ENABLED_LOJA_IDS`. `services/payment/capabilities.service.ts` também exige `enablePix` na loja; a opção correspondente no painel administrativo é “PIX automático”.

**Roteiro preparado:** conferir o deployment Ready; alterar `PAYMENT_REMOTE_ENABLED=true`, preservar `PAYMENT_WORKER_ENABLED=true` e `PAYMENT_EXPIRATION_ENABLED=false` nesse Preview e realizar seu redeploy; habilitar “PIX automático” nas configurações da loja de homologação; ativar o webhook `Continental_Sandbox` existente na conta Asaas Sandbox, com destino ao Preview e eventos `PAYMENT_CONFIRMED`/`PAYMENT_RECEIVED`; criar um único pedido de teste com o e-mail associado à conta Resend e parar na apresentação do QR Code/Pix copia e cola. Manter o Worker Cloudflare desativado e sem Cron nesta fase. Confirmar o pagamento simulado e abrir uma sessão curta de processamento somente na etapa seguinte, após conferir a cobrança criada.

**Resultado pendente:** nenhuma cobrança, confirmação de pagamento, ativação remota ou entrega de e-mail foi executada pelo agente. O aparecimento de um QR Code não comprova liquidação, webhook processado ou pedido pago. Não usar aplicativo bancário para este ensaio; a confirmação será simulada no Asaas Sandbox. Ver [guia, seção 8](GUIA_AGENDADOR_PAGAMENTOS_HOMOLOGACAO.md) e [comportamento oficial do Sandbox](https://docs.asaas.com/docs/faq-sandbox). **WF-18/19 permanecem abertos; WF-20 NÃO INICIADO.**

## 40. WF-19 — erro 422 ao salvar Pix automático no painel administrativo

**Data local:** 08/10/2026. O operador apresentou o painel de homologação com “PIX automático” marcado, aviso `Validation failed` e duas respostas HTTP 422 em `/api/loja/settings`. A captura seguinte da aba Rede mostrou apenas requisições de navegação com HTTP 200, sem o PUT rejeitado. Foi solicitado somente o campo `details` da resposta desse PUT para confirmar o campo exato rejeitado no deployment; essa evidência remota ainda não foi recebida.

**Defeito confirmado no código e reproduzido pelo cenário de teste:** o formulário envia o conjunto completo de configurações ao salvar. A leitura administrativa pode retornar `coverImageUrl` vazio e cores opcionais nulas, valores compatíveis com o schema Prisma e o estado do formulário. A validação do PUT exigia uma URL preenchida para a imagem e strings hexadecimais para as cores, rejeitando esses valores antes da atualização do Pix. Portanto, a configuração de uma chave Pix manual não resolve essa incompatibilidade. Os erros da extensão do navegador e do script de feedback da Vercel apresentados no Console são mensagens separadas do HTTP 422 da API.

**Correção:** aceitar imagem vazia e cores nulas na validação do PUT, mantendo a rejeição de URLs preenchidas inválidas e cores fora do formato. Preservadas as guardas administrativas, o vínculo com o tenant e a atualização transacional. O painel agora mostra mensagens por campo quando recebe HTTP 422. A seção de chave e o indicador do cabeçalho foram identificados como Pix manual, esclarecendo que o Pix integrado recebe cobrança/QR Code do Asaas e não exige esses campos. Ajustada também a declaração da função de carregamento para passar no ESLint da versão instalada.

**Verificações:** nove testes unitários em `tests/unit/loja-credentials.test.ts` passaram; dois testes HTTP de integração em `tests/integration/loja-credentials.test.ts` passaram com Next e PostgreSQL 16 descartável via Docker, runId `e3cf37b41e5c30c2b070a8c8d0b8b936`, 33 migrations e duração Vitest de 3,13s. O teste novo utiliza uma loja com imagem vazia, cores/chave manual nulas e credenciais-canário dos Correios; salva o payload completo com `enablePix=true`, confere persistência e nova leitura e verifica preservação/ausência de vazamento das credenciais. TypeScript sem emissão e ESLint direcionado passaram sem erros ou avisos. A primeira tentativa de integração não iniciou por Docker desligado; o Docker Desktop foi iniciado e a rodada posterior passou. Nenhum teste acessou o Neon, emitiu cobrança ou enviou e-mail.

**Publicação:** commit `a2cbf56dcc539ee1320ed341780e36961b5087ff`, enviado exclusivamente a `refs/heads/homologacao_teste`, a partir de `542c7a7ddab7a1aa22996cb1917e0939e15de65f`. O envio contém somente os quatro arquivos de código/testes descritos; este registro e os preparativos locais de infraestrutura permanecem fora desse commit. A leitura da branch remota confirmou a nova revisão de homologação e a preservação de `main` remota `7f9b26e062ec2654420fecffb6dd78ad3ba1e017`; nenhuma operação alterou `main` local. O container do runId de integração foi descartado, confirmado por listagem vazia com seu label exclusivo. A aprovação local e o push não comprovam publicação Ready ou correção no Preview; após o deployment da nova revisão, repetir o salvamento antes de criar o pedido Sandbox. **WF-18/19 permanecem abertos; WF-20 NÃO INICIADO.**

## 41. WF-19 — salvamento ainda rejeitado no Preview; coleta do campo de validação

**Data local:** 08/10/2026. O operador informou nova tentativa de salvar e forneceu o erro do Console: PUT no endpoint `/api/loja/settings` do Preview retornou HTTP 422. Essa mensagem não contém o corpo da resposta ou os campos rejeitados; portanto não comprova que a nova tentativa tenha a mesma causa da seção 40. Foi solicitado o JSON da aba Rede → requisição rejeitada → Resposta, sem cabeçalhos/cookies, além da mensagem por campo eventualmente exibida no painel.

**Conferências independentes:** a branch remota `homologacao_teste` continua em `a2cbf56dcc539ee1320ed341780e36961b5087ff`. A API pública do GitHub informa estado `success` no contexto Vercel desse commit, descrição `Deployment has completed`, com destino ao deployment `63VTc6X58UPhQrfML47XkNG16S3Y`. A lista de deployments identifica o ambiente `Preview`, deployment GitHub `6939796692`, criado em `2026-10-08T15:33:17Z`. Isso comprova a publicação informada pela integração, não qual revisão foi efetivamente carregada no navegador ou qual campo foi rejeitado pela nova requisição.

**Continuidade:** manter o teste de cobrança aguardando o salvamento correto. A validação ocorre antes de atualizar a loja e não depende do cadastro de chave Pix no Asaas. Nenhuma validação adicional foi relaxada por hipótese, nenhum teste foi repetido sem mudança e nenhuma configuração remota ou credencial foi alterada nesta conferência. Diagnóstico da nova resposta ainda depende do corpo JSON; **WF-18/19 permanecem abertos; WF-20 NÃO INICIADO.**

## 42. WF-19 — confirmação do campo de imagem e correção do payload do painel

**Data local:** 08/10/2026. O operador forneceu o JSON do PUT rejeitado: `details.fieldErrors.coverImageUrl` contém `Invalid URL`, sem outros campos rejeitados. Em seguida, informou `coverImageUrl=/brand/continental-logo-horizontal.png` e confirmou que o cabeçalho já mostra “Chave PIX manual”, evidência da interface nova. O arquivo existe em `public/brand/continental-logo-horizontal.png`. A causa desta tentativa é o reenvio de um caminho local de imagem para um campo validado como URL completa, não a falta de chave Pix ou de arquivo de imagem.

**Limite da correção anterior:** a seção 40 tratou imagem vazia e cores nulas. Um caminho relativo não vazio continuava sendo rejeitado quando reenviado pelo formulário. A inspeção da página confirmou que imagem, descrição, cores e domínio não possuem controles de edição nesta tela, embora todos integrassem o payload por meio do spread do DTO de leitura.

**Correção complementar:** `lojaSettingsFormChanges` em `lib/loja-dto.ts` monta explicitamente os campos editáveis de Pix, contato, logística e nome/slug. `app/admin/settings/page.tsx` usa esse payload e acrescenta somente alterações explícitas de credenciais dos Correios. Imagem, identidade visual, domínio, descrição e indicadores de credenciais deixam de ser reenviados. A API mantém as validações dos campos recebidos e o serviço mantém a atualização parcial, preservando os valores omitidos. Não foi alterado o caminho da imagem ou flexibilizada a validação da API para aceitar URLs inválidas.

**Verificações:** dez testes unitários no arquivo de credenciais da loja passaram, incluindo o salvamento pelo construtor usado no formulário a partir de DTO com imagem relativa e tema não editável. Três testes HTTP com PostgreSQL 16 descartável e Next passaram, runId `a709d1c4dace7c223adaeee7dd9c60d3`, 33 migrations e duração Vitest de 3,06s. O cenário novo salva `enablePix=true`, confirma persistência/nova leitura e preservação da imagem relativa, cor, domínio e credenciais-canário. TypeScript e ESLint direcionado passaram sem erros ou avisos. Nenhum teste acessou Neon ou Asaas; nenhum pedido, cobrança ou e-mail foi criado.

**Publicação:** commit `537d6f0a108859d5bc8e835d40aa7efd4d8feac1`, enviado exclusivamente a `homologacao_teste`, baseado em `a2cbf56dcc539ee1320ed341780e36961b5087ff`. A leitura remota confirmou esse SHA e `main` remota preservada em `7f9b26e062ec2654420fecffb6dd78ad3ba1e017`. O contexto Vercel inicialmente informou `pending`, descrição `Vercel is deploying your app`, para o deployment `5MoAw9UNHVm5qtFHUzW95AoQ41NF`. Nenhuma promoção para Production foi realizada. O container de testes foi descartado, confirmado por listagem vazia com seu label exclusivo. Repetir o salvamento no Preview após a publicação da nova revisão antes de prosseguir ao pedido Sandbox. **WF-18/19 permanecem abertos; WF-20 NÃO INICIADO.**

**Conclusão da publicação:** na conferência seguinte, o contexto Vercel do mesmo commit informou `success`, descrição `Deployment has completed`. A publicação da correção está confirmada pela integração. O salvamento autenticado no Preview permanece pendente da nova tentativa do operador; o agente não recebeu ou utilizou sessão administrativa remota.

**Confirmação do operador:** em 08/10/2026, após essa publicação, o operador informou que o salvamento funcionou e conseguiu habilitar o Pix automático. A pendência de salvamento do painel está resolvida. Isso ainda não comprova criação de cobrança, confirmação de pagamento, processamento de webhook ou entrega de e-mail. Próxima etapa: criar um único pedido Pix no Preview isolado, conferir a cobrança no Asaas Sandbox e parar no QR Code, mantendo o agendador desligado. A ativação de `PAYMENT_REMOTE_ENABLED` e do webhook deve ser conferida antes do checkout; não foi inferida a partir do salvamento. **WF-18/19 permanecem abertos; WF-20 NÃO INICIADO.**

## 43. WF-19 — primeiro checkout Sandbox: cobrança criada, instruções Pix indisponíveis

**Data local:** 08/10/2026. O operador informou que o checkout redirecionou para a confirmação sem QR Code ou Pix copia e cola. A imagem mostra `Pedido #1 · PENDING` e “Aguardamos a confirmação financeira. Não refaça o pagamento.” A segunda imagem do painel Asaas mostra uma cobrança aguardando pagamento, valor bruto R$ 24,95 e líquido R$ 23,96. O operador identifica essa cobrança como resultado do teste Sandbox; a imagem resumida não contém ID, referência externa ou modalidade para conferir a correlação de forma independente. Nenhuma confirmação financeira ou entrega de e-mail foi comprovada.

**Resultado do ensaio:** parcial, sem aprovação do checkout Pix completo. O pedido aparece na aplicação e uma cobrança aparece no provedor, mas o cliente não recebeu instruções utilizáveis. `PENDING` no Asaas é compatível com uma cobrança ainda não paga; não justifica por si só a ausência das instruções. Não simular o recebimento antes de investigar essa etapa, para não encobrir o problema de emissão. Preservar o pedido/cobrança existentes e evitar uma nova compra de teste.

**Caminho confirmado no código:**

1. `services/asaas/asaas.adapter.ts:createPixCharge` resolve o cliente, cria a cobrança (`POST /payments`), consulta o QR (`GET /payments/{id}/pixQrCode`), valida referência/modalidade/valor e retorna as instruções. Criar a cobrança e obter as instruções são etapas diferentes. A documentação oficial confirma o endpoint separado: https://docs.asaas.com/reference/obter-qr-code-para-pagamentos-via-pix.
2. `services/payment/checkout-payment.service.ts:executePaymentAttempt` valida o retorno e grava a evidência/instruções numa transação. Seu `catch` trata também falhas posteriores à aceitação pelo provedor: se a tentativa ainda estiver `SUBMITTING`, grava `UNKNOWN`, `PAYMENT_RESULT_UNRESOLVED` e a reconciliação pendente, sem reemitir a cobrança.
3. `lib/commerce/purchase-result.ts` autoriza instruções somente com tentativa `PENDING`, contrato completo e QR/payload persistidos. Estados `SUBMITTING`/`UNKNOWN` são projetados como `PROCESSING`. A frase da imagem corresponde a `paymentState=PROCESSING` em `lib/commerce/purchase-client.ts`; o estado financeiro exato não pode ser identificado apenas por essa frase.
4. `app/checkout/confirmation/page.tsx` exibe a tela simplificada quando o estado não permite pagamento. O bloqueio do QR é coerente com uma emissão não confirmada localmente; não é evidência de que o QR nunca tenha sido gerado pelo Asaas.
5. `services/payment/payment-worker.service.ts` e `AsaasPaymentAdapter.inspectAttempt` possuem recuperação por referência externa e consulta das instruções da cobrança existente, sem novo POST de emissão. O GET de recuperação da página apenas lê o estado persistido; esperar com o processador desligado não executa essa conciliação.

**Causa remota ainda indeterminada:** a evidência é compatível com falha/timeout da consulta do QR, rejeição da resposta pelo contrato ou falha da transação local. A revisão encontrou ainda uma incompatibilidade possível: `gateway-contract.ts` aceita `installment`/`installmentNumber` ausentes, mas rejeita `null`; o exemplo oficial de cobrança em https://docs.asaas.com/docs/webhook-para-cobrancas contém `installmentNumber: null`. As fixtures de sucesso inspecionadas omitem esses campos. Isso merece conferência da resposta real e não foi declarado como causa deste pedido.

**Limitação da observabilidade:** o adapter registra `ASAAS_PIX_ISSUE_FAILED` com erro genérico `PAYMENT_GATEWAY_FAILED`, sem estágio, HTTP ou código original. O executor também captura erros de validação/gravação sem registrar a causa específica. Foi solicitado ao operador verificar `ASAAS_PIX_ISSUE_FAILED` ou `ASAAS_PIX_ISSUED` nos Logs do Preview no horário da compra, compartilhando apenas action, duração e código eventualmente disponível, sem segredos ou dados pessoais. `ASAAS_PIX_ISSUED` indicaria conclusão do adapter, não comprovaria o commit posterior das instruções.

**Consumo do banco:** a página de confirmação consulta `/api/checkout/intents/{id}` a cada 3,5 segundos enquanto o pedido não chega a um estado terminal (aproximadamente 17 consultas/minuto enquanto visível, sem contar latência). Mesmo com Cloudflare desligada, essa página pode manter o Neon ativo. Orientado fechar a aba durante o diagnóstico. Não estimar CU-h pelo tempo HTTP ou pelo número de consultas isoladamente.

**Verificações locais realizadas nesta análise:** 51 testes unitários passaram em quatro arquivos: `asaas-adapter`, `payment-recovery-adapter`, `checkout-client-contracts` e `checkout-content-result`, duração Vitest 981ms. Outros 57 testes passaram nos arquivos de integração `payment-plan-authority` e `payment-durable-execution`, duração Vitest 20,20s, PostgreSQL descartável via Docker, runId `2cce6c5fce9a5887bcfc5d81e5c07e12`, 33 migrations. Cobrem instruções ausentes/retorno ambíguo, recuperação da cobrança sem duplicação e autorização da exibição. Respostas do provedor são controladas: esses resultados não comprovam o contrato recebido do Asaas neste ensaio. Nenhum teste acessou Neon, Asaas ou Resend reais; nenhuma nova cobrança ou alteração remota foi realizada pelo agente. Código de aplicação não alterado nesta análise.

**Continuidade:** correlacionar a cobrança com o pedido e identificar a etapa que falhou antes de recuperar as instruções existentes e repetir a verificação visual. Manter a sessão de agendamento encerrada até definir a recuperação pontual. Pagamento simulado, webhook, e-mail e demais cenários continuam pendentes. **WF-18/19 permanecem abertos; WF-20 NÃO INICIADO.**

## 44. WF-19 — log da emissão localizado e diagnóstico pontual preparado

**Evidência recebida em 08/10/2026:** POST `/api/checkout`, iniciado às 13:29:31.992 BRT, HTTP 202, duração da função 16,95s, Preview `homologacao_teste`, deployment `dpl_5MoAw9UNHVm5qtFHUzW95AoQ41NF`. Log da aplicação às `2026-10-08T16:29:45.416Z`: `ASAAS_PIX_ISSUE_FAILED`, pedido #1, `orderId=04e34a9a-70da-4816-b691-3e31c85935b9`, duração do adapter 2466ms e erro genérico `PAYMENT_GATEWAY_FAILED`. As entradas de navegação enviadas antes desse POST não representam a emissão.

**Conclusão sustentada:** `lib/commerce/checkout-http.ts` retorna HTTP 202 quando `paymentState=PROCESSING`; esse status não aprova a emissão das instruções. O log veio do `catch` de `createPixCharge`, antes do retorno bem-sucedido ao executor. A falha registrada, portanto, não nasceu da transação posterior de gravação das instruções. O rótulo `PAYMENT_GATEWAY_FAILED` e a stack foram construídos pelo logger com um novo Error, substituindo a causa original; não são um código de resposta Asaas. A duração de 2466ms não corresponde ao vencimento do timeout de 8000ms do cliente para uma requisição dessa execução. Ainda pode haver erro HTTP/transporte imediato, resposta sem artefatos ou rejeição de contrato; não foi identificado o motivo original. A sequência de GET/POST na interface da Vercel, sem URLs, respostas ou status de cada chamada, não distingue essas alternativas.

**Consulta preparada:** `scripts/homologation/inspect-pix-sandbox.ps1` procura a cobrança pela referência exata do pedido informado e, somente se encontrar uma única cobrança Pix, consulta seu QR Code. Executa no máximo dois GETs ao host fixo Sandbox, pede a chave API via `Read-Host -AsSecureString`, rejeita chave de produção conhecida e não utiliza `.env` nem banco. A saída contém ID/modalidade/status/valor, correspondência da referência, presença/ausência/null dos campos de parcelamento e existência dos artefatos ou status/códigos de erro permitidos. Não mostra chave, cabeçalhos, contato do cliente, imagem ou Pix copia e cola. Não cria, confirma, cancela ou altera cobrança; não executa reconciliação local. Seu resultado retrata o estado consultado agora e não substitui a resposta histórica da emissão.

**Validação da ferramenta:** parser PowerShell sem erros e cinco cenários com `Read-Host`/`Invoke-RestMethod` substituídos por respostas locais passaram: cobrança única com campos nulos e artefatos, lista vazia, duplicidade, paginação incompleta e falha da consulta de QR. Nenhuma chamada de rede foi feita nesses testes. Nenhum teste anterior da aplicação foi repetido e nenhum código do checkout foi alterado neste passo. A consulta real aguarda execução pelo operador com sua chave Sandbox privada; não é necessário redeploy para executar o diagnóstico local.

**Continuidade:** conferir o JSON resumido da consulta antes de corrigir o contrato ou iniciar recuperação das instruções da cobrança existente. Preservar pedido/cobrança, agendador desligado e sem confirmação simulada durante o diagnóstico. **WF-18/19 permanecem abertos; WF-20 NÃO INICIADO.**

## 45. WF-19 — incompatibilidade com installmentNumber nulo reproduzida e corrigida

**Evidência do operador em 08/10/2026:** trecho do diagnóstico pontual: `externalReferenceMatches=true`, `installmentField=absent`, `installmentNumberField=null`, `qrLookupSucceeded=true`, `hasPayload=true`, `hasEncodedImage=true`. A referência consultada corresponde ao pedido do teste e as instruções estão disponíveis no provedor no momento da consulta. O trecho não contém o ID/modalidade/status/valor do cabeçalho, nem a resposta histórica ao POST de emissão; a conferência completa de correlação/valor continua sendo responsabilidade do contrato da aplicação.

**Defeito reproduzido:** a validação antiga rejeita `installmentNumber:null` em uma cobrança avulsa, inclusive quando QR/payload estão presentes e valor/modalidade/referência estão corretos. Antes da correção, três cenários de metadados nulos no novo teste de contrato e a fixture de sucesso do adapter com `installmentNumber:null` falharam, reproduzindo `PAYMENT_CONTRACT_MISMATCH`; 17 outros cenários passaram. Isso confirma a incompatibilidade concreta apresentada pelo diagnóstico e explica o caminho de rejeição encontrado no log, sem atribuir ao Asaas um erro que foi produzido localmente.

**Correção:** `services/payment/gateway-contract.ts` normaliza apenas `installment` e `installmentNumber` nulos para ausentes. Demais verificações de valor, referência, modalidade, status, unicidade e ordinal positivo permanecem. `verifyInstallmentContract` continua exigindo o ID do contrato e a sequência completa de parcelas; metadados nulos não constituem prova de parcelamento. `types/asaas.types.ts` representa a nulabilidade real desses dois campos. O adapter normaliza `installment` nulo na saída de inspeção/cartão para evitar passar null ao contrato interno de evidências. Não foram alterados valores, datas, QR Code, estado do pedido real, chave Pix ou configurações remotas.

**Validação:** 82 testes unitários passaram em seis arquivos (contrato do gateway, adapter Asaas, recuperação do adapter, plano financeiro, contrato cliente e projeção do resultado), duração Vitest 1,56s. TypeScript sem emissão e ESLint direcionado passaram. 59 testes passaram em `payment-plan-authority` e `payment-durable-execution` com PostgreSQL 16 descartável via Docker, runId `e584bf27e3525ce496a97c7c0f96ff08`, 33 migrations, duração Vitest 20,86s. Dois novos cenários usam o adapter real com transporte controlado e metadados nulos: emissão/persistência/replay e resposta perdida seguida de reconciliação. Ambos terminam `ISSUED`, com QR/payload persistidos, apenas uma emissão e estoque reservado uma única vez. Nenhum teste acessou Neon ou serviços externos. O container desse runId foi removido, confirmado por listagem vazia do label exclusivo.

**Publicação:** commit `f23c37d1f232d6240d72fed286830c9365e3e783`, baseado em `537d6f0a108859d5bc8e835d40aa7efd4d8feac1`, enviado somente a `homologacao_teste`. A leitura remota confirmou a nova revisão e `main` remota preservada em `7f9b26e062ec2654420fecffb6dd78ad3ba1e017`. O commit contém somente três arquivos de aplicação/tipos e três arquivos de teste; este registro e os scripts locais de homologação não foram incluídos. O estado Ready precisa ser conferido antes de executar a recuperação publicada.

**Recuperação preparada:** `scripts/homologation/process-payments-once.ps1` executa um GET de status no Preview fixo e, após verificar schema, escopo `sandbox-hml` e ausência de pedidos legados não rastreados, um único POST `/api/cron/payments?limit=1`. Pede CRON_SECRET/bypass como entrada oculta, sem ler `.env`, sem agendamento e sem retentativa automática. Trata-se de execução do processador (inclui inbox, reconciliação, expiração conforme flag e outbox), não de consulta somente de leitura nem de confirmação simulada do pagamento. Preservar `PAYMENT_EXPIRATION_ENABLED=false` e o isolamento já conferido. O comando pode recuperar a instrução da cobrança existente; não emite outra cobrança via reconciliação. Quatro cenários controlados passaram (sucesso, escopo diferente, legados e erro sem retentativa), sem rede. A recuperação real não foi executada pelo agente e ainda deve ser conferida visualmente pelo operador. **WF-18/19 permanecem abertos; WF-20 NÃO INICIADO.**

**Conclusão da publicação:** a API pública do GitHub confirmou contexto Vercel `success`, descrição `Deployment has completed`, no mesmo commit `f23c37d1f232d6240d72fed286830c9365e3e783`, deployment `9XswqeT7usEap3VDLWBq3ETNd6L8`. A publicação do Preview está concluída. Não é necessário disparar outro redeploy para essa correção; a recuperação pontual e a conferência do QR pelo operador permanecem pendentes.

## 46. WF-19 — execução pontual da conciliação concluída, conferência visual pendente

**Evidência do operador em 08/10/2026:** após o comando de processamento pontual, o JSON completo informou inbox `claimed=0/completed=0/retried=0/review=0`; reconciliation `claimed=1/completed=1/retried=0/review=0`; outbox `claimed=1/completed=1/retried=0/review=0`. A etapa expiration retornou `success=true`, `processedCount=0`, `cancelledCount=0`, `errorCount=0`, listas de cancelamentos/erros vazias e `executionTimeMs=615`.

**Resultado confirmado:** um trabalho de conciliação e um trabalho de outbox concluídos sem retentativa ou revisão reportada; nenhum evento de inbox processado e nenhum pedido cancelado nessa execução. O resumo agregado não contém ID do pedido, estado financeiro, instruções Pix ou tipo do item de outbox, portanto não comprova isoladamente que o QR do pedido #1 já está visível, que o pagamento foi confirmado ou que um e-mail foi enviado. A duração de expiração não mede o consumo total de compute do Neon.

**Próxima conferência:** reabrir a confirmação do pedido #1 pela URL original do checkout intent, sem refazer a compra, e verificar QR Code/Pix copia e cola. Não repetir o processamento antes dessa conferência. Manter Cloudflare desligada e sem Cron. A confirmação simulada do pagamento e a validação de webhook/e-mail permanecem para a etapa posterior à apresentação das instruções. Nenhum teste local ou comando remoto adicional foi executado pelo agente para analisar este JSON. **WF-18/19 permanecem abertos; WF-20 NÃO INICIADO.**

## 47. WF-19 — retorno à aba suspende instruções e desmonta o painel; correção da confirmação

**Evidência do operador em 08/10/2026:** a confirmação abriu após aproximadamente quatro segundos, mas depois mostrou a tela simples com “Utilize somente as instruções válidas desta compra.”, “Atualizando o estado da compra...” e “Voltar à loja”. Na pergunta de acompanhamento, confirmou que isso ocorreu após trocar de aba/janela. Não informou se a tela permaneceu assim por mais de 30 segundos. O relato e a imagem não comprovam nova alteração do estado financeiro ou expiração da cobrança.

**Causa confirmada na interface:** o handler comum de foco/pageshow/visibilitychange em `app/checkout/confirmation/page.tsx` marca `fresh=false`, cancela a consulta anterior e inicia outra. Quando a aba está oculta, o carregamento sai sem consultar; ao retornar, depende de nova resposta para liberar as instruções. Enquanto `fresh=false`, o retorno antecipado substituía todo o painel pelo `<main>` simples da imagem. A requisição também não possuía prazo explícito. Esse mecanismo explica o estado mostrado após troca de aba; não comprova a origem dos quatro segundos iniciais nem uma falha permanente do backend.

**Correção:** a página mantém o painel e o resumo do pedido durante atualização, erro de conexão e estados não acionáveis, exibindo aviso e estado “Verificando”. QR/copia e cola, boleto e contato manual continuam indisponíveis enquanto `fresh=false`; após resposta válida, voltam conforme a autorização/estado canônico. Eventos simultâneos de foco/pageshow reaproveitam a consulta ativa; ocultar a aba invalida a geração e aborta a consulta, e o retorno reinicia a verificação sem aceitar resposta antiga. Adicionado prazo de 15 segundos para a requisição e preservadas retentativas com intervalo crescente. A consulta periódica pendente passa de 3,5 para 10 segundos após cada resposta; isso reduz a frequência dessas leituras, mas não comprova redução proporcional de CU-h nem altera o tempo do primeiro carregamento. O indicador de status usa o estado canônico também para cartão/boleto cancelados ou em revisão.

**Verificação:** 32 testes unitários de contrato cliente/projeção do resultado passaram, duração Vitest 1,62s; TypeScript passou. ESLint sem erros, com o aviso preexistente de uso de `<img>` para QR Base64 (não substituído por otimização externa da imagem). Quatro cenários com Next, React, navegador Chrome isolado e PostgreSQL 16 descartável passaram. A primeira rodada, runId `91efde49791139af056dfb356216dd7a`, duração 45,42s, cobriu consulta retida, resumo persistente, ações suspensas, coalescência de eventos e recuperação após timeout, além dos cenários existentes de estorno, frete e troca de identidade. Uma segunda rodada acrescentou ocultação/retorno explícitos da aba; runId `bcce30862fbdc61d3658901551101385`, 33 migrations, duração 42,58s, quatro testes passaram. Confere ausência de nova leitura na aba oculta, retomada ao retornar, rejeição da geração anterior, restauração das ações e um único pedido persistido. Ambos os containers foram removidos, confirmado pelos labels exclusivos. Nenhum teste acessou Neon/Asaas/Resend reais ou iniciou pagamento financeiro.

**Publicação e continuidade:** commit `6bef157249b137a0eea1f2b58bd170f298d66836`, baseado em `f23c37d1f232d6240d72fed286830c9365e3e783`, enviado somente a `homologacao_teste`, com a página e o teste de navegador. O registro e os preparativos locais permanecem fora desse commit. Aguardar a conclusão do deployment e reabrir a mesma confirmação, atualizar uma vez e conferir o retorno após trocar de aba, sem repetir checkout ou processamento. Agendador permanece desligado/sem Cron; confirmação simulada, webhook e entrega de e-mail continuam pendentes. **WF-18/19 permanecem abertos; WF-20 NÃO INICIADO.**

**Conclusão da publicação:** o contexto Vercel do commit `6bef157249b137a0eea1f2b58bd170f298d66836` passou a `success`, descrição `Deployment has completed`, deployment `m7NK9WQ3MtgUxbdpzDjPyoFKr9aT`. `main` remota continua em `7f9b26e062ec2654420fecffb6dd78ad3ba1e017`. A correção está publicada no Preview; a conferência visual do operador após essa revisão permanece pendente.

## 48. WF-19 — QR visível no pedido #1; alternância com a aba aberta ainda em diagnóstico

**Evidência do operador em 08/10/2026:** as imagens mostram o pedido #1, total R$ 24,95, PIX automático com QR Code e copia e cola visíveis. A outra imagem mostra o mesmo pedido no painel “Verificando o pagamento”, com “Atualizando o estado da compra...”. Após inicialmente relatar retorno de aba/janela, o operador esclareceu que a alternância também acontece permanecendo na página. Isso confirma a apresentação das instruções recuperadas; não comprova pagamento, webhook, e-mail nem o motivo da alternância.

**Investigação:** a consulta periódica de pedido pendente inicia dez segundos após a resposta anterior e não executa `setFresh(false)` ao começar. O estado `fresh=false` é provocado por reinício do efeito, eventos de foco/pageshow/visibilidade ou falha da consulta. Portanto, não é correto atribuir a alternância automaticamente ao polling ou exclusivamente à troca de aba. Solicitado ao operador o status HTTP de `/api/checkout/intents/...` no momento do problema e qual aviso aparece, sem cabeçalhos/cookies/chaves.

**Verificação local:** acrescentada cobertura de duas consultas periódicas retidas e liberadas, sem eventos de foco/visibilidade, com observação de mutações do DOM para detectar desaparecimento das instruções. A fixture existente é PIX manual, compartilhando o bloqueio de ações da confirmação; não usa QR real do Asaas. Os quatro testes do arquivo de navegador passaram com Next/React/Chrome e PostgreSQL 16 Docker descartável, 33 migrations, runId `1fdfd9480fe43e9bea526fa29047de63`, duração Vitest 63,14s. Não houve alternância nessa reprodução com leituras bem-sucedidas. O container foi removido, confirmado por listagem vazia do label exclusivo. Nenhum teste acessou Neon ou serviços externos. A cobertura adicionada permanece local; não foi alterado o código da aplicação nem publicado novo deployment nesta investigação. A causa no Preview permanece pendente da resposta do operador. **WF-18/19 continuam abertos; WF-20 NÃO INICIADO.**

## 49. WF-19 — consultas de foco preservam o QR e atualizam discretamente o pedido

**Esclarecimento do operador em 08/10/2026:** a alternância acontece ao tentar capturar a tela. A captura da aba Rede mostra cinco consultas do mesmo checkout intent com HTTP 200, aproximadamente 2,6–4,6 segundos de duração, e o QR do pedido #1 novamente visível. O relato é compatível com perda/retorno de foco pela ferramenta de captura acionando a verificação da página, mesmo sem navegar para outra página. Não há evidência de nova emissão nessas leituras nem de falha HTTP nas consultas mostradas. O operador solicitou melhorar a apresentação para evitar essa alternância.

**Melhoria:** `app/checkout/confirmation/page.tsx` preserva a última instrução verificada durante consultas periódicas e eventos breves de foco/pageshow/visibilidade. Um indicador discreto “Conferindo o estado do pedido...” ocupa espaço reservado, mantendo o título, resumo e elemento do QR quando o resultado continua válido. Eventos concorrentes reaproveitam a consulta ativa; a aba oculta pausa consultas e invalida respostas antigas, sem destruir imediatamente a instrução recente. Um limite de 30 segundos, medido conservadoramente desde o início da última consulta bem-sucedida, restringe a reutilização de instruções acionáveis. Ausência prolongada, erro/timeout ou resposta sem autorização suspendem as ações até nova verificação. O vencimento continua usando o relógio do servidor mais tempo monotônico decorrido; copiar PIX/boleto, abrir boleto e contato manual conferem novamente idade, visibilidade e autorização no clique. Estados conhecidos sem ação de pagamento, incluindo confirmação/cancelamento/expiração, não são apagados apenas pelo limite de idade. Não foram modificadas emissão, conciliação, webhook ou configurações de agendamento.

**Validação:** 32 testes unitários de contrato cliente/projeção passaram, duração Vitest 1,70s. TypeScript sem emissão passou; ESLint sem erros, com o aviso preexistente do `<img>` de QR Base64. A primeira rodada de navegador, runId `fd5479ccf460e996565c2c5fa3cb53d3`, apontou dois defeitos na instrumentação de teste: comparação com `innerText` sem normalizar a caixa transformada pelo CSS e tentativa de serializar uma referência DOM pelo protocolo do navegador. O primeiro interrompeu a montagem sequencial das fixtures dos três cenários seguintes. As correções normalizam apenas a observação textual e guardam a referência sem retorná-la ao protocolo. O container dessa rodada foi removido. A rodada final, runId `08b8f43131d344f77e68956b12f4bba4`, 33 migrations, concluiu os cinco testes em 108,31s (cenários de navegador 100,54s). Inclui cobrança PIX criada pelo domínio com gateway controlado, imagem PNG de fixture e persistência real no Docker, conferindo o mesmo elemento do QR durante foco/ocultação breve/retorno, coalescência de eventos, suspensão por falha, recuperação, ausência prolongada e vencimento. Confirma uma única emissão, um pedido e uma cobrança persistidos. Os cenários existentes cobrem aprovação/estorno, frete, carrinho novo e troca de identidade. A imagem de fixture não é um QR bancário utilizável. Nenhum teste acessou Asaas/Neon/Resend reais. O container final foi removido, confirmado pelo label exclusivo vazio. Publicação em homologação preparada após conclusão dos checks. **WF-18/19 continuam abertos; WF-20 NÃO INICIADO.**

**Publicação:** commit `bcb759fd929326b57a5c9fd9d168a3e4e31a9cdc`, baseado em `6bef157249b137a0eea1f2b58bd170f298d66836`, enviado somente a `homologacao_teste`, contendo a página de confirmação e o teste de navegador. A revisão remota foi conferida; `main` remota permanece em `7f9b26e062ec2654420fecffb6dd78ad3ba1e017`. O registro e os scripts de homologação continuam fora do commit. Aguardando conclusão do deployment Vercel antes da conferência visual pelo operador. Agendador continua desligado/sem Cron; não foi repetido checkout, processamento financeiro ou confirmação simulada do pedido real.

**Conclusão da publicação:** a API pública do GitHub confirmou o contexto Vercel `success`, descrição `Deployment has completed`, no commit `bcb759fd929326b57a5c9fd9d168a3e4e31a9cdc`, deployment `BWrqQrzrRmXyjMCu3XRUa1ZusgoG`. A melhoria está publicada no Preview de homologação. Próxima conferência visual: reabrir a mesma confirmação do pedido #1, atualizar a página e testar captura de tela/retorno breve de foco enquanto a cobrança ainda estiver válida. Aprovação simulada, webhook e entrega de e-mail seguem pendentes da etapa financeira posterior.

## 50. WF-19 — apresentação aprovada pelo operador; preparação da confirmação Sandbox

**Evidência do operador em 08/10/2026:** confirmou que a página agora funciona corretamente e solicitou continuar os testes de pagamento. A apresentação do QR/copia e cola e a estabilidade após a melhoria podem ser consideradas verificadas visualmente no Preview. Isso não confirma pagamento do pedido #1 nem entrega de webhook/e-mail.

**Preparação:** revisados o recebimento assíncrono de eventos, o executor pontual e a outbox. O webhook autenticado retorna 200 após persistir o evento, com `PAYMENT_WORKER_ENABLED=true`; o processamento consulta a cobrança no provedor antes de aplicar evidências. `ORDER_STATUS_CHANGED` para PAID cria uma entrada separada `PAYMENT_CONFIRMATION_EMAIL`. Com limite 1, a conclusão da projeção normalmente não inclui o envio do e-mail no mesmo lote. Reconfirmado o roteiro oficial para simular o pagamento pela interface Sandbox e a restrição do remetente `onboarding@resend.dev` ao destinatário associado à conta Resend.

**Pendências imediatas:** solicitada confirmação textual de que `Continental_Sandbox` está ativo e aponta ao Preview e de que o comprador do pedido #1 usa o e-mail associado à conta Resend. Não solicitar valores de segredos nem executar confirmação/processamento enquanto esses dados estiverem pendentes. A seção 9 do guia local detalha confirmação da cobrança existente de R$ 24,95, logs do webhook, um lote pontual, conferência do pedido pago e entrega do e-mail. Preferir execução pontual e manter Cloudflare desativada/sem Cron. Não foi realizada chamada à conta Asaas, ao Preview autenticado, ao Neon ou ao Resend pelo agente nesta preparação; não há aprovação/entrega real a registrar ainda. Não houve alteração de aplicação, novo deployment ou repetição de testes locais neste turno. **WF-18/19 continuam abertos; WF-20 NÃO INICIADO.**

**Pré-requisitos confirmados pelo operador:** respondeu “Sim” para o webhook `Continental_Sandbox` ativo com destino ao Preview `homologacao_teste` e para o comprador do pedido #1 usando o e-mail associado à conta Resend. Essas duas pendências estão atendidas segundo a conferência privada do operador; não solicitar novamente nem valores de segredos. Próxima ação orientada: confirmar uma única vez a cobrança existente e ainda válida de R$ 24,95 pela interface Asaas Sandbox, conferir o POST de webhook HTTP 200 no Preview e executar uma vez `scripts/homologation/process-payments-once.ps1` no PowerShell. Solicitar somente o resumo JSON, o estado da cobrança/pedido e a informação de recebimento de e-mail. Com limite 1, o lote de projeção PAID pode deixar o envio do e-mail para uma execução posterior; não repetir automaticamente sem analisar o primeiro resultado. A aprovação financeira, entrega do webhook e envio/recebimento de e-mail ainda não foram informados pelo operador nem executados pelo agente. Manter agendamento desligado e demais gates do workflow abertos.

## 51. WF-19 — webhook recebido no Preview; processamento financeiro pendente

**Evidência do operador em 08/10/2026:** informou que o estado da cobrança mudou no Asaas e apresentou `POST /api/webhooks/asaas`, HTTP 200, iniciado às 15:53:38.48 GMT-3, no host do Preview `homologacao_teste`. Request ID `9fnbn-1791485618480-2199657eac9b`; deployment `dpl_BWrqQrzrRmXyjMCu3XRUa1ZusgoG`; User Agent `Asaas_Hmlg/3.0`; firewall Allowed; invocação 1,67s e resposta 1,8s. O log informou ausência de chamadas externas. Parâmetros sensíveis da URL foram omitidos deste registro.

**Resultado:** o caminho publicado do webhook alcançou a aplicação e retornou sucesso. Conforme a rota implantada, 200 ocorre depois da autenticação, verificação do executor habilitado e persistência/upsert do evento. A ausência de chamada Asaas nessa invocação é compatível com o recebimento assíncrono; o consumidor consulta o provedor em outra execução. O log não contém tipo/eventId/ID da cobrança nem o novo status específico do Asaas, e não comprova sozinho pedido PAID ou entrega de e-mail.

**Próxima execução:** orientar o operador a executar uma vez `./scripts/homologation/process-payments-once.ps1`, com entradas ocultas de CRON_SECRET/bypass de homologação, mantendo Cloudflare desligada/sem Cron. Conferir o JSON completo de inbox/reconciliation/expiration/outbox antes de repetir, a confirmação do mesmo pedido #1 sem QR ativo e eventual e-mail. Nenhum processamento financeiro remoto foi executado pelo agente nesta análise. O log compartilhado incluiu um segredo de bypass: não reproduzir o valor em arquivo/resposta nem solicitar cabeçalhos/URL completa nos próximos registros; recomendar substituição e atualização das referências configuradas. **WF-18/19 continuam abertos; WF-20 NÃO INICIADO.**

## 52. WF-19 — lote após webhook deixou inbox e conciliação para nova tentativa

**Evidência do operador em 08/10/2026:** o executor pontual retornou inbox claimed=1/completed=0/retried=1/review=0 e reconciliation claimed=1/completed=0/retried=1/review=0. Expiração success=true, processedCount=0/cancelledCount=0/errorCount=0, executionTimeMs=563. Outbox claimed=0/completed=0/retried=0/review=0. O resumo não informa horário, identidade dos trabalhos ou causa da exceção.

**Análise local:** os consumidores compartilham consulta ao provedor e aplicação transacional de evidências. Em payment-worker.service.ts, os catches registram códigos genéricos de retomada e descartam a exceção original. Assim, o resumo não distingue falha de consulta/configuração, validação de evidência, transação ou aplicação comercial. Não atribuir a falha ao Resend: nenhuma entrada de outbox foi reivindicada neste lote. Não há comprovação de aprovação PAID nem de envio de e-mail nesta execução.

**Próxima evidência solicitada:** status exato atual da cobrança Sandbox e eventuais erros na invocação /api/cron/payments correspondente, sem parâmetros de URL, cabeçalhos ou cookies. Manter Cloudflare desativada/sem Cron e não repetir processamento ou confirmação sem analisar a causa. Não foram alterados código de aplicação, credenciais ou ambientes remotos nesta análise. WF-18/19 continuam abertos; WF-20 NÃO INICIADO.

**Complemento do operador:** o painel Asaas mostra “Pagamento recebido”. Isso confirma o estado observado no provedor segundo o operador; a aprovação correspondente na loja permanece sem comprovação. As mensagens de erro da invocação /api/cron/payments ainda não foram apresentadas.

## 53. WF-19 — reprodução de transação expirada e prazo limitado para aplicar evidência financeira

**Log real fornecido pelo operador:** POST /api/cron/payments HTTP 200 às 16:04:58.46 GMT-3 de 08/10/2026, limit=1, requestId r55bm-1791486298466-2ef2d258d30e, deployment dpl_BWrqQrzrRmXyjMCu3XRUa1ZusgoG, Preview homologacao_teste. Invocação 20,27s, resposta 20,8s, dois GET externos. Prisma registrou erro em order.findUnique: Transaction API error / Transaction not found, com ID inválido ou transação antiga encerrada. Junto ao resumo com duas etapas retried e ao painel Asaas “Pagamento recebido”, identifica falha na aplicação transacional; HTTP 200 do executor não comprova conclusão comercial.

**Inspeção e reprodução local:** Prisma 5.22.0 usa timeout padrão de 5.000ms; as transações de aplicação de evidências não informavam outro prazo. Não foi encontrado uso de cliente transacional escapando do callback nessa sequência. Em PostgreSQL 16 descartável, dois testes com comprador autenticado e fidelidade habilitada injetaram uma latência única de 5.500ms na consulta Order.findUnique da aprovação comercial. Inbox e conciliação reproduziram P2028 / transação expirada no mesmo ponto, com 5.538ms decorridos e resultado retried. Rodada anterior à correção: runId afdfa25f06cb59863beb6f1cadeeee09, 37/40 passaram; os dois testes de latência falharam conforme esperado e um teste posterior foi afetado pelos trabalhos deixados para retomada nessa rodada. Esse ensaio reproduz o mecanismo compatível com o log real; não mede a latência de cada consulta no Neon nem elimina outras causas possíveis de encerramento remoto.

**Correção:** payment-execution-policy.ts define maxWait=5.000ms/timeout=30.000ms apenas para as transações que aplicam evidências ou correlação divergente em payment-worker.service.ts. A evidência, estado financeiro/comercial, reserva, pontos e reconhecimento da inbox permanecem atômicos. Consultas ao Asaas continuam antes da transação; o ajuste não cria nova cobrança, não aprova por webhook sem consulta e não altera o timeout global do Prisma. O prazo continua inferior à lease de dez minutos. Catches passam a emitir action, fase, identidade do trabalho/tentativa e código seguro (incluindo P2028), sem mensagem arbitrária, stack, metadados Prisma ou resposta do provedor; erros desconhecidos recebem código genérico. Sem alteração de configuração de banco, agendamento, expiração, endpoint ou credenciais.

**Validação após correção:** 40 testes de integração passaram, duração Vitest 26,28s (24,33s nos testes), runId 6f480dfa2f17f0c2013b18b890fa1ec5, 33 migrações aplicadas. Os dois cenários com latência confirmaram pedido PAID, tentativa APPROVED, reserva COMMITTED, uma emissão, uma transição comercial, dois fatos financeiros, um ganho de 100 pontos e uma notificação única, mesmo após retomada pelos dois consumidores. Cenários existentes de rollback, concorrência, divergência de contrato, cancelamento/estorno e entrega foram mantidos. Passaram também 20 testes unitários de diagnóstico/adapter (1,28s), TypeScript sem emissão e ESLint dos arquivos alterados, sem erros. As contas reais Asaas/Neon/Resend não foram acessadas pelo agente. Publicação somente de código e testes na branch homologacao_teste preparada; registro local permanece fora do commit. WF-18/19 continuam abertos; WF-20 NÃO INICIADO.

**Publicação preparada na Vercel:** commit f4f936c8e46d40f0310b7930583413c7942d3845 enviado somente à homologacao_teste; revisão remota conferida. Main remota permanece 7f9b26e062ec2654420fecffb6dd78ad3ba1e017. A API pública GitHub informou contexto Vercel pending / Vercel is deploying your app, deployment AvJkBKGpDS2AewPdmoW4nFgT7rSH. Ambos os containers de teste foram removidos; consultas pelos labels exclusivos retornaram vazias. Aguardar status success antes de executar um lote pontual de retomada do pedido existente, mantendo o Cron desligado e sem nova confirmação no provedor.

**Conclusão da publicação:** contexto Vercel success / Deployment has completed confirmado pela API pública do GitHub no commit f4f936c8e46d40f0310b7930583413c7942d3845, deployment AvJkBKGpDS2AewPdmoW4nFgT7rSH. Correção disponível no Preview. Próximo passo: o operador executa uma única vez process-payments-once.ps1 e fornece o JSON, mantendo o Cron desligado. O lote retoma trabalhos preservados e consulta a cobrança existente; não refazer checkout nem simulação Asaas. Se a inbox aprovar e agendar a próxima conciliação, reconciliation.claimed=0 é esperado e não é falha. Pedido PAID e entrega de e-mail reais ainda precisam de conferência; analisar outbox antes de outro lote.

## 54. WF-19 — consulta inicial sem resposta resolvida; diagnóstico local sem processamento

**Evidência do operador:** process-payments-once.ps1 retornou phase=scope_check, ok=false, httpStatus=null e REQUEST_UNRESOLVED. Pelo fluxo do script, a exceção ocorreu durante a consulta GET de supervisão antes da etapa processing; essa execução não invocou o POST do lote. Não atribuir esse resultado ao timeout da aprovação financeira ou presumir erro de chave apenas a partir de httpStatus=null. Status do pedido e envio real de e-mail permanecem pendentes.

**Conferências do agente:** a API pública do GitHub ainda informa deployment Vercel success para f4f936c. Uma consulta sem autenticação ao caminho fixo de supervisão, com redirects desabilitados, reproduziu httpStatus=null no PowerShell 5.1.26100.9444: errorId MaximumRedirectExceeded e InvalidOperationException, sem Exception.Response. Esse controle demonstra que a ausência de código HTTP também pode ocorrer por redirecionamento bloqueado; não prova o erro exato da consulta autenticada do operador. Não foram usados segredos compartilhados, enviados POSTs ou feitas consultas autenticadas ao banco/provedor pelo agente.

**Ajuste local do diagnóstico:** process-payments-once.ps1 aceita -StatusOnly (somente GET), informa processingAttempted=false, valida entradas vazias/espaços/quebras de linha antes da requisição, classifica MaximumRedirectExceeded como REDIRECT_BLOCKED e expõe somente tipo de exceção/status de transporte enumerado. Não imprime texto da exceção, destinos de redirecionamento, cabeçalhos ou credenciais. Não adiciona retentativa. A opção sem switch mantém um único POST depois das conferências de escopo/legados. Nenhuma mudança de aplicação ou novo redeploy foi necessário.

**Validação:** nove cenários com cmdlets simulados passaram no PowerShell: GET apenas, lote normal, redirecionamento com Response ausente, timeout, exceção desconhecida, escopo incorreto, legados, entrada inválida e resposta perdida no POST. Confere métodos/quantidade de chamadas e ausência dos marcadores de dados privados no JSON. Um problema inicial de escopo de variáveis do harness foi corrigido; a rodada final passou com limpeza de suas variáveis globais. Os testes não fizeram chamadas reais. Próxima evidência solicitada: executar uma vez o script com -StatusOnly e compartilhar apenas o JSON; manter o Cron desligado e aguardar análise antes de enviar novo lote. WF-18/19 continuam abertos; WF-20 NÃO INICIADO.

## 55. WF-19 — consulta autenticada de supervisão aprovada; retomada do lote liberada

**Evidência do operador em 08/10/2026:** execução com -StatusOnly retornou ok=true, phase=scope_check, SCOPE_VERIFIED e processingAttempted=false. Resposta schemaVersion=1, at=2026-10-08T19:57:21.739Z (16:57:21.739 de Brasília), accountScope=sandbox-hml. Inbox: uma entrada READY; outbox: uma COMPLETED. uncertain=0, overdue=0, abandonedLeases=0, untrackedLegacyOrders=0; operations vazio. oldestUnresolvedInboxAt=2026-10-08T18:53:39.463Z. Nenhum valor de segredo foi compartilhado nesta evidência.

**Conclusão limitada:** o acesso autenticado ao Preview e a conferência de escopo/legados passaram nesta consulta. A falha REQUEST_UNRESOLVED anterior não se repetiu; sua causa específica não foi comprovada. O GET não aplicou pagamento. A entrada READY permanece aguardando consumo; a outbox COMPLETED isolada não comprova envio do e-mail de confirmação. O marcador de conta continua sendo conferência de configuração, com isolamento do banco já confirmado previamente pelo operador.

**Próximo passo:** executar uma única vez scripts/homologation/process-payments-once.ps1 sem -StatusOnly, mantendo o Cron desligado, usando o pedido/cobrança existentes. Conferir JSON antes de qualquer repetição, pedido #1 PAID sem ações de pagamento e entrega de e-mail quando aplicável. Não repetir checkout ou confirmação Sandbox. O agente não enviou lote remoto, não alterou código de aplicação nem repetiu testes locais neste turno. WF-18/19 continuam abertos; WF-20 NÃO INICIADO.

## 56. WF-19 — evento processado sem retentativas; conferência comercial e e-mail pendentes

**Evidência do operador em 08/10/2026:** após a consulta SCOPE_VERIFIED, executou o lote pontual orientado e apresentou inbox claimed=1/completed=1/retried=0/review=0; reconciliation claimed=0/completed=0/retried=0/review=0; expiration success=true, processedCount=0/cancelledCount=0/errorCount=0, listas vazias e executionTimeMs=560; outbox claimed=1/completed=1/retried=0/review=0. O resumo não contém horário/identidade do trabalho nem estado financeiro final ou mensagem do provedor de e-mail.

**Conclusão:** o evento da inbox foi concluído sem retentativa ou revisão neste lote. A falha de transação que motivou a correção não reapareceu no resultado informado. Conciliação claimed=0 é compatível com a aplicação pela inbox, que reagenda a consulta da tentativa; não exigir consumo duplicado nas duas etapas. Não houve cancelamento por expiração. Uma entrada da outbox concluiu, mas o agregado não identifica commandType e não comprova envio de confirmação; ORDER_STATUS_CHANGED também usa essa fila e pode preceder o envio do e-mail.

**Conferências imediatas:** solicitar estado atual do mesmo pedido #1 na confirmação/Admin (Pagamento confirmado / PAID, sem QR/copia e cola) e recebimento do e-mail, inclusive spam. Não orientar lote adicional até analisar essas duas informações. Manter agendador desligado; não refazer checkout/confirmar novamente a cobrança. Não foi executado lote remoto pelo agente nem alterado código/deployment neste turno. A entrega do webhook e o processamento desse evento estão evidenciados; aprovação comercial e entrega real de e-mail ainda dependem da conferência do operador. WF-18/19 continuam abertos; WF-20 NÃO INICIADO.

## 57. WF-19 — aprovação comercial confirmada pelo operador; entrega de e-mail ainda pendente

**Evidência do operador em 08/10/2026:** informou pagamento recebido, pedido disponível no painel do usuário e ausência de e-mail. A primeira imagem mostra Pedido #1, PAGAMENTO CONFIRMADO, R$ 24,95, PIX, retirada no balcão, APROVADO / PAGO e acesso ao acompanhamento, sem instruções PIX. A segunda mostra o mesmo pedido no histórico da conta autenticada, marcado Pago, com total R$ 24,95. Isso comprova visualmente o resultado comercial esperado do ensaio segundo a conferência do operador.

**Revisão do fluxo:** applyPaymentEvidence cria a entrada única payment-confirmation:<orderId> / PAYMENT_CONFIRMATION_EMAIL; a transição comercial também cria ORDER_STATUS_CHANGED. O consumidor da outbox reivindica apenas um item quando limit=1 e conta ambos como completed; a conclusão agregada anterior pode ter sido a projeção comercial, sem envio. Não é possível identificar o commandType a partir daquele resumo nem presumir falha no Resend. A ordenação é por nextAttemptAt e id, não uma garantia absoluta de projeção antes de e-mail.

**Próxima ação orientada:** um único lote adicional com process-payments-once.ps1 sem -StatusOnly para consumir o próximo trabalho elegível da outbox, mantendo o mesmo pedido pago e o Cron desativado. A entrada de confirmação é única e trabalhos COMPLETED não são reivindicados novamente. Conferir JSON completo e recebimento no destinatário, incluindo spam; se retried/review ou ausência após o lote, analisar logs antes de outras execuções. Não há criação ou nova confirmação de cobrança nessa orientação. Nenhum POST remoto ou envio de e-mail foi realizado pelo agente, nem mudança de código/deployment ou repetição de testes locais. A aprovação comercial real está evidenciada; entrega real de e-mail e demais cenários do workflow permanecem pendentes. WF-18/19 continuam abertos; WF-20 NÃO INICIADO.

## 58. WF-19 — HTTP 401 na conferência inicial; nenhum novo lote enviado

**Evidência do operador em 08/10/2026:** próxima execução retornou scope_check, ok=false, HTTP 401, WebException/ProtocolError, processingAttempted=false e REQUEST_UNRESOLVED. O script não alcançou o POST do lote, portanto não houve tentativa de processar o próximo trabalho por essa execução. A aprovação comercial do pedido #1 já verificada continua sendo a última evidência; a entrega do e-mail segue pendente.

**Inspeção local:** a rota de supervisão responde 401 quando o valor recebido em Authorization não corresponde ao CRON_SECRET da implantação; o script recebe CRON_SECRET na primeira entrada oculta e bypass Vercel na segunda, acrescentando o prefixo Bearer por conta própria. O código HTTP isolado não contém corpo/origem para distinguir com certeza uma rejeição da rota de outra camada de acesso. Como houve SCOPE_VERIFIED e um lote bem-sucedido anteriormente, priorizar conferir cópia e ordem das mesmas credenciais de homologação, sem alterar segredos ou presumir falha no pagamento/e-mail.

**Orientação:** executar uma vez -StatusOnly, informar primeiro o valor puro de CRON_SECRET que funcionou e depois o bypass Vercel correspondente, sem aspas ou prefixos. Compartilhar apenas o JSON. Aguardar SCOPE_VERIFIED antes de orientar novo lote; se 401 persistir, analisar a invocação GET /api/cron/payments/status e configuração aplicada ao Preview sem divulgar valores. Não houve acesso à .env, alteração de configuração/código/deployment, envio externo ou repetição de testes locais pelo agente neste turno. Manter Cron desligado. WF-18/19 continuam abertos; WF-20 NÃO INICIADO.

## 59. WF-19 — acesso reconfirmado; uma pendência na outbox

**Evidência do operador em 08/10/2026:** -StatusOnly retornou SCOPE_VERIFIED, ok=true, schemaVersion=1, accountScope=sandbox-hml, at=2026-10-08T20:14:09.391Z (17:14:09.391 de Brasília), processingAttempted=false. Inbox: uma COMPLETED, oldestUnresolvedInboxAt=null. Outbox: duas COMPLETED e uma READY. uncertain, overdue, abandonedLeases e untrackedLegacyOrders zerados; operations vazio. O 401 anterior não se repetiu nesta consulta; sua causa específica não foi comprovada.

**Próximo passo:** orientar um único lote com process-payments-once.ps1 sem -StatusOnly, usando as mesmas entradas que acabaram de passar. A pendência READY é compatível com a notificação de pagamento, mas o agregado não informa commandType e não comprova entrega. Analisar JSON e recebimento do e-mail antes de qualquer repetição. Preservar o mesmo pedido pago e manter o Cron desligado. Nenhum lote remoto foi enviado pelo agente; não houve alteração de código/deployment ou repetição de testes locais. WF-18/19 continuam abertos; WF-20 NÃO INICIADO.

## 60. WF-19 — trabalho pendente da outbox concluído; confirmação de entrega aguardada

**Evidência do operador em 08/10/2026:** lote subsequente retornou inbox e reconciliation com claimed/completed/retried/review zerados; expiration success=true, processedCount=0/cancelledCount=0/errorCount=0, listas vazias, executionTimeMs=708; outbox claimed=1/completed=1/retried=0/review=0. O lote consumiu uma entrada sem retentativa ou revisão, compatível com a única READY apresentada na supervisão anterior. Não houve nova conciliação nem cancelamento nesse resumo.

**Limite da evidência:** o JSON agregado não identifica commandType, messageId ou status de entrega no Resend. A aprovação comercial do pedido #1 já foi comprovada visualmente. Para PAYMENT_CONFIRMATION_EMAIL, o código só conclui após sucesso do serviço e messageId, mas não afirmar envio específico ou chegada ao destinatário apenas pelo contador agregado. A confirmação real de recebimento do e-mail ainda não foi fornecida.

**Próximo passo:** solicitar somente conferência de recebimento (caixa de entrada/spam). Não orientar outro lote apenas para repetir evidência; se a mensagem não chegou, examinar o registro de envio correspondente antes de qualquer nova execução. Manter agendador desligado. Nenhum processamento ou envio remoto foi realizado pelo agente; não houve mudança de código/deployment ou repetição de testes locais neste turno. WF-18/19 continuam abertos; WF-20 NÃO INICIADO.

## 61. WF-19 — confirmação PIX do pedido #1 e entrega do e-mail verificadas

**Evidência do operador em 08/10/2026:** informou “Funcionou” e apresentou a mensagem recebida no Gmail. O conteúdo mostra PAGAMENTO APROVADO, CONTINENTAL — HOMOLOGAÇÃO, pedido #1, PIX Dinâmico, retirada no balcão e Total Pago R$ 24,95. Mostra também o item adquirido e aviso de +12 pontos de fidelidade. A apresentação desses pontos no e-mail não substitui auditoria de carteira/ledger nem prova unicidade do crédito. Nenhum endereço do comprador ou credencial foi transcrito para este registro.

**Resultado deste cenário:** o percurso controlado do mesmo pedido/cobrança foi observado em homologação: criação e recuperação das instruções PIX após correção de metadado nulo; consulta atual da cobrança Sandbox; recebimento do webhook HTTP 200; retomada da inbox após ajuste do prazo transacional; tela de pagamento confirmado e pedido Pago no painel do usuário; conclusão da outbox sem retry/review; e recebimento da confirmação no destinatário. O total mostrado no Asaas, na confirmação e no e-mail é R$ 24,95. O e-mail mostra data 08/10/2026 17:00; a correspondência com datas bancárias do provedor não foi auditada nesta conferência. Não inferir validação de descontos/valores dos itens ou conciliação completa de pontos a partir da imagem.

**Fechamento limitado:** cenário de confirmação PIX com entrega real de e-mail considerado aprovado pelas evidências apresentadas. Isso não encerra a homologação integral: duplicidade/eventos fora de ordem, cancelamento/estorno, expiração, demais métodos, datas bancárias, inventário/pontos, capacidade, dados legados e gates operacionais permanecem conforme o workflow. Próxima frente financeira sugerida: E08, repetir evento de forma controlada e conferir efeitos únicos sem criar outra cobrança. Preservar pedido #1 pago, manter Cron desligado e não enviar novos lotes apenas para repetir a confirmação. Nenhuma chamada remota, novo teste local, alteração de código ou deployment foi realizado pelo agente neste turno. WF-18/19 continuam abertos; WF-20 NÃO INICIADO.

## 62. WF-19 — repetição controlada de webhook preparada; ensaio externo pendente

**Autorização do operador em 08/10/2026:** aceitou a próxima etapa após o recebimento da confirmação por e-mail. A preparação usa o mesmo pedido #1 e o evento já concluído; não cria cobrança nem confirma pagamento novamente.

**Revisão:** receivePaymentEvent sanitiza o envelope, identifica provider/eventId, compara o hash do conteúdo persistido e mantém a entrada existente. Evento COMPLETED retorna PROCESSED; mesmo ID com conteúdo alterado retorna conflito HTTP 409. Campos desconhecidos do provedor são removidos antes do hash. O ID/dateCreated/status originais precisam ser preservados. A documentação Asaas confirma entrega que pode repetir eventos e consulta do payload em Menu do usuário / Integrações / Logs de Webhooks; não foi comprovada uma opção para reenviar individualmente evento concluído, portanto a preparação utiliza POST controlado ao endpoint da aplicação.

**Preparação local:** criado scripts/homologation/replay-paid-pix-event.ps1, destinado exclusivamente ao Preview fixo de homologacao_teste. Aceita arquivo JSON reduzido, bloqueia campos privados/desconhecidos, exige PIX de R$ 24,95 e correlação com pedido #1 quando presente. Entrada de segredos oculta: CRON_SECRET, bypass e ASAAS_WEBHOOK_TOKEN, sem ler .env. Confere sandbox-hml, ausência de pendências e filas COMPLETED antes do envio; um único POST de webhook, seguido de GET de supervisão. Não invoca processamento nem API do provedor e não repete automaticamente. Espera PROCESSED e quantidades de filas inalteradas. Erro/timeout/conflito requer conferência, com indicação de tentativa de replay sem imprimir exceção bruta ou credenciais.

**Validação:** onze cenários com cmdlets simulados passaram no PowerShell: duplicata concluída, escopo incorreto, fila pendente, pedido incorreto, payload com dados extras, segredo inválido, ID ainda não processado, mudança de contagens, timeout no POST, timeout no GET posterior e redirecionamento. Conferem métodos/quantidade de chamadas, preservação dos campos originais e ausência de marcadores privados na saída. Nenhuma chamada real ao Preview, Neon, Asaas ou Resend foi realizada. Procedimento incluído na seção 10 do guia; nenhuma mudança de aplicação, commit, push ou redeploy neste turno.

**Pendente:** solicitado ao operador o envelope original reduzido, sem dados de cliente/segredos, antes de preparar o arquivo e orientar sua execução. Conferir saldo/crédito de fidelidade e quantidade de e-mails antes/depois. Filas inalteradas e PROCESSED evidenciam deduplicação de entrega; agregados/saldo visual não substituem auditoria de ledger/estoque nem todos os ensaios E08. A repetição real não foi executada nem aprovada. WF-18/19 continuam abertos; WF-20 NÃO INICIADO.

## 63. WF-19 — evento original e referência da carteira conferidos; repetição pronta

**Evidência do operador em 08/10/2026:** forneceu os campos reduzidos do evento PAYMENT_RECEIVED original, com dateCreated=2026-10-08 15:53:37, id de evento evt_d26e303b238e509335ac9ba210e51b0f&21426306 e cobrança pay_r4gdsmosa0lh851z. payment.externalReference corresponde ao pedido UUID 04e34a9a-70da-4816-b691-3e31c85935b9, billingType=PIX, value=24.95 e status=RECEIVED. O conteúdo foi organizado em scripts/homologation/pix-order-1-received-event.json, sem adicionar campos opcionais ou alterar os valores fornecidos.

**Referência anterior à repetição:** imagem da carteira mostra saldo disponível 113 pontos (R$ 5,65), pendentes 0, total já acumulado 612 e quatro registros. Um crédito de +12 pontos em 08/10/2026 17:00, um débito de -499 pontos em 08/10/2026 13:29 e ajustes anteriores de +200/+400. O operador informou que não chegou outro e-mail de confirmação além do já comprovado. Estes são dados de comparação antes do replay; não são resultado do teste de duplicidade nem auditoria direta do banco.

**Validação do arquivo:** execução do script com cmdlets substituídos por respostas locais aceitou exatamente esse evento, preservou id/data/payment/ref/valor/status e simulou somente Get,Post,Get. Nenhuma conexão real foi feita, nenhum segredo foi lido de .env e nenhum pagamento/e-mail foi enviado. Não houve alteração no script da etapa 62, mudança de aplicação, commit, push ou redeploy.

**Orientação:** executar uma única vez replay-paid-pix-event.ps1 -EventFile scripts/homologation/pix-order-1-received-event.json no PowerShell da pasta do projeto. Informar os três segredos em entradas ocultas: CRON_SECRET, bypass Vercel e ASAAS_WEBHOOK_TOKEN (não ASAAS_API_KEY). Manter Cron desligado. Compartilhar o JSON agregado; se houver qualquer resultado diferente de DUPLICATE_ACCEPTED/PROCESSED/queuesUnchanged=true, parar e analisar sem repetir automaticamente nem processar filas. Depois da repetição aceita, atualizar a carteira/pedido e comparar 113 disponíveis, 0 pendentes, quatro registros e um único crédito de +12, além da ausência de outro e-mail. Aprovação real permanece pendente. WF-18/19 continuam abertos; WF-20 NÃO INICIADO.

## 64. WF-19 — webhook repetido reconhecido como concluído; filas inalteradas

**Evidência do operador em 08/10/2026:** execução pontual retornou ok=true, phase=after_check, code=DUPLICATE_ACCEPTED, webhookStatus=PROCESSED, queuesUnchanged=true, replayAttempted=true e processingAttempted=false. Antes e depois: inbox COMPLETED count=1; outbox COMPLETED count=3. O resumo não contém horário/identidade da requisição, mas corresponde à saída do script preparado para o evento original do pedido #1.

**Conclusão limitada:** a aplicação reconheceu a repetição como evento já concluído e as contagens das filas permaneceram iguais. Nenhum lote de processamento foi invocado por esse script. O resultado evidencia deduplicação dessa entrega real em homologação; não comprova isoladamente saldo/ledger/estoque ou entrega de e-mail após o replay. A referência anterior permanece: 113 pontos disponíveis, 0 pendentes, quatro movimentações com um crédito de +12 e nenhum e-mail adicional.

**Pendente:** solicitada conferência do operador após atualizar pedido, carteira e caixa de entrada: mesmo pedido Pago, mesmos pontos/registros e confirmação de e-mail única. Não repetir o replay nem orientar lote adicional para produzir a mesma evidência. Manter Cron desligado. O agente apenas registrou a evidência; não enviou chamadas remotas, alterou aplicação/deployment nem repetiu testes locais neste turno. Demais ensaios de concorrência, eventos fora de ordem e gates continuam pendentes; WF-18/19 abertos, WF-20 NÃO INICIADO.

## 65. WF-19 — cenário de webhook duplicado aprovado em homologação

**Conferência posterior do operador em 08/10/2026:** após analisar os painéis de pedidos e pontos e a caixa de e-mail, incluindo SPAM, confirmou os dados inalterados: pedido #1 Pago, 113 pontos disponíveis, 0 pendentes, quatro movimentações com um único crédito de +12 e nenhum novo e-mail de confirmação. Essa conferência ocorreu após a repetição aceita na seção 64, completando a comparação com a referência da seção 63.

**Resultado:** cenário de entrega duplicada do mesmo PAYMENT_RECEIVED concluído considerado aprovado neste ensaio de homologação. A resposta foi DUPLICATE_ACCEPTED/PROCESSED com inbox COMPLETED=1 e outbox COMPLETED=3 antes/depois; a conferência visual posterior não mostrou regressão do pedido, crédito adicional ou nova confirmação por e-mail. O script não invocou lote de processamento. Não repetir comandos para obter a mesma evidência; preservar o pedido e manter o Cron desligado.

**Limites:** resultado referente a um evento original repetido após sua conclusão, combinado com as conferências do operador. Não equivale a auditoria direta de estoque/ledger ou aprovação de todas as condições E08: concorrência, eventos fora de ordem, evento antes da resposta do checkout e recuperação de lease continuam pendentes conforme workflow. Nenhum teste adicional ou chamada remota foi realizado pelo agente neste turno; somente atualização do acompanhamento local, sem mudança de aplicação, commit, push ou redeploy. WF-18/19 continuam abertos; WF-20 NÃO INICIADO.

## 66. WF-19 — notificação sintética fora de ordem preparada; execução externa pendente

**Continuidade autorizada pelo operador em 08/10/2026:** aceitou avançar após o cenário de duplicidade aprovado. Revisados consumidor/contrato/eventos e matriz E08: a inbox usa o webhook para correlacionar a tentativa e consultar o contrato atual da cobrança. O teste existente de pending tardio e contrato remoto obsoleto preservou PAID/APPROVED, providerStatus RECEIVED e versão 1 na rodada Docker anterior da seção 53. Nenhuma alteração de aplicação necessária nesta preparação.

**Ensaio preparado:** arquivo scripts/homologation/pix-order-1-late-pending-test-event.json com PAYMENT_CREATED/PENDING, cobrança real pay_r4gdsmosa0lh851z, referência do pedido #1, PIX/R$24,95. Identidade evt_hml_test_order_1_late_pending_v1 e dateCreated 2026-10-08 13:30:00 são valores sintéticos do ensaio, não evento original fornecido pelo Asaas. A data representa período anterior ao recebimento, e o ID fixo evita novas identidades em repetição. A documentação oficial webhook-para-cobrancas foi conferida para a semântica PAYMENT_CREATED. Não se está alterando o pagamento no provedor.

**Ferramenta:** estendido replay-paid-pix-event.ps1 com -LatePending; valida exatamente fixture/conta/valor/correlação antes de entradas ocultas e acesso. Primeira supervisão exige filas concluídas e sem pendências/operações. Após um único POST ao webhook, o modo sintético permite exatamente uma nova READY na inbox e exige contagem COMPLETED da inbox/outbox inalterada. Retorna LATE_EVENT_QUEUED/RECEIVED, syntheticEvent=true, oneNewInboxReady/outboxUnchanged e processingAttempted=false. Não chama processamento nem API do provedor, nem repete automaticamente. O modo padrão de duplicata permanece disponível.

**Validação local:** 20 cenários passaram em tests/scripts/replay-paid-pix-event.test.ps1: os 11 anteriores mais nove para o modo sintético (aceitação, cobrança errada, fila prévia pendente, evento já concluído, READY ausente/excedente, outbox alterada, timeout no POST e GET posterior). Cmdlets substituídos, sem Preview/Neon/Asaas/Resend. Não houve alteração de aplicação, commit, push ou redeploy; não repetidos testes Docker sem nova alteração/falha. Guia atualizado na seção 11.

**Próximo resultado necessário:** operador executar uma única vez o script com arquivo sintético e -LatePending, mantendo Cron desligado. Conferir JSON de aceitação antes de orientar o único lote de consumo. RECEIVED/READY apenas comprova entrada, não o cenário completo. Depois do lote, consultar supervisão somente com -StatusOnly e comparar inbox COMPLETED=2/outbox COMPLETED=3 e pedido Pago/113 pontos/0 pendentes/quatro movimentações/crédito único +12/e-mail único. Esses valores posteriores são expectativa, não evidência atual. Falha/resultado diferente requer análise, sem alterar o ID ou repetir automaticamente. O teste é de aplicação com evento injetado, não de reordenação real pelo provedor. WF-18/19 continuam abertos; WF-20 NÃO INICIADO.

## 67. WF-19 — notificação antiga sintética aceita na inbox; consumo pendente

**Evidência do operador em 08/10/2026:** execução com -LatePending retornou ok=true, phase=after_check, code=LATE_EVENT_QUEUED, syntheticEvent=true, webhookStatus=RECEIVED, oneNewInboxReady=true, outboxUnchanged=true, replayAttempted=true e processingAttempted=false. Antes: inbox COMPLETED=1 e outbox COMPLETED=3. Depois: inbox COMPLETED=1, readyCount=1 e outbox COMPLETED=3.

**Conclusão limitada:** o endpoint recebeu/persistiu a simulação de notificação antiga e existe exatamente uma entrada nova pronta para consumo. A outbox manteve suas contagens, sem novo trabalho nesse resultado. Nenhum lote foi chamado pelo script de envio. Ainda não se comprovou o comportamento ao consumir esse evento; RECEIVED/READY não representa conclusão do teste de evento fora de ordem.

**Próxima ação orientada:** um único lote no PowerShell com scripts/homologation/process-payments-once.ps1, sem -StatusOnly, entradas ocultas CRON_SECRET e bypass de homologação. Manter Cron desligado, mesma cobrança/pedido e expiração desabilitada conforme configuração já conferida. Esperar inbox claimed=1/completed=1/retried=0/review=0 e nenhum consumo novo de outbox; analisar o resumo completo antes de qualquer outra execução. A conciliação pode consumir tentativa se seu prazo tiver vencido, sem exigir contadores zerados nessa etapa para todos os horários. Após consumo sem falhas, conferir supervisão somente com -StatusOnly e pedido/carteira/e-mail antes de aprovar o cenário. Em erro/timeout/retry/review, preservar resultado e investigar; não repetir automaticamente a notificação nem criar novo ID sintético.

**Limites e alterações:** resultado de notificação sintética injetada após pagamento, não reordenação real do Asaas. Nenhuma chamada remota, mudança de aplicação/script, commit, push ou redeploy foi feita pelo agente neste turno; apenas registro local e orientação do lote já preparado. Não repetidos testes locais sem mudanças. WF-18/19 continuam abertos; WF-20 NÃO INICIADO.

## 68. WF-19 — notificação antiga concluída sem retry/review; conferências finais pendentes

**Evidência do operador em 08/10/2026:** lote posterior à entrada sintética retornou inbox claimed=1/completed=1/retried=0/review=0; reconciliation claimed/completed/retried/review zerados; expiration success=true, processedCount/cancelledCount/errorCount zerados, listas vazias e executionTimeMs=609; outbox claimed/completed/retried/review zerados. O resumo não apresenta horário ou identidade do trabalho, mas corresponde à etapa orientada após LATE_EVENT_QUEUED.

**Conclusão limitada:** um evento da inbox foi concluído sem retentativa/revisão; não houve consumo de conciliação, cancelamento por expiração ou trabalho de outbox nesse lote. O resultado é compatível com o consumo da única entrada sintética READY e a ausência de nova transição comercial. Os contadores de lote não substituem a supervisão das contagens persistidas nem a conferência do pedido/carteira/e-mail após consumo; não declarar o cenário completo aprovado somente pelo agregado.

**Próximas evidências:** uma consulta somente de leitura com scripts/homologation/process-payments-once.ps1 -StatusOnly, utilizando CRON_SECRET/bypass em entradas ocultas, deve mostrar inbox COMPLETED=2, outbox COMPLETED=3 e nenhum trabalho pendente/lease/operação/revisão. O operador deve confirmar após atualizar os painéis e conferir caixa de entrada/SPAM: pedido #1 Pago, 113 pontos disponíveis, 0 pendentes, quatro movimentações com crédito único +12 e nenhum novo e-mail. Esses são resultados esperados, ainda não apresentados após esse lote. Não executar outro lote de processamento nem repetir a simulação para produzir novamente a mesma evidência; manter Cron desligado.

**Alterações e limites:** apenas registro local e orientação das conferências; nenhum teste local, chamada remota, mudança de aplicação/script, commit, push ou redeploy pelo agente neste turno. Trata-se de evento sintético entregue à aplicação após aprovação, não de reordenação real da infraestrutura Asaas. Cenário de evento fora de ordem ainda em conferência final; demais E08 e WF-18/19 permanecem abertos, WF-20 NÃO INICIADO.

## 69. WF-19 — carteira preservada após evento antigo; supervisão final aguardada

**Evidência do operador em 08/10/2026:** respondeu “Está tudo ok” à solicitação de conferências finais e apresentou a carteira atualizada. A imagem mostra saldo disponível 113 pontos, pendentes 0, total já acumulado 612 e quatro movimentações: crédito de +12, débito de -499 e ajustes anteriores +200/+400. O extrato exibido permaneceu igual à referência anterior à simulação. A resposta geral confirma a conferência solicitada; pedido/e-mail não aparecem nesta imagem, portanto sua verificação é relato do operador, não evidência visual específica deste turno.

**Conclusão limitada:** conferência visual da carteira aprovada após consumo sem retry/review registrado na seção 68, sem crédito adicional aparente. Não confundir com auditoria direta de estoque/ledger. O JSON da consulta posterior -StatusOnly ainda não foi apresentado: inbox COMPLETED=2, outbox COMPLETED=3 e ausência de pendências são expectativas que precisam ser registradas com a resposta real, não presumidas a partir da imagem.

**Próximo dado solicitado:** compartilhar somente o JSON da consulta process-payments-once.ps1 -StatusOnly. Se já executada, reutilizar seu resultado; não repetir consulta apenas para obter a mesma evidência. Se ainda não executada, realizar uma única leitura com entradas ocultas CRON_SECRET/bypass, mantendo Cron desligado. Não enviar lote de processamento nem repetir a simulação. Nenhuma chamada remota, mudança de aplicação/script, teste local, commit, push ou redeploy pelo agente neste turno; apenas registro local. Cenário de notificação fora de ordem com carteira preservada e conclusão técnica final aguardando supervisão; WF-18/19 abertos, WF-20 NÃO INICIADO.

## 70. WF-19 — cenário simulado de notificação fora de ordem aprovado em homologação

**Supervisão final apresentada pelo operador em 08/10/2026:** consulta -StatusOnly retornou phase=scope_check, ok=true, code=SCOPE_VERIFIED, processingAttempted=false e schemaVersion=1. at=2026-10-08T21:53:02.744Z (18:53:02.744 de Brasília), accountScope=sandbox-hml. Inbox: duas COMPLETED; outbox: três COMPLETED. uncertain=0, overdue=0, abandonedLeases=0, untrackedLegacyOrders=0, operations vazio e oldestUnresolvedInboxAt=null. Não há outros estados de fila no agregado apresentado.

**Resultado combinado:** a simulação PAYMENT_CREATED/PENDING foi aceita após o pedido já pago (seção 67), consumida com inbox completed=1/retried=0/review=0 sem consumo de outbox ou cancelamento por expiração (seção 68), seguida da conferência geral do operador e imagem da carteira inalterada (seção 69). A supervisão atual comprova duas entradas concluídas na inbox, outbox ainda com três concluídas e ausência de pendências. Pedido Pago e ausência de novo e-mail permanecem conforme relato do operador; carteira mostrou 113 disponíveis, 0 pendentes, quatro movimentações e crédito único de +12. O cenário simulado de notificação antiga entregue após aprovação está aprovado neste ensaio de homologação.

**Fechamento e limites:** preservar pedido/cobrança e manter Cron desligado; nenhum lote adicional ou repetição da simulação é necessário para a mesma evidência. A notificação foi sintética, não uma reordenação real da infraestrutura Asaas, e as conferências não equivalem a auditoria direta de estoque/ledger. Demais condições E08 (concorrência, lease vencido, evento antes da resposta), outros cenários financeiros e gates de produção continuam pendentes. Não houve chamada remota, teste local, alteração de aplicação/script, commit, push ou redeploy pelo agente neste turno; somente atualização do registro/guia. WF-18/19 continuam abertos; WF-20 NÃO INICIADO.

## 71. Consolidação das pendências para concluir workflow e liberar produção — 08/10/2026

**Solicitação:** operador perguntou o que falta para concluir o workflow completo e deixar o projeto pronto para produção. Revisados workflow, matrizes WF-18/WF-19, checkpoints de dados/capacidade, análise de infraestrutura e registro até a seção 70. Não executados testes, consultas autenticadas, auditoria da base atual ou inspeção dos planos/configurações externos.

**Conclusão:** três etapas de encerramento permanecem: WF-18 em execução para reconciliação/aceite de legados e LA-002/033; WF-19 em execução para critérios integrados dos 38 LA e operação no candidato; WF-20 não iniciado para implantação/observação. PIX positivo com e-mail, duplicata e notificação antiga sintética estão aprovados como cenários limitados. A implementação principal dos achados e a bateria de ensaios locais não equivalem à prontidão integral.

**Pendências consolidadas:** ciclo financeiro completo (cancelamento/expiração/pagamento tardio/estorno e efeitos), métodos/contratos de boleto/cartão, falhas reais entre I/O/commit e recuperação por outro executor, concorrência/lease/evento antes da resposta, inventário/carteira/histórico legados, frete externo, UI/identity/auth/Admin/fulfillment/métricas, página completa/capacidade/locks/custos, cron durável/heartbeat/alertas/responsáveis, recuperação administrativa, candidato congelado e aceites individuais, migrations/contingência e observação de produção. Snapshot de 04/10 (24 pedidos, 33 itens sem vínculo, duas referências remotas e duas carteiras) não foi tratado como base atual nem somado como entidades distintas. Piloto histórico da home próximo de 6,1s/p95, fora da meta informada, deve ser resolvido/revalidado.

**Fontes externas conferidas:** documentação oficial Vercel Hobby confirma restrição a uso pessoal não comercial; documentação Resend 403-error-resend-dev-domain confirma onboarding@resend.dev somente para destinatário da própria conta e necessidade de domínio verificado para outros destinatários. Plano atual/configuração do domínio na produção não foram inspecionados; não afirmar que não exista remetente de produção configurado. Não recomendado upgrade financeiro com custo estimado não medido nem executada alteração de plano/segredo/domínio. Configuração comercial, orçamento Neon e scheduler permanente devem ser aprovados no planejamento operacional.

**Documentação:** atualizado cabeçalho do workflow para 08/10, acrescentada seção 12 com cenários comprovados, frentes restantes, condições de configuração e ordem de conclusão; matriz WF-19 recebeu seção 13 preservando os checkpoints anteriores e incorporando os cenários recentes. Não marcados checkboxes antigos como completos sem evidência, nem promovidos LA por aprovação de um pedido. Apenas documentação local; sem código, testes adicionais, commit, push, redeploy ou mutação externa. Próxima frente sugerida: completar recuperação/concorrência e ciclo financeiro em ambientes isolados/Sandbox, junto da resolução dos dados e infraestrutura; manter Cron de homologação desligado. Projeto permanece sem liberação de produção.

## 72. Decisões de hospedagem, banco e remetente de produção — 08/10/2026

**Decisões explícitas do operador:** Vercel somente nesta etapa de homologação e Google Cloud na produção; manter Neon Free; ao final configurar o e-mail da loja para envio automático a destinatários diferentes da própria conta Resend. Serviço Google Cloud, região e frequência/executor permanentes não foram escolhidos nessa instrução. A sugestão anterior de Vercel comercial/Neon Launch não foi aceita e deixa de orientar a trajetória atual.

**Implicações conferidas:** publicação, domínio/links/cookies, configuração, webhook, consumidores, observabilidade, custos e capacidade precisam ser validados no Google Cloud antes da liberação; Preview não certifica esse ambiente. Neon informa atualmente 100 CU-hours/projeto/mês e 1 GB de banco por projeto, conforme atualização oficial de 02/10. Um compute constante de 0,25 CU ativo 24h por 30 dias consumiria 180 CU-hours; essa hipótese excede a franquia e não é previsão baseada no tráfego real. Manter Free exige medir e adequar o trabalho durável e a latência às cotas. Hospedar no Google Cloud não altera a franquia do banco. O webhook atual persiste READY e não executa o consumidor; eventual processamento por demanda precisa de executor e recuperação, sem perder eventos ou ampliar atraso indevidamente. Nenhum novo agendamento foi escolhido.

**Remetente:** a documentação Resend exige domínio próprio verificado; configurar apenas endereço não basta. Conferir DNS, EMAIL_FROM e autorização da chave no ambiente final, e testar entrega automática a destinatários externos e links antes de abrir a loja. Configuração existente de produção não foi inspecionada e não foi declarada ausente.

**Alterações:** workflow seção 12.3 revisada e 12.5 acrescentada; análise de infraestrutura passou a identificar estimativas/propostas anteriores como históricas e recebeu seção 10 com a trajetória escolhida. Somente documentação local, sem leitura de .env, código, testes adicionais, chamadas autenticadas, alteração de segredos/planos, recursos Google Cloud, commit, push ou redeploy. Ensaios extensos continuam em Docker/clone e integrações dirigidas no Preview/Sandbox; validação final na infraestrutura escolhida permanece aberta. WF-18/19 abertos; WF-20 NÃO INICIADO.

## 73. Proposta de poupar Neon na madrugada; política ainda a definir — 08/10/2026

**Proposta do operador:** tentar poupar horas após 00h. Não informou horário final nem pediu desligamento imediato. Considerada a referência America/Sao_Paulo, sem escolher janela ou alterar configuração.

**Conferência:** fonte oficial Neon confirma scale to zero no Free após cinco minutos de inatividade, com retomada ao acesso. Revisados payment-scheduler.worker.mjs e app/api/cron/payments/route.ts: o agendador consulta supervisão e pode chamar processamento; o lote executa inbox, conciliação, expiração e outbox. O webhook atual somente persiste a inbox, conforme análise anterior. Retirar varreduras vazias pode favorecer suspensão, mas interromper indiscriminadamente o executor pode deixar pagamento e e-mail aguardando até a retomada. Economia deve preservar webhook, consumo durável de trabalho, recuperação e prazos de expiração.

**Cálculo de cenário:** suspensão completa hipotética 00h–08h, com atividade constante nas outras 16h a 0,25 CU durante 30 dias, resultaria em 120 CU-hours, acima da franquia de 100. Nessa capacidade constante, 100 CU-hours equivalem a 400h/mês ou aproximadamente 13h20/dia em 30 dias, sem margem adicional. Não é estimativa de tráfego, exigência de fechar a loja ou promessa de suspensão: acessos/eventos/rotinas podem acordar o compute. Estratégia deve combinar inatividade entre acessos e processamento necessário por demanda, comprovados por medição.

**Alterações:** acrescentada seção 12.6 ao workflow. Sem leitura de .env, alteração de código, cron, flags ou configuração remota; sem execução financeira, testes adicionais, commit/push/deploy. Cron de homologação permanece desligado conforme estado relatado. Proposta de economia noturna pendente de desenho, janela/prioridades e validação de consumo; WF-18/19 abertos, WF-20 NÃO INICIADO.

## 74. Responsável pelo acesso Google Cloud e deploy final — 08/10/2026

**Definição do operador:** **Vanderlei (Que dá idéia errada)** possui acesso ao Google Cloud e será responsável pelo deploy final e por colocar o projeto em produção. O plano em dupla foi ajustado para atribuir a ele coordenação da janela, consolidação do go/no-go após os gates e execução da publicação. **Leno (Brega)** mantém a preparação/validação dos dados, migrations, aceite financeiro e primeiras conciliações; fornece procedimentos ensaiados quando a execução depender do acesso à nuvem de Vanderlei.

**Documentos alinhados:** plano em dupla, manuais rápidos de ambos, relatórios 1/2 e consolidação do workflow. A nota no estudo de caso preserva seu caráter genérico. A preparação de L-09 precede o deploy; a observação ocorre em conjunto com V-09, sem exigir que a implantação já esteja concluída para entregar os procedimentos.

**Limites:** acesso informado não comprova serviço/região/billing já configurados. Os critérios de WF-18/WF-19 permanecem obrigatórios; esta atualização apenas distribui responsabilidades. Nenhuma operação externa, configuração, código, segredo ou deployment foi alterado. WF-18/19 seguem abertos; WF-20 NÃO INICIADO.

## 75. L-01 — Recuperação financeira com encerramento de processos — 09/10/2026

**Responsável: Leno (Brega). Revisor previsto: Vanderlei (Que dá idéia errada), pendente.** Branch local `trabalho/leno/l01-recuperacao-financeira`, base `e0214e699b71de51696133de19808a1f8dbdc795`. Primeiro bloco local de L-01 iniciado após o compartilhamento do projeto informado pelo operador.

**Resultado:** 12 testes novos com processos Node separados e PostgreSQL descartável, junto de 40 regressões financeiras existentes, passaram (52/2 arquivos, 78,18 s de Vitest). Duas provas negativas de isolamento, TypeScript e ESLint direcionado passaram. Harness aplicou 33 migrations no banco temporário; consulta final por label sem containers próprios remanescentes. Provedores controlados via IPC, sem operação externa.

**Correção demonstrada por regressão:** webhook aprovava antes da resposta de criação e `executePaymentAttempt` sobrescrevia `Order.asaasPaymentStatus` RECEIVED com PENDING. A gravação complementar deixou de definir esse campo; a projeção permanece com `applyPaymentEvidence`. Sem alteração de schema/contrato público.

**Cobertura e limites:** morte antes/depois da criação remota e conclusão local, antes/depois do commit financeiro de inbox/reconciliação, disputa/retomada de lease, executor antigo e e-mail aceito antes do ack. Expiração antecipada apenas na fixture; aceitação/idempotência externa simuladas. Não comprova todos os pontos de falha, contratos Sandbox, pacote de release ou operação Google Cloud. [Evidência detalhada e próximos passos](../../../../../PACOTE_REVISAO_VANDERLEI/L-01-RECUPERACAO_FINANCEIRA_PROCESSOS.md). Entrega local ainda sem publicação; revisão/integração pendentes. L-01 e WF-18/19 permanecem abertos; WF-20 NÃO INICIADO.

## 76. L-01 — Commit inicial e reversões interrompidas — 09/10/2026

**Responsável: Leno (Brega). Revisão de Vanderlei (Que dá idéia errada) pendente.** Na mesma branch/base da seção 75, acrescentados nove testes: queda antes do commit inicial e CANCEL/REFUND, cada um antes do transporte, depois da aceitação, antes do commit financeiro e depois da conclusão local. Cada retomada usa outro processo e o mesmo banco descartável.

**Resultado final:** 61 testes/2 arquivos aprovados (21 entre processos + 40 regressões), 130,33 s de Vitest; TypeScript/lint direcionado aprovados. Preservados os resultados anteriores sem somar repetições. Nenhuma nova correção de produção necessária neste bloco. O estorno integral da fixture não expedida restitui estoque e compensa ganho de pontos uma vez; operações sem prova conservam estado e entram em revisão após prazo. Repetir comando/solicitar conciliação não concede permissão para reenviar operação inconclusiva.

**Limites:** transporte controlado via IPC e prazos antecipados só nas fixtures; nenhum cancelamento/estorno/e-mail externo, migration persistente, publicação ou deploy. [Reprodução, cenários e pendências](../../../../../PACOTE_REVISAO_VANDERLEI/L-01-RECUPERACAO_FINANCEIRA_PROCESSOS.md), seção 6. Revisão/integração e ciclo externo L-04 permanecem pendentes; WF-18/19 abertos e WF-20 NÃO INICIADO.

## 77. L-04 — Prazos/métodos e aplicação financeira com banco lento — 09/10/2026

**Responsável: Leno (Brega). Revisor: Vanderlei (Que dá idéia errada), pendente.** Mesma branch/base da seção 75. Acrescentada `payment-lifecycle-homologation.test.ts` com oito casos: checkout/expiração com aprovação e consulta lenta, boleto dentro/depois da tolerância congelada, cartão em risco, recusa integral de três parcelas, estorno de uma parcela inteira com revisão e estado de chargeback não implementado.

**Regressões e correção:** antes do patch, dois testes reproduziram transação expirada após 5,5 s: checkout retornava PROCESSING e expiração reportava erro ao aplicar pagamento recebido. Ambos agora reutilizam `paymentEvidenceTransactionOptions` (maxWait 5 s, timeout 30 s) nas transações locais pertinentes. I/O externo continua fora; nenhum timeout global, schema, migration ou política comercial foi alterado. A projeção monotônica corrigida em L-01 permanece na entrega.

**Validação final:** 90 testes/quatro arquivos aprovados (8 ciclo + 40 duráveis + 21 plano + 21 processos), 147,97 s de Vitest; TypeScript e lint direcionado aprovados. Casos anteriores incluídos, não somados novamente. PostgreSQL Docker descartável, 33 migrations e identidade do harness conferida. [Evidência e roteiro externo](../../../../../PACOTE_REVISAO_VANDERLEI/L-04-CICLO_FINANCEIRO_LOCAL_E_ENSAIOS_EXTERNOS.md); [material de revisão](../../../../../PACOTE_REVISAO_VANDERLEI/REVISAO_LENO_L01_L04_PARA_VANDERLEI.md) preparado.

**Limites:** gateway injetado; uma parcela inteira estornada não demonstra produtor de estorno de valor parcial; chargeback conservado para revisão não equivale à implementação do ciclo. Sem recurso externo, alteração de configuração/segredo, operação do pedido #1, build final, publicação ou deploy. Disponibilidade real dos métodos da conta e revisão/integração aguardadas. L-04 e WF-18/19 permanecem abertos, WF-20 NÃO INICIADO.
