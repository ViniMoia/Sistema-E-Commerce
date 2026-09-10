import prisma from '@/lib/prisma';
import { tenantCache } from '@/lib/cache';
import { FreightCartItemInput, FreightOption, FreightQuoteRequest, IFreightProvider } from '@/types/freight';
import { PackagePackingService } from './packing.service';
import { CorreiosProvider } from './providers/correios.provider';
import { CustomTableProvider } from './providers/custom-table.provider';
import { PickupProvider } from './providers/pickup.provider';
import { NoneOptionProvider } from './providers/none.provider';
import { JtExpressProvider } from './providers/jt-express.provider';

export interface CalculateFreightParams {
  lojaID: string;
  destinationCep: string;
  items: FreightCartItemInput[];
}

export class FreightOrchestratorService {
  private providers: IFreightProvider[];

  constructor() {
    // Registro de todos os provedores suportados pela plataforma
    this.providers = [
      new JtExpressProvider(),
      new CorreiosProvider(),
      new CustomTableProvider(),
      new PickupProvider(),
      new NoneOptionProvider(),
    ];
  }

  /**
   * Executa a cotação consolidada de frete para o cliente com cache particionado por loja.
   */
  public async calculate(params: CalculateFreightParams): Promise<{
    options: FreightOption[];
    packageDetails: { weightInGrams: number; dimensions: string };
  }> {
    const cleanDestCep = params.destinationCep.replace(/\D/g, '');
    if (!cleanDestCep || cleanDestCep.length !== 8) {
      throw new Error('CEP de destino inválido. O CEP deve conter 8 dígitos.');
    }

    if (!params.lojaID) {
      throw new Error('Identificador da loja (lojaID) é obrigatório.');
    }

    // 1. Buscar configurações da loja
    const loja = await prisma.loja.findUnique({
      where: { id: params.lojaID },
      select: {
        id: true,
        originCep: true,
        enableCorreios: true,
        correiosContractCode: true,
        correiosPassword: true,
        enablePickup: true,
        enableNoFreight: true,
        additionalDays: true,
      },
    });

    if (!loja) {
      throw new Error('Loja não encontrada.');
    }

    // 2. Calcular cubagem do pacote
    const packages = PackagePackingService.calculateCartPackage(params.items);
    const cartTotal = params.items.reduce((acc, item) => acc + (item.price || 0) * (item.quantity || 1), 0);
    const itemsCount = params.items.reduce((acc, item) => acc + (item.quantity || 1), 0);

    // 3. Cache identifier: versão + destino + peso + volume
    const cacheKey = `v2_${cleanDestCep}_w${packages.weightInGrams}_v${packages.lengthCm}x${packages.widthCm}x${packages.heightCm}`;

    const cachedOptions = await tenantCache.getOrSet(
      params.lojaID,
      'freight_quote',
      cacheKey,
      async () => {
        const originCep = loja.originCep?.replace(/\D/g, '') || '01001000'; // Fallback se não preenchido

        const quoteRequest: FreightQuoteRequest = {
          lojaID: loja.id,
          originCep,
          destinationCep: cleanDestCep,
          packages,
          cartTotal,
          itemsCount,
          items: params.items,
          storeSettings: {
            additionalDays: loja.additionalDays,
            enableCorreios: loja.enableCorreios,
            correiosContractCode: loja.correiosContractCode,
            correiosPassword: loja.correiosPassword,
            enablePickup: loja.enablePickup,
            enableNoFreight: loja.enableNoFreight,
          },
        };

        // 4. Executar cotações concorrentes nos provedores disponíveis
        const quotePromises = this.providers.map(async (provider) => {
          try {
            const isAvailable = await provider.isAvailableForStore(loja.id, quoteRequest.storeSettings);
            if (!isAvailable) return [];
            return await provider.calculateQuotes(quoteRequest);
          } catch (err) {
            console.error(`[FREIGHT_PROVIDER_ERROR] Provedor ${provider.id} falhou:`, err);
            return [];
          }
        });

        const settledResults = await Promise.allSettled(quotePromises);
        const consolidatedOptions: FreightOption[] = [];

        for (const result of settledResults) {
          if (result.status === 'fulfilled') {
            consolidatedOptions.push(...result.value);
          }
        }

        // 5. Ordenar opções (Primeiro opções gratuitas/retirada, depois por preço crescente)
        return consolidatedOptions.sort((a, b) => {
          if (a.price === 0 && b.price > 0) return -1;
          if (b.price === 0 && a.price > 0) return 1;
          return a.price - b.price;
        });
      },
      1800000 // 30 minutos de cache
    );

    return {
      options: cachedOptions,
      packageDetails: {
        weightInGrams: packages.weightInGrams,
        dimensions: `${packages.lengthCm}x${packages.widthCm}x${packages.heightCm} cm`,
      },
    };
  }
}

// Instância Singleton exportada
export const freightOrchestrator = new FreightOrchestratorService();
