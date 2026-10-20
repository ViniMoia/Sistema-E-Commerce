# Continuação das pendências de Vanderlei — 20/10/2026

Referência vigente: seção 69 da cópia de direcionamento de 20/10, originada em
`3c3bf725e96f33bcb38143cfd2e3f4c017298049`. A publicação de `17fd1a7` está
concluída; as referências antigas a deploy pendente não são novas tarefas.

## Entregas desta rodada

- Devolutiva e inventário sanitizado preparados para publicação:
  [devolutiva da seção 69](DEVOLUTIVA_VANDERLEI_SECAO_69_2026-10-20.md) e
  [inventário G6](evidencias/V-G6-INVENTARIO-2026-10-20.json).
- Inicialização do navegador de testes passa a verificar o processo, a porta,
  a resposta DevTools e a página, dentro de um limite de 20 segundos. Conexão
  WebSocket também tem timeout. Falhas distinguem encerramento, spawn e timeout.
  Diagnósticos contêm somente códigos/categorias, sem stderr bruto.
- Descarte aguarda encerramento do navegador; um processo que não encerra
  preserva seu perfil temporário e faz o teste falhar. Não se remove perfil ativo.
- Seis regressões de ferramentas verificam prontidão em fases, saída prematura,
  executável inexistente, timeout, endpoint externo e término por sinal.
- TypeScript e lint excluem `artifacts/`, já ignorado pelo Git, para que fontes
  arquivadas de publicações antigas não contaminem a análise da árvore atual.
  A main foi consultada somente leitura e não foi alterada.
- Cliente Prisma local regenerado a partir do schema vigente, sem conexão nem
  migration em banco compartilhado. A primeira rodada revelou cliente antigo
  sem `OrderReportingExclusion`; a regeneração corrige a preparação local.
- Corrigido fallback de e-mail: em `NODE_ENV=production`, chave Resend ausente
  resulta em falha de envio, nunca em entrega simulada. O provedor de
  desenvolvimento também recusa uso direto em produção e não imprime conteúdo,
  destinatário ou link de reset no console em desenvolvimento.

## Diagnóstico da CI

A execução `39421575989`, do commit documental `3eb4023`, falhou com
`BROWSER_START_FAILED` antes dos sete testes de checkout. As outras 40 suítes
passaram. O harness descartava stderr e não diferenciava saída do processo de
demora na inicialização. **A causa exata daquela execução não é recuperável
a partir desses logs.** A alteração trata essas lacunas e permite diagnosticar
uma recorrência; não se atribui a falha histórica a sandbox, memória ou lentidão
sem evidência.

A CI completa do novo SHA deve ser vinculada à conclusão desta rodada. A CI
aprovada de `17fd1a7` permanece a referência da revisão atualmente publicada.

### Validação local

- 846 testes unitários em 94 arquivos aprovados, incluindo três novas regressões
  de seleção do provedor de e-mail e proteção de conteúdo.
- 27 testes de ferramentas aprovados, incluindo seis novos do navegador.
- Nove testes reais de navegador aprovados: sete de checkout, um de dashboard
  e um de fidelidade. PostgreSQL descartável com 34 migrations, servidor Next
  isolado e perfil próprio; nenhuma credencial de provedor real nos testes.
- TypeScript aprovado; lint sem erros, com 17 avisos existentes.
- Provas negativas de isolamento aprovadas; nenhum contêiner `logic-audit-pg-`
  permaneceu ativo após o descarte.
- A primeira rodada de navegador passou os sete cenários de checkout, mas
  falhou no dashboard/descarte de fixtures por cliente Prisma antigo. Após
  regeneração, a rodada de nove testes encerrou integralmente com sucesso.
- Build, runtime otimizado, capacidade e contêiner Linux do novo SHA serão
  comprovados pela CI completa; não reutilizar os números da candidata antiga
  como se fossem uma execução nova.

## Configuração real de e-mail e Storage: bloqueio confirmado

Consulta somente leitura à revisão `continental-hml-17fd1a7-review`, em
20/10/2026 às **12:00:24 BRT / 15:00:24 UTC**:

| Variável | Revisão de teste | Arquivo privado `.env.homologacao` |
|---|---|---|
| `RESEND_API_KEY` | Ausente | Presente; valor não divulgado |
| `EMAIL_FROM` | Ausente | Ausente |
| `SUPABASE_URL` | Ausente | Ausente |
| `SUPABASE_SERVICE_ROLE_KEY` | Ausente | Ausente |

O código aceita também `NEXT_PUBLIC_SUPABASE_URL` para a URL, mas a chave de
serviço ausente já impede upload no backend. Imagens previamente publicadas
carregarem não comprova permissão de escrita. Não foram chamados provedores,
enviados e-mails ou escritos objetos nesta conferência.

Sem chave Resend, o código da revisão publicada ainda seleciona o simulador
de desenvolvimento. Isso é um risco de sucesso fictício e exposição de conteúdo
de reset em logs; não foi provocada solicitação de reset para demonstrá-lo.
A correção desta rodada só terá efeito remoto quando uma nova candidata
aprovada for publicada em etapa coordenada.

Próxima ação do operador: confirmar remetente e projeto Storage de homologação
no arquivo privado. Vanderlei prepara referências/versionamento dos segredos,
compara a configuração atual e executa a alteração na janela revisada. A
presença de chave local não aprova domínio/remetente, entrega nem reset.

## G6: proposta pronta; execução ainda depende de coordenação

A devolutiva contém cadência/custo propostos, recursos, permissões, critérios
de parada, prevenção de execução simultânea e recuperação. Permanecem:

| Pendência | Responsável / próximo passo |
|---|---|
| Estado implantado de Cloudflare/Vercel e execuções manuais | Administradores dessas contas + Leno; fornecer inventário ou acesso de leitura a Vanderlei |
| Scheduler e IAM geral | Administrador Google Cloud + Vanderlei; revisar a habilitação necessária das APIs, sem presumir ausência de agendas ou privilégios |
| Responsável por alertas e substituto | Operador nomeia e confirma disponibilidade; contato fica em canal privado |
| Caso, baseline, cadência e janela | Leno revisa o caso; Vanderlei executa infraestrutura; operador confirma orçamento/janela |
| Canais, Jobs, agendas e políticas | Vanderlei provisiona após revisão da proposta; não aplicar o manifesto inteiro do serviço web |
| Alertas recebidos, ausência/falha e recuperação | Ensaio assistido no destino; configuração isolada não fecha G6 |

O plugin Vercel foi localizado, mas não está instalado/conectado. Não foi
localizada conexão Cloudflare disponível. Não se solicita token no chat.

## Pendências de fechamento que esta rodada não aprova

- E-mail real, recuperação de senha e upload/leitura/autorização no Storage:
  dependem da configuração confirmada acima e da conta/destinatário do ensaio.
- Frete/expedição/rastreio: precisam da configuração comercial e de cenário
  acordado; a cotação Correios anterior teve timeout e não é aceite.
- Capacidade/custo no Cloud Run/Neon: testes isolados não medem o destino.
  A candidata permanece compartilhada para o aceite; carga remota depende
  de janela e provedores controlados, sem liberar checkout por inferência.
- Recuperação por operador alternativo: exige operador identificado, acesso
  ao backup e execução por ele; teste pelo mesmo executor não substitui isso.
- Dashboard/fidelidade, retorno físico, chargeback e triagem financeira:
  Leno conduz o aceite; Vanderlei fornece acesso/evidências. Não rearmar filas
  históricas ou repetir estornos.

Nenhuma alteração em Cloud Run, tráfego, flags, webhook, agendas, permissões,
contas ou banco compartilhado nesta rodada. `CHECKOUT_PAUSED=true`,
`APP_MAINTENANCE_MODE=false` e os três controles financeiros desligados continuam
como condições da publicação preservada. Não houve novo deploy.
