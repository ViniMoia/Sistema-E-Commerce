# SECURITY-01 — correções de segurança da aplicação

**Data:** 2026-09-26  
**Revisão base inspecionada:** `0c7ef7ddfa5fb4520c4bc794163cbc71257c2bc4`  
**Commit criado:** nenhum  
**Publication Status:** `BLOCKED` — esta etapa não aprova publicação.  
**Relatórios lidos:** `FINAL-AUDIT.md`, `SECURITY-AUDIT.md`, `AUTH-AUDIT.md`, `INFRASTRUCTURE-AUDIT.md` e `docs/remediation/PLAN.md`; nenhum deles estava ausente.  
**Restrições respeitadas:** nenhum acesso a produção, cloud, contas, banco real, gateway, e-mail real, DNS ou credencial externa; nenhum segredo foi rotacionado ou incluído neste relatório.

## Resultado

Foram eliminados no código os caminhos confirmados de exposição de credencial, impersonação de convidado, reset por host controlado, bootstrap administrativo determinístico, tokens bearer em claro, consumo concorrente de reset, logout fail-open, BOLA de fidelidade, simulador público, bucket arbitrário, HTML injection em e-mail e PII bruta no logger. Também foram adicionados limites de entrada e uma boundary explícita para headers de proxy.

Os controles que dependem de migração/transação, infraestrutura compartilhada ou browser real permanecem `DEFERRED` ou `NOT VERIFIED`: idempotência/fingerprint do checkout (`SEC-012`), inbox transacional do webhook (`SEC-013`), limiter distribuído e limite de body na borda (`SEC-010`/`SEC-015`), CSP (`SEC-017`) e políticas reais de storage, e-mail, proxy, DNS e observabilidade.

## Matriz dos IDs SEC

| ID | Classificação atual | Estado | Evidência objetiva / risco residual |
|---|---|---|---|
| `SEC-001` | VALID | **FIXED** no código | DTO público e relação de produto usam allowlist; senha dos Correios saiu de respostas e escrita web. Rotação externa pendente. |
| `SEC-002` | VALID | **FIXED** | Visitante não reutiliza conta por e-mail, não altera PII e não gasta pontos; corrida de e-mail único falha fechada. Conta técnica de convidado ainda é débito arquitetural. |
| `SEC-003` | VALID | **FIXED** | Reset ignora `Origin`/`Referer`, exige tenant e origem canônica HTTPS configurada. DNS/TLS real `NOT VERIFIED`. |
| `SEC-004` | VALID | **FIXED** no repositório | Credencial/defaults e impressão foram removidos; bootstrap é opt-in, local, tenant-aware e não altera conta existente. Revogação/rotação real pendente. |
| `SEC-005` | VALID | **FIXED** para BOLA | Simulação exige sessão e deriva loja/usuário do backend; IDs no corpo são rejeitados. Invariantes do ledger seguem `DEFERRED`. |
| `SEC-006` | VALID | **FIXED** para sessão | Sessão só é aceita quando `user.lojaID` coincide com tenant ativo. Demais itens transacionais de `FINAL-005` continuam pendentes. |
| `SEC-007` | VALID | **FIXED** | Reset token é persistido como SHA-256; provedor dev não registra destinatário/corpo. Entrega real pendente. |
| `SEC-008` | VALID | **FIXED** | Consumo usa compare-and-set por usuário, hash, validade e status dentro da transação; segunda corrida falha. |
| `SEC-009` | VALID | **FIXED** | Falha ao revogar no banco preserva cookie e retorna 503; não há logout falso-positivo. |
| `SEC-010` | VALID | **DEFERRED** | Headers só têm autoridade com `TRUSTED_PROXY_PROVIDER`; há chave por IP+conta/token. `Map` continua local, sem Redis/edge compartilhado. |
| `SEC-011` | VALID | **FIXED** | Simulador é 404 sem opt-in ou em produção, exige admin, evento em allowlist e pedido `id + lojaID`. Escritas ainda não são uma transação única. |
| `SEC-012` | VALID | **DEFERRED** | Requer chave obrigatória, fingerprint, escopo/constraint e integração idempotente com gateway; depende da etapa transacional/migração. |
| `SEC-013` | VALID | **DEFERRED** | Inbox com estados/retry/reconciliação requer schema, worker e transação; não foi aplicada correção parcial perigosa. |
| `SEC-014` | VALID | **FIXED** no app / storage `NOT VERIFIED` | Upload exige admin e bucket servidor `products`; ACL/RLS/magic bytes/cota do Supabase precisam de ambiente autorizado. |
| `SEC-015` | VALID | **DEFERRED** | Arrays, strings, quantidade e dimensões têm máximos; frete tem rate limit e rota legada 410. Limite de body antes de `json/formData` e WAF continuam externos. |
| `SEC-016` | VALID | **FIXED** | Template escapa conteúdo, valida protocolo e provedor dev reutiliza template canônico. |
| `SEC-017` | VALID | **DEFERRED** | CSP não foi alterada sem desenho de nonce/hash e teste em browser/report-only; pertence à etapa web. |
| `SEC-018` | VALID | **FIXED** no logger local | E-mail, documento, bearer e parâmetros sensíveis são saneados inclusive em stack. Retenção/acesso no coletor real `NOT VERIFIED`. |
| `SEC-019` | VALID | **DEFERRED** para o grupo | Login não distingue ausente/bloqueado e sempre executa bcrypt válido; reset exige 8 caracteres. Política central/breached-password e limiter distribuído pendentes. |
| `SEC-020` | VALID | **FIXED** no código | Releituras, contagem de `ADMIN ACTIVE`, escrita e auditoria usam transação `Serializable` com retry `P2034`. Prova concorrente em PostgreSQL real pendente. |
| `SEC-021` | VALID | **FIXED** | Banco guarda somente hash SHA-256 do token de sessão; bearer bruto existe apenas no cookie HttpOnly. Sessões antigas serão invalidadas no deploy. |

## IDs correlatos tratados

| Grupo de causa raiz | IDs correlatos | Estado desta etapa |
|---|---|---|
| DTO público/segredo operacional | `FINAL-010`, `BE-002`, `AUTH-001`, `SEC-001`, `ADM-007` | **FIXED** no código; rotação externa pendente |
| Identidade convidada | `FINAL-011`, `AUTH-002`, `SEC-002` | **FIXED** |
| Origem de reset | `FINAL-012`, `BE-009`, `AUTH-003`, `SEC-003` | **FIXED** |
| Sessão/reset/e-mail | `FINAL-016`, `AUTH-006`, `AUTH-007`, `AUTH-009`, `SEC-007/008/009/021`, `INF-006` | **FIXED** no app |
| Vínculo sessão-tenant | parcela `AUTH-005`, `SEC-006` de `FINAL-005` | **FIXED**; grupo transacional permanece `DEFERRED` |
| BOLA de fidelidade | parcela `BE-008`, `AUTH-004`, `SEC-005` de `FINAL-014` | **FIXED**; ledger/concurrency `DEFERRED` |
| Simulador/upload | `FINAL-018`, `BE-010`, `AUTH-010`, `AUTH-011`, `SEC-011`, `SEC-014`, `INF-009` | **FIXED** no app; storage externo `NOT VERIFIED` |
| Administração | `FINAL-019`, `AUTH-012`, `AUTH-015`, `SEC-004`, `SEC-020`, `INF-005`, `ADM-004` | **FIXED** no código; rotação e teste DB pendentes |
| Limites/rate limit | parcelas `ARCH-011`, `AUTH-008`, `SEC-010`, `SEC-015`, `PERF-005`, `PERF-008` de `FINAL-017` | **DEFERRED**; controles locais aplicados |
| Logs/PII | parcelas `BE-014`, `BE-016`, `SEC-018`, `OBS-004` de `FINAL-027` | **FIXED** local; observabilidade externa pendente |
| E-mail HTML/CSP | `SEC-016` de `FINAL-032` | **FIXED**; `SEC-017`/WEB correlatos `DEFERRED` |
| Enumeração/política | `AUTH-013`, `AUTH-014`, `SEC-019` de `FINAL-035` | **DEFERRED**; enumeração e mínimo do reset corrigidos |

## Fluxos, trust boundaries e sinks corrigidos

| Fluxo | Origem do dado | Trust boundary | Sink anterior | Controle aplicado |
|---|---|---|---|---|
| Loja/produto público | linhas Prisma | Route Handler público | JSON com entidade ampla/segredo | `select` allowlist + tenant no predicado |
| Checkout convidado | e-mail/CPF/telefone/pontos JSON | endpoint público → transação | `User.upsert`, pedido e carteira da conta encontrada | conta existente exige autenticação; convidado só cria e-mail novo; pontos exigem sessão |
| Recuperação de senha | headers, e-mail e tenant | request → e-mail | link com host de `Origin`/`Referer` | origem canônica DB/config, HTTPS e fail-closed |
| Sessão | cookie bearer | cookie → banco → tenant | token bruto como PK e sessão portátil | hash no banco, cookie bruto, comparação de tenant |
| Reset | token de e-mail | HTTP → banco | token bruto e update após leitura | SHA-256 + CAS de uso único + revogação transacional |
| Papel admin | IDs do ator/alvo | rota admin → serviço | leituras/contagem fora da transação | revalidação e contagem ativa serializáveis |
| Fidelidade | IDs do JSON | rota pública → carteira | escolha de loja/usuário pelo caller | schema estrito e IDs da sessão |
| Simulador Asaas | pedido/evento JSON | ferramenta de teste → FSM | mutação pública por ID | opt-in, admin, allowlist e tenant |
| Upload | bucket/MIME multipart | sessão → service role | bucket arbitrário | admin global da rota e bucket fixo servidor |
| E-mail HTML | nomes/URL persistidos | dados → MIME HTML | interpolação direta | escaping + allowlist de URL |
| Logger | contexto/exceções | app → stdout/coletor | PII/segredo em texto/stack | mascaramento/redação recursiva e em texto livre |
| Checkout/frete | arrays/strings/quantidades | JSON → DB/provider | custo sem teto | máximos N/N+1, tenant do domínio, rate limit e endpoint legado 410 |
| IP para cota | headers HTTP | proxy → aplicação | confiança em qualquer forwarding header | provedor de proxy explicitamente configurado |

## Evidência antes e depois

| Item | Antes | Depois |
|---|---|---|
| Suite unitária | 48 arquivos passavam e 1 falhava; 362 testes passavam e 2 falhavam por mock incompleto do webhook. | **55/55 arquivos e 399/399 testes passaram**. |
| TypeScript | `npx tsc --noEmit` passava. | Continua passando, exit 0. |
| Build | Não havia sido executado na triagem por dependências ausentes. | `npm run build` passou com Next.js 16.3.5, 51 páginas geradas. |
| Lint | 1 erro e 20 warnings preexistentes. | Mantém 1 erro e 20 warnings; erro em memoização manual de `CheckoutForm.tsx:243`, fora do escopo. |
| Dependências de produção | `npm ci` informou duas vulnerabilidades moderadas no conjunto completo. | `npm audit --omit=dev --audit-level=high` retornou **0 vulnerabilidades** de produção; dependências não foram atualizadas. |
| Segredos versionados | Bootstrap/documentação continham uma credencial administrativa. | Identidade versionada não aparece fora dos relatórios históricos; valores não foram reproduzidos neste documento. |

Os testes novos não foram executados na revisão vulnerável. A evidência “antes” foi reprodução estática segura dos predicados, selects, fallbacks e sinks confirmados nos relatórios e no código; não foram usados dados reais nem payloads destrutivos.

## Comandos executados

- `npm.cmd ci` → exit 0; 507 pacotes instalados para validação local.
- Leitura integral dos guias locais relevantes do Next 16: Route Handlers, Authentication, Data Security e Cookies.
- Suites direcionadas por causa raiz → todas passaram; resultados registrados incrementalmente em `PROGRESS.md`.
- `npm.cmd run test:unit` → exit 0; 55 arquivos, 399 testes.
- `npx.cmd tsc --noEmit` → exit 0.
- `npm.cmd run build` → exit 0.
- `npm.cmd run lint` → exit 1; 1 erro e 20 warnings preexistentes, sem regressão de contagem.
- ESLint somente nos arquivos de backend/segurança alterados → exit 0.
- `npm.cmd audit --omit=dev --audit-level=high` → exit 0; 0 vulnerabilidades.
- `git diff --check` → exit 0.
- Busca de referência à identidade administrativa removida fora de auditorias históricas → nenhuma ocorrência.

## Serviços e verificações posteriores em ambiente autorizado

| Serviço/área | Verificação ou ação pendente | Responsável sugerido |
|---|---|---|
| Correios | revogar/rotacionar credencial potencialmente exposta e testar cotação | Operações/Segurança + Backend |
| Identidade/sessões | revogar sessões da conta administrativa exposta e comunicar reautenticação geral causada pelo novo hash | Segurança/Operações |
| DNS/TLS | provar vínculo `customDomain`/`PLATFORM_DOMAIN` ao tenant e HTTPS válido | Plataforma/Infra |
| Resend | configurar chave/from, testar entrega, bounce e ausência de tokens em logs | Plataforma/Backend |
| Supabase Storage | validar ACL/RLS, escrita pública, leitura, cota e tipo real do conteúdo | Cloud/Segurança |
| Proxy/CDN/WAF | definir `TRUSTED_PROXY_PROVIDER`, confirmar sobrescrita de header, limite de body e cota distribuída | Infra/SRE |
| Redis/edge limiter | contador atômico compartilhado entre instâncias, chave IP+tenant+conta e teste de restart | Infra/Backend |
| PostgreSQL descartável | corrida de último admin, consumo simultâneo de reset e invariantes transacionais | Backend/DBA/QA |
| Asaas | idempotência do checkout, inbox/retry/reconciliação e eventos fora de ordem | Pagamentos/Backend |
| Observabilidade | retenção, ACL, redaction no coletor e alertas sem PII | SRE/Privacidade |
| Browser/CSP | desenho nonce/hash, report-only e regressão de checkout/admin | Frontend/Segurança |

## Pendências que não foram convertidas em defeito resolvido

- `SEC-012`/`FINAL-008`: idempotência obrigatória, escopo e fingerprint; exige schema/migration e contrato com gateway.
- `SEC-013`/`FINAL-006`: inbox transacional e retry; exige estados persistidos e worker/reconciliação.
- `SEC-010`/`SEC-015`/`FINAL-017`: rate limiter multi-instância, limite de body no edge e cotas reais.
- `SEC-017`/`FINAL-032`: CSP sem `unsafe-inline`/`unsafe-eval`; exige desenho e browser.
- `SEC-019`/`FINAL-035`: política central e verificação de senhas comprometidas.
- Demais IDs não pertencentes à etapa de segurança permanecem conforme `PLAN.md` e não foram iniciados.

## Limitações e risco residual

- Testes usam mocks e processo local; não provam isolamento, latência, concorrência ou configuração real de serviços externos.
- Não houve teste dinâmico contra produção/staging, conta de terceiro, pagamento, e-mail, storage ou banco real.
- Hash de sessão invalida cookies antigos no deploy; isso é deliberado e precisa de comunicação operacional.
- O storage ainda usa service role internamente; a aplicação reduz a autoridade do caller, mas mínimo privilégio real depende do provedor.
- `formData()`/`request.json()` ainda podem alocar o body antes da validação; o limite efetivo deve existir na borda.
- O lint global segue bloqueado por débito preexistente não relacionado; build, tipos e testes passam.
- Não há evidência suficiente para marcar o e-commerce como `APPROVED`, `READY` ou publicável.

## Caminhos alterados

- Autenticação/tenant: `lib/session.ts`, `lib/tenant.ts`, `services/auth.service.ts`, rotas `app/api/auth/*` e `services/user.service.ts`.
- Fronteiras públicas: `services/loja.service.ts`, `services/product.service.ts`, `services/checkout.service.ts`, `app/api/products/[id]/route.ts`, `app/api/loja/settings/route.ts`.
- Superfícies privilegiadas: `app/api/webhooks/asaas/simulate/route.ts`, `app/api/upload/route.ts`, `app/api/loyalty/simulate/route.ts`.
- Limites/log/e-mail: `lib/validators/checkout.validators.ts`, `lib/rate-limit.ts`, `lib/logger.ts`, `lib/email/*`, rotas de frete e `.env.example`.
- Bootstrap/documentação: `scripts/create_test_admin.ts`, `DOCUMENTACAO_TECINICA/README.md`, `DOCUMENTACAO_TECINICA/DOCUMENTACAO_TECNICA_SISTEMA.md`.
- Regressão: suites existentes ajustadas e novos testes `auth-enumeration`, `email-security`, `public-store-boundary`, `session-security`, `tenant-canonical-origin` e `webhook-simulator-security`.

O histórico detalhado de cada causa raiz, comandos e resultados está em `docs/remediation/PROGRESS.md`.
