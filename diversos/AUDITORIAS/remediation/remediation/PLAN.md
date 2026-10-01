# Plano de remediação — triagem 00

**Data:** 2026-09-26  
**Revisão inspecionada:** `0c7ef7ddfa5fb4520c4bc794163cbc71257c2bc4`  
**Entrada principal:** `docs/audits/FINAL-AUDIT.md`  
**Escopo:** planejamento somente; nenhum código de produto, teste, migration ou configuração foi alterado  
**Estado de publicação herdado:** **BLOCKED**

## 1. Resultado da triagem

Os 15 relatórios esperados existem: 14 relatórios de domínio mais `FINAL-AUDIT.md`. A consolidação não está ausente e corresponde integralmente ao inventário de origem: foram extraídos **198 IDs únicos**, com **7 BLOCKER, 28 CRITICAL, 85 HIGH, 70 MEDIUM, 7 LOW e 1 INFORMATIONAL**. A confiança declarada nos relatórios é **164 CONFIRMED, 28 HIGH CONFIDENCE, 4 SUSPECTED e 2 NOT VERIFIED**.

O mapa de deduplicação de `FINAL-AUDIT.md` referencia os 198 IDs exatamente uma vez: não há ID ausente, extra ou duplicado. Os 198 achados de origem permanecem preservados em **36 grupos de causa raiz**: **2 BLOCKER, 11 CRITICAL, 18 HIGH, 4 MEDIUM e 1 LOW**.

Na consolidação, a confiança dos grupos é **CONFIRMED** para `FINAL-001–004`, `006`, `009–011`, `013–015`, `020`, `023–028`, `031–032` e `035–036`; é **HIGH CONFIDENCE** para `FINAL-005`, `007–008`, `012`, `016–019`, `021–022`, `029–030` e `033–034`. Os `SUSPECTED` e `NOT VERIFIED` de origem continuam explicitados na seção 7 e não são promovidos por herança do grupo.

Nesta etapa, relatório não foi tratado como prova suficiente. Uma amostra de sete grupos — os dois BLOCKERs e cinco CRITICALs representativos de transação, segurança e testes — foi revalidada no código atual. Todos os sete foram classificados **VALID**. Os outros 29 grupos permanecem **NOT VERIFIED nesta triagem**, mesmo quando o relatório de origem diz `CONFIRMED` ou `HIGH CONFIDENCE`; devem ser revalidados no início do respectivo trabalho. Nenhum grupo foi classificado `INVALID` ou `ALREADY RESOLVED`.

Não houve “depois” funcional: o código antes e depois desta etapa é o mesmo. A única saída é documental (`PLAN.md` e `PROGRESS.md`). Portanto, severidade residual e estado de publicação permanecem inalterados.

## 2. Regras de classificação e execução

- **VALID:** revalidado diretamente no código atual nesta triagem; ainda não significa corrigido.
- **INVALID:** a condição descrita não existe no estado atual ou a inferência é incompatível com o código.
- **ALREADY RESOLVED:** a causa existia no relatório, mas já há correção e regressão verificáveis no estado atual.
- **NOT VERIFIED:** não revalidado nesta triagem ou depende de runtime, serviço ou infraestrutura não autorizada.
- **DEFERRED:** correção conscientemente deixada para uma onda posterior; não equivale a aceitação de risco.
- Um grupo só pode ser encerrado como `FIXED` depois de prova comportamental antes/depois, regressão executada e evidência operacional quando houver dependência externa.
- `SUSPECTED` e `NOT VERIFIED` de origem nunca serão promovidos a defeito confirmado sem evidência adicional.
- Cada execução futura deve tratar uma causa raiz por vez, atualizar `PROGRESS.md` e preservar todos os IDs de origem.

## 3. Amostra revalidada no código

| Grupo | Classificação | Evidência atual | Cobertura existente e lacuna |
|---|---|---|---|
| `FINAL-001` | **VALID** | Só existe `app/api/checkout/route.ts`; `CheckoutForm` chama `/api/checkout/create-order`, envia campos flat/`cardData`/`productID`, enquanto o schema exige `customer`/`creditCard`/`productId`; a UI consome o envelope no nível errado. | Testes unitários chamam a rota canônica diretamente, mas não exercitam o payload produzido pela UI nem navegador/roteamento real. |
| `FINAL-002` | **VALID** | Parser somente leitura encontrou 22 modelos Prisma e 16 tabelas criadas pelas migrations; faltam `Brand`, `CategoryTag`, `ProductCategoryTag`, `JtExpressGeocom`, `JtExpressRate` e `StockSyncLog`. | CI executa `prisma validate`, mas não `migrate deploy` do zero nem diff estrutural em PostgreSQL descartável. |
| `FINAL-006` | **VALID** | `PaymentWebhookEvent` é criado antes da busca/transição do pedido; qualquer registro existente retorna `ALREADY_PROCESSED`; o modelo só possui `processedAt` com default, sem estado/tentativa/lease. | Testes unitários afirmam o retorno precoce e usam mocks; não provam retomada após falha parcial em banco real. |
| `FINAL-010` | **VALID** | GET público de produto usa `include: { loja: true }`; consulta pública de loja seleciona e devolve `correiosPassword`, contrato e endereço operacional. | Não foi encontrado snapshot negativo que impeça campos sensíveis em respostas públicas. Rotação de valores eventualmente expostos é externa. |
| `FINAL-011` | **VALID** | Guest sem `userId` faz `upsert` por `(email, lojaID)`, atualiza CPF/telefone e usa o ID resultante para resgate de pontos. | Há testes de checkout/loyalty isolados, mas não o caso comportamental anônimo usando o e-mail de uma conta existente. |
| `FINAL-012` | **VALID** | Forgot-password deriva `originUrl` de `Origin` ou `Referer`, possui fallback para primeira loja e o serviço interpola essa origem no link com token. | Testes passam `originUrl` confiável e não cobrem headers hostis, host desconhecido e dois tenants. Entrega real depende do provider de e-mail. |
| `FINAL-013` | **VALID** | O guard aceita `localhost`, `127.0.0.1` ou qualquer URL contendo `test`, valida `TEST_DATABASE_URL || DATABASE_URL`, mas o singleton Prisma usa `DATABASE_URL`; cleanup executa `deleteMany` amplo. | As suites importam o helper perigoso; não há matriz de URLs, sentinel de outro run ou prova de isolamento por schema/container. Nenhum banco foi conectado. |

## 4. Ordem operacional e gates

As ondas abaixo indicam ordem de início. Um grupo não pode ser encerrado se um gate posterior ainda for requisito objetivo — por exemplo, a saga financeira pode ser implementada na onda de transações, mas só fecha quando worker, alertas e sandbox estiverem comprovados.

1. **Onda 0 — bloqueios e contenção imediata.** Conter exposição, impedir cleanup inseguro, criar o gate mínimo, reconstruir migrations e alinhar o contrato do checkout.
2. **Onda 1 — identidade, autorização, segurança e integridade.** Fixar fronteiras de tenant/guest/token/ledger/estoque antes dos fluxos financeiros concorrentes.
3. **Onda 2 — transações.** Autoridade monetária, CAS, inbox, saga, refund e reconciliação, com falhas parciais e concorrência reais.
4. **Onda 3 — arquitetura e contratos.** Consolidar FSM, catálogo/admin e camadas somente depois de estabilizar invariantes e characterization tests.
5. **Onda 4 — experiência e performance.** Acessibilidade, URLs, estados de erro, paginação e budgets após o fluxo comercial estar correto.
6. **Onda 5 — operação e manutenção.** Completar scheduler/worker, deploy, health, telemetry, backup/restore e governança contínua. As fatias mínimas de outbox/worker/alerta necessárias à onda 2 são pré-requisitos transversais, não justificativa para encerrar transações sem operação.

### Gates inegociáveis

- Não executar integração/carga antes de corrigir e provar `FINAL-013`.
- Não promover release antes de `FINAL-002`/`FINAL-003` em PostgreSQL descartável e rehearsal de dados.
- Não conectar a UI corrigida a cobrança real antes de `FINAL-004` a `FINAL-009` e `FINAL-011` estarem comprovados.
- Não considerar remoção de segredo suficiente: `FINAL-010`/`FINAL-019` exigem rotação externa confirmada.
- Não adicionar retry a webhook/gateway sem inbox, idempotência, fingerprint e estado incerto.
- Não fazer refatoração estrutural de `FINAL-026`/`FINAL-028` antes de characterization/contract tests.

## 5. Matriz ID → causa raiz → prompt → prioridade → dependências → estado inicial

| ID | Causa raiz | Prompt sugerido para a etapa | Prioridade / onda | Dependências reais | Estado inicial |
|---|---|---|---|---|---|
| `FINAL-001` | Contratos UI/API/schema/envelope evoluíram separadamente. | Unifique request/response do checkout, faça a UI usar a rota canônica e prove PIX/cartão/boleto com contract test e browser. | P0 / O0 | `FINAL-020` mínimo; fechamento financeiro depende de `004–009`, `011`, `015`. | **VALID**, correção `DEFERRED`. |
| `FINAL-002` | Schema Prisma não é reproduzido pelo histórico SQL. | Crie baseline/migration corretiva revisável, aplique do zero em PostgreSQL efêmero e compare schema sem tocar ambientes reais. | P0 / O0 | `FINAL-013`, `FINAL-020`; inventário externo de ambientes. | **VALID**, correção `DEFERRED`. |
| `FINAL-003` | DDL destrutivo e constraint residual não têm expand/backfill/contract. | Planeje e ensaie rollout seguro, backfill e remoção da unicidade incompatível com variantes em fixture preenchida. | P0 / O0 | `FINAL-002`, `FINAL-013`, DBA/Platform. | NOT VERIFIED nesta triagem. |
| `FINAL-004` | Não há autoridade server-side única para frete, parcelas e dinheiro. | Implemente quote server-side versionado/fingerprint e recalcule todas as invariantes monetárias em centavos/Decimal. | P0 / O2 | `002–003`, `005`, `015`, `020`. | NOT VERIFIED nesta triagem. |
| `FINAL-005` | Pedido e identidade tenant possuem portas e constraints paralelas. | Elimine o criador alternativo, vincule sessão ao host/tenant e imponha coerência composta com migração de dados. | P0 / O1 | `002–003`, `020`; auditoria de dados legados. | NOT VERIFIED nesta triagem. |
| `FINAL-006` | Webhook usa registro de chegada como prova de processamento. | Modele inbox RECEIVED/PROCESSING/PROCESSED/FAILED, retry retomável e transação idempotente dos efeitos. | P0 / O2 | `007`, `014–015`, `020`, `027`; fatia de `021`. | **VALID**, correção `DEFERRED`. |
| `FINAL-007` | Transições validam snapshot antes da transação e atualizam apenas por ID. | Adote compare-and-set/versão e chaves únicas de efeitos; prove dezenas de transições concorrentes em PostgreSQL real. | P0 / O2 | `002–003`, `014–015`, `020`. | NOT VERIFIED nesta triagem. |
| `FINAL-008` | Banco e gateway não têm operação durável, fingerprint, estado incerto ou reconciliação. | Implemente operação financeira tenant-scoped, `PAYMENT_UNKNOWN`, consulta/reconciliação e compensações idempotentes. | P0 / O2 | `004`, `006–007`, `020–021`, `027`, `033`; sandbox Asaas. | NOT VERIFIED nesta triagem. |
| `FINAL-009` | Cancelar, reembolsar e restaurar estoque são tratados como uma conclusão simples. | Separe estados/workflow de cancelamento, refund e compensação; torne restore local atômico e reconciliação remota retomável. | P0 / O2 | `007–008`, `014–015`, `021`, `027`; sandbox Asaas. | NOT VERIFIED nesta triagem. |
| `FINAL-010` | DTO público reutiliza entidade/configuração privada. | Crie allowlists públicas e DTO admin separado, teste ausência de chaves sensíveis e prepare rotação externa. | P0 / O0 | Nenhuma para contenção; Security/operadores dos providers para rotação. | **VALID**, correção `DEFERRED`. |
| `FINAL-011` | Guest é unido à conta apenas por igualdade de e-mail. | Separe guest de conta e exija sessão/OTP explícito para vínculo, atualização de PII e uso de pontos. | P0 / O1 | `005`, `014`, serviço de e-mail autorizado. | **VALID**, correção `DEFERRED`. |
| `FINAL-012` | Reset confia em origem fornecida pelo solicitante e tenant fail-open. | Resolva domínio canônico allowlisted pelo tenant, remova fallback e prove headers hostis/A-B sem expor tokens. | P0 / O1 | `005`, `016`, DNS/configuração de domínios. | **VALID**, correção `DEFERRED`. |
| `FINAL-013` | Harness valida uma URL e pode operar outra; allowlist e cleanup são amplos. | Use cliente explícito com `TEST_DATABASE_URL` exclusiva, container/schema por run e cleanup namespaced, falhando antes de conectar. | P0 / O0 — primeiro item técnico | Nenhuma; bloqueia qualquer teste DB. | **VALID**, correção `DEFERRED`. |
| `FINAL-014` | Fidelidade mistura autorização, wallet mutável e ledger sem idempotência contábil. | Torne ledger append-only tenant-scoped, com chave por efeito, limites/aprovação e reconciliação wallet=soma. | P1 / O1 | `002–003`, `005`, `007`, `011`, `020`. | NOT VERIFIED nesta triagem. |
| `FINAL-015` | Produto, variante e carrinho têm fontes de estoque/identidade divergentes. | Defina estoque por SKU, variante obrigatória, mutações atômicas e reconcilie saldos legados antes de constraints. | P1 / O1 | `002–003`, `005`, `020`; inventário operacional. | NOT VERIFIED nesta triagem. |
| `FINAL-016` | Bearer/reset em claro e revogação/consumo fail-open. | Armazene hashes, consuma reset por CAS, faça logout fail-closed e prove que dumps/logs não contêm token bruto. | P1 / O1 | `012`, `017`, `027`; revogação externa quando necessária. | NOT VERIFIED nesta triagem. |
| `FINAL-017` | Rate limit/cache local e entradas sem teto não protegem múltiplas réplicas. | Centralize limites atômicos, defina proxy confiável e máximos de schema/body, provando duas instâncias e IP spoof. | P1 / O1 | `020`, contrato de proxy de `033`. | NOT VERIFIED nesta triagem. |
| `FINAL-018` | Rotas auxiliares confiam em `NODE_ENV` e upload usa privilégio amplo/bucket do cliente. | Remova do artefato público ou exija admin+segredo/allowlist; fixe bucket/path e menor privilégio. | P0 / O0 | Security/Platform e políticas Supabase. | NOT VERIFIED nesta triagem. |
| `FINAL-019` | Bootstrap secreto versionado e proteção do último admin é check-then-write. | Revogue/rotacione credencial, substitua bootstrap e imponha invariante transacional de admin ativo. | P0 / O0 | `002–003`, `020`; Security/operador para rotação e histórico. | NOT VERIFIED nesta triagem. |
| `FINAL-020` | Quality gates usam mocks e não exercitam DB, HTTP, browser ou concorrência. | Crie gates graduais: lock/install, lint/typecheck, PG+migrations, HTTP, concorrência e E2E; cada mutação deve quebrar o gate certo. | P0 / O0 e transversal | `013` antes de DB; alimenta todos os demais. | NOT VERIFIED nesta triagem. |
| `FINAL-021` | Jobs/efeitos não têm scheduler, claim, outbox, DLQ ou supervisão durável. | Versione scheduler/worker, claim por lote, outbox, retry/DLQ e heartbeat; prove interrupção e retomada sem duplicar. | P1 / O5, com fatia habilitadora O2 | `006–009`, `027`, `033`; provedor de jobs. | NOT VERIFIED nesta triagem. |
| `FINAL-022` | Listas/relatórios materializam conjuntos e índices não foram medidos. | Mova filtros/paginação/agregação ao servidor e justifique índices por EXPLAIN com seeds crescentes. | P2 / O4 | `002`, `020`; dados/cardinalidade representativos. | NOT VERIFIED nesta triagem. |
| `FINAL-023` | Funil usa elementos não semânticos e labels/estado não programáticos. | Troque por controles nativos e prove checkout completo por teclado, árvore acessível e leitor de tela. | P1 / O4 | `001` funcional, `020` E2E. | NOT VERIFIED nesta triagem. |
| `FINAL-024` | Overlays customizados não gerenciam ciclo de foco. | Reuse Dialog/Sheet acessível ou implemente foco inicial, trap, Escape, inert e retorno ao gatilho. | P1 / O4 | `020` browser/a11y. | NOT VERIFIED nesta triagem. |
| `FINAL-025` | Catálogo é estado React sem rotas/canonical/sitemap tenant-aware. | Crie URLs SSR por slug, links reais, canonical/robots/sitemap e prove deep link sem JavaScript em dois tenants. | P2 / O4 | `005`, `020`, `032`, domínios canônicos. | NOT VERIFIED nesta triagem. |
| `FINAL-026` | FSM, timeline, tracking, variantes e taxonomia têm fontes paralelas. | Consolide uma FSM/audit log e updates por ID/arquivamento, preservando histórico de produto vendido. | P2 / O3 | `003`, `007`, `015`, `020`. | NOT VERIFIED nesta triagem. |
| `FINAL-027` | Logging/correlação não usa allowlist/minimização ponta a ponta. | Sanitize recursivamente, normalize erro público e propague correlation ID gerado, com retenção e testes negativos. | P1 / O1 e transversal | `016`, `020`; backend/RBAC/retenção externos. | NOT VERIFIED nesta triagem. |
| `FINAL-028` | Serviços/componentes duplicados e tipagem frouxa sustentam drift. | Faça characterization tests, extraia fronteiras por agregado e aumente strictness incremental sem mudar semântica. | P2 / O3 | `001`, `004–009`, `020`, `026`. | NOT VERIFIED nesta triagem. |
| `FINAL-029` | Frontend converte erro em vazio/zero e serializa carregamentos/efeitos. | Modele estados discriminados, retry idempotente e prefetch/paralelismo seguro, provando 4xx/5xx/offline/timeout. | P1 / O4 | `001`, `008`, `020`. | NOT VERIFIED nesta triagem. |
| `FINAL-030` | Hero/imagens/animação não têm budget nem ramo reduced-motion. | Entregue conteúdo/poster imediato, mídia responsiva/lazy e ramo sem autoplay/GSAP; meça Web Vitals/bytes. | P2 / O4 | `020` browser/perf; CDN/imagens reais. | NOT VERIFIED nesta triagem. |
| `FINAL-031` | Landmarks, headings, erro e foco visível são inconsistentes. | Padronize main/skip/headings/focus-visible/erros e prove axe+teclado+leitor de tela+reflow. | P2 / O4 | `020` a11y. | NOT VERIFIED nesta triagem. |
| `FINAL-032` | Metadata/noindex/CSP/templates/boundaries não formam uma política web. | Implemente metadata por rota, escape, CSP nonce/hash progressivo e error boundaries; valide headers e HTML. | P2 / O4 | `025`, `033`; CDN/proxy. | NOT VERIFIED nesta triagem. |
| `FINAL-033` | Release, env, health, observabilidade e recuperação dependem de estado externo não versionado. | Versione artefato/promoção/migrate/smoke/rollback, schema de env, proxy trust, health, telemetry e restore drill. | P1 / O5 e gate de release | `002–003`, `020–021`, `027`, `034`; Platform/SRE/DBA. | NOT VERIFIED; inclui `INF-008 NOT VERIFIED` e `INF-014 SUSPECTED`. |
| `FINAL-034` | RLS/ACL é SQL avulso fora das migrations e estado real é desconhecido. | Versione grants/RLS/default privileges e teste roles após migration; não declare exposição sem consultar ambiente autorizado. | P1 / O1 | `002–003`, `020`; DBA/Supabase. | NOT VERIFIED; `DB-016` permanece **NOT VERIFIED**. |
| `FINAL-035` | Cadastro/reset/login não compartilham política e resposta indistinguível. | Unifique política, resposta e custo de hash; teste matriz de senhas e timing local controlado. | P2 / O1 | `016–017`, `020`. | NOT VERIFIED nesta triagem. |
| `FINAL-036` | i18n/moeda/retorno pós-login não têm utilitário/contrato comum. | Centralize pt-BR/BRL e valide `next` relativo allowlisted com regressão de navegação. | P3 / O4 | `020`, após fluxos críticos. | NOT VERIFIED nesta triagem. |

## 6. Pacotes de trabalho e critérios objetivos

### Onda 0 — bloqueios e contenção imediata

#### `FINAL-013` — segurança do harness

- **Pré-condição/impacto:** qualquer integração/carga com URL ambígua pode executar deleções globais no banco errado; por isso este é o primeiro item técnico.
- **Escopo e provas:** cliente Prisma criado explicitamente com a URL validada, sem fallback; parse de host/database/schema por allowlist exata; container/schema por run; matriz de URLs enganosas, sentinel de outro run e duas suites paralelas.
- **Risco e responsável:** risco de perda de dados é alto; owner Test/Backend, com revisão DBA/Platform. Não conectar a banco compartilhado durante a correção.
- **Encerramento:** todos os casos inseguros falham antes de `$connect`; cleanup remove apenas o namespace do run; prova executada em PostgreSQL descartável.

#### `FINAL-010` — DTOs públicos e rotação

- **Pré-condição/impacto:** requisição anônima a produto/loja serializa segredo/configuração operacional; valores válidos podem permitir fraude e caches/logs podem conservar cópias.
- **Escopo e provas:** allowlist pública mínima, DTO admin separado, snapshots negativos de todas as rotas públicas e detector de chaves sensíveis.
- **Risco e responsável:** mudança de contrato público; Backend/Security. Operadores de Correios/integrações devem rotacionar valores potencialmente expostos em ambiente autorizado.
- **Encerramento:** nenhuma resposta pública contém credencial ou campo interno; consumidores foram ajustados; rotação e invalidação de caches registradas externamente.

#### `FINAL-018` — simulador e upload privilegiado

- **Pré-condição/impacto:** preview/staging acessível ou flag incorreta expõe mutação de pedidos; bucket arbitrário com service role amplia escrita.
- **Escopo e provas:** excluir simulador do artefato público ou exigir identidade/segredo/allowlist; bucket/path definidos pelo servidor; matriz anônimo/customer/admin em production/preview e tentativas de bucket/path arbitrários.
- **Risco e responsável:** pode quebrar ferramentas internas; Backend/Security/Platform e owner Supabase para ACL/policies.
- **Encerramento:** nenhum ambiente público aceita mutação anônima e a credencial só alcança bucket/prefixo mínimo comprovado.

#### `FINAL-019` — bootstrap/admin ativo

- **Pré-condição/impacto:** credencial determinística pode ainda ser válida e duas despromoções podem deixar a loja sem admin ativo.
- **Escopo e provas:** revogação/rotação, remoção do segredo de documentação/script, bootstrap one-time e invariante transacional; duas despromoções simultâneas, admin bloqueado e recuperação auditada.
- **Risco e responsável:** lockout e histórico Git; Security + Backend + operador de identidade. Reescrita de histórico só com decisão explícita e coordenada.
- **Encerramento:** credencial revogada com evidência, nenhum segredo literal novo, e exatamente uma operação concorrente falha preservando ao menos um `ADMIN ACTIVE`.

#### `FINAL-020` — gate mínimo e evolução contínua

- **Pré-condição/impacto:** CI atual pode ficar verde com contrato, migration e concorrência quebrados; suites de integração também têm harness inconsistente.
- **Escopo e provas:** após `FINAL-013`, adicionar lock/install, lint/typecheck, migration-from-zero, HTTP/PostgreSQL e contract test do checkout; depois browser, a11y, concorrência, coverage e advisories. Mutação deliberada deve falhar no job correspondente.
- **Risco e responsável:** flake/custo de CI; DevEx/Test/Platform. Sandboxes externas ficam em smoke separado e controlado.
- **Encerramento:** gates obrigatórios, reproduzíveis em duas execuções limpas, com artefatos de falha úteis e sem depender de estado prévio.

#### `FINAL-002` — banco reproduzível

- **Pré-condição/impacto:** banco novo/restore não possui seis modelos e outros drifts; deploy ou DR pode iniciar estruturalmente incompleto.
- **Escopo e provas:** inventário de ambientes sem alterá-los, baseline ou migration corretiva revisável, `migrate deploy` do zero, diff estrutural e smoke de todos os modelos.
- **Risco e responsável:** checksums/dados de ambientes existentes; Database/Backend/Platform. Qualquer baseline de produção exige plano operacional separado.
- **Encerramento:** PostgreSQL vazio chega ao schema canônico sem diff e ambientes existentes têm estratégia de reconciliação aprovada, sem execução destrutiva nesta etapa.

#### `FINAL-003` — rollout de DDL e variantes

- **Pré-condição/impacto:** dados preenchidos podem falhar/perder histórico e a unicidade residual rejeita duas variantes do mesmo produto.
- **Escopo e provas:** expand/backfill/contract, checagens prévias, remoção controlada da constraint e fixtures com dados legados/duas variantes; rehearsal forward e plano de forward-fix.
- **Risco e responsável:** locks, volume e pooler; Database/Platform/Commerce com janela aprovada.
- **Encerramento:** migration funciona do zero e sobre fixture preenchida, preserva dados e aceita duas variantes; métricas/tempo/rollback operacional documentados.

#### `FINAL-001` — contrato do checkout

- **Pré-condição/impacto:** qualquer compra pela UI falha antes do gateway; correção parcial mantém 400 ou quebra na confirmação.
- **Escopo e provas:** contrato compartilhado tipado, rota/envelope únicos, variante preservada; contract test handler real + payload da UI e E2E browser PIX/cartão/boleto com gateway fake.
- **Risco e responsável:** tornar fluxo alcançável expõe riscos de `FINAL-004–009`/`011`; Frontend/Backend/Commerce. Não usar gateway real.
- **Encerramento:** browser conclui fluxo local determinístico, request/response validam sem casts e nenhuma chamada real é liberada antes dos gates transacionais.

### Onda 1 — identidade, autorização, segurança e integridade

#### `FINAL-005` — porta única e tenant

- **Pré-condição/impacto:** host/sessão/body/FKs podem representar lojas diferentes e `/api/orders` contorna checkout.
- **Escopo e provas:** remover ou internalizar criador alternativo, contexto tenant obrigatório e constraints compostas; matriz A/B por host/método e inserts negativos no PostgreSQL.
- **Risco e responsável:** dados legados podem violar novas constraints; Backend/Security/Database.
- **Encerramento:** só existe uma porta comercial, toda relação central prova o mesmo tenant e a reconciliação de registros legados está concluída ou bloqueada explicitamente.

#### `FINAL-011` — guest e account linking

- **Pré-condição/impacto:** visitante com e-mail de terceiro pode alterar PII e consumir pontos da conta.
- **Escopo e provas:** identidade guest separada; vínculo/OTP explícito para conta e pontos; contas A/B mostrando que guest não lê/altera wallet/PII.
- **Risco e responsável:** migração de guests e e-mails reciclados; Identity/Backend/Product e provider de e-mail em sandbox autorizado.
- **Encerramento:** e-mail sozinho nunca concede identidade; apenas sessão/OTP válido faz link auditável e idempotente.

#### `FINAL-012` — origem canônica do reset

- **Pré-condição/impacto:** `Origin`/`Referer` hostil pode colocar token no domínio do atacante; fallback pode escolher tenant errado.
- **Escopo e provas:** resolver URL a partir do domínio cadastrado/allowlisted do tenant e falhar fechado; headers hostis, host desconhecido e dois tenants.
- **Risco e responsável:** DNS/domínio incorreto; Identity/Security + owner de DNS/domínios.
- **Encerramento:** link sempre usa domínio canônico autorizado, nunca header do solicitante; tokens possivelmente expostos são revogados/expirados conforme política.

#### `FINAL-014` — ledger de fidelidade

- **Pré-condição/impacto:** IDs arbitrários, retries e fórmulas divergentes podem gerar BOLA, saldo incorreto e lançamentos duplicados.
- **Escopo e provas:** identidade de sessão, ledger append-only com idempotency key/origem, limites/aprovação e reconciliação; A/B, retry, refund fora de ordem e concorrência.
- **Risco e responsável:** saldos atuais podem não bater; Commerce/Backend/Database com owner financeiro para regras.
- **Encerramento:** wallet equivale à soma validada do ledger, cada efeito comercial gera no máximo um lançamento e discrepâncias legadas têm resolução registrada.

#### `FINAL-015` — estoque, variante e carrinho

- **Pré-condição/impacto:** produto pai/variante/cliente/servidor divergem e corridas podem baixar o SKU errado ou duplicar carrinho.
- **Escopo e provas:** fonte única por SKU, variant ID obrigatório, upsert/constraints atômicos e modelo único de carrinho; última unidade, duas variantes, duas abas e guest→login.
- **Risco e responsável:** reconciliação física dos saldos; Inventory/Commerce/Database.
- **Encerramento:** invariantes de saldo resistem à concorrência e todos os caminhos usam o mesmo SKU/carrinho, com migração de saldos aprovada.

#### `FINAL-016` — ciclo de vida de tokens

- **Pré-condição/impacto:** token/sessão bruto, reset sem CAS e logout fail-open permitem reutilização ou tomada após leitura de storage/log.
- **Escopo e provas:** hashes, consumo CAS, revogação/logout observável e provider obrigatório em produção; duas trocas concorrentes, falha DB e fixtures de dump/log.
- **Risco e responsável:** revogar sessões existentes pode desconectar usuários; Identity/Security/Operations.
- **Encerramento:** storage/log não recupera bearer bruto, apenas um reset vence e falha de logout não é reportada como sucesso.

#### `FINAL-017` — limites distribuídos e inputs

- **Pré-condição/impacto:** múltiplas réplicas/restarts ou headers forjados multiplicam cotas; bodies grandes amplificam DB/provider.
- **Escopo e provas:** store atômico compartilhado, cadeia de proxy confiável, limites Zod/body e batch/paginação; duas instâncias, spoof e valores limite/acima.
- **Risco e responsável:** indisponibilidade do store e falso positivo; Platform/Security/Backend com SRE para capacidade.
- **Encerramento:** política de fail-open/fail-closed está explícita, cota é global e inputs acima do teto falham antes de trabalho caro.

#### `FINAL-027` — logs, erros e correlação

- **Pré-condição/impacto:** PII/token/payload podem ir a logs/respostas e incidentes não têm correlação confiável.
- **Escopo e provas:** allowlist de contexto, sanitização recursiva, taxonomia pública e correlation ID gerado/propagado; fixtures aninhadas com PII/segredo e timeline ponta a ponta.
- **Risco e responsável:** sanitização excessiva pode prejudicar diagnóstico; Security/Observability/Backend, com owner de retenção/RBAC.
- **Encerramento:** valores sensíveis não aparecem em logs/respostas, ID liga request→gateway→webhook→efeitos e retenção/acesso são comprovados.

#### `FINAL-034` — grants/RLS versionados

- **Pré-condição/impacto:** acesso por roles/Data API pode herdar postura desconhecida; o estado externo continua `NOT VERIFIED`.
- **Escopo e provas:** migration de grants/RLS/default privileges cobrindo todas as tabelas; inspeção `pg_policies`/ACL e tentativas negativas por role em ambiente autorizado.
- **Risco e responsável:** owner/superuser pode ignorar RLS e políticas podem quebrar backend; DBA/Security/Supabase.
- **Encerramento:** repositório reproduz políticas, roles mínimas passam matriz positiva/negativa e o estado real foi verificado sem promover hipótese a fato antes disso.

#### `FINAL-035` — senha e enumeração

- **Pré-condição/impacto:** reset aceita política mais fraca e respostas/tempo distinguem estado de conta.
- **Escopo e provas:** política única, mensagens indistinguíveis, dummy hash válido e rate limit confiável; matriz de senhas e distribuição temporal local controlada.
- **Risco e responsável:** mudança de política e compatibilidade; Identity/Security/Product.
- **Encerramento:** cadastro/reset compartilham regra e amostra estatística não distingue de forma material conta inexistente/bloqueada, dentro de limiar documentado.

### Onda 2 — transações

#### `FINAL-004` — autoridade monetária e frete

- **Pré-condição/impacto:** cliente pode influenciar frete/parcelas e tipos monetários divergem, causando subcobrança e reconciliação incorreta.
- **Escopo e provas:** quote server-side com expiração/fingerprint, recálculo de total/juros/parcelas, constraints não negativas e representação monetária única; adulteração e rounding.
- **Risco e responsável:** contratos/tabelas dos providers; Commerce/Payments/Shipping/Database e owners Correios/J&T.
- **Encerramento:** nenhum campo financeiro do cliente é autoridade, valores convergem UI→pedido→gateway e quotes vencidas/alteradas são rejeitadas.

#### `FINAL-007` — CAS de estados e efeitos

- **Pré-condição/impacto:** dois atores usam o mesmo snapshot e duplicam estoque/pontos ou produzem estado impossível.
- **Escopo e provas:** `where id + expectedStatus`/versão, resultado idempotente e unicidade dos efeitos; barreiras reais com dezenas de requests.
- **Risco e responsável:** deadlocks/retries e compatibilidade de callers; Commerce/Backend/Database.
- **Encerramento:** uma única transição vence, perdedor recebe resultado estável e invariantes finais de pedido/estoque/ledger permanecem válidas.

#### `FINAL-006` — inbox de webhook

- **Pré-condição/impacto:** falha após insert torna reentrega inócua e pagamento/refund pode nunca atingir o domínio.
- **Escopo e provas:** estados, tentativas, lease, erro, transação dos efeitos e reconciliação; falha injetada após cada etapa, duplicata e fora de ordem.
- **Risco e responsável:** backlog e poison messages; Payments/Backend/Operations.
- **Encerramento:** evento falho é retomável, processado exatamente uma vez no efeito lógico, e itens sem pedido vão para fila operacional auditável.

#### `FINAL-008` — saga e estado incerto

- **Pré-condição/impacto:** timeout ou retry pode deixar cobrança duplicada, ativa com pedido cancelado ou pedido sem cobrança.
- **Escopo e provas:** operação durável tenant-scoped com fingerprint, chave obrigatória, `PAYMENT_UNKNOWN`, consulta e compensação idempotentes; mock stateful/sandbox cortando conexão em cada fronteira.
- **Risco e responsável:** banco e gateway nunca são atômicos; Payments/Backend/SRE e Asaas sandbox.
- **Encerramento:** todas as falhas convergem por retry/reconciliação sem duplicar cobrança, e estado incerto gera alerta/runbook em vez de cancelamento cego.

#### `FINAL-009` — cancelamento, refund e restore

- **Pré-condição/impacto:** admin/webhook pode concluir `CANCELLED` sem refund e restore suprime erro, deixando cliente cobrado/estoque errado.
- **Escopo e provas:** workflow separado e retomável, restore atômico local, refund idempotente; falha no segundo item, duplicata/tardio e concorrência.
- **Risco e responsável:** compensação remota nunca é transação local; Payments/Commerce/Inventory/Operations.
- **Encerramento:** pedido, gateway, estoque e ledger convergem ou ficam em estado pendente explícito com alerta; nenhum sucesso parcial silencioso.

### Onda 3 — arquitetura e contratos

#### `FINAL-026` — FSM, catálogo e auditoria admin

- **Pré-condição/impacto:** update/delete/tracking/timeline/taxonomia usam fontes paralelas e produto vendido pode ficar impossível de editar.
- **Escopo e provas:** FSM/timeline/audit log únicos, update de variante por ID, arquivamento e CRUD tenant-scoped; editar produto vendido, persistir tracking e matriz A/B.
- **Risco e responsável:** migração/deduplicação de catálogo e histórico; Backend/Admin/Database/Product.
- **Encerramento:** uma ação gera um histórico canônico, vendas antigas permanecem íntegros e taxonomia não exige intervenção direta no banco.

#### `FINAL-028` — modularização e tipagem

- **Pré-condição/impacto:** serviços homônimos, casts e componentes extensos propagam correções parciais; tamanho sozinho não é defeito.
- **Escopo e provas:** characterization tests, contratos compartilhados, remoção comprovada de duplicatas/ciclos e strictness incremental por módulo.
- **Risco e responsável:** refatoração ampla pode reabrir P0; Architecture/Backend/Frontend/DevEx.
- **Encerramento:** cada agregado tem porta clara, não há caminhos antigos alcançáveis e mutações comportamentais continuam cobertas pelos gates.

### Onda 4 — experiência e performance

#### `FINAL-022` — paginação, agregação e índices

- **Pré-condição/impacto:** catálogo/relatórios/histórico crescem sem limite e paginação não total pode perder/duplicar dados.
- **Escopo e provas:** filtros/selects/agregações server-side, cursores totais e índices baseados em EXPLAIN; seeds de cardinalidade crescente e limites de linhas/bytes.
- **Risco e responsável:** índices penalizam escrita e busca pode exigir solução própria; Backend/Database/Frontend.
- **Encerramento:** custo por request fica limitado nos datasets-alvo, navegação não perde/duplica registro e planos medidos justificam cada índice.

#### `FINAL-023` — acessibilidade do funil

- **Pré-condição/impacto:** cards/frete/campos/seleções podem impedir compra por teclado/leitor de tela.
- **Escopo e provas:** links/inputs/radios/fieldset nativos, labels, autocomplete, erro e foco; E2E apenas teclado, árvore acessível e leitor de tela.
- **Risco e responsável:** mudança de markup/CSS; Frontend/Design/A11y/Product.
- **Encerramento:** jornada catálogo→checkout→confirmação é completável sem ponteiro e estados/erros são anunciados nos browsers suportados.

#### `FINAL-024` — foco em overlays

- **Pré-condição/impacto:** menu fechado continua tabulável e dialogs deixam foco escapar/desaparecer.
- **Escopo e provas:** Radix ou padrão modal completo; Tab/Shift+Tab/Escape, foco inicial/retorno e ausência de controles fechados na ordem.
- **Risco e responsável:** overlays aninhados; Frontend/Design/A11y.
- **Encerramento:** foco permanece contido/restaurado e DOM fechado está desmontado ou inert em mobile/desktop.

#### `FINAL-025` — URLs e descoberta

- **Pré-condição/impacto:** produto/facetas vivem em estado React e não podem ser indexados, compartilhados ou recarregados de forma estável.
- **Escopo e provas:** rotas SSR por slug, links/query strings, canonical/robots/sitemap tenant-aware; HTML sem JS, deep link/back/reload e dois hosts.
- **Risco e responsável:** crawl traps e domínios duplicados; Frontend/SEO/Product + DNS/Platform.
- **Encerramento:** toda entidade pública tem URL/canonical válida e sitemap não vaza host/rota privada nem cria combinações infinitas.

#### `FINAL-029` — estados reais e latência percebida

- **Pré-condição/impacto:** falhas aparecem como zero/vazio e chamadas sequenciais induzem retry/abandono.
- **Escopo e provas:** estados discriminados, retry seguro, prefetch/server data e paralelismo fora da transação; 4xx/5xx/offline/timeout.
- **Risco e responsável:** retry pode duplicar efeito sem `FINAL-008`; Frontend/Backend/Product.
- **Encerramento:** erro nunca é apresentado como estado legítimo e retries observáveis não duplicam pedido/pagamento.

#### `FINAL-030` — mídia e movimento

- **Pré-condição/impacto:** hero pesado/revelação tardia e imagens não responsivas elevam LCP/bytes; movimento ignora preferência.
- **Escopo e provas:** conteúdo/poster imediato, vídeo não crítico/lazy, imagens responsivas e ramo reduce; Lighthouse/Web Vitals, budget de bytes e emulação.
- **Risco e responsável:** CDN/imagens tenant reais; Frontend/Design/Performance/Platform.
- **Encerramento:** budgets acordados passam nos perfis definidos e `reduce` elimina autoplay/animação não essencial sem ocultar conteúdo.

#### `FINAL-031` — semântica e foco visível

- **Pré-condição/impacto:** falta de main/skip/headings e erro associado dificulta orientação e recuperação.
- **Escopo e provas:** landmarks, hierarquia, skip link, `focus-visible` e `aria-describedby/live`; axe, teclado, leitor de tela, zoom/reflow.
- **Risco e responsável:** tokens de cor configuráveis; Frontend/Design/A11y.
- **Encerramento:** zero violação bloqueadora acordada, foco visível e estrutura/nome/erro coerentes em páginas centrais.

#### `FINAL-032` — metadata, CSP e recovery web

- **Pré-condição/impacto:** rotas privadas podem ser indexadas, templates não escapam e CSP oferece defesa reduzida; erro/404 são genéricos.
- **Escopo e provas:** metadata/noindex/JSON-LD por rota, escape de HTML, CSP report-only→enforced e boundaries acessíveis; parse de headers/HTML/404.
- **Risco e responsável:** CSP pode quebrar scripts e CDN pode sobrescrever header; Security/Frontend/SEO/Platform.
- **Encerramento:** metadata valida, entradas aparecem como texto, CSP sem permissões temporárias não justificadas e erros preservam navegação/telemetria.

#### `FINAL-036` — idioma, moeda e retorno

- **Pré-condição/impacto:** carrinho mistura idioma/símbolo e login perde contexto.
- **Escopo e provas:** formatter BRL/pt-BR central e `next` interno allowlisted; testes de locale e open redirect.
- **Risco e responsável:** baixo; Frontend/Product.
- **Encerramento:** strings/valores centrais seguem pt-BR/BRL e retorno só aceita caminho relativo seguro preservando a intenção.

### Onda 5 — operação e manutenção

#### `FINAL-021` — jobs, outbox e supervisão

- **Pré-condição/impacto:** scheduler ausente, lote parcial ou término do processo pode prender estoque/pontos e perder e-mail; scheduler externo atual é desconhecido.
- **Escopo e provas:** agenda/IaC, claim com lease, outbox/worker, retry/DLQ, heartbeat e sinalização de parcial; kill/restart entre lotes/efeitos.
- **Risco e responsável:** limites serverless/provedor; Platform/SRE/Backend e owner do scheduler.
- **Encerramento:** execução retoma sem duplicar, backlog/idade/falha alertam e a agenda efetiva corresponde ao repositório.

#### `FINAL-033` — release e recuperação reproduzíveis

- **Pré-condição/impacto:** build não prova promoção/migration/rollback; env, proxy, health, telemetry e backup são externos ou incompletos.
- **Escopo e provas:** artefato imutável, promoção, preflight/migrate/smoke/rollback, schema de env, trust proxy, health/shutdown/traces e restore drill.
- **Risco e responsável:** impacto organizacional/infra; Platform/SRE/DBA/Security, com owners de hosting/CDN/telemetria/backup.
- **Encerramento:** deploy efêmero e rollback passam, restore mede RPO/RTO, headers forjados falham fora do proxy e dashboards/alertas detectam cenários críticos.

## 7. Cobertura dos 198 IDs de origem

Formato: `ID [severidade/confiança de origem]`. A severidade/confiança consolidadas estão na matriz da seção 5; diferenças de origem foram preservadas e não foram reescritas retrospectivamente.

| Grupo | IDs de origem preservados |
|---|---|
| `FINAL-001` | `ARCH-001 [BLOCKER/CONFIRMED]`, `BE-001 [BLOCKER/CONFIRMED]`, `CTR-001 [BLOCKER/CONFIRMED]`, `FUX-001 [BLOCKER/CONFIRMED]` |
| `FINAL-002` | `ARCH-002 [BLOCKER/CONFIRMED]`, `DB-001 [BLOCKER/CONFIRMED]`, `INF-001 [BLOCKER/CONFIRMED]` |
| `FINAL-003` | `DB-002 [CRITICAL/CONFIRMED]`, `DB-010 [HIGH/CONFIRMED]`, `INF-002 [CRITICAL/CONFIRMED]` |
| `FINAL-004` | `ARCH-003 [CRITICAL/CONFIRMED]`, `DB-009 [HIGH/CONFIRMED]`, `BE-003 [CRITICAL/CONFIRMED]`, `CTR-006 [CRITICAL/CONFIRMED]`, `CTR-010 [HIGH/CONFIRMED]`, `CTR-015 [MEDIUM/CONFIRMED]`, `FUX-002 [HIGH/CONFIRMED]`, `ADM-002 [HIGH/CONFIRMED]` |
| `FINAL-005` | `ARCH-004 [CRITICAL/CONFIRMED]`, `DB-006 [HIGH/CONFIRMED]`, `DB-011 [HIGH/CONFIRMED]`, `BE-004 [CRITICAL/HIGH CONFIDENCE]`, `CTR-002 [CRITICAL/CONFIRMED]`, `AUTH-005 [HIGH/CONFIRMED]`, `SEC-006 [HIGH/CONFIRMED]` |
| `FINAL-006` | `ARCH-005 [CRITICAL/CONFIRMED]`, `DB-004 [CRITICAL/CONFIRMED]`, `BE-005 [CRITICAL/HIGH CONFIDENCE]`, `CTR-003 [CRITICAL/CONFIRMED]`, `CTR-009 [HIGH/CONFIRMED]`, `SEC-013 [HIGH/CONFIRMED]`, `OBS-001 [CRITICAL/CONFIRMED]` |
| `FINAL-007` | `ARCH-006 [CRITICAL/HIGH CONFIDENCE]`, `DB-003 [CRITICAL/CONFIRMED]`, `DB-012 [MEDIUM/CONFIRMED]`, `BE-006 [CRITICAL/HIGH CONFIDENCE]`, `CTR-005 [CRITICAL/CONFIRMED]` |
| `FINAL-008` | `ARCH-007 [HIGH/HIGH CONFIDENCE]`, `BE-007 [HIGH/CONFIRMED]`, `CTR-004 [CRITICAL/HIGH CONFIDENCE]`, `CTR-007 [HIGH/CONFIRMED]`, `CTR-011 [HIGH/CONFIRMED]`, `CTR-012 [HIGH/CONFIRMED]`, `SEC-012 [HIGH/CONFIRMED]`, `OBS-003 [HIGH/HIGH CONFIDENCE]`, `OBS-010 [MEDIUM/CONFIRMED]` |
| `FINAL-009` | `DB-005 [CRITICAL/CONFIRMED]`, `BE-012 [HIGH/CONFIRMED]`, `CTR-008 [HIGH/CONFIRMED]`, `CTR-014 [HIGH/CONFIRMED]`, `CQ-001 [HIGH/CONFIRMED]`, `OBS-002 [HIGH/CONFIRMED]`, `OBS-005 [HIGH/CONFIRMED]`, `ADM-001 [CRITICAL/CONFIRMED]` |
| `FINAL-010` | `BE-002 [CRITICAL/CONFIRMED]`, `AUTH-001 [CRITICAL/CONFIRMED]`, `SEC-001 [CRITICAL/CONFIRMED]`, `ADM-007 [HIGH/CONFIRMED]` |
| `FINAL-011` | `AUTH-002 [CRITICAL/CONFIRMED]`, `SEC-002 [CRITICAL/CONFIRMED]` |
| `FINAL-012` | `BE-009 [HIGH/CONFIRMED]`, `AUTH-003 [CRITICAL/HIGH CONFIDENCE]`, `SEC-003 [CRITICAL/HIGH CONFIDENCE]` |
| `FINAL-013` | `TST-005 [CRITICAL/CONFIRMED]` |
| `FINAL-014` | `ARCH-009 [HIGH/CONFIRMED]`, `DB-007 [HIGH/CONFIRMED]`, `BE-008 [HIGH/CONFIRMED]`, `CTR-013 [HIGH/CONFIRMED]`, `AUTH-004 [HIGH/CONFIRMED]`, `SEC-005 [HIGH/CONFIRMED]`, `ADM-003 [HIGH/CONFIRMED]` |
| `FINAL-015` | `DB-008 [HIGH/CONFIRMED]`, `BE-011 [HIGH/HIGH CONFIDENCE]`, `CTR-016 [HIGH/CONFIRMED]`, `FUX-003 [HIGH/CONFIRMED]`, `ADM-010 [MEDIUM/CONFIRMED]` |
| `FINAL-016` | `AUTH-006 [HIGH/HIGH CONFIDENCE]`, `AUTH-007 [HIGH/CONFIRMED]`, `AUTH-009 [HIGH/CONFIRMED]`, `SEC-007 [HIGH/CONFIRMED]`, `SEC-008 [HIGH/HIGH CONFIDENCE]`, `SEC-009 [HIGH/CONFIRMED]`, `SEC-021 [MEDIUM/CONFIRMED]`, `INF-006 [HIGH/CONFIRMED]` |
| `FINAL-017` | `ARCH-011 [MEDIUM/HIGH CONFIDENCE]`, `AUTH-008 [HIGH/HIGH CONFIDENCE]`, `SEC-010 [HIGH/HIGH CONFIDENCE]`, `SEC-015 [HIGH/HIGH CONFIDENCE]`, `PERF-005 [HIGH/CONFIRMED]`, `PERF-008 [MEDIUM/CONFIRMED]` |
| `FINAL-018` | `BE-010 [HIGH/CONFIRMED]`, `AUTH-010 [HIGH/HIGH CONFIDENCE]`, `AUTH-011 [HIGH/CONFIRMED]`, `SEC-011 [HIGH/CONFIRMED]`, `SEC-014 [HIGH/HIGH CONFIDENCE]`, `INF-009 [HIGH/CONFIRMED]` |
| `FINAL-019` | `AUTH-012 [HIGH/HIGH CONFIDENCE]`, `AUTH-015 [HIGH/CONFIRMED]`, `SEC-004 [HIGH/CONFIRMED]`, `SEC-020 [HIGH/HIGH CONFIDENCE]`, `INF-005 [HIGH/HIGH CONFIDENCE]`, `ADM-004 [HIGH/CONFIRMED]` |
| `FINAL-020` | `ARCH-012 [HIGH/CONFIRMED]`, `DB-017 [MEDIUM/CONFIRMED]`, `BE-017 [MEDIUM/CONFIRMED]`, `FUX-015 [INFORMATIONAL/CONFIRMED]`, `TST-001 [HIGH/CONFIRMED]`, `TST-002 [HIGH/CONFIRMED]`, `TST-003 [HIGH/CONFIRMED]`, `TST-004 [HIGH/CONFIRMED]`, `TST-006 [MEDIUM/HIGH CONFIDENCE]`, `TST-007 [MEDIUM/CONFIRMED]`, `TST-008 [MEDIUM/CONFIRMED]`, `TST-009 [MEDIUM/HIGH CONFIDENCE]`, `TST-010 [MEDIUM/CONFIRMED]`, `PERF-010 [MEDIUM/CONFIRMED]`, `CQ-005 [MEDIUM/CONFIRMED]`, `CQ-006 [MEDIUM/CONFIRMED]`, `ADM-011 [MEDIUM/CONFIRMED]`, `OBS-014 [LOW/CONFIRMED]` |
| `FINAL-021` | `ARCH-013 [MEDIUM/SUSPECTED]`, `INF-007 [HIGH/CONFIRMED]`, `OBS-006 [MEDIUM/CONFIRMED]`, `OBS-007 [MEDIUM/CONFIRMED]` |
| `FINAL-022` | `DB-013 [MEDIUM/CONFIRMED]`, `DB-014 [MEDIUM/CONFIRMED]`, `DB-015 [MEDIUM/SUSPECTED]`, `BE-015 [MEDIUM/CONFIRMED]`, `FUX-007 [MEDIUM/HIGH CONFIDENCE]`, `FUX-009 [MEDIUM/CONFIRMED]`, `PERF-001 [HIGH/CONFIRMED]`, `PERF-007 [HIGH/CONFIRMED]`, `PERF-009 [MEDIUM/SUSPECTED]` |
| `FINAL-023` | `FUX-004 [HIGH/CONFIRMED]`, `WEB-005 [HIGH/CONFIRMED]`, `WEB-006 [HIGH/CONFIRMED]`, `WEB-007 [HIGH/CONFIRMED]` |
| `FINAL-024` | `FUX-005 [HIGH/CONFIRMED]`, `WEB-008 [HIGH/CONFIRMED]` |
| `FINAL-025` | `FUX-006 [MEDIUM/CONFIRMED]`, `WEB-001 [HIGH/CONFIRMED]`, `WEB-002 [HIGH/CONFIRMED]` |
| `FINAL-026` | `ARCH-008 [HIGH/CONFIRMED]`, `BE-013 [MEDIUM/CONFIRMED]`, `ADM-005 [HIGH/CONFIRMED]`, `ADM-006 [MEDIUM/CONFIRMED]`, `ADM-008 [HIGH/CONFIRMED]`, `ADM-009 [MEDIUM/CONFIRMED]`, `ADM-012 [MEDIUM/CONFIRMED]` |
| `FINAL-027` | `BE-014 [MEDIUM/CONFIRMED]`, `BE-016 [MEDIUM/CONFIRMED]`, `SEC-018 [MEDIUM/CONFIRMED]`, `OBS-004 [HIGH/CONFIRMED]`, `OBS-008 [MEDIUM/CONFIRMED]`, `OBS-012 [MEDIUM/CONFIRMED]`, `OBS-013 [MEDIUM/CONFIRMED]` |
| `FINAL-028` | `ARCH-010 [MEDIUM/CONFIRMED]`, `CQ-003 [MEDIUM/CONFIRMED]`, `CQ-004 [MEDIUM/CONFIRMED]`, `CQ-007 [MEDIUM/CONFIRMED]`, `CQ-008 [LOW/HIGH CONFIDENCE]`, `CQ-009 [LOW/CONFIRMED]`, `CQ-010 [MEDIUM/CONFIRMED]` |
| `FINAL-029` | `FUX-008 [HIGH/CONFIRMED]`, `FUX-010 [MEDIUM/CONFIRMED]`, `PERF-004 [MEDIUM/HIGH CONFIDENCE]`, `PERF-006 [HIGH/CONFIRMED]`, `CQ-002 [MEDIUM/CONFIRMED]` |
| `FINAL-030` | `FUX-011 [MEDIUM/CONFIRMED]`, `PERF-002 [HIGH/HIGH CONFIDENCE]`, `PERF-003 [MEDIUM/CONFIRMED]`, `WEB-010 [MEDIUM/CONFIRMED]` |
| `FINAL-031` | `FUX-012 [MEDIUM/CONFIRMED]`, `WEB-009 [MEDIUM/CONFIRMED]`, `WEB-011 [MEDIUM/CONFIRMED]` |
| `FINAL-032` | `SEC-016 [MEDIUM/CONFIRMED]`, `SEC-017 [MEDIUM/CONFIRMED]`, `WEB-003 [MEDIUM/CONFIRMED]`, `WEB-004 [MEDIUM/HIGH CONFIDENCE]`, `WEB-012 [MEDIUM/CONFIRMED]`, `WEB-013 [LOW/CONFIRMED]` |
| `FINAL-033` | `INF-003 [HIGH/CONFIRMED]`, `INF-008 [MEDIUM/NOT VERIFIED]`, `INF-010 [MEDIUM/CONFIRMED]`, `INF-011 [MEDIUM/CONFIRMED]`, `INF-012 [MEDIUM/CONFIRMED]`, `INF-013 [MEDIUM/CONFIRMED]`, `INF-014 [MEDIUM/SUSPECTED]`, `OBS-009 [MEDIUM/CONFIRMED]`, `OBS-011 [MEDIUM/CONFIRMED]`, `CQ-011 [LOW/CONFIRMED]` |
| `FINAL-034` | `DB-016 [MEDIUM/NOT VERIFIED]`, `INF-004 [HIGH/CONFIRMED]` |
| `FINAL-035` | `AUTH-013 [MEDIUM/CONFIRMED]`, `AUTH-014 [MEDIUM/CONFIRMED]`, `SEC-019 [MEDIUM/CONFIRMED]` |
| `FINAL-036` | `FUX-013 [LOW/CONFIRMED]`, `FUX-014 [LOW/CONFIRMED]` |

## 8. Serviços e estados que exigem ambiente autorizado

| Serviço/estado real | Comportamento a verificar depois | Responsável externo esperado | Evidência mínima para encerramento |
|---|---|---|---|
| PostgreSQL/Prisma/pooler | locks, isolamento, CAS, migrations, checksums e compatibilidade de dados | DBA/Platform | PostgreSQL descartável + rehearsal anonimizado/estrutural, planos e logs de migration |
| Asaas | PIX/cartão/boleto, timeout ambíguo, idempotência, eventos duplicados/fora de ordem e refund | Payments/financeiro + conta sandbox | traces sanitizados de sandbox e reconciliação convergente, sem dados reais |
| Supabase Storage | bucket/prefixo, service role, URL pública/assinada e quotas | Platform/Security | matriz negativa de bucket/path e ACL/policy exportada |
| Supabase/PostgreSQL RLS/ACL | grants, default privileges, policies e roles efetivas | DBA/Security | dump sanitizado de `pg_policies`/ACL e testes por role |
| Resend/e-mail | entrega, domínio, retry, retenção e não vazamento de token | Identity/Operations | sandbox/caixa controlada, headers e logs sanitizados |
| Correios | autenticação, tarifas, prazo, expiração e rotação de credencial | Shipping/Operations | contrato/sandbox ou fixture stateful autorizada |
| J&T | tabelas/geocom, tarifas, vigência e reconciliação | Shipping/Operations | dataset versionado ou sandbox autorizado |
| ViaCEP | timeout, limites e respostas incompletas | Frontend/Platform | mock contratual + smoke autorizado sem PII |
| Scheduler/worker | agenda, retry, concorrência, heartbeat e DLQ | Platform/SRE | IaC/config exportada, kill/restart e alerta de atraso |
| Hosting/CDN/proxy | réplicas, trust de forwarded headers, cache e shutdown | Platform/SRE | diagrama/config revisável e teste de headers forjados |
| Logs/métricas/traces/alertas | backend, RBAC, retenção, correlação e alertas | Observability/Security | dashboard/alerta testado com payload sanitizado |
| Backup/PITR/restore | frequência, retenção, RPO/RTO e restore | DBA/SRE | restore drill em ambiente isolado com tempos medidos |

Nenhum desses estados foi consultado ou modificado nesta etapa. `INF-008` e `DB-016` continuam `NOT VERIFIED`; `ARCH-013`, `DB-015`, `PERF-009` e `INF-014` continuam `SUSPECTED` onde aplicável.

## 9. Evidências, comandos e resultados desta etapa

| Comando/verificação | Resultado |
|---|---|
| `git rev-parse HEAD` | `0c7ef7ddfa5fb4520c4bc794163cbc71257c2bc4`, igual à revisão declarada na auditoria final. |
| `git status --short` | Antes da escrita, somente `docs/audits/` estava não rastreado; nenhum arquivo de produto alterado. |
| Inventário `docs/audits/*-AUDIT.md` | 15 relatórios presentes, incluindo a consolidação. |
| Parser local de headings/campos | 198 IDs únicos; distribuição de severidade/confiança igual à consolidação. |
| Comparação do mapa de deduplicação | 198 referências, 198 únicas, 0 ausente e 0 extra. |
| `Get-FileHash -Algorithm SHA256` nos 14 relatórios de origem | Hashes completos conferem com os prefixos registrados em `FINAL-AUDIT.md`. |
| `rg --files app/api/checkout` e leitura de UI/schema/handler/envelope | Apenas `/api/checkout`; rota/payload/envelope incompatíveis confirmados. |
| Parser `model` × `CREATE TABLE` | 22 modelos, 16 tabelas criadas, seis modelos sem `CREATE TABLE`. |
| Leitura de webhook/schema | Insert ocorre antes dos efeitos; registro existente encerra como `ALREADY_PROCESSED`; sem FSM de processamento. |
| Leitura de produto/loja públicos | `loja: true` e `correiosPassword` em seleção pública confirmados. |
| Leitura de checkout guest | Upsert por e-mail atualiza PII e alimenta resgate de pontos. |
| Leitura de forgot-password | `Origin`/`Referer` controla `originUrl`; fallback de tenant confirmado. |
| Leitura de `tests/setup/db.ts` e `lib/prisma.ts` | URL validada pode diferir da datasource usada; allowlist por substring e deleções globais confirmadas. |
| `npm.cmd run test:unit` | **Falhou antes de iniciar:** `vitest` não reconhecido; `node_modules` ausente. |
| `npm.cmd run lint` | **Falhou antes de iniciar:** `eslint` não reconhecido. |
| `npm.cmd run build` | **Falhou antes de iniciar:** `prisma` não reconhecido. |

## 10. Limitações e risco residual

- `node_modules/` e `.next/` não existem. Os guias locais do Next exigidos por `AGENTS.md` também não existem sem `node_modules`; como nenhum código Next foi alterado, esta etapa permaneceu documental.
- Nenhuma dependência foi instalada, nenhum servidor/browser/banco foi iniciado e nenhuma suite chegou ao runner.
- Não houve acesso a `.env`, segredo, produção, cloud, conta de terceiro, gateway, provider de e-mail, storage ou banco real.
- A revalidação foi amostral: 29 grupos continuam `NOT VERIFIED nesta triagem` e precisam de confirmação item a item antes de qualquer patch.
- Os sete grupos `VALID` foram comprovados estaticamente; ausência de execução dinâmica limita detalhes de interleaving, provider e infraestrutura, mas não remove as condições determinísticas descritas.
- Os relatórios em `docs/audits/` já estavam não rastreados e foram preservados sem edição.
- O estado continua **BLOCKED**. Não há base para `APPROVED`, `READY` ou redução de severidade residual.

## 11. IDs tratados e pendentes

- **Tratados nesta etapa de planejamento:** `FINAL-001` a `FINAL-036` foram inventariados, deduplicados, priorizados e receberam dependências, prompt, provas, risco, owner e critério de encerramento; os 198 IDs de origem estão preservados na seção 7.
- **Revalidados como VALID, mas não corrigidos:** `FINAL-001`, `FINAL-002`, `FINAL-006`, `FINAL-010`, `FINAL-011`, `FINAL-012`, `FINAL-013`.
- **Pendentes de revalidação:** `FINAL-003` a `FINAL-005`, `FINAL-007` a `FINAL-009` e `FINAL-014` a `FINAL-036`, excetuados os grupos revalidados acima.
- **Pendentes de correção:** todos os 36 grupos. Nenhuma remediação de produto foi iniciada.
