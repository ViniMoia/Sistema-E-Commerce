# ADR-001: Adotar monólito modular em camadas com fronteiras incrementais

- **Status**: proposed
- **Date**: 2026-09-27
- **Deciders**:
- **Tags**:

## Context

O repositório é um monólito full-stack em Next.js App Router com serviços de aplicação e Prisma. Existem portas pontuais para pagamento e frete, mas não há declaração nem aplicação consistente de arquitetura hexagonal: serviços importam o cliente Prisma e alguns módulos de aplicação dependiam de `next/*` ou de tipos definidos em `app/`.

Uma migração global para hexagonal exigiria portar todos os repositórios, composition roots e integrações ao mesmo tempo, aumentando risco de quebra em checkout, autenticação, estoque e pagamentos. Ao mesmo tempo, dependências de framework e apresentação dentro de serviços dificultam testes, reutilização e atualização do Next.

## Decision

Manter o sistema como **monólito modular em camadas** e corrigir fronteiras por fluxo vertical:

1. `app/` e componentes são adaptadores de apresentação/HTTP e podem importar Next/React.
2. `services/` contém casos de uso e regras coordenadas. Serviços não devem importar `app/`, componentes ou APIs de Next/React.
3. Tipos compartilhados pertencem a `types/` ou ao módulo de domínio, não à apresentação.
4. Prisma pode permanecer diretamente nos serviços enquanto a abstração não trouxer uma necessidade concreta. Portas serão criadas para integrações externas, testes determinísticos ou persistência com múltiplas implementações — não para cada query simples.
5. Invalidação de cache do framework acontece na borda Next. Cache de aplicação permanece no módulo que o possui.
6. Cada migração deve preservar contrato e possuir caracterização comportamental e teste de fronteira.

O primeiro corte aplica a decisão ao fluxo de configurações da loja e ao DTO de histórico de pedidos.

## Consequences

### Positive

- Evita dependências de Next/React em casos de uso migrados.
- Reduz ciclos e inversões de dependência sem uma reescrita ampla.
- Mantém Prisma simples onde não existe necessidade comprovada de uma porta.
- Permite revisar comportamento e deploy por fluxo vertical.

### Negative

- A arquitetura continuará híbrida durante a migração incremental.
- Serviços ainda acoplados ao Prisma exigem mocks estruturais ou PostgreSQL em testes de integração.
- Regras de fronteira precisam de lint/teste arquitetural para não regredir.

### Neutral

- Portas existentes de pagamento e frete permanecem válidas.
- Cache/rate limit distribuídos, scheduler e outbox são decisões de infraestrutura separadas.
- Este ADR não declara conformidade hexagonal nem readiness de publicação.

## Links

- `docs/audits/ARCHITECTURE-AUDIT.md` — ARCH-010.
- `docs/remediation/PLAN.md` — onda de arquitetura e contratos.
- `docs/remediation/ARCHITECTURE-FIXES.md` — evidências da implementação.
