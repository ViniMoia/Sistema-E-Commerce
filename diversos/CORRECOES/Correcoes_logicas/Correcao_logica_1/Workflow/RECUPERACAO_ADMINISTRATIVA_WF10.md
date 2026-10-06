# Recuperação administrativa — WF-10

Este é um procedimento operacional planejado, sem execução no banco persistente. Destina-se a uma loja identificada que já não possui ADMIN ACTIVE, inclusive inicialização controlada de loja. A aplicação recusa autopromoção e não escolhe automaticamente uma conta. Revisão por operação, ensaio da recuperação e aprovação da janela continuam nos gates WF-18/19/20.

## Identidade e autorização fora da aplicação

1. Abrir solicitação de mudança com ID da loja, ambiente, motivo, conta existente escolhida pelo titular e evidência da identidade/autoridade do solicitante. Confirmar o vínculo da conta e controle do contato por canal verificado; um e-mail recebido ou conhecimento do ID não constitui autorização.
2. Identificar operador e revisor distintos pelo mecanismo de autenticação da infraestrutura. Usar acesso temporário de manutenção com menor privilégio, registrado no controle de acesso do banco. O mecanismo concreto de IAM/MFA da hospedagem precisa ser definido e ensaiado por operação; este documento não presume sua existência.
3. Conferir backup atual protegido e restauração, estado das migrations e artefato de aplicação. Suspender mutações administrativas da loja durante a recuperação e registrar a janela. Não executar o antigo `scripts/create_test_admin.ts`: ele foi desabilitado; não criar credenciais públicas de desenvolvimento.

## Preflight somente leitura

Usar exclusivamente os IDs aprovados, com parâmetros vinculados. Conferir a loja, a conta alvo e `count(User WHERE lojaID = loja AND role = ADMIN AND status = ACTIVE)`. Se a contagem não for zero, abandonar a recuperação excepcional e usar o administrador ativo existente. Não enumerar dados pessoais em logs nem exportar senha/token. Consultar a auditoria da última alteração e investigar o motivo da indisponibilidade, inclusive possível comprometimento.

## Operação transacional prevista

O operador autorizado executará em uma conexão de manutenção uma única transação curta, sem chamada externa:

1. Bloquear a linha exata de Loja com `FOR UPDATE`, protocolo compartilhado com `changeUserEligibility`. Bloquear a conta aprovada; reler sua loja/estado e contar novamente ADMIN ACTIVE. Recusar divergência ou contagem diferente de zero.
2. Alterar somente essa conta existente para ADMIN ACTIVE. Não modificar email, tenant, senha, dados de compra ou vínculos. Não reaproveitar uma conta arbitrária encontrada por `findFirst`. Não apagar administradores bloqueados.
3. Invalidar tokens de recuperação existentes e revogar sessões da conta no mesmo commit. Uma nova autenticação será exigida. Eventual comprometimento exige tratamento separado de credenciais, pela política de incidentes.
4. Inserir AuditLog com `action=ADMIN_ELIGIBILITY_RECOVERY`, `actorType=SYSTEM`, `actorId=null`, `systemActor=ops-admin-recovery:<id-da-mudança>`, `entity=USER`, `entityId/targetId` iguais à conta aprovada. Registrar loja, valores anteriores/novos de role/status, identidade verificável do operador/revisor e referência da aprovação. Não guardar credenciais, bearer ou documento pessoal na metadata. A identidade administrativa de infraestrutura é a autoridade desta operação; o texto de systemActor, sozinho, não autentica ninguém.
5. Conferir exatamente uma alteração, uma auditoria e ao menos um ADMIN ACTIVE. Falha de qualquer verificação, sessão ou auditoria provoca rollback integral. Commit apenas após todas as conferências. Não mascarar erros como sucesso.

Depois do commit, fazer nova autenticação pelo domínio da loja, conferir acesso autorizado e rejeição em outra loja, auditoria, sessões revogadas e ausência de mudanças em compras/vínculos. Reativar tráfego administrativo e remover o acesso temporário. A evidência operacional deve registrar resultados e responsável; um commit no banco não comprova validação de acesso no navegador.

## Contingência e limites

Falha antes do commit deixa o estado anterior por rollback. Resultado de commit incerto exige consulta por ID da mudança/auditoria antes de qualquer repetição; não repetir a promoção às cegas. Após commit, não restaurar backup global nem remover o único administrador. Tratar reversão como nova mudança auditada, garantindo outro administrador ativo e preservando os vínculos.

Não há endpoint de exclusão ou transferência de usuário neste projeto. O serviço de elegibilidade recusa essas operações, pois existem FKs comerciais/auditoria com restrições. Eventual implementação deve adquirir locks das duas lojas em ordem estável antes dos usuários, reautorizar, preservar administradores ativos de ambas e definir o destino de todos os vínculos; não basta atribuir outro lojaID ou apagar User. O adapter interno de bloqueio/desbloqueio existente neste pacote compartilha o mesmo protocolo, sem criar uma nova rota pública.

O script antigo pode ter sido usado anteriormente. Verificar contas de desenvolvimento, histórico de execução/exposição e necessidade de bloqueio/rotação no preflight operacional. Sua desativação no código não revoga credenciais já criadas. A investigação/rotação em ambiente persistente não foi executada nesta etapa.
