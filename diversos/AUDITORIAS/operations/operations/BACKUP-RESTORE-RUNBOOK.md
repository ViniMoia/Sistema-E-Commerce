# Backup e recuperação da atualização do banco existente

**Estado vigente em 21/10:** [fechamento G2](../../../../trabalho_em_dupla/FECHAMENTO_G2.md). Restore técnico em outra máquina aceito pela evidência recebida, executado por Vinícius na máquina/conta de Vanderlei sem participação dele. Isso supera as pendências históricas abaixo de execução apenas na conta Windows original. Permanecem acesso por conta pessoal/custódia, retenção e recuperação operacional. Vinícius aprovou RPO <= 15 min / RTO <= 60 min e informou acesso ao painel Neon; janela efetiva e permissões ainda não verificadas. Não transformar as metas em resultado nem repetir restore apenas para atualizar documentos.

**Pacote portátil preparado em 21/10:** [localizadores e instruções G2](../../../../trabalho_em_dupla/PACOTE_ABERTURA_G2.md#pacote-portátil-de-recuperação-preparado--21102026). Nova cópia criptografada `age` e identidade separada permitem ensaio sem DPAPI no segundo Windows; originais preservados. O executor fornecido não aplica migrations/tratamentos de abertura e exige destino Docker novo sem rede/portas. Testes locais não encerram recuperação independente: o usuário ainda deve transferir o pacote/chave por meios separados, executar no outro computador e devolver a evidência sanitizada. Nenhum segredo ou dump integra o Git.

**Devolutiva de 21/10:** Vanderlei relatou dois backups criptografados **de homologação** na máquina dele, com ensaios anteriores pelo mesmo usuário; não localizou o backup **da origem** mantido na máquina de Vinícius. [Escopos e próximo encaminhamento](../../../../trabalho_em_dupla/PACOTE_ABERTURA_G2.md#devolutiva-de-vanderlei-sobre-backups--21102026). Nenhum novo restore ou verificação criptográfica independente foi feito nessa investigação. DPAPI continua dependente da conta original; acesso externo/portável ainda precisa ser preparado. Snapshots/PITR/retenção do Neon não foram verificados. Usar o backup de origem para o ensaio de origem, sem substituí-lo pelo de homologação ou inferir implantação a partir de um pacote de código. G2 permanece aberto.

**Atualização de 21/10:** backup fresco e restaurações locais da candidata `9495ff9` aprovados; [registro e limites](../../../../trabalho_em_dupla/PACOTE_ABERTURA_G2.md#backup-fresco-e-ensaio-de-abertura--21102026). O usuário assumiu a função de operador alternativo, mas acesso independente, restauração por ele, cópia externa, retenção e RPO/RTO continuam sem comprovação. A captura criptografada atual permanece protegida por DPAPI/ACL da conta Windows original; não equivale a recuperação em outra conta. Os números e localizador de 15/10 abaixo são históricos.

Revisão em 15/10/2026. Recuperação local em clone demonstrada; recuperação operacional independente ainda pendente. Este documento não autoriza escrita na main, restauração sobre banco compartilhado, troca de conexão ou contratação de recurso.

**Atualização de 16/10:** o [pacote G2](../../../../trabalho_em_dupla/PACOTE_ABERTURA_G2.md) reúne as identidades, comparações e ficha de recuperação por operador alternativo. O backup histórico foi novamente restaurado com a candidata `55a3003`, com upgrade, abertura e classificação aprovados; [evidência](../../../../trabalho_em_dupla/evidencias/L-G2-REVISAO-ABERTURA-2026-10-16.json). Não houve nova captura da origem. Continua pendente a recuperação fora da conta Windows original e a definição/comprovação de RPO, RTO e retenção da janela real.

## O que foi comprovado

Backup do schema public da origem PostgreSQL 18 capturado em **15/10/2026 às 18:43:55 UTC**, com conexão somente leitura. Localizador privado:

```text
%LOCALAPPDATA%\logic-audit-backups\9343e285df85d60fdcfb1ba15daade73
```

O executor usa AES-256-GCM, chave protegida por DPAPI do usuário Windows e diretório com ACL restrita. Dumps brutos e credenciais não entram no Git. O hash do conteúdo foi conferido na restauração.

Duas restaurações independentes, comparação de dados/sequências, sanitização exclusiva do clone, novo backup sanitizado e restauração passaram. As 13 migrations foram aplicadas com diff vazio. Também passaram leitura HTTP real, tratamento dos quatro produtos de teste, abertura auditada das carteiras e compra nova controlada no clone. Evidências agregadas em `trabalho_em_dupla/evidencias/L-BANCO-*.json`; detalhes nas seções 37–40 do replanejamento.

O ensaio de abertura completo durou aproximadamente 97 segundos localmente; inclui etapas específicas do teste e **não equivale ao RTO de produção**. O backup antigo não comprova RPO de uma implantação futura.

## Cobertura e lacunas

| Recurso | Situação |
|---|---|
| Schema public, dados e histórico de migrations | Capturados e restaurados em cópia isolada. |
| Roles, owners e grants/ACL do provedor | Não reproduzidos pelo restore com no-owner/no-acl; revisar separadamente. |
| Imagens e documentos externos | URLs do banco não são backup dos arquivos. Imagens de produto são referências Nuvemshop; verificar disponibilidade/recuperação junto à origem externa, sem provisionar upload ou bucket por inferência. Documentos de atendimento possuem cobertura separada. |
| Secrets, DNS e configuração de runtime | Fora do dump. Guardar referências/versões e política de recuperação no mecanismo aprovado. |
| PITR/snapshots do provedor | Retenção, disponibilidade na conta e último ponto recuperável não verificados nesta etapa. Não presumir com base no nome/plano do serviço. |
| Recuperação em outra máquina | Run `b64bee022cfd4578bbc408f9867fee00` recebido e conferido: Vinícius operou usando a conta Windows de Vanderlei. Recuperação por conta pessoal e acesso operacional permanente continuam pendentes. |
| Reentrega de eventos financeiros após cutoff | Exige procedimento e evidência próprios; banco restaurado não reverte o provedor. |

A cópia sanitizada serve para testar e compartilhar evidência técnica, **não para substituir o banco real após desastre**, pois remove credenciais, referências de integração e dados pessoais.

## Preparar recuperação independente

1. Leno e Vanderlei registram responsável principal/alternativo, RPO, RTO, retenção, região/local e prazo de guarda. Não assumir que já há cópia externa por existir um arquivo local.
2. Identificar recursos de backup/PITR já disponíveis na conta do destino, sem contratar ou alterar política automaticamente. Registrar somente IDs, horários e status, nunca strings de conexão.
3. Definir armazenamento protegido fora desta máquina e mecanismo de acesso à chave independente da sessão Windows atual. Separar acesso ao material criptografado do acesso à chave, com responsáveis e trilha de acesso. Não compartilhar segredo por chat, Git, relatório ou argumento de terminal.
4. Copiar artefatos apenas para o destino nominal autorizado. Não exportar backup bruto nem enviar automaticamente dados a um novo serviço.
5. O responsável alternativo deve demonstrar restauração em destino **novo, vazio e isolado**, usando o mecanismo aprovado, e registrar integridade, tempo e ponto recuperado. Acesso ao bucket ou download concluído sozinho não prova recuperabilidade.
6. Definir expiração/limpeza dos artefatos após o período acordado, mantendo o necessário para a janela e investigação. O executor local já descarta apenas seus containers por identidade; não usar limpeza global do Docker.

Estado vigente: **restauração técnica em outra máquina aprovada por evidência recebida; acesso pessoal permanente, retenção e recuperação operacional completa pendentes**. O pacote usa chave age independente; copiar `key.dpapi` junto ao dump para outra máquina não constitui teste de recuperação.

## Preparação de cada janela

- Reauditar a origem somente leitura e comparar com o baseline antes de reutilizar o plano.
- Criar backup fresco no cutoff coordenado do [runbook de implantação](DEPLOYMENT-RUNBOOK.md); registrar writers, operações externas e eventos em voo.
- Conferir criptografia, integridade, acesso do responsável alternativo e cobertura dos recursos externos.
- Executar o restore drill em destino vazio identificado, sem flags destrutivas sobre o destino real. Validar contagens, IDs/hashes, sequências, constraints, histórico/checksums, guards e invariantes de estoque/pontos.
- Manter gateway, e-mail, consumidores e integrações externos desabilitados durante o drill. Configurações fictícias de teste não são configuração final.
- Registrar tempo total de obtenção de acesso, provisionamento/restauração, validação e conciliação; comparar ao RTO aprovado. Registrar distância do ponto recuperado ao incidente para avaliar RPO.

Não restaurar um dump sanitizado como recuperação comercial; não executar limpeza, reset ou restore sobre a main nesta preparação. Os executores atuais validam identidade de clone e não são ferramentas genéricas de restauração em destino compartilhado.

## Decisão após falha

**Antes de novas vendas:** manter contenção, preservar banco/diagnósticos e determinar o trecho realmente aplicado. DDL parcial exige inspeção, não tentativa automática de rollback. Restaurar em outro destino isolado apenas se a recuperação for necessária.

**Depois de novos eventos ou vendas:** identificar tudo que ocorreu após o cutoff: cobranças, liquidações, estornos, webhooks, reservas, ganhos/resgates e notificações. Consultar/confrontar o provedor e recuperar efeitos pelos mecanismos idempotentes. Não reenviar cobrança/estorno apenas porque o registro não aparece no snapshot restaurado.

Promover o destino recuperado somente após integridade, roles/grants, configuração, identidade de conta, backlog e recuperação de acessos conferidos. A troca de conexão deve ter executor/revisor, horário, decisão e plano de retorno registrados; este documento não realiza essa troca. Conservar o banco anterior para diagnóstico pelo prazo definido, sem sobrescrevê-lo por conveniência.

## Registro de conclusão

Anexar localizador/ID do backup, horário do cutoff, hash, revisão/artefato, cobertura, responsável que restaurou, destino isolado, tempos, comparações, lacunas e decisão. Nenhum valor secreto, dump bruto ou comprador aparece no relatório compartilhável.

Uma restauração só está operacionalmente demonstrada quando o responsável alternativo consegue obter acesso pelo mecanismo aprovado, restaurar, validar e conciliar/retomar no prazo acordado. O restore técnico de 21/10 já está aceito no seu escopo; faltam os critérios operacionais da ficha de encerramento, não uma nova prova idêntica do dump.
