export function parseOrderHistoryPage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !/^\d+$/.test(raw)) return 1;
  const page = Number(raw);
  return Number.isSafeInteger(page) && page >= 1 && page <= 100_000 ? page : 1;
}

export function orderHistoryHref(page: number): string {
  const safePage = Number.isSafeInteger(page) && page > 1 ? page : 1;
  return `/profile?ordersPage=${safePage}#pedidos`;
}
