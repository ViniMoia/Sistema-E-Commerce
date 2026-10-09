# Revisão da entrega L-01/L-04 de Leno (Brega)

**Autor: Leno (Brega). Revisor: Vanderlei (Que dá idéia errada). Data: 09/10/2026.** Revisão ainda não realizada. Este arquivo prepara a entrega; não foi enviado por ferramenta ao outro desenvolvedor.

## O que revisar

Base de desenvolvimento `e0214e699b71de51696133de19808a1f8dbdc795`, branch de origem `trabalho/leno/l01-recuperacao-financeira`. **Destino de compartilhamento autorizado por Leno (Brega) em 09/10/2026: `homologacao_teste`.** A publicação permite revisar o código; o parecer de Vanderlei (Que dá idéia errada) e os gates de produção continuam pendentes. A mesma entrega contém:

No clone atualizado da branch `homologacao_teste`, identificar o commit do pacote com `git log -1 --format=%H -- PACOTE_REVISAO_VANDERLEI` e registrar esse SHA no parecer. Preservar alterações próprias ao atualizar o clone/worktree. A pasta reúne somente os três documentos de revisão; o código e os testes citados permanecem nos diretórios do projeto.

1. `services/payment/checkout-payment.service.ts`: preservar a projeção financeira já aplicada quando chega uma resposta antiga do checkout; usar a política existente de transação de evidência.
2. `services/order-timeout.service.ts`: usar a mesma política ao aplicar evidência/expiração, mantendo consulta externa fora da transação.
3. `tests/integration/payment-process-recovery.test.ts` e helpers `payment-process-entry.mjs`/`payment-process-worker.ts`: 21 cenários com processos separados, banco descartável e transporte IPC; helpers apenas em testes, sem rota de produção.
4. `tests/integration/payment-lifecycle-homologation.test.ts`: oito cenários de prazos/métodos e aplicação financeira com banco lento.
5. Evidências e complementos do plano/workflow/registro/matriz. Eles preservam os gates externos e de produção abertos.

## Como conferir

**Validação local final:** 90 testes em quatro suítes aprovados, TypeScript e lint direcionado aprovados. Nenhum build de release ou teste externo adicional foi executado. A revisão do colega permanece pendente.

Ler [L-01](L-01-RECUPERACAO_FINANCEIRA_PROCESSOS.md) e [L-04](L-04-CICLO_FINANCEIRO_LOCAL_E_ENSAIOS_EXTERNOS.md), executar os comandos da seção de reprodução de L-04 em clone/worktree e Docker próprios e conferir:

- A única emissão/conclusão é protegida por estado persistido, locks, leases e identidade dos efeitos.
- Falha antes do commit reverte o conjunto; resposta perdida não concede autorização para reemitir/cancelar/estornar novamente.
- Prazo inconclusivo produz revisão; intervenção administrativa não restaura permissão de submissão.
- Aprovação anterior não regride por resposta antiga; estoque, pontos, fatos e confirmação permanecem únicos.
- Nenhuma chamada Asaas/Resend ocorre dentro da transação; o limite maior é local às transações pertinentes.
- Testes não dependem de `.env` privado, dados do pedido #1 ou banco compartilhado. Provedores IPC não certificam o contrato externo.

**Vanderlei (Que dá idéia errada):** indicar comentários/aceite vinculados ao commit identificado acima. O catálogo genérico de CI não foi alterado por Leno (Brega); considerar inclusão explícita das novas suítes no job de integração, sem declarar que executores TypeScript via Vite testam o pacote standalone final.

**Leno (Brega):** corrigir comentários, registrar commit integrado e reservar janela financeira antes dos ensaios externos. Esta revisão não transfere acesso financeiro, altera variáveis de Preview ou autoriza rollout de produção.
