# Checklist de verificação externa de infraestrutura

Este checklist separa o que existe no repositório do que só pode ser provado no provedor. Nada abaixo foi executado em produção nesta etapa.

## Cloud, runtime e rede — REQUIRES INFRASTRUCTURE VERIFICATION

- [ ] Provedor, projeto, conta, região, runtime, número de réplicas e limites documentados.
- [ ] Imagem promovida por digest; usuário não-root e filesystem/permissões conferidos.
- [ ] TLS válido, renovação, HSTS e redirects HTTP→HTTPS testados nos domínios reais.
- [ ] WAF/edge limita corpo, conexões lentas e taxas; CORS/CDN não mistura tenants.
- [ ] Ingress substitui `Host`/`X-Forwarded-Host`/IP conforme contrato; só então definir `TRUSTED_PROXY_PROVIDER`.
- [ ] SIGTERM, drain de 10–30 s, readiness e restart testados com requisições em voo.
- [ ] Multi-réplica compartilha encryption key, deployment ID e invalidação de cache/tags.

## Secrets e configuração — REQUIRES INFRASTRUCTURE VERIFICATION

- [ ] Credenciais potencialmente versionadas foram revogadas/rotacionadas em Asaas, Resend e banco; remoção do arquivo não encerra o risco histórico.
- [ ] Secrets ficam em secret manager, possuem owner, escopo mínimo, expiração/rotação e auditoria.
- [ ] `npm run validate:env -- --target production --migration` passa sem expor valores.
- [ ] Simulator/bootstrap permanecem falsos; previews não usam dados/credenciais de produção.
- [ ] Variáveis `NEXT_PUBLIC_*` foram revisadas como públicas e lembradas como congeladas no build.

## Banco e acesso — REQUIRES INFRASTRUCTURE VERIFICATION

- [ ] `_prisma_migrations`, checksums e drift conferidos por ambiente.
- [ ] Upgrade histórico de `INF-002` ensaiado sobre snapshot sanitizado da versão realmente instalada.
- [ ] `ops/database/verify-access.sql` executado em modo read-only; owner, `BYPASSRLS`, grants, RLS e default privileges aprovados.
- [ ] A decisão de incorporar hardening RLS considera a role real da aplicação; nenhuma política fail-closed é aplicada às cegas.
- [ ] Pool, timeouts, conexões máximas, failover, locks e janela de DDL medidos.
- [ ] Backup/PITR e restore drill atendem RPO/RTO aprovados.

## Jobs e integrações — REQUIRES INFRASTRUCTURE VERIFICATION

- [ ] `ops/scheduler/jobs.example.yml` foi traduzido para o scheduler real com token no secret manager.
- [ ] Frequência, retry de 503, exclusão de concorrência, timeout, heartbeat e alerta de ausência testados.
- [ ] Asaas: webhook, reentrega, eventos fora de ordem e reconciliação em sandbox autorizada.
- [ ] Resend/DNS: SPF/DKIM/DMARC, entrega, bounce e suppressions.
- [ ] Supabase/storage: buckets, RLS, MIME, CORS, retenção e service role.

## GitHub e supply chain — REQUIRES INFRASTRUCTURE VERIFICATION

- [ ] Branch protection exige o workflow e revisão; ambientes exigem aprovadores.
- [ ] Token do workflow mantém `contents: read`; PR de fork foi exercitado.
- [ ] Dependabot está habilitado e PRs de actions/npm/Docker são revisados.
- [ ] Registry usa scanning, assinatura/provenance, retenção e promoção do mesmo digest.
- [ ] Runners e actions por SHA seguem política da organização.

## Observabilidade e operação — REQUIRES INFRASTRUCTURE VERIFICATION

- [ ] Collector coleta stdout/métricas por TLS, com RBAC, retenção e redaction.
- [ ] Alertas de readiness, 5xx, checkout, webhook e cron foram carregados e testados.
- [ ] IDs de correlação atravessam proxy e integrações sem PII.
- [ ] Runbooks e on-call têm owner, prazo e exercício registrado.
