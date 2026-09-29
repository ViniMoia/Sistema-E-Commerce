# Etapa 09 — SEO, acessibilidade e plataforma web

**Data:** 2026-09-27  
**Fontes:** `docs/audits/FINAL-AUDIT.md`, `WEB-QUALITY-AUDIT.md`, `FRONTEND-UX-AUDIT.md`, `docs/remediation/PLAN.md`, código e testes atuais  
**Escopo executado:** `WEB-001` a `WEB-013` e duplicatas diretamente correlatas; sem produção, indexadores, contas reais, cloud ou serviços externos  
**Estado de publicação:** `BLOCKED` pelo risco financeiro já registrado em `ADM-001`; a etapa web não remove esse bloqueio  
**Risco residual web:** `MEDIUM` até validação assistiva, domínio publicado, crawlers e CSP sem `unsafe-inline`

## Resultado por ID

Os vereditos abaixo comparam o relatório ao estado atual. Comportamentos dependentes de browser, domínio ou infraestrutura permanecem `NOT VERIFIED`; nenhum deles foi promovido a defeito confirmado.

| ID | Severidade / confiança originais | Veredito atual | Evidência e correção | Residual / pendência |
|---|---|---|---|---|
| `WEB-001` | HIGH / CONFIRMED | `VALID` → `FIXED`; filtros `ALREADY RESOLVED` | Criada rota SSR `/produto/[id]`, tenant-scoped, com deep link, recarga e navegação por `Link`. O hook atual já sincronizava filtros/página com query string. | **MEDIUM**: a rota usa UUID estável; política de slug e redirects depende de Produto/SEO. |
| `WEB-002` | HIGH / CONFIRMED | `VALID` → `FIXED` no código; deploy `NOT VERIFIED` | Canonical, `metadataBase`, `robots.txt` e sitemap são gerados por origem canônica validada do tenant e falham fechados sem origem confiável. | **MEDIUM** até conferir DNS/proxy, host publicado e XML em cada tenant autorizado. |
| `WEB-003` | MEDIUM / CONFIRMED | `VALID` → `FIXED` no código | Home recebeu OpenGraph/Twitter e `OnlineStore`; produto recebeu metadata social e `Product`/`Offer` JSON-LD coerente com preço, moeda e estoque. Serialização neutraliza `<`. | **LOW/MEDIUM**: previews e rich results são `NOT VERIFIED` e nunca garantidos. |
| `WEB-004` | MEDIUM / HIGH CONFIDENCE | `VALID` → `FIXED` localmente | Auth, checkout, confirmação, perfil e admin declaram `noindex`; APIs recebem `X-Robots-Tag: noindex, nofollow`. | **LOW**: remoção de URLs já indexadas e recrawl dependem dos mecanismos de busca. |
| `WEB-005` | HIGH / CONFIRMED | `VALID` → `FIXED` | Imagem/título do card são links reais para o produto; o CTA de carrinho permanece controle separado e possui nome contextual. | **LOW**; percurso completo só por teclado/leitor de tela ainda requer navegador assistivo autorizado. |
| `WEB-006` | HIGH / CONFIRMED | `VALID` → `FIXED` no markup/estado | Checkout recebeu `id`/`htmlFor`, `name`, autocomplete, `inputMode`, `aria-invalid`, `aria-describedby`, resumo vivo e foco no primeiro campo inválido. | **MEDIUM** até teste assistivo completo do checkout com carrinho e sessão fictícios. |
| `WEB-007` | HIGH / CONFIRMED | `VALID` → `FIXED` | Entrega, frete e pagamento agora usam `fieldset`/`legend` e radios nativos com estado selecionado acessível. | **LOW/MEDIUM**; anúncio exato por leitor de tela é `NOT VERIFIED`. |
| `WEB-008` | HIGH / CONFIRMED | `VALID` → `FIXED` no código | Menu móvel, marcas e filtros usam `Sheet` controlado do Radix, removendo controles fechados da tabulação e adotando foco/Escape/restauração do primitive. | **MEDIUM**: trap, ordem e retorno de foco não foram medidos na árvore de acessibilidade. |
| `WEB-009` | MEDIUM / CONFIRMED | `VALID` → `FIXED`; subalegação `INVALID` | Adicionados skip link, destino focável, landmarks `main` e headings. Na confirmação, os `h1` são ramos mutuamente exclusivos; não havia múltiplos `h1` simultâneos no DOM. | **LOW**; landmarks/ordem ainda precisam de inspeção assistiva abrangente. |
| `WEB-010` | MEDIUM / CONFIRMED | `VALID` → `FIXED` | CSS respeita redução de movimento; hero não faz autoplay/animação sob preferência reduzida, usa preload de metadata e o conteúdo não depende mais do vídeo/GSAP para ficar visível. | **LOW**; dispositivos reais e consumo de dados não foram medidos. |
| `WEB-011` | MEDIUM / CONFIRMED | `VALID` → `FIXED` nos pontos citados | Carrossel, navegação, botão flutuante e links receberam indicadores `focus-visible` equivalentes. | **MEDIUM**: contraste computado e cores configuráveis por tenant são `NOT VERIFIED`. |
| `WEB-012` | MEDIUM / CONFIRMED | `VALID` → `FIXED parcial` / `DEFERRED` | CSP de produção remove `unsafe-eval`, adiciona `object-src 'none'`, `frame-ancestors`, `base-uri` e `form-action`; header efetivo foi inspecionado localmente. | **MEDIUM**: `unsafe-inline` permanece até rollout de nonce/hash e telemetria report-only em staging. |
| `WEB-013` | LOW / CONFIRMED | `VALID` → `FIXED` localmente | Adicionados `not-found`, boundary de rota e `global-error`; rota desconhecida respondeu 404 com UI própria e `noindex`. | **LOW**: falha injetada, retry do boundary e erros de CDN/plataforma são `NOT VERIFIED`. |

Duplicatas preservadas: `FINAL-023` (`WEB-005/006/007`, `FUX-004`), `FINAL-024` (`WEB-008`, `FUX-005`), `FINAL-025` (`WEB-001/002`, `FUX-006`), `FINAL-030` (`WEB-010`, `FUX-011`), `FINAL-031` (`WEB-009/011`, `FUX-012`) e `FINAL-032` (`WEB-003/004/012/013`). A etapa 08 não foi executada; somente as causas web sobrepostas foram revalidadas aqui.

## Correções por causa raiz

### 1. Entidades públicas sem endereço canônico (`WEB-001` a `WEB-005`)

**Antes:** o detalhe era estado React em `/`; cards não eram links; não havia canonical, sitemap, robots, OpenGraph/Twitter ou dados estruturados.  
**Depois:** `/produto/[id]` é renderizada no servidor e isolada por tenant; home/produto publicam metadata canônica e JSON-LD; o sitemap inclui apenas home e produtos do tenant; sem domínio canônico confiável, robots bloqueia rastreamento e o sitemap fica vazio.

Provas locais:

- `/` e `/produto/web09-product` responderam 200 com `Host: shop.local.test`;
- ambos emitiram canonical HTTPS e JSON-LD no HTML inicial;
- `robots.txt` e `sitemap.xml` responderam 200 com somente URLs públicas canônicas;
- autenticação/checkout emitiram `noindex`; `/api/brands` emitiu `X-Robots-Tag`;
- ID com caracteres reservados é codificado e origem não HTTP(S) é rejeitada nos unitários.

Categoria/marca por slug não foi criada: faltam política de taxonomia e ciclo de redirects, já pendentes em `ADM-012`. Criar URLs sem essa decisão poderia produzir URLs instáveis e conteúdo duplicado.

### 2. Semântica e erro do checkout (`WEB-006`, `WEB-007`)

**Antes:** labels visuais não se ligavam aos campos, cartão não tinha nomes/autocomplete, erro era somente global e seletores usavam `div` clicável.  
**Depois:** controles têm nomes programáticos e hints de autofill/teclado; erros se associam aos campos e o primeiro inválido recebe foco; grupos de escolha usam HTML nativo.

Os testes de contrato garantem que labels e IDs permanecem pareados, que radios nativos existem e que o fluxo financeiro continua coberto pelas regressões autoritativas. A semântica não substitui a validação manual do anúncio em VoiceOver/NVDA/TalkBack.

### 3. Overlays, landmarks, foco e movimento (`WEB-008` a `WEB-011`)

Os três overlays customizados passaram ao mesmo primitive Radix já usado pelo carrinho. O layout recebeu skip link e destino principal; páginas tocadas usam `main`/headings coerentes; foco visível foi restaurado nos pontos citados.

A primeira captura móvel após a mudança de reduced motion revelou o hero escuro sem conteúdo, pois a visibilidade ainda dependia da inicialização do vídeo/animação. O container textual foi tornado independente desse ciclo. Uma nova captura com `--force-prefers-reduced-motion` confirmou conteúdo visível:

- [antes: hero sem conteúdo](evidence/web09/hero-before-fix.png)
- [depois: hero com redução de movimento](evidence/web09/hero-reduced-motion-after.png)
- [rota de produto em desktop](evidence/web09/product-route-desktop.png)

A skill local `a11y-debugging` direcionou labels, radios nativos, ciclo de foco, reduced motion e as verificações globais. O conector Chrome DevTools/Lighthouse não estava disponível; portanto não há alegação de conformidade WCAG, árvore acessível aprovada ou percurso completo de teclado.

### 4. Recuperação e headers (`WEB-012`, `WEB-013`)

O CSP passou a ser montado por ambiente: `unsafe-eval` existe apenas no desenvolvimento; em produção o header observado foi:

```text
script-src 'self' 'unsafe-inline'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
```

`unsafe-inline` não foi removido sem nonce/hash e validação de todos os scripts do Next e JSON-LD. O próximo passo seguro é `Content-Security-Policy-Report-Only` em staging, inventário de violações, nonce por request e promoção gradual.

As UIs locais de 404 e erro foram adicionadas. A rota inexistente respondeu 404; não foi injetada falha destrutiva para simular CDN/runtime.

## Evidências antes/depois e testes

| Verificação | Antes / primeira execução | Resultado final |
|---|---|---|
| Baseline unitário | 68 arquivos, 475/475 | 70 arquivos, 482/482, exit 0. |
| SEO/tenant | Sem testes específicos | 3 arquivos, 13/13 no corte SEO/produto/tenant. |
| Acessibilidade estática/checkout | Sem regressão dedicada | 3 arquivos, 23/23 no corte de contratos e negócio. |
| Render móvel | Captura após 5 s mostrou hero sem conteúdo | Captura com reduced motion forçado mostrou heading, texto e CTAs visíveis. |
| HTTP de produção local | Auditoria não conseguira executar app/headers | 200 para home/produto/robots/sitemap/login/checkout/API; 404 para rota ausente; canonical/JSON-LD e headers conferidos. |
| Tipos | — | `npx tsc --noEmit`, exit 0. |
| Lint | — | Exit 0, 0 erros e 20 warnings preexistentes/fora deste corte. |
| Build | — | Next.js 16.3.5, 51 páginas/rotas geradas, exit 0. |
| Diff | — | `git diff --check`, exit 0; apenas avisos de normalização LF/CRLF. |

O teste de contrato de acessibilidade falhou inicialmente porque o teste CommonJS não resolvia o alias `@/lib/csp`; passou a resolver o módulo pelo caminho absoluto. A captura visual encontrou a regressão do hero descrita acima e provocou a correção final. Uma checagem HTTP intermediária também falhou por tentativa de usar a variável reservada `$HOME` do PowerShell; foi repetida com `$homeHtml` e passou. Esses resultados não foram ocultados nem contabilizados como sucesso na primeira tentativa.

## Comandos executados

```text
npx vitest run web-seo product-pagination tenant-canonical-origin
npx vitest run web-accessibility-contracts checkout-authoritative checkout-cpf-enforcement
npm run test:unit
npx tsc --noEmit
npm run lint
npm run build
git diff --check
docker run ... postgres:16-alpine -p 127.0.0.1:55438:5432
npx prisma migrate deploy
next start -p 3010
curl.exe -H "Host: shop.local.test" <rotas locais>
chrome.exe --headless=new --host-resolver-rules=... --screenshot=... <rotas locais>
```

Uma tentativa de depuração remota do Chrome foi bloqueada pela política de execução local e `--dump-dom` no executável Windows não forneceu stdout capturável. As capturas headless e as provas HTTP foram usadas somente onde observáveis; console/hydration, árvore de acessibilidade e Lighthouse permanecem `NOT VERIFIED`.

## Arquivos da etapa

**SEO/rotas:** `lib/web-seo.ts`, `app/layout.tsx`, `app/page.tsx`, `app/produto/[id]/page.tsx`, `app/robots.ts`, `app/sitemap.ts`, metadata/layouts privados e `services/product.service.ts`.  
**Acessibilidade:** `components/home/HomeClient.tsx`, `HeroVideo.tsx`, `MobileMenu.tsx`, catálogo, checkout, `components/ui/sheet.tsx`, páginas de checkout/perfil e `app/globals.css`.  
**Plataforma:** `lib/csp.js`, `next.config.js`, `app/not-found.tsx`, `app/error.tsx`, `app/global-error.tsx`.  
**Regressões/evidências:** `tests/unit/web-seo.test.ts`, `tests/unit/web-accessibility-contracts.test.ts` e `docs/remediation/evidence/web09/*`.

Não houve commit nesta etapa.

## Serviços e verificações externas pendentes

| Responsável / ambiente | Verificação objetiva de encerramento |
|---|---|
| Plataforma/DNS/CDN | Cada domínio autorizado entrega canonical, sitemap, robots, CSP e status sem sobrescrita do proxy; aliases redirecionam conforme política. |
| SEO/Produto | Aprovar política de slug/redirect e facetas; validar sitemap e dados estruturados em ferramentas autorizadas; acompanhar cobertura sem assumir indexação imediata. |
| Social | Conferir previews em crawlers/sandboxes autorizados de OpenGraph/Twitter. |
| QA de acessibilidade | Percorrer catálogo, overlays e checkout por teclado e com ao menos um leitor de tela; verificar foco, anúncios, zoom/reflow e contraste por tenant. |
| Segurança/Frontend | Implantar CSP report-only, eliminar violações e remover `unsafe-inline` com nonce/hash antes de endurecer o header. |
| Operação | Validar 404, boundary/retry e páginas de erro na topologia real, incluindo CDN e observabilidade. |

## Limitações e risco residual

- O ambiente local usou tenant, produto e banco PostgreSQL descartáveis; não há inferência sobre dados reais.
- Não houve Lighthouse, axe, árvore de acessibilidade, leitor de tela ou dispositivo físico. Contraste computado, zoom/reflow e percurso completo de teclado continuam pendentes.
- Console/hydration não puderam ser capturados pela automação disponível. O build e a renderização headless passaram, mas não equivalem a ausência universal de warnings de hydration.
- Search engines e plataformas sociais controlam crawl, indexação, snippets e rich results; o código apenas estabelece elegibilidade técnica.
- O CSP ainda admite script/style inline. Removê-los sem rollout progressivo poderia interromper o storefront.
- A etapa 08 e seus achados não sobrepostos não foram iniciados automaticamente.
- Nenhum ambiente publicado, serviço real, credencial, conta, gateway, storage ou cloud foi acessado ou alterado.

## Encerramento

Todos os IDs `WEB-001` a `WEB-013` foram revalidados e receberam estado explícito. Os gates estáticos e locais de rota/HTTP/build ficaram verdes, mas acessibilidade dinâmica, domínio publicado, crawlers externos e CSP sem `unsafe-inline` permanecem pendentes. Por isso esta entrega não declara `APPROVED`, conformidade WCAG, indexação garantida nem prontidão global de publicação.


## 2026-09-29 — execução dos prompts atualizados e correções locais

**IDs:** WEB-005/006/007/008/009/010/012, FINAL-023/024/030/031/032. Revisados guias Next locais e executadas jornadas via Chrome/CDP isolado. Trap/Escape e retorno de foco do carrinho foram medidos e corrigidos; labels administrativos agora associados. Responsividade/zoom equivalente e reduced-motion passaram no recorte: vídeo sem currentSrc quando redução de movimento ativa. Ausência de exceção de hidratação observada nas sessões capturadas.

Metadata/SSR/canonical/noindex existentes preservados. CSP com unsafe-inline continua parcial; nonce/hash exige rollout compatível e prova de scripts/estilos antes de adoção. Não se afirma certificação WCAG, contraste completo por tenant, NVDA/VoiceOver, Safari/Firefox, indexação ou rich results externos. Evidência atual em `evidence/astra-20260929/web-checks.json`.

**Validação consolidada:** [complemento de FINAL-VALIDATION](FINAL-VALIDATION.md#2026-09-29--execução-dos-prompts-atualizados-e-correções-locais). Histórico acima preservado; homologação externa não inferida.
