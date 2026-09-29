# Correções de banco e integridade — etapa 03

**Data:** 2026-09-26  
**Escopo:** `DATABASE-AUDIT.md`, correlações de `COMMERCE-TRANSACTIONS-AUDIT.md`, schema, migrations, fluxos transacionais e testes locais.  
**Estado da entrega:** correções locais concluídas; publicação e validação de dados reais continuam bloqueadas.

## Resultado executivo

O histórico de 23 migrations foi aplicado do zero em PostgreSQL 16 descartável e terminou sem diferença contra `prisma/schema.prisma`. Foram corrigidos o drift estrutural, a unicidade residual de itens, o compare-and-set de status, o commit parcial de estoque, o ciclo de vida da inbox de webhook, a unicidade de e-mail por tenant e parte das invariantes físicas de tenant, ledger e valores monetários.

Nenhuma migration ou consulta foi executada em produção. Constraints sobre dados legados foram adicionadas como `NOT VALID`: elas bloqueiam novas escritas inválidas, mas exigem inventário, correção e `VALIDATE CONSTRAINT` em cada ambiente autorizado.

## Classificação dos achados

| ID | Revalidação no estado inicial | Estado desta etapa | Evidência / limite residual |
|---|---|---|---|
| DB-001 | VALID | FIXED localmente; externo NOT VERIFIED | Migration de reconciliação; cadeia vazia + diff sem diferenças. Drift de ambientes existentes não foi consultado. |
| DB-002 | VALID | FIXED | Índice residual removido; pedido real com duas variantes persistiu duas linhas. |
| DB-003 / CTR-005 | VALID | FIXED | `updateMany` condicionado ao status anterior; concorrência real produziu um sucesso e um `CONFLICT`, com um estorno/audit log. |
| DB-004 / CTR-003 | VALID | FIXED no processamento local | Inbox `RECEIVED/PROCESSING/PROCESSED/FAILED`, lease e retry. Reconciliação periódica com Asaas continua pendente. |
| DB-005 / CTR-008 | VALID | FIXED | Falhas de restore propagam; PostgreSQL comprovou rollback do primeiro incremento quando a variante falhou. |
| DB-006 | VALID | DEFERRED parcial | FKs compostas protegem Product, Order e Loyalty por User+Loja. Cart, Address e OrderItem→Product ainda não carregam tenant suficiente para garantia física completa. |
| DB-007 / parte de CTR-013 | VALID | DEFERRED parcial | `operationKey` única por pedido/tipo, checks de sinal/saldo e prova de retry sem duplo crédito. Política de clawback e base bruto/líquido seguem pendentes. |
| DB-008 | VALID | DEFERRED | A escolha entre estoque pai derivado ou fonte independente exige decisão de domínio e reconciliação ERP. |
| DB-009 / CTR-010 / parte de CTR-015 | VALID | DEFERRED parcial | Total/desconto/parcelas protegidos; valor de parcela do cliente é ignorado e recalculado em Decimal. Juros e valor final retornado pelo provedor ainda exigem contrato financeiro. |
| DB-010 | VALID | DEFERRED | Migrations históricas não foram reescritas. Upgrade de snapshots intermediários não vazios exige ensaio por versão. |
| DB-011 | VALID | FIXED | Chave global removida após criação da composta; teste aceita o mesmo e-mail em duas lojas e rejeita repetição na mesma. |
| DB-012 | VALID | DEFERRED | Carrinho ACTIVE e CPF/CNPJ precisam de política para guests/dados duplicados antes de índice único. |
| DB-013 | VALID | DEFERRED | Cursor composto e paginação da vitrine pertencem à etapa de arquitetura/performance. |
| DB-014 | VALID | DEFERRED | Expiração e relatórios continuam sem partição/claim e com N+1. |
| DB-015 | NOT VERIFIED (SUSPECTED no relatório) | NOT VERIFIED | Nenhum índice especulativo foi criado. Faltam volume representativo e `EXPLAIN (ANALYZE, BUFFERS)`. |
| DB-016 | NOT VERIFIED | NOT VERIFIED | RLS/ACL de Supabase não foram consultados nem alterados. |
| DB-017 | VALID | DEFERRED | O teste PostgreSQL foi criado, mas o workflow de CI ainda não provisiona o serviço. |

Correlatos transacionais não citados na tabela (`CTR-001`, `CTR-002`, `CTR-004`, `CTR-006`, `CTR-007`, `CTR-009`, `CTR-011`, `CTR-012`, `CTR-014`, `CTR-016`) permanecem para a etapa de transações. Esta etapa não os converte em resolvidos.

## Correções implementadas

### 1. Histórico reproduzível e regras estruturais

`20260926194600_reconcile_schema_and_core_constraints`:

- cria seis tabelas ausentes do histórico e os campos/enums requeridos pelo client atual;
- alinha tipos Decimal, nulabilidade histórica e FKs `SET NULL` de snapshot;
- remove `OrderItem_orderId_productId_key`;
- cria `User(email, lojaID)` antes de remover a unicidade global;
- preserva os índices versionados usados por consultas/relações, sem adicionar candidatos especulativos de DB-015;
- executa em transação PostgreSQL.

Evidência antes: após as 20 migrations originais, `prisma migrate diff` listou seis tabelas, enums, campos, FKs, tipos e unicidades divergentes. Evidência depois: as 23 migrations aplicadas do zero produziram `No difference detected`.

### 2. Transição de pedido e estoque exatamente uma vez no agregado

`updateOrderStatus` agora reivindica a transição com `WHERE id + status anterior (+ loja)` e verifica `count = 1` antes de estoque, pontos e auditoria. Perda da corrida retorna `CONFLICT`, exposto como HTTP 409 nas rotas administrativas/de pedido. A confirmação de entrega usa o mesmo padrão com owner+tenant+status.

`InventoryService.restoreStock` não suprime mais exceções. O teste PostgreSQL induziu `P2025` na variante após incrementar o produto e comprovou que o estoque do produto continuou 8 após o rollback.

Na corrida de dois cancelamentos de um mesmo pedido PENDING:

- um resultado foi sucesso e o outro `CONFLICT`;
- produto e variante passaram de 8 para 10, não 12;
- apenas um AuditLog foi criado.

### 3. Inbox durável de webhook

`20260926195700_webhook_inbox_state` adiciona status, tentativas, erro, lock e timestamps. Linhas históricas recebem `PROCESSED` para preservar a semântica anterior; isso não prova que seus efeitos antigos terminaram e deve ser reconciliado externamente.

O handler:

- só responde `ALREADY_PROCESSED` para status `PROCESSED`;
- faz claim atômico de `RECEIVED/FAILED` ou lock abandonado há cinco minutos;
- responde 202 `PROCESSING` para concorrente em andamento;
- marca `FAILED` com erro limitado quando qualquer efeito falha;
- marca `PROCESSED` somente depois dos efeitos locais;
- verifica o resultado das transições de refund/expiração.

O simulador local opt-in segue o mesmo ciclo. O e-mail continua assíncrono e não faz parte da garantia exatamente uma vez.

### 4. Tenant, ledger e dinheiro

`20260926200500_tenant_and_ledger_invariants`:

- cria chave alternativa `User(id, lojaID)` e FKs compostas `NOT VALID` para Product, Order, LoyaltyWallet e LoyaltyTransaction;
- adiciona checks `NOT VALID` para equação do total, desconto, pontos, parcelas, saldo/versionamento e sinal do ledger;
- adiciona `LoyaltyTransaction.operationKey` única; operações EARN/REDEEM/REFUND derivam a chave de pedido+tipo.

O checkout calcula `installmentValue = total / installments` com `Prisma.Decimal`, ignora o valor homônimo do cliente e não o encaminha como autoridade ao adapter. O teste enviou `0,01` para total 120/3 e persistiu/retornou 40.

## Migrations prontas para execução externa

| Migration | Pré-condição | Risco e controle | Encerramento objetivo |
|---|---|---|---|
| `20260926194600_reconcile_schema_and_core_constraints` | Inventariar checksum/estado real e diff por ambiente. | Lock de DDL; cria tabelas/colunas/índices e altera FKs. Ensaiar em clone/snapshot. | `migrate deploy` + diff vazio + smoke CRUD. |
| `20260926195700_webhook_inbox_state` | Contar eventos e preservar payloads. | Eventos antigos são classificados como processados por compatibilidade; requer reconciliação com pedidos/gateway. | Nenhum evento novo sem status; FAILED retomável; reconciliação histórica registrada. |
| `20260926200500_tenant_and_ledger_invariants` | Rodar consultas de divergência abaixo. | FKs/checks entram `NOT VALID`: novas escritas protegidas, legado ainda não validado. | Todas as consultas retornam zero e todos os `VALIDATE CONSTRAINT` concluem. |

Consultas mínimas de pré-flight em ambiente autorizado:

```sql
SELECT o.id FROM "Order" o JOIN "User" u ON u.id = o."userID" WHERE o."lojaID" <> u."lojaID";
SELECT p.id FROM "Product" p JOIN "User" u ON u.id = p."userID" WHERE p."lojaID" <> u."lojaID";
SELECT w.id FROM "LoyaltyWallet" w JOIN "User" u ON u.id = w."userID" WHERE w."lojaID" <> u."lojaID";
SELECT t.id FROM "LoyaltyTransaction" t JOIN "User" u ON u.id = t."userID" WHERE t."lojaID" <> u."lojaID";
SELECT id FROM "Order" WHERE total <> subtotal - "pointsDiscountValue" + "shippingCost";
SELECT id FROM "LoyaltyWallet" WHERE balance < 0 OR pending < 0 OR "lifetimeEarn" < 0 OR version < 0;
SELECT "orderId", type, count(*) FROM "LoyaltyTransaction"
WHERE "orderId" IS NOT NULL GROUP BY "orderId", type HAVING count(*) > 1;
```

Backfill/correção deve ser definido por registro, com backup e decisão de negócio. Não se deve trocar tenant, total ou saldo automaticamente. Depois de zerar divergências, executar `ALTER TABLE ... VALIDATE CONSTRAINT` para as constraints listadas na migration.

Reversão operacional:

- antes de deploy: snapshot restaurável e registro de checksums;
- se falhar durante cada arquivo, o `BEGIN/COMMIT` reverte o arquivo inteiro;
- depois do commit, preferir forward-fix; remover checks/FKs/colunas pode reabrir escrita inválida ou perder metadados da inbox;
- rollback de aplicação deve preservar as novas colunas/tabelas, que são compatíveis com leitura antiga; não apagar eventos/operation keys;
- restauração de snapshot é a única reversão segura para perda/corrupção de dados.

## Verificações executadas

| Comando / prova | Resultado |
|---|---|
| PostgreSQL 16 local em container dedicado e rotulado | Somente `127.0.0.1:61411`, banco descartável; nenhum serviço real. |
| `prisma migrate reset --force --skip-seed` | 23 migrations aplicadas do zero, exit 0. |
| `prisma migrate diff --from-url ... --to-schema-datamodel prisma/schema.prisma --exit-code` | `No difference detected`, exit 0. |
| `prisma validate` / `prisma generate` | Exit 0. |
| `tests/integration/database-invariants.test.ts` | 1 arquivo, 6/6 testes com PostgreSQL real, exit 0. |
| Validação local manual das FKs/checks `NOT VALID` | 12 constraints validadas; consulta de catálogo retornou `convalidated = true`. |
| `vitest run tests/unit` | 57 arquivos, 421/421 testes, exit 0. |
| `tsc --noEmit` | Exit 0. |
| ESLint direcionado aos arquivos desta etapa | Exit 0. |
| `npm run build` | Exit 0; Next.js 16.3.5, 51 páginas. |
| `git diff --check` | Exit 0; somente avisos informativos de LF/CRLF. |

Uma execução adicional de toda a pasta `tests/integration` falhou: as três suites legadas chamam `seedTestData(lojaID)` sem criar a Loja/Product exigidos e usam `cleanupTestDb()` global/destrutivo em paralelo. A interferência também removeu fixtures da nova suite. Isso não foi mascarado como sucesso; a nova suite foi reexecutada isoladamente após reset limpo e passou 6/6. Corrigir o harness compartilhado permanece parte de DB-017.

## Arquivos desta etapa

- Schema/migrations: `prisma/schema.prisma` e as três migrations `20260926194600`, `20260926195700`, `20260926200500`.
- Produto: status/admin/confirmação de pedido, estoque, checkout, fidelidade e webhooks Asaas/simulador.
- Tipos: `types/admin.types.ts`.
- Regressões: `tests/integration/database-invariants.test.ts` e testes unitários correlatos de checkout, estoque, pedido, fidelidade e webhook.
- Commit: nenhum.

## Limitações, serviços externos e risco residual

Dependem de verificação posterior em ambiente autorizado:

- PostgreSQL/Supabase reais: drift, checksums, volume, locks, dados cross-tenant, saldos, totais, ACLs e RLS;
- Asaas: eventos históricos, eventos fora de ordem, valor/identidade da cobrança, retry e reconciliação;
- Nuvemshop/ERP: fonte de verdade e reconciliação de estoque;
- CI: serviço PostgreSQL isolado, cadeia de migrations, diff e suite sem fixtures globais concorrentes.

Risco residual global: **HIGH**. DB-008, DB-010, DB-012–DB-017 e partes de DB-006/007/009 permanecem; fluxos financeiros distribuídos correlatos continuam para a etapa de transações. Nenhum estado foi marcado como aprovado ou pronto para produção.


## 2026-09-29 — execução dos prompts atualizados e correções locais

**IDs:** DB-006/013/014, FINAL-005/022. Nova migration aditiva `prisma/migrations/20260929170000_commerce_child_ownership/migration.sql:1` usa preflight, locks, triggers de filhos e proteção contra mudança de pai. Impõe tenant de produto/itens, produto da variante, dono do endereço, defaultAddress e carrinho de origem. Não reescreve nem apaga dados. Schema Prisma não ganhou modelos paralelos.

Banco descartável com tmpfs, sem mounts, porta127.0.0.1:55439: 29 migrations aplicadas; diff sem diferenças. Segunda base descartável recebeu as 28 anteriores e uma inconsistência fictícia; a nova migration abortou com COMMERCE_TENANT_PREFLIGHT_FAILED, preservou 1 linha e instalou 0 triggers novos. O diff Prisma não inspeciona os triggers customizados; seus negativos/concorrência são verificados por `commerce-child-ownership.test.ts`.

DB-006 e DB-013: **FIXED VERIFIED**, LOW local; FINAL-005 corrigido. Testes cobrem referências cruzadas, variante de produto errado na mesma loja, reparenting concorrente, rollback de auditoria e desempate de páginas. DB-014 parcial: lote limitado, mas checkpoint durável/duração de job não implementados. Upgrade de dados reais, RLS/grants e reconciliação de legado não ensaiados, mantendo FINAL-003/034.

**Validação consolidada:** [complemento de FINAL-VALIDATION](FINAL-VALIDATION.md#2026-09-29--execução-dos-prompts-atualizados-e-correções-locais). Histórico acima preservado; homologação externa não inferida.
