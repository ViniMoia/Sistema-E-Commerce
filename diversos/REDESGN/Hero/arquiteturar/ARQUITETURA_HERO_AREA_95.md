# Arquitetura de Ajuste — Ampliação da Área da Imagem na Hero (~95% com Corredores Laterais para Controles)

> **Status:** Proposta Arquitetural (Aguardando Validação antes da Implementação)  
> **Documento Base:** [ARQUITETURA_HERO_CARROSSEL_PAINEIS.md](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/diversos/REDESGN/Hero/arquiteturar/ARQUITETURA_HERO_CARROSSEL_PAINEIS.md)  
> **Alvo Principal:** [`components/home/HeroCarousel.tsx`](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/components/home/HeroCarousel.tsx) e [`app/loading.tsx`](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/app/loading.tsx)

---

## 1. Diagnóstico do Problema Atual

Na implementação atual de [`HeroCarousel.tsx`](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/components/home/HeroCarousel.tsx#L210-L253), a imagem ocupa bem menos que 95% da Hero por três motivos matemáticos combinados:

1. **Proporção forçada do container (`lg:aspect-[21/9]` = `2.33:1`) vs. proporção real das 3 imagens:**
   - Imagem 1 (`3_hzfdbp.png`): `1693 × 929` → razão **`1.82:1`**
   - Imagem 2 (`4_fl1aqd.png`): `1536 × 1024` → razão **`1.50:1`** (`3:2`)
   - Imagem 3 (`2_grdpdk.jpg`): `1600 × 1200` → razão **`1.33:1`** (`4:3`)
2. **Restrição vertical (`max-h-[78vh]`) + `object-contain`:**
   - Como `21:9` (`2.33:1`) é muito mais largo do que `1.33:1` e `1.50:1`, ao aplicar `object-contain` o navegador limita a altura e cria **22% a 43% de barras pretas nas laterais**.
3. **Botões de navegação sobrepostos internamente (`left-3 sm:left-6` / `right-3 sm:right-6`):**
   - Em vez de terem um corredor lateral próprio fora da arte, os botões flutuam por cima da zona da imagem.

---

## 2. Arquitetura Proposta para Ocupar ~95% da Hero

### 2.1. Geometria do Palco e Corredores Laterais (~95% Imagem / ~5% Controles)

```text
+----------------------------------------------------------------------------------+
|                    HEADER FIXO (h-16 mobile / h-20 desktop)                      |
+----+------------------------------------------------------------------------+----+
|    |                                                                        |    |
| <  |                     ÁREA DA ARTE (~95% da Hero)                        | >  |
|    |          (ocupando toda a altura útil abaixo do Header)                |    |
|    |                                                                        |    |
|    |                        [ •  •  • | ⏸ ]                                 |    |
+----+------------------------------------------------------------------------+----+
  ~2.5%                                ~95%                                    ~2.5%
```

1. **Altura Útil Total da Dobra (Desktop e Mobile):**
   - Manter `pt-16 md:pt-20 bg-black` para nunca ficar atrás do `Header` fixo (`z-[60]`).
   - Substituir `lg:aspect-[21/9] max-h-[78vh]` por altura orientada à viewport útil:
     - **Desktop (`md+`):** `md:h-[calc(100dvh-5rem)] md:min-h-[540px] md:max-h-[960px]`
       - Em telas padrão (`1920×1080` → área útil `1920×1000`, razão `~1.92:1`; `1366×768` → `1366×688`, razão `~1.98:1`; `1440×900` → `1440×820`, razão `~1.75:1`), o container fica muito próximo da média das imagens (`1.33` a `1.82`), aproveitando quase toda a tela visível na primeira dobra.
     - **Mobile (`<768px`):** `h-[56vh] min-h-[280px] max-h-[520px]` (ou `aspect-[4/3] sm:aspect-[16/10]`) para que painéis `4:3`, `3:2` e `1.82:1` tenham altura generosa sem deixar faixas gigantes em cima/embaixo.
2. **Largura com Corredores Laterais Dedicados (~2,5% cada lado):**
   - Remover o teto `max-w-[1920px]` que restringe monitores ultrawide e usar `w-full px-2 sm:px-3 md:px-4` (ou um layout flex de 3 colunas: `[botão esquerdo w-9 sm:w-12]` + `[palco central flex-1 h-full]` + `[botão direito w-9 sm:w-12]`).
   - **Vantagem do Flex de 3 Colunas (ou `grid-cols-[auto_1fr_auto]`):**
     - Os botões `<` e `>` ocupam **apenas** a faixa lateral estreita (`~40px–52px` no desktop, `~36px` no mobile — equivalente a ~2,5% de cada lado em desktop), deixando **~95% da largura central 100% dedicada à imagem**, sem que as setas cubram nenhuma parte da arte ou texto do painel!
     - Em telas mobile muito estreitas (`<480px`), pode-se alternar entre corredor lateral compacto (`w-8` = `32px` com área clicável `44px` via padding) ou botões translúcidos encostados nas extremidades (`left-1` / `right-1`) para não comprimir a arte em celulares de `360px`.
3. **Borda e Acabamento Canônico (Design System Continental):**
   - O palco central (`flex-1 h-full`) recebe `rounded-xl sm:rounded-2xl overflow-hidden border border-catalog-gold/25 bg-[#050B14]` com leve respiro vertical (`py-1.5 sm:py-2.5`), mantendo a identidade visual Dark & Gold sem desperdício de espaço.

---

### 2.2. Estratégia de Preenchimento da Imagem (Decisão de Enquadramento)

Como as 3 artes atuais têm razões diferentes (`1.82`, `1.50`, `1.33`), existem **duas formas de preencher os 95% do palco central** — cada uma com um comportamento visual distinto que precisa da sua validação:

| Opção | Comportamento Técnico | Prós | Pontos de Atenção |
| :--- | :--- | :--- | :--- |
| **Opção A: `object-cover` Total (Preenchimento 100% do Quadro)** | A imagem preenche 100% da largura e 100% da altura do quadro central de 95% (`w-full h-full object-cover object-center`). | Zero faixas pretas; impacto visual máximo em toda a Hero (~95% reais preenchidos pela arte). | Como `2_grdpdk.jpg` é `4:3` (`1.33`) e `4_fl1aqd.png` é `3:2` (`1.50`), em uma tela `16:9` (`1.78`) o navegador cortará ~15% a ~25% do topo/base para preencher a largura (podendo cortar elementos colados na borda superior/inferior). |
| **Opção B: `object-contain` + Fundo Ambiental Desfocado (Zero Corte)** | A imagem principal usa `object-contain` (preservando 100% dos cantos/logos) sobre uma cópia desfocada da própria arte em `object-cover blur-2xl scale-110 opacity-35`. | **Zero corte** em qualquer tela ou proporção (`4:3`, `3:2`, `1.82:1`); elimina barras pretas sólidas com preenchimento visual contínuo nos 95%. | Nas imagens mais quadradas (`4:3` e `3:2`), a arte nítida não toca os dois extremos laterais — as bordas laterais ficam preenchidas pelo halo desfocado da própria arte. |
| **Opção C (Recomendada): Híbrida Configurável por Painel (`imageFit: "cover" \| "contain"`)** | Adiciona o campo opcional `imageFit` (padrão `"cover"` ou `"contain"` conforme o painel) no schema `HeroSlideConfig` e no Admin (`HeroSlidesManager`). Quando `"contain"`, aplica o fundo ambiental desfocado; quando `"cover"`, preenche 100% do quadro sem barras. | Permite usar `"cover"` nas artes preparadas para tela cheia e `"contain"` com fundo ambiental nas artes que têm logos/textos muito próximos às bordas superiores/inferiores. | Exige escolher o padrão inicial (`"cover"` vs `"contain"`) para os 3 painéis atuais. |

---

### 2.3. Controles Inferiores (Dots, Pausa e CTA) Sem Roubar Área

- **Dots + Play/Pause:** Ficam ancorados na base interna do palco (`bottom-2.5 sm:bottom-3`) dentro de cápsula compacta translúcida (`bg-[#050B14]/75 backdrop-blur-md`), sem empurrar a imagem para cima nem criar barra extra abaixo da Hero.
- **Botão CTA (`Explorar Catálogo`):** Mantido discreto no canto inferior direito (`bottom-3 right-3 sm:bottom-4 sm:right-4`) apenas quando `ctaLabel` estiver definido (ou oculto se o clique no próprio painel já levar ao catálogo, deixando a arte 100% limpa).

---

## 3. Arquivos que Serão Impactados na Implementação

1. [`components/home/HeroCarousel.tsx`](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/components/home/HeroCarousel.tsx):
   - Novo layout com corredores laterais para setas (`~2,5%` cada) e palco central ocupando ~95% da largura e altura útil `calc(100dvh - 5rem)` no desktop.
   - Aplicação do modo de preenchimento escolhido (`cover`, `contain + blur` ou híbrido por slide).
2. [`lib/validators/hero-slides.ts`](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/lib/validators/hero-slides.ts) e [`lib/hero/resolve-hero-slides.ts`](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/lib/hero/resolve-hero-slides.ts) *(se adotada a Opção C)*:
   - Inclusão de `imageFit: z.enum(["cover", "contain"]).default(...)` no schema `heroSlideSchema` e repasse em `ResolvedHeroSlide`.
3. [`components/admin/HeroSlidesManager.tsx`](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/components/admin/HeroSlidesManager.tsx) *(se adotada a Opção C)*:
   - Seletor `"Preencher 100% (Cover)"` vs `"Exibir Inteira sem Cortes (Contain)"` por painel.
4. [`app/loading.tsx`](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/app/loading.tsx):
   - Ajuste do Skeleton para acompanhar a largura de ~95% e altura útil (`calc(100dvh - 5rem)` no desktop), evitando salto visual (CLS).

---

## 4. Pontos para Sua Validação Antes de Codar

1. **Modo de preenchimento padrão para as 3 imagens atuais:** Você prefere **Opção A (`cover` — preenche 100% do quadro de 95% sem bordas, mesmo que corte um pouco topo/base em `4:3`/`3:2`)**, **Opção B (`contain` + fundo desfocado da própria arte — zero corte, mas com halo lateral nas imagens `4:3`/`3:2`)**, ou **Opção C (configurável por slide, com qual padrão nos 3 slides atuais)**?
2. **Botão `"Explorar Catálogo"` sobre a arte:** Deseja mantê-lo visível no canto inferior direito ou prefere o painel totalmente limpo (clicável para descer ao catálogo)?
