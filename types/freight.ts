export interface PackageDimensions {
  weightInGrams: number; // Peso total em gramas
  lengthCm: number;      // Comprimento em cm
  widthCm: number;       // Largura em cm
  heightCm: number;      // Altura em cm
}

export interface FreightCartItemInput {
  productId?: string;
  variantId?: string;
  name?: string;
  quantity: number;
  price?: number;
  weightInGrams?: number | null;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
}

export interface FreightQuoteRequest {
  lojaID: string;
  originCep: string;
  destinationCep: string;
  packages: PackageDimensions;
  cartTotal: number;
  itemsCount: number;
  items?: FreightCartItemInput[];
  storeSettings?: {
    additionalDays?: number;
    enableCorreios?: boolean;
    correiosContractCode?: string | null;
    correiosPassword?: string | null;
    enablePickup?: boolean;
    enableNoFreight?: boolean;
  };
}

export interface FreightOption {
  providerId: 'CORREIOS' | 'MELHOR_ENVIO' | 'LOCAL_TABLE' | 'STORE_PICKUP' | 'NONE' | string;
  serviceCode: string;        // '04014' (SEDEX), '04510' (PAC), 'PICKUP', 'NONE', etc.
  serviceName: string;        // 'SEDEX', 'PAC', 'Retirada na Loja', 'A Combinar via WhatsApp'
  price: number;              // Valor final do frete em R$
  originalPrice?: number;     // Valor original antes de descontos
  deliveryTimeInDays: number; // Prazo em dias úteis
  description?: string;       // Detalhes adicionais (ex: "Retirar no balcão da loja")
  isRecommended?: boolean;    // Badge de destaque (ex: melhor custo-benefício)
  carrier?: string;           // Nome da transportadora
}

export interface IFreightProvider {
  readonly id: string;
  readonly name: string;
  isAvailableForStore(lojaID: string, storeSettings?: any): Promise<boolean>;
  calculateQuotes(request: FreightQuoteRequest): Promise<FreightOption[]>;
}
