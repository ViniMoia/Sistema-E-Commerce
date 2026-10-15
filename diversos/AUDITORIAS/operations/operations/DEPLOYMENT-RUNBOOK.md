# Implantação e recuperação do banco existente

Revisão em 15/10/2026. Procedimento preparado na homologação, **não executado em produção**. Main e seu banco permanecem somente leitura para o assistente. O destino definido pelo operador é o banco já conectado à main; não criar outra base de produção por padrão nem substituir sua conexão pela homologação.

## Base comprovada e responsáveis

Origem: `7f9b26e062ec2654420fecffb6dd78ad3ba1e017`. Aplicação candidata: `8632514f03bded8ca0143f0ac053fa8ceadade30`, mais ferramentas/documentação locais ainda não publicadas. Não há SHA final de release desse conjunto local.

As 13 migrations passaram no clone PostgreSQL 18, com diff vazio, preservação de dados/sequências e segundo deploy sem trabalho novo. Quatro produtos/dez variantes de teste ficaram indisponíveis no clone, mantendo 518 produtos comerciais. Duas carteiras foram abertas com saldo zero, ajustes e auditoria; 24 pedidos/33 itens e movimentos antigos foram preservados. Compra nova, replay, estoque e pontos foram exercitados com pagamento manual controlado. Evidências: `trabalho_em_dupla/evidencias/L-BANCO-*.json` e seções 36–40 do replanejamento.

Leno confere dados, migrations e obrigações financeiras; Vanderlei confere runtime, acesso de recuperação, roteamento, executor e alertas. Registrar executor, revisor, janela, canal de incidente e decisão de abortar.

## Ficha necessária para uma futura implantação autorizada

| Campo | Evidência necessária |
|---|---|
| Release | Commit final publicado, CI correspondente e digest imutável validado. |
| Banco | Identidade/schema do destino, sem string de conexão; contas de runtime e migration separadas. |
| Runtime | Projeto/região/serviço/domínio, revisão anterior, versões de segredos por referência. Não usar identificadores de exemplo. |
| Recuperação | Backup fresco, acesso pelo responsável alternativo, retenção e restore comprovados; RPO/RTO definidos. |
| Contenção | Regra efetiva que bloqueia novas compras e plano de suspensão dos demais escritores, ambos ensaiados. |
| Eventos | Destino durável dos webhooks ou reentrega efetiva comprovada, leases e obrigações abertas, critérios de retomada. |
| Dados de teste | Manifesto de IDs/hashes e tratamento final revisado separadamente das migrations. Scripts de clone não aceitam destino compartilhado. |
| Observação | Critérios de erro, latência, backlog, conexões, janela de acompanhamento e canal de alerta. Limiares comerciais ainda não aprovados. |

Cloud Run continua sendo pacote de preparação: `config.example.json` não identifica recursos implantados. A imagem standalone atual não executa migrations nem garante inclusão da Prisma CLI; preparar um checkout/job exclusivo de migração com o lockfile da release.

## Contenção em três fases

### Bloquear compras e drenar

O controle privado `CHECKOUT_PAUSED` foi implementado na candidata local. `true` bloqueia novas propostas e conclusões de compra de todos os meios, incluindo manual; ausência ou `false` mantém o comportamento existente. Qualquer outro valor configurado (inclusive vazio) bloqueia. A variável é lida no servidor, sem `NEXT_PUBLIC_`; não depende de recompilar o cliente. A validação no deployment compartilhado ainda está pendente. Esconder o botão não bloqueia a API.

Aplicar a variável no runtime de **todas** as revisões/instâncias que recebem tráfego. Na Vercel, alterar a configuração do Preview correspondente e fazer redeploy; no Cloud Run, conferir a revisão e distribuição efetiva de tráfego. Revisão antiga/URL de deployment antigo ainda acessível não fica bloqueada por mudar apenas o alias. A variável não é um interruptor distribuído instantâneo: aguardar requisições em voo e impedir acesso a versões antigas antes de declarar contenção.

Entradas atuais: `POST /api/checkout/intents`, `POST /api/checkout` e `POST /api/orders`. Mapear também writers da versão antiga, Admin, importadores e tarefas locais. Bloquear só essas três rotas não congela o banco.

Respostas bloqueadas: HTTP 503, `Cache-Control: private, no-store`, `error: CHECKOUT_PAUSED`. O cliente mostra aviso de pausa sem repetir automaticamente. A proteção existe na API e nos serviços de proposta/criação, antes de abrir transação nesses comandos. `/api/orders` continua exigindo autenticação.

Preservar consulta/recuperação por `GET /api/checkout/intents/[id]`, leitura de pedidos e autenticação necessária. A pausa também bloqueia replay por POST; recuperar resposta perdida pelo GET autorizado, sem reabrir criação. A proposta já existente não é apagada: após retirar a pausa, revisão, validade, estoque e consentimento continuam sendo conferidos normalmente. GET/PATCH de contexto ainda podem criar cesta; carrinho, Admin e outros escritores continuam ativos.

Ensaio no Preview antes da janela: registrar SHA/URL e estado inicial, habilitar `CHECKOUT_PAUSED=true`, comprovar 503 nas três entradas com sessão válida onde exigida, inclusive para proposta aceita antes da pausa; verificar que nenhum pedido/reserva/cobrança foi criado. Consultar pedido existente por GET e conferir recepção/processamento de evento Sandbox já planejado, com as flags financeiras preservadas. Não reenviar estorno nem confirmar boleto reservado para expiração para produzir essa evidência. Retirar a pausa (`false`), redeploy, revisar novamente a compra se expirou e demonstrar uma única criação/replay. Não inferir validação do Preview a partir dos testes locais.

Durante a drenagem, manter recepção durável e processamento compatível de obrigações existentes. `PAYMENT_REMOTE_ENABLED=false` não cobre compras manuais nem todos os escritores. **`PAYMENT_WORKER_ENABLED=false` também faz o webhook retornar 503**: não usar como botão universal de manutenção. O cron de pagamentos combina inbox, reconciliação, expiração e outbox; não presumir que oferece pausa separada de cada etapa.

### Congelar escritores para DDL e tratamento

Depois de bloquear novas compras e registrar trabalhos/leases em voo, suspender coordenadamente os escritores durante o trecho exclusivo. Webhook também escreve na inbox; mantê-lo no mesmo banco não equivale a congelamento de escrita.

Antes dessa suspensão, comprovar recepção em destino durável compatível ou a política efetiva de reentrega do provedor, janela e reconciliação posterior. Não presumir duração de retry nem responder 2xx sem persistência. Se essa continuidade não estiver comprovada, não iniciar o trecho exclusivo. Registrar último evento/posição e trabalhos abertos; não apagar filas, forçar COMPLETED ou rearmar comandos.

### Retomar obrigações antes de abrir vendas

Após schema e dados validados, retomar recepção e consumidores na versão compatível. Conferir conta/ambiente, progresso, leases e reentregas antes de abrir novas compras. A pendência temporal do teste de expiração do boleto foi aceita pelo operador; permanece pendente, sem ser apresentada como aprovação.

## Sequência de aplicação futura

1. Congelar a revisão final publicada e o artefato validado. Working tree local e digest exemplificativo não são release.
2. Reauditar origem em transação somente leitura: IDs/hashes, histórico/checksums de migrations, constraints, volumes, locks e operações abertas. O snapshot de 15/10 às 18:43:55 UTC é referência de ensaio, não backup fresco de qualquer janela futura. Atividade nova exige reclassificação.
3. Comprovar recuperação independente conforme o [runbook de backup](BACKUP-RESTORE-RUNBOOK.md), revisar o tratamento exato e ensaiar contenção.
4. Bloquear, drenar e congelar conforme acima; conferir sessões de escrita e leases, registrar backup/cutoff final.
5. O operador autorizado usa job/checkout com dependências e migrations da revisão congelada. Injetar segredos pelo mecanismo aprovado, sem URL em argumentos/logs, conferindo `DATABASE_URL` e `DIRECT_URL`. Não herdar `.env.local` de homologação.

Comandos existentes na CLI Prisma instalada (5.22), **para essa futura etapa autorizada**, não para executar agora contra main:

```powershell
node node_modules/prisma/build/index.js migrate status --schema prisma/schema.prisma
node node_modules/prisma/build/index.js migrate deploy --schema prisma/schema.prisma
node node_modules/prisma/build/index.js migrate status --schema prisma/schema.prisma
node node_modules/prisma/build/index.js migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --exit-code
```

Antes do deploy, status com migrations pendentes é esperado; falha/divergência de histórico não é. Depois, status deve estar atualizado e diff retornar 0 (2 = diferenças; 1 = erro). Conferir também guards SQL customizados: diff Prisma não certifica todos os triggers/checks. Não usar `db push`, `migrate reset`, `resolve` por conveniência ou executar SQL de diff automaticamente.

6. Aplicar o tratamento revisado dos IDs de teste, com transação, auditoria e comparação antes/depois. **Isso não é feito por migrate deploy.** Não redirecionar `--rehearse-opening` para produção: é um executor restrito a clones.
7. Conferir 518 produtos ativos no recorte ensaiado, dez variantes retiradas, preservação de 24 pedidos/33 itens e movimentos antigos, ajustes únicos e conservação dos pontos. Novos dados exigem novos valores esperados revisados.
8. Promover a versão compatível e validar leituras autenticadas, domínio/tenant, cookies e integrações no escopo acordado. Não inferir readiness por TCP/HTTP 200 isolado.
9. Retomar eventos/consumidores; observar backlog, revisões, e-mails, conexões, locks e entrega dos alertas. Só depois retirar contenção de novas compras.

## Abortar e recuperar

| Situação | Ação |
|---|---|
| Divergência antes de alterar | Não iniciar; preservar estado e revisar baseline. |
| Migration falhou/timeout | Manter contenção; inspecionar etapa, locks e schema reais. Algumas migrations não são integralmente transacionais: não presumir rollback total nem repetir cegamente. |
| Aplicação falhou, dados íntegros | Preferir correção para frente. Reverter artefato somente com compatibilidade comprovada do schema **e dos writers**. A main antiga não foi aprovada como writer de rollback. |
| Perda/corrupção comprovada | Restaurar em destino isolado, validar e reconciliar eventos desde o cutoff; trocar conexão pela decisão operacional registrada. Não sobrescrever o banco atual por tentativa. |
| Houve compra/efeito externo novo | Não restaurar snapshot anterior como se desfizesse cobrança. Preservar IDs e conciliar sem nova submissão financeira. |

Registrar revisão, ponto recuperado, impacto, pendências e critérios de retomada. O ensaio local não determina indisponibilidade, RPO/RTO nem compatibilidade de escrita da versão antiga.

## Correções ao procedimento herdado

Não existem os scripts npm `validate:env`, `migrate:status`, `migrate:deploy` ou `smoke:deployment` no package.json auditado. Não há endpoint geral de readiness/health comprovado no pacote atual. A startup probe proposta é TCP; `/api/cron/payments/status` é diagnóstico financeiro autenticado. `/api/test-environment` não é health check de produção. O procedimento anterior que pressupunha esses comandos/probes foi substituído por esta revisão.

Verificações locais existentes: `node --test tests/scripts/restored-clone-tools.test.mjs`, `npm run test:operations`, `node node_modules/typescript/bin/tsc --noEmit --incremental false` e executores de clone/container documentados. Repetir quando a revisão/escopo justificar; resultados locais não substituem observação no destino.
