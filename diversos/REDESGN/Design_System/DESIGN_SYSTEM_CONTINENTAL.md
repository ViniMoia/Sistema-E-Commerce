# DESIGN SYSTEM CONTINENTAL — ESTÉTICA AUTOMOTIVA DE ALTA PRECISÃO
## Especificação Técnica Visual Canônica (Extraída da Homepage & Catálogo)
**Versão:** 1.0.0  
**Data de Publicação:** 24 de Setembro de 2026  
**Finalidade:** Guia autoritativo e imutável para o redesign dos módulos de Autenticação (Login/Registro), Dashboard Administrativo e Checkout (Finalização de Compra).  
**Regra de Ouro:** Não implementar código nos módulos até aprovação de layout; usar este documento como contrato de design estrito.

---

## 1. MANIFESTO E IDENTIDADE VISUAL

O Design System da **Continental Produtos Estéticos Automotivos** expressa **alta precisão, sofisticação técnica e luxo automotivo**. 

Inspirado no acabamento de estúdios automotivos de luxo (com veículos de alta performance como o Porsche sob iluminação controlada), o sistema visual abandona cinzas genéricos de templates corporativos e adota uma combinação rigorosa entre:
1. **Preto Profundo Neutro:** Superfícies em `#000000` e `#050505`, sem matizes azulados artificiais em backgrounds gerais.
2. **Azul Marinho Técnico / Dark Slate:** Elementos de card (`#0F172A`) e inputs de formulário (`#0B132B`/70) que criam profundidade e contraste tridimensional.
3. **Ouro Técnico Continental:** Dourados elegantes em `#F0B40E` (ouro vibrante/shimmer para chamadas de ação), `#DDAF02` (amarelo primário institucional) e `#B8A06A` (ouro fosco/acetinado para bordas técnicas, badges e tipografia mono).
4. **Acabamentos de Vidro & Metal:** Glassmorphism sutil (`backdrop-blur-xl`), bordas finas com transparência (`border-catalog-gold/45` ou `border-white/[0.04]`), micro-interações de luz deslizante (`btn-shimmer`, `nav-trace-link`).

---

## 2. PALETA DE CORES E TOKENS HEXADECIMAIS

### 2.1 Cores de Fundo e Superfícies (Backgrounds & Surfaces)

| Token Semântico | Hexadecimal | Opacidade / Classe Tailwind | Uso Obrigatório |
| :--- | :---: | :--- | :--- |
| `surface-canvas` | `#000000` | `bg-[#000000]` ou `bg-black` | Fundo principal da aplicação, Header e faixas de contraste absoluto. |
| `surface-base` | `#050505` | `bg-[#050505]` / `var(--secondary)` | Fundo contínuo de seções (Hero gradient e Catálogo). |
| `surface-card` | `#0F172A` | `bg-catalog-card` / `bg-[#0F172A]` | Fundo de cartões de produtos, painéis flutuantes, modais e containers de dados. |
| `surface-input` | `#0B132B` | `bg-[#0B132B]/70` | Fundo oficial de campos de entrada (inputs, textareas, selects). |
| `surface-control` | `#050B14` | `bg-[#050B14]/80` | Fundo de botões circulares de navegação, controles de carrossel e paginação. |
| `surface-product-stage` | `#FFFFFF` | `bg-white` (com `rounded-xl p-5`) | Base interna de destaque obrigatória para imagens de produtos e frascos. |
| `surface-tag-active` | `#0B111E` | `bg-[#0B111E]` | Fundo de pílulas ativas, tags selecionadas e badges consolidados. |

### 2.2 Cores da Família Dourado Continental (Gold & Accents)

| Token Semântico | Hexadecimal | Propósito Visual | Uso nos Componentes |
| :--- | :---: | :--- | :--- |
| `gold-brand-vibrant` | `#F0B40E` | Ouro quente automotivo (ação de alto impacto) | Gradiente de botões de conversão (`btn-shimmer`), glow primário. |
| `gold-primary` | `#DDAF02` | Ouro institucional Continental (`--primary`) | Identificadores de marca, realce de loja ativa, títulos selecionados. |
| `gold-catalog-matte`| `#B8A06A` | Ouro fosco acetinado e refinado | Bordas de cards, badges `PRODUTO`, títulos mono da sidebar, ícones de sacola. |
| `gold-highlight` | `#F5BD1E` | Ouro luminoso em hover | Borda e realce luminoso ao passar o mouse em botões e controles. |
| `gold-gradient-dark`| `#E5A805` | Ouro profundo para final de gradiente | Fim do gradiente em botões primários (`from-[#F0B40E] to-[#E5A805]`). |
| `navy-contrast-text`| `#010E31` | Azul marinho quase negro | Texto sobre botões dourados (`text-[#010E31]` para legibilidade AAA). |

### 2.3 Sistema de Transparência Dourada (Bordas e Halos Técnicos)

| Classe Tailwind | Efeito Visual | Aplicação Canônica |
| :--- | :--- | :--- |
| `border-catalog-gold/45` | Borda dourada 45% visível | Moldura padrão de cards de produto, badges mono e botões de ação secundária. |
| `border-catalog-gold/30` | Borda dourada 30% sutil | Divisores internos horizontais, borda de inputs inativos e tags desmarcadas. |
| `border-catalog-gold/15` | Borda dourada 15% ultra discreta | Divisores de seções (ex: `border-y border-catalog-gold/15` do carrossel). |
| `border-catalog-gold/70` | Borda dourada reforçada (hover) | Estado de hover em cards, inputs focados e itens ativos. |
| `bg-catalog-gold/10` | Fundo dourado 10% translúcido | Containers de resumo de filtros, caixas de aviso informativas. |
| `bg-catalog-gold/20` | Fundo dourado 20% selecionado | Estado ativo de opções de filtro, abas de seleção e botões marcados. |

### 2.4 Tipografia e Cores de Texto

| Token Semântico | Hexadecimal | Classe Tailwind | Aplicação |
| :--- | :---: | :--- | :--- |
| `text-pure` | `#FFFFFF` | `text-white` | Títulos principais H1/H2, valores em destaque, botões primários. |
| `text-catalog-main` | `#F5F5F5` | `text-catalog-text` | Nomes de produtos, títulos de cards, textos de leitura densa. |
| `text-body-subtle` | `#CBD5E1` | `text-slate-300` / `text-slate-300/90` | Parágrafos descritivos auxiliares, legendas do Hero. |
| `text-muted` | `#94A3B8` | `text-catalog-muted` | Descrições secundárias, labels secundários, contadores de itens. |
| `text-ghost` | `#64748B` | `text-gray-500` / `text-zinc-500` | Informações de apoio, contadores inativos, texto de desativação. |

### 2.5 Cores Funcionais de Estado (Status & Feedback)

* **WhatsApp Oficial:** `#25D366` / `#7BB04A` (Gradiente flutuante: `linear-gradient(135deg, #7BB04A, #005829)` e hover `linear-gradient(135deg, #25D366, #005829)`).
* **Sucesso / Confirmação:** `#10B981` (Verde esmeralda controlado).
* **Erro / Falha / Limpeza:** `#EF4444` / `#F87171` (Vermelho sutil, nunca saturado).
* **Aviso / Pendente:** `#F59E0B` (Âmbar/Laranja regulado).

---

## 3. TIPOGRAFIA E HIERARQUIA VISUAL

### 3.1 Famílias Tipográficas

```css
/* Definição Canônica em globals.css */
font-family: 'Urbanist', 'Roboto', 'Inter', sans-serif;
```
* **Display & Títulos:** `Urbanist` / `Inter` com pesos `font-bold` (700) e `font-semibold` (600).
* **Texto Corrido:** `Inter` com pesos `font-light` (300) e `font-normal` (400).
* **Técnico & Metadados (Identidade Automotiva):** `font-mono` (monoespaçada) para rótulos técnicos, códigos SKU, status, preços secundários e tags.

### 3.2 Escala de Títulos e Textos

| Nível | Classes Tailwind | Exemplo da Homepage | Comportamento Visual |
| :--- | :--- | :--- | :--- |
| **Hero H1** | `text-4xl sm:text-5xl md:text-6xl lg:text-[4rem] font-bold tracking-tight text-white leading-[1.08]` | "ESTÉTICA AUTOMOTIVA DE ALTA PRECISÃO" | Caixa alta, máscara de revelação (`text-reveal-wrapper`), gradiente sutil. |
| **H2 Seção** | `text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight text-white` | Títulos de categorias, cabeçalhos de tela | Letra capitalizada ou maiúscula, peso semi-bold. |
| **H3 Card** | `text-sm sm:text-base font-medium text-catalog-text leading-snug line-clamp-2 uppercase` | "ZMOL SHAMPOO DESINCRUSTANTE 500ML" | Caixa alta elegante, truncamento em 2 linhas, hover vira `text-white`. |
| **Preço Destaque**| `text-xl sm:text-2xl font-bold text-catalog-text tracking-tight` | "R$ 21.99" | Números nítidos, alta visibilidade sem cores chamativas. |
| **Tag / Badge** | `text-[10px] text-catalog-gold uppercase tracking-[0.2em] font-mono font-bold` | `PRODUTO`, `CATÁLOGO`, `MARCA` | Fonte monoespaçada, tracking expandido, borda fina dourada. |
| **Label Lateral** | `text-xs font-mono font-bold tracking-wider text-catalog-gold uppercase` | "POR PREÇO", "CATEGORIAS" | Divisores de blocos de filtros e formulários. |

---

## 4. SISTEMA DE COMPONENTES E PADRÕES DE INTERFACE

### 4.1 Card de Produto (Modelo da Grade 4 Colunas)

O card de produto é o coração da identidade visual do catálogo. Todo novo card de painel, item de pedido ou opção de checkout deve herdar esta anatomia:

```html
<!-- Estrutura Canônica do Card -->
<div class="bg-catalog-card border border-catalog-gold/45 rounded-2xl p-5 flex flex-col justify-between h-[480px] hover:border-catalog-gold/70 transition-all duration-300 cursor-pointer group shadow-sm">
  
  <!-- Estágio Branco para o Produto (Obrigatório) -->
  <div class="h-60 mb-5 p-5 bg-white rounded-xl flex items-center justify-center relative overflow-hidden transition-all duration-300">
    <img 
      src="[URL_IMAGEM]" 
      alt="[NOME]" 
      class="max-h-full object-contain group-hover:scale-[1.05] transition-transform duration-500" 
    />
  </div>

  <!-- Bloco de Conteúdo Inferior -->
  <div class="flex flex-col flex-1 justify-end relative">
    <!-- Tag Técnica Mono -->
    <span class="text-[10px] text-catalog-gold uppercase tracking-[0.2em] font-mono font-bold mb-3 border border-catalog-gold/45 bg-transparent inline-block w-min whitespace-nowrap px-2.5 py-1 rounded">
      Produto
    </span>

    <!-- Nome do Produto em Caixa Alta -->
    <h4 class="text-catalog-text font-medium text-sm sm:text-base leading-snug line-clamp-2 mb-4 group-hover:text-white transition-colors uppercase">
      Nome do Produto Automotivo
    </h4>

    <!-- Rodapé do Card: Preço e Botão de Ação -->
    <div class="flex items-center justify-between mt-auto pt-4 border-t border-catalog-gold/30">
      <span class="text-xl sm:text-2xl font-bold text-catalog-text tracking-tight">
        R$ 21,99
      </span>
      <button class="w-11 h-11 rounded-full border border-catalog-gold/45 bg-transparent hover:bg-catalog-gold/15 flex items-center justify-center text-catalog-gold transition-colors shadow-sm">
        <ShoppingBagIcon class="w-5 h-5 group-hover:scale-110 transition-transform" />
      </button>
    </div>
  </div>
</div>
```

### 4.2 Botões e Gatilhos de Ação (Buttons & CTAs)

#### A. Botão Primário Shimmer (High-Impact CTA)
Usado para ações primárias e de conversão máxima ("Explorar Catálogo", "Finalizar Compra", "Entrar na Conta", "Salvar Alterações"):
* **Classes:** `btn-shimmer px-7 py-3.5 rounded-full bg-gradient-to-r from-[#F0B40E] to-[#E5A805] hover:from-[#F5BD1E] hover:to-[#F0B40E] text-[#010E31] font-bold text-xs sm:text-sm tracking-widest uppercase shadow-[0_0_25px_rgba(240,180,14,0.4)] hover:shadow-[0_0_35px_rgba(240,180,14,0.6)] transition-all duration-300 hover:scale-[1.03] active:scale-[0.98] border border-[#F5BD1E]/40 cursor-pointer`
* **Efeito Óptico:** Feixe luminoso diagonal animado que varre o botão continuamente no hover (`.btn-shimmer::before`).

#### B. Botão Secundário Vidro (Glass / Ghost CTA)
Usado para ações complementares ("Conhecer a Linha", "Voltar", "Cancelar"):
* **Classes:** `px-6 py-3.5 rounded-full bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white font-medium text-xs sm:text-sm tracking-widest uppercase border border-white/10 hover:border-white/20 backdrop-blur-md transition-all duration-300 cursor-pointer`

#### C. Botão Circular de Ícone (Icon Control)
Usado em controles de carrossel, adicionar ao carrinho, paginação anterior/próxima:
* **Classes:** `w-11 h-11 rounded-full border border-catalog-gold/40 bg-[#050B14]/80 hover:bg-catalog-gold text-catalog-gold hover:text-black flex items-center justify-center transition-all duration-300 shadow-[0_4px_20px_rgba(0,0,0,0.8)] hover:scale-110 active:scale-95 focus:outline-none cursor-pointer`

#### D. Links de Navegação com Traço Deslizante (`.nav-trace-link`)
Usado no Header e barras de navegação superior para links textuais:
* **Classes:** `nav-trace-link text-xs sm:text-sm font-semibold uppercase tracking-[0.10em] text-white/90 hover:text-white`
* **Efeito:** Linha inferior de 2px branca com brilho que desliza da esquerda para a direita no hover e retrai pela direita na saída.

---

### 4.3 Formulários, Campos de Entrada e Filtros (Inputs & Form Controls)

#### A. Campo de Texto (Input Canônico)
Para inputs de login, registro, busca, endereço e cartão de crédito:
* **Estrutura:**
  ```html
  <div class="space-y-1.5">
    <label class="block text-xs font-mono font-bold tracking-wider text-catalog-gold uppercase">
      E-mail de Acesso
    </label>
    <div class="relative group">
      <input 
        type="email"
        placeholder="seu.email@exemplo.com"
        class="w-full bg-[#0B132B]/70 border border-catalog-gold/30 text-white placeholder-gray-400 text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-catalog-gold focus:ring-1 focus:ring-catalog-gold transition-all"
      />
    </div>
  </div>
  ```

#### B. Itens Selecionáveis (Radio / Checkbox / Filtro)
Para opções de frete, faixas de preço, categorias, métodos de pagamento (PIX/Cartão/Boleto):
* **Não selecionado:** `text-xs font-mono py-2 px-3 rounded-lg text-gray-300 hover:text-white hover:bg-white/5 border border-transparent transition-colors flex items-center justify-between cursor-pointer`
* **Selecionado:** `text-xs font-mono py-2 px-3 rounded-lg bg-catalog-gold/20 text-catalog-gold font-bold border border-catalog-gold/50 flex items-center justify-between shadow-[0_0_15px_rgba(240,180,14,0.15)]`

#### C. Tags / Pílulas de Resumo de Filtros
* **Classes:** `inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0B111E] border border-catalog-gold/60 text-catalog-gold text-[11px] font-mono tracking-wide`

---

## 5. GUIA DE APLICAÇÃO NOS MÓDULOS ALVO DO REDESIGN

### 5.1 MÓDULO 1: FORMULÁRIOS DE LOGIN E REGISTRO

#### Estado Atual (A Ser Substituído):
* Fundo acinzentado genérico (`bg-neutral-900/60`), bordas cinzas (`border-white/10`), labels cinzas, anéis de foco amarelos desbotados (`focus-visible:ring-[#dbb501]`).

#### Diretriz Canônica do Redesign:
1. **Container Principal (Modal / Card Central):**
   * Deve adotar a estética de card de catálogo: `bg-catalog-card` (`#0F172A`) com `border border-catalog-gold/45 rounded-[2rem] p-8 md:p-10 shadow-2xl backdrop-blur-2xl`.
   * Glow sutil de fundo: `radial-gradient(circle, rgba(240,180,14,0.08) 0%, transparent 70%)`.
2. **Identidade Visual no Topo do Formulário:**
   * Inclusão centralizada do símbolo hexagonal dourado `ContinentalLogo` no topo do formulário.
   * Tag superior técnica: `<span class="text-[10px] text-catalog-gold uppercase tracking-[0.25em] font-mono font-bold border border-catalog-gold/45 px-2.5 py-1 rounded mb-3 inline-block">Autenticação Segura</span>`.
   * Título H2: `text-2xl sm:text-3xl font-bold text-white tracking-tight uppercase`.
   * Subtítulo: `text-sm text-catalog-muted font-light mt-1`.
3. **Inputs de Formulário:**
   * Rótulos: `text-xs font-mono font-bold tracking-wider text-catalog-gold uppercase`.
   * Campos: `bg-[#0B132B]/70 border border-catalog-gold/30 text-white rounded-xl py-3 px-4 focus:border-catalog-gold`.
   * Link "Esqueceu a senha?": `text-xs font-mono text-catalog-gold hover:text-white underline transition-colors`.
4. **Botão de Ação:**
   * Substituir botão retangular genérico pelo botão pílula `btn-shimmer`:
   * `btn-shimmer w-full py-4 rounded-full bg-gradient-to-r from-[#F0B40E] to-[#E5A805] text-[#010E31] font-bold text-sm tracking-widest uppercase shadow-[0_0_25px_rgba(240,180,14,0.4)]`.
5. **Alternativa de Troca (Login ➔ Registro / Registro ➔ Login):**
   * Texto discreto: `text-xs font-mono text-catalog-muted`, com link dourado: `text-catalog-gold font-bold hover:underline`.

---

### 5.2 MÓDULO 2: DASHBOARD DO ADMINISTRADOR

#### Estado Atual (A Ser Substituído):
* Elementos usando cores estranhas ao branding automotivo (roxo `purple-500`, verde fluorescente `emerald-500`, cinzas genéricos `zinc-400`).

#### Diretriz Canônica do Redesign:
1. **Cards de Indicadores & KPIs:**
   * Container dos KPIs: `bg-catalog-card` (`#0F172A`) com `border border-catalog-gold/30 rounded-2xl p-6 hover:border-catalog-gold/60 transition-all shadow-sm`.
   * Eliminar ícones roxos/azuis não autorizados. Todos os ícones principais de métricas operacionais passam a utilizar fundos `bg-catalog-gold/10 border border-catalog-gold/25 text-catalog-gold`.
   * Rótulos de métrica: `text-[10px] font-mono uppercase tracking-[0.2em] text-catalog-gold`.
   * Valor do KPI: `text-2xl sm:text-3xl font-bold font-mono text-white tracking-tight`.
   * Indicador percentual/variação: Tag em pílula `bg-[#0B111E] border border-catalog-gold/40 text-catalog-gold text-[10px] font-mono`.
2. **Tabela de Pedidos Recentes:**
   * Cabeçalho da tabela: Fundo `#050B14`, texto `text-[11px] font-mono font-bold uppercase tracking-wider text-catalog-gold border-b border-catalog-gold/30`.
   * Linhas da tabela: Fundo alternado sutil ou `hover:bg-white/[0.02]`, bordas inferiores `border-b border-catalog-gold/15`.
   * Badges de Status do Pedido:
     * `CONFIRMED` / `PAID`: `bg-emerald-950/60 border border-emerald-500/50 text-emerald-400 font-mono text-[10px] uppercase px-2.5 py-0.5 rounded-full`.
     * `PENDING`: `bg-catalog-gold/15 border border-catalog-gold/50 text-catalog-gold font-mono text-[10px] uppercase px-2.5 py-0.5 rounded-full`.
     * `CANCELLED`: `bg-red-950/60 border border-red-500/50 text-red-400 font-mono text-[10px] uppercase px-2.5 py-0.5 rounded-full`.
3. **Navegação Lateral / Topo Administrativo:**
   * Borda inferior de separação: `border-b border-white/[0.04]`.
   * Links ativos no menu: Realce dourado com `text-brand-yellow font-bold` e traço deslizante `nav-trace-link`.

---

### 5.3 MÓDULO 3: CHECKOUT E FINALIZAÇÃO DE COMPRA

#### Estado Atual (A Ser Substituído):
* Fundo escuro com caixas cinzas sem identidade, abas de pagamento sem o halo dourado, botões sem a pílula shimmer.

#### Diretriz Canônica do Redesign:
1. **Layout do Checkout (2 Colunas):**
   * Coluna Esquerda: Dados de Entrega, Frete e Meio de Pagamento.
   * Coluna Direita (Sticky): Resumo do Pedido, Itens e Totalizador Financeiro.
2. **Seleção de Método de Pagamento (PIX, Cartão de Crédito, Boleto):**
   * Grid de 3 abas estilizadas como cartões seletores:
     * Aba inativa: `bg-[#0B132B]/50 border border-catalog-gold/20 text-catalog-muted hover:border-catalog-gold/50 hover:text-white rounded-xl p-4 flex flex-col items-center gap-2 transition-all`.
     * Aba ativa: `bg-catalog-gold/20 border-2 border-catalog-gold text-white rounded-xl p-4 flex flex-col items-center gap-2 shadow-[0_0_20px_rgba(240,180,14,0.25)]`.
     * Ícones de pagamento (PIX / Cartão / Boleto): Sempre em cor dourada `text-catalog-gold`.
3. **Área do QR Code PIX (Tela de Sucesso / Pagamento):**
   * Container do QR Code: Caixa branca pura com cantos arredondados (`bg-white rounded-2xl p-6 shadow-2xl border-4 border-catalog-gold`), semelhante ao palco das fotos de produtos.
   * Campo "Copia e Cola": Input `#0B132B` com borda dourada, botão de cópia estilo pílula `btn-shimmer` compacto.
4. **Calculadora e Opções de Frete (J&T Express / SEDEX / PAC):**
   * Cartões de frete com estética de slot técnico:
     * Borda `border-catalog-gold/30`, fundo `#0B132B`/60.
     * Quando selecionado: borda dourada acesa `border-catalog-gold` e texto em destaque.
     * Prazo em fonte mono: `text-xs font-mono text-catalog-muted`.
     * Valor em destaque: `text-sm font-bold text-catalog-text`.
5. **Card de Resumo do Pedido (Totalizador):**
   * Container: `bg-catalog-card` (`#0F172A`) com moldura `border border-catalog-gold/45 rounded-2xl p-6`.
   * Itens listados com thumbnails com fundo branco: `w-14 h-14 bg-white rounded-lg p-1 object-contain`.
   * Linhas contábeis (Subtotal, Frete, Desconto Fidelidade): separadas por `border-b border-catalog-gold/20 pb-3`.
   * Total Geral: `text-2xl sm:text-3xl font-bold text-white font-mono` com destaque dourado.
   * Botão de Finalização: `btn-shimmer w-full py-4 rounded-full bg-gradient-to-r from-[#F0B40E] to-[#E5A805] text-[#010E31] font-bold text-sm tracking-widest uppercase shadow-[0_0_25px_rgba(240,180,14,0.4)]`.

---

## 6. TABELA CONSOLIDADA DE CLASSES CSS & UTILITÁRIOS

Para garantir consistência absoluta na futura implementação, todos os desenvolvedores devem consultar esta tabela antes de escrever qualquer classe:

| Elemento de UI | Classes Tailwind Obrigatórias |
| :--- | :--- |
| **Fundo de Página** | `min-h-screen bg-catalog-bg text-catalog-text selection:bg-catalog-gold/30` |
| **Header Fixo** | `w-full bg-[#000000] border-b border-white/[0.04]` |
| **Card Contêiner** | `bg-catalog-card border border-catalog-gold/45 rounded-2xl p-5 hover:border-catalog-gold/70 transition-all` |
| **Palco de Imagem** | `bg-white rounded-xl p-5 flex items-center justify-center relative overflow-hidden` |
| **Badge / Tag Mono** | `text-[10px] text-catalog-gold uppercase tracking-[0.2em] font-mono font-bold border border-catalog-gold/45 bg-transparent px-2.5 py-1 rounded` |
| **Título do Produto**| `text-catalog-text font-medium text-sm leading-snug uppercase group-hover:text-white transition-colors` |
| **Preço Destaque** | `text-xl sm:text-2xl font-bold text-catalog-text tracking-tight font-mono` |
| **Botão Shimmer** | `btn-shimmer px-7 py-3.5 rounded-full bg-gradient-to-r from-[#F0B40E] to-[#E5A805] text-[#010E31] font-bold tracking-widest uppercase border border-[#F5BD1E]/40` |
| **Botão Vidro** | `px-6 py-3.5 rounded-full bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white font-medium border border-white/10 backdrop-blur-md` |
| **Botão Ícone** | `w-11 h-11 rounded-full border border-catalog-gold/45 bg-transparent hover:bg-catalog-gold/15 text-catalog-gold flex items-center justify-center` |
| **Input de Texto** | `w-full bg-[#0B132B]/70 border border-catalog-gold/30 text-white placeholder-gray-400 text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-catalog-gold` |
| **Label Técnico** | `text-xs font-mono font-bold tracking-wider text-catalog-gold uppercase` |
| **Divisor Sutil** | `border-t border-catalog-gold/30` ou `border-b border-catalog-gold/20` |

---

## 7. CHECKLIST DE CONFORMIDADE PARA O FUTURO REDESIGN

Antes de considerar qualquer tela redesenhada como aprovada, verificar rigorosamente:

- [ ] **Ausência de Cinzas Genéricos:** O fundo é `#000000` ou `#050505` e os cards usam `#0F172A`?
- [ ] **Ausência de Cores Alheias:** Roxo, azul elétrico ou amarelo queimado desbotado foram totalmente eliminados?
- [ ] **Ouro Continental Corretamente Aplicado:** Bordas usam `border-catalog-gold/45` ou `/30` e CTAs usam o gradiente `#F0B40E` ➔ `#E5A805`?
- [ ] **Palco Branco para Produtos:** As fotos dos produtos continuam com o quadrado/palco branco interno com cantos arredondados?
- [ ] **Tipografia Mono nos Metadados:** Preços secundários, tags, status e labels de formulário usam `font-mono uppercase`?
- [ ] **Botões em Formato Pílula:** Todos os botões principais de ação utilizam `rounded-full`?
- [ ] **Micro-interações:** O efeito shimmer (`btn-shimmer`) está presente nos botões de conversão e o traço deslizante (`nav-trace-link`) nos links?
