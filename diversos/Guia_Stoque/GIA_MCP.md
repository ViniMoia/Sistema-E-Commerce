Excelente! A definição do papel de cada MCP garante que nenhum passo seja executado "no escuro", eliminando suposições e blindando o projeto com auditoria em tempo real, análise prévia de riscos e validação prática.

Abaixo está a matriz operacional detalhada definindo a responsabilidade exata de cada um dos nossos 4 MCPs nas 5 fases da integração:

Matriz Operacional dos MCPs por Fase
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             ORQUESTRAÇÃO COM RUFLO                               │
├───────────────────┬───────────────────┬───────────────────┬──────────────────────┤
│ Sequential        │ PostgreSQL        │ Git               │ Puppeteer            │
│ Thinking MCP      │ MCP               │ MCP               │ MCP                  │
├───────────────────┼───────────────────┼───────────────────┼──────────────────────┤
│ 🧠 Planejamento    │ 🐘 Auditoria      │ 🐙 Isolamento     │ 🎭 Validação         │
│ e Resolução de    │ e Consistência    │ e Checkpoints     │ Visual e             │
│ Concorrência      │ de Dados Reais    │ de Segurança      │ Testes E2E           │
└───────────────────┴───────────────────┴───────────────────┴──────────────────────┘
Fase 1: Ativação Segura do .env & Teste de Conexão na Nuvemshop
Objetivo: Inserir com segurança as credenciais oficiais (Store ID: 8179726 e Token: 6712c8...) e comprovar a comunicação em tempo real com a loja da distribuidora.
O que cada MCP fará nesta fase:
🧠 Sequential Thinking MCP: Valida os formatos dos parâmetros, estrutura de headers (User-Agent, Authentication: bearer) e antecipa possíveis respostas de rate limit ou permissões antes de qualquer requisição.
🐘 PostgreSQL MCP: Executa uma query de leitura na tabela Loja para confirmar se o registro da loja padrão corresponde ao NEXT_PUBLIC_LOJA_ID configurado no .env.
🐙 Git MCP: Cria uma branch dedicada de integração (feature/nuvemshop-live-integration) e valida que nenhum arquivo com credenciais (.env, .mcp.json) esteja exposto para commits acidentais.
🎭 Puppeteer MCP: Acessa o painel administrativo /admin/integration e tira um screenshot do estado inicial da integração para servir como linha de base (baseline) comparativa.
Critério de Aceite da Fase 1: Resposta HTTP 200 OK na leitura da API da loja 8179726 retornando os dados cadastrais da distribuidora.
Fase 2: Conciliação e Mapeamento de Catálogo (Loja Física ➔ E-commerce)
Objetivo: Vincular os produtos cadastrados no e-commerce aos produtos que já estão na Nuvemshop/SMB Store, preenchendo o nuvemshopProductId.
O que cada MCP fará nesta fase:
🧠 Sequential Thinking MCP: Modela a lógica de correspondência de produtos (por SKU exato, código de barras EAN ou título), definindo como lidar com produtos sem SKU ou variações (ProductVariants) para evitar qualquer duplicação de registros.
🐘 PostgreSQL MCP: Audita a tabela Product antes da sincronização (contando quantos produtos existem e quantos têm SKU) e re-executa a query após o processo para auditar se os nuvemshopProductId foram vinculados corretamente.
🐙 Git MCP: Registra um commit atômico das regras de mapeamento e do serviço de catálogo validado.
🎭 Puppeteer MCP: Navega até /admin/products e /admin/integration, dispara a conciliação manual pelo botão da interface e valida visualmente o carregamento da lista de produtos mapeados.
Critério de Aceite da Fase 2: 100% dos produtos coincidentes com nuvemshopProductId preenchidos e validados diretamente nas tabelas do Postgres.
Fase 3: Registro e Ativação do Webhook de Estoque em Tempo Real
Objetivo: Habilitar a recepção de eventos de alteração de estoque do SMB Store físico via webhook (inventory/updated, product/updated).
O que cada MCP fará nesta fase:
🧠 Sequential Thinking MCP: Modela a segurança do webhook em profundidade: validação da assinatura HMAC com crypto.timingSafeEqual, guarda de idempotência via nuvemshopEventId e garantia de resposta 200 OK em < 100ms.
🐘 PostgreSQL MCP: Inspeciona a tabela StockSyncLog para verificar se os eventos recebidos estão sendo gravados com o estoque anterior (previousStock), o novo estoque (newStock), timestamp e metadata corretos.
🐙 Git MCP: Cria um commit específico e isolado da rota /api/webhooks/nuvemshop e seus middlewares de proteção contra flood.
🎭 Puppeteer MCP: Acessa o painel /admin/integration para validar em tempo real o contador de eventos processados no feed de logs da tela.
Critério de Aceite da Fase 3: Simulação de um webhook recebido com sucesso, assinatura validada, log gravado na tabela StockSyncLog e estoque do site atualizado instantaneamente.
Fase 4: Pipeline de Pedidos Bidirecional (E-commerce ➔ Loja Física)
Objetivo: Garantir que quando um cliente comprar no site, o pedido seja despachado para a Nuvemshop/SMB Store para abater o estoque da loja física automaticamente.
O que cada MCP fará nesta fase:
🧠 Sequential Thinking MCP: Modela o ciclo de estados do pedido (PENDING ➔ SYNCED ou ➔ DEAD_LETTER em caso de erro da rede externa), incluindo a política de retry exponencial e a trava de idempotência (idempotencyKey).
🐘 PostgreSQL MCP: Monitora as tabelas Order, OrderItem e OrderStatusHistory, auditando a gravação do nuvemshopOrderId, a contagem de tentativas (syncAttempts) e o status de sincronização (syncStatus).
🐙 Git MCP: Cria um commit atômico do serviço de despacho de pedidos (order-sync.service.ts).
🎭 Puppeteer MCP: Abre o navegador em modo headless, adiciona um produto ao carrinho, preenche os dados de checkout simulado e conclui a compra para testar o fluxo ponta a ponta na interface.
Critério de Aceite da Fase 4: Pedido de teste criado no e-commerce reflete no sistema da loja com status SYNCED e o estoque correspondente é decrementado no banco.
Fase 5: Observabilidade, Auditoria de Integridade e Go-Live
Objetivo: Consolidar a telemetria, validar o Health Score da integração e garantir estabilidade para operação contínua.
O que cada MCP fará nesta fase:
🧠 Sequential Thinking MCP: Executa análise de estresse e resiliência: valida como o sistema se comporta caso a API da Nuvemshop fique offline (abertura correta do Circuit Breaker e enfileiramento na DLQ sem afetar o cliente do site).
🐘 PostgreSQL MCP: Executa uma varredura geral de integridade referencial no banco, conferindo ausência de registros órfãos nas tabelas de sincronização e auditoria.
🐙 Git MCP: Prepara o merge seguro da branch de desenvolvimento para a branch de produção com histórico limpo e rastreável.
🎭 Puppeteer MCP: Gera os screenshots finais do painel /admin/integration exibindo o Health Score em 100%, sem pendências em Dead-Letter Queue.
Critério de Aceite da Fase 5: Relatório completo de integridade gerado com 100% dos testes e verificações aprovados.