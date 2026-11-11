/**
 * Разовая расстановка region.iso_code у существующих регионов по английскому названию.
 * Заполняет только пустые коды; нераспознанные (не страны) оставляет NULL и печатает списком.
 *   npx ts-node -r tsconfig-paths/register scripts/backfill-region-iso.ts [--apply]
 * Без --apply — только показывает, что изменится.
 */
import { PrismaClient } from '@prisma/client';
import { isoByEnglishName } from '../src/common/helpers/iso-countries';

(async () => {
  const apply = process.argv.includes('--apply');
  const prisma = new PrismaClient();
  try {
    const regions = await prisma.region.findMany({ where: { iso_code: null }, select: { id: true, name_en: true } });
    const unmatched: string[] = [];
    let updated = 0;
    for (const r of regions) {
      const code = isoByEnglishName(r.name_en);
      if (!code) { unmatched.push(`${r.id} ${r.name_en}`); continue; }
      console.log(`${r.id} ${r.name_en} -> ${code}`);
      if (apply) await prisma.region.update({ where: { id: r.id }, data: { iso_code: code } });
      updated++;
    }
    console.log(`\n${apply ? 'Обновлено' : 'Будет обновлено'}: ${updated}; без кода: ${unmatched.length}`);
    if (unmatched.length) console.log('Не распознаны (задать вручную или это не страны):\n' + unmatched.join('\n'));
  } finally {
    await prisma.$disconnect();
  }
})();
