# Agendamento de pagamentos — homologação

Preparado em 07/10/2026. Publicação e consultas reais de status confirmadas por evidências fornecidas pelo operador. Na primeira sessão, houve uma consulta comprovada às 17:04:24.808 de Brasília. Na segunda, foram confirmadas quatro consultas consecutivas com `status_checked` às 18:01:21.491, 18:02:21.355, 18:03:21.340 e 18:04:22.811, todas com contadores zerados. O critério de três consultas consecutivas está atendido; não é necessário repetir o teste de status. O agendador deve permanecer desativado e sem Cron até a próxima sessão controlada, conforme encerramento informado pelo operador. A revisão do isolamento e o processamento financeiro real permanecem pendentes; ver seções 34 e 35 do registro de execução e a seção 6 deste guia.

A sequência acordada em 07/10/2026 é concentrar os testes extensos na aplicação local com PostgreSQL Docker e reservar verificações breves para o Preview. Depois da validação local, comprovar que uma rotina externa consegue consultar periodicamente o Preview. A primeira etapa publicada **somente lê o status**. O processamento financeiro fica para a etapa seguinte, depois da conferência dos registros.

**Atualização de 08/10/2026:** o operador confirmou os hostnames das conexões de homologação e o redeploy com `PAYMENT_WORKER_ENABLED=true`. Na sessão `process`, foram fornecidas três conclusões `processed`, às 11:10:59.543, 11:11:52.202 e 11:14:52.233 de Brasília, com filas vazias, nenhum retry/review e expiração sem erros. O critério de três conclusões distintas foi atendido; não é necessário repetir o teste com filas vazias. O operador informou que encerrou a sessão após a orientação de desativar a flag e remover o Cron. Ver seções 36 e 37 do registro de execução. Cobranças e demais integrações reais Sandbox permanecem pendentes.

**Antes da cobrança Sandbox:** o operador confirmou que o envio de e-mail ainda não está configurado. Cadastrar `RESEND_API_KEY` como Secret e `EMAIL_FROM` como Config exclusivamente no Preview da branch `homologacao_teste`, depois realizar o redeploy. Para o primeiro ensaio, usar `Continental Homologação <onboarding@resend.dev>` como remetente e o endereço associado à conta Resend como e-mail do comprador; o domínio de teste só aceita esse destinatário, conforme [documentação oficial](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain). Configurar o remetente antes de processar o pagamento, pois o processador preserva esse valor no payload da confirmação. Até concluir essa preparação, manter o agendador desativado e sem Cron, `PAYMENT_REMOTE_ENABLED=false`, `PAYMENT_EXPIRATION_ENABLED=false` e webhook Asaas inativo. Ver seção 38 do registro de execução.

O JSON informado pelo operador confirmou acesso autenticado ao endpoint, `accountScope: sandbox-hml` e contadores vazios/zerados. Isso não comprova execução do processador nem validade da chave da API Asaas. O campo `at` informa a hora da consulta, não a última execução financeira.

## 0. Validar localmente antes de publicar

O executor existente cria PostgreSQL 16 temporário via Docker, aplica as migrations e inicia uma cópia local da aplicação. Ele substitui as conexões por endereços locais e confere a identidade/sentinela antes dos testes. Não copie a conexão de produção para executar testes avulsos.

Com Docker disponível, a rodada direcionada pode ser reproduzida na raiz do projeto:

```powershell
node scripts/run-isolated-tests.mjs tests/integration/payment-durable-execution.test.ts tests/integration/payment-plan-authority.test.ts tests/integration/checkout-intent-authority.test.ts tests/integration/checkout-browser-state.test.ts tests/integration/test-environment-isolation.test.ts
```

Esse comando usa banco local real e gateway controlado/simulado. Inclui estados financeiros, eventos repetidos, recuperação, checkout e isolamento. O executor descarta seus recursos temporários ao encerrar. Não é um teste da conta Asaas Sandbox, da Cloudflare ou da latência do Neon/Vercel.

A conta Cloudflare só é necessária para publicar o agendador descrito nas próximas etapas. Sua criação pode ser feita depois desta rodada local. O agendamento remoto e os webhooks do Asaas não alcançam diretamente um banco Docker no computador; a verificação do caminho publicado utiliza o Preview e o Neon de homologação separado.

## 1. Criar o Worker gratuito

1. Acesse [o painel da Cloudflare](https://dash.cloudflare.com/) e crie uma conta, se necessário.
2. Utilize **Workers Free**. Este roteiro não requer contratação de plano pago nem transferência do domínio da loja.
3. Abra um terminal PowerShell na pasta deste projeto no VS Code.
4. Execute o comando abaixo e conclua a autenticação na janela do navegador. O `npx` poderá pedir confirmação para baixar a ferramenta Wrangler; isso não instala uma dependência no projeto.

```powershell
npx wrangler login
```

5. Após concluir o login, execute este outro comando:

```powershell
npx wrangler deploy --config scripts/homologation/wrangler.json
```

Isso publica apenas o Worker `continental-pagamentos-hml` na Cloudflare. A aplicação da Vercel continua no mesmo lugar. A configuração inicial está desabilitada, sem cron e com logs habilitados. Não há segredos nos arquivos.

O código está em [payment-scheduler.worker.mjs](../../../../../scripts/homologation/payment-scheduler.worker.mjs) e a configuração em [wrangler.json](../../../../../scripts/homologation/wrangler.json). O comando segue o [fluxo oficial de publicação com Wrangler](https://developers.cloudflare.com/workers/get-started/guide/).

> Nas próximas etapas, a configuração será feita pelo painel. **Não execute novamente o comando de deploy depois de configurar o painel:** o arquivo local contém `crons: []` e variáveis desabilitadas; republicá-lo remove o agendamento e restaura esses valores. Antes de futuras publicações, reconcilie o arquivo com a configuração desejada.

## 2. Cadastrar os dois segredos na Cloudflare

Abra **Workers & Pages → continental-pagamentos-hml → Settings → Variables and Secrets → Add**. Cadastre os seguintes valores como **Secret**, depois publique as alterações com **Deploy**.

| Nome na Cloudflare | Valor a utilizar |
| --- | --- |
| `CRON_SECRET` | O mesmo valor cadastrado na Vercel para o Preview da branch `homologacao_teste`. |
| `VERCEL_BYPASS_SECRET` | O segredo de bypass de Deployment Protection que você já gerou na Vercel. |

Não é necessário cadastrar `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN` ou a conexão do banco na Cloudflare. Essas credenciais permanecem na aplicação. O bypass da Vercel concede acesso ao projeto; o destino do nosso script está fixado no hostname da homologação. Não envie os valores em mensagens ou capturas de tela. [Documentação de Secrets](https://developers.cloudflare.com/workers/configuration/secrets/).

## 3. Definir uma janela de teste de duas horas

No PowerShell, execute:

```powershell
[DateTime]::UtcNow.AddHours(2).ToString('o')
```

Copie o horário completo exibido, incluindo o `Z` no final. Esse horário não é um segredo. Gere-o próximo ao início do teste.

Em **Variables and Secrets**, edite estas variáveis como **Text**:

| Nome | Valor inicial para o teste |
| --- | --- |
| `HML_SCHEDULER_ENABLED` | `true` |
| `HML_SCHEDULER_MODE` | `status` |
| `HML_RUN_UNTIL_UTC` | O horário UTC exibido pelo comando acima. |

Publique as alterações. O prazo impede novas consultas após o fim da janela; uma requisição que já começou pode terminar depois dele. O script rejeita prazos superiores a 24 horas a partir da execução. Para renovar a janela, gere outro horário e atualize a variável.

Consultas a cada minuto podem manter o Neon acordado. O desligamento limita o consumo durante esta homologação; não mantenha esse agendamento ligado permanentemente no Neon Free. Confira o consumo no painel do Neon após os testes.

## 4. Cadastrar o agendamento

No Worker, abra **Settings → Triggers → Cron Triggers** e adicione **um único** agendamento:

```text
* * * * *
```

Isso solicita uma execução por minuto. Os horários dos Cron Triggers são UTC. Alterações podem levar até 15 minutos para propagar; o histórico de um Worker novo pode demorar até 30 minutos para aparecer. [Documentação de Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/).

Nesta etapa, mantenha na Vercel:

```text
PAYMENT_WORKER_ENABLED=false
PAYMENT_REMOTE_ENABLED=false
PAYMENT_EXPIRATION_ENABLED=false
```

O webhook do Asaas Sandbox também deve permanecer inativo enquanto validamos o agendamento. Não é necessário novo redeploy da Vercel apenas para configurar esse Worker externo.

## 5. Conferir os registros

Abra **Observability** no Worker. A configuração enviada já habilita Workers Logs com amostragem de 100%. Procure pelo evento `hml-payment-scheduler`. [Documentação de Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/).

Uma consulta concluída deve registrar:

```json
{
  "event": "hml-payment-scheduler",
  "state": "status_checked",
  "mode": "status",
  "accountScope": "sandbox-hml",
  "backlog": {
    "uncertain": 0,
    "overdue": 0,
    "abandonedLeases": 0,
    "untrackedLegacyOrders": 0,
    "inbox": 0,
    "outbox": 0,
    "operations": 0
  }
}
```

O registro real também inclui horários e duração. Os contadores podem mudar se houver trabalho no banco; não devem ser alterados artificialmente para reproduzir o exemplo. `status_checked` significa apenas que a consulta funcionou, mesmo que existam pendências.

Confira **três consultas consecutivas** com `status_checked`, em horários de execução distintos. Mensagens de início, conclusão e invocação da mesma execução não são consultas separadas; registros `disabled`, acessos GET ao endereço público e o contador genérico Success não satisfazem esse critério. Se aparecer `error`, preserve o código do erro e interrompa o teste para diagnóstico. Compartilhe somente o código e os contadores, sem segredos. Alguns exemplos:

| Código/estado | Conferência necessária |
| --- | --- |
| `HTTP_302` | Bypass e proteção da Vercel; o Worker não segue redirecionamentos. |
| `HTTP_401` | Correspondência do `CRON_SECRET`. |
| `HTTP_503` | Configuração ou disponibilidade do endpoint; no modo `process`, verificar também a flag do executor. |
| `UNEXPECTED_SCOPE` | Destino/configuração não respondeu como `sandbox-hml`; processamento bloqueado. |
| `REQUEST_TIMEOUT` | A resposta não chegou no prazo. A operação pode ter iniciado; não repetir manualmente às cegas. |
| `disabled` / `expired` | Nenhuma consulta nova foi feita; verificar flag/prazo se ainda estiver testando. |

O marcador `sandbox-hml` é uma conferência da configuração, não uma prova independente de qual host do banco está sendo usado. Antes de habilitar processamento, confirme que as conexões do Preview continuam apontando para o projeto Neon separado de homologação.

## 6. Próxima etapa: ativar o processador

Execute esta etapa após validar as três consultas anteriores e revisar o isolamento do banco. Ela modifica o estado das filas e pode chamar integrações para trabalhos existentes.

1. Desabilite temporariamente `HML_SCHEDULER_ENABLED` na Cloudflare, publicando `false`.
2. Confirme o banco isolado, `ASAAS_ACCOUNT_SCOPE=sandbox-hml`, a URL/chave Sandbox e o ID da loja de homologação na configuração do Preview. Mantenha o webhook inativo e nenhuma cobrança de teste em andamento.
3. Na Vercel, **somente Preview da branch `homologacao_teste`**, altere `PAYMENT_WORKER_ENABLED=true`. Mantenha `PAYMENT_REMOTE_ENABLED=false` e `PAYMENT_EXPIRATION_ENABLED=false`.
4. Faça o redeploy desse Preview e aguarde `Ready`.
5. Na Cloudflare, altere `HML_SCHEDULER_MODE=process`, renove o prazo de duas horas e publique `HML_SCHEDULER_ENABLED=true`.
6. Confira duas ou três execuções com `state: processed`, contadores coerentes e nenhuma falha/revisão. Esse modo consulta o status e, depois, faz um POST em `/api/cron/payments?limit=1`.
7. Desabilite novamente o agendador ao encerrar a sessão de testes. Os testes posteriores de pagamento Sandbox, entrega de e-mail, webhook, reconciliação, cancelamento e estorno ainda precisam ser executados antes de aprovar a integração.

O endpoint pode levar até cinco minutos para processar um lote. Há possibilidade de execuções sobrepostas com cron de um minuto; a aplicação usa leases e idempotência, mas isso não comprova capacidade nem ausência de atrasos. Valide duração e backlog antes de aumentar carga. Falhas parciais em HTTP 200 são registradas como `attention_required` e a execução termina em erro, sem repetição imediata do POST pelo script.

## 7. Encerrar e limites desta preparação

Para encerrar, publique `HML_SCHEDULER_ENABLED=false` e remova o Cron Trigger. O prazo automático interrompe novas consultas, mas não remove o trigger. A desativação também não desfaz uma execução que já começou. Conclua ou investigue trabalhos em andamento antes de desligar flags na Vercel.

O Workers Free oferece agendamento, mas limita CPU a 10 ms por execução; espera de rede não conta como CPU e Cron Triggers têm limite de 15 minutos de duração total. A configuração é candidata para este teste leve: a adequação deve ser conferida nas métricas reais após publicar. [Limites oficiais](https://developers.cloudflare.com/workers/platform/limits/).

Esta preparação não implementa alertas externos, detecção automática de ausência de execuções, aprovação de produção nem um agendamento permanente. Nos testes, o operador acompanha os logs. Antes de produção, definir monitoramento com responsável e alertas para falha, ausência de execução e backlog, além dos testes financeiros pendentes.

### Validação local

```powershell
node --test tests/scripts/payment-scheduler-worker.test.mjs
```

Os testes usam respostas simuladas, sem conexão com Vercel, Neon ou Asaas. Cobrem bloqueios de configuração, prazo, escopo, redirecionamento, timeout, autenticação em cabeçalhos, filtragem dos logs e detecção de falhas parciais. Os 14 testes passaram localmente em 07/10/2026. A publicação e o comportamento real da Cloudflare precisam ser verificados nas etapas acima.

## 8. Preparar uma cobrança Pix no Sandbox

**Atualização de 08/10/2026:** o operador apresentou o cadastro de `RESEND_API_KEY` como Secret e `EMAIL_FROM=onboarding@resend.dev` para o Preview da branch `homologacao_teste`, depois informou o redeploy. A entrega real ainda deve ser comprovada. A configuração de e-mail pode ser considerada preparada para o ensaio após esse deployment ficar Ready; não é necessário criar outra conta Resend.

Execute esta fase com `HML_SCHEDULER_ENABLED=false` e sem Cron na Cloudflare. Ela cria um pedido e uma cobrança Sandbox, mas não confirma o pagamento.

**Situação do primeiro ensaio em 08/10/2026:** o operador apresentou pedido #1 pendente, sem instruções Pix, e uma cobrança de R$ 24,95 aguardando pagamento no Asaas. A criação/exibição das instruções não foi aprovada. Preservar esse pedido e investigar os logs antes de simular pagamento ou criar outra compra. A página consulta o banco a cada 3,5 segundos enquanto visível; fechá-la durante a análise para reduzir consumo. A seção 43 do registro de execução detalha as evidências, testes locais e limites do diagnóstico.

**Diagnóstico e correção posterior:** a consulta do operador confirmou QR/payload disponíveis e `installmentNumber:null`. A validação de emissão rejeitava esse campo nulo; a incompatibilidade foi reproduzida e corrigida no commit `f23c37d`, apenas em `homologacao_teste`. Após esse deployment ficar Ready, executar `./scripts/homologation/process-payments-once.ps1` no PowerShell da pasta do projeto, usando CRON_SECRET/bypass de homologação em entrada oculta. Manter Cloudflare desligada/sem Cron e expiração desabilitada na Vercel. Conferir o resumo de reconciliação: falhas/revisões exigem análise antes de nova execução. Reabrir a confirmação do pedido existente pela URL original com seu intent, sem refazer checkout, para verificar QR/copia e cola. Esse processamento pontual acessa o Neon de homologação e consulta o Asaas; não simula pagamento. A seção 45 do registro detalha a validação local e as limitações.

1. Na Vercel, exclusivamente no **Preview da branch `homologacao_teste`**, altere `PAYMENT_REMOTE_ENABLED=true`. Preserve `PAYMENT_WORKER_ENABLED=true` e `PAYMENT_EXPIRATION_ENABLED=false`. Mantenha URL/chave Asaas Sandbox, `ASAAS_ACCOUNT_SCOPE=sandbox-hml`, a loja de homologação na allowlist e as conexões já conferidas para o Neon separado `continental-homologacao`.
2. Faça o redeploy desse Preview e aguarde **Ready**.
3. Abra `/admin/settings` no Preview, na loja de homologação. Em **Meios de pagamento**, habilite **PIX automático** e clique em **Salvar Configurações**. **Salvamento confirmado pelo operador em 08/10/2026**, após a correção do payload do formulário; não é necessário repetir essa configuração. O Pix manual via WhatsApp é uma opção diferente e a interface agora identifica seus campos como manuais. Não é necessário preencher todo o painel: os campos **Chave PIX**, **Tipo de Chave PIX** e **WhatsApp** não são exigidos pelo fluxo automático Asaas e podem permanecer vazios neste ensaio. `createPixCharge` cria a cobrança na API e recupera o QR Code/copia e cola pelo ID retornado, sem usar `Loja.pixKey`.
4. Na conta **Asaas Sandbox**, ative o webhook existente `Continental_Sandbox`. Confira o destino ao endpoint `/api/webhooks/asaas` do Preview, o bypass já cadastrado, o token de autenticação correspondente e os eventos `PAYMENT_CONFIRMED`/`PAYMENT_RECEIVED`. Preserve o envio Sequencial e a fila de sincronização. Não compartilhe a URL completa com o segredo de bypass ou o token.
5. No checkout do Preview, use um comprador cujo e-mail seja o endereço associado à conta Resend. Crie **um único pedido Pix de teste**. Use somente contatos próprios ou autorizados. Preserve o pedido criado e pare na tela com QR Code e Pix copia e cola; se ocorrer erro ou timeout, confira o pedido existente antes de tentar novamente.
6. Confira se a cobrança correspondente aparece no Asaas Sandbox. A apresentação do QR Code confirma apenas esta fase de criação. A confirmação será simulada no Sandbox, conforme [documentação oficial](https://docs.asaas.com/docs/faq-sandbox), sem usar aplicativo bancário.

**Chave Pix na conta Asaas:** é recomendável cadastrar uma chave aleatória na própria conta Sandbox antes de criar a cobrança. Essa chave pertence à configuração da conta Asaas e não precisa ser copiada para o campo Chave PIX da loja. A [documentação de QR Code dinâmico](https://docs.asaas.com/docs/cobrancas-via-pix) ainda permite gerar QR imediato sem chave cadastrada, mas considera esse comportamento transitório e recomenda manter uma chave na conta. Não apresentar esse cadastro como exigência dos campos do Admin nem confundir a opção “PIX automático” da loja com o produto Asaas de débitos Pix recorrentes.

**Atualização da apresentação em 08/10/2026:** o operador confirmou que a página funciona corretamente após o commit `bcb759f`. O QR/copia e cola do pedido #1 foram recuperados, e a confirmação preserva instruções recentes durante consultas e eventos breves de foco. A leitura periódica do pedido pendente ocorre dez segundos após cada resposta enquanto a aba está visível; a expiração e a idade máxima de reutilização continuam limitando as ações. Essa validação encerra a investigação da apresentação, mas não comprova pagamento, recebimento de webhook ou entrega de e-mail.

Na etapa seguinte, confirmar o pagamento simulado e usar processamento pontual conforme seção 9, mantendo o agendador desligado. Somente depois das evidências de webhook, pedido pago e entrega da confirmação por e-mail o fluxo completo poderá ser aprovado. Os testes de cancelamento, estorno, expiração e demais requisitos do workflow continuam pendentes.

## 9. Confirmar a cobrança existente e validar webhook, pedido pago e e-mail

Use o mesmo pedido #1 e a cobrança correspondente de **R$ 24,95**. Não refaça checkout nem pague esse QR com aplicativo bancário. A confirmação pela interface do Asaas Sandbox é uma simulação, conforme [documentação oficial](https://docs.asaas.com/docs/como-adicionar-dinheiro-para-testes).

1. Antes de simular, confira se `Continental_Sandbox` está ativo, com destino ao `/api/webhooks/asaas` do Preview da branch `homologacao_teste`, bypass e autenticação já configurados e eventos `PAYMENT_CONFIRMED`/`PAYMENT_RECEIVED`. Confirme também que o comprador do pedido usa o e-mail associado à conta Resend: `EMAIL_FROM=onboarding@resend.dev` só permite esse destinatário sem domínio próprio verificado, conforme [documentação Resend](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain). Se alguma condição não estiver atendida, resolva essa configuração antes da confirmação. Não compartilhe URL com segredo, chaves, tokens ou cookies.
2. Mantenha `HML_SCHEDULER_ENABLED=false` e nenhum Cron na Cloudflare. Preserve `PAYMENT_WORKER_ENABLED=true` e `PAYMENT_EXPIRATION_ENABLED=false` no Preview, o banco Neon de homologação separado e a conta/API Sandbox já conferidos. Não é necessário novo redeploy apenas para executar o ensaio se as variáveis não mudaram.
3. No **Asaas Sandbox**, abra a cobrança existente e confira valor, cliente e correlação com o pedido #1. Verifique que ela continua pendente e que a página ainda autoriza esse PIX. Se estiver expirada, cancelada, paga ou em revisão, preserve o estado e investigue antes de continuar. Estando válida, use a opção de **confirmar o pagamento** na interface Sandbox uma única vez e anote o horário e o novo status. Não use confirmação de pagamento em dinheiro como substituto dessa simulação PIX.
4. Nos logs da Vercel do Preview, procure `POST /api/webhooks/asaas` próximo ao horário da simulação e confira HTTP **200**. Esse status indica recebimento/persistência do evento, não necessariamente a conclusão financeira. Se houver 401/403/503, redirecionamento ou ausência de entrega, investigue autenticação, proteção do Preview, fila e destino do webhook; não repita a confirmação da cobrança. A conciliação pode recuperar o estado financeiro mesmo sem webhook, mas esse caminho não aprova o teste de entrega do webhook.
5. No PowerShell da pasta do projeto, execute **uma vez**:

   ```powershell
   .\scripts\homologation\process-payments-once.ps1
   ```

   O script pede CRON_SECRET/bypass em entrada oculta, verifica escopo/legados e processa um lote de limite 1 no Preview. Acesso ao Neon e consulta Asaas são reais na homologação; não se trata de teste Docker. Envie somente o JSON agregado retornado para análise. Não repita automaticamente se houver erro de requisição, `retried>0` ou `review>0`.
6. Confira o mesmo pedido na confirmação e no Admin: deve passar a **Pagamento confirmado / PAID**, deixando de oferecer QR/copia e cola. Confira também a cobrança na conta Sandbox. Valores e correlação precisam continuar correspondendo ao mesmo pedido. Não marque o pedido como pago manualmente pelo Admin para substituir o processamento financeiro.
7. Confira o e-mail de confirmação no destinatário e a entrega no Resend. O processador primeiro consome `ORDER_STATUS_CHANGED` e cria `PAYMENT_CONFIRMATION_EMAIL`; com limite 1, o envio normalmente fica para outro lote. `outbox.completed=1` isoladamente não comprova envio. Examine o primeiro JSON e os logs antes de orientar uma segunda execução pontual, caso necessária, mantendo o mesmo pedido e a mesma cobrança. Depois de um envio confirmado, não executar lotes adicionais apenas para repetir a evidência.

Registre as evidências separadamente: status da cobrança no Sandbox, webhook HTTP 200 no Preview, resumo sem retentativas/revisões, pedido PAID sem ações de pagamento e confirmação recebida por e-mail. A caixa de entrada pode classificar o e-mail como spam. Mantenha o agendador desativado ao encerrar e feche a página de confirmação quando terminar a observação, para evitar leituras periódicas desnecessárias. Os demais cenários de homologação continuam pendentes.

### Retomada após falha de transação — 08/10/2026

O operador confirmou webhook HTTP 200 e “Pagamento recebido” no Asaas, mas o primeiro lote deixou inbox e conciliação em retried. O log /api/cron/payments apresentou transação Prisma encerrada em order.findUnique. A latência de 5.500ms reproduziu localmente a expiração do prazo padrão de 5.000ms; a correção f4f936c aplica prazo limitado de 30.000ms às transações de evidência. Os 40 testes de integração passaram no Docker; publicação Vercel concluída no Preview (AvJkBKGpDS2AewPdmoW4nFgT7rSH).

O ensaio atual já está na retomada: não repetir as etapas de criação/confirmar pagamento no Asaas. Manter Cloudflare desligada/sem Cron, executar uma única vez o comando da etapa 5 e analisar o JSON. Se a inbox concluir a aprovação, reconciliation.claimed=0 pode ocorrer porque a próxima consulta foi reagendada; não é necessário exigir completed=1 nas duas etapas. Conferir pedido PAID e ausência de ações de pagamento. Outbox completed isoladamente não prova envio; só orientar novo lote após analisar o resultado e o estado real da entrega. Se retried/review reaparecer, preservar o resultado e procurar PAYMENT_INBOX_RETRY / PAYMENT_RECONCILIATION_RETRY e seu errorCode nos logs, sem parâmetros de URL ou segredos.

### Diagnóstico de acesso antes do lote

Se o script retornar phase=scope_check / REQUEST_UNRESOLVED, o POST de processamento ainda não foi chamado. O PowerShell pode mostrar httpStatus=null inclusive ao bloquear um redirecionamento de autenticação. Use uma única consulta de diagnóstico:

```powershell
.\scripts\homologation\process-payments-once.ps1 -StatusOnly
```

Informe CRON_SECRET e bypass da Vercel de homologação nas entradas ocultas e compartilhe somente o JSON. SCOPE_VERIFIED com processingAttempted=false confirma essa consulta sem enviar lote. REDIRECT_BLOCKED indica redirecionamento recusado, compatível com proteção do Preview/bypass não aceito; 401 exige conferir CRON_SECRET; transportStatus identifica falhas de rede/timeout quando disponível. INVALID_SECRET_INPUT bloqueia valores vazios ou com espaços/quebras de linha antes do acesso. Não enviar segredos ou mensagem bruta da exceção. Só retomar o comando sem -StatusOnly após analisar o resultado e confirmar o acesso.

### Resultado do cenário de confirmação PIX — 08/10/2026

O operador confirmou o pedido #1 como Pago na confirmação e no histórico do usuário e apresentou o e-mail recebido no Gmail: pagamento aprovado, PIX Dinâmico, retirada no balcão e total pago R$ 24,95. Após a aprovação, o lote final consumiu uma entrada da outbox com completed=1, sem retry/review. O percurso controlado de confirmação PIX e entrega do e-mail está verificado neste ensaio; ver seção 61 do registro de execução.

Encerrar as execuções pontuais desse cenário, preservar o pedido pago e manter HML_SCHEDULER_ENABLED=false/sem Cron. A próxima frente é conferir efeitos únicos diante de eventos repetidos, conforme E08, antes dos ensaios de cancelamento/estorno/expiração. O procedimento externo de repetição de evento ainda deve ser preparado e conferido na documentação do provedor; não criar outra cobrança nem executar lotes só para reenviar e-mail. Demais métodos, inventário/pontos, datas bancárias, dados legados, capacidade e gates de produção continuam pendentes.

## 10. Repetir o evento concluído do pedido #1 (E08)

**Preparação de 08/10/2026:** scripts/homologation/replay-paid-pix-event.ps1 está disponível localmente. Onze cenários com cmdlets simulados passaram em tests/scripts/replay-paid-pix-event.test.ps1; nenhuma chamada real foi feita nessa validação. A repetição real ainda não foi executada. Não há mudança de aplicação nem redeploy necessário para usar esse script.

1. Mantenha o agendador Cloudflare desligado e sem Cron. Preserve o pedido #1 pago e suas configurações já verificadas. Antes da repetição, anote o saldo de fidelidade e a quantidade de créditos dessa compra em Minha conta / Fidelidade e pontos, além da quantidade de e-mails de confirmação do pedido #1. Se a interface não permitir identificar o crédito individual, não considerar o ledger auditado somente pelo saldo.
2. No Asaas Sandbox, acesse Menu do usuário → Integrações → Logs de Webhooks e localize o evento original da cobrança do pedido #1 com resposta HTTP 200. A [documentação oficial](https://docs.asaas.com/docs/receive-asaas-events-at-your-webhook-endpoint) informa essa navegação e a disponibilidade do payload enviado. A entrega pode repetir um evento; o teste preserva sua identidade e conteúdo. Não foi confirmado um botão de reenvio individual de evento concluído no painel, portanto este procedimento usa uma repetição controlada do payload ao endpoint da aplicação.
3. Separe apenas os campos aceitos pelo serviço: id e event do evento, dateCreated se presente, e payment contendo id, externalReference se presente, billingType, value e status. Preserve os valores originais e a ausência de campos opcionais; não substitua dateCreated pela data atual nem altere status. O id do evento é diferente do id da cobrança. Não copiar dados do cliente, cabeçalhos, tokens ou a URL privada do webhook.
4. Após conferir os campos originais, salve esse JSON reduzido no arquivo local indicado durante o acompanhamento. O script exige evento de confirmação/recebimento PIX de R$ 24,95; se externalReference existir, deve corresponder ao UUID do pedido #1. Um ID novo pode criar outra entrada na inbox: não inventar IDs. Conteúdo diferente com o mesmo ID é conflito, não o teste de duplicidade.
5. Execute uma única vez, substituindo o caminho pelo arquivo efetivamente conferido:

   ```powershell
   .\scripts\homologation\replay-paid-pix-event.ps1 -EventFile '<arquivo JSON conferido>'
   ```

   O script pede CRON_SECRET, bypass Vercel e ASAAS_WEBHOOK_TOKEN de homologação em entradas ocultas. O terceiro valor é o token do webhook, não ASAAS_API_KEY. Ele verifica o escopo sandbox-hml e filas concluídas, envia um POST a /api/webhooks/asaas e consulta novamente a supervisão. Não envia POST a /api/cron/payments nem à API Asaas. O Preview acessará o Neon de homologação neste ensaio; esta etapa não é Docker.
6. Resultado esperado: ok=true, code=DUPLICATE_ACCEPTED, webhookStatus=PROCESSED, queuesUnchanged=true, processingAttempted=false. As quantidades COMPLETED da inbox/outbox devem permanecer iguais. Qualquer outro resultado exige análise antes de repetir ou processar: timeout após o POST deixa o resultado incerto; EVENT_CONTENT_CONFLICT indica conteúdo diferente; uma entrada nova não deve ser consumida automaticamente.
7. Confira o mesmo pedido ainda Pago, saldo e crédito de fidelidade inalterados e nenhuma nova confirmação no Resend/Gmail. Compartilhe somente o JSON agregado e essas conferências. A deduplicação da entrega não substitui os ensaios de concorrência, eventos fora de ordem, auditoria de estoque/ledger ou outros cenários de E08.

### Arquivo original pronto e referência antes do replay — 08/10/2026

O operador forneceu o envelope reduzido de PAYMENT_RECEIVED do pedido #1. Foi salvo em scripts/homologation/pix-order-1-received-event.json e conferido numa execução somente com respostas simuladas; valores e identidade originais foram preservados. A repetição real ainda não ocorreu.

No PowerShell da pasta do projeto, execute uma única vez:

```powershell
.\scripts\homologation\replay-paid-pix-event.ps1 -EventFile .\scripts\homologation\pix-order-1-received-event.json
```

As entradas ocultas pedem CRON_SECRET, bypass Vercel e ASAAS_WEBHOOK_TOKEN da homologação; o terceiro é o token do webhook, não a chave API Asaas. Não é necessário redeploy. Compartilhe apenas o JSON agregado antes de qualquer outra execução. Depois de resultado aceito, confira pedido ainda Pago e carteira: 113 pontos disponíveis, 0 pendentes, 612 já acumulados, quatro movimentações e um crédito de +12 dessa compra. O operador informou nenhum e-mail adicional antes da repetição; a confirmação deve continuar única após o ensaio. Qualquer erro ou mudança requer análise; manter o Cron desligado.

### Resultado da repetição real — 08/10/2026

O operador apresentou DUPLICATE_ACCEPTED, ok=true, webhookStatus=PROCESSED e queuesUnchanged=true. Inbox manteve uma entrada COMPLETED e outbox três COMPLETED antes/depois. replayAttempted=true e processingAttempted=false: o script repetiu o webhook e não chamou lote de processamento. A deduplicação dessa entrega foi verificada em homologação; não repetir o comando apenas para obter a mesma evidência.

Falta a conferência posterior de pedido ainda Pago, 113 pontos disponíveis, 0 pendentes, quatro movimentações com um crédito de +12 e ausência de novo e-mail. Esses efeitos não podem ser concluídos somente pelo agregado das filas. Manter Cron desligado; demais cenários E08 e aprovação integral continuam pendentes.

### Fechamento do cenário de duplicidade — 08/10/2026

Após a repetição aceita, o operador conferiu pedidos, carteira e e-mail, incluindo SPAM, e confirmou: pedido #1 Pago, 113 pontos disponíveis, 0 pendentes, quatro movimentações com um único crédito de +12 e nenhum novo e-mail. Com as filas inalteradas e o evento reconhecido como PROCESSED, este cenário de webhook duplicado após conclusão está aprovado em homologação; registro detalhado na seção 65 do acompanhamento. Não repetir o replay nem enviar lotes adicionais para comprovar o mesmo resultado. Manter o Cron desligado e preservar o pedido. Eventos fora de ordem, concorrência e outros cenários E08 permanecem pendentes; a homologação integral não foi encerrada.

## 11. Notificação pendente recebida depois do pagamento (E08)

**Preparação de 08/10/2026:** o consumidor drainPaymentInbox correlaciona o pagamento e consulta o contrato atual no Asaas antes de aplicar evidência; não usa o estado antigo do envelope como aprovação ou regressão incondicional. O teste local existente late pending notification cannot regress approved payment or duplicate effects já foi aprovado na rodada Docker da seção 53 do registro (40 testes). Essa rodada não foi repetida nesta preparação, que não altera a aplicação.

Este ensaio usa uma **notificação sintética**, criada para representar PAYMENT_CREATED/PENDING da mesma cobrança já recebida. PAYMENT_CREATED corresponde à criação da cobrança, conforme [documentação Asaas](https://docs.asaas.com/docs/webhook-para-cobrancas). O arquivo scripts/homologation/pix-order-1-late-pending-test-event.json mantém o ID real da cobrança/ref/valor/método e usa ID de teste fixo evt_hml_test_order_1_late_pending_v1 e data simulada 2026-10-08 13:30:00. Essa identidade/data não foram extraídas dos logs do Asaas e não representam novo evento gerado pelo provedor. O teste não cria, confirma, cancela ou estorna a cobrança Sandbox.

1. Preserve pedido #1 Pago e referência já conferida: 113 pontos disponíveis, 0 pendentes, quatro movimentações com crédito único de +12 e e-mail de confirmação único. Mantenha Cron desligado, banco/conta de homologação isolados e PAYMENT_EXPIRATION_ENABLED=false.
2. No PowerShell da pasta do projeto, envie uma única vez a simulação:

   ```powershell
   .\scripts\homologation\replay-paid-pix-event.ps1 -EventFile .\scripts\homologation\pix-order-1-late-pending-test-event.json -LatePending
   ```

   Informe CRON_SECRET, bypass Vercel e ASAAS_WEBHOOK_TOKEN de homologação nas entradas ocultas. Não há redeploy necessário. O script consulta supervisão, envia um único POST ao webhook fixo do Preview e consulta novamente as filas. Não chama /api/cron/payments nem API Asaas. Esta etapa acessa o Neon de homologação; os testes de preparação usaram somente respostas locais.
3. Compartilhe apenas o JSON. Esperamos ok=true, code=LATE_EVENT_QUEUED, syntheticEvent=true, webhookStatus=RECEIVED, oneNewInboxReady=true, outboxUnchanged=true e processingAttempted=false. Antes deve haver inbox COMPLETED=1/outbox COMPLETED=3; depois inbox COMPLETED=1 mais READY=1, outbox ainda COMPLETED=3. Nesta fase o evento ainda não foi consumido; RECEIVED não comprova aprovação do cenário. Resultado diferente/timeout requer conferir estado antes de repetir. O ID fixo não deve ser trocado para gerar outra entrada de teste.
4. Depois de analisar a aceitação e a fila, orientar um único lote com process-payments-once.ps1, limite 1. A inbox deverá completar sem retry/review; o consumidor consultará a cobrança Sandbox atual. Esperamos nenhuma nova entrada de outbox nem efeito comercial. Conciliação periódica pode reivindicar uma tentativa se estiver vencida; o resumo deve ser analisado antes de outros lotes. Não habilitar o Cron para esse ensaio.
5. Após o lote, conferir supervisão somente com process-payments-once.ps1 -StatusOnly: inbox COMPLETED=2, nenhum READY/lease/revisão, outbox COMPLETED=3. Atualizar pedido/carteira e conferir pedido ainda Pago, valores e os mesmos pontos/registros, sem QR/copiar PIX e sem novo e-mail (inclusive SPAM). Esses resultados são esperados, ainda não executados/aprovados nesta preparação.

**Validação do script:** 20 testes com cmdlets simulados passaram: os 11 cenários anteriores de duplicidade e nove de notificação sintética (aceitação, cobrança errada, pendência prévia, evento já concluído, READY ausente/excedente, outbox alterada e timeouts no POST/GET posterior). A opção LatePending exige o fixture fixo do pedido #1; o modo de duplicidade original mantém seu comportamento. Nenhuma chamada remota foi feita pelo agente. Este cenário avalia a aplicação diante de notificação antiga injetada após aprovação; não prova entrega/reordenação real pela infraestrutura Asaas nem todos os cenários E08.

### Aceitação da simulação confirmada — 08/10/2026

O operador apresentou LATE_EVENT_QUEUED/RECEIVED, syntheticEvent=true, oneNewInboxReady=true, outboxUnchanged=true e processingAttempted=false. Inbox manteve uma COMPLETED e recebeu uma READY; outbox permaneceu com três COMPLETED. A etapa de envio passou, mas o teste de consumo e ausência de regressão ainda está pendente.

Próximo passo: executar uma única vez .\scripts\homologation\process-payments-once.ps1 sem -StatusOnly, informando CRON_SECRET/bypass de homologação, e compartilhar o JSON completo. Esperar inbox claimed=1/completed=1, sem retry/review, e nenhum trabalho novo de outbox. Analisar antes de qualquer outra execução; se houver falha ou resultado incerto, preservar a entrada e investigar. Depois do lote concluído, conferir -StatusOnly e os efeitos visuais da etapa 5 acima. Manter Cron desligado e preservar a cobrança/pedido existentes.

### Consumo da simulação concluído — 08/10/2026

O lote informado pelo operador concluiu uma entrada da inbox, sem retry/review. Conciliação e outbox não consumiram trabalhos; expiração não processou/cancelou pedidos, success=true e execução de 609ms. A etapa de consumo passou; o resultado comercial e as contagens persistidas ainda devem ser conferidos.

Execute uma única consulta de leitura .\scripts\homologation\process-payments-once.ps1 -StatusOnly e compartilhe o JSON: esperamos inbox COMPLETED=2/outbox COMPLETED=3 e ausência de pendências. Após atualizar pedidos/pontos e conferir e-mail/SPAM, confirmar pedido Pago, 113 pontos disponíveis, 0 pendentes, quatro movimentações, um crédito de +12 e nenhuma nova confirmação. Não executar outro lote nem repetir a notificação. Manter Cron desligado. Aprovação deste cenário aguarda essas evidências posteriores.

### Carteira preservada após o processamento — 08/10/2026

O operador informou “Está tudo ok” e mostrou a carteira: 113 disponíveis, 0 pendentes, 612 já acumulados, quatro movimentações e crédito único de +12, iguais à referência. A conferência visual de pontos passou; pedido/e-mail permanecem conforme o relato geral do operador. Falta anexar o JSON real da supervisão posterior -StatusOnly para confirmar as contagens de inbox/outbox e ausência de pendências. Se a consulta já foi executada, compartilhar seu resultado sem repetir; caso contrário, executar apenas uma leitura -StatusOnly. Não processar novo lote nem repetir a simulação; manter Cron desligado. A imagem não substitui auditoria de estoque/ledger nem supervisão das filas.

### Fechamento do cenário simulado de evento fora de ordem — 08/10/2026

A consulta final -StatusOnly apresentada pelo operador foi SCOPE_VERIFIED, sandbox-hml, at=2026-10-08T21:53:02.744Z e processingAttempted=false: inbox com duas COMPLETED, outbox com três COMPLETED, nenhum outro estado de fila, uncertain/overdue/abandonedLeases/untrackedLegacyOrders zerados, operations vazio e oldestUnresolvedInboxAt=null. Com o consumo sem retry/review e a conferência posterior de pedido/carteira/e-mail, o cenário simulado está aprovado em homologação (seção 70 do registro).

Preservar pedido #1/cobrança e manter Cron desligado. Não repetir a simulação, consultas ou lotes apenas para obter a mesma evidência. O teste verifica notificação antiga sintética entregue à aplicação depois da aprovação; não comprova reordenação real do Asaas nem todos os requisitos E08. Concorrência, recuperação de lease e demais cenários financeiros/operacionais continuam conforme workflow, sem aprovação integral de produção.
