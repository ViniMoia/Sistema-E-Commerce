# Auditoria de Painel Administrativo — Etapa 13/15

**Relatório:** `docs/audits/ADMIN-AUDIT.md`  
**Data:** 2026-09-26  
**Revisão analisada:** `0c7ef7d`  
**Escopo:** autenticação e autorização do painel; produtos, categorias, marcas, clientes, pedidos, estoque, frete, usuários, fidelidade/cashback e configurações; operações destrutivas e financeiras; validação, confirmação, trilha de auditoria e reversibilidade  
**Fora do escopo:** correção do produto, acesso a produção ou banco real, chamadas ao Asaas/Correios/ViaCEP/Supabase, instalação de dependências e mutações com dados reais

## Executive Summary

O painel possui uma base consistente de autorização: páginas sob `/admin` são protegidas novamente no layout do servidor, e todas as rotas administrativas inventariadas chamam `requireAdmin`, que consulta a sessão e o papel atuais e retorna `401` para sessão inexistente/inativa e `403` para papel diferente de `ADMIN`. Os acessos a pedidos, clientes, produtos, regras de frete e alteração de papel também aplicam filtro ou verificação de `lojaID`. Não foi encontrada autorização baseada apenas em botão oculto.

Apesar dessa base, o painel não está pronto para operar com segurança financeira. O cancelamento administrativo de um pedido `PAID` marca o pedido como cancelado, devolve estoque e ajusta pontos, mas não solicita reembolso ao gateway. Isso cria divergência entre o estado local e a cobrança capturada e é o bloqueio crítico desta etapa. Também há caminhos para cadastrar frete negativo pela API, duplicar ou conceder ajuste de pontos sem limite por repetição do mesmo `POST`, e remover todos os administradores ativos por condições não cobertas pela proteção de “último admin”.

Na gestão de catálogo, toda edição reenvia variantes, enquanto o serviço apaga e recria todas elas. Uma variante já referenciada por venda não pode ser apagada pela chave estrangeira de `OrderItem`, de modo que até uma simples mudança de preço ou descrição pode falhar com `500`. A exclusão de produtos é física, embora a interface descreva parte do comportamento como desvinculação do catálogo. O estoque geral e os estoques por variante são editados de forma independente e não possuem invariante no servidor.

A trilha administrativa é fragmentada. Mudança de papel e status de pedido geram `AuditLog`, e ajustes de pontos geram ledger; porém preço, estoque, produto, regra de frete, configuração da loja, configuração de fidelidade, notas e rastreio não têm histórico uniforme. A tela oferece “Histórico de Status”, mas o fluxo atual não cria `OrderStatusHistory`. Além disso, a API de configurações devolve a credencial dos Correios ao navegador e a página a mantém em estado cliente mesmo sem oferecer campo para editá-la.

### Resumo por severidade

| Severidade | Quantidade |
|---|---:|
| BLOCKER | 0 |
| CRITICAL | 1 |
| HIGH | 6 |
| MEDIUM | 5 |
| LOW | 0 |
| INFORMATIONAL | 0 |
| **Total** | **12** |

### Publication Blockers

1. **ADM-001 (CRITICAL):** cancelar pedido pago não executa nem agenda reembolso no gateway.
2. Recomenda-se também reter publicação até corrigir **ADM-002**, **ADM-003**, **ADM-004** e **ADM-007**, pois permitem, respectivamente, total reduzido por frete negativo, crédito duplicado/arbitrário de pontos, perda de todos os administradores ativos e exposição desnecessária de credencial operacional ao navegador.
3. **ADM-005** é bloqueio operacional para manutenção de produtos que já tiveram venda e deve ser resolvido antes de o catálogo entrar em operação recorrente.

## 1. Metodologia

1. Leitura de `AGENTS.md`, `DOCUMENTACAO_TECINICA/README.md`, documentação técnica e guia de auditoria do projeto, sem reproduzir credenciais documentadas.
2. Inventário de páginas em `app/admin`, itens de navegação, componentes administrativos e rotas HTTP usadas pelo painel.
3. Rastreamento de cada ação do navegador até rota, schema Zod, serviço, Prisma, efeitos colaterais, tenant e resposta.
4. Inspeção específica de `DELETE`, mudança de status, cancelamento, reembolso, papel, preço, estoque, rastreio, frete, pontos e configurações.
5. Busca de gravações em `AuditLog`, `OrderStatusHistory`, ledger de fidelidade e logs de estoque, comparando-as com o histórico exibido na interface.
6. Leitura dos testes de proteção de rotas, transições, isolamento multi-tenant, inventário, fidelidade e gateway.
7. Tentativa de executar as suítes unitária e de integração sem instalar pacotes nem acessar rede.

Nenhum endpoint externo, banco, provider ou ambiente compartilhado foi acessado. Nenhuma mutação administrativa foi executada. Nenhum segredo ou dado pessoal foi impresso no relatório.

### Critério de confiança

- **CONFIRMED:** demonstrado diretamente pelo caminho executável do código, schema ou comando local.
- **HIGH CONFIDENCE:** depende de estado/timing, mas todos os ramos necessários estão presentes no código.
- **SUSPECTED:** hipótese plausível ainda sem evidência suficiente.
- **NOT VERIFIED:** requer dependência, banco ou infraestrutura indisponível nesta auditoria.

Ausência de teste é tratada como lacuna de regressão, e não como prova autônoma de falha de autorização.

## 2. Mapa real do painel

| Área | Página/componente | API principal | Operações encontradas |
|---|---|---|---|
| Dashboard | `/admin` | serviços server-side + APIs de fidelidade | indicadores, configuração rápida e ajuste rápido de pontos |
| Produtos/estoque | `/admin/products`, `/new`, `/[id]/edit` | `/api/products`, `/api/products/[id]` | listar, criar, editar preço/estoque/variantes/imagens e excluir |
| Pedidos | `/admin/orders` | `/api/admin/orders/**` | listar, detalhar, mudar status, notas e rastreio |
| Clientes | `/admin/customers` | `/api/admin/customers/**` | consulta, perfil, pedidos e métricas; sem mutação de cadastro |
| Usuários/papéis | `/admin/users` | `/api/admin/users`, `/api/admin/users/[id]/role` | listar e alternar `CUSTOMER`/`ADMIN` |
| Fidelidade/cashback | `/admin/fidelidade` e widget do dashboard | `/api/admin/loyalty/**` | configurar, relatar e ajustar saldo de pontos |
| Frete | `/admin/freight` | `/api/admin/freight/**` | listar, criar, editar e excluir regra local |
| Configurações | `/admin/settings` | `/api/loja/settings` | PIX, contato, identidade, origem e opções de frete |
| Marcas/categorias | não há página administrativa | apenas serviços de leitura para catálogo | não há CRUD nem associação pelo formulário de produto |
| Cupons | não encontrado no schema/painel/API | não aplicável | recurso ausente |
| Reembolso | não há ação administrativa | webhook apenas recebe `PAYMENT_REFUNDED` | não há comando de reembolso ao gateway |
| Ações em lote | não encontradas | não aplicável | recurso ausente |

### 2.1 Fluxo de autorização

```text
Browser -> /admin/*
  -> proxy: verifica apenas presença/formato básico do cookie
  -> AdminLayout no servidor
     -> getCurrentUser consulta Session + User atual
     -> exige role=ADMIN
  -> componente cliente chama API
     -> requireAdmin consulta novamente Session + User
     -> exige status=ACTIVE e role=ADMIN
     -> serviço valida lojaID do recurso
     -> Prisma executa leitura/mutação
```

Evidência: `proxy.ts:7-25`, `app/admin/layout.tsx:30-47`, `lib/session.ts:83-129` e `lib/auth/guards.ts:26-38`.

O papel não é copiado para um token de longa duração: ele é lido do usuário a cada requisição. Portanto, uma promoção/revogação válida passa a valer nas requisições seguintes. O problema de `ADM-004` é preservar pelo menos um administrador ativo, não a propagação do papel.

## 3. Matriz de autorização por endpoint/ação

### 3.1 Resultado estático do fluxo

Em todas as linhas abaixo, “401/403” é **CONFIRMED pelo fluxo do código**, mas a chamada HTTP com conta fictícia `CUSTOMER` é **NOT VERIFIED dinamicamente** porque as dependências locais não estão instaladas e não havia banco de teste/servidor em execução. O resultado esperado comum é: anônimo/inativo `401`, usuário `CUSTOMER` ativo `403`, `ADMIN` ativo segue para validação e escopo de tenant.

| Endpoint/ação | Método | Guard/tenant | Anônimo | CUSTOMER fictício B | ADMIN da loja A |
|---|---|---|---:|---:|---|
| `/admin/*` | navegação | `AdminLayout` | redirect `/login` | redirect `/login` | renderiza painel |
| `/api/admin/customers` | GET | `requireAdmin`; injeta `lojaID` | 401 | 403 | lista apenas loja A |
| `/api/admin/customers/:id` | GET | `requireAdmin`; serviço com `lojaID` | 401 | 403 | 200 próprio tenant / 404 outro |
| `/api/admin/customers/:id/metrics` | GET | `requireAdmin`; serviço com `lojaID` | 401 | 403 | 200 próprio tenant / 404 outro |
| `/api/customers` | GET | `requireAdmin`; legado tenant-scoped | 401 | 403 | permitido no tenant |
| `/api/customers/:id` | GET | `requireAdmin`; legado tenant-scoped | 401 | 403 | permitido no tenant |
| `/api/admin/orders` | GET | `requireAdmin`; injeta `lojaID` | 401 | 403 | lista loja A |
| `/api/admin/orders/:id` | GET | `requireAdmin`; `lojaID` no filtro | 401 | 403 | 200 próprio / 404 outro |
| `/api/admin/orders/:id/status` | PATCH | `requireAdmin`; `lojaID` no serviço | 401 | 403 | transição validada |
| `/api/admin/orders/:id/notes` | PATCH | `requireAdmin`; compara `lojaID` | 401 | 403 | atualiza próprio / 404 outro |
| `/api/admin/orders/:id/tracking` | PATCH | `requireAdmin`; compara `lojaID` | 401 | 403 | atualiza próprio / 404 outro |
| `/api/orders/:id` | PATCH | `requireAdmin`; serviço recebe `lojaID` | 401 | 403 | transição validada |
| `/api/admin/freight` | GET | `requireAdmin`; usa loja da sessão | 401 | 403 | lista loja A |
| `/api/admin/freight` | POST | `requireAdmin`; força loja da sessão | 401 | 403 | cria na loja A |
| `/api/admin/freight/:id` | PATCH/PUT | `requireAdmin`; compara `lojaID` | 401 | 403 | altera próprio / 404 outro |
| `/api/admin/freight/:id` | DELETE | `requireAdmin`; compara `lojaID` | 401 | 403 | exclui próprio / 404 outro |
| `/api/admin/loyalty/reports` | GET | `requireAdmin`; loja da sessão | 401 | 403 | relatório da loja A |
| `/api/admin/loyalty/config` | GET/PUT | `requireAdmin`; loja da sessão | 401 | 403 | lê/altera loja A |
| `/api/admin/loyalty/adjust` | POST | `requireAdmin`; loja/ator sobrescritos no servidor | 401 | 403 | ajusta cliente da loja A |
| `/api/admin/users` | GET | `requireAdmin`; `lojaID` no serviço | 401 | 403 | lista loja A |
| `/api/admin/users/:id/role` | PATCH | `requireAdmin`; compara tenant no serviço | 401 | 403 | altera usuário da loja A |
| `/api/products` | POST | `requireAdmin`; sobrescreve `lojaID`/`userID` | 401 | 403 | cria produto na loja A |
| `/api/products/:id` | PUT | `requireAdmin`; compara `lojaID` | 401 | 403 | altera próprio / 404 outro |
| `/api/products/:id` | DELETE | `requireAdmin`; compara `lojaID` | 401 | 403 | exclui próprio / 404 outro |
| `/api/loja/settings` | GET/PUT | `requireAdmin`; usa `lojaID` da sessão | 401 | 403 | lê/altera loja A |
| `/api/upload`, bucket `products` | POST | sessão + checagem explícita de papel | 401 | 403 quando feature habilitada; 503 antes do papel quando desabilitada | permitido quando feature habilitada |

### 3.2 Limite desta matriz

A suíte `tests/integration/route-protection.test.ts` cobre ausência/token inválido e parte do isolamento entre lojas, mas não cria conta `CUSTOMER` nem tenta todas as ações acima. Ela também omite usuários/papéis, fidelidade, configuração, produtos, rastreio, `PUT/DELETE` de frete e upload. Portanto, não há evidência dinâmica completa de regressão para escalada `CUSTOMER -> ADMIN`.

## 4. Confirmação, auditoria e reversibilidade

| Ação | Confirmação na UI | Trilha persistida | Reversibilidade observada |
|---|---|---|---|
| Excluir produto | sim, modal com nome e aviso | não | hard delete; vendido falha, não vendido é removido |
| Editar preço/estoque/variantes | botão explícito de salvar | não | sobrescrita; variantes são apagadas/recriadas |
| Excluir regra de frete | sim, modal e efeito explicado | não | não há restore/versionamento |
| Mudar status do pedido | sim, modal genérico | `AuditLog`; `OrderStatusHistory` não é gravado | estados finais não voltam; cancelamento pago não reembolsa |
| Editar notas/rastreio | botão salvar | não | sobrescrita sem versão anterior |
| Alterar papel | sim, dialog e alerta | `AuditLog` atômico | pode ser revertido por outro admin, se ainda existir |
| Ajustar pontos | submissão direta, sem segundo passo | ledger com ID abreviado do admin na descrição | ajuste compensatório manual, sem vínculo com original |
| Alterar configuração de fidelidade | botão salvar | não | sobrescrita sem histórico |
| Alterar configurações/PIX/frete | botão salvar | não | sobrescrita sem histórico |
| Reembolso | ação ausente | apenas evento recebido do gateway | não aplicável no painel |
| Ações em lote | ausentes | não aplicável | não aplicável |

## 5. Findings

### ADM-001 — Cancelamento administrativo de pedido pago não reembolsa a cobrança

- **Severidade:** CRITICAL
- **Confiança:** CONFIRMED
- **Arquivos e linhas:** `components/admin/orders/OrderStatusManager.tsx:23-29,62-78,189-197`; `app/api/admin/orders/[orderId]/status/route.ts:15-25`; `services/order.service.ts:359-413`; `services/asaas/asaas.client.ts:160-241`; `app/api/webhooks/asaas/route.ts:282-292`
- **Pré-condições:** pedido no estado `PAID`, com cobrança capturada no Asaas; administrador ativo da mesma loja.
- **Fluxo e condição de manifestação:** o painel oferece `PAID -> CANCELLED`. A API envia apenas `newStatus`; o serviço confirma `CANCELLED`, restaura estoque, grava auditoria e estorna pontos dentro da transação. Nenhum cliente/adapter possui operação de reembolso ou cancelamento de cobrança. O único fluxo de `PAYMENT_REFUNDED` é reativo a um webhook já emitido pelo gateway.
- **Evidência observada (fato):** o estado comercial local muda e os ativos locais são liberados sem uma solicitação de estorno financeiro.
- **Hipótese delimitada:** um operador pode fazer o reembolso manualmente no painel externo do Asaas, mas esse processo não está versionado, imposto, correlacionado nem verificável no repositório.
- **Impacto:** cliente permanece cobrado enquanto o pedido aparece cancelado; estoque pode ser revendido; pontos podem ser revertidos; conciliação financeira e atendimento ficam divergentes.
- **Correção proposta:** criar comando de reembolso idempotente no gateway, com estados `REFUND_PENDING/REFUNDED/REFUND_FAILED` ou saga equivalente; não tratar `CANCELLED` pago como reembolsado; persistir `refundId`, valor, motivo, ator e tentativas; reconciliar pelo webhook.
- **Teste de regressão:** com adapter fake, cancelar pedido pago solicita exatamente um reembolso; repetição com mesma chave não duplica; falha do provider deixa estado pendente/erro e não declara reembolso concluído; webhook repetido converge uma vez.
- **Risco residual:** reembolso pode ficar em processamento ou ser parcialmente aceito pelo provider; exige reconciliação e alerta operacional.

### ADM-002 — Criação de regra de frete aceita valor negativo no servidor

- **Severidade:** HIGH
- **Confiança:** CONFIRMED
- **Arquivos e linhas:** `app/api/admin/freight/route.ts:14-24`; `services/freight.service.ts:54-67`; `services/checkout.service.ts:361-379`; `components/admin/freight/FreightRuleForm.tsx:39-46`
- **Pré-condições:** administrador ativo envia `POST /api/admin/freight` diretamente ou por cliente alterado.
- **Fluxo e condição de manifestação:** a UI rejeita valores menores que zero, mas a rota apenas faz cast do JSON e o serviço persiste `new Prisma.Decimal(params.value)` sem limite. No checkout, a regra local é escolhida e copiada para `calculatedFreight` sem nova verificação de não negatividade.
- **Evidência observada (fato):** a proteção existe somente no cliente para criação; `PATCH` possui Zod `.min(0)`, mas `POST` não.
- **Hipótese delimitada:** a coluna Decimal aceita valor negativo; não há `CHECK (value >= 0)` visível no schema/migrações inspecionados para impedir o registro.
- **Impacto:** frete negativo reduz o total do pedido e pode gerar venda abaixo do valor correto, além de contaminar cotações públicas.
- **Correção proposta:** usar schema Zod compartilhado no `POST`, repetir a invariante no serviço e adicionar `CHECK value >= 0` no banco; validar total/frete novamente antes de criar o pedido.
- **Teste de regressão:** `POST` com `-0.01`, `NaN`, string, infinito e campos ausentes retorna `422`; criação válida persiste; fixture legada negativa não pode reduzir total no checkout.
- **Risco residual:** linhas negativas já existentes precisam ser identificadas e corrigidas antes de habilitar a regra.

### ADM-003 — Ajuste manual de pontos é ilimitado, não idempotente e não exige confirmação contextual

- **Severidade:** HIGH
- **Confiança:** CONFIRMED
- **Arquivos e linhas:** `services/loyalty.service.ts:41-49,535-599`; `app/api/admin/loyalty/adjust/route.ts:17-35`; `components/admin/loyalty/LoyaltyAdminView.tsx:133-155,492-574`; `components/admin/dashboard/LoyaltyQuickManagementWidget.tsx:83-126`
- **Pré-condições:** administrador ativo conhece/cola o ID de um cliente da própria loja.
- **Fluxo e condição de manifestação:** o schema exige inteiro diferente de zero, mas não limita magnitude nem recebe chave idempotente. Cada `POST` incrementa a carteira e cria uma nova transação. As duas interfaces submetem diretamente e apenas desabilitam o botão durante a requisição; não exibem confirmação com identidade do cliente e valor monetário.
- **Evidência observada (fato):** repetir o mesmo payload cria efeitos adicionais válidos. O ledger registra o ajuste, mas não distingue retry de nova intenção nem vincula uma reversão ao lançamento original.
- **Hipótese delimitada:** não foi executado retry real sem banco de teste; o efeito duplicado decorre diretamente do incremento e da criação sem chave única.
- **Impacto:** duplo clique refeito, retry de proxy/cliente ou erro operacional pode criar passivo de cashback/pontos arbitrário; uma digitação com muitos dígitos pode gerar crédito de alto valor.
- **Correção proposta:** exigir `idempotencyKey` única por loja/ação; definir limites por política; mostrar nome/conta, pontos e equivalente monetário em confirmação; exigir motivo estruturado e, acima de limiar, segunda aprovação; implementar reversão vinculada ao transaction ID.
- **Teste de regressão:** duas requisições com a mesma chave geram uma transação e um incremento; chave nova gera novo ajuste; valores acima do limite são rejeitados; confirmação exibe o cliente resolvido e o valor; CUSTOMER recebe `403`.
- **Risco residual:** um administrador autorizado ainda pode abusar dentro dos limites; segregação de função e alertas são controles complementares.

### ADM-004 — Proteção de último administrador não garante um administrador ativo e é vulnerável a corrida

- **Severidade:** HIGH
- **Confiança:** CONFIRMED
- **Arquivos e linhas:** `services/user.service.ts:9-53`; `app/api/admin/users/[id]/role/route.ts:47-72`; `components/admin/RoleManagerModal.tsx:26-55,89-136`
- **Pré-condições:** dois administradores da mesma loja, ou um administrador ativo e outro com `status=BLOCKED`.
- **Fluxo e condição de manifestação:** o contador de último admin filtra apenas `role: ADMIN` e `lojaID`, sem `status: ACTIVE`. A leitura do alvo/ator e o `count` ocorrem antes da transação de update. Com A e B ativos, A pode rebaixar B enquanto B rebaixa A; ambos podem observar contagem 2. Com um admin ativo e outro bloqueado, a contagem também permite rebaixar o único ativo.
- **Evidência observada (fato):** a proibição de autoalteração e o check `adminCount <= 1` não preservam a invariante “ao menos um ADMIN ACTIVE por loja”.
- **Hipótese delimitada:** a corrida depende de simultaneidade; o caso com admin bloqueado não depende de timing.
- **Impacto:** loja pode ficar sem qualquer conta capaz de administrar catálogo, pedidos ou configurações, exigindo intervenção direta no banco.
- **Correção proposta:** validar `status=ACTIVE`; serializar mudanças de papel por loja dentro de transação com isolamento/lock adequado; revalidar ator e contagem no mesmo boundary; considerar papel de owner não removível e procedimento auditado de recuperação.
- **Teste de regressão:** duas demissões cruzadas concorrentes resultam em exatamente uma rejeição; admin bloqueado não conta como guardião; último admin ativo não pode ser bloqueado/rebaixado; mudança continua tenant-scoped.
- **Risco residual:** indisponibilidade de todas as contas por perda de credenciais ainda requer recuperação operacional separada.

### ADM-005 — Edição de produto vendido tenta apagar variantes históricas e pode falhar integralmente

- **Severidade:** HIGH
- **Confiança:** CONFIRMED
- **Arquivos e linhas:** `components/admin/ProductForm.tsx:79-93,111-137`; `services/product.service.ts:156-199`; `prisma/schema.prisma:159-175,332-349`; `app/api/products/[id]/route.ts:35-61`
- **Pré-condições:** produto possui ao menos uma variante referenciada por `OrderItem`; administrador salva qualquer alteração pelo formulário.
- **Fluxo e condição de manifestação:** o formulário sempre envia o array completo de variantes, mesmo ao mudar somente nome/preço. O serviço interpreta a presença do array como ordem para `deleteMany` de todas as variantes e depois `createMany`. A relação `OrderItem.variant` não define `onDelete: SetNull/Cascade`; a referência histórica impede apagar a variante.
- **Evidência observada (fato):** a rota sempre envia variantes ao serviço; o serviço sempre tenta apagá-las; a relação histórica não possui política de exclusão que permita essa remoção; erros Prisma não mapeados viram `500`.
- **Hipótese delimitada:** a manifestação foi derivada do schema e do fluxo transacional, mas não foi reproduzida contra Postgres nesta máquina por ausência do ambiente de teste.
- **Impacto:** produtos após a primeira venda podem se tornar impossíveis de manter pelo painel; correções de preço, texto, imagem e estoque falham junto com a recriação de variantes.
- **Correção proposta:** preservar IDs e fazer create/update/archive por variante; nunca apagar variante referenciada; separar atualização de dados do produto da gestão de grade; retornar conflito de domínio legível para remoção impossível.
- **Teste de regressão:** fixture com pedido histórico permite alterar preço/descrição sem mudar IDs; variante removida é arquivada e `OrderItem` mantém referência; variante nova é criada; falha não retorna `500` genérico.
- **Risco residual:** grades antigas podem precisar migração e política para SKUs duplicados/arquivados.

### ADM-006 — Exclusão de produto é física, irreversível e tem semântica divergente na interface

- **Severidade:** MEDIUM
- **Confiança:** CONFIRMED
- **Arquivos e linhas:** `services/product.service.ts:202-213`; `app/api/products/[id]/route.ts:64-77`; `components/admin/ProductForm.tsx:461-505`; `app/admin/products/page.tsx:307-352`; `prisma/schema.prisma:121-150,332-349`
- **Pré-condições:** administrador confirma exclusão.
- **Fluxo e condição de manifestação:** o serviço usa `prisma.product.delete`. Para produto sem referências, a remoção é definitiva e variantes/carrinho podem ser afetados por cascata. Para produto vendido, a FK de `OrderItem.product` tende a bloquear e o handler responde `500`. Uma mensagem afirma que a ação “desvinculará o produto do catálogo ativo”, embora não exista `isActive/isArchived` no modelo.
- **Evidência observada (fato):** há confirmação visual, mas não há soft delete, restore ou resposta de conflito específica.
- **Hipótese delimitada:** a violação de FK para produto vendido não foi executada localmente; é o comportamento esperado da relação referencial declarada e também está reconhecido no guia técnico do projeto.
- **Impacto:** exclusão não vendida perde cadastro e metadados; exclusão vendida falha como erro interno; o operador recebe expectativas contraditórias.
- **Correção proposta:** introduzir arquivamento/desativação tenant-scoped; retirar arquivados da vitrine, preservar histórico e oferecer restauração; reservar hard delete a registros nunca usados e responder `409` quando proibido.
- **Teste de regressão:** arquivar remove da vitrine sem remover `OrderItem`; restaurar republica; tentativa explícita de hard delete com referências retorna `409`; auditoria guarda ator/antes/depois.
- **Risco residual:** consumidores e caches precisam respeitar a flag de arquivamento.

### ADM-007 — Credencial dos Correios é devolvida ao navegador e regravada pelo formulário

- **Severidade:** HIGH
- **Confiança:** CONFIRMED
- **Arquivos e linhas:** `prisma/schema.prisma:38-49`; `services/loja.service.ts:63-100,113-170`; `app/api/loja/settings/route.ts:36-57,70-109`; `app/admin/settings/page.tsx:59-99,142-178`
- **Pré-condições:** loja possui `correiosPassword`; administrador abre configurações.
- **Fluxo e condição de manifestação:** `getLojaSettings` seleciona `correiosPassword`, a API devolve o objeto integral, e a página armazena a resposta em state. O formulário não apresenta campo correspondente, mas reenvia `...settings` no `PUT`, mantendo a credencial circulando no browser e na resposta de update.
- **Evidência observada (fato):** o valor é tratado como string comum no schema e gravado/devolvido diretamente; não foi encontrada camada de segredo, criptografia de aplicação ou resposta mascarada nesse fluxo.
- **Hipótese delimitada:** controles externos de criptografia de disco/transporte não foram verificados e não eliminam a exposição no JSON autenticado.
- **Impacto:** extensão maliciosa, XSS, captura de resposta, log de frontend ou acesso administrativo indevido obtém credencial que a UI nem precisa exibir.
- **Correção proposta:** tornar segredo write-only; omitir do `GET` e do retorno do `PUT`; armazenar em secret manager ou criptografia de aplicação com chave separada; retornar apenas `correiosCredentialConfigured`; exigir reautenticação/rotação para troca.
- **Teste de regressão:** respostas nunca contêm o campo/valor; salvar outras configurações não apaga nem reenvia o segredo; rotação usa endpoint específico; snapshots/logs não o incluem.
- **Risco residual:** a credencial já armazenada deve ser rotacionada após mudança do desenho.

### ADM-008 — Trilha de auditoria administrativa é fragmentada e o histórico de status exibido não é alimentado

- **Severidade:** HIGH
- **Confiança:** CONFIRMED
- **Arquivos e linhas:** `services/order.service.ts:327-339,379-391,423-435`; `services/order.service.ts:238-243`; `components/admin/orders/OrderDetailDrawer.tsx:451-470`; `app/api/admin/orders/[orderId]/notes/route.ts:29-44`; `app/api/admin/orders/[orderId]/tracking/route.ts:29-46`; `services/user.service.ts:50-69`; `prisma/schema.prisma:352-395`
- **Pré-condições:** administrador altera status, nota, rastreio, catálogo, frete, configurações ou fidelidade.
- **Fluxo e condição de manifestação:** status e papel criam `AuditLog`; pontos criam ledger. Porém nenhuma criação de `OrderStatusHistory` foi encontrada fora das factories de teste, embora o detalhe consulte e a UI renderize essa tabela. Notas/rastreio atualizam diretamente. Produto, preço, estoque, regra de frete, configurações da loja e configuração de fidelidade também não criam trilha uniforme.
- **Evidência observada (fato):** a documentação descreve `OrderStatusHistory` como log de quem alterou status, mas o fluxo atual escreve outra tabela; a tela pode mostrar histórico vazio. A busca local por `orderStatusHistory.create/createMany` encontrou somente `tests/setup/factories.ts`.
- **Hipótese delimitada:** logs externos poderiam complementar a trilha, mas não são visíveis no repositório e não oferecem atomicidade demonstrada com a mutação.
- **Impacto:** não é possível reconstruir de forma confiável quem alterou preço, estoque, frete, segredo/configuração, nota ou rastreio; investigação, contestação e reversão ficam dependentes do estado atual.
- **Correção proposta:** definir fonte canônica; criar helper transacional de auditoria com ator, tenant, entidade, before/after, motivo, IP/request ID; alimentar a timeline a partir dela ou gravar `OrderStatusHistory` na mesma transação; proteger retenção e acesso.
- **Teste de regressão:** cada mutação sensível gera exatamente um evento atômico; rollback remove evento e efeito; timeline mostra sequência/ator corretos; eventos não vazam outro tenant nem valores secretos.
- **Risco residual:** auditoria registra ação, mas não substitui aprovação, alerta e backup.

### ADM-009 — Código de rastreio informado na transição para enviado é descartado silenciosamente

- **Severidade:** MEDIUM
- **Confiança:** CONFIRMED
- **Arquivos e linhas:** `components/admin/orders/OrderStatusManager.tsx:62-78,161-175`; `lib/validators/order.validators.ts:15-17`; `app/api/admin/orders/[orderId]/status/route.ts:14-25`; `services/order.service.ts:416-438`
- **Pré-condições:** pedido `PAID`; administrador seleciona `SHIPPED`, preenche rastreio e confirma.
- **Fluxo e condição de manifestação:** o componente envia `{ newStatus, trackingCode }`. O schema aceita somente `newStatus` e o comportamento padrão do Zod remove a chave desconhecida. A rota repassa apenas o status e o serviço atualiza somente `status`. A resposta é sucesso e o modal fecha.
- **Evidência observada (fato):** existe endpoint separado de rastreio, mas o modal de transição não o chama.
- **Hipótese delimitada:** a perda do campo foi demonstrada pelo contrato e pelo encadeamento de chamadas; a interação visual não foi executada porque o servidor local não pôde iniciar sem dependências.
- **Impacto:** pedido fica enviado sem o código digitado; cliente/atendimento perde rastreabilidade e o operador pode acreditar que a informação foi salva.
- **Correção proposta:** aceitar/validar `trackingCode` e persistir status+rastreio na mesma transação, ou remover o campo do modal e direcionar explicitamente ao editor separado. Tornar obrigatório conforme transportadora/política.
- **Teste de regressão:** `PAID -> SHIPPED` com rastreio persiste ambos atomicamente e aparece no detalhe; falha de um não confirma o outro; payload desconhecido não gera sucesso enganoso.
- **Risco residual:** validade do código junto à transportadora continua dependendo de integração externa.

### ADM-010 — Estoque geral e por variante podem ser configurados de forma divergente

- **Severidade:** MEDIUM
- **Confiança:** CONFIRMED
- **Arquivos e linhas:** `components/admin/ProductForm.tsx:21-36,284-300,339-400`; `lib/validators/product.ts:3-8,29-41`; `services/product.service.ts:116-149,169-193`; `services/inventory.service.ts:25-78,84-125`
- **Pré-condições:** administrador cria/edita produto com estoque geral diferente da disponibilidade coerente das variantes.
- **Fluxo e condição de manifestação:** UI e Zod validam cada número apenas como inteiro não negativo. Não há regra entre `Product.stock` e `ProductVariants.stock`. O checkout/reserva decrementa ambos para a mesma unidade, e o cancelamento incrementa ambos.
- **Evidência observada (fato):** os schemas aceitam, por exemplo, estoque geral zero e variantes positivas, ou estoque geral alto e variantes esgotadas; não existe validação cruzada.
- **Hipótese delimitada:** o impacto exato na vitrine depende de qual leitura de estoque cada tela faz; o checkout/reserva usa e altera ambos, conforme o serviço inspecionado.
- **Impacto:** falso esgotamento, disponibilidade incoerente entre catálogo e variante, falhas de checkout e reconciliação manual difícil.
- **Correção proposta:** definir formalmente a fonte de verdade. Se o pai é agregado, calculá-lo no servidor a partir das variantes e impedir edição independente; se é pool adicional, documentar a regra e validar limites. Registrar ajustes em ledger de estoque.
- **Teste de regressão:** payload divergente é normalizado/rejeitado; reserva e restauração mantêm a invariante; concorrência e remoção/arquivamento de variante preservam os totais.
- **Risco residual:** estoque de integrações externas ainda exige reconciliação periódica.

### ADM-011 — Testes administrativos estão incompletos e usam contrato de status obsoleto

- **Severidade:** MEDIUM
- **Confiança:** CONFIRMED
- **Arquivos e linhas:** `tests/integration/route-protection.test.ts:29-40,68-130`; `tests/integration/status-transitions.test.ts:24-124,426-490`; `lib/validators/order.validators.ts:15-17`; `app/api/admin/orders/[orderId]/status/route.ts:15-25`
- **Pré-condições:** suíte de integração é usada como gate de publicação.
- **Fluxo e condição de manifestação:** proteção de rotas testa ausência/token inválido e cross-tenant, mas não possui conta `CUSTOMER`. Os testes de status enviam `toStatus`, enquanto a API atual exige `newStatus`; também esperam `OrderStatusHistory`, que o serviço atual não cria. A matriz omite a maioria das rotas administrativas novas.
- **Evidência observada (fato):** os testes não refletem o contrato atual. Nesta máquina nem unitários nem integração iniciaram porque `vitest` não está instalado.
- **Hipótese delimitada:** o resultado real em CI não foi consultado; a inconsistência de contrato existe independentemente da execução.
- **Impacto:** regressões de autorização, rastreio, reembolso, papel, pontos, produto e frete podem passar sem cobertura; quando executados contra a API atual, os testes de status tendem a falhar antes do comportamento pretendido.
- **Correção proposta:** atualizar DTOs e factories; gerar matriz com anônimo/CUSTOMER/ADMIN/outro tenant para cada método; incluir efeitos observáveis e casos concorrentes; executar em CI com banco efêmero e falhar se uma rota admin não estiver inventariada.
- **Teste de regressão:** meta-teste descobre todas as rotas protegidas e exige casos por papel; casos usam `newStatus`; timeline/audit são verificados conforme a fonte canônica escolhida.
- **Risco residual:** mocks não substituem ensaio E2E com cookie, servidor e banco reais de teste.

### ADM-012 — Marcas e categorias existem no domínio, mas não podem ser administradas nem associadas pelo painel

- **Severidade:** MEDIUM
- **Confiança:** CONFIRMED
- **Arquivos e linhas:** `prisma/schema.prisma:121-150,469-515`; `services/brand.service.ts:21-74`; `components/admin/AdminSidebar.tsx:28-77`; `components/admin/ProductForm.tsx:111-128`; `lib/validators/product.ts:29-41`
- **Pré-condições:** operador precisa cadastrar, desativar, ordenar ou associar marca/categoria a produto.
- **Fluxo e condição de manifestação:** modelos `Brand`, `CategoryTag` e junção existem, e serviços os leem para o catálogo. O menu/páginas/rotas administrativas não oferecem CRUD. O payload do formulário de produto não contém `brandID` nem categorias.
- **Evidência observada (fato):** a capacidade administrativa não existe no repositório, embora o catálogo consuma esses dados.
- **Hipótese delimitada:** seed ou integração externa pode manter a taxonomia, mas nenhum fluxo administrativo versionado foi encontrado e nenhuma infraestrutura externa foi consultada.
- **Impacto:** filtros dependem de seed, importação ou intervenção direta no banco; operadores não conseguem manter taxonomia e associação por fluxo suportado.
- **Correção proposta:** criar CRUD tenant-scoped, arquivamento em vez de remoção destrutiva, ordenação e associação no formulário de produto; validar slugs/unicidade no servidor e auditar mudanças.
- **Teste de regressão:** CUSTOMER recebe `403`; admin de A não vê/altera B; produto associa/desassocia sem perder histórico; categoria/marca arquivada sai dos filtros sem apagar relações históricas.
- **Risco residual:** migração de taxonomia existente requer deduplicação e política de slug.

## 6. Itens não aplicáveis ou não encontrados

| Item solicitado | Classificação | Justificativa |
|---|---|---|
| Cupons | **NÃO APLICÁVEL nesta revisão** | não foi encontrado modelo, rota, serviço, componente ou campo de cupom; não é possível auditar CRUD/regras administrativas inexistentes |
| Cashback separado | **NÃO APLICÁVEL como módulo distinto** | o produto chama a funcionalidade de fidelidade/pontos; ela foi auditada como crédito com valor monetário |
| Ações em lote | **NÃO APLICÁVEL nesta revisão** | não foram encontrados endpoints ou controles bulk; a ausência foi registrada, sem inventar risco de implementação inexistente |
| Reembolso iniciado no painel | **AUSENTE, não N/A** | o domínio de pagamento recebe webhook de reembolso, portanto a falta de comando administrativo é material e compõe `ADM-001` |
| Gestão mutável de clientes | **NÃO ENCONTRADA** | o painel oferece consulta, métricas e pedidos; não há bloqueio, edição ou exclusão de cliente nesta área |
| DELETE de pedido/cliente/usuário | **NÃO APLICÁVEL** | não foram encontradas essas operações; pedidos usam transição de estado e usuários usam mudança de papel |
| Segunda aprovação/segregação de funções | **NÃO ENCONTRADA** | só existem papéis `ADMIN` e `CUSTOMER` aceitos pela rota de papel; não há permissão granular |

## 7. Evidências reproduzíveis e comandos

Todos os comandos foram executados na revisão `0c7ef7d`, em PowerShell, sem rede.

| Comando/verificação | Resultado resumido |
|---|---|
| `rg --files app/admin app/api/admin components/admin` | inventário das páginas, componentes e rotas administrativas |
| busca por `export async function` + `requireAdmin` em `app/api` | todas as rotas administrativas inventariadas possuem guard; rotas administrativas fora de `/api/admin` também foram incluídas |
| `rg -n "auditLog\.(create\|createMany)" ...` | gravações encontradas nos fluxos de papel/status; mutações de produto, frete, settings, notas e tracking sem gravação correspondente |
| busca por `orderStatusHistory.create/createMany` | somente factory de teste; nenhuma gravação no fluxo de produção |
| busca por `refund/reembolso/estorno` e métodos do `AsaasClient` | webhook reage a refund; cliente possui criar/consultar cobrança, sem operação de refund encontrada |
| inspeção de `prisma/schema.prisma` | `OrderItem` referencia produto/variante; não há soft delete em `Product`; credencial dos Correios é string em `Loja` |
| `npm run test:unit` | **falhou antes dos testes**: `vitest` não reconhecido; `node_modules` ausente |
| `npm run test:integration` | **falhou antes dos testes**: `vitest` não reconhecido; `node_modules` ausente |
| `node --version` / `npm --version` | Node `v24.16.0`; npm `11.13.0` |

Não foi executado `npm install`/`npm ci`, pois a etapa autoriza apenas a criação deste relatório e não requer alteração do ambiente. O guia local do Next em `node_modules/next/dist/docs` também não estava disponível porque `node_modules` não existe; nenhum código de produto foi escrito.

## 8. Verificações pendentes

1. Executar, em ambiente efêmero autorizado com dependências instaladas, a matriz completa anônimo/CUSTOMER/ADMIN/outro tenant para todos os endpoints da seção 3.
2. Reproduzir `ADM-004` com duas requisições concorrentes de rebaixamento e com admin secundário bloqueado.
3. Reproduzir `ADM-005` com Postgres real: produto/variante referenciado por `OrderItem`, edição simples e exclusão.
4. Confirmar com fixture que regra negativa pode ser persistida na migração atual e demonstrar o total calculado, sem criar pedido real.
5. Simular retry idêntico de ajuste de pontos e medir o efeito duplicado no ledger/carteira.
6. Verificar políticas externas de criptografia, rotação e acesso à credencial dos Correios; o JSON ao navegador continua confirmado no código.
7. Homologar visualmente confirmações, mensagens de erro, foco e recuperação depois que o servidor local puder iniciar.
8. Verificar procedimento operacional real de reembolso/conciliação no Asaas; nenhum procedimento versionado foi encontrado.

## 9. Dívida priorizada

1. **P0 financeiro:** separar cancelamento de reembolso e implementar workflow idempotente/reconciliável (`ADM-001`).
2. **P0 integridade:** bloquear frete negativo e tornar ajuste de pontos idempotente, limitado e confirmado (`ADM-002`, `ADM-003`).
3. **P0 acesso:** preservar atomicamente ao menos um `ADMIN ACTIVE` por loja (`ADM-004`).
4. **P0 segredo:** retirar credencial dos Correios das respostas e rotacionar valores existentes (`ADM-007`).
5. **P1 catálogo:** atualizar variantes por ID e substituir delete físico por arquivamento (`ADM-005`, `ADM-006`).
6. **P1 governança:** adotar auditoria transacional uniforme e alimentar a timeline canônica (`ADM-008`).
7. **P1 operação:** persistir rastreio com status e definir fonte de verdade do estoque (`ADM-009`, `ADM-010`).
8. **P1 regressão:** reconstruir a matriz por papel/método e atualizar contratos de teste (`ADM-011`).
9. **P2 completude:** criar gestão tenant-scoped de marcas/categorias se fizer parte do produto publicado (`ADM-012`).

## 10. Riscos residuais

- A análise de autorização dinâmica não foi concluída; a conclusão de 401/403 é baseada no caminho do código e deve ser confirmada com servidor e banco de teste.
- Um administrador é, por definição atual, superusuário da loja. Mesmo após correções, abuso intencional exige separação de funções, reautenticação, alertas e revisão de trilha.
- Configurações cloud, políticas de banco, backups, criptografia de storage e processos manuais externos não são visíveis nesta etapa.
- O painel depende de serviços externos para pagamento, CEP, frete e upload; indisponibilidade e permissões reais desses serviços não foram testadas.
- Dados já inconsistentes — frete negativo, variantes legadas, estoques divergentes ou segredo exposto — não são corrigidos apenas por validação futura.

## 11. Conclusão limitada ao escopo

A autorização server-side e o isolamento de tenant estão presentes de forma consistente no conjunto inspecionado; não foi confirmada escalada direta de `CUSTOMER` para ação administrativa. Essa afirmação é limitada à análise estática, pois a execução HTTP com contas fictícias ficou pendente por ausência de dependências locais.

O painel, porém, não deve ser publicado para operação financeira completa enquanto o cancelamento de pedido pago não estiver acoplado a um workflow explícito de reembolso. Frete negativo, ajustes de pontos repetíveis/ilimitados, perda concorrente do último administrador ativo e circulação da credencial dos Correios no navegador também exigem correção antes da publicação. Os demais achados afetam continuidade operacional, rastreabilidade e manutenção do catálogo e devem entrar no primeiro ciclo de estabilização.

Esta conclusão cobre somente a Etapa 13/15. Nenhuma correção foi aplicada e nenhuma etapa seguinte foi iniciada.
