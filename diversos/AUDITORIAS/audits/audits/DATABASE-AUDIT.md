# Auditoria de Banco de Dados e Integridade — Etapa 02/15

**Data da análise:** 2026-09-25  
**Escopo:** banco, ORM, schema, migrations, integridade, consultas, transações, concorrência e compatibilidade de deploy  
**Repositório analisado:** estado local disponível na data acima  
**Regra desta etapa:** nenhum código de produto foi alterado; este relatório é o único artefato criado nesta etapa.

## 1. Resumo executivo

O banco declarado é **PostgreSQL**, acessado por **Prisma 5.22**. A aplicação mantém `DATABASE_URL` para o runtime e `DIRECT_URL` para operações diretas/migrations. Valores monetários centrais usam `Decimal`, existem chaves estrangeiras para boa parte do modelo, o checkout canônico recalcula preço de produto no servidor e reserva estoque na mesma transação que cria o pedido. Esses são controles positivos observados.

O estado versionado, porém, **não é publicável com segurança**. O histórico de migrations não reconstrói `schema.prisma`: seis modelos não têm `CREATE TABLE`, vários campos recentes não têm migration, o enum `DeliveryType` não contém `NONE` no SQL, `Cart.shippingCost` diverge de tipo e permanecem índices únicos incompatíveis com o modelo atual. Além disso, transições concorrentes podem duplicar estornos/créditos, o webhook registra sucesso de processamento antes dos efeitos, e o estorno de estoque captura erros e permite commit parcial.

### Contagem de achados

| Severidade | Quantidade |
|---|---:|
| BLOCKER | 1 |
| CRITICAL | 4 |
| HIGH | 6 |
| MEDIUM | 6 |
| LOW | 0 |
| INFORMATIONAL | 0 |
| **Total** | **17** |

### Bloqueios de publicação

1. **DB-001:** o histórico de migrations não produz o schema exigido pelo código.
2. **DB-002:** uma unicidade residual impede múltiplas variantes do mesmo produto no pedido.
3. **DB-003:** transições concorrentes de pedido não fazem compare-and-set e podem repetir estoque/pontos.
4. **DB-004:** eventos de pagamento são marcados como processados antes dos efeitos de domínio.
5. **DB-005:** falhas de estorno de estoque são engolidas e podem resultar em cancelamento com restauração parcial.

Os achados HIGH **DB-006 a DB-011** também devem ser tratados antes de liberar tráfego real, pois atingem isolamento multi-tenant, saldo, estoque, valor financeiro e implantação.

## 2. Metodologia, fontes e limites

### 2.1 Procedimento

- Leitura de `AGENTS.md`, `package.json`, lockfile, configuração do Prisma/Vitest, workflow de CI e documentação técnica.
- Leitura integral de `prisma/schema.prisma` e das 20 migrations versionadas em diretórios.
- Comparação estática entre modelos Prisma e tabelas criadas pelo SQL versionado.
- Rastreamento de consultas e mutações em `services/`, `app/api/`, `lib/` e testes relevantes.
- Revisão de transações de checkout, pedido, estoque, pagamento, pontos, cancelamento, expiração e confirmação de entrega.
- Associação entre filtros/ordenação reais e índices declarados. Onde seria necessário plano real, a conclusão foi marcada como hipótese e nenhum índice foi prescrito como comprovadamente necessário.
- Nenhum banco, gateway, storage ou serviço externo foi acessado; nenhum valor de `.env` foi lido ou impresso.

### 2.2 Evidências reproduzíveis

Execute a partir da raiz do repositório:

| Comando | Resultado observado |
|---|---|
| `rg --files prisma services app lib tests` | Inventário de schema, migrations, serviços, handlers e testes. |
| `rg -n '^(CREATE TABLE|ALTER TABLE|CREATE (UNIQUE )?INDEX|DROP COLUMN|ADD CONSTRAINT)' prisma/migrations -g '*.sql'` | Evolução estática de tabelas, constraints e índices. |
| Comparação PowerShell de `^model` com `CREATE TABLE` | 22 modelos no schema; 16 tabelas criadas; 6 modelos ausentes das migrations. |
| `rg -n 'findMany|findFirst|findUnique|aggregate|groupBy|update|upsert|\$transaction' services app/api lib` | Mapa de consultas e fronteiras transacionais. |
| `rg -n 'skip:|cursor:|take:|orderBy:' services app/api` | Estratégias de paginação e ordenação. |
| `rg -n 'isolationLevel|Serializable|RepeatableRead|FOR UPDATE|updateMany' services app lib` | Nenhum isolamento explícito, lock de linha ou compare-and-set encontrado nos fluxos críticos. |
| `npm.cmd run test:integration` | Não executou: `vitest` ausente. |
| `npm.cmd run build` | Não executou: CLI `prisma` ausente. |
| `node --version` / `npm.cmd --version` | Node `v24.16.0`; npm `11.13.0`. |

### 2.3 Limitações

- `node_modules` não existe. Por isso não foi possível executar `prisma validate`, gerar o client, rodar testes, build ou consultar os guias locais obrigatórios de Next.js em `node_modules/next/dist/docs/`.
- Não foi instalado pacote algum, pois a entrega autoriza somente a criação deste relatório.
- Não havia PostgreSQL descartável configurado; migrations não foram aplicadas, e não foram executados `EXPLAIN`, testes de lock, rollback ou concorrência real.
- O estado de migrations, constraints, índices, RLS e volume de dados de produção não foi consultado.
- Ausência de teste é tratada como lacuna de verificação, não como prova autônoma de falha.

## 3. Banco e ORM reais

| Item | Evidência | Conclusão |
|---|---|---|
| Banco | `prisma/schema.prisma:8-12` | PostgreSQL. |
| ORM | `package.json`, `prisma/schema.prisma:4-6` | Prisma Client/CLI 5.22. |
| Conexões | `prisma/schema.prisma:10-11` | `DATABASE_URL` e `DIRECT_URL`. |
| Pool/runtime | `lib/prisma.ts:8-25`; documentação técnica | Singleton por processo; documentação declara pooler no runtime, não verificado externamente. |
| Tipos monetários | `prisma/schema.prisma:125,202,288,297-307,369,458,540-543` | Predominantemente `Decimal`; há divergências de precisão e `Cart.shippingCost` está como `Float`. |
| Identificadores | schema inteiro | UUID na maioria dos agregados; `cuid()` em histórico e regra de frete; `orderNumber` serial global. |
| Multi-tenant | `lojaID` em entidades principais | Isolamento depende majoritariamente da aplicação; não há composição de tenant nas FKs centrais. |

## 4. Comparação schema × migrations

### 4.1 Resultado estrutural

Modelos declarados sem criação em nenhuma migration versionada:

- `Brand`
- `CategoryTag`
- `ProductCategoryTag`
- `StockSyncLog`
- `JtExpressGeocom`
- `JtExpressRate`

Outras divergências confirmadas:

| Tema | Schema atual | Histórico SQL |
|---|---|---|
| Delivery | `DeliveryType` inclui `NONE` (`schema.prisma:258-262`) | Enum criado somente com `DELIVERY` e `PICKUP` (`20260513203715_/migration.sql:18-19`). |
| E-mail | `@@unique([email, lojaID])` (`schema.prisma:93`) | Mantém `UNIQUE(email)` global e nunca cria a composta (`20260423214204...:104-108`). |
| Itens de pedido | Apenas índices simples (`schema.prisma:347-349`) | Mantém `UNIQUE(orderId, productId)` (`20260513203715_...:99-100`). |
| Frete do carrinho | `Float?` (`schema.prisma:184`) | Convertido para `DECIMAL(10,2)` (`20260522000000...:9`). |
| Campos recentes | Loja, Product e Order contêm integração, dimensões, frete, pagamento e sync | Diversos campos não aparecem em `ALTER TABLE` versionado. |
| Índices | Schema não declara vários índices de `20260523000000` | Um futuro `prisma migrate dev` pode propor remoção ou produzir novo drift. |
| RLS | Não expresso no schema | SQL solto diretamente em `prisma/migrations/supabase_rls_hardening.sql`, fora de uma pasta de migration Prisma. |

`prisma validate` validaria a sintaxe do schema, mas não demonstraria equivalência com um banco criado pelas migrations. A verificação adequada é aplicar o histórico em banco vazio e executar `prisma migrate diff`/introspecção contra o schema esperado.

### 4.2 Constraints positivas observadas

- Preço e estoque não negativos para Product/ProductVariants; quantidade positiva em CartItem/OrderItem; subtotal, total e frete não negativos em `20260522000000_monetary_decimal_and_check_constraints`.
- Unicidade de `CartItem(cartID, variantID)`, `LoyaltyWallet(lojaID, userID)`, `Order.orderNumber`, `Order.asaasPaymentId`, `Order.idempotencyKey` e evento de webhook.
- FKs com cascade em carrinho, variantes e entidades de fidelidade; OrderItem preserva snapshot textual de nome/preço.
- Preço de produto é relido do banco no checkout canônico (`services/checkout.service.ts:178-236`).

Esses controles são úteis, mas não cobrem as relações aritméticas, de tenant e de idempotência descritas nos achados.

## 5. Mapa transacional observado

| Fluxo | Fronteira transacional | Fora da transação / risco |
|---|---|---|
| Checkout canônico | Validação de itens, reserva, usuário/endereço, pedido e débito de pontos em `prisma.$transaction` (`checkout.service.ts:115-472`) | Cobrança e atualização de metadados do gateway ocorrem depois (`480-665`). |
| Pedido por carrinho | Reserva, criação do pedido e conclusão do carrinho (`order.service.ts:41-106`) | Carrinho/endereço são lidos antes; preço é snapshot do carrinho. |
| Status de pedido | Update, audit log, pontos/estoque em transações locais (`order.service.ts:312-438`) | Estado original é lido antes, sem condição no `UPDATE`. |
| Webhook Asaas | Não há transação comum | Evento é inserido antes de localizar/atualizar pedido (`webhooks/asaas/route.ts:133-239`). |
| Pontos | Operações individuais usam transação | Ledger não possui chave idempotente; várias operações fazem leitura anterior ao update. |
| Confirmação de entrega | Update + AuditLog em transação array (`confirm-delivery/route.ts:74-107`) | Elegibilidade foi lida antes e update não condiciona o status anterior. |
| Expiração | Uma transação por carteira | Varredura e cálculo ficam fora; não há claim/lease nem paginação. |

## 6. Achados

### DB-001 — Histórico de migrations não reconstrói o schema usado pelo código

- **Severidade:** BLOCKER
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `prisma/schema.prisma:14-562`; `prisma/migrations/20260513203715_/migration.sql:18-100`; `prisma/migrations/20260522000000_monetary_decimal_and_check_constraints/migration.sql:7-68`; diretórios em `prisma/migrations/`.
- **Fluxo e condição de manifestação:** criação de ambiente novo, recuperação de desastre, preview environment ou deploy que execute o histórico versionado e em seguida rode o código/client gerado pelo schema atual.
- **Evidência observada:** a comparação estática encontrou 22 modelos no schema e somente 16 tabelas criadas. `Brand`, `CategoryTag`, `ProductCategoryTag`, `StockSyncLog`, `JtExpressGeocom` e `JtExpressRate` nunca são criados. `DeliveryType.NONE`, campos recentes e constraints do schema também não são migrados; há divergência `Float`/`DECIMAL` em Cart.
- **Impacto:** migrations podem concluir sem disponibilizar tabelas/colunas exigidas, ou falhar durante boot/deploy. Catálogo, dashboard, frete, pedidos e sincronização podem retornar erro em runtime; não há restauração reprodutível do banco.
- **Correção proposta:** gerar uma migration de reconciliação a partir de um banco descartável criado pelo histórico, revisar SQL manualmente, dividir operações destrutivas e aplicar via `prisma migrate deploy`. Adicionar gate que cria banco vazio, aplica todas as migrations e exige diff vazio contra `schema.prisma`.
- **Teste de regressão:** em PostgreSQL efêmero, aplicar migrations do zero, executar `prisma migrate diff --from-url ... --to-schema-datamodel prisma/schema.prisma --exit-code`, gerar client e rodar smoke CRUD de todos os modelos.
- **Risco residual:** bancos já existentes podem ter drift diferente entre ambientes; será necessário inventário por ambiente e reconciliação específica, sem usar `db push` como substituto de migration revisada.

### DB-002 — Constraint residual impede duas variantes do mesmo produto no pedido

- **Severidade:** CRITICAL
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `prisma/migrations/20260513203715_/migration.sql:93-100`; `prisma/schema.prisma:332-350`; `services/checkout.service.ts:191-236,434-443`.
- **Fluxo e condição de manifestação:** um pedido inclui, por exemplo, uma camiseta tamanho M e a mesma camiseta tamanho G. Ambos os itens compartilham `productId`, mas têm `productVariantsId` distintos.
- **Evidência observada:** a migration cria `UNIQUE(orderId, productId)` e nenhuma posterior o remove. O schema atual não declara essa unicidade e o checkout cria uma linha por item/variante. O segundo item viola a constraint apesar de representar uma compra válida.
- **Impacto:** checkout transacional inteiro é revertido para carrinhos legítimos; comportamento difere conforme o banco tenha sido criado por migration ou sincronizado por outro método.
- **Correção proposta:** remover a unicidade residual. Se a regra for uma linha por variante, usar unicidade condicional/coerente com `productVariantsId` e definir a regra para produtos sem variante; alternativamente consolidar itens iguais antes da gravação.
- **Teste de regressão:** aplicar migrations em banco vazio e criar pedido com duas variantes do mesmo produto, validando duas linhas, subtotal correto e reserva de cada variante; repetir item idêntico e validar a política escolhida.
- **Risco residual:** pedidos existentes podem conter duplicidades lógicas que precisam ser analisadas antes de adicionar qualquer nova unicidade.

### DB-003 — Transições de pedido não são compare-and-set e duplicam efeitos sob concorrência

- **Severidade:** CRITICAL
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `services/order.service.ts:265-310,312-413`; `app/api/orders/[id]/confirm-delivery/route.ts:14-24,41-107`; `prisma/schema.prisma:264-330,446-467`.
- **Fluxo e condição de manifestação:** duas requisições leem o mesmo pedido PENDING e tentam confirmar pagamento ou cancelar simultaneamente; também pode ocorrer entre webhook, cron e administrador.
- **Evidência observada:** o estado é lido antes da transação. Dentro dela, `order.update({ where: { id } })` não exige o status previamente observado nem versão. As duas transações podem atualizar a mesma linha em sequência e executar novamente crédito de pontos, refund ou restauração de estoque. Não há `isolationLevel`, `FOR UPDATE`, coluna de versão ou `updateMany` condicional.
- **Impacto:** saldo/ledger duplicado, estoque inflado, auditoria contraditória e resultado dependente da ordem de commit.
- **Correção proposta:** executar transição com compare-and-set (`WHERE id=? AND status=?`, verificando `count=1`) dentro da mesma transação; tornar os efeitos idempotentes por chave de origem; avaliar `Serializable` ou lock de linha para o agregado completo.
- **Teste de regressão:** em PostgreSQL real, disparar dezenas de transições simultâneas para o mesmo pedido e provar exatamente uma mudança, um efeito de estoque, um lançamento de pontos e histórico coerente.
- **Risco residual:** integrações externas permanecem distribuídas; reconciliação e idempotência ponta a ponta ainda serão necessárias.

### DB-004 — Evento de webhook é persistido como processado antes dos efeitos

- **Severidade:** CRITICAL
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `app/api/webhooks/asaas/route.ts:133-169,171-239`; `prisma/schema.prisma:552-562`; `prisma/migrations/20260916000000_add_asaas_and_delivery_confirmation/migration.sql:16-30`.
- **Fluxo e condição de manifestação:** a inserção de `PaymentWebhookEvent` funciona, mas a busca do pedido, update de metadados, transição para PAID ou crédito de pontos falha.
- **Evidência observada:** `PaymentWebhookEvent` é criado antes dos efeitos e `processedAt` recebe default imediato. Qualquer retry encontra `eventId` e retorna `ALREADY_PROCESSED`. O modelo não tem estado RECEIVED/PROCESSING/PROCESSED/FAILED, tentativas ou erro; também não há transação comum com a mudança do pedido.
- **Impacto:** pagamento confirmado externamente pode permanecer PENDING localmente, com estoque/pontos/e-mail inconsistentes e sem retry automático.
- **Correção proposta:** persistir inbox idempotente com status e payload, processar claim + efeitos em transação local, marcar PROCESSED somente depois do commit e permitir retry de FAILED. Manter reconciliação periódica com o gateway.
- **Teste de regressão:** injetar falha após inserir o evento e antes/depois de cada efeito; reenviar o mesmo `eventId` e comprovar conclusão única e recuperável.
- **Risco residual:** confirmação no gateway e commit local não podem ser uma única transação ACID; a reconciliação continua obrigatória.

### DB-005 — Estorno de estoque engole falhas e permite commit parcial

- **Severidade:** CRITICAL
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `services/inventory.service.ts:88-128`; `services/order.service.ts:359-410`.
- **Fluxo e condição de manifestação:** cancelamento tenta devolver estoque e um update de Product ou ProductVariants falha por ausência da linha, erro transitório ou constraint.
- **Evidência observada:** cada update de restauração está dentro de `try/catch` que apenas executa `console.warn` e continua. A transação de cancelamento pode então gravar status CANCELLED, audit log e refund de pontos e fazer commit mesmo com somente parte do estoque restaurada.
- **Impacto:** divergência permanente entre estoque pai/variante e perda ou criação artificial de disponibilidade; nova execução pode duplicar a parcela já restaurada.
- **Correção proposta:** falhar a transação inteira em qualquer erro inesperado; tratar explicitamente somente casos idempotentes com registro durável. Adicionar chave/registro de movimentação de estoque vinculada a pedido e tipo para tornar reserve/restore exatamente uma vez.
- **Teste de regressão:** provocar falha no segundo update e verificar rollback do primeiro, do status e dos efeitos; repetir cancelamento e comprovar ausência de dupla restauração.
- **Risco residual:** registros históricos que apontem para variante removida precisam de política explícita de restauração no estoque pai.

### DB-006 — Banco não garante coerência multi-tenant entre relações centrais

- **Severidade:** HIGH
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `prisma/schema.prisma:63-99,121-157,178-210,264-350,426-467`; `services/order.service.ts:17-108`; `services/cart.service.ts:114-180`.
- **Fluxo e condição de manifestação:** inserção por caminho alternativo, bug de aplicação, script ou concorrência associa Order a uma loja e User/Product de outra, ou cria wallet/ledger cujo usuário não pertence à loja informada.
- **Evidência observada:** FKs validam IDs isolados, não pares com `lojaID`. `Order(lojaID,userID)`, OrderItem→Product, CartItem→Product e LoyaltyWallet/Transaction não têm FK composta que comprove tenant comum. O fluxo `createOrderFromCart` aceita `lojaID` separado e não revalida a loja de todos os itens.
- **Impacto:** persistência aceita pedidos, pontos e estoque cross-tenant; relatórios e autorização podem apresentar dados incorretos mesmo quando cada FK individual é válida.
- **Correção proposta:** definir invariantes de tenant no modelo físico com chaves alternativas compostas e FKs compostas onde viável; nos demais casos, encapsular escrita em uma única função transacional e remover caminhos paralelos. Corrigir dados existentes antes de ativar constraints.
- **Teste de regressão:** tentar combinações cross-tenant por Prisma e SQL e exigir rejeição do banco; testar todos os caminhos de criação de pedido/carrinho/wallet.
- **Risco residual:** tabelas globais legítimas, como tarifas de transportadora, precisam ser explicitamente classificadas para não receber tenant artificial.

### DB-007 — Ledger de pontos não possui idempotência nem limites contábeis suficientes

- **Severidade:** HIGH
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `prisma/schema.prisma:426-467`; `prisma/migrations/20260831000000_add_loyalty_engine/migration.sql:36-96`; `services/loyalty.service.ts:306-369,376-436,445-528`.
- **Fluxo e condição de manifestação:** retry/concorrência credita EARN ou cria REFUND mais de uma vez; cancelamento remove pontos ganhos que já foram gastos.
- **Evidência observada:** não existe unicidade por `(orderId,type)` ou chave de operação. `creditEarnedPoints` sempre incrementa; `refundOrderPoints` procura EARN/REDEEM, mas não exclui REFUND já existente e decrementa `balance` sem validar saldo. O banco não impõe `balance >= 0`, `pending >= 0` ou consistência de sinal por `LoyaltyTxType`.
- **Impacto:** pontos duplicados, saldo negativo e `balanceAfter` incompatível com o ledger; relatórios financeiros de desconto deixam de ser reconciliáveis.
- **Correção proposta:** adicionar chave idempotente/origem única, constraints de domínio e uma política contábil para clawback quando pontos já foram consumidos (saldo devedor explícito ou compensação controlada). Fazer update condicional/versionado.
- **Teste de regressão:** processar o mesmo pagamento/cancelamento repetida e concorrentemente; gastar pontos antes do cancelamento e validar a política sem lançamentos duplicados.
- **Risco residual:** saldos existentes devem ser recalculados a partir do ledger e diferenças tratadas antes de ativar constraints.

### DB-008 — Estoque pai e estoque de variantes são fontes independentes sem invariante

- **Severidade:** HIGH
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `prisma/schema.prisma:121-176`; `services/product.service.ts:116-150,156-199`; `services/inventory.service.ts:29-81`.
- **Fluxo e condição de manifestação:** criação/edição informa `Product.stock` diferente da soma ou regra de disponibilidade das variantes; reservas decrementam ambos os contadores.
- **Evidência observada:** create/update aceita estoque pai e estoque de cada variante de modo independente. Não há constraint, trigger ou rotina de reconciliação. A reserva exige saldo suficiente nos dois, portanto um contador divergente pode bloquear produto disponível ou permitir visão de catálogo incorreta.
- **Impacto:** overselling lógico, falso esgotamento e diferenças acumuladas após edição, compra ou estorno.
- **Correção proposta:** escolher uma única fonte de verdade. Para produtos com variantes, derivar estoque pai da soma disponível (considerando `stockBuffer`) ou remover o contador duplicado; se mantido como cache, atualizá-lo por operação atômica e reconciliador auditável.
- **Teste de regressão:** criar variantes com estoques distintos, reservar/cancelar concorrentemente e comprovar a equação escolhida após cada operação.
- **Risco residual:** integrações ERP/Nuvemshop futuras podem introduzir outra fonte; será necessário versionamento e reconciliação de movimentos.

### DB-009 — Invariantes monetários são parciais e parcelamento aceita valor do cliente

- **Severidade:** HIGH
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `prisma/schema.prisma:264-330`; `prisma/migrations/20260522000000_monetary_decimal_and_check_constraints/migration.sql:17-68`; `lib/validators/checkout.validators.ts:87-108`; `services/checkout.service.ts:410-443,523-556`; `services/asaas/asaas.adapter.ts:138-170`.
- **Fluxo e condição de manifestação:** checkout por cartão envia `installments` e `installmentValue`; ou uma escrita alternativa grava subtotal, desconto, frete e total sem respeitar a equação do pedido.
- **Evidência observada:** o preço/subtotal do checkout canônico é autoritativo, mas `installmentValue` é aceito do payload, persistido e enviado ao gateway sem derivação ou validação contra `total/installments`. O banco valida apenas não-negatividade de subtotal/total/frete; não valida `total = subtotal - pointsDiscountValue + shippingCost`, desconto ≤ subtotal, parcelas positivas ou coerência de valores.
- **Impacto:** metadados financeiros podem divergir da cobrança/pedido. O efeito exato no Asaas não foi verificado sem sandbox/documentação externa, portanto subcobrança no gateway é risco, não fato confirmado.
- **Correção proposta:** calcular parcelamento exclusivamente no servidor a partir do total e configuração; persistir valor efetivamente retornado pelo gateway. Adicionar constraints locais simples e uma verificação transacional da equação do pedido para todos os caminhos de escrita.
- **Teste de regressão:** enviar valor de parcela adulterado e comprovar que é ignorado/rejeitado; testar arredondamento em 1–12 parcelas e a identidade monetária com desconto/frete.
- **Risco residual:** taxas/juros do provedor podem exigir campos separados para total do pedido, total financiado e valor líquido.

### DB-010 — Migrations históricas são destrutivas ou incompatíveis com tabelas preenchidas

- **Severidade:** HIGH
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `prisma/migrations/20260513004039_order_update/migration.sql:1-11`; `prisma/migrations/20260513203715_/migration.sql:1-58`; `prisma/migrations/20260512193716_add_audit_log_entity_fields/migration.sql:1-13`; `prisma/migrations/20260424231005_edit_address/migration.sql:1-28`.
- **Fluxo e condição de manifestação:** ambiente com dados atravessa essas versões pela primeira vez ou precisa ser restaurado de snapshot anterior.
- **Evidência observada:** migrations adicionam `lojaID`, `deliveryType`, `name`, `orderId`, `productId`, `entity` e `entityId` como NOT NULL sem default/backfill; outra remove colunas antigas de OrderItem antes de copiar dados. Os próprios warnings afirmam que falharão em tabelas não vazias e que dados serão perdidos.
- **Impacto:** deploy bloqueado ou perda de histórico de itens/auditoria. Não há rollback versionado e reversão dependeria de backup/forward-fix.
- **Correção proposta:** adotar expand/backfill/contract em migrations novas e imutáveis; testar a sequência sobre snapshot anonimizado com dados. Não reescrever migration já aplicada sem inventário de checksums; criar migrations corretivas.
- **Teste de regressão:** partir de cada versão suportada com fixtures não vazias, aplicar até HEAD, validar contagens/checksums e executar rollback operacional ensaiado por restore/forward migration.
- **Risco residual:** não foi possível saber quais migrations já foram aplicadas em cada ambiente; a estratégia deve ser por estado real, não apenas por arquivos.

### DB-011 — Unicidade de e-mail no banco contradiz o modelo multi-tenant

- **Severidade:** HIGH
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `prisma/schema.prisma:63-99`; `prisma/migrations/20260423214204_add_initial_tables/migration.sql:104-108`; `services/checkout.service.ts:287-309`; `services/auth.service.ts:27-47`.
- **Fluxo e condição de manifestação:** o mesmo consumidor usa o mesmo e-mail em duas lojas diferentes.
- **Evidência observada:** o schema e a aplicação usam `email_lojaID`, porém a primeira migration cria `User_email_key` global. Nenhuma migration o remove ou cria a unicidade composta. O índice simples adicional de e-mail não corrige essa diferença.
- **Impacto:** cadastro/upsert na segunda loja falha, impedindo o caso multi-tenant declarado; bancos sincronizados por meios distintos comportam-se de forma diferente.
- **Correção proposta:** depois de analisar duplicidades e intenção de identidade, remover a unicidade global e criar `UNIQUE(email, lojaID)` com normalização consistente de e-mail.
- **Teste de regressão:** cadastrar o mesmo e-mail normalizado em duas lojas e rejeitar duplicidade somente dentro da mesma loja, incluindo concorrência.
- **Risco residual:** normalização por lowercase na aplicação não equivale a unicidade case-insensitive para todas as escritas; considerar `citext` ou índice funcional após avaliação.

### DB-012 — Unicidades de negócio dependem de check-then-write concorrente

- **Severidade:** MEDIUM
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `prisma/schema.prisma:178-210,63-99`; `services/cart.service.ts:10-20,114-147`; `services/customer.service.ts:293-325`.
- **Fluxo e condição de manifestação:** duas requisições criam carrinho ativo para o mesmo usuário, ou atualizam dois usuários para o mesmo CPF/CNPJ da loja ao mesmo tempo.
- **Evidência observada:** Cart tem índices separados em `userID` e `status`, mas não garante um único ACTIVE por usuário. A criação usa `findFirst` seguido de `create`. CPF/CNPJ tem apenas índices não únicos e a checagem seguida de update não é atômica.
- **Impacto:** múltiplos carrinhos ativos tornam leitura/conclusão não determinística; documentos duplicados prejudicam identificação e pagamento.
- **Correção proposta:** materializar unicidade no PostgreSQL — por exemplo, índice parcial para carrinho ACTIVE e unicidade composta do documento normalizado quando a regra de negócio exigir — e tratar conflito de constraint na aplicação.
- **Teste de regressão:** executar criações/updates paralelos e verificar exatamente um vencedor, com resposta controlada para os demais.
- **Risco residual:** documentos nulos e usuários guest exigem política explícita antes de tornar a coluna única.

### DB-013 — Paginação por cursor não possui ordenação total e catálogo SSR é ilimitado

- **Severidade:** MEDIUM
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `services/product.service.ts:51-98`; `services/order.service.ts:160-211`; `services/customer.service.ts:57-133`; `app/page.tsx:14-38`.
- **Fluxo e condição de manifestação:** registros compartilham `createdAt`, ou novos registros entram entre páginas; a homepage de uma loja possui catálogo grande.
- **Evidência observada:** cursores usam `id`, mas ordenam apenas por `createdAt`; não existe desempate estável por `id`. A homepage chama `getProducts({ all: true })`, removendo `take`, e inclui variantes, marca e categorias de todos os produtos.
- **Impacto:** páginas podem duplicar/pular registros; memória, latência e payload SSR crescem com o catálogo inteiro.
- **Correção proposta:** usar ordenação total consistente com o cursor, por exemplo `(createdAt,id)`, e paginação incremental também na vitrine. Ajustar índice somente após confirmar o formato final da consulta.
- **Teste de regressão:** inserir muitos registros com timestamp igual e dados concorrentes entre páginas; provar cobertura sem duplicação. Medir homepage com catálogo de volume alvo.
- **Risco residual:** mudanças de preço/ordenação durante navegação ainda exigem semântica definida de snapshot ou eventual consistency.

### DB-014 — Relatórios e expiração carregam conjuntos ilimitados e apresentam padrão N+1

- **Severidade:** MEDIUM
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `services/customer.service.ts:81-128,200-282`; `services/loyalty.service.ts:663-700,768-828`.
- **Fluxo e condição de manifestação:** cliente possui muitos pedidos/itens ou há muitas carteiras com saldo.
- **Evidência observada:** listagem de até 100 clientes inclui todos os pedidos de cada cliente; métricas carregam todos os pedidos e itens para agregar em JavaScript. Expiração carrega todas as carteiras e, em loop, consulta todas as transações EARN de cada uma, sem paginação/claim.
- **Impacto:** alto volume de linhas, memória e tempo; risco de timeout e reprocessamento parcial. O padrão da expiração é 1 + N consultas, além das transações de baixa.
- **Correção proposta:** mover agregações adequadas ao banco, paginar/particionar jobs, limitar relações selecionadas e usar claim idempotente. Preservar queries separadas quando isso for mais eficiente, validando com plano real.
- **Teste de regressão:** fixtures com cardinalidade de produção, limite explícito de linhas/queries e benchmark de memória/latência; job retomável após interrupção.
- **Risco residual:** agregações como “produto mais comprado” podem exigir tabela derivada/materialized view conforme volume real.

### DB-015 — Índices não estão alinhados com todas as consultas quentes observadas

- **Severidade:** MEDIUM
- **Confiança:** SUSPECTED
- **Arquivo e linhas:** `prisma/schema.prisma:93-98,152-156,323-329,464-466`; `services/order-timeout.service.ts:51-78`; `services/dashboard.service.ts:118-288`; `services/loyalty.service.ts:612-629,672-685,772-785`; `services/customer.service.ts:63-85`; `services/product.service.ts:59-97`.
- **Fluxo e condição de manifestação:** crescimento de pedidos, transações de pontos, usuários e produtos.
- **Evidência observada:** a rotina global de timeout filtra `status/createdAt` sem `lojaID`, mas o índice declarado começa por `lojaID`; loyalty filtra/ordena por loja, usuário, tipo e data sem compostos equivalentes; buscas `contains` em nome/e-mail e `hasSome` no array não são atendidas por B-tree comum. Há também índices presentes apenas em migration e não no schema.
- **Impacto:** provável aumento de scans, sort e latência. Sem estatísticas e `EXPLAIN`, não está confirmado que cada candidato traria ganho líquido.
- **Correção proposta:** coletar queries reais e executar `EXPLAIN (ANALYZE, BUFFERS)` em dados anonimizados representativos. Somente então criar índices compostos/parciais/GIN/trigram que atendam consultas comprovadas e remover redundâncias após medir custo de escrita.
- **Teste de regressão:** registrar plano, linhas examinadas, buffers e p95 antes/depois; adicionar limiar de performance sem fixar plano exato do otimizador.
- **Risco residual:** distribuição de tenant/status e versão do PostgreSQL podem alterar a escolha do plano.

### DB-016 — Blindagem RLS está fora do mecanismo de migrations e omite tabelas novas

- **Severidade:** MEDIUM
- **Confiança:** NOT VERIFIED
- **Arquivo e linhas:** `prisma/migrations/supabase_rls_hardening.sql:1-87`; `prisma/schema.prisma:397-562`.
- **Fluxo e condição de manifestação:** banco Supabase expõe schema `public` pela Data API e o SQL avulso não foi aplicado, ou foi aplicado antes da criação de novas tabelas.
- **Evidência observada:** o arquivo está diretamente sob `prisma/migrations/`, não dentro de diretório com `migration.sql`, portanto não integra o histórico Prisma usual. A lista de RLS não inclui LoyaltyWallet, LoyaltyTransaction, PaymentWebhookEvent, Brand, CategoryTag, ProductCategoryTag, StockSyncLog ou tabelas J&T. Não foi possível verificar grants/RLS reais.
- **Impacto:** dependendo dos grants/default privileges do ambiente, tabelas novas podem ficar acessíveis pela Data API. Isso é risco condicionado, não exposição comprovada.
- **Correção proposta:** versionar hardening de grants/RLS em mecanismo efetivamente aplicado, cobrir todas as tabelas e configurar default privileges para futuras criações; verificar em ambiente controlado com roles `anon`/`authenticated`.
- **Teste de regressão:** consulta automatizada de `pg_class.relrowsecurity`, `pg_policies` e ACLs após migration, seguida de tentativas negativas por cada role não confiável.
- **Risco residual:** owners/superusers e a role usada pelo backend podem ignorar RLS; princípio de menor privilégio precisa ser validado separadamente.

### DB-017 — CI não aplica migrations nem executa testes com PostgreSQL

- **Severidade:** MEDIUM
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `.github/workflows/ci.yml:8-42`; `package.json:5-15`; `tests/setup/db.ts:11-40`; `tests/integration/status-transitions.test.ts:1-44`; `lib/validators/order.validators.ts:15-17`.
- **Fluxo e condição de manifestação:** pull request altera schema, migration, query ou transação e passa pelo pipeline atual.
- **Evidência observada:** CI declara URL localhost, mas não provisiona serviço PostgreSQL, não executa `prisma migrate deploy` e roda apenas `npm test`, cujo script limita-se a `tests/unit`. As três suítes de integração não entram no gate. A suíte de status ainda envia `toStatus`, enquanto a rota exige `newStatus`, e espera histórico que o serviço atual não cria.
- **Impacto:** drift, SQL inválido, constraints incompatíveis, locks e regressões de integração não impedem merge. Isso é lacuna de garantia, não prova adicional de falha em produção.
- **Correção proposta:** adicionar PostgreSQL efêmero, migration-from-zero + diff, testes de integração atualizados e cenários concorrentes reais; manter trava de segurança de `tests/setup/db.ts`.
- **Teste de regressão:** quebrar deliberadamente uma migration/constraint em branch de teste e provar falha do pipeline; validar que testes recusam qualquer URL não descartável.
- **Risco residual:** CI não reproduz volume, pooler e latência de produção; testes de carga e rehearsal de migration continuam necessários.

## 7. Integridade por domínio

| Domínio | Estado observado | Principais riscos |
|---|---|---|
| Product/Brand/Category | Product existe; Brand/Category só no schema | Tabelas ausentes, catálogo ilimitado, estoque duplicado. |
| Customer | FK para Loja; e-mail/documento indexados | Unicidade global de e-mail residual; CPF sem unicidade atômica. |
| Cart | Item único por variante no carrinho | Múltiplos carrinhos ACTIVE; preço/frete são snapshots; cascade ao recriar variante. |
| Order | Decimal e snapshots de item | Constraint residual, equação monetária não imposta, tenant e FSM não atômicos. |
| Payment | ID Asaas e evento únicos | Inbox prematura; status String; parcelas não autoritativas. |
| Coupon | Não encontrado | Não aplicável. |
| Points | Wallet única por loja/usuário, ledger | Idempotência e não-negatividade ausentes; expiração não escalável. |
| Cashback monetário | Não encontrado | Não aplicável; há pontos, não cashback em dinheiro. |
| Inventory | CHECK não negativo e transação de reserva | Duas fontes de estoque; restore parcial; sem movimento idempotente. |
| Shipping | FreightRule única por loja/cidade | Sem FK para Loja; tipo/precisão divergentes; tabelas J&T ausentes. |

## 8. Dívida priorizada

1. **P0 — Reprodutibilidade:** reconciliar migrations e provar criação do zero sem diff.
2. **P0 — Integridade concorrente:** compare-and-set de Order e idempotência dos efeitos.
3. **P0 — Inbox de pagamento:** estado processável/retry e reconciliação.
4. **P0 — Estoque:** falha atômica no restore e movimentos exatamente uma vez.
5. **P1 — Constraints de negócio:** remover unicidades residuais; formalizar tenant, e-mail, carrinho, ledger e valores.
6. **P1 — Fonte de estoque:** eliminar divergência pai/variante.
7. **P1 — Deploy seguro:** expand/backfill/contract, snapshot rehearsal e forward rollback.
8. **P2 — Escala:** paginação estável, agregações SQL, jobs em lotes e índices guiados por EXPLAIN.
9. **P2 — Garantia operacional:** CI com PostgreSQL e verificação automatizada de RLS/ACL.

## 9. Itens não aplicáveis ou não verificados

- **Banco não relacional:** não aplicável; a persistência principal observada é PostgreSQL relacional.
- **Outro ORM:** não encontrado; acesso de aplicação observado via Prisma.
- **Coupon:** não aplicável ao estado atual; não há tabela, serviço ou fluxo.
- **Cashback monetário:** não aplicável; existe fidelidade por pontos.
- **Particionamento/sharding/read replicas:** não encontrados; necessidade não pode ser inferida sem volume/SLO.
- **N+1 automático do Prisma em includes:** não declarado como fato; foram relatados apenas fan-out e loops explicitamente visíveis.
- **Planos de execução e seletividade:** não verificados sem banco e dados representativos.
- **Nível de isolamento efetivo do PostgreSQL/pooler:** não verificado; o código não escolhe isolamento explícito.
- **Estado real de migrations e checksums:** não verificado em nenhum ambiente.
- **Backups, PITR e testes de restore:** não há evidência local suficiente.
- **RLS/ACL reais:** não verificados; o risco DB-016 é condicionado.

## 10. Verificações pendentes e riscos residuais

- Aplicar todo o histórico em PostgreSQL vazio e comparar estrutura completa com `schema.prisma`.
- Comparar cada ambiente existente com o histórico/checksums antes de criar migration corretiva.
- Rodar migrations sobre snapshot anonimizado com dados e ensaiar rollback operacional.
- Executar concorrência real para checkout, status, webhook, cancelamento, pontos e carrinho.
- Reconciliar `sum(ledger.points)` com wallet e pedidos; reconciliar estoque pai/variantes/pedidos.
- Executar `EXPLAIN (ANALYZE, BUFFERS)` nas consultas destacadas com cardinalidade realista.
- Rodar as 49 suítes unitárias, 3 de integração, 1 de carga e build após instalação reprodutível.
- Validar no sandbox do gateway a semântica de `value`, `installmentCount` e `installmentValue`.
- Inspecionar grants, default privileges, RLS e políticas de todas as tabelas usando roles reais controladas.
- Confirmar política de backup, PITR, restore, retenção, criptografia e rotação de credenciais em etapa apropriada.

## 11. Conclusão limitada ao escopo

O projeto contém fundamentos úteis — PostgreSQL, Decimal em valores centrais, constraints básicas, FKs, transações locais e preço autoritativo no checkout principal. Entretanto, o artefato mais importante para confiabilidade do banco, o histórico de migrations, diverge materialmente do schema consumido pelo código. As garantias de consistência também terminam antes das fronteiras mais críticas: transição de pedido, inbox de pagamento, estorno de estoque, ledger e tenant.

**Decisão desta etapa:** publicação bloqueada até correção e verificação dos achados BLOCKER e CRITICAL, seguida de tratamento dos HIGH financeiros/multi-tenant. Esta conclusão não cobre etapas posteriores de segurança, privacidade, observabilidade ou operação, e nenhuma correção de produto foi realizada.
