# 🚗 Handover Técnico: Redesenho da Hero com Carrossel de Painéis

**Branch:** `feat/hero-carrossel-paineis`  
**Data:** 26/11/2026  
**Status Atual:** Arquitetura implementada, validada e funcional (1060 testes unitários passando).  
**Objetivo para o Próximo Desenvolvedor:** Dar seguimento à modelagem visual da Hero e aprimorar o carrossel (ajustes finos de transição, responsividade, acabamento e polimento visual).

---

## 1. Contexto e Decisões de Design

A antiga Hero da loja executava um vídeo de abertura em loop que gerava peso de rede e desalinhamentos visuais. Ela foi substituída por um carrossel dinâmico focado em **painéis de arte de alta resolução** (marcas e produtos de estética automotiva).

### Decisões Validadas pelo Cliente:
1. **Ocupação Visual ~95% da Tela:** A arte do painel deve ocupar praticamente toda a largura disponível da Hero.
2. **Botões de Navegação Externos:** As setas de navegação lateral (anterior/próxima) ficam posicionadas **fora** do palco da arte (em colunas laterais de ~2.5% cada), garantindo que **nenhum logo ou texto da arte seja tampado**.
3. **Opção B (Zero Cortes com Fundo Ambiental):** 
   - A arte nítida é exibida com `object-contain object-center` (visibilidade de 100% da imagem sem distorção).
   - Um reflexo ambiental da própria arte com `blur-2xl opacity-30` preenche as sobras de tela decorrentes de diferentes proporções de imagem (4:3, 3:2, 16:9).
4. **Painel 100% Limpo:** Nenhum card de produto, texto ou botão de CTA é sobreposto à arte. O próprio slide é um botão clicável que faz scroll suave para `#catalogo`.

---

## 2. Estrutura Arquitetural Implementada

### A. Validação e Schemas (`lib/validators/hero-slides.ts`)
- Schemas Zod `heroSlideSchema` e `heroSlidesArraySchema`.
- Suporta 3 tipos de slides: `ART_PANEL` (painel de marcas/institucional), `PRODUCT_ART` (produto em destaque) e `BRAND_COLLECTION` (filtro de marca).
- Constante `DEFAULT_CONTINENTAL_HERO_SLIDES` configurada com as 3 artes oficiais no Cloudinary:
  1. `https://res.cloudinary.com/dpt3zi8kx/image/upload/v1795660021/3_hzfdbp.png`
  2. `https://res.cloudinary.com/dpt3zi8kx/image/upload/v1795660021/4_fl1aqd.png`
  3. `https://res.cloudinary.com/dpt3zi8kx/image/upload/v1795660021/2_grdpdk.jpg`

### B. Resolvedor Server-Side (`lib/hero/resolve-hero-slides.ts`)
Hierarquia de resolução de conteúdo:
1. Slides ativos configurados no banco (`Loja.heroSlides`).
2. Produtos com flag `isFeaturedHero = true` (se não houver slides na Loja).
3. Fallback autoritativo: `DEFAULT_CONTINENTAL_HERO_SLIDES`.

### C. Componente Front-End (`components/home/HeroCarousel.tsx`)
- Container em 3 colunas (Seta Esquerda ~2.5% | Palco Central ~95% | Seta Direita ~2.5%).
- Altura dinâmica calibrada: `h-[58vh] min-h-[340px] max-h-[580px]` (mobile) e `md:h-[calc(100dvh-5rem)] md:min-h-[540px] md:max-h-[960px]` (desktop).
- Gestão de rotação: Autoplay de 6s, pausado com hover/focus ou via botão play/pause, suporte a `prefers-reduced-motion` e suporte a touch-swipe mobile.
- **Evento Crítico:** Dispara `window.dispatchEvent(new CustomEvent('hero-car-illuminated'))` na montagem, mantendo o contrato visual com o `ConditionalHeader`.

### D. Painel Administrativo (`components/admin/HeroSlidesManager.tsx` e `app/admin/settings/page.tsx`)
- Gerenciador interativo de slides para o lojista: reordenação (subir/descer), ativação/desativação, exclusão e adição de novos painéis por URL.
- API REST: `app/api/loja/hero-slides/route.ts` (`GET`/`PUT` protegidos por `requireAdmin`).
- Serviço com lock e log de auditoria: `services/loja.service.ts` (`updateLojaHeroSlides`).

---

## 3. O Que Você (Próximo Desenvolvedor) Precisa Fazer / Aprimorar

O esqueleto técnico, a integração com o banco, os contratos de API, os formulários administrativos e a lógica de fallback estão **100% prontos e testados**. 

Sua missão é **terminar de modelar e refinar a experiência da Hero**:

1. **Refinamento de Animações e Transições:**
   - Experimentar transições mais suaves entre slides (ex: crossfade interpolado com aceleração suave, efeito ken-burns sutil ou slide horizontal por transform).
   - Testar o comportamento da rotação automática sob diferentes conexões (preloading do próximo slide).

2. **Polimento Responsivo (Mobile & Ultrawide):**
   - Testar visualmente em telas pequenas (320px - 414px) para calibrar a altura e o espaçamento dos botões laterais e dos dots.
   - Avaliar se em telas mobile ultra-estreitas as setas laterais devem recolher ou sobrepor levemente as extremidades sem cobrir logos.
   - Ajustar o limite máximo em monitores ultrawide (21:9 / 32:9).

3. **Estilo da Moldura e Contorno:**
   - A borda atual é `border border-catalog-gold/25` com fundo `#050B14`.
   - Ajustar a intensidade do brilho dourado (`shadow-[0_0_...px]`) ou testar gradientes de borda para destacar ainda mais a sofisticação da marca Continental.

4. **Extensibilidade (Overlays Futuros):**
   - Caso o lojista cadastre um slide do tipo `PRODUCT_ART` com `overlayMode: 'MINIMAL_DOCK'`, a lógica e os dados já estão previstos no schema (`productId`, `price`, `pixPrice`). Avaliar se vale desenhar uma pílula flutuante que respeite o layout 95%.

---

## 4. Comandos Úteis e Validação

```bash
# Rodar servidor de desenvolvimento
npm run dev

# Checar tipagem TypeScript
npx tsc --noEmit

# Rodar a suíte completa de testes unitários
npm run test:unit

# Rodar especificamente os testes da Hero
npx vitest run tests/unit/hero-carousel.test.ts
```

---

## 5. Regras Críticas do Repositório (NÃO QUEBRAR)

1. **Sem Upload de Arquivos:** O sistema proíbe uploads diretos no servidor (política sem uploads locais). Utilize apenas URLs públicas (Cloudinary) ou assets locais estáticos em `/public/hero/`.
2. **Multi-tenant Obrigatório:** Todo acesso à `Loja` deve respeitar o `tenantId` da sessão/domínio.
3. **Evento `hero-car-illuminated`:** Nunca remova o disparo desse evento no `HeroCarousel.tsx`; o `ConditionalHeader` depende dele para renderizar a barra de navegação no scroll.
