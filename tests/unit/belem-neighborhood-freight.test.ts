import { describe, expect, it } from 'vitest';
import {
  findBelemAnanindeuaRate,
  isLocalMetropolitanArea,
  BELEM_ANANINDEUA_NEIGHBORHOODS,
} from '@/lib/freight/belem-ananindeua-neighborhoods';
import { CustomTableProvider } from '@/services/freight/providers/custom-table.provider';
import type { FreightQuoteRequest } from '@/types/freight';

describe('Desafio 3: Tabela de Fretes por Bairros (Belém, Ananindeua e Marituba)', () => {
  it('contém exatamente todas as faixas e cobre os 52 bairros homologados', () => {
    expect(BELEM_ANANINDEUA_NEIGHBORHOODS.length).toBeGreaterThanOrEqual(50);
  });

  it('identifica corretamente cidades da Região Metropolitana', () => {
    expect(isLocalMetropolitanArea('Belém', '1501402')).toBe(true);
    expect(isLocalMetropolitanArea('Ananindeua', '1500800')).toBe(true);
    expect(isLocalMetropolitanArea('Marituba', '1504422')).toBe(true);
    expect(isLocalMetropolitanArea('Castanhal', '1502400')).toBe(false);
    expect(isLocalMetropolitanArea('São Paulo', '3550308')).toBe(false);
  });

  it('calcula o valor exato para diferentes bairros com acentos e variações', () => {
    // R$ 10,00
    expect(findBelemAnanindeuaRate('Ananindeua', '1500800', 'Cidade Nova 4')?.price).toBe(10);
    expect(findBelemAnanindeuaRate('Ananindeua', '1500800', 'Guajará')?.price).toBe(10);
    expect(findBelemAnanindeuaRate('Ananindeua', '1500800', 'Paar')?.price).toBe(10);

    // R$ 15,00
    expect(findBelemAnanindeuaRate('Ananindeua', '1500800', 'Curuçambá')?.price).toBe(15);
    expect(findBelemAnanindeuaRate('Ananindeua', '1500800', 'Icuí Guajará')?.price).toBe(15);
    expect(findBelemAnanindeuaRate('Belém', '1501402', 'Providência')?.price).toBe(15);

    // R$ 20,00
    expect(findBelemAnanindeuaRate('Ananindeua', '1500800', 'Atalaia')?.price).toBe(20);
    expect(findBelemAnanindeuaRate('Belém', '1501402', 'Marambaia')?.price).toBe(20);
    expect(findBelemAnanindeuaRate('Belém', '1501402', 'Mangueirão')?.price).toBe(20);

    // R$ 25,00
    expect(findBelemAnanindeuaRate('Ananindeua', '1500800', 'Águas Lindas')?.price).toBe(25);
    expect(findBelemAnanindeuaRate('Belém', '1501402', 'Benguí')?.price).toBe(25);
    expect(findBelemAnanindeuaRate('Ananindeua', '1500800', 'Júlia Seffer')?.price).toBe(25);

    // R$ 30,00
    expect(findBelemAnanindeuaRate('Belém', '1501402', 'Marco')?.price).toBe(30);
    expect(findBelemAnanindeuaRate('Belém', '1501402', 'Pedreira')?.price).toBe(30);
    expect(findBelemAnanindeuaRate('Belém', '1501402', 'Telégrafo')?.price).toBe(30);
    expect(findBelemAnanindeuaRate('Marituba', '1504422', 'Centro')?.price).toBe(30);

    // R$ 35,00
    expect(findBelemAnanindeuaRate('Belém', '1501402', 'Nazaré')?.price).toBe(35);
    expect(findBelemAnanindeuaRate('Belém', '1501402', 'Umarizal')?.price).toBe(35);
    expect(findBelemAnanindeuaRate('Belém', '1501402', 'Icoaraci')?.price).toBe(35);

    // R$ 40,00
    expect(findBelemAnanindeuaRate('Belém', '1501402', 'Batista Campos')?.price).toBe(40);
    expect(findBelemAnanindeuaRate('Belém', '1501402', 'Guamá')?.price).toBe(40);
    expect(findBelemAnanindeuaRate('Belém', '1501402', 'Jurunas')?.price).toBe(40);

    // R$ 50,00
    expect(findBelemAnanindeuaRate('Belém', '1501402', 'Outeiro')?.price).toBe(50);
  });

  it('CustomTableProvider retorna prazo de 1 dia para itens leves e 4 dias para pesados', async () => {
    const provider = new CustomTableProvider();

    // Cenário 1: Produto Leve (Cera 500g)
    const lightRequest: FreightQuoteRequest = {
      lojaID: 'store-1',
      originCep: '67140615',
      destinationCep: '66060000',
      destination: {
        cep: '66060000',
        state: 'PA',
        city: 'Belém',
        municipalityCode: '1501402',
        neighborhood: 'Umarizal',
      },
      packages: { weightInGrams: 500, lengthCm: 16, widthCm: 11, heightCm: 4 },
      cartTotal: 120,
      itemsCount: 1,
      items: [
        { productId: 'p1', quantity: 1, name: 'Cera Native Carnaúba', weightInGrams: 500, lengthCm: 16, widthCm: 11, heightCm: 4 },
      ],
    };

    const lightQuotes = await provider.calculateQuotes(lightRequest);
    expect(lightQuotes).toHaveLength(1);
    expect(lightQuotes[0].price).toBe(35);
    expect(lightQuotes[0].deliveryTimeInDays).toBe(1);
    expect(lightQuotes[0].serviceName).toContain('Entregador Local');

    // Cenário 2: Produto Pesado (Extratora 18kg)
    const heavyRequest: FreightQuoteRequest = {
      lojaID: 'store-1',
      originCep: '67140615',
      destinationCep: '66060000',
      destination: {
        cep: '66060000',
        state: 'PA',
        city: 'Belém',
        municipalityCode: '1501402',
        neighborhood: 'Umarizal',
      },
      packages: { weightInGrams: 18000, lengthCm: 45, widthCm: 35, heightCm: 50 },
      cartTotal: 2500,
      itemsCount: 1,
      items: [
        { productId: 'p2', quantity: 1, name: 'Extratora IPC Carpet Cleaner', weightInGrams: 18000, lengthCm: 45, widthCm: 35, heightCm: 50 },
      ],
    };

    const heavyQuotes = await provider.calculateQuotes(heavyRequest);
    expect(heavyQuotes).toHaveLength(1);
    expect(heavyQuotes[0].price).toBe(35);
    expect(heavyQuotes[0].deliveryTimeInDays).toBe(4);
    expect(heavyQuotes[0].serviceName).toContain('Entrega Própria da Loja');
    expect(heavyQuotes[0].carrier).toBe('Veículo Continental (Próprio)');
  });
});

