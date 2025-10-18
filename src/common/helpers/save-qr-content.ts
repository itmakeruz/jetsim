import * as fs from 'fs';
export function saveQrCode(simId: number, qrBuffer: Buffer) {
  const filePath = `uploads/qr/qr_content_${simId}.png`;
  fs.writeFileSync(filePath, qrBuffer);
}
