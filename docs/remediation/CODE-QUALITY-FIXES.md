# Etapa 14 — Dependências e qualidade de código

**Data:** 2026-09-28  
**Entradas:** `docs/audits/CODE-QUALITY-AUDIT.md`, `docs/audits/SECURITY-AUDIT.md`, `docs/audits/FINAL-AUDIT.md`, `docs/remediation/PLAN.md`  
**Escopo:** revalidação dos IDs `CQ-001`–`CQ-011`, correções pequenas com impacto demonstrado e análise local de dependências  
**Estado:** correções de comportamento/duplicação concluídas; strictness, módulos sem consumidor e decomposição ampla permanecem graduais

## Resultado executivo

Os 11 achados foram comparados com o código após as etapas 01–13. `CQ-001`, `CQ-005`, `CQ-006` e `CQ-011` já estavam resolvidos; parte relevante de `CQ-003` também. Nesta etapa:

- falha ao consultar pedidos deixou de virar histórico vazio e agora aciona um boundary recuperável do perfil;
- todos os consumidores dos aliases depreciados foram migrados aos módulos canônicos, seis shims sem consumidores foram removidos e o DTO homônimo obsoleto foi eliminado;
- o contexto do carrinho foi separado, quebrando o ciclo `CartProvider ↔ CartDrawer` sem remover o lazy loading suportado pelo Next 16.3.5;
- autenticação timing-safe dos dois crons foi centralizada em um único guard;
- o lint do CI ganhou budget explícito de 16 warnings: o estado conhecido passa, mas o 17º warning falha.

Nenhuma dependência foi atualizada. Não há vulnerabilidade de runtime confirmada que justifique alteração cega: a evidência anterior registra zero em produção e duas moderadas no conjunto total/dev; o audit **offline** desta etapa retornou zero, divergência que demonstra cache desatualizado e não permite reclassificar as duas moderadas. Nenhuma consulta online foi feita.

## Revalidação por ID

| ID | Severidade/confiança original | Classificação atual | Evidência e decisão | Residual |
|---|---|---|---|---|
| `CQ-001` | HIGH / CONFIRMED | **ALREADY RESOLVED** | `restoreStock` não contém catches locais; falha escapa e rollback real no PostgreSQL preserva primeiro incremento/status/auditoria/pontos. | LOW |
| `CQ-002` | MEDIUM / CONFIRMED | **VALID → FIXED** | O serviço canônico ainda capturava erro e retornava `[]`. Agora registra evento sanitizado, lança `ORDER_HISTORY_UNAVAILABLE` e `app/profile/error.tsx` oferece retry; vazio permanece resposta válida. | LOW |
| `CQ-003` | MEDIUM / CONFIRMED | **VALID → FIXED** | `services/orders.service.ts` já não existia; nesta etapa os imports/mocks foram migrados, seis shims foram removidos e restou um único `UpdateOrderStatusInput`. | LOW |
| `CQ-004` | MEDIUM / CONFIRMED | **VALID / DEFERRED** | `strict=false` e 78 ocorrências heurísticas de `any`/casts permanecem. Nenhuma falha específica nova foi inferida; migração big-bang foi evitada. | MEDIUM |
| `CQ-005` | MEDIUM / CONFIRMED | **ALREADY RESOLVED → reforçado** | CI já executa lint. O script agora usa `--max-warnings=16`; lint passou com 0 erros/16 warnings, bloqueando crescimento do budget. | MEDIUM enquanto o budget não cair |
| `CQ-006` | MEDIUM / CONFIRMED | **ALREADY RESOLVED** no repositório | CI executa audit de produção, Dependabot está versionado e lock possui integridade. Estado atual total/dev online não foi reconsultado; duas moderadas anteriores continuam pendentes de triagem autorizada. | MEDIUM |
| `CQ-007` | MEDIUM / CONFIRMED | **VALID / DEFERRED** | Checkout e fidelidade continuam grandes. Refatoração transversal sem E2E aumentaria risco; deve ocorrer por fluxo vertical. | MEDIUM |
| `CQ-008` | LOW / HIGH CONFIDENCE | **NOT VERIFIED / DEFERRED** | Os cinco módulos originais ainda parecem sem consumidores, mas intenção de roadmap não foi obtida. Apenas os shims comprovadamente substituídos foram removidos. | LOW |
| `CQ-009` | LOW / CONFIRMED | **VALID → FIXED** | `CartProvider`, `CartDrawer`, `CartButton` e home agora dependem de `cart-context`; drawer não importa provider. Build passou. | LOW |
| `CQ-010` | MEDIUM / CONFIRMED | **VALID → FIXED** | Os handlers usam `lib/cron-auth.ts`; tokens ausente, alternativo, inválido, tamanho divergente e válido continuam cobertos nos dois endpoints. | LOW |
| `CQ-011` | LOW / CONFIRMED | **ALREADY RESOLVED** | `packageManager`, `engines`, `.nvmrc`, Docker Node por digest e CI com `node-version-file` já existem. | LOW |

## Correções e provas

### Histórico de pedidos — `CQ-002`

**Antes:** qualquer falha Prisma era convertida em `[]`; a UI exibia o mesmo estado de uma conta sem pedidos.  
**Depois:** a exceção gera log estruturado sem identificador pessoal, vira `OrderError('ORDER_HISTORY_UNAVAILABLE')` e alcança o error boundary do segmento, que informa indisponibilidade e oferece `retry()`.  
**Prova:** mock do repositório rejeita e a função rejeita com o erro tipado; o caso de sucesso preserva tenant, paginação e conversão Decimal.

### Contratos/imports — `CQ-003`

**Antes:** consumidores e seus mocks atravessavam `lib/services/*`/`lib/auth-admin`; havia dois `UpdateOrderStatusInput`.  
**Depois:** busca em `app/components/hooks/lib/services/tests` retorna zero imports dos aliases; os seis shims foram removidos; `types/admin.types.ts` é a definição canônica.  
**Prova:** a migração inicialmente quebrou sete testes porque seus mocks ainda apontavam para aliases. Os mocks foram migrados à mesma fronteira canônica e o foco passou 59/59, seguido pela suíte completa.

### Ciclo do carrinho — `CQ-009`

**Antes:** provider carregava drawer dinamicamente e drawer importava `useCart` do provider.  
**Depois:** `components/providers/cart-context.tsx` contém somente contrato/context/hook; provider e drawer dependem dele. O `dynamic(..., { ssr: false })` permaneceu no Client Component, conforme documentação local do Next.  
**Prova:** teste arquitetural impede o import reverso, typecheck e build de produção passaram.

### Guard de cron — `CQ-010`

**Antes:** duas cópias de parsing, resposta e `timingSafeEqual`.  
**Depois:** `lib/cron-auth.ts` recebe nome operacional allowlisted pelo caller, não registra token e padroniza 500/401/sucesso.  
**Prova:** testes existentes dos dois handlers e teste arquitetural passaram; 31/31 no primeiro foco final. A primeira tentativa importou o marcador opcional `server-only`, ausente na instalação, e a segunda removeu indevidamente o import local de `NextResponse`; ambos foram detectados antes da suíte completa e corrigidos.

### Gates/dependências — `CQ-005`, `CQ-006`, `CQ-011`

- `npm ls --all --offline`: exit 0, árvore instalada coerente.
- `npm audit --offline --json`: exit 0/zero no cache local; **não conclusivo** e não substitui a evidência anterior de duas moderadas dev.
- `npm run lint`: exit 0 com exatamente 16 warnings e budget 16.
- Nenhum `npm audit` online, registry de advisory, atualização, `audit fix`, major ou alteração de lock foi executado nesta etapa.

## Arquivos alterados nesta etapa

- comportamento: `services/order.service.ts`, `app/profile/error.tsx`;
- contratos: rotas que importavam aliases, testes correspondentes, `types/order.types.ts`;
- carrinho: `components/providers/cart-context.tsx`, `CartProvider.tsx`, `CartDrawer.tsx`, `CartButton.tsx`, `HomeClient.tsx`;
- cron: `lib/cron-auth.ts` e os dois handlers;
- gates/testes: `package.json`, `tests/unit/architecture-boundaries.test.ts`, `tests/unit/order-history-query.test.ts`;
- removidos após zero consumidores: `lib/auth-admin.ts` e cinco arquivos em `lib/services/`.

Não houve commit.

## Comandos e resultados

| Comando | Resultado |
|---|---|
| foco arquitetura/crons (final) | 3 arquivos, 31/31, exit 0 |
| foco imports/checkout/admin | 6 arquivos, 59/59, exit 0 |
| foco histórico/arquitetura | 2 arquivos, 10/10, exit 0 |
| `npx tsc --noEmit` | exit 0 |
| `npm run lint` | exit 0; 0 erros, 16 warnings; budget 16 |
| `npm run test:unit` | 77 arquivos, 525/525, 5,99 s Vitest |
| `npm run build` | Next 16.3.5; 51 páginas; exit 0 |
| `npm ls --all --offline` | exit 0; 1,478 s |
| `npm audit --offline --json` | cache local: 0; resultado limitado e divergente da evidência online anterior |
| `git diff --check` | exit 0; somente avisos de conversão LF/CRLF |

## Falhas observadas e separação de regressões

- Após migrar imports, a primeira suíte completa teve 7 falhas porque três arquivos de teste mockavam os aliases removidos. Era drift do harness introduzido nesta etapa; mocks atualizados e 525/525 final.
- A extração do cron teve uma execução com 2 suites sem coleta por `server-only` ausente e outra com 9 falhas por `NextResponse` não importado nos handlers. Erros introduzidos, corrigidos e não presentes no resultado final.
- Não houve falha funcional persistente, teste ignorado ou sucesso simulado.

## Pendências e critérios objetivos

- `CQ-004`: criar config strict secundária por fronteira, começar por checkout/gateway e reduzir casts com testes de tipo; encerrar quando DTO inválido falhar no compilador e no schema runtime.
- `CQ-005`: reduzir o budget de warnings em lotes com prova visual/funcional; não apenas silenciar regras.
- `CQ-006`: em ambiente autorizado, triar as duas moderadas dev pelo caminho/uso, atualizar lote mínimo e repetir install/lint/test/build; expirar exceções documentadas.
- `CQ-007`: extrair uma responsabilidade por vez depois de characterization/E2E, mantendo o contrato de checkout.
- `CQ-008`: obter decisão de owner para `CatalogFilterBar`, três primitivas UI e helper Supabase; só remover dependências após build/smoke e confirmação de roadmap.

## Limitações e risco residual

- Nenhum registry/advisory online, conta, produção, cloud, gateway ou banco real foi acessado.
- O audit offline pode estar desatualizado; não se afirma ausência atual de vulnerabilidade nem manutenção ativa de pacotes.
- Os 16 warnings existentes continuam dívida conhecida; o budget evita crescimento, não os resolve.
- Checkout/fidelidade continuam complexos e o TypeScript global continua permissivo.
- Esta etapa não declara `READY` ou `APPROVED`.


## 2026-09-29 — execução dos prompts atualizados e correções locais

**IDs:** CQ-004/005/007/008/011, FINAL-028/033. Ajustes focais de unknown nos catches, Prisma.TransactionClient no serviço de auditoria, hash puro compartilhado e teste de cabeçalho que renderiza componentes reais. Node 22.22.1/npm10.9.4 usados; CQ-011 corrigido localmente. .tmp foi excluído de lint/typecheck para não percorrer cópia isolada e artefatos gerados.

Não alterado strict global nem removidos módulos por simples ausência de referência textual. Warnings de imagens/hooks permanecem registrados, sem desativar regras. Scanner passou; npm audit online não foi repetido e não se afirma validade atual de advisories antigos. Verificações finais e dívida residual estão em FINAL-VALIDATION.

**Validação consolidada:** [complemento de FINAL-VALIDATION](FINAL-VALIDATION.md#2026-09-29--execução-dos-prompts-atualizados-e-correções-locais). Histórico acima preservado; homologação externa não inferida.
