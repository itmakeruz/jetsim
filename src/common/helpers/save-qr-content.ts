import * as fs from 'fs';
import * as path from 'path';

export function saveQrCode(simId: number, qrBuffer: Buffer) {
  const dir = path.join('uploads', 'qr');
  const filePath = path.join(dir, `qr_content_${simId}.png`);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, qrBuffer);
}
