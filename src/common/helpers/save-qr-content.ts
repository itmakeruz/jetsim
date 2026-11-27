import * as fs from 'fs';
import * as path from 'path';

export function saveQrCode(simId: number, qrBuffer: Buffer) {
  const dir = path.join('private', 'qr');
  const filePath = path.join(dir, `qr_content_${simId}.png`);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }

  fs.writeFileSync(filePath, qrBuffer, { mode: 0o600 });
}
