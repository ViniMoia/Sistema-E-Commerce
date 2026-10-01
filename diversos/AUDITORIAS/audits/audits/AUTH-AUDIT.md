# Auditoria de Autenticação, Autorização e Área do Usuário

**Etapa:** 05/15  
**Data da análise:** 2026-09-26  
**Escopo:** cadastro, login, logout, recuperação de senha, sessão, papéis, autorização por objeto/tenant e área do usuário  
**Base analisada:** estado local do repositório; sem acesso a produção, banco real, contas reais ou serviços externos

## 1. Resultado executivo

A aplicação usa sessões opacas de 256 bits persistidas no PostgreSQL, e não JWT/refresh token. Há controles positivos importantes: cookie `HttpOnly`, `SameSite=Lax`, `Secure` em produção, rotação do identificador no login, consulta do papel/status atual a cada requisição, revogação de todas as sessões no reset de senha e guards de servidor para rotas administrativas. Nos caminhos principais, pedidos, endereço padrão, perfil, carteira de pontos e mutações administrativas derivam a identidade da sessão e aplicam filtros por usuário ou loja.

Apesar disso, o sistema não está pronto para publicação. Três falhas críticas quebram a fronteira de confiança: APIs públicas de catálogo expõem credenciais da loja; o checkout convidado encontra uma conta apenas pelo e-mail e pode alterar CPF/telefone e gastar seus pontos; e a recuperação de senha cria o link a partir de `Origin`/`Referer` controlado pelo solicitante, permitindo enviar à vítima um token apontando para domínio do atacante.

**Conclusão limitada a esta etapa:** publicação não recomendada até correção e regressão de `AUTH-001` a `AUTH-006`, `AUTH-009` e `AUTH-015`. Os demais achados devem compor a mesma estabilização de identidade e privilégios.

### Contagem por severidade

| Severidade | Quantidade |
|---|---:|
| BLOCKER | 0 |
| CRITICAL | 3 |
| HIGH | 10 |
| MEDIUM | 2 |
| LOW | 0 |
| INFORMATIONAL | 0 |
| **Total** | **15** |

### Bloqueios de publicação

- `AUTH-001`: endpoints públicos retornam credenciais de integração, endereço operacional e demais campos internos da loja.
- `AUTH-002`: checkout convidado pode se passar por uma conta existente apenas informando seu e-mail, alterar dados e resgatar pontos.
- `AUTH-003`: solicitação pública de reset aceita origem arbitrária para o link enviado por e-mail, possibilitando captura do token e tomada de conta.
- `AUTH-004`: simulação de pontos aceita `userID` e `lojaID` do cliente sem autenticação, lê saldo e cria carteira cross-tenant.
- `AUTH-005`: sessões não são vinculadas ao tenant do host; `POST /api/orders` combina usuário da sessão A com loja ativa B.
- `AUTH-006`: token de reset não é consumido atomicamente e admite duas redefinições concorrentes.
- `AUTH-009`: tokens de reset ficam em texto claro e podem ser impressos integralmente em logs quando o provedor de e-mail não está configurado.
- `AUTH-015`: o README técnico versionado contém uma credencial administrativa de teste em texto claro; sua validade atual não foi testada.

## 2. Metodologia e limites

Foram lidos `AGENTS.md`, `package.json`, documentação local relevante, schema/migrações Prisma, implementação de sessão, guards, tenant resolver, DTO sanitizer, todos os route handlers, serviços de autenticação/usuário/cliente/endereço/pedidos/pontos/produtos/storage, páginas protegidas e testes relacionados. Não há `README.md` na raiz; o README técnico encontrado em `DOCUMENTACAO_TECINICA/` foi tratado como contexto, nunca como prova superior ao código.

Foram rastreados:

- cadastro → sessão; login → sessão; logout → revogação;
- solicitação → emissão → consumo do token de reset → troca de senha → revogação de sessões;
- origem da identidade e do tenant em cada rota;
- matriz público/customer/admin dos recursos solicitados;
- cenários com cliente A, cliente B, admin A e admin B;
- tentativa de escalada customer → admin e acesso horizontal por ID;
- cookies, armazenamento de sessão, papéis e invalidação após eventos de segurança.

Nenhum arquivo de ambiente, cookie real, token de sessão real ou dado pessoal de cliente foi lido ou reproduzido. O README técnico contém uma credencial administrativa literal versionada; ela foi classificada em `AUTH-015` e seu valor foi deliberadamente omitido deste relatório. Nenhuma chamada externa, tentativa de login, envio de e-mail, conexão ao banco ou mutação de produção foi realizada. Nenhum arquivo de produto foi alterado.

### Comandos locais e resultados reproduzíveis

Executados a partir da raiz:

```powershell
rg --files app/api -g 'route.ts'
rg -n --glob 'app/api/**/route.ts' 'export async function (GET|POST|PUT|PATCH|DELETE)' app/api
rg -n 'requireAuth|requireAdmin|getCurrentUser|getLojaFromHeaders|session_id|resetToken|emailVerified' app lib services tests prisma/schema.prisma
rg -n -i 'verify-email|verification|change.password|currentPassword|newPassword|csrf|refresh|jwt' app lib services tests prisma --glob '!docs/**'
rg -n 'LAST_ADMIN|updateUserRole|setDefaultAddress|order_status_poll' app services tests
git status --short
```

Resultados relevantes:

- não há middleware/proxy global, JWT, refresh token, OAuth, MFA, verificação de e-mail ou alteração autenticada de senha;
- as APIs administrativas encontradas usam `requireAdmin`; as páginas sob `/admin` repetem a verificação no layout do servidor;
- a autorização relevante está majoritariamente no servidor, não apenas na interface;
- o README técnico versionado contém uma credencial administrativa literal; a validade não foi testada e o valor não é reproduzido neste relatório;
- `git status` mostrou apenas `docs/audits/` como conteúdo não rastreado já existente antes desta etapa.

Foi tentada a suíte focal:

```powershell
npm run test:unit -- --run tests/unit/access-control.test.ts tests/unit/password-recovery.test.ts tests/unit/order-multitenant-isolation.test.ts tests/unit/loyalty-routes.test.ts tests/unit/profile-update.test.ts tests/unit/client-confirmation.test.ts tests/unit/supabase-storage.test.ts
```

Resultado: **não executada**, código de saída `1`; `vitest` não foi reconhecido porque `node_modules` está ausente. Dependências não foram instaladas para respeitar a restrição de criar somente este relatório. Os cenários A/B abaixo são, portanto, traçados estáticos reproduzíveis pelo código, não testes dinâmicos contra PostgreSQL.

## 3. Arquitetura de identidade observada

### 3.1 Sessão

```text
cookie session_id (64 hex / 256 bits, host-only)
  └─ Session.id no PostgreSQL
     └─ User atual
        ├─ status ACTIVE/BLOCKED
        ├─ role String: CUSTOMER/ADMIN por convenção
        └─ lojaID
```

`lib/session.ts:16-52` remove a sessão indicada pelo cookie anterior, gera novo ID e define `HttpOnly`, `Secure` em produção, `SameSite=Lax`, `Path=/` e expiração de sete dias. `getCurrentUser` relê usuário, papel e status do banco (`lib/session.ts:83-123`); por isso uma despromoção passa a valer na requisição seguinte sem depender de claims antigos. Sessões expiradas são removidas em linha.

O ID da sessão é armazenado em texto claro como chave primária (`prisma/schema.prisma:230-238`). Não há versão, `revokedAt`, escopo de tenant, user-agent/IP ou mecanismo “logout de todos os dispositivos”, exceto a exclusão global executada no reset de senha.

### 3.2 Fluxos de autenticação

| Fluxo | Implementação observada | Resultado |
|---|---|---|
| signup | tenant pelo host; Zod; bcrypt custo 10; força `CUSTOMER/ACTIVE`; cria sessão | papel não vem do cliente; e-mail não é verificado |
| login | email+tenant; bcrypt; bloqueia `BLOCKED`; cria novo ID de sessão | resposta difere para bloqueado; rate limit local |
| logout | exclui sessão do cookie e apaga cookie | erro do banco é suprimido (`AUTH-007`) |
| forgot password | tenant; token aleatório de 256 bits; expira em 1 h; e-mail | link usa origem da requisição (`AUTH-003`) |
| reset password | busca token global não expirado; bcrypt; limpa token; apaga todas as sessões | consumo não é atômico (`AUTH-006`); mínimo cai para 6 caracteres |
| alteração autenticada | não encontrada | usuário precisa usar recuperação por e-mail |
| verificação de e-mail | campo `emailVerified` existe, mas não há fluxo | cadastro fica `ACTIVE` e autenticado imediatamente |
| JWT/refresh | não implementados | não aplicável à arquitetura atual |

## 4. Matriz recurso × público/customer/admin

| Recurso | Público | CUSTOMER | ADMIN | Controle de servidor e avaliação |
|---|---|---|---|---|
| catálogo — lista | leitura da loja do host | igual ao público | igual; criação exige admin | lista é tenant-scoped |
| catálogo — detalhe | leitura por ID | igual | igual; PUT/DELETE admin e tenant-scoped | GET ignora tenant e inclui `Loja` completa (`AUTH-001`) |
| pedidos | status por UUID+host | cria/lista/detalha/recebe apenas como sessão | lista/detalha/transiciona loja própria | controles A/B positivos, exceto sessão A + host B em criação (`AUTH-005`) |
| endereços | criação embutida em cadastro/checkout | define padrão somente se endereço pertence ao usuário | sem endpoint administrativo específico | ownership confirmado em `address.service` |
| perfil | nenhum | GET/PUT do próprio usuário; campos permitidos são nome/telefone/CPF | mesmo endpoint atua no próprio perfil | ID, papel, email e tenant vêm da sessão/servidor |
| pontos | simulação pública | carteira/extrato próprios; simulação | configuração, ajuste e relatórios da loja | carteira protegida; simulação pública confia em IDs (`AUTH-004`) |
| pagamentos | checkout convidado e polling por capability UUID | checkout pode vincular sessão | sem API administrativa de captura encontrada | associação por e-mail no guest é crítica (`AUTH-002`); webhook real usa token |
| usuários | cadastro/login/reset | própria sessão/perfil | lista e altera papéis na própria loja | customer recebe 403 em admin; corrida do último admin em `AUTH-012` |
| administração | nenhuma | 403/redirect | páginas e APIs, escopo `user.lojaID` | guard no servidor; nenhum bypass customer → admin confirmado |
| upload | nenhum sem sessão | avatar; API genérica condicional | produtos e API genérica | bucket arbitrário quando feature ligada (`AUTH-010`) |

### Endpoint público de status de pedido

`GET /api/orders/[id]/status` é deliberadamente público para guest checkout, limitado ao tenant do host e a um UUID imprevisível, e retorna número, total e estados. Foi tratado como uma **capability URL**, não como vulnerabilidade comprovada. Permanece o risco residual de vazamento do UUID por logs, histórico, suporte ou extensões; não há segundo segredo nem expiração dessa capability.

## 5. Traçados A/B e escalada de papel

| Cenário | Resultado do código | Evidência principal |
|---|---|---|
| cliente A lê pedido de cliente B por `/api/orders/[id]` | bloqueado com 403 | compara `order.userID` com sessão |
| cliente A confirma entrega do pedido B | bloqueado com 403 | ownership antes da transação |
| cliente A define endereço B como padrão | bloqueado | serviço compara `address.userID` |
| cliente A lê perfil B | não há ID no endpoint; perfil vem da sessão | `user.id` passado ao serviço |
| cliente A lê carteira B | bloqueado no endpoint de carteira | `user.id` + `user.lojaID` da sessão |
| público/cliente A simula pontos de B com IDs conhecidos | permitido | `userID`/`lojaID` do body em `AUTH-004` |
| cliente A chama API administrativa | bloqueado com 403 | `requireAdmin` verifica papel atual |
| admin A lê/muta pedido, cliente, produto, frete ou pontos de B | filtros retornam 404/nulo | parâmetros recebem `admin.lojaID` |
| sessão de A é reapresentada no host da loja B e cria pedido | permitido pelo roteamento atual | guard não compara tenant; orders prefere loja do host (`AUTH-005`) |
| visitante informa e-mail de B no checkout | conta B é reutilizada e atualizada | upsert por `email+loja`; pontos usam ID resolvido (`AUTH-002`) |
| dois admins tentam despromover um ao outro | ambos podem passar a contagem | check de último admin fora da transação (`AUTH-012`) |

Conclusão da escalada vertical: não foi encontrado caminho direto para um CUSTOMER definir o próprio `role` ou chamar mutações administrativas. O schema de cadastro descarta campos extras e o serviço força `CUSTOMER`; perfil não aceita papel. As exceções encontradas são impersonação de identidade no checkout, APIs públicas com autoridade excessiva e controles concorrentes, não uma alteração direta customer → admin.

## 6. Achados

### AUTH-001 — Catálogo público expõe credenciais e configuração interna da loja

- **Severidade:** CRITICAL
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `app/api/products/[id]/route.ts:25-32`; `services/product.service.ts:101-113`; `app/api/loja/[slug]/route.ts:8-32`; `services/loja.service.ts:189-224`; `prisma/schema.prisma:14-60`
- **Fluxo e condição:** qualquer visitante consulta um produto por ID público ou uma loja por slug.
- **Evidência observada — fato:** o detalhe de produto chama `getProductById(id)` sem tenant e usa `include: { loja: true }`, serializando a linha inteira de `Loja`, que contém token da Nuvemshop e senha/contrato dos Correios. A rota pública por slug seleciona e retorna senha/contrato dos Correios, endereço operacional completo, chave PIX e configuração interna. IDs de produto são fornecidos pela listagem pública, portanto não dependem de adivinhação.
- **Hipótese separada:** não foi verificado se os campos estão preenchidos em produção; a autorização/serialização indevida é confirmada mesmo quando valores atuais forem nulos.
- **Impacto:** comprometimento de integrações, fraude operacional, exposição de endereço e credenciais e acesso cross-tenant ao detalhe de produto.
- **Correção proposta:** DTO público allowlist separado de DTO administrativo; nunca incluir relação `loja` integral. Resolver tenant pelo host e consultar produto por `{id, lojaID}`. Rotacionar credenciais caso a rota já tenha sido publicada com valores reais.
- **Teste de regressão:** GET público nos dois endpoints deve retornar somente campos documentados; snapshot negativo deve impedir `nuvemshopAccessToken`, `correiosPassword`, contrato e endereço interno; produto de outro host deve resultar 404.
- **Risco residual:** chaves PIX/WhatsApp podem ser públicas por regra comercial, mas precisam de classificação explícita, não exposição por modelo inteiro.

### AUTH-002 — Checkout convidado impersona conta por e-mail, altera PII e pode gastar pontos

- **Severidade:** CRITICAL
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `app/api/checkout/route.ts:70-82`; `services/checkout.service.ts:251-310,313-343,452-464`; `lib/validators/checkout.validators.ts:34-45,87-108`
- **Fluxo e condição:** atacante sem sessão chama diretamente `POST /api/checkout` na loja da vítima, usa o e-mail dela, fornece CPF/telefone próprios e solicita resgate de pontos.
- **Evidência observada — fato:** a rota remove `customer.userId` de convidados, mas o serviço executa `user.upsert` por `(email, lojaID)`. Se a conta existe, atualiza CPF e telefone e usa seu ID como `resolvedUserId`. Esse ID consulta e debita a carteira quando `pointsToRedeem > 0`. Não há prova de senha, sessão ou posse do e-mail antes desses efeitos.
- **Hipótese separada:** saldo suficiente e conhecimento do e-mail condicionam o ganho financeiro; a alteração de conta e a tentativa de débito são permitidas pelo código.
- **Impacto:** furto de pontos, corrupção de CPF/telefone, pedidos vinculados à vítima, confusão de histórico e bloqueio de cadastro para e-mails previamente usados por guest.
- **Correção proposta:** separar identidade guest de conta autenticada. Nunca atualizar conta existente nem usar sua carteira apenas por igualdade de e-mail. Exigir sessão recente para pontos e alterações de PII; para guest, persistir snapshot no pedido ou identidade pendente verificada por link/OTP.
- **Teste de regressão:** conta B existente com saldo; checkout anônimo usando e-mail B deve não alterar User, não acessar/debitar carteira e não anexar pedido à conta. Repetir com sessão A e e-mail B.
- **Risco residual:** reconciliação posterior de pedidos guest com uma conta exige prova de posse e trilha auditável.

### AUTH-003 — Link de reset usa origem controlada pelo solicitante

- **Severidade:** CRITICAL
- **Confiança:** HIGH CONFIDENCE
- **Arquivo e linhas:** `app/api/auth/forgot-password/route.ts:52-81`; `services/auth.service.ts:145-200`; `lib/email/templates/password-reset.template.ts:7-7,120-130`
- **Fluxo e condição:** atacante solicita reset do e-mail da vítima enviando `Origin` ou `Referer` para domínio sob seu controle; vítima clica no e-mail.
- **Evidência observada — fato:** a rota deriva `originUrl` diretamente desses headers e o serviço concatena `/reset-password?token=...`; o template insere essa URL no link. O endpoint é público e não valida allowlist/origem contra o tenant. Se o tenant do host não for resolvido, ainda usa `NEXT_PUBLIC_LOJA_ID` ou a primeira loja do banco.
- **Hipótese separada:** a tomada de conta exige que a vítima clique e que o atacante opere o domínio indicado; nenhum e-mail real foi enviado nesta auditoria.
- **Impacto:** o token válido chega ao servidor do atacante pela navegação; ele pode redefinir a senha e revogar as sessões da vítima.
- **Correção proposta:** construir URL exclusivamente de configuração server-side por tenant/customDomain validado; ignorar `Origin`/`Referer` do cliente; falhar fechado quando tenant/base URL não forem resolvidos. Invalidar tokens já emitidos após correção.
- **Teste de regressão:** enviar headers hostis e host desconhecido; o e-mail fake deve conter apenas domínio allowlisted da loja ou a requisição deve falhar antes de emitir token.
- **Risco residual:** comprometimento de DNS/configuração do domínio continua fora do alcance da aplicação e requer controles operacionais.

### AUTH-004 — Simulação pública de pontos confia em usuário e loja do corpo

- **Severidade:** HIGH
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `app/api/loyalty/simulate/route.ts:6-40`; `services/loyalty.service.ts:34-39,141-165,196-295`; `prisma/schema.prisma:426-443`
- **Fluxo e condição:** visitante fornece `lojaID`, `userID`, subtotal e pontos; ou cliente A autenticado envia loja B.
- **Evidência observada — fato:** sem sessão, `resolvedUserId` recebe o `userID` do corpo; com sessão, só o usuário é substituído, enquanto `lojaID` continua controlado pelo corpo. `getOrCreateWallet` faz `upsert` do par sem conferir que o usuário pertence à loja. A resposta pode incluir `walletBalance` e a chamada cria carteira cross-tenant mesmo sendo denominada simulação.
- **Hipótese separada:** leitura do saldo de B exige conhecer seu UUID; a criação cross-tenant para o próprio A requer apenas IDs públicos/conhecidos.
- **Impacto:** BOLA de saldo, enumeração de regras e mutação indevida de carteiras entre tenants.
- **Correção proposta:** para usuário autenticado, derivar ambos os IDs da sessão e validar host; para guest, remover/ignorar `userID` e executar cálculo puramente matemático, sem carteira nem escrita. Substituir `getOrCreate` por leitura em endpoints de consulta.
- **Teste de regressão:** matriz guest/A/B com IDs trocados; nenhuma chamada pública deve acessar/upsertar wallet e A nunca deve consultar loja B.
- **Risco residual:** valores de programa podem ser públicos, mas saldos e identificadores de carteira não.

### AUTH-005 — Sessão não é vinculada ao tenant da requisição

- **Severidade:** HIGH
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `lib/session.ts:83-123`; `lib/auth/guards.ts:12-37`; `app/api/orders/route.ts:14-57,64-83`; `services/order.service.ts:17-108`
- **Fluxo e condição:** cookie/token de sessão emitido para usuário da loja A é reapresentado manualmente em requisição cujo host resolve loja B.
- **Evidência observada — fato:** sessão e guards não recebem/comparam tenant do request. Em pedidos, `authoritativeLojaId` prioriza `activeLoja.id` sobre `guard.user.lojaID` e não rejeita divergência quando o body omite `lojaID`; assim, usa `userID` de A e `lojaID` de B. Cookies são host-only, um controle positivo do navegador, mas a API aceita replay manual do token.
- **Hipótese separada:** um navegador normal não envia automaticamente cookie host-only entre domínios; o cenário requer cliente HTTP, extensão, vazamento ou cópia do token.
- **Impacto:** ações e pedidos cross-tenant, relacionamentos inconsistentes e quebra da premissa de que sessão representa simultaneamente usuário e loja ativa.
- **Correção proposta:** guardar/derivar tenant na sessão e fazer `requireAuth`/`requireAdmin` validar host ativo contra `user.lojaID`; rotas tenant-bound devem falhar 403 em divergência, nunca escolher uma das fontes silenciosamente.
- **Teste de regressão:** sessão A contra hosts A e B em todos os métodos; B deve falhar antes do serviço. Incluir admin A contra host B e custom domains.
- **Risco residual:** mudanças de domínio e migração de usuário entre lojas exigem revogar sessões antigas.

### AUTH-006 — Token de reset pode ser consumido duas vezes em corrida

- **Severidade:** HIGH
- **Confiança:** HIGH CONFIDENCE
- **Arquivo e linhas:** `services/auth.service.ts:203-253`
- **Fluxo e condição:** duas requisições concorrentes apresentam o mesmo token válido antes de qualquer uma limpar o registro.
- **Evidência observada — fato:** `findFirst` do token ocorre antes da transação. Dentro da transação, o update usa apenas `where: { id: user.id }`, não token/expiração/versionamento. Ambas as chamadas podem carregar o usuário e depois gravar hashes distintos; a última vence. Limpar o token na primeira não invalida o objeto já lido pela segunda.
- **Hipótese separada:** a interleaving precisa ser validada em PostgreSQL real; o código não contém condição que impeça o segundo update.
- **Impacto:** token declarado de uso único pode redefinir a senha mais de uma vez; atacante e vítima em corrida podem terminar com senha do atacante.
- **Correção proposta:** consumir token por update/delete condicional atômico sobre hash+expiração e exigir exatamente uma linha; somente então aplicar senha e revogar sessões na mesma transação, com lock/CAS apropriado.
- **Teste de regressão:** duas conexões e barreira após leitura; exatamente uma resposta deve ter sucesso e a senha final deve pertencer ao vencedor único.
- **Risco residual:** e-mail/link comprometido antes do primeiro uso ainda permite takeover; oferecer alerta e revogação administrativa.

### AUTH-007 — Logout informa sucesso mesmo se a sessão continuar válida no servidor

- **Severidade:** HIGH
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `lib/session.ts:55-73`; `app/api/auth/logout/route.ts:4-11`
- **Fluxo e condição:** exclusão da sessão no banco falha por erro transitório enquanto o cookie também foi copiado/roubado.
- **Evidência observada — fato:** `deleteSession` captura e apenas registra a falha de `session.deleteMany`, depois apaga o cookie. A rota sempre redireciona como sucesso. O registro servidor permanece aceito até sete dias; apagar o cookie da vítima não invalida uma cópia.
- **Hipótese separada:** depende de falha no banco no momento do logout e de posse do token por outro agente; não foi provocado em banco real.
- **Impacto:** usuário acredita ter encerrado a sessão, mas token comprometido continua autenticando.
- **Correção proposta:** não suprimir falha de revogação; registrar estado revogado/denylist de forma resiliente, retornar erro observável e oferecer “encerrar todas as sessões”. Considerar IDs de sessão armazenados como hash.
- **Teste de regressão:** injetar falha no delete, reutilizar o cookie em segundo cliente e comprovar que logout não é reportado como concluído ou que denylist bloqueia o token.
- **Risco residual:** revogação depende da disponibilidade do armazenamento compartilhado; desenhar comportamento fail-closed para áreas sensíveis.

### AUTH-008 — Rate limiting de autenticação é local e parcialmente baseado em header forjável

- **Severidade:** HIGH
- **Confiança:** HIGH CONFIDENCE
- **Arquivo e linhas:** `lib/rate-limit.ts:8-34,48-89,104-146`; `app/api/auth/login/route.ts:9-12`; `app/api/auth/register/route.ts:9-12`; `app/api/auth/forgot-password/route.ts:12-30`; `app/api/auth/reset-password/route.ts:11-30`
- **Fluxo e condição:** múltiplas instâncias/restarts; ou infraestrutura que não sobrescreve headers de IP enviados pelo cliente.
- **Evidência observada — fato:** contadores ficam em `Map` na memória do processo. Login aceita `x-forwarded-for` como fallback; forgot/reset usam o primeiro `x-forwarded-for` diretamente, sem o helper de validação. Não há limite compartilhado por conta/tenant nem persistência entre instâncias.
- **Hipótese separada:** Vercel/CF podem fornecer headers autenticados prioritários; topologia de produção não foi verificada. Mesmo assim, o contador continua por instância.
- **Impacto:** brute force distribuído, credential stuffing e e-mail bombing contornam os limites declarados.
- **Correção proposta:** rate limiter compartilhado e atômico, chaves combinando IP confiável + conta normalizada + tenant, backoff progressivo e observabilidade; aceitar IP apenas de proxy/CDN configurado.
- **Teste de regressão:** duas instâncias contra o mesmo backend de limite, rotação de `X-Forwarded-For` e tentativas sobre uma conta; o limite por conta deve persistir.
- **Risco residual:** botnets exigem detecção de risco, MFA/admin step-up e monitoramento além de rate limit.

### AUTH-009 — Tokens de reset ficam em texto claro e podem aparecer em logs

- **Severidade:** HIGH
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `prisma/schema.prisma:63-76`; `services/auth.service.ts:172-189,217-225`; `lib/email/index.ts:13-25`; `lib/email/providers/dev.provider.ts:19-34,43-50`
- **Fluxo e condição:** leitura indevida do banco; ou ambiente não-test sem `RESEND_API_KEY`, inclusive produção mal configurada.
- **Evidência observada — fato:** o token bruto é persistido e pesquisado diretamente. Quando não há chave Resend, o factory escolhe `DevEmailService`; fora de teste, ele imprime destinatário e corpo textual, que contém a URL completa com token. O serviço de reset não armazena somente hash.
- **Hipótese separada:** não foi inspecionada configuração/logs de produção e não se afirma que a chave esteja ausente hoje.
- **Impacto:** leitor de banco ou logs pode tomar contas durante a janela de uma hora; logs também recebem dado pessoal do destinatário.
- **Correção proposta:** persistir hash criptográfico do token, comparar hash apresentado, nunca logar corpo/link de recuperação, e falhar configuração de produção sem provedor de e-mail real. Redigir dados sensíveis em telemetria.
- **Teste de regressão:** banco e logs fake nunca contêm token bruto nem e-mail completo; reset com token bruto ainda valida por hash; produção sem provedor falha no startup/health check.
- **Risco residual:** provedor de e-mail necessariamente recebe o link; proteger conta, logs e retenção do fornecedor.

### AUTH-010 — Upload habilitado aceita bucket arbitrário com credencial service-role

- **Severidade:** HIGH
- **Confiança:** HIGH CONFIDENCE
- **Arquivo e linhas:** `app/api/upload/route.ts:12-79`; `lib/supabase/storage.ts:18-39,42-77`
- **Fluxo e condição:** `ENABLE_DIRECT_UPLOAD=true` ou ambiente de teste; CUSTOMER autenticado envia qualquer nome de bucket diferente da string exata `products`.
- **Evidência observada — fato:** só há veto para `bucket === "products" && role !== ADMIN`; todos os demais nomes são aceitos. O backend escreve usando `SUPABASE_SERVICE_ROLE_KEY`, que ignora políticas normais do cliente, em caminho prefixado pelo tenant. O feature gate está desligado por padrão fora de teste, reduzindo exposição atual.
- **Hipótese separada:** buckets existentes e permissões reais do Supabase não foram consultados; o alcance depende deles e do feature flag.
- **Impacto:** escrita não autorizada em buckets internos/públicos, abuso de armazenamento e conteúdo publicado sob contexto da loja.
- **Correção proposta:** enum allowlist servidor (`avatars` para customer, `products` para admin), ignorar bucket arbitrário do cliente, política por recurso e limites por usuário/tenant; minimizar privilégios do cliente usado.
- **Teste de regressão:** customer tenta `products`, nome aleatório e bucket interno; todos falham, enquanto `avatars` escreve apenas no prefixo autorizado.
- **Risco residual:** MIME declarado não prova conteúdo; processamento de imagem e antivírus podem ser necessários conforme uso.

### AUTH-011 — Simulador de webhook não exige identidade em ambientes não-production

- **Severidade:** HIGH
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `app/api/webhooks/asaas/simulate/route.ts:5-103`
- **Fluxo e condição:** aplicação executa com `NODE_ENV != production` e a rota é alcançável por terceiro.
- **Evidência observada — fato:** a única barreira é o valor de ambiente. Não há admin, token de teste ou restrição de origem/loopback. Qualquer caller com `orderId` pode gravar metadados e transicionar pedido de qualquer tenant para `PAID`/`CANCELLED`, disparando pontos e estoque.
- **Hipótese separada:** exposição de dev/staging à rede não foi verificada; em `NODE_ENV=production` a rota retorna 403.
- **Impacto:** corrupção financeira e de estoque em homologação, demonstrações ou ambiente dev compartilhado; risco de publicação se a classificação do ambiente for incorreta.
- **Correção proposta:** excluir a rota do build implantável ou exigir segredo separado + admin autorizado + allowlist de ambiente/tenant; preferir fixtures internas fora do HTTP público.
- **Teste de regressão:** sem credencial deve retornar 404/403 em todos os ambientes implantáveis; credencial de teste deve limitar pedidos/tenant de fixture.
- **Risco residual:** dados de homologação também podem conter PII; manter ambientes e bancos segregados.

### AUTH-012 — Proteção do último administrador é vulnerável a corrida

- **Severidade:** HIGH
- **Confiança:** HIGH CONFIDENCE
- **Arquivo e linhas:** `app/api/admin/users/[id]/role/route.ts:47-74`; `services/user.service.ts:4-74`
- **Fluxo e condição:** dois admins da mesma loja, A e B, enviam simultaneamente despromoção um do outro.
- **Evidência observada — fato:** ambos leem usuários e executam `count` antes da transação. Com contagem 2, ambos passam; cada transação atualiza um alvo por ID sem CAS/lock e a loja pode terminar sem admin. A proibição de autoalteração não impede o par cruzado.
- **Hipótese separada:** a corrida não foi executada contra PostgreSQL local; nenhum lock ou constraint observado impede a interleaving.
- **Impacto:** lockout administrativo completo e necessidade de correção direta no banco/suporte privilegiado.
- **Correção proposta:** serializar alterações de papel por tenant, revalidar contagem sob lock/transação e usar update condicional; considerar invariável estrutural/owner não removível.
- **Teste de regressão:** duas conexões despromovendo A/B com barreira; no máximo uma operação deve concluir e sempre deve restar um admin ativo.
- **Risco residual:** exclusão/bloqueio de usuários admins precisa compartilhar a mesma invariável.

### AUTH-013 — Reset permite senha mais fraca que o cadastro

- **Severidade:** MEDIUM
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `lib/validators/auth.ts:4-20`; `app/api/auth/reset-password/route.ts:6-9`; `services/auth.service.ts:203-236`
- **Fluxo e condição:** usuário cadastrado com senha mínima de 8 caracteres usa recuperação e escolhe 6 ou 7 caracteres.
- **Evidência observada — fato:** cadastro exige 8; login e reset aceitam 6. O serviço repete o mínimo 6. Não há política central versionada nem bloqueio de senhas comuns observado.
- **Hipótese separada:** força exigida pelo negócio não foi documentada; a regressão objetiva do mínimo é confirmada.
- **Impacto:** recuperação reduz a entropia mínima e cria política inconsistente entre interfaces.
- **Correção proposta:** schema único de senha para cadastro, reset e futura alteração; mínimo moderno, bloqueio de senhas comprometidas/comuns e comprimento máximo seguro para DoS do hash.
- **Teste de regressão:** mesmos vetores em todos os fluxos; qualquer senha rejeitada no cadastro também deve ser rejeitada no reset.
- **Risco residual:** complexidade formal não substitui senha única, gerenciador e MFA para admins.

### AUTH-014 — Login permite enumeração de contas bloqueadas e equalização temporal é frágil

- **Severidade:** MEDIUM
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `services/auth.service.ts:92-133`; `app/api/auth/login/route.ts:58-63`
- **Fluxo e condição:** atacante testa e-mails no tenant e compara corpo/tempo.
- **Evidência observada — fato:** conta inexistente/senha errada responde “Credenciais inválidas”, mas conta bloqueada responde “Usuário bloqueado” antes do bcrypt. O hash dummy para inexistente tem 41 caracteres, não o formato bcrypt de 60 caracteres usado pelos hashes reais, tornando a tentativa de equalização temporal dependente do comportamento de erro/retorno da biblioteca.
- **Hipótese separada:** a diferença temporal efetiva não foi medida porque `bcryptjs` não pôde ser executado; a diferença explícita de mensagem é confirmada.
- **Impacto:** confirmação de existência/estado de contas, útil para phishing e credential stuffing direcionado.
- **Correção proposta:** resposta externa uniforme para inexistente, senha errada e bloqueado; usar hash dummy bcrypt real com mesmo custo e medir distribuição temporal. Alertar o usuário bloqueado por canal separado.
- **Teste de regressão:** corpos/status idênticos e teste estatístico razoável entre classes; preservar logs internos sem revelar ao caller.
- **Risco residual:** diferenças de rede/banco nunca são perfeitamente constantes; rate limit e monitoramento continuam necessários.

### AUTH-015 — Credencial administrativa de teste está versionada em documentação

- **Severidade:** HIGH
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `DOCUMENTACAO_TECINICA/README.md:38-42`
- **Fluxo e condição:** qualquer pessoa ou automação com leitura do repositório acessa a seção de credenciais e obtém identificador e senha atribuídos a uma conta de papel `ADMIN`.
- **Evidência observada — fato:** o README, rastreado pelo Git, declara em texto claro URL de login, e-mail, senha e papel administrativo de uma conta de testes. Os valores não são reproduzidos neste relatório. O último commit que inclui o arquivo foi identificado localmente, mas o histórico completo e eventuais cópias não foram saneados nesta etapa.
- **Hipótese separada:** não foi realizada tentativa de login nem consulta externa; portanto, não está verificado se a credencial continua válida, se existe em produção/homologação ou se foi reutilizada em outro ambiente.
- **Impacto:** se ainda válida em qualquer ambiente acessível, permite tomada imediata de conta administrativa; mesmo revogada, normaliza manuseio inseguro e pode permanecer recuperável no histórico/clones.
- **Correção proposta:** revogar/rotacionar imediatamente a credencial em todos os ambientes autorizados, remover o segredo da versão atual e sanear o histórico conforme política e coordenação do repositório; substituir por instruções de provisionamento local com valor efêmero/gerado e adicionar secret scanning preventivo.
- **Teste de regressão:** scanner de segredos deve bloquear credenciais literais em documentação e código; em ambiente autorizado, confirmar por canal operacional que a credencial exposta foi revogada, sem registrar seu valor em teste ou log.
- **Risco residual:** clones, caches e artefatos anteriores podem conservar a credencial; rotação é obrigatória mesmo após remoção do Git.

## 7. Invalidação e eventos de segurança

| Evento | Comportamento observado | Avaliação |
|---|---|---|
| login após sessão existente no mesmo browser | tenta remover sessão anterior e cria novo ID | proteção anti-fixation positiva; remoção antiga também suprime erro |
| logout | remove sessão atual e cookie | falha do banco deixa token válido (`AUTH-007`) |
| reset de senha | atualiza senha, limpa token e `deleteMany` de todas as sessões na mesma transação | positivo, sujeito à corrida de consumo (`AUTH-006`) |
| alteração autenticada de senha | não existe | não verificável |
| mudança de papel | papel é relido do User em cada requisição | despromoção passa a valer sem renovar cookie; corrida do último admin permanece |
| bloqueio de conta | `getCurrentUser` retorna nulo | sessão não é apagada; se reativada antes de expirar, o token antigo volta a funcionar |
| expiração | checada no acesso e sessão removida | positivo; não há job necessário para segurança imediata |

## 8. Testes existentes e lacunas

Cobertura observada, mas não executada nesta máquina:

- `tests/unit/access-control.test.ts`: papel cross-tenant, autoalteração e endereço de outro usuário;
- `tests/integration/route-protection.test.ts`: 401, token inválido, recursos admin A/B e listas tenant-scoped;
- `tests/unit/order-multitenant-isolation.test.ts`: filtros user+tenant e spoofing explícito no body;
- `tests/unit/password-recovery.test.ts`: entropia/expiração, resposta uniforme, reset e revogação de sessões;
- `tests/unit/profile-update.test.ts`: sessão, tenant e campos de perfil;
- `tests/unit/client-confirmation.test.ts`: ownership de entrega;
- `tests/unit/loyalty-routes.test.ts`: wallet autenticada e simulação guest simples;
- `tests/unit/supabase-storage.test.ts`: autenticação, role de `products`, MIME/tamanho e feature gate.

Lacunas — não tratadas como vulnerabilidades adicionais por si sós:

- nenhum teste cobre DTO público negativo para segredos de `Loja`;
- checkout guest não é testado contra e-mail de conta existente e pontos;
- reset não testa `Origin` hostil, tenant ausente ou duas submissões concorrentes;
- logout não injeta falha de revogação nem tenta reutilizar cookie copiado;
- A/B não inclui sessão de A reapresentada no host B;
- simulação de pontos não testa `userID` arbitrário/cross-tenant;
- papel não é testado com duas despromoções concorrentes;
- rate limit não é testado entre instâncias nem com cadeia de proxy;
- upload não testa bucket arbitrário;
- não há teste de verificação de e-mail ou troca autenticada porque esses fluxos não existem.

## 9. Itens não aplicáveis ou não verificados

- **JWT e refresh token — não aplicáveis:** não há emissão/validação JWT; sessão é opaca e stateful no banco.
- **OAuth/social login — não aplicável:** não foi encontrado provedor externo de identidade.
- **MFA — não implementado:** não foi inferido como requisito obrigatório, mas é recomendado para ADMIN como risco residual.
- **Verificação de e-mail — não implementada:** `emailVerified` existe no schema, mas cadastro cria `ACTIVE` e sessão imediatamente. Sem requisito de negócio explícito, isso é registrado como lacuna de garantia de identidade, não vulnerabilidade isolada; amplifica `AUTH-002`.
- **Alteração autenticada de senha — não implementada:** apenas reset por e-mail existe. Logo, não foi possível verificar exigência da senha atual nem invalidação específica desse fluxo.
- **CSRF — não confirmado:** não há token CSRF/origin check geral. Cookies `SameSite=Lax`, host-only, CSP `form-action 'self'` e predominância de JSON reduzem ataques cross-site clássicos; subdomínios/custom domains e endpoints sem body precisam de teste em navegador antes de concluir exploração.
- **Sessão real/produção — não verificada:** flags efetivas, proxy, HTTPS, domínios, escala e configuração de e-mail/storage não foram inspecionados externamente.
- **RLS/Supabase — não verificado:** o upload usa service role no servidor; políticas reais e buckets não foram consultados.

## 10. Dívida priorizada

1. Criar DTOs públicos mínimos e remover imediatamente credenciais das respostas (`AUTH-001`).
2. Separar guest de identidade autenticada e exigir sessão para PII/pontos (`AUTH-002`).
3. Corrigir URL/tenant, hash e consumo atômico do reset (`AUTH-003`, `AUTH-006`, `AUTH-009`).
4. Fechar BOLA de pontos e vincular toda sessão ao tenant do host (`AUTH-004`, `AUTH-005`).
5. Tornar revogação/logout e rate limit distribuídos e verificáveis (`AUTH-007`, `AUTH-008`).
6. Restringir ferramentas condicionais e privilégios administrativos (`AUTH-010`, `AUTH-011`, `AUTH-012`).
7. Revogar a credencial documentada, sanear sua exposição e impedir novos segredos no Git (`AUTH-015`).
8. Unificar política de senha e resposta de login (`AUTH-013`, `AUTH-014`).
9. Adicionar E2E/integração PostgreSQL para a matriz A/B e eventos de sessão.

## 11. Riscos residuais e verificações pendentes

Mesmo após as correções, permanecem riscos de sessão roubada, conta de e-mail comprometida, credential stuffing distribuído e erro operacional de tenant/domínio. Admins merecem step-up/MFA, alertas de novo login/mudança de senha/papel e capacidade de revogar dispositivos.

Verificações pendentes:

- instalar dependências em ambiente autorizado e executar unitários/integração/E2E;
- testar com PostgreSQL real as corridas de reset e último admin;
- executar matriz A/B por HTTP real, incluindo host A/B e cookie copiado;
- testar `Origin`/`Referer` hostil com provedor de e-mail fake, sem enviar mensagem externa;
- confirmar headers de IP confiáveis e comportamento multi-instância no deploy;
- validar configuração real de `Secure`, HTTPS, domínios e feature flags sem expor valores;
- inventariar/rotacionar credenciais que possam ter sido retornadas por endpoints públicos ou versionadas em documentação, e avaliar saneamento do histórico;
- decidir requisitos de verificação de e-mail, mudança autenticada, MFA e logout global;
- testar CSRF em navegador nos domínios reais/autorizados;
- revisar buckets/políticas de storage em ambiente de teste autorizado.

## 12. Conclusão

Os guards e filtros por objeto demonstram uma base razoável de autorização no servidor, e não foi confirmado um caminho direto de CUSTOMER para ADMIN. Porém, a segurança de identidade é anulada por exposição pública e versionada de segredos, associação guest por e-mail e reset com origem controlável, além de exceções cross-tenant e falhas de revogação/atomicidade. A etapa 05 termina com **0 BLOCKER, 3 CRITICAL, 10 HIGH e 2 MEDIUM**, mantendo a publicação bloqueada pelos achados destacados na seção executiva.
