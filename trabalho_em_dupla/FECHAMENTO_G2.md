# G2 — Critérios para encerramento

Atualização: 21/10/2026. **G2 aberto; restauração técnica aprovada, aceites operacionais e abertura pendentes.** Esta ficha consolida o estado atual e prevalece sobre pendências históricas de transferência/restore já resolvidas. Não autoriza escrita no banco principal, mudança de plano ou contratação de infraestrutura.

## Decisões confirmadas

- Vinícius adotou **RPO de até 15 minutos** e **RTO de até 60 minutos** como metas a comprovar. Isso não é medição nem aprovação da capacidade atual.
- Vinícius informou acesso ao painel Neon e enviou capturas de `continental-homologacao` e `CContinental-DB`, ambas na branch Neon `main`, exibindo janela de histórico de **6 horas** e `No snapshots, no schedule set`. A segunda foi enviada após a orientação de selecionar o banco principal; a correspondência com a origem auditada ainda exige identificação do recurso. Permissão de recuperação e período efetivamente recuperável não foram testados. Não foi solicitada chave de API ou senha.
- Vinícius executou o restore na máquina e na conta Windows de Vanderlei (Esdras), sem participação dele. O ensaio prova recuperação técnica em outra máquina; não prova acesso duradouro por conta pessoal do operador.
- Preservar os 518 produtos comerciais provenientes da Nuvemshop. Contagem local coerente não substitui conferência física/comercial. Não ajustar quantidades automaticamente.
- Imagens são referências externas da Nuvemshop; não provisionar armazenamento para upload por usuário/Admin.

Fontes: respostas do usuário nesta conversa; `origin/main` `7f9b26e062ec2654420fecffb6dd78ad3ba1e017` (runbooks consultados somente leitura); replanejamento, seções 6, 9, 37–41 e 60; evidências abaixo. `origin/homologacao_teste` consultada em `1b09934e66c592ef0cd72aa1a80d1c4e53f35d28`.

## O que já está comprovado

| Entrega | Evidência e limite |
|---|---|
| Inventário da origem | [Leitura das 12:05 BRT](evidencias/L-G2-INVENTARIO-ORIGEM-2026-10-21.json): identidade, contagens e histórico; atualizar no cutoff da abertura. |
| Backup e migrations em clone | [Ensaio de 21/10](evidencias/L-G2-BACKUP-ENSAIO-2026-10-21.json): restauração, preservação e abertura em ambiente descartável, sem executar no banco principal. |
| Classificação histórica | [Comparação dos backups](evidencias/L-G2-CLASSIFICACAO-2026-10-21.json): mesmos 24 pedidos/33 itens, classificação auditada no clone e repetição sem duplicação. |
| Referências artificiais | [Pedidos legados #29/#30](evidencias/L-G2-REFERENCIAS-SIMULADAS-2026-10-21.json) correlacionados a simulações locais. Não representam prova de obrigações financeiras reais nem ausência global de outras obrigações. |
| Recuperação em outra máquina | [Run recebido](evidencias/L-G2-RECUPERACAO-OUTRA-MAQUINA-2026-10-21.json): hash do dump e da referência iguais, 23 tabelas, estrutura/sequências conferidas, contêiner removido. Operador humano confirmado. |
| Relação de estoque | [518 produtos/variantes comerciais](evidencias/L-G2-ESTOQUE-CONFERENCIA-2026-10-21.json) separados dos quatro testes. Relação pronta; conferência comercial não executada. |
| Migration de boleto em homologação | [Publicação de Vanderlei](https://github.com/ViniMoia/Sistema-E-Commerce/blob/1b09934e66c592ef0cd72aa1a80d1c4e53f35d28/trabalho_em_dupla/PUBLICACAO_HOMOLOGACAO_9495FF9_2026-10-21.md): backup HML ensaiado, 35 migrations sem pendência e artefato `9495ff9` publicado. Não equivale a atualizar o banco de origem. |

## Pendências e prova de encerramento

| ID | Responsável | Próxima ação concreta | Evidência para concluir |
|---|---|---|---|
| G2-A — acesso e custódia | Vinícius + Vanderlei | Identificar o projeto correto no Neon e os acessos pessoais disponíveis; localizar cópia de recuperação e acesso separado à chave. | Recursos identificados, permissões conferidas e acesso recuperável pelo operador sem depender da sessão de outra pessoa. O ensaio existente permanece válido no seu escopo. |
| G2-B — retenção e continuidade | Vanderlei, com decisão de Vinícius | Consultar configuração efetiva de histórico/PITR, snapshots/agendas existentes e último ponto recuperável. Definir política a partir dos recursos comprovados. | Prazo de retenção aprovado, mecanismo de proteção/monitoramento, responsáveis e cópia independente definidos e testados. Recurso não encontrado fica desconhecido, não inexistente. |
| G2-C — RPO/RTO | Conjunto | Comparar a cobertura recuperável com um incidente/cutoff identificado; medir obtenção de acesso, recuperação, validação e conciliação/retomada. | RPO observado <= 15 min e RTO completo <= 60 min. Se não atingir, corrigir e comprovar ou submeter exceção explícita; não reduzir metas silenciosamente. |
| G2-D — cobertura externa | Vanderlei + revisão nossa | Conferir referências/versões e acesso a roles/permissões, segredos, configuração de runtime, DNS, imagens externas e conciliação financeira pós-cutoff. | Procedimento de recuperação aplicável aos recursos efetivos, sem copiar secrets no Git. URLs da Nuvemshop não são cópia dos arquivos; restore não desfaz cobrança no Asaas. |
| G2-E — dados de abertura | Vinícius + revisão nossa; Vanderlei identifica integração | Preencher conferência do estoque, esclarecer rotina Nuvemshop e saldos/vínculos; revisar obrigações e carteiras no cutoff. | Relação conciliada com horários/movimentações/responsável, diferenças justificadas e aceites dos dados reais. 518 variantes sem ID externo próprio ainda exigem correspondência comprovada. |
| G2-F — abertura no destino | Vanderlei + revisão nossa + autorização específica | Preparar executor final, comparar baseline/candidata e planejar contenção de todos os escritores; só então executar a janela autorizada. | Backup do cutoff, migrations/tratamentos auditados, comparação antes/depois, aplicação conferida e decisão registrada. Scripts de clone não se tornam executores produtivos pela troca da conexão. |

## Próxima coleta: painel Neon, somente leitura

**Capturas recebidas em 21/10:** `CContinental-DB` / `main`, projeto `winter-credit-87209504`, branch `br-soft-heart-b6natkeu`, endpoint `ep-round-bonus-b62kh6x2`. O endpoint exibido coincide com a configuração da origem e a impressão SHA-256 do destino corresponde ao inventário das 12:05 BRT; comparação local em memória, sem conexão ao banco ou exposição de credenciais. Overview mostra plano Free, AWS São Paulo e PostgreSQL 18; Computes mostra estado ACTIVE e 0,25 CU. Isso confirma a associação do painel à origem auditada, não uma nova auditoria dos dados.

Settings → Postgres confirma histórico configurado em **6 horas**, no máximo do controle apresentado e aplicável a todas as branches; a interface indica upgrade para uma janela maior. Settings → General mostra branch sem proteção e sem expiração; isso não significa retenção ilimitada dos dados. Backup & Restore mostra ausência de snapshots/agendamento no painel selecionado. A seleção `21/10/2026 16:19`, fuso America/Sao_Paulo, é um campo do formulário: não prova horário de captura, último backup ou último ponto recuperável. Identidade e configuração do histórico conferidas; falta comprovar recuperação/permissões, retenção operacional e RPO/RTO. Não inferir inexistência de backups externos. Não há necessidade de salvar configurações nem contratar upgrade para concluir esta coleta.

**Próxima preparação:** abrir o formulário `Branches → New branch`, sem confirmar criação, para revisar uma branch descartável de ensaio a partir de `Past data`. Planejar nome exclusivo, ponto no tempo/fuso e comparação de dados antes de criar; não usar `Restore` sobre `main`, alterar conexão da aplicação ou acionar integrações. A opção é documentada em [Manage branches](https://neon.com/docs/manage/branches); abertura do formulário não comprova criação, permissão ou recuperação. O ensaio nativo não substitui a prova de recuperação completa da operação.

1. Abrir o projeto do **banco principal/origem**, confirmando nome/ID, região e branch do banco. A branch Neon não é a branch Git; não presumir que uma branch chamada `main` seja o destino correto.
2. Em **Settings → Instant restore**, observar a janela de histórico configurada e eventuais limites/avisos. Em **Postgres database → Backup & Restore**, observar os recursos e períodos recuperáveis apresentados para a branch selecionada. Os nomes podem variar na interface.
3. Registrar horário da consulta (com fuso), projeto/branch, janela efetiva, limites inicial/final recuperáveis se mostrados, snapshots existentes e respectivas datas, política/agendas existentes e papel da conta atual. Campo não apresentado deve ficar `não verificado`, nunca zero.
4. Enviar captura apenas dessas informações ou transcrição. Não enviar string de conexão, senhas, tokens, chave do backup ou linhas de clientes. Não clicar em Restore, criar branch/snapshot, salvar configurações, reduzir/aumentar janela ou contratar plano nesta coleta.
5. Conferir a identidade e os recursos antes de planejar teste nativo em destino novo isolado. A recuperação Docker existente não prova que o PITR da conta Neon esteja disponível. Acesso ao painel por si só não comprova permissão de restauração.

Referências oficiais consultadas em 21/10/2026: [History window](https://neon.com/docs/postgres/backup-restore/history-window) e [Instant restore](https://neon.com/docs/postgres/backup-restore/branch-restore). A janela de histórico representa alcance no passado; não é o RPO. O intervalo entre capturas, a idade da cópia recuperável e o intervalo entre a falha e o ponto restaurado são medidas distintas. Os ~6,56 segundos do restore Docker não incluem acesso/transferência nem retomada da loja e não encerram o RTO.

## Registro final

Usar a [evidência de progresso](evidencias/L-G2-FECHAMENTO-2026-10-21.json) para distinguir metas aprovadas de capacidade demonstrada. Preservar os resultados originais, registrar origem de cada confirmação e não alterar retrospectivamente os ensaios. O aceite só será `concluído` quando os itens abertos acima tiverem prova e revisão; G3/G6/G8 conservam seus aceites próprios.

Documento local. Nenhuma nova restauração, mutação de dados, alteração de infraestrutura ou operação financeira foi executada nesta consolidação.
