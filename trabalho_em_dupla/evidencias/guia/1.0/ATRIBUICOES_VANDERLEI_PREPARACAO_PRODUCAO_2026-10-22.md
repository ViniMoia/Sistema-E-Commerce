# Atribuições de Vanderlei — preparação para produção

**Versão:** 1.0 · **Data:** 22/10/2026 · **Fuso:** America/Sao_Paulo.

**Objetivo:** avançar segurança, automação e operação enquanto Vinícius e o agente responsável pela integração detalham a ligação SMB Store → Nuvemshop → Plataforma Continental.

Este guia organiza as entregas e o retorno esperado. Não declara produção aprovada nem autoriza, por si só, operações financeiras, ajustes de estoque, promoção de tráfego ou contratação de recursos pagos. As preparações e verificações sem efeitos comerciais podem avançar; os ensaios que processam pendências exigem janela e escopo coordenados.

## 1. Base conferida e entregas já realizadas

Referências remotas consultadas em 22/10/2026:

- `origin/main`: `7f9b26e062ec2654420fecffb6dd78ad3ba1e017`, somente leitura.
- `origin/homologacao_teste`: `1b09934e66c592ef0cd72aa1a80d1c4e53f35d28`.
- Candidata publicada documentada: `9495ff942e832db6588219e57163982b246e16d7`.

Segundo a [publicação registrada em 21/10](https://github.com/ViniMoia/Sistema-E-Commerce/blob/1b09934e66c592ef0cd72aa1a80d1c4e53f35d28/trabalho_em_dupla/PUBLICACAO_HOMOLOGACAO_9495FF9_2026-10-21.md), já foram concluídos:

| Entrega | Evidência registrada |
| --- | --- |
| Publicação da candidata | Revisão `continental-hml-9495ff9-review`, pronta, com URL de teste e 0% do tráfego principal. |
| CI da candidata | Aprovada para o SHA exato. |
| Migration de devolução de boleto | Aplicada em homologação; 35 migrations, sem pendência/falha e sem diferença residual de schema. |
| Aplicação e Jobs | Mesmo digest Linux/amd64 `sha256:7a360eb28fd93be1606d6b8c1591e12c61c3d1db5f06fdb51ca86fe81d056202`. |
| Jobs de pagamentos e supervisão | Criados/prontos, sem execução ou agenda comprovada naquele registro. |
| Métrica, canal e políticas de alerta | Recursos preparados; canal/políticas ainda desabilitados, sem entrega comprovada. |

**Não repetir deploy, migration ou criação desses recursos apenas para produzir evidência.** Conferir o estado atual e registrar somente diferenças ou lacunas. As informações acima são evidências versionadas, não uma nova inspeção ao ambiente publicada em 22/10.

## 2. Ordem de trabalho

| Prioridade | Frente | Resultado esperado |
| --- | --- | --- |
| 1 | G6 — acionadores, webhook e consumidores | Plano executável de transferência, com exclusividade de processamento e pendências conhecidas. |
| 2 | G5 — segurança | Revisão da configuração efetiva e correções necessárias identificadas. |
| 3 | G6 — alertas | Roteiro e condições para comprovar falha, ausência e recuperação com recebimento humano. |
| 4 | G7 — capacidade, experiência e frete | Limites sustentáveis e lacunas dos fluxos essenciais identificados na candidata. |
| 5 | G8 — publicação, contenção e retomada | Procedimento de implantação e recuperação compatível com a versão e o banco. |
| 6 | G5/G8 — e-mail e recuperação de senha | Preparação concluída e dependências exatas para o ensaio real. |

## 3. G6 — acionadores, webhook e consumidores

### Pode adiantar agora

- Inventariar Vercel, Cloudflare, Cloud Run, Scheduler e invocações manuais: responsável, ambiente, URL, revisão, flags, agenda, última execução e eventual processamento em voo. Registrar explicitamente onde não houver acesso.
- Reaproveitar o projeto `continental-511812`, região `southamerica-east1`, e os Jobs já criados. Não solicitar novamente esses identificadores.
- Conferir o destino efetivo do webhook Asaas. No último registro ele ainda apontava para Vercel; a candidata Cloud Run estava com processamento desabilitado.
- Consultar backlog, leases e operações em revisão sem rearmar, drenar ou reenviar casos antigos. Encaminhar pendências financeiras para nossa triagem.
- Preparar a sequência de transferência: conter acionadores antigos, conferir requisições em voo, preparar receptor apto a persistir eventos, transferir destino e ativar processamento coordenadamente. Prever recuperação de eventos durante a transição.
- Definir limites de lote, concorrência, cadência, tentativas e custo. Considerar que o Job de pagamentos também alcança conciliação, expiração e outbox.

### Precisa retornar

1. Inventário datado com comprovado, não comprovado e sem acesso.
2. Plano de transferência com passos, responsável, critérios de interrupção e reversão.
3. Janela nova proposta; a janela histórica de 21/10 não está vigente.
4. Após o ensaio combinado: evidências de processamento automático, recuperação após falha e ausência de efeitos duplicados.

**Limite:** `parallelism=1`, zero leases em uma consulta ou ausência de cron local não comprovam exclusividade global. Não ativar um novo consumidor enquanto o antigo puder continuar processando sem coordenação.

## 4. G5 — segurança

### Pode adiantar agora

- Conferir permissões de serviço, banco e segredos, separação entre homologação/produção e necessidade dos acessos amplos já identificados. Preparar alterações de acesso sem remover permissões às cegas.
- Verificar Admin, isolamento por loja, sessões/cookies, logout, Origin e proteção das rotas de consumidores na candidata. Reutilizar provas anteriores compatíveis, identificando revisão e alcance.
- Conferir autenticação do webhook no destino e a situação da rotação do bypass anteriormente apontado. Nunca transcrever seu valor.
- Verificar ausência de dados sensíveis de cartão em logs/persistência sem coletar ou publicar esses dados.
- Conferir bloqueios no servidor de meios não homologados, incluindo débito adiado, e recusa de upload para usuário e administrador.

### Precisa retornar

Matriz por controle: revisão/ambiente, verificação realizada, resultado, evidência sanitizada, pendência, responsável e correção proposta. Para mudanças em código, informar commit/PR e CI; para mudanças de configuração, informar estado anterior/posterior sem segredos.

## 5. G6 — alertas e atendimento

### Pode adiantar agora

- Conferir os recursos existentes e preparar cenários de atenção, falha, ausência de execução e recuperação.
- Verificar cobertura dos Jobs de supervisão e pagamentos; o alerta de um não comprova monitoramento do outro.
- Propor cadência, limites e procedimento de resposta. Reaproveitar o contato já informado, sem publicá-lo em documentos.
- Identificar o que depende de confirmação de Vinícius: responsável, substituto, disponibilidade e janela.

### Precisa retornar

Roteiro pronto e, depois da execução combinada, horários de disparo/recebimento/atendimento/recuperação e identificação do cenário. Não usar pedido financeiro pendente para provocar uma falha. Recurso criado não equivale a alerta entregue; incidente encerrado no monitoramento não equivale a caso financeiro resolvido.

## 6. G7 — capacidade, experiência e frete

### Pode adiantar agora

- Levantar limites efetivos de instâncias, concorrência, conexões/pool, suspensão do Neon e consumo atual. Preparar teste com teto de duração/carga e critérios de interrupção.
- Estimar consumo e custo dentro do orçamento atual. Não contratar upgrade ou criar carga recorrente para esta preparação.
- Conferir desktop/mobile: catálogo, seleção de variantes, carrinho, recuperação de pedido, estados financeiros e acesso às ações dos painéis administrativos.
- Revisar modalidades de entrega ofertadas, contratos, cobertura, peso/dimensões e evidências de cotação, prazo e rastreio. O teste de um pedido J&T não aprova Correios; o timeout anterior de Correios continua sem cotação aceita até prova posterior.
- Separar navegação e leituras dos testes que criam pedido, reserva, cobrança ou etiqueta. Estes últimos entram no roteiro coordenado, com casos identificados.

### Precisa retornar

Configuração atual, limites propostos, consumo/custo estimado com premissas, plano de teste e resultados efetivamente medidos. Para interface/frete, informar cenário, revisão, resultado e evidência, distinguindo testes isolados de validação no ambiente publicado.

## 7. G8 — publicação, contenção e retomada

### Pode adiantar agora

- Consolidar sequência de implantação com SHA, digest, migrations, revisão, domínio, configuração e condições de promoção.
- Descrever pausa de novas compras, continuidade das obrigações financeiras e congelamento de todos os escritores quando necessário. `CHECKOUT_PAUSED` não congela o banco.
- Preparar drenagem, conferência pós-publicação e retomada. Reversão de aplicação deve preservar migrations aditivas, dados e evidências.
- Complementar a cobertura operacional de G2: acessos pessoais, custódia/retenção, configurações e recursos externos ao dump. Reaproveitar a recuperação técnica já realizada; não pedir outro ensaio idêntico sem lacuna concreta.
- Distinguir as metas aprovadas de RPO de 15 minutos/RTO de 60 minutos dos tempos efetivamente comprovados.

### Precisa retornar

Procedimento executável, responsáveis, evidências reaproveitadas, lacunas remanescentes e condições para autorizar cada fase. Main e seu banco permanecem somente leitura; este guia não libera migrations ou abertura no destino produtivo.

## 8. G5/G8 — e-mail e recuperação de senha

### Pode adiantar agora

- Conferir os bindings existentes, remetente, origem dos links e permissões de envio necessárias.
- Diagnosticar a credencial pelo uso necessário: o `401 restricted_api_key` observado na listagem de domínios, isoladamente, não comprova incapacidade de enviar nem justifica substituir a chave.
- Preparar configuração e ensaio com conta/destinatário controlados. A definição do domínio/remetente depende de Vinícius.

### Precisa retornar

Dependências exatas e procedimento pronto. Depois de domínio/remetente definidos, comprovar entrega, origem correta do link, uso único do reset, rejeição de reutilização e login com a nova senha. Não registrar senha, token ou link privado na evidência.

## 9. Divisão de responsabilidades e limites

| Frente | Responsabilidade nesta etapa |
| --- | --- |
| Integração SMB/Nuvemshop, identidade de variantes e conciliação de estoque | Vinícius e agente responsável pela integração: proposta e testes isolados. Vanderlei recebe os contratos para preparar o ambiente posteriormente. |
| Cenários financeiros PIX/boleto, retorno físico e chargeback | Nossa frente define casos e resultados; Vanderlei acompanha transporte, consumidores e alertas na janela combinada. |
| Domínio, destinatários, responsáveis de atendimento e decisões comerciais | Vinícius confirma; Vanderlei configura e comprova o ambiente correspondente. |
| Segurança, infraestrutura, capacidade e publicação | Vanderlei prepara e apresenta evidências; revisão e aceite final são conjuntos. |

- Os produtos comerciais vindos da Nuvemshop são reais: não reimportar catálogo, corrigir quantidades, reenviar vendas antigas ou classificar produtos como teste por ausência de vínculo de variante.
- Imagens permanecem por URL externa; não provisionar object storage nem uploads.
- Débito está adiado e deve continuar indisponível. O ensaio específico de expiração do boleto também foi adiado; isso não dispensa operação automática corretamente configurada e validada.
- Não repetir estornos já comprovados nem usar o pedido PIX nº 3 em revisão como novo ensaio.
- Se faltar acesso ou decisão, devolver a lacuna concreta e continuar as tarefas independentes.

## 10. Formato obrigatório da devolutiva

Enviar um documento versionável, sem credenciais ou dados de clientes, contendo:

| Campo | Conteúdo esperado |
| --- | --- |
| Frente/gate | G5, G6, G7 ou G8 e atividade específica. |
| Estado | Concluído com evidência, preparado sem execução, pendente ou bloqueado por dependência identificada. |
| Referência | Branch, SHA, digest/revisão quando aplicável, ambiente e data/hora BRT ou UTC explícita. |
| Ação e resultado | O que foi verificado/alterado e o resultado observado. |
| Evidência | Caminho ou link para logs sanitizados, execução, comparação ou captura. |
| Limite da prova | O que o resultado ainda não demonstra. |
| Próxima ação | Responsável, dependência e janela proposta, se necessária. |

Ao finalizar, separar claramente **o que está concluído**, **o que está pronto para ensaio** e **o que precisa de retorno de Vinícius**. CI aprovada, recurso criado ou candidata publicada não encerram sozinhos o aceite operacional.

## Referências

- [Replanejamento de produção](../../../../diversos/CORRECOES/Correcoes_logicas/Correcao_logica_1/trabalho_em_dupla/Replanejamento/REPLANEJAMENTO_PRODUCAO_48H.md).
- [Checklist G1–G8](../../../CHECKLIST_PRODUCAO_G1_G8.md).
- [Preparação operacional de Vanderlei](../../../EXECUCAO_OPERACIONAL_VANDERLEI_2026-10-21.md).
- Documentos de trabalho ainda não presentes na base de homologação `1b09934`: `trabalho_em_dupla/ROTEIRO_ACEITE_FINANCEIRO_G3.md`, `trabalho_em_dupla/FECHAMENTO_G2.md` e `trabalho_em_dupla/evidencias/L-NUVEMSHOP-FLUXO-PROPOSTO-2026-10-22.json`. Esta publicação inclui somente o guia de atribuições. Vinícius disponibilizará os documentos complementares antes dos ensaios que dependam deles; a preparação descrita neste guia pode avançar.

Os registros têm datas e alcances distintos. Quando houver conflito com um aviso histórico, usar a evidência posterior referente ao mesmo item; não considerar uma lista antiga de pendências como prova de que uma entrega recente ainda falta.
