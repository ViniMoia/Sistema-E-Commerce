# Indicadores administrativos na abertura — auditoria de 16/10/2026

## Escopo e decisão existente

Revisão dos cálculos de dashboard, métricas financeiras de clientes e relatório de fidelidade. O operador já classificou as compras antigas como testes e determinou a preservação do histórico. A aplicação dessa decisão nos indicadores ainda precisa de implementação; não se deve apagar pedidos, cancelar cobranças ou fabricar evidências financeiras para ajustar relatórios.

Referências consultadas: `origin/main` em `7f9b26e062ec2654420fecffb6dd78ad3ba1e017`, seu serviço de dashboard e runbook de implantação; candidata local baseada em `17366e8b5c2a44bd2c0157a159a371886b3126d1`. O filtro do dashboard somente por loja/status já existe na main. As métricas de clientes da candidata possuem tratamento posterior por evidências financeiras que deve ser preservado.

O ensaio reutiliza o backup de **15/10/2026 às 18:43:55 UTC**, restaura/sanitiza em PostgreSQL 18 descartável, aplica as migrations e o tratamento de abertura previamente ensaiado. Não é uma leitura do estado atual da produção. Nenhuma nova conexão com origem, escrita em main/homologação compartilhada, chamada ao Asaas, email, deploy ou mudança de configuração remota faz parte desta auditoria.

## Achados e correções propostas

| Prioridade | Evidência | Consequência e proposta |
|---|---|---|
| Alta | `services/dashboard.service.ts` agrupa todos os pedidos da loja. O snapshot preserva 24 pedidos de teste: quatro pagos, dez pendentes e dez cancelados. | Os indicadores de abertura incluem R$ 1.069,99 recebidos, R$ 1.209,00 pendentes e R$ 580,00 cancelados; ticket R$ 267,50 e conversão 17%. Classificar explicitamente os IDs auditados como teste, com revisão e auditoria, mantendo-os acessíveis em histórico separado. Aplicar o mesmo escopo comercial às contagens, valores e listas operacionais. |
| Alta | A caixa de ações usa status e entrega, sem classificação dos pedidos. | Os legados geram dois despachos, duas retiradas e dez pagamentos pendentes, embora seus comandos financeiros sejam bloqueados pela política de legados. Excluir testes das ações comerciais e apresentar sua condição no histórico; não habilitar aprovação/cancelamento para limpar alertas. |
| Alta | O dashboard soma `Order.total` por `PAID/SHIPPED/DELIVERED`; os clientes usam `FinancialFact` e distinguem valores reconhecidos, liquidação e estorno confirmado. | No snapshot, clientes indicam R$ 0 reconhecido e 24 pedidos sem evidência; dashboard apresenta recebimento de R$ 1.069,99. Reaproveitar a política financeira validada em um agregador compartilhado, com escopo de loja e cobertura explícita, incluindo compradores visitantes. Não substituir a consulta por uma soma simples de fatos: autorização e liquidação não são duas vendas. |
| Alta | As consultas por período usam `paidAt`, mas recorrem a `createdAt` se o primeiro for nulo; o total ignora `financialTotal` e encargos. | Uma data de criação não comprova recebimento. Separar valor comercial, encargos, valor reconhecido e liquidação; usar a data do fato adequado e explicitar ausência de evidência. O painel atualmente chama pedidos pagos de “liquidados”, o que exige revisão para cartão autorizado ainda não liquidado. Não basta trocar `total` por `financialTotal`: a divisão produtos/frete também precisa tratar encargos. |
| Alta | No ciclo manual sintético de R$ 100, o dashboard mantém R$ 100 durante solicitação de estorno; após confirmação, passa a R$ 0 recebido e R$ 100 cancelado. As métricas de clientes preservam R$ 100 bruto, R$ 100 estornado e R$ 0 líquido. | Preservação do valor durante solicitação está correta. Falta distinguir cancelamento sem pagamento de estorno confirmado e apresentar bruto, devolvido e líquido. Pelo código, a exclusão por status atual também altera retroativamente períodos de recebimento anteriores; esse efeito entre meses não foi ensaiado separadamente. Registrar devolução pelo seu próprio fato/data. |
| Média | `app/api/admin/loyalty/reports/route.ts` usa `walletsAggregate._sum.lifetimeEarn || earnedAggregate._sum.points`. Após abertura, saldo e acumulado das carteiras são zero, mas a resposta recupera 475 pontos históricos. | Zero é válido e não significa ausência. Alinhar o significado entre dashboard e relatório, preservar zero na base conciliada e separar histórico de testes dos indicadores da abertura. Isso é inconsistência de relatório: não houve recrédito de 475 pontos na carteira. |
| Baixa | `DashboardActionInbox.tsx` descreve “não liquidados via PIX”, mas a consulta conta todos os pedidos `PENDING`. | Ajustar a descrição para todos os métodos ou filtrar explicitamente PIX. Não esconder boleto/cartão pendente por acidente ao corrigir o texto. |

## Sequência de implementação recomendada

1. Preparar classificação explícita e auditável dos pedidos de teste do snapshot. Reauditar IDs/estado antes da aplicação real; novos pedidos ou divergências interrompem a aplicação. `checkoutIntentID=null`, nome de produto ou uma data isolada não bastam para classificar testes em qualquer loja.
2. Aplicar o escopo comercial aos indicadores e ações, preservando filtros/identificação para consultar o histórico de testes. Não mudar status financeiro, estoque, pontos nem vínculos para retirar registros de uma contagem.
3. Unificar a interpretação financeira com as métricas de clientes e ajustar rótulos/DTOs: reconhecido, liquidado, estornado e líquido, com frete/encargos identificados e datas próprias. Exibir cobertura parcial em vez de inventar liquidação para legados.
4. Corrigir o tratamento do zero no relatório de fidelidade e explicitar o período/segmento do histórico. Preservar as transações originais e seus ajustes de abertura.
5. Validar no clone: indicadores comerciais iniciais sem testes; histórico íntegro; compra nova aparece uma vez; solicitação de estorno não reduz saldo; confirmação produz devolução uma vez; datas de recebimento/devolução em meses distintos; isolamento de loja e compradores visitantes. Só então preparar publicação em homologação.

## Ferramenta e limites do ensaio

Comando a partir da raiz, usando o diretório privado de backup existente:

```powershell
node scripts/verify-restored-clone.mjs --backup-dir "$env:LOCALAPPDATA/logic-audit-backups/9343e285df85d60fdcfb1ba15daade73" --audit-indicators
```

O modo adicional usa `tests/clone/restored-indicators.test.ts` e grava relatório privado de agregados. Os três cenários caracterizam o comportamento atual: testes verdes significam reprodução e preservação verificadas, **não aprovação dos cálculos atuais**. O handler de fidelidade é chamado com autenticação simulada somente para medir a resposta; isso não é um teste de autorização. Compras/estornos do cenário financeiro são locais, com o fluxo manual controlado, sem provedor externo.

O primeiro ensaio foi interrompido porque o executor misturava o aviso de atualização da CLI Prisma com o SQL de comparação e interpretava o aviso como drift. A ferramenta passou a ler `migrate diff --output` em arquivo separado; a rejeição de diferenças reais permanece. Uma rodada posterior identificou uma fixture financeira incompleta, rejeitada pela constraint existente; corrigida a fixture, preservando a constraint. Nenhuma dessas ocorrências justificou alteração de schema ou dado compartilhado.

Execução final `71a813f2e80c0e910bc6889ac68bde96`, **16:00:40–16:02:07 BRT de 16/10**, concluída: três cenários reproduzidos, zero falhas, pedidos/carteiras/transações originais preservados. No cenário sintético de períodos, os indicadores retornaram R$ 150 no dia/mês e R$ 220 no total: R$ 50 entraram pela data de criação sem `paidAt`, e R$ 20 de encargos ficaram fora da soma. O cenário não representa uma liquidação comprovada no Asaas.

TypeScript sem emissão, lint dos dois arquivos de ferramenta/teste, quatro testes das proteções do clone e verificação de whitespace passaram. Migrações e preservação de dados/sequências passaram; SQL de diff vazio. Containers do ensaio descartados. Evidência agregada sem credenciais ou dados de clientes: [L-INDICADORES-ABERTURA-CLONE-2026-10-16.json](../../../../trabalho_em_dupla/evidencias/L-INDICADORES-ABERTURA-CLONE-2026-10-16.json).

**Situação ao encerrar a auditoria acima:** correções propostas, ainda não implementadas naquele momento. O avanço posterior está registrado a seguir; a evidência original permanece preservada.

## Implementação posterior: classificação explícita dos testes

Implementada localmente a relação `OrderReportingExclusion` e seu uso no dashboard, ações comerciais e métricas financeiras de clientes. A migration cria somente a tabela e suas restrições; não altera/classifica registros existentes. O Admin abre nos pedidos comerciais e oferece consulta ao histórico de testes ou a todos, com identificação, busca no servidor e paginação. A API mantém `ALL` como padrão para chamadas que não informam o novo filtro.

O executor `--rehearse-reporting` exige o clone descartável e o fingerprint do snapshot aprovado, com transação e auditoria individual. No ensaio `64ba5a45a66728c774138db05b754884`, 16:14:06–16:15:36 BRT, os 24 pedidos ficaram fora dos indicadores comerciais, mas continuaram acessíveis e íntegros. Replay conservou 24 classificações e 24 auditorias. Os três cenários passaram, incluindo não inferir exclusão para outro pedido antigo, isolamento de loja, compra nova e estorno confirmado/repetido sem duplicação.

Corrigido também o fallback do acumulado de fidelidade: zero válido da carteira é preservado; não houve alteração das transações históricas. A descrição de pagamentos pendentes passou a abranger todos os métodos.

Passaram também nove unitários focados, cinco proteções do clone, três testes do executor, 16 integrações financeiras de clientes, quatro cenários de operações no navegador e o novo cenário de histórico/paginação com 103 pedidos sintéticos. TypeScript, lint e build isolado aprovados. Evidência desta etapa: [L-INDICADORES-CLASSIFICACAO-CLONE-2026-10-16.json](../../../../trabalho_em_dupla/evidencias/L-INDICADORES-CLASSIFICACAO-CLONE-2026-10-16.json).

**Pendências ao final daquela etapa:** interpretação financeira do dashboard, datas, encargos e cobertura, tratadas no avanço abaixo; escopo histórico dos resgates de fidelidade ainda pendente. A classificação não altera o livro financeiro, não bloqueia obrigações dos consumidores e não substitui o tratamento de abertura das carteiras/estoques. A aplicação em banco compartilhado ainda exige procedimento e baseline próprios. Recuperação por operador alternativo, configuração Cloud Run, transição do webhook e revisão de produção continuam frentes separadas.

## Implementação posterior: interpretação financeira por evidências

Dashboard e clientes agora compartilham os CTEs de validação/reconhecimento em `lib/commerce/financial-evidence.ts`. A agregação financeira do dashboard usa um único snapshot por loja e inclui visitantes. Somente fatos válidos reconhecem principal, liquidação e devolução; autorização e liquidação não duplicam a venda, parcelas não multiplicam o denominador de pedidos, e solicitar estorno não confirma devolução. A classificação explícita de testes continua aplicada; ausência de prova e inconsistências produzem cobertura parcial.

**Base temporal explícita:** `FinancialFact.createdAt`, primeira confirmação registrada por instrumento/tipo, com períodos em Brasília. A auditoria do escritor identificou reutilização de `paidAt` em `occurredAt` inclusive para devoluções; esse campo não pode fundamentar uma afirmação de data bancária própria. O dashboard informa data de registro, sem corrigir/regravar fatos imutáveis. Estorno em outro mês preserva o reconhecimento anterior, reduz o período do registro e pode gerar líquido negativo. Não se afirma saldo disponível, lucro ou valor líquido de taxas do provedor.

Hoje, mês e histórico exibem quatro medidas: reconhecido bruto, liquidação bruta, estornos confirmados e reconhecido menos estornos. Produtos após descontos/frete/encargos são a composição histórica dos contratos integralmente reconhecidos, antes dos estornos. Valores parciais ou sem composição conferida ficam não alocados. Frete total da logística passa a ser identificado como contratado, incluindo pedidos pendentes/cancelados. Cache versionado para `aggregated_metrics_v3`.

Validações concluídas: oito integrações financeiras do dashboard, 16 regressões de clientes, um navegador em desktop/celular, seis unitários focados, três testes do executor, TypeScript, lint e build de produção isolado. As antigas asserções unitárias que apenas repetiam somas/status/datas locais foram removidas; as regras financeiras passaram a ser verificadas nos serviços reais com PostgreSQL, preservando os testes reais do utilitário de datas.

Ensaio da classificação com a nova apuração: `7dabcb77bc339ec06375cc5c27c94900`, três cenários aprovados, dados/sequências preservados, diff de schema vazio e replay de classificação/estorno sem duplicação. Backup reutilizado, nenhuma nova conexão com origem. A evidência original da auditoria permanece histórica; a nova evidência está em [L-DASHBOARD-FINANCEIRO-2026-10-16.json](../../../../trabalho_em_dupla/evidencias/L-DASHBOARD-FINANCEIRO-2026-10-16.json).

Conferência adicional dos indicadores `71ebc10e70a3639084d880862923613e`, 17:09:10–17:11:33 BRT: três cenários aprovados e tabelas/dados/sequências preservados. Legados sem fatos permanecem sem reconhecimento, e devolução confirmada conserva o bruto e reduz o líquido. Duas tentativas anteriores foram interrompidas pelo retorno do `taskkill` na limpeza; o helper agora comprova saída do processo e fechamento da porta local antes de aceitar o encerramento. Cinco testes das proteções do clone e lint passaram. Não foram alteradas as guardas de banco nem as regras financeiras.

Correção local, sem commit/push/deploy, alteração de segredos, webhook ou agendador. Esta etapa não acrescenta migration; depende da estrutura de classificação previamente preparada. Conferência remota e coordenação da publicação com Vanderlei ainda pendentes. O domínio financeiro não recebeu comandos nem mutações para ajustar o relatório.
