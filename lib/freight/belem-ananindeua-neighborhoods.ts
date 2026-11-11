/**
 * Tabela Oficial de Fretes por Bairros de Belém, Ananindeua e Marituba
 * Conforme especificação do documento do lojista (Desafios de gay.md)
 */

export interface NeighborhoodFreightEntry {
  id: string;
  name: string;
  municipality: 'Belém' | 'Ananindeua' | 'Marituba' | 'Região Metropolitana';
  price: number;
  aliases: string[];
}

export const normalizeText = (text: string): string => {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ');
};

export const BELEM_ANANINDEUA_NEIGHBORHOODS: NeighborhoodFreightEntry[] = [
  // R$ 10,00
  {
    id: 'cidade-nova',
    name: 'Cidade Nova',
    municipality: 'Ananindeua',
    price: 10.0,
    aliases: ['cidade nova', 'cidade nova i', 'cidade nova ii', 'cidade nova iii', 'cidade nova iv', 'cidade nova v', 'cidade nova vi', 'cidade nova vii', 'cidade nova viii', 'cidade nova 1', 'cidade nova 2', 'cidade nova 3', 'cidade nova 4', 'cidade nova 5', 'cidade nova 6', 'cidade nova 7', 'cidade nova 8', 'coqueiro cidade nova'],
  },
  {
    id: 'guajara',
    name: 'Guajará',
    municipality: 'Ananindeua',
    price: 10.0,
    aliases: ['guajara', 'guajara i', 'guajara ii', 'guajara 1', 'guajara 2', 'conjunto guajara'],
  },
  {
    id: 'paar',
    name: 'Paar',
    municipality: 'Ananindeua',
    price: 10.0,
    aliases: ['paar', 'conjunto paar', 'p a a r'],
  },

  // R$ 15,00
  {
    id: 'curucamba',
    name: 'Curuçambá',
    municipality: 'Ananindeua',
    price: 15.0,
    aliases: ['curucamba', 'curucamba'],
  },
  {
    id: 'icui-40-horas',
    name: 'Icuí / 40 Horas',
    municipality: 'Ananindeua',
    price: 15.0,
    aliases: ['icui', '40 horas', 'quarenta horas', 'icui guajara', 'quarenta horas icui'],
  },
  {
    id: 'maguari',
    name: 'Maguari',
    municipality: 'Ananindeua',
    price: 15.0,
    aliases: ['maguari', 'caju'],
  },
  {
    id: 'providencia',
    name: 'Providência',
    municipality: 'Belém',
    price: 15.0,
    aliases: ['providencia', 'val de cans providencia', 'conjunto providencia'],
  },

  // R$ 20,00
  {
    id: 'ananindeua-centro',
    name: 'Ananindeua Centro',
    municipality: 'Ananindeua',
    price: 20.0,
    aliases: ['ananindeua centro', 'centro ananindeua'],
  },
  {
    id: 'atalaia',
    name: 'Atalaia',
    municipality: 'Ananindeua',
    price: 20.0,
    aliases: ['atalaia'],
  },
  {
    id: 'cabanagem',
    name: 'Cabanagem',
    municipality: 'Belém',
    price: 20.0,
    aliases: ['cabanagem'],
  },
  {
    id: 'castanheira',
    name: 'Castanheira',
    municipality: 'Belém',
    price: 20.0,
    aliases: ['castanheira'],
  },
  {
    id: 'distrito-industrial',
    name: 'Distrito Industrial',
    municipality: 'Ananindeua',
    price: 20.0,
    aliases: ['distrito industrial', 'distrito industrial ananindeua'],
  },
  {
    id: 'guanabara',
    name: 'Guanabara',
    municipality: 'Ananindeua',
    price: 20.0,
    aliases: ['guanabara'],
  },
  {
    id: 'icui-laranjeira',
    name: 'Icuí Laranjeira',
    municipality: 'Ananindeua',
    price: 20.0,
    aliases: ['icui laranjeira', 'laranjeira', 'laranjeiras'],
  },
  {
    id: 'jaderlandia',
    name: 'Jaderlândia',
    municipality: 'Ananindeua',
    price: 20.0,
    aliases: ['jaderlandia', 'jaderlandia i', 'jaderlandia ii', 'jaderlandia 1', 'jaderlandia 2'],
  },
  {
    id: 'jiboia-branca',
    name: 'Jiboia Branca',
    municipality: 'Ananindeua',
    price: 20.0,
    aliases: ['jiboia branca'],
  },
  {
    id: 'mangueirao',
    name: 'Mangueirão',
    municipality: 'Belém',
    price: 20.0,
    aliases: ['mangueirao', 'mangueirao belem'],
  },
  {
    id: 'marambaia',
    name: 'Marambaia',
    municipality: 'Belém',
    price: 20.0,
    aliases: ['marambaia', 'nova marambaia'],
  },
  {
    id: 'una',
    name: 'Una',
    municipality: 'Belém',
    price: 20.0,
    aliases: ['una', 'parque una'],
  },

  // R$ 25,00
  {
    id: 'aguas-brancas',
    name: 'Águas Brancas',
    municipality: 'Ananindeua',
    price: 25.0,
    aliases: ['aguas brancas'],
  },
  {
    id: 'aguas-lindas',
    name: 'Águas Lindas',
    municipality: 'Ananindeua',
    price: 25.0,
    aliases: ['aguas lindas'],
  },
  {
    id: 'bengui',
    name: 'Benguí',
    municipality: 'Belém',
    price: 25.0,
    aliases: ['bengui', 'benguii'],
  },
  {
    id: 'julia-seffer',
    name: 'Júlia Seffer',
    municipality: 'Ananindeua',
    price: 25.0,
    aliases: ['julia sefer', 'julia seffer', 'conjunto julia seffer'],
  },
  {
    id: 'parque-verde',
    name: 'Parque Verde',
    municipality: 'Belém',
    price: 25.0,
    aliases: ['parque verde'],
  },

  // R$ 30,00
  {
    id: 'aeroporto',
    name: 'Aeroporto',
    municipality: 'Belém',
    price: 30.0,
    aliases: ['aeroporto', 'aeroporto internacional'],
  },
  {
    id: 'aura',
    name: 'Aurá',
    municipality: 'Ananindeua',
    price: 30.0,
    aliases: ['aura'],
  },
  {
    id: 'barreiro',
    name: 'Barreiro',
    municipality: 'Belém',
    price: 30.0,
    aliases: ['barreiro'],
  },
  {
    id: 'curio-utinga',
    name: 'Curió-Utinga',
    municipality: 'Belém',
    price: 30.0,
    aliases: ['curio utinga', 'curio', 'utinga'],
  },
  {
    id: 'marco',
    name: 'Marco',
    municipality: 'Belém',
    price: 30.0,
    aliases: ['marco'],
  },
  {
    id: 'marituba',
    name: 'Marituba',
    municipality: 'Marituba',
    price: 30.0,
    aliases: ['marituba', 'centro marituba', 'marituba centro', 'centro'],
  },
  {
    id: 'pedreira',
    name: 'Pedreira',
    municipality: 'Belém',
    price: 30.0,
    aliases: ['pedreira'],
  },
  {
    id: 'sacramenta',
    name: 'Sacramenta',
    municipality: 'Belém',
    price: 30.0,
    aliases: ['sacramenta'],
  },
  {
    id: 'souza',
    name: 'Souza',
    municipality: 'Belém',
    price: 30.0,
    aliases: ['souza', 'sousa'],
  },
  {
    id: 'tapana',
    name: 'Tapanã',
    municipality: 'Belém',
    price: 30.0,
    aliases: ['tapana'],
  },
  {
    id: 'telegrafo',
    name: 'Telégrafo',
    municipality: 'Belém',
    price: 30.0,
    aliases: ['telegrafo', 'telegrafo sem fio'],
  },
  {
    id: 'tenone',
    name: 'Tenoné',
    municipality: 'Belém',
    price: 30.0,
    aliases: ['tenone'],
  },
  {
    id: 'val-de-caes',
    name: 'Val-de-Cães',
    municipality: 'Belém',
    price: 30.0,
    aliases: ['val de caes', 'val de cans', 'valdecaes', 'valdecans'],
  },

  // R$ 35,00
  {
    id: 'campina',
    name: 'Campina',
    municipality: 'Belém',
    price: 35.0,
    aliases: ['campina', 'comercio'],
  },
  {
    id: 'cidade-velha',
    name: 'Cidade Velha',
    municipality: 'Belém',
    price: 35.0,
    aliases: ['cidade velha'],
  },
  {
    id: 'fatima',
    name: 'Fátima',
    municipality: 'Belém',
    price: 35.0,
    aliases: ['fatima'],
  },
  {
    id: 'icoaraci',
    name: 'Icoaraci',
    municipality: 'Belém',
    price: 35.0,
    aliases: ['icoaraci', 'icooraci', 'cruzeiro', 'ponta grossa', 'campina de icoaraci', 'paracuri'],
  },
  {
    id: 'nazare',
    name: 'Nazaré',
    municipality: 'Belém',
    price: 35.0,
    aliases: ['nazare'],
  },
  {
    id: 'pratinha',
    name: 'Pratinha',
    municipality: 'Belém',
    price: 35.0,
    aliases: ['pratinha', 'pratinha i', 'pratinha ii'],
  },
  {
    id: 'reduto',
    name: 'Reduto',
    municipality: 'Belém',
    price: 35.0,
    aliases: ['reduto'],
  },
  {
    id: 'sao-bras',
    name: 'São Brás',
    municipality: 'Belém',
    price: 35.0,
    aliases: ['sao bras', 'sao braz'],
  },
  {
    id: 'umarizal',
    name: 'Umarizal',
    municipality: 'Belém',
    price: 35.0,
    aliases: ['umarizal'],
  },

  // R$ 40,00
  {
    id: 'batista-campos',
    name: 'Batista Campos',
    municipality: 'Belém',
    price: 40.0,
    aliases: ['batista campos'],
  },
  {
    id: 'canudos',
    name: 'Canudos',
    municipality: 'Belém',
    price: 40.0,
    aliases: ['canudos'],
  },
  {
    id: 'condor',
    name: 'Condor',
    municipality: 'Belém',
    price: 40.0,
    aliases: ['condor'],
  },
  {
    id: 'cremacao',
    name: 'Cremação',
    municipality: 'Belém',
    price: 40.0,
    aliases: ['cremacao'],
  },
  {
    id: 'guama',
    name: 'Guamá',
    municipality: 'Belém',
    price: 40.0,
    aliases: ['guama'],
  },
  {
    id: 'jurunas',
    name: 'Jurunas',
    municipality: 'Belém',
    price: 40.0,
    aliases: ['jurunas'],
  },
  {
    id: 'terra-firme',
    name: 'Terra Firme',
    municipality: 'Belém',
    price: 40.0,
    aliases: ['terra firme', 'montese'],
  },

  // R$ 50,00
  {
    id: 'outeiro',
    name: 'Outeiro',
    municipality: 'Belém',
    price: 50.0,
    aliases: ['outeiro', 'agua boa', 'brasilia', 'sao joao do outeiro', 'itaiteua', 'ilha de outeiro'],
  },
];

export const SUPPORTED_LOCAL_MUNICIPALITY_CODES = new Set([
  '1501402', // Belém
  '1500800', // Ananindeua
  '1504422', // Marituba
]);

export function isLocalMetropolitanArea(city: string, municipalityCode?: string | null): boolean {
  if (municipalityCode && SUPPORTED_LOCAL_MUNICIPALITY_CODES.has(municipalityCode)) {
    return true;
  }
  const normCity = normalizeText(city);
  return normCity === 'belem' || normCity === 'ananindeua' || normCity === 'marituba';
}

/**
 * Encontra a tarifa do bairro na tabela oficial de Belém, Ananindeua e Marituba.
 */
export function findBelemAnanindeuaRate(
  city: string,
  municipalityCode?: string | null,
  neighborhood?: string | null
): NeighborhoodFreightEntry | null {
  if (!isLocalMetropolitanArea(city, municipalityCode)) {
    return null;
  }

  if (!neighborhood || !neighborhood.trim()) {
    return null;
  }

  const normNeighborhood = normalizeText(neighborhood);
  const normCity = normalizeText(city);

  // 1. Busca exata por aliases priorizando mesmo município
  const sameMunicipality = (entry: NeighborhoodFreightEntry) => {
    const normMun = normalizeText(entry.municipality);
    return normMun === normCity || (municipalityCode === '1504422' && normMun === 'marituba') ||
      (municipalityCode === '1500800' && normMun === 'ananindeua') ||
      (municipalityCode === '1501402' && normMun === 'belem');
  };

  // 1a. Exato + mesmo município
  for (const entry of BELEM_ANANINDEUA_NEIGHBORHOODS) {
    if (sameMunicipality(entry) && entry.aliases.some(alias => normalizeText(alias) === normNeighborhood)) {
      return entry;
    }
  }

  // 1b. Exato em qualquer município
  for (const entry of BELEM_ANANINDEUA_NEIGHBORHOODS) {
    if (entry.aliases.some(alias => normalizeText(alias) === normNeighborhood)) {
      return entry;
    }
  }

  // 2a. Busca parcial + mesmo município
  for (const entry of BELEM_ANANINDEUA_NEIGHBORHOODS) {
    if (sameMunicipality(entry) && entry.aliases.some(alias => {
      const normAlias = normalizeText(alias);
      return normNeighborhood.includes(normAlias) || normAlias.includes(normNeighborhood);
    })) {
      return entry;
    }
  }

  // 2b. Busca parcial geral
  for (const entry of BELEM_ANANINDEUA_NEIGHBORHOODS) {
    if (entry.aliases.some(alias => {
      const normAlias = normalizeText(alias);
      return normNeighborhood.includes(normAlias) || normAlias.includes(normNeighborhood);
    })) {
      return entry;
    }
  }

  return null;
}
