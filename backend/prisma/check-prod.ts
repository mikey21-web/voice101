import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
(async () => {
  const users = await p.user.findMany({ select: { email: true, tenantId: true, role: true, active: true } });
  console.log(JSON.stringify(users, null, 2));
  await p.$disconnect();
})();
