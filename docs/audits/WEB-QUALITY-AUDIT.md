# Auditoria de SEO, acessibilidade e plataforma web

**Etapa:** 14/15  
**Escopo:** SEO técnico, acessibilidade e comportamento da plataforma web  
**Ponto de evidência:** commit `0c7ef7d`  
**Data da análise:** 2026-09-26  
**Ambiente:** repositório local; sem acesso a produção, dados reais ou serviços externos

## Executive Summary

O storefront é uma aplicação Next.js 16 com renderização inicial do catálogo no servidor, idioma `pt-BR`, imagens com textos alternativos na maior parte dos pontos inspecionados e um conjunto útil de headers defensivos declarado em `next.config.js`. Esses são sinais positivos, mas o fluxo público ainda não oferece a estrutura mínima esperada para descoberta orgânica e navegação assistiva de um e-commerce.

Foram registrados **13 achados**: **0 BLOCKER**, **0 CRITICAL**, **6 HIGH**, **6 MEDIUM**, **1 LOW** e **0 INFORMATIONAL**. Os maiores riscos são:

- produto, categoria, busca, filtro e paginação não possuem URLs próprias; detalhes de produto existem apenas como estado React em `/`;
- não existem sitemap, robots, canonical ou base canônica, apesar de a aplicação resolver lojas por host;
- cards de produto e opções de frete não são operáveis por teclado;
- o checkout não associa programaticamente rótulos, ajuda e erros aos campos;
- menus/drawers customizados não implementam ciclo de foco; o menu mobile fechado mantém controles focáveis fora da tela;
- não há tratamento de `prefers-reduced-motion`, embora a experiência use vídeo automático, GSAP, scroll suave e animações contínuas.

Não foi possível executar a aplicação, Lighthouse, inspeção da árvore de acessibilidade, navegação por teclado real, contraste computado, validação de hydration ou inspeção de headers HTTP. `node_modules` e `.next` não existem no workspace; `npm run build` e `npm run lint` falharam porque os binários locais não estão instalados. Portanto, qualquer conclusão visual ou de runtime está marcada como **NOT VERIFIED** e não foi convertida em defeito confirmado sem evidência estática suficiente.

## Escopo e critérios

Foram inspecionados:

- metadata global e por rota;
- URLs públicas, navegação, catálogo, busca, filtros, paginação e detalhes de produto;
- `robots`, sitemap, canonical, OpenGraph, Twitter Cards e dados estruturados;
- semântica, landmarks, headings, nomes acessíveis, labels, foco, teclado, movimento, imagens e formulários;
- 404, boundaries de erro, redirects presentes no repositório, configuração de cache e headers de segurança;
- pontos estáticos com risco de hydration e os testes existentes relacionados ao escopo.

Critérios operacionais de acessibilidade utilizados: HTML semântico antes de ARIA, nome acessível para controles, associação `label`/campo, operação integral por teclado, foco visível, foco contido/restaurado em dialogs, landmarks identificáveis, anúncios de erro/status e respeito a redução de movimento. As checklists locais `a11y-debugging` e `modern-web-guidance` direcionaram a inspeção de semântica, formulários, foco e movimento; não substituem validação em navegador.

## Metodologia

1. Leitura das instruções do repositório (`AGENTS.md`), manifestos e configuração (`package.json`, `next.config.js`, `tailwind.config.ts`). Não há `README` na raiz.
2. Inventário das páginas App Router, componentes públicos, arquivos especiais de metadata e assets públicos.
3. Rastreamento da experiência pública desde o HTML/metadata até catálogo, produto, carrinho, checkout e confirmação.
4. Revisão estática de semântica e interação: elemento renderizado, evento, estado acessível, foco e feedback.
5. Busca por testes de SEO/acessibilidade e tentativa de verificações locais disponíveis.
6. Separação explícita entre evidência confirmada no código e comportamento que depende de build, browser, domínio ou infraestrutura.

Não foram alterados arquivos de produto. Este relatório é a única alteração desta etapa.

## Evidências reproduzíveis

| Comando/verificação | Resultado observado |
|---|---|
| `git rev-parse --short HEAD` | `0c7ef7d`. |
| `Get-ChildItem -Path app -Recurse -File -Filter page.tsx` | 18 páginas; somente `/` é rota pública de catálogo. Não há páginas dinâmicas públicas de produto ou categoria. |
| `rg -n --glob '*.tsx' --glob '*.ts' 'generateMetadata\|export const metadata\|metadataBase\|canonical\|openGraph\|robots\|sitemap\|application/ld\\+json\|schema.org' app components` | Metadata encontrada no layout e em algumas páginas; nenhuma ocorrência de `metadataBase`, canonical, OpenGraph/Twitter, robots, sitemap ou JSON-LD. |
| `Test-Path` para `app/robots.ts`, `app/sitemap.ts`, `public/robots.txt`, `public/sitemap.xml`, `app/not-found.tsx`, `app/error.tsx`, `app/global-error.tsx`, `app/manifest.ts`, imagens OG/Twitter | Todos retornaram `False`. |
| `rg -n --glob '*.tsx' '<label\|aria-invalid\|aria-describedby\|aria-live\|role="alert"\|autoComplete=' app components` | Autenticação usa `htmlFor` em boa parte dos campos; checkout contém labels visuais sem `htmlFor`/`id` e não usa `aria-invalid`/`aria-describedby`. |
| `rg -n 'prefers-reduced-motion\|scroll-behavior\|animation:' app/globals.css components` | Há scroll suave e diversas animações; nenhuma política `prefers-reduced-motion`. |
| `rg -n --glob '*.{test,spec}.{ts,tsx,js,jsx}' -i 'canonical\|sitemap\|robots\|metadata\|json-ld\|axe\|accessib\|keyboard\|focus\|lighthouse' .` | Nenhum teste específico de SEO ou acessibilidade encontrado. |
| `npx.cmd --offline modern-web-guidance@latest search "audit ecommerce SEO accessibility metadata canonical robots sitemap structured data forms focus contrast hydration security headers"` e `npx.cmd --offline modern-web-guidance@latest retrieve "accessibility,forms"` | Guias locais de acessibilidade e formulários recuperados do cache; nenhuma rede foi necessária. |
| `Test-Path node_modules`, `Test-Path .next` | Ambos `False`. |
| `Get-Command chrome, msedge, chrome.exe, msedge.exe` | Nenhum browser CLI disponível no `PATH`. |
| `npm.cmd run build` | Falhou antes do build: `'prisma' não é reconhecido...`. |
| `npm.cmd run lint` | Falhou antes do lint: `'eslint' não é reconhecido...`. |

Os comandos de busca foram usados como inventário e seus resultados foram confirmados nos fluxos e componentes citados; ausência em busca textual, isoladamente, não foi tratada como prova universal de conformidade ou vulnerabilidade.

## Mapa web observado

### Rotas e indexabilidade pretendida inferida

| Rota | Papel observado | Metadata específica | Indexabilidade recomendada |
|---|---|---|---|
| `/` | home, catálogo, busca, filtros, produto em estado client-side | metadata global do tenant | indexável |
| `/checkout` | checkout client-side | não | `noindex, nofollow` |
| `/checkout/confirmation` | confirmação baseada em `sessionStorage` | não | `noindex, nofollow` |
| `/login`, `/register`, `/forgot-password`, `/reset-password` | autenticação | title/description | `noindex, follow` ou política equivalente |
| `/profile`, `/profile/fidelidade` | área autenticada | title/description | `noindex, nofollow` |
| `/admin/**` | painel autenticado | parcial/dinâmica | `noindex, nofollow` |

Não há rota `/produto/[slug]`, `/categoria/[slug]`, `/marca/[slug]` ou equivalente. Busca, marca, tags, preço e página vivem apenas no estado do hook do catálogo.

### Fluxo público relevante

```text
GET /
  -> metadata do tenant e consulta server-side de todos os produtos
  -> HomeClient
     -> filtros/paginação em memória
     -> clique em <div> altera selectedProduct
     -> detalhe continua na URL /
     -> carrinho em drawer Radix
     -> /checkout
        -> campos e seletores customizados
        -> /checkout/confirmation (estado em sessionStorage)
```

### Controles positivos observados

- `<html lang="pt-BR">` está declarado em `app/layout.tsx:36`.
- O logo é linkado à home, tem `aria-label` e `alt` descritivo em `components/brand/ContinentalLogo.tsx:31-45`.
- Imagens principais de produto e QR Code têm `alt` em `components/home/HomeClient.tsx:206-210, 423-427` e `app/checkout/confirmation/page.tsx:336`.
- Paginação usa `aria-current="page"` e nomes acessíveis nos botões em `components/catalog/CatalogPagination.tsx:86-105, 135-147, 154-173`.
- O carrinho usa o primitive Dialog/Sheet do Radix, que oferece uma base de gerenciamento de foco (`components/cart/CartDrawer.tsx:37-93` e `components/ui/sheet.tsx`).
- `Alert` aplica `role="alert"` em `components/ui/alert.tsx:22-31`, de modo que o banner de erro reutilizado pode ser anunciado.
- A configuração declara CSP, proteção contra framing, `nosniff`, referrer policy, permissions policy e HSTS em `next.config.js:37-80`; a entrega efetiva não foi verificada.

## Findings

### WEB-001 — Catálogo e detalhes de produto não possuem URLs rastreáveis

- **Categoria:** SEO / arquitetura web
- **Severidade:** HIGH
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `app/page.tsx:8-53`; `components/home/HomeClient.tsx:50-55, 177-180, 374-420`; inventário de `app/**/page.tsx`
- **Fluxo e condição de manifestação:** visitante, crawler ou usuário de tecnologia assistiva acessa a home, aplica filtros/paginação ou abre um produto.
- **Fato observado:** a única rota pública de catálogo é `/`. O card executa `setSelectedProduct(prod)` e o componente retorna uma tela detalhada sem alterar URL, history ou metadata. Filtros e paginação também são estado local.
- **Hipótese delimitada:** crawlers que não executem toda a interação client-side não alcançarão uma entidade de produto; mesmo os que executem não recebem uma URL estável, canonical ou metadata específica. Compartilhar, recarregar ou usar Voltar não preserva o produto/filtro.
- **Evidência observada:** não há página dinâmica pública de produto/categoria e não há links de produto no inventário de `href`; o gatilho é um `<div onClick>`.
- **Impacto:** produtos e categorias não formam páginas indexáveis; perda de long-tail, rich results, compartilhamento, deep links, histórico de navegação e analytics por produto.
- **Correção proposta:** criar rotas server-rendered por slug estável para produto e, conforme taxonomia real, categoria/marca; tornar cards links; representar busca, filtros e paginação relevantes em query string; emitir metadata e canonical por rota. Definir política de slugs e redirects antes de mudar URLs.
- **Teste de regressão:** integração/E2E deve abrir um card, validar mudança de URL e título, recarregar diretamente a URL, testar Voltar/Avançar e confirmar conteúdo server-rendered no HTML sem executar JavaScript.
- **Risco residual:** facetas combinatórias podem gerar crawl traps; somente combinações elegíveis devem ser indexáveis e o restante precisa de canonical/noindex coerente.

### WEB-002 — Ausência de sitemap, robots e canonical em aplicação orientada por host

- **Categoria:** SEO técnico
- **Severidade:** HIGH
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `app/layout.tsx:10-20`; `lib/tenant.ts:25-56, 75-108` (normalização/resolução por host e cache); ausência confirmada de `app/robots.ts`, `app/sitemap.ts`, `public/robots.txt`, `public/sitemap.xml`
- **Fluxo e condição de manifestação:** crawler descobre qualquer hostname/tenant servido pela aplicação.
- **Fato observado:** a metadata global contém somente title, description e icons. Não há `metadataBase`, `alternates.canonical`, robots nem sitemap no repositório.
- **Hipótese delimitada:** se um mesmo tenant responder em mais de um host/proxy, parâmetros ou aliases, mecanismos de busca podem escolher uma URL canônica diferente da desejada. A topologia real de domínios não foi verificada.
- **Evidência observada:** busca direcionada e `Test-Path` não encontraram implementações; o layout consulta a loja a partir dos headers.
- **Impacto:** descoberta incompleta, consolidação inconsistente de sinais e risco de conteúdo duplicado entre hosts/variantes de URL.
- **Correção proposta:** definir origem pública confiável por tenant, gerar `metadataBase` e canonical absoluto a partir de configuração validada, publicar `robots` e sitemap por tenant contendo somente URLs canônicas/indexáveis. Não derivar canonical cegamente de `Host` não confiável.
- **Teste de regressão:** em fixtures de dois tenants, requisitar metadata, `/robots.txt` e `/sitemap.xml`; validar host correto, XML válido, URLs 200 e ausência de rotas privadas/parametrizações não indexáveis.
- **Risco residual:** configuração incorreta de domínio na infraestrutura ainda pode produzir canonical/sitemap incorretos; exige verificação pós-deploy.

### WEB-003 — Metadata social e dados estruturados de comércio ausentes

- **Categoria:** SEO / compartilhamento
- **Severidade:** MEDIUM
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `app/layout.tsx:10-20`; ausência de `openGraph`, `twitter`, `application/ld+json`, `schema.org`, `opengraph-image` e `twitter-image`
- **Fluxo e condição de manifestação:** produto/home é compartilhado ou processado por mecanismo de busca compatível com dados estruturados.
- **Fato observado:** não há OpenGraph, Twitter Cards ou JSON-LD. A descrição fallback — “Construindo interfaces reais com movimento.” — não descreve o negócio ou intenção de compra.
- **Hipótese delimitada:** snippets e previews tendem a ser genéricos e não há elegibilidade fornecida pela aplicação para rich results de `Product`. Rich result nunca é garantido, mesmo após correção.
- **Evidência observada:** metadata global limitada a três propriedades e nenhuma ocorrência dos formatos procurados.
- **Impacto:** previews sociais pobres, menor clareza do snippet e perda de sinais estruturados de produto, oferta, disponibilidade, organização e breadcrumbs.
- **Correção proposta:** gerar OpenGraph/Twitter por home/produto com URL e imagem absolutas; adicionar JSON-LD server-side coerente com conteúdo visível e fonte de verdade de preço/estoque; usar `Organization`, `Product`/`Offer` e `BreadcrumbList` apenas onde aplicável.
- **Teste de regressão:** parsear HTML de fixtures e validar JSON-LD, URLs absolutas, escaping, preço/moeda/estoque e correspondência com a página; validar previews em ambiente de teste autorizado.
- **Risco residual:** dados desatualizados ou divergentes podem ser piores que ausência; cache e invalidação precisam acompanhar mudanças de produto.

### WEB-004 — Rotas transacionais, autenticadas e administrativas não declaram `noindex`

- **Categoria:** SEO / privacidade de indexação
- **Severidade:** MEDIUM
- **Confiança:** HIGH CONFIDENCE
- **Arquivo e linhas:** `app/login/page.tsx:3-6`; `app/register/page.tsx:3-6`; `app/forgot-password/page.tsx:3-6`; `app/reset-password/page.tsx:5-8`; `app/profile/page.tsx:11-14`; `app/profile/fidelidade/page.tsx:8-11`; `app/admin/layout.tsx:7-27`; `app/checkout/page.tsx:1-12`; `app/checkout/confirmation/page.tsx:1-52`
- **Fluxo e condição de manifestação:** crawler solicita login, reset, checkout, confirmação, perfil ou admin.
- **Fato observado:** páginas com metadata específica não incluem diretiva robots; checkout e confirmação herdam a metadata genérica do layout. Não há robots global com regras para esses caminhos.
- **Hipótese delimitada:** autenticação/redirect pode impedir conteúdo privado de aparecer, mas URLs e telas genéricas ainda podem entrar no índice. O header HTTP real e o comportamento do crawler não foram verificados.
- **Evidência observada:** objetos de metadata citados têm title/description, sem `robots`; rotas client-side não exportam metadata.
- **Impacto:** poluição do índice, snippets irrelevantes e exposição do formato de rotas internas, ainda que não de dados autenticados.
- **Correção proposta:** aplicar metadata de segmento/layout com `robots: { index: false, follow: ... }` conforme política; preferir também `X-Robots-Tag` para respostas não HTML quando necessário. Não usar `robots.txt` como controle de acesso.
- **Teste de regressão:** requisitar cada rota anônima/autenticada e verificar meta/header de robots e ausência de dados privados no HTML/redirect.
- **Risco residual:** URLs já indexadas precisam de recrawl/remoção; bloquear o crawl antes de o crawler observar `noindex` pode atrasar a remoção.

### WEB-005 — Card de produto é clicável apenas por ponteiro

- **Categoria:** acessibilidade / teclado / funcional
- **Severidade:** HIGH
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `components/home/HomeClient.tsx:414-452`
- **Fluxo e condição de manifestação:** usuário navega o catálogo somente por teclado ou por dispositivo que emula ativação sem clique de ponteiro.
- **Fato observado:** o card é um `<div onClick>` sem `tabIndex`, role, handler de teclado ou link. O único controle focável interno adiciona ao carrinho; não abre o detalhe.
- **Hipótese delimitada:** leitor de tela anuncia conteúdo estático, não uma navegação para detalhes. Isso deve ser confirmado na árvore de acessibilidade, mas a ausência de foco/semântica é determinística no HTML.
- **Evidência observada:** linhas 416-420 implementam a interação exclusivamente no `onClick` do `div`.
- **Impacto:** usuários de teclado não conseguem acessar descrição, galeria, variantes ou cálculo de frete antes de comprar; o fluxo principal fica incompleto.
- **Correção proposta:** transformar nome/imagem/card em `<Link>` para a rota real do produto; evitar card inteiro como botão quando há botão “adicionar” aninhado. Garantir indicador de foco e nome contextual no CTA.
- **Teste de regressão:** E2E com teclado deve tabular até o link de produto, ativá-lo com Enter, validar foco/título da página e continuar até adicionar variante/carrinho.
- **Risco residual:** tornar o container inteiro interativo sem resolver controles aninhados pode criar HTML inválido e conflitos de foco.

### WEB-006 — Campos do checkout não têm associação programática completa

- **Categoria:** acessibilidade / formulários / conversão
- **Severidade:** HIGH
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `components/checkout/CheckoutForm.tsx:495-584, 647-804, 921-982`
- **Fluxo e condição de manifestação:** usuário preenche identificação, endereço ou cartão com leitor de tela, software de voz ou autofill.
- **Fato observado:** labels visuais não usam `htmlFor` e os inputs/select não têm `id` correspondente. Campos de cartão nem sequer têm `name`. Não há `autoComplete`, `inputMode`, `aria-invalid` ou `aria-describedby` para ajuda/erro. O erro é global e não move foco ao campo inválido.
- **Hipótese delimitada:** heurísticas do browser podem inferir alguns campos por `name`/placeholder, mas isso não garante nome acessível, autofill correto nem relação do erro com o controle.
- **Evidência observada:** por exemplo, “Nome Completo” em 520-530, CEP em 649-666 e cartão em 921-965 mostram labels e campos sem vínculo; validação apenas chama `setError` em 301-373.
- **Impacto:** contexto e erro podem não ser anunciados no campo correto; autofill e teclados móveis ficam degradados; aumenta abandono e risco de entrada incorreta em pagamento/endereço.
- **Correção proposta:** atribuir IDs únicos e `htmlFor`; usar `name`, `autoComplete` padronizado (`name`, `email`, `tel`, `postal-code`, `address-line1`, `cc-number`, `cc-name`, `cc-exp`, `cc-csc`), `inputMode` adequado, grupos `fieldset/legend`, `aria-invalid` e `aria-describedby`. Ao falhar, focar o primeiro campo inválido e manter resumo de erros anunciado.
- **Teste de regressão:** testes de componente verificam accessible name/description e estado inválido; E2E percorre checkout por teclado e usa snapshot da árvore de acessibilidade para cada etapa.
- **Risco residual:** widgets de pagamento ou autofill variam entre browsers e precisam de validação manual em Safari/iOS, Chrome/Android e desktop.

### WEB-007 — Seletores de frete e estado de opções não são acessíveis

- **Categoria:** acessibilidade / teclado / estado
- **Severidade:** HIGH
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `components/checkout/CheckoutForm.tsx:605-641, 669-727, 837-888`
- **Fluxo e condição de manifestação:** usuário precisa escolher entrega, modalidade de frete ou método de pagamento sem ponteiro/sem percepção visual do destaque.
- **Fato observado:** modalidades e pagamentos são botões, mas não expõem `aria-pressed`, `role=radio`/`aria-checked` ou agrupamento. As opções calculadas de frete são `<div onClick>` sem foco ou teclado. Seleção é indicada sobretudo por borda/cor e um círculo visual.
- **Hipótese delimitada:** a primeira modalidade de frete pode ser pré-selecionada, mas qualquer escolha alternativa permanece inacessível por teclado.
- **Evidência observada:** o `div` de frete nas linhas 682-690 recebe apenas `onClick`; botões de entrega/pagamento mudam estado sem atributo acessível correspondente.
- **Impacto:** usuário pode não conseguir selecionar prazo/preço desejado ou compreender qual opção está ativa, bloqueando ou alterando a compra.
- **Correção proposta:** usar `fieldset`/`legend` e radios nativos, ou implementar padrão ARIA radio completo com roving tabindex e setas; expor estado selecionado e texto de preço/prazo no nome/descrição acessível.
- **Teste de regressão:** navegar e alterar cada grupo com Tab, setas, Espaço e leitor de tela; validar `checked` anunciado e valor final atualizado.
- **Risco residual:** componentes customizados exigem testes cross-browser; radio nativo reduz o risco.

### WEB-008 — Menus e drawers customizados não gerenciam foco; menu mobile fechado permanece tabulável

- **Categoria:** acessibilidade / foco / navegação mobile
- **Severidade:** HIGH
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `components/MobileMenu.tsx:13-103`; `components/catalog/BrandBottomSheet.tsx:21-50, 81-100`; `components/catalog/CatalogFreeSidebar.tsx:318-362`
- **Fluxo e condição de manifestação:** viewport mobile; usuário abre/fecha menu, seletor de marca ou drawer de filtros e navega por teclado/leitor de tela.
- **Fato observado:** `MobileMenu` sempre renderiza o painel e seus links; fechado, apenas aplica `translate-x-full`, sem `hidden`, `inert` ou remoção da árvore, portanto os controles continuam no fluxo de tabulação. Não há Escape, foco inicial, trap ou restauração. Os dialogs customizados de marca/filtros são condicionais e têm alguns atributos, mas também não movem/contêm/restauram foco; o drawer de filtros não tem nome acessível nem fechamento por Escape.
- **Hipótese delimitada:** CSS pode ocultar visualmente o conteúdo, mas não o remove da árvore de acessibilidade. Comportamento exato de anúncio deve ser confirmado no browser.
- **Evidência observada:** estado altera somente classes em `MobileMenu.tsx:31-43`; os links permanecem em 54-101. `BrandBottomSheet` trata Escape, mas não foco. Drawer de filtros define apenas `role="dialog"` e `aria-modal`.
- **Impacto:** foco pode desaparecer em conteúdo fora da tela, escapar atrás do modal ou não retornar ao gatilho; navegação mobile fica confusa ou bloqueada.
- **Correção proposta:** reutilizar primitive Radix Dialog/Sheet já presente no projeto, ou implementar foco inicial, trap, Escape, restauração, `aria-labelledby` e inertização do fundo. Quando fechado, desmontar ou aplicar `hidden`/`inert` corretamente.
- **Teste de regressão:** E2E abre cada overlay, verifica foco inicial, ciclo Tab/Shift+Tab, Escape, restauração ao gatilho e ausência de elementos fechados na ordem de tabulação.
- **Risco residual:** portais e múltiplos overlays podem conflitar; testar menu + carrinho + filtros em sequência.

### WEB-009 — Landmarks, skip link e hierarquia de headings são inconsistentes

- **Categoria:** acessibilidade / semântica
- **Severidade:** MEDIUM
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `app/layout.tsx:35-46`; `components/home/HomeClient.tsx:376-507`; `components/home/HomeClient.tsx:430-476`; `app/profile/page.tsx:26-58`; `app/checkout/confirmation/page.tsx:52-253`
- **Fluxo e condição de manifestação:** usuário de leitor de tela ou teclado percorre home, perfil ou confirmação.
- **Fato observado:** não há skip link global. A home e sua visualização de produto não possuem `<main>`. Perfil e confirmação também usam containers genéricos. No catálogo, nomes de produtos e vazio usam `h4` sem heading explícito intermediário que nomeie a grade; a confirmação possui múltiplos `h1` condicionais no mesmo componente.
- **Hipótese delimitada:** somente um dos `h1` condicionais da confirmação deve ser renderizado por vez, então não se afirma múltiplos `h1` simultâneos; ainda assim, landmarks e ordem estrutural permanecem inconsistentes.
- **Evidência observada:** RootLayout injeta header e children sem destino de salto; HomeClient retorna `div`, `section` e footer.
- **Impacto:** navegação por landmarks/headings fica mais lenta, repetitiva e menos previsível.
- **Correção proposta:** fornecer skip link focável para `#main-content`; garantir exatamente um `<main>` por página/estado; nomear seção/grade de catálogo com `h2`; usar headings sequenciais para cards e painéis.
- **Teste de regressão:** snapshot semântico/axe, navegação por landmarks e headings em leitor de tela, e teste que confirma o skip link como primeiro controle focável.
- **Risco residual:** componentes reutilizados podem introduzir níveis incorretos em contextos distintos; preferir heading configurável ou estrutura definida pela página.

### WEB-010 — Movimento automático não respeita preferência de redução

- **Categoria:** acessibilidade / movimento
- **Severidade:** MEDIUM
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `components/home/HeroVideo.tsx:16-68, 71-117, 127-139`; `components/home/HomeClient.tsx:87-95`; `app/globals.css:12-47, 92-159, 182-263`
- **Fluxo e condição de manifestação:** usuário com `prefers-reduced-motion: reduce` visita a home ou interage com catálogo/CTA/WhatsApp.
- **Fato observado:** o hero usa vídeo `autoPlay`, timeline GSAP e conteúdo inicialmente invisível; paginação/CTA fazem scroll suave; CSS contém animações de entrada, shimmer, rotação e pulso infinito. Não existe media query ou ramificação JavaScript para redução de movimento.
- **Hipótese delimitada:** duração exata do vídeo e impacto clínico não foram medidos; não se afirma violação por contraste ou flashing.
- **Evidência observada:** busca por `prefers-reduced-motion` não retorna ocorrência e as animações estão declaradas nos pontos citados.
- **Impacto:** desconforto, náusea ou perda de contexto para pessoas sensíveis; conteúdo do hero pode demorar até fallback de 3,8 s para aparecer.
- **Correção proposta:** sob `reduce`, exibir poster/conteúdo imediatamente, não autoplay, desativar GSAP/scroll suave/animações não essenciais e preservar feedback sem movimento. Oferecer pausa quando conteúdo em movimento exceder critérios aplicáveis.
- **Teste de regressão:** emulação de `prefers-reduced-motion` deve confirmar vídeo pausado, conteúdo visível no primeiro paint e animações/scroll instantâneos; repetir sem preferência para garantir experiência normal.
- **Risco residual:** animações de bibliotecas/utilitários podem escapar da folha global; inventariar classes e timers em runtime.

### WEB-011 — Alguns controles removem o indicador de foco sem substituto equivalente

- **Categoria:** acessibilidade / foco visível
- **Severidade:** MEDIUM
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `components/catalog/BrandMinimalistCarousel.tsx:43-48, 72-78, 116-120`; `app/globals.css:182-209, 325-355`; `components/ui/WhatsAppButton.tsx:52-72`
- **Fluxo e condição de manifestação:** usuário tabula pelo carrossel de marcas, links do header ou botão flutuante do WhatsApp.
- **Fato observado:** botões do carrossel usam `focus:outline-none` sem classe `focus:ring`/`focus-visible`. `.whatsapp-btn` usa `outline: none` e não define estado de foco. A linha decorativa de `.nav-trace-link` responde somente a `:hover`, não a `:focus-visible`.
- **Hipótese delimitada:** algum estilo UA ou cor/borda pode permanecer em combinações específicas, mas o código remove explicitamente o outline nos controles principais citados.
- **Evidência observada:** regras e classes acima; em contraste, `ContinentalLogo` demonstra um padrão `focus-visible:ring` disponível no projeto.
- **Impacto:** usuário de teclado perde a localização do foco, sobretudo no fundo escuro e no carrossel repetitivo.
- **Correção proposta:** manter outline nativo ou fornecer `:focus-visible` com contraste e espessura suficientes; espelhar estados hover relevantes em foco; não depender apenas de cor/transform.
- **Teste de regressão:** screenshot automatizado de cada controle focado em temas/viewports suportados e validação manual por teclado.
- **Risco residual:** contraste do anel depende das cores configuráveis do tenant; validar combinações permitidas.

### WEB-012 — CSP declarada mantém `unsafe-inline` e `unsafe-eval` para scripts

- **Categoria:** plataforma web / headers de segurança
- **Severidade:** MEDIUM
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `next.config.js:37-48`
- **Fluxo e condição de manifestação:** uma injeção de script/HTML alcança página coberta pela CSP e o browser recebe o header conforme configuração.
- **Fato observado:** `script-src` permite `'unsafe-inline'` e `'unsafe-eval'`; não há nonce/hash ou modo de relatório no repositório. Outros controles úteis estão presentes.
- **Hipótese delimitada:** não foi demonstrada injeção explorável nesta etapa e a entrega real do header não foi observada. O achado é de redução da defesa em profundidade, não prova de XSS.
- **Evidência observada:** diretiva literal em `next.config.js:40`.
- **Impacto:** caso exista uma origem de XSS, a CSP oferece proteção significativamente menor contra execução de script injetado.
- **Correção proposta:** medir dependências reais de inline/eval no build, migrar para nonce/hashes suportados pela versão do Next, remover `unsafe-eval` em produção e introduzir primeiro `Content-Security-Policy-Report-Only` com coleta controlada. Manter allowlists mínimas.
- **Teste de regressão:** build/runtime local ou staging autorizado deve verificar header efetivo, execução normal da aplicação e bloqueio de script inline de fixture sem nonce; monitorar violações antes de enforcement.
- **Risco residual:** terceiros e hydration podem exigir ajustes específicos; CSP não substitui escaping, sanitização e validação.

### WEB-013 — Experiências 404 e erro não são definidas pela aplicação

- **Categoria:** plataforma web / recuperação
- **Severidade:** LOW
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `app/page.tsx:8-12`; ausência de `app/not-found.tsx`, `app/error.tsx` e `app/global-error.tsx`
- **Fluxo e condição de manifestação:** tenant não é resolvido, rota não existe ou ocorre exceção de renderização.
- **Fato observado:** a home chama `notFound()` quando não encontra loja, mas o projeto não fornece 404 customizado nem error boundaries de rota/global.
- **Hipótese delimitada:** o Next deve apresentar suas telas padrão, mas isso não foi executado nesta versão local e não se afirma o conteúdo/status exato sem runtime.
- **Evidência observada:** chamada a `notFound` e ausência dos arquivos especiais confirmada por `Test-Path`.
- **Impacto:** recuperação sem identidade visual, navegação de retorno ou orientação de suporte; falhas de segmento podem degradar para uma experiência genérica.
- **Correção proposta:** criar 404 e boundaries acessíveis com título claro, ação de retorno/busca e sem exposição técnica; preservar status HTTP correto e logging sem PII.
- **Teste de regressão:** requisitar rota inexistente e tenant inválido, validar status 404, heading/main/foco e links; injetar erro controlado em teste e validar boundary e recuperação.
- **Risco residual:** falhas antes do runtime da aplicação (proxy/CDN) exigem páginas equivalentes na infraestrutura.

## Matriz resumida de acessibilidade

| Área | Semântica/label | Teclado/foco | Estado/feedback | Resultado |
|---|---|---|---|---|
| Header desktop | links e logout nomeados | foco parcialmente estilizado | autenticação refletida | parcial |
| Menu mobile | botão nomeado/expanded | painel fechado tabulável; sem trap/Escape | visual apenas | falha relevante |
| Hero | `h1`, CTA link | CTA nativo | vídeo/movimento sem redução | parcial |
| Catálogo | aside nomeado; imagens com alt | card não abre por teclado | filtros selecionados sobretudo visualmente | falha relevante |
| Paginação | nomes e `aria-current` | botões nativos | página ativa exposta | adequado estaticamente |
| Produto | `h1`, alt principal | galeria/variantes focáveis, estado não exposto | alert nativo para variante | parcial |
| Carrinho | Sheet Radix | base de foco robusta | loading/vazio visuais | parcial; runtime pendente |
| Checkout | labels apenas visuais | frete não operável por teclado | erro global, seleção pouco exposta | falha relevante |
| Autenticação | labels/IDs e autocomplete em login | controles nativos | erros sem vínculo por campo em partes | parcial |
| Confirmação | heading e alt do QR | botões nativos | mudanças de polling/cópia não verificadas como live | NOT VERIFIED em runtime |

## Plataforma, cache, redirects e hydration

### Observado

- `next.config.js` aplica headers declarados a `/:path*`.
- `lib/tenant.ts` usa revalidação de 300 segundos para resolução/configuração do tenant.
- Perfil declara `force-dynamic`; não foram encontrados controles explícitos de cache para HTML público ou assets além dos defaults do framework.
- `proxy.ts` implementa redirects de autenticação/autorização para `/admin`; não há mapa de redirects SEO ou aliases de slugs.
- O checkout e a confirmação são client components; confirmação lê `sessionStorage` somente em `useEffect`, evitando acesso durante SSR naquele ponto.
- Não há uso de `suppressHydrationWarning` nem correção deliberada para mismatch encontrada na busca estática.

### Não verificado

- headers HTTP efetivamente emitidos, incluindo `Cache-Control`, CSP e status 404;
- viewport gerado automaticamente pela versão instalada do Next;
- hydration warnings/erros no console;
- redirects no CDN, proxy reverso ou provedor de hospedagem;
- cache do HTML por tenant e presença correta de `Vary`/chave de host;
- comportamento offline/retry do navegador;
- Web Vitals, layout shifts e contraste computado.

## Itens não aplicáveis ou sem evidência de aplicabilidade

- **Manifest/PWA:** não há requisito declarado de instalação PWA ou funcionamento offline; a ausência de manifest não foi classificada como defeito desta auditoria.
- **Hreflang:** somente `pt-BR` foi observado e não há variantes internacionais; `hreflang` foi considerado não aplicável com a evidência atual.
- **Redirects de migração:** não há mapa de URLs antigas, troca de domínio ou legado documentado; não foi possível exigir redirects específicos. Redirects de autenticação existentes não são substitutes de redirects SEO.
- **Captions/transcript do hero:** o vídeo funciona como fundo visual, está `muted` e não foi observada fala/conteúdo informacional exclusivo; legendas não foram exigidas. Redução de movimento permanece aplicável e está em WEB-010.
- **Conteúdo HTML rico gerado por usuário:** não foi encontrado renderer de HTML/Markdown no storefront desta etapa; sanitização de rich text não foi avaliada como requisito de SEO/acessibilidade.

## Verificações pendentes

1. Instalar dependências em ambiente descartável/autorizado e executar `npm run build`, `npm run lint` e testes, sem alterar o lockfile.
2. Subir a aplicação com banco/tenant fictícios e navegar home → produto → carrinho → checkout → confirmação.
3. Executar Lighthouse e axe em mobile/desktop nas rotas públicas, auth, checkout, confirmação, perfil e 404.
4. Inspecionar árvore de acessibilidade, ordem de tabulação, foco dos overlays, anúncios de erro/status e fluxo completo somente por teclado.
5. Medir contraste de texto, placeholders, bordas, estados de foco e cores configuráveis de tenant.
6. Emular `prefers-reduced-motion`, zoom 200%/400%, largura 320 CSS px e reflow sem rolagem bidimensional.
7. Capturar console para hydration/runtime errors e verificar HTML inicial com JavaScript desabilitado.
8. Inspecionar respostas HTTP reais de HTML, assets, 404, redirects, robots e sitemap, incluindo status, `Cache-Control`, CSP e canonical.
9. Validar OpenGraph/JSON-LD em ferramentas oficiais após implementação e somente em staging/autorizado.
10. Confirmar política de domínios/tenants, domínio canônico, URLs antigas e configuração externa de CDN/proxy.

## Riscos por severidade

| Severidade | Quantidade | IDs |
|---|---:|---|
| BLOCKER | 0 | — |
| CRITICAL | 0 | — |
| HIGH | 6 | WEB-001, WEB-002, WEB-005, WEB-006, WEB-007, WEB-008 |
| MEDIUM | 6 | WEB-003, WEB-004, WEB-009, WEB-010, WEB-011, WEB-012 |
| LOW | 1 | WEB-013 |
| INFORMATIONAL | 0 | — |

## Publication Blockers

Não há achado classificado literalmente como **BLOCKER** ou **CRITICAL**. Ainda assim, para publicação de um e-commerce público com expectativa de SEO e acesso por teclado, recomenda-se tratar como **gate de release**:

- **WEB-001 e WEB-002:** sem URLs de produto e controles básicos de descoberta/canonical, o catálogo não possui arquitetura SEO publicável de forma consistente;
- **WEB-005:** produto não é acessível pelo teclado a partir da vitrine;
- **WEB-006 e WEB-007:** identificação/endereço/pagamento e escolha de frete não têm semântica/teclado suficientes para um checkout inclusivo;
- **WEB-008:** navegação mobile pode deslocar o foco para conteúdo invisível ou atrás de overlays.

A liberação desses gates deve exigir teste em navegador, não apenas revisão estática.

## Dívida priorizada

1. **P0 — Navegação e compra:** corrigir WEB-005 a WEB-008 e cobrir por testes de teclado/árvore acessível.
2. **P0 — Endereçamento público:** implementar rotas de produto/categoria, canonical, robots e sitemap (WEB-001/002).
3. **P1 — Metadata:** noindex de rotas utilitárias, metadata social e JSON-LD coerente (WEB-003/004).
4. **P1 — Estrutura e conforto:** landmarks, skip link, foco visível e reduced motion (WEB-009/010/011).
5. **P2 — Hardening/recuperação:** endurecer CSP progressivamente e criar 404/error boundaries (WEB-012/013).

## Riscos residuais

- A análise estática não comprova conformidade WCAG, indexabilidade real nem ausência de erros de navegador.
- Conteúdo, cores e domínios são dependentes do tenant; fixtures inspecionáveis não estavam disponíveis em execução.
- Defaults e geração de metadata podem variar nesta versão de Next; sem `node_modules`, a documentação local exigida pelo repositório e o build não estavam disponíveis para validação.
- CDN/proxy podem adicionar, remover ou sobrescrever cache, redirects e headers.
- Search engines decidem rastreamento e rich results; correções técnicas melhoram elegibilidade, não garantem posição ou exibição.
- Outros fluxos administrativos possuem labels visuais sem associação em busca estática, mas foram deixados fora dos findings detalhados para manter esta etapa concentrada nas páginas web reais e no caminho público de compra; devem entrar em validação a11y abrangente.

## Conclusão

Dentro do escopo e das limitações registradas, a plataforma possui uma base funcional e alguns controles semânticos/defensivos úteis, mas **não está pronta para ser considerada publicável sob critérios de SEO técnico e acessibilidade do fluxo principal**. O impedimento central não é estético: entidades comerciais não têm URLs rastreáveis e usuários de teclado encontram barreiras determinísticas no catálogo, nos overlays e no checkout.

Esta conclusão é limitada ao repositório no commit indicado. Ela não declara conformidade universal, não valida infraestrutura externa e não substitui testes em browser com tenant e dados fictícios.


---

## Revalidação de 2026-09-29 — etapa 14/15

O conteúdo anterior é histórico e foi preservado. Esta seção avalia o código local atual, incluindo mudanças sem commit, após as correções registradas em docs/remediation. Base: HEAD 0c7ef7ddfa5fb4520c4bc794163cbc71257c2bc4. O responsável autorizou continuar as etapas sem pausas. Somente relatórios são alterados.

### Resultado

Corrigido: **12**; Parcialmente corrigido: **1**. Pendências confirmadas/parciais por risco residual: MEDIUM 1. Itens não verificados ficam separados de defeitos confirmados.

Corrigido refere-se ao defeito original no recorte verificado; não certifica toda a funcionalidade ou serviços externos. Confiança CONFIRMED identifica código observado e/ou teste executado, conforme a evidência; não transforma inspeção em teste dinâmico. Severidade original é preservada, e risco residual não deve ser somado entre relatórios sem deduplicação.

### Matriz dos achados

| ID | Severidade original | Estado | Risco residual | Confiança | Evidência atual, fluxo e impacto | Encerramento / regressão / limite |
|---|---|---|---|---|---|---|
| WEB-001 | HIGH | Corrigido | LOW | CONFIRMED | `app/produto/[id]/page.tsx:12-31,66-70` carrega produto SSR por tenant e notFound; HomeClient usa Link; filtros/página em query string. | Deep link implementado; categorias por slug e política de redirects não implementadas. Rastreio externo não verificado. |
| WEB-002 | HIGH | Corrigido | LOW | CONFIRMED | `app/layout.tsx:21`, `app/robots.ts:7-24`, `app/sitemap.ts:8-27` usam origem canônica do tenant e bloqueiam/retornam vazio sem origem confiável; testes SEO passaram. | Conferir host/TLS/XML por tenant publicado; configuração presente não comprova DNS/indexação. |
| WEB-003 | MEDIUM | Corrigido | LOW | CONFIRMED | `app/produto/[id]/page.tsx:39-62,93-116`; `lib/web-seo.ts:1` fornece metadata social e serialização JSON-LD; home inclui OnlineStore. | Templates e escaping testados; rich results/previews não garantidos nem testados externamente. |
| WEB-004 | MEDIUM | Corrigido | LOW | CONFIRMED | Layouts/páginas privados declaram robots noindex; `next.config.js:46` envia X-Robots-Tag para APIs; contratos SEO passaram. | Header efetivo de proxy e eventual desindexação dependem de ambiente publicado. |
| WEB-005 | HIGH | Corrigido | LOW | CONFIRMED | `components/home/HomeClient.tsx:414` e card atual usam links de produto e botão de carrinho separados; contrato acessível passou. | Teclado e leitor de tela no DOM real pendentes; sem alegação de conformidade completa. |
| WEB-006 | HIGH | Corrigido | LOW | CONFIRMED | `components/checkout/CheckoutForm.tsx:322,563-631,717-884` associa labels/IDs, aria-invalid/describedby e foco no primeiro erro. | Markup/estado corrigidos; testar anúncio de erros e autofill com navegador assistivo e dados fictícios. |
| WEB-007 | HIGH | Corrigido | LOW | CONFIRMED | `components/checkout/CheckoutForm.tsx:668-710,758-824` usa fieldsets, legends e radios nativos; teste de contrato passou. | Verificar sequência de tabulação/setas e anúncio de opção/preço/seleção em leitor de tela. |
| WEB-008 | HIGH | Corrigido | LOW | CONFIRMED | `components/MobileMenu.tsx:24-45`, `BrandBottomSheet.tsx:28-39`, `CatalogFreeSidebar.tsx:270-345` usam Sheet/Radix controlado com títulos. | Mecanismo de foco implementado; trap, Escape e retorno de foco não medidos nesta rodada. |
| WEB-009 | MEDIUM | Corrigido | LOW | CONFIRMED | `app/layout.tsx:70-77` adiciona skip link/destino focável; páginas têm main/headings; testes de contrato passaram. | Ramos mutuamente exclusivos da confirmação não significam múltiplos h1 simultâneos; validar árvore semântica real. |
| WEB-010 | MEDIUM | Corrigido | LOW | CONFIRMED | `components/home/HeroVideo.tsx:13` observa reduced motion; `app/globals.css:389` limita animações; conteúdo visível independe de autoplay. | Capturas antigas não são prova atual; medir dispositivos reais e preferência alternada em browser. |
| WEB-011 | MEDIUM | Corrigido | LOW | CONFIRMED | `BrandMinimalistCarousel.tsx:50,80,123`; `app/globals.css:271,384` têm focus-visible nos pontos originais. | Contraste computado, zoom e cores configuradas por loja permanecem não verificados. |
| WEB-012 | MEDIUM | Parcialmente corrigido | MEDIUM | CONFIRMED | `lib/csp.js:2-8` mantém unsafe-inline em script/style; unsafe-eval somente fora de produção; object/frame/base/form endurecidos. | Implementar nonce/hash com validação de scripts Next e report-only no ambiente de teste; não se demonstrou XSS explorável. |
| WEB-013 | LOW | Corrigido | LOW | CONFIRMED | `app/not-found.tsx:1`, `app/error.tsx:1`, `app/global-error.tsx:1`, `app/profile/error.tsx:1` oferecem 404/erro/recuperação. | UI definida; injeção de erro e retry no browser e falhas de plataforma não executados. |

### Método e contraste com registros anteriores
Revisados roteiro 14, `docs/remediation/WEB-FIXES.md:13-31`, rotas, metadata, CSS, markup, contratos e CSP atuais. Testes `web-seo` e `web-accessibility-contracts` integram os 613 unitários aprovados. Inspeção de código não equivale a inspeção da árvore de acessibilidade; nenhum screenshot histórico foi reapresentado como captura nova.

### Verificações pendentes
- Browser isolado nos tamanhos 375/768/1366/1920, teclado, leitor de tela, zoom, contraste, foco dos overlays e validação do checkout; fakes locais e banco descartável.
- Header efetivo, status 404, redirects, canonical/sitemap/robots e JSON-LD no servidor isolado e depois por domínio publicado autorizado.
- Erros de hidratação, console, cache real, CWV/Lighthouse e rede de imagens/vídeo: não medidos nesta rodada.
- Otimização de imagens e indexação de catálogo grande permanecem relacionadas à etapa 08; sitemap atual lista todos os produtos e precisa de medição se crescer.

Não há pontuação WCAG, Lighthouse ou SEO inventada. Domínio não publicado é contexto; crawler, rich results e TLS constituem provas futuras. A ausência de teste assistivo não foi classificada como falha confirmada dos mecanismos corrigidos.
