import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import prisma, { verifyTestDatabase } from '@/lib/prisma';
import { createFixtureStore, cleanupFixtureStores } from '@/tests/setup/fixture-scope';
import { isolatedBrowser } from '../../scripts/lib/isolated-browser.mjs';

let browser: Awaited<ReturnType<typeof isolatedBrowser>>;
let lojaID: string;
let registrationRequests = 0;
let responseMode: 'real' | 'validation' | 'malformed' = 'real';
const email = randomUUID() + '@example.invalid';
const password = 'abc123';
const fields = {
  name: 'Cliente de teste', email, password, phone: '11999999999',
  cep: '01001-000', state: 'SP', city: 'Cidade de teste', district: 'Centro',
  street: 'Rua de teste', number: '1', complement: 'Fixture',
};
const contains = (message: string) => 'document.body.innerText.toLocaleLowerCase().includes(' + JSON.stringify(message.toLocaleLowerCase()) + ')';

beforeAll(async () => {
  await verifyTestDatabase();
  lojaID = await createFixtureStore();
  const loja = await prisma.loja.findUniqueOrThrow({ where: { id: lojaID } });
  browser = await isolatedBrowser({ host: loja.slug + '.plataforma.com', intercept: async ({ url, method }) => {
    if (url !== '/api/auth/register' || method !== 'POST') return null;
    registrationRequests++;
    if (responseMode === 'validation') return {
      status: 400,
      body: { error: 'Dados cadastrais inválidos', details: { fieldErrors: { password: ['Senha deve ter no mínimo 6 caracteres'] } } },
    };
    if (responseMode === 'malformed') return {
      status: 503, body: { error: { unexpected: true }, details: { fieldErrors: { password: [null, 1, {}] } } },
    };
    return null;
  } });
}, 120000);

afterAll(async () => {
  if (browser) await browser.close();
  await cleanupFixtureStores();
  await prisma.$disconnect();
}, 30000);

async function fillForm(values = fields) {
  await browser.navigate('/register');
  await browser.waitFor('(() => { const form = document.querySelector(\'input[name="password"]\')?.closest("form"); const key = form && Object.keys(form).find(key => key.startsWith("__reactProps")); return key && typeof form[key].onSubmit === "function"; })()');
  for (const [name, value] of Object.entries(values)) {
    await browser.input(name, value);
    await browser.waitFor('(() => { const input = document.querySelector(' + JSON.stringify('input[name="' + name + '"]') + '); const key = Object.keys(input).find(key => key.startsWith("__reactProps")); return key && input[key].value === ' + JSON.stringify(value) + '; })()', 5000);
  }
}

describe('Registration: real React form and HTTP/session/database boundary', () => {
  it('rejects 4/5-character passwords and invalid address fields before sending; accepts 6 and persists a session', async () => {
    await fillForm();
    expect(await browser.evaluate('document.querySelector(\'input[name="password"]\').placeholder')).toBe('Mínimo 6 caracteres');
    for (const shortPassword of ['abc1', 'abc12']) {
      await browser.input('password', shortPassword);
      await browser.click('Finalizar Cadastro');
      await browser.waitFor(contains('Senha deve ter no mínimo 6 caracteres'));
      expect(registrationRequests).toBe(0);
    }
    await browser.input('password', password);
    await browser.input('cep', '1234567');
    await browser.click('Finalizar Cadastro');
    await browser.waitFor(contains('CEP inválido'));
    expect(registrationRequests).toBe(0);
    await browser.input('cep', fields.cep);
    await browser.input('phone', '');
    await browser.click('Finalizar Cadastro');
    await browser.waitFor(contains('Campo obrigatório'));
    expect(registrationRequests).toBe(0);
    await browser.input('phone', fields.phone);
    await browser.click('Finalizar Cadastro');
    await browser.waitFor(contains('Cadastro Concluído!'), 45000);
    expect(registrationRequests).toBe(1);
    expect(await browser.evaluate('document.querySelector(\'input[name="password"]\')')).toBeNull();
    const user = await prisma.user.findUniqueOrThrow({ where: { email_lojaID: { email, lojaID } }, include: { addresses: true } });
    expect(user.addresses).toHaveLength(1);
    expect(user.defaultAddressId).toBe(user.addresses[0].id);
    expect(await bcrypt.compare(password, user.password!)).toBe(true);
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(1);
    const profile = await browser.evaluate('(async () => { const r=await fetch("/api/user/profile"); return {status:r.status,body:await r.json()}; })()') as {
      status: number; body: { data: { id: string; lojaID: string } };
    };
    expect(profile.status).toBe(200);
    expect(profile.body.data).toMatchObject({ id: user.id, lojaID });
  }, 120000);

  it('displays the real duplicate-email error without losing fields or reporting success', async () => {
    await fillForm();
    await browser.click('Finalizar Cadastro');
    await browser.waitFor(contains('Email já existente para esta loja'));
    expect(await browser.evaluate(contains('Cadastro Concluído!'))).toBe(false);
    expect(await browser.evaluate('document.querySelector(\'input[name="email"]\').value')).toBe(email);
    expect(await browser.evaluate('document.querySelector(\'input[name="street"]\').value')).toBe(fields.street);
    expect(await prisma.user.count({ where: { lojaID, email } })).toBe(1);
  }, 60000);

  it('exposes server validation details and safely falls back for an unexpected error body', async () => {
    responseMode = 'validation';
    await fillForm({ ...fields, email: randomUUID() + '@example.invalid' });
    await browser.click('Finalizar Cadastro');
    await browser.waitFor(contains('Dados cadastrais inválidos: Senha deve ter no mínimo 6 caracteres'));
    expect(await browser.evaluate(contains('Cadastro Concluído!'))).toBe(false);
    responseMode = 'malformed';
    await browser.click('Finalizar Cadastro');
    await browser.waitFor(contains('Ocorreu um erro ao realizar o cadastro.'));
    expect(await browser.evaluate(contains('[object Object]'))).toBe(false);
    expect(await prisma.user.count({ where: { lojaID } })).toBe(1);
  }, 60000);
});
