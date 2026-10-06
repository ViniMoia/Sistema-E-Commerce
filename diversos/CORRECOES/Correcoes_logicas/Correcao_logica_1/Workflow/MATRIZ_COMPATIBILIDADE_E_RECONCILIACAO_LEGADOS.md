# Matriz de compatibilidade e reconciliação dos legados — WF-18

**Data:** 05/10/2026. **Escopo:** ensaio técnico local, sem mutação da origem, ativação financeira ou implantação. Base: [workflow](WORKFLOW_IMPLEMENTACAO_CORRECOES_LOGICAS.md), seção8, e [registro](REGISTRO_EXECUCAO_CORRECOES_LOGICAS.md), seção23.

## 1. Fonte, proteção e resultado

Backup de public capturado em **2026-10-04T15:48:28.600Z**, PostgreSQL18. Reutilizado em clone descartável; nenhuma nova conexão com a origem. Dois restores integrais e um restore do snapshot sanitizado foram conferidos por fingerprints/sequências. AES-256-GCM, chave DPAPI e ACL exclusiva do usuário Windows; dados pessoais/segredos não foram colocados no repositório.

Ensaio final: 2026-10-06T00:01:36.434Z a 2026-10-06T00:02:35.720Z. As33 migrations atuais passaram, segundo deploy não alterou dados, diff Prisma ficou vazio e o inventário executou em RepeatableRead READ ONLY. Tempo do migrate deploy no clone pequeno: **990 ms**; não estima duração/lock em produção.

Artefatos privados, fora do Git: diretório LOCALAPPDATA/logic-audit-backups/5f81d9017b05f5313103caccd20470e4; evidência **evidence-60cb4b9030e5008879ba3955290c0851.json** e manifesto criptografado **legacy-commerce-60cb4b9030e5008879ba3955290c0851.json.enc**. Tags SHA-256 com sal da execução identificam loja/produto/variante no inventário sem publicar seus IDs, nomes, dimensões, emails ou documentos. Não servem como autorização nem prova para reassociar registros.

O inventário não recomenda correções automáticas: automaticRepairs=[]; productionReady=false. integrityPassed=true significa apenas que os invariantes inspecionados passaram. requiresReconciliation=true impede declarar o histórico resolvido. Contagens se sobrepõem: não somar linhas desta tabela como quantidade de entidades distintas.

## 2. Inventário do clone e decisões

| Classe | Contagem | Tratamento seguro / evidência necessária |
|---|---:|---|
| Pedidos anteriores ao protocolo de intenção |24| Preservar IDs, status, total e vínculos; conciliar efeitos anteriores por pedido. |
| Pedidos antigos sem chave de idempotência |24| Não gerar chaves aleatórias retroativas; manter leitura por ownership, sem autorizar nova execução da compra antiga. |
| Pedidos PENDING antigos |10| Sem expiração/restituição automática por idade; confirmar obrigação financeira e estoque anterior antes de resolver. |
| Itens sem productVariantsId |33| Não preencher por nome, preço, “única variante atual” ou combinação semelhante; exigir identidade histórica demonstrável. |
| Pedidos sem reserva persistida |24| Não fabricar reserva ou débito retroativo; cancelamento que restitui estoque fica recusado até conciliação. |
| Pedidos com referência remota e sem PaymentAttempt |2| Correlacionar conta/contrato/cobranças no gateway e efeitos locais; ID existente não é prova de sucesso nem autorização para cobrar novamente. |
| PAID/SHIPPED/DELIVERED sem fato de reconhecimento |4| Indicadores exibem base parcial. Não criar AUTHORIZED/SETTLED a partir do status comercial. |
| Pedidos sem snapshot de comprador |24| Leitura pessoal mantém titular/tenant; não atribuir titular por email. Preservar ausência histórica. |
| Entregas sem snapshot de cotação |16| Não fabricar geografia/tarifa antiga; nova compra deve usar cotação nova. |
| Pedidos sem histórico de status |24| Não sintetizar evento original/autoria/data. Reconstrução comprovada deve se declarar reconstrução e ser auditada. |
| Carteiras não accountingReady |2| Preservar saldo e movimentos; bloquear uso/expiração até lotes/alocações/prazos demonstrarem conservação. |
| Movimentos antigos de pontos sem contrato contábil completo |2| Não ativar por saldo agregado; resolver origem, consumo, estornos e validade. |
| Duplicatas de variantes ativas normalizadas |0| Não executar o saneador antigo; ausência neste snapshot não prova ausência em produção atual. |
| Produtos ativos sem variante ativa |0| Não criar variante por inferência; checkout mantém resolução e estoque atuais. |
| Donos cross-tenant/vínculos inválidos inspecionados |0| Constraints/serviços preservados; ensaios negativos sintéticos recusam contaminação. |
| Proprietários com múltiplos carrinhos ACTIVE |0| Índice parcial existente validado; não escolher/mesclar automaticamente uma ocorrência futura. |
| Carteiras prontas com saldo/lotes divergentes |0| Gate valida balance/debt/remaining; ledger sem proveniência continua sujeito a conciliação. |
| Constraints não validadas / índices inválidos / triggers desativados |0/0/0| Catálogo inspecionado; sete guards críticos presentes e ativos. Nenhuma constraint histórica relaxada. |

Antes da sanitização, o snapshot restaurado tinha **cinco sessões ainda não vencidas no momento do ensaio** e zero tokens de reset ativos com formato legado inspecionado. Sessões foram vencidas e tokens/dados pessoais redigidos apenas no clone. Esses campos e rastreios/endereço não recebem certificação de produção pelo inventário sanitizado; formato de hash não prova a história do token.

## 3. Matriz de leitores, escritores e constraints

| Domínio | Histórico preservado / leitor | Escritor novo / barreira | Contraction / reconciliação pendente |
|---|---|---|---|
| Catálogo/variantes | IDs e vínculos conservados; normalização do inventário reutiliza lib/product-variants.ts | Reconciliação por produto bloqueado/revisão; checkout exige variante válida/estoque | Não juntar estoques, apagar IDs vinculados ou retirar stock0 por inferência; saneador antigo continua bloqueado. |
| Carrinho | Tenant herdado do User e item do Cart pelo FK original demonstrável | FK composta e unicidade parcial ACTIVE, revisão/recibo | Carrinho contaminado/duplicado deve suspender migration, sem mescla automática. |
| Checkout/itens | NULL de intenção, variante e chave continua legível com ownership | Intenção aceita, consumo/reserva/tentativa no commit e guards diferidos | Não impor NOT NULL global ou converter compra antiga em nova intenção. |
| Pedido/estoque | Leitura própria e confirmação de entrega física existente permanecem | Sem checkoutIntentID, PAID/SHIPPED/CANCELLED retornam conflito antes dos efeitos; ações do Admin seguem a mesma política | Resolver pagamento e débito/restituição física antes de habilitar mutação histórica; não há bypass de Admin/SYSTEM ou flag cliente. |
| Pagamento | Referência antiga não entra sozinha na execução durável | Correlação, inbox/outbox, fatos e operações com proveniência | Gateway real/conta, eventos antigos, obrigações e efeitos já aplicados precisam ser conciliados; parcial/retorno físico permanecem em LA-002/033. |
| Frete | Snapshots/geografia ausentes não são preenchidos | Nova cotação persistida/revisionada e consentida | Geografia antiga e regras novas exigem evidência por loja. |
| Fidelidade | accountingReady=false conserva saldo/ledger, sem expiração arbitrária | Lotes/FEFO/alocações/efeitos identificados e constraints condicionais | Reconstrução e aceite de crédito/débito/validade precisam fechar antes da ativação. |
| Sessão/reset | Login e consumo revalidam elegibilidade/tenant; token legado não recebe hash fictício | Emissão/consumo/revogação atômicos | Não migrar sessões/token/identidade por formato; avaliar recuperação/rolagem real em WF-19/20. |
| História/auditoria | Lacuna original permanece explícita | Ator humano/sistema, revisão, recibo e outbox | Ausência não pode ganhar aparência de evento original. |
| Indicadores | Lista/perfil mostram somente fatos e cobertura parcial | Fonte comum sob RepeatableRead, sem cache financeiro | Gateway/ledger histórico e aprovação da fórmula financeira permanecem pendentes. |

Nenhuma remoção de coluna/rota legada ou constraint global adicional foi feita. As constraints de protocolo novo estão ensaiadas; contrato final de produção depende de leitores/escritores/deploy coexistentes, dados atuais e revisão operacional. Leitura compatível não equivale a permissão para manter todos os writers antigos.

## 4. Backfill demonstrável, interrupção e retomada

O único preenchimento automático aqui ensaiado é o já versionado em 20261005000000_purchase_tenant_scope: Cart.lojaID segue seu User persistido; CartItem.lojaID segue seu Cart persistido. A migration bloqueia tabelas, audita contaminação, aplica DDL/DML/FKs numa transação com lock_timeout10s. Não altera identidade, quantidade, preço, variante ou dono.

No clone real, essa trajetória passou sem modificar colunas históricas e sequências. Na fixture sintética de upgrade, **um carrinho arquivado e um item** receberam os tenants comprováveis. Uma trigger exclusiva da fixture lançou erro durante UPDATE, após o ADD COLUMN: DDL e dados retrocederam integralmente. Após remover somente essa injeção no ambiente próprio, migrate deploy retomou o artefato; segundo deploy preservou o resultado. Não é um comando de correção do banco persistente nem uma simulação de crash no gateway.

A rejeição de grafo cross-tenant e a rejeição de ACTIVE duplicado também foram ensaiadas. A resolução explícita dessas fixtures cria cenários de teste; não autoriza remover ocorrência real para a migration passar. Tamanho/lotes, janela e impacto de locks ainda precisam de medição no volume atual. Não foi inventado lote de250/1000 registros nem tempo de produção.

## 5. Procedimento de repetição e pontos de parada

1. Executar os ensaios descartáveis: npm run test:migrations:isolated e npm run test:legacy:isolated. Integrações recusam banco/servidor sem a sentinela da execução.
2. No Windows do titular do backup protegido, executar node scripts/verify-restored-clone.mjs --backup-dir <diretório privado existente> --audit-legacy. Esse modo exige reutilização do artefato e verifica a identidade do clone criado; não consulta a origem.
3. Conferir evidence.success, historyVerified, sanitizedRestoreVerified, dataPreserved, sequencesPreserved, legacyAuditReadOnly, diff e catálogo. Falha interrompe o ensaio; conservar evidência privada, não reescrever checksum ou apagar dados.
4. Separar integrityBlockers de reviewReasons. requiresReconciliation não se resolve aceitando a flag; cada caso necessita evidência de negócio e procedimento aprovado ou exceção operacional explicitamente resolvida.
5. Para qualquer lote futuro, identificar tenant/registros, backup restaurável, evidências de origem, pré-condições/revisões e efeitos esperados; auditar carrinhos/pedidos/reservas antes de mudar variante. Sob locks, reler e validar os mesmos vínculos. Recusar dados mudados/ambíguos.
6. Registrar identidade/hash do lote, antes/depois, movimentos físicos/financeiros, autoria e resultado durável. Repetição deve consultar o resultado anterior sem reaplicar efeitos. Se falhar uma invariância, parar os lotes seguintes; não clonar dinheiro ou estoque para compensar ausência de prova.
7. Antes de produção, reconfirmar snapshot atual, contas externas e operações ocorridas após o backup. Restore do PostgreSQL não reverte pagamentos efetuados no gateway. Janela/RPO/RTO/responsáveis ainda precisam de aceite em WF-20.

## 6. Gate de saída

O ensaio técnico de WF-18 passou no clone/fixture. **WF-18 permanece EM EXECUÇÃO quanto à resolução/aceite das exceções de dados e ao contrato final operacional.** O relatório não transforma NULL preservado, escritor bloqueado ou saldo indisponível em achado encerrado.

É possível preparar/executar testes técnicos de WF-19 com essas barreiras, mas não registrar os38 como VALIDADO enquanto os legados de LA-002/033 e as exceções acima não tiverem resolução demonstrável. WF-20 continua sem autorização operacional concreta de rollout. Não houve mudança em .env, banco persistente, gateway, transportadora, email, commit ou deploy.
