# Candidata integrada do dashboard no Cloud Run — 16/10/2026

A migration de homologação foi aplicada e a revisão integrada foi publicada e
validada pela URL de teste, com **0% do tráfego do serviço**. A revisão anterior
`continental-hml-896dc56-logout` permanece com 100%. Não houve promoção, merge do
PR, mudança de webhook, ativação de consumidor ou alteração na main.

## Identidade e CI

- PR: [#8](https://github.com/ViniMoia/Sistema-E-Commerce/pull/8).
- Branch de origem: `revisao/dashboard-financeiro-20261016`.
- Commit: `eff10bf879485292d9fff0950af73ffcdfea3883`.
- [CI 38963139960](https://github.com/ViniMoia/Sistema-E-Commerce/actions/runs/38963139960):
  `success`, concluída às 20:56:20 UTC / 17:56:20 BRT.
- Todos os passos do job passaram, incluindo unitários, TypeScript, lint,
  migrations, isolamento, duas instâncias, manutenção/recuperação, standalone,
  capacidade e contêiner Linux. A migration remota aguardou esse resultado.
- A imagem local também passou no build Linux/amd64 com Node 22.23.3. Foi gerada
  de um `git archive` do SHA exato, sem trocar a branch local `homologacao_teste`.

## Banco, backup e migration

Fonte exclusiva de conexão: `.env.homologacao`, privado e ignorado pelo Git.
`DATABASE_URL` e `DIRECT_URL` da revisão foram comparados em memória com as
versões 1 dos segredos correspondentes: ambos coincidem com essa fonte.

- Provedor/host: Neon, `ep-blue-feather-b6l24gbu.c-2.sa-east-1.aws.neon.tech`.
- Banco: `neondb`, PostgreSQL 18.6.
- Loja: `3a82b33c-3646-4272-9a89-80bb1ba327a5`, `continental-homologacao`.
- Nenhuma conexão ou alteração no banco principal.

Backup criado por `pg_dump` em conexão somente leitura, com AES-256-GCM e chave
protegida por DPAPI; pasta com ACL do usuário Windows, fora do repositório e do
OneDrive: `%LOCALAPPDATA%/continental-hml-backups/dad96ff03044f5d15486b2adee06c167/`.
Arquivo: `homologacao.dump.enc`; chave: `key.dpapi`. Preservar ambos.
SHA-256 do conteúdo restaurável:
`e05adcad8f8061e5fa10a049ccea6a99264811eeaec57c69bc7b8ba3a9f2471a`.

O backup foi relido, descriptografado e restaurado em PostgreSQL 18 descartável,
sem rede externa nem porta publicada. A migration ensaiada preservou os hashes
dos dados das 37 tabelas existentes; a nova tabela ficou vazia. O contêiner foi
descartado e sua ausência foi conferida. Escopo do backup: schema `public`, sem
replay de roles globais, owners ou ACL. A restauração foi feita pelo mesmo usuário
Windows; não comprova recuperação por operador alternativo.

Prévia: 33 migrations aplicadas, nenhuma falha e somente
`20261016193000_order_reporting_exclusion` pendente. As diferenças iniciais de
checksum eram exclusivamente CRLF/LF; os 33 hashes correspondem após normalização
de quebra de linha. O diff Prisma anterior mostrava apenas a estrutura nova.

Aplicação por `prisma migrate deploy`, concluída às **20:56:57 UTC / 17:56:57 BRT**:

- Apenas a migration revisada foi aplicada; nenhum `db push`, reset ou resolve.
- `migrate status`: atualizado; `migrate diff --exit-code`: **0**, sem diferenças.
- Chave primária, FK e checks de motivo/proveniência conferidos no catálogo SQL.
- Comparação antes/depois: nenhum dado de tabela existente alterado pela migration.
- `OrderReportingExclusion`: **zero registros**. Nenhum pedido classificado.
- Hash registrado da migration:
  `873e2f99351f9299109abff5c2222c97b6140b167f9190a865ed3b717185a7a2`.

## Revisão e tráfego

- Projeto/região: `continental-511812` / `southamerica-east1`.
- Revisão: **`continental-hml-eff10bf-dashboard`**, Ready=True.
- URL de teste: https://dashboard-eff10bf---continental-hml-jctvprygla-rj.a.run.app
- Repositório da imagem: `southamerica-east1-docker.pkg.dev/continental-511812/releases/store`.
- Digest do índice enviado: `sha256:d7ea98f6f3601b32c347b6ecb7365cd530336d49ef195b6663c6500bfd366b1a`.
- **Digest Linux/amd64 resolvido pelo Cloud Run:**
  `sha256:152430471d6699e2a7cf9e6ddf74d13e78d7762d60e5a1f9c6cb02b86bf2d199`.

O índice contém o manifesto da plataforma; ambos foram registrados para evitar
confundir o digest enviado com o resolvido. A imagem tem label de origem `eff10bf`.
A publicação usou `--no-traffic` e tag `dashboard-eff10bf`. Somente o host exato da
tag foi acrescentado aos aliases da candidata, apontando à mesma loja. O domínio
cadastrado da Vercel não foi substituído. Todos os demais bindings de ambiente
foram comparados e preservados. Tráfego reconferido às 21:00:57 UTC / 18:00:57 BRT.

```dotenv
APP_MAINTENANCE_MODE=false
CHECKOUT_PAUSED=true
PAYMENT_REMOTE_ENABLED=false
PAYMENT_WORKER_ENABLED=false
PAYMENT_EXPIRATION_ENABLED=false
PAYMENT_DEPLOYMENT_ENVIRONMENT=SANDBOX
ASAAS_ACCOUNT_SCOPE=sandbox-hml
```

## Conferência funcional e financeira

Na URL da candidata: home, produtos, loja ativa e login retornaram 200; a identidade
da loja corresponde ao destino acima. Admin anônimo redirecionou ao login; POST
de checkout vazio retornou 503 `CHECKOUT_PAUSED`, sem criar compra. A URL principal
continuou respondendo home/produtos/login 200 e Admin anônimo 307 após a migration.

Validação final com administrador temporário autorizado: **40 verificações
aprovadas**, incluindo formulário real de login, páginas/APIs administrativas,
dashboard desktop e 390 px, logout 303 com `Location: /` e rejeição de cookie
revogado com 401. Conta e sessões removidas; consulta final encontrou zero
administradores sintéticos desta rodada.

A apuração independente, em JavaScript com centavos inteiros e snapshot PostgreSQL
`REPEATABLE READ / READ ONLY`, comparou 16 valores renderizados. Base: oito pedidos,
34 fatos financeiros e nenhuma exclusão. Recorte conferido às 20:59:37 UTC / 17:59:37
BRT; o painel mostrava consulta às 17:59:02 BRT, dentro do cache de 60 segundos.

| Medida | Hoje | Mês | Histórico |
|---|---:|---:|---:|
| Reconhecido bruto | R$ 0,00 | R$ 542,67 | R$ 542,67 |
| Liquidação bruta | R$ 0,00 | R$ 124,75 | R$ 124,75 |
| Estornos confirmados | R$ 0,00 | R$ 417,92 | R$ 417,92 |
| Reconhecido menos estornos | R$ 0,00 | R$ 124,75 | R$ 124,75 |

Composição histórica: produtos após descontos **R$ 469,05**, frete **R$ 12,30**,
encargos **R$ 61,32**, reconhecido sem composição completa **R$ 0,00**. Todos os
valores coincidiram. Painel mobile: largura e scrollWidth de 340 px, sem overflow.
Captura do painel inspecionada visualmente, mantida apenas em artefatos locais.

Cobertura da apuração observada: `COMPLETE`, zero pedidos sem evidência e zero em
revisão segundo o contrato desse indicador. Isso não encerra a revisão operacional
do reembolso do pedido #3 nem valida novas operações financeiras. O pedido #8 e
seus prazos reais foram preservados. Após os testes, hashes de 35 tabelas, incluindo
pedidos, estoque, pontos, fatos, inbox/outbox e histórico de migrations, permaneceram
iguais ao estado pós-migration. Usuários, sessões e AuditLog não integraram essa
última comparação; a remoção dos temporários foi verificada separadamente.

Limites e tentativas anteriores: a primeira automação do navegador não concluiu o
login dentro da espera; sua causa não foi comprovada. A segunda entrou e conferiu
os valores, mas parou por corrupção de acentos no seletor do script local. O script
passou a aguardar o documento carregado e usar o data-testid existente. A rodada
final passou sem mudar o código publicado. Todas as tentativas removeram suas
contas temporárias. Na consulta de logs da candidata (uma hora, limite 100), a
única entrada de erro foi o 503 esperado do teste de checkout; sem marcadores de
tenant/logout encontrados. Isso não substitui monitoramento contínuo.

## Entrega e limites operacionais

Evidência sanitizada: [V-DASHBOARD-CLOUDRUN-2026-10-16.json](evidencias/V-DASHBOARD-CLOUDRUN-2026-10-16.json).
Scripts, captura e detalhes locais: `artifacts/dashboard-eff10bf-20261016/`, ignorado
pelo Git; backup privado fora desse diretório. Não enviar arquivos de ambiente,
backup, chave DPAPI, perfis de navegador ou cookies ao GitHub.

A candidata está validada para revisão pela URL de teste e **não foi promovida**.
Não houve classificação de pedidos, replay, cobrança, estorno, mudança de webhook,
habilitação de Scheduler ou acionamento do Worker Cloudflare. A transferência
financeira e o inventário pendente de Scheduler continuam separados. Para rollback
da aplicação, preservar a migration aditiva: não remover a tabela nem restaurar
o banco apenas para trocar o tráfego. A revisão anterior já mantém os 100%.
