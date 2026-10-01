# Auditoria de Segurança da Aplicação

**Etapa:** 06/15

**Data da análise:** 2026-09-26

**Escopo:** revisão adversarial defensiva do repositório local, cobrindo os eixos A–Q definidos para esta etapa

**Base:** estado local do código e do lockfile; sem acesso a produção, banco real, contas reais, serviços cloud ou tráfego externo

## 1. Executive Summary

A aplicação é um e-commerce multi-tenant em Next.js 16, React, Prisma/PostgreSQL, com sessão opaca em cookie, pagamentos Asaas, armazenamento Supabase e e-mail Resend. Há controles positivos relevantes: Prisma é usado sem SQL raw; mutações administrativas passam por guards no servidor; cadastro força papel `CUSTOMER`; cookies de sessão são `HttpOnly`, `SameSite=Lax` e `Secure` em produção; webhooks e crons reais falham fechados sem segredo; preços e estoque do checkout são relidos no servidor; respostas de usuário passam por DTO; e o lockfile contém integridade para todas as entradas resolvidas.

Esses controles não compensam três quebras críticas de confiança: endpoints públicos retornam configuração secreta da loja; checkout convidado reutiliza conta existente por igualdade de e-mail e pode alterar PII/gastar pontos; e o fluxo de recuperação constrói o link de reset a partir de origem controlada pelo solicitante. Também foram confirmados BOLA em pontos, sessão não vinculada ao tenant, credencial administrativa versionada, reset/logs inseguros, idempotência cross-tenant, perda permanente de webhooks após falha parcial e superfícies condicionais perigosas de debug/upload.

**Conclusão limitada ao escopo:** publicação não recomendada antes da correção e regressão de `SEC-001` a `SEC-008`, `SEC-012` e `SEC-013`, além da revogação operacional exigida por `SEC-004`. Esta conclusão não afirma segurança universal e não substitui teste dinâmico autorizado, revisão de infraestrutura nem pentest independente.

### Riscos por severidade

| Severidade | Quantidade |
|---|---:|
| BLOCKER | 0 |
| CRITICAL | 3 |
| HIGH | 13 |
| MEDIUM | 5 |
| LOW | 0 |
| INFORMATIONAL | 0 |
| **Total** | **21** |

### Publication Blockers

- `SEC-001`: credenciais e configuração interna são serializadas em APIs públicas.
- `SEC-002`: visitante pode assumir a identidade lógica de conta por e-mail no checkout e usar pontos.
- `SEC-003`: link de reset aceita domínio controlado pelo solicitante.
- `SEC-004`: credencial de administrador de teste está versionada; validade não verificada, rotação necessária.
- `SEC-005`: simulação pública de fidelidade lê/cria carteira com IDs arbitrários.
- `SEC-006`: token de sessão de uma loja é aceito sob o host de outra.
- `SEC-007`: token de reset bruto pode ser lido no banco e impresso em logs.
- `SEC-008`: o mesmo token de reset pode vencer duas redefinições concorrentes.
- `SEC-012`: idempotência de checkout é opcional e global, permitindo duplicação e replay cross-tenant.
- `SEC-013`: webhook é marcado como processado antes dos efeitos; uma falha parcial torna o retry inócuo.

## 2. Metodologia e limitações

Foram lidos `AGENTS.md`, o README técnico (com a seção de credencial tratada de forma redigida), `package.json`, `package-lock.json`, `.env.example` apenas pelas chaves, configuração Next/Vitest/CI, schema e migrações Prisma, os 45 route handlers, guards, sessão, tenant resolver, validadores, serviços de checkout/pedidos/pontos/usuários/frete/pagamentos/e-mail/storage, componentes com sinks relevantes e os testes relacionados.

Para cada eixo, foi rastreado **origem → transformação/controle → ponto de uso**. Busca textual foi usada para inventário, seguida de leitura do fluxo. Nenhum valor de ambiente, senha, token, cookie ou PII de cliente é reproduzido neste relatório. Não houve login, envio de e-mail, acesso ao banco, chamada a Asaas/Supabase/Resend, consulta a metadados cloud, carga, exploit externo ou alteração de código de produto.

### Comandos locais e resultados reproduzíveis

```powershell
rg --files app/api -g 'route.ts'
rg -n --glob 'app/api/**/route.ts' 'export async function|requireAuth|requireAdmin|getCurrentUser|getLojaFromHeaders' app/api
rg -n '\$(queryRaw|executeRaw)(Unsafe)?|Prisma\.sql|sql`|ORDER BY' app lib services prisma tests
rg -n 'dangerouslySetInnerHTML|\.innerHTML|insertAdjacentHTML|DOMParser|marked\(|markdown' app components lib services
rg -n 'fetch\(|new URL\(' app lib services
rg -n -i 'captcha|turnstile|recaptcha|hcaptcha|openai|anthropic|gemini|prompt|llm' app lib services tests package.json
rg -n -i 'cors|csrf|origin|referer|sameSite|access-control-allow' app lib services next.config.js
npm audit --offline --omit=dev
npm run test:unit -- --run tests/unit/asaas-webhook.test.ts tests/unit/bola-idor-defense.test.ts tests/unit/security-csp-observability.test.ts tests/unit/rate-limit.test.ts tests/unit/supabase-storage.test.ts tests/unit/password-recovery.test.ts
```

Resultados:

- 45 arquivos de rota e 58 arquivos TypeScript de teste inventariados;
- nenhum uso de `$queryRaw`, `$executeRaw`, variantes `Unsafe` ou SQL construído em runtime foi encontrado;
- nenhum sink `dangerouslySetInnerHTML`, `innerHTML` ou renderizador Markdown foi encontrado no frontend;
- nenhum SDK/fluxo de IA ou CAPTCHA foi encontrado;
- não há `.next`, bundle ou sourcemap local para inspeção; `.env.example` é o único `.env*` rastreado;
- o lockfile v3 possui 588 entradas, todas as entradas com `resolved` possuem `integrity`, e o único host de resolução é `registry.npmjs.org`;
- `npm audit --offline --omit=dev` retornou **0 advisories**, limitado à base/cache local do npm em 2026-09-26; não houve consulta online;
- a suíte focal não executou: código de saída 1, `vitest` não reconhecido porque `node_modules` está ausente; dependências não foram instaladas para respeitar a criação exclusiva deste relatório;
- um marcador HTML inofensivo `<b>SEC-XSS</b>` permaneceu literal ao reproduzir a interpolação do template de reset, confirmando ausência de escape naquele sink;
- varredura mascarada de arquivos rastreados confirmou credencial administrativa literal em documentação/script; valores foram omitidos. Ocorrências em fixtures e placeholders foram separadas de segredo operacional.

## 3. Threat Model

### 3.1 Ativos

- identidade, papel, sessão, senha e tokens de recuperação;
- PII: e-mail, telefone, CPF/CNPJ e endereços;
- pedidos, preços, estoque, pontos, pagamentos e estados financeiros;
- credenciais Asaas, Correios, Nuvemshop, Supabase, Resend e cron;
- isolamento entre lojas, objetos administrativos, logs e trilha de auditoria.

### 3.2 Atores e capacidades consideradas

| Ator | Capacidades consideradas |
|---|---|
| anônimo | controla body/query/path/headers, chama APIs públicas e repete requisições |
| CUSTOMER A/B | possui sessão própria e tenta IDs/tenant da outra conta/loja |
| ADMIN A/B | administra a própria loja e tenta objetos/papéis de outra |
| integração | conhece token de webhook/cron e envia eventos válidos, repetidos, fora de ordem ou malformados |
| atacante com leitura do repositório/log/banco | vê material versionado ou storage comprometido, mas não recebeu acesso real nesta auditoria |
| falha de infraestrutura | banco, gateway ou e-mail falha entre etapas de um fluxo |

### 3.3 Trust boundaries e fluxo

```text
Browser / bot / webhook
  │ HTTP: host, headers, cookie, body, query, arquivos
  ▼
Next.js frontend + Route Handlers + Server Actions
  │ tenant resolver / Zod / guards / rate limit local
  ▼
Serviços de domínio
  ├── Prisma ──► PostgreSQL (identidade, pedidos, pontos, tokens, segredos de loja)
  ├── Asaas ───► cobrança e webhook
  ├── Supabase ► storage com service role
  ├── Resend ──► e-mail transacional
  └── Correios/VIACEP/J&T ► logística
```

Fronteiras críticas: host não é identidade; cookie é bearer; IDs do cliente não provam ownership; token estático autentica integração, não valida semanticamente o payload; service role ultrapassa RLS; banco/logs não devem conter bearer secrets reutilizáveis; resposta pública precisa de DTO próprio.

## 4. Attack Surface

| Superfície | Acesso observado | Controles e riscos principais |
|---|---|---|
| catálogo/loja/marcas | público | tenant por host na lista; detalhe por ID e loja por slug vazam modelo interno (`SEC-001`) |
| signup/login/reset | público | Zod, bcrypt e limites locais; reset/origem/token/enumeração em `SEC-003`, `SEC-007`, `SEC-008`, `SEC-010`, `SEC-019` |
| checkout/frete/status | público ou sessão opcional | recálculo autoritativo parcial; impersonação, idempotência e exaustão em `SEC-002`, `SEC-012`, `SEC-015` |
| perfil/carrinho/endereço/pedidos/pontos | CUSTOMER | ownership positivo na maioria; exceções de pontos e tenant em `SEC-005`, `SEC-006` |
| produtos/clientes/pedidos/usuários/configuração | ADMIN | guards e filtros de loja; corrida de último admin em `SEC-020` |
| webhook Asaas | token estático | comparação timing-safe e unicidade; falha de retry em `SEC-013`; erros em `SEC-018` |
| crons | segredo estático | fail-closed e timing-safe; topologia e rotação não verificadas |
| simulador Asaas | público em não-production | altera pedido por ID (`SEC-011`) |
| upload/API e avatar | autenticado e feature-gated | tamanho/MIME declarado; bucket arbitrário/service role em `SEC-014` |
| browser storage | mesmo origin | confirmação persiste dados de pedido/pagamento em `sessionStorage`; risco residual se houver XSS/extensão |

## 5. Cobertura dos eixos A–Q

| Eixo | Rastreio e resultado |
|---|---|
| A. Segredos | `.env*` ignorados salvo exemplo; nenhum bundle local. Segredos vazam por DTO público, reset/log e credencial versionada (`SEC-001`, `SEC-004`, `SEC-007`). |
| B. Entradas | Zod/allowlists em rotas principais e role forçado no serviço; webhook/frete legados sem schema e limites de tamanho/quantidade insuficientes (`SEC-015`). |
| C. SQL injection | Prisma tipado; nenhuma API raw encontrada. Identificadores/orderBy são fixos ou enum. **Não aplicável como achado confirmado.** |
| D. Prompt injection | nenhum recurso de IA/modelo/ferramenta encontrado. **Não aplicável.** |
| E. XSS | JSX do browser usa escape React e não há sink HTML direto. Template de reset interpola sem escape (`SEC-016`); CSP é permissiva (`SEC-017`). |
| F. IDOR/BOLA | ownership positivo em pedidos, entrega, endereço e admin; falhas em produto/segredos, guest, pontos, sessão e idempotência (`SEC-001`, `SEC-002`, `SEC-005`, `SEC-006`, `SEC-012`). |
| G. SSRF | fetches server-side têm destinos fixos por código/configuração e timeouts nos clientes principais. Nenhuma URL de usuário chega a fetch server-side. **Nenhum SSRF confirmado.** |
| H. Senhas | bcryptjs com salt/custo 10 e compare; problemas de política, resposta e reset em `SEC-007`, `SEC-008`, `SEC-019`. Argon2id não é usado. |
| I. Rate limit/DoS | apenas Map por processo/IP; endpoints caros e coleções sem máximo (`SEC-010`, `SEC-015`). Nenhuma carga foi executada. |
| J. Admin/debug/internal | guards de servidor nas APIs admin e layout; simulador HTTP não autenticado em ambientes não-production (`SEC-011`). |
| K. Bots | CAPTCHA não existe. Ausência isolada não foi classificada como falha; a defesa depende dos limites frágeis de `SEC-010`. |
| L. Erros | várias rotas devolvem `error.message`; logger inclui stack e não mascara e-mail (`SEC-018`). |
| M. Sessões/cookies | flags positivas; token não vinculado a tenant, logout fail-open e token bruto no banco (`SEC-006`, `SEC-009`, `SEC-021`). MFA não existe. |
| N. CSRF | não há token/origin check geral. `SameSite=Lax` e cookie host-only reduzem cross-site clássico; cenário same-site/subdomínio requer teste autorizado. **Não verificado.** |
| O. CORS | nenhuma lib/header permissivo foi encontrado; prevalece política same-origin do browser. CORS não participa da autenticação. Configuração de edge não verificada. |
| P. Upload | feature gate, MIME e 5 MB; conteúdo não é inspecionado e bucket é controlável (`SEC-014`). |
| Q. Dependências | lockfile íntegro; audit offline retornou zero. Advisories atuais, proveniência de CI e artefato final não verificados externamente. |

## 6. Findings

### SEC-001 — APIs públicas expõem credenciais e configuração interna da loja

- **Severidade:** CRITICAL
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `app/api/products/[id]/route.ts:25-32`; `services/product.service.ts:101-113`; `app/api/loja/[slug]/route.ts:8-32`; `services/loja.service.ts:189-224`; `prisma/schema.prisma:14-60`
- **Pré-condições do ataque:** acesso HTTP anônimo e um ID de produto ou slug, ambos obtidos por fluxos públicos.
- **Fluxo e condição:** path público → serviço sem tenant/DTO → Prisma inclui `Loja` completa ou seleção de campos internos → JSON público.
- **Evidência observada — fato:** detalhe de produto chama `getProductById(id)` e usa `include: { loja: true }`; o modelo contém token Nuvemshop e senha/contrato dos Correios. A rota por slug seleciona senha/contrato, endereço operacional e configuração interna.
- **Hipótese separada:** não foi consultado banco real; preenchimento/validade dos campos em produção é NOT VERIFIED.
- **Comportamento observado:** serialização pública e cross-tenant do modelo persistente.
- **Comportamento esperado:** DTO público mínimo, sem segredos, e produto limitado ao tenant do host.
- **Impacto:** comprometimento de integrações, fraude logística, exposição operacional e pivot entre tenants.
- **Correção proposta:** allowlist pública independente; consultar `{id, lojaID}`; nunca incluir `Loja` integral; rotacionar todo segredo potencialmente servido.
- **Teste de regressão:** snapshots negativos dos três fluxos e host A/B; campos sensíveis jamais aparecem e produto da outra loja retorna 404.
- **Risco residual:** dados comerciais realmente públicos precisam de classificação explícita; caches/CDNs podem conservar respostas antigas.

### SEC-002 — Checkout convidado impersona conta por e-mail e pode gastar pontos

- **Severidade:** CRITICAL
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `app/api/checkout/route.ts:70-93`; `services/checkout.service.ts:251-325,380-464`; `lib/validators/checkout.validators.ts:22-107`
- **Pré-condições do ataque:** conhecer e-mail de cliente da loja; para ganho financeiro, a conta precisa ter pontos.
- **Fluxo e condição:** body guest → rota remove `userId` → serviço faz upsert por `(email, lojaID)` → reutiliza User existente → atualiza PII e usa sua wallet.
- **Evidência observada — fato:** guest não prova senha/sessão/posse do e-mail; o upsert atualiza CPF/telefone e `resolvedUserId` alimenta simulação/débito de pontos. Nova identidade guest recebe `password: ''` e `ACTIVE`.
- **Hipótese separada:** saldo da vítima e conhecimento do e-mail condicionam o furto; o caminho de autoridade indevida é confirmado estaticamente.
- **Comportamento observado:** igualdade de e-mail concede efeitos de identidade autenticada.
- **Comportamento esperado:** guest isolado; PII, histórico e pontos somente após sessão/prova de posse.
- **Impacto:** furto de pontos, corrupção de PII, pedido anexado à vítima e bloqueio/confusão de cadastro.
- **Correção proposta:** snapshot/identidade guest separada; nunca atualizar User existente por e-mail anônimo; exigir autenticação recente para carteira/PII; reconciliação por link/OTP verificável.
- **Teste de regressão:** contas A/B fictícias; guest/A usando e-mail B não altera B, não lê/debita wallet e não associa pedido.
- **Risco residual:** migração de pedidos guest exige processo explícito, auditável e resistente a replay.

### SEC-003 — Recuperação de senha envia token para origem controlada pelo solicitante

- **Severidade:** CRITICAL
- **Confiança:** HIGH CONFIDENCE
- **Arquivo e linhas:** `app/api/auth/forgot-password/route.ts:52-80`; `services/auth.service.ts:145-200`; `lib/email/templates/password-reset.template.ts:3-15,112-134`
- **Pré-condições do ataque:** conhecer o e-mail; controlar um domínio; convencer a vítima a clicar no e-mail de reset solicitado pelo atacante.
- **Fluxo e condição:** `Origin`/`Referer` do request → `new URL(...).origin` → `originUrl` → link com token no e-mail.
- **Evidência observada — fato:** não há allowlist contra domínio do tenant. Tenant ausente ainda cai em ID público ou primeira loja do banco.
- **Hipótese separada:** tomada de conta exige clique e entrega do e-mail; nenhum e-mail foi enviado nesta auditoria.
- **Comportamento observado:** domínio do link é decidido por header não confiável.
- **Comportamento esperado:** base URL exclusivamente server-side, associada ao tenant validado; host desconhecido falha fechado.
- **Impacto:** token chega ao servidor do atacante e permite redefinir senha/revogar sessões da vítima.
- **Correção proposta:** ignorar origem do cliente; usar domínio verificado por tenant; remover fallback de primeira loja; invalidar tokens emitidos sob lógica antiga.
- **Teste de regressão:** matriz Host/Origin/Referer hostis com e-mail fake; somente domínio allowlisted pode aparecer.
- **Risco residual:** DNS e conta de e-mail comprometidos exigem controles operacionais externos.

### SEC-004 — Credencial administrativa está versionada e o script a imprime

- **Severidade:** HIGH
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `DOCUMENTACAO_TECINICA/README.md:38-42`; `scripts/create_test_admin.ts:12-18,27-66`
- **Pré-condições do ataque:** leitura do repositório/clones/artefatos ou execução/observação do script.
- **Fluxo e condição:** segredo literal rastreado → README/script → criação/atualização de ADMIN na primeira loja e saída em console.
- **Evidência observada — fato:** identificador e senha de uma conta declarada ADMIN aparecem em texto claro; o script usa os mesmos dados e os imprime. Os valores são omitidos deste relatório.
- **Hipótese separada:** validade e ambiente da conta são NOT VERIFIED; não houve tentativa de login.
- **Comportamento observado:** credencial reutilizável tratada como documentação/código.
- **Comportamento esperado:** credenciais efêmeras geradas fora do Git e nunca impressas.
- **Impacto:** takeover administrativo se ainda válida; persistência em histórico, clones e logs.
- **Correção proposta:** revogar/rotacionar em todos os ambientes, remover da versão atual, avaliar saneamento coordenado do histórico e implantar secret scanning no CI/pre-commit.
- **Teste de regressão:** scanner bloqueia segredo literal; confirmação operacional autorizada demonstra revogação sem registrar o valor.
- **Risco residual:** remoção do Git não elimina cópias anteriores; rotação permanece obrigatória.

### SEC-005 — Simulação pública de fidelidade permite BOLA e escrita cross-tenant

- **Severidade:** HIGH
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `app/api/loyalty/simulate/route.ts:6-40`; `services/loyalty.service.ts:34-43,141-165,196-295`; `prisma/schema.prisma:426-443`
- **Pré-condições do ataque:** UUIDs de usuário/loja; autenticação não é necessária.
- **Fluxo e condição:** body → `userID`/`lojaID` → `getOrCreateWallet` → upsert e saldo retornado.
- **Evidência observada — fato:** guest controla ambos os IDs; autenticado ainda controla `lojaID`; o serviço não prova que User pertence à loja.
- **Hipótese separada:** leitura de B exige conhecer UUID; criação cross-tenant para A exige apenas os IDs.
- **Comportamento observado:** endpoint chamado “simulate” lê e cria estado persistente arbitrário.
- **Comportamento esperado:** guest calcula sem wallet/escrita; sessão deriva usuário+tenant e valida host.
- **Impacto:** vazamento de saldo, enumeração de regras e corrupção de carteiras cross-tenant.
- **Correção proposta:** remover IDs do cliente autenticado; simulação guest pura; consulta nunca deve usar upsert.
- **Teste de regressão:** matriz anônimo/A/B/loja A/B comprova ausência de leitura/escrita indevida.
- **Risco residual:** parâmetros comerciais podem ser públicos, saldos e identidade não.

### SEC-006 — Sessão não é vinculada ao tenant da requisição

- **Severidade:** HIGH
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `lib/session.ts:83-123`; `lib/auth/guards.ts:12-53`; `app/api/orders/route.ts:14-83`; `services/order.service.ts:17-108`
- **Pré-condições do ataque:** copiar/reapresentar manualmente token de sessão A sob host que resolve B.
- **Fluxo e condição:** cookie → sessão/User A; host → Loja B; guard não compara; criação de pedido combina ambas.
- **Evidência observada — fato:** `requireAuth`/`requireAdmin` ignoram tenant; orders prioriza loja ativa sem rejeitar divergência.
- **Hipótese separada:** cookie host-only reduz envio automático entre hosts; replay por cliente HTTP, extensão ou token vazado continua aceito.
- **Comportamento observado:** uma sessão autentica globalmente, apesar do modelo multi-tenant.
- **Comportamento esperado:** guard compara tenant do host com `user.lojaID` antes do caso de uso.
- **Impacto:** ações cross-tenant e relacionamentos inconsistentes.
- **Correção proposta:** escopo de tenant na sessão/guard; divergência sempre 403; revogar sessões ao mover usuário/domínio.
- **Teste de regressão:** cookie A em todos os métodos nos hosts A/B, incluindo ADMIN; B falha antes do serviço.
- **Risco residual:** mudanças de domínio/tenant exigem procedimento de migração e revogação.

### SEC-007 — Token de reset é persistido bruto e pode ser impresso em logs

- **Severidade:** HIGH
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `prisma/schema.prisma:63-76`; `services/auth.service.ts:172-189,217-225`; `lib/email/index.ts:13-25`; `lib/email/providers/dev.provider.ts:19-34,43-50`
- **Pré-condições do ataque:** leitura do banco/logs; ou ambiente não-test sem `RESEND_API_KEY`.
- **Fluxo e condição:** CSPRNG → token bruto no User → URL → DevEmailService → destinatário/corpo completo no console.
- **Evidência observada — fato:** fallback dev é escolhido também fora de desenvolvimento; o corpo contém link/token e o log contém destinatário.
- **Hipótese separada:** configuração e retenção reais de produção são NOT VERIFIED.
- **Comportamento observado:** bearer de uma hora existe em dois repositórios legíveis.
- **Comportamento esperado:** somente hash no banco; nenhum token/PII em log; produção falha startup sem provedor.
- **Impacto:** takeover durante a janela e exposição de PII.
- **Correção proposta:** hash do token, logs redigidos, fail-fast de configuração e invalidação/rotação de tokens antigos.
- **Teste de regressão:** banco/log fake nunca contém token bruto/e-mail completo e produção sem provedor não inicia saudável.
- **Risco residual:** o provedor de e-mail recebe o link e precisa de controles próprios.

### SEC-008 — Token de reset pode ser consumido duas vezes em corrida

- **Severidade:** HIGH
- **Confiança:** HIGH CONFIDENCE
- **Arquivo e linhas:** `services/auth.service.ts:203-253`
- **Pré-condições do ataque:** duas submissões concorrentes do mesmo token ainda válido.
- **Fluxo e condição:** `findFirst` fora da transação → duas leituras válidas → update por `id` sem token/CAS → duas senhas.
- **Evidência observada — fato:** limpar o token no primeiro update não invalida o User já lido pelo segundo.
- **Hipótese separada:** interleaving precisa ser reproduzido em PostgreSQL; não há controle no código que o impeça.
- **Comportamento observado:** uso único não é atômico.
- **Comportamento esperado:** consumo condicional de exatamente uma linha dentro da mesma transação da troca/revogação.
- **Impacto:** atacante e vítima podem disputar o reset e a última gravação vence.
- **Correção proposta:** token hash + update/delete condicional com expiração e lock/CAS; exigir row count 1.
- **Teste de regressão:** barreira entre duas conexões; somente uma resposta tem sucesso e define a senha final.
- **Risco residual:** token roubado antes do primeiro uso continua crítico; alertar usuário e oferecer recuperação administrativa.

### SEC-009 — Logout é fail-open quando a revogação no banco falha

- **Severidade:** HIGH
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `lib/session.ts:55-73`; `app/api/auth/logout/route.ts:4-11`
- **Pré-condições do ataque:** cópia do cookie e falha do banco durante logout.
- **Fluxo e condição:** delete falha → catch suprime → cookie local apagado → rota redireciona sucesso → sessão servidor permanece.
- **Evidência observada — fato:** não há estado revogado/denylist alternativo e validade é de sete dias.
- **Hipótese separada:** falha e roubo simultâneos não foram provocados dinamicamente.
- **Comportamento observado:** usuário recebe aparência de encerramento sem revogação comprovada.
- **Comportamento esperado:** falha observável ou revogação resiliente/fail-closed.
- **Impacto:** sessão copiada continua autenticando.
- **Correção proposta:** propagar falha, denylist/versionamento compartilhado e opção “encerrar todos”.
- **Teste de regressão:** injetar falha, reutilizar cookie copiado e comprovar bloqueio ou erro explícito.
- **Risco residual:** disponibilidade do armazenamento de sessão continua dependência crítica.

### SEC-010 — Rate limit é local e confia em headers de IP sem boundary verificável

- **Severidade:** HIGH
- **Confiança:** HIGH CONFIDENCE
- **Arquivo e linhas:** `lib/rate-limit.ts:8-34,48-89,104-166`; `app/api/auth/forgot-password/route.ts:12-30`; `app/api/auth/reset-password/route.ts:11-30`
- **Pré-condições do ataque:** múltiplas instâncias/restarts ou proxy que não sobrescreve headers enviados pelo cliente.
- **Fluxo e condição:** headers → IP → chave em `Map` do processo; forgot/reset leem primeiro XFF diretamente.
- **Evidência observada — fato:** contador não é compartilhado; headers CDN/real-IP são aceitos sem configuração de proxy confiável; não há limite por conta+tenant.
- **Hipótese separada:** Vercel/CDN pode sobrescrever alguns headers; topologia efetiva é NOT VERIFIED.
- **Comportamento observado:** brute force/email bombing pode distribuir ou rotacionar chave/instância.
- **Comportamento esperado:** contador atômico compartilhado e IP derivado somente de proxies explicitamente confiáveis.
- **Impacto:** credential stuffing, spam de reset/cadastro e bypass de cotas.
- **Correção proposta:** Redis/edge compartilhado, chave IP+conta+tenant, backoff e observabilidade; unificar helper.
- **Teste de regressão:** duas instâncias, headers forjados e várias origens sobre uma conta; limite persiste e agrega.
- **Risco residual:** botnets exigem detecção de risco e MFA/step-up além do limiter.

### SEC-011 — Simulador de webhook é não autenticado em ambientes não-production

- **Severidade:** HIGH
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `app/api/webhooks/asaas/simulate/route.ts:5-108`
- **Pré-condições do ataque:** deployment com `NODE_ENV != production`, rota alcançável e ID de pedido.
- **Fluxo e condição:** POST público → apenas check de ambiente → update/transição de pedido por ID.
- **Evidência observada — fato:** não há token, ADMIN, loopback nem tenant; pode marcar pedido pago/cancelado e acionar estoque/pontos.
- **Hipótese separada:** exposição de dev/staging à rede é NOT VERIFIED; produção nominal retorna 403.
- **Comportamento observado:** ferramenta destrutiva de teste está no HTTP implantável.
- **Comportamento esperado:** ausente do build ou autenticada e limitada a fixtures/tenant de teste.
- **Impacto:** corrupção financeira/estoque em homologação e risco de misconfiguration no deploy.
- **Correção proposta:** remover do artefato implantável; alternativamente segredo separado + ADMIN + allowlist de ambiente/fixture.
- **Teste de regressão:** 404/403 sem credencial em todo ambiente implantável; fixture autorizada não alcança dados arbitrários.
- **Risco residual:** ambientes não-prod também podem conter PII e precisam de segregação.

### SEC-012 — Idempotência de checkout é opcional, global e não valida tenant/fingerprint

- **Severidade:** HIGH
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `app/api/checkout/route.ts:84-94`; `services/checkout.service.ts:115-167,411-433`; `prisma/schema.prisma:303-313`; `components/checkout/CheckoutForm.tsx:420-450`
- **Pré-condições do ataque:** repetição sem chave; ou conhecer/colidir chave usada por outra requisição.
- **Fluxo e condição:** header/body opcional → busca global por chave antes de validar loja → retorna pedido existente; ausência → novo pedido/cobrança.
- **Evidência observada — fato:** constraint é `@unique` global; lookup não compara tenant, usuário nem hash do payload. O submit de checkout encontrado no frontend não gera nem envia chave.
- **Hipótese separada:** exploração cross-tenant requer descobrir/colidir chave; duplicação ocorre em retry/double-submit sem chave.
- **Comportamento observado:** mesma operação pode duplicar efeitos ou devolver dados de outro pedido.
- **Comportamento esperado:** chave obrigatória, alta entropia, escopo tenant/actor e request fingerprint; replay idêntico somente.
- **Impacto:** pedidos/cobranças duplicados e BOLA de nome/telefone/itens/totais.
- **Correção proposta:** chave gerada no cliente/servidor, constraint composta, comparação de fingerprint e resposta 409 para reuse divergente.
- **Teste de regressão:** retry idêntico único; sem chave rejeitado; mesma chave entre A/B ou payload distinto nunca retorna objeto alheio.
- **Risco residual:** gateway externo também deve receber chave/referência idempotente e suportar reconciliação.

### SEC-013 — Webhook é marcado processado antes de concluir efeitos

- **Severidade:** HIGH
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `app/api/webhooks/asaas/route.ts:124-169,171-349`; `prisma/schema.prisma:552-561`
- **Pré-condições do ataque/falha:** token válido e falha após criação do evento, antes/durante atualização do pedido.
- **Fluxo e condição:** evento inexistente → insert com `processedAt` default → efeitos posteriores falham → 500 → retry encontra evento e retorna `ALREADY_PROCESSED` 200.
- **Evidência observada — fato:** não há estado RECEIVED/FAILED nem transação que una deduplicação e efeitos.
- **Hipótese separada:** frequência de falha do banco/serviço é NOT VERIFIED; o retry inócuo decorre diretamente do fluxo.
- **Comportamento observado:** falha parcial envenena a chave idempotente permanentemente.
- **Comportamento esperado:** somente marcar PROCESSED após commit; retries retomam FAILED/RECEIVED com segurança.
- **Impacto:** pagamento confirmado pode permanecer PENDING, estoque/pontos/e-mail divergem e reconciliação manual é necessária.
- **Correção proposta:** inbox transacional com estados/attempts/lastError, worker retry e reconciliação por gateway; nunca responder 200 como processado antes dos efeitos.
- **Teste de regressão:** injetar falha após insert, reenviar mesmo evento e comprovar efeitos exatamente uma vez.
- **Risco residual:** eventos fora de ordem exigem máquina de estados e consulta de verdade no gateway.

### SEC-014 — Upload genérico aceita bucket arbitrário usando service role

- **Severidade:** HIGH
- **Confiança:** HIGH CONFIDENCE
- **Arquivo e linhas:** `app/api/upload/route.ts:12-88`; `lib/supabase/storage.ts:18-77`; `app/profile/actions.ts:13-84`
- **Pré-condições do ataque:** sessão CUSTOMER e `ENABLE_DIRECT_UPLOAD=true` ou ambiente test; bucket alvo existente.
- **Fluxo e condição:** multipart `bucket` → bloqueio somente se string exata `products` → client Supabase service role → upload/public URL.
- **Evidência observada — fato:** qualquer outro nome passa; MIME vem do cliente; `formData()` bufferiza antes da checagem de 5 MB; service role ultrapassa políticas normais.
- **Hipótese separada:** buckets/políticas reais e feature flag são NOT VERIFIED; gate reduz exposição padrão.
- **Comportamento observado:** autoridade do caller é ampliada à credencial privilegiada do backend.
- **Comportamento esperado:** bucket/recurso definidos pelo servidor e conteúdo/tamanho limitados antes de alocação quando possível.
- **Impacto:** escrita em bucket interno/público, abuso de armazenamento, conteúdo malicioso e DoS de memória.
- **Correção proposta:** enum allowlist por papel, clientes de mínimo privilégio, magic-byte/decodificação de imagem, cotas e limite no edge/body.
- **Teste de regressão:** CUSTOMER só usa `avatars`; bucket aleatório/produtos falha; arquivo disfarçado/oversize é rejeitado sem upload.
- **Risco residual:** scanners/decoders e Supabase continuam dependências externas.

### SEC-015 — Entradas públicas sem máximos permitem amplificação de CPU, memória, DB e integrações

- **Severidade:** HIGH
- **Confiança:** HIGH CONFIDENCE
- **Arquivo e linhas:** `lib/validators/checkout.validators.ts:22-107`; `services/checkout.service.ts:178-249`; `app/api/freight/route.ts:6-66`; `app/api/freight/calculate/route.ts:7-145`; `app/api/upload/route.ts:28-72`
- **Pré-condições do ataque:** acesso anônimo a checkout/frete ou sessão para upload; limites de edge insuficientes.
- **Fluxo e condição:** array/string/body sem máximo → loop/queries por item dentro de transação, empacotamento/cotações externas ou buffering multipart.
- **Evidência observada — fato:** `items` só tem `.min(1)`; strings/quantidades relevantes não têm teto; checkout consulta produto por item; freight legado não usa schema/rate limit; upload lê form inteiro antes de tamanho.
- **Hipótese separada:** limites do hosting/proxy são NOT VERIFIED e podem reduzir payload máximo; nenhuma carga foi executada.
- **Comportamento observado:** custo servidor não é limitado proporcionalmente à entrada.
- **Comportamento esperado:** body/array/string/quantity com teto de negócio, batch queries, cotas distribuídas e timeouts.
- **Impacto:** esgotamento de conexões/transações/memória, custo de APIs externas e indisponibilidade por baixo volume.
- **Correção proposta:** limites no edge e Zod, deduplicar/batch de produtos, rate limit por tenant/IP/conta e desativar rota freight legada.
- **Teste de regressão:** boundary tests N/N+1, body oversized sem alocação integral e mocks provando teto de chamadas externas/DB.
- **Risco residual:** ataques distribuídos exigem WAF/cotas e observabilidade de infraestrutura.

### SEC-016 — Template de reset permite injeção de HTML por campos persistidos

- **Severidade:** MEDIUM
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `lib/email/templates/password-reset.template.ts:3-15,112-134`; `lib/validators/auth.ts:17-39`; `services/auth.service.ts:187-198`
- **Pré-condições do ataque:** valor controlado persistido em nome de usuário/loja e disparo de e-mail correspondente.
- **Fluxo e condição:** nome sem escape → `firstName` → template literal HTML; store/link também interpolados diretamente.
- **Evidência observada — fato:** não existe `escapeHtml` nesse template. Marcador inofensivo permaneceu como tag; o template de confirmação, em contraste, possui escape parcial.
- **Hipótese separada:** execução de scripts depende do cliente de e-mail e costuma ser bloqueada; alteração visual/link/imagem ainda pode ocorrer.
- **Comportamento observado:** dado não confiável vira markup.
- **Comportamento esperado:** escape contextual de texto/atributo e URL allowlisted.
- **Impacto:** phishing visual, conteúdo remoto e quebra do e-mail transacional.
- **Correção proposta:** função de escape única para todos os templates; validação de URL/protocolo e limites de nome.
- **Teste de regressão:** marcador aparece codificado como texto em subject/html/text e não cria elemento/atributo.
- **Risco residual:** sanitização dos clientes de e-mail varia; conteúdo deve permanecer defensivo.

### SEC-017 — CSP de produção permite `unsafe-inline` e `unsafe-eval`

- **Severidade:** MEDIUM
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `next.config.js:8-21,48-76`; `tests/unit/security-csp-observability.test.ts:5-38`
- **Pré-condições do ataque:** existência futura/condicional de injeção no origin.
- **Fluxo e condição:** resposta global → CSP → script inline/eval permitido, sem nonce/hash.
- **Evidência observada — fato:** diretiva é aplicada a todos os ambientes; teste chama a política de estrita mas não proíbe os dois relaxamentos.
- **Hipótese separada:** nenhum sink XSS browser foi confirmado nesta revisão; este é enfraquecimento de contenção, não exploração isolada.
- **Comportamento observado:** CSP oferece pouca mitigação contra script injetado.
- **Comportamento esperado:** produção sem unsafe-eval e scripts por nonce/hash conforme suporte real do Next.
- **Impacto:** maior impacto de eventual XSS/dependência comprometida.
- **Correção proposta:** CSP distinta dev/prod, nonce/hash, `object-src 'none'` e testes negativos.
- **Teste de regressão:** build E2E sob CSP estrita; inline/eval sem nonce é bloqueado sem quebrar fluxos.
- **Risco residual:** CSP é defesa em profundidade e não substitui escaping/validação.

### SEC-018 — Erros e logs podem expor detalhes internos e PII

- **Severidade:** MEDIUM
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `app/api/checkout/route.ts:96-116`; `app/api/webhooks/asaas/route.ts:341-348`; `app/api/upload/route.ts:82-88`; `app/api/freight/route.ts:60-64`; `lib/logger.ts:31-58,101-143`
- **Pré-condições do ataque:** provocar falha de serviço/DB/gateway; ou obter acesso a logs.
- **Fluxo e condição:** exception → `error.message`/stack → resposta pública ou console; contexto `email` não é mascarado.
- **Evidência observada — fato:** várias rotas devolvem mensagem arbitrária; logger sempre incorpora stack de Error e sua sanitização não cobre e-mail nem conteúdo da mensagem/stack.
- **Hipótese separada:** mensagens concretas de Prisma/gateway e acesso a logs de produção são NOT VERIFIED.
- **Comportamento observado:** detalhes dependem da exceção subjacente, sem taxonomia/redaction central completa.
- **Comportamento esperado:** erro público estável + correlation ID; detalhes redigidos somente em sink protegido.
- **Impacto:** caminhos/schema/estado interno ao caller e PII/segredos incidentais em observabilidade.
- **Correção proposta:** mapper central de erros, respostas genéricas 5xx, redaction de e-mail/mensagem/stack e retenção/acesso mínimos.
- **Teste de regressão:** erros sintéticos contendo path, SQL, token, cookie e PII nunca aparecem em JSON/log capturado.
- **Risco residual:** fornecedores podem devolver dados inesperados; redaction deve ser deny+allowlist e monitorada.

### SEC-019 — Política e respostas de autenticação permitem downgrade e enumeração

- **Severidade:** MEDIUM
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `lib/validators/auth.ts:4-39`; `services/auth.service.ts:36-45,92-133,203-236`; `app/api/auth/register/route.ts:55-62`; `app/api/auth/reset-password/route.ts:6-9`
- **Pré-condições do ataque:** testar e-mails/senhas no tenant ou usuário redefinir senha.
- **Fluxo e condição:** cadastro exige 8, reset aceita 6; login diferencia BLOCKED; registro devolve “email existente”; dummy bcrypt tem formato inválido.
- **Evidência observada — fato:** mensagens/status e mínimos divergem; hash dummy não possui comprimento/formato bcrypt normal.
- **Hipótese separada:** diferença temporal não foi medida sem dependências; enumeração textual é direta.
- **Comportamento observado:** reset enfraquece política e respostas revelam existência/estado.
- **Comportamento esperado:** política única e resposta externa uniforme, com hash dummy real do mesmo custo.
- **Impacto:** credential stuffing/phishing direcionado e senha pós-reset mais fraca.
- **Correção proposta:** schema central, senhas comuns/comprometidas, máximo seguro, mensagens uniformes e alertas fora de banda.
- **Teste de regressão:** mesmos vetores em signup/reset/change; corpos/status equivalentes para inexistente/errada/bloqueada/existente.
- **Risco residual:** timing perfeito é impraticável; rate limit e MFA administrativo continuam necessários.

### SEC-020 — Duas despromoções concorrentes podem remover todos os administradores

- **Severidade:** HIGH
- **Confiança:** HIGH CONFIDENCE
- **Arquivo e linhas:** `services/user.service.ts:4-74`; `app/api/admin/users/[id]/role/route.ts:47-74`
- **Pré-condições do ataque:** dois admins da mesma loja e requisições cruzadas concorrentes, ou duas credenciais comprometidas.
- **Fluxo e condição:** A/B leem count 2 fora da transação → ambos passam → cada transação despromove o outro.
- **Evidência observada — fato:** count e alvos são lidos antes do update; não há lock/CAS/owner estrutural.
- **Hipótese separada:** corrida não foi executada em PostgreSQL local.
- **Comportamento observado:** invariável “ao menos um admin” não é serializada.
- **Comportamento esperado:** alteração por tenant sob lock/revalidação e no máximo uma operação concluída.
- **Impacto:** lockout administrativo e intervenção privilegiada direta no banco.
- **Correção proposta:** serializar por tenant, revalidar dentro da transação e modelar owner não removível.
- **Teste de regressão:** duas conexões com barreira; sempre resta ADMIN ativo.
- **Risco residual:** bloqueio/exclusão de admin deve compartilhar a mesma invariável.

### SEC-021 — Tokens de sessão bearer são armazenados em texto claro

- **Severidade:** MEDIUM
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `lib/session.ts:16-52,83-123`; `prisma/schema.prisma:230-238`
- **Pré-condições do ataque:** leitura indevida de tabela/backup/log de consulta.
- **Fluxo e condição:** random 256 bits → mesmo valor no cookie e PK `Session.id` → lookup direto.
- **Evidência observada — fato:** não há hash/HMAC, versão ou `revokedAt`; valor lido do banco é imediatamente reutilizável por sete dias.
- **Hipótese separada:** criptografia de volume, controles de backup e acesso DB são NOT VERIFIED.
- **Comportamento observado:** comprometimento read-only do storage vira hijacking imediato.
- **Comportamento esperado:** identificador público + verificador hash/HMAC, rotação/revogação auditável.
- **Impacto:** tomada de sessão sem quebrar senha/hash.
- **Correção proposta:** persistir hash forte do token, comparar hash, reduzir TTL/rotacionar em eventos sensíveis e registrar revogação sem token.
- **Teste de regressão:** dump fictício não contém bearer aceito; cookie bruto ainda resolve apenas via hash.
- **Risco residual:** processo da aplicação e tráfego terminal ainda veem o bearer; TLS e proteção de runtime permanecem essenciais.

## 7. Matriz A/B e controles positivos

| Operação | A contra objeto B | Resultado estático |
|---|---|---|
| GET pedido autenticado | bloqueado por `order.userID` | positivo |
| confirmar entrega | bloqueado por ownership | positivo |
| definir endereço padrão | bloqueado por `address.userID` | positivo |
| carteira/extrato protegido | deriva user+loja da sessão | positivo |
| APIs administrativas de pedido/cliente/produto | usam `admin.lojaID` | positivo nos métodos inspecionados |
| cadastro envia `role=ADMIN` | Zod remove campo e serviço força CUSTOMER | positivo |
| GET produto B por ID público | permitido e inclui Loja | falha `SEC-001` |
| guest usa e-mail B | reutiliza B e pode usar pontos | falha `SEC-002` |
| simulação usa IDs B | lê/cria wallet | falha `SEC-005` |
| cookie A no host B | guard aceita; orders combina identidades | falha `SEC-006` |
| mesma idempotency key A/B | retorna primeiro pedido sem escopo | falha `SEC-012` |
| CUSTOMER chama admin | 403 por papel atual | positivo |

Não foram encontrados endpoints de DELETE para pedidos/endereço/pontos/pagamentos de cliente além dos métodos explicitamente listados; portanto, não se inferiu cobertura de método inexistente. O polling público de pedido usa UUID+host como capability e retorna estado/total; foi mantido como risco residual, não vulnerabilidade comprovada.

## 8. Dependências de infraestrutura

| Dependência | Suposição do código | Estado desta auditoria |
|---|---|---|
| reverse proxy/CDN | sobrescreve IP/host e limita body | NOT VERIFIED; crítico para `SEC-003`, `SEC-010`, `SEC-015` |
| TLS/HSTS/domínios | HTTPS correto e domínio do tenant íntegro | NOT VERIFIED |
| PostgreSQL | isolamento, backup/volume e concorrência | schema lido; runtime/isolamento NOT VERIFIED |
| secrets manager | chaves reais fora do Git e rotacionáveis | valores não lidos; `SEC-004` contradiz processo seguro |
| Supabase | buckets/RLS/CORS/content-type seguros | NOT VERIFIED; service role no backend |
| Asaas | token secreto, retries e reconciliação | fluxo lido; conta/eventos reais NOT VERIFIED |
| Resend | chave presente e logs/retention adequados | NOT VERIFIED; fallback inseguro em `SEC-007` |
| edge/WAF/rate store | proteção distribuída | não configurada no repositório; NOT VERIFIED |
| CI | build/test em Node 20 | existe, mas sem audit/secret scan/SAST explícitos; execução remota NOT VERIFIED |

## 9. Not Verified, não aplicável e lacunas

- **SQL injection:** não aplicável como finding nesta base: somente Prisma tipado e nenhum raw SQL runtime encontrado. Migrações SQL estáticas não recebem input HTTP.
- **Prompt injection:** não aplicável; não existe IA/modelo/tool calling no produto inspecionado.
- **SSRF:** nenhuma URL controlada pelo usuário alcança fetch server-side. Redirects, DNS rebinding, IPv4/IPv6 privados e limite de resposta não foram exercitados porque não há sink candidato; destinos por ambiente ainda dependem de configuração segura.
- **XSS browser:** nenhum sink DOM/HTML direto encontrado; JSX React escapa strings. Não houve browser/build para confirmar headers efetivos. Injeção em e-mail está confirmada separadamente.
- **CSRF:** sem proteção explícita, porém cookie host-only/SameSite e JSON reduzem ataque clássico. Cenário same-site com subdomínio comprometido e `text/plain` precisa de browser/domínios autorizados antes de classificação.
- **CORS:** ausência de headers no código implica same-origin por padrão; regras de CDN/storage não foram consultadas.
- **CAPTCHA/bots:** CAPTCHA não existe. Não foi assumido obrigatório; eficácia anti-bot depende de `SEC-010` e controles de edge.
- **MFA/OAuth/JWT/refresh:** não implementados; OAuth/JWT/refresh são não aplicáveis à sessão stateful atual. MFA é risco residual recomendado para ADMIN.
- **Bundles/sourcemaps:** `.next` e sourcemaps ausentes; não foi possível provar quais variáveis chegam ao bundle final.
- **Dependências:** resultado offline zero não prova ausência de advisory publicado depois do cache. Nenhuma versão foi atualizada.
- **Testes dinâmicos:** Vitest, banco, servidor e navegador indisponíveis sem `node_modules`; A/B, CSRF, CORS, cookies, erros e corridas foram traçados estaticamente.
- **Infra/cloud:** nenhuma política Supabase, log, bucket, variável, domínio, metadata endpoint, conta Asaas/Resend ou ambiente real foi consultado.

## 10. Testes existentes e lacunas de regressão

Há testes para token/timing-safe do webhook, guards A/B, pedidos cross-tenant, endereço, DTO, logger, rate limit, checkout autoritativo, idempotência simples, CSP/cabeçalhos, storage e reset. Eles não cobrem adequadamente:

- allowlist negativa de segredos nas APIs públicas;
- guest com e-mail de conta existente e pontos;
- Origin/Referer hostil e tenant ausente no reset;
- dois consumidores concorrentes do token;
- sessão A sob host B;
- loyalty simulate com IDs B/cross-tenant;
- idempotency key igual entre tenant/payload distintos ou ausência no cliente;
- falha do webhook após insert seguida de retry;
- simulador em staging alcançável;
- bucket arbitrário, magic bytes e body oversized antes de `formData`;
- limites N/N+1 de itens/strings/body e quantidade de chamadas externas;
- marker HTML no template de reset e CSP sem unsafe;
- erros sintéticos com SQL/path/token/PII e redaction de e-mail/stack;
- duas despromoções administrativas simultâneas;
- revogação de logout sob falha de banco;
- CSRF same-site e CORS efetivo em browser.

## 11. Priorização de correção

1. Fechar DTOs públicos e rotacionar segredos expostos/versionados (`SEC-001`, `SEC-004`).
2. Separar guest de conta e proteger fidelidade (`SEC-002`, `SEC-005`).
3. Reconstruir reset: domínio confiável, token hash/atômico, logs redigidos (`SEC-003`, `SEC-007`, `SEC-008`).
4. Vincular sessão ao tenant e tornar logout/revogação verificáveis (`SEC-006`, `SEC-009`, `SEC-021`).
5. Exigir idempotência tenant-scoped/fingerprint e tornar webhook retomável (`SEC-012`, `SEC-013`).
6. Remover/restringir debug e upload privilegiado (`SEC-011`, `SEC-014`).
7. Limitar recursos e distribuir rate limit (`SEC-010`, `SEC-015`).
8. Corrigir HTML/CSP, erros/logs e política de autenticação (`SEC-016` a `SEC-019`).
9. Serializar a invariável do último administrador (`SEC-020`).
10. Adicionar gates de secret scan, audit/SCA, testes adversariais e build artifact review no CI.

## 12. Residual Risks e conclusão

Mesmo após as correções, permanecem riscos inerentes a bearer sessions, conta de e-mail/DNS comprometida, botnets distribuídas, dependência de gateway, conteúdo de upload e erro operacional multi-tenant. Recomenda-se MFA/step-up para ADMIN, alertas de login/reset/papel, revogação por dispositivo, WAF/rate limit compartilhado, reconciliação financeira, secret scanning contínuo e teste dinâmico periódico.

A etapa 06 termina com **0 BLOCKER, 3 CRITICAL, 13 HIGH, 5 MEDIUM, 0 LOW e 0 INFORMATIONAL**. O resultado prova vulnerabilidades específicas no código revisado; não prova comprometimento real nem segurança global dos ambientes. Publicação permanece bloqueada pelos itens da seção executiva até correção, regressão local/integrada e validação das dependências de infraestrutura.
