# Workflow de continuidade — SMB Store, Nuvemshop e produção

**Revisão:** 30/10/2026

**Objetivo:** retomar do ponto comprovado, concluir a integração com a SMB Store por meio da Nuvemshop e só então liberar a operação de produção.

**Estado desta revisão:** diagnóstico e plano; nenhuma chamada a banco/provedor, escrita, deploy, teste ou mudança de branch foi feita nesta tarefa.

## 1. Conclusão executiva: onde o trabalho parou

A etapa de identidade do catálogo foi concluída na homologação. O PR [#14](https://github.com/ViniMoia/Sistema-E-Commerce/pull/14) entrou em `homologacao_teste`; em 23/10, após preflight e backup restaurado, foram persistidos **517 IDs de variantes Nuvemshop em 517 variantes locais**, em 11 lotes auditados. Cada lote e sua auditoria foram atômicos; os 11 lotes concluíram, mas a sequência inteira não foi uma única transação. Não foram criadas/excluídas variantes nem alterados estoque, preço ou dados financeiros. A loja Nuvemshop consultada era a comercial (`8179726`), mas todas as consultas foram GET e houve zero escrita na Nuvemshop/SMB. A escrita ocorreu apenas na base `continental-homologacao`.

Dois produtos foram mantidos fora da correspondência automática: um cadastro local sem identidade remota e o pano 30x30 cujo ID remoto hoje pertence a um produto diferente, 40x40. Permaneceram três variantes sem vínculo e 45 produtos remotos fora da carga. Essas exceções não devem ser resolvidas por nome aproximado, ordem de lista ou quantidade em estoque.

**A interação SMB ainda não está concluída.** A branch `homologacao_teste` contém leitor de catálogo, planejador de correspondência e gravador transacional de vínculos. Não contém uma integração operacional Nuvemshop para webhook de estoque/pedido, exportação de pedido, reconciliação ou cancelamento. A própria evidência de aplicação diz que vínculo de variante não habilita sincronização, exportação de pedido nem comprova baixa no SMB. O trabalho parou antes do contrato de comportamento do conector.

O pedido histórico Continental #31 / Nuvemshop #100 tem comprovante apresentado como “Venda” no SMB. Isso prova o registro da venda, mas **não** prova movimento de estoque, saldo antes/depois, ausência de baixa dupla ou liquidação no gateway. O teste antigo criou o pedido como pago e baixou estoque local diretamente; não é prova do fluxo atual e não deve ser repetido nem compensado.

## 2. Base de código e branches consultadas

Consulta feita ao remoto GitHub `origin` em 30/10/2026, além de leitura de `origin/main` e do checklist/evidências locais. `origin/main` (`7f9b26e`, 02/10) é uma referência anterior, somente leitura; a auditoria de arquitetura dessa revisão registrava que ainda não havia adapter/webhook Nuvemshop. A homologação recebeu o avanço posterior. Não tratar o achado antigo como descrição do código atual, nem tratar o código mais novo como prova de funcionamento externo.

| Branch remota | Head consultado | Estado relevante |
|---|---|---|
| `origin/main` | `7f9b26e` · 02/10 | Baseline GitHub; somente leitura. |
| `origin/homologacao_teste` | `f64a000` · 25/10 | Ponto publicado mais novo. Inclui PRs abaixo e documentação da transferência para notebook; ainda é candidata, não aceite de produção. |
| `origin/feat/nuvemshop-variant-bindings-20261022` | `cea40d9` · 22/10 | Integrada à homologação pelo PR #14. Implementa identidade/vínculo de variantes, não o conector de pedidos/estoque. |
| `origin/feat/scoped-payment-execution-20261023` | `34ab8ea` · 23/10 | Integrada pelo PR #15 em 25/10. Execução financeira escopada por evento/pedido; não cria webhook/cron nem habilita consumidor, e não implementa SMB. |
| `origin/feat/boleto-refund-20261021` | `727ed8c` · 21/10 | Integrada à homologação pelo PR #12. |
| `origin/fix/no-image-uploads-20261021` | `176e2a5` · 21/10 | Integrada pelo PR #11; imagens externas preservadas e uploads bloqueados. |
| `origin/fix/admin-whatsapp-overlay-20261020` | `e041570` · 20/10 | Integrada pelo PR #10. |
| `origin/revisao/dashboard-financeiro-20261016` | `d78fdae` · 19/10 | Integrada pelo PR #8. |
| `origin/trabalho/g6-supervisao-20261019` | `079bc9c` · 19/10 | Integrada pelo PR #9. |
| `origin/docs/roteiro-aceite-financeiro-20261021` | `e28e225` · 21/10 | É a branch deste diretório de trabalho; entrou na linha de transferência/homologação. A cópia atual está suja. |
| `origin/docs/aceite-e-devolutiva-20261020` | `3c3bf72` · 20/10 | Branch documental separada; não é o head de homologação. Consultar como referência, sem trocar o ponto de partida. |
| `origin/isolamento` | `d066628` · 29/09 | Branch antiga de isolamento do provedor de e-mail; não integrada ao head atual. |
| `origin/dependabot/github_actions/actions/checkout-7.0.1` | `e74eaa7` · 29/09 | PR aberto na consulta; não integrado. |
| `origin/dependabot/github_actions/actions/setup-node-7.0.0` | `46b57be` · 29/09 | PR aberto na consulta; não integrado. |
| `origin/dependabot/npm_and_yarn/hookform/resolvers-5.9.1` | `6e32770` · 29/09 | PR aberto na consulta; não integrado. |
| `origin/dependabot/npm_and_yarn/prisma/client-7.10.0` | `97d41f9` · 29/09 | PR aberto na consulta; salto de versão principal exige revisão própria; não integrar em lote. |
| `origin/dependabot/npm_and_yarn/radix-ui/react-dialog-1.1.23` | `a767fea` · 29/09 | PR aberto na consulta; não integrado. |
| `origin/dependabot/npm_and_yarn/radix-ui/react-slot-1.3.3` | `9f37ea2` · 29/09 | PR aberto na consulta; não integrado. |
| `origin/dependabot/npm_and_yarn/sonner-2.0.8` | `4b6b3aa` · 29/09 | PR aberto na consulta; não integrado. |

Na página do GitHub, os sete PRs abertos eram esses PRs de dependabot; os PRs #14 e #15 aparecem como merged. A branch local `main` está seis commits à frente de `origin/main`, mas esses seis commits são ancestrais de `origin/homologacao_teste`; não é necessário copiá-los para retomar. A regra local de variantes está refletida em homologação.

### Estado da cópia local

O diretório atual está na branch `docs/roteiro-aceite-financeiro-20261021` (`e28e225`), com 13 arquivos rastreados modificados e vários arquivos novos/locais, inclusive a cópia dos módulos/evidências Nuvemshop. **Não executar `checkout`, `reset`, `clean` ou cherry-pick nesse diretório sem antes inventariar e preservar esse trabalho.** Há um worktree limpo já alinhado com o head publicado: `C:\Diversos\TI\Trabalhos\2026\Sistemas\Projeto-notebook-20261025`, branch `trabalho/transferencia-notebook-20261025`, acompanhando `origin/homologacao_teste` em `f64a000`. Usar esse worktree como ponto de partida para o próximo PR e manter a cópia atual intacta.

## 3. Como SMB e Nuvemshop se comportam — contrato a confirmar

O desenho adotado é SMB Store Online ↔ aplicativo oficial SMB Store na Nuvemshop ↔ este e-commerce. Não há evidência de API SMB própria sendo usada pelo projeto; a Nuvemshop é a ponte. A documentação oficial do app descreve sincronização de estoque, vendas feitas na Nuvemshop e compras lançadas no SMB. O manual do SMB explica que uma venda originada na Nuvemshop cria uma venda no SMB e movimenta o estoque; uma venda lançada no SMB gera ajuste de estoque na Nuvemshop sem criar outra venda. Movimentações de venda, compra, ajuste, inventário e cancelamento no SMB também podem atualizar o estoque Nuvemshop.

Antes de implementar, confirmar com a configuração efetiva da conta e, se necessário, com o suporte SMB:

1. Se pedido criado por API na Nuvemshop entra no SMB como venda, em quais status e com quais regras de caixa/financeiro.
2. Como registrar corretamente um pagamento confirmado no Asaas quando a ordem é criada por API; não simular pagamento nem marcar pedido como pago só para provocar importação no SMB.
3. Qual opção de estoque (`claim` ou `bypass`) evita estoque reservado/baixado duas vezes entre API Nuvemshop e app SMB. A API Nuvemshop documenta que `claim` reserva estoque e `bypass` não reserva; não escolher por suposição.
4. Se cancelamento/restock/refund do pedido API produz uma única reversão no SMB e na Nuvemshop; distinguir cancelamento financeiro de devolução física.
5. Qual loja/local de estoque é autoritativa, como funcionam estoque separado e estoque mínimo Nuvemshop, e quais configurações da empresa SMB alteram a sincronização.
6. O atraso/SLA de sincronização e como consultar o histórico de vendas e movimentações no SMB para auditar uma venda.

O guia existente [GUIA_INTEGRACAO_ESTOQUE_SMB_NUVEMSHOP.md](../INTEGRACAO/GUIA_INTEGRACAO_ESTOQUE_SMB_NUVEMSHOP.md) é uma proposta arquitetural antiga, não evidência de recurso ativo. Atualizá-lo depois de responder esses pontos: o comportamento de pedido API e reserva de estoque precisa refletir a configuração confirmada do app SMB e a API atual.

Fontes consultadas em 30/10/2026:

- [Manual SMB — vendas integradas à Nuvemshop](https://tutoriais.smbstore.com.br/vendas-pre-pedidos-integrados-a-nuvemshop)
- [Manual SMB — ativar produtos e sincronizar estoque](https://help.smbstore.com.br/ativar-produtos-na-integracao-nuvemshop)
- [Página oficial do app SMB Store na Nuvemshop](https://www.nuvemshop.com.br/loja-aplicativos-nuvem/smb-store)
- [API Nuvemshop — pedidos, criação e comportamento de estoque](https://tiendanube.github.io/api-documentation/resources/order)
- [API Nuvemshop — webhooks, assinatura, duplicação e ordenação](https://tiendanube.github.io/api-documentation/resources/webhook)

## 4. Workflow executável

### Etapa 0 — Retomar sem perder trabalho

**Ação:** iniciar no worktree limpo `Projeto-notebook-20261025`, verificar que está em `f64a000` e criar uma branch de integração nova a partir de `origin/homologacao_teste`. Não trabalhar diretamente em `main` ou na cópia suja `Projeto`.

**Registrar:** SHA-base, `git status`, worktree ativo e PRs abertos. Revisar os sete PRs de dependabot individualmente em tarefa separada, especialmente o salto Prisma 5→7; não misturar upgrades de dependência à integração.

**Saída:** branch isolada limpa, sem perda nem incorporação implícita dos artefatos locais.

### Etapa 1 — Revalidar identidade e configuração somente leitura

**Ação:** consultar a documentação de `origin/main` e os documentos/evidências da candidata; usar as evidências de 21–23/10 como histórico, não como fotografia de hoje. Em transação somente leitura, conferir identidade da base de homologação, `storeId`, contagem de produtos/variantes, IDs externos, `catalogVersion`, reservas, carrinhos/pedidos e lojas. Na Nuvemshop, somente GET, conferir a identidade da loja, catálogo e IDs ligados. Não acessar nem escrever no banco principal.

**Preservar:** os 517 vínculos já aplicados; tratar os dois produtos excluídos e as três variantes sem ID como exceções que exigem revisão. Não usar botões de sincronização em massa do app SMB nem importar os 45 produtos remotos sem escopo e comparação aprovados.

**Saída:** relatório novo com contagens, hash/horário/fuso, revisão, IDs de loja e diferenças desde 23/10. Nenhuma mutação.

### Etapa 2 — Fechar contrato com SMB e Nuvemshop

**Ação:** registrar uma matriz por evento, direção, sistema de origem, efeito esperado e responsável. Confirmar em ambiente de teste SMB↔Nuvemshop ou com suporte SMB, usando produto/empresa descartável. Mapear: ajuste de estoque no SMB; venda física no SMB; venda originada no e-commerce; pedido não pago; pagamento confirmado; cancelamento; estorno; devolução física; pedido repetido; atualização fora de ordem; falta de estoque; indisponibilidade e timeout.

**Bloqueio de segurança:** a leitura existente comparou homologação a uma loja Nuvemshop comercial, em modo read-only. Não fazer POST, PUT, cancelamento, mudança de estoque nem criar pedido de teste nessa loja comercial. Se não existir sandbox SMB+Nuvemshop, solicitar ao SMB uma empresa/loja de teste ou uma janela assistida com produto e procedimento de reversão explicitamente aprovados.

**Saída:** contrato escrito que define fonte de verdade, status que gera venda no SMB, regra de reserva, tratamento de estorno/cancelamento e prova de movimento de estoque. Não começar a escrita do conector antes disso.

### Etapa 3 — Desenhar o fluxo e os invariantes

**Fluxo alvo a validar:**

```text
SMB (estoque e operação física)
  ⇄ aplicativo SMB Store ⇄ Nuvemshop
                           ⇄ API/webhooks ⇄ e-commerce
```

O app SMB já sincroniza estoque e vendas entre SMB e Nuvemshop; o conector próprio deve evitar competir com esse sincronizador. Determinar um único efeito de estoque por evento. Webhook serve como aviso; buscar o recurso canônico na Nuvemshop antes de atualizar a projeção local. A API informa que eventos podem chegar duplicados e fora de ordem; deduplicar e reconciliar por estado atual.

Desenhar os seguintes limites antes da implementação:

- Pedido local só pode avançar ao SMB/Nuvemshop quando o estado financeiro aprovado for definitivo. Não reusar a prática do script histórico que injetava `paid`.
- A reserva local, o estoque Nuvemshop e a baixa SMB têm momentos distintos. Especificar quem reserva, quem confirma a venda e quem libera estoque em cancelamento/expiração, sem dupla baixa/liberação.
- Gravar correlação entre pedido local e ID remoto; usar outbox/worker durável, idempotência, lease, backoff, limite e revisão manual de resultado incerto. Após timeout de criação, consultar e reconciliar antes de tentar criar outro pedido.
- Validar assinatura HMAC no corpo original, `store_id`, evento/recurso, origem HTTPS e limites de payload. Nunca aceitar ID de produto/loja informado pelo cliente como autoridade.
- Usar os IDs persistidos da variante e a regra de variantes de [AGENTS.md](../../../AGENTS.md); não inferir outro vínculo. Manter o vínculo interno do `useFieldArray` separado do ID persistido.
- Não transportar segredos, dados pessoais desnecessários nem credenciais para logs/evidências.

**Saída:** diagrama de sequência, tabela de transições e estados de erro aprovada contra os manuais atuais e resposta do SMB.

### Etapa 4 — Implementar em PRs pequenos

1. **Ingestão segura:** endpoint de webhook Nuvemshop autenticado por HMAC, escopo de loja e evento mínimo. Persistir envelope/outbox e responder rápido; não processar venda/estoque dentro da requisição.
2. **Leitura canônica/reconciliação:** GET limitado à loja/recurso autorizado, tradução e validação dos IDs já vinculados, reconciliação de estoque disponível/reservado e estado de pedido. Tratar produto removido, variante aposentada, conflito de versão e estoque inválido com falha fechada/auditoria.
3. **Pedido de saída:** conectar a confirmação de pagamento ao executor durável já existente. Criar o pedido remoto uma única vez; registrar resultado incerto, referência externa, ID remoto e correlação. Escolher `inventory_behaviour` apenas conforme a decisão da Etapa 2.
4. **Cancelamento e compensação:** mapear expiração, cancelamento, refund e retorno físico com efeitos financeiros e de estoque independentes. Não reenviar operação possivelmente enviada sem reconciliação remota.
5. **Reconciliação e observabilidade:** job de comparação periódico, backlog/idade de outbox, divergência de saldo, webhooks falhos, throttling e fila de revisão com alerta nominal.

Antes de alterar código, ler o guia vigente do Next.js em `node_modules/next/dist/docs/`, conforme `AGENTS.md`. Cada PR deve partir da homologação, conter testes isolados e migrar apenas o necessário; não habilitar webhook/worker no merge.

### Etapa 5 — Validar isoladamente

Executar em CI/fixtures/PostgreSQL descartável, sem credenciais reais:

- contrato e HMAC inválido, loja errada, payload extra, evento duplicado e eventos fora de ordem;
- timeout antes/depois da criação remota, retry, replay e duas execuções concorrentes;
- variante sem vínculo, ID remoto de outra loja/produto, variante aposentada, `catalogVersion` alterada e produto com opções normalizadas;
- pagamento pendente/aprovado/recusado, expiração, pagamento tardio, cancelamento, refund parcial/integral e devolução física;
- indisponibilidade SMB/Nuvemshop, rate limit, atraso de webhook, reconciliação manual e retomada após reinício;
- prova de que cada cenário causa no máximo uma baixa e uma liberação no ledger local e nos sistemas externos.

Os testes históricos dos módulos de vínculo (96 testes em PostgreSQL descartável + unitários; typecheck/lint) aprovam aquele escopo e não substituem essa matriz.

### Etapa 6 — Ensaio ponta a ponta no ambiente de teste SMB

Fazer uma única venda controlada com item de teste e quantidade/saldo registrados antes. Conferir o pedido nos três sistemas, horário e correlação; no SMB, verificar venda **e histórico de saída**; na Nuvemshop e no banco de teste, verificar saldo e variante. Repetir a notificação/replay sem repetir o efeito. Testar cancelamento em um pedido distinto, respeitando estado financeiro e política de retorno.

**Aceite da integração:** mesma identidade de produto/variante em todos os lados; pedido entra no SMB uma vez; estoque sofre exatamente uma movimentação em cada ledger esperado; o valor final converge; cancelamento/replay não duplica; erros viram alerta e não pedido perdido. Guardar evidência sanitizada e a confirmação do operador SMB. A captura antiga do pedido #100 não fecha este aceite.

### Etapa 7 — Homologar sem ligar consumidores

Publicar a candidata por PR em `homologacao_teste`, CI aprovada e feature flag desligada por padrão. Revisar diffs e migrations, backup/restore da homologação, baseline comparativo e escopo de permissões. Configurar apenas credenciais de teste. Ensaiar fila, webhook, drain, retry e rollback; não reativar automaticamente os consumidores do Asaas, scheduler Cloudflare ou regras de manutenção registradas nas evidências de 23/10.

O preflight e contenção de 23/10 são históricos. Reconsultar o estado efetivo antes de qualquer retomada; ausência de tarefa na tela não comprova ausência de acionadores ou requisições em voo.

### Etapa 8 — Fechar prontidão do produto

Usar [CHECKLIST_PRODUCAO_G1_G8.md](../../../trabalho_em_dupla/CHECKLIST_PRODUCAO_G1_G8.md) e as fichas G2/G3 como gates, sem reclassificar um teste local como aceite remoto. No snapshot consultado, G2 segue aberto e os G1–G8 ainda têm dependências de operação/configuração real. Fechar, com evidências da candidata publicada:

- **G1–G2:** escopo/flags, inventário fresco, obrigações, backup, acesso de recuperação independente, retenção e RPO ≤15 min/RTO ≤60 min medidos; abertura por executor autorizado e comparação antes/depois.
- **G3–G4:** pagamentos, reembolsos, boleto/expiração, dashboards, fidelidade, abertura de produtos/variantes, estoque e carteiras conferidos com baseline correto.
- **G5–G6:** segredos/contas/tenant, rotação pendente, webhooks autenticados, inventário de acionadores, execução durável, alerta entregue e recuperação operacional.
- **G7–G8:** fluxos indispensáveis, frete/entrega, capacidade/custos, revisão cruzada, deploy por digest, migrations, contenção, rollback e responsáveis de atendimento.

As seis PRs abertas de dependabot devem ter decisão individual (merge com CI, atualização posterior ou encerramento documentado) antes de declarar o conjunto de dependências revisado.

### Etapa 9 — Cutover e observação

Só após as etapas anteriores: janela registrada, backup e recuperação verificados, identidade de cada ambiente conferida, escritores/acionadores inventariados, consumidor único definido e kill switch pronto. Ativar gradualmente para o escopo autorizado, observar pedido e estoque até a reconciliação SMB, registrar métricas/alertas e manter procedimento para pausar novas exportações sem desfazer pedidos já confirmados.

Rollback de código não deve apagar vínculos, remover migration aditiva, duplicar pagamento, cancelar venda externamente ou restaurar o banco principal às cegas. Efeitos remotos devem ser reconciliados por pedido/ID e tratados com operação compensatória auditada.

## 5. Evidências já existentes para retomar

- [Aplicação dos vínculos em homologação, 23/10](../../../trabalho_em_dupla/evidencias/L-NUVEMSHOP-APLICACAO-VINCULOS-2026-10-23.json)
- [Preflight da janela, 23/10](../../../trabalho_em_dupla/evidencias/L-NUVEMSHOP-JANELA-PREFLIGHT-2026-10-23.json)
- [Diagnóstico read-only do catálogo HML × loja comercial, 22/10](../../../trabalho_em_dupla/evidencias/L-NUVEMSHOP-DIAGNOSTICO-HOMOLOGACAO-2026-10-22.json)
- [Fluxo ainda em proposta; comportamento do conector pendente](../../../trabalho_em_dupla/evidencias/L-NUVEMSHOP-FLUXO-PROPOSTO-2026-10-22.json)
- [Consulta do pedido 31 / Nuvemshop 100 no projeto antigo](../../../trabalho_em_dupla/evidencias/L-NUVEMSHOP-ORIGEM-PEDIDO31-2026-10-21.json)
- [Comprovante SMB do pedido 100; movimento de estoque pendente](../../../trabalho_em_dupla/evidencias/L-NUVEMSHOP-SMB-PEDIDO100-2026-10-22.json)
- [Gravador de vínculos validado em PostgreSQL descartável](../../../trabalho_em_dupla/evidencias/L-NUVEMSHOP-GRAVACAO-ISOLADA-2026-10-22.json)
- [Checklist geral G1–G8](../../../trabalho_em_dupla/CHECKLIST_PRODUCAO_G1_G8.md)

## 6. Critério final de encerramento SMB

Marcar a integração como concluída apenas quando (1) o contrato SMB/Nuvemshop estiver confirmado; (2) pedidos pagos, estoque, cancelamento e replay tiverem ensaio ponta a ponta sem duplicidade; (3) o movimento constar no histórico do SMB e reconciliar com Nuvemshop e banco; (4) webhook/outbox/alertas/recuperação estiverem ativos e observados na candidata correta; e (5) a integração passar pelos gates de produção, backup e operação do G1–G8. Até lá, o status é **“vínculos do catálogo aplicados em homologação; sincronização SMB pendente”**.
