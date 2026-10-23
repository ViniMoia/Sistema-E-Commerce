# Atribuições de Vanderlei — etapa 2

**Data:** 23/10/2026 · **Revisão:** 2.1, após auditoria das entregas publicadas · **Fuso:** Brasília (America/Sao_Paulo) · **Ambiente:** homologação.

**Objetivo:** preparar a operação dos consumidores financeiros no GCP e o próximo ensaio de compra no Asaas Sandbox, enquanto Vinícius e seu agente revisam a reserva do pedido nº 8 e a integração SMB Store → Nuvemshop → Plataforma Continental.

Este guia atualiza as prioridades do [guia 1.0](../1.0/ATRIBUICOES_VANDERLEI_PREPARACAO_PRODUCAO_2026-10-22.md). A preparação, as consultas administrativas e os testes em banco descartável podem começar agora. A execução de Jobs financeiros, a ativação de agendas e novos testes que alterem pedidos, cobranças ou estoque compartilhados ficam para uma etapa coordenada com Vinícius, com cenário e versão identificados.

## 1. Estado de partida

Referências consultadas para esta publicação:

- `origin/homologacao_teste`: `9500bbbd8a77550ea4abd6f4cddedb000c2f490e`; entregas operacionais mais recentes em `a12a471ca6e6ce4f33d2eaab046142a307c39351`.
- `origin/main`: `7f9b26e062ec2654420fecffb6dd78ad3ba1e017`, somente leitura. O guia histórico de configuração Asaas foi consultado; ele não comprova a configuração efetiva dos consumidores atuais.
- [Retomada GCP de 23/10](../../../RETOMADA_GCP_JANELA_2026-10-23.md) e [evidência correspondente](../../V-RETOMADA-GCP-2026-10-23.json), publicados na revisão de homologação acima.
- [Devolutiva de preparação de 22/10](../../../DEVOLUTIVA_VANDERLEI_PREPARACAO_PRODUCAO_2026-10-22.md), [inventário e verificações](../../V-PREPARACAO-PRODUCAO-2026-10-22.json), [propostas G6](../../V-PROPOSTAS-G6-2026-10-22.json), [provisionamento de 21/10](../../../EXECUCAO_OPERACIONAL_VANDERLEI_2026-10-21.md) e [checklist G1–G8](../../../CHECKLIST_PRODUCAO_G1_G8.md).

Esta revisão compara o código e as evidências versionadas do GitHub, obtidos por `git fetch`. Não é uma nova inspeção administrativa do GCP. “Pendente” abaixo significa sem conclusão comprovada nas fontes consultadas; se houver evidência posterior ainda não publicada, incorporá-la antes de repetir trabalho. As seções históricas dos checklists não prevalecem sobre as entregas datadas mais recentes.

| Frente | Último estado conhecido | Implicação para esta etapa |
| --- | --- | --- |
| GCP | Retomada consolidada por Vanderlei às 14h40 de 23/10; acesso e controles anteriores restaurados; 42 sondas aprovadas; nenhum Job executado. Checkout e capacidades financeiras permaneciam desligados. | Reaproveitar as evidências e reconferir o estado atual. Não repetir a manutenção ou promover outra revisão por rotina. |
| Vercel | Vinícius desativou a manutenção, fez redeploy e desativou a regra temporária de bloqueio de Preview. A loja respondeu HTTP 200. | Acessibilidade não comprova funcionamento financeiro completo. |
| Asaas Sandbox | Webhook ativo e fila retomada, conferidos por API. Logs apresentados por Vinícius mostram respostas 200 em 16 e 17/10. | Os logs históricos não comprovam uma nova compra após a retomada. |
| Cloudflare | Última inspeção disponível: consumidor desativado e sem agendamentos. Não foi reativado nesta retomada. | Reconferência administrativa pertence a Vinícius; não presumir exclusividade global apenas pelo inventário GCP. |
| Vínculos Nuvemshop | 517 variantes vinculadas e verificadas na homologação; IDs, estoque e pedidos preservados. | Não reaplicar o lote. Vínculos não comprovam exportação de pedidos ou baixa na SMB. |
| Pedido nº 8 | Evento `PAYMENT_OVERDUE` processado isoladamente às 16h46 de 23/10: inbox `COMPLETED`, cobrança `OVERDUE`, pedido `PENDING`; uma unidade continua reservada, sem prazo registrado. | Não reenviar o evento, cancelar a cobrança ou liberar a reserva. A revisão dessa reserva está com Vinícius. |
| Pedido nº 3 | Revisão de estorno cancelado preservada: `PAYMENT_REFUND_CANCELLED_REVIEW`. | Não rearmar estorno nem usar esse pedido como teste de recuperação. |

As informações de Vercel, Asaas, vínculos e processamento do nº 8 acima resumem as verificações da frente de Vinícius; não são uma inspeção independente de Vanderlei. Os arquivos locais `L-PROCESSAMENTO-EVENTO-PEDIDO8-2026-10-23.json` e `L-EXECUTOR-EVENTO-FINANCEIRO-ISOLADO-2026-10-23.json` não acompanham esta publicação. Usar este resumo para coordenação e aguardar sua disponibilização para revisão detalhada.

## 2. Trabalho concluído — reaproveitar, não refazer

| Entrega de Vanderlei | Evidência / alcance | O que ainda não está comprovado |
| --- | --- | --- |
| Publicação da candidata `9495ff9`, CI, digest e 35 migrations | Conferidas em 21/10 e reconferidas em 22/10; web/Jobs com digest correspondente. | Não inclui o novo executor por evento que permanece local com Vinícius. |
| Inventário acessível GCP/HML/Asaas e diagnóstico de permissões | Devolutiva e JSON de 22/10; IAM, banco, flags, acionadores, backlog e restrições de acesso registrados. | Diagnóstico não é correção de permissões nem prova de exclusividade fora do GCP. |
| Plano de transferência, interrupção e retomada | Sequência, responsáveis, condições de avanço e retorno já preparados em 22/10. | Execução financeira coordenada e entrega automática com efeitos conferidos. |
| Jobs, conta consumer e monitoramento de supervisão | Provisionados; canal, métrica e duas políticas existentes. | Alertas estavam desativados; recebimento humano e monitoramento próprio de pagamentos não foram comprovados. |
| Propostas de alertas de pagamentos e piloto | JSON de 22/10 com recursos, filtros, limites e custos propostos. | Implantação, execução do piloto e aceite de custo/cadência. |
| Diagnóstico de capacidade, consumo e frete; roteiro de carga | Leituras e plano de ensaio de 22/10. | Capacidade sob carga, embalagens reais e aceites de modalidades de frete. |
| Verificações de interface e segurança | Provas históricas de Admin/mobile e login/logout; 73 unitários e sondas/navegação de 22/10 no alcance registrado. | Aceites restantes por cenário e domínio final; não repetir toda a bateria sem mudança relevante. |
| Contenção, drenagem e retomada GCP | Executadas em 22–23/10; retomada publicada com 42 sondas e configurações anteriores restauradas. | Não equivale a execução dos Jobs, sincronização SMB ou abertura produtiva. |

**Correção em relação ao guia 2.0 inicial:** as atividades de inventário e preparação não são entregas inteiramente novas. O trabalho agora é completar lacunas, atualizar diferenças e executar os ensaios ainda não realizados quando suas condições estiverem atendidas.

## 3. Prioridade 1 — consolidar diferenças e resolver lacunas técnicas

Usar o projeto `continental-511812`, região `southamerica-east1`, serviço `continental-hml` e os Jobs `continental-hml-payments` e `continental-hml-supervision` já existentes.

1. Usar a retomada de 23/10 como baseline. Atualizar somente mudanças posteriores em revisão, destinos, flags, execuções e filas; fazer uma reconferência curta imediatamente antes do próximo ensaio, não repetir a manutenção inteira.
2. Incorporar a atualização de Vinícius: Vercel acessível, fila Asaas retomada, evento do nº 8 concluído e reserva ainda em revisão. Registrar o que foi informado e o que foi verificado independentemente.
3. Resolver no plano a divergência já diagnosticada: timeout web de 60s, HTTP do Job de pagamentos de 240s e Job de 1800s. Preparar medição isolada do ciclo e configuração coerente; não simplesmente elevar limites ou repetir POST após timeout. A alteração remota depende da medição e da coordenação do ensaio.
4. Preparar proposta concreta de permissões mínimas e pool a partir do diagnóstico existente: conta runtime separada do migrador, grants/locks/triggers necessários e orçamento de conexões considerando todas as revisões e consumidores. Ensaiar em ambiente descartável antes de trocar bindings ou revogar privilégios compartilhados. Administração Neon/budget depende de Vinícius.
5. Preservar as limitações já registradas: APIs desabilitadas impedem inventário histórico; configuração local não comprova estado remoto de Cloudflare; uma consulta sem leases não prova exclusividade global. A reconferência externa cabe ao administrador correspondente.

**Entrega:** complemento datado ao inventário, apenas com diferenças/lacunas; propostas de timeouts, permissões e pool, validações isoladas e dependências. Registrar quais alterações ainda não foram aplicadas.

## 4. Prioridade 2 — completar o plano existente e preparar os ensaios de alertas

Reaproveitar a sequência da seção 2 e os cenários da seção 4 da devolutiva de 22/10. Eles já estão preparados; completar suas dependências e diferenças, mantendo a ativação para a execução coordenada.

- Reaproveitar o plano existente e os Jobs já criados. Documentar o responsável pela agenda de pagamentos e pela supervisão, considerando que Vercel pode receber o webhook enquanto GCP processa a fila.
- Propor um único acionador periódico responsável por cada rotina. Alinhar com Vinícius a situação de Vercel e Cloudflare antes de declarar exclusividade. Acesso ao receptor de webhook não equivale a consumidor financeiro ativo.
- Identificar destino, revisão, autenticação, limite de lote, duração, concorrência, política de tentativas e condição de parada. Considerar o orçamento atual; não contratar recursos pagos ou iniciar carga recorrente nesta preparação.
- Explicitar que `/api/cron/payments?limit=1` também chama conciliação, expiração e outbox: **isso não seleciona um pedido específico**.
- Definir como acompanhar fila, erros, tentativas, revisões e leases; diferenciar recebimento do evento, processamento financeiro e efeito comercial.
- Preparar interrupção e retorno a partir de snapshots da configuração real. Definir tratamento de requisições em andamento e eventos pendentes. Não declarar uma operação desconhecida como falha definitiva nem repetir cobrança/estorno para tentar resolver a fila.
- Usar `V-PROPOSTAS-G6-2026-10-22.json` para preparar a implantação da métrica e das duas políticas próprias de pagamentos ainda não comprovadas como implantadas. Antes de aplicar em janela coordenada, verificar se já existem recursos equivalentes; preservar os recursos de supervisão já criados.
- Priorizar a preparação do ensaio de supervisão/alertas, que deve permanecer separado do processamento financeiro: série inicial, falha, ausência, recuperação, entrega humana e atendimento. Não executar o Job de pagamentos para testar infraestrutura. Os cenários sintéticos não devem enviar comandos financeiros nem alterar segredos compartilhados.
- Completar responsáveis/substituto, disponibilidade, teto de custo e cadência com as definições de Vinícius. A janela de manutenção anterior já ocorreu; sua conclusão não autoriza automaticamente um piloto recorrente novo.

**Entrega:** atualização do plano existente, prontidão dos recursos propostos e roteiro de comprovação de alertas. Após a execução coordenada futura, registrar disparo, recebimento, atendimento e recuperação. Recurso criado e política habilitada não substituem essas provas.

## 5. Prioridade 3 — complementar o roteiro financeiro com a parte operacional

Os casos e aceites financeiros pertencem à frente de Vinícius; o relatório de 22/10 já solicitava `ROTEIRO_ACEITE_FINANCEIRO_G3.md`, que continua ausente na branch auditada. Vanderlei deve complementar a parte operacional do roteiro existente e indicar as lacunas de observabilidade/infraestrutura, sem aguardar para executar as prioridades 1 e 2. A definição de casos novos, valores, produto/variante e efeitos autorizados fica com Vinícius. Não reutilizar os pedidos nº 3 ou nº 8, nem criar cobrança/pedido apenas para preencher o roteiro.

| Etapa a comprovar | Evidência esperada no ensaio coordenado |
| --- | --- |
| Checkout | Pedido e tentativa vinculados, identificação estável da variante e reserva correspondente. |
| Cobrança Sandbox | Identificador e referência externa correspondentes ao pedido, método e valor corretos. |
| Webhook | Autenticação, recebimento persistido e resposta HTTP; código 200 sozinho não prova processamento. |
| Consumidor | Evento selecionado/processado, resultado, erro ou revisão explícitos. |
| Efeitos comerciais | Estado do pedido, fatos financeiros, estoque e reserva antes/depois, conforme o cenário. |
| Repetição controlada | Evidência de que a mesma entrega não duplica efeitos, preferencialmente validada primeiro em banco descartável. |
| Comunicação | Resultado do envio de confirmação, distinguindo fila criada de mensagem efetivamente entregue. |
| Nuvemshop/SMB | Identificação de quem verificará a exportação e a baixa no ERP; execução alinhada com a frente de integração de Vinícius. |

**Entrega:** roteiro preenchido com pré-condições, passos, resultado esperado, forma de coleta, parada e recuperação. Marcar como “não executado” o que ainda não foi ensaiado. Registrar separadamente a validação da integração SMB: Sandbox financeiro não transforma a loja comercial Nuvemshop/SMB em ambiente descartável.

## 6. Revisão do executor — dependência de publicação por Vinícius

Vinícius implementou localmente `processPaymentInboxEvent`, com conferência de evento, pedido, loja e conta Asaas. A suíte de execução financeira passou em 60 testes em PostgreSQL descartável; tipos e lint também passaram. A função foi usada localmente contra a homologação para concluir somente o evento do nº 8. **O código ainda não foi publicado por esta entrega e não está automaticamente disponível na máquina de Vanderlei ou nas revisões GCP.**

Esta revisão depende de Vinícius disponibilizar o commit/PR e as evidências. Não impede o avanço das prioridades 1 a 3.

Quando o código estiver disponível, conferir:

- Seleção por ID exato, pedido, loja, conta, cobrança e referência, sem recorrer à fila geral quando o alvo não confere.
- Respeito a bloqueios ativos, prazos de nova tentativa e revisões; recuperação segura de bloqueio expirado.
- Repetição e concorrência sem duplicar efeitos; preservação de outros pedidos, estoque, reservas e revisões.
- Reutilização da inspeção do provedor e das transações financeiras existentes.
- Ausência de chamada implícita aos Jobs gerais, expiração, envio de mensagens ou comandos remotos de cobrança/estorno.

**Entrega:** revisão com SHA analisado, verificações executadas, resultados e eventuais ajustes propostos. Testes devem usar infraestrutura descartável, sem credenciais ou banco compartilhado.

## 7. Outras pendências confirmadas na branch

Estas frentes continuam abertas nas evidências consultadas. Reaproveitar seus planos e diagnósticos, sem tratá-las como implementações iniciadas do zero ou atribuí-las integralmente a Vanderlei.

| Pendência | O que Vanderlei pode adiantar | Dependência / prova restante |
| --- | --- | --- |
| E-mail e recuperação de senha | Reaproveitar o procedimento de 22/10 e preparar bindings, origem canônica e ensaio. | Vinícius define domínio/remetente/destinatário controlado. Última evidência: bindings ausentes; entrega real, uso único de reset e login/logout ainda sem prova dessa etapa. `401 restricted_api_key` ao listar domínios não comprova incapacidade de envio; não trocar a chave por esse motivo. |
| Capacidade e custo | Atualizar o plano de medição e os limites de conexões/carga com base no inventário. | Acesso Neon/budgets e teto financeiro; ensaio preparado, não executado. Consumo em baixa carga não comprova capacidade de venda. |
| Frete e embalagens | Listar casos e requisitos técnicos de cada modalidade usando o diagnóstico existente. | Vinícius define contratos/cobertura e embalagens reais. Última evidência: dimensões padronizadas em 519 produtos; Correios sem contrato/credencial local e timeout anterior sem solução demonstrada. Cotações J&T não aprovam Correios. |
| Aceites de interface | Selecionar somente os cenários sem prova compatível: variantes distintas, carrinho autenticado e fluxos financeiros/Admin. | Contas/casos controlados e versão definida; reaproveitar testes e aceites publicados que ainda sejam válidos. |
| Recuperação G2 e continuidade | Conferir custódia, acesso independente à chave, cobertura externa ao dump e plano de recuperação. | Vinícius disponibiliza o fechamento técnico e suas evidências, ausentes nesta branch. Comparar com RPO 15min/RTO 60min; não repetir restore idêntico por ausência do documento. |
| Segurança e permissões | Preparar correções concretas para a conta Compute padrão com Editor e a role de banco privilegiada; ensaiar grants necessários. | Aprovação/aplicação pelo administrador responsável e comprovação posterior. Não revogar privilégios antes de mapear dependências. |

**Não são novas tarefas pendentes de Vanderlei:** reaplicar migrations, recriar Jobs existentes, repetir a contenção/retomada concluída, reaplicar os 517 vínculos, reprocessar o evento nº 8 ou produzir novamente os planos já publicados. A revisão da reserva nº 8 e a integração SMB permanecem com Vinícius.

## 8. Divisão de trabalho e devolutiva

| Responsável | Frente |
| --- | --- |
| Vanderlei | Complemento do inventário, lacunas de timeouts/permissões/pool, preparação dos ensaios de alertas, parte operacional do roteiro financeiro e revisão técnica quando o código chegar. |
| Vinícius e seu agente | Reserva do nº 8, tratamento coordenado das revisões financeiras e integração Nuvemshop/SMB; administração de Vercel, Cloudflare e Asaas; disponibilização das alterações locais. |
| Ambos | Escolha da versão e do cenário, liberação da execução coordenada e conferência do resultado completo. |

Enviar uma devolutiva contendo:

1. Horário BRT/UTC, commit local, revisão remota e recursos efetivamente consultados.
2. Entregas concluídas reaproveitadas, diferenças novas, pendências e itens sem acesso, com evidência sanitizada; não recriar os relatórios anteriores.
3. Estado atual dos Jobs, agendas e controles; registrar explicitamente se nenhuma execução foi iniciada.
4. Procedimento proposto e dependências de Vinícius, sem solicitar novamente dados já disponíveis nos documentos.
5. Resultado da revisão do executor ou a indicação “aguardando publicação do código”.

Main e seu banco permanecem somente leitura. Preservar alterações locais ao atualizar o repositório; não usar `reset --hard` para obter este guia. Não publicar `.env`, tokens, URLs com bypass, documentos de clientes ou payloads completos. Esta entrega permite começar a preparação; não declara produção aprovada nem autoriza ativar consumidores gerais, reaplicar vínculos ou mudar estoque.
