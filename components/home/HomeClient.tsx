"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useCartStore } from "@/store/cart.store";
import { useCart } from "@/components/providers/CartProvider";
import { getOptimizedImageUrl, formatProductTitle } from "@/lib/utils";
import HeroVideo from "./HeroVideo";
import { BrandMinimalistCarousel } from "@/components/catalog/BrandMinimalistCarousel";
import { CatalogFreeSidebar } from "@/components/catalog/CatalogFreeSidebar";
import { BrandSummary } from "@/components/catalog/BrandHoverFlyout";
import { useProductFilters, FilterableProduct } from "@/hooks/useProductFilters";
import { ProductFreightCalculator } from "@/components/catalog/ProductFreightCalculator";
import { CatalogPagination } from "@/components/catalog/CatalogPagination";
import { ArrowLeft } from "lucide-react";

export type Product = FilterableProduct;

interface LojaInfo {
  name: string;
  description: string;
  coverImageUrl?: string;
  whatsappNumber?: string | null;
}

// SVG Icons
const Icons = {
  ArrowLeft: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6"></polyline>
    </svg>
  ),
  ShoppingBag: ({ className = "" }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
      <line x1="3" y1="6" x2="21" y2="6"></line>
      <path d="M16 10a4 4 0 0 1-8 0"></path>
    </svg>
  )
};

export default function HomeClient({
  initialProducts,
  initialBrands = [],
  lojaInfo
}: {
  initialProducts: Product[];
  initialBrands?: BrandSummary[];
  lojaInfo: LojaInfo | null;
}) {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [activeImage, setActiveImage] = useState<string | null>(null);
  const { addToCart, isLoading: isAddingToCart } = useCartStore();
  const { setIsOpen } = useCart();

  // Hook desacoplado de filtragem, contagem de marcas e paginação (SOLID / SRP)
  const {
    searchQuery,
    setSearchQuery,
    selectedBrand,
    setSelectedBrand,
    selectedTags,
    handleToggleTag,
    selectedPriceRange,
    setSelectedPriceRange,
    handleClearAllFilters,
    brandsWithCounts,
    filteredProducts,
    paginatedProducts,
    currentPage,
    setCurrentPage,
    totalPages,
    pageSize,
    startIndex,
    endIndex,
    totalCount,
    filteredCount,
  } = useProductFilters({
    initialProducts,
    initialBrands,
  });

  const catalogSectionRef = useRef<HTMLElement | null>(null);

  // Transição de página com scroll suave de volta ao topo do catálogo
  const handlePageChange = useCallback((newPage: number) => {
    setCurrentPage(newPage);
    if (catalogSectionRef.current) {
      catalogSectionRef.current.scrollIntoView({ behavior: "smooth" });
    } else {
      const el = document.getElementById("catalogo");
      el?.scrollIntoView({ behavior: "smooth" });
    }
  }, [setCurrentPage]);

  // Sync active image when product opens
  useEffect(() => {
    if (selectedProduct) {
      setActiveImage(selectedProduct.imageUrl);
    } else {
      setActiveImage(null);
    }
  }, [selectedProduct]);

  // Sync selected variant based on size and color (ou seleciona a variante padrão automaticamente)
  useEffect(() => {
    if (!selectedProduct) {
      setSelectedVariantId(null);
      return;
    }

    const variants = selectedProduct.productVariants || [];
    const hasRealVariants =
      variants.length > 1 &&
      variants.some((v) => v.size !== "Único" || v.color !== "Padrão");

    if (!hasRealVariants) {
      setSelectedVariantId(variants[0]?.id || null);
      return;
    }

    if (selectedSize && selectedColor) {
      const variant = variants.find(
        (v) => v.size === selectedSize && v.color === selectedColor
      );
      if (variant && variant.stock > 0) {
        setSelectedVariantId(variant.id);
      } else {
        setSelectedVariantId(null);
      }
    } else {
      setSelectedVariantId(null);
    }
  }, [selectedSize, selectedColor, selectedProduct]);

  // Flashlight Effect Tracking
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    e.currentTarget.style.setProperty('--mouse-x', `${x}px`);
    e.currentTarget.style.setProperty('--mouse-y', `${y}px`);
  };

  const handleBuy = async (e: React.MouseEvent, product?: Product) => {
    e.stopPropagation();
    const prod = product || selectedProduct;
    if (!prod) return;

    const variants = prod.productVariants || [];
    const hasRealVariants =
      variants.length > 1 &&
      variants.some((v) => v.size !== "Único" || v.color !== "Padrão");

    if (hasRealVariants && !selectedVariantId) {
      if (!selectedProduct) {
        setSelectedProduct(prod);
        return;
      }
      alert("Por favor, selecione um tamanho e uma cor válidos antes de prosseguir.");
      return;
    }

    const variantIdToUse = selectedVariantId || variants[0]?.id || null;

    try {
      await addToCart(variantIdToUse, prod.id, 1);
      setIsOpen(true);
    } catch (error) {
      console.error(error);
    }
  };

  // --- PRODUCT DETAILED VIEW ---
  if (selectedProduct) {
    return (
      <div className="min-h-screen bg-catalog-bg text-catalog-text px-6 pt-24 pb-6 md:px-12 md:pt-28 md:pb-12 fade-in selection:bg-catalog-gold/30">
        <div className="max-w-7xl mx-auto">

          {/* Navigation */}
          <button 
            onClick={() => {
              setSelectedProduct(null);
              setSelectedVariantId(null);
              setSelectedSize(null);
              setSelectedColor(null);
            }}
            className="inline-flex items-center text-catalog-muted hover:text-white transition-colors group w-fit cursor-pointer mb-8 md:mb-12"
          >
            <span className="group-hover:-translate-x-1 transition-transform duration-300">
              <ArrowLeft className="w-4 h-4 text-catalog-gold" />
            </span>
            <span className="ml-2 tracking-widest uppercase text-xs font-bold font-mono whitespace-nowrap">
              Voltar às compras
            </span>
          </button>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 lg:gap-20 items-center">
            {/* Image & Gallery Column */}
            <div className="flex flex-col gap-4 animate-in" style={{ animationDelay: '0.1s' }}>
              {/* Main Image Container */}
              <div className="bg-catalog-card border border-catalog-gold/45 p-8 md:p-12 rounded-[2rem] flex justify-center shadow-xl relative overflow-hidden">
                <img 
                  src={getOptimizedImageUrl(activeImage || selectedProduct.imageUrl, 800, 800)} 
                  alt={selectedProduct.name}
                  className="max-h-[50vh] md:max-h-[60vh] object-contain bg-white rounded-2xl p-6 transition-opacity duration-300"
                />
              </div>

              {/* Gallery Thumbnails */}
              {selectedProduct.galleryUrls && selectedProduct.galleryUrls.length > 0 && (
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                  <button
                    onClick={() => setActiveImage(selectedProduct.imageUrl)}
                    className={`shrink-0 rounded-xl overflow-hidden border-2 transition-all ${
                      (activeImage || selectedProduct.imageUrl) === selectedProduct.imageUrl 
                        ? 'border-catalog-gold opacity-100 scale-100 shadow-md' 
                        : 'border-catalog-gold/30 opacity-60 hover:opacity-100 scale-95'
                    }`}
                  >
                    <img 
                      src={getOptimizedImageUrl(selectedProduct.imageUrl, 100, 100)} 
                      alt="Principal"
                      className="w-20 h-20 object-cover bg-white"
                    />
                  </button>
                  {selectedProduct.galleryUrls.map((url, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveImage(url)}
                      className={`shrink-0 rounded-xl overflow-hidden border-2 transition-all ${
                        activeImage === url 
                          ? 'border-catalog-gold opacity-100 scale-100 shadow-md' 
                          : 'border-catalog-gold/30 opacity-60 hover:opacity-100 scale-95'
                      }`}
                    >
                      <img 
                        src={getOptimizedImageUrl(url, 100, 100)} 
                        alt={`Galeria ${idx + 1}`}
                        className="w-20 h-20 object-cover bg-white"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            {/* Product Info */}
            <div className="space-y-6 md:space-y-8 animate-in min-w-0 w-full" style={{ animationDelay: '0.2s' }}>
              <div className="min-w-0 w-full">
                <span className="text-catalog-gold bg-transparent px-3 py-1 rounded border border-catalog-gold/45 uppercase tracking-[0.2em] text-xs font-mono font-bold inline-block mb-4 md:mb-6">
                  Catálogo
                </span>
                <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight text-catalog-text leading-tight break-words [overflow-wrap:anywhere]">
                  {formatProductTitle(selectedProduct.name)}
                </h1>
              </div>
              
              <p className="text-catalog-muted text-base md:text-lg leading-relaxed font-light">
                {selectedProduct.description}
              </p>
              
              {/* Product Variants Selector (apenas se houver variantes com tamanhos/cores reais) */}
              {selectedProduct.productVariants && selectedProduct.productVariants.length > 0 && (() => {
                const sizes = Array.from(new Set(selectedProduct.productVariants!.map(v => v.size))).filter(s => s !== "Único");
                const colors = Array.from(new Set(selectedProduct.productVariants!.map(v => v.color))).filter(c => c !== "Padrão");

                if (sizes.length === 0 && colors.length === 0) {
                  return null;
                }

                return (
                  <div className="pt-2 pb-2 space-y-6">
                    {sizes.length > 0 && (
                      <div>
                        <h3 className="text-sm font-bold text-catalog-muted uppercase tracking-widest mb-3">Selecione o Tamanho</h3>
                        <div className="flex flex-wrap gap-3">
                          {sizes.map(size => {
                            const isAvailable = selectedProduct.productVariants!.some(v => v.size === size && v.stock > 0);
                            return (
                              <button
                                key={size}
                                onClick={() => setSelectedSize(size)}
                                disabled={!isAvailable}
                                className={`px-5 py-2 rounded-full border text-sm font-medium transition-all ${
                                  selectedSize === size 
                                    ? 'border-catalog-gold bg-catalog-gold/20 text-catalog-text' 
                                    : !isAvailable
                                      ? 'border-neutral-900 bg-neutral-950 text-neutral-600 cursor-not-allowed opacity-50'
                                      : 'border-catalog-gold/30 bg-transparent text-catalog-muted hover:border-catalog-gold/60 hover:text-catalog-text'
                                }`}
                              >
                                {size}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {colors.length > 0 && (
                      <div>
                        <h3 className="text-sm font-bold text-catalog-muted uppercase tracking-widest mb-3">Selecione a Cor</h3>
                        <div className="flex flex-wrap gap-3">
                          {colors.map(color => {
                            const isAvailable = selectedSize 
                              ? selectedProduct.productVariants!.some(v => v.size === selectedSize && v.color === color && v.stock > 0)
                              : selectedProduct.productVariants!.some(v => v.color === color && v.stock > 0);
                              
                            return (
                              <button
                                key={color}
                                onClick={() => setSelectedColor(color)}
                                disabled={!isAvailable}
                                className={`px-5 py-2 rounded-full border text-sm font-medium transition-all ${
                                  selectedColor === color 
                                    ? 'border-catalog-gold bg-catalog-gold/20 text-catalog-text' 
                                    : !isAvailable
                                      ? 'border-neutral-900 bg-neutral-950 text-neutral-600 cursor-not-allowed opacity-50'
                                      : 'border-catalog-gold/30 bg-transparent text-catalog-muted hover:border-catalog-gold/60 hover:text-catalog-text'
                                }`}
                              >
                                {color}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              <div className="pt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-catalog-gold/30 pb-8">
                <span className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-catalog-text drop-shadow-md whitespace-nowrap">
                  R$ {selectedProduct.price.toFixed(2)}
                </span>
                <div className="flex items-center gap-2 text-catalog-gold">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                  <span className="font-bold text-lg">5.0 <span className="text-catalog-muted font-normal text-sm">(Novo)</span></span>
                </div>
              </div>

              <div className="pt-4">
                <button 
                  onClick={handleBuy} 
                  className="btn-shimmer px-8 py-4 rounded-full bg-catalog-gold text-[#0F172A] font-bold text-sm tracking-widest uppercase hover:opacity-90 transition-all flex items-center justify-center gap-3 w-full sm:w-auto shadow-md cursor-pointer"
                  aria-label="Comprar Agora"
                >
                  <Icons.ShoppingBag className="w-5 h-5" />
                  <span>{isAddingToCart ? 'Adicionando...' : 'Finalizar Compra'}</span>
                </button>
              </div>

              {/* Calculadora de Frete no Perfil do Produto (100% Deslogado) */}
              <div className="pt-2">
                <ProductFreightCalculator
                  productId={selectedProduct.id}
                  price={selectedProduct.price}
                  lojaID={selectedProduct.lojaID}
                />
              </div>
            </div>
          </div>

        </div>
      </div>
    );
  }

  // --- HOMEPAGE VIEW ---

  return (
    <div className="min-h-screen bg-catalog-bg text-catalog-text overflow-x-hidden selection:bg-catalog-gold/30 fade-in">
      
      {/* Hero Video Section with GSAP */}
      <HeroVideo />

      {/* Product List Showcase */}
      <section id="catalogo" ref={catalogSectionRef} className="py-10 md:py-16 bg-catalog-bg relative z-20">
        {/* Carrossel Minimalista de Marcas Soltas no Topo (5 Marcas Simultâneas) */}
        <BrandMinimalistCarousel
          brands={brandsWithCounts}
          selectedBrand={selectedBrand}
          onSelectBrand={setSelectedBrand}
        />

        {/* Container Amplo: Sidebar Livre + Grid com Rigorosamente 4 Cards por Linha Horizontal */}
        <div className="max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-10 mt-8 md:mt-12">
          <div className="flex flex-col lg:flex-row gap-8 xl:gap-12 items-start">
            {/* Filtros Livres e Barra de Pesquisa na Lateral Esquerda */}
            <CatalogFreeSidebar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              selectedBrand={selectedBrand}
              onSelectBrand={setSelectedBrand}
              selectedTags={selectedTags}
              onToggleTag={handleToggleTag}
              selectedPriceRange={selectedPriceRange}
              onSelectPriceRange={setSelectedPriceRange}
              onClearAll={handleClearAllFilters}
              brands={brandsWithCounts}
              totalProductsCount={totalCount}
              filteredProductsCount={filteredCount}
            />

            {/* Grid de Produtos: 4 Colunas Horizontais no Desktop sem Apertar os Cards (12 por Página) */}
            <div className="flex-1 w-full min-w-0">
              {filteredProducts.length > 0 ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 gap-6 md:gap-7">
                    {paginatedProducts.map((prod, index) => (
                      <div 
                        key={prod.id}  
                        onClick={() => setSelectedProduct(prod)}
                        className="bg-catalog-card border border-catalog-gold/45 rounded-2xl p-5 flex flex-col justify-between h-[480px] hover:border-catalog-gold/70 transition-all duration-300 cursor-pointer group animate-in shadow-sm"
                        style={{ animationDelay: `${(index % 8) * 0.05}s` }}
                      >
                        <div className="h-60 mb-5 p-5 bg-white rounded-xl flex items-center justify-center relative overflow-hidden transition-all duration-300">
                          <img 
                            src={getOptimizedImageUrl(prod.imageUrl, 400, 400)} 
                            alt={prod.name} 
                            className="max-h-full object-contain group-hover:scale-[1.05] transition-transform duration-500" 
                          />
                        </div>
                        
                        <div className="flex flex-col flex-1 justify-end relative">
                          <span className="text-[10px] text-catalog-gold uppercase tracking-[0.2em] font-mono font-bold mb-3 border border-catalog-gold/45 bg-transparent inline-block w-min whitespace-nowrap px-2.5 py-1 rounded">
                            Produto
                          </span>
                          <h4 className="text-catalog-text font-medium text-sm sm:text-base leading-snug line-clamp-2 mb-4 group-hover:text-white transition-colors uppercase break-words [overflow-wrap:anywhere]">
                            {formatProductTitle(prod.name)}
                          </h4>
                          
                          <div className="flex items-center justify-between mt-auto pt-4 border-t border-catalog-gold/30">
                            <span className="text-xl sm:text-2xl font-bold text-catalog-text tracking-tight">R$ {prod.price.toFixed(2)}</span>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleBuy(e, prod);
                              }}
                              className="w-11 h-11 rounded-full border border-catalog-gold/45 bg-transparent hover:bg-catalog-gold/15 flex items-center justify-center text-catalog-gold transition-colors shadow-sm"
                              title="Adicionar ao Carrinho"
                            >
                              <Icons.ShoppingBag className="w-5 h-5 group-hover:scale-110 transition-transform" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Componente Visual de Paginação Dark & Gold */}
                  <CatalogPagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={filteredCount}
                    pageSize={pageSize}
                    startIndex={startIndex}
                    endIndex={endIndex}
                    onPageChange={handlePageChange}
                    className="mt-10 md:mt-14"
                  />
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 px-6 text-center animate-in fade-in zoom-in duration-500 bg-[#0B111E]/30 border border-catalog-gold/20 rounded-2xl">
                  <div className="w-20 h-20 mb-5 rounded-full bg-catalog-card flex items-center justify-center border border-catalog-gold/30 shadow-inner">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-catalog-muted">
                      <circle cx="11" cy="11" r="8"></circle>
                      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                  </div>
                  <h4 className="text-xl font-semibold text-catalog-text mb-2">Nenhum produto encontrado</h4>
                  <p className="text-catalog-muted max-w-md mx-auto leading-relaxed text-sm">
                    Não encontramos nenhum produto que corresponda aos filtros ou termos pesquisados.
                    Tente selecionar outra marca, remover algumas etiquetas ou faixas de preço.
                  </p>
                  <button 
                    onClick={handleClearAllFilters}
                    className="mt-6 px-7 py-2.5 rounded-full border border-catalog-gold/45 text-catalog-text hover:bg-catalog-gold/10 hover:border-catalog-gold transition-all shadow-sm text-sm font-mono"
                  >
                    Limpar Todos os Filtros
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Visual Footer */}
      <footer className="border-t border-catalog-gold/20 py-12 bg-catalog-bg relative overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-catalog-gold/40 to-transparent" />
        <div className="max-w-7xl mx-auto px-6 md:px-12 flex flex-col md:flex-row items-center justify-between">
          <div className="flex items-center gap-3 mb-6 md:mb-0">
             <span className="w-2.5 h-2.5 bg-catalog-gold rounded-full"></span>
              <span className="text-catalog-text font-bold tracking-widest uppercase text-sm">{lojaInfo?.name || "E-Commerce"}</span>
          </div>
          <p className="text-catalog-muted font-mono text-xs uppercase tracking-wider">
            © 2026. Vancer.
          </p>
        </div>
      </footer>
    </div>
  );
}
