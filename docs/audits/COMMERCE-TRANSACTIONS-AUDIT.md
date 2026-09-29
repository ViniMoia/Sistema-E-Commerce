# Auditoria de Checkout, Pedidos, Estoque e Pagamentos

**Etapa:** 04/15  
**Data da análise:** 2026-09-25  
**Escopo:** carrinho → checkout → pedido → pagamento → confirmação → estoque → pontos  
**Base analisada:** estado local do repositório; sem acesso a produção, banco real, credenciais ou serviços externos

## 1. Resultado executivo

O caminho canônico de checkout possui fundamentos corretos: relê preço e tenant do produto, usa `Prisma.Decimal` para subtotal/total, reserva produto e variante na mesma transação do pedido, debita pontos nessa transação e protege o webhook com token comparado em tempo constante. A disputa pela última unidade também tem uma defesa procedimental plausível: decremento atômico, detecção de saldo negativo e rollback da transação.

Esses controles não tornam o fluxo publicável no estado observado. O checkout renderizado chama uma rota que não existe e envia/consome contratos incompatíveis. Há ainda um segundo endpoint que cria pedido usando o snapshot do carrinho, sem pagamento, recálculo ou idempotência; frete externo pode ser escolhido pelo cliente; a fronteira banco → gateway não tem reconciliação durável; o webhook registra o evento como concluído antes dos efeitos; e transições concorrentes podem duplicar estoque e pontos.

**Conclusão limitada a esta etapa:** publicação não recomendada até corrigir e validar `CTR-001` a `CTR-007` e `CTR-016`. `CTR-008` a `CTR-014` também afetam integridade financeira ou operacional e devem entrar na mesma janela de estabilização do checkout.

### Contagem por severidade

| Severidade | Quantidade |
|---|---:|
| BLOCKER | 1 |
| CRITICAL | 5 |
| HIGH | 9 |
| MEDIUM | 1 |
| LOW | 0 |
| INFORMATIONAL | 0 |
| **Total** | **16** |

### Bloqueios de publicação

- `CTR-001`: o checkout web não alcança o handler implementado e seus DTOs de entrada/saída são incompatíveis.
- `CTR-002`: `POST /api/orders` contorna o checkout canônico e admite pedido sem pagamento, com preço/frete antigos e cadeia cross-tenant via carrinho.
- `CTR-003`: um webhook pode ficar definitivamente marcado como processado mesmo quando a confirmação do pedido falha.
- `CTR-004`: falhas/timeout após criar a cobrança podem cancelar localmente um pedido que ainda tem cobrança ativa, sem reconciliação automática.
- `CTR-005`: a FSM é validada antes da transação e atualizada sem compare-and-set; corridas podem duplicar estoque/pontos ou produzir pedido pago com estoque restaurado.
- `CTR-006`: frete externo não é recalculado nem vinculado a uma cotação verificável no checkout; o cliente pode reduzir o total, inclusive a zero.
- `CTR-007`: idempotência é opcional no cliente real e não cobre de forma completa a operação banco + gateway.
- `CTR-016`: o checkout web descarta `variantID`; uma correção apenas do contrato ainda permitiria vender variante sem baixar seu estoque.

## 2. Metodologia, limites e evidências reproduzíveis

Foram lidos `AGENTS.md`, `package.json`, schema e migrações Prisma, rotas de carrinho/checkout/pedidos/frete/webhook/cron, serviços de checkout, pedido, estoque, fidelidade, parcelamento e Asaas, consumidores frontend e testes unitários relacionados. O `README.md` não existe na raiz. As conclusões se baseiam no código real; comentários e nomes foram tratados apenas como intenção.

Foram rastreados:

- os dois caminhos capazes de criar pedido;
- autoridade de preço, quantidade, frete, desconto, pontos, parcela e total;
- limites transacionais entre PostgreSQL, aplicação e Asaas;
- reserva, confirmação e restauração de estoque;
- repetição, concorrência e ordem de checkout, transições, webhooks e timeout;
- precisão de centavos e conversões `Decimal` ↔ `number`/`Float`;
- compensação de pedido criado sem cobrança e de pagamento confirmado sem atualização local.

Nenhum segredo, valor de variável de ambiente ou dado pessoal real foi lido ou reproduzido. Não houve chamada ao Asaas, banco remoto, produção ou qualquer outro serviço externo. Nenhum arquivo de produto foi alterado.

### Comandos locais e resultados

Executados a partir da raiz do repositório:

```powershell
rg --files app/api | rg "(checkout|orders|webhooks|freight)"
rg -n "checkout/create-order" app components services tests
rg -n -i "cashback|coupon|cupom" app components services lib prisma tests
rg -n "isolationLevel|Serializable|repeatable read|FOR UPDATE|updateMany\(" services app tests
rg -n -i "refund|estorn|chargeback|cashback|coupon|cupom|tax|imposto" app services lib prisma tests --glob "!docs/**"
git status --short
```

Resultados relevantes:

- só existe `app/api/checkout/route.ts`; a única referência a `/api/checkout/create-order` está no componente de checkout;
- não foi encontrada implementação de cashback, cupom ou imposto no fluxo;
- não foram encontrados `isolationLevel`, `Serializable`, `FOR UPDATE` ou atualização condicional por estado nos fluxos auditados;
- o status mostrou apenas `docs/audits/` como conteúdo não rastreado já existente; esta etapa não modificou os relatórios anteriores.

Foi tentada a suíte focal:

```powershell
npm run test:unit -- --run tests/unit/checkout-authoritative.test.ts tests/unit/inventory-lifecycle.test.ts tests/unit/asaas-webhook.test.ts tests/unit/monetary-invariants.test.ts
```

Resultado: **não executada**. O script encerrou com código `1` porque `vitest` não é reconhecido; `node_modules` está ausente. Dependências não foram instaladas para respeitar a restrição de criar apenas este relatório. Portanto, os traçados de falha da seção 7 são simulações estáticas e explicitamente não substituem testes contra PostgreSQL e um gateway fake.

## 3. Fluxo real e fontes de verdade

### 3.1 Fluxo canônico pretendido

```text
CheckoutForm
  └─ POST /api/checkout/create-order  [rota inexistente]

Handler implementado: POST /api/checkout
  ├─ Zod + tenant do host + sessão
  ├─ createOrder
  │  └─ transação PostgreSQL
  │     ├─ relê Product e preço
  │     ├─ calcula subtotal/desconto/frete/total
  │     ├─ decrementa Product.stock e ProductVariants.stock
  │     ├─ cria Order/OrderItem
  │     └─ debita pontos REDEEM
  ├─ fora da transação: cria cobrança no Asaas
  ├─ grava metadados da cobrança
  └─ webhook confirma PAID e credita EARN
```

O navegador não entra no handler implementado por causa de `CTR-001`. Chamadores diretos da API ainda conseguem atingir esse caminho.

### 3.2 Segundo caminho efetivo

```text
POST /api/cart
  └─ grava snapshot de preço no CartItem

POST /api/orders
  └─ createOrderFromCart
     └─ transação PostgreSQL
        ├─ soma CartItem.price + Cart.shippingCost
        ├─ reserva estoque
        ├─ cria Order PENDING
        └─ marca Cart COMPLETED
     [sem cobrança, pontos, idempotência ou reconciliação]
```

### 3.3 Matriz de autoridade

| Valor | Caminho canônico | Caminho alternativo / fronteiras | Avaliação |
|---|---|---|---|
| preço do produto | `Product.price` relido dentro da transação | `CartItem.price` gravado quando o item entrou no carrinho | canônico autoritativo; alternativo usa snapshot potencialmente obsoleto |
| quantidade | inteiro positivo no Zod; serviço aplica `floor`/mínimo e confere estoque | quantidade do carrinho | validação presente, mas sem constraint no banco |
| subtotal | `Prisma.Decimal` de preço atual × quantidade | `Prisma.Decimal` sobre snapshot do carrinho | divergente entre caminhos |
| desconto | pontos simulados no servidor | inexistente no caminho alternativo | há divergência posterior no crédito de pontos (`CTR-013`) |
| frete local | `FreightRule` por tenant/cidade | `Cart.shippingCost` (`Float`) | local canônico autoritativo |
| frete de transportadora | `shippingCost`/`freightValue` recebido do cliente | snapshot do carrinho | não autoritativo (`CTR-006`) |
| total | `subtotal - pontos + frete` em `Decimal` | snapshot do carrinho + `Float` convertido | canônico só é seguro quando o frete é local/retirada |
| parcelas/juros | quantidade e valor aceitos do cliente | cálculo de UI em `number` | não autoritativo (`CTR-010`) |
| pagamento | resposta imediata + webhook Asaas | ausente no caminho alternativo | sem reconciliação durável (`CTR-003`, `CTR-004`) |
| estoque | `Product.stock` e, se `variantId` chegar, `ProductVariants.stock` | mesmos campos | duas contagens; o cliente web descarta a variante (`CTR-016`) |
| pontos | `LoyaltyWallet` + ledger | inexistente no caminho alternativo | efeitos não idempotentes por pedido (`CTR-005`, `CTR-013`) |
| cashback | não existe | não existe | não aplicável, ver seção 9 |

## 4. Máquinas de estado observadas

### 4.1 Pedido

Definida em `lib/order-transitions.ts:1-20`:

```text
PENDING ──> PAID ──> SHIPPED ──> DELIVERED
   │          └────────> CANCELLED
   └──────────────────> CANCELLED
```

`PAID → DELIVERED` só seria permitido para `PICKUP`/`NONE`, porém `updateOrderStatus` não passa `deliveryType` ao validador (`services/order.service.ts:294-295`). A rota de confirmação pelo cliente contorna o serviço e implementa essa exceção diretamente (`app/api/orders/[id]/confirm-delivery/route.ts:56-107`). `CANCELLED` e `DELIVERED` são terminais no mapa. Corridas ignoram essas regras porque a validação ocorre antes da transação e o `UPDATE` não contém o estado anterior (`CTR-005`).

O schema possui `OrderStatusHistory`, mas a busca no código de produto não encontrou criação de registros nessa tabela; as transições escrevem `AuditLog`. Assim, a relação `statusHistory` consultada em `services/order.service.ts:238-243` não representa, no fluxo observado, uma trilha da FSM.

### 4.2 Pagamento

Não há enum nem agregado de pagamento; `Order.asaasPaymentStatus` é `String?` (`prisma/schema.prisma:278-303`). O webhook implementa apenas:

- `PAYMENT_RECEIVED`/`PAYMENT_CONFIRMED`: `PENDING → PAID`; em `CANCELLED`, cria alerta manual;
- `PAYMENT_REFUNDED`: `PAID → CANCELLED`;
- `PAYMENT_OVERDUE`/`PAYMENT_DELETED`: `PENDING → CANCELLED`;
- demais estados/eventos: no máximo metadados, sem transição de domínio explícita.

Não há estados locais para cobrança criada, criação incerta, pagamento em análise, chargeback, reembolso solicitado/processando/falhou ou divergência financeira. Isso impede reconciliar eventos tardios e fora de ordem (`CTR-003`, `CTR-004`, `CTR-014`).

### 4.3 Estoque

```text
disponível --criação do pedido--> reservado por redução direta do saldo
reservado --pagamento-----------> sem movimento
reservado/pago --cancelamento---> restaurado por incremento
```

Não existe entidade de reserva nem estado próprio; o status do pedido funciona como proxy. A reserva ocorre antes da cobrança. O timeout cancela e restaura. A restauração suprime erros (`CTR-008`) e as transições concorrentes podem restaurar mais de uma vez (`CTR-005`).

### 4.4 Pontos

```text
checkout com resgate: REDEEM (débito)
pagamento confirmado: EARN (crédito)
cancelamento: REFUND_REDEEM e/ou REFUND_EARN
```

O ledger registra tipos, mas não possui unicidade por `(orderId, type)` (`prisma/schema.prisma:446-466`). Repetições e corridas podem duplicar movimentos. O valor de EARN confirmado usa uma base diferente da projeção do pedido quando houve resgate (`CTR-013`).

## 5. Achados

### CTR-001 — Checkout web chama rota inexistente e usa contratos incompatíveis

- **Severidade:** BLOCKER
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `components/checkout/CheckoutForm.tsx:397-446`; `app/api/checkout/route.ts:10-42,84-106`; `lib/validators/checkout.validators.ts:24-45,87-108`; `app/checkout/page.tsx:90-123`
- **Fluxo e condição:** qualquer tentativa de finalizar compra pela tela atual.
- **Evidência observada — fato:** o componente chama `/api/checkout/create-order`, mas o inventário de rotas contém apenas `/api/checkout`. O componente envia cliente em campos planos, cartão em `cardData`, parcela dentro do cartão e item como `productID`; o schema exige `customer`, `creditCard`, parcelas no topo e `productId`. O handler retorna `ok(result)`, enquanto a página acessa imediatamente `result.customer`, `result.items` e demais campos no topo.
- **Hipótese separada:** nenhuma; a ausência da rota e os formatos divergentes são determinísticos no código.
- **Impacto:** checkout público retorna 404; mesmo corrigindo apenas a URL, a validação falha e, se a entrada fosse adaptada isoladamente, o consumidor ainda quebraria no envelope de resposta.
- **Correção proposta:** definir um único contrato versionado; alterar a tela para `POST /api/checkout`, mapear exatamente `customer`/`creditCard`/`productId`/parcelas, não enviar valores financeiros como autoridade, enviar chave de idempotência e consumir o envelope real. Remover ou bloquear caminhos obsoletos.
- **Teste de regressão:** teste E2E navegador → pedido com PIX, cartão e boleto; teste de contrato que importe o schema e valide o payload produzido pela UI; assertiva de que a confirmação lê o envelope correto.
- **Risco residual:** mudanças futuras podem voltar a divergir sem contrato compartilhado e teste E2E no pipeline.

### CTR-002 — Endpoint alternativo contorna invariantes do checkout e admite cadeia cross-tenant

- **Severidade:** CRITICAL
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `app/api/orders/route.ts:8-58`; `services/order.service.ts:17-108`; `app/api/cart/route.ts:33-50`; `services/cart.service.ts:63-180`; `services/inventory.service.ts:29-32`
- **Fluxo e condição:** usuário autenticado adiciona produto por ID ao carrinho e chama `POST /api/orders`; duas chamadas paralelas podem observar o mesmo carrinho `ACTIVE`.
- **Evidência observada — fato:** o carrinho aceita o primeiro produto sem comparar sua loja com o tenant do host. A checagem de loja só compara itens subsequentes com o primeiro. `createOrderFromCart` valida dono/status do carrinho, mas não valida que os produtos pertencem a `lojaID`, usa `CartItem.price` e `Cart.shippingCost`, não relê produto/preço, e passa `lojaID` a `reserveStock`, cujo parâmetro se chama `_lojaID` e não é usado. O serviço cria `PENDING`, marca o carrinho `COMPLETED` e retorna sem cobrança, pontos ou chave idempotente. A leitura do status do carrinho ocorre antes da transação.
- **Hipótese separada:** a exploração cross-tenant depende de conhecer um UUID de produto de outra loja; a integridade ausente é confirmada, a enumeração do ID não foi avaliada nesta etapa.
- **Impacto:** pedido atribuído à loja A pode conter produto/estoque da loja B; preço e frete antigos podem ser cobrados; pedidos duplicados e reservas duplicadas podem nascer do mesmo carrinho; o pedido pode permanecer sem meio de pagamento.
- **Correção proposta:** retirar o endpoint de criação alternativo ou fazê-lo delegar ao mesmo caso de uso canônico. Dentro de uma única transação, bloquear/consumir condicionalmente o carrinho, reler produtos por `{id, lojaID}`, recalcular todos os valores e iniciar o workflow de pagamento/idempotência.
- **Teste de regressão:** integração PostgreSQL cobrindo produto de outro tenant, mudança de preço após inclusão no carrinho, duas chamadas simultâneas para o mesmo carrinho e ausência/falha de cobrança.
- **Risco residual:** carrinho continua sendo snapshot de UX; nunca deve ser fonte financeira final.

### CTR-003 — Evento de webhook é consumido antes de seus efeitos e não pode ser retomado

- **Severidade:** CRITICAL
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `app/api/webhooks/asaas/route.ts:133-169,171-239`; `prisma/schema.prisma:552-561`
- **Fluxo e condição:** `PAYMENT_CONFIRMED`/`PAYMENT_RECEIVED` válido; depois de inserir `PaymentWebhookEvent`, a busca, gravação de metadados, transição, auditoria ou crédito de pontos falha.
- **Evidência observada — fato:** o handler cria `PaymentWebhookEvent` antes de localizar/aplicar o pedido. A tabela possui apenas `processedAt`, sem `status`, tentativa ou erro. Qualquer retry encontra `eventId` e retorna `ALREADY_PROCESSED`. Se `updateOrderStatus` devolver falha, o handler responde 422, mas o evento já permanece consumido.
- **Hipótese separada:** a causa concreta da falha pode ser indisponibilidade de banco, FK, regra de transição ou erro no ledger; o estado irrecuperável após qualquer uma delas decorre diretamente do código.
- **Impacto:** pagamento confirmado no gateway pode coexistir indefinidamente com pedido `PENDING`, estoque reservado e pontos não creditados; o retry do provedor não corrige o estado.
- **Correção proposta:** implementar inbox transacional com estados `RECEIVED/PROCESSING/PROCESSED/FAILED`, contador/erro e worker reprocessável. Registrar evento e efeitos locais na mesma transação quando possível; só marcar `PROCESSED` após todos os efeitos idempotentes. Responder não-2xx enquanto houver falha recuperável.
- **Teste de regressão:** fixture que injeta falha após inserir o evento e antes/durante `updateOrderStatus`; o retry deve retomar efeitos exatamente uma vez e terminar `PROCESSED`.
- **Risco residual:** efeitos externos, como e-mail, exigem outbox separada mesmo após tornar a aplicação local atômica.

### CTR-004 — Fronteira banco → gateway tem resultado ambíguo e compensação sem reconciliação

- **Severidade:** CRITICAL
- **Confiança:** HIGH CONFIDENCE
- **Arquivo e linhas:** `services/checkout.service.ts:115-472,478-665`; `services/asaas/asaas.client.ts:53-68,160-176`; `services/asaas/asaas.adapter.ts:44-50,138-174,252-258`
- **Fluxo e condição:** pedido/estoque/pontos são confirmados no banco; o gateway cria a cobrança, mas a resposta se perde ou a atualização local posterior falha.
- **Evidência observada — fato:** a transação local termina antes da chamada externa. O cliente tem timeout de 8 s. A mesma captura `catch` trata falha de rede, falha do gateway e falha de `prisma.order.update` depois de uma resposta bem-sucedida; em todos os casos tenta `PENDING → CANCELLED`, restaura estoque/pontos e devolve erro. A criação de pagamento não envia chave idempotente em header e não existe workflow persistente de reconciliação/consulta após resultado incerto.
- **Hipótese separada:** em timeout, a cobrança pode ou não ter sido criada; sem consulta ao provedor não é possível distinguir. O risco de cobrança ativa com pedido cancelado é, portanto, condicional, não observado em serviço real.
- **Impacto:** cobrança ou crédito duplicado em retry, cobrança ativa para pedido cancelado/estoque liberado, ou pedido cancelado apesar de cartão aprovado.
- **Correção proposta:** persistir uma intent/outbox de pagamento com chave única por pedido, estados e tentativas; usar idempotência suportada pelo provedor; após timeout consultar por ID/referência antes de compensar; separar “falha confirmada” de “resultado desconhecido”; worker de reconciliação deve convergir banco e gateway.
- **Teste de regressão:** gateway fake que (a) persiste cobrança e lança timeout, (b) responde sucesso e força falha no `order.update`, (c) recebe retry; assertar uma cobrança, estado recuperável e compensação somente após falha confirmada.
- **Risco residual:** nenhum desenho oferece atomicidade ACID com um gateway HTTP; reconciliação e operação manual auditável permanecem necessárias.

### CTR-005 — Transições concorrentes não usam compare-and-set e repetem efeitos

- **Severidade:** CRITICAL
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `services/order.service.ts:265-410`; `lib/order-transitions.ts:3-20`; `app/api/orders/[id]/confirm-delivery/route.ts:14-107`; `prisma/schema.prisma:304-321,446-466`
- **Fluxo e condição:** dois webhooks, cron + webhook, dois cancelamentos ou confirmação do cliente + operação administrativa atuam simultaneamente sobre o mesmo pedido.
- **Evidência observada — fato:** `updateOrderStatus` lê e valida `fullOrder.status` antes de abrir a transação. Dentro dela faz `order.update({where:{id}})` sem estado/versionamento esperado. `EARN`, `REFUND_*` e restauração de estoque não possuem chave única por efeito. A confirmação de entrega repete o padrão de leitura antes da transação. Não há nível de isolamento explícito nem `FOR UPDATE`/CAS.
- **Hipótese separada:** a interleaving exata depende do agendamento do PostgreSQL, mas todos os writes necessários para os resultados abaixo estão permitidos pelo código.
- **Impacto:** dois `PAID` podem creditar EARN duas vezes; dois `CANCELLED` podem restaurar estoque duas vezes; `CANCELLED` concorrente com `PAID` pode terminar pago com estoque restaurado ou cancelado com EARN não estornado.
- **Correção proposta:** transição condicional atômica (`UPDATE ... WHERE id=? AND status=?`, versão otimista ou lock de linha); se nenhuma linha mudar, recarregar e tratar como idempotente/conflito. Criar chaves únicas de efeitos por pedido/tipo e executar estado, histórico, estoque e ledger na mesma transação.
- **Teste de regressão:** integração PostgreSQL com barreiras controladas para 2×PAID, 2×CANCELLED, PAID×CANCELLED e SHIPPED×DELIVERED; conferir estado final, uma restauração e um movimento por tipo.
- **Risco residual:** integrações externas e jobs distribuídos ainda exigem idempotência mesmo com lock local.

### CTR-006 — Frete externo é controlável pelo cliente e cacheia cotação sem valor segurado

- **Severidade:** CRITICAL
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `services/checkout.service.ts:345-390`; `app/api/freight/calculate/route.ts:55-117`; `services/freight/orchestrator.service.ts:66-97`; `services/freight/providers/jt-express.provider.ts:83-99`; `services/freight/providers/custom-table.provider.ts:16-42`
- **Fluxo e condição:** entrega para cidade sem `FreightRule` exata, especialmente cotação de transportadora.
- **Evidência observada — fato:** o checkout aceita `params.shippingCost >= 0` ou `freightValue` e os soma ao total sem recalcular nem validar uma cotação assinada. A rota de cotação permite que preço/dimensões enviados prevaleçam sobre o cadastro pelo uso de `??`. A chave de cache usa CEP/peso/dimensões, mas omite `cartTotal`; o provedor J&T usa `cartTotal` para ad-valorem/GRIS. O provedor de tabela local retorna regras de todas as cidades da loja, sem filtrar o destino.
- **Hipótese separada:** o valor efetivamente aceito por uma transportadora real não foi consultado; a possibilidade de enviar frete zero ao checkout é confirmada localmente.
- **Impacto:** subcobrança direta, total incorreto, opção de cidade errada e reutilização de seguro calculado para outro valor de carrinho.
- **Correção proposta:** o servidor deve reler preço/dimensões/tenant, calcular a cotação e emitir `quoteId` opaco com expiração e fingerprint de itens/endereço/valor; checkout deve resolver e revalidar esse ID. Incluir valor segurado na chave de cache; filtrar tabela local pelo destino.
- **Teste de regressão:** adulterar custo/preço/dimensões, reutilizar quote em carrinho diferente e cotar duas cestas de mesmo volume/CEP com valores distintos; checkout deve rejeitar ou recalcular.
- **Risco residual:** tarifas mudam entre cotação e compra; defina tolerância, validade e política de absorção auditável.

### CTR-007 — Idempotência do checkout é opcional e não representa a operação financeira completa

- **Severidade:** HIGH
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `components/checkout/CheckoutForm.tsx:397-437`; `app/api/checkout/route.ts:84-94`; `services/checkout.service.ts:115-168,410-475`; `prisma/schema.prisma:309`
- **Fluxo e condição:** duplo clique/retry sem header; ou duas requisições com a mesma chave enquanto a primeira está entre commit do pedido e criação da cobrança.
- **Evidência observada — fato:** a UI não gera nem envia chave. A API aceita chave opcional. Quando encontra pedido existente, retorna antes da etapa de gateway e sem fingerprint do payload; a chave é única globalmente, mas não vinculada a tenant/usuário/conteúdo. Em corrida antes do primeiro insert, a unicidade pode produzir erro de constraint sem recuperação explícita.
- **Hipótese separada:** duplicação real depende de o cliente repetir a requisição; o cliente atual não tem proteção que impeça retry de transporte ou múltiplas instâncias.
- **Impacto:** sem chave, pedidos/reservas/cobranças duplicados; com chave, resposta parcial ou reutilização indevida de chave para conteúdo diferente; baixa capacidade de recuperar uma operação em andamento.
- **Correção proposta:** exigir chave de alta entropia por tentativa lógica, escopá-la por tenant/cliente/operação, armazenar hash do payload e status do workflow, tratar colisão concorrente recarregando a operação e devolver a mesma resposta final/reprocessável.
- **Teste de regressão:** 20 requisições concorrentes iguais, mesma chave com payload diferente e retry durante cada ponto de falha; uma operação financeira e respostas semanticamente iguais.
- **Risco residual:** a chave local deve ser propagada/relacionada à idempotência do provedor; isoladamente não elimina duplicata externa.

### CTR-008 — Restauração de estoque suprime falhas e permite commit parcial

- **Severidade:** HIGH
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `services/inventory.service.ts:88-128`; `services/order.service.ts:359-410`
- **Fluxo e condição:** cancelamento de pedido quando o incremento de produto pai ou variante falha.
- **Evidência observada — fato:** cada `update` de restauração está em `try/catch` que apenas faz `console.warn` e continua. A transação externa pode então gravar pedido `CANCELLED`, auditoria e estorno de pontos mesmo com uma ou ambas as contagens não restauradas.
- **Hipótese separada:** motivos possíveis incluem registro excluído, indisponibilidade ou inconsistência; nenhum foi induzido em banco real.
- **Impacto:** estoque perdido ou divergência entre produto e variante, com cancelamento aparentemente bem-sucedido e sem retry durável.
- **Correção proposta:** propagar o erro para rollback ou registrar uma compensação persistente com estado `FAILED` e retry; nunca sinalizar cancelamento integral se a política exige restauração e ela não ocorreu.
- **Teste de regressão:** forçar falha no segundo incremento e comprovar rollback de status, primeiro incremento, auditoria e pontos; alternativamente comprovar job de reparo idempotente.
- **Risco residual:** item removido permanentemente pode exigir fila de exceções e resolução manual, não retry infinito.

### CTR-009 — Webhook não reconcilia identidade e valor financeiro em runtime

- **Severidade:** HIGH
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `app/api/webhooks/asaas/route.ts:88-134,171-207`; `prisma/schema.prisma:281-303`
- **Fluxo e condição:** webhook autenticado com referência/ID incorreto, valor divergente, método inesperado ou sem `body.id` estável.
- **Evidência observada — fato:** há token obrigatório e `timingSafeEqual`, controle positivo. Depois disso, o corpo é apenas convertido por type assertion e só se verifica presença de `event` e `payment`. O pedido é localizado por `externalReference` **ou** `asaasPaymentId`; não se compara `payment.value` a `order.total`, método/billing type, cliente ou moeda antes de marcar pago. Sem ID do evento, o fallback contém `Date.now()`, produzindo outra chave em cada retry.
- **Hipótese separada:** a suficiência criptográfica do header do Asaas é **NOT VERIFIED** porque documentação/serviço externo não foi acessado; não se afirma aqui que HMAC seja exigido pelo provedor.
- **Impacto:** evento legítimo mas mal associado/divergente pode liquidar o pedido errado ou por valor incorreto; retries sem ID podem repetir efeitos.
- **Correção proposta:** schema runtime estrito por evento, allowlist, ID estável obrigatório ou derivação determinística, correspondência simultânea de referência e payment ID quando conhecidos, comparação monetária exata e estado `DISCREPANCY` que bloqueie efeitos automáticos.
- **Teste de regressão:** valor menor/maior, payment ID de outro pedido, referência conflitante, evento sem ID e payload malformado; nenhum deve marcar `PAID`.
- **Risco residual:** eventos válidos podem chegar fora de ordem; reconciliar periodicamente com consulta autenticada ao provedor.

### CTR-010 — Parcelas e juros não são recalculados pelo servidor

- **Severidade:** HIGH
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `lib/validators/checkout.validators.ts:99-105`; `services/payment/installment.service.ts:14-50,57-107`; `components/checkout/CheckoutForm.tsx:154-164,1087-1096`; `services/checkout.service.ts:410-431,523-556`; `services/asaas/asaas.adapter.ts:138-174`
- **Fluxo e condição:** chamada direta ao checkout com cartão e `installments`/`installmentValue` manipulados; ou UI exibindo repasse de juros.
- **Evidência observada — fato:** o servidor valida apenas 1–12 parcelas e valor positivo, persiste e encaminha o valor recebido. A regra de mínimo, taxa, Price e arredondamento existe só no serviço consumido pela UI. O pedido/gateway recebem `value = created.total`, enquanto a tela pode exibir `totalWithInterest`; o total do pedido não incorpora esse juros. O payload atual da própria UI ainda coloca parcelas no campo incompatível `cardData` e não envia o valor de parcela esperado.
- **Hipótese separada:** o gateway pode rejeitar combinações incoerentes; sem sandbox externo isso não foi verificado e não substitui autoridade no servidor.
- **Impacto:** parcela abaixo do mínimo, inconsistência entre exibido/pedido/cobrança e potencial disputa por valor/juros.
- **Correção proposta:** receber apenas a quantidade desejada; recalcular no servidor com política versionada e centavos/Decimal, distribuir resíduo explicitamente e enviar ao gateway os valores derivados. Persistir principal, juros, total financiado e versão da regra.
- **Teste de regressão:** vetores de 1–12 parcelas, valores com centavos e resíduos, configuração com/sem absorção, payload adulterado e comparação entre UI, pedido e gateway fake.
- **Risco residual:** arredondamento final pode ser definido pelo provedor; reconciliar a resposta efetiva e exibir sua composição.

### CTR-011 — Ausência da chave do gateway é tratada como checkout bem-sucedido

- **Severidade:** HIGH
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `services/checkout.service.ts:491-501,633-670`; `lib/validators/checkout.validators.ts:99-103`
- **Fluxo e condição:** `ASAAS_API_KEY` ausente fora de teste e pagamento `PIX`, `CREDIT_CARD` ou `BOLETO`; `WHATSAPP_PIX` com chave presente.
- **Evidência observada — fato:** toda criação de cobrança fica dentro de `if (process.env.ASAAS_API_KEY && customerCpf && !isTestWithoutMock)`. Se a chave estiver ausente, o serviço pula silenciosamente o bloco e retorna `success: true` com pedido/estoque já persistidos. Quando o método é `WHATSAPP_PIX` e a chave existe, ele cai no `else` genérico e cria PIX no Asaas, contrariando a distinção de método sugerida pelo nome.
- **Hipótese separada:** não foi inspecionada configuração de deploy/produção; não se afirma que a chave esteja ausente hoje.
- **Impacto:** erro de configuração produz pedidos aparentemente concluídos sem cobrança; modalidade manual pode criar cobrança automática inesperada.
- **Correção proposta:** validar configuração no startup e falhar fechado por método; modelar explicitamente gateway/manual e seus estados; somente retornar sucesso quando o resultado esperado daquele método estiver persistido.
- **Teste de regressão:** matriz método × chave configurada × CPF × ambiente; métodos automáticos devem falhar antes de reservar/criar ou entrar em workflow recuperável, e manual nunca chamar gateway.
- **Risco residual:** health check de configuração não detecta credencial revogada; monitorar uma operação sintética/sandbox e taxas de erro.

### CTR-012 — Timeout classifica pagamentos apenas pela presença de ID e cancela sem consultar o gateway

- **Severidade:** HIGH
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `services/order-timeout.service.ts:40-105`; `services/order.service.ts:265-410`
- **Fluxo e condição:** qualquer pedido `PENDING` com `asaasPaymentId` ultrapassa o corte; inclui boleto, cartão em análise e PIX.
- **Evidência observada — fato:** o job trata `asaasPaymentId != null` como “Asaas PIX” e aplica o mesmo timeout em minutos; sem ID, chama de “WhatsApp PIX Manual”. Não filtra `paymentMethod`, vencimento do boleto ou status do gateway e não consulta a cobrança antes de cancelar. A transição concorre com o webhook sem CAS (`CTR-005`).
- **Hipótese separada:** os defaults e a agenda real do cron não comprovam que um boleto ativo já tenha sido cancelado; a seleção incorreta está no código.
- **Impacto:** cancelamento prematuro de cobrança válida, estoque liberado antes de pagamento tardio e necessidade de estorno manual.
- **Correção proposta:** política por método/estado/vencimento; antes de cancelar, consultar/reconciliar gateway; usar lease/CAS e estado de expiração próprio; boleto deve respeitar vencimento e cartão em análise não deve usar TTL de PIX.
- **Teste de regressão:** fixtures para PIX pendente/confirmado na fronteira, boleto não vencido/vencido, cartão em análise e corrida cron × webhook.
- **Risco residual:** consulta ao gateway também pode falhar; manter estado “expiração pendente” e retry, sem liberar estoque em resultado incerto.

### CTR-013 — Pontos projetados e creditados usam bases diferentes; estornos não são idempotentes

- **Severidade:** HIGH
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `services/checkout.service.ts:313-343,410-464`; `services/order.service.ts:341-350,393-406`; `services/loyalty.service.ts:304-368,445-528`; `prisma/schema.prisma:446-466`
- **Fluxo e condição:** compra com resgate de pontos; confirmação/cancelamento repetido ou concorrente.
- **Evidência observada — fato:** no checkout com resgate, `pointsEarned` projetado é calculado sobre `subtotalAfterDiscount`. Na confirmação, `creditEarnedPoints` recebe `fullOrder.subtotal`, antes do desconto, e credita sobre essa base. Exemplo com taxa `0,5`: subtotal R$ 100 e desconto R$ 20 projetam 40 pontos, mas a confirmação credita 50. O ledger não tem unicidade por pedido/tipo. `refundOrderPoints` procura o primeiro EARN/REDEEM, sem verificar REFUND já existente, e pode repetir o estorno.
- **Hipótese separada:** a política comercial desejada (ganhar sobre bruto ou líquido) não está documentada; o defeito confirmado é a inconsistência entre projeção persistida e crédito efetivo.
- **Impacto:** saldo divergente do pedido/tela e créditos/estornos duplicados em repetição.
- **Correção proposta:** escolher e documentar uma base única, persistir o valor elegível no pedido, creditar exatamente `Order.pointsEarned` ou recálculo versionado equivalente; unique idempotente por `(orderId,type/regra)` e CAS no saldo.
- **Teste de regressão:** tabela de cenários com/sem resgate, limites percentuais e arredondamento; repetir EARN/REFUND sequencial e concorrentemente e garantir um único efeito.
- **Risco residual:** mudança de regra entre compra e pagamento exige versão/snapshot para não recalcular com configuração nova.

### CTR-014 — Reembolso e eventos fora de ordem não possuem estado/compensação completos

- **Severidade:** HIGH
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `app/api/webhooks/asaas/route.ts:248-310`; `lib/order-transitions.ts:3-20`; `prisma/schema.prisma:273-303,378-394`
- **Fluxo e condição:** `PAYMENT_REFUNDED` chega quando o pedido já está `SHIPPED`, `DELIVERED` ou `CANCELLED`; pagamento chega após timeout/cancelamento; eventos chegam fora de ordem.
- **Evidência observada — fato:** refund só chama compensação quando o status capturado é `PAID`; nos demais estados apenas os metadados são atualizados. Pagamento tardio em `CANCELLED` cria nota/alerta, sem estorno automático nem workflow reconciliável. O `AuditLog` dessa ramificação usa literais de sistema/ID de pedido em campos relacionados a `User`, diferentemente do mapeamento feito em `updateOrderStatus`, podendo fazer o bloco falhar. Pedido não distingue cancelamento operacional, devolução e reembolso financeiro.
- **Hipótese separada:** devolver produto expedido ao estoque pode exigir confirmação física; não se recomenda restauração automática indiscriminada. O que está ausente é um estado/processo explícito e o estorno consistente de efeitos financeiros/pontos.
- **Impacto:** gateway reembolsado com pedido ainda entregue/enviado e pontos mantidos; pagamento tardio sem resolução; evento já consumido por `CTR-003` se o alerta falhar.
- **Correção proposta:** agregado/processo de pagamento/reembolso separado do fulfillment, com estados e transições próprias; tratar chargeback/refund parcial/total e eventos fora de ordem idempotentemente; fila de exceção para retorno físico e reconciliação financeira.
- **Teste de regressão:** permutar CONFIRMED, OVERDUE, REFUNDED e CANCELLED sobre cada estado do pedido; validar estado financeiro, pontos, estoque e necessidade de intervenção, sem efeitos duplicados.
- **Risco residual:** logística reversa e refund parcial exigem decisão de negócio e conferência física.

### CTR-015 — Representação monetária mistura Decimal, Float e ponto flutuante JavaScript

- **Severidade:** MEDIUM
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `prisma/schema.prisma:125,184,288,297-307,340`; `services/checkout.service.ts:189-226,323-390,460,503-610`; `services/order.service.ts:34-39`; `services/payment/installment.service.ts:14-50`; `services/loyalty.service.ts:66-98,268-286`; `services/freight/providers/jt-express.provider.ts:83-99`
- **Fluxo e condição:** frete no carrinho, taxas/parcelas, seguro de frete, pontos e conversão para o gateway, especialmente em limites de arredondamento.
- **Evidência observada — fato:** preço/pedido/itens usam `Decimal(10,2)`, controle positivo. Porém `Cart.shippingCost` é `Float`; frete, parcelas e pontos calculam em `number` com `Math.round`, `Math.floor`, `toFixed`; valores `Decimal` são convertidos a `Number` antes do gateway e do motor de pontos. Não existe padrão único de centavos inteiros nem modo de arredondamento documentado.
- **Hipótese separada:** não foi encontrado caso de erro de centavo já materializado em dados; o risco está nas fronteiras e regras inconsistentes, não na simples existência de conversão.
- **Impacto:** divergências de centavos, limiares de ponto/parcela e reconciliação mais difícil entre tela, banco e gateway.
- **Correção proposta:** adotar `Decimal` ou centavos inteiros em todo domínio financeiro; converter para `number` apenas no adaptador inevitável e validar round-trip; definir moeda/escala/modo de arredondamento por regra; migrar `Cart.shippingCost` para decimal mesmo sem tratá-lo como autoridade.
- **Teste de regressão:** testes property-based e vetores `0,01`, `0,10`, `49,99`, grandes quantidades, resíduos de parcela e taxas; comparar soma das parcelas, total persistido e payload do gateway.
- **Risco residual:** APIs externas normalmente serializam número decimal; a resposta financeira do provedor continua sendo a referência de reconciliação.

### CTR-016 — Checkout web descarta a variante e não reserva seu estoque

- **Severidade:** HIGH
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `store/cart.store.ts:4-12,51-59`; `app/checkout/page.tsx:196-202`; `components/checkout/CheckoutForm.tsx:27-37,423-430`; `lib/validators/checkout.validators.ts:24-32`; `services/checkout.service.ts:211-235,239-248`; `services/inventory.service.ts:65-80`
- **Fluxo e condição:** após corrigir `CTR-001`, cliente compra um item com variante pelo checkout web.
- **Evidência observada — fato:** o carrinho mantém `variantID`, mas a página passa itens com cast `any` para uma interface que não contém esse campo. O payload do formulário envia produto/cor/tamanho, mas não `variantId`. O serviço não resolve variante por cor/tamanho; só valida e decrementa `ProductVariants.stock` quando `item.variantId` existe. Portanto, esse fluxo baixa apenas `Product.stock`.
- **Hipótese separada:** se o estoque do produto pai for sempre recalculado como limite estrito de todas as variantes, ele pode reduzir parte do risco, mas essa invariável não é imposta por constraint nem demonstrada no fluxo auditado.
- **Impacto:** variante esgotada pode continuar vendável, e produto pai/variantes divergem; a simulação da última unidade só protege a variante quando seu ID chega ao backend.
- **Correção proposta:** preservar um identificador de variante canônico no store/DTO, validar que pertence ao produto e tenant e torná-lo obrigatório para produtos variantizados. Não resolver somente por rótulos mutáveis de cor/tamanho.
- **Teste de regressão:** E2E com duas variantes e estoques diferentes; confirmar que o pedido baixa pai e variante selecionada, rejeita ID de outro produto/tenant e que duas compras da última unidade da variante geram apenas um pedido.
- **Risco residual:** manter duas contagens exige regra explícita para `Product.stock` (soma, limite ou campo derivado) e reconciliação periódica.

## 6. Concorrência da última unidade

### Resultado do traçado estático

No caminho canônico, `InventoryService.reserveStock` executa `stock: { decrement: quantity }` e lança se o saldo retornado for negativo (`services/inventory.service.ts:50-79`). A chamada está dentro da mesma transação que cria o pedido (`services/checkout.service.ts:115-247`). Com PostgreSQL (`prisma/schema.prisma:8-12`), dois updates da mesma linha são serializados pelo lock de escrita; para estoque inicial 1 e duas compras de 1, o resultado esperado é:

1. T1 decrementa `1 → 0` e pode criar o pedido;
2. T2 espera, decrementa `0 → -1`, detecta negativo e lança;
3. rollback de T2 restaura seu decremento e impede seu pedido.

**Avaliação:** defesa com **HIGH CONFIDENCE**, mas **NOT VERIFIED** dinamicamente porque não houve PostgreSQL local disponível. Ela vale para cada linha cujo identificador chega ao serviço. No checkout web, `variantID` é descartado (`CTR-016`), então apenas a disputa no produto pai recebe essa proteção. Não existe `CHECK (stock >= 0)` no schema/migrações auditados; portanto a garantia depende de todas as escritas atravessarem esse serviço. Também não há constraint que imponha coerência entre produto pai e variante.

Teste pendente obrigatório: duas conexões reais, barreira após o primeiro update, estoque inicial 1, e assertivas de um pedido, saldo 0, nenhuma variante negativa e nenhum efeito parcial.

## 7. Simulações de falha solicitadas

As fixtures existentes não puderam ser executadas sem dependências. Abaixo está a simulação determinística por ordem de chamadas do código; ela deve ser convertida em testes executáveis.

### 7.1 Pagamento confirmado seguido de falha de atualização

Fixture lógica: pedido `PENDING`, evento `evt-1 / PAYMENT_CONFIRMED`, token válido, `updateOrderStatus` falhando.

| Passo | Código | Estado resultante |
|---:|---|---|
| 1 | cria `PaymentWebhookEvent(evt-1)` | evento persistido como se processado |
| 2 | localiza pedido e grava `asaasPaymentStatus=CONFIRMED` | metadado financeiro confirmado, pedido ainda `PENDING` |
| 3 | `updateOrderStatus` falha/retorna `success:false` | resposta 422/500; estoque continua reservado; sem EARN |
| 4 | provedor repete `evt-1` | `findUnique` encontra evento e retorna `ALREADY_PROCESSED` |

Resultado: falha permanente e não reprocessável, confirmando `CTR-003`.

### 7.2 Pedido criado seguido de falha no pagamento

Fixture lógica: transação local bem-sucedida, gateway fake falhando em três posições.

| Falha injetada | Comportamento atual | Risco |
|---|---|---|
| antes de criar cobrança, falha confirmada | tenta cancelar, restaurar estoque e pontos; pedido permanece `CANCELLED` | aceitável só se toda compensação for atômica; `CTR-008` impede essa garantia |
| gateway cria cobrança e ocorre timeout | aplicação não sabe que criou, cancela localmente | cobrança ativa com estoque liberado |
| gateway responde e `order.update` falha | mesmo `catch` cancela localmente | cobrança conhecida pelo gateway, vínculo local perdido |
| compensação falha | erro apenas registrado, resposta falha | pedido/estoque/pontos podem permanecer intermediários sem retry durável |

Resultado: o caso “falha no pagamento” não é um único estado; é necessário distinguir falha confirmada de resultado desconhecido (`CTR-004`).

## 8. Cobertura de testes observada e lacunas

Controles cobertos por testes existentes, mas não executados nesta máquina:

- `tests/unit/checkout-authoritative.test.ts:41-175`: preço relido, frete local e retorno por chave idempotente;
- `tests/unit/inventory-lifecycle.test.ts:52-105`: reserva/restauração no caso de sucesso e ausência de segundo decremento em `PAID`;
- `tests/unit/asaas-webhook.test.ts:47-258`: token, duplicata simples e happy paths de pagamento/refund;
- `tests/unit/monetary-invariants.test.ts:4-29`: três operações isoladas com `Prisma.Decimal`;
- `tests/unit/loyalty-security-concurrency.test.ts:54-115`: concorrência simulada por mock em memória.

Limitações desses testes, registradas como lacunas e não como vulnerabilidades adicionais:

- mocks de `$transaction` não reproduzem rollback, locks nem isolamento do PostgreSQL;
- o teste de double-spend implementa no próprio mock a rejeição que pretende provar;
- não há fixture para evento persistido + efeito falho, timeout depois de cobrança criada, falha da gravação pós-gateway, restauração parcial, 2×PAID/2×CANCELLED ou disputa real da última unidade;
- testes monetários não atravessam frete, juros, pontos, banco e gateway;
- não há E2E do formulário de checkout, que detectaria `CTR-001`.

## 9. Itens não aplicáveis ou não verificados

- **Cashback — não aplicável:** não há modelo, serviço, rota ou ocorrência de `cashback`. O programa existente é de pontos. Não foi inferida equivalência entre ambos.
- **Cupons — não aplicável nesta base:** não há modelo/serviço/rota ou ocorrência de `coupon`/`cupom` no escopo auditado.
- **Impostos — não aplicável como cálculo separado:** nenhum componente de imposto foi encontrado; o total observado é produtos − pontos + frete.
- **Refund iniciado pela aplicação — não implementado:** só foi encontrado consumo de `PAYMENT_REFUNDED`; não há chamada local ao gateway para solicitar reembolso. Isso é tratado em `CTR-014`, sem assumir política comercial ausente.
- **Autenticidade específica do provedor — não verificada:** o token compartilhado é validado em tempo constante. Não foi acessada documentação externa para afirmar se assinatura HMAC, timestamp ou IP allowlist são oferecidos/exigidos.
- **Banco e gateway reais — não verificados:** não houve conexão, migração, cobrança, webhook real ou leitura de configuração de produção.
- **Next.js runtime — não verificado:** `node_modules` está ausente, portanto a documentação local de Next 16 indicada por `AGENTS.md` também não estava disponível; nenhum código Next.js foi alterado.

## 10. Dívida priorizada e plano de correção

1. Restaurar um único checkout funcional, preservar a variante e bloquear/remover o criador alternativo (`CTR-001`, `CTR-002`, `CTR-016`).
2. Tornar frete e parcelamento totalmente derivados no servidor (`CTR-006`, `CTR-010`).
3. Introduzir workflow persistente de pagamento com outbox/inbox, idempotência e reconciliação (`CTR-003`, `CTR-004`, `CTR-007`, `CTR-009`).
4. Aplicar CAS/lock e chaves únicas a estados, estoque e ledger (`CTR-005`, `CTR-008`, `CTR-013`).
5. Separar estado financeiro de fulfillment e corrigir timeout/refund/out-of-order (`CTR-011`, `CTR-012`, `CTR-014`).
6. Padronizar representação monetária e criar testes PostgreSQL/gateway fake/E2E (`CTR-015`).

## 11. Riscos residuais e verificações pendentes

Mesmo após correções, permanecem riscos inerentes a transações distribuídas: timeout ambíguo, evento fora de ordem, tarifa alterada, reconciliação tardia e necessidade de intervenção manual. O desenho deve tornar esses estados visíveis e reprocessáveis, não pressupor atomicidade entre PostgreSQL e Asaas.

Verificações pendentes:

- instalar dependências em ambiente autorizado e executar unitários, integração e E2E focal;
- testar concorrência contra PostgreSQL real: última unidade, double-spend, transições e consumo único do carrinho;
- usar gateway fake/sandbox para timeout após criação, retry idempotente, falha pós-resposta e consulta de reconciliação;
- confirmar, na documentação oficial do provedor, autenticação de webhook e suporte a chave idempotente;
- validar regras de negócio ainda não documentadas: base de EARN (bruto/líquido), juros, vencimento por método, pagamento manual e devolução física;
- verificar configurações reais de cron e ambientes sem ler/expor segredos.

## 12. Conclusão

O núcleo canônico demonstra intenção correta de autoridade de preço e reserva transacional, mas o sistema possui caminhos concorrentes e fronteiras distribuídas que quebram essas garantias. O estado observado permite checkout web inviável, criação alternativa sem pagamento, subcobrança de frete, evento financeiro perdido, baixa incompleta de variante e efeitos duplicados por concorrência. Assim, a etapa 04 termina com **1 BLOCKER, 5 CRITICAL, 9 HIGH e 1 MEDIUM**, e com publicação bloqueada pelos achados `CTR-001` a `CTR-007` e `CTR-016` até regressão dinâmica local.


---

## Revalidação de 2026-09-29 — etapa 04/15

O conteúdo anterior é histórico e foi preservado. Esta seção avalia o código local atual, incluindo mudanças sem commit, após as correções registradas em docs/remediation. Base: HEAD 0c7ef7ddfa5fb4520c4bc794163cbc71257c2bc4. O responsável autorizou continuar as etapas sem pausas. Somente relatórios são alterados.

### Resultado

Corrigido: **12**; Parcialmente corrigido: **4**. Pendências confirmadas/parciais por risco residual: HIGH 3, MEDIUM 1. Itens não verificados ficam separados de defeitos confirmados.

Corrigido refere-se ao defeito original no recorte verificado; não certifica toda a funcionalidade ou serviços externos. Confiança CONFIRMED identifica código observado e/ou teste executado, conforme a evidência; não transforma inspeção em teste dinâmico. Severidade original é preservada, e risco residual não deve ser somado entre relatórios sem deduplicação.

### Matriz dos achados

| ID | Severidade original | Estado | Risco residual | Confiança | Evidência atual, fluxo e impacto | Encerramento / regressão / limite |
|---|---|---|---|---|---|---|
| CTR-001 | BLOCKER | Corrigido | LOW | CONFIRMED | Rota /api/checkout e payload compartilhado; testes de contrato passaram. | E2E/browser e três meios reais pendentes. |
| CTR-002 | CRITICAL | Corrigido | LOW | CONFIRMED | POST /api/orders encerrado com 410; checkout é entrada canônica. | Manter rejeição sem efeitos. |
| CTR-003 | CRITICAL | Corrigido | MEDIUM | CONFIRMED | Inbox finaliza depois dos efeitos; PostgreSQL validou webhook simultâneo com worker. | Provedor real e entrega de e-mail não comprovados. |
| CTR-004 | CRITICAL | Parcialmente corrigido | HIGH | CONFIRMED | checkout.service.ts:690-706 persiste referência/fila; worker recupera falha após commit; teste real passou. | Agenda e consulta externa ainda precisam de homologação; não recriar cobrança após timeout. |
| CTR-005 | CRITICAL | Corrigido | LOW | CONFIRMED | CAS e transação em order.service.ts:435-609; cancelamento concorrente passou. | Manter teste real de exactly-once dos efeitos locais. |
| CTR-006 | CRITICAL | Corrigido | LOW | CONFIRMED | Cotação assinada/expirada/vinculada e cache inclui valores; testes transactions-remediation/cache passaram. | Tarifa/seguro externos não verificados. |
| CTR-007 | HIGH | Corrigido | MEDIUM | CONFIRMED | Header e fingerprint impedem duplicação local; última unidade + retry provados no banco. | Idempotência do gateway não presumida; chave deve sobreviver ao retry da mesma intenção. |
| CTR-008 | HIGH | Corrigido | LOW | CONFIRMED | restoreStock propaga exceções; rollback real preservou estoque. | Manter falha no segundo efeito. |
| CTR-009 | HIGH | Corrigido | LOW | CONFIRMED | Webhook schema, payment ID/referência, Decimal e billingType em route.ts:304-354. | Autenticidade do endpoint configurado real não testada. |
| CTR-010 | HIGH | Corrigido | LOW | CONFIRMED | checkout.service.ts:635-645 recalcula juros/parcelas/fee; testes ignoram valores monetários do cliente. | Homologar política financeira e centavos do adquirente. |
| CTR-011 | HIGH | Corrigido | LOW | CONFIRMED | checkout.service.ts:183-199 falha sem gateway antes de reservar no fluxo normal; bypass é específico de testes. | Credencial revogada/produção não testada; não interpretar fake como operação real. |
| CTR-012 | HIGH | Corrigido | MEDIUM | CONFIRMED | order-timeout.service.ts:57-141 distingue manual/gateway e consulta status; fila recupera ausência de payment ID. | Testes order-timeout/worker passaram; scheduler não foi acionado contra aplicação. |
| CTR-013 | HIGH | Parcialmente corrigido | HIGH | CONFIRMED | Crédito usa snapshot pointsEarned; chave única e crédito concorrente passaram no banco. Clawback insuficiente bloqueia. | Política para saldo já gasto e rateio parcial permanece pendente. |
| CTR-014 | HIGH | Parcialmente corrigido | HIGH | CONFIRMED | RefundIntent persistido; dois parciais, disputa de comandos e webhook/worker passaram no banco. Casos enviados/entregues ou disputa exigem manual. | Homologar gateway e definir logística reversa/pontos; não declarar refund completo universal. |
| CTR-015 | MEDIUM | Parcialmente corrigido | MEDIUM | CONFIRMED | Prisma Decimal e equação com fee; Cart.shippingCost já não é Float. Conversões Number continuam no adapter/cálculo parcelado. | Provar limites/arredondamento com contrato financeiro; nenhuma divergência nova reproduzida. |
| CTR-016 | HIGH | Corrigido | LOW | CONFIRMED | Payload preserva variantId, pedido conecta variante e reserva condicional baixa ambos; disputa de estoque passou. | Manter prova última unidade e variantes distintas. |

### Fluxo, fontes de verdade e prova

613/613 unitários e 26/26 integrações PostgreSQL passaram nesta rodada, com gateway/e-mail mockados e banco temporário exclusivo. Detalhes do isolamento e migrations constam da seção de revalidação de DATABASE-AUDIT.md. Os testes de handlers usam Request em memória; não equivalem a HTTP pelo Next nem ao navegador.

Carrinho → validação de sessão/tenant → preço do catálogo e cotação assinada → pedido/reserva/ledger/referência de pagamento em transação → gateway → confirmação ou fila de reconciliação → transição CAS e histórico. PostgreSQL é fonte do pedido/estoque/ledger; confirmação financeira depende do provedor. Estorno tem intenção própria, valor reservado e confirmação separada dos efeitos locais.

Os testes reais cobriram: dois workers no mesmo pagamento, falha após efeitos e antes de conclusão, webhook concorrente, confirmação tardia de cancelado, estorno observado por dois workers, dois parciais somados, reserva financeira concorrente, comando duplicado e FK de loja do estorno. O gateway foi fake em todos eles. O teste unitário de falha após resposta financeira confirma contenção da cobrança repetida; não simula o serviço externo.

### Limites e conclusão

Não foram realizados pagamentos, reembolsos, carga nem replay externo. A parte local das transações avançou substancialmente; agenda, homologação e resolução dos casos manuais ainda condicionam atendimento real. O campo de estoque pai não foi certificado para integrações externas que escrevam diretamente no banco (DB-008).
