import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function changeIncrementIdOfTransactionSeed() {
  await prisma.$executeRawUnsafe(`
    SELECT setval(
      'Transaction_id_seq',
      GREATEST(
        1000,
        (SELECT COALESCE(MAX(id), 0) FROM "Transaction") + 1
      )
    );
  `);

  console.log('Seeding completed!');
}
changeIncrementIdOfTransactionSeed();
