# Progresso de remediação

Este arquivo é histórico e cumulativo. Entradas futuras devem ser acrescentadas ou ter seu estado operacional atualizado com nova evidência; não se deve reescrever retrospectivamente os relatórios em `docs/audits/`.

## 2026-09-26 — TRIAGE-00 — inventário e plano

**Estado da etapa:** `DEFERRED` para correções; planejamento concluído.  
**Publication Status:** `BLOCKED` (inalterado).  
**Revisão inspecionada:** `0c7ef7ddfa5fb4520c4bc794163cbc71257c2bc4`.  
**Escopo de IDs:** todos os grupos `FINAL-001` a `FINAL-036` e seus 198 IDs de origem.  
**Causa raiz da etapa:** contratos, schema, autoridade de negócio, identidade, máquinas de estado, fronteiras externas, gates e operação evoluíram sem uma cadeia única de invariantes e provas.  
**Severidade original e residual:** 2 BLOCKER, 11 CRITICAL, 18 HIGH, 4 MEDIUM e 1 LOW; **sem redução**, pois nenhum código foi corrigido.

### Arquivos e commits

- Criado: `docs/remediation/PLAN.md`.
- Criado: `docs/remediation/PROGRESS.md`.
- Código de produto, testes, migrations, workflows e relatórios de auditoria: não alterados.
- Commit: nenhum commit criado nesta etapa.
- Estado prévio relevante: `docs/audits/` já estava não rastreado; foi preservado.

### Evidência antes e depois

| Momento | Evidência |
|---|---|
| Antes | 15 relatórios presentes; 198 IDs de origem; consolidação com 36 grupos; `node_modules`/`.next` ausentes; publicação `BLOCKED`. |
| Depois | Inventário e mapa conferidos; sete grupos revalidados `VALID`; 29 mantidos `NOT VERIFIED nesta triagem`; plano operacional documentado. Código e severidade residual permanecem iguais. |
| Testes antes | Relatórios registravam suites/lint/build sem iniciar por binários ausentes. |
| Testes depois | `test:unit`, lint e build foram tentados novamente e falharam antes de iniciar por ausência de `vitest`, `eslint` e `prisma`. Nenhum teste foi marcado como aprovado. |

### Comandos e resultados

- `git rev-parse HEAD` → revisão `0c7ef7d...`, igual à consolidação.
- `git status --short` → antes da escrita, apenas `?? docs/audits/`.
- Inventário e parser PowerShell de `docs/audits/*-AUDIT.md` → 14 relatórios de origem + final; 198 IDs únicos.
- Agregação de severidade → 7 BLOCKER, 28 CRITICAL, 85 HIGH, 70 MEDIUM, 7 LOW, 1 INFORMATIONAL.
- Agregação de confiança → 164 CONFIRMED, 28 HIGH CONFIDENCE, 4 SUSPECTED, 2 NOT VERIFIED.
- Comparação com seção 6 de `FINAL-AUDIT.md` → 198 referências únicas, 0 ausente, 0 extra.
- `Get-FileHash -Algorithm SHA256` → hashes dos 14 relatórios de origem conferem com os prefixos consolidados.
- Busca/leitura de checkout → `FINAL-001` `VALID`.
- Comparação `model` × `CREATE TABLE` → 22 modelos, 16 tabelas, seis ausentes; `FINAL-002` `VALID`.
- Leitura de webhook/schema, DTOs públicos, guest checkout, forgot-password e cleanup → `FINAL-006`, `010`, `011`, `012`, `013` `VALID`.
- `npm.cmd run test:unit` → exit 1, `vitest` não reconhecido.
- `npm.cmd run lint` → exit 1, `eslint` não reconhecido.
- `npm.cmd run build` → exit 1, `prisma` não reconhecido.

### Estado por causa raiz

`VALID` abaixo é classificação de verificação; o estado de remediação correspondente continua `DEFERRED`. Os demais ficam `NOT VERIFIED` até revalidação na etapa própria.

| Grupo | IDs de origem | Verificação | Estado de remediação | Severidade residual |
|---|---|---|---|---|
| `FINAL-001` | ARCH-001, BE-001, CTR-001, FUX-001 | **VALID** | DEFERRED | BLOCKER |
| `FINAL-002` | ARCH-002, DB-001, INF-001 | **VALID** | DEFERRED | BLOCKER |
| `FINAL-003` | DB-002, DB-010, INF-002 | NOT VERIFIED | NOT VERIFIED | CRITICAL |
| `FINAL-004` | ARCH-003, DB-009, BE-003, CTR-006, CTR-010, CTR-015, FUX-002, ADM-002 | NOT VERIFIED | NOT VERIFIED | CRITICAL |
| `FINAL-005` | ARCH-004, DB-006, DB-011, BE-004, CTR-002, AUTH-005, SEC-006 | NOT VERIFIED | NOT VERIFIED | CRITICAL |
| `FINAL-006` | ARCH-005, DB-004, BE-005, CTR-003, CTR-009, SEC-013, OBS-001 | **VALID** | DEFERRED | CRITICAL |
| `FINAL-007` | ARCH-006, DB-003, DB-012, BE-006, CTR-005 | NOT VERIFIED | NOT VERIFIED | CRITICAL |
| `FINAL-008` | ARCH-007, BE-007, CTR-004, CTR-007, CTR-011, CTR-012, SEC-012, OBS-003, OBS-010 | NOT VERIFIED | NOT VERIFIED | CRITICAL |
| `FINAL-009` | DB-005, BE-012, CTR-008, CTR-014, CQ-001, OBS-002, OBS-005, ADM-001 | NOT VERIFIED | NOT VERIFIED | CRITICAL |
| `FINAL-010` | BE-002, AUTH-001, SEC-001, ADM-007 | **VALID** | DEFERRED | CRITICAL |
| `FINAL-011` | AUTH-002, SEC-002 | **VALID** | DEFERRED | CRITICAL |
| `FINAL-012` | BE-009, AUTH-003, SEC-003 | **VALID** | DEFERRED | CRITICAL |
| `FINAL-013` | TST-005 | **VALID** | DEFERRED | CRITICAL |
| `FINAL-014` | ARCH-009, DB-007, BE-008, CTR-013, AUTH-004, SEC-005, ADM-003 | NOT VERIFIED | NOT VERIFIED | HIGH |
| `FINAL-015` | DB-008, BE-011, CTR-016, FUX-003, ADM-010 | NOT VERIFIED | NOT VERIFIED | HIGH |
| `FINAL-016` | AUTH-006, AUTH-007, AUTH-009, SEC-007, SEC-008, SEC-009, SEC-021, INF-006 | NOT VERIFIED | NOT VERIFIED | HIGH |
| `FINAL-017` | ARCH-011, AUTH-008, SEC-010, SEC-015, PERF-005, PERF-008 | NOT VERIFIED | NOT VERIFIED | HIGH |
| `FINAL-018` | BE-010, AUTH-010, AUTH-011, SEC-011, SEC-014, INF-009 | NOT VERIFIED | NOT VERIFIED | HIGH |
| `FINAL-019` | AUTH-012, AUTH-015, SEC-004, SEC-020, INF-005, ADM-004 | NOT VERIFIED | NOT VERIFIED | HIGH |
| `FINAL-020` | ARCH-012, DB-017, BE-017, FUX-015, TST-001–010 exceto TST-005, PERF-010, CQ-005, CQ-006, ADM-011, OBS-014 | NOT VERIFIED | NOT VERIFIED | HIGH |
| `FINAL-021` | ARCH-013, INF-007, OBS-006, OBS-007 | NOT VERIFIED | NOT VERIFIED | HIGH |
| `FINAL-022` | DB-013, DB-014, DB-015, BE-015, FUX-007, FUX-009, PERF-001, PERF-007, PERF-009 | NOT VERIFIED | NOT VERIFIED | HIGH |
| `FINAL-023` | FUX-004, WEB-005, WEB-006, WEB-007 | NOT VERIFIED | NOT VERIFIED | HIGH |
| `FINAL-024` | FUX-005, WEB-008 | NOT VERIFIED | NOT VERIFIED | HIGH |
| `FINAL-025` | FUX-006, WEB-001, WEB-002 | NOT VERIFIED | NOT VERIFIED | HIGH |
| `FINAL-026` | ARCH-008, BE-013, ADM-005, ADM-006, ADM-008, ADM-009, ADM-012 | NOT VERIFIED | NOT VERIFIED | HIGH |
| `FINAL-027` | BE-014, BE-016, SEC-018, OBS-004, OBS-008, OBS-012, OBS-013 | NOT VERIFIED | NOT VERIFIED | HIGH |
| `FINAL-028` | ARCH-010, CQ-003, CQ-004, CQ-007, CQ-008, CQ-009, CQ-010 | NOT VERIFIED | NOT VERIFIED | MEDIUM |
| `FINAL-029` | FUX-008, FUX-010, PERF-004, PERF-006, CQ-002 | NOT VERIFIED | NOT VERIFIED | HIGH |
| `FINAL-030` | FUX-011, PERF-002, PERF-003, WEB-010 | NOT VERIFIED | NOT VERIFIED | HIGH |
| `FINAL-031` | FUX-012, WEB-009, WEB-011 | NOT VERIFIED | NOT VERIFIED | MEDIUM |
| `FINAL-032` | SEC-016, SEC-017, WEB-003, WEB-004, WEB-012, WEB-013 | NOT VERIFIED | NOT VERIFIED | MEDIUM |
| `FINAL-033` | INF-003, INF-008, INF-010–014, OBS-009, OBS-011, CQ-011 | NOT VERIFIED | NOT VERIFIED | HIGH |
| `FINAL-034` | DB-016, INF-004 | NOT VERIFIED | NOT VERIFIED | HIGH |
| `FINAL-035` | AUTH-013, AUTH-014, SEC-019 | NOT VERIFIED | NOT VERIFIED | MEDIUM |
| `FINAL-036` | FUX-013, FUX-014 | NOT VERIFIED | NOT VERIFIED | LOW |

### Limitações e impedimentos

- `node_modules` e os guias locais do Next não estão disponíveis; nenhuma suite, lint ou build iniciou.
- Não houve PostgreSQL descartável, browser, servidor ou fixture dinâmica.
- Não houve acesso a produção, segredos, contas, cloud ou providers externos.
- Estado real de Asaas, RLS/ACL, storage, e-mail, scheduler, proxy/CDN, observabilidade e backup permanece pendente em ambiente autorizado.
- Nenhum item está `FIXED`, `ALREADY RESOLVED` ou `INVALID` nesta entrada.

### Próximos passos

1. Executar `FINAL-013` como primeiro item técnico, com prova fail-closed antes de qualquer conexão.
2. Em paralelo organizacional, conter `FINAL-010`, `FINAL-018` e `FINAL-019`; ações de rotação continuam externas e pendentes.
3. Criar o gate mínimo de `FINAL-020`, então tratar `FINAL-002` e `FINAL-003` em PostgreSQL descartável.
4. Corrigir o contrato de `FINAL-001` sem liberar cobrança real antes das ondas de identidade/integridade e transações.
5. Atualizar este arquivo após cada causa raiz; não iniciar outra onda automaticamente.

## 2026-09-26 — SECURITY-01.1 — fronteira pública e credencial dos Correios

**IDs de origem:** `FINAL-010`, `SEC-001`, `AUTH-001`, `BE-002`, `ADM-007`.  
**Classificação:** `VALID` → `FIXED` no código; rotação externa pendente.  
**Causa raiz:** consultas públicas e administrativas reutilizavam entidades Prisma amplas e incluíam `correiosPassword`; a consulta pública de produto também não vinculava o ID ao tenant resolvido.  
**Origem → trust boundary → sink:** linha `Loja`/`Product` no banco → Route Handlers públicos `GET /api/loja/[slug]` e `GET /api/products/[id]`, ou sessão administrativa → serialização JSON.  
**Severidade original / residual:** `CRITICAL` / `HIGH` até a rotação da credencial potencialmente exposta; o caminho de exposição confirmado foi removido.

### Evidência antes e depois

| Momento | Evidência |
|---|---|
| Antes | `getLojaBySlug`, `getLojaSettings`, `updateLojaSettings` e a relação `Product.loja` selecionavam/devolviam `correiosPassword`; o produto era buscado somente por `id`. |
| Depois | DTO público explícito; senha excluída também do DTO administrativo e do contrato de escrita; produto filtrado por `id + lojaID`; relação `loja` usa allowlist sem segredo, PIX ou endereço operacional. |
| Teste antes | O novo teste não foi executado contra a revisão vulnerável; a reprodução estática confirmou os campos no `select` e a ausência de `lojaID` na consulta. |
| Teste depois | `tests/unit/public-store-boundary.test.ts`: 3/3 testes passaram, cobrindo allowlist pública, exclusão administrativa do segredo e isolamento tenant A/B. |

### Arquivos, comandos e próximos passos

- Alterados: `services/loja.service.ts`, `services/product.service.ts`, `app/api/products/[id]/route.ts`, `app/api/loja/settings/route.ts`, `app/admin/settings/page.tsx`.
- Criado: `tests/unit/public-store-boundary.test.ts`.
- Commit: nenhum.
- `npm.cmd exec vitest run tests/unit/public-store-boundary.test.ts` → exit 0, 1 arquivo, 3 testes.
- `npx.cmd tsc --noEmit` → exit 0.
- Pendente externo: responsável de operações deve revogar/rotacionar a credencial dos Correios em ambiente autorizado e validar o frete; nenhum valor foi lido, impresso ou alterado por esta etapa.
- Risco residual: o schema ainda armazena a credencial para o orquestrador de frete; gestão segura/criptografia em repouso depende da etapa de infraestrutura. A chave PIX permanece deliberadamente no endpoint público tenant-aware `/api/loja/active`, por ser dado de pagamento da vitrine, e não foi classificada aqui como segredo de autenticação.

## 2026-09-26 — SECURITY-01.2 — identidade no checkout convidado

**IDs de origem:** `FINAL-011`, `SEC-002`, `AUTH-002`.  
**Classificação:** `VALID` → `FIXED`.  
**Causa raiz:** o checkout sem sessão fazia `upsert` por e-mail, atualizava CPF/telefone e reutilizava o ID encontrado para pedido e fidelidade.  
**Origem → trust boundary → sink:** e-mail, CPF, telefone e pontos do JSON público → `POST /api/checkout` → `User.upsert`, `Order.userID` e carteira de fidelidade.  
**Severidade original / residual:** `CRITICAL` / `MEDIUM`; a impersonação foi bloqueada, mas o modelo de convidado ainda cria uma conta técnica sem credencial utilizável.

### Evidência antes e depois

| Momento | Evidência |
|---|---|
| Antes | Um visitante que conhecesse o e-mail de uma conta recebia seu `userID` via `upsert`, podia sobrescrever PII e solicitar resgate de pontos. |
| Depois | Pontos exigem sessão; e-mail já cadastrado falha sem alterar a conta; somente e-mail novo cria usuário convidado; corrida de unicidade `P2002` também falha fechada. |
| Teste antes | A reprodução estática confirmou o `upsert` com bloco `update` e uso imediato do ID em `simulatePointsRedemption`; o novo teste não foi executado na revisão vulnerável. |
| Teste depois | Suites de checkout: 2 arquivos, 17/17 testes passaram, incluindo conta fictícia vítima A, tentativa convidada B, ausência de escrita e bloqueio de pontos antes da transação. |

### Arquivos, comandos e próximos passos

- Alterados: `services/checkout.service.ts`, `tests/unit/checkout-authoritative.test.ts`.
- Commit: nenhum.
- `npm.cmd exec vitest run tests/unit/checkout-authoritative.test.ts tests/unit/checkout-cpf-enforcement.test.ts` → exit 0, 17 testes.
- `npx.cmd tsc --noEmit` → exit 0.
- Próximo passo arquitetural: modelar pedido verdadeiramente anônimo ou ativação/OTP de convidado, sem uma linha `User` com senha vazia; isso não é necessário para encerrar a impersonação confirmada e pertence à etapa de identidade/contratos.

## 2026-09-26 — SECURITY-01.3 — origem do link de recuperação

**IDs de origem:** `FINAL-012`, `SEC-003`, `AUTH-003`, `BE-009`.  
**Classificação:** `VALID` → `FIXED`.  
**Causa raiz:** o endpoint aceitava `Origin`/`Referer` não confiável e tinha fallbacks para ID público ou primeira loja do banco.  
**Origem → trust boundary → sink:** cabeçalhos HTTP controlados pelo solicitante → `POST /api/auth/forgot-password` → URL com token enviada por e-mail.  
**Severidade original / residual:** `CRITICAL` / `LOW`; resta configurar e validar DNS/domínio de cada tenant no ambiente autorizado.

### Evidência antes e depois

| Momento | Evidência |
|---|---|
| Antes | `new URL(req.headers.get("origin") || req.headers.get("referer"))` determinava o host do link; tenant ausente caía em `NEXT_PUBLIC_LOJA_ID` ou `loja.findFirst`. |
| Depois | tenant é obrigatório e fail-closed; origem vem só de `customDomain`, `PLATFORM_DOMAIN` ou URL local explicitamente configurada fora de produção; esquema/caminho/injeção são rejeitados. |
| Teste antes | A reprodução estática confirmou a passagem direta do cabeçalho hostil ao `resetUrl`; o novo teste não foi executado na revisão vulnerável. |
| Teste depois | 17/17 testes passaram: cabeçalhos `Origin`/`Referer` hostis não aparecem no e-mail; domínio customizado/plataforma são aceitos e ausência/má formação falha fechada. |

### Arquivos, comandos e próximos passos

- Alterados: `lib/tenant.ts`, `app/api/auth/forgot-password/route.ts`, `services/auth.service.ts`, `tests/unit/password-recovery.test.ts`.
- Criado: `tests/unit/tenant-canonical-origin.test.ts`.
- Commit: nenhum.
- `npm.cmd exec vitest run tests/unit/password-recovery.test.ts tests/unit/tenant-canonical-origin.test.ts` → exit 0, 2 arquivos, 17 testes.
- `npx.cmd tsc --noEmit` → exit 0.
- Pendente externo: plataforma/operações deve comprovar que `customDomain`/`PLATFORM_DOMAIN` apontam para o tenant correto e que HTTPS está válido; nenhum DNS foi consultado ou alterado nesta etapa.

## 2026-09-26 — SECURITY-01.4 — administração, bootstrap e último admin

**IDs de origem:** `FINAL-019`, `SEC-004`, `SEC-020`, `AUTH-012`, `AUTH-015`, `INF-005`, `ADM-004`.  
**Classificação:** `VALID` → `FIXED` no código; rotação/revogação externa pendente.  
**Causa raiz:** credencial administrativa determinística estava versionada e o script podia escolher a primeira loja e elevar/sobrescrever conta existente; a regra do último admin lia estado fora da transação e contava administradores inativos.  
**Origem → trust boundary → sink:** constantes/documentação e variáveis de bootstrap → script Prisma → `User.password/role`; IDs de ator/alvo → serviço de papéis → atualização de `User.role`.  
**Severidade original / residual:** `HIGH` / `HIGH` até revogar a credencial potencialmente conhecida; após a ação externa, residual `LOW` pela ausência de prova concorrente em PostgreSQL real.

### Evidência antes e depois

| Momento | Evidência |
|---|---|
| Antes | Script continha conta/senha, selecionava `lojas[0]`, promovia conta existente e imprimia credenciais; dois documentos repetiam a conta. Contagem e leituras de papel ocorriam antes da transação. |
| Depois | Script sem defaults, opt-in, proibido em produção, tenant explícito, senha mínima de 12, recusa conta existente e não registra e-mail/senha; referências removidas. Todas as leituras, contagem de admin `ACTIVE`, escrita e auditoria estão em transação `Serializable`, com até três tentativas para `P2034`. |
| Teste antes | Confirmação estática do script/documentação e do serviço; nenhum valor de credencial foi incluído neste registro. O novo teste não foi executado na revisão vulnerável. |
| Teste depois | `access-control.test.ts`: 5/5 testes passaram, incluindo último admin ativo, isolamento tenant e revalidação do papel do ator dentro da transação. Busca fora de auditorias históricas não encontrou a conta removida. |

### Arquivos, comandos e próximos passos

- Alterados: `scripts/create_test_admin.ts`, `services/user.service.ts`, `app/api/admin/users/[id]/role/route.ts`, `tests/unit/access-control.test.ts`, `DOCUMENTACAO_TECINICA/README.md`, `DOCUMENTACAO_TECINICA/DOCUMENTACAO_TECNICA_SISTEMA.md`.
- Commit: nenhum.
- `npm.cmd exec vitest run tests/unit/access-control.test.ts` → exit 0, 5 testes.
- `npx.cmd tsc --noEmit` → exit 0.
- Busca literal pela identidade versionada, excluindo relatórios históricos → nenhuma referência restante.
- Limitação: o bootstrap não foi executado, pois isso alteraria banco; a garantia concorrente ainda requer teste de integração com duas transações contra PostgreSQL descartável.
- Pendente externo: responsável de identidade/operações deve revogar sessões e rotacionar a credencial potencialmente exposta em ambiente autorizado, sem reutilizar o valor anterior. Nenhuma credencial real foi criada, lida de provedor ou trocada nesta etapa.

## 2026-09-26 — SECURITY-01.5 — sessões, reset token e canal de e-mail

**IDs de origem:** `FINAL-016`, `SEC-007`, `SEC-008`, `SEC-009`, `SEC-021`, `AUTH-006`, `AUTH-007`, `AUTH-009`, `INF-006` e a parcela de vínculo tenant de `FINAL-005`/`AUTH-005`/`SEC-006`.  
**Classificação:** `VALID` → `FIXED` para os controles de aplicação.  
**Causa raiz:** bearer tokens eram persistidos em claro; reset não consumia token atomicamente; logout ocultava falha de revogação; sessão não era vinculada ao tenant; produção podia cair no provedor dev que registrava destinatário e corpo.  
**Origem → trust boundary → sink:** cookies/tokens e host da requisição → sessão/reset → banco, cookie e logs/e-mail.  
**Severidade original / residual:** `HIGH` / `MEDIUM` até homologação do provedor real e aceite do corte de sessões preexistentes.

### Evidência antes e depois

| Momento | Evidência |
|---|---|
| Antes | O valor do cookie era a PK `Session.id`; reset token bruto era gravado e atualizado após leitura sem CAS; falha de `session.deleteMany` ainda apagava cookie/redirecionava como sucesso; `DevEmailService` podia registrar corpo com token. |
| Depois | Banco recebe SHA-256 dos tokens; cookie/e-mail recebem apenas bearer bruto; reset usa `updateMany` condicionado a token, validade e status; logout retorna 503 sem apagar cookie quando revogação falha; sessão exige tenant correspondente; produção sem Resend falha fechada; log dev contém somente ID da mensagem. |
| Teste antes | Reprodução estática nos sinks acima; os novos testes não foram executados contra a revisão vulnerável. |
| Teste depois | Quatro arquivos e 23/23 testes passaram: hash ≠ bearer, tenant A/B, falha de revogação/criação, 503, hash de reset, corrida de segundo consumo e provedor ausente em produção. |

### Arquivos, comandos e próximos passos

- Alterados: `lib/session.ts`, `app/api/auth/logout/route.ts`, `services/auth.service.ts`, `lib/email/index.ts`, `lib/email/providers/dev.provider.ts`, `tests/unit/password-recovery.test.ts`.
- Criados: `tests/unit/session-security.test.ts`, `tests/unit/email-security.test.ts`, `tests/unit/auth-enumeration.test.ts`.
- Commit: nenhum.
- `npm.cmd exec vitest run tests/unit/password-recovery.test.ts tests/unit/session-security.test.ts tests/unit/auth-enumeration.test.ts tests/unit/email-security.test.ts` → exit 0, 23 testes após a validação final.
- `npx.cmd tsc --noEmit` → exit 0.
- Impacto de implantação: sessões criadas pela versão anterior serão invalidadas porque os IDs antigos não são hashes; usuários precisarão autenticar novamente. Não houve exclusão/alteração de sessão real nesta etapa.
- Pendente externo: homologar envio, bounce e entrega no Resend autorizado; validar cookies no domínio HTTPS real.

## 2026-09-26 — SECURITY-01.6 — enumeração e política de senha

**IDs de origem:** parcela de `FINAL-035`, `AUTH-013`, `AUTH-014`, `SEC-019`.  
**Classificação:** `VALID` → `DEFERRED` para o grupo; enumeração e mínimo divergente do reset foram corrigidos.  
**Causa raiz:** login usava hash dummy inválido e resposta distinta para conta bloqueada; reset aceitava seis caracteres enquanto cadastro exigia oito.  
**Origem → trust boundary → sink:** e-mail/senha públicos → autenticação → tempo e mensagem HTTP observáveis.  
**Severidade original / residual:** `MEDIUM` / `MEDIUM`.

- Depois: todos os resultados inválidos executam comparação bcrypt válida e retornam `Credenciais inválidas`; reset exige oito caracteres.
- Prova: `tests/unit/auth-enumeration.test.ts` compara conta ausente e bloqueada; incluído nos 23/23 testes acima.
- Pendente: política central única, requisitos de complexidade/breached-password e rate limit distribuído (`FINAL-017`) não foram improvisados nesta etapa.

## 2026-09-26 — SECURITY-01.7 — injeção HTML em e-mails

**IDs de origem:** parcela `SEC-016` de `FINAL-032`.  
**Classificação:** `VALID` → `FIXED` para template de e-mail; grupo `FINAL-032` permanece `DEFERRED`.  
**Causa raiz:** nome da loja, nome do cliente e URL eram interpolados diretamente em HTML; o provedor dev tinha um template alternativo sem escaping.  
**Origem → trust boundary → sink:** nomes e URL → renderizador transacional → corpo HTML/atributo `href`.  
**Severidade original / residual:** `MEDIUM` / `LOW` para e-mail; CSP e itens web correlatos continuam pendentes.

- Depois: escaping contextual, allowlist de protocolo HTTPS (HTTP somente loopback), `rel="noopener noreferrer"` e reutilização do template canônico no provedor dev.
- Teste: payloads inofensivos `<script>`/`<img>` não viram elementos e `javascript:` é rejeitado; incluído nos 23/23 testes acima.
- Alterado: `lib/email/templates/password-reset.template.ts`.
- Pendente: `SEC-017` e `WEB-003/004/012/013` exigem etapa web/CSP e teste em browser; não estão marcados como resolvidos.

## 2026-09-26 — SECURITY-01.8 — BOLA na simulação de fidelidade

**IDs de origem:** parcela `BE-008`, `AUTH-004`, `SEC-005` de `FINAL-014`; IDs transacionais correlatos `ARCH-009`, `DB-007`, `CTR-013`, `ADM-003` permanecem pendentes.  
**Classificação:** `VALID` → `FIXED` para autorização da rota; grupo `FINAL-014` permanece `DEFERRED`.  
**Causa raiz:** rota pública aceitava `lojaID`/`userID` no JSON e usava esses identificadores como autoridade para consultar configuração/carteira.  
**Origem → trust boundary → sink:** IDs do corpo público → `POST /api/loyalty/simulate` → `Loja` e `LoyaltyWallet`.  
**Severidade original / residual:** `HIGH` / `HIGH` para o grupo, por invariantes transacionais ainda pendentes; a BOLA específica tem residual `LOW`.

- Depois: sessão é obrigatória; tenant e usuário vêm exclusivamente de `getCurrentUser`; schema público estrito só aceita `subtotal` e `requestedPoints`; cliente deixou de enviar `lojaID`.
- Teste antes: confirmação estática da escolha `data.userID` e `data.lojaID`; novos testes não rodaram na revisão vulnerável.
- Teste depois: 13/13 testes passaram, incluindo anônimo 401 e tentativa A→B com IDs no corpo rejeitada antes de qualquer consulta.
- Alterados: `app/api/loyalty/simulate/route.ts`, `components/checkout/LoyaltyPointsWidget.tsx`, `tests/unit/loyalty-routes.test.ts`.
- `npm.cmd exec vitest run tests/unit/loyalty-routes.test.ts tests/unit/checkout-authoritative.test.ts` → exit 0.
- `npx.cmd tsc --noEmit` → exit 0.
- Pendente para etapa transacional: unicidade/idempotência de lançamentos, consistência do ledger e concorrência de saldo em PostgreSQL descartável.

## 2026-09-26 — SECURITY-01.9 — simulador de pagamento e upload privilegiado

**IDs de origem:** `FINAL-018`, `SEC-011`, `SEC-014`, `AUTH-010`, `AUTH-011`, `BE-010`, `INF-009`.  
**Classificação:** `VALID` → `FIXED` nos Route Handlers; ACL/RLS externa permanece `NOT VERIFIED`.  
**Causa raiz:** simulador dependia apenas de `NODE_ENV != production`, não autenticava nem escopava pedido; upload aceitava bucket fornecido pelo cliente e o papel só era verificado para o literal `products`.  
**Origem → trust boundary → sink:** `orderId/event` JSON → simulador → eventos/pedido/status; multipart `bucket/file` → upload com service role → Supabase Storage.  
**Severidade original / residual:** `HIGH` / `MEDIUM`, condicionado à verificação externa do bucket.

### Evidência antes e depois

| Momento | Evidência |
|---|---|
| Antes | Qualquer ambiente não-production expunha mutação financeira por ID; `findUnique(id)` não vinculava tenant. Cliente autenticado comum podia escolher bucket diferente de `products`. |
| Depois | Simulador exige opt-in servidor, nunca existe em produção, exige admin, schema/event allowlist e `id + lojaID`; ator auditável é o admin. Upload exige admin para toda a rota e só aceita bucket servidor `products`; caminho continua prefixado por tenant. |
| Teste antes | Reprodução estática; novos testes não executados na revisão vulnerável. |
| Teste depois | 17/17 testes passaram: gate 404, anônimo 401, pedido B invisível ao admin A, evento inválido sem consulta e bucket arbitrário sem upload. |

### Arquivos, comandos e próximos passos

- Alterados: `app/api/webhooks/asaas/simulate/route.ts`, `app/api/upload/route.ts`, `app/checkout/confirmation/page.tsx`, `tests/unit/supabase-storage.test.ts`.
- Criado: `tests/unit/webhook-simulator-security.test.ts`.
- Commit: nenhum.
- `npm.cmd exec vitest run tests/unit/supabase-storage.test.ts tests/unit/webhook-simulator-security.test.ts` → exit 0, 17 testes.
- `npx.cmd tsc --noEmit` → exit 0.
- Pendente externo: conferir ACL/RLS, policy de leitura e inexistência de escrita pública no bucket Supabase em ambiente autorizado. Nenhum arquivo real foi enviado.
- Risco residual: as escritas do simulador não formam uma única transação; esse aspecto permanece dependente da etapa transacional, embora a superfície insegura esteja desabilitada por padrão e restrita a admin.

## 2026-09-26 — SECURITY-01.10 — minimização de PII em logs

**IDs de origem:** parcela `SEC-018`, `BE-014`, `BE-016`, `OBS-004` de `FINAL-027`; `OBS-008`, `OBS-012`, `OBS-013` permanecem pendentes.  
**Classificação:** `VALID` → `FIXED` para sanitização local; grupo `FINAL-027` permanece `DEFERRED`.  
**Causa raiz:** sanitização dependia do nome da chave, não mascarava e-mail e copiava `Error.message/stack` integralmente.  
**Origem → trust boundary → sink:** contexto e exceções contendo PII/bearers → logger estruturado → stdout/stderr/coletor.  
**Severidade original / residual:** `HIGH` / `MEDIUM` para o grupo; residual `LOW` no logger local.

- Depois: e-mail, CPF/CNPJ, Bearer e parâmetros de token/segredo são saneados inclusive quando embutidos em mensagem/stack; chaves sensíveis continuam totalmente redigidas.
- Teste antes: confirmação estática e contexto de checkout com e-mail; novos testes não executados na revisão vulnerável.
- Teste depois: 11/11 testes passaram, incluindo erro inofensivo com e-mail/CPF/bearer/token e garantia de ausência dos valores brutos no JSON.
- Alterados: `lib/logger.ts`, `tests/unit/logger.test.ts`.
- `npm.cmd exec vitest run tests/unit/logger.test.ts tests/unit/security-csp-observability.test.ts` → exit 0.
- `npx.cmd tsc --noEmit` → exit 0.
- Pendente externo: política de retenção/acesso/redação no coletor real, alertas e correlação ponta a ponta permanecem `NOT VERIFIED` em ambiente autorizado.

## 2026-09-26 — SECURITY-01.11 — limites de entrada e boundary de proxy

**IDs de origem:** parcelas `SEC-010`, `SEC-015`, `AUTH-008`, `PERF-005`, `PERF-008`, `ARCH-011` de `FINAL-017`.  
**Classificação:** `VALID` → `DEFERRED` para o grupo; limites locais e confiança de headers foram corrigidos, contador compartilhado continua pendente.  
**Causa raiz:** arrays, strings, quantidades e dimensões públicos não tinham máximos; frete legado não tinha schema/limite; produção atribuía autoridade a headers de proxy sem configuração explícita; reset usava XFF diretamente.  
**Origem → trust boundary → sink:** JSON/headers públicos → Zod/rate limiter → loops de checkout, consulta em lote, cálculo externo e envio de e-mail.  
**Severidade original / residual:** `HIGH` / `HIGH`, pois múltiplas instâncias ainda não compartilham contador.

### Evidência antes e depois

| Momento | Evidência |
|---|---|
| Antes | Checkout/frete aceitavam arrays e quantidades sem teto; `/api/freight` POST chamava integração sem validação; `getClientIp` aceitava quatro famílias de headers em produção; forgot/reset liam XFF diretamente. |
| Depois | Limite de 50 itens e máximos de negócio para strings/quantidades/dimensões; rate limit no frete; POST legado retorna 410; tenant do domínio é autoritativo e produtos são filtrados por loja; produção aceita apenas header do provedor explicitamente configurado; reset/forgot usam helper e chaves por conta/token com hash. |
| Teste antes | Reprodução estática; nenhuma carga destrutiva foi executada. |
| Teste depois | 5 arquivos e 50/50 testes passaram, com N/N+1 (50/51), quantidade 100/101, tenant A/B e headers forjados sem/ com provedor confiável. |

### Arquivos, comandos e próximos passos

- Alterados: `lib/rate-limit.ts`, `lib/validators/checkout.validators.ts`, `app/api/freight/calculate/route.ts`, `app/api/freight/route.ts`, `app/api/auth/forgot-password/route.ts`, `app/api/auth/reset-password/route.ts`, `components/checkout/CheckoutForm.tsx` e testes correlatos.
- Commit: nenhum.
- `npm.cmd exec vitest run tests/unit/rate-limit.test.ts tests/unit/audit-round-2-fixes.test.ts tests/unit/audit-hotfix-phase2.test.ts tests/unit/checkout-cpf-enforcement.test.ts tests/unit/password-recovery.test.ts` → exit 0, 50 testes.
- `npx.cmd tsc --noEmit` → exit 0.
- Configuração necessária: definir `TRUSTED_PROXY_PROVIDER=cloudflare|vercel|generic` somente quando esse proxy sobrescrever o header correspondente; sem isso, produção agrega na chave fail-closed `untrusted-client`.
- Pendente externo: Redis/edge/WAF compartilhado, limite de body antes de `request.json()`/`formData()`, cotas do provider e teste entre duas instâncias. Portanto `SEC-010` não está marcado como resolvido.

## 2026-09-26 — SECURITY-01 — encerramento da etapa

**Estado da etapa:** concluída, sem iniciar a etapa transacional/web.  
**Publication Status:** `BLOCKED` (inalterado).  
**IDs tratados:** `SEC-001`–`SEC-011`, `SEC-014`–`SEC-016`, `SEC-018`–`SEC-021` e correlatos descritos nas entradas `SECURITY-01.1` a `SECURITY-01.11`.  
**IDs pendentes:** `SEC-012`, `SEC-013`, `SEC-017`; `SEC-010`, `SEC-015` e `SEC-019` permanecem `DEFERRED` apesar dos controles parciais.  
**Severidade residual:** `HIGH`, concentrada em idempotência/inbox transacional, rate limit/body limit compartilhado, rotação externa e configuração real de providers.

### Validação final

| Verificação | Resultado |
|---|---|
| Testes unitários | `npm.cmd run test:unit` → exit 0; **55 arquivos, 399 testes**, todos passaram. |
| Tipos | `npx.cmd tsc --noEmit` → exit 0. |
| Build | `npm.cmd run build` → exit 0; Next.js 16.3.5 compilou, checou tipos e gerou 51 páginas. |
| Dependências de produção | `npm.cmd audit --omit=dev --audit-level=high` → exit 0; 0 vulnerabilidades. |
| Diff | `git diff --check` → exit 0. |
| Lint global | `npm.cmd run lint` → exit 1; mesmos 1 erro e 20 warnings da linha de base, com erro preexistente em `components/checkout/CheckoutForm.tsx:243`. |
| Lint direcionado | ESLint dos arquivos de backend/segurança alterados → exit 0. |

### Divergência da linha de base

- As duas falhas preexistentes de `tests/unit/asaas-boleto.test.ts` eram falta de mock de `paymentWebhookEvent.findUnique`; o teste foi isolado e a suite integral passou sem conexão real.
- Quatro testes antigos esperavam `User.upsert` para convidado; foram atualizados para o contrato seguro `findUnique` + `create` somente quando não existe conta. Não se reintroduziu o comportamento vulnerável.
- O lint não foi refatorado por ser débito fora do escopo e sua contagem não piorou.

### Entrega e caminhos

- Criado: `docs/remediation/SECURITY-FIXES.md`.
- Atualizado cumulativamente: `docs/remediation/PROGRESS.md`.
- Código, configuração de exemplo, documentação técnica e testes alterados estão inventariados em `SECURITY-FIXES.md`.
- Commit: nenhum.
- Ações reais pendentes e responsáveis: Correios/identidade (rotação/revogação), DNS/TLS, Resend, Supabase, proxy/WAF/Redis, PostgreSQL concorrente, Asaas, coletor de logs e browser/CSP.
- Nenhum serviço real foi acessado ou alterado e nenhum resultado pendente foi marcado como aprovado.

## 2026-09-26 — AUTH-02.1 — revalidação dos 15 achados de identidade

**IDs de origem:** `AUTH-001`–`AUTH-015` e grupos correlatos `FINAL-005`, `FINAL-010`–`FINAL-012`, `FINAL-014`, `FINAL-016`–`FINAL-019`, `FINAL-035`.  
**Classificação:** todos eram `VALID` na revisão auditada; no início desta etapa, 12 causas específicas estavam `ALREADY RESOLVED` pelo estado pós-`SECURITY-01`; `AUTH-005` tinha uma defesa residual a fechar; `AUTH-008` segue `DEFERRED`; `AUTH-015` está saneado no código, mas rotação/revogação externa segue `NOT VERIFIED`/`DEFERRED`.  
**Causa raiz:** identidade/tenant/autoridade vinham alternadamente de sessão, host e campos do cliente; tokens tinham ciclo de vida incompleto; superfícies privilegiadas tinham gates fracos; limites eram locais.  
**Severidade original / residual:** 3 `CRITICAL`, 10 `HIGH`, 2 `MEDIUM` / residual `HIGH` por `AUTH-008`, ação externa de `AUTH-015` e verificações reais pendentes.

### Evidência antes e depois

| Momento | Evidência |
|---|---|
| Antes | `AUTH-AUDIT.md` registrou 15 achados e não executou testes por ausência de dependências naquela etapa. |
| Estado revalidado | DTO, guest, reset, sessões, logout, fidelidade, upload, simulador, papel, senha e enumeração foram confirmados no código atual; o relatório histórico não foi alterado. |
| Teste | Suite focal inicial com 11 arquivos e 75/75 testes passou, cobrindo os controles trazidos de `SECURITY-01`. |

### Arquivos, comandos e próximos passos

- Lidos: relatórios `AUTH`, `SECURITY`, `ADMIN`, `FINAL`, plano, rotas, serviços, schema e testes pertinentes.
- Commit: nenhum.
- Nenhum arquivo de produto foi alterado neste subitem.
- Próximos passos: fechar escopo residual de recurso/tenant e formalizar matriz de papéis; não converter lacunas sem requisito em defeitos confirmados.

## 2026-09-26 — AUTH-02.2 — proprietário + tenant em pedidos legados

**IDs de origem:** parcela residual de `AUTH-005`, `SEC-006`, `FINAL-005`.  
**Classificação:** `VALID` → `FIXED`.  
**Causa raiz:** após o vínculo da sessão ao tenant, dois handlers de customer ainda autorizavam pedido somente por `order.userID`; uma linha histórica inconsistente com `order.lojaID` diferente do usuário podia atravessar essa checagem.  
**Origem → trust boundary → sink:** UUID do pedido + sessão → detalhe/confirmação → JSON do pedido ou mutação `DELIVERED`.  
**Severidade original / residual:** `HIGH` / `LOW` no app; integridade de registros históricos permanece `NOT VERIFIED`.

### Evidência antes e depois

| Momento | Evidência |
|---|---|
| Antes | `GET /api/orders/[id]` e confirmação comparavam proprietário, mas não `order.lojaID` para customer. |
| Depois | Ambos exigem proprietário e tenant da sessão; divergência de loja retorna 404 antes de resposta/transação. |
| Teste antes | Predicado incompleto confirmado estaticamente; nenhum dado real foi consultado. |
| Teste depois | Detalhe cobre anônimo, A→B, registro legado cross-tenant, próprio pedido e admin A→loja B; confirmação cobre o mesmo usuário em outra loja sem transação. |

### Arquivos, comandos e próximos passos

- Alterados: `app/api/orders/[id]/route.ts`, `app/api/orders/[id]/confirm-delivery/route.ts`, `tests/unit/client-confirmation.test.ts`.
- Criado: `tests/unit/order-resource-authorization.test.ts`.
- Commit: nenhum.
- Testes focais incluídos nos 33/33 e 67/67 resultados do encerramento.
- Pendente externo: inventariar `Order.lojaID != User.lojaID` em PostgreSQL autorizado; qualquer correção de dados requer backup e migration revisável.

## 2026-09-26 — AUTH-02.3 — matriz de recursos e mass assignment

**IDs de origem:** controles positivos e lacunas de regressão de `AUTH-AUDIT.md`; correlatos `AUTH-004`, `AUTH-010`, `AUTH-012`, `AUTH-013`, `AUTH-014`.  
**Classificação:** `ALREADY RESOLVED` no produto, com regressões adicionadas; nenhum novo defeito confirmado.  
**Causa raiz protegida:** IDs, papel, status, tenant e ator não podem receber autoridade de JSON/form-data; cada recurso deve derivar identidade da sessão e verificar proprietário/loja.  
**Severidade original / residual:** varia de `HIGH` a `MEDIUM` / `LOW` para os caminhos unitariamente comprovados; provedores e concorrência permanecem fora dessa prova.

### Evidência antes e depois

| Momento | Evidência |
|---|---|
| Antes | Cobertura estava dispersa; faltavam provas dedicadas de campos privilegiados no cadastro/perfil/papel e algumas células anônimo/A/B/admin. |
| Depois | Cadastro descarta campos privilegiados e serviço força `CUSTOMER/ACTIVE`; perfil descarta identidade/papel/tenant; papel usa ator da sessão. Endereço não concede bypass a admin. Suites existentes comprovam pontos e arquivos. |
| Testes | Primeira execução focal: 1 falha por expectativa que não considerava transforms opcionais para `null`; expectativa corrigida, 4 arquivos/33 testes passaram. Matriz ampliada: 8 arquivos/67 testes passaram. |

### Arquivos, comandos e próximos passos

- Criado: `tests/unit/authz-account-matrix.test.ts`.
- Alterados: `tests/unit/cpf-cnpj-persistence.test.ts`, `tests/unit/profile-update.test.ts`.
- Reutilizados/revalidados: `access-control`, `loyalty-routes`, `supabase-storage`, `order-multitenant-isolation` e `client-confirmation`.
- Commit: nenhum.
- Limite: unitários/mocks não substituem matriz HTTP contra PostgreSQL descartável e browser autorizado.

## 2026-09-26 — AUTH-02 — encerramento da etapa

**Estado da etapa:** concluída; nenhuma etapa seguinte iniciada.  
**Publication Status:** `BLOCKED` (inalterado).  
**IDs tratados:** `AUTH-001`–`AUTH-015`, com classificação individual em `AUTH-FIXES.md`.  
**IDs pendentes:** `AUTH-008` (`DEFERRED`) e execução externa de `AUTH-015` (`NOT VERIFIED`/`DEFERRED`); verificação de e-mail, troca autenticada de senha, MFA, logout global e CSRF/browser permanecem lacunas, não novos defeitos confirmados.  
**Severidade residual:** `HIGH`.

### Validação final

| Verificação | Resultado |
|---|---|
| Suite focal inicial | 11 arquivos, 75/75 testes, exit 0. |
| Correção/mass assignment | 4 arquivos, 33/33 testes, exit 0 após correção de uma expectativa de teste. |
| Matriz de autorização | 8 arquivos, 67/67 testes, exit 0. |
| Testes unitários | `npm.cmd run test:unit` → exit 0; **57 arquivos, 416 testes**. |
| Tipos | `npx.cmd tsc --noEmit` → exit 0. |
| Lint direcionado | handlers/testes alterados em `AUTH-02` → exit 0. |
| Build | `npm.cmd run build` → exit 0; Next.js 16.3.5 e 51 páginas. |
| Diff | `git diff --check` → exit 0; apenas avisos informativos de conversão LF/CRLF. |

### Entrega e caminhos

- Criado: `docs/remediation/AUTH-FIXES.md`.
- Atualizado cumulativamente: `docs/remediation/PROGRESS.md`.
- Produto alterado somente para dupla autorização proprietário+tenant em detalhe/confirmação de pedido.
- Testes criados/ampliados conforme `AUTH-FIXES.md`; commit nenhum.
- Nenhum serviço, conta, banco, e-mail, storage, gateway, segredo ou ambiente real foi acessado/alterado.

## 2026-09-26 — DATABASE-03.1 — histórico reproduzível e unicidades

**IDs de origem:** `DB-001`, `DB-002`, `DB-011`.  
**Classificação:** `VALID` → `FIXED` localmente; estado externo `NOT VERIFIED`.  
**Causa raiz:** schema, migrations e client evoluíram de forma independente; constraints antigas permaneceram no histórico.  
**Severidade original / residual:** `BLOCKER` + `CRITICAL` + `HIGH` / residual `HIGH` até inventário dos bancos existentes.

### Evidência antes e depois

| Momento | Evidência |
|---|---|
| Antes | As 20 migrations originais aplicavam, mas o diff listava seis tabelas ausentes, enums/campos/tipos/FKs divergentes e unicidades residuais. |
| Depois | Migration transacional de reconciliação; 23 migrations do zero; `No difference detected`. Duas variantes do mesmo produto persistiram e e-mail repetido entre tenants foi aceito. |
| Teste | PostgreSQL 16 descartável, `migrate reset`, `migrate diff` e regressão real. |

**Arquivos:** `prisma/schema.prisma`, `prisma/migrations/20260926194600_reconcile_schema_and_core_constraints/migration.sql`, `tests/integration/database-invariants.test.ts`.  
**Commit:** nenhum.  
**Próximo passo:** diff/checksum/snapshot por ambiente; não executar `db push` nem reescrever migrations já aplicadas.

## 2026-09-26 — DATABASE-03.2 — CAS de pedido e rollback de estoque

**IDs de origem:** `DB-003`, `DB-005`, `CTR-005`, `CTR-008`.  
**Classificação:** `VALID` → `FIXED`.  
**Causa raiz:** leitura do estado fora da transação sem predicado no update e exceções suprimidas no restore.  
**Severidade original / residual:** `CRITICAL` / `LOW` no agregado local; integrações distribuídas mantêm risco separado.

### Evidência antes e depois

| Momento | Evidência |
|---|---|
| Antes | Duas transações podiam observar PENDING e repetir estoque/pontos; falha na variante era apenas `console.warn`. |
| Depois | Claim `id+status(+loja)` antes dos efeitos; conflito estável/HTTP 409; qualquer falha do restore reverte tudo. |
| Teste | Duas operações reais: exatamente um sucesso, um conflito, estoque 8→10 uma vez e um audit log. Falha P2025 no segundo incremento deixou o primeiro em 8. |

**Arquivos:** `services/order.service.ts`, `services/inventory.service.ts`, rotas de pedido/admin/confirmação, tipo e regressões relacionadas.  
**Commit:** nenhum.  
**Próximo passo:** manter a mesma chave de idempotência em workflows externos da etapa de transações.

## 2026-09-26 — DATABASE-03.3 — inbox de webhook retomável

**IDs de origem:** `DB-004`, `CTR-003`; correlatos `CTR-009`, `CTR-014`.  
**Classificação:** causa local `VALID` → `FIXED`; reconciliação externa `DEFERRED`/`NOT VERIFIED`.  
**Causa raiz:** a presença do evento era confundida com conclusão dos efeitos.  
**Severidade original / residual:** `CRITICAL` / `HIGH` pela fronteira distribuída com o gateway.

### Evidência antes e depois

| Momento | Evidência |
|---|---|
| Antes | Insert preenchia `processedAt`; retry retornava `ALREADY_PROCESSED` mesmo após falha. |
| Depois | Estados, tentativas, lease, erro, claim atômico, FAILED retomável e PROCESSED somente no fim. Colisão concorrente retorna 202 PROCESSING. |
| Teste | Falha injetada marcou FAILED; retries/colisão e fluxos de pagamento/refund/expiração passaram nos testes unitários. |

**Arquivos:** migration `20260926195700_webhook_inbox_state`, schema, webhook Asaas, simulador e testes.  
**Commit:** nenhum.  
**Próximo passo:** reconciliar eventos históricos e implementar consulta periódica ao Asaas em ambiente autorizado.

## 2026-09-26 — DATABASE-03.4 — tenant, ledger e dinheiro

**IDs de origem:** `DB-006`, `DB-007`, `DB-009`, `CTR-010`, `CTR-013`, `CTR-015`.  
**Classificação:** `VALID` → `DEFERRED` parcial.  
**Causa raiz:** relações validavam IDs isolados; ledger não tinha chave de operação; equações e parcela dependiam do app/cliente.  
**Severidade original / residual:** `HIGH` / `HIGH` devido aos subdomínios ainda pendentes.

### Evidência antes e depois

| Momento | Evidência |
|---|---|
| Antes | Order/Product/Loyalty aceitavam combinação user+loja sem FK composta; retry de EARN duplicava; cliente fornecia valor da parcela. |
| Depois | FKs compostas e checks `NOT VALID` protegem novas escritas; operationKey impede duplo ledger; parcela 120/3 ignorou payload 0,01 e persistiu 40. |
| Teste | Cross-tenant e total inconsistente rejeitados no PostgreSQL; retry de EARN produziu uma linha/saldo 10; 12 constraints foram validadas localmente. |

**Arquivos:** migration `20260926200500_tenant_and_ledger_invariants`, schema, checkout/loyalty e regressões.  
**Commit:** nenhum.  
**Próximo passo:** corrigir legado e validar constraints; decidir clawback, base dos pontos, juros e fonte de estoque antes de ampliar garantias.

## 2026-09-26 — DATABASE-03.5 — itens deliberadamente pendentes

**IDs:** `DB-008`, `DB-010`, `DB-012`, `DB-013`, `DB-014`, `DB-015`, `DB-016`, `DB-017`.  
**Estados:** `DEFERRED`, exceto `DB-015` e `DB-016` como `NOT VERIFIED`.  
**Severidade residual:** `HIGH`.

- DB-008 requer decisão de fonte de verdade e reconciliação ERP.
- DB-010 requer snapshots não vazios por versão e inventário de checksums.
- DB-012 requer política de guest/documento antes de unicidade.
- DB-013/014 requerem mudança de contrato/performance e fixtures de cardinalidade.
- DB-015 não recebeu índice sem `EXPLAIN (ANALYZE, BUFFERS)` representativo.
- DB-016 depende de Supabase autorizado e não foi promovido a defeito confirmado.
- DB-017 ganhou uma suite PostgreSQL, mas o harness legado/CI ainda não isola fixtures.

## 2026-09-26 — DATABASE-03 — encerramento da etapa

**Estado da etapa:** concluída; nenhuma etapa seguinte iniciada.  
**Publication Status:** `BLOCKED` (inalterado).  
**Documento:** `docs/remediation/DATABASE-FIXES.md`.  
**Risco residual:** `HIGH`.

### Validação final

| Verificação | Resultado |
|---|---|
| Cadeia PostgreSQL | 23 migrations do zero, exit 0; diff vazio. |
| Integração nova | 1 arquivo, 6/6 testes reais, exit 0. |
| Constraints | 12 FKs/checks validadas no banco local; todas `convalidated=true`. |
| Unitários | 57 arquivos, 421/421 testes, exit 0. |
| Tipos | `npx tsc --noEmit`, exit 0. |
| Lint direcionado | Exit 0. |
| Build | Exit 0; Next.js 16.3.5, 51 páginas. |
| Diff | `git diff --check`, exit 0. |
| Pasta de integração completa | Falhou por fixtures legadas que não criam Loja/Product e fazem limpeza global concorrente; registrado, não tratado como sucesso. |

Nenhum serviço real, credencial, produção ou cloud foi acessado. O PostgreSQL local descartável foi criado apenas para esta etapa e será removido após a coleta final de evidências.

## 2026-09-27 — TRANSACTIONS-04.1 — contrato canônico e caminho único

**IDs de origem:** `CTR-001`, `CTR-002`, `CTR-016`; correlatos `BE-001`, `BE-004`, `DB-008`, `FINAL-001`, `FINAL-005`, `FINAL-015`.  
**Classificação:** `VALID` → `FIXED` no fluxo público; decisão global de estoque de `DB-008` permanece `DEFERRED`.  
**Causa raiz:** navegador, API e serviço usavam DTOs/rotas diferentes; um segundo endpoint criava pedidos sem o caso de uso financeiro; a variante se perdia na conversão do carrinho.  
**Severidade original / residual:** `BLOCKER` + `CRITICAL` + `HIGH` / `MEDIUM` até E2E em browser e decisão da fonte de estoque.

### Evidência antes e depois

| Momento | Evidência |
|---|---|
| Antes | Formulário chamava rota ausente, envelope/nomenclatura divergiam, `variantID` era descartado e `POST /api/orders` criava sem pagamento. |
| Depois | Contrato compartilhado aponta para `/api/checkout`, preserva `variantId`, não envia valores financeiros como autoridade e consome o envelope correto; POST alternativo retorna 410. |
| Teste | Contrato passa pelo schema; build Next.js concluiu 51 páginas/rotas; integração vendeu a variante selecionada uma única vez. |

**Arquivos:** `lib/checkout-contract.ts`, `components/checkout/CheckoutForm.tsx`, `app/checkout/page.tsx`, `app/api/checkout/route.ts`, `app/api/orders/route.ts`, schema de validação e regressões.  
**Commit:** nenhum.  
**Próximo passo:** E2E real PIX/cartão/boleto em browser autorizado; remover o serviço legado sem chamador em etapa arquitetural.

## 2026-09-27 — TRANSACTIONS-04.2 — frete e dinheiro autoritativos

**IDs de origem:** `CTR-006`, `CTR-010`, `CTR-015`; correlatos `BE-003`, `DB-009`, `FINAL-004`.  
**Classificação:** `VALID` → `FIXED` no checkout; `CTR-015` permanece `DEFERRED` parcial no restante do domínio; integrações reais `NOT VERIFIED`.  
**Causa raiz:** custo/dimensões/cidade/parcelas atravessavam o trust boundary do navegador como autoridade; cache não incluía valor segurado; regra local não filtrava destino.  
**Severidade original / residual:** `CRITICAL` + `HIGH` + `MEDIUM` / `MEDIUM`, com risco externo ainda não verificado.

### Evidência antes e depois

| Momento | Evidência |
|---|---|
| Antes | Checkout aceitava frete do cliente; cálculo aceitava catálogo do payload; tabela local devolvia todas as cidades; parcela/juros divergiam da cobrança. |
| Depois | Banco fornece preço/dimensões; token HMAC vincula tenant, CEP, itens, preço, serviço e expiração; cache inclui total em centavos; CEP servidor-servidor seleciona uma cidade; servidor deriva fee/total/parcela. |
| Teste | Adulteração/reuso de token falha; CEP de São Paulo exclui regra do Rio; payload de preço/frete é ignorado; vetores de parcela usam arredondamento em centavos. |

**Arquivos:** `.env.example`, `lib/cep.ts`, `lib/freight-quote.ts`, rota/orquestrador/provedor de frete, `checkout.service.ts`, `installment.service.ts`, migration e testes.  
**Commit:** nenhum.  
**Próximo passo:** verificar ViaCEP, Correios e J&T em ambiente autorizado e definir tolerância para mudança de tarifa. Nenhuma chamada real foi feita.

## 2026-09-27 — TRANSACTIONS-04.3 — idempotência e fronteira banco–gateway

**IDs de origem:** `CTR-004`, `CTR-007`, `CTR-011`; correlatos `BE-007`, `SEC-012`, `FINAL-008`.  
**Classificação:** `VALID`; contenção de duplicidade/compensação `FIXED`, reconciliação automática `DEFERRED`, gateway real `NOT VERIFIED`.  
**Causa raiz:** chave opcional e sem fingerprint; pedido era commitado antes do HTTP e toda exceção era tratada como recusa, mesmo após possível criação da cobrança.  
**Severidade original / residual:** `CRITICAL` + 2 `HIGH` / `HIGH` até existir worker de reconciliação e prova em sandbox.

### Evidência antes e depois

| Momento | Evidência |
|---|---|
| Antes | Retry podia criar pedido/cobrança; timeout ou falha de `order.update` cancelava e liberava estoque apesar de resultado externo desconhecido; chave ausente podia retornar sucesso sem cobrança. |
| Depois | Chave pública obrigatória, fingerprint e workflow persistido; recusa determinística compensa; ambiguidade preserva reserva, marca reconciliação e bloqueia nova cobrança; configuração ausente falha antes do pedido. |
| Teste | Fake externo chamado uma vez após falha de persistência e retry bloqueado; recusa 422 cancela; PostgreSQL retorna o mesmo pedido no retry sem segunda cobrança. |

**Arquivos:** `app/api/checkout/route.ts`, `components/checkout/CheckoutForm.tsx`, `services/checkout.service.ts`, `prisma/schema.prisma`, migration de workflow, testes unitários e integração.  
**Commit:** nenhum.  
**Próximo passo:** worker por referência/pedido, alertas por idade e sandbox do Asaas; nunca repetir cobrança enquanto o resultado for incerto.

## 2026-09-27 — TRANSACTIONS-04.4 — webhook, timeout e refund

**IDs de origem:** `CTR-003`, `CTR-009`, `CTR-012`, `CTR-014`; correlatos `DB-004`, `BE-005`, `BE-012`, `FINAL-006`, `FINAL-009`.  
**Classificação:** `CTR-003` `ALREADY RESOLVED`; `CTR-009` e `CTR-012` `VALID` → `FIXED` localmente; `CTR-014` `DEFERRED` parcial; Asaas real `NOT VERIFIED`.  
**Causa raiz:** inbox confundia recebimento com conclusão; identidade/valor não eram reconciliados; timeout inferia estado pela idade; refund/chargeback não tinham workflow separado.  
**Severidade original / residual:** `CRITICAL` + 3 `HIGH` / `HIGH` por política e operação externas.

### Evidência antes e depois

| Momento | Evidência |
|---|---|
| Antes | Evento falho ficava consumido; valor/payment ID divergentes podiam marcar pago; cron cancelava cobrança ativa; refund tardio não gerava processo financeiro coerente. |
| Depois | Inbox retomável, schema/allowlist/ID estável, reconciliação Decimal e de identidade/método; timeout consulta gateway; refund/chargeback fora de ordem não regridem fulfillment e abrem reconciliação. |
| Teste | Retry/replay, valor divergente, payment ID conflitante, refund total, refund após SHIPPED, atraso e estados do timeout passaram com fixtures fictícias. |

**Arquivos:** `app/api/webhooks/asaas/route.ts`, `services/order-timeout.service.ts`, workflow no pedido, testes de webhook/timeout.  
**Commit:** nenhum.  
**Próximo passo:** refund parcial/iniciado pela aplicação, logística reversa, consulta periódica e matriz de eventos reais no sandbox.

## 2026-09-27 — TRANSACTIONS-04.5 — última unidade e pontos

**IDs de origem:** `CTR-005`, `CTR-008`, `CTR-013`, `CTR-016`; correlatos `DB-003`, `DB-005`, `DB-007`, `DB-008`, `BE-006`, `FINAL-007`, `FINAL-009`, `FINAL-014`, `FINAL-015`.  
**Classificação:** CAS/restore `ALREADY RESOLVED` pela etapa 03 e revalidado; reserva atômica/variante/base de pontos `VALID` → `FIXED`; política de estoque pai `DEFERRED`.  
**Causa raiz:** baixa dependia de leitura prévia, ID de variante se perdia e crédito recalculava base diferente do snapshot do pedido.  
**Severidade original / residual:** `CRITICAL` + 3 `HIGH` / `MEDIUM` até reconciliação com ERP e definição da fonte de estoque.

### Evidência antes e depois

| Momento | Evidência |
|---|---|
| Antes | Duas compras podiam atravessar a checagem; UI baixava só o pai; crédito confirmado podia diferir de `Order.pointsEarned`. |
| Depois | Updates condicionais exigem estoque suficiente em pai e variante; transação reverte o primeiro se o segundo falhar; PAID credita exatamente os pontos persistidos; operation keys impedem repetição. |
| Teste | Corrida real: um sucesso, um erro, pai=0, variante=0, um pedido/cobrança; regressões da etapa 03 mantêm um crédito/estorno e rollback de restore. |

**Arquivos:** `services/inventory.service.ts`, `services/order.service.ts`, `services/loyalty.service.ts`, tipos e testes.  
**Commit:** nenhum.  
**Próximo passo:** decisão de domínio e varredura de divergências históricas pai/variantes antes de migrar dados reais.

## 2026-09-27 — TRANSACTIONS-04.6 — migration e encerramento

**IDs consolidados tratados:** `CTR-001`–`CTR-016`, com estados individuais em `TRANSACTIONS-FIXES.md`.  
**Pendentes:** reconciliação automática de `CTR-004`; extensões de refund de `CTR-014`; padronização global de `CTR-015`; decisão `DB-008`; todas as verificações externas listadas no documento.  
**Estado da etapa:** concluída localmente; nenhuma etapa seguinte iniciada.  
**Publication Status:** `BLOCKED` (inalterado).  
**Severidade residual:** `HIGH`.

### Validação final

| Verificação | Resultado |
|---|---|
| Focais transacionais/frete | 5 arquivos, 35/35 testes, exit 0. |
| Unitários completos | 58 arquivos, 431/431 testes, exit 0. |
| PostgreSQL descartável | 2 arquivos, 7/7 testes reais, exit 0; duas tentativas anteriores não executaram casos por configuração local incorreta e foram registradas. |
| Migrations | 24 migrations; banco local vazio atualizado, exit 0. `migrate status` passou após fornecer também `DIRECT_URL`. |
| Tipos | `npx tsc --noEmit`, exit 0. |
| Lint global | Exit 0, 0 erros, 20 warnings fora do escopo. |
| Build | Exit 0; Next.js 16.3.5, 51 páginas/rotas. |
| Diff | `git diff --check`, exit 0 antes da documentação; apenas avisos LF/CRLF. |
| Ambiente local | Contêiner `codex-remediation04-postgres` removido após a prova; dados efêmeros não recuperáveis. |

### Entrega e limitações

- Criado: `docs/remediation/TRANSACTIONS-FIXES.md`.
- Atualizado cumulativamente: `docs/remediation/PROGRESS.md`.
- Migration pronta, mas não executada fora do PostgreSQL descartável.
- Commit: nenhum.
- Nenhum serviço real, conta, pagamento, transportadora, CEP, produção, cloud ou segredo foi acessado/alterado.
- Risco residual, responsáveis externos, pré-flight, reconciliação/compensação e critérios objetivos de encerramento estão em `TRANSACTIONS-FIXES.md`.

## 2026-09-27 — BACKEND-05.1 — carrinho autoritativo e concorrente

**IDs de origem:** `BE-011`, correlatos `BE-004`, `DB-008`, `CTR-016`, `FINAL-015`.  
**Classificação:** `VALID` → `FIXED` localmente.  
**Causa raiz:** uma operação pública de carrinho também criava catálogo e fazia read-then-write sem tenant/serialização.  
**Severidade original / residual:** `HIGH` / `LOW` no carrinho; decisão global da fonte de estoque continua `DEFERRED`.

### Evidência antes e depois

| Momento | Evidência |
|---|---|
| Antes | Produto sem variante gerava `ProductVariants`; primeiro item podia escolher outra loja; adições concorrentes perdiam incremento ou duplicavam criação. |
| Depois | Variante persistida e tenant são obrigatórios; produto sem variante retorna 409; lock de usuário serializa criação/incremento; snapshot vem do banco. |
| Teste | 20 adições simultâneas em PostgreSQL produziram 1 carrinho, 1 item, quantidade 20 e 1 variante; estoque zero e quantidades inválidas foram rejeitados. |

**Arquivos:** `services/cart.service.ts`, `app/api/cart/route.ts`, `tests/unit/cart.test.ts`, `tests/integration/backend-invariants.test.ts`.  
**Commit:** nenhum.  
**Próximo passo:** inventariar carrinhos ativos duplicados/cross-tenant históricos em cada banco autorizado antes de qualquer saneamento externo.

## 2026-09-27 — BACKEND-05.2 — máquina de estados, tracking e histórico

**IDs de origem:** `BE-013`, `ARCH-008`, `FINAL-026`; correlatos `BE-006`, `ARCH-010`.  
**Classificação:** `VALID` → `FIXED` localmente; extensão do histórico `DEFERRED`.  
**Causa raiz:** estado, exceção de retirada, rastreio e confirmação eram implementados por canais diferentes.  
**Severidade original / residual:** `HIGH` + `MEDIUM` / `LOW` localmente, `MEDIUM` até contrato de origem/motivo ser decidido.

### Evidência antes e depois

| Momento | Evidência |
|---|---|
| Antes | `deliveryType` não chegava à FSM; tracking era descartado; confirmação do cliente bypassava o serviço; histórico não era escrito; UI/admin duplicavam transições. |
| Depois | Uma lista canônica atende UI e domínio; todos os canais delegam ao CAS; pedido, tracking/confirmação, histórico e auditoria compartilham a transação. |
| Teste | Retirada paga foi entregue; o mesmo salto em entrega normal falhou; despacho persistiu tracking/histórico; campos extras foram rejeitados; confirmação preservou proprietário+tenant. |

**Arquivos:** `lib/order-transitions.ts`, `services/order.service.ts`, `services/admin.service.ts`, validators/rotas/componentes/tipos e regressões de pedido.  
**Commit:** nenhum.  
**Próximo passo:** se negócio exigir origem/motivo no histórico, criar migration compatível e backfill explícito; não inferir valores históricos.

## 2026-09-27 — BACKEND-05.3 — catálogo e contratos compatíveis

**IDs de origem:** `BE-014`, `BE-015`, `BE-017`, `ARCH-012`, `FINAL-020`, `FINAL-022`, `FINAL-027`.  
**Classificação:** `BE-015` `VALID` → `FIXED` localmente; `BE-014` e `BE-017` `DEFERRED` parcial.  
**Causa raiz:** schema aceito divergia da query/resposta; erros não tinham taxonomia comum; testes não acompanhavam o contrato real nem banco.  
**Severidade original / residual:** `HIGH` agregado / `HIGH` por CI e contrato HTTP ainda incompletos.

### Evidência antes e depois

| Momento | Evidência |
|---|---|
| Antes | `sortBy` era ignorado, não havia total/continuação, `toStatus` estava obsoleto e validação variava entre 400/422. |
| Depois | Allowlist de ordenação/desempate, filtros estritos e headers de paginação; corpo array compatível; endpoints tocados usam 422/códigos e 5xx público; DTO legado atualizado. |
| Limite | Suite HTTP antiga falhou antes dos 17 testes por fixture sem Loja (`User_lojaID_fkey`); CI ainda não sobe PostgreSQL. Não foi registrado como sucesso. |

**Arquivos:** `services/product.service.ts`, `lib/validators/product.ts`, `app/api/products/route.ts`, testes de paginação/contrato e `tests/integration/status-transitions.test.ts`.  
**Commit:** nenhum.  
**Próximo passo:** corrigir fixture HTTP com Loja/Product e cleanup escopado; depois adicionar job CI PostgreSQL e versão de envelope antes de padronizar todas as rotas.

## 2026-09-27 — BACKEND-05.4 — cenários ausentes e dependências

**IDs correlatos:** `ARCH-009`, `ARCH-010`, `ARCH-011`, `ARCH-012`, `ARCH-013`.  
**Estados:** `ARCH-009/010/011/012` `DEFERRED`; `ARCH-013` `NOT VERIFIED` (confiança original `SUSPECTED`).  
**Severidade residual:** `HIGH`.

- Não existe subsistema de cupom; expirado/reuso permanece `NOT VERIFIED`, sem inventar comportamento.
- `Product` não possui flag/ciclo ativo; estoque zero foi provado, mas “produto desativado” permanece `NOT VERIFIED`.
- Pontos insuficientes estão `ALREADY RESOLVED` e foram revalidados na suite completa.
- Cache/rate limit multi-instância, scheduler externo, Asaas/ERP e política de clawback dependem de ambiente/decisão autorizados.
- Nenhuma migration foi criada nesta etapa.

## 2026-09-27 — BACKEND-05.5 — encerramento da etapa

**IDs tratados:** `BE-001`–`BE-017`, com estados individuais em `BACKEND-FIXES.md`.  
**Estado da etapa:** concluída localmente; nenhuma etapa seguinte iniciada.  
**Publication Status:** `BLOCKED` (inalterado).  
**Severidade residual:** `HIGH`.

### Validação final

| Verificação | Resultado |
|---|---|
| Unitários | 59 arquivos, 440/440 testes, exit 0. |
| PostgreSQL descartável | 24 migrations aplicadas; 3 arquivos, 9/9 testes reais, exit 0. |
| Integração HTTP legada | Falhou no `beforeAll` por FK de Loja; 17 testes não executados. |
| Tipos | `npx tsc --noEmit`, exit 0. |
| Lint | Exit 0, 0 erros e 20 warnings fora do escopo. |
| Build | Exit 0; Next.js 16.3.5, 51 páginas/rotas. |
| Diff | `git diff --check`, exit 0 antes da documentação; apenas avisos LF/CRLF. |
| Ambiente local | `codex-remediation05-postgres` removido; dados efêmeros não recuperáveis. |

### Entrega e limitações

- Criado: `docs/remediation/BACKEND-FIXES.md`.
- Atualizado cumulativamente: `docs/remediation/PROGRESS.md`.
- Commit: nenhum.
- Nenhum serviço real, produção, conta, pagamento, banco compartilhado, cloud ou segredo foi acessado/alterado.
- Contratos globais, CI, fixture HTTP e decisões de cupom/produto ativo/clawback permanecem explicitamente pendentes.

## 2026-09-27 — ARCHITECTURE-06.1 — fronteiras incrementais do monólito modular

**IDs de origem:** `ARCH-010`; correlatos `BE-014`, `FINAL-027`.  
**Classificação:** `VALID` → `FIXED` no fluxo vertical Loja/Order DTO; achado global permanece `DEFERRED parcial`.  
**Causa raiz:** serviços de aplicação importavam APIs do Next e tipos pertencentes à apresentação.  
**Severidade original / residual:** `MEDIUM` / `LOW` no corte migrado, `MEDIUM` no restante do monólito.

### Evidência antes e depois

| Momento | Evidência |
|---|---|
| Antes | `services/loja.service.ts` importava `next/cache` e chamava `revalidateTag` por cast; `services/orders.service.ts` importava `UserOrder` de `app/profile/types`. |
| Depois | Invalidação Next está no Route Handler com `revalidateTag(tag, 'max')`; serviço mantém persistência/cache local; DTO compartilhado está em `types/order.types.ts`; teste impede regressão das duas fronteiras. |
| Testes | Antes: 2 arquivos, 7/7. Depois: 5 arquivos, 15/15; `tsc --noEmit` exit 0. |

**Arquivos:** `lib/cache-tags.ts`, `lib/tenant.ts`, `services/loja.service.ts`, `app/api/loja/settings/route.ts`, `services/orders.service.ts`, `types/order.types.ts`, `app/profile/types.ts`, três novas regressões arquiteturais.  
**Decisão:** `docs/adr/ADR-001-modular-layered-architecture.md` (`proposed`). A skill de ADR não pôde registrar AgentDB porque as ferramentas exigidas não estavam disponíveis; nenhum registro externo foi simulado.  
**Commit:** nenhum.  
**Próximo passo:** migrar outros fluxos somente quando houver impacto comprovado; não criar portas Prisma por cerimônia.

## 2026-09-27 — ARCHITECTURE-06.2 — gate PostgreSQL reproduzível

**IDs de origem:** `ARCH-002`, `ARCH-012`; correlatos `DB-001`, `DB-017`, `BE-017`, `FINAL-002`, `FINAL-020`.  
**Classificação:** `ARCH-002` `ALREADY RESOLVED` localmente → `FIXED` no workflow; `ARCH-012` `VALID` → `DEFERRED parcial`.  
**Causa raiz:** a CI validava apenas o arquivo Prisma e unitários, sem banco vazio, migrations, drift ou concorrência real.  
**Severidade original / residual:** `BLOCKER` + `HIGH` / `MEDIUM`; HTTP/E2E e integrações externas ainda não são gates.

### Evidência antes e depois

| Momento | Evidência |
|---|---|
| Antes | Workflow declarava URLs localhost sem serviço PostgreSQL, executava `prisma validate` e `npm test`, mas não aplicava migrations nem rodava integrações. |
| Depois | Job cria PostgreSQL 16 com healthcheck, aplica 24 migrations, falha em drift via `migrate diff --exit-code` e executa o script explícito `test:integration:core`. |
| Teste local equivalente | Banco vazio: 24 migrations, `No difference detected`; 3 arquivos e 9/9 integrações, exit 0. YAML carregado com sucesso por `js-yaml`. |

**Arquivos:** `.github/workflows/ci.yml`, `package.json`.  
**Commit:** nenhum.  
**Próximo passo:** tornar a fixture HTTP escopada e iniciar servidor local no job; só então promover toda `tests/integration` e um E2E mínimo a gate obrigatório.

## 2026-09-27 — ARCHITECTURE-06.3 — serviço canônico de pedidos

**IDs de origem:** `ARCH-010`; correlatos `BE-013`, `FINAL-026`.  
**Classificação:** `VALID` → `FIXED` para a duplicação `order`/`orders`; achado global permanece `DEFERRED parcial`.  
**Causa raiz:** uma projeção de pedidos do perfil vivia em um segundo módulo de serviço e dependia de tipo definido na apresentação.  
**Severidade original / residual:** `MEDIUM` / `LOW` no fluxo migrado.

### Evidência antes e depois

| Momento | Evidência |
|---|---|
| Antes | `services/orders.service.ts` coexistia com `order.service.ts` e era chamado diretamente por `app/profile/page.tsx`. |
| Depois | Projeção `getUserOrderHistory` pertence ao serviço canônico singular; módulo duplicado foi removido; perfil e DTO compartilhado apontam para camadas estáveis. |
| Teste | Consulta preservou tenant, `take/skip`, seleção, conversão Decimal e shape da UI; 4 arquivos, 11/11 testes, e typecheck passaram. |

**Arquivos:** `services/order.service.ts`, `app/profile/page.tsx`, remoção de `services/orders.service.ts`, `tests/unit/order-history-query.test.ts`, teste de fronteira.  
**Commit:** nenhum.  
**Próximo passo:** caracterizar qualquer outro shim/serviço duplicado antes de removê-lo; não consolidar por nome apenas.

## 2026-09-27 — ARCHITECTURE-06.4 — achados dependentes de política e infraestrutura

**IDs de origem:** `ARCH-007`, `ARCH-009`, `ARCH-011`, `ARCH-012`, `ARCH-013`; correlatos documentados em `ARCHITECTURE-FIXES.md`.  
**Classificação:** `ARCH-007/009/011/012` `DEFERRED` total ou parcial; `ARCH-013` `NOT VERIFIED` e preserva confiança original `SUSPECTED`.  
**Causa raiz:** reconciliação financeira, clawback, coordenação multi-instância, suíte HTTP/E2E e scheduler dependem de política de negócio, infraestrutura compartilhada ou estado externo que o repositório não prova.  
**Severidade original / residual:** HIGH/MEDIUM / `HIGH` agregado.

### Evidência e limites

| Item | Estado verificável |
|---|---|
| `ARCH-007` | Workflow persistido reduz duplicidade, mas não existe worker automático completo de reconciliação. |
| `ARCH-009` | Ledger é idempotente nos fluxos corrigidos; política para clawback com saldo já gasto não foi definida. |
| `ARCH-011` | Cache e rate limit continuam por processo; topologia real e backend compartilhado não foram verificados. |
| `ARCH-012` | PostgreSQL/migrations/drift/integracões centrais agora bloqueiam CI; fixture HTTP e E2E seguem pendentes. |
| `ARCH-013` | Endpoints de cron existem, mas o scheduler externo não é observável no repositório; nenhum defeito externo foi presumido. |

**Arquivos:** nenhum código adicional para esses itens; critérios e responsáveis estão em `docs/remediation/ARCHITECTURE-FIXES.md`.  
**Commit:** nenhum.  
**Próximo passo:** executar as verificações em ambientes autorizados e obter decisões explícitas de Produto/Financeiro/Plataforma; não improvisar infraestrutura local como solução de produção.

## 2026-09-27 — ARCHITECTURE-06.5 — encerramento da etapa

**IDs tratados:** `ARCH-001`–`ARCH-013`, com classificação individual em `ARCHITECTURE-FIXES.md`.  
**Estado da etapa:** concluída localmente; nenhuma etapa seguinte iniciada.  
**Publication Status:** `BLOCKED` (inalterado).  
**Severidade residual:** `HIGH`.

### Validação final

| Verificação | Resultado |
|---|---|
| Baseline focal | 2 arquivos, 7/7 testes, exit 0. |
| Regressões arquiteturais focais | Até 5 arquivos, 15/15; corte final consolidado 4 arquivos, 11/11; exit 0. |
| Unitários completos | 63 arquivos, 451/451 testes, exit 0. |
| PostgreSQL descartável | 24 migrations aplicadas; 3 arquivos, 9/9 integrações reais, exit 0. |
| Drift | `No difference detected`, exit 0. |
| Tipos | `npx tsc --noEmit`, exit 0. |
| Lint | Exit 0, 0 erros e 20 warnings fora do corte. |
| Build | Exit 0; Next.js 16.3.5, 51 páginas/rotas. |
| Diff | `git diff --check`, exit 0 antes da documentação; somente avisos LF/CRLF. |
| Ambiente local | Contêiner `codex-remediation06-postgres` conferido na porta 55436 e removido; dados efêmeros não recuperáveis. |

### Entrega e limitações

- Criado: `docs/remediation/ARCHITECTURE-FIXES.md`.
- Criado: `docs/adr/ADR-001-modular-layered-architecture.md` com status `proposed`.
- Atualizado cumulativamente: `docs/remediation/PROGRESS.md`.
- O registro AgentDB indicado pela skill de ADR não pôde ser feito porque as ferramentas não estavam disponíveis; nenhum registro externo foi simulado.
- A suíte HTTP legada e E2E não foram marcados como aprovados; permanecem pendentes.
- Commit: nenhum.
- Nenhum serviço real, produção, conta, pagamento, banco compartilhado, cloud, scheduler ou segredo foi acessado/alterado.

## 2026-09-27 — ADMIN-07.1 — cancelamento de pedido pago exige estorno confirmado

**IDs de origem:** `ADM-001`; correlatos `FINAL-009`, `CTR-014`, `BE-012`, `DB-005`.  
**Classificação:** `VALID` → `FIXED` para o caminho administrativo perigoso; comando de refund e sandbox permanecem `DEFERRED`/`NOT VERIFIED`.  
**Causa raiz:** a mesma transição `PAID → CANCELLED` servia ao painel e ao webhook, embora somente o segundo pudesse provar que houve estorno financeiro.  
**Severidade original / residual:** `CRITICAL` / `HIGH` até existir comando idempotente de refund e reconciliação externa.

### Evidência antes e depois

| Momento | Evidência |
|---|---|
| Antes | Admin podia cancelar pedido pago, liberar estoque e estornar pontos sem solicitar ou confirmar reembolso. |
| Depois | Serviço retorna `REFUND_REQUIRED` antes de transação/efeitos; rota responde 409; painel não oferece cancelamento de pago; webhook autenticado informa confirmação explícita. |
| Teste | Tentativa administrativa preserva pedido/estoque/ledger/auditoria; confirmação do adapter mantém o fluxo de estorno. 4 arquivos, 33/33 testes; typecheck exit 0. |

**Arquivos:** `types/admin.types.ts`, `services/order.service.ts`, rota administrativa, webhook real/simulador, `OrderStatusManager` e regressões de inventário/loyalty/status.  
**Commit:** nenhum.  
**Próximo passo:** criar comando de refund idempotente no adapter Asaas, estados de solicitação e worker de reconciliação; validar somente em sandbox autorizado.

## 2026-09-27 — ADMIN-07.2 — validação autoritativa de regras de frete

**IDs de origem:** `ADM-002`; correlatos `FINAL-004`, `ARCH-003`, `BE-003`, `CTR-006`, `DB-009`.  
**Classificação:** `VALID` → `FIXED` no boundary e no serviço; constraint de banco `ALREADY RESOLVED`.  
**Causa raiz:** o `POST` fazia cast do JSON e delegava valores não validados; o `PATCH` tinha schema local diferente; o serviço aceitava qualquer `number`.  
**Severidade original / residual:** `HIGH` / `LOW` localmente; dados externos preexistentes continuam `NOT VERIFIED`.

### Evidência antes e depois

| Momento | Evidência |
|---|---|
| Antes | Valor negativo/string/campos extras atravessavam o `POST`; apenas a UI e o `PATCH` tinham proteção parcial. |
| Depois | Schema estrito compartilhado exige cidade normalizada e número finito entre 0 e o teto técnico; serviço revalida; tenant continua vindo da sessão. |
| Teste | Negativo, string, ausente, campo extra, NaN e infinitos foram rejeitados sem chamada de persistência; payload válido usa o tenant autenticado. 3 arquivos, 23/23; typecheck exit 0. |

**Arquivos:** `lib/validators/admin-freight.ts`, rotas de frete, `services/freight.service.ts`, `tests/unit/admin-freight.test.ts`.  
**Commit:** nenhum.  
**Próximo passo:** inventariar valores negativos em cada banco autorizado antes do deploy; nenhuma correção de dado real foi executada.

## 2026-09-27 — ADMIN-07.3 — ajuste manual de pontos idempotente e confirmado

**IDs de origem:** `ADM-003`; correlatos `FINAL-014`, `ARCH-009`, `DB-007`, `BE-008`, `CTR-013`, `AUTH-004`, `SEC-005`.  
**Classificação:** `VALID` → `FIXED` para retry/limite/confirmação; política de clawback e segunda aprovação permanecem `DEFERRED`.  
**Causa raiz:** cada `POST` era uma nova intenção implícita, sem chave, limite ou confirmação contextual; o ledger não distinguia retry.  
**Severidade original / residual:** `HIGH` / `MEDIUM`, pois administrador autorizado ainda concentra poder e o teto precisa de homologação.

### Evidência antes e depois

| Momento | Evidência |
|---|---|
| Antes | Repetir payload incrementava carteira/ledger novamente; valor tinha magnitude ilimitada; as duas UIs submetiam diretamente. |
| Depois | UUID obrigatório gera `operationKey` por loja; replay devolve o lançamento existente; conflito de argumentos retorna 409; corrida P2002 converge após rollback; teto configurável e confirmação exibem cliente, pontos, equivalente e motivo. |
| Teste | Replay sequencial e arbitragem concorrente atualizam/criam uma vez; chave reutilizada com argumentos diferentes e valores acima do teto não causam efeito; CUSTOMER recebe 403. 5 arquivos, 40/40 e depois foco 2 arquivos, 13/13; typecheck exit 0. |

**Arquivos:** `.env.example`, `types/loyalty.types.ts`, serviço/rota de fidelidade, duas interfaces administrativas e regressões de loyalty/idempotência.  
**Commit:** nenhum.  
**Próximo passo:** Produto/Financeiro devem homologar `ADMIN_LOYALTY_MAX_ADJUSTMENT_POINTS`; segunda aprovação e reversão vinculada dependem de novos papéis/workflow.

## 2026-09-27 — ADMIN-07.4 — variantes históricas, exclusão e estoque agregado

**IDs de origem:** `ADM-005`, `ADM-006`, `ADM-010`; correlatos `FINAL-015`, `FINAL-026`, `DB-008`, `BE-011`, `CTR-016`, `FUX-003`.  
**Classificação:** `ADM-005` e invariante local de `ADM-010` `VALID` → `FIXED`; `ADM-006` `FIXED` para exclusão em uso e confirmação, arquivamento/restauração `DEFERRED`.  
**Causa raiz:** formulário descartava IDs; serviço apagava/recriava a grade; estoque pai era editável em paralelo; DELETE não distinguia cadastro descartável de produto referenciado.  
**Severidade original / residual:** `HIGH` + `MEDIUM` / `MEDIUM` até existir arquivamento e reconciliação de dados legados/ERP.

### Evidência antes e depois

| Momento | Evidência |
|---|---|
| Antes | Qualquer edição executava `deleteMany`; preço/texto de produto vendido podia falhar por FK; pai/variantes divergiam; delete físico devolvia 500 ou removia sem trilha. |
| Depois | IDs percorrem UI/DTO; variantes existentes são atualizadas por ID, novas são criadas e omissão histórica é recusada antes da mutação; estoque pai é soma server-side; produto em pedido/carrinho retorna 409; delete permitido é explícito, auditado e transacional. |
| Teste | IDs preservados, `deleteMany` ausente, soma 3+5=8 ignora 999 do cliente, remoção implícita e produto em uso não causam efeito parcial, delete elegível gera auditoria. 4 arquivos, 24/24; typecheck exit 0. |

**Arquivos:** `services/product.service.ts`, rotas/validators de produto, `ProductForm`, listagem administrativa e `tests/unit/admin-product-mutations.test.ts`; regressões tenant atualizadas.  
**Commit:** nenhum.  
**Próximo passo:** modelar `archivedAt/isActive`, restaurar e filtrar vitrine/cache em migration compatível; inventariar divergências pai/variantes e definir integração ERP antes de backfill.

## 2026-09-27 — ADMIN-07.5 — trilha transacional das mutações tocadas

**IDs de origem:** `ADM-008`; correlatos `FINAL-026`, `ARCH-008`, `BE-013`.  
**Classificação:** timeline de pedido `ALREADY RESOLVED`; produto e frete `VALID` → `FIXED`; achado global permanece `DEFERRED parcial`.  
**Causa raiz:** mutações sensíveis usavam transações de domínio sem evento administrativo uniforme; a auditoria já existente era concentrada em papel/status.  
**Severidade original / residual:** `HIGH` / `MEDIUM` por settings, configuração de fidelidade e edições diretas de nota/rastreio ainda não uniformizadas.

### Evidência antes e depois

| Momento | Evidência |
|---|---|
| Antes | Produto/preço/estoque e frete não registravam ator/snapshot; falha de histórico de status citada no relatório já havia sido corrigida na etapa 05. |
| Depois | Create/update/delete de produto e frete gravam `AuditLog` na mesma transação, com entidade, ator, tenant e before/after aplicável; falha da auditoria reverte a mutação. |
| Teste | Create/delete auditados, outro tenant não altera nem audita, produto em uso e variante omitida não deixam evento parcial. Foco consolidado: 4 arquivos, 25/25; typecheck exit 0. |

**Arquivos:** `services/product.service.ts`, `services/freight.service.ts`, rotas correspondentes e regressões administrativas.  
**Commit:** nenhum.  
**Próximo passo:** definir contrato único com request ID/retenção/redação e migrar settings, loyalty config e notas/rastreio; não duplicar a timeline de pedidos já canônica.

## 2026-09-27 — ADMIN-07.6 — auditoria redigida de notas e rastreio

**IDs de origem:** `ADM-008`; correlatos `ADM-009`, `FINAL-026`.  
**Classificação:** `VALID` → `FIXED` para notas/rastreio; achado global permanece `DEFERRED parcial`.  
**Causa raiz:** endpoints atualizavam `Order` diretamente, fora de serviço/transação e sem ator ou valor anterior.  
**Severidade original / residual:** `HIGH` / `MEDIUM`, pois settings e configuração de fidelidade ainda não usam a trilha uniforme.

### Evidência antes e depois

| Momento | Evidência |
|---|---|
| Antes | Nota e rastreio eram sobrescritos sem evento; a rota fazia acesso direto ao Prisma. |
| Depois | Serviços tenant-scoped gravam update e `AuditLog` na mesma transação; nota livre é redigida para presença/comprimento; input é estrito e limitado. |
| Teste | Admin da loja altera e audita; tentativa cross-tenant não atualiza nem audita. A primeira expectativa da fixture errou comprimentos (25/21); corrigida para 26/22. Resultado final: 2 arquivos, 7/7; typecheck exit 0. |

**Arquivos:** `services/order.service.ts`, rotas de notas/rastreio e `tests/unit/admin-order-audit.test.ts`.  
**Commit:** nenhum.  
**Próximo passo:** adicionar settings/loyalty config ao contrato de auditoria e definir retenção/request ID.

## 2026-09-27 — ADMIN-07.7 — invariante do último administrador ativo

**IDs de origem:** `ADM-004`; correlatos `FINAL-019`, `AUTH-012`, `AUTH-015`, `SEC-004`, `SEC-020`.  
**Classificação:** `ALREADY RESOLVED` na etapa 01.  
**Causa raiz original:** contagem fora da transação incluía admins bloqueados e permitia corrida de rebaixamento.  
**Severidade original / residual:** `HIGH` / `LOW`.

**Evidência atual:** `services/user.service.ts` executa alvo, ator e contagem `ADMIN ACTIVE` sob transação `Serializable`; regressões completas continuam verdes. Não foi duplicado código. Recuperação de acesso em infraestrutura externa permanece procedimento operacional não executado.

## 2026-09-27 — ADMIN-07.8 — segredo de Correios fora do cliente

**IDs de origem:** `ADM-007`; correlatos `FINAL-010`, `AUTH-001`, `SEC-001`, `BE-002`.  
**Classificação:** `ALREADY RESOLVED` na etapa 01; rotação externa `DEFERRED`.  
**Causa raiz original:** o DTO administrativo reutilizava o modelo persistido e devolvia segredo ao navegador.  
**Severidade original / residual:** `HIGH` / `MEDIUM` até rotação autorizada.

**Evidência atual:** allowlist de settings não seleciona nem serializa `correiosPassword`; a UI não o mantém/reenvia. Nenhum valor real foi lido ou rotacionado.

## 2026-09-27 — ADMIN-07.9 — rastreio na transição de pedido

**IDs de origem:** `ADM-009`; correlatos `ADM-008`, `FINAL-026`, `BE-013`, `ARCH-008`.  
**Classificação:** `ALREADY RESOLVED` na etapa 05.  
**Causa raiz original:** schema removia silenciosamente `trackingCode` e a rota repassava somente o status.  
**Severidade original / residual:** `MEDIUM` / `LOW`.

**Evidência atual:** contrato estrito aceita rastreio somente na transição compatível e o persiste com status, histórico e auditoria na mesma transação. Regressões de contrato/status passaram; homologação visual E2E continua pendente.

## 2026-09-27 — ADMIN-07.10 — gate administrativo e banco real descartável

**IDs de origem:** `ADM-011`; correlatos `FINAL-020`, `TST-001` a `TST-010`.  
**Classificação:** `VALID` → `FIXED parcial`; cobertura HTTP/E2E completa `DEFERRED`.  
**Causa raiz:** contratos legados e ausência de fixtures concorrentes deixavam as invariantes administrativas fora do gate.  
**Severidade original / residual:** `MEDIUM` / `MEDIUM`.

### Evidência antes e depois

| Momento | Evidência |
|---|---|
| Antes | Testes de status usavam contrato obsoleto; não havia prova PostgreSQL para retry de pontos, variante histórica, delete em uso ou constraint de frete. |
| Depois | Contratos foram atualizados e `admin-invariants.test.ts` entrou no `test:integration:core`. |
| Teste | Primeira execução administrativa falhou antes dos casos porque a fixture omitia `CartItem.imageUrl`; fixture corrigida. Final: unitários 68 arquivos/475 testes; integração core 4 arquivos/13 testes; todos exit 0. |

**Arquivos:** `tests/integration/admin-invariants.test.ts`, `tests/integration/status-transitions.test.ts`, testes unitários correlatos e `package.json`.  
**Próximo passo:** sanear fixtures da suíte HTTP legada e executar matriz real anon/customer/admin para todas as rotas.

## 2026-09-27 — ADMIN-07.11 — taxonomia administrativa ausente

**IDs de origem:** `ADM-012`; correlato `FINAL-026`.  
**Classificação:** `VALID` → `DEFERRED`.  
**Causa raiz:** o domínio lê `Brand`/`CategoryTag`, mas não há decisão/fluxo de manutenção administrativa.  
**Severidade original / residual:** `MEDIUM` / `MEDIUM`.

**Evidência:** modelos e leitura do catálogo permanecem presentes; CRUD, associação no formulário, arquivamento e política de slug permanecem ausentes. Nenhum módulo foi improvisado sem decisão de produto. Cupons e ações em lote continuam não aplicáveis por inexistência do subsistema.

## 2026-09-27 — encerramento da etapa 07 — painel administrativo

**Documento:** `docs/remediation/ADMIN-FIXES.md`.  
**Estado:** etapa local concluída; publicação financeira permanece `BLOCKED`.  
**IDs tratados:** `ADM-001` a `ADM-012`; nenhum ID foi apagado ou transformado de `NOT VERIFIED` em confirmado.  
**Pendências materiais:** refund/reconciliação Asaas (`ADM-001`), rotação externa (`ADM-007`), auditoria de settings/loyalty config (`ADM-008`), soft delete/restore (`ADM-006`), HTTP/E2E completo (`ADM-011`) e decisão de taxonomia (`ADM-012`).

### Validação final

| Verificação | Resultado |
|---|---|
| Unitários completos | 68 arquivos, 475/475 testes, exit 0. |
| PostgreSQL descartável | 24 migrations; 4 arquivos, 13/13 integrações reais, exit 0. |
| Migrações/drift | `Database schema is up to date`; `No difference detected`, exit 0. |
| Tipos | `npx tsc --noEmit`, exit 0. |
| Lint | Exit 0, 0 erros; warnings fora do escopo permanecem. |
| Build | Next.js 16.3.5, 51 páginas/rotas, exit 0. |
| Serviços reais | Nenhum acesso a produção, gateway, email, Correios, ViaCEP, Supabase, cloud ou conta real. |

**Commit:** nenhum. O contêiner `codex-remediation07-postgres`, conferido como `postgres:16-alpine` na porta local 55437, foi removido após os testes; seus dados efêmeros não são recuperáveis. A etapa 08 não foi iniciada nesta execução.

## 2026-09-27 — WEB-09.1 — URLs públicas e metadados tenant-aware

**IDs de origem:** `WEB-001`, `WEB-002`, `WEB-003`, `WEB-004`, `WEB-005`; correlatos `FINAL-025`, `FINAL-032`, `FUX-006`.  
**Classificação:** sincronização de filtros `ALREADY RESOLVED`; rota de produto/teclado e metadata `VALID` → `FIXED`; domínio publicado permanece `NOT VERIFIED`.  
**Causa raiz:** produto era estado React sob `/`, enquanto metadata global não possuía origem canônica confiável nem arquivos especiais de descoberta.  
**Severidade original / residual:** `HIGH` / `MEDIUM` até homologar domínio, previews e indexabilidade no deploy.

### Evidência antes e depois

| Momento | Evidência |
|---|---|
| Antes | Produto não tinha URL/link; sitemap, robots, canonical, OG/Twitter e JSON-LD não existiam; rotas privadas herdavam indexação. |
| Divergência | O hook atual já sincronizava busca, marca, tags, preço e página com query string e histórico; essa parcela de `WEB-001` foi reclassificada como `ALREADY RESOLVED`. |
| Depois | `/produto/[id]` renderiza no servidor, possui canonical/social metadata e `Product` JSON-LD; cards são links; home tem `OnlineStore`; robots/sitemap usam somente origem configurada e falham fechados sem ela; auth/checkout/profile/admin declaram `noindex`. |
| Teste | Origem ausente bloqueia crawl, sitemap contém apenas home/produto do tenant, IDs são codificados e JSON-LD neutraliza `<`. 3 arquivos, 13/13 testes; typecheck exit 0. |

**Arquivos:** `lib/web-seo.ts`, `app/layout.tsx`, `app/robots.ts`, `app/sitemap.ts`, `app/produto/[id]/page.tsx`, `app/page.tsx`, `components/home/HomeClient.tsx`, metadata privada e `tests/unit/web-seo.test.ts`.  
**Commit:** nenhum.  
**Próximo passo:** validar host/canonical, XML, HTML inicial e previews no domínio autorizado; política futura de slug/redirect depende de Produto/SEO e não foi improvisada com migração nesta etapa.

## 2026-09-27 — WEB-09.2 — semântica e validação acessível do checkout

**IDs de origem:** `WEB-006`, `WEB-007`; correlatos `FINAL-023`, `FUX-004`.  
**Classificação:** `VALID` → `FIXED` no markup e no comportamento local; anúncio por tecnologia assistiva permanece `NOT VERIFIED`.  
**Causa raiz:** labels, erro e escolhas eram apenas visuais, sem relações programáticas ou controles nativos.  
**Severidade original / residual:** `HIGH` / `MEDIUM` até o percurso assistivo completo.

### Evidência antes e depois

| Momento | Evidência |
|---|---|
| Antes | Identificação, endereço e cartão não ligavam label/campo; não havia autocomplete/estado de erro; entrega, frete e pagamento usavam containers clicáveis. |
| Depois | `id`/`htmlFor`, nomes, autocomplete, `inputMode`, `aria-invalid`/`aria-describedby`, resumo vivo e foco no primeiro inválido; escolhas em `fieldset`/`legend` e radios nativos. |
| Teste | Contratos estáticos e regras financeiras: 3 arquivos, 23/23 testes, exit 0; suíte completa final 70 arquivos, 482/482. |

**Arquivos:** `components/checkout/CheckoutForm.tsx`, `app/checkout/page.tsx`, `app/checkout/layout.tsx`, páginas de confirmação/perfil e `tests/unit/web-accessibility-contracts.test.ts`.  
**Commit:** nenhum.  
**Próximo passo:** QA deve usar carrinho/sessão fictícios, teclado e leitor de tela em browser autorizado; árvore acessível não foi simulada.

## 2026-09-27 — WEB-09.3 — foco, overlays, landmarks e redução de movimento

**IDs de origem:** `WEB-005`, `WEB-008`, `WEB-009`, `WEB-010`, `WEB-011`; correlatos `FINAL-024`, `FINAL-030`, `FINAL-031`, `FUX-004`, `FUX-005`, `FUX-011`, `FUX-012`.  
**Classificação:** causas confirmadas `VALID` → `FIXED` no código; alegação de vários `h1` simultâneos na confirmação `INVALID`; validação assistiva abrangente `NOT VERIFIED`.  
**Causa raiz:** interações não semânticas, overlays próprios e visibilidade/animação acopladas ao JavaScript não tinham uma política comum de teclado, foco e preferência do usuário.  
**Severidade original / residual:** `HIGH` + `MEDIUM` / `MEDIUM`.

### Evidência antes e depois

| Momento | Evidência |
|---|---|
| Antes | Card sem link, menu oculto ainda focável, drawers sem ciclo modal, ausência de skip link, outlines removidos e vídeo/GSAP/smooth scroll sem reduced motion. |
| Primeira correção | Captura móvel após 5 s ainda mostrou o hero sem conteúdo: o container continuava dependente do ciclo de vídeo/animação. O item não foi marcado como concluído. |
| Depois | Cards usam links; overlays usam Radix Sheet; skip link/main/headings e foco visível foram adicionados; reduced motion pausa o vídeo e evita animação; conteúdo do hero fica sempre disponível. |
| Teste | Contratos estáticos verdes e Chrome headless mostrou produto em desktop e hero visível com `--force-prefers-reduced-motion`; capturas preservadas em `docs/remediation/evidence/web09`. |

**Arquivos:** `components/home/HomeClient.tsx`, `HeroVideo.tsx`, `MobileMenu.tsx`, componentes de catálogo, `components/ui/sheet.tsx`, `app/layout.tsx`, `app/globals.css` e regressão estática.  
**Commit:** nenhum.  
**Próximo passo:** executar Lighthouse/axe, árvore acessível, contraste e percurso Tab/Shift+Tab/Escape/retorno de foco com tenants representativos. O conector Chrome DevTools não estava disponível nesta execução.

## 2026-09-27 — WEB-09.4 — CSP, 404 e boundaries de erro

**IDs de origem:** `WEB-012`, `WEB-013`; correlatos `FINAL-032`, `SEC-016`, `SEC-017`.  
**Classificação:** `WEB-012` `VALID` → `FIXED parcial` / `DEFERRED`; `WEB-013` `VALID` → `FIXED` localmente; erros de infraestrutura permanecem `NOT VERIFIED`.  
**Causa raiz:** CSP única aceitava `unsafe-eval` também em produção e a aplicação dependia das experiências genéricas do framework para ausência/falha.  
**Severidade original / residual:** `MEDIUM` + `LOW` / `MEDIUM`.

### Evidência antes e depois

| Momento | Evidência |
|---|---|
| Antes | `unsafe-inline` e `unsafe-eval` estavam declarados para todos os ambientes; não havia `not-found`, `error` ou `global-error`. |
| Depois | Produção remove `unsafe-eval` e reforça `object-src`, framing, base e forms; APIs emitem `X-Robots-Tag`; UIs de 404/erro oferecem recuperação. |
| Teste | Header efetivo em `next start` não contém `unsafe-eval`; `/rota-inexistente` respondeu 404 com UI própria; teste de CSP garante compatibilidade dev e política prod. |

**Arquivos:** `lib/csp.js`, `next.config.js`, `app/not-found.tsx`, `app/error.tsx`, `app/global-error.tsx` e `tests/unit/web-accessibility-contracts.test.ts`.  
**Commit:** nenhum.  
**Próximo passo:** CSP report-only/nonce em staging e teste de falha/retry na topologia autorizada; `unsafe-inline` não foi removido de forma arriscada nesta etapa.

## 2026-09-27 — encerramento da etapa 09 — SEO, acessibilidade e plataforma web

**Documento:** `docs/remediation/WEB-FIXES.md`.  
**Estado:** etapa local concluída; publicação global permanece `BLOCKED` pelo risco financeiro anterior e validações externas permanecem pendentes.  
**IDs tratados:** `WEB-001` a `WEB-013`; duplicatas `FINAL-023`, `FINAL-024`, `FINAL-025`, `FINAL-030`, `FINAL-031`, `FINAL-032` e correlatos FUX foram preservadas.  
**Pendências materiais:** política de slug/facetas, domínio/CDN, previews/crawlers, leitor de tela/teclado/contraste, console/hydration, CSP sem `unsafe-inline` e erros de infraestrutura. A etapa 08 não foi iniciada automaticamente.

### Validação final

| Verificação | Resultado |
|---|---|
| Unitários completos | 70 arquivos, 482/482 testes, exit 0. |
| PostgreSQL/HTTP local | 24 migrations em banco descartável; home, produto, robots, sitemap, login, checkout e API 200; rota ausente 404. |
| Metadata | Canonical e JSON-LD presentes no HTML inicial da home e do produto; noindex e `X-Robots-Tag` conferidos. |
| Browser headless | Rota de produto renderizada em desktop; hero móvel visível com reduced motion forçado; capturas preservadas. |
| Tipos | `npx tsc --noEmit`, exit 0. |
| Lint | Exit 0, 0 erros e 20 warnings preexistentes/fora do corte. |
| Build | Next.js 16.3.5, 51 páginas/rotas, exit 0. |
| Diff | `git diff --check`, exit 0; somente avisos LF/CRLF. |
| Serviços reais | Nenhum acesso a produção, mecanismo de busca, social crawler, gateway, email, storage, cloud, conta ou credencial real. |

### Falhas e limitações registradas

- O teste de acessibilidade falhou inicialmente por resolução CommonJS do alias do módulo CSP; passou após usar resolução absoluta no teste.
- Duas capturas iniciais mostraram conteúdo do hero invisível; a dependência de visibilidade foi corrigida e a prova final preservada.
- Uma checagem HTTP intermediária tentou declarar a variável reservada `$HOME` do PowerShell; foi repetida como `$homeHtml` e passou.
- A tentativa de remote debugging foi bloqueada pela política local e `--dump-dom` não produziu stdout capturável no Chrome Windows.
- Chrome DevTools/Lighthouse, axe, leitor de tela, árvore acessível, contraste calculado e console/hydration permanecem `NOT VERIFIED`.

**Commit:** nenhum. O servidor local foi encerrado; o contêiner `codex-remediation09-postgres`, conferido como `postgres:16-alpine` na porta `127.0.0.1:55438`, foi removido. A fixture e os artefatos temporários apagados eram efêmeros e não são recuperáveis; as três capturas finais permanecem em `docs/remediation/evidence/web09`.

## 2026-09-27 — PERF-10.1 — catálogo inicial limitado e filtrado no servidor

**IDs de origem:** `PERF-001`; correlatos `FINAL-022`, `DB-013`, `BE-015`, `FUX-007`.  
**Classificação:** `VALID` → `FIXED` para payload/hidratação e paginação da home; busca textual avançada e facetas em grande escala permanecem `DEFERRED`.  
**Causa raiz:** a home ignorava a paginação já existente, consultava relações de todos os produtos e serializava o catálogo integral para filtragem no navegador.  
**Severidade original / residual:** `HIGH` / `MEDIUM`.

### Evidência antes e depois

| Condição comparável | Antes | Depois |
|---|---:|---:|
| Fixture local | 1 tenant, 500 produtos e 500 variantes fictícios no mesmo PostgreSQL 16 | Mesma fixture e banco |
| Produtos únicos no HTML/RSC inicial | 500 | 12 |
| Resposta inicial da home | 441.691 bytes | 76.157 bytes |
| Dez requests aquecidos | TTFB observado entre 66,7 e 89,8 ms | TTFB observado entre 16,1 e 28,8 ms |
| Filtro composto | Executado sobre a coleção integral no browser | Marca, tags, preço, busca e página resolvidos no servidor; resposta continha 12 produtos |

Os valores são amostra local, sem throttling, no mesmo computador e processo; não são percentuais de produção nem promessa de capacidade.

**Arquivos:** `app/page.tsx`, `services/product.service.ts`, `hooks/useProductFilters.ts`, `components/home/HomeClient.tsx`, `lib/catalog-query.ts` e `tests/unit/performance-catalog.test.ts`.  
**Teste antes/depois:** baseline HTTP reproduziu 500 itens; depois, 3 arquivos e 12/12 testes focais, build exit 0 e prova HTTP com home/filtro 200.  
**Comandos:** build de produção, `curl.exe` em 10 amostras aquecidas e Vitest focal.  
**Commit:** nenhum.  
**Próximo passo:** medir seletividade/planos com distribuição representativa antes de alterar busca/índices; produtos legados dependentes apenas das heurísticas regex do navegador exigem backfill de marca/tags canônicas, não retorno ao catálogo ilimitado.

## 2026-09-28 — PERF-10.2 — leitura de produtos em lote no checkout

**IDs de origem:** `PERF-005`; correlatos `FINAL-017`, `DB-002`, `CT-001`.  
**Classificação:** `VALID` → `FIXED` para as leituras de produto; a serialização deliberada da reserva de estoque não é N+1 acidental e foi preservada.  
**Causa raiz:** o checkout resolvia produto e variantes com um `findUnique` dentro do loop de itens, embora todos os IDs fossem conhecidos antes da transação.  
**Severidade original / residual:** `HIGH` / `MEDIUM` (o fluxo ainda depende da latência do gateway, tratado separadamente em `PERF-006`).

### Evidência antes e depois

| Momento | Evidência |
|---|---|
| Antes | Até 50 itens autorizados geravam até 50 `product.findUnique`, antes da reserva de estoque. |
| Depois | IDs são deduplicados e uma única `product.findMany` limitada ao tenant carrega produtos e variantes; validação, preço autoritativo e mensagens permanecem por item. |
| Regressão | O teste prova uma chamada em lote com `id in [...]` + `lojaID` e nenhuma chamada a `findUnique` no adaptador Prisma completo. |

**Arquivos:** `services/checkout.service.ts`, `tests/unit/transactions-remediation.test.ts`.  
**Teste antes/depois:** inspeção confirmou consulta dentro do loop; depois, 2 arquivos e 11/11 testes focais, seguidos de typecheck, exit 0.  
**Comandos:** `npx vitest run tests/unit/transactions-remediation.test.ts tests/unit/checkout-authoritative.test.ts`; `npx tsc --noEmit`.  
**Commit:** nenhum.  
**Próximo passo:** manter medição de concorrência no PostgreSQL descartável; não paralelizar os `updateMany` de reserva porque a ordem determinística reduz deadlock e cada atualização é condicional ao saldo.

## 2026-09-28 — PERF-10.3 — agregações de clientes limitadas no banco

**IDs de origem:** `PERF-007`; correlato `FINAL-022`.  
**Classificação:** `VALID` → `FIXED`.  
**Causa raiz:** listagem e detalhe carregavam e reduziam no Node todo o histórico de pedidos e itens do cliente.  
**Severidade original / residual:** `HIGH` / `LOW`.

| Momento | Evidência |
|---|---|
| Antes | A listagem incluía todos os pedidos de cada usuário da página; o detalhe materializava todos os pedidos e itens, além de uma consulta separada para a primeira compra. |
| Depois | A página busca usuários sem relações e agrega apenas seus IDs; o detalhe usa duas consultas agregadas paralelas, com o produto mais comprado limitado a uma linha. |
| Regressão | Fixtures com quatro e mil pedidos preservam totais, datas, entrega preferida e cancelamentos, e provam ausência de `order.findMany`/`findFirst`. |

**Arquivos:** `services/customer.service.ts`, `tests/unit/performance-customer-metrics.test.ts`, `tests/unit/cpf-cnpj-persistence.test.ts`.  
**Teste:** 2 arquivos, 13/13 testes; typecheck exit 0.  
**Comandos:** `npx vitest run tests/unit/performance-customer-metrics.test.ts tests/unit/cpf-cnpj-persistence.test.ts`; `npx tsc --noEmit`.  
**Commit:** nenhum.  
**Próximo passo:** repetir a medição de duração e planos no PostgreSQL descartável; a melhora comprovada aqui é de cardinalidade/payload, não um percentual de produção.

## 2026-09-28 — PERF-10.4 — cache limitado e coalescido

**IDs de origem:** `PERF-008`; correlato `FINAL-017`.  
**Classificação:** `VALID` → `FIXED` no processo local; cache distribuído e invalidação entre réplicas permanecem `DEFERRED`.  
**Causa raiz:** o `Map` crescia sem limite e misses simultâneos da mesma chave repetiam a factory.  
**Severidade original / residual:** `MEDIUM` / `MEDIUM` em topologia com múltiplas instâncias.

| Momento | Evidência |
|---|---|
| Antes | Sem capacidade máxima, sem recência e 100 misses podiam iniciar 100 leituras idênticas. |
| Depois | Limite LRU simples de 1.000 entradas, remoção de expirados, timer sem reter o processo e uma promise em voo por chave tenant-aware; falhas não ficam memorizadas. |
| Regressão | 100 chamadas concorrentes executam a factory uma vez; a falha permite retry; a 1.001ª entrada expulsa a menos recente; isolamento A/B permanece verde. |

**Arquivos:** `lib/cache.ts`, `tests/unit/cache-tenant.test.ts`.  
**Teste:** 3 arquivos, 19/19 testes; typecheck exit 0.  
**Comandos:** Vitest focal de cache/cross-tenant/dashboard; `npx tsc --noEmit`.  
**Commit:** nenhum.  
**Próximo passo:** se houver mais de uma réplica, escolher backend distribuído e política de invalidação em arquitetura/operação antes de considerar o risco encerrado.

## 2026-09-28 — PERF-10.5 — checkout resolvido no servidor e formulário sob demanda

**IDs de origem:** `PERF-004`; correlatos `FINAL-029`, `FUX-010`, `CQ-002`.  
**Classificação:** `VALID` → `FIXED`.  
**Causa raiz:** a rota inteira era cliente, buscava `/api/loja/active` somente após hydration e importava o formulário completo estaticamente.  
**Severidade original / residual:** `MEDIUM` / `LOW`.

| Condição comparável | Antes | Depois |
|---|---:|---:|
| JS bruto da entrada `/checkout` no build local | 538.041 bytes em 10 chunks | 165.814 bytes em 7 chunks |
| HTML inicial | bloqueio de tela inteira aguardando fetch cliente | tenant, cabeçalho e estado de carrinho renderizados no servidor |
| Request adicional de configuração | após hydration | eliminado |
| HTTP local | 23.116 bytes no baseline com loader | 26.802 bytes com conteúdo útil, status 200 e TTFB observado de 15,7 ms |

**Arquivos:** `app/checkout/page.tsx`, `components/checkout/CheckoutPageClient.tsx`, `tests/unit/performance-checkout-page.test.ts`.  
**Teste:** contrato focal 2/2; build exit 0; HTTP local comprovou ausência da mensagem de loading e presença da loja/carrinho.  
**Commit:** nenhum.  
**Próximo passo:** o carrinho persistido e o formulário ainda exigem hydration; dividir cada meio de pagamento depende de trace de uso e não foi feito sem medição.

## 2026-09-28 — PERF-10.6 — hero e imagens críticas da vitrine

**IDs de origem:** `PERF-002`, `PERF-003`; correlatos `FINAL-030`, `FUX-011`, `WEB-010`.  
**Classificação:** `PERF-002` `VALID` → `FIXED` no caminho de carregamento, com LCP real `NOT VERIFIED`; `PERF-003` `VALID` → `FIXED parcial`, demais telas `DEFERRED`.  
**Causa raiz:** vídeo de 3.803.869 bytes e GSAP participavam do caminho inicial; cards/galeria usavam `<img>` sem dimensões ou `sizes`.  
**Severidade original / residual:** `HIGH` + `MEDIUM` / `MEDIUM`.

| Condição comparável | Antes | Depois |
|---|---:|---:|
| JS bruto da entrada `/` | 260.304 bytes | 189.618 bytes |
| Hero inicial | `preload=auto`, autoplay e revelação dependente de vídeo/GSAP | texto e header imediatos; poster no HTML; `preload=none`; source do vídeo só após 2 s e nunca em reduced motion |
| Imagens home/produto | `<img>` sem dimensões/srcset/sizes | `next/image`, dimensões, `sizes` por viewport e bypass seguro para host não configurado |
| Prova HTTP | não havia pipeline responsivo | HTML possui `srcset`; URL `/_next/image` respondeu 200 `image/png` |

**Arquivos:** `components/home/HeroVideo.tsx`, `components/home/HomeClient.tsx`, `components/ConditionalHeader.tsx`, `lib/utils.ts`, `package.json`, `package-lock.json`, `tests/unit/performance-media.test.ts`, `tests/unit/web-accessibility-contracts.test.ts`.  
**Teste:** 3 arquivos, 9 testes (uma expectativa antiga falhou e foi atualizada para a política mais restritiva); typecheck e build exit 0.  
**Commit:** nenhum.  
**Próximo passo:** executar trace Chrome/Lighthouse em 320/768/1366/1920, redes cold/warm e CDN autorizado; migrar os `<img>` restantes depois de medir as telas correspondentes. Nenhum valor de LCP/CLS foi inventado.

## 2026-09-28 — PERF-10.7 — profiler de queries observável e gate PostgreSQL

**IDs de origem:** `PERF-010`; correlato `FINAL-020`.  
**Classificação:** `VALID` → `FIXED` para contagem e gate central; carga abrangente continua `DEFERRED`.  
**Causa raiz:** o Prisma não emitia evento `query`, o helper tentava `$off` inexistente e o arquivo não fazia parte do gate central.  
**Severidade original / residual:** `MEDIUM` / `LOW`.

| Momento | Evidência |
|---|---|
| Antes | Relatórios podiam ter `queryCount=0` e duração zero sem executar medição real. |
| Depois | Cliente em teste/profiling emite eventos, observers possuem unsubscribe próprio e o gate `test:integration:core` inclui uma query Prisma real. |
| PostgreSQL | Teste do profiler 1/1; gate central 5 arquivos, 14/14; suíte de métricas 8/8, inclusive 1.000 pedidos e 10 solicitações concorrentes. |

**Arquivos:** `lib/prisma.ts`, `tests/helpers/query-profiler.ts`, `tests/integration/query-profiler.test.ts`, `tests/integration/metrics-performance.test.ts`, `tests/setup/db.ts`, `package.json`.  
**Falhas observadas:** a primeira execução usou senha local incorreta; a segunda revelou fixture sem `Loja` e timeout causado por 1.000 hashes sequenciais. O banco descartável foi recriado, a fixture passou a respeitar FKs e inserir em lote, e a repetição passou.  
**Commit:** nenhum.  
**Próximo passo:** estabelecer baselines estatísticos por ambiente e tornar limites menos sensíveis a ruído antes de promover toda a suíte de carga a gate obrigatório.

## 2026-09-28 — PERF-10.8 — itens sem correção especulativa

**IDs de origem:** `PERF-006`, `PERF-009`; correlatos `FINAL-029`, `FINAL-022`, `DB-015`.  
**Classificação:** `PERF-006` `VALID` / `DEFERRED`; `PERF-009` permanece `NOT VERIFIED` (`SUSPECTED` no relatório).  
**Causa raiz:** pagamento síncrono depende de uma cadeia Asaas e qualquer timeout global pode deixar resultado financeiro incerto; candidatos a índice dependem de distribuição/plano representativos.  
**Severidade original / residual:** `HIGH` + `MEDIUM` / `HIGH` + `MEDIUM`.

**Evidência:** o checkout ainda aguarda o gateway, mas estados/idempotência/reconciliação já existentes passaram no fake e no teste da última unidade. Em 500 produtos fictícios, `EXPLAIN (ANALYZE, BUFFERS)` retornou 13 linhas em 0,085 ms usando índice; a amostra de um tenant não justifica criar/remover índice nem confirma escala.  
**Arquivos:** nenhum arquivo de produto foi alterado por esses dois itens.  
**Teste:** transações/profiler/cache, 4 arquivos e 14/14; plano local registrado; nenhum gateway real chamado.  
**Próximo passo:** `PERF-006` exige SLO, worker/outbox, persistência de customer ID e sandbox autorizada; `PERF-009` exige clone sanitizado representativo, estatísticas e comparação de custo de escrita.

## 2026-09-28 — encerramento da etapa 10 — performance e escalabilidade

**Documento:** `docs/remediation/PERFORMANCE-FIXES.md`.  
**Estado:** correções locais concluídas para `PERF-001`, `PERF-004`, `PERF-005`, `PERF-007` e `PERF-010`; `PERF-002`, `PERF-003` e `PERF-008` possuem escopo local corrigido e verificações externas pendentes; `PERF-006` está `DEFERRED`; `PERF-009` permanece `NOT VERIFIED`.  
**IDs tratados:** `PERF-001` a `PERF-010`, preservando `FINAL-017`, `FINAL-020`, `FINAL-022`, `FINAL-029`, `FINAL-030` e IDs correlatos.  
**Commit:** nenhum.

### Validação final

| Verificação | Resultado |
|---|---|
| Unitários completos | 74 arquivos, 495/495, exit 0. |
| PostgreSQL de métricas | 8/8: 1.000 clientes, 100/1.000 pedidos e 10 chamadas concorrentes. |
| Gate PostgreSQL central | 5 arquivos, 14/14; profiler real incluído. |
| Concorrência/transação | Última unidade, idempotência, profiler e cache: 4 arquivos, 14/14. |
| Carga HTTP | `NOT VERIFIED`: primeira tentativa `ECONNREFUSED`; com servidor local, 4/5 falharam 401 por fixture de cookie legado e o 5º não provou query positiva. |
| Tipos/build | Build final Next.js 16.3.5, 51 páginas geradas, exit 0; typecheck incluído. |
| Lint | Exit 0, 0 erros, 16 warnings conhecidos; imagens legadas permanecem documentadas. |
| Bundle | Home 189.618 bytes/7 chunks; checkout 165.814 bytes/7 chunks, soma bruta dos manifests locais. |
| Diff | `git diff --check`, exit 0; somente avisos LF/CRLF. |

### Limitações e risco residual

- LCP/CLS/INP e waterfall em Chrome DevTools/Lighthouse não foram medidos porque o conector de trace não estava disponível; a otimização seguiu evidência de bytes, bundle, HTML e HTTP local.
- Nenhum gateway, CDN, email, Correios, ViaCEP, cloud, conta, credencial ou banco real foi acessado.
- O pagamento síncrono continua sendo o maior risco; imagens fora da home/produto e cache entre réplicas continuam pendentes.
- O teste HTTP de carga exige atualização consciente para o cookie assinado atual; não foi afrouxada autenticação para fazê-lo passar.
- O contêiner local descartável `codex-remediation10-postgres` foi validado pelo nome/imagem/porta e removido; fixtures e schema temporários não são recuperáveis. O servidor local foi encerrado e `.env.production.local` removido.

**Próximo passo:** executar somente as verificações pendentes em ambiente autorizado; nenhuma etapa seguinte foi iniciada automaticamente.

## 2026-09-28 — OBS-11.1 — durabilidade e ambiguidade transacional

**IDs de origem:** `OBS-001`, `OBS-002`, `OBS-003`, `OBS-005`; correlatos de transações.  
**Classificação:** `ALREADY RESOLVED` no estado atual; reconciliação externa de `OBS-003` permanece `DEFERRED`.  
**Causa raiz:** o relatório registrava consumo prematuro do webhook, restauração silenciosa e interpretação definitiva de resultado financeiro ambíguo.  
**Severidade original / residual:** `CRITICAL/HIGH` / `HIGH` apenas na reconciliação externa, `LOW` nos demais.

**Evidência antes/depois:** o inbox atual persiste estado, tentativas, lease e falha; só conclui após os efeitos. Falhas de restauração/refund propagam, e o checkout usa `RECONCILIATION_REQUIRED` sem retry cego. Webhook, inventário e transações passaram em 30 testes unitários; o gate PostgreSQL central passou 14/14.  
**Arquivos/commits:** validação sobre as correções das etapas 03/04; nenhum commit.  
**Próximo passo:** testar redelivery e reconciliação em sandbox Asaas autorizada.

## 2026-09-28 — OBS-11.2 — correlação, sanitização e exposição de erros

**IDs de origem:** `OBS-004`, `OBS-008`, `OBS-012`, `OBS-013`.  
**Classificação:** `VALID` → `FIXED` no repositório; retenção/RBAC/limpeza histórica `NOT VERIFIED`.  
**Causa raiz:** não havia contexto assíncrono central, IDs externos não eram tratados separadamente, o logger não cobria todas as classes sensíveis e rotas expunham detalhes internos/payload bruto.  
**Severidade original / residual:** `HIGH/MEDIUM` / `MEDIUM`.

**Evidência antes/depois:** testes negativos provaram ausência do contexto, do header e vazamento de detalhe. Depois, um UUID interno é propagado por `AsyncLocalStorage`, `X-Request-ID` é devolvido, o logger redige PII/segredos/corpos e o inbox conserva somente envelope mínimo. Respostas 500 auditadas são genéricas.  
**Arquivos:** `lib/observability/request-context.ts`, `lib/logger.ts`, checkout, webhook e rotas auditadas de upload/frete/fidelidade/administração; testes correspondentes.  
**Teste:** suítes focadas aprovadas e unitários completos 504/504.  
**Commit:** nenhum.  
**Próximo passo:** aplicar retenção, RBAC e limpeza de registros históricos em ambiente autorizado.

## 2026-09-28 — OBS-11.3 — e-mail, crons, timeout e falha parcial

**IDs de origem:** `OBS-006`, `OBS-007`, `OBS-010`.  
**Classificação:** `VALID` → `FIXED parcial`; outbox, scheduler real e deadline ponta a ponta `DEFERRED/NOT VERIFIED`.  
**Causa raiz:** envio sem espera/timeout e jobs que mascaravam conclusão parcial.  
**Severidade original / residual:** `MEDIUM` / `MEDIUM`.

**Evidência antes/depois:** antes, cron parcial respondia 200 e o mock lento do Resend excedia o timeout do teste. Depois, o Resend aborta no limite configurado sem retry; o webhook aguarda e verifica `EmailResult`; crons geram `runId` e retornam 503 `PARTIAL/FAILED`.  
**Arquivos:** `.env.example`, `lib/email/providers/resend.provider.ts`, webhook e duas rotas cron; testes de e-mail/webhook/crons.  
**Teste:** regressões focadas e suíte completa aprovadas.  
**Commit:** nenhum.  
**Próximo passo:** outbox durável e validação de retry/heartbeat no scheduler externo.

## 2026-09-28 — OBS-11.4 — health, métricas e ciclo de vida

**IDs de origem:** `OBS-009`, `OBS-011`, `OBS-014`.  
**Classificação:** `VALID` → `FIXED parcial`; collector, alertas e shutdown do runtime são `NOT VERIFIED`.  
**Causa raiz:** faltavam probes e métricas controladas, o hook Prisma desconectava apenas uma instância de desenvolvimento e não havia configuração revisável de alertas.  
**Severidade original / residual:** `MEDIUM/LOW` / `MEDIUM`.

**Evidência antes/depois:** foram criados live, ready temporizado e endpoint Prometheus protegido com métricas/labels em allowlist; o Prisma encerra a instância usada; regras de alerta de exemplo foram adicionadas sem alegar implantação. HTTP local: live 200, ready 200, métricas sem token 401 e com token fictício 200.  
**Arquivos:** `app/api/health/**`, `app/api/internal/metrics/route.ts`, `lib/observability/metrics.ts`, `lib/prisma.ts`, `ops/observability/alerts.example.yml`, `tests/unit/observability-health-metrics.test.ts`.  
**Teste:** unitários 504/504, integração core 14/14, lint exit 0 e build de 51 páginas exit 0.  
**Commit:** nenhum.  
**Próximo passo:** validar scraping, alertas, sinais e drain no ambiente de hospedagem.

## 2026-09-28 — encerramento da etapa 11 — observabilidade e tratamento de falhas

**Documento:** `docs/remediation/OBSERVABILITY-FIXES.md`.  
**IDs tratados:** `OBS-001` a `OBS-014`.  
**Estado:** `OBS-001/002/003/005` revalidados como `ALREADY RESOLVED`; `OBS-004/008/012` corrigidos localmente; `OBS-006/007/009/010/011/013/014` corrigidos no escopo local com dependências externas explicitamente pendentes.  
**Commit:** nenhum.

### Validação final

| Verificação | Resultado |
|---|---|
| Unitários completos | 75 arquivos, 504/504, exit 0. |
| Integração PostgreSQL central | 5 arquivos, 14/14, exit 0; 24 migrações aplicadas em banco descartável. |
| Transições HTTP isoladas | 15 casos receberam 404 porque o arquivo depende de servidor externo em `localhost:3000`; não contabilizados como sucesso nem regressão funcional. |
| Lint | Exit 0, zero erros, 16 warnings conhecidos. |
| Build | Next.js 16.3.5, 51 páginas, exit 0. |
| Smoke HTTP local | live 200, ready 200, métricas 401 sem token/200 com token fictício. |

### Limitações e risco residual

- Nenhum Asaas, Resend, scheduler, collector, dashboard, alert manager, cloud ou produção foi acessado.
- Métricas são locais ao processo; e-mail não possui outbox; reconciliação financeira e políticas de retenção continuam pendentes.
- O comportamento de SIGTERM/drain depende do runtime e não foi afirmado como verificado.
- O documento não declara `READY` ou `APPROVED`; separa implementação local de verificação operacional externa.

**Próximo passo:** executar a etapa 12 já solicitada, mantendo as verificações operacionais acima como pendências explícitas.

## 2026-09-28 — INF-12.1 — migrations, drift e controles de acesso

**IDs de origem:** `INF-001`, `INF-002`, `INF-004`; correlatos `DB-001`, `DB-010`, `DB-016`, `FINAL-002`, `FINAL-003`, `FINAL-034`.  
**Classificação:** `INF-001` `ALREADY RESOLVED` e revalidado; `INF-002` `VALID` / `DEFERRED-BLOCKED`; `INF-004` `VALID` / `DEFERRED`.  
**Causa raiz:** histórico originalmente incompleto, migration antiga destrutiva e hardening RLS desconectado da topologia real de roles.  
**Severidade original / residual:** `BLOCKER/CRITICAL/HIGH` / `CRITICAL` até ensaio do upgrade real e `HIGH` para RLS externo.

**Evidência antes/depois:** as 24 migrations passaram em banco descartável, status atualizado e diff vazio; integração core 14/14. Isso confirma provisionamento vazio, não upgrade de todo snapshot populado. `ops/database/verify-access.sql` falhou inicialmente em duas consultas de catálogo, foi corrigido e executou read-only; o banco local usa superuser com `BYPASSRLS`, logo não sustenta aplicar RLS de produção.  
**Arquivos:** `ops/database/verify-access.sql`, runbooks/checklist; migrations históricas preservadas.  
**Commit:** nenhum.  
**Próximo passo:** DBA deve ensaiar snapshots reais sanitizados e exportar roles/grants/RLS antes de uma migration específica. Nenhuma migration destrutiva foi executada.

## 2026-09-28 — INF-12.2 — segredos e contrato de ambiente fail-closed

**IDs de origem:** `INF-005`, `INF-006`, `INF-009`, `INF-010`; correlatos `SEC-004`, `SEC-007`, `SEC-011`, `FINAL-016`, `FINAL-018`, `FINAL-019`, `FINAL-033`.  
**Classificação:** `INF-005/006/009` `ALREADY RESOLVED` parcial → reforçados; `INF-010` `VALID` → `FIXED` no repositório. Rotação e provedores reais `NOT VERIFIED`.  
**Causa raiz:** configuração dispersa/tardia, nomes ausentes no exemplo e material histórico com formato de credencial.  
**Severidade original / residual:** `HIGH/MEDIUM` / `HIGH` somente para rotação histórica externa, `MEDIUM` para configuração real.

**Evidência antes/depois:** quatro referências históricas foram redigidas sem registrar seus valores; scanner final passou. Contrato production incompleto falhou enumerando apenas nomes; fixture completa passou. `.env.example` cobre 31 nomes usados/tooling. Startup do container sem `APP_ENV` terminou exit 1. Simulador permanece deny-by-default e produção não aceita flags mutáveis.  
**Arquivos:** documentação histórica sob `diversos/`, `.env.example`, `lib/config/environment.cjs`, `instrumentation.ts`, scripts de startup/validação/scan, configuração de pagamento/frete e testes.  
**Teste:** regressões focadas aprovadas; unitários completos 513/513.  
**Commit:** nenhum.  
**Próximo passo:** revogar/rotacionar banco, Asaas e Resend em todos os ambientes e revisar histórico/clones/logs, sem expor valores.

## 2026-09-28 — INF-12.3 — CI, supply chain e runtime reproduzível

**IDs de origem:** `INF-003`, `INF-011`, `INF-013`; correlatos `FINAL-033`, `OBS-009`, `OBS-011`.  
**Classificação:** `VALID` → `FIXED` no repositório; CD/registry/GitHub/probes reais `REQUIRES INFRASTRUCTURE VERIFICATION`.  
**Causa raiz:** ausência de container, versão de runtime, menor privilégio e gates completos; actions usavam tags móveis.  
**Severidade original / residual:** `HIGH/MEDIUM` / `MEDIUM`.

**Evidência antes/depois:** imagem Node 22.22.1 por digest, standalone, OpenSSL, usuário `nextjs`, healthcheck e startup fail-closed. A primeira imagem expôs OpenSSL ausente; a segunda expôs que o runtime não herdava o estágio base; ambas foram corrigidas. Smoke final: container `healthy`, live/ready 200 e métricas 401/200. CI agora possui permissão read-only, SHAs, lint, audit, environment, migrations, integração, Docker e verificação non-root.  
**Arquivos:** `Dockerfile`, `.dockerignore`, `.nvmrc`, package/lock, Next config, workflow, Dependabot, ESLint e smoke.  
**Teste:** build Docker final exit 0; build local 51 páginas; lint 0 erros/16 warnings; audit production 0; YAML 3/3.  
**Commit:** nenhum.  
**Próximo passo:** publicar/assinar por digest no registry autorizado, configurar approvals/branch protection e ensaiar rollout/rollback.

## 2026-09-28 — INF-12.4 — scheduler, backup e observabilidade operacional

**IDs de origem:** `INF-007`, `INF-008`, `INF-012`; correlatos `FINAL-021`, `FINAL-033`, `OBS-006`–`OBS-014`.  
**Classificação:** `INF-007` `VALID` → `FIXED` apenas como contrato; `INF-008` permanece `NOT VERIFIED`; `INF-012` `ALREADY RESOLVED` parcial.  
**Causa raiz:** controles podiam existir fora do repositório, mas não havia contrato, runbook ou evidência verificável.  
**Severidade original / residual:** `HIGH/MEDIUM` / `HIGH` operacional.

**Evidência antes/depois:** scheduler provider-neutral descreve frequência, retry de 503, exclusão, timeout e heartbeat sem alegar implantação. Runbooks de deploy/rollback e backup/restore evitam comandos destrutivos e exigem RPO/RTO/restore drill. Checklist separa collector/alerts externos da implementação local.  
**Arquivos:** `ops/scheduler/jobs.example.yml`, `docs/operations/DEPLOYMENT-RUNBOOK.md`, `BACKUP-RESTORE-RUNBOOK.md`, `INFRASTRUCTURE-VERIFICATION-CHECKLIST.md`.  
**Teste:** YAML válido; nenhuma chamada de cron, restore, cloud ou produção.  
**Commit:** nenhum.  
**Próximo passo:** owners externos devem traduzir o contrato e anexar evidência de execução/alerta/restore.

## 2026-09-28 — INF-12.5 — trust boundary do proxy e tenant

**IDs de origem:** `INF-014`; correlatos `SEC-010`, `FINAL-033`.  
**Classificação:** relatório `SUSPECTED`; estado operacional continua `NOT VERIFIED`; hardening local `FIXED`.  
**Causa raiz:** `X-Forwarded-Host` era priorizado sem declaração versionada de proxy confiável.  
**Severidade original / residual:** `MEDIUM` / `MEDIUM`.

**Evidência antes/depois:** sem provider allowlisted o cabeçalho encaminhado é ignorado; com provider permitido aceita apenas valor único; listas e CR/LF falham fechados. Três regressões passaram junto com rate-limit/tenant.  
**Arquivos:** `lib/tenant.ts`, `.env.example`, `tests/unit/tenant-canonical-origin.test.ts`.  
**Commit:** nenhum.  
**Próximo passo:** executar matriz Host/XFH e cache por tenant no ingress real antes de definir `TRUSTED_PROXY_PROVIDER`.

## 2026-09-28 — encerramento da etapa 12 — infraestrutura, configuração e deploy

**Documento:** `docs/remediation/INFRASTRUCTURE-FIXES.md`.  
**IDs tratados:** `INF-001` a `INF-014`, preservando confiança e IDs correlatos.  
**Estado:** correções testáveis implementadas; `INF-002`/`INF-004` continuam bloqueados/deferred por estado externo, `INF-008` permanece `NOT VERIFIED`, e parcelas operacionais dos demais exigem verificação de infraestrutura.  
**Commit:** nenhum.

### Validação final

| Verificação | Resultado |
|---|---|
| Unitários completos | 76 arquivos, 513/513, exit 0. |
| PostgreSQL central | 24 migrations, status atual, diff vazio; 5 arquivos, 14/14. |
| Contrato/segredos | Negativo rejeitado; fixture production+migration aceita; scan final exit 0; anti-drift cobre 29 nomes. |
| Tipos/lint/audit | Typecheck exit 0; lint 0 erros/16 warnings; audit production 0. |
| YAML/build | 3 YAML válidos; build Next 16.3.5 com 51 páginas. |
| Docker | Build final exit 0; startup ausente exit 1; runtime `nextjs`; health/smoke aprovado. |

### Limitações e risco residual

- Nenhum serviço real, produção, cloud, DNS, gateway, e-mail, storage, segredo, backup ou restore foi acessado.
- A cadeia vazia não resolve o risco de migration histórica sobre base populada; RLS não foi aplicado sem conhecer roles reais.
- Scheduler, registry/CD, GitHub policy, backup/PITR, ingress, collector e alertas continuam sem prova externa.
- Duas vulnerabilidades moderadas aparecem na instalação total/dev da imagem; dependências de produção retornaram zero. Nenhum `audit fix` automático foi aplicado.
- Por orientação da skill de prevenção de perda, os contêineres/imagem locais foram parados, mas não removidos; remover esses artefatos descartáveis exige autorização explícita.

**Próximo passo:** executar somente o checklist externo em ambientes autorizados. A etapa 13 não foi iniciada automaticamente.

## 2026-09-28 — TST-13.1 — guard e isolamento do banco de teste

**IDs de origem:** `TST-005`; correlato `FINAL-013`.  
**Classificação/estado:** `VALID` → `FIXED`.  
**Causa raiz:** o guard validava uma URL permissiva/fallback enquanto o Prisma podia usar outra; o cleanup não tinha namespace.  
**Severidade original / residual:** `CRITICAL` / `LOW`.

**Evidência antes/depois:** antes havia substring `test`, fallback e deleções globais. Depois, URLs devem ser idênticas, locais e apontar exatamente para `ecommerce_test/public`; seis negativos falham antes de conexão. Em PostgreSQL real local, a fixture registrada foi removida e uma sentinel de outro run sobreviveu.  
**Arquivos:** `tests/setup/db.ts`, `tests/unit/test-database-safety.test.ts`, `tests/integration/test-db-isolation.test.ts`, `package.json`.  
**Teste:** guard focado 7/7; integração core 15/15.  
**Commit:** nenhum.  
**Próximo passo:** manter usuário/banco descartável de privilégio mínimo no CI.

## 2026-09-28 — TST-13.2 — integração transacional e gate

**IDs de origem:** `TST-001`, `TST-002`, `TST-003`, `TST-006`, `TST-008`; correlato `FINAL-020`.  
**Classificação/estado:** `TST-001/003/006` `ALREADY RESOLVED`; `TST-002/008` `VALID` com parcela `DEFERRED`.  
**Causa raiz:** o relatório original antecede o CI PostgreSQL e as integrações reais; a suíte HTTP legada, porém, ainda depende de servidor/payloads externos ao runner.  
**Severidade original / residual:** `HIGH/MEDIUM` / `HIGH` apenas para a cobertura HTTP/browser restante.

**Evidência antes/depois:** CI atual provisiona banco/migrations e executa o núcleo. Quinze casos reais cobrem última unidade, rollback, idempotência, pontos, admin, produto e profiler. A suíte HTTP legada não foi promovida nem contabilizada.  
**Arquivos:** validação sobre workflow e testes existentes; `package.json` passou a incluir a sentinel.  
**Teste:** 24 migrations; 6 arquivos/15 casos de integração, exit 0. Dois ensaios anteriores falharam por configuração local antes de casos e estão documentados.  
**Commit:** nenhum.  
**Próximo passo:** harness HTTP autocontido e matriz A/B completa.

## 2026-09-28 — TST-13.3 — flakiness e matriz comportamental

**IDs de origem:** `TST-007`, `TST-009`, `TST-010`; correlato `FINAL-020`.  
**Classificação/estado:** `TST-009` `VALID` → `FIXED` no escopo reproduzido; `TST-007/010` `VALID` / `DEFERRED`.  
**Causa raiz:** espera temporal e globals não restaurados geravam risco de ordem; testes auto-referentes, coverage e strictness exigem migração consciente separada.  
**Severidade original / residual:** `MEDIUM` / `LOW` para flake corrigido, `MEDIUM` nas pendências.

**Evidência antes/depois:** sleep de 50 ms virou espera por condição e `fetch` stubado é restaurado. O conjunto crítico de 58 testes passou três vezes, em 975/897/920 ms Vitest. Não foi inventado threshold de coverage nem removido teste sem substituto.  
**Arquivos:** `tests/unit/asaas-webhook.test.ts`, `tests/unit/asaas-customer.test.ts`.  
**Teste:** unitários completos 77 arquivos/521 casos; três repetições críticas sem falha.  
**Commit:** nenhum.  
**Próximo passo:** coverage por risco e strictness incremental em lote próprio.

## 2026-09-28 — encerramento da etapa 13 — testes e cobertura

**Documento:** `docs/remediation/TESTING-FIXES.md`.  
**IDs tratados:** `TST-001` a `TST-010`.  
**Estado:** risco crítico do cleanup corrigido; integração PostgreSQL/gate/profiler revalidados; E2E, HTTP legado, testes auto-referentes, coverage e strictness permanecem explicitamente pendentes.  
**Comandos:** unitários 521/521; PostgreSQL 15/15; matriz crítica 58/58 em três execuções; typecheck exit 0.  
**Limitações:** nenhum serviço real, browser E2E, carga HTTP, produção ou banco compartilhado. Container local parado e retido, sem remoção destrutiva.  
**Commit:** nenhum.

## 2026-09-28 — CQ-14.1 — falhas comerciais e contrato de pedidos

**IDs de origem:** `CQ-001`, `CQ-002`, `CQ-003`; correlatos `FINAL-009`, `FINAL-020`, `FINAL-026`.  
**Classificação/estado:** `CQ-001` `ALREADY RESOLVED`; `CQ-002/003` `VALID` → `FIXED`.  
**Causa raiz:** erro de estoque antes era suprimido; consulta de histórico ainda confundia falha com vazio; serviços, aliases e DTOs paralelos sustentavam drift.  
**Severidade original / residual:** `HIGH/MEDIUM` / `LOW`.

**Evidência antes/depois:** rollback de estoque já estava comprovado em PostgreSQL. O histórico agora propaga `ORDER_HISTORY_UNAVAILABLE` e o perfil tem retry; vazio só vem de sucesso. Consumidores/mocks foram migrados, seis shims sem consumidores removidos e o DTO homônimo eliminado.  
**Arquivos:** `services/order.service.ts`, `app/profile/error.tsx`, rotas/mocks migrados, `types/order.types.ts`; remoções sob `lib/services/` e `lib/auth-admin.ts`.  
**Teste:** foco final 59/59 de contratos/imports e 10/10 de histórico/arquitetura; unitários completos 525/525.  
**Commit:** nenhum.  
**Próximo passo:** manter imports canônicos no review/CI e validar o boundary visualmente em E2E.

## 2026-09-28 — CQ-14.2 — ciclos e autorização duplicada

**IDs de origem:** `CQ-009`, `CQ-010`.  
**Classificação/estado:** `VALID` → `FIXED`.  
**Causa raiz:** drawer dependia do provider que o carregava; dois handlers copiavam um controle de segurança sensível.  
**Severidade original / residual:** `LOW/MEDIUM` / `LOW`.

**Evidência antes/depois:** contexto/hook do carrinho foi isolado sem perder lazy loading; teste proíbe import reverso. `lib/cron-auth.ts` centraliza parsing e comparação timing-safe sem registrar token; ambos endpoints mantêm a matriz de autenticação.  
**Arquivos:** contexto/provider/drawer/botão/home; helper e duas rotas cron; teste arquitetural.  
**Teste:** arquitetura/crons 31/31; typecheck e build de 51 páginas. Duas falhas intermediárias da extração (`server-only` ausente e `NextResponse`) foram corrigidas antes do resultado final.  
**Commit:** nenhum.  
**Próximo passo:** teste browser do drawer e inventário automático de novos handlers cron.

## 2026-09-28 — CQ-14.3 — gates, toolchain e dependências

**IDs de origem:** `CQ-004`, `CQ-005`, `CQ-006`, `CQ-011`.  
**Classificação/estado:** `CQ-005/006/011` `ALREADY RESOLVED`, com reforço de budget; `CQ-004` `VALID` / `DEFERRED`.  
**Causa raiz:** a auditoria antecedia CI/toolchain atuais; strictness e casts ainda exigem migração incremental.  
**Severidade original / residual:** `MEDIUM/LOW` / `MEDIUM`.

**Evidência antes/depois:** CI já tem lint, audit de produção, Dependabot e runtime pinado. Lint agora falha acima de 16 warnings; passou com 0/16. Árvore instalada offline passou. Audit offline retornou zero, mas não revoga a evidência anterior de duas moderadas dev; nenhuma consulta online/atualização foi autorizada ou executada.  
**Arquivos:** `package.json`; demais controles revalidados.  
**Teste:** typecheck exit 0, lint exit 0, unitários 525/525, build exit 0.  
**Commit:** nenhum.  
**Próximo passo:** triagem autorizada das moderadas dev e strictness por fronteira.

## 2026-09-28 — CQ-14.4 — complexidade e módulos sem consumidor

**IDs de origem:** `CQ-007`, `CQ-008`.  
**Classificação/estado:** `CQ-007` `VALID` / `DEFERRED`; `CQ-008` `NOT VERIFIED` / `DEFERRED`.  
**Causa raiz:** módulos críticos ainda concentram responsabilidades; cinco arquivos parecem mortos, mas intenção de roadmap não foi verificada.  
**Severidade original / residual:** `MEDIUM/LOW` / `MEDIUM/LOW`.

**Evidência:** não houve refatoração ampla nem remoção baseada só em contagem textual. Apenas aliases comprovadamente substituídos e sem consumidores foram removidos.  
**Arquivos/commit:** nenhum adicional; nenhum commit.  
**Teste:** build confirma o grafo atual, mas não prova intenção futura.  
**Próximo passo:** owner decide módulos; decomposição vertical somente após E2E/characterization.

## 2026-09-28 — encerramento da etapa 14 — dependências e qualidade

**Documento:** `docs/remediation/CODE-QUALITY-FIXES.md`.  
**IDs tratados:** `CQ-001` a `CQ-011`.  
**Estado:** exceção mascarada, aliases/DTO duplicados, ciclo de carrinho e duplicação de auth cron corrigidos; gates/toolchain revalidados; strictness, complexidade e dead code incerto permanecem explícitos.  
**Validação:** 77 arquivos/525 unitários; typecheck; lint 0 erros/16 warnings dentro do budget; build 51 páginas; árvore npm offline coerente.  
**Limitações:** sem audit online, sem atualização de dependência e sem alegar ausência de advisory; duas moderadas dev previamente observadas continuam pendentes.  
**Commit:** nenhum.

## 2026-09-28 — FINAL-15.1 — inventário e revalidação das causas raiz

**IDs de origem:** todos os 198 IDs de `ARCH-001` a `WEB-013`, agrupados em `FINAL-001` a `FINAL-036` conforme `PLAN.md`.  
**Classificação/estado:** 2 grupos `FIXED VERIFIED`, 25 `PARTIALLY FIXED`, 6 `BLOCKED`, 2 `DEFERRED` e 1 `NOT VERIFIED`; nenhum grupo foi elevado por inferência.  
**Causa raiz:** a consolidação histórica precisava ser confrontada com o código pós-etapas e com handoffs incompletos.  
**Severidade original / residual:** `BLOCKER/CRITICAL/HIGH/MEDIUM/LOW` / risco agregado `HIGH`, com risco de migration `CRITICAL` até ensaio autorizado.

**Evidência antes/depois:** os 15 relatórios de auditoria existem e o mapa final contém 36 grupos, 198 referências e 198 IDs únicos. Existem somente 13 relatórios `*-FIXES.md`: `FRONTEND-FIXES.md` e o bloco de progresso da etapa 08 estão ausentes. `FUX-*` foi revalidado pelo relatório original, código, correções correlatas e testes; itens ainda reproduzíveis não foram marcados como corrigidos.  
**Arquivos:** `docs/remediation/FINAL-VALIDATION.md`.  
**Teste/comandos:** parser local confirmou `GROUPS=36`, `UNIQUE_GROUPS=36`, `IDS=198`, `UNIQUE_IDS=198`, sem duplicatas; amostra crítica de segurança/contas/transações passou 10 arquivos/90 testes.  
**Commit:** nenhum.  
**Próximo passo:** executar os critérios da tabela de bloqueios em ambientes autorizados antes de nova decisão de publicação.

## 2026-09-28 — FINAL-15.2 — compatibilidade entre fixture segura e scanner

**IDs de origem:** `TST-005`, `INF-005`; correlatos `FINAL-013`, `FINAL-019`, `FINAL-020`.  
**Classificação/estado:** falha nova do gate `VALID` → `FIXED`; não era exposição de segredo real.  
**Causa raiz:** três URLs fictícias do teste do guard usavam credenciais literais genéricas sem o marcador explícito reconhecido pelo scanner.  
**Severidade original / residual:** operacional `MEDIUM` / `LOW`.

**Evidência antes/depois:** a primeira execução de `security:secrets` falhou e informou somente arquivo/linha, sem valor. As fixtures passaram a usar `test_user:test_password`; o comportamento do guard permaneceu igual.  
**Arquivos:** `tests/unit/test-database-safety.test.ts`.  
**Teste:** guard 7/7; scanner final exit 0 sem padrões não permitidos.  
**Commit:** nenhum.  
**Próximo passo:** manter fixtures com marcadores explícitos e nunca relaxar o scanner para caminhos inteiros.

## 2026-09-28 — FINAL-15.3 — UUID de correlação preservado pelo logger

**IDs de origem:** `OBS-004`, `OBS-008`, `SEC-018`; correlato `FINAL-027`.  
**Classificação/estado:** nova falha reproduzida `VALID` → `FIXED`; grupo consolidado permanece `PARTIALLY FIXED` por infraestrutura externa.  
**Causa raiz:** a regex de telefone não exigia fronteira inicial/final suficiente e podia casar uma subsequência numérica de UUID aleatório.  
**Severidade original / residual:** `HIGH/MEDIUM` / `LOW` local, `MEDIUM` externo.

**Evidência antes/depois:** a primeira suíte completa teve 524/525 e mostrou `requestId` com `[PHONE_REDACTED]`. A regex agora exige vizinhos não hexadecimais; regressão determinística preserva o UUID que falhou e continua redigindo `(11) 99876-5432`.  
**Arquivos:** `lib/logger.ts`, `tests/unit/logger.test.ts`.  
**Teste:** logger 8/8; suíte completa final 77 arquivos/526 casos.  
**Commit:** nenhum.  
**Próximo passo:** confirmar correlação ponta a ponta no collector autorizado, com retenção/RBAC/expurgo.

## 2026-09-28 — encerramento da etapa 15 — validação final

**Documento:** `docs/remediation/FINAL-VALIDATION.md`.  
**IDs tratados:** inventário completo dos 198 IDs originais e 36 causas raiz.  
**Estado de publicação:** `BLOCKED — NÃO PUBLICAR`.  
**Validação final:** secrets e contrato de ambiente verdes; typecheck exit 0; lint 0 erros/16 warnings; amostra crítica 90/90; unitários 526/526; build Next 16.3.5 com 51 páginas; 24 migrations sem pendência/drift; integração PostgreSQL 15/15.  
**Falhas honestamente registradas:** scanner inicial nas fixtures, UUID do logger, duas premissas incorretas do harness PostgreSQL e duas tentativas de smoke bloqueadas pela política antes de iniciar processo. Smoke e browser E2E não foram simulados como sucesso.  
**Bloqueios:** upgrade populado da migration histórica, reconciliador/refund, E2E/browser, scheduler/outbox, backup/restore/telemetria externa e grants/RLS/storage.  
**Limitações:** nenhum serviço real, produção, cloud, conta, credencial, pagamento, rotação, migration externa ou ação destrutiva; contêiner local parado e preservado.  
**Commit:** nenhum.

## 2026-09-28 — FUX-08.1 — retorno pós-login seguro

**IDs de origem:** `FUX-014`; correlato `FINAL-036`.  
**Classificação/estado:** `VALID` → `FIXED`.  
**Causa raiz:** a página de login descartava o parâmetro `next` emitido por rotas protegidas.  
**Severidade original / residual:** `LOW` / `LOW`.

**Evidência antes/depois:** login sempre executava `router.push("/")`; agora a página servidor valida um destino relativo, rejeita origem externa, URL protocol-relative, barra invertida, caracteres de controle e loop para `/login`, e o formulário usa `router.replace` no destino aprovado. O resumo de erro também é anunciado e associado aos campos.  
**Arquivos:** `lib/safe-next-path.ts`, `app/login/page.tsx`, `components/forms/LoginForm.tsx`, `tests/unit/frontend-login-navigation.test.ts`.  
**Teste/comando:** `npx.cmd vitest run tests/unit/frontend-login-navigation.test.ts` — 1 arquivo, 8/8 casos.  
**Commit:** nenhum.  
**Próximo passo:** validar foco e histórico de navegação em browser local; restauração automática da ação de adicionar ao carrinho não faz parte deste redirect e permanece explicitamente fora do resultado.

## 2026-09-28 — FUX-08.2 — estado canônico e feedback do carrinho

**IDs de origem:** `FUX-003`, `FUX-010`, `FUX-013`; correlatos `FINAL-015`, `FINAL-029`, `FINAL-036`.  
**Classificação/estado:** `FUX-010` e `FUX-013` `VALID` → `FIXED`; `FUX-003` `VALID` → `DEFERRED` no fechamento servidor, com hidratação e erro corrigidos.  
**Causa raiz:** checkout lia somente o snapshot volátil do Zustand; falhas HTTP eram engolidas e o drawer misturava inglês com dólar.  
**Severidade original / residual:** `HIGH/MEDIUM/LOW` / `HIGH` para conclusão atômica do carrinho; `LOW` para estado/feedback local.

**Evidência antes/depois:** a store agora distingue `idle/loading/success/empty/error/unauthorized`, valida a resposta, reverte mutações otimistas com mensagem e expõe falha de adição. O checkout hidrata antes de decidir “vazio”, oferece retry e diferencia login. Drawer/item apresentam erros, controles nomeados, português e BRL; adição falha gera toast ou redirect autenticado. A confirmação ainda limpa apenas o snapshot local: marcar o carrinho persistido sem vínculo transacional comprovado entre cart e order poderia abandonar itens em pagamento ambíguo, então essa parte não foi improvisada.  
**Arquivos:** `store/cart.store.ts`, `components/home/HomeClient.tsx`, `components/cart/CartDrawer.tsx`, `components/cart/CartItem.tsx`, `components/cart/CartSummary.tsx`, `components/checkout/CheckoutPageClient.tsx`, `tests/unit/frontend-cart-state.test.ts`.  
**Teste/comandos:** `npx.cmd tsc --noEmit` — exit 0; carrinho/login/contratos web — 3 arquivos, 20/20; store do carrinho — 1 arquivo, 4/4.  
**Commit:** nenhum.  
**Próximo passo:** vincular cart/order e concluir o carrinho na mesma unidade transacional ou por compensação idempotente; depois provar reload e pós-pedido em E2E browser.

## 2026-09-28 — FUX-08.3 — fidelidade sem falso saldo zero

**IDs de origem:** `FUX-008`; correlato `FINAL-029`.  
**Classificação/estado:** `VALID` → `FIXED` no frontend local.  
**Causa raiz:** componentes aceitavam qualquer resposta e caíam em `null ?? 0`, tornando indisponibilidade indistinguível de saldo/extrato legitimamente vazio.  
**Severidade original / residual:** `HIGH` / `LOW` local; `MEDIUM` até integração browser e reconciliação externa.

**Evidência antes/depois:** HTTP não-2xx, JSON inválido e envelope incompleto agora falham antes da renderização. Extrato e widget exibem indisponibilidade com retry; somente um envelope válido pode mostrar zero. Falha da simulação remove o resultado e aplica explicitamente zero ponto/desconto, sem mascarar o erro. Controles de refresh, paginação, toggle e range receberam nomes acessíveis.  
**Arquivos:** `lib/loyalty-client.ts`, `components/profile/LoyaltyHistoryView.tsx`, `components/checkout/LoyaltyPointsWidget.tsx`, `components/checkout/CheckoutForm.tsx`, `tests/unit/frontend-loyalty-state.test.ts`.  
**Teste/comandos:** fidelidade frontend/rotas/integração — 3 arquivos, 19/19; `npx.cmd tsc --noEmit` — exit 0; ESLint direcionado — 0 erros, 1 warning legado de imagem no checkout.  
**Commit:** nenhum.  
**Próximo passo:** executar fixtures 200/401/500/offline no browser e validar anúncio com leitor de tela; consistência temporal segue dependente da reconciliação de pontos.

## 2026-09-28 — FUX-08.4 — histórico de pedidos paginado

**IDs de origem:** `FUX-009`; correlato `FINAL-022`.  
**Classificação/estado:** `VALID` → `FIXED`.  
**Causa raiz:** a consulta tinha `take: 10` fixo, a UI não recebia o total e o contador tratava o subconjunto como coleção completa.  
**Severidade original / residual:** `MEDIUM` / `LOW`.

**Evidência antes/depois:** o perfil valida `ordersPage`, consulta itens e total sob os mesmos filtros de usuário/tenant e entrega `{items,total,page,pageSize,totalPages}`. O contador usa o total real e links server-side anterior/próxima mantêm a aba de pedidos pela URL e âncora. Fixture de 11 pedidos prova `skip: 10` e acesso à segunda página.  
**Arquivos:** `lib/order-history-pagination.ts`, `services/order.service.ts`, `app/profile/page.tsx`, `app/profile/components/ProfileLayout.tsx`, `app/profile/components/OrderHistoryList.tsx`, `tests/unit/order-history-query.test.ts`.  
**Teste/comandos:** `npx.cmd vitest run tests/unit/order-history-query.test.ts` — 1 arquivo, 10/10; `npx.cmd tsc --noEmit` — exit 0; ESLint direcionado — 0 erros, 1 warning legado de imagem.  
**Commit:** nenhum.  
**Próximo passo:** em volume alto, migrar de offset para cursor estável e validar navegação com inserções concorrentes em ambiente representativo.

## 2026-09-28 — FUX-08.5 — semântica e feedback dos formulários de conta

**IDs de origem:** `FUX-012`; correlatos `FINAL-031`, `WEB-009`, `WEB-011`.  
**Classificação/estado:** `VALID` → `FIXED` no contrato local.  
**Causa raiz:** links continham botões aninhados, mensagens assíncronas não eram anunciadas, erros de cadastro não eram associados aos campos e reset/cadastro divergiam da política servidor de oito caracteres.  
**Severidade original / residual:** `MEDIUM` / `LOW`, pendente validação humana com tecnologia assistiva.

**Evidência antes/depois:** links de sucesso agora são um único controle; erros têm live semantics e `aria-describedby`; cadastro foca o primeiro campo inválido e oferece autocomplete; toggle de senha é nomeado e alcançável; cadastro/reset exigem oito caracteres como o backend.  
**Arquivos:** `components/forms/LoginForm.tsx`, `components/forms/RegisterForm.tsx`, `components/forms/ForgotPasswordForm.tsx`, `components/forms/ResetPasswordForm.tsx`, `tests/unit/frontend-auth-accessibility.test.ts`.  
**Teste/comandos:** auth/acessibilidade/recovery/enumeration — 3 arquivos, 18/18; contrato específico — 3/3; `npx.cmd tsc --noEmit` — exit 0; ESLint direcionado — exit 0.  
**Commit:** nenhum.  
**Próximo passo:** testar teclado, anúncio e foco em NVDA/VoiceOver; o teste estático evita regressões estruturais, mas não substitui árvore de acessibilidade real.

## 2026-09-28 — FUX-08.6 — confirmação de entrega com foco modal

**IDs de origem:** `FUX-004`; correlatos `FINAL-023`, `WEB-005`, `WEB-006`, `WEB-007`.  
**Classificação/estado:** `VALID` no modal remanescente → `FIXED` no código; demais superfícies `ALREADY RESOLVED` pelas etapas anteriores.  
**Causa raiz:** a confirmação de entrega ainda era um overlay visual próprio sem semântica modal, contenção/retorno de foco ou Escape.  
**Severidade original / residual:** `HIGH` / `LOW` local, pendente prova manual.

**Evidência antes/depois:** o overlay foi substituído pelo Dialog Radix já adotado no projeto, com título/descrição programáticos, foco gerenciado, Escape e retorno ao acionador. Erro da ação usa `role=alert`; o rótulo de fechar foi localizado. Cards, frete e campos do checkout já tinham controles nativos/labels conforme regressão WEB09.  
**Arquivos:** `app/profile/components/OrderHistoryList.tsx`, `components/ui/dialog.tsx`, `tests/unit/web-accessibility-contracts.test.ts`.  
**Teste/comandos:** contratos web + auth — 2 arquivos, 8/8; `npx.cmd tsc --noEmit` — exit 0; ESLint direcionado — 0 erros, 1 warning legado de imagem.  
**Commit:** nenhum.  
**Próximo passo:** provar sequência de Tab, Escape e retorno de foco em browser e leitor de tela reais.

## 2026-09-28 — FUX-08.7 — contrato de checkout e falha explícita de frete

**IDs de origem:** `FUX-001`, `FUX-002`; correlatos `FINAL-001`, `FINAL-004`.  
**Classificação/estado:** `FUX-001` `ALREADY RESOLVED`; `FUX-002` `VALID` no feedback remanescente → `FIXED`.  
**Causa raiz:** etapas anteriores já alinharam rota/payload/envelope e quote token, mas a exceção do cálculo de frete ainda era enviada apenas ao console.  
**Severidade original / residual:** `BLOCKER/HIGH` / `MEDIUM` até E2E e provedores autorizados.

**Evidência antes/depois:** checkout usa `/api/checkout`, contrato compartilhado, chave de idempotência e `result.data`; frete envia itens canônicos e somente o quote token segue ao checkout. Erro, lista vazia ou rede indisponível agora removem seleção antiga, mostram mensagem/retry e a validação impede avanço sem modalidade. Falha do preenchimento auxiliar de CEP não impede consultar o backend de frete.  
**Arquivos:** `components/checkout/CheckoutForm.tsx`, `tests/unit/frontend-checkout-contract.test.ts`; contrato existente em `lib/checkout-contract.ts`.  
**Teste/comandos:** contratos/checkout/confirmação — 3 arquivos, 15/15; `npx.cmd tsc --noEmit` — exit 0; ESLint direcionado — 0 erros, 1 warning legado de imagem.  
**Commit:** nenhum.  
**Próximo passo:** E2E local PIX/cartão/boleto e fixtures de frete 200/vazio/400/timeout; gateway e provedor reais permanecem fora desta etapa.

## 2026-09-28 — FUX-08.8 — browser público e gates finais

**IDs de origem:** `FUX-004`, `FUX-005`, `FUX-011`, `FUX-012`, `FUX-015`; correlatos `FINAL-020`, `FINAL-023`, `FINAL-024`, `FINAL-030`, `FINAL-031`.  
**Classificação/estado:** contratos locais `FIXED`/`ALREADY RESOLVED`; validação assistiva e E2E autenticado `NOT VERIFIED`; `FUX-015` `DEFERRED`.  
**Causa raiz:** faltava evidência dinâmica disponível nesta etapa e a suíte não tinha cobertura browser/componentes.  
**Severidade original / residual:** `HIGH/MEDIUM/INFORMATIONAL` / `MEDIUM`.

**Evidência antes/depois:** Chrome/CDP local emulou 375×900, 768×1024 e 1440×1000 com reduced motion. Login ficou sem overflow (scrollWidth igual ao viewport), card 343/448/448 px, campos e ações com nomes na árvore acessível e foco no e-mail. Screenshots estão em `docs/remediation/evidence/frontend08/`. Não houve conta para fluxo protegido nem leitor de tela físico.  
**Arquivos:** evidências visuais, regressões unitárias/estáticas e `docs/remediation/FRONTEND-FIXES.md`.  
**Teste/comandos:** rotas públicas 200; primeira suíte completa 555/556 por expectativa estática antiga; após preservar o gate de configuração e permitir a hidratação do carrinho, 82 arquivos/557 casos; lint 0 erros/14 warnings; build 51 páginas; typecheck exit 0.  
**Commit:** nenhum.  
**Próximo passo:** Playwright/axe com fixtures e banco descartável; teclado/leitor de tela/contraste/zoom em dispositivos autorizados.

## 2026-09-28 — encerramento da etapa 08 — frontend, UI, UX e integração

**Documento:** `docs/remediation/FRONTEND-FIXES.md`.  
**IDs tratados:** `FUX-001` a `FUX-015`, com duplicatas finais preservadas.  
**Estado:** checkout/frete, feedback de carrinho, fidelidade, paginação, auth e modal receberam correções e regressões; achados já resolvidos foram somente revalidados. `FUX-003` permanece `DEFERRED` no fechamento persistido e `FUX-015` permanece `DEFERRED` para suíte browser/E2E.  
**Validação:** 82 arquivos/557 unitários; typecheck; lint 0 erros/14 warnings; build Next 16.3.5 com 51 páginas; HTTP e Chrome/CDP local em três viewports.  
**Limitações:** nenhum usuário/objeto real, gateway, frete, e-mail, serviço remoto, produção ou cloud; fluxo autenticado e tecnologia assistiva não foram declarados aprovados.  
**Risco residual:** `HIGH` até fechamento transacional do carrinho e E2E de checkout/pagamento.  
**Commit:** nenhum.

## 2026-09-28 — etapa 08, adendo 08.9 — fechamento persistido do carrinho e handoff

**IDs de origem:** `FUX-003`, `FUX-008`, `FUX-009`, `FUX-010`, `FUX-012`, `FUX-013`, `FUX-014`; correlatos `FINAL-015`, `FINAL-022`, `FINAL-029`, `FINAL-031`, `FINAL-036`.  
**Estado encontrado:** o handoff `docs/remediation/FRONTEND-FIXES.md` e a etapa 08 já existiam; essa parte da premissa estava desatualizada. `FUX-003`, contudo, ainda se reproduzia e estava corretamente marcado `DEFERRED`.  
**Classificação final desta execução:** `FUX-003` `VALID` → `FIXED VERIFIED` local; `FUX-008/009/010/012/013/014` `ALREADY RESOLVED` após revalidação.  
**Publicação:** nenhuma alteração em `Publication Status`; a decisão global continua pertencendo à revalidação final.

**Antes:** `Order` não possuía vínculo com `Cart`, o checkout não enviava a identidade do carrinho e a confirmação executava apenas `clearCart()` no Zustand. Uma regressão comportamental criada antes da correção falhou em 6 de 10 casos. Reload, retry e outra aba não tinham protocolo servidor capaz de impedir ressurreição ou exclusão do carrinho errado.

**Depois:** a migration `20260928211500_checkout_cart_completion` acrescenta `Order.sourceCartID` único. Checkout autenticado exige `cartId`, deriva usuário/tenant da sessão, valida owner+tenant e o snapshot exato, e associa o pedido ao carrinho de origem. `completeCheckoutCart` usa lock do usuário, marca somente esse carrinho como `COMPLETED`, é idempotente em retry e carrega sobras/adicionamentos concorrentes para um novo carrinho `ACTIVE`. O cliente aguarda a reconciliação canônica e emite evento de storage para outras abas; a página de confirmação deixou de apagar estado local indiscriminadamente.

**Provas:** baseline focado 43/43; red test 6 falhas/4 passes; focado final 62/62; PostgreSQL descartável 2/2; suíte unitária final 83 arquivos/562 casos; typecheck exit 0; lint 0 erros/15 warnings; build Next 16.3.5/51 páginas. O primeiro unit completo teve 560/562 por mocks antigos sem `$queryRaw`; o serviço foi restringido corretamente a executar conclusão somente quando existe `cartId`, e a suíte final passou. A primeira consulta de migration status no banco descartável revelou honestamente a nova migration pendente; `migrate deploy` a aplicou e o status final confirmou 25/25.

**Browser:** como o MCP de Chrome não estava disponível, foi usado Chrome headless local por CDP, conforme a skill `chrome-devtools`, com usuário, tenant, produto, PostgreSQL e gateway HTTP totalmente descartáveis. O fluxo final comprovou `next=/profile`, carrinho com 1 item/`R$ 50,00`, checkout PIX, confirmação, reload na confirmação, `GET /api/cart` 200 com 0 itens e retorno ao perfil. Evidências: `docs/remediation/evidence/frontend08/profile-authenticated.png`, `cart-authenticated-before-checkout.png` e `checkout-confirmation-persisted-cart.png`. Tentativas anteriores do harness não foram reportadas como sucesso.

**Arquivos principais:** `prisma/schema.prisma`, migration nova, `lib/checkout-contract.ts`, validator/rota de checkout, `services/checkout.service.ts`, `services/cart.service.ts`, store/provider do carrinho, componentes de checkout/confirmação, regressões unitárias/integração e `docs/remediation/FRONTEND-FIXES.md`.  
**Residual:** gateway/produção não acessados; duas abas reais, rede offline no browser, paginação browser >10 e leitores de tela permanecem `NOT VERIFIED`. Node local foi 24.16.0, fora da engine `>=22 <23`; CI Node 22 continua necessário. Fixture e processos locais foram removidos; contêiner PostgreSQL descartável foi parado e preservado.  
**Commit:** nenhum.

## 2026-09-29 — etapa 16.1 — reconciliador durável de pagamentos ambíguos

**IDs de origem:** `FINAL-008`, `ARCH-007`, `BE-007`, `CTR-004`, `CTR-007`, `CTR-011`, `CTR-012`, `SEC-012`, `OBS-003`, `OBS-010`.  
**Documento:** `docs/remediation/PAYMENT-RECONCILIATION-FIXES.md`.  
**Estado encontrado:** a contenção `RECONCILIATION_REQUIRED`, fingerprint e bloqueio de recobrança já existiam, mas o achado central ainda se reproduzia: sem fila/worker e sem lookup por referência, uma resposta perdida sem `asaasPaymentId` ficava retida indefinidamente.  
**Classificação final desta execução:** implementação local/fake `FIXED VERIFIED`; `FINAL-008` global continua `PARTIALLY FIXED` porque PostgreSQL, sandbox Asaas e scheduler externo estão `NOT VERIFIED`. `CTR-011` permaneceu `ALREADY RESOLVED`; `CTR-007`/`OBS-010` receberam reforço sem presumir semântica externa.  
**Publicação:** `Publication Status` não foi alterado.

**Antes/depois:** a primeira regressão falhou porque `services/payment-reconciliation.service.ts` não existia. A transaction inicial do checkout agora persiste uma referência única e a fila antes do POST. O worker usa claim/lease recuperável, tentativas limitadas, backoff, estados `RESOLVED/MANUAL_REVIEW/DEAD_LETTER` e somente GET por referência; nunca recria cobrança em timeout/ausência. Webhook e worker convergem por CAS, inclusive em corrida, e falha após efeitos locais é retomável sem repetir estoque/pontos. Métricas persistentes mostram backlog, idade e SLA sem IDs/PII; trigger v1 e contratos de scheduler/alerta foram adicionados.

**Provas executadas:** baseline anterior 54/54; red test por módulo ausente; foco final 10 arquivos/81 casos; unitários completos 86 arquivos/588 casos; typecheck exit 0; Prisma schema válido/formatado; lint exit 0 com 15 warnings preexistentes; build Next 16.3.5/51 páginas; scanner de segredos e contrato de ambiente verdes.  
**Provas não executadas:** integração PostgreSQL parou corretamente no guard `[TEST_DATABASE_BLOCKED]` por ausência de `DATABASE_URL`/`TEST_DATABASE_URL` (5 casos não rodados); sandbox Asaas não foi chamada porque `ASAAS_API_KEY`/`ASAAS_API_URL` não estavam configuradas; scheduler/collector/alertas não foram instalados. Nada disso foi classificado como aprovado.  
**Arquivos principais:** schema/migration de reconciliação, porta e adapter Asaas, checkout, novo worker, webhook, cron v1, métricas/alertas/scheduler, regressões unitárias e suíte PostgreSQL escopada.  
**Residual:** risco `HIGH` até migration + concorrência PostgreSQL, sandbox sem duplicidade, agenda/alertas externos e runbook de revisão manual/dead-letter. Refund iniciado pela aplicação/parcial permanece fora deste escopo em `FINAL-009`.  
**Commit:** nenhum.

## 2026-09-29 — execução autorizada após revalidação

A revalidação mais recente substitui as premissas antigas para esta execução: 198 IDs em 36 grupos; 126 corrigidos, 52 parciais, 13 persistentes, 1 regressão, 6 não verificados. Preservar correções de checkout, inbox, CAS, sessão e refund já existentes.

Ordem: 00 → 12 (INF-010/runtime22) → 13 (TST-002/004/008 e core CI) → 01/02/05 (erros/validação) → 03 (DB-006/integridade) → 04/07 (regressão financeira/ADM-008) → 11 (logs/shutdown) → 08/09 (browser) → 10 (DB-013/014) → 06/14 (qualidade focal) → 13/15.

Somente configuração fictícia e banco comprovadamente descartável nos testes. Não herdar .env ou executar integrações reais/sandbox. As regras de pontos gastos, disputa, logística, CPF único, taxonomia, soft delete e infraestrutura publicada não serão inventadas. Cada dependência externa permanece discriminada, sem impedir trabalho independente. Atualizar os handoffs por acréscimo, incluindo prova e risco residual; não alterar retrospectivamente auditorias.
## 2026-09-29 — execução dos prompts atualizados e correções locais

Série README+00–15 atualizada para GPT Astra (`gpt-6-astra`) e executada continuamente na ordem aprovada:00 →12 →13 →01/02/05 →03 →04/07 →11 →08/09 →10 →06/14 →13/15. Etapas já corrigidas foram preservadas; itens externos/políticas foram discriminados, sem pausar itens independentes.

Entregues: contrato de ambiente com sandbox desativado; fixtures por hash/HTTP com Host; core CI com reconciliação PostgreSQL; erros públicos/validação/logs; migration aditiva de ownership; auditoria transacional de settings/fidelidade; correções de foco, recuperação offline e labels; paginação estável e lotes limitados; testes comportamentais e handoffs por domínio.

**Gates finais:** Node 22.22.1/npm10.9.4;622/622 unitários,68/68 integrações, tipos, lint(0 erros/15 avisos), ambiente38 nomes, scanner e build51 páginas aprovados.29 migrations+diff e preflight negativo em banco tmpfs; concorrência/rollback/idempotência/auth HTTP e jornadas CDP reais com provedores fictícios aprovados. SIGTERM/drain HTTP Linux passou no recorte documentado.

**Estado atualizado:**198IDs:133 corrigidos/48 parciais/11 persistentes/0 regressões/6 nãoverificados.36 grupos:15 corrigidos/19 parciais/1 persistente/0 regressões/1 nãoverificado. Oito reclassificações de origem; demais estados herdados da revalidação de 29/09. IDs e histórico preservados.

Matriz, evidências, limitações e encerramentos em [FINAL-VALIDATION.md](FINAL-VALIDATION.md), seção datada desta execução; [PLAN.md](PLAN.md) contém responsáveis atualizados. Nenhuma integração configurada, banco da aplicação, credencial, sandbox financeiro ou publicação foi acionado. Homologação externa e decisões comerciais continuam pendentes. Nenhum commit criado.
