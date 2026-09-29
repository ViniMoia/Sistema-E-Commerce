# Etapa 07 — Correções do painel administrativo

**Data:** 2026-09-27  
**Fontes:** `docs/audits/FINAL-AUDIT.md`, `ADMIN-AUDIT.md`, `AUTH-AUDIT.md`, `SECURITY-AUDIT.md` e `docs/remediation/PLAN.md`  
**Escopo executado:** catálogo/estoque, pedidos, frete, papéis e fidelidade; sem produção, contas reais, gateway, cloud ou credenciais reais  
**Estado de publicação:** `BLOCKED` — o painel não inicia reembolso e não existe reconciliação financeira autorizada/testada

## Resultado por ID

Os estados abaixo resultam da comparação do relatório com o código atual e dos testes locais. `NOT VERIFIED` não foi promovido a defeito confirmado.

| ID | Severidade / confiança originais | Veredito atual | Correção ou evidência | Residual / pendência |
|---|---|---|---|---|
| `ADM-001` | CRITICAL / CONFIRMED | `VALID`; contenção `FIXED`, workflow `DEFERRED` | Admin não pode mais executar `PAID -> CANCELLED`; o serviço devolve `REFUND_REQUIRED` antes de qualquer efeito, a API responde 409 e a UI não oferece a transição. Só o webhook autenticado informa `paymentRefundConfirmed`. | **HIGH**: falta comando idempotente de refund, estados de processamento, retry e reconciliação Asaas. |
| `ADM-002` | HIGH / CONFIRMED | `FIXED` | Schema estrito compartilhado, revalidação no serviço e constraint já presente impedem frete negativo, não finito, string e campos extras. | **LOW** local; dados existentes em ambientes externos são `NOT VERIFIED`. |
| `ADM-003` | HIGH / CONFIRMED | `FIXED` para retry/limite/confirmação; governança `DEFERRED` | UUID idempotente por loja, convergência de corrida por unicidade, conflito 409, teto técnico configurável e confirmação com cliente/pontos/equivalente/motivo. | **MEDIUM**: teto requer homologação; não há dupla aprovação nem reversão vinculada. |
| `ADM-004` | HIGH / CONFIRMED | `ALREADY RESOLVED` | A etapa 01 moveu alvo/ator/contagem para transação `Serializable`, conta apenas `ADMIN ACTIVE` e revalida o ator. Regressões continuam verdes. | **LOW**; procedimento de recuperação externa continua operacional. |
| `ADM-005` | HIGH / CONFIRMED | `FIXED` para edição segura; arquivamento `DEFERRED` | IDs de variantes atravessam UI/DTO; existentes são atualizadas, novas são criadas e omissão de variante histórica é recusada antes de mutação. Não há mais `deleteMany` na edição. | **MEDIUM**: remoção/arquivamento de variante exige modelo próprio. |
| `ADM-006` | MEDIUM / CONFIRMED | `FIXED` para proteção/semântica; soft delete `DEFERRED` | Produto referenciado por pedido ou carrinho retorna 409 sem efeito; delete elegível é transacional/auditado; os diálogos agora descrevem exclusão física e irreversível. | **MEDIUM**: produto ainda não possui `archivedAt`/restore. |
| `ADM-007` | HIGH / CONFIRMED | `ALREADY RESOLVED` | A etapa 01 criou DTO allowlist de settings e eliminou `correiosPassword` das respostas e do estado cliente. | **MEDIUM** externo: rotação de qualquer valor antes exposto permanece pendente e nenhum segredo foi lido. |
| `ADM-008` | HIGH / CONFIRMED | `FIXED parcial` / `DEFERRED parcial` | Timeline de status já era canônica; produto, preço, estoque, frete, notas e rastreio agora auditam na mesma transação. Notas registram apenas presença/comprimento, sem conteúdo. | **MEDIUM**: settings da loja e configuração de fidelidade ainda não usam a trilha uniforme; retenção/request ID precisam de contrato. |
| `ADM-009` | MEDIUM / CONFIRMED | `ALREADY RESOLVED` | A etapa 05 adotou schema estrito e persiste rastreio junto da transição e do histórico. | **LOW**; homologação visual/E2E continua pendente. |
| `ADM-010` | MEDIUM / CONFIRMED | `FIXED` para a fonte local | Estoque pai é derivado da soma das variantes no servidor e exibido como somente leitura; valor paralelo enviado pelo cliente é ignorado. | **MEDIUM**: divergência legada e eventual ERP são `NOT VERIFIED`; falta reconciliação/backfill autorizado. |
| `ADM-011` | MEDIUM / CONFIRMED | `FIXED parcial` / `DEFERRED parcial` | Contrato `newStatus` e histórico foram atualizados; testes unitários de autorização e invariantes PostgreSQL entraram no gate `test:integration:core`. | **MEDIUM**: matriz HTTP/E2E completa anon/customer/admin e a suíte legada ainda exigem saneamento de fixtures. |
| `ADM-012` | MEDIUM / CONFIRMED | `DEFERRED` | A ausência do CRUD/associação de marcas e categorias foi reconfirmada. Não foi improvisado um módulo sem decisão de produto, política de slug e arquivamento. | **MEDIUM** até decisão explícita de escopo. |

Cupons e ações em lote continuam **não aplicáveis nesta revisão**, porque nenhum subsistema correspondente existe. Isso não foi convertido em defeito. Clientes possuem consulta administrativa, mas nenhuma mutação de cadastro foi encontrada neste escopo.

## Correções por causa raiz

### 1. Cancelamento local confundido com reembolso (`ADM-001`)

**Antes:** `PAID -> CANCELLED` liberava estoque e revertia pontos sem prova de estorno financeiro.  
**Depois:** o painel e a API falham fechados antes da transação; somente um evento de refund já autenticado pode confirmar o caminho de cancelamento pago.

Teste comportamental: uma tentativa administrativa mantém pedido, estoque, ledger e auditoria inalterados; o adapter/webhook fictício confirmado mantém o fluxo legítimo. Não houve chamada real ao Asaas.

### 2. Entrada administrativa sem invariante server-side (`ADM-002`, `ADM-003`)

- Frete usa schema Zod estrito compartilhado no boundary e no serviço; tenant/ator vêm da sessão.
- Ajuste de pontos exige chave UUID e aplica exatamente uma intenção mesmo com duas chamadas concorrentes.
- A mesma chave com argumentos diferentes falha com 409; valores acima do teto falham antes do ledger.
- As duas interfaces pedem confirmação contextual e reutilizam a chave enquanto a intenção é a mesma.

### 3. Catálogo histórico tratado como cadastro descartável (`ADM-005`, `ADM-006`, `ADM-010`)

- Edição preserva os IDs históricos e atualiza cada variante; não apaga e recria a grade.
- Tentativa de omitir variante persistida falha antes de preço, estoque ou auditoria mudarem.
- Estoque agregado é calculado das variantes no servidor.
- Exclusão consulta referências de pedido/carrinho e falha com conflito sem evento parcial.
- Create/update/delete permitidos registram ator, tenant, entidade e snapshots na transação.

Arquivamento não foi criado nesta etapa: ele altera modelo, consultas de vitrine/cache e recuperação, portanto exige migração vertical própria.

### 4. Auditoria fragmentada (`ADM-008`, correlato `ADM-009`)

Além de papel, status e ledger já existentes, produto, frete, notas e rastreio passaram a gravar `AuditLog` atomicamente. O conteúdo livre de `adminNotes` é redigido: a trilha contém somente presença e comprimento. Uma tentativa de alterar pedido de outra loja retorna ausência e não chama update/audit.

Settings e configuração de fidelidade permanecem fora dessa cobertura; o achado global não foi marcado como integralmente resolvido.

### 5. Revalidações sem duplicação de código (`ADM-004`, `ADM-007`, `ADM-009`, `ADM-011`)

As correções anteriores de último administrador ativo, DTO público sem segredo, rastreio na transição e contrato de status foram reexecutadas nas suítes focais/completas e classificadas como `ALREADY RESOLVED`. Nenhuma implementação paralela foi criada.

## Matriz de autorização e efeitos negados

| Ator/cenário | Resultado verificado localmente |
|---|---|
| Anônimo | Guard compartilhado rejeita as rotas protegidas; unitários de controle de acesso verdes. |
| `CUSTOMER` | Ajuste administrativo de pontos recebe 403; guard de admin permanece server-side. |
| `ADMIN` da loja A | Atua somente com `lojaID` e `actorId` derivados da sessão. |
| `ADMIN` A sobre recurso da loja B | Produto, frete e pedido não são alterados nem auditados; testes verificam ausência de efeito parcial. |
| Repetição/concorrência | Ajuste de pontos com a mesma intenção converge em um ledger e uma atualização de carteira no PostgreSQL. |

A matriz HTTP completa com cookie real para todas as rotas é `NOT VERIFIED`; os resultados acima combinam testes de guard/serviço e integração real de banco, sem afirmar E2E não executado.

## Evidências antes/depois e testes

| Grupo | Prova antes | Prova depois |
|---|---|---|
| Baseline administrativo | Suítes focais existentes | 6 arquivos, 30/30 testes, exit 0. |
| Refund/cancelamento | Admin pago produzia efeitos locais | 4 arquivos, 33/33; tentativa bloqueada sem efeitos; typecheck 0. |
| Frete | POST aceitava entrada sem schema | 3 arquivos, 23/23; payloads negativos/não finitos/strings/extras recusados. |
| Pontos | Retry criava novos créditos | 5 arquivos, 40/40; foco posterior 2 arquivos, 13/13; concorrência real exatamente uma vez. |
| Produto/variantes | Edição usava `deleteMany`; estoques independentes | 4 arquivos, 24/24; IDs preservados, soma derivada, conflitos atômicos. |
| Auditoria de produto/frete | Ausente | 4 arquivos, 25/25; mutação e log compartilham transação. |
| Auditoria de notas/rastreio | Update direto, sem histórico | Primeira execução: 1 expectativa da fixture falhou por comprimentos incorretos (25/21); corrigida para 26/22. Resultado final focal: 2 arquivos, 7/7. |
| Unitários completos | — | 68 arquivos, 475/475, exit 0. |
| PostgreSQL descartável | Primeira tentativa de `admin-invariants` falhou antes dos casos por `CartItem.imageUrl` ausente na fixture | Fixture corrigida; corte final 4 arquivos, 13/13, exit 0. |
| Tipos/build | — | `tsc --noEmit` exit 0; Next.js 16.3.5 compilou 51 páginas/rotas, exit 0. |
| Lint | — | Exit 0, 0 erros; warnings preexistentes/fora do corte permanecem documentados. |
| Migrações | 24 migrations no banco efêmero | `migrate status`: atualizado; `migrate diff`: `No difference detected`. |

## Comandos executados

```text
npx vitest run <suítes focais por causa raiz>
npx tsc --noEmit
npm run test:unit
DATABASE_URL=<PostgreSQL local descartável> npm run test:integration:core
npm run lint
DATABASE_URL=<PostgreSQL local descartável> DIRECT_URL=<mesmo banco> npm run build
npx prisma migrate status
npx prisma migrate diff --from-migrations prisma/migrations --to-url <banco local> --shadow-database-url <shadow local> --exit-code
git diff --check
```

Credenciais locais efêmeras não foram incluídas neste documento. O primeiro `build` final foi disputado por uma execução anterior ainda ativa; após ela encerrar, a execução capturada terminou com exit 0. Nenhum sucesso foi inferido da tentativa intermediária.

## Serviços e decisões externas pendentes

| Dependência/responsável | Verificação ou ação pendente |
|---|---|
| Asaas / Financeiro / Operações | Desenhar e homologar refund idempotente, estados, compensação e reconciliação em sandbox autorizada; definir atendimento quando provider aceita e persistência falha. |
| Segurança / Operações | Rotacionar credencial dos Correios potencialmente exposta e revisar acessos, sem divulgar o valor. |
| Produto + Financeiro | Homologar teto de ajuste manual, motivo estruturado, dupla aprovação e processo de clawback. |
| Produto + Dados | Decidir soft delete/restore de produtos e variantes; inventariar referências e divergências antes de backfill. |
| Produto | Decidir se marcas/categorias fazem parte do painel publicado e definir unicidade, slug, tenant e arquivamento. |
| QA | Executar matriz HTTP/E2E completa anon/customer/admin, confirmações visuais e navegação por teclado em ambiente autorizado. |
| Dados/ERP | Confirmar fonte externa de estoque e reconciliar legado; nenhum ERP real foi consultado. |

Também dependem de ambiente autorizado: envio de email, Correios/ViaCEP, Supabase Storage, scheduler/cron e políticas de cloud. Nenhum desses serviços foi chamado nesta etapa.

## Arquivos principais alterados nesta etapa

- Pedidos/refund: `types/admin.types.ts`, `services/order.service.ts`, rotas de status/notas/rastreio, webhooks Asaas e `components/admin/orders/OrderStatusManager.tsx`.
- Frete: `lib/validators/admin-freight.ts`, rotas administrativas e `services/freight.service.ts`.
- Fidelidade: `types/loyalty.types.ts`, `services/loyalty.service.ts`, rota de ajuste e as duas interfaces administrativas.
- Catálogo: `services/product.service.ts`, rotas/validators, `components/admin/ProductForm.tsx` e listagem de produtos.
- Testes: `tests/unit/admin-*.test.ts`, regressões correlatas, `tests/integration/admin-invariants.test.ts` e script `test:integration:core`.

## Limitações e risco residual

- `ADM-001` permanece o bloqueio de publicação financeira: impedir o cancelamento inseguro é contenção, não implementação de reembolso.
- Auditoria ainda não cobre settings/configuração de fidelidade e não possui política versionada de retenção/consulta.
- Exclusão de produto elegível continua física; restauração não existe.
- Dados reais preexistentes não foram lidos ou corrigidos.
- Warnings de lint não relacionados permanecem; não houve refatoração ampla.
- O contêiner PostgreSQL descartável, verificado pelo nome/imagem/porta, foi removido após a coleta; suas fixtures locais não são recuperáveis.
- Nenhum commit foi criado e nenhuma etapa posterior foi iniciada.

**Conclusão:** as mutações administrativas de maior risco agora falham fechadas, validam dados no servidor, preservam histórico de catálogo e deixam prova transacional nos fluxos tocados. A etapa 07 está concluída dentro do escopo local, mas o produto continua `BLOCKED` para publicação financeira até existir e ser homologado o workflow real de reembolso e reconciliação.


## 2026-09-29 — execução dos prompts atualizados e correções locais

**IDs:** ADM-008/011, FINAL-026. `services/store-settings-audit.service.ts:15` confirma ADMIN ACTIVE do tenant, bloqueia a loja, atualiza e grava AuditLog na mesma transação. Ator, tenant, requestId, campos enviados e snapshots seguros ficam registrados. Dados de PIX/contato/endereço/credenciais/texto livre não entram nos snapshots. Falha do insert de auditoria e falha após mutação revertem settings; ator de outra loja é recusado.

No browser, salvar additionalDays=2 gerou audit com requestId e valor esperado; lista administrativa de pedidos carregou. Os 14 controles de `app/admin/settings/page.tsx` receberam labels associados. ADM-008: implementação local **FIXED VERIFIED**, classificação agregada **PARTIALLY FIXED** até retenção/acesso operacional. CRUD de taxonomia, soft delete, dupla aprovação e exceções financeiras continuam fora do escopo aprovado.

**Validação consolidada:** [complemento de FINAL-VALIDATION](FINAL-VALIDATION.md#2026-09-29--execução-dos-prompts-atualizados-e-correções-locais). Histórico acima preservado; homologação externa não inferida.
