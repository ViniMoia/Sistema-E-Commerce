# Contratos comuns e expansão de persistência — WF-04

**Data:** 04/10/2026. **Atualização:** 06/10/2026. **Baseline Git:** `1d513c2`, com alterações locais anteriores preservadas.

Este documento registra a base implementada para as próximas etapas. Não significa que os writers de compra, pagamento, estoque e pontos já utilizem as entidades novas. Nenhuma das migrations novas foi aplicada ao banco persistente. O avanço e as evidências estão no [registro de execução](REGISTRO_EXECUCAO_CORRECOES_LOGICAS.md).

## 1. Decisões de construção

| Decisão | Escolha para a implementação | Limite de ativação |
|---|---|---|
| D01 | Checkout passa a gravar `OrderBuyer`, snapshot de comprador/endereço e `Order.userID` opcional. Email não vincula conta; sessão ACTIVE na loja vincula `authenticatedUserID`, sem alterar cadastro. Token aleatório de 256 bits, hash SHA-256 persistido, validade local adotada de sete dias; leitura exige tenant e credencial em header. | Implementado no módulo em WF-05. Legados não foram convertidos por email. Entrega/renovação da credencial, recuperação após resposta perdida e navegação real precisam da intenção de WF-13, UX de WF-15 e homologação; `sessionStorage` não é um canal de recuperação permanente. |
| D02 | Manter `Product.stock` e `ProductVariants.stock` como limites disponíveis independentes, sem inventar igualdade entre agregado e soma. Separar retirada administrativa (`retiredAt`), revisão e estoque indisponível. Reservar/restituir com procedência. | WF-07 ensaiou retirada, destino indisponível, ajuste auditado/idempotente e revisões. Reservas persistidas/procedência e auditoria de legados continuam em WF-13/18; não houve backfill inferido de retirada ou reserva. |
| D03 | Calcular valores no servidor, em centavos/Decimal, congelando plano aceito. Total comercial = mercadorias − fidelidade + frete; financeiro acrescenta encargos. Cartão parcelado exige aprovação integral comprovada. | Cálculo/adapter ensaiados localmente em WF-12; conta/endpoint/limites reais e conciliação dependem de WF-14/19. Não interpretar recebimento de uma parcela de boleto como aprovação do contrato inteiro. |
| D04 | Prazo conforme método/validade externa. `UNKNOWN` exige reconciliação; não permite reenviar criação nem liberar reserva por mera passagem de uma hora. Confirmação tardia gera fato e revisão. | Práticas de consulta, retenção e intervenção operacional em WF-14; cron antigo ainda não foi migrado. |
| D05 | Política de construção `lots-fefo-debt-v1`: ganho usa prazo da loja congelado no ledger; ajustes sem prazo não expiram. Retorno válido preserva prazo/alocação; retorno já vencido gera lote compensatório separado com prazo da loja no momento da devolução, registrado explicitamente (null = sem prazo). Déficit separado, compensado antes de disponibilizar novos créditos. | WF-09 ensaiado no módulo. `accountingReady=false` protege legado: sem clamp, inferência de origem ou expiração; ganho/estorno pendentes na outbox. Conciliação/ativação WF-18, consumidor WF-14, revisão da política/UX e operação WF-19/20 continuam obrigatórios; CHECK de saldo é condicional às carteiras prontas. |
| D06 | Frete resolvido pelo servidor e vinculado ao dono, loja, itens/destino e revisão da configuração. Token/ID opaco não aceita valor escolhido pelo cliente. | Providers, cache e consumo da cotação em WF-11/15. |
| D07 | Intenção única por escopo autorizado e chave; mesma versão consumível de carrinho converge para uma intenção. Conteúdo/revisão determinam replay ou conflito. | WF-08 implementou ativo único, revisão, recibos e snapshot transacional do carrinho. Intenção/checkout e sincronização do cliente continuam em WF-13/15; `idempotencyKey` antigo do checkout não foi substituído por recibos de carrinho. |
| D08 | Comando de status sob lock/releitura do pedido, ator USER validado no banco ou SYSTEM de código conhecido. Auditoria, histórico com versão única e outbox no mesmo commit. Chave de comando escopada e hash de conteúdo distinguem replay e conflito. Política inclui modalidade. | Base de WF-06 e restituição indisponível de WF-07 ensaiadas. Reservas com procedência de WF-13, conciliação de lotes legados de WF-18 e fatos/inbox/consumidor de WF-14 permanecem pendentes. UI de expedição/retirada em WF-16; pagamento tardio ainda não gera `FinancialFact`. |
| D09 | Inbox/outbox duráveis, lease persistido, retry supervisionado e conclusão somente depois do commit dos efeitos. Timeout não vira sucesso/falha definitiva. | Interfaces e tabelas existem; executor/adapter ainda devem ser implementados em WF-14. Hospedagem/supervisão não foram definidas como fato. |
| D10 | Origem observada: PostgreSQL 18.6. Ensaio do clone em major 18; ensaios sintéticos também em 16. Backup local protegido/restaurável e build isolado executados. | RPO/RTO, retenção fora da máquina, responsáveis, capacidade, janela e alertas continuam pendentes para WF-19/20. |

Estas escolhas registram o desenho autorizado pelas propostas e o ponto em que cada comportamento pode ser ativado. As decisões ainda abertas não autorizam inventar vencimentos, estornos ou backfills.

## 2. Contratos implementados

`lib/commerce/contracts.ts` contém schemas Zod estritos, tipos derivados e versão de contrato `1`, sem Prisma/segredos/dependência de servidor:

- Item canônico: `productId`, `variantId`, quantidade inteira positiva. Preço/cor/nome do cliente não substituem identidade e autoridade monetária.
- Contexto confiável: autenticado por `userId + lojaID`, ou convidado por hash de identidade anônima. Esse contexto é construído no servidor, nunca aceito como prova a partir do body público.
- Ator: humano com User/loja ou sistema com código conhecido; não existe User fictício para webhook/cron.
- Plano: valores decimais canônicos com duas casas, parcelas cuja soma coincide exatamente com o total, base de pontos sem frete/encargos e política versionada.
- Snapshot aceito: revisão, hash, itens, modalidade, cotação e plano. Dados de cartão, senha e tokens de sessão são rejeitados.
- Resultado/replay: `AWAITING_PAYMENT`, `CONFIRMED`, `CANCELLED`, `REQUIRES_REVIEW`; status comercial e financeiro explícitos. Resultado incerto não é confirmação. Cancelamento pode ter reembolso pendente.
- Falhas: autorização, ausência, versão, idempotência, recotação, estoque, capacidade, transição e entrada. Um 2xx genérico não prova pagamento.

O esquema de plano é uma validação de consistência, não autorização para o cliente escolher seu valor. Cálculo e comparação com o consentimento são responsabilidades de WF-12/13. Retorno de gateway continua exigindo validação no adapter.

`lib/commerce/gateway.ts` define interfaces de gateway/executor e resultados KNOWN/UNKNOWN/UNAVAILABLE. Não foi implementado um gateway simulado como substituto de produção. Instrumento efêmero não integra os snapshots persistíveis; a estratégia de tokenização suportada pelo Asaas ainda exige homologação. Nenhum PAN/CVV deve ir a inbox/outbox, log ou retry durável.

## 3. Expansão versionada

Migration: `prisma/migrations/20261004000000_commerce_contracts_expansion/migration.sql`, transacionada com `lock_timeout=10s`. As 20 migrations históricas não foram alteradas.

| Entidade | Responsabilidade e garantia estrutural |
|---|---|
| OrderBuyer | Snapshot e recuperação; referência composta impede vínculo de conta de outra loja. Email não é chave de autenticação. |
| CheckoutIntent | Unicidade loja/dono/chave e carrinho/versão; pares cartID/cartVersion coerentes. User e buyer pertencem à mesma loja. |
| PaymentAttempt | Número por pedido, referência interna única, plano/valor, estado e revisão; SUBMITTING/UNKNOWN representáveis. |
| PaymentCharge | IDs externos separados, provedor/ID único e ordinal por tentativa; não confundir cobrança com parcelamento. |
| FinancialFact | Identidade do fato do provedor, não apenas webhook/status do pedido. Estornos parciais distintos não são bloqueados por unicidade por pedido/tipo. |
| InventoryReservation | Uma por item, quantidade positiva, estado/revisão. FK composta vincula variante ao produto. Preserva referências históricas. |
| LoyaltyLot / LoyaltyAllocation | Crédito/remanescente não negativos e alocação positiva, origem e procedência de restituição; um crédito pode originar lotes distintos por `sourceKey`. |
| PaymentInbox / CommerceOutbox | Unicidade do evento/efeito, READY ao receber, lease completo e tentativas não negativas. Não existe worker implícito. |
| FreightQuote | Loja/dono, hashes, revisão, modalidade/provider, custo e prazo não negativos, validade. |

Cart/Order receberam `version`; Product/Variant receberam revisão, retirada e quantidade indisponível; Loja recebeu revisão de configuração; wallet recebeu `debt`; histórico/auditoria receberam ator discriminado e chaves de efeito/comando. Campos existentes são conservados. Atores humanos continuam usando FKs e não são apagados silenciosamente ao excluir conta.

Invariantes de soma, FEFO, autoridade/estado financeiro, correlação entre todas as entidades e versão consumida exigem comandos transacionais. Não são garantidas por uma FK simples ou por criar tabelas. Constraints finais sobre dados legados e saneamentos continuam em WF-18. Não preencher guest/reserva/lote/fato por inferência sem evidência.

## 4. Ordem de locks

`lib/commerce/locks.ts` oferece uma instância `CommerceLocks` por transação:

`CheckoutIntent (10) → escopo de criação do carrinho (15) → Cart (20) → Order (30) → todos os Products (40) → todas as Variants (50) → Wallet (60) → Lots (70)`.

IDs são deduplicados e ordenados de forma determinística, com `ORDER BY id COLLATE "C" FOR UPDATE`. A instância recusa inversão de categoria, obtenção posterior de ID menor e chamadas concorrentes de acquire na mesma transação. Autorizar escopo antes do lock e reler condição de negócio depois dele. Não chamar gateway/provider enquanto mantém locks.

Linha inexistente não é protegida por `FOR UPDATE`; criação necessita pai serializador e/ou unicidade. O helper não converte os writers antigos automaticamente, nem garante inexistência de ciclos de FKs implícitos. Admin/papéis/auth têm protocolo próprio a registrar em WF-10; mapear essas arestas na migração dos escritores. Uma ordem por item que alterna produto/variante não deve ser introduzida no protocolo novo.

`acquireCartOwner` usa advisory lock transacional por loja/usuário, incluindo a criação sem linha existente. Colisão do hash apenas serializa escopos diferentes; a unicidade parcial `Cart_active_owner_key` também é imposta no PostgreSQL. O helper recusa múltiplos escopos e inversão; reaproveitar o mesmo lock já adquirido é permitido. Mutações/leitura de carrinho e consumo alternativo usam escopo → linha → produtos/variantes; intenção canônica ainda precisa aplicar essa ordem em WF-13. Ensaios PostgreSQL verificaram criação simultânea, revisões, replay, conflito e consumo concorrente.

## 5. Compatibilidade e saída

- Clone restaurado: IDs, vínculos, valores, estoques, pontos/status existentes e sequências permaneceram iguais nos campos originais; schema final teve diff vazio. Novos campos/entidades não fabricam eventos históricos.
- Dados pessoais/segredos foram sanitizados somente no clone, com exclusões explícitas na comparação; o backup original ficou criptografado fora do Git.
- Fixtures foram adaptadas para remover apenas suas entidades novas na transação de cleanup. Uma FK externa continua revertendo o cleanup inteiro.
- Consumidores de comprador incluem Admin, dashboard e template de email, com snapshot e fallback legado; credencial/hash não integram a seleção pública. Histórico Admin distingue ator SYSTEM/USER e ordena por versão, data e ID, preservando registros legados sem versão. Navegação em navegador e envio externo de email ainda não homologados.
- Contratos puros, checks/FKs/unicidades e locks têm testes próprios. Writers de webhook/checkout continuam antigos; LA-002/003/004/005/020/033 e demais não estão encerrados pela expansão.
- O Prisma Client foi gerado. **Executar a aplicação com esses modelos contra banco sem as migrations novas pode falhar por coluna inexistente.** Desenvolvimento/validação usam ambiente descartável; a aplicação persistente deve receber DDL e código na sequência futura aprovada de WF-18/20. Não executar `db push`/reset para contornar isso.

WF-04 tem base implementada e ensaiada. Revisão integrada dos escritores e contratos externos continua nos blocos seguintes e em WF-19. Prontidão para produção exige todos esses gates, além de WF-20.

## 6. Integração da base em 05/10

Novas migrations de WF-05/06: `20261005000000_purchase_tenant_scope`, `20261005010000_separate_guest_buyer` e `20261005020000_order_command_receipts`. Incluem FKs compostas de carrinho/itens/conta, nullable do titular com CHECK de comprador/titular, recibo de comando e unicidade de versão de histórico. WF-07/08 acrescentaram `20261005030000_catalog_revision` e `20261005040000_cart_active_uniqueness`. Não alteram as 20 migrations históricas. A trajetória agora contém 27 migrations; a unicidade parcial exige inspeção SQL própria porque não é representada pelo datamodel Prisma.

`account-scope.ts` valida conta ACTIVE/tenant; `order-buyer.ts` concentra snapshot e autorização por credencial; `order-command.ts` serializa transições. As rotas constroem ator e tenant pelo contexto servidor, sem aceitar ator SYSTEM do body. Os códigos legados conhecidos de gateway/cron/compensação têm adapter explícito; prefixos semelhantes não concedem autoridade.

A outbox já recebe `ORDER_STATUS_CHANGED` com identidade por pedido/versão na transação. **Ainda não há consumidor durável operacional**: a existência do registro preserva a intenção, mas não comprova entrega de notificação, projeção ou invalidação de cache após processo morto. A invalidação local imediata é somente best effort. Não tratar esse registro como efeito externo entregue.

## 7. Integração de WF-09 em 05/10

Migration adicional `20261005050000_loyalty_lot_accounting` eleva o histórico a **28 migrations**. Lotes/alocações agora têm escritores transacionais e origem de restituições; ledger registra deltas de disponível/déficit e snapshot de política. Carteiras prontas conservam `balance = soma(remaining) = soma(availableDelta)` e `debt = soma(debtDelta)`, sem disponível negativo ou disponível positivo simultâneo a déficit positivo. FEFO considera null como explicitamente não expirante e desempata por criação/ID. Remanescente vencido é baixado uma vez por lote; restituição usa novo lote.

D05 está detalhado na seção14 do [registro de execução](REGISTRO_EXECUCAO_CORRECOES_LOGICAS.md): prazo válido conservado; compensação após prazo com termo vigente da loja explicitamente congelado; déficit compensado antes de disponibilizar novos créditos. A versão de construção não é uma homologação operacional dessa política.

`accountingReady=false` preserva integralmente carteiras antigas, inclusive negativas: não há backfill de lotes, clamp ou ativação por inferência. Os writers do protocolo novo criam carteiras prontas apenas sem ledger legado desconhecido; transição de carteiras históricas permanece em WF-18. Ganho/estorno não conciliados geram comandos `LOYALTY_RECONCILE_EARN`/`LOYALTY_RECONCILE_REFUND` idempotentes na outbox, e não um saldo fictício. Consumidor/reconciliação continuam em WF-14/18; pendência não equivale a efeito entregue.

Expiração automática atua somente em carteiras prontas, com lock/releitura de carteira/lotes, identidade por lote e lease de60s por carteira para eficiência. Lease vencido pode ser retomado; a correção depende de locks/recibos. Não há serviço de cron supervisionado implantado. Comandos independentes de pedido devem bloquear pedido antes do motor; chamadores com transação fornecida possuem pedido pré-bloqueado ou recém-inserido. Código e schema devem ser ativados em conjunto, sem permitir que writers antigos alterem carteiras prontas.

## 8. Integração de WF-10 em 05/10

Migration `20261005060000_password_reset_lookup` eleva o histórico a **29 migrations**, só índice loja/token. Recuperação guarda digest versionado com bearer de 256 bits/prazo de 1 hora. Emissão/consumo bloqueiam User antes de calcular/reavaliar relógio; bcrypt/email fora de locks. Password/token/sessões compartilham commit; login revalida credencial corrente antes de emitir sessão. Tokens plaintext são preservados fisicamente, mas recusados pelo código novo e exigem reemissão; sem backfill de passwords.

D08 para elegibilidade: Loja → User ordenados por ID → sessão/auditoria. ROLE/STATUS reautorizam ator ADMIN ACTIVE/alvo da loja sob locks e contam somente administradores ativos; efeitos/auditoria/revogação atômicos. Autopapel/autobloqueio recusados; nenhuma rota nova de bloqueio/exclusão/transferência. DELETE/TRANSFER recusados; eventual introdução exige preservar vínculos e administradores das duas lojas. Legado sem admin não é autopromovido. Script fixo desabilitado; recuperação excepcional está no [runbook](RECUPERACAO_ADMINISTRATIVA_WF10.md), ainda não executado/homologado.

Evidências/compatibilidade/contingência: seção 15 do [registro de execução](REGISTRO_EXECUCAO_CORRECOES_LOGICAS.md). Rollout precisa drenar writers antigos e coordenar instâncias; voltar a consumidores plaintext não é contingência segura. Provider de email, custo de autenticação, identidade operacional/IAM/MFA e QA de navegador permanecem nos gates de integração/produção.

## 9. Integração de WF-11 em 05/10

Migration `20261005070000_freight_authority` eleva o histórico a **30 migrations**. D06: cotação v2 persistida e assinada, com identidade de conta/cookie de convidado, catálogo e destino CEP/UF/IBGE obtidos no servidor. Assinatura vincula registro/conteúdo/destino/loja/dono/modalidade/provider/serviço/valor/prazo/revisão/deadline/snapshot. Frete livre do payload não é autoridade; DELIVERY exige token, e PICKUP/NONE sem token usam apenas política gratuita habilitada relida sob lock.

Fingerprint canônico inclui preço integral/valor declarado antes de pontos, dados logísticos/pacote, quantidades/IDs/revisões e origem/configuração/tabela global. Cache v2 por instância conserva cálculo/lista de serviços do conjunto fixo de providers; emissão em cache hit cria novo registro/token do dono com a mesma validade comercial, após releitura. TTL de 30min e limite 500 entradas são otimizações. Quatro triggers persistem revisão no mesmo commit de configurações/regras/tabelas J&T. Regra municipal tem UF/IBGE explícitos; null/null legado é preservado e inabilitado para autorizar entrega.

Revisão global FOR SHARE → Loja FOR SHARE precedem escopo de carrinho/Cart e produtos. Emissão usa produtos FOR SHARE; aceite usa FOR UPDATE antes de inventário para evitar upgrade concorrente. Relógio é lido após locks. Serviço geográfico/transportadoras são consultados fora da transação; após I/O há revalidação antes de persistir/assinar. Regras Admin usam Loja FOR UPDATE, ator ADMIN ACTIVE relido e auditoria/revisão atômicas. Locks do pai também serializam mudanças de elegibilidade administrativa.

Pedido novo conserva snapshot aceito; histórico não é recotado nem recebe snapshot fabricado. Tokens v1 ficam inválidos. Falha de provider não gera tarifa gratuita/estimada; falha parcial não é cacheada como sucesso completo. O catálogo usa seus defaults logísticos existentes quando dados são null; pacote continua estimado e requer confirmação física/comercial. Matriz J&T fica restrita à origem de importação declarada pelo adapter. Transporte/CEP reais, múltiplos volumes/limites, legado, chaves, retenção, capacidade e rollout ainda não foram homologados.

Evidências: seção 16 do [registro de execução](REGISTRO_EXECUCAO_CORRECOES_LOGICAS.md). Integração de intenção/consentimento/finanças/UX completa permanece em WF-12/13/15/19/20. Nenhum writer/worker externo foi implantado; não executar aplicação persistente com modelos novos antes da sequência DDL/código aprovada.

## 10. Integração de WF-12 em 05/10

Migration 20261005080000_payment_plan_authority eleva o histórico a 31. Quatro flags de método default false; financeiro/encargo/plano/política de ganho nullable no legado; pointsCredited inicia como projeção não preenchida do protocolo novo. Null de snapshot indica política histórica desconhecida, não ausência comprovada de crédito. Dois CHECKs exigem coerência das colunas financeiras e crédito registrado não negativo. Trigger de Loja incrementa revisão junto com mudanças de capacidade/instruções/fidelidade, sem habilitar métodos/backfill presumido.

D03: total comercial = mercadorias − fidelidade + frete; financeiro acrescenta encargos. Cálculo Price racional/HALF_UP em centavos, taxa 0 e absorção explícitas; residual na última parcela. Plano congela política/configuração/revisão/valores/parcelas. Cartão exige consentimento do total financeiro; installmentValue externo não autoriza cobrança. Adapter 1x usa value;2+ usa totalValue e contagem, identifica contrato e valida todas as cobranças. Primeiro recebimento isolado não aprova contrato inteiro. Plano/adapter são evidência local, sem homologação da conta/endpoint Asaas.

Capacidade por loja/ambiente combina flags frescas, allowlist explícita e cliente com chave/host de API capturados compatíveis. Dados públicos de capacidade não contêm segredo. Criação remota fica desabilitada por padrão; máximo 1 sem homologação explícita de parcelas. PIX manual depende de flag/instruções e conferência própria, sem fallback do automático. Desligar novas vendas não bloqueia consultas de pagamentos existentes; worker está pendente. Escrita administrativa reautoriza ator sob Loja FOR UPDATE; aceite mantém Loja FOR SHARE.

D04/D09: pedido e tentativa SUBMITTING são gravados antes do I/O, na mesma transação; chamada externa acontece após commit. Artefatos e cobranças válidos persistem sob lock antes de emitir sucesso. Falha ambígua vira UNKNOWN com conciliação; aprovação já persistida conserva APPROVED e agenda aplicação local pendente. Replay não recria cobrança. Novos planos remotos exigem APPROVED antes de PAID, e recusa/cancelamento/reembolso confirmado antes de CANCELLED/liberação. Resultado HTTP202 significa verificação, sem instrução fictícia. Inbox/fatos/worker/eventos/cancelamento/estorno/expiração por método permanecem em WF-14.

D05: net-merchandise-floor-v1 congela base líquida sem frete/encargos, taxa, elegibilidade, revisão e prazo; floor em Decimal. Confirmação credita uma vez pelo snapshot, mesmo após alterações de configuração. pointsEarned é previsão; pointsCredited registra o efeito aplicado. Prazo congelado inicia na confirmação. Legado sem snapshot gera pendência, sem política corrente fabricada. Reversão integral segue origem de WF-09; estorno parcial proporcional exige fatos/consumidor posteriores.

Evidências e limites: seção 17 do [registro de execução](REGISTRO_EXECUCAO_CORRECOES_LOGICAS.md). DDL/código precisam de rollout coordenado; não habilitar remoto antes de conciliação/homologação. Intenção/revisão/consentimento completos e reservas com procedência são WF-13; navegador/múltiplas abas/recuperação são WF-15/19. Nenhuma migration persistente, cobrança, estorno, commit ou deploy foi executado.

## 11. Integração de WF-13 em 05/10

Migration 20261005090000_checkout_intent_authority eleva o histórico a32. `CheckoutIntent.protocolVersion=1` distingue a fonte/protocolo novo; legado mantém null e não é associado por aparência. Carrinho/versão e basket de convidado possuem unicidade de intenção; `Order.sourceCartID` é único, com FK de tenant. Basket tem uma geração monotônica por tenant/dono e unicidade parcial ACTIVE. CHECK e cinco triggers protegem fonte, commit completo, procedência das reservas, imutabilidade contratada e não reabertura. Banco vazio/sintético e clone protegido passaram, sem fontes/reservas históricas fabricadas.

D07/D08: contexto vem de sessão ACTIVE/tenant ou cookie opaco HttpOnly, nunca de email/chave do payload. Serialização por tenant/dono antecede intenção/Cart; revisão global/Loja precedem catálogo. Cada nova conclusão exige ID/revisão/hash da proposta do servidor. Prazos/aceite usam o relógio do PostgreSQL após locks/recalculo. Proposta contém catálogo/variante/quantidade, comprador/endereço, frete, plano/resgate/ganho e instruções manuais; PAN/CVV e chaves de transporte ficam fora. Linhas repetidas são agregadas, quantidades não são arredondadas, e produto agregado/variante são ambos verificados. Item/reserva/DTO conservam o ID e os rótulos resolvidos pelo helper compartilhado.

Mesmo commit grava comprador, pedido/plano/snapshot, estoque/reservas por item, débito/lotes, tentativa, consumo, intenção aceita, auditoria e outbox. Fonte concluída nunca reabre. Nova fonte de convidado exige ação explícita sobre a geração anterior e resultado financeiro conhecido; UNKNOWN/SUBMITTING/transições financeiras pendentes não autorizam outra fonte. Nova compra autenticada usa outro ACTIVE criado pelo comando de carrinho.

D04/D09: ambas as APIs de criação e o adapter interno convergem em `createOrder`; contrato antigo incompleto recebe422 e evento sem payload sensível. Chave global histórica permanece, mas não é consultada como autoridade de criação/replay. GET de intenção exige a mesma identidade/tenant e usa o mesmo DTO da primeira resposta/repetição. Estado pago exige projeção/prova compatíveis; cartão pendente/UNKNOWN não recebe PIX nem aprovação fictícia. Cancelado/recusado/revisão não recebe nova instrução de pagamento. Instruções PIX manual/WhatsApp estão congeladas em `financialSnapshot`; mudança da loja não altera uma compra contratada.

Credencial de pedido convidado usa HMAC com finalidade separada no segredo privado já exigido para frete; seu hash e prazo ficam no comprador. Retomada por cookie pode reencontrá-la sem guardar segredo no JSON e sem ampliar prazo. Após rotação, não entregar um token derivado que não corresponda ao hash existente. Perda de identidade/rotação/retencão requer política operacional, sem recuperar por email declarado.

Consumidor exibe revisão do servidor antes de cobrar e inclui ID na URL antes da conclusão. Confirmação/refresh buscam/pollam resultado autorizado, inclusive sem sessionStorage; limpeza local exige correspondência ao carrinho consumido. Integração mínima foi compilada e backend ensaiado, sem homologação completa de navegador/abas/rede ou das mutações antigas do store.

Reservas novas passam RESERVED→COMMITTED no PAID e RELEASED/RETURNED no cancelamento autorizado, com restituição uma vez e retirada indisponível conservada. Reserva incompleta exige revisão. Legado/concorrência financeira, expiração por método, inbox/fatos/outbox/worker, reembolso parcial e aplicação de aprovação ainda dependem de WF-14/18/19. Evidências: seção18 do [registro de execução](REGISTRO_EXECUCAO_CORRECOES_LOGICAS.md):558 unitários,175 integrações,32 migrations e build de53 páginas. Não há autorização implícita de ativação remota nem declaração de produção pronta.

## 12. Integração de WF-14 em 05/10

**D03/D04/D08/D09 — contrato vigente para o protocolo novo.** As seções10/11 descrevem os checkpoints anteriores. O núcleo de inbox/fatos/outbox/worker, operações financeiras e expiração está construído localmente; ativação e homologação externa continuam pendentes. Migration `20261005100000_durable_payment_execution` eleva o histórico a33, com conta/leases/prazos, PaymentOperation, quatro CHECKs e dois triggers. Não deduz conta, vencimento ou operações legadas.

### 12.1. Evidência e execução

1. Receber webhook significa gravar envelope seguro no PaymentInbox com identidade provedor/conta/evento. Sem ID externo, hash determinístico do envelope. HTTP RECEIVED não é PAID/PROCESSED. Marcadores PaymentWebhookEvent anteriores permanecem históricos, não são prova de conclusão.
2. Consumidor usa lease com dono aleatório/prazo de dez minutos e SKIP LOCKED; confirmação exige dono/prazo válidos. Trabalho abandonado é recuperável; dez falhas levam inbox/outbox à revisão durável. Retry tem backoff, não recriação de cobrança.
3. Gateway é consultado fora da transação. ID/ref/método/contrato/parcelas/valores são confrontados integralmente; consulta incompleta mantém incerteza. Order FOR UPDATE → fencing do trabalho → fatos/projeções/efeitos comerciais/histórico/auditoria/outbox/ack no mesmo commit. Nada financeiro é inferido apenas do evento.
4. AUTHORIZED distingue confirmação de SETTLED/recebimento. Fato único por cobrança/tipo não é soma do total do pedido a cada parcela. Trigger rejeita mutação e procedência incompatível quando os vínculos estão presentes. Legado genérico sem vínculo não é transformado em prova completa.
5. SUBMITTING/UNKNOWN nunca autoriza outro POST de criação. Recuperação por referência e GETs dos IDs conhecidos preserva a tentativa. ExternalReference é filtro, não unicidade remota garantida ([Asaas](https://docs.asaas.com/reference/listar-cobrancas)). Timeout de oito segundos inclui leitura do corpo da resposta.
6. Nova venda desabilitada não impede conciliação da conta configurada. ASAAS_ACCOUNT_SCOPE vem do servidor, default primary; não é chave/token/ID fornecido pelo comprador. Troca de conta exige procedimento de compatibilidade, sem reassociar tentativa histórica.

### 12.2. Reversões e estoque

Estados da tentativa são distintos do Order. CANCEL_PENDING/REFUND_PENDING e REVIEW devem aparecer no DTO via `financialState`/resultado canônico. APPROVED não é liquidação de todas as parcelas. Resposta HTTP de DELETE/refund não é prova final; consulta confirma DELETED/REFUNDED compatíveis.

PaymentOperation por cobrança/tipo tem identidade imutável: READY → SUBMITTING → PENDING ou UNKNOWN → COMPLETED mediante prova. Não rearmar READY após submissão. Interrupção entre parcelas admite enviar só operações READY restantes; SUBMITTING/UNKNOWN são consultadas, sem reenvio cego. Cancelamento concorrente com aprovação relê estado antes de iniciar DELETE.

Reversão nova tem prazo de revisão de24h desde a solicitação pelo relógio do banco, tanto no comando Admin quanto no cancelamento por expiração. Não reutiliza deadline vencido da criação da compra; replay conserva a janela da primeira solicitação.

Estorno integral confirmado em pedido não expedido usa comando central e devolve reserva uma vez. SHIPPED/DELIVERED estornado conserva estoque COMMITTED e projeta PHYSICAL_RETURN_REQUIRED; retorno físico depende de procedimento próprio, não do dinheiro. Pagamento tardio em CANCELLED grava fatos/alerta SYSTEM preservando notas, sem reabrir a compra ou retirar estoque novamente. Parcial/chargeback/estado desconhecido exige revisão. Automação de estorno de boleto não foi habilitada sem dados/contrato bancários homologados.

Manual: administrador ACTIVE confirma PAID; fato AUTHORIZED registra atestação humana, não SETTLED bancário. Cancelamento comercial de manual pago conserva REFUND_PENDING até atestação de devolução. REQUEST_REFUND/CONFIRM_REFUND usam comando/versão/autoria/hash de referência; serviço não transfere dinheiro. Manual entregue também exige retorno físico distinto.

### 12.3. Prazos, calendário e relógio

Política versão1 está no conteúdo aceito/plano: manual24h; boleto72h de tolerância de confirmação além do vencimento externo; PIX usa expiração explícita com timezone do artefato. Boleto com data brasileira vence ao final desse dia (03:00 UTC seguinte). Cartão em análise/resultado incerto não recebe prazo genérico de uma hora. Política exige aceite operacional antes de ativação.

Seleção do job usa deadline persistido e clock_timestamp do PostgreSQL. Consulta remota sem lock precede releitura de estado/deadline sob Order FOR UPDATE. Candidato que virou PAID não é cancelado. Pagamento remoto ainda pagável gera operação CANCEL_PENDING com estoque retido até prova de exclusão. Indisponibilidade conserva reserva/pendência. dryRun não escreve. NULL legado não recebe prazo deduzido da idade.

Datas de fatos: paidAt normalizado é usado se fornecido; caso contrário occurredAt é observação no banco. O adapter atual não oferece todas as datas bancárias por tipo. Métricas/histórico fiscal de WF-17/18/19 precisam distinguir essa ausência, sem assumir data real de liquidação/estorno.

### 12.4. Notificação e operação

Outbox financeira é persistida com os efeitos. Email congela payload/destinatário/from/data antes do primeiro I/O e usa mesma chave Resend em retries. Sem prova de envio, mantém pendência; após23h interrompe retry automático para não ultrapassar a [janela de idempotência de24h do Resend](https://resend.com/changelog/idempotency-keys). Não refazer mensagem com preços/identidade atuais. Comando sem consumidor fica em DEAD_LETTER, não conclusão fictícia; conciliação legada de fidelidade continua em WF-18.

Endpoint /api/cron/payments executa inbox → conciliação → expiração → outbox; limit1–5, Bearer CRON_SECRET. /status expõe somente agregados operacionais. ADMIN pode solicitar operação integral, nova conciliação ou atestar estorno manual; não pode rearmar operação incerta pelo endpoint de retry. Respostas são estados persistidos, não confirmação de dinheiro movimentado.

PAYMENT_WORKER_ENABLED=false e PAYMENT_EXPIRATION_ENABLED=false são defaults documentados; .env intacta. A flag não comprova vida do scheduler. Só ativar recepção após DDL/código, scheduler monitorado, conta/token/segredos corretos, capacidade/alertas/revisão homologados. Não usar o simulador antigo para inventar prova financeira; está retirado do fluxo.

Evidência naquele checkpoint: seção19 do [registro](REGISTRO_EXECUCAO_CORRECOES_LOGICAS.md):568 unitários/71 arquivos,211 integrações/15 arquivos (36 novas), schema33/diff/reaplicação e clone protegido aprovados, build isolado55 páginas e lint direcionado limpo. O avanço posterior da WF-15 está na seção13 abaixo e na seção20 do registro. Processo morto em infraestrutura real, sandbox, calendário/dados externos, estorno parcial/retorno físico, legado/datas, scheduler/observabilidade e produção continuam pendentes.

## 13. Consumidores, endereços e relógios — WF-15

### 13.1. Cotação e consentimento no cliente

Request compartilhado em `lib/commerce/freight-contract.ts`: lojaID, destinationCep de oito dígitos, deliveryType=DELIVERY e itens por productId/variantId/quantity. Não há preço/peso/dimensões autoritativos no cliente. Response é success/data com serverTime, merchandiseSubtotal decimal e options com provider/service, preço, dias, freightQuoteToken, freightQuoteId e expiresAt obrigatórios. Handler e formulário validam o mesmo envelope. Opção ausente/erro/expiração não autoriza DELIVERY por zero.

serverTime é observação do PostgreSQL na emissão/recuperação, não atributo imutável da compra. Cada resposta pode ter horário diferente mantendo o mesmo resultado persistido. Cliente calcula validade por diferença entre prazo e serverTime, somada ao elapsed monotônico de performance.now iniciado antes da requisição; não usa Date.now do dispositivo como autoridade nem prolonga validade pelo tempo do transporte. Proposta também fornece serverTime. Resposta antiga só se aplica enquanto sua geração CEP/frete/proposta continua atual; abort não é prova suficiente de invalidação.

Shipping/billing fazem parte do conteúdo aceito. Alteração de fonte/quantidade/endereço/modo/método/pontos/parcelas/cotação revoga revisão local anterior. Conclusão continua exigindo acceptedRevision/acceptedContentHash e o servidor relê invariantes. Serialização/desabilitação de UI não substitui locks/revisões do banco.

### 13.2. Endereços

Novo draft explicita shippingAddress e billingAddress, ou billingSameAsShipping=true para reutilização. Boleto/cartão exigem cobrança completa em todas as modalidades. DELIVERY exige entrega; PICKUP/NONE não recebem shippingAddress artificial. `checkoutAddressSchema` valida CEP, UF brasileira e campos obrigatórios antes de persistir efeitos. Gateway recebe dados de cobrança. `OrderBuyer.deliveryAddress` e `billingAddress` conservam snapshots separados, sem alterar User/Address pessoais.

Um `address` legado só é traduzido enquanto nenhum campo explícito/reutilização tenha sido informado. Não implica interpretação retroativa de pedidos históricos. Novo conteúdo muda o hash da proposta: revisão/aceite de propostas abertas precisam ser atuais; ordem já colocada se recupera por intenção autorizada. Handler/DTO/formulário devem ser publicados coordenadamente; novo consumidor bloqueia resposta antiga sem prazo/contrato completos. Não há migration ou backfill desta etapa.

### 13.3. Carrinho e identidade

CartProvider recebe loja/usuário resolvidos pelo servidor. Fila local por identidade envia commandId/cartId/expectedVersion; falha de transporte pode repetir o mesmo comando uma vez, conflito409 exige leitura. Resposta de outra identidade ou recibo COMPLETED não é adotado como ACTIVE. Troca de contexto cerca reads/mutações antigas e limpa dados;401/403 produzem erro explícito, não estado parcialmente autenticado.

GET mostra preço atual do catálogo, mantendo revisão da fonte; a proposta continua recalculando. Bootstrap/falha/vazio são distintos; atualização em segundo plano conserva rascunho e bloqueia conclusão até sincronizar. BroadcastChannel só anuncia invalidação, com busca ativa ao receber/focar/retomar. Sem suporte ao canal, foco/retomada continuam disponíveis; backend não perde garantia de revisão. Cada aba continua responsável por consultar a autoridade atual.

Confirmação recebe sourceCartID e sourceCartVersion da intenção persistida; invalida somente a fonte conhecida e busca ACTIVE atual, preservando outro carrinho/itens novos. sessionStorage é apoio opcional para ID, sem payload/autoridade financeira. URL e backend autorizado permitem retomada após resposta perdida/storage indisponível. Não se arquivam ACTIVE legados em massa.

### 13.4. Estado e ações financeiras

DTO de compra inclui financialState/paymentState, allowedActions, versão comercial, serverTime e paymentExpiresAt. Ações são PAY_PIX, PAY_BOLETO ou CONTACT_MANUAL somente quando estado/artefatos/prazo permitem. Expiração retira instruções; não infere CANCELLED nem devolução de estoque. Backend permanece responsável pela reconciliação/expiração real.

Cliente representa UNKNOWN/SUBMITTING, análise, REVIEW, recusa, CANCEL_PENDING/CANCELLED e REFUND_PENDING/REFUNDED separadamente. Polling sequencial com backoff continua após aprovação e revalida ao retomar. Falha de leitura suspende ações sem reativar artefatos antigos. Boleto incompleto não é apresentado como emitido; PIX manual informa conferência humana, sem alegar aprovação imediata/liquidação automática. QR não usa gerador externo. Recuperação preserva autorização de usuário/convidado/tenant existente.

Evidências da seção20 do [registro](REGISTRO_EXECUCAO_CORRECOES_LOGICAS.md):597 unitários/73 arquivos e230 integrações/17 arquivos, incluindo matriz de12 combinações método/modalidade e quatro casos em Chrome headless sobre Next/PostgreSQL isolados; typecheck e build55 páginas aprovados. Há dois avisos preexistentes de `<img>` no lint. Harness de frete usa handler/orquestrador/provider local reais com geografia/identidade injetadas; checkout/carrinho/recuperação HTTP mantêm sessão/tenant reais. Não houve banco persistente, pagamento, email, atualização de dependências ou deploy. Candidato sob next start, matriz ampliada de navegação/cobrança, serviços sandbox, calendário/políticas reais, legado e operação continuam em WF-18/19/20. **Naquele checkpoint, o próximo pacote era WF-16, com cinco etapas restantes. O estado posterior consta na seção14 e na seção21 do registro.**

## 14. Expedição e retirada administrativas — WF-16

### 14.1. Comando e rastreamento

Modal envia newStatus, expectedVersion, commandId e, ao expedir, trackingCode e shippingProvider. Provider é asserção contra o frete persistido, nunca alteração de cotação/transportadora/totais. O comando relê status/modo/provedor/tentativa sob lock do pedido. Status, tracking, incremento de versão, audit, histórico e outbox são um único commit. Código integra o hash; omissão e null diferem. Replay compatível consulta o estado atual sem reaplicar efeitos; outro conteúdo/ator ou versão incompatível produz conflito.

DELIVERY/CORREIOS exige código ao expedir, com formato de duas letras/nove dígitos/duas letras e maiúsculas. DELIVERY/LOCAL_TABLE e provedor ausente/outro legado têm código opcional/genérico (trim, caixa preservada, máximo128, sem espaços internos/controles). Formato não comprova emissão/postagem. PICKUP/NONE não expede nem exige código. Não há placeholder, reclassificação em massa ou backfill. Histórico sem código pode confirmar recebimento; dados legados inválidos não impedem automaticamente operações financeiras sem edição.

PATCH tracking exige trackingCode, commandId e expectedVersion. Só Admin ACTIVE da loja, DELIVERY e PAID/SHIPPED/DELIVERED financeiramente elegíveis podem editar. Reusa executor, validação, locks, recibo, auditoria e histórico da versão; não muda status. Código obrigatório não pode ser apagado depois de expedir. Ações de edição são auditadas como ORDER_TRACKING_UPDATED. Outbox mantém envelope de ORDER_STATUS_CHANGED com changeType=TRACKING; esse evento não emite confirmação de pagamento quando o status permaneceu PAID. Consumidor precisa ser publicado com o novo comando.

### 14.2. Modalidade, identidade e leitura

Ações administrativas vêm de allowedOrderActions, pela modalidade/status/tentativa mais recente. Política de transição é compartilhada, revalidada dentro do comando; DTO de ações não autoriza operação futura. PICKUP/NONE PAID→DELIVERED direto; DELIVERY segue expedição. SHIPPED legado de retirada pode concluir sem classificação retroativa.

Cliente confirma somente o próprio pedido pelo mesmo executor. Auditoria preserva ator/origem; Admin não grava deliveredConfirmedBy/At como confirmação pessoal do cliente. Ator humano usa lock compartilhado antes do pedido, na ordem adotada por supervisão/estorno. Revisão/unknown/refund/submitting não permitem fluxo logístico incompatível.

Drawer valida id/version/status/modalidade/política e relê após mutação. Não restaura objeto antigo por patch otimista. Conflito409 mantém erro visível e reconsulta detalhe/listagem, sem repetir a intenção sobre outra versão. Falha de releitura bloqueia ações até recarga; conteúdo salvo não é declarado perdido. CommandId permanece vinculado ao conteúdo durante retry de transporte. Edição de notas também relê para não restaurar status/versão antigos.

### 14.3. Evidência e ativação

Seção21 do [registro](REGISTRO_EXECUCAO_CORRECOES_LOGICAS.md): **612 unitários/74 arquivos**, **255 integrações/19 arquivos** (21 novos de domínio/HTTP e quatro novos de Admin no navegador), typecheck, lint da etapa e build55 páginas aprovados. Nenhuma migration/schema/backfill novo, .env/dependência/banco persistente/flag financeira alterados, operação externa, commit ou deploy. As33 migrations existentes foram reaplicadas nos bancos descartáveis.

Fixtures não homologam emissão de rastreio nem postagem externa. Chrome usa Next dev/webpack, não o candidato executando sob next start. Publicar UI/DTO/handlers/política/outbox juntos; não reativar edição antiga sem versão ou fabricar rastreio histórico. Legado/transportadoras novas, candidato, matriz ampliada, sandbox, operação/observabilidade e rollout continuam nos gates seguintes. **Próximo pacote naquele checkpoint: WF-17; restavam quatro etapas principais, WF-17–WF-20. O projeto ainda não estava pronto para produção.**

## 15. Indicadores financeiros de clientes — WF-17

### 15.1. Política de reconhecimento

LIFETIME_RECOGNIZED_NET_V1, BRL, todo o histórico até o snapshot. LTV = principal reconhecido menos estornos confirmados; ticket = LTV/quantidade de pedidos com principal reconhecido, inclusive os posteriormente estornados integralmente. Sem população, zero. Arredondamento HALF_UP em NUMERIC antes da conversão em centavos seguros. AUTHORIZED e SETTLED são evidências do mesmo principal, não duas receitas. Liquidação bruta é indicador separado de aprovação e não representa saldo bancário líquido.

Frete/encargos pertencentes ao contrato reconhecido integram o LTV; mercadorias solicitadas somam subtotal bruto antes de descontos, sem frete/juros, de todas as tentativas. Valor de pedidos criados soma financialTotal congelado, com fallback ao total comercial histórico. Esses valores comerciais não são gasto pago. Não se consulta preço atual, nem se rateia estorno parcial por produto/frete. Datas first/last são criação do pedido; exibição usa America/Sao_Paulo, instantes transportados em UTC. Pesquisa/paginação não recortam fatos do cliente.

### 15.2. Evidência e incompletude

Fonte imutável FinancialFact, correlacionada por pedido/tentativa/provedor/conta. Principal deduplicado por instrumento; parcelas somam o contrato mas contam um pedido no ticket. Refund por charge é integral pela constraint de proveniência atual e conta uma vez por instrumento. Refund sem charge soma operações distintas, identificadas por provider/factKey. Replay da mesma identidade não gera devolução adicional. Não se subtrai por CANCELLED/REFUND_PENDING ou por simples solicitação de estorno.

Grupos financeiros incompatíveis/futuros são excluídos e sinalizados; não corrigidos por clipping ou autorização imaginada. Legado sem checkoutIntent/fatos é unverified. SUBMITTING/UNKNOWN e revisão relevante de correlação/contrato/estado externo/reversão/conciliação geram financialReviewOrders. coverage COMPLETE/PARTIAL e asOf acompanham o valor. PARTIAL descreve base verificável incompleta, não afirma que o dinheiro histórico ausente foi zero.

Estornos parciais são suportados pelo leitor quando há fatos válidos identificados; os ensaios inserem esses fatos somente na fixture. Não há produtor/API externa de parcial habilitado por WF-17. LA-002/033 continuam abertos para legado/devoluções/integração final; CHARGEBACK não existe no enum atual e não foi certificado. Necessidade de retorno físico e solicitação manual não inventam devolução financeira.

### 15.3. Snapshot e consumidores

Lista/perfil/adaptador antigo usam agregador comum, com escopo User.lojaID=Order.lojaID=tenant. Adaptador exige loja; cursor externo é inválido. RepeatableRead mantém seleção, indicadores e preferências no mesmo retrato; outro commit financeiro aparece na próxima leitura. Lista agrega a página em lote, sem consulta financeira individual para cada cliente.

Sem projeção/cache financeiro; handlers private, no-store. Schema compartilhado valida DTO. UI descarta respostas substituídas, aborta operações de leitura antigas e remove métricas diante de erro; reconsulta no foco/retomada/volta à listagem e a cada30 segundos enquanto visível. Não há push imediato de eventos externos. Lista retoma primeira página em atualização para não conservar páginas de retratos diferentes. Preferências usam pedidos com reconhecimento líquido positivo e não cancelados, aceitam NONE e não afirmam conhecer quantidades devolvidas em parcial.

### 15.4. Evidência e ativação

Seção22 do [registro](REGISTRO_EXECUCAO_CORRECOES_LOGICAS.md): **612 unitários/74 arquivos**, **274 integrações/21 arquivos** (16 novos financeiros e três novos de navegador), typecheck, lint direcionado e build55 páginas. Concorrência de leitura×refund, igualdade lista/perfil, parcelas105,03, estornos, legado, fuso/UNKNOWN e falha503 ensaiados. Chrome usa Next dev/webpack isolado; sem gateway ou serviço externo real.

Nenhuma migration/schema/backfill/dependência nova, alteração de .env, banco persistente, flag financeira, commit ou deploy. Aceite de política financeira, volume/EXPLAIN/carga, legado e conciliação real, candidato sob next start e rollout permanecem em WF-18/19/20. Publicar leitor/DTO/UI coordenadamente; em contingência não voltar à soma de todas as tentativas como receita nem apagar fatos para obter resultado esperado.

**Próximo pacote naquele checkpoint: WF-18; restavam três etapas principais, WF-18–WF-20. O projeto ainda não estava pronto para produção.**

## 16. Legado, contrato compatível e gate de dados — WF-18

### 16.1. Fonte e inventário

Seção23 do [registro](REGISTRO_EXECUCAO_CORRECOES_LOGICAS.md) e [matriz de compatibilidade/reconciliação](MATRIZ_COMPATIBILIDADE_E_RECONCILIACAO_LEGADOS.md). Clone de backup protegido de04/10; restore repetido, sanitização restrita, hashes/sequências,33 migrations, replay e diff vazio ensaiados. Nenhuma nova conexão com a origem. Inventário usa RepeatableRead READ ONLY, exige clone pertencente à execução e salva manifesto criptografado fora do Git; tags salgadas substituem IDs/dimensões/nomes em sua saída.

O inventário distingue integridade estrutural de prova de negócio. Passar constraints/proveniência selecionada não significa que histórico pago é receita ou que status de pedido prova baixa/restituição. automaticRepairs=[], requiresReconciliation=true e productionReady=false conservam essa distinção.

### 16.2. Compatibilidade com provas insuficientes

Pedido sem checkoutIntentID não recebe nova aprovação, expedição ou cancelamento que aplique estoque/ledger por inferência. fulfillmentPaymentError é compartilhada por DTO de ações e comando transacional; Admin/SYSTEM são recusados com CONFLICT/LEGACY_ORDER_RECONCILIATION_REQUIRED antes dos efeitos. Plano financeiro/tentativa parcialmente preenchidos não substituem a origem de estoque. Status igual/replay não reaplicam efeitos.

Ownership de leitura e confirmação do titular de entrega física existente permanecem. Confirmação não gera AUTHORIZED/SETTLED, reserva ou restituição. Timeout não inventa prazo para legado sem tentativa/prazo persistido. LTV continua parcial quando faltam fatos; carteiras accountingReady=false conservam histórico e permanecem sem consumo/expiração.

Não há migração que invente variante, identidade do comprador, geografia/frete, intenção/chave, reserva, fato financeiro, histórico/autoria ou lotes a partir de status/saldo. Saneador antigo de variantes permanece bloqueado. Retirada/stock0 e soma de estoques não são inferidos. Novos writers conservam os contratos de WF-05–17 e as constraints atuais.

### 16.3. Backfill e retomada

Tenant de Cart deriva do seu User persistido e de CartItem do seu Cart; a migration existente audita contaminação antes do backfill, bloqueia tabelas e inclui DDL/DML/FKs na transação com lock_timeout10s. Um carrinho arquivado/item de fixture recebeu o vínculo demonstrável. Interrupção lançada no UPDATE após ADD COLUMN reverteu dados/schema; retomada e segundo deploy não repetiram efeito.

Grafo cross-tenant e múltiplos ACTIVE foram recusados; preparar/resolver fixtures não autoriza eliminar dados reais. Clone real preservou colunas históricas, saldos e sequências. Não foram adicionadas constraints globais finais sobre NULL histórico ou removidos campos/rotas. Lotes, volume, tempo de locks, janela, RPO/RTO e responsáveis operacionais continuam sujeitos à medição/aceite, sem número de produção inventado.

### 16.4. Evidência e gate

**618 unitários/75 arquivos e280 integrações/22 arquivos**, typecheck, lint direcionado e build55 páginas; vazio/upgrade sintético/clone privado e compatibilidade HTTP ensaiados. Déficit de pontos no cancelamento/replay usa agora uma compra do protocolo real, enquanto legado recusa mutação. Pedido explícito de conciliação da fidelidade continua idempotente/durável sem ativar carteira.

Snapshot:24 pedidos legados,33 itens sem variante,10 PENDING,duas referências remotas sem tentativa,quatro status pagos sem fatos,duas carteiras não prontas,duas movimentações contábeis legadas,24 lacunas de comprador/história e16 de cotação. Contagens se sobrepõem. Catálogo/invariantes inspecionados passaram, porém ausência de prova mantém reconciliação aberta.

**WF-18 permanece EM EXECUÇÃO** para resolver/aceitar exceções e contrato operacional. Preparação técnica de WF-19 pode avançar com essas barreiras; validar todos os achados e implantar exige fechar o gate de dados. LA-002/033 continuam parciais; suspensão de recurso não conta como achado encerrado. WF-19/20 são as etapas principais seguintes, além do fechamento pendente de WF-18. Sem DDL/DML na origem, ativação de métodos/worker/expiração, .env, operação externa, commit ou deploy. O projeto ainda não está pronto para produção.


## 17. Homologação técnica entre processos — WF-19

### 17.1. Runtime e identificação

test:production:isolated cria PostgreSQL/sentinela próprios, compila fontes em cópia sem .env e inicia dois next start production com mesmo BUILD_ID e diretórios/caches separados. Chave FREIGHT_QUOTE_SECRET é aleatória por execução e compartilhada somente no ambiente descartável; credenciais externas ficam vazias. O controlador de restart reside no harness, não no aplicativo, e só opera o processo secundário da própria execução.

Vitest mantém NODE_ENV=test para fixtures/serviços importados; HTTP/páginas executam o build production. Os hashes de fontes/scripts/tests e metadados da rodada estão no [registro, seção24](REGISTRO_EXECUCAO_CORRECOES_LOGICAS.md#24-wf-19--regressão-integrada-em-runtime-de-produção) e na [matriz de homologação](MATRIZ_HOMOLOGACAO_INTEGRADA_WF19.md). Não há candidato imutável/commit/release aprovado.

### 17.2. Configuração administrativa atual

getLojaSettings deixa de depender de cache local de cinco minutos e consulta a persistência em cada request. Depois do commit em A, nova leitura em B observa enablePickup vigente, preservando DTO/ownership e os indicadores privados sem segredos. Nenhum novo campo/migration ou infraestrutura de cache foi introduzido; uma requisição já iniciada pode observar o snapshot anterior.

Frete/aceite continuam dependendo da autoridade e revisão persistidas. Revogar a modalidade em A impede que cotação/consentimento antigos sejam consumidos em B. O ensaio não certifica todos os caches/Server Actions/CDN da aplicação.

### 17.3. Evidência e limites

**618 unitários/75 arquivos e287 testes selecionados/23 arquivos passaram**:280 integrações anteriores, incluindo11 cenários de navegador, mais sete cenários entre processos. Build55 páginas, typecheck, lint direcionado e isolamento negativo passaram. Lint geral: zero erros/18 avisos. CI passa a usar o novo gate de build + runtime; pipeline remoto não foi executado.

Carrinho/revisão, intenção/última unidade, consulta após restart e efeito único foram conferidos no banco. Restart ocorre após compra commitada; não comprova morte real entre I/O/commit. next.config.js permanece standalone; esta rodada usa next start com build completo/dependências locais e não certifica empacotamento mínimo/static/engine Prisma/infra final.

**WF-19 EM EXECUÇÃO**, sem promoção automática dos38 LA a VALIDADO. WF-18 ainda exige conciliação/aceite e dados atuais; WF-19 requer sandbox, carga com metas fornecidas, candidato/matriz ampliada e revisão operacional. WF-20 NÃO INICIADO. LA-002/033 continuam parciais. Sem alteração de .env/banco persistente, integração externa, ativação de flags reais, commit ou deploy; o projeto ainda não está pronto para produção.


## 18. Pacote relocável e preflight de release — complemento WF-19

### 18.1. Empacotamento e runtime

test:standalone:isolated compila com dependências materializadas, inspeciona .next/standalone, acrescenta public/static e prepara dois pacotes idênticos. Não aceita .env, arquivos especiais ou links de dependência. A árvore usada no build é removida antes de node server.js. Runtime usa PORT/HOSTNAME próprios e NODE_PATH vazio; verifica sentinela antes do teste. O descarte distingue node_modules materializado de junction e conserva a restrição a TEMP/prefixo do executor.

No Windows/x64, Prisma/HTTP/assets e11 cenários de navegador passaram; não equivale a certificar engine Linux/imagem/CDN/infra final. SHA-256, tamanho/arquivos e build/runIds estão no [registro, seção25](REGISTRO_EXECUCAO_CORRECOES_LOGICAS.md#25-wf-19--pacote-standalone-independente-e-preflight-de-configuração) e na seção9 da matriz de homologação.

### 18.2. Configuração sem mutação

node scripts/check-production-environment.mjs aplica o loader real do Next em processo próprio e reporta somente códigos/flags, sem valores de segredos ou IO remoto. configurationPassed nunca significa productionReady. Recusa ambiente de fixtures como release e exige chave de frete; métodos remotos exigem pré-condições do adapter/allowlist/webhook, e jobs ativos precisam de autenticação de cron.

Configuração local carregada de .env.local/.env tem FREIGHT_QUOTE_SECRET ausente e chave Asaas efetiva vazia por referência de dólar. Flags financeiras/jobs permanecem false. .env.example documenta dólar literal escapado; arquivos reais não foram alterados. O preflight recusou com código1, sem tentar habilitar métodos ou corrigir credenciais por inferência.

NODE_ENV=production no adapter atual exige conta/endpoint de produção; a homologação sandbox com runtime otimizado precisa de contrato de ambiente definido/compatível. Credencial presente não prova conta/validade ou autoriza chamadas.

### 18.3. Resultado e gate

**627 unitários/77 arquivos;289 testes/24 arquivos repetidos em cada runtime, next start e standalone, com duas instâncias por modo.** Não somar a repetição como578 testes distintos. Build55 páginas, typecheck e lint direcionado passaram. CI passa a exigir ambos os modos; pipeline remoto não executado.

As rodadas de runtime precedem o preflight e seus cinco testes unitários; hashes identificam essas rodadas, e testes/tipagem/lint foram repetidos após os acréscimos de diagnóstico. Gates de dados de WF-18, sandbox, infra/carga/configuração, candidato/aceite e operação continuam abertos. Nenhum LA foi promovido automaticamente; LA-002/033 parciais, WF-19 EM EXECUÇÃO e WF-20 NÃO INICIADO. Sem mutação na origem/.env/.env.local, flags reais, operação externa, commit ou deploy.

## 19. Preparação operacional — configuração, supervisão e recuperação

Complemento de06/10/2026, relacionado à seção26 do registro. Não altera a ordem dos gates: **preparação de procedimentos não significa liberação ou início do rollout WF-20**.

### 19.1. Configuração e artefato

.env local foi corrigido após backup privado: dólar literal da chave Asaas preservado e segredo de frete gerado, sem ativar remoto/worker/expiração. Preflight configurationPassed=true, productionReady=false; nenhuma validação de conta externa. Todas as instâncias de cada ambiente precisam do mesmo FREIGHT_QUOTE_SECRET, e novos processos devem carregar a configuração aprovada. Não colocar .env no pacote ou imagem.

test:standalone:linux verificou instalação limpa Node22.15.0/Debian Bookworm/OpenSSL3, Prisma5.22.0/Next16.3.5, migrations descartáveis, duas instâncias sem fontes do builder, assets e restart. É diagnóstico de compatibilidade; não executa toda a regressão ou certifica a infraestrutura final. Registro/matriz preservam hashes e limites.

### 19.2. Supervisionar antes de executar

| Interface existente | Contrato operacional e efeito |
|---|---|
| GET /api/cron/payments/status | Bearer CRON_SECRET; leitura de backlog global para operação interna, private/no-store. Confere filas por status, uncertain, overdue, abandonedLeases, operações e untrackedLegacyOrders. Não executa o consumidor. |
| GET/POST /api/cron/payments?limit=... | Bearer CRON_SECRET e PAYMENT_WORKER_ENABLED=true; limit inteiro1–5. **Possui efeitos:** inbox, lookup/conciliação/operações financeiras, expiração condicionada e outbox/email. Não usar como healthcheck. |
| GET/POST /api/cron/orders-timeout | Bearer CRON_SECRET ou x-cron-secret; expiração fica dry-run enquanto PAYMENT_EXPIRATION_ENABLED não for true. Conferir success/errors no corpo; HTTP200 isolado não comprova sucesso de todas as etapas. |
| GET/POST /api/cron/loyalty-expiration | Bearer CRON_SECRET ou x-cron-secret; rotina própria de pontos. A flag PAYMENT_EXPIRATION_ENABLED não é sua barreira. Só agendar após política/carteiras/conciliação correspondentes aprovadas. |

O campo at do status é hora de consulta, **não heartbeat de execução**. O scheduler precisa persistir, em monitoramento confiável, início/fim/resultado/duração de cada disparo, inclusive quando não conseguir alcançar a aplicação. Avaliar completed/retried/review e erros de cada fase, além do HTTP. Dead letters e tentativas incertas precisam de atendimento rastreado; crescimento de fila ou horário recente de consulta não provam consumidor saudável.

Cadência, orçamento de execução/concorrência, limiar de atraso e prazo de atendimento devem ser derivados de capacidade e regras por método aprovadas, com responsável e canal de alerta definidos. maxDuration=300 da rota financeira é configuração da aplicação, não garantia de que a plataforma suportará ou concluirá o lote. Ensaiar timeout, falha parcial e indisponibilidade do scheduler antes de habilitar métodos.

### 19.3. Recuperação pelos comandos existentes

| Caso | Caminho controlado | O que a resposta não comprova |
|---|---|---|
| Cobrança/tentativa incerta | Admin do tenant: POST /api/admin/orders/[orderId]/payment-reconcile com commandId estável; audita e solicita nova inspeção/reprocessamento elegível | HTTP202 não confirma pagamento; não cria autorização para outro POST de cobrança e não restaura arbitrariamente operação financeira. |
| Cancelamento/estorno remoto elegível | POST /api/admin/orders/[orderId]/payment-operation com kind CANCEL/REFUND, commandId e expectedVersion atuais | Pedido de operação não é liquidação final; aguardar evidência completa da conta/provedor e conciliar estado/estoque. |
| Estorno manual | POST /api/admin/orders/[orderId]/manual-refund com ação REQUEST_REFUND ou CONFIRM_REFUND e campos validados pelo serviço | Confirmação exige referência bancária verificável; não fabricar prova para fechar pendência. |
| Pedido/variante/carteira legados | Inventário readonly, backup atual e matriz WF-18; revisão física/financeira pelo responsável | Não atribuir variante, estoque, pagamento ou lote por inferência; não usar UPDATE direto para dispensar barreiras. |

Devolução física/parcial, producer de fatos parciais e obrigações históricas continuam bloqueios de LA-002/033. Nenhum procedimento desta seção declara esses casos implementados ou permite confirmá-los sem prova. Resposta de solicitação deve ser acompanhada até fato final e efeitos únicos de estoque/carteira/histórico.

### 19.4. Preparativos exigidos para contingência

Antes da janela, registrar candidato imutável/build/schema, operador/revisor, contas/tenants/métodos autorizados, metas de capacidade, backup verificado e RPO/RTO. Repetir restore em clone atual; registrar exatamente quais versões anteriores conseguem ler os novos dados e quais writers precisam permanecer suspensos.

Para incidentes de estoque/saldo/cobrança, conter novas compras do escopo afetado e preservar consultas, recebimento de evidências e conciliação. PAYMENT_REMOTE_ENABLED=false impede novas operações remotas elegíveis, mas não deve ser usado como declaração de contenção de todos os métodos manuais ou compras alternativas. Confirmar os caminhos restantes antes de anunciar suspensão.

Não desligar o consumidor junto com a entrada de novas vendas sem avaliar pendências; não apagar filas, leases, recibos ou histórico. Não reverter migrations/destruir dados para instalar versão antiga incompatível. Se o rollback de código não for compatível com dados novos, usar contingência de entrada e roll-forward ensaiado. Rotação de segredo de frete exige janela/reemissão de cotações e consistência entre instâncias.

**Pendentes:** hospedagem e topologia; conta/contrato sandbox; metas de carga; provas de legados; responsáveis/RPO/RTO/janela; scheduler/heartbeat/alertas implantados e ensaiados. Nenhum item foi marcado como aprovado por esta preparação.

## 20. Capacidade e ambiente informados — complemento de 06/10/2026

Esta seção atualiza os requisitos antes desconhecidos na seção19. As informações abaixo foram fornecidas pelo usuário; configurações privadas do deployment não foram inspecionadas. Não houve mudança de plano, região, variáveis na Vercel ou branch no Neon.

### 20.1. Volume e tempo percebido

| Parâmetro | Informação recebida | Uso no ensaio |
|---|---|---|
| Visitantes por dia | 100–300 | Referência de volume diário; não determina requisições por segundo ou consumo mensal. |
| Usuários simultâneos no pico | 30–80 | Dois perfis locais separados, de30 e80 usuários HTTP virtuais. |
| Checkouts por minuto no pico | 2–5 | Dois e cinco fluxos manuais por minuto, com replay para conferir efeito único. |
| Métodos desejados | Pix, cartão e boleto | O piloto manual não homologa esses métodos no Asaas. |
| Meta desejada | Menos de1s /1,5s para o **carregamento completo das páginas** | Confirmação explícita do usuário; não converter em SLA de resposta da API. |
| Campanhas | Não informadas | Rajada, duração e margem de campanha continuam indefinidas. |

O piloto mede separadamente resposta HTTP, evento load no navegador e prontidão de conteúdo: documentos/fontes carregados, imagens visíveis concluídas, título/botões da vitrine visíveis e formulário de checkout disponível. Relata p50/p95/máximo, sem aprovar a meta apenas porque o HTTP foi rápido. O percentil95 é uma estatística inicial de diagnóstico, não uma decisão do usuário para dispensar os5% mais lentos. O aceite final precisa definir páginas, navegação inicial/subsequente, dispositivos/rede, distribuição geográfica, estado frio/quente e critério de percentil/máximo.

Para comparação exploratória, o piloto associa1s ao perfil de30 usuários e1,5s ao de80. Essa associação inicial não foi estabelecida como regra formal pelo usuário; mantém explícitos ambos os tempos desejados e não flexibiliza o aceite final sem decisão.

Mídia remota bloqueada, um único navegador desktop, catálogo sintético de36 produtos e servidor/banco locais tornam o resultado **parcial** para a meta de página completa. O ensaio usa cinco segundos entre requisições por usuário como hipótese explícita do piloto, não como dado recebido ou equivalência automática com80 visitantes reais. O carregamento final deve incluir os recursos externos relevantes e ser repetido na infraestrutura escolhida, com navegadores/dispositivos e dados representativos.

### 20.2. Hospedagem e isolamento

Aplicação informada na Vercel **Hobby**, Fluid Compute habilitado, duração máxima300s, região **iad1/Washington, DC**. URL provisória informada: https://continental-prototipo.vercel.app/. O escopo do deployment (Preview/Production), revisão publicada, recursos efetivos e variáveis por ambiente não foram verificados. A presença informada de ASAAS_API_KEY e ASAAS_WEBHOOK_TOKEN não comprova conta sandbox, validade, configuração de webhook ou escopo de ambiente. Não enviar valores em conversa nem substituir chaves de produção para fazer ensaios.

O escape de dólar corrigido na seção19 pertence ao arquivo dotenv local. Variáveis injetadas diretamente pela plataforma devem preservar o valor original da credencial; não acrescentar automaticamente a barra usada no arquivo local à chave cadastrada no painel da Vercel.

PostgreSQL informado no Neon **Free**, AWS São Paulo, compute atual mínimo/máximo **0,25 CU**, scale to zero habilitado e somente a branch **main**. Essa capacidade descreve a configuração informada do projeto; não é uma afirmação sobre limites universais do plano. Preparar banco/branch de homologação separado, com credenciais próprias e dados apropriados, antes de carga ou operações sandbox. Uma branch derivada pode conter dados copiados: isolamento de escrita não dispensa proteção ou seleção desses dados.

A distância entre Functions e banco deve ser incluída no orçamento de latência; a Vercel orienta executar Functions próximas à origem de dados. A retomada de um compute suspenso também entra na medição de acesso frio. Essas condições são riscos a medir, não prova de que o Neon atual falha no volume informado. Ver [regiões das Functions](https://vercel.com/docs/functions/configuring-functions/region) e [gerenciamento de computes Neon](https://neon.com/docs/manage/endpoints/).

O plano Hobby restringe-se a uso pessoal não comercial, portanto a implantação comercial do e-commerce exige um plano compatível. Os crons Hobby têm frequência diária e não oferecem a cadência de minutos necessária a um consumidor financeiro com prazo curto. Definir plano/scheduler compatíveis e ensaiar backlog, duração, idempotência, heartbeat e alertas; não tratar300s de timeout como garantia de processamento. Ver [plano Hobby](https://vercel.com/docs/plans/hobby) e [limites de cron](https://vercel.com/docs/cron-jobs/usage-and-pricing).

### 20.3. Próximos gates

1. Confirmar, sem publicar segredos, se as credenciais existentes pertencem ao sandbox e em qual escopo da Vercel estão configuradas; preservar as de produção. O contrato de ambiente do adapter ainda precisa permitir sandbox com build otimizado sem enfraquecer a produção.
2. Preparar homologação separada, identificar revisão/build/schema publicados e recursos efetivos; decidir plano comercial/scheduler e topologia das regiões.
3. Definir matriz de página completa, rede/dispositivo, comportamento da abertura cinematográfica, campanhas, teste prolongado e critérios finais de aceite. Executar piloto, depois ensaios no candidato real, incluindo frio/quente, mídias e os métodos externos.
4. Fechar dados/aceites de WF-18, homologação integral de WF-19 e requisitos operacionais de WF-20. Nenhum gate foi fechado apenas pelo fornecimento dessas informações.

## 21. Asaas Sandbox no Preview Vercel — preparação de 06/10/2026

O usuário confirmou possuir a chave API e o webhook da conta Sandbox. Isso confirma disponibilidade informada, não configuração, validade ou recebimento de eventos. A localização/escopo das credenciais foi solicitada sem seus valores. A leitura local com o loader do Next confirmou endpoint de produção, prefixo de chave de produção e token de webhook presente; flags remoto/worker/expiração continuam false. Nenhuma chave real foi exibida ou trocada.

### 21.1. Contrato de capacidade implementado

lib/config/asaas-environment.mjs centraliza a decisão usada por AsaasClient.configurationReady e pelo preflight. NODE_ENV=production identifica o runtime otimizado e não basta para distinguir Preview de Production na Vercel.

| Contexto | Endpoint e família de credencial exigidos |
|---|---|
| VERCEL=1 e VERCEL_ENV=preview | Sandbox, mesmo em NODE_ENV=production; configuração de gateway de produção recusada na capacidade |
| VERCEL_ENV=production | Produção; Sandbox não é elegível, inclusive sob NODE_ENV incorretamente declarado como development/test |
| NODE_ENV=production fora de Preview identificado | Produção; ausência de contexto não autoriza Sandbox |
| Desenvolvimento/teste ordinário | Sandbox, preservando o comportamento anterior |

A regra exige HTTPS, hosts/path conhecidos, ausência de usuário/senha/query/fragmento/porta não padrão e prefixo compatível. O construtor continua recusando chave de produção em endpoint Sandbox. Essa mudança define **elegibilidade de capacidade e diagnóstico de configuração**; não valida uma conta nem autentica ou consulta o gateway. O preflight é somente leitura e continua devolvendo productionReady=false, externalCalls=0 e mutations=0, mesmo quando configurationPassed=true.

VERCEL e VERCEL_ENV devem vir da plataforma com acesso às variáveis de sistema habilitado. Não preencher/forjar esses campos no .env real para contornar a barreira. Runtimes otimizados locais ou outros provedores não receberam um modo de homologação novo. Fontes: [variáveis de sistema Vercel](https://vercel.com/docs/environment-variables/system-environment-variables) e [ambientes Vercel](https://vercel.com/docs/deployments/environments). As condições de legado que vinculavam todo NODE_ENV=production ao gateway de produção nas seções anteriores descrevem o código anterior; este contrato passa a distinguir Preview identificado.

### 21.2. Configuração privada a preparar no ambiente Preview

Antes de configurar a integração, identificar o deployment de homologação, banco separado e loja sintética. O projeto informado ainda tem só main no Neon; ter URL Preview não isola o banco. Preferir banco/esquema com fixtures fictícias; um clone com dados/filas reais não deve ser considerado pronto para execução de workers. O consumidor pode ler pendências globais, além da allowlist usada para novas compras.

| Variável | Valor/contrato no Preview de homologação |
|---|---|
| DATABASE_URL e DIRECT_URL | Ambas pertencem ao banco/branch de homologação comprovado, nunca main usada pela aplicação real |
| ASAAS_API_URL | https://api-sandbox.asaas.com/v3 |
| ASAAS_API_KEY | Chave existente da conta Sandbox, injetada privadamente no escopo Preview |
| ASAAS_WEBHOOK_TOKEN | Mesmo Auth Token do webhook Sandbox, diferente da chave API |
| ASAAS_ACCOUNT_SCOPE | Identificador estável e distinto da conta de produção; exemplo não secreto sandbox-hml |
| ASAAS_ENABLED_LOJA_IDS | Somente IDs das lojas sintéticas de homologação |
| FREIGHT_QUOTE_SECRET | Segredo privado próprio de homologação, compartilhado pelas suas instâncias |
| CRON_SECRET | Segredo privado próprio do executor/supervisão de homologação |
| NEXT_PUBLIC_APP_URL / domínio/loja | URL e tenant de homologação corretamente resolvidos, sem apontar o retorno para produção |
| PAYMENT_REMOTE_ENABLED / PAYMENT_WORKER_ENABLED / PAYMENT_EXPIRATION_ENABLED | Inicialmente false; ativação controlada somente depois de banco/schema/conta/tenant/consumidor/scheduler verificados |
| ASAAS_INSTALLMENTS_APPROVED | false inicialmente; parcelas só após prova de contrato completo |

No painel Vercel, usar valores originais das credenciais, sem acrescentar a barra do escape dotenv local. Mudanças de variáveis requerem novo deployment para serem aplicadas. Não executar vercel env pull neste workspace para sobrescrever .env.local nem mover credenciais para NEXT_PUBLIC_ ou para documentos. A família/presença da chave não demonstra autenticação válida. Ver [chaves Asaas](https://docs.asaas.com/docs/chaves-de-api).

### 21.3. Webhook e homologação funcional

O endpoint é **POST https://<host-de-homologacao>/api/webhooks/asaas**. Confirmar no Sandbox a URL existente, os eventos financeiros relevantes e Auth Token; token enviado por asaas-access-token deve coincidir com a configuração privada. O Asaas exige token de32–255 caracteres sem espaços e distinto da API key. O host deve ser alcançável pelo provedor sem login interativo do deployment, mantendo a autenticação do endpoint. Ver [configuração de webhook Asaas](https://docs.asaas.com/docs/criar-novo-webhook-pela-aplicacao-web).

O handler atual responde503 sem PAYMENT_WORKER_ENABLED=true; token inválido resulta401; JSON/envelope inválido resulta400. Quando o consumidor estiver preparado e habilitado no ambiente isolado, o200 confirma recebimento persistido na inbox, **não pagamento aprovado**. O worker ainda precisa consultar o contrato externo completo e aplicar efeitos únicos. Hora de consulta ao status não é heartbeat do scheduler.

Ensaiar Pix, cartão1x e boleto com dados fictícios e procedimentos Sandbox documentados: emissão/instruções, confirmação e consulta cruzada, falha/timeout, resposta perdida, reentrega/ordem de eventos, cancelamento/estorno elegíveis, retomada e efeito único em pedido/reserva/estoque. Parcelamento e capacidades dependentes da conta ficam separados até prova. Registrar IDs não secretos, método, horário, evento e estado final; não persistir PAN/CVV/token/chaves ou usar contas/clientes reais para fechar a matriz.

**Pendentes:** localização privada/escopo das credenciais, banco/tenant/schema de homologação, revisão e recursos do Preview, URL/entrega de webhook, consumidor/scheduler e ensaios reais por método. O contrato local não certifica a conta ou o deployment e não fecha WF-19/20.
