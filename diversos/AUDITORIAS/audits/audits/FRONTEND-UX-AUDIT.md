# Auditoria de Frontend, UI, UX e Integração

**Etapa:** 07/15  
**Data da análise:** 2026-09-26  
**Commit inspecionado:** `0c7ef7d`  
**Escopo:** frontend público e autenticado, contratos browser/API, estados de interface, responsividade estática e acessibilidade  
**Base:** repositório local; sem acesso a produção, banco real, contas reais ou serviços externos

## 1. Resumo executivo

O frontend é uma aplicação Next.js App Router com React, Tailwind, Zustand, Radix UI, Sonner e GSAP. A home é renderizada no servidor, mas serializa todo o catálogo para um único componente cliente; produto, filtros e paginação são estados locais. Carrinho e checkout usam `fetch` diretamente e não compartilham uma camada tipada de contratos.

O fluxo principal não está publicável no estado auditado. O checkout chama uma rota inexistente e envia um contrato incompatível com o único handler disponível. Mesmo após corrigir a URL, os nomes e a estrutura de cliente, itens e cartão seriam rejeitados; se a API respondesse, o frontend ainda consumiria o envelope no nível errado. O cálculo de frete do checkout tem outro contrato divergente e degrada silenciosamente para frete zero. Também há divergência entre o carrinho volátil do Zustand e o carrinho persistido no servidor.

Na acessibilidade, os componentes Radix usados no carrinho oferecem uma base adequada, mas os fluxos customizados não mantêm o mesmo nível: cartões de produto e opções de frete não são operáveis por teclado, os campos do checkout não têm associação programática com seus rótulos, modais próprios não gerenciam foco e o menu móvel fechado conserva controles alcançáveis por Tab. Não foi possível executar browser, Lighthouse ou árvore de acessibilidade porque `node_modules` está ausente.

**Conclusão limitada ao escopo:** publicação não recomendada antes de corrigir e testar `FUX-001`, `FUX-002`, `FUX-003`, `FUX-004`, `FUX-005` e `FUX-008`. Esta auditoria não afirma qualidade universal da interface e não substitui testes manuais com tecnologias assistivas, dispositivos reais ou ambiente integrado autorizado.

### Achados por severidade

| Severidade | Quantidade |
|---|---:|
| BLOCKER | 1 |
| CRITICAL | 0 |
| HIGH | 5 |
| MEDIUM | 6 |
| LOW | 2 |
| INFORMATIONAL | 1 |
| **Total** | **15** |

### Bloqueios de publicação

- `FUX-001`: o frontend não consegue concluir o checkout contra a API existente.
- `FUX-002`: o checkout não consome as opções reais de frete e pode avançar exibindo frete zero.
- `FUX-003`: reload/deep link perde o carrinho no checkout e a confirmação limpa apenas o estado local.
- `FUX-004`: barreiras de teclado e nomes programáticos atingem catálogo, frete, checkout e confirmação de entrega.
- `FUX-005`: o menu móvel fechado permanece na ordem de foco e, aberto, não implementa comportamento modal.
- `FUX-008`: falhas ao ler pontos são apresentadas como saldo zero/extrato vazio.

## 2. Metodologia

Foram lidos `AGENTS.md`, README técnico, `package.json`, layout e rotas App Router, componentes públicos/autenticados, hooks, store Zustand, handlers e schemas diretamente consumidos, serviços necessários para conferir respostas e testes relacionados. A revisão seguiu o fluxo **origem de estado → transformação → renderização/mutação → contrato HTTP → resposta exibida**; busca textual isolada foi usada apenas para inventário.

Foram aplicados os critérios locais de `modern-web-guidance` para formulários, semântica, foco, teclado, alvos e movimento. O procedimento de `a11y-debugging` foi usado para definir as verificações dinâmicas, mas sua etapa de Chrome DevTools/Lighthouse não pôde ser executada sem uma aplicação local inicializável. Nenhuma dependência foi instalada, para manter a alteração limitada ao relatório.

Nenhum segredo, cookie, dado pessoal, pagamento real, conta real ou endpoint externo foi usado. Não houve alteração em código de produto.

### 2.1 Comandos e resultados reproduzíveis

```powershell
rg --files app components hooks store lib
Get-ChildItem app -Recurse -File -Filter page.tsx
rg -n '<label|<input|<select|aria-|autoComplete|<button' components/checkout/CheckoutForm.tsx
rg -n 'prefers-reduced-motion|useReducedMotion|motion-reduce' app components hooks
rg -n -U '<Link[^>]*>[\s\S]{0,180}<button' app components --glob '*.tsx'
rg --files tests | rg -i 'front|ui|ux|component|checkout|cart|auth|profile|playwright|cypress|axe|a11y'
npm.cmd test
npm.cmd run lint
git status --short
```

Resultados observados:

- 153 arquivos sob `app`, `components`, `hooks` e `store`; 19 `page.tsx` e 45 handlers `route.ts` no repositório;
- não há `loading.tsx`, `error.tsx`, `not-found.tsx` ou `template.tsx` em `app`;
- não foram encontrados Playwright, Cypress, axe, Lighthouse, Storybook ou testes React `.test/.spec.tsx`;
- não foi encontrado tratamento de `prefers-reduced-motion`;
- `npm test` e `npm run lint` não executaram: código de saída 1, `vitest`/`eslint` não reconhecidos, pois `node_modules` está ausente;
- `public/videos/hero.mp4` existe e tem 3.803.869 bytes; o poster tem 32.567 bytes;
- o arquivo deste relatório não existia antes da auditoria; `docs/audits/` já continha relatórios não rastreados do usuário, preservados sem edição.

## 3. Mapa do frontend e fluxo real

### 3.1 Stack e responsabilidades observadas

| Camada | Implementação observada | Evidência |
|---|---|---|
| runtime/framework | Next.js `^16.3.5`, React/React DOM `^18`, App Router | `package.json:35-38`, `app/layout.tsx` |
| renderização inicial | Server Component busca loja, todos os produtos e marcas | `app/page.tsx:8-52` |
| estado de catálogo | hook cliente com busca, regex, filtros, paginação e URL | `hooks/useProductFilters.ts:198-435` |
| estado de carrinho | store Zustand somente em memória | `store/cart.store.ts:23-125` |
| UI/primitivos | Tailwind; Radix Dialog/ScrollArea; componentes próprios | `package.json:20-27`, `components/ui/sheet.tsx` |
| feedback | Sonner, alertas inline e `console` | `components/checkout/CheckoutForm.tsx:445-450` |
| movimento | CSS/Tailwind e GSAP; vídeo autoplay | `app/globals.css:19-47`, `components/home/HeroVideo.tsx:16-139` |
| integração | `fetch` direto nos componentes/stores; sem cliente compartilhado tipado | `store/cart.store.ts`, `components/checkout/*`, `components/profile/*` |
| testes | Vitest para domínio/API; nenhum teste de componente/E2E/a11y encontrado | `package.json:10-15`, `tests/` |

### 3.2 Fluxo navegador → aplicação → APIs

```text
Browser
  ├─ / (Server Component)
  │    └─ getProducts(all:true) + getBrandsWithProductCount
  │         └─ HomeClient: filtros/paginação/produto em estado local
  ├─ Zustand cart.store
  │    └─ /api/cart (GET/POST/PATCH/DELETE; sessão obrigatória)
  ├─ /checkout
  │    ├─ /api/loja/active
  │    ├─ ViaCEP no browser
  │    ├─ /api/freight/calculate
  │    ├─ /api/loyalty/wallet e /api/loyalty/simulate
  │    └─ /api/checkout/create-order  ← rota inexistente
  ├─ /checkout/confirmation
  │    ├─ sessionStorage:last_order
  │    └─ /api/orders/:id/status (polling)
  └─ /profile
       ├─ Server Component: usuário + 10 pedidos
       ├─ /api/user/profile
       ├─ /api/orders/:id/confirm-delivery
       └─ /api/loyalty/wallet
```

### 3.3 Cobertura dos fluxos e estados

| Fluxo | Loading | Sucesso | Vazio | Erro | Disabled | Retry/offline | Resultado |
|---|---|---|---|---|---|---|---|
| home/catálogo | não há estado de fetch cliente; dados vêm do servidor | sim | sim | sem `error.tsx` | parcial | não | leitura estática |
| categoria/filtros | N/A, cálculo local | sim | sim | N/A | paginação | não | leitura estática; não há rota de categoria |
| produto | N/A, estado local | sim | N/A | add falha silenciosamente | variante sem estoque | não | leitura estática; não há rota de produto |
| carrinho | spinner | sim | sim | mascarado/console | mutações durante loading | não | leitura estática |
| checkout | spinner de loja/frete/submissão | contrato impede sucesso | carrinho vazio | banner para parte das falhas | parcial | sem retry | falha confirmada de integração |
| pagamento/confirmação | polling discreto | tela por método | sem sessão redireciona | polling falha silenciosamente | simulação dev | não | sucesso não executável pelo frontend atual |
| pedidos | servidor | sim, até 10 | sim | sem boundary da rota | confirmação durante envio | retry manual apenas no modal | leitura estática |
| cadastro/login/reset | spinner | sim | N/A | inline | submit | não | leitura estática |
| conta/perfil | save spinner | sim | N/A | inline/toast | campos/read-only | novo submit | leitura estática |
| endereços | ausente | ausente | ausente | ausente | ausente | ausente | não executável; só há API `set-default` |
| pontos | spinner | sim | sim | mascarado como zero/vazio | paginação | botão refresh no extrato | falha de estado confirmada |

## 4. Findings

### FUX-001 — Checkout usa rota, payload e envelope incompatíveis

- **Categoria:** funcional / integração
- **Severidade:** BLOCKER
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `components/checkout/CheckoutForm.tsx:27-37,397-446`; `app/checkout/page.tsx:90-124,196-202`; `app/api/checkout/route.ts:10-42,90-106`; `lib/validators/checkout.validators.ts:24-125`; `lib/api-response.ts:3-5`
- **Fluxo e condição:** usuário com itens avança às três etapas e confirma qualquer meio de pagamento.
- **Evidência observada (fato):** o formulário chama `POST /api/checkout/create-order`, mas o único arquivo é `app/api/checkout/route.ts`, isto é, `POST /api/checkout`. O frontend envia cliente plano (`customerName`, `customerEmail`...), `cardData` e itens `productID/productName`; o schema exige `customer`, `creditCard` e `productId/name`. Além disso, o carrinho real expõe `productID`, mas a prop foi redefinida como `productId` e silenciada com `items as any`, de modo que `i.productId` fica `undefined`. A API bem-sucedida responde `{ success, data: { success, order } }`, enquanto `handleOrderCreated` lê o resultado como pedido direto.
- **Hipótese delimitada:** nenhuma chamada HTTP foi necessária para concluir a incompatibilidade; a rota inexistente produziria 404 no roteamento observado. Corrigir apenas a URL faria o schema rejeitar o payload.
- **Impacto:** nenhum pedido/pagamento pode ser concluído pelo fluxo de UI; se correções parciais forem feitas, o frontend ainda pode quebrar ao acessar `result.customer.name`.
- **Correção proposta:** definir um contrato compartilhado e único; chamar `/api/checkout`; mapear `{ customer, items: { productId, variantId, name... }, creditCard, installments }`; remover `as any`; gerar/enviar idempotency key; consumir explicitamente `response.data.order` (ou simplificar o envelope de forma consistente).
- **Teste de regressão:** E2E local com PIX, cartão e boleto validando request exato, status, envelope, navegação e dados da confirmação; teste de contrato TypeScript que falhe se `CartItemType` deixar de satisfazer a entrada do checkout.
- **Risco residual:** gateways e falhas parciais exigem testes de integração próprios mesmo depois de o contrato browser/API alinhar.

### FUX-002 — Contrato de frete do checkout degrada para zero sem avisar

- **Categoria:** funcional / UX / integração
- **Severidade:** HIGH
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `components/checkout/CheckoutForm.tsx:242-277,326-341,645-729`; `app/api/freight/calculate/route.ts:7-24,136-142`
- **Fluxo e condição:** na etapa de entrega, o usuário informa CEP válido.
- **Evidência observada (fato):** o frontend envia `lojaId`, `weightInKg`, `heightInCm`, `widthInCm` e `lengthInCm`; o handler lê `lojaID`, `productId`, `weightInGrams`, `heightCm`, `widthCm` e `lengthCm`. A resposta válida é `{ success, data: { options... } }`, mas o componente procura `data.options`. O resultado é `freightOptions=[]`. Erros e respostas não OK são apenas registrados no console. A validação exige seleção somente quando `freightOptions.length > 0`, permitindo avançar; `calculatedFreightCost` então retorna zero.
- **Hipótese delimitada:** o tenant pode ser recuperado por headers e o backend possui fallbacks de dimensão, portanto a request não necessariamente falha; ainda assim a UI nunca lê `data.data.options`.
- **Impacto:** opção, preço e prazo de frete reais não aparecem; o resumo exibe zero e o servidor pode recalcular valor diferente, rejeitar a operação ou criar surpresa de preço.
- **Correção proposta:** usar o mesmo DTO do calculador de produto, incluir `productId/variantId/quantity`, ler `data.data.options`, checar `res.ok`, bloquear avanço até uma opção válida ou oferecer erro/retry explícito e preservar a seleção apenas enquanto CEP/itens não mudarem.
- **Teste de regressão:** teste de componente com fixture da resposta real; E2E para sucesso, zero opções, 400, timeout e troca de CEP; assert de que entrega não avança sem escolha válida.
- **Risco residual:** disponibilidade e precisão de provedores continuam dependentes da infraestrutura e devem ser reconciliadas no servidor.

### FUX-003 — Estado do carrinho diverge entre Zustand, reload e persistência do servidor

- **Categoria:** arquitetura frontend / funcional
- **Severidade:** HIGH
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `store/cart.store.ts:33-49,102-123`; `components/cart/CartDrawer.tsx:24-34`; `app/checkout/page.tsx:12-21,170-203`; `app/checkout/confirmation/page.tsx:62-75`; `services/cart.service.ts:31-60`
- **Fluxo e condição:** abrir `/checkout` diretamente, recarregar a página durante o checkout ou concluir um pedido e reabrir o carrinho.
- **Evidência observada (fato):** `fetchCart` só é disparado quando o drawer abre. `/checkout` lê o Zustand em memória e não hidrata `/api/cart`; após reload, `cart` volta a `null` e a tela mostra carrinho vazio apesar do carrinho persistido. Na confirmação, `clearCart()` apenas faz `set({ cart: null })`. A busca no serviço de checkout não encontrou fechamento/limpeza do carrinho persistido.
- **Hipótese delimitada:** uma navegação SPA iniciada a partir do drawer preserva o estado e mascara o defeito; reload/deep link o manifesta de forma determinística.
- **Impacto:** abandono involuntário, carrinho reaparecendo com itens já comprados, repetição de pedido e totais obsoletos.
- **Correção proposta:** hidratar o carrinho em um provider/layout autenticado ou no loader do checkout; modelar status `idle/loading/success/empty/error`; após pedido confirmado, marcar/fechar o carrinho no servidor atomicamente e atualizar a store com a resposta canônica.
- **Teste de regressão:** E2E adicionar item → abrir checkout → reload → itens permanecem; concluir pedido → novo GET do carrinho retorna vazio/novo carrinho; falha do GET não pode renderizar “vazio”.
- **Risco residual:** sincronização entre abas e alterações concorrentes ainda requer revalidação/versionamento.

### FUX-004 — Barreiras de teclado e nomes programáticos no funil principal

- **Categoria:** acessibilidade
- **Severidade:** HIGH
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `components/home/HomeClient.tsx:416-452`; `components/checkout/CheckoutForm.tsx:519-580,645-805,921-981`; `app/profile/components/OrderHistoryList.tsx:245-304`
- **Fluxo e condição:** navegação por teclado ou tecnologia assistiva no catálogo, seleção de frete, preenchimento do checkout e confirmação de entrega.
- **Evidência observada (fato):** o cartão inteiro do produto é um `div` com `onClick`, sem `tabIndex`, tecla ou papel; opções de frete também são `div` clicáveis; rótulos do checkout não têm `htmlFor` e os campos não têm `id`, `aria-describedby` ou autocomplete; o modal de confirmação é um `div` visual sem `role=dialog`, `aria-modal`, título associado, foco inicial, trap, Escape ou retorno de foco.
- **Hipótese delimitada:** a ordem/fala exata de leitores de tela não foi medida em browser; a ausência dos vínculos e operações de teclado é observável no markup.
- **Impacto:** usuários sem mouse podem não abrir produto, escolher frete ou operar o modal; leitores de tela recebem campos sem rótulo e sem relação com o erro.
- **Correção proposta:** usar `Link`/`button` para cartões e opções, `fieldset/legend` e radios para escolhas, IDs e `htmlFor`, `aria-invalid/describedby`, autocompletes de identidade/endereço/cartão e um Dialog Radix para confirmação.
- **Teste de regressão:** Playwright somente por teclado para home → produto → frete → checkout; axe sem violações de label/nested-interactive; teste manual NVDA/VoiceOver com anúncio de campo, erro e modal.
- **Risco residual:** conformidade WCAG completa exige inspeção de contraste, zoom, reflow e tecnologias assistivas reais.

### FUX-005 — Menu móvel fechado permanece focável e o aberto não é modal

- **Categoria:** acessibilidade / navegação móvel
- **Severidade:** HIGH
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `components/MobileMenu.tsx:13-104`; `components/ConditionalHeader.tsx:55-64`
- **Fluxo e condição:** viewport móvel, menu fechado ou aberto, navegação por Tab/Shift+Tab.
- **Evidência observada (fato):** o painel fechado é apenas deslocado com `translate-x-full`; seus links e botão de logout permanecem no DOM sem `hidden`, `inert` ou remoção de tabulação. Aberto, não possui semântica de diálogo, fechamento por Escape, foco inicial/trap/retorno ou bloqueio de scroll. O header inicialmente invisível da home também usa apenas opacidade/pointer-events, mantendo descendentes no foco do teclado.
- **Hipótese delimitada:** a sequência exata de foco não foi capturada em DevTools, mas CSS não retira elementos interativos da ordem de foco.
- **Impacto:** foco “desaparece” em controles fora da tela, conteúdo atrás do menu permanece alcançável e a navegação móvel fica imprevisível.
- **Correção proposta:** usar Dialog/Sheet Radix ou implementar integralmente `aria-modal`, foco, Escape, inert e retorno; desmontar/ocultar semanticamente o painel fechado; impedir foco no header enquanto oculto.
- **Teste de regressão:** viewport 320/375 px, teclado: foco entra no primeiro item, fica contido, Escape fecha e retorna ao acionador; painel fechado não recebe Tab.
- **Risco residual:** leitores de tela móveis e combinações Safari/iOS precisam de teste real.

### FUX-006 — Produto não tem URL própria nem histórico navegável

- **Categoria:** UX / roteamento
- **Severidade:** MEDIUM
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `components/home/HomeClient.tsx:50-55,177-180,374-377,416-419`; `app/` (inventário de páginas)
- **Fluxo e condição:** abrir um produto, recarregar, compartilhar a URL ou usar Voltar/Avançar do navegador.
- **Evidência observada (fato):** a página de produto é um branch de `selectedProduct` em memória; a seleção não altera rota nem query. Não existe página dinâmica pública de produto. Recarregar perde o detalhe, compartilhar mantém apenas `/` e o botão Voltar do navegador não fecha a visualização. Também não há rota pública de categoria; categorias são filtros locais.
- **Hipótese delimitada:** não foi encontrada exigência explícita de SEO, mas deep link e histórico são comportamentos esperados para catálogo transacional.
- **Impacto:** links de produto não são compartilháveis, histórico do navegador não corresponde à navegação percebida e indexação/analytics por produto ficam limitados.
- **Correção proposta:** criar rota estável por slug/ID, usar `Link`, resolver produto no servidor e preservar retorno/filtros; categorias importantes podem ter rotas ou URLs canônicas.
- **Teste de regressão:** abrir URL direta, reload, compartilhar em nova aba e navegar Voltar/Avançar preservando produto e filtros.
- **Risco residual:** metadados/SEO e canonicalização multi-tenant precisam de validação separada.

### FUX-007 — Todo o catálogo e regras de classificação são enviados ao cliente

- **Categoria:** arquitetura frontend / performance
- **Severidade:** MEDIUM
- **Confiança:** HIGH CONFIDENCE
- **Arquivo e linhas:** `app/page.tsx:14-38`; `hooks/useProductFilters.ts:59-120,212-285,329-399`
- **Fluxo e condição:** home de loja com catálogo crescente ou URL com filtros.
- **Evidência observada (fato):** `getProducts({ all: true })` busca e serializa todos os produtos, variantes e galerias. Busca, contagens, marca/tag por grandes regexes e paginação de 12 são calculadas no browser. Filtros da URL só são aplicados em `useEffect` após a hidratação; a URL é atualizada com `replaceState`.
- **Hipótese delimitada:** o volume atual do catálogo e métricas de bundle não foram medidos, portanto degradação concreta é condicionada ao crescimento; a estratégia e seu custo O(n) são confirmados.
- **Impacto:** payload/hidratação, memória e CPU crescem com todo o catálogo; HTML inicial de um deep link pode não corresponder ao filtro; taxonomia inferida por texto pode divergir dos dados persistidos.
- **Correção proposta:** paginação/filtros server-side com query validada, DTO enxuto, cache/revalidação e taxonomia persistida como fonte de verdade; usar navegação do router para URLs e histórico coerentes.
- **Teste de regressão:** medir payload/LCP/INP com catálogos de 100, 1.000 e 10.000 itens; contrato de paginação; SSR de URL filtrada deve conter os itens corretos antes da hidratação.
- **Risco residual:** busca avançada pode exigir índice/serviço próprio conforme o volume real.

### FUX-008 — Falhas de pontos são exibidas como saldo zero ou extrato vazio

- **Categoria:** funcional / UX / integração
- **Severidade:** HIGH
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `components/profile/LoyaltyHistoryView.tsx:21-44,118-208`; `components/checkout/LoyaltyPointsWidget.tsx:32-64,144-165`
- **Fluxo e condição:** `/api/loyalty/wallet` retorna 4xx/5xx, corpo inesperado ou falha de rede.
- **Evidência observada (fato):** o histórico não verifica `res.ok`, não mantém estado de erro e deixa `statement=null`; ao terminar o loading, renderiza saldo/pending/lifetime como zero e “Nenhuma movimentação”. O widget do checkout só distingue 401; outras falhas mantêm `isAuthenticated=true`, `wallet=null` e exibem saldo zero.
- **Hipótese delimitada:** não houve falha injetada em runtime; o ramo de renderização após resposta inválida é determinístico pelo código.
- **Impacto:** informação financeira/fidelidade incorreta, suporte desnecessário e decisão de compra sem desconto disponível.
- **Correção proposta:** estado discriminado `loading/success/empty/error/unauthorized`, validação do envelope, mensagem que não confunda indisponibilidade com zero e retry acessível; conservar último valor apenas com indicação de desatualizado.
- **Teste de regressão:** fixtures 200 com saldo zero, 200 com saldo, 401, 500, JSON inválido e offline; somente o primeiro pode exibir zero real.
- **Risco residual:** consistência temporal do saldo ainda depende do backend e da reconciliação de pontos.

### FUX-009 — Histórico do cliente torna pedidos além dos dez primeiros inacessíveis

- **Categoria:** funcional / UX
- **Severidade:** MEDIUM
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `app/profile/page.tsx:16-25`; `app/profile/components/OrderHistoryList.tsx:21-45,80-243`
- **Fluxo e condição:** cliente com mais de dez pedidos abre “Meus Pedidos”.
- **Evidência observada (fato):** o servidor chama `getUserOrders(user.id, 10, 0, ...)`; o componente recebe apenas um array, mostra `orderList.length` como quantidade e não oferece paginação/carregamento adicional.
- **Hipótese delimitada:** não foi usada conta com mais de dez pedidos, mas o limite fixo e ausência de navegação são explícitos.
- **Impacto:** pedidos antigos e seus rastreios deixam de ser consultáveis; o contador sugere incorretamente que o subconjunto é o total.
- **Correção proposta:** retornar `{items,total,page,totalPages}`, paginar por URL/cursor no servidor e manter filtros/status.
- **Teste de regressão:** fixture com 11+ pedidos; o 11º deve ser acessível e o total deve refletir a coleção completa.
- **Risco residual:** grandes históricos requerem ordenação estável e cursor para evitar duplicação entre páginas.

### FUX-010 — Erros de carrinho e adição não chegam ao usuário

- **Categoria:** funcional / UX
- **Severidade:** MEDIUM
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `store/cart.store.ts:37-49,51-73,75-123`; `components/home/HomeClient.tsx:148-174`; `components/cart/CartDrawer.tsx:53-76`
- **Fluxo e condição:** estoque insuficiente, 400/500, perda de rede ou falha ao atualizar/remover.
- **Evidência observada (fato):** `fetchCart` ignora respostas não OK; update/remove fazem rollback e apenas `console.error`; `handleBuy` captura a exceção e também só registra. A store não possui `error`; o drawer mostra vazio quando `cart` é nulo e loading termina. Botões do grid não são desabilitados durante adição.
- **Hipótese delimitada:** as mensagens exatas do browser não foram observadas; a ausência de feedback renderizado está confirmada.
- **Impacto:** o usuário não sabe se a ação falhou, pode repetir cliques ou interpretar indisponibilidade como carrinho vazio.
- **Correção proposta:** estado de erro por operação, toast/banner contextual, retry, desabilitação por item e tratamento explícito de 401/409/422/500; não representar falha como vazio.
- **Teste de regressão:** mocks para cada status e rede offline, verificando rollback + mensagem + reabilitação do controle.
- **Risco residual:** mensagens devem ser localizadas e não expor detalhes internos.

### FUX-011 — Movimento contínuo e vídeo autoplay ignoram preferência de redução

- **Categoria:** acessibilidade / UI / performance
- **Severidade:** MEDIUM
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `app/globals.css:16-47,91-160,182-220`; `components/home/HeroVideo.tsx:16-68,71-139`; `components/cart/CartSummary.tsx:12-36`
- **Fluxo e condição:** usuário com `prefers-reduced-motion: reduce`, conexão limitada ou sensibilidade a movimento acessa a home/carrinho/confirmação.
- **Evidência observada (fato):** não há media query/hook de redução; o hero carrega vídeo `preload="auto"`/autoplay e dispara animação GSAP; há shimmer, spin, pulse, ping e smooth scroll. O MP4 local tem 3.803.869 bytes.
- **Hipótese delimitada:** LCP, consumo de dados e sintomas não foram medidos em dispositivo; a transferência efetiva depende do browser/cache.
- **Impacto:** desconforto para usuários sensíveis, custo de dados e possível atraso em mobile.
- **Correção proposta:** respeitar `prefers-reduced-motion`, exibir poster estático e revelar conteúdo imediatamente; pausar animações contínuas e trocar smooth por auto; considerar `preload="metadata"`/estratégia responsiva.
- **Teste de regressão:** emulação de reduced motion confirma ausência de autoplay/transições; Lighthouse/WebPageTest em mobile mede bytes, LCP e CPU.
- **Risco residual:** desempenho depende de CDN, codec e rede reais.

### FUX-012 — Feedback e controles de autenticação não têm semântica acessível consistente

- **Categoria:** acessibilidade / formulários
- **Severidade:** MEDIUM
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `components/forms/LoginForm.tsx:78-159`; `components/forms/RegisterForm.tsx:219-246`; `components/forms/ForgotPasswordForm.tsx:74-155`; `components/forms/ResetPasswordForm.tsx:107-207`
- **Fluxo e condição:** validação/erro de login, cadastro, recuperação ou reset; alternância de visibilidade da senha; navegação nas telas de sucesso.
- **Evidência observada (fato):** mensagens dinâmicas não usam live region/`role=alert` nem recebem foco; erros por campo não são associados por `aria-describedby/aria-invalid`; vários `Link` contêm `button`, criando controles interativos aninhados; o botão de mostrar senha não tem nome acessível e foi removido da ordem de foco com `tabIndex={-1}`.
- **Hipótese delimitada:** anúncio específico do leitor de tela não foi executado; o markup inválido/sem relações foi confirmado.
- **Impacto:** usuários podem não perceber falhas, não saber o campo inválido ou não conseguir alternar a senha por teclado.
- **Correção proposta:** usar o próprio `Link` estilizado, live regions, foco no resumo/primeiro campo inválido, IDs de erro e botão de visibilidade nomeado e focável.
- **Teste de regressão:** axe + teclado + NVDA/VoiceOver nos estados de erro e sucesso.
- **Risco residual:** conteúdo de mensagens e timing dos anúncios precisam de teste humano.

### FUX-013 — Carrinho mistura idioma e símbolo monetário incorreto

- **Categoria:** UI / UX
- **Severidade:** LOW
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `components/cart/CartDrawer.tsx:42-63`; `components/cart/CartItem.tsx:46-48,76-84`; `components/cart/CartSummary.tsx:65-74`; `app/layout.tsx:35-43`
- **Fluxo e condição:** qualquer usuário abre o carrinho em uma aplicação declarada `pt-BR`.
- **Evidência observada (fato):** aparecem “Your Cart”, “Loading cart”, “Your cart is empty”, “Remove” e “Continue Shopping”. O item usa `$12.34`, enquanto o resumo usa `Intl(... BRL)`.
- **Hipótese delimitada:** nenhuma; é inconsistência textual observável.
- **Impacto:** menor confiança e ambiguidade monetária, especialmente antes do total.
- **Correção proposta:** centralizar i18n/formatador de moeda e usar português/BRL em todo o drawer, inclusive labels acessíveis.
- **Teste de regressão:** snapshots/i18n para `pt-BR` e assert de formatação `R$ 12,34`.
- **Risco residual:** futuras localidades exigem catálogo de mensagens e locale por tenant.

### FUX-014 — Retorno pós-login ignora a rota solicitada

- **Categoria:** UX / navegação
- **Severidade:** LOW
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `app/profile/fidelidade/page.tsx:13-18`; `app/login/page.tsx:8-24`; `components/forms/LoginForm.tsx:38-52`
- **Fluxo e condição:** anônimo abre `/profile/fidelidade`, é redirecionado para `/login?next=/profile/fidelidade` e autentica.
- **Evidência observada (fato):** a página de login não lê `next`; o formulário sempre executa `router.push('/')`.
- **Hipótese delimitada:** outros guards podem enviar `/login` sem `next`, mas o caso de fidelidade já gera o parâmetro explicitamente.
- **Impacto:** contexto perdido e etapas extras após login; tentativa de adicionar ao carrinho também retorna à home sem restaurar a ação.
- **Correção proposta:** validar destino relativo/allowlist no servidor ou página, repassá-lo ao formulário e navegar para ele após sucesso.
- **Teste de regressão:** login com `next` interno permitido retorna ao destino; URL externa ou `//host` é recusada e cai em `/`.
- **Risco residual:** preservar ações de carrinho requer intenção explícita, não apenas redirect.

### FUX-015 — Não há suíte automatizada de frontend, E2E ou acessibilidade

- **Categoria:** qualidade / cobertura
- **Severidade:** INFORMATIONAL
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `package.json:5-15,45-56`; diretório `tests/`
- **Fluxo e condição:** regressões em componentes e contratos são introduzidas.
- **Evidência observada (fato):** scripts executam Vitest sobre testes de unidade/integração de backend. Não foram encontrados testes `.tsx`, Playwright/Cypress, axe/Lighthouse ou configuração E2E. A suíte existente não pôde ser rodada sem dependências locais.
- **Hipótese delimitada:** ausência de teste não prova defeito; os defeitos deste relatório foram demonstrados por contratos/markup, não inferidos da cobertura.
- **Impacto:** mudanças de rota, payload, teclado e responsividade podem chegar sem alarme — como ocorreu no contrato do checkout.
- **Correção proposta:** pirâmide mínima: testes de componentes/contratos, E2E dos fluxos críticos e smoke a11y por viewport; manter testes manuais assistivos.
- **Teste de regressão:** CI falha ao reintroduzir payload antigo, controle sem nome ou checkout sem frete.
- **Risco residual:** automação não substitui avaliação humana de UX/acessibilidade.

## 5. Responsividade e acessibilidade — avaliação estática

Há sinais positivos: grids usam `grid-cols-1` e breakpoints; o checkout muda de uma para doze colunas apenas em `lg`; imagens principais usam `object-contain`; tabelas de pontos têm `overflow-x-auto`; o carrinho usa Dialog Radix. Também há `lang="pt-BR"`, headings e vários nomes acessíveis pontuais.

Limitações/risco estático:

- glows absolutos de 1.000/1.100 px em checkout/confirmação podem ampliar overflow horizontal; não confirmado visualmente;
- card de produto tem altura fixa de 480 px e preço em `whitespace-nowrap`; combinações extremas de fonte/texto precisam de reflow em 320 px e zoom 200/400%;
- alvos de quantidade do carrinho contêm ícones de 12 px e pouco padding; tamanho efetivo não foi medido no browser;
- contrastes com transparência/backdrop e estados hover/focus não foram medidos contra o pixel final;
- bottom sheets customizados precisam de auditoria de foco equivalente ao menu móvel.

Viewports solicitados — **não verificados dinamicamente**:

| Classe | Viewport de regressão proposto | Status |
|---|---:|---|
| mobile pequeno | 320×568 e 375×667 | pendente |
| tablet | 768×1024 | pendente |
| notebook | 1366×768 | pendente |
| desktop | 1920×1080 | pendente |

## 6. Dívida priorizada

1. Reunificar contratos de checkout/frete e remover `any`; bloquear merge sem teste de contrato/E2E.
2. Definir ciclo de vida canônico do carrinho entre servidor e store, inclusive reload e pós-pedido.
3. Substituir elementos clicáveis e overlays customizados por primitivas semânticas com foco completo.
4. Separar estados `empty` e `error` em carrinho, fidelidade e integrações; oferecer retry.
5. Criar URLs estáveis de produto/categoria e mover filtros/paginação para o servidor conforme volume.
6. Adicionar reduced motion, performance budget do hero e validação real nos quatro viewports.
7. Paginar pedidos e padronizar idioma, moeda, mensagens e redirecionamentos.

## 7. Itens não aplicáveis e lacunas

### Não aplicáveis no escopo observado

- **Offline-first/PWA:** não há service worker, manifest ou promessa de operação offline; foi avaliada apenas a qualidade do erro de rede.
- **Aplicativo nativo:** não existe implementação iOS/Android neste repositório.
- **IA no frontend:** nenhum fluxo de modelo/prompt foi encontrado.
- **Rota pública dedicada de categoria/produto:** ausente; foi registrada como limitação funcional, não simulada.
- **Gestão de endereços na conta:** não existe UI/CRUD correspondente; apenas `app/api/address/set-default/route.ts` foi encontrado. O fluxo não pôde ser percorrido.

### Não verificado

- renderização real, console/hydration, screenshots e interação por mouse/teclado;
- Lighthouse, axe, árvore de acessibilidade, contraste computado e ordem real de foco;
- responsividade nos quatro grupos de viewport, zoom e orientação;
- browser Safari/iOS, Chrome/Android, Firefox e leitores NVDA/JAWS/VoiceOver/TalkBack;
- sucesso de build/lint/test, porque dependências locais estão ausentes;
- integrações reais ViaCEP, transportadoras, Asaas, e-mail e polling;
- estados com contas fictícias, catálogo/nomes extremos, mais de dez pedidos e saldo real;
- métricas Web Vitals, payload RSC, memória/CPU e comportamento em rede lenta.

## 8. Riscos residuais

- Mesmo com contratos corrigidos, totais e disponibilidade precisam continuar autoritativos no servidor e ser reapresentados antes da cobrança se mudarem.
- Otimistic updates do carrinho podem conflitar entre abas/dispositivos sem versão/revalidação.
- UI multi-tenant pode receber cores que reduzam contraste; tokens dinâmicos exigem guarda de contraste por tenant.
- Dependências externas e polling podem gerar estados intermediários não cobertos por inspeção estática.
- Acessibilidade completa depende de conteúdo real, zoom, hardware, browser e teste humano.
- Ausência de error boundaries e arquivos de loading deixa falhas de Server Components sujeitas ao fallback padrão do framework; o comportamento visual depende do build/runtime não executado.

## 9. Conclusão

O frontend possui uma estrutura visual consistente e alguns bons primitives, mas o caminho transacional está quebrado por drift de contratos e por estado de carrinho não canônico. Os problemas de acessibilidade atingem operações essenciais, não apenas detalhes cosméticos. A prioridade deve ser restaurar um checkout executável e testado, tornar carrinho/frete/pontos honestos quanto aos estados e garantir operação por teclado/foco. Somente depois faz sentido validar refinamentos responsivos e de performance em browser.

Esta conclusão se restringe ao código local e às verificações seguras disponíveis nesta etapa. A próxima etapa não foi iniciada.
