import { BadRequestException } from '@nestjs/common';
const sharp: typeof import('sharp').default = require('sharp');
import { promises as fs } from 'fs';
import { randomUUID } from 'crypto';
import { join } from 'path';
export async function storeAvatar(file?: Express.Multer.File): Promise<string | undefined> {
  return storePublicImage(file, 'user_profile_image', 5 * 1024 * 1024, 1024);
}
export async function storePublicImage(file: Express.Multer.File | undefined, directory: 'user_profile_image' | 'region_icons' | 'region_group_icons', maxBytes = 8 * 1024 * 1024, width = 2048): Promise<string | undefined> {
  if (!file) return undefined;
  if (!file.buffer || file.size > maxBytes || file.buffer.length > maxBytes) throw new BadRequestException('Image too large');
  try {
    const image = sharp(file.buffer, { limitInputPixels: 25000000 });
    const meta = await image.metadata();
    if (!['jpeg','png','webp'].includes(meta.format || '')) throw new Error();
    const output = await image.rotate().resize(width, width, { fit: 'inside', withoutEnlargement: true }).webp().toBuffer();
    const name = randomUUID() + '.webp';
    const folder = join(process.cwd(), 'uploads', directory);
    await fs.mkdir(folder, { recursive: true });
    await fs.writeFile(join(folder, name), output, { flag: 'wx' });
    return name;
  } catch { throw new BadRequestException('Invalid image. Use JPEG, PNG or WebP'); }
}
