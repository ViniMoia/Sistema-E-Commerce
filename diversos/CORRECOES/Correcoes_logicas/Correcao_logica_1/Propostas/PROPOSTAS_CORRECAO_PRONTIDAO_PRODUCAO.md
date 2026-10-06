# Propostas de correção e critérios de prontidão para produção

## 1. Finalidade e limites

**Data:** 03/10/2026.  
**Documento de origem:** [Auditoria de Lógica do Sistema](../../relatorio_geral/logic-audit-report.md).  
**Cobertura:** propostas individuais para **LA-001 a LA-038**, sem excluir os findings de severidade média.  
**Situação:** **propostas ainda não implementadas nem homologadas**.

Este documento transforma os 38 achados da auditoria em um plano técnico verificável, com solução recomendada, impacto em dados existentes, dependências, testes, critérios de aceite e cuidados de implantação. A classificação original é preservada: 6 CRITICAL, 23 HIGH e 9 MEDIUM. A ordem de execução considera dependências e risco de introduzir regressões, não apenas a severidade.

O objetivo é permitir que o projeto alcance condições demonstráveis de produção **após** implementação, reconciliação de dados e homologação. A existência deste plano não torna o sistema pronto. Passar typecheck ou testes unitários isolados também não substitui validação de concorrência, gateway, migrações, recuperação e operação.

**Não houve implementação nesta etapa:** nenhum código, teste, configuração, schema, migration ou banco foi alterado; nenhum job, pagamento, estorno ou rotação de credencial foi executado; nenhum commit foi feito. Somente este arquivo de propostas foi criado. O relatório original e as alterações locais preexistentes foram preservados.

Os nomes de entidades e estados novos, como CheckoutIntent, PaymentAttempt, reserva, lote de pontos e inbox/outbox, são **desenhos propostos**, não componentes já existentes. Devem ser ajustados ao modelo final sem perder as invariantes descritas. Não há código de correção nem SQL executável neste documento.

## 2. Base analisada e fundamentos

Foram revisados os 38 achados, suas condições/evidências e as regras do AGENTS.md. A conferência dirigida incluiu schema Prisma, assinatura de cotação, cálculo/configuração de parcelas, prazos de pagamento, criação de pedido e devolução de pontos. As versões locais informadas na auditoria são Next.js 16.3.5, Prisma 5.22.0 e TypeScript 5.9.3; a proposta não depende de atualizá-las para resolver os findings.

A documentação instalada do Next.js foi consultada para Route Handlers, cache e revalidação. A guia de revalidação com Cache Components só é aplicável se esse modo estiver habilitado; não se propõe ativá-lo indiscriminadamente. Nenhuma proteção de concorrência é delegada ao ciclo de vida de React ou ao fato de a entrada ser uma Server Action/Route Handler.

### 2.1. Referências externas usadas com escopo limitado

- A documentação PostgreSQL descreve locks de linha e a necessidade de ordem consistente para reduzir deadlocks. As propostas usam transações curtas, releitura protegida e uma ordem comum entre escritores; não tratam o lock como proteção de chamadas remotas. A versão exata do PostgreSQL implantado ainda deverá ser conferida na implementação. [PostgreSQL — explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html).
- O guia Asaas de cobranças recomenda acompanhar operações por eventos/consulta e reconciliar respostas inconclusivas antes de repetir a criação. O plano distingue confirmação local, estado financeiro e resultado incerto; não presume que externalReference imponha unicidade no provedor. [Asaas — guia de cobranças](https://docs.asaas.com/docs/guia-de-cobrancas).
- No contrato consultado de parcelamento, parcela única usa value; parcelamento usa quantidade com installmentValue ou totalValue. A documentação distingue ID da cobrança e ID do parcelamento e prevê diferença de centavos na última parcela quando aplicável. A proposta LA-009 exige validar esses contratos no método/conta utilizados e armazenar a correspondência dos IDs, em vez de assumir que o primeiro ID representa todas as parcelas. [Asaas — criar cobrança parcelada](https://docs.asaas.com/docs/criar-uma-cobranca-parcelada).

As demais escolhas de arquitetura são recomendações derivadas do código e dos cenários locais. Não foram executadas consultas ao gateway, testes novos ou verificações de banco nesta etapa documental. Os 437 testes aprovados citados pela auditoria são evidência **da auditoria anterior**, não validação destas propostas.

## 3. Decisões transversais recomendadas

### 3.1. Uma operação de compra, vários adaptadores de entrada

POST /api/checkout e qualquer criação equivalente devem convergir para um comando de domínio único. A identidade autorizada e a loja chegam explícitas ao serviço; variantes, preços, frete e pontos são resolvidos no servidor. Dados de apresentação do cliente não são autoridade monetária nem autorização.

Validação de formato, autorização e regra de negócio são etapas diferentes. O serviço deve manter as invariantes também quando invocado por outro handler, job ou integração. Compartilhar DTOs e funções puras com o frontend não significa importar Prisma, segredos ou módulos de servidor para componentes cliente. A sessão convidada comprova posse daquele contexto de compra, não a identidade civil nem a titularidade do email informado; ela nunca concede acesso à conta de mesmo email.

Uma revisão da compra identifica os valores e condições aceitos. Mudança de preço, cotação, parcelas ou resgate exige atualizar a revisão e obter nova confirmação antes da cobrança; não basta recalcular silenciosamente e cobrar um total diferente.

### 3.2. Separar quatro estados que hoje se confundem

| Dimensão proposta | O que representa | Garantia necessária |
|---|---|---|
| Intenção de compra | Uma operação autorizada sobre versão conhecida de itens/condições | Retry e duas abas reencontram a mesma intenção consumível; nova intenção não contorna compra anterior incerta. |
| Pedido comercial/logístico | Recebido, pago segundo política, expedido, entregue, cancelamento solicitado/concluído quando necessário | Transição autorizada sob versão/lock; não inventa quitação nem devolução financeira. |
| Tentativa/contrato financeiro | Em criação, pendente, aprovado, recusado, incerto, cancelamento/estorno solicitado ou confirmado | Cada operação remota é rastreável; timeout não equivale a recusa, CANCELLED local não equivale a REFUNDED. |
| Reserva/estoque | Unidade reservada, consumida, liberada ou devolvida para destino vendável/indisponível | Uma mesma unidade não é liberada duas vezes e opção retirada não volta a vender por cancelamento. |

Os nomes finais dos estados devem ser fechados antes das migrations. A separação não exige necessariamente quatro serviços externos: pode ser implementada no monólito atual com tabelas, comandos e transações bem definidos.

### 3.3. Transações, locks e repetição de efeitos

- Toda decisão que depende do estado mutável de pedido/carrinho/carteira será relida dentro da transação que a consome. Comparar versão/estado na escrita e conferir o resultado faz parte do protocolo.
- Padronizar uma ordem de aquisição entre os escritores. Para operações que tocam todos os recursos, uma ordem candidata é intenção/carrinho → pedido existente → produtos ordenados → variantes ordenadas → carteira/lotes. Validar o grafo real, inclusive criação de usuários, FKs e Admin; nenhum caminho pode tomar a ordem inversa. Locks administrativos por loja devem ser analisados separadamente para não criar inversões.
- Produto deve ser bloqueado antes de reconciliar variantes conforme AGENTS.md. Ordenar todos os IDs relevantes, inclusive em pedidos com vários produtos, para evitar ordens diferentes por posição do carrinho.
- Usar uma única TransactionClient por operação interna. Serviço chamado com tx não abre outra transação independente nem lê um saldo relevante fora dela.
- Não manter locks enquanto consulta gateway, transportadora, email ou ViaCEP. Chamada remota não é revertida pelo rollback SQL.
- Chaves únicas de efeito devem identificar a operação efetiva. Uma unicidade ingênua por pedido+tipo não representa múltiplos estornos parciais legítimos; cada estorno/lote precisa de identidade própria e limites sobre o total.
- Retentar transação apenas para conflitos transitórios identificados, de forma limitada e com mesma identidade lógica. Retentar cobrança externa é decisão financeira separada.
- Constraints são segunda barreira: criar apenas depois de tratar legados e todos os escritores. Não adicionar CHECK que paralise cancelamento porque o cliente já gastou pontos; LA-021 propõe tratamento explícito do déficit.

### 3.4. Processamento durável sem presumir infraestrutura inexistente

Recomenda-se inbox para eventos recebidos e outbox para comandos/notificações a executar. Podem começar no PostgreSQL com consumidor acionado por executor/scheduler confiável, lease, retries e fila de revisão; não é necessário introduzir Kafka ou outro sistema apenas por padrão arquitetural.

A garantia é **entrega repetível com efeitos deduplicados e reconciliáveis**, não uma promessa de exatamente uma execução através de rede e dois bancos independentes. Um webhook pode ser recebido várias vezes. Um processo pode morrer após o provedor aceitar e antes de salvar o resultado. O desenho precisa continuar correto nesses pontos.

Confirmar recebimento de evento após persistência só é aceitável se existe consumidor retomável com monitoramento. Uma Promise iniciada e não aguardada num request não substitui esse consumidor. E-mails e avisos precisam de identidade de notificação para não duplicar por retry.

### 3.5. Regras de domínio que não podem ser perdidas

| Tema | Decisão recomendada para o desenho | Condição antes da ativação |
|---|---|---|
| Variantes neutras | Manter Único/Padrão, aceitar equivalentes legados normalizados e exigir só dimensões distintas. | Todos os caminhos usam identidade canônica e preservam IDs. |
| Estoque agregado | Preservar os limites atuais até auditar seu significado; não supor que Product.stock já seja soma das variantes. | Fonte autoritativa e equações de reserva/reposição documentadas e testadas. |
| Variante retirada | Separar disponibilidade administrativa de quantidade; manter vínculos e restituição física em destino indisponível quando necessário. | Retirada/reativação são ações explícitas e nenhum escritor ignora o estado. |
| Convidados | Preservar guest apenas com comprador separado de conta e autorização de recuperação própria. Exigir login é alternativa de escopo explícita. | Modelos/leitores e política de benefício suportam a escolha; não vincular por email declarado. |
| Preço alterado | Informar novo total e pedir confirmação de nova revisão. | Não cobrar valor diferente do consentido. |
| Parcelamento | Servidor calcula encargos e total, separando valores comerciais/financeiros. | Homologação dos campos, centavos, limites e aprovação integral do contrato. |
| Cartão parcelado | Liberação comercial pode depender da aprovação do contrato de cartão, sem esperar meses de liquidação das parcelas. | Evidência de aprovação integral e mapeamento dos IDs; não equiparar recebimento de um boleto parcial a quitação do todo. |
| Reserva e expiração | Prazo por método e estado externo; operação incerta entra em reconciliação. | Limites de retenção, tratamento de pagamento tardio e intervenção operacional definidos. |
| Ganho de pontos | Base líquida de desconto de fidelidade, sem frete/encargos, com regra congelada no aceite. | Produto/financeiro validam a política antes de alterar a vigente. |
| Validade/devolução de pontos | Lotes com prazo explícito; consumo por vencimento mais próximo; compensação identificada se crédito devolvido já venceu. | Política de legado, déficit e ajustes aprovada; nada expira por origem desconhecida. |
| LTV | Fatos financeiros reconhecidos menos estornos confirmados, com composição exposta. | Eventos/legados conciliados e mesma fórmula na lista e no perfil. |
| Rastreio | Obrigatoriedade conforme modalidade/provedor; retirada não recebe código fictício. | Contrato de expedição salva tudo que promete atomicamente. |

Estas são decisões propostas para viabilizar a implementação, não alterações já aprovadas ou executadas no domínio. A equipe deverá registrá-las antes de codificar os blocos correspondentes; não há necessidade de responder a um questionário para usar este documento.

## 4. Matriz de propostas e ordem de fechamento

As fases indicam ordem de integração e fechamento, não autorização para implementar nesta conversa:

- **F0 — base segura:** isolamento dos testes, trajetória de schema e proteção de credenciais.
- **F1 — invariantes de dados e identidade:** transições, atores, carrinho, variantes, carteira e autenticação.
- **F2 — compra e pagamento completos:** comando único, idempotência, frete, parcelas, recuperação e reconciliação.
- **F3 — consumidores e operação funcional:** UI, persistência de estado, expedição, recuperação e indicadores.
- **F4 — homologação e liberação:** verificação integrada, recuperação, carga, operação e critérios da seção8.

O desenho de F1/F2 deve ser revisado em conjunto **antes** de fixar migrations: relações como estado financeiro, ator de sistema e comprador convidado não podem ser introduzidas por patches desconectados. Dependências dentro da mesma fase representam entregas coordenadas, não necessariamente uma sequência por número do finding.

| Finding | Severidade original | Fase | Proposta | Principal ponto atual |
|---|---|---|---|---|
| LA-001 | CRITICAL | F2 | Preservar e validar a variante até a reserva e o pedido | `components/checkout/CheckoutForm.tsx` |
| LA-002 | CRITICAL | F1 | Centralizar transições e executar seus efeitos uma única vez | `services/order.service.ts` |
| LA-003 | CRITICAL | F2 | Transformar webhooks em eventos duráveis e recuperáveis | `app/api/webhooks/asaas/route.ts` |
| LA-004 | CRITICAL | F2 | Dar identidade durável à intenção de checkout | `components/checkout/CheckoutForm.tsx` |
| LA-005 | CRITICAL | F2 | Separar pedido, reserva e estado financeiro com reconciliação | `services/checkout.service.ts` |
| LA-006 | CRITICAL | F0 | Isolar de forma verificável o banco de testes | `tests/setup/db.ts` |
| LA-007 | HIGH | F3 | Unificar o contrato da cotação consumido pelo formulário | `components/checkout/CheckoutForm.tsx` |
| LA-008 | HIGH | F2 | Tornar a cotação de frete autoritativa e vinculada à compra | `services/checkout.service.ts` |
| LA-009 | HIGH | F2 | Calcular e conciliar parcelamento no servidor | `services/checkout.service.ts` |
| LA-010 | HIGH | F2 | Expirar por método e estado remoto, com proteção contra corrida | `services/order-timeout.service.ts` |
| LA-011 | HIGH | F2 | Escopar idempotência à identidade autorizada e ao conteúdo | `services/checkout.service.ts` |
| LA-012 | HIGH | F2 | Retornar e retomar o estado real no replay | `services/checkout.service.ts` |
| LA-013 | HIGH | F2 | Fazer todos os caminhos de compra usarem o mesmo comando | `services/order.service.ts` |
| LA-014 | HIGH | F1 | Aplicar isolamento de loja a todos os recursos da compra | `services/cart.service.ts` |
| LA-015 | HIGH | F2 | Consumir um carrinho somente uma vez | `services/order.service.ts` |
| LA-016 | HIGH | F3 | Sincronizar o ciclo persistido do carrinho com o cliente | `store/cart.store.ts` |
| LA-017 | HIGH | F1 | Serializar mutações do carrinho e garantir um ativo por dono/loja | `services/cart.service.ts` |
| LA-018 | HIGH | F1 | Separar retirada de variante de quantidade disponível | `services/product.service.ts` |
| LA-019 | HIGH | F1 | Separar edição de catálogo de ajuste de estoque | `services/product.service.ts` |
| LA-020 | HIGH | F1 | Separar comprador convidado de conta autenticada | `services/checkout.service.ts` |
| LA-021 | HIGH | F1 | Rastrear a origem e o prazo de cada crédito de fidelidade | `services/loyalty.service.ts` |
| LA-022 | HIGH | F1 | Tornar expiração idempotente por crédito e transacional por carteira | `services/loyalty.service.ts` |
| LA-023 | MEDIUM | F2 | Fixar a política de ganho no snapshot aceito da compra | `services/order.service.ts` |
| LA-024 | HIGH | F3 | Separar endereço de cobrança de modalidade de entrega | `lib/validators/checkout.validators.ts` |
| LA-025 | HIGH | F3 | Exibir o estado completo do pedido e do pagamento na confirmação | `app/checkout/confirmation/page.tsx` |
| LA-026 | MEDIUM | F3 | Persistir rastreio na mesma operação que confirma expedição | `lib/validators/order.validators.ts` |
| LA-027 | MEDIUM | F1 | Registrar histórico no mesmo commit da transição | `services/order.service.ts` |
| LA-028 | MEDIUM | F1 | Consumir token de recuperação atomicamente | `services/auth.service.ts` |
| LA-029 | HIGH | F1 | Proteger existência de administrador ativo sob concorrência | `services/user.service.ts` |
| LA-030 | HIGH | F0 | Reconstituir uma trajetória de migrations reproduzível | `prisma/schema.prisma` |
| LA-031 | MEDIUM | F2 | Fazer a chave de cache representar todos os determinantes do frete | `services/freight/orchestrator.service.ts` |
| LA-032 | MEDIUM | F1 | Restringir carteira à identidade da sessão e tornar simulação leitura | `app/api/loyalty/simulate/route.ts` |
| LA-033 | HIGH | F1 | Modelar atores de sistema e registro financeiro sem FKs fictícias | `app/api/webhooks/asaas/route.ts` |
| LA-034 | MEDIUM | F3 | Aplicar respostas assíncronas somente à revisão correspondente | `components/checkout/CheckoutForm.tsx` |
| LA-035 | HIGH | F2 | Validar capacidade real de cada método antes de reservar | `services/checkout.service.ts` |
| LA-036 | MEDIUM | F3 | Definir LTV por fatos financeiros reconhecidos | `services/customer.service.ts` |
| LA-037 | MEDIUM | F3 | Usar a política única de transições com modalidade | `services/order.service.ts` |
| LA-038 | HIGH | F0 | Separar DTO público de configurações secretas da loja | `services/loja.service.ts` |

## 5. Propostas individuais

### [LA-001] Preservar e validar a variante até a reserva e o pedido

**Achado de origem:** Checkout perde a identidade da variante e permite vender opção sem estoque.  
**Severidade original:** CRITICAL. **Fase de fechamento:** F2.  
**Ponto principal atual:** `components/checkout/CheckoutForm.tsx`; demais consumidores e evidências estão no finding correspondente da auditoria.  
**Dependências e integração:** LA-002, LA-014, LA-018, LA-019; contrato único de LA-013.

#### Diagnóstico e objetivo

O ID é descartado pelo formulário e opcional no backend; quantidade e descritores não identificam, por si só, a opção efetivamente vendida.

#### Proposta de correção

1. Definir um item canônico de compra com productId, variantId e quantidade inteira positiva. Manter o ID persistido do carrinho na transformação para checkout; nomes/cor/tamanho/preço apresentados ao cliente não serão autoridade para localizar ou precificar uma variante.
2. Usar lib/product-variants.ts para compatibilidade de combinações e neutralidade. Na transição de clientes antigos, resolver ausência de ID somente quando houver uma única combinação válida e inequívoca; ambiguidade, variante retirada ou estoque insuficiente devem produzir rejeição explícita. Nunca escolher findFirst como substituto da intenção.
3. Dentro da transação, conferir produto/variante/loja, disponibilidade e vínculo; agregar linhas repetidas pela variante antes de reservar. Reservar as quantidades e gravar a identidade resolvida na mesma transação.
4. Conservar Único/Padrão e a chave interna separada do useFieldArray. O tratamento de produto sem opções visíveis deve continuar apontando à sua variante canônica; o frontend não deverá exigir seleção de dimensões constantes.

#### Dados existentes e mudanças de modelo

Não converter indiscriminadamente OrderItem.productVariantsId em NOT NULL: itens históricos podem ter perdido vínculo por exclusão. Para novas vendas, registrar identidade na reserva e no snapshot do item. Auditar os 33 itens citados no relatório e seus vínculos; preencher apenas correspondências demonstráveis, sem reservar/devolver estoque retroativamente pelo simples preenchimento. Casos ambíguos ficam explicitamente pendentes de reconciliação.

#### Testes e validações a executar na implementação

- Produto10/variante0 deve falhar sem criar pedido, reserva ou débito; produto e variante com estoque suficiente devem cair juntos pela quantidade correta.
- Com duas conexões PostgreSQL concorrentes disputando a última unidade da mesma variante, apenas uma compra confirma a reserva.
- Cobrir variante de outro produto/loja, duas linhas da mesma variante, variante removida, produto neutro, payload antigo inequívoco/ambíguo e ID sobrevivendo a formulário→API→OrderItem.

#### Critério de aceite

Toda nova venda do catálogo identifica uma variante válida e reserva exatamente a opção persistida; compra rejeitada não deixa efeitos.

#### Implantação e reversibilidade

Publicar primeiro backend compatível e observável, depois cliente que sempre envia ID, depois encerrar fallback antigo quando a telemetria não registrar consumidores legítimos; não reintroduzir ausência irrestrita de variante em rollback.

### [LA-002] Centralizar transições e executar seus efeitos uma única vez

**Achado de origem:** Transições concorrentes duplicam estorno e podem sobrescrever o estado do pedido.  
**Severidade original:** CRITICAL. **Fase de fechamento:** F1.  
**Ponto principal atual:** `services/order.service.ts`; demais consumidores e evidências estão no finding correspondente da auditoria.  
**Dependências e integração:** LA-027 e LA-033 são parte do desenho de transição; integração financeira de LA-005 usa este comando.

#### Diagnóstico e objetivo

A transição usa estado lido antes da transação; serializar somente as escritas não protege a decisão nem a reposição.

#### Proposta de correção

1. Criar um único comando de transição de domínio usado por Admin, webhook, cron e confirm-delivery. Carregar pedido, loja, modalidade e estado atual sob bloqueio de linha dentro da mesma transação; validar autorização/contexto e transição nessa leitura.
2. Atualizar com predicado de estado/versão esperados e conferir quantidade de linhas alteradas. Repetição do mesmo comando pode devolver o resultado anterior, mas nunca reaplicar estoque, pontos ou histórico. Um comando conflitante deve falhar com conflito de estado, não ser reinterpretado silenciosamente.
3. Persistir identificador único do comando/efeito e registros de reserva/baixa/liberação. A restituição deve consumir a reserva ainda ativa; não inferir que qualquer PENDING/PAID implica reserva não devolvida.
4. Executar estoque, ledger, status, histórico e evento de auditoria pela mesma TransactionClient. Consumidores recebem essa transação em vez de abrir outra independente. Emails, gateway e notificações ficam fora dela e são representados por trabalho durável.
5. Padronizar ordem de locks nos comandos de pedido e inventário; definir retries limitados apenas para conflitos transitórios de banco, usando o mesmo ID lógico.

#### Dados existentes e mudanças de modelo

Propor Order.version e identidade única para transição/efeito/reserva, ou estrutura equivalente. Reconciliar pedidos existentes antes de marcar uma reserva como ativa; não deduzir automaticamente sua existência só pelo status. O desenho inclui as identidades de ator de LA-033 e histórico de LA-027.

#### Testes e validações a executar na implementação

- Duas transações cancelando o mesmo pedido: uma única restituição; duas confirmações: um único crédito.
- PAID×CANCELLED, CANCELLED×confirm-delivery e SHIPPED×CANCELLED: resultado permitido pela política, sem efeitos dos comandos perdedores.
- Injetar erro entre status, estoque, pontos e histórico: tudo interno reverte. Retry do comando concluído não altera saldos.

#### Critério de aceite

Nenhum caminho muda estado sem a validação protegida; cada reserva, débito/crédito e histórico possui uma única aplicação verificável.

#### Implantação e reversibilidade

Introduzir o comando compartilhado, migrar todos os escritores e só então remover escritores antigos. Durante coexistência, não habilitar novos consumidores se algum caminho puder ignorar locks/identidades.

### [LA-003] Transformar webhooks em eventos duráveis e recuperáveis

**Achado de origem:** Webhook registra o evento como processado antes de aplicar seus efeitos.  
**Severidade original:** CRITICAL. **Fase de fechamento:** F2.  
**Ponto principal atual:** `app/api/webhooks/asaas/route.ts`; demais consumidores e evidências estão no finding correspondente da auditoria.  
**Dependências e integração:** LA-002, LA-005, LA-009, LA-033; executor durável definido antes da ativação.

#### Diagnóstico e objetivo

O registro de deduplicação atual representa recebimento e conclusão como se fossem a mesma coisa.

#### Proposta de correção

1. Evoluir PaymentWebhookEvent para inbox durável, com estados RECEIVED, PROCESSING, PROCESSED e FAILED_RETRYABLE/NEEDS_REVIEW, tentativas, próxima tentativa, erro sanitizado, timestamps e lease de processamento.
2. Autenticar e validar o envelope antes de persistir; identificar evento por provedor, conta e eventId. Não usar horário corrente como identidade substituta. Na ausência de ID exigido pelo contrato, rejeitar/quarentenar de forma observável ou usar identidade determinística previamente especificada.
3. Consumidor reivindica eventos com exclusão e lease; morte do processo permite nova tentativa. Efeitos de banco e marcação PROCESSED devem commitar juntos, utilizando o comando de LA-002. Repetição encontra o resultado ou a pendência, nunca um sucesso fictício.
4. Responder confirmação de recebimento somente após persistência durável, se o consumidor e seu agendamento tiverem entrega/retry monitorados; falha antes disso deve continuar reentregável. Distinguir no monitoramento recebido de processado.
5. Resolver ordem externa por paymentId/conta/referência vinculados e fatos financeiros conciliados. Evento atrasado não pode regredir um pagamento confirmado para pendente; divergência de valor/identidade vira pendência. Notificações decorrentes são outbox deduplicada, não Promise solta.

#### Dados existentes e mudanças de modelo

Adicionar os campos/índices necessários ao inbox, sem presumir que processedAt antigo comprova efeito concluído. Identificar eventos legados sem efeito correspondente e reconciliar com gateway; só reprocessar pela nova deduplicação de efeitos. Não apagar todos os marcadores antigos para forçar retry.

#### Testes e validações a executar na implementação

- Falhar antes/depois do recebimento durável, durante efeito e antes de marcar PROCESSED; reiniciar consumidor.
- Entregar o mesmo evento simultaneamente e eventos distintos equivalentes; testar evento antes de persistir paymentId e fora de ordem.
- Evento incorreto/outro tenant deve ser isolado sem mudar pedido; fila atrasada gera alerta e processamento retomável.

#### Critério de aceite

Evento aceito é processado ou permanece numa pendência visível com mecanismo de retomada; falha não suprime novas tentativas e repetição não duplica efeitos.

#### Implantação e reversibilidade

Publicar schema e consumidor antes de passar a confirmar recebimento assíncrono. Validar backlog e capacidade; rollback suspende novas reivindicações, mas preserva inbox/outbox e evidência.

### [LA-004] Dar identidade durável à intenção de checkout

**Achado de origem:** Checkout oficial não fornece chave de idempotência.  
**Severidade original:** CRITICAL. **Fase de fechamento:** F2.  
**Ponto principal atual:** `components/checkout/CheckoutForm.tsx`; demais consumidores e evidências estão no finding correspondente da auditoria.  
**Dependências e integração:** LA-011, LA-012, LA-015 e LA-020 formam o contrato; LA-005 controla a tentativa externa.

#### Diagnóstico e objetivo

Um botão desabilitado não deduplica submissão perdida, reload ou duas abas.

#### Proposta de correção

1. Criar intenção de checkout no servidor ligada a tenant, sujeito autenticado ou sessão convidada verificada e versão do carrinho. O cliente mantém seu identificador opaco entre reloads e retries; a mesma versão consumível do carrinho reencontra a mesma intenção entre abas.
2. Exigir chave/ID no comando de conclusão; deduplicar no banco com unicidade do escopo, não com uma busca seguida de create desprotegido.
3. Congelar o conteúdo aceito com hash de campos canônicos de negócio: itens, quantidades, entrega, cotação, forma/plano de pagamento e resgate. O mesmo ID com conteúdo diferente deve ser conflito, não nova cobrança. Não incluir PAN/CVV no hash persistido.
4. Gerar nova intenção apenas quando houver mudança explícita ou decisão de nova compra após resolver a anterior. Estado incerto não autoriza trocar a chave. Registrar o vínculo intenção→pedido→tentativa de pagamento.

#### Dados existentes e mudanças de modelo

Propor CheckoutIntent ou equivalente, unicidade por carrinho/versão consumida e escopo da chave. Pedidos antigos sem chave continuam consultáveis; não inventar que pedidos históricos semelhantes eram necessariamente duplicados.

#### Testes e validações a executar na implementação

- Perder resposta após commit e repetir pelo mesmo cliente: mesmo pedido e tentativa.
- Duas abas sobre mesma versão do carrinho e chaves de transporte distintas: apenas uma intenção consumida.
- Mesma chave com mudança de quantidade/plano deve retornar conflito; nova compra explicitamente iniciada depois de conclusão deve funcionar.

#### Critério de aceite

Repetição da mesma intenção cria no máximo um pedido e não inicia nova cobrança enquanto a anterior estiver ativa ou incerta.

#### Implantação e reversibilidade

Disponibilizar emissão de intenção e cliente novo antes de exigir o campo. Encerrar endpoint sem intenção ao terminar a transição; manter leitura dos pedidos antigos.

### [LA-005] Separar pedido, reserva e estado financeiro com reconciliação

**Achado de origem:** Cancelamento local e falha pós-cobrança não reconciliam a operação no gateway.  
**Severidade original:** CRITICAL. **Fase de fechamento:** F2.  
**Ponto principal atual:** `services/checkout.service.ts`; demais consumidores e evidências estão no finding correspondente da auditoria.  
**Dependências e integração:** LA-002, LA-003, LA-004, LA-009 a LA-012, LA-033, LA-035; política de reservas na seção de decisões.

#### Diagnóstico e objetivo

Falha de transporte não prova falha financeira; cancelar no banco não é cancelar/reembolsar no provedor.

#### Proposta de correção

1. Persistir uma tentativa de pagamento antes da chamada externa, com ID de correlação estável, valor autorizado, moeda, método, conta, estado e vínculo ao pedido. Estados propostos: NOT_STARTED, SUBMITTING, UNKNOWN, PENDING, APPROVED, DECLINED, CANCEL_PENDING, CANCELLED, REFUND_PENDING, REFUNDED; distinguir autorização/captura se o método exigir.
2. Manter chamadas remotas fora de transações com locks. Em timeout, interrupção ou falha local depois da chamada, mover para UNKNOWN ou deixar a tentativa recuperável: não liberar reserva nem repetir create automaticamente.
3. Conciliar por IDs remotos e correlação, webhooks e consultas. ExternalReference serve à correlação; não presumir unicidade ou idempotência remota. Usar idempotência do provedor somente se o endpoint efetivamente a garantir e ela for homologada. Consulta vazia imediata não é prova definitiva de que não houve criação.
4. Se persistir ambiguidade, bloquear nova cobrança daquela intenção e encaminhar revisão operacional com alerta e prazo; para uma nova tentativa, registrar por que a anterior foi definitivamente recusada/não criada/cancelada. Impedir concorrência entre executores por lease/versão.
5. Cancelamento de pago deve iniciar fluxo de estorno rastreável, distinguindo solicitado de confirmado. Fluxo de estoque considera também expedição/devolução física: reembolso não implica reposição automática de produto já entregue. Efeitos internos usam LA-002.
6. Executar recuperação de dados complementares, como QR/linha digitável, independentemente da criação da cobrança. Persistir só referências seguras/token aceito pelo provedor; nunca PAN completo ou CVV em banco, logs, inbox/outbox. Se não houver tokenização recuperável, exigir nova coleta segura apenas após resolver a tentativa anterior.

#### Dados existentes e mudanças de modelo

Propor PaymentAttempt, histórico de transições financeiras, correlação única quando aplicável e outbox de comandos/avisos. Manter Order.status como estado comercial/logístico, sem usar CANCELLED como evidência de devolução de dinheiro. Reconciliar pedidos legados suspeitos com extrato do gateway antes de reparar estoque ou iniciar estornos.

#### Testes e validações a executar na implementação

- Gateway cria e resposta se perde; gateway responde e update local falha; PIX existe e busca de QR falha: uma só cobrança, retomada da tentativa.
- Webhook chega antes da resposta síncrona; evento chega após cancelamento; reembolso demora/falha/repete.
- Matar executor entre cada etapa e retomar com outro processo. Pedido enviado/entregue não repõe estoque só porque houve reembolso.

#### Critério de aceite

Toda cobrança/estorno fica vinculada e conciliável; UNKNOWN nunca é tratado como recusa; cliente vê o estado verdadeiro e operador pode resolver pendências sem editar banco manualmente.

#### Implantação e reversibilidade

Ativar primeiro em sandbox com falhas injetadas; migrar consulta de legados sem recriar cobranças. Se recuar, desabilitar novas cobranças do método afetado mantendo webhook/reconciliação de operações já iniciadas.

### [LA-006] Isolar de forma verificável o banco de testes

**Achado de origem:** Proteção dos testes valida uma URL, mas a limpeza usa outro banco.  
**Severidade original:** CRITICAL. **Fase de fechamento:** F0.  
**Ponto principal atual:** `tests/setup/db.ts`; demais consumidores e evidências estão no finding correspondente da auditoria.  
**Dependências e integração:** Pré-requisito para todos os testes de banco das demais propostas; coordenar LA-030.

#### Diagnóstico e objetivo

A URL aprovada pelo helper não é a conexão do Prisma que executa limpeza; substring não demonstra ambiente descartável.

#### Proposta de correção

1. Construir cliente de teste explicitamente com a URL validada, antes de importar código que depende de Prisma, usando injeção/override suportado pela versão instalada. Não permitir fallback de TEST_DATABASE_URL para a conexão da aplicação.
2. Provisionar banco descartável por execução de CI e papel com privilégios restritos a esse banco. Validar host permitido, nome exato, identidade da execução e sentinela criada pelo provisionador confiável; um nome que contém test não basta.
3. Após conectar, verificar current_database, current_user e sentinela pelo mesmo cliente que executará fixtures/limpeza; abortar antes da primeira escrita quando houver divergência. Não registrar credenciais.
4. Todos os serviços/fixtures/testes HTTP devem apontar ao mesmo ambiente isolado; não validar um cliente enquanto o servidor sob teste continua usando outro.
5. Preferir descarte do banco efêmero pelo provisionador; quando necessário, limpar somente fixtures identificadas pela execução, em ordem de FK e com atomicidade. Remover limpeza global reutilizável contra ambiente arbitrário.

#### Dados existentes e mudanças de modelo

Não requer migration de negócio. Separar configuração de teste, setup e injeção do cliente; sentinela é metadado apenas no banco efêmero. Segredos de produção não entram no job.

#### Testes e validações a executar na implementação

- TEST_DATABASE_URL seguro e DATABASE_URL simulado como proibido: nenhuma conexão/escrita neste último.
- URL com test em senha/usuário/query, banco local não descartável, sentinela ausente, papel indevido e mismatch servidor/fixture: execução bloqueada antes de seed.
- Em dois bancos descartáveis, somente o identificado pela execução muda; cleanup com falha não deixa metade das fixtures por desenho acidental.

#### Critério de aceite

Testes de integração/carga só podem escrever no banco efêmero verificado; a proteção é demonstrada antes de habilitar essas suites.

#### Implantação e reversibilidade

Esta é a primeira correção a implementar no ciclo futuro. Até validar o isolamento, manter suites com cleanup destrutivo fora da execução automática.

### [LA-007] Unificar o contrato da cotação consumido pelo formulário

**Achado de origem:** Formulário não interpreta o contrato da cotação de frete.  
**Severidade original:** HIGH. **Fase de fechamento:** F3.  
**Ponto principal atual:** `components/checkout/CheckoutForm.tsx`; demais consumidores e evidências estão no finding correspondente da auditoria.  
**Dependências e integração:** LA-008, LA-031, LA-034 e identidade do item LA-001.

#### Diagnóstico e objetivo

Request usa nomes/unidades incompatíveis e a resposta é lida fora do envelope, convertendo cotação válida em lista vazia.

#### Proposta de correção

1. Definir schemas compartilhados de request/response e um DTO público sem importar dependências de servidor para o cliente. Adotar envelope único, distinguindo sucesso com opções, indisponibilidade, erro e entrada inválida.
2. Enviar IDs canônicos e quantidades; backend busca preço, peso e dimensões. Valores físicos de UI não poderão reduzir arbitrariamente o pacote. Normalizar tenant pelo contexto autenticado/resolvido e CEP por contrato.
3. Formulário deverá ler o envelope validado e manter estados de frete carregando, pronto, indisponível, expirado e erro. DELIVERY precisa de opção autorizada; options vazio não significa frete grátis.
4. Troca de itens, quantidades, modalidade ou endereço invalida seleção anterior e exige nova cotação. Preservar os dados pessoais e exibir motivo recuperável se o provedor falhar.

#### Dados existentes e mudanças de modelo

Não requer nova tabela apenas para corrigir envelope; usa token/versão de LA-008. Dados físicos ausentes devem seguir fallback operacional explicitamente aprovado e identificado, ou bloquear a transportadora, sem fingir medidas reais.

#### Testes e validações a executar na implementação

- Teste de contrato API real→parser do cliente com envelope exato e unidades corretas.
- E2E de CEP válido com opções, lista vazia, 400/503, JSON inválido, cotação expirada e mudança de itens.
- Com frete indisponível, DELIVERY não conclui silenciosamente por zero; modalidade gratuita legitimamente autorizada continua funcionando.

#### Critério de aceite

Opções válidas são exibidas e selecionadas; ausência/erro não vira gratuidade nem preserva seleção incompatível.

#### Implantação e reversibilidade

Coordenar publicação dos dois lados do contrato; se houver compatibilidade temporária, versioná-la explicitamente e remover depois de verificar consumidores.

### [LA-008] Tornar a cotação de frete autoritativa e vinculada à compra

**Achado de origem:** Backend aceita frete declarado pelo cliente sem cotação verificável.  
**Severidade original:** HIGH. **Fase de fechamento:** F2.  
**Ponto principal atual:** `services/checkout.service.ts`; demais consumidores e evidências estão no finding correspondente da auditoria.  
**Dependências e integração:** LA-001, LA-007, LA-014, LA-031; regras de valor e consentimento de LA-009.

#### Diagnóstico e objetivo

Valor livre do payload e modalidades ignorando flags permitem compra com frete não autorizado; a verificação assinada existente não está integrada.

#### Proposta de correção

1. Completar o fluxo existente de lib/freight-quote.ts: emitir cotação assinada pelo backend e incluí-la no schema de checkout. Não basta aceitar um campo novo: a emissão deve usar somente dados autoritativos.
2. Vincular assinatura a tenant, destino canônico, modalidade, provedor/serviço, itens normalizados/quantidades, valor declarado relevante ao seguro, peso/volume e revisão das regras e dos dados de produto. O hash atual apenas de IDs/quantidades é insuficiente quando preço ou medidas mudam.
3. Na conclusão, verificar assinatura, formato, expiração e todas as identidades/revisões sob leitura consistente. Revalidar enablePickup/enableNoFreight/transportadora. Na divergência, pedir recotação e confirmação; nunca cobrar um total novo silenciosamente.
4. Remover fallback de shippingCost/freightValue arbitrários. Gratuidade, retirada e regra municipal precisam de decisão explícita do servidor. Regra local deve combinar município/UF e elegibilidade do destino, sem confiar somente no nome de cidade digitado.
5. Persistir snapshot do frete aceito: valor, serviço, prazo, regra/revisão e validade. Backend pode reemitir cotação; não chamar transportadora segurando lock do estoque. Segredo ausente em produção desabilita emissão assinada, sem segredo padrão.

#### Dados existentes e mudanças de modelo

Evoluir a versão do token e, se necessário, persistir cotações por ID. Adicionar revisão de regras/dados logísticos compatível com LA-031. Pedidos antigos preservam o frete contratado; não recotar retrospectivamente como se fosse valor originalmente aceito.

#### Testes e validações a executar na implementação

- Alterar preço, serviço, tenant, CEP, quantidade, variante ou valor declarado: token não autoriza a compra alterada.
- Token expirado/assinatura inválida, modalidade desabilitada após cotação e revisão antiga: rejeição sem reserva.
- Frete legitimamente zero e regra local correta passam; cidade homônima em outra UF e payload shippingCost=0 não contornam elegibilidade.

#### Critério de aceite

O total usa exclusivamente frete autorizado para a versão da compra; não há caminho público de entrega gratuita por omissão/manipulação de campo.

#### Implantação e reversibilidade

Implantar emissão e consumidores antes de tornar token obrigatório; encerrar fallback inseguro na mesma entrega funcional. Invalidar tokens antigos com comunicação de recotação.

### [LA-009] Calcular e conciliar parcelamento no servidor

**Achado de origem:** Valor de parcela controlado pelo cliente chega ao gateway sem conciliação.  
**Severidade original:** HIGH. **Fase de fechamento:** F2.  
**Ponto principal atual:** `services/checkout.service.ts`; demais consumidores e evidências estão no finding correspondente da auditoria.  
**Dependências e integração:** LA-004, LA-005, LA-008, LA-023; documentação Asaas citada na seção de fundamentos.

#### Diagnóstico e objetivo

Backend recalcula mercadoria, mas aceita parcela externa; o serviço de parcelamento existente precisa integrar preço, juros e persistência.

#### Proposta de correção

1. Usar services/payment/installment.service.ts e lib/config/payment.config.ts como ponto de consolidação, revendo aritmética e validação em vez de duplicar fórmula. Calcular em Decimal/centavos com arredondamento explícito; validar taxa zero, limites e configuração inválida.
2. Cliente escolhe quantidade de parcelas/plano permitido; servidor calcula subtotal, desconto, frete, encargo de parcelamento e total a cobrar. Separar total da mercadoria do encargo e total financeiro; confirmação do comprador corresponde à revisão aceita.
3. Não aceitar installmentValue como autoridade. Persistir snapshot de taxa/regra, número de parcelas, distribuição de centavos e total esperado. Ao alterar subtotal/frete/desconto, invalidar o plano anterior.
4. No adapter, enviar os campos apropriados ao contrato homologado: parcela única e parcelamento são formatos distintos. Preferir informar total autoritativo quando o endpoint suportar, conciliando parcelas devolvidas, sem misturar valores contraditórios.
5. Modelar identificação do parcelamento e suas cobranças. Um ID de primeira parcela não equivale a todo o contrato; decidir liberação comercial segundo a aprovação do cartão/contrato correspondente, sem tratar qualquer recebimento parcial de boleto como quitação total.

#### Dados existentes e mudanças de modelo

Persistir total financeiro e snapshot de plano, PaymentAttempt e relações das cobranças quando parceladas. Auditar legados comparando contrato externo, valor aprovado, descontos/juros e pedido; não inferir dívida ou estornar automaticamente pela diferença sem conciliação.

#### Testes e validações a executar na implementação

- Total100/3 com centavos residuais; taxa zero, absorção de taxas, juros configurados, mínimo da parcela e máximo de parcelas.
- Payload de duas parcelas10 para pedido1000 deve ser rejeitado/recalculado com nova confirmação antes da cobrança.
- Sandbox: conferir total retornado, IDs de todas as parcelas, evento de primeira parcela e retorno parcial/duplicado; não marcar quitado um contrato incompatível.

#### Critério de aceite

Valor consentido, snapshot interno e contrato externo coincidem em centavos; parcelas não podem ser escolhidas fora das regras válidas.

#### Implantação e reversibilidade

Homologar cada método/plano e liberar somente os aprovados; pedidos antigos mantêm plano contratado, sem recálculo com taxa atual.

### [LA-010] Expirar por método e estado remoto, com proteção contra corrida

**Achado de origem:** Timeout de uma hora cancela boleto antes do vencimento e cartão ainda em análise.  
**Severidade original:** HIGH. **Fase de fechamento:** F2.  
**Ponto principal atual:** `services/order-timeout.service.ts`; demais consumidores e evidências estão no finding correspondente da auditoria.  
**Dependências e integração:** LA-002, LA-003, LA-005, LA-025; política de calendário/vencimento explicitada antes da homologação.

#### Diagnóstico e objetivo

O cron aplica 60 minutos a qualquer pedido com ID Asaas, independentemente de boleto válido ou cartão em análise.

#### Proposta de correção

1. Persistir prazos separados: validade externa de pagamento, reserva comercial e limite para reconciliação. Preferir o vencimento efetivamente devolvido pelo gateway, com timezone e datas sem ambiguidade.
2. Política recomendada: PIX automático segue validade confirmada; boleto considera vencimento e janela documentada de confirmação; cartão em análise segue revisão/reconciliação; PIX manual depende de prazo explícito e conferência operacional. Ausência de configuração não permite usar 60 minutos para todos.
3. Job seleciona candidatos, consulta necessidade de conciliação fora do lock e conclui por comando transacional que relê estado/versão. Candidato que ficou PAID não deve cair na transição genérica PAID→CANCELLED por expiração.
4. Antes de disponibilizar estoque de cobrança ainda pagável, coordenar cancelamento remoto. Resultado incerto cria pendência; pagamento posterior à liberação vai para fluxo de revisão/estorno de LA-005, sem reativar venda automaticamente.
5. Executar lotes limitados com lease, métricas e retry. Não depender de uma única invocação cron para concluir todos os candidatos.

#### Dados existentes e mudanças de modelo

Persistir timestamps/política aplicada por pedido/tentativa e decisão de expiração. Para legados sem vencimento confiável, consultar gateway ou isolar para revisão; não preencher com prazo curto arbitrário.

#### Testes e validações a executar na implementação

- Boleto emitido antes de fim de semana/virada de data: não cancelar antes da validade confirmada; pagamento no vencimento e confirmação posterior.
- Cron lê PENDING e webhook grava PAID antes do comando: expiração não cancela.
- Provedor indisponível, timeout de consulta, dois jobs e retry de cancelamento remoto: sem duas liberações nem sucesso fictício.

#### Critério de aceite

Pedidos válidos não expiram pelo tipo errado; job nunca cancela pagamento confirmado por usar snapshot antigo e deixa pendências recuperáveis.

#### Implantação e reversibilidade

Primeiro executar modo de simulação que registra candidatos sem efeitos em homologação; comparar com gateway e ativar por método. Não aplicar nova política retroativa cegamente.

### [LA-011] Escopar idempotência à identidade autorizada e ao conteúdo

**Achado de origem:** Idempotency key recupera pedido de outra identidade ou loja.  
**Severidade original:** HIGH. **Fase de fechamento:** F2.  
**Ponto principal atual:** `services/checkout.service.ts`; demais consumidores e evidências estão no finding correspondente da auditoria.  
**Dependências e integração:** LA-004, LA-012, LA-014, LA-020.

#### Diagnóstico e objetivo

Chave global é consultada antes de autorização sobre o registro recuperado.

#### Proposta de correção

1. Resolver tenant e sujeito antes de qualquer leitura de replay. Para usuário, usar sessão validada na loja; para convidado, usar identidade opaca de sessão de checkout e credencial de recuperação, sem usar email declarado como autenticação.
2. Consultar somente o escopo permitido; chave não é credencial de acesso. Adotar unicidade do escopo lógico e hash do conteúdo para detectar reutilização indevida.
3. Vincular intenção do carrinho ao dono independentemente da chave fornecida, evitando que duas chaves criem duas compras do mesmo carrinho. Mesma chave em outro escopo não pode revelar sequer dados do pedido alheio.
4. Retornar conflito quando a mesma intenção recebe conteúdo diferente e resposta genérica quando não há autorização; não reutilizar o ramo atual que antecede as verificações.

#### Dados existentes e mudanças de modelo

Migrar índice global para escopo/entidade de intenção planejados, com preenchimento auditável de tenant/owner de legados. Chaves históricas sem prova de posse de convidado não dão acesso; recuperação passa por fluxo autenticado/validado.

#### Testes e validações a executar na implementação

- Mesma chave em lojas e usuários distintos: nenhuma resposta contém pedido/nome/telefone alheios.
- Troca de usuário na mesma aba, sessão expirada, posse de chave sem token convidado e payload divergente.
- Concorrência na mesma intenção autorizada retorna um só resultado; conflito de índice não provoca criação alternativa.

#### Critério de aceite

Replay possui as mesmas garantias de autorização da leitura de pedido e pertence à mesma intenção imutável.

#### Implantação e reversibilidade

Backfill de escopos precede remoção do índice antigo; qualquer fallback legado deve autenticar proprietário antes de retornar dados.

### [LA-012] Retornar e retomar o estado real no replay

**Achado de origem:** Replay devolve sucesso para pedido cancelado ou pagamento ainda incompleto.  
**Severidade original:** HIGH. **Fase de fechamento:** F2.  
**Ponto principal atual:** `services/checkout.service.ts`; demais consumidores e evidências estão no finding correspondente da auditoria.  
**Dependências e integração:** LA-003 a LA-005, LA-011, LA-025 e LA-035.

#### Diagnóstico e objetivo

Pedido existente não comprova que a cobrança terminou; o retorno antecipado também omite dados de pagamento.

#### Proposta de correção

1. Definir um DTO de resultado compartilhado para criação e replay, discriminado por estado: concluído para pagamento, processando, ação necessária, recusado, cancelado e revisão. Separar pedido criado de pagamento aprovado.
2. Consultar snapshot persistido e PaymentAttempt para retornar método, instruções vigentes e totais; não preencher método ausente como PIX.
3. Operação incompleta deve reenfileirar/retomar a etapa segura pela mesma identidade ou informar processamento. Pedido cancelado devolve cancelado e não recebe nova cobrança por replay.
4. Recuperar resultado por endpoint autorizado que sobreviva a reload; sessionStorage é conveniência, não a única fonte. Dados sensíveis de cartão nunca compõem replay.
5. Permitir nova tentativa intencional após recusa definitiva dentro da política de intenção/pagamento, mantendo histórico e excluindo tentativas ativas/incertas concorrentes.

#### Dados existentes e mudanças de modelo

Resultado deve derivar de estado persistido, não de variável local perdida ao reiniciar o processo. Legados com método ou instruções ausentes devem exibir recuperação indisponível/revisão, não inventar um meio de pagamento.

#### Testes e validações a executar na implementação

- Repetir durante chamada externa, após recusa, após cancelamento, depois de aprovação e depois de perder sessionStorage.
- Primeira resposta e replay concluído têm os mesmos campos financeiros relevantes.
- Dois processos retomando pendência disputam a mesma tentativa e apenas um chama a operação elegível.

#### Critério de aceite

Cliente recebe estado e dados verdadeiros em qualquer repetição; ausência de conclusão não é rotulada como sucesso de pagamento.

#### Implantação e reversibilidade

Publicar DTO e consumidor compatíveis juntos; manter recuperação de pedidos anteriores sem expor detalhes a contexto não autorizado.

### [LA-013] Fazer todos os caminhos de compra usarem o mesmo comando

**Achado de origem:** Rota alternativa de pedidos usa preço do carrinho sem atualizar regras da compra.  
**Severidade original:** HIGH. **Fase de fechamento:** F2.  
**Ponto principal atual:** `services/order.service.ts`; demais consumidores e evidências estão no finding correspondente da auditoria.  
**Dependências e integração:** LA-001, LA-004, LA-008, LA-009, LA-014 a LA-016, LA-035.

#### Diagnóstico e objetivo

POST /api/orders usa preço do carrinho e pula garantias do checkout principal.

#### Proposta de correção

1. Consolidar um caso de uso único de conclusão de compra com contexto autorizado, intenção, revisão do carrinho, itens canônicos, endereço, frete, fidelidade e pagamento. Route Handlers atuam como adaptadores desse contrato.
2. Recomendação: manter POST /api/orders somente como adaptador temporário quando puder fornecer todos os dados obrigatórios. Se o contrato antigo não permitir compra válida, rejeitar explicitamente ou retirar o método após mapear consumidores; não inventar modalidade/pagamento por default.
3. Recalcular preço no servidor e comparar ao orçamento/revisão consentidos. Em mudança de preço, apresentar novo total e solicitar nova confirmação antes de reservar/cobrar.
4. Buscar consumidores reais e testes antes da retirada; cobrir criação de pedido por qualquer rota, chamada interna ou integração que possa invocar serviço antigo.

#### Dados existentes e mudanças de modelo

Não corrigir preços de pedidos já aceitos retroativamente. Novos pedidos carregam a origem do comando e versão das regras para diagnóstico. A consolidação aproveita os modelos de intenção/pagamento e não exige criar um segundo tipo de pedido incompleto.

#### Testes e validações a executar na implementação

- Carrinho100/produto150: todas as entradas exigem confirmação de150, sem uma aceitar100 silenciosamente.
- Rodar mesmos casos de variante, tenant, frete, pontos, idempotência e indisponibilidade de gateway pelos dois endpoints.
- Consumidor legado recebe erro orientado/compatível até migrar, sem pedido parcial.

#### Critério de aceite

Não existe endpoint alcançável que crie uma compra com regras de preço, estoque, frete ou pagamento mais fracas.

#### Implantação e reversibilidade

Mapear clientes, publicar comando unificado e migrar adaptadores; observabilidade da rota antiga precede sua retirada.

### [LA-014] Aplicar isolamento de loja a todos os recursos da compra

**Achado de origem:** Carrinho e rota alternativa permitem pedido da loja A com produto da loja B.  
**Severidade original:** HIGH. **Fase de fechamento:** F1.  
**Ponto principal atual:** `services/cart.service.ts`; demais consumidores e evidências estão no finding correspondente da auditoria.  
**Dependências e integração:** LA-017 e LA-020 definem donos do carrinho; LA-011 protege replay.

#### Diagnóstico e objetivo

Carrinho de loja única ainda pode conter produtos de uma loja diferente da identidade/tenant.

#### Proposta de correção

1. Exigir tenant resolvido e sessão/identidade compatível antes de ler ou alterar carrinho. Conferir pertencimento de produto, variante, endereço e pedido dentro do serviço, mesmo se o handler já verificou.
2. Incluir lojaID e contexto de dono no contrato de carrinho; não aceitar fallback para loja da sessão quando o domínio deveria resolver outra, nem corpo escolhendo tenant arbitrário.
3. InventoryService deverá validar o pertencimento de todos os itens recebidos, sob a transação do comando, e nunca ignorar o argumento de loja.
4. Fortalecer schema com relações/constraints compostas onde representáveis sem destruir snapshots históricos; preservar verificações na aplicação para dar erros claros. Tenant passa explícito aos acessos de dados e caches.

#### Dados existentes e mudanças de modelo

Propor Cart.lojaID e índice/constraint de ownership com a regra de um carrinho ativo por tenant/dono. Auditar carrinhos e pedidos misturados antes de backfill; os divergentes ficam bloqueados para checkout e sujeitos a revisão, sem transferir propriedade silenciosamente.

#### Testes e validações a executar na implementação

- UsuárioA tenta adicionar produtoB, usar varianteB em produtoA, endereço de outro dono ou finalizar no domínioB: nenhuma mutação.
- Carinho legado contaminado é rejeitado também pela chamada direta ao serviço.
- Cenários positivos em duas lojas independentes sem vazamento por cache/chave.

#### Critério de aceite

Nenhuma escrita de compra/estoque cruza tenant; manipular IDs não contorna isolamento.

#### Implantação e reversibilidade

Expandir coluna/índices, auditar e preencher registros inequívocos, só então exigir invariantes mais fortes; manter casos históricos problemáticos separados do tráfego normal.

### [LA-015] Consumir um carrinho somente uma vez

**Achado de origem:** Duas requisições concluem o mesmo carrinho em pedidos distintos.  
**Severidade original:** HIGH. **Fase de fechamento:** F2.  
**Ponto principal atual:** `services/order.service.ts`; demais consumidores e evidências estão no finding correspondente da auditoria.  
**Dependências e integração:** LA-002, LA-004, LA-013, LA-014, LA-017.

#### Diagnóstico e objetivo

Ler ACTIVE fora da transação permite criar mais de um pedido da mesma versão.

#### Proposta de correção

1. Concluir carrinho pelo comando unificado: bloquear sua linha e reler dono, tenant, estado, versão e itens dentro da transação.
2. Relacionar carrinho consumido a um único pedido/intenção por restrição única. Reservar, criar pedido e marcar COMPLETED na mesma transação; a segunda chamada reencontra o resultado autorizado ou recebe conflito, sem reservar.
3. Todas as inclusões/alterações de itens devem respeitar o mesmo lock/versão. Se o usuário mudou o carrinho depois de iniciar a intenção, pedir atualização em vez de consumir conteúdo diferente.
4. Após consumo, novas compras usam novo carrinho ativo; COMPLETED é histórico, não um estado a reabrir automaticamente em falha do pagamento. Recompra após cancelamento é ação explícita e revalida estoque/preço.

#### Dados existentes e mudanças de modelo

Adicionar vínculo único Order↔Cart/CheckoutIntent conforme modelo escolhido. Não anexar pedidos históricos a carrinhos só por coincidência de itens; deixar vínculo legado desconhecido quando não houver evidência.

#### Testes e validações a executar na implementação

- Duas chamadas com estoque abundante para mesmo carrinho: um pedido e uma reserva.
- Checkout concorre com update/remove: conflito ou snapshot serializado conforme política, nunca mistura parcial.
- Falha depois da reserva antes do consumo reverte tudo; replay do carrinho COMPLETED devolve a compra correta.

#### Critério de aceite

Cada carrinho concluído corresponde a uma única compra; nenhuma operação perdedora movimenta estoque/pontos.

#### Implantação e reversibilidade

Ativar a restrição e o protocolo de lock junto com todos os escritores; não deixar a rota antiga consumindo por atualização incondicional.

### [LA-016] Sincronizar o ciclo persistido do carrinho com o cliente

**Achado de origem:** Carrinho reaparece depois da compra e checkout recarregado não o recupera.  
**Severidade original:** HIGH. **Fase de fechamento:** F3.  
**Ponto principal atual:** `store/cart.store.ts`; demais consumidores e evidências estão no finding correspondente da auditoria.  
**Dependências e integração:** LA-012, LA-014, LA-015, LA-017 e LA-034.

#### Diagnóstico e objetivo

Limpeza local não consome carrinho no banco, e reload não o carrega antes de classificá-lo como vazio.

#### Proposta de correção

1. Usar a conclusão persistida de LA-015 como fonte de verdade, inclusive no checkout principal. Retornar ID/versão do carrinho consumido e sinalizar invalidação após commit.
2. Carregar o carrinho ao iniciar o contexto autenticado/tenant ou ao montar checkout, com estados não carregado, carregando, vazio, pronto e erro distintos. Não renderizar vazio antes de concluir a leitura.
3. Na confirmação, remover somente a referência à versão consumida e buscar o carrinho ativo atual; não apagar itens adicionados depois da compra em outra aba.
4. Resetar dados ao logout/troca de usuário/tenant e sincronizar abas por invalidação/broadcast sem confiar nisso para correção no servidor. Revalidar ao recuperar foco quando apropriado.
5. Guardar em sessionStorage apenas referência da intenção/pedido; recuperação autorizada pelo backend restaura a confirmação.

#### Dados existentes e mudanças de modelo

Usa vínculo de LA-015 e revisão do carrinho; não precisa persistir dados pessoais ou cartão em armazenamento do navegador. Carrinhos legados ACTIVE de pedidos antigos só serão arquivados após correspondência comprovada.

#### Testes e validações a executar na implementação

- Comprar→abrir drawer: itens consumidos não reaparecem; criar novo item após compra e reabrir confirmação: novo item permanece.
- Reload e URL direta /checkout recuperam carrinho; erro de rede não aparece como vazio.
- Logout/login de outro usuário, duas abas e troca de loja não reutilizam estado anterior.

#### Critério de aceite

Cliente e servidor concordam sobre qual carrinho foi consumido; checkout sobrevive a reload e não apaga compras novas.

#### Implantação e reversibilidade

Publicar consumo no servidor antes da limpeza seletiva no cliente; transição deve distinguir carrinho sem vínculo legado e novo.

### [LA-017] Serializar mutações do carrinho e garantir um ativo por dono/loja

**Achado de origem:** Operações concorrentes perdem quantidade e podem criar dois carrinhos ativos.  
**Severidade original:** HIGH. **Fase de fechamento:** F1.  
**Ponto principal atual:** `services/cart.service.ts`; demais consumidores e evidências estão no finding correspondente da auditoria.  
**Dependências e integração:** LA-014, LA-015 e LA-034; bootstrap de teste LA-006.

#### Diagnóstico e objetivo

Read-modify-write perde incrementos e busca seguida de create permite duplicidade de ACTIVE.

#### Proposta de correção

1. Definir owner/tenant do carrinho e impor unicidade parcial de ACTIVE nesse escopo. A restrição final deverá ser compatível com usuários e, se mantidos, convidados sem usar NULL como identidade comum.
2. Obter/criar carrinho transacionalmente; colisão de unicidade deve reencontrar o carrinho vencedor em nova tentativa controlada. Não continuar usando uma transação já abortada por violação SQL.
3. Bloquear o carrinho nas mutações e na conclusão; ler estoque/itens relevantes, validar limite e aplicar operação. Distinguir incremento de inclusão de substituição absoluta de quantidade.
4. Para PATCH absoluto, exigir revisão esperada e rejeitar atualização antiga. Para repetição de POST que incrementa, adicionar identidade de operação ou API equivalente idempotente; incremento atômico sozinho não elimina retry duplicado.
5. Retornar versão monotônica do carrinho e snapshot coerente; ordem de locks deve ser a mesma da conclusão. Carrinho continua sem garantir reserva de estoque até checkout.

#### Dados existentes e mudanças de modelo

Propor versão e índice parcial PostgreSQL gerido por migration compatível com Prisma5. Auditar múltiplos ACTIVE antes do índice; mesclar/arquivar somente por regra explícita e sem exceder estoque/limites. Não executar esse saneamento nesta etapa.

#### Testes e validações a executar na implementação

- Duas inclusões concorrentes sobre quantidade1 resultam3; retry da mesma inclusão não resulta4.
- Duas criações iniciais deixam um ACTIVE; PATCH antigo recebe conflito sem sobrescrever alteração nova.
- Conclusão concorrente não aceita mutação após consumo; limite99/estoque e falha de item mantêm atomicidade.

#### Critério de aceite

Existe um único carrinho ativo por escopo; operações legítimas não se perdem e retries não se somam duas vezes.

#### Implantação e reversibilidade

Instalar restrição após auditoria e migrar todos os escritores; revisar consultas findFirst para não esconder anomalias históricas.

### [LA-018] Separar retirada de variante de quantidade disponível

**Achado de origem:** Cancelamento reativa variante removida pelo Admin.  
**Severidade original:** HIGH. **Fase de fechamento:** F1.  
**Ponto principal atual:** `services/product.service.ts`; demais consumidores e evidências estão no finding correspondente da auditoria.  
**Dependências e integração:** LA-001, LA-002, LA-019; regra de estoque aprovada antes do backfill.

#### Diagnóstico e objetivo

Stock=0 não distingue opção retirada de opção temporariamente esgotada; o estorno desfaz a retirada.

#### Proposta de correção

1. Adicionar ciclo de vida explícito, por exemplo retiredAt ou ACTIVE/RETIRED, sem alterar ID de variante vinculada. Toda consulta vendável, resolvedor, carrinho e checkout deverá combinar estado ativo e estoque.
2. Remoção administrativa sob lock marca retirada e mantém vínculos. Somente variantes sem vínculos continuam elegíveis à exclusão física conforme AGENTS.md.
3. Recomendação para a regra atual: manter estoque vendável de retirada em zero; registrar liberação de sua reserva em saldo/movimento indisponível, sem incrementar silenciosamente estoque vendável do pai. O estoque físico recuperado não pode sumir da contabilidade nem voltar a ser vendável por estorno.
4. Reativação será comando administrativo explícito que valida quantidade física, duplicidade de combinação e estoque agregado. Não reativar pelo simples reaparecimento no payload antigo do formulário.
5. Documentar a função de Product.stock em relação às variantes: enquanto houver limite agregado, toda movimentação vendável deve preservar ambos; não converter o pai em soma de variantes sem auditoria do modelo atual.

#### Dados existentes e mudanças de modelo

Propor estado da variante e movimento de reserva/liberação com destino vendável/indisponível. Não marcar todas as variantes stock0 como retiradas: muitas só esgotaram. Reconstruir intenção somente por logs/evidência; ambiguidades pedem validação de catálogo.

#### Testes e validações a executar na implementação

- Reservar V→retirar V→cancelar pedido: vínculo permanece, restituição registra quantidade indisponível e V não pode ser comprada.
- Opção esgotada mas ativa recebe reposição legítima e volta a vender; retirada não.
- Retirada concorre com compra, estorno e edição antiga: decisão serializada, sem ressurreição por payload.

#### Critério de aceite

Cancelamento preserva disponibilidade administrativa e contabilidade da unidade, sem perda dos vínculos.

#### Implantação e reversibilidade

Publicar suporte de leitura e writers antes de marcar variantes retiradas; um rollback para código que ignora retiredAt exigiria desabilitar vendas afetadas, não apenas voltar o binário.

### [LA-019] Separar edição de catálogo de ajuste de estoque

**Achado de origem:** Salvar edição antiga do produto sobrescreve reservas recentes.  
**Severidade original:** HIGH. **Fase de fechamento:** F1.  
**Ponto principal atual:** `services/product.service.ts`; demais consumidores e evidências estão no finding correspondente da auditoria.  
**Dependências e integração:** LA-002, LA-018; auditoria dos escritores de Product.stock/ProductVariants.stock.

#### Diagnóstico e objetivo

Formulário absoluto antigo desfaz reservas já commitadas ao salvar um campo não relacionado.

#### Proposta de correção

1. Remover estoques inalterados do comando de edição de metadados; distinguir explicitamente alteração de opções/atributos de movimentação de estoque.
2. Ajuste de estoque será operação auditada com motivo, ator e ID idempotente. Incremento/reposição física é delta; contagem absoluta exige versão esperada de inventário e confirmação de conflito.
3. Versionar inventário do produto/variantes e incrementá-lo em todo escritor: reserva, liberação, reposição, ajuste, retirada e futuras integrações. Atualizar por versão esperada dentro da transação.
4. Manter IDs e reconciliação por combinação de AGENTS.md. Atualizar o frontend para que conflito preserve rascunho de metadados, apresente quantidades atuais e não refaça automaticamente ajuste antigo.

#### Dados existentes e mudanças de modelo

Propor versão de inventário e registro de movimentos. Estado inicial de estoque precisa ser inventariado para reconciliação; não aumentar estoque com base no valor exibido num formulário antigo. Mapear integrações/scripts que escrevem stock antes de tornar a versão confiável.

#### Testes e validações a executar na implementação

- Admin abre10; venda deixa9; salvar nome mantém9.
- Dois ajustes absolutos da mesma versão: apenas um; reposição por delta e venda concorrente preservam aritmética e disponibilidade.
- Retry do mesmo ajuste, variante retirada e erro numa entre várias variantes: sem duplicação nem commit parcial.

#### Critério de aceite

Metadados nunca sobrescrevem estoque; todo ajuste intencional é verificável, idempotente e detecta snapshot obsoleto.

#### Implantação e reversibilidade

Publicar novos comandos e cliente; impedir payload antigo de edição de carregar stock como autoridade, com erro claro quando não houver revisão.

### [LA-020] Separar comprador convidado de conta autenticada

**Achado de origem:** Checkout convidado sobrescreve CPF e telefone de conta existente.  
**Severidade original:** HIGH. **Fase de fechamento:** F1.  
**Ponto principal atual:** `services/checkout.service.ts`; demais consumidores e evidências estão no finding correspondente da auditoria.  
**Dependências e integração:** LA-004, LA-011, LA-014, LA-027, LA-032, LA-033; escolha guest/login na seção de decisões.

#### Diagnóstico e objetivo

Email declarado permite alterar CPF/telefone e associar pedido a uma conta sem comprovar sua posse.

#### Proposta de correção

1. Eliminar upsert que atualiza User por email recebido no checkout. Snapshot do comprador e titularidade de conta são conceitos diferentes; também não associar automaticamente o pedido à conta apenas porque o email coincide.
2. Para preservar compra convidada, recomendação: Order.userID opcional para convidado e snapshot próprio de nome, contato e documento, associado à sessão opaca de compra. Alternativa de maior modelagem é entidade Customer distinta de User. Avaliar todos os leitores hoje dependentes de order.user antes da mudança.
3. Somente sessão autenticada válida da mesma loja ou processo de verificação permite vincular/atualizar conta. Contato/endereço informados na compra não substituem perfil sem ação consentida.
4. Convidado não resgata pontos de conta existente; eventual benefício fica pendente de vínculo verificado. Recuperação de pedido convidado exige credencial própria/validação, nunca email+ID conhecidos.
5. Alternativa de escopo para uma primeira versão: exigir login para toda compra. Essa alternativa deve ser decisão explícita de produto, com UI/backend coerentes; não é preciso implementá-la para corrigir silenciosamente o upsert.

#### Dados existentes e mudanças de modelo

Se convidado for mantido, migration expansiva para comprador snapshot e vínculo opcional; atualizar emails, pedido, auditoria, carteira e Admin para user ausente. Contas/pedidos legados afetados exigem análise: não restaurar CPF por inferência a partir de outro pedido.

#### Testes e validações a executar na implementação

- Convidado informa email de usuário existente: perfil, senha, documentos, carteira e titularidade do histórico permanecem inalterados.
- Dois convidados com mesmo email não compartilham autorização; autenticação posterior permite apenas associação comprovada.
- Usuário bloqueado/sessão de outra loja não obtém privilégios por cair no branch convidado; pedido convidado funciona com leitores adaptados, ou é claramente indisponível no escopo escolhido.

#### Critério de aceite

Identidade declarada de comprador não autoriza mutação de conta; histórico e dados pessoais pertencem ao sujeito verificado.

#### Implantação e reversibilidade

Expandir modelo e leitores antes de criar pedidos sem userID. Não publicar uma simples nulificação da FK sem revisar os consumidores.

### [LA-021] Rastrear a origem e o prazo de cada crédito de fidelidade

**Achado de origem:** Motor de expiração remove pontos válidos de ajuste administrativo.  
**Severidade original:** HIGH. **Fase de fechamento:** F1.  
**Ponto principal atual:** `services/loyalty.service.ts`; demais consumidores e evidências estão no finding correspondente da auditoria.  
**Dependências e integração:** LA-022, LA-023 e LA-002; definição de política antes da migração.

#### Diagnóstico e objetivo

Reconstituir saldo só por EARN classifica ajustes válidos como expirados e não modela consumo/devolução por origem.

#### Proposta de correção

1. Manter ledger imutável e representar lotes de crédito com origem, pontos originais/remanescentes e expiresAt explícito. EARN, ajuste positivo e devolução que reabre um crédito devem ter proveniência identificável.
2. Recomendação de política: consumir créditos pela expiração mais próxima, com desempate estável; ajustes positivos seguem prazo explicitamente selecionado, incluindo sem expiração quando permitido. Datas ausentes/desconhecidas não significam expirado.
3. Vincular resgates aos lotes consumidos para devolver a quantidade correta sem renovar validade inadvertidamente. Definir política de devolução cujo prazo original já venceu; recomendação é crédito compensatório com prazo próprio registrado, nunca alteração silenciosa da origem.
4. Reverter pontos ganhos depois de já terem sido gastos exige tratamento específico: saldo disponível permanece não negativo e eventual déficit fica em obrigação separada, com regra explícita de compensação futura. Não bloquear reembolso financeiro por CHECK de pontos.
5. Expirar apenas saldo remanescente de créditos com vencimento demonstrado, usando o protocolo transacional de LA-022.

#### Dados existentes e mudanças de modelo

Criar lotes/alocações ou estrutura equivalente. Reconciliar saldo materializado com ledger, inventariar origem desconhecida e preservar benefício até decisão explícita. Reparações serão movimentos compensatórios auditados, nunca edição/apagamento do ledger original.

#### Testes e validações a executar na implementação

- Ajuste100 recém-criado sem EARN não expira; crédito antigo parcialmente consumido expira só o remanescente.
- Mescla de EARN, ajuste, resgate, devolução e expiração; saldo e lotes devem fechar.
- Cancelar pedido após gasto dos pontos ganhos não torna disponível negativo nem bloqueia indevidamente estorno financeiro; déficit é visível.

#### Critério de aceite

Todo ponto disponível tem origem/validade explicáveis; só unidades efetivamente vencidas são removidas.

#### Implantação e reversibilidade

Suspender apenas a expiração automática na futura implantação enquanto lotes legados não forem conciliados; preservar ganhos/resgates seguros conforme capacidade de fechar a contabilidade.

### [LA-022] Tornar expiração idempotente por crédito e transacional por carteira

**Achado de origem:** Expiração concorrente pode descontar pontos duas vezes e deixar saldo negativo.  
**Severidade original:** HIGH. **Fase de fechamento:** F1.  
**Ponto principal atual:** `services/loyalty.service.ts`; demais consumidores e evidências estão no finding correspondente da auditoria.  
**Dependências e integração:** LA-021 e LA-002; LA-006 para ensaio PostgreSQL.

#### Diagnóstico e objetivo

Quantidade calculada antes da transação pode ser aplicada duas vezes; versão incrementada sem predicado não protege.

#### Proposta de correção

1. Job seleciona carteiras candidatas, mas não determina fora da transação a quantidade final a descontar. Bloquear carteira e lotes relevantes, reler validade/remanescentes e aplicar cálculo atual na mesma transação.
2. Dar identidade única à baixa por crédito/lote e período/versão quando necessário. Consumir o remanescente com predicado; uma segunda execução encontra zero elegível e não desconta créditos válidos.
3. Gravar ledger, lotes, saldo e versão juntos. Todos os caminhos que alteram carteira — ganho, resgate, ajuste, devolução, expiração — devem seguir o mesmo protocolo de concorrência.
4. Adicionar CHECK de disponível>=0 somente após definir o tratamento de pontos já gastos e estornos de LA-021. Não substituir regra correta por simples Math.min de snapshot antigo.
5. Lease de job serve à eficiência e recuperação, não substitui a exclusão por carteira e deduplicação por efeito. Lotes falhos permanecem retomáveis sem reprocessar os concluídos.

#### Dados existentes e mudanças de modelo

Propor índices de elegibilidade, chave de efeito de expiração, CHECK e alocações. Antes do CHECK, investigar saldos negativos/legados; não aplicar clamp para zero apagando diferença.

#### Testes e validações a executar na implementação

- Dois jobs sobre saldo150, com100 vencidos e50 válidos: final50, uma baixa100.
- Resgate concorre com expiração do mesmo lote; ordenação preserva saldo e cada alocação.
- Falha no insert ledger após update de saldo reverte; reinício e retry não duplicam baixa; carteira distinta progride sem lock global desnecessário.

#### Critério de aceite

Expiração não duplica movimentos nem consome saldo válido e permanece correta com várias instâncias do job.

#### Implantação e reversibilidade

Backfill/reconciliação precede constraints; iniciar com lote pequeno e relatório comparativo, ampliando após consistência comprovada.

### [LA-023] Fixar a política de ganho no snapshot aceito da compra

**Achado de origem:** Pontos creditados divergem da simulação quando há resgate.  
**Severidade original:** MEDIUM. **Fase de fechamento:** F2.  
**Ponto principal atual:** `services/order.service.ts`; demais consumidores e evidências estão no finding correspondente da auditoria.  
**Dependências e integração:** LA-002, LA-005, LA-009, LA-021, LA-022.

#### Diagnóstico e objetivo

Simulação usa subtotal após resgate e confirmação usa subtotal original, podendo ainda capturar configuração posterior.

#### Proposta de correção

1. Recomendação de regra alinhada à simulação atual: ganho sobre subtotal líquido de descontos de fidelidade, excluindo frete e encargos de parcelamento. Documentar taxa, arredondamento e tratamento de desconto integral.
2. Unificar função pura de cálculo e validá-la com Decimal/centavos; simulação é estimativa, mas o checkout calcula e persiste snapshot autoritativo da regra aceita.
3. Na confirmação financeira, creditar uma única vez o valor calculado para aquele snapshot, desde que compra/valor conciliados. Não recalcular pela taxa vigente no dia do webhook.
4. Alteração de pedido após aceite exige nova revisão financeira antes de cobrar; devolução parcial/full reverte os créditos proporcionais/originais por identidades de efeito explícitas.
5. Manter pointsEarned previsto separado de efetivamente creditado para não mascarar pendência.

#### Dados existentes e mudanças de modelo

Persistir versão/taxa/base elegível e valor previsto/creditado. Para pedidos antigos sem snapshot, aplicar política de migração documentada, sem debitar automaticamente diferença histórica do cliente.

#### Testes e validações a executar na implementação

- Subtotal100, resgate20 e taxa0,5: previsão e crédito40; frete/juros não aumentam a base proposta.
- Mudar taxa após pedido e antes de webhook não altera ganho contratado.
- Dois eventos de aprovação creditam uma vez; estorno total/parcial fecha com os movimentos originais.

#### Critério de aceite

Simulação confirmada, pedido e carteira apresentam a mesma regra e o mesmo valor efetivamente creditado.

#### Implantação e reversibilidade

Versionar a política para separar pedidos legados e novos; mudança de regra não é reparação silenciosa de pedidos já pagos.

### [LA-024] Separar endereço de cobrança de modalidade de entrega

**Achado de origem:** Boleto com retirada ou sem frete é oferecido, mas sempre rejeitado pelo schema.  
**Severidade original:** HIGH. **Fase de fechamento:** F3.  
**Ponto principal atual:** `lib/validators/checkout.validators.ts`; demais consumidores e evidências estão no finding correspondente da auditoria.  
**Dependências e integração:** LA-007, LA-008, LA-020, LA-035 e contrato do adapter.

#### Diagnóstico e objetivo

Retirada/sem frete não envia address, mas boleto precisa desse dado no contrato atual.

#### Proposta de correção

1. Introduzir billingAddress independente de shippingAddress. Reutilização do endereço de entrega deve ser opção explícita; PICKUP/NONE ainda pode coletar cobrança.
2. Definir schema condicional por método/modalidade e usar a mesma regra nos passos do formulário e no handler. Validar campos exigidos antes de criar pedido/reserva.
3. Adapter deve receber endereço de cobrança correto; logística e frete só recebem endereço de entrega. Não marcar retirada como DELIVERY para satisfazer boleto.
4. Preservar dados válidos ao trocar método; limpar apenas seleções incompatíveis. Se a combinação não for homologada, não oferecê-la como comprável.

#### Dados existentes e mudanças de modelo

Persistir snapshots de cobrança/entrega sem alterar endereço padrão do usuário. Legados podem ter um único endereço sem classificação: não duplicar semanticamente sem sinalizar origem.

#### Testes e validações a executar na implementação

- Matriz PIX/cartão/boleto × DELIVERY/PICKUP/NONE habilitados.
- Boleto com retirada e endereço de cobrança válido conclui emissão; sem endereço falha no passo correto, sem reserva.
- Troca boleto→PIX→boleto e CEP/UF inválidos não produz modalidade logística incorreta.

#### Critério de aceite

Toda combinação oferecida recolhe os dados que o servidor e o gateway realmente exigem.

#### Implantação e reversibilidade

Publicar schemas/DTO e formulário coordenados; manter tradução temporária de address antigo somente quando inequívoca.

### [LA-025] Exibir o estado completo do pedido e do pagamento na confirmação

**Achado de origem:** Confirmação ignora CANCELLED e continua incentivando o pagamento.  
**Severidade original:** HIGH. **Fase de fechamento:** F3.  
**Ponto principal atual:** `app/checkout/confirmation/page.tsx`; demais consumidores e evidências estão no finding correspondente da auditoria.  
**Dependências e integração:** LA-005, LA-010, LA-012, LA-020, LA-035.

#### Diagnóstico e objetivo

O cliente reduz estados a PENDING/PAID e continua orientando pagamento de pedido cancelado.

#### Proposta de correção

1. Definir DTO discriminado que contemple estado comercial, estado financeiro e ações autorizadas pelo backend. Não colapsar cancelado, expirado, desconhecido, em análise e estorno pendente em PENDING.
2. Polling/recuperação usam endpoint autorizado e retorno sem cache compartilhado. Ao detectar cancelamento, remover ações de pagar/copiar boleto/PIX; se houve pagamento, mostrar conciliação/estorno pendente conforme o caso.
3. Renderizar carregamento real antes de exibir instruções de sessionStorage. Campos antigos não podem autorizar uma ação que o backend já revogou.
4. Controlar erro de rede, backoff e visibilidade; parar polling apenas quando não restar evolução relevante. Cancelado com estorno pendente ainda precisa de atualização, diferentemente de cancelado não pago concluído.
5. Mensagens devem distinguir pedido recebido, cobrança emitida e pagamento confirmado; nunca anunciar boleto gerado sem artefato válido.

#### Dados existentes e mudanças de modelo

Sem migração isolada; depende do estado persistido de pagamentos e DTO de recuperação. Recuperação de convidados segue LA-020; o endpoint público atual não deve passar a expor mais dados pessoais por conveniência.

#### Testes e validações a executar na implementação

- Cancelar com tela aberta/reload: ações de pagamento somem após estado confirmado.
- UNKNOWN, cartão em análise, atraso de webhook, boleto sem artefato e refund pendente têm mensagens/ações coerentes.
- Erro de polling não reativa pagamento cancelado; evento financeiro posterior aparece sem falsa confirmação logística.

#### Critério de aceite

Nenhuma instrução ativa contradiz o estado autoritativo; recarga não depende de dados antigos da aba.

#### Implantação e reversibilidade

Disponibilizar novos estados no backend e cliente conjuntamente; consumidores antigos precisam ser bloqueados ou adaptados para não assumir sucesso.

### [LA-026] Persistir rastreio na mesma operação que confirma expedição

**Achado de origem:** Código de rastreio enviado ao mudar status é descartado.  
**Severidade original:** MEDIUM. **Fase de fechamento:** F3.  
**Ponto principal atual:** `lib/validators/order.validators.ts`; demais consumidores e evidências estão no finding correspondente da auditoria.  
**Dependências e integração:** LA-002, LA-027 e LA-037.

#### Diagnóstico e objetivo

Campo enviado pelo modal desaparece no schema e a UI recebe sucesso parcial.

#### Proposta de correção

1. Expandir o comando de expedição para aceitar/validar trackingCode e transportadora quando aplicável; encaminhar o campo até o serviço de domínio.
2. Recomendação: salvar status SHIPPED e rastreio numa única transação. Evitar duas chamadas independentes do modal, que criariam outro ponto de falha parcial.
3. Documentar quando rastreio é obrigatório ou opcional conforme provedor/modalidade. Não exigir código fictício em retirada; backend decide a regra, frontend reproduz a instrução.
4. Endpoint separado de edição de rastreio deve reutilizar validação/autorização, controlar versão e registrar alterações sem mudar estado indevidamente.

#### Dados existentes e mudanças de modelo

Modelo já possui trackingCode; adicionar metadados de provedor/revisão apenas se necessários. Não preencher rastreio de legados com placeholder para aparentar completude.

#### Testes e validações a executar na implementação

- Valor informado sobrevive modal→schema→serviço→leitura; normalização não destrói formato válido.
- Rastreio inválido ou falha de persistência não deixa SHIPPED sem dados obrigatórios.
- Repetição e concorrência com cancelamento seguem LA-002; atualização posterior tem histórico.

#### Critério de aceite

Sucesso do modal corresponde à persistência de tudo que aquela operação promete salvar.

#### Implantação e reversibilidade

Publicar contrato e modal na mesma entrega; verificar consumidores do endpoint separado para não criar regras diferentes.

### [LA-027] Registrar histórico no mesmo commit da transição

**Achado de origem:** Histórico de status exibido pelo Admin nunca é alimentado pelas transições.  
**Severidade original:** MEDIUM. **Fase de fechamento:** F1.  
**Ponto principal atual:** `services/order.service.ts`; demais consumidores e evidências estão no finding correspondente da auditoria.  
**Dependências e integração:** LA-002 e LA-033 são implementação conjunta; LA-020 para pedido convidado.

#### Diagnóstico e objetivo

A tela consulta OrderStatusHistory, mas escritores de status gravam outro modelo.

#### Proposta de correção

1. Usar LA-002 como escritor central de OrderStatusHistory. Registrar estado anterior/novo, origem, instante, motivo, versão/ID da transição e ator humano ou sistema.
2. Histórico e status devem commitar juntos; AuditLog pode existir para busca/auditoria geral, mas não substituir silenciosamente o contrato da timeline.
3. Tratar duplicata de comando como leitura do registro anterior, não novo histórico. Cobrir confirmação síncrona, webhook, cron, Admin e entrega pelo cliente.
4. Adaptar performedById hoje obrigatório para atores de sistema segundo LA-033, preservando semântica: não atribuir ação automática ao cliente como se ele tivesse executado.
5. Ordenar timeline por sequência/versão estável, não apenas timestamp que pode empatar.

#### Dados existentes e mudanças de modelo

Propor campos de transição/ator e índice único por transição. Reconstruir histórico legado apenas a partir de evidência suficiente, com origem 'reconstruído' e timestamp comprovado; não inventar transições para preencher timeline vazia.

#### Testes e validações a executar na implementação

- Cada caminho produz um registro correto; erro no histórico reverte status e efeitos internos.
- Webhook/cron duplicado não duplica timeline; duas ações concorrentes registram somente a aceita.
- Histórico de ator sistema funciona sem User artificial e respeita tenant/autorização na leitura.

#### Critério de aceite

Timeline representa todas as transições futuras efetivas, sem sucesso de status desacompanhado do histórico correspondente.

#### Implantação e reversibilidade

Expandir modelo e UI para novos atores antes de escrever novos registros; dados legados permanecem distinguíveis.

### [LA-028] Consumir token de recuperação atomicamente

**Achado de origem:** Token de recuperação pode ser consumido duas vezes sob concorrência.  
**Severidade original:** MEDIUM. **Fase de fechamento:** F1.  
**Ponto principal atual:** `services/auth.service.ts`; demais consumidores e evidências estão no finding correspondente da auditoria.  
**Dependências e integração:** LA-006 para teste real de concorrência; não depende de refatorar checkout.

#### Diagnóstico e objetivo

A segunda chamada usa o ID encontrado anteriormente e pode redefinir a senha mesmo após o token ser consumido.

#### Proposta de correção

1. Efetuar alteração de senha com condição que ainda exija token correto, não consumido e validade superior ao instante da operação; verificar exatamente uma linha afetada.
2. Executar consumo do token, atualização de senha e revogação de sessões na mesma transação. Pode-se calcular bcrypt antes para evitar lock longo, mas a verificação definitiva acontece na escrita protegida.
3. Reemissão de token invalida o anterior; concorrência entre emitir e consumir deve preservar essa regra. Resposta de token ausente/expirado/consumido é genérica.
4. Recomendação de endurecimento associado: persistir hash do token e não token recuperável, preservar alta entropia, prazo e rate limit; não vazar token em logs. Não é substituto do consumo atômico.

#### Dados existentes e mudanças de modelo

Correção do predicado pode aproveitar modelo existente; hash de token exige transição que invalide ou suporte por prazo estritamente limitado tokens anteriores. Comunicar necessidade de solicitar novo link, sem alterar senhas para migrar tokens.

#### Testes e validações a executar na implementação

- Duas chamadas com senhas diferentes e mesmo token: só uma sucesso; senha final é a da vencedora.
- Token expira durante cálculo do hash, token reemitido e tentativa com token antigo: nenhum consumo indevido.
- Falha ao revogar sessões reverte a troca; sessões antigas deixam de autorizar após sucesso.

#### Critério de aceite

Um token autoriza exatamente uma redefinição válida; nenhuma segunda resposta de sucesso sobrescreve a primeira.

#### Implantação e reversibilidade

Publicar consumo atômico antes de validar fluxo E2E; mudança de formato pode exigir reemissão de links, nunca redução temporária da validação.

### [LA-029] Proteger existência de administrador ativo sob concorrência

**Achado de origem:** Dois administradores podem remover simultaneamente o último acesso administrativo.  
**Severidade original:** HIGH. **Fase de fechamento:** F1.  
**Ponto principal atual:** `services/user.service.ts`; demais consumidores e evidências estão no finding correspondente da auditoria.  
**Dependências e integração:** LA-033 para atores de auditoria, LA-006 para cenário concorrente.

#### Diagnóstico e objetivo

Contagem fora da transação deixa duas despromoções passarem; identidade do ator também pode mudar entre guard e escrita.

#### Proposta de correção

1. Serializar alterações que afetam elegibilidade administrativa por lock de linha da Loja ou lock transacional equivalente no escopo da loja.
2. Sob esse lock, reler ator, alvo, papéis e status; exigir ator ainda autorizado e contar administradores ativos aptos a operar. Guard inicial continua útil, mas não substitui a leitura transacional.
3. Aplicar a regra a despromoção, bloqueio, exclusão e mudança de loja de administradores, não só updateUserRole. Todas as rotas precisam do mesmo protocolo.
4. Atualizar papel/status e auditoria juntos; preservar veto de autoalteração conforme política atual. Definir procedimento de recuperação administrativa fora do fluxo comum, autenticado e auditado.

#### Dados existentes e mudanças de modelo

Não basta CHECK por linha para contar administradores. Pode usar Loja existente como lock sem novo campo; auditar lojas com zero admin ativo ou apenas bloqueados antes do rollout e encaminhar recuperação, sem promover usuário aleatório.

#### Testes e validações a executar na implementação

- A e B tentam despromover um ao outro: sobra pelo menos um admin ativo e chamada perdedora não grava audit de sucesso.
- Despromoção concorre com bloqueio/exclusão e ator perde papel entre guard e transação.
- Alterações em lojas diferentes não precisam bloquear umas às outras.

#### Critério de aceite

Toda loja operacional mantém administrador ativo; autorizações são válidas no instante da mudança.

#### Implantação e reversibilidade

Migrar todos os escritores de elegibilidade antes de considerar a regra garantida; verificar invariantes pós-deploy.

### [LA-030] Reconstituir uma trajetória de migrations reproduzível

**Achado de origem:** Migrations versionadas não reproduzem o schema exigido pelo aplicativo.  
**Severidade original:** HIGH. **Fase de fechamento:** F0.  
**Ponto principal atual:** `prisma/schema.prisma`; demais consumidores e evidências estão no finding correspondente da auditoria.  
**Dependências e integração:** LA-006 para isolamento; pré-requisito da implantação das mudanças de schema de todos os findings.

#### Diagnóstico e objetivo

Schema/ambiente existente têm objetos ausentes do histórico, impedindo reconstrução confiável.

#### Proposta de correção

1. Inventariar em clone autorizado o schema real, schema Prisma e SQL/migration history; comparar tabelas, colunas, tipos, defaults, índices, checks, FKs, enums e sequências. Não comparar só nomes.
2. Projetar duas trajetórias comprovadas: banco vazio chega ao schema alvo somente por artefatos versionados; banco existente chega ao mesmo schema sem recriar objetos nem perder dados.
3. Preferir migrations novas para completar a história e expansão controlada. Não editar/apagar migrations já aplicadas. Em ambiente driftado, só marcar uma etapa como já aplicada quando estrutura equivalente tiver sido verificada; documentar cada resolução. Baseline substituto é alternativa se histórico for irrecuperável, exigindo estratégia explícita por ambiente.
4. Versão Prisma5 instalada é referência operacional: não copiar comandos/APIs de documentação de versões futuras sem verificar. Gerar cliente e executar consultas representativas no banco reconstruído.
5. Incluir futuras constraints/estados das outras propostas somente depois de estabilizar essa base. Automatizar detecção de divergência na CI, inclusive SQL de índices parciais/checks não representados integralmente no schema Prisma.

#### Dados existentes e mudanças de modelo

Backup validado por restauração, diff revisado e ensaio em clone precedem qualquer futura mudança real. Auditar _prisma_migrations sem alterar registros manualmente. Criar inventário de dependências/reversibilidade para campos de cartão, boleto, catálogo, frete e demais lacunas, não só três exemplos da auditoria.

#### Testes e validações a executar na implementação

- Banco efêmero vazio+histórico completo resulta no schema alvo e suporta consultas de catálogo/pedido/frete.
- Clone do banco atual+migrations novas mantém contagens, FKs, IDs, sequências e valores.
- Reaplicar deploy é inócuo; caminho de falha documentado permite retomar; cliente gerado corresponde ao banco.

#### Critério de aceite

Provisionamento novo e atualização de existente são reproduzíveis, verificáveis e convergem sem comandos ad hoc não versionados.

#### Implantação e reversibilidade

Tratar como fundação da execução futura; não usar reset/db push em banco com dados para eliminar drift. Rollback de schema destrutivo não substitui restauração ensaiada/roll-forward.

### [LA-031] Fazer a chave de cache representar todos os determinantes do frete

**Achado de origem:** Cache de cotação compartilha preço entre carrinhos de valores diferentes.  
**Severidade original:** MEDIUM. **Fase de fechamento:** F2.  
**Ponto principal atual:** `services/freight/orchestrator.service.ts`; demais consumidores e evidências estão no finding correspondente da auditoria.  
**Dependências e integração:** LA-007, LA-008 e DTO dos itens LA-001.

#### Diagnóstico e objetivo

Pacote e CEP iguais não implicam preço igual quando seguro e regras variam.

#### Proposta de correção

1. Construir chave canônica a partir de tenant, origem/destino, pacote, valor declarado, quantidade/atributos relevantes, serviço/provedor, versão da tabela e revisão das configurações/logística de produto.
2. Recomendação: cachear cálculo do provedor, não token de autorização. Emitir token novo somente após validar revisões atuais, com validade que não ultrapasse a validade comercial do resultado.
3. Atualização de regra/origem/habilitação deve incrementar revisão persistida e invalidar categorias relacionadas. Map local isolado não pode depender só de invalidação naquele processo; cada consumidor deve observar a revisão autoritativa ou usar infraestrutura compartilhada apropriada.
4. Falha do provedor não deve ser guardada como opção grátis/sucesso. TTL é otimização e não prova de validade da cotação aceita no checkout.
5. Aplicar mesma estratégia às dependências de preço/seguro e testar consumidores em duas instâncias. Usar APIs de cache compatíveis com o modo de Next instalado, sem ativar Cache Components apenas para contornar esta chave.

#### Dados existentes e mudanças de modelo

Propor revision de configuração/tabela e fingerprint de dados de cotação; não armazenar segredos na chave pública. Ao implantar, mudar namespace para não reutilizar entradas do formato antigo.

#### Testes e validações a executar na implementação

- Carrinhos100/1000 com mesmo pacote/CEP produzem seus próprios seguros.
- Atualizar origem/tabela/habilitação em instânciaA: instânciaB não emite cotação autorizada com revisão anterior.
- Reordenação de itens equivalentes mantém hash estável; mudança relevante muda chave; falha não vira preçozero.

#### Critério de aceite

Caches só reutilizam resultados economicamente equivalentes e não autorizam regras revogadas.

#### Implantação e reversibilidade

Publicar revisão de dados e namespace novo; invalidar cache antigo sem recalcular pedidos já contratados.

### [LA-032] Restringir carteira à identidade da sessão e tornar simulação leitura

**Achado de origem:** Simulação pública permite consultar carteira identificada pelo solicitante.  
**Severidade original:** MEDIUM. **Fase de fechamento:** F1.  
**Ponto principal atual:** `app/api/loyalty/simulate/route.ts`; demais consumidores e evidências estão no finding correspondente da auditoria.  
**Dependências e integração:** LA-014, LA-020, LA-023.

#### Diagnóstico e objetivo

Endpoint anônimo aceita userID e pode consultar/criar carteira de terceiro.

#### Proposta de correção

1. Separar estimativa pública de cálculo personalizado. Público usa regras da loja para estimar ganhos sem ler carteira; resgate/saldo requer sessão autenticada e tenant compatível.
2. Resolver userID somente no servidor e rejeitar/ignorar campo externo conforme contrato explícito, sem fallback a ele. Preferência: removê-lo do contrato público para não manter semântica ambígua.
3. Consultar carteira sem getOrCreate; ausência legítima retorna saldozero para o próprio usuário sem escrever. Criação de carteira fica em comando autorizado de domínio.
4. Validar tenant e status do usuário no serviço, não só na rota. Resposta pública não revela elegibilidade derivada do saldo individual nem se uma conta alvo existe.

#### Dados existentes e mudanças de modelo

Não exige mudança de schema para o bloqueio; remover criação por leitura e avaliar carteiras vazias anômalas separadamente, sem excluí-las automaticamente. Integração com convidados de LA-020 não concede saldo por coincidência de email.

#### Testes e validações a executar na implementação

- Sem sessão+userID de terceiro: nenhuma leitura individual nem INSERT; resposta pública genérica ou401 conforme endpoint.
- SessãoA+userIDB/lojaB: nenhum dadoB. Própria carteira inexistente: zero e contagem de carteiras inalterada.
- Teste de paridade da simulação autorizada com cálculo final, respeitando alterações concorrentes no resgate.

#### Critério de aceite

Somente o titular autorizado obtém dados da carteira; consultar não cria nem modifica saldo.

#### Implantação e reversibilidade

Publicar DTO público/personalizado e atualizar widget; eliminar fallback legado em vez de manter acesso anônimo escondido.

### [LA-033] Modelar atores de sistema e registro financeiro sem FKs fictícias

**Achado de origem:** Alerta de pagamento em pedido cancelado viola FKs de auditoria.  
**Severidade original:** HIGH. **Fase de fechamento:** F1.  
**Ponto principal atual:** `app/api/webhooks/asaas/route.ts`; demais consumidores e evidências estão no finding correspondente da auditoria.  
**Dependências e integração:** LA-002, LA-003, LA-005, LA-020 e LA-027.

#### Diagnóstico e objetivo

ASAAS_GATEWAY e order.id estão sendo usados em relações que exigem User.

#### Proposta de correção

1. Recomendar modelo de ator discriminado: USER exige userId válido; SYSTEM/INTEGRATION exige identificador controlado e não se passa por cliente. Distinguir entidade auditada e eventual usuário afetado.
2. AuditLog e OrderStatusHistory devem compartilhar a convenção. targetUserId pode ser opcional; referência ao pedido fica em entityId/orderId apropriado, com tenant e correlação da operação.
3. Aplicar constraints de consistência do ator e validar no serviço. Não remover todas as FKs nem criar contas de login artificiais para esconder o erro.
4. Pagamento de pedido cancelado deve gravar fato financeiro/ocorrência durável e estado de revisão numa transação consistente com o processamento do evento. Notificação operacional é derivada durável, fora da transação; não usar Promise.all de escritas independentes como unidade atômica.
5. Não reabrir automaticamente o pedido; reconciliação de LA-005 decide estoque/estorno e produz seu próprio histórico.

#### Dados existentes e mudanças de modelo

Migration expansiva de ator/tipo e usuário opcional com backfill dos atores humanos existentes. Preservar logs legados; padrões antigos que atribuíram sistema ao cliente devem ser sinalizados quando a origem puder ser demonstrada, sem falsificar autoria.

#### Testes e validações a executar na implementação

- Webhook de pago em cancelado grava ocorrência sem FK inválida; retry não duplica.
- Atores inválidos e tenant incoerente são rejeitados; USER sem userId não passa.
- Falha no registro obrigatório reverte efeitos internos e permite reprocessamento; erro de email posterior não desfaz reconciliação.

#### Critério de aceite

Ações automáticas são rastreáveis sem usuários inventados; exceção financeira nunca se perde por modelagem de auditoria.

#### Implantação e reversibilidade

Expandir modelo/leitores, migrar escritores e então restringir convenção antiga; não apagar auditoria existente.

### [LA-034] Aplicar respostas assíncronas somente à revisão correspondente

**Achado de origem:** Respostas antigas sobrescrevem endereço e estado otimista mais recente.  
**Severidade original:** MEDIUM. **Fase de fechamento:** F3.  
**Ponto principal atual:** `components/checkout/CheckoutForm.tsx`; demais consumidores e evidências estão no finding correspondente da auditoria.  
**Dependências e integração:** LA-007, LA-016 e LA-017; validação no backend permanece obrigatória.

#### Diagnóstico e objetivo

Resposta anterior e rollback de snapshot inteiro sobrescrevem estado mais novo.

#### Proposta de correção

1. CEP/frete: atribuir número de revisão à entrada e cancelar consulta anterior quando possível. Aplicar resultado somente se CEP/revisão atuais coincidirem; AbortController sozinho não garante isso se resposta já concluiu.
2. Ao mudar CEP, invalidar campos derivados e cotação associados ao CEP anterior, preservando separadamente campos editados manualmente. Consulta antiga não pode recolocar cidade/rua ou desligar loading da consulta nova.
3. Carrinho: adotar versão retornada pelo servidor e identidade por mutação. Recomendação inicial de simplicidade: fila sequencial de mutações por carrinho na aba, com erro específico e refetch autoritativo; servidor continua responsável por concorrência entre abas/dispositivos.
4. Se manter otimismo, reverter apenas a operação rejeitada e reaplicar pendentes sobre snapshot atual; nunca restaurar previousCart inteiro. Resposta mais antiga não substitui versão superior.
5. Troca de usuário/tenant desmonta/cancela operações antigas; erros de rede com resultado incerto devem consultar/repetir pela mesma identidade antes de aplicar ação adicional.

#### Dados existentes e mudanças de modelo

Requer revisão/IDs de LA-017; sem nova persistência de dados pessoais no navegador. Versão por requisição de CEP é local, distinta da versão de carrinho do banco.

#### Testes e validações a executar na implementação

- Promessas controladas CEP A/B terminam B→A: endereço final é inteiramente B.
- Update itemA falha enquanto remove itemB confirma: B continua removido e A reflete servidor.
- Resposta antiga chega após logout/login ou depois de checkout: não ressuscita carrinho de outra identidade ou consumido.

#### Critério de aceite

Ordem de chegada de respostas não altera a intenção mais recente nem desfaz sucesso independente.

#### Implantação e reversibilidade

Introduzir estado/versionamento e testes de promises fora de ordem antes de habilitar otimismo adicional.

### [LA-035] Validar capacidade real de cada método antes de reservar

**Achado de origem:** Ausência da chave do gateway produz sucesso para cartão e boleto sem cobrança.  
**Severidade original:** HIGH. **Fase de fechamento:** F2.  
**Ponto principal atual:** `services/checkout.service.ts`; demais consumidores e evidências estão no finding correspondente da auditoria.  
**Dependências e integração:** LA-005, LA-009, LA-012, LA-024, LA-025 e LA-038.

#### Diagnóstico e objetivo

Ausência de configuração pula o gateway e ainda devolve sucesso de cartão/boleto.

#### Proposta de correção

1. Definir capacidades por tenant/ambiente/método a partir de configuração validada no servidor. Cliente recebe apenas lista de métodos disponíveis, sem segredo; valores inválidos de configuração devem falhar explicitamente.
2. Antes de persistir pedido/reserva, rejeitar método remoto desabilitado, credencial obrigatória ausente e valor/plano incompatível. Autorização/credencial remota inválida descoberta depois da chamada segue LA-005, não sucesso.
3. Separar PIX manual/WhatsApp de PIX automático; fallback entre métodos exige escolha informada e política da loja, nunca conversão silenciosa de cartão/boleto.
4. Sucesso de emissão exige identificador e artefatos necessários; operação duravelmente iniciada pode responder PROCESSING, mas não 'boleto gerado' sem boleto.
5. Ambiente de teste usa gateway injetado explicitamente. Não deixar bypass implícito por NODE_ENV esconder ausência de operação nos testes de contrato/integrados.
6. Readiness verifica configuração e conectividade não destrutiva onde possível; não criar cobrança de cliente para provar saúde. Falha temporária desabilita novas operações conforme política e mantém reconciliação das já existentes.

#### Dados existentes e mudanças de modelo

Pode usar configuração atual mais um contrato público de capacidades; revisar isolamento de contas/gateway por tenant. Sem chave disponível, não criar novas compras remotas pendentes sem meio de pagar.

#### Testes e validações a executar na implementação

- Chave ausente, inválida, método desabilitado, total abaixo do piso e plano inválido: erro coerente sem falso sucesso.
- Teste de contrato verifica chamada efetiva ao adapter quando método está habilitado.
- Indisponibilidade entre preflight e chamada cria estado recuperável, não compensa cegamente; método manual habilitado continua explicitamente manual.

#### Critério de aceite

Todo método exibido tem um caminho homologado; capacidade/configuração ausente é detectada antes de produzir sucesso ilusório.

#### Implantação e reversibilidade

Publicar capacidades e UI, depois impor o contrato no backend; alertar indisponibilidade sem vazar credenciais.

### [LA-036] Definir LTV por fatos financeiros reconhecidos

**Achado de origem:** Métricas de gasto do cliente somam pedidos pendentes e cancelados.  
**Severidade original:** MEDIUM. **Fase de fechamento:** F3.  
**Ponto principal atual:** `services/customer.service.ts`; demais consumidores e evidências estão no finding correspondente da auditoria.  
**Dependências e integração:** LA-005 e estados conciliados; política explícita antes de publicar indicador revisado.

#### Diagnóstico e objetivo

Total de tentativas de pedido é apresentado como gasto, incluindo pendentes/cancelados sem pagamento.

#### Proposta de correção

1. Definir separadamente quantidade/valor de pedidos realizados, receita recebida/aprovada conforme política comercial e gasto líquido após reembolsos/chargebacks.
2. Recomendação para LTV: base financeira reconhecida menos devoluções confirmadas; enquanto o modelo novo não existir, filtro de estados pagos só é solução transitória, pois pedido CANCELLED pode continuar com dinheiro não estornado.
3. Centralizar política e função de agregação utilizada por lista/perfil/métricas; ticket médio usa população e denominador correspondentes, com retornozero para conjunto vazio.
4. Documentar inclusão ou exclusão de frete/juros, período e fuso. Recomendação de apresentação: valor de mercadorias e total desembolsado separados para evitar misturar indicadores.
5. Invalidar/recalcular cache quando pagamento/estorno muda, preservando tenant e filtros. Não aplicar valor atual do produto ao histórico.

#### Dados existentes e mudanças de modelo

Usa histórico financeiro de LA-005. Recalcular projeções de leitura com dados conciliados; indicadores legados sem fatos suficientes devem ser identificados como estimados, não reescrever pedidos.

#### Testes e validações a executar na implementação

- Pedido não pago cancelado não aumenta LTV; pago de100 com estorno30 contribui70 sob a política proposta.
- Dois eventos de recebimento não contam duas vezes; pago cancelado aguardando estorno não perde fato financeiro sem explicação.
- Lista e painel individual batem para mesmo conjunto, inclusive zero pedidos, timezone e tenant.

#### Critério de aceite

Rótulo, fórmula e fatos agregados coincidem; receita não cresce por mera tentativa de compra.

#### Implantação e reversibilidade

Publicar definição do indicador com recálculo comparativo; não tratar mudança esperada de LTV como perda de dados.

### [LA-037] Usar a política única de transições com modalidade

**Achado de origem:** Admin não consegue concluir retirada diretamente de PAID para DELIVERED.  
**Severidade original:** MEDIUM. **Fase de fechamento:** F3.  
**Ponto principal atual:** `services/order.service.ts`; demais consumidores e evidências estão no finding correspondente da auditoria.  
**Dependências e integração:** LA-002, LA-026, LA-027.

#### Diagnóstico e objetivo

O serviço e a UI perdem deliveryType e não aplicam a exceção já existente para retirada.

#### Proposta de correção

1. Passar modalidade persistida à política central sob o lock do pedido. Pedido PICKUP/NONE pago pode concluir diretamente quando a política atual permitir; DELIVERY mantém sequência logística apropriada.
2. Substituir tabela duplicada da UI por ações permitidas calculadas pelo backend ou por função pura compartilhada e contextual, sempre revalidada no servidor.
3. Usar o mesmo comando para confirmação administrativa e do cliente, preservando regras de quem pode confirmar e registrando origem/ator distintos.
4. Conclusão de retirada não exige tracking fictício; confirmação pelo Admin não deve gravar que o cliente confirmou pessoalmente. Manter semântica de deliveredConfirmedBy e histórico.

#### Dados existentes e mudanças de modelo

Não requer estado novo isolado; pode exigir ampliar metadados de confirmação/ator de LA-027. Pedidos legados SHIPPED por contorno não devem ser reclassificados em massa sem confirmação operacional.

#### Testes e validações a executar na implementação

- PICKUP e NONE em PAID→DELIVERED aceitos; DELIVERY não ganha atalho indevido.
- UI apresenta somente ações válidas; chamada direta malformada é rejeitada.
- Cancelamento concorre com entrega: uma só transição válida e histórico correto.

#### Critério de aceite

Retirada conclui sem expedição artificial e todas as entradas seguem a mesma regra de modalidade/autoria.

#### Implantação e reversibilidade

Entregar mudança do serviço e UI conjuntamente; preservar comportamento legítimo do confirm-delivery.

### [LA-038] Separar DTO público de configurações secretas da loja

**Achado de origem:** Endpoint público de loja serializa credencial dos Correios.  
**Severidade original:** HIGH. **Fase de fechamento:** F0.  
**Ponto principal atual:** `services/loja.service.ts`; demais consumidores e evidências estão no finding correspondente da auditoria.  
**Dependências e integração:** Independente para fechamento inicial; revisar LA-007, LA-008, LA-031 e LA-035 para não reintroduzir segredo nos DTOs.

#### Diagnóstico e objetivo

O serviço público seleciona senha/contrato dos Correios e a rota serializa o objeto integral.

#### Proposta de correção

1. Criar seleção/DTO explícitos para leitura pública, contendo somente identidade visual, dados de contato autorizados e capacidades necessárias à compra. Não reutilizar LojaSettings administrativo como DTO público.
2. Manter credenciais exclusivamente no serviço de integração do servidor. Respostas administrativas devem mascarar segredos e distinguir campo não informado de comando explícito de substituir/remover.
3. Revisar demais rotas, props de Server Components para Client Components, payload de hidratação, cache e logs que consomem o objeto: uma tipagem omitindo a propriedade não remove o campo em runtime.
4. Na implantação futura, avaliar se a rota esteve exposta com credenciais válidas; quando houver exposição ou incerteza relevante, rotacionar credencial, purgar cópias em cache sob controle e acompanhar saúde da integração. Não declarar comprometimento sem evidência.
5. Testes de contrato devem usar credenciais-canário fictícias e garantir ausência de valores e nomes de campos sensíveis nos contratos públicos.

#### Dados existentes e mudanças de modelo

Correção principal não precisa mudar schema. Se gestão de segredos for ampliada, preservar compatibilidade de leitura durante rotação, com acesso restrito; não copiar senha para novos campos públicos para manter cliente antigo.

#### Testes e validações a executar na implementação

- GET por slug e active sem sessão não retornam credenciais; testar corpo completo serializado, não só TypeScript.
- Renderização pública e caches não contêm canário; atualização Admin mascarada não sobrescreve segredo inadvertidamente.
- Após rotação em homologação, cotação autenticada continua funcionando e credencial antiga não é utilizada.

#### Critério de aceite

Nenhum contrato público entrega segredo; integração continua funcional com credencial gerida no servidor.

#### Implantação e reversibilidade

Priorizar este bloqueio antes das outras entregas; remoção do vazamento permanece em qualquer rollback. Rotação real é tarefa futura, não executada neste documento.

## 6. Plano consolidado de dados e migrations

As mudanças abaixo são escopo futuro. Não se deve gerar/aplicar migrations isoladas para cada finding sem consolidar o modelo, pois vários compartilham as mesmas relações.

| Bloco proposto | Achados relacionados | Mudança de modelo provável | Tratamento de legado e risco |
|---|---|---|---|
| História de schema | LA-030 | DDL faltante, baseline/resolução somente quando comprovados, preservação de constraints extras | Ensaiar banco vazio e clone; não editar history aplicada nem usar reset para eliminar divergência. |
| Intenção e consumo | LA-004, LA-011, LA-012, LA-015, LA-016 | Intenção por dono/tenant e revisão; hash; vínculo único a pedido/carrinho | Chave nula antiga não prova duplicação; vínculos não inferidos só por semelhança. |
| Pagamentos e eventos | LA-003, LA-005, LA-009, LA-010, LA-035 | Tentativas, contratos/parcelas, estados, correlação, inbox/outbox, lease e retry | Identificar cobrança real antes de criar/estornar; marcador antigo não prova processamento. |
| Concorrência de pedido | LA-002, LA-026, LA-027, LA-037 | Versão, comando/efeito único, histórico integrado | Só marcar efeito/reserva como aplicado com evidência; não duplicar restituições ao inicializar controle. |
| Carrinho e tenant | LA-014 a LA-017 | Loja/dono, versão, unicidade parcial ACTIVE, identidade de mutação | Auditar mistura de tenant e múltiplos carrinhos; não apagar itens para satisfazer índice. |
| Inventário e variantes | LA-001, LA-018, LA-019 | Estado de retirada, versão de inventário, reserva/movimentos e destino de restituição | Produto/variante com histórico nulo ou ambíguo exige reconciliação; stock0 não prova retirada. |
| Comprador e endereços | LA-020, LA-024 | Snapshot de comprador, possível vínculo opcional User, cobrança/entrega distintos | Revisar todos os leitores, envio de email, Admin e fidelidade antes de criar guest sem User. |
| Fidelidade | LA-021 a LA-023 | Lotes, alocações, identidade de efeito, saldo disponível/déficit, política congelada | Ledger imutável; ajustes compensatórios e origem desconhecida preservados; CHECK não bloqueia estorno financeiro. |
| Atores e auditoria | LA-027, LA-033 | Ator tipado, referência humana opcional, origem/entidade/correlação | Não criar usuário de login artificial; reconstrução de histórico claramente identificada. |
| Frete e configuração | LA-008, LA-031 | Revisões de regra/dados e snapshot de cotação autorizada | Token antigo invalidado por versão; não recalcular frete já contratado. |
| Credencial de recuperação | LA-028 | Consumo condicional; hash de token como endurecimento associado | Tokens antigos podem precisar ser reemitidos; não reduzir validação para manter compatibilidade. |

### 6.1. Protocolo de saneamento futuro

1. Fazer inventário somente leitura, incluindo quantidades, vínculos, reservas, saldos, pagamentos e grupos ambíguos.
2. Definir o que é comprovável e separar o que depende de operador/cliente/gateway. Não usar nomes/cores/preços parecidos como prova suficiente de identidade histórica.
3. Obter backup consistente e demonstrar restauração em ambiente isolado. Para dados sensíveis em clone, aplicar controle de acesso e minimização adequados ao teste.
4. Elaborar saneamento com modo de simulação, contagens antes/depois, verificação de FKs e critérios de abortar. Scripts de variantes devem respeitar auditoria e backup, mantendo o padrão read-only salvo aplicação explícita.
5. Aplicar mudanças compensatórias rastreáveis em lotes e por identidade de execução; não apagar evidência para fechar números.
6. Validar invariantes depois de cada lote e após execução inteira. Divergência interrompe a ampliação do lote, não é convertida em sucesso.
7. Ativar constraints somente após compatibilizar registros e escritores. Manter exceções históricas representadas quando não for correto impor a regra de novas vendas a todo o passado.

**Snapshot da auditoria não é plano de backfill:** os 33 itens sem variante, 24 chaves nulas e zero linhas de histórico são sinais a investigar, não autorização para preenchimento automático. A ausência de saldo negativo naquele momento tampouco garante que um CHECK possa ser instalado sem revisar estornos de pontos já utilizados.

### 6.2. Compatibilidade e rollback

Recomenda-se expansão → leitura compatível → escrita nova → backfill comprovado → constraints → remoção do caminho antigo. Publicar frontend/backend e consumidores conforme suas dependências; migração com nova semântica exige rollback compatível com os dados já escritos.

Não apagar tentativas, eventos, ledger ou histórico para voltar versão. Se código antigo ignora variante retirada, ator de sistema ou pagamento incerto, voltar somente o binário pode recriar o problema. O plano de contingência deve priorizar desabilitar novas operações afetadas, manter consulta/reconciliação e corrigir adiante; restauração de backup é procedimento separado, com avaliação das operações financeiras ocorridas desde o ponto restaurado.

## 7. Roteiro de execução futura

### 7.1. Entregas por fase

| Fase | Fechamentos | Entrega verificável |
|---|---|---|
| F0 | LA-006, LA-030, LA-038 | Testes não alcançam dados reais; schema reproduzível; DTO público sem credencial. |
| F1 | LA-002, LA-014, LA-017, LA-018, LA-019, LA-020, LA-021, LA-022, LA-027, LA-028, LA-029, LA-032, LA-033 | Comandos/atores e invariantes de banco corretos; modelo de identidade e dados estável; concorrência de domínio homologada. |
| F2 | LA-001, LA-003, LA-004, LA-005, LA-008, LA-009, LA-010, LA-011, LA-012, LA-013, LA-015, LA-023, LA-031, LA-035 | Uma intenção produz compra autorizada, reserva correta e tentativa conciliável, com preços/frete/pontos consistentes e processamento durável. |
| F3 | LA-007, LA-016, LA-024, LA-025, LA-026, LA-034, LA-036, LA-037 | UI e Admin refletem os contratos corrigidos, sobrevivem a reload/latência e exibem dados persistidos corretos. |
| F4 | Revalidação integrada dos 38 IDs | Homologação dos gates de produção, ensaio operacional, recuperação e evidência final por finding. |

A correção de um núcleo pode ter consumidores entregues numa fase posterior; até eles estarem compatíveis, o fluxo afetado não deve ser anunciado como pronto. A fase F0 não precisa esperar a revisão de toda a UI, e remover exposição de credencial pode ser isolado. Já a mudança do estado financeiro exige entrega coordenada, mesmo quando dividida em PRs pequenos.

### 7.2. Pacotes técnicos para revisão

- **Ambiente e recuperação:** teste isolado, migrations reproduzíveis, backup/restauração.
- **Identidade e contratos públicos:** tenant, convidados, simulação, credenciais e DTOs.
- **Comando transacional:** máquina de estados, reserva, ledger, atores e histórico.
- **Compra única:** intenção, consumo de carrinho, versão, preço e regras unificadas.
- **Financeiro:** tentativa, inbox/outbox, conciliação, estorno e prazos por método.
- **Logística:** cotação assinada, revisões/cache, endereço de cobrança/entrega e expedição.
- **Experiência e indicadores:** bootstrap do carrinho, confirmação completa, concorrência do cliente e métricas.

Cada pacote deve terminar com evidência por ID da auditoria, não apenas lista de arquivos alterados. Não se estima prazo em dias sem conhecer disponibilidade da equipe, ambiente de homologação e volume de saneamento. O esforço mais incerto está em LA-005, LA-021/LA-022, LA-030 e tratamento de legados; correções pequenas de schema/DTO não eliminam essa dependência.

## 8. Critérios objetivos de prontidão para produção

### 8.1. Evidência exigida por finding

Para encerrar cada LA, registrar: versão/commit futuro, comportamento corrigido, teste que reproduzia a falha, teste positivo relacionado, validação de regressão entre camadas, impacto nos legados, migration aplicada quando houver e evidência de observação em homologação. Uma hipótese de solução não encerra um finding.

**Meta de liberação do escopo completo:** os 38 findings encerrados com evidência. Uma liberação parcial só pode excluir funcionalidade de forma explícita, com bloqueio no servidor e revisão de todos os caminhos alternativos; ocultar botão não basta. Um recurso desabilitado reduz exposição, mas seu finding continua pendente e não conta como corrigido.

### 8.2. Matriz de homologação

| Gate | Cenários mínimos | Condição de aprovação |
|---|---|---|
| G1 — isolamento | URL divergente, credencial restrita, sentinela ausente, servidor/fixture separados | Nenhuma escrita fora do banco efêmero; todas as recusas ocorrem antes de seed/cleanup. |
| G2 — schema e restauração | Banco vazio, clone atualizado, migração repetida, restauração de backup | Mesmo schema esperado, dados/vínculos preservados, aplicação consulta os objetos usados; recuperação cronometrada e documentada. |
| G3 — estoque/variante | Última unidade, duas variantes, variante retirada, item repetido, edição Admin concorrente | Sem estoque vendável negativo/artificial; uma reserva por unidade vendida e restituição no destino correto. |
| G4 — intenção/carrinho | Duas abas, duas chaves, reload, resposta perdida, alteração de versão durante checkout | Um pedido por intenção consumível, nenhum item novo apagado e nenhum carrinho consumido reaparecendo. |
| G5 — autorização | IDs de outra loja/usuário, email de conta existente, chave alheia, simulação anônima, DTO público | Zero leitura/mutação de conta alheia e zero segredo serializado. |
| G6 — pagamento | PIX, boleto, cartão1x/parcelado; aprovação, recusa, timeout, estorno | Nenhuma duplicação por retry; total/método/IDs conciliados; estado incerto visível e recuperável. |
| G7 — falhas intermediárias | Processo morre após commit local, após aceite remoto e antes de persistir resposta; falha de QR/linha digitável | Retomada pela mesma intenção/tentativa, sem cobrar novamente nem liberar estoque indevidamente. |
| G8 — eventos e jobs | Duplicados, fora de ordem, evento antes da resposta, dois consumidores, lease vencido, cron concorrente com pagamento | Efeitos únicos, sem regressão de estado, backlog retomável e prazo por método respeitado. |
| G9 — fidelidade | Ajuste sem EARN, lotes mistos, duas expirações, resgate simultâneo, estorno de pontos gastos | Saldo/lotes/ledger fecham; pontos válidos preservados; déficit não bloqueia devolução financeira legítima. |
| G10 — logística | Cotação válida/expirada, entrada alterada, mesmo pacote com valores diferentes, mudança de regra entre instâncias | Preço autorizado correto; não há frete grátis por falha; cache antigo não autoriza regra revogada. |
| G11 — cliente/Admin | CEP fora de ordem, rollback otimista, cancelamento na confirmação, rastreio e retirada | Estado exibido corresponde à revisão atual; toda informação aceita pelo modal é persistida. |
| G12 — autenticação | Duplo consumo de token, token reemitido, dois admins se despromovendo/bloqueando | Um consumo válido, sessões revogadas e pelo menos um admin ativo no escopo protegido. |
| G13 — integridade e métricas | Histórico, auditoria, receitas e reembolsos parciais/integrais | Timeline completa para novas operações; indicadores coerentes com fatos e sem dupla contagem. |
| G14 — produção técnica | Build, typecheck, lint aplicável, suite unitária e integração isolada, E2E, carga e múltiplas instâncias | Sem falhas dos cenários acima; capacidade medida no volume-alvo acordado e sem saturação de conexões/locks. |

Para testes de concorrência, usar conexões PostgreSQL independentes e barreiras controladas para produzir o interleaving; Promise.all sobre mocks ou sobre uma única conexão não comprova isolamento real. Para falhas de pagamento, combinar adapter simulado determinístico com sandbox e recuperação de processo; sandbox isolado não substitui injeção dos pontos de falha.

A carga-alvo, orçamento de latência, número de workers, pool de conexões e tempo máximo de transação devem ser definidos a partir do tráfego esperado. Não se inventa neste plano um RPS que declare o projeto pronto sem medição.

### 8.3. Operação, alertas e reconciliação

Antes de liberar métodos financeiros, prover:

- Correlação de tenant, intenção, pedido, tentativa, evento e efeito, sem dados completos de cartão, token de recuperação, credencial ou documento pessoal nos logs.
- Painel de tentativas UNKNOWN, eventos recebidos não processados, leases abandonados, retries esgotados e cancelamentos/estornos pendentes.
- Alertas quando idade de uma pendência excede o prazo configurado para seu método/estado; valores numéricos devem ser fixados em homologação, com responsável e janela de atendimento.
- Reconciliação periódica entre contratos/cobranças externas e registros internos, e entre reservas, estoque disponível e movimentos. Divergência gera caso operacional, não correção automática sem prova.
- Relatório de carteiras/ledger/lotes e de histórico/transições, permitindo identificar efeito ausente ou repetido.
- Procedimento administrativo para revisar resultado incerto, reenfileirar de forma idempotente e concluir cancelamento/estorno; sem necessidade de editar banco diretamente.
- Comprovação de agendamento real dos crons/consumidores, inclusive quando nenhuma página está aberta; monitorar último sucesso e atrasos.
- Runbook de indisponibilidade do gateway/transportadora, suspensão de novas vendas afetadas e continuidade de conciliação das já iniciadas.
- Backup e restauração testados; RPO/RTO acordados para a operação. Restaurar dados locais exige reconciliar operações remotas posteriores ao ponto de restauração.

Notificações ao cliente precisam dizer o que aconteceu: pedido registrado, pagamento em processamento, pagamento confirmado, cancelamento solicitado ou estorno confirmado. A aplicação não deve prometer devolução concluída antes de ter esse fato.

### 8.4. Implantação e decisão de liberar

1. Aprovar o desenho de dados e as políticas da seção3, com matriz de dependências e responsáveis técnicos/operacionais.
2. Concluir F0 e demonstrar isolamento antes de iniciar testes destrutivos em ambiente descartável.
3. Executar F1–F3 em entregas compatíveis, com migrations expansivas e consumidores coordenados.
4. Ensaiar saneamento e implantação sobre clone; não usar dados reais para experimentar retries de cobrança.
5. Aprovar gates G1–G14 e registrar limitações restantes por funcionalidade. Recursos com risco não resolvido permanecem indisponíveis no servidor.
6. Liberar progressivamente métodos/lojas/volume conforme estratégia operacional definida, acompanhando taxas de erro, pendências e reconciliação.
7. Encerrar a observação somente após ciclos completos de pagamento, expiração, cancelamento/estorno e jobs relevantes. Um smoke test logo após o deploy não basta.

## 9. Limitações e conclusão das propostas

Este documento se baseia na auditoria fornecida e numa revisão dirigida de contratos e pontos do código. Não substitui nova auditoria da versão implementada. Não foram reexecutados testes, build, lint, queries PostgreSQL, sandbox de pagamento, jobs ou migrations para validar uma solução que ainda não existe.

Os pontos dependentes de contrato externo — garantia de idempotência remota, estados financeiros por método, cancelamento, prazo e estorno — deverão ser confirmados no endpoint/conta e ambiente de homologação utilizados. Este plano não inventa uma garantia de rede ou gateway para fechar uma lacuna.

Há uma proposta individual para cada **LA-001 a LA-038**, além de um desenho comum de integridade, migração, testes e operação. O resultado pretendido é uma compra que preserve identidade, total e estoque, permaneça autorizada em todos os caminhos e possa ser recuperada após falhas sem duplicar efeitos. **Nenhuma dessas correções foi implementada nesta etapa.** A prontidão para produção dependerá de executar o plano e comprovar os critérios de aceite.

