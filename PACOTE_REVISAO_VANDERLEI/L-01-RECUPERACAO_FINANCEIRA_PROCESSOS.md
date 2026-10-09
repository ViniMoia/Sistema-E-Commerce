# L-01 — Recuperação financeira entre processos

**Data:** 09/10/2026. **Responsável:** Leno (Brega). **Revisor previsto:** Vanderlei (Que dá idéia errada), revisão ainda pendente.

**Estado:** dois blocos locais aprovados; ampliação na seção 6. L-01 e WF-19 continuam em execução, com revisão/integração pendentes. Não há liberação de produção.

## 1. Base e isolamento

- Base local: `e0214e699b71de51696133de19808a1f8dbdc795`.
- Branch de origem: `trabalho/leno/l01-recuperacao-financeira`. Compartilhamento em `homologacao_teste` autorizado por Leno (Brega) em 09/10/2026; identificar o commit pelo roteiro de revisão desta pasta. Revisão do colega permanece pendente.
- O compartilhamento do projeto foi informado por Leno (Brega); isso não comprova os demais aceites de L-00/V-00, acessos, rotação de segredos ou configuração das branches pessoais.
- PostgreSQL 16 descartável via harness existente, 33 migrations, usuário restrito, sentinela e servidor local com identidade conferida. Docker 28.5.1 em Windows.
- Cada executor financeiro usa outro processo Node e outro cliente Prisma. O processo é encerrado à força nos pontos de falha e a retomada usa outro PID.
- Asaas e envio de e-mail são transportes controlados por IPC. O estado desses provedores simulados permanece no processo de teste, fora do executor encerrado. Nenhuma operação no Preview, Neon, Asaas ou Resend foi feita nesta rodada; o pedido #1 foi preservado.
- O loader dos executores não carrega arquivos de ambiente e bloqueia `fetch`. O harness fornece as conexões descartáveis às ferramentas; a CLI Prisma pode anunciar leitura de `.env`, mas os destinos de teste são sobrescritos e verificados pela proteção de isolamento.

## 2. Falha reproduzida e correção

Um webhook pode confirmar a cobrança enquanto o checkout ainda espera sua resposta de criação. O teste novo aplicou `RECEIVED` e confirmou o pedido; depois liberou a resposta antiga `PENDING`. Antes da correção, `executePaymentAttempt` sobrescrevia `Order.asaasPaymentStatus` com `PENDING`, embora o pedido continuasse Pago e a tentativa estivesse aprovada.

Em `services/payment/checkout-payment.service.ts`, a atualização complementar deixou de escrever esse status. `applyPaymentEvidence`, que já aplica as regras de progressão financeira, continua responsável por ele. URLs e demais artefatos continuam sendo persistidos. Nenhuma migration ou alteração de contrato público foi necessária.

A regressão falhou antes da correção e passou depois: pedido Pago, tentativa APPROVED e status Asaas RECEIVED, sem nova emissão ou duplicação de efeitos.

## 3. Cenários novos — 12 casos

| Casos | Ponto de interrupção/disputa | Resultado verificado |
|---|---|---|
| 3 | Checkout antes da criação remota, após aceitação remota e após conclusão local | Mesmo intent não emite novamente; consulta recupera cobrança/instruções existentes. Sem cobrança encontrada, mantém UNKNOWN/reserva e não presume falha definitiva. |
| 4 | Inbox e reconciliação, cada uma antes e depois do commit financeiro | Antes do commit, rollback dos efeitos; depois, preservação. Outro processo retoma e produz uma aprovação, fatos, histórico, crédito de pontos e comando de confirmação. |
| 1 | Webhook concluído antes de retornar a criação do checkout | Resposta antiga não regride RECEIVED para PENDING. |
| 2 | Executor antigo de inbox/reconciliação volta após lease vencida e tomada por sucessor | Resultado antigo é recusado; conclusão do sucessor e estado financeiro permanecem. |
| 1 | Segundo consumidor tenta obter lease ainda válida | Não captura o trabalho já em execução nem duplica aprovação. |
| 1 | Provedor aceita e-mail; executor morre antes de confirmar a outbox | Retomada mantém chave idempotente e conteúdo congelado; duas tentativas de transporte representam uma aceitação no provedor simulado. |

As verificações incluem pedido/tentativa únicos, estoque de produto e variante, reserva, fatos financeiros, histórico, ganho de pontos e identidade da confirmação. A expiração da lease é antecipada somente nas fixtures descartáveis: a morte é real, mas não se espera todo o prazo operacional da lease.

A suíte anterior, repetida junto desta, cobre também conflitos de evento/identidade/valor, mudança de conta, consultas inconclusivas, cancelamento/estorno/expiração controlados e janela de idempotência da outbox. Esses casos não passam automaticamente a ser ensaios de morte real ou contratos aprovados no Sandbox.

## 4. Reprodução e resultados

Na raiz da branch, com dependências instaladas e Docker disponível:

```powershell
npm run test:isolation:negative
npm run test:integration:isolated -- tests/integration/payment-process-recovery.test.ts tests/integration/payment-durable-execution.test.ts
node node_modules/typescript/bin/tsc --noEmit --incremental false
node node_modules/eslint/bin/eslint.js tests/helpers/payment-process-entry.mjs tests/helpers/payment-process-worker.ts tests/integration/payment-process-recovery.test.ts services/payment/checkout-payment.service.ts
```

Resultados desta rodada:

- Proteção negativa: **2 testes aprovados**, sentinela ausente/incorreta recusada.
- Execução conjunta final: **52 testes aprovados em 2 arquivos** — 12 novos + 40 existentes; duração Vitest **78,18 s**, sem incluir provisionamento.
- TypeScript e ESLint direcionado: aprovados.
- Harness encerrou recursos; consulta Docker por label não encontrou containers próprios remanescentes.

Não somar as repetições de diagnóstico como cobertura adicional. Não foi executado novo build de release, bateria completa de navegador, pacote standalone, carga ou ensaio Linux nesta rodada.

## 5. Integração da dupla e próximo trabalho

**Leno (Brega):** revisar e versionar esta entrega com evidências; consolidar a matriz de pontos de falha e seus limites com L-04. A transação inicial e as operações de cancelamento/estorno receberam cenários adicionais na seção 6. Não extrapolar para cancelamento/estorno real, métodos parcelados, devolução física ou infraestrutura final. Manter L-00 aberto nos itens de acesso/Preview que não foram conferidos.

**Vanderlei (Que dá idéia errada):** revisar a regressão e os limites; integrar a execução da nova suíte ao fluxo de CI apropriado, respeitando que seus filhos carregam serviços TypeScript via Vite. O catálogo genérico de suítes de produção não foi alterado por Leno (Brega); executar em pacote otimizado exige desenho explícito e não é comprovado por este teste. V-01 e demais tarefas independentes podem continuar.

Depois da revisão, integrar à branch compartilhada em janela combinada. Só então definir ensaio externo dirigido que ainda agregue evidência. Esta execução não prova entrega real de e-mail, idempotência do Asaas/Resend, funcionamento contínuo do consumidor ou comportamento da infraestrutura Google Cloud. Esses gates continuam vinculados a L-04/L-07/L-08 e V-06/V-07/V-08; o deploy final permanece com Vanderlei (Que dá idéia errada).

## 6. Segundo bloco — transação inicial e reversões — 09/10/2026

**Responsável: Leno (Brega). Revisor previsto: Vanderlei (Que dá idéia errada), pendente.** Mesma branch/base da seção 1. Foram acrescentados nove casos à suíte entre processos, que passa a conter 21 casos. Nenhuma nova alteração de código de produção foi necessária neste bloco; a correção da seção 2 permanece na entrega local.

| Casos novos | Interrupção | Invariante/recuperação |
|---|---|---|
| 1 | Transação inicial, após as gravações de pedido/estoque/carrinho/intenção/outbox e antes do commit | Encerrar o processo reverte as gravações; carrinho e intenção permanecem iguais ao estado anterior, estoque fica intacto, pedido/auditoria/outbox da compra não aparecem e não houve chamada de criação. Repetir a mesma intenção em outro processo cria uma única compra/cobrança. |
| 2 | CANCEL e REFUND, após marcador durável SUBMITTING e antes do transporte | A retomada consulta, mas não reenvia a operação nem restitui estoque sem prova. Ao vencer o prazo, gera revisão PAYMENT_REVERSAL_OVERDUE. Uma solicitação administrativa de conciliação não restaura permissão para enviar novamente. |
| 2 | CANCEL e REFUND, após aceitação no provedor controlado, antes de persistir a resposta | Outra instância consulta o resultado existente, conclui a operação e aplica efeitos sem repetir o cancelamento/estorno remoto. |
| 2 | CANCEL e REFUND, após os efeitos locais dentro da transação, antes do commit | A queda reverte os efeitos locais; a evidência externa permanece no provedor controlado e permite reaplicação única em outro processo. |
| 2 | CANCEL e REFUND, após conclusão local | Retomada e repetição do comando preservam identidade, fatos e efeitos, sem nova chamada remota. |

No estorno integral da fixture ainda não expedida, a reserva fica RETURNED; no cancelamento sem pagamento, RELEASED. Ambos devolvem exatamente uma unidade ao produto e à variante. A fixture de estorno verifica um ganho e uma compensação de pontos, soma líquida zero, carteira sem saldo/pendência/dívida e ledger inalterado no replay. A identidade da cobrança e o valor integral do estorno são conferidos pelo transporte controlado.

**Distinção operacional:** a interrupção entre o marcador SUBMITTING e o envio é propositalmente inconclusiva para o sucessor. Neste ensaio sabemos que o transporte não foi chamado; o processo retomado não dispõe dessa certeza. A expectativa é manter a operação para consulta/revisão, sem liberar estoque, cancelar um pedido Pago ou repetir uma requisição destrutiva automaticamente. A revisão precisa de tratamento operacional em L-04/L-07; o teste não inventa autorização para resolver essa incerteza.

**Validação final:** **61 testes aprovados em 2 arquivos**, sendo 21 entre processos (12 anteriores + nove desta ampliação) e 40 regressões duráveis; Vitest **130,33 s**, testes **127,99 s**, sem incluir provisionamento. TypeScript e ESLint direcionado aprovados. Os comandos da seção 4 continuam válidos. As provas negativas anteriores não foram repetidas, pois o isolamento/harness não mudou. Não somar 52 + 61: a segunda execução inclui a cobertura anterior. A rodada preliminar de 21 casos também não representa cobertura adicional.

**Limites preservados:** morte de processos real em Windows e PostgreSQL real descartável; Asaas/Resend substituídos por IPC. O prazo de revisão e as leases são antecipados somente na fixture. Não houve envio de e-mail, cancelamento ou estorno de uma cobrança externa, mudança de flags, migration em banco persistente, publicação ou deploy.
