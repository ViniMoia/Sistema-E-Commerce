import prisma from "../lib/prisma";

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      lojaID: true,
      loja: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      _count: {
        select: {
          orders: true,
          addresses: true,
          carts: true,
          sessions: true,
          loyaltyTransactions: true,
          auditLogsAsActor: true,
          auditLogsAsTarget: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  console.log("Total users found:", users.length);
  console.log(JSON.stringify(users, null, 2));
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
