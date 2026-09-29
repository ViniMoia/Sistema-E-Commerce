# Runbook de implantação e rollback

Estado: procedimento revisável; **não executado em produção nesta etapa**.

## Papéis mínimos

- Release owner: aprova versão, janela e critério de abortar.
- DBA/migration owner: executa preflight e migration com credencial separada.
- Operações: promove o mesmo artefato, observa probes/métricas e conduz rollback.
- Segurança: confirma secrets, domínio, proxy e permissões.

Nenhuma pessoa deve colar credenciais em terminal compartilhado, issue, log ou relatório. Use o secret manager da plataforma e referências por nome.

## Pré-condições bloqueantes

1. CI da revisão está verde: secret scan, contrato de ambiente, Prisma validate, cadeia de migrations em banco vazio, diff, typecheck, lint, unitários, integração, build e Docker build.
2. O artefato de container foi construído uma vez, identificado por digest e assinado/armazenado no registry autorizado. Não reconstruir entre staging e produção.
3. `APP_ENV`, `DEPLOYMENT_VERSION` e variáveis obrigatórias passaram em `npm run validate:env -- --target production --migration` dentro do ambiente de release, sem imprimir valores.
4. Estado de `_prisma_migrations`, drift, volume, locks e dados inválidos foi inventariado. `INF-002` impede aplicar cegamente a cadeia histórica sobre snapshot intermediário populado.
5. Backup/PITR recente e restore drill compatível com o RPO/RTO aprovado possuem evidência; ausência bloqueia DDL não trivial.
6. Versões N e N-1 foram verificadas contra o schema expandido. Migrações desta revisão devem ser aditivas/backward-compatible durante rollout.
7. Owner e janela estão registrados; canais de incidente e decisão de rollback estão abertos.

## Sequência de release

1. Congelar a revisão e registrar commit, digest do artefato e digest da imagem base.
2. Em ambiente isolado equivalente, restaurar cópia sanitizada e executar preflight de dados/locks.
3. Executar uma única vez, por job exclusivo, `npm run migrate:status` e depois `npm run migrate:deploy`. Nunca usar `prisma db push` ou `migrate reset` em ambiente persistente.
4. Confirmar `prisma migrate status` e diff canônico. Divergência ou migration falha interrompe a promoção; não marcar manualmente como aplicada sem análise do DBA.
5. Promover o mesmo digest com usuário não-root, probes configurados e secrets injetados em runtime.
6. Readiness deve ficar fora do balanceador até banco/configuração estarem disponíveis. Liveness não substitui readiness.
7. Executar `SMOKE_BASE_URL=<origem> ALLOW_REMOTE_SMOKE=true npm run smoke:deployment` somente no ambiente autorizado; depois validar catálogo, login e um fluxo não financeiro com fixture própria.
8. Observar 5xx, readiness, checkout, webhook e crons durante a janela acordada. Nenhum pagamento real é usado como smoke.

## Critérios objetivos de abortar

- migration pendente/falha/drift inesperado;
- readiness diferente de 200 após o grace period;
- crescimento de 5xx ou saturação de conexões acima do limite aprovado;
- falha de autenticação/isolamento de tenant;
- evento financeiro em estado ambíguo sem reconciliação disponível;
- scheduler ou webhook incapaz de retomar um erro controlado.

## Rollback

1. Interromper promoção e preservar logs/IDs de correlação, sem PII.
2. Se somente aplicação mudou e schema é compatível, retirar o novo digest e recolocar exatamente o digest N-1.
3. Não tentar “desfazer” DDL apagando tabela/coluna durante incidente. Para migrations aditivas, manter schema e fazer forward-fix.
4. Se houver corrupção/perda comprovada, acionar o runbook de restauração e decidir ponto no tempo com Pagamentos/Operações; reconciliar eventos posteriores ao ponto restaurado.
5. Readiness e smoke read-only precisam passar antes de reabrir tráfego.
6. Registrar timeline, impacto, pedidos/eventos para reconciliação e ação preventiva.

## Verificações específicas de Next.js self-hosted

- Reverse proxy limita corpo/conexões lentas e sobrescreve headers encaminhados; `TRUSTED_PROXY_PROVIDER` só é definido após teste.
- Em múltiplas réplicas, `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, `DEPLOYMENT_VERSION` e coordenação de cache/tags são compartilhados.
- A plataforma envia SIGTERM e oferece 10–30 segundos de drain; confirmar callbacks e requisições em voo.
- CDN não pode armazenar respostas privadas nem misturar tenants. Testar cache keys e headers.

## Evidência a anexar à release

Commit/digest, resultados dos gates, status/diff das migrations, ID do backup/restore drill, timestamps dos probes/smokes, métricas antes/depois, aprovadores e resultado do rollback ensaiado. Valores secretos e dados pessoais nunca entram no anexo.
