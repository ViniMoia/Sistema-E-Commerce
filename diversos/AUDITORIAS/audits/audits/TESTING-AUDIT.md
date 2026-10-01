# Auditoria de Testes e Qualidade — Etapa 09/15

**Relatório:** `docs/audits/TESTING-AUDIT.md`  
**Data:** 2026-09-26  
**Revisão analisada:** `0c7ef7d`  
**Escopo:** testes unitários, integração, contrato, E2E, segurança, regressão e gates locais/CI  
**Fora do escopo:** correção do produto ou do harness, uso de produção/dados reais, chamadas a serviços externos e execução destrutiva de banco

## Executive Summary

O repositório possui uma base unitária numerosa e orientada a domínios relevantes: foram encontrados 53 arquivos de teste e aproximadamente 403 casos declarados estaticamente, sendo 49 arquivos/365 casos em `tests/unit`, 3/33 em `tests/integration` e 1/5 em `tests/load`. Há testes úteis para validação CPF/CNPJ, precisão decimal, transições de pedido, isolamento por tenant, webhooks, pontos, estoque, rate limit, recuperação de senha e DTOs. Não foram encontrados `.skip`, `.todo` ou `.only`.

Essa contagem, contudo, não equivale a cobertura executada. Nenhum teste pôde iniciar neste ambiente porque `node_modules` não existe. Além disso, a análise estática encontrou defeitos determinísticos no harness de integração/carga: o seed referencia uma loja que não cria, dois seeds reutilizam números de pedido globalmente únicos, a suíte de transições envia `toStatus` enquanto a rota exige `newStatus`, mutações são chamadas sem body e o teste de carga cria 100 e-mails iguais por lote. O script de integração tampouco inicia o servidor Next ou um PostgreSQL.

O CI executa apenas `npm test`, que aponta para `tests/unit`; não provisiona PostgreSQL e não chama integração/carga. Testes com nomes de concorrência/atomicidade usam Prisma simulado e implementam a exclusão no próprio mock, portanto não comprovam locks, isolamento, rollback ou constraints. Não há runner E2E, ambiente de browser/componente, teste `.tsx`, cobertura com limiar ou fluxo completo de compra.

Há ainda um risco operacional crítico no cleanup: a proteção valida `TEST_DATABASE_URL` quando presente, mas o `PrismaClient` usado pela limpeza continua configurado por `DATABASE_URL`; além disso, a proteção aceita qualquer URL contendo a substring `test`. A limpeza usa `deleteMany({})` sobre tabelas inteiras e não isola dados por run. Esses testes não foram executados nesta auditoria.

### Resumo por severidade

| Severidade | Quantidade |
|---|---:|
| BLOCKER | 0 |
| CRITICAL | 1 |
| HIGH | 4 |
| MEDIUM | 5 |
| LOW | 0 |
| INFORMATIONAL | 0 |
| **Total** | **10** |

**Bloqueios de publicação:** `TST-005` é crítico: o banco validado pelo guard pode não ser o banco efetivamente usado pelo Prisma antes de deleções globais. Não execute integração/carga até tornar esse vínculo inequívoco e fail-closed. `TST-001` e `TST-002` também bloqueiam o uso confiável dessas suítes como critério de release; `TST-003` e `TST-004` deixam sem comprovação real os principais riscos transacionais e a jornada completa do usuário.

## 1. Metodologia

1. Leitura das instruções do repositório, documentação técnica até antes da seção de credenciais, manifestos, configuração Vitest/TypeScript, workflow de CI e schema Prisma.
2. Inventário de todos os arquivos `*.test.ts`/`*.test.tsx`, helpers, setup e factories.
3. Contagem estática de `it`/`test`, `describe`, mocks, skips e dependências de browser. A contagem é aproximada até confirmação pelo runner.
4. Construção de matriz feature × unitário/integração/E2E/negativo com base no comportamento efetivamente atravessado, não apenas no nome do teste.
5. Rastreamento de testes críticos até rotas, schemas e constraints reais para detectar contratos obsoletos e mocks que reproduzem a expectativa.
6. Tentativa dos comandos versionados de unit, integração, carga, lint e build. Nenhuma instalação foi feita e nenhum serviço externo foi acessado.
7. Separação entre fato observado, hipótese e item não verificado. Ausência de teste é tratada como lacuna de garantia, não como vulnerabilidade comprovada.

### Critério de classificação

- **HIGH:** gate inoperante, risco de perda de dados no harness ou ausência de verificação real em fluxo comercial crítico.
- **MEDIUM:** falsa confiança localizada, teste frágil ou lacuna importante que reduz detecção de regressões.
- **LOW/INFORMATIONAL:** melhoria incremental sem impacto relevante no gate atual.

## 2. Inventário de testes

### 2.1 Estrutura encontrada

| Categoria | Arquivos | Casos estáticos | Observação |
|---|---:|---:|---|
| Unitários | 49 | 365 | 27 arquivos usam `vi.mock`; 14 importam route handlers diretamente |
| Integração | 3 | 33 | Misturam HTTP a servidor externo ao runner e acesso direto ao banco |
| Carga | 1 | 5 | Requer servidor e banco; fixture contém colisão determinística |
| E2E/browser | 0 | 0 | Nenhum Playwright/Cypress configurado diretamente |
| Componentes React | 0 | 0 | Nenhum `.test.tsx`; ambiente Vitest é `node` |
| Contrato dedicado | 0 | 0 | Existem fixtures/mocks Asaas, mas não uma suíte consumer/provider separada |
| Segurança dedicada | 0 | 0 | Cenários de segurança estão distribuídos em unit/integration |
| Snapshots | 0 | 0 | Não aplicável como problema por si só |
| **Total** | **53** | **403** | Quantidade não executada nesta auditoria |

### 2.2 Configuração observada

- `vitest.config.ts:4-10`: ambiente `node`, include apenas `tests/**/*.test.ts`, timeout/hook de 30 s.
- `package.json:10-14`: `npm test` e `test:unit` executam somente `tests/unit`; integração, carga e all são scripts separados.
- `.github/workflows/ci.yml:29-42`: instala, valida Prisma, typecheck, unit e build; não há PostgreSQL, migrations, servidor, integração, carga, E2E ou cobertura.
- `tsconfig.json:8-10`: `skipLibCheck: true` e `strict: false`.
- Não há configuração de coverage/threshold no Vitest, script de coverage ou dependência direta de runner E2E.

## 3. Matriz feature × nível de teste

Legenda: **C** = cobertura comportamental relevante; **P** = parcial ou fortemente mockada; **I** = intenção presente, mas harness/contrato inviabiliza a execução; **—** = ausente; **N/A** = recurso não encontrado.

| Feature | Unit | Integration | E2E | Negativos | Evidência e limite |
|---|---|---|---|---|---|
| Cadastro | P | — | — | C | Schemas CPF/CNPJ e registro em `validators.test.ts`/`cpf-cnpj-persistence.test.ts`; não chama a rota completa nem persiste usuário real |
| Login | P | — | — | P | Rate limit/IP é testado; não há autenticação real sucesso/erro/cookie/logout |
| Catálogo | P | — | — | C | Paginação e regex; parte da lógica é reimplementada no teste e não há render/fetch real |
| Carrinho | P | — | — | C | Serviço com Prisma mockado cobre estoque e tenant; sem sessão/API/UI/banco |
| Checkout | P | — | — | C | Autoridade de preço, CPF, tenant e idempotência simulados; sem commit/rollback real |
| Pedido | C/P | I | — | C/I | FSM pura é útil; integração HTTP/DB pretendida está quebrada por contrato/fixture |
| Estoque | P | — | — | P | Increment/decrement e rejeições sobre mocks; sem corrida pela última unidade |
| Pagamento | P | — | — | C/P | Adapter/webhook com mocks e payloads; sem contrato de sandbox ou persistência real |
| Pontos/cashback | C/P | — | — | C/P | Cálculos puros fortes; ledger, isolamento e concorrência usam Prisma simulado |
| Cupons | N/A | N/A | N/A | N/A | Não foi encontrado módulo/modelo/rota de cupom no repositório |
| Admin | P | I | — | C/I | Guards/tenant por mock; matriz HTTP real existe, mas não é executável no estado atual |
| Recuperação de senha | P | — | — | C | Serviço/route handler com Prisma/e-mail mockados; sem browser e entrega real |
| Perfil/endereços | P | — | — | C | Route handlers com mocks; sem fluxo A/B real por HTTP e banco |

### Leitura da matriz

- “C” em unitário significa que a unidade observável é realmente importada e testada; não implica integração.
- As células “I” não foram contadas como cobertura efetiva.
- O módulo de cupons é explicitamente não aplicável, não uma falha comprovada.
- A ausência de E2E reduz confiança na integração entre frontend, API, cookies, tenant e persistência; não prova que esses fluxos estejam quebrados.

## 4. Comandos e resultados reproduzíveis

### 4.1 Inventário estático

```powershell
rg --files tests | Sort-Object
Get-ChildItem tests -Recurse -File -Include *.test.ts,*.test.tsx
rg -n '\b(it|test)\s*\(' tests --glob '*.test.ts'
rg -n '\.(skip|todo|only)\s*\(' tests --glob '*.test.ts'
rg -n '@testing-library|playwright|cypress|supertest|jsdom|happy-dom' package.json vitest.config.ts tests
```

Resultado: 53 arquivos, aproximadamente 403 casos; zero `.test.tsx`; nenhum skip/todo/only; nenhum runner/browser de teste configurado diretamente.

### 4.2 Ambiente

```powershell
git rev-parse --short HEAD
node --version
npm --version
Test-Path node_modules
Test-Path node_modules/next/dist/docs
```

Resultado: revisão `0c7ef7d`, Node `v24.16.0`, npm `11.13.0`, `node_modules=False`, docs locais do Next indisponíveis. A regra do `AGENTS.md` sobre documentação do Next foi respeitada não alterando código Next; somente este relatório foi criado.

### 4.3 Execuções tentadas

```powershell
npm run test:unit
npm run test:integration
npm run test:load
npm run lint
npm run build
```

| Comando | Resultado | Interpretação correta |
|---|---|---|
| `npm run test:unit` | exit 1; `vitest` não reconhecido | suíte não iniciou; 0 testes verificados |
| `npm run test:integration` | exit 1; `vitest` não reconhecido | suíte não iniciou; banco/servidor não tocados |
| `npm run test:load` | exit 1; `vitest` não reconhecido | carga não iniciou |
| `npm run lint` | exit 1; `eslint` não reconhecido | lint não executado |
| `npm run build` | exit 1; `prisma` não reconhecido | geração/build não iniciados |

Nenhuma dependência foi instalada, nenhum `.env` foi lido, nenhum banco foi conectado e nenhum endpoint externo foi chamado.

## 5. Achados

## TST-001 — CI promove somente a suíte unitária e não valida banco/API/E2E

| Campo | Valor |
|---|---|
| Severidade | **HIGH** |
| Confiança | **CONFIRMED** |
| Arquivos e linhas | `package.json:5-15`, `.github/workflows/ci.yml:9-42`, `vitest.config.ts:4-10` |

**Fluxo e condição de manifestação:** qualquer push/PR nas branches configuradas. O job verde depende de typecheck, unit e build, mesmo que integração, carga ou jornada de compra estejam quebradas.

**Evidência observada / fato:** `npm test` executa `vitest run tests/unit`; o CI chama somente `npm test`. Não há service container PostgreSQL, aplicação iniciada, migration, chamada a `test:integration`, `test:load`, cobertura ou E2E.

**Hipótese:** um CI remoto pode atualmente ficar verde apesar de divergência entre schema/queries/handlers e banco ou entre UI e API. O estado real do último CI não foi consultado.

**Impacto:** regressões transacionais, de autorização HTTP, constraints, serialização e fluxos completos não bloqueiam merge/publicação.

**Correção proposta:** criar jobs separados: unitário; integração com PostgreSQL descartável + migrations + isolamento; build; E2E com servidor de produção e browser. Manter carga fora de todo PR, mas em job manual/agendado controlado. Falhar release se unit/integration/E2E smoke não passarem.

**Teste de regressão:** introduzir mutação de contrato em ambiente de teste e confirmar que o job apropriado falha; validar que banco/servidor sobem do zero e são encerrados mesmo em erro.

**Risco residual:** CI não reproduz serviços gerenciados/latência de produção; complementar com homologação e monitoramento.

## TST-002 — Suítes de integração/carga têm contratos e fixtures deterministicamente inconsistentes

| Campo | Valor |
|---|---|
| Severidade | **HIGH** |
| Confiança | **CONFIRMED** |
| Arquivos e linhas | `tests/setup/db.ts:42-60,70-145`, `prisma/schema.prisma:63-80,264-266,332-337`, `tests/integration/route-protection.test.ts:22-40,47-65,118-130`, `tests/integration/status-transitions.test.ts:24-40`, `lib/validators/order.validators.ts:15-20`, `tests/load/customer-load.test.ts:21-33` |

**Fluxo e condição de manifestação:** tentativa de rodar `test:integration` ou `test:load` com banco vazio e servidor local.

**Evidência observada / fatos independentes:**

1. `seedTestData(lojaID)` cria `User` com `lojaID`, mas não cria a `Loja`; essa relação é obrigatória. Também cria `OrderItem` com `productId` fixo sem criar o `Product`; embora o campo seja opcional, o valor não nulo fornecido precisa satisfazer a FK.
2. `route-protection` chama o seed duas vezes. Cada seed força `orderNumber` 1..50, mas `Order.orderNumber` é globalmente `@unique`.
3. `status-transitions` envia `{ toStatus }`; a rota/schema espera `{ newStatus }`, portanto o cenário “válido” tende a 400 antes do domínio.
4. A matriz de rotas chama PATCH/POST mutáveis sem body e espera 200; POST de frete espera `cityName/value` e retorna 201 em sucesso.
5. No teste de carga, as 100 promises de cada lote usam o mesmo `allCreated.length`; todos os e-mails do lote são iguais, violando `@@unique([email, lojaID])`.
6. O script apenas inicia Vitest; não sobe o servidor apontado por `TEST_BASE_URL`/localhost.

**Hipótese:** depois de instalar dependências, essas suítes falhariam antes de testar a maioria dos comportamentos. Não foram executadas, então a ordem exata da primeira falha é `NOT VERIFIED`.

**Impacto:** os 38 casos declarados como integração/carga não constituem evidência operacional; resultados futuros serão dominados pelo harness, não pelo comportamento sob teste.

**Correção proposta:** criar factory de tenant completa e IDs/números únicos por run; derivar payloads dos schemas públicos; fornecer bodies/status esperados corretos; orquestrar banco/migrations/servidor; tornar o script autocontido ou documentar um comando único que o seja.

**Teste de regressão:** executar do zero duas vezes consecutivas e em CI; exigir zero dependência de estado prévio; adicionar smoke que cria tenant, autentica, chama uma rota e verifica persistência.

**Risco residual:** fixtures podem continuar divergindo de produção; contratos tipados/fixtures compartilhadas reduzem, mas não eliminam drift.

## TST-003 — Concorrência, atomicidade e rollback são comprovados apenas pelos próprios mocks

| Campo | Valor |
|---|---|
| Severidade | **HIGH** |
| Confiança | **CONFIRMED** |
| Arquivos e linhas | `tests/unit/loyalty-security-concurrency.test.ts:7-45,54-115`, `tests/unit/inventory-lifecycle.test.ts:7-45,52-73`, `tests/unit/checkout-authoritative.test.ts:6-35,151-175` |

**Fluxo e condição de manifestação:** duas compras pela última unidade, dois resgates do mesmo saldo, colisão de idempotência ou falha intermediária da transação.

**Evidência observada / fato:** `$transaction` chama o callback sobre o mesmo objeto Prisma mockado, sem engine/banco/rollback. O teste de “double-spending” mantém `currentBalance` em variável JS e o mock de `update` implementa a rejeição esperada; assim ele testa o simulador escrito no teste. Estoque verifica argumentos de `update`, não concorrência de linhas. Idempotência retorna antecipadamente um pedido mockado, sem duas transações concorrentes e sem constraint real.

**Hipótese:** as invariantes podem funcionar no PostgreSQL real, mas esses testes não demonstram isso. Ausência de prova não é prova de corrida.

**Impacto:** falsa confiança nos riscos financeiros mais importantes: estoque negativo, débito duplicado, efeitos parciais e pedidos/cobranças duplicados.

**Correção proposta:** preservar unitários rápidos, mas adicionar integração PostgreSQL com transações reais, barreiras para sincronizar concorrência, constraints e isolamento explícitos. Injetar falha após cada etapa para verificar rollback/compensação e executar o mesmo idempotency key simultaneamente.

**Teste de regressão:** 20 operações paralelas pela última unidade e pelo mesmo saldo; exatamente uma deve vencer quando aplicável, saldo/estoque nunca negativos, ledger/pedido únicos e nenhuma escrita parcial após erro.

**Risco residual:** testes locais não reproduzem pool/rede/deadlocks de produção; repetir em homologação isolada e medir retries.

## TST-004 — Não há teste de componente/browser ou jornada E2E do comércio

| Campo | Valor |
|---|---|
| Severidade | **HIGH** |
| Confiança | **CONFIRMED** |
| Arquivos e linhas | `vitest.config.ts:4-10`, `package.json:17-56`; ausência de `*.test.tsx`, configuração Playwright/Cypress e diretório E2E |

**Fluxo e condição de manifestação:** cadastro/login, home → filtros → produto → carrinho → checkout → pagamento → confirmação → pedido/perfil e operações admin.

**Evidência observada / fato:** Vitest usa `environment: 'node'`, include apenas `.test.ts`; não existe teste `.tsx`. Não há dependência direta/script/configuração E2E. `header-spec.test.ts`, por exemplo, não renderiza o Header.

**Hipótese:** problemas de hidratação, roteamento, cookies, formulários, foco, responsividade, cache do cliente e contratos UI/API podem chegar ao usuário mesmo com unitários verdes.

**Impacto:** a principal jornada de receita e a autorização vista pelo usuário não têm smoke automatizado observável.

**Correção proposta:** adicionar poucos E2E de alto valor com dados fictícios e gateway fake local: visitante compra; cliente A não vê pedido B; admin gerencia pedido; falha/retentativa de pagamento; reset/login. Adicionar testes de componente para formulários e estados loading/error/disabled, sem duplicar detalhes internos.

**Teste de regressão:** executar em build de produção local, browser real, banco descartável, mobile/desktop mínimo; guardar trace/screenshot somente em falha e garantir isolamento por run.

**Risco residual:** E2E é mais lento e sujeito a flake; manter poucos cenários críticos e usar unit/integration para a maior parte da matriz.

## TST-005 — Cleanup pode apagar todo um banco aceito por uma validação permissiva e não isola runs

| Campo | Valor |
|---|---|
| Severidade | **CRITICAL** |
| Confiança | **CONFIRMED** |
| Arquivos e linhas | `tests/setup/db.ts:1-2,11-34,149-179`, `lib/prisma.ts:8-14`, `prisma/schema.prisma:8-11`, `vitest.config.ts:4-10` |

**Fluxo e condição de manifestação:** execução de integração/carga com `TEST_DATABASE_URL` segura definida simultaneamente a uma `DATABASE_URL` diferente; ou com o fallback `DATABASE_URL` contendo `test`, localhost ou outro padrão aceito; execução paralela de arquivos sobre o mesmo banco.

**Evidência observada / fato:** `validateTestEnvironment()` escolhe `TEST_DATABASE_URL || DATABASE_URL`, mas retorna apenas sucesso/erro. O helper importa o singleton de `lib/prisma.ts`, cujo `PrismaClient` usa a datasource `env("DATABASE_URL")`; o valor validado não é injetado nesse cliente. Assim, quando as duas variáveis coexistem, o guard pode aprovar uma URL e o cleanup operar em outra. A validação ainda aceita qualquer URL cuja string contenha `test`; depois executa `deleteMany({})` sem tenant/run sobre sessões, itens, pedidos, usuários e lojas. Não há database/schema efêmero obrigatório nem configuração que desative paralelismo de arquivos. O helper também chama `$disconnect` global.

**Hipótese:** se `DATABASE_URL` apontar para um banco com dados enquanto `TEST_DATABASE_URL` aponta para um banco seguro, deleções globais podem atingir o primeiro. Uma URL indevida contendo a substring permitida também pode ser aceita, e arquivos paralelos podem apagar fixtures uns dos outros. Nenhum banco foi conectado nesta auditoria; a manifestação dinâmica é `NOT VERIFIED`.

**Impacto:** risco de perda de dados em ambiente apontado incorretamente, flakiness e resultados não determinísticos entre suítes.

**Correção proposta:** construir o cliente de teste explicitamente com a mesma URL que o guard validou e proibir o singleton da aplicação nesse helper; exigir variável exclusiva sem fallback; parsear URL e validar host/database/schema por allowlist exata; criar database/schema/container efêmero por run; recusar hosts remotos por padrão. Limpar apenas IDs/run namespace, ou descartar o schema/container inteiro. Serializar provisoriamente até haver isolamento.

**Teste de regressão:** tabela de URLs permitidas/negadas incluindo strings enganosas; sentinel de outro run deve sobreviver ao cleanup; duas suítes paralelas não podem interferir. Confirmar fail-closed antes de qualquer delete.

**Risco residual:** credenciais/URLs podem ser configuradas incorretamente fora do código; aplicar proteção também no job e permissões mínimas do usuário de teste.

## TST-006 — Profiler de queries não está habilitado para receber eventos

| Campo | Valor |
|---|---|
| Severidade | **MEDIUM** |
| Confiança | **HIGH CONFIDENCE** |
| Arquivos e linhas | `lib/prisma.ts:8-14`, `tests/helpers/query-profiler.ts:10-35`, `tests/integration/metrics-performance.test.ts:111-207`, `tests/load/customer-load.test.ts:85-93` |

**Fluxo e condição de manifestação:** assertions de quantidade/duração de queries.

**Evidência observada / fato:** Prisma é criado com logs `warn/error`; não há configuração de `query` emitida como evento. O helper ignora o erro de tipo e registra `$on('query')`. As suítes aceitam `queryCount <= 3` e `totalDuration` abaixo do teto, sem sanidade `queryCount > 0`.

**Hipótese de alta confiança:** o array pode permanecer vazio e produzir `0`, fazendo metas passarem sem medir. Não foi confirmado em runtime porque as dependências estão ausentes.

**Impacto:** N+1 e queries lentas podem não ser detectados, produzindo falso verde.

**Correção proposta:** cliente Prisma específico de teste com `{ level: 'query', emit: 'event' }`, ou telemetria suportada; falhar se uma operação conhecida capturar zero queries. Medir wall clock separadamente.

**Teste de regressão:** executar uma consulta trivial e afirmar exatamente um ou mais eventos; introduzir consulta adicional controlada e confirmar mudança da contagem.

**Risco residual:** duração do evento não representa toda latência de request e varia por ambiente.

## TST-007 — Parte da suíte é auto-referente ou reimplementa o código de produção

| Campo | Valor |
|---|---|
| Severidade | **MEDIUM** |
| Confiança | **CONFIRMED** |
| Arquivos e linhas | `tests/unit/header-spec.test.ts:1-76`, `tests/unit/catalog-pagination-flow.test.ts:11-50`, `tests/unit/brand-filtering.test.ts:113-121`, `tests/unit/monetary-invariants.test.ts:1-31` |

**Fluxo e condição de manifestação:** refactor/regressão do Header, paginação, filtro de marca ou regra monetária da aplicação.

**Evidência observada / fato:** `header-spec` não importa nenhum componente e testa arrays/classes/tokens declarados no próprio teste. Parte de `catalog-pagination-flow` reimplementa `Math.ceil`, `slice` e clamp localmente. `brand-filtering` copia a função de filtragem ao invés de testar o hook/componente. `monetary-invariants` demonstra `Prisma.Decimal`, sem atravessar cálculo da aplicação.

**Hipótese:** esses casos podem continuar verdes quando a implementação real divergir, inflando a percepção de cobertura.

**Impacto:** manutenção duplicada, falso sinal e baixa proteção de comportamento observável.

**Correção proposta:** testar exports puros reais ou renderizar/interagir com componente/hook; remover casos que apenas provam a linguagem/biblioteca. Priorizar entradas/saídas e invariantes do domínio.

**Teste de regressão:** aplicar mutação deliberada na implementação e confirmar falha do teste correspondente; o teste não deve conter uma cópia do algoritmo.

**Risco residual:** testes muito acoplados à marcação/CSS também ficam frágeis; focar nome acessível, ordem e interação visível.

## TST-008 — Matriz real de autenticação/autorização permanece incompleta

| Campo | Valor |
|---|---|
| Severidade | **MEDIUM** |
| Confiança | **CONFIRMED** |
| Arquivos e linhas | `tests/unit/access-control.test.ts:1-71`, `tests/unit/bola-idor-defense.test.ts:1-52`, `tests/unit/cross-tenant-matrix.test.ts:1-137`, `tests/integration/route-protection.test.ts:15-183` |

**Fluxo e condição de manifestação:** anônimo/customer/admin e contas fictícias A/B em GET/POST/PATCH/PUT/DELETE de pedidos, endereços, perfil, pontos, pagamentos, uploads e admin.

**Evidência observada / fato:** há bons negativos unitários, mas eles fornecem diretamente retornos de Prisma. A única matriz HTTP real cobre principalmente admin e está afetada por `TST-002`. Não há fluxo completo de cadastro/login/logout, invalidação de sessão, customer A/B em todos os métodos ou browser/cookie real.

**Hipótese:** rotas ou métodos fora da matriz podem regredir sem falhar testes. Isso não afirma a existência de IDOR.

**Impacto:** baixa confiança na fronteira de autorização, embora unidades de serviço estejam cobertas.

**Correção proposta:** matriz data-driven sobre aplicação real, dois tenants, dois customers e admin; verificar status e ausência de efeitos no banco para cada método. Incluir sessão expirada, logout/troca de senha e mass assignment.

**Teste de regressão:** cada recurso sensível deve ter pelo menos anônimo, owner, non-owner e admin permitido/negado conforme contrato, com verificação pós-condição.

**Risco residual:** matriz automatizada não substitui revisão de novas rotas; manter inventário/gate que detecte handler novo sem caso de autorização.

## TST-009 — Estado global e espera temporal tornam casos suscetíveis a ordem/flakiness

| Campo | Valor |
|---|---|
| Severidade | **MEDIUM** |
| Confiança | **HIGH CONFIDENCE** |
| Arquivos e linhas | `tests/unit/asaas-webhook.test.ts:34-45,431-449`, `tests/unit/asaas-customer.test.ts:39-56`, `tests/unit/asaas-boleto.test.ts:8-15`, `tests/unit/asaas-credit-card.test.ts:46-53`, `tests/unit/supabase-storage.test.ts:46-51`, `tests/setup/factories.ts:15-27,39-73` |

**Fluxo e condição de manifestação:** execução paralela, worker reutilizado, máquina lenta ou repetição da suíte.

**Evidência observada / fato:** um teste aguarda 50 ms reais para uma microtarefa de e-mail; múltiplos arquivos mutam `process.env`; um substitui `global.fetch` sem restaurá-lo explicitamente; factories usam `Date.now()` como parte da unicidade e há singletons globais. A configuração não define política de isolamento/paralelismo.

**Hipótese de alta confiança:** ordem e velocidade podem influenciar resultados, embora flake não tenha sido reproduzido por falta do runner.

**Impacto:** falhas intermitentes ou falsos verdes, especialmente quando a suíte crescer.

**Correção proposta:** fake timers ou promise controlável em vez de sleep; `vi.stubEnv`/`vi.unstubAllEnvs`; `vi.stubGlobal`/restore; gerador determinístico por teste; reset de módulos/singletons quando necessário. Executar repetição/shuffle no CI de diagnóstico.

**Teste de regressão:** rodar suite várias vezes com ordem aleatória e paralelismo; nenhuma dependência de relógio real ou estado de outro arquivo.

**Risco residual:** E2E e DB continuam sujeitos a variabilidade; retries não devem mascarar falha reproduzível.

## TST-010 — Gates não medem cobertura e o typecheck opera sem modo estrito

| Campo | Valor |
|---|---|
| Severidade | **MEDIUM** |
| Confiança | **CONFIRMED** |
| Arquivos e linhas | `vitest.config.ts:4-10`, `package.json:5-15,45-56`, `tsconfig.json:8-10`, `.github/workflows/ci.yml:35-42` |

**Fluxo e condição de manifestação:** merge de código novo/não exercitado ou uso incorreto de tipos em produção/testes.

**Evidência observada / fato:** não existe configuração/script/threshold de coverage; o CI não publica relatório. TypeScript é executado, mas `strict` está desativado e `skipLibCheck` ativado. Há uso frequente de `as any` e `@ts-ignore` nos helpers/testes.

**Hipótese:** linhas/branches críticas podem ficar sem teste sem sinal no gate; tipos frouxos podem ocultar drift de mocks e contratos — como `toStatus` versus `newStatus`. Cobertura percentual isolada não garantiria qualidade.

**Impacto:** regressões têm menor chance de detecção e mocks podem compilar apesar de não refletirem o contrato real.

**Correção proposta:** gerar coverage por domínio crítico e estabelecer thresholds graduais de branch/function, sem perseguir número global cego; ativar `strict` incrementalmente por módulos ou config separada para novo código; reduzir `any` em fixtures usando `satisfies` e tipos dos handlers/schemas.

**Teste de regressão:** CI falha quando branch crítica perde cobertura; fixtures incompatíveis com DTO/schema devem falhar no typecheck.

**Risco residual:** cobertura alta ainda admite assertions fracas; combinar com mutation testing seletivo e revisão comportamental.

## 6. Pontos fortes observados

- A suíte cobre várias regras negativas, não apenas happy paths: preço do cliente, tenant divergente, CPF inválido, token de webhook, transições ilegais e estoque insuficiente.
- FSM de pedidos, cálculos de fidelidade, datas de negócio, validação e utilitários puros possuem casos determinísticos úteis.
- Uso de `Prisma.Decimal` é exercitado explicitamente.
- Webhook testa repetição e simula colisão `P2002`, embora ainda falte integração real.
- Há intenção explícita de bloquear banco inseguro antes do cleanup; o problema é a permissividade e escopo, não ausência total de guarda.
- Nenhum `.skip`, `.todo` ou `.only` foi encontrado.
- Integrações externas são mockadas; nenhum teste desta auditoria foi autorizado a contatar serviços reais.

## 7. Dívida priorizada

### P0 — antes de usar a suíte como gate de publicação

1. Vincular inequivocamente guard e `PrismaClient`, tornando o cleanup fail-closed e isolado (`TST-005`, crítico).
2. Corrigir/orquestrar fixtures, contratos, banco e servidor da integração (`TST-002`).
3. Executar integração no CI (`TST-001`).
4. Adicionar concorrência/rollback reais para estoque, pontos, checkout e idempotência (`TST-003`).

### P1 — confiança na jornada e autorização

1. E2E smoke de compra, conta e admin (`TST-004`).
2. Matriz HTTP A/B/anônimo/customer/admin (`TST-008`).
3. Corrigir profiler e medir queries reais (`TST-006`).

### P2 — qualidade e manutenção

1. Substituir testes auto-referentes (`TST-007`).
2. Remover sleeps/estado global não restaurado (`TST-009`).
3. Coverage por risco e tipagem incremental (`TST-010`).

## 8. Verificações pendentes / Not Verified

1. Instalar dependências de forma autorizada e reproduzível com `npm ci` e verificar integridade do lockfile.
2. Executar unit, integração, carga, lint, typecheck e build; nesta etapa nenhum deles iniciou.
3. Confirmar quantidade real de testes pass/fail/skip e duração; 403 é contagem estática.
4. Subir PostgreSQL descartável, aplicar migrations e observar a primeira falha real do harness.
5. Medir cobertura de linhas/branches/functions e mutation score em módulos financeiros/autorização.
6. Verificar repetibilidade com shuffle, múltiplas execuções e paralelismo.
7. Executar E2E em build local com browser real e fixtures fictícias.
8. Validar contratos Asaas/Correios/Resend contra fixtures versionadas ou mocks locais; nenhum serviço externo deve ser chamado.
9. Confirmar no provedor de CI o histórico real dos jobs; não houve acesso externo.
10. Validar Windows/Linux e Node 20 do CI versus Node 24 local.

## 9. Itens não aplicáveis e justificativas

- **Cupons:** não foram encontrados modelo, serviço, rota ou UI de cupom; a matriz marca N/A.
- **Teste contra produção:** não aplicável e explicitamente proibido; nenhuma carga ou autenticação externa foi tentada.
- **Contrato live com pagamentos/e-mail/storage:** não aplicável nesta auditoria segura; deve usar sandbox autorizado ou fixture/mock local em etapa própria.
- **Snapshot testing:** ausência não é achado; snapshots só ajudariam onde há contrato serializado/visual estável.
- **MFA:** não foi encontrado fluxo MFA no escopo de testes; não se exige teste de recurso inexistente.
- **Resultado de cobertura:** não verificado porque o projeto não configura o recurso e o runner não estava disponível.

## 10. Riscos residuais

- Corrigir o harness pode revelar falhas reais hoje mascaradas; isso é esperado e não deve ser tratado como regressão causada pelo teste.
- Integração com banco local não reproduz latência, pool e falhas de infraestrutura de produção.
- E2E pode se tornar caro/flaky se tentar cobrir toda combinação; selecionar fluxos de receita e autorização.
- Mocks continuam necessários para erros raros e provedores externos, mas precisam aderir a contratos versionados.
- Coverage/quantidade de casos não medem qualidade de assertion; revisar mutações sobreviventes e pós-condições.
- Paralelismo seguro depende de isolamento de dados, não apenas de serializar testes.

## 11. Conclusão limitada ao escopo

Foram registrados 10 achados: 1 CRITICAL, 4 HIGH e 5 MEDIUM. A base unitária demonstra esforço relevante e cobre diversos cálculos e negativos, mas o gate atual não comprova integração real, concorrência transacional ou a jornada completa do e-commerce. As suítes de integração/carga não devem ser executadas até o risco crítico do cleanup ser eliminado; depois precisam se tornar autocontidas e coerentes, entrar no CI e ser acompanhadas de poucos E2E críticos.

Nenhuma falha funcional do produto foi declarada somente por falta de teste. Nenhum código de produto ou teste foi alterado; apenas este relatório foi criado. A auditoria termina na etapa 09 e não avança automaticamente.
