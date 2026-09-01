import { FreightOption, FreightQuoteRequest, IFreightProvider } from '@/types/freight';

export class PickupProvider implements IFreightProvider {
  public readonly id = 'STORE_PICKUP';
  public readonly name = 'Retirada na Loja';

  public async isAvailableForStore(lojaID: string, storeSettings?: any): Promise<boolean> {
    if (storeSettings?.enablePickup !== undefined) {
      return Boolean(storeSettings.enablePickup);
    }
    return true;
  }

  public async calculateQuotes(request: FreightQuoteRequest): Promise<FreightOption[]> {
    return [
      {
        providerId: 'STORE_PICKUP',
        serviceCode: 'PICKUP',
        serviceName: 'Retirada na Loja',
        carrier: 'Retirada Física',
        price: 0,
        deliveryTimeInDays: 0,
        description: 'Retire seu pedido diretamente no balcão da loja sem custo de envio.',
      },
    ];
  }
}
