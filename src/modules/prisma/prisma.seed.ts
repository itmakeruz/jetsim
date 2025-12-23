import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function changeIncrementIdOfTransactionSeed() {
  await prisma.$executeRawUnsafe(`
    SELECT setval(
      'transaction_id_seq',
      GREATEST(
        1000,
        (SELECT COALESCE(MAX(id), 0) FROM transaction) + 1
      )
    );
  `);

  console.log('Seeding completed!');
}
changeIncrementIdOfTransactionSeed();
