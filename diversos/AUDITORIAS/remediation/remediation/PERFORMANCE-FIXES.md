# Etapa 10 — Performance e escalabilidade

Data: 2026-09-28  
Escopo: `PERF-001` a `PERF-010` e correlatos de `FINAL-AUDIT.md`/`DATABASE-AUDIT.md`.  
Ambiente: Windows local, Node/Next.js 16.3.5 e PostgreSQL 16 descartável em `127.0.0.1:55439`. Nenhum serviço, dado, conta ou credencial real foi usado.

## Resultado executivo

Foram corrigidos os custos confirmados do catálogo inicial, leitura de produtos no checkout, materialização de histórico de clientes, stampede/crescimento do cache, waterfall e bundle do checkout, caminho inicial do hero e instrumentação de queries. A reserva sequencial de estoque foi mantida porque protege a ordem de locks e a atualização condicional.

Não foi criado índice baseado apenas em suspeita. Também não foi transformado o pagamento em fluxo assíncrono sem worker/outbox, SLO e sandbox autorizada. A etapa melhora o comportamento local, mas não aprova capacidade de produção.

## Classificação dos achados

| ID | Confirmação no estado atual | Estado desta etapa | Severidade residual | Evidência principal |
|---|---|---|---|---|
| `PERF-001` | `VALID` | `FIXED` | MEDIUM | Home passou de 500 para 12 produtos no HTML/RSC; resposta inicial de 441.691 para 76.157 bytes na medição isolada da causa. |
| `PERF-002` | `VALID` | `FIXED` no código; trace `NOT VERIFIED` | MEDIUM | Hero não depende de vídeo/GSAP para visibilidade; poster inicial, `preload=none`, source diferido 2 s e reduced motion. |
| `PERF-003` | `VALID` | `FIXED parcial` / `DEFERRED` | MEDIUM | Home e produto usam `next/image`, dimensões e `sizes`; ainda há `<img>` em carrinho, checkout, perfil e admin. |
| `PERF-004` | `VALID` | `FIXED` | LOW | Tenant resolvido em Server Component, sem `/api/loja/active` pós-hydration; formulário é chunk sob demanda. |
| `PERF-005` | `VALID` | `FIXED` | MEDIUM | Limite de 50 itens/100 unidades já existia; leitura N por item virou um `findMany`; última unidade continua atômica. |
| `PERF-006` | `VALID` | `DEFERRED` | HIGH | Request ainda aguarda cadeia Asaas; estados, idempotência e reconciliação existem, mas não removem latência externa. |
| `PERF-007` | `VALID` | `FIXED` | LOW | Histórico deixou de ser materializado; listagem e detalhe usam agregações limitadas no banco. |
| `PERF-008` | `VALID` | `FIXED` no processo / `DEFERRED` entre réplicas | MEDIUM | LRU simples de 1.000 entradas e uma promise em voo por chave; 100 misses executam uma factory. |
| `PERF-009` | `NOT VERIFIED` | `NOT VERIFIED` | MEDIUM | O relatório original era `SUSPECTED`; plano de 500 produtos não justifica novo índice. |
| `PERF-010` | `VALID` | `FIXED` | LOW | Prisma emite eventos reais, unsubscribe funciona e o teste do profiler integra o gate PostgreSQL central. |

## Evidências antes e depois

### Catálogo, HTML e bundle

| Medida local comparável | Antes | Depois |
|---|---:|---:|
| Produtos fictícios no tenant | 500 | 500 |
| Produtos únicos no HTML/RSC inicial | 500 | 12 |
| Resposta inicial da home na medição de `PERF-001` | 441.691 bytes | 76.157 bytes |
| TTFB da home, 10 requests aquecidos | 66,7–89,8 ms | 16,1–28,8 ms |
| JS bruto da entrada da home | 260.304 bytes / 7 chunks | 189.618 bytes / 7 chunks |
| JS bruto da entrada do checkout | 538.041 bytes / 10 chunks | 165.814 bytes / 7 chunks |
| Checkout em HTTP após correção | loader bloqueante | conteúdo útil, 200, 26.802 bytes, TTFB observado 15,7 ms |

Os bytes de entrada são a soma bruta dos arquivos em `entryJSFiles` do manifest do mesmo build local, sem compressão. Os TTFBs são amostras de loopback, sem throttling, e não são percentuais nem previsão de produção. Depois de `next/image`, o HTML final da home mediu 88.593 bytes por conter `srcset`, ainda limitado a 12 produtos; a URL otimizada testada respondeu 200 com 34.487 bytes (`image/png`).

### Banco, concorrência e cardinalidade

- `createOrder` deduplica IDs e executa um `product.findMany` por checkout. O teste afirma nenhuma chamada a `product.findUnique` no adaptador Prisma completo.
- O limite existente de 50 itens e 100 unidades por item foi preservado. A reserva executa `updateMany` condicional em ordem determinística; paralelizá-la mudaria a garantia de concorrência.
- `listCustomers` seleciona apenas a página de usuários e agrega pedidos para aqueles IDs. `getCustomerMetrics` executa duas agregações paralelas e limita o produto mais comprado a uma linha.
- A suíte descartável passou com 1.000 clientes, perfis de 100/1.000 pedidos, 500 pedidos na listagem e dez consultas concorrentes. Os oito casos ficaram abaixo dos limiares locais declarados; os tempos individuais do runner ficaram entre 4 e 52 ms.
- A disputa da última unidade e a repetição idempotente passaram em PostgreSQL real local, sem gateway real.
- `EXPLAIN (ANALYZE, BUFFERS)` da página de 13 produtos, em fixture de 500 linhas de um único tenant, usou `Product_createdAt_idx`, leu 3 buffers compartilhados e reportou 0,085 ms. Essa distribuição pequena não valida escala nem permite concluir que o índice escolhido seja adequado para produção.

### Cache

O cache continua particionado por `lojaID`. A capacidade local agora é 1.000 entradas com recência simples, limpeza de expirados e timer `unref`. A promise em voo também usa a chave tenant-aware e é removida no sucesso ou erro. Testes cobrem isolamento A/B, 100 misses concorrentes, retry depois de falha e evicção.

## Correções por arquivos

- Catálogo: `app/page.tsx`, `services/product.service.ts`, `hooks/useProductFilters.ts`, `components/home/HomeClient.tsx`, `lib/catalog-query.ts`.
- Checkout e transação: `app/checkout/page.tsx`, `components/checkout/CheckoutPageClient.tsx`, `services/checkout.service.ts`.
- Métricas: `services/customer.service.ts`.
- Cache: `lib/cache.ts`.
- Mídia: `components/home/HeroVideo.tsx`, `components/ConditionalHeader.tsx`, `lib/utils.ts`; dependência GSAP removida de `package.json`/lockfile.
- Instrumentação: `lib/prisma.ts`, `tests/helpers/query-profiler.ts`, `package.json`.
- Fixtures/testes: `tests/setup/db.ts`, `tests/setup/auth.ts`, `tests/integration/metrics-performance.test.ts`, `tests/integration/query-profiler.test.ts`, `tests/load/customer-load.test.ts` e testes unitários `performance-*`, cache, checkout e CPF/CNPJ.

Nenhuma migration foi criada ou aplicada fora do PostgreSQL descartável local.

## Comandos e resultados

| Comando/verificação | Resultado |
|---|---|
| `npm run build` | Next.js 16.3.5, 51 páginas geradas, exit 0. |
| Vitest focal de catálogo | 3 arquivos, 12/12. |
| Checkout autoritativo/transações | 2 arquivos, 11/11. |
| Métricas unitárias/CPF | 2 arquivos, 13/13. |
| Cache/cross-tenant/dashboard | 3 arquivos, 19/19. |
| Mídia/checkout web | 3 arquivos, 9/9 após atualizar contrato anterior. |
| `metrics-performance.test.ts` | 8/8 em PostgreSQL 16 descartável. |
| Transação/profiler/cache | 4 arquivos, 14/14. |
| `npm run test:integration:core` | 5 arquivos, 14/14; profiler incluído. |
| `npm test` | 74 arquivos, 495/495 testes unitários. |
| `npx tsc --noEmit` | Exit 0 nas verificações focais; o build final repetiu o typecheck. |
| `npm run lint` | Exit 0, 0 erros e 16 warnings conhecidos; 10 correspondem aos `<img>` ainda pendentes de `PERF-003`. |
| HTTP local + manifest | Home/checkout 200; sem waterfall; `srcset` e imagem otimizada 200; entradas JS contabilizadas. |
| `git diff --check` | Exit 0; somente avisos de normalização LF/CRLF. |

### Falhas encontradas durante a validação

1. A primeira execução do profiler usou senha incorreta do banco local e falhou por autenticação; a credencial fictícia do contêiner foi redefinida e o teste passou.
2. A primeira execução da suíte de métricas revelou fixture inválida: criava `User` antes de `Loja`. A tentativa seguinte revelou timeout por 1.000 hashes sequenciais e cleanup concorrente. A fixture foi corrigida para respeitar FKs e inserir clientes fictícios em lotes; após recriar somente o schema do banco descartável, 8/8 passaram.
3. Uma checagem HTTP tentou usar `$HOME`, variável reservada do PowerShell; foi repetida com outro nome e passou.
4. O teste web anterior esperava a expressão antiga de autoplay; falhou e foi atualizado para afirmar a política mais restritiva (`shouldLoadVideo && !prefersReducedMotion`, `preload=none`).
5. `npm run test:load` não produziu benchmark HTTP válido. Sem servidor, os cinco casos falharam por `ECONNREFUSED`; com `next start` local, quatro falharam com 401 porque a fixture ainda envia o identificador bruto da sessão, incompatível com o cookie assinado atual, e o caso de contagem de queries passou sem afirmar contagem positiva. O teste de serviço com volume real no PostgreSQL passou, mas a carga HTTP permanece `NOT VERIFIED` e não foi apresentada como sucesso.

## Pendências e critérios objetivos

### `PERF-002` / `PERF-003`

Pendente: trace Chrome/Lighthouse, LCP/CLS/INP, viewports e origens remotas; migrar os dez `<img>` restantes em carrinho, checkout, confirmação, perfil e admin.  
Encerramento: traces cold/warm em 320/768/1366/1920, recurso escolhido compatível com a caixa, nenhum layout shift atribuível a dimensão ausente e p75 RUM definido.

### `PERF-006`

Pendente: SLO fim a fim, persistência do customer ID Asaas, orçamento global seguro, circuit breaker e/ou worker/outbox com reconciliação.  
Encerramento: gateway fake demonstra timeout sem dupla cobrança/pedido/crédito; eventos fora de ordem convergem; sandbox autorizada confirma contrato e latência sem dados reais.

### `PERF-008`

Pendente: topologia real e invalidação entre réplicas.  
Encerramento: decisão documentada por cache local ou distribuído, teste com duas instâncias e falha do backend degradando sem vazamento entre tenants.

### `PERF-009`

Pendente: clone sanitizado representativo, `pg_stat_statements`/queries lentas e planos de Product, Order, Loyalty e buscas `contains`.  
Encerramento: cada índice proposto deve estar ligado a uma query real, com plano/buffers/p95 antes e depois, tamanho e custo de INSERT/UPDATE. Até lá, o item não é defeito confirmado.

### `PERF-010`

Pendente: baselines estatísticos estáveis e carga maior sem flakiness.  
Encerramento: amostra, aquecimento, hardware e tolerância documentados; gate falha se a contagem for zero; carga de 100/100.000 registros executada em ambiente isolado.

## Serviços e ambientes que exigem verificação autorizada

- Asaas: latência, timeout, idempotência, reconciliação e limites de API em sandbox.
- CDN/origens de imagem: Supabase Storage, Nuvemshop, Cloudinary e imagens legadas, incluindo cache e formatos entregues.
- Plataforma de deploy: número de réplicas, cold starts, pool de conexões, memória e comportamento do cache local.
- PostgreSQL representativo: distribuição/volume/estatísticas, planos, contenção e p95/p99.
- Browser/RUM: elemento LCP, decomposição, CLS, INP, long tasks e waterfall em dispositivos/redes reais.
- Correios, ViaCEP e provedores de e-mail: somente fakes foram usados nesta etapa; suas latências reais não foram medidas.

## Risco residual

O risco residual mais alto continua no pagamento síncrono (`PERF-006`). O cache ainda é local por processo, imagens fora da vitrine principal ainda usam markup legado e nenhum benchmark local autoriza promessa de 1.000/10.000 usuários. `PERF-009` permanece deliberadamente `NOT VERIFIED`; não houve promoção de suspeita para defeito.

O servidor local foi encerrado. O contêiner `codex-remediation10-postgres`, previamente conferido como `postgres:16-alpine` na porta `127.0.0.1:55439`, foi removido; seu banco/fixtures eram efêmeros e não são recuperáveis. O arquivo ignorado `.env.production.local` usado somente para o servidor local também foi removido.
