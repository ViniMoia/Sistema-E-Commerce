# G2 — Pacote de abertura do banco existente

**Encerramento em andamento — 21/10:** Vinícius aprovou metas de **RPO <= 15 minutos / RTO <= 60 minutos** e informou acesso ao painel Neon. [Ficha de encerramento](FECHAMENTO_G2.md) e [registro das decisões](evidencias/L-G2-FECHAMENTO-2026-10-21.json). Próxima coleta: identidade do projeto/branch da origem, janela de histórico/PITR e permissões, somente leitura. As metas estão aprovadas; capacidade, retenção e acesso pessoal para recuperação ainda não estão comprovados. O restore em outra máquina já foi recebido e validado no escopo abaixo; não tratá-lo como execução pendente. G2 aberto.

## Recuperação em outra máquina — resultado recebido em 21/10/2026

**Recuperação técnica validada pela evidência recebida; G2 permanece aberto.** O usuário enviou o resultado do run `b64bee022cfd4578bbc408f9867fee00`, executado às 15:15 BRT. O SHA do backup, o digest PostgreSQL, o hash da comparação com a referência e todas as contagens das 23 tabelas correspondem ao ensaio local preparado. O executor registra dados/estrutura/sequências conferidos, máquina e conta diferentes, `localValidation: false`, acesso próprio declarado e contêiner removido. Duração automatizada: aproximadamente 6,56 segundos, sem transferência/acesso manual; não é RTO operacional.

[Conferência e resultado recebido](evidencias/L-G2-RECUPERACAO-OUTRA-MAQUINA-2026-10-21.json). Trata-se de evidência fornecida pelo usuário, sem inspeção direta desta estação no destino. Vinícius confirmou que operou pessoalmente a máquina e a conta `zapnitro\esdra`, pertencentes a Vanderlei (Esdras), sem participação de Vanderlei no processo. A identidade do operador está esclarecida. A recuperação técnica em outra máquina está comprovada pela evidência recebida; o requisito de acesso por conta pessoal de Vinícius continua sem comprovação. O campo `ownAccessConfirmed` do resultado original registra uma declaração ao script e não comprova titularidade da conta. O resultado registra zero chamadas ao provedor, ausência de conexão à origem, escrita em banco compartilhado, migrations e ajustes de estoque.

Esta atualização substitui as pendências históricas abaixo de transferência e execução técnica no segundo computador. Continuam abertos o critério de acesso por conta pessoal do operador, tempos completos, retenção/custódia, objetivos de recuperação e cobertura externa, estoque comercial e abertura final autorizada. Scripts auxiliares recebidos foram apenas lidos; não foram executados aqui nem incorporados ao procedimento canônico. Atualização documental local, sem commit/publicação nesta rodada.

## Pacote portátil de recuperação preparado — 21/10/2026

**Pronto para transferência controlada ao segundo Windows do usuário; recuperação independente ainda não executada.** O backup original de 21/10 foi verificado e recriptografado em formato padrão `age` v1.3.2 com identidade X25519 nova, fora do Git. A chave portátil está em diretório separado com ACL restrita; a chave DPAPI e o backup originais permaneceram intactos. Não enviar a chave pelo chat/Git nem dentro do ZIP.

Localizadores nesta máquina:

- Pacote: `%LOCALAPPDATA%\continental-g2-portable\1a5688542d7c4461a2d17d82f1b6ef31\PACOTE_G2_PORTATIL_2026-10-21.zip`.
- Chave separada: `%LOCALAPPDATA%\continental-g2-keys\1a5688542d7c4461a2d17d82f1b6ef31\IDENTIDADE-G2.agekey`.
- Instruções e prompt atualizado: `PACOTE_G2/LEIA-ME.txt` e `PACOTE_G2/PROMPT-GEMINI.txt`, dentro do ZIP.

O pacote inclui ciphertext `source.dump.age`, executável oficial `age` para Windows amd64, manifesto, referência de verificação, SQL somente leitura e executor PowerShell. O ZIP oficial do `age` foi conferido contra o digest da release. O executor `scripts/homologation/restore-portable-g2.ps1` usa PostgreSQL 18 por digest, contêiner novo sem rede/portas e dados temporários em memória, com comparação de 23 tabelas, estrutura e uma sequência. Não carrega `.env`, não conecta a origem, não aplica migrations e não altera estoque/pontos. Evidência de validação local não é restauração pelo operador em outra máquina.

No segundo computador, verificar o SHA-256 do ZIP pelo valor fornecido nesta máquina, guardar chave fora do pacote com acesso restrito, confirmar acesso próprio e executar conforme o prompt. Não usar `-LocalValidation`, não remover verificações de máquina/conta e não regenerar o resultado esperado para forçar aprovação. Enviar somente `RESULTADO-G2.json` sanitizado e os tempos de acesso/transferência medidos pelo operador. G2, retenção, RPO/RTO e cobertura externa continuam dependentes de aceites próprios. A transferência física ainda será feita pelo usuário; nenhuma cópia foi enviada a serviço externo.

## Devolutiva de Vanderlei sobre backups — 21/10/2026

**Fonte: relato de Vanderlei encaminhado pelo usuário, sem inspeção direta da máquina dele nesta etapa.** [Registro com limites](evidencias/L-G2-DEVOLUTIVA-BACKUPS-VANDERLEI-2026-10-21.json). Foram localizados dois `homologacao.dump.enc` em `%LOCALAPPDATA%\continental-hml-backups`, com manifestos de restauração pelo mesmo usuário: `dad96ff03044f5d15486b2adee06c167` (16/10, 37 tabelas) e `ee9f404a92124b124c175696848eacaa` (21/10, 38 tabelas, snapshot anterior à migration de devolução de boleto). Ambos são **de homologação**, protegidos por AES-GCM/DPAPI; integridade atual e recuperação independente não foram revalidadas nessa investigação.

O backup **da origem** de 21/10, `b0072bdd3f7e2302fea9dd8e49f91d6d`, permanece identificado na máquina de Vinícius e não foi encontrado nos locais consultados por Vanderlei. Para o ensaio de recuperação da origem em G2, manter esse escopo; backups de homologação não o substituem. Nenhum arquivo/chave foi transferido ou exportado. Copiar `key.dpapi` não é comprovação de recuperação em outra conta/máquina.

Vanderlei relatou ausência de buckets no projeto GCP consultado e falta de acesso administrativo ao Neon para verificar snapshots/PITR/retenção. Esses recursos do Neon continuam **não verificados**, não declarados inexistentes. Janelas dos manifestos incluem captura e ensaio; datas de modificação e tamanhos dos arquivos criptografados não equivalem ao ponto de captura ou tamanho/hash do dump original. Pacotes de código e SQLs de migration não substituem backups de dados. A referência a documento/arquivo da candidata `9495ff9` não comprova sua implantação efetiva.

**Próximo encaminhamento:** sincronizar a documentação revisada via branch/PR — a cópia de Vanderlei não continha a evidência fresca G2 — e definir acesso fora da máquina ao artefato da origem e à chave por mecanismo seguro independente da conta Windows original, preservando os arquivos existentes. Depois preparar destino vazio isolado e executar a recuperação pelo usuário com conta própria, medir tempos e conferir integridade/dados/estrutura. Retenção, objetivos de recuperação e cobertura externa ainda precisam de definição/comprovação. Não criar armazenamento, exportar chaves ou restaurar por inferência desta devolutiva. G2 permanece aberto; registro documental local, ainda sem commit/envio.

## Relação de estoque comercial para conferência — 21/10/2026

**Retorno do usuário:** ainda não sabe identificar a rotina/sistema que atualiza os saldos. Registrar como mecanismo não identificado, sem presumir sincronização ausente ou desligada. A contagem física pode continuar com horário e movimentações registrados; o aceite do estoque para produção exige identificar o integrador existente, seu responsável, origem/destino, correspondência de produtos/variantes e uma execução recente com comparação correlacionada. Não criar, substituir nem ativar integração para preencher essa lacuna.

**Preparação somente leitura às 13:00:28 BRT.** [Evidência e hashes dos arquivos](evidencias/L-G2-ESTOQUE-CONFERENCIA-2026-10-21.json). Conforme orientação do usuário, os produtos vindos da Nuvemshop são produtos reais da loja e devem ser preservados. A relação não é uma carga de estoque de abertura nem um comando de importação/sincronização.

- **518 produtos comerciais / 518 variantes:** todos têm SKU e ID de produto Nuvemshop; nenhum foi classificado como teste por nome, saldo ou ausência de vínculo. Os cinco produtos anteriormente protegidos estão incluídos. Nenhuma divergência aritmética entre estoque do produto e soma das variantes nesses 518 produtos.
- **4 testes previamente identificados / 10 variantes:** separados exclusivamente pelos IDs já revisados e identidade conferida. As quatro divergências produto/soma das variantes pertencem a esse conjunto. Três desses testes compartilham um ID externo, sem coincidência com os 518 produtos comerciais; esse vínculo precisa de revisão antes de qualquer futura ação. Nada foi retirado, zerado ou excluído.
- **Vínculos a conferir:** nenhuma das 518 variantes comerciais tem `nuvemshopVariantId` preenchido. Isso não nega a origem comercial informada pelo usuário, mas impede presumir correspondência por variante sem conferência. Não preencher IDs automaticamente por nome/SKU ou apenas porque existe uma variante.
- **Atualização dos saldos:** há registros históricos de importação/sincronização/webhook no banco, com últimas ocorrências registradas em 04/09; os campos de configuração Nuvemshop da loja consultada estão vazios. Esses achados não comprovam nem refutam uma rotina externa atual. Identificar o mecanismo efetivo e a hora de atualização com o operador; `updatedAt` não é comprovação de sincronização. Nenhuma consulta à API Nuvemshop nem acionamento foi executado.

Arquivos privados, fora do Git, em `%LOCALAPPDATA%\logic-audit-backups\b0072bdd3f7e2302fea9dd8e49f91d6d\estoque-conferencia-20261021`:

| Arquivo | Conteúdo |
|---|---|
| `01_ESTOQUE_COMERCIAL.csv` | 518 linhas por variante, com identidade, SKU, vínculo externo e saldos registrados. |
| `02_TESTES_IDENTIFICADOS.csv` | 10 linhas dos quatro produtos de teste já identificados, para revisão separada. |
| `03_DIVERGENCIAS_E_VINCULOS.csv` | 532 ocorrências de cadastro/vínculo ou divergência local; não são 532 erros de estoque físico. |

**Como conferir:** abrir uma cópia do CSV em UTF-8, separador ponto e vírgula, importando IDs/SKUs como texto. Manter os campos coletados intactos. Preencher as colunas finais com quantidade observada na Nuvemshop, horário da consulta, quantidade física, horário da contagem, movimentações entre esses horários, responsável, resultado e observações. Campos em branco significam **não conferido**, nunca zero. Confirmar a identidade exata do produto/variante antes de comparar valores; se não houver correspondência segura, registrar a pendência. Não somar a coluna de total do produto repetida por variante nem descontar o buffer automaticamente. Estoque local, estoque Nuvemshop e estoque físico são três observações distintas; eventual diferença requer explicação e revisão própria, sem ajuste automático.

Os arquivos refletem uma fotografia do banco, não saldos em tempo real. Produtos/variantes mantêm as mesmas impressões da coleta das 12:05 BRT. O catálogo completo ficou em pasta privada com permissões herdadas da pasta de backup; o Git recebe apenas instruções e evidência resumida. **Contagem física, comparação com Nuvemshop e aceite comercial ainda não executados. G2 continua aberto.** Esta preparação não altera a política de estoque, não pausa nem dispara integrações, não importa dados e não publica a aplicação. Arquivos/documentação locais, ainda sem commit/envio.

## Referências legadas identificadas como simulação — 21/10/2026

**Leitura às 12:52:32 BRT, em transação REPEATABLE READ / READ ONLY, com loja de origem verificada.** [Evidência sanitizada](evidencias/L-G2-REFERENCIAS-SIMULADAS-2026-10-21.json). As duas referências antes chamadas de remotas são IDs locais `pay_sim_<timestamp>`, ligados a eventos `ASAAS_SIMULATOR`, `simulated=true`, com ID de pagamento, referência do pedido, valor e estado correspondentes. O código histórico de `origin/main` em `7f9b26e`, `app/api/webhooks/asaas/simulate/route.ts`, gera e persiste exatamente esse formato sem criar cobrança no provedor nesse fluxo.

| Pedido na origem legada | Valor nominal local | Conclusão restrita |
|---|---|---|
| #29 | R$ 440,00 | Referência com proveniência de simulação local correlacionada. |
| #30 | R$ 510,00 | Referência com proveniência de simulação local correlacionada. |

`PAID`/`RECEIVED` nesses registros não comprovam recebimento de dinheiro. Não consultar esses IDs artificiais como cobranças reais, gerar estorno ou encaminhá-los à conciliação do provedor. Preservar o histórico e a classificação de testes já revisada; nenhum registro foi alterado. A rota na candidata está desativada no código, mas o runtime publicado não foi conferido nesta leitura.

**Escopo resolvido:** identificação das duas referências não nulas do inventário. Zero chamadas ao Asaas; conta do provedor não verificada. Isso não prova ausência global de outras cobranças, recebimentos bancários ou obrigações fora desses registros. Impressões de pedidos, itens, carteiras e movimentos coincidem com a leitura das 12:05 BRT. Os pedidos #29/#30 pertencem à origem legada, não aos cenários #3–#8 da homologação.

**G2 continua aberto:** recuperação independente, confirmação física de estoque comercial, revisão de eventuais outras obrigações e preparação/execução da abertura no destino autorizado. Atualização local, ainda sem commit/envio ao GitHub.

## Classificação conferida no backup novo — 21/10/2026

**Ensaio local aprovado às 12:39–12:41 BRT; G2 permanece aberto.** [Evidência da comparação e classificação](evidencias/L-G2-CLASSIFICACAO-2026-10-21.json). Os dumps criptografados de 15 e 21/10 foram restaurados separadamente, com verificação SHA-256 do arquivo e da identidade da loja. A comparação por ID e SHA-256 do conteúdo integral das linhas confirmou os mesmos 24 pedidos, 33 itens e zero registros de histórico. O manifesto por registro permanece no diretório privado do backup, fora do Git; a evidência versionável contém apenas resumos e hashes.

O classificador do clone passou a aceitar também o hash exato do backup de 21/10, mantendo o snapshot antigo, a quantidade e a impressão integral dos pedidos exigidas. Nenhuma seleção por data/status nem aceitação de hash arbitrário foi introduzida. A auditoria registra o hash efetivamente usado; o lote anterior foi preservado porque corresponde ao mesmo conjunto já aprovado.

No clone atualizado: 24 classificações e 24 auditorias, pedidos/itens/histórico preservados e repetição sem duplicação. Nove verificações HTTP, três testes de relatórios e cinco testes de proteção passaram. Os relatórios comerciais excluem os testes, o histórico continua consultável e compras novas continuam comerciais; o ensaio de compra/devolução usa dados locais controlados, sem Asaas. Clone descartado e ausência conferida. Alterações do executor e documentação ainda locais, sem novo commit/publicação nesta etapa.

**Pendências após este ensaio:** as duas referências foram posteriormente identificadas como simulações locais, conforme seção acima. Restam confirmar estoque comercial físico, revisar eventuais outras obrigações, comprovar acesso/recuperação independente pelo usuário e preparar a janela final de abertura com backup, contenção dos escritores e comparação no destino autorizado. Classificação de relatórios não resolve cobranças, vínculos legados ou obrigações. Nenhuma conexão nova com a origem, operação financeira remota ou alteração em banco compartilhado ocorreu no ensaio de classificação.

## Backup fresco e ensaio de abertura — 21/10/2026

**Restauração e abertura local aprovadas; G2 permanece aberto.** [Evidência sanitizada](evidencias/L-G2-BACKUP-ENSAIO-2026-10-21.json). Candidata de runtime `9495ff9`; checkout documental `f2a55eb`. A origem foi identificada antes da captura e acessada somente leitura; `.env` foi selecionado explicitamente para não herdar o outro destino de `.env.local`.

- Captura/validação entre **12:12:30 e 12:13:20 BRT**; backup consistente do schema `public`, AES-256-GCM, chave DPAPI e ACL restrita, fora do repositório. Hash do dump: `e48959c523715bc217946d1bbec37275df50681eab0a1e43a19de7e5798a173a`. Localizador: `%LOCALAPPDATA%/logic-audit-backups/b0072bdd3f7e2302fea9dd8e49f91d6d`. Essa janela inclui restore/upgrade; o instante exato do snapshot do dump não foi registrado separadamente.
- Dois restores equivalentes do backup persistido; restore sanitizado, histórico/checksums, constraints, dados e sequências preservados. Quinze migrations pendentes aplicadas **somente nos clones**; diff vazio e segunda aplicação sem alteração de dados.
- Ensaio de abertura entre **12:13:35 e 12:15:24 BRT**, sem reconexão à origem: quatro produtos/dez variantes retirados, cinco produtos comerciais protegidos e 518 produtos ativos no clone. Estoques numéricos não foram reconciliados nem produtos excluídos.
- Duas carteiras abertas com baixa auditada dos 475 pontos de teste, dois ajustes/duas auditorias, movimentos e 24 pedidos históricos preservados. Replay sem duplicar ajustes. Isso não altera nem autoriza baixa nos saldos do banco de origem.
- Nove verificações HTTP passaram, incluindo catálogo, pedidos, carteiras e recusas de acesso. Três testes de abertura/compra passaram: 20 comandos legados recusados e uma compra controlada local; sem chamadas Asaas. Cinco testes das proteções do executor passaram. Clone descartado e ausência conferida.

**Classificação dos pedidos no backup novo:** estava pendente nesta primeira rodada; foi conferida e reensaiada posteriormente às 12:39–12:41 BRT, conforme seção acima. A prova antiga permanece histórica e a nova execução tem evidência própria.

**Recuperação independente:** o usuário confirmou que será o operador alternativo. A execução acima ocorreu pela conta Windows atual e não demonstra acesso independente. Próxima prova: o usuário obtém o backup e a chave pelo mecanismo aprovado, em conta/ambiente cuja independência seja verificada, restaura em destino novo isolado e confere integridade. Não copiar `key.dpapi` supondo portabilidade. Ainda faltam definir/comprovar acesso independente, cópia fora desta máquina, retenção e RPO/RTO; tempos locais não são RPO/RTO aprovados.

**Condições restantes de G2:** recuperação pelo operador alternativo; revisão de eventuais outras obrigações e estoque comercial físico; backup/cutoff da janela final, contenção dos escritores, executor específico e comparação antes/depois no destino autorizado. As duas referências legadas foram identificadas como simulações locais às 12:52 BRT. O manifesto foi conferido para o backup de 21/10; atividade posterior exige nova conferência. Nenhuma migration, classificação, alteração de estoque/pontos ou abertura foi aplicada à origem/homologação compartilhada. Evidências e pendências do inventário abaixo conservam seu horário de coleta.

## Inventário atualizado — 21/10/2026

Leitura da origem às **12:05:26 BRT / 15:05:26 UTC**, com identidade da loja conferida e transação `REPEATABLE READ / READ ONLY` verificada. Fonte de conexão: `.env`; `.env.local` já aponta para outro destino e não foi usado na auditoria. Nenhuma credencial é registrada. [Evidência sanitizada](evidencias/L-G2-INVENTARIO-ORIGEM-2026-10-21.json). Código de origem `7f9b26e`, candidata integrada `9495ff9`.

| Item | Observação atual | Pendência de abertura |
|---|---|---|
| Catálogo | 522 produtos, 528 variantes, 18 marcas e 10 categorias; contagens coincidem com 15/10. | Conferir estoque comercial físico e identidade dos itens; contagens iguais não comprovam linhas inalteradas. |
| Quatro produtos de teste | IDs previstos encontrados, dez variantes; divergências de estoque preservadas: aspirador vermelho 1/10, calça 13/30, camisa branca 16/30, camisa preta 8/30. Cinco produtos protegidos encontrados. | Retirada não comprovada na origem. Valor nulo nesta coleta não distingue coluna ausente de campo vazio, nem comprova disponibilidade na aplicação. Conferir identificação/imagem e vínculos no cutoff antes da ação autorizada. |
| Pedidos | 24 pedidos, 33 itens, todos sem histórico de status; 33 itens sem vínculo de variante. Dez pendentes, quatro pagos e dez cancelados. Duas referências de pagamento remoto. | Separar classificação de teste de obrigações reais. Consultar privadamente as duas referências no provedor antes da abertura; rótulo legado do meio não prova estado financeiro. Nenhuma consulta do provedor nesta rodada. |
| Carteiras | Duas, com saldos 0 e 475; dois movimentos; pending=0. Campos modernos de dívida/accountingReady ausentes no schema de origem. | Não interpretar campo ausente como dívida zero ou carteira conciliada. Validar ledger e classificação antes de ajuste; não reutilizar números históricos como autorização. |
| Estrutura | 40 registros de migrations, 20 nomes distintos repetidos, todos concluídos e com checksums compatíveis. Quinze migrations da candidata ainda não constam aplicadas. Tabelas modernas de operações/fatos/reservas/lotes ausentes; quatro eventos na tabela legada de webhook. | Novo backup e ensaio da cadeia atual em clone. Duplicações no histórico já existiam no inventário antigo; não remover registros. Não aplicar somente a migration de boleto na origem antiga. |

As contagens e divergências agregadas coincidem com o inventário anterior, mas não foi demonstrada igualdade integral entre as linhas antigas e atuais. Foram guardadas impressões para comparação futura; esta leitura não substitui backup ou captura no cutoff. O schema legado não permite inferir ausência de obrigações pela ausência de filas modernas. Os estados dos pedidos são locais, sem confirmação financeira nova.

**Próxima ação G2:** preparar backup fresco e ensaio da cadeia atual em clone isolado, junto da conferência privada das obrigações e da prova de recuperação por operador alternativo. A abertura exige comparação antes/depois, responsável e janela definidos. Main/banco de origem não receberam migrations, classificação, ajustes de estoque/pontos ou qualquer outra mutação nesta rodada. Nenhum teste de recuperação foi repetido agora e G2 permanece aberto. As seções abaixo conservam os detalhes dos ensaios históricos.

Revisão de 16/10/2026. Complementa o [checklist G1–G8](CHECKLIST_PRODUCAO_G1_G8.md), o [procedimento de implantação](../diversos/AUDITORIAS/operations/operations/DEPLOYMENT-RUNBOOK.md) e o [procedimento de recuperação](../diversos/AUDITORIAS/operations/operations/BACKUP-RESTORE-RUNBOOK.md). **Preparação e ensaio em clone; abertura produtiva não executada.**

## Identidades e limites

| Referência | Identidade / uso |
|---|---|
| Código de origem consultado | `origin/main` `7f9b26e062ec2654420fecffb6dd78ad3ba1e017`, somente leitura. |
| Código candidato revisado | `55a300313570f2a504a8f042ba7f228cd7382e58`, CI aprovada; publicação dessa candidata pendente. |
| Banco de abertura | Banco existente indicado pelo operador, ligado à main. Identidade/configuração atuais devem ser conferidas no cutoff; não substituir pela conexão de homologação. |
| Snapshot usado nos ensaios | Origem capturada em 15/10/2026 às 18:43:55.572 UTC. Backup restaurável SHA-256 `51f0d8d7f80fb9910114928450753e46cfd86ac571e9acdd711d745fda1a65f9`. Não representa estado atual nem RPO da futura implantação. |
| Loja desse snapshot | `536bfa58-0531-49e8-9209-3a046281e516`. Os IDs abaixo pertencem a essa origem. |
| Loja de homologação | `3a82b33c-3646-4272-9a89-80bb1ba327a5`. Possui pedidos financeiros #1–#8 e identidades próprias; não aplicar a seleção da origem nela. |
| Cloud Run conhecido | Homologação: projeto `continental-511812`, região `southamerica-east1`. Não comprova identificação/configuração do futuro serviço produtivo. |

Não foi acessado banco remoto nesta revisão. Os scripts revisados exigem clone local descartável e identidade de execução. Não remover essas proteções, trocar suas URLs nem reutilizá-los como executores genéricos de produção.

**Novo ensaio aprovado na candidata atual:** de **19:33:33 a 19:35:07 BRT em 16/10**, run `b90a3a5a7c3960def95338ec1a97d716`. Reutilizado o backup criptografado, sem reconectar à origem; dois restores equivalentes, sanitização/restore do clone, histórico de migrations e upgrade aprovados, dados/sequências preservados e diff vazio. Retirada de quatro produtos/dez variantes, abertura de duas carteiras e classificação de 24 pedidos aprovadas; replay de carteiras e classificação sem duplicação. Nove verificações HTTP, três testes de relatórios no clone e cinco testes de proteção do executor passaram. Contêiner principal do ensaio removido e ausência conferida. [Evidência sanitizada e hashes do código](evidencias/L-G2-REVISAO-ABERTURA-2026-10-16.json).

Este novo ensaio cobre o dashboard e a API de fidelidade atuais sobre o histórico restaurado/classificado. Os 20 comandos de legado e a compra nova completa do ensaio de abertura anterior continuam evidência separada; não foram contados como nova execução nessa rodada. Duração de aproximadamente 94 segundos mede apenas este ensaio local, sem representar RTO produtivo.

## 1. Produtos e estoque: seleção exata

A decisão do operador já está registrada: indisponibilizar os quatro produtos de teste, preservando histórico. A imagem e os vínculos identificam o aspirador vermelho, mesmo que seu nome na origem seja apenas “Aspirador de Pó”.

| Produto no snapshot de origem | ID | Variantes | Estoque do produto / soma das variantes observados |
|---|---|---:|---:|
| Aspirador de Pó — automotivo vermelho | `6a6e98eb-98c3-4ba2-aede-a357d43893cf` | 1 | 1 / 10 |
| Calça Jeans | `622731a7-0158-486c-9626-0a739b3ddb91` | 3 | 13 / 30 |
| Camisa Branca | `6178ba96-b383-4e50-be1d-93a506912011` | 3 | 16 / 30 |
| Camisa Preta | `fdd4cc6a-c8e4-4a58-b45c-04a6d5c07e13` | 3 | 8 / 30 |

**Tratamento ensaiado:** definir `retiredAt` no produto e nas variantes, incrementando versões correspondentes. Não zerar/recalcular estoque nem excluir registros. A divergência numérica de estoque desses testes permanece preservada e não é apresentada como saldo disponível para venda.

**Critério de conferência:** somente esses quatro produtos/dez variantes ficam indisponíveis; os demais preços, estoques, IDs, vínculos e históricos permanecem iguais ao baseline. O clone passou de 522 para 518 produtos ativos; essa contagem é histórica e deve ser recalculada se o inventário mudar.

Proteção explícita dos três aspiradores comerciais e dois acessórios, como conjunto:

```text
c6b3097f-6174-44f1-86c9-e06aba7c9733
0486f861-4e39-426a-81ce-8b39f60a177f
5e86739a-6114-4df1-a15a-df88b7a349c3
7fd834af-d2be-4ea5-8d30-9790bd48a79e
bc076f2d-740c-45f3-84c5-9d0fb8657d84
```

Fontes: [identidade e ensaio dos produtos](evidencias/L-BANCO-PRODUTOS-TESTE-2026-10-15.json), [auditoria de estoque e vínculos](evidencias/L-BANCO-TRATAMENTO-2026-10-15.json), `scripts/lib/restored-test-products.mjs`.

**Pendente para abertura:** revalidar essas identidades, imagens, variantes e vínculos na fotografia atual e confirmar o saldo comercial dos produtos que continuarão disponíveis. Um saldo de banco sem divergência aritmética não comprova contagem física. Não restaurar ao estoque os itens dos pedidos legados para “corrigir” o saldo.

## 2. Pedidos históricos: preservar e classificar

O snapshot contém **24 pedidos e 33 itens**. Nos itens sem vínculo de variante: 16 não têm produto presente; 16 possuem candidato atual com dimensões e um tem candidato com dimensão histórica incompleta. Compatibilidade atual não comprova qual variante foi vendida, nem autoriza preenchimento automático ou movimentação de estoque.

O ensaio usa `OrderReportingExclusion` com motivo `USER_CLASSIFIED_TEST_DATA`, lote identificado e uma auditoria por pedido. Resultado esperado para esse snapshot: 24 classificações, 24 auditorias, zero pedidos comerciais antigos e todos os 24 pedidos ainda consultáveis no histórico. Repetir o mesmo lote não duplica registros.

O classificador exige hash do backup, quantidade e impressão dos pedidos exatos; não classifica por data, nome, ausência de intenção ou status `PAID`. Uma venda nova não classificada continua comercial. As migrations apenas criam a estrutura; não fazem essa classificação.

Fontes: [classificação e replay](evidencias/L-INDICADORES-CLASSIFICACAO-CLONE-2026-10-16.json), `scripts/lib/restored-order-reporting.mjs`, `tests/clone/restored-reporting.test.ts`.

**Pendente para abertura:** manifesto privado com IDs e impressões frescos, identificação de qualquer atividade nova, conciliação/isolamento das obrigações e executor final revisado para o destino autorizado. Classificação de relatório não neutraliza gateways, filas, saldos ou obrigações por si só. Não fabricar `FinancialFact`, intenção, reserva, vínculo histórico ou estorno para encerrar legado.

## 3. Carteiras: ajuste auditado, sem apagar movimentos

No snapshot: duas carteiras legadas, saldos **0 e 475**, dois movimentos originais, nenhum lote; `accountingReady=false`, sem pendências/dívidas ou leases de expiração. Esses valores não são saldos atuais da homologação.

O ensaio confere esse baseline dentro da transação e recusa diferenças. Registra dois ajustes administrativos identificados (inclusive o ajuste de valor zero), duas auditorias e abre as carteiras com saldo/pending/dívida/lifetime zero e `accountingReady=true`. Os dois movimentos originais permanecem. Nenhuma origem de lote ou validade é inventada; o ajuste é encerramento de dados de teste, não estorno de pedido.

**Critério de conferência:** redução de exatamente 475 pontos de teste nesse snapshot, dois ajustes, duas auditorias, preservação dos movimentos originais e replay sem duplicação. Qualquer lote, dívida, pendência, movimento moderno ou saldo novo exige revisão; não adaptar os números para forçar o ensaio a passar.

Fontes: [abertura e compra nova](evidencias/L-BANCO-ABERTURA-CLONE-2026-10-15.json), `scripts/lib/restored-opening.mjs`. A proteção de pedidos legados foi exercitada no ensaio anterior com 20 comandos recusados; o relatório comercial separado não substitui essa proteção.

**Pendente para abertura:** inventário fresco das carteiras e revisão do executor/auditoria final. A autorização para preservar e tratar testes não permite apagar eventual saldo comercial surgido depois do snapshot.

## 4. Migrations e comparação antes/depois

A cadeia deve ser derivada do histórico real do destino e dos arquivos da release; não fixar “13 migrations pendentes” a partir de um ensaio antigo. A migration `20261016193000_order_reporting_exclusion` foi aplicada à homologação por Vanderlei, mas isso não a aplica ao banco principal.

| Etapa | Antes | Resultado verificável depois |
|---|---|---|
| Migrations | Histórico/checksums, constraints, contagens, sequências e impressão dos dados; nenhuma migration falha sem investigação. | Histórico atualizado, diff vazio, constraints esperadas, dados/sequências preservados; segunda aplicação sem trabalho novo. |
| Indisponibilidade de testes | IDs, imagem do aspirador, variantes, versões, vínculos e produtos protegidos. | Alterações só nos campos previstos dos alvos; indisponibilidade na aplicação e preservação dos demais registros. |
| Carteiras | IDs privados, versão, ledger, lotes, pendências/dívidas/leases, classificação explícita. | Ajustes/auditorias identificados, conservação histórica e replay sem duplicação. |
| Classificação de pedidos | Manifesto completo dos pedidos de teste, hash, loja e ausência/isolamento de novas obrigações. | Uma classificação/auditoria por alvo; histórico acessível; nenhuma exclusão inferida para pedidos novos. |
| Leitura da aplicação | Revisão/configuração e tenant conhecidos. | Catálogo correto, históricos preservados, métricas no escopo correto, recusas de acesso indevido e recuperação de pedidos. |

Conter e drenar os escritores conforme o runbook antes de uma janela real. `CHECKOUT_PAUSED` sozinho não congela usuários, carrinho, Admin, webhook ou scripts. A sanitização feita no clone é exclusiva do ensaio: **não sanitizar o banco real nem restaurar o dump sanitizado como recuperação comercial**.

## 5. Roteiro de recuperação por operador alternativo

Vinícius já executou e validou o restore na máquina/conta de Vanderlei, sem participação dele, conforme o registro de 21/10 no início deste documento. Permanece pendente o acesso duradouro por conta pessoal e a recuperação operacional completa. O roteiro abaixo continua aplicável à janela final; não exige repetir o mesmo ensaio sem uma lacuna específica. Copiar `key.dpapi` não torna a chave independente da conta Windows original.

1. Registrar operador principal/alternativo, backup escolhido, cutoff, cobertura, retenção, RPO/RTO acordados e mecanismo de acesso independente. Reutilizar recursos existentes confirmados; localização/permissões ainda não demonstradas ficam pendentes.
2. Disponibilizar o artefato criptografado e acesso à chave pelo mecanismo aprovado, fora do Git/chat. Registrar somente referências e versões. Nenhum upload para serviço novo é realizado por este pacote.
3. O operador alternativo obtém acesso, valida a integridade e restaura em banco novo, vazio e isolado, sem gateway, e-mail, consumidores ou integrações reais. Registrar início, fim e dificuldades de acesso.
4. Conferir schema, contagens/impressões, sequências, constraints, histórico de migrations e invariantes de pedidos/estoque/pontos. Cobrir separadamente roles/grants, arquivos externos e configuração, pois não estão integralmente no dump do schema `public`.
5. Registrar ponto recuperado e tempos de acesso, restauração, validação e conciliação. Comparar com RPO/RTO acordados; não declarar sucesso operacional só pelo download ou `pg_restore` concluído.
6. Documentar como conciliar eventos financeiros posteriores ao cutoff antes de qualquer promoção. Restore do banco não desfaz cobrança/estorno no provedor e não autoriza reenviá-los.

| Campo do relatório do segundo operador | Preenchimento nesta etapa |
|---|---|
| Operador alternativo e mecanismo independente usados | Vinícius confirmado; pacote age em outra máquina/conta de Vanderlei, sem atuação dele. Acesso por conta pessoal ainda não comprovado. |
| ID/referência do backup, hash e cutoff | Backup de origem `b0072bdd3f7e2302fea9dd8e49f91d6d`, hash completo na evidência; janela 21/10, 15:12:30–15:13:20 UTC. Snapshot exato não isolado; atualizar no cutoff final. |
| Destino isolado / ambiente de origem confirmado | Docker descartável no segundo computador; identidade e hash comparados com a referência da origem. |
| Integridade, dados, sequências e configuração | 23 tabelas, estrutura/sequências aprovadas pelo resultado recebido. Configuração externa não coberta. |
| Tempos e ponto recuperado / RPO / RTO | ~6,56 s apenas do ciclo automatizado. Metas 15/60 min aprovadas; atendimento completo não demonstrado. |
| Cobertura externa: arquivos, roles, segredos, eventos | Pendente verificação |
| Decisão e revisão | Pendente; nenhuma promoção decorrente deste roteiro |

## 6. O que ainda separa este pacote da execução produtiva

- **Leno:** baseline fresco e manifesto final por identidade, saldos comerciais e obrigações; comparação com este ensaio; revisão do tratamento final. Main/banco continuam somente leitura para o assistente.
- **Vanderlei com Leno:** recuperação independente, contenção de todos os escritores, destino/configuração da abertura e janela coordenada.
- **Executor final do tratamento:** ainda precisa ser preparado e revisado para uma execução especificamente autorizada. Os scripts atuais são de clone, com validações e auditorias próprias de ensaio; não basta trocar a conexão. Preservar releitura sob bloqueio, precondições, transação, auditoria e idempotência no procedimento final.
- **Operador responsável:** aplicar somente após essas condições, verificar antes/depois e registrar a decisão. G2 só fecha com evidências do destino; não fecha pela existência deste documento.

As decisões já tomadas sobre os quatro produtos, o banco existente e preservação de histórico não precisam ser solicitadas novamente. Lacunas reais são evidência atual, estoque comercial, execução final específica e recuperação independente.
