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
const inFlightRequests = new Map<string, Promise<unknown>>();
const MAX_CACHE_ENTRIES = 1000;

function removeExpiredEntries(now = Date.now()): void {
  for (const [key, entry] of memoryCache.entries()) {
    if (now > entry.expiresAt) {
      memoryCache.delete(key);
    }
  }
}

function enforceCapacity(): void {
  removeExpiredEntries();
  while (memoryCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = memoryCache.keys().next().value;
    if (oldestKey === undefined) break;
    memoryCache.delete(oldestKey);
  }
}

// Limpeza periódica de entradas expiradas
if (typeof setInterval !== "undefined") {
  const cleanupTimer = setInterval(removeExpiredEntries, 60000);
  if (typeof cleanupTimer === "object" && "unref" in cleanupTimer) {
    cleanupTimer.unref();
  }
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

    memoryCache.delete(key);
    memoryCache.set(key, entry);
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
    memoryCache.delete(key);
    enforceCapacity();
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

    const pending = inFlightRequests.get(key) as Promise<T> | undefined;
    if (pending) return pending;

    const request = factory()
      .then(fresh => {
        if (fresh !== null && fresh !== undefined) {
          tenantCache.set(lojaID, resource, identifier, fresh, ttlMs);
        }
        return fresh;
      })
      .finally(() => {
        inFlightRequests.delete(key);
      });

    inFlightRequests.set(key, request);
    return request;
  },

  clear(): void {
    memoryCache.clear();
    inFlightRequests.clear();
  },
};
