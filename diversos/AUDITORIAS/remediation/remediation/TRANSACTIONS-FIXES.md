# Correções de checkout, pagamentos, pedidos e estoque — etapa 04

**Data:** 2026-09-27  
**Escopo:** `COMMERCE-TRANSACTIONS-AUDIT.md`, `BACKEND-AUDIT.md`, `DATABASE-AUDIT.md`, consolidação final, plano de remediação, código e testes locais.  
**Estado da entrega:** controles locais implementados e validados; publicação continua bloqueada por verificações externas, migração ainda não aplicada em ambientes reais e itens deliberadamente diferidos.

## Resultado executivo

O navegador e a API agora compartilham um contrato canônico de checkout, preservam a variante e usam somente `POST /api/checkout`; o criador alternativo de pedido foi encerrado com HTTP 410. Preço, desconto, juros, total e estoque são derivados no servidor. Entregas exigem cotação HMAC vinculada a tenant, CEP, itens, provedor, preço e validade; preço e dimensões da cotação vêm do banco, o cache inclui valor segurado e a tabela local filtra apenas a cidade resolvida pelo CEP no servidor.

Cada tentativa pública exige chave de idempotência e fingerprint. O pedido persiste um workflow financeiro antes da chamada externa. Recusa determinística cancela e compensa; timeout, erro 5xx, falha de rede ou falha de persistência depois da cobrança deixam o pedido reservado em `RECONCILIATION_REQUIRED` e impedem nova cobrança. O webhook valida schema, evento estável, identidade, valor e método, usa a inbox retomável da etapa 03 e não regride fulfillment em refund tardio. O job de timeout consulta o gateway antes de cancelar.

Em PostgreSQL 16 descartável, duas compras disputaram a última unidade de produto e variante: houve um pedido e uma cobrança, a outra tentativa falhou por estoque, e um retry com a chave vencedora retornou o mesmo pedido sem nova cobrança. O contêiner local foi removido após os testes. Nenhum gateway, transportadora, CEP, banco compartilhado, produção ou credencial real foi acessado.

## Classificação dos achados

`VALID` abaixo significa confirmado no estado inicial da etapa; não significa que o relatório histórico foi usado como prova única. `NOT VERIFIED` não foi promovido a defeito confirmado.

| ID | Severidade / confiança original | Revalidação inicial | Estado desta etapa | Evidência e limite residual |
|---|---|---|---|---|
| CTR-001 / BE-001 / FINAL-001 | BLOCKER / CONFIRMED | VALID | FIXED | UI usa `/api/checkout`, payload compartilhado e envelope único. Build prova o contrato de tipos; E2E em browser real permanece NOT VERIFIED. |
| CTR-002 / BE-004 / FINAL-005 | CRITICAL / CONFIRMED | VALID | FIXED | `POST /api/orders` responde 410 e não cria pedido/estoque; GET foi preservado. O serviço legado sem rota pública continua como dívida de remoção. |
| CTR-003 / DB-004 / parte de BE-005 / FINAL-006 | CRITICAL / CONFIRMED | ALREADY RESOLVED pela etapa 03 | ALREADY RESOLVED | Inbox `RECEIVED/PROCESSING/PROCESSED/FAILED`, claim, lease e retry foram revalidados. E-mail ainda requer outbox separada. |
| CTR-004 / BE-007 / FINAL-008 | CRITICAL / HIGH CONFIDENCE | VALID | DEFERRED, com contenção local FIXED | Resultado ambíguo não cancela nem recobra; workflow exige reconciliação. Falta worker periódico e consulta por referência quando nem o ID da cobrança pôde ser persistido. Comportamento real do Asaas é NOT VERIFIED. |
| CTR-005 / DB-003 / BE-006 / FINAL-007 | CRITICAL / CONFIRMED | ALREADY RESOLVED pela etapa 03 | ALREADY RESOLVED | CAS de pedido e unicidade dos efeitos foram revalidados em PostgreSQL. A fronteira HTTP externa segue coberta pela idempotência desta etapa. |
| CTR-006 / BE-003 / FINAL-004 | CRITICAL / CONFIRMED | VALID | FIXED localmente | Cotação assinada e expirada, vinculada a CEP/tenant/itens; banco é fonte de preço/dimensões; cache inclui total; tabela local resolve CEP e filtra cidade. Tarifas reais e disponibilidade do ViaCEP/provedores são NOT VERIFIED. |
| CTR-007 / BE-007 / FINAL-008 | HIGH / CONFIRMED | VALID | FIXED localmente | Header obrigatório, UUID estável no navegador, fingerprint, unicidade e estados impedem pedido/cobrança repetidos. Idempotência nativa do provedor continua NOT VERIFIED e não é presumida. |
| CTR-008 / DB-005 / FINAL-009 | HIGH / CONFIRMED | ALREADY RESOLVED pela etapa 03 | ALREADY RESOLVED | Restore propaga falha e reverte a transação; regressões foram reexecutadas. |
| CTR-009 / parte de BE-005 / FINAL-006 | HIGH / CONFIRMED | VALID | FIXED localmente | Schema runtime, ID de evento obrigatório, payment ID/referência, valor Decimal e billing type bloqueiam efeitos divergentes. Autenticidade e payload do Asaas real permanecem NOT VERIFIED. |
| CTR-010 / DB-009 / FINAL-004 | HIGH / CONFIRMED | VALID | FIXED no checkout | Cliente informa apenas quantidade; servidor recalcula juros, fee, total e parcela com arredondamento em centavos e persiste `paymentFee`. Regra financeira efetiva do adquirente permanece NOT VERIFIED. |
| CTR-011 / FINAL-008 | HIGH / CONFIRMED | VALID | FIXED | Métodos automáticos sem configuração falham antes de criar/reservar; `WHATSAPP_PIX` não chama gateway. Credencial revogada só pode ser detectada por operação autorizada. |
| CTR-012 / FINAL-008 | HIGH / CONFIRMED | VALID | FIXED localmente | Timeout separa manual/gateway, consulta status e preserva cobrança pendente/ambígua; confirmado transiciona para pago e encerrado cancela via CAS. Semântica real dos status é NOT VERIFIED. |
| CTR-013 / DB-007 / FINAL-014 | HIGH / CONFIRMED | VALID | FIXED localmente | Crédito usa exatamente `Order.pointsEarned`; `operationKey` da etapa 03 impede crédito/estorno repetido. Mudança futura de regra exige snapshot/versionamento. |
| CTR-014 / BE-012 / FINAL-009 | HIGH / CONFIRMED | VALID | DEFERRED parcial | Refund total em PENDING/PAID compensa uma vez; em SHIPPED/DELIVERED não regride pedido e abre reconciliação; chargeback/dunning também abrem exceção. Iniciação de refund, refund parcial e logística reversa dependem de regra externa. |
| CTR-015 / DB-009 / FINAL-004 | MEDIUM / CONFIRMED | VALID | DEFERRED parcial | Checkout usa Decimal e arredonda centavos; gateway recebe a conversão somente no adapter. `Cart.shippingCost` ainda é Float, embora não seja autoridade do checkout, e o restante do domínio não foi migrado integralmente. |
| CTR-016 / DB-008 / FINAL-015 | HIGH / CONFIRMED | VALID | FIXED no fluxo; DB-008 DEFERRED | UI/DTO preservam `variantId`; pedido conecta a variante; reserva condicional atômica baixa pai e variante. A decisão arquitetural sobre pai derivado versus estoque independente continua pendente. |

Não houve achado classificado como `INVALID`. Os correlatos `DB-008`, a parcela global de `DB-009`, a reconciliação automática de `CTR-004`, e as extensões de refund de `CTR-014` permanecem pendentes; por isso a etapa não declara publicação pronta.

## Correções por causa raiz

### 1. Contrato único e caminho único de criação

**Antes:** o formulário chamava uma rota inexistente, os nomes e o envelope divergiam, `variantID` era descartado e `/api/orders` criava pedido sem o workflow financeiro.

**Depois:** `lib/checkout-contract.ts` produz o payload aceito pelo schema; a página preserva `variantId`; o formulário envia uma chave por tentativa lógica para `/api/checkout` e consome `data` no mesmo envelope. `POST /api/orders` foi encerrado sem tocar no GET.

**Prova:** teste de contrato valida o payload compartilhado e a ausência de `shippingCost`/desconto autoritativos; build Next.js compilou as 51 páginas/rotas.

### 2. Autoridade financeira e frete verificável

**Antes:** custo, dimensões, cidade e parcela podiam vir do cliente; cache ignorava valor segurado; tabela local oferecia cidades sem relação com o CEP.

**Depois:** a rota de frete busca produtos do tenant e usa preço/dimensões do banco. A cotação HMAC contém fingerprint de itens, tenant, CEP, serviço, preço, prazo e expiração. O checkout rejeita entrega sem token válido. A chave de cache inclui total em centavos. A regra local resolve CEP em URL fixa, timeout de três segundos, normaliza a cidade e falha fechada. O cliente informa somente a quantidade de parcelas; principal, fee, total e parcela são derivados no servidor.

**Trust boundary:** IDs/quantidades/CEP atravessam navegador → API; dados de catálogo/tenant atravessam banco → calculador; resposta do provedor atravessa integração → cotação assinada; somente o token verificado chega ao sink `Order.shippingCost/total`.

**Prova:** adulteração do token e troca de itens são rejeitadas; a fixture de CEP São Paulo não oferece a regra mais barata do Rio; payload malicioso de preço/frete é ignorado; testes de parcelamento usam o valor calculado no servidor.

### 3. Idempotência e workflow banco–gateway

**Antes:** chave opcional e sem fingerprint; qualquer exceção após o commit cancelava pedido e liberava estoque mesmo com cobrança possivelmente criada.

**Depois:** a API exige `Idempotency-Key` de 16–200 caracteres. `checkoutFingerprint` vincula a chave ao tenant/conteúdo. `PaymentWorkflowStatus` distingue `PROCESSING`, `AWAITING_PAYMENT`, `CONFIRMED`, `DECLINED`, `RECONCILIATION_REQUIRED`, `REFUNDED` e `NOT_REQUIRED`. A intent local é persistida antes do HTTP externo. Só erro determinístico 4xx elegível cancela; timeout, rede, 5xx e falha de persistência mantêm a reserva e bloqueiam reexecução da cobrança.

**Prova de não duplicação:** o gateway fake cria uma cobrança, a gravação seguinte falha, o pedido entra em reconciliação e o retry não chama o gateway de novo. Em PostgreSQL, repetir a chave vencedora devolveu o mesmo `order.id`/`asaasPaymentId`, manteve uma linha de pedido e uma chamada ao gateway.

### 4. Webhook, ordem de eventos e timeout

**Antes:** um token válido bastava para aplicar valor/identidade não reconciliados; eventos sem ID estável podiam repetir; refund tardio não tinha estado financeiro; timeout cancelava só por idade.

**Depois:** allowlist e schema Zod exigem evento estável e valor positivo; referência, payment ID, total Decimal e método são confrontados antes dos efeitos. Evento repetido termina uma vez pela inbox. Pagamento tardio de pedido cancelado, refund pós-expedição, chargeback e dunning geram `RECONCILIATION_REQUIRED`, sem regressão de fulfillment. Timeout consulta o gateway: confirmado paga, pendente preserva, encerrado cancela.

**Prova:** fixtures cobrem evento repetido, valor divergente, payment ID já vinculado a outro pagamento, falha e retry da inbox, refund de PAID e refund após SHIPPED sem regressão. Nenhum webhook real foi enviado.

### 5. Estoque e fidelidade exatamente uma vez

**Antes:** a reserva dependia de leitura prévia e o pai/variante podiam divergir sob corrida; o crédito recalculava pontos sobre base diferente da projeção.

**Depois:** produto e variante usam `UPDATE ... WHERE stock >= quantity`, tenant e vínculo de produto; `count != 1` falha e a transação reverte. A transição PAID credita os pontos já persistidos no pedido. CAS e `operationKey` preservam um efeito por agregado.

**Prova:** dois clientes disputando estoque 1 produziram exatamente um sucesso, um erro de estoque, pai=0, variante=0, um pedido e uma cobrança. As regressões da etapa 03 comprovam um crédito/estorno e rollback integral de restore.

## Cenários solicitados

| Cenário | Resultado local comprovado |
|---|---|
| Última unidade disputada | PostgreSQL real descartável: um pedido/cobrança; segundo checkout rejeitado; pai e variante terminaram em zero. |
| Requisição repetida | Mesma chave e fingerprint retornam o pedido existente; chave com payload diferente retorna conflito; workflow incerto bloqueia nova cobrança. |
| Cobrança criada + falha de persistência | Gateway fake chamado uma vez; estado passa a reconciliação quando possível; retry recebe conflito recuperável e não chama o gateway. |
| Pedido criado + pagamento recusado | Erro determinístico 422 do fake marca `DECLINED`, cancela pelo FSM e executa a compensação transacional. |
| Pagamento confirmado | Webhook fictício válido usa CAS para `PAID`, marca `CONFIRMED` e credita os pontos persistidos exatamente uma vez. |
| Cancelamento | CAS, restore com propagação de erro e operation keys evitam efeitos duplicados. |
| Refund total | PENDING/PAID é cancelado/compensado e marcado `REFUNDED`; evento repetido não reaplica. |
| Refund após envio/entrega | Fulfillment não regride; workflow e nota administrativa exigem reconciliação/logística reversa. |
| Evento fora de ordem/chargeback | Não força transição regressiva; abre reconciliação auditável. |

## Migration pronta para execução externa

`prisma/migrations/20260927083000_payment_workflow_state/migration.sql`:

- cria o enum e os campos de workflow/fingerprint/metadados PIX/fee;
- faz backfill conservador a partir de método, status, payment ID e status Asaas;
- cria índice por tenant/workflow/atualização;
- atualiza a equação do total para incluir `paymentFee` como constraint `NOT VALID`.

Pré-flight obrigatório em ambiente autorizado:

1. Fazer backup e inventariar checksums/migrations, estados de pedidos e divergências entre `status`, `asaasPaymentStatus`, payment ID e gateway.
2. Ensaiar em clone com volume representativo, medir lock de DDL e revisar todas as linhas classificadas como `RECONCILIATION_REQUIRED`.
3. Aplicar a cadeia versionada; não usar `db push`.
4. Verificar total = subtotal − desconto + frete + fee, corrigir exceções, então executar `VALIDATE CONSTRAINT chk_order_total_equation`.
5. Liberar o worker/cron somente depois de conferir os mapeamentos de status no sandbox autorizado.

Não há rollback automático seguro: remover enum/colunas perderia estado de reconciliação. A reversão operacional preferida é interromper a nova versão e fazer forward-fix preservando os campos; qualquer downgrade deve exportar a fila de reconciliação antes de remover estruturas.

## Serviços reais pendentes de verificação autorizada

| Serviço / responsável | O que precisa ser verificado | Estado |
|---|---|---|
| Asaas / financeiro e operações | Criação PIX/cartão/boleto, busca por status/referência, semântica de erros e timeouts, token/payload/retry do webhook, idempotência suportada, refund total/parcial e chargeback. | NOT VERIFIED |
| ViaCEP / plataforma | Timeout, indisponibilidade, grafia/acentuação de municípios e política de fallback; hoje a tabela local falha fechada. | NOT VERIFIED |
| Correios e J&T / logística | Valor segurado, GRIS/ad-valorem, prazos, mudança de tarifa entre cotação e checkout e credenciais válidas. | NOT VERIFIED |
| PostgreSQL de cada ambiente / DBA | Backfill, drift, locks, validação da constraint e reconciliação de linhas históricas. | NOT VERIFIED |
| Cron de timeout / operações | Agenda, lease multi-instância, alertas e execução contra status reais do gateway. | NOT VERIFIED |
| ERP/estoque / produto e operações | Definir se estoque pai é derivado ou independente e reconciliar divergências históricas. | DEFERRED |
| Política financeira/logística reversa | Refund parcial, cancelamento após expedição, devolução física e clawback de pontos. | DEFERRED |

## Comandos e resultados

| Comando / verificação | Resultado |
|---|---|
| `npx vitest run` em cinco arquivos focais de transações/frete | 5 arquivos, 35/35 testes, exit 0. |
| `npx vitest run tests/unit` | 58 arquivos, 431/431 testes, exit 0. |
| `npx tsc --noEmit` | Exit 0. |
| `npx vitest run tests/integration/database-invariants.test.ts tests/integration/transactions-invariants.test.ts` com PostgreSQL local | Tentativa 1: credencial local presumida incorreta, 7 testes não executados. Tentativa 2: usuário padrão omitido ao montar a URL, 7 testes não executados. Tentativa corrigida: 2 arquivos, 7/7 testes, exit 0. |
| `npx prisma migrate deploy` em banco vazio descartável | 24 migrations aplicadas, exit 0. |
| `npx prisma migrate status` | Primeira tentativa falhou por `DIRECT_URL` ausente no processo; repetição com ambas as URLs locais: 24 migrations, schema atualizado, exit 0. |
| `npm run lint` | Exit 0, 0 erros e 20 warnings preexistentes/fora do escopo; nenhum foi convertido em sucesso silencioso. |
| `npm run build` | Exit 0; Next.js 16.3.5, 51 páginas/rotas. |
| `git diff --check` antes da documentação final | Exit 0; apenas avisos informativos LF/CRLF. |
| Remoção do PostgreSQL descartável | `docker rm -f codex-remediation04-postgres`; contêiner removido, dados locais efêmeros não recuperáveis. |

O aviso do Vitest sobre futura mudança de `configLoader` foi preservado como dívida de tooling. Os warnings globais do ESLint incluem `<img>`, callbacks declarados após uso e dependências de hooks em áreas não corrigidas nesta etapa.

## Arquivos da etapa

### Produto e configuração

- `.env.example`
- `app/api/checkout/route.ts`
- `app/api/freight/calculate/route.ts`
- `app/api/orders/route.ts`
- `app/api/webhooks/asaas/route.ts`
- `app/checkout/page.tsx`
- `components/checkout/CheckoutForm.tsx`
- `lib/cep.ts`
- `lib/checkout-contract.ts`
- `lib/freight-quote.ts`
- `lib/validators/checkout.validators.ts`
- `prisma/schema.prisma`
- `prisma/migrations/20260927083000_payment_workflow_state/migration.sql`
- `services/checkout.service.ts`
- `services/freight/orchestrator.service.ts`
- `services/freight/providers/custom-table.provider.ts`
- `services/inventory.service.ts`
- `services/loyalty.service.ts`
- `services/order-timeout.service.ts`
- `services/order.service.ts`
- `services/payment/installment.service.ts`
- `types/freight.ts`
- `types/loyalty.types.ts`

### Testes

- `tests/integration/transactions-invariants.test.ts`
- `tests/unit/transactions-remediation.test.ts`
- regressões atualizadas de checkout, gateway, webhook, timeout, estoque, CPF/CNPJ e fidelidade listadas no diff da etapa.

**Commit:** nenhum. Alterações anteriores existentes no workspace foram preservadas e não foram revertidas.

## Risco residual e critério de encerramento

Risco residual da etapa: **HIGH**, principalmente pela ausência de worker automático de reconciliação, validação do Asaas real, rollout da migration, refund parcial/logística reversa e decisão da fonte de estoque.

A etapa só pode ser considerada encerrada em ambiente real quando: migration e constraint forem validadas; sandbox provar uma cobrança por chave e retries/out-of-order; reconciliação convergir intents ambíguas; timeout não cancelar cobrança ativa; refund/chargeback seguirem política aprovada; e monitoramento alertar `PROCESSING`/`RECONCILIATION_REQUIRED` envelhecidos. Esses critérios não foram executados fora do ambiente local.
