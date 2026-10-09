# Análise dos limites do Vercel Hobby para o projeto

**Data:** 07/10/2026 — America/Sao_Paulo.  
**Estado:** estimativa de consumo; capacidade no ambiente publicado ainda não validada.

**Decisão posterior — 08/10/2026:** Vercel permanece para homologação; produção será no Google Cloud, mantendo Neon Free e configurando ao final o remetente da loja em domínio verificado no Resend. A proposta anterior de Vercel comercial/Neon Launch não foi escolhida. As estimativas de 07/10 são históricas; os limites do Neon e a operação dos consumidores continuam relevantes para a nova hospedagem. Detalhamento na seção 10.

## 1. Avaliação geral

Para a previsão de **100 a 300 visitantes por dia**, algumas cotas do Hobby parecem confortáveis. Ainda não há medições suficientes para garantir folga de CPU e memória ou desempenho durante os picos.

O volume previsto, sozinho, não indica necessidade de uma infraestrutura grande. Os principais pontos de atenção são o processamento, a execução frequente da rotina de pagamentos, o histórico curto de logs e a adequação do plano ao uso comercial.

## 2. Estimativa de utilização

| Parâmetro informado | Estimativa |
|---|---:|
| Visitantes por dia | 100 a 300 |
| Usuários simultâneos no pico | 30 a 80 |
| Checkouts por minuto no pico | 2 a 5 |
| Visitas em 30 dias, considerando uma visita por visitante | 3 mil a 9 mil |

Uma pessoa pode realizar mais de uma visita e navegar por várias páginas. Portanto, visitantes, visitas, requisições e pedidos são métricas diferentes. A projeção mensal acima utiliza uma hipótese simplificada.

## 3. Exemplos de consumo mensal

Os exemplos abaixo consideram **9 mil visitas em 30 dias**. São hipóteses ilustrativas, não medições do projeto.

| Hipótese de consumo | Total mensal estimado | Cota Hobby | Parcela da cota |
|---|---:|---:|---:|
| 20 chamadas ao backend por visita | 180 mil chamadas | 1 milhão de chamadas de funções | 18% |
| 3 MB entregues pela Vercel por visita | 27 GB | 100 GB de transferência para visitantes | 27% |
| 10 MB entregues pela Vercel por visita | 90 GB | 100 GB de transferência para visitantes | 90% |

Os dois exemplos de transferência são cenários alternativos. As conversões usam unidades decimais aproximadas. As cotas constam na [documentação do plano Hobby](https://vercel.com/docs/plans/hobby).

Imagens, navegação por várias páginas, bots e consultas repetidas podem aumentar o consumo. Chamadas administrativas, webhooks e rotinas automáticas também precisam entrar no orçamento; não estão incluídos na hipótese de 20 chamadas por visita. Esta tabela não cobre todas as cotas, como requisições à CDN, transferência da origem e transformações de imagens.

## 4. CPU e memória

O Hobby inclui **4 horas mensais de CPU ativa**, equivalentes a **14.400 segundos**. Dividindo essa cota por 9 mil visitas, o orçamento seria de **1,6 segundo de CPU ativa por visita**, antes de reservar consumo para as rotinas automáticas e demais acessos. Essa divisão é um orçamento ilustrativo, não o consumo observado de cada visitante. A cota de memória provisionada é de **360 GB-horas**, que representa consumo acumulado, não armazenamento. [Cotas do Hobby](https://vercel.com/docs/plans/hobby).

CPU ativa não corresponde ao tempo de carregamento da página nem à duração total de uma requisição. Esperar uma resposta do banco ou de uma API não conta como CPU ativa, mas pode consumir memória provisionada. O consumo depende do tempo de alocação das instâncias e de sua configuração. [Contabilização do Fluid Compute](https://vercel.com/docs/functions/usage-and-pricing).

## 5. Rotina de pagamentos e diagnóstico

O cron nativo do Hobby permite que cada rotina execute **no máximo uma vez por dia**, com precisão por hora. Essa frequência não atende à rotina frequente de processamento dos pagamentos que estamos preparando. [Limites de cron](https://vercel.com/docs/cron-jobs/usage-and-pricing).

Os crons nativos chamam o deployment de **Production**. Para executar periodicamente a rotina na homologação em Preview, será necessário um agendador externo. [Funcionamento dos crons da Vercel](https://vercel.com/docs/cron-jobs).

Essa limitação não impede o Asaas de enviar webhooks imediatamente. O recebimento das notificações e a execução periódica do processamento das filas são etapas diferentes no projeto.

O histórico de logs de execução do Hobby é de **1 hora**, o que limita a investigação posterior de incidentes. Precisamos definir monitoramento e registros adequados para a operação financeira. [Comparação dos planos](https://vercel.com/docs/plans/hobby).

## 6. Validação necessária

Antes de afirmar que a infraestrutura atende à previsão, precisamos medir no ambiente Vercel/Neon:

- Consumo real de CPU, memória, chamadas e transferência por visita e por compra.
- Consumo e duração das rotinas de pagamentos, incluindo consultas sem trabalho pendente.
- Comportamento com 30 a 80 usuários simultâneos e 2 a 5 checkouts por minuto.
- Latência com banco frio e quente e com imagens e demais recursos externos.
- Crescimento das filas, falhas e recuperação durante os picos.

A média diária não revela possíveis lentidões em horários de maior movimento. Os ensaios locais já realizados não certificam a capacidade do ambiente publicado.

## 7. Adequação para produção comercial

O Hobby é restrito a **uso pessoal não comercial**. A operação do e-commerce com vendas exige um plano de hospedagem compatível, mesmo que o consumo técnico caiba nas cotas gratuitas. [Condições do plano Hobby](https://vercel.com/docs/plans/hobby).

A escolha do plano final deve considerar as medições do projeto, a rotina de pagamentos e as necessidades de monitoramento. A configuração atual e estas estimativas não constituem aprovação para produção.

## 8. Neon: orçamento até a entrada em produção e o fim do período

Em 07/10/2026, o operador informou a intenção de lançar a loja em aproximadamente dois dias, em 09/10/2026. O planejamento precisa considerar o saldo do período atual, incluindo o consumo já acumulado. O dashboard de produção e, em seguida, o Billing foram enviados nesta mesma data. O Billing confirma o período de **01/10/2026 a 01/11/2026**, plano Free e assinatura gerenciada pela Vercel; a franquia não está integralmente disponível.

O Neon Free atualmente inclui **100 CU-hours por projeto por período mensal**, **1 GB de armazenamento Postgres por projeto** e **5 GB de transferência pública por projeto por mês**. Homologação e produção em projetos separados têm seus próprios limites de processamento; computes de branches e réplicas dentro do mesmo projeto compartilham seu orçamento. Existem também limites agregados, como 20 GB de armazenamento entre os projetos da conta. [Planos atuais do Neon](https://neon.com/docs/introduction/plans).

O consumo de processamento é calculado pelo tamanho do compute multiplicado pelo tempo em que permanece ativo. No Free, a suspensão ocorre após cinco minutos sem atividade. Uma consulta por minuto tende a manter o compute ativo, mesmo com filas vazias, pois não deixa esse intervalo de inatividade. A gratuidade do agendador Cloudflare não elimina o consumo da API na Vercel ou do banco Neon. [Ciclo de vida do compute](https://neon.com/docs/introduction/compute-lifecycle).

Hipótese ilustrativa: **um único compute fixo de 0,25 CU**, sem outros computes ativos ou aumento de capacidade.

| Cenário | Cálculo | Processamento aproximado |
|---|---|---:|
| Teste por duas horas | 0,25 × 2 | 0,5 CU-hour |
| Ativo durante um dia completo | 0,25 × 24 | 6 CU-hours |
| Ativo desde 09/10 às 00h até 01/11 às 00h | 0,25 × 24 × 23 | 138 CU-hours |
| Tempo ativo coberto por uma franquia integral de 100 CU-hours | 100 ÷ 0,25 | 400 horas, aproximadamente 16,7 dias |

O primeiro exemplo desconsidera os minutos até o compute suspender após o último acesso. Os demais são cenários de atividade contínua, não medições do tráfego da loja. Autoscaling, réplicas ou outros computes ativos aumentam o consumo. Acessos à loja não devem ser somados novamente como horas se já estiverem dentro do mesmo tempo de atividade contínua do compute.

**Se o período só renovar em novembro, 100 CU-hours não cobrem as 138 CU-hours desse cenário.** O saldo real será menor quando já houver consumo no mesmo projeto. Quando a franquia de CU-hours ou de transferência se esgota, o compute Free é suspenso até o próximo período ou upgrade, afetando as funcionalidades que dependem do banco. [Comportamento ao atingir limites](https://neon.com/docs/introduction/plans).

Para calcular a folga real, registrar os seguintes dados do projeto que receberá produção:

| Dado necessário | Estado em 07/10/2026 |
|---|---|
| Projeto/organização e plano efetivo | Dashboard de `CContinental-DB` e Billing confirmam Free; assinatura gerenciada pela Vercel |
| CU-hours utilizadas e limite do período | 2,2 CU-hours utilizadas; referência documental: 100 CU-hours/projeto/período, limite não exibido no print |
| Data de renovação | Billing confirma o período de 01/10/2026 a 01/11/2026; conferir horário efetivo se necessário |
| Tamanho do compute e eventual intervalo de autoscaling | Default compute: 0,25 CU; limites de autoscaling não exibidos |
| Outros computes/branches ativos no projeto | Uma branch `main`; serviço exibido informa 1 database, 1 compute; configuração completa a confirmar |
| Armazenamento e transferência utilizados | Storage: 38,6 MB; Network transfer: 90,82 MB |

O print também mostra região AWS São Paulo e History: 490,86 kB. A captura é evidência fornecida pelo operador, não uma consulta independente ao painel/API. O nome `main` refere-se à branch Neon do projeto de produção, não à branch Git usada para homologação.

Considerando a referência atual de 100 CU-hours, o **saldo estimado é de 97,8 CU-hours**. Com um único compute mantido em 0,25 CU, isso cobre cerca de **391,2 horas ou 16,3 dias de atividade contínua**, antes de novos consumos. Na hipótese de atividade contínua de 09/10 às 00h até 01/11 às 00h sem renovação intermediária, o total do período seria de pelo menos **140,2 CU-hours**: 2,2 já utilizadas mais 138 projetadas. O cenário ultrapassaria a franquia em 40,2 CU-hours, sem incluir consumo adicional antes do lançamento ou aumentos de capacidade.

Armazenamento e transferência estão baixos na captura: aproximadamente 3,9% de 1 GB e 1,8% de 5 GB, respectivamente, usando conversões decimais. Isso não demonstra o consumo após o lançamento. O gráfico mostra longos períodos de endpoint inativo; o consumo histórico baixo não é representativo de uma nova rotina por minuto que impeça a suspensão. **O principal risco identificado neste cenário é o tempo de compute ativo.**

O Billing fornecido posteriormente confirmou o período até 01/11/2026 e informa gestão em Vercel → Integrations → Neon Database → Settings. O limite numérico de CU-hours não aparece nessa captura; os cálculos usam a franquia documental atual. O saldo observado permite sessões curtas de teste, mas não aprova o agendamento contínuo em produção.

Com um único compute fixo de 0,25 CU, o saldo de processamento suporta aproximadamente `saldo de CU-hours ÷ 6` dias de atividade contínua. Essa conta não verifica armazenamento, transferência, latência ou os demais requisitos operacionais. O consumo pode demorar cerca de uma hora para aparecer no painel. [Onde consultar o consumo](https://neon.com/docs/introduction/monitor-usage).

## 9. Próximas ações e configuração candidata

1. **Usar o saldo observado no planejamento.** Dashboard recebido: 2,2 CU-hours, 38,6 MB de Storage e 90,82 MB de Network transfer, plano Free e default compute de 0,25 CU. Billing recebido: período de 01/10 a 01/11/2026, assinatura gerenciada pela Vercel. A franquia numérica e a configuração completa do compute continuam sujeitas à conferência na integração.
2. **Concentrar os testes extensos no Docker local.** O operador autorizou esse caminho em 07/10/2026. Usar a aplicação local e o provisionador existente de PostgreSQL descartável, com migrations, identidade/sentinela e gateway simulado. Isso não consome os bancos Neon. Reservar verificações breves no Preview com o projeto separado `continental-homologacao` para implantação, configuração, agendamento e integração Sandbox. O Worker preparado inicia desativado e sem cron; quando publicado, utilizar a janela temporária do [guia de homologação](../CORRECOES/Correcoes_logicas/Correcao_logica_1/Workflow/GUIA_AGENDADOR_PAGAMENTOS_HOMOLOGACAO.md) e desligar ao concluir. Publicação e consumo real do Worker ainda não foram confirmados.
3. **Adequar a operação à decisão de 08/10: Google Cloud e Neon Free.** Definir o serviço e orçamento da hospedagem, medir as cotas do banco e projetar execução durável dos consumidores antes de ativar operação permanente. A proposta anterior de Vercel comercial/Neon Launch foi substituída pela decisão do operador. Nenhum upgrade ou provisionamento foi realizado nesta revisão.
4. **Concluir a validação financeira em Sandbox antes de liberar vendas.** O prazo pretendido de dois dias não substitui os testes de integração, monitoramento e recuperação ainda pendentes.

**Estimativa histórica de 07/10 para alternativa paga não escolhida:** a referência consultada para Neon Launch era **US$ 0,106/CU-hour**, sem mínimo mensal, além dos demais recursos. As 138 CU-hours ilustrativas corresponderiam a **US$ 14,63 apenas de processamento**. Isso não era custo total nem previsão de tráfego real; o preço não foi reconfirmado nesta revisão e não compõe o plano atual. [Referência de preços](https://neon.com/pricing).

Aumentar o intervalo do cron não é uma solução automaticamente suficiente. Intervalos inferiores a cinco minutos continuam tendendo a impedir a suspensão; intervalos maiores podem permitir inatividade, mas atrasam o processamento das notificações de pagamento e a reconciliação. A frequência final exige medir consumo, duração, backlog e atraso aceitável, sem alterar indiscriminadamente o fluxo financeiro.

## 10. Trajetória escolhida em 08/10/2026

- **Vercel para homologação, Google Cloud para produção.** Serviço, região, dimensionamento, custos, artefato de implantação, autenticação dos executores e operação ainda não foram definidos ou ensaiados. A restrição comercial do Hobby deixa de exigir um plano Vercel de produção nessa trajetória; os resultados do Preview continuam sendo evidências de homologação.
- **Neon Free mantido.** A documentação atual informa 100 CU-hours/projeto/mês e 1 GB de armazenamento de banco por projeto. Um único compute constante de 0,25 CU ativo durante 30 dias consumiria 180 CU-hours, acima da franquia. Trata-se de limite de cenário, não medição da carga da loja. Mudar para Google Cloud não modifica essa cota. [Atualização oficial de 02/10/2026](https://neon.com/blog/neon-free-plan-1-gb-per-project).
- **Remetente da loja no Resend ao final da preparação.** Verificar domínio e DNS, configurar EMAIL_FROM e autorização da chave no ambiente final e confirmar entrega automática a outros destinatários antes de abrir vendas. Cadastro de endereço sozinho não resolve a restrição do domínio de teste. [Domínios verificados](https://resend.com/docs/dashboard/domains/introduction).

Para manter o banco gratuito, avaliar processamento conforme demanda e rotinas de recuperação/expiração com consumo e prazo de atendimento medidos. O webhook atual somente grava a inbox; não substitui um consumidor durável. Ainda não há escolha de nova fila, serviço executor ou intervalo de agendamento. A disponibilidade da loja, inclusive latência ao acordar o banco, precisa ser validada junto das cotas, sem tratar gratuidade como comprovação de capacidade. O cron de homologação permanece desligado; não houve implantação, migração de banco ou alteração de plano/configuração externa nesta atualização.
