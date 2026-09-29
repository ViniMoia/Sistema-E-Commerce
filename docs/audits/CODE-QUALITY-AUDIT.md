# Auditoria de Dependências e Qualidade de Código — Etapa 10/15

**Relatório:** `docs/audits/CODE-QUALITY-AUDIT.md`  
**Data:** 2026-09-26  
**Revisão analisada:** `0c7ef7d`  
**Escopo:** dependências diretas/transitivas observáveis no lockfile, organização e manutenção do código, duplicação, código sem consumidor, complexidade, tipagem, nulls e tratamento de exceções  
**Fora do escopo:** alteração de código, atualização de pacotes, acesso a produção/bancos/serviços externos e confirmação online de advisories ou abandono de pacotes

## Executive Summary

O repositório contém 26 dependências de runtime, 11 de desenvolvimento e 588 entradas no `package-lock.json` v3. A árvore declarada pôde ser resolvida pelo npm somente a partir do lockfile (`npm ls --package-lock-only --all --offline`, exit 0). Todas as 587 entradas com artefato resolvido possuem `integrity`, não há nome repetido entre `dependencies` e `devDependencies`, e nenhuma entrada traz o campo `deprecated`. Os peers principais observados no lock são compatíveis: Next 16.3.5 admite React 18.3.1, e Vitest 4.1.6 admite Vite 8.2.1. Isso é evidência de coerência estrutural, não de ausência atual de vulnerabilidades ou de manutenção ativa dos pacotes.

O principal defeito confirmado de qualidade é operacional: `InventoryService.restoreStock` captura falhas de reposição e continua normalmente. O cancelamento de pedido aguarda esse método dentro da transação e prossegue para auditoria/estorno de pontos; logo, uma reposição parcial não é representada no contrato do método e pode permitir o cancelamento sem recompor todo o estoque. Também foram observados erros de consulta convertidos em estados vazios, serviços e contratos duplicados, tipagem deliberadamente permissiva, lint fora do CI, ausência de verificação automatizada de dependências, dois blocos de autenticação de cron duplicados, módulos mortos, um ciclo de imports e componentes/casos de uso monolíticos.

Não foram encontrados marcadores `TODO`, `FIXME`, `HACK` ou `XXX` no código examinado. Duplicatas transitivas foram inventariadas, mas não classificadas como defeito por si só: versões múltiplas podem ser exigidas por árvores diferentes. Também não se declarou pacote “abandonado” sem metadados externos verificáveis.

### Resumo por severidade

| Severidade | Quantidade |
|---|---:|
| BLOCKER | 0 |
| CRITICAL | 0 |
| HIGH | 1 |
| MEDIUM | 7 |
| LOW | 3 |
| INFORMATIONAL | 0 |
| **Total** | **11** |

**Bloqueios de publicação:** não há achado classificado como `BLOCKER` ou `CRITICAL`. Entretanto, recomenda-se reter publicação de fluxos que cancelam pedidos até corrigir e testar `CQ-001`, pois o estado `CANCELLED` pode avançar após falha de reposição de estoque. `CQ-005` e `CQ-006` impedem afirmar que lint e advisories atuais são gates efetivos de release.

## 1. Metodologia

1. Leitura de `AGENTS.md`, README técnico, `package.json`, `package-lock.json`, configurações TypeScript/ESLint/Next/Vitest e workflow de CI.
2. Inventário de imports e dependências diretas, resolução do lockfile em modo offline e inspeção de versões, peers, engines, integridade e metadados de depreciação.
3. Varredura estática seguida de leitura manual dos fluxos encontrados para `any`, casts, non-null assertions, suppressões TypeScript, exceções, retornos vazios, marcadores de dívida, reexports depreciados e arquivos sem importadores.
4. Construção de grafo local de imports relativos/`@/` para identificar módulos sem consumidor e componentes fortemente conexos.
5. Medição física de arquivos e contagem heurística de ramos apenas para priorizar leitura. Essas métricas não são tratadas como complexidade ciclomática certificada nem como defeito isolado.
6. Tentativa de lint e typecheck sem instalar dependências. Nenhum banco, endpoint, registry remoto ou serviço externo foi acessado.

### Critério de classificação

- **HIGH:** comportamento confirmado ou altamente confiável capaz de corromper estado comercial ou ocultar falha operacional relevante.
- **MEDIUM:** dívida com caminho concreto para defeito, regressão ou redução material da capacidade de detecção/manutenção.
- **LOW:** desperdício, acoplamento ou problema de reprodutibilidade localizado, sem defeito funcional atual demonstrado.
- Preferência estética, quantidade de linhas isolada e mera ausência de teste não foram convertidas automaticamente em finding.

## 2. Inventário técnico

### 2.1 Dependências

| Item | Evidência observada |
|---|---|
| Dependências de runtime | 26 |
| Dev dependencies | 11 |
| Overrides transitivos | 8 |
| Entradas no lockfile | 588, incluindo a raiz |
| Entradas resolvidas com `integrity` ausente | 0 de 587 |
| Entradas com `deprecated` no lockfile | 0 |
| Sobreposição entre runtime/dev | 0 |
| Árvore offline | `npm ls --package-lock-only --all --offline`, exit 0 |
| Advisory offline | 0 reportado, mas limitado ao cache/metadados locais e não conclusivo |

O lockfile contém versões transitivas múltiplas de 14 nomes, entre eles `@radix-ui/react-slot`, `debug`, `fast-glob`, `minimatch`, `picomatch`, `resolve` e `semver`. Não há evidência local de que essas duplicações causem defeito ou custo material no bundle; não se recomenda deduplicação cega.

Versões centrais resolvidas: Next 16.3.5, React/React DOM 18.3.1, Prisma Client/CLI 5.22.0, TypeScript 5.9.3, ESLint 9.39.5, Vitest 4.1.6 e Vite 8.2.1. Os ranges e peers foram obtidos do lockfile, sem consulta externa.

### 2.2 Código

| Área | Arquivos TS/TSX/JS/MJS | Linhas físicas aproximadas |
|---|---:|---:|
| `app` | 72 | 7.562 |
| `components` | 76 | 13.083 |
| `hooks` | 2 | 631 |
| `lib` | 38 | 2.551 |
| `services` | 29 | 6.164 |
| `store` | 1 | 126 |
| `types` | 7 | 828 |
| `scripts` | 6 | 605 |

Maiores arquivos de produto: `CheckoutForm.tsx` (1.176 linhas), `loyalty.service.ts` (831), `checkout.service.ts` (714), `LoyaltyAdminView.tsx` (668), página de settings admin (611) e `dashboard.service.ts` (588).

A varredura encontrou 77 ocorrências explícitas de `any` em 53 arquivos, cinco casts `as unknown as`, 11 non-null assertions em seis arquivos e nenhuma supressão `@ts-ignore`/`@ts-expect-error`. Várias non-null assertions estão protegidas por condições locais e não constituem defeito por si mesmas.

## 3. Comandos e resultados reproduzíveis

### 3.1 Ambiente e estrutura

```powershell
git rev-parse --short HEAD
node --version
npm --version
Test-Path node_modules
rg --files app components hooks lib services store types scripts
```

Resultado: revisão `0c7ef7d`, Node `v24.16.0`, npm `11.13.0`, `node_modules=False`. As regras locais do Next em `AGENTS.md` foram respeitadas: como `node_modules/next/dist/docs` não existe e nenhum código Next foi alterado, a auditoria limitou-se à leitura e ao relatório.

### 3.2 Lockfile e dependências

```powershell
npm ls --package-lock-only --all --offline
npm audit --package-lock-only --offline --omit=dev --json
```

| Comando | Resultado | Limitação |
|---|---|---|
| `npm ls ... --offline` | exit 0 | valida coerência do grafo declarado, não instalação real |
| `npm audit ... --offline` | exit 0; total local 0 | sem atualização online da base; não prova ausência de advisories atuais e omite dev dependencies |

O JSON do lock também foi analisado localmente para contar dependências, `integrity`, `deprecated`, peers e engines. Nenhum valor de ambiente foi lido ou reproduzido.

### 3.3 Qualidade executável

```powershell
npm run lint
tsc --noEmit
```

| Comando | Resultado |
|---|---|
| `npm run lint` | exit 1 antes da análise; `eslint` não encontrado |
| `tsc --noEmit` | comando não encontrado; typecheck não iniciou |

Dependências não foram instaladas, portanto não há resultado real de lint, typecheck ou build nesta etapa. Os resultados abaixo são estáticos e delimitados como tal.

### 3.4 Varreduras estáticas

```powershell
rg -n '\b(TODO|FIXME|HACK|XXX)\b' app components hooks lib services store types prisma scripts tests
rg -n '@ts-ignore|@ts-expect-error|\bas any\b|: any\b|as unknown as' app components hooks lib services store types
rg -n '@deprecated' lib
rg -n '<img\b' app components
```

Resultado: zero marcadores explícitos de dívida e zero suppressões TypeScript; 77 usos explícitos de `any`; seis shims marcados `@deprecated`; 14 elementos `<img>` alcançados pela regra Next configurada como warning.

## 4. Achados

## CQ-001 — Falhas de reposição de estoque são ignoradas durante o cancelamento

| Campo | Valor |
|---|---|
| Severidade | **HIGH** |
| Confiança | **CONFIRMED** |
| Arquivos e linhas | `services/inventory.service.ts:88-129`, `services/order.service.ts:359-413`, `tests/unit/inventory-lifecycle.test.ts:85-104` |

**Fluxo e condição de manifestação:** cancelamento de pedido `PENDING` ou `PAID`; uma atualização de `Product` ou `ProductVariants` falha durante `restoreStock`, por exemplo porque o registro foi removido, o banco retorna erro transitório ou há inconsistência referencial.

**Evidência observada / fato:** cada `tx.*.update` de reposição possui `try/catch` próprio que apenas chama `console.warn`; `restoreStock` resolve normalmente. `updateOrderStatus` já alterou o pedido para `CANCELLED`, aguarda esse método e continua criando audit log, estornando pontos e retornando da callback transacional. O teste positivo verifica somente chamadas bem-sucedidas e não cobre uma rejeição parcial.

**Hipótese delimitada:** a persistência final depende do tipo de erro e do comportamento da transação Prisma/PostgreSQL; não houve banco nesta auditoria. Mesmo quando o banco aborta a transação por conta própria, o contrato silencioso impede distinguir falha e torna o resultado dependente de detalhe do driver. Para erros que não invalidam a transação, há risco de commit parcial da reposição.

**Impacto:** pedido pode aparecer cancelado e pontos podem ser estornados enquanto produto ou variante permanece com estoque reduzido; a divergência degrada disponibilidade, reconciliação e atendimento.

**Correção proposta:** remover os catches locais ou agregar falhas e lançar erro tipado antes de a callback transacional resolver. Se item histórico puder referir produto removido, modelar explicitamente a política de compensação/reconciliação, com outbox/job idempotente, em vez de sucesso silencioso.

**Teste de regressão:** PostgreSQL descartável; provocar falha no segundo incremento e comprovar rollback de status, estoque, audit log e pontos. Cobrir também produto ausente, variante ausente, retry idempotente e cancelamento repetido.

**Risco residual:** indisponibilidades após commit ainda exigem reconciliação e observabilidade; rollback local não substitui alerta e processo operacional.

## CQ-002 — Falha ao consultar pedidos é apresentada ao cliente como histórico vazio

| Campo | Valor |
|---|---|
| Severidade | **MEDIUM** |
| Confiança | **CONFIRMED** |
| Arquivos e linhas | `services/orders.service.ts:4-65`, `app/profile/page.tsx:16-55` |

**Fluxo e condição de manifestação:** usuário autenticado abre `/profile` durante falha de conexão, timeout, erro de schema ou exceção de mapeamento na consulta de pedidos.

**Evidência observada / fato:** `getUserOrders` captura qualquer exceção, registra em console e retorna `[]`. A página passa esse valor diretamente para `ProfileLayout`; não existe discriminante entre “nenhum pedido” e “consulta falhou”.

**Impacto:** indisponibilidade de infraestrutura é mascarada como estado de negócio válido, induzindo o cliente a acreditar que pedidos desapareceram e reduzindo a capacidade de retry/telemetria da UI.

**Correção proposta:** usar resultado discriminado (`ok/data` ou erro tipado), deixar o boundary da página renderizar estado de erro/retry e registrar correlação sem dados pessoais. Reservar `[]` exclusivamente para consulta bem-sucedida sem registros.

**Teste de regressão:** simular rejeição do repositório e verificar que a página exibe erro recuperável, não empty state; consulta bem-sucedida vazia deve continuar exibindo “sem pedidos”.

**Risco residual:** mesmo com UI correta, falhas intermitentes precisam de tracing e SLO para não depender de relato do usuário.

## CQ-003 — Serviços e contratos paralelos de pedidos mantêm semânticas divergentes

| Campo | Valor |
|---|---|
| Severidade | **MEDIUM** |
| Confiança | **CONFIRMED** |
| Arquivos e linhas | `services/order.service.ts:141-157`, `services/orders.service.ts:1-65`, `types/order.types.ts:12-15`, `types/admin.types.ts:16-23`, `lib/services/order.service.ts:1-5`, `lib/services/customer.service.ts:1-5`, `lib/auth-admin.ts:1-5` |

**Fluxo e condição de manifestação:** manutenção de listagem/transição de pedidos ou migração de imports; um desenvolvedor escolhe entre nomes quase iguais ou usa o DTO homônimo incorreto.

**Evidência observada / fato:** coexistem `order.service.ts` e `orders.service.ts`. Ambos listam pedidos do usuário, porém um recebe objeto, lança em validação e retorna payload Prisma; o outro usa argumentos posicionais, importa tipo da camada `app`, converte Decimals e transforma qualquer erro em `[]`. Há ainda duas definições `UpdateOrderStatusInput`: uma usa `orderID`, outra `orderId` e campos adicionais. Seis shims `@deprecated` permanecem no repositório e 15 imports de código de produto ainda passam por shims de `lib/services` ou `lib/auth-admin`.

**Impacto:** correções de tenant, paginação, seleção, erros ou invariantes podem alcançar um caminho e não o outro; autocomplete/import automático pode selecionar um contrato incompatível. O custo é funcional, não apenas de nomenclatura.

**Correção proposta:** escolher serviço/DTO canônico por caso de uso; migrar consumidores em alterações pequenas e testadas; remover o tipo homônimo obsoleto e os reexports somente após `rg` comprovar zero consumidores. Separar DTO de apresentação do tipo de persistência sem importar de `app` para `services`.

**Teste de regressão:** contract tests para a API e perfil usando a mesma factory; regra de lint/boundary impede imports dos shims; busca/compilação confirma um único `UpdateOrderStatusInput` e uma única política de erro.

**Risco residual:** consolidação ampla pode alterar payloads; manter adapters temporários explícitos e telemetria durante a migração.

## CQ-004 — Configuração TypeScript permissiva e casts reduzem a verificação de fronteiras críticas

| Campo | Valor |
|---|---|
| Severidade | **MEDIUM** |
| Confiança | **CONFIRMED** |
| Arquivos e linhas | `tsconfig.json:8-10`, `components/checkout/CheckoutForm.tsx:179-188,387-450`, `app/checkout/page.tsx:12-18,91-92,196-201`, `services/asaas/asaas.adapter.ts:140-198,337-338`, `services/order.service.ts:108,138,157` |

**Fluxo e condição de manifestação:** alteração de DTO de checkout/gateway/Prisma ou retorno nulo inesperado; `any`, casts duplos ou strict null checks desabilitados deixam a divergência compilar.

**Evidência observada / fato:** `strict` está `false`, `allowJs` está ativo e `skipLibCheck` ignora tipos de dependências. Foram contados 77 usos explícitos de `any` em 53 arquivos e cinco `as unknown as`; exemplos estão em payloads Asaas, estado/payload do checkout e coerção de resultados Prisma para contratos mais amplos. Não há `@ts-ignore`, o que é um controle positivo.

**Hipótese delimitada:** nenhuma falha de runtime específica é declarada somente por esses casts. O risco é que mudanças incompatíveis deixem de gerar erro de compilação justamente nas fronteiras mais mutáveis.

**Impacto:** maior probabilidade de `undefined`, payload divergente e acesso a propriedade inexistente sobreviverem ao typecheck; refatorações perdem feedback estático.

**Correção proposta:** tipar primeiro DTOs externos e estados de checkout; substituir `catch (...: any)` por `unknown` com narrowing; derivar retornos Prisma das queries reais. Ativar flags estritas incrementalmente por módulos ou configuração secundária, sem um big-bang que esconda regressões em centenas de ajustes.

**Teste de regressão:** testes de tipo com payloads inválidos e `tsc` em modo estrito para módulos migrados; garantir que remoção/renomeação de campo em DTO falhe no consumidor.

**Risco residual:** tipos não validam JSON/runtime; preservar Zod/validação nas fronteiras mesmo após strict mode.

## CQ-005 — Lint configurado não participa do CI e warnings não são gate

| Campo | Valor |
|---|---|
| Severidade | **MEDIUM** |
| Confiança | **CONFIRMED** |
| Arquivos e linhas | `package.json:5-15`, `.github/workflows/ci.yml:29-42`, `eslint.config.mjs:4-20`, `components/MobileMenu.tsx:64`, `components/home/HomeClient.tsx:206-240`, `components/checkout/CheckoutForm.tsx:1028` |

**Fluxo e condição de manifestação:** pull request introduz violação das regras Next/React ou warning; pipeline executa typecheck, unit tests e build, mas não lint.

**Evidência observada / fato:** existe script `lint`, porém o workflow não o chama. Três regras são rebaixadas para `warn` e `react-hooks/set-state-in-effect` é desligada; o script não usa `--max-warnings=0`. Há 14 ocorrências de `<img>` que correspondem a uma das regras configuradas como warning. O lint local não iniciou nesta auditoria porque `eslint` não está instalado.

**Impacto:** o rótulo “Quality Gates” não representa um gate de lint; regressões detectáveis podem ser mescladas silenciosamente, e warnings acumulam até perder sinal.

**Correção proposta:** adicionar `npm run lint -- --max-warnings=0` ao CI ou definir política explícita de budget; justificar exceções localmente e com comentário. Reavaliar regra de effects após medir os casos, sem ativação massiva não testada.

**Teste de regressão:** fixture/branch de CI com violação controlada deve falhar; código limpo deve passar em Node/npm pinados.

**Risco residual:** lint não detecta invariantes comerciais; manter typecheck, testes e revisão de arquitetura separados.

## CQ-006 — Pipeline não verifica advisories ou política de dependências

| Campo | Valor |
|---|---|
| Severidade | **MEDIUM** |
| Confiança | **CONFIRMED** |
| Arquivos e linhas | `.github/workflows/ci.yml:19-42`, `package.json:17-66`, `package-lock.json:1-50` |

**Fluxo e condição de manifestação:** nova versão transitiva vulnerável, pacote comprometido ou advisory publicado após o último lock; o CI executa `npm ci` e segue sem etapa de revisão/audit/SBOM.

**Evidência observada / fato:** só há um workflow e ele não contém `npm audit`, dependency review, Renovate/Dependabot, OSV, política de licença ou geração de SBOM. O audit estritamente offline retornou zero, mas sua base não foi atualizada e dev dependencies foram omitidas; isso não é evidência atual suficiente.

**Hipótese delimitada:** não foi confirmada vulnerabilidade em nenhuma versão. Ausência de gate é risco de detecção, não prova de pacote inseguro.

**Impacto:** advisories e mudanças transitivas podem ser percebidos apenas manualmente; os oito overrides podem permanecer sem justificativa/revisão de remoção.

**Correção proposta:** adotar revisão de dependências em PR e job agendado com fonte autorizada, política de severidade/exceção com prazo, SBOM e revisão explícita dos overrides. Não atualizar majors automaticamente; abrir mudanças isoladas com testes.

**Teste de regressão:** validar workflow com relatório fixture/mocado contendo advisory acima do limiar e exceção válida/expirada; confirmar que PR de lockfile apresenta delta legível.

**Risco residual:** scanners têm falso positivo/negativo e não detectam pacote malicioso sem advisory; combinar provenance, revisão e mínimo privilégio.

## CQ-007 — Checkout e serviços centrais concentram centenas de linhas e múltiplas responsabilidades

| Campo | Valor |
|---|---|
| Severidade | **MEDIUM** |
| Confiança | **CONFIRMED** |
| Arquivos e linhas | `components/checkout/CheckoutForm.tsx:81-1176`, `services/checkout.service.ts:110-713`, `services/loyalty.service.ts:1-831`, `components/admin/loyalty/LoyaltyAdminView.tsx:54-668` |

**Fluxo e condição de manifestação:** mudança em formulário, frete, cartão, pontos, cálculo ou cobrança exige editar os mesmos módulos extensos e compartilhar muitos estados/branches.

**Evidência observada / fato:** `CheckoutForm` reúne estado de três etapas, formatação/validação, consulta de CEP, cálculo de frete, parcelas, cartão, pontos, construção de payload e mais de 700 linhas de JSX. `createOrder` ocupa aproximadamente 600 linhas e mistura validação, identidade, estoque, pontos, persistência, gateway e compensação. A varredura heurística contou 43 tokens de ramo no componente e 38 no serviço; isso serve só como sinal de leitura, não como métrica formal.

**Hipótese delimitada:** tamanho não prova defeito. A severidade decorre da centralidade comercial e da quantidade de razões independentes para mudança no mesmo escopo.

**Impacto:** reviews maiores, maior chance de conflito e regressão lateral, testes unitários mais difíceis e tentação de usar `any`/mocks amplos.

**Correção proposta:** extrair por responsabilidade observável: schema/estado do formulário, adaptador de CEP/frete, cartão/parcelas, comando transacional de criação e adapter de cobrança. Manter uma orquestração explícita e evitar fragmentação puramente visual sem redução de acoplamento.

**Teste de regressão:** characterization tests antes de cada extração; contratos do comando de checkout e componentes por etapa; mutações em frete/cartão não devem afetar regras de estoque/pontos.

**Risco residual:** refatoração de fluxo crítico pode introduzir regressões; executar incrementalmente após fortalecer integração/E2E.

## CQ-008 — Módulos sem consumidores mantêm dependências diretas sem uso alcançável

| Campo | Valor |
|---|---|
| Severidade | **LOW** |
| Confiança | **HIGH CONFIDENCE** |
| Arquivos e linhas | `package.json:20-29`, `components/catalog/CatalogFilterBar.tsx:1-97`, `components/ui/separator.tsx:1-32`, `components/ui/input.tsx:1-25`, `components/ui/textarea.tsx:1-23`, `lib/supabase/server.ts:1-40` |

**Fluxo e condição de manifestação:** instalação/build/manutenção inclui módulos que não são importados por nenhuma entrada ou módulo local atual.

**Evidência observada / fato:** o grafo estático de imports relativos e `@/` não encontrou consumidores para os cinco arquivos citados. `@radix-ui/react-separator` só aparece no componente `separator` sem consumidor; `@supabase/ssr` só aparece no helper server sem consumidor. Os demais componentes mortos não implicam dependência externa exclusiva.

**Hipótese delimitada:** imports construídos dinamicamente fora dos padrões analisados poderiam escapar; não foi encontrado texto que os referencie, e `lib`/`components` não são entrypoints automáticos do Next.

**Impacto:** superfície de atualização/scan e ruído arquitetural desnecessários; novos desenvolvedores podem evoluir um componente que não é o usado pela aplicação.

**Correção proposta:** confirmar com build/coverage e intenção de roadmap; remover arquivo e dependência em PR isolado ou documentar consumidor planejado com owner/prazo. Não remover pacotes apenas por contagem textual quando usados por CLI/configuração.

**Teste de regressão:** build e smoke visual após remoção; busca de import zero e lockfile regenerado por `npm install` controlado.

**Risco residual:** caminhos raros ou integração ainda não versionada podem depender desses módulos; confirmação do responsável é necessária.

## CQ-009 — Provider e drawer do carrinho formam ciclo de módulos

| Campo | Valor |
|---|---|
| Severidade | **LOW** |
| Confiança | **CONFIRMED** |
| Arquivos e linhas | `components/providers/CartProvider.tsx:3-34`, `components/cart/CartDrawer.tsx:3-15` |

**Fluxo e condição de manifestação:** carregamento/splitting do carrinho: o provider importa dinamicamente o drawer, enquanto o drawer importa estaticamente `useCart` do provider.

**Evidência observada / fato:** o grafo local possui um componente fortemente conexo de dois nós. O dynamic import reduz inicialização imediata, mas não elimina a dependência circular conceitual.

**Hipótese delimitada:** não foi observada falha de inicialização ou bundle; o build não estava disponível.

**Impacto:** testes/mocks e extração de bundle ficam mais frágeis; futura alteração de export inicializado no topo pode transformar o ciclo tolerado em valor parcialmente inicializado.

**Correção proposta:** mover `CartContext`/`useCart` para módulo independente; provider e drawer dependem desse contrato, sem depender um do outro em ambas as direções.

**Teste de regressão:** teste de render com provider/drawer e build de produção; verificação automatizada do grafo deve permanecer sem ciclos.

**Risco residual:** stores e componentes ainda podem formar ciclos indiretos; executar o detector no CI se o problema reaparecer.

## CQ-010 — Autenticação de cron está duplicada em dois handlers

| Campo | Valor |
|---|---|
| Severidade | **MEDIUM** |
| Confiança | **CONFIRMED** |
| Arquivos e linhas | `app/api/cron/orders-timeout/route.ts:6-64`, `app/api/cron/loyalty-expiration/route.ts:6-64` |

**Fluxo e condição de manifestação:** correção de parsing, comparação timing-safe, logging ou resposta de autenticação é aplicada a apenas um cron.

**Evidência observada / fato:** ambos os arquivos repetem `validateCronAuth` quase integralmente, incluindo leitura de dois headers, buffers, comparação e respostas. O diff varia essencialmente na mensagem de log dentro desse bloco.

**Impacto:** controle de segurança e contrato HTTP podem divergir silenciosamente; cada novo cron tende a copiar a terceira versão.

**Correção proposta:** extrair helper server-only que receba contexto de log, mantendo mensagens e códigos padronizados. A refatoração é justificada pela natureza de autorização, não apenas por estética/DRY.

**Teste de regressão:** tabela compartilhada contra token ausente, header alternativo, tamanho diferente, valor inválido e válido aplicada aos dois handlers; alteração no helper deve afetar ambos.

**Risco residual:** um handler ainda pode omitir a chamada; adicionar wrapper/middleware e teste de matriz de rotas.

## CQ-011 — Versões de Node/npm não são pinadas de forma reproduzível

| Campo | Valor |
|---|---|
| Severidade | **LOW** |
| Confiança | **CONFIRMED** |
| Arquivos e linhas | `package.json:1-68`, `.github/workflows/ci.yml:23-30`, `package-lock.json:6727-6745,8743-8761,8834-8867` |

**Fluxo e condição de manifestação:** desenvolvedor ou runner usa patch/minor diferente de Node/npm; resolução, lockfile, TypeScript ou Vite se comporta de forma divergente.

**Evidência observada / fato:** `package.json` não declara `engines` nem `packageManager`; não existem `.nvmrc`, `.node-version` ou `.tool-versions`. O CI fixa apenas o major Node 20, enquanto a auditoria roda Node 24/npm 11. O lock exige Node >=20.9 para Next e ^20.19 ou >=22.12 para Vite.

**Impacto:** reprodução local/CI menos determinística e mensagens diferentes em instalação/build, especialmente após atualização do patch fornecido por `setup-node` ou npm global.

**Correção proposta:** declarar versão mínima/linha suportada em `engines`, fixar `packageManager` e fornecer arquivo de runtime alinhado ao CI; escolher versão que satisfaça Next/Vite e validar matriz adicional apenas se houver necessidade real.

**Teste de regressão:** job imprime/valida versões antes de `npm ci`; instalação e build em ambiente limpo usando exatamente o runtime documentado.

**Risco residual:** binários nativos e SO ainda variam; manter CI Linux como referência e testar plataforma adicional apenas quando suportada.

## 5. Controles positivos observados

- `package-lock.json` v3 está versionado, é parseável e possui `integrity` para todas as entradas com `resolved`.
- `npm ls --package-lock-only --all --offline` concluiu com sucesso; peers opcionais ausentes não foram tratados como erro.
- Next/React e Vitest/Vite resolvidos atendem aos ranges de peer registrados no lock.
- Não há pacote declarado simultaneamente em runtime e desenvolvimento.
- Não há suppressões TypeScript (`@ts-ignore`/`@ts-expect-error`) no código analisado.
- Não foram encontrados marcadores explícitos `TODO`/`FIXME`/`HACK`/`XXX`.
- Há DTO sanitizer, erros tipados em partes do domínio e schemas Zod em várias fronteiras; os achados não anulam esses controles.

## 6. Dívida priorizada

### P0 — antes de publicar cancelamento/estorno

1. Fazer falha de reposição abortar ou acionar compensação verificável (`CQ-001`).
2. Adicionar regressão PostgreSQL para rollback e reposição parcial.

### P1 — gates e contratos críticos

1. Distinguir falha de consulta de histórico de resultado vazio (`CQ-002`).
2. Consolidar serviços/DTOs de pedido e imports depreciados (`CQ-003`).
3. Tipar fronteiras de checkout/gateway antes de ativar strict incremental (`CQ-004`).
4. Colocar lint no CI e estabelecer política de warnings (`CQ-005`).
5. Implantar revisão atualizada de dependências com triagem (`CQ-006`).

### P2 — manutenção incremental

1. Decompor checkout/pontos por responsabilidade e characterization tests (`CQ-007`).
2. Remover ou justificar módulos/dependências sem consumidor (`CQ-008`).
3. Quebrar ciclo CartProvider/CartDrawer (`CQ-009`).
4. Unificar autenticação de cron (`CQ-010`).
5. Pinar toolchain (`CQ-011`).

## 7. Verificações pendentes / Not Verified

1. Executar `npm ci` em ambiente autorizado e confirmar que o lock instala sem mudança.
2. Executar `npm run lint`, `npx tsc --noEmit`, testes e build; nenhum deles foi validado com dependências instaladas nesta etapa.
3. Consultar advisories atuais em fonte autorizada; o resultado offline zero não é conclusivo.
4. Verificar pacotes abandonados, cadência de manutenção, provenance e política de licença com metadados atuais.
5. Medir bundle para quantificar custo real de duplicatas/dependências; nenhuma remoção deve se basear só em busca textual.
6. Confirmar dead code com build/coverage e responsáveis de roadmap.
7. Executar teste PostgreSQL real do cenário de falha parcial de `restoreStock`.
8. Executar detector de ciclos com parser TypeScript completo para imports dinâmicos/aliases não reconhecidos pela heurística.
9. Medir complexidade com ferramenta configurada e baseline; contagens desta auditoria são heurísticas.
10. Comparar comportamento sob Node 20 suportado e toolchain pinada; Node local era 24.

## 8. Itens não aplicáveis e justificativas

- **Atualização automática de majors:** não aplicável/proibida nesta fase; nenhuma versão ou lockfile foi alterado.
- **Declaração de pacote abandonado:** não verificável localmente. O lock não marca entradas como depreciadas, mas isso não comprova manutenção ativa.
- **Vulnerabilidade confirmada de dependência:** não aplicável com a evidência disponível; zero offline não autoriza afirmar segurança universal.
- **Duplicação transitiva como finding automático:** não aplicável; versões múltiplas podem ser legítimas e precisam de impacto medido.
- **TODO/FIXME como dívida:** nenhum marcador foi encontrado; comentários descritivos contendo palavras comuns não foram confundidos com marcadores.
- **Credenciais e logs de dados pessoais em scripts:** já tratados no escopo de segurança (`SEC-004` e achados correlatos); valores foram omitidos aqui para evitar duplicação e exposição.
- **Preferências de formatação/nomenclatura:** não foram relatadas sem risco concreto de defeito ou manutenção.

## 9. Riscos residuais

- Análise estática não observa caminhos gerados, plugins, import dinâmico arbitrário nem comportamento real do bundler.
- Ausência de `node_modules` impediu validar diagnósticos efetivos de ESLint/TypeScript e documentação local do Next 16.
- Advisory offline pode estar desatualizado; vulnerabilidades sem advisory ou supply-chain não aparecem.
- Consolidação de serviços e ativação de strict podem revelar defeitos hoje mascarados; isso deve ser tratado como ganho de sinal, com mudanças pequenas.
- Reduzir tamanho de arquivo sem reduzir responsabilidades pode apenas espalhar complexidade; refatorações precisam de contratos e testes.
- Logs/telemetria e políticas operacionais fora do repositório não foram observados.

## 10. Conclusão limitada ao escopo

Foram registrados 11 achados: 1 HIGH, 7 MEDIUM e 3 LOW. O lockfile apresenta controles básicos positivos e não houve incompatibilidade principal confirmada no grafo declarado. A maior prioridade não é atualização indiscriminada de versões, mas corrigir o erro ignorado na reposição de estoque, tornar os gates realmente executáveis e reduzir divergência entre serviços/contratos comerciais.

Nenhuma vulnerabilidade de pacote foi declarada a partir de ausência de evidência; nenhuma atualização, instalação, chamada externa ou alteração de produto foi realizada. Apenas este relatório foi criado. A auditoria termina na etapa 10 e não avança automaticamente.


---

## Revalidação de 2026-09-29 — etapa 10/15

O conteúdo anterior é histórico e foi preservado. Esta seção avalia o código local atual, incluindo mudanças sem commit, após as correções registradas em docs/remediation. Base: HEAD 0c7ef7ddfa5fb4520c4bc794163cbc71257c2bc4. O responsável autorizou continuar as etapas sem pausas. Somente relatórios são alterados.

### Resultado

Corrigido: **6**; Persistente: **2**; Parcialmente corrigido: **2**; Não verificado: **1**. Pendências confirmadas/parciais por risco residual: MEDIUM 3, LOW 1. Itens não verificados ficam separados de defeitos confirmados.

Corrigido refere-se ao defeito original no recorte verificado; não certifica toda a funcionalidade ou serviços externos. Confiança CONFIRMED identifica código observado e/ou teste executado, conforme a evidência; não transforma inspeção em teste dinâmico. Severidade original é preservada, e risco residual não deve ser somado entre relatórios sem deduplicação.

### Matriz dos achados

| ID | Severidade original | Estado | Risco residual | Confiança | Evidência atual, fluxo e impacto | Encerramento / regressão / limite |
|---|---|---|---|---|---|---|
| CQ-001 | HIGH | Corrigido | LOW | CONFIRMED | `services/inventory.service.ts:88-129`; `services/order.service.ts:435-505`; teste real de rollback de estoque passou. | Falha de reposição aborta a transação; manter teste com falha após primeiro incremento. |
| CQ-002 | MEDIUM | Corrigido | LOW | CONFIRMED | `services/order.service.ts:683-685,728-730` lança ORDER_HISTORY_UNAVAILABLE; `app/profile/error.tsx:1` oferece recuperação; testes de histórico passaram. | Falha não se apresenta mais como histórico vazio; visualização do boundary pendente em browser. |
| CQ-003 | MEDIUM | Corrigido | LOW | CONFIRMED | Serviço duplicado `services/orders.service.ts` removido; `types/admin.types.ts:16` é contrato canônico; `tests/unit/architecture-boundaries.test.ts` passou. | Aliases antigos foram retirados; não exige reescrever todas as camadas. |
| CQ-004 | MEDIUM | Persistente | MEDIUM | CONFIRMED | `tsconfig.json:10` mantém strict false; fronteiras ainda usam casts em checkout/adapters. | Adotar strict incremental e contratos runtime; não é prova isolada de bug financeiro. |
| CQ-005 | MEDIUM | Parcialmente corrigido | MEDIUM | CONFIRMED | `package.json:14` permite até 16 warnings; CI executa lint; execução etapa 01: 0 erros/15 warnings. | Gate presente, dívida de warnings permanece; reduzir com prova funcional, sem silenciar regras. |
| CQ-006 | MEDIUM | Corrigido | LOW | CONFIRMED | `.github/workflows/ci.yml:81-82` audita dependências de produção; `.github/dependabot.yml:1` versionado. | Corrigida ausência do gate. Advisories atuais e manutenção externa não verificados; resultados offline/históricos não certificam segurança atual. |
| CQ-007 | MEDIUM | Persistente | MEDIUM | CONFIRMED | `components/checkout/CheckoutForm.tsx:81`; `services/checkout.service.ts:110`; `services/loyalty.service.ts:1`: coordenação de UI/pagamento/regras ainda extensa. | Extrair responsabilidades por fluxo após provas comportamentais; extensão por si só não prova defeito. |
| CQ-008 | LOW | Não verificado | LOW | NOT VERIFIED | `components/catalog/CatalogFilterBar.tsx:1`, `components/ui/input.tsx:1`, `textarea.tsx:1`, `separator.tsx:1`, `lib/supabase/server.ts:1` aparentam não ter consumidor em busca estática. | Confirmar grafo e uso planejado antes de remover dependências; nenhum pacote foi removido. |
| CQ-009 | LOW | Corrigido | LOW | CONFIRMED | `components/providers/CartProvider.tsx:5`; `components/cart/CartDrawer.tsx:8` importam cart-context; teste arquitetural passou. | Quebrado ciclo provider/drawer; lazy load preservado. |
| CQ-010 | MEDIUM | Corrigido | LOW | CONFIRMED | `lib/cron-auth.ts:9`; três handlers cron importam o mesmo guard; testes de tokens ausentes/inválidos/válidos passaram. | Autenticação centralizada; agenda externa tratada na etapa 11. |
| CQ-011 | LOW | Parcialmente corrigido | LOW | CONFIRMED | `package.json:5-8`, `.nvmrc:1`, Dockerfile e CI fixam Node22/npm10; ambiente usado nesta auditoria é Node24.16/npm11.13. | Pinning corrigido no repositório, execução local diverge. Repetir gates no runtime declarado antes da release. |

### Confronto e validação
Revisados os registros de `docs/remediation/CODE-QUALITY-FIXES.md:13-35` e os consumidores atuais. A redução de 16 para 15 warnings é evidência da etapa 01, não nova correção feita aqui. Foram reaproveitados typecheck/lint dessa mesma base e a execução atual de **613 unitários/26 integrações**; não foram instaladas dependências ou executados audit fix/build/registry.

O checker estático `node scripts/check-env-contract.mjs` falhou: falta documentar o nome `ALLOW_ASAAS_SANDBOX_WRITE`, usado em `scripts/validate-asaas-refund-sandbox.mjs:6`. Registrado como regressão em INF-010; não confundir com lint ou typecheck aprovados. O script de sandbox não foi executado.

### Risco e prioridades
Priorizar contratos, falhas observáveis e decomposição dos fluxos financeiros sobre alterações cosméticas. Não se inferiu vulnerabilidade apenas de TODO, tamanho, casts ou dependência sem uso aparente. A varredura de segredos local passou dentro do escopo do scanner; versões/advisories externos permanecem sem revalidação. Build e browser ficam pendentes para ambiente isolado no runtime pinado.
