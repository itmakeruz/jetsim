import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { generateKey } from '../src/modules/b2b/keys/key-codec';
import { open, unlink } from 'fs/promises';
import { isAbsolute } from 'path';

class OperatorError extends Error {}

// Server-operator CLI. Does not start Nest, contact providers, top up or charge an account.
// Secrets go to an exclusively created 0600 file, never stdout or command arguments.
export async function issueGlobalKey(db: any, companyId: number, expectedName: string, out: string) {
  if (
    !Number.isSafeInteger(companyId) ||
    companyId < 1 ||
    !expectedName.trim() ||
    !isAbsolute(out) ||
    !out.endsWith('.env')
  )
    throw new OperatorError('Укажите центральный ID, точное имя компании и абсолютный путь к новому .env-файлу.');
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    const row = await db.reseller.findUnique({
      where: { id: companyId },
      select: { id: true, name: true, currency: true, status: true },
    });
    if (!row || row.name !== expectedName)
      throw new OperatorError('ID и имя центральной компании не совпали. Сначала проверьте список компаний.');
    if (row.currency !== 'USD' || row.status !== 'ACTIVE')
      throw new OperatorError('Ключ для Global можно выпустить только активной USD-компании.');
    handle = await open(out, 'wx', 0o600);
    await db.$transaction(async (tx: any) => {
      const current = await tx.reseller.findUnique({ where: { id: companyId } });
      if (!current || current.name !== expectedName || current.currency !== 'USD' || current.status !== 'ACTIVE')
        throw new OperatorError('Условия компании изменились; ключ не создан.');
      const key = generateKey();
      await tx.resellerApiKey.create({
        data: {
          reseller_id: companyId,
          name: 'Global backend - direct central API',
          prefix: key.prefix,
          key_hash: key.hash,
        },
      });
      await handle!.writeFile(`CENTRAL_B2B_COMPANY_ID=${companyId}\nCENTRAL_B2B_RESELLER_KEY=${key.key}\n`, {
        encoding: 'utf8',
      });
      await handle!.sync();
    });
    return { company_id: row.id, name: row.name, currency: row.currency, file: out };
  } catch (e) {
    if (handle) await unlink(out).catch(() => undefined);
    throw e;
  } finally {
    await handle?.close();
  }
}
async function main() {
  const db = new PrismaClient();
  const args = process.argv.slice(2),
    arg = (name: string) => args[args.indexOf(name) + 1];
  try {
    if (args.includes('--list')) {
      const rows = await db.reseller.findMany({
        where: { currency: 'USD' },
        select: { id: true, name: true, currency: true, status: true },
        orderBy: { id: 'asc' },
      });
      console.table(rows);
      return;
    }
    if (!['--company', '--name', '--out'].every((k) => args.includes(k)))
      throw new OperatorError(
        'Список: --list. Выпуск: --company ID --name "точное имя" --out /root/jetsim-global-central.env',
      );
    const result = await issueGlobalKey(db, Number(arg('--company')), arg('--name'), arg('--out'));
    console.log(
      `Ключ центральной USD-компании № ${result.company_id} сохранён в ${result.file}. Секрет в консоль не выводится.`,
    );
  } catch (e) {
    console.error(
      e instanceof Error && e.message.startsWith('EEXIST')
        ? 'Файл уже существует. Он не перезаписан, новый ключ не создан.'
        : e instanceof OperatorError
          ? e.message
          : 'Не удалось выпустить ключ. Проверьте базу и права на защищённый файл.',
    );
    process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}
if (require.main === module) void main();
