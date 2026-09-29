# Etapa 08 — Frontend, UI, UX e integração

**Data:** 2026-09-28  
**Fontes:** `docs/audits/FRONTEND-UX-AUDIT.md`, `BACKEND-AUDIT.md`, `FINAL-AUDIT.md`, `docs/remediation/PLAN.md`, código e testes atuais  
**Escopo executado:** `FUX-001` a `FUX-015`; somente aplicação e ambiente local, sem contas, dados ou serviços reais  
**Estado desta etapa:** concluída com pendências; não declara `READY` ou `APPROVED`  
**Risco residual:** **HIGH**, principalmente porque `FUX-003` ainda exige fechamento persistido e transacional do carrinho e `FUX-015` ainda não possui suíte browser/E2E

## Resultado por ID

Cada veredito abaixo foi confrontado com o código atual. `NOT VERIFIED` não foi convertido em defeito confirmado.

| ID | Severidade / confiança originais | Veredito atual | Evidência antes/depois | Residual / pendência |
|---|---|---|---|---|
| `FUX-001` | BLOCKER / CONFIRMED | `ALREADY RESOLVED` | O código atual já usa `/api/checkout`, `buildCheckoutPayload`, `Idempotency-Key` e consome `result.data`; a regressão confirma o DTO e que preço de frete não é autoridade do cliente. | **MEDIUM**: PIX/cartão/boleto e gateway continuam sem E2E/sandbox autorizada. |
| `FUX-002` | HIGH / CONFIRMED | `VALID` no feedback remanescente → `FIXED` | O contrato/quote token já estavam alinhados, mas a exceção ainda ia somente ao console. Agora erro, resposta vazia e retry são explícitos, seleção antiga é removida e o avanço sem frete permanece bloqueado. | **MEDIUM**: precisão, timeout e expiração de quote dependem dos provedores e ambiente integrado. |
| `FUX-003` | HIGH / CONFIRMED | `VALID` → `DEFERRED` no fechamento servidor; hidratação `FIXED` | Checkout deixou de representar snapshot `idle` ou falha como vazio e hidrata `/api/cart` com estados discriminados. A confirmação ainda limpa somente Zustand: não há vínculo cart/order que permita concluir o carrinho atomicamente sem risco em pagamento ambíguo. | **HIGH**: modelar vínculo e fechamento transacional/compensação idempotente; sincronização entre abas também não foi implementada. |
| `FUX-004` | HIGH / CONFIRMED | remanescente `VALID` → `FIXED`; demais pontos `ALREADY RESOLVED` | Cards, frete e checkout já usam controles/labels nativos. O overlay restante de confirmação de entrega foi migrado para Dialog Radix com título, descrição, Escape, trap e retorno de foco. | **MEDIUM** até percurso por teclado e leitor de tela no fluxo autenticado. |
| `FUX-005` | HIGH / CONFIRMED | `ALREADY RESOLVED` | Menu móvel atual usa Sheet Radix; fechado não conserva o painel customizado na tabulação. | **MEDIUM** até teste em Safari/iOS e leitor de tela móvel. |
| `FUX-006` | MEDIUM / CONFIRMED | `ALREADY RESOLVED` | Existe `/produto/[id]`, com resolução server-side, links reais, deep link e metadata própria. | **LOW/MEDIUM**: política futura de slug/redirect continua externa a esta etapa. |
| `FUX-007` | MEDIUM / HIGH CONFIDENCE | `ALREADY RESOLVED` no escopo do achado | Home atual consulta página/filtros no servidor, envia DTO/página limitada e mantém query na URL; regressões de catálogo cobrem contrato. | **MEDIUM**: carga com 1.000/10.000 itens e taxonomia de produção não foram medidas. |
| `FUX-008` | HIGH / CONFIRMED | `VALID` → `FIXED` localmente | Falha HTTP, JSON inválido ou envelope incompleto não cai mais em `0`. Extrato/widget exibem indisponibilidade e retry; falha de simulação remove e zera explicitamente o desconto local. | **MEDIUM** até browser integrado e reconciliação externa do saldo. |
| `FUX-009` | MEDIUM / CONFIRMED | `VALID` → `FIXED` | Perfil passou a receber `{items,total,page,pageSize,totalPages}`; contador usa total real e links por URL tornam o 11º pedido alcançável. | **LOW/MEDIUM**: offset deve migrar para cursor se históricos grandes/inserções concorrentes justificarem. |
| `FUX-010` | MEDIUM / CONFIRMED | `VALID` → `FIXED` | Store agora diferencia `idle/loading/success/empty/error/unauthorized`, mostra retry, reverte mutação otimista com mensagem e entrega falha de adição à tela para toast/redirect. | **LOW/MEDIUM** até mocks browser de 401/409/422/500/offline. |
| `FUX-011` | MEDIUM / CONFIRMED | `ALREADY RESOLVED` | CSS e HeroVideo atuais respeitam `prefers-reduced-motion`; regressão anterior cobre autoplay/preload. | **LOW**; consumo de dados em dispositivos reais não foi medido. |
| `FUX-012` | MEDIUM / CONFIRMED | `VALID` → `FIXED` no contrato local | Links não aninham botão; falhas têm live semantics e associação; cadastro foca primeiro inválido; toggle de senha é nomeado/tabulável; cadastro/reset seguem mínimo de oito caracteres. | **MEDIUM** até NVDA/VoiceOver/TalkBack e timing real dos anúncios. |
| `FUX-013` | LOW / CONFIRMED | `VALID` → `FIXED` | Drawer/item usam português, `Intl` pt-BR/BRL e nomes contextuais nos controles de quantidade/remoção. | **LOW**; i18n multi-locale não existe. |
| `FUX-014` | LOW / CONFIRMED | `VALID` → `FIXED` | `next` interno é preservado; origem externa, `//host`, barra invertida, controle e loop de login caem em `/`. | **LOW**: restaurar automaticamente uma intenção de compra exige contrato próprio e não foi simulado. |
| `FUX-015` | INFORMATIONAL / CONFIRMED | `VALID` → `DEFERRED` | Foram acrescentadas regressões comportamentais/puras e contratos de markup, mas o repositório continua sem runner de componentes, axe ou Playwright/E2E. | **MEDIUM**: implantar suíte browser isolada em banco/fixtures descartáveis. |

Duplicatas preservadas: `FINAL-001`, `FINAL-004`, `FINAL-015`, `FINAL-020`, `FINAL-022` a `FINAL-025`, `FINAL-029` a `FINAL-031` e `FINAL-036`. As correções sobrepostas de WEB/PERFORMANCE/BACKEND/TRANSACTIONS foram revalidadas, não duplicadas.

## Correções por causa raiz

### 1. Estado do carrinho e integração do checkout (`FUX-001`, `FUX-002`, `FUX-003`, `FUX-010`, `FUX-013`)

**Antes:** checkout decidia “vazio” a partir do snapshot inicial do Zustand; GET e mutações podiam falhar sem feedback; 401 redirecionava por atribuição global; drawer misturava inglês e dólar. Frete apagava a seleção, mas registrava a falha apenas no console.

**Depois:** a store expõe estados discriminados, mensagens seguras e rollback; checkout hidrata antes de renderizar empty/error/login; drawer oferece retry e controles nomeados; adição usa toast ou login com `next`; frete possui mensagem/retry e nunca conserva quote anterior após CEP/erro. O payload de checkout permanece canônico e o servidor continua fonte de preço, estoque, desconto e frete.

O fechamento persistido do carrinho não foi improvisado. O schema atual não liga `Cart` a `Order`; marcar o carrinho em uma chamada da confirmação poderia abandoná-lo em falha entre pedido/pagamento ou aceitar uma confirmação client-side fora da unidade transacional. O critério de encerramento é: cart identificado pelo servidor, associado ao pedido e concluído na mesma transação do estado determinístico, ou compensado/reconciliado idempotentemente quando o gateway ficar ambíguo.

### 2. Fidelidade sem falso zero (`FUX-008`)

`lib/loyalty-client.ts` valida status HTTP, JSON e campos mínimos dos envelopes de carteira, extrato e simulação. Somente resposta válida pode exibir saldo zero. Em erro, a UI informa indisponibilidade, permite retry e não deixa desconto anterior no total. Nenhum endpoint real de pontos foi chamado.

### 3. Histórico consultável (`FUX-009`)

O servidor calcula página/offset após validar a query, filtra `userID` e `lojaID`, conta sob o mesmo escopo e retorna metadados. A UI preserva a aba por `?ordersPage=N#pedidos`. A fixture com 11 registros prova `skip: 10`, total 11 e duas páginas.

### 4. Conta, foco e navegação (`FUX-004`, `FUX-012`, `FUX-014`)

O Dialog Radix substitui o modal customizado de entrega. Login valida o destino pós-autenticação no servidor. Login, cadastro e recuperação associam erros aos controles, usam autocomplete e regiões de anúncio; cadastro move o foco ao primeiro inválido. Reset e cadastro agora refletem a política servidor de oito caracteres.

As skills locais `modern-web-guidance` e `a11y-debugging` orientaram o uso de controles nativos, labels explícitos, estados loading/empty/error separados, live regions contidas, foco visível e primitives de dialog. Isso influenciou materialmente os ajustes acima; não é uma alegação de conformidade WCAG.

## Evidência visual e browser local

Foi iniciado apenas o Next local com `APP_ENV=development`; Chrome headless foi controlado por CDP, com `prefers-reduced-motion: reduce`, sem login nem serviço externo. A tela `/login?next=/profile/fidelidade` apresentou:

| Viewport emulado | `innerWidth` / `scrollWidth` | Card | Resultado |
|---|---:|---:|---|
| mobile | 375 / 375 | 343 px, x=16…359 | sem overflow horizontal |
| tablet | 768 / 768 | 448 px, x=160…608 | sem overflow horizontal |
| desktop | 1440 / 1440 | 448 px, x=496…944 | sem overflow horizontal |

A árvore acessível local encontrou os textboxes `E-MAIL DE ACESSO` e `SENHA`, botão `ENTRAR NA CONTA`, links de recuperação/cadastro e controles do header com nomes. O e-mail recebeu foco e expôs `name=email`/`autocomplete=email`.

- [login mobile 375×900](evidence/frontend08/login-mobile.png)
- [login tablet 768×1024](evidence/frontend08/login-tablet.png)
- [login desktop 1440×1000](evidence/frontend08/login-desktop.png)

O badge de issue presente nas capturas pertence ao overlay do Next em desenvolvimento. Contraste computado, zoom/reflow, fluxo autenticado, modal de entrega e tecnologias assistivas físicas permanecem `NOT VERIFIED`.

## Testes e comandos executados

| Comando / prova | Resultado |
|---|---|
| `npx.cmd vitest run tests/unit/frontend-login-navigation.test.ts` | 8/8 |
| `npx.cmd vitest run tests/unit/frontend-cart-state.test.ts` | 4/4 |
| fidelidade frontend + rotas + integração | 3 arquivos, 19/19 |
| histórico de pedidos | 1 arquivo, 10/10 |
| auth/acessibilidade/recovery/enumeration | 3 arquivos, 18/18; contrato específico 3/3 |
| checkout/contrato/confirmação | 3 arquivos, 15/15 |
| contratos web + auth | 2 arquivos, 8/8 |
| `npx.cmd tsc --noEmit` | exit 0 |
| primeira suíte unitária completa | 555/556; revelou expectativa antiga que proibia qualquer `useEffect` no checkout |
| regressão corrigida | teste preserva a proibição de refetch de configuração e agora exige a hidratação necessária do carrinho |
| `npm.cmd test` final | 82 arquivos, 557/557, 6,08 s do runner; exit 0 |
| `npm.cmd run lint` | 0 erros, 14 warnings conhecidos; exit 0 |
| `npm.cmd run build` com `APP_ENV=development` | build Next 16.3.5, TypeScript e 51 páginas; exit 0, 22,86 s |
| HTTP local | `/login`, login com `next`, `/forgot-password` e `/reset-password`: 200 |
| Chrome/CDP local | 3 viewports sem overflow; nomes/foco inspecionados; screenshots preservadas |

A primeira inicialização de `next dev` falhou fechada porque `APP_ENV` não estava definido; a segunda usou explicitamente `development` e ficou pronta. Processos locais e portas 3108/9223 foram encerrados ao fim. A primeira suíte completa não foi reportada como sucesso: a única falha era uma asserção estática de performance incompatível com a hidratação exigida por `FUX-003`, e a execução final verde ocorreu somente após atualizar o contrato do teste.

## Arquivos da etapa

**Carrinho/checkout:** `store/cart.store.ts`, `components/home/HomeClient.tsx`, `components/cart/CartDrawer.tsx`, `CartItem.tsx`, `CartSummary.tsx`, `components/checkout/CheckoutPageClient.tsx`, `CheckoutForm.tsx`.  
**Fidelidade:** `lib/loyalty-client.ts`, `components/profile/LoyaltyHistoryView.tsx`, `components/checkout/LoyaltyPointsWidget.tsx`.  
**Conta/navegação:** `lib/safe-next-path.ts`, `app/login/page.tsx`, quatro formulários em `components/forms/`.  
**Perfil:** `lib/order-history-pagination.ts`, `services/order.service.ts`, `app/profile/page.tsx`, `ProfileLayout.tsx`, `OrderHistoryList.tsx`, `components/ui/dialog.tsx`.  
**Regressões:** `frontend-login-navigation`, `frontend-cart-state`, `frontend-loyalty-state`, `frontend-auth-accessibility`, `frontend-checkout-contract`, `order-history-query`, `web-accessibility-contracts` e `performance-checkout-page` em `tests/unit/`.  
**Evidência:** `docs/remediation/evidence/frontend08/*.png`.  
**Commit:** nenhum.

## Serviços e verificações externas pendentes

| Responsável / ambiente | Verificação objetiva de encerramento |
|---|---|
| Backend/Transações | Vincular cart/order e provar adicionar → reload → pagar → novo GET vazio, inclusive falha parcial e pagamento ambíguo. |
| QA E2E | Fixtures anon/customer A/customer B/admin; checkout PIX/cartão/boleto, frete 200/vazio/erro/timeout, rede offline e reload. |
| Gateway Asaas | Sandbox autorizada prova envelope, recusado, timeout, retorno posterior e ausência de pedido/cobrança duplicados. |
| Frete/Operação | Provedores autorizados validam preço/prazo, expiração/reuso de quote e divergência servidor/UI. |
| Identidade/E-mail | Provedor gerenciado e caixa fictícia autorizada validam login, reset, expiração e revogação sem usar conta real. |
| QA de acessibilidade | Teclado completo, NVDA/VoiceOver/TalkBack, foco de Dialog, contraste computado, zoom 200/400% e reflow por tenant. |
| Performance | Catálogos de 100/1.000/10.000 e rede móvel controlada medem payload/LCP/INP sem carga em produção. |

## Limitações e risco residual

- Não houve conta autenticada local segura para exercitar perfil, fidelidade, carrinho persistido ou pedido completo no browser; esses fluxos não foram simulados como aprovados.
- Nenhum gateway, provedor de frete, ViaCEP, e-mail, Supabase remoto, CDN, storage, cloud ou produção foi acessado.
- O browser local confirmou layout/nome/foco da tela pública de login, não conformidade global, leitor de tela, contraste ou ausência universal de hydration errors.
- `FUX-003` e `FUX-015` permanecem pendentes; por isso esta etapa não remove os bloqueios de publicação já registrados em `FINAL-VALIDATION.md`.
- Os warnings de imagem/hook já conhecidos ficaram dentro do budget do repositório; não foram tratados por refatoração cosmética fora do achado.

## Encerramento

Todos os 15 IDs `FUX-*` foram revalidados e receberam estado explícito. As correções locais, testes, build e inspeção pública de três viewports estão verdes, mas fechamento transacional do carrinho, E2E autenticado/pagamento e validação assistiva continuam necessários. Portanto a etapa 08 está entregue, sem afirmar prontidão global de publicação.

## Adendo de 2026-09-28 — fechamento de `FUX-003` e revalidação do escopo 01

Este adendo é append-only e substitui somente o estado anterior de `FUX-003`. Ao iniciar esta execução, `docs/remediation/FRONTEND-FIXES.md` e o bloco da etapa 08 em `PROGRESS.md` **já existiam**, ao contrário da premissa do relatório recebido. O código, porém, ainda confirmava a pendência documentada: a tela de confirmação chamava apenas `clearCart()` no Zustand, `Order` não identificava o carrinho de origem e não havia conclusão persistida idempotente. O relatório original e `FINAL-VALIDATION.md` não foram reescritos.

| ID | Estado nesta execução | Evidência antes | Alteração / revalidação | Prova depois | Residual |
|---|---|---|---|---|---|
| `FUX-003` | `FIXED VERIFIED` local | Regressão escrita antes da correção: 6 falhas/4 passes; não existiam `completeCheckoutCart`, `reconcileAfterCheckout` nem `cartId` no contrato. A confirmação apagava só o snapshot local. | `Order.sourceCartID` único liga pedido/carrinho; checkout autenticado exige o `cartId` do mesmo owner+tenant e valida o snapshot. Após cobrança bem-sucedida, o servidor conclui exatamente o carrinho de origem sob lock; retry é no-op e itens/quantidades acrescentados durante o gateway migram para um novo carrinho ativo. Zustand refaz `GET /api/cart` e sinaliza outras abas; a confirmação não executa mais limpeza cega. | Testes focados 62/62; integração PostgreSQL 2/2 cobre owner/tenant incorreto, adição concorrente, reload e retry sem segunda cobrança; browser local confirmou carrinho com 1 item, checkout, reload e `GET /api/cart` com 0 itens. | Duas abas reais simultâneas e gateway externo permanecem `NOT VERIFIED`; a prova concorrente é integração de banco + contrato de `storage`, e o browser usou gateway fake local. |
| `FUX-008` | `ALREADY RESOLVED` | Estado atual já distinguia erro de saldo zero e validava status/JSON/envelope. | Revalidado sem ampliar a alteração preexistente. | Baseline focado 43/43 e suíte final 562/562. | Falha offline em browser e leitor de tela: `NOT VERIFIED`. |
| `FUX-010` | `ALREADY RESOLVED` | Store atual já distinguia `idle/loading/success/empty/error/unauthorized`, preservava erro visível e rollback. | Revalidado; a reconciliação pós-checkout foi acrescentada sem converter falha em vazio. | Testes da store/contrato no conjunto 62/62; browser confirmou estado não vazio antes da compra e vazio legítimo após reload. | Falha de rede injetada em browser: `NOT VERIFIED`. |
| `FUX-009` | `ALREADY RESOLVED` | O código atual já usava página/offset e total, sempre sob `userID + lojaID`; a chamada fixa `(..., 10, 0, ...)` do relatório não era mais o estado do repositório. | Revalidado sem nova regra de negócio. | `order-history-query` no baseline e suíte final verdes; fixture cobre 11 registros, `skip: 10` e duas páginas. | Navegação browser com mais de 10 pedidos e inserção concorrente: `NOT VERIFIED`. |
| `FUX-012` | `ALREADY RESOLVED` | Formulários atuais já associavam erro/campo por `aria-describedby`/`aria-invalid`, live region e foco do primeiro inválido. | Revalidado segundo as instruções de formulários acessíveis de `modern-web-guidance`. | Contratos de auth/acessibilidade verdes no baseline e na suíte final. | NVDA/VoiceOver/TalkBack e auditoria humana: `NOT VERIFIED`. |
| `FUX-013` | `ALREADY RESOLVED` | Drawer/item/resumo atuais já usavam texto pt-BR e `Intl.NumberFormat` BRL, sem alterar cálculos do servidor. | Revalidado; o browser exibiu `R$ 50,00`. | Contratos focados verdes e captura `cart-authenticated-before-checkout.png`. | Revisão de todas as superfícies/tenants por QA: `NOT VERIFIED`. |
| `FUX-014` | `ALREADY RESOLVED` | `safe-next-path` e login atual já aceitavam somente caminho interno seguro e rejeitavam origem externa, `//`, barra invertida, controle e loop. | Revalidado; nenhuma flexibilização foi feita. | Testes de navegação verdes; browser abriu `/login?next=/profile` e terminou em `/profile`. | Provedores de identidade externos não foram usados. |

### Correlação com os IDs finais preservados

| ID | Resultado desta etapa | Observação |
|---|---|---|
| `FINAL-015` | `FIXED VERIFIED` somente para a causa `FUX-003` | Não encerra sozinho o grupo transacional nem provas externas de reconciliação/refund. |
| `FINAL-022` | `ALREADY RESOLVED` para `FUX-009` | Owner+tenant e paginação foram revalidados localmente. |
| `FINAL-029` | `ALREADY RESOLVED` para `FUX-008/010` | Estados explícitos foram revalidados; cenários offline de browser continuam pendentes. |
| `FINAL-031` | `ALREADY RESOLVED` no contrato local de `FUX-012` | Tecnologia assistiva física permanece `NOT VERIFIED`. |
| `FINAL-036` | `ALREADY RESOLVED` para `FUX-013/014` | BRL/pt-BR e redirect interno seguro foram revalidados. |

### Evidência e gates deste adendo

| Comando / percurso | Resultado |
|---|---|
| baseline de 8 arquivos focados | 43/43 antes da implementação de `FUX-003` |
| regressão red de carrinho/checkout | 6 falhas/4 passes antes da implementação |
| conjunto focado final | 10 arquivos, 62/62 |
| `npx.cmd prisma validate` | schema válido |
| `npx.cmd prisma migrate deploy` + `migrate status` em PostgreSQL descartável | migration `20260928211500_checkout_cart_completion` aplicada; 25/25 em dia |
| `npx.cmd vitest run tests/integration/transactions-invariants.test.ts` | 1 arquivo, 2/2 |
| primeira suíte unitária completa | 560/562; revelou dois mocks antigos sem `$queryRaw` em checkout sem `cartId`; a conclusão foi condicionada corretamente a checkout autenticado com carrinho de origem |
| `npm.cmd test` final | 83 arquivos, 562/562 |
| `npx.cmd tsc --noEmit` | exit 0 |
| `npm.cmd run lint` | exit 0; 15 warnings conhecidos, 0 erros |
| `npm.cmd run build` | Next 16.3.5, TypeScript e 51 páginas; exit 0 |
| Chrome headless/CDP local | login → `/profile` → carrinho → checkout PIX fake local → confirmação → reload → perfil; `GET /api/cart` retornou 200/0 itens |

Capturas novas: [perfil autenticado](evidence/frontend08/profile-authenticated.png), [carrinho antes do checkout](evidence/frontend08/cart-authenticated-before-checkout.png) e [confirmação após persistência](evidence/frontend08/checkout-confirmation-persisted-cart.png).

As tentativas intermediárias de browser que falharam por seleção do formulário, tempo de hidratação e ID estático do gateway fake não foram classificadas como aprovação; o fluxo só foi registrado após a execução final determinística. A fixture, os processos e o banco local foram descartáveis. Nenhum Asaas, frete, e-mail, cloud ou produção foi chamado. A execução ocorreu com Node 24.16.0, enquanto o `package.json` declara Node `>=22 <23`; os gates ficaram verdes, mas a matriz oficial Node 22 ainda deve ser executada pelo CI. `Publication Status` permanece intocado.


## 2026-09-29 — execução dos prompts atualizados e correções locais

**IDs:** FUX-005/015, WEB-005/006/007/008, FINAL-020/023/024. Chrome isolado/Node 22/DB descartável e gateway fake comprovaram login com next, produto/carrinho, checkout PIX, offline/retry, confirmação/reload, duas abas, administração e pós-condições no DB.

Reproduzido foco em BODY após Escape do carrinho; corrigido em `CartProvider.tsx:14` e `CartDrawer.tsx:42` preservando o disparador. Reteste confirmou trap de Tab e retorno ao botão. Erro offline do checkout era “Failed to fetch”; agora informa conexão/retry em português e move foco ao resumo (`CheckoutForm.tsx:485`). Corrigidos labels dos14 controles administrativos. Screenshots e JSON desta rodada estão em `evidence/astra-20260929/`.

Sem overflow observado em 375/768/1366/1440/1920; largura equivalente a200% também inspecionada. CDP não substitui homologação assistiva ou testes em outros navegadores. FUX-015 continua parcial pela ausência de bootstrap browser portátil/CI, não por falha comprovada dessas jornadas.

**Validação consolidada:** [complemento de FINAL-VALIDATION](FINAL-VALIDATION.md#2026-09-29--execução-dos-prompts-atualizados-e-correções-locais). Histórico acima preservado; homologação externa não inferida.
