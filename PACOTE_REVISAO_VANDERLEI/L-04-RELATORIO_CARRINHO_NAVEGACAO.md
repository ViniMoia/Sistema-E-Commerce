# L-04 — Investigação do primeiro clique e da lentidão na navegação

Data: 14/10/2026. Levantamento original: `homologacao_teste`, HEAD `117ec92`. Comparação somente leitura com a referência local `origin/main`, `7f9b26e`. O levantamento não alterou a aplicação. Após autorização do usuário, as correções locais abaixo foram implementadas; ainda sem publicação. Main e os bancos da aplicação permanecem sem alterações.

## Implementação local após autorização

- Separação de consulta e mutação no carrinho: leitura em segundo plano não desabilita o botão de inclusão. Uma inclusão aguarda a leitura já em andamento e usa sua revisão atualizada.
- Abertura imediata da estrutura do painel com “Atualizando carrinho...”, sem apresentar inclusão como concluída antes da resposta. Animação reduzida somente neste painel para 150 ms, com respeito à redução de movimento.
- Reaproveitamento do retrato validado por até 5 segundos ao abrir o painel. A inclusão em andamento não dispara um GET extra. Eventos de foco e outra aba continuam consultando o servidor; leituras simultâneas são agrupadas.
- Recuperação com o mesmo comando também para resposta ilegível e erro de transporte. Resultado ainda incerto bloqueia novas alterações diferentes e a ida ao checkout; “Conferir alteração” repete o comando existente. O comando fica na sessão do navegador, separado por loja/usuário, para sobreviver a recarga; se esse armazenamento estiver bloqueado, a recuperação fica limitada à memória da página. Conflitos conhecidos não são reaplicados automaticamente.
- Prazo de 15 segundos por requisição do carrinho. O timeout não é tratado como prova de que a alteração não ocorreu.
- Remoção de `router.refresh()` disparado pelo carrinho e de consultas do provedor nas rotas Admin. O checkout com carrinho conhecido continua acessível durante uma simples consulta de fundo; mutações e resultados incertos impedem essa navegação.
- Admin com `loading.tsx`, consulta do nome da loja compartilhada na mesma renderização e cache que agrupa cálculos concorrentes do mesmo tenant. Invalidação durante um cálculo impede que o resultado antigo repovoe o cache.
- Diagnóstico HTTP com `X-Request-Id`, `Server-Timing` e logs de método/status/duração; diagnóstico de resultado incerto no navegador sem payloads, cookies ou dados de pagamento.

Limites: a revisão de conflito continua exigindo conferência dos itens; a causa específica do incidente original segue desconhecida. Paginação do catálogo, animação do cabeçalho, redução das 18 operações de métricas e troca da navegação de documento do checkout permanecem propostas para uma etapa posterior, com medição de latência real. O `loading.tsx` melhora o feedback, mas ainda aguarda a autorização e os dados necessários ao layout. Não há promessa de latência da Vercel baseada nos testes locais.

As seções seguintes preservam os achados do levantamento original, incluindo os testes diagnósticos anteriores à correção.

### Validação das correções

- 51 testes unitários de estado do carrinho, recuperação, isolamento por identidade, cache, dashboard e diagnóstico HTTP passaram. Incluem retry após resposta ilegível, preservação do comando após rejeição de uma tentativa de recuperação, recarga da página e clique duplo no botão de recuperação.
- 11 testes de navegador passaram em PostgreSQL e servidor Next descartáveis: 7 de checkout e 4 do carrinho. A inclusão com resposta retida apresentou o painel antes de liberar a resposta, bloqueou conclusão enquanto pendente, enviou somente um POST após dois cliques e não fez GET redundante após concluir.
- TypeScript sem erros. ESLint sem erros nos arquivos verificados; permanecem os avisos já existentes de imagens `<img>` e navegação por documento para o checkout.
- Antes do envio à branch de homologação, `node scripts/verify-isolated-build.mjs` concluiu o build de produção com sucesso, em cópia temporária sem `.env` e com PostgreSQL descartável.
- A primeira rodada de navegador detectou que uma janela fixa de agrupamento de foco suprimia atualização legítima; ela foi removida. A rodada seguinte passou mantendo apenas a união de leituras simultâneas. Um seletor do novo teste também foi corrigido para observar especificamente o diálogo aberto.
- Não houve teste de latência do Preview, publicação, mudança na main, processamento de filas ou acesso aos bancos reais durante esta implementação.

## Conclusão

Há mecanismos concretos no código que atrasam a interação: consultas do carrinho bloqueiam o botão de compra, a abertura automática aguarda a gravação no servidor, a animação de abertura dura 500 ms e o provedor do carrinho solicita atualizações gerais da página. O dashboard aguarda um conjunto de 18 operações Prisma antes de apresentar seu conteúdo.

A hipótese de que o produto ainda não havia carregado não encontra suporte no fluxo examinado: o detalhe recebe o produto e suas variantes do catálogo já carregado, sem uma nova busca ao abrir. Isso não garante que o estoque desse retrato continue atualizado no servidor.

O erro exato do primeiro clique permanece sem confirmação: não temos a resposta HTTP nem o log daquela ocorrência. Reproduzimos em teste um caminho compatível: versão desatualizada → conflito → atualização do carrinho → segunda tentativa bem-sucedida. O bloqueio durante uma consulta, por si só, não produz o aviso de erro relatado.

## Achados e propostas

### 1. Primeiro clique falha e o segundo funciona — prioridade alta

**Evidência:** `store/cart.store.ts:64` envia `cartId` e `expectedVersion` do estado local. Se esse estado estiver marcado como pronto, não faz uma consulta prévia. `services/cart.service.ts:72` rejeita carrinho consumido, identidade divergente ou versão desatualizada. Ao receber erro, o cliente consulta o estado atual e depois apresenta o erro. Uma segunda tentativa passa a usar os dados atualizados.

O teste diagnóstico reproduziu exatamente a sequência `GET → POST 409 → GET → POST 200`. Isso demonstra a possibilidade, sem atribuir esse status à ocorrência real. Falha de rede, sessão, validação de estoque ou erro do servidor ainda precisam ser diferenciados.

**Problema adicional reproduzido:** se o POST for aplicado, mas sua resposta não puder ser interpretada como JSON, a consulta de recuperação pode trazer o item incluído e, mesmo assim, o fluxo informar erro. Um novo clique gera outro `commandId` e pode adicionar outra unidade. O retry com o mesmo comando já existe para rejeição do `fetch`, mas não cobre todos os erros na leitura da resposta.

**Proposta:** preservar a identidade da intenção até resolver resultados ambíguos, distinguir conflito conhecido de resultado desconhecido e utilizar o recibo do comando para recuperação. Manter a validação de revisão, identidade e estoque. Não transformar todo erro em repetição automática nem remover o controle de versão. Exibir mensagens específicas com base no código retornado pela API.

### 2. Consulta de fundo bloqueia a compra — prioridade alta

**Evidência:** `HomeClient.tsx:70` usa `isLoading` da store como `isAddingToCart`; esse mesmo estado é ativado por leituras e escritas (`store/cart.store.ts:33`). O botão fica desabilitado e mostra “Adicionando...” inclusive durante um GET (`HomeClient.tsx:359`). Confirmado por teste com leitura pendente controlada.

**Proposta:** separar os estados de consulta, inclusão e resolução de conflito. Um clique deve receber resposta visual imediata; se for necessário atualizar o carrinho, registrar uma única intenção e mostrar “Atualizando carrinho...”, prosseguindo apenas após validação. Conservar a serialização das mutações e impedir inclusão duplicada.

### 3. Abertura do carrinho acumula esperas — prioridade alta

**Evidência:** `HomeClient.tsx:177` aguarda `addToCart()` antes de `setIsOpen(true)`. Após abrir, `CartDrawer.tsx:23` pede outro GET, mesmo tendo recebido um retrato completo no POST. Esse GET não impede necessariamente o primeiro desenho do painel, mas mantém indicadores e controles em carregamento. `components/ui/sheet.tsx:34` configura 500 ms para a animação de abertura.

O ícone do cabeçalho tem outro comportamento: `CartButton.tsx:22` solicita a abertura imediatamente. Portanto, a demora após incluir um produto e a demora ao clicar no ícone precisam ser medidas separadamente. O componente também é carregado dinamicamente; falta medir se seu arquivo JavaScript estava disponível no primeiro clique.

**Proposta:** abrir a estrutura do painel imediatamente com estado explícito de inclusão pendente, confirmar o item somente depois da gravação, reaproveitar o retorno validado do POST e consultar novamente apenas quando necessário. Reduzir a animação para aproximadamente 150–200 ms, respeitando redução de movimento. Preparar o componente antes da interação caso a medição confirme atraso de download.

### 4. Carrinho provoca atualizações da página inteira — prioridade alta

**Evidência:** `CartProvider.tsx:25` executa GET do carrinho e `router.refresh()` ao montar, recuperar foco, receber `pageshow`, mudar visibilidade e receber invalidação de outra aba. Apenas `/checkout` está excluído do refresh geral. O provedor envolve também o Admin (`app/layout.tsx:39`). As leituras simultâneas são agrupadas pela store, mas não existe coordenação equivalente explícita para o refresh da rota.

**Proposta:** atualizar somente os dados afetados por uma mudança no carrinho, agrupar eventos próximos e dispensar consultas de carrinho em telas administrativas que não o utilizem. Conservar a verificação de sessão, loja e atualizações entre abas. Testar especialmente foco, navegação de volta e conclusão de compra.

### 5. Entrada no Admin aguarda todas as métricas — prioridade alta

**Evidência:** `app/admin/page.tsx:46` aguarda `getAggregatedDashboardMetrics()` antes do conteúdo. `services/dashboard.service.ts:96` inicia 18 operações Prisma com `Promise.all`. São operações paralelas, não 18 consultas sequenciais; cada operação pode gerar mais de uma instrução SQL. Não há `loading.tsx` nas rotas examinadas.

O cache de 60 segundos (`lib/cache.ts:90`) vive em memória de cada processo e não compartilha uma promessa em andamento entre requisições concorrentes. Uma instância nova ou cache expirado exige recalcular os indicadores. Região, pool, contenção e inicialização da Vercel são hipóteses a medir, não causas comprovadas.

O layout e seus metadados consultam separadamente o nome da loja (`app/admin/layout.tsx:16` e `:45`). Já `getCurrentUser` usa memoização de React; sua repetição no código não comprova repetição da consulta na mesma renderização.

**Proposta:** adicionar carregamento visual da rota e separar blocos do dashboard com carregamento progressivo, preservando autorização antes de exibir dados. Agrupar consultas realmente redundantes, compartilhar consultas simultâneas do mesmo tenant e definir invalidação do cache após alterações relevantes. Medir antes de criar índices ou mudar infraestrutura. O link atual já utiliza `next/link`: trocar a tag não resolve esse gargalo.

### 6. Catálogo inteiro é enviado ao navegador — prioridade média

**Evidência:** `app/page.tsx:16` solicita `all: true` e envia descrições, galerias e variantes ao componente cliente. `services/product.service.ts:77` remove o limite nessa modalidade. O custo cresce com o catálogo, inclusive em novos renders provocados por refresh. Não foi medido o tamanho da transferência real neste atendimento.

**Proposta:** paginação e filtros no servidor, com carregamento sob demanda dos detalhes e antecipação quando útil. Preservar buscas, filtros, URLs e seleção de variantes. Uma eventual busca de detalhes deve ter estado de carregamento explícito para não introduzir o problema que o usuário suspeitou.

### 7. Outros atrasos visuais e de navegação — prioridade média

- `ConditionalHeader.tsx:39`: o cabeçalho da home depende do evento da animação ou do scroll, com fallback de 4 segundos e transição de 700 ms. Isso pode atrasar o acesso inicial ao Admin e carrinho; não explica sozinho a espera depois de clicar em um link já visível. Proposta: manter navegação essencial disponível independentemente da animação decorativa.
- `CartDrawer.tsx:90`: a ida ao checkout usa `window.location.assign`, fazendo navegação de documento completo. O comentário registra uma correção para corrida com refresh do catálogo. Proposta: resolver essa corrida primeiro e só então avaliar navegação cliente com testes de regressão; uma troca isolada pode reintroduzir o defeito anterior.

## Comparação com main

O carregamento integral do catálogo, a espera pelas métricas do dashboard, o cache em memória e a animação de 500 ms já estão presentes na referência de main consultada. A homologação acrescenta o protocolo de comandos/revisões do carrinho, os refreshes globais do provedor e a navegação de documento ao checkout. Essas diferenças incluem proteções de integridade e correções anteriores: importar o carrinho antigo de main não é a solução proposta.

## Validação executada e limites

Comando: `npx vitest run tests/unit/cart-client-state.test.ts tests/unit/cart-report-diagnostic.test.ts`.

Resultado: **20 testes passaram** — 17 existentes e 3 diagnósticos novos. Os novos casos verificam conflito seguido de segunda tentativa, bloqueio durante GET de fundo e resultado ambíguo após falha na leitura do JSON. Utilizam transporte simulado e não acessam bancos ou o Asaas.

Foi consultado o guia da versão instalada de Next em `node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md`, especialmente navegação dinâmica e `loading.tsx`.

Os testes validam mecanismos de estado, não medem a latência real da Vercel nem comprovam a causa do incidente. Não foram capturados HAR, perfil de renderização ou tempos de consultas da sessão do usuário. Não há base para atribuir uma quantidade de segundos a cada gargalo ou prometer um ganho percentual.

## Ordem recomendada de correção

1. Instrumentar o caminho do clique: identificador da requisição, status/código de erro, espera da fila, autenticação, consulta/gravação e leitura da resposta; não registrar cookies, dados pessoais ou payloads de pagamento.
2. Corrigir recuperação de resultado ambíguo, separar carregamento de leitura/inclusão e dar retorno visual imediato, mantendo idempotência e revisão.
3. Eliminar refreshes gerais desnecessários e o GET redundante após inclusão; ajustar a abertura do painel.
4. Tornar a entrada no Admin progressiva e reduzir trabalho repetido de consultas/cache.
5. Otimizar catálogo e reavaliar a navegação ao checkout após eliminar a corrida conhecida.

Critérios propostos de aceite: resposta visual ao clique em até 100 ms no dispositivo de referência; nenhuma unidade duplicada por recuperação de uma mesma intenção; mensagens específicas para conflitos; nenhuma atualização geral da rota disparada apenas por abrir o carrinho; e comparação de tempos p50/p95 de navegação e API, separando primeira visita de visitas aquecidas. Esses valores são metas para a próxima etapa, não resultados já atingidos.
