import { FreightOption, FreightQuoteRequest, IFreightProvider } from '@/types/freight';

export class NoneOptionProvider implements IFreightProvider {
  public readonly id = 'NONE';
  public readonly name = 'Sem Frete / A Combinar';

  public async isAvailableForStore(lojaID: string, storeSettings?: any): Promise<boolean> {
    if (storeSettings?.enableNoFreight !== undefined) {
      return Boolean(storeSettings.enableNoFreight);
    }
    return true;
  }

  public async calculateQuotes(request: FreightQuoteRequest): Promise<FreightOption[]> {
    return [
      {
        providerId: 'NONE',
        serviceCode: 'NONE',
        serviceName: 'A Combinar via WhatsApp (Sem frete no pedido)',
        carrier: 'A Combinar',
        price: 0,
        deliveryTimeInDays: 0,
        description: 'Conclua a compra e combine a forma de entrega ou envio diretamente pelo WhatsApp.',
      },
    ];
  }
}
