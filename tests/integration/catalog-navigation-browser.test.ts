import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import prisma, { verifyTestDatabase } from '@/lib/prisma';
import { createFixtureStore, cleanupFixtureStores } from '@/tests/setup/fixture-scope';
import { isolatedBrowser } from '../../scripts/lib/isolated-browser.mjs';

let host: string;
const browsers: Awaited<ReturnType<typeof isolatedBrowser>>[] = [];
const titles = `Array.from(document.querySelectorAll('#catalogo h4 button'), e => e.textContent.trim())`;
const page = `document.querySelector('nav[aria-label="Paginação do catálogo de produtos"] [aria-current="page"]')?.textContent.trim()`;
const hydrated = `(() => { const b=document.querySelector('button[aria-label^="Carrinho de compras"]');
  const k=b && Object.keys(b).find(k=>k.startsWith('__reactProps')); return k && typeof b[k].onClick==='function'; })()`;

beforeAll(async () => {
  await verifyTestDatabase();
  const lojaID = await createFixtureStore();
  const user = await prisma.user.create({ data: { lojaID, name: 'Catalog reader', email: randomUUID()+'@example.invalid', password: '' } });
  const brands = Array.from({ length: 18 }, (_, i) => ({ id: randomUUID(), lojaID,
    slug: i === 0 ? 'wap' : i === 1 ? 'vonixx' : 'marca-'+i, name: i === 0 ? 'WAP' : i === 1 ? 'Vonixx' : 'Marca '+i }));
  await prisma.brand.createMany({ data: brands });
  const categories = Array.from({ length: 10 }, (_, i) => ({ id: randomUUID(), lojaID,
    slug: i === 0 ? 'acessorios' : i === 1 ? 'ceras-e-selantes' : 'categoria-'+i, name: 'Categoria '+i }));
  await prisma.categoryTag.createMany({ data: categories });
  const products = Array.from({ length: 519 }, (_, i) => ({ id: randomUUID(), lojaID, userID: user.id,
    name: 'ITEM '+String(i).padStart(3,'0'), description: i === 0 ? 'Aplicador compatível com CERA VONIXX' : 'Produto sintético para navegação',
    price: 25+i, stock: 5, imageUrl: '/brands/wap.svg', brandID: brands[i < 40 ? 0 : 1+(i%17)].id,
    tagsSearchCache: [categories[i%10].slug], createdAt: new Date(Date.UTC(2026,0,1,0,0,i)) }));
  await prisma.product.createMany({ data: products });
  await prisma.productVariants.createMany({ data: products.map(p=>({ ProductID:p.id, size:'Único', color:'Padrão', stock:5 })) });
  await prisma.productCategoryTag.createMany({ data: products.map((p,i)=>({ productID:p.id, categoryTagID:categories[i%10].id })) });
  host = (await prisma.loja.findUniqueOrThrow({ where:{ id:lojaID } })).slug+'.plataforma.com';
}, 120000);
afterEach(async () => { for (const browser of browsers.splice(0)) await browser.close(); },60000);
afterAll(async () => { await cleanupFixtureStores(); await prisma.$disconnect(); },60000);

describe('V-01/V-05: navegação de catálogo com 519 produtos sintéticos', () => {
  it.each([{width:1280,height:900,mobile:false},{width:390,height:844,mobile:true}])('preserva filtro/página no reload e histórico ($width)', async device => {
    const browser = await isolatedBrowser({ host }); browsers.push(browser);
    await browser.send('Emulation.setDeviceMetricsOverride', {...device, deviceScaleFactor:1});
    await browser.navigate('/?marca=wap&pagina=2#catalogo'); await browser.waitFor(hydrated);
    await browser.waitFor(`(${page}) === '2'`);
    expect(await browser.evaluate(titles)).toHaveLength(12);
    expect(await browser.evaluate(`document.querySelector('nav[aria-label="Paginação do catálogo de produtos"]').textContent`)).toContain('13–24');
    await browser.evaluate(`history.pushState(null,'','/?marca=vonixx&pagina=2#catalogo'); dispatchEvent(new PopStateEvent('popstate'));`);
    await browser.waitFor(`(${page}) === '2' && document.querySelector('#catalogo').textContent.includes('Vonixx')`);
    await browser.evaluate('history.back()');
    await browser.waitFor(`location.search.includes('marca=wap') && (${page}) === '2'`);
    await browser.send('Page.reload'); await browser.waitFor(hydrated); await browser.waitFor(`(${page}) === '2'`);
    await browser.evaluate(`(()=>{const e=document.querySelector('input[placeholder="Buscar produtos..."]');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'ITEM 000');e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await browser.waitFor(`(${titles}).length === 1`);
    expect(await browser.evaluate(titles)).toEqual(['ITEM 000']);
    expect(await browser.evaluate(`document.querySelector('#catalogo').innerText`)).toMatch(/R\$\s*25,00/);
    await browser.evaluate(`document.querySelector('#catalogo h4 button').click()`);
    await browser.waitFor(`document.querySelector('h1')?.textContent.includes('ITEM 000')`);
    expect(await browser.evaluate('document.body.innerText')).toMatch(/R\$\s*25,00/);
    await browser.click('Voltar às compras');
    await browser.waitFor(`(${titles}).length === 1`);
  },120000);

  it.each(['marca=vonixx','tags=ceras-e-selantes'])('não substitui classificação persistida por palavras na descrição: %s',async filter=>{
    const browser=await isolatedBrowser({host});browsers.push(browser);
    await browser.navigate('/?'+filter+'&busca=ITEM%20000#catalogo');await browser.waitFor(hydrated);
    await browser.waitFor(`document.querySelector('input[placeholder="Buscar produtos..."]')?.value === 'ITEM 000'`);
    expect(await browser.evaluate(titles)).toEqual([]);
  },60000);

  it('descarta frete atrasado após editar CEP e retira a cotação anterior da tela', async () => {
    let release: (() => void) | undefined;
    let started = false;
    const pending = new Promise<void>(resolve => { release = resolve; });
    const browser = await isolatedBrowser({ host, intercept: async request => {
      if (request.url !== '/api/freight/calculate') return null;
      const old = JSON.parse(request.body).destinationCep === '01001000';
      if (old) { started = true; await pending; }
      return { body: { success:true, data: { options:[{ providerId:'JT_EXPRESS', serviceCode:'TEST',
        serviceName:old ? 'COTACAO ANTIGA' : 'COTACAO ATUAL', price:12.3, deliveryTimeInDays:3 }] } } };
    } }); browsers.push(browser);
    try {
      await browser.navigate('/?busca=ITEM%20000#catalogo'); await browser.waitFor(hydrated);
      await browser.waitFor(`(${titles}).length === 1`);
      await browser.evaluate(`document.querySelector('#catalogo h4 button').click()`);
      await browser.waitFor(`!!document.querySelector('input[aria-label="CEP para cálculo de frete"]')`);
      await browser.evaluate(`(() => {const original=window.fetch;window.__quoteCompleted=0;
        window.fetch=async (...args)=>{try{return await original(...args);}finally{if(args[0]==='/api/freight/calculate')window.__quoteCompleted++;}};})()`);
      const inputCep = async (value:string) => browser.evaluate(`(()=>{const e=document.querySelector('input[aria-label="CEP para cálculo de frete"]');
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
      await inputCep('01001000'); await browser.click('Calcular');
      await expect.poll(()=>started).toBe(true);
      await inputCep('66010000'); release!();
      await browser.waitFor('window.__quoteCompleted >= 1');
      expect(await browser.evaluate('document.body.innerText')).not.toContain('COTACAO ANTIGA');
      await browser.click('Calcular'); await browser.waitFor(`document.body.innerText.includes('COTACAO ATUAL')`);
      await inputCep('69005000');
      expect(await browser.evaluate('document.body.innerText')).not.toContain('COTACAO ATUAL');
    } finally { release?.(); }
  },60000);
});
