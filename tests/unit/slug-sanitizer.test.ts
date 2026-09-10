import { describe, it, expect } from 'vitest';
import { sanitizeSlug } from '@/lib/utils/slug-sanitizer';

describe('sanitizeSlug Unit Tests', () => {
  it('should normalize accented characters to plain ASCII', () => {
    expect(sanitizeSlug('Loja do João & Maria')).toBe('loja-do-joao-maria');
    expect(sanitizeSlug('Promoção Especial de Verão')).toBe('promocao-especial-de-verao');
  });

  it('should handle special symbols, punctuation and underscores', () => {
    expect(sanitizeSlug('Produto_Novo! @#$ Preço 100%')).toBe('produto-novo-preco-100');
  });

  it('should trim and collapse multiple consecutive hyphens or spaces', () => {
    expect(sanitizeSlug('   Slug   Com   Espacos   ')).toBe('slug-com-espacos');
    expect(sanitizeSlug('---multiplo---hifen---')).toBe('multiplo-hifen');
  });

  it('should safely handle empty, null, and non-string inputs', () => {
    expect(sanitizeSlug('')).toBe('');
    expect(sanitizeSlug(null)).toBe('');
    expect(sanitizeSlug(undefined)).toBe('');
    expect(sanitizeSlug(12345)).toBe('12345');
  });
});
