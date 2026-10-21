# Preparação da homologação para os ensaios financeiros — 21/10/2026

**Candidata publicada e migration aplicada; cenários financeiros não executados.**
Preparação da frente Vanderlei solicitada pelo operador e executada por Codex.
Conferências finais entre 12:16 e 12:18 BRT. Checkout e controles financeiros
permanecem desligados conforme o estado combinado; não houve promoção de tráfego.

[Evidência sanitizada](evidencias/V-CLOUDRUN-9495FF9-2026-10-21.json).
Detalhes locais: `artifacts/cloudrun-9495ff9-20261021/`, ignorados pelo Git.
O roteiro de aceite ainda será entregue por Leno; esta preparação não o substitui.

## Artefato e publicação

| Item | Resultado |
|---|---|
| SHA publicado | `9495ff942e832db6588219e57163982b246e16d7` |
| CI | [39619498248 — success](https://github.com/ViniMoia/Sistema-E-Commerce/actions/runs/39619498248), do SHA exato; todas as etapas concluídas antes da migration remota |
| Projeto / região | `continental-511812` / `southamerica-east1` |
| Imagem | `southamerica-east1-docker.pkg.dev/continental-511812/releases/store` |
| Digest do índice enviado | `sha256:3444783bf8f5f3e41df033ef69f2e5a54252a3fb5ff1dc67e8bb8e53bc3d4155` |
| Digest Linux/amd64 efetivo, comum à aplicação e aos Jobs | `sha256:7a360eb28fd93be1606d6b8c1591e12c61c3d1db5f06fdb51ca86fe81d056202` |
| Revisão Cloud Run | `continental-hml-9495ff9-review`, `Ready=True` |
| URL de teste | https://review-9495ff9---continental-hml-jctvprygla-rj.a.run.app |
| Tráfego | Candidata 0%; `continental-hml-896dc56-logout` mantém 100%; tags anteriores preservadas |

A imagem foi construída a partir de `git archive` do SHA exato, sem arquivos
privados, e validada localmente com duas instâncias, assets, reinício e consumidor
autenticado em banco descartável. A CI aprovou o mesmo código; o digest acima
identifica a imagem local validada e enviada ao registro, reutilizada pelos Jobs.
Não se atribui à CI um digest que ela não publicou.

A candidata inclui as entregas integradas dos PRs #11 e #12. Sua publicação não
encerra os aceites de imagens, PIX, boleto, retorno físico ou chargeback.

## Backup e migration

- Banco exclusivo de homologação: Neon PostgreSQL 18.6, `neondb`, host
  `ep-blue-feather-b6l24gbu.c-2.sa-east-1.aws.neon.tech`.
- Backup fresco do schema `public`, capturado por conexão somente leitura,
  criptografado com AES-256-GCM, chave DPAPI e diretório protegido por ACL.
- Referência: `%LOCALAPPDATA%/continental-hml-backups/ee9f404a92124b124c175696848eacaa/`.
  Preservar `homologacao.dump.enc` e `key.dpapi` fora do Git/OneDrive.
- SHA-256 do conteúdo restaurável:
  `d413a68d2eb01bbb49c356304d2172b9375dae7d28dd69aac0604bb49f91327e`.
- Restauração e ensaio da migration em PostgreSQL descartável sem rede externa
  concluídos às 12:07:07 BRT; 38 tabelas restauradas, dados existentes preservados,
  novo campo nulo nas 16 operações existentes e trigger instalado. Contêiner
  descartado por identidade. Esta é prova pelo mesmo usuário Windows, não por
  operador alternativo; roles, owners, ACL e recursos externos não estão cobertos.
- Antes da aplicação, fingerprints do banco compartilhado coincidiram com o
  backup ensaiado. Havia 34 migrations aplicadas e somente
  `20261021140000_boleto_refund_request` pendente, sem falha ou checksum divergente.
- Aplicação por `prisma migrate deploy`, após CI verde; validação concluída às
  **12:15:13 BRT**. Agora são **35 migrations**, nenhuma pendente/falha e
  `migrate diff --exit-code=0`.
- Campo `refundRequestUrl`, constraint com `BOLETO_READY` e trigger
  `PaymentOperation_boleto_guard` conferidos. Dados anteriores preservados;
  somente o histórico da migration foi acrescentado. Nenhum link de devolução
  criado nas 16 operações antigas.
- Após publicação e sondas, nova comparação das 38 tabelas não encontrou
  mudança em relação ao estado pós-migration.

Não houve `db push`, reset, restauração sobre banco compartilhado, estorno,
reenvio ou operação de pedido antigo. Rollback de aplicação deve preservar a
migration e as evidências; não converter `BOLETO_READY` em `READY`.

## Conta, loja e controles preservados

Conta de integração **Sandbox**, escopo `sandbox-hml`; GET autenticado ao Asaas
Sandbox confirmado. Chaves e conexões da revisão foram comparadas em memória
com a fonte privada de homologação, sem registrar seus valores.

Loja: **`continental-homologacao`**, ID `3a82b33c-3646-4272-9a89-80bb1ba327a5`.
Identidade conferida no banco e na API pública da candidata e do serviço principal.

```text
CHECKOUT_PAUSED=true
APP_MAINTENANCE_MODE=false
PAYMENT_REMOTE_ENABLED=false
PAYMENT_WORKER_ENABLED=false
PAYMENT_EXPIRATION_ENABLED=false
PAYMENT_DEPLOYMENT_ENVIRONMENT=SANDBOX
ASAAS_ACCOUNT_SCOPE=sandbox-hml
```

Flags conferidas na candidata e na revisão que mantém 100% do tráfego. Os
bindings anteriores foram preservados. Acrescentados somente o alias exato da
nova tag e o binding `ASAAS_WEBHOOK_TOKEN=continental-hml-asaas-webhook-token:1`.
O novo segredo usa o token privado conferido no receptor atual e concede acesso
à conta web; os consumidores não recebem esse token.

`origin/main` local `7f9b26e062ec2654420fecffb6dd78ad3ba1e017` e seus documentos
foram consultados somente leitura. Main e seu banco não foram modificados.

## Webhook e consumidores

**Destino efetivo no Asaas permanece na Vercel:**
`continental-prototipo-git-homologacaoteste-vinimoias-projects.vercel.app/api/webhooks/asaas`.
Webhook habilitado, fila não interrompida. A URL cadastrada contém parâmetro
de bypass; o valor não é reproduzido. A rotação desse bypass não foi comprovada.

Sondas sem evento válido ou ID de pedido: token ausente/incorreto retornou 401;
token privado com JSON malformado retornou 400 no receptor Vercel. Seu status
autenticado respondeu 200 com escopo `sandbox-hml`. Isso comprova o comportamento
observado do endpoint, não a versão implantada ou as agendas dessa plataforma.

Na candidata Cloud Run, token ausente/incorreto retornou 401; token correto
retornou 503 / consumidor indisponível, conforme `PAYMENT_WORKER_ENABLED=false`.
O status autenticado retornou 200 e o anônimo 401. O receptor Cloud Run está
configurado, mas não foi escolhido como destino no Asaas nem habilitado para
persistir eventos. Não houve evento real, reentrega ou transferência.

| Acionador / consumidor | Estado observado |
|---|---|
| `continental-hml-payments` | Criado, pronto, mesmo digest/origem da candidata; zero execuções e nenhuma agenda criada. O modo inclui inbox, conciliação, expiração e outbox na rota existente. |
| `continental-hml-supervision` | Atualizado para o mesmo digest/origem; pronto, zero execuções e nenhuma agenda criada; modo somente GET. |
| Cloud Run, demais regiões | Listagem sem filtro regional encontrou somente os dois Jobs acima. |
| Cloud Scheduler | API continua desabilitada; agendas não inventariadas. Isso não comprova ausência global de agendas. |
| Vercel / Cloudflare | Sem acesso administrativo autenticado ao painel/API para confirmar agendas, versões, flags e execuções em voo. O Worker local segue com crons vazios e desabilitado; código local não comprova estado remoto. |
| Execuções manuais / outras máquinas | Histórico e invocações em voo não conferidos. Nenhuma tarefa Windows correspondente encontrada neste computador na consulta. |

Ambos os Jobs usam a conta consumer e somente o segredo de cron, sem credenciais
de banco, gateway ou e-mail, e não possuem binding público de invocação.
**Nenhum consumidor Cloud Run foi executado nesta preparação. A exclusividade
global de processamento continua sem comprovação.** Antes dos novos cenários,
inventariar e conter acionadores antigos, drenar requisições/leases e coordenar
destino do webhook e ativação do único processador autorizado. Não basta haver
zero leases no snapshot nem `parallelism=1` no Job.

## Alertas e janela proposta

- Canal `3617580342119339067`: destinatário previamente informado pelo operador,
  correspondência conferida; endereço pessoal mantido fora do documento Git.
- Políticas de ausência `16768859373754969259` e falha/atenção
  `2245739515294212144`: configuradas para a supervisão.
- Canal e ambas as políticas continuam **desabilitados**. Entrega não demonstrada;
  a supervisão não cobre automaticamente os heartbeats do novo Job de pagamentos.
- Responsável nominal pelo atendimento e substituto ainda precisam ser aceitos.
- **Janela sugerida, não confirmada:** 21/10/2026, **14:00–15:30 BRT /
  17:00–18:30 UTC**, condicionada à disponibilidade, roteiro de Leno, inventário
  externo, coordenação do transporte, canais e limites de custo/cadência.
  Se essas condições não estiverem prontas, reagendar; não ativar automaticamente.

Leno define os novos casos e seu baseline; Vanderlei acompanha infraestrutura,
consumidores e alertas; operador/substituto confirma recebimento e atendimento.
As pendências históricas não serão utilizadas para provocar falhas ou novos
estornos. Esta entrega não afirma que o banco antigo esteja livre de trabalho
pendente: o futuro acionamento de pagamentos precisa considerar suas filas.

## Conferência de disponibilidade e limites

Home, login, produtos e loja ativa responderam 200 na candidata e no endereço
principal. Admin anônimo redirecionou ao login. Checkout vazio foi recusado
com 503 / `CHECKOUT_PAUSED`, sem criação de compra. Não foram criadas contas de
teste, alterados pedidos nem realizados ensaios financeiros nesta publicação.

E-mail/reset, frete, capacidade do ambiente, entrega dos alertas e recuperação
por operador alternativo mantêm suas pendências próprias. G3/G6/G8 continuam
abertos; a candidata está disponível para conferência e coordenação dos ensaios.
