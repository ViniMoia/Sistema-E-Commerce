# Ficha de aceite remoto — dashboard e fidelidade

Preparada em 16/10/2026 para **`55a300313570f2a504a8f042ba7f228cd7382e58`**. Estado: **NÃO EXECUTADO NO DESTINO**. Dono: Vanderlei, publicação/identidade da revisão; Leno, apuração/comparação; revisão recíproca. Complementa [G3/G4/G8](CHECKLIST_PRODUCAO_G1_G8.md), sem conceder aceite de produção.

O código e os testes da candidata foram conferidos. A [CI desse SHA](https://github.com/ViniMoia/Sistema-E-Commerce/actions/runs/38969534735) passou; a publicação remota mais recente documentada é de `eff10bf`, anterior às correções de cobertura do #3, fidelidade e cache. Uma tela acessível no endereço principal não comprova qual revisão a serviu.

## 1. Pré-condições e identidade da rodada

Preencher uma cópia do [modelo de registro](modelos/ACEITE_DASHBOARD_FIDELIDADE.json), preservando o modelo como não executado.

| Campo | Valor conhecido / ação |
|---|---|
| Ambiente | Homologação, projeto `continental-511812`, região `southamerica-east1`. |
| Serviço conhecido | `continental-hml`; URL principal `https://continental-hml-15531616695.southamerica-east1.run.app`. |
| URL efetivamente testada | Registrar a URL da candidata publicada, sem query secreta. Não presumir que o endereço principal mudou. |
| Código/digest/revisão/tráfego | Vanderlei registra SHA efetivo, digest resolvido, revisão e distribuição de tráfego. Exigir `55a3003` ou sucessora explicitamente revisada/testada. |
| Loja | `3a82b33c-3646-4272-9a89-80bb1ba327a5`, homologação. Confirmar vínculo da sessão e do banco sem exportar credenciais. |
| Schema | Confirmar migration `20261016193000_order_reporting_exclusion` já aplicada e compatibilidade com a candidata. Não reaplicar classificação nem alterar dados para conferir a tela. |
| Configuração | Registrar referências/versões e estado efetivo da manutenção/pausa. Preservar `CHECKOUT_PAUSED=true` e controles financeiros combinados; esta ficha não solicita habilitar consumidores. |
| Sessão | Administrador autorizado da própria loja. Nenhum token, cookie ou senha no registro compartilhável. |
| Datas | Registrar UTC, horário de Brasília, horário do baseline e horário de consulta exibido. |

Se a revisão ou a loja não puderem ser confirmadas, registrar **PENDENTE**, sem executar comparações como se fossem da candidata correta. Se houver um SHA sucessor, registrar a diferença relevante e sua CI antes de reaproveitar a prova.

## 2. Uma sequência de conferência

1. Confirmar os campos acima e abrir `/admin` e `/admin/fidelidade` na mesma revisão/loja. São consultas administrativas; não usar formulários de ajuste de pontos, configuração ou ações financeiras.
2. Capturar baseline fresco do banco de homologação em transação `REPEATABLE READ / READ ONLY`, com identidade do destino verificada. Preservar detalhes em arquivo privado; compartilhar apenas agregados, contagens e impressões. Não carregar conexões por suposição do nome `.env`.
3. Fazer apuração independente dos valores abaixo. O retorno da própria API ou a chamada ao mesmo serviço de relatório não constitui cálculo independente. A API é um dos resultados a comparar.
4. Conferir o dashboard, o widget e a página de fidelidade após atualização. O dashboard tem cache de até 60 segundos por processo/loja; `cache: no-store` no navegador não elimina esse cache do servidor. Aguardar sua validade e conferir o horário exibido. Não criar pedidos nem ajustar pontos para invalidá-lo.
5. Conferir `GET /api/admin/loyalty/reports` na mesma sessão pelo painel Rede. Esperado: 200, `success=true`, `data.metrics` e cabeçalho `Cache-Control: private, no-store`. A resposta inclui dados pessoais nas transações recentes: registrar apenas métricas e contagens necessárias, nunca colar a resposta completa.
6. Comparar os campos da seção 3 e 4 e as telas desktop/celular. Registrar esperado, observado, diferença e resultado por campo. Valores monetários em centavos, pontos/contagens inteiros; divergência de um centavo exige explicação, não tolerância arbitrária.
7. Conferir se fatos, classificações, configuração ou ledger mudaram entre as leituras. Havendo atividade concorrente ou mudança de dia/mês, recapturar uma base coerente antes de decidir. Os vários blocos do dashboard não são um snapshot global único; financeiro e fidelidade têm leituras próprias, e a API de fidelidade é outra consulta.
8. Registrar resultado e revisão, com provas sanitizadas. Não processar filas, reenviar webhooks, estornar compras, classificar pedidos ou alterar carteira para obter igualdade.

## 3. Conferência financeira

Escopo: pedidos da loja **sem classificação explícita de teste**. Aplicar a política de fatos válidos, identidades de pedido/tentativa/instrumento/conta e revisão. Não somar cegamente todas as linhas de `FinancialFact`, nem inferir liquidação a partir de `PAID`.

| Campo | Apuração / condição |
|---|---|
| `recognizedGross` | Valor reconhecido por instrumento válido, sem contar autorização e liquidação duas vezes. |
| `settledGross` | Somente liquidação confirmada por fato próprio; autorização de cartão não basta. |
| `confirmedRefunds` | Somente devoluções confirmadas, com a identidade/proveniência e deduplicação previstas no contrato; solicitação/cancelamento de estorno não basta. |
| `netRecognized` | Reconhecido menos estornos registrados no período; pode ser negativo em um período. Não é lucro ou saldo disponível. |
| `today`, `month`, `allTime` | Data de registro `FinancialFact.createdAt`, Brasília, até o corte da apuração. Não usar data de criação do pedido, vencimento ou `paidAt` como substitutos. |
| `coverage`, `unverifiedOrders`, `financialReviewOrders` | Sinalizar evidência ausente/revisão conforme a política. `PARTIAL` pode ser o resultado correto; não forçar `COMPLETE`. |
| Composição | Produtos após descontos, frete, encargos e reconhecido sem composição completa devem somar o reconhecido histórico antes dos estornos. Não ratear devolução por produto/frete sem prova. |
| Pendente/cancelado sem pagamento | Separar obrigação pendente e cancelamento sem reconhecimento de estorno de pagamento. |
| Ticket/conversão | Ticket após estornos por pedido com reconhecimento; conversão por reconhecimento, não apenas contagem de status `PAID`. |

Fonte do contrato: `services/dashboard-financial.service.ts` e `lib/commerce/financial-evidence.ts`. Fonte histórica independente: [conferência de homologação](evidencias/L-DASHBOARD-CONFERENCIA-HML-2026-10-16.json), seção 56 do plano. Em nova apuração, agrupar/validar as identidades antes de agregar; preservar revisão e subtotal conhecido se houver inconsistência.

### Referência histórica, não resultado esperado fixo

Snapshot de **16/10 às 17:42:15 BRT**, oito pedidos, 34 fatos, sem classificações. Os seguintes números só podem ser reutilizados depois de demonstrar que os dados relevantes continuam equivalentes:

| Medida | Hoje naquele dia | Mês / histórico naquele snapshot |
|---|---:|---:|
| Reconhecido bruto | R$ 0,00 | R$ 542,67 |
| Liquidação bruta | R$ 0,00 | R$ 124,75 |
| Estornos confirmados | R$ 0,00 | R$ 417,92 |
| Reconhecido menos estornos | R$ 0,00 | R$ 124,75 |

Composição corrigida: produtos **R$ 419,15**, frete **R$ 12,30**, encargos **R$ 61,32**, sem composição completa **R$ 49,90**. Cobertura **PARTIAL**, um pedido em revisão (#3). Pendente R$ 49,90 (#8); cancelados sem reconhecimento R$ 99,80 (#2/#7); ticket R$ 24,95; conversão 63% (cinco reconhecidos entre oito).

Se a situação do #3 ainda for `PAYMENT_REFUND_CANCELLED_REVIEW`, seu reconhecimento/liquidação de R$ 49,90 permanece e seu estorno confirmado é zero; deve haver aviso de revisão. A tela antiga de `eff10bf` mostrava `COMPLETE` e composição diferente: isso foi corrigido posteriormente. #4/#5 têm estornos confirmados sem fato de liquidação naquele snapshot; não inventar liquidação. Não repetir seus estornos.

## 4. Conferência de fidelidade

**Não há baseline numérico remoto novo de fidelidade nesta ficha.** Os 475 pontos do clone de abertura e os saldos vistos em screenshots antigos não servem como expectativa da homologação atual.

| API `data.metrics` | Apuração independente |
|---|---|
| `totalCirculatingPoints` | Soma de `LoyaltyWallet.balance` de todas as carteiras da loja. |
| `totalDebtPoints` | Soma das dívidas registradas nas carteiras da loja. Não compensar/ocultar com o saldo. |
| `totalLifetimeEarnedPoints` | Soma do acumulador `lifetimeEarn` das carteiras; zero é válido. Não reconstruir pelo ledger legado nem chamar de concessões brutas. |
| `activeCustomersWithPoints` | Quantidade de carteiras da loja com saldo positivo. Não confundir com total de clientes cadastrados. |
| `legacyWallets` | Quantidade com `accountingReady=false`; exibir aviso quando positiva. |
| `projectedFinancialLiability` | Estimativa do saldo pela cotação atual e arredondamento da função vigente; não reprecifica resgates antigos nem comprova disponibilidade de resgate. |

Para `commercial`, considerar somente movimentos da loja vinculados a pedidos da mesma loja, sem exclusão explícita de teste. Não filtrar por `PAID`: resgate de pontos registrado no checkout não prova pagamento em dinheiro.

| Campo de `commercial` | Apuração |
|---|---|
| `earnedPoints` / `reversedEarnedPoints` | Soma de pontos `EARN` / negativo da soma de `REFUND_EARN`. |
| `redeemedPoints` / `returnedPoints` | Negativo da soma de `REDEEM` / soma de `REFUND_REDEEM`. |
| `netRedeemedPoints` | Resgatados menos devolvidos. |
| `redeemedValue` / `returnedValue` | Soma dos `monetaryValue` históricos conhecidos de `REDEEM` / `REFUND_REDEEM`. Não multiplicar resgates antigos pela cotação atual. |
| `netRedeemedValue` | Valor resgatado menos valor devolvido. |
| `missingMonetaryValues` | Quantidade de resgates/devoluções comerciais com valor histórico ausente (`null`, diferente de zero). |
| `unlinkedTransactions` | Movimentos EARN/REFUND_EARN/REDEEM/REFUND_REDEEM da loja sem pedido ou ligados a pedido de outra loja. |
| `coverage` | `PARTIAL` se houver valores históricos ausentes ou movimentos sem vínculo válido; reais exibidos são subtotais conhecidos. Caso contrário, `COMPLETE`. |

Carteiras e últimas movimentações incluem ajustes e histórico de testes. A exclusão comercial não reduz saldo/dívida nem apaga histórico. `legacyWallets` tem aviso próprio: não exige, sozinho, `commercial.coverage=PARTIAL`. Movimentos explicitamente associados a pedido de teste devem aparecer identificados como tal no histórico quando estiverem entre os registros exibidos.

### Igualdade entre API, página e widget

- Na API: `metrics.totalRedeemedMonetaryValue`; no widget/DTO: `totalRedeemedMonetaryDiscount`. Ambos correspondem ao **bruto histórico**, antes de devoluções.
- API `activeCustomersWithPoints` corresponde ao `activeWalletsCount` do widget. Os campos de `commercial`, saldo, dívida e acumulador devem coincidir para o mesmo estado, respeitado o cache.
- Página de fidelidade consulta até dez movimentos recentes; widget mostra até cinco. Comparar os cinco correspondentes e a ordenação, não exigir listas do mesmo tamanho. Não compartilhar nomes/e-mails/descrições pessoais.
- Avisos de apuração parcial e carteiras legadas devem corresponder à base. Se não houver caso aplicável, registrar **não aplicável ao baseline**, com referência aos testes isolados; não fabricar dados no ambiente compartilhado.

Fonte do contrato: `services/loyalty-report.service.ts`, `services/dashboard.service.ts` e `components/admin/loyalty/LoyaltyCommercialSummary.tsx`. Provas isoladas: [fidelidade](evidencias/L-FIDELIDADE-RELATORIO-2026-10-16.json) e [clone da candidata atual](evidencias/L-G2-REVISAO-ABERTURA-2026-10-16.json).

## 5. Apresentação e acesso

| Verificação | Condição de aprovação |
|---|---|
| `/admin`, desktop e largura de 390 px | Quatro indicadores por período, composição e avisos legíveis; sem corte de valores ou rolagem horizontal da página. |
| `/admin/fidelidade`, desktop e 390 px | Saldo, bruto/devolvido/diferença e avisos visíveis, consistentes com a API. Não operar ajuste manual ou salvar parâmetros. |
| Erros | Nenhum erro de API/servidor escondido por zeros ou sucesso visual. API em erro implica resultado inconclusivo/reprovado, não saldo zero confirmado. |
| Sessão anônima separada | Sem acesso aos dados administrativos; registrar redirecionamento/recusa. Não alterar permissões nem testar com credenciais de terceiros. |
| Após logout | Redirecionamento no mesmo host e perda do acesso autenticado; preservar as correções de Vanderlei. |
| Screenshots e Rede | Recortar/ocultar nomes, e-mails, cookies, tokens e URLs com query secreta. Não anexar HAR ou payload completo. |

Não procurar uma API de dashboard inventada: `/admin` renderiza dados no servidor. Usar os valores exibidos e o baseline independente. Os seletores existentes `financial-{today|month|allTime}-{recognizedGross|settledGross|confirmedRefunds|netRecognized}`, `financial-composition-*`, `financial-coverage` e `loyalty-commercial-summary` permitem localizar os campos para uma automação futura.

## 6. Decisão e encaminhamento

**APROVADO NESTE ESCOPO:** identidade da candidata/loja comprovada, baseline atual coerente, todos os campos aplicáveis comparados sem divergência não explicada, API/páginas/widget consistentes e acesso/apresentação aprovados. A revisão do #3 pode permanecer aberta enquanto o relatório a representa corretamente; aprovação do relatório não encerra a operação financeira.

**PENDENTE:** publicação/identidade/baseline ausentes, atividade concorrente impede comparar, erro de acesso impede observar ou prova de algum item ainda não coletada. **REPROVADO:** candidata correta e base coerente mostram erro de cálculo, cobertura, escopo, exposição de dados ou apresentação indispensável. Registrar campo/erro e evidência; não corrigir o banco para fazer a tela coincidir.

No registro, cada comparação deve conter `id`, campo, período/escopo, esperado, observado, diferença, resultado e referência da prova. Preencher responsáveis, horários e limites. Não marcar G3/G4/G8 inteiros como encerrados por esta ficha: execução automática, abertura produtiva, devoluções pendentes e demais critérios continuam no checklist.

**Próxima ação quando houver publicação:** receber de Vanderlei SHA/digest/revisão/URL efetivos e confirmar a loja; então capturar o baseline e executar esta rodada única. Nenhuma nova compra, confirmação de pagamento, devolução ou processamento de fila é necessária para este aceite de relatório.
