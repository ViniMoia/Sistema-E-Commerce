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
const pendingCache = new Map<string, { lojaID: string; resource: string; promise: Promise<unknown> }>();

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
    pendingCache.delete(key);
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
    pendingCache.delete(key);
  },

  /**
   * Invalida todas as entradas de cache de um tenant específico ou recurso.
   */
  invalidateTenant(lojaID: string, resource?: string): void {
    for (const [key, entry] of pendingCache) {
      if (entry.lojaID === lojaID && (!resource || entry.resource === resource)) pendingCache.delete(key);
    }
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

    const pending = pendingCache.get(key);
    if (pending) return pending.promise as Promise<T>;
    const entry = { lojaID, resource, promise: Promise.resolve().then(factory) };
    pendingCache.set(key, entry);
    try {
      const fresh = await entry.promise;
      // An invalidation or explicit set during computation fences this result.
      if (pendingCache.get(key) === entry && fresh !== null && fresh !== undefined) {
        tenantCache.set(lojaID, resource, identifier, fresh, ttlMs);
      }
      return fresh;
    } finally {
      if (pendingCache.get(key) === entry) pendingCache.delete(key);
    }
  },

  clear(): void {
    memoryCache.clear();
    pendingCache.clear();
  },
};
