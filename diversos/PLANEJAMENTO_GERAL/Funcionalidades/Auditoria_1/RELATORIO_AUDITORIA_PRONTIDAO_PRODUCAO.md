# Auditoria de Prontidão para Produção

**Projeto:** E-Commerce Multi-Tenant & Plataforma Continental Produtos Estéticos Automotivos  
**Auditor Líder:** Staff Software Engineer, Software Architect & Tech Lead  
**Data da Auditoria:** 17 de Setembro de 2026  
**Ambiente Auditado:** Local (Windows 11 / Node.js v22.15.0 / Next.js 16.3.5 Turbopack) & Nuvem Supabase PostgreSQL (`aws-1-us-east-1.pooler.supabase.com`)  
**Commit Base:** `Branch main`  
**Localização do Relatório:** `diversos/PLANEJAMENTO_GERAL/Funcionalidades/Auditoria_1/RELATORIO_AUDITORIA_PRONTIDAO_PRODUCAO.md`  
**Status Consolidado de Prontidão:** **NÃO APTO PARA PRODUÇÃO (BLOQUEADORES CRÍTICOS E PENDÊNCIAS ESTRUTURAIS IDENTIFICADOS)**

---

## 1. Resumo Executivo

### 1.1 Estado Geral do Projeto
A plataforma do e-commerce Continental demonstra uma evolução técnica expressiva nas camadas estruturais. Observa-se a aplicação rigorosa de padrões de engenharia de software corporativa:
1. **Camada de Dados e Modelagem:** 20 migrações do Prisma (`prisma/migrations`) totalmente aplicadas e sincronizadas no PostgreSQL do Supabase, com índices compostos de alta performance (`[lojaID, status, paidAt]`, `[geocom, weightMin, weightMax]`, `[cpfCnpj, lojaID]`).
2. **Qualidade e Testes:** 36 suítes de testes unitários com **243 testes automatizados aprovados (100% de sucesso)**, cobrindo cenários de integridade contábil (`Prisma.Decimal`), isolamento multi-tenant, vetores de BOLA/IDOR e travas de máquina de estados finitos (FSM).
3. **Frontend e Design System:** Identidade visual sofisticada (Continental Dark / Dourado `#DDAF02`), totalmente responsiva, com dashboard administrativo recém-equipado com indicadores de recebimento diário, mensal e histórico, além de discriminação proporcional integrada de frete vs. produtos líquidos.

### 1.2 Principais Conclusões
Apesar do alicerce técnico maduro, **o sistema ainda NÃO reúne condições factuais de entrar em produção**. A auditoria identificou que etapas cruciais de conexão com o mundo real e fechamento de ciclo de negócio estão incompletas ou ausentes:
- **Segredos e Credenciais de Produção Inexistentes:** O arquivo `.env` ativo conta apenas com chaves de banco de dados e Supabase. Faltam chaves do gateway Asaas (`ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN`), chave de envio de e-mails (`RESEND_API_KEY`), segredo de sessão (`SESSION_SECRET`) e URLs de domínio da aplicação.
- **Conta Bancária e Liquidação Financeira Desconectadas:** O sistema não possui cadastro ou integração com conta bancária para saque/transferência de valores liquidados no Asaas.
- **Motor de Pontos e Fidelidade Inacabado:** O ciclo de vida dos pontos possui lacunas graves: ausência completa de rotina de expiração (`EXPIRATION`), falta de política para cancelamento de pedidos não pagos que resgataram pontos (pontos ficam retidos em pedidos abandonados) e ausência de notificações ao cliente.
- **Funcionalidades de Interface Desconectadas do Backend (Mocks):** A edição de dados cadastrais no perfil do cliente (`ProfileForm.tsx`) possui botão sem ação (estático) e o upload de foto de avatar (`app/profile/actions.ts`) é uma simulação falsa com `setTimeout`. O cadastro de produtos não suporta upload direto de arquivos (apenas URLs externas).
- **Inexistência de Comunicação Transacional por E-mail:** O cliente não recebe e-mail de confirmação de pedido, aprovação de pagamento ou envio de rastreamento. A recuperação de senha falha silenciosamente pela falta de `RESEND_API_KEY`.
- **Fragilidade Operacional dos Correios:** O cálculo de frete dos Correios consome um webservice XML legado (`CalcPrecoPrazo.aspx`) descontinuado pela estatal, sujeito a bloqueio ou instabilidade repentina.

### 1.3 Maiores Riscos à Operação
1. **Risco Financeiro / Bloqueio de Checkout (P0):** A ausência de `ASAAS_API_KEY` e `ASAAS_WEBHOOK_TOKEN` em produção impede a emissão de PIX dinâmico e faz o webhook operar em Fail-Closed (rejeitando confirmações de pagamento).
2. **Risco de Retenção Indevida de Saldo de Pontos (P1):** Clientes que iniciam checkout resgatando pontos e não concluem o pagamento têm seus pontos debitados da carteira sem estorno automático por timeout.
3. **Risco de Atendimento ao Cliente / Pós-Venda (P1):** Sem e-mails transacionais e sem mensagens automáticas de status, 100% da carga de pós-venda recai sobre mensagens manuais de WhatsApp.
4. **Risco de Escalabilidade do Rate Limiting e Cache (P2):** O controle de taxa e o cache de configurações operam em memória local (`Map`), tornando-se ineficazes em ambientes distribuídos ou serverless com múltiplas instâncias.

### 1.4 Limitações da Auditoria
- Os testes de integração de banco (`tests/integration`) e carga (`tests/load`) não foram executados contra a base Supabase ativa, em obediência à trava de segurança deliberada do projeto (`tests/setup/db.ts`), que bloqueia mutações destrutivas em bancos de nuvem sem sufixo `_test`.
- Não foram executadas transações financeiras reais contra a API de produção do Asaas devido à ausência das credenciais corporativas no ambiente.

### 1.5 Conclusão Factual sobre o Nível de Prontidão
> [!WARNING]
> **Conclusão:** O sistema **NÃO ESTÁ PRONTO PARA PRODUÇÃO**. Embora a arquitetura central e os fluxos de catálogo, carrinho e banco de dados estejam em nível avançado de maturidade, a entrada em produção imediata provocaria falha no processamento de pagamentos reais, impossibilidade de recuperação de senhas, retenção incorreta de saldos de fidelidade e sobrecarga do lojista por ausência de comunicação automatizada. O go-live deve ser condicionado à execução do Roadmap priorizado neste documento.

---

## 2. Contexto e Escopo

### 2.1 Objetivo da Auditoria
Realizar uma varredura exaustiva, estritamente baseada em evidências de código, banco de dados, configuração e infraestrutura, para mapear o estado real de cada funcionalidade e estabelecer o plano definitivo de finalização para lançamento em produção.

### 2.2 Escopo Analisado
- **Código-Fonte:** Camadas frontend (`app/`, `components/`, `hooks/`, `store/`), serviços de backend (`services/`), utilitários e segurança (`lib/`), contratos e tipagens (`types/`).
- **Banco de Dados:** Schema relacional (`prisma/schema.prisma`), histórico de 20 migrações (`prisma/migrations`), triggers, índices e integridade referencial.
- **Segurança & OWASP:** Autenticação por sessão, autorização administrativa, isolamento multi-tenant, defesas contra BOLA/IDOR, validação de entrada Zod e rate limiting.
- **Integrações Externas:** Asaas (PIX e Webhooks), Correios, J&T Express, ViaCEP, Resend (E-mails).
- **Configurações e Qualidade:** Scripts de build, TypeScript (`tsc --noEmit`), ESLint (`eslint .`), Vitest (testes unitários e de integração), headers HTTP de produção em `next.config.js`.

### 2.3 Escopo Não Verificável no Ambiente Atual
- Conexão bancária real e liquidação Asaas (dependente de abertura e homologação de conta jurídica).
- Transmissão real de e-mails para caixas postais externas (dependente de domínio autenticado DKIM/SPF no Resend).
- Cálculo real de frete com contrato ativo dos Correios (dependente de credenciais Cws).

### 2.4 Premissas e Fatos Conhecidos Adotados
1. **Conta Bancária:** Conforme registrado pelo usuário, ainda não existe conta bancária cadastrada ou configurada no sistema; a configuração será realizada posteriormente.
2. **Sistema de Pontos:** Conforme registrado pelo usuário, o sistema de pontos e fidelidade ainda não está concluído.
3. **Regra de Negócio de Recebimentos:** A receita do dashboard utiliza o Valor Bruto Liquidado com persistência atômica de `Order.paidAt` e separação proporcional de frete (Opção A).

---

## 3. Inventário de Funcionalidades

| Funcionalidade | Descrição | Localização | Status | Evidências Técnicas | Dependências | Problemas Encontrados | Critérios de Conclusão |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| **Catálogo & Vitrine** | Listagem de produtos, busca, filtros de marca/tags e paginação | `app/page.tsx`, `HomeClient.tsx` | `Concluído e validado` | 13 testes de paginação e filtros aprovados | Banco de dados | Nenhum impeditivo | Filtros funcionais com resposta < 200ms |
| **Carrinho de Compras** | Gerenciamento de itens, quantidades, variantes e persistência local | `store/cart.store.ts` | `Concluído e validado` | `tests/unit/cart.test.ts` (4/4 OK) | Navegador | Nenhum impeditivo | Adição, remoção e totalizador consistentes |
| **Checkout Multi-Etapas** | Identificação do cliente, seleção de frete, resgate de pontos e geração de pedido | `CheckoutForm.tsx`, `checkout.service.ts` | `Parcialmente implementado` | Criação autoritativa de pedido e reserva de estoque testadas | Asaas / PIX | `WHATSAPP_PIX` não expira pedidos abandonados | Expiração automática de pedidos pendentes |
| **Cálculo de Frete J&T** | Cálculo de frete baseado em tabela geográfica local com 5.181 faixas | `jt-express.provider.ts` | `Concluído e validado` | Tarifas em banco auditadas | Base de dados J&T | Falta fallback caso CEP não case nenhuma faixa | 100% de cobertura com regra de contingência |
| **Cálculo de Frete Correios** | Cotação online de SEDEX e PAC | `correios.provider.ts` | `Com falhas conhecidas` | Linha 35 consome `CalcPrecoPrazo.aspx` | API Correios | Webservice XML legado sujeito a bloqueio | Migrar para API REST oficial ou Melhor Envio |
| **Frete Balcão e A Combinar** | Modalidades de retirada física e envio sob consulta | `pickup.provider.ts`, `none.provider.ts` | `Concluído e validado` | Testes de checkout com frete zero aprovados | Nenhuma | Nenhum | Pedidos marcados corretamente como PICKUP/NONE |
| **Pagamento PIX via Asaas** | Emissão de cobrança PIX dinâmica com QR Code e Copia e Cola | `asaas.client.ts`, `checkout.service.ts` | `Bloqueado por dependência` | Cliente implementado com tipagem estrita | Credenciais Asaas | `ASAAS_API_KEY` ausente no `.env` | Credenciais de produção validadas em sandbox |
| **Webhooks de Pagamento Asaas** | Processamento assíncrono de liquidação com fail-closed e idempotência | `app/api/webhooks/asaas/route.ts` | `Implementado, mas não validado` | `PaymentWebhookEvent` e testes unitários OK | Gateway Asaas | Não testado com webhook real de produção | Recebimento com sucesso de evento real do Asaas |
| **Simulador de Pagamentos (Dev)** | Endpoint para testes locais de aprovação de pedidos | `app/api/webhooks/asaas/simulate/route.ts` | `Concluído e validado` | Bloqueio em `NODE_ENV === 'production'` ativo | Nenhuma | Nenhum | Bloqueado estritamente em ambiente de produção |
| **Confirmação de Entrega pelo Cliente** | Modal do cliente para confirmar recebimento do pedido | `app/api/orders/[id]/confirm-delivery` | `Parcialmente implementado` | Atualiza status para DELIVERED com auditoria | Autenticação | Não chama `updateOrderStatus` nem limpa cache | Unificar com `order.service.ts` |
| **Sistema de Pontos (Engine)** | Motor contábil de carteira, débito, crédito e extrato | `loyalty.service.ts` | `Parcialmente implementado` | 30 testes unitários aprovados | Banco de dados | Sem expiração de pontos (`EXPIRATION`) | Implementar rotina FIFO e worker de expiração |
| **Painel Admin — Fidelidade** | Configuração de taxas e ajuste manual de saldo de clientes | `app/admin/fidelidade/page.tsx` | `Concluído e validado` | Telas de extrato e ajuste funcionais | Autenticação Admin | Nenhum | Interface e formulários operacionais |
| **Painel Admin — Dashboard** | Métricas financeiras (Hoje, Mês, Total), proporção de frete e status | `FinancialKpiCard.tsx`, `dashboard.service.ts` | `Concluído e validado` | 14 testes financeiros aprovados | Banco de dados | Nenhum | Dados agregados em tempo real com TTL de 60s |
| **Painel Admin — Pedidos** | Listagem, filtros e gaveta de detalhes e alteração de status | `app/admin/orders/page.tsx`, `order.service.ts` | `Concluído e validado` | Listagem com `orderNumber` e FSM validada | Autenticação Admin | Nenhum | Transições de status auditadas |
| **Painel Admin — Produtos** | Cadastro, edição e exclusão de produtos e variações | `app/admin/products/page.tsx`, `ProductForm.tsx` | `Parcialmente implementado` | CRUD completo funcional | Banco de dados | Sem upload de arquivos (apenas URLs externas) | Upload direto para Supabase Storage |
| **Painel Admin — Clientes** | Listagem, busca e visão detalhada do cliente | `app/admin/customers/page.tsx` | `Concluído e validado` | Busca com debounce e cursor-based pagination | Autenticação Admin | Nenhum | Métricas de pedidos e gastos por cliente |
| **Painel Admin — Usuários** | Gestão de permissões de acesso (ADMIN / CUSTOMER) | `app/admin/users/page.tsx` | `Concluído e validado` | Alteração de papéis com modal funcional | Autenticação Admin | Nenhum | Acesso restrito a administradores |
| **Painel Admin — Frete Local** | Cadastro de tabelas municipais de entrega própria | `app/admin/freight/page.tsx` | `Concluído e validado` | CRUD de `FreightRule` com validação de cidade | Autenticação Admin | Nenhum | Tabela consultada autoritativamente no checkout |
| **Painel Admin — Configurações** | Edição de dados da loja, PIX e endereço de origem | `app/admin/settings/page.tsx` | `Parcialmente implementado` | Configurações persistidas em banco | Autenticação Admin | Sem campos de conta bancária para saque | Incluir módulo financeiro de conta bancária |
| **Gestão de Marcas e Categorias** | Criação e organização de marcas e tags do catálogo | `Brand`, `CategoryTag` | `Não implementado` | Apenas leitura `GET /api/brands` existe | Banco de dados | Não há telas de gestão no Admin | Interface administrativa para CRUD de marcas |
| **Autenticação & Sessões** | Login, registro e sessões protegidas por cookies seguros | `lib/session.ts`, `app/api/auth/` | `Concluído e validado` | Tokens criptográficos de 256 bits e anti-fixation | Banco de dados | Nenhum | Sessões destruídas no logout com `httpOnly` |
| **Recuperação de Senha** | Solicitação e redefinição de senha por token seguro | `app/forgot-password`, `services/auth.service.ts` | `Bloqueado por dependência` | Lógica de token de 1h implementada e testada | Provedor de E-mail | `RESEND_API_KEY` não configurada no servidor | Envio real de e-mails com link funcional |
| **Perfil do Cliente — Dados** | Edição de nome, telefone e dados do usuário | `app/profile/components/ProfileForm.tsx` | `Não implementado` | Formulário estático sem manipulador de submissão | Autenticação | Botão "Salvar Alterações" não executa nada | Criar endpoint `PUT /api/user/profile` |
| **Perfil do Cliente — Avatar** | Upload de foto de perfil | `app/profile/actions.ts` | `Não implementado` | Server action com `setTimeout` simulado | Supabase Storage | Arquivo não é gravado em nenhum storage | Implementar bucket no Supabase Storage |
| **Perfil do Cliente — Endereços** | Gestão de múltiplos endereços de entrega | `services/address.service.ts` | `Parcialmente implementado` | Apenas `setDefaultAddress` implementado | Banco de dados | Sem CRUD de endereços no perfil | Permitir inclusão e exclusão de endereços |
| **E-mails Transacionais de Pedido** | Disparo de e-mails de confirmação, pagamento e envio | Inexistente | `Não implementado` | Nenhum template ou chamada de envio para pedidos | Resend | Clientes não recebem confirmação formal | Disparo assíncrono nos eventos da FSM |
| **Conta Bancária & Saques** | Configuração de dados bancários e liquidação financeira | Inexistente | `Não implementado` | Nenhum modelo, serviço ou tela implementados | Asaas / Banco | Lojista não consegue sacar via sistema | Módulo de dados bancários e reconciliação |
| **Integração Nuvemshop** | Sincronização de catálogo e estoque com ERP externo | `schema.prisma` (campos órfãos) | `Não implementado` | Apenas colunas no schema, sem services | API Nuvemshop | Fora de escopo para lançamento inicial | Decidir se mantém no schema ou descontinua |

---

## 4. Funcionalidades Pendentes

### 4.1 Domínio Financeiro e Pagamentos
- **[PEND-FIN-001] Credenciais e Ativação do Gateway Asaas em Produção**
  - **Motivo:** O arquivo `.env` não possui `ASAAS_API_KEY`, `ASAAS_API_URL` e `ASAAS_WEBHOOK_TOKEN`.
  - **Evidência:** `.env` linhas 1-10; log em `tests/unit/asaas-webhook.test.ts` acusando ausência do token.
  - **Impacto:** O checkout online não gera cobranças reais e os webhooks rejeitam requisições com erro 500.
  - **Prioridade:** **P0 (Bloqueador Crítico)** | **Esforço:** Baixo (Configuração).
  - **Critério de Aceite:** Chave de API e token de webhook configurados no cofre de segredos; endpoint emitindo QR Code PIX válido do Asaas.
  - **Próxima Ação:** Obter as credenciais jurídicas no portal do Asaas e configurar nas variáveis de ambiente.

- **[PEND-FIN-002] Cadastro de Conta Bancária e Mecanismo de Transferência/Saque**
  - **Motivo:** O sistema não possui cadastro de conta bancária para receber os repasses do Asaas.
  - **Evidência:** Ausência de campos em `model Loja` no `prisma/schema.prisma` e ausência de formulário em `AdminSettingsPage.tsx`.
  - **Impacto:** O lojista depende de login manual no painel do Asaas para transferir os valores recebidos para o banco comercial.
  - **Prioridade:** **P1 (Alta)** | **Esforço:** Médio.
  - **Critério de Aceite:** Modelo de dados suportando banco, agência, conta e chave PIX de liquidação; documentação do processo de transferência.
  - **Próxima Ação:** Definir se a transferência será via API Asaas (`/transfers`) ou via processo operacional manual no portal Asaas.

- **[PEND-FIN-003] Cancelamento Automático de Pedidos Abandonados (Timeout de PIX)**
  - **Motivo:** Pedidos em `PENDING` via `WHATSAPP_PIX` ou Asaas não pago permanecem abertos indefinidamente.
  - **Evidência:** Inexistência de cron/worker de cancelamento por timeout em `app/api/` ou `scripts/`.
  - **Impacto:** Estoque físico fica reservado e pontos resgatados ficam retidos sem que o cliente tenha pago.
  - **Prioridade:** **P1 (Alta)** | **Esforço:** Médio.
  - **Critério de Aceite:** Rotina periódica (ex: a cada 15 minutos) que cancela pedidos `PENDING` após o tempo limite (ex: 24 horas), restaurando estoque e estornando pontos.
  - **Próxima Ação:** Implementar endpoint de reconciliação de pedidos expirados (`/api/cron/expire-orders`).

---

### 4.2 Domínio de Fidelidade e Pontos
- **[PEND-LOY-001] Motor de Expiração Periódica de Pontos (`EXPIRATION`)**
  - **Motivo:** `LoyaltyTxType.EXPIRATION` e `expiresAt` existem no banco, mas nenhuma rotina executa a baixa dos pontos vencidos.
  - **Evidência:** Grep por `EXPIRATION` comprova que não há nenhuma função `expirePoints()` em `services/loyalty.service.ts`.
  - **Impacto:** Passivo financeiro contínuo; pontos acumulados nunca prescrevem, mesmo com prazo configurado na loja.
  - **Prioridade:** **P1 (Alta)** | **Esforço:** Médio/Alto (Exige lógica FIFO de saldo).
  - **Critério de Aceite:** Função que localiza transações `EARN` vencidas com saldo remanescente, debita da carteira e registra transação do tipo `EXPIRATION`.
  - **Próxima Ação:** Implementar método contábil `processExpiredPoints` no `loyalty.service.ts`.

- **[PEND-LOY-002] Estorno Automático de Pontos em Pedidos Pendentes Não Pagos**
  - **Motivo:** Se o cliente usa pontos no checkout e fecha o navegador sem pagar o PIX, os pontos foram debitados no ato da criação do pedido (`PENDING`).
  - **Evidência:** Linhas 430-440 de `services/checkout.service.ts`.
  - **Impacto:** Reclamações de clientes por perda indevida de saldo de pontos em pedidos não concluídos.
  - **Prioridade:** **P1 (Alta)** | **Esforço:** Conectado ao `PEND-FIN-003`.
  - **Critério de Aceite:** O cancelamento automático ou manual de pedido pendente restaura 100% dos pontos resgatados.
  - **Próxima Ação:** Validar integração com a rotina de timeout de pedidos.

---

### 4.3 Domínio de Comunicação e Mensageria
- **[PEND-COM-001] Configuração do Provedor de E-mails Transacionais (Resend)**
  - **Motivo:** `RESEND_API_KEY` ausente no ambiente.
  - **Evidência:** Log nos testes de recuperação de senha: `[ResendEmailService] RESEND_API_KEY não está configurada no ambiente. E-mail não enviado.`
  - **Impacto:** Usuários não conseguem redefinir senhas esquecidas; perda de acesso a contas de clientes.
  - **Prioridade:** **P0 (Bloqueador Crítico)** | **Esforço:** Baixo.
  - **Critério de Aceite:** Chave Resend inserida no `.env`; domínio `continentalestetica.com.br` validado com registros DNS (SPF/DKIM).
  - **Próxima Ação:** Adicionar `RESEND_API_KEY` e `EMAIL_FROM` nas variáveis de ambiente de produção.

- **[PEND-COM-002] Implementação de E-mails de Notificação de Pedido**
  - **Motivo:** O sistema não dispara e-mails quando um pedido é criado, pago ou despachado.
  - **Evidência:** Ausência de chamadas a `emailService` em `checkout.service.ts` e `order.service.ts`.
  - **Impacto:** Sensação de insegurança do comprador pós-checkout; dependência exclusiva de WhatsApp.
  - **Prioridade:** **P1 (Alta)** | **Esforço:** Médio (Criação de templates HTML).
  - **Critério de Aceite:** E-mails responsivos disparados com resumo de itens, código PIX e código de rastreamento.
  - **Próxima Ação:** Criar templates `order-created.template.ts` e `order-shipped.template.ts`.

---

### 4.4 Domínio de Logística e Frete
- **[PEND-LOG-001] Modernização da Integração com os Correios**
  - **Motivo:** `CorreiosProvider.ts` utiliza o webservice legado XML `ws.correios.com.br/calculador/CalcPrecoPrazo.aspx`.
  - **Evidência:** Linhas 30-55 de `services/freight/providers/correios.provider.ts`.
  - **Impacto:** Parada repentina no cálculo de frete nacional caso os Correios desativem o XML sem aviso.
  - **Prioridade:** **P1 (Alta)** | **Esforço:** Médio.
  - **Critério de Aceite:** Migração para a API Cws/REST dos Correios ou gateway aglutinador (Melhor Envio/Frenet).
  - **Próxima Ação:** Desenvolver adapter REST para a API v1/v2 dos Correios.

- **[PEND-LOG-002] Tratamento de Exceção e Fallback Tarifário na J&T Express**
  - **Motivo:** Se o CEP de destino não pertencer a nenhum `geocomCode` mapeado, a cotação retorna vazio sem sugestão alternativa.
  - **Evidência:** `jt-express.provider.ts` retorna array vazio se não houver match na tabela.
  - **Impacto:** Cliente não consegue concluir compra caso Correios esteja desligado e CEP não case J&T.
  - **Prioridade:** **P2 (Média)** | **Esforço:** Baixo.
  - **Critério de Aceite:** Regra de contingência para cálculo regional padrão quando a faixa não constar nas 5.181 tarifas.
  - **Próxima Ação:** Adicionar tarifa de macro-região padrão como salvaguarda.

---

### 4.5 Domínio de Frontend, UX e Perfil do Usuário
- **[PEND-UX-001] Implementação Real do Formulário de Perfil do Cliente**
  - **Motivo:** O componente `ProfileForm.tsx` não possui estado, formulário controlado nem chamada de API no botão "Salvar Alterações".
  - **Evidência:** Linha 40 de `app/profile/components/ProfileForm.tsx`.
  - **Impacto:** O usuário clica para atualizar telefone ou dados e nada acontece na tela.
  - **Prioridade:** **P1 (Alta)** | **Esforço:** Baixo.
  - **Critério de Aceite:** Endpoint `PUT /api/user/profile` com validação Zod e feedback de sucesso via toast.
  - **Próxima Ação:** Conectar o formulário à API de atualização de usuário.

- **[PEND-UX-002] Implementação Real do Upload de Imagem de Avatar**
  - **Motivo:** A server action `uploadAvatarAction` é uma simulação falsa com `setTimeout`.
  - **Evidência:** Linhas 11-15 de `app/profile/actions.ts`.
  - **Impacto:** A imagem selecionada pelo cliente não é gravada no banco nem no storage.
  - **Prioridade:** **P2 (Média)** | **Esforço:** Médio.
  - **Critério de Aceite:** Upload real para bucket do Supabase Storage e persistência de `user.avatarImageUrl`.
  - **Próxima Ação:** Implementar client Supabase Storage autenticado no servidor.

- **[PEND-UX-003] Upload de Imagens no Cadastro de Produtos do Admin**
  - **Motivo:** O `ProductForm.tsx` aceita apenas digitação manual de URLs externas.
  - **Evidência:** Linha 28 de `components/admin/ProductForm.tsx`.
  - **Impacto:** Fricção severa para o lojista, que precisa hospedar fotos em sites externos antes de cadastrar itens.
  - **Prioridade:** **P2 (Média)** | **Esforço:** Médio.
  - **Critério de Aceite:** Componente de drag-and-drop de fotos com upload automático para bucket de produtos.
  - **Próxima Ação:** Adicionar input de arquivo conectado ao Supabase Storage.

- **[PEND-UX-004] Correção de Branding Hardcoded nos Títulos de Páginas**
  - **Motivo:** Metadados das páginas de registro, login e novo produto contêm texto da marca legada "Pernambuco Confecções".
  - **Evidência:** `app/register/page.tsx:5`, `app/login/page.tsx:5`, `app/admin/products/new/page.tsx:7`.
  - **Impacto:** Dano à imagem da marca Continental na aba do navegador e no SEO.
  - **Prioridade:** **P2 (Média)** | **Esforço:** Trivial.
  - **Critério de Aceite:** Substituição dos títulos estáticos pelo nome dinâmico da loja ou Continental.
  - **Próxima Ação:** Ajustar metadados estáticos.

- **[PEND-UX-005] Telas Administrativas para Gestão de Marcas e Categorias**
  - **Motivo:** O catálogo possui modelos e tabelas para `Brand` e `CategoryTag`, mas o admin não possui telas para gerenciá-las.
  - **Evidência:** Ausência de diretórios `/admin/brands` e `/admin/categories`.
  - **Impacto:** Marcas e tags de produtos só podem ser manipuladas via banco de dados diretamente.
  - **Prioridade:** **P2 (Média)** | **Esforço:** Médio.
  - **Critério de Aceite:** Telas CRUD de marcas e categorias integradas ao menu lateral do admin.
  - **Próxima Ação:** Construir rotas e formulários administrativos de marcas e tags.

---

## 5. Auditoria do Sistema de Pontos

O sistema de fidelidade foi inspecionado em suas camadas contábil, relacional, de interface e de segurança:

### 5.1 O que já Existe e Funciona
1. **Modelagem de Dados e Ledger:** Tabelas `LoyaltyWallet` e `LoyaltyTransaction` com chaves únicas compostas `[lojaID, userID]`, campo `version` para controle de concorrência e tipos estritos no enum `LoyaltyTxType`.
2. **Configuração Parametrizável por Loja:** Campos em `Loja` para ativar/desativar programa, definir taxa de acúmulo (`loyaltyEarnRate`), valor unitário em R$ (`loyaltyPointValue`), saldo mínimo para resgate (`loyaltyMinPointsRedeem`), teto de desconto (`loyaltyMaxDiscountPct`) e validade em dias (`loyaltyPointsExpiryDays`).
3. **Cálculo Autoritativo no Checkout:** Função `simulatePointsRedemption` que recalcula o desconto no backend, impedindo que o frontend manipule o valor do abatimento.
4. **Reserva e Débito no Pedido:** Chamada atômica a `debitRedeemedPoints` na criação do pedido, registrando transação `REDEEM` com saldo consolidado pós-operação.
5. **Crédito no Pagamento:** Chamada atômica a `creditEarnedPoints` disparada na transição para `PAID`, registrando transação `EARN`.
6. **Interface de Usuário:** `LoyaltyPointsWidget.tsx` funcional no checkout; `LoyaltyHistoryView.tsx` funcional no perfil com extrato paginado; `LoyaltyAdminView.tsx` para configurações e ajustes manuais com auditoria.
7. **Bateria de Testes:** 30 testes unitários cobrindo cálculos matemáticos, teto de desconto, concorrência e isolamento multi-tenant (`tests/unit/loyalty-engine.test.ts`, `tests/unit/loyalty-security-concurrency.test.ts`, `tests/unit/loyalty-routes.test.ts`, `tests/unit/loyalty-integration.test.ts`).

### 5.2 O que Está Incompleto ou com Riscos de Integridade

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        DIAGRAMA DE FLUXO DO MOTOR DE PONTOS (GAPS)                     │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│  [Checkout: Resgate de Pontos]                                                         │
│         │                                                                              │
│         ├──► Saldo debitado imediatamente na carteira (Transação REDEEM)               │
│         │                                                                              │
│         ▼                                                                              │
│  [Pedido Criado: Status PENDING]                                                       │
│         │                                                                              │
│         ├──[Cenário A: Cliente Paga PIX] ──► Status PAID ──► Credita pontos (EARN) [OK]│
│         │                                                                              │
│         └──[Cenário B: Cliente Abandona / Não Paga]                                    │
│                     │                                                                  │
│                     ├── [FALHA CRÍTICA 1]: Pedido fica PENDING indefinidamente         │
│                     │                      Pontos do cliente FICAM PRESOS!             │
│                     │                                                                  │
│                     └── [FALHA CRÍTICA 2]: Não há cron de cancelamento automático      │
│                                            para devolver pontos e estoque              │
│                                                                                        │
│  [Decurso de Tempo: Pontos Acumulados]                                                 │
│         │                                                                              │
│         └── [FALHA CRÍTICA 3]: Transações possuem expiresAt, mas NÃO EXISTE            │
│                                rotina periódica que execute a baixa (EXPIRATION).      │
│                                Os pontos NUNCA EXPIRAM!                                │
│                                                                                        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

1. **Ausência da Rotina de Expiração (`EXPIRATION`):** Embora o campo `expiresAt` seja preenchido no momento do crédito, o sistema não possui nenhum job agendado para avaliar transações expiradas e debitar da carteira. Os pontos permanecem infinitamente válidos.
2. **Falta de Contabilidade FIFO de Pontos:** O modelo armazena apenas um valor agregado `balance: Int` na `LoyaltyWallet`. Quando um cliente gasta 100 pontos de um saldo de 300 pontos, o sistema não sabe quais pontos foram consumidos (os mais antigos ou os mais novos). Sem contabilidade por lotes (FIFO), é impossível calcular com precisão jurídica quantos pontos restam em cada lote a expirar.
3. **Bloqueio de Saldo em Checkout Abandonado:** Quando o cliente insere pontos no checkout e fecha o pedido, o débito ocorre no status `PENDING`. Se o cliente não pagar o PIX, ele não pode reutilizar seus pontos em outro pedido até que um administrador entre manualmente no painel e cancele o pedido.
4. **Devoluções Parciais:** A função `refundOrderPoints` só contempla estorno total do pedido. Se o cliente devolver apenas 1 item de uma compra com 5 produtos, o sistema não possui suporte a cálculo proporcional de estorno de pontos.
5. **Decisões de Negócio Pendentes:**
   - *Decisão 1:* O cliente que paga um pedido parcialmente com pontos deve acumular pontos sobre o valor total original ou apenas sobre o valor líquido pago em dinheiro? (Atualmente, o sistema pontua sobre o `subtotalAfterDiscount`).
   - *Decisão 2:* Qual o tempo limite para cancelamento de um PIX não pago com pontos antes da devolução automática à carteira? (Recomendação: 1 hora para PIX dinâmico e 24 horas para PIX manual).

---

## 6. Auditoria da Conta Bancária e Integrações Financeiras

### 6.1 Dependências da Conta Bancária
Atualmente, o e-commerce utiliza o Asaas como instituição de pagamento parceira. Na arquitetura do Asaas:
- As cobranças PIX são geradas em nome da conta jurídica da Continental no Asaas.
- Quando o cliente realiza o pagamento, o crédito ingressa no **saldo disponível da conta digital Asaas** da empresa.
- Para que esse dinheiro chegue à conta corrente bancária da empresa (ex: Itaú, Bradesco, Santander, Banco do Brasil, Inter, Nubank), é necessário realizar uma operação de **Saque / Transferência (TED ou PIX)**.

### 6.2 O que Está Implementado
1. **Geração de Cobrança PIX:** Criação de pagamentos com chave única, expiração e metadados de cliente via `AsaasClient.createPayment`.
2. **Obtenção de QR Code:** Consulta de imagem Base64 e chave Copia e Cola via `AsaasClient.getPixQrCode`.
3. **Escuta de Webhooks com Fail-Closed:** Recepção de confirmação de pagamento com trava de segurança de token em `app/api/webhooks/asaas/route.ts`.
4. **Deduplicação e Idempotência:** Tabela `PaymentWebhookEvent` com índice único por `eventId` e captura de erro de concorrência P2002.
5. **Reconciliação com Pedidos Cancelados:** Registro de log de auditoria caso um pagamento Asaas chegue para um pedido já cancelado (`PAYMENT_RECEIVED_ON_CANCELLED_ORDER`).

### 6.3 O que Falta para Prontidão Financeira
1. **Credenciais no Ambiente de Produção:** Inserção obrigatória das chaves do Asaas no arquivo `.env`.
2. **Dados da Conta Bancária no Sistema:** Não há campos na tabela `Loja` nem telas no Admin para registrar os dados da conta bancária de destino (Banco, Agência, Conta, Tipo, Titular, CNPJ).
3. **Fluxo de Transferência Automatizada (Split / Saque Automático):** A API do Asaas oferece endpoints de transferência bancária (`POST /transfers`), mas o sistema atual não possui essa rotina.
4. **Conciliação e Extrato Bancário:** Não existe tela de conferência entre os pedidos marcados como `PAID` no banco local e o extrato real de liquidações da conta bancária/Asaas.

### 6.4 Critérios de Ativação para Produção
1. Abertura e validação cadastral completa da conta jurídica no Asaas.
2. Definição da chave de webhook no painel do Asaas apontando para `https://continentalestetica.com.br/api/webhooks/asaas`.
3. Configuração das variáveis `ASAAS_API_KEY`, `ASAAS_API_URL` e `ASAAS_WEBHOOK_TOKEN` no ambiente de produção.
4. Definição do processo operacional de repasse bancário (se manual pelo app Asaas ou automatizado via API).

---

## 7. Arquitetura e Qualidade Técnica

### 7.1 Pontos Fortes Observados
- **Separação de Responsabilidades (SRP):** Camada de serviços (`services/`) altamente desacoplada de frameworks de UI.
- **Tipagem Estrita e DTOs:** Interfaces TypeScript dedicadas e sanitizadores (`dto-sanitizer.ts`) para evitar vazamento de senhas e dados internos.
- **Contabilidade Precisa:** Utilização de `Prisma.Decimal` nativo com `db.Decimal(10, 2)` em todas as entidades financeiras, eliminando drift de ponto flutuante IEEE 754.
- **Isolamento de Tenant:** Todas as consultas críticas possuem filtro estrito por `lojaID` derivado da sessão autenticada ou do domínio resolvido.
- **Suíte de Testes:** 243 testes unitários com execução rápida (< 3s no Vitest) e 0 regressões.

### 7.2 Problemas Arquiteturais e Dívida Técnica
1. **Adoção Praticamente Nula do Logger Estruturado:** A classe `Logger` foi construída em `lib/logger.ts`, mas os endpoints continuam usando `console.error` e `console.log` sem padronização JSON ou rastreabilidade por correlation ID.
2. **Armazenamento em Memória de Rate Limit e Cache:** Tanto `rateLimitStore` quanto `memoryCache` utilizam `Map` na memória do processo Node.js. Isso inviabiliza escalabilidade horizontal em múltiplos contêineres ou arquitetura serverless (Vercel/AWS Lambda).
3. **Dependência de Webservice XML nos Correios:** Risco iminente de obsolescência técnica.
4. **Campos Órfãos da Nuvemshop no Banco:** Colunas como `nuvemshopStoreId`, `nuvemshopProductId`, etc. poluem o schema Prisma sem nenhum serviço que as utilize.

### 7.3 Classificação de Resolução
- **Obrigatório Resolver Antes da Produção:**
  - Inserção de credenciais nos ambientes.
  - Fail-closed e timeout de pedidos pendentes com pontos.
  - Correção de títulos hardcoded de branding.
  - Conexão do formulário de perfil do cliente.
- **Pode Ser Postergado (Pós Go-Live):**
  - Migração do Rate Limit para Redis distribuído (se o deploy inicial for em VPS/contêiner único).
  - Remoção/limpeza dos campos da Nuvemshop do schema Prisma.
  - Substituição do XML dos Correios por API REST (já existe fallback de contingência).

---

## 8. Segurança

Classificação dos achados segundo severidade CVSS v3.1 e diretrizes OWASP:

| ID | Severidade | CVSS v3.1 | Categoria OWASP | Descrição da Vulnerabilidade | Impacto | Ação Recomendada |
| :---: | :---: | :---: | :--- | :--- | :--- | :--- |
| **SEC-001** | **CRÍTICO** | **9.1** | OWASP A02:2021 (Cryptographic Failures) | Credenciais vitais ausentes no ambiente de produção (`.env`) | Parada total de pagamentos Asaas e e-mails de recuperação | Configurar chaves no cofre de segredos |
| **SEC-002** | **ALTO** | **7.5** | OWASP API4:2023 (Unrestricted Resource) | Rate limit baseado em memória local volátil | Bypass de brute-force se houver múltiplas instâncias | Adotar Redis / Upstash em escala |
| **SEC-003** | **ALTO** | **7.2** | OWASP A04:2021 (Insecure Design) | Pontos debitados no checkout ficam bloqueados se o pedido não for pago | Prejuízo financeiro / insatisfação do cliente | Cancelamento automático com estorno |
| **SEC-004** | **MÉDIO** | **5.4** | OWASP A05:2021 (Security Misconfiguration) | Ausência de cabeçalho Content Security Policy (CSP) em `next.config.js` | Riscos de injeção XSS em scripts externos | Configurar diretiva CSP estrita |
| **SEC-005** | **BAIXO** | **3.1** | OWASP A09:2021 (Security Logging Failures) | Falta de rastreabilidade de logs por correlation ID | Dificuldade em auditorias forenses de incidentes | Adotar `Logger` estruturado em todas as rotas |
| **SEC-006** | **INFO** | **0.0** | Boas Práticas | Rota de simulação devidamente bloqueada em produção | Nenhum impacto | Manter verificação de `NODE_ENV` |

---

## 9. Testes e Validação

### 9.1 Testes Executados e Aprovados
- **Suíte de Testes Unitários:** `npm run test:unit`
  - **Arquivos de Teste:** 36 arquivos executados.
  - **Testes Individuais:** 243 testes executados e aprovados (100%).
  - **Tempo de Execução:** ~2.99 segundos.
- **Tipagem Estática:** `npx tsc --noEmit` executado com **0 erros**.
- **Linter:** `npm run lint` executado com **0 erros** (15 avisos cosméticos de tags `<img>` e hooks).
- **Estado de Migrações:** `npx prisma migrate status` confirmou **20 migrações 100% aplicadas** na nuvem Supabase.

### 9.2 Testes Não Executados e Motivo
- **Testes de Integração (`tests/integration`):** 3 arquivos (`metrics-performance`, `route-protection`, `status-transitions`) não foram executados porque exigem banco local/descartável com `TEST_DATABASE_URL` para evitar limpeza do banco Supabase ativo.
- **Testes de Carga (`tests/load`):** 1 arquivo (`customer-load.test.ts`) suspenso pelo mesmo motivo de proteção de dados.

### 9.3 Fluxos Críticos Sem Cobertura Automatizada
1. Transmissão real de e-mails de redefinição de senha com Resend.
2. Ciclo de vida de expiração de pontos (`EXPIRATION`).
3. Upload de fotos de produtos e avatares para Supabase Storage.
4. Conexão real com gateway bancário Asaas em modo produção.

---

## 10. Mapa de Impacto

| Área do Sistema | Arquivos e Módulos Afetados | Tipo de Impacto | Dependências Críticas | Risco Residual |
| :--- | :--- | :--- | :--- | :---: |
| **Financeiro / Asaas** | `asaas.client.ts`, `api/webhooks/asaas/route.ts`, `.env` | Bloqueador de Operação | Conta jurídica Asaas e chaves no `.env` | Alto |
| **Fidelidade / Pontos** | `loyalty.service.ts`, `checkout.service.ts`, `order.service.ts` | Integridade Contábil | Regra de negócio de expiração e timeout | Médio |
| **Logística / Frete** | `correios.provider.ts`, `jt-express.provider.ts` | Resiliência Operacional | API REST Correios / Tabelas J&T | Médio |
| **E-mails Transacionais** | `lib/email/`, `auth.service.ts`, `checkout.service.ts` | Comunicação com Cliente | Domínio autenticado no Resend | Alto |
| **Perfil do Cliente** | `ProfileForm.tsx`, `actions.ts`, `app/profile/` | Experiência do Usuário (UX) | Endpoints de atualização e Supabase Storage | Médio |
| **Catálogo & Admin** | `ProductForm.tsx`, `app/admin/products/`, `app/admin/settings/` | Usabilidade do Lojista | Upload de imagens e cadastro bancário | Baixo |
| **Segurança & Infra** | `next.config.js`, `lib/rate-limit.ts`, `lib/cache.ts` | Escalabilidade e Proteção | Redis distribuído e CSP headers | Médio |

---

## 11. Roadmap de Conclusão para Produção

Organização sequencial rigorosa baseada em dependências técnicas, redução de riscos e viabilidade operacional:

### Fase 1: Bloqueadores Críticos (P0)
*Objetivo: Habilitar o funcionamento real de pagamentos e recuperação de acesso.*

- **[ACT-P0-01] Configuração de Variáveis de Ambiente de Produção**
  - **Prioridade:** P0 | **Dependências:** Obtenção de chaves no Asaas e Resend.
  - **Evidência:** Arquivo `.env` preenchido e verificado via script de checagem.
  - **Resultado Esperado:** Asaas operando em modo real e Resend enviando e-mails.
  - **Critério de Aceite:** `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN`, `RESEND_API_KEY`, `SESSION_SECRET` e `PLATFORM_DOMAIN` configurados.
  - **Condição de Conclusão:** `curl` de teste no webhook retorna 200/received e e-mail de teste entregue na caixa de entrada.

- **[ACT-P0-02] Homologação Ponta a Ponta do Webhook Asaas**
  - **Prioridade:** P0 | **Dependências:** ACT-P0-01.
  - **Evidência:** Pedido no banco Supabase transitando de `PENDING` para `PAID` via webhook real.
  - **Resultado Esperado:** Liquidação de pagamentos PIX sem intervenção humana.
  - **Critério de Aceite:** `paidAt` preenchido com timestamp do Asaas e dashboard atualizado em tempo real.
  - **Condição de Conclusão:** Teste de transação de R$ 1,00 aprovado com sucesso.

---

### Fase 2: Correções de Segurança e Integridade (P1)
*Objetivo: Eliminar retenção indevida de pontos, estoques órfãos e falhas de comunicação.*

- **[ACT-P1-01] Worker de Cancelamento e Expiração de Pedidos Pendentes**
  - **Prioridade:** P1 | **Dependências:** Nenhuma.
  - **Evidência:** Endpoint `/api/cron/orders-timeout` documentado e testado.
  - **Resultado Esperado:** Pedidos `PENDING` sem pagamento após timeout são cancelados automaticamente.
  - **Critério de Aceite:** Devolução imediata do estoque reservado e estorno integral de pontos resgatados.
  - **Condição de Conclusão:** Teste unitário e acionamento por cron validados.

- **[ACT-P1-02] Disparo de E-mails Transacionais de Pedido**
  - **Prioridade:** P1 | **Dependências:** ACT-P0-01.
  - **Evidência:** Templates HTML `order-confirmation` e `order-shipped` criados.
  - **Resultado Esperado:** O comprador recebe e-mail formal a cada mudança de status do pedido.
  - **Critério de Aceite:** E-mail com layout Continental Dark entregue em menos de 10 segundos após o evento.
  - **Condição de Conclusão:** 100% dos eventos da FSM disparam notificação.

---

### Fase 3: Conclusão das Funcionalidades Essenciais (P1/P2)
*Objetivo: Entregar as telas e fluxos incompletos ou simulados.*

- **[ACT-P2-01] Implementação Real do Formulário de Perfil do Cliente**
  - **Prioridade:** P1 | **Dependências:** Nenhuma.
  - **Evidência:** Endpoint `PUT /api/user/profile` e `ProfileForm.tsx` com React Hook Form.
  - **Resultado Esperado:** O cliente consegue atualizar nome, telefone e senha logada.
  - **Critério de Aceite:** Dados persistidos na tabela `User` e toast de confirmação.
  - **Condição de Conclusão:** Teste de edição de perfil aprovado.

- **[ACT-P2-02] Upload Direto de Imagens para Supabase Storage**
  - **Prioridade:** P2 | **Dependências:** Bucket configurado no Supabase.
  - **Evidência:** Componente de upload no `ProductForm.tsx` e no `AvatarManager.tsx`.
  - **Resultado Esperado:** O lojista faz upload direto de fotos de produtos; cliente altera foto de perfil.
  - **Critério de Aceite:** Imagens compactadas e servidas via CDN do Supabase.
  - **Condição de Conclusão:** Upload de arquivo JPG/PNG de até 5MB concluído com sucesso.

- **[ACT-P2-03] Módulo de Configuração de Conta Bancária da Loja**
  - **Prioridade:** P1 | **Dependências:** Decisão de negócio do lojista.
  - **Evidência:** Campos de banco e agência em `AdminSettingsPage.tsx`.
  - **Resultado Esperado:** Registro oficial da conta comercial de destino dos recebimentos.
  - **Critério de Aceite:** Dados validados e salvos com chave PIX e titularidade idêntica ao CNPJ.
  - **Condição de Conclusão:** Formulário salvo com sucesso no banco de dados.

- **[ACT-P2-04] Correção de Textos de Branding Legados**
  - **Prioridade:** P2 | **Dependências:** Nenhuma.
  - **Evidência:** Remoção de "Pernambuco Confecções" em `app/register`, `app/login` e `new product`.
  - **Resultado Esperado:** Metadados 100% alinhados à marca Continental.
  - **Critério de Aceite:** Grep por "Pernambuco" retorna zero ocorrências em código ativo.
  - **Condição de Conclusão:** Build Next.js com títulos corrigidos.

---

### Fase 4: Expiração e Conclusão do Sistema de Pontos (P2)
*Objetivo: Finalizar o ciclo contábil do programa de pontos.*

- **[ACT-P2-05] Rotina de Expiração de Pontos e Lógica de Saldo**
  - **Prioridade:** P2 | **Dependências:** Decisão de negócio sobre método FIFO.
  - **Evidência:** Função `processExpiredPoints()` em `loyalty.service.ts`.
  - **Resultado Esperado:** Pontos vencidos há mais de 365 dias debitados com registro `EXPIRATION`.
  - **Critério de Aceite:** Atualização do saldo da carteira sem gerar saldos negativos.
  - **Condição de Conclusão:** Teste unitário simulando pontos de 366 dias atrás aprovado.

---

### Fase 5: Performance, Observabilidade e Segurança (P2/P3)
*Objetivo: Blindagem operacional e infraestrutura.*

- **[ACT-P3-01] Cabeçalhos CSP e Políticas de Segurança HTTP**
  - **Prioridade:** P2 | **Dependências:** Nenhuma.
  - **Evidência:** `Content-Security-Policy` adicionado ao `next.config.js`.
  - **Resultado Esperado:** Proteção reforçada contra injeções de script externo.
  - **Critério de Aceite:** Avaliação no SecurityHeaders.com com nota A/A+.
  - **Condição de Conclusão:** Zero quebras de assets legítimos no console.

- **[ACT-P3-02] Adoção Global do Logger Estruturado**
  - **Prioridade:** P3 | **Dependências:** Nenhuma.
  - **Evidência:** Substituição de `console.error` pelo `logger.withContext()`.
  - **Resultado Esperado:** Logs em formato JSON padronizado com correlation IDs.
  - **Critério de Aceite:** Rastreabilidade completa de requisições de checkout e webhooks.
  - **Condição de Conclusão:** Logs legíveis em plataformas de observabilidade (ex: Datadog/BetterStack).

---

### Fase 6: Preparação Operacional e Contingência (P2)
*Objetivo: Garantir continuidade de negócio e recuperação de desastre.*

- **[ACT-P2-06] Plano e Script Automatizado de Backup do Banco Supabase**
  - **Prioridade:** P1 | **Dependências:** Acesso ao Supabase CLI / pg_dump.
  - **Evidência:** Script de backup diário documentado em `docs/operations/backup.md`.
  - **Resultado Esperado:** Dump lógico dos dados preservado em cofre seguro independente.
  - **Critério de Aceite:** Procedimento de restauração testado e validado em ambiente local.
  - **Condição de Conclusão:** Backup restaurável em menos de 15 minutos.

- **[ACT-P2-07] Migração do Provedor de Correios para API REST**
  - **Prioridade:** P2 | **Dependências:** Credenciais Cws dos Correios ou Melhor Envio.
  - **Evidência:** Substituição do endpoint XML legado por endpoint REST com autenticação Bearer.
  - **Resultado Esperado:** Estabilidade no cálculo de SEDEX e PAC.
  - **Critério de Aceite:** Retorno de cotação em menos de 1.5s com cache tarifário.
  - **Condição de Conclusão:** 100% das cotações operando sem dependência do XML.

---

### Fase 7: Homologação e Aceite Final (Go-Live)
*Objetivo: Validação final pelo Tech Lead e Stakeholders.*

- **[ACT-P0-03] Teste Piloto com Transação Real (Smoke Test de Produção)**
  - **Prioridade:** P0 | **Dependências:** Fases 1 a 6 concluídas.
  - **Evidência:** Pedido real de R$ 1,00 pago via PIX, aprovado por webhook, e-mail recebido e despachado no admin.
  - **Resultado Esperado:** Ciclo de venda 100% íntegro sem qualquer intervenção manual de código.
  - **Critério de Aceite:** Relatório de homologação assinado pelo responsável.
  - **Condição de Conclusão:** Liberação oficial do tráfego público de clientes.

---

## 12. Decisões Pendentes

O responsável pelo produto e a arquitetura devem deliberar sobre as seguintes questões estratégicas:

### Decisão 1: Política de Saque e Liquidação Bancária
- **Pergunta:** A transferência dos valores recebidos no Asaas para a conta bancária comercial da Continental será automatizada via API (`/transfers`) ou realizada manualmente pelo financeiro da loja no portal web/app do Asaas?
- **Contexto:** A automação via API exige cadastro bancário com dados sensíveis na aplicação e webhook de transferência; o modelo manual pelo app do Asaas é mais simples, não exige desenvolvimento imediato e possui 2FA nativo do banco.
- **Opções:**
  - *Opção A:* Operação Manual via Portal Asaas (Recomendado para Go-Live imediato).
  - *Opção B:* Construção de módulo completo de saques via API no Admin.
- **Impacto:** A Opção A reduz o tempo de lançamento em 1 a 2 semanas sem riscos adicionais de segurança.

### Decisão 2: Base de Cálculo de Pontos em Pedidos com Resgate
- **Pergunta:** Quando o cliente utiliza R$ 30 em pontos em um pedido de R$ 100 (pagando R$ 70 via PIX), ele deve acumular pontos sobre R$ 100 (subtotal bruto) ou sobre R$ 70 (subtotal líquido pago)?
- **Contexto:** A prática contábil padrão de programas de fidelidade (ex: Smiles, Livelo) premia apenas o valor efetivamente gasto em moeda corrente (R$ 70) para evitar diluição e duplo benefício desproporcional.
- **Opções:**
  - *Opção A:* Pontuar sobre o valor líquido pago (R$ 70) — Já suportado no motor atual.
  - *Opção B:* Pontuar sobre o valor original total (R$ 100).
- **Impacto:** A Opção A protege a margem de lucro da loja; a Opção B exige ajuste no `checkout.service.ts`.

### Decisão 3: Prazo Limite para Cancelamento de Pedidos Pendentes
- **Pergunta:** Em quanto tempo um pedido não pago via PIX deve ser cancelado automaticamente para devolução do estoque e dos pontos resgatados?
- **Contexto:** Pedidos PIX via Asaas costumam ter QR Code válido por 30 a 60 minutos. No checkout via WhatsApp, o cliente pode levar mais tempo para transferir.
- **Opções:**
  - *Opção A:* 60 minutos para cobranças automáticas Asaas e 24 horas para pedidos manuais WhatsApp.
  - *Opção B:* 24 horas unificado para todos os pedidos.
- **Impacto:** A Opção A libera o estoque muito mais rápido para outros clientes compradores.

### Decisão 4: Destino dos Campos Órfãos da Nuvemshop no Banco de Dados
- **Pergunta:** O projeto ainda planeja integrar sincronização com a Nuvemshop em fases futuras, ou esses campos devem ser removidos do `schema.prisma`?
- **Contexto:** Existem 7 colunas e a tabela `StockSyncLog` sem qualquer código associado.
- **Opções:**
  - *Opção A:* Manter no schema como reserva arquitetural para o futuro (sem custo operacional).
  - *Opção B:* Gerar migração para limpar as colunas e simplificar o modelo relacional.
- **Impacto:** A Opção A não interfere na produção e poupa retrabalho futuro caso a integração seja reativada.

---

## 13. Riscos e Limitações

### 13.1 Riscos Técnicos e de Infraestrutura
- **Risco de Concorrência em Escala:** O cache e o limitador de requisições baseados em memória da instância local não oferecem proteção uniforme se a aplicação for escalada em múltiplas réplicas sem Redis.
- **Risco de Timeout no Checkout dos Correios:** Se o webservice XML dos Correios oscilar, o checkout pode sofrer lentidão de até 3.5 segundos antes de acionar o fallback.

### 13.2 Riscos de Dados e Integridade
- **Ausência de Rotina Formal de Backup Diário:** O banco está hospedado no Supabase, que possui backups automáticos na camada de infraestrutura, mas o projeto não possui dump local versionado ou procedimento documentado de restauração para recuperação de desastre.

### 13.3 Limitações do Ambiente de Auditoria
- Não foi possível simular a entrega real de e-mails em caixas de entrada corporativas por falta de credenciais do Resend.
- A integridade do gateway Asaas foi validada no simulador e por suítes unitárias, dependendo de homologação final com chave de produção ativa.

---

## 14. Checklist de Aceite para Produção

Checklist objetivo para validação final da comissão técnica antes da liberação do tráfego:

### A. Infraestrutura e Segredos
- [ ] Variável `ASAAS_API_KEY` populada com chave real de produção.
- [ ] Variável `ASAAS_WEBHOOK_TOKEN` configurada no servidor e no painel Asaas.
- [ ] Variável `RESEND_API_KEY` populada com chave ativa de envio.
- [ ] Variável `SESSION_SECRET` configurada com string aleatória de 32+ caracteres.
- [ ] Variável `PLATFORM_DOMAIN` configurada como `continentalestetica.com.br`.
- [ ] Registros DNS do domínio validados no provedor de e-mails (SPF, DKIM, DMARC).

### B. Funcionalidades e Negócio
- [ ] Compra de teste de R$ 1,00 processada com sucesso via PIX dinâmico do Asaas.
- [ ] Webhook do Asaas recebido, autenticado com token e pedido alterado para `PAID`.
- [ ] Painel Admin atualizado com o valor recebido no dia em tempo real.
- [ ] Cancelamento de pedido pendente restaura estoque e pontos com sucesso.
- [ ] Solicitação de "Esqueci minha senha" entrega e-mail na caixa postal em < 1 minuto.
- [ ] Link de redefinição de senha permite alterar a credencial com sucesso.
- [ ] Formulário de edição de perfil do cliente permite alterar telefone com sucesso.

### C. Qualidade e Conformidade
- [ ] Execução de `npx prisma migrate status` com 100% de migrações aplicadas.
- [ ] Execução de `npx tsc --noEmit` concluída com 0 erros.
- [ ] Execução de `npm run lint` concluída com 0 erros.
- [ ] Execução de `npm run test:unit` concluída com 100% de aprovação (243 testes).
- [ ] Teste de carga e navegação sem warnings críticos no console do navegador.
- [ ] Títulos de páginas limpos de qualquer menção a nomes de marcas antigas.

---

## 15. Resumo Final de Prioridades

### 15.1 Bloqueadores Imediatos (Próximos Passos Obrigatórios)
1. **Adicionar as credenciais nos ambientes (`.env`):** Asaas (`API_KEY`, `WEBHOOK_TOKEN`) e Resend (`API_KEY`).
2. **Implementar o cancelamento automático de pedidos `PENDING` expirados:** Evita o travamento do estoque e dos pontos dos clientes que abandonam o carrinho.
3. **Conectar o formulário do perfil do cliente (`ProfileForm.tsx`):** Eliminar o comportamento estático do botão de salvar.
4. **Remover strings de marcas legadas ("Pernambuco") dos metadados:** Garantir pureza institucional da Continental.

### 15.2 Sequência Sugerida de Execução
```
[Passo 1: Credenciais & Env] ──► [Passo 2: E-mails Resend] ──► [Passo 3: Timeout Pedidos/Pontos]
             │
             ▼
[Passo 4: Perfil & UX Clientes] ──► [Passo 5: Teste Real Asaas R$ 1,00] ──► [Passo 6: GO-LIVE]
```

### 15.3 Registro de Ferramentas, Agentes e MCPs Utilizados
- **Ferramentas Antigravity Utilizadas:** `view_file`, `list_dir`, `grep_search`, `run_command` (para execução não modificadora de `vitest`, `tsc`, `eslint` e `prisma migrate status`).
- **MCPs e Plugins Inspecionados:**
  - `ruflo`: O diretório `C:\Users\Vmoia\.gemini\antigravity-ide\mcp\ruflo` contém 333 esquemas de ferramentas declaradas como lazy tools. Como o runtime do agente não possui a ferramenta nativa `call_mcp_tool` registrada no despacho, a auditoria foi executada com máxima profundidade analítica pelo agente principal através de inspeção direta de código, análise estática e ferramentas do ecossistema Node/Prisma/TypeScript.
  - `chrome-devtools-plugin`: Não acionado nesta etapa estritamente documental para evitar qualquer risco de alteração inadvertida de estado em sessão aberta.
  - `science`, `android-cli-plugin`, `firebase`: Não aplicáveis à arquitetura web Next.js/PostgreSQL deste projeto.

---
*Relatório gerado, revisado e assinado eletronicamente pelo Staff Software Engineer / Tech Lead.*
