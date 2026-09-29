# Resumo das alterações — 29/09/2026

Este documento resume a execução dos prompts de correção baseada na revalidação de 29/09/2026: alterações de código, testes, documentação e ferramentas de validação. O projeto já continha mudanças sem commit; elas foram preservadas. Correções anteriores de checkout, reconciliação e reembolso foram revalidadas, sem serem apresentadas como implementações novas desta rodada.

**Resultado geral:** correções locais implementadas e verificadas com banco descartável e provedores fictícios. Foram aprovados 622 testes unitários e 68 integrações, além das verificações de tipos, build, ambiente e segredos. Homologação externa e decisões comerciais continuam pendentes.

**Prompts e planejamento**

- Atualizados os 17 arquivos de `correcao-ecommerce-prompts` — README e prompts 00 a 15 — para **GPT Astra (`gpt-6-astra`)**.
- Substituídas premissas antigas por pendências da revalidação de 29/09/2026, evitando repetir correções já comprovadas.
- Registrada a execução contínua, sem pausas entre etapas independentes, com preservação dos contratos públicos e das alterações existentes.
- Atualizados plano, progresso e relatórios de correção por área, mantendo o histórico anterior.
- Consolidada a relação dos 198 achados em 36 grupos, com responsável por disciplina/prompt, risco residual e teste necessário para encerramento.

Referências: [prompts](../../../correcao-ecommerce-prompts/README.md), [plano](PLAN.md) e [progresso](PROGRESS.md).

**Infraestrutura e ambiente de validação**

- Documentado `ALLOW_ASAAS_SANDBOX_WRITE=0` em `.env.example`, mantendo a escrita em sandbox desativada.
- Validado o contrato de ambiente, com 38 nomes cobertos.
- Preparado Node 22.22.1 com npm 10.9.4 em diretório temporário, sem substituir a instalação global.
- Preparados PostgreSQL 16 descartável, cópia isolada para build, credenciais fictícias e bloqueios de rede para os testes.
- Excluído `.tmp/` das verificações de lint/tipos e do Git, evitando incluir cópias de teste, perfil de navegador e arquivos temporários no projeto versionado.
- Arquivados comandos, scripts de ensaio e resultados. Servidor, navegador e container criados para a validação foram encerrados ao final.

O Prisma CLI registrou carregamento de `.env`, mas as URLs de conexão já estavam explicitamente substituídas pelo banco descartável. O build foi executado em cópia sem `.env`. Nenhuma integração configurada da aplicação foi acionada.

**Sessões, fixtures e testes HTTP**

- Extraído o cálculo de hash de sessão para `lib/session-token.ts`, compartilhado com as fixtures sem depender do contexto de cookies do Next.js.
- Corrigidas as fixtures para persistir o hash SHA-256 da sessão e entregar o token bruto ao cliente de teste.
- Ajustadas criação e limpeza de dados para respeitar a loja de cada execução, incluindo auditoria, fidelidade e frete. Teste com registro sentinela comprovou que a limpeza não remove dados de outra execução.
- Corrigidas factories de itens de pedido para combinar produto e variante da mesma loja, preservando referências históricas opcionais.
- Substituído o transporte HTTP do helper por HTTP nativo para preservar o cabeçalho `Host`, necessário à resolução da loja no Node 22.
- O helper passou a exigir ambiente de teste e URL HTTP local explícita, bloquear troca de origem, não seguir redirecionamentos e limitar o tempo de espera.
- Ajustados payloads e expectativas de status por endpoint. A matriz passou a testar anônimo, cliente dono/não dono e administradores de duas lojas, incluindo recusa sem alteração indevida do pedido.
- Incluídas as suites PostgreSQL de reconciliação de pagamentos e de integridade comercial no comando `test:integration:core` utilizado pelo CI.

**Segurança, validação e tratamento de erros**

- Cadastro, simulação de pontos, alterações de frete e definição de endereço padrão passaram a separar erros de negócio conhecidos de falhas internas inesperadas.
- Falhas inesperadas retornam respostas genéricas; mensagens internas e detalhes de infraestrutura não são devolvidos ao cliente nos caminhos corrigidos.
- O cadastro passou a validar o nome após remover espaços nas extremidades, rejeitar nomes vazios e limitar nome, e-mail e telefone conforme as colunas existentes.
- Mantidos os contratos públicos válidos, incluindo respostas conhecidas de negócio e controles de sessão/autorização já corrigidos.
- Adicionados testes para ausência de vazamento de detalhes internos e validação das entradas alteradas.

**Banco de dados e isolamento entre lojas**

- Criada a migration aditiva `20260929170000_commerce_child_ownership`.
- Acrescentadas verificações de loja, proprietário e vínculo produto/variante para itens de carrinho e pedido, endereço do pedido, carrinho de origem e endereço padrão do usuário.
- Protegidas alterações nos registros pais que poderiam invalidar vínculos já existentes, como transferir produto, variante, carrinho ou endereço para outro contexto.
- Utilizados bloqueios e triggers para proteger as invariantes também em operações concorrentes.
- Incluída verificação prévia que interrompe a migration quando encontra inconsistências, sem apagar ou corrigir dados silenciosamente.
- Adicionados testes negativos, concorrência entre inserção e alteração do pai e preservação dos dados em caso de falha.

A migration foi aplicada somente em banco descartável. As 29 migrations e o diff do schema passaram. Em outra base descartável, uma inconsistência fictícia fez a nova migration abortar, preservando a linha e sem deixar novos triggers instalados.

**Auditoria administrativa**

- Criado `services/store-settings-audit.service.ts` para compartilhar a auditoria das configurações da loja e de fidelidade.
- O serviço confirma que o ator é administrador ativo da loja, bloqueia o registro da loja e grava alteração e auditoria na mesma transação.
- Registrados ator, loja, identificador da requisição, nomes dos campos enviados e valores anteriores/posteriores permitidos.
- Excluídos dos snapshots valores de PIX, contato, endereço, credenciais e texto livre.
- Propagado `requestId` nos handlers de configuração.
- Comprovado que falha na alteração ou na gravação da auditoria reverte a transação; administrador de outra loja é recusado.
- Validado no navegador que salvar configurações gera o registro de auditoria esperado.

**Logs e observabilidade**

- Substituídos usos diretos de `console.error` nos caminhos de servidor examinados por logger com sanitização, abrangendo APIs, serviços, frete, tenant e armazenamento.
- Alterado o tratamento de erros do Prisma para registrar evento genérico, sem imprimir SQL ou dados da operação.
- Revalidados testes de logs, health checks, falhas parciais e recuperação.
- Executado ensaio Linux de encerramento por SIGTERM: uma requisição em andamento terminou com HTTP 200 antes da saída do processo; conexões posteriores foram recusadas.

O ensaio de encerramento comprova o comportamento HTTP no ambiente testado. Ele não certifica uma imagem de release nem interrupção durante aceitação de pagamento real. Entrega durável de notificações, coletor, retenção e alertas externos continuam como requisitos separados.

**Frontend, acessibilidade e recuperação de falhas**

- Corrigido o retorno de foco ao botão que abriu o carrinho após fechar o drawer com Escape. Antes, o foco retornava ao corpo da página.
- Preservada a referência ao disparador entre o contexto/provider e o drawer, sem recriar dependência circular.
- Corrigida a apresentação de erro de rede no checkout: mensagem em português com orientação de nova tentativa e foco no resumo de erro.
- Associados rótulos aos 14 controles de configuração administrativa e ajustada a marcação dos controles relacionados.
- Executadas jornadas locais de login com redirecionamento, produto, carrinho, checkout PIX fictício, falha offline, nova tentativa, confirmação, recarga, duas abas e administração.
- Inspecionados navegação por teclado, retenção e retorno de foco, diferentes larguras de tela, largura equivalente a zoom de 200% e preferência por redução de movimento.

As pós-condições dos dois checkouts fictícios confirmaram dois pedidos, dois pagamentos simulados distintos, dois carrinhos concluídos e redução de estoque de 100 para 98. A tentativa offline não gerou compra duplicada. As verificações não equivalem a certificação completa de acessibilidade ou testes em todos os navegadores.

**Performance e paginação**

- Acrescentado desempate por identificador às ordenações de clientes, pedidos e extrato de pontos, evitando resultados instáveis quando as datas são iguais.
- Limitada a leitura da expiração de pontos a lotes de 100 carteiras e 100 eventos de ganho.
- Mantida a continuidade após falha individual e interrompida a leitura do histórico quando os eventos já cobrem o saldo necessário.
- Adicionados testes com 205 carteiras, processamento em mais de um lote e paginação com datas iguais.
- Corrigido o benchmark para coletar estatísticas com `ANALYZE` após inserir a massa no banco descartável.
- Preservados os limites absolutos de desempenho; removida comparação instável entre pequenas durações e corrigido o teste que reiniciava a paginação ao receber cursor nulo.

Na rodada final, a listagem de clientes levou 11 ms, a busca 8 ms e a listagem de pedidos 10 ms. São amostras locais com dados fictícios, sem representar o desempenho de serviços externos ou compromissos de produção.

**Arquitetura e qualidade de código**

- Concentradas as novas responsabilidades em dois módulos: hash puro de sessão e auditoria transacional de configurações.
- Melhorada a tipagem nas fronteiras alteradas, incluindo tratamento de exceções com `unknown` e uso de `Prisma.TransactionClient`.
- Substituído o teste autorreferente do cabeçalho por renderização dos componentes reais nos cenários de visitante, cliente e administrador.
- Atualizados mocks e expectativas afetados pelas mudanças de auditoria e sessão.
- Preservados o monólito modular e os fluxos existentes de checkout, reconciliação, reembolso, estoque e pontos. Não foram criadas implementações financeiras paralelas.

**Resultados da validação registrada**

| Verificação | Resultado |
|---|---|
| Testes unitários | 622 aprovados em 93 arquivos |
| Integrações | 68 aprovadas em 11 arquivos |
| Composição das integrações | 34 casos core PostgreSQL, 26 HTTP e 8 de performance |
| Tipos | Aprovado |
| Lint | 0 erros e 15 avisos |
| Contrato de ambiente | 38 nomes cobertos |
| Scanner de segredos | Nenhum padrão proibido encontrado |
| Migrations e schema | 29 aplicadas; diff sem diferenças |
| Migration com dado inválido | Interrompida, sem perda de dados ou instalação parcial de triggers |
| Build isolado | Aprovado, com 51 páginas geradas |
| Navegador | Jornadas locais aprovadas com provedores fictícios |
| SIGTERM | Requisição concluída e processo encerrado no ensaio |

Esses resultados pertencem à execução de 29/09/2026; a criação deste resumo não representa uma nova rodada de testes.

**Situação dos achados após as correções**

| Universo | Corrigidos | Parciais | Persistentes | Regressões | Não verificados |
|---|---:|---:|---:|---:|---:|
| 198 achados de origem | 133 | 48 | 11 | 0 | 6 |
| 36 grupos consolidados | 15 | 19 | 1 | 0 | 1 |

Nesta rodada, DB-006, DB-013, INF-010, TST-002, TST-008, OBS-012 e CQ-011 passaram a corrigidos; TST-004 passou a parcialmente corrigido. Os demais estados foram herdados da revalidação, com evidências complementares quando aplicável. Portanto, os 133 achados corrigidos não correspondem a 133 correções novas desta execução.

**Pendências e limites preservados**

- Homologar gateway, reconciliação, reembolso, valores e comportamento de falhas com o provedor autorizado.
- Definir políticas para cashback já gasto, disputas, logística, boleto e unicidade de CPF.
- Inventariar e ensaiar migrations sobre uma cópia sanitizada dos dados que serão preservados; sucesso em banco vazio não autoriza migrar a base do cliente.
- Comprovar operação de agendadores, alertas, entrega durável de notificações, políticas de armazenamento, retenção de logs e recuperação de falhas.
- Concluir requisitos de publicação, incluindo DNS/TLS, proxy, backup/restore, gestão de credenciais e implantação.
- Evoluir automação portátil de navegador/CI, testes em outros navegadores e leitores de tela, cobertura, CSP, tipagem estrita e limites de duração dos jobs.
- Tratar os 15 avisos de lint remanescentes conforme prioridade; eles não foram ocultados.

Não houve alteração de credenciais, migração do banco da aplicação, cobrança, reembolso, e-mail, upload ou webhook externo. Não foram criados cupons, CRUD de taxonomia, soft delete ou infraestrutura distribuída. Não houve commit nem deploy. **Os testes locais não liberam a publicação por si só.**

**Documentos e evidências completos**

- [Relatório final e matriz de responsabilidades](FINAL-VALIDATION.md).
- [Plano atualizado](PLAN.md) e [histórico de execução](PROGRESS.md).
- [Inventário dos arquivos alterados e adicionados na execução](evidence/astra-20260929/change-inventory.json).
- [Resultados estruturados](evidence/astra-20260929/validation.json) e [classificação dos 198 achados](evidence/astra-20260929/source-status.json).
- [Comandos, isolamento e limitações dos ensaios](evidence/astra-20260929/commands.md).
- [Pós-condições das compras e auditoria administrativa](evidence/astra-20260929/database-postconditions.json).
- [Recuperação do checkout](evidence/astra-20260929/checkout-recovery.json) e [verificações de plataforma web](evidence/astra-20260929/web-checks.json).

Os relatórios de auditoria em `docs/audits/` foram preservados. As atualizações desta execução foram registradas nos documentos de remediação e em suas evidências.
