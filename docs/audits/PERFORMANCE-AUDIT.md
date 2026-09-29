# Auditoria de Performance e Escalabilidade — Etapa 08/15

**Relatório:** `docs/audits/PERFORMANCE-AUDIT.md`  
**Data da análise:** 2026-09-26  
**Revisão analisada:** `0c7ef7d`  
**Escopo:** análise estática e medições locais seguras de frontend, backend, banco, APIs e mecanismos de cache  
**Fora do escopo:** correções no produto, carga contra produção, acesso a dados reais, chamadas a serviços externos e afirmação de capacidade sem benchmark

## Executive Summary

A implementação tem controles positivos — paginação com teto de 100 na API de produtos, respostas limitadas em pedidos e dashboard, consultas paralelas no dashboard e nos provedores de frete, timeouts explícitos para Asaas/Correios e cache por tenant. Contudo, o caminho público principal contorna a paginação: a home consulta **todo o catálogo**, inclui relações, serializa a coleção completa para um componente cliente e só então filtra/pagina no navegador. Esse custo cresce com o número de produtos em cada visita e é o maior gargalo estrutural confirmado.

O hero público também combina um vídeo local de **3.803.869 bytes**, `preload="auto"`, GSAP no cliente e ocultação deliberada do H1/conteúdo até o vídeo alcançar 2,8 s ou um fallback de 3,8 s. O efeito sobre o LCP real não pôde ser medido, mas a cadeia está comprovada no código e cria alto risco de LCP tardio, especialmente em rede móvel.

No backend, o checkout executa leituras e baixas de estoque sequencialmente por item dentro de uma transação sem limite máximo de itens e mantém a requisição aberta durante uma cadeia síncrona de chamadas ao gateway. As telas administrativas de clientes, por sua vez, carregam históricos vitalícios sem limite para agregar no processo Node. O dashboard limita seus DTOs, mas um cache miss dispara 18 operações de banco; o cache é local ao processo, não compartilha entradas entre instâncias e não suprime chamadas concorrentes para a mesma chave.

Não foi possível produzir bundle, trace de navegador, Core Web Vitals, planos SQL ou benchmark executável: `node_modules` e `.next` não estavam presentes. `npm test` e `npm run build` falharam imediatamente por executáveis ausentes. Portanto, este relatório não declara uma capacidade de 10, 100, 1.000 ou 10.000 usuários; apresenta apenas observações, estimativas proporcionais e hipóteses explicitamente rotuladas.

### Resultado executivo

| Severidade | Quantidade |
|---|---:|
| BLOCKER | 0 |
| CRITICAL | 0 |
| HIGH | 5 |
| MEDIUM | 5 |
| LOW | 0 |
| INFORMATIONAL | 0 |
| **Total** | **10** |

**Bloqueio de publicação por severidade:** não foi identificado achado classificado como `BLOCKER` ou `CRITICAL`.  
**Bloqueio de aprovação de capacidade:** a publicação com promessa de escala de 1.000/10.000 usuários não deve ser aprovada sem tratar `PERF-001`, `PERF-005`, `PERF-006` e `PERF-007` e sem executar os testes pendentes. Isso é um bloqueio de evidência/capacidade, não a afirmação de indisponibilidade em produção.

## 1. Metodologia

1. Leitura das instruções do repositório, documentação técnica segura, manifesto, configuração Next, esquema Prisma, serviços, handlers, componentes, hooks, store e testes relevantes.
2. Mapeamento dos caminhos críticos:
   - primeira visita → resolução do tenant → consulta do catálogo → RSC/HTML → hidratação → filtros/paginação;
   - carrinho → checkout → validação/estoque/pedido → gateway → resposta;
   - dashboard → autenticação → cache → agregações/contagens/listas;
   - cliente administrativo → lista → perfil/métricas → histórico.
3. Contagem estática de fronteiras cliente, splitting, imagens, handlers e assets; medição de tamanho em disco dos assets públicos e arquivos-fonte. Tamanho de fonte **não** foi tratado como tamanho de bundle.
4. Comparação das consultas reais com índices declarados no Prisma. Nenhum índice é recomendado como definitivo sem plano de execução.
5. Inspeção dos testes de performance/carga e do pipeline que os executa.
6. Tentativa de build/teste apenas local. Nenhum endpoint externo foi chamado e nenhuma variável de ambiente foi exibida.
7. Classificação de toda conclusão como fato observado, estimativa derivada ou hipótese a validar.

### Critério de severidade

- **BLOCKER:** impede operação/publicação básica ou torna qualquer avaliação inviável.
- **CRITICAL:** falha com impacto sistêmico imediato e alta probabilidade.
- **HIGH:** gargalo estrutural em caminho crítico, com crescimento não limitado ou grande amplificação sob concorrência.
- **MEDIUM:** degradação relevante, risco de escala ou lacuna de controle mensurável.
- **LOW:** otimização localizada com impacto limitado.
- **INFORMATIONAL:** observação sem correção obrigatória.

## 2. Ambiente e evidências reproduzíveis

### 2.1 Stack observada

| Camada | Evidência |
|---|---|
| Runtime | Node disponível localmente em `v24.16.0`; CI declara Node 20 em `.github/workflows/ci.yml:23-27` |
| Aplicação | Next.js `^16.3.5`, React/React DOM `^18`, App Router (`package.json:35-38`, diretório `app/`) |
| UI | Tailwind 3, Radix, Lucide, GSAP, Zustand (`package.json:20-43`) |
| Backend | route handlers Next e serviços TypeScript; 45 arquivos `app/api/**/route.ts` |
| Banco/ORM | PostgreSQL + Prisma 5 (`prisma/schema.prisma:4-11`, `package.json:19,36`) |
| Integrações | Asaas, Correios, J&T, ViaCEP, Supabase Storage, Resend |
| Deploy | `output: 'standalone'`; topologia real de hosting, réplicas, CDN e pool não está versionada (`next.config.js:1-4`) |

### 2.2 Comandos executados e resultados

Os comandos abaixo são somente leitura, salvo as tentativas de build/teste que não chegaram a executar por ausência das dependências.

```powershell
node --version
npm --version
Test-Path node_modules
Test-Path .next
```

Resultado: Node `v24.16.0`, npm `11.13.0`, `node_modules=False`, `.next=False`.

```powershell
Get-ChildItem public -Recurse -File |
  Sort-Object Length -Descending |
  Select-Object -First 10 Length, FullName
```

Principais resultados:

| Asset | Bytes |
|---|---:|
| `public/videos/hero.mp4` | 3.803.869 |
| `public/brand/continental-logo-full.png` | 608.516 |
| `public/brand/continental-wordmark.png` | 279.697 |
| `public/brand/continental-symbol-square.png` | 230.961 |
| `public/brand/continental-symbol.png` | 225.423 |
| `public/brand/continental-logo-horizontal.png` | 116.069 |
| `public/videos/hero-poster.jpg` | 32.567 |

```powershell
rg -l 'use client' app components hooks store --glob '*.ts' --glob '*.tsx'
rg -n 'dynamic\(' app components hooks --glob '*.ts' --glob '*.tsx'
rg -n 'next/image' app components --glob '*.tsx'
rg -l '<img\b' app components --glob '*.tsx'
rg --files app/api | Select-String 'route\.ts$'
```

Resultado estático: 76 arquivos com diretiva cliente; 1 uso de `dynamic()`; 2 arquivos importam `next/image`; 11 arquivos contêm `<img>`; 45 route handlers. Esses números descrevem estrutura, não bytes transferidos.

```powershell
Get-ChildItem app,components,hooks,store -Recurse -File -Include *.ts,*.tsx |
  Sort-Object Length -Descending |
  Select-Object -First 15 Length, FullName
```

Maiores fontes: `CheckoutForm.tsx` 55.401 bytes, `LoyaltyAdminView.tsx` 31.901, `app/admin/settings/page.tsx` 30.392, `HomeClient.tsx` 24.799. Esses valores **não são bundle gzip/brotli** e servem apenas para localizar concentração de responsabilidade.

```powershell
npm test
npm run build
```

Resultados:

- `npm test`: falhou antes dos testes — `vitest` não reconhecido.
- `npm run build`: falhou antes do build — `prisma` não reconhecido.
- Causa observada: ausência de `node_modules`; nenhum resultado funcional ou de performance foi inferido dessas falhas.

### 2.3 Limitações de medição

- Sem `node_modules`, não houve build de produção, analyzer, manifesto de chunks, trace de hidratação ou inspeção das convenções da versão instalada do Next.
- Sem `.next`, não havia bundle prévio para medir JS por rota, imagens geradas ou sourcemaps.
- Sem servidor local executável, o procedimento de LCP orientado por trace não pôde identificar o elemento LCP nem decompor TTFB/load delay/load duration/render delay.
- Nenhum banco local descartável autorizado foi disponibilizado. Não foram executados `EXPLAIN`, seed, integração ou carga.
- Não foram acessados banco, storage, gateway, e-mail, ViaCEP ou quaisquer serviços externos.
- Não foi lida nem impressa configuração secreta; `.env*` e valores de conexão ficaram fora dos comandos.

## 3. Mapa dos caminhos de performance

### 3.1 Vitrine pública

```text
Browser
  → GET /
  → getLojaFromHeaders() [cache do tenant, 300 s]
  → Promise.all(
       getProducts({ all: true }),
       getBrandsWithProductCount()
     )
  → Prisma/PostgreSQL: produtos + variantes + marca + tags
  → map para initialProducts
  → RSC/HTML serializa todos os produtos
  → HomeClient hidrata catálogo + hero + filtros
  → useProductFilters filtra/conta/pagina localmente
```

### 3.2 Checkout

```text
Browser hidrata /checkout
  → GET /api/loja/active
  → renderiza CheckoutForm
  → POST checkout
  → transação Prisma
       N leituras de produto/variantes (sequenciais)
       N..2N baixas de estoque (sequenciais)
       usuário/endereço/pedido/itens/pontos
  → commit
  → Asaas síncrono
       localizar/criar cliente
       criar cobrança
       obter QR/linha de boleto quando aplicável
  → atualizar pedido
  → responder ao browser
```

### 3.3 Dashboard

```text
Admin → Server Component → sessão → tenantCache local
  cache hit: DTO memoizado por 60 s
  cache miss: Promise.all com 18 operações Prisma
              → consolidação em memória → DTO limitado
```

### 3.4 Clientes administrativos

```text
Lista paginada de usuários (20 padrão)
  → para cada usuário retornado, relação orders sem take
  → reduce + sort no Node

Detalhe do cliente
  → profile e metrics em paralelo
  → metrics busca todos os pedidos e todos os itens
  → agregações e ordenações no Node
  → histórico separado e paginado
```

## 4. Achados

## PERF-001 — A home ignora paginação e envia o catálogo completo para hidratação

| Campo | Valor |
|---|---|
| Severidade | **HIGH** |
| Confiança | **CONFIRMED** |
| Categoria | Frontend / backend / banco / payload |
| Arquivos e linhas | `app/page.tsx:14-38`, `services/product.service.ts:51-98`, `hooks/useProductFilters.ts:329-399`, `app/api/products/route.ts:29-34` |

**Fluxo e condição de manifestação:** toda visita à home de uma loja. O custo aumenta proporcionalmente ao número de produtos, variantes, tags e URLs de galeria. Filtros e troca de página não reduzem o conjunto transferido inicialmente.

**Fato observado:** `app/page.tsx` chama `getProducts({ lojaId, all: true })`. No serviço, `all` define `take` e `skip` como `undefined`; a consulta inclui variantes, marca e tags relacionadas. A home mapeia todos os produtos e variantes para `initialProducts`. O hook calcula contagem por marca com `initialBrands.map(...initialProducts.filter(...))`, volta a varrer todos os produtos para cada alteração de filtro e só aplica `slice` depois disso. A API paginada tem teto de 100, mas retorna os objetos completos do `include`.

**Hipótese/estimativa:** tempo de consulta, bytes de RSC, parsing/hidratação e CPU de filtro crescem com `P` produtos; a contagem por marca cresce aproximadamente com `B × P`. O tamanho real e o LCP/INP não foram medidos.

**Impacto:** degradação de TTFB, memória do servidor, payload inicial, hidratação e responsividade da busca; cada usuário concorrente repete trabalho proporcional ao catálogo. A paginação visual de 12 cards não limita o custo de origem.

**Correção proposta:** tornar busca, filtros e paginação autoritativos no servidor; usar cursor ou paginação estável, `select` mínimo por card e endpoint/Server Action que retorne somente a página e metadados de faceta. Carregar detalhes/galeria/variantes sob demanda. Aplicar cache de catálogo por tenant e conjunto de filtros com invalidação explícita na mutação de produtos. Evitar `all` no caminho público.

**Teste de regressão:** seed descartável com 20, 500, 5.000 e 50.000 produtos; afirmar teto de linhas e de bytes da primeira resposta independentemente do total; contar queries; medir TTFB, RSC transferido, JS/hidratação e interação de busca. Verificar que página/filtros não perdem consistência e que a invalidação atualiza produto alterado.

**Risco residual:** filtros textuais com `contains insensitive` e facetas complexas ainda podem exigir índices/estratégia de busca próprios; validar com planos e distribuição real dos dados.

## PERF-002 — Vídeo do hero e revelação tardia criam risco alto de LCP

| Campo | Valor |
|---|---|
| Severidade | **HIGH** |
| Confiança | **HIGH CONFIDENCE** |
| Categoria | Frontend / mídia / LCP |
| Arquivos e linhas | `components/home/HeroVideo.tsx:71-117,127-162`, `public/videos/hero.mp4`, `public/videos/hero-poster.jpg` |

**Fluxo e condição de manifestação:** primeira visita à home, especialmente rede/CPU móvel, autoplay bloqueado ou vídeo lento.

**Fato observado:** o vídeo de 3.803.869 bytes usa `autoPlay` e `preload="auto"`. O container com o H1 começa com `visibility: hidden` e `opacity: 0`. A revelação só inicia quando `currentTime >= 2.8` ou após fallback de 3.800 ms, seguida por uma timeline GSAP. O poster tem 32.567 bytes.

**Hipótese/estimativa:** se o H1 ou o hero visual for o LCP, há render delay deliberado; a transferência antecipada do vídeo disputa banda com recursos críticos. O elemento LCP e cada componente temporal não foram confirmados por trace, então não se declara um LCP numérico.

**Impacto:** percepção de tela vazia/incompleta, LCP tardio e consumo de dados; custo existe por usuário e é mais severo em mobile.

**Correção proposta:** renderizar título e CTA visíveis no HTML inicial; usar o poster como conteúdo inicial, `preload="metadata"` ou `none` conforme experimento, e iniciar vídeo após conteúdo crítico/idle/interação. Gerar versões adaptativas menores, limitar autoplay por condições de rede/preferência, respeitar `prefers-reduced-motion` e evitar que a animação determine a visibilidade sem fallback imediato.

**Teste de regressão:** build de produção + Chrome trace em mobile pequeno e desktop, cold/warm cache e rede rápida/lenta; identificar o LCP, decompor TTFB/load delay/load duration/render delay, verificar bytes e prioridade do vídeo. Adotar orçamento explícito e validar LCP de laboratório e p75 RUM antes de definir aprovação.

**Risco residual:** autoplay, codec e cache variam entre navegadores/CDNs; laboratório não substitui RUM.

## PERF-003 — Imagens de produto frequentemente contornam o pipeline responsivo

| Campo | Valor |
|---|---|
| Severidade | **MEDIUM** |
| Confiança | **CONFIRMED** |
| Categoria | Frontend / imagens / layout |
| Arquivos e linhas | `lib/utils.ts:8-26`, `components/home/HomeClient.tsx:201-246,410-427`, além dos 11 arquivos listados na evidência estática |

**Fluxo e condição de manifestação:** cards, modal/galeria, carrinho, checkout, perfil e telas administrativas, sobretudo para URLs que não sejam Supabase.

**Fato observado:** há `<img>` em 11 arquivos e `next/image` em apenas 2. `getOptimizedImageUrl` acrescenta transformação somente a URLs Supabase; qualquer outra origem é devolvida integralmente. Os exemplos da home não declaram atributos HTML `width`, `height`, `srcSet`, `sizes` ou `loading`. Classes CSS limitam a caixa, mas não oferecem seleção responsiva da origem nem dimensões intrínsecas.

**Hipótese/estimativa:** imagens não Supabase podem ser baixadas maiores que o necessário e a ausência de dimensões intrínsecas pode contribuir para layout shift. O peso das imagens remotas e o CLS real não foram medidos.

**Impacto:** bytes e decodificação excessivos, maior contenção da rede e risco de instabilidade visual.

**Correção proposta:** padronizar `next/image` ou componente equivalente com `width`/`height` ou `fill`, `sizes`, formatos modernos e lazy loading abaixo da dobra. Persistir dimensões/metadados do upload e aplicar transformação também às origens autorizadas. Priorizar somente a imagem realmente crítica.

**Teste de regressão:** browser trace e auditoria de imagens em viewports 320, 768, 1366 e 1920 px; afirmar que recurso escolhido não excede significativamente a caixa renderizada; medir bytes, decode e CLS; testar Supabase e cada origem legada.

**Risco residual:** otimização remota depende do plano/serviço de imagem, políticas de cache e disponibilidade da origem.

## PERF-004 — Checkout só começa a buscar configuração após a hidratação

| Campo | Valor |
|---|---|
| Severidade | **MEDIUM** |
| Confiança | **HIGH CONFIDENCE** |
| Categoria | Frontend / waterfall / bundle |
| Arquivos e linhas | `app/checkout/page.tsx:1-46,48-59,126-202`, `components/checkout/CheckoutForm.tsx:1-24` |

**Fluxo e condição de manifestação:** navegação para `/checkout`.

**Fato observado:** a página inteira é cliente. Somente após montar, um `useEffect` chama `/api/loja/active`; enquanto a resposta não chega, a página exibe bloqueio de tela inteira. `CheckoutForm`, um arquivo-fonte de 55.401 bytes, é importado estaticamente. O arquivo agrega PIX, cartão, boleto, frete, fidelidade, validação e muitos ícones.

**Hipótese/estimativa:** há uma waterfall HTML/JS → hidratação → API → formulário, e o agrupamento tende a aumentar parse/execução de JS. O tamanho do chunk e a duração real não foram medidos.

**Impacto:** atraso para conteúdo útil do checkout e maior custo de JS em uma etapa sensível à conversão.

**Correção proposta:** resolver a loja no Server Component e passar um DTO mínimo ao cliente; manter apenas os campos interativos na fronteira cliente. Dividir UI/módulos de pagamento por método selecionado com carregamento sob demanda e preservar um skeleton de estrutura estável.

**Teste de regressão:** build com relatório por rota; comparar JS inicial e trace antes/depois; verificar que o formulário começa a renderizar sem round trip pós-hidratação e que cada método de pagamento é carregado apenas quando necessário.

**Risco residual:** carrinho persistido no cliente e validações interativas ainda exigem hidratação; objetivo é reduzir, não eliminar JS.

## PERF-005 — Checkout executa trabalho sequencial por item dentro da transação e não limita o carrinho

| Campo | Valor |
|---|---|
| Severidade | **HIGH** |
| Confiança | **CONFIRMED** |
| Categoria | Backend / banco / transação |
| Arquivos e linhas | `lib/validators/checkout.validators.ts:24-32,87-108`, `services/checkout.service.ts:115-249`, `services/inventory.service.ts:29-81` |

**Fluxo e condição de manifestação:** POST de checkout com vários itens/variantes; o custo também pode ser provocado por payload válido grande porque o array usa apenas `.min(1)`.

**Fato observado:** dentro de `prisma.$transaction`, o código percorre itens com `for ... of` e aguarda um `product.findUnique` por item. Depois, `reserveStock` ordena e percorre novamente, aguardando uma atualização do produto e, se houver, outra da variante por item. O schema não impõe `.max()` no número de itens. Há ainda usuário, regra de frete, endereço, pedido e fidelidade na mesma transação.

**Hipótese/estimativa:** para `N` itens, apenas essa parte produz `N` leituras mais `N..2N` atualizações sequenciais, prolongando a posse de conexão/locks. Latência e contenção exatas dependem do banco e não foram medidas.

**Impacto:** throughput menor do checkout, maior duração de transação, pressão sobre pool e locks; sob concorrência, filas e timeouts tornam-se prováveis.

**Correção proposta:** definir limite de itens distintos e quantidades; buscar produtos/variantes em lote com projeção mínima; validar mapa em memória; executar reserva com operação condicional/batch compatível com as garantias de concorrência e manter ordem determinística. Reduzir o escopo transacional sem retirar invariantes críticas.

**Teste de regressão:** integração com banco descartável para carrinhos de 1/10/50/limite+1; contar queries e duração da transação; executar compras concorrentes pela última unidade e verificar estoque/invariantes; afirmar rejeição rápida acima do limite.

**Risco residual:** batching não elimina disputa de estoque; isolamento, deadlocks/retries e pool precisam ser medidos no PostgreSQL real de homologação.

## PERF-006 — Resposta do checkout aguarda cadeia sequencial de chamadas ao gateway

| Campo | Valor |
|---|---|
| Severidade | **HIGH** |
| Confiança | **CONFIRMED** |
| Categoria | Backend / integração externa / latência |
| Arquivos e linhas | `services/checkout.service.ts:478-631,633-666`, `services/asaas/asaas.adapter.ts:24-54,116-175,233-267`, `services/asaas/asaas.client.ts:53-68,74-176` |

**Fluxo e condição de manifestação:** checkout com chave Asaas configurada e documento do cliente presente.

**Fato observado:** após confirmar a transação do pedido, a mesma requisição aguarda localizar cliente, possivelmente criá-lo, criar cobrança e, em PIX/boleto, buscar dados adicionais; as chamadas são sequenciais. Cada request do client tem timeout independente de 8 s. A atualização final do pedido também é aguardada. Compensação é tentada se o gateway falhar.

**Estimativa derivada:** para PIX com cliente já existente são três requests externos sequenciais; com criação, quatro. Se cada request alcançar o timeout, o envelope teórico externo é de aproximadamente 24/32 s, antes de DB, serialização e overhead. Isso não é um benchmark nem afirma que tais durações ocorram normalmente.

**Impacto:** latência e variância altas no checkout, conexões HTTP abertas e forte dependência da disponibilidade do provedor; concorrência de pagamentos lentos reduz capacidade do processo.

**Correção proposta:** definir SLO e timeout global do checkout; persistir ID do cliente Asaas localmente com reconciliação; reduzir chamadas auxiliares no caminho síncrono quando o contrato permitir. Para meios assíncronos, considerar estado `PAYMENT_INITIALIZING` + worker/outbox e polling/stream de status, mantendo idempotência. Cartão que exige resposta imediata pode continuar síncrono, mas com orçamento fim a fim e circuit breaker controlado.

**Teste de regressão:** gateway fake local com latências/timeout por etapa; validar orçamento global, retry/idempotência, cancelamento do request e reconciliação; medir p50/p95/p99 local sem rede externa. Confirmar que timeout não duplica cobrança ou estoque.

**Risco residual:** pagamento é integração remota e nunca terá latência totalmente controlável; filas exigem observabilidade e reconciliação operacional.

## PERF-007 — Métricas administrativas materializam históricos vitalícios no Node

| Campo | Valor |
|---|---|
| Severidade | **HIGH** |
| Confiança | **CONFIRMED** |
| Categoria | Backend / banco / serialização |
| Arquivos e linhas | `services/customer.service.ts:60-133,200-282`, `components/admin/customers/CustomerProfilePage.tsx:57-100` |

**Fluxo e condição de manifestação:** listar clientes com histórico longo ou abrir métricas de um cliente com muitos pedidos/itens.

**Fato observado:** `listCustomers` limita usuários, mas seleciona todos os pedidos de cada usuário retornado e calcula total/último pedido com `reduce` e `sort`. `getCustomerMetrics` seleciona todos os pedidos e todos os itens, depois soma, ordena e agrupa no Node. Perfil e métricas são chamados em paralelo; o histórico da UI é uma terceira consulta separada. O teste existente modela explicitamente cliente com 1.000 pedidos.

**Hipótese/estimativa:** custo de DB→Node, heap e CPU cresce com o histórico vitalício, não com o tamanho da página. O teste de 1.000 pedidos não pôde ser executado e seu profiler tem a lacuna de `PERF-010`.

**Impacto:** páginas administrativas lentas, uso de memória por request e pressão no banco, principalmente em clientes recorrentes e múltiplos administradores concorrentes.

**Correção proposta:** substituir materialização por `count`, `sum`, `min/max`, `groupBy` e consultas limitadas; pré-agregar métricas de cliente quando volume justificar. Para “produto mais comprado”, agregar por identificador estável no banco ou manter projeção materializada. Unificar profile/métricas quando reduzir round trips for benéfico e manter histórico paginado.

**Teste de regressão:** banco descartável com 0/100/1.000/100.000 pedidos e múltiplos itens; afirmar número/teto de linhas retornadas, queries e memória; comparar plano e latência. Incluir concorrência de 10/100 requests em ambiente isolado.

**Risco residual:** agregações sobre grande histórico ainda exigem índices e possivelmente projeções incrementais; consistência/frescor precisa ser definida.

## PERF-008 — Cache em memória não é distribuído, não coalesce misses e aceita alta cardinalidade

| Campo | Valor |
|---|---|
| Severidade | **MEDIUM** |
| Confiança | **CONFIRMED** |
| Categoria | Cache / escalabilidade horizontal |
| Arquivos e linhas | `lib/cache.ts:14-25,40-112`, `services/dashboard.service.ts:60-95`, `services/freight/orchestrator.service.ts:71-128` |

**Fluxo e condição de manifestação:** cold start, expiração simultânea, múltiplas réplicas ou muitas combinações de CEP/peso/dimensões em cotações.

**Fato observado:** `tenantCache` usa um `Map` do processo, varre entradas expiradas a cada 60 s, não tem limite de tamanho e só grava o valor depois de `await factory()`. Duas chamadas simultâneas para a mesma chave executam duas factories. O dashboard usa TTL de 60 s; frete, 30 min e chave de alta cardinalidade. Entradas não são compartilhadas entre réplicas.

**Hipótese/estimativa:** misses concorrentes podem criar stampede; cada réplica repete consultas; muitas cotações distintas elevam heap até expiração. A topologia real de deploy não foi encontrada, portanto impacto multi-instância é hipótese, enquanto as propriedades do cache são fatos.

**Impacto:** picos periódicos de banco/provedores, baixa taxa de hit em horizontal scale e crescimento de memória por processo.

**Correção proposta:** coalescer promises em voo por chave; limitar entradas/peso com política LRU; adicionar jitter de TTL e stale-while-revalidate quando aceitável. Se houver múltiplas instâncias, usar cache distribuído/edge apropriado ou declarar intencionalmente cache local. Instrumentar hit/miss/eviction/factory duration e cardinalidade.

**Teste de regressão:** disparar 100 chamadas simultâneas para uma chave e afirmar uma única factory; testar 10.000 chaves com limite de heap/evicção; validar isolamento por tenant e comportamento entre duas instâncias de teste.

**Risco residual:** cache distribuído adiciona latência e indisponibilidade próprias; falha deve degradar para origem com proteção contra avalanche.

## PERF-009 — Consultas reais não estão totalmente alinhadas aos índices compostos

| Campo | Valor |
|---|---|
| Severidade | **MEDIUM** |
| Confiança | **SUSPECTED** |
| Categoria | Banco / índices / ordenação |
| Arquivos e linhas | `services/product.service.ts:59-97`, `services/dashboard.service.ts:118-288`, `prisma/schema.prisma:121-156,264-329,446-466` |

**Fluxo e condição de manifestação:** catálogo ordenado por criação, pedidos recentes por loja, agregações/agrupamentos de dashboard e transações recentes de fidelidade em tabelas grandes.

**Fato observado:** produto possui índices separados em `lojaID` e `createdAt`, mas a consulta predominante filtra `lojaID` e ordena `createdAt desc`. Pedido possui `(lojaID,status,createdAt)` e `(lojaID,status,paidAt)`, mas “recentes” filtra somente `lojaID` e ordena `createdAt`. Fidelidade possui `(lojaID,userID)` e `createdAt` separados, enquanto o dashboard filtra `lojaID` e ordena por `createdAt`. Busca textual usa `contains` case-insensitive. Existem índices adequados para vários outros fluxos, como J&T e pedidos por status.

**Hipótese:** PostgreSQL pode precisar ordenar/varrer mais linhas nesses formatos; seletividade e plano dependem do volume e estatísticas. Sem `EXPLAIN`, não é correto afirmar que um índice novo será usado ou benéfico.

**Impacto:** latência de catálogo/dashboard cresce com tabelas e compete por I/O/CPU; índices excessivos, se adicionados sem medir, também penalizariam escrita.

**Correção proposta:** capturar queries lentas e executar `EXPLAIN (ANALYZE, BUFFERS)` em clone sanitizado representativo. Somente então avaliar `(lojaID, createdAt DESC)` em Product/Order/LoyaltyTransaction, índices parciais para estados operacionais e estratégia `pg_trgm`/busca para `contains`. Remover redundâncias apenas após comparar planos e writes.

**Teste de regressão:** dataset representativo por tenant; registrar planos, buffers, rows examined, sort e p95 antes/depois; testar também INSERT/UPDATE e tamanho do índice. Fixar consulta beneficiada para cada índice aprovado.

**Risco residual:** planos mudam com distribuição, parâmetros e versão; monitorar regressão em produção por métricas agregadas sem expor dados.

## PERF-010 — Testes de performance do banco podem medir zero e não são gate do CI

| Campo | Valor |
|---|---|
| Severidade | **MEDIUM** |
| Confiança | **CONFIRMED** |
| Categoria | Testes / observabilidade / CI |
| Arquivos e linhas | `lib/prisma.ts:8-14`, `tests/helpers/query-profiler.ts:10-35`, `tests/integration/metrics-performance.test.ts:111-229`, `tests/load/customer-load.test.ts:52-125`, `package.json:5-15`, `.github/workflows/ci.yml:29-42` |

**Fluxo e condição de manifestação:** execução de integração/carga e publicação via CI.

**Fato observado:** o Prisma é configurado apenas com log `warn/error`; o profiler registra `$on('query')` sob `@ts-ignore`, mas a configuração não solicita emissão de eventos de query. Assim, contagem/duração podem permanecer vazias/zero. Vários testes afirmam limites usando somente `report.totalDuration`, que seria zero. O script padrão `npm test` executa apenas `tests/unit`; o CI chama esse script e build, não `test:integration` ou `test:load`. Nesta auditoria nenhum teste foi executado por ausência de dependências.

**Comportamento esperado:** profiler habilitado explicitamente para evento de query no ambiente de teste, falhando se não capturar nenhuma query quando uma era esperada; suites relevantes executadas em job isolado com banco descartável e resultados arquivados.

**Impacto:** falsa confiança em metas de query/latência e regressões de banco fora do gate. Testes com relógio de parede ainda têm valor, mas não corrigem a instrumentação nem cobrem frontend, bundle ou checkout.

**Correção proposta:** instanciar Prisma de teste com `{ emit: 'event', level: 'query' }` ou instrumentação suportada; adicionar asserção de sanidade do profiler. Separar smoke determinístico do benchmark ruidoso; executar integração em CI com PostgreSQL descartável e manter carga como job controlado/agendado. Adicionar budgets de bundle e trace de browser.

**Teste de regressão:** consulta conhecida deve produzir `queryCount >= 1` e duração não negativa; mutação que introduza N+1 deve falhar o teto. Confirmar que CI executa e publica resultado das suites sem tocar banco externo.

**Risco residual:** tempo de CI compartilhado é ruidoso; usar regressões relativas/faixas e ambiente dedicado para conclusões de capacidade.

## 5. Aspectos positivos observados

- A API comum de produtos impõe `take` entre 1 e 100 (`services/product.service.ts:54-57`); a exceção problemática é `all: true` na home.
- Dashboard executa operações independentes em paralelo e limita listas recentes/urgentes (`services/dashboard.service.ts:75-95,189-288`).
- Listas administrativas de pedidos e clientes têm paginação externa; o problema de clientes está nas relações históricas internas.
- Tenant lookup usa cache de 300 s e deduplicação por request (`lib/tenant.ts:41-75`).
- Provedores de frete são executados concorrentemente e têm cache de cotação (`services/freight/orchestrator.service.ts:99-128`).
- Asaas aplica timeout de 8 s por request (`services/asaas/asaas.client.ts:53-68`) e Correios possui timeout local; falta orçamento global, não ausência total de timeout.
- J&T tem índices coerentes com `geocom`/faixa de peso (`prisma/schema.prisma:536-549`).
- Respostas do dashboard e histórico de pedidos usam DTOs/projeções e limites, evitando envio indiscriminado de tabelas inteiras nesses endpoints.
- Cart drawer é carregado dinamicamente (`components/providers/CartProvider.tsx:6-8`).

## 6. Modelo de escala — sem benchmark inventado

| Escala solicitada | Observação comprovada | Estimativa proporcional | Hipótese/decisão pendente |
|---|---|---|---|
| 10 usuários | Cada visita à home ainda consulta/serializa catálogo completo; cada usuário baixa o hero; checkout faz chamadas sequenciais | Em catálogo pequeno e baixa concorrência, gargalos podem ficar mascarados, mas custo individual de mídia/revelação permanece | Capacidade e SLO não verificados |
| 100 usuários | Miss simultâneo do dashboard não é coalescido; cache por processo; checkout mantém requests durante gateway | O banco pode receber múltiplos de 18 operações por miss e `O(N)` operações por carrinho | Necessário teste concorrente local e conhecer pool/instâncias |
| 1.000 usuários | Não há evidência de cache distribuído, fila de pagamento ou paginação server-side da home | Payloads/queries repetidos e transações mais longas tendem a pressionar pool, heap e I/O | Não há base para aprovar tráfego concorrente dessa ordem |
| 10.000 usuários | Nenhum teste, topologia, autoscaling, pool, CDN/RUM ou limite operacional versionado | Processo-local/cache sem coalescing e caminhos não limitados são incompatíveis com uma afirmação responsável de escala | Exige arquitetura de capacidade, observabilidade e teste isolado; nenhuma capacidade numérica é declarada |

“Usuários” é ambíguo: cadastrados, ativos diários e concorrentes produzem cargas distintas. Antes de benchmark, definir mix (browse/search/cart/checkout/admin), catálogo, pedidos por cliente, itens por carrinho, cache quente/frio, taxa de pagamento e SLO.

## 7. Priorização da dívida

### P0 — antes de alegar escala ou realizar campanha

1. `PERF-001`: paginação/filtros server-side e payload mínimo da vitrine.
2. `PERF-002`: tornar conteúdo do hero imediatamente renderizável e medir LCP.
3. `PERF-005`: limitar carrinho e reduzir round trips/tempo transacional.
4. `PERF-006`: orçamento fim a fim e desenho assíncrono/reconciliação do pagamento.
5. `PERF-007`: agregações de clientes no banco/projeção.

### P1 — estabilização para escala horizontal

1. `PERF-008`: coalescing, limite/cardinalidade e estratégia distribuída de cache.
2. `PERF-009`: planos de execução e índices justificados pelas consultas.
3. `PERF-010`: profiler válido e gates de integração/performance.
4. `PERF-003` e `PERF-004`: imagens responsivas, reduzir waterfall e JS do checkout.

## 8. Verificações pendentes / Not Verified

1. Build de produção e bytes JS/CSS por rota; chunk duplicado e eficácia real de tree-shaking/splitting.
2. Chrome trace da home e checkout: LCP element/decomposição, CLS, INP, long tasks, hydration e waterfalls.
3. Testes nas larguras mobile pequeno, tablet, notebook e desktop com perfis de CPU/rede.
4. Peso/cache das imagens remotas e headers de cache/CDN para vídeo, imagens, RSC e APIs.
5. `EXPLAIN (ANALYZE, BUFFERS)` das queries citadas em clone sanitizado com volume representativo.
6. Configuração efetiva do pool PostgreSQL/Neon, limites de conexão, timeouts, réplicas e topologia serverless/Node.
7. Execução de `test:integration` e `test:load` após corrigir/validar o profiler, com banco local descartável e servidor local.
8. Concorrência de checkout, última unidade, dashboards em cold start e 100 misses simultâneos de cache.
9. Latência/falhas do Asaas, Correios, Resend e ViaCEP usando somente fakes/proxies locais; nenhuma integração externa foi testada.
10. RUM/p75 e SLOs reais. Sem eles não há conclusão de capacidade de produção.

## 9. Itens não aplicáveis ou sem evidência suficiente

- **Filas:** não foi encontrada fila no caminho analisado; portanto não há throughput de worker a medir. A ausência é relevante em `PERF-006`, mas não prova por si só um defeito.
- **Fontes web:** não foi encontrada importação `next/font` ou `@font-face`; não há download de fonte versionado para auditar. Classes declaram famílias com fallbacks, mas o recurso efetivo depende do cliente.
- **N+1 ORM clássico em listagens limitadas:** includes do Prisma não foram classificados automaticamente como N+1; somente loops explícitos e relações sem limite foram reportados. A estratégia SQL real deve ser confirmada por query log/plano.
- **IA/prompt:** não foi encontrado fluxo de IA no caminho de performance; performance de inferência não se aplica.
- **Uploads/processamento de imagem:** a auditoria constatou o componente e storage, mas não executou transformações remotas; throughput do provedor não foi verificado.
- **Benchmark de produção:** explicitamente não aplicável nesta etapa por segurança e autorização.

## 10. Riscos residuais

- Desempenho depende de cardinalidade, distribuição, latência de rede, plano PostgreSQL, pool, região e cache; análise estática não substitui medição.
- Otimizações de cache podem introduzir dados obsoletos; catálogo, preço e estoque exigem políticas distintas e invalidação correta.
- Server-side filtering reduz payload do browser, mas pode deslocar custo para busca/banco; índices e limites continuam necessários.
- Processamento assíncrono de pagamento melhora latência/isolamento, mas exige idempotência, outbox, retry, reconciliação e UX de estado pendente.
- Novos índices aceleram leitura e aumentam custo/espaço de escrita; só devem ser promovidos após plano e teste.
- Métricas sintéticas e CI não reproduzem integralmente dispositivos, CDN e integrações; complementar com RUM anonimizado e alertas.

## 11. Conclusão limitada ao escopo

Foram registrados 10 achados: 5 HIGH e 5 MEDIUM. A maior prioridade é remover o catálogo integral do caminho inicial, desacoplar o conteúdo crítico do vídeo, limitar/batchear trabalho transacional do checkout, controlar a cadeia do gateway e evitar históricos vitalícios materializados no Node.

Não há evidência suficiente para declarar o sistema rápido, lento em termos absolutos ou capaz de suportar 10/100/1.000/10.000 usuários. Há, porém, evidência estática suficiente de custos não limitados e amplificadores de concorrência que impedem aprovar uma promessa de alta escala sem correção e medição. A auditoria termina nesta etapa e não altera código de produto.


---

## Revalidação de 2026-09-29 — etapa 08/15

O conteúdo anterior é histórico e foi preservado. Esta seção avalia o código local atual, incluindo mudanças sem commit, após as correções registradas em docs/remediation. Base: HEAD 0c7ef7ddfa5fb4520c4bc794163cbc71257c2bc4. O responsável autorizou continuar as etapas sem pausas. Somente relatórios são alterados.

### Resultado

Corrigido: **6**; Parcialmente corrigido: **2**; Persistente: **1**; Não verificado: **1**. Pendências confirmadas/parciais por risco residual: MEDIUM 2, HIGH 1. Itens não verificados ficam separados de defeitos confirmados.

Corrigido refere-se ao defeito original no recorte verificado; não certifica toda a funcionalidade ou serviços externos. Confiança CONFIRMED identifica código observado e/ou teste executado, conforme a evidência; não transforma inspeção em teste dinâmico. Severidade original é preservada, e risco residual não deve ser somado entre relatórios sem deduplicação.

### Matriz dos achados

| ID | Severidade original | Estado | Risco residual | Confiança | Evidência atual, fluxo e impacto | Encerramento / regressão / limite |
|---|---|---|---|---|---|---|
| PERF-001 | HIGH | Corrigido | LOW | CONFIRMED | Home usa página de 12 itens e product.service.ts:189 busca pageSize+1; performance-catalog passou. | Bytes/TTFB atuais não medidos; resultados de setembro 28 são históricos. |
| PERF-002 | HIGH | Corrigido | MEDIUM | CONFIRMED | HeroVideo:5-54 difere src por 2 s, poster, preload none e conteúdo inicial visível. | LCP/trace em dispositivo real não medidos; corrigido o mecanismo original, não certificado o índice. |
| PERF-003 | MEDIUM | Parcialmente corrigido | MEDIUM | CONFIRMED | HomeClient usa Image/sizes mas unoptimized para hosts não permitidos; lint ainda aponta img em carrinho/checkout/admin. | Medir payload/imagens e otimizar cortes restantes sem assumir CDN externo. |
| PERF-004 | MEDIUM | Corrigido | LOW | CONFIRMED | app/checkout/page.tsx resolve loja no servidor e CheckoutPageClient:12 faz import dinâmico. | performance-checkout-page passou; waterfall real não traçado. |
| PERF-005 | HIGH | Corrigido | MEDIUM | CONFIRMED | Checkout limita itens e faz product.findMany (:411); reserva mantém locks determinísticos. | performance-checkout/transactions passaram; custo de 50 itens sob concorrência não medido. |
| PERF-006 | HIGH | Persistente | HIGH | CONFIRMED | checkout.service.ts:779-1029 ainda espera gateway antes da resposta. Durabilidade não remove latência de criação/QR/dados. | Medir timeout/p95 e definir UX de pagamento assíncrono; nenhuma latência externa foi inventada. |
| PERF-007 | HIGH | Corrigido | LOW | CONFIRMED | customer.service.ts:99,207 usa agregação em vez de históricos vitalícios; testes performance-customer-metrics passaram. | Medir plano em distribuição real antes de materializar dados. |
| PERF-008 | MEDIUM | Parcialmente corrigido | MEDIUM | CONFIRMED | cache.ts:14-16,119-138 limita 1000 entradas e coalesce promises; Map segue por processo. | cache-tenant e loja-service-cache passaram; backend compartilhado só se necessário à topologia. |
| PERF-009 | MEDIUM | Não verificado | MEDIUM | NOT VERIFIED | Não houve EXPLAIN/buffers em dados representativos; índices existentes não foram avaliados por ganho real. | DB-015 permanece hipótese; não criar índices especulativos. |
| PERF-010 | MEDIUM | Corrigido | LOW | CONFIRMED | Prisma emite eventos; query-profiler.test mediu queries reais e encerrou observador; suíte consta do gate central. | Não confundir contador de queries com benchmark de produção. |

### Medidas, estimativas e limites

Medidas desta rodada: **613 testes unitários em 20,95 s**, **26 integrações em 8,67 s** e profiler observando queries reais. São tempos do runner local, não throughput da aplicação. Não houve build novo, trace de browser, teste de carga, benchmark de gateway nem medição de bundle. Guias locais do Next sobre cache compartilhado/revalidateTag foram consultados na etapa 01.

| Concorrência hipotética | Pontos a medir — não são previsões de capacidade |
|---|---|
| 10 usuários | Latência individual do gateway e carregamento de mídia |
| 100 usuários | Pool de conexões, duração de transações e disputa de estoque |
| 1.000 usuários | Distribuição de cache/rate limit, payload e limites dos provedores |
| 10.000 usuários | Particionamento de jobs, filas, capacidade de banco/índices e custo de fan-out |

Nenhuma dessas escalas foi simulada ou certificada. Prioridade é medir cenários representativos no ambiente escolhido, preservando a referência financeira/idempotência; não paralelizar chamadas mutáveis do gateway indiscriminadamente.
