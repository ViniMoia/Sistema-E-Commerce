import { describe, it, expect } from 'vitest';
import {
  validateCpf,
  validateCnpj,
  validateCpfCnpj,
  formatCpfCnpj,
  cleanDigits,
} from '@/lib/validators/cpf-cnpj';

describe('CPF/CNPJ Validator (lib/validators/cpf-cnpj.ts)', () => {
  it('deve limpar dígitos não numéricos', () => {
    expect(cleanDigits('123.456.789-00')).toBe('12345678900');
    expect(cleanDigits('abc123xyz')).toBe('123');
  });

  it('deve rejeitar CPFs inválidos e com dígitos repetidos', () => {
    expect(validateCpf('11111111111')).toBe(false);
    expect(validateCpf('00000000000')).toBe(false);
    expect(validateCpf('12345678901')).toBe(false);
    expect(validateCpf('123')).toBe(false);
  });

  it('deve validar CPFs válidos conhecidos', () => {
    // CPFs válidos de teste conhecidos
    expect(validateCpf('52998224725')).toBe(true);
    expect(validateCpf('529.982.247-25')).toBe(true);
  });

  it('deve rejeitar CNPJs inválidos', () => {
    expect(validateCnpj('00000000000000')).toBe(false);
    expect(validateCnpj('11111111111111')).toBe(false);
    expect(validateCnpj('12345678000199')).toBe(false);
  });

  it('deve formatar CPF e CNPJ corretamente com máscara', () => {
    expect(formatCpfCnpj('52998224725')).toBe('529.982.247-25');
    expect(formatCpfCnpj('11222333000181')).toBe('11.222.333/0001-81');
  });

  it('deve validar indistintamente CPF ou CNPJ em validateCpfCnpj', () => {
    expect(validateCpfCnpj('529.982.247-25')).toBe(true);
    expect(validateCpfCnpj('12345')).toBe(false);
  });
});
