# GUIA RÁPIDO DE TOKENS E CLASSES — DESIGN SYSTEM CONTINENTAL
## Folha de Cola Rápida (Cheat Sheet) para Redesign

Este arquivo serve como consulta ágil durante o desenvolvimento das telas de **Login**, **Registro**, **Dashboard Admin** e **Checkout**.

---

### 🎨 1. Cores Hexadecimais Essenciais

| Uso | Hex | Tailwind |
| :--- | :--- | :--- |
| **Fundo de Tela** | `#000000` / `#050505` | `bg-[#000000]` ou `bg-catalog-bg` |
| **Fundo de Card / Painel** | `#0F172A` | `bg-catalog-card` / `bg-[#0F172A]` |
| **Fundo de Input** | `#0B132B` | `bg-[#0B132B]/70` |
| **Fundo de Controle Circular**| `#050B14` | `bg-[#050B14]/80` |
| **Ouro Primário (Ação)** | `#F0B40E` | `from-[#F0B40E] to-[#E5A805]` |
| **Ouro de Borda / Badge** | `#B8A06A` | `text-catalog-gold`, `border-catalog-gold/45` |
| **Texto de Botão Ouro** | `#010E31` | `text-[#010E31]` |
| **Texto Principal** | `#FFFFFF` / `#F5F5F5`| `text-white` / `text-catalog-text` |
| **Texto Muted / Secundário** | `#94A3B8` | `text-catalog-muted` |

---

### 🧱 2. Snippets dos Componentes-Chave

#### A. Card Padrão (Login, Checkout, Admin Widget)
```html
<div class="bg-catalog-card border border-catalog-gold/45 rounded-2xl p-6 shadow-xl">
  <!-- Conteúdo -->
</div>
```

#### B. Campo de Formulário (Input)
```html
<div class="space-y-1.5">
  <label class="block text-xs font-mono font-bold tracking-wider text-catalog-gold uppercase">
    Nome do Campo
  </label>
  <input 
    type="text" 
    class="w-full bg-[#0B132B]/70 border border-catalog-gold/30 text-white placeholder-gray-400 text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-catalog-gold focus:ring-1 focus:ring-catalog-gold transition-all"
    placeholder="Digite aqui..."
  />
</div>
```

#### C. Botão Primário Shimmer (Pílula Dourada)
```html
<button class="btn-shimmer w-full py-4 rounded-full bg-gradient-to-r from-[#F0B40E] to-[#E5A805] hover:from-[#F5BD1E] hover:to-[#F0B40E] text-[#010E31] font-bold text-xs sm:text-sm tracking-widest uppercase shadow-[0_0_25px_rgba(240,180,14,0.4)] transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] border border-[#F5BD1E]/40 cursor-pointer">
  Finalizar / Entrar / Confirmar
</button>
```

#### D. Botão Secundário (Vidro / Ghost)
```html
<button class="px-6 py-3 rounded-full bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white font-medium text-xs tracking-widest uppercase border border-white/10 hover:border-white/20 backdrop-blur-md transition-all cursor-pointer">
  Voltar / Cancelar
</button>
```

#### E. Badge / Tag Técnica Mono
```html
<span class="text-[10px] text-catalog-gold uppercase tracking-[0.2em] font-mono font-bold border border-catalog-gold/45 bg-transparent inline-block whitespace-nowrap px-2.5 py-1 rounded">
  Tag ou Status
</span>
```

#### F. Item Selecionável (Opção de Frete, Pagamento, Filtro)
```html
<!-- Inativo -->
<div class="text-xs font-mono py-2 px-3 rounded-lg text-gray-300 hover:text-white hover:bg-white/5 border border-transparent transition-colors flex items-center justify-between cursor-pointer">
  <span>Opção</span>
</div>

<!-- Ativo -->
<div class="text-xs font-mono py-2 px-3 rounded-lg bg-catalog-gold/20 text-catalog-gold font-bold border border-catalog-gold/50 flex items-center justify-between shadow-[0_0_15px_rgba(240,180,14,0.15)]">
  <span>Opção Selecionada</span>
  <span class="text-catalog-gold">✓</span>
</div>
```

#### G. Palco Branco para Fotos de Produtos (Grade e Checkout)
```html
<div class="bg-white rounded-xl p-4 flex items-center justify-center relative overflow-hidden">
  <img src="[URL]" alt="[PRODUTO]" class="max-h-full object-contain" />
</div>
```
