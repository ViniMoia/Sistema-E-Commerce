# Revisão da entrega L-01/L-04 de Leno (Brega)

## Continuidade atual — entrega de homologação em 13/10/2026

**Começar por esta seção.** Os checkpoints abaixo dela preservam o histórico de 09/10; afirmações antigas de "ainda local" não descrevem o pacote atual quando este commit estiver em `origin/homologacao_teste`. Publicar nesta branch foi autorizado pelo usuário em 13/10. Publicação do código não equivale a ativação de variáveis, Preview Ready ou liberação comercial.

### Obter e identificar a versão

Em clone próprio sem alterações pendentes (preservar trabalho local antes de atualizar):

```powershell
git fetch origin
git switch homologacao_teste
git pull --ff-only origin homologacao_teste
git rev-parse HEAD
npm ci
```

Se a branch local ainda não existir, usar `git switch --track origin/homologacao_teste`. Havendo divergência, revisar/integrar sem reset destrutivo. Registrar o SHA de HEAD no parecer e confrontá-lo com o deployment usado nos ensaios. Dependências e lockfile seguem no repositório; Node 22 é a referência da CI. Docker com containers Linux é necessário para os wrappers de build/testes isolados.

### Conteúdo e ordem de leitura

1. [Replanejamento de produção](../diversos/CORRECOES/Correcoes_logicas/Correcao_logica_1/trabalho_em_dupla/Replanejamento/REPLANEJAMENTO_PRODUCAO_48H.md): documento condutor atual, gates, divisão de responsabilidades, seção 14 (ambiente financeiro explícito) e seção 15 (juros e frete). O prazo original de 10–12/10 não é reiniciado por esta publicação.
2. Correção local incluída: `lib/config/asaas-environment.mjs`, `scripts/lib/production-environment-policy.mjs` e respectivos testes. Permite Sandbox em runtime otimizado fora da Vercel mediante declaração explícita, bloqueando configuração inválida/conflitante. Sem migrations novas neste pacote.
3. [Modelo de ambiente](../.env.example): nomes de variáveis e exemplos ilustrativos, incluindo a nova declaração. Segredos reais, `.env` privados, banco, backups, `node_modules` e artefatos `.next` não são distribuídos nesta entrega; configurar por canal privado/gestor de segredos do ambiente.
4. [Roteiro PIX #3, seções 32–36](L-04-ROTEIRO_ESTORNO_INTEGRAL_PIX_SANDBOX.md#32-preview-publicado-e-supervisão-anterior-à-retomada-recebida): evidência mais recente do caso cancelado no provedor. O script `L-04-RETOMAR_CONCILIACAO_ESTORNO_PEDIDO_3.js` acompanha o registro para rastreabilidade; **já foi executado, não é etapa de instalação nem deve ser repetido**.
5. [Guia geral de continuidade](../diversos/HOMOLOGACAO/Relatorio_1/RELATORIO_GERAL_HOMOLOGACAO_E_GUIA_DE_CONTINUIDADE.md), especialmente ferramentas/infra, e [plano em dupla](../diversos/CORRECOES/Correcoes_logicas/Correcao_logica_1/trabalho_em_dupla/PLANO_DE_EXECUCAO_EM_DUPLA_PARA_PRODUCAO.md), usando as decisões posteriores do replanejamento quando o escopo diferir.

### Configuração que Vanderlei precisa conferir

| Frente | Contrato de continuidade |
|---|---|
| Preview atual | Branch `homologacao_teste`, conta `sandbox-hml`, banco/branch de homologação. Conferir o SHA efetivamente publicado antes dos ensaios. |
| Google Cloud de homologação | `NODE_ENV=production`, `PAYMENT_DEPLOYMENT_ENVIRONMENT=SANDBOX`, URL/chave Sandbox, escopo da mesma conta e banco de homologação identificado. Não forjar `VERCEL`/`VERCEL_ENV`. |
| Produção futura | Declaração `PRODUCTION`, conta/escopo reais e banco separado. Credenciais/URLs precisam corresponder; o nome do escopo não comprova conta/ambiente. Configuração de produção não é aplicada por este push. |
| Cartão até 12x | Política decidida: `INSTALLMENT_MAX_COUNT=12`, `INSTALLMENT_ABSORB_FEES=false`, `INSTALLMENT_MIN_VALUE=20`, `INSTALLMENT_MONTHLY_RATE=0.0299`. Ensaio requer `ASAAS_INSTALLMENTS_APPROVED=true`, `enableCreditCard` da loja, configuração Asaas válida, allowlist da loja e pagamento remoto habilitado. O exemplo mantém flags desligadas; ativação é separada e específica do ambiente. |
| Frete | Correios PAC/SEDEX, J&T por tabela restrita à origem 67140-615 e entrega local por município. Conferir tarifas/revisões no banco, origem, pesos/medidas reais, configuração da loja e segredo de assinatura comum às instâncias. Validar consulta real dos Correios: o provider usa `CalcPrecoPrazo.aspx`, não CWS/Mini Envios. |
| Dados | Usuário confirmou somente testes. Preparar banco de produção separado e carga aprovada de catálogo/configuração/tarifas/estoque; preservar Sandbox, sem importar saldos e vendas fictícios nem limpar a base atual por este roteiro. |
| Infra/operação | Conferir proxy/tenant/domínio/cookies, storage, domínio/remetente Resend, webhook autenticado, executor autenticado recorrente e alertas. Migração é etapa controlada, não automática no build de cada instância. |

O preflight `node scripts/check-production-environment.mjs` é somente de leitura, sem chamadas externas, mas carrega configuração privada pelo loader do Next. Vanderlei deve executá-lo no ambiente escolhido e compartilhar apenas o resultado sanitizado; `configurationPassed=true` não significa `productionReady=true`. Segredos de painel/gestor são valores literais; o escape de dólar descrito em `.env.example` é específico do arquivo dotenv processado pelo Next.

### Validação reproduzível e limites

```powershell
node node_modules/vitest/vitest.mjs run tests/unit/asaas-environment.test.ts tests/unit/production-environment-policy.test.ts tests/unit/asaas-adapter.test.ts tests/unit/asaas-credit-card.test.ts tests/unit/asaas-boleto.test.ts tests/unit/refund-history.test.ts
node node_modules/typescript/bin/tsc --noEmit --incremental false
node node_modules/eslint/bin/eslint.js lib/config/asaas-environment.mjs scripts/lib/production-environment-policy.mjs tests/unit/asaas-environment.test.ts tests/unit/production-environment-policy.test.ts
npm run build:isolated
```

Os wrappers provisionam banco descartável e copiam fontes sem `.env` para o build. Não substituir por integração/carga apontando para Neon compartilhado. A CI atual só dispara para main/master/develop; push em homologacao_teste não comprova execução dessa CI. O deploy Vercel, quando disparado, tem resultado separado.

**Resultados locais de 13/10/2026:** 64 testes em seis arquivos aprovados; TypeScript sem emissão e lint dos quatro arquivos de código/testes aprovados; sintaxe do script histórico de retomada aprovada. `npm run build:isolated` concluiu compilação, TypeScript e geração das 55 páginas em Next 16.3.5, com PostgreSQL 18 descartável e integrações sem credenciais. O banco/container e a cópia temporária foram descartados pelo wrapper, preservando `.next` e `next-env.d.ts` do workspace. Aviso do Vite sobre futura mudança de configLoader não impediu os testes. Sem nova execução financeira externa, teste de parcelamento remoto ou pacote standalone Linux nesta rodada.

### Próxima atuação e impedimentos ainda abertos

- Vanderlei: revisar a alteração de ambiente, conferir o candidato/configuração, preparar infraestrutura/executor e validar entrega/segurança. Devolver SHA, achados e evidências, sem credenciais.
- Leno: executar ensaios coordenados de PIX/cartão à vista/parcelado e devolução, pontos e integridade dos dados, após configuração conferida. Total comercial de pelo menos R$ 240 permite ensaiar 12x com piso R$ 20; usar instrumentos de teste no Sandbox.
- Pedido #3 permanece como caso de revisão: estorno remoto CANCELLED, operação PENDING com `PAYMENT_REFUND_CANCELLED_REVIEW`, outbox PAYMENT_REVIEW em DEAD_LETTER. Na última evidência, pedido PAID, carteira 137/0/636 e estoque 7/3/4 preservados. Esses números são históricos, não leitura feita em 13/10. Não rearmar REFUND, apagar revisão ou repetir scripts financeiros como parte da atualização.
- Continuam pendentes devolução efetivamente concluída, cartão parcelado externo, frete no candidato, preparação/restore do banco alvo, execução automática e parecer independente. Publicação não aprova G1–G8.

---

**Autor: Leno (Brega). Revisor: Vanderlei (Que dá idéia errada). Data: 09/10/2026.** Revisão ainda não realizada. Este arquivo prepara a entrega; não foi enviado por ferramenta ao outro desenvolvedor.

## O que revisar

Base de desenvolvimento `e0214e699b71de51696133de19808a1f8dbdc795`, branch de origem `trabalho/leno/l01-recuperacao-financeira`. **Destino de compartilhamento autorizado por Leno (Brega) em 09/10/2026: `homologacao_teste`.** A publicação permite revisar o código; o parecer de Vanderlei (Que dá idéia errada) e os gates de produção continuam pendentes. A mesma entrega contém:

No clone atualizado da branch `homologacao_teste`, identificar o commit do pacote com `git log -1 --format=%H -- PACOTE_REVISAO_VANDERLEI` e registrar esse SHA no parecer. Preservar alterações próprias ao atualizar o clone/worktree. O pacote original reúne três documentos de revisão; complementos posteriores de roteiro, scripts e evidências estão descritos abaixo, com publicação a conferir. O código e os testes da aplicação citados permanecem nos diretórios do projeto.

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

## Preparação do próximo ensaio

Código publicado em `homologacao_teste` no commit `ede9cc2868c844393d9fab76a00fd3d6db9afdc5`. A preparação posterior acrescenta o [roteiro de cancelamento PIX em pedido novo](L-04-ROTEIRO_CANCELAMENTO_PIX_SANDBOX.md) aos três documentos originais. O roteiro está preparado localmente; sua criação não comprova publicação, parecer independente, Preview Ready ou execução externa. O primeiro passo é conferir o deployment e realizar somente a leitura de status com `-StatusOnly`; L-04 permanece aberto.

**Atualização de 09/10/2026:** Leno (Brega) confirmou Preview Ready `ede9cc2`, enviou supervisão sandbox-hml sem pendências e referências de estoque/pontos. Posteriormente solicitou iniciar somente o ensaio de cancelamento PIX em pedido novo no Sandbox antes do parecer do colega. A decisão está registrada no plano e no roteiro; não equivale a revisão aprovada ou liberação de produção. Vanderlei (Que dá idéia errada) continua responsável pelo parecer independente desta entrega.

**Progresso posterior do pedido #2, 09/10/2026:** exclusão da cobrança comprovada por GET específico do Sandbox; CANCEL COMPLETED; pedido Cancelado e estoque/pontos conferidos. Replay controlado devolveu a mesma operação e manteve versão/histórico. Supervisão antes/depois preservou inbox 2 COMPLETED, outbox 5 COMPLETED e CANCEL 1 COMPLETED, sem pendências; operador confirmou estoque/pontos/e-mail inalterados após replay. Consultar o roteiro para as identidades e limites da evidência.

Próxima conferência preparada no [guia de auditoria interna](L-04-GUIA_AUDITORIA_CANCELAMENTO_PEDIDO_2.md), com [SQL somente de leitura](L-04-AUDITAR_CANCELAMENTO_PEDIDO_2.sql). SQL validado em PostgreSQL 17 local temporário, com dados sintéticos, sem acesso ao Neon. Leitura real dos registros internos e parecer independente continuam pendentes. Esses complementos locais ainda não têm publicação demonstrada; L-04 e gates de produção permanecem abertos.

**Leitura real recebida posteriormente, 09/10/2026:** reserva RELEASED e vínculos corretos; fato CANCELLED único de 49,90; um histórico e uma restituição auditada; estoque/pontos preservados e nenhuma confirmação de pagamento na outbox do #2. [Resultado consolidado do cancelamento e replay](L-04-RESULTADO_CANCELAMENTO_PIX_PEDIDO_2.md): cenário aprovado no Sandbox, com limites explícitos. Vanderlei (Que dá idéia errada) ainda fornece o parecer independente da entrega; L-04 e gates de produção permanecem abertos. Próxima preparação é o estorno integral de um PIX novo pago, antes da expedição, com revisão/janela coordenadas. Complementos atuais ainda locais até publicação posterior demonstrada.

**Preparação seguinte, 09/10/2026:** [roteiro de estorno integral PIX](L-04-ROTEIRO_ESTORNO_INTEGRAL_PIX_SANDBOX.md) disponível localmente para revisão. Leno (Brega) confirmou que o parecer ainda não foi enviado. Próxima ação orientada é somente reconferência do Preview/filas/referências; compra, simulação de recebimento e REFUND ainda não demonstrados. Conferir em especial a distinção RETURNED/RELEASED, a compensação de ganho e a preservação do pagamento histórico e do seu e-mail legítimo.

**Atualização posterior do #3, 09/10/2026:** operador autorizou este cenário antes do parecer. Pagamento e e-mail da loja confirmados; comando original de REFUND aceito. SQL dirigido mostrou operação PENDING já submetida e tentativa REFUND_PENDING com próxima consulta em 24 horas, após o prazo de revisão. [Registro completo e limites](L-04-ROTEIRO_ESTORNO_INTEGRAL_PIX_SANDBOX.md#24-diagnóstico-real-submissão-existente-e-prazo-de-conciliação-inadequado). Patch local adicional em `services/payment/payment-evidence.service.ts` agenda conciliação de reversões pendentes em um minuto; três regressões adicionadas em `tests/integration/payment-durable-execution.test.ts`, incluindo resposta perdida e não repetição de POST. Esse patch ainda não integra o commit publicado ede9cc2 e deve compor a revisão futura. Não migra dados nem altera o prazo já persistido; GET remoto preparado antes de qualquer retomada auditada. Não afirmar estorno concluído ou compensações aplicadas neste checkpoint.

Validação desse patch adicional: **93 testes aprovados em quatro suítes financeiras**, TypeScript e lint aprovados. [Execução isolada e reprodução do defeito](L-04-CICLO_FINANCEIRO_LOCAL_E_ENSAIOS_EXTERNOS.md#7-regressão-observada-no-estorno-assíncrono-do-pedido-3). Script de prova remota validado com dez mocks; resultado remoto real ainda pendente. Nenhuma publicação adicional demonstrada.

**Leitura remota posterior:** GET real do #3 retornou HTTP 200, identidade correta, RECEIVED e deleted=false; estorno não comprovado. A saída inicial não mostrava refunds. Script ampliado para expor somente status/valores dos registros, com 17 mocks aprovados; resultado desses campos ainda a receber. [Checkpoint e limites da prova](L-04-ROTEIRO_ESTORNO_INTEGRAL_PIX_SANDBOX.md#25-get-remoto-recebido-cobrança-ainda-received-consultar-refunds). O patch de agendamento não força conclusão remota nem autoriza novo REFUND.

**Detalhe remoto recebido em seguida:** um refund de 49,90 em AWAITING_CRITICAL_ACTION_AUTHORIZATION. A solicitação existente aguarda autorização na conta Asaas Sandbox; não equivale a DONE. Diagnóstico reconhece agora esse estado, com total de autorização separado e 19 mocks aprovados. [Evidência e orientação para autorizar a solicitação existente](L-04-ROTEIRO_ESTORNO_INTEGRAL_PIX_SANDBOX.md#26-registro-remoto-aguarda-autorização-de-ação-crítica). Tratar o fluxo de autorização como requisito de operação financeira na revisão; não embutir token Sandbox em código de produção nem aprovar automaticamente ações críticas. Nenhum estorno concluído/compensação demonstrado ou nova publicação neste checkpoint.

**Após autorização informada pelo operador:** GET manteve RECEIVED e não retornou o campo refunds; nenhuma conclusão financeira inferida. [Checkpoint e leitura preparada do histórico específico](L-04-ROTEIRO_ESTORNO_INTEGRAL_PIX_SANDBOX.md#27-autorização-informada-e-consulta-sem-refunds-histórico-específico). Script suporta -RefundHistory com até dois GETs e guarda de identidade; 19 mocks do modo original e 16 do histórico aprovados. Resultado real do histórico pendente, sem novo REFUND ou publicação adicional.

**Histórico real recebido em seguida:** HTTP 200, identidade correta e lista completa (hasMore=false) com exatamente um estorno de 49,90 **CANCELLED**; total DONE=0 e cobrança ainda RECEIVED. [Resultado e limites](L-04-ROTEIRO_ESTORNO_INTEGRAL_PIX_SANDBOX.md#28-histórico-remoto-solicitação-de-estorno-cancelada-no-provedor). Motivo e momento do cancelamento não constam da evidência. A última leitura interna PENDING antecede esse resultado; não tratá-la como consulta atual. Próxima etapa é obter o motivo no provedor e correlacionar o estado interno antes de definir recuperação. Nenhum novo REFUND, compensação, reset ou publicação autorizado por esse resultado. Estorno #3 e L-04 continuam abertos.

**Reconferência interna às 20:27:40 UTC de 09/10/2026:** operação segue PENDING, tentativa REFUND_PENDING v5, pedido PAID v1 e carteira 137/0/636; nenhuma reversão financeira/pontos demonstrada. Prazo de conciliação continua no dia seguinte, sem lease ativo. [Evidências e lacuna técnica confirmada](L-04-ROTEIRO_ESTORNO_INTEGRAL_PIX_SANDBOX.md#29-nova-leitura-interna-confirma-divergência-após-cancelamento-remoto): o adapter não incorpora histórico de estornos e a conciliação não distingue refund remoto CANCELLED de pendência enquanto a cobrança permanece RECEIVED. Patch local de agendamento não resolve essa classificação. Correção adicional e seus testes permanecem pendentes; não confundir os 93 testes anteriores com cobertura deste caso. Preservar operação original, sem reenvio, compensações ou reset manual. Motivo do cancelamento no provedor ainda desconhecido; cenário não aprovado.

**Primeira etapa implementada posteriormente, por solicitação de Leno:** histórico remoto incorporado para operações REFUND; cancelamento, autorização pendente e dados inconclusivos geram revisão auditada, conservando o estado original da operação e os efeitos pagos. Envio exige READY sem erro; revisão não rearma operação. Conclusão posterior exige prova integral e preserva compensações únicas. Sem migration. [Implementação e validação local](L-04-CICLO_FINANCEIRO_LOCAL_E_ENSAIOS_EXTERNOS.md#8-tratamento-local-de-histórico-de-estorno-cancelado-ou-inconclusivo): 102 testes de integração e 55 unitários aprovados. Esses testes ampliam a cobertura anterior de agendamento; código ainda não publicado no Preview. Conferir especialmente correlação conservadora do histórico, ambiguidade, preservação de pontos/estoque e resumo de revisão após envio. Não houve nova tentativa remota; motivo do cancelamento e encerramento real do #3 seguem pendentes.

**Próxima etapa autorizada:** candidato preparado para publicação em homologacao_teste, com build de produção isolado aprovado e 157 testes distintos da validação local. Identificar o novo SHA por `git log -1 --format=%H -- services/payment/refund-history.ts`; exigir resultado Vercel correspondente antes da retomada. [Sequência de conferência operacional](L-04-ROTEIRO_ESTORNO_INTEGRAL_PIX_SANDBOX.md#31-publicação-de-homologação-e-conferência-anterior-à-retomada). Parecer independente e gates de produção preservados; esta publicação não prova devolução do #3.
