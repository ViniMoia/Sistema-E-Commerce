/**
 * Sistema de Cache Tenant-Aware (Finding SCL-003).
 * Garante que todas as chaves de cache sejam estritamente particionadas por lojaID,
 * prevenindo cache poisoning e vazamento de dados cross-tenant.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  lojaID: string;
  resource: string;
}

const memoryCache = new Map<string, CacheEntry<any>>();

// Limpeza periódica de entradas expiradas
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of memoryCache.entries()) {
      if (now > entry.expiresAt) {
        memoryCache.delete(key);
      }
    }
  }, 60000);
}

/**
 * Constrói chave de cache particionada por tenant de forma determinística.
 */
export function buildTenantCacheKey(
  lojaID: string,
  resource: string,
  identifier: string
): string {
  if (!lojaID) throw new Error("lojaID é obrigatório para chave de cache tenant-aware.");
  return `tenant:${lojaID}:${resource}:${identifier.toLowerCase()}`;
}

export const tenantCache = {
  get<T>(key: string): T | null {
    const entry = memoryCache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      memoryCache.delete(key);
      return null;
    }

    return entry.value as T;
  },

  set<T>(
    lojaID: string,
    resource: string,
    identifier: string,
    value: T,
    ttlMs = 60000
  ): void {
    const key = buildTenantCacheKey(lojaID, resource, identifier);
    memoryCache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
      lojaID,
      resource,
    });
  },

  del(lojaID: string, resource: string, identifier: string): void {
    const key = buildTenantCacheKey(lojaID, resource, identifier);
    memoryCache.delete(key);
  },

  /**
   * Invalida todas as entradas de cache de um tenant específico ou recurso.
   */
  invalidateTenant(lojaID: string, resource?: string): void {
    for (const [key, entry] of memoryCache.entries()) {
      if (entry.lojaID === lojaID) {
        if (!resource || entry.resource === resource) {
          memoryCache.delete(key);
        }
      }
    }
  },

  /**
   * Executa factory com memoização tenant-aware.
   */
  async getOrSet<T>(
    lojaID: string,
    resource: string,
    identifier: string,
    factory: () => Promise<T>,
    ttlMs = 60000
  ): Promise<T> {
    const key = buildTenantCacheKey(lojaID, resource, identifier);
    const cached = tenantCache.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const fresh = await factory();
    if (fresh !== null && fresh !== undefined) {
      tenantCache.set(lojaID, resource, identifier, fresh, ttlMs);
    }
    return fresh;
  },

  clear(): void {
    memoryCache.clear();
  },
};
