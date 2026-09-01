Auditoria técnica completa — E-Commerce Pernambuco
Data da análise: 18 de agosto de 2026 Escopo: repositório local E-Commerce-Pernambuco-Prototipo-main Natureza: análise estática e diagnósticos locais seguros; nenhuma correção foi implementada Veredito: inadequado para produção Nota final: 22/100
Aviso urgente: foi encontrada uma credencial PostgreSQL/Supabase em claro em test_db_conn.js:20-21. O valor não é reproduzido neste relatório e não foi testado. Deve ser tratado como comprometido até prova em contrário.
1. Resumo executivo
O projeto demonstra um protótipo funcional e contém fundamentos úteis — Next.js App Router, Prisma, sessão persistida, modelo inicial de loja/tenant, transações em partes do fluxo de pedido e alguns testes de intenção. Entretanto, não oferece hoje uma fronteira de segurança confiável entre lojas. Um administrador de uma loja consegue listar usuários globais e promover uma conta controlada em outra loja; múltiplas APIs de pedidos, clientes e produtos operam por ID global; e o checkout público aceita do navegador tenant, usuário, preço, frete, Pix e itens.
Os três maiores riscos são:
Comprometimento de dados e takeover cross-tenant: as rotas de usuários, pedidos, clientes e produtos não aplicam lojaID de forma consistente.
Fraude e corrupção de negócio no checkout: valores e relacionamentos sensíveis são autoritativos no cliente, sem idempotência e sem controle de concorrência suficiente.
Comprometimento da infraestrutura: há credencial de banco em claro e Next.js 14.2.3 está fora de suporte e afetado por vulnerabilidades conhecidas, inclusive DoS remoto aplicável ao projeto.
As três maiores forças comprovadas são:
sessão com token aleatório de 256 bits, cookie HttpOnly, Secure em produção e SameSite=Lax;
uso predominante de Prisma estruturado, sem SQL bruto no código de produção examinado, com transações e trilha de status/auditoria em partes do domínio;
base multi-tenant já modelada (Loja, lojaID, slug e domínio), configuração standalone e implementações mais novas de algumas rotas já escopadas pela loja.
Decisão de prontidão: não publicar na internet, nem operar como SaaS compartilhado, antes de fechar os gates críticos da seção 15. Mesmo como instância de uma única loja, checkout, credenciais, dependências e revogação/abuso tornam o risco inaceitável. Após contenção, correções testadas e operação mínima, o próximo nível possível é protótipo demonstrável em ambiente isolado, não beta público.
2. Escopo, método e limitações
Escopo examinado
163 arquivos de fonte, testes, configuração e schema inventariados, excluindo node_modules, .next e templates como fontes primárias;
14 páginas App Router, 26 arquivos de Route Handler e 25 módulos cliente;
app/**, components/**, lib/**, services/**, store/**, prisma/**, tests/**;
package.json, lockfile, TypeScript, Next, middleware, documentação histórica e scripts auxiliares;
12 diretórios de migrations Prisma e 7 arquivos de teste;
fluxos de tenant, registro/login/sessão/logout, catálogo, carrinho, dois caminhos de checkout/pedido, frete, clientes, usuários, produtos e administração.
Método
inventário da árvore e busca de entradas externas, guards, consultas Prisma, relações tenant, segredos e configurações;
rastreamento ponta a ponta dos fluxos críticos;
revisão contra OWASP Top 10, OWASP API Security Top 10, práticas de Next.js, Prisma, PostgreSQL e Supabase;
cruzamento entre schema, migrations visíveis, padrões reais de consulta e testes;
execução de diagnósticos locais não destrutivos;
consulta, em 18/08/2026, de documentação e advisories primários atuais.
Limitações
O executável Git não está disponível e não há metadados .git acessíveis; não foi possível confirmar tracking, histórico ou mudanças preexistentes.
Nenhum .env foi aberto ou impresso. Nenhuma credencial foi testada.
Nenhum banco foi acessado; RLS, grants, Data API, volume, planos de execução, pooling real, backups e drift do banco vivo permanecem não verificados.
Não foram executados migrations, seeds, testes destrutivos, EXPLAIN ANALYZE, autofix ou atualização de dependência.
Infraestrutura externa, WAF, CI/CD, observabilidade e backups fora do repositório podem existir, mas não foram demonstrados.
npm run build gera artefatos normais de .next e Prisma Client; nenhuma fonte/configuração foi alterada.
Capacidade numérica não é estimada porque faltam concorrência, SKUs, pedidos/minuto, histórico, latência, consumo de memória e orçamento de conexões.
3. Mapa do sistema
Contexto e contêineres observados
flowchart LR
    U[Cliente ou administrador] -->|HTTP + Host + cookie| NX[Next.js App Router]
    NX --> MW[Middleware de /admin\nchecagem superficial]
    NX --> RSC[Layouts e Server Components]
    NX --> API[Route Handlers /api]
    RSC --> TEN[Resolver de tenant]
    API --> GUARD[Guards de sessão e role]
    RSC --> SVC[Serviços e Prisma direto]
    API --> SVC
    TEN --> PR[Prisma Client]
    GUARD --> PR
    SVC --> PR
    PR --> PG[(PostgreSQL hospedado no Supabase)]
    U -->|URL de contato| WA[WhatsApp]
    SB[Cliente Supabase SSR] -. sem consumidor encontrado .-> PG
O limite de confiança principal é a passagem navegador → Next. Host, IDs, preço, frete, usuário, tenant e status são dados não confiáveis. O limite tenant deveria existir antes de cada consulta/mutação, mas hoje está distribuído entre rotas e serviços, com implementações divergentes.
Fluxo de autenticação observado
sequenceDiagram
    participant B as Navegador
    participant A as /api/auth/login
    participant T as Resolver tenant
    participant DB as Prisma/PostgreSQL
    B->>A: email + senha + Host
    A->>T: resolve Host
    T->>DB: Loja por slug/domínio; fallback
    A->>DB: User por email + lojaID
    A->>DB: bcrypt compare
    A->>DB: cria Session com token aleatório
    A-->>B: session_id HttpOnly/Secure*/Lax
    B->>A: requisição autenticada
    A->>DB: Session + User + expiração/status
O middleware de /admin valida apenas presença/formato do cookie; o layout administrativo e os handlers fazem a verificação efetiva de sessão/role. Isso é aceitável como otimização, desde que o middleware nunca seja tratado como barreira de autorização.
Fluxo de checkout e tenant observado
sequenceDiagram
    participant B as Navegador
    participant UI as Página/CheckoutForm
    participant API as POST /api/checkout
    participant S as checkout.service
    participant DB as PostgreSQL
    UI->>UI: escolhe loja por NEXT_PUBLIC_LOJA_SLUG
    B->>API: lojaID, userId/email, itens, preços, frete e Pix
    API->>S: payload validado estruturalmente
    S->>S: subtotal = soma dos preços do cliente
    S->>DB: upsert/cria usuário e endereço
    S->>DB: cria pedido e itens no tenant recebido
    DB-->>B: pedido criado
Esse fluxo não usa a loja resolvida no servidor como autoridade e diverge do segundo fluxo POST /api/orders, que usa carrinho persistido. A duplicidade é causa raiz de regras incompatíveis.
Componentes e dependências
Componente
Responsabilidade atual
Observação
app/**
UI, Server Components e handlers
Há acesso direto a Prisma no admin e múltiplos contratos incompletos.
middleware.ts
Redirecionamento preliminar de /admin
Não valida sessão no banco nem role.
lib/session.ts
sessão própria no PostgreSQL
Stateless entre réplicas, mas token fica em claro no banco e PENDING é aceito.
lib/tenant.ts
tenant por host/slug/domínio e cache
Falha aberta para loja padrão/primeira loja.
services/** e lib/services/**
domínio/aplicação/persistência
Duas árvores com regras tenant distintas.
lib/prisma.ts
singleton Prisma
Boa base; um segundo cliente é criado no serviço de frete.
lib/supabase/server.ts
cliente Supabase SSR
Nenhum consumidor encontrado; Auth/Data API não participam do fluxo observado.
prisma/**
schema e migrations
Modelo compartilhado por lojaID, sem defesa tenant uniforme no banco.
tests/**
intenção unitária, integração e carga
Não coletam no estado atual por alias/configuração; tipos divergiram.
4. Fluxos críticos
Tenant
Host é lido em lib/tenant.ts:38, separado da porta e comparado com domínio de plataforma/Vercel ou com slug/customDomain. Host desconhecido recebe a loja padrão e, por último, findFirst() (lib/tenant.ts:69). O checkout, porém, carrega uma loja por variável pública global (app/checkout/page.tsx:17). Não existe um TenantContext obrigatório que reconcilie host, sessão, usuário, produto, carrinho e pedido.
Autenticação e autorização
O login normaliza e-mail e consulta a chave composta email_lojaID, compara bcrypt e cria sessão. A sessão é persistida e validada por expiração e status, mas apenas BLOCKED é rejeitado. Guards administrativos existem em duas versões. As rotas mais novas frequentemente passam session.user.lojaID; as legadas recebem apenas IDs globais, gerando BOLA/IDOR.
Catálogo e carrinho
A listagem pública usa o tenant do host, mas a homepage não passa limite: take fica undefined, todas as variantes são incluídas e todo o resultado é hidratado no HomeClient. Ao adicionar ao carrinho, preço é derivado do produto no servidor e produto/variante/estoque são conferidos — um controle positivo. Ainda assim, o schema não garante um único carrinho ACTIVE por usuário e updates concorrentes de quantidade não são atômicos.
Checkout e pedido
Há dois pipelines:
POST /api/checkout: público, cria/upserta cliente e usa valores e IDs fornecidos pelo cliente;
POST /api/orders: autenticado, lê carrinho e endereço persistidos, mas recebe lojaID do corpo e não possui idempotência.
No segundo pipeline, carrinho e status são lidos antes da transação e as mutações não condicionam o estado anterior. Chamadas concorrentes podem criar pedidos duplicados ou decrementar estoque mais de uma vez ao marcar PAID.
Perfil, endereço, clientes e configurações
POST /api/address/set-default não autentica, confia em userId e devolve o registro Prisma completo de User. Rotas legadas de clientes são globais; rotas administrativas mais novas são em geral escopadas. A configuração da loja é escopada pela sessão, porém customDomain não possui prova de domínio. O upload de avatar é apenas uma Server Action simulada, sem guarda interna.
5. Scorecard
Fórmula: nota final = Σ[peso × (nota/5)]. Um risco crítico de autenticação/tenant limita a prontidão independentemente da soma.
Dimensão
Peso
Nota (0–5)
Contribuição
Fundamentação
Arquitetura e separação
12%
1,8
4,3
Duas árvores de serviços, dois checkouts e framework/persistência atravessando camadas.
Segurança da aplicação
18%
0,8
2,9
Credencial em claro, checkout autoritativo no cliente, IDOR, abuso e dependência vulnerável.
Isolamento multi-tenant
15%
0,3
0,9
Takeover de role e operações globais confirmadas.
Banco e integridade
12%
1,5
3,6
Algumas FKs/transações, mas races, floats, constraints e índices insuficientes.
Escalabilidade/desempenho
10%
1,6
3,2
Catálogo e métricas não limitados, conexão/cache sem desenho horizontal comprovado.
Confiabilidade/resiliência
10%
1,2
2,4
Sem idempotência/outbox; falhas mascaradas; DR não demonstrado.
Qualidade/testes
8%
0,7
1,1
7 suítes não coletam e typecheck tem 39 erros; build isolado passa.
Observabilidade/operação
5%
0,5
0,5
Sem pipeline, SLI/SLO, tracing, health, alertas ou runbooks no repositório.
Manutenibilidade/DevEx
10%
1,4
2,8
strict: false, contratos divergentes e documentação desatualizada.
Total
100%
21,7 → 22/100
Teto adicional aplicado por riscos críticos tenant/auth.
6. Pontos fortes comprovados
lib/session.ts:8 gera 32 bytes aleatórios e configura cookie HttpOnly, Secure em produção, SameSite=Lax, expiração e Path=/.
O login usa bcrypt custo 10 e retorna projeção mínima (services/auth.service.ts:93).
O schema possui tenant explícito em entidades centrais, @@unique([email, lojaID]) e alguns índices (prisma/schema.prisma:36).
Criação de produto substitui tenant/autor pelo contexto da sessão; rotas administrativas mais novas de pedidos, clientes e frete aplicam lojaID.
O carrinho deriva o preço no servidor ao adicionar item e valida a relação produto/variante/estoque.
Há transações na criação de pedido e na atualização de status/estoque, allowlist de transição e trilha de histórico; são bons primitivos, embora incompletos para concorrência.
Não foram encontrados SQL bruto, dangerouslySetInnerHTML ou CORS permissivo no código de produção examinado.
unstable_cache recebe host/slug como argumento; os argumentos integram a chave. Não há evidência para acusar colisão cross-tenant apenas pela chave estática.
output: "standalone" é uma base útil para artefato imutável/container.
Existem testes que expressam a intenção correta de negar acesso A→B, mesmo que hoje não executem e o código viole essa intenção.
7. Findings priorizados
Tabela-resumo
ID
Severidade
Evidência
Título
Alcance
SEC-001
Crítico
Confirmado / alta
Credencial PostgreSQL/Supabase em claro
Todos os tenants/infra
TEN-001
Crítico
Confirmado / alta
Admin promove usuário de outro tenant e obtém takeover
Cross-tenant
TEN-002
Crítico
Confirmado / alta
BOLA/IDOR global em pedidos, clientes e produtos
Cross-tenant/LGPD
SEC-002
Crítico
Confirmado / alta
Checkout público confia em preço, frete, tenant, usuário e itens
Anônimo/cross-tenant
DB-001
Crítico
Confirmado / alta
Migrations não reproduzem o schema Prisma
Deploy/restore/dados
DB-004
Crítico
Hipótese / média
Data API Supabase pode expor schema public sem RLS
Acesso direto/todos
SEC-003
Alto
Confirmado / alta
Endereço anônimo altera usuário e devolve hash/tokens
Anônimo/cliente
SEC-004
Alto
Confirmado / alta
Next.js 14.2.3 fora de suporte e vulnerável a DoS aplicável
Anônimo/operação
SEC-005
Alto
Confirmado / alta
Registro/login/checkout permitem exposição e abuso sem limites
Anônimo/contas
DB-002
Alto
Confirmado / alta
Replay e corridas corrompem pedido, status e estoque
Negócio/operação
TEN-003
Alto
Confirmado / alta
Resolver tenant falha aberto e checkout usa slug global
Cross-tenant
ARC-001
Alto
Confirmado / alta
Serviços/guards e pipelines de pedido duplicados
Sistema inteiro
DB-003
Alto
Confirmado / alta
Schema não garante dinheiro, estoque e coerência tenant
Integridade
SCL-001
Alto
Confirmado / alta
Catálogo e agregações crescem sem limite útil
Disponibilidade/custo
SCL-002
Alto
Provável / média-alta
Pools Prisma e topologia serverless não controlados
Banco/operação
TST-001
Alto
Confirmado / alta
Testes não coletam e typecheck falha
Entrega
OPS-001
Alto
Confirmado no repo / alta
Sem CI/CD, observabilidade e DR demonstráveis
Operação
ARC-002
Médio
Confirmado / alta
Contratos UI/API incompletos e documentação divergente
Usuário/manutenção
SEC-006
Médio
Confirmado / alta
Sessão, Server Action, CSRF e headers precisam hardening
Conta/operação
SCL-003
Médio
Provável / média
Cache/invalidação não coordenados entre réplicas
Escala horizontal
SEC-001 — Credencial PostgreSQL/Supabase em claro
Severidade/status/confiança: Crítico; Confirmado; alta.
Evidência: test_db_conn.js:20 contém duas URLs de conexão direct/pooler com segredo embutido; .gitignore:1 não exclui esse script. O valor foi mascarado e não testado.
Pré-condição/cenário: acesso ao workspace, pacote, backup ou histórico que contenha o arquivo; o invasor tenta conexão direta, contornando toda autorização da aplicação.
Impacto/alcance: potencial leitura/escrita integral de PII, hashes, sessões, pedidos e dados de todos os tenants. Validade e presença em histórico não foram comprovadas.
Recomendação: rotacionar/revogar imediatamente, revisar logs, remover de árvore/histórico/artefatos, migrar para secret manager e impor secret scanning.
Esforço/dependências/regressão: P–M; acesso administrativo ao Supabase e backups/histórico; regressão média por troca coordenada.
Aceite: credencial antiga não autentica; scanner não encontra o segredo no estado atual ou histórico; runtime usa somente segredo injetado; logs do período são revisados.
TEN-001 — Promoção global de role permite takeover de outro tenant
Severidade/status/confiança: Crítico; Confirmado; alta.
Evidência: app/api/admin/users/route.ts:6 autentica admin, mas lista usuários sem tenant; services/admin.service.ts:137 consulta globalmente; services/user.service.ts:8 busca ator/alvo e services/user.service.ts:33 conta/altera admins sem lojaID.
Pré-condição/cenário: admin da loja A registra uma conta controlada na B, pesquisa seu e-mail globalmente e promove seu ID a ADMIN.
Impacto/alcance: takeover integral de B, incluindo PII, pedidos, catálogo, Pix e configurações; qualquer tenant.
Recomendação: tenant obrigatório na autorização e mutação; alvo e ator na mesma loja; filtro atômico {id, lojaID}; regra “último admin” por loja; resposta 404 para recurso fora do escopo.
Esforço/dependências/regressão: M; depende de contexto tenant e testes de matriz; regressão alta em administração de usuários.
Aceite: admin A não lista nem altera B; promoção A→B retorna 404 e não produz auditoria/mutação; último admin é calculado por tenant.
TEN-002 — BOLA/IDOR cross-tenant em pedidos, clientes e produtos
Severidade/status/confiança: Crítico; Confirmado; alta.
Evidência: admin de GET /api/orders passa undefined (app/api/orders/route.ts:50) e Prisma omite o filtro (services/order.service.ts:123); detalhe/status operam por ID global (services/order.service.ts:184, services/order.service.ts:204); clientes legados são globais (services/customer.service.ts:5); produto update/delete usa apenas ID (services/product.service.ts:67). O comportamento de undefined está documentado pelo Prisma.
Pré-condição/cenário: admin A obtém IDs pela listagem global ou catálogo público, lê PII/pedidos de B e altera status/estoque ou edita/exclui produto de B.
Impacto/alcance: violação cross-tenant e LGPD, fraude operacional, destruição de catálogo/estoque.
Recomendação: remover rotas legadas; todos os casos de uso administrativos exigirem tenant; consultas e mutações compostas/atômicas; defesa adicional no banco.
Esforço/dependências/regressão: G; depende de ARC-001 e revisão completa de rotas; regressão alta.
Aceite: matriz por rota e método testa A→B e exige 404 sem efeitos; nenhuma assinatura administrativa consulta/muta somente por ID global.
SEC-002 — Checkout público confia integralmente no cliente
Severidade/status/confiança: Crítico; Confirmado; alta.
Evidência: endpoint sem guarda em app/api/checkout/route.ts:7; validator aceita lojaID, userId, preços, frete e Pix em lib/validators/checkout.validators.ts:3; subtotal deriva dos preços recebidos e relações arbitrárias são conectadas em lib/services/checkout.service.ts:55; a UI envia esses campos em components/checkout/CheckoutForm.tsx:153.
Pré-condição/cenário: anônimo chama diretamente a API com item de R$ 0,01, frete zero, tenant/usuário de vítima, produto inexistente/cross-tenant e repete o payload.
Impacto/alcance: fraude de preço/frete, account squatting com senha vazia, pedidos/endereço em vítima, cross-tenant write, spam/DoS de banco e estoque sem confiabilidade.
Recomendação: servidor resolve tenant; receber apenas IDs e quantidades; reler produto/variante/preço/frete/Pix; identidade da sessão ou guest explícito; coerência tenant; transação, reserva de estoque, idempotência, quotas e rate limiting.
Esforço/dependências/regressão: G; depende de pipeline único de pedido e constraints; regressão alta no checkout.
Aceite: adulterar preço/frete/Pix/user/loja não muda persistência; produto cross-tenant dá 404; estoque insuficiente dá 409; replay cria exatamente um pedido; guest não cria senha vazia.
DB-001 — Migrations não reproduzem o schema Prisma
Severidade/status/confiança: Crítico (bloqueador de produção); Confirmado; alta.
Evidência: Loja.primaryColor, secondaryColor, customDomain e Product.galleryUrls existem no schema:27 e schema:95, mas não nas migrations. Order.addressID é opcional no schema:208, porém nasce NOT NULL em 20260511165055_role_enum_add_schema/migration.sql:11. OrderItem.productId é opcional no schema:232, porém permanece obrigatório em 20260513203715_/migration.sql:53. Há ainda drops/recriações com perda potencial de dados nas migrations de 13/05/2026.
Pré-condição/cenário: ambiente vazio ou recuperação de desastre executa apenas migrations; Prisma Client espera colunas/nulabilidade diferentes, produzindo falha de query ou inserção. Em upgrade com dados, migrations destrutivas podem perder colunas/dados.
Impacto/alcance: deploy e restore não reprodutíveis; indisponibilidade e possível perda de dados.
Recomendação: estabelecer baseline verificável e estratégia expand/backfill/contract; testar replay em banco efêmero e comparar schema resultante; nunca editar migration já aplicada sem plano de reconciliação.
Esforço/dependências/regressão: M–G; exige inventário do banco vivo e histórico aplicado; regressão alta.
Aceite: banco vazio aplica todas as migrations; prisma migrate diff não aponta diferença contra o schema esperado; upgrade sobre snapshot anonimizado preserva dados e rollback/forward-fix é ensaiado.
DB-004 — Supabase Data API pode expor tabelas sem RLS
Severidade/status/confiança: Crítico; Hipótese a validar; média.
Evidência: a hospedagem Supabase é indicada pela credencial encontrada; o cliente com publishable key existe em lib/supabase/server.ts:9, embora não tenha consumidor encontrado; nenhuma migration contém ENABLE ROW LEVEL SECURITY, POLICY, GRANT ou REVOKE.
Pré-condição/cenário: Data API ativa e schema public exposto com grants padrão; papel anon/authenticated consulta ou altera tabelas diretamente, sem passar por guards Next. A condição do banco vivo não foi inspecionada.
Impacto/alcance: potencial acesso direto a User.password, Session.id, endereços, pedidos e todas as lojas.
Recomendação: com credencial administrativa legítima — nunca a exposta — auditar schemas da Data API, relrowsecurity, pg_policies, grants e rolbypassrls; se apenas Prisma é usado, desabilitar Data API ou mover tabelas privadas/revogar grants; se a API for usada, implementar RLS e testes.
Esforço/dependências/regressão: M; acesso ao projeto Supabase e decisão arquitetural; regressão média/alta.
Aceite: anon e authenticated não leem/escrevem tabelas privadas; hash/sessão nunca ficam em schema exposto; papel Prisma e eventual bypass RLS são documentados. A documentação oficial do Supabase descreve grants e proteção da Data API.
SEC-003 — Endpoint anônimo de endereço altera usuário e devolve dados sensíveis
Severidade/status/confiança: Alto; Confirmado; alta.
Evidência: app/api/address/set-default/route.ts:3 recebe userId/addressId sem autenticação; services/address.service.ts:12 retorna prisma.user.update sem select, incluindo escalares como password, resetToken e PII.
Pré-condição/cenário: atacante obtém IDs pelas APIs globais e altera o endereço padrão da vítima; a resposta fornece o registro completo.
Impacto/alcance: alteração de conta e exposição de hash/token/PII; clientes de qualquer loja.
Recomendação: exigir sessão, ignorar userId do corpo, validar o endereço contra usuário e tenant da sessão e retornar DTO mínimo.
Esforço/dependências/regressão: P; guard canônico; regressão baixa.
Aceite: anônimo recebe 401; A não altera B; resposta contém apenas sucesso/ID e nunca password ou tokens.
SEC-004 — Next.js 14.2.3 está fora de suporte e vulnerável
Severidade/status/confiança: Alto; Confirmado; alta.
Evidência: package.json:28 e lockfile fixam next@14.2.3; há App Router e uma Server Action real em app/profile/actions.ts:1. O GHSA-m99w-x7hq-7vfj/CVE-2026-64641 afeta >=13.0.0 <15.5.21 quando App Router possui Server Action e permite DoS de CPU remoto. A política oficial já não dá suporte à linha 14.
Pré-condição/cenário: anônimo envia requisição artesanal ao protocolo de Server Action e bloqueia o processo. Outros advisories diretos/transitivos também foram reportados pelo npm audit.
Impacto/alcance: indisponibilidade e superfície conhecida sem backport atual.
Recomendação: planejar migração para uma linha suportada e corrigida — ao menos 15.5.21 ou 16.2.11 para o advisory citado; preferir a Active LTS após teste de compatibilidade. 14.2.35 corrige advisories antigos, mas não é suficiente para julho/2026.
Esforço/dependências/regressão: M–G; migração Next/React e testes; regressão alta.
Aceite: versão/lockfile fora de todas as faixas aplicáveis; npm audit --omit=dev sem bloqueadores; teste de regressão/abuso e build completos verdes.
SEC-005 — Registro, login e checkout expõem dados e permitem abuso sem limites
Severidade/status/confiança: Alto; Confirmado no app; alta. WAF externo não foi demonstrado.
Evidência: registro devolve o objeto Prisma com hash em app/api/auth/register/route.ts:16 e services/auth.service.ts:55; checkout aceita arrays/strings sem máximos; login/registro/checkout não possuem rate limiter. O dummy hash de inexistente em services/auth.service.ts:115 não tem formato bcrypt válido, e usuário bloqueado recebe mensagem distinta antes da comparação (services/auth.service.ts:121). Senha mínima é seis caracteres.
Pré-condição/cenário: password spraying/credential stuffing e medição distinguem contas; atacante cria payloads grandes e repetidos; respostas revelam hash e erros internos.
Impacto/alcance: takeover, enumeração, cracking offline, CPU/banco esgotados e exposição de detalhes.
Recomendação: DTOs/select explícitos; erros uniformes; dummy hash válido do mesmo custo; rate limiting distribuído por IP+conta+tenant, limites de corpo/array/string, política de senha e alertas.
Esforço/dependências/regressão: M; store distribuído/WAF e observabilidade; regressão média.
Aceite: nenhum response inclui hashes/tokens; rajadas recebem 429; payload excessivo falha antes do banco; conta inexistente/bloqueada produz resposta e custo equivalentes.
DB-002 — Replay e corridas corrompem pedido, status e estoque
Severidade/status/confiança: Alto; Confirmado; alta.
Evidência: carrinho é lido antes e concluído sem condição de estado em services/order.service.ts:17 e services/order.service.ts:84. Pedido/status/estoque são lidos fora da transação (services/order.service.ts:207); update de status não condiciona o valor anterior (services/order.service.ts:266). Cancelamento pode repor estoque repetidamente.
Pré-condição/cenário: duas requisições simultâneas criam dois pedidos do carrinho; duas transições PENDING→PAID decrementam duas vezes; transições conflitantes produzem estado/estoque incoerentes.
Impacto/alcance: duplicidade, overselling/underselling, fraude e auditoria inconsistente.
Recomendação: idempotency key única; compare-and-set por {id,status,lojaID}; leitura/validação/escrita na mesma transação; isolamento/retry definidos; reserva de estoque com expiração quando pagamento for integrado.
Esforço/dependências/regressão: G; pipeline de pedido único e constraints; regressão alta.
Aceite: 20 chamadas concorrentes resultam em um pedido, uma transição e uma mutação de estoque; concorrentes perdedores recebem resposta determinística.
TEN-003 — Resolver tenant falha aberto e checkout usa slug global
Severidade/status/confiança: Alto; Confirmado; alta.
Evidência: host desconhecido cai na loja padrão e depois na primeira linha em lib/tenant.ts:69; não há normalização/allowlist completa; checkout usa NEXT_PUBLIC_LOJA_SLUG em app/checkout/page.tsx:17; domínio customizado é aceito sem desafio de propriedade.
Pré-condição/cenário: host inválido ou deploy multi-tenant mostra/usa loja padrão; checkout aberto em B carrega tenant/Pix A; domínio não verificado pode causar confusão/phishing.
Impacto/alcance: pedido e pagamento atribuídos à loja errada, vazamento e fraude entre tenants.
Recomendação: host canônico validado em proxy confiável; fail-closed/404 em produção; TenantContext único reconciliado com sessão; remover slug global; verificação DNS/HTTP de domínio.
Esforço/dependências/regressão: M; configuração de DNS/plataforma; regressão média.
Aceite: host desconhecido/caixa alta/trailing dot/cabeçalhos conflitantes não seleciona loja; checkout de B só persiste B; domínio não verificado não ativa.
ARC-001 — Serviços, guards e pipelines de pedido duplicados
Severidade/status/confiança: Alto; Confirmado; alta.
Evidência: services/order.service.ts busca detalhe global, enquanto lib/services/order.service.ts:156 exige tenant; há duas implementações de cliente e dois guards (lib/auth-admin.ts:5, lib/auth/guards.ts:11). /api/checkout e /api/orders criam pedidos com invariantes distintas.
Pré-condição/cenário: correção aplicada à implementação segura não protege a rota que importa a versão legada; comportamento depende do import escolhido.
Impacto/alcance: falhas tenant persistentes, contratos divergentes, custo de mudança e regressão sistêmica.
Recomendação: modular monolith por domínio; um caso de uso/contrato por operação; adapters Next finos; desativação programada de rotas legadas; guard/envelope/erro únicos.
Esforço/dependências/regressão: G; inventário rota→serviço e migração incremental; regressão alta.
Aceite: grafo de imports contém uma implementação canônica; todas as rotas passam a mesma suíte de contrato e tenant.
DB-003 — Schema não garante invariantes monetárias, tenant e acesso eficiente
Severidade/status/confiança: Alto; Confirmado; alta.
Evidência: Order.userID, addressID e lojaID são FKs independentes (schema:203); produto também separa autor/loja. Não há checks para estoque, quantidade, preços/total não negativos ou total=subtotal+frete. Produto/carrinho usam Float (schema:93, schema:132, schema:150), enquanto pedido usa Decimal. @@unique([orderId,productId]) impede duas variantes do mesmo produto; falta unicidade produto+tamanho+cor e carrinho ativo. Order não declara índices, embora consultas filtrem/ordenem por loja/status/usuário/data.
Pré-condição/cenário: app ou falha de autorização combina relações de lojas distintas, persiste negativos/arredondamento, cria carrinhos concorrentes ou sofre scans crescentes.
Impacto/alcance: corrupção silenciosa, pedidos legítimos rejeitados, inconsistência monetária e degradação de banco.
Recomendação: modelar dinheiro em Decimal com precisão; checks; chaves/constraints tenant-aware ou triggers bem testadas; uniques corretas; alinhar índices às queries reais e validar em staging. Candidatos: Order(lojaID,status,createdAt,id), Order(userID,createdAt,id), Product(lojaID,createdAt,id), Cart(userID,status) e índices de FKs ausentes.
Esforço/dependências/regressão: G; limpeza/backfill e DB-001; regressão alta.
Aceite: banco rejeita combinações cross-tenant/negativos; duas variantes são aceitas; só há um carrinho ativo; planos medidos usam índices sob volumes representativos.
SCL-001 — Catálogo e agregações crescem sem limite útil
Severidade/status/confiança: Alto; Confirmado; alta.
Evidência: homepage chama produtos sem limit (app/page.tsx:13); take vira undefined e inclui variantes (services/product.service.ts:3); tudo é serializado ao Client Component. Clientes/métricas carregam todo o histórico e agregam/ordenam em JS (lib/services/customer.service.ts:77, lib/services/customer.service.ts:184). A UI de pedidos não consome cursor corretamente.
Pré-condição/cenário: mais SKUs/variantes/histórico aumentam consulta, payload RSC, memória e hidratação em proporção ao total; filtros client-side cobrem apenas primeira página em algumas telas.
Impacto/alcance: p95/p99 crescentes, memória, transferência e indisponibilidade/custo.
Recomendação: projeção de card e cursor estável (createdAt,id), busca/filtros no servidor, detalhe sob demanda, agregações SQL/read model e cache público por tenant.
Esforço/dependências/regressão: M; índices e contratos UI; regressão média.
Aceite: número de linhas/payload por request permanece limitado ao multiplicar catálogo/histórico; filtros cobrem o conjunto completo; p95 é medido por faixa de volume.
SCL-002 — Pools Prisma e topologia serverless não controlados
Severidade/status/confiança: Alto; cliente duplicado Confirmado; exaustão Provável; média-alta.
Evidência: singleton principal em lib/prisma.ts:3, mas lib/services/freight.service.ts:1 cria outro PrismaClient. O schema separa DATABASE_URL e DIRECT_URL, mas a configuração não foi inspecionada; prisma validate falhou por DIRECT_URL ausente.
Pré-condição/cenário: réplicas/funções quentes × clientes por processo × pool por cliente excedem max_connections.
Impacto/alcance: timeouts e indisponibilidade de todos os tenants.
Recomendação: uma fábrica singleton; runtime por transaction pooler e conexão direta só para migrations; limites/timeouts explícitos; medir pg_stat_activity e saturação. O Supabase recomenda pooler para clientes temporários/serverless.
Esforço/dependências/regressão: P–M; dados reais de deploy; regressão média.
Aceite: nenhuma criação fora da fábrica; teste de carga mantém conexões sob orçamento instâncias × pools × connection_limit; alertas antes da saturação.
TST-001 — Testes não executam, divergem do código e podem apagar banco indevido
Severidade/status/confiança: Alto; Confirmado; alta.
Evidência: 7 arquivos/80 blocos it, mas vitest falha nos 7 antes da coleta por alias @; não há config nem script test. Typecheck encontra 39 erros de fixtures/contratos. tests/setup/db.ts:128 executa deleteMany({}) global após apenas verificar se DATABASE_URL existe. Seeds referenciam loja/produto inexistentes; o “load test” comum tenta 1.000 clientes/5.000 pedidos e gera e-mails duplicados.
Pré-condição/cenário: CI não roda testes; ou, após corrigir alias, a suíte aponta para staging/produção e apaga dados.
Impacto/alcance: falsa confiança, regressões críticas e risco operacional destrutivo.
Recomendação: TEST_DATABASE_URL descartável e allowlist rígida; unit/integration/load separados; config alias; fixtures alinhadas; scripts CI não interativos; remover cleanup global em banco compartilhável.
Esforço/dependências/regressão: M–G; banco efêmero e contratos canônicos; regressão baixa no runtime, alta no harness.
Aceite: npm test coleta tudo e retorna 0; suíte recusa host/database fora da allowlist; typecheck verde; testes A/B, checkout manipulado, concorrência e migration replay obrigatórios.
OPS-001 — Entrega, observabilidade e recuperação não são demonstráveis
Severidade/status/confiança: Alto; Confirmado no repositório; alta.
Evidência: package.json:5 oferece apenas dev/build/start/lint; não há workflow CI/CD, container, health/readiness, migration job, tracing, métricas, SLO, alertas ou runbooks encontrados. Lint abre prompt interativo; strict está desativado. Falhas de infraestrutura são capturadas e convertidas em null/vazio, como lib/tenant.ts:82.
Pré-condição/cenário: deploy/migration/falha de DB ocorre sem gate, telemetria ou rollback/restore exercitado; erro aparece como “loja não encontrada” ou lista vazia.
Impacto/alcance: detecção e recuperação lentas, deploy inconsistente e perda de dados/receita.
Recomendação: CI imutável com lint/typecheck/test/build/audit/migration replay; migration job expand/contract; readiness/liveness; logs estruturados com request/tenant/order ID e redaction; tracing, métricas, SLO, alertas, backups e restore drill.
Esforço/dependências/regressão: G; plataforma e ownership operacional; regressão baixa no domínio.
Aceite: pipeline bloqueia regressão; deploy canário/rolling e rollback ensaiados; restore cronometrado; sintéticos de catálogo/login/checkout alertam.
ARC-002 — Contratos UI/API e documentação estão incompletos/divergentes
Severidade/status/confiança: Médio; Confirmado; alta.
Evidência: UI chama PATCH/DELETE de frete por ID sem handler correspondente; drawer chama /notes e /tracking ausentes; listagem fabrica número/data/defaults que a API não envia; app/profile/actions.ts:5 simula upload e retorna sucesso. ROADMAP.md cita PaymentIntent/stockQuantity ausentes e documento antigo contradiz o resolver atual.
Pré-condição/cenário: usuário usa recurso exibido e recebe 404 ou sucesso falso; planejadores assumem componente inexistente.
Impacto/alcance: UX quebrada, retrabalho e decisões arquiteturais erradas.
Recomendação: contratos compartilhados, testes route↔consumer, ocultar features incompletas, C4/ADRs vivos e tabela implementado/planejado.
Esforço/dependências/regressão: M; consolidação ARC-001; regressão média.
Aceite: toda URL emitida possui handler testado; nenhum campo de domínio é inventado; documentação é validada na entrega.
SEC-006 — Hardening de sessão, Server Action, CSRF e headers
Severidade/status/confiança: Médio; Confirmado; alta para ausências; exploração depende do ambiente.
Evidência: PENDING é aceito e logout apaga cookie mesmo se revogação falhar (lib/session.ts:28, lib/session.ts:69); token bearer fica em claro por sete dias; Server Action de avatar não autentica internamente; não há validação explícita de Origin/CSRF ou security headers em next.config.js:2.
Pré-condição/cenário: cópia de token continua utilizável; action ID é repetido; origem sibling same-site ou configuração de borda fraca alcança mutações.
Impacto/alcance: abuso de conta/recursos e redução de defesa em profundidade.
Recomendação: somente ACTIVE; revogar sessões em bloqueio/troca de senha; hash de token em repouso; guarda dentro de Server Action; validar Origin/Referer e adotar CSP/HSTS/frame-ancestors/nosniff/Referrer/Permissions Policy na aplicação ou borda.
Esforço/dependências/regressão: M; edge/proxy e fluxo de sessão; regressão média.
Aceite: PENDING/BLOCKED sempre falham; dump não contém bearer reutilizável; anônimo falha antes de processar action; testes verificam Origin e headers em deploy.
SCL-003 — Cache e invalidação não coordenados entre réplicas
Severidade/status/confiança: Médio; Provável; média.
Evidência: cache de tenant usa TTL de cinco minutos e tag global (lib/tenant.ts:7); alteração invalida tenant-settings globalmente; não há cacheHandler compartilhado/configuração de coordenação em next.config.js:2.
Pré-condição/cenário: self-hosting com múltiplas réplicas; invalidação local não alcança outras, enquanto tag global causa expulsão de todas as lojas.
Impacto/alcance: configuração obsoleta, herd de consultas e inconsistência temporária. Não há evidência de colisão de chave por tenant: argumentos compõem a chave.
Recomendação: tags por tenant/domínio e backend compartilhado quando a plataforma não coordenar cache; confirmar garantias do provedor e versionar deploy.
Esforço/dependências/regressão: M; topologia de deploy; regressão média.
Aceite: teste com duas réplicas observa atualização dentro do SLO apenas no tenant alterado, sem pico global de misses.
8. Threat model e segurança
Ativos e atores
Ativo
Consequência de comprometimento
Credencial PostgreSQL e configuração Supabase
Bypass completo da aplicação e acesso a todos os tenants.
IDs de sessão e hashes de senha
Sequestro de sessão e cracking offline.
PII: nome, e-mail, telefone e endereço
Incidente LGPD, fraude e dano reputacional.
Roles, tenant/domínio e configuração Pix
Takeover de loja, desvio/confusão de pagamento e phishing.
Catálogo, preços, frete, pedidos e estoque
Fraude, perda de receita e operação inconsistente.
Disponibilidade de Next/PostgreSQL
Interrupção simultânea de storefronts e administração.
Atores prioritários:
anônimo: checkout, endereço, registro/login, Server Actions e DoS de framework;
cliente autenticado: IDs/tenant arbitrários em carrinho/pedido e PII própria/alheia;
admin malicioso ou comprometido de outra loja: listagem global, promoção de role e BOLA;
portador de cookie roubado: sessão reutilizável por até sete dias e revogação incompleta;
consumidor direto da Data API: risco condicionado a grants/RLS;
pessoa com acesso a código/backup: credencial hardcoded;
proxy/cliente capaz de influenciar Host: seleção/confusão de tenant, conforme a borda.
Matriz resumida de autorização
Superfície
Autenticação
Tenant efetivo
Avaliação
login/registro
Anônimo
Host com fallback
Host desconhecido é fail-open.
/api/cart
Usuário
Dono do carrinho; validações parciais
Melhor que checkout, mas não é fluxo canônico.
/api/checkout
Nenhuma
lojaID do corpo
Crítico.
/api/address/set-default
Nenhuma
userId do corpo
Alto/crítico na cadeia.
GET /api/products
Público
Host
Escopado, salvo fallback.
GET/PUT/DELETE /api/products/:id
GET público; mutações admin
ID global
Leitura global; mutações cross-tenant.
/api/orders e /api/orders/:id
Usuário/admin
cliente próprio; admin global/tenant do corpo
Cross-tenant.
GET /api/admin/orders
Admin
sessão
Adequado na listagem nova.
/api/admin/orders/:id/**
Admin
ID global
Cross-tenant.
/api/customers/**
Admin
Global
Cross-tenant/PII.
/api/admin/customers/**
Admin
Em geral sessão
Melhor, mas deve ser uniformizado.
/api/admin/users e role
Admin
Global
Takeover cross-tenant.
/api/loja/settings
Admin
sessão
Domínio sem prova de posse.
avatar Server Action
Sem guarda interna
Nenhum
Abuso hoje e risco futuro.
Cadeias de ataque prioritárias
Takeover tenant: admin A → listagem global de usuários → cria/localiza conta própria em B → promove role sem comparar lojas → autentica como admin B → acessa dados/configurações. O caminho é totalmente demonstrável pelo código.
Fraude anônima: atacante chama checkout → escolhe tenant/vítima/produto → define preço e frete → repete requisição → cria pedidos e relações inconsistentes sem baixa confiável de estoque.
Comprometimento fora da aplicação: pessoa obtém test_db_conn.js → tenta conexão PostgreSQL → se segredo ainda válido, guards, cookies e tenant são irrelevantes. A validade não foi testada.
Exposição Data API: se public estiver exposto e sem RLS/grants restritivos → chave pública/anon consulta tabelas → PII/hashes/sessões ficam fora do controle Prisma. Este caminho é condicional ao estado vivo.
Controles existentes e risco residual
Token/cookie/bcrypt são controles positivos, mas não compensam autorização cross-tenant.
Prisma reduz risco de SQL injection; não reduz BOLA, mass assignment ou regras de negócio incorretas.
SameSite=Lax reduz CSRF cross-site comum, mas não substitui verificação de origem em mutações sensíveis e pode não cobrir sibling subdomains same-site.
Não há CORS permissivo explícito nem dangerouslySetInnerHTML encontrado; XSS/injection não são findings confirmados nesta revisão.
Headers de segurança, CSP e clickjacking podem existir na borda, mas não foram demonstrados no repositório. São hardening, não exploração confirmada.
Pix pode ser CPF/CNPJ e é exposto por endpoint público; preferir chave aleatória, minimização e base legal. Não há fluxo demonstrado de acesso, exportação, anonimização, retenção ou exclusão LGPD.
x-forwarded-for é aceito em auditoria; só deve ser confiado se o proxy sobrescrever/pinar esse header.
Referenciais usados: OWASP Top 10, OWASP API Security Top 10 e OWASP ASVS. Eles orientaram a cobertura; a severidade deriva dos caminhos concretos acima.
9. Banco, Prisma, Supabase e isolamento multi-tenant
Estado do modelo e das migrations
Tema
Estado observado
Risco/ação
Reprodutibilidade
Migrations divergem do schema em colunas e nulabilidade.
Bloqueia deploy/restore; replay + diff obrigatório.
Tenant
lojaID existe, mas relações usam FKs independentes.
Banco aceita usuário/endereço/produto de outra loja.
Dinheiro
Produto/carrinho em Float; pedido em Decimal(10,2); frete sem precisão explícita.
Padronizar Decimal e regra de arredondamento.
Estoque/quantidade
Sem CHECK de não negativo.
Banco não impede estado inválido.
Total
Sem constraint/coerência subtotal + frete.
Aplicação comprometida persiste total incoerente.
Role
Campo String; enum Prisma/PostgreSQL órfão.
Papel arbitrário e drift de tipos/testes.
Carrinho ativo
findFirst + create, sem unique parcial.
Corrida cria vários ativos.
Item de pedido
Unique por (orderId, productId).
Duas variantes do mesmo produto colidem.
Variante
Sem unique (ProductID,size,color).
Duplicidade de combinação.
Address.orderId
Campo unique sem relação e não usado no fluxo.
Dívida/drift de modelo.
Migrations históricas
Colunas obrigatórias sem default e drop/recriação.
Precisa expand/backfill/contract e teste sobre snapshot.
Índices alinhados às queries
A migration final remove índices de Order.userID, status e addressID, e o modelo Order não declara índices. Consultas reais filtram por lojaID, status, userID e ordenam por createdAt. Também faltam índices explícitos para algumas FKs, como OrderItem.productVariantsId e OrderStatusHistory.performedById.
Candidatos a validar, não aplicar cegamente:
Order(lojaID, createdAt DESC, id);
Order(lojaID, status, createdAt DESC, id);
Order(userID, createdAt DESC, id);
User(lojaID, role, createdAt DESC, id);
Product(lojaID, createdAt DESC, id);
Cart(userID, status) e Session(expiresAt);
índices das FKs efetivamente usadas em joins/deletes.
A aprovação deve usar pg_stat_statements, cardinalidade e EXPLAIN (ANALYZE, BUFFERS) somente em staging representativo, nunca inventar ganho a partir de inspeção estática. Índices redundantes/a mais aumentam custo de escrita.
Transações, locks e idempotência
As transações atuais são bons primitivos, mas os reads/validadores de carrinho/status ficam fora delas e updates não verificam o estado anterior. A arquitetura-alvo deve:
receber uma idempotency key com unique por operação/tenant;
aplicar compare-and-set de status dentro da transação;
atualizar estoque atomicamente e registrar evento/outbox na mesma transação;
manter transações curtas, sem chamadas a WhatsApp, pagamento ou rede;
fazer retry limitado apenas para erros transitórios/serialização, com backoff e idempotência.
Supabase e RLS
O fluxo ativo é Prisma → PostgreSQL; não há evidência de Supabase Auth ou cliente Data API sendo consumido. Logo, a presença dos pacotes não constitui controle de segurança. A documentação do Supabase diferencia proteção da Data API e conexão direta. Pontos a validar no projeto vivo:
schemas expostos na API;
pg_class.relrowsecurity, pg_policies e grants de anon/authenticated;
owner, rolbypassrls e papel do runtime Prisma;
views/funções e security_invoker/security definer;
se Data API não é usada, desabilitá-la ou manter tabelas privadas fora do schema exposto.
RLS é defesa em profundidade, não substituto de TenantContext no app. Um papel owner/bypass pode ignorá-la; isso precisa ser decisão explícita e testada.
Conexões e operação PostgreSQL
Separar DATABASE_URL de runtime e DIRECT_URL de migrations é uma boa intenção, mas DIRECT_URL estava ausente no diagnóstico e não há prova de pooler. Orçamento a medir:
conexões máximas aproximadas = processos/funções simultâneos × PrismaClients por processo × connection_limit
O segundo PrismaClient do frete aumenta esse produto. Devem ser medidos pg_stat_activity, espera de pool, timeouts, slow queries, deadlocks, bloat e vacuum/analyze. Backups gerenciados não bastam sem restore testado; o modelo de responsabilidade compartilhada do Supabase mantém configuração, segurança e práticas da aplicação sob responsabilidade do cliente.
10. Escalabilidade e resiliência
Situação atual
Aplicação: sessão em PostgreSQL permite múltiplas réplicas sem sticky session. Entretanto, storefront é dinâmico por headers()/cookies, há waterfalls cliente e cache/invalidação não têm coordenação demonstrada.
Banco: catálogo e agregações crescem com o total; índices e pooling não estão alinhados/provados; um único banco compartilhado amplifica noisy neighbor.
Pedidos: sem idempotência, fila/outbox ou reserva explícita; retry/replay é perigoso.
Integrações: WhatsApp é URL; pagamento/webhook real ainda não existe. Não há timeout/retry/circuit breaker demonstrados.
Operação: não há SLI/SLO, tracing, alertas, health, restore ou deploy sem downtime demonstrados.
Variáveis e sinais a coletar
Não há base para declarar “suporta N usuários”. Medir, por tenant e globalmente:
requisições/s, usuários concorrentes, pedidos/minuto e taxa de replay;
SKUs, variantes/SKU, bytes por card/página e cache hit ratio;
p50/p95/p99 e erro por rota, especialmente tenant/login/catálogo/checkout;
queries/request, linhas lidas/retornadas, slow queries, locks/deadlocks;
conexões ativas/esperando versus limite; CPU/memória de app e banco;
tamanho/crescimento de Order, OrderItem, Session e AuditLog;
taxa de falha de provedores, backlog/idade de filas e tempo de restore.
Fórmulas úteis para capacity planning:
payload do catálogo ≈ produtos por página × (campos do card + variantes/imagens incluídas);
pressão de conexão ≈ réplicas quentes × clientes Prisma × pool por cliente;
escrita de pedido ≈ pedidos/min × (pedido + itens médios + histórico + outbox + estoque).
Essas fórmulas devem receber medições reais e margem de segurança; nenhum número foi presumido.
Cenários qualitativos
Escala
Comportamento provável atual
Condições para operar
1 loja
Demonstração com catálogo pequeno pode parecer funcional; vulnerabilidades e migrations continuam bloqueadoras.
Ambiente isolado, dados fictícios, sem exposição pública, após retirar credencial.
10 lojas
SaaS compartilhado amplia o risco de filtros manuais; multi-instância reduz blast radius, mas multiplica deploy/backup.
Automação/IaC, tenant fail-closed, pipeline único de pedido, CI e pooler.
100 lojas
Catálogo/admin, pools e cache tornam-se gargalos; noisy neighbor surge.
Contexto tenant obrigatório + RLS/defesa, paginação/agregação, cache distribuído, quotas, observabilidade e outbox/workers.
1.000 lojas
Um hot tenant pode afetar todos; relatórios e histórico pressionam banco; operação manual não escala.
Quotas/rate limit por tenant, projeções, workers, capacidade do DB, opção de tenant dedicado. Read replicas/particionamento apenas após métricas.
Resiliência recomendada
idempotência e outbox transacional antes de webhooks/pagamentos/notificações;
worker com retry exponencial, jitter, dead-letter e deduplicação;
timeout e circuit breaker por provedor; nunca segurar transação durante I/O externo;
cache público por tenant e CDN de mídia; origem da verdade permanece PostgreSQL;
readiness dependente do essencial, liveness simples e graceful shutdown;
deploy expand/contract, canário/rolling e rollback/forward-fix ensaiado;
RPO/RTO definidos, backup verificado e restore periódico;
quotas para checkout/login/relatórios e isolamento/dedicação para hot tenants baseado em telemetria.
11. Qualidade, testes, CI/CD e observabilidade
Diagnósticos locais
Diagnóstico
Resultado
Interpretação
npx prisma validate
exit 1: DIRECT_URL ausente
Validação não concluída; nenhum valor de env foi lido.
npx tsc --noEmit --incremental false
exit 1: 39 erros, observados em testes
Contratos/fixtures divergentes; strict: false não evita o drift.
npx vitest run
exit 1: 7/7 suítes falham na importação, 0 testes coletados
Alias @ sem configuração Vitest; nenhuma asserção rodou.
npm run lint em CI
exit 1: prompt interativo de configuração
Não é gate automatizável no estado atual.
npm run build
exit 0 em 36,7 s; 34 páginas/rotas
Compila produção, mas emitiu muitos DYNAMIC_SERVER_USAGE; não prova testes/typecheck.
npm audit --json
exit 1: 13 pacotes, 1 crítico/12 altos
Inclui produção e tooling.
npm audit --omit=dev --json
exit 1: 1 crítico/3 altos
Vulnerabilidades no artefato de produção.
npm outdated --json
exit 1 esperado
Forte defasagem; major upgrades exigem migração testada.
O build verde não invalida os erros: Next compilou o escopo de produção enquanto o tsc independente incluiu testes. Logs de DYNAMIC_SERVER_USAGE são capturados como erros por partes do app, mas não falham o build, o que reduz a relação sinal/ruído.
Cobertura efetiva
Há intenção de testar proteção de rotas, transições, métricas, performance e carga. No estado atual, cobertura executada é zero, pois a coleta falha. Os testes esperam contratos inexistentes (fromStatus/toStatus, {toStatus}, enum Role) e seeds inválidos. O harness de integração é perigoso por usar DATABASE_URL e deletes globais.
Lacunas obrigatórias:
matriz A/B por rota e método, inclusive relações indiretas;
preço/frete/Pix/user/tenant adulterados no checkout;
replay e concorrência de carrinho/status/estoque;
schema/migrations em banco efêmero e upgrade de snapshot;
Data API/RLS/grants e papel Prisma;
limites/rate limit, payloads grandes e falhas de dependência;
contratos UI/API e smoke/E2E dos fluxos centrais;
restore, rollback e sintéticos de produção.
Dependências
O npm audit --omit=dev encontrou vulnerabilidades em produção:
Pacote observado
Relação
Resultado/recomendação
next@14.2.3
direto
Crítico no audit; múltiplos advisories. Migrar a linha suportada atual e retestar, não parar em 14.2.35.
postcss@8.4.31
transitivo do Next
Alto; atualizar pela árvore suportada e versão corrigida.
nanoid@3.3.11
transitivo
Alto; faixa corrigida indicada pelo audit começa em 3.3.18.
ws@8.20.0
transitivo de Supabase Realtime
Alto; faixa corrigida indicada começa em 8.21.0.
Tooling também inclui achados altos em eslint-config-next/glob, minimatch, brace-expansion, js-yaml e Vite via Vitest. A remediação deve atualizar lockfile conscientemente e exigir audit/test/build verdes; não usar npm audit fix --force cegamente.
Gate de entrega recomendado
Em instalação limpa e ambiente efêmero:
secret scan e validação de configuração;
lint não interativo e tsc --noEmit;
unitários;
integração em banco descartável allowlisted;
migration replay + schema diff;
testes de concorrência/tenant/contrato;
build e smoke test;
SCA/audit e geração de SBOM;
deploy canário, migrations separadas e verificação pós-deploy.
Observabilidade mínima
logs JSON com request_id, tenant, rota, status, latência e order ID; sem segredo/PII;
tracing de Next → Prisma → Postgres e futuros workers/provedores;
métricas RED para HTTP, pool/DB, checkout/status/idempotência e filas;
SLOs explícitos de disponibilidade/latência/correção de checkout, com alertas baseados em burn rate;
auditoria imutável de ações administrativas, sem confiar em IP não pinado;
runbooks para credencial, vazamento tenant, pool esgotado, migration, fila, rollback e restore.
12. Arquitetura-alvo recomendada
Direção
Recomenda-se um monólito modular antes de qualquer decomposição em microserviços. O problema atual é fronteira e invariantes inconsistentes, não falta de processos distribuídos. Microserviços agora multiplicariam contratos, autenticação, observabilidade e consistência sem remover a causa raiz.
flowchart TB
    EDGE[Edge/proxy confiável\nHost canônico, TLS, limites] --> ADP[Adapters Next\nRSC, Route Handlers, Actions]
    ADP --> CTX[TenantContext + IdentityContext\nfail-closed]
    CTX --> MOD[Monólito modular]
    MOD --> ID[Identity e acesso]
    MOD --> CAT[Catálogo e estoque]
    MOD --> CART[Carrinho]
    MOD --> ORD[Checkout e pedidos]
    MOD --> CUST[Clientes]
    MOD --> FRE[Frete e loja]
    ID --> REP[Repositórios tenant-scoped]
    CAT --> REP
    CART --> REP
    ORD --> REP
    CUST --> REP
    FRE --> REP
    REP --> PC[Prisma singleton]
    PC --> POOL[Pooler de runtime]
    POOL --> DB[(PostgreSQL\nconstraints + RLS/grants conforme decisão)]
    ORD --> OUT[(Outbox transacional)]
    OUT --> Q[Fila/worker]
    Q --> PAY[Pagamento futuro]
    Q --> MSG[WhatsApp/notificações]
    CAT --> CDN[Storage + CDN de mídia]
    ADP --> OBS[Logs, métricas e tracing]
    Q --> OBS
    DB --> OBS
Fronteiras e invariantes
Tenant/identidade: host normalizado e verificado; host desconhecido falha fechado; tenant da sessão deve coincidir; TenantContext é parâmetro obrigatório de todo caso de uso/repositório.
Adapters: lidam com HTTP, cookies, Zod, códigos e revalidação; não contêm regra nem acesso direto ao Prisma.
Módulos: um serviço por caso de uso, sem NextResponse, headers, cookies ou revalidateTag.
Persistência: queries/mutações sempre escopadas, FKs/constraints tenant-aware e, se aplicável, RLS como defesa em profundidade.
Checkout: um comando canônico; cliente envia IDs/quantidades; servidor calcula preço/frete/Pix, valida variante/estoque/tenant, aplica idempotência e grava pedido+estoque+outbox na mesma transação.
Assíncrono: pagamentos, notificações e projeções saem da transação por outbox/worker; webhook verifica assinatura, replay e ordem de eventos.
Leitura: catálogo e admin paginados por cursor estável; DTOs específicos; agregações SQL/read models conforme volume.
Cache: dados públicos por tenant; tags específicas; backend compartilhado somente quando múltiplas réplicas exigirem. Redis/KV não deve virar fonte de verdade.
Mídia: Storage privado/público conforme caso, MIME/tamanho/nome controlados e CDN; nunca confiar em URL arbitrária como upload.
Operação: um Prisma Client por processo, pooler no runtime, conexão direta somente no job de migrations, telemetria e orçamento de capacidade.
Multi-instância versus SaaS compartilhado
Critério
Uma instância/banco por loja
SaaS compartilhado por lojaID
Isolamento
Blast radius menor; não elimina bugs dentro da instância.
Exige contexto obrigatório, constraints, matriz de testes e defesa no banco.
Operação
Deploy, migration, backup e observabilidade multiplicam por loja.
Operação central, porém incidentes e migrations têm blast radius maior.
Custo inicial
Maior por tenant, simples para poucos clientes.
Melhor densidade, maior investimento de engenharia/segurança.
Customização
Fácil divergir e criar drift.
Configuração padronizada; customização deve ser modelada.
Hot tenant
Isolado naturalmente.
Precisa quotas, rate limit, telemetria e possível promoção a dedicado.
Evolução
Automação/IaC obrigatória antes de dezenas de lojas.
RLS/repositórios/índices/caches por tenant obrigatórios antes do lançamento.
Recomendação faseada: usar multi-instância isolada como contenção de curto prazo para pilotos controlados, depois de corrigir os riscos single-tenant. Só habilitar SaaS compartilhado quando todos os gates de tenant forem automatizados. A arquitetura futura pode ser híbrida: shared por padrão e banco/instância dedicada para clientes regulados ou hot tenants. Multi-instância não é justificativa para manter checkout inseguro, credencial exposta ou dependência vulnerável.
13. Roadmap de melhorias
Contenção imediata — 0–7 dias
Tratar o segredo como incidente: rotacionar/revogar, restringir rede, revisar logs, remover de histórico/artefatos e ativar secret scanning (SEC-001).
Retirar exposição pública até contenção: bloquear/desativar checkout, address/set-default, usuários globais, rotas legadas de clientes/pedidos e mutações globais de produto se a correção segura não puder ser entregue imediatamente (TEN-001, TEN-002, SEC-002, SEC-003).
Auditar Supabase pelo canal administrativo legítimo: Data API, schemas, grants, RLS e papel Prisma; desabilitar a API se não usada (DB-004).
Atualizar Next para linha suportada corrigida e zerar vulnerabilidades bloqueadoras de produção após testes (SEC-004).
Falhar fechado para tenant: remover fallback de produção e slug global do checkout; pinar Host no proxy (TEN-003).
Proteger o banco de testes: impedir qualquer execução destrutiva sem TEST_DATABASE_URL descartável/allowlisted (TST-001).
Inventariar migrations aplicadas e backups: preservar evidência, comparar banco vivo com schema e preparar baseline/replay sem tocar produção (DB-001).
Adicionar limites/WAF temporários para login, registro, checkout e Server Actions, além de logs mínimos de incidente (SEC-005).
Curto prazo — 2–4 semanas
Implementar conceitualmente TenantContext/IdentityContext canônicos e migrar todas as rotas para repositórios tenant-scoped.
Consolidar guards, services/**/lib/services/**, rotas legadas e os dois pipelines de pedido (ARC-001).
Reescrever o contrato do checkout para dados autoritativos no servidor; guest/autenticado explícitos; DTOs mínimos (SEC-002).
Adicionar idempotência, compare-and-set de status e testes concorrentes (DB-002).
Reconciliar migrations/schema; adotar expand/backfill/contract; replay/diff em CI (DB-001).
Corrigir constraints, dinheiro, uniques e índices validados (DB-003).
Tornar lint/typecheck/Vitest executáveis; banco efêmero e suites separadas; matriz tenant/abuso (TST-001).
Implantar rate limit distribuído, limites de payload, respostas uniformes e sessões ACTIVE apenas (SEC-005, SEC-006).
Criar pipeline CI com audit/SBOM e migration gate; remover funcionalidades UI que não possuem backend (OPS-001, ARC-002).
Médio prazo — 1–3 meses
Outbox, worker, retries/deduplicação e desenho de pagamento/webhook seguro.
Paginação/busca server-side do catálogo e admin; agregações SQL/read model; DTOs menores (SCL-001).
Prisma único, pooler validado e teste de capacidade/conexões (SCL-002).
Cache/tags por tenant e coordenação multi-réplica conforme plataforma (SCL-003).
OpenTelemetry/logs/métricas, SLO/alertas e sintéticos; runbooks de incidentes.
IaC, deploy canário/rolling, job de migration e rollback/forward-fix ensaiado.
Backup/restore drill com RPO/RTO medidos e política LGPD de retenção/anonimização/DSAR.
Verificação de domínio customizado e onboarding auditável.
Evolução posterior
billing, planos, quotas e rate limit por tenant;
projeções analíticas e retenção/arquivamento de histórico;
read replicas, particionamento ou tenant dedicado apenas quando telemetria mostrar benefício;
testes de caos/falhas parciais e DR periódico;
arquitetura híbrida shared/dedicada para hot tenants ou requisitos regulatórios;
decomposição de módulos em serviços apenas onde ownership, escala e autonomia transacional justificarem.
14. Backlog priorizado
Prioridade
Entrega
Findings
Valor
Esforço
Dependências/risco
Critério de aceite resumido
P0
Rotação e resposta ao segredo
SEC-001
Evita bypass total
P–M
Acesso Supabase; troca coordenada
Segredo antigo inválido e ausente de árvore/histórico.
P0
Bloqueio temporário de superfícies críticas
TEN-001/002, SEC-002/003
Interrompe exploração imediata
P
Pode indisponibilizar features
Rotas não ficam acessíveis até controle seguro.
P0
Autorização tenant de usuários/roles
TEN-001
Evita takeover
M
TenantContext
Teste A→B retorna 404 sem mutação.
P0
Matriz tenant em pedidos/clientes/produtos
TEN-002
Protege PII e operação
G
Serviços canônicos
Todos os métodos A→B negados.
P0
Checkout autoritativo no servidor
SEC-002
Evita fraude/corrupção
G
Catálogo/frete/pedido únicos
Tampering não altera total/relações; estoque validado.
P0
Auditoria Data API/RLS/grants
DB-004
Fecha bypass direto
M
Acesso administrativo legítimo
anon/authenticated sem acesso privado.
P0
Upgrade Next/deps produção
SEC-004
Remove CVEs conhecidos
M–G
Testes de migração
Linha suportada; audit de produção sem bloqueador.
P0
Replay e baseline de migrations
DB-001
Garante deploy/restore
M–G
Snapshot/inventário
Banco vazio sem diff e upgrade preserva dados.
P0
Isolamento do harness de teste
TST-001
Evita perda acidental
P–M
Banco descartável
Suite recusa DB não allowlisted.
P1
TenantContext e consolidação de serviços
ARC-001, TEN-003
Remove causa sistêmica
G
Inventário de imports
Um serviço/guard/pipeline por operação.
P1
Idempotência e concorrência
DB-002
Corrige pedidos/estoque
G
Schema/checkout
20 concorrentes, um efeito.
P1
Constraints, Decimal e índices
DB-003
Integridade/desempenho
G
Backfill/migrations
DB rejeita inválidos; planos medidos.
P1
CI: lint/typecheck/test/build/audit
TST-001, OPS-001
Previne regressões
M
Harness corrigido
Instalação limpa passa todos os gates.
P1
Rate limit, limites e DTOs
SEC-005/006
Reduz takeover/DoS/vazamento
M
Store/WAF/telemetria
429/413/422 e nenhuma resposta sensível.
P1
Catálogo/admin paginados
SCL-001
Controla custo/latência
M
Índices/contratos
Payload/query limitados em volume crescente.
P1
Pooler e Prisma único
SCL-002
Evita saturação DB
P–M
Topologia real
Conexões abaixo do orçamento sob carga.
P2
Observabilidade, SLO e runbooks
OPS-001
Detecta/recupera falhas
G
Plataforma/ownership
Sintéticos/alertas e incident drill passam.
P2
Outbox/workers
DB-002
Integrações confiáveis
G
Pedido canônico
Eventos exatamente uma vez no efeito lógico.
P2
Cache distribuído por tenant
SCL-003
Escala horizontal coerente
M
Múltiplas réplicas
Invalidação multi-réplica dentro do SLO.
P2
Contratos e documentação viva
ARC-002
Reduz drift/retrabalho
M
Serviços canônicos
UI↔API testada e ADR/C4 atualizados.
15. Gates para produção
Impeditivos
credencial exposta revogada e resposta ao incidente concluída;
zero caminho confirmado de leitura/escrita/promoção cross-tenant; matriz completa automatizada;
checkout deriva todos os valores/relações do servidor, com limites, estoque e idempotência;
endpoint anônimo de endereço removido/protegido e nenhum DTO expõe hashes/tokens;
Data API/RLS/grants/papel Prisma verificados; acesso direto privado negado;
Next/dependências de produção em linha suportada, sem vulnerabilidade bloqueadora aplicável;
migrations reproduzíveis e não destrutivas validadas em banco efêmero/snapshot;
concorrência de pedido/status/estoque com exatamente um efeito;
banco de testes isolado, typecheck/lint/test/build verdes e CI obrigatório;
backups/restore, deploy/migration/rollback e observabilidade mínima demonstrados.
Recomendados antes de beta controlado
rate limit distribuído/quotas e proteção de payload;
constraints tenant/monetárias e índices aprovados por planos reais;
paginação/busca no servidor e limites de relatórios;
pooler/orçamento de conexões testado;
SLOs, sintéticos, alertas e runbooks;
política LGPD de minimização, retenção, exportação, anonimização e incidentes;
verificação de domínio e cache multi-réplica testado.
Opcionais/posteriores
microserviços, particionamento e read replicas;
tenant dedicado automático e analytics avançado;
circuit breakers complexos antes de existir integração externa real.
Condição para avançar um nível
Para passar de inadequado para produção a protótipo demonstrável, no mínimo: segredo revogado, dados exclusivamente fictícios, ambiente isolado sem acesso público, superfícies críticas bloqueadas ou corrigidas, dependência Next remediada e banco de demonstração reconstruível. Para beta controlado, todos os impeditivos acima precisam estar verdes, com poucos tenants contratualmente limitados, monitoramento e plano de rollback. Produção com restrições só deve ser considerada após evidência de carga, restore e operação contínua.
16. Apêndice de evidências
Comandos executados e resultado
Comando/ação
Exit
Resultado resumido
inventário com rg --files e buscas rg
0
163 arquivos relevantes; 26 handlers; 7 testes; 12 migrations.
buscas de guards, lojaID, Prisma, cache, Server Actions, SQL bruto e segredos
0/1 conforme match
Evidências descritas; nenhum valor de .env aberto.
git status --short
não executável
Git indisponível; histórico/tracking não confirmados.
npx prisma validate
1
DIRECT_URL ausente.
npx tsc --noEmit --incremental false
1
39 erros observados em testes.
npx vitest run
1
7/7 suítes falharam na importação; 0 testes coletados.
npm run lint em CI
1
Solicita criação interativa de configuração ESLint.
npm run build
0
Prisma Client 5.22; 34 páginas/rotas; 36,7 s; logs DYNAMIC_SERVER_USAGE.
npm audit --json
1
13 pacotes: 1 crítico, 12 altos.
npm audit --omit=dev --json
1
Produção: 1 crítico, 3 altos.
npm outdated --json
1 esperado
Next 14.2.3 versus 16.3.1 e Prisma 5.22 versus 7.9.1 no registro consultado; majors requerem projeto.
O build criou somente artefatos/caches normais permitidos (.next, Prisma Client e tsconfig.tsbuildinfo). Não foram feitas alterações intencionais em fonte, schema, migrations, dependências ou lockfile.
Advisories e documentação primária consultados em 18/08/2026
Next.js — support policy e advisories oficiais;
CVE-2026-64641 / Server Actions DoS, aplicável às condições observadas;
Next.js security update de dezembro/2025, que corrige vulnerabilidades anteriores até 14.2.35, mas não torna Next 14 suportado nem corrige advisories posteriores;
advisories de Next reportados no audit: GHSA-f82v-jwr5-mffw, GHSA-7gfc-8cq8-jh5f, GHSA-gp8f-8m3g-qvj9, GHSA-mwv6-3258-q52c, GHSA-q4gf-8mx6-v5v3, GHSA-c4j6-fc7j-m34r, GHSA-89xv-2m56-2m9x e GHSA-p9j2-gv94-2wf4;
Supabase — securing the Data API, secure data, custom/exposed schemas, connection methods e shared responsibility;
Prisma — null and undefined.
Advisories transitivos relevantes do audit incluem PostCSS (GHSA-qx2v-qp2m-jg93), NanoID (GHSA-28wg-ghj8-5hjv) e ws (GHSA-58qx-3vcg-4xpx). A árvore precisa ser reauditada depois da migração; a lista é um retrato da data da consulta.
Arquivos e áreas inspecionadas
manifestos/configuração: package*.json, next.config.js, tsconfig.json, middleware e gitignore;
todas as rotas em app/api/**, layouts/páginas prioritários e consumidores UI dos fluxos críticos;
sessão, guards, tenant, Prisma, Supabase, validators, stores e ambas as árvores de serviços;
schema Prisma e todas as migrations localizadas;
todos os arquivos de teste/setup/carga;
ROADMAP.md, análise arquitetural histórica e scripts auxiliares relevantes.
node_modules, .next e templates foram excluídos como fontes primárias; node_modules foi consultado pontualmente pelo comportamento da dependência e audit. Nenhum .env foi lido.
Suposições e perguntas em aberto
A credencial encontrada ainda é válida e chegou a Git/backup/artefato/deploy?
Quais migrations estão marcadas/aplicadas no banco vivo e qual é o drift real?
Data API está habilitada? Quais schemas/grants/RLS e qual role o Prisma usa?
O runtime é Vercel, serverless próprio ou container persistente? Há proxy que pina Host e X-Forwarded-*?
Há WAF/rate limiter, headers, CI/CD, observabilidade e backups externos não versionados?
Checkout deve aceitar guest ou exigir conta? Qual é a fonte comercial de preço/frete e o momento de reserva de estoque?
Quais são SKUs, variantes, usuários concorrentes, pedidos/minuto, histórico, p95/SLO, RPO/RTO e crescimento esperados?
Quais bases legais, prazos de retenção e processos de titular LGPD se aplicam?
--------------------------------------------------------------------------------
Veredito final
Inadequado para produção. O projeto é um protótipo com bons blocos iniciais, mas possui quatro classes de bloqueador independentes: comprometimento potencial de infraestrutura, takeover/BOLA cross-tenant, checkout e concorrência sem integridade, e entrega/banco não reprodutíveis. O build isolado bem-sucedido não compensa zero testes coletados, 39 erros de tipo, migrations divergentes ou vulnerabilidades de produção.
O próximo nível, protótipo demonstrável, requer as condições objetivas descritas na seção 15. Qualquer beta compartilhado deve aguardar todos os gates impeditivos, especialmente a prova automatizada de isolamento A/B, checkout autoritativo/idempotente, migration replay, Data API/RLS auditada e operação restaurável.