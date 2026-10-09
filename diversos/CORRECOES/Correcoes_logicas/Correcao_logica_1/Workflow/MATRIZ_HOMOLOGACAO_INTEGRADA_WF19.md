# Matriz de homologação integrada — WF-19

## 1. Estado e candidato ensaiado

**Data local:** 06/10/2026. **Estado WF-19:** EM EXECUÇÃO — regressão técnica local aprovada; homologação integral e liberação pendentes. A tabela da seção1 preserva a rodada base; **a evidência complementar mais recente está na seção12**, com preparação de Sandbox no Preview Vercel; a seção11 preserva o piloto de capacidade/prontidão e as seções9/10 os checkpoints Windows/Linux. Este documento complementa o [workflow](WORKFLOW_IMPLEMENTACAO_CORRECOES_LOGICAS.md), o [registro, seção24](REGISTRO_EXECUCAO_CORRECOES_LOGICAS.md#24-wf-19--regressão-integrada-em-runtime-de-produção) e a [matriz de legados](MATRIZ_COMPATIBILIDADE_E_RECONCILIACAO_LEGADOS.md).

A revisão de partida continua HEAD 1d513c217bbeb265234e939d9000a51201bfaaa7, com alterações locais acumuladas. Não há commit ou release aprovado. O harness identifica os inputs por SHA-256; estes identificam a execução local, não substituem revisão/assinatura de um candidato imutável.

| Identificação da rodada base (registro, seção24) | Valor |
|---|---|
| Início / fim UTC | 2026-10-06T02:08:24.468Z / 2026-10-06T02:10:51.534Z (05/10 em São Paulo) |
| Node / Next / Prisma / PostgreSQL | 22.15.0 / 16.3.5 / 5.22.0 / 16 descartável |
| runId | 59012221f1c6d1775b2e9a8eb0a26463 |
| Build ID comum | D6DJw9_xjRuHv07DOdtfy |
| SHA-256 dos fontes copiados antes do build | 8e6cfb4238ff82744f66e9c87093a6aa07c23d0506985f8e9fb99041f0ee8406 |
| SHA-256 de tests | a5da38ba7eb5711de096da7b72d451aefbb82ad08323ef984e753db58cc28b02 |
| SHA-256 de scripts | 85a8717bccd5f83a129398835165095a8840ecda60271ab198e75172b9be8636 |
| Runtime / instâncias | next start, NODE_ENV=production, dois processos com diretórios/caches próprios |
| Banco e integrações | Banco aleatório, papel restrito, sentinela; sem credenciais de gateway/email/transportadora reais |

O teste continua habilitando as proteções TEST_RUN_ID/sentinela na aplicação. Os serviços importados diretamente pelo Vitest executam sob NODE_ENV=test; o servidor HTTP e as páginas servidas ao navegador executam o build de produção. Aprovação de uma suite não significa que todos os seus casos sejam requisições ao runtime compilado.

## 2. Execução reproduzível

Com Docker, dependências locais e Chrome/Chromium disponível (ou BROWSER_BIN absoluto), executar:

```text
npm run test:production:isolated
```

scripts/run-production-tests.mjs aplica as33 migrations em banco próprio, marca a sentinela, copia fontes sem .env, compila uma vez e replica o build em outro diretório temporário. Valida BUILD_ID e handshake de cada processo antes dos testes. O parâmetro Host escolhe tenant; a conexão continua restrita à origem local validada. Paths externos, redirects, servidor sem sentinela e configuração livre de execução são recusados.

O comando padrão seleciona as22 suites auditadas de scripts/lib/homologation-suites.mjs mais tests/production. Seleção dirigida, por exemplo npm run test:production:isolated -- tests/production, é um diagnóstico parcial e não substitui a rodada conjunta. Suites antigas fora da lista não foram declaradas homologadas. O script também não executa tests/load.

Controlador de reinício fica somente no harness, em loopback e autenticado pelo token efêmero, com única operação de reiniciar o processo secundário lançado pelo próprio executor. Não existe rota de controle no aplicativo/build. Teardown encerra somente os processos iniciados e descarta container/diretórios cuja propriedade é conferida.

Cada banco recebe FREIGHT_QUOTE_SECRET aleatória compartilhada entre fixtures e servidores. Não se usa a chave real nem o fallback de desenvolvimento para autorizar uma cotação sob produção. Worker é habilitado exclusivamente nos processos descartáveis para ensaiar seus endpoints; isso não ativa scheduler/worker no ambiente da aplicação.

## 3. Resultados desta rodada

| Verificação | Evidência obtida | Limite |
|---|---|---|
| Unitários | **618 passaram,75 arquivos** | Mocks não substituem os ensaios de PostgreSQL/HTTP. |
| Regressão conjunta | **287 passaram,23 arquivos;89,95s de Vitest** |280 integrações existentes +sete cenários novos entre processos; não são287 E2E nem sandbox. |
| Navegador real | **11 cenários** dentro dos280: quatro checkout, quatro fulfillment, três indicadores | Chrome/CDP, páginas compiladas; portas externas controladas/interceptadas quando indicado pela fixture. |
| Duas instâncias | Sete cenários passaram: isolamento, recibo único, disputa de revisão, checkout/restart, última unidade, configuração Admin atual, revogação de cotação/consentimento | Não certifica todo cache, autoscaling, CDN/load balancer ou Server Actions entre releases diferentes. |
| Isolamento negativo | Sentinelas missing/mismatched bloqueiam seed/create/cleanup, com zero lojas observado | Execução separada; não somar estes dois casos aos287. |
| TypeScript | tsc --noEmit --incremental false passou | Sem escrita de tsbuildinfo; build também verificou a cópia. |
| ESLint direcionado | Zero erros/avisos nos arquivos desta etapa | Não houve autofix amplo. |
| ESLint geral | Zero erros,18 avisos |15 no-img-element; um de declaração/callback no Admin; um de dependência de effect no simulador de frete; uma diretiva de disable sem uso. Não tratados como bugs confirmados somente pelo lint. |
| Build |55 páginas geradas, compilação/tipagem aprovadas | Sem alteração da .next/next-env.d.ts do workspace. |
| CI | Novo gate de build + regressão sob duas instâncias; conserva os gates anteriores | Configuração local alterada; pipeline remoto não foi executado nesta sessão. |

A recuperação após restart foi ensaiada **depois de uma compra já commitada**, com replay/consulta persistidos e sem duplicar pedido, tentativa, outbox ou reserva. Não equivale a matar o processo em cada instrução entre chamada remota e commit. Esses pontos continuam abertos em E07.

## 4. Evidências E01–E14 e gates restantes

| Evidência | Resultado técnico disponível | Pendência para homologação integral |
|---|---|---|
| E01 — isolamento | HTTP/cliente/sentinela em ambas as instâncias e ensaios negativos passaram | Repetir no CI/candidato final. |
| E02 — schema/recuperação |33 migrations aplicadas nesta rodada; WF-18 tem vazio/clone/replay/restore e backfill interrompido | Snapshot atualizado, conciliação/aceite e tempos em volume representativo. |
| E03 — inventário | Última unidade entre processos e testes de retirada/Admin passaram | UI/operador, inventário real e carga/locks. |
| E04 — intenção/carrinho | Recibo/revisão/conclusão/replay e reload no navegador passaram | Matriz ampliada de abas/dispositivos e candidato imutável. |
| E05 — identidade | Ownership/tenant/convidado/canários passaram | Domínios/proxies/cookies reais e revisão de acessos. |
| E06 — valores/métodos | Plano e adapter determinístico, cancelamento/estorno e contrato completo ensaiados | Sandbox da conta/método: PIX, boleto, cartão1x/parcelado e estorno; documentação oficial atual. |
| E07 — falhas remotas | UNKNOWN/lookup/lease/rollback e restart pós-commit ensaiados | Morte real antes/depois de I/O e persistência, outro executor e provedor sandbox. |
| E08 — eventos/jobs | Duplicatas/fora de ordem/lease/consumidores concorrentes ensaiados em PostgreSQL | Scheduler, crash/restart de consumidor real, heartbeat e alertas. |
| E09 — carteira | FEFO/expiração/resgate/déficit/retry passaram | Conciliação das carteiras legadas e política comercial aprovada. |
| E10 — frete/cache | Determinantes/assinatura/revisão e revogação entre processos passaram | Transportadoras/configuração/chaves reais e deployment distribuído. |
| E11 — experiência |11 cenários de navegador passaram sob o build; CEP fora de ordem e erro/storage controlados | Métodos reais, mobile, outros navegadores, identidade/abas e telas alternativas. |
| E12 — autenticação/Admin | Reset/reemissão/revogação/último Admin e HTTP passaram | Email real isolado, cookies finais, recuperação administrativa/IAM/MFA. |
| E13 — operação comercial | Modalidade/rastreio/histórico/métricas e fatos sintéticos de estorno parcial passaram | Producer parcial, devolução física, aceite financeiro/operacional e histórico conciliado. |
| E14 — produção técnica | Regressão/build/tipagem/lint/duas instâncias/restart pós-commit passaram; standalone Windows/Linux (seções9/10); piloto com30/80 usuários HTTP e navegador passou nas invariantes, mas home fora da meta de prontidão (seção11) | Página completa e carga no candidato Vercel/Neon, condições frias/quentes, pool/locks, plano comercial/scheduler e recuperação com RPO/RTO aprovado. |

Nenhuma linha é aprovação do gate completo. A matriz de propostas permanece a fonte dos demais cenários obrigatórios por achado.

## 5. Rastreabilidade dos38 achados

Os nomes abaixo, salvo indicação de script ou multi-instance, são suites em tests/integration/<nome>.test.ts. multi-instance significa tests/production/multi-instance.test.ts. Scripts mencionados estão em scripts/. Evidências de scripts de migrations/clone pertencem ao checkpoint WF-18; sua repetição neste checkpoint não foi inventada.

**Estado final de homologação de cada linha: PENDENTE.** LA-002/033 continuam com implementação parcial; os outros36 têm módulo/integração local ensaiados. Os testes disponíveis indicam cobertura técnica, não dispensam o critério individual da proposta ou o aceite do candidato.

| LA | Invariante / proposta | Cenário técnico rastreado | Suites / evidência disponível | Gate restante específico |
|---|---|---|---|---|
| LA-001 | Variante persistida e reserva correta | Identidade chega até o pedido; combinação ambígua/esgotada é recusada. | checkout-intent-authority, inventory-admin-integrity, checkout-browser-state | UI Admin/estoque no candidato e catálogo operacional. |
| LA-002 | Transições e efeitos únicos | Versão/recibo serializam cancelamento/expedição; legado sem prova recusa efeitos. | order-transition-atomicity, order-fulfillment-atomicity, legacy-commerce-compatibility | PARCIAL: conciliação legada, devolução física/parcial e aceite de operação. |
| LA-003 | Inbox/outbox duráveis | Duplicata, lease vencido, rollback e retry conservam trabalho e efeitos únicos. | payment-durable-execution | Sandbox e morte real do executor entre I/O/commit; scheduler/monitoramento. |
| LA-004 | Intenção durável | Propostas/conclusões repetidas convergem, inclusive em dois processos. | checkout-intent-authority, checkout-browser-state + multi-instance | Candidato congelado, múltiplas abas/matriz ampliada e contrato financeiro real. |
| LA-005 | Pedido/reserva/financeiro separados | Resposta perdida/UNKNOWN conserva reserva; cancelamento/estorno espera fatos. | payment-durable-execution | Conciliação de conta/gateway, obrigações históricas e recuperação operacional. |
| LA-006 | Isolamento de testes | Cliente/HTTP verificam sentinela; URL externa e cleanup indevido são recusados. | test-environment-isolation + verify-test-isolation.mjs | Repetir gates no ambiente CI/candidato final; não usar scripts avulsos sem identidade. |
| LA-007 | Contrato de frete da UI | Resposta real traduzida; falha não produz opção de entrega grátis. | checkout-browser-state, freight-authority | Transportadoras homologadas e matriz ampliada de navegador/endereço. |
| LA-008 | Cotação autoritativa | Assinatura/owner/tenant/revisão/preço/destino são conferidos antes da compra. | freight-authority + multi-instance | Frete externo, segredo compartilhado no deployment e revisão de catálogo/dados. |
| LA-009 | Parcelamento servidor | Centavos, contrato completo e parcelas reconciliados; parcela forjada recusada. | payment-plan-authority, payment-durable-execution | Cartão 1x/parcelado por método/conta e garantia atual do provedor. |
| LA-010 | Expiração por estado/método | Boleto válido/cartão em análise não seguem prazo PIX; corrida de pagamento é relida. | payment-durable-execution | Prazo/configuração bancária real, cron e política operacional aprovada. |
| LA-011 | Idempotência por identidade | Replay de outra identidade/tenant/conteúdo é recusado; intenção define compra. | checkout-intent-authority, purchase-tenant-scope | Domínio/proxy/cookies finais e métodos reais na revisão homologada. |
| LA-012 | Replay do estado real | Recuperação não fabrica sucesso; retorno depois de restart aponta mesmo pedido. | checkout-intent-authority, checkout-browser-state + multi-instance | Estados remotos reais e perda de processo nos pontos de falha externos. |
| LA-013 | Comando único de compra | Rotas alternativas obedecem intenção/consentimento e preços atuais. | checkout-intent-authority, freight-authority, purchase-tenant-scope | Inventário final de writers/consumidores no candidato. |
| LA-014 | Tenant e ownership | Produtos/variantes/endereços/pedidos alheios recusados por serviço/HTTP/FKs. | purchase-tenant-scope, guest-buyer-identity, commerce-model | Domínios customizados/proxy, dados atuais e revisão de acessos. |
| LA-015 | Consumo único do carrinho | Uma conclusão por intenção/carrinho, estoque/recibo uma vez entre instâncias. | checkout-intent-authority + multi-instance | Múltiplas abas/dispositivos do candidato e protocolo financeiro real. |
| LA-016 | Ciclo do carrinho na UI | Reload lê estado persistido e compra concluída não repõe itens locais. | checkout-browser-state, checkout-client-boundaries | Troca de identidade/dispositivo e navegadores adicionais. |
| LA-017 | Mutações concorrentes | Mesmo comando incrementa uma vez; edições da mesma revisão têm um vencedor. | cart-mutation-atomicity + multi-instance | Volume/pool/locks definidos, cenários de cliente no candidato. |
| LA-018 | Retirada de variante | Restituição preserva indisponibilidade e vínculos da variante retirada. | inventory-admin-integrity | Homologação do Admin em navegador e conciliação de vínculos/estoque legado. |
| LA-019 | Catálogo separado do estoque | Salvar catálogo antigo não sobrescreve reserva; ajuste usa revisão/recibo. | inventory-admin-integrity | Operação real de ajuste, responsabilidades e UI do candidato. |
| LA-020 | Convidado separado de conta | Email declarado não autoriza atualização/acesso ao usuário; comprador é snapshot. | guest-buyer-identity, checkout-intent-authority | Revisão histórica de cadastros, cookies/domínio final e email externo. |
| LA-021 | Origem/prazo de pontos | Lotes/FEFO/déficit preservam ajustes válidos; legado não ganha origem fictícia. | loyalty-lot-accounting | Conciliação/aceite das duas carteiras e configuração comercial. |
| LA-022 | Expiração por lote | Dois jobs aplicam uma expiração; rollback conserva lote/carteira/ledger. | loyalty-lot-accounting | Scheduler/leases/alertas em implantação e volume de carteiras. |
| LA-023 | Ganho congelado | Snapshot fixa a política; mudança de configuração não reaplica ganho. | payment-plan-authority, loyalty-lot-accounting | Aceite de arredondamento/base/taxas/pontos e conciliação financeira. |
| LA-024 | Cobrança e entrega separadas | Endereço de cobrança exigido por método; PICKUP/NONE não inventam entrega. | checkout-client-boundaries, payment-plan-authority | Boleto/cartão reais em cada modalidade e UI ampliada. |
| LA-025 | Confirmação completa | Cancelado/expirado/processando/reembolso não oferecem pagamento indevido. | checkout-client-boundaries, checkout-browser-state | Matriz visual de todos os métodos/estados reais, mobile e domínio final. |
| LA-026 | Rastreio persistido | Status/rastreio/histórico/auditoria/evento são atômicos; edição tem revisão. | order-fulfillment-atomicity, order-fulfillment-browser | Transportadoras e operação comercial no candidato. |
| LA-027 | Histórico no commit | Falha de auditoria reverte status/versão; autoria USER/SYSTEM sem FK fictícia. | order-transition-atomicity, order-fulfillment-atomicity | Histórico legado/aceite, executor externo e reconciliação. |
| LA-028 | Token atômico | Consumo/reemissão/expiração e revogação de sessões têm efeito transacional. | auth-eligibility-atomicity | Email/domínio/cookies, recuperação administrativa e política de acesso. |
| LA-029 | Último Admin | Rebaixamento/bloqueio cruzados preservam Admin ativo; auditoria pode abortar commit. | auth-eligibility-atomicity | Procedimento de recuperação/IAM/MFA e revisão humana dos privilégios. |
| LA-030 | Migrations reproduzíveis | 33 migrations, vazio/clone/replay/restore/backfill interrompido foram ensaiados em WF-18. | verify-runtime-migrations.mjs, verify-restored-clone.mjs | Repetir clone atualizado; volume/janela/locks e candidato final. |
| LA-031 | Cache representa determinantes | Preço/revisão invalidam cotação; segunda instância recusa modalidade revogada. | freight-authority + multi-instance | Frete externo e cache/deployment final; não certifica todo cache da aplicação. |
| LA-032 | Carteira da sessão/leitura | Simulação anônima/alheia é recusada e consulta não cria ledger/carteira. | loyalty-simulation-identity, purchase-tenant-scope | Cookies/identidade real e gates de dados/fidelidade. |
| LA-033 | Atores e registro financeiro | Fatos/review/auditoria têm proveniência; pagamento tardio não reabre estoque. | payment-durable-execution, legacy-commerce-compatibility | PARCIAL: conta/eventos legados, devoluções físicas/parciais e integração final. |
| LA-034 | Revisão de respostas assíncronas | CEP fora de ordem, storage indisponível e erro de carrinho não sobrescrevem revisão. | checkout-browser-state, checkout-client-boundaries | Matriz ampliada de UI/abas e leitores alternativos do catálogo/Admin. |
| LA-035 | Capacidade real dos métodos | Método sem configuração é recusado antes de reserva; sem sucesso simulado. | payment-plan-authority, checkout-intent-authority | Homologação de conta/contrato/capacidade e configuração final dos métodos. |
| LA-036 | LTV por fatos | Lista/perfil usam reconhecimento único e estornos confirmados; legado é PARTIAL. | customer-financial-metrics, customer-financial-metrics-browser | Aceite financeiro, legado, volume/EXPLAIN e fatos bancários reais. |
| LA-037 | Modalidade nas transições | Retirada PAID→DELIVERED e entrega com expedição/histórico seguem regras únicas. | order-fulfillment-atomicity, order-fulfillment-browser | Aceite de operação e modalidades/transportadoras do candidato. |
| LA-038 | DTO sem segredos | Canários privados não saem em público/Admin; leitura administrativa entre instâncias é atual. | loja-credentials + multi-instance | Avaliação/rotação de exposição histórica e integração de transportadora final. |

## 6. Falha adicional comprovada e corrigida no ensaio

**WF19-R01 — leitura administrativa stale entre processos.** Primeira rodada real passou cinco dos sete cenários. ProcessoB leu enablePickup=true e aqueceu settings/admin-config-v2. ProcessoA confirmou PUT enablePickup=false no PostgreSQL e invalidou somente seu cache. Novo GET porB respondeu true por até cinco minutos, embora o banco já contivesse false.

getLojaSettings agora consulta o PostgreSQL a cada requisição e aplica o mesmo DTO seguro, com apenas indicadores de credenciais. Evitou-se depender da configurationVersion para todos os campos do Admin: as revisões existentes atendem aos determinantes de frete/pagamento, não certificam alterações de cada campo de nome/tema/credenciais. Não há novo cache distribuído, migration ou campo de schema. Leituras iniciadas depois do commit refletem a configuração vigente; uma leitura já em andamento ainda pode observar seu snapshot anterior.

Teste unitário verifica duas leituras com valores persistidos diferentes e ausência de canários; teste real aqueceB, escreveA e exige o valor novo emB. A rodada conjunta passou. Este é um endurecimento encontrado durante a homologação, não um39º achado artificialmente atribuído à auditoria original.

A outra falha inicial foi FREIGHT_QUOTE_SECRET_MISSING no servidor production sem chave de teste: a aplicação recusou corretamente assinar. O provisionador passou a gerar chave aleatória por execução. Também houve EPERM ao tentar copiar a junction de dependências do pacote standalone no Windows; a cópia do build para next start exclui standalone e cache, sem alterar dependências ou a configuração do aplicativo.

## 7. Limites e dados que faltam

- WF-18 continua aberto:24 pedidos,33 itens sem variante, duas referências remotas e duas carteiras no snapshot de04/10 exigem provas/decisões próprias. Contagens podem se sobrepor. Não foi consultada novamente a origem.
- Métodos/gateway/frete/email não foram homologados em contas externas; não houve cobrança, estorno, envio, transportadora ou cron real.
- Ainda não foram fornecidos volume de pedidos/usuários, pico concorrente, latência aceitável, infraestrutura, pool e orçamento de locks. A pergunta sobre capacidade foi apresentada durante a execução. Não foi executada carga com RPS arbitrário nem usada a suite antiga de customer-load como certificado: ela usa asserts/fixtures históricos e profiler do processo de teste para endpoint HTTP de outro processo.
- next.config.js usa output=standalone. A rodada base usou next start com dependências compartilhadas. A seção9 acrescenta prova do pacote standalone/server.js independente, Prisma e assets em Windows. CDN, imagem/container final, engine/OS de destino e fresh install Linux continuam sem certificação. A implantação precisa escolher e ensaiar o entrypoint correspondente.
- Os hashes identificam fontes/scripts/testes, sem registrar .env ou credenciais. Não houve release/commit; testes posteriores exigem novos hashes/evidências se o candidato mudar.
- Browser é Chrome/CDP e banco funcional é PostgreSQL16. Restore real de PostgreSQL18 permanece evidência de WF-18; distribuição, reverse proxy/TLS, navegadores adicionais e infraestrutura final ainda precisam de ensaio.
- Eventos de morte entre I/O/commit, produtores de estorno parcial/chargeback, devoluções físicas, recuperação administrativa e obrigações legadas não foram encerrados pelo restart pós-commit.
- Zero erros de lint não resolve automaticamente os18 avisos nem substitui revisão humana; testes legados fora da seleção também não foram aprovados.

## 8. Próxima execução e condição de liberação

1. Fechar as exceções/aceite de WF-18 com snapshot atual e provas externas/físicas/financeiras pertinentes.
2. Identificar ambiente de homologação e conta/contrato por método; usar credenciais próprias do ambiente, sem compartilhar segredos no relatório. Ensaiar integrações e falhas reais em sandbox conforme E06–E08.
3. Definir e registrar volume/pico/latência/pool/locks e infraestrutura; ensaiar capacidade, pacote no OS/infra final e recuperação, sem aprovar metas inventadas. Resolver as pré-condições de configuração diagnosticadas na seção9 antes da homologação correspondente.
4. Congelar candidato, completar os critérios de cada proposta/matriz visual e registrar revisor/aceite por LA. Só então promover estados para VALIDADO.
5. Prosseguir à WF-20: scheduler/heartbeat/alertas/responsáveis, política/RPO/RTO/janela, rollout/rollback e observação dos ciclos. Ativar métodos/worker/expiração somente conforme plano operacional aprovado.

**WF-19 permanece EM EXECUÇÃO; WF-20 NÃO INICIADO.** Nenhum achado está ENCERRADO EM PRODUÇÃO. O projeto **ainda não está pronto para produção**.

## 9. Evidência complementar — standalone independente e configuração

**Data local:** 05/10/2026. Complementa o [registro, seção25](REGISTRO_EXECUCAO_CORRECOES_LOGICAS.md#25-wf-19--pacote-standalone-independente-e-preflight-de-configuração). WF-19 permanece **EM EXECUÇÃO**, sem aprovação final de nenhum LA.

### 9.1. Reprodução e isolamento

```text
npm run test:production:isolated
npm run test:standalone:isolated
node scripts/check-production-environment.mjs
```

O modo standalone materializa dependências somente no diretório temporário usado para compilar. Estagia dois pacotes com hash idêntico, incluindo public e .next/static, recusa .env/links externos e remove toda a cópia usada no build antes de iniciar qualquer node server.js. Cada pacote tem seus próprios diretórios, PORT/HOSTNAME explícitos e NODE_PATH vazio. Banco/sentinela/segredos e reinício continuam pertencendo ao harness. O workspace não foi instalado ou regenerado. Runtime Windows/x64 não certifica o OS/infra final.

### 9.2. Resultados completos

| Verificação | Evidência | Limite |
|---|---|---|
| Unitários finais | **627 passaram,77 arquivos**,6,92s | Incluem quatro casos de pacote e cinco de preflight; configuração sintática não certifica conta externa. |
| next start | **289 passaram,24 arquivos**,99,10s | Duas instâncias; integrações controladas. |
| standalone/server.js | **289 passaram,24 arquivos**,79,60s | Duas cópias relocadas após apagar fontes/dependências do build. |
| Cenários |280 integrações (incluindo11 de navegador), sete entre processos e dois de assets | Mesmos289 repetidos por modo; não578 testes distintos/E2E/sandbox. |
| Assets | SVG de public e JavaScript referenciado pela página de login, em ambos os processos | CDN/TLS/proxy finais não ensaiados. |
| Pacote |2454 arquivos,74.779.703 bytes, dois hashes iguais antes de iniciar | Inventário/identidade do pacote não equivalem à prontidão operacional. |
| Build/schema |55 páginas e33 migrations em cada banco próprio | Nenhuma nova migration; restore real não foi repetido nesta etapa. |
| Tipagem/lint | tsc sem incremental e ESLint direcionado passaram, zero erros/avisos nos arquivos da etapa | Lint geral da rodada base continua com18 avisos; não foi reexecutado nesta etapa. |
| CI/teardown | Gate standalone adicionado; containers finais não permaneceram executando | Pipeline remoto não executado. |

As rodadas de runtime antecederam o preflight somente leitura e seus cinco testes unitários. Esses acréscimos não alteraram a aplicação em runtime; scripts/tests finais têm conteúdo posterior aos hashes da rodada. Unitários, tipagem e lint direcionado foram executados após a inclusão.

| Campo | next start | standalone/server.js |
|---|---|---|
| runId |f2b53823dae68622c51c589f20166d61 |6e08bfefecd424146edc6848fcbb5013 |
| Início UTC |2026-10-06T02:29:19.499Z |2026-10-06T02:29:19.497Z |
| Fim UTC |2026-10-06T02:31:55.596Z |2026-10-06T02:34:16.631Z |
| Build ID |i4bNqBuKunnPFKzL4epfm |kgRUXOjoFIsLWMn61xUA2 |

Node22.15.0, Next16.3.5, Prisma5.22.0, PostgreSQL16. SHA-256 dos fontes: **1d63f595bb152ba99f9f16d14d2f667a786bcc9d3b81a6354a6405b12840bdad**. tests na rodada: **5f2d5a19814519d4530fbff8f5480394276fb1ea8aa5b91dfcf521c445926371**. scripts na rodada: **e7ffe1afeb6af37eb352bafdf44640fe7e3aee0be089600c5c2d9dcb9f2d3b51**. Pacote standalone: **436f7468e76b199b06e744c88e0069300fa0fffbba0bbe5079bb9cc24c9bcfb8**. Sem commit/release ou assinatura de candidato aprovado.

### 9.3. Pré-condições de configuração ainda abertas

O preflight usa @next/env instalado, com precedência/expansão reais de NODE_ENV=production. Não imprime segredos nem faz chamadas externas ou mutações; terminou com código1:

- **ERROR FREIGHT_QUOTE_SECRET_MISSING:** configuração efetiva sem chave de assinatura de pelo menos32 caracteres.
- **WARNING ASAAS_KEY_REMOVED_BY_ENV_EXPANSION:** a declaração privada não vazia contém dólar não escapado; o loader do Next produz valor efetivo vazio. Torna-se erro se remoto estiver habilitado.
- Destino do gateway classificado como PRODUCTION; flags remoto/worker/expiração permanecem false e allowlist remota ausente.

.env.example foi ajustado para explicar/escapar o dólar literal. **.env/.env.local reais não foram alterados.** Não se verificou validade/propriedade da conta. O adapter atual exige endpoint/chave de produção sob NODE_ENV=production e sandbox fora desse modo; o contrato de homologação precisa ser definido sem usar conta de produção para testes. Essa política não foi alterada.

### 9.4. Estado de liberação

Fechar WF-18 com provas/aceite e snapshot atual; definir homologação/conta/métodos externos, contrato de ambiente e credenciais isoladas; corrigir pré-condições reais de configuração; definir capacidade e ensaiar OS/infra final e falhas entre I/O/commit; concluir aceite individual e matriz visual. WF-20 continua dependente de responsáveis, scheduler/heartbeat/alertas, RPO/RTO, rollout/rollback e observação.

**36 LA com módulo/integração local; LA-002/033 parciais; nenhum VALIDADO ou ENCERRADO EM PRODUÇÃO. WF-19 EM EXECUÇÃO; WF-20 NÃO INICIADO. O projeto ainda não está pronto para produção.**

## 10. Complemento de06/10 — configuração local e compatibilidade Linux

A seção9 descreve o diagnóstico anterior. **As duas falhas locais de configuração foram corrigidas em .env**, com backup privado fora do Git e verificação pelo loader real do Next: credencial Asaas original preservada com dólar escapado; segredo de frete de32 bytes aleatórios criado. .env.local e variáveis restantes preservados. Preflight código0, issues=[], configurationPassed=true e productionReady=false. Flags remoto/worker/expiração continuam false; destino PRODUCTION não foi usado para testes financeiros. Configuração do deployment final ainda requer provisionamento/validação próprios.

**npm run test:standalone:linux** realizou instalação npm ci e geração Prisma em Node22.15.0/Debian Bookworm/OpenSSL3, aplicou33 migrations em PostgreSQL16 descartável, compilou Next16.3.5 e inspecionou o pacote. Dois runtimes receberam o mesmo pacote; o builder e fontes foram removidos antes do startup. Sentinela via Prisma real, handshake protegido, login, JavaScript e SVG passaram em ambos; segunda instância passou novamente após restart.

| Identificação | Valor |
|---|---|
| runId |95d21e8ebb019a4316bf43b172659d38 |
| Início / fim UTC |2026-10-06T03:03:03.287Z / 2026-10-06T03:06:40.785Z |
| Linux / Node / Next / Prisma |x64, Debian Bookworm/OpenSSL3 /22.15.0 /16.3.5 /5.22.0 |
| Build ID |cCxDrh_to8XEbiTT2WEnm |
| SHA-256 dos fontes copiados |39aa6545691394ab40589a7fd14a19963a12ae3cf232385751813051d27f6c1f |
| Pacote, SHA-256 |0b7eff717b2652b1683d101665b0c4dac4570e61b3075c57b03ecc74fddbf57d |
| Pacote, arquivos / bytes |2457 /90.386.046 |
| Unitários repetidos |627 passaram,77 arquivos,16,85s |
| Typecheck / lint direcionado / sintaxe |Passaram |
| Descarte Docker por label |Sem containers/imagens próprios remanescentes |

O Linux foi ensaio dirigido de compatibilidade, **não execução dos289 testes de regressão completa**. As duas rodadas de289 na seção9 continuam checkpoints Windows próprios. Não certifica usuário/permissões, carga, TLS/proxy/CDN, imagem final, gateway/frete/email, scheduler/heartbeat, crash entre I/O/commit ou políticas comerciais.

Procedimentos operacionais foram preparados na seção19 dos contratos comuns. .env local corrigido e pacote Linux aprovado não fecham WF-18/19/20: faltam snapshot/provas/aceite de legados; ambiente/conta sandbox e contrato compatível; hospedagem e metas de carga; candidato/infra final, testes externos e aceites; scheduler/alertas/RPO/RTO/janela e rollout observado.

**WF-19 EM EXECUÇÃO; WF-20 NÃO INICIADO; LA-002/033 parciais; nenhum LA VALIDADO ou ENCERRADO EM PRODUÇÃO.**

## 11. Piloto de capacidade e prontidão de página — 06/10/2026

O usuário informou100–300 visitantes/dia,30–80 usuários simultâneos,2–5 checkouts/minuto e esclareceu que menos de1s/1,5s refere-se ao **carregamento completo das páginas**. Vercel Hobby/Fluid Compute/iad1 e Neon Free/0,25 CU/São Paulo/scale to zero/main única foram informados, mas não inspecionados. A existência de sandbox e chaves na Vercel não comprova conta/escopo/endpoint/validade ou webhook. Campanhas e condições de rede/dispositivo continuam indefinidas.

**npm run test:capacity:isolated** compilou fontes sem .env e ensaiou duas instâncias next start com PostgreSQL16/sentinela próprios. Por120s em cada perfil,30/80 usuários HTTP alternaram vitrine/produtos/carrinho a cada5s;2/5 fluxos manuais por minuto foram aceitos e repetidos em outra instância. Um Chrome desktop por perfil, cache desabilitado e mídia remota bloqueada, mediu load e prontidão de conteúdo/formulário. A suite é omitida fora do executor de capacidade; não altera o perfil antigo de load/dev. Detalhes completos na seção27 do registro e contrato na seção20 dos contratos comuns.

| Evidência local final |30 usuários /2 compras por minuto |80 usuários /5 compras por minuto |
|---|---:|---:|
| Requisições cronometradas / falhas |736 /0 |1960 /0 |
| Máximo de requests do helper em voo |2 |2 |
| Resposta HTTP, p95 |29,0ms |24,2ms |
| Fluxo manual de compra, p95 |533,8ms |317,3ms |
| Home, load / conteúdo pronto, p95 |321,3 / **6116,6ms** |296,3 / **6094,9ms** |
| Checkout, load / conteúdo pronto, p95 |130,7 /255,6ms |116,8 /227,2ms |
| Amostras home / checkout |15 /14 |15 /14 |
| Limite exploratório / prontidão atendida |1000ms / **não** |1500ms / **não** |

**11 testes passaram/3 arquivos,251,14s**, sendo dois perfis novos e nove cenários existentes de processos/assets. Pedidos manuais, tentativas, reservas, outbox e decremento exato conferidos;14 compras únicas sem duplicação por replay. O p95 de páginas coincide com o máximo pela amostra pequena. Os11 não são a regressão completa de289, e a repetição exploratória anterior não acrescenta casos distintos. Typecheck e ESLint direcionado passaram; build55 páginas.

runId **ea894c7765e03be08da4e6ddeb000df2**; UTC **2026-10-06T15:55:24.079Z /2026-10-06T16:00:22.955Z**; build **CQlJaggqjCFYrZp1IymN1**. Windows/x64, Node22.15.0, Next16.3.5, Prisma5.22.0. Fontes SHA-256 **e8a9bc273b5462a2af013add37af839ea07771fdf6ab855e3bd2827cf9d8b3a8**; tests **be171afe84f95ecc9b5739e5b8212cb6dd58a6d4a526823d88f670661c83d283**; scripts **51869d9cc20522d344dd80601558ae0a2c5d7d6349dbdb19932067c7e280880b**. Inputs estáveis e descarte dos containers próprios confirmado por label.

**Resultado de E14:** invariantes funcionais passaram; a home **não atendeu à prontidão desejada**, mesmo neste cenário parcial. A abertura visual aguarda vídeo/fallback de3,8s e animação, em components/home/HeroVideo.tsx. A decisão sobre antecipar título/botões ou rever a meta da home ainda não foi recebida; o componente não foi alterado. O checkout ficou abaixo dos limites localmente, sem certificação de página completa.

**Limites:** não80 navegadores reais, não80 requests simultâneos, sem mídia HTTPS real, dispositivos/rede/CDN/TLS, Vercel/Neon, escala fria, locks/pool instrumentados, Asaas Pix/cartão/boleto, email/frete ou campanhas. Não houve carga no domínio publicado, acesso à branch main, alteração de configuração privada real, flags, migrations persistentes, commit ou deploy. fullPageCertified=false, externalProviders=false e productionReady=false.

Metas e hospedagem deixaram de ser desconhecidas; faltam decisões/isolamento e verificação. A implantação comercial precisa de plano compatível; scheduler deve atender à cadência financeira; regiões/scale to zero devem ser ensaiados. WF-18 ainda exige provas atuais/aceites; WF-19 exige homologação do candidato e serviços; WF-20 exige operação/rollout observado. **Nenhum LA promovido; WF-19 EM EXECUÇÃO, WF-20 NÃO INICIADO.**

## 12. Contrato de configuração Sandbox/Preview — 06/10/2026

Usuário confirmou possuir chave API/webhook Sandbox, sem informar ainda localização/escopo ou valores. A configuração local efetiva permanece em produção, com prefixo de produção, token presente e flags remoto/worker/expiração false. Não foram expostos ou substituídos segredos, acessados serviços da conta ou configurado deployment.

**lib/config/asaas-environment.mjs** centraliza a regra do cliente/preflight: VERCEL=1 com VERCEL_ENV=preview exige Sandbox mesmo em NODE_ENV=production; VERCEL_ENV=production exige produção; runtime otimizado sem Preview identificado mantém produção; desenvolvimento/teste ordinário conserva Sandbox. Pré-condições de URL/prefixo são compartilhadas e não validam a conta. Ver seção21 dos contratos comuns e seção28 do registro. As seções anteriores que tratavam todo runtime production como gateway de produção descrevem a regra anterior.

**635 unitários/78 arquivos passaram,10,74s;30 testes dirigidos/3 arquivos,9,87s**, com build otimizado55 páginas e duas instâncias next start. Typecheck/lint direcionado passaram; preflight real código0, issues=[], productionReady=false. Novos casos de Preview são locais/controlados;21 cenários de autoridade de plano e nove de processos/assets foram repetidos. Sem repetição da regressão completa, Linux ou carga nesta rodada.

runId **6f324b8e289bd600031e37200147c57e**, UTC **2026-10-06T16:41:23.571Z /2026-10-06T16:42:29.593Z**, build **ztayChy2vrnz2H5ARNkQT**, Windows/x64/Node22.15.0/Next16.3.5/Prisma5.22.0/PG16. SHA-256 fontes **ae543bd1a29b0b2c6d977f17dfd514744018e92b159b55e1a3bb24e31f6d9dc7**, tests **8cbd021c98582b2021a21d8a1ecf7aefe87a66bc62ab3823498e26815d8a7b77**, scripts **580f662277f70fc79834797f552f861bbebbf0788917172c46371f59b0dd9072**. Inputs estáveis; consulta Docker por label sem recursos próprios remanescentes.

**Gate financeiro continua aberto:** localização/escopo privados, banco/tenant/schema de homologação, Preview/revisão/variáveis de sistema, conta/endpoint/token e recebimento externo, scheduler/consumidor e Pix/cartão/boleto reais no Sandbox. Ter credenciais não fecha esses itens; um Preview não isola a branch main. Nenhum LA promovido, chamada financeira, configuração privada real alterada, migration persistente, commit ou deploy. **WF-19 EM EXECUÇÃO; WF-20 NÃO INICIADO.**


## 13. Complemento de homologação PIX e prontidão — 08/10/2026

As seções anteriores preservam os checkpoints de 05/06 de outubro. As declarações históricas de ausência de teste financeiro/email externo não descrevem mais todos os ensaios atuais. As evidências abaixo estão no registro de execução, seções 61/65/70; não representam encerramento de todos os gates ou aprovação final dos 38 LA.

| Cenário recente | Resultado observado | Alcance e pendência |
|---|---|---|
| PIX do pedido #1 | Cobrança Sandbox recebida, webhook, pedido Pago e e-mail entregue; total R$24,95 | Caminho controlado aprovado. Valores/descontos/datas bancárias, outros métodos, cancelamento/expiração/estorno e estoque/ledger completo ainda exigem critérios próprios. |
| Webhook duplicado após conclusão | PROCESSED, inbox COMPLETED=1/outbox COMPLETED=3 inalteradas; pedido/pontos/e-mail únicos na conferência do operador | Cenário aprovado; não comprova concorrência ou recuperação de processo/lease. |
| Notificação antiga sintética após pagamento | Evento novo consumido sem retry/review, carteira preservada, supervisão sandbox-hml de 21:53:02.744Z com inbox COMPLETED=2/outbox COMPLETED=3 e nenhuma pendência | Cenário simulado aprovado; não se tratou de reordenação real do Asaas. |

As correções de compatibilidade do Asaas, estabilidade da confirmação e prazo transacional foram publicadas somente na homologação; seus testes dirigidos não são regressão completa do candidato final. O planejamento consolidado das pendências está na seção 12 do workflow: WF-18 (legados/LA-002/033), WF-19 (demais contratos/métodos, falhas/concorrência, fluxos, capacidade/operação e candidato final) e WF-20 (implantação/observação). Scheduler temporário ensaiado permanece desligado; produção precisa de agendamento, monitoramento e orçamento próprios. Home fora da meta no piloto anterior segue gate de capacidade a resolver/revalidar. Nenhum LA promovido automaticamente a VALIDADO ou ENCERRADO EM PRODUÇÃO.
