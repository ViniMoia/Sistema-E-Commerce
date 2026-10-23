# Vanderlei — etapa 2: preparação independente concluída

Foram concluídos o complemento do inventário, o laboratório descartável, os ensaios de timeouts/permissões/pool, os manifestos propostos e os roteiros operacionais. A execução financeira compartilhada, a ativação de alertas e a alteração de permissões remotas continuam dependentes da janela coordenada. Nenhuma dessas mudanças foi aplicada.

Referência: `VANDERLEI.md`, revisão 2.1, em `c2a6933a333009077fd3ab753ce7307261850e23`. Baseline: [retomada de 23/10](evidencias/V-RETOMADA-GCP-2026-10-23.json). Consultados também `ROADMAP.md` e `ROADMAP_FRETE.md` de `origin/main`, revisão `7f9b26e062ec2654420fecffb6dd78ad3ba1e017`, somente leitura. Esses roadmaps descrevem evolução e arquitetura; não comprovam configuração implantada. Não houve consulta ou escrita no banco de main, nem necessidade de importar configuração nesta etapa.

Evidência consolidada: [V-ETAPA2-2026-10-23.json](evidencias/V-ETAPA2-2026-10-23.json). Propostas revisáveis: [V-PROPOSTAS-G6-ETAPA2-2026-10-23.json](evidencias/V-PROPOSTAS-G6-ETAPA2-2026-10-23.json). Os JSONs anteriores foram preservados.

| Atividade independente | Resultado |
| --- | --- |
| Inventário incremental | Concluído por leituras de metadados GCP e transação READ ONLY em homologação. |
| Timeouts | 16 combinações medidas; interrupção HTTP real em loopback; proposta registrada. |
| Permissões | Migrador distinto; runtime sem propriedade; grants explícitos; transações/triggers e recusas comprovados. |
| Pool | Três topologias de clientes medidas; orçamento agregado preparado, parcela externa desconhecida. |
| Supervisão/alertas | Filtros e consumidor ensaiados com dados sintéticos; propostas desativadas e roteiro humano completo. |
| Roteiro financeiro | Pré-condições, correlação, coleta, parada e recuperação documentadas; casos comerciais pendentes de Vinícius. |
| Outras frentes | Lacunas, responsáveis e evidências de fechamento consolidados abaixo. |

**1. Diferenças desde a retomada**

Consultas próprias: **23/10/2026, 18h56m33–18h56m39 BRT / 21h56m33–21h56m39 UTC**. O coletor GCP só consulta metadados; não lê valores de segredos nem chama rotas da aplicação. O coletor do banco verifica host, banco e loja, abre `REPEATABLE READ, READ ONLY`, confirma `transaction_read_only=on` e limita cada statement a 10s.

| Fila | Após a retomada, 14h37 BRT | Consulta desta etapa | Diferença |
| --- | --- | --- | --- |
| PaymentInbox | 30 COMPLETED, 1 READY | 31 COMPLETED | +1 concluído, −1 pronto |
| CommerceOutbox | 22 COMPLETED, 1 DEAD_LETTER | 22 COMPLETED, 1 DEAD_LETTER, 1 READY | +1 pronto |
| PaymentOperation | 15 COMPLETED, 1 PENDING | 16 COMPLETED, 1 PENDING | +1 concluído |

Essas contagens reconfirmam a consulta de planejamento das 17h38–17h39 BRT. **Não foi atribuída causa às diferenças**, nem processada qualquer fila. O relato de Vinícius sobre Vercel acessível, fila Asaas retomada, evento do pedido nº 8 concluído e reserva em revisão permanece identificado como informação comunicada no guia. Contagens agregadas não comprovam a identidade do evento nem todos os seus efeitos.

A comparação não encontrou diferença no tráfego, flags do serviço, referências de segredos ou timeout web em relação à retomada. Permanecem seis revisões acessíveis pelo tráfego/tags, limite de uma instância por revisão e concorrência HTTP 20. Os dois Jobs continuam sem execuções, com uma task, paralelismo 1, retries 0 e destino `review-9495ff9`. Pagamentos: HTTP 240s, Job 1800s, até cinco lotes. Supervisão: HTTP 30s, Job 60s, um lote. Web: 60s. Checkout pausado e capacidades financeiras desligadas em todas as revisões acessíveis consultadas.

Continuam existentes somente a métrica e as duas políticas de supervisão; políticas e canal de e-mail desativados. A métrica e as políticas próprias de pagamentos ainda são propostas. As referências de segredos constam no JSON sem seus conteúdos.

A conta de banco continua proprietária das 38 tabelas, com `CREATEDB`, `CREATEROLE` e `BYPASSRLS`; não é superuser. Limite observado: 112 conexões, quatro reservadas. A fotografia não mostrou outras sessões nem leases ativos. Isso não demonstra exclusividade global: Vercel, ferramentas administrativas, revisões com tags e acionadores externos podem voltar a conectar. Permanecem as limitações históricas de inventário por APIs desativadas e de acesso à configuração externa de Cloudflare/Vercel.

**2. Laboratório, medições e limites propostos**

Docker Desktop iniciado; engine 29.8.2 disponível. Execução válida: **18h57m31–18h58m37 BRT / 21h57m31–21h58m37 UTC**. PostgreSQL 18 em container identificado por run ID, porta publicada somente em loopback, armazenamento temporário, cópia do projeto sem `.env` e ambiente dos processos construído por allowlist. Não foram repassadas credenciais compartilhadas, endpoints de provedores ou `NODE_OPTIONS` da máquina aos testes.

O novo [verify-operational-readiness.mjs](../scripts/verify-operational-readiness.mjs) migra exclusivamente esse banco como `ecommerce_migrator`, prepara os dados sintéticos nessa identidade e usa `ecommerce_test` nos serviços reais de checkout, inbox, conciliação, expiração e outbox. A sentinela existente continua obrigatória. O descarte valida o identificador do container e o caminho temporário antes de remover os recursos próprios.

Foram combinados lotes 1/5, um/dois executores concorrentes, latência simulada de 0/80ms e execução por etapas/conjunta. Cada combinação tem **uma amostra**, sem pretensão de percentil, teste de carga ou SLO. A duração por etapa e os resultados efetivamente reclamados/concluídos estão no JSON; todas as etapas tiveram trabalho real no banco local. A expiração exercitada é de PIX manual; a aprovação usa PIX simulado. Os caminhos de estorno, cartão, boleto e SMB não são certificados por este ensaio.

| Lote | Executores | Latência simulada | Etapas separadas, total ms | Ciclo conjunto, total ms |
| --- | --- | --- | --- | --- |
| 1 | 1 | 0ms | 250,19 | 168,49 |
| 1 | 1 | 80ms | 384,41 | 326,29 |
| 1 | 2 | 0ms | 321,12 | 187,52 |
| 1 | 2 | 80ms | 375,49 | 362,58 |
| 5 | 1 | 0ms | 1035,36 | 849,43 |
| 5 | 1 | 80ms | 1930,43 | 1771,12 |
| 5 | 2 | 0ms | 893,24 | 915,41 |
| 5 | 2 | 80ms | 1866,47 | 1864,21 |

Nos cenários com dois executores, a tabela registra o tempo de parede dos dois, não a soma. A expiração pode selecionar candidatos coincidentes; os locks impedem duplicação de cancelamentos. A limpeza dos trabalhos sintéticos restantes ocorre fora do intervalo medido. Foram conferidos estados, versões e quantidade de históricos para detectar efeitos comerciais duplicados.

No teste de interrupção, um servidor HTTP local chamou os serviços reais, com inspeção simulada de 600ms. O consumidor configurado para 150ms retornou `CONSUMER_TRANSPORT_UNCERTAIN` em aproximadamente **180ms**. Houve **um único POST**, apesar de o consumidor permitir até cinco lotes. Naquele instante, a inbox ainda tinha um lease vivo, com cerca de 600s restantes. O servidor concluiu a aprovação em aproximadamente **724ms**, e os leases foram liberados. O teste não representa um deployment Next/Cloud Run; demonstra o contrato do consumidor e a continuidade do trabalho no banco local após o abandono da conexão. A documentação do [timeout do Cloud Run](https://docs.cloud.google.com/run/docs/configuring/request-timeout) também informa que o encerramento da conexão não termina a instância.

Proposta experimental, **não aplicada**: conservar web em **60s**, reduzir o consumidor a **um lote**, HTTP em **75s** e Job em **240s**, task/paralelismo 1 e retries 0. O HTTP reserva 15s além do limite web para observar sua resposta; o limite do Job cobre GET inicial + POST + GET final, cada um de até 75s, mais 15s de margem do processo. Supervisão conserva HTTP 30s/Job 60s e apenas GET. A proposta reduz a espera incoerente atual e não aumenta automaticamente o limite web.

O maior ciclo sintético foi 1,93s, mas isso **não limita a duração remota**. O cliente Asaas possui timeout de 8s por requisição; uma inspeção pode envolver várias chamadas, e ainda existem cold start, espera de locks, conexão Neon e e-mail. Antes de adotar os limites, Vanderlei e Vinícius devem medir o cenário autorizado na versão definida, exigir margem dentro dos 60s e revisar o desenho se o envelope não couber. Timeout/504 implica resultado incerto e parada; não autoriza repetir POST, cobrança ou estorno. Um limite de Job tampouco cancela trabalho já aceito pela aplicação.

**3. Privilégios e orçamento de conexões**

A matriz executável está em [operational-readiness.mjs](../scripts/lib/operational-readiness.mjs) e integralmente na evidência. Não foram concedidos privilégios amplos por schema ao runtime; as permissões são por tabela, sequência, função e, quando necessário, coluna.

| Identidade/objeto | Proposta ensaiada | Evidência/limite |
| --- | --- | --- |
| Migrador | Identidade distinta, CREATE no schema descartável e propriedade dos objetos de migrations; sem superuser/CREATEDB/CREATEROLE/BYPASSRLS | Executou todas as migrations somente no banco novo. Preparou loja, usuário, catálogo e prazos sintéticos. |
| Runtime | Sem propriedade de tabelas e sem atributos administrativos; CONNECT/USAGE e grants enumerados | Checkout, confirmação, conciliação, expiração manual e outbox concluídos. |
| Catálogo/configuração | SELECT; UPDATE de estoque em Product/ProductVariants; UPDATE somente da coluna id em Loja/User/FreightTariffRevision para locks | O PostgreSQL exige UPDATE em pelo menos uma coluna para FOR SHARE. Esse grant permite alterar a coluna em tese; não é um privilégio exclusivo de lock e precisa ser avaliado no desenho remoto. |
| Comércio/filas | SELECT/INSERT/UPDATE conforme a tabela; DELETE apenas em CartItem na proposta | Matriz cobre os caminhos ensaiados e dependências relacionadas, não todos os fluxos Web/Admin. Grants relacionados a caminhos não exercitados precisam de revisão adicional. |
| Auditoria/fatos/histórico | SELECT/INSERT, sem UPDATE/DELETE nos objetos append-only da matriz | Integridade e transação preservadas nos cenários exercitados. |
| Sequência | USAGE/SELECT apenas em Order_orderNumber_seq | Numeração dos pedidos sintéticos funcionou. |
| Rotinas | EXECUTE enumerado nas sete funções de integridade; execução pública de funções do schema revogada no laboratório | Triggers existentes preservados; nenhuma função SECURITY DEFINER introduzida. Não interpretar EXECUTE em trigger como isolamento completo de domínio. |
| Operações proibidas | CREATE TABLE, TRUNCATE AuditLog, CREATE ROLE, leitura de _prisma_migrations e SET ROLE migrador | Todas recusadas com SQLSTATE 42501. |
| Integridade | Rollback de transação e imutabilidade de checkout aceito | Rollback conferido; tentativa de alterar conteúdo recusada com SQLSTATE 23514. |

Fonte da exigência de privilégio para locks: [PostgreSQL 18 — SELECT](https://www.postgresql.org/docs/18/sql-select.html). A troca remota deve mapear também login, Admin, carrinho autenticado, pontos, frete e integrações antes de revogar privilégios. O ensaio entrega uma proposta verificável; não autoriza aplicar a matriz reduzida à aplicação inteira. Futuras migrations devem passar novamente pelo levantamento de grants, sem concessão automática irrestrita ao runtime.

Com `connection_limit=4`, quatro transações simultâneas usaram quatro PIDs de backend por cliente. Um cliente representando uma instância: **4 conexões**. Dois clientes representando duas instâncias da mesma revisão: **8**. Dois clientes representando uma instância em cada uma de duas revisões: **8**. São clientes Prisma independentes no laboratório, não revisões implantadas ou processos Cloud Run medidos. As conexões do migrador/observador foram separadas das transações contadas.

Orçamento proposto: `4 × (6 revisões acessíveis + 1 sobreposição) × 1 instância + 4 administrativas = 32 conexões`. Inclui as cinco revisões com tags e a revisão com tráfego. Os Jobs atuais fazem HTTP; seu processamento usa o pool do serviço e não soma outro pool de banco no container do consumidor. Isso deverá ser revisto se passarem a conectar diretamente.

Dos `112 − 4 = 108` slots teóricos disponíveis, restariam **76 antes da parcela externa**. `Vercel + acionadores externos + ferramentas + migração além da reserva administrativa + margem operacional` continua **desconhecido**, não zero. O pool remoto efetivo não foi inferido das URLs secretas, nem alterado. Mais processos por instância, escalonamento extra ou outras revisões acessíveis multiplicam a demanda. Não há aprovação de capacidade ou de custo; limites Neon, pooler, memória, picos e budget dependem dos administradores/Vinícius.

**4. Supervisão, alertas e atendimento**

O novo JSON reaproveita os corpos de 22/10. Mantém as políticas `enabled:false`, os canais existentes e a separação de pagamentos/supervisão. Acrescenta escopo explícito de projeto/região/Job à ausência, alinhamento proposto de 600s e os limites experimentais acima. Contém também um PATCH proposto somente para conditions/enabled da política de ausência de supervisão existente, preservando sua identidade. Não foi enviado à API.

Os testes usam os filtros propostos, um avaliador local restrito à sintaxe utilizada e registros de sucesso, atenção, falha e recuperação. Conferem também severidade promovida e rejeição de outros projetos, regiões, Jobs e tipos de recurso. O consumidor de supervisão real, com transporte simulado, realizou **somente GET de status** em todos esses cenários; não enviou comandos financeiros. Atenção conta como conclusão da execução e aciona o filtro de problema. Portanto, a métrica de conclusão sozinha não comprova saúde financeira.

O ensaio remoto de alertas permanece **não executado**. Roteiro pronto para a janela coordenada:

| Passo | Ação e coleta | Critério de avanço/parada |
| --- | --- | --- |
| Pré-condições | Vinícius confirma destinatário controlado, responsável, substituto, disponibilidade, janela e teto. Vanderlei reconfere filtros, recursos equivalentes, destino/revisão e autenticação. Guardar snapshot da configuração atual. | Não ativar sem destinatário/operador disponíveis; não criar políticas duplicadas. |
| Série inicial | Executar somente supervisão após liberação; registrar execution ID, consumer runId, timestamp UTC/BRT, log e ponto da métrica correspondente. | Confirmar ponto novo após criar/modificar a política. Ausência de série inicial não comprova monitoramento de ausência. |
| Atenção e falha | Em mecanismo sintético segregado aprovado na janela, produzir condições/logs controlados de atenção e falha; registrar filtro, entrada, incidente e destino. Não usar Job financeiro ou alterar segredos compartilhados para forçar erro. | Não contaminar a série de produção como se fosse execução financeira real. Sem mecanismo segregado aprovado, este passo permanece pendente. |
| Recebimento | Destinatário confirma mensagem recebida, horário, identificação do incidente e canal. Operador confirma ciência e início do atendimento; substituto cobre indisponibilidade. | Proposta de confirmação em até 5min, sujeita ao aceite de disponibilidade. Sem recebimento ou ciência, interromper piloto e registrar lacuna; não declarar sucesso só pela API. |
| Ausência | Após a série inicial, interromper apenas o acionador de supervisão acordado e observar ausência de novos pontos. Registrar último ponto, alinhamento, avaliação, incidente e recebimento. | Ausência configurada em 600s com alinhamento 600s não promete entrega exatamente em dez minutos. Considerar ingestão/avaliação; distinguir recurso encerrado/removido de acionador parado. |
| Recuperação | Retomar somente supervisão e observar ponto novo, reasons vazios e resultado saudável; registrar atendimento e encerramento do incidente apropriado. | Log saudável não fecha automaticamente incidente baseado em logs. Confirmar resolução/fechamento e recebimento conforme a política; autoClose não prova recuperação. |
| Encerramento | Desativar acionador/políticas/canal conforme snapshot e escopo aprovado, conferir zero execução financeira e arquivar horários/evidências. | Nenhuma recorrência continua automaticamente depois da janela. |

Responsável operacional previsto: Vanderlei; decisão comercial, destinatário, substituto e disponibilidade: Vinícius, **a confirmar**. A proposta herdada de supervisão permanece cinco minutos por até 90 minutos, teto de 18 execuções, condicionada ao budget e à janela; não é agenda criada.

A documentação de [ausência no Cloud Monitoring](https://docs.cloud.google.com/monitoring/alerts/metric-absence) exige um ponto após criação/alteração da política e recomenda janela de alinhamento de pelo menos dez minutos para métricas de logs. O teste local não valida ingestão, avaliação da API, notificações ou atendimento humano.

**5. Complemento operacional do roteiro financeiro**

`ROTEIRO_ACEITE_FINANCEIRO_G3.md` e a publicação do executor por evento continuam ausentes na revisão auditada. Abaixo está a preparação operacional; não define produto, valor, cobrança ou efeito comercial em nome de Vinícius. Os pedidos **nº 3 e nº 8 não serão reutilizados**.

Antes da execução compartilhada: Vinícius deve fornecer casos, IDs exatos, valor/método, produto/variante, efeitos esperados e exclusões; publicar commit/PR do executor e evidências; definir responsável pela aplicação e integração SMB. Vanderlei deve vincular SHA/digest à revisão efetivamente implantada, autenticação, conta/loja, inventário de acionadores Vercel/Cloudflare/GCP, exclusividade, janela e orçamento. Conferir filas, operações pendentes, leases e backups existentes sem refazer manutenção ou saneamento já comprovados.

**`limit=1` não seleciona um pedido.** A rota geral também executa conciliação, expiração e outbox. O consumidor atual chama `?limit=5` e `maxBatches=1` limita a quantidade de ciclos, não o número de pedidos nem as dimensões de efeito. O executor exato deve ser revisado quando publicado, sem fallback para a fila geral. O HTTP 200 de um webhook comprova resposta, não todos os efeitos comerciais.

| Etapa | Correlação e coleta mínima | Critério operacional |
| --- | --- | --- |
| Baseline do caso | Loja/conta, order.id/orderNumber, OrderItem.variantID, InventoryReservation, CheckoutIntent, estado/versão/estoque e timestamps | IDs pertencem ao cenário autorizado; variante persistida e vínculos íntegros. |
| Tentativa/cobrança | PaymentAttempt.id, providerAccount, externalReference, PaymentCharge.id/paymentId, método, valor e eventual contrato | Cobrança corresponde à mesma loja, conta e pedido; dados sensíveis omitidos do relatório. |
| Recebimento | ID externo do evento, PaymentInbox.id/eventId, status, tentativas, nextAttemptAt, leaseOwner/leaseExpiresAt | Persistência e autenticação conferidas; não confundir recepção com processamento. |
| Processamento | Executor/versão, consumer runId ou ID de execução exata, Cloud Run execution/revision, início/fim UTC/BRT, resultado/erro/revisão | Escopo exato corresponde ao caso. Coleta não chama GET/POST da rota financeira geral para observar. |
| Efeitos | Order.status/version, OrderStatusHistory, FinancialFact, PaymentOperation, reservas/estoque, pontos e effectKey da CommerceOutbox | Comparação antes/depois segundo o aceite comercial de Vinícius; efeitos únicos e outros pedidos preservados. |
| Comunicação | Outbox/effectKey, tentativa de envio, ID do provedor e confirmação de entrega quando autorizada | Fila criada, envio aceito e recebimento são evidências distintas. |
| ERP/SMB | Responsável da integração, ID exportado e comprovação de baixa/ausência de duplicação | Não executar integração comercial como extensão implícita do Sandbox financeiro. |

Parar diante de identidade/escopo divergentes, revisão não publicada, concorrência não prevista, lease vivo inesperado, timeout/504, estado incerto, retry/revisão, efeito duplicado ou limite de custo/duração atingido. Desabilitar somente o acionador liberado e impedir novos disparos; registrar trabalhos em andamento antes de qualquer intervenção. Não matar todos os processos indiscriminadamente, liberar leases manualmente ou marcar operação incerta como falha definitiva.

Recuperação: observar status e banco em leitura, correlacionar a cobrança existente no provedor e esperar/conferir o resultado do trabalho já iniciado. Não emitir nova cobrança/estorno nem repetir POST automaticamente. Se não houver conclusão, usar o mecanismo durável/executor exato revisado apenas em nova decisão coordenada, respeitando leases, backoff e estados de revisão. Restaurar flags/agendas a partir do snapshot real; não restaurar banco para desfazer um resultado financeiro desconhecido. Cada caso continua **não executado no ambiente compartilhado nesta etapa**.

**6. Lacunas restantes, sem repetir entregas anteriores**

| Frente | Preparação disponível | Responsável/dependência | Evidência necessária para fechar |
| --- | --- | --- | --- |
| E-mail/reset | Procedimento e bindings propostos de 22/10; sequência de envio/recebimento acima | Vinícius: domínio, remetente e destinatário; Vanderlei: verificação técnica na janela | Binding implantado na revisão, envio real controlado, recebimento, link na origem correta, uso único/expiração do reset e login/logout. `401 restricted_api_key` ao listar domínios não justifica trocar chave. |
| Capacidade/custo | Medições locais e fórmula com parcela externa explícita | Vinícius/administradores Neon, Vercel e GCP | Quantidade/limites de instâncias e processos externos, pools efetivos, capacidade Neon, orçamento aceito e ensaio de carga autorizado. Não inferir de baixa atividade. |
| Frete/embalagens | Diagnóstico e roteiro existentes; nenhum recálculo/importação novo | Vinícius: contratos, cobertura e embalagens reais; Vanderlei: ensaio técnico | Dimensões/pesos reais, destinos e pacotes aceitos por modalidade; disponibilidade/timeout Correios; prova própria de Correios, J&T, retirada e frete a combinar. As dimensões padronizadas dos 519 produtos e cotações J&T não fecham todas as modalidades. |
| Interface | Reaproveitar aceites publicados compatíveis | Vinícius: contas/casos e versão; Vanderlei: cenários sem prova | Variantes distintas, carrinho autenticado, fluxos financeiros/Admin e domínio final, com versão e resultados. Não repetir toda a bateria sem mudança pertinente. |
| G2 | Plano de recuperação e referências anteriores preservados | Vinícius: fechamento técnico/custódia; administradores: acesso independente | Acesso independente à chave, custódia, itens externos ao dump, RPO 15min/RTO 60min e evidência de recuperação. Não repetir restore idêntico para suprir documento ausente. |
| IAM/runtime remoto | Grants locais ensaiados e matriz disponível | Administradores/Vinícius com Vanderlei | Mapear dependências da conta Compute padrão com Editor, identidades separadas, grants completos por caminho, bindings coordenados e prova pós-alteração. |
| Executor exato | Critérios do guia preservados | Vinícius publica código/evidências; Vanderlei revisa SHA | Seleção por evento/pedido/loja/conta, leases e repetição concorrente, sem chamar rotinas gerais ou efeitos fora do caso. |

As lacunas de e-mail/frete/G2 acima vêm do guia e das evidências de 22/10; não são novos diagnósticos remotos desta coleta.

**7. Reprodução, validação e sanitização**

Com Docker Desktop ativo e dependências instaladas, na raiz do projeto:

```powershell
npm run test:operational:isolated
npm run test:operations
node node_modules/typescript/bin/tsc --noEmit --incremental false
node node_modules/eslint/bin/eslint.js scripts/verify-operational-readiness.mjs scripts/lib/operational-readiness.mjs scripts/collect-operational-readiness-db.mjs tests/operational/readiness.test.ts tests/scripts/operational-readiness.test.mjs
```

O ensaio não aceita URL/destino em argumentos e grava `artifacts/operational-readiness/<timestamp>/report.json`, `measurements.json` e log sanitizado. Não usa Neon como alternativa caso Docker falhe. A cópia isolada e o container são descartados ao terminar. O client Prisma gerado deve corresponder ao schema atual; nesta máquina foi necessário regenerar somente o client local, sem executar migration compartilhada.

Para reconferir exclusivamente o inventário, com autenticação GCP já existente e `.env.homologacao` local aprovado:

```powershell
python scripts/collect-operational-readiness.py
node scripts/collect-operational-readiness-db.mjs
```

Esses comandos produzem novas fotografias datadas, sem sobrescrever a baseline. O coletor de banco está intencionalmente restrito ao host/banco/loja desta homologação.

Resultado: **1 teste operacional integrado** (16 combinações, permissões, interrupção e três topologias), **17 verificações de isolamento** (incluindo sentinela real divergente e destinos não locais) e **32 testes operacionais de regressão**, todos aprovados. Os cinco testes novos de propostas foram repetidos após o ajuste de alinhamento. TypeScript e ESLint direcionado passaram. A alteração da sentinela não permitiu novas escritas; a contagem de lojas permaneceu igual. Nenhum container do laboratório ficou ativo.

Os JSONs foram validados e os arquivos novos revisados para não conter URLs com senha, valores de segredos, tokens, dados de clientes ou destinatários reais. O JSON consolidado inclui hashes dos coletores, ensaios, propostas e fotografias usadas. Dados/IDs comerciais presentes nas medições são exclusivamente sintéticos. Nenhuma API pública, schema compartilhado, pedido nº 3/nº 8, vínculo de variante, controle financeiro remoto, IAM ou integração foi alterado.
