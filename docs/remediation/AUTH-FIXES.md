# AUTH-02 — autenticação, autorização e conta

**Data:** 2026-09-26  
**Revisão base inspecionada:** `0c7ef7ddfa5fb4520c4bc794163cbc71257c2bc4`  
**Commit criado:** nenhum  
**Publication Status:** `BLOCKED` — esta etapa não aprova publicação.  
**Relatórios lidos:** `FINAL-AUDIT.md`, `AUTH-AUDIT.md`, `SECURITY-AUDIT.md`, `ADMIN-AUDIT.md` e `docs/remediation/PLAN.md`; nenhum estava ausente.  
**Estado de entrada:** as correções da etapa `SECURITY-01` estavam presentes e foram preservadas. Cada `AUTH-*` foi revalidado contra esse estado, sem tratar o relatório histórico como prova do estado atual.

## Resultado

Os 15 achados `AUTH-001`–`AUTH-015` eram válidos na revisão auditada. No estado pós-`SECURITY-01`, 12 causas específicas já estavam resolvidas no código e receberam nesta etapa a classificação `ALREADY RESOLVED`. `AUTH-005` ainda tinha uma defesa residual incompleta: detalhe e confirmação de entrega aceitavam um pedido legado ligado ao usuário correto, mas ao tenant errado; ambos agora exigem simultaneamente proprietário e loja da sessão. `AUTH-008` continua `DEFERRED`, porque o contador em memória não protege múltiplas instâncias. `AUTH-015` está saneado no repositório, mas a rotação/revogação externa continua `NOT VERIFIED` e, portanto, pendente.

Não foi encontrado caminho direto de mass assignment para `role`, `status`, `lojaID`, `id` ou `emailVerified`: cadastro força `CUSTOMER/ACTIVE` e tenant do servidor; perfil limita a allowlist; mudança de papel usa o ator da sessão. Novas regressões comprovam essas fronteiras e a matriz anônimo/customer A/customer B/admin para pedidos, endereços, pontos, arquivos e papéis.

## Classificação dos IDs AUTH

| ID | Severidade / confiança original | Estado nesta etapa | Evidência atual e risco residual |
|---|---|---|---|
| `AUTH-001` | CRITICAL / CONFIRMED | `ALREADY RESOLVED` | DTO público usa allowlist e produto é tenant-scoped. Rotação de credenciais potencialmente expostas continua externa. |
| `AUTH-002` | CRITICAL / CONFIRMED | `ALREADY RESOLVED` | Checkout guest não reutiliza conta por e-mail, não altera PII e não resgata pontos. Vinculação futura de guest exige prova de posse. |
| `AUTH-003` | CRITICAL / HIGH CONFIDENCE | `ALREADY RESOLVED` | Reset ignora `Origin`/`Referer`, usa tenant e origem canônica HTTPS. DNS/TLS real permanece `NOT VERIFIED`. |
| `AUTH-004` | HIGH / CONFIRMED | `ALREADY RESOLVED` | Simulação exige sessão, deriva usuário/tenant do backend e rejeita IDs no corpo. Ledger concorrente pertence à etapa transacional. |
| `AUTH-005` | HIGH / CONFIRMED | `FIXED` | Sessão já era vinculada ao tenant; nesta etapa detalhe e confirmação também rejeitam pedido legado do mesmo usuário em outra loja. Dados históricos inconsistentes ainda precisam de inventário autorizado. |
| `AUTH-006` | HIGH / HIGH CONFIDENCE | `ALREADY RESOLVED` | Reset consome hash por compare-and-set dentro da transação; segunda submissão perde a corrida. Prova PostgreSQL concorrente real segue pendente. |
| `AUTH-007` | HIGH / CONFIRMED | `ALREADY RESOLVED` | Falha de revogação retorna 503 e preserva cookie, sem declarar logout concluído. Disponibilidade do banco continua necessária. |
| `AUTH-008` | HIGH / HIGH CONFIDENCE | `DEFERRED` | Headers de proxy agora exigem provedor configurado e chaves incluem conta/token, mas o limiter continua por processo. Redis/edge multi-instância é dependência real. |
| `AUTH-009` | HIGH / CONFIRMED | `ALREADY RESOLVED` | Banco guarda SHA-256 do reset token; provedor dev não registra destinatário/corpo; produção sem provedor falha fechada. Resend real não foi acessado. |
| `AUTH-010` | HIGH / HIGH CONFIDENCE | `ALREADY RESOLVED` | Upload genérico exige admin e fixa bucket `products`; avatar usa sessão e caminho tenant/user. ACL/RLS e conteúdo real do storage seguem `NOT VERIFIED`. |
| `AUTH-011` | HIGH / CONFIRMED | `ALREADY RESOLVED` | Simulador é inexistente por padrão/produção, exige opt-in, admin, tenant e allowlist de evento. Atomicidade de seus efeitos é dívida transacional. |
| `AUTH-012` | HIGH / HIGH CONFIDENCE | `ALREADY RESOLVED` | Ator, alvo, contagem de admins ativos, escrita e auditoria ocorrem em transação `Serializable` com retry `P2034`. Corrida real em PostgreSQL descartável pendente. |
| `AUTH-013` | MEDIUM / CONFIRMED | `ALREADY RESOLVED` para o defeito | Reset e cadastro exigem no mínimo oito caracteres. Política central/breached-password e máximo de entrada continuam recomendados, sem ampliar o achado original. |
| `AUTH-014` | MEDIUM / CONFIRMED | `ALREADY RESOLVED` | Ausente, bloqueado e senha errada usam bcrypt válido e mensagem externa uniforme. Rate limit distribuído continua ligado a `AUTH-008`. |
| `AUTH-015` | HIGH / CONFIRMED | `DEFERRED` externo | Credencial/defaults e impressão foram removidos do estado atual; validade, revogação, rotação e cópias em histórico/clones não foram verificadas nem alteradas. |

Nenhum `AUTH-*` foi reclassificado como `INVALID` ou promovido de `NOT VERIFIED` para defeito confirmado sem evidência. A classificação `ALREADY RESOLVED` significa somente que o controle já estava presente ao iniciar `AUTH-02`; não altera retrospectivamente os relatórios de auditoria.

## Causas raiz e fronteiras de confiança

| Grupo | IDs | Origem → boundary → sink | Controle atual |
|---|---|---|---|
| DTO/identidade guest | `AUTH-001`, `AUTH-002` | ID/e-mail público → handlers/checkout → modelo de loja, conta, PII e carteira | DTO mínimo, tenant no predicado, conta existente exige sessão e guest não usa pontos |
| Reset e login | `AUTH-003`, `AUTH-006`, `AUTH-009`, `AUTH-013`, `AUTH-014` | headers/e-mail/token/senha → auth/e-mail → URL, banco, hash e resposta HTTP | origem canônica, token hash/CAS, revogação de sessões, bcrypt uniforme e mínimo alinhado |
| Sessão e objeto | `AUTH-005`, `AUTH-007` | cookie + host + UUID do recurso → guard → pedido/logout | token hash, tenant obrigatório, proprietário+tenant no recurso e revogação fail-closed |
| Fidelidade | `AUTH-004` | JSON público → rota → carteira | sessão obrigatória, schema estrito e IDs do servidor |
| Superfícies privilegiadas | `AUTH-010`, `AUTH-011` | multipart/evento → service role/FSM | papel admin, bucket fixo, feature gate, tenant e allowlist |
| Administração | `AUTH-012`, `AUTH-015` | ator/alvo/bootstrap → papel/conta admin | ator da sessão, transação serializável e bootstrap sem credencial/default determinístico |
| Abuso distribuído | `AUTH-008` | IP/conta → limiter → rotas públicas de autenticação | boundary de proxy e chaves melhores; armazenamento compartilhado ainda ausente |

## Matriz comportamental revalidada

| Recurso/ação | Anônimo | Customer A × B | Admin | Prova local |
|---|---|---|---|---|
| Pedido — lista/detalhe | 401 nas rotas autenticadas | A não lê B; mesmo `userID` com `lojaID` legado divergente retorna 404 | admin A não lê pedido da loja B | `order-resource-authorization`, `order-multitenant-isolation` |
| Pedido — confirmar entrega | 401 | A não confirma B; registro do mesmo usuário em outro tenant retorna 404 antes da transação | não recebe bypass por papel nesta rota de proprietário | `client-confirmation` |
| Endereço padrão | 401 | `userId` vem da sessão e endereço B é recusado | admin só altera endereço que pertença à própria identidade; papel não ignora ownership | `authz-account-matrix`, `access-control` |
| Pontos — wallet/simulação | 401 | IDs A→B no corpo são rejeitados; consulta usa A/tenant A da sessão | configuração/ajuste exige admin e loja do admin | `loyalty-routes` |
| Arquivos | upload genérico 401 | customer não usa upload de produto; avatar grava somente `user.id`/`lojaID` da sessão | admin usa apenas bucket `products`; bucket arbitrário é rejeitado | `supabase-storage` |
| Mudança de papel | 401 | customer recebe 403; campos `actorId`/`lojaID` do corpo não têm autoridade | ator é sessão; alvo cross-tenant é 404; autoalteração/último admin são recusados | `authz-account-matrix`, `access-control` |
| Cadastro/perfil | públicos apenas nos fluxos próprios | `role/status/id/lojaID/emailVerified` são descartados; perfil não aceita e-mail/papel/tenant | mesmo endpoint de perfil atua somente no próprio admin | `cpf-cnpj-persistence`, `profile-update` |

## Correção aplicada em AUTH-02

### `AUTH-005` — pedido legado exige proprietário e tenant

**Antes:** `GET /api/orders/[id]` e `POST /api/orders/[id]/confirm-delivery` comparavam `order.userID` para customer, mas não comparavam `order.lojaID`. O vínculo de sessão corrigido em `SECURITY-01` impedia novos requests cross-tenant normais, porém não isolava uma linha histórica inconsistente produzida antes dessa correção.

**Depois:** customer precisa satisfazer `order.userID === session.user.id` e `order.lojaID === session.user.lojaID`; divergência de tenant retorna 404 antes de resposta ou mutação. Admin já era limitado por loja e permaneceu assim.

**Arquivos:**

- `app/api/orders/[id]/route.ts`
- `app/api/orders/[id]/confirm-delivery/route.ts`
- `tests/unit/order-resource-authorization.test.ts`
- `tests/unit/client-confirmation.test.ts`

**Risco de migração:** nenhum DDL. Recomenda-se consulta somente-leitura, em ambiente autorizado, para inventariar `Order.lojaID != User.lojaID`; eventual saneamento exige migration revisável, backup e regra de negócio, não foi executado aqui.

## Cadastro, login, sessões e conta

- Cadastro continua criando sessão imediatamente e força `CUSTOMER/ACTIVE`; tentativas de mass assignment foram cobertas por regressão.
- Login usa sessão opaca stateful; não há JWT nem refresh token. Esses mecanismos são `NOT APPLICABLE`, não defeitos ausentes a corrigir.
- Cookie permanece host-only, `HttpOnly`, `SameSite=Lax`, `Secure` em produção, `Path=/` e expiração de sete dias. Flags reais dependem de HTTPS/domínio autorizado.
- Login rotaciona o identificador e falha se não conseguir revogar a sessão anterior. Logout não apaga o cookie quando a revogação no banco falha.
- Reset revoga todas as sessões do usuário na mesma transação em que consome o token e altera a senha.
- Não existe endpoint de bloqueio/reativação no escopo atual; portanto, revogação associada a esse evento não pôde ser validada dinamicamente.
- Verificação de e-mail não está implementada: `emailVerified` existe, mas cadastro cria conta ativa e sessão. O relatório original registrou isso como lacuna sem requisito de negócio, não como `AUTH-*`; permanece `NOT VERIFIED/DEFERRED` até decisão de produto e desenho de token/provedor. Não foi criado um fluxo parcial que pudesse bloquear cadastros.
- Alteração autenticada de senha e MFA também não existem; são decisões futuras, com MFA recomendado para admin.

## Evidências antes e depois

| Evidência | Antes | Depois |
|---|---|---|
| Estado dos 15 achados | Relatório histórico: 3 CRITICAL, 10 HIGH, 2 MEDIUM; testes não executados na auditoria por ausência de dependências. | Código atual revalidado: 12 `ALREADY RESOLVED`, `AUTH-005` `FIXED`, `AUTH-008` e ação externa de `AUTH-015` pendentes. |
| Pedido cross-tenant legado | Ownership por usuário sem comparação de tenant em duas rotas. | Dois handlers com dupla condição; regressões de detalhe e confirmação retornam 404 sem mutar. |
| Mass assignment | Controle observado estaticamente, sem prova dedicada completa. | Cadastro, perfil e mudança de papel cobertos com campos inofensivos forjados; papel/tenant/ator permanecem server-side. |
| Matriz de recursos | Cobertura dispersa e algumas lacunas documentadas. | Suites focais: 8 arquivos, 67/67 testes; suite auth inicial: 11 arquivos, 75/75 testes. |
| Suite unitária total | Fechamento de `SECURITY-01`: 55 arquivos, 399 testes. | **57 arquivos, 416 testes**, todos passaram. |
| Tipos/build | Passavam ao fim de `SECURITY-01`. | `tsc --noEmit` e build Next.js 16.3.5 com 51 páginas passaram. |

Os testes novos não foram executados contra a revisão vulnerável. A evidência “antes” é a reprodução estática segura do predicado incompleto e dos sinks descritos pelos relatórios; não houve banco real, conta real, envio de e-mail, upload ou ação destrutiva.

## Comandos executados

- `git status --short` e buscas `rg` sobre relatórios, rotas, serviços, schemas e testes → inventário/revalidação local.
- Suite focal inicial de autenticação/autorização → 11 arquivos, 75/75 testes, exit 0.
- Suite da matriz e novos controles → 8 arquivos, 67/67 testes, exit 0.
- Suite focal da correção de pedido/mass assignment → 4 arquivos, 33/33 testes, exit 0 após ajustar a expectativa do transform do schema; a primeira execução teve 1 falha de asserção de teste, não de produto.
- `npm.cmd run test:unit` → exit 0; 57 arquivos, 416 testes.
- `npx.cmd tsc --noEmit` → exit 0.
- ESLint direcionado aos handlers/testes alterados nesta etapa → exit 0.
- `npm.cmd run build` → exit 0; Next.js 16.3.5, 51 páginas.
- `git diff --check` → resultado registrado no encerramento de `PROGRESS.md`.

## Serviços e verificações posteriores em ambiente autorizado

| Serviço/área | Verificação/ação pendente | Responsável sugerido |
|---|---|---|
| Identidade/credencial admin | revogar sessões, rotacionar credencial potencialmente exposta e avaliar histórico/clones sem divulgar valor | Segurança + Operações |
| PostgreSQL descartável | corrida de reset e de último admin; inventário de pedidos com tenant divergente | Backend + DBA + QA |
| Proxy/CDN/Redis/WAF | confirmar header sobrescrito, limiter compartilhado, restart/múltiplas instâncias e body limit | Infra/SRE + Backend |
| DNS/TLS/domínios | validar origem canônica por tenant e cookies `Secure`/host-only no domínio real | Infra/SRE |
| Resend | entrega, bounce, retenção e ausência de token/PII em logs | Backend + Operações |
| Supabase Storage | ACL/RLS, buckets, leitura pública, cota, magic bytes e mínimo privilégio da service role | Cloud + Segurança |
| Produto/Identidade | decidir verificação de e-mail, mudança autenticada de senha, logout global e MFA/step-up de admin | Produto + Segurança + Backend |
| Browser autorizado | CSRF entre domínios/subdomínios e flags efetivas de cookie | QA + Segurança |

## Limitações e risco residual

- `AUTH-008` permanece HIGH até existir limiter compartilhado/edge comprovado entre instâncias.
- `AUTH-015` permanece HIGH operacional enquanto rotação/revogação não tiver evidência autorizada.
- A atomicidade de pedido, pagamento, fidelidade e transições pertence à etapa transacional e não foi antecipada.
- Unitários com mocks não provam locks, headers, cookies, DNS, storage ou entrega de e-mail reais.
- A capability pública de status de pedido continua baseada em UUID + tenant; vazamento do UUID permanece risco residual documentado.
- Verificação de e-mail, mudança autenticada de senha, MFA, logout global e teste CSRF em browser continuam sem implementação/prova.
- Nenhum serviço externo foi acessado e nenhuma credencial real foi lida, trocada ou impressa.
- Não há evidência suficiente para marcar o sistema como `APPROVED`, `READY` ou publicável.

## Caminhos alterados nesta etapa

- Produto: `app/api/orders/[id]/route.ts`, `app/api/orders/[id]/confirm-delivery/route.ts`.
- Testes criados: `tests/unit/order-resource-authorization.test.ts`, `tests/unit/authz-account-matrix.test.ts`.
- Testes ampliados: `tests/unit/client-confirmation.test.ts`, `tests/unit/cpf-cnpj-persistence.test.ts`, `tests/unit/profile-update.test.ts`.
- Documentação: `docs/remediation/AUTH-FIXES.md`, `docs/remediation/PROGRESS.md`.

As correções de `SECURITY-01` revalidadas nesta etapa permanecem inventariadas em `SECURITY-FIXES.md`; este documento não atribui sua implementação novamente a `AUTH-02`.


## 2026-09-29 — execução dos prompts atualizados e correções locais

**IDs:** TST-002/008, AUTH-008/013/014/015, FINAL-016/035. Sessão opaca por hash preservada; fixtures corrigidas e login real no browser comprovado. HTTP com cookies persistidos testou anônimo, cliente dono/não dono e administradores A/B. Não foi encontrada autorização para mutação indevida nos cenários executados.

Cadastro rejeita nome só com espaços, >150 caracteres e telefone >20; preserva mensagem de conta existente, pois resposta uniforme exigiria contrato de transição. Sessões/reset/roles já corrigidos não foram reimplementados. Hash/helper: `lib/session-token.ts:4`; testes: `session-fixtures.test.ts`, `mutation-error-boundaries.test.ts`, `route-protection.test.ts`. FINAL-016 segue corrigido; FINAL-035 parcial. Risco residual de cadastro/rotação: MEDIUM/condicionado ao ambiente.

**Validação consolidada:** [complemento de FINAL-VALIDATION](FINAL-VALIDATION.md#2026-09-29--execução-dos-prompts-atualizados-e-correções-locais). Histórico acima preservado; homologação externa não inferida.
