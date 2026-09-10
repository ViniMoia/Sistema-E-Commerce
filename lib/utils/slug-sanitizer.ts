/**
 * Utilitário de sanitização e normalização de slugs para lojas e produtos.
 * Transforma strings com acentos, espaços e caracteres especiais em slugs limpos e seguros para URLs.
 */
export function sanitizeSlug(input: unknown): string {
  if (input === null || input === undefined) return '';

  const raw = String(input).trim().toLowerCase();

  return raw
    .normalize('NFD') // Normaliza caracteres Unicode acentuados
    .replace(/[\u0300-\u036f]/g, '') // Remove marcas de acentuação
    .replace(/[\s_]+/g, '-') // Substitui espaços e underscores por hífen ANTES de filtrar símbolos
    .replace(/[^a-z0-9-]/g, '') // Remove caracteres especiais mantendo letras, números e hifens
    .replace(/-+/g, '-') // Remove hifens consecutivos duplicados
    .replace(/^-+|-+$/g, ''); // Remove hifens no início e fim
}
