import { Prisma } from '@prisma/client';

const entities = {
  intent: { table: 'CheckoutIntent', rank: 10 },
  cart: { table: 'Cart', rank: 20 },
  order: { table: 'Order', rank: 30 },
  product: { table: 'Product', rank: 40 },
  variant: { table: 'ProductVariants', rank: 50 },
  wallet: { table: 'LoyaltyWallet', rank: 60 },
  lot: { table: 'LoyaltyLot', rank: 70 },
} as const;

/** One instance per transaction. Authorize tenant/owner before acquiring locks,
 * then re-read business conditions under them. No remote I/O under these locks.
 * This checks explicit lock order, not PostgreSQL's entire implicit FK graph.
 */
export class CommerceLocks {
  private rank = 0;
  private acquiring = false;
  private held = new Map<keyof typeof entities, Set<string>>();
  private cartOwner: string | null = null;
  constructor(private readonly tx: Prisma.TransactionClient) {}

  /** Rank 15 protects creation before a cart exists. Hash collisions only
   * serialize unrelated owners; the partial unique index remains authoritative. */
  async acquireCartOwner(lojaID: string, userID: string): Promise<void> {
    if (![lojaID, userID].every(id => /^[a-zA-Z0-9_-]{1,128}$/.test(id))) throw new Error('Escopo de carrinho inválido.');
    const key = JSON.stringify(['cart-owner', lojaID, userID]);
    if (this.acquiring) throw new Error('Aquisição concorrente de locks: aguarde a operação anterior.');
    if (this.cartOwner === key) return;
    if (this.rank > 15 || this.cartOwner) throw new Error('Inversão na ordem de locks de comércio.');
    this.acquiring = true;
    try {
      await this.tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text AS locked`);
      this.rank = 15; this.cartOwner = key;
    } finally { this.acquiring = false; }
  }

  async acquire(entity: keyof typeof entities, ids: readonly string[]): Promise<string[]> {
    if (this.acquiring) throw new Error('Aquisição concorrente de locks: aguarde a operação anterior.');
    if (!Object.prototype.hasOwnProperty.call(entities, entity)) throw new Error('Entidade de lock inválida.');
    const definition = entities[entity];
    if (!definition) throw new Error('Entidade de lock inválida.');
    if (ids.some(id => !/^[a-zA-Z0-9_-]{1,128}$/.test(id))) throw new Error('Identificador de lock inválido.');
    const held = this.held.get(entity) || new Set<string>();
    const ordered = [...new Set(ids)].filter(id => !held.has(id)).sort();
    if (!ordered.length) return [];
    const last = [...held].sort().at(-1);
    if (definition.rank < this.rank || (last && ordered[0] < last)) {
      throw new Error('Inversão na ordem de locks de comércio.');
    }
    this.acquiring = true;
    try {
      const rows = await this.tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT id FROM ${Prisma.raw(`"${definition.table}"`)}
        WHERE id IN (${Prisma.join(ordered)}) ORDER BY id COLLATE "C" FOR UPDATE
      `);
      this.rank = definition.rank;
      // Remember even missing requested IDs: a later insert is not protected by
      // a row lock on a nonexistent row and must rely on a parent/unique constraint.
      for (const id of ordered) held.add(id);
      this.held.set(entity, held);
      return rows.map(row => row.id);
    } finally { this.acquiring = false; }
  }
}
