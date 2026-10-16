# Implantação e recuperação do banco existente

Revisão em 15/10/2026. Procedimento preparado na homologação, **não executado em produção**. Main e seu banco permanecem somente leitura para o assistente. O destino definido pelo operador é o banco já conectado à main; não criar outra base de produção por padrão nem substituir sua conexão pela homologação.

## Base comprovada e responsáveis

Origem: `7f9b26e062ec2654420fecffb6dd78ad3ba1e017`. Base publicada em homologação: `b90b41dbe2f795f95fdd0f0f78ea648febaa3427`, mais manutenção completa e documentação locais ainda não publicadas. Não há SHA final de release desse conjunto local.

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

Preparado `APP_MAINTENANCE_MODE`, separado de `CHECKOUT_PAUSED`. Ausente ou `false` mantém funcionamento normal; `true` e qualquer outro valor configurado bloqueiam. O Proxy responde 503/`APP_MAINTENANCE` nas APIs e página de manutenção nos demais acessos, com `private, no-store`, antes de autenticação/renderização. Inclui GET, Server Actions, Admin, assets, cron e webhook. O cliente Prisma compartilhado da aplicação também recusa consultas ORM/raw dentro ou fora de transações. Não é um modo de leitura: consultas podem disparar gravações indiretas.

| Escritor identificado | Entrada/fonte | Contenção necessária |
|---|---|---|
| Compras e contexto de cesta | `services/checkout.service.ts`, rotas checkout/orders; GET/PATCH de contexto podem criar cesta | Pausa de checkout durante drenagem; manutenção completa no trecho exclusivo. |
| Sessões e perfil | `lib/session.ts` remove sessão expirada durante leitura; auth e `app/profile/actions.ts` | Bloquear também GET/renderização/Server Actions, antes de autenticação. |
| Carrinho, catálogo, estoque, configurações e administração | APIs cart/products/loja/admin, fidelidade e transições de pedidos | Proxy global e cliente Prisma da aplicação; não depender de esconder botões. |
| Inbox e efeitos financeiros | `/api/webhooks/asaas`, cron payments/orders-timeout/loyalty-expiration | Drenar antes; suspender consumidores e recepção coordenadamente, com reentrega comprovada. |
| Agendadores externos | `scripts/cloudrun-consumer.mjs`, `scripts/homologation/payment-scheduler.worker.mjs` | Inventariar instâncias realmente implantadas, desativar agendas e aguardar execuções; presença do arquivo não prova implantação. |
| Importadores/reparadores e acesso direto | `repair-product-variants.mjs`, `import-main-hml-catalog.mjs`, `import-jt-homologation.mjs`, `sync-main-hml-freight-settings.mjs` e outros clientes SQL/Prisma próprios | Parar processos e coordenar acesso dos operadores; não usam necessariamente o singleton protegido. |
| Versões antigas e trabalhos em voo | main antiga, URLs anteriores, conexões/transações e efeitos já enviados | Retirar alcance dos writers antigos, aguardar encerramento e conferir sessões/leases. A flag nova não retroage. |

O modo completo **não congela globalmente o PostgreSQL**, não revoga contas e não cancela SQL já enviado. Transações podem abrir antes da primeira consulta protegida. Não cobre clientes independentes nem efeitos externos já iniciados. Antes de DDL, o operador deve identificar contas/processos com acesso, comprovar encerramento das execuções e conferir sessões/transações/locks em leitura, incluindo tarefas fora do HTTP. Registrar tratamento das conexões residuais e separação entre conta de runtime e conta de migration; ausência de tráfego no alias não basta. Nenhuma revogação/terminação de sessão do banco principal foi executada nesta preparação.

Antes dessa suspensão, comprovar recepção em destino durável compatível ou a política efetiva de reentrega do provedor, janela e reconciliação posterior. Não presumir duração de retry nem responder 2xx sem persistência. Se essa continuidade não estiver comprovada, não iniciar o trecho exclusivo. Registrar último evento/posição e trabalhos abertos; não apagar filas, forçar COMPLETED ou rearmar comandos.

A documentação Asaas informa que respostas diferentes de 200 geram tentativas, com interrupção após 15 falhas consecutivas e retenção limitada a 14 dias. Portanto, retornar 503 não garante recuperação automática indefinida. Conferir a fila real, corrigir o recebimento e verificar a necessidade de reativação e conciliação, sem disparar novas operações financeiras. Fontes consultadas em 15/10/2026: [fila pausada](https://docs.asaas.com/docs/fila-pausada) e [reativação da fila](https://docs.asaas.com/docs/como-reativar-fila-interrompida). Isso é documentação do provedor, não prova de reentrega na conta do projeto.

Ordem: manter `APP_MAINTENANCE_MODE=false` enquanto `CHECKOUT_PAUSED=true` permite drenagem; parar agendas/scripts e aguardar trabalhos; somente com continuidade de eventos comprovada ativar manutenção completa em todas as revisões alcançáveis. Conferir 503 também no webhook (sem enviar evento financeiro novo), verificar ausência de escritores em voo e registrar backup/cutoff. A manutenção completa permanece **não ativada nos ambientes compartilhados** nesta rodada.

### Retomar obrigações antes de abrir vendas

Após schema e dados validados, retomar recepção e consumidores na versão compatível. Conferir conta/ambiente, progresso, leases e reentregas antes de abrir novas compras. A pendência temporal do teste de expiração do boleto foi aceita pelo operador; permanece pendente, sem ser apresentada como aprovação.

Retirar primeiro `APP_MAINTENANCE_MODE` (`false`), mantendo `CHECKOUT_PAUSED=true`. Conferir recepção/reentrega, leituras autorizadas e progresso de consumidores. Só depois definir `CHECKOUT_PAUSED=false`. Não reaplicar o manifesto inicial para alterar apenas essas flags: ele contém outros defaults financeiros.

Ensaio local reproduzível: `npm run test:maintenance:isolated`. Cria PostgreSQL descartável, aplica migrations, verifica o guard Prisma, compila uma cópia sem `.env` e reinicia o mesmo artefato otimizado com manutenção desligada/ligada/desligada. Confere 23 acessos de API, quatro acessos de página/ação, hashes de todas as tabelas públicas/sequências e retomada mantendo checkout pausado. Não usa gateway real nem comprova drenagem/reentrega remota. Incluído como etapa de CI; resultado de CI publicado ainda não existe para as alterações locais.

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

## Dependência adicional da candidata de 16/10: classificação para indicadores

A versão com `OrderReportingExclusion` exige a migration `20261016193000_order_reporting_exclusion` antes de receber tráfego. Ela cria a estrutura, sem classificar ou alterar pedidos. Portanto, **deploy da aplicação/migration não retira automaticamente os testes dos indicadores**.

O modo `--rehearse-reporting` foi ensaiado somente no clone restaurado do snapshot aprovado: 24 classificações, 24 auditorias, replay sem duplicação e histórico preservado. Ele confere o fingerprint integral dos pedidos e rejeita outro estado; não deve ser adaptado para apontar a um banco compartilhado. Antes da aplicação efetiva, reauditar IDs/estado, preservar backup e preparar transação/auditoria/comparação próprias no destino autorizado. A main e seu banco continuam somente leitura para este trabalho.

A mudança afeta relatórios/listas; não cancela cobranças nem desativa obrigações financeiras. Após classificação, renovar o cache do dashboard ou aguardar seu TTL de 60 segundos antes de comparar indicadores. O cache da candidata com a revisão de fidelidade usa `aggregated_metrics_v4`. O histórico permanece no Admin em “Histórico de testes” e “Todos”; chamadas à API sem escopo explícito continuam incluindo todos. Zero do acumulado da carteira passa a ser respeitado.

O relatório de fidelidade e o widget do dashboard compartilham a apuração comercial: concessões, reversões de ganhos, resgates brutos e devoluções de resgates. Pedidos explicitamente classificados como teste ficam fora desses totais, mantendo suas movimentações no histórico, identificadas como teste. Valores históricos usam `LoyaltyTransaction.monetaryValue`; valores ausentes não são recalculados pela cotação atual. O aviso de apuração parcial informa movimentos sem valor ou sem vínculo com pedido da loja. A ausência desse aviso não certifica conciliação integral do ledger nem pagamento de pedidos. Resgates são movimentos registrados de pontos, não receita ou estorno em dinheiro.

Carteiras continuam abrangendo todos os clientes da loja: classificação de pedidos não extingue saldo, dívida ou obrigações. O valor atual do ponto serve somente para a estimativa de resgate do saldo; carteiras legadas sem conciliação recebem aviso separado. O acumulador `lifetimeEarn` da carteira não é confundido com o bruto de concessões comerciais. A revisão de relatório não cria migration adicional nem realiza saneamento de carteiras. Conferir ambos os relatórios após publicação, no mesmo escopo e considerando o TTL do dashboard; `/api/admin/loyalty/reports` responde `private, no-store`.

A revisão financeira da seção 53 não acrescenta migration, mas depende da estrutura de classificação acima. Publicar serviços, DTO e componentes juntos. Conferir valores reconhecidos, liquidação bruta, estornos e cobertura antes/depois com a mesma loja e o mesmo recorte. Os períodos usam a primeira data de registro de cada confirmação (`FinancialFact.createdAt`, Brasília), não a data bancária presumida: o escritor existente pode reutilizar `paidAt` em `occurredAt` de devoluções. Fatos antigos permanecem imutáveis. Uma base sem provas financeiras deve aparecer como parcial, sem transformar status `PAID` em caixa. Frete/encargos são composição histórica dos contratos integralmente reconhecidos, antes dos estornos; taxas do provedor e lucro não são apurados. Esta alteração não autoriza troca de webhook, acionador ou ambiente financeiro.

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

## Ensaio de reentrega Sandbox — preparação iniciada em 15/10/2026

Deployment Vercel e CI `38808225101` da candidata `17366e8b5c2a44bd2c0157a159a371886b3126d1` concluídos com sucesso. A ativação de manutenção remota não foi realizada. Na preparação, apenas leitura do banco de homologação, em transação `REPEATABLE READ / READ ONLY`; main permaneceu intacta.

### Candidato e escopo da prova

Pedido **#6**, boleto R$ 49,90, pago (`PAID`, versão 1), 24 pontos creditados, tentativa `APPROVED`, sem operação de cancelamento/estorno. Evento persistido e concluído:

```text
orderId:   0f0a05ff-2a24-4e6f-93ef-be13451388c9
paymentId: pay_blfexx8zkousw431
eventId:   evt_d26e303b238e509335ac9ba210e51b0f&22120169
tipo:      PAYMENT_RECEIVED
recebido:  14/10/2026 17:35:44 BRT
concluído: 14/10/2026 17:38:50 BRT
```

Preservar o ID completo, inclusive `&22120169`; não fabricar outro ID nem editar o conteúdo. O pedido #7 foi descartado como candidato porque não há evento correspondente na inbox, embora seu cancelamento esteja concluído. O #8 permanece reservado para expiração.

Um replay deste evento poderá comprovar reconhecimento de uma entrega já processada, sem efeitos repetidos. **Não comprova o processamento inicial de um evento novo retido durante indisponibilidade.** Enviar JSON por PowerShell/curl também não comprova transporte, retenção ou tentativa automática do Asaas. Registrar separadamente reenvio manual e retry automático, sem promover um ao outro.

### Coleta e comparação somente leitura

Ferramenta: `scripts/homologation/webhook-recovery-baseline.mjs`. Carrega a configuração local pela precedência do Next e rejeita host/identidade fora da homologação fixa. Não aceita destino arbitrário, não executa DML, não envia evento, não chama gateway e não processa fila. O carregamento do Prisma ocorre depois da configuração para impedir que seu carregador de `.env` prevaleça sobre `.env.local`.

```powershell
node scripts/homologation/webhook-recovery-baseline.mjs
node scripts/homologation/webhook-recovery-baseline.mjs --compare=artifacts/webhook-recovery/baseline-order-6.json
```

Baseline inicial salvo localmente em `artifacts/webhook-recovery/baseline-order-6.json`, contendo somente identidades técnicas, contagens e hashes. Comparação de controle sem reenvio: `unchanged=true`, `providerRedeliveryVerified=false`. Antes do ensaio efetivo, capturar novamente e preservar um arquivo distinto; não sobrescrever evidência de uma etapa anterior.

Conferidos 17 recortes: estado comercial do pedido, item, histórico, reserva, estoque agregado/variante, carteira/transação/lote/alocação de pontos, fatos financeiros, estado da tentativa/cobrança/operações, outbox, inbox correlacionada e registro do #8. Campos de polling da tentativa não integram os hashes; não é prova de congelamento global. Mudança concorrente em estoque/carteira exige investigar, não corrigir valores para obter igualdade. Hash de outbox igual não substitui confirmação de entrega no serviço de e-mail.

### Próxima ação assistida na interface Asaas

1. Abrir **Sandbox → Integrações → Webhooks/Logs de Webhooks**. Confirmar configuração que aponta ao Preview de homologação e estado da fila; não compartilhar token, payload bruto ou URL com query de bypass.
2. Localizar o evento acima pelo pagamento/data. Conferir ID integral, tipo, última resposta HTTP e existência de ação de reenvio. Somente inspecionar nesta etapa. O log do provedor deve confirmar a origem do evento registrado na aplicação.
3. Informar se a fila está ativa/interrompida e se existe reenvio individual. Esses dados foram solicitados ao operador e ainda não foram recebidos. A documentação consultada não comprova disponibilidade de um botão de reenvio para este evento; não inventar endpoint de replay nem usar `removeBackoff` como reenvio individual.
4. Se não houver reenvio do evento já entregue, definir outro ensaio com um evento Sandbox próprio antes de interromper o recebimento. Não rearmar inbox `COMPLETED`, não repetir operações encerradas e não interferir no #8.

Somente após confirmar mecanismo e recuperação, fechar a sequência concreta: baseline fresco, agendas/execuções e obrigações conhecidas, entrega identificada rejeitada com 503 pela **aplicação** (401/403/redirect da Vercel não servem), retomada de recebimento e comprovação no log do Asaas do mesmo ID com 200. Para o candidato já concluído, a aplicação deve responder `PROCESSED` e não reencaminhar trabalho. Não executar `process-payments-once.ps1` apenas para esse replay: seu limite é global e pode alcançar obrigações alheias ao ensaio.

Depois comparar os recortes e registrar evento, horários, respostas e número de tentativas. Se a identidade/conteúdo divergir, consultar o estado sem repetir automaticamente. Não apagar a fila para encerrar o ensaio.

Fontes oficiais consultadas: [Logs de Webhooks](https://docs.asaas.com/docs/logs-de-webhooks), disponíveis na interface web, e [idempotência](https://docs.asaas.com/docs/how-to-implement-idempotence-in-webhooks), que distingue identidade do evento e execução única. A fila real e a recuperação operacional ainda não foram comprovadas neste projeto.
